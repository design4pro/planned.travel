import { beforeEach, describe, expect, it } from 'vitest'
import { parseIcsCalendar } from '#/server/queue/ics'
import { NotFoundError } from '#/server/repos'
import { createPlace } from '#/server/repos/places'
import { createAssignment } from '#/server/repos/itinerary'
import { createTrip } from '#/server/repos/trips'
import { listTripDays } from '#/server/repos/days'
import {
  captureError,
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { tripCalendarResponse } from '../download'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

const BASE_URL = 'https://app.planned.travel'

describe('tripCalendarResponse', () => {
  let harness: Harness
  let alpha: SeededTenant
  let tripId: string
  let slug: string

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    await subscribeTenant(alpha.scope, 'crew')
    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
    })
    tripId = trip.id
    slug = trip.slug
    const day = (await listTripDays(alpha.scope, trip.id)).at(0)
    if (day === undefined) {
      throw new Error('A dated trip must have a day run.')
    }
    const place = await createPlace(alpha.scope, {
      tripId,
      name: 'Miradouro',
    })
    await createAssignment(alpha.scope, {
      tripId,
      dayId: day.id,
      placeId: place.id,
      startTime: '09:30',
    })
  })

  it('answers a private, uncached text/calendar attachment named after the trip', async () => {
    const response = await tripCalendarResponse(alpha.scope, tripId, BASE_URL)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/calendar; charset=utf-8',
    )
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename*=UTF-8''${slug}.ics`,
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('writes a calendar the trip’s own reader can parse back', async () => {
    const response = await tripCalendarResponse(alpha.scope, tripId, BASE_URL)
    const text = await response.text()

    const events = parseIcsCalendar(text)
    expect(text).toContain('X-WR-CALNAME:Lisbon in spring')
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(text).toContain(`URL:${BASE_URL}/trips/${tripId}`)
  })

  it('refuses a trip the reader cannot open, as it refuses one that does not exist', async () => {
    const stranger = alpha.scopeFor(await alpha.addUser('Alpha the second'))

    expect(
      await captureError(() =>
        tripCalendarResponse(stranger, tripId, BASE_URL),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect(
      await captureError(() =>
        tripCalendarResponse(alpha.scope, 'no-such-trip', BASE_URL),
      ),
    ).toBeInstanceOf(NotFoundError)
  })
})
