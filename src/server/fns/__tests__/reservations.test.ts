/**
 * The booking write boundary, and the one side effect it carries.
 *
 * A booking with a price produces a line in the trip's ledger, in one act and without a second
 * confirmation. That is a *cross-module* write — `reservations` reaching into `expenses` — so the
 * claims worth testing are the ones no single repository test can make: that it happens on the
 * paths a person uses, that it happens exactly once however many times they save, and that it does
 * **not** happen on the path the development seeder takes.
 *
 * Two properties of `createServerFn` shape the file, and both are the framework's rather than this
 * module's — `fns/__tests__/atlas.test.ts` measured them first and the notes there apply verbatim:
 * a handler only runs inside TanStack Start's `AsyncLocalStorage`, and outside a Start build the
 * handler runs but its return value is discarded. So the handlers are driven for what they *do* to
 * the database, and {@link syncReservationExpense} — which is exported, and is the thing under
 * test — is called directly for what it *answers*.
 *
 * Everything else is real: a migrated SQLite database from the Drizzle schema, real repositories,
 * real foreign keys, real `CHECK` constraints.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAssignment,
  createExpense,
  createPlace,
  createReservation,
  createTrip,
  deleteExpense,
  getExpense,
  getReservation,
  linkReservationExpense,
  listTripDays,
  listAuditLog,
  listTripExpenses,
  listTripReservations,
} from '#/server/repos'
import { NotFoundError } from '#/server/repos/context'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type { Trip } from '#/server/db/types'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  mirrorToRoom: vi.fn(async (): Promise<void> => undefined),
}))

/**
 * `./context` imports `cloudflare:workers` at module scope, which does not resolve in the `server`
 * Vitest project, so it is replaced wholesale. The three helpers below are copies of the real ones
 * — they are pure — and `mirrorToRoom` is the no-op it already becomes when the Durable Object is
 * unreachable, which is a documented property of the real implementation rather than a shortcut.
 */
