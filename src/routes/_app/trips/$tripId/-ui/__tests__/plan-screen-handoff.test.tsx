// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'
import { expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import type * as RouterModule from '@tanstack/react-router'
import type * as MapModule from '#/components/map'
import {
  board,
  day,
  notes,
  place,
  stop,
  transports,
} from './plan-board-fixtures'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof RouterModule>()),
  useRouter: () => ({ invalidate: vi.fn() }),
}))
vi.mock('#/components/modules/book', () => ({ BookingDialog: () => null }))
vi.mock('../../-server/plan', () => ({}))
vi.mock('../../-server/day-notes', () => ({}))
vi.mock('../../-server/plan-transports', () => ({}))
vi.mock('../use-trip-weather', () => ({
  useTripWeather: () => ({ viewOf: () => null, unit: 'celsius' }),
}))
vi.mock('../planner-map-layer', () => ({
  PlannerMapLayer: () => null,
  usePlannerDrop: () => ({ ready: false, editable: false }),
}))
vi.mock('#/components/map', async (importOriginal) => ({
  ...(await importOriginal<typeof MapModule>()),
  MapCanvas: () => null,
}))

const { PlanScreen } = await import('../plan-screen')

it.each([false, true])(
  'offers only map hand-offs with editable false (archived: %s)',
  async (archived) => {
    const messages = await loadCatalogue('en')
    const payload = board([
      day('d1', 1, [
        stop('s1', 'p1', 0),
        stop('s2', 'p2', 1),
        stop('s3', 'p3', 2),
      ]),
    ])
    render(
      <I18nProvider locale="en" messages={messages}>
        <PlanScreen
          payload={{
            ...payload,
            editable: false,
            archived,
            places: [
              ...payload.places.map((entry) =>
                entry.id === 'p3' ? { ...entry, lat: null, lng: null } : entry,
              ),
              place('idea'),
            ],
            unscheduledIds: ['idea'],
          }}
          notes={notes([], false)}
          transports={transports()}
          tripTitle="Trip"
        />
      </I18nProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Days' }))
    expect(
      screen.getByRole('link', { name: /Directions in Google Maps for Day 1/ }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Add (place|stay)/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Actions for Place p3' }),
    ).toBeNull()
    for (const name of ['p1', 'idea']) {
      if (name === 'idea')
        await userEvent.click(screen.getByRole('tab', { name: 'Places' }))
      const trigger = screen.getByRole('button', {
        name: `Actions for Place ${name}`,
      })
      trigger.focus()
      await userEvent.keyboard('{Enter}')
      const menu = screen.getByRole('menu')
      const links = within(menu).getAllByRole('menuitem')
      expect(links).toHaveLength(2)
      expect(links.every((link) => link.tagName === 'A')).toBe(true)
      expect(
        within(menu).getByRole('menuitem', {
          name: `Open Place ${name} in Google Maps (opens in a new tab)`,
        }),
      ).toBeTruthy()
      expect(
        within(menu).getByRole('menuitem', {
          name: `Open Place ${name} in OpenStreetMap (opens in a new tab)`,
        }),
      ).toBeTruthy()
      await userEvent.keyboard('{Escape}')
    }
  },
  60_000,
)
