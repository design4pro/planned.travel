import { describe, expect, it } from 'vitest'

import { QUEUE_BATCH_MAX, enqueueTasks } from '../jobs'
import type { EnqueueInput } from '../jobs'
import type { TaskEnvelope, TaskQueue } from '../types'

type Message = { body: unknown; delaySeconds?: number }

/**
 * A `TaskQueue` that records every `sendBatch` attempt, in the order it was made, and can be told to
 * refuse the n-th one. Each call settles on a later tick, so a producer that fires the batches
 * together (`Promise.all`) shows as overlapping `events` and as extra attempts after a refusal.
 */
function stubQueue(options: { failOnCall?: number } = {}) {
  const batches: Array<Array<Message>> = []
  const events: Array<string> = []
  let attempts = 0
  const queue: TaskQueue = {
    send: async () => {
      throw new Error('enqueueTasks must not use the single-message path')
    },
    sendBatch: async (messages) => {
      attempts += 1
      const call = attempts
      events.push(`start ${call}`)
      await Promise.resolve()
      await Promise.resolve()
      if (call === options.failOnCall) {
        events.push(`refused ${call}`)
        throw new Error('the queue refused the batch')
      }
      batches.push(messages)
      events.push(`end ${call}`)
    },
  }
  return { queue, batches, events, attempts: () => attempts }
}

const NOW = 1_700_000_000_000

/** `count` inputs whose ids and delays are all distinct, so a mis-sliced batch shows. */
function inputs(count: number): Array<EnqueueInput<'travel-stats'>> {
  return Array.from({ length: count }, (_unused, index) => ({
    kind: 'travel-stats' as const,
    orgId: 'org_a',
    id: `stats:${index}`,
    traceId: `trace_${index}`,
    payload: { userId: `user_${index}`, statYear: 2026 },
    delaySeconds: index,
  }))
}

const ids = (envelopes: ReadonlyArray<TaskEnvelope>) =>
  envelopes.map((envelope) => envelope.id)

describe('enqueueTasks', () => {
  it('holds the Cloudflare Queues ceiling of 100 messages per batch', () => {
    expect(QUEUE_BATCH_MAX).toBe(100)
  })

  it.each([
    [0, []],
    [1, [1]],
    [100, [100]],
    [101, [100, 1]],
    [250, [100, 100, 50]],
  ])('sends %i inputs as batches of %j', async (count, sizes) => {
    const { queue, batches } = stubQueue()

    const sent = await enqueueTasks(queue, inputs(count), () => NOW)

    expect(batches.map((batch) => batch.length)).toEqual(sizes)
    expect(sent).toHaveLength(count)
  })

  it('makes no sendBatch call for empty input', async () => {
    const { queue, batches } = stubQueue()

    expect(await enqueueTasks(queue, [])).toEqual([])
    expect(batches).toEqual([])
  })

  it('returns every envelope in input order and sends them in that order', async () => {
    const { queue, batches } = stubQueue()
    const expected = inputs(250).map((input) => input.id)

    const sent = await enqueueTasks(queue, inputs(250), () => NOW)

    expect(ids(sent)).toEqual(expected)
    expect(
      batches.flatMap((batch) =>
        batch.map((message) => (message.body as TaskEnvelope).id),
      ),
    ).toEqual(expected)
  })

  it('keeps each item’s delay on both sides of a batch boundary', async () => {
    const { queue, batches } = stubQueue()

    await enqueueTasks(queue, inputs(QUEUE_BATCH_MAX + 2), () => NOW)

    expect(batches[0]?.at(-1)?.delaySeconds).toBe(QUEUE_BATCH_MAX - 1)
    expect(batches[1]?.map((message) => message.delaySeconds)).toEqual([
      QUEUE_BATCH_MAX,
      QUEUE_BATCH_MAX + 1,
    ])
  })

  it('leaves delaySeconds off a message whose input had none', async () => {
    const { queue, batches } = stubQueue()
    const [first] = inputs(1)
    const { delaySeconds: _delay, ...immediate } = first!

    await enqueueTasks(queue, [immediate], () => NOW)

    expect(batches[0]?.[0]).not.toHaveProperty('delaySeconds')
  })

  it('does not change an envelope across a batch boundary', async () => {
    const { queue, batches } = stubQueue()
    const all = inputs(QUEUE_BATCH_MAX + 1)

    await enqueueTasks(queue, all, () => NOW)

    const last = batches[1]?.[0]?.body
    expect(last).toEqual({
      id: 'stats:100',
      kind: 'travel-stats',
      orgId: 'org_a',
      enqueuedAt: NOW,
      traceId: 'trace_100',
      payload: { userId: 'user_100', statYear: 2026 },
    })
    expect(batches[0]?.[0]?.body).toMatchObject({
      id: 'stats:0',
      orgId: 'org_a',
      enqueuedAt: NOW,
    })
  })

  it('keeps the orgId of each input and never sets one of its own', async () => {
    const { queue, batches } = stubQueue()
    const mixed = inputs(QUEUE_BATCH_MAX + 1).map((input, index) => ({
      ...input,
      orgId: index % 2 === 0 ? 'org_a' : 'org_b',
    }))

    await enqueueTasks(queue, mixed, () => NOW)

    expect(
      batches
        .flat()
        .map((message) => (message.body as TaskEnvelope).orgId)
        .join(),
    ).toBe(mixed.map((input) => input.orgId).join())
  })

  it('awaits each batch before it starts the next', async () => {
    const { queue, events } = stubQueue()

    await enqueueTasks(queue, inputs(250), () => NOW)

    expect(events).toEqual([
      'start 1',
      'end 1',
      'start 2',
      'end 2',
      'start 3',
      'end 3',
    ])
  })

  it('throws the first refusal and leaves the batches before it sent', async () => {
    const { queue, batches, attempts } = stubQueue({ failOnCall: 2 })

    await expect(enqueueTasks(queue, inputs(250))).rejects.toThrow(
      'the queue refused the batch',
    )

    // The first batch stays sent and the third was never attempted: two attempts, not three.
    expect(batches.map((batch) => batch.length)).toEqual([100])
    expect(attempts()).toBe(2)
  })
})
