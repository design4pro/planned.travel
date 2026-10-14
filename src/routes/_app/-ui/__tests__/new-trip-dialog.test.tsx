import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { NewTripDialog } from '../new-trip-dialog'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/** `createTripFn` reaches `cloudflare:workers`; the test only needs a write that does not settle. */
const server = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
const upload = vi.hoisted(() => ({ upload: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/trip-lifecycle', () => ({
  createTripFn: server.create,
  updateTripFn: server.update,
}))
vi.mock('#/components/modules/files/upload', () => ({
  uploadFile: upload.upload,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
  useNavigate: () => vi.fn(),
}))

afterEach(cleanup)

describe('NewTripDialog', () => {
  it('cannot be dismissed while the trip is being saved', async () => {
    server.create.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <NewTripDialog />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'New trip' }))
    await user.type(await screen.findByLabelText(/Trip name/), 'Lisbon')
    await user.click(screen.getByRole('button', { name: 'Create trip' }))
    expect(server.create).toHaveBeenCalledOnce()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('sends a duration, with no dates, as a day count', async () => {
    server.create.mockReset()
    server.create.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <NewTripDialog />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'New trip' }))
    await user.type(await screen.findByLabelText(/Trip name/), 'Open-ended')
    await user.type(await screen.findByLabelText('Duration in days'), '6')
    await user.click(screen.getByRole('button', { name: 'Create trip' }))

    expect(server.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dayCount: 6,
        startDate: '',
        endDate: '',
        reminderDays: 3,
      }),
    })
  })

  describe('with a cover image', () => {
    const cover = new File(['x'], 'beach.png', { type: 'image/png' })

    beforeEach(() => {
      server.create.mockReset()
      server.update.mockReset()
      upload.upload.mockReset()
      router.invalidate.mockReset()
    })

    async function createWithCover() {
      URL.createObjectURL = vi.fn(() => 'blob:preview')
      URL.revokeObjectURL = vi.fn()
      server.create.mockResolvedValue({ tripId: 'trip-9' })
      const user = userEvent.setup()
      render(
        <I18nProvider locale="en" messages={EN}>
          <NewTripDialog />
        </I18nProvider>,
      )
      await user.click(screen.getByRole('button', { name: 'New trip' }))
      await user.type(await screen.findByLabelText(/Trip name/), 'Lisbon')
      const input = document.querySelector('input[type="file"]')
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('no file input')
      }
      await user.upload(input, cover)
      return user
    }

    it('creates the trip, uploads the image against it, then records it as the cover', async () => {
      upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-1' } })
      server.update.mockResolvedValue(undefined)
      const user = await createWithCover()

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      await waitFor(() => {
        expect(server.update).toHaveBeenCalledWith({
          data: { tripId: 'trip-9', coverFileId: 'file-1' },
        })
      })
      expect(server.create).toHaveBeenCalledOnce()
      expect(upload.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: 'trip-9',
          file: cover,
          kind: 'image',
        }),
      )
      expect(server.create.mock.invocationCallOrder[0]).toBeLessThan(
        upload.upload.mock.invocationCallOrder[0],
      )
    })

    it('keeps the trip and offers a retry when the upload fails, without a second create', async () => {
      upload.upload.mockResolvedValue({ ok: false, code: 'x', message: 'no' })
      const user = await createWithCover()

      await user.click(screen.getByRole('button', { name: 'Create trip' }))

      const alert = await screen.findByText(
        /could not be uploaded as its cover/,
      )
      expect(alert.textContent).toContain('“beach.png”')
      expect(
        screen.getByRole('button', { name: 'Open the trip without a cover' }),
      ).toBeTruthy()

      upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-2' } })
      server.update.mockResolvedValue(undefined)
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      await waitFor(() => {
        expect(server.update).toHaveBeenCalledWith({
          data: { tripId: 'trip-9', coverFileId: 'file-2' },
        })
      })
      expect(server.create).toHaveBeenCalledOnce()
    })

    it('does not upload a stored image twice when only the cover write failed', async () => {
      upload.upload.mockResolvedValue({ ok: true, file: { id: 'file-1' } })
      server.update.mockRejectedValueOnce(new Error('boom'))
      const user = await createWithCover()

      await user.click(screen.getByRole('button', { name: 'Create trip' }))
      await screen.findByRole('button', { name: 'Try again' })

      server.update.mockResolvedValue(undefined)
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      await waitFor(() => {
        expect(server.update).toHaveBeenCalledTimes(2)
      })
      expect(upload.upload).toHaveBeenCalledOnce()
    })
  })
})
