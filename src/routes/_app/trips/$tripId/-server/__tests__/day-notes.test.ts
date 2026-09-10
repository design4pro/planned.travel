/**
 * The note module: the guard it opens every write with, and the sequence it hands the day's writer.
 *
 * Two halves, and they are tested differently on purpose.
 *
 * The **sequencing** is pure, so it is asserted against literals: no database, no scope, no day. It
 * is where the interesting rules live — a foreign id is dropped, a repeat counts once, an omission
 * moves nothing, and the stops keep their slots — and each one is a sentence rather than a fixture.
 *
 * The **handlers** need the whole stack, because what is being asserted is a refusal: the role term
 * lives in this module (the repository cannot hold it without closing an import cycle), so a viewer
 * being refused is only observable from here. The wrappers below follow `plan-reorder.test.ts`,
 * which explains why a handler is driven through Start's storage and its validator applied by hand.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RepositoryError,
  addTripMember,
  archiveTrip,
  createAssignment,
  createDayNote,
  createPlace,
  createTrip,
  listDayAssignments,
  listDayNotes,
  listTripDays,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope, TimelineItemInput } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** The scope `appScope()` resolves to. */
  scope: null as TenantScope | null,
}))

vi.mock('../../../../-server/context', async () => {
  const { AuthRequirementError } = await import('#/server/auth/tenant')
  return {
    appScope: async (): Promise<unknown> => {
      if (stubs.scope === null) {
        throw new AuthRequirementError(
          'unauthenticated',
          'You need to sign in to continue.',
        )
      }
      return stubs.scope
    },
  }
})

/* ------------------------------------------------------------ start context */

interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

function startContext(): StartContext {
  return {
    startOptions: {},
    request: new Request('https://planned.travel/_serverFn/day-notes', {
      method: 'POST',
    }),
  }
}

const {
  createDayNoteFn,
  deleteDayNoteFn,
  nextNotePosition,
  noteSlotOrder,
  readDayNotes,
  reorderDayNotesFn,
  updateDayNoteFn,
} = await import('../day-notes')

/** Runs a handler inside a request context, the way the runtime does. */
async function inRequest<T>(run: () => Promise<T>): Promise<T> {
  return startStorage.run(startContext(), run)
}

/** Asserts that `run` rejects, and returns the error so the caller can name its class. */
async function captureError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error) {
      return error
    }
    throw error
  }
  throw new Error('Expected the call to reject, but it resolved.')
}

/* ----------------------------------------------------------------- the pure half */

describe('noteSlotOrder', () => {
  const stop = (id: string): TimelineItemInput => ({ kind: 'stop', id })
  const note = (id: string): TimelineItemInput => ({ kind: 'note', id })

  it('permutes the notes and leaves every stop in its slot', () => {
    const current = [note('n1'), stop('s1'), stop('s2'), note('n2')]

    expect(noteSlotOrder(current, ['n2', 'n1'])).toEqual([
      note('n2'),
      stop('s1'),
      stop('s2'),
      note('n1'),
    ])
  })

  it('drops an id the day does not hold', () => {
    const current = [note('n1'), note('n2')]

    expect(noteSlotOrder(current, ['n2', 'foreign', 'n1'])).toEqual([
      note('n2'),
      note('n1'),
    ])
  })

  it('counts a repeated id once', () => {
    const current = [note('n1'), note('n2')]

    expect(noteSlotOrder(current, ['n2', 'n2', 'n1'])).toEqual([
      note('n2'),
      note('n1'),
    ])
  })

  it('splices an omitted note back behind the note it currently follows', () => {
    // `n2` is not named, so it stays where it is relative to `n1` — an omission moves nothing.
    // Appending omissions instead would sweep them into the day's last note slots.
    const current = [note('n1'), note('n2'), note('n3')]

    expect(noteSlotOrder(current, ['n3', 'n1'])).toEqual([
      note('n3'),
      note('n1'),
      note('n2'),
    ])
  })

  it('keeps an omitted leading note at the front', () => {
    const current = [note('n1'), note('n2'), note('n3')]

    expect(noteSlotOrder(current, ['n3', 'n2'])).toEqual([
      note('n1'),
      note('n3'),
      note('n2'),
    ])
  })

  it('is the identity on a one-note day, and on an empty request', () => {
    expect(noteSlotOrder([stop('s1'), note('n1')], ['n1'])).toEqual([
      stop('s1'),
      note('n1'),
    ])
    expect(noteSlotOrder([stop('s1'), note('n1')], [])).toEqual([
      stop('s1'),
      note('n1'),
    ])
  })
})

