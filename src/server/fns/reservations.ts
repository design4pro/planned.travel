/**
 * Write paths for the trip's bookings.
 *
 * A booking is one row with a type discriminator, so a single validated payload
 * covers a flight, a stay, a table and a museum ticket; the type only decides
 * which fields the *form* shows. `assertReferences` inside the repository is what
 * guarantees an attached day belongs to the same trip inside the same tenant.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import { RESERVATION_STATUSES, RESERVATION_TYPES } from '#/server/db/schema'
import { createLogger, serializeError } from '#/server/observability'
import {
  canWritePlan,
  clearReservationImported,
  countTripReservationsByStatus,
  createExpense,
  createReservation,
  deleteReservation,
  getDay,
  getTripItinerary,
  linkReservationExpense,
  listTripReservations,
  repriceExpense,
  requireReservationOfTrip,
  requireTrip,
  requireWritableTrip,
  setReservationStatus,
  totalTripReservationsMinor,
  tripRoleFor,
  updateReservation,
} from '#/server/repos'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

import type { EXPENSE_CATEGORIES } from '#/server/db/schema'
import type { Logger } from '#/server/observability'
import type { Reservation, Trip } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ inputs */

const tripId = z.string().trim().min(1).max(64)
const rowId = z.string().trim().min(1).max(64)

/** `''` is "not set" for every optional text field a form can produce. */
const optionalText = z.string().trim().max(200)
const optionalNotes = z.string().trim().max(4000)
const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'must be an ISO calendar date (YYYY-MM-DD)',
  )
const optionalTime = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),
    'must be a 24-hour time (HH:MM)',
  )
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => value === '' || /^https?:\/\/\S+$/.test(value),
    'must be an http(s) URL',
  )

const bookingFields = {
  type: z.enum(RESERVATION_TYPES),
  status: z.enum(RESERVATION_STATUSES),
  title: z.string().trim().min(1).max(160),
  provider: optionalText,
  location: optionalText,
  confirmationNumber: optionalText,
  url: optionalUrl,
  startDate: optionalDate,
  startTime: optionalTime,
  endDate: optionalDate,
  endTime: optionalTime,
  /** `0` means "not recorded" for both of these. */
  guests: z.number().int().min(0).max(1000),
  priceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^[A-Z]{3}$/.test(value),
      'must be an ISO-4217 alphabetic code',
    ),
  /** `''` leaves the booking off the itinerary. */
  dayId: z.string().trim().max(64),
  /**
   * The stop on a day this booking is for — `''` for none.
   *
   * Declared on both write validators, never on one: these are `z.object`s, and an object schema
   * strips a key it has not been told about. A stop the screen chooses and a validator has never
   * heard of is a column written null with every unit test still green.
   */
  assignmentId: z.string().trim().max(64),
  notes: optionalNotes,
}

export const bookingInputSchema = z.object({ tripId, ...bookingFields })
export const bookingUpdateSchema = z.object({
  tripId,
  reservationId: rowId,
  ...bookingFields,
})

export type BookingInput = z.infer<typeof bookingInputSchema>

/**
 * A booking whose end is before its start is a typo, not a booking. Checked here
 * as well as in the form so the rule cannot be bypassed by calling the function
 * directly.
 */
function assertOrder(data: {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}): void {
  if (data.startDate === '' || data.endDate === '') {
    return
  }
  const from = `${data.startDate}T${data.startTime === '' ? '00:00' : data.startTime}`
  const to = `${data.endDate}T${data.endTime === '' ? '23:59' : data.endTime}`
  if (to < from) {
    throw new Error('The booking ends before it starts. Check the dates.')
  }
}

function payload(data: BookingInput) {
  return {
    type: data.type,
    status: data.status,
    title: data.title,
    provider: orNull(data.provider),
    location: orNull(data.location),
    confirmationNumber: orNull(data.confirmationNumber),
    url: orNull(data.url),
    startDate: orNull(data.startDate),
    startTime: orNull(data.startTime),
    endDate: orNull(data.endDate),
    endTime: orNull(data.endTime),
    guests: data.guests === 0 ? null : data.guests,
    priceMinor: data.priceMinor === 0 ? null : data.priceMinor,
    currency: orNull(data.currency),
    dayId: orNull(data.dayId),
    assignmentId: orNull(data.assignmentId),
    notes: orNull(data.notes),
  }
}

