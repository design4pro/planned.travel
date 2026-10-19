/**
 * An archived trip refuses its bookings and stays, at the repository seam (#1026).
 *
 * An archived trip is a record, and the plan writers already refuse it. The booking writers and the
 * stay writers did not, so an owner or an editor could rewrite what the archive says is finished.
 * The guard sits in the repository, beside the role guard, so it holds for the server functions, the
 * booking import and whatever route comes next. The order is the boundary's: the trip is visible
 * (`NotFoundError` if not), then it is open (`TripArchivedError`), then the caller holds a role
 * (`TripRoleError`), then the write.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '../context'
import {
  createAccommodation,
  deleteAccommodation,
  listTripAccommodations,
  updateAccommodation,
} from '../itinerary'
import {
  clearReservationImported,
  createImportedReservation,
  createReservation,
  deleteReservation,
  linkReservationExpense,
  listTripReservations,
  markReservationsImported,
  requireWritableBookingTrip,
  setReservationStatus,
  updateReservation,
} from '../reservations'
import { createExpense } from '../expenses'
import { listTripDays } from '../days'
import {
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
  restoreTrip,
} from '../trips'
import { captureError, createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

interface Desk {
  readonly tripId: string
  readonly reservationId: string
  readonly importedId: string
  readonly stayId: string
  readonly firstDayId: string
  readonly lastDayId: string
  readonly expenseId: string
}

describe('an archived trip’s bookings and stays', () => {
  let harness: Harness
  let tenant: SeededTenant
  let desk: Desk
  let editor: TenantScope
  let viewer: TenantScope
  let outsider: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('booking-archive')
    const editorId = await tenant.addUser('An editor')
    const viewerId = await tenant.addUser('A viewer')
    const outsiderId = await tenant.addUser('A member who is not on the trip')

    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon, together',
      slug: 'lisbon-together',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
    await addTripMember(tenant.scope, {
      tripId: trip.id,
      userId: editorId,
      role: 'editor',
    })
    await addTripMember(tenant.scope, {
      tripId: trip.id,
      userId: viewerId,
      role: 'viewer',
    })
    editor = tenant.scopeFor(editorId)
    viewer = tenant.scopeFor(viewerId)
    outsider = tenant.scopeFor(outsiderId)

    const [first, , , last] = await listTripDays(tenant.scope, trip.id)
    if (first === undefined || last === undefined) {
      throw new Error('A four-day trip must have days.')
    }
    const reservation = await createReservation(tenant.scope, {
      tripId: trip.id,
      title: 'Hotel Baixa',
    })
    const imported = await createImportedReservation(
      tenant.scope,
      { tripId: trip.id, title: 'Flight home' },
      new Date('2026-04-01T09:00:00Z'),
    )
    const stay = await createAccommodation(tenant.scope, {
      tripId: trip.id,
      startDayId: first.id,
      endDayId: last.id,
      name: 'Hotel Baixa',
      reservationId: reservation.id,
    })
    const { expense } = await createExpense(tenant.scope, {
      tripId: trip.id,
      title: 'Deposit',
      amountMinor: 5_000,
      spentOn: '2026-04-10',
    })
    desk = {
      tripId: trip.id,
      reservationId: reservation.id,
      importedId: imported.id,
      stayId: stay.id,
      firstDayId: first.id,
      lastDayId: last.id,
      expenseId: expense.id,
    }
  })

  /** What a refused write could have changed, read back as the owner. */
  async function snapshot(): Promise<unknown> {
    return {
      reservations: await listTripReservations(tenant.scope, {
        tripId: desk.tripId,
      }),
      stays: await listTripAccommodations(tenant.scope, desk.tripId),
    }
  }

  /**
   * One entry per booking and stay writer, each aimed at the seeded desk. The two that name a trip
   * and the six that start from a row id are both here, because the archive has to be read off the
   * trip the row sits on.
   */
  function writers(
    scope: TenantScope,
  ): ReadonlyArray<readonly [string, () => Promise<unknown>]> {
    return [
      [
        'createReservation',
        () =>
          createReservation(scope, { tripId: desk.tripId, title: 'Museum' }),
      ],
      [
        'createImportedReservation',
        () =>
          createImportedReservation(
            scope,
            { tripId: desk.tripId, title: 'Imported' },
            new Date('2026-04-02T09:00:00Z'),
          ),
      ],
      [
        'updateReservation',
        () =>
          updateReservation(scope, desk.reservationId, {
            title: 'Rewritten',
          }),
      ],
      [
        'setReservationStatus',
        () => setReservationStatus(scope, desk.reservationId, 'cancelled'),
      ],
      [
        'linkReservationExpense',
        () => linkReservationExpense(scope, desk.reservationId, desk.expenseId),
      ],
      [
        'clearReservationImported',
        () => clearReservationImported(scope, desk.importedId),
      ],
      [
        'markReservationsImported',
        () =>
          markReservationsImported(scope, desk.tripId, [desk.reservationId]),
      ],
      [
        'createAccommodation',
        () =>
          createAccommodation(scope, {
            tripId: desk.tripId,
            startDayId: desk.firstDayId,
            endDayId: desk.firstDayId,
            name: 'Hostel',
          }),
      ],
      [
        'updateAccommodation',
        () => updateAccommodation(scope, desk.stayId, { name: 'Rewritten' }),
      ],
      ['deleteAccommodation', () => deleteAccommodation(scope, desk.stayId)],
      ['deleteReservation', () => deleteReservation(scope, desk.reservationId)],
    ]
  }

  it('refuses every writer to an owner and an editor, and changes nothing', async () => {
    await archiveTrip(tenant.scope, desk.tripId)
    const before = await snapshot()

    for (const scope of [tenant.scope, editor]) {
      for (const [name, write] of writers(scope)) {
        const error = await captureError(write)
        expect(error, name).toBeInstanceOf(TripArchivedError)
      }
    }

    expect(await snapshot()).toEqual(before)
  })

  it('names the refusal in the trip’s own words, so it reaches the reader as itself', async () => {
    await archiveTrip(tenant.scope, desk.tripId)

    const error = await captureError(() =>
      createReservation(editor, { tripId: desk.tripId, title: 'Late' }),
    )

    expect(error).toBeInstanceOf(TripArchivedError)
    expect(error.message).toBe(
      'This trip is archived. Restore it before making changes.',
    )
  })

  it('works again, for every writer, once the owner restores the trip', async () => {
    await archiveTrip(tenant.scope, desk.tripId)
    await restoreTrip(tenant.scope, desk.tripId)

    for (const [name, write] of writers(editor)) {
      await expect(write(), name).resolves.not.toBeInstanceOf(Error)
    }
  })

  it('answers the archive before the role: a viewer is told the trip is archived', async () => {
    await archiveTrip(tenant.scope, desk.tripId)

    for (const [name, write] of writers(viewer)) {
      expect(await captureError(write), name).toBeInstanceOf(TripArchivedError)
    }
  })

  it('still refuses a viewer on a trip that is not archived', async () => {
    for (const [name, write] of writers(viewer)) {
      expect(await captureError(write), name).toBeInstanceOf(TripRoleError)
    }
  })

  it('tells a member who is not on a private archived trip nothing but “not found”', async () => {
    await archiveTrip(tenant.scope, desk.tripId)

    for (const [name, write] of writers(outsider)) {
      const error = await captureError(write)
      expect(error, name).toBeInstanceOf(NotFoundError)
      expect(error.message, name).not.toContain('archived')
    }
  })

  it('tells another workspace nothing but “not found”, archived or not', async () => {
    await archiveTrip(tenant.scope, desk.tripId)
    const other = await harness.seedTenant('booking-archive-other')

    for (const [name, write] of writers(other.scope)) {
      const error = await captureError(write)
      expect(error, name).toBeInstanceOf(NotFoundError)
      expect(error.message, name).not.toContain('archived')
    }
  })

  it('reads the archive off the row’s own trip, not off another trip of the workspace', async () => {
    const open = await createTrip(tenant.scope, {
      title: 'Porto',
      slug: 'porto',
    })
    const booking = await createReservation(tenant.scope, {
      tripId: open.id,
      title: 'Wine cellar',
    })
    await archiveTrip(tenant.scope, desk.tripId)

    await expect(
      setReservationStatus(tenant.scope, booking.id, 'confirmed'),
    ).resolves.toMatchObject({ status: 'confirmed' })
    expect(
      await captureError(() =>
        setReservationStatus(tenant.scope, desk.reservationId, 'confirmed'),
      ),
    ).toBeInstanceOf(TripArchivedError)
  })

  it('refuses before a booking exists, so no ledger line can be left behind', async () => {
    await archiveTrip(tenant.scope, desk.tripId)

    const error = await captureError(() =>
      createReservation(tenant.scope, {
        tripId: desk.tripId,
        title: 'Priced',
        priceMinor: 12_000,
        currency: 'EUR',
      }),
    )

    expect(error).toBeInstanceOf(TripArchivedError)
    const titles = (
      await listTripReservations(tenant.scope, { tripId: desk.tripId })
    ).map((row) => row.title)
    expect(titles).not.toContain('Priced')
  })

  it('hands the trip back to the import, which asks before it spends', async () => {
    await expect(
      requireWritableBookingTrip(editor, desk.tripId),
    ).resolves.toMatchObject({ id: desk.tripId })

    await archiveTrip(tenant.scope, desk.tripId)

    expect(
      await captureError(() => requireWritableBookingTrip(editor, desk.tripId)),
    ).toBeInstanceOf(TripArchivedError)
  })
})
