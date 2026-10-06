/**
 * What a user may be told about a failure, and how that survives the trip to the browser.
 *
 * Two kinds of thing get thrown on the server and they deserve opposite treatment.
 *
 * A **refusal** is authored copy. `ConsoleActionError` and `AuthRequirementError` carry sentences
 * written for exactly this moment - "This account is suspended", "You may not act on another
 * administrator" - and a **validation** failure is the same in spirit: the reader typed something
 * and is owed the specific reason. Hiding those would not be caution, it would be a product that
 * refuses to say what is wrong.
 *
 * Everything else is a **diagnostic**, written for us and by accident: a D1 driver reporting a
 * failed statement quotes the SQL, a `TypeError` names an internal property. Rendering those was
 * the old behaviour of `detailOf()` in the error panel, and it put the shape of the database on
 * screen the first time a query broke.
 *
 * The distinction can only be drawn on the server, where the thrown value still has its class. By
 * the time it reaches the browser it is an `Error` with a `message` and nothing else - which is why
 * the classification travels *inside* that message, as the envelope below, rather than as a
 * property that would not survive.
 *
 * A third thing travels beside the kind: a **code**, for the one diagnostic whose cause the reader
 * is owed a way out of - a workspace that has reached its plan's quota. It is a constant, never
 * data: the literal below says "this workspace is out of room" and nothing else, so what the
 * server knows (the metric, the ceiling, the plan, the message) stays on the server. It is the
 * "message key the client resolves" route of `docs/SPEC.md` §9 rule 10, carried as a code rather
 * than as a sentence, so the kind stays `unexpected` and no English text is added to the envelope.
 *
 * `readPublicFailure` therefore fails closed: anything it does not recognise is `unexpected`, and
 * `unexpected` carries no message. A path that bypasses the middleware leaks nothing; it just loses
 * a sentence it could have shown.
 */

export type PublicFailureKind =
  /** Authored refusal copy. Safe to show verbatim. */
  | 'refusal'
  /** The reader's input was rejected, and the reason names what to change. */
  | 'validation'
  /** A diagnostic. The reader gets a generic sentence and a reference, never the text. */
  | 'unexpected'

/**
 * The codes an envelope may carry, and the only values `readPublicFailure` will hand to a screen.
 *
 * Closed on purpose: a repository error's own `code` is a maintainer's vocabulary (`NOT_FOUND`,
 * `FORBIDDEN`, `TENANT_ISOLATION`) and never crosses. A code is added here with a reader that
 * resolves it to localised copy, in the same change.
 */
export type PublicFailureCode = 'QUOTA_EXCEEDED'

export interface PublicFailure {
  readonly kind: PublicFailureKind
  /** Present only for `refusal` and `validation`. Never a raw diagnostic. */
  readonly message?: string
  /**
   * Present only for an `unexpected` failure that has a name the reader can act on. The diagnostic
   * is still withheld and still carries its `reference`; the code only says which localised
   * sentence the caller may show instead of its generic fallback.
   */
  readonly code?: PublicFailureCode
  /**
   * Correlates what the reader saw with the server's log line and its Sentry event.
   *
   * It is the whole reason the diagnostic can be withheld without leaving somebody reporting a
   * problem with nothing to quote - which is what the previous design used the raw message for.
   */
  readonly reference?: string
}

/**
 * Marks a message as an envelope rather than a diagnostic that happens to be JSON.
 *
 * Versioned because it is a wire format between two halves of one deploy, and a rolling deploy
 * briefly runs both. An unrecognised version decodes as `unexpected`, which is the safe direction.
 */
const ENVELOPE_PREFIX = 'planned-travel/failure/1 '

export function encodePublicFailure(failure: PublicFailure): string {
  return ENVELOPE_PREFIX + JSON.stringify(failure)
}

function messageOf(cause: unknown): string | null {
  if (cause instanceof Error && cause.message.length > 0) return cause.message
  if (typeof cause === 'string' && cause.length > 0) return cause
  return null
}

function isCode(value: unknown): value is PublicFailureCode {
  return value === 'QUOTA_EXCEEDED'
}

function isKind(value: unknown): value is PublicFailureKind {
  return value === 'refusal' || value === 'validation' || value === 'unexpected'
}

/**
 * Read whatever reached the browser as a failure the UI can render.
 *
 * Never throws and never returns `null`: an unreadable cause is an `unexpected` failure, which is
 * exactly how it should be shown.
 */
export function readPublicFailure(cause: unknown): PublicFailure {
  const raw = messageOf(cause)
  if (raw === null || !raw.startsWith(ENVELOPE_PREFIX)) {
    return { kind: 'unexpected' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(ENVELOPE_PREFIX.length))
  } catch {
    return { kind: 'unexpected' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { kind: 'unexpected' }
  }

  const { kind, message, code, reference } = parsed as Record<string, unknown>
  if (!isKind(kind)) {
    return { kind: 'unexpected' }
  }

  return {
    kind,
    // A message is only ever shown for the two kinds that are allowed one, whatever the envelope
    // claims - so a malformed or hostile envelope cannot talk the UI into rendering a diagnostic.
    ...(kind !== 'unexpected' &&
    typeof message === 'string' &&
    message.length > 0
      ? { message }
      : {}),
    // Honoured only for the kind that has no sentence of its own, and only as the allow-listed
    // literal: an unknown value - a newer server's code, a hostile envelope - is dropped, and the
    // caller's fallback is what the reader sees.
    ...(kind === 'unexpected' && isCode(code) ? { code } : {}),
    ...(typeof reference === 'string' && reference.length > 0
      ? { reference }
      : {}),
  }
}
