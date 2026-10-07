import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import {
  BookImportWidget,
  DONE_LINGER_MS,
  POLL_BUDGET_MS,
  POLL_INTERVAL_MS,
  bookImportsKey,
  bookImportsOwner,
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

/** The account every job in this file belongs to — the register is keyed by it. */
const USER = 'user-1'

function registerOne(delayMs?: number): void {
  window.localStorage.setItem(
    bookImportsKey(USER),
    JSON.stringify([
      {
        jobId: 'booking-import:trip-1:file-1',
        tripId: 'trip-1',
        filename: 'confirmation.pdf',
        ...(delayMs === undefined ? {} : { delayMs }),
      },
    ]),
  )
}

function mount(): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <BookImportWidget userId={USER} />
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

  /*
   * The widget is mounted in the authenticated shell, so whatever this file imports statically is in
   * the bundle of every screen. A static import of the server function it polls put the function's
   * schema graph there too (#483): a large share of the shell's JavaScript, for a component that
   * renders nothing until a job is registered. Types are erased, so `import type` is fine.
   */
  it('reaches the server only through a dynamic import, so the shell does not bundle it', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'import-widget.tsx'),
      'utf8',
    )

    expect(
      source.match(/^import\s+(?!type\b)[^']*from\s+'#\/server\//gm),
    ).toBeNull()
    expect(source).toContain("import('#/server/fns/booking-import')")
  })

  it('asks the server about a registered job with its trip and job ids', async () => {
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)
    registerOne()

    mount()
    await tick(POLL_INTERVAL_MS)

    expect(stubs.view).toHaveBeenCalledWith({
      data: { tripId: 'trip-1', jobId: 'booking-import:trip-1:file-1' },
    })
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

  it('waits out the queue’s stagger before calling a later file in a drop stalled', async () => {
    // The regression this guards: the queue is told to sit on file *n* for `n * 20s`, so a budget
    // counted from the drop marked every file but the first stalled at twenty seconds — on every
    // multi-file drop, which is the feature's headline case.
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)
    const stagger = 40_000
    registerOne(stagger)

    mount()
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)

    // Still being read, because by the queue's own clock it has not started yet.
    expect(screen.getByText('Reading confirmations')).toBeTruthy()
    expect(screen.queryByText('This is taking longer than expected')).toBeNull()

    await tick(stagger)

    expect(screen.getByText('This is taking longer than expected')).toBeTruthy()
  })

  /*
   * The register is per account, not per browser.
   *
   * One global key was enough while the register was only ever read by whoever wrote it, and the
   * widget is mounted in the authenticated shell where that does not hold: an entry leaves the
   * register only on a Dismiss click or a fully successful confirm, never on sign-out. On a shared
   * browser that put the previous account's dropped filename — a hotel, a city — in the next
   * reader's shell, behind a Review link pointing at somebody else's trip.
   */
  it('never shows one account the file another account dropped', async () => {
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)
    registerOne()

    render(
      <I18nProvider locale="en" messages={EN}>
        <BookImportWidget userId="user-2" />
      </I18nProvider>,
    )
    await tick(POLL_INTERVAL_MS)

    expect(screen.queryByText(/confirmation\.pdf/)).toBeNull()
    expect(
      document.querySelector('[data-part="book-import-widget"]'),
    ).toBeNull()
    // Nothing was asked for either: the other account's job id never reached the server.
    expect(stubs.view).not.toHaveBeenCalled()
    // And the register it could not see is still intact for the account that owns it.
    expect(readBookImports(USER)).toHaveLength(1)
  })

  /**
   * ...and per workspace. A job is staged against one workspace's trip and refused from any other,
   * so the same account in another workspace must neither see it nor be able to Dismiss it.
   */
  it('never shows one workspace the file the same account dropped in another', async () => {
    stubs.view.mockResolvedValue({
      status: 'working',
    } satisfies BookingImportView)
    const inFirst = bookImportsOwner(USER, 'org_a')
    const inSecond = bookImportsOwner(USER, 'org_b')
    expect(inSecond).not.toBe(inFirst)
    window.localStorage.setItem(
      bookImportsKey(inFirst),
      JSON.stringify([
        {
          jobId: 'booking-import:trip-1:file-1',
          tripId: 'trip-1',
          filename: 'confirmation.pdf',
        },
      ]),
    )

    render(
      <I18nProvider locale="en" messages={EN}>
        <BookImportWidget userId={inSecond} />
      </I18nProvider>,
    )
    await tick(POLL_INTERVAL_MS)

    expect(screen.queryByText(/confirmation\.pdf/)).toBeNull()
    expect(stubs.view).not.toHaveBeenCalled()
    expect(readBookImports(inFirst)).toHaveLength(1)
  })

  it('stops asking when every call is rejected, rather than polling a dead job forever', async () => {
    // Offline, an expired session, a trip that was deleted: `getBookingImportFn` rejects on every
    // tick. Treating that as “still working” pinned the job there for good — and because the
    // register outlives the page, that is a card with no button on it on every screen, permanently.
    stubs.view.mockRejectedValue(new Error('offline'))
    registerOne()

    mount()
    await tick(POLL_BUDGET_MS + POLL_INTERVAL_MS)

    expect(screen.getByText('This is taking longer than expected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()

    screen.getByRole('button', { name: 'Dismiss' }).click()
    await tick(POLL_INTERVAL_MS)

    expect(readBookImports(USER)).toHaveLength(0)
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

    expect(readBookImports(USER)).toHaveLength(0)
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
    expect(readBookImports(USER)).toHaveLength(1)
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

    expect(readBookImports(USER)).toHaveLength(0)
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
