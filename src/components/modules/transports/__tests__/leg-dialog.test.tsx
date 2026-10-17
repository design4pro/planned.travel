// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TransportDialog } from '../leg-dialog'

import type { Catalogue } from '#/lib/i18n'
import type { TransportDayData, TransportData } from '../types'

/**
 * Which thing a save means to do, asserted where the dialog decides it.
 *
 * The repository tests prove that `edit` of a deleted row is refused and `create` is not; they
 * cannot prove the dialog sends the right one, because they pass the intent themselves. Swapping
 * the ternary in `submit()` leaves every one of them green and makes every new transport fail and
 * every edit of a deleted row come back, so the call site is pinned by rendering it.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

// The real module reaches `cloudflare:workers`, and the real `useRouter` needs a router above it.
const save = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('#/server/fns/transports', () => ({
  saveTransportFn: save,
  // Mounted by the connection search tab; none of the states under test calls them.
  saveSearchedConnectionFn: () => Promise.resolve(null),
  searchConnectionsFn: () => Promise.resolve(null),
  searchStationsFn: () => Promise.resolve([]),
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

const TRANSPORT: TransportData = {
  id: 'transport-1',
  mode: 'train',
  status: 'planned',
  title: 'Lisboa to Porto',
  carrier: null,
  serviceNumber: null,
  bookingCode: null,
  seat: null,
  departureDayId: null,
  arrivalDayId: null,
  departureName: null,
  departureCode: null,
  departureDate: null,
  departureTime: null,
  arrivalName: null,
  arrivalCode: null,
  arrivalDate: null,
  arrivalTime: null,
  distanceMetres: null,
  priceMinor: null,
  currency: null,
  notes: null,
  legs: [],
}

const DAY_1: TransportDayData = {
  id: 'day-1',
  dayNumber: 1,
  date: '2026-10-09',
  title: null,
}
const DAY_2: TransportDayData = {
  ...DAY_1,
  id: 'day-2',
  dayNumber: 2,
  date: '2026-10-10',
}

function openDialog(
  transport?: TransportData,
  canSearchConnections = true,
  dated = false,
  days: ReadonlyArray<TransportDayData> = dated ? [DAY_1] : [],
): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <TransportDialog
        tripId="trip-1"
        transport={transport}
        days={days}
        canSearchConnections={canSearchConnections}
        currency="EUR"
        open
        onOpenChange={() => {}}
      />
    </I18nProvider>,
  )
}

/**
 * Submitted as an event rather than by clicking the footer button: it sits outside the `<form>` and
 * reaches it through the `form` attribute, which jsdom associates but does not submit through.
 */
function submitTheForm(): void {
  const form = document.querySelector('form')
  if (form === null) {
    throw new Error('the transport dialog rendered no form')
  }
  fireEvent.submit(form)
}

beforeEach(() => {
  save.mockResolvedValue({ transport: TRANSPORT, legs: [] })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TransportDialog', () => {
  it('saves a new transport with the create intent', async () => {
    openDialog()
    fireEvent.change(screen.getByLabelText(/^Name/u), {
      target: { value: 'Lisboa to Porto' },
    })
    submitTheForm()

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]?.[0].data).toMatchObject({ intent: 'create' })
  })

  it('saves an existing transport with the edit intent and its own id', async () => {
    openDialog(TRANSPORT)
    submitTheForm()

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]?.[0].data).toMatchObject({
      intent: 'edit',
      transportId: TRANSPORT.id,
    })
  })
})

describe('TransportDialog connection search date', () => {
  function searchDate(): string {
    fireEvent.click(
      screen.getByRole('button', { name: /^Search (again|connections)$/u }),
    )
    const input = document.querySelector('input[type="date"]')
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('the connection search rendered no date field')
    }
    return input.value
  }

  it('opens a saved journey on the date of the day it is anchored to', () => {
    openDialog(
      {
        ...TRANSPORT,
        departureDayId: DAY_2.id,
        // Not the anchored day's date: only the anchor can put the field on day 2.
        departureDate: DAY_1.date,
      },
      true,
      true,
      [DAY_1, DAY_2],
    )
    expect(searchDate()).toBe('2026-10-10')
  })

  it('opens a new journey on the first dated day', () => {
    openDialog(undefined, true, true, [DAY_1, DAY_2])
    expect(searchDate()).toBe('2026-10-09')
  })
})

it.each([
  [false, true, false],
  [true, true, true],
  [true, false, false],
])(
  'search permission %s and dated day %s offer search: %s',
  (allowed, dated, offered) => {
    openDialog(undefined, allowed, dated)
    expect(
      screen.queryByRole('button', {
        name: 'Search connections',
      }) !== null,
    ).toBe(offered)
    expect(screen.getByLabelText(/^Name/u)).toBeTruthy()
  },
)
