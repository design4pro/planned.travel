/**
 * An ISO-8601 instant as a day and a clock time, for the console's session list.
 *
 * The product formats *days* everywhere (`formatDate` in `#/lib/format`, on a frozen CLDR table) and
 * *times of day* out of a `HH:MM` column (`formatTime`, which slices a string). A session row is
 * neither: `ConsoleSession.createdAt` is a full instant, and two sessions started the same afternoon
 * are the case an operator is most often looking at — a list that shows both as "25 Aug 2026" is a
 * list they cannot tell apart. Passing an instant to `formatTime` is what this function replaced:
 * `'2026-08-25T14:05:00.000Z'.slice(0, 5)` is `'2026-'`, which is what the column printed until it
 * was looked at.
 *
 * **Sliced, not formatted, and stated in UTC.** `Intl.DateTimeFormat` is exactly the seam the frozen
 * month table in `#/lib/format` exists to avoid: workerd and WebKit are built against different
 * ICUs, so a server-rendered time can differ from the one hydration produces and React throws. A
 * projection's instants leave the server as `Date.prototype.toISOString()`, whose shape is fixed by
 * the language — `YYYY-MM-DDTHH:mm:ss.sssZ`, always UTC — so the clock time is the two fields at
 * offsets 11 and 14, and nothing has to be computed. It is labelled UTC because it is UTC: a
 * console read by operators in several places should not quietly mean a different hour for each of
 * them.
 *
 * Reported with this item rather than added to `#/lib/format`: an instant formatter belongs beside
 * the other two, and that file is not this item's to edit.
 */

import { formatDate } from '#/lib/format'

/** `YYYY-MM-DDTHH:mm` is the shortest prefix this can read. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** `25 Aug 2026, 14:05 UTC`, or an em dash for anything that is not an instant. */
export function formatConsoleInstant(value: string | null): string {
  if (value === null || !ISO_INSTANT.test(value)) {
    return '—'
  }
  const day = formatDate(value)
  if (day === null) {
    return '—'
  }
  return `${day}, ${value.slice(11, 16)} UTC`
}
