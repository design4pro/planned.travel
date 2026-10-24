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
 * So "today" is one decision, made here, once per request (`serverNow()` below is the same decision
 * as an instant):
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
 * - The one build that knows its day is CI's e2e build (`E2E_BUILD=1`), which has
 *   the fixture day compiled in rather than accepted from a request; every other
 *   build folds that branch away too (`__E2E_SERVER_TODAY__` below).
 *
 * The fallback is unconditional and total. `getRequest()` resolves an
 * `AsyncLocalStorage` store and *throws* when there is no request in scope, and
 * three of this Worker's entry points have none — the cron trigger, the queue
 * consumer and the `TripRoom` alarm. Those must never crash over a date, so the
 * lookup is wrapped and every failure, absence or malformed value resolves to
 * the wall clock.
 *
 * `createServerOnlyFn` is load-bearing rather than decorative. `todayIso()` in
 * `src/server/serialise.ts` delegates here, and that module is
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
 * The day an `E2E_BUILD=1` bundle was compiled to believe in; the literal `undefined` in every other
 * build (`vite.config.ts`). Read through `typeof` because vitest does not load that `define`.
 */
declare const __E2E_SERVER_TODAY__: string | undefined

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
 * The day this request is pinned to, or `null` when it is not.
 *
 * The whole of the pin lives here, inside the development guard, so the production build folds the
 * header name, the `getRequest()` call and the parsing away together.
 */
function pinnedDay(): string | null {
  if (typeof __E2E_SERVER_TODAY__ === 'string') return __E2E_SERVER_TODAY__
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
  return null
}

/**
 * Today in `YYYY-MM-DD`, as the Worker should answer it for this request.
 *
 * Use this anywhere a loader, server function or repository call needs the day
 * to compare a date column against. It never throws.
 */
export const serverToday: () => string = createServerOnlyFn(
  (): string => pinnedDay() ?? wallClockToday(),
)

/**
 * The instant the Worker should treat as "now" for this request.
 *
 * For a reader that needs an instant rather than a day - the weather policy compares the expiry of
 * a cached reading against it and names the month its allowance is tallied in. It is the wall
 * clock, exactly, unless the request is pinned, and then it is midday UTC of the pinned day, the
 * same instant the demo fixture calls "now" (`SEED_ANCHOR_INSTANT`), so a pinned request and the
 * fixture it reads agree about the time as well as the day. It never throws.
 */
export const serverNow: () => Date = createServerOnlyFn((): Date => {
  const pinned = pinnedDay()
  return pinned === null ? new Date() : new Date(`${pinned}T12:00:00.000Z`)
})
