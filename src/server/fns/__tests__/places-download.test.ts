import { AsyncLocalStorage } from 'node:async_hooks'
import { requestHandler } from '@tanstack/react-start/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addTripMember, createTrip, updateTrip } from '#/server/repos/trips'
import { createPlace, placesRepository } from '#/server/repos/places'
import { createCategory } from '#/server/repos/categories'
import * as placeReads from '#/server/repos/places'
import * as categoryReads from '#/server/repos/categories'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { SeededTenant, Harness } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos/base'
import type { placesGeoJson } from '#/server/places/geojson'

const runtime = vi.hoisted(() => ({ scope: null as TenantScope | null }))
vi.mock('../context', () => ({
  appScope: () => {
    if (!runtime.scope) throw new Error('unauthenticated')
    return runtime.scope
  },
}))
const { downloadTripPlacesFn, downloadTripPlacesInput } =
  await import('../places-download')

async function download(
  scope: TenantScope | null,
  tripId: string,
  format?: 'geojson' | 'gpx',
): Promise<Response> {
  runtime.scope = scope
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage()
  const storage = globals[key] as AsyncLocalStorage<{
    startOptions: Record<string, never>
    request: Request
  }>
  const request = new Request('https://planned.travel/_serverFn/places')
  let result: Response | undefined
  let failure: unknown
  await requestHandler(async () => {
    try {
      result = await storage.run({ startOptions: {}, request }, () =>
        downloadTripPlacesFn({ data: { tripId, format } }),
      )
    } catch (error) {
      failure = error
    }
    return new Response(null, { status: 204 })
  })(request, {})
  if (failure) throw failure
  if (!result) throw new Error('No download response')
  return result
}

let harness: Harness
let tenant: SeededTenant
let tripId: string
beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('places-download')
  tripId = (
    await createTrip(tenant.scope, {
      title: 'Lisbon spring',
      visibility: 'private',
    })
  ).id
  const category = await createCategory(tenant.scope, { name: 'Culture' })
  await createPlace(tenant.scope, {
    tripId,
    name: 'Museum',
    categoryId: category.id,
    lat: 38.7,
    lng: -9.1,
  })
})

