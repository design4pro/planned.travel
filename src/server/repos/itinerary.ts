/**
 * The itinerary: which place is visited on which day, in what order, by whom, and where the trip
 * sleeps.
 *
 * `days` owns the spine (see `./days`), `places` owns the inventory (see `./places`), and this module
 * owns the join between them. {@link getTripItinerary} is the planner screen's read of that join:
 * one query per table, assembled in memory, ordered day number then position — never N+1 per day.
 * The screen's day notes are not part of it; `loadDayNotes` reads those.
 */

import { and, asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  RESERVATION_STATUSES,
  TRANSPORT_MODES,
  assignmentParticipants,
  dayAccommodations,
  dayAssignments,
  dayNotes,
  newId,
  places,
} from '#/server/db/schema'
import {
  createTenantRepository,
  createTenantTableAccess,
  prepareTenantInsert,
  tenantFilter,
} from './base'
import { runBatch } from './batch'
import { NotFoundError } from './context'
import {
  DAY_RUN_ANCHORS_MESSAGE,
  DAY_RUN_MAX_ITEMS,
  byDayRun,
  dayRunItemInput,
  dayRunKey,
  departingJourneys,
  isAnchor,
  journeyPositionStatements,
  placeJourneys,
  resolveDayRun,
  withinAnchorBound,
} from './day-journeys'
import {
  listDayNotes,
  listTripDayNotes,
  listTripDays,
  requireTripDay,
} from './days'
import { placesRepository, requirePlaceOfTrip } from './places'
import { requireReservationOfTrip } from './reservations'
import {
  TRIP_WRITE_ROLES,
  assertTripRole,
  requireTrip,
  requireWritableTrip,
  tripMemberUserIds,
} from './trips'
import {
  currencySchema,
  definedOnly,
  idSchema,
  longTextSchema,
  minorAmountSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  timeSchema,
  titleSchema,
} from './validation'
import type {
  Day,
  DayAccommodation,
  DayAssignment,
  Place,
} from '#/server/db/types'
import type { BatchStatement } from './batch'
import type { DayRunEntry, DayRunItemInput } from './day-journeys'
import type { TenantScope } from './base'

