/**
 * The shell the detached producers share: one lazy reach for the binding, and a refusal that is
 * logged once and never thrown.
 *
 * The producers' own suites (`travel-stats-fanout.test.ts`, `trip-lifecycle-side-effects.test.ts`)
 * still cross their interfaces; this covers what only the helper decides.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QUEUE_BATCH_MAX } from '../jobs'
import { enqueueDetached } from '../enqueue-detached'

import type { EnqueueInput } from '../jobs'
import type { TaskKind } from '../types'

const stubs = vi.hoisted(() => ({
  batchSizes: [] as Array<number>,
  /** How many times the helper reached for the binding at all. */
  bindingReads: 0,
  /** When true, the binding refuses the way an unreachable one does. */
  rejects: false,
}))

/** `#/server/auth/env` imports `cloudflare:workers`, which does not resolve in plain Node. */
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => {
    stubs.bindingReads += 1
    return {
      sendBatch: async (messages: Array<{ body: unknown }>) => {
        if (stubs.rejects) {
          throw new Error('TASKS binding is unreachable')
        }
        stubs.batchSizes.push(messages.length)
        return undefined
      },
    }
  },
}))

function envelopes(count: number): Array<EnqueueInput<TaskKind>> {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'travel-stats',
    orgId: 'org_1',
    id: `stats:${index}`,
    payload: { userId: `user_${index}`, statYear: 0 },
  }))
}

describe('enqueueDetached', () => {
  const warn = vi.fn()
  const log = {
    logger: { warn },
    message: 'the thing was not enqueued',
    context: { organizationId: 'org_1', tripId: 'trip_1' },
  }

  beforeEach(() => {
    stubs.batchSizes = []
    stubs.bindingReads = 0
    stubs.rejects = false
    warn.mockReset()
  })

  it('sends what the builder returns and logs nothing', async () => {
    await enqueueDetached(() => envelopes(3), log)

    expect(stubs.batchSizes).toEqual([3])
    expect(warn).not.toHaveBeenCalled()
  })

  it('hands every envelope over at once, leaving the batch bound to enqueueTasks', async () => {
    await enqueueDetached(() => envelopes(QUEUE_BATCH_MAX + 1), log)

    expect(stubs.batchSizes).toEqual([QUEUE_BATCH_MAX, 1])
  })

  it('never reads the binding when there is nothing to send', async () => {
    await enqueueDetached(() => [], log)

    expect(stubs.bindingReads).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })

  it('logs a refused send once, with the error merged over the context, and resolves', async () => {
    stubs.rejects = true

    await expect(
      enqueueDetached(() => envelopes(2), log),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      'the thing was not enqueued',
      expect.objectContaining({
        organizationId: 'org_1',
        tripId: 'trip_1',
        errorName: 'Error',
        errorMessage: 'TASKS binding is unreachable',
      }),
    )
  })

  it('catches a builder that throws the same way, without reaching the binding', async () => {
    await expect(
      enqueueDetached(() => {
        throw new Error('payload refused')
      }, log),
    ).resolves.toBeUndefined()

    expect(stubs.bindingReads).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      'the thing was not enqueued',
      expect.objectContaining({
        organizationId: 'org_1',
        errorMessage: 'payload refused',
      }),
    )
  })

  it('lets the error win over a context field of the same name', async () => {
    stubs.rejects = true

    await enqueueDetached(() => envelopes(1), {
      ...log,
      context: { errorMessage: 'from the caller' },
    })

    expect(warn).toHaveBeenCalledWith(
      log.message,
      expect.objectContaining({
        errorMessage: 'TASKS binding is unreachable',
      }),
    )
  })
})
