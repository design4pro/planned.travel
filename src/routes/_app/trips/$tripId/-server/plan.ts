/**
 * The planner's reads and writes.
 *
 * The planner is the one screen that both draws the trip and edits it, so it gets
 * its own loader rather than sharing the generic plan read: the map needs
 * coordinates, photographs and ratings that a list does not, and shipping them for
 * every other tab would be waste. The payload is normalised — places once, stops
 * pointing at them — because the same place appears in the itinerary rail, the ideas
 * rail and on the map, and sending it three times is three chances for the three
 * copies to disagree.
 *
 * Every write is one repository call behind a Zod boundary, and the arrangement
 * writes touch only the columns that say where a row sits: `day_assignments.day_id`
 * and `order_index`, and — since the day became one sequence rather than two lists
 * (PRD #104 decision 9) — `day_notes.sort_order` beside them, as one number line.
 * Nothing here writes `days.day_number`, which is what keeps the trip's contiguous
 * `1..n` day run — owned solely by `syncTripDays` — safe from a drag.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { RESERVATION_STATUSES } from '#/server/db/schema'
import {
  assertTripRole,
  createAssignment,
  createPlace,
  deleteAssignment,
  deletePlace,
  getTripItinerary,
  listCategories,
  listDayAssignments,
  listTripAssignments,
  listTripPlaces,
  listUnscheduledPlaces,
  moveAssignment,
  reorderDayTimeline,
  reorderPlaces,
  requireTrip,
  updateAssignment,
  updatePlace,
} from '#/server/repos'
import { mirrorToRoom, patch } from '#/server/fns/context'
import { appScope } from '../../../-server/context'

import type { TripPatch } from '#/server/do'
import type { TenantScope } from '#/server/repos'
import type { Trip } from '#/server/db/types'

/**
 * Booking states a stop can be in.
 *
 * Re-exported as a type so the planner's form can be exhaustive over it without
 * importing the Drizzle schema into the browser bundle — a `import type` is erased.
 */
export type PlanReservationStatus = (typeof RESERVATION_STATUSES)[number]

/**
 * Narrows the stored column back to its own vocabulary.
 *
 * The column carries a `CHECK` constraint, so an unknown value cannot be written —
 * but Drizzle types a `text` column as `string`, and asserting past that would trade
 * a real guarantee for a cast. Degrading to `none` keeps the guarantee and keeps the
 * screen renderable if the enum ever grows ahead of this file.
 */
function asReservationStatus(value: string): PlanReservationStatus {
  return RESERVATION_STATUSES.find((entry) => entry === value) ?? 'none'
}

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const id = z.string().trim().min(1).max(64)
const tripInput = z.object({ tripId: id })

/** `HH:MM`, or the empty string meaning "clear it". */
const timeOrBlank = z.union([
  z.literal(''),
  z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour time'),
])

/** A trimmed optional string. Blank means "no value", never "unchanged". */
const optionalText = (max: number) => z.string().trim().max(max)

function blankToNull(value: string): string | null {
  return value === '' ? null : value
}

/* -------------------------------------------------------------------------------------------------
 * Guards
 * ---------------------------------------------------------------------------------------------- */

/**
 * Resolves the trip and refuses to write to an archived one.
 *
 * An archived trip is a record of something that happened; silently letting a drag
 * rewrite it is how a history stops being one. The rails render read-only for an
 * archived trip, so this is a backstop for a stale tab rather than the primary
 * affordance — which is why it can afford to be a plain error.
 */
async function writableTrip(scope: TenantScope, tripId: string): Promise<Trip> {
  const trip = await requireTrip(scope, tripId)
  if (trip.isArchived) {
    throw new Error('This trip is archived. Restore it before making changes.')
  }
  return trip
}

/* -------------------------------------------------------------------------------------------------
 * Read
 * ---------------------------------------------------------------------------------------------- */

/** A place in the trip's inventory, with everything the map and the rails draw. */
export interface PlanBoardPlace {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly city: string | null
  readonly categoryId: string | null
  readonly imageUrl: string | null
  readonly website: string | null
  readonly description: string | null
  readonly rating: number | null
  readonly lat: number | null
  readonly lng: number | null
  readonly isVisited: boolean
  readonly durationMinutes: number
}

/** One scheduled stop. Points at a place rather than repeating it. */
export interface PlanBoardStop {
  readonly assignmentId: string
  readonly placeId: string
  readonly startTime: string | null
  readonly endTime: string | null
  readonly durationMinutes: number | null
  readonly reservationStatus: PlanReservationStatus
  readonly notes: string | null
}

