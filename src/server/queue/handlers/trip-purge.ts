/**
 * `trip-purge` — deletes the R2 objects a deleted trip owned (PRD #104 decision 3).
 *
 * D1 cascades and R2 does not. Before this handler existed, deleting a trip removed every `trip_files`
 * row through the foreign key and left every object those rows named sitting in the bucket, billed and
 * unreachable — the per-file paths in `src/server/fns/files.ts` were the only thing that ever deleted
 * an object. The delete is still the record and never waits on this: `deleteTripFn` writes D1, enqueues,
 * and returns, and a queue failure there is logged rather than surfaced.
 *
 * ## What the envelope may and may not decide
 *
 * The envelope names the organization and a list of keys. **The organization is the authority and the
 * keys are a request**, which is the same posture `travel-stats` takes — except that R2 has no
 * `tenantFilter()`, so the tenant boundary has to be drawn on the key itself. Every key this product
 * mints carries the organization id in its second path segment (`storageKeyFor`,
 * `src/server/fns/file-policy.ts`), so that is what is checked, and a key that names another
 * organization is skipped rather than deleted.
 *
 * **Why not a second read of `trip_files`.** By the time this message is delivered the rows are gone —
 * that is what the cascade did, and it is the event that produced the envelope — so an intersection
 * with what the repository still confirms is empty by construction and the purge would be a no-op.
 * The confirmation happens on the producing side instead, where the rows still exist: `deleteTripFn`
 * reads the keys through the tenant-scoped `listTripStorageKeys` *before* it deletes. The handler
 * needs no `DB` binding at all, which is also why it cannot be pointed at rows it should not see.
 *
 * Idempotent by construction: deleting an absent key is a success in R2, so a redelivery finishes
 * rather than dead-letters.
 */

import { deleteObjects } from '#/server/storage/objects'

import type {
  TaskContext,
  TaskHandler,
  TaskMetrics,
  TripPurgePayload,
} from '../types'

/**
 * The envelope id for one chunk of one trip's objects.
 *
 * Deterministic on the trip and the chunk, so a redelivery collapses onto the marker the consumer
 * already holds. The first chunk carries the bare `trip-purge:<tripId>` — which is every trip whose
 * objects fit one message — and a suffix appears only when a trip needs more than one, because two
 * chunks sharing an id would see the second acked as a duplicate and its keys never deleted.
 */
export function tripPurgeTaskId(tripId: string, chunk: number): string {
  return chunk === 0 ? `trip-purge:${tripId}` : `trip-purge:${tripId}:${chunk}`
}

/**
 * Whether a key lies inside this organization's own object namespace.
 *
 * The families a trip owns are `<prefix>/<organizationId>/…` — `storageKeyFor` mints
 * `trips/<org>/<trip>/<file>-<name>`, and any new family a trip purge may delete must keep the
 * organization in the same position for this guard to keep meaning what it says. **Not every family
 * in the bucket has that shape:** `dead-letter/<YYYY-MM-DD>/<id>.json` has no organization segment,
 * so this guard never matches one (the second segment is a date) and a purge cannot reach it. Those
 * objects are removed by the weekly retention slot (`dead-letter-retention.ts`), not by a purge.
 */
function belongsTo(orgId: string, key: string): boolean {
  return key.split('/')[1] === orgId
}

/**
 * The shipped handler.
 *
 * Returns counts rather than nothing: `skipped` is the number that failed the namespace guard, and a
 * non-zero one in production is either a forged envelope or a key family that stopped naming its
 * organization where this expects it — both worth seeing in the completion line. `deleted` counts the
 * keys handed to the bucket rather than the objects that were there to remove: R2 does not report
 * which of them existed, and asking first would be a round trip per key to learn something the delete
 * already makes true.
 */
export const handleTripPurge: TaskHandler<'trip-purge'> =
  async function tripPurge(
    payload: TripPurgePayload,
    context: TaskContext,
  ): Promise<TaskMetrics> {
    const mine = payload.keys.filter((key) => belongsTo(context.orgId, key))
    const skipped = payload.keys.length - mine.length
    if (skipped > 0) {
      context.logger.warn(
        'a trip-purge envelope named objects outside its organization',
        {
          organizationId: context.orgId,
          skipped,
        },
      )
    }

    const deleted = await deleteObjects(context.env.FILES, mine)

    return { requested: payload.keys.length, deleted, skipped }
  }