export const dayAssignmentsRepository = createTenantRepository(
  dayAssignments,
  'day assignment',
)
export const assignmentParticipantsAccess = createTenantTableAccess(
  assignmentParticipants,
  'assignment participant',
)
export const dayAccommodationsRepository = createTenantRepository(
  dayAccommodations,
  'accommodation',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const assignmentFields = {
  orderIndex: sortOrderSchema.optional(),
  startTime: timeSchema.nullish(),
  endTime: timeSchema.nullish(),
  durationMinutes: nonNegativeIntSchema.max(10_080).nullish(),
  transportMode: z.enum(TRANSPORT_MODES).nullish(),
  notes: longTextSchema.nullish(),
  reservationStatus: z.enum(RESERVATION_STATUSES).optional(),
}

export const createAssignmentInput = z.object({
  tripId: idSchema,
  dayId: idSchema,
  placeId: idSchema,
  ...assignmentFields,
})
export type CreateAssignmentInput = z.infer<typeof createAssignmentInput>

export const updateAssignmentInput = z.object(assignmentFields)
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentInput>

export const reorderAssignmentsInput = z
  .array(z.object({ assignmentId: idSchema, orderIndex: sortOrderSchema }))
  .min(1)
  .max(200)
export type ReorderAssignmentsInput = z.infer<typeof reorderAssignmentsInput>

/**
 * One row of a day's sequence: which table it lives in, and which row.
 *
 * The kind is carried rather than inferred from the id, because the two tables mint
 * ids from the same generator and a lookup that guessed would eventually guess
 * wrong. `03-…`'s transport rows join this union as a third value and change nothing
 * else here.
 */
export const timelineItemInput = z.object({
  kind: z.enum(['stop', 'note']),
  id: idSchema,
})
export type TimelineItemInput = z.infer<typeof timelineItemInput>

/** The most days one drag can touch: the day a row leaves and the day it lands on, with room to spare. */
const MAX_DAYS_PER_MOVE = 4

/**
 * One day of a drag: the whole sequence the day should end up with.
 *
 * `items` is the day's whole run: stops and notes, and the journeys that depart from it (a
 * `transport` record, or one `leg` of a chained journey). A journey is placed against the
 * numbering this same write gives the stops and notes, so it never needs a call of its own; a
 * caller that does not know about journeys sends none, and each is put back where it was.
 */
export const dayTimelineInput = z.object({
  dayId: idSchema,
  items: z
    .array(dayRunItemInput)
    .max(DAY_RUN_MAX_ITEMS)
    .refine(withinAnchorBound, { error: DAY_RUN_ANCHORS_MESSAGE }),
  /**
   * Rows whose time is dropped as part of this move (PRD #104 decision 9). Every
   * entry must also be in `items`: clearing a time is a consequence of a move, never
   * a write of its own.
   */
  clearTime: z.array(timelineItemInput).max(200).optional(),
})
export type DayTimelineInput = z.infer<typeof dayTimelineInput>

export const reorderDayTimelinesInput = z.object({
  tripId: idSchema,
  days: z
    .array(dayTimelineInput)
    .min(1)
    .max(MAX_DAYS_PER_MOVE)
    .refine(
      (days) => new Set(days.map((day) => day.dayId)).size === days.length,
      { error: 'A day is named once per move.' },
    ),
})
export type ReorderDayTimelinesInput = z.infer<typeof reorderDayTimelinesInput>

/**
 * A day's sequence as written: what the caller mirrors to the trip room.
 *
 * The stops and notes under `items`, the journeys placed beside them under `journeys` — two
 * fields because the room keeps two halves of one day and neither should overwrite the other's
 * news.
 */
export interface WrittenDayTimeline {
  readonly dayId: string
  readonly items: ReadonlyArray<TimelineItemInput>
  readonly journeys: ReadonlyArray<DayRunItemInput>
}

/**
 * The day's whole resulting run, as a write that adds or removes a stop may send it.
 *
 * Only the journeys' place in it matters: the server places each against the stops and notes as
 * the write leaves them, so a client can never inject a position of its own choosing. Bounded
 * as a reorder's day is.
 */
export const dayRunInput = z
  .array(dayRunItemInput)
  .max(DAY_RUN_MAX_ITEMS)
  .refine(withinAnchorBound, { error: DAY_RUN_ANCHORS_MESSAGE })

/**
 * Gives a place to a day at a stored position, and the day's journeys theirs.
 *
 * `items` is the day's resulting run, and names the stop being created by its **place id**, because
 * its assignment id does not exist until this write mints it. A caller that sends none leaves each
 * journey where the stored numbering already puts it.
 */
export const scheduleAssignmentInput = z.object({
  tripId: idSchema,
  dayId: idSchema,
  placeId: idSchema,
  orderIndex: sortOrderSchema,
  items: dayRunInput.optional(),
})
export type ScheduleAssignmentInput = z.infer<typeof scheduleAssignmentInput>

export const unscheduleAssignmentInput = z.object({
  tripId: idSchema,
  assignmentId: idSchema,
})
export type UnscheduleAssignmentInput = z.infer<
  typeof unscheduleAssignmentInput
>

export const deletePlaceWithJourneysInput = z.object({
  tripId: idSchema,
  placeId: idSchema,
})
export type DeletePlaceWithJourneysInput = z.infer<
  typeof deletePlaceWithJourneysInput
>

/** The journeys one write placed on a day: what the caller mirrors to the trip room. */
export interface WrittenDayJourneys {
  readonly dayId: string
  readonly journeys: ReadonlyArray<DayRunItemInput>
}

export const createAccommodationInput = z.object({
  tripId: idSchema,
  startDayId: idSchema,
  endDayId: idSchema,
  placeId: idSchema.nullish(),
  name: titleSchema,
  address: shortTextSchema.nullish(),
  checkInTime: timeSchema.nullish(),
  checkInEndTime: timeSchema.nullish(),
  checkOutTime: timeSchema.nullish(),
  confirmationNumber: shortTextSchema.nullish(),
  priceMinor: minorAmountSchema.nullish(),
  currency: currencySchema.nullish(),
  notes: longTextSchema.nullish(),
  reservationId: idSchema.nullish(),
})
export type CreateAccommodationInput = z.infer<typeof createAccommodationInput>

export const updateAccommodationInput = z.object({
  startDayId: idSchema.optional(),
  endDayId: idSchema.optional(),
  placeId: idSchema.nullish(),
  name: titleSchema.optional(),
  address: shortTextSchema.nullish(),
  checkInTime: timeSchema.nullish(),
  checkInEndTime: timeSchema.nullish(),
  checkOutTime: timeSchema.nullish(),
  confirmationNumber: shortTextSchema.nullish(),
  priceMinor: minorAmountSchema.nullish(),
  currency: currencySchema.nullish(),
  notes: longTextSchema.nullish(),
  reservationId: idSchema.nullish(),
})
export type UpdateAccommodationInput = z.infer<typeof updateAccommodationInput>

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

export async function listDayAssignments(
  scope: TenantScope,
  dayId: string,
): Promise<Array<DayAssignment>> {
  return dayAssignmentsRepository.findMany(scope, {
    where: eq(dayAssignments.dayId, dayId),
    orderBy: [asc(dayAssignments.orderIndex), asc(dayAssignments.id)],
  })
}

export async function listTripAssignments(
  scope: TenantScope,
  tripId: string,
): Promise<Array<DayAssignment>> {
  return dayAssignmentsRepository.findMany(scope, {
    where: eq(dayAssignments.tripId, tripId),
    orderBy: [asc(dayAssignments.orderIndex), asc(dayAssignments.id)],
  })
}

export async function listTripAccommodations(
  scope: TenantScope,
  tripId: string,
): Promise<Array<DayAccommodation>> {
  return dayAccommodationsRepository.findMany(scope, {
    where: eq(dayAccommodations.tripId, tripId),
    orderBy: [asc(dayAccommodations.createdAt)],
  })
}

/** One scheduled stop: the assignment, the place it points at, and who is coming along. */
export interface ItineraryStop {
  readonly assignment: DayAssignment
  readonly place: Place
  readonly participantUserIds: ReadonlyArray<string>
}

/**
 * A day of the itinerary with everything the planner renders inside it.
 *
 * Day notes are deliberately absent: the planner reads them through `loadDayNotes`, which carries
 * the icon, the detail and the sort order this shape never did. A caller that needs them asks
 * `listTripDayNotes` for them, so the two callers that do not never pay for the query.
 */
export interface ItineraryDay {
  readonly day: Day
  readonly stops: ReadonlyArray<ItineraryStop>
  readonly accommodations: ReadonlyArray<DayAccommodation>
}

/**
 * The whole itinerary in five scoped queries: days, assignments, places, participants and the
 * trip's members. Stops are ordered by `order_index` then id, so ties from a fractional reorder stay
 * stable.
 *
 * A stop lists only the participants who are **current trip members** (#1086): a person who leaves
 * the trip disappears from its stops, but their `assignment_participants` rows are kept, so they
 * reappear if they rejoin. Permanent deletion belongs to the erasure work (#811). The membership is
 * read once per itinerary, in the same parallel read as the places and participants.
 */
export async function getTripItinerary(
  scope: TenantScope,
  tripId: string,
): Promise<Array<ItineraryDay>> {
  await requireTrip(scope, tripId)

  const [days, assignments, accommodations] = await Promise.all([
    listTripDays(scope, tripId),
    listTripAssignments(scope, tripId),
    listTripAccommodations(scope, tripId),
  ])

  const placeIds = [...new Set(assignments.map((row) => row.placeId))]
  const assignmentIds = assignments.map((row) => row.id)

  const [placeRows, participantRows, memberIds] = await Promise.all([
    placesRepository.findByIds(scope, placeIds),
    assignmentIds.length === 0
      ? Promise.resolve([])
      : assignmentParticipantsAccess.findMany(scope, {
          where: inArray(assignmentParticipants.assignmentId, assignmentIds),
        }),
    tripMemberUserIds(scope, tripId),
  ])

  const placesById = new Map(placeRows.map((row) => [row.id, row]))
  const currentMembers = new Set(memberIds)
  const participantsByAssignment = new Map<string, Array<string>>()
  for (const row of participantRows) {
    if (!currentMembers.has(row.userId)) {
      continue
    }
    const bucket = participantsByAssignment.get(row.assignmentId)
    if (bucket) {
      bucket.push(row.userId)
    } else {
      participantsByAssignment.set(row.assignmentId, [row.userId])
    }
  }

  const dayNumbers = new Map(days.map((day) => [day.id, day.dayNumber]))
  const stopsByDay = new Map<string, Array<ItineraryStop>>()
  for (const assignment of assignments) {
    const place = placesById.get(assignment.placeId)
    if (!place) {
      continue
    }
    const stop: ItineraryStop = {
      assignment,
      place,
      participantUserIds: participantsByAssignment.get(assignment.id) ?? [],
    }
    const bucket = stopsByDay.get(assignment.dayId)
    if (bucket) {
      bucket.push(stop)
    } else {
      stopsByDay.set(assignment.dayId, [stop])
    }
  }

  return days.map((day) => ({
    day,
    stops: stopsByDay.get(day.id) ?? [],
    accommodations: accommodations.filter((stay) => {
      const from = dayNumbers.get(stay.startDayId)
      const to = dayNumbers.get(stay.endDayId)
      return (
        from !== undefined &&
        to !== undefined &&
        day.dayNumber >= from &&
        day.dayNumber <= to
      )
    }),
  }))
}

/** A point on the map, in decimal degrees. */
export interface DayCoordinate {
  readonly lat: number
  readonly lng: number
}

/**
 * Where one day is, for anything that looks a day up by place - today the weather.
 *
 * Only the day, its date, a coordinate and the country code of the place it came from: no place,
 * stay or member id, because the reader of this shape hands it onward and a caller must not be able
 * to leak what it never held.
 */
export interface DayLocation {
  readonly dayId: string
  readonly date: string | null
  readonly location: DayCoordinate | null
  /** ISO-3166-1 alpha-2 of the place `location` came from; null when it records none, or no location. */
  readonly countryCode: string | null
}

interface LocatedPlace {
  readonly location: DayCoordinate
  readonly countryCode: string | null
}

function locatedOf(place: Place | undefined): LocatedPlace | null {
  return place !== undefined && place.lat !== null && place.lng !== null
    ? {
        location: { lat: place.lat, lng: place.lng },
        countryCode: place.countryCode,
      }
    : null
}

/**
 * The location of each of a trip's days, in day order.
 *
 * A day's location is, first, the place of the stay that covers it. When several stays cover the
 * day the one that **starts** that day wins (the traveller has just arrived there), then the one
 * with the latest start (the most recent decision), then the lowest id so the answer never depends
 * on row order. A stay with no place is skipped. With no usable stay, the place of the day's first
 * stop is used. A place missing either coordinate is not a location at all - half a coordinate is
 * not a point - so the search moves on to the next candidate; a day with none answers `null`.
 *
 * The trip's readability is checked first, so a private trip the reader cannot open is
 * {@link NotFoundError} before a single day is read.
 */
export async function readDayLocations(
  scope: TenantScope,
  tripId: string,
): Promise<Array<DayLocation>> {
  await requireTrip(scope, tripId)

  const [days, assignments, accommodations] = await Promise.all([
    listTripDays(scope, tripId),
    listTripAssignments(scope, tripId),
    listTripAccommodations(scope, tripId),
  ])

  const placeIds = [
    ...new Set([
      ...assignments.map((row) => row.placeId),
      ...accommodations.flatMap((stay) =>
        stay.placeId === null ? [] : [stay.placeId],
      ),
    ]),
  ]
  const placesById = new Map(
    (await placesRepository.findByIds(scope, placeIds)).map((row) => [
      row.id,
      row,
    ]),
  )

  const dayNumbers = new Map(days.map((day) => [day.id, day.dayNumber]))
  const stays = accommodations
    .flatMap((stay) => {
      const from = dayNumbers.get(stay.startDayId)
      const to = dayNumbers.get(stay.endDayId)
      const located = locatedOf(
        stay.placeId === null ? undefined : placesById.get(stay.placeId),
      )
      return from === undefined || to === undefined || located === null
        ? []
        : [{ id: stay.id, from, to, located }]
    })
    .sort((a, b) => b.from - a.from || (a.id < b.id ? -1 : 1))

  const stopsByDay = new Map<string, Array<DayAssignment>>()
  for (const assignment of assignments) {
    const bucket = stopsByDay.get(assignment.dayId)
    if (bucket) {
      bucket.push(assignment)
    } else {
      stopsByDay.set(assignment.dayId, [assignment])
    }
  }

  return days.map((day) => {
    const covering = stays.filter(
      (stay) => day.dayNumber >= stay.from && day.dayNumber <= stay.to,
    )
    // `stays` is sorted latest start first, so the stay starting on this day, if any, leads.
    const stay = covering.at(0)
    const stop =
      (stopsByDay.get(day.id) ?? [])
        .map((assignment) => locatedOf(placesById.get(assignment.placeId)))
        .find((located) => located !== null) ?? null
    const located = stay?.located ?? stop

    return {
      dayId: day.id,
      date: day.date,
      location: located?.location ?? null,
      countryCode: located?.countryCode ?? null,
    }
  })
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/** Appends a place to a day, at the end of the day unless an explicit `orderIndex` is given. */
export async function createAssignment(
  scope: TenantScope,
  input: CreateAssignmentInput,
): Promise<DayAssignment> {
  const values = createAssignmentInput.parse(input)
  await requireTrip(scope, values.tripId)
  await requireTripDay(scope, values.tripId, values.dayId)
  await requirePlaceOfTrip(scope, values.tripId, values.placeId)

  const orderIndex =
    values.orderIndex ?? (await nextOrderIndex(scope, values.dayId))
  return dayAssignmentsRepository.insert(scope, { ...values, orderIndex })
}

async function nextOrderIndex(
  scope: TenantScope,
  dayId: string,
): Promise<number> {
  const rows = await dayAssignmentsRepository.findMany(scope, {
    where: eq(dayAssignments.dayId, dayId),
    orderBy: [asc(dayAssignments.orderIndex)],
  })
  const last = rows.at(-1)
  return last === undefined ? 0 : last.orderIndex + 1
}

export async function updateAssignment(
  scope: TenantScope,
  assignmentId: string,
  input: UpdateAssignmentInput,
): Promise<DayAssignment> {
  return dayAssignmentsRepository.requireUpdate(
    scope,
    assignmentId,
    definedOnly(updateAssignmentInput.parse(input)),
  )
}

/** Applies a whole day's new order in one batch. */
export async function reorderAssignments(
  scope: TenantScope,
  input: ReorderAssignmentsInput,
): Promise<Array<DayAssignment>> {
  const moves = reorderAssignmentsInput.parse(input)
  const known = await dayAssignmentsRepository.findByIds(
    scope,
    moves.map((move) => move.assignmentId),
  )
  const knownIds = new Set(known.map((row) => row.id))
  const applicable = moves.filter((move) => knownIds.has(move.assignmentId))
  if (applicable.length === 0) {
    return []
  }

  await runBatch(
    scope,
    applicable.map((move) =>
      scope.db
        .update(dayAssignments)
        .set({ orderIndex: move.orderIndex })
        .where(
          tenantFilter(
            scope,
            dayAssignments,
            eq(dayAssignments.id, move.assignmentId),
          ),
        ),
    ),
  )

  return dayAssignmentsRepository.findByIds(
    scope,
    applicable.map((move) => move.assignmentId),
  )
}

/* -------------------------------------------------------------------------------------------------
 * One day, one number line
 * ---------------------------------------------------------------------------------------------- */

/**
 * Writes every day a drag touched as a single sequence of positions `0..n-1` per day
 * (PRD #104 decision 9), moving the rows that changed day in the same write.
 *
 * The merged position space is not a new column; it is the agreement that for one
 * day `day_assignments.order_index` and `day_notes.sort_order` are read and written
 * as one number line. Positions are derived from array index on every write, so the
 * two columns cannot drift apart, no fractional value from a mid-list insert
 * survives a move, and a client can only ever send a permutation of ids it can
 * already see — never an index of its own choosing.
 *
 * The rows are read for the whole trip rather than for one day, so a stop or a note
 * named under a day other than the one that holds it is found, and it is written with
 * the day it was named under next to its position. A cross-day move is therefore the
 * same write as a reorder, for both tables, and there is no step in front of it.
 *
 * The day's journeys are on the same line. A journey (a `transport` record, or one `leg`
 * of a chained journey) keeps a fractional `sort_order` that is a *relation* to the stops
 * and notes around it, so a write that renumbers them has to say again where it sits. It
 * is placed here, in the same batch, against the numbering that very write produces
 * (`./day-journeys` holds the rule), so no failure can leave renumbered stops beside a
 * journey that still names the old gaps. A journey departs from one day and cannot be
 * given another by this write.
 *
 * Four rules about the lists the client sends, each of which exists because a board
 * can be stale:
 *
 * - **Unknown ids are dropped, not rejected.** A tab one delete behind should still
 *   be able to reorder the rows that do exist, which is the rule
 *   `reorderPlanFn` has always stated. A foreign tenant's id is unknown here for the
 *   same reason it is unknown everywhere else: the reads below are scoped. A journey
 *   named under a day it does not depart from is unknown too.
 * - **A row named under two days is applied once, under the first day that names it.**
 * - **Known ids the client omitted go back behind the row they currently follow**,
 *   on the day that still holds them, so a partial list cannot silently unposition
 *   an item somebody else added between the client's read and its write — and a row
 *   another day claimed is not taken back.
 * - **`clearTime` must be a subset of the same day's `items`.** An entry outside it is
 *   dropped with everything else that names a row this day does not take.
 *
 * The statements are built against the tables directly rather than through the two
 * repository handles, for the reason {@link reorderAssignments} beside it already
 * does: a batch takes prepared builders, and a handle's write awaits. The scoping is
 * the same either way — every `WHERE` starts from {@link tenantFilter}, which is the
 * `organization_id` predicate a handle would have applied, and both tables carry the
 * column and lead a composite index with it.
 *
 * All of it — every day, every position, every journey and every `NULL` time — goes out as one
 * {@link runBatch}, which on D1 is one transaction: a half-applied reorder is a day
 * whose two columns disagree about one number line, and there is no honest way to
 * render that. That atomicity is what keeps a payload that would put one place
 * on a day twice from writing anything: `day_assignments_day_place_unq` is checked per
 * statement, so it refuses a swap of one place in either order, and the whole batch
 * rolls back with it. (A swap of two different places never collides.) The batch is bounded
 * by {@link MAX_DAYS_PER_MOVE} days of at most 200 rows, one `UPDATE` per row.
 *
 * Returns each day's sequence as written, in the order the days were named, which is
 * what the caller mirrors to the trip room: the stops and notes under `items`, the
 * journeys under `journeys`.
 */
export async function reorderDayTimelines(
  scope: TenantScope,
  input: ReorderDayTimelinesInput,
): Promise<Array<WrittenDayTimeline>> {
  const values = reorderDayTimelinesInput.parse(input)

  // Read first, then role, then every named day: a caller who may not see the trip
  // learns nothing beyond `NotFoundError`, and only a reader who has proved they may
  // see it can be told `FORBIDDEN` (PRD #104 decisions 1 and 6). Nothing is written
  // until all of them have passed.
  await requireTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, TRIP_WRITE_ROLES)
  await Promise.all(
    values.days.map((day) => requireTripDay(scope, values.tripId, day.dayId)),
  )

  const [stops, notes, journeysByDay] = await Promise.all([
    listTripAssignments(scope, values.tripId),
    listTripDayNotes(scope, values.tripId),
    // A journey lives on the one day it departs from, so only the named days are read.
    Promise.all(
      values.days.map((day) =>
        departingJourneys(scope, values.tripId, day.dayId),
      ),
    ),
  ])

  // The trip as it stands, every table on one line per day. Positions are the sort key
  // because that is what the line *is*; the id breaks a tie two rows should never have, and a
  // journey that ties with a stop or a note follows it.
  const current: Array<DayRunEntry & { dayId: string }> = [
    ...stops.map((row) => ({
      ref: { kind: 'stop' as const, id: row.id },
      dayId: row.dayId,
      position: row.orderIndex,
    })),
    ...notes.map((row) => ({
      ref: { kind: 'note' as const, id: row.id },
      dayId: row.dayId,
      position: row.sortOrder,
    })),
    ...values.days.flatMap((day, index) =>
      journeysByDay[index].map((entry) => ({ ...entry, dayId: day.dayId })),
    ),
  ].sort(byDayRun)

  const known = new Map(
    current.map((entry) => [dayRunKey(entry.ref), entry.ref]),
  )
  const heldBy = new Map(
    current.map((entry) => [dayRunKey(entry.ref), entry.dayId]),
  )

  // First every day takes what it names, so that the splice below can tell a row the
  // client left out from a row another day took.
  const claimed = new Set<string>()
  const lines = values.days.map((day) => {
    const wanted: Array<DayRunItemInput> = []
    for (const ref of day.items) {
      const key = dayRunKey(ref)
      const row = known.get(key)
      if (row === undefined || claimed.has(key)) continue
      // A journey cannot change day: its day is its departure, which this write does not own.
      // Named under any other day it is unknown, like a forged id.
      if (!isAnchor(row) && heldBy.get(key) !== day.dayId) continue
      claimed.add(key)
      wanted.push(row)
    }
    // Resolved here, while `wanted` holds exactly what the caller asked to move: the
    // splice below adds the rows the caller left out, and those may not lose a time.
    const moving = new Set(wanted.map(dayRunKey))
    const cleared = new Set(
      day.clearTime?.map(dayRunKey).filter((key) => moving.has(key)) ?? [],
    )
    return { dayId: day.dayId, wanted, held: moving, cleared }
  })

  // Anything the client left out goes back in behind the row it currently follows,
  // so an omission moves nothing rather than sending a row to the end. A row that
  // another day took is skipped and is not an anchor: it is no longer on this line.
  for (const line of lines) {
    let previousKey: string | null = null
    for (const entry of current) {
      if (entry.dayId !== line.dayId) continue
      const key = dayRunKey(entry.ref)
      if (!line.held.has(key)) {
        if (claimed.has(key)) continue
        const anchor =
          previousKey === null
            ? -1
            : line.wanted.findIndex((ref) => dayRunKey(ref) === previousKey)
        line.held.add(key)
        line.wanted.splice(anchor + 1, 0, entry.ref)
      }
      previousKey = key
    }
  }

  // The ruler first: a day's stops and notes are `0..n-1` in the order the line names them, and
  // the journeys are measured against exactly that numbering, never against the stored one.
  const days = lines.map((line) => {
    const anchors = line.wanted.filter(isAnchor)
    const placed = placeJourneys(
      line.wanted,
      new Map(anchors.map((ref, position) => [dayRunKey(ref), position])),
    )
    return { ...line, anchors, placed }
  })

  const statements = [
    ...days.flatMap((line) =>
      line.anchors.map((ref, position) => {
        const dropTime = line.cleared.has(dayRunKey(ref))
        // Only a row that changes day is given one. A row that stays — a spliced-back
        // omission above all — must not have its day rewritten from this read, or a move
        // another editor committed in between would be silently undone.
        const day =
          heldBy.get(dayRunKey(ref)) === line.dayId ? {} : { dayId: line.dayId }
        if (ref.kind === 'stop') {
          return scope.db
            .update(dayAssignments)
            .set(
              // Both columns, not just the start. A stop keeping its `end_time` renders
              // as an open-start range — a row still visibly wearing the time the reader
              // was just told it had lost — and the board's time index reads `start_time` alone, so
              // from then on the clock rule cannot see it and never asks about it again.
              dropTime
                ? {
                    ...day,
                    orderIndex: position,
                    startTime: null,
                    endTime: null,
                  }
                : { ...day, orderIndex: position },
            )
            .where(
              tenantFilter(
                scope,
                dayAssignments,
                eq(dayAssignments.id, ref.id),
              ),
            )
        }
        return scope.db
          .update(dayNotes)
          .set(
            dropTime
              ? { ...day, sortOrder: position, time: null }
              : { ...day, sortOrder: position },
          )
          .where(tenantFilter(scope, dayNotes, eq(dayNotes.id, ref.id)))
      }),
    ),
    ...days.flatMap((line) => journeyPositionStatements(scope, line.placed)),
  ]

  await runBatch(scope, statements)
  return days.map((line) => ({
    dayId: line.dayId,
    items: line.anchors,
    journeys: line.placed.map(({ ref }) => ref),
  }))
}

/* -------------------------------------------------------------------------------------------------
 * The writes that restate a day's journeys without renumbering it
 * ---------------------------------------------------------------------------------------------- */

/**
 * What one write does to one day's stops, for the journeys placed against it.
 *
 * `removed` are assignment ids that will be gone once the batch lands; `added` is the stop it
 * creates. The notes and every other stop stay as they are stored.
 */
interface DayChange {
  readonly removed?: ReadonlySet<string>
  readonly added?: { readonly id: string; readonly orderIndex: number }
  readonly requested?: ReadonlyArray<DayRunItemInput>
}

/**
 * The statements that place one day's journeys against the day as `change` leaves it, and the
 * journeys they write.
 *
 * The stops and notes are the ruler and are never written here: a schedule stores a midpoint and
 * an unschedule leaves a hole, so the numbering the journeys are measured against is the stored
 * one, minus what goes and plus what arrives. The rule is `./day-journeys`'s — the same one
 * `reorderDayTimelines` applies against the numbering it produces itself.
 */
async function restateDayJourneys(
  scope: TenantScope,
  tripId: string,
  dayId: string,
  change: DayChange,
): Promise<{
  readonly statements: Array<BatchStatement>
  readonly written: WrittenDayJourneys
}> {
  const [stops, notes, journeys] = await Promise.all([
    listDayAssignments(scope, dayId),
    listDayNotes(scope, dayId),
    departingJourneys(scope, tripId, dayId),
  ])

  const anchors: Array<DayRunEntry> = [
    ...stops
      .filter((row) => change.removed?.has(row.id) !== true)
      .map((row) => ({
        ref: { kind: 'stop' as const, id: row.id },
        position: row.orderIndex,
      })),
    ...(change.added === undefined
      ? []
      : [
          {
            ref: { kind: 'stop' as const, id: change.added.id },
            position: change.added.orderIndex,
          },
        ]),
    ...notes.map((row) => ({
      ref: { kind: 'note' as const, id: row.id },
      position: row.sortOrder,
    })),
  ]

  const wanted = resolveDayRun(
    [...anchors, ...journeys].sort(byDayRun),
    change.requested,
  )
  const placed = placeJourneys(
    wanted,
    new Map(anchors.map((entry) => [dayRunKey(entry.ref), entry.position])),
  )

  return {
    statements: journeyPositionStatements(scope, placed),
    written: { dayId, journeys: placed.map(({ ref }) => ref) },
  }
}

/** The days that placed at least one journey: a day with none has nothing to tell the room. */
function writtenDays(
  days: ReadonlyArray<WrittenDayJourneys>,
): Array<WrittenDayJourneys> {
  return days.filter((day) => day.journeys.length > 0)
}

/**
 * Gives a place a day and places the day's journeys, in one batch.
 *
 * The stop is stored at `orderIndex`, the midpoint its caller computed among the day's stops, so
 * the day is not renumbered; the journeys are placed against the day with that stop in it. Both go
 * out as one {@link runBatch} — one transaction on D1 — so no failure can leave a stop on the day
 * beside journeys that still name the gaps it was inserted into.
 *
 * The assignment id is minted here, before the batch, so that the run the caller sent can name the
 * stop (by its place id) and the batch can place the journeys against it without a read in between.
 * The usual stop rules apply: the trip may be written, the caller is an owner or an editor, and the
 * day and the place belong to the trip. A place already on the day is refused by
 * `day_assignments_day_place_unq`, and the batch rolls back with it.
 */
export async function scheduleAssignment(
  scope: TenantScope,
  input: ScheduleAssignmentInput,
): Promise<{
  readonly assignmentId: string
  readonly days: Array<WrittenDayJourneys>
}> {
  const values = scheduleAssignmentInput.parse(input)
  await requireWritableTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, TRIP_WRITE_ROLES)
  await requireTripDay(scope, values.tripId, values.dayId)
  await requirePlaceOfTrip(scope, values.tripId, values.placeId)

  const assignmentId = newId()
  const { statements, written } = await restateDayJourneys(
    scope,
    values.tripId,
    values.dayId,
    {
      added: { id: assignmentId, orderIndex: values.orderIndex },
      requested: values.items?.map((ref) =>
        ref.kind === 'stop' && ref.id === values.placeId
          ? { kind: 'stop' as const, id: assignmentId }
          : ref,
      ),
    },
  )

  await runBatch(scope, [
    prepareTenantInsert(scope, dayAssignments, {
      id: assignmentId,
      tripId: values.tripId,
      dayId: values.dayId,
      placeId: values.placeId,
      orderIndex: values.orderIndex,
    }),
    ...statements,
  ])
  return { assignmentId, days: writtenDays([written]) }
}

