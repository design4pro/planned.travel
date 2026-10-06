// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider, LOCALE_TAGS, loadCatalogue } from '#/lib/i18n'
import {
  PlannerAddPlace,
  placeWriteMessage,
  reportPlaceWriteFailure,
} from '../planner-add-place'
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
    // Label in Name (WCAG 2.5.3): a speech-input user says what they see.
    expect(control.textContent).toBe('Add a place')

    await userEvent.click(control)
    expect(onAddPlace).toHaveBeenCalledExactlyOnceWith('d3')
  })

  it.each(LOCALE_TAGS)(
    'opens the place control’s name with its visible label in %s',
    async (locale) => {
      mount(
        <I18nProvider locale={locale} messages={await loadCatalogue(locale)}>
          <PlannerDayTools day={DAY} onAddPlace={vi.fn()} onAddStay={vi.fn()} />
        </I18nProvider>,
      )

      const [control] = screen.getAllByRole('button')
      const label = control.textContent ?? ''
      expect(label).not.toBe('')
      expect(control.getAttribute('aria-label')?.startsWith(label)).toBe(true)
    },
  )

  it('asks for a stay whose first night is its own day, and says which day that is', async () => {
    const onAddStay = vi.fn()
    render(
      <PlannerDayTools day={DAY} onAddPlace={vi.fn()} onAddStay={onAddStay} />,
    )

    const control = screen.getByRole('button', { name: 'Add a stay for Day 3' })
    // Label in Name (WCAG 2.5.3): a speech-input user says what they see.
    expect(control.textContent).toBe('Add a stay')

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
    // Any diagnostic arrives like this. A quota refusal is the one that also carries a code,
    // which `reportPlaceWriteFailure` below reads.
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

describe('reportPlaceWriteFailure', () => {
  const copy = {
    fallback: 'Try again.',
    quota: 'Your plan’s places limit is reached.',
    seePlans: 'See plans',
  }

  function quotaRefusal(): Error {
    return new Error(
      encodePublicFailure({
        kind: 'unexpected',
        code: 'QUOTA_EXCEEDED',
        reference: 'ref-1',
      }),
    )
  }

  it('answers a quota refusal with the quota sentence and an action that leads to the plans', () => {
    const report = reportPlaceWriteFailure(quotaRefusal(), copy)

    expect(report.message).toBe(copy.quota)
    expect(report.action).toEqual({
      label: copy.seePlans,
      href: '/settings/billing',
    })
  })

  it('keeps today’s answer for every other failure, with no action', () => {
    for (const cause of [
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'ref-1' }),
      ),
      new Error(
        encodePublicFailure({
          kind: 'refusal',
          message: 'This trip is archived.',
        }),
      ),
      new Error('Failed to fetch'),
    ]) {
      const expected = placeWriteMessage(cause, copy.fallback)

      expect(reportPlaceWriteFailure(cause, copy)).toEqual({
        message: expected,
        action: null,
      })
    }
  })

  it('does not treat a code on a refusal as a quota hit', () => {
    const cause = new Error(
      encodePublicFailure({
        kind: 'refusal',
        message: 'This trip is archived.',
        code: 'QUOTA_EXCEEDED',
      }),
    )

    expect(reportPlaceWriteFailure(cause, copy)).toEqual({
      message: 'This trip is archived.',
      action: null,
    })
  })
})