/**
 * What the audit entry says about a booking.
 *
 * Deliberately the four fields that identify it on a screen — the trail is read by a human deciding
 * whether a change was expected, and `type`, `status` and `title` are what makes "a reservation was
 * updated" answerable without opening the row. The confirmation number and the price stay out: an
 * audit entry outlives the booking, is visible to every admin, and a payment reference is not
 * something a retention window of 400 days should be holding a second copy of.
 */
function auditMetadata(
  data: Pick<BookingInput, 'tripId' | 'type' | 'status' | 'title'>,
) {
  return {
    tripId: data.tripId,
    type: data.type,
    status: data.status,
    title: data.title,
  }
}

/* ------------------------------------------------------------------ ledger */

/**
 * Memoised per isolate, and built without `env` for the reason `src/server/audit/trail.ts` gives:
 * this module is imported by the `server` Vitest project, where `cloudflare:workers` does not
 * resolve, and the only line emitted here is a `warn`.
 */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'booking-ledger' } })
  return logger
}

/**
 * The cost category each kind of booking implies.
 *
 * A **default**, not a fixed mapping: `updateExpense` already accepts a category, so recategorising
 * a line afterwards needs no new work here and no picker anywhere. Written as a mapped type over
 * `RESERVATION_TYPES`, so a type added later is a compile error rather than a silent `other`, and
 * every value is inside `EXPENSE_CATEGORIES`, which the column's own `CHECK` enforces anyway.
 */
const BOOKING_EXPENSE_CATEGORY: {
  readonly [
    K in (typeof RESERVATION_TYPES)[number]
  ]: (typeof EXPENSE_CATEGORIES)[number]
} = {
  accommodation: 'accommodation',
  restaurant: 'food',
  activity: 'activities',
  tour: 'activities',
  ticket: 'activities',
  transport: 'transport',
  other: 'other',
}

/** `reservations.type` is a `text` column, so the row is read back as a string. */
function categoryFor(type: string): (typeof EXPENSE_CATEGORIES)[number] {
  return (RESERVATION_TYPES as ReadonlyArray<string>).includes(type)
    ? BOOKING_EXPENSE_CATEGORY[type as (typeof RESERVATION_TYPES)[number]]
    : 'other'
}

/**
 * What became of a booking's cost line, reported back to the screen that saved it.
 *
 * `failed` is the one the dialog acts on: the booking is saved and the ledger is not, which is a
 * partial success rather than an error, and the reader is told exactly which half did not happen.
 *
 * `split-stale` is the other half-done answer: the line's new amount is saved, but its shares could
 * not follow it (an `exact` split, or weights the split arithmetic refuses), so they no longer add
 * up to the total and the reader is told to fix the split on Costs.
 */
export type LedgerOutcome =
  | 'created'
  | 'updated'
  | 'split-stale'
  | 'unlinked'
  | 'undated'
  | 'kept'
  | 'none'
  | 'failed'

export interface LedgerSubject {
  /** The row as it now stands — read back from the write, never from the request. */
  readonly reservation: Reservation
  /** The trip, for the last fallback of both the currency and the date. */
  readonly trip: Trip
  /** True when the booking is on its way out, so nothing may be written against it. */
  readonly discarded?: boolean
}

/**
 * The date a booking's cost line is spent on: the booking's own start date, then the date of the
 * day it is pinned to, then the trip's start date.
 *
 * All three are nullable, and when every one of them is null the answer is `null` and no line is
 * written at all. A guessed date on a money row is worse than no row.
 */