vi.mock('../context', () => ({
  appScope: async (): Promise<unknown> => {
    if (stubs.scope === null) {
      throw new Error('unauthenticated')
    }
    return stubs.scope
  },
  mirrorToRoom: stubs.mirrorToRoom,
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

/* ------------------------------------------------------------ start context */

interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

function startContext(): StartContext {
  return {
    startOptions: {},
    request: new Request('https://planned.travel/_serverFn/reservations', {
      method: 'POST',
    }),
  }
}

const {
  bookingDeskPayload,
  bookingInputSchema,
  bookingUpdateSchema,
  createBookingFn,
  deleteBookingFn,
  setBookingStatusFn,
  syncReservationExpense,
  updateBookingFn,
} = await import('../reservations')

/** The fields every booking payload carries, so a case only states what it is about. */
function bookingPayload(overrides: Record<string, unknown>) {
  return {
    type: 'restaurant',
    status: 'pending',
    title: 'Dinner at Den',
    provider: '',
    location: '',
    confirmationNumber: '',
    url: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    guests: 0,
    priceMinor: 0,
    currency: '',
    dayId: '',
    assignmentId: '',
    notes: '',
    ...overrides,
  }
}

const createBooking = async (data: unknown): Promise<void> => {
  const validated = bookingInputSchema.parse(data)
  await startStorage.run(startContext(), () =>
    createBookingFn({ data: validated }),
  )
}

const updateBooking = async (data: unknown): Promise<void> => {
  const validated = bookingUpdateSchema.parse(data)
  await startStorage.run(startContext(), () =>
    updateBookingFn({ data: validated }),
  )
}

const deleteBooking = async (data: {
  tripId: string
  reservationId: string
}): Promise<void> => {
  await startStorage.run(startContext(), () => deleteBookingFn({ data }))
}

const setBookingStatus = async (data: {
  tripId: string
  reservationId: string
  status: 'pending' | 'confirmed' | 'cancelled'
}): Promise<void> => {
  await startStorage.run(startContext(), () => setBookingStatusFn({ data }))
}

/**
 * The desk payload, called directly rather than through `loadBookingDeskFn`.
 *
 * Outside a Start build a server function runs its handler and discards the answer, so the loader
 * itself can prove nothing about what it returns; `bookingDeskPayload` is the half that can.
 */
const loadDesk = async (tripId: string) => bookingDeskPayload(scope, tripId)

/* -------------------------------------------------------------------- setup */

let harness: Harness
let tenant: SeededTenant
let scope: TenantScope
let trip: Trip

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('bookings')
  scope = tenant.scope
  stubs.scope = scope
  trip = await createTrip(scope, {
    title: 'Tokyo in spring',
    startDate: '2026-04-10',
    endDate: '2026-04-13',
    currency: 'JPY',
  })
})

/** The only booking on the trip, read back from the database. */
async function onlyBooking() {
  const rows = await listTripReservations(scope, { tripId: trip.id })
  const row = rows.at(0)
  if (row === undefined) {
    throw new Error('Expected the trip to have exactly one booking.')
  }
  return row
}

describe('a priced booking and the trip’s ledger', () => {
  it('writes one cost line when a booking is created with a price', async () => {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        title: 'Dinner at Den',
        startDate: '2026-04-11',
        startTime: '19:00',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )

    const booking = await onlyBooking()
    expect(booking.expenseId).not.toBeNull()

    const lines = await listTripExpenses(scope, trip.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.amountMinor).toBe(24_000)
    expect(lines[0]?.currency).toBe('JPY')
    expect(lines[0]?.spentOn).toBe('2026-04-11')
    // A table is food, and the category is a default the reader may change afterwards.
    expect(lines[0]?.category).toBe('food')
  })

  it('rewrites the same line rather than leaving a second one behind', async () => {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        startTime: '19:00',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )
    const booking = await onlyBooking()

    for (const priceMinor of [26_000, 28_000, 30_000]) {
      await updateBooking(
        bookingPayload({
          tripId: trip.id,
          reservationId: booking.id,
          startDate: '2026-04-11',
          startTime: '19:00',
          priceMinor,
          currency: 'JPY',
        }),
      )
    }

    const lines = await listTripExpenses(scope, trip.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.amountMinor).toBe(30_000)
    expect(lines[0]?.id).toBe(booking.expenseId)
  })

  it('unlinks rather than deletes when the price is cleared', async () => {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        startTime: '19:00',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )
    const booking = await onlyBooking()

    await updateBooking(
      bookingPayload({
        tripId: trip.id,
        reservationId: booking.id,
        startDate: '2026-04-11',
        startTime: '19:00',
        priceMinor: 0,
      }),
    )

    // The line may have been split with three other people; blanking a price is not their problem.
    expect(await listTripExpenses(scope, trip.id)).toHaveLength(1)
    expect((await getReservation(scope, booking.id))?.expenseId).toBeNull()
  })

  it('writes no line at all for a booking with no price', async () => {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        startTime: '19:00',
      }),
    )

    expect(await listTripExpenses(scope, trip.id)).toEqual([])
    expect((await onlyBooking()).expenseId).toBeNull()
  })

  it('leaves the cost line standing when the booking is deleted', async () => {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        startTime: '19:00',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )
    const booking = await onlyBooking()

    await deleteBooking({ tripId: trip.id, reservationId: booking.id })

    expect(await getReservation(scope, booking.id)).toBeNull()
    // What the reader would have had if they had typed the cost by hand.
    expect(await listTripExpenses(scope, trip.id)).toHaveLength(1)
  })

  /**
   * The reason the helper lives beside the server functions instead of inside the repository. The
   * development seeder writes reservations straight through `createReservation`, and a
   * repository-level hook would make every seeded trip carry costs nobody entered.
   */
  it('is not reachable from the path the seeder takes', async () => {
    await createReservation(scope, {
      tripId: trip.id,
      title: 'Seeded booking',
      type: 'restaurant',
      startDate: '2026-04-11',
      priceMinor: 24_000,
      currency: 'JPY',
    })

    expect(await listTripExpenses(scope, trip.id)).toEqual([])
  })
})

