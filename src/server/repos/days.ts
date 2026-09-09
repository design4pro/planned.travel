/**
 * Itinerary days: the ordered spine a trip's places, notes and accommodations hang from.
 *
 * A trip's days are always a contiguous `1..n` run. {@link syncTripDays} is the only writer of that
 * invariant — it grows, shrinks and re-dates the run when a trip's date range moves.
 */

import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { dayNotes, days } from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { NotFoundError } from './context'
import {
  dateSchema,
  definedOnly,
  idSchema,
  longTextSchema,
  positiveIntSchema,
  shortTextSchema,
  sortOrderSchema,
  timeSchema,
} from './validation'
import type { TenantScope } from './base'
import type { Day, DayNote } from '#/server/db/types'

export const daysRepository = createTenantRepository(days, 'day')
export const dayNotesRepository = createTenantRepository(dayNotes, 'day note')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

export const createDayInput = z.object({
  tripId: idSchema,
  dayNumber: positiveIntSchema,
  date: dateSchema.nullish(),
  title: shortTextSchema.nullish(),
  notes: longTextSchema.nullish(),
})
export type CreateDayInput = z.infer<typeof createDayInput>

export const updateDayInput = z.object({
  date: dateSchema.nullish(),
  title: shortTextSchema.nullish(),
  notes: longTextSchema.nullish(),
})
export type UpdateDayInput = z.infer<typeof updateDayInput>