async function spentOnFor(
  scope: TenantScope,
  reservation: Reservation,
  trip: Trip,
): Promise<string | null> {
  if (reservation.startDate !== null) {
    return reservation.startDate
  }
  if (reservation.dayId !== null) {
    const day = await getDay(scope, reservation.dayId)
    if (day !== null && day.date !== null) {
      return day.date
    }
  }
  return trip.startDate
}

/**
 * The single place a booking's price meets the trip's ledger.
 *
 * It lives beside the server functions rather than inside `reservationsRepository` for a measured
 * reason: the development seeder (`src/routes/api/dev/-seed/apply-trip.ts`) writes reservations
 * straight through the repository, and a repository-level hook would make the seeded trip carry
 * costs nobody entered. One helper, called by every write path that can change a price, is what
 * keeps the four branches from drifting apart across those call sites.
 *
 * `reservation.expenseId` is the idempotency key for every branch, and it is read off the row that
 * was just written rather than off the request — which is what makes the third save of the same
 * booking an update rather than a fourth ledger line.
 *
 * Nothing here can fail the save. D1 has already committed the booking by the time this runs, so a
 * refused ledger write is logged and reported as `failed`; turning it into a thrown error would
 * invite a retry that produces a second booking.
 */
export async function syncReservationExpense(
  scope: TenantScope,
  subject: LedgerSubject,
): Promise<LedgerOutcome> {
  const { reservation, trip } = subject
  try {
    if (subject.discarded === true) {
      /*
       * Deleting a booking deletes no cost line, for the same reason clearing a price does not:
       * the line may have been split with three other people, and destroying their record because
       * somebody tidied a booking is not a tidy-up. The link goes with the row; the ledger keeps a
       * line that no longer says which booking it came from, which is what the reader would have
       * had if they had typed it by hand.
       *
       * This branch writes nothing, and it is a branch rather than a missing call so that the
       * policy is stated once, in the function that owns it, instead of being an omission spread
       * across three call sites.
       */
      return reservation.expenseId === null ? 'none' : 'kept'
    }

    const amountMinor = reservation.priceMinor ?? 0
    if (amountMinor <= 0) {
      if (reservation.expenseId === null) {
        return 'none'
      }
      await linkReservationExpense(scope, reservation.id, null)
      return 'unlinked'
    }

    // No arithmetic: `price_minor` is assigned to `amount_minor` as one integer to another, so the
    // booking and its cost line cannot disagree by a cent. A booking priced in yen produces a
    // ledger line in yen; converting it to the trip's accounting currency is another stage's.
    const currency = reservation.currency ?? trip.currency

    if (reservation.expenseId !== null) {
      const { splitStale } = await repriceExpense(
        scope,
        reservation.tripId,
        reservation.expenseId,
        { title: reservation.title, amountMinor, currency },
      )
      if (!splitStale) {
        return 'updated'
      }
      log().info('booking price change left its cost-line split stale', {
        reservationId: reservation.id,
        tripId: reservation.tripId,
        organizationId: scope.ctx.organizationId,
      })
      return 'split-stale'
    }

    const spentOn = await spentOnFor(scope, reservation, trip)
    if (spentOn === null) {
      return 'undated'
    }

    const { expense } = await createExpense(scope, {
      tripId: reservation.tripId,
      title: reservation.title,
      amountMinor,
      currency,
      category: categoryFor(reservation.type),
      dayId: reservation.dayId,
      placeId: reservation.placeId,
      spentOn,
    })
    // Two writes, and the second is what makes the next save an update rather than a second line.
    await linkReservationExpense(scope, reservation.id, expense.id)
    return 'created'
  } catch (cause) {
    log().warn('booking ledger sync failed', {
      reservationId: reservation.id,
      tripId: reservation.tripId,
      organizationId: scope.ctx.organizationId,
      ...serializeError(cause),
    })
    return 'failed'
  }
}

/* ------------------------------------------------------------------ writes */

