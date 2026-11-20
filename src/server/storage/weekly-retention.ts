import { isExpired, isExportObjectName } from './export-artifacts'
import { deleteObjects } from './objects'
import { idSchema } from '#/server/repos/validation'
import type { ExportStore } from './export-artifacts'
import type { Logger } from '#/server/observability'

type Family = 'exports' | 'trips'
type RetentionStore = Pick<ExportStore, 'delete'> & {
  list: (options: {
    prefix: string
    startAfter?: string
    limit: number
  }) => ReturnType<ExportStore['list']>
}

export interface RetentionOwnership {
  organizationExists: (organizationId: string) => Promise<boolean>
  hasUploadReference: (
    organizationId: string,
    tripId: string,
    key: string,
  ) => Promise<boolean>
}

interface RetentionDependencies {
  bucket: RetentionStore
  checkpoints: {
    get: (key: string) => Promise<string | null>
    put: (key: string, value: string) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  ownership: RetentionOwnership
  logger: Pick<Logger, 'info'>
  now: number
}

// Reserve headroom for the other scheduled jobs. Each upload can require six D1
// reads across the initial and final checks, and each export requires one.
const PAGE_SIZE = 10
const MAX_PAGES = 10
const UPLOAD_GRACE_MS = 7 * 24 * 60 * 60 * 1000

function parseKey(family: Family, key: string) {
  const [prefix, organizationId, tripId, object, extra] = key.split('/')
  if (
    prefix !== family ||
    extra !== undefined ||
    !organizationId ||
    !tripId ||
    !object ||
    idSchema.safeParse(organizationId).data !== organizationId ||
    idSchema.safeParse(tripId).data !== tripId ||
    [organizationId, tripId, object].some(
      (segment) =>
        segment === '.' ||
        segment === '..' ||
        segment.includes('\\') ||
        Array.from(segment).some(
          (character) => character < ' ' || character === '\x7f',
        ),
    ) ||
    (family === 'exports' && !isExportObjectName(object))
  )
    return null
  return { organizationId, tripId }
}

export async function pruneWeeklyObjects(
  family: Family,
  { bucket, checkpoints, ownership, logger, now }: RetentionDependencies,
) {
  const prefix = `${family}/`
  const checkpointKey = `retention:weekly:${family}`
  const saved = await checkpoints.get(checkpointKey)
  let after = saved?.startsWith(prefix) ? saved : undefined
  let inspected = 0
  let skipped = 0
  let deleted = 0
  let remaining = true
  const isOrphan = async (
    organizationId: string,
    tripId: string,
    key: string,
  ) =>
    (await ownership.organizationExists(organizationId)) &&
    !(await ownership.hasUploadReference(organizationId, tripId, key))

  try {
    for (let index = 0; index < MAX_PAGES; index++) {
      // A key boundary survives deletion of the last listed object.
      const page = await bucket.list({
        prefix,
        limit: PAGE_SIZE,
        ...(after === undefined ? {} : { startAfter: after }),
      })
      const last = page.objects.at(-1)?.key
      if (
        page.objects.length > PAGE_SIZE ||
        (page.truncated &&
          (last === undefined || last === after || !last.startsWith(prefix)))
      ) {
        throw new Error(
          'Weekly object retention listing did not provide a valid page',
        )
      }

      const candidates: Array<{
        organizationId: string
        tripId: string
        key: string
      }> = []
      for (const object of page.objects) {
        inspected++
        const ids = parseKey(family, object.key)
        const uploaded = object.uploaded.getTime()
        if (ids === null || !Number.isFinite(uploaded)) {
          skipped++
          continue
        }
        const eligible =
          family === 'exports'
            ? isExpired(uploaded, now) &&
              (await ownership.organizationExists(ids.organizationId))
            : now - uploaded >= UPLOAD_GRACE_MS &&
              (await isOrphan(ids.organizationId, ids.tripId, object.key))
        if (eligible) candidates.push({ ...ids, key: object.key })
        else skipped++
      }

      const keys: Array<string> = []
      for (const { organizationId, tripId, key } of candidates) {
        if (
          family === 'exports' ||
          (await isOrphan(organizationId, tripId, key))
        )
          keys.push(key)
        else skipped++
      }
      deleted += await deleteObjects(bucket, keys)
      remaining = page.truncated
      if (!remaining) break
      after = last
    }
  } finally {
    // KV allows one write per key per second. Flush only the most recent fully
    // processed page, including on a failure, so the failed page is replayed.
    if (remaining) {
      if (after !== undefined && after !== saved)
        await checkpoints.put(checkpointKey, after)
    } else if (saved !== null) {
      await checkpoints.delete(checkpointKey)
    }
    logger.info('weekly object retention', {
      family,
      inspected,
      skipped,
      deleted,
      remaining,
    })
  }
  return { inspected, skipped, deleted, remaining }
}
