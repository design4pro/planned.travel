/**
 * A rejected console action, as a sentence somebody can act on.
 *
 * Two kinds of failure reach a console dialog and they arrive in very different shapes.
 *
 * A **refusal** — `ConsoleActionError` from `src/server/fns/console/errors.ts` — is already a
 * sentence, written for exactly this moment: "This account holds more sessions than the console
 * lists in one call… Revoke all of its sessions instead." Those come through untouched.
 *
 * A **validation failure** does not. A server function's Zod validator rejects before the handler
 * runs, and what crosses the boundary is an `Error` whose `message` is `ZodError`'s own
 * `JSON.stringify(issues)` — a bracketed array of `origin`, `code`, `minimum`, `inclusive`, `path`
 * objects with the readable sentence buried inside each one. Rendered verbatim, an operator who
 * typed a short password is shown
 * `[ { "origin": "string", "code": "too_small", "minimum": 10, … } ]`, which was measured in this
 * console before this function existed. It is precisely the mistake the reference screen makes in
 * its audit table, where a `changes` payload is dumped raw into a cell and wraps mid-token — and a
 * product that does it on the one screen where somebody is being told they got something wrong is
 * worse than one that does it on a log.
 *
 * So the issues are unwrapped and their `message` fields are what the reader sees. The parse is
 * deliberately narrow: anything that is not an array of objects carrying a string `message` is left
 * exactly as it was, because inventing structure in an error nobody has read is how a real failure
 * becomes an unrecognisable one.
 */

import { readPublicFailure } from '#/lib/errors'

/**
 * The fallback when a rejection carries nothing readable at all.
 *
 * Kept as a literal *and* taken as a parameter below. A screen with a translator passes
 * `t('console.failure.fallback')`; this one is what a caller outside a component gets, and what the
 * tests read, so the function has an answer even where no locale is in scope.
 */
export const CONSOLE_ACTION_FALLBACK =
  'The action did not go through. Try again in a moment.'

function issueMessages(payload: unknown): ReadonlyArray<string> | null {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null
  }
  const messages: Array<string> = []
  for (const issue of payload) {
    if (typeof issue !== 'object' || issue === null || !('message' in issue)) {
      return null
    }
    const { message } = issue as { message: unknown }
    if (typeof message !== 'string' || message.trim().length === 0) {
      return null
    }
    if (!messages.includes(message)) {
      messages.push(message)
    }
  }
  return messages
}

/** What a console dialog shows for a rejection, and whether the server wrote it. */
export interface ConsoleFailure {
  readonly message: string
  /**
   * True only for a sentence the server wrote - an envelope `refusal` or `validation` message -
   * which is English whatever the locale (`docs/SPEC.md` §9 rule 10), so a screen marks it
   * `lang="en"`. False for the caller's translated fallback and for anything thrown on the client,
   * whose language the code cannot know.
   */
  readonly authored: boolean
}

/**
 * The sentence a console dialog shows when its action was rejected.
 *
 * Two routes reach here now. A rejection raised inside a server function arrives having already
 * been classified on the server (`src/server/errors/public.ts`) and wrapped by the redaction
 * middleware, so the envelope is read first: authored copy is shown, and a diagnostic - which no
 * longer carries its text at all - becomes the fallback rather than a SQLite error in a dialog.
 *
 * Anything thrown on the client never passes that boundary, so the original reading below is still
 * the path for those and is left exactly as it was.
 */
export function readConsoleFailureDetail(
  cause: unknown,
  fallback: string = CONSOLE_ACTION_FALLBACK,
): ConsoleFailure {
  const failure = readPublicFailure(cause)
  if (failure.kind !== 'unexpected') {
    return failure.message === undefined
      ? { message: fallback, authored: false }
      : { message: failure.message, authored: true }
  }
  if (failure.reference !== undefined) {
    return { message: fallback, authored: false }
  }

  const raw =
    cause instanceof Error && cause.message.trim().length > 0
      ? cause.message.trim()
      : typeof cause === 'string' && cause.trim().length > 0
        ? cause.trim()
        : null

  if (raw === null) {
    return { message: fallback, authored: false }
  }
  // Cheap gate before the parse: a refusal sentence never starts with a bracket, and `JSON.parse`
  // on every error message would be a try/catch on the common path.
  if (!raw.startsWith('[')) {
    return { message: raw, authored: false }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { message: raw, authored: false }
  }

  const messages = issueMessages(parsed)
  return {
    message: messages === null ? raw : messages.join(' '),
    authored: false,
  }
}

/** The sentence alone, for the screens that render it without marking its language. */
export function readConsoleFailure(
  cause: unknown,
  fallback: string = CONSOLE_ACTION_FALLBACK,
): string {
  return readConsoleFailureDetail(cause, fallback).message
}