/**
 * Takes a stop off its day and places the day's journeys, in one batch.
 *
 * The day is not renumbered, so the journeys are measured against the stops that are left, at the
 * positions they hold. The stop must be one of `tripId`'s — an id of another trip, or of another
 * workspace, is not found. Its participants go with it, as they do for a bare delete.
 */
export async function unscheduleAssignment(
  scope: TenantScope,
  input: UnscheduleAssignmentInput,
): Promise<Array<WrittenDayJourneys>> {
  const values = unscheduleAssignmentInput.parse(input)
  await requireWritableTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, TRIP_WRITE_ROLES)

  const stop = await dayAssignmentsRepository.findById(
    scope,
    values.assignmentId,
  )
  if (stop === null || stop.tripId !== values.tripId) {
    throw new NotFoundError('day assignment', values.assignmentId)
  }

  const { statements, written } = await restateDayJourneys(
    scope,
    values.tripId,
    stop.dayId,
    { removed: new Set([stop.id]) },
  )

  await runBatch(scope, [
    scope.db
      .delete(dayAssignments)
      .where(
        tenantFilter(scope, dayAssignments, eq(dayAssignments.id, stop.id)),
      ),
    ...statements,
  ])
  return writtenDays([written])
}

/**
 * Deletes a place and places the journeys of every day it was on, in one batch.
 *
 * The place's stops go with it (`day_assignments.place_id` cascades), one per day at most, and
 * each of those days has its journeys measured against the stops it keeps. The place must be one
 * of `tripId`'s: an id of another trip, or of another workspace, is not found.
 */