describe('syncReservationExpense', () => {
  it('maps every kind of booking onto a category the column accepts', async () => {
    const expected = {
      accommodation: 'accommodation',
      restaurant: 'food',
      activity: 'activities',
      tour: 'activities',
      ticket: 'activities',
      transport: 'transport',
      other: 'other',
    } as const

    for (const [type, category] of Object.entries(expected)) {
      const reservation = await createReservation(scope, {
        tripId: trip.id,
        title: `A ${type}`,
        type: type as keyof typeof expected,
        startDate: '2026-04-11',
        priceMinor: 1_000,
        currency: 'JPY',
      })
      expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
        'created',
      )

      const linked = await getReservation(scope, reservation.id)
      const line = await getExpense(scope, linked?.expenseId ?? '')
      expect(line?.category).toBe(category)
    }
  })

  it('takes the date from the day when the booking has none', async () => {
    const days = await listTripDays(scope, trip.id)
    const reservation = await createReservation(scope, {
      tripId: trip.id,
      title: 'Undated but pinned',
      dayId: days[1]?.id,
      priceMinor: 1_000,
    })

    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'created',
    )
    const lines = await listTripExpenses(scope, trip.id)
    expect(lines[0]?.spentOn).toBe(days[1]?.date)
  })

  it('falls back to the trip’s own start date', async () => {
    const reservation = await createReservation(scope, {
      tripId: trip.id,
      title: 'Undated and unpinned',
      priceMinor: 1_000,
    })

    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'created',
    )
    expect((await listTripExpenses(scope, trip.id))[0]?.spentOn).toBe(
      '2026-04-10',
    )
  })

  /** A guessed date on a money row is worse than no row, so there is no row. */
  it('writes nothing when there is no date anywhere in the chain', async () => {
    const undatedTrip = await createTrip(scope, {
      title: 'Someday',
      currency: 'EUR',
    })
    const reservation = await createReservation(scope, {
      tripId: undatedTrip.id,
      title: 'Someday, somewhere',
      priceMinor: 5_000,
    })

    expect(
      await syncReservationExpense(scope, {
        reservation,
        trip: undatedTrip,
      }),
    ).toBe('undated')
    expect(await listTripExpenses(scope, undatedTrip.id)).toEqual([])
  })

  it('prices the line in the trip’s currency when the booking carries none', async () => {
    const reservation = await createReservation(scope, {
      tripId: trip.id,
      title: 'No currency of its own',
      startDate: '2026-04-11',
      priceMinor: 1_000,
    })

    await syncReservationExpense(scope, { reservation, trip })
    expect((await listTripExpenses(scope, trip.id))[0]?.currency).toBe('JPY')
  })

  it('answers “kept” for a booking on its way out, and writes nothing', async () => {
    const reservation = await createReservation(scope, {
      tripId: trip.id,
      title: 'About to go',
      startDate: '2026-04-11',
      priceMinor: 1_000,
    })
    await syncReservationExpense(scope, { reservation, trip })
    const linked = await getReservation(scope, reservation.id)
    if (linked === null) {
      throw new Error('The booking must still be there.')
    }

    expect(
      await syncReservationExpense(scope, {
        reservation: linked,
        trip,
        discarded: true,
      }),
    ).toBe('kept')
    expect(await listTripExpenses(scope, trip.id)).toHaveLength(1)
  })

  /**
   * A ledger write that fails must not turn a saved booking into an error the reader will retry,
   * producing two bookings. The failure is reported, never thrown.
   */
  it('reports a refused ledger write instead of throwing it', async () => {
    const reservation = await createReservation(scope, {
      tripId: trip.id,
      title: 'Points at nothing',
      startDate: '2026-04-11',
      priceMinor: 1_000,
    })

    expect(
      await syncReservationExpense(scope, {
        // A link to an expense that is not there: `updateExpense` raises, and the helper answers.
        reservation: { ...reservation, expenseId: 'expense-that-is-not-there' },
        trip,
      }),
    ).toBe('failed')
  })
})

/**
 * Booking sync updates the ledger line the booking points at, inside the booking's own trip. A link
 * that somehow names another trip's expense must be refused and reported, not written through.
 */
describe('syncReservationExpense with a link to another trip’s expense', () => {
  it('reports the refusal and leaves the other trip’s expense alone', async () => {
    const other = await createTrip(scope, {
      title: 'Osaka later',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      currency: 'JPY',
    })
    const elsewhere = await createExpense(scope, {
      tripId: other.id,
      title: 'A cost on the other trip',
      amountMinor: 1_000,
      spentOn: '2026-06-01',
    })
    const reservation = await createReservation(scope, {
      tripId: trip.id,
      title: 'Dinner at Den',
      startDate: '2026-04-11',
      priceMinor: 9_000,
    })

    expect(
      await syncReservationExpense(scope, {
        reservation: { ...reservation, expenseId: elsewhere.expense.id },
        trip,
      }),
    ).toBe('failed')
    const [line] = await listTripExpenses(scope, other.id)
    expect(line?.title).toBe('A cost on the other trip')
    expect(line?.amountMinor).toBe(1_000)
  })
})

