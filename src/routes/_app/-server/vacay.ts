/**
 * Reads and writes for the leave planner (`/vacay`).
 *
 * The rule that a leave plan is personal is enforced in the repository
 * (`requirePlanActor` / `requirePlanOwner`), not here: these functions validate, forward and own no
 * rule. `loadVacayAllowance` creates no plan; the route loader runs it after `loadVacay`, which has
 * already ensured the plan, because two concurrent `ensurePlan` calls would race on the owner index.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  getAllowance,
  idSchema,
  saveAllowance,
  setEntitlementInput,
  yearSchema,
} from '#/server/repos'
import { appScope } from './context'

export interface VacayAllowance {
  readonly hasRow: boolean
  readonly entitlementDays: number
  readonly carriedOverDays: number
  readonly usedDays: number
  readonly remainingDays: number
}

export interface SavedAllowance {
  readonly userId: string
  readonly year: number
  readonly entitlementDays: number
  readonly carriedOverDays: number
}

/** The caller's own balance for one year; there is no way to ask for anyone else's here. */
export const loadVacayAllowance = createServerFn({ method: 'GET' })
  .validator(z.object({ planId: idSchema, year: yearSchema }))
  .handler(async ({ data }): Promise<VacayAllowance> => {
    const scope = await appScope()
    return getAllowance(scope, data.planId, scope.ctx.userId, data.year)
  })

export const setAllowanceFn = createServerFn({ method: 'POST' })
  .validator(setEntitlementInput)
  .handler(async ({ data }): Promise<{ readonly row: SavedAllowance }> => {
    const scope = await appScope()
    const row = await saveAllowance(scope, data)
    return {
      row: {
        userId: row.userId,
        year: row.year,
        entitlementDays: row.entitlementDays,
        carriedOverDays: row.carriedOverDays,
      },
    }
  })