export async function deletePlaceWithJourneys(
  scope: TenantScope,
  input: DeletePlaceWithJourneysInput,
): Promise<Array<WrittenDayJourneys>> {
  const values = deletePlaceWithJourneysInput.parse(input)
  await requireWritableTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, TRIP_WRITE_ROLES)
  await requirePlaceOfTrip(scope, values.tripId, values.placeId)

  const stops = await dayAssignmentsRepository.findMany(scope, {
    where: eq(dayAssignments.placeId, values.placeId),
  })
  const restated = await Promise.all(
    [...new Set(stops.map((stop) => stop.dayId))].map((dayId) =>
      restateDayJourneys(scope, values.tripId, dayId, {
        removed: new Set(
          stops.filter((stop) => stop.dayId === dayId).map((stop) => stop.id),
        ),
      }),
    ),
  )

  await runBatch(scope, [
    scope.db
      .delete(places)
      .where(tenantFilter(scope, places, eq(places.id, values.placeId))),
    ...restated.flatMap((day) => day.statements),
  ])
  return writtenDays(restated.map((day) => day.written))
}

/**
 * Replaces the participant set of one stop.
 *
 * Starts from a row id, so it asks the stop's trip the two questions every trip-scoped writer asks
 * - may the caller see it (`requireTrip`, `NotFoundError` otherwise, ADR 0007), may they edit it -
 * in that order, and writes only after both pass.
 *
 * Only a **current member of the stop's trip** (any role) may be listed (#1086). A list naming
 * anyone else - a workspace member who is not on the trip, a person who has left it, a user of
 * another workspace, an id that matches no user - is refused as a whole with one
 * `NotFoundError('trip member', 'named in the request')` that names no id, and the stored set is
 * untouched. A stop carries no debt, so unlike an expense a person who has left is not kept
 * listable: re-saving a set without them succeeds, naming them is refused. The membership check runs
 * after the two guards above, so a caller who may not see the trip is answered the trip's refusal.
 * {@link getTripItinerary} applies the same definition of member when it reads the set back.
 */
