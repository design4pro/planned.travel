/**
 * The `TaskContext` a `trip-purge` runs in, with a fake bucket behind `FILES`.
 *
 * Shared between the handler's own suite and the tenant-isolation suite, which asks the same handler
 * a different question — both need the binding surface fully populated rather than cast into shape,
 * so that a handler reaching for something it should not touch fails here instead of at runtime.
 */

import { createLogger, createMemorySink } from '#/server/observability/logger'
import { tripPurgeTaskId } from '../trip-purge'

import type { FakeBucket } from '#/server/storage/__tests__/fake-bucket'
import type { TaskBindings, TaskContext } from '../../types'

/** A binding surface with nothing on it a purge can reach for by accident. */
export function purgeBindings(bucket: FakeBucket): TaskBindings {
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

export function purgeContext(orgId: string, bucket: FakeBucket): TaskContext {
  return {
    env: purgeBindings(bucket),
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => Date.parse('2026-08-31T09:00:00.000Z'),
    attempt: 1,
    taskId: tripPurgeTaskId('trip-1', 0),
    orgId,
    callProvider: (_label, send) => send(),
  }
}
