/**
 * What `queueAuthEmail` writes to the log. The recipient address is personal data in a store nobody
 * can erase per person (Workers Observability, Sentry logs), and the logger's own rule is "never log
 * a raw email", so neither the queued line nor the queue-failed line may carry it - in any field,
 * under any name - while the line still says which kind of mail it was.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

const shared = vi.hoisted(() => ({ queueFails: false }))

vi.mock('#/server/auth/env', () => ({
  APP_NAME: 'planned.travel',
  appUrl: () => 'https://planned.test',
  taskQueue: () => ({
    send: async () => {
      if (shared.queueFails) throw new Error('the queue is unreachable')
    },
    sendBatch: async () => {
      if (shared.queueFails) throw new Error('the queue is unreachable')
    },
  }),
}))

const { queueAuthEmail } = await import('../email')

const RECIPIENT = 'traveller.person@example.test'

function lines(
  spies: ReadonlyArray<{ mock: { calls: Array<Array<unknown>> } }>,
) {
  return spies.flatMap((spy) => spy.mock.calls.map((call) => String(call[0])))
}

afterEach(() => {
  shared.queueFails = false
  vi.restoreAllMocks()
})

describe('queueAuthEmail logging', () => {
  it('logs the queued line without the recipient address', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await queueAuthEmail({
      kind: 'auth.passkey-added',
      to: RECIPIENT,
      eventId: crypto.randomUUID(),
    })

    const written = lines([info])
    expect(written).toHaveLength(1)
    expect(JSON.parse(written[0] ?? '')).toMatchObject({
      event: 'email.queued',
      kind: 'auth.passkey-added',
    })
    expect(written.join('\n')).not.toContain(RECIPIENT)
    expect(written.join('\n')).not.toContain('@')
  })

  it('logs the queue-failed line without the recipient address', async () => {
    shared.queueFails = true
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await queueAuthEmail({
      kind: 'auth.passkey-added',
      to: RECIPIENT,
      eventId: crypto.randomUUID(),
    })

    const written = lines([error])
    expect(written).toHaveLength(1)
    expect(JSON.parse(written[0] ?? '')).toMatchObject({
      event: 'email.queue_failed',
      kind: 'auth.passkey-added',
      reason: 'enqueue_failed',
    })
    expect(written.join('\n')).not.toContain(RECIPIENT)
    expect(written.join('\n')).not.toContain('@')
  })
})
