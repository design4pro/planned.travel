import { ErrorPanel } from '#/components/layout/error-state'

/**
 * The error boundary every settings route mounts.
 *
 * It used to do one thing beyond supplying a heading: strip the thrown value before handing it on,
 * because `ErrorPanel` printed `Error.message` in a monospace chip and what reaches a settings
 * boundary is a driver string — `D1_ERROR: no such table`, `Failed to fetch` — written in the
 * runtime's English, in no catalogue, and not something to set in 12px mono in front of a traveller
 * who came here to change their language.
 *
 * That rule is now the panel's, and the server's: a diagnostic no longer crosses the
 * server-function boundary at all (`src/server/errors/middleware.ts`), and `ErrorPanel` shows a
 * message only when the server marked it as authored copy. So the stripping is gone, and it had to
 * go rather than merely become redundant — discarding the error also discarded the reference the
 * failure was reported under, which is the one thing a reader now has to quote.
 *
 * What remains is the heading, which is per-screen. It is one component rather than the same two
 * lines in eight route files because the rule is one rule; seven of those files had it wrong in the
 * same way once already.
 */
export interface RouteErrorProps {
  readonly error: unknown
  /** The already-translated heading for this particular screen. */
  readonly title: string
}

export function RouteError({ error, title }: RouteErrorProps) {
  return <ErrorPanel error={error} title={title} />
}
