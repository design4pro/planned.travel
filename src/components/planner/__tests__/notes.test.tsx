// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DaySection } from '../day-section'
import { DragPreview } from '../drag-preview'
import { NoteRow } from '../note-row'

import type { PlannerDay, PlannerItem, PlannerNote, PlannerRow } from '../types'

/**
 * The note run of a day, mounted for real.
 *
 * Three things this slice can get wrong are only visible from the DOM, so they are
 * checked here rather than reasoned about: a viewer offered a control that will be
 * refused; a disclosure on a note with nothing behind it; and a stored icon name this
 * build cannot draw rendering as nothing at all.
 *
 * Every mount sits under the real `en` catalogue rather than a stub, so the assertions
 * name the words a reader sees and a copy change that skips a locale is the parity
 * test's failure rather than a silent rename here.
 */

const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

function note(overrides: Partial<PlannerNote> & { id: string }): PlannerNote {
  return {
    dayId: 'd1',
    body: 'Buy the metro pass at the airport',
    detail: null,
    time: null,
    icon: 'sticky-note',
    ...overrides,
  }
}

/** A stop, for the days that need something other than a note in the sequence. */
function stop(id: string, name: string): PlannerRow {
  return {
    itemId: id,
    placeId: `p-${id}`,
    assignmentId: id,
    name,
    location: null,
    time: null,
    duration: null,
    categoryId: null,
    imageUrl: null,
    rating: null,
    note: null,
    reservationStatus: 'none',
    lng: null,
    lat: null,
    visited: false,
    dayNumber: 1,
  }
}

function day(items: ReadonlyArray<PlannerItem>): PlannerDay {
  return {
    dayId: 'd1',
    dayNumber: 1,
    title: 'Asakusa and the river',
    dateLabel: 'Fri, 9 Oct',
    stays: [],
    rows: items.flatMap((item) => (item.kind === 'stop' ? [item.row] : [])),
    items,
  }
}

/** The two item kinds, as short as the fixtures that build days out of them. */
function noteItem(entry: PlannerNote): PlannerItem {
  return { kind: 'note', note: entry }
}

function stopItem(row: PlannerRow): PlannerItem {
  return { kind: 'stop', row }
}

/** One note, in the list element and the drag context its row expects. */
function renderRow(
  overrides: Partial<React.ComponentProps<typeof NoteRow>> = {},
) {
  const props = {
    note: note({ id: 'n1' }),
    position: 0,
    count: 1,
    canWrite: true,
    ...overrides,
  }
  return render(
    <DndContext>
      <ul>
        <NoteRow {...props} />
      </ul>
    </DndContext>,
  )
}

/** A whole day section, with the drag context the stop list needs above it. */
function renderDay(
  items: ReadonlyArray<PlannerItem>,
  overrides: Partial<React.ComponentProps<typeof DaySection>> = {},
) {
  return render(
    <DndContext>
      <DaySection
        day={day(items)}
        categoryFor={() => undefined}
        {...overrides}
      />
    </DndContext>,
  )
}

