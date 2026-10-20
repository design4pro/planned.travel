import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDay, markDay, readGrid } from '#/server/fns/vacay-lib/handlers'
import * as settings from '../settings'
import {
  updateOrganizationSettings,
  updateUserSettings,
  getOrganizationSettings,
  getUserSettings,
  organizationSettingsRepository,
  userSettingsRepository,
} from '../settings'
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
  afterEach(() => {
    vi.restoreAllMocks()
    h.close()
  })
  it.each([0, 1, 6])(
    'reads workspace %i, personal override and cleared override without writing',
    async (weekStartsOn) => {
      await updateOrganizationSettings(tenant.scope, { weekStartsOn })
      const read = () => readGrid(tenant.scope, { planId, year: 2026 })
      expect((await read()).weekStartsOn).toBe(weekStartsOn)
      await updateUserSettings(tenant.scope, { weekStartsOn: 0 })
      expect((await read()).weekStartsOn).toBe(0)
      await updateUserSettings(tenant.scope, { weekStartsOn: null })
      expect((await read()).weekStartsOn).toBe(weekStartsOn)
      const workspace = await getOrganizationSettings(tenant.scope)
      const user = await getUserSettings(tenant.scope)
      await read()
      expect(await getOrganizationSettings(tenant.scope)).toEqual(workspace)
      expect(await getUserSettings(tenant.scope)).toEqual(user)
    },
  )
  it('uses Monday without creating missing settings rows', async () => {
    const workspace = await getOrganizationSettings(tenant.scope)
    const user = await getUserSettings(tenant.scope)
    if (workspace)
      await organizationSettingsRepository.requireRemove(
        tenant.scope,
        workspace.id,
      )
    if (user) await userSettingsRepository.requireRemove(tenant.scope, user.id)
    const workspaceRead = vi.spyOn(settings, 'getOrganizationSettings')
    const userRead = vi.spyOn(settings, 'getUserSettings')
    expect(
      (await readGrid(tenant.scope, { planId, year: 2026 })).weekStartsOn,
    ).toBe(1)
    expect(workspaceRead).toHaveBeenCalledTimes(1)
    expect(userRead).toHaveBeenCalledTimes(1)
    expect(await getOrganizationSettings(tenant.scope)).toBeNull()
    expect(await getUserSettings(tenant.scope)).toBeNull()
  })
  it.each([-1, 7, 1.5])(
    'falls back to Monday for stored invalid week start %s',
    async (weekStartsOn) => {
      const workspace = await updateOrganizationSettings(tenant.scope, {
        weekStartsOn: 0,
      })
      vi.spyOn(settings, 'getOrganizationSettings').mockResolvedValueOnce({
        ...workspace,
        weekStartsOn,
      })
      expect(
        (await readGrid(tenant.scope, { planId, year: 2026 })).weekStartsOn,
      ).toBe(1)
      const user = await updateUserSettings(tenant.scope, { weekStartsOn: 6 })
      vi.spyOn(settings, 'getUserSettings').mockResolvedValueOnce({
        ...user,
        weekStartsOn,
      })
      expect(
        (await readGrid(tenant.scope, { planId, year: 2026 })).weekStartsOn,
      ).toBe(1)
    },
  )
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
