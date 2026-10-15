/**
 * What a trip means as calendar events.
 *
 * Pure: {@link buildCalendar} takes an in-memory {@link FeedSource} and returns the iCalendar text,
 * with no SQL and no clock. It is the one answer to "what is in a trip's calendar", so a download
 * and a feed can never disagree.
 *
 * **The source types are the privacy projection.** Every field below is one the calendar may show;
 * a column that is not on a type was never selected (`repos/calendar-feeds.ts` names its columns)
 * and so cannot be emitted by a later edit to this file. A confirmation number, a booking code, a
 * seat, a price, a provider URL, a participant, an email and a user id are not on any of them, and
 * the workspace's name is not an input at all.
 *
 * An event exists when its own date is known. A stop or a reservation is a wall-clock time at a
 * place, and a place has no zone, so it is written floating; a leg or a transport carries its own
 * zone and is written as a UTC instant, unless a zone it needs is unusable, in which case both of
 * its ends are floating (an event never mixes the two forms).
 */
import { writeCalendar } from './ics'
import { zonedToUtc } from './zone'
import type { IcsEventInput, IcsMoment, IcsStatus } from './ics'

/* -------------------------------------------------------------------------------------------------
 * The projection
 * ---------------------------------------------------------------------------------------------- */

export interface FeedTrip {
  readonly id: string
  readonly title: string
  readonly summary: string | null
  readonly startDate: string | null
  readonly endDate: string | null
  readonly updatedAt: Date
}

export interface FeedDay {
  readonly id: string
  readonly tripId: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
  readonly updatedAt: Date
}

export interface FeedPlace {
  readonly id: string
  readonly tripId: string
  readonly name: string
  readonly address: string | null
  readonly durationMinutes: number
  readonly updatedAt: Date
}

/** A stop: a place put on a day (the `day_assignments` row). */
export interface FeedStop {
  readonly id: string
  readonly tripId: string
  readonly dayId: string
  readonly placeId: string
  readonly orderIndex: number
  readonly startTime: string | null
  readonly endTime: string | null
  readonly durationMinutes: number | null
  readonly notes: string | null
  readonly updatedAt: Date
}

export interface FeedDayNote {
  readonly id: string
  readonly tripId: string
  readonly dayId: string
  readonly body: string
  readonly detail: string | null
  readonly time: string | null
  readonly sortOrder: number
  readonly updatedAt: Date
}

export interface FeedStay {
  readonly id: string
  readonly tripId: string
  readonly startDayId: string
  readonly endDayId: string
  readonly reservationId: string | null
  readonly name: string
  readonly address: string | null
  readonly checkInTime: string | null
  readonly checkOutTime: string | null
  readonly updatedAt: Date
}

export interface FeedTransport {
  readonly id: string
  readonly tripId: string
  readonly dayId: string | null
  readonly status: string
  readonly title: string
  readonly serviceNumber: string | null
  readonly departureName: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly departureTimezone: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
  readonly arrivalTimezone: string | null
  readonly updatedAt: Date
}

export interface FeedLeg {
  readonly id: string
  readonly tripId: string
  readonly transportId: string
  readonly position: number
  readonly fromName: string
  readonly fromTimezone: string | null
  readonly toName: string
  readonly toTimezone: string | null
  readonly serviceNumber: string | null
  readonly departureDayId: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
  readonly updatedAt: Date
}

export interface FeedReservation {
  readonly id: string
  readonly tripId: string
  readonly assignmentId: string | null
  readonly transportId: string | null
  readonly status: string
  readonly title: string
  readonly location: string | null
  readonly startDate: string | null
  readonly startTime: string | null
  readonly endDate: string | null
  readonly endTime: string | null
  readonly updatedAt: Date
}

/** Everything the calendar of one or more trips is built from, read in one pass. */
export interface FeedSource {
  readonly trips: ReadonlyArray<FeedTrip>
  readonly days: ReadonlyArray<FeedDay>
  readonly places: ReadonlyArray<FeedPlace>
  readonly stops: ReadonlyArray<FeedStop>
  readonly dayNotes: ReadonlyArray<FeedDayNote>
  readonly stays: ReadonlyArray<FeedStay>
  readonly transports: ReadonlyArray<FeedTransport>
  readonly legs: ReadonlyArray<FeedLeg>
  readonly reservations: ReadonlyArray<FeedReservation>
}

