import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTrip,
  addTripMember,
  listTripDays,
  listTripMembers,
  requireTrip,
  ForbiddenError,
  NotFoundError,
  TenantIsolationError,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type * as Repos from '#/server/repos'
import { loadTripHeader, loadTripFiles } from '../trip'
import { AuthRequirementError } from '#/server/auth/tenant'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  scopeError: null as Error | null,
}))

vi.mock('../context', () => ({
  appScope: () => {
    if (stubs.scopeError) throw stubs.scopeError
    return stubs.scope
  },
}))

// Outside the Start build the wrapper discards return values. Keep the registered handler
// callable so assertions cover its result, with real repositories and an authenticated scope.
vi.mock('#/server/clock', () => ({ serverToday: () => '2026-10-16' }))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: () => ({
      handler: (handler: (options: { data: { tripId: string } }) => unknown) =>
        handler,
    }),
  }),
}))

vi.mock('#/server/repos', async (importOriginal) => {
  const repos = await importOriginal<typeof Repos>()
  return {
    ...repos,
    requireTrip: vi.fn(repos.requireTrip),
    listTripDays: vi.fn(repos.listTripDays),
    listTripMembers: vi.fn(repos.listTripMembers),
  }
})

describe('trip header read result', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    vi.clearAllMocks()
    harness = await createHarness()
    tenant = await harness.seedTenant('header-reader')
    stubs.scope = tenant.scope
    stubs.scopeError = null
  })
  afterEach(() => {
    harness.close()
    vi.restoreAllMocks()
  })

  it('returns exactly the same absence for foreign, missing and private unreadable trips', async () => {
    const foreign = await harness.seedTenant('foreign')
    const foreignTrip = await createTrip(foreign.scope, {
      title: 'Foreign secret',
    })
    const privateTrip = await createTrip(tenant.scope, {
      title: 'Private secret',
      visibility: 'private',
    })
    stubs.scope = tenant.scopeFor(await tenant.addUser('non-participant'))
    for (const tripId of [foreignTrip.id, 'missing-trip-id', privateTrip.id]) {
      await expect(loadTripHeader({ data: { tripId } })).resolves.toStrictEqual(
        { found: false },
      )
    }
    expect(listTripDays).not.toHaveBeenCalled()
    expect(listTripMembers).not.toHaveBeenCalled()
  })

  it.each(['owner', 'editor', 'viewer', 'non-member'] as const)(
    'the files loader exposes write permission for %s',
    async (role) => {
      const trip = await createTrip(tenant.scope, {
        title: 'Shared files',
        visibility: 'organization',
      })
      if (role !== 'owner') {
        const userId = await tenant.addUser(role)
        if (role !== 'non-member') {
          await addTripMember(tenant.scope, { tripId: trip.id, userId, role })
        }
        stubs.scope = tenant.scopeFor(userId)
      }
      await expect(
        loadTripFiles({ data: { tripId: trip.id } }),
      ).resolves.toMatchObject({
        canWrite: role === 'owner' || role === 'editor',
      })
    },
  )

  it('retains the existing header payload for a readable trip', async () => {
    const trip = await createTrip(tenant.scope, {
      title: 'Readable',
      dayCount: 2,
    })
    await expect(
      loadTripHeader({ data: { tripId: trip.id } }),
    ).resolves.toMatchObject({
      found: true,
      trip: { id: trip.id, title: 'Readable' },
      people: expect.any(Array),
      dayCount: 2,
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })

  it.each([
    new ForbiddenError('read', ['owner']),
    new TenantIsolationError('trip'),
    new Error('Database unavailable'),
  ])('propagates a non-not-found repository failure: %s', async (error) => {
    vi.mocked(requireTrip).mockRejectedValueOnce(error)
    await expect(loadTripHeader({ data: { tripId: 'trip' } })).rejects.toBe(
      error,
    )
  })

  it.each(['unauthenticated', 'not-a-member'] as const)(
    'propagates an auth scope failure: %s',
    async (reason) => {
      stubs.scopeError = new AuthRequirementError(reason, 'Session refused')
      await expect(loadTripHeader({ data: { tripId: 'trip' } })).rejects.toBe(
        stubs.scopeError,
      )
      expect(requireTrip).not.toHaveBeenCalled()
    },
  )

  it('propagates a scope failure even when it is a not-found error', async () => {
    stubs.scopeError = new NotFoundError('session', 'revoked')
    await expect(loadTripHeader({ data: { tripId: 'trip' } })).rejects.toBe(
      stubs.scopeError,
    )
  })

  it.each(['people', 'days'])(
    'does not swallow a not-found failure reading %s',
    async (read) => {
      const trip = await createTrip(tenant.scope, { title: 'Readable' })
      const error = new NotFoundError(read, 'unavailable')
      if (read === 'people')
        vi.mocked(listTripMembers).mockRejectedValueOnce(error)
      else vi.mocked(listTripDays).mockRejectedValueOnce(error)
      await expect(loadTripHeader({ data: { tripId: trip.id } })).rejects.toBe(
        error,
      )
    },
  )
})
