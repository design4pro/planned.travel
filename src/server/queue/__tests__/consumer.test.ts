/**
 * The consumer's contract is about *settlement*: every message must end up
 * acked or retried exactly once, and which one it gets has to depend on the
 * kind of failure rather than on luck. These tests drive it through fakes for
 * KV, R2 and the queue, so the decisions are observable without a Worker.
 */

import { describe, expect, it } from 'vitest'
import { consumeTaskBatch } from '../consumer'
import { taskDeadKey, taskDoneKey } from '../jobs'
import { TaskPermanentError, TaskRetryableError } from '../types'
import { createLogger, createMemorySink } from '../../observability/logger'

import type { QueueBatchLike, QueueMessageLike, TaskHandlerRegistry } from '../consumer'
import type { TaskBindings, TaskEnvelope } from '../types'

function fakeKv() {
  const store = new Map<string, string>()
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    },
    list: async () => ({ keys: [], list_complete: true }),
  }
}

function fakeFiles() {
  const puts = new Map<string, string>()
  return {
    puts,
    get: async () => null,
    put: async (key: string, value: ReadableStream | ArrayBuffer | string) => {
      puts.set(key, typeof value === 'string' ? value : '<binary>')
      return undefined
    },
    head: async () => null,
    delete: async () => undefined,
    list: async () => ({ objects: [], truncated: false }),
  }
}

function fakeEnv(): TaskBindings & {
  KV: ReturnType<typeof fakeKv>
  FILES: ReturnType<typeof fakeFiles>
} {
  return {
    KV: fakeKv(),
    FILES: fakeFiles(),
    TASKS: { send: async () => undefined, sendBatch: async () => undefined },
    TASK_MAX_ATTEMPTS: 3,
  }
}

interface Settled {
  acked: number
  retried: Array<number | undefined>
}

function message(body: unknown, attempts = 1): QueueMessageLike & { settled: Settled } {
  const settled: Settled = { acked: 0, retried: [] }
  return {
    id: 'msg-1',
    body,
    attempts,
    settled,
    ack: () => {
      settled.acked += 1
    },
    retry: (options) => {
      settled.retried.push(options?.delaySeconds)
    },
  }
}

function batch(messages: Array<QueueMessageLike>): QueueBatchLike {
  return { messages }
}

function emailEnvelope(overrides: Partial<TaskEnvelope> = {}): unknown {
  return {
    id: 'task-1',
    orgId: 'org-1',
    kind: 'email',
    enqueuedAt: 1_700_000_000_000,
    payload: {
      to: ['traveller@example.com'],
      subject: 'Your flight to Lisbon is tomorrow',
      html: '<p>Wheels up at 09:40.</p>',
    },
    ...overrides,
  }
}

const logger = () => createLogger({ level: 'error', sink: createMemorySink() })

describe('consumeTaskBatch', () => {
  it('runs the handler, records the idempotency marker and acks', async () => {
    const env = fakeEnv()
    const seen: Array<string> = []
    const registry: TaskHandlerRegistry = {
      email: async (payload) => {
        seen.push(payload.subject)
        return { recipients: payload.to.length }
      },
    }
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry })

    expect(seen).toEqual(['Your flight to Lisbon is tomorrow'])
    expect(msg.settled).toEqual({ acked: 1, retried: [] })
    expect(result.acked).toBe(1)
    expect(env.KV.store.has(taskDoneKey('task-1'))).toBe(true)
  })

  it('acks a redelivery without running the handler again', async () => {
    const env = fakeEnv()
    env.KV.store.set(taskDoneKey('task-1'), '{"at":1}')
    let calls = 0
    const registry: TaskHandlerRegistry = {
      email: async () => {
        calls += 1
        return {}
      },
    }
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry })

    expect(calls).toBe(0)
    expect(result.duplicates).toBe(1)
    expect(msg.settled.acked).toBe(1)
  })

  it('dead-letters an unparseable body instead of retrying it forever', async () => {
    const env = fakeEnv()
    const msg = message({ kind: 'email', payload: { to: 'not-an-array' } })

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry: {} })

    expect(result.deadLettered).toBe(1)
    expect(msg.settled).toEqual({ acked: 1, retried: [] })
    // The full body is preserved in R2 so the job can be replayed.
    expect([...env.FILES.puts.keys()].some((k) => k.startsWith('dead-letter/'))).toBe(true)
  })

  it('dead-letters a permanent failure on the first attempt', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async () => {
        throw new TaskPermanentError('EMAIL_API_KEY is not set')
      },
    }
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry })

    expect(result.deadLettered).toBe(1)
    expect(result.retried).toBe(0)
    expect(msg.settled.acked).toBe(1)
    expect(env.KV.store.has(taskDeadKey('task-1'))).toBe(true)
    // No completion marker: the work did not happen.
    expect(env.KV.store.has(taskDoneKey('task-1'))).toBe(false)
  })

  it('retries a transient failure with backoff, honouring an upstream retry-after', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async () => {
        throw new TaskRetryableError('provider rate limited', { retryAfterSeconds: 42 })
      },
    }
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry })

    expect(result.retried).toBe(1)
    expect(msg.settled.retried).toEqual([42])
    expect(msg.settled.acked).toBe(0)
  })

  it('stops retrying once TASK_MAX_ATTEMPTS is reached', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async () => {
        throw new TaskRetryableError('still failing')
      },
    }
    // TASK_MAX_ATTEMPTS is 3, so the third delivery is terminal.
    const msg = message(emailEnvelope(), 3)

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry })

    expect(result.deadLettered).toBe(1)
    expect(msg.settled).toEqual({ acked: 1, retried: [] })
  })

  it('dead-letters a kind with no registered handler rather than acking it as done', async () => {
    const env = fakeEnv()
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry: {} })

    expect(result.deadLettered).toBe(1)
    expect(env.KV.store.has(taskDoneKey('task-1'))).toBe(false)
    const dead = env.KV.store.get(taskDeadKey('task-1'))
    expect(dead).toContain('No handler is registered')
  })

  it('accepts the billing envelopes the Stripe webhook actually enqueues', async () => {
    const env = fakeEnv()
    const handled: Array<string> = []
    const registry: TaskHandlerRegistry = {
      'billing.subscription.changed': async (payload) => {
        handled.push(payload.planId)
        return {}
      },
    }
    const msg = message({
      id: 'evt_1:billing.subscription.changed',
      orgId: 'org-1',
      kind: 'billing.subscription.changed',
      enqueuedAt: 1_700_000_000_000,
      payload: {
        kind: 'billing.subscription.changed',
        organizationId: 'org-1',
        planId: 'crew',
        previousPlanId: 'free',
        status: 'active',
        stripeEventId: 'evt_1',
      },
    })

    const result = await consumeTaskBatch(batch([msg]), env, logger(), { registry })

    expect(handled).toEqual(['crew'])
    expect(result.acked).toBe(1)
    expect(result.deadLettered).toBe(0)
  })

  it('settles every message even when one of them explodes', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async (payload) => {
        if (payload.subject === 'boom') throw new TaskPermanentError('nope')
        return {}
      },
    }
    const good = message(emailEnvelope({ id: 'task-good' }))
    const bad = message(
      emailEnvelope({
        id: 'task-bad',
        payload: { to: ['a@example.com'], subject: 'boom', html: '<p>x</p>' },
      }),
    )

    const result = await consumeTaskBatch(batch([good, bad]), env, logger(), { registry })

    expect(good.settled.acked).toBe(1)
    expect(bad.settled.acked).toBe(1)
    expect(result.acked).toBe(2)
    expect(result.deadLettered).toBe(1)
  })
})
