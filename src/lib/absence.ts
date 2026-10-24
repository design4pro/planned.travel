import { notFound } from '@tanstack/react-router'

/**
 * What a read answers when the thing asked for is not there for this reader.
 *
 * A server function cannot throw its way to the router's not-found screen: a failure crossing the
 * function boundary is redacted into an `unexpected` diagnostic with a reference, which renders the
 * "did not load" panel and a retry that can never succeed. Absence therefore travels as a result
 * carrying nothing but this flag - the same answer for another workspace's id, a nonexistent id and
 * one the reader may not open - and the route loader turns it into `notFound()` with
 * {@link requireFound}.
 */
export interface Absent {
  readonly found: false
}

export type OrAbsent<Payload> = Absent | (Payload & { readonly found: true })

export const ABSENT: Absent = { found: false }

function assertFound<Result extends { readonly found: boolean }>(
  result: Result,
): asserts result is Extract<Result, { readonly found: true }> {
  if (result.found === false) throw notFound()
}

/**
 * The route loader's half: throws the router's not-found for an {@link Absent} result and hands
 * back the payload otherwise.
 *
 * Compared against `false` rather than negated: a server that predates the flag answers a payload
 * with no `found` at all, and a tab that has the new code during a deploy must keep rendering it.
 */
export function requireFound<Result extends { readonly found: boolean }>(
  result: Result,
): Extract<Result, { readonly found: true }> {
  assertFound(result)
  return result
}
