/**
 * The journeys, folded into the board `plan-model.ts` already builds.
 *
 * A post-pass rather than an argument, and that is the stage's central trade-off written out:
 * `-server/plan.ts` and `-ui/plan-model.ts` are claimed by sibling stages in every wave this
 * one could occupy, so the journey is threaded in *around* them. It costs nothing at runtime —
 * `planModel` walks each day's ids and skips any it cannot resolve, so a `leg:` id passes
 * through it harmlessly and is simply absent from `items` until this module puts it back.
 *
 * Every function here is pure, and the fractions they read are the server's: a journey's
 * `sort_order` is where it sits among its **departure** day's stops and notes, and the rows it
 * shows on the other days it covers are placed on the client and never stored.
 */

import {
  IDEAS_CONTAINER,
  containerOf,
  expandJourneyRows,
  ideaItemId,
  isNoteItemId,
  legItemId,
  legRefOfLegItem,
  mergeDayTimeline,
  noteIdOfNoteItem,
  noteItemId,
  removePlanItem,
} from '#/components/planner'
import {
  formatMoneyMinor,
  formatTime,
  formatTimeRange,
} from '../../../-lib/format'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'

import type { Locale } from '#/lib/i18n/locales'
import type {
  PlanOrder,
  PlannerItem,
  PlannerTransport,
  TimeOfItem,
} from '#/components/planner'
import type { PlanNotesPayload } from '../-server/day-notes'
import type { PlanBoardPayload } from '../-server/plan'
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
 * The single instant each journey row carries, by draggable id — `timeByItem`'s other half.
 *
 * Read from the payload rather than from the rendered rows for `timeByItem`'s own reason: a
 * one-day journey *renders* a range (`09:00 – 12:30`) and the clock rule compares instants. The
 * departing row is at its departure time and the arriving row at its arrival time; a row for a
 * day a journey merely crosses carries no time at all, which is exactly what keeps it from
 * lending a clock to the untimed rows below it.
 */
export function timeOfTransports(
  payload: PlanTransportsPayload,
): ReadonlyMap<string, string> {
  const byItem = new Map<string, string>()
  for (const row of payload.transports) {
    const departure = formatTime(row.departureTime)
    if (row.departureDayId !== null && departure !== null) {
      byItem.set(legItemId(row.kind, row.departureDayId, row.id), departure)
    }
    const arrival = formatTime(row.arrivalTime)
    if (
      row.arrivalDayId !== null &&
      row.arrivalDayId !== row.departureDayId &&
      arrival !== null
    ) {
      byItem.set(legItemId(row.kind, row.arrivalDayId, row.id), arrival)
    }
  }
  return byItem
}

/**
 * The stored position each stop and note sits at, by draggable id — the journey's ruler.
 *
 * A journey's `sort_order` was measured against `day_assignments.order_index` and
 * `day_notes.sort_order`, and those are `REAL`s that read `0..n-1` only straight after
 * `reorderPlanFn` renumbers a day: `schedulePlaceFn` inserts a stop at the midpoint of its
 * neighbours, a front insert takes `after − 1`, and unscheduling deletes without renumbering. A
 * day can therefore stand at `−1, 0, 0.5, 2` for as long as nobody drags it, and merging a journey
 * against a row's *ordinal* would place it by a number the server never wrote — the mistake
 * `splitGap` is documented not to make.
 *
 * Read from the payloads for {@link timeOfTransports}' reason: the rendered rows no longer carry
 * the number, and this is the same pair of columns `plan-model.ts` builds the day's sequence from.
 */
