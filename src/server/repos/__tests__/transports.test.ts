/**
 * The two day references a transport is anchored to, at the repository seam.
 *
 * A journey leaves on one day and lands on another; neither is derived from the
 * other, and both are references into *this* trip's day run. That makes three
 * rules the repository owns rather than the form: a day of another trip is not a
 * day of this one, an arrival day before the departure day is refused, and a
 * transport with no day at all is a legal row — an idea has no day.
 *
 * A new file rather than a block appended to `repositories.test.ts`: this stage
 * owns `repos/transports.ts` and no shared repository test file except
 * `tenant-isolation.test.ts`, whose subject is the tenant boundary and not the
 * ordering of two days inside one trip. Cross-tenant day parenting is asserted
 * there, in this stage's own block, and deliberately not repeated here.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, RepositoryError } from '../context'
import { createDay, listTripDays } from '../days'
import { createTrip } from '../trips'
import {
  createTransport,
  getTransport,
  listDayTransports,
  updateTransport,
} from '../transports'
import { captureError, createHarness } from './harness'
import type { Day } from '#/server/db/types'
import type { Harness, SeededTenant } from './harness'

describe('a transport and the days it covers', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('solo')
    const trip = await createTrip(tenant.scope, {
      title: 'Tokyo overnight',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  it('anchors a night flight to the day it leaves and the day it lands', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Overnight to Haneda',
      mode: 'flight',
      dayId: days[0].id,
      arrivalDayId: days[1].id,
      departureDate: '2026-04-10',
      departureTime: '23:40',
      arrivalDate: '2026-04-11',
      arrivalTime: '06:15',
    })

    expect(created.dayId).toBe(days[0].id)
    expect(created.arrivalDayId).toBe(days[1].id)

    const read = await getTransport(tenant.scope, created.id)
    expect(read?.arrivalDayId).toBe(days[1].id)
  })

  it('keeps a draft with no day at all, because an idea has no day', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Maybe the ferry',
      mode: 'ferry',
    })

    expect(created.dayId).toBeNull()
    expect(created.arrivalDayId).toBeNull()
  })

  it('lets both ends sit on the same day', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Airport train',
      mode: 'train',
      dayId: days[1].id,
      arrivalDayId: days[1].id,
    })

    expect(created.arrivalDayId).toBe(days[1].id)
  })

  it('refuses an arrival day that precedes the departure day', async () => {
    const error = await captureError(() =>
      createTransport(tenant.scope, {
        tripId,
        title: 'Backwards flight',
        mode: 'flight',
        dayId: days[2].id,
        arrivalDayId: days[0].id,
      }),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('DAY_ORDER')
    expect(await listDayTransports(tenant.scope, days[2].id)).toEqual([])
  })

  /**
   * The rule is on the row that results, not on the fields that arrived: moving
   * only the arrival day has to be ordered against the departure day already
   * stored, or a two-step edit walks straight past the guard.
   */
  it('refuses a move that would leave the stored row out of order', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Overnight to Haneda',
      mode: 'flight',
      dayId: days[2].id,
      arrivalDayId: days[3].id,
    })

    const error = await captureError(() =>
      updateTransport(tenant.scope, created.id, { arrivalDayId: days[0].id }),
    )
    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('DAY_ORDER')

    const unchanged = await getTransport(tenant.scope, created.id)
    expect(unchanged?.arrivalDayId).toBe(days[3].id)
  })

  it('lets either day be cleared back to nothing', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Overnight to Haneda',
      mode: 'flight',
      dayId: days[0].id,
      arrivalDayId: days[1].id,
    })

    const cleared = await updateTransport(tenant.scope, created.id, {
      arrivalDayId: null,
    })
    expect(cleared.arrivalDayId).toBeNull()
    expect(cleared.dayId).toBe(days[0].id)

    // With the arrival day gone the departure day can move anywhere, including
    // past where the arrival day used to be.
    const moved = await updateTransport(tenant.scope, created.id, {
      dayId: days[3].id,
    })
    expect(moved.dayId).toBe(days[3].id)
  })

  it('refuses a day belonging to another trip of the same tenant', async () => {
    const other = await createTrip(tenant.scope, { title: 'Osaka weekend' })
    const foreignDay = await createDay(tenant.scope, {
      tripId: other.id,
      dayNumber: 1,
    })

    expect(
      await captureError(() =>
        createTransport(tenant.scope, {
          tripId,
          title: 'Cross-trip flight',
          mode: 'flight',
          arrivalDayId: foreignDay.id,
        }),
      ),
    ).toBeInstanceOf(NotFoundError)

    const own = await createTransport(tenant.scope, {
      tripId,
      title: 'Own flight',
      mode: 'flight',
      dayId: days[0].id,
    })
    expect(
      await captureError(() =>
        updateTransport(tenant.scope, own.id, { arrivalDayId: foreignDay.id }),
      ),
    ).toBeInstanceOf(NotFoundError)

    const unchanged = await getTransport(tenant.scope, own.id)
    expect(unchanged?.arrivalDayId).toBeNull()
  })
})