export async function setAssignmentParticipants(
  scope: TenantScope,
  assignmentId: string,
  userIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  const assignment = await dayAssignmentsRepository.requireById(
    scope,
    assignmentId,
  )
  await requireTrip(scope, assignment.tripId)
  await assertTripRole(scope, assignment.tripId, TRIP_WRITE_ROLES)
  const parsed = [
    ...new Set(
      z
        .array(idSchema)
        .max(50)
        .parse([...userIds]),
    ),
  ]
  const members = new Set(await tripMemberUserIds(scope, assignment.tripId))
  if (parsed.some((userId) => !members.has(userId))) {
    throw new NotFoundError('trip member', 'named in the request')
  }

  await assignmentParticipantsAccess.removeWhere(
    scope,
    eq(assignmentParticipants.assignmentId, assignmentId),
  )
  if (parsed.length > 0) {
    await assignmentParticipantsAccess.insertMany(
      scope,
      parsed.map((userId) => ({ assignmentId, userId })),
    )
  }
  return parsed
}

/* -------------------------------------------------------------------------------------------------
 * Accommodations
 * ---------------------------------------------------------------------------------------------- */

export async function createAccommodation(
  scope: TenantScope,
  input: CreateAccommodationInput,
): Promise<DayAccommodation> {
  const values = createAccommodationInput.parse(input)
  await requireWritableTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, TRIP_WRITE_ROLES)
  const start = await requireTripDay(scope, values.tripId, values.startDayId)
  const end = await requireTripDay(scope, values.tripId, values.endDayId)
  if (end.dayNumber < start.dayNumber) {
    throw new NotFoundError('day', values.endDayId)
  }
  if (values.placeId) {
    await requirePlaceOfTrip(scope, values.tripId, values.placeId)
  }
  if (values.reservationId) {
    await requireReservationOfTrip(scope, values.tripId, values.reservationId)
  }
  return dayAccommodationsRepository.insert(scope, values)
}

