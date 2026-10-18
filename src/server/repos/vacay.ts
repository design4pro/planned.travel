/**
 * Vacay — planning annual leave around the trips.
 *
 * One plan per traveller per tenant (`vacay_plans_org_owner_unq`); colleagues join a plan so the
 * calendar can show overlapping absences. Entitlement lives on `vacay_user_years` so a plan can be
 * shared by people with different allowances, and {@link getPlanOverview} is the single read behind
 * the year grid.
 */

import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import {
  VACAY_ENTRY_KINDS,
  VACAY_MEMBER_STATUSES,
  vacayCompanyHolidays,
  vacayEntries,
  vacayHolidayCalendars,
  vacayPlanMembers,
  vacayPlans,
  vacayUserColours,
  vacayUserYears,
  vacayYears,
} from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { runBatch } from './batch'
import { NotFoundError, RepositoryError } from './context'
import { getMembership } from './members'
import {
  colourSchema,
  dateSchema,
  definedOnly,
  idSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  titleSchema,
  yearSchema,
} from './validation'
import type {
  VacayCompanyHoliday,
  VacayEntry,
  VacayHolidayCalendar,
  VacayPlan,
  VacayPlanMember,
  VacayUserColour,
  VacayUserYear,
  VacayYear,
} from '#/server/db/types'
import type { TenantScope } from './base'

export const vacayPlansRepository = createTenantRepository(vacayPlans, 'vacay plan')
export const vacayPlanMembersRepository = createTenantRepository(
  vacayPlanMembers,
  'vacay plan member',
)
export const vacayYearsRepository = createTenantRepository(vacayYears, 'vacay year')
export const vacayUserYearsRepository = createTenantRepository(vacayUserYears, 'vacay entitlement')
export const vacayEntriesRepository = createTenantRepository(vacayEntries, 'vacay entry')
export const vacayCompanyHolidaysRepository = createTenantRepository(
  vacayCompanyHolidays,
  'company holiday',
)
export const vacayHolidayCalendarsRepository = createTenantRepository(
  vacayHolidayCalendars,
  'holiday calendar',
)
export const vacayUserColoursRepository = createTenantRepository(vacayUserColours, 'vacay colour')

/** How much of a day each entry kind consumes from the allowance. */
const ENTRY_KIND_COST: Record<(typeof VACAY_ENTRY_KINDS)[number], number> = {
  vacation: 1,
  half_day: 0.5,
  sick: 0,
  remote: 0,
  holiday: 0,
  other: 0,
}

/**
 * Thrown when someone who may see a leave plan asks for something only its owner may do: another
 * traveller's allowance. A diagnostic, not authored copy: the reader sees the caller's localised
 * fallback, and the authored-error set stays closed (`docs/SPEC.md` §9 rule 10).
 */
export class PlanOwnerOnlyError extends RepositoryError {
  constructor(planId: string) {
    super(`Only the owner of vacay plan ${planId} may do this.`, 'PLAN_OWNER_ONLY')
  }
}

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const entryKindSchema = z.enum(VACAY_ENTRY_KINDS)

export const updatePlanInput = z.object({
  name: titleSchema.optional(),
  blockWeekends: z.boolean().optional(),
  holidaysEnabled: z.boolean().optional(),
  companyHolidaysEnabled: z.boolean().optional(),
  carryOverEnabled: z.boolean().optional(),
  defaultEntitlementDays: nonNegativeIntSchema.max(365).optional(),
})
export type UpdatePlanInput = z.infer<typeof updatePlanInput>

export const setEntryInput = z.object({
  planId: idSchema,
  userId: idSchema.optional(),
  date: dateSchema,
  kind: entryKindSchema.optional(),
  note: shortTextSchema.nullish(),
})
export type SetEntryInput = z.infer<typeof setEntryInput>

