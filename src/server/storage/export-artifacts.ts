/**
 * The `exports/` key family — what a trip export writes into R2, how a listing reads it back, and
 * how the oldest of it is removed.
 *
 * One concept, one owner (`docs/SPEC.md` §8): the `pdf-export` handler writes these keys, the export
 * list and download read them, and the trip purge removes them, so the layout lives here and nowhere
 * else. Like `./objects`, the bucket is a **parameter** and a minimal structural port: reading the
 * ambient Worker environment would drag `cloudflare:workers` into the queue consumer's module graph,
 * and the whole server suite runs in plain Node.
 *
 * ## What a trip export is on disk
 *
 * `exports/<org>/<trip>/<taskId>.pdf` (when a PDF was rendered) and `exports/<org>/<trip>/<taskId>.html`.
 * The handler writes the PDF **first** and the page **last**, so the page is the completion marker:
 * a listing never announces an artifact whose page is not there yet, and the format it reports can
 * never change under a reader who is polling.
 *
 * ## R2's paging contract is part of the design
 *
 * `list` answers a bounded page (at most 1000 objects) with a `cursor` and a `truncated` flag, and in
 * **lexicographic key order, not by time**. So every function here pages the whole prefix before it
 * sorts by `uploaded`; none of them trusts the order a page arrived in.
 */

import { deleteObjects } from './objects'

/** Seconds an export artifact is kept: the KV pointer expires with it, and the read side enforces it. */
export const EXPORT_TTL_SECONDS = 7 * 24 * 60 * 60

/** The newest artifacts a trip keeps once the prune has run. */
export const EXPORT_KEEP_COUNT = 5

export type ExportFormat = 'html' | 'pdf'

/** One object as a listing reports it. */
export interface ExportListedObject {
  readonly key: string
  readonly size: number
  readonly uploaded: Date
}

/** One page of a listing. `cursor` is present only while `truncated`. */
export interface ExportListResult {
  readonly objects: ReadonlyArray<ExportListedObject>
  readonly truncated: boolean
  readonly cursor?: string | undefined
}

/**
 * The two verbs this module needs from an R2 bucket.
 *
 * Structural, so `R2Bucket` and the queue consumer's `TaskBindings['FILES']` satisfy it as they are.
 */
export interface ExportStore {
  list: (options: {
    prefix: string
    cursor?: string | undefined
  }) => Promise<ExportListResult>
  delete: (keys: string | Array<string>) => Promise<void>
}

/** A finished export, as the list shows it. */
export interface ExportArtifact {
  readonly taskId: string
  readonly format: ExportFormat
  readonly sizeBytes: number
  /** Epoch milliseconds of the object the format names. */
  readonly createdAt: number
}

export function exportObjectKey(
  orgId: string,
  tripId: string,
  taskId: string,
  extension: ExportFormat,
): string {
  return `${exportPrefix(orgId, tripId)}${taskId}.${extension}`
}

export function exportPointerKey(taskId: string): string {
  return `export:${taskId}`
}

/**
 * Every export of one trip lives under this prefix. **The trailing slash is the point**: without it
 * `exports/<org>/<trip>` also matches a trip whose id begins with the same characters.
 */
export function exportPrefix(orgId: string, tripId: string): string {
  return `exports/${orgId}/${tripId}/`
}

/** Whether an artifact made at `createdAt` (epoch ms) is past its seven days. */
export function isExpired(createdAt: number, now: number): boolean {
  return now - createdAt > EXPORT_TTL_SECONDS * 1000
}

/** `<taskId>.html` or `<taskId>.pdf`, with nothing nested beneath the prefix. */
const OBJECT_NAME = /^([^/]+)\.(html|pdf)$/

interface ParsedObject {
  readonly taskId: string
  readonly format: ExportFormat
  readonly key: string
  readonly size: number
  readonly createdAt: number
}

/** Every object under the prefix, across all the pages R2 answers with. */
async function listAll(
  store: ExportStore,
  prefix: string,
): Promise<ReadonlyArray<ExportListedObject>> {
  const found: Array<ExportListedObject> = []
  let cursor: string | undefined
  for (;;) {
    const page = await store.list(
      cursor === undefined ? { prefix } : { prefix, cursor },
    )
    found.push(...page.objects)
    // A page that claims more but names no way to ask for it ends the loop rather than spinning.
    if (!page.truncated || page.cursor === undefined) {
      return found
    }
    cursor = page.cursor
  }
}

