/**
 * The Start instance, and the only two things registered globally.
 *
 * `functionMiddleware` runs ahead of every server function's own middleware and of its input
 * validator, so registering the redaction boundary here covers every `createServerFn` call site
 * at once - including the Zod rejections that fire before a handler is entered. Doing it per call
 * site would make "a diagnostic never reaches the browser" a thing every call site has to keep being
 * true, which is exactly the shape of rule that stops being true.
 *
 * `requestMiddleware` carries the CSRF check, and the same argument applies twice over: a
 * per-call-site guard is a rule every call site has to keep, and the one place that forgets is the
 * vulnerability.
 */

import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

import { failureRedactionMiddleware } from '#/server/errors/middleware'

/**
 * Server functions are same-origin RPC endpoints, and nothing else is.
 *
 * A server function is a POST the browser makes on behalf of a signed-in reader, with the session
 * cookie attached by the browser rather than by the caller. Without this, any page anywhere could
 * make that POST - `SameSite` on the session cookie is the only thing that was standing between a
 * cross-site form and a write to a tenant's data, and `SameSite=Lax` does not cover a POST issued
 * by script. TanStack Start says so itself, once per dev-server process, in the console: the
 * warning is what put this here.
 *
 * `handlerType === 'serverFn'` is the whole scope, and the narrowness is deliberate. The other
 * handler type is `router`, which is document navigation - a cross-site link to one of our pages is
 * the web working, not an attack. And it leaves every `/api/*` route alone, which matters: those
 * are reached by callers with no browser behind them and no `Origin` to send. Better Auth's own
 * endpoints enforce their origin check themselves (`rateLimit.customRules` and the `origin` header
 * Better Auth requires on state-changing requests), the Polar webhook is a signed cross-site POST
 * that must keep arriving, and `/api/tiles/*` is read by MapLibre from inside our own page.
 *
 * The defaults do the work from there: `Sec-Fetch-Site: same-origin` when the engine sends it,
 * `Origin` matched against the request's own origin when it does not, `Referer` as the last
 * fallback, and a 403 when none of the three is satisfied. A request carrying none of the three
 * is refused rather than waved through (`allowRequestsWithoutOriginCheck` stays off), because a
 * server function always has a browser behind it.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  functionMiddleware: [failureRedactionMiddleware],
  requestMiddleware: [csrfMiddleware],
}))
