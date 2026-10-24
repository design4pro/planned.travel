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
 * Every write is one repository call behind a Zod boundary and the guards that
 * decide whether this caller may make it on this trip, and the arrangement
 * writes touch only the columns that say where a row sits: `day_assignments.day_id`
 * and `order_index`, and — since the day became one sequence rather than two lists
 * (PRD #104 decision 9) — `day_notes.sort_order` beside them, as one number line.
 * Nothing here writes `days.day_number`, which is what keeps the trip's contiguous
 * `1..n` day run — owned solely by `syncTripDays` — safe from a drag.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { enqueueTripRollup } from '#/server/queue/travel-stats-fanout'
import { RESERVATION_STATUSES } from '#/server/db/schema'
import {
  DAY_RUN_ANCHORS_MESSAGE,
  DAY_RUN_MAX_ITEMS,
  NotFoundError,
  TRIP_WRITE_ROLES,
  assertTripRole,
  canWritePlan,
  createAssignment,
  createPlace,
  dayRunInput,
  dayRunItemInput,
  deletePlaceWithJourneys,
  getPlace,
  getTripItinerary,
  listCategories,
  listDayAssignments,
  listTripAssignments,
  listTripPlaces,
  listUnscheduledPlaces,
  reorderDayTimelines,
  reorderPlaces,
  requireTrip,
  requireTripDay,
  requireWritableTrip,
  tripRoleFor,
  scheduleAssignment,
  unscheduleAssignment,
  updateAssignment,
  updatePlace,
  withinAnchorBound,
} from '#/server/repos'
import { orAbsent } from '#/server/fns/-lib/absence'
import { appScope } from '../../../-server/context'

import type {
  DayRunItemInput,
  TenantScope,
  TimelineItemInput,
  WrittenDayJourneys,
} from '#/server/repos'
import type { OrAbsent } from '#/lib/absence'
import type { Place, Trip } from '#/server/db/types'
import type { BookingDayOption } from '#/server/fns/reservations'

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
  /**
   * `day_assignments.order_index`, as stored.
   *
   * Published rather than reconstructed from array index because the day is one
   * number line shared with `day_notes.sort_order`, and the two tables are numbered
   * independently until the day's first merged reorder — `nextOrderIndex` knows
   * nothing about the note run's `sortOrder()` default. An index would therefore be
   * a different quantity from the note's position, and merging the two would render
   * an order the loader contradicts on the next invalidate.
   */
  readonly position: number
  readonly startTime: string | null
  readonly endTime: string | null
  readonly durationMinutes: number | null
  readonly reservationStatus: PlanReservationStatus
  readonly notes: string | null
}

/**
 * One stay covering a day: its nights, its times and the booking it was made under.
 *
 * The same record under every day it covers, as `getTripItinerary` already files it. Only what a
 * day header draws — the price, the address and the confirmation stay on the booking desk.
 */
export interface PlanBoardStay {
  readonly id: string
  readonly name: string
  readonly startDayId: string
  readonly endDayId: string
  /** `HH:MM`, as stored. */
  readonly checkInTime: string | null
  readonly checkInEndTime: string | null
  readonly checkOutTime: string | null
  readonly reservationId: string | null
}

