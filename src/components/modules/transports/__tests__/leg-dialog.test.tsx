// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import Costs from '#/lib/i18n/messages/en/costs'
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
  ...namespaceCatalogue('costs', Costs),
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
  save.mockReset().mockResolvedValue({ transport: TRANSPORT, legs: [] })
  router.invalidate.mockReset().mockResolvedValue(undefined)
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

  it('passes an authored save refusal to the desk recovery owner', async () => {
    const onWriteError = vi.fn()
    const refusal = new Error('refused')
    save.mockRejectedValueOnce(refusal)
    render(
      <I18nProvider locale="en" messages={EN}>
        <TransportDialog
          tripId="trip-1"
          transport={TRANSPORT}
          days={[]}
          canSearchConnections={false}
          currency="EUR"
          open
          onOpenChange={() => {}}
          onWriteError={onWriteError}
        />
      </I18nProvider>,
    )
    submitTheForm()
    await vi.waitFor(() => expect(onWriteError).toHaveBeenCalledWith(refusal))
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

describe('TransportDialog after the transport was deleted elsewhere', () => {
  const GONE = 'modules.transports.refusal.gone'
  const GENERIC = 'Try again in a moment.'

  function goneRefusal(): Error {
    return new Error(encodePublicFailure({ kind: 'refusal', message: GONE }))
  }

  function dialog(
    open: boolean,
    onOpenChange: (next: boolean) => void,
    onWriteError?: (cause: unknown) => void,
    closeFocusTarget?: () => HTMLElement | null,
    transport = TRANSPORT,
  ) {
    return (
      <I18nProvider locale="en" messages={EN}>
        <TransportDialog
          tripId="trip-1"
          transport={transport}
          days={[DAY_1]}
          canSearchConnections
          currency="EUR"
          open={open}
          onOpenChange={onOpenChange}
          onWriteError={onWriteError}
          closeFocusTarget={closeFocusTarget}
        />
      </I18nProvider>
    )
  }

  async function refusedSave(
    onOpenChange = vi.fn(),
    onWriteError = vi.fn(),
    transport = TRANSPORT,
  ): Promise<ReturnType<typeof render>> {
    save.mockRejectedValueOnce(goneRefusal())
    const view = render(
      dialog(true, onOpenChange, onWriteError, undefined, transport),
    )
    fireEvent.change(screen.getByLabelText(/^Name/u), {
      target: { value: 'Typed after it was deleted' },
    })
    await act(async () => {
      submitTheForm()
    })
    await vi.waitFor(() =>
      expect(document.querySelector('[data-part="transport-gone"]')).not.toBe(
        null,
      ),
    )
    return view
  }

  function saveButton(): HTMLElement {
    return screen.getByRole('button', { name: 'Save transport' })
  }

  it('says the transport no longer exists, in words, and never prints the key or the generic fallback', async () => {
    await refusedSave()

    const alert = document.querySelector('[data-part="transport-gone"]')
    expect(alert?.getAttribute('role')).toBe('alert')
    expect(alert?.textContent).toContain('This transport no longer exists')
    expect(alert?.textContent).toContain(
      'It was deleted while this window was open',
    )
    expect(document.body.textContent).not.toContain(GONE)
    expect(document.body.textContent).not.toContain(GENERIC)
    expect(document.body.textContent).not.toContain('That did not save')
  })

  it('turns Save off, because it could only be refused again, and sends one request', async () => {
    await refusedSave()

    expect(saveButton().getAttribute('disabled')).not.toBeNull()
    submitTheForm()
    await Promise.resolve()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('keeps what was typed, editable', async () => {
    await refusedSave()

    const name = screen.getByLabelText(/^Name/u)
    if (!(name instanceof HTMLInputElement)) {
      throw new Error('the name field is not an input')
    }
    expect(name.value).toBe('Typed after it was deleted')
    expect(name.disabled).toBe(false)
    fireEvent.change(name, { target: { value: 'Still editable' } })
    expect(name.value).toBe('Still editable')
  })

  it('offers Close, which ends the dialog', async () => {
    const onOpenChange = vi.fn()
    await refusedSave(onOpenChange)

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    const closers = screen.getAllByRole('button', { name: 'Close' })
    fireEvent.click(closers[closers.length - 1])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('re-runs the loaders, and keeps the refusal away from the desk recovery owner that would close the dialog', async () => {
    const onWriteError = vi.fn()
    await refusedSave(vi.fn(), onWriteError)

    expect(router.invalidate).toHaveBeenCalled()
    expect(onWriteError).not.toHaveBeenCalled()
  })

  it('hands focus to Close once Save is turned off, whichever way the save was started', async () => {
    await refusedSave()

    // The footer button, not the corner icon: it is the one that reads "Close" as text.
    const footerClose = screen
      .getAllByRole('button', { name: 'Close' })
      .find((button) => button.textContent === 'Close')
    expect(footerClose).toBeDefined()
    await vi.waitFor(() => expect(document.activeElement).toBe(footerClose))
    // Focus lands on it, so what it announces is the alert and not just "Close".
    const alert = document.querySelector('[data-part="transport-gone"]')
    expect(footerClose?.getAttribute('aria-describedby')).toBe(
      alert?.getAttribute('id'),
    )
  })

  it('hands focus to the target the owner names when it closes from the gone state, since the row it was opened from is gone', async () => {
    const target = document.createElement('div')
    target.tabIndex = -1
    document.body.appendChild(target)
    const onOpenChange = vi.fn()
    save.mockRejectedValueOnce(goneRefusal())
    const view = render(dialog(true, onOpenChange, vi.fn(), () => target))
    submitTheForm()
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-part="transport-gone"]'),
      ).not.toBeNull(),
    )

    view.rerender(dialog(false, onOpenChange, vi.fn(), () => target))

    await vi.waitFor(() => expect(document.activeElement).toBe(target))
    target.remove()
  })

  it('leaves the hand-back to the opener alone when the dialog was not in its gone state', async () => {
    const target = document.createElement('div')
    target.tabIndex = -1
    document.body.appendChild(target)
    const view = render(dialog(true, vi.fn(), vi.fn(), () => target))

    view.rerender(dialog(false, vi.fn(), vi.fn(), () => target))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.activeElement).not.toBe(target)
    target.remove()
  })

  it('ignores a refusal that settles after the dialog was closed and opened again', async () => {
    const onOpenChange = vi.fn()
    let refuse: (cause: unknown) => void = () => {}
    save.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        refuse = reject
      }),
    )
    const view = render(dialog(true, onOpenChange))
    submitTheForm()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))

    view.rerender(dialog(false, onOpenChange))
    view.rerender(dialog(true, onOpenChange))
    refuse(goneRefusal())
    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalled())

    // Neither the gone state nor the inline error that refusal set before it was recognised.
    expect(document.querySelector('[data-part="transport-gone"]')).toBeNull()
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(document.body.textContent).not.toContain('deleted while this window')
    expect(saveButton().getAttribute('disabled')).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('starts clean when it is opened again', async () => {
    const onOpenChange = vi.fn()
    const view = await refusedSave(onOpenChange)

    view.rerender(dialog(false, onOpenChange))
    view.rerender(dialog(true, onOpenChange))

    expect(document.querySelector('[data-part="transport-gone"]')).toBeNull()
    expect(saveButton().getAttribute('disabled')).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('shows the same state on the connection search tab', async () => {
    await refusedSave()

    fireEvent.click(screen.getByRole('button', { name: 'Search again' }))

    const alert = document.querySelector('[data-part="transport-gone"]')
    expect(alert?.textContent).toContain('This transport no longer exists')
    expect(document.querySelector('[data-part="connection-search"]')).not.toBe(
      null,
    )
  })

  it.each(['form', 'search'])(
    'recovers the retained draft from the %s tab as a new transport',
    async (tab) => {
      const close = vi.fn()
      const legs = ['Lisboa', 'Coimbra'].map((fromName, position) => ({
        id: `leg-${position}`,
        position,
        fromName,
        fromCode: null,
        fromLat: null,
        fromLng: null,
        fromTimezone: null,
        toName: position === 0 ? 'Coimbra' : 'Porto',
        toCode: null,
        toLat: null,
        toLng: null,
        toTimezone: null,
        serviceNumber: `IC ${position}`,
        platform: null,
        seat: null,
        departureDayId: null,
        arrivalDayId: null,
        departureDate: null,
        departureTime: null,
        arrivalDate: null,
        arrivalTime: null,
      }))
      await refusedSave(close, vi.fn(), { ...TRANSPORT, legs })
      fireEvent.change(screen.getByLabelText(/^Notes/u), {
        target: { value: 'Keep this booking' },
      })
      if (tab === 'search')
        fireEvent.click(screen.getByRole('button', { name: 'Search again' }))
      fireEvent.click(
        screen.getByRole('button', { name: 'Save as a new transport' }),
      )
      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
      const recovered = save.mock.calls[1]?.[0].data
      expect(recovered).toMatchObject({
        intent: 'create',
        title: 'Typed after it was deleted',
        notes: 'Keep this booking',
      })
      expect(recovered.transportId).not.toBe(TRANSPORT.id)
      expect(recovered.stations).toEqual(save.mock.calls[0]?.[0].data.stations)
      expect(recovered.legs).toEqual(save.mock.calls[0]?.[0].data.legs)
      expect(recovered.stations).toHaveLength(3)
      expect(recovered.legs).toHaveLength(2)
      expect(
        screen.getByRole('heading', { name: 'Add a transport' }),
      ).toBeTruthy()
      expect(
        screen.getByRole('button', { name: 'Search connections' }),
      ).toBeTruthy()
      await vi.waitFor(() => expect(close).toHaveBeenCalledWith(false))
    },
  )

  it('blocks duplicate recovery and form saves while pending, then retries creation under the same id', async () => {
    await refusedSave()
    let reject: (cause: unknown) => void = () => {}
    save.mockReturnValueOnce(
      new Promise((_resolve, refuse) => {
        reject = refuse
      }),
    )
    const recover = screen.getByRole('button', {
      name: 'Save as a new transport',
    })
    act(() => {
      fireEvent.click(recover)
      fireEvent.click(recover)
    })
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(
      screen.getByRole('button', { name: /Saving/u }).getAttribute('aria-busy'),
    ).toBe('true')
    submitTheForm()
    expect(save).toHaveBeenCalledTimes(2)
    const id = save.mock.calls[1]?.[0].data.transportId
    await act(async () =>
      reject(
        new Error(
          encodePublicFailure({
            kind: 'unexpected',
            reference: 'test-reference',
          }),
        ),
      ),
    )
    expect(
      screen.queryByRole('button', { name: 'Save as a new transport' }),
    ).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain(
      'Try again in a moment.',
    )
    expect(document.querySelector('[data-part="transport-gone"]')).toBeNull()
    expect(document.activeElement).toBe(screen.getByLabelText(/^Name/u))
    submitTheForm()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3))
    expect(save.mock.calls[2]?.[0].data).toMatchObject({
      intent: 'create',
      transportId: id,
      title: 'Typed after it was deleted',
    })
  })

  it('keeps an invalid recovered draft editable and writes only after correction', async () => {
    await refusedSave()
    fireEvent.change(screen.getByLabelText(/^Name/u), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search again' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Save as a new transport' }),
    )
    expect(save).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('heading', { name: 'Add a transport' }),
    ).toBeTruthy()
    expect(screen.getByLabelText(/^Name/u).getAttribute('aria-invalid')).toBe(
      'true',
    )
    fireEvent.change(screen.getByLabelText(/^Name/u), {
      target: { value: 'Corrected train' },
    })
    submitTheForm()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1]?.[0].data).toMatchObject({
      intent: 'create',
      title: 'Corrected train',
    })
  })

  it('validates the retained chain before writing a recovered draft', async () => {
    await refusedSave()
    fireEvent.click(
      screen.getByRole('button', { name: 'Break this into legs' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save as a new transport' }),
    )
    expect(save).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('heading', { name: 'Add a transport' }),
    ).toBeTruthy()
    expect(
      document.querySelectorAll('input[aria-invalid="true"]').length,
    ).toBeGreaterThan(0)
  })

  it.each(['success', 'failure'])(
    'does not alter a later opening when recovery settles with %s',
    async (outcome) => {
      const close = vi.fn()
      const view = await refusedSave(close)
      let resolve: (value: unknown) => void = () => {}
      let reject: (cause: unknown) => void = () => {}
      save.mockReturnValueOnce(
        new Promise((done, fail) => {
          resolve = done
          reject = fail
        }),
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'Save as a new transport' }),
      )
      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
      view.rerender(dialog(false, close))
      view.rerender(dialog(true, close))
      await act(async () => {
        if (outcome === 'success') resolve({ transport: TRANSPORT, legs: [] })
        else
          reject(
            new Error(
              encodePublicFailure({
                kind: 'unexpected',
                reference: 'late-recovery',
              }),
            ),
          )
      })
      expect(document.querySelector('[role="alert"]')).toBeNull()
      expect(close).not.toHaveBeenCalled()
      expect(
        screen.getByRole('heading', { name: 'Edit this transport' }),
      ).toBeTruthy()
      expect(
        screen.queryByRole('button', { name: 'Save as a new transport' }),
      ).toBeNull()
    },
  )

  it.each([
    'This trip is archived.',
    'This trip no longer exists.',
    'This day no longer exists.',
  ])(
    'leaves %s to the desk recovery owner without offering recovery',
    async (message) => {
      const onWriteError = vi.fn()
      const other = new Error(
        encodePublicFailure({
          kind: 'refusal',
          message,
        }),
      )
      save.mockRejectedValueOnce(other)
      render(dialog(true, vi.fn(), onWriteError))
      submitTheForm()

      await vi.waitFor(() => expect(onWriteError).toHaveBeenCalledWith(other))
      expect(document.querySelector('[data-part="transport-gone"]')).toBeNull()
      expect(saveButton().getAttribute('disabled')).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Save as a new transport' }),
      ).toBeNull()
    },
  )
})

