/**
 * A stay and the booking that pays for it, at the server-function seam.
 *
 * The claims worth testing here are the ones no single repository can make: that the two writes are
 * ordered and compensated, that removing the booking leaves the nights, that a stay's total is never
 * turned into a per-night figure, and that a stay of one trip cannot be written under another's name.
 *
 * The plain functions (`createStay`, `updateStay`, `deleteStay`) are driven rather than the server
 * functions wrapping them, for the reason `reservations.test.ts` gives: outside a Start build a
 * server function discards its answer. Everything else is real — a migrated SQLite database, real
 * repositories, real foreign keys — except one switch that makes the stay's own write fail, which is
 * the only way to reach the compensation without a defect to reach it through.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTrip,
  deleteReservation,
  listTripAccommodations,
  listTripDays,
  listTripExpenses,
  listTripReservations,
} from '#/server/repos'
import { NotFoundError } from '#/server/repos/context'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { Day, Trip } from '#/server/db/types'
import type * as Repos from '#/server/repos'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({ failStayWrite: false }))

/** The one seam: `createAccommodation` refuses when asked to, and is the real one otherwise. */
vi.mock('#/server/repos', async (importOriginal) => {
  const real = await importOriginal<typeof Repos>()
  return {
    ...real,
    createAccommodation: async (
      ...args: Parameters<typeof real.createAccommodation>
    ) => {
      if (stubs.failStayWrite) {
        throw new Error('the stay write failed')
      }
      return real.createAccommodation(...args)
    },
  }
})

/** `./context` imports `cloudflare:workers`; these are the pure helpers and a no-op room. */
vi.mock('../context', () => ({
  appScope: async (): Promise<never> => {
    throw new Error('the plain functions are driven with an explicit scope')
  },
  mirrorToRoom: async (): Promise<void> => undefined,
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
  }),
  tombstone: (kind: string, id: string) => ({
    entity: { kind, id },
    op: 'delete',
    fields: {},
  }),
  orNull: (value: string | undefined): string | null => {
    if (value === undefined) {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  },
}))

const { createStay, deleteStay, updateStay } = await import('../stay-writes')
const { bookingDeskPayload } = await import('../reservations')

/* -------------------------------------------------------------------- setup */

let scope: TenantScope
let trip: Trip
let days: Array<Day>

/** A day of the trip by its number, so a case reads as "day 1 to day 4". */
function day(n: number): Day {
  const found = days.find((row) => row.dayNumber === n)
  if (found === undefined) {
    throw new Error(`The trip has no day ${n}.`)
  }
  return found
}

function stayPayload(overrides: Record<string, unknown> = {}) {
  return {
    tripId: trip.id,
    status: 'confirmed' as const,
    title: 'Hotel Gracery Shinjuku',
    provider: '',
    location: 'Kabukicho 1-19-1',
    confirmationNumber: 'GR-4821',
    url: '',
    guests: 2,
    priceMinor: 0,
    currency: '',
    notes: '',
    startDayId: day(1).id,
    endDayId: day(4).id,
    checkInTime: '15:00',
    checkInEndTime: '22:00',
    checkOutTime: '11:00',
    ...overrides,
  }
}

beforeEach(async () => {
  stubs.failStayWrite = false
  const harness = await createHarness()
  scope = (await harness.seedTenant('stays')).scope
  trip = await createTrip(scope, {
    title: 'Tokyo in spring',
    startDate: '2026-04-10',
    endDate: '2026-04-14',
    currency: 'JPY',
  })
  days = await listTripDays(scope, trip.id)
})

/* -------------------------------------------------------------------- cases */