export async function updateAccommodation(
  scope: TenantScope,
  accommodationId: string,
  input: UpdateAccommodationInput,
): Promise<DayAccommodation> {
  const values = definedOnly(updateAccommodationInput.parse(input))
  const existing = await dayAccommodationsRepository.requireById(
    scope,
    accommodationId,
  )
  await requireWritableTrip(scope, existing.tripId)
  await assertTripRole(scope, existing.tripId, TRIP_WRITE_ROLES)
  if (values.startDayId) {
    await requireTripDay(scope, existing.tripId, values.startDayId)
  }
  if (values.endDayId) {
    await requireTripDay(scope, existing.tripId, values.endDayId)
  }
  if (values.placeId) {
    await requirePlaceOfTrip(scope, existing.tripId, values.placeId)
  }
  if (values.reservationId) {
    await requireReservationOfTrip(scope, existing.tripId, values.reservationId)
  }
  return dayAccommodationsRepository.requireUpdate(
    scope,
    accommodationId,
    values,
  )
}

export async function deleteAccommodation(
  scope: TenantScope,
  accommodationId: string,
): Promise<void> {
  const existing = await dayAccommodationsRepository.requireById(
    scope,
    accommodationId,
  )
  await requireWritableTrip(scope, existing.tripId)
  await assertTripRole(scope, existing.tripId, TRIP_WRITE_ROLES)
  await dayAccommodationsRepository.requireRemove(scope, accommodationId)
}

