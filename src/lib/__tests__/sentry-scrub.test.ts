/**
 * The one function standing between a travel planner's requests and a third-party service.
 *
 * `sendDefaultPii: false` is set on both SDKs, but that is a request to the SDK. This is the part
 * that holds regardless of how the SDK interprets it, so it is pinned by tests rather than by a
 * comment - and it is shared by the Worker and the browser, so a regression here would leak from
 * both at once.
 */

import { describe, expect, it } from 'vitest'

import { scrubEvent, scrubOtherEvent, scrubTelemetry } from '../sentry-scrub'

describe('scrubEvent', () => {
  it('drops the headers that carry a session, whatever case they arrive in', () => {
    const scrubbed = scrubEvent({
      request: {
        headers: {
          Cookie: 'session=abc',
          AUTHORIZATION: 'Bearer token',
          'Proxy-Authorization': 'Basic nope',
          'user-agent': 'Firefox',
          'cf-ray': '9001',
        },
      },
    })

    expect(scrubbed.request.headers).toEqual({
      'user-agent': 'Firefox',
      'cf-ray': '9001',
    })
  })

  it('keeps the path and discards the query string, which is where this app puts ids', () => {
    const scrubbed = scrubEvent({
      request: {
        url: 'https://planned.travel/app/trips/42?invite=secret&q=kyoto',
        query_string: 'invite=secret&q=kyoto',
      },
    })

    expect(scrubbed.request.url).toBe('https://planned.travel/app/trips/42')
    expect(scrubbed.request.query_string).toBeUndefined()
  })

  it('discards cookies and the request body outright', () => {
    const scrubbed = scrubEvent({
      request: {
        cookies: { session: 'abc' },
        data: { email: 'someone@example.com' },
      },
    })

    expect(scrubbed.request.cookies).toBeUndefined()
    expect(scrubbed.request.data).toBeUndefined()
  })

  it('leaves an event that carries no request alone', () => {
    const event = { request: undefined }
    expect(scrubEvent(event)).toBe(event)
  })

  it('returns the event unchanged in every other respect', () => {
    const scrubbed = scrubEvent({
      request: { url: 'https://planned.travel/app', method: 'POST' },
      extra: 'kept',
    })

    expect(scrubbed.extra).toBe('kept')
    expect(scrubbed.request.method).toBe('POST')
  })
})

/**
 * `/join/<secret>` carries a credential in the path, which is the half of a URL this module keeps.
 * Each channel below is one the SDK sends separately, so each is pinned on its own.
 */
