/**
 * What makes a workspace name readable, shared by the create dialog and the server function that
 * writes it, so a name the field lets through is never one the validator refuses (or the reverse).
 */

/**
 * A letter, a number, a symbol or a punctuation mark. `trim()` removes whitespace only, so a name
 * made of zero-width characters (U+200B, U+200D, U+FEFF) or of combining marks has no visible and
 * no accessible form and fails this.
 */
const VISIBLE_CHARACTER = /[\p{L}\p{N}\p{S}\p{P}]/u

export function hasVisibleCharacter(name: string): boolean {
  return VISIBLE_CHARACTER.test(name)
}
