// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { PlannerAddPlace, placeWriteMessage } from '../planner-add-place'
import { PlannerDayTools } from '../planner-day-tools'

import type { PlannerDay } from '#/components/planner'

/**
 * The two add controls this stage moves out of the screen, and what a failed write says.
 *
 * The published `data-part` hooks are what later stages and the journey address, so
 * they are asserted from the DOM rather than read off the JSX.
 */

const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

const DAY: PlannerDay = {
  dayId: 'd3',
  dayNumber: 3,
  title: 'Day 3',
  dateLabel: null,
  stays: [],
  rows: [],
  items: [],
}

describe('PlannerDayTools', () => {
  it('asks for a place on its own day, and says which day that is', async () => {
    const onAddPlace = vi.fn()
    render(
      <PlannerDayTools day={DAY} onAddPlace={onAddPlace} onAddStay={vi.fn()} />,
    )

    const control = screen.getByRole('button', { name: 'Add a place to Day 3' })
    expect(control.textContent).toBe('Add a place to this day')

    await userEvent.click(control)
    expect(onAddPlace).toHaveBeenCalledExactlyOnceWith('d3')
  })

  it('asks for a stay whose first night is its own day, and says which day that is', async () => {
    const onAddStay = vi.fn()
    render(
      <PlannerDayTools day={DAY} onAddPlace={vi.fn()} onAddStay={onAddStay} />,
    )

    const control = screen.getByRole('button', { name: 'Add a stay for Day 3' })
    expect(control.textContent).toBe('Add a stay from this day')

    await userEvent.click(control)
    expect(onAddStay).toHaveBeenCalledExactlyOnceWith('d3')
  })
})

describe('PlannerAddPlace', () => {
  it('keeps the pill as it was: one primary control that opens the form', async () => {
    const onCreate = vi.fn()
    const { container } = render(<PlannerAddPlace onCreate={onCreate} />)

    const pill = container.querySelectorAll('[data-part="add-place"]')
    expect(pill).toHaveLength(1)
    expect(pill[0].textContent).toBe('Add a place')

    await userEvent.click(screen.getByRole('button', { name: 'Add a place' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('offers no menu while there is nothing in it', () => {
    const { container } = render(<PlannerAddPlace onCreate={() => {}} />)

    expect(
      container.querySelectorAll('[data-part="add-place-menu"]'),
    ).toHaveLength(0)
  })

  it('offers placing it on the map once the map is ready', async () => {
    const onArmMap = vi.fn()
    const { container } = render(
      <PlannerAddPlace onCreate={() => {}} onArmMap={onArmMap} mapReady />,
    )

    expect(
      container.querySelectorAll('[data-part="add-place-menu"]'),
    ).toHaveLength(1)

    await userEvent.click(
      screen.getByRole('button', { name: 'More ways to add a place' }),
    )
    const option = screen.getByRole('menuitem', { name: 'Place it on the map' })
    expect(option.getAttribute('data-part')).toBe('add-place-option')
    expect(option.getAttribute('data-value')).toBe('map')

    await userEvent.click(option)
    // Once the menu has closed, so the map can take focus; handed the trigger to return it to.
    await waitFor(() => {
      expect(onArmMap).toHaveBeenCalledExactlyOnceWith(
        screen.getByRole('button', { name: 'More ways to add a place' }),
      )
    })
  })

  it('holds the map option back until the map exists', async () => {
    render(<PlannerAddPlace onCreate={() => {}} onArmMap={() => {}} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'More ways to add a place' }),
    )
    expect(
      screen
        .getByRole('menuitem', { name: 'Place it on the map' })
        .getAttribute('aria-disabled'),
    ).toBe('true')
  })
})

describe('placeWriteMessage', () => {
  it('shows a refusal the server authored, as written', () => {
    const cause = new Error(
      encodePublicFailure({
        kind: 'refusal',
        message: 'This trip is archived.',
      }),
    )

    expect(placeWriteMessage(cause, 'Try again.')).toBe(
      'This trip is archived.',
    )
  })

  it('shows the fallback for a diagnostic the server withheld', () => {
    // A places quota refusal arrives exactly like this: `QuotaExceededError` is not
    // authored copy, so the redaction middleware sends a reference and no code.
    const cause = new Error(
      encodePublicFailure({ kind: 'unexpected', reference: 'ref-1' }),
    )

    expect(placeWriteMessage(cause, 'Try again.')).toBe('Try again.')
  })

  it('never renders a raw message that did not come through the envelope', () => {
    expect(placeWriteMessage(new Error('Failed to fetch'), 'Try again.')).toBe(
      'Try again.',
    )
  })
})
