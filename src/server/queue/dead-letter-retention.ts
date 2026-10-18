/**
 * The dead-letter retention deleter - the weekly slot's storage half for `dead-letter/`.
 *
 * A message the consumer gives up on is written whole to `dead-letter/<YYYY-MM-DD>/<id>.json`
 * (`taskDeadObjectKey`): the envelope body, which for an auth email carries the token link and for
 * other kinds the requester's id. The key has **no organization segment**, so no per-workspace purge
 * can find these objects, and nothing deleted them. The KV summary beside each one expires after
 * `TASK_DEAD_TTL_SECONDS` (14 days); this deleter keeps the R2 body for at least that long (it is
 * removed by the first weekly run after it turns 14 days old), the post-mortem window
 * `docs/DEPLOY.md` already describes.
 *
 * Like `./../storage/objects`, the bucket is a **parameter** and a structural port, so this module
 * never reaches `cloudflare:workers` and the Node suite can drive it with a fake.
 *
 * ## Decisions
 *
 * - **By `uploaded`, strictly older than the period.** The key's date is the day the message died,
 *   but the object's own timestamp is what R2 vouches for, and a strict cut-off makes a rerun in the
 *   same instant a no-op.
 * - **A bad period never widens the deletion.** An unset, non-numeric, zero or negative value falls
 *   back to the default instead of becoming "everything is older than zero days".
 * - **Bounded per run.** A listing is read page by page up to `maxPages`; what is left is reported as
 *   `drained: false` and the next week's run continues, so a backlog cannot exhaust a Worker
 *   invocation.
 * - **Counts only in the log.** The keys are message ids; the line names none of them.
 */

import { deleteObjects } from '#/server/storage/objects'
import { TASK_DEAD_OBJECT_PREFIX } from './jobs'
import { numberFromEnv } from './types'

import type { ExportStore } from '#/server/storage/export-artifacts'
import type { Logger } from '#/server/observability/logger'

const DAY_MS = 24 * 60 * 60 * 1000

/** How long a dead letter's R2 body is kept when `DEAD_LETTER_RETENTION_DAYS` is not set. */
export const DEAD_LETTER_RETENTION_DAYS_DEFAULT = 14

/** Pages of up to 1000 objects one run reads; the next run continues from what is left. */
export const DEAD_LETTER_MAX_PAGES = 20

/** Reads `DEAD_LETTER_RETENTION_DAYS`; anything that is not a positive whole number is the default. */
export function resolveDeadLetterRetentionDays(
  value: number | string | undefined,
): number {
  // `numberFromEnv` parses a string with `parseInt`, which reads "1e2" as 1 and "30days" as 30;
  // a text value has to be plain digits before it is trusted to narrow the period.
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    return DEAD_LETTER_RETENTION_DAYS_DEFAULT
  }
  const days = numberFromEnv(value, DEAD_LETTER_RETENTION_DAYS_DEFAULT)
  return days >= 1 ? Math.floor(days) : DEAD_LETTER_RETENTION_DAYS_DEFAULT
}

export interface DeadLetterPruneOptions {
  readonly now: Date
  readonly retentionDays: number
  readonly maxPages?: number
}

export interface DeadLetterPruneResult {
  readonly listed: number
  readonly deleted: number
  /** False when the page cap stopped the run before the listing ended. */
  readonly drained: boolean
}

export async function pruneDeadLetters(
  store: ExportStore,
  logger: Logger,
  options: DeadLetterPruneOptions,
): Promise<DeadLetterPruneResult> {
  const maxPages = options.maxPages ?? DEAD_LETTER_MAX_PAGES
  const cutoff = options.now.getTime() - options.retentionDays * DAY_MS
  let cursor: string | undefined
  let pages = 0
  let listed = 0
  let deleted = 0
  let drained = false

  try {
    while (pages < maxPages) {
      const page = await store.list({ prefix: TASK_DEAD_OBJECT_PREFIX, cursor })
      pages += 1
      listed += page.objects.length
      const expired = page.objects
        .filter(
          (object) =>
            object.key.startsWith(TASK_DEAD_OBJECT_PREFIX) &&
            object.uploaded.getTime() < cutoff,
        )
        .map((object) => object.key)
      deleted += await deleteObjects(store, expired)
      if (!page.truncated || page.cursor === undefined) {
        drained = true
        break
      }
      cursor = page.cursor
    }
  } finally {
    // Counts are logged even when a `delete` throws on page N, so what was already removed is not lost.
    logger.info('dead-letter retention pruned', {
      retentionDays: options.retentionDays,
      listed,
      deleted,
      pages,
      drained,
    })
  }
  return { listed, deleted, drained }
}