/** The objects whose names parse, grouped by task id. A name that does not parse is not here. */
function groupByTask(
  prefix: string,
  objects: ReadonlyArray<ExportListedObject>,
): Map<string, Map<ExportFormat, ParsedObject>> {
  const groups = new Map<string, Map<ExportFormat, ParsedObject>>()
  for (const object of objects) {
    const match = OBJECT_NAME.exec(object.key.slice(prefix.length))
    if (!object.key.startsWith(prefix) || match === null) {
      continue
    }
    const taskId = match[1]
    const format: ExportFormat = match[2] === 'pdf' ? 'pdf' : 'html'
    const group = groups.get(taskId) ?? new Map<ExportFormat, ParsedObject>()
    group.set(format, {
      taskId,
      format,
      key: object.key,
      size: object.size,
      createdAt: object.uploaded.getTime(),
    })
    groups.set(taskId, group)
  }
  return groups
}

/**
 * The finished artifacts of one trip, newest first.
 *
 * An artifact is finished when its page exists. It reports the PDF when one exists beside it, with
 * the size and instant of the object the format names. One past its seven days is left out, so
 * "kept for 7 days" stays true for a trip exported once and never again.
 */
export async function listExportArtifacts(
  store: ExportStore,
  orgId: string,
  tripId: string,
  { now }: { readonly now: number },
): Promise<Array<ExportArtifact>> {
  const prefix = exportPrefix(orgId, tripId)
  const groups = groupByTask(prefix, await listAll(store, prefix))
  return finishedArtifacts(groups).filter(
    (artifact) => !isExpired(artifact.createdAt, now),
  )
}

/** The groups that have a page, as artifacts in their preferred format, newest first. */
function finishedArtifacts(
  groups: Map<string, Map<ExportFormat, ParsedObject>>,
): Array<ExportArtifact> {
  const artifacts: Array<ExportArtifact> = []
  for (const [taskId, group] of groups) {
    if (!group.has('html')) {
      continue
    }
    const preferred = group.get('pdf') ?? group.get('html')
    if (preferred === undefined) {
      continue
    }
    artifacts.push({
      taskId,
      format: preferred.format,
      sizeBytes: preferred.size,
      createdAt: preferred.createdAt,
    })
  }
  return artifacts.sort(
    (a, b) => b.createdAt - a.createdAt || a.taskId.localeCompare(b.taskId),
  )
}

/** Every key under the trip's prefix, whatever its name: what the purge of a deleted trip removes. */
export async function listExportKeys(
  store: ExportStore,
  orgId: string,
  tripId: string,
): Promise<Array<string>> {
  const objects = await listAll(store, exportPrefix(orgId, tripId))
  return objects.map((object) => object.key)
}

/**
 * Removes the artifacts a trip no longer keeps, and answers with how many objects it deleted.
 *
 * Every object of every artifact past its seven days goes; of the rest only the newest
 * {@link EXPORT_KEEP_COUNT} stay. A PDF whose page never arrived is deleted once it is older than
 * the TTL, and left alone before that, because it may be a job still running. A name that does not
 * parse is neither listed nor deleted. Bounded by construction: one paged listing and a handful of
 * chunked deletes, so a trip exported twice a day converges on five artifacts instead of growing.
 */
export async function pruneExportArtifacts(
  store: ExportStore,
  orgId: string,
  tripId: string,
  { now }: { readonly now: number },
): Promise<number> {
  const prefix = exportPrefix(orgId, tripId)
  const groups = groupByTask(prefix, await listAll(store, prefix))
  const doomed: Array<string> = []
  const finished = finishedArtifacts(groups)
  const finishedIds = new Set(finished.map((artifact) => artifact.taskId))

  const live: Array<ExportArtifact> = []
  for (const artifact of finished) {
    if (isExpired(artifact.createdAt, now)) {
      doomed.push(...keysOf(groups, artifact.taskId))
    } else {
      live.push(artifact)
    }
  }
  for (const artifact of live.slice(EXPORT_KEEP_COUNT)) {
    doomed.push(...keysOf(groups, artifact.taskId))
  }

  for (const [taskId, group] of groups) {
    const lone = group.get('pdf')
    if (
      !finishedIds.has(taskId) &&
      lone !== undefined &&
      isExpired(lone.createdAt, now)
    ) {
      doomed.push(lone.key)
    }
  }

  return deleteObjects(store, doomed)
}

function keysOf(
  groups: Map<string, Map<ExportFormat, ParsedObject>>,
  taskId: string,
): Array<string> {
  return [...(groups.get(taskId)?.values() ?? [])].map((object) => object.key)
}
