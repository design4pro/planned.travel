import { beforeEach, describe, expect, it } from 'vitest'
import { createHarness, subscribeTenant } from './harness'
import {
  addTripMember,
  createTrip,
  NotFoundError,
  TripRoleError,
} from '../index'
import { getUsageRecord, setUsage } from '../billing'
import { exportAllowance, releaseExport, reserveExport } from '../exports'
import type { SeededTenant } from './harness'

let tenant: SeededTenant
let other: SeededTenant
let tripId: string
const month = '2027-02'
beforeEach(async () => {
  const h = await createHarness()
  tenant = await h.seedTenant('export-a')
  other = await h.seedTenant('export-b')
  tripId = (
    await createTrip(tenant.scope, { title: 'Trip', visibility: 'private' })
  ).id
})

describe('export allowance and tenant isolation', () => {
  it('admits the third and releases every refused fourth exactly once', async () => {
    await setUsage(tenant.scope, { metric: 'exports', period: month, value: 2 })
    expect(await reserveExport(tenant.scope, tripId, { month })).toEqual({
      used: 3,
      month,
    })
    for (let i = 0; i < 3; i += 1) {
      await expect(
        reserveExport(tenant.scope, tripId, { month }),
      ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
      expect(await exportAllowance(tenant.scope, { month })).toEqual({
        used: 3,
        limit: 3,
      })
    }
    expect(await getUsageRecord(tenant.scope, 'exports', 'all')).toBeNull()
  })

  it('admits exactly one concurrent request for the last unit', async () => {
    await setUsage(tenant.scope, { metric: 'exports', period: month, value: 2 })
    const results = await Promise.allSettled([
      reserveExport(tenant.scope, tripId, { month }),
      reserveExport(tenant.scope, tripId, { month }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await exportAllowance(tenant.scope, { month })).used).toBe(3)
  })

  it('retries the first insertion race, with both accepted units counted', async () => {
    const results = await Promise.all([
      reserveExport(tenant.scope, tripId, { month }),
      reserveExport(tenant.scope, tripId, { month }),
    ])
    expect(results.map((r) => r.used).sort()).toEqual([1, 2])
    expect((await exportAllowance(tenant.scope, { month })).used).toBe(2)
  })

  it('checks access then role before any count moves', async () => {
    await expect(
      reserveExport(other.scope, tripId, { month }),
    ).rejects.toBeInstanceOf(NotFoundError)
    const stranger = tenant.scopeFor(await tenant.addUser('Stranger'))
    await expect(
      reserveExport(stranger, tripId, { month }),
    ).rejects.toBeInstanceOf(NotFoundError)
    const viewerId = await tenant.addUser('Viewer')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    await expect(
      reserveExport(tenant.scopeFor(viewerId), tripId, { month }),
    ).rejects.toBeInstanceOf(TripRoleError)
    expect(await getUsageRecord(tenant.scope, 'exports', month)).toBeNull()
    expect(await getUsageRecord(other.scope, 'exports', month)).toBeNull()
  })

  it('reads and releases only the caller’s month and workspace', async () => {
    await setUsage(other.scope, { metric: 'exports', period: month, value: 3 })
    await reserveExport(tenant.scope, tripId, { month })
    await releaseExport(tenant.scope, { month })
    expect(await exportAllowance(tenant.scope, { month })).toEqual({
      used: 0,
      limit: 3,
    })
    expect((await exportAllowance(other.scope, { month })).used).toBe(3)
  })
})

it('keeps counting without refusing an unlimited paid plan', async () => {
  await subscribeTenant(tenant.scope, 'solo')
  await setUsage(tenant.scope, { metric: 'exports', period: month, value: 500 })
  expect((await reserveExport(tenant.scope, tripId, { month })).used).toBe(501)
  expect(await exportAllowance(tenant.scope, { month })).toEqual({
    used: 501,
    limit: null,
  })
})
