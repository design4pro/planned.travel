/**
 * Whether a trip's legs actually connect.
 *
 * A list of legs is only a plan if each one can be caught after the last one
 * lands. This module reads a trip's legs in departure order and reports, for each
 * hand-over, how much time there is, whether that is enough for the mode being
 * caught, and whether the two ends even name the same place. It never refuses a
 * save — a traveller is allowed to record a leg they have not sorted out yet — it
 * gives the screen something honest to say.
 *
 * **Times are compared as wall clock.** The columns hold a local date and a local
 * time with no offset, so a Tokyo arrival and a Kyoto departure are compared in
 * the same frame the traveller typed them in. Cross-timezone legs are the reason
 * `departureTimezone`/`arrivalTimezone` exist on the row; until a leg carries them
 * this is the comparison that matches what a person sees on their ticket.
 */

export interface LegLike {
  readonly id: string
  readonly title: string
  readonly mode: string
  readonly departureName: string | null
  readonly departureCode: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly arrivalName: string | null
  readonly arrivalCode: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
}

/** How long before departure you must realistically be there, by mode. */
const MIN_CONNECTION_MINUTES: Record<string, number> = {
  flight: 90,
  ferry: 45,
  train: 20,
  transit: 10,
  metro: 10,
  tram: 10,
  bus: 15,
}

const DEFAULT_MIN_CONNECTION_MINUTES = 15

export function minimumConnectionMinutes(mode: string): number {
  return MIN_CONNECTION_MINUTES[mode] ?? DEFAULT_MIN_CONNECTION_MINUTES
}

/**
 * A wall-clock instant in milliseconds, or `null` when the leg has no date.
 *
 * A missing time is read as the start of the day for a departure and the end of it
 * for an arrival by the callers below, so an undated-time leg is never *wrongly*
 * flagged as impossible.
 */
function instantOf(date: string | null, time: string | null): number | null {
  if (date === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null
  }
  const clock =
    time !== null && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00'
  const parsed = Date.parse(`${date}T${clock}:00.000Z`)
  return Number.isNaN(parsed) ? null : parsed
}

export function legDepartureAt(leg: LegLike): number | null {
  return instantOf(leg.departureDate, leg.departureTime)
}

export function legArrivalAt(leg: LegLike): number | null {
  return instantOf(leg.arrivalDate, leg.arrivalTime)
}

/** Travel order: dated legs by departure, then undated ones in the order given. */
export function sortLegsByDeparture<T extends LegLike>(
  legs: ReadonlyArray<T>,
): Array<T> {
  return [...legs]
    .map((leg, index) => ({ leg, index, at: legDepartureAt(leg) }))
    .sort((left, right) => {
      if (left.at === null && right.at === null) {
        return left.index - right.index
      }
      if (left.at === null) {
        return 1
      }
      if (right.at === null) {
        return -1
      }
      return left.at === right.at
        ? left.index - right.index
        : left.at - right.at
    })
    .map((entry) => entry.leg)
}

export type ConnectionSeverity = 'ok' | 'tight' | 'impossible' | 'unknown'

export interface Connection {
  readonly fromId: string
  readonly toId: string
  /** Minutes between the previous arrival and the next departure. */
  readonly gapMinutes: number | null
  readonly severity: ConnectionSeverity
  /** One short line, suitable for a rail between two cards. */
  readonly headline: string
  /** The reason, when there is something worth explaining. */
  readonly detail: string | null
  /** True when the previous leg lands somewhere the next one does not leave from. */
  readonly placeMismatch: boolean
}

