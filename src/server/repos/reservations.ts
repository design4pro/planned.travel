/**
 * Reservations — the bookings behind the itinerary: hotels, restaurants, tours, tickets.
 *
 * A reservation can point at a day, a place, a specific itinerary stop or a transport leg, and every
 * one of those references is verified against the same trip before it is stored.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
} from 'drizzle-orm'
import { z } from 'zod'
import {
  RESERVATION_STATUSES,
  RESERVATION_TYPES,
  dayAssignments,
  reservations,
} from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { MAX_BOUND_PARAMETERS } from './batch'
import { NotFoundError } from './context'
import { requireTripDay } from './days'
import { getExpense } from './expenses'
import { unlinkAccommodationsFromReservation } from './itinerary'
import { requirePlaceOfTrip } from './places'
import { requireTransportOfTrip } from './transports'
import { assertTripRole, requireWritableTrip } from './trips'
import {
  currencySchema,
  dateSchema,
  definedOnly,
  idSchema,
  longTextSchema,
  minorAmountSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  timeSchema,
  titleSchema,
  urlSchema,
} from './validation'
import type { Reservation, Trip } from '#/server/db/types'
import type { TenantScope } from './base'
import type { TripRole } from './trips'

export const reservationsRepository = createTenantRepository(
  reservations,
  'reservation',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const reservationFields = {
  dayId: idSchema.nullish(),
  endDayId: idSchema.nullish(),
  placeId: idSchema.nullish(),
  assignmentId: idSchema.nullish(),
  transportId: idSchema.nullish(),
  type: z.enum(RESERVATION_TYPES).optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  title: titleSchema,
  provider: shortTextSchema.nullish(),
  location: shortTextSchema.nullish(),
  url: urlSchema.nullish(),
  confirmationNumber: shortTextSchema.nullish(),
  startDate: dateSchema.nullish(),
  startTime: timeSchema.nullish(),
  endDate: dateSchema.nullish(),
  endTime: timeSchema.nullish(),
  guests: nonNegativeIntSchema.max(1000).nullish(),
  priceMinor: minorAmountSchema.nullish(),
  currency: currencySchema.nullish(),
  notes: longTextSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
}

export const createReservationInput = z.object({
  tripId: idSchema,
  ...reservationFields,
})
export type CreateReservationInput = z.infer<typeof createReservationInput>

export const updateReservationInput = z.object({
  ...reservationFields,
  title: titleSchema.optional(),
})
export type UpdateReservationInput = z.infer<typeof updateReservationInput>

export const listReservationsInput = z.object({
  tripId: idSchema,
  type: z.enum(RESERVATION_TYPES).optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  unscheduled: z.boolean().optional(),
})
export type ListReservationsInput = z.infer<typeof listReservationsInput>

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

/** A trip's bookings in date order, undated ones last. */
export async function listTripReservations(
  scope: TenantScope,
  input: ListReservationsInput,
): Promise<Array<Reservation>> {
  const options = listReservationsInput.parse(input)
  return reservationsRepository.findMany(scope, {
    where: and(
      eq(reservations.tripId, options.tripId),
      options.type ? eq(reservations.type, options.type) : undefined,
      options.status ? eq(reservations.status, options.status) : undefined,
      options.unscheduled === true ? isNull(reservations.dayId) : undefined,
    ),
    orderBy: [
      asc(reservations.startDate),
      asc(reservations.startTime),
      asc(reservations.sortOrder),
      asc(reservations.id),
    ],
  })
}

export async function getReservation(
  scope: TenantScope,
  reservationId: string,
): Promise<Reservation | null> {
  return reservationsRepository.findById(scope, reservationId)
}

export async function listDayReservations(
  scope: TenantScope,
  dayId: string,
): Promise<Array<Reservation>> {
  return reservationsRepository.findMany(scope, {
    where: eq(reservations.dayId, dayId),
    orderBy: [asc(reservations.startTime), asc(reservations.sortOrder)],
  })
}

/** Bookings coming up across every trip — the dashboard's reservation rail. */
export async function listUpcomingReservations(
  scope: TenantScope,
  options: {
    readonly from?: string
    readonly to?: string
    readonly limit?: number
  } = {},
): Promise<Array<Reservation>> {
  const from = dateSchema.parse(
    options.from ?? new Date().toISOString().slice(0, 10),
  )
  return reservationsRepository.findMany(scope, {
    where: and(
      gte(reservations.startDate, from),
      options.to
        ? lte(reservations.startDate, dateSchema.parse(options.to))
        : undefined,
      inArray(reservations.status, ['pending', 'confirmed']),
    ),
    orderBy: [asc(reservations.startDate), asc(reservations.startTime)],
    limit: options.limit ?? 10,
  })
}

