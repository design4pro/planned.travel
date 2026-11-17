import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createRelayFetch, relayWorkerSource } from '../relay.mjs'

test('relay retains the real SDK response, rate limits, overflow and drain', async () => {
  const { makeFetchTransport } = await import('@sentry/react')
  const messages = []
  const relay = createRelayFetch(
    Promise.resolve({
      postMessage(message, ports) {
        messages.push({ message, port: ports[0] })
      },
    }),
  )
  const drops = []
  const transport = makeFetchTransport(
    {
      url: '/ingest',
      recordDroppedEvent: (reason, category) =>
        drops.push({ reason, category }),
    },
    relay,
  )
  const envelope = (id) => [
    { event_id: id },
    [[{ type: 'transaction' }, { type: 'transaction' }]],
  ]
  const sends = Array.from({ length: 40 }, (_, i) =>
    transport.send(envelope(String(i))),
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(messages.length, 40)
  assert.deepEqual(await transport.send(envelope('overflow')), {})
  assert.ok(drops.some((d) => d.reason === 'queue_overflow'))
  for (const { port } of messages) {
    port.postMessage({ status: 204, headers: {} })
    port.close()
  }
  const results = await Promise.all(sends)
  assert.ok(results.every((result) => result.statusCode === 204))
  const limited = transport.send(envelope('limited'))
  await new Promise((resolve) => setTimeout(resolve, 0))
  const { port } = messages.at(-1)
  port.postMessage({
    status: 429,
    headers: {
      'X-Sentry-Rate-Limits': '60:transaction:organization',
      'Retry-After': '60',
    },
  })
  port.close()
  const response = await limited
  assert.equal(response.statusCode, 429)
  assert.equal(response.headers['retry-after'], '60')
  assert.equal(
    response.headers['x-sentry-rate-limits'],
    '60:transaction:organization',
  )
  assert.deepEqual(await transport.send(envelope('backoff')), {})
  assert.ok(drops.some((d) => d.reason === 'ratelimit_backoff'))
  assert.equal(messages.length, 41)
})

test('registration, message failure and timeout reject without native fallback or false acknowledgement', async () => {
  const error = new Error('registration denied')
  await assert.rejects(
    createRelayFetch(Promise.reject(error))('/ingest', {}),
    (e) => e === error,
  )
  await assert.rejects(
    createRelayFetch(
      Promise.resolve({
        postMessage() {
          throw error
        },
      }),
    )('/ingest', {}),
    (e) => e === error,
  )
  await assert.rejects(
    createRelayFetch(Promise.resolve({ postMessage() {} }), { timeout: 10 })(
      '/ingest',
      {},
    ),
    /timeout/,
  )
  await assert.rejects(
    createRelayFetch(
      Promise.resolve({
        postMessage(_, [port]) {
          port.postMessage({ error: true })
          port.close()
        },
      }),
    )('/ingest', {}),
    /request failed/,
  )
})

test('experiment worker refuses non-owned endpoints', () => {
  assert.throws(
    () => relayWorkerSource('https://example.com/ingest'),
    /loopback/,
  )
  assert.throws(
    () => relayWorkerSource('http://127.0.0.1:3000/other'),
    /loopback/,
  )
  assert.ok(
    relayWorkerSource('http://127.0.0.1:3000/ingest').includes(
      'keepalive: false',
    ),
  )
})

test('a malformed relay message cannot turn a missing ingestion response into success', async () => {
  const fetch = createRelayFetch(
    Promise.resolve({
      postMessage(_, [port]) {
        port.postMessage({ status: 'accepted', headers: {} })
        port.close()
      },
    }),
  )
  await assert.rejects(fetch('/ingest', {}), /Invalid relay response/)
})
