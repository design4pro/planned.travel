import { expect, test } from '@playwright/test'

/**
 * The CSRF boundary around server functions.
 *
 * A server function is a POST the browser makes on behalf of a signed-in reader, with the session
 * cookie attached by the browser rather than by the caller — so without an origin check, any page
 * anywhere could make that POST and write to a tenant's data. `src/start.ts` registers
 * `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })` for exactly that, and
 * a security control nothing exercises is a line somebody deletes in a refactor without a single
 * test going red.
 *
 * **Why this is in the e2e layer, which the rule in `journeys.spec.ts` says it should not be.** The
 * claim is about the Worker's request pipeline, and nothing below Playwright can reach it today:
 * `src/server/__tests__/worker.test.ts` replaces the Start handler with a stub, because it is a test
 * about a `switch`. This moves down to the workerd layer as a `SELF.fetch()` case the moment that
 * layer exists (ADR 0016, work item 2). Until then it lives here, and it is cheap: no browser is
 * launched, four HTTP requests, one project.
 *
 * `/_serverFn/probe` names no real server function on purpose. What is being asserted is *where the
 * middleware refuses*, not what any particular handler answers — so the path only has to be one the
 * middleware classifies as `serverFn`, and using a real one would tie this file to a function id
 * that means nothing to the claim. The same-origin half therefore asserts "not 403" rather than a
 * status: the difference between the two halves is the origin and nothing else, which is the whole
 * of what the middleware promises.
 */
test.describe('the CSRF boundary', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'an HTTP-level claim about the Worker: no browser is involved, so one project answers it',
  )

  test('refuses a cross-site POST to a server function', async ({
    request,
  }) => {
    const byOrigin = await request.post('/_serverFn/probe', {
      headers: { origin: 'https://evil.example' },
      failOnStatusCode: false,
    })
    expect(
      byOrigin.status(),
      'a foreign Origin must not reach a server function',
    ).toBe(403)

    // Modern engines send `Sec-Fetch-Site`, and the middleware reads it in preference to `Origin`.
    // Asserted separately because an attacker controls neither, but a proxy may strip one.
    const bySecFetchSite = await request.post('/_serverFn/probe', {
      headers: { 'sec-fetch-site': 'cross-site' },
      failOnStatusCode: false,
    })
    expect(
      bySecFetchSite.status(),
      'Sec-Fetch-Site: cross-site must not reach a server function',
    ).toBe(403)

    // Neither header at all. `allowRequestsWithoutOriginCheck` stays off, because a server function
    // always has a browser behind it, and a browser always sends one of the three.
    const bare = await request.post('/_serverFn/probe', {
      failOnStatusCode: false,
    })
    expect(
      bare.status(),
      'a request that proves no origin must not reach a server function',
    ).toBe(403)
  })

  test('lets a same-origin POST through', async ({ request, baseURL }) => {
    const response = await request.post('/_serverFn/probe', {
      headers: { origin: baseURL ?? 'http://localhost:3000' },
      failOnStatusCode: false,
    })
    expect(
      response.status(),
      'the middleware must let our own page call its own server functions',
    ).not.toBe(403)
  })

  test('leaves API routes and document navigation alone', async ({
    request,
  }) => {
    // `/api/*` is reached by callers with no browser behind them: the Polar webhook is a signed
    // cross-site POST that must keep arriving, and Better Auth enforces its own origin rule. A 403
    // here would be this middleware overreaching past `handlerType === 'serverFn'`.
    const api = await request.post('/api/auth/sign-in/email', {
      headers: { origin: 'https://evil.example' },
      data: {},
      failOnStatusCode: false,
    })
    expect(api.status(), 'the CSRF filter must not reach /api/*').not.toBe(403)

    // A cross-site link to one of our pages is the web working, not an attack.
    const document = await request.get('/login', {
      headers: { 'sec-fetch-site': 'cross-site' },
      failOnStatusCode: false,
    })
    expect(
      document.status(),
      'a cross-site link to a public page must open it',
    ).toBe(200)
  })
})
