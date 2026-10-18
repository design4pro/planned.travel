import { toAsciiDigits } from '#/lib/money'

/** The most days a traveller may set for a year; `setEntitlementInput` refuses more. */
export const ALLOWANCE_MAX_DAYS = 365

/**
 * A whole number of days typed into the allowance field, or `null` for anything else.
 *
 * The field is a text input with a numeric keyboard rather than `type="number"`, because a number
 * input discards Arabic-Indic and Persian digits before this function sees them. Those are read as
 * the digits they are; a decimal mark, a sign or a unit is not a whole number and stays `null`.
 */
export function parseAllowanceDays(text: string): number | null {
  const figure = toAsciiDigits(text).trim()
  if (!/^\d{1,3}$/.test(figure)) {
    return null
  }
  const days = Number(figure)
  return days <= ALLOWANCE_MAX_DAYS ? days : null
}
