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

import type {
  QueueBatchLike,
  QueueMessageLike,
  TaskHandlerRegistry,
} from '../consumer'
import type { TaskBindings, TaskEnvelope, TaskKind } from '../types'

type BillingTaskKind = Extract<TaskKind, `billing.${string}`>

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

function message(
  body: unknown,
  attempts = 1,
): QueueMessageLike & { settled: Settled } {
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

/**
 * A Polar webhook id is a 36-character UUID, and the envelope id the billing producer
 * derives from it is `<providerEventId>:<kind>` — 67 characters for the longest kind.
 */
const PROVIDER_EVENT_ID = 'f2b1c0de-9a41-4f3c-8f2e-5b6d7c8e9a01'

function billingTaskId(kind: BillingTaskKind): string {
  return `${PROVIDER_EVENT_ID}:${kind}`
}

function billingEnvelope(
  kind: BillingTaskKind,
  payload: Record<string, unknown>,
): unknown {
  return {
    id: billingTaskId(kind),
    orgId: 'org-1',
    kind,
    enqueuedAt: 1_700_000_000_000,
    payload: {
      kind,
      organizationId: 'org-1',
      providerEventId: PROVIDER_EVENT_ID,
      ...payload,
    },
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

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry,
    })

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

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry,
    })

    expect(calls).toBe(0)
    expect(result.duplicates).toBe(1)
    expect(msg.settled.acked).toBe(1)
  })

  it('dead-letters an unparseable body instead of retrying it forever', async () => {
    const env = fakeEnv()
    const msg = message({ kind: 'email', payload: { to: 'not-an-array' } })

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry: {},
    })

    expect(result.deadLettered).toBe(1)
    expect(msg.settled).toEqual({ acked: 1, retried: [] })
    // The full body is preserved in R2 so the job can be replayed.
    expect(
      [...env.FILES.puts.keys()].some((k) => k.startsWith('dead-letter/')),
    ).toBe(true)
  })

  it('dead-letters a permanent failure on the first attempt', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async () => {
        throw new TaskPermanentError('EMAIL_API_KEY is not set')
      },
    }
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry,
    })

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
        throw new TaskRetryableError('provider rate limited', {
          retryAfterSeconds: 42,
        })
      },
    }
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry,
    })

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

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry,
    })

    expect(result.deadLettered).toBe(1)
    expect(msg.settled).toEqual({ acked: 1, retried: [] })
  })

  it('dead-letters a kind with no registered handler rather than acking it as done', async () => {
    const env = fakeEnv()
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry: {},
    })

    expect(result.deadLettered).toBe(1)
    expect(env.KV.store.has(taskDoneKey('task-1'))).toBe(false)
    const dead = env.KV.store.get(taskDeadKey('task-1'))
    expect(dead).toContain('No handler is registered')
  })

  it('accepts the billing envelopes the provider webhook actually enqueues', async () => {
    const env = fakeEnv()
    const handled: Array<string> = []
    const registry: TaskHandlerRegistry = {
      'billing.subscription.changed': async (payload) => {
        handled.push(payload.planId)
        return {}
      },
      'billing.invoice.payment_failed': async (payload) => {
        handled.push(payload.providerOrderId)
        return {}
      },
    }
    const changed = message(
      billingEnvelope('billing.subscription.changed', {
        planId: 'crew',
        previousPlanId: 'free',
        status: 'active',
      }),
    )
    const failed = message(
      billingEnvelope('billing.invoice.payment_failed', {
        providerOrderId: '7c0f0f4d-6a6f-4f7a-9b0a-2f2a4a6c1d33',
        attemptCount: 2,
        nextAttemptAt: '2026-01-04T09:00:00.000Z',
      }),
    )

    const result = await consumeTaskBatch(
      batch([changed, failed]),
      env,
      logger(),
      {
        registry,
      },
    )

    expect(handled).toEqual(['crew', '7c0f0f4d-6a6f-4f7a-9b0a-2f2a4a6c1d33'])
    expect(result.acked).toBe(2)
    expect(result.deadLettered).toBe(0)
  })

  it('derives the same envelope id when the provider redelivers the same event', async () => {
    const env = fakeEnv()
    let calls = 0
    const registry: TaskHandlerRegistry = {
      'billing.subscription.changed': async () => {
        calls += 1
        return {}
      },
    }
    const payload = {
      planId: 'crew',
      previousPlanId: 'free',
      status: 'active',
    } as const
    const first = message(
      billingEnvelope('billing.subscription.changed', payload),
    )
    const second = message(
      billingEnvelope('billing.subscription.changed', payload),
    )

    // The id is a pure function of the provider event id and the task kind, so a
    // redelivery lands on the marker the first delivery wrote instead of a fresh key.
    expect(second.body).toEqual(first.body)

    await consumeTaskBatch(batch([first]), env, logger(), { registry })
    await consumeTaskBatch(batch([second]), env, logger(), { registry })

    expect(calls).toBe(1)
    expect(first.settled.acked).toBe(1)
    expect(second.settled.acked).toBe(1)
    expect(
      env.KV.store.has(
        taskDoneKey(billingTaskId('billing.subscription.changed')),
      ),
    ).toBe(true)
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

    const result = await consumeTaskBatch(batch([good, bad]), env, logger(), {
      registry,
    })

    expect(good.settled.acked).toBe(1)
    expect(bad.settled.acked).toBe(1)
    expect(result.acked).toBe(2)
    expect(result.deadLettered).toBe(1)
  })
})

