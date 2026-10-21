import '#/components/ui/__tests__/test-env'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { encodePublicFailure } from '#/lib/errors'
import { TransportsTimeline } from '../transports-timeline'
import type { TransportData } from '../types'

const recovery = vi.hoisted(() => ({ load: vi.fn(), invalidate: vi.fn() }))
vi.mock('#/server/fns/transports', () => ({
  loadTransportDeskFn: recovery.load,
  deleteTransportFn: vi.fn(),
  setTransportStatusFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: recovery.invalidate }),
}))
// A mounted writer dialog must disappear when capability changes, even if it was already open.
vi.mock('../leg-dialog', () => ({
  TransportDialog: ({
    open,
    onWriteError,
  }: {
    open: boolean
    onWriteError?: (cause: unknown) => void
  }) =>
    open ? (
      <div role="dialog">
        Writer dialog
        <button
          onClick={() =>
            onWriteError?.(
              new Error(
                encodePublicFailure({ kind: 'refusal', message: 'Archived' }),
              ),
            )
          }
        >
          Refuse save
        </button>
      </div>
    ) : null,
}))
beforeEach(() => {
  recovery.load.mockReset()
  recovery.invalidate.mockReset()
  recovery.invalidate.mockResolvedValue(undefined)
})
afterEach(cleanup)
const messages = await loadCatalogue('en')
const transport: TransportData = {
  id: 'train',
  title: 'Osaka to Tokyo',
  mode: 'train',
  status: 'confirmed',
  carrier: null,
  serviceNumber: null,
  bookingCode: null,
  seat: null,
  departureDayId: null,
  arrivalDayId: null,
  departureName: 'Osaka',
  departureCode: null,
  departureDate: null,
  departureTime: null,
  arrivalName: 'Tokyo',
  arrivalCode: null,
  arrivalDate: null,
  arrivalTime: null,
  distanceMetres: null,
  priceMinor: null,
  currency: null,
  notes: null,
  legs: [],
}

function timeline(canWrite: boolean, isArchived: boolean, empty = false) {
  return (
    <I18nProvider locale="en" messages={messages}>
      <TransportsTimeline
        tripId="trip"
        transports={empty ? [] : [transport]}
        days={[]}
        currency="JPY"
        maskCodes={false}
        canSearchConnections={true}
        canWrite={canWrite}
        isArchived={isArchived}
        newTransportOpen={true}
        onNewTransportOpenChange={vi.fn()}
      />
    </I18nProvider>
  )
}

it.each([false, true])(
  'archived timeline preserves reading and removes writers (empty: %s)',
  (empty) => {
    render(timeline(false, true, empty))
    expect(
      screen.getByText(
        'This trip is archived. Restore it to change transports.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    if (!empty) {
      expect(screen.getByText('Osaka to Tokyo')).toBeTruthy()
      expect(screen.getByText('Confirmed')).toBeTruthy()
    }
  },
)

it('offers viewers no writer controls or archive notice', () => {
  render(timeline(false, false))
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByText(/Restore it to change transports/)).toBeNull()
})

it('removes an already-open writer dialog when the trip becomes archived', () => {
  const view = render(timeline(true, false))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  view.rerender(timeline(false, true))
  expect(document.activeElement?.textContent).toContain(
    'Restore it to change transports',
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('refreshes capability after refusal and focuses restore guidance without reopening the editor', async () => {
  recovery.load.mockResolvedValue({ canWrite: false, isArchived: true })
  render(timeline(true, false))
  fireEvent.click(screen.getByRole('button', { name: 'Refuse save' }))
  await waitFor(() =>
    expect(recovery.load).toHaveBeenCalledWith({ data: { tripId: 'trip' } }),
  )
  await waitFor(() => expect(recovery.invalidate).toHaveBeenCalled())
  await waitFor(() =>
    expect(document.activeElement?.textContent).toContain(
      'Restore it to change transports',
    ),
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('blocks further writes after a failed refresh and retries only the read with usable focus', async () => {
  recovery.load
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ canWrite: false, isArchived: true })
  render(timeline(true, false))
  fireEvent.click(screen.getByRole('button', { name: 'Refuse save' }))
  const retry = await screen.findByRole('button', { name: 'Try again' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getAllByRole('button')).toEqual([retry])
  await waitFor(() =>
    expect(document.activeElement?.textContent).toContain(
      'could not be refreshed',
    ),
  )
  fireEvent.click(retry)
  await waitFor(() => expect(recovery.load).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(document.activeElement?.textContent).toContain(
      'Restore it to change transports',
    ),
  )
  expect(screen.queryByRole('button')).toBeNull()
})