export interface PlanBoardDay {
  readonly dayId: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
  readonly stops: ReadonlyArray<PlanBoardStop>
  /** Accommodation names covering this day. */
  readonly stays: ReadonlyArray<string>
  readonly notes: ReadonlyArray<{
    readonly id: string
    readonly body: string
    readonly time: string | null
  }>
}

export interface PlanBoardCategory {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly colour: string
  readonly icon: string
}

export interface PlanBoardPayload {
  readonly tripId: string
  readonly editable: boolean
  readonly days: ReadonlyArray<PlanBoardDay>
  /** The whole inventory, in board order. Both rails and the map read from here. */
  readonly places: ReadonlyArray<PlanBoardPlace>
  /** Ids of places with no day yet, in board order. */
  readonly unscheduledIds: ReadonlyArray<string>
  readonly categories: ReadonlyArray<PlanBoardCategory>
}

export const loadPlanBoard = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<PlanBoardPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [itinerary, inventory, unscheduled, categories] = await Promise.all([
      getTripItinerary(scope, trip.id),
      listTripPlaces(scope, { tripId: trip.id }),
      listUnscheduledPlaces(scope, trip.id),
      listCategories(scope),
    ])

    return {
      tripId: trip.id,
      editable: !trip.isArchived,
      unscheduledIds: unscheduled.map((place) => place.id),
      categories: categories.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        colour: row.colour,
        icon: row.icon,
      })),
      places: inventory.map((place) => ({
        id: place.id,
        name: place.name,
        address: place.address,
        city: place.city,
        categoryId: place.categoryId,
        imageUrl: place.imageUrl,
        website: place.website,
        description: place.description,
        rating: place.rating,
        lat: place.lat,
        lng: place.lng,
        isVisited: place.isVisited,
        durationMinutes: place.durationMinutes,
      })),
      days: itinerary.map((entry) => ({
        dayId: entry.day.id,
        dayNumber: entry.day.dayNumber,
        date: entry.day.date,
        title: entry.day.title,
        stays: entry.accommodations.map((stay) => stay.name),
        notes: entry.notes.map((note) => ({
          id: note.id,
          body: note.body,
          time: note.time,
        })),
        stops: entry.stops.map((stop) => ({
          assignmentId: stop.assignment.id,
          placeId: stop.place.id,
          startTime: stop.assignment.startTime,
          endTime: stop.assignment.endTime,
          durationMinutes: stop.assignment.durationMinutes,
          reservationStatus: asReservationStatus(
            stop.assignment.reservationStatus,
          ),
          notes: stop.assignment.notes,
        })),
      })),
    }
  })

/* -------------------------------------------------------------------------------------------------
 * Reordering
 * ---------------------------------------------------------------------------------------------- */

/** One row of a day's sequence, as the browser names it. */
const timelineItem = z.strictObject(
  { kind: z.enum(['stop', 'note']), id },
  { error: 'A timeline item is a stop or a note, named by its id.' },
)

/**
 * The board's new arrangement: for each day a drag touched, the whole sequence.
 *
 * `clearTime` is the reader's answer to "move this and drop its 14:30?" (PRD #104
 * decision 9) and is refined against `items` rather than trusted: clearing a time is
 * a consequence of a move, so a row that is not being moved has no business losing
 * one, and a payload that says otherwise is a bug or a forgery either way.
 */
export const reorderPlanInputSchema = z.strictObject({
  tripId: id,
  days: z
    .array(
      z
        .strictObject({
          dayId: id,
          items: z.array(timelineItem).max(200),
          clearTime: z.array(timelineItem).max(200).optional(),
        })
        .superRefine((day, ctx) => {
          const moving = new Set(
            day.items.map((item) => `${item.kind}/${item.id}`),
          )
          for (const item of day.clearTime ?? []) {
            if (moving.has(`${item.kind}/${item.id}`)) continue
            ctx.addIssue({
              code: 'custom',
              message: 'A time can only be dropped by the move that drops it',
              path: ['clearTime'],
            })
          }
        }),
    )
    .min(1)
    .max(4),
})