describe('NoteRow', () => {
  it('shows the icon by name, the time in the headline, and the body', () => {
    renderRow({
      note: note({ id: 'n1', icon: 'ticket', time: '18:30' }),
    })

    expect(screen.getByRole('img', { name: 'Tickets' })).toBeDefined()
    expect(screen.getByText('18:30')).toBeDefined()
    expect(screen.getByText('Buy the metro pass at the airport')).toBeDefined()
  })

  /**
   * `01-S2b` narrowed what may be *written*; no migration narrowed what is already
   * stored, and the seed is not the only writer this table has ever had.
   */
  it('falls back to the sticky note for a name this build cannot draw', () => {
    renderRow({ note: note({ id: 'n1', icon: 'skull' }) })

    expect(screen.getByRole('img', { name: 'Note' })).toBeDefined()
  })

  /**
   * The registry is a plain object, so `'constructor' in ICONS` is true and the lookup would
   * hand back `Object` for React to render. The column took any short text until `01-S2b`.
   */
  it('falls back for a stored name that is an Object.prototype member', () => {
    for (const icon of ['constructor', 'toString', '__proto__']) {
      const { unmount } = renderRow({ note: note({ id: 'n1', icon }) })
      expect(screen.getByRole('img', { name: 'Note' })).toBeDefined()
      unmount()
    }
  })

  it('offers no disclosure on a note that carries no detail', () => {
    renderRow({ note: note({ id: 'n1', detail: null }) })

    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('reveals the detail as markdown, and says so both ways', async () => {
    const user = userEvent.setup()
    renderRow({
      note: note({
        id: 'n1',
        detail: '## Before you go\n\n- Passport\n- Yen',
      }),
    })

    const disclosure = screen.getByRole('button', { name: 'Show more' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('heading', { name: 'Before you go' })).toBeNull()

    await user.click(disclosure)

    expect(screen.getByRole('heading', { name: 'Before you go' })).toBeDefined()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(1)
    const less = screen.getByRole('button', { name: 'Show less' })
    expect(less.getAttribute('aria-expanded')).toBe('true')

    await user.click(less)
    expect(screen.queryByRole('heading', { name: 'Before you go' })).toBeNull()
  })

  it('disables the move a note at the end of the sequence cannot make', () => {
    renderRow({ position: 0, count: 3 })

    expect(
      screen.getByRole('button', { name: 'Move up' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Move down' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('asks for one place earlier or one place later', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn()
    renderRow({ position: 1, count: 3, onMove })

    await user.click(screen.getByRole('button', { name: 'Move up' }))
    await user.click(screen.getByRole('button', { name: 'Move down' }))

    expect(onMove.mock.calls).toEqual([[-1], [1]])
  })

  /**
   * A drag has to have a single-pointer equivalent (WCAG 2.2 SC 2.5.7), and a note can now
   * be dragged to another day: the chevrons stay inside the day, so this menu is the only
   * pointer route there.
   */
  it('moves the note to another day from a menu, without a drag', async () => {
    const user = userEvent.setup()
    const onMoveToDay = vi.fn()
    renderRow({
      otherDays: [
        { dayId: 'd2', title: 'Day 2 — Kyoto by train' },
        { dayId: 'd3', title: 'Day 3 — Nara' },
      ],
      onMoveToDay,
    })

    await user.click(screen.getByRole('button', { name: 'Move to day' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Day 3 — Nara' }),
    )

    expect(onMoveToDay.mock.calls).toEqual([['d3']])
  })

  it('offers no day menu when there is no other day to go to', () => {
    renderRow({ otherDays: [], onMoveToDay: vi.fn() })

    expect(screen.queryByRole('button', { name: 'Move to day' })).toBeNull()
  })

  it('holds the day menu still while the row’s own write is in flight', () => {
    renderRow({
      pending: true,
      otherDays: [{ dayId: 'd2', title: 'Day 2' }],
      onMoveToDay: vi.fn(),
    })

    expect(
      screen
        .getByRole('button', { name: 'Move to day' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('opens the editor and the delete from the row', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderRow({ onEdit, onDelete })

    await user.click(screen.getByRole('button', { name: 'Edit note' }))
    await user.click(screen.getByRole('button', { name: 'Delete note' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  /**
   * PRD #104 decision 6: a viewer reads the plan. The refusal used to happen at the
   * server, after the click — the control is the thing that has to go.
   */
  it('offers a reader with no write not one control', () => {
    renderRow({
      canWrite: false,
      note: note({ id: 'n1', detail: 'More' }),
      otherDays: [{ dayId: 'd2', title: 'Day 2' }],
      onMoveToDay: vi.fn(),
    })

    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move to day' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit note' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull()
    // The detail is still readable: reading is the whole of what a viewer does.
    expect(screen.getByRole('button', { name: 'Show more' })).toBeDefined()
  })

  /**
   * The handle is the whole of keyboard drag: `@dnd-kit`'s keyboard sensor lifts from
   * the activator, so a row without one can be dragged by pointer and by nothing else.
   */
  it('offers a named drag handle only when the note can be dragged', () => {
    const { unmount } = renderRow({ draggable: true })
    expect(screen.getByRole('button', { name: 'Reorder note' })).toBeDefined()
    unmount()

    renderRow()
    expect(screen.queryByRole('button', { name: 'Reorder note' })).toBeNull()
  })

  it('offers no drag handle to a reader who cannot write', () => {
    renderRow({ canWrite: false, draggable: true })

    expect(screen.queryByRole('button', { name: 'Reorder note' })).toBeNull()
  })

  it('holds every control still while the row’s own write is in flight', () => {
    renderRow({ pending: true, position: 1, count: 3 })

    for (const name of ['Move up', 'Move down', 'Edit note', 'Delete note']) {
      expect(
        screen.getByRole('button', { name }).hasAttribute('disabled'),
      ).toBe(true)
    }
  })
})

describe('DaySection notes', () => {
  it('renders the day’s run in order, each knowing where it sits', () => {
    renderDay(
      [
        noteItem(note({ id: 'n1', body: 'First' })),
        noteItem(note({ id: 'n2', body: 'Second' })),
      ],
      { canWriteNotes: true },
    )

    const rows = screen
      .getAllByRole('listitem')
      .filter((item) => item.hasAttribute('data-planner-note'))
    expect(rows.map((item) => item.getAttribute('data-planner-note'))).toEqual([
      'n1',
      'n2',
    ])
    // Only the ends are refused, and only in the direction they cannot go.
    expect(
      within(rows[0])
        .getByRole('button', { name: 'Move up' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      within(rows[1])
        .getByRole('button', { name: 'Move down' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  /**
   * The chevrons walk the sequence, not the note run. A lone note above a stop had
   * both of its chevrons greyed out until `01-S4b` — the run it was the whole of had
   * nowhere to go — while the day plainly had somewhere to put it.
   */
  it('lets a note move past the stop below it', async () => {
    const user = userEvent.setup()
    const onMoveNote = vi.fn()
    renderDay(
      [
        noteItem(note({ id: 'n1', body: 'Tickets are at the desk' })),
        stopItem(stop('a1', 'Senso-ji')),
      ],
      { canWriteNotes: true, onMoveNote },
    )

    const row = screen
      .getAllByRole('listitem')
      .find((item) => item.hasAttribute('data-planner-note'))
    expect(row).toBeDefined()
    if (row === undefined) return

    expect(
      within(row)
        .getByRole('button', { name: 'Move up' })
        .hasAttribute('disabled'),
    ).toBe(true)

    const down = within(row).getByRole('button', { name: 'Move down' })
    expect(down.hasAttribute('disabled')).toBe(false)

    await user.click(down)
    expect(onMoveNote.mock.calls).toHaveLength(1)
    expect(onMoveNote.mock.calls[0][1]).toBe(1)
  })

  it('offers every day but its own as a place to move a note to', async () => {
    const user = userEvent.setup()
    const onMoveNoteToDay = vi.fn()
    const here = note({ id: 'n1', body: 'Tickets are at the desk' })
    renderDay([noteItem(here)], {
      canWriteNotes: true,
      moveTargets: [
        { dayId: 'd1', title: 'Asakusa and the river' },
        { dayId: 'd2', title: 'Kyoto by train' },
      ],
      onMoveNoteToDay,
    })

    await user.click(screen.getByRole('button', { name: 'Move to day' }))

    expect(
      screen.queryByRole('menuitem', { name: 'Asakusa and the river' }),
    ).toBeNull()
    await user.click(
      await screen.findByRole('menuitem', { name: 'Kyoto by train' }),
    )
    expect(onMoveNoteToDay.mock.calls).toEqual([[here, 'd2']])
  })

  it('refuses the note that is last in the sequence its own way down', () => {
    renderDay(
      [
        stopItem(stop('a1', 'Senso-ji')),
        noteItem(note({ id: 'n1', body: 'Last train is at midnight' })),
      ],
      { canWriteNotes: true },
    )

    const row = screen
      .getAllByRole('listitem')
      .find((item) => item.hasAttribute('data-planner-note'))
    expect(row).toBeDefined()
    if (row === undefined) return

    expect(
      within(row)
        .getByRole('button', { name: 'Move down' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      within(row)
        .getByRole('button', { name: 'Move up' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('offers the add control with a name that says which day it writes to', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    renderDay([], { canWriteNotes: true, onAddNote })

    // The day's own title, not a static "this day": ten of these sit on one screen,
    // and a name that does not carry the title names all ten identically.
    const add = screen.getByRole('button', {
      name: 'Add a note for Asakusa and the river',
    })
    expect(add.textContent).toContain('Add a note')

    await user.click(add)
    expect(onAddNote).toHaveBeenCalledTimes(1)
  })

  it('gives a viewer the notes and no way to add one', () => {
    renderDay([noteItem(note({ id: 'n1', body: 'Ferry leaves at six' }))])

    expect(screen.getByText('Ferry leaves at six')).toBeDefined()
    expect(
      screen.queryByRole('button', { name: /^Add a note for / }),
    ).toBeNull()
  })
})

describe('DragPreview for a note', () => {
  /**
   * No thumbnail: there is no place to picture. What is left has to say which note is
   * in the air, which is the headline and — when it has one — the time it is pinned to.
   */
  it('carries the headline and the time, and no place thumbnail', () => {
    const { container } = render(
      <DragPreview note={note({ id: 'n1', time: '18:30' })} />,
    )

    expect(screen.getByText('Buy the metro pass at the airport')).toBeDefined()
    expect(screen.getByText('18:30')).toBeDefined()
    expect(
      container
        .querySelector('[data-drag-preview]')
        ?.getAttribute('data-drag-preview'),
    ).toBe('note')
  })
})
