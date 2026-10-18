// The desk mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { BookingsTimeline } from '../bookings-timeline'

import type { Catalogue } from '#/lib/i18n'
import type { BookingRow } from '#/server/fns/reservations'

/**
 * What a reader who may not write is shown on the desk (#1026): the bookings and their statuses,
 * and no control that would be refused. An archived trip is the case that matters - an owner and
 * an editor are both readers there - and `canWrite` is the one flag the route hands down for it.
 *
 * The shipped English catalogue, for the reason `booking-dialog.test.tsx` gives: a stubbed one
 * makes an unresolved key look like a pass.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

vi.mock('#/server/fns/reservations', () => ({
  createBookingFn: vi.fn(),
  updateBookingFn: vi.fn(),
  setBookingStatusFn: vi.fn(),
  deleteBookingFn: vi.fn(),
}))
vi.mock('#/server/fns/stays', () => ({
  createStayFn: vi.fn(),
  updateStayFn: vi.fn(),
  deleteStayFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const HOTEL: BookingRow = {
  id: 'booking-1',
  type: 'accommodation',
  status: 'confirmed',
  title: 'Hotel Baixa',
  provider: null,
  location: null,
  confirmationNumber: null,
  url: null,
  startDate: '2026-04-10',
  startTime: null,
  endDate: '2026-04-13',
  endTime: null,
  guests: null,
  priceMinor: null,
  currency: null,
  notes: null,
  dayId: null,
  assignmentId: null,
  hasLedgerLine: false,
  importedAt: null,
  transportId: null,
  stay: null,
}

function mount(bookings: ReadonlyArray<BookingRow>, canWrite: boolean): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <BookingsTimeline
        tripId="trip-1"
        bookings={bookings}
        days={[]}
        currency="EUR"
        maskCodes={false}
        canWrite={canWrite}
        newBookingOpen={false}
        onNewBookingOpenChange={() => {}}
      />
    </I18nProvider>,
  )
}

describe('BookingsTimeline', () => {
  it('draws the status and the actions of a booking for a reader who may write', () => {
    mount([HOTEL], true)

    expect(screen.getByText('Hotel Baixa')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: /Status of Hotel Baixa/u }),
    ).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Actions for Hotel Baixa' }),
    ).not.toBeNull()
  })

  it('draws the booking and its status, and no control, for a reader who may not', () => {
    mount([HOTEL], false)

    expect(screen.getByText('Hotel Baixa')).not.toBeNull()
    expect(screen.getByText('Confirmed')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Status of/u })).toBeNull()
    expect(screen.queryByRole('button', { name: /Actions for/u })).toBeNull()
  })

  it('offers the first booking on an empty desk only to a reader who may write', () => {
    mount([], true)
    expect(
      screen.getByRole('button', { name: 'Add the first booking' }),
    ).not.toBeNull()
  })

  it('offers nothing on an empty desk to a reader who may not', () => {
    mount([], false)

    expect(
      screen.queryByRole('button', { name: 'Add the first booking' }),
    ).toBeNull()
  })
})
