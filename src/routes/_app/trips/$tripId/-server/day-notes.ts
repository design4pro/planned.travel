/**
 * A day note's reads and writes.
 *
 * Its own module rather than a section of `-server/plan.ts`, because that file belongs to another
 * stage of this wave and a note is a whole surface: a read the planner's loader awaits beside the
 * board, and four writes the editor drives.
 *
 * Two things are worth knowing before reading further.
 *
 * **The day is one number line, and this module does not write it.** Since `01-S4a`,
 * `day_assignments.order_index` and `day_notes.sort_order` are two halves of one sequence per day,
 * owned by `reorderDayTimelines`. Moving a note is therefore expressed as the whole day's sequence
 * with the note slots refilled — {@link noteSlotOrder} — and handed to that one writer. Renumbering
 * the notes `0..n-1` on their own would land note *k* on top of stop *k*.
 *
 * **The guard is composed here, not in the repository.** `src/server/repos/trips.ts` already imports
 * `./days`, so the note's repository cannot import `requireTrip`/`assertTripRole` back without
 * closing a cycle. {@link writableTripDay} is that composition, in the layer every module that needs
 * both already sits in — the same line `-server/plan.ts` draws.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  DAY_NOTE_ICONS,
  assertTripRole,
  canWritePlan,
  createDayNote,
  deleteDayNote,
  listDayAssignments,
  listDayNotes,
  listTripDayNotes,
  reorderDayTimelines,
  requireDayNote,
  requireTrip,
  requireTripDay,
  requireWritableTrip,
  tripRoleFor,
  updateDayNote,
} from '#/server/repos'
import { appScope } from '../../../-server/context'

import type { TenantScope, TimelineItemInput } from '#/server/repos'

/* -------------------------------------------------------------------------------------------------
 * Shapes
 * ---------------------------------------------------------------------------------------------- */

/** One note of the trip, as the planner renders it. */
export interface PlanNote {
  readonly id: string
  readonly dayId: string
  readonly body: string
  readonly detail: string | null
  readonly time: string | null
  /**
   * As stored, never narrowed to `DayNoteIcon`.
   *
   * The enum is a *write* constraint this stage adds, and no migration narrows the rows written
   * before it. Typing the read as the enum would make this payload claim something about its own
   * rows that is not true; the render registry falls back for a name it does not know, exactly as
   * the map's category icon does.
   */
  readonly icon: string
  readonly sortOrder: number
}

export interface PlanNotesPayload {
  readonly tripId: string
  /** The acting user may write notes: owner or editor, and the trip is not archived. */
  readonly canWrite: boolean
  readonly notes: ReadonlyArray<PlanNote>
}

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const id = z.string().trim().min(1).max(64)

/** `HH:MM`, or the empty string meaning "clear it". */
const timeOrBlank = z.union([
  z.literal(''),
  z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, 'must be a 24-hour time'),
])

/** Blank means "no value", never "unchanged": `longTextSchema` trims, and `''` would be stored. */
function blankToNull(value: string): string | null {
  return value === '' ? null : value
}

const noteBody = z.string().trim().min(1).max(20_000)
const noteDetail = z.string().trim().max(20_000)
const noteIcon = z.enum(DAY_NOTE_ICONS)

/* -------------------------------------------------------------------------------------------------
 * Guard
 * ---------------------------------------------------------------------------------------------- */

/**
 * The four questions every note write asks, in the only order that answers them safely.
 *
 * `requireWritableTrip` first — it asks "may this caller see the trip" and "is it still open for
 * writes" in that order, so a caller who may not *see* the trip learns `NotFoundError` and nothing
 * else, and the archived refusal comes before the role because it is a property of the trip rather
 * than of the caller; then the role, which is safe to disclose only once they have proved they may
 * see the trip (PRD #104 decisions 1 and 6); then the day, which is the structural check that stops
 * a note being parented onto a day of another trip.
 *
 * Both refusals are authored copy and reach the reader as their own sentence. This is a backstop
 * for a stale tab either way — `canWrite` removes the affordance — but a stale tab is still owed the
 * reason its write did not land.
 */
