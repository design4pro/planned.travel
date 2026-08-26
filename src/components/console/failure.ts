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

/** The fallback when a rejection carries nothing readable at all. */
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

/** The sentence a console dialog shows when its action was rejected. */
export function readConsoleFailure(cause: unknown): string {
  const raw =
    cause instanceof Error && cause.message.trim().length > 0
      ? cause.message.trim()
      : typeof cause === 'string' && cause.trim().length > 0
        ? cause.trim()
        : null

  if (raw === null) {
    return CONSOLE_ACTION_FALLBACK
  }
  // Cheap gate before the parse: a refusal sentence never starts with a bracket, and `JSON.parse`
  // on every error message would be a try/catch on the common path.
  if (!raw.startsWith('[')) {
    return raw
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw
  }

  const messages = issueMessages(parsed)
  return messages === null ? raw : messages.join(' ')
}
