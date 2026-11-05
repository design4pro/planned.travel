import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { observeNativeFetch, classifyTrial } from '../fetch-lifecycle.mjs'

const pause = () => new Promise((resolve) => setTimeout(resolve, 20))
test('native receiver/options/arguments and original promise survive exactly one invocation', async () => {
  const events = [],
    failures = [],
    receiver = {}
  let calls = 0
  const body = JSON.stringify({ event_id: 'a'.repeat(32) }) + '\né🙂'
  const options = { body, keepalive: true }
  const result = { status: 204 }
  const promise = Promise.resolve(result)
  const wrapped = observeNativeFetch(
    function (...args) {
      calls++
      assert.equal(this, receiver)
      assert.equal(args[1], options)
      assert.deepEqual(args, ['/ingest', options])
      return promise
    },
    (event) => events.push(event),
    failures,
  )
  assert.equal(wrapped.call(receiver, '/ingest', options), promise)
  await pause()
  assert.equal(calls, 1)
  assert.deepEqual(failures, [])
  assert.equal(events.find((e) => e.kind === 'attempt').characters, body.length)
  assert.equal(
    events.find((e) => e.kind === 'attempt').bytes,
    Buffer.byteLength(body),
  )
  assert.equal(
    events.find((e) => e.kind === 'digest').sha256,
    createHash('sha256').update(body).digest('hex'),
  )
  assert.equal(
    events.find((e) => e.kind === 'native-response').id,
    'a'.repeat(32),
  )
  assert.ok(!JSON.stringify(events).includes('é'))
})
test('binding failure preserves exact rejected promise and error', async () => {
  const error = new TypeError('synthetic'),
    promise = Promise.reject(error),
    failures = []
  const wrapped = observeNativeFetch(
    () => promise,
    () => Promise.reject(Error('binding gone')),
    failures,
  )
  assert.equal(
    wrapped('/ingest', { body: '{"event_id":"a"}', keepalive: false }),
    promise,
  )
  await assert.rejects(promise, (e) => e === error)
  await pause()
  assert.ok(failures.includes('binding_rejected'))
})
test('classification requires identity plus digest, keeps response and terminal uncertainty separate', () => {
  const trial = {
    ids: ['a', 'b', 'c'],
    events: [
      { kind: 'attempt', id: 'a' },
      { kind: 'digest', id: 'a', sha256: '123', bytes: 12 },
      { kind: 'sdk-response', id: 'b', status: 204 },
    ],
    receipts: [{ id: 'b', sha256: '123', bytes: 12 }],
  }
  const [a, b, c] = classifyTrial(trial)
  assert.equal(a.delivery, 'no-matching-receipt-in-window')
  assert.equal(a.sdkResponse, null)
  assert.equal(b.response, 'observed')
  assert.equal(b.delivery, 'unknown')
  assert.equal(c.response, 'unknown')
  assert.equal(c.terminalDiagnostics, 'unknown-after-replacement')
  trial.receipts.push({ id: 'a', sha256: '123', bytes: 12 })
  assert.equal(classifyTrial(trial)[0].delivery, 'received')
})

test('real SDK retains response headers/backoff and buffer overflow/drain behavior', async () => {
  const { makeFetchTransport } = await import('@sentry/react')
  const envelope = (id) => [
    { event_id: id },
    [[{ type: 'transaction' }, { type: 'transaction' }]],
  ]
  const drops = [],
    failures = []
  let calls = 0,
    resolve
  const pending = new Promise((done) => {
    resolve = done
  })
  const native = observeNativeFetch(
    () => {
      calls++
      return pending
    },
    () => {},
    failures,
  )
  const transport = makeFetchTransport(
    {
      url: 'http://127.0.0.1:1/ingest',
      bufferSize: 1,
      recordDroppedEvent: (reason, category) =>
        drops.push({ reason, category }),
    },
    native,
  )
  const first = transport.send(envelope('a'))
  assert.deepEqual(await transport.send(envelope('b')), {})
  assert.deepEqual(drops, [
    { reason: 'queue_overflow', category: 'transaction' },
  ])
  assert.equal(calls, 1)
  resolve(new Response(null, { status: 204 }))
  assert.equal((await first).statusCode, 204)
  assert.equal(await transport.flush(100), true)
  assert.equal((await transport.send(envelope('c'))).statusCode, 204)
  assert.equal(calls, 2)
  const limited = makeFetchTransport(
    {
      url: 'http://127.0.0.1:1/ingest',
      recordDroppedEvent: (reason, category) =>
        drops.push({ reason, category }),
    },
    observeNativeFetch(
      () =>
        Promise.resolve(
          new Response(null, {
            status: 429,
            headers: {
              'X-Sentry-Rate-Limits': '60:transaction:organization',
              'Retry-After': '60',
            },
          }),
        ),
      () => {},
      failures,
    ),
  )
  const response = await limited.send(envelope('d'))
  assert.equal(response.statusCode, 429)
  assert.equal(response.headers['retry-after'], '60')
  assert.equal(
    response.headers['x-sentry-rate-limits'],
    '60:transaction:organization',
  )
  assert.deepEqual(await limited.send(envelope('e')), {})
  assert.deepEqual(drops.at(-1), {
    reason: 'ratelimit_backoff',
    category: 'transaction',
  })
  await pause()
  assert.deepEqual(failures, [])
})