/** `205` → `3h 25m`; `40` → `40m`; `1500` → `1d 1h`. */
export function formatGap(minutes: number): string {
  const total = Math.abs(Math.round(minutes))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${mins}m`
}

/** The name a reader would use for one end of a leg. */
function endpointLabel(
  code: string | null,
  name: string | null,
): string | null {
  if (code !== null && code.length > 0) {
    return code
  }
  return name !== null && name.length > 0 ? name : null
}

/** Two endpoints are "the same place" if their code or their name matches. */
function samePlace(
  arrivalCode: string | null,
  arrivalName: string | null,
  departureCode: string | null,
  departureName: string | null,
): boolean {
  const codes =
    arrivalCode !== null &&
    departureCode !== null &&
    arrivalCode.trim().length > 0 &&
    departureCode.trim().length > 0
  if (codes) {
    return (
      arrivalCode.trim().toUpperCase() === departureCode.trim().toUpperCase()
    )
  }
  const names =
    arrivalName !== null &&
    departureName !== null &&
    arrivalName.trim().length > 0 &&
    departureName.trim().length > 0
  if (names) {
    return (
      arrivalName.trim().toLowerCase() === departureName.trim().toLowerCase()
    )
  }
  // Nothing to compare is not a mismatch — it is an unrecorded endpoint.
  return true
}

/**
 * The hand-over between every pair of consecutive legs, in travel order.
 *
 * Pass the legs already sorted (or let this sort them) — the result is one entry
 * shorter than the input, in the same order, so a renderer can interleave it
 * between the cards it describes.
 */
export function analyseConnections(
  legs: ReadonlyArray<LegLike>,
): Array<Connection> {
  const ordered = sortLegsByDeparture(legs)
  const connections: Array<Connection> = []

  for (let index = 0; index + 1 < ordered.length; index += 1) {
    // The loop bound guarantees both indices are in range.
    const from = ordered[index]
    const to = ordered[index + 1]

    const landedAt = legArrivalAt(from) ?? legDepartureAt(from)
    const leavesAt = legDepartureAt(to)
    const mismatch = !samePlace(
      from.arrivalCode,
      from.arrivalName,
      to.departureCode,
      to.departureName,
    )
    const landing = endpointLabel(from.arrivalCode, from.arrivalName)
    const boarding = endpointLabel(to.departureCode, to.departureName)

    if (landedAt === null || leavesAt === null) {
      connections.push({
        fromId: from.id,
        toId: to.id,
        gapMinutes: null,
        severity: 'unknown',
        headline: 'No times to compare',
        detail:
          'Add a date and time to both legs and this hand-over will be checked for you.',
        placeMismatch: mismatch,
      })
      continue
    }

    const gapMinutes = Math.round((leavesAt - landedAt) / 60_000)
    const required = minimumConnectionMinutes(to.mode)

    if (gapMinutes < 0) {
      connections.push({
        fromId: from.id,
        toId: to.id,
        gapMinutes,
        severity: 'impossible',
        headline: `Leaves ${formatGap(gapMinutes)} before the previous leg lands`,
        detail: `“${to.title}” departs before “${from.title}” arrives, so this pair cannot both be caught. Move one of them.`,
        placeMismatch: mismatch,
      })
      continue
    }

    if (gapMinutes < required) {
      connections.push({
        fromId: from.id,
        toId: to.id,
        gapMinutes,
        severity: 'tight',
        headline: `${formatGap(gapMinutes)} to connect`,
        detail: `A ${to.mode} usually needs about ${formatGap(required)}${
          boarding === null ? '' : ` at ${boarding}`
        }. This one is tight.`,
        placeMismatch: mismatch,
      })
      continue
    }

    connections.push({
      fromId: from.id,
      toId: to.id,
      gapMinutes,
      severity: 'ok',
      headline: `${formatGap(gapMinutes)} in between`,
      detail:
        mismatch && landing !== null && boarding !== null
          ? `Lands at ${landing} but the next leg leaves from ${boarding} — you will need to get across.`
          : null,
      placeMismatch: mismatch,
    })
  }

  return connections
}

export interface ConnectionSummary {
  readonly impossible: number
  readonly tight: number
  readonly mismatched: number
  readonly checked: number
}

/** The counts the screen puts in its header banner. */
export function summariseConnections(
  connections: ReadonlyArray<Connection>,
): ConnectionSummary {
  return {
    impossible: connections.filter((entry) => entry.severity === 'impossible')
      .length,
    tight: connections.filter((entry) => entry.severity === 'tight').length,
    mismatched: connections.filter(
      (entry) => entry.placeMismatch && entry.severity !== 'unknown',
    ).length,
    checked: connections.filter((entry) => entry.severity !== 'unknown').length,
  }
}

/**
 * Whether one leg's own times make sense. Used live in the dialog, where the
 * answer has to appear as the traveller types rather than after a round trip.
 */
export function legTimingError(leg: {
  readonly departureDate: string
  readonly departureTime: string
  readonly arrivalDate: string
  readonly arrivalTime: string
}): string | null {
  if (leg.departureDate === '' || leg.arrivalDate === '') {
    return null
  }
  const from = instantOf(
    leg.departureDate,
    leg.departureTime === '' ? '00:00' : leg.departureTime,
  )
  const to = instantOf(
    leg.arrivalDate,
    leg.arrivalTime === '' ? '23:59' : leg.arrivalTime,
  )
  if (from === null || to === null) {
    return null
  }
  return to < from ? 'This leg arrives before it departs.' : null
}
