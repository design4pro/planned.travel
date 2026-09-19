/**
 * The planner's reverse lookup: who may spend it, and what a refusal looks like.
 *
 * The property the ordering exists for — a refused caller costs nothing — is asserted on the
 * ports: the runtime factory and the subscription read must have zero calls. The proxy itself is
 * the real one, driven through an in-memory runtime, because what `{ address: null }` stands for
 * is the proxy's own refusals and nothing narrower.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotFoundError,
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { GeoProviderError } from '#/server/geo/geocode'

import type {
  GeocodeCandidate,
  GeocodeRuntime,
  GeocodeVendor,
} from '#/server/geo/geocode'
import type { OutboundRuntime } from '#/server/metering/outbound'
import type { GeocodeRuntimeOptions } from '#/server/geo/bindings'
import type { SeededTenant } from '#/server/repos/__tests__/harness'
import type * as Repos from '#/server/repos'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const spies = vi.hoisted(() => ({ getSubscription: vi.fn() }))

/** `cloudflare:workers` does not resolve here; every test hands the runtime in as a port. */
vi.mock('#/server/geo/bindings', () => ({
  geocodeRuntime: () => {
    throw new Error('geocodeRuntime is not reached: these tests hand it in.')
  },
}))

vi.mock('../../../../-server/context', () => ({
  appScope: () => {
    throw new Error('appScope is not reached: these tests hand the scope in.')
  },
}))

/** The real read, observed — "before the subscription" is a call count. */
vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repos>()
  spies.getSubscription.mockImplementation(actual.getSubscription)
  return { ...actual, getSubscription: spies.getSubscription }
})

const { reverseLookup } = await import('../geocode')

/* ------------------------------------------------------------------ runtime */

const CANDIDATE: GeocodeCandidate = {
  id: 'osm:node:1',
  name: 'Stephansdom',
  address: '  Stephansplatz 3, 1010 Wien  ',
  city: 'Wien',
  countryCode: 'AT',
  lat: 48.2085,
  lng: 16.3731,
}

interface Ports {
  readonly geocoding: ReturnType<
    typeof vi.fn<(options: GeocodeRuntimeOptions) => GeocodeRuntime>
  >
  readonly reverse: ReturnType<typeof vi.fn>
}

/** An in-memory runtime; `provider: null` is a deployment holding no credential. */
function ports(options: {
  readonly answer?: ReadonlyArray<GeocodeCandidate>
  /** What the vendor call throws instead of answering. */
  readonly failure?: Error
  readonly configured?: boolean
  readonly ceiling?: number
}): Ports {
  const entries = new Map<string, string>()
  const store = {
    get: (key: string) => Promise.resolve(entries.get(key) ?? null),
    put: (key: string, value: string) => {
      entries.set(key, value)
      return Promise.resolve()
    },
  }
  const vendor: GeocodeVendor = {
    slug: 'geoapify',
    retention: 'permanent',
    attribution: [{ name: 'Stub', url: 'https://example.test/' }],
  }
  const reverse = vi.fn(() =>
    options.failure === undefined
      ? Promise.resolve(options.answer ?? [])
      : Promise.reject(options.failure),
  )
  const geocoding = vi.fn((runtime: GeocodeRuntimeOptions): GeocodeRuntime => ({
    cache: store,
    counters: store,
    vendor,
    provider:
      options.configured === false
        ? null
        : { ...vendor, forward: () => Promise.resolve([]), reverse },
    outbound: {
      db: null,
      waitUntil: () => undefined,
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      } as unknown as OutboundRuntime['logger'],
      now: () => new Date('2026-09-19T10:00:00Z'),
    },
    organizationId: runtime.organizationId,
    // The plan's own allowance is not what is under test; a refusal case sets it explicitly.
    ceiling: options.ceiling ?? 100,
    now: () => new Date('2026-09-19T10:00:00Z'),
  }))
  return { geocoding, reverse }
}

const POINT = { lat: 48.208493, lng: 16.373118, language: 'en' } as const

/* ------------------------------------------------------------------ fixture */

