import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Settings from '#/lib/i18n/messages/en/settings'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { NewCollectionDialog } from '../create-dialogs'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/** The server functions reach `cloudflare:workers`; the test only needs a write that does not settle. */
const server = vi.hoisted(() => ({ create: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/library', () => ({
  createCollectionFn: server.create,
  createJourneyFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
  useNavigate: () => vi.fn(),
}))

afterEach(cleanup)

describe('NewCollectionDialog', () => {
  it('offers no choice of who can see the collection', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <NewCollectionDialog />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'New collection' }))
    await screen.findByRole('dialog')

    expect(screen.queryByText(/Who can see it/)).toBeNull()
    expect(screen.queryByText('Only me')).toBeNull()
    expect(screen.queryByText('Anyone with the link')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('creates the collection without a visibility, so the workspace default applies', async () => {
    server.create.mockReset()
    server.create.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en" messages={EN}>
        <NewCollectionDialog />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'New collection' }))
    await user.type(await screen.findByLabelText(/Name/), 'Someday')
    await user.click(screen.getByRole('button', { name: 'Create collection' }))

    expect(server.create).toHaveBeenCalledOnce()
    const [call] = server.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ]
    expect(call.data).toMatchObject({ name: 'Someday' })
    expect(call.data).not.toHaveProperty('visibility')
  })
})
