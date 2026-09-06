/**
 * An R2 bucket that remembers what it was asked to delete.
 *
 * Shared rather than re-declared, because three suites need the same two facts about the same
 * binding and they must not drift: `deleteObjects` chunks, so what a test measures is the *shape of
 * the calls*; and R2 forgets what it never had, so a key that is already gone is a success rather
 * than a failure — the property a redelivered `trip-purge` depends on.
 */

import type { ObjectStore } from '../objects'

export interface FakeBucket extends ObjectStore {
  /** One entry per `delete` call, holding the keys that call carried. */
  readonly calls: Array<Array<string>>
  /** The keys still in the bucket — what a purge was supposed to remove, or to leave alone. */
  readonly remaining: Set<string>
}

export function fakeBucket(present: ReadonlyArray<string> = []): FakeBucket {
  const remaining = new Set(present)
  const calls: Array<Array<string>> = []
  return {
    calls,
    remaining,
    delete: async (keys) => {
      const list = typeof keys === 'string' ? [keys] : [...keys]
      calls.push(list)
      // R2 deletes what it has and says nothing about what it does not.
      for (const key of list) remaining.delete(key)
    },
  }
}
