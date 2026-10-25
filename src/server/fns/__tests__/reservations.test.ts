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
  CurrencyRefusalError,
  TripArchivedError,
  addTripMember,
  archiveTrip,
  createAssignment,
  createExpense,
  createPlace,
  createReservation,
  createTrip,
  deleteExpense,
  getExpense,
  getExpenseWithShares,
  getReservation,
  linkReservationExpense,
  listTripDays,
  listAuditLog,
  listTripExpenses,
  listTripReservations,
  markShareSettled,
  restoreTrip,
  updateExpense,
} from '#/server/repos'
import { NotFoundError } from '#/server/repos/context'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { SplitParticipantInput, TenantScope } from '#/server/repos'
import type { SPLIT_METHODS } from '#/server/db/schema'
import type { Expense, ExpenseShare, Trip } from '#/server/db/types'

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
  ledgerReport,
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

/**
 * The three fields a booking or stay write reports its ledger with. The write functions discard
 * their answer outside a Start build, so the one function that builds all four answers is driven
 * directly: a flag that disagreed with the name beside it would be wrong in every write path.
 */
describe('ledgerReport', () => {
  it('keeps the outcome name and derives both flags from it', () => {
    expect(ledgerReport('failed')).toEqual({
      ledger: 'failed',
      ledgerFailed: true,
      ledgerSplitStale: false,
    })
    expect(ledgerReport('split-stale')).toEqual({
      ledger: 'split-stale',
      ledgerFailed: false,
      ledgerSplitStale: true,
    })
    expect(ledgerReport('created')).toEqual({
      ledger: 'created',
      ledgerFailed: false,
      ledgerSplitStale: false,
    })
  })

  it('raises a flag for exactly one outcome and for no other', () => {
    const outcomes = [
      'created',
      'updated',
      'split-stale',
      'unlinked',
      'undated',
      'kept',
      'none',
      'failed',
    ] as const
    const failed = outcomes.filter((o) => ledgerReport(o).ledgerFailed)
    const splitStale = outcomes.filter((o) => ledgerReport(o).ledgerSplitStale)

    expect(failed).toEqual(['failed'])
    expect(splitStale).toEqual(['split-stale'])
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

/**
 * The cost line and its link to the booking are one write (#1493). A line the booking does not
 * point at is a line nothing owns, and the next save of the same booking would insert a second one.
 */
describe('syncReservationExpense writes the cost line and its link as one unit', () => {
  async function pricedBooking() {
    return createReservation(scope, {
      tripId: trip.id,
      title: 'Dinner at Den',
      startDate: '2026-04-11',
      priceMinor: 24_000,
      currency: 'JPY',
    })
  }

  async function linkOf(reservationId: string): Promise<string | null> {
    return (await getReservation(scope, reservationId))?.expenseId ?? null
  }

  it('leaves no cost line behind when the link write is refused, and a retry finds a clean slate', async () => {
    const reservation = await pricedBooking()
    harness.sqlite.exec(
      `CREATE TRIGGER refuse_link BEFORE UPDATE OF expense_id ON reservations
       BEGIN SELECT RAISE(ABORT, 'link refused'); END`,
    )

    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'failed',
    )
    expect(await listTripExpenses(scope, trip.id)).toEqual([])
    expect(await linkOf(reservation.id)).toBeNull()

    harness.sqlite.exec('DROP TRIGGER refuse_link')
    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'created',
    )
    const lines = await listTripExpenses(scope, trip.id)
    expect(lines).toHaveLength(1)
    expect(await linkOf(reservation.id)).toBe(lines[0]?.id)
  })

  it('writes nothing when the whole batch is refused', async () => {
    const reservation = await pricedBooking()
    const database = scope.db as unknown as {
      batch: (...args: ReadonlyArray<unknown>) => Promise<unknown>
    }
    const batch = vi
      .spyOn(database, 'batch')
      .mockRejectedValueOnce(new Error('D1 refused the batch'))

    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'failed',
    )
    expect(batch).toHaveBeenCalledTimes(1)
    batch.mockRestore()

    expect(await listTripExpenses(scope, trip.id)).toEqual([])
    expect(await linkOf(reservation.id)).toBeNull()
    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'created',
    )
    expect(await listTripExpenses(scope, trip.id)).toHaveLength(1)
  })

  it('answers failed when the batch ran without writing the line or the link', async () => {
    const reservation = await pricedBooking()
    const database = scope.db as unknown as {
      batch: (...args: ReadonlyArray<unknown>) => Promise<unknown>
    }
    const batch = vi.spyOn(database, 'batch').mockResolvedValueOnce(undefined)

    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'failed',
    )
    batch.mockRestore()

    expect(await listTripExpenses(scope, trip.id)).toEqual([])
    expect(await linkOf(reservation.id)).toBeNull()
  })

  it('writes nothing on a driver without batch support', async () => {
    const reservation = await pricedBooking()
    const withoutBatch = new Proxy(scope.db, {
      get: (target, property, receiver) =>
        property === 'batch'
          ? undefined
          : Reflect.get(target, property, receiver),
    })

    expect(
      await syncReservationExpense(
        { ...scope, db: withoutBatch },
        { reservation, trip },
      ),
    ).toBe('failed')
    expect(await listTripExpenses(scope, trip.id)).toEqual([])
    expect(await linkOf(reservation.id)).toBeNull()
  })

  it('leaves exactly one cost line when two saves of the same unlinked booking overlap', async () => {
    const reservation = await pricedBooking()

    const outcomes = await Promise.all([
      syncReservationExpense(scope, { reservation, trip }),
      syncReservationExpense(scope, { reservation, trip }),
    ])

    expect([...outcomes].sort()).toEqual(['created', 'updated'])
    const lines = await listTripExpenses(scope, trip.id)
    expect(lines).toHaveLength(1)
    expect(await linkOf(reservation.id)).toBe(lines[0]?.id)
  })

  it('does not insert a second line for a stale copy of a booking that is linked since, and prices it from the stored booking', async () => {
    const reservation = await pricedBooking()
    await syncReservationExpense(scope, { reservation, trip })

    expect(
      await syncReservationExpense(scope, {
        reservation: { ...reservation, priceMinor: 30_000 },
        trip,
      }),
    ).toBe('updated')

    const lines = await listTripExpenses(scope, trip.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.amountMinor).toBe(reservation.priceMinor)
  })

  it('refuses an archived trip and a viewer without creating a line', async () => {
    const viewerId = await tenant.addUser('A viewer')
    await addTripMember(scope, {
      tripId: trip.id,
      userId: viewerId,
      role: 'viewer',
    })
    const reservation = await pricedBooking()

    expect(
      await syncReservationExpense(tenant.scopeFor(viewerId), {
        reservation,
        trip,
      }),
    ).toBe('failed')

    await archiveTrip(scope, trip.id)
    expect(await syncReservationExpense(scope, { reservation, trip })).toBe(
      'failed',
    )

    expect(await listTripExpenses(scope, trip.id)).toEqual([])
    expect(await linkOf(reservation.id)).toBeNull()
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
 * `REFERENCES` clause with no `ON DELETE` — drizzle-kit's `ADD COLUMN` writes none — so the
 * deployed rule is `NO ACTION` and the same delete raises `FOREIGN KEY constraint failed` unless
 * the repository clears the column first. `DEPLOYED_WITHOUT_ON_DELETE` in
 * `migrations-match-schema.test.ts` registers that gap (ADR 0044); this is the test that the code
 * closes it.
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

/**
 * `syncReservationExpense` swallows a refused ledger write as `'failed'`, so a money guard narrower
 * than the booking guard would stop pricing bookings for editors without a single error anywhere.
 * An editor may write a booking, and so may write the cost line it produces.
 */
describe('a priced booking saved by an editor', () => {
  beforeEach(async () => {
    const editorId = await tenant.addUser('An editor')
    await addTripMember(scope, {
      tripId: trip.id,
      userId: editorId,
      role: 'editor',
    })
    stubs.scope = tenant.scopeFor(editorId)
  })

  it('still creates, then updates, its cost line', async () => {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        title: 'Dinner at Den',
        startDate: '2026-04-11',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )
    const created = await onlyBooking()
    expect(created.expenseId).not.toBeNull()
    expect(await listTripExpenses(scope, trip.id)).toHaveLength(1)

    await updateBooking(
      bookingPayload({
        tripId: trip.id,
        reservationId: created.id,
        title: 'Dinner at Den',
        startDate: '2026-04-11',
        priceMinor: 30_000,
        currency: 'JPY',
      }),
    )

    const lines = await listTripExpenses(scope, trip.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.amountMinor).toBe(30_000)
  })

  it('answers “created” and “updated” from the sync itself, never “failed”', async () => {
    const editorScope = stubs.scope
    if (editorScope === null) {
      throw new Error('The editor scope was not set.')
    }
    const reservation = await createReservation(editorScope, {
      tripId: trip.id,
      title: 'Dinner at Den',
      startDate: '2026-04-11',
      priceMinor: 9_000,
      currency: 'JPY',
    })

    expect(
      await syncReservationExpense(editorScope, { reservation, trip }),
    ).toBe('created')
    const linked = await getReservation(editorScope, reservation.id)
    if (linked === null) {
      throw new Error('The booking vanished.')
    }
    expect(
      await syncReservationExpense(editorScope, {
        reservation: { ...linked, priceMinor: 12_000 },
        trip,
      }),
    ).toBe('updated')
  })
})

/**
 * An archived trip is a record (#1026): the four booking writers refuse it for an owner and an
 * editor alike, before the booking exists, so no cost line and no room patch can follow a refused
 * write. The desk tells the screen the same thing, so it draws no write control.
 */
describe('a booking write on an archived trip', () => {
  let editorId: string

  beforeEach(async () => {
    editorId = await tenant.addUser('An editor')
    await addTripMember(scope, {
      tripId: trip.id,
      userId: editorId,
      role: 'editor',
    })
  })

  async function bookedThenArchived() {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )
    const booking = await onlyBooking()
    await archiveTrip(scope, trip.id)
    stubs.mirrorToRoom.mockClear()
    return booking
  }

  it('refuses all four writers, for an owner and for an editor, and writes nothing', async () => {
    const booking = await bookedThenArchived()
    const before = {
      bookings: await listTripReservations(scope, { tripId: trip.id }),
      lines: await listTripExpenses(scope, trip.id),
    }

    for (const actor of [scope, tenant.scopeFor(editorId)]) {
      stubs.scope = actor
      const attempts = [
        () =>
          createBooking(
            bookingPayload({
              tripId: trip.id,
              title: 'Late taxi',
              priceMinor: 3_000,
              currency: 'JPY',
            }),
          ),
        () =>
          updateBooking(
            bookingPayload({
              tripId: trip.id,
              reservationId: booking.id,
              title: 'Rewritten',
              priceMinor: 1,
              currency: 'JPY',
            }),
          ),
        () =>
          setBookingStatus({
            tripId: trip.id,
            reservationId: booking.id,
            status: 'cancelled',
          }),
        () => deleteBooking({ tripId: trip.id, reservationId: booking.id }),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(TripArchivedError)
      }
    }

    // No booking, no cost line - so no `ledger: 'failed'` outcome can reach a reader - and no patch.
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual(
      before.bookings,
    )
    expect(await listTripExpenses(scope, trip.id)).toEqual(before.lines)
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
  })

  it('writes again once the owner restores the trip', async () => {
    const booking = await bookedThenArchived()
    await restoreTrip(scope, trip.id)
    stubs.scope = tenant.scopeFor(editorId)

    await setBookingStatus({
      tripId: trip.id,
      reservationId: booking.id,
      status: 'confirmed',
    })

    expect((await getReservation(scope, booking.id))?.status).toBe('confirmed')
  })

  it('tells the desk the trip is archived and that nobody may write it', async () => {
    await bookedThenArchived()

    for (const actor of [scope, tenant.scopeFor(editorId)]) {
      expect(await bookingDeskPayload(actor, trip.id)).toMatchObject({
        canWrite: false,
        archived: true,
      })
    }
  })

  it('lets an owner and an editor write the desk of a trip that is not archived, and a viewer not', async () => {
    const viewerId = await tenant.addUser('A viewer')
    await addTripMember(scope, {
      tripId: trip.id,
      userId: viewerId,
      role: 'viewer',
    })

    expect(await bookingDeskPayload(scope, trip.id)).toMatchObject({
      canWrite: true,
      archived: false,
    })
    expect(
      await bookingDeskPayload(tenant.scopeFor(editorId), trip.id),
    ).toMatchObject({ canWrite: true, archived: false })
    expect(
      await bookingDeskPayload(tenant.scopeFor(viewerId), trip.id),
    ).toMatchObject({ canWrite: false, archived: false })
  })
})

/**
 * A booking's price is the one figure of its cost line that moves without the Costs screen, so a
 * split line has to follow it: shares that no longer add up to the total put `getMemberBalances`
 * off by the difference, silently (#881). Everything here is the real repositories on a migrated
 * database; the claim is about what the shares and the outcome are afterwards.
 */
describe('a booking price change on a cost line that is split', () => {
  const PRICE = 10_000
  let people: ReadonlyArray<string>
  let reservation: Awaited<ReturnType<typeof createReservation>>
  let expenseId: string

  beforeEach(async () => {
    people = [
      tenant.ownerUserId,
      ...(await Promise.all(
        ['Aiko', 'Ben'].map(async (name) => {
          const userId = await tenant.addUser(name)
          await addTripMember(scope, {
            tripId: trip.id,
            userId,
            role: 'editor',
          })
          return userId
        }),
      )),
    ]
    const created = await createReservation(scope, {
      tripId: trip.id,
      title: 'Dinner at Den',
      type: 'restaurant',
      startDate: '2026-04-11',
      priceMinor: PRICE,
      currency: 'JPY',
    })
    await syncReservationExpense(scope, { reservation: created, trip })
    const linked = await getReservation(scope, created.id)
    if (linked === null || linked.expenseId === null) {
      throw new Error('The booking should be linked to its cost line.')
    }
    reservation = linked
    expenseId = linked.expenseId
  })

  /** The line as the Costs screen reads it: shares in ascending id order, the order that settles ties. */
  async function line(): Promise<{
    expense: Expense
    shares: ReadonlyArray<ExpenseShare>
  }> {
    // `getExpenseWithShares` already orders by id the way SQLite does (binary). A `localeCompare`
    // here ordered the random tail of same-millisecond ids differently and made the test flaky.
    return getExpenseWithShares(scope, expenseId)
  }

  /** The Costs screen's own write: the method lands on the line and the people on its shares. */
  async function split(
    participants: ReadonlyArray<SplitParticipantInput>,
    splitMethod: (typeof SPLIT_METHODS)[number],
  ): Promise<void> {
    await updateExpense(scope, trip.id, expenseId, {
      splitMethod,
      participants: [...participants],
    })
  }

  const total = (shares: ReadonlyArray<ExpenseShare>): number =>
    shares.reduce((sum, share) => sum + share.shareMinor, 0)

  async function reprice(priceMinor: number) {
    return syncReservationExpense(scope, {
      reservation: { ...reservation, priceMinor },
      trip,
    })
  }

  it('re-divides an equal split so it adds up to a total that does not divide evenly', async () => {
    await split(
      people.map((userId) => ({ userId })),
      'equal',
    )
    const before = await line()
    const settled = before.shares[1]
    if (settled === undefined) {
      throw new Error('Expected three shares.')
    }
    await markShareSettled(scope, trip.id, settled.id, true)

    expect(await reprice(10_001)).toBe('updated')

    const after = await line()
    expect(after.expense.amountMinor).toBe(10_001)
    expect(total(after.shares)).toBe(10_001)
    // The two leftover cents go to the first two shares by id, every time.
    expect(after.shares.map((share) => share.shareMinor)).toEqual([
      3_334, 3_334, 3_333,
    ])
    expect(after.shares.map((share) => share.id)).toEqual(
      before.shares.map((share) => share.id),
    )
    expect(after.shares.map((share) => share.isSettled)).toEqual([
      false,
      true,
      false,
    ])
    expect(after.shares.map((share) => share.userId)).toEqual(
      before.shares.map((share) => share.userId),
    )
  })

  it('re-divides a shares split by its stored weights', async () => {
    await split(
      people.map((userId, index) => ({ userId, weight: index + 1 })),
      'shares',
    )
    const before = await line()

    expect(await reprice(12_001)).toBe('updated')

    const after = await line()
    expect(total(after.shares)).toBe(12_001)
    // The weights are what the split is, so they and the method survive the new figures.
    expect(after.shares.map((share) => share.weight)).toEqual(
      before.shares.map((share) => share.weight),
    )
    expect(after.expense.splitMethod).toBe('shares')
    // 12_001 / 6 per weight: each share is its weight's part, give or take the leftover cent.
    for (const share of after.shares) {
      expect(
        Math.abs(share.shareMinor - (12_001 * share.weight) / 6),
      ).toBeLessThan(1)
    }
  })

  it('re-divides a percentage split without refusing its stored weights', async () => {
    const percentages = [50, 30, 20]
    await split(
      people.map((userId, index) => ({
        userId,
        percentage: percentages[index],
      })),
      'percentage',
    )
    const before = await line()

    // A percentage split stores its percent in `weight`; handing it back as a weight would throw.
    expect(await reprice(10_001)).toBe('updated')

    const after = await line()
    expect(total(after.shares)).toBe(10_001)
    expect(after.shares.map((share) => share.weight)).toEqual(
      before.shares.map((share) => share.weight),
    )
    for (const share of after.shares) {
      expect(
        Math.abs(share.shareMinor - (10_001 * share.weight) / 100),
      ).toBeLessThan(1)
    }
  })

  it('keeps an exact split as it was, saves the amount and says the split is stale', async () => {
    await split(
      [
        { userId: people[0] ?? '', shareMinor: 4_000 },
        { userId: people[1] ?? '', shareMinor: 3_000 },
        { userId: people[2] ?? '', shareMinor: 3_000 },
      ],
      'exact',
    )
    const before = await line()

    expect(await reprice(12_000)).toBe('split-stale')

    const after = await line()
    expect(after.expense.amountMinor).toBe(12_000)
    expect(after.shares).toEqual(before.shares)
  })

  it('leaves shares that already add up alone when only the title changes', async () => {
    await split(
      [
        { userId: people[0] ?? '', shareMinor: 4_000 },
        { userId: people[1] ?? '', shareMinor: 3_000 },
        { userId: people[2] ?? '', shareMinor: 3_000 },
      ],
      'exact',
    )
    const before = await line()

    const outcome = await syncReservationExpense(scope, {
      reservation: { ...reservation, title: 'Dinner at Den, moved' },
      trip,
    })

    expect(outcome).toBe('updated')
    const after = await line()
    expect(after.expense.title).toBe('Dinner at Den, moved')
    expect(after.shares).toEqual(before.shares)
  })

  it('treats stored weights the split arithmetic refuses as stale, not as a failure', async () => {
    await split(
      people.map((userId) => ({ userId, weight: 1 })),
      'shares',
    )
    const before = await line()
    harness.sqlite.exec(
      `UPDATE expense_shares SET weight = 0 WHERE expense_id = '${expenseId}'`,
    )

    expect(await reprice(12_000)).toBe('split-stale')

    const after = await line()
    expect(after.expense.amountMinor).toBe(12_000)
    expect(after.shares.map((share) => share.shareMinor)).toEqual(
      before.shares.map((share) => share.shareMinor),
    )
  })

  it('writes the new amount and the shares together or not at all', async () => {
    await split(
      people.map((userId) => ({ userId })),
      'equal',
    )
    const before = await line()
    const database = scope.db as unknown as {
      batch: (...args: ReadonlyArray<unknown>) => Promise<unknown>
    }
    const batch = vi
      .spyOn(database, 'batch')
      .mockRejectedValueOnce(new Error('D1 refused the batch'))

    expect(await reprice(12_000)).toBe('failed')

    batch.mockRestore()
    const after = await line()
    expect(after.expense.amountMinor).toBe(PRICE)
    expect(after.shares).toEqual(before.shares)
  })

  it('leaves a line with no shares as it behaved before', async () => {
    const statementsBefore = harness.statements.length

    expect(await reprice(12_000)).toBe('updated')

    const after = await line()
    expect(after.expense.amountMinor).toBe(12_000)
    expect(after.shares).toEqual([])
    expect(
      harness.statements
        .slice(statementsBefore)
        .filter(
          (sql) =>
            /expense_shares/iu.test(sql) &&
            /^(insert|update|delete)/iu.test(sql),
        ),
    ).toEqual([])
  })

  it('does not rewrite the shares of a line another workspace owns', async () => {
    const elsewhere = await harness.seedTenant('elsewhere')
    const abroad = await createTrip(elsewhere.scope, {
      title: 'Lisbon',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      currency: 'JPY',
    })
    const foreign = await createExpense(elsewhere.scope, {
      tripId: abroad.id,
      title: 'A cost in another workspace',
      amountMinor: PRICE,
      spentOn: '2026-05-01',
      participants: [{ userId: elsewhere.ownerUserId }],
    })
    const snapshot = await getExpenseWithShares(
      elsewhere.scope,
      foreign.expense.id,
    )

    expect(
      await syncReservationExpense(scope, {
        reservation: {
          ...reservation,
          expenseId: foreign.expense.id,
          priceMinor: 12_000,
        },
        trip,
      }),
    ).toBe('failed')

    expect(
      await getExpenseWithShares(elsewhere.scope, foreign.expense.id),
    ).toEqual(snapshot)
  })
})

describe('a booking save made under a trip currency that is no longer the trip’s', () => {
  const STALE = 'EUR'

  /** A trip in JPY, re-based since the tab loaded under EUR; the booking on it is priced. */
  async function booked() {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        startDate: '2026-04-11',
        priceMinor: 24_000,
        currency: 'JPY',
      }),
    )
    const booking = await onlyBooking()
    stubs.mirrorToRoom.mockClear()
    return booking
  }

  async function snapshot() {
    return {
      bookings: await listTripReservations(scope, { tripId: trip.id }),
      lines: await listTripExpenses(scope, trip.id),
      audit: (await listAuditLog(scope, {})).items.map((entry) => entry.id),
    }
  }

  it('refuses a create and an update with the key and writes nothing', async () => {
    const booking = await booked()
    const before = await snapshot()

    const create = await captureError(() =>
      createBooking(
        bookingPayload({
          tripId: trip.id,
          title: 'Late taxi',
          priceMinor: 3_000,
          currency: STALE,
          expectedTripCurrency: STALE,
        }),
      ),
    )
    const update = await captureError(() =>
      updateBooking(
        bookingPayload({
          tripId: trip.id,
          reservationId: booking.id,
          title: 'Rewritten',
          startDate: '2026-04-11',
          priceMinor: 1,
          currency: STALE,
          expectedTripCurrency: STALE,
        }),
      ),
    )

    for (const error of [create, update]) {
      expect(error).toBeInstanceOf(CurrencyRefusalError)
      expect(error.message).toBe('costs.refusal.tripCurrencyChanged')
    }
    expect(await snapshot()).toEqual(before)
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
  })

  it('saves under the current currency, in either case, and never stores the field', async () => {
    await createBooking(
      bookingPayload({
        tripId: trip.id,
        title: 'Dinner',
        expectedTripCurrency: 'jpy',
      }),
    )
    const booking = await onlyBooking()
    await updateBooking(
      bookingPayload({
        tripId: trip.id,
        reservationId: booking.id,
        title: 'Dinner, moved',
        expectedTripCurrency: 'JPY',
      }),
    )

    const saved = await getReservation(scope, booking.id)
    expect(saved?.title).toBe('Dinner, moved')
    expect(saved).not.toHaveProperty('expectedTripCurrency')
  })

  it('leaves a save that names no currency unchecked', async () => {
    await createBooking(bookingPayload({ tripId: trip.id }))

    expect(await onlyBooking()).toBeDefined()
  })

  it('refuses a malformed currency at the schema, on both validators', () => {
    for (const expectedTripCurrency of ['EU', 'EURO', '1 2', '']) {
      expect(
        bookingInputSchema.safeParse(
          bookingPayload({ tripId: trip.id, expectedTripCurrency }),
        ).success,
      ).toBe(false)
      expect(
        bookingUpdateSchema.safeParse(
          bookingPayload({
            tripId: trip.id,
            reservationId: 'r',
            expectedTripCurrency,
          }),
        ).success,
      ).toBe(false)
    }
    expect(
      bookingInputSchema.parse(
        bookingPayload({ tripId: trip.id, expectedTripCurrency: ' eur ' }),
      ).expectedTripCurrency,
    ).toBe('EUR')
  })

  it('answers a viewer with the role refusal, not the currency one', async () => {
    const viewerId = await tenant.addUser('A viewer')
    await addTripMember(scope, {
      tripId: trip.id,
      userId: viewerId,
      role: 'viewer',
    })
    stubs.scope = tenant.scopeFor(viewerId)

    const error = await captureError(() =>
      createBooking(
        bookingPayload({ tripId: trip.id, expectedTripCurrency: STALE }),
      ),
    )

    expect(error).not.toBeInstanceOf(CurrencyRefusalError)
    expect(await listTripReservations(scope, { tripId: trip.id })).toEqual([])
  })

  it('answers the other workspace’s trip and row as not found, never as a currency refusal', async () => {
    const elsewhere = await harness.seedTenant('elsewhere')
    const abroad = await createTrip(elsewhere.scope, {
      title: 'Lisbon',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      currency: 'EUR',
    })
    const foreign = await createReservation(elsewhere.scope, {
      tripId: abroad.id,
      type: 'restaurant',
      status: 'pending',
      title: 'Dinner abroad',
      priceMinor: 5_000,
      currency: 'EUR',
    })
    const own = await booked()
    const before = {
      here: await snapshot(),
      there: {
        bookings: await listTripReservations(elsewhere.scope, {
          tripId: abroad.id,
        }),
        lines: await listTripExpenses(elsewhere.scope, abroad.id),
      },
    }

    const attempts = [
      () =>
        createBooking(
          bookingPayload({ tripId: abroad.id, expectedTripCurrency: 'XXX' }),
        ),
      () =>
        updateBooking(
          bookingPayload({
            tripId: abroad.id,
            reservationId: foreign.id,
            expectedTripCurrency: 'XXX',
          }),
        ),
      () =>
        updateBooking(
          bookingPayload({
            tripId: trip.id,
            reservationId: foreign.id,
            expectedTripCurrency: 'XXX',
          }),
        ),
    ]
    for (const attempt of attempts) {
      const error = await captureError(attempt)
      expect(error).toBeInstanceOf(NotFoundError)
      expect(error).not.toBeInstanceOf(CurrencyRefusalError)
    }

    expect(await snapshot()).toEqual(before.here)
    expect(
      await listTripReservations(elsewhere.scope, { tripId: abroad.id }),
    ).toEqual(before.there.bookings)
    expect(await listTripExpenses(elsewhere.scope, abroad.id)).toEqual(
      before.there.lines,
    )
    expect(own.tripId).toBe(trip.id)
  })
})
