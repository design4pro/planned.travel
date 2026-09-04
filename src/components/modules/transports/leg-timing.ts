/**
 * How long one transport takes, from what the form holds.
 *
 * Kept beside the dialog rather than in `connections.ts` because that module
 * reasons about the *gaps between* transports; this is the transport's own duration, and the
 * dialog shows it live so a traveller can sanity-check a red-eye they have just
 * typed in.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

function instantOf(date: string, time: string): number | null {
  if (!DATE_PATTERN.test(date)) {
    return null
  }
  const clock = /^\d{2}:\d{2}/u.test(time) ? time.slice(0, 5) : '00:00'
  const parsed = Date.parse(`${date}T${clock}:00.000Z`)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Minutes from departure to arrival, or `null` when either end is not yet known
 * or the pair is the wrong way round (which the form reports as an error instead).
 */
export function transportDurationMinutes(transport: {
  readonly departureDate: string
  readonly departureTime: string
  readonly arrivalDate: string
  readonly arrivalTime: string
}): number | null {
  const from = instantOf(transport.departureDate, transport.departureTime)
  const to = instantOf(transport.arrivalDate, transport.arrivalTime)
  if (from === null || to === null || to <= from) {
    return null
  }
  return Math.round((to - from) / 60_000)
}
