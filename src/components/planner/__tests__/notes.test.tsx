// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DaySection } from '../day-section'
import { NoteRow } from '../note-row'

import type { PlannerDay, PlannerNote } from '../types'

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

function day(notes: ReadonlyArray<PlannerNote>): PlannerDay {
  return {
    dayId: 'd1',
    dayNumber: 1,
    title: 'Asakusa and the river',
    dateLabel: 'Fri, 9 Oct',
    stays: [],
    rows: [],
    notes,
  }
}

/** One note, in the list element its row expects to sit in. */
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
    <ul>
      <NoteRow {...props} />
    </ul>,
  )
}

/** A whole day section, with the drag context the stop list needs above it. */
function renderDay(
  notes: ReadonlyArray<PlannerNote>,
  overrides: Partial<React.ComponentProps<typeof DaySection>> = {},
) {
  return render(
    <DndContext>
      <DaySection
        day={day(notes)}
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

  it('disables the move a note at the end of the run cannot make', () => {
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
    renderRow({ canWrite: false, note: note({ id: 'n1', detail: 'More' }) })

    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit note' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull()
    // The detail is still readable: reading is the whole of what a viewer does.
    expect(screen.getByRole('button', { name: 'Show more' })).toBeDefined()
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
      [note({ id: 'n1', body: 'First' }), note({ id: 'n2', body: 'Second' })],
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

  it('offers the add control with a name that says which day it writes to', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    renderDay([], { canWriteNotes: true, onAddNote })

    const add = screen.getByRole('button', { name: 'Add a note for this day' })
    expect(add.textContent).toContain('Add a note')

    await user.click(add)
    expect(onAddNote).toHaveBeenCalledTimes(1)
  })

  it('gives a viewer the notes and no way to add one', () => {
    renderDay([note({ id: 'n1', body: 'Ferry leaves at six' })])

    expect(screen.getByText('Ferry leaves at six')).toBeDefined()
    expect(
      screen.queryByRole('button', { name: 'Add a note for this day' }),
    ).toBeNull()
  })
})
