/**
 * The time-sortable identifier, declared once for the server and the browser.
 *
 * Pure on purpose: no Drizzle, no Worker binding and nothing from `src/server`, so a component that
 * mints a row's id before the server has seen it (the Transport dialog) can import it without
 * pulling the schema module into the browser bundle. The server's `newId()` delegates here and
 * keeps the fixture override; a second copy of this shape would be the riskier option.
 */

import { nanoid } from 'nanoid'

export const ID_RANDOM_LENGTH = 16
export const ID_TIME_LENGTH = 9

/**
 * The exact shape {@link mintId} produces, anchored. The one declaration of it: a server path that
 * accepts an id a client minted checks it against this, and builds no second pattern of its own.
 * The time prefix is lower-case base 36 and the tail is the `nanoid` alphabet.
 */
export const ID_PATTERN = new RegExp(
  `^[0-9a-z]{${ID_TIME_LENGTH}}[A-Za-z0-9_-]{${ID_RANDOM_LENGTH}}$`,
)

/**
 * Time-sortable, URL-safe, 25 character identifier: a base-36 millisecond timestamp followed by
 * 16 random characters. Sorting by `id` is therefore sorting by creation time - but only to the
 * millisecond: ids minted in the same millisecond order by their random tail (#462, #472).
 *
 * The prefix is the clock of whoever mints the id, which in the browser is the client's.
 */
export function mintId(): string {
  return `${Date.now().toString(36).padStart(ID_TIME_LENGTH, '0')}${nanoid(ID_RANDOM_LENGTH)}`
}
