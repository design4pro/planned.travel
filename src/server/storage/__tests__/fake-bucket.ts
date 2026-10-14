/**
 * An R2 bucket that remembers what it was asked to delete, and holds the bytes it was given.
 *
 * Shared rather than re-declared, because several suites need the same facts about the same binding
 * and they must not drift: `deleteObjects` chunks, so what a test measures is the *shape of the
 * calls*; R2 forgets what it never had, so a key that is already gone is a success rather than a
 * failure — the property a redelivered `trip-purge` depends on; and `copyObject` makes a **second
 * object**, which can only be shown by a fake that stores bodies rather than key names alone.
 */

import type { ObjectStore } from '../objects'

/** What one key holds. `contentType` and `contentDisposition` are absent when the writer set none. */
export interface FakeObject {
  readonly body: string
  readonly contentType?: string
  readonly contentDisposition?: string
}

export interface FakeBucket extends ObjectStore {
  /** One entry per `delete` call, holding the keys that call carried. */
  readonly calls: Array<Array<string>>
  /** The keys still in the bucket — what a purge was supposed to remove, or to leave alone. */
  readonly remaining: Set<string>
  /** The bytes behind each remaining key, so a copy can be read back and compared. */
  readonly objects: Map<string, FakeObject>
  get: NonNullable<ObjectStore['get']>
  put: NonNullable<ObjectStore['put']>
}

function streamOf(body: string): ReadableStream {
  return new Response(body).body as ReadableStream
}

export function fakeBucket(
  present: ReadonlyArray<string> | Readonly<Record<string, FakeObject>> = [],
): FakeBucket {
  const seeded: Array<[string, FakeObject]> = Array.isArray(present)
    ? present.map((key) => [key, { body: `bytes:${key}` }])
    : Object.entries(present as Record<string, FakeObject>)
  const objects = new Map(seeded)
  const remaining = new Set(objects.keys())
  const calls: Array<Array<string>> = []
  return {
    calls,
    remaining,
    objects,
    delete: async (keys) => {
      const list = typeof keys === 'string' ? [keys] : [...keys]
      calls.push(list)
      // R2 deletes what it has and says nothing about what it does not.
      for (const key of list) {
        remaining.delete(key)
        objects.delete(key)
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
    put: async (key, value, options) => {
      const body = await new Response(value).text()
      const { contentType, contentDisposition } = options?.httpMetadata ?? {}
      objects.set(key, {
        body,
        ...(contentType === undefined ? {} : { contentType }),
        ...(contentDisposition === undefined ? {} : { contentDisposition }),
      })
      remaining.add(key)
      return undefined
    },
  }
}
