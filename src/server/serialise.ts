/**
 * Wire-shape helpers.
 *
 * The `Date` mappers below touch no binding, session or query: they are plain
 * functions the client bundle is allowed to keep, and anything that does touch
 * one lives in `#/server/fns/context` or `#/routes/_app/-server/context`, which
 * are only ever referenced from inside a server-function handler.
 *
 * The two calendar helpers are a different kind of thing, and this file is no
 * longer where either of them is decided. "Today" is a decision rather than a
 * shape, and it has to be the *same* decision for every row a request selects —
 * a screen whose reservation rail was chosen on one day and whose countdown was
 * rendered on another is simply wrong. So both delegate to `serverToday()` in
 * `#/server/clock`, which is the one place the Worker answers what day it is,
 * and the one a development request can pin so the visual gate photographs the
 * same rows on every calendar day.
 *
 * That import is safe in exactly one way, and the way matters: every `_app`
 * route imports its loader from a sibling `-server` module, so this file is
 * reachable from the client entry, and Start's import-protection plugin refuses
 * `@tanstack/react-start/server` anywhere along that path. `serverToday()` is
 * wrapped in `createServerOnlyFn`, so the client build replaces its body and
 * drops the server import rather than carrying it — checked by the build itself,
 * which fails rather than warns. Nothing server-side leaks here; do not add an
 * import that is not held to the same standard.
 */
import { serverToday } from '#/server/clock'

/** Today in `YYYY-MM-DD`, the shape every date column in the schema uses. */
export function todayIso(): string {
  return serverToday()
}

/**
 * The calendar year date-ranged screens default to.
 *
 * Sliced off the same day rather than read from a second `new Date()`, so a
 * screen that uses both cannot straddle New Year's Eve, and so pinning the one
 * pins the other.
 */
export function currentYear(): number {
  return Number(serverToday().slice(0, 4))
}

/**
 * Server functions return plain JSON, so every `Date` crossing the wire becomes
 * an ISO string and is formatted back on the client with the viewer's locale.
 */
export function isoOf(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null
}

/** Same, for the columns the schema guarantees are present. */
export function isoOfRequired(value: Date): string {
  return value.toISOString()
}
