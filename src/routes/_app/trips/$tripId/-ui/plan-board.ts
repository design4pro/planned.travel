/**
 * The Plan board, read: one Day, in order, from the three payloads the route loads.
 *
 * The one module that answers "what does Day 2 read?" — its Stops, day notes, Transport and Leg
 * rows, in the order a reader sees them, and the item lookups the move policy asks about (time).
 * A day is one number line holding every kind of item (PRD #104 decision 9), so it is merged
 * **once**, from one position source and one time source: a stop's `order_index`, a note's
 * `sort_order` and a journey's `sort_order` are compared exactly as the server wrote them.
 * A new kind of Day item is a new arm in {@link timelineOf} and nothing else.
 *
 * Every function here is pure. The write half of the journeys — what a landed write owes the
 * server — is `plan-transport-model.ts`.
 */

import {
  expandJourneyRows,
  ideaItemId,
  legItemId,
  mergeDayTimeline,
  noteItemId,
} from '#/components/planner'
import {
  formatMoneyMinor,
  formatTime,
  formatTimeRange,
} from '../../../-lib/format'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { planModel } from './plan-model'

import type { Locale } from '#/lib/i18n/locales'
import type { Translate } from '#/lib/i18n'
import type {
  PlanOrder,
  PlannerNote,
  PlannerTransport,
  TimeOfItem,
} from '#/components/planner'
import type { PlanNotesPayload } from '../-server/day-notes'
import type { PlanBoardDay, PlanBoardPayload } from '../-server/plan'
import type {
  PlanTransport,
  PlanTransportsPayload,
} from '../-server/plan-transports'
import type { PlanModel } from './plan-model'

/**
 * Every journey row the board can draw, one per day each journey covers.
 *
 * The three clock strings are produced here because this is the only place that owns a locale:
 * a multi-day journey shows one end on each of its two ends, and a one-day journey shows the
 * range, so all three are formatted once and `src/components/planner/**` stays locale-free.
 */
export function transportRowsOf(
  payload: PlanTransportsPayload,
  dayIds: ReadonlyArray<string>,
  locale: Locale = DEFAULT_LOCALE,
): Array<PlannerTransport> {
  return payload.transports.flatMap((row) =>
    expandJourneyRows(
      {
        kind: row.kind,
        id: row.id,
        departureDayId: row.departureDayId,
        arrivalDayId: row.arrivalDayId,
        mode: row.mode,
        status: row.status,
        serviceNumber: row.serviceNumber,
        fromName: row.fromName,
        toName: row.toName,
        departureLabel: formatTime(row.departureTime),
        arrivalLabel: formatTime(row.arrivalTime),
        rangeLabel: rangeOf(row, locale),
        price: priceOf(row, locale),
        position: row.position,
      },
      dayIds,
    ),
  )
}

/**
 * What a journey drawn on one day shows on its clock.
 *
 * The range, unless the range would run backwards. A journey whose arrival clock is not after
 * its departure clock lands on a day this board does not draw it on — the overnight flight into
 * a trip's first day is the ordinary case — and `13:20 – 09:35` reads as a journey that ends
 * before it starts. The departure alone is the end of it this day actually sees.
 */
function rangeOf(row: PlanTransport, locale: Locale): string | null {
  const departure = formatTime(row.departureTime)
  const arrival = formatTime(row.arrivalTime)
  if (departure !== null && arrival !== null && arrival <= departure) {
    return departure
  }
  return formatTimeRange(row.departureTime, row.arrivalTime, locale)
}

/** A fare is a fare only when both halves of it are on the row. */
function priceOf(row: PlanTransport, locale: Locale): string | null {
  if (row.priceMinor === null || row.currency === null) return null
  return formatMoneyMinor(row.priceMinor, row.currency, locale)
}

/**
 * Every note the board can show, keyed by its **draggable** id.
 *
 * By item id rather than by day because after the merge a day is a list of ids and
 * nothing else: resolving one costs a lookup, and grouping by day would only rebuild
 * the second projection of the notes that `PlannerDay.items` exists to replace.
 */
function notesOf(payload: PlanNotesPayload): Map<string, PlannerNote> {
  const byItem = new Map<string, PlannerNote>()
  for (const note of payload.notes) {
    byItem.set(noteItemId(note.id), {
      id: note.id,
      dayId: note.dayId,
      body: note.body,
      detail: note.detail,
      time: formatTime(note.time),
      icon: note.icon,
    })
  }
  return byItem
}

/**
 * The `HH:MM` each item carries, by draggable id — `movePlanItem`'s `timeOfItem`, and the clock
 * the merge orders by.
 *
 * Read from the payloads rather than from the view models because a row's rendered time can be
 * a *range* (`10:00 – 12:00`) and the clock rule compares single instants. A stop is at its start
 * time; a journey's departing row is at its departure and its arriving row at its arrival; a row
 * for a day a journey merely crosses carries none, which is what keeps it from lending a clock to
 * the untimed rows below it. An item with no time is simply absent.
 */
function timesOf(
  payload: PlanBoardPayload,
  notes: PlanNotesPayload,
  transports: PlanTransportsPayload,
): Map<string, string> {
  const byItem = new Map<string, string>()
  const put = (itemId: string, time: string | null) => {
    if (time !== null) byItem.set(itemId, time)
  }

  for (const day of payload.days) {
    for (const stop of day.stops)
      put(stop.assignmentId, formatTime(stop.startTime))
  }
  for (const note of notes.notes)
    put(noteItemId(note.id), formatTime(note.time))
  for (const row of transports.transports) {
    if (row.departureDayId !== null) {
      put(
        legItemId(row.kind, row.departureDayId, row.id),
        formatTime(row.departureTime),
      )
    }
    if (row.arrivalDayId !== null && row.arrivalDayId !== row.departureDayId) {
      put(
        legItemId(row.kind, row.arrivalDayId, row.id),
        formatTime(row.arrivalTime),
      )
    }
  }
  return byItem
}