export function positionByItem(
  payload: PlanBoardPayload,
  notes: PlanNotesPayload,
): ReadonlyMap<string, number> {
  const byItem = new Map<string, number>()
  for (const day of payload.days) {
    for (const stop of day.stops) byItem.set(stop.assignmentId, stop.position)
  }
  for (const note of notes.notes) {
    byItem.set(noteItemId(note.id), note.sortOrder)
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
 * The arrangement with every journey threaded into the day it is drawn on.
 *
 * `positions` is {@link positionByItem}: the day is re-merged on the one number line the server
 * writes, so a journey's stored `sort_order` is compared with the very values its gap was split
 * between. An id the payloads did not produce cannot reach here — every id in a day comes from
 * those two tables — and falls back to its ordinal only so the lookup is total.
 *
 * Re-merging a merged day is a fixed point (`mergeDayTimeline` is idempotent and stable), which is
 * what lets the journeys be dropped in beside the day's own rows and the whole day re-sorted once,
 * without the caller having to know which rule placed which row.
 *
 * A tie puts the journey after the row it ties with, because `mergeDayTimeline`'s sort is stable
 * and the day's own rows are listed first. That is the resting state of every journey on disk
 * today: `sort_order` defaults to `0`, and a journey nobody has dragged yet sits behind the stop
 * that opens its day rather than in front of it.
 */
export function withTransports(
  order: PlanOrder,
  rows: ReadonlyArray<PlannerTransport>,
  positions: ReadonlyMap<string, number>,
  timeOfItem: TimeOfItem = () => null,
): PlanOrder {
  if (rows.length === 0) return order

  const byDay = new Map<string, Array<PlannerTransport>>()
  for (const row of rows) {
    const day = byDay.get(row.dayId)
    if (day === undefined) byDay.set(row.dayId, [row])
    else day.push(row)
  }

  return {
    ...order,
    days: order.days.map((day) => {
      const journeys = byDay.get(day.dayId)
      if (journeys === undefined) return day

      const merged = mergeDayTimeline([
        ...day.itemIds.map((id, index) => ({
          id,
          position: positions.get(id) ?? index,
          time: timeOfItem(id),
        })),
        ...journeys.map((transport) => {
          const time = timeOfItem(transport.itemId)
          return {
            id: transport.itemId,
            position: placementOf(transport, time),
            time,
          }
        }),
      ])

      return { dayId: day.dayId, itemIds: merged.map((item) => item.id) }
    }),
  }
}

/** The draggable id an already-built item is known by. */
function idOfItem(item: PlannerItem): string {
  if (item.kind === 'stop') return item.row.itemId
  if (item.kind === 'transport') return item.transport.itemId
  return noteItemId(item.note.id)
}

/**
 * The model with the journey variants put back into each day's sequence.
 *
 * Two map lookups per row and no second ordering rule: the order is whatever
 * {@link withTransports} produced, and each id resolves either to a journey or to the item
 * `planModel` already built for it. `rows` is left alone — the map's route line is drawn from
 * stops, and a journey is not a place.
 */
export function withTransportItems(
  model: PlanModel,
  order: PlanOrder,
  rows: ReadonlyArray<PlannerTransport>,
): PlanModel {
  if (rows.length === 0) return model

  const byItem = new Map(rows.map((row) => [row.itemId, row]))
  const idsByDay = new Map(order.days.map((day) => [day.dayId, day.itemIds]))

  return {
    ...model,
    days: model.days.map((day) => {
      const itemIds = idsByDay.get(day.dayId)
      if (itemIds === undefined) return day

      const built = new Map(day.items.map((item) => [idOfItem(item), item]))
      const items: Array<PlannerItem> = []
      for (const itemId of itemIds) {
        const transport = byItem.get(itemId)
        if (transport !== undefined) {
          items.push({ kind: 'transport', transport })
          continue
        }
        const item = built.get(itemId)
        if (item !== undefined) items.push(item)
      }
      return { ...day, items }
    }),
  }
}

/** One row of a day's run, in the four id spaces `reorderDayTransports` validates. */
interface DayRunRef {
  readonly kind: 'stop' | 'note' | 'transport' | 'leg'
  readonly id: string
}

/** One day's run, as `reorderDayTransportsFn` takes it. */
export interface JourneyWrite {
  readonly dayId: string
  readonly items: ReadonlyArray<DayRunRef>
}

/**
 * The follow-up writes a change to these days needs, and no others.
 *
 * A journey is written only by a reorder of the day it *departs* from. Restating it from any
 * other day it covers would overwrite a number measured against one day's stops with one
 * measured against another's, and each day's restatement would then undo the other's.
 *
 * The run carries the day exactly as the board now reads it — stops, notes and the journeys
 * departing from it — and the server takes from it only which row each journey follows; the
 * fractions themselves are derived from the day as stored. The rows a journey shows on days it
 * merely crosses are dropped, because they are placed on the client and have nothing to write.
 */
export function journeyWrites(
  order: PlanOrder,
  dayIds: ReadonlyArray<string>,
  rows: ReadonlyArray<PlannerTransport>,
): Array<JourneyWrite> {
  const departing = new Set(
    rows.filter((row) => row.part === 'departing').map((row) => row.itemId),
  )
  if (departing.size === 0) return []

  const writes: Array<JourneyWrite> = []
  for (const dayId of new Set(dayIds)) {
    const day = order.days.find((entry) => entry.dayId === dayId)
    if (day === undefined) continue
    if (!day.itemIds.some((itemId) => departing.has(itemId))) continue

    const items = day.itemIds.flatMap((itemId): Array<DayRunRef> => {
      const leg = legRefOfLegItem(itemId)
      if (leg !== null) {
        return departing.has(itemId) ? [{ kind: leg.kind, id: leg.id }] : []
      }
      return [refOf(itemId)]
    })
    writes.push({ dayId, items })
  }
  return writes
}

/**
 * A write the board has just landed, as far as the journeys beside it care.
 *
 * `before` is the board the write was made against and `next` the board it leaves behind. A
 * delete carries no `next`: its board is `before` with the stop taken out.
 */
export type JourneyRestatement =
  | {
      readonly kind: 'reorder'
      readonly next: PlanOrder
      readonly dayIds: ReadonlyArray<string>
    }
  | {
      readonly kind: 'schedule'
      readonly next: PlanOrder
      readonly placeId: string
      readonly assignmentId: string
      readonly dayId: string
    }
  | {
      readonly kind: 'unschedule'
      readonly before: PlanOrder
      readonly next: PlanOrder
      readonly itemId: string
    }
  | {
      readonly kind: 'delete'
      readonly before: PlanOrder
      readonly itemId: string
    }

/**
 * The journey writes one landed write owes, which is {@link journeyWrites} asked about the right
 * board and the right days.
 *
 * - A reorder restates every day it touched, against the board it produced.
 * - A schedule restates the day it lands on — but its board still calls the new stop by its
 *   `idea:` id, which the run would drop as a row the day does not hold, so the stop is renamed to
 *   the assignment the write actually created first.
 * - An unschedule and a delete restate the day the stop *left*, which only the board before the
 *   write can name; the ideas column holds no journeys, so a stop taken from there owes nothing.
 */
export function journeyWritesFor(
  change: JourneyRestatement,
  rows: ReadonlyArray<PlannerTransport>,
): Array<JourneyWrite> {
  switch (change.kind) {
    case 'reorder':
      return journeyWrites(change.next, change.dayIds, rows)
    case 'schedule':
      return journeyWrites(
        renameItem(
          change.next,
          ideaItemId(change.placeId),
          change.assignmentId,
        ),
        [change.dayId],
        rows,
      )
    case 'unschedule':
      return journeyWrites(
        change.next,
        dayOfItem(change.before, change.itemId),
        rows,
      )
    case 'delete':
      return journeyWrites(
        removePlanItem(change.before, change.itemId),
        dayOfItem(change.before, change.itemId),
        rows,
      )
  }
}

/** The day holding an item — or none when it sits in the ideas column. */
function dayOfItem(order: PlanOrder, itemId: string): Array<string> {
  const container = containerOf(order, itemId)
  return container === null || container === IDEAS_CONTAINER ? [] : [container]
}

/** The same arrangement with one draggable id renamed. */
function renameItem(order: PlanOrder, from: string, to: string): PlanOrder {
  return {
    ideaIds: order.ideaIds,
    days: order.days.map((day) => ({
      dayId: day.dayId,
      itemIds: day.itemIds.map((itemId) => (itemId === from ? to : itemId)),
    })),
  }
}

/** A stop or a note, as the run names it. */
function refOf(itemId: string): { kind: 'stop' | 'note'; id: string } {
  return isNoteItemId(itemId)
    ? { kind: 'note', id: noteIdOfNoteItem(itemId) }
    : { kind: 'stop', id: itemId }
}