it('keeps the draft and chain across a stale-currency refusal and retries with the refreshed budget currency', async () => {
  const onWriteError = vi.fn()
  const close = vi.fn()
  const refusal = new Error(
    encodePublicFailure({
      kind: 'refusal',
      message: 'costs.refusal.tripCurrencyChanged',
    }),
  )
  save.mockRejectedValueOnce(refusal)
  const transport = {
    ...TRANSPORT,
    currency: 'USD',
    priceMinor: 1500,
    departureName: 'Lisboa',
    arrivalName: 'Porto',
    legs: [],
  }
  const dialog = (currency: string) => (
    <I18nProvider locale="en" messages={EN}>
      <TransportDialog
        tripId="trip-1"
        transport={{ ...transport }}
        days={[]}
        canSearchConnections={false}
        currency={currency}
        open
        onOpenChange={close}
        onWriteError={onWriteError}
      />
    </I18nProvider>
  )
  router.invalidate.mockRejectedValueOnce(new Error('offline'))
  const view = render(dialog('EUR'))
  fireEvent.change(screen.getByLabelText(/^Name/u), {
    target: { value: 'My typed train' },
  })
  fireEvent.change(screen.getByLabelText(/^Notes/u), {
    target: { value: 'Keep my notes' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Break this into legs' }))
  submitTheForm()
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  expect(save.mock.calls[0]?.[0].data).toMatchObject({
    expectedTripCurrency: 'EUR',
    currency: 'USD',
  })
  expect(onWriteError).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(2))
  expect(save).toHaveBeenCalledTimes(1)
  view.rerender(dialog('GBP'))
  await vi.waitFor(() =>
    expect(screen.getByLabelText(/^Name/u).getAttribute('value')).toBe(
      'My typed train',
    ),
  )
  expect((screen.getByLabelText(/^Notes/u) as HTMLTextAreaElement).value).toBe(
    'Keep my notes',
  )
  expect(screen.getByRole('alert').textContent).toContain('GBP')
  submitTheForm()
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1]?.[0].data.stations).toEqual(
    save.mock.calls[0]?.[0].data.stations,
  )
  expect(save.mock.calls[1]?.[0].data.legs).toEqual(
    save.mock.calls[0]?.[0].data.legs,
  )
  expect(save.mock.calls[1]?.[0].data).toMatchObject({
    expectedTripCurrency: 'GBP',
    title: 'My typed train',
    currency: 'USD',
    priceMinor: 1500,
  })
})

