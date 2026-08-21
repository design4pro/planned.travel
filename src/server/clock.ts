/**
 * The Worker's notion of "today".
 *
 * Every screen whose rows the server picks by date — the dashboard's
 * reservation rail, the trip index, the journal's backlog — asks a repository to
 * compare a date column against a single day. That day used to be a bare
 * `new Date()` read at each call site, which is correct in production and
 * unpinnable everywhere else: the visual gate photographs a workspace whose
 * fixture dates sit next to the calendar, so the moment the wall clock stepped
 * past one of them the Worker returned a different set of rows and a baseline
 * recorded the day before failed on content nobody had changed.
 *
 * So "today" is one decision, made here, once per request:
 *
 * - In development the caller may pin it with a request header, which is how
 *   `playwright.config.ts` holds the whole suite on the day the baselines were
 *   recorded. The pin travels on the browser context, so the SSR document and
 *   every server-function RPC that follows it agree — a page cannot render half
 *   on one day and half on another.
 * - In production there is no pin at all. The guard is `import.meta.env.DEV`,
 *   which Vite replaces with a literal `false` in the server build, so the
 *   branch, the header name and the `getRequest()` call are all constant-folded
 *   away: nothing in `dist/server` can be told what day it is.
 *
 * The fallback is unconditional and total. `getRequest()` resolves an
 * `AsyncLocalStorage` store and *throws* when there is no request in scope, and
 * three of this Worker's entry points have none — the cron trigger, the queue
 * consumer and the `TripRoom` alarm. Those must never crash over a date, so the
 * lookup is wrapped and every failure, absence or malformed value resolves to
 * the wall clock.
 *
 * `createServerOnlyFn` is load-bearing rather than decorative. `todayIso()` in
 * `src/routes/_app/-server/serialise.ts` delegates here, and that module is
 * reachable from the client entry — every `_app` route imports its loader from a
 * sibling `-server` module — so Start's import-protection plugin would refuse
 * `@tanstack/react-start/server` along that path. Wrapping the implementation is
 * the toolchain's own answer: the client build replaces the body and drops the
 * import, and a call from the browser is a loud error instead of a quietly wrong
 * date. Every real caller is inside a server-function handler, so no browser
 * ever reaches it.
 */
import { createServerOnlyFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

/**
 * A calendar day in the shape every date column in the schema stores, read off
 * the UTC clock so the answer does not depend on where the Worker ran.
 */
function wallClockToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Whether a string is a real `YYYY-MM-DD` day.
 *
 * The shape check alone would accept `2026-13-45`; round-tripping through
 * `Date` rejects it, because a UTC date built from an out-of-range month or day
 * normalises to something that no longer prints the same string. Anything else
 * — an empty header, a timestamp, a relative word — fails the pattern first.
 */
function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const at = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value
}

/**
 * Today in `YYYY-MM-DD`, as the Worker should answer it for this request.
 *
 * Use this anywhere a loader, server function or repository call needs the day
 * to compare a date column against. It never throws.
 */
export const serverToday: () => string = createServerOnlyFn((): string => {
  if (import.meta.env.DEV) {
    let header: string | null
    try {
      // `x-pt-server-today`, mirrored by `SERVER_TODAY_HEADER` in
      // `playwright.config.ts`. Namespaced so it cannot collide with a proxy
      // header, read nowhere else, and folded out of the production build with
      // the branch it sits in.
      header = getRequest().headers.get('x-pt-server-today')
    } catch {
      // No request in scope: a cron trigger, a queue consumer or a Durable
      // Object alarm. Not an error — those have no caller to be pinned by.
      header = null
    }
    if (header !== null && isCalendarDay(header)) return header
  }
  return wallClockToday()
})
