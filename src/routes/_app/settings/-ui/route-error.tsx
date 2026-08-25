import { ErrorPanel } from '#/components/layout/error-state'
import { shellStateOf } from '#/components/layout/session'

/**
 * The error boundary every settings route mounts, and the one thing it does
 * that `ErrorPanel` on its own does not: keep runtime English off the screen.
 *
 * `ErrorPanel` prints the thrown `Error.message` in a monospace chip so that a
 * bug report carries something useful. That is right where the message is ours.
 * It is not right here. A settings loader reads D1 through `appScope()`, so what
 * reaches this boundary is either
 *
 * - a *named* shell state — one of the two keys `shellStateOf` recognises, whose
 *   message **is** a catalogue key. `ErrorPanel` renders those as authored prose
 *   in the reader's own language and drops the diagnostic chip entirely, so they
 *   are passed straight through; or
 * - anything else, which is a driver or a runtime string: `D1_ERROR: no such
 *   table`, `Failed to fetch`, `The operation was aborted`. Those are written in
 *   the runtime's English, in no catalogue, and `docs/SPEC.md` §8.6 admits no
 *   untranslated string onto a screen — nor would a commercial product set a
 *   SQLite error in 12px mono in front of a traveller who came here to change
 *   their language. They are replaced by `undefined`, which the panel answers
 *   with the translated `shell.error.unknown`.
 *
 * Nothing is lost that a developer needs: the throw itself stays on the router's
 * match (`router.state.matches[].error`), where the devtools and any error
 * reporter read it from.
 *
 * It is one component rather than the same two lines in eight route files
 * because the rule is one rule. Seven of those files had it wrong in the same
 * way, and a fix applied seven times is a fix that will be applied six times
 * next round.
 */
export interface RouteErrorProps {
  readonly error: unknown
  /** The already-translated heading for this particular screen. */
  readonly title: string
}

export function RouteError({ error, title }: RouteErrorProps) {
  return (
    <ErrorPanel
      error={shellStateOf(error) === null ? undefined : error}
      title={title}
    />
  )
}
