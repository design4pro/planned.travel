/**
 * Proof that a `Set-Cookie` written the way `./cookies` writes it reaches the browser.
 *
 * This is the check the impersonation path was built on top of rather than after: impersonation's
 * entire effect is six cookies, and every plausible way of getting them wrong fails silently —
 * the server function returns a body, the screen navigates, and the session is unchanged. So the
 * mechanism is driven end to end through the framework's own `requestHandler()`, which is the same
 * wrapper `src/server/worker.ts` mounts, and the assertion is made on the finished `Response`
 * object rather than on the h3 event: the event is what the code writes to, and the `Response` is
 * what the runtime hands to the browser. Those are two different objects, and only the second one
 * is evidence.
 *
 * The second test is the one that names the trap. `Headers#get('set-cookie')` comma-joins its
 * values, and a cookie's own `Expires=` attribute contains a comma — so the joined string is not
 * merely inconvenient, it cannot be split back apart, and the impersonation swap half-applies. That
 * behaviour is asserted here so the reason `getSetCookie()` is used is visible rather than
 * traditional.
 */

import { requestHandler } from '@tanstack/react-start/server'
import { describe, expect, it } from 'vitest'

import { forwardAuthCookies } from '../cookies'

const COOKIES = [
  'planned.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  'planned.admin_session=operator.signature; Path=/; HttpOnly; SameSite=Lax',
  'planned.session_token=worn; Path=/; HttpOnly; Expires=Tue, 09 Sep 2025 10:00:00 GMT',
]

function authHeaders(): Headers {
  const headers = new Headers()
  for (const cookie of COOKIES) {
    headers.append('set-cookie', cookie)
  }
  return headers
}

/** Runs `body` inside a real request scope and returns the response the runtime produced. */
async function throughTheRuntime(body: () => void): Promise<Response> {
  const handle = requestHandler(() => {
    body()
    // A JSON body with an ok status, which is what a server function resolves to. The ok path is
    // the one worth exercising: `attachResponseHeaders` skips it and h3's own `prepareResponse` is
    // what merges the event's headers in, so a test that only drove an error response would prove
    // the wrong branch.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return handle(
    new Request('https://planned.travel/_serverFn/console', { method: 'POST' }),
    {},
  )
}

describe('forwardAuthCookies', () => {
  it('lands every Set-Cookie on the response as its own entry', async () => {
    let count = 0
    const response = await throughTheRuntime(() => {
      count = forwardAuthCookies(authHeaders())
    })

    expect(count).toBe(3)
    expect(response.headers.getSetCookie()).toEqual(COOKIES)
  })

  it('would have produced one unsplittable value through Headers#get', () => {
    // Why `getSetCookie()` is the accessor and `get()` is not used anywhere in this directory: the
    // joined string contains the commas from two `Expires=` attributes as well as the two
    // separators, so nothing downstream can recover the individual cookies from it.
    const joined = authHeaders().get('set-cookie')
    expect(joined).not.toBeNull()
    expect(joined?.split(', ').length).toBeGreaterThan(3)
  })

  it('does nothing and reports zero when the call set no cookie', async () => {
    let count = -1
    const response = await throughTheRuntime(() => {
      count = forwardAuthCookies(undefined)
    })

    expect(count).toBe(0)
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('replaces rather than appends, so one call carries the whole set', async () => {
    const response = await throughTheRuntime(() => {
      forwardAuthCookies(authHeaders())
      forwardAuthCookies(authHeaders())
    })

    // `setResponseHeader` with an array deletes the header before re-appending, which is what makes
    // "call it once with the complete list" the rule rather than a preference.
    expect(response.headers.getSetCookie()).toEqual(COOKIES)
  })
})
