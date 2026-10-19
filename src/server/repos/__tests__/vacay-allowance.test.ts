/**
 * The leave planner's allowance behind the repository guard: who may read or write whose figure.
 *
 * `setEntitlement` and `updatePlan` prove a plan is in the caller's workspace and nothing more, so
 * the rule that a leave plan is personal lives in `requirePlanActor` / `requirePlanOwner`, and these
 * cases are what keeps a later writer from forgetting it.
 */

import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { member } from '#/server/db/auth-schema'
import { vacayUserYears } from '#/server/db/schema'
import { NotFoundError } from '../context'
import {
  PlanOwnerOnlyError,
  ensurePlan,
  getAllowance,
  invitePlanMember,
  requirePlanActor,
  requirePlanOwner,
  saveAllowance,
  setEntry,
  setPlanMemberStatus,
  updatePlan,
  updatePlanSettings,
  vacayPlansRepository,
  vacayUserYearsRepository,
} from '../vacay'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

async function joinPlan(
  scope: TenantScope,
  planId: string,
  userId: string,
  status: 'accepted' | 'pending' | 'declined',
): Promise<void> {
  const invited = await invitePlanMember(scope, planId, userId)
  await setPlanMemberStatus(scope, invited.id, status)
}

describe('the leave planner allowance guard', () => {
  let harness: Harness
  let tenant: SeededTenant
  let planId: string
  let colleague: string
  let colleagueScope: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('alpha')
    planId = (await ensurePlan(tenant.scope)).id
    colleague = await tenant.addUser('Colleague')
    colleagueScope = tenant.scopeFor(colleague)
  })

  const rowsFor = (userId: string) =>
    vacayUserYearsRepository.findMany(tenant.scope, {
      where: eq(vacayUserYears.userId, userId),
    })

  describe('requirePlanActor', () => {
    it('lets the owner through and says so', async () => {
      const actor = await requirePlanActor(tenant.scope, planId)

      expect(actor.isOwner).toBe(true)
      expect(actor.plan.id).toBe(planId)
    })

    it('lets an accepted member through, as a non-owner', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')

      const actor = await requirePlanActor(colleagueScope, planId)

      expect(actor.isOwner).toBe(false)
    })

    it.each(['pending', 'declined'] as const)(
      'treats a %s member as a stranger: the plan does not exist',
      async (status) => {
        await joinPlan(tenant.scope, planId, colleague, status)

        expect(
          await captureError(() => requirePlanActor(colleagueScope, planId)),
        ).toBeInstanceOf(NotFoundError)
      },
    )

    it('treats a workspace member who never joined as a stranger, whatever their workspace role', async () => {
      const admin = await tenant.addUser('Admin', 'admin')

      expect(
        await captureError(() =>
          requirePlanActor(tenant.scopeFor(admin, 'admin'), planId),
        ),
      ).toBeInstanceOf(NotFoundError)
      // The workspace owner owns nothing in someone else's leave plan.
      const memberPlan = (await ensurePlan(colleagueScope)).id
      expect(
        await captureError(() => requirePlanActor(tenant.scope, memberPlan)),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  describe('requirePlanOwner', () => {
    it('lets the owner through', async () => {
      const actor = await requirePlanOwner(tenant.scope, planId)

      expect(actor.isOwner).toBe(true)
    })

    it('refuses an accepted member with the owner-only error', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')

      expect(
        await captureError(() => requirePlanOwner(colleagueScope, planId)),
      ).toBeInstanceOf(PlanOwnerOnlyError)
    })

    it('answers a stranger as if the plan did not exist', async () => {
      expect(
        await captureError(() => requirePlanOwner(colleagueScope, planId)),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  describe('saveAllowance', () => {
    it('writes a row on the first save, even of the unchanged default, and updates it after', async () => {
      const plan = await requirePlanActor(tenant.scope, planId)
      const first = await saveAllowance(tenant.scope, {
        planId,
        year: 2026,
        entitlementDays: plan.plan.defaultEntitlementDays,
      })
      const second = await saveAllowance(tenant.scope, {
        planId,
        year: 2026,
        entitlementDays: 31,
      })

      expect(first.row.userId).toBe(tenant.ownerUserId)
      expect(first.row.entitlementDays).toBe(plan.plan.defaultEntitlementDays)
      expect(second.row.id).toBe(first.row.id)
      expect(second.row.entitlementDays).toBe(31)
      expect(await rowsFor(tenant.ownerUserId)).toHaveLength(1)
    })

    it('lets an accepted member set their own allowance', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')

      const { row } = await saveAllowance(colleagueScope, {
        planId,
        year: 2026,
        entitlementDays: 20,
      })

      expect(row.userId).toBe(colleague)
      expect(row.entitlementDays).toBe(20)
    })

    it('refuses a member editing a colleague as owner-only, while the owner’s identical call succeeds', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')
      const input = {
        planId,
        userId: tenant.ownerUserId,
        year: 2026,
        entitlementDays: 5,
      }

      expect(
        await captureError(() => saveAllowance(colleagueScope, input)),
      ).toBeInstanceOf(PlanOwnerOnlyError)
      expect(await rowsFor(tenant.ownerUserId)).toEqual([])

      const { row } = await saveAllowance(tenant.scope, {
        planId,
        userId: colleague,
        year: 2026,
        entitlementDays: 5,
      })
      expect(row.userId).toBe(colleague)
    })

    it('does not let a workspace owner or admin who is only a member of the plan override the owner rule', async () => {
      const admin = await tenant.addUser('Admin', 'admin')
      await joinPlan(tenant.scope, planId, admin, 'accepted')

      expect(
        await captureError(() =>
          saveAllowance(tenant.scopeFor(admin, 'admin'), {
            planId,
            userId: colleague,
            year: 2026,
            entitlementDays: 5,
          }),
        ),
      ).toBeInstanceOf(PlanOwnerOnlyError)
    })

    it.each(['pending', 'declined'] as const)(
      'gives a %s member not-found and writes nothing',
      async (status) => {
        await joinPlan(tenant.scope, planId, colleague, status)

        expect(
          await captureError(() =>
            saveAllowance(colleagueScope, {
              planId,
              year: 2026,
              entitlementDays: 3,
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
        expect(await rowsFor(colleague)).toEqual([])
      },
    )

    it('gives a non-member not-found and writes nothing', async () => {
      expect(
        await captureError(() =>
          saveAllowance(colleagueScope, {
            planId,
            year: 2026,
            entitlementDays: 3,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(0)
    })

    it('refuses a target with an accepted plan-member row but no workspace member row', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')
      await harness.db
        .delete(member)
        .where(
          and(
            eq(member.organizationId, tenant.organizationId),
            eq(member.userId, colleague),
          ),
        )

      expect(
        await captureError(() =>
          saveAllowance(tenant.scope, {
            planId,
            userId: colleague,
            year: 2026,
            entitlementDays: 9,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(0)
    })

    it('refuses a target who is a workspace member but only invited or declined on the plan', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'pending')

      expect(
        await captureError(() =>
          saveAllowance(tenant.scope, {
            planId,
            userId: colleague,
            year: 2026,
            entitlementDays: 9,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(0)
    })

    it('refuses a target who never existed', async () => {
      expect(
        await captureError(() =>
          saveAllowance(tenant.scope, {
            planId,
            userId: 'nobody-by-this-id',
            year: 2026,
            entitlementDays: 9,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(0)
    })

    it('writes for the owner as the explicit target the same as for the caller', async () => {
      const { row } = await saveAllowance(tenant.scope, {
        planId,
        userId: tenant.ownerUserId,
        year: 2026,
        entitlementDays: 12,
      })

      expect(row.userId).toBe(tenant.ownerUserId)
    })
  })

  describe('getAllowance', () => {
    it('reports the plan default for a traveller with no row, and no row', async () => {
      const plan = (await requirePlanActor(tenant.scope, planId)).plan

      const balance = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2026,
      )

      expect(balance).toEqual({
        hasRow: false,
        entitlementDays: plan.defaultEntitlementDays,
        carriedOverDays: 0,
        usedDays: 0,
        remainingDays: plan.defaultEntitlementDays,
        openingBalance: true,
        previousYear: 2025,
      })
    })

    it('reports the stored figures, counts half days, and hides carry-over when the plan has it off', async () => {
      await saveAllowance(tenant.scope, {
        planId,
        year: 2026,
        entitlementDays: 25,
        carriedOverDays: 4,
      })
      await setEntry(tenant.scope, {
        planId,
        date: '2026-08-03',
        kind: 'vacation',
      })
      await setEntry(tenant.scope, {
        planId,
        date: '2026-08-04',
        kind: 'half_day',
      })

      expect(
        await getAllowance(tenant.scope, planId, tenant.ownerUserId, 2026),
      ).toEqual({
        hasRow: true,
        entitlementDays: 25,
        carriedOverDays: 4,
        usedDays: 1.5,
        remainingDays: 27.5,
        openingBalance: true,
        previousYear: 2025,
      })

      await updatePlan(tenant.scope, planId, { carryOverEnabled: false })
      const hidden = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2026,
      )
      expect(hidden.carriedOverDays).toBe(0)
      expect(hidden.remainingDays).toBe(23.5)
    })

    it('counts only the traveller’s own entries, never a colleague’s on the same plan', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')
      await setEntry(colleagueScope, {
        planId,
        date: '2026-08-03',
        kind: 'vacation',
      })
      await setEntry(colleagueScope, {
        planId,
        date: '2026-08-04',
        kind: 'vacation',
      })

      const mine = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2026,
      )
      const theirs = await getAllowance(colleagueScope, planId, colleague, 2026)

      expect(mine.usedDays).toBe(0)
      expect(theirs.usedDays).toBe(2)
    })

    it('rejects an empty user id instead of widening the read to the whole plan', async () => {
      await setEntry(tenant.scope, {
        planId,
        date: '2026-08-03',
        kind: 'vacation',
      })

      await expect(
        getAllowance(tenant.scope, planId, '', 2026),
      ).rejects.toThrow()
    })

    it('asks the owner and a current, accepted plan member to read a colleague’s balance', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')
      await saveAllowance(colleagueScope, {
        planId,
        year: 2026,
        entitlementDays: 18,
      })

      expect(
        await captureError(() =>
          getAllowance(colleagueScope, planId, tenant.ownerUserId, 2026),
        ),
      ).toBeInstanceOf(PlanOwnerOnlyError)
      expect(
        (await getAllowance(tenant.scope, planId, colleague, 2026))
          .entitlementDays,
      ).toBe(18)

      await harness.db
        .delete(member)
        .where(
          and(
            eq(member.organizationId, tenant.organizationId),
            eq(member.userId, colleague),
          ),
        )
      expect(
        await captureError(() =>
          getAllowance(tenant.scope, planId, colleague, 2026),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('answers a stranger, a pending member and a declined member as if the plan did not exist', async () => {
      expect(
        await captureError(() =>
          getAllowance(colleagueScope, planId, colleague, 2026),
        ),
      ).toBeInstanceOf(NotFoundError)

      await joinPlan(tenant.scope, planId, colleague, 'pending')
      expect(
        await captureError(() =>
          getAllowance(colleagueScope, planId, colleague, 2026),
        ),
      ).toBeInstanceOf(NotFoundError)

      await joinPlan(tenant.scope, planId, colleague, 'declined')
      expect(
        await captureError(() =>
          getAllowance(colleagueScope, planId, colleague, 2026),
        ),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  describe('updatePlanSettings', () => {
    it('lets the owner switch carry-over and set the default allowance', async () => {
      const plan = await updatePlanSettings(tenant.scope, planId, {
        carryOverEnabled: false,
        defaultEntitlementDays: 30,
      })

      expect(plan.carryOverEnabled).toBe(false)
      expect(plan.defaultEntitlementDays).toBe(30)
      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toMatchObject({
        carryOverEnabled: false,
        defaultEntitlementDays: 30,
      })
    })

    it('treats an empty patch as a no-op that returns the plan', async () => {
      const before = await vacayPlansRepository.requireById(
        tenant.scope,
        planId,
      )

      const plan = await updatePlanSettings(tenant.scope, planId, {})

      expect(plan).toEqual(before)
      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toEqual(before)
    })

    it('still asks who the caller is for an empty patch', async () => {
      expect(
        await captureError(() =>
          updatePlanSettings(colleagueScope, planId, {}),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('changes what a traveller without a row sees and rewrites no stored row', async () => {
      await saveAllowance(tenant.scope, {
        planId,
        year: 2025,
        entitlementDays: 12,
      })
      const before = await rowsFor(tenant.ownerUserId)

      await updatePlanSettings(tenant.scope, planId, {
        defaultEntitlementDays: 33,
      })

      expect(await rowsFor(tenant.ownerUserId)).toEqual(before)
      expect(
        await getAllowance(tenant.scope, planId, tenant.ownerUserId, 2030),
      ).toMatchObject({ hasRow: false, entitlementDays: 33 })
      expect(
        await getAllowance(tenant.scope, planId, tenant.ownerUserId, 2025),
      ).toMatchObject({ hasRow: true, entitlementDays: 12 })
    })

    it('hides the carried figure when carry-over is off and restores it when it is on, without a recompute', async () => {
      await saveAllowance(tenant.scope, {
        planId,
        year: 2025,
        entitlementDays: 20,
      })
      await saveAllowance(tenant.scope, {
        planId,
        year: 2026,
        entitlementDays: 20,
      })
      const stored = await rowsFor(tenant.ownerUserId)
      const carried = () =>
        getAllowance(tenant.scope, planId, tenant.ownerUserId, 2026).then(
          (balance) => balance.carriedOverDays,
        )
      const withCarryOver = await carried()
      expect(withCarryOver).toBe(20)

      await updatePlanSettings(tenant.scope, planId, {
        carryOverEnabled: false,
      })
      expect(await carried()).toBe(0)
      await updatePlanSettings(tenant.scope, planId, { carryOverEnabled: true })

      expect(await carried()).toBe(withCarryOver)
      expect(await rowsFor(tenant.ownerUserId)).toEqual(stored)
    })

    it('refuses an accepted member as owner-only and changes nothing', async () => {
      await joinPlan(tenant.scope, planId, colleague, 'accepted')
      const before = await vacayPlansRepository.requireById(
        tenant.scope,
        planId,
      )

      expect(
        await captureError(() =>
          updatePlanSettings(colleagueScope, planId, {
            defaultEntitlementDays: 1,
          }),
        ),
      ).toBeInstanceOf(PlanOwnerOnlyError)

      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toEqual(before)
    })

    it.each(['pending', 'declined'] as const)(
      'answers a %s member as if the plan did not exist',
      async (status) => {
        await joinPlan(tenant.scope, planId, colleague, status)

        expect(
          await captureError(() =>
            updatePlanSettings(colleagueScope, planId, {
              carryOverEnabled: false,
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
      },
    )

    it('gives a workspace admin who never joined the plan no say over it', async () => {
      const admin = await tenant.addUser('Admin', 'admin')

      expect(
        await captureError(() =>
          updatePlanSettings(tenant.scopeFor(admin, 'admin'), planId, {
            carryOverEnabled: false,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('ignores the switches the dialog does not own', async () => {
      const before = await vacayPlansRepository.requireById(
        tenant.scope,
        planId,
      )

      await updatePlanSettings(tenant.scope, planId, {
        blockWeekends: !before.blockWeekends,
        name: 'Renamed',
      } as never)

      expect(
        await vacayPlansRepository.requireById(tenant.scope, planId),
      ).toEqual(before)
    })

    it.each([-1, 366, 1.5])(
      'rejects a default allowance of %s',
      async (days) => {
        expect(
          await captureError(() =>
            updatePlanSettings(tenant.scope, planId, {
              defaultEntitlementDays: days,
            }),
          ),
        ).toBeInstanceOf(Error)
      },
    )
  })
})
