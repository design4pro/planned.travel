import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
})