export const createDayNoteInput = z.object({
  tripId: idSchema,
  dayId: idSchema,
  body: longTextSchema.min(1),
  time: timeSchema.nullish(),
  /** `day_notes.icon` is `NOT NULL DEFAULT 'sticky-note'`: omit it, never null it. */
  icon: shortTextSchema.min(1).optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateDayNoteInput = z.infer<typeof createDayNoteInput>

export const updateDayNoteInput = createDayNoteInput
  .omit({ tripId: true, dayId: true })
  .partial()
export type UpdateDayNoteInput = z.infer<typeof updateDayNoteInput>

/* -------------------------------------------------------------------------------------------------
 * Date helpers
 * ---------------------------------------------------------------------------------------------- */

const MS_PER_DAY = 86_400_000

/** Inclusive list of `YYYY-MM-DD` dates between two calendar dates. */
export function datesBetween(
  startDate: string,
  endDate: string,
): Array<string> {
  const start = Date.parse(`${startDate}T00:00:00.000Z`)
  const end = Date.parse(`${endDate}T00:00:00.000Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return []
  }
  const total = Math.floor((end - start) / MS_PER_DAY) + 1
  return Array.from({ length: total }, (_, offset) =>
    new Date(start + offset * MS_PER_DAY).toISOString().slice(0, 10),
  )
}

/* -------------------------------------------------------------------------------------------------
 * Queries
 * ---------------------------------------------------------------------------------------------- */

/** Every day of a trip, in itinerary order. */
export async function listTripDays(
  scope: TenantScope,
  tripId: string,
): Promise<Array<Day>> {
  return daysRepository.findMany(scope, {
    where: eq(days.tripId, tripId),
    orderBy: [asc(days.dayNumber)],
  })
}

export async function getDay(
  scope: TenantScope,
  dayId: string,
): Promise<Day | null> {
  return daysRepository.findById(scope, dayId)
}

/**
 * Resolves a day and asserts it belongs to `tripId`. Every repository that stores a `day_id` calls
 * this, so a day from another trip — or another tenant — is rejected instead of silently linked.
 */
export async function requireTripDay(
  scope: TenantScope,
  tripId: string,
  dayId: string,
): Promise<Day> {
  const day = await daysRepository.requireById(scope, dayId)
  if (day.tripId !== tripId) {
    throw new NotFoundError('day', dayId)
  }
  return day
}

export async function createDay(
  scope: TenantScope,
  input: CreateDayInput,
): Promise<Day> {
  const values = createDayInput.parse(input)
  return daysRepository.insert(scope, values)
}

export async function updateDay(
  scope: TenantScope,
  dayId: string,
  input: UpdateDayInput,
): Promise<Day> {
  return daysRepository.requireUpdate(
    scope,
    dayId,
    definedOnly(updateDayInput.parse(input)),
  )
}

export async function deleteDay(
  scope: TenantScope,
  dayId: string,
): Promise<void> {
  const day = await daysRepository.requireById(scope, dayId)
  await daysRepository.requireRemove(scope, dayId)
  // Close the gap so day numbers stay contiguous.
  await scope.db
    .update(days)
    .set({ dayNumber: sql`${days.dayNumber} - 1` })
    .where(
      tenantFilter(
        scope,
        days,
        and(eq(days.tripId, day.tripId), gt(days.dayNumber, day.dayNumber)),
      ),
    )
}

/**
 * Reconciles a trip's day run with its date range: appends missing days, deletes trailing ones and
 * re-stamps the dates of the days that remain. Returns the resulting run in order.
 */
export async function syncTripDays(
  scope: TenantScope,
  tripId: string,
  range: { startDate: string | null; endDate: string | null },
): Promise<Array<Day>> {
  const existing = await listTripDays(scope, tripId)
  const wanted =
    range.startDate && range.endDate
      ? datesBetween(range.startDate, range.endDate)
      : []

  if (wanted.length === 0) {
    // No date range: keep whatever days exist but clear their stale dates.
    const dated = existing.filter((day) => day.date !== null)
    if (dated.length > 0) {
      await daysRepository.updateWhere(
        scope,
        inArray(
          days.id,
          dated.map((day) => day.id),
        ),
        { date: null },
      )
      return listTripDays(scope, tripId)
    }
    return existing
  }

  const surplus = existing.slice(wanted.length)
  if (surplus.length > 0) {
    await daysRepository.removeWhere(
      scope,
      inArray(
        days.id,
        surplus.map((day) => day.id),
      ),
    )
  }

  const kept = existing.slice(0, wanted.length)
  for (const [index, day] of kept.entries()) {
    const date = wanted[index]
    if (day.date !== date || day.dayNumber !== index + 1) {
      await daysRepository.update(scope, day.id, { date, dayNumber: index + 1 })
    }
  }

  const missing = wanted.slice(kept.length)
  if (missing.length > 0) {
    await daysRepository.insertMany(
      scope,
      missing.map((date, offset) => ({
        tripId,
        dayNumber: kept.length + offset + 1,
        date,
      })),
    )
  }

  return listTripDays(scope, tripId)
}

/* -------------------------------------------------------------------------------------------------
 * Day notes
 * ---------------------------------------------------------------------------------------------- */

export async function listDayNotes(
  scope: TenantScope,
  dayId: string,
): Promise<Array<DayNote>> {
  return dayNotesRepository.findMany(scope, {
    where: eq(dayNotes.dayId, dayId),
    orderBy: [asc(dayNotes.sortOrder), asc(dayNotes.id)],
  })
}

export async function listTripDayNotes(
  scope: TenantScope,
  tripId: string,
): Promise<Array<DayNote>> {
  return dayNotesRepository.findMany(scope, {
    where: eq(dayNotes.tripId, tripId),
    orderBy: [asc(dayNotes.sortOrder), asc(dayNotes.id)],
  })
}

export async function createDayNote(
  scope: TenantScope,
  input: CreateDayNoteInput,
): Promise<DayNote> {
  const values = createDayNoteInput.parse(input)
  // The insert stamps `organization_id` from the caller's own scope, so a foreign `dayId` would be
  // written as a row this tenant owns and the other cannot see. The day check is what refuses it —
  // including a day of another trip of the caller's own, which the tenant filter alone lets through.
  await requireTripDay(scope, values.tripId, values.dayId)
  return dayNotesRepository.insert(scope, {
    ...values,
    createdBy: scope.ctx.userId,
  })
}

export async function updateDayNote(
  scope: TenantScope,
  noteId: string,
  input: UpdateDayNoteInput,
): Promise<DayNote> {
  return dayNotesRepository.requireUpdate(
    scope,
    noteId,
    definedOnly(updateDayNoteInput.parse(input)),
  )
}

export async function deleteDayNote(
  scope: TenantScope,
  noteId: string,
): Promise<void> {
  await dayNotesRepository.requireRemove(scope, noteId)
}
