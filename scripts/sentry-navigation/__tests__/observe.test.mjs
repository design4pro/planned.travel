import { describe, expect, it } from 'vitest'
import { observeTransport } from '../observe.mjs'

function fixture(promise, report) {
  const hooks = new Map()
  const calls = []
  const transport = {
    send(envelope) {
      calls.push({ envelope, receiver: this })
      return promise
    },
  }
  const client = {
    _outcomes: { 'network_error:transaction': 1 },
    on: (name, callback) => hooks.set(name, callback),
    getTransport: () => transport,
  }
  const failures = observeTransport({ getClient: () => client }, report)
  return { hooks, calls, transport, failures }
}

const envelope = [
  { event_id: 'a'.repeat(32) },
  [
    [
      { type: 'transaction' },
      { type: 'transaction', extra: { synthetic: 'NOT-RETAINED' } },
    ],
  ],
]

describe('passive SDK transport observation', () => {
  it('sends exactly once with the original receiver/envelope and returns the same promise', async () => {
    const promise = Promise.resolve({ statusCode: 204 })
    const metadata = []
    const probe = fixture(promise, (value) => metadata.push(value))
    expect(probe.transport.send(envelope)).toBe(promise)
    await promise
    expect(probe.calls).toEqual([{ envelope, receiver: probe.transport }])
    expect(metadata[0]).toMatchObject({ kind: 'transport-result', status: 204 })
  })

  it('preserves rejection and handles a rejected diagnostic binding', async () => {
    const error = new TypeError('synthetic network refusal')
    const promise = Promise.reject(error)
    const probe = fixture(promise, () =>
      Promise.reject(new Error('binding unavailable')),
    )
    expect(probe.transport.send(envelope)).toBe(promise)
    await expect(promise).rejects.toBe(error)
    await Promise.resolve()
    expect(probe.failures).toEqual(['binding_rejected'])
  })

  it('retains only identifiers, types, sizes and outcome counters', () => {
    const metadata = []
    const probe = fixture(Promise.resolve({}), (value) => metadata.push(value))
    probe.hooks.get('beforeEnvelope')(envelope)
    probe.hooks.get('afterSendEvent')({ event_id: envelope[0].event_id }, {})
    expect(metadata[0]).toMatchObject({
      id: envelope[0].event_id,
      types: ['transaction'],
    })
    expect(metadata[0].serializedCharacters).toBeGreaterThan(0)
    expect(metadata[1]).toMatchObject({
      status: null,
      outcomes: { 'network_error:transaction': 1 },
    })
    expect(JSON.stringify(metadata)).not.toContain('NOT-RETAINED')
  })
})
