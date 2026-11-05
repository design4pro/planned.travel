import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { startCollector } from '../collector.mjs'

const collectors = []
afterEach(async () => {
  await Promise.all(collectors.splice(0).map((collector) => collector.close()))
})

async function collector(options) {
  const result = await startCollector({
    origin: 'http://127.0.0.1:3030',
    ...options,
  })
  collectors.push(result)
  return result
}

const id = 'a'.repeat(32)
const body = `${JSON.stringify({ event_id: id })}\n{"type":"transaction"}\nSYNTHETIC-NOT-RETAINED`

describe('discard-only navigation collector', () => {
  it('refuses a non-loopback fixture origin', async () => {
    await expect(
      startCollector({ origin: 'https://example.com' }),
    ).rejects.toThrow('loopback')
  })
  it('correlates receipt and completed response without retaining the body', async () => {
    const server = await collector()
    const response = await fetch(server.url, { method: 'POST', body })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://127.0.0.1:3030',
    )
    expect(server.records).toEqual([
      {
        id,
        sha256: createHash('sha256').update(body).digest('hex'),
        bytes: Buffer.byteLength(body),
        received: true,
        status: 204,
        finished: true,
      },
    ])
    expect(JSON.stringify(server)).not.toContain('SYNTHETIC-NOT-RETAINED')
  })

  it('refuses a collector port already owned by another listener', async () => {
    const server = await collector()
    await expect(
      startCollector({
        origin: 'http://127.0.0.1:3030',
        port: Number(new URL(server.url).port),
      }),
    ).rejects.toThrow('EADDRINUSE')
  })

  it('bounds bodies and the total request count', async () => {
    const server = await collector({ maxBytes: 100, maxRequests: 2 })
    expect(
      (await fetch(server.url, { method: 'POST', body: 'x'.repeat(101) }))
        .status,
    ).toBe(413)
    expect((await fetch(server.url, { method: 'POST', body })).status).toBe(204)
    expect((await fetch(server.url, { method: 'POST', body })).status).toBe(429)
    expect(server.records).toHaveLength(1)
  })

  it('rejects other endpoints and untrusted origins', async () => {
    const server = await collector()
    expect(
      (await fetch(server.url + 'other', { method: 'POST', body })).status,
    ).toBe(404)
    expect(
      (
        await fetch(server.url, {
          method: 'POST',
          body,
          headers: { Origin: 'https://example.com' },
        })
      ).status,
    ).toBe(403)
    expect(server.records).toEqual([])
    expect(server.rejections).toEqual([
      { status: 404, reason: 'endpoint' },
      { status: 403, reason: 'origin' },
    ])
  })

  it('exposes rate-limit responses to the native transport', async () => {
    const server = await collector({
      status: 429,
      rateLimit: '60:transaction:organization',
    })
    const response = await fetch(server.url, { method: 'POST', body })
    expect(response.status).toBe(429)
    expect(response.headers.get('x-sentry-rate-limits')).toBe(
      '60:transaction:organization',
    )
    expect(response.headers.get('access-control-expose-headers')).toContain(
      'X-Sentry-Rate-Limits',
    )
  })
})