export interface ReservationStatusCounts {
  readonly status: (typeof RESERVATION_STATUSES)[number]
  readonly value: number
}

/** Booking counts per status for one trip — the progress ring on the bookings screen. */
export async function countTripReservationsByStatus(
  scope: TenantScope,
  tripId: string,
): Promise<Array<ReservationStatusCounts>> {
  const rows = await scope.db
    .select({ status: reservations.status, value: count() })
    .from(reservations)
    .where(tenantFilter(scope, reservations, eq(reservations.tripId, tripId)))
    .groupBy(reservations.status)
    .orderBy(desc(count()))

  return rows.flatMap((row) =>
    (RESERVATION_STATUSES as ReadonlyArray<string>).includes(row.status)
      ? [
          {
            status: row.status as (typeof RESERVATION_STATUSES)[number],
            value: row.value,
          },
        ]
      : [],
  )
}

/** Money committed to bookings on a trip, in minor units of each booking's own currency. */
export async function totalTripReservationsMinor(
  scope: TenantScope,
  tripId: string,
): Promise<number> {
  return reservationsRepository.sumOf(
    scope,
    reservations.priceMinor,
    and(
      eq(reservations.tripId, tripId),
      inArray(reservations.status, ['pending', 'confirmed']),
    ),
  )
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Trip roles that may change a trip's bookings. A `viewer` reads the desk and writes nothing.
 *
 * The one place the booking writers' role list is declared. Whether a caller holds one of them is
 * not decided here: that is {@link assertTripRole}, the trip's own guard, so a booking refusal is
 * the same `TripRoleError` every other trip writer raises and reaches the reader as a refusal.
 */
const BOOKING_WRITE_ROLES: ReadonlyArray<TripRole> = ['owner', 'editor']

/**
 * The trip a booking writer may change, or a refusal: the layers every booking write shares, in the
 * boundary's order (ADR 0007).
 *
 * {@link requireWritableTrip} first - `NotFoundError` for a trip the caller may not see, then
 * `TripArchivedError` for an archived one, so a record the archive says is finished cannot be
 * rewritten and a reader who may not see the trip is never told it is archived - and only then
 * {@link assertTripRole} with the booking writers' role list. The archive answers before the role
 * for the reason `requireWritableTrip` gives: it is a property of the trip, and the instruction it
 * carries (ask the owner to restore it) holds for a viewer too.
 *
 * Exported because the confirmation import, which writes this trip's bookings from outside this
 * file, spends before `createReservation` is reached: `startBookingImport` spends a metered
 * extraction unit the moment it enqueues, and `confirmBookingImport` creates a place and calls the
 * geocoder for an accommodation row before its reservation write. Both ask the same questions this
 * early, through this function, so the archive rule and the role list stay declared once.
 */
export async function requireWritableBookingTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  const trip = await requireWritableTrip(scope, tripId)
  await assertTripRole(scope, tripId, BOOKING_WRITE_ROLES)
  return trip
}

/**
 * The booking a writer is about to change, once the caller has been shown to be allowed to change
 * it: `NotFoundError` when the row is not theirs or sits on a private trip they are not on,
 * `TripArchivedError` when the row's own trip is archived, `TripRoleError` when it is theirs to read
 * and not to edit. Every writer below that starts from a booking id starts here, so the refusals
 * cannot drift apart between them, and the archive is read off the row's trip, not off a trip id
 * the request names.
 *
 * The order is the boundary's (ADR 0007): the row, then the trip (seen, then writable) and then the
 * role. Asked the other way round, someone who may not see the trip and holds a booking id is told
 * `FORBIDDEN` for a row that, from where they stand, does not exist.
 */
async function requireWritableReservation(
  scope: TenantScope,
  reservationId: string,
): Promise<Reservation> {
  const existing = await reservationsRepository.requireById(
    scope,
    reservationId,
  )
  await requireWritableBookingTrip(scope, existing.tripId)
  return existing
}

/**
 * The booking, when it is a booking of `tripId`: `NotFoundError` otherwise, the same answer a
 * missing id gets, so naming another trip's booking reveals nothing about it. For every caller
 * that names a trip and a booking together and then acts on the trip's id.
 */
export async function requireReservationOfTrip(
  scope: TenantScope,
  tripId: string,
  reservationId: string,
): Promise<Reservation> {
  const reservation = await reservationsRepository.requireById(
    scope,
    reservationId,
  )
  if (reservation.tripId !== tripId) {
    throw new NotFoundError('reservation', reservationId)
  }
  return reservation
}