/**
 * Applies the board's new arrangement.
 *
 * The client sends the *resulting* sequence of every day a drag touched — at most
 * two — and the server derives every position from array index. That is what makes
 * the indices self-healing: whatever fractional values a mid-list insert left behind,
 * the next drag renumbers the day to `0..n-1` across both position columns at once.
 * It also means a client cannot inject an index of its own choosing, only a
 * permutation of ids it can already see.
 *
 * Ids that do not belong to this trip are dropped rather than rejected: the
 * repository layer would refuse them anyway, and a stale tab whose board is one
 * delete behind should still be able to reorder the rows that do exist.
 *
 * Two writes, in this order and for one reason each:
 *
 * - **A stop that changed day moves first.** `moveAssignment` re-checks that the
 *   target day belongs to the same trip, so a forged day id fails before any
 *   position is written — and by the time the renumber runs, both the day that lost
 *   the row and the day that gained it hold exactly the rows they are about to be
 *   numbered over.
 * - **Then one `reorderDayTimeline` per day**, which is one batch per day writing
 *   `day_assignments.order_index` and `day_notes.sort_order` as a single number line,
 *   plus a `NULL` time for every `clearTime` entry. The reader's "drop its time and
 *   move it" is therefore one transaction, never a moment in which the row has a
 *   time and the wrong position.
 *
 * The plan's content is the editor's (PRD #104 decision 6), and the role is asserted
 * once here rather than only inside the per-day write, because the cross-day step
 * happens before that write and `moveAssignment` guards the trip but not the role.
 *
 * The result is mirrored to the trip room as one `day` upsert per touched day, so
 * every other viewer's board catches up without polling. D1 is the record and the
 * room is a signal: {@link mirrorToRoom} logs a refusal rather than failing the save.
 */
export const reorderPlanFn = createServerFn({ method: 'POST' })
  .validator(reorderPlanInputSchema)
  .handler(async ({ data }): Promise<{ readonly moved: number }> => {
    const scope = await appScope()
    const trip = await writableTrip(scope, data.tripId)
    // `reorderDayTimeline` asserts this itself, but the cross-day step below runs
    // first and `moveAssignment` carries no role guard of its own — so a viewer would
    // otherwise get one stop onto another day before being refused (decision 6).
    await assertTripRole(scope, trip.id, ['owner', 'editor'])

    const existing = await listTripAssignments(scope, trip.id)
    const dayById = new Map(existing.map((row) => [row.id, row.dayId]))

    for (const day of data.days) {
      for (const [index, item] of day.items.entries()) {
        if (item.kind !== 'stop') continue
        const currentDayId = dayById.get(item.id)
        if (currentDayId === undefined || currentDayId === day.dayId) continue
        await moveAssignment(scope, item.id, {
          dayId: day.dayId,
          orderIndex: index,
        })
      }
    }

    const patches: Array<TripPatch> = []
    let moved = 0
    for (const day of data.days) {
      const written = await reorderDayTimeline(scope, {
        tripId: trip.id,
        dayId: day.dayId,
        items: day.items,
        clearTime: day.clearTime,
      })
      moved += written.length
      patches.push(
        patch('day', day.dayId, {
          items: written.map((item) => ({ kind: item.kind, id: item.id })),
        }),
      )
    }

    await mirrorToRoom(scope, trip.id, patches)

    return { moved }
  })

/**
 * Half-way between two neighbours, or one past the end.
 *
 * `order_index` is a `REAL`, so an insert can land between two rows without
 * renumbering anything — which keeps scheduling a place one write instead of one
 * write plus a renumber of the whole day. The next drag through
 * {@link reorderPlanFn} folds the fraction back to an integer.
 */
function indexBetween(
  ordered: ReadonlyArray<{ readonly orderIndex: number }>,
  position: number,
): number {
  const clamped = Math.max(0, Math.min(position, ordered.length))
  const before = clamped === 0 ? null : ordered[clamped - 1].orderIndex
  const after = clamped >= ordered.length ? null : ordered[clamped].orderIndex

  if (before === null && after === null) return 0
  if (before === null) return (after ?? 0) - 1
  if (after === null) return before + 1
  return (before + after) / 2
}

/** Gives an unscheduled place a day, at the position it was dropped. */
export const schedulePlaceFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: id,
      placeId: id,
      dayId: id,
      index: z.number().int().min(0).max(500),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly assignmentId: string }> => {
    const scope = await appScope()
    const trip = await writableTrip(scope, data.tripId)

    const ordered = await listDayAssignments(scope, data.dayId)
    const assignment = await createAssignment(scope, {
      tripId: trip.id,
      dayId: data.dayId,
      placeId: data.placeId,
      orderIndex: indexBetween(ordered, data.index),
    })

    return { assignmentId: assignment.id }
  })

/** Takes a stop off its day. The place stays in the trip's inventory. */
export const unschedulePlaceFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, assignmentId: id }))
  .handler(async ({ data }): Promise<{ readonly removed: true }> => {
    const scope = await appScope()
    await writableTrip(scope, data.tripId)
    await deleteAssignment(scope, data.assignmentId)
    return { removed: true }
  })

/** Re-ranks the ideas column, which is `places.sort_order` and nothing else. */
export const rankIdeasFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, placeIds: z.array(id).min(1).max(500) }))
  .handler(async ({ data }): Promise<{ readonly ranked: number }> => {
    const scope = await appScope()
    await writableTrip(scope, data.tripId)
    const ranked = await reorderPlaces(
      scope,
      data.placeIds.map((placeId, index) => ({ placeId, sortOrder: index })),
    )
    return { ranked: ranked.length }
  })