/**
 * What became of a booking's import marker when the booking was saved.
 *
 * `cleared` on every successful save, whether or not there was a marker to
 * clear: the writer is idempotent, and a second read to avoid a null-to-null
 * write would cost more than the write while leaving a race in which a marker
 * survives a save — the one failure the reader would notice.
 *
 * `failed` is the partial success. D1 has already committed the booking by the
 * time this runs, so a refused clear is reported rather than thrown: turning it
 * into an error would invite a retry that produces a second booking.
 */
export type MarkerOutcome = 'cleared' | 'failed'

/** What a booking write answers with: the row, what the ledger did, and what the marker did. */
export interface BookingWriteResult {
  readonly reservationId: string
  readonly ledger: LedgerOutcome
  /** Only a save can clear a marker, so only the update path reports one. */
  readonly marker?: MarkerOutcome
}

/**
 * Reviewing an imported booking *is* saving it, and not a second chore after it.
 *
 * Called after the update has succeeded and inside the same handler, so the act
 * a reader takes — open it, check it, save it — is the act that takes the
 * "nobody has looked at this" marker off the card.
 */
async function clearImportMarker(
  scope: TenantScope,
  reservationId: string,
): Promise<MarkerOutcome> {
  try {
    await clearReservationImported(scope, reservationId)
    return 'cleared'
  } catch (cause) {
    log().warn('booking import marker not cleared', {
      reservationId,
      organizationId: scope.ctx.organizationId,
      ...serializeError(cause),
    })
    return 'failed'
  }
}

export const createBookingFn = createServerFn({ method: 'POST' })
  .validator(bookingInputSchema)
  .handler(async ({ data }): Promise<BookingWriteResult> => {
    const scope = await appScope()
    const trip = await requireWritableTrip(scope, data.tripId)
    assertOrder(data)

    const reservation = await createReservation(scope, {
      tripId: data.tripId,
      ...payload(data),
    })
    const ledger = await syncReservationExpense(scope, { reservation, trip })

    await mirrorToRoom(scope, data.tripId, [
      patch('reservation', reservation.id, {
        title: data.title,
        status: data.status,
        startDate: orNull(data.startDate),
      }),
    ])

    await trail(scope, {
      action: AUDIT_ACTIONS.RESERVATION_CREATED,
      entityType: 'reservation',
      entityId: reservation.id,
      metadata: auditMetadata(data),
    })
    return { reservationId: reservation.id, ledger }
  })

export const updateBookingFn = createServerFn({ method: 'POST' })
  .validator(bookingUpdateSchema)
  .handler(async ({ data }): Promise<BookingWriteResult> => {
    const scope = await appScope()
    const trip = await requireWritableTrip(scope, data.tripId)
    // Everything below acts on `data.tripId` — the room, the trail, the ledger — so the booking
    // must be one of that trip's, not merely one the caller may edit.
    await requireReservationOfTrip(scope, data.tripId, data.reservationId)
    assertOrder(data)

    const reservation = await updateReservation(
      scope,
      data.reservationId,
      payload(data),
    )
    const ledger = await syncReservationExpense(scope, { reservation, trip })
    const marker = await clearImportMarker(scope, reservation.id)

    await mirrorToRoom(scope, data.tripId, [
      patch('reservation', data.reservationId, {
        title: data.title,
        status: data.status,
        startDate: orNull(data.startDate),
      }),
    ])

    await trail(scope, {
      action: AUDIT_ACTIONS.RESERVATION_UPDATED,
      entityType: 'reservation',
      entityId: data.reservationId,
      metadata: auditMetadata(data),
    })
    return { reservationId: data.reservationId, ledger, marker }
  })

/**
 * Moves a booking through its lifecycle without opening the dialog: the status
 * pill on the card is the control, so confirming five bookings is five clicks
 * rather than five dialogs.
 */
