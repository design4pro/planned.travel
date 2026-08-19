/**
 * The itinerary: which place is visited on which day, in what order, by whom, and where the trip
 * sleeps.
 *
 * `days` owns the spine (see `./days`), `places` owns the inventory (see `./places`), and this module
 * owns the join between them. {@link getTripItinerary} is the single read behind the planner screen:
 * one query per table, assembled in memory, ordered day number then position — never N+1 per day.
 */

import { and, asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  RESERVATION_STATUSES,
  TRANSPORT_MODES,
  assignmentParticipants,
  dayAccommodations,
  dayAssignments,
} from '#/server/db/schema'
import { createTenantRepository, createTenantTableAccess, tenantFilter } from './base'
import { runBatch } from './batch'
import { NotFoundError } from './context'
import { listTripDayNotes, listTripDays, requireTripDay } from './days'
import { placesRepository } from './places'
import { requireTrip } from './trips'
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
  DayNote,
  Place,
} from '#/server/db/types'
import type { TenantScope } from './base'

export const dayAssignmentsRepository = createTenantRepository(dayAssignments, 'day assignment')
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

/** A day of the itinerary with everything the planner renders inside it. */
export interface ItineraryDay {
  readonly day: Day
  readonly stops: ReadonlyArray<ItineraryStop>
  readonly notes: ReadonlyArray<DayNote>
  readonly accommodations: ReadonlyArray<DayAccommodation>
}

/**
 * The whole itinerary in five scoped queries: days, assignments, places, participants and notes.
 * Stops are ordered by `order_index` then id, so ties from a fractional reorder stay stable.
 */
export async function getTripItinerary(
  scope: TenantScope,
  tripId: string,
): Promise<Array<ItineraryDay>> {
  await requireTrip(scope, tripId)

  const [days, assignments, notes, accommodations] = await Promise.all([
    listTripDays(scope, tripId),
    listTripAssignments(scope, tripId),
    listTripDayNotes(scope, tripId),
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

  const notesByDay = new Map<string, Array<DayNote>>()
  for (const note of notes) {
    const bucket = notesByDay.get(note.dayId)
    if (bucket) {
      bucket.push(note)
    } else {
      notesByDay.set(note.dayId, [note])
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
    notes: notesByDay.get(day.id) ?? [],
    accommodations: accommodations.filter((stay) => {
      const from = dayNumbers.get(stay.startDayId)
      const to = dayNumbers.get(stay.endDayId)
      return from !== undefined && to !== undefined && day.dayNumber >= from && day.dayNumber <= to
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

  const orderIndex = values.orderIndex ?? (await nextOrderIndex(scope, values.dayId))
  return dayAssignmentsRepository.insert(scope, { ...values, orderIndex })
}

async function nextOrderIndex(scope: TenantScope, dayId: string): Promise<number> {
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
  const assignment = await dayAssignmentsRepository.requireById(scope, assignmentId)
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
        .where(tenantFilter(scope, dayAssignments, eq(dayAssignments.id, move.assignmentId))),
    ),
  )

  return dayAssignmentsRepository.findByIds(
    scope,
    applicable.map((move) => move.assignmentId),
  )
}

export async function deleteAssignment(scope: TenantScope, assignmentId: string): Promise<void> {
  await dayAssignmentsRepository.requireRemove(scope, assignmentId)
}

/** Replaces the participant set of one stop. */
export async function setAssignmentParticipants(
  scope: TenantScope,
  assignmentId: string,
  userIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  await dayAssignmentsRepository.requireById(scope, assignmentId)
  const parsed = [...new Set(z.array(idSchema).max(50).parse([...userIds]))]

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
  const start = await requireTripDay(scope, values.tripId, values.startDayId)
  const end = await requireTripDay(scope, values.tripId, values.endDayId)
  if (end.dayNumber < start.dayNumber) {
    throw new NotFoundError('day', values.endDayId)
  }
  if (values.placeId) {
    await requirePlaceOfTrip(scope, values.tripId, values.placeId)
  }
  return dayAccommodationsRepository.insert(scope, values)
}

export async function updateAccommodation(
  scope: TenantScope,
  accommodationId: string,
  input: UpdateAccommodationInput,
): Promise<DayAccommodation> {
  const values = definedOnly(updateAccommodationInput.parse(input))
  const existing = await dayAccommodationsRepository.requireById(scope, accommodationId)
  if (values.startDayId) {
    await requireTripDay(scope, existing.tripId, values.startDayId)
  }
  if (values.endDayId) {
    await requireTripDay(scope, existing.tripId, values.endDayId)
  }
  if (values.placeId) {
    await requirePlaceOfTrip(scope, existing.tripId, values.placeId)
  }
  return dayAccommodationsRepository.requireUpdate(scope, accommodationId, values)
}

export async function deleteAccommodation(
  scope: TenantScope,
  accommodationId: string,
): Promise<void> {
  await dayAccommodationsRepository.requireRemove(scope, accommodationId)
}

/** Nights covered by a stay, derived from the day run rather than stored twice. */
export async function countAccommodationNights(
  scope: TenantScope,
  accommodationId: string,
): Promise<number> {
  const stay = await dayAccommodationsRepository.requireById(scope, accommodationId)
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