/* -------------------------------------------------------------------------------------------------
 * Editing a stop
 * ---------------------------------------------------------------------------------------------- */

/**
 * Times, length, note and booking state of one stop.
 *
 * Every field is required in the payload and blank means "clear it", so a partial
 * form can never leave the reader wondering which of the fields they emptied
 * actually saved.
 */
export const updateStopFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: id,
      assignmentId: id,
      startTime: timeOrBlank,
      endTime: timeOrBlank,
      durationMinutes: z.number().int().min(0).max(10_080),
      notes: optionalText(2_000),
      reservationStatus: z.enum(RESERVATION_STATUSES),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly assignmentId: string }> => {
    const scope = await appScope()
    await writableTrip(scope, data.tripId)

    const updated = await updateAssignment(scope, data.assignmentId, {
      startTime: blankToNull(data.startTime),
      endTime: blankToNull(data.endTime),
      durationMinutes: data.durationMinutes === 0 ? null : data.durationMinutes,
      notes: blankToNull(data.notes),
      reservationStatus: data.reservationStatus,
    })
    return { assignmentId: updated.id }
  })

/* -------------------------------------------------------------------------------------------------
 * Editing a place
 * ---------------------------------------------------------------------------------------------- */

const placeFields = {
  name: z.string().trim().min(1).max(160),
  city: optionalText(160),
  address: optionalText(240),
  categoryId: optionalText(64),
  durationMinutes: z.number().int().min(0).max(10_080),
  /** `0` clears the rating; 1–5 sets it. */
  rating: z.number().int().min(0).max(5),
  /** Both or neither: a lone latitude is not a position. */
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
}

const coordinatePair = <T extends { lat: number | null; lng: number | null }>(
  value: T,
  ctx: z.RefinementCtx,
): void => {
  if ((value.lat === null) !== (value.lng === null)) {
    ctx.addIssue({
      code: 'custom',
      message: 'A map position needs both a latitude and a longitude',
      path: ['lat'],
    })
  }
}

/**
 * Adds a place to the trip, optionally straight onto a day.
 *
 * The quota check lives in `createPlace`, so the plan limit is enforced at the
 * repository boundary for this path exactly as it is for every other.
 */
export const createPlanPlaceFn = createServerFn({ method: 'POST' })
  .validator(
    z
      .object({ tripId: id, ...placeFields, dayId: optionalText(64) })
      .superRefine(coordinatePair),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      readonly placeId: string
      readonly assignmentId: string | null
    }> => {
      const scope = await appScope()
      const trip = await writableTrip(scope, data.tripId)

      const place = await createPlace(scope, {
        tripId: trip.id,
        name: data.name,
        city: blankToNull(data.city),
        address: blankToNull(data.address),
        categoryId: blankToNull(data.categoryId),
        durationMinutes: data.durationMinutes,
        rating: data.rating === 0 ? null : data.rating,
        lat: data.lat,
        lng: data.lng,
      })

      if (data.dayId === '') {
        return { placeId: place.id, assignmentId: null }
      }

      const ordered = await listDayAssignments(scope, data.dayId)
      const assignment = await createAssignment(scope, {
        tripId: trip.id,
        dayId: data.dayId,
        placeId: place.id,
        orderIndex: indexBetween(ordered, ordered.length),
      })
      return { placeId: place.id, assignmentId: assignment.id }
    },
  )

export const updatePlanPlaceFn = createServerFn({ method: 'POST' })
  .validator(
    z
      .object({
        tripId: id,
        placeId: id,
        ...placeFields,
        isVisited: z.boolean(),
      })
      .superRefine(coordinatePair),
  )
  .handler(async ({ data }): Promise<{ readonly placeId: string }> => {
    const scope = await appScope()
    await writableTrip(scope, data.tripId)

    const updated = await updatePlace(scope, data.placeId, {
      name: data.name,
      city: blankToNull(data.city),
      address: blankToNull(data.address),
      categoryId: blankToNull(data.categoryId),
      durationMinutes: data.durationMinutes,
      rating: data.rating === 0 ? null : data.rating,
      lat: data.lat,
      lng: data.lng,
      isVisited: data.isVisited,
    })
    return { placeId: updated.id }
  })

/**
 * Removes a place from the trip entirely.
 *
 * Its assignments go with it — `day_assignments.place_id` cascades — so this is the
 * one destructive action on the screen and the only one behind a confirmation.
 */
export const deletePlanPlaceFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, placeId: id }))
  .handler(async ({ data }): Promise<{ readonly removed: true }> => {
    const scope = await appScope()
    await writableTrip(scope, data.tripId)
    await deletePlace(scope, data.placeId)
    return { removed: true }
  })
