/**
 * Reads and writes for the leave planner (`/vacay`).
 *
 * The rule that a leave plan is personal is enforced in the repository
 * (`requirePlanActor` / `requirePlanOwner`), not here: these functions validate, forward and own no
 * rule. `loadVacayAllowance` creates no plan; the route loader runs it after `loadVacay`, which has
 * already ensured the plan, because two concurrent `ensurePlan` calls would race on the owner index.
 */
import { todayIso } from '#/server/serialise'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  getAllowance,
  idSchema,
  saveAllowance,
  setEntitlementInput,
  updatePlanSettings,
  updatePlanSettingsInput,
  yearSchema,
} from '#/server/repos'
import {
  markDayInput,
  clearDayInput,
  gridInput,
  markDay,
  clearDay,
  readGrid,
} from '#/server/fns/vacay-lib/handlers'
import { appScope } from './context'

export interface VacayAllowance {
  readonly hasRow: boolean
  readonly entitlementDays: number
  readonly carriedOverDays: number
  readonly usedDays: number
  readonly remainingDays: number
  /** The carried figure is entered, not calculated: no row exists for the year before. */
  readonly openingBalance: boolean
  readonly previousYear: number
}

export interface SavedAllowance {
  readonly userId: string
  readonly year: number
  readonly entitlementDays: number
  readonly carriedOverDays: number
}

export interface AllowanceSaved {
  readonly row: SavedAllowance
  /** The typed opening balance this save replaced with a calculated one, and what it held. */
  readonly superseded: { readonly year: number; readonly was: number } | null
}

export interface VacayPlanSettings {
  readonly id: string
  readonly carryOverEnabled: boolean
  readonly defaultEntitlementDays: number
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
  .handler(async ({ data }): Promise<AllowanceSaved> => {
    const scope = await appScope()
    const { row, superseded } = await saveAllowance(scope, data)
    return {
      row: {
        userId: row.userId,
        year: row.year,
        entitlementDays: row.entitlementDays,
        carriedOverDays: row.carriedOverDays,
      },
      superseded,
    }
  })

/** The plan settings the dialog owns; only the plan's owner gets past the repository. */
export const updateVacayPlanFn = createServerFn({ method: 'POST' })
  .validator(updatePlanSettingsInput.extend({ planId: idSchema }))
  .handler(async ({ data }): Promise<VacayPlanSettings> => {
    const { planId, ...patch } = data
    const scope = await appScope()
    const plan = await updatePlanSettings(scope, planId, patch)
    return {
      id: plan.id,
      carryOverEnabled: plan.carryOverEnabled,
      defaultEntitlementDays: plan.defaultEntitlementDays,
    }
  })

/** Own-day operations have strict wire inputs: even the caller's userId is refused. */
export const markVacayDayFn = createServerFn({ method: 'POST' })
  .validator(markDayInput)
  .handler(async ({ data }) => markDay(await appScope(), data))

export const clearVacayDayFn = createServerFn({ method: 'POST' })
  .validator(clearDayInput)
  .handler(async ({ data }) => clearDay(await appScope(), data))

export const loadVacayGridFn = createServerFn({ method: 'GET' })
  .validator(gridInput)
  .handler(async ({ data }) => ({
    ...(await readGrid(await appScope(), data)),
    today: todayIso(),
  }))
