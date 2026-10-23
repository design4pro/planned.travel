// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'

import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider, LOCALE_TAGS, loadCatalogue } from '#/lib/i18n'
import { DeleteDialog, StopMenu } from '../plan-actions'
import { day } from './plan-board-fixtures'

import type { PlannerRow } from '#/components/planner'
import type { Locale } from '#/lib/i18n'

/**
 * The stop menu and the delete confirmation read every sentence from the catalogue.
 *
 * Each surface is rendered in every non-English locale and its whole visible and
 * accessible text is checked against the English sentences the components used to
 * hardcode: a literal that comes back is a string a reader of that locale gets in
 * English next to translated neighbours (WCAG 3.1.2).
 */

const NON_ENGLISH = LOCALE_TAGS.filter((locale) => locale !== 'en')

const CATALOGUES = new Map<Locale, Awaited<ReturnType<typeof loadCatalogue>>>(
  await Promise.all(
    LOCALE_TAGS.map(
      async (locale) => [locale, await loadCatalogue(locale)] as const,
    ),
  ),
)

function render(ui: React.ReactElement, locale: Locale) {
  const messages = CATALOGUES.get(locale)
  if (messages === undefined) throw new Error(`no catalogue for ${locale}`)
  return mount(
    <I18nProvider locale={locale} messages={messages}>
      {ui}
    </I18nProvider>,
  )
}

/** Everything a reader or a screen reader gets from the document: text and names. */
function surface(): string {
  const names = Array.from(document.body.querySelectorAll('[aria-label]')).map(
    (element) => element.getAttribute('aria-label') ?? '',
  )
  return [document.body.textContent ?? '', ...names].join('\n')
}

function expectNoEnglish(literals: ReadonlyArray<string>) {
  const text = surface()
  for (const literal of literals) expect(text).not.toContain(literal)
}

const ROW: PlannerRow = {
  itemId: 'i1',
  placeId: 'p1',
  assignmentId: 'a1',
  name: 'Senso-ji',
  location: null,
  time: null,
  duration: null,
  categoryId: null,
  imageUrl: null,
  rating: null,
  note: null,
  reservationStatus: 'none',
  visited: false,
  dayNumber: 1,
  lat: null,
  lng: null,
}

// Untitled days, so the "Day {n}" fallback is what the submenu renders.
const DAYS = [day('d1', 1, [], null), day('d2', 2, [], null)]

const STOP_MENU_ENGLISH = [
  'Actions for',
  'Edit place',
  'Set a time',
  'Place it on the map',
  'Move its pin',
  'Move to day',
  'Day 2',
  'Back to unplanned',
  'Delete from trip',
]

function menu(row: PlannerRow) {
  return (
    <StopMenu
      row={row}
      days={DAYS}
      onEditPlace={vi.fn()}
      onEditTiming={vi.fn()}
      onPickPosition={vi.fn()}
      onMoveToDay={vi.fn()}
      onUnschedule={vi.fn()}
      onDelete={vi.fn()}
    />
  )
}

describe('StopMenu — localised', () => {
  it.each(NON_ENGLISH)(
    'renders no English literal for an unplaced stop in %s',
    async (locale) => {
      render(menu(ROW), locale)
      const user = userEvent.setup()

      await user.click(screen.getByRole('button'))
      const items = screen.getAllByRole('menuitem')
      // The submenu trigger is a menu item too; open it to reach the day names.
      const subTrigger = items.find(
        (item) => item.getAttribute('aria-haspopup') === 'menu',
      )
      expect(subTrigger).toBeDefined()
      subTrigger?.focus()
      await user.keyboard('{ArrowRight}')
      // The submenu really opened: the untitled day shows up as a menu item.
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(
        items.length,
      )

      expectNoEnglish(STOP_MENU_ENGLISH)
      expect(surface()).toContain('Senso-ji')
    },
  )

  it.each(NON_ENGLISH)(
    'renders no English literal for a placed stop in %s',
    async (locale) => {
      render(menu({ ...ROW, lat: 35.71, lng: 139.79 }), locale)

      await userEvent.click(screen.getByRole('button'))

      expectNoEnglish(STOP_MENU_ENGLISH)
    },
  )

  it('reads Polish where the catalogue has it', async () => {
    render(menu(ROW), 'pl')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button'))
    expect(
      screen.getByRole('menuitem', { name: 'Edytuj miejsce' }),
    ).toBeDefined()

    screen.getByRole('menuitem', { name: 'Przenieś do innego dnia' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('menuitem', { name: 'Dzień 2' })).toBeDefined()
  })
})

describe('DeleteDialog — localised', () => {
  const DELETE_ENGLISH = [
    'Delete Senso-ji?',
    'It leaves the trip’s places entirely',
    'of this trip, and it leaves',
    'This cannot be undone',
    'That did not delete',
    'Keep it',
    'Delete place',
    'Deleting the place',
  ]

  function dialog(dayCount: number, error: string | null, saving = false) {
    return (
      <DeleteDialog
        open
        onOpenChange={vi.fn()}
        placeName="Senso-ji"
        dayCount={dayCount}
        saving={saving}
        error={error}
        onConfirm={vi.fn()}
      />
    )
  }

  it.each(NON_ENGLISH)(
    'renders no English literal for 0, 1 and several days in %s',
    (locale) => {
      for (const count of [0, 1, 3]) {
        const { unmount } = render(dialog(count, null), locale)
        expectNoEnglish(DELETE_ENGLISH)
        expect(
          within(screen.getByRole('dialog')).getByText(/Senso-ji/),
        ).toBeDefined()
        unmount()
      }
    },
  )

  it.each(NON_ENGLISH)(
    'renders no English literal for the failure alert and the loading label in %s',
    (locale) => {
      render(dialog(2, 'The server said no', true), locale)

      expectNoEnglish(DELETE_ENGLISH)
      expect(surface()).toContain('The server said no')
    },
  )

  it('reads Polish branches for the day count', () => {
    const { unmount } = render(dialog(1, null), 'pl')
    const one = screen.getByRole('dialog').textContent
    unmount()
    render(dialog(3, null), 'pl')
    const few = screen.getByRole('dialog').textContent

    expect(one).toContain('1 dniu')
    expect(few).toContain('3 dniach')
  })
})