let tenant: SeededTenant
let owner: TenantScope
let viewer: TenantScope
let tripId: string
let foreignTripId: string

beforeEach(async () => {
  spies.getSubscription.mockClear()
  const harness = await createHarness()
  tenant = await harness.seedTenant('planner')
  owner = tenant.scope

  const viewerId = await tenant.addUser('A reader')
  viewer = tenant.scopeFor(viewerId)

  const trip = await createTrip(owner, {
    title: 'Vienna in October',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    currency: 'EUR',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: viewerId,
    role: 'viewer',
  })
  tripId = trip.id

  const other = await harness.seedTenant('elsewhere')
  foreignTripId = (
    await createTrip(other.scope, {
      title: 'Not yours',
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      currency: 'EUR',
    })
  ).id
})

/* -------------------------------------------------------------------- cases */

describe('reverseLookup', () => {
  it.each([
    [
      'a foreign trip',
      () => ({ scope: owner, trip: foreignTripId }),
      NotFoundError,
    ],
    [
      'a trip the caller only views',
      () => ({ scope: viewer, trip: tripId }),
      TripRoleError,
    ],
  ] as const)(
    'refuses %s before it reads the plan or reaches the provider',
    async (_, caller, refusal) => {
      const { scope, trip } = caller()
      const port = ports({ answer: [CANDIDATE] })

      await expect(
        reverseLookup(scope, { tripId: trip, ...POINT }, port),
      ).rejects.toBeInstanceOf(refusal)

      expect(spies.getSubscription).not.toHaveBeenCalled()
      expect(port.geocoding).not.toHaveBeenCalled()
      expect(port.reverse).not.toHaveBeenCalled()
    },
  )

  it('refuses an archived trip before it reads the plan or reaches the provider', async () => {
    await archiveTrip(owner, tripId)
    const port = ports({ answer: [CANDIDATE] })

    await expect(
      reverseLookup(owner, { tripId, ...POINT }, port),
    ).rejects.toBeInstanceOf(TripArchivedError)

    expect(spies.getSubscription).not.toHaveBeenCalled()
    expect(port.geocoding).not.toHaveBeenCalled()
    expect(port.reverse).not.toHaveBeenCalled()
  })

  it("answers with the first candidate's address, trimmed", async () => {
    const port = ports({ answer: [CANDIDATE] })

    await expect(
      reverseLookup(owner, { tripId, ...POINT }, port),
    ).resolves.toEqual({ address: 'Stephansplatz 3, 1010 Wien' })

    expect(spies.getSubscription).toHaveBeenCalledOnce()
    expect(port.geocoding).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ceiling: expect.any(Number) as number,
    })
    expect(port.reverse).toHaveBeenCalledOnce()
  })

  it('answers with no address when the point has none', async () => {
    await expect(
      reverseLookup(owner, { tripId, ...POINT }, ports({ answer: [] })),
    ).resolves.toEqual({ address: null })
  })

  it.each([
    ['holds no credential', { configured: false }],
    ['has spent its allowance', { ceiling: 0 }],
  ] as const)(
    'turns a proxy that %s into no address, not an error',
    async (_, refusal) => {
      const port = ports({ answer: [CANDIDATE], ...refusal })

      await expect(
        reverseLookup(owner, { tripId, ...POINT }, port),
      ).resolves.toEqual({ address: null })
      expect(port.reverse).not.toHaveBeenCalled()
    },
  )

  it('turns a provider that cannot be reached into no address, not an error', async () => {
    const port = ports({
      failure: new GeoProviderError('unreachable', 'The provider is down.'),
    })

    await expect(
      reverseLookup(owner, { tripId, ...POINT }, port),
    ).resolves.toEqual({ address: null })
    expect(port.reverse).toHaveBeenCalledOnce()
  })

  it('lets any other failure through', async () => {
    const port = ports({ failure: new Error('A bug, not a refusal.') })

    await expect(
      reverseLookup(owner, { tripId, ...POINT }, port),
    ).rejects.toThrow('A bug, not a refusal.')
  })
})
