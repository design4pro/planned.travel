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
  CurrencyRefusalError,
  TripArchivedError,
  addTripMember,
  archiveTrip,
  createTrip,
  deleteReservation,
  listTripAccommodations,
  listTripDays,
  listTripExpenses,
  listTripReservations,
  restoreTrip,
} from '#/server/repos'
import { NotFoundError } from '#/server/repos/context'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { SeededTenant } from '#/server/repos/__tests__/harness'
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
const { stayInputSchema, stayUpdateSchema } = await import('../stays')
const { bookingDeskPayload } = await import('../reservations')

/* -------------------------------------------------------------------- setup */

let scope: TenantScope
let tenantOf: SeededTenant
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
  tenantOf = await harness.seedTenant('stays')
  scope = tenantOf.scope
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

  it('reports the booking’s cost line as a name and as the two flags the dialog reads', async () => {
    const free = await createStay(scope, stayPayload())
    expect(free).toMatchObject({
      ledger: 'none',
      ledgerFailed: false,
      ledgerSplitStale: false,
    })

    const priced = await createStay(
      scope,
      stayPayload({ priceMinor: 42_000, currency: 'JPY' }),
    )
    expect(priced).toMatchObject({
      ledger: 'created',
      ledgerFailed: false,
      ledgerSplitStale: false,
    })

    const repriced = await updateStay(scope, {
      ...stayPayload({ priceMinor: 50_000, currency: 'JPY' }),
      reservationId: priced.reservationId,
      stayId: priced.stayId,
    })
    expect(repriced).toMatchObject({
      ledger: 'updated',
      ledgerFailed: false,
      ledgerSplitStale: false,
    })
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

  it('refuses all three writes on an archived trip, before a booking exists, and writes again once it is restored', async () => {
    const written = await createStay(scope, stayPayload())
    await archiveTrip(scope, trip.id)
    const ids = {
      tripId: trip.id,
      reservationId: written.reservationId,
      stayId: written.stayId,
    }
    const before = {
      bookings: await listTripReservations(scope, { tripId: trip.id }),
      stays: await listTripAccommodations(scope, trip.id),
      lines: await listTripExpenses(scope, trip.id),
    }

    const refused = [
      await captureError(() =>
        createStay(
          scope,
          stayPayload({ title: 'Late hostel', priceMinor: 9_000 }),
        ),
      ),
      await captureError(() => updateStay(scope, { ...stayPayload(), ...ids })),
      await captureError(() => deleteStay(scope, ids)),
    ]

    for (const error of refused) {
      expect(error).toBeInstanceOf(TripArchivedError)
    }
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual(
      before.bookings,
    )
    expect(await listTripAccommodations(scope, trip.id)).toEqual(before.stays)
    expect(await listTripExpenses(scope, trip.id)).toEqual(before.lines)

    await restoreTrip(scope, trip.id)
    await expect(
      updateStay(scope, { ...stayPayload({ title: 'Back again' }), ...ids }),
    ).resolves.toMatchObject({ stayId: written.stayId })
  })

  it('refuses an editor on an archived trip the same way, and a viewer too', async () => {
    const harness = await createHarness()
    const tenant = await harness.seedTenant('stays-roles')
    const owner = tenant.scope
    const shared = await createTrip(owner, {
      title: 'Osaka',
      startDate: '2026-04-10',
      endDate: '2026-04-14',
      currency: 'JPY',
    })
    const [first, , , last] = await listTripDays(owner, shared.id)
    const editorId = await tenant.addUser('An editor')
    const viewerId = await tenant.addUser('A viewer')
    for (const [userId, role] of [
      [editorId, 'editor'],
      [viewerId, 'viewer'],
    ] as const) {
      await addTripMember(owner, { tripId: shared.id, userId, role })
    }
    await archiveTrip(owner, shared.id)
    const payload = {
      ...stayPayload(),
      tripId: shared.id,
      startDayId: first?.id ?? '',
      endDayId: last?.id ?? '',
    }

    for (const actor of [
      tenant.scopeFor(editorId),
      tenant.scopeFor(viewerId),
    ]) {
      expect(
        await captureError(() => createStay(actor, payload)),
      ).toBeInstanceOf(TripArchivedError)
    }
    expect(await listTripReservations(owner, { tripId: shared.id })).toEqual([])
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

describe('a stay saved under a trip currency that is no longer the trip’s', () => {
  const STALE = 'EUR'

  async function snapshot(owner: TenantScope, tripId: string) {
    return {
      bookings: await listTripReservations(owner, { tripId }),
      stays: await listTripAccommodations(owner, tripId),
      lines: await listTripExpenses(owner, tripId),
    }
  }

  it('refuses a create and an update with the key and writes nothing', async () => {
    const { reservationId, stayId } = await createStay(
      scope,
      stayPayload({ priceMinor: 30_000, currency: 'JPY' }),
    )
    const before = await snapshot(scope, trip.id)

    const create = await captureError(() =>
      createStay(
        scope,
        stayPayload({ title: 'Another', expectedTripCurrency: STALE }),
      ),
    )
    const update = await captureError(() =>
      updateStay(scope, {
        ...stayPayload({ title: 'Rewritten', expectedTripCurrency: STALE }),
        reservationId,
        stayId,
      }),
    )

    for (const error of [create, update]) {
      expect(error).toBeInstanceOf(CurrencyRefusalError)
      expect(error.message).toBe('costs.refusal.tripCurrencyChanged')
    }
    expect(await snapshot(scope, trip.id)).toEqual(before)
  })

  it('saves under the current currency and never stores the field', async () => {
    const { reservationId, stayId } = await createStay(
      scope,
      stayPayload({ expectedTripCurrency: 'JPY' }),
    )
    await updateStay(scope, {
      ...stayPayload({ title: 'Renamed', expectedTripCurrency: 'JPY' }),
      reservationId,
      stayId,
    })

    const [booking] = await listTripReservations(scope, { tripId: trip.id })
    const [stay] = await listTripAccommodations(scope, trip.id)
    expect(booking?.title).toBe('Renamed')
    expect(booking).not.toHaveProperty('expectedTripCurrency')
    expect(stay).not.toHaveProperty('expectedTripCurrency')
  })

  it('declares the field on both schemas, which strip a key they do not know', () => {
    const fields = { ...stayPayload(), expectedTripCurrency: ' eur ' }

    expect(stayInputSchema.parse(fields).expectedTripCurrency).toBe('EUR')
    expect(
      stayUpdateSchema.parse({ ...fields, reservationId: 'r', stayId: 's' })
        .expectedTripCurrency,
    ).toBe('EUR')
    expect(
      stayInputSchema.safeParse({ ...fields, expectedTripCurrency: 'EU' })
        .success,
    ).toBe(false)
  })

  it('answers a viewer with the role refusal, not the currency one', async () => {
    const viewerId = await tenantOf.addUser('A viewer')
    await addTripMember(scope, {
      tripId: trip.id,
      userId: viewerId,
      role: 'viewer',
    })

    const error = await captureError(() =>
      createStay(
        tenantOf.scopeFor(viewerId),
        stayPayload({ expectedTripCurrency: STALE }),
      ),
    )

    expect(error).not.toBeInstanceOf(CurrencyRefusalError)
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
  })

  it('answers the other workspace’s trip and row as not found, never as a currency refusal', async () => {
    const harness = await createHarness()
    const elsewhere = await harness.seedTenant('stays-elsewhere')
    const abroad = await createTrip(elsewhere.scope, {
      title: 'Lisbon',
      startDate: '2026-05-01',
      endDate: '2026-05-04',
      currency: 'EUR',
    })
    const [first, , , last] = await listTripDays(elsewhere.scope, abroad.id)
    const foreign = await createStay(elsewhere.scope, {
      ...stayPayload(),
      tripId: abroad.id,
      startDayId: first?.id ?? '',
      endDayId: last?.id ?? '',
    })
    const hereBefore = await snapshot(scope, trip.id)
    const thereBefore = await snapshot(elsewhere.scope, abroad.id)

    const attempts = [
      () =>
        createStay(
          scope,
          stayPayload({ tripId: abroad.id, expectedTripCurrency: 'XXX' }),
        ),
      () =>
        updateStay(scope, {
          ...stayPayload({ tripId: abroad.id, expectedTripCurrency: 'XXX' }),
          reservationId: foreign.reservationId,
          stayId: foreign.stayId,
        }),
      () =>
        updateStay(scope, {
          ...stayPayload({ expectedTripCurrency: 'XXX' }),
          reservationId: foreign.reservationId,
          stayId: foreign.stayId,
        }),
    ]
    for (const attempt of attempts) {
      const error = await captureError(attempt)
      expect(error).toBeInstanceOf(NotFoundError)
      expect(error).not.toBeInstanceOf(CurrencyRefusalError)
    }

    expect(await snapshot(scope, trip.id)).toEqual(hereBefore)
    expect(await snapshot(elsewhere.scope, abroad.id)).toEqual(thereBefore)
  })
})

/**
 * The same two deletes on the database D1 is actually running. `reservation_id` arrived by
 * `ADD COLUMN`, so what D1 enforces is `NO ACTION`, not the `set null` `schema.ts` declares
 * (`DEPLOYED_WITHOUT_ON_DELETE` in `migrations-match-schema.test.ts` registers it, ADR 0044); on the
 * default harness these cases would pass whether or not the link is cleared before the booking
 * goes.
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