export interface PlanBoardDay {
  readonly dayId: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
  readonly stops: ReadonlyArray<PlanBoardStop>
  /** The stays covering this day. */
  readonly stays: ReadonlyArray<PlanBoardStay>
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
  /**
   * The acting user may write the plan: owner or editor, and the trip is not
   * archived. Every write control the board draws is gated on this.
   */
  readonly editable: boolean
  /**
   * The trip is archived.
   *
   * Carried beside `editable` rather than folded into it, because "the trip is
   * over" and "you may not write" are two different reasons for the same missing
   * control, and a surface that explains itself has to know which one it is.
   */
  readonly archived: boolean
  readonly days: ReadonlyArray<PlanBoardDay>
  /** The whole inventory, in board order. Both rails and the map read from here. */
  readonly places: ReadonlyArray<PlanBoardPlace>
  /** Ids of places with no day yet, in board order. */
  readonly unscheduledIds: ReadonlyArray<string>
  readonly categories: ReadonlyArray<PlanBoardCategory>
  /** The trip's currency, which the stay dialog prices a new booking in. */
  readonly currency: string
  /**
   * The days as the booking dialog takes them, stop names included.
   *
   * A second projection of {@link days} on purpose: the board's stops point at places by id, and
   * the dialog's stop picker renders names. Built from the same itinerary read, so opening the
   * dialog from a day costs no second fetch of the booking desk.
   */
  readonly bookingDays: ReadonlyArray<BookingDayOption>
}

export const loadPlanBoard = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<OrAbsent<PlanBoardPayload>> => {
    const scope = await appScope()
    return orAbsent(data.tripId, () => readPlanBoard(scope, data.tripId))
  })

/**
 * The board, as the acting user may use it.
 *
 * A plain function beside the server-function shell, because outside a Start
 * build a handler's return value is discarded — the same split `readDayNotes`
 * records. The role is read beside the board rather than asserted: a viewer is
 * owed the plan, just not its write controls (PRD #104 decision 6).
 */
export async function readPlanBoard(
  scope: TenantScope,
  tripId: string,
): Promise<PlanBoardPayload> {
  const trip = await requireTrip(scope, tripId)

  const [role, itinerary, inventory, unscheduled, categories] =
    await Promise.all([
      tripRoleFor(scope, trip.id, scope.ctx.userId),
      getTripItinerary(scope, trip.id),
      listTripPlaces(scope, { tripId: trip.id }),
      listUnscheduledPlaces(scope, trip.id),
      listCategories(scope),
    ])

  return {
    tripId: trip.id,
    editable: canWritePlan(trip, role),
    archived: trip.isArchived,
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
      stays: entry.accommodations.map((stay) => ({
        id: stay.id,
        name: stay.name,
        startDayId: stay.startDayId,
        endDayId: stay.endDayId,
        checkInTime: stay.checkInTime,
        checkInEndTime: stay.checkInEndTime,
        checkOutTime: stay.checkOutTime,
        reservationId: stay.reservationId,
      })),
      stops: entry.stops.map((stop) => ({
        assignmentId: stop.assignment.id,
        placeId: stop.place.id,
        position: stop.assignment.orderIndex,
        startTime: stop.assignment.startTime,
        endTime: stop.assignment.endTime,
        durationMinutes: stop.assignment.durationMinutes,
        reservationStatus: asReservationStatus(
          stop.assignment.reservationStatus,
        ),
        notes: stop.assignment.notes,
      })),
    })),
    currency: trip.currency,
    bookingDays: itinerary.map(({ day, stops }) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date,
      title: day.title,
      stops: stops.map((stop) => ({
        assignmentId: stop.assignment.id,
        placeName: stop.place.name,
        startTime: stop.assignment.startTime,
      })),
    })),
  }
}

/* -------------------------------------------------------------------------------------------------
 * Guard
 * ---------------------------------------------------------------------------------------------- */

/**
 * The two questions every plan write asks, in the only order that answers them
 * safely: may this trip still be written, then may this caller write it.
 *
 * The archive first, because `requireWritableTrip` also asks whether the caller
 * may see the trip at all, and a caller who may not learns `NotFoundError` and
 * nothing else; the role only after that. Place repository writers also enforce
 * the shared owner/editor role list, so callers outside this handler cannot bypass
 * it. This handler keeps the archive check before the role check (PRD #104
 * decision 6). The same composition `writableTripDay` records for notes.
 */
async function requireEditablePlan(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  const trip = await requireWritableTrip(scope, tripId)
  await assertTripRole(scope, trip.id, TRIP_WRITE_ROLES)
  return trip
}

