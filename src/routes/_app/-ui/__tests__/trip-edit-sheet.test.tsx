// The sheet mounts Radix-backed primitives, which need the pointer-capture and scroll stubs jsdom
// does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Pl from '#/lib/i18n/messages/pl/shell'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TripEditSheet } from '../trip-actions'
import { tripCard } from './fixtures'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}
const PL: Catalogue = {
  ...namespaceCatalogue('shell', Pl),
  ...namespaceCatalogue('ui', Ui),
}

const server = vi.hoisted(() => ({ update: vi.fn() }))
const upload = vi.hoisted(() => ({ upload: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/trip-lifecycle', () => ({
  archiveTripFn: vi.fn(),
  copyTripFn: vi.fn(),
  deleteTripFn: vi.fn(),
  restoreTripFn: vi.fn(),
  setTripFavouriteFn: vi.fn(),
  tripDeleteSummaryFn: vi.fn(),
  updateTripFn: server.update,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))
vi.mock('#/components/modules/files/upload', () => ({
  uploadFile: upload.upload,
}))

afterEach(() => {
  cleanup()
  server.update.mockReset()
  upload.upload.mockReset()
})

/** What a server function's refusal looks like once it has crossed the redaction middleware. */
function refusedWith(key: string): Error {
  return new Error(encodePublicFailure({ kind: 'refusal', message: key }))
}

async function save(locale: 'en' | 'pl', messages: Catalogue) {
  const user = userEvent.setup()
  render(
    <I18nProvider locale={locale} messages={messages}>
      <TripEditSheet
        trip={tripCard({ currency: 'EUR' })}
        open
        onOpenChange={vi.fn()}
      />
    </I18nProvider>,
  )
  await user.click(
    screen.getByRole('button', {
      name: locale === 'en' ? 'Save changes' : Pl['editTrip.submit'],
    }),
  )
}

describe('the trip edit sheet when the budget currency cannot change', () => {
  it('shows the refusal in the reader’s language, naming the currency the trip still has', async () => {
    server.update.mockRejectedValue(
      refusedWith('shell.editTrip.currencyLocked'),
    )

    await save('en', EN)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      'This trip already has prices in it, so its budget currency can’t be changed here. Use Change budget currency on the Costs tab, or set it back to EUR to save your other changes.',
    )
    expect(alert.textContent).not.toContain('shell.editTrip')
    expect(alert.textContent).not.toContain('{current}')
  })

  it('reads the same refusal in Polish on a Polish screen', async () => {
    server.update.mockRejectedValue(
      refusedWith('shell.editTrip.currencyLocked'),
    )

    await save('pl', PL)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Ten wyjazd ma już ceny')
    expect(alert.textContent).toContain('Zmień walutę budżetu')
    expect(alert.textContent).toContain('ustaw z powrotem EUR')
  })

  it('keeps the sheet open and the trip unchanged on screen', async () => {
    server.update.mockRejectedValue(
      refusedWith('shell.editTrip.currencyLocked'),
    )

    await save('en', EN)

    await screen.findByRole('alert')
    expect(router.invalidate).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('falls back to the generic message for any other failure', async () => {
    // What the redaction middleware sends for a diagnostic: no text, only a reference.
    server.update.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'ref-1' }),
      ),
    )

    await save('en', EN)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(Shell['editTrip.error'])
    expect(alert.textContent).not.toContain('shell.editTrip')
  })
})

describe('what the trip edit sheet sends', () => {
  it('leaves the budget currency out of a save that did not change it', async () => {
    server.update.mockResolvedValue(undefined)

    await save('en', EN)

    expect(server.update).toHaveBeenCalledTimes(1)
    const { data } = server.update.mock.calls[0][0]
    expect(data).toMatchObject({ tripId: expect.any(String) })
    expect(data).not.toHaveProperty('currency')
  })
})

describe('the trip edit sheet and the cover image', () => {
  const cover = new File(['x'], 'beach.png', { type: 'image/png' })

  async function chooseCover() {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <TripEditSheet
          trip={tripCard({ currency: 'EUR' })}
          open
          onOpenChange={vi.fn()}
        />
      </I18nProvider>,
    )
    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('no file input')
    }
    await user.upload(input, cover)
    return user
  }

  it('uploads the image first and sends its id in the one update', async () => {
    upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-1' } })
    server.update.mockResolvedValue(undefined)
    const user = await chooseCover()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(server.update).toHaveBeenCalledTimes(1)
    })
    expect(server.update.mock.calls[0][0].data).toMatchObject({
      tripId: 'trip-1',
      coverFileId: 'file-1',
    })
    expect(server.update.mock.invocationCallOrder[0]).toBeGreaterThan(
      upload.upload.mock.invocationCallOrder[0],
    )
  })

  it('says why the server refused the image', async () => {
    upload.upload.mockResolvedValue({
      ok: false,
      code: 'quota',
      message: 'The workspace is out of storage.',
    })
    const user = await chooseCover()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('The workspace is out of storage.')
  })

  it('writes nothing when the image fails, and saves the rest on request', async () => {
    upload.upload.mockResolvedValue({ ok: false, code: 'x', message: 'no' })
    server.update.mockResolvedValue(undefined)
    const user = await chooseCover()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText(/could not be uploaded as the cover/)
    expect(server.update).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Save without the new cover' }),
    )
    await waitFor(() => {
      expect(server.update).toHaveBeenCalledTimes(1)
    })
    expect(server.update.mock.calls[0][0].data).not.toHaveProperty(
      'coverFileId',
    )
  })

  it('asks to drop the current cover with a null id', async () => {
    server.update.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <TripEditSheet
          trip={tripCard({ coverImageUrl: '/api/trips/trip-1/cover?v=f' })}
          open
          onOpenChange={vi.fn()}
        />
      </I18nProvider>,
    )
    await user.click(
      screen.getByRole('button', { name: 'Remove the cover image' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(server.update).toHaveBeenCalledTimes(1)
    })
    expect(server.update.mock.calls[0][0].data.coverFileId).toBeNull()
    expect(upload.upload).not.toHaveBeenCalled()
  })
})
