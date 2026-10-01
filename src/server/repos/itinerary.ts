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
} from '#/server/db/schema'
import {
  createTenantRepository,
  createTenantTableAccess,
  tenantFilter,
} from './base'
import { runBatch } from './batch'
import { NotFoundError } from './context'
import { listDayNotes, listTripDays, requireTripDay } from './days'
import { placesRepository } from './places'
import { requireReservationOfTrip } from './reservations'
import { assertTripRole, requireTrip } from './trips'
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

export const moveAssignmentInput = z.object({
  dayId: idSchema,
  orderIndex: sortOrderSchema,
})
export type MoveAssignmentInput = z.infer<typeof moveAssignmentInput>

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

export const reorderDayTimelineInput = z.object({
  tripId: idSchema,
  dayId: idSchema,
  items: z.array(timelineItemInput).max(200),
  /**
   * Rows whose time is dropped as part of this move (PRD #104 decision 9). Every
   * entry must also be in `items`: clearing a time is a consequence of a move, never
   * a write of its own.
   */
  clearTime: z.array(timelineItemInput).max(200).optional(),
})
export type ReorderDayTimelineInput = z.infer<typeof reorderDayTimelineInput>

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
 * Guards
 * ---------------------------------------------------------------------------------------------- */

async function requirePlaceOfTrip(
  scope: TenantScope,
  tripId: string,
  placeId: string,
): Promise<Place> {
  const place = await placesRepository.requireById(scope, placeId)
  if (place.tripId !== tripId) {
    throw new NotFoundError('place', placeId)
  }
  return place
}

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
 * The whole itinerary in four scoped queries: days, assignments, places and participants.
 * Stops are ordered by `order_index` then id, so ties from a fractional reorder stay stable.
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

  const [placeRows, participantRows] = await Promise.all([
    placesRepository.findByIds(scope, placeIds),
    assignmentIds.length === 0
      ? Promise.resolve([])
      : assignmentParticipantsAccess.findMany(scope, {
          where: inArray(assignmentParticipants.assignmentId, assignmentIds),
        }),
  ])

  const placesById = new Map(placeRows.map((row) => [row.id, row]))
  const participantsByAssignment = new Map<string, Array<string>>()
  for (const row of participantRows) {
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

/** Drags a stop onto another day. The target day must belong to the same trip. */
export async function moveAssignment(
  scope: TenantScope,
  assignmentId: string,
  input: MoveAssignmentInput,
): Promise<DayAssignment> {
  const values = moveAssignmentInput.parse(input)
  const assignment = await dayAssignmentsRepository.requireById(
    scope,
    assignmentId,
  )
  await requireTripDay(scope, assignment.tripId, values.dayId)
  return dayAssignmentsRepository.requireUpdate(scope, assignmentId, {
    dayId: values.dayId,
    orderIndex: values.orderIndex,
  })
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

export async function deleteAssignment(
  scope: TenantScope,
  assignmentId: string,
): Promise<void> {
  await dayAssignmentsRepository.requireRemove(scope, assignmentId)
}

/* -------------------------------------------------------------------------------------------------
 * One day, one number line
 * ---------------------------------------------------------------------------------------------- */

/** `kind/id`, so the two id spaces can share one `Set` without colliding. */
function refKey(ref: TimelineItemInput): string {
  return `${ref.kind}/${ref.id}`
}

/**
 * Writes one day's stops and notes as a single sequence of positions `0..n-1`
 * (PRD #104 decision 9).
 *
 * The merged position space is not a new column; it is the agreement that for one
 * day `day_assignments.order_index` and `day_notes.sort_order` are read and written
 * as one number line. Positions are derived from array index on every write, so the
 * two columns cannot drift apart, no fractional value from a mid-list insert
 * survives a move, and a client can only ever send a permutation of ids it can
 * already see — never an index of its own choosing.
 *
 * Three rules about the list the client sends, each of which exists because a board
 * can be stale:
 *
 * - **Unknown ids are dropped, not rejected.** A tab one delete behind should still
 *   be able to reorder the rows that do exist, which is the rule
 *   `reorderPlanFn` has always stated. A foreign tenant's id is unknown here for the
 *   same reason it is unknown everywhere else: the two reads below are scoped.
 * - **Known ids the client omitted go back behind the row they currently follow**,
 *   so a partial list cannot silently unposition an item somebody else added
 *   between the client's read and its write.
 * - **`clearTime` must be a subset of `items`.** An entry outside it is dropped with
 *   everything else that names a row this day does not hold.
 *
 * The statements are built against the tables directly rather than through the two
 * repository handles, for the reason {@link reorderAssignments} beside it already
 * does: a batch takes prepared builders, and a handle's write awaits. The scoping is
 * the same either way — every `WHERE` starts from {@link tenantFilter}, which is the
 * `organization_id` predicate a handle would have applied, and both tables carry the
 * column and lead a composite index with it.
 *
 * All of it — every position and every `NULL` time — goes out as one {@link runBatch},
 * which on D1 is one transaction: a half-applied reorder is a day whose two columns
 * disagree about one number line, and there is no honest way to render that. The
 * batch is bounded by one day at one `UPDATE` per row, so it stays inside D1's
 * per-statement parameter ceiling and stays in the request path.
 *
 * Returns the sequence as written, which is what the caller mirrors to the trip room.
 */
export async function reorderDayTimeline(
  scope: TenantScope,
  input: ReorderDayTimelineInput,
): Promise<Array<TimelineItemInput>> {
  const values = reorderDayTimelineInput.parse(input)

  // Read first, then role, then day: a caller who may not see the trip learns nothing
  // beyond `NotFoundError`, and only a reader who has proved they may see it can be
  // told `FORBIDDEN` (PRD #104 decisions 1 and 6).
  await requireTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, ['owner', 'editor'])
  await requireTripDay(scope, values.tripId, values.dayId)

  const [stops, notes] = await Promise.all([
    listDayAssignments(scope, values.dayId),
    listDayNotes(scope, values.dayId),
  ])

  // The day as it stands, both tables on one line. Positions are the sort key because
  // that is what the line *is*; the id breaks a tie two rows should never have.
  const current: Array<{ ref: TimelineItemInput; position: number }> = [
    ...stops.map((row) => ({
      ref: { kind: 'stop' as const, id: row.id },
      position: row.orderIndex,
    })),
    ...notes.map((row) => ({
      ref: { kind: 'note' as const, id: row.id },
      position: row.sortOrder,
    })),
  ].sort((a, b) => a.position - b.position || a.ref.id.localeCompare(b.ref.id))

  const known = new Map(current.map((entry) => [refKey(entry.ref), entry.ref]))
  const wanted: Array<TimelineItemInput> = []
  const seen = new Set<string>()
  for (const ref of values.items) {
    const key = refKey(ref)
    const row = known.get(key)
    if (row === undefined || seen.has(key)) continue
    seen.add(key)
    wanted.push(row)
  }
  // Resolved here, while `seen` still holds exactly what the caller asked to move:
  // the loop below adds the rows the caller left out, and those may not lose a time.
  const cleared = new Set(
    values.clearTime?.map(refKey).filter((key) => seen.has(key)) ?? [],
  )

  // Anything the client left out goes back in behind the row it currently follows,
  // so an omission moves nothing rather than sending a row to the end. Every earlier
  // entry of `current` is already in `wanted` — it either came from the client's list
  // or was spliced in by an earlier turn — so that row is always the anchor.
  let previousKey: string | null = null
  for (const entry of current) {
    const key = refKey(entry.ref)
    if (!seen.has(key)) {
      const anchor =
        previousKey === null
          ? -1
          : wanted.findIndex((ref) => refKey(ref) === previousKey)
      seen.add(key)
      wanted.splice(anchor + 1, 0, entry.ref)
    }
    previousKey = key
  }

  const statements = wanted.map((ref, position) => {
    const dropTime = cleared.has(refKey(ref))
    if (ref.kind === 'stop') {
      return scope.db
        .update(dayAssignments)
        .set(
          // Both columns, not just the start. A stop keeping its `end_time` renders
          // as an open-start range — a row still visibly wearing the time the reader
          // was just told it had lost — and the board's time index reads `start_time` alone, so
          // from then on the clock rule cannot see it and never asks about it again.
          dropTime
            ? { orderIndex: position, startTime: null, endTime: null }
            : { orderIndex: position },
        )
        .where(
          tenantFilter(scope, dayAssignments, eq(dayAssignments.id, ref.id)),
        )
    }
    return scope.db
      .update(dayNotes)
      .set(
        dropTime
          ? { sortOrder: position, time: null }
          : { sortOrder: position },
      )
      .where(tenantFilter(scope, dayNotes, eq(dayNotes.id, ref.id)))
  })

  await runBatch(scope, statements)
  return wanted
}

/** Replaces the participant set of one stop. */
export async function setAssignmentParticipants(
  scope: TenantScope,
  assignmentId: string,
  userIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  await dayAssignmentsRepository.requireById(scope, assignmentId)
  const parsed = [
    ...new Set(
      z
        .array(idSchema)
        .max(50)
        .parse([...userIds]),
    ),
  ]

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
  await requireTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, ['owner', 'editor'])
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
  await assertTripRole(scope, existing.tripId, ['owner', 'editor'])
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
  await assertTripRole(scope, existing.tripId, ['owner', 'editor'])
  await dayAccommodationsRepository.requireRemove(scope, accommodationId)
}

/**
 * Unlinks every stay of this tenant that was made under one booking, and answers how many.
 *
 * Called by {@link deleteReservation} immediately before the booking goes, and that ordering is the
 * whole point. `schema.ts` declares `reservation_id` as `on delete: 'set null'`, but it arrived by
 * `ADD COLUMN`, which carries no `ON DELETE` clause, so what D1 actually enforces is `NO ACTION` —
 * pinned by `accommodation-schema.test.ts` and `migrations-match-schema.test.ts`. Closing that gap in
 * the database would mean either hand-editing a generated migration or rebuilding the table, so the
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
