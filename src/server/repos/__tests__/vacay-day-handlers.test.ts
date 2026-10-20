import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDay, markDay, readGrid } from '#/server/fns/vacay-lib/handlers'
import { ensurePlan, updatePlan } from '../vacay'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('leave day wire handlers', () => {
  let h: Harness
  let tenant: SeededTenant
  let planId: string
  beforeEach(async () => {
    h = await createHarness()
    tenant = await h.seedTenant('day-handlers')
    planId = (await ensurePlan(tenant.scope)).id
    await updatePlan(tenant.scope, planId, {
      blockWeekends: false,
      defaultEntitlementDays: 25,
    })
  })
  afterEach(() => h.close())
  it('rejects explicit user IDs even when they identify the caller', async () => {
    const data = {
      planId,
      date: '2026-08-03',
      kind: 'vacation' as const,
      userId: tenant.ownerUserId,
    }
    await expect(markDay(tenant.scope, data)).rejects.toThrow()
    await expect(clearDay(tenant.scope, data)).rejects.toThrow()
    expect(
      (await readGrid(tenant.scope, { planId, year: 2026 })).entries,
    ).toEqual([])
  })
  it('returns success then reads the persisted balance and clears one day', async () => {
    expect(
      await markDay(tenant.scope, {
        planId,
        date: '2026-08-03',
        kind: 'half_day',
      }),
    ).toEqual({ ok: true })
    const grid = await readGrid(tenant.scope, { planId, year: 2026 })
    expect(grid.entries).toEqual([{ date: '2026-08-03', kind: 'half_day' }])
    expect(grid.remainingDays).toBe(24.5)
    expect(
      await clearDay(tenant.scope, { planId, date: '2026-08-03' }),
    ).toEqual({ ok: true })
    expect(
      (await readGrid(tenant.scope, { planId, year: 2026 })).remainingDays,
    ).toBe(25)
  })
  it('reports a refusal without inviting retry', async () => {
    await updatePlan(tenant.scope, planId, { blockWeekends: true })
    expect(
      await markDay(tenant.scope, {
        planId,
        date: '2026-08-01',
        kind: 'vacation',
      }),
    ).toEqual({ ok: false, retryable: false })
  })
})
