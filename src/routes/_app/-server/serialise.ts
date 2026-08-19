/**
 * Wire-shape helpers.
 *
 * Deliberately free of any import from `src/server/**`: these are used by the
 * DTO mappers, which are plain functions the client bundle is allowed to keep.
 * Anything that touches a binding, a session or a query lives in `./context`,
 * which is only ever referenced from inside a server-function handler.
 */

/** Today in `YYYY-MM-DD`, the shape every date column in the schema uses. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** The calendar year date-ranged screens default to. */
export function currentYear(): number {
  return new Date().getUTCFullYear()
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