/**
 * Where a journey row sits on the day it is drawn on.
 *
 * Only the `departing` row has a stored answer, because only it has a ruler: a journey has one
 * `sort_order` and it is measured against its departure day's stops and notes. The other two are
 * placed here and never written — a `travelling` row ahead of everything on the day, where it
 * inherits no clock and lends none; an `arriving` row behind everything, where the merge then
 * places it by its own arrival time; and an `arriving` row with no time ahead, like a
 * `travelling` one, because there is nothing to place it by.
 */
function placementOf(transport: PlannerTransport, time: string | null): number {
  if (transport.part === 'departing') return transport.position
  return transport.part === 'arriving' && time !== null
    ? Number.POSITIVE_INFINITY
    : Number.NEGATIVE_INFINITY
}

/**
 * One day's items as the merge reads them: an id, a stored position, a time.
 *
 * The stop's position is `day_assignments.order_index`, the note's is `day_notes.sort_order` and a
 * journey's is `transports.sort_order` — one number line across three columns, all compared as the
 * server wrote them. A stored position is a `REAL` that reads `0..n-1` only straight after
 * `reorderPlanFn` renumbers a day; `schedulePlaceFn` inserts at a midpoint, a front insert takes
 * `after − 1` and unscheduling deletes without renumbering, so ordinals would place a journey by a
 * number the server never wrote.
 *
 * A tie puts the journey after the row it ties with, because the merge's sort is stable and the
 * day's own rows are listed first. That is the resting state of every journey on disk: `sort_order`
 * defaults to `0`, and a journey nobody has dragged sits behind the stop that opens its day.
 */
function timelineOf(
  day: PlanBoardDay,
  notes: PlanNotesPayload,
  journeys: ReadonlyArray<PlannerTransport>,
  times: ReadonlyMap<string, string>,
): Array<{ id: string; position: number; time: string | null }> {
  const timeOf = (id: string) => times.get(id) ?? null
  return [
    ...day.stops.map((stop) => ({
      id: stop.assignmentId,
      position: stop.position,
      time: timeOf(stop.assignmentId),
    })),
    ...notes.notes
      .filter((note) => note.dayId === day.dayId)
      .map((note) => ({
        id: noteItemId(note.id),
        position: note.sortOrder,
        time: timeOf(noteItemId(note.id)),
      })),
    ...journeys.map((transport) => {
      const time = timeOf(transport.itemId)
      return {
        id: transport.itemId,
        position: placementOf(transport, time),
        time,
      }
    }),
  ]
}

/** The board a reader is looking at, before and while a write is in the air. */
export interface PlanBoard {
  /** The server's own arrangement — every Day merged once, journeys included. */
  readonly serverOrder: PlanOrder
  /** Every journey row the board can draw, one per day each journey covers. */
  readonly transportRows: ReadonlyArray<PlannerTransport>
  /** Journeys by draggable id. */
  readonly journeysByItem: ReadonlyMap<string, PlannerTransport>
  /** Every note the board can show, by draggable id. */
  readonly notesByItem: ReadonlyMap<string, PlannerNote>
  /** The instant an item carries, for the clock rule. */
  readonly timeOfItem: TimeOfItem
  /** The view model for any arrangement — the server's, or an optimistic one. */
  readonly model: (order: PlanOrder, t: Translate) => PlanModel
}

/**
 * The three payloads, read once.
 *
 * `serverOrder` is what the loader says; `model` materialises any arrangement (an in-flight drag
 * included) into the Days the rails draw. Neither the order in which they are built nor which
 * payload owns which rule is the caller's business.
 */
export function planBoard(
  payload: PlanBoardPayload,
  notes: PlanNotesPayload,
  transports: PlanTransportsPayload,
  locale: Locale = DEFAULT_LOCALE,
): PlanBoard {
  const dayIds = payload.days.map((day) => day.dayId)
  const transportRows = transportRowsOf(transports, dayIds, locale)
  const notesByItem = notesOf(notes)
  const times = timesOf(payload, notes, transports)
  const journeysByItem = new Map(transportRows.map((row) => [row.itemId, row]))

  const journeysByDay = new Map<string, Array<PlannerTransport>>()
  for (const row of transportRows) {
    const day = journeysByDay.get(row.dayId)
    if (day === undefined) journeysByDay.set(row.dayId, [row])
    else day.push(row)
  }

  const serverOrder: PlanOrder = {
    days: payload.days.map((day) => ({
      dayId: day.dayId,
      itemIds: mergeDayTimeline(
        timelineOf(day, notes, journeysByDay.get(day.dayId) ?? [], times),
      ).map((item) => item.id),
    })),
    ideaIds: payload.unscheduledIds.map((placeId) => ideaItemId(placeId)),
  }

  return {
    serverOrder,
    transportRows,
    journeysByItem,
    notesByItem,
    timeOfItem: (itemId) => times.get(itemId) ?? null,
    model: (order, t) =>
      planModel(payload, order, t, locale, notesByItem, journeysByItem),
  }
}
