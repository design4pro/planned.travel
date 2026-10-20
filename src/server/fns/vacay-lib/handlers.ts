import { z } from 'zod'
import { ENTRY_KINDS } from '#/lib/vacay/entry-kinds'
import {
  clearEntries,
  getAllowance,
  getPlanOverview,
  requirePlanActor,
  setEntry,
} from '#/server/repos/vacay'
import { dateSchema, idSchema, yearSchema } from '#/server/repos/validation'
import { RepositoryError } from '#/server/repos/context'
import type { TenantScope } from '#/server/repos/base'

export const markDayInput = z
  .object({ planId: idSchema, date: dateSchema, kind: z.enum(ENTRY_KINDS) })
  .strict()
export const clearDayInput = z
  .object({ planId: idSchema, date: dateSchema })
  .strict()
export const gridInput = z
  .object({ planId: idSchema, year: yearSchema })
  .strict()

export async function readGrid(
  scope: TenantScope,
  input: z.infer<typeof gridInput>,
) {
  const { planId, year } = gridInput.parse(input)
  await requirePlanActor(scope, planId)
  const [overview, allowance] = await Promise.all([
    getPlanOverview(scope, planId, year),
    getAllowance(scope, planId, scope.ctx.userId, year),
  ])
  return {
    entries: overview.entries
      .filter((row) => row.userId === scope.ctx.userId)
      .map((row) => ({ date: row.date, kind: row.kind })),
    remainingDays: allowance.remainingDays,
    blockWeekends: overview.plan.blockWeekends,
    companyHolidaysEnabled: overview.plan.companyHolidaysEnabled,
    companyHolidays: overview.companyHolidays.map((row) => row.date),
  }
}

/** Mutations report committed success independently of the subsequent balance read. */
export async function markDay(
  scope: TenantScope,
  input: z.infer<typeof markDayInput>,
) {
  const data = markDayInput.parse(input)
  try {
    await setEntry(scope, data)
    return { ok: true } as const
  } catch (error) {
    if (error instanceof RepositoryError)
      return { ok: false, retryable: false } as const
    return { ok: false, retryable: true } as const
  }
}
export async function clearDay(
  scope: TenantScope,
  input: z.infer<typeof clearDayInput>,
) {
  const data = clearDayInput.parse(input)
  try {
    await clearEntries(scope, {
      planId: data.planId,
      from: data.date,
      to: data.date,
    })
    return { ok: true } as const
  } catch (error) {
    if (error instanceof RepositoryError)
      return { ok: false, retryable: false } as const
    return { ok: false, retryable: true } as const
  }
}