/**
 * A place of the trip {@link requireEditablePlan} checked, or `NotFoundError`.
 *
 * The client's `tripId` names the plan being edited; the place is addressed by
 * its own id. Repository writers check the place's actual trip role, while this
 * check also binds the row to the requested plan, even if the caller edits both
 * trips. Not-found rather than forbidden keeps a mismatched id from disclosing
 * another trip's contents.
 */
async function requirePlaceOfPlan(
  scope: TenantScope,
  trip: Trip,
  placeId: string,
): Promise<Place> {
  const place = await getPlace(scope, placeId)
  if (place === null || place.tripId !== trip.id) {
    throw new NotFoundError('place', placeId)
  }
  return place
}

/**
 * A stop of the checked trip, or `NotFoundError` — {@link requirePlaceOfPlan}, for a stop.
 *
 * Read through the trip's stop list, which the repositories already export, rather
 * than a new single-row getter that would be a repository surface of its own.
 */
async function requireStopOfPlan(
  scope: TenantScope,
  trip: Trip,
  assignmentId: string,
): Promise<void> {
  const stops = await listTripAssignments(scope, trip.id)
  if (!stops.some((stop) => stop.id === assignmentId)) {
    throw new NotFoundError('day assignment', assignmentId)
  }
}

/* -------------------------------------------------------------------------------------------------
 * Reordering
 * ---------------------------------------------------------------------------------------------- */

/**
 * Tells the trip room that these days were rearranged: one `day` upsert each,
 * carrying the merged order and the journeys placed beside it.
 *
 * The journeys travel under their own field, the one {@link mirrorDayJourneys} also writes for the
 * writes that renumber nothing, so a patch from either leaves the other field as it was.
 *
 * The bridge is reached at call time rather than imported at the top of the file,
 * and that is not stylistic. `#/server/fns/context` imports `cloudflare:workers` and
 * the trip room's Durable Object module, and this file is imported by the planner
 * route — so a static import puts both into that route's module graph. It is the
 * posture `_app/-server/shell.ts` and `_app/-server/trip-lifecycle.ts` each record
 * for the same reason, in the same words: reach the binding inside the function.
 *
 * Nothing here catches, because there is nothing to catch: D1 is the record and the
 * room is a signal, so `mirrorToRoom` logs a refusal and returns.
 */
async function mirrorDayOrder(
  scope: TenantScope,
  tripId: string,
  days: ReadonlyArray<{
    readonly dayId: string
    readonly items: ReadonlyArray<TimelineItemInput>
    readonly journeys: ReadonlyArray<DayRunItemInput>
  }>,
): Promise<void> {
  const { mirrorToRoom, patch } = await import('#/server/fns/context')
  await mirrorToRoom(
    scope,
    tripId,
    days.map((day) =>
      patch('day', day.dayId, {
        items: day.items.map((item) => ({ kind: item.kind, id: item.id })),
        journeys: day.journeys.map((ref) => ({ kind: ref.kind, id: ref.id })),
      }),
    ),
  )
}

/**
 * Tells the trip room where the journeys of these days now sit.
 *
 * Under its own field, because this is the news of a write that renumbers nothing (schedule,
 * unschedule, delete): it carries the journeys alone and must not overwrite the `items` that
 * {@link mirrorDayOrder} sends beside its own `journeys` when it renumbers a day. A day that placed
 * no journey is not mirrored, and a write that placed none sends nothing. Reached at call time for
 * the reason {@link mirrorDayOrder} records.
 */
async function mirrorDayJourneys(
  scope: TenantScope,
  tripId: string,
  days: ReadonlyArray<WrittenDayJourneys>,
): Promise<void> {
  if (days.length === 0) return
  const { mirrorToRoom, patch } = await import('#/server/fns/context')
  await mirrorToRoom(
    scope,
    tripId,
    days.map((day) =>
      patch('day', day.dayId, {
        journeys: day.journeys.map((ref) => ({ kind: ref.kind, id: ref.id })),
      }),
    ),
  )
}

