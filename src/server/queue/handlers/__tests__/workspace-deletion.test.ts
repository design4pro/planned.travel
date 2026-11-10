import { expect, it } from 'vitest'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { createWorkspaceDeletionHandler } from '../workspace-deletion'
import { TaskRetryableError, taskEnvelopeSchema } from '../../types'
import { consumeTaskBatch } from '../../consumer'
import { buildTaskEnvelope, taskDoneKey } from '../../jobs'
import type { TaskContext } from '../../types'

function context() {
  const sent: Array<{ body: unknown; delaySeconds?: number }> = []
  const markers = new Map<string, string>()
  const value: TaskContext = {
    env: {
      KV: {
        get: async (key) => markers.get(key) ?? null,
        put: async (key, marker) => {
          markers.set(key, marker)
        },
        delete: async () => undefined,
        list: async () => ({ keys: [], list_complete: true }),
      },
      FILES: {
        get: async () => null,
        put: async () => undefined,
        head: async () => null,
        delete: async () => undefined,
        list: async () => ({ objects: [], truncated: false }),
      },
      TASKS: {
        send: async (body, options) => {
          sent.push({ body, ...options })
        },
        sendBatch: async () => undefined,
      },
    },
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => Date.parse('2026-11-09T00:00:00Z'),
    attempt: 1,
    taskId: 'workspace-deletion:alpha:initial',
    orgId: 'untrusted-envelope-tenant',
    callProvider: (_label, send) => send(),
  }
  return { value, sent, markers }
}

it('keeps a long continuation chain alive with fresh delayed envelopes and ledger-only authority', async () => {
  const h = context()
  const selected: Array<string> = []
  const handle = createWorkspaceDeletionHandler(async (id) => {
    selected.push(id)
    return 'pending'
  })
  let current = buildTaskEnvelope(
    {
      kind: 'workspace-deletion',
      orgId: 'system',
      payload: { deletionId: 'alpha' },
      id: h.value.taskId,
    },
    h.value.now,
  )
  const ids = new Set([current.id])
  for (let hop = 0; hop < 12; hop += 1) {
    let acked = false
    const result = await consumeTaskBatch(
      {
        messages: [
          {
            id: `delivery-${hop}`,
            body: current,
            attempts: 1,
            ack: () => {
              acked = true
            },
            retry: () => {
              throw new Error('Unexpected retry')
            },
          },
        ],
      },
      h.value.env,
      h.value.logger,
      {
        registry: { 'workspace-deletion': handle },
        now: h.value.now,
      },
    )
    expect(acked).toBe(true)
    expect(result.duplicates).toBe(0)
    expect(h.markers.has(taskDoneKey(current.id))).toBe(true)
    const next = h.sent[hop]
    const envelope = taskEnvelopeSchema.parse(next.body)
    expect(next.delaySeconds).toBe(30)
    expect(envelope).toMatchObject({
      kind: 'workspace-deletion',
      orgId: 'system',
      payload: { deletionId: 'alpha' },
    })
    expect(ids.has(envelope.id)).toBe(false)
    ids.add(envelope.id)
    current = envelope
  }
  expect(selected).toEqual(Array.from({ length: 12 }, () => 'alpha'))
})

it('retries a held lease instead of acknowledging it or creating a second chain', async () => {
  const h = context()
  const handle = createWorkspaceDeletionHandler(async () => 'busy')
  await expect(handle({ deletionId: 'alpha' }, h.value)).rejects.toMatchObject({
    name: 'TaskRetryableError',
    retryAfterSeconds: 30,
  })
  expect(h.sent).toEqual([])
  const body = buildTaskEnvelope(
    {
      kind: 'workspace-deletion',
      orgId: 'system',
      id: h.value.taskId,
      payload: { deletionId: 'alpha' },
    },
    h.value.now,
  )
  const delays: Array<number | undefined> = []
  let acked = false
  const message = {
    id: 'busy-delivery',
    body,
    attempts: 1,
    ack: () => {
      acked = true
    },
    retry: (options?: { delaySeconds?: number }) => {
      delays.push(options?.delaySeconds)
    },
  }
  await consumeTaskBatch({ messages: [message] }, h.value.env, h.value.logger, {
    registry: { 'workspace-deletion': handle },
    now: h.value.now,
  })
  expect(delays).toEqual([30])
  expect(acked).toBe(false)
  expect(h.markers.has(taskDoneKey(body.id))).toBe(false)
  await consumeTaskBatch({ messages: [message] }, h.value.env, h.value.logger, {
    registry: {
      'workspace-deletion': createWorkspaceDeletionHandler(
        async () => 'terminal',
      ),
    },
    now: h.value.now,
  })
  expect(acked).toBe(true)
  expect(h.markers.has(taskDoneKey(body.id))).toBe(true)
})

it('does not continue terminal work and propagates a rejected continuation enqueue', async () => {
  const h = context()
  const terminal = createWorkspaceDeletionHandler(async () => 'terminal')
  await expect(terminal({ deletionId: 'alpha' }, h.value)).resolves.toEqual({
    outcome: 'terminal',
  })
  expect(h.sent).toEqual([])
  h.value.env.TASKS.send = async () => {
    throw new TaskRetryableError('Queue unavailable')
  }
  const advance = createWorkspaceDeletionHandler(async () => 'advanced')
  await expect(advance({ deletionId: 'alpha' }, h.value)).rejects.toThrow(
    'Queue unavailable',
  )
})
