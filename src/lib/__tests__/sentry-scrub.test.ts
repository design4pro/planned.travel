/**
 * The one function standing between a travel planner's requests and a third-party service.
 *
 * `sendDefaultPii: false` is set on both SDKs, but that is a request to the SDK. This is the part
 * that holds regardless of how the SDK interprets it, so it is pinned by tests rather than by a
 * comment - and it is shared by the Worker and the browser, so a regression here would leak from
 * both at once.
 */

import { describe, expect, it } from 'vitest'

import { scrubEvent } from '../sentry-scrub'

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