async function writableTripDay(
  scope: TenantScope,
  tripId: string,
  dayId: string,
): Promise<void> {
  await requireWritableTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner', 'editor'])
  await requireTripDay(scope, tripId, dayId)
}

/* -------------------------------------------------------------------------------------------------
 * Sequencing
 * ---------------------------------------------------------------------------------------------- */

/**
 * Where a new note lands: one past the day's whole merged line, never past its notes alone.
 *
 * `sort_order` defaults to `0` and the run is read `(sort_order, id)`, so a new note taking the
 * default sorts *above* every older note the moment a day has been reordered once. The maximum is
 * taken over both tables because the two are one line: one past the notes alone would collide with
 * a stop.
 *
 * Pure, and takes the positions rather than a scope, so the arithmetic is testable against literals.
 */
export function nextNotePosition(positions: ReadonlyArray<number>): number {
  return positions.length === 0 ? 0 : Math.max(...positions) + 1
}

/**
 * The day's sequence with its note slots refilled in the requested order.
 *
 * The stops keep the slots they hold; the notes are permuted among the slots that are theirs. The
 * result names every row of the day exactly once, so `reorderDayTimelines` writes `position = index`
 * and its own dedupe and splice branches are no-ops.
 *
 * Three rules, each mirroring what that function already does to a client's list, because the day it
 * receives from here must not need rescuing:
 *
 * - an id the day does not hold is dropped;
 * - a repeated id counts once;
 * - a note the caller left out is spliced back directly behind the note it currently follows — at
 *   the front when it follows none — so an omission moves nothing. Appending the omissions instead
 *   would sweep every one of them into the day's last note slots.
 *
 * @param current the day's merged sequence, already in position order
 * @param noteIds the notes the caller wants, in the order they want them
 */
export function noteSlotOrder(
  current: ReadonlyArray<TimelineItemInput>,
  noteIds: ReadonlyArray<string>,
): Array<TimelineItemInput> {
  const held = current
    .filter((entry) => entry.kind === 'note')
    .map((entry) => entry.id)
  const known = new Set(held)

  const ordered: Array<string> = []
  const seen = new Set<string>()
  for (const noteId of noteIds) {
    if (!known.has(noteId) || seen.has(noteId)) continue
    seen.add(noteId)
    ordered.push(noteId)
  }

  let previous: string | null = null
  for (const noteId of held) {
    if (!seen.has(noteId)) {
      const anchor = previous === null ? -1 : ordered.indexOf(previous)
      ordered.splice(anchor + 1, 0, noteId)
      seen.add(noteId)
    }
    previous = noteId
  }

  let next = 0
  return current.map((entry) => {
    if (entry.kind === 'stop') return entry
    const noteId = ordered[next]
    next += 1
    return { kind: 'note' as const, id: noteId }
  })
}

/** The day as one line, in the order `reorderDayTimelines` itself reads it. */
async function dayTimeline(
  scope: TenantScope,
  dayId: string,
): Promise<{
  readonly items: ReadonlyArray<TimelineItemInput>
  readonly positions: ReadonlyArray<number>
}> {
  const [stops, notes] = await Promise.all([
    listDayAssignments(scope, dayId),
    listDayNotes(scope, dayId),
  ])
  const merged = [
    ...stops.map((row) => ({
      ref: { kind: 'stop' as const, id: row.id },
      position: row.orderIndex,
    })),
    ...notes.map((row) => ({
      ref: { kind: 'note' as const, id: row.id },
      position: row.sortOrder,
    })),
  ].sort((a, b) => a.position - b.position || a.ref.id.localeCompare(b.ref.id))

  return {
    items: merged.map((entry) => entry.ref),
    positions: merged.map((entry) => entry.position),
  }
}

/* -------------------------------------------------------------------------------------------------
 * Read
 * ---------------------------------------------------------------------------------------------- */

/**
 * Every note of the trip, in one indexed read.
 *
 * One query for the trip rather than one per day: `day_notes_org_trip_idx` leads with
 * `organization_id`, so D1 is charged for this trip's notes and not for a scan. The screen groups
 * them by day itself.
 *
 * The body is a plain function and {@link loadDayNotes} is the server-function shell over it,
 * because outside a Start build a handler's return value is discarded — so a read tested through
 * the boundary can assert nothing about what it read (`plan-reorder.test.ts` records the same
 * three framework properties for writes).
 */