describe('nextNotePosition', () => {
  it('is one past the day’s whole merged line', () => {
    expect(nextNotePosition([0, 1, 2])).toBe(3)
    // Stops and notes share the line, so the maximum is taken over both.
    expect(nextNotePosition([0, 0, 7.5])).toBe(8.5)
  })

  it('opens an empty day at zero', () => {
    expect(nextNotePosition([])).toBe(0)
  })
})

/* -------------------------------------------------------------- the guarded half */

interface Fixture {
  readonly tripId: string
  readonly dayId: string
  readonly otherDayId: string
  readonly stopId: string
  readonly noteId: string
}

let harness: Harness
let tenant: SeededTenant
let owner: TenantScope
let viewer: TenantScope
let stranger: TenantScope
let fixture: Fixture

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('planner')
  owner = tenant.scope
  stubs.scope = owner

  const viewerId = await tenant.addUser('A reader')
  const strangerId = await tenant.addUser('Nobody on this trip')
  viewer = tenant.scopeFor(viewerId)
  stranger = tenant.scopeFor(strangerId)

  const trip = await createTrip(owner, {
    title: 'Vienna in October',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    currency: 'EUR',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: viewerId,
    role: 'viewer',
  })

  const days = await listTripDays(owner, trip.id)
  const first = days.at(0)
  const second = days.at(1)
  if (first === undefined || second === undefined) {
    throw new Error('A dated trip must have a day run.')
  }

  const opera = await createPlace(owner, {
    tripId: trip.id,
    name: 'Staatsoper',
  })
  const stop = await createAssignment(owner, {
    tripId: trip.id,
    dayId: first.id,
    placeId: opera.id,
    orderIndex: 0,
  })
  const note = await createDayNote(owner, {
    tripId: trip.id,
    dayId: first.id,
    body: 'Tickets are at the hotel desk.',
    sortOrder: 1,
  })

  fixture = {
    tripId: trip.id,
    dayId: first.id,
    otherDayId: second.id,
    stopId: stop.id,
    noteId: note.id,
  }
})

