// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TripCopyDialog } from '../trip-copy-dialog'
import { tripCard } from './fixtures'

import type { Catalogue } from '#/lib/i18n'

/**
 * The shipped English catalogue, not a stub.
 *
 * Every message here is a sentence a reader is meant to recognise, and a stub whose value is its
 * own key passes an assertion that the real catalogue would fail — an unresolved key and a
 * left-standing placeholder both look identical to a pass.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/**
 * `copyTripFn` reaches `cloudflare:workers` through the request scope and `useRouter` needs a
 * router above it — neither has meaning in jsdom, and neither is what these tests are about.
 */
const copyTrip = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/trip-lifecycle', () => ({ copyTripFn: copyTrip }))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

afterEach(() => {
  cleanup()
  copyTrip.mockReset()
  router.invalidate.mockReset()
})

/** The source runs 1–10 April 2026, so a 10-day plan is what a shorter range is measured against. */
const SOURCE = tripCard({ startDate: '2026-04-01', endDate: '2026-04-10' })

const HINT =
  'That is shorter than the original. The extra days’ places move to ideas, and their notes are dropped.'

/** The calendar names a cell `{weekday} {day} {month} {year}` — `ui.calendar.day`. */
function april(day: number): string {
  return format(new Date(2026, 3, day), 'EEEE d MMMM yyyy')
}

function open(onOpenChange: (open: boolean) => void = () => {}): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <TripCopyDialog trip={SOURCE} open onOpenChange={onOpenChange} />
    </I18nProvider>,
  )
}

/**
 * A hand with no pause between its clicks.
 *
 * `delay: null` drops `user-event`'s wait between events. Driving the range picker is five
 * interactions across a popover and two rendered months, and at the default delay that is enough
 * work to overrun the 5 s test timeout whenever the suite is running under load — a flake that says
 * nothing about the dialog.
 */
function hand(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ delay: null })
}

/** Picks a range in the shipped `DateRangePicker`: open it, click one end, click the other. */
async function pick(
  user: ReturnType<typeof userEvent.setup>,
  from: number,
  to: number,
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Dates' }))
  await user.click(screen.getByRole('button', { name: april(from) }))
  await user.click(screen.getByRole('button', { name: april(to) }))
}

/**
 * Submitted as an event rather than by clicking "Copy trip".
 *
 * The footer's button sits outside the `<form>` it submits and reaches it through the `form`
 * attribute, which is how a scrolling dialog body keeps its actions pinned. jsdom implements the
 * association but not the implicit submission it enables.
 */
function submit(): void {
  const form = document.querySelector('form')
  if (form === null) {
    throw new Error('the copy dialog rendered no form')
  }
  form.requestSubmit()
}

describe('TripCopyDialog', () => {
  it('says nothing about a shortened range until the range is shortened', () => {
    open()
    expect(screen.queryByText(HINT)).toBeNull()
    // The boundary, on the other hand, is standing text: it is told before the reader commits.
    expect(
      screen.queryByText(
        'Days, places and notes come across. Bookings, money, files and people do not.',
      ),
    ).not.toBeNull()
  })

  it('names the consequence once the copy runs shorter than the original', async () => {
    const user = hand()
    open()
    await pick(user, 5, 8)

    expect(screen.queryByText(HINT)).not.toBeNull()
  })

  it('stays quiet when the copy runs longer than the original', async () => {
    const user = hand()
    open()
    await pick(user, 1, 20)

    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('clears both ends at once, and copies the trip as an undated template', async () => {
    const user = hand()
    copyTrip.mockResolvedValue({ tripId: 'trip-2', copyPending: true })
    open()

    await user.click(screen.getByRole('button', { name: 'Copy without dates' }))
    // The control withdraws with the range it cleared: there is nothing left to clear.
    expect(
      screen.queryByRole('button', { name: 'Copy without dates' }),
    ).toBeNull()

    submit()
    await vi.waitFor(() => {
      expect(copyTrip).toHaveBeenCalledTimes(1)
    })
    // A half-open range is refused by the schema, so the form never sends one end without the
    // other: clearing sends neither.
    expect(copyTrip.mock.calls[0][0]).toEqual({
      data: { tripId: 'trip-1', title: 'Lisbon in April' },
    })
  })

  it('sends the range the reader chose, as calendar days', async () => {
    const user = hand()
    copyTrip.mockResolvedValue({ tripId: 'trip-2', copyPending: true })
    open()

    await pick(user, 5, 8)
    submit()

    await vi.waitFor(() => {
      expect(copyTrip).toHaveBeenCalledTimes(1)
    })
    expect(copyTrip.mock.calls[0][0]).toEqual({
      data: {
        tripId: 'trip-1',
        title: 'Lisbon in April',
        startDate: '2026-04-05',
        endDate: '2026-04-08',
      },
    })
  })

  it('cannot be dismissed while the copy is in flight', async () => {
    const user = hand()
    // Never settles: the dialog is held in exactly the state this test is about.
    copyTrip.mockReturnValue(new Promise(() => {}))
    const onOpenChange = vi.fn()
    open(onOpenChange)

    submit()
    await vi.waitFor(() => {
      expect(copyTrip).toHaveBeenCalledTimes(1)
    })

    await user.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('refuses a copy with no name, and says which field to fix', async () => {
    const user = hand()
    open()

    await user.clear(screen.getByRole('textbox', { name: /Name the copy/u }))
    expect(screen.queryByText('Give the copy a name.')).not.toBeNull()

    submit()
    expect(copyTrip).not.toHaveBeenCalled()
  })
})
