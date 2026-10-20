/**
 * The carry-over of the leave planner, persisted: what `saveAllowance` rewrites, what it refuses and
 * what it reports, and what a year without a row of its own shows.
 *
 * The rule itself (`walkCarryOver`) is tested as a table in `src/lib/vacay/__tests__`; these cases
 * are about the repository doing exactly what the walk says and nothing else.
 */

import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { walkCarryOver } from '#/lib/vacay/carry-over'
import { vacayUserYears } from '#/server/db/schema'
import {
  CarriedOverDerivedError,
  ensurePlan,
  getAllowance,
  invitePlanMember,
  recomputeCarryOver,
  saveAllowance,
  setEntry,
  setPlanMemberStatus,
  updatePlan,
  vacayUserYearsRepository,
} from '../vacay'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('carry-over in the leave planner repository', () => {
  let harness: Harness
  let tenant: SeededTenant
  let planId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('alpha')
    planId = (await ensurePlan(tenant.scope)).id
    await updatePlan(tenant.scope, planId, { blockWeekends: false })
  })

  const save = (
    year: number,
    entitlementDays?: number,
    carriedOverDays?: number,
  ) =>
    saveAllowance(tenant.scope, {
      planId,
      year,
      entitlementDays,
      carriedOverDays,
    })

  const storedCarried = async (userId = tenant.ownerUserId) =>
    Object.fromEntries(
      (
        await vacayUserYearsRepository.findMany(tenant.scope, {
          where: eq(vacayUserYears.userId, userId),
        })
      ).map((row) => [row.year, row.carriedOverDays]),
    )

  const markDays = async (year: number, vacation: number, half = 0) => {
    for (let day = 1; day <= vacation; day += 1) {
      await setEntry(tenant.scope, {
        planId,
        date: `${year}-03-${String(day).padStart(2, '0')}`,
        kind: 'vacation',
      })
    }
    for (let day = 1; day <= half; day += 1) {
      await setEntry(tenant.scope, {
        planId,
        date: `${year}-04-${String(day).padStart(2, '0')}`,
        kind: 'half_day',
      })
    }
  }

  describe('saveAllowance', () => {
    it('writes the leftover of the year before into a year saved after it', async () => {
      await save(2025, 28)
      await markDays(2025, 3)

      const saved = await save(2026, 28)

      expect(saved.row.carriedOverDays).toBe(25)
      expect(await storedCarried()).toEqual({ 2025: 0, 2026: 25 })
      expect(saved.superseded).toBeNull()
    })

    it('rewrites every later year in the same request, compounding down the chain', async () => {
      await save(2025, 20)
      await save(2026, 20)
      await save(2027, 20)
      await markDays(2026, 5)

      const saved = await save(2025, 24)

      // 2026 carries 24 - 0; 2027 carries 20 + 24 - 5 (2026's used days).
      expect(await storedCarried()).toEqual({ 2025: 0, 2026: 24, 2027: 39 })
      expect(saved.row.carriedOverDays).toBe(0)
    })

    it('stops at the first year with no row: a later opening balance is left alone', async () => {
      await save(2025, 20)
      await save(2027, 20, 6)
      await save(2028, 20)

      await save(2025, 30)

      // 2026 has no row, so 2027 is an opening balance; 2028 follows it.
      expect(await storedCarried()).toEqual({ 2025: 0, 2027: 6, 2028: 26 })
    })

    it('writes only the rows whose figure changed', async () => {
      await save(2025, 20)
      await save(2026, 20)
      await save(2027, 20)
      const before = new Map(
        (await vacayUserYearsRepository.findMany(tenant.scope)).map((row) => [
          row.year,
          row.updatedAt.getTime(),
        ]),
      )
      await new Promise((resolve) => setTimeout(resolve, 5))

      // Used days in 2025 change nothing: the leftover is the same, and so is every later year.
      const result = await recomputeCarryOver(
        tenant.scope,
        planId,
        tenant.ownerUserId,
      )
      expect(result.changedYears).toEqual([])
      for (const row of await vacayUserYearsRepository.findMany(tenant.scope)) {
        expect(row.updatedAt.getTime()).toBe(before.get(row.year))
      }

      await markDays(2025, 2)
      const second = await recomputeCarryOver(
        tenant.scope,
        planId,
        tenant.ownerUserId,
      )
      // Entry writes now maintain the chain before returning; another walk is a no-op.
      expect(await storedCarried()).toEqual({ 2025: 0, 2026: 18, 2027: 38 })
      expect(second.changedYears).toEqual([])
    })

    it('inserts no row', async () => {
      await save(2025, 20)
      await markDays(2025, 1)
      const rows = await vacayUserYearsRepository.count(tenant.scope)

      await recomputeCarryOver(tenant.scope, planId, tenant.ownerUserId)

      expect(await vacayUserYearsRepository.count(tenant.scope)).toBe(rows)
      expect(await storedCarried()).toEqual({ 2025: 0 })
    })

    it('is idempotent: a second recompute changes nothing', async () => {
      await save(2025, 20)
      await save(2026, 20)
      await markDays(2025, 4)
      await recomputeCarryOver(tenant.scope, planId, tenant.ownerUserId)

      const again = await recomputeCarryOver(
        tenant.scope,
        planId,
        tenant.ownerUserId,
      )

      expect(again.changedYears).toEqual([])
    })

    it('writes the walk’s figures, floored, capped and never negative', async () => {
      await save(2024, 10)
      await save(2025, 10)
      await save(2026, 365)
      await save(2027, 365)
      await markDays(2024, 12)
      await markDays(2025, 3, 1)

      await recomputeCarryOver(tenant.scope, planId, tenant.ownerUserId)

      const rows = await vacayUserYearsRepository.findMany(tenant.scope, {
        where: eq(vacayUserYears.userId, tenant.ownerUserId),
      })
      const sorted = [...rows].sort((a, b) => a.year - b.year)
      const used = [12, 3.5, 0, 0]
      expect(sorted.map((row) => row.carriedOverDays)).toEqual(
        walkCarryOver(
          sorted.map((row, index) => ({
            year: row.year,
            entitlementDays: row.entitlementDays,
            carriedOverDays: row.carriedOverDays,
            usedDays: used[index] ?? 0,
          })),
        ),
      )
      // 2024 ends 2 days over and carries 0; 2025 ends with 6.5 -> 6; 365 + 6 caps at 365.
      expect(sorted.map((row) => row.carriedOverDays)).toEqual([0, 0, 6, 365])
    })

    it('keeps the stored figures current while carry-over is switched off', async () => {
      await updatePlan(tenant.scope, planId, { carryOverEnabled: false })
      await save(2025, 20)
      await markDays(2025, 2)

      await save(2026, 20)

      expect(await storedCarried()).toEqual({ 2025: 0, 2026: 18 })
    })

    it('refuses a carried figure for a year that has a year before it, and writes nothing', async () => {
      await save(2025, 20)
      await save(2026, 20)
      const before = await vacayUserYearsRepository.findMany(tenant.scope)

      const refusal = await captureError(() => save(2026, undefined, 9))

      expect(refusal).toBeInstanceOf(CarriedOverDerivedError)
      expect(await vacayUserYearsRepository.findMany(tenant.scope)).toEqual(
        before,
      )
    })

    it('refuses a carried figure for a year that has no row yet but follows one', async () => {
      await save(2025, 20)

      expect(await captureError(() => save(2026, 20, 4))).toBeInstanceOf(
        CarriedOverDerivedError,
      )
      expect(await storedCarried()).toEqual({ 2025: 0 })
    })

    it('accepts a carried figure for an opening balance and carries it onwards', async () => {
      await save(2026, 20)
      await save(2027, 20)

      await save(2026, undefined, 7)

      expect(await storedCarried()).toEqual({ 2026: 7, 2027: 27 })
    })

    it('inserts an opening-balance year with the carried figure it was given', async () => {
      const saved = await save(2026, 20, 5)

      expect(saved.row.carriedOverDays).toBe(5)
      expect(saved.superseded).toBeNull()
    })

    it('reports a typed opening balance that the saved year supersedes, with the value that was entered', async () => {
      await save(2026, 20, 6)

      const saved = await save(2025, 20)

      expect(saved.superseded).toEqual({ year: 2026, was: 6 })
      expect(await storedCarried()).toEqual({ 2025: 0, 2026: 20 })
    })

    it('reports nothing when the superseded opening balance was zero', async () => {
      await save(2026, 20)

      expect((await save(2025, 20)).superseded).toBeNull()
    })

    it('reports nothing when the year before was already there', async () => {
      await save(2025, 20)
      await save(2026, 20)

      expect((await save(2025, 22)).superseded).toBeNull()
    })

    it('returns the figure the recompute wrote for the year that was saved', async () => {
      await save(2025, 20)
      await markDays(2025, 2)

      const saved = await save(2026, 20)

      expect(saved.row.carriedOverDays).toBe(18)
      expect(saved.row.carriedOverDays).toBe((await storedCarried())[2026])
    })

    it('rewrites only the saved traveller’s chain, not a colleague’s on the same plan', async () => {
      const colleague = await tenant.addUser('Colleague')
      await invitePlanMember(tenant.scope, planId, colleague).then((member) =>
        setPlanMemberStatus(tenant.scope, member.id, 'accepted'),
      )
      const theirScope = tenant.scopeFor(colleague)
      await saveAllowance(theirScope, {
        planId,
        year: 2025,
        entitlementDays: 10,
      })
      await saveAllowance(theirScope, {
        planId,
        year: 2026,
        entitlementDays: 10,
      })

      await save(2025, 20)
      await save(2026, 20)

      expect(await storedCarried(colleague)).toEqual({ 2025: 0, 2026: 10 })
      expect(await storedCarried()).toEqual({ 2025: 0, 2026: 20 })
    })
  })

  describe('getAllowance', () => {
    it('shows a year without a row the whole-day leftover of the year before, as carried and in days left', async () => {
      await save(2025, 28)
      await markDays(2025, 3, 1)

      const balance = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2026,
      )

      // 28 - 3.5 = 24.5 -> 24 carries.
      expect(balance).toMatchObject({
        hasRow: false,
        carriedOverDays: 24,
        openingBalance: false,
        previousYear: 2025,
      })
      expect(balance.remainingDays).toBe(
        balance.entitlementDays + 24 - balance.usedDays,
      )
      expect(await storedCarried()).toEqual({ 2025: 0 })
    })

    it('shows 0 for that year when carry-over is switched off, and still writes nothing', async () => {
      await save(2025, 28)
      await updatePlan(tenant.scope, planId, { carryOverEnabled: false })

      const balance = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2026,
      )

      expect(balance.carriedOverDays).toBe(0)
      expect(balance.remainingDays).toBe(balance.entitlementDays)
    })

    it('shows the walk for a year with a row, and calls the year an opening balance only when no row precedes it', async () => {
      await save(2025, 20)
      await save(2026, 20)
      await save(2028, 20, 3)

      const derived = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2026,
      )
      const afterGap = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2028,
      )
      const first = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2025,
      )

      expect(derived).toMatchObject({
        carriedOverDays: 20,
        openingBalance: false,
      })
      expect(afterGap).toMatchObject({
        carriedOverDays: 3,
        openingBalance: true,
      })
      expect(first).toMatchObject({ carriedOverDays: 0, openingBalance: true })
    })

    it('treats a year with neither a row nor a row before it as an opening balance with nothing carried', async () => {
      const balance = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2030,
      )

      expect(balance).toMatchObject({
        hasRow: false,
        carriedOverDays: 0,
        openingBalance: true,
        previousYear: 2029,
      })
    })

    it('leaves a half day in the remaining days and carries only the whole ones', async () => {
      await save(2025, 10)
      await markDays(2025, 4, 1)

      const next = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2026,
      )
      const same = await getAllowance(
        tenant.scope,
        planId,
        tenant.ownerUserId,
        2025,
      )

      expect(same.remainingDays).toBe(5.5)
      expect(next.carriedOverDays).toBe(5)
    })
  })
})
