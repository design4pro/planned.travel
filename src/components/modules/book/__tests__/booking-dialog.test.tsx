// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { BookingDialog } from '../booking-dialog'

import type { Catalogue } from '#/lib/i18n'
import type { BookingDayOption, BookingRow } from '#/server/fns/reservations'

/**
 * What the traveller is told when a booking will not save, asserted where they
 * would read it.
 *
 * `booking-form.test.ts` proves that `validateBookingDraft` and `resolve` compose
 * into a sentence; it cannot prove that *the dialog* composes them, because it
 * calls `resolve` itself. That gap is the bug's own shape — the defect was never
 * in the rule, it was in the callsite rendering the rule's answer, and a callsite
 * is only pinned by rendering it. Reverting `errorFor` to
 * `t(error.key, error.params)` turns this red and leaves the unit suite green.
 *
 * The catalogue is the shipped English one, merged across the three namespaces the
 * dialog reads. Stubbing it would defeat the point twice over: an unresolved key
 * and an un-interpolated placeholder both look like a pass when every message is
 * its own key.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/**
 * The real module reaches `cloudflare:workers` through the request scope and the
 * real `useRouter` needs a router above it — neither has meaning in jsdom. A
 * refused draft reaches neither, which is the second assertion below.
 */
const reservations = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
const stays = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('#/server/fns/reservations', () => ({
  createBookingFn: reservations.create,
  updateBookingFn: reservations.update,
}))
vi.mock('#/server/fns/stays', () => ({
  createStayFn: stays.create,
  updateStayFn: stays.update,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

function openDialog(): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <BookingDialog
        tripId="trip-1"
        days={[]}
        currency="EUR"
        open
        onOpenChange={() => {}}
      />
    </I18nProvider>,
  )
}

/**
 * Submitted as an event rather than by clicking "Add booking".
 *
 * The dialog's save button sits in the footer, outside the `<form>` it owns, and
 * reaches it through the `form` attribute — which is how a scrolling dialog body
 * keeps its actions pinned. jsdom implements the association but not the implicit
 * submission it enables, so clicking that button dispatches nothing and every
 * assertion after it would pass against a form that was never submitted. This
 * fires what the button would.
 */
function submitTheForm(): void {
  const form = document.querySelector('form')
  if (form === null) {
    throw new Error('the booking dialog rendered no form')
  }
  fireEvent.submit(form)
}

describe('BookingDialog', () => {
  it('names the missing field in words, not by its catalogue key', () => {
    openDialog()
    submitTheForm()

    expect(screen.getByText('This booking needs a date.')).not.toBeNull()
    // The two ways this sentence has been wrong: the key interpolated verbatim,
    // and the placeholder left standing when nothing is interpolated at all.
    expect(screen.queryByText(/modules\.book\./u)).toBeNull()
    expect(screen.queryByText(/\{field\}/u)).toBeNull()
  })

  it('does not submit a draft it has just refused', () => {
    openDialog()
    submitTheForm()

    expect(reservations.create).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ the stay */

const DAYS: ReadonlyArray<BookingDayOption> = [1, 2, 3, 4, 5].map((n) => ({
  id: `day-${n}`,
  dayNumber: n,
  date: `2026-04-${String(9 + n).padStart(2, '0')}`,
  title: null,
  stops: [],
}))

/** A stay already on the trip: in on day 1, out on day 4. */
const STAY: BookingRow = {
  id: 'booking-1',
  type: 'accommodation',
  status: 'confirmed',
  title: 'Hotel Gracery Shinjuku',
  provider: null,
  location: null,
  confirmationNumber: null,
  url: null,
  startDate: '2026-04-10',
  startTime: '15:00',
  endDate: '2026-04-13',
  endTime: '11:00',
  guests: null,
  priceMinor: null,
  currency: null,
  notes: null,
  dayId: 'day-1',
  assignmentId: null,
  hasLedgerLine: false,
  importedAt: null,
  transportId: null,
  stay: {
    id: 'stay-1',
    startDayId: 'day-1',
    endDayId: 'day-4',
    checkInTime: '15:00',
    checkInEndTime: null,
    checkOutTime: '11:00',
  },
}

function openStay(booking?: BookingRow): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <BookingDialog
        tripId="trip-1"
        booking={booking}
        days={DAYS}
        currency="JPY"
        open
        onOpenChange={() => {}}
      />
    </I18nProvider>,
  )
}

describe('BookingDialog — a stay', () => {
  it('states the nights between the two chosen days', () => {
    openStay(STAY)

    const nights = document.querySelector('[data-part="stay-nights"]')
    expect(nights?.textContent).toBe(
      '3 nights · Day 1 — 2026-04-10 to Day 4 — 2026-04-13',
    )
    // The typed dates and the single-day pin are the other types' dating, not a stay's.
    expect(document.querySelector('input[type="date"]')).toBeNull()
  })

  it('asks for the two days, not a date, before it saves a new stay', () => {
    openStay()
    submitTheForm()

    expect(
      screen.getAllByText('This booking needs a check-in day.').length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('This booking needs a date.')).toBeNull()
    expect(stays.create).not.toHaveBeenCalled()
  })

  it('keeps typed dates for an accommodation booking that has no nights behind it', () => {
    openStay({ ...STAY, stay: null })

    expect(document.querySelector('[data-part="stay-nights"]')).toBeNull()
    expect(document.querySelector('input[type="date"]')).not.toBeNull()
  })

  it('fixes the type of an existing stay', () => {
    openStay(STAY)

    const other = document.querySelector<HTMLButtonElement>(
      '[data-part="type-restaurant"]',
    )
    expect(other?.disabled).toBe(true)
  })

  it('fixes the type once a ledger refusal leaves a saved booking open', async () => {
    reservations.create.mockResolvedValue({
      reservationId: 'booking-2',
      ledger: 'failed',
    })
    openStay()
    const other = document.querySelector<HTMLButtonElement>(
      '[data-part="type-other"]',
    )
    if (other === null) {
      throw new Error('the dialog rendered no "other" type chip')
    }
    fireEvent.click(other)
    fireEvent.change(screen.getByRole('textbox', { name: /name/iu }), {
      target: { value: 'Museum pass' },
    })
    submitTheForm()

    await vi.waitFor(() => expect(reservations.create).toHaveBeenCalledTimes(1))
    // Switching to a stay now would write a second booking through the stay's own create.
    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLButtonElement>(
          '[data-part="type-accommodation"]',
        )?.disabled,
      ).toBe(true),
    )
  })

  it('saves an edited stay through the stay write, naming both rows', async () => {
    stays.update.mockResolvedValue({
      reservationId: 'booking-1',
      stayId: 'stay-1',
      ledger: 'none',
    })
    openStay(STAY)
    submitTheForm()

    await vi.waitFor(() => expect(stays.update).toHaveBeenCalledTimes(1))
    expect(stays.update.mock.calls[0]?.[0]).toMatchObject({
      data: {
        reservationId: 'booking-1',
        stayId: 'stay-1',
        startDayId: 'day-1',
        endDayId: 'day-4',
        checkInTime: '15:00',
        checkOutTime: '11:00',
      },
    })
    expect(reservations.update).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------ opened from a day of the plan */

function openFromDay(dayId: string, booking?: BookingRow): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <BookingDialog
        tripId="trip-1"
        booking={booking}
        days={DAYS}
        currency="JPY"
        initialStayDayId={dayId}
        open
        onOpenChange={() => {}}
      />
    </I18nProvider>,
  )
}

/** What the check-in day's trigger shows — the chosen day, or the placeholder. */
function checkInDay(): string | null | undefined {
  return document.querySelector(
    '[data-part="stay-check-in-day"] [role="combobox"]',
  )?.textContent
}

describe('BookingDialog — opened from a day', () => {
  it('opens a new stay with that day as its first night', () => {
    openFromDay('day-3')

    expect(checkInDay()).toBe('Day 3 — 2026-04-12')
    expect(document.querySelector('input[type="date"]')).toBeNull()
  })

  it('asks for the check-out day and no longer for the check-in day', () => {
    openFromDay('day-3')
    submitTheForm()

    expect(
      screen.getAllByText('This booking needs a check-out day.').length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('This booking needs a check-in day.')).toBeNull()
  })

  it('leaves an existing stay’s own days alone', () => {
    openFromDay('day-3', STAY)

    expect(checkInDay()).toBe('Day 1 — 2026-04-10')
  })

  it('leaves the desk’s new booking empty when no day is named', () => {
    openStay()

    expect(checkInDay()).toBe('Choose a day')
  })
})