/** A stop or a note, as the browser names it: the rows `clearTime` can name. */
const timelineItem = z.strictObject(
  { kind: z.enum(['stop', 'note']), id },
  { error: 'A timeline item is a stop or a note, named by its id.' },
)

/** `kind/id` — the pair is the identity, because the id spaces are minted the same way. */
function timelineKey(item: {
  readonly kind: string
  readonly id: string
}): string {
  return `${item.kind}/${item.id}`
}

/**
 * The board's new arrangement: for each day a drag touched, the whole sequence.
 *
 * `items` is the day's whole run: its stops and notes and, since a journey is placed in the same
 * write that renumbers them (#239), the journeys that depart from it. A client that names no
 * journey is still served — each is put back where it was — so the field only ever gained values.
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
          items: z
            .array(dayRunItemInput)
            .max(DAY_RUN_MAX_ITEMS)
            .refine(withinAnchorBound, { error: DAY_RUN_ANCHORS_MESSAGE }),
          clearTime: z.array(timelineItem).max(200).optional(),
        })
        .superRefine((day, ctx) => {
          const moving = new Set(day.items.map(timelineKey))
          for (const item of day.clearTime ?? []) {
            if (moving.has(timelineKey(item))) continue
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
 * the next drag renumbers the day to `0..n-1` across the position columns of the stops, the notes and the journeys at once.
 * It also means a client cannot inject an index of its own choosing, only a
 * permutation of ids it can already see.
 *
 * Ids that do not belong to this trip are dropped rather than rejected: the
 * repository layer would refuse them anyway, and a stale tab whose board is one
 * delete behind should still be able to reorder the rows that do exist.
 *
 * One write: `reorderDayTimelines` takes every touched day and, in one batch, gives each
 * row the day it was named under next to its position — `day_assignments.order_index`
 * and `day_notes.sort_order` as a single number line — plus a `NULL` time for every
 * `clearTime` entry, and places the day's journeys (`transports.sort_order`,
 * `transport_legs.sort_order`) against the numbering that same batch produces. A stop
 * or a note that changed day is therefore moved by the same statement that numbers it,
 * and the reader's "drop its time and move it" is one transaction, never a moment in which the row has a time and the wrong position. A
 * forged day id fails before any position is written.
 *
 * The plan's content is the editor's (PRD #104 decision 6): the repository asserts the
 * role itself, after the trip and before any day.
 *
 * The result is mirrored to the trip room as one `day` upsert per touched day, so
 * every other viewer's board catches up without polling — see {@link mirrorDayOrder},
 * which also holds why that module is reached at call time.
 */
