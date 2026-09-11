import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import {
  BOOK_IMPORTS_KEY,
  BookImportWidget,
  DONE_LINGER_MS,
  POLL_BUDGET_MS,
  POLL_INTERVAL_MS,
  readBookImports,
} from '../import-widget'

import type { Catalogue } from '#/lib/i18n'
import type { BookingImportView } from '#/server/fns/booking-import'

/**
 * The widget is the reason the dialog can be closed, so the three things asserted here are the
 * three ways it can fail a reader: forgetting a job that was registered, polling a queue forever,
 * and taking a failure off the screen before anybody saw it.
 *
 * A fake clock, because the two intervals that matter are 20 and 12 seconds long and a test that
 * waits them out in real time is a test somebody will skip.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}

const stubs = vi.hoisted(() => ({ view: vi.fn(), navigate: vi.fn() }))

vi.mock('#/server/fns/booking-import', () => ({
  getBookingImportFn: stubs.view,
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => stubs.navigate,
}))

function registerOne(): void {
  window.localStorage.setItem(
    BOOK_IMPORTS_KEY,
    JSON.stringify([
      {
        jobId: 'booking-import:trip-1:file-1',
        tripId: 'trip-1',
        filename: 'confirmation.pdf',
      },
    ]),
  )
}

function mount(): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <BookImportWidget />
    </I18nProvider>,
  )
}

/**
 * Advances the clock and lets every promise the tick started settle.
 *
 * Inside `act`, because a state update from a timer callback is scheduled through React's own
 * queue rather than the faked one: without it the timeout fires and the screen still shows what it
 * showed before, which reads exactly like the timeout never having been armed.
 */
async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  window.localStorage.clear()
  stubs.view.mockReset()
  stubs.navigate.mockReset()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the global import widget', () => {
  it('renders nothing at all when no job is registered', () => {
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)

    mount()

    expect(
      document.querySelector('[data-part="book-import-widget"]'),
    ).toBeNull()
    expect(stubs.view).not.toHaveBeenCalled()
  })

  it('picks a job id up out of storage on mount and announces it politely', async () => {
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)
    registerOne()

    mount()
    await tick(POLL_INTERVAL_MS)

    const region = document.querySelector('[data-part="book-import-widget"]')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(screen.getByText('Reading confirmations')).toBeTruthy()
    expect(screen.getByText('Reading “confirmation.pdf”')).toBeTruthy()
  })

  it('stops asking when the budget is spent and offers Check again', async () => {
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)
    registerOne()

    mount()
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)
    const asked = stubs.view.mock.calls.length

    expect(screen.getByText('This is taking longer than expected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()

    // The point of a bounded poll: the queue is not asked again on its own.
    await tick(POLL_INTERVAL_MS * 5)
    expect(stubs.view.mock.calls.length).toBe(asked)
  })

  it('lets a reader take a job that never answered out of the register', async () => {
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)
    registerOne()

    mount()
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)

    // Without this the card is permanent: only a dismissal or a confirm empties the register, and
    // a job whose staged record expired answers `working` for as long as anyone asks.
    screen.getByRole('button', { name: 'Dismiss' }).click()
    await tick(POLL_INTERVAL_MS)

    expect(readBookImports()).toHaveLength(0)
    expect(
      document.querySelector('[data-part="book-import-widget"]'),
    ).toBeNull()
  })

  it('offers the review with a count once a job is ready, then takes itself away', async () => {
    stubs.view.mockResolvedValue({
      status: 'ready',
      staged: { format: 'document', count: 3, written: [], drafts: [] },
    } satisfies BookingImportView)
    registerOne()

    mount()
    await tick(POLL_INTERVAL_MS)

    expect(screen.getByText('3 bookings ready to review')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Review' })).toBeTruthy()

    await tick(DONE_LINGER_MS)

    expect(
      document.querySelector('[data-part="book-import-widget"]'),
    ).toBeNull()
    // Taken off the screen, not out of the register: the staged rows are still there to review.
    expect(readBookImports()).toHaveLength(1)
  })

  it('keeps a failure on screen until a reader takes it away', async () => {
    stubs.view.mockResolvedValue({
      status: 'refused',
      refusal: { code: 'unreadable' },
    } satisfies BookingImportView)
    registerOne()

    mount()
    await tick(POLL_INTERVAL_MS)

    expect(
      screen.getByText('“confirmation.pdf” could not be read'),
    ).toBeTruthy()

    // Well past the linger the done state uses: a failure nobody saw is reported as lost data.
    await tick(DONE_LINGER_MS * 3)
    expect(
      screen.getByText('“confirmation.pdf” could not be read'),
    ).toBeTruthy()

    screen.getByRole('button', { name: 'Dismiss' }).click()
    await tick(POLL_INTERVAL_MS)

    expect(readBookImports()).toHaveLength(0)
  })

  it('takes the reader to the desk that owns the job', async () => {
    stubs.view.mockResolvedValue({
      status: 'ready',
      staged: { format: 'ics', count: 1, written: [], drafts: [] },
    } satisfies BookingImportView)
    registerOne()

    mount()
    await tick(POLL_INTERVAL_MS)
    screen.getByRole('button', { name: 'Review' }).click()

    expect(stubs.navigate).toHaveBeenCalledWith({
      to: '/trips/$tripId/book',
      params: { tripId: 'trip-1' },
      search: { import: 'booking-import:trip-1:file-1' },
    })
  })
})
