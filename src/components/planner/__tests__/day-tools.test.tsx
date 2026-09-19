// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DaySection } from '../day-section'

import type { PlannerDay } from '../types'

/**
 * The day footer's render slot.
 *
 * `dayTools` is how the screen gives a day more footer controls without this component
 * learning about them, so the two facts worth pinning are that it is drawn once for the
 * day it was asked about, and that a consumer which never passes it sees nothing new.
 */

const MESSAGES = await loadCatalogue('en')

const DAY: PlannerDay = {
  dayId: 'd1',
  dayNumber: 1,
  title: 'Asakusa and the river',
  dateLabel: 'Fri, 9 Oct',
  stays: [],
  rows: [],
  items: [],
}

function renderDay(dayTools?: (day: PlannerDay) => React.ReactNode) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      <DndContext>
        <DaySection
          day={DAY}
          categoryFor={() => undefined}
          canWriteNotes
          dayTools={dayTools}
        />
      </DndContext>
    </I18nProvider>,
  )
}

describe('DaySection dayTools', () => {
  it('draws the tools once, for the day it renders', () => {
    const dayTools = vi.fn((day: PlannerDay) => (
      <button type="button">{`Tool for ${day.title}`}</button>
    ))

    renderDay(dayTools)

    expect(
      screen.getAllByRole('button', { name: 'Tool for Asakusa and the river' }),
    ).toHaveLength(1)
    expect(dayTools).toHaveBeenCalledWith(DAY)
  })

  it('draws nothing extra when no tools are given', () => {
    const { container } = renderDay()

    // The day header and the note control, and nothing else.
    expect(container.querySelectorAll('button')).toHaveLength(2)
  })
})