export const reorderPlanFn = createServerFn({ method: 'POST' })
  .validator(reorderPlanInputSchema)
  .handler(async ({ data }): Promise<{ readonly moved: number }> => {
    const scope = await appScope()
    const trip = await requireWritableTrip(scope, data.tripId)

    const rearranged = await reorderDayTimelines(scope, {
      tripId: trip.id,
      days: data.days,
    })

    await mirrorDayOrder(scope, trip.id, rearranged)

    return {
      moved: rearranged.reduce((total, day) => total + day.items.length, 0),
    }
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

/**
 * What a schedule takes: where the place was dropped and, optionally, the day's resulting run.
 *
 * `items` names the new stop by its **place id**, because its assignment id does not exist until
 * the write mints it; a client that sends none leaves each journey where it already sits. Bounded
 * as a reorder's day is.
 */
export const schedulePlaceInputSchema = z.object({
  tripId: id,
  placeId: id,
  dayId: id,
  index: z.number().int().min(0).max(500),
  items: dayRunInput.optional(),
})

/**
 * Gives an unscheduled place a day, at the position it was dropped.
 *
 * The stop and the day's journeys are one write (`scheduleAssignment`): the journeys are placed
 * against the day with the new stop in it, in the same transaction, so there is no second call to
 * fail. The room hears the journeys of the day, as {@link mirrorDayJourneys} says.
 */
export const schedulePlaceFn = createServerFn({ method: 'POST' })
  .validator(schedulePlaceInputSchema)
  .handler(async ({ data }): Promise<{ readonly assignmentId: string }> => {
    const scope = await appScope()
    const trip = await requireEditablePlan(scope, data.tripId)

    const ordered = await listDayAssignments(scope, data.dayId)
    const scheduled = await scheduleAssignment(scope, {
      tripId: trip.id,
      dayId: data.dayId,
      placeId: data.placeId,
      orderIndex: indexBetween(ordered, data.index),
      items: data.items,
    })
    await mirrorDayJourneys(scope, trip.id, scheduled.days)

    return { assignmentId: scheduled.assignmentId }
  })

/**
 * Takes a stop off its day. The place stays in the trip's inventory.
 *
 * The delete and the day's journeys are one write (`unscheduleAssignment`), and the stop must be
 * one of this trip's: any other id is not found.
 */
export const unschedulePlaceFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, assignmentId: id }))
  .handler(async ({ data }): Promise<{ readonly removed: true }> => {
    const scope = await appScope()
    const trip = await requireEditablePlan(scope, data.tripId)
    const written = await unscheduleAssignment(scope, {
      tripId: trip.id,
      assignmentId: data.assignmentId,
    })
    await mirrorDayJourneys(scope, trip.id, written)
    return { removed: true }
  })

/**
 * Re-ranks the ideas column, which is `places.sort_order` and nothing else.
 *
 * Ids of another trip are dropped, as {@link reorderPlanFn} drops them: `reorderPlaces`
 * scopes to the workspace only, so the trip the role was checked on is the filter.
 */
export const rankIdeasFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, placeIds: z.array(id).min(1).max(500) }))
  .handler(async ({ data }): Promise<{ readonly ranked: number }> => {
    const scope = await appScope()
    const trip = await requireEditablePlan(scope, data.tripId)
    const own = new Set(
      (await listTripPlaces(scope, { tripId: trip.id })).map(
        (place) => place.id,
      ),
    )
    const moves = data.placeIds
      .map((placeId, index) => ({ placeId, sortOrder: index }))
      .filter((move) => own.has(move.placeId))
    if (moves.length === 0) {
      return { ranked: 0 }
    }
    const ranked = await reorderPlaces(scope, moves)
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
    const trip = await requireEditablePlan(scope, data.tripId)
    await requireStopOfPlan(scope, trip, data.assignmentId)

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
      const trip = await requireEditablePlan(scope, data.tripId)
      // The day is checked before the place is written, so a refused add leaves nothing behind.
      if (data.dayId !== '') {
        await requireTripDay(scope, trip.id, data.dayId)
      }

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

      await enqueueTripRollup(scope, trip)

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
    const trip = await requireEditablePlan(scope, data.tripId)
    const previous = await requirePlaceOfPlan(scope, trip, data.placeId)

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
    if (previous.city !== updated.city) await enqueueTripRollup(scope, trip)
    return { placeId: updated.id }
  })

/**
 * Removes a place from the trip entirely.
 *
 * Its assignments go with it — `day_assignments.place_id` cascades — so this is the
 * one destructive action on the screen and the only one behind a confirmation. The delete and
 * the journeys of every day the place was on are one write (`deletePlaceWithJourneys`), and the
 * place must be one of this trip's: any other id is not found.
 */
export const deletePlanPlaceFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, placeId: id }))
  .handler(async ({ data }): Promise<{ readonly removed: true }> => {
    const scope = await appScope()
    const trip = await requireEditablePlan(scope, data.tripId)
    const written = await deletePlaceWithJourneys(scope, {
      tripId: trip.id,
      placeId: data.placeId,
    })
    await mirrorDayJourneys(scope, trip.id, written)
    await enqueueTripRollup(scope, trip)
    return { removed: true }
  })
