/**
 * Zone-pinned time formatting.
 *
 * Two rules, and both of them exist because this app renders on a server in UTC
 * and then hydrates in a browser somewhere else:
 *
 * 1. **Never format a time in the ambient zone.** `new Intl.DateTimeFormat(...)`
 *    with no `timeZone` resolves to whatever machine it runs on, so the server
 *    writes `14:00` into the HTML, the client re-renders `23:00`, and React
 *    reports a hydration mismatch and throws the subtree away. Every formatter
 *    that reaches the DOM takes an explicit zone.
 * 2. **Prefer the trip's zone to the reader's.** A shared itinerary is discussed
 *    in the destination's wall-clock time: "dinner at 19:30" means 19:30 in
 *    Kyoto for everyone on the trip, whether they are reading it from Kyoto or
 *    from Lisbon. Formatting in the reader's local zone would show two travellers
 *    two different numbers for the same plan.
 */

/** Fallback for a trip with no zone recorded, and for a zone Intl rejects. */
export const FALLBACK_TIME_ZONE = 'UTC'

/**
 * Narrow a stored zone to one `Intl` will actually accept.
 *
 * A zone name arrives from the database, which means it can be null, stale, or
 * simply wrong — and an unknown zone makes `Intl.DateTimeFormat` throw a
 * `RangeError` rather than degrade. Validating once here keeps a bad row from
 * taking a whole route down.
 */
export function resolveTimeZone(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return FALLBACK_TIME_ZONE
  }
  const zone = value.trim()
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone })
    return zone
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

const keyFormatters = new Map<string, Intl.DateTimeFormat>()

function keyFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = keyFormatters.get(timeZone)
  if (cached !== undefined) return cached
  // `en-CA` is the one widely-available locale whose numeric date format is
  // already `YYYY-MM-DD`, so the key needs no reassembly from parts.
  const made = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  keyFormatters.set(timeZone, made)
  return made
}

/**
 * Calendar day of an instant *in a given zone*, as `YYYY-MM-DD`.
 *
 * Used to group a transcript into days. Slicing the ISO string instead would
 * group by UTC day, which puts a 09:00 Tokyo message under the previous
 * heading — the grouping and the heading have to agree on one zone.
 */
export function dayKeyIn(iso: string, timeZone: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10)
  return keyFormatter(timeZone).format(parsed)
}

/** Today's calendar day in a given zone, as `YYYY-MM-DD`. */
export function todayKeyIn(timeZone: string, now: Date = new Date()): string {
  return keyFormatter(timeZone).format(now)
}
