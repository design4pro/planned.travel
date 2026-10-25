// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { toast } from '#/components/ui'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
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
  ...namespaceCatalogue('costs', Costs),
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

/**
 * What a booking write answers with, as the server builds it: the outcome name and the two flags
 * the dialog acts on. The dialog reads the flags; the name stays on the wire for one release.
 */
function written(ledger: string): {
  ledger: string
  ledgerFailed: boolean
  ledgerSplitStale: boolean
} {
  return {
    ledger,
    ledgerFailed: ledger === 'failed',
    ledgerSplitStale: ledger === 'split-stale',
  }
}

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

  it('saves an edited stay through the stay write, naming both rows', async () => {
    stays.update.mockResolvedValue({
      reservationId: 'booking-1',
      stayId: 'stay-1',
      ...written('none'),
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

/* ------------------------------------------- a price change the split could not follow */

describe('BookingDialog — a split that no longer adds up after the save', () => {
  const DINNER: BookingRow = {
    ...STAY,
    id: 'booking-3',
    type: 'restaurant',
    title: 'Dinner at Den',
    stay: null,
    priceMinor: 24_000,
    currency: 'JPY',
    hasLedgerLine: true,
  }

  beforeEach(() => {
    reservations.update.mockClear()
    stays.update.mockClear()
  })

  function openEditing(booking: BookingRow, onOpenChange: () => void): void {
    render(
      <I18nProvider locale="en" messages={EN}>
        <BookingDialog
          tripId="trip-1"
          booking={booking}
          days={DAYS}
          currency="JPY"
          open
          onOpenChange={onOpenChange}
        />
      </I18nProvider>,
    )
  }

  it('says so and stays open instead of closing on a saved booking', async () => {
    reservations.update.mockResolvedValue({
      reservationId: 'booking-3',
      ...written('split-stale'),
    })
    const onOpenChange = vi.fn()
    openEditing(DINNER, onOpenChange)
    submitTheForm()

    expect(
      await screen.findByText('Saved, but the split no longer adds up'),
    ).not.toBeNull()
    expect(screen.getByText(/fix the split\./u)).not.toBeNull()
    // Its own copy, not the refusal's: the line exists, it is the split that needs a person.
    expect(screen.queryByText('Saved, but not added to the costs')).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes from the one button that is left, and offers no second save', async () => {
    reservations.update.mockResolvedValue({
      reservationId: 'booking-3',
      ...written('split-stale'),
    })
    const onOpenChange = vi.fn()
    openEditing(DINNER, onOpenChange)
    submitTheForm()

    const done = await screen.findByRole('button', { name: 'Done' })
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    fireEvent.click(done)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(reservations.update).toHaveBeenCalledTimes(1)
  })

  it('locks the form and moves focus to the notice, so a late edit is not lost to "Done"', async () => {
    reservations.update.mockResolvedValue({
      reservationId: 'booking-3',
      ...written('split-stale'),
    })
    openEditing(DINNER, vi.fn())
    await vi.waitFor(() =>
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(
        true,
      ),
    )
    submitTheForm()

    const notice = (
      await screen.findByText('Saved, but the split no longer adds up')
    ).closest('[role="status"]')
    // The form is inert (no edit can be typed, none is thrown away); the notice is outside it.
    expect(document.querySelector('form')?.hasAttribute('inert')).toBe(true)
    expect(notice?.closest('form')).toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(notice))
  })

  it('says the same after a stay is saved', async () => {
    stays.update.mockResolvedValue({
      reservationId: 'booking-1',
      stayId: 'stay-1',
      ...written('split-stale'),
    })
    const onOpenChange = vi.fn()
    openEditing(STAY, onOpenChange)
    submitTheForm()

    expect(
      await screen.findByText('Saved, but the split no longer adds up'),
    ).not.toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('keeps the notice up on the split flag, not on the outcome name beside it', async () => {
    reservations.update.mockResolvedValue({
      reservationId: 'booking-3',
      ledger: 'updated',
      ledgerFailed: false,
      ledgerSplitStale: true,
    })
    const onOpenChange = vi.fn()
    openEditing(DINNER, onOpenChange)
    submitTheForm()

    expect(
      await screen.findByText('Saved, but the split no longer adds up'),
    ).not.toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes as before when the line was updated', async () => {
    reservations.update.mockResolvedValue({
      reservationId: 'booking-3',
      ...written('updated'),
    })
    const onOpenChange = vi.fn()
    openEditing(DINNER, onOpenChange)
    submitTheForm()

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(
      screen.queryByText('Saved, but the split no longer adds up'),
    ).toBeNull()
  })
})

/* --------------------------------------------------- a cost line the ledger refused */

describe('BookingDialog — a ledger write that was refused', () => {
  const MUSEUM: BookingRow = {
    ...STAY,
    id: 'booking-2',
    type: 'other',
    title: 'Museum pass',
    stay: null,
    priceMinor: 3_000,
    currency: 'JPY',
    hasLedgerLine: false,
  }

  beforeEach(() => {
    for (const fn of [
      reservations.create,
      reservations.update,
      stays.create,
      stays.update,
    ]) {
      fn.mockReset()
    }
  })

  let setDialogOpen: (open: boolean) => void = () => undefined

  /** Controlled like the real parent: closing the dialog unmounts its content, which raises the warning. */
  function mount(
    booking: BookingRow | undefined,
    onOpenChange: (open: boolean) => void,
  ) {
    function Harness({ row }: { readonly row: BookingRow | undefined }) {
      const [open, setOpen] = useState(true)
      setDialogOpen = setOpen
      return (
        <I18nProvider locale="en" messages={EN}>
          <BookingDialog
            tripId="trip-1"
            booking={row}
            days={DAYS}
            currency="JPY"
            open={open}
            onOpenChange={(next) => {
              setOpen(next)
              onOpenChange(next)
            }}
          />
        </I18nProvider>
      )
    }
    const ui = (row: BookingRow | undefined, key: string) => (
      <Harness key={key} row={row} />
    )
    const view = render(ui(booking, 'first'))
    // A remount with the saved row stands for the reader opening it again from the list.
    return {
      reopenOn: (b: BookingRow) => view.rerender(ui(b, 'reopened')),
      /** The same dialog instance, closed and opened again by its parent. */
      setOpen: (next: boolean) => act(() => setDialogOpen(next)),
      unmount: () => view.unmount(),
    }
  }

  function chooseOther(): void {
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
  }

  it('closes on a refused write and warns instead of announcing the booking as added', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    const success = vi.spyOn(toast, 'success').mockReturnValue('toast')
    reservations.create.mockResolvedValue({
      reservationId: 'booking-2',
      ...written('failed'),
    })
    const onOpenChange = vi.fn()
    mount(undefined, onOpenChange)
    chooseOther()
    submitTheForm()

    await vi.waitFor(() => expect(warning).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(reservations.create).toHaveBeenCalledTimes(1)
    // It stays until the reader closes it: it is the only record that the cost line is missing.
    expect(warning).toHaveBeenCalledWith('Saved, but not added to the costs', {
      id: 'book-ledger-refused-booking-2',
      description: 'Open the booking and save it again to add its cost line.',
      duration: Infinity,
      cancel: { label: 'Close', onClick: expect.any(Function) },
    })
    expect(success).not.toHaveBeenCalled()
  })

  it('does the same when an edit of an existing booking is refused', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    const success = vi.spyOn(toast, 'success').mockReturnValue('toast')
    reservations.update.mockResolvedValue({
      reservationId: 'booking-2',
      ...written('failed'),
    })
    const onOpenChange = vi.fn()
    mount(MUSEUM, onOpenChange)
    submitTheForm()

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(warning).toHaveBeenCalledTimes(1)
    expect(success).not.toHaveBeenCalled()
  })

  it('does the same for a stay', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    const success = vi.spyOn(toast, 'success').mockReturnValue('toast')
    stays.update.mockResolvedValue({
      reservationId: 'booking-1',
      stayId: 'stay-1',
      ...written('failed'),
    })
    const onOpenChange = vi.fn()
    mount(STAY, onOpenChange)
    submitTheForm()

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(warning).toHaveBeenCalledTimes(1)
    expect(success).not.toHaveBeenCalled()
  })

  it('acts on the flag, not on the outcome name beside it', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    const success = vi.spyOn(toast, 'success').mockReturnValue('toast')
    reservations.update.mockResolvedValue({
      reservationId: 'booking-2',
      ledger: 'created',
      ledgerFailed: true,
      ledgerSplitStale: false,
    })
    const onOpenChange = vi.fn()
    mount(MUSEUM, onOpenChange)
    submitTheForm()

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(warning).toHaveBeenCalledTimes(1)
    expect(success).not.toHaveBeenCalled()
  })

  it('still announces a booking whose cost line went through', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    const success = vi.spyOn(toast, 'success').mockReturnValue('toast')
    reservations.create.mockResolvedValue({
      reservationId: 'booking-2',
      ...written('created'),
    })
    const onOpenChange = vi.fn()
    mount(undefined, onOpenChange)
    chooseOther()
    submitTheForm()

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(success).toHaveBeenCalledWith('Booking added', {
      description: 'It is on the timeline now.',
    })
    expect(warning).not.toHaveBeenCalled()
  })

  it('takes the warning down when the booking it is about is opened again', () => {
    vi.spyOn(toast, 'warning').mockReturnValue('toast')
    const dismiss = vi.spyOn(toast, 'dismiss').mockReturnValue('toast')
    mount(MUSEUM, vi.fn())

    expect(dismiss).toHaveBeenCalledWith('book-ledger-refused-booking-2')
  })

  it('leaves the warning up when a new booking is opened', () => {
    const dismiss = vi.spyOn(toast, 'dismiss').mockReturnValue('toast')
    mount(undefined, vi.fn())

    expect(dismiss).not.toHaveBeenCalled()
  })

  it('still warns when the reader closed the dialog while the save ran', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    const success = vi.spyOn(toast, 'success').mockReturnValue('toast')
    let refuse: (value: {
      reservationId: string
      ledger: string
      ledgerFailed: boolean
      ledgerSplitStale: boolean
    }) => void = () => undefined
    reservations.create.mockReturnValue(
      new Promise((resolve) => {
        refuse = resolve
      }),
    )
    mount(undefined, vi.fn())
    chooseOther()
    submitTheForm()
    await vi.waitFor(() => expect(reservations.create).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Past the focus scope's own close timer, as a response over the network is.
    await new Promise((resolve) => setTimeout(resolve, 50))

    refuse({ reservationId: 'booking-2', ...written('failed') })

    await vi.waitFor(() => expect(warning).toHaveBeenCalledTimes(1))
    expect(success).not.toHaveBeenCalled()
  })

  it('still warns when the dialog is replaced while the save ran', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    let refuse: (value: {
      reservationId: string
      ledger: string
      ledgerFailed: boolean
      ledgerSplitStale: boolean
    }) => void = () => undefined
    reservations.create.mockReturnValue(
      new Promise((resolve) => {
        refuse = resolve
      }),
    )
    // The first booking on an empty trip swaps the timeline branch, and with it this dialog.
    const dialog = mount(undefined, vi.fn())
    chooseOther()
    submitTheForm()
    await vi.waitFor(() => expect(reservations.create).toHaveBeenCalledTimes(1))
    dialog.unmount()
    await new Promise((resolve) => setTimeout(resolve, 50))

    refuse({ reservationId: 'booking-2', ...written('failed') })

    await vi.waitFor(() => expect(warning).toHaveBeenCalledTimes(1))
  })

  it('warns at once and leaves the dialog alone when it was opened again since the save started', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    let refuse: (value: {
      reservationId: string
      ledger: string
      ledgerFailed: boolean
      ledgerSplitStale: boolean
    }) => void = () => undefined
    reservations.create.mockReturnValue(
      new Promise((resolve) => {
        refuse = resolve
      }),
    )
    const onOpenChange = vi.fn()
    const dialog = mount(undefined, onOpenChange)
    chooseOther()
    submitTheForm()
    await vi.waitFor(() => expect(reservations.create).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    dialog.setOpen(true)
    await screen.findByRole('dialog')
    onOpenChange.mockClear()

    refuse({ reservationId: 'booking-2', ...written('failed') })

    await vi.waitFor(() => expect(warning).toHaveBeenCalledTimes(1))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('takes the warning down when the next save of that booking added its cost line', async () => {
    vi.spyOn(toast, 'warning').mockReturnValue('toast')
    vi.spyOn(toast, 'success').mockReturnValue('toast')
    const dismiss = vi.spyOn(toast, 'dismiss').mockReturnValue('toast')
    reservations.update.mockResolvedValue({
      reservationId: 'booking-2',
      ...written('created'),
    })
    const onOpenChange = vi.fn()
    mount(MUSEUM, onOpenChange)
    dismiss.mockClear()
    submitTheForm()

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(dismiss).toHaveBeenCalledWith('book-ledger-refused-booking-2')
  })

  it('does not close a dialog the reader had already closed when the refusal lands', async () => {
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('toast')
    let refuse: (value: {
      reservationId: string
      ledger: string
      ledgerFailed: boolean
      ledgerSplitStale: boolean
    }) => void = () => undefined
    reservations.create.mockReturnValue(
      new Promise((resolve) => {
        refuse = resolve
      }),
    )
    const onOpenChange = vi.fn()
    mount(undefined, onOpenChange)
    chooseOther()
    submitTheForm()
    await vi.waitFor(() => expect(reservations.create).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    onOpenChange.mockClear()

    refuse({ reservationId: 'booking-2', ...written('failed') })

    await vi.waitFor(() => expect(warning).toHaveBeenCalledTimes(1))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('updates the saved booking when it is reopened, and never creates a second one', async () => {
    vi.spyOn(toast, 'warning').mockReturnValue('toast')
    vi.spyOn(toast, 'success').mockReturnValue('toast')
    reservations.create.mockResolvedValue({
      reservationId: 'booking-2',
      ...written('failed'),
    })
    reservations.update.mockResolvedValue({
      reservationId: 'booking-2',
      ...written('created'),
    })
    const onOpenChange = vi.fn()
    const dialog = mount(undefined, onOpenChange)
    chooseOther()
    submitTheForm()
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))

    // The list reloads and the reader opens the row that is now on the trip.
    dialog.reopenOn(MUSEUM)
    submitTheForm()

    await vi.waitFor(() => expect(reservations.update).toHaveBeenCalledTimes(1))
    expect(reservations.update.mock.calls[0]?.[0]).toMatchObject({
      data: { reservationId: 'booking-2' },
    })
    expect(reservations.create).toHaveBeenCalledTimes(1)
  })

  it('updates the saved stay through the stay write when it is reopened', async () => {
    vi.spyOn(toast, 'warning').mockReturnValue('toast')
    vi.spyOn(toast, 'success').mockReturnValue('toast')
    stays.update
      .mockResolvedValueOnce({
        reservationId: 'booking-1',
        stayId: 'stay-1',
        ...written('failed'),
      })
      .mockResolvedValueOnce({
        reservationId: 'booking-1',
        stayId: 'stay-1',
        ...written('created'),
      })
    const onOpenChange = vi.fn()
    const dialog = mount(STAY, onOpenChange)
    submitTheForm()
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))

    dialog.reopenOn({ ...STAY })
    submitTheForm()

    await vi.waitFor(() => expect(stays.update).toHaveBeenCalledTimes(2))
    expect(stays.update.mock.calls[1]?.[0]).toMatchObject({
      data: { reservationId: 'booking-1', stayId: 'stay-1' },
    })
    expect(stays.create).not.toHaveBeenCalled()
    expect(reservations.create).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------ a trip re-based under an open editor */

describe('BookingDialog — a save made under a currency the trip no longer has', () => {
  const DINNER: BookingRow = {
    ...STAY,
    id: 'booking-3',
    type: 'restaurant',
    title: 'Dinner at Den',
    stay: null,
    priceMinor: 24_000,
    currency: 'JPY',
  }
  const REFUSAL = new Error('costs.refusal.tripCurrencyChanged')

  beforeEach(() => {
    reservations.update.mockReset()
    reservations.create.mockReset()
    stays.update.mockReset()
    stays.create.mockReset()
    router.invalidate.mockReset()
  })

  function mountAt(currency: string, booking: BookingRow = DINNER) {
    const ui = (current: string) => (
      <I18nProvider locale="en" messages={EN}>
        <BookingDialog
          tripId="trip-1"
          booking={booking}
          days={DAYS}
          currency={current}
          open
          onOpenChange={() => {}}
        />
      </I18nProvider>
    )
    const view = render(ui(currency))
    return { refresh: (next: string) => view.rerender(ui(next)) }
  }

  const priceInput = () =>
    document.querySelector<HTMLInputElement>('input[inputmode="decimal"]')

  it('sends the currency the loader returned, on a booking and on a stay', async () => {
    reservations.update.mockResolvedValue({
      reservationId: 'booking-3',
      ...written('updated'),
    })
    stays.update.mockResolvedValue({
      reservationId: 'booking-1',
      stayId: 'stay-1',
      ...written('none'),
    })

    mountAt('JPY')
    submitTheForm()
    await vi.waitFor(() => expect(reservations.update).toHaveBeenCalled())
    cleanup()
    mountAt('JPY', STAY)
    submitTheForm()
    await vi.waitFor(() => expect(stays.update).toHaveBeenCalled())

    expect(reservations.update.mock.calls[0]?.[0]).toMatchObject({
      data: { expectedTripCurrency: 'JPY' },
    })
    expect(stays.update.mock.calls[0]?.[0]).toMatchObject({
      data: { expectedTripCurrency: 'JPY' },
    })
  })

  it('refreshes, names the new currency and keeps what was typed in the currency it is saved in', async () => {
    const error = vi.spyOn(toast, 'error').mockReturnValue('toast')
    reservations.update.mockRejectedValue(REFUSAL)
    const dialog = mountAt('JPY')
    fireEvent.change(priceInput() as HTMLInputElement, {
      target: { value: '31000' },
    })
    submitTheForm()

    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))
    // Until the refreshed currency arrives the reader is told the save did not happen.
    expect(await screen.findByText(/nothing was changed/u)).not.toBeNull()

    dialog.refresh('EUR')

    expect(
      await screen.findByText(/budget currency of this trip is now EUR/u),
    ).not.toBeNull()
    expect(priceInput()?.value).toBe('31000')
    expect(document.body.textContent).toContain('JPY')
    expect(error).not.toHaveBeenCalled()
  })

  it('moves a price that only mirrored the trip to the new currency', async () => {
    reservations.update.mockRejectedValue(REFUSAL)
    const dialog = mountAt('JPY', { ...DINNER, currency: null })
    submitTheForm()
    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))

    dialog.refresh('EUR')

    await screen.findByText(/budget currency of this trip is now EUR/u)
    expect(priceInput()?.value).toBe('24000')
    expect(document.body.textContent).toContain('EUR')
    expect(document.body.textContent).not.toContain('JPY')
  })

  it('does not save again until the price has been looked at, and keeps the booking in its own currency', async () => {
    reservations.update.mockRejectedValueOnce(REFUSAL).mockResolvedValueOnce({
      reservationId: 'booking-3',
      ...written('updated'),
    })
    const dialog = mountAt('JPY')
    submitTheForm()
    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    dialog.refresh('EUR')
    await screen.findByText(/budget currency of this trip is now EUR/u)

    submitTheForm()
    await act(async () => {})
    expect(reservations.update).toHaveBeenCalledTimes(1)

    fireEvent.change(priceInput() as HTMLInputElement, {
      target: { value: '25000' },
    })
    submitTheForm()

    await vi.waitFor(() => expect(reservations.update).toHaveBeenCalledTimes(2))
    expect(reservations.update.mock.calls[1]?.[0]).toMatchObject({
      data: {
        expectedTripCurrency: 'EUR',
        currency: 'JPY',
        priceMinor: 25_000,
      },
    })
  })

  it('answers a stay the same way', async () => {
    stays.update.mockRejectedValue(REFUSAL)
    const dialog = mountAt('JPY', STAY)
    submitTheForm()

    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))
    dialog.refresh('EUR')

    expect(
      await screen.findByText(/budget currency of this trip is now EUR/u),
    ).not.toBeNull()
  })
})