describe.each(['geojson', 'gpx'] as const)(
  'the %s places download server function',
  (format) => {
    it('exports an unprepared workspace without initializing categories', async () => {
      const { categoryInitializations } = await import('#/server/db/schema')
      const { eq } = await import('drizzle-orm')
      for (const row of await categoryReads.listCategories(tenant.scope)) await categoryReads.deleteCategory(tenant.scope, row.id)
      await harness.db.delete(categoryInitializations).where(eq(categoryInitializations.organizationId, tenant.organizationId))
      await download(tenant.scope, tripId, format)
      expect(await categoryReads.listCategories(tenant.scope)).toEqual([])
      expect(await harness.db.select().from(categoryInitializations)).toEqual([])
    })

    it.each(['owner', 'editor', 'viewer', 'organization'] as const)(
      'allows a %s reader on the free plan too',
      async (role) => {
        let scope = tenant.scope
        if (role !== 'owner') {
          const userId = await tenant.addUser(`Reader ${role}`)
          scope = tenant.scopeFor(userId)
          if (role === 'organization')
            await updateTrip(tenant.scope, tripId, {
              visibility: 'organization',
            })
          else await addTripMember(tenant.scope, { tripId, userId, role })
        }
        // No export entitlement or quota is required.
        const response = await download(scope, tripId, format)
        expect(response.headers.get('content-type')).toBe(
          format === 'gpx'
            ? 'application/gpx+xml; charset=utf-8'
            : 'application/geo+json; charset=utf-8',
        )
        expect(response.headers.get('content-disposition')).toBe(
          `attachment; filename*=UTF-8''lisbon-spring-places.${format}`,
        )
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        if (format === 'gpx') {
          expect(response.headers.get('x-places-omitted')).toBe('0')
          expect(await response.text()).toContain('<name>Museum</name>')
        } else {
          expect(await response.json()).toMatchObject({
            type: 'FeatureCollection',
            features: [{ properties: { name: 'Museum', category: 'Culture' } }],
          })
        }
      },
    )

    it('refuses private and public nonmembers and foreign workspaces before reading any export data', async () => {
      const stranger = tenant.scopeFor(await tenant.addUser('Stranger'))
      const foreign = (await harness.seedTenant('foreign-download')).scope
      const places = vi.spyOn(placeReads, 'listTripPlaces')
      const categories = vi.spyOn(categoryReads, 'listCategories')
      const missing = await download(tenant.scope, 'missing', format).catch(
        (error: unknown) => error,
      )
      expect(missing).toBeInstanceOf(Error)
      expect(missing).toMatchObject({ name: 'NotFoundError' })
      for (const visibility of ['private', 'public'] as const) {
        await updateTrip(tenant.scope, tripId, { visibility })
        for (const scope of [stranger, foreign]) {
          const error = await download(scope, tripId, format).catch(
            (cause: unknown) => cause,
          )
          expect(error).toMatchObject({
            name: 'NotFoundError',
            code: 'NOT_FOUND',
            message: `trip ${tripId} was not found.`,
          })
        }
      }
      expect(places).not.toHaveBeenCalled()
      expect(categories).not.toHaveBeenCalled()
    })

    it('includes over 500 rows in board order and excludes another trip and tenant', async () => {
      // Repository insertion avoids quota writes; each insert still applies tenant scoping.
      for (let index = 0; index < 501; index++) {
        await placesRepository.insert(tenant.scope, {
          tripId,
          name: `Place ${index}`,
          sortOrder: index + 1,
          lat: 0,
          lng: 0,
        })
      }
      const otherTrip = await createTrip(tenant.scope, { title: 'Other' })
      await placesRepository.insert(tenant.scope, {
        tripId: otherTrip.id,
        name: 'Other trip secret',
      })
      const foreign = await harness.seedTenant('foreign-places')
      const foreignTrip = await createTrip(foreign.scope, { title: 'Foreign' })
      await createPlace(foreign.scope, {
        tripId: foreignTrip.id,
        name: 'Foreign secret',
      })
      const response = await download(tenant.scope, tripId, format)
      const names = [
        'Museum',
        ...Array.from({ length: 501 }, (_, i) => `Place ${i}`),
      ]
      if (format === 'gpx') {
        const xml = await response.text()
        expect(
          [...xml.matchAll(/<name>(.*?)<\/name>/g)].map((match) => match[1]),
        ).toEqual(names)
        expect(xml).not.toContain('secret')
      } else {
        const body = (await response.json()) as ReturnType<typeof placesGeoJson>
        expect(body.features.map((feature) => feature.properties.name)).toEqual(
          names,
        )
        expect(JSON.stringify(body)).not.toContain('secret')
      }
    })

    it('returns an empty file and safe fallback filename for a non-Latin title', async () => {
      const trip = await createTrip(tenant.scope, { title: '東京' })
      const response = await download(tenant.scope, trip.id, format)
      expect(response.headers.get('content-disposition')).toBe(
        `attachment; filename*=UTF-8''trip-places.${format}`,
      )
      if (format === 'gpx') {
        expect(response.headers.get('x-places-omitted')).toBe('0')
        expect(await response.text()).not.toContain('<wpt')
      } else
        expect(await response.json()).toEqual({
          type: 'FeatureCollection',
          features: [],
        })
    })

    it('validates ids and requires a session', async () => {
      expect(
        downloadTripPlacesInput.safeParse({ tripId, format: 'xml' }).success,
      ).toBe(false)
      expect(downloadTripPlacesInput.parse({ tripId }).format).toBe('geojson')
      expect(downloadTripPlacesInput.safeParse({ tripId: '' }).success).toBe(
        false,
      )
      expect(
        downloadTripPlacesInput.safeParse({ tripId: 'a'.repeat(65) }).success,
      ).toBe(false)
      const places = vi.spyOn(placeReads, 'listTripPlaces')
      const categories = vi.spyOn(categoryReads, 'listCategories')
      await expect(download(null, tripId, format)).rejects.toThrow(
        'unauthenticated',
      )
      expect(places).not.toHaveBeenCalled()
      expect(categories).not.toHaveBeenCalled()
    })
  },
)

it('defaults old callers to GeoJSON and reports omissions from the exported GPX snapshot', async () => {
  const original = await download(tenant.scope, tripId)
  expect(original.headers.get('content-type')).toBe(
    'application/geo+json; charset=utf-8',
  )
  await createPlace(tenant.scope, { tripId, name: 'No location' })
  const response = await download(tenant.scope, tripId, 'gpx')
  expect(response.headers.get('x-places-omitted')).toBe('1')
  expect(response.headers.get('x-places-total')).toBe('2')
  const xml = await response.text()
  expect(xml).toContain('<name>Museum</name>')
  expect(xml).not.toContain('No location')
  const empty = await createTrip(tenant.scope, { title: 'Unlocated' })
  await createPlace(tenant.scope, { tripId: empty.id, name: 'No location' })
  const allOmitted = await download(tenant.scope, empty.id, 'gpx')
  expect(allOmitted.headers.get('x-places-omitted')).toBe('1')
  expect(allOmitted.headers.get('x-places-total')).toBe('1')
  expect(await allOmitted.text()).not.toContain('<wpt')
})