it('requires checking a price that followed the old trip currency before retrying', async () => {
  save.mockRejectedValueOnce(
    new Error(
      encodePublicFailure({
        kind: 'refusal',
        message: 'costs.refusal.tripCurrencyChanged',
      }),
    ),
  )
  const dialog = (currency: string) => (
    <I18nProvider locale="en" messages={EN}>
      <TransportDialog
        tripId="trip-1"
        days={[]}
        currency={currency}
        canSearchConnections={false}
        open
        onOpenChange={() => {}}
      />
    </I18nProvider>
  )
  const view = render(dialog('EUR'))
  fireEvent.change(screen.getByLabelText(/^Name/u), {
    target: { value: 'New train' },
  })
  fireEvent.change(screen.getByLabelText(/^Price/u), {
    target: { value: '15' },
  })
  submitTheForm()
  await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalled())
  submitTheForm()
  expect(save).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText(/^Price/u), {
    target: { value: '15.50' },
  })
  submitTheForm()
  expect(save).toHaveBeenCalledTimes(1)
  view.rerender(dialog('GBP'))
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(screen.getByLabelText(/^Price/u)),
  )
  expect((screen.getByLabelText(/^Price/u) as HTMLInputElement).value).toBe(
    '15.50',
  )
  submitTheForm()
  expect(save).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText(/^Price/u), {
    target: { value: '16' },
  })
  submitTheForm()
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1]?.[0].data).toMatchObject({
    expectedTripCurrency: 'GBP',
    currency: 'GBP',
    priceMinor: 1600,
  })
})