/** Verifies every optional reference points at a row of the same trip inside the same tenant. */
async function assertReferences(
  scope: TenantScope,
  tripId: string,
  values: Partial<CreateReservationInput>,
): Promise<void> {
  if (values.dayId) {
    await requireTripDay(scope, tripId, values.dayId)
  }
  if (values.endDayId) {
    await requireTripDay(scope, tripId, values.endDayId)
  }
  if (values.placeId) {
    await requirePlaceOfTrip(scope, tripId, values.placeId)
  }
  if (values.assignmentId) {
    const rows = await scope.db
      .select({ tripId: dayAssignments.tripId })
      .from(dayAssignments)
      .where(
        tenantFilter(
          scope,
          dayAssignments,
          eq(dayAssignments.id, values.assignmentId),
        ),
      )
      .limit(1)
    if (rows[0]?.tripId !== tripId) {
      throw new NotFoundError('day assignment', values.assignmentId)
    }
  }
  if (values.transportId) {
    await requireTransportOfTrip(scope, tripId, values.transportId)
  }
}

export async function createReservation(
  scope: TenantScope,
  input: CreateReservationInput,
): Promise<Reservation> {
  return insertReservation(scope, input, null)
}

/** Server-only import writer. The marker is never accepted through a booking payload. */
export async function createImportedReservation(
  scope: TenantScope,
  input: CreateReservationInput,
  importedAt: Date,
): Promise<Reservation> {
  return insertReservation(scope, input, importedAt)
}

/** Both creation paths share the tenant, role and reference guards in boundary order. */
async function insertReservation(
  scope: TenantScope,
  input: CreateReservationInput,
  importedAt: Date | null,
): Promise<Reservation> {
  const values = createReservationInput.parse(input)
  await requireWritableBookingTrip(scope, values.tripId)
  await assertReferences(scope, values.tripId, values)
  return reservationsRepository.insert(scope, { ...values, importedAt })
}

export async function updateReservation(
  scope: TenantScope,
  reservationId: string,
  input: UpdateReservationInput,
): Promise<Reservation> {
  const values = definedOnly(updateReservationInput.parse(input))
  const existing = await requireWritableReservation(scope, reservationId)
  await assertReferences(scope, existing.tripId, values)
  return reservationsRepository.requireUpdate(scope, reservationId, values)
}

export async function setReservationStatus(
  scope: TenantScope,
  reservationId: string,
  status: (typeof RESERVATION_STATUSES)[number],
): Promise<Reservation> {
  await requireWritableReservation(scope, reservationId)
  return reservationsRepository.requireUpdate(scope, reservationId, {
    status: z.enum(RESERVATION_STATUSES).parse(status),
  })
}

/**
 * Removes a booking, releasing any stay made under it first — see
 * {@link unlinkAccommodationsFromReservation} for why the database cannot be made to do it.
 *
 * Not a transaction, because D1 gives this module none: an unlink that succeeds and a delete that
 * fails leaves the booking and its nights, no longer linked, both still visible to the reader.
 */
export async function deleteReservation(
  scope: TenantScope,
  reservationId: string,
): Promise<void> {
  await requireWritableReservation(scope, reservationId)
  await unlinkAccommodationsFromReservation(scope, reservationId)
  await reservationsRepository.requireRemove(scope, reservationId)
}

/* -------------------------------------------------------------------------------------------------
 * The two columns no payload may set
 * ---------------------------------------------------------------------------------------------- */

/**
 * The only way `reservations.expense_id` is ever written.
 *
 * `expenseId` is deliberately absent from {@link reservationFields}, so no client payload can set
 * it: the link is a consequence of the server's own ledger side effect, never a field a caller
 * supplies. Both ends are resolved inside the caller's scope before anything is written — the
 * booking through `requireById`, the expense through `getExpense` — so an id that resolves in
 * another organization does not resolve here at all, and an expense of another *trip* is refused
 * even inside the right tenant.
 *
 * Passing `null` unlinks, which is what a price that was cleared means: the ledger line stays and
 * simply stops saying which booking it came from.
 */
export async function linkReservationExpense(
  scope: TenantScope,
  reservationId: string,
  expenseId: string | null,
): Promise<Reservation> {
  const reservation = await requireWritableReservation(scope, reservationId)

  if (expenseId === null) {
    return reservationsRepository.requireUpdate(scope, reservationId, {
      expenseId: null,
    })
  }

  const id = idSchema.parse(expenseId)
  const expense = await getExpense(scope, id)
  if (expense === null || expense.tripId !== reservation.tripId) {
    throw new NotFoundError('expense', id)
  }
  return reservationsRepository.requireUpdate(scope, reservationId, {
    expenseId: id,
  })
}

