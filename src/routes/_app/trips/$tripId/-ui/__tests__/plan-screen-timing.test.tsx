// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'
import { expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import type * as RouterModule from '@tanstack/react-router'
import type * as MapModule from '#/components/map'
import { board, day, notes, stop, transports } from './plan-board-fixtures'

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

it('opens the real timing form with the stop name and a Polish day description', async () => {
  const messages = await loadCatalogue('pl')
  const { rerender } = render(
    <I18nProvider locale="pl" messages={messages}>
      <PlanScreen
        payload={board([day('d3', 3, [stop('s1', 'p1', 0)])])}
        notes={notes([])}
        transports={transports()}
        tripTitle="Wycieczka"
      />
    </I18nProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Dni' }))
  await userEvent.click(
    screen.getByRole('button', { name: 'Actions for Place p1' }),
  )
  await userEvent.click(screen.getByRole('menuitem', { name: 'Set a time' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: 'Place p1' })).toBeTruthy()
  expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
  expect(
    document.getElementById(dialog.getAttribute('aria-describedby') ?? '')
      ?.textContent,
  ).toBe('Dzień 3')
  expect(dialog.textContent).not.toMatch(/Day 3|This stop/)

  // A refreshed loader can remove the selected row while its dialog is still open.
  rerender(
    <I18nProvider locale="pl" messages={messages}>
      <PlanScreen
        payload={board([day('d3', 3, [])])}
        notes={notes([])}
        transports={transports()}
        tripTitle="Wycieczka"
      />
    </I18nProvider>,
  )
  expect(
    within(screen.getByRole('dialog')).getByRole('heading', {
      name: 'Ten przystanek',
    }),
  ).toBeTruthy()
  expect(
    document.getElementById(dialog.getAttribute('aria-describedby') ?? '')
      ?.textContent,
  ).toBe('Dzień 1')
  expect(dialog.textContent).not.toMatch(/Day 1|This stop/)
})
