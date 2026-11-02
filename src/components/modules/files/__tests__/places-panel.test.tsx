import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import GermanModules from '#/lib/i18n/messages/de/modules'
import GermanUi from '#/lib/i18n/messages/de/ui'
import { PlacesPanel } from '../places-panel'

const stubs = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock('../places-download', () => ({ downloadTripPlaces: stubs.download }))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))
function mount(hasPlaces = true) {
  render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('modules', Modules),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <PlacesPanel tripId="trip-1" hasPlaces={hasPlaces} />
    </I18nProvider>,
  )
}
beforeEach(() => stubs.download.mockReset())
it('disables an empty trip and explains why', () => {
  mount(false)
  expect(
    screen
      .getByRole('button', { name: 'Download places (.geojson)' })
      .hasAttribute('disabled'),
  ).toBe(true)
  expect(screen.getByRole('status').textContent).toContain(
    'Add places to this trip to download them.',
  )
})
it('supports keyboard download, announces pending and completion, and retains focus', async () => {
  let finish: (value: { filename: string }) => void = () => {}
  stubs.download.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  mount()
  const user = userEvent.setup()
  await user.tab()
  const button = screen.getByRole('button', {
    name: 'Download places (.geojson)',
  })
  expect(document.activeElement).toBe(button)
  await user.keyboard('{Enter}')
  expect(stubs.download).toHaveBeenCalledWith({
    tripId: 'trip-1',
    unavailable: 'We couldn’t prepare the places file. Try again.',
  })
  expect(screen.getByRole('status').textContent).toBe('Preparing places file…')
  await user.keyboard('{Enter}')
  expect(stubs.download).toHaveBeenCalledTimes(1)
  finish({ filename: 'lisbon-places.geojson' })
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'Places file downloaded.',
    ),
  )
  expect(document.activeElement).toBe(button)
})
it('shows an actionable localised error and permits retry', async () => {
  stubs.download.mockRejectedValueOnce(
    new Error('We couldn’t prepare the places file. Try again.'),
  )
  mount()
  await userEvent.click(
    screen.getByRole('button', { name: 'Download places (.geojson)' }),
  )
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Try again.'),
  )
  stubs.download.mockResolvedValueOnce({ filename: 'places.geojson' })
  await userEvent.click(
    screen.getByRole('button', { name: 'Download places (.geojson)' }),
  )
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})

it.each([0, 1, 3])(
  'downloads GPX by keyboard and announces omitted places (%s)',
  async (omitted) => {
    stubs.download.mockResolvedValueOnce({
      filename: 'places.gpx',
      omitted,
      total: 4,
    })
    mount()
    const user = userEvent.setup()
    await user.tab()
    await user.tab()
    const button = screen.getByRole('button', {
      name: 'Download places (.gpx)',
    })
    expect(document.activeElement).toBe(button)
    await user.keyboard('{Enter}')
    expect(stubs.download).toHaveBeenCalledWith({
      tripId: 'trip-1',
      format: 'gpx',
      unavailable: 'We couldn’t prepare the places file. Try again.',
    })
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        `GPX downloaded. Places without valid coordinates omitted: ${omitted}.`,
      ),
    )
    expect(document.activeElement).toBe(button)
  },
)

it('disables GPX for an empty trip too', () => {
  mount(false)
  expect(
    screen
      .getByRole('button', { name: 'Download places (.gpx)' })
      .hasAttribute('disabled'),
  ).toBe(true)
})

it('prevents overlapping formats, shows a GPX error and allows keyboard retry', async () => {
  let reject: (error: Error) => void = () => {}
  stubs.download.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail
    }),
  )
  mount()
  const user = userEvent.setup()
  const button = screen.getByRole('button', { name: 'Download places (.gpx)' })
  await user.click(button)
  expect(screen.getByRole('status').textContent).toBe('Preparing places file…')
  await user.click(
    screen.getByRole('button', { name: 'Download places (.geojson)' }),
  )
  expect(stubs.download).toHaveBeenCalledTimes(1)
  reject(new Error('We couldn’t prepare the places file. Try again.'))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Try again.'),
  )
  stubs.download.mockResolvedValueOnce({ filename: 'places.gpx', omitted: 2 })
  button.focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(document.activeElement).toBe(button)
})

it('announces that every place was omitted and the downloaded GPX has no waypoints', async () => {
  stubs.download.mockResolvedValueOnce({
    filename: 'places.gpx',
    omitted: 3,
    total: 3,
  })
  mount()
  await userEvent.click(
    screen.getByRole('button', { name: 'Download places (.gpx)' }),
  )
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'GPX downloaded without waypoints. All places were omitted because they lack valid coordinates: 3.',
    ),
  )
})

it.each([2000, 1234])(
  'formats German omission counts (%s total)',
  async (total) => {
    stubs.download.mockResolvedValueOnce({
      filename: 'places.gpx',
      omitted: 1234,
      total,
    })
    render(
      <I18nProvider
        locale="de"
        messages={{
          ...namespaceCatalogue('modules', GermanModules),
          ...namespaceCatalogue('ui', GermanUi),
        }}
      >
        <PlacesPanel tripId="trip-1" hasPlaces />
      </I18nProvider>,
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Orte herunterladen (.gpx)' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('1.234'),
    )
  },
)
