import { and, eq } from 'drizzle-orm'
import { member } from '#/server/db/auth-schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearEntries,
  ensurePlan,
  invitePlanMember,
  listVacayEntries,
  PlanOwnerOnlyError,
  setEntry,
  setPlanMemberStatus,
  updatePlan,
  addCompanyHoliday,
  vacayEntriesRepository,
  vacayUserYearsRepository,
} from '../vacay'
import { NotFoundError } from '../context'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('personal leave days', () => {
  let harness: Harness
  let tenant: SeededTenant
  let planId: string
  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('days')
    planId = (await ensurePlan(tenant.scope)).id
    await updatePlan(tenant.scope, planId, { blockWeekends: false })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    harness.close()
  })
  it('atomically replaces one day without reading its previous entry', async () => {
    const read = vi.spyOn(vacayEntriesRepository, 'findOne')
    const a = await setEntry(tenant.scope, { planId, date: '2026-08-03' })
    const b = await setEntry(tenant.scope, {
      planId,
      date: '2026-08-03',
      kind: 'half_day',
    })
    expect(b.id).toBe(a.id)
    expect(b.kind).toBe('half_day')
    expect(b.organizationId).toBe(tenant.scope.ctx.organizationId)
    expect(read).not.toHaveBeenCalled()
    expect(await listVacayEntries(tenant.scope, planId)).toHaveLength(1)
    read.mockRestore()
  })
  it.each(['absent', 'pending', 'declined'] as const)(
    'refuses a %s actor without writes',
    async (status) => {
      const user = await tenant.addUser('Other')
      if (status !== 'absent') {
        const member = await invitePlanMember(tenant.scope, planId, user)
        await setPlanMemberStatus(tenant.scope, member.id, status)
      }
      const scope = tenant.scopeFor(user)
      await expect(
        setEntry(scope, { planId, date: '2026-08-03' }),
      ).rejects.toBeInstanceOf(NotFoundError)
      await expect(
        clearEntries(scope, { planId, from: '2026-08-03', to: '2026-08-03' }),
      ).rejects.toBeInstanceOf(NotFoundError)
      expect(await listVacayEntries(tenant.scope, planId)).toEqual([])
    },
  )
  it('clears only the caller and is idempotent', async () => {
    const user = await tenant.addUser('Colleague')
    const member = await invitePlanMember(tenant.scope, planId, user)
    await setPlanMemberStatus(tenant.scope, member.id, 'accepted')
    await setEntry(tenant.scope, { planId, date: '2026-08-03' })
    await setEntry(tenant.scopeFor(user), { planId, date: '2026-08-03' })
    await expect(
      setEntry(tenant.scopeFor(user), {
        planId,
        date: '2026-08-03',
        userId: tenant.ownerUserId,
      }),
    ).rejects.toBeInstanceOf(PlanOwnerOnlyError)
    for (let i = 0; i < 2; i++)
      await clearEntries(tenant.scope, {
        planId,
        from: '2026-08-03',
        to: '2026-08-03',
      })
    expect(
      (await listVacayEntries(tenant.scope, planId)).map((row) => row.userId),
    ).toEqual([user])
  })
  it('refuses a foreign plan on insert, replacement and clear', async () => {
    const foreign = await harness.seedTenant('foreign')
    const row = await setEntry(tenant.scope, { planId, date: '2026-08-03' })
    for (const date of ['2026-08-03', '2026-08-04'])
      await expect(
        setEntry(foreign.scope, { planId, date }),
      ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      clearEntries(foreign.scope, {
        planId,
        from: '2026-01-01',
        to: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await listVacayEntries(foreign.scope, planId)).toEqual([])
    await expect(
      vacayEntriesRepository.requireById(foreign.scope, row.id),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await listVacayEntries(tenant.scope, planId)).toEqual([row])
  })
  it('enforces stored blocked dates while permitting clear', async () => {
    await setEntry(tenant.scope, { planId, date: '2026-08-01' })
    await updatePlan(tenant.scope, planId, {
      blockWeekends: true,
      companyHolidaysEnabled: true,
    })
    await addCompanyHoliday(tenant.scope, { planId, date: '2026-08-03' })
    for (const date of ['2026-08-01', '2026-08-03'])
      await expect(
        setEntry(tenant.scope, { planId, date }),
      ).rejects.toMatchObject({ code: 'LEAVE_DAY_BLOCKED' })
    await clearEntries(tenant.scope, {
      planId,
      from: '2026-08-01',
      to: '2026-08-01',
    })
    expect(await listVacayEntries(tenant.scope, planId)).toEqual([])
  })
  it('keeps a committed day successful when the carry-over read fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(vacayUserYearsRepository, 'findMany').mockRejectedValueOnce(
      new Error('recompute unavailable'),
    )
    await expect(
      setEntry(tenant.scope, { planId, date: '2026-08-03' }),
    ).resolves.toMatchObject({ date: '2026-08-03' })
    expect(await listVacayEntries(tenant.scope, planId)).toHaveLength(1)
    expect(log).toHaveBeenCalledTimes(1)
  })
  it('refuses an owner target without accepted membership or current workspace membership', async () => {
    const userId = await tenant.addUser('Unaccepted')
    await expect(
      setEntry(tenant.scope, { planId, date: '2026-08-03', userId }),
    ).rejects.toBeInstanceOf(NotFoundError)
    const invited = await invitePlanMember(tenant.scope, planId, userId)
    await setPlanMemberStatus(tenant.scope, invited.id, 'accepted')
    await tenant.scope.db
      .delete(member)
      .where(
        and(
          eq(member.organizationId, tenant.scope.ctx.organizationId),
          eq(member.userId, userId),
        ),
      )
    await expect(
      setEntry(tenant.scope, { planId, date: '2026-08-03', userId }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await listVacayEntries(tenant.scope, planId)).toEqual([])
  })
})
