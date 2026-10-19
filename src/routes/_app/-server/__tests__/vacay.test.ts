/**
 * The leave planner's server functions, called the way the screen calls them: with an app scope and
 * nothing else. The guard is the repository's; what is asserted here is that the functions forward
 * to it without a way round it, whoever the caller is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CarriedOverDerivedError,
  NotFoundError,
  PlanOwnerOnlyError,
  ensurePlan,
  invitePlanMember,
  setPlanMemberStatus,
  vacayPlansRepository,
  vacayUserYearsRepository,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

const stubs = vi.hoisted(() => ({ scope: null as TenantScope | null }))

vi.mock('../context', () => ({
  appScope: async (): Promise<TenantScope> => {
    if (stubs.scope === null) {
      throw new Error('This case has no acting scope.')
    }
    return stubs.scope
  },
}))

// Outside the Start build the wrapper discards return values. Keep the registered handler callable
// so the assertions cover its result, with real repositories and an authenticated scope.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: () => ({
      handler: (handler: (options: { data: unknown }) => unknown) => handler,
    }),
  }),
}))

const { loadVacayAllowance, setAllowanceFn, updateVacayPlanFn } =
  await import('../vacay')

describe('the leave planner server functions', () => {
  let harness: Harness
  let tenant: SeededTenant
  let planId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('allowance-fns')
    stubs.scope = tenant.scope
    planId = (await ensurePlan(tenant.scope)).id
  })

  afterEach(() => {
    harness.close()
    stubs.scope = null
  })

  const save = (data: Record<string, unknown>) =>
    setAllowanceFn({ data } as never) as Promise<{
      row: { userId: string; entitlementDays: number; carriedOverDays: number }
      superseded: { year: number; was: number } | null
    }>
  const load = (data: { planId: string; year: number }) =>
    loadVacayAllowance({ data } as never) as Promise<{
      hasRow: boolean
      entitlementDays: number
      carriedOverDays: number
      openingBalance: boolean
      previousYear: number
    }>

  it('saves the caller’s allowance and reads it back as theirs', async () => {
    const saved = await save({ planId, year: 2026, entitlementDays: 21 })

    expect(saved.row.userId).toBe(tenant.ownerUserId)
    expect(await load({ planId, year: 2026 })).toMatchObject({
      hasRow: true,
      entitlementDays: 21,
    })
  })

  it('reports the typed opening balance a save replaced, and the calculated figure the next year now shows', async () => {
    await save({ planId, year: 2026, entitlementDays: 20, carriedOverDays: 6 })

    const saved = await save({ planId, year: 2025, entitlementDays: 20 })

    expect(saved.superseded).toEqual({ year: 2026, was: 6 })
    expect(await load({ planId, year: 2026 })).toMatchObject({
      carriedOverDays: 20,
      openingBalance: false,
      previousYear: 2025,
    })
  })

  it('shows a year without a row the carry from the year before, and writes nothing for it', async () => {
    await save({ planId, year: 2025, entitlementDays: 20 })

    expect(await load({ planId, year: 2026 })).toMatchObject({
      hasRow: false,
      carriedOverDays: 20,
    })
    expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(1)
  })

  it('refuses a carried figure for a calculated year', async () => {
    await save({ planId, year: 2025, entitlementDays: 20 })

    await expect(
      save({ planId, year: 2026, carriedOverDays: 4 }),
    ).rejects.toBeInstanceOf(CarriedOverDerivedError)
  })

  it('reads the caller’s balance whatever else a caller sends', async () => {
    const colleague = await tenant.addUser('Colleague')
    const invited = await invitePlanMember(tenant.scope, planId, colleague)
    await setPlanMemberStatus(tenant.scope, invited.id, 'accepted')
    await save({ planId, userId: colleague, year: 2026, entitlementDays: 9 })

    const result = await loadVacayAllowance({
      data: { planId, year: 2026, userId: colleague },
    } as never)

    expect(result).toMatchObject({ hasRow: false })
  })

  describe.each([
    ['a workspace member who never joined', undefined],
    ['a pending member', 'pending'],
    ['a declined member', 'declined'],
  ] as const)('as %s', (_label, status) => {
    let outsider: string

    beforeEach(async () => {
      outsider = await tenant.addUser('Outsider')
      if (status !== undefined) {
        const invited = await invitePlanMember(tenant.scope, planId, outsider)
        await setPlanMemberStatus(tenant.scope, invited.id, status)
      }
      stubs.scope = tenant.scopeFor(outsider)
    })

    it('finds no plan to write or read, and writes nothing', async () => {
      await expect(
        save({ planId, year: 2026, entitlementDays: 3 }),
      ).rejects.toBeInstanceOf(NotFoundError)
      await expect(load({ planId, year: 2026 })).rejects.toBeInstanceOf(
        NotFoundError,
      )
      expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(0)
    })
  })

  it('refuses an accepted member who aims the write at a colleague', async () => {
    const colleague = await tenant.addUser('Colleague')
    const invited = await invitePlanMember(tenant.scope, planId, colleague)
    await setPlanMemberStatus(tenant.scope, invited.id, 'accepted')
    stubs.scope = tenant.scopeFor(colleague)

    await expect(
      save({
        planId,
        userId: tenant.ownerUserId,
        year: 2026,
        entitlementDays: 1,
      }),
    ).rejects.toBeInstanceOf(PlanOwnerOnlyError)
    expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(0)
  })

  it('finds no plan from a second workspace', async () => {
    const other = await harness.seedTenant('allowance-fns-other')
    stubs.scope = other.scope

    await expect(
      save({ planId, year: 2026, entitlementDays: 3 }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(load({ planId, year: 2026 })).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(0)
  })

  describe('updateVacayPlanFn', () => {
    const update = (data: Record<string, unknown>) =>
      updateVacayPlanFn({ data } as never) as Promise<{
        id: string
        carryOverEnabled: boolean
        defaultEntitlementDays: number
      }>

    it('changes the carry-over setting and the default allowance and returns the plan', async () => {
      const plan = await update({
        planId,
        carryOverEnabled: false,
        defaultEntitlementDays: 30,
      })

      expect(plan).toMatchObject({
        id: planId,
        carryOverEnabled: false,
        defaultEntitlementDays: 30,
      })
      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toMatchObject({ carryOverEnabled: false, defaultEntitlementDays: 30 })
    })

    it('treats a call with nothing to change as a no-op', async () => {
      const before = await vacayPlansRepository.requireById(
        tenant.scope,
        planId,
      )

      expect(await update({ planId })).toMatchObject({ id: planId })
      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toEqual(before)
    })

    it('refuses an accepted member who is not the owner, and changes nothing', async () => {
      const colleague = await tenant.addUser('Colleague')
      const invited = await invitePlanMember(tenant.scope, planId, colleague)
      await setPlanMemberStatus(tenant.scope, invited.id, 'accepted')
      const before = await vacayPlansRepository.requireById(
        tenant.scope,
        planId,
      )
      stubs.scope = tenant.scopeFor(colleague)

      await expect(
        update({ planId, defaultEntitlementDays: 1 }),
      ).rejects.toBeInstanceOf(PlanOwnerOnlyError)
      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toEqual(before)
    })

    it('finds no plan from a workspace member who never joined, or from a second workspace', async () => {
      const outsider = await tenant.addUser('Outsider')
      stubs.scope = tenant.scopeFor(outsider)
      await expect(
        update({ planId, carryOverEnabled: false }),
      ).rejects.toBeInstanceOf(NotFoundError)

      const other = await harness.seedTenant('plan-fn-other')
      stubs.scope = other.scope
      await expect(
        update({ planId, carryOverEnabled: false }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('ignores a switch the dialog does not own', async () => {
      const before = await vacayPlansRepository.requireById(
        tenant.scope,
        planId,
      )

      await update({ planId, blockWeekends: !before.blockWeekends })

      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toEqual(before)
    })
  })
})
