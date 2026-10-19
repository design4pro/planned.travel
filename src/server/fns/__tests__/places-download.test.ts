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
        downloadTripPlacesFn({ data: { tripId } }),
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

describe('the places download server function', () => {
  it.each(['owner', 'editor', 'viewer', 'organization'] as const)(
    'allows a %s reader on the free plan too',
    async (role) => {
      let scope = tenant.scope
      if (role !== 'owner') {
        const userId = await tenant.addUser(`Reader ${role}`)
        scope = tenant.scopeFor(userId)
        if (role === 'organization')
          await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
        else await addTripMember(tenant.scope, { tripId, userId, role })
      }
      // No export entitlement or quota is required.
      const response = await download(scope, tripId)
      expect(response.headers.get('content-type')).toBe(
        'application/geo+json; charset=utf-8',
      )
      expect(response.headers.get('content-disposition')).toBe(
        "attachment; filename*=UTF-8''lisbon-spring-places.geojson",
      )
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(await response.json()).toMatchObject({
        type: 'FeatureCollection',
        features: [{ properties: { name: 'Museum', category: 'Culture' } }],
      })
    },
  )

  it('refuses private and public nonmembers and foreign workspaces before reading any export data', async () => {
    const stranger = tenant.scopeFor(await tenant.addUser('Stranger'))
    const foreign = (await harness.seedTenant('foreign-download')).scope
    const places = vi.spyOn(placeReads, 'listTripPlaces')
    const categories = vi.spyOn(categoryReads, 'listCategories')
    const missing = await download(tenant.scope, 'missing').catch(
      (error: unknown) => error,
    )
    expect(missing).toBeInstanceOf(Error)
    expect(missing).toMatchObject({ name: 'NotFoundError' })
    for (const visibility of ['private', 'public'] as const) {
      await updateTrip(tenant.scope, tripId, { visibility })
      for (const scope of [stranger, foreign]) {
        const error = await download(scope, tripId).catch(
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
    const body = (await (
      await download(tenant.scope, tripId)
    ).json()) as ReturnType<typeof placesGeoJson>
    expect(body.features.map((feature) => feature.properties.name)).toEqual([
      'Museum',
      ...Array.from({ length: 501 }, (_, i) => `Place ${i}`),
    ])
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it('returns an empty collection and a safe fallback filename for a non-Latin title', async () => {
    const trip = await createTrip(tenant.scope, { title: '東京' })
    const response = await download(tenant.scope, trip.id)
    expect(response.headers.get('content-disposition')).toBe(
      "attachment; filename*=UTF-8''trip-places.geojson",
    )
    expect(await response.json()).toEqual({
      type: 'FeatureCollection',
      features: [],
    })
  })

  it('validates ids and requires a session', async () => {
    expect(downloadTripPlacesInput.safeParse({ tripId: '' }).success).toBe(
      false,
    )
    expect(
      downloadTripPlacesInput.safeParse({ tripId: 'a'.repeat(65) }).success,
    ).toBe(false)
    await expect(download(null, tripId)).rejects.toThrow('unauthenticated')
  })
})