export const setBookingStatusFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      reservationId: rowId,
      status: z.enum(RESERVATION_STATUSES),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly status: string }> => {
    const scope = await appScope()
    await requireWritableTrip(scope, data.tripId)
    await requireReservationOfTrip(scope, data.tripId, data.reservationId)
    await setReservationStatus(scope, data.reservationId, data.status)

    await mirrorToRoom(scope, data.tripId, [
      patch('reservation', data.reservationId, { status: data.status }),
    ])

    // The same action key as the dialog's save, because it is the same event: a booking changed.
    // The status pill is a second control on one write path, not a second concept — five clicks
    // through the pill and five trips through the dialog must read alike on `/admin`.
    await trail(scope, {
      action: AUDIT_ACTIONS.RESERVATION_UPDATED,
      entityType: 'reservation',
      entityId: data.reservationId,
      metadata: { tripId: data.tripId, status: data.status },
    })
    return { status: data.status }
  })

export const deleteBookingFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, reservationId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    const trip = await requireWritableTrip(scope, data.tripId)

    // Read before the delete, because the row is what says whether it had a cost line — and the
    // decision about that line belongs in one function, not in an `if` here.
    const reservation = await requireReservationOfTrip(
      scope,
      data.tripId,
      data.reservationId,
    )
    await syncReservationExpense(scope, {
      reservation,
      trip,
      discarded: true,
    })
    await deleteReservation(scope, data.reservationId)

    await mirrorToRoom(scope, data.tripId, [
      tombstone('reservation', data.reservationId),
    ])

    await trail(scope, {
      action: AUDIT_ACTIONS.RESERVATION_DELETED,
      entityType: 'reservation',
      entityId: data.reservationId,
      metadata: { tripId: data.tripId },
    })
    return { deleted: true }
  })

/* -------------------------------------------------------------------- read */

export interface BookingRow {
  readonly id: string
  readonly type: string
  readonly status: string
  readonly title: string
  readonly provider: string | null
  readonly location: string | null
  readonly confirmationNumber: string | null
  readonly url: string | null
  readonly startDate: string | null
  readonly startTime: string | null
  readonly endDate: string | null
  readonly endTime: string | null
  readonly guests: number | null
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly notes: string | null
  /** The itinerary day this booking is pinned to, if any. */
  readonly dayId: string | null
  /** The stop on that day this booking is for, if any. */
  readonly assignmentId: string | null
  /**
   * Whether this booking already has a line in the trip's ledger.
   *
   * A boolean and not the id: the link is the server's own statement about its own side effect, so
   * the screen is told *that* there is a line — which is all four sentences of the notice need —
   * without being handed a handle it could send back.
   */
  readonly hasLedgerLine: boolean
  /**
   * When a machine wrote this booking and no person has looked at it since.
   *
   * An ISO instant rather than a `Date`, because this crosses the wire; `null`
   * is both "typed by a person" and "already reviewed", which is the same thing
   * as far as the desk is concerned — there is nothing left to check.
   */
  readonly importedAt: string | null
  /**
   * The journey this booking is for, when it is a booking *of* one.
   *
   * A booking of the transport kind is not duplicated into the transports tab:
   * the desk lists `reservations` and that tab lists `transports`, and this is
   * the quiet link between the two so a reader can walk from one to the other in
   * a click without either list claiming to own the other's record.
   */
  readonly transportId: string | null
  /** The nights this booking pays for, when it is a stay's booking. */
  readonly stay: BookingStay | null
}

/**
 * The stay half of a stay's booking: which days it covers and when the reader arrives and leaves.
 *
 * Day ids rather than dates or a night count — the screen already holds the trip's days, and the
 * nights are derived from their numbers in one place (`stayNights`), never sent twice.
 */
export interface BookingStay {
  readonly id: string
  readonly startDayId: string
  readonly endDayId: string
  readonly checkInTime: string | null
  readonly checkInEndTime: string | null
  readonly checkOutTime: string | null
}

/** One planned stop, offered under the day it sits on. */
export interface BookingStopOption {
  readonly assignmentId: string
  readonly placeName: string
  readonly startTime: string | null
}

export interface BookingDayOption {
  readonly id: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
  /**
   * The stops planned on this day.
   *
   * Nested under the day rather than sent as a flat list beside it, because the day list is what
   * the route already hands the timeline and the timeline already hands the dialog: a stop that
   * travels inside the day it belongs to reaches the picker without a single edit to either file,
   * and the grouping the picker renders is then a property of the payload rather than a join the
   * screen has to make.
   */
  readonly stops: ReadonlyArray<BookingStopOption>
}

