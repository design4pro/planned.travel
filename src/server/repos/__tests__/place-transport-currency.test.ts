import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mintId } from '#/lib/ids'
import { NotFoundError } from '../context'
import { createPlace, getPlace, listTripPlaces, updatePlace } from '../places'
import {
  createTransport,
  listTripLegs,
  listTripTransports,
  saveSearchedConnection,
  saveTransport,
  TransportRefusalError,
} from '../transports'
import {
  addTripMember,
  archiveTrip,
  createTrip,
  TripArchivedError,
  TripRoleError,
} from '../trips'
import { createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

let harness: Harness
let tenant: SeededTenant
let tripId: string
let placeId: string
let transportId: string
const chain = { stations: [{ name: 'Lisboa' }, { name: 'Porto' }], legs: [{}] }

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('currency')
  tripId = (
    await createTrip(tenant.scope, { title: 'Portugal', currency: 'EUR' })
  ).id
  placeId = (
    await createPlace(tenant.scope, { tripId, name: 'Museum', priceMinor: 100 })
  ).id
  transportId = (
    await saveTransport(tenant.scope, {
      tripId,
      transportId: mintId(),
      intent: 'create',
      record: { title: 'Train', priceMinor: 200 },
      chain,
    })
  ).transport.id
})
afterEach(() => harness.close())

const writers = {
  createPlace: (scope: TenantScope, expectedTripCurrency?: string) =>
    createPlace(scope, {
      tripId,
      name: 'New museum',
      priceMinor: 300,
      expectedTripCurrency,
    }),
  updatePlace: (scope: TenantScope, expectedTripCurrency?: string) =>
    updatePlace(scope, placeId, {
      name: 'Changed museum',
      priceMinor: 300,
      expectedTripCurrency,
    }),
  createTransport: (scope: TenantScope, expectedTripCurrency?: string) =>
    createTransport(scope, {
      tripId,
      title: 'Bus',
      priceMinor: 300,
      expectedTripCurrency,
    }),
  saveTransport: (scope: TenantScope, expectedTripCurrency?: string) =>
    saveTransport(scope, {
      tripId,
      transportId,
      intent: 'edit',
      record: { title: 'Changed train', priceMinor: 300 },
      chain: { stations: [{ name: 'Coimbra' }, { name: 'Braga' }], legs: [{}] },
      expectedTripCurrency,
    }),
  saveSearchedConnection: (scope: TenantScope, expectedTripCurrency?: string) =>
    saveSearchedConnection(scope, {
      tripId,
      mode: 'train',
      title: 'Found train',
      priceMinor: 300,
      currency: 'USD',
      ...chain,
      expectedTripCurrency,
    }),
}

async function snapshot() {
  return {
    places: await listTripPlaces(tenant.scope, { tripId }),
    transports: await listTripTransports(tenant.scope, tripId),
    legs: await listTripLegs(tenant.scope, tripId),
  }
}

for (const [name, write] of Object.entries(writers)) {
  describe(name, () => {
    it('refuses a stale budget currency before changing any rows or legs', async () => {
      const before = await snapshot()
      await expect(write(tenant.scope, 'USD')).rejects.toMatchObject({
        message: 'costs.refusal.tripCurrencyChanged',
      })
      expect(await snapshot()).toEqual(before)
    })
    it.each(['EUR', 'eur', undefined])(
      'accepts current, normalized and omitted currency: %s',
      async (expected) => {
        const result = await write(tenant.scope, expected)
        expect(result).toBeDefined()
        expect(result).not.toHaveProperty('expectedTripCurrency')
      },
    )
    it.each(['', 'EU', 'EURO', '123', 'E1R', 'ßa', 'ſur'])(
      'refuses invalid input: %s',
      async (expected) => {
        const before = await snapshot()
        await expect(write(tenant.scope, expected)).rejects.toMatchObject({
          name: 'ZodError',
        })
        expect(await snapshot()).toEqual(before)
      },
    )
    it('does not expose a foreign trip or target row currency', async () => {
      const foreign = await harness.seedTenant('foreign')
      const before = await snapshot()
      await expect(write(foreign.scope, 'USD')).rejects.toBeInstanceOf(
        NotFoundError,
      )
      expect(await snapshot()).toEqual(before)
    })
    it('does not expose a private trip to another member', async () => {
      const userId = await tenant.addUser('outsider')
      await expect(
        write(tenant.scopeFor(userId), 'USD'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
    it('refuses a viewer before comparing currencies', async () => {
      const userId = await tenant.addUser('viewer')
      await addTripMember(tenant.scope, { tripId, userId, role: 'viewer' })
      await expect(
        write(tenant.scopeFor(userId), 'USD'),
      ).rejects.toBeInstanceOf(TripRoleError)
    })
  })
}

it.each([
  'createTransport',
  'saveTransport',
  'saveSearchedConnection',
] as const)('preserves archive refusal for %s', async (name) => {
  await archiveTrip(tenant.scope, tripId)
  await expect(writers[name](tenant.scope, 'USD')).rejects.toBeInstanceOf(
    TripArchivedError,
  )
})

it('keeps the existing missing-edit refusal before currency comparison', async () => {
  await expect(
    saveTransport(tenant.scope, {
      tripId,
      transportId: mintId(),
      intent: 'edit',
      record: {},
      chain,
      expectedTripCurrency: 'USD',
    }),
  ).rejects.toBeInstanceOf(TransportRefusalError)
})

it('a searched edit preserves the fare and refuses stale state without replacing legs', async () => {
  const before = await snapshot()
  await expect(
    saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Changed',
      ...chain,
      expectedTripCurrency: 'USD',
    }),
  ).rejects.toMatchObject({ message: 'costs.refusal.tripCurrencyChanged' })
  expect(await snapshot()).toEqual(before)
  await saveSearchedConnection(tenant.scope, {
    tripId,
    transportId,
    mode: 'train',
    title: 'Changed',
    priceMinor: 999,
    currency: 'USD',
    ...chain,
    expectedTripCurrency: 'EUR',
  })
  expect((await listTripTransports(tenant.scope, tripId))[0].priceMinor).toBe(
    200,
  )
  expect((await getPlace(tenant.scope, placeId))?.priceMinor).toBe(100)
})

it('keeps foreign transport targets indistinguishable from missing edits', async () => {
  const foreign = await harness.seedTenant('foreign-target')
  const foreignTrip = await createTrip(foreign.scope, {
    title: 'Other trip',
    currency: 'JPY',
  })
  const target = await createTransport(foreign.scope, {
    tripId: foreignTrip.id,
    title: 'Private train',
  })
  const before = await snapshot()
  await expect(
    saveTransport(tenant.scope, {
      tripId,
      transportId: target.id,
      intent: 'edit',
      record: { priceMinor: 99 },
      chain,
      expectedTripCurrency: 'USD',
    }),
  ).rejects.toBeInstanceOf(TransportRefusalError)
  await expect(
    saveSearchedConnection(tenant.scope, {
      tripId,
      transportId: target.id,
      mode: 'train',
      title: 'Changed',
      ...chain,
      expectedTripCurrency: 'USD',
    }),
  ).rejects.toBeInstanceOf(TransportRefusalError)
  expect(await snapshot()).toEqual(before)
  expect((await listTripTransports(foreign.scope, foreignTrip.id))[0]).toEqual(
    target,
  )
})
