/**
 * Who chooses a trip's primary key.
 *
 * Two callers, two answers. A real user names nothing and gets the column's own generator: a
 * time-sortable key whose prefix is the millisecond it was created, so `order by id` is `order by
 * creation time` and every paginated list can page on it. The demo fixture names the key itself,
 * because a trip's cover art is a pure hash of its id — regenerate the key and every card in the
 * product is repainted, which moves every screenshot that photographs one.
 *
 * The second half of this file is the guard that turns that into a failing test rather than a
 * surprise: the six demo ids are restated here, so editing one in the dataset reddens the suite
 * before it reddens a baseline.
 */

import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest'
import { trips as demoTrips } from '#/routes/api/dev/-seed/dataset'
import { trips } from '#/server/db/schema'
import {
  createTrip,
  deleteTrip,
  getTripBySlug,
  listTrips,
  tripsRepository,
  updateTrip,
  updateTripInput,
} from '../trips'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { UpdateTripInput } from '../trips'
import type { Trip } from '#/server/db/types'

/**
 * The key each demo trip must carry, in the order the applier writes them.
 *
 * Restated rather than imported on purpose: a check that reads its expectation out of the code it
 * is checking cannot fail. `scripts/seed/verify.mjs` holds the same list for the same reason, and
 * checks it against the rows actually in the database.
 */
const DEMO_TRIP_IDS = [
  'demo-trip-01-tokyo-and-kyoto',
  'demo-trip-02-lisbon-long-weekend',
  'demo-trip-03-dolomites-hut-to-hut',
  'demo-trip-04-marrakech-riad-week',
  'demo-trip-05-patagonia-traverse',
  'demo-trip-06-porto-one-lunch',
]

/** A generated key: nine base-36 timestamp characters followed by sixteen random ones. */
const GENERATED_ID = /^[0-9a-z]{9}[A-Za-z0-9_-]{16}$/

describe('trip identifiers', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('keys')
    await subscribeTenant(tenant.scope, 'crew')
  })

  describe('when the caller names no id', () => {
    it('mints a fresh, time-sortable key — the path every real user takes', async () => {
      const first = await createTrip(tenant.scope, { title: 'Faroe Islands' })
      const second = await createTrip(tenant.scope, {
        title: 'Faroe Islands again',
      })

      expect(first.id).toMatch(GENERATED_ID)
      expect(second.id).toMatch(GENERATED_ID)
      expect(second.id).not.toBe(first.id)
      // Sortable to the millisecond, which is the granularity the prefix carries; inside one
      // millisecond the random half decides and no order is promised.
      expect(second.id.slice(0, 9) >= first.id.slice(0, 9)).toBe(true)

      const minted = Number.parseInt(first.id.slice(0, 9), 36)
      expect(Math.abs(minted - Date.now())).toBeLessThan(60_000)
    })
  })

  describe('when the caller names one', () => {
    it('keys the row by exactly that string, and reads back by it', async () => {
      const trip = await createTrip(tenant.scope, {
        id: 'demo-trip-42-faroe-islands',
        title: 'Faroe Islands',
        slug: 'faroe-islands',
      })

      expect(trip.id).toBe('demo-trip-42-faroe-islands')
      expect((await getTripBySlug(tenant.scope, 'faroe-islands'))?.id).toBe(
        'demo-trip-42-faroe-islands',
      )
      expect((await listTrips(tenant.scope)).map((row) => row.id)).toEqual([
        'demo-trip-42-faroe-islands',
      ])
    })

    it('rebuilds the trip under the same key, which is what makes a re-seed a no-op', async () => {
      const first = await createTrip(tenant.scope, {
        id: 'demo-trip-42-faroe',
        title: 'Faroe',
      })
      await deleteTrip(tenant.scope, first.id)
      const second = await createTrip(tenant.scope, {
        id: 'demo-trip-42-faroe',
        title: 'Faroe',
      })

      expect(second.id).toBe(first.id)
    })

    it('validates it like any other id, so a blank one is refused', async () => {
      await expect(
        createTrip(tenant.scope, { id: '   ', title: 'Nowhere' }),
      ).rejects.toThrow()
      await expect(
        createTrip(tenant.scope, { id: 'x'.repeat(65), title: 'Nowhere' }),
      ).rejects.toThrow()
      expect(await listTrips(tenant.scope)).toEqual([])
    })

    it('is a creation-only field: an update can never move the key', () => {
      const patch = updateTripInput.parse({
        title: 'Renamed',
        id: 'demo-trip-99-hijacked',
      })
      expect(patch).not.toHaveProperty('id')
    })
  })

  describe('the demo fixture', () => {
    it('declares a fixed id for every trip', () => {
      expect(demoTrips.map((trip) => trip.id)).toEqual(DEMO_TRIP_IDS)
    })

    it('ascends in the order the applier writes them, so `order by id` still pages correctly', () => {
      const ids = demoTrips.map((trip) => trip.id)
      expect([...ids].sort()).toEqual(ids)
    })

    it('names each trip in its own key, so a dump reads as prose', () => {
      for (const trip of demoTrips) {
        expect(trip.id.endsWith(trip.slug)).toBe(true)
      }
    })

    it('writes byte-identical keys when the workspace is rebuilt', async () => {
      const build = async (): Promise<Array<string>> => {
        const written: Array<string> = []
        for (const trip of demoTrips) {
          const row = await createTrip(tenant.scope, {
            id: trip.id,
            title: trip.title,
            slug: trip.slug,
          })
          written.push(row.id)
        }
        return written
      }

      const before = await build()
      for (const id of before) {
        await deleteTrip(tenant.scope, id)
      }
      const after = await build()

      expect(after).toEqual(before)
      expect(after).toEqual(DEMO_TRIP_IDS)
    })
  })
})

/**
 * The deprecated `trips.is_favourite` column (#206): one boolean shared by every member, so it
 * records nobody's choice. The favourite lives in `trip_favourites`; this column may only be set by
 * the seed at creation, and no reader's row type may name it.
 */
describe('the retired trips.is_favourite column', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('favourite-column')
    await subscribeTenant(tenant.scope, 'crew')
  })

  it('is not a field an update accepts', () => {
    const patch = updateTripInput.parse({ title: 'Renamed', isFavourite: true })
    expect(patch).not.toHaveProperty('isFavourite')
    expectTypeOf<UpdateTripInput>().not.toHaveProperty('isFavourite')
  })

  it('is left untouched by an update that tries to patch it anyway', async () => {
    const trip = await createTrip(tenant.scope, { title: 'Faroe Islands' })
    await updateTrip(tenant.scope, trip.id, {
      title: 'Faroe Islands, again',
      isFavourite: true,
    } as UpdateTripInput)

    const row = await tripsRepository.findOne(
      tenant.scope,
      eq(trips.id, trip.id),
    )
    expect(row?.title).toBe('Faroe Islands, again')
    expect(row?.isFavourite).toBe(false)
  })

  it('is projected out of the row type readers are written against', () => {
    expectTypeOf<Trip>().not.toHaveProperty('isFavourite')
  })
})
