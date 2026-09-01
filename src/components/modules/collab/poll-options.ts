/**
 * Whether a set of poll options can be put to a vote.
 *
 * A separate module from the dialog that renders it, and deliberately free of any
 * runtime import: this is the rule worth testing, and a test for it should not need
 * a Worker runtime behind it to resolve a binding.
 */

/**
 * The reason a set of options cannot be put to a vote, or `null` when it can.
 *
 * Blank rows are ignored rather than rejected — an empty third field is a row the
 * traveller has not filled in yet, not a mistake — but two options that say the
 * same thing are refused, because a tie between them is not a result.
 */
import type { MessageKey } from '#/lib/i18n'

export function pollOptionsError(
  options: ReadonlyArray<string>,
): MessageKey | null {
  const filled = options
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (filled.length < 2) {
    return 'modules.collab.poll.error.tooFew'
  }
  const seen = new Set(filled.map((value) => value.toLowerCase()))
  if (seen.size !== filled.length) {
    return 'modules.collab.poll.error.duplicate'
  }
  return null
}
