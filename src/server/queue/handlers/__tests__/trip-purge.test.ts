/**
 * The `trip-purge` handler — the second half of a terminal delete (PRD #104 decision 3).
 *
 * D1 is the record and it has already been written by the time this runs: the trip's rows, including
 * every `trip_files` row, went with the cascade. So the handler cannot ask the database which of the
 * envelope's keys it may delete — by construction the answer is none — and what it checks instead is
 * the **key namespace**, which survives the rows: `storageKeyFor` (`src/server/fns/file-policy.ts`)
 * puts the organization id in the second path segment of every key it mints, and the envelope's
 * `orgId` is the only authority the consumer trusts. A forged envelope can therefore only name
 * objects its own tenant already owned.
 */
import { describe, expect, it } from 'vitest'

import { createLogger, createMemorySink } from '#/server/observability/logger'
import { taskHandlers } from '../../consumer'
import { buildTaskEnvelope } from '../../jobs'
import {
  MAX_PURGE_KEYS,
  taskEnvelopeSchema,
  tripPurgePayloadSchema,
} from '../../types'
import { handleTripPurge, tripPurgeTaskId } from '../trip-purge'

import type { ObjectStore } from '#/server/storage/objects'
import type { TaskBindings, TaskContext } from '../../types'

const ALPHA = 'org-alpha'
const BETA = 'org-beta'

interface FakeBucket extends ObjectStore {
  readonly calls: Array<Array<string>>
  readonly remaining: Set<string>
}

function fakeBucket(present: ReadonlyArray<string>): FakeBucket {
  const remaining = new Set(present)
  const calls: Array<Array<string>> = []
  return {
    calls,
    remaining,
    delete: async (keys) => {
      const list = typeof keys === 'string' ? [keys] : [...keys]
      calls.push(list)
      for (const key of list) remaining.delete(key)
    },
  }
}

/** A binding surface with nothing on it a purge can reach for by accident. */
function fakeEnv(bucket: FakeBucket): TaskBindings {
  return {
    KV: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    },
    FILES: {
      get: async () => null,
      put: async () => undefined,
      head: async () => null,
      delete: bucket.delete,
      list: async () => ({ objects: [], truncated: false }),
    },
    TASKS: { send: async () => undefined, sendBatch: async () => undefined },
  }
}

function context(orgId: string, bucket: FakeBucket): TaskContext {
  return {
    env: fakeEnv(bucket),
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => Date.parse('2026-08-31T09:00:00.000Z'),
    attempt: 1,
    taskId: tripPurgeTaskId('trip-1', 0),
    orgId,
    callProvider: (_label, send) => send(),
  }
}

const keyIn = (orgId: string, index: number): string =>
  `trips/${orgId}/trip-1/file-${index}-photo.jpg`

describe('handleTripPurge', () => {
  it('deletes every key the envelope’s own organization owns', async () => {
    const keys = [keyIn(ALPHA, 1), keyIn(ALPHA, 2)]
    const bucket = fakeBucket(keys)

    await expect(
      handleTripPurge({ keys }, context(ALPHA, bucket)),
    ).resolves.toMatchObject({ requested: 2, deleted: 2, skipped: 0 })
    expect(bucket.remaining.size).toBe(0)
  })

  it('deletes nothing for keys belonging to another organization', async () => {
    const foreign = [keyIn(BETA, 1), keyIn(BETA, 2)]
    const bucket = fakeBucket(foreign)

    await expect(
      handleTripPurge({ keys: foreign }, context(ALPHA, bucket)),
    ).resolves.toMatchObject({ requested: 2, deleted: 0, skipped: 2 })
    expect(bucket.calls).toEqual([])
    expect(bucket.remaining.size).toBe(2)
  })

  it('keeps the caller’s own keys and drops the smuggled ones from the same envelope', async () => {
    const mine = keyIn(ALPHA, 1)
    const theirs = keyIn(BETA, 1)
    const bucket = fakeBucket([mine, theirs])

    await handleTripPurge({ keys: [mine, theirs] }, context(ALPHA, bucket))

    expect(bucket.calls).toEqual([[mine]])
    expect([...bucket.remaining]).toEqual([theirs])
  })

  it('sends a full message in one bucket call, and refuses a fuller one at the boundary', async () => {
    const keys = Array.from({ length: MAX_PURGE_KEYS }, (_, index) =>
      keyIn(ALPHA, index),
    )
    const bucket = fakeBucket(keys)

    await handleTripPurge({ keys }, context(ALPHA, bucket))
    expect(bucket.calls.map((call) => call.length)).toEqual([MAX_PURGE_KEYS])

    // The producer's chunk bound, held by the schema rather than by the producer's memory: a message
    // that carried every key of an unlimited-tier trip would exceed the 128 KB Queues body ceiling.
    expect(() =>
      tripPurgePayloadSchema.parse({
        keys: [...keys, keyIn(ALPHA, MAX_PURGE_KEYS)],
      }),
    ).toThrow()
  })

  it('ends in the same state when the same envelope is delivered twice', async () => {
    const keys = [keyIn(ALPHA, 1)]
    const bucket = fakeBucket(keys)
    const ctx = context(ALPHA, bucket)

    const first = await handleTripPurge({ keys }, ctx)
    const second = await handleTripPurge({ keys }, ctx)

    expect(second).toEqual(first)
    expect(bucket.remaining.size).toBe(0)
  })

  it('is registered with the consumer, so a `case` cannot dead-letter it', () => {
    expect(taskHandlers['trip-purge']).toBe(handleTripPurge)
  })

  it('rides an envelope the real schema accepts, with a deterministic id', () => {
    const envelope = buildTaskEnvelope(
      {
        kind: 'trip-purge',
        orgId: ALPHA,
        id: tripPurgeTaskId('trip-1', 0),
        payload: { keys: [keyIn(ALPHA, 1)] },
      },
      () => 1,
    )

    expect(taskEnvelopeSchema.parse(envelope).id).toBe('trip-purge:trip-1')
    expect(tripPurgeTaskId('trip-1', 2)).toBe('trip-purge:trip-1:2')
  })
})