/**
 * Unlinks every stay of this tenant that was made under one booking, and answers how many.
 *
 * Called by {@link deleteReservation} immediately before the booking goes, and that ordering is the
 * whole point. `schema.ts` declares `reservation_id` as `on delete: 'set null'`, but it arrived by
 * `ADD COLUMN`, and drizzle-kit writes no `ON DELETE` clause there, so what D1 actually enforces is
 * `NO ACTION` — registered in `migrations-match-schema.test.ts`, ADR 0044. Closing that gap in the
 * database would mean either hand-editing a generated migration or rebuilding the table, so the
 * rule the schema promises is kept here instead: without this, deleting a stay's booking raises
 * `FOREIGN KEY constraint failed` and the nights never get the chance to outlive it.
 *
 * Scoped like every other statement in this file, so a booking id belonging to another organization
 * matches no row rather than clearing one.
 */
export async function unlinkAccommodationsFromReservation(
  scope: TenantScope,
  reservationId: string,
): Promise<number> {
  const rows = await dayAccommodationsRepository.updateWhere(
    scope,
    eq(dayAccommodations.reservationId, reservationId),
    { reservationId: null },
  )
  return rows.length
}

/** Nights covered by a stay, derived from the day run rather than stored twice. */
export async function countAccommodationNights(
  scope: TenantScope,
  accommodationId: string,
): Promise<number> {
  const stay = await dayAccommodationsRepository.requireById(
    scope,
    accommodationId,
  )
  const days = await listTripDays(scope, stay.tripId)
  const start = days.find((day) => day.id === stay.startDayId)?.dayNumber
  const end = days.find((day) => day.id === stay.endDayId)?.dayNumber
  if (start === undefined || end === undefined) {
    return 0
  }
  return Math.max(end - start, 0)
}

/** Stops of a day that still need a booking — drives the "unconfirmed" badge on the planner. */
export async function listUnconfirmedStops(
  scope: TenantScope,
  tripId: string,
): Promise<Array<DayAssignment>> {
  return dayAssignmentsRepository.findMany(scope, {
    where: and(
      eq(dayAssignments.tripId, tripId),
      inArray(dayAssignments.reservationStatus, ['pending', 'none']),
    ),
    orderBy: [asc(dayAssignments.orderIndex)],
  })
}
