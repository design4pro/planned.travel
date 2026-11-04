import '#/components/ui/__tests__/test-env'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Ui from '#/lib/i18n/messages/en/ui'
import type * as AuthClientModule from '#/lib/auth/client'
import { OtherDeviceSessions } from '../other-device-sessions'

const mocks = vi.hoisted(() => ({
  availability: vi.fn(),
  register: vi.fn(),
  settle: vi.fn(),
}))
vi.mock('#/lib/auth/client', async (load) => ({
  ...(await load<typeof AuthClientModule>()),
  otherDeviceAvailability: mocks.availability,
  registerOtherDeviceRevocation: mocks.register,
  settleOtherDeviceRevocation: mocks.settle,
}))
const messages = {
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('ui', Ui),
}
const id = '12345678-1234-4234-8234-123456789abc'

beforeEach(() => {
  mocks.availability
    .mockReset()
    .mockResolvedValue({ available: true, recovery: null })
  mocks.register.mockReset().mockResolvedValue(id)
  mocks.settle.mockReset()
})
afterEach(cleanup)

function mount() {
  return render(
    <I18nProvider locale="en" messages={messages}>
      <OtherDeviceSessions />
    </I18nProvider>,
  )
}
async function open() {
  mount()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sign out other devices' }),
  )
  return screen.findByRole('dialog')
}

describe('other-device session confirmation and recovery', () => {
  it('never submits a destructive request if registration failed', async () => {
    mocks.register.mockRejectedValue(new Error('fixture registration loss'))
    const dialog = await open()
    expect(mocks.register).not.toHaveBeenCalled()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Sign out other devices' }),
    )
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1))
    expect(mocks.settle).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('status').textContent).toContain(
      'made no changes',
    )
    expect(document.activeElement).toBe(within(dialog).getByRole('status'))
  })

  it('reconciles an unknown outcome with status rather than repeating commit', async () => {
    mocks.settle
      .mockResolvedValueOnce({ status: 'unknown', cleanupPending: false })
      .mockResolvedValueOnce({ status: 'committed', cleanupPending: true })
    const dialog = await open()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Sign out other devices' }),
    )
    await waitFor(() => expect(mocks.settle).toHaveBeenCalledTimes(1))
    expect(
      within(dialog).queryByRole('button', { name: 'Sign out other devices' }),
    ).toBeNull()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Check status' }),
    )
    await waitFor(() => expect(mocks.settle).toHaveBeenLastCalledWith(id, null))
    expect(mocks.register).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('status').textContent).toContain(
      'Connections may take longer',
    )
    expect(document.activeElement).toBe(within(dialog).getByRole('status'))
  })

  it('allows leaving a pending operation and reopening it without a second commit', async () => {
    let finish: (value: {
      status: 'unknown'
      cleanupPending: boolean
    }) => void = () => undefined
    mocks.settle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const dialog = await open()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Sign out other devices' }),
    )
    await waitFor(() => expect(mocks.settle).toHaveBeenCalledTimes(1))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Sign out other devices' }),
    )
    const reopened = await screen.findByRole('dialog')
    expect(
      within(reopened)
        .getByRole('button', { name: 'Close' })
        .getAttribute('disabled'),
    ).toBeNull()
    await act(async () => {
      finish({ status: 'unknown', cleanupPending: false })
    })
    expect(
      within(reopened)
        .getByRole('button', { name: 'Check status' })
        .getAttribute('disabled'),
    ).toBeNull()
    expect(mocks.settle).toHaveBeenCalledTimes(1)
    expect(mocks.register).toHaveBeenCalledTimes(1)
  })

  it('restores the non-secret operation id after a reload and offers only status', async () => {
    mocks.availability.mockResolvedValue({
      available: true,
      recovery: { id, status: 'unknown', cleanupPending: false },
    })
    mocks.settle.mockResolvedValue({
      status: 'committed',
      cleanupPending: false,
    })
    const dialog = await open()
    expect(
      within(dialog).queryByRole('button', { name: 'Sign out other devices' }),
    ).toBeNull()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Check status' }),
    )
    await waitFor(() => expect(mocks.settle).toHaveBeenCalledWith(id, null))
    expect(mocks.register).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(mocks.register).not.toHaveBeenCalled()
  })
})