describe('a stay and the booking that pays for it', () => {
  it('writes the booking and the stay as one action, linked and dated by their days', async () => {
    const result = await createStay(scope, stayPayload())

    const [booking] = await listTripReservations(scope, { tripId: trip.id })
    const [stay] = await listTripAccommodations(scope, trip.id)
    expect(booking.id).toBe(result.reservationId)
    expect(stay.id).toBe(result.stayId)
    expect(stay.reservationId).toBe(booking.id)
    expect(booking).toMatchObject({
      type: 'accommodation',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      startTime: '15:00',
      endTime: '11:00',
      dayId: day(1).id,
      endDayId: day(4).id,
    })
    expect(stay).toMatchObject({
      startDayId: day(1).id,
      endDayId: day(4).id,
      checkInTime: '15:00',
      checkInEndTime: '22:00',
      checkOutTime: '11:00',
    })

    const desk = await bookingDeskPayload(scope, trip.id)
    expect(desk.bookings[0]?.stay).toMatchObject({
      id: result.stayId,
      startDayId: day(1).id,
      endDayId: day(4).id,
    })
  })

  it('deletes the booking again when the stay write fails, leaving no orphan and no cost', async () => {
    stubs.failStayWrite = true

    const error = await captureError(() =>
      createStay(scope, stayPayload({ priceMinor: 42_000, currency: 'JPY' })),
    )

    expect(error.message).toBe('the stay write failed')
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
    expect(await listTripAccommodations(scope, trip.id)).toEqual([])
    expect(await listTripExpenses(scope, trip.id)).toEqual([])
  })

  it('refuses a stay that ends before it starts before anything is written', async () => {
    const error = await captureError(() =>
      createStay(
        scope,
        stayPayload({ startDayId: day(3).id, endDayId: day(2).id }),
      ),
    )

    expect(error.message).toMatch(/ends before it starts/u)
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
  })

  it('refuses inverted times before anything is written', async () => {
    for (const times of [
      { checkInTime: '15:00', checkInEndTime: '14:00' },
      {
        endDayId: day(1).id,
        checkInTime: '15:00',
        checkOutTime: '11:00',
      },
    ]) {
      const error = await captureError(() =>
        createStay(scope, stayPayload(times)),
      )
      expect(error.message).toMatch(/before/u)
    }
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
  })

  it('keeps the total on the booking and divides it by nothing', async () => {
    await createStay(
      scope,
      stayPayload({ priceMinor: 42_000, currency: 'JPY' }),
    )

    const [booking] = await listTripReservations(scope, { tripId: trip.id })
    const [stay] = await listTripAccommodations(scope, trip.id)
    const [expense] = await listTripExpenses(scope, trip.id)
    // Three nights and a total of 42 000: no figure of 14 000 exists anywhere.
    expect(booking.priceMinor).toBe(42_000)
    expect(stay.priceMinor).toBeNull()
    expect(expense.amountMinor).toBe(42_000)
  })

  it('leaves the nights when only the booking is deleted, and clears the link', async () => {
    const result = await createStay(scope, stayPayload())

    await deleteReservation(scope, result.reservationId)

    const [stay] = await listTripAccommodations(scope, trip.id)
    expect(stay.id).toBe(result.stayId)
    expect(stay.reservationId).toBeNull()
    expect(stay.startDayId).toBe(day(1).id)
  })

  it('removes both when the reader removes the stay with its booking', async () => {
    const result = await createStay(scope, stayPayload())

    await deleteStay(scope, {
      tripId: trip.id,
      reservationId: result.reservationId,
      stayId: result.stayId,
    })

    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
    expect(await listTripAccommodations(scope, trip.id)).toEqual([])
  })

  it('updates both halves, and moves the booking’s dates with the days', async () => {
    const result = await createStay(scope, stayPayload())

    await updateStay(scope, {
      ...stayPayload({ endDayId: day(2).id, title: 'Two nights fewer' }),
      reservationId: result.reservationId,
      stayId: result.stayId,
    })

    const [booking] = await listTripReservations(scope, { tripId: trip.id })
    const [stay] = await listTripAccommodations(scope, trip.id)
    expect(booking).toMatchObject({
      title: 'Two nights fewer',
      endDate: '2026-04-11',
    })
    expect(stay).toMatchObject({
      name: 'Two nights fewer',
      endDayId: day(2).id,
    })
  })

  it('refuses to write a stay of one trip under another trip’s name', async () => {
    const result = await createStay(scope, stayPayload())
    const other = await createTrip(scope, {
      title: 'Kyoto in autumn',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      currency: 'JPY',
    })
    const ids = {
      tripId: other.id,
      reservationId: result.reservationId,
      stayId: result.stayId,
    }

    expect(
      await captureError(() => updateStay(scope, { ...stayPayload(), ...ids })),
    ).toBeInstanceOf(NotFoundError)
    expect(await captureError(() => deleteStay(scope, ids))).toBeInstanceOf(
      NotFoundError,
    )
    expect(await listTripAccommodations(scope, trip.id)).toHaveLength(1)
  })
})

/**
 * The same two deletes on the database D1 is actually running. `reservation_id` arrived by
 * `ADD COLUMN`, so what D1 enforces is `NO ACTION`, not the `set null` `schema.ts` declares
 * (`accommodation-schema.test.ts` pins both halves); on the default harness these cases would pass
 * whether or not the link is cleared before the booking goes.
 */
describe('on the migrated database', () => {
  beforeEach(async () => {
    const harness = await createHarness({ ddl: 'migrations' })
    scope = (await harness.seedTenant('stays-migrated')).scope
    trip = await createTrip(scope, {
      title: 'Tokyo in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-14',
      currency: 'JPY',
    })
    days = await listTripDays(scope, trip.id)
  })

  it('deletes only the booking and keeps the nights, unlinked', async () => {
    const result = await createStay(scope, stayPayload())

    await deleteReservation(scope, result.reservationId)

    const [stay] = await listTripAccommodations(scope, trip.id)
    expect(stay.id).toBe(result.stayId)
    expect(stay.reservationId).toBeNull()
  })

  it('removes the stay with its booking', async () => {
    const result = await createStay(scope, stayPayload())

    await deleteStay(scope, {
      tripId: trip.id,
      reservationId: result.reservationId,
      stayId: result.stayId,
    })

    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
    expect(await listTripAccommodations(scope, trip.id)).toEqual([])
  })
})