export interface BuildCalendarOptions {
  /** `X-WR-CALNAME`: the trip's title for a trip, never the workspace's name. */
  readonly name: string
  /** The app's origin, so every event can link back to its trip behind the login. */
  readonly baseUrl: string
}

/* -------------------------------------------------------------------------------------------------
 * Local dates and times
 * ---------------------------------------------------------------------------------------------- */

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const DEFAULT_STOP_MINUTES = 60

interface LocalTime {
  readonly date: string
  readonly time: string
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** `YYYY-MM-DD` and `HH:MM` as the UTC millisecond the same digits would name. */
function wallClockMs(date: string, time = '00:00'): number {
  return Date.parse(`${date}T${time.slice(0, 5)}:00.000Z`)
}

function fromWallClockMs(ms: number): LocalTime {
  const at = new Date(ms)
  return {
    date: `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`,
    time: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`,
  }
}

function addDays(date: string, days: number): string {
  return fromWallClockMs(wallClockMs(date) + days * DAY_MS).date
}

function addMinutes(start: LocalTime, minutes: number): LocalTime {
  return fromWallClockMs(
    wallClockMs(start.date, start.time) + minutes * MINUTE_MS,
  )
}

/** An end at `time` on or after `start`: the next day when the clock has already passed it. */
function endAfter(
  start: LocalTime,
  endDate: string,
  endTime: string,
): LocalTime {
  const end: LocalTime = { date: endDate, time: endTime }
  return wallClockMs(end.date, end.time) < wallClockMs(start.date, start.time)
    ? { date: addDays(endDate, 1), time: endTime }
    : end
}

const floating = (at: LocalTime): IcsMoment => ({
  kind: 'floating',
  date: at.date,
  time: at.time,
})

/* -------------------------------------------------------------------------------------------------
 * Small shared rules
 * ---------------------------------------------------------------------------------------------- */

const isCancelled = (status: string): boolean => status === 'cancelled'

function statusOf(status: string): IcsStatus {
  return status === 'confirmed' || status === 'completed'
    ? 'CONFIRMED'
    : 'TENTATIVE'
}

/** The latest of several edit times: the stamp of an event built from several rows. */
function latest(...dates: ReadonlyArray<Date>): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())))
}

function groupBy<T>(
  rows: ReadonlyArray<T>,
  key: (row: T) => string | null,
): Map<string, Array<T>> {
  const groups = new Map<string, Array<T>>()
  for (const row of rows) {
    const id = key(row)
    if (id === null) {
      continue
    }
    const group = groups.get(id)
    if (group === undefined) {
      groups.set(id, [row])
    } else {
      group.push(row)
    }
  }
  return groups
}

const byId = <T extends { readonly id: string }>(
  rows: ReadonlyArray<T>,
): Map<string, T> => new Map(rows.map((row) => [row.id, row]))

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  return a > b ? 1 : 0
}

/* -------------------------------------------------------------------------------------------------
 * One trip's events
 * ---------------------------------------------------------------------------------------------- */

/** The indexes every event rule reads, built once for the whole source. */
interface Index {
  readonly days: ReadonlyMap<string, FeedDay>
  readonly places: ReadonlyMap<string, FeedPlace>
  readonly transports: ReadonlyMap<string, FeedTransport>
  readonly stopsByTrip: ReadonlyMap<string, ReadonlyArray<FeedStop>>
  readonly daysByTrip: ReadonlyMap<string, ReadonlyArray<FeedDay>>
  readonly notesByDay: ReadonlyMap<string, ReadonlyArray<FeedDayNote>>
  readonly staysByTrip: ReadonlyMap<string, ReadonlyArray<FeedStay>>
  readonly transportsByTrip: ReadonlyMap<string, ReadonlyArray<FeedTransport>>
  readonly legsByTransport: ReadonlyMap<string, ReadonlyArray<FeedLeg>>
  readonly reservationsByTrip: ReadonlyMap<
    string,
    ReadonlyArray<FeedReservation>
  >
  /** The reservations each record carries, by the id of the stop, transport or stay. */
  readonly linkedToStop: ReadonlyMap<string, ReadonlyArray<FeedReservation>>
  readonly linkedToTransport: ReadonlyMap<
    string,
    ReadonlyArray<FeedReservation>
  >
  readonly linkedToStay: ReadonlyMap<string, ReadonlyArray<FeedReservation>>
  /** Every reservation a stop, a transport or a stay carries; none of these has an event of its own. */
  readonly carried: ReadonlySet<string>
}

function indexSource(source: FeedSource): Index {
  const reservations = byId(source.reservations)
  const linkedToStop = groupBy(source.reservations, (row) => row.assignmentId)
  const linkedToTransport = groupBy(
    source.reservations,
    (row) => row.transportId,
  )
  const linkedToStay = new Map<string, Array<FeedReservation>>()
  for (const stay of source.stays) {
    const row =
      stay.reservationId === null
        ? undefined
        : reservations.get(stay.reservationId)
    if (row !== undefined) {
      linkedToStay.set(stay.id, [row])
    }
  }

  const carried = new Set<string>()
  for (const group of [linkedToStop, linkedToTransport, linkedToStay]) {
    for (const rows of group.values()) {
      for (const row of rows) {
        carried.add(row.id)
      }
    }
  }

  return {
    days: byId(source.days),
    places: byId(source.places),
    transports: byId(source.transports),
    stopsByTrip: groupBy(source.stops, (row) => row.tripId),
    daysByTrip: groupBy(source.days, (row) => row.tripId),
    notesByDay: groupBy(source.dayNotes, (row) => row.dayId),
    staysByTrip: groupBy(source.stays, (row) => row.tripId),
    transportsByTrip: groupBy(source.transports, (row) => row.tripId),
    legsByTransport: groupBy(source.legs, (row) => row.transportId),
    reservationsByTrip: groupBy(source.reservations, (row) => row.tripId),
    linkedToStop,
    linkedToTransport,
    linkedToStay,
    carried,
  }
}

/** The reservation whose date and time a record without a time of its own takes, if any. */
function adoptableFrom(
  rows: ReadonlyArray<FeedReservation> | undefined,
): FeedReservation | null {
  const candidates = (rows ?? [])
    .filter(
      (row) =>
        !isCancelled(row.status) &&
        row.startDate !== null &&
        row.startTime !== null,
    )
    .sort(
      (a, b) =>
        compareText(
          `${a.startDate}${a.startTime}`,
          `${b.startDate}${b.startTime}`,
        ) || compareText(a.id, b.id),
    )
  return candidates[0] ?? null
}

/** The `LOCAL` start of a reservation known to have a date and a time. */
function reservationStart(row: FeedReservation): LocalTime | null {
  return row.startDate === null || row.startTime === null
    ? null
    : { date: row.startDate, time: row.startTime }
}

/** A reservation's end, in the form of its start; `undefined` when it has none to give. */
function reservationEnd(row: FeedReservation): IcsMoment | undefined {
  if (row.startDate === null) {
    return undefined
  }
  if (row.startTime !== null) {
    if (row.endTime === null) {
      return undefined
    }
    return floating(
      endAfter(
        { date: row.startDate, time: row.startTime },
        row.endDate ?? row.startDate,
        row.endTime,
      ),
    )
  }
  if (row.endDate !== null && row.endDate >= row.startDate) {
    return { kind: 'date', date: addDays(row.endDate, 1) }
  }
  return undefined
}

function anyStatus(
  rows: ReadonlyArray<FeedReservation> | undefined,
): IcsStatus | undefined {
  const live = (rows ?? []).find((row) => !isCancelled(row.status))
  return live === undefined ? undefined : statusOf(live.status)
}

function stampsOf(
  rows: ReadonlyArray<{ readonly updatedAt: Date }> | undefined,
): Array<Date> {
  return (rows ?? []).map((row) => row.updatedAt)
}

/* ---------------------------------------------------------------------------------------- trip */

function tripEvent(trip: FeedTrip, url: string): IcsEventInput | null {
  if (trip.startDate === null) {
    return null
  }
  const base = {
    uid: `trip-${trip.id}@planned.travel`,
    stamp: trip.updatedAt,
    start: { kind: 'date', date: trip.startDate } satisfies IcsMoment,
    summary: trip.title,
    ...(trip.summary === null ? {} : { description: trip.summary }),
    url,
  }
  // An end before the start is a mistake in the trip, not a reason to hide it: one day, no end.
  return trip.endDate !== null && trip.endDate >= trip.startDate
    ? { ...base, end: { kind: 'date', date: addDays(trip.endDate, 1) } }
    : base
}

/* ---------------------------------------------------------------------------------------- stop */

/** A stop with its date, its time and the reservation that gave it either, if one did. */
function stopEvent(
  stop: FeedStop,
  index: Index,
  url: string,
): IcsEventInput | null {
  const place = index.places.get(stop.placeId)
  const day = index.days.get(stop.dayId)
  if (place === undefined || day === undefined) {
    return null
  }
  const linked = index.linkedToStop.get(stop.id)
  const adopted = stop.startTime === null ? adoptableFrom(linked) : null

  let start: LocalTime | null = null
  if (stop.startTime !== null && day.date !== null) {
    start = { date: day.date, time: stop.startTime }
  } else if (adopted !== null) {
    start = reservationStart(adopted)
  }
  if (start === null) {
    return null
  }

  let end: LocalTime
  if (stop.startTime !== null && stop.endTime !== null) {
    end = endAfter(start, start.date, stop.endTime)
  } else {
    const minutes =
      [stop.durationMinutes, place.durationMinutes].find(
        (value): value is number => value !== null && value > 0,
      ) ?? DEFAULT_STOP_MINUTES
    end = addMinutes(start, minutes)
  }

  const status = anyStatus(linked)
  return {
    uid: `stop-${stop.id}@planned.travel`,
    stamp: latest(stop.updatedAt, place.updatedAt, ...stampsOf(linked)),
    start: floating(start),
    end: floating(end),
    summary: place.name,
    ...(stop.notes === null ? {} : { description: stop.notes }),
    ...(place.address === null ? {} : { location: place.address }),
    url,
    ...(status === undefined ? {} : { status }),
  }
}

/** Whether a stop has an event of its own: it has a time, from itself or from a reservation. */
function hasOwnEvent(stop: FeedStop, index: Index): boolean {
  return stopEvent(stop, index, '') !== null
}

/* ----------------------------------------------------------------------------------------- day */

function dayEvent(
  day: FeedDay,
  trip: FeedTrip,
  stops: ReadonlyArray<FeedStop>,
  index: Index,
  url: string,
): IcsEventInput | null {
  if (day.date === null) {
    return null
  }
  const untimed = stops
    .filter((stop) => stop.dayId === day.id && !hasOwnEvent(stop, index))
    .sort((a, b) => a.orderIndex - b.orderIndex || compareText(a.id, b.id))
  const notes = [...(index.notesByDay.get(day.id) ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || compareText(a.id, b.id),
  )
  if (day.title === null && untimed.length === 0 && notes.length === 0) {
    return null
  }

  const lines: Array<string> = []
  const contributing: Array<{ readonly updatedAt: Date }> = [day, ...notes]
  for (const stop of untimed) {
    const place = index.places.get(stop.placeId)
    if (place !== undefined) {
      lines.push(place.name)
      contributing.push(stop, place)
    }
  }
  for (const note of notes) {
    const head = note.time === null ? note.body : `${note.time} ${note.body}`
    lines.push(note.detail === null ? head : `${head}\n${note.detail}`)
  }

  return {
    uid: `day-${day.id}@planned.travel`,
    stamp: latest(...contributing.map((row) => row.updatedAt)),
    start: { kind: 'date', date: day.date },
    summary: day.title ?? `${trip.title} · ${day.dayNumber}`,
    ...(lines.length === 0 ? {} : { description: lines.join('\n') }),
    url,
  }
}

/* ---------------------------------------------------------------------------------------- stay */

function stayEvent(
  stay: FeedStay,
  index: Index,
  url: string,
): IcsEventInput | null {
  const first = index.days.get(stay.startDayId)?.date ?? null
  if (first === null) {
    return null
  }
  const lastDate = index.days.get(stay.endDayId)?.date ?? null
  const last = lastDate !== null && lastDate > first ? lastDate : first

  const linked = index.linkedToStay.get(stay.id)
  const reserved = adoptableFrom(linked) ?? linked?.[0]
  const checkIn = stay.checkInTime ?? reserved?.startTime ?? null
  const checkOut = stay.checkOutTime ?? reserved?.endTime ?? null
  const times = [checkIn, checkOut].filter(
    (time): time is string => time !== null,
  )

  const status = anyStatus(linked)
  return {
    uid: `stay-${stay.id}@planned.travel`,
    stamp: latest(stay.updatedAt, ...stampsOf(linked)),
    start: { kind: 'date', date: first },
    end: { kind: 'date', date: addDays(last, 1) },
    summary: stay.name,
    ...(times.length === 0 ? {} : { description: times.join(' → ') }),
    ...(stay.address === null ? {} : { location: stay.address }),
    url,
    ...(status === undefined ? {} : { status }),
  }
}

/* ------------------------------------------------------------------------------------ journeys */

/** One end of a journey: a wall-clock reading and the zone it was read in. */
interface Endpoint {
  readonly local: LocalTime
  readonly zone: string | null
}

interface JourneyTimes {
  readonly start: IcsMoment
  readonly end?: IcsMoment
}

/** The farthest an arrival with no date of its own is moved past the departure's date. */
const MAX_ARRIVAL_DAYS_AFTER = 2

/**
 * The local reading of an arrival that states a time but no date. Across two zones the wall clocks
 * are not comparable (a 09:00 Tokyo departure lands at 08:00 in Lisbon the same day), so the first
 * date whose instant falls after the departure's is taken; the wall-clock roll over midnight stays
 * the answer when either zone is unusable and the event floats anyway.
 */
function guessArrival(
  from: Endpoint,
  time: string,
  zone: string | null,
): LocalTime {
  const departs =
    from.zone === null
      ? null
      : zonedToUtc(from.local.date, from.local.time, from.zone)
  if (departs === null || zone === null) {
    return endAfter(from.local, from.local.date, time)
  }
  for (let days = 0; days <= MAX_ARRIVAL_DAYS_AFTER; days++) {
    const date = addDays(from.local.date, days)
    const arrives = zonedToUtc(date, time, zone)
    if (arrives === null) {
      break
    }
    if (arrives.getTime() > departs.getTime()) {
      return { date, time }
    }
  }
  return endAfter(from.local, from.local.date, time)
}

/**
 * The start and end of a leg or a transport: UTC instants when every endpoint the event uses has a
 * usable zone, otherwise the same wall-clock readings floating at both ends. A record with a date
 * and no time is all-day on its date, with no end.
 */
function journeyTimes(
  departure: {
    readonly date: string
    readonly time: string | null
    readonly zone: string | null
  },
  arrival: {
    readonly date: string | null
    readonly time: string | null
    readonly zone: string | null
  },
): JourneyTimes {
  if (departure.time === null) {
    return { start: { kind: 'date', date: departure.date } }
  }
  const from: Endpoint = {
    local: { date: departure.date, time: departure.time },
    zone: departure.zone,
  }
  // A stated arrival date is the traveller's own; only a guessed one is moved forward.
  const to: Endpoint | null =
    arrival.time === null
      ? null
      : {
          local:
            arrival.date === null
              ? guessArrival(from, arrival.time, arrival.zone)
              : { date: arrival.date, time: arrival.time },
          zone: arrival.zone,
        }

  const instant = (endpoint: Endpoint): IcsMoment | null => {
    const at =
      endpoint.zone === null
        ? null
        : zonedToUtc(endpoint.local.date, endpoint.local.time, endpoint.zone)
    return at === null ? null : { kind: 'utc', at }
  }

  const start = instant(from)
  if (to === null) {
    if (start !== null) {
      return { start }
    }
  } else {
    const end = instant(to)
    if (start !== null && end !== null) {
      return { start, end }
    }
  }
  return {
    start: floating(from.local),
    ...(to === null ? {} : { end: floating(to.local) }),
  }
}

function transportEvents(
  trip: FeedTrip,
  index: Index,
  url: string,
): Array<IcsEventInput> {
  const events: Array<IcsEventInput> = []
  for (const transport of index.transportsByTrip.get(trip.id) ?? []) {
    if (isCancelled(transport.status)) {
      continue
    }
    const linked = index.linkedToTransport.get(transport.id)
    const legs = [...(index.legsByTransport.get(transport.id) ?? [])].sort(
      (a, b) => a.position - b.position || compareText(a.id, b.id),
    )
    const status = statusOf(transport.status)

    if (legs.length === 0) {
      const event = plainTransportEvent(transport, linked, index, url, status)
      if (event !== null) events.push(event)
      continue
    }
    legs.forEach((leg, position) => {
      const event = legEvent(
        leg,
        transport,
        position === 0 ? linked : undefined,
        index,
        url,
        status,
      )
      if (event !== null) events.push(event)
    })
  }
  return events
}

/** A reservation's time, adopted by a journey record with a date and no time of its own. */
function adoptedJourney(adopted: FeedReservation): JourneyTimes | null {
  const start = reservationStart(adopted)
  if (start === null) {
    return null
  }
  const end = reservationEnd(adopted)
  return { start: floating(start), ...(end === undefined ? {} : { end }) }
}

function plainTransportEvent(
  transport: FeedTransport,
  linked: ReadonlyArray<FeedReservation> | undefined,
  index: Index,
  url: string,
  status: IcsStatus,
): IcsEventInput | null {
  const adopted =
    transport.departureTime === null ? adoptableFrom(linked) : null
  const date =
    adopted?.startDate ??
    transport.departureDate ??
    (transport.dayId === null
      ? null
      : (index.days.get(transport.dayId)?.date ?? null))
  if (date === null) {
    return null
  }

  const times =
    (adopted === null ? null : adoptedJourney(adopted)) ??
    journeyTimes(
      {
        date,
        time: transport.departureTime,
        zone: transport.departureTimezone,
      },
      {
        date: transport.arrivalDate,
        time: transport.arrivalTime,
        zone: transport.arrivalTimezone,
      },
    )

  return {
    uid: `transport-${transport.id}@planned.travel`,
    stamp: latest(transport.updatedAt, ...stampsOf(linked)),
    ...times,
    summary: transport.title,
    ...(transport.departureName === null
      ? {}
      : { location: transport.departureName }),
    url,
    status,
  }
}

function legEvent(
  leg: FeedLeg,
  transport: FeedTransport,
  linked: ReadonlyArray<FeedReservation> | undefined,
  index: Index,
  url: string,
  status: IcsStatus,
): IcsEventInput | null {
  const adopted = leg.departureTime === null ? adoptableFrom(linked) : null
  const date =
    adopted?.startDate ??
    leg.departureDate ??
    (leg.departureDayId === null
      ? null
      : (index.days.get(leg.departureDayId)?.date ?? null))
  if (date === null) {
    return null
  }

  const times =
    (adopted === null ? null : adoptedJourney(adopted)) ??
    journeyTimes(
      { date, time: leg.departureTime, zone: leg.fromTimezone },
      { date: leg.arrivalDate, time: leg.arrivalTime, zone: leg.toTimezone },
    )

  const route = `${leg.fromName} → ${leg.toName}`
  return {
    uid: `leg-${leg.id}@planned.travel`,
    stamp: latest(
      leg.updatedAt,
      transport.updatedAt,
      ...(adopted === null ? [] : [adopted.updatedAt]),
    ),
    ...times,
    summary:
      leg.serviceNumber === null ? route : `${route} · ${leg.serviceNumber}`,
    location: leg.fromName,
    url,
    status,
  }
}

/* ---------------------------------------------------------------------------- reservations */

function reservationEvent(
  row: FeedReservation,
  url: string,
): IcsEventInput | null {
  if (isCancelled(row.status) || row.startDate === null) {
    return null
  }
  const start: IcsMoment =
    row.startTime === null
      ? { kind: 'date', date: row.startDate }
      : floating({ date: row.startDate, time: row.startTime })
  const end = reservationEnd(row)
  return {
    uid: `reservation-${row.id}@planned.travel`,
    stamp: row.updatedAt,
    start,
    ...(end === undefined ? {} : { end }),
    summary: row.title,
    ...(row.location === null ? {} : { location: row.location }),
    url,
    status: statusOf(row.status),
  }
}

/* ------------------------------------------------------------------------------------ build */

function tripEvents(
  trip: FeedTrip,
  index: Index,
  baseUrl: string,
): Array<IcsEventInput> {
  const url = `${baseUrl}/trips/${trip.id}`
  const stops = index.stopsByTrip.get(trip.id) ?? []
  const found: Array<IcsEventInput | null> = [
    tripEvent(trip, url),
    ...stops.map((stop) => stopEvent(stop, index, url)),
    ...(index.daysByTrip.get(trip.id) ?? []).map((day) =>
      dayEvent(day, trip, stops, index, url),
    ),
    ...(index.staysByTrip.get(trip.id) ?? []).map((stay) =>
      stayEvent(stay, index, url),
    ),
    ...transportEvents(trip, index, url),
    ...(index.reservationsByTrip.get(trip.id) ?? [])
      .filter((row) => !index.carried.has(row.id))
      .map((row) => reservationEvent(row, url)),
  ]
  return found.filter((event): event is IcsEventInput => event !== null)
}

/**
 * The iCalendar text for every trip in the source. Events are ordered by UID, so the same rows
 * produce the same bytes whatever order they were read in.
 */
export function buildCalendar(
  source: FeedSource,
  options: BuildCalendarOptions,
): string {
  const index = indexSource(source)
  const events = source.trips
    .flatMap((trip) => tripEvents(trip, index, options.baseUrl))
    .sort((a, b) => compareText(a.uid, b.uid))
  return writeCalendar({ name: options.name, events })
}
