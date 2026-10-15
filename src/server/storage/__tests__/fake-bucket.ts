/**
 * An R2 bucket that remembers what it was asked to delete, and holds the bytes it was given.
 *
 * Shared rather than re-declared, because several suites need the same facts about the same binding
 * and they must not drift: `deleteObjects` chunks, so what a test measures is the *shape of the
 * calls*; R2 forgets what it never had, so a key that is already gone is a success rather than a
 * failure — the property a redelivered `trip-purge` depends on; and `copyObject` makes a **second
 * object**, which can only be shown by a fake that stores bodies rather than key names alone.
 */

import type { ExportListResult, ExportStore } from '../export-artifacts'
import type { ObjectStore } from '../objects'

/** What one key holds. `contentType` and `contentDisposition` are absent when the writer set none. */
export interface FakeObject {
  readonly body: string
  readonly contentType?: string
  readonly contentDisposition?: string
  /** When the object was written. Absent means the epoch, so a seeded key is "old" unless it says so. */
  readonly uploaded?: Date
}

export interface FakeBucket extends ObjectStore {
  /** One entry per `delete` call, holding the keys that call carried. */
  readonly calls: Array<Array<string>>
  /** The keys still in the bucket — what a purge was supposed to remove, or to leave alone. */
  readonly remaining: Set<string>
  /** The bytes behind each remaining key, so a copy can be read back and compared. */
  readonly objects: Map<string, FakeObject>
  /** One entry per `list` call, holding the options it carried, so a test can count the pages. */
  readonly listCalls: Array<Parameters<ExportStore['list']>[0]>
  get: NonNullable<ObjectStore['get']>
  put: NonNullable<ObjectStore['put']>
  list: ExportStore['list']
}

export interface FakeBucketOptions {
  /**
   * How many objects one `list` answers with. R2's is 1000; a test passes a small one so the cursor
   * loop runs on a handful of keys.
   */
  readonly pageSize?: number
  /** The instant an object is stamped with when it is `put`. Seeded objects carry their own. */
  readonly now?: () => Date
}

function streamOf(body: string): ReadableStream {
  return new Response(body).body as ReadableStream
}

export function fakeBucket(
  present: ReadonlyArray<string> | Readonly<Record<string, FakeObject>> = [],
  options: FakeBucketOptions = {},
): FakeBucket {
  const seeded: Array<[string, FakeObject]> = Array.isArray(present)
    ? present.map((key) => [key, { body: `bytes:${key}` }])
    : Object.entries(present as Record<string, FakeObject>)
  const objects = new Map(seeded)
  const remaining = new Set(objects.keys())
  const calls: Array<Array<string>> = []
  const listCalls: Array<Parameters<ExportStore['list']>[0]> = []
  const pageSize = options.pageSize ?? 1000
  const clock = options.now ?? (() => new Date())
  // Kept beside `objects` rather than inside it, so a read-back of a stored object stays its body and
  // type alone.
  const writtenAt = new Map<string, Date>()
  return {
    calls,
    listCalls,
    remaining,
    objects,
    /**
     * Lists in **lexicographic key order, not by time**, `pageSize` objects at a time, behind an
     * opaque cursor: R2's contract, and the reason a caller must page the whole prefix before it
     * sorts by `uploaded`.
     */
    list: async (listOptions): Promise<ExportListResult> => {
      listCalls.push(listOptions)
      const keys = [...objects.keys()]
        .filter((key) => key.startsWith(listOptions.prefix))
        .sort()
      const start =
        listOptions.cursor === undefined
          ? 0
          : keys.findIndex((key) => key > String(listOptions.cursor))
      const rest = start === -1 ? [] : keys.slice(start)
      const page = rest.slice(0, pageSize)
      const truncated = rest.length > page.length
      return {
        objects: page.map((key) => ({
          key,
          size: objects.get(key)?.body.length ?? 0,
          uploaded:
            objects.get(key)?.uploaded ?? writtenAt.get(key) ?? new Date(0),
        })),
        truncated,
        ...(truncated ? { cursor: page[page.length - 1] } : {}),
      }
    },
    delete: async (keys) => {
      const list = typeof keys === 'string' ? [keys] : [...keys]
      calls.push(list)
      // R2 deletes what it has and says nothing about what it does not.
      for (const key of list) {
        remaining.delete(key)
        objects.delete(key)
        writtenAt.delete(key)
      }
    },
    get: async (key) => {
      const object = objects.get(key)
      if (!object) return null
      return {
        body: streamOf(object.body),
        ...(object.contentType === undefined &&
        object.contentDisposition === undefined
          ? {}
          : {
              httpMetadata: {
                ...(object.contentType === undefined
                  ? {}
                  : { contentType: object.contentType }),
                ...(object.contentDisposition === undefined
                  ? {}
                  : { contentDisposition: object.contentDisposition }),
              },
            }),
      }
    },
    put: async (key, value, putOptions) => {
      const body = await new Response(value).text()
      const { contentType, contentDisposition } = putOptions?.httpMetadata ?? {}
      objects.set(key, {
        body,
        ...(contentType === undefined ? {} : { contentType }),
        ...(contentDisposition === undefined ? {} : { contentDisposition }),
      })
      remaining.add(key)
      writtenAt.set(key, clock())
      return undefined
    },
  }
}