export interface BookingDeskPayload {
  readonly currency: string
  /**
   * Whether this reader may change the desk: `canWritePlan`, the one answer the plan and its notes
   * give, so an archived trip draws no write control for an owner or an editor either.
   */
  readonly canWrite: boolean
  /** The reason a writer is refused, for the notice: an archived trip says to restore it. */
  readonly archived: boolean
  readonly bookings: ReadonlyArray<BookingRow>
  readonly days: ReadonlyArray<BookingDayOption>
  readonly byStatus: ReadonlyArray<{
    readonly status: string
    readonly value: number
  }>
  readonly committedMinor: number
}

/**
 * Everything the bookings screen reads.
 *
 * Distinct from the read-only bookings loader because an editable screen needs
 * two things that one does not: the `day_id` each booking is pinned to, and the
 * trip's days to pin it to — a dialog cannot offer "attach to a day" without the
 * list of days.
 */
export const loadBookingDeskFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId }))
  .handler(async ({ data }): Promise<BookingDeskPayload> =>
    bookingDeskPayload(await appScope(), data.tripId),
  )

/**
 * What {@link loadBookingDeskFn} answers, as a plain function.
 *
 * Split out because a server function's return value only survives across a Start build's RPC
 * pair — outside one the handler runs and its answer is discarded — so this is the half a test can
 * hold. `fns/atlas.ts` makes the same split, for the same reason.
 */
export async function bookingDeskPayload(
  scope: TenantScope,
  requestedTripId: string,
): Promise<BookingDeskPayload> {
  const trip = await requireTrip(scope, requestedTripId)

  const [role, rows, itinerary, byStatus, committedMinor] = await Promise.all([
    tripRoleFor(scope, trip.id, scope.ctx.userId),
    listTripReservations(scope, { tripId: trip.id }),
    // The itinerary rather than the day list: an editable screen needs the stops as well as the
    // days, and this read already assembles both in one pass. No repository function is added to
    // `itinerary.ts`, which this change does not own.
    getTripItinerary(scope, trip.id),
    countTripReservationsByStatus(scope, trip.id),
    totalTripReservationsMinor(scope, trip.id),
  ])

  // Every stay appears under each day it covers, so the itinerary is de-duplicated by booking.
  const stays = new Map<string, BookingStay>()
  for (const { accommodations } of itinerary) {
    for (const stay of accommodations) {
      if (stay.reservationId !== null) {
        stays.set(stay.reservationId, {
          id: stay.id,
          startDayId: stay.startDayId,
          endDayId: stay.endDayId,
          checkInTime: stay.checkInTime,
          checkInEndTime: stay.checkInEndTime,
          checkOutTime: stay.checkOutTime,
        })
      }
    }
  }

  return {
    currency: trip.currency,
    canWrite: canWritePlan(trip, role),
    archived: trip.isArchived,
    byStatus,
    committedMinor,
    days: itinerary.map(({ day, stops }) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date,
      title: day.title,
      stops: stops.map((stop) => ({
        assignmentId: stop.assignment.id,
        placeName: stop.place.name,
        startTime: stop.assignment.startTime,
      })),
    })),
    bookings: rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      title: row.title,
      provider: row.provider,
      location: row.location,
      confirmationNumber: row.confirmationNumber,
      url: row.url,
      startDate: row.startDate,
      startTime: row.startTime,
      endDate: row.endDate,
      endTime: row.endTime,
      guests: row.guests,
      priceMinor: row.priceMinor,
      currency: row.currency,
      notes: row.notes,
      dayId: row.dayId,
      assignmentId: row.assignmentId,
      hasLedgerLine: row.expenseId !== null,
      importedAt: row.importedAt?.toISOString() ?? null,
      transportId: row.transportId,
      stay: stays.get(row.id) ?? null,
    })),
  }
}
