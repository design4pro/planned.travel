import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { toast } from '#/components/ui'
import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { CalendarPanel } from '../calendar-panel'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}

const stubs = vi.hoisted(() => ({ download: vi.fn() }))

// The real module reaches `cloudflare:workers`; this suite is about the panel, not the handler.
vi.mock('../calendar-download', () => ({
  downloadTripCalendar: stubs.download,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

function mount(hasDates = true): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <CalendarPanel tripId="trip-1" hasDates={hasDates} />
    </I18nProvider>,
  )
}

const ACTION = 'Download calendar file (.ics)'

beforeEach(() => {
  stubs.download.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CalendarPanel', () => {
  it('words an unexpected failure from the catalogue, never from the code', async () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => 'toast')
    // A server failure with a reference: the reader gets the panel's own sentence.
    stubs.download.mockRejectedValueOnce(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
      ),
    )
    mount()

    await userEvent.click(screen.getByRole('button', { name: ACTION }))

    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(error.mock.calls[0]?.[1]).toEqual({
      description: 'We couldn’t prepare the file. Try again.',
    })
  })

  it('says what the file is and that it is a snapshot', () => {
    mount()

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeTruthy()
    expect(
      screen.getByText('Take this trip into the calendar app you already use.'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'A snapshot of the trip as it is now. It does not update.',
      ),
    ).toBeTruthy()
    expect(screen.getByText(/Journeys with a time zone show/)).toBeTruthy()
    expect(screen.getByRole('button', { name: ACTION })).toBeTruthy()
  })

  it('warns that an undated trip will show only dated bookings', () => {
    mount(false)

    expect(
      screen.getByText(
        'This trip has no dates yet, so only dated reservations and journeys will appear.',
      ),
    ).toBeTruthy()
  })

  it('stays quiet about dates when the trip has them', () => {
    mount(true)

    expect(screen.queryByText(/no dates yet/)).toBeNull()
  })

  it('asks for the trip’s file once per click', async () => {
    stubs.download.mockResolvedValue({ filename: 'lisbon.ics' })
    mount()

    await userEvent.click(screen.getByRole('button', { name: ACTION }))

    await waitFor(() => expect(stubs.download).toHaveBeenCalledTimes(1))
    expect(stubs.download).toHaveBeenCalledWith({
      tripId: 'trip-1',
      unavailable: 'We couldn’t prepare the file. Try again.',
    })
  })

  it('cannot start a second file while the first is being prepared', async () => {
    let finish: (value: { filename: string }) => void = () => {}
    stubs.download.mockReturnValue(
      new Promise<{ filename: string }>((resolve) => {
        finish = resolve
      }),
    )
    mount()
    const action = screen.getByRole('button', { name: ACTION })

    await userEvent.click(action)
    await waitFor(() => expect(action.hasAttribute('disabled')).toBe(true))
    await userEvent.click(action)

    expect(stubs.download).toHaveBeenCalledTimes(1)
    finish({ filename: 'lisbon.ics' })
    await waitFor(() => expect(action.hasAttribute('disabled')).toBe(false))
  })

  it('tells the reader the file could not be prepared, and lets them try again', async () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => 'toast')
    stubs.download.mockRejectedValueOnce(new Error('boom'))
    mount()

    await userEvent.click(screen.getByRole('button', { name: ACTION }))

    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(error.mock.calls[0]?.[0]).toBe('The download did not start')
    expect(error.mock.calls[0]?.[1]).toEqual({
      description: 'boom',
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: ACTION }).hasAttribute('disabled'),
      ).toBe(false),
    )
  })
})
