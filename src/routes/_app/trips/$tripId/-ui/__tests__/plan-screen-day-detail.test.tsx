// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'
import { expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { MEDIA_LG_UP } from '#/lib/breakpoints'
import type * as RouterModule from '@tanstack/react-router'
import type * as MapModule from '#/components/map'
import { board, day, notes, stop, transports } from './plan-board-fixtures'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof RouterModule>()),
  useRouter: () => ({ invalidate: vi.fn() }),
}))
vi.mock('#/server/fns/reservations', () => ({
  loadBookingDeskFn: vi.fn().mockResolvedValue({ found: true, bookings: [] }),
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

const messages = await loadCatalogue('en')
const initial = board([day('d1', 1, [stop('s1', 'p1', 0)]), day('d2', 2, [])])
function setup(initialPayload = initial) {
  const ui = (payload = initialPayload) => (
    <I18nProvider locale="en" messages={messages}>
      <PlanScreen
        payload={payload}
        notes={notes([])}
        transports={transports()}
        tripTitle="Trip"
      />
    </I18nProvider>
  )
  const view = render(ui())
  return {
    ...view,
    update: (payload: typeof initial) => view.rerender(ui(payload)),
  }
}
async function openDay(id = 'd1') {
  const days = screen.queryByRole('button', { name: 'Days' })
  if (days) await userEvent.click(days)
  const trigger = document.querySelector<HTMLElement>(
    `[data-planner-day="${id}"] [data-planner-day-header]`,
  )
  if (!trigger) throw new Error('Day header missing')
  await userEvent.click(trigger)
  const heading = await screen.findByRole('heading', {
    level: 2,
    name: /Day [12] · Day [12]/,
  })
  await waitFor(() => expect(document.activeElement).toBe(heading))
  return heading
}
it('opens from a Day, minimises and reactivates, and Escape on the map does not close it', async () => {
  setup()
  await openDay()
  await userEvent.click(
    screen.getByRole('button', { name: 'Minimise day details' }),
  )
  expect(screen.queryByText('No notes for this day')).toBeNull()
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Expand day details' }),
    ),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Expand day details' }),
  )
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Day 1 · Day 1' }),
    ),
  )
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Close day details' })).toBeTruthy()
  await userEvent.click(
    screen.getByRole('button', { name: 'Close day details' }),
  )
  expect(screen.queryByRole('button', { name: 'Close day details' })).toBeNull()
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { level: 1, name: 'Trip' }),
  )
})
it('only an authoritative board removal closes the Day and focuses the itinerary heading', async () => {
  const view = setup()
  await openDay()
  await act(async () => view.update(board([day('d2', 2, [])])))
  expect(screen.queryByRole('button', { name: 'Close day details' })).toBeNull()
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { level: 1, name: 'Trip' }),
  )
})
it('does not move outside focus when a Day disappears', async () => {
  const view = setup()
  await openDay()
  const title = screen.getByRole('heading', { level: 1, name: 'Trip' })
  title.focus()
  await act(async () => view.update(board([day('d2', 2, [])])))
  expect(document.activeElement).toBe(title)
})
it('a Place activation replaces Day details and hover cannot open them', async () => {
  setup()
  await openDay()
  await userEvent.click(screen.getByRole('button', { name: 'Days' }))
  const row = screen
    .getByRole('button', { name: /^Place p1,/ })
    .closest('[data-planner-place]')
  if (!row) throw new Error('Place row missing')
  fireEvent.mouseEnter(row)
  expect(document.querySelector('[data-day-detail]')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: /^Place p1,/ }))
  expect(screen.queryByRole('button', { name: 'Close day details' })).toBeNull()
  fireEvent.mouseEnter(row)
  expect(document.querySelector('[data-day-detail]')).toBeNull()
})

it.each(['unlocated', 'filtered'])(
  'reads an %s Place independently of map markers and replaces it with Day',
  async (kind) => {
    const payload =
      kind === 'unlocated'
        ? {
            ...initial,
            places: initial.places.map((place) => ({
              ...place,
              lat: null,
              lng: null,
              address: 'Visible address',
            })),
          }
        : initial
    setup(payload)
    if (kind === 'filtered') {
      await userEvent.click(screen.getByRole('button', { name: 'Places' }))
      await userEvent.type(
        screen.getByRole('searchbox', { name: "Search this trip's places" }),
        'no matching place',
      )
      await userEvent.keyboard('{Escape}')
    }
    await openDay()
    await userEvent.click(screen.getByRole('button', { name: 'Days' }))
    await userEvent.click(screen.getByRole('button', { name: /^Place p1,/ }))
    const detail = await screen.findByRole('region', {
      name: 'Place p1',
    })
    expect(document.querySelector('[data-day-detail]')).toBeNull()
    if (kind === 'unlocated')
      expect(detail.textContent).toContain('Visible address')
    const outside = screen.getByRole('heading', { level: 1, name: 'Trip' })
    outside.focus()
    fireEvent.mouseLeave(detail)
    expect(screen.getByRole('region', { name: 'Place p1' })).toBe(detail)
    expect(document.activeElement).toBe(outside)
    await openDay()
    expect(screen.queryByRole('region', { name: 'Place p1' })).toBeNull()
  },
)

it('lets keyboard readers enter Place content and dismiss only from inside the detail', async () => {
  setup()
  await openDay()
  await userEvent.click(screen.getByRole('button', { name: 'Days' }))
  await userEvent.click(screen.getByRole('button', { name: /^Place p1,/ }))
  const detail = await screen.findByRole('region', { name: 'Place p1' })
  const title = screen.getByRole('heading', { level: 1, name: 'Trip' })
  title.focus()
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('region', { name: 'Place p1' })).toBe(detail)
  const body = within(detail).getByRole('group', { name: 'Place p1' })
  expect(body.tabIndex).toBe(0)
  body.focus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('region', { name: 'Place p1' })).toBeNull()
  expect(document.activeElement).toBe(title)
})

it('restores the actual Day header when pointer activation did not focus it', async () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: query === MEDIA_LG_UP,
  }))
  setup()
  const header = document.querySelector<HTMLElement>(
    '[data-planner-day="d1"] [data-planner-day-header]',
  )
  if (!header) throw new Error('Day header missing')
  fireEvent.click(header)
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Day 1 · Day 1' }),
    ),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Close day details' }),
  )
  expect(document.activeElement).toBe(header)
})

it('keeps Days and Places in a compact Day panel instead of a second bottom bar', async () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: query.includes('height'),
  }))
  setup()
  await openDay()
  const panel = screen.getByRole('region', { name: 'Day 1 · Day 1' })
  expect(within(panel).getByRole('button', { name: 'Days' })).toBeTruthy()
  expect(within(panel).getByRole('button', { name: 'Places' })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: 'Days' })).toHaveLength(1)
  await userEvent.click(
    screen.getByRole('button', { name: 'Minimise day details' }),
  )
  expect(within(panel).getByRole('button', { name: 'Days' })).toBeTruthy()
  await userEvent.click(
    screen.getByRole('button', { name: 'Close day details' }),
  )
  expect(screen.getByRole('button', { name: 'Days' })).toBeTruthy()
})