describe('join-link secret redaction', () => {
  const secret = 'Zk3-Join_Secret42'
  const joinUrl = `https://planned.travel/join/${secret}`

  it('redacts the secret in the request url and drops the referer header', () => {
    const scrubbed = scrubEvent({
      request: {
        url: joinUrl,
        headers: { Referer: joinUrl, 'user-agent': 'Firefox' },
      },
    })

    expect(scrubbed.request.url).toBe('https://planned.travel/join/[redacted]')
    expect(scrubbed.request.headers).toEqual({ 'user-agent': 'Firefox' })
  })

  it('redacts it in navigation, fetch and xhr breadcrumbs', () => {
    const breadcrumbs = [
      { category: 'navigation', data: { from: '/app', to: `/join/${secret}` } },
      { category: 'fetch', data: { url: joinUrl, method: 'POST' } },
      { category: 'xhr', data: { url: `/join/${secret}?a=1` } },
    ]

    const scrubbed = scrubTelemetry(breadcrumbs)

    expect(JSON.stringify(scrubbed)).not.toContain(secret)
    expect(scrubbed[0].data.to).toBe('/join/[redacted]')
    expect(scrubbed[1].data.method).toBe('POST')
    expect(scrubbed[2].data.url).toBe('/join/[redacted]?a=1')
  })

  it('redacts it in transaction and span names', () => {
    const scrubbed = scrubTelemetry({
      transaction: `GET /join/${secret}`,
      description: `GET ${joinUrl}`,
      spans: [{ description: `/join/${secret}` }],
    })

    expect(JSON.stringify(scrubbed)).not.toContain(secret)
    expect(scrubbed.transaction).toBe('GET /join/[redacted]')
  })

  it('redacts a malformed segment too, whatever its shape or case', () => {
    for (const odd of ['x', 'short', 'A'.repeat(200), 'not%20a%20secret']) {
      expect(scrubTelemetry(`/join/${odd}`)).toBe('/join/[redacted]')
    }
    expect(scrubTelemetry('/Join/abc')).toBe('/join/[redacted]')
    expect(scrubTelemetry('/join/abc/extra')).toBe('/join/[redacted]/extra')
  })

  it('leaves the bare prefix and similar paths alone', () => {
    for (const path of ['/join', '/join/', '/joint/abc', '/app/trips/42']) {
      expect(scrubTelemetry(path)).toBe(path)
    }
  })

  it('redacts a url-encoded join path inside redirect and callbackURL values', () => {
    const encoded = encodeURIComponent(`/join/${secret}`)

    expect(scrubTelemetry(`/login?redirect=${encoded}`)).toBe(
      '/login?redirect=%2Fjoin%2F[redacted]',
    )
    expect(
      scrubTelemetry(`/api/auth/verify-email?callbackURL=${encoded}&x=1`),
    ).toBe('/api/auth/verify-email?callbackURL=%2Fjoin%2F[redacted]&x=1')
    expect(scrubTelemetry(`?redirect=%2fJOIN%2f${secret}`)).toBe(
      '?redirect=%2Fjoin%2F[redacted]',
    )
  })

  it('redacts a path whose slashes are encoded differently', () => {
    expect(scrubTelemetry(`/join%2F${secret}`)).toBe('%2Fjoin%2F[redacted]')
    expect(scrubTelemetry(`%2Fjoin/${secret}`)).not.toContain(secret)
  })

  it('redacts it at every encoding depth', () => {
    const inner = encodeURIComponent(`/join/${secret}`)
    const nested = encodeURIComponent(`/login?redirect=${inner}`)
    const url = `/verify-email?callbackURL=${nested}`

    expect(scrubTelemetry(url)).not.toContain(secret)
    expect(
      scrubTelemetry(
        `/verify-email?callbackURL=%2Flogin%3Fredirect%3D%252Fjoin%252F${secret}`,
      ),
    ).toBe(
      '/verify-email?callbackURL=%2Flogin%3Fredirect%3D%2Fjoin%2F[redacted]',
    )
  })

  it('redacts the route parameter the tracing integration copies into span attributes', () => {
    const scrubbed = scrubTelemetry({
      data: {
        'url.path.params.token': secret,
        'url.path.parameter.token': secret,
        'params.token': secret,
        'url.path.params.tripId': 'trip-42',
      },
    })

    expect(JSON.stringify(scrubbed)).not.toContain(secret)
    expect(scrubbed.data['url.path.params.tripId']).toBe('trip-42')
  })

  it('redacts the secret in a replay event envelope and its referer', () => {
    const scrubbed = scrubEvent({
      urls: [joinUrl],
      segment_names: [`/join/${secret}`],
      request: { url: joinUrl, headers: { Referer: joinUrl } },
    })

    expect(JSON.stringify(scrubbed)).not.toContain(secret)
  })

  it('does not change what was already scrubbed', () => {
    expect(scrubTelemetry({ body: 'safe', n: 1, ok: true })).toEqual({
      body: 'safe',
      n: 1,
      ok: true,
    })
    const untouched = { request: { url: 'https://planned.travel/app' } }
    expect(scrubTelemetry(untouched)).toBe(untouched)
  })
})

describe('scrubOtherEvent', () => {
  const secret = 'Zk3-Join_Secret42'
  const url = `https://planned.travel/join/${secret}`

  it('scrubs the event types no beforeSend hook sees', () => {
    const feedback = {
      type: 'feedback',
      contexts: { feedback: { url } },
      request: { url, headers: { Referer: url } },
    }

    const scrubbed = scrubOtherEvent(feedback)

    expect(JSON.stringify(scrubbed)).not.toContain(secret)
    expect(JSON.stringify(scrubbed)).not.toContain('eferer')
  })

  it('leaves errors and transactions to their own hooks', () => {
    const error = { request: { url } }
    const transaction = { type: 'transaction', request: { url } }

    expect(scrubOtherEvent(error)).toBe(error)
    expect(scrubOtherEvent(transaction)).toBe(transaction)
  })
})