/**
 * Unlinks every booking of this tenant that points at one expense, and answers how many.
 *
 * Called by {@link deleteExpense} immediately before the expense row goes, and that ordering is
 * the whole point. `schema.ts` declares the column `on delete: 'set null'`, but drizzle-kit's
 * `ADD COLUMN` emits `REFERENCES` with no `ON DELETE` clause, so what D1 actually enforces is
 * `NO ACTION` — registered in `migrations-match-schema.test.ts`, ADR 0044. Closing that gap in the
 * database would mean either hand-editing a generated migration or rebuilding the table, and
 * `drizzle/` forbids the first. So the rule the schema promises is kept here instead: without
 * this, deleting a priced booking's cost line raises `FOREIGN KEY constraint failed` and the
 * reader gets a 500 where the doc comment promised a quiet unlink.
 *
 * Scoped like every other statement in this file, so an expense id belonging to another
 * organization matches no row rather than clearing one.
 */
export async function unlinkReservationsFromExpense(
  scope: TenantScope,
  expenseId: string,
): Promise<number> {
  const rows = await reservationsRepository.updateWhere(
    scope,
    eq(reservations.expenseId, expenseId),
    { expenseId: null },
  )
  return rows.length
}

/** The most bookings one import writes - the import engine's own ceiling, which the marker write chunks around. */
const IMPORT_BATCH_LIMIT = 500

/**
 * The bound parameters one marker statement carries besides its ids: the import instant, the row's
 * updated-at stamp, the organization and the trip. D1 refuses more than `MAX_BOUND_PARAMETERS`.
 */
const IMPORT_MARKER_FIXED_PARAMETERS = 4

const IMPORT_MARKER_CHUNK =
  MAX_BOUND_PARAMETERS - IMPORT_MARKER_FIXED_PARAMETERS

const importedIdsSchema = z.array(idSchema).min(1).max(IMPORT_BATCH_LIMIT)

/**
 * Marks a batch of one trip's bookings as machine-written and unchecked, returning how many rows it
 * marked.
 *
 * A booking write like any other, so it runs the same layers in the same order
 * ({@link requireWritableBookingTrip}): the trip resolved inside the tenant (`NotFoundError` for a
 * trip that is not the caller's), the archive (`TripArchivedError`), the trip role
 * (`TripRoleError` for a viewer), and only then the write. The batch is bounded to that one trip, so
 * no row of a trip the caller may not write can be marked by being named.
 *
 * The ids are written in chunks of `IMPORT_MARKER_CHUNK`, one statement after another, because a
 * single statement over all `IMPORT_BATCH_LIMIT` of them would exceed D1's bound-parameter limit.
 * The marker write is idempotent, so a failure part way leaves the earlier chunks marked and a
 * later call marks the rest. Each chunk's `where` begins at `tenantFilter()` like every other
 * statement in this file - so an id belonging to another organization, or to another trip, matches
 * no row rather than raising, and the count is the number of rows that were genuinely the caller's
 * to mark, summed over the chunks. That count is the reason this returns a number and not `void`:
 * without it a silent no-op on a foreign id is indistinguishable from success.
 *
 * The clock is read once, so every row of one import carries the same instant across chunks.
 */
export async function markReservationsImported(
  scope: TenantScope,
  tripId: string,
  reservationIds: ReadonlyArray<string>,
): Promise<number> {
  const ids = importedIdsSchema.parse([...reservationIds])
  const trip = await requireWritableBookingTrip(scope, tripId)
  const markedAt = new Date()
  let marked = 0
  for (let start = 0; start < ids.length; start += IMPORT_MARKER_CHUNK) {
    const rows = await reservationsRepository.updateWhere(
      scope,
      allOf(
        eq(reservations.tripId, trip.id),
        inArray(reservations.id, ids.slice(start, start + IMPORT_MARKER_CHUNK)),
      ),
      { importedAt: markedAt },
    )
    marked += rows.length
  }
  return marked
}

/**
 * Clears the import marker - the first time a person opens an imported booking and saves it.
 *
 * Idempotent by construction: clearing a marker that is already null writes null again and returns
 * the row, so the desk never has to ask first. A booking id that is not the caller's is a
 * `NotFoundError` from the same scoped read every other writer here uses, and a viewer is refused
 * before the write like on every other one.
 */
export async function clearReservationImported(
  scope: TenantScope,
  reservationId: string,
): Promise<Reservation> {
  await requireWritableReservation(scope, reservationId)
  return reservationsRepository.requireUpdate(scope, reservationId, {
    importedAt: null,
  })
}
