/**
 * Getting Better Auth's `Set-Cookie` headers out of an in-process call and onto our own response.
 *
 * Impersonation's *entire* effect is cookies. `auth.api.impersonateUser` expires the current session
 * cookie, its signed data companion and the remember-me marker, writes a signed `admin_session`
 * cookie holding the operator's own token, and writes the impersonated session and its marker — six
 * `Set-Cookie` values, measured against `better-auth@1.7.1` in `__tests__/console.test.ts`, and not
 * one row the caller can inspect. An in-process `auth.api` call returns data, so those headers are
 * dropped unless the call asks for them with `returnHeaders: true`; a server function that forgets
 * reports success, changes nothing, and looks like a dependency bug for an afternoon
 * (docs/ACCESS.md §2.6).
 *
 * Asking for them is only half of it. `Headers#get('set-cookie')` comma-joins every value into one
 * string, and a cookie's own `Expires=` attribute contains a comma — `Expires=Tue, 09 Sep 2025 …` —
 * so the joined value is not merely ugly, it is unparseable, and the browser drops or mangles the
 * lot. `better-auth@1.7.1` happens to clear a cookie with `Max-Age=0` rather than a date, so the
 * six values impersonation sets today carry no comma at all; that is an accident of one library's
 * attribute choice, it is measured rather than assumed in `__tests__/console.test.ts`, and it is
 * not a thing to build on. `getSetCookie()` is the accessor that keeps them separate and is the only one used here;
 * `__tests__/cookies.test.ts` drives this function through the framework's own `requestHandler()`
 * and asserts every value survives onto a real `Response` as its own entry.
 *
 * `setResponseHeader` with an array deletes the header and re-appends each item
 * (`@tanstack/start-server-core`, `request-response.js`), so it is called **once** with the complete
 * list rather than per value: two calls would silently discard the first one's work.
 */

import { setResponseHeader } from '@tanstack/react-start/server'

/**
 * Copies every `Set-Cookie` value from an `auth.api` result onto this server function's response.
 *
 * Returns how many were forwarded, which callers log: zero from a call that was supposed to swap a
 * session is the signature of the `returnHeaders` mistake, and it is worth being able to see that
 * in a log line rather than in a support report. `headers` is optional because Better Auth resolves
 * `returnHeaders: true` to `{ headers: Headers | undefined, response }` — undefined when nothing set
 * a cookie at all.
 */
export function forwardAuthCookies(headers: Headers | undefined): number {
  const cookies = headers?.getSetCookie() ?? []
  if (cookies.length === 0) {
    return 0
  }
  setResponseHeader('Set-Cookie', cookies)
  return cookies.length
}
