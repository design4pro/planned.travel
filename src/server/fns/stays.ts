/**
 * Write paths for a stay: the nights on the trip's days, and the booking that pays for them.
 *
 * A stay is one action to the reader and two rows in the database — the `reservations` row carries
 * the confirmation code, the status and the price; the `day_accommodations` row carries the run of
 * days and the times, linked to the booking through `reservation_id`. The two writes go through two
 * repositories, so they cannot share a D1 batch, and every function here states the order it writes
 * them in and what it does when the second one fails.
 *
 * Each server function is a thin wrapper over a plain function of the same name without `Fn`, kept in
 * `stay-writes.ts`. Outside a Start build a server function runs its handler and discards the answer,
 * so the plain function is the half a test can hold — `fns/reservations.ts` makes the same split for
 * the desk payload.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { appScope } from './context'
import { bookingInputSchema } from './reservations'
import { createStay, deleteStay, updateStay } from './stay-writes'

import type { LedgerOutcome } from './reservations'

/* ------------------------------------------------------------------ inputs */

const rowId = z.string().trim().min(1).max(64)
const booking = bookingInputSchema.shape

/**
 * The booking's own fields, taken from the booking validator rather than restated, so a stay's
 * booking and any other booking cannot disagree about what a title or a currency may be. The dates
 * are absent on purpose: a stay's dates are the dates of its days, never typed.
 */
const stayFields = {
  tripId: booking.tripId,
  status: booking.status,
  title: booking.title,
  provider: booking.provider,
  location: booking.location,
  confirmationNumber: booking.confirmationNumber,
  url: booking.url,
  guests: booking.guests,
  priceMinor: booking.priceMinor,
  currency: booking.currency,
  notes: booking.notes,
  /** The day the reader checks in on, and the day they check out on. */
  startDayId: rowId,
  endDayId: rowId,
  checkInTime: booking.startTime,
  /** The end of the check-in window; `''` when the property states none. */
  checkInEndTime: booking.startTime,
  checkOutTime: booking.endTime,
}

export const stayInputSchema = z.object(stayFields)
export const stayUpdateSchema = z.object({
  ...stayFields,
  reservationId: rowId,
  stayId: rowId,
})
export const stayDeleteSchema = z.object({
  tripId: booking.tripId,
  reservationId: rowId,
  stayId: rowId,
})

export type StayInput = z.infer<typeof stayInputSchema>
export type StayUpdate = z.infer<typeof stayUpdateSchema>
export type StayDelete = z.infer<typeof stayDeleteSchema>

/** What a stay write answers with: both rows, and what the booking's ledger line did. */
export interface StayWriteResult {
  readonly reservationId: string
  readonly stayId: string
  readonly ledger: LedgerOutcome
}

export const createStayFn = createServerFn({ method: 'POST' })
  .validator(stayInputSchema)
  .handler(async ({ data }): Promise<StayWriteResult> =>
    createStay(await appScope(), data),
  )

export const updateStayFn = createServerFn({ method: 'POST' })
  .validator(stayUpdateSchema)
  .handler(async ({ data }): Promise<StayWriteResult> =>
    updateStay(await appScope(), data),
  )

export const deleteStayFn = createServerFn({ method: 'POST' })
  .validator(stayDeleteSchema)
  .handler(async ({ data }): Promise<{ readonly deleted: true }> =>
    deleteStay(await appScope(), data),
  )
