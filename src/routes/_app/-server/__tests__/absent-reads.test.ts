import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ForbiddenError,
  NotFoundError,
  TenantIsolationError,
  createCollection,
  createJourney,
  createTrip,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { AuthRequirementError } from '#/server/auth/tenant'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type * as ReactStart from '@tanstack/react-start'
import type * as Repos from '#/server/repos'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  scopeError: null as Error | null,
  repoError: null as Error | null,
}))

const scopeOrThrow = async () => {
  if (stubs.scopeError) throw stubs.scopeError
  return stubs.scope
}

// `cloudflare:workers` does not resolve in the Node test project, so both context modules are
// replaced by the scope the case seeded.
vi.mock('#/routes/_app/-server/context', () => ({ appScope: scopeOrThrow }))
vi.mock('#/server/fns/context', () => ({
  appScope: scopeOrThrow,
  mirrorToRoom: async () => undefined,
  patch: () => ({}),
  tombstone: () => ({}),
  orNull: (value: string | undefined) => value ?? null,
}))

// Outside a Start build the wrapper discards return values; keep the registered handler callable.
vi.mock('@tanstack/react-start', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactStart>()),
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handler: unknown) => handler,
    }
    return builder
  },
}))

vi.mock('#/server/billing/runtime.cloudflare', () => ({ billingRuntime: {} }))
vi.mock('#/server/transit/bindings', () => ({ transitRuntime: {} }))
vi.mock('#/server/auth/env', () => ({ authSecret: () => 'test-secret' }))

// Lets a case make the next trip lookup fail with an arbitrary repository error.
vi.mock('#/server/repos', async (importOriginal) => {
  const repos = await importOriginal<typeof Repos>()
  return {
    ...repos,
    requireTrip: (...args: Parameters<typeof repos.requireTrip>) => {
      if (stubs.repoError) throw stubs.repoError
      return repos.requireTrip(...args)
    },
  }
})

const { loadTripLists, loadTripFiles } = await import('../trip')
const { loadJourneyStory, loadCollectionDetail } = await import('../library')
const { loadCosts } = await import('#/server/fns/costs')
const { loadBookingDeskFn } = await import('#/server/fns/reservations')
const { loadTransportDeskFn } = await import('#/server/fns/transports')
const { loadTripCollab } =
  await import('#/routes/_app/trips/$tripId/-server/collab')
const { loadTripPeople } =
  await import('#/routes/_app/trips/$tripId/-server/people')
const { loadPlanBoard } =
  await import('#/routes/_app/trips/$tripId/-server/plan')
const { loadDayNotes } =
  await import('#/routes/_app/trips/$tripId/-server/day-notes')
const { loadPlanTransports } =
  await import('#/routes/_app/trips/$tripId/-server/plan-transports')

type Read = (input: { data: Record<string, string> }) => Promise<unknown>

const tripReads: ReadonlyArray<readonly [string, Read]> = [
  ['costs', loadCosts as unknown as Read],
  ['book', loadBookingDeskFn as unknown as Read],
  ['transports', loadTransportDeskFn as unknown as Read],
  ['collab', loadTripCollab as unknown as Read],
  ['people', loadTripPeople as unknown as Read],
  ['plan board', loadPlanBoard as unknown as Read],
  ['plan notes', loadDayNotes as unknown as Read],
  ['plan transports', loadPlanTransports as unknown as Read],
  ['files', loadTripFiles as unknown as Read],
  ['lists', loadTripLists as unknown as Read],
]

describe('absence of the thing a loader reads', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('absent-reader')
    stubs.scope = tenant.scope
    stubs.scopeError = null
    stubs.repoError = null
  })
  afterEach(() => {
    harness.close()
    vi.restoreAllMocks()
  })

  describe.each(tripReads)('the trip %s read', (_name, read) => {
    it('answers the same bare absence for a foreign, a missing and a private unreadable trip', async () => {
      const foreign = await harness.seedTenant('foreign')
      const foreignTrip = await createTrip(foreign.scope, {
        title: 'Foreign secret',
      })
      const privateTrip = await createTrip(tenant.scope, {
        title: 'Private secret',
        visibility: 'private',
      })
      stubs.scope = tenant.scopeFor(await tenant.addUser('non-participant'))
      for (const tripId of [
        foreignTrip.id,
        'missing-trip-id',
        privateTrip.id,
      ]) {
        await expect(read({ data: { tripId } })).resolves.toStrictEqual({
          found: false,
        })
      }
    })

    it('flags a readable trip as found', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Readable' })
      await expect(read({ data: { tripId: trip.id } })).resolves.toMatchObject({
        found: true,
      })
    })

    it.each([
      new ForbiddenError('read', ['owner']),
      new TenantIsolationError('trip'),
      new Error('Database unavailable'),
    ])('still throws a failure that is not a not-found: %s', async (error) => {
      stubs.repoError = error
      await expect(read({ data: { tripId: 'trip' } })).rejects.toBe(error)
    })

    it('does not report a not-found raised while resolving the session as absence', async () => {
      stubs.scopeError = new AuthRequirementError('unauthenticated', 'refused')
      await expect(read({ data: { tripId: 'trip' } })).rejects.toBe(
        stubs.scopeError,
      )
      stubs.scopeError = new NotFoundError('session', 'revoked')
      await expect(read({ data: { tripId: 'trip' } })).rejects.toBe(
        stubs.scopeError,
      )
    })
  })

  it('answers the same bare absence for a foreign and a missing journey', async () => {
    const foreign = await harness.seedTenant('foreign-journey')
    const journey = await createJourney(foreign.scope, { title: 'Secret log' })
    for (const journeyId of [journey.id, 'missing-journey-id']) {
      await expect(
        loadJourneyStory({ data: { journeyId } }),
      ).resolves.toStrictEqual({ found: false })
    }
  })

  it('flags a readable journey as found', async () => {
    const journey = await createJourney(tenant.scope, { title: 'Readable' })
    await expect(
      loadJourneyStory({ data: { journeyId: journey.id } }),
    ).resolves.toMatchObject({
      found: true,
      journey: { id: journey.id },
    })
  })

  it('answers the same bare absence for a foreign and a missing collection', async () => {
    const foreign = await harness.seedTenant('foreign-collection')
    const collection = await createCollection(foreign.scope, {
      name: 'Secret list',
    })
    for (const collectionId of [collection.id, 'missing-collection-id']) {
      await expect(
        loadCollectionDetail({ data: { collectionId } }),
      ).resolves.toStrictEqual({ found: false })
    }
  })

  it('flags a readable collection as found', async () => {
    const collection = await createCollection(tenant.scope, {
      name: 'Readable',
    })
    await expect(
      loadCollectionDetail({ data: { collectionId: collection.id } }),
    ).resolves.toMatchObject({
      found: true,
      collection: { id: collection.id },
    })
  })

  it('does not report a session not-found as an absent journey or collection', async () => {
    stubs.scopeError = new NotFoundError('session', 'revoked')
    await expect(loadJourneyStory({ data: { journeyId: 'j' } })).rejects.toBe(
      stubs.scopeError,
    )
    await expect(
      loadCollectionDetail({ data: { collectionId: 'c' } }),
    ).rejects.toBe(stubs.scopeError)
  })
})
