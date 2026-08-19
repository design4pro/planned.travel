/**
 * "Not set" as a select value.
 *
 * A Radix `Select.Item` may not have an empty value — an empty string is how the
 * primitive represents *no selection at all*, so using it for a real "nobody in
 * particular" option throws at render. Every optional select in these modules
 * therefore carries this sentinel and converts at the edges.
 */

export const NOT_SET = 'none'

/** Column value (or blank) → select value. */
export function toSelectValue(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? NOT_SET : value
}

/** Select value → the empty string the server functions read as `null`. */
export function fromSelectValue(value: string): string {
  return value === NOT_SET ? '' : value
}