describe('loadDayNotes', () => {
  it('tells an owner they may write', async () => {
    const payload = await readDayNotes(owner, fixture.tripId)

    expect(payload.canWrite).toBe(true)
    expect(payload.notes).toHaveLength(1)
    expect(payload.notes[0]).toMatchObject({
      id: fixture.noteId,
      dayId: fixture.dayId,
      body: 'Tickets are at the hotel desk.',
      detail: null,
      icon: 'sticky-note',
    })
  })

  it('gives a viewer every note and no write', async () => {
    const payload = await readDayNotes(viewer, fixture.tripId)

    expect(payload.canWrite).toBe(false)
    expect(payload.notes).toHaveLength(1)
  })

  it('refuses a non-member with not-found, and tells them nothing else', async () => {
    const error = await captureError(() =>
      readDayNotes(stranger, fixture.tripId),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('NOT_FOUND')
  })

  it('says a viewer may not write an archived trip either — nor an owner', async () => {
    await archiveTrip(owner, fixture.tripId)

    const payload = await readDayNotes(owner, fixture.tripId)

    expect(payload.canWrite).toBe(false)
  })
})

describe('the writes', () => {
  it('lands a new note at the end of the day’s merged line', async () => {
    // The stop sits at 0 and the seeded note at 1, so a new note takes 2 — not the column
    // default of 0, which would open the day rather than close it.
    await inRequest(() =>
      createDayNoteFn({
        data: {
          tripId: fixture.tripId,
          dayId: fixture.dayId,
          body: 'Dress code is formal.',
          detail: '## Formal\n\nJacket, no jeans.',
          time: '19:30',
          icon: 'ticket',
        },
      }),
    )

    const notes = await listDayNotes(owner, fixture.dayId)
    expect(notes.map((row) => row.id)[0]).toBe(fixture.noteId)
    expect(notes).toHaveLength(2)
    expect(notes[1]).toMatchObject({
      sortOrder: 2,
      time: '19:30',
      icon: 'ticket',
      detail: '## Formal\n\nJacket, no jeans.',
    })
  })

  it('stores a blank detail and a blank time as absent, never as an empty string', async () => {
    await inRequest(() =>
      updateDayNoteFn({
        data: {
          tripId: fixture.tripId,
          noteId: fixture.noteId,
          detail: '',
          time: '',
        },
      }),
    )

    const notes = await listDayNotes(owner, fixture.dayId)
    expect(notes[0]).toMatchObject({ detail: null, time: null })
  })

  it('refuses every write from a viewer, and changes nothing', async () => {
    const before = await listDayNotes(owner, fixture.dayId)
    stubs.scope = viewer

    const attempts: ReadonlyArray<() => Promise<unknown>> = [
      () =>
        createDayNoteFn({
          data: {
            tripId: fixture.tripId,
            dayId: fixture.dayId,
            body: 'Not mine to write.',
          },
        }),
      () =>
        updateDayNoteFn({
          data: {
            tripId: fixture.tripId,
            noteId: fixture.noteId,
            body: 'Rewritten by a reader.',
          },
        }),
      () =>
        deleteDayNoteFn({
          data: { tripId: fixture.tripId, noteId: fixture.noteId },
        }),
      () =>
        reorderDayNotesFn({
          data: {
            tripId: fixture.tripId,
            dayId: fixture.dayId,
            noteIds: [fixture.noteId],
          },
        }),
    ]
    for (const attempt of attempts) {
      const error = await captureError(() => inRequest(attempt))
      expect(error).toBeInstanceOf(RepositoryError)
      expect((error as RepositoryError).code).toBe('FORBIDDEN')
    }

    expect(await listDayNotes(owner, fixture.dayId)).toEqual(before)
  })

  it('refuses every write from a non-member with not-found', async () => {
    stubs.scope = stranger

    const attempts: ReadonlyArray<() => Promise<unknown>> = [
      () =>
        createDayNoteFn({
          data: {
            tripId: fixture.tripId,
            dayId: fixture.dayId,
            body: 'Not mine to write.',
          },
        }),
      () =>
        updateDayNoteFn({
          data: {
            tripId: fixture.tripId,
            noteId: fixture.noteId,
            body: 'Rewritten by a stranger.',
          },
        }),
      () =>
        deleteDayNoteFn({
          data: { tripId: fixture.tripId, noteId: fixture.noteId },
        }),
    ]
    for (const attempt of attempts) {
      const error = await captureError(() => inRequest(attempt))
      expect(error).toBeInstanceOf(RepositoryError)
      expect((error as RepositoryError).code).toBe('NOT_FOUND')
    }
  })

  it('refuses a write to an archived trip before it reaches the row', async () => {
    await archiveTrip(owner, fixture.tripId)

    const error = await captureError(() =>
      inRequest(() =>
        createDayNoteFn({
          data: {
            tripId: fixture.tripId,
            dayId: fixture.dayId,
            body: 'The trip is over.',
          },
        }),
      ),
    )

    expect(error.message).toContain('archived')
    expect(await listDayNotes(owner, fixture.dayId)).toHaveLength(1)
  })

  it('refuses a note parented onto a day of another trip', async () => {
    const other = await createTrip(owner, {
      title: 'Porto in June',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
    })
    const otherDays = await listTripDays(owner, other.id)
    const foreignDay = otherDays.at(0)
    if (foreignDay === undefined) {
      throw new Error('A dated trip must have a day run.')
    }

    const error = await captureError(() =>
      inRequest(() =>
        createDayNoteFn({
          data: {
            tripId: fixture.tripId,
            dayId: foreignDay.id,
            body: 'On the wrong trip’s day.',
          },
        }),
      ),
    )

    expect((error as RepositoryError).code).toBe('NOT_FOUND')
    expect(await listDayNotes(owner, foreignDay.id)).toEqual([])
  })

  it('moves a note without moving a stop', async () => {
    await inRequest(() =>
      createDayNoteFn({
        data: {
          tripId: fixture.tripId,
          dayId: fixture.dayId,
          body: 'Dress code is formal.',
        },
      }),
    )

    const [, added] = await listDayNotes(owner, fixture.dayId)
    await inRequest(() =>
      reorderDayNotesFn({
        data: {
          tripId: fixture.tripId,
          dayId: fixture.dayId,
          noteIds: [added.id, fixture.noteId],
        },
      }),
    )

    // The day was `stop@0, note@1, note@2`; the notes swap into the note slots and the
    // stop keeps slot 0. The line comes out dense, so the next move is a real move.
    const [stops, notes] = await Promise.all([
      listDayAssignments(owner, fixture.dayId),
      listDayNotes(owner, fixture.dayId),
    ])
    expect(stops[0]).toMatchObject({ id: fixture.stopId, orderIndex: 0 })
    expect(notes.map((row) => [row.id, row.sortOrder])).toEqual([
      [added.id, 1],
      [fixture.noteId, 2],
    ])
  })
})
