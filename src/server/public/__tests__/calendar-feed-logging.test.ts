import { describe, expect, it } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip } from '#/server/repos/trips'
import { enableFeed } from '#/server/repos/calendar-feeds'
import { serveCalendarFeed } from '../calendar-feed'

describe('calendar feed diagnostic fields', () => {
  it('records bounded identifiers, scope and duration, with coarse refusal reasons and no credential', async () => {
    const h = await createHarness()
    const owner = await h.seedTenant('owner')
    const trip = await createTrip(owner.scope, {
      title: 'Trip',
      currency: 'EUR',
    })
    const feed = await enableFeed(owner.scope, {
      scope: 'trip',
      tripId: trip.id,
    })
    const records: Array<{ event: string; fields: unknown }> = []
    const runtime = {
      db: h.db,
      baseUrl: 'https://app.example',
      store: { get: async () => null, put: async () => {} },
      waitUntil: () => {},
      log: (event: string, fields: unknown) => {
        records.push({ event, fields })
      },
    }
    expect(
      (
        await serveCalendarFeed(
          new Request(`https://app.example/api/feed/${feed.secret}.ics`),
          runtime,
        )
      ).status,
    ).toBe(200)
    expect(records[0]).toMatchObject({
      event: 'served',
      fields: {
        feedId: feed.feedId,
        scope: 'trip',
        status: 200,
        durationMs: expect.any(Number),
      },
    })
    await serveCalendarFeed(
      new Request('https://app.example/api/feed/unknown.ics'),
      runtime,
    )
    expect(records[1]).toMatchObject({
      event: 'not-found',
      fields: {
        reason: 'unresolved',
        status: 404,
        durationMs: expect.any(Number),
      },
    })
    expect(JSON.stringify(records)).not.toContain(feed.secret)
    expect(JSON.stringify(records)).not.toContain('/api/feed/')
    h.close()
  })
})