export async function readDayNotes(
  scope: TenantScope,
  tripId: string,
): Promise<PlanNotesPayload> {
  const trip = await requireTrip(scope, tripId)
  const [role, notes] = await Promise.all([
    tripRoleFor(scope, trip.id, scope.ctx.userId),
    listTripDayNotes(scope, trip.id),
  ])

  return {
    tripId: trip.id,
    canWrite: canWritePlan(trip, role),
    notes: notes.map((note) => ({
      id: note.id,
      dayId: note.dayId,
      body: note.body,
      detail: note.detail,
      time: note.time,
      icon: note.icon,
      sortOrder: note.sortOrder,
    })),
  }
}

export const loadDayNotes = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId: id }))
  .handler(async ({ data }): Promise<PlanNotesPayload> => {
    return readDayNotes(await appScope(), data.tripId)
  })

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/** Adds a note to a day, at the end of that day's merged line. */
export const createDayNoteFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: id,
      dayId: id,
      body: noteBody,
      detail: noteDetail.optional(),
      time: timeOrBlank.optional(),
      icon: noteIcon.optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly noteId: string }> => {
    const scope = await appScope()
    await writableTripDay(scope, data.tripId, data.dayId)

    const { positions } = await dayTimeline(scope, data.dayId)
    const note = await createDayNote(scope, {
      tripId: data.tripId,
      dayId: data.dayId,
      body: data.body,
      detail: blankToNull(data.detail ?? ''),
      time: blankToNull(data.time ?? ''),
      ...(data.icon === undefined ? {} : { icon: data.icon }),
      sortOrder: nextNotePosition(positions),
    })

    return { noteId: note.id }
  })

/**
 * Rewrites a note in place.
 *
 * The note row names the trip and the day the write is guarded by — the client's `tripId` addresses
 * the note, it never chooses what is checked. An edit never changes the day: dragging a note to
 * another day is `reorderPlanFn`'s, and with no client-chosen `dayId` there is no cross-day patch
 * left to guard.
 */
export const updateDayNoteFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: id,
      noteId: id,
      body: noteBody.optional(),
      detail: noteDetail.optional(),
      time: timeOrBlank.optional(),
      icon: noteIcon.optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly noteId: string }> => {
    const scope = await appScope()
    const note = await requireDayNote(scope, data.noteId)
    await writableTripDay(scope, note.tripId, note.dayId)

    await updateDayNote(scope, note.id, {
      ...(data.body === undefined ? {} : { body: data.body }),
      ...(data.detail === undefined
        ? {}
        : { detail: blankToNull(data.detail) }),
      ...(data.time === undefined ? {} : { time: blankToNull(data.time) }),
      ...(data.icon === undefined ? {} : { icon: data.icon }),
    })

    return { noteId: note.id }
  })

/** Removes a note from its day. */
export const deleteDayNoteFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, noteId: id }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    const note = await requireDayNote(scope, data.noteId)
    await writableTripDay(scope, note.tripId, note.dayId)

    await deleteDayNote(scope, note.id)
    return { deleted: true }
  })

/**
 * Moves a note among its day's notes.
 *
 * The client sends the note order it wants and nothing else: it cannot build the day's merged
 * sequence, because the board publishes no stop positions. The sequence is rebuilt here and written
 * by `reorderDayTimelines`, which stays the only writer of the day's number line.
 */
export const reorderDayNotesFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: id,
      dayId: id,
      noteIds: z.array(id).max(200),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly dayId: string }> => {
    const scope = await appScope()
    await writableTripDay(scope, data.tripId, data.dayId)

    const { items } = await dayTimeline(scope, data.dayId)
    await reorderDayTimelines(scope, {
      tripId: data.tripId,
      days: [{ dayId: data.dayId, items: noteSlotOrder(items, data.noteIds) }],
    })

    return { dayId: data.dayId }
  })
