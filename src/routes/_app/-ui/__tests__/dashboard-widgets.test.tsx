// The menu mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { DashboardWidgetsMenu, useDashboardWidgets } from '../dashboard-widgets'

import type { Catalogue } from '#/lib/i18n'

/**
 * The menu that decides what the reference column holds.
 *
 * The claim under test is not "a checkbox toggles": it is that the column's
 * order survives a round trip through the reader's browser. A widget switched
 * off and on again belongs where it always was, and the record that says so
 * outlives the page — which is the difference between a preference and a
 * gesture.
 */

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/** The four widgets, in the order the column stacks them. */
const LABELS = [
  'World clock',
  'Upcoming reservations',
  'Trip pipeline',
  'Storage',
]

/**
 * The menu beside the list it governs, which is what a `data-part` cannot say:
 * the assertion is the *order* the column would draw, not merely which boxes are
 * ticked.
 */
function Harness() {
  const widgets = useDashboardWidgets()
  return (
    <I18nProvider locale="en" messages={EN}>
      <DashboardWidgetsMenu widgets={widgets} />
      <p data-part="shown">{widgets.shown.join(' ')}</p>
    </I18nProvider>
  )
}

function shown(): string {
  return document.querySelector('[data-part="shown"]')?.textContent ?? ''
}

async function openMenu(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Choose widgets' }))
  return user
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('the dashboard’s widget menu', () => {
  it('offers every widget under its own panel heading, all on to begin with', async () => {
    await openMenu()

    expect(
      screen
        .getAllByRole('menuitemcheckbox')
        .map((item) => item.textContent.trim()),
    ).toEqual(LABELS)
    expect(shown()).toBe('clock bookings tripMix storage')
  })

  it('folds a widget away and remembers it for the next visit', async () => {
    const user = await openMenu()

    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'Trip pipeline' }),
    )
    expect(shown()).toBe('clock bookings storage')

    // The record, not the render: a second mount of a brand new tree reads the
    // browser back and draws the same column.
    cleanup()
    render(<Harness />)
    expect(shown()).toBe('clock bookings storage')
  })

  /**
   * The mutation this is really aimed at: an implementation that appends the
   * widget it switches back on would answer `clock bookings storage tripMix`
   * here, and the column would quietly reorder itself under a reader who only
   * meant to look at something twice.
   */
  it('brings a widget back to its own place, not to the end', async () => {
    const user = await openMenu()

    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'Trip pipeline' }),
    )
    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'Trip pipeline' }),
    )

    expect(shown()).toBe('clock bookings tripMix storage')
  })

  /**
   * Deciding what the column holds is several decisions, not one, so the menu
   * stays up across them. A menu that closed on the first tick would make
   * emptying the column four separate journeys.
   */
  it('stays open across several decisions', async () => {
    const user = await openMenu()

    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'Trip pipeline' }),
    )
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Storage' }))
    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'World clock' }),
    )
    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'Upcoming reservations' }),
    )

    // Every widget off — the state that collapses the column — and the menu is
    // still there, which is the only way anything comes back.
    expect(shown()).toBe('')
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(4)
  })
})