describe('linkReservationExpense across two trips of one workspace', () => {
  it('refuses a cost line belonging to another trip', async () => {
    const other = await createTrip(scope, {
      title: 'Osaka later',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      currency: 'JPY',
    })
    const reservation = await createReservation(scope, {
      tripId: trip.id,
      title: 'Dinner at Den',
      startDate: '2026-04-11',
    })
    const elsewhere = await createExpense(scope, {
      tripId: other.id,
      title: 'A cost on the other trip',
      amountMinor: 1_000,
      spentOn: '2026-06-01',
    })

    expect(
      await captureError(() =>
        linkReservationExpense(scope, reservation.id, elsewhere.expense.id),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect((await getReservation(scope, reservation.id))?.expenseId).toBeNull()
  })
})

/**
 * A booking write names two ids, the trip and the booking, and the handler uses the trip's for its
 * live-room event, its audit entry and its ledger line. The caller here is an owner of both trips,
 * so the role check passes on either one: only the check that the booking belongs to the named
 * trip stands between the request and a write attributed to the wrong trip. The refusal is the
 * same `NotFoundError` a missing id gets, so a mismatch reveals nothing about the other trip.
 */
describe('a booking write naming another trip of the same workspace', () => {
  let other: Trip
  let bookingId: string

  beforeEach(async () => {
    other = await createTrip(scope, {
      title: 'Osaka later',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      currency: 'EUR',
    })
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        startTime: '19:00',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )
    bookingId = (await onlyBooking()).id
    stubs.mirrorToRoom.mockClear()
  })

  /** Everything the refused write must have left alone. */
  async function expectUntouched(): Promise<void> {
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()

    const booking = await getReservation(scope, bookingId)
    expect(booking?.tripId).toBe(trip.id)
    expect(booking?.title).toBe('Dinner at Den')
    expect(booking?.status).toBe('pending')
    expect(booking?.priceMinor).toBe(24_000)

    const lines = await listTripExpenses(scope, trip.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.amountMinor).toBe(24_000)
    expect(await listTripExpenses(scope, other.id)).toEqual([])

    // Only the create's own entry: nothing was recorded for the refused write.
    const audit = await listAuditLog(scope, { entityId: bookingId })
    expect(audit.items.map((entry) => entry.action)).toEqual([
      'reservation.created',
    ])
  }

  it('refuses an update', async () => {
    await expect(
      updateBooking(
        bookingPayload({
          tripId: other.id,
          reservationId: bookingId,
          title: 'Renamed elsewhere',
          startDate: '2026-04-11',
          startTime: '19:00',
          priceMinor: 30_000,
          currency: 'JPY',
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expectUntouched()
  })

  it('refuses a status change', async () => {
    await expect(
      setBookingStatus({
        tripId: other.id,
        reservationId: bookingId,
        status: 'confirmed',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expectUntouched()
  })

  it('refuses a delete', async () => {
    await expect(
      deleteBooking({ tripId: other.id, reservationId: bookingId }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expectUntouched()
  })
})

describe('the booking desk’s payload', () => {
  it('carries every stop of the trip, under the day it belongs to', async () => {
    const days = await listTripDays(scope, trip.id)
    const place = await createPlace(scope, {
      tripId: trip.id,
      name: 'Kiyomizu-dera',
    })
    const stop = await createAssignment(scope, {
      tripId: trip.id,
      dayId: days[1]?.id ?? '',
      placeId: place.id,
      startTime: '09:30',
    })

    const desk = await loadDesk(trip.id)

    expect(desk.days).toHaveLength(4)
    expect(desk.days.flatMap((day) => day.stops)).toEqual([
      {
        assignmentId: stop.id,
        placeName: 'Kiyomizu-dera',
        startTime: '09:30',
      },
    ])
    expect(desk.days.find((day) => day.stops.length > 0)?.id).toBe(days[1]?.id)
  })

  it('says whether a booking is for a stop, and whether it has a cost line', async () => {
    const days = await listTripDays(scope, trip.id)
    const place = await createPlace(scope, { tripId: trip.id, name: 'Den' })
    const stop = await createAssignment(scope, {
      tripId: trip.id,
      dayId: days[1]?.id ?? '',
      placeId: place.id,
    })

    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        startTime: '19:00',
        priceMinor: 24_000,
        currency: 'JPY',
        assignmentId: stop.id,
      }),
    )

    const desk = await loadDesk(trip.id)

    expect(desk.bookings).toHaveLength(1)
    expect(desk.bookings[0]?.assignmentId).toBe(stop.id)
    expect(desk.bookings[0]?.hasLedgerLine).toBe(true)
  })

  /**
   * The hazard the write validators exist to close: a `z.object` strips a key it has not been told
   * about, so a stop the screen chooses and the validator has never heard of would be a column
   * written null with every other test in this file still green.
   */
  it('keeps the stop the payload sent, through create and through update', async () => {
    const days = await listTripDays(scope, trip.id)
    const place = await createPlace(scope, { tripId: trip.id, name: 'Den' })
    const first = await createAssignment(scope, {
      tripId: trip.id,
      dayId: days[0]?.id ?? '',
      placeId: place.id,
    })
    const second = await createAssignment(scope, {
      tripId: trip.id,
      dayId: days[2]?.id ?? '',
      placeId: place.id,
    })

    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-10',
        startTime: '19:00',
        assignmentId: first.id,
      }),
    )
    const booking = await onlyBooking()
    expect(booking.assignmentId).toBe(first.id)

    await updateBooking(
      bookingPayload({
        tripId: trip.id,
        reservationId: booking.id,
        startDate: '2026-04-10',
        startTime: '19:00',
        assignmentId: second.id,
      }),
    )
    expect((await getReservation(scope, booking.id))?.assignmentId).toBe(
      second.id,
    )
  })

  it('refuses a stop that is not on this trip', async () => {
    const other = await createTrip(scope, {
      title: 'Osaka later',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      currency: 'JPY',
    })
    const otherDays = await listTripDays(scope, other.id)
    const place = await createPlace(scope, {
      tripId: other.id,
      name: 'Dotonbori',
    })
    const foreign = await createAssignment(scope, {
      tripId: other.id,
      dayId: otherDays[0]?.id ?? '',
      placeId: place.id,
    })

    await expect(
      createBooking(
        bookingPayload({
          tripId: trip.id,
          startDate: '2026-04-10',
          startTime: '19:00',
          assignmentId: foreign.id,
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
  })
})

/**
 * The delete path, on the database D1 is actually running.
 *
 * `{ ddl: 'migrations' }` and not the default, and that is the whole test. `schema.ts` declares
 * `reservations.expense_id` as `on delete: 'set null'`, so on a schema-built database the engine
 * unlinks the booking by itself and this passes whatever `deleteExpense` does. What ships is a
 * `REFERENCES` clause with no `ON DELETE` — drizzle-kit's `ADD COLUMN` cannot emit one — so the
 * deployed rule is `NO ACTION` and the same delete raises `FOREIGN KEY constraint failed` unless
 * the repository clears the column first. `reservation-schema.test.ts` pins that gap; this is the
 * test that the code closes it.
 */
describe('deleting an expense a booking points at, as deployed', () => {
  let deployed: Harness
  let deployedScope: TenantScope
  let deployedTrip: Trip

  beforeEach(async () => {
    deployed = await createHarness({ ddl: 'migrations' })
    const seeded = await deployed.seedTenant('ledger-delete')
    deployedScope = seeded.scope
    deployedTrip = await createTrip(deployedScope, {
      title: 'Kyoto',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'JPY',
    })
  })

  afterEach(() => {
    deployed.close()
  })

  it('unlinks the booking and keeps it, rather than failing on the foreign key', async () => {
    const reservation = await createReservation(deployedScope, {
      tripId: deployedTrip.id,
      title: 'Ryokan',
      startDate: '2026-04-11',
    })
    const created = await createExpense(deployedScope, {
      tripId: deployedTrip.id,
      title: 'Ryokan',
      amountMinor: 42_000,
      spentOn: '2026-04-11',
    })
    await linkReservationExpense(
      deployedScope,
      reservation.id,
      created.expense.id,
    )

    await deleteExpense(deployedScope, deployedTrip.id, created.expense.id)

    expect(await getExpense(deployedScope, created.expense.id)).toBeNull()
    const kept = await getReservation(deployedScope, reservation.id)
    expect(kept?.title).toBe('Ryokan')
    expect(kept?.expenseId).toBeNull()
  })

  /** The unlink is scoped like every other statement: another workspace's link is not touched. */
  it('leaves another workspace’s link alone', async () => {
    const other = await deployed.seedTenant('ledger-delete-other')
    const otherTrip = await createTrip(other.scope, {
      title: 'Osaka',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    })
    const otherReservation = await createReservation(other.scope, {
      tripId: otherTrip.id,
      title: 'Hotel',
      startDate: '2026-05-01',
    })
    const otherExpense = await createExpense(other.scope, {
      tripId: otherTrip.id,
      title: 'Hotel',
      amountMinor: 10_000,
      spentOn: '2026-05-01',
    })
    await linkReservationExpense(
      other.scope,
      otherReservation.id,
      otherExpense.expense.id,
    )

    const mine = await createExpense(deployedScope, {
      tripId: deployedTrip.id,
      title: 'Coffee',
      amountMinor: 500,
      spentOn: '2026-04-11',
    })
    await deleteExpense(deployedScope, deployedTrip.id, mine.expense.id)

    expect(
      (await getReservation(other.scope, otherReservation.id))?.expenseId,
    ).toBe(otherExpense.expense.id)
  })
})