/**
 * The tests above pin *which* failures are terminal. These pin what a terminal failure
 * leaves behind, because that record is now the dead-letter signal the operator alerts on
 * (`docs/ARCHITECTURE.md` §9) and the runbook reads (`docs/DEPLOY.md` §11). The consumer
 * settles every terminal failure itself, so `planned-travel-tasks-dlq` never sees one: if
 * the KV summary or the R2 body stopped being written, a failing job would leave no trace
 * anywhere and every configured signal would still read green.
 */
describe('the dead-letter record', () => {
  const FAILED_AT = Date.parse('2026-03-14T08:30:00.000Z')
  const at = () => FAILED_AT

  function deadRecord(env: ReturnType<typeof fakeEnv>, taskId: string) {
    const summary = env.KV.store.get(taskDeadKey(taskId))
    // The R2 object is the KV summary plus a `body` holding the message as it arrived.
    const object = env.FILES.puts.get(`dead-letter/2026-03-14/${taskId}.json`)
    return {
      summary: summary === undefined ? undefined : JSON.parse(summary),
      object: object === undefined ? undefined : JSON.parse(object),
    }
  }

  it('describes a permanent failure in KV and keeps the whole body in R2', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async () => {
        throw new TaskPermanentError('EMAIL_API_KEY is not set')
      },
    }
    const msg = message(emailEnvelope())

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry,
      now: at,
    })

    const { summary, object } = deadRecord(env, 'task-1')
    expect(summary).toMatchObject({
      id: 'task-1',
      kind: 'email',
      orgId: 'org-1',
      attempts: 1,
      failedAt: '2026-03-14T08:30:00.000Z',
    })
    // The serialized error is what tells an operator which failure they are looking at.
    expect(JSON.stringify(summary.error)).toContain('EMAIL_API_KEY is not set')
    // R2 carries the payload a replay would need; KV holds only the summary.
    expect(object.body.payload.subject).toBe(
      'Your flight to Lisbon is tomorrow',
    )
    // Settled here, not routed on: the platform dead-letter queue never sees this message.
    expect(msg.settled).toEqual({ acked: 1, retried: [] })
    expect(result.deadLettered).toBe(1)
  })

  it('writes the same record once the retry budget is exhausted', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async () => {
        throw new TaskRetryableError('still failing')
      },
    }
    // fakeEnv sets TASK_MAX_ATTEMPTS to 3, so the third delivery is the terminal one.
    const msg = message(emailEnvelope(), 3)

    const result = await consumeTaskBatch(batch([msg]), env, logger(), {
      registry,
      now: at,
    })

    const { summary, object } = deadRecord(env, 'task-1')
    expect(summary).toMatchObject({ id: 'task-1', kind: 'email', attempts: 3 })
    expect(object.body.payload.subject).toBe(
      'Your flight to Lisbon is tomorrow',
    )
    expect(msg.settled).toEqual({ acked: 1, retried: [] })
    expect(result.deadLettered).toBe(1)
  })

  it('counts every terminal path in deadLettered and leaves nothing unsettled', async () => {
    const env = fakeEnv()
    const registry: TaskHandlerRegistry = {
      email: async (payload) => {
        if (payload.subject === 'boom') throw new TaskPermanentError('nope')
        throw new TaskRetryableError('still failing')
      },
    }
    const unparseable = message({
      kind: 'email',
      payload: { to: 'not-an-array' },
    })
    const permanent = message(
      emailEnvelope({
        id: 'task-permanent',
        payload: { to: ['a@example.com'], subject: 'boom', html: '<p>x</p>' },
      }),
    )
    const exhausted = message(emailEnvelope({ id: 'task-exhausted' }), 3)

    const result = await consumeTaskBatch(
      batch([unparseable, permanent, exhausted]),
      env,
      logger(),
      { registry, now: at },
    )

    expect(result.deadLettered).toBe(3)
    expect(result.acked).toBe(3)
    expect(result.retried).toBe(0)
    for (const msg of [unparseable, permanent, exhausted]) {
      expect(msg.settled).toEqual({ acked: 1, retried: [] })
    }
    // Every terminal path writes both halves of the record, not just the KV summary the
    // runbook lists first. An unparseable body has no envelope, so it is keyed by the
    // message id and its kind is unknown.
    expect(deadRecord(env, 'msg-1')).toMatchObject({
      summary: { kind: 'unknown', orgId: 'unknown' },
      object: { body: { payload: { to: 'not-an-array' } } },
    })
    expect(deadRecord(env, 'task-permanent')).toMatchObject({
      summary: { kind: 'email', attempts: 1 },
      object: { body: { payload: { subject: 'boom' } } },
    })
    expect(deadRecord(env, 'task-exhausted')).toMatchObject({
      summary: { kind: 'email', attempts: 3 },
      object: { body: { id: 'task-exhausted' } },
    })
  })
})