export const setEntryRangeInput = z.object({
  planId: idSchema,
  userId: idSchema.optional(),
  from: dateSchema,
  to: dateSchema,
  kind: entryKindSchema.optional(),
  note: shortTextSchema.nullish(),
})
export type SetEntryRangeInput = z.infer<typeof setEntryRangeInput>

export const setEntitlementInput = z.object({
  planId: idSchema,
  userId: idSchema.optional(),
  year: yearSchema,
  entitlementDays: nonNegativeIntSchema.max(365).optional(),
  carriedOverDays: nonNegativeIntSchema.max(365).optional(),
})
export type SetEntitlementInput = z.infer<typeof setEntitlementInput>

export const addCompanyHolidayInput = z.object({
  planId: idSchema,
  date: dateSchema,
  label: shortTextSchema.nullish(),
})
export type AddCompanyHolidayInput = z.infer<typeof addCompanyHolidayInput>

export const addHolidayCalendarInput = z.object({
  planId: idSchema,
  region: z.string().trim().min(2).max(16),
  label: shortTextSchema.nullish(),
  colour: colourSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type AddHolidayCalendarInput = z.infer<typeof addHolidayCalendarInput>

/* -------------------------------------------------------------------------------------------------
 * Plan
 * ---------------------------------------------------------------------------------------------- */

/** The acting user's plan, created on first use together with its membership row. */
export async function ensurePlan(scope: TenantScope, ownerUserId?: string): Promise<VacayPlan> {
  const owner = ownerUserId === undefined ? scope.ctx.userId : idSchema.parse(ownerUserId)
  const existing = await vacayPlansRepository.findOne(
    scope,
    eq(vacayPlans.ownerUserId, owner),
  )
  if (existing) {
    return existing
  }
  const plan = await vacayPlansRepository.insert(scope, { ownerUserId: owner })
  await vacayPlanMembersRepository.insert(scope, {
    planId: plan.id,
    userId: owner,
    status: 'accepted',
  })
  return plan
}

export interface PlanActor {
  readonly plan: VacayPlan
  readonly isOwner: boolean
}

/**
 * The one rule every leave-planner writer and reader answers to: the caller owns the plan or is an
 * accepted member of it. Anyone else in the workspace, a pending or declined member included, gets
 * the error a plan that does not exist gets. No workspace role overrides it: a leave plan is personal.
 */
export async function requirePlanActor(scope: TenantScope, planId: string): Promise<PlanActor> {
  const plan = await vacayPlansRepository.requireById(scope, planId)
  const isOwner = plan.ownerUserId === scope.ctx.userId
  if (!isOwner && !(await isAcceptedPlanMember(scope, plan.id, scope.ctx.userId))) {
    throw new NotFoundError('vacay plan', planId)
  }
  return { plan, isOwner }
}

/** {@link requirePlanActor}, and the caller must own the plan. */
export async function requirePlanOwner(scope: TenantScope, planId: string): Promise<PlanActor> {
  const actor = await requirePlanActor(scope, planId)
  if (!actor.isOwner) {
    throw new PlanOwnerOnlyError(planId)
  }
  return actor
}

async function isAcceptedPlanMember(
  scope: TenantScope,
  planId: string,
  userId: string,
): Promise<boolean> {
  const row = await vacayPlanMembersRepository.findOne(
    scope,
    allOf(
      eq(vacayPlanMembers.planId, planId),
      eq(vacayPlanMembers.userId, userId),
      eq(vacayPlanMembers.status, 'accepted'),
    ),
  )
  return row !== null
}

/**
 * Whose figures a call is about, once the caller has passed {@link requirePlanActor}: their own, or
 * - for the plan's owner only - an accepted plan member's who is still a member of the workspace.
 * A plan-member row outlives `removeMember`, so it alone proves nothing about who is here now.
 */
async function resolveAllowanceTarget(
  scope: TenantScope,
  actor: PlanActor,
  userId: string | undefined,
): Promise<string> {
  const target = userId === undefined ? scope.ctx.userId : idSchema.parse(userId)
  if (target === scope.ctx.userId) {
    return target
  }
  if (!actor.isOwner) {
    throw new PlanOwnerOnlyError(actor.plan.id)
  }
  const stillHere =
    (await isAcceptedPlanMember(scope, actor.plan.id, target)) &&
    (await getMembership(scope, target)) !== null
  if (!stillHere) {
    throw new NotFoundError('vacay plan member', target)
  }
  return target
}

/** Plans the traveller can see: their own, plus the ones they have joined. */
export async function listPlansForUser(
  scope: TenantScope,
  userId: string,
): Promise<Array<VacayPlan>> {
  const memberships = await vacayPlanMembersRepository.findMany(scope, {
    where: eq(vacayPlanMembers.userId, userId),
  })
  const ids = new Set(memberships.map((row) => row.planId))
  const owned = await vacayPlansRepository.findMany(scope, {
    where: eq(vacayPlans.ownerUserId, userId),
  })
  for (const plan of owned) {
    ids.add(plan.id)
  }
  if (ids.size === 0) {
    return []
  }
  return vacayPlansRepository.findByIds(scope, [...ids])
}

export async function updatePlan(
  scope: TenantScope,
  planId: string,
  input: UpdatePlanInput,
): Promise<VacayPlan> {
  return vacayPlansRepository.requireUpdate(scope, planId, definedOnly(updatePlanInput.parse(input)))
}

export async function deletePlan(scope: TenantScope, planId: string): Promise<void> {
  await vacayPlansRepository.requireRemove(scope, planId)
}

/* -------------------------------------------------------------------------------------------------
 * Members and colours
 * ---------------------------------------------------------------------------------------------- */

export async function listPlanMembers(
  scope: TenantScope,
  planId: string,
): Promise<Array<VacayPlanMember>> {
  return vacayPlanMembersRepository.findMany(scope, {
    where: eq(vacayPlanMembers.planId, planId),
    orderBy: [asc(vacayPlanMembers.createdAt)],
  })
}

export async function invitePlanMember(
  scope: TenantScope,
  planId: string,
  userId: string,
): Promise<VacayPlanMember> {
  await vacayPlansRepository.requireById(scope, planId)
  const id = idSchema.parse(userId)
  const existing = await vacayPlanMembersRepository.findOne(
    scope,
    allOf(eq(vacayPlanMembers.planId, planId), eq(vacayPlanMembers.userId, id)),
  )
  if (existing) {
    return existing
  }
  return vacayPlanMembersRepository.insert(scope, { planId, userId: id })
}

export async function setPlanMemberStatus(
  scope: TenantScope,
  memberId: string,
  status: (typeof VACAY_MEMBER_STATUSES)[number],
): Promise<VacayPlanMember> {
  return vacayPlanMembersRepository.requireUpdate(scope, memberId, {
    status: z.enum(VACAY_MEMBER_STATUSES).parse(status),
  })
}

export async function removePlanMember(scope: TenantScope, memberId: string): Promise<void> {
  await vacayPlanMembersRepository.requireRemove(scope, memberId)
}

export async function listUserColours(
  scope: TenantScope,
  planId: string,
): Promise<Array<VacayUserColour>> {
  return vacayUserColoursRepository.findMany(scope, {
    where: eq(vacayUserColours.planId, planId),
  })
}

/** Sets the colour a traveller is drawn in on the year grid. */
export async function setUserColour(
  scope: TenantScope,
  planId: string,
  userId: string,
  colour: string,
): Promise<VacayUserColour> {
  await vacayPlansRepository.requireById(scope, planId)
  const id = idSchema.parse(userId)
  const value = colourSchema.parse(colour)
  const existing = await vacayUserColoursRepository.findOne(
    scope,
    allOf(eq(vacayUserColours.planId, planId), eq(vacayUserColours.userId, id)),
  )
  if (existing) {
    return vacayUserColoursRepository.requireUpdate(scope, existing.id, { colour: value })
  }
  return vacayUserColoursRepository.insert(scope, { planId, userId: id, colour: value })
}

/* -------------------------------------------------------------------------------------------------
 * Years and entitlement
 * ---------------------------------------------------------------------------------------------- */

export async function listYears(scope: TenantScope, planId: string): Promise<Array<VacayYear>> {
  return vacayYearsRepository.findMany(scope, {
    where: eq(vacayYears.planId, planId),
    orderBy: [desc(vacayYears.year)],
  })
}

export async function ensureYear(
  scope: TenantScope,
  planId: string,
  year: number,
): Promise<VacayYear> {
  await vacayPlansRepository.requireById(scope, planId)
  const value = yearSchema.parse(year)
  const existing = await vacayYearsRepository.findOne(
    scope,
    allOf(eq(vacayYears.planId, planId), eq(vacayYears.year, value)),
  )
  return existing ?? vacayYearsRepository.insert(scope, { planId, year: value })
}

export async function removeYear(scope: TenantScope, yearId: string): Promise<void> {
  await vacayYearsRepository.requireRemove(scope, yearId)
}

export async function listUserYears(
  scope: TenantScope,
  planId: string,
  year: number,
): Promise<Array<VacayUserYear>> {
  return vacayUserYearsRepository.findMany(scope, {
    where: allOf(eq(vacayUserYears.planId, planId), eq(vacayUserYears.year, yearSchema.parse(year))),
  })
}

/** Sets one traveller's allowance for a year, creating the row on first use. */
export async function setEntitlement(
  scope: TenantScope,
  input: SetEntitlementInput,
): Promise<VacayUserYear> {
  const values = setEntitlementInput.parse(input)
  const plan = await vacayPlansRepository.requireById(scope, values.planId)
  const userId = values.userId ?? scope.ctx.userId

  const existing = await vacayUserYearsRepository.findOne(
    scope,
    allOf(
      eq(vacayUserYears.planId, plan.id),
      eq(vacayUserYears.userId, userId),
      eq(vacayUserYears.year, values.year),
    ),
  )

  if (existing) {
    return vacayUserYearsRepository.requireUpdate(
      scope,
      existing.id,
      definedOnly({
        entitlementDays: values.entitlementDays,
        carriedOverDays: values.carriedOverDays,
      }),
    )
  }

  return vacayUserYearsRepository.insert(scope, {
    planId: plan.id,
    userId,
    year: values.year,
    entitlementDays: values.entitlementDays ?? plan.defaultEntitlementDays,
    carriedOverDays: values.carriedOverDays ?? 0,
  })
}

/**
 * Saves one traveller's allowance for a year behind {@link requirePlanActor}: your own as an owner or
 * accepted member, someone else's as the owner only. Nothing is read or written for the target
 * before every check has passed.
 */
export async function saveAllowance(
  scope: TenantScope,
  input: SetEntitlementInput,
): Promise<VacayUserYear> {
  const values = setEntitlementInput.parse(input)
  const actor = await requirePlanActor(scope, values.planId)
  const userId = await resolveAllowanceTarget(scope, actor, values.userId)
  return setEntitlement(scope, { ...values, userId })
}

export interface Allowance {
  /** False while the figures are the plan's default and nothing has been saved. */
  readonly hasRow: boolean
  readonly entitlementDays: number
  readonly carriedOverDays: number
  /** Days consumed by the traveller alone, counting a half day as 0.5. */
  readonly usedDays: number
  readonly remainingDays: number
}

/** One traveller's balance for one year, behind the same rule as {@link saveAllowance}. */
export async function getAllowance(
  scope: TenantScope,
  planId: string,
  userId: string,
  year: number,
): Promise<Allowance> {
  const actor = await requirePlanActor(scope, planId)
  const target = await resolveAllowanceTarget(scope, actor, userId)
  const statYear = yearSchema.parse(year)

  const row = await vacayUserYearsRepository.findOne(
    scope,
    allOf(
      eq(vacayUserYears.planId, actor.plan.id),
      eq(vacayUserYears.userId, target),
      eq(vacayUserYears.year, statYear),
    ),
  )
  const usedDays = await countUsedDays(scope, actor.plan.id, target, statYear)
  const entitlementDays = row?.entitlementDays ?? actor.plan.defaultEntitlementDays
  const carriedOverDays = actor.plan.carryOverEnabled ? (row?.carriedOverDays ?? 0) : 0
  return {
    hasRow: row !== null,
    entitlementDays,
    carriedOverDays,
    usedDays,
    remainingDays: entitlementDays + carriedOverDays - usedDays,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Entries
 * ---------------------------------------------------------------------------------------------- */

export async function listVacayEntries(
  scope: TenantScope,
  planId: string,
  options: { readonly year?: number; readonly userId?: string } = {},
): Promise<Array<VacayEntry>> {
  const year = options.year === undefined ? undefined : yearSchema.parse(options.year)
  return vacayEntriesRepository.findMany(scope, {
    where: and(
      eq(vacayEntries.planId, planId),
      options.userId ? eq(vacayEntries.userId, options.userId) : undefined,
      year === undefined ? undefined : gte(vacayEntries.date, `${year}-01-01`),
      year === undefined ? undefined : lte(vacayEntries.date, `${year}-12-31`),
    ),
    orderBy: [asc(vacayEntries.date)],
  })
}

/** Marks one day. Re-marking a day replaces its kind rather than adding a second row. */
export async function setEntry(scope: TenantScope, input: SetEntryInput): Promise<VacayEntry> {
  const values = setEntryInput.parse(input)
  await vacayPlansRepository.requireById(scope, values.planId)
  const userId = values.userId ?? scope.ctx.userId

  const existing = await vacayEntriesRepository.findOne(
    scope,
    allOf(
      eq(vacayEntries.planId, values.planId),
      eq(vacayEntries.userId, userId),
      eq(vacayEntries.date, values.date),
    ),
  )

  if (existing) {
    return vacayEntriesRepository.requireUpdate(scope, existing.id, {
      kind: values.kind ?? existing.kind,
      note: values.note ?? existing.note,
    })
  }

  return vacayEntriesRepository.insert(scope, {
    planId: values.planId,
    userId,
    date: values.date,
    kind: values.kind,
    note: values.note,
  })
}

/**
 * Marks a whole date range in one batch — dragging across the year grid. Days that already carry an
 * entry are updated, the rest are inserted.
 */
export async function setEntryRange(
  scope: TenantScope,
  input: SetEntryRangeInput,
): Promise<Array<VacayEntry>> {
  const values = setEntryRangeInput.parse(input)
  await vacayPlansRepository.requireById(scope, values.planId)
  const userId = values.userId ?? scope.ctx.userId
  const dates = calendarRange(values.from, values.to)
  if (dates.length === 0) {
    return []
  }

  const existing = await vacayEntriesRepository.findMany(scope, {
    where: allOf(
      eq(vacayEntries.planId, values.planId),
      eq(vacayEntries.userId, userId),
      gte(vacayEntries.date, values.from),
      lte(vacayEntries.date, values.to),
    ),
  })
  const known = new Map(existing.map((row) => [row.date, row]))

  const updates = existing.map((row) =>
    scope.db
      .update(vacayEntries)
      .set({ kind: values.kind ?? row.kind, note: values.note ?? row.note })
      .where(tenantFilter(scope, vacayEntries, eq(vacayEntries.id, row.id))),
  )
  await runBatch(scope, updates)

  const missing = dates.filter((date) => !known.has(date))
  if (missing.length > 0) {
    await vacayEntriesRepository.insertMany(
      scope,
      missing.map((date) => ({
        planId: values.planId,
        userId,
        date,
        kind: values.kind,
        note: values.note,
      })),
    )
  }

  return listVacayEntries(scope, values.planId, { userId })
}

export async function removeEntry(scope: TenantScope, entryId: string): Promise<void> {
  await vacayEntriesRepository.requireRemove(scope, entryId)
}

const MS_PER_DAY = 86_400_000

/** Inclusive `YYYY-MM-DD` range, capped at two years so a bad input cannot fan out. */
function calendarRange(from: string, to: string): Array<string> {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return []
  }
  const total = Math.min(Math.floor((end - start) / MS_PER_DAY) + 1, 732)
  return Array.from({ length: total }, (_, offset) =>
    new Date(start + offset * MS_PER_DAY).toISOString().slice(0, 10),
  )
}

/* -------------------------------------------------------------------------------------------------
 * Holidays
 * ---------------------------------------------------------------------------------------------- */

export async function listCompanyHolidays(
  scope: TenantScope,
  planId: string,
  options: { readonly year?: number } = {},
): Promise<Array<VacayCompanyHoliday>> {
  const year = options.year === undefined ? undefined : yearSchema.parse(options.year)
  return vacayCompanyHolidaysRepository.findMany(scope, {
    where: and(
      eq(vacayCompanyHolidays.planId, planId),
      year === undefined ? undefined : gte(vacayCompanyHolidays.date, `${year}-01-01`),
      year === undefined ? undefined : lte(vacayCompanyHolidays.date, `${year}-12-31`),
    ),
    orderBy: [asc(vacayCompanyHolidays.date)],
  })
}

export async function addCompanyHoliday(
  scope: TenantScope,
  input: AddCompanyHolidayInput,
): Promise<VacayCompanyHoliday> {
  const values = addCompanyHolidayInput.parse(input)
  await vacayPlansRepository.requireById(scope, values.planId)
  const existing = await vacayCompanyHolidaysRepository.findOne(
    scope,
    allOf(
      eq(vacayCompanyHolidays.planId, values.planId),
      eq(vacayCompanyHolidays.date, values.date),
    ),
  )
  if (existing) {
    return vacayCompanyHolidaysRepository.requireUpdate(scope, existing.id, {
      label: values.label ?? existing.label,
    })
  }
  return vacayCompanyHolidaysRepository.insert(scope, values)
}

export async function removeCompanyHoliday(
  scope: TenantScope,
  companyHolidayId: string,
): Promise<void> {
  await vacayCompanyHolidaysRepository.requireRemove(scope, companyHolidayId)
}

export async function listHolidayCalendars(
  scope: TenantScope,
  planId: string,
): Promise<Array<VacayHolidayCalendar>> {
  return vacayHolidayCalendarsRepository.findMany(scope, {
    where: eq(vacayHolidayCalendars.planId, planId),
    orderBy: [asc(vacayHolidayCalendars.sortOrder), asc(vacayHolidayCalendars.region)],
  })
}

export async function addHolidayCalendar(
  scope: TenantScope,
  input: AddHolidayCalendarInput,
): Promise<VacayHolidayCalendar> {
  const values = addHolidayCalendarInput.parse(input)
  await vacayPlansRepository.requireById(scope, values.planId)
  const existing = await vacayHolidayCalendarsRepository.findOne(
    scope,
    allOf(
      eq(vacayHolidayCalendars.planId, values.planId),
      eq(vacayHolidayCalendars.region, values.region),
    ),
  )
  return existing ?? vacayHolidayCalendarsRepository.insert(scope, values)
}

export async function removeHolidayCalendar(
  scope: TenantScope,
  calendarId: string,
): Promise<void> {
  await vacayHolidayCalendarsRepository.requireRemove(scope, calendarId)
}

/* -------------------------------------------------------------------------------------------------
 * Overview
 * ---------------------------------------------------------------------------------------------- */

export interface VacayBalance {
  readonly userId: string
  readonly entitlementDays: number
  readonly carriedOverDays: number
  /** Days consumed, counting a half day as 0.5. */
  readonly usedDays: number
  readonly remainingDays: number
}

export interface VacayPlanOverview {
  readonly plan: VacayPlan
  readonly year: number
  readonly members: ReadonlyArray<VacayPlanMember>
  readonly entries: ReadonlyArray<VacayEntry>
  readonly companyHolidays: ReadonlyArray<VacayCompanyHoliday>
  readonly calendars: ReadonlyArray<VacayHolidayCalendar>
  readonly colours: ReadonlyArray<VacayUserColour>
  readonly balances: ReadonlyArray<VacayBalance>
}

/** Everything the vacay year grid needs for one plan and one year, in six scoped reads. */
export async function getPlanOverview(
  scope: TenantScope,
  planId: string,
  year: number,
): Promise<VacayPlanOverview> {
  const plan = await vacayPlansRepository.requireById(scope, planId)
  const statYear = yearSchema.parse(year)

  const [members, entries, companyHolidays, calendars, colours, userYears] = await Promise.all([
    listPlanMembers(scope, planId),
    listVacayEntries(scope, planId, { year: statYear }),
    listCompanyHolidays(scope, planId, { year: statYear }),
    listHolidayCalendars(scope, planId),
    listUserColours(scope, planId),
    listUserYears(scope, planId, statYear),
  ])

  const entitlementByUser = new Map(userYears.map((row) => [row.userId, row]))
  const usedByUser = new Map<string, number>()
  for (const entry of entries) {
    const kind = entryKindSchema.catch('other').parse(entry.kind)
    usedByUser.set(entry.userId, (usedByUser.get(entry.userId) ?? 0) + ENTRY_KIND_COST[kind])
  }

  const userIds = [
    ...new Set([
      plan.ownerUserId,
      ...members.map((row) => row.userId),
      ...entries.map((row) => row.userId),
    ]),
  ]

  const balances = userIds.map((userId) => {
    const row = entitlementByUser.get(userId)
    const entitlementDays = row?.entitlementDays ?? plan.defaultEntitlementDays
    const carriedOverDays = plan.carryOverEnabled ? (row?.carriedOverDays ?? 0) : 0
    const usedDays = usedByUser.get(userId) ?? 0
    return {
      userId,
      entitlementDays,
      carriedOverDays,
      usedDays,
      remainingDays: entitlementDays + carriedOverDays - usedDays,
    }
  })

  return {
    plan,
    year: statYear,
    members,
    entries,
    companyHolidays,
    calendars,
    colours,
    balances,
  }
}

/** Days consumed by one traveller in a year — the vacay stat card. */
export async function countUsedDays(
  scope: TenantScope,
  planId: string,
  userId: string,
  year: number,
): Promise<number> {
  const entries = await listVacayEntries(scope, planId, { year, userId })
  return entries.reduce(
    (total, entry) => total + ENTRY_KIND_COST[entryKindSchema.catch('other').parse(entry.kind)],
    0,
  )
}

/** Entry counts per kind for a plan and year — the legend on the vacay screen. */
export async function countEntriesByKind(
  scope: TenantScope,
  planId: string,
  year: number,
): Promise<Array<{ readonly kind: string; readonly value: number }>> {
  const statYear = yearSchema.parse(year)
  const rows = await scope.db
    .select({ kind: vacayEntries.kind, value: count() })
    .from(vacayEntries)
    .where(
      tenantFilter(
        scope,
        vacayEntries,
        eq(vacayEntries.planId, planId),
        gte(vacayEntries.date, `${statYear}-01-01`),
        lte(vacayEntries.date, `${statYear}-12-31`),
      ),
    )
    .groupBy(vacayEntries.kind)
  return rows
}
