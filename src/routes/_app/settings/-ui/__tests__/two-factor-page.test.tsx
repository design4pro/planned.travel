import '#/components/ui/__tests__/test-env'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import Auth from '#/lib/i18n/messages/en/auth'
import { TwoFactorSettings } from '../two-factor-page'
import type * as AuthClientModule from '#/lib/auth/client'

const mocks = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  availability: vi.fn(),
  register: vi.fn(),
  prepare: vi.fn(),
  commit: vi.fn(),
  cancel: vi.fn(),
  status: vi.fn(),
  invalidate: vi.fn(),
  blocker: { status: 'idle', proceed: vi.fn(), reset: vi.fn() },
  blockOptions: vi.fn(),
}))
vi.mock('#/lib/auth/client', async (load) => ({
  ...(await load<typeof AuthClientModule>()),
  authClient: {
    listAccounts: mocks.listAccounts,
    getSession: mocks.getSession,
    signOut: mocks.signOut,
  },
  factorAvailability: mocks.availability,
  registerFactorOperation: mocks.register,
  prepareFactor: mocks.prepare,
  commitFactorOperation: mocks.commit,
  cancelFactorOperation: mocks.cancel,
  factorOperationStatus: mocks.status,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: mocks.invalidate }),
  useBlocker: (options: unknown) => {
    mocks.blockOptions(options)
    return mocks.blocker
  },
}))
const messages = {
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('ui', Ui),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('auth', Auth),
}
const codes = Array.from({ length: 10 }, (_, i) => `abcde-${i}2345`)
const registration = { id: 'operation', intent: 'intent', operation: 'enable' }
const committed = {
  status: 'committed',
  enabled: true,
  operation: 'enable',
  cleanupPending: false,
  backupCodes: codes,
}
function page(on = false) {
  return (
    <I18nProvider locale="en" messages={messages}>
      <TwoFactorSettings twoFactorEnabled={on} />
    </I18nProvider>
  )
}
function failure(code: string | null, status: number, retryAt?: number) {
  return { authFailure: { code, status, message: '', retryAt } }
}
async function start() {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Your password'), 'my-password')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return user
}
async function confirm() {
  const user = await start()
  await user.click(
    await screen.findByRole('button', { name: 'I have added it' }),
  )
  await user.type(screen.getByLabelText('Code from the app'), '123456')
  await user.click(screen.getByRole('button', { name: 'Turn on two-factor' }))
  return user
}
async function dialog(action = 'Turn off two-factor') {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: action }))
  await user.type(screen.getByLabelText('Your password'), 'my-password')
  await user.type(screen.getByLabelText('Code from the app'), '123456')
  return user
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.blocker.status = 'idle'
  mocks.listAccounts.mockResolvedValue({ data: [{ providerId: 'credential' }] })
  mocks.getSession.mockResolvedValue({
    data: { user: { twoFactorEnabled: true } },
  })
  mocks.availability.mockResolvedValue({ available: true, recovery: null })
  mocks.register.mockImplementation((operation: string, intent: string) =>
    Promise.resolve({ ...registration, operation, intent }),
  )
  mocks.prepare.mockResolvedValue({
    proposalId: 'proposal',
    expiresAt: Date.now() + 300000,
    totpURI: 'otpauth://totp/test?secret=ABCDEFGH2345',
  })
  mocks.commit.mockResolvedValue(committed)
  mocks.cancel.mockResolvedValue({ status: 'refused' })
  mocks.status.mockResolvedValue({ ...committed, backupCodes: undefined })
  mocks.invalidate.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
describe('factor lifecycle', () => {
  it('only discovers availability and credential capability on mount', async () => {
    render(page())
    await screen.findByLabelText('Your password')
    expect(mocks.listAccounts).toHaveBeenCalledOnce()
    expect(mocks.availability).toHaveBeenCalledOnce()
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(mocks.commit).not.toHaveBeenCalled()
  })
  it('registers before preparing, only reveals committed codes and retains them across loader refresh until acknowledged', async () => {
    const view = render(page())
    const user = await start()
    expect(mocks.register.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.prepare.mock.invocationCallOrder[0],
    )
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'enable' }),
      'my-password',
    )
    expect(screen.queryByText(codes[0])).toBeNull()
    expect(screen.queryByLabelText(/trust/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'I have added it' }))
    await user.type(screen.getByLabelText('Code from the app'), '123456')
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor' }))
    const heading = await screen.findByRole('heading', {
      name: 'Your backup codes',
    })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    expect(mocks.commit).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'enable' }),
      { proposalId: 'proposal', code: '123456' },
    )
    expect(heading.closest('[data-sentry-block]')).not.toBeNull()
    const done = screen.getByRole('button', { name: 'Done' })
    expect(done.getAttribute('aria-disabled')).toBe('true')
    expect(done.getAttribute('aria-describedby')).toBeTruthy()
    await user.click(done)
    expect(screen.getByText(codes[0])).toBeTruthy()
    view.rerender(page(true))
    expect(screen.getByText(codes[0])).toBeTruthy()
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I have stored these backup codes',
      }),
    )
    await user.click(done)
    expect(screen.queryByText(codes[0])).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Two-factor is on' }),
      ),
    )
  })
  it('shows a masked LTR proposal key and cancels before starting over', async () => {
    render(page())
    const user = await start()
    const heading = await screen.findByRole('heading', {
      name: 'Add it to your authenticator',
    })
    expect(document.activeElement).toBe(heading)
    const key = screen.getByText('ABCD EFGH 2345')
    expect(key.tagName).toBe('P')
    expect(key.getAttribute('dir')).toBe('ltr')
    expect(
      screen
        .getByRole('link', { name: 'Open in your authenticator app' })
        .closest('[data-sentry-block]'),
    ).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    await screen.findByLabelText('Your password')
    expect(mocks.cancel).toHaveBeenCalledOnce()
    expect(screen.queryByText('ABCD EFGH 2345')).toBeNull()
  })
  it.each(['password', 'code'])(
    'associates and focuses invalid %s without false success',
    async (stage) => {
      if (stage === 'password')
        mocks.prepare.mockRejectedValue(failure('INVALID_PASSWORD', 400))
      else mocks.commit.mockRejectedValue(failure('INVALID_CODE', 400))
      render(page())
      if (stage === 'password') await start()
      else await confirm()
      const field = screen.getByLabelText(
        stage === 'password' ? 'Your password' : 'Code from the app',
      ) as HTMLInputElement
      await waitFor(() =>
        expect(field.getAttribute('aria-invalid')).toBe('true'),
      )
      expect(field.value).toBe(stage === 'password' ? '' : '123456')
      expect(document.activeElement).toBe(field)
      expect(field.getAttribute('aria-describedby')).toBeTruthy()
      expect(screen.queryByText(codes[0])).toBeNull()
    },
  )
  it.each(['FACTOR_STATE_CHANGED', 'FACTOR_SETUP_EXPIRED'])(
    'refreshes authoritative state after %s instead of reenrolling',
    async (code) => {
      mocks.prepare.mockRejectedValue(failure(code, 409))
      render(page())
      await start()
      await screen.findByRole('heading', { name: 'Two-factor is on' })
      expect(mocks.cancel).toHaveBeenCalledOnce()
      expect(mocks.getSession).toHaveBeenCalledWith({
        query: { disableCookieCache: true },
      })
      expect(mocks.prepare).toHaveBeenCalledOnce()
    },
  )
  it('requires sign-in when stale-state refresh fails', async () => {
    mocks.prepare.mockRejectedValue(failure('FACTOR_STATE_CHANGED', 409))
    mocks.getSession.mockRejectedValue(new TypeError('offline'))
    render(page())
    await start()
    await screen.findByText(Settings['twoFactor.security.fresh'])
    expect(screen.queryByText(codes[0])).toBeNull()
  })
  it('reuses registration intent after losing the registration response', async () => {
    mocks.register.mockRejectedValueOnce(new TypeError('offline'))
    render(page())
    const user = await start()
    await screen.findByText(Auth['error.offline.detail'])
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('ABCD EFGH 2345')
    expect(mocks.register.mock.calls[0]).toEqual(mocks.register.mock.calls[1])
    expect(mocks.prepare).toHaveBeenCalledOnce()
  })
  it.each(['prepare', 'commit', 'cancel'] as const)(
    'uses receipt-only recovery after a lost %s response',
    async (phase) => {
      mocks[phase].mockRejectedValue(new TypeError('offline'))
      render(page())
      if (phase === 'commit') await confirm()
      else {
        const user = await start()
        if (phase === 'cancel') {
          await user.click(screen.getByRole('button', { name: 'Start over' }))
          await user.click(screen.getByRole('button', { name: 'Start over' }))
        }
      }
      const user = userEvent.setup()
      await user.click(
        await screen.findByRole('button', {
          name: Settings['security.other.check'],
        }),
      )
      await screen.findByText(Settings['twoFactor.security.fresh'])
      expect(mocks.status).toHaveBeenCalledWith('operation')
      expect(mocks.getSession).not.toHaveBeenCalled()
      expect(screen.queryByText(codes[0])).toBeNull()
      expect(mocks.register).toHaveBeenCalledOnce()
    },
  )
  it('recovers a receipt on remount without exposing secrets or issuing another operation', async () => {
    mocks.availability.mockResolvedValue({
      available: true,
      recovery: { id: 'prior', status: 'unknown' },
    })
    mocks.status.mockRejectedValue(new TypeError('offline'))
    render(page())
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', {
        name: Settings['security.other.check'],
      }),
    )
    await screen.findByText(Auth['error.offline.detail'])
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.status).toHaveBeenCalledWith('prior')
  })
  it.each(['PASSWORD_ATTEMPTS_LOCKED', 'FACTOR_FRESH_SESSION_REQUIRED'])(
    'provides fresh sign-in for %s',
    async (code) => {
      mocks.prepare.mockRejectedValue(failure(code, 403))
      render(page())
      await start()
      await screen.findByText(Settings['twoFactor.security.fresh'])
      expect(
        screen.getByRole('button', { name: Auth['login.submit'] }),
      ).toBeTruthy()
    },
  )
  it('does not continue preparation after registration resolves on an unmounted screen', async () => {
    let resolve!: (value: typeof registration) => void
    mocks.register.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const view = render(page())
    await start()
    view.unmount()
    await act(async () => resolve(registration))
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
  it('detects a no-password account but falls through on failed detection', async () => {
    mocks.listAccounts.mockResolvedValueOnce({
      data: [{ providerId: 'google' }],
    })
    const view = render(page())
    expect(
      await screen.findByRole('heading', { name: 'Set a password first' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Set a password' }).getAttribute('href'),
    ).toBe('/forgot-password')
    view.unmount()
    mocks.listAccounts.mockRejectedValueOnce(new TypeError('offline'))
    render(page())
    expect(await screen.findByLabelText('Your password')).toBeTruthy()
  })
  it('guards leaving until acknowledged and supports stay or leave', async () => {
    const view = render(page())
    const user = await confirm()
    await screen.findByRole('heading', { name: 'Your backup codes' })
    const options = mocks.blockOptions.mock.lastCall?.[0] as {
      shouldBlockFn: () => boolean
    }
    expect(options.shouldBlockFn()).toBe(true)
    mocks.blocker.status = 'blocked'
    view.rerender(page())
    await user.click(screen.getByRole('button', { name: 'Stay here' }))
    expect(mocks.blocker.reset).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    expect(mocks.blocker.proceed).toHaveBeenCalledOnce()
    mocks.blocker.status = 'idle'
    view.rerender(page())
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I have stored these backup codes',
      }),
    )
    const unguarded = mocks.blockOptions.mock.lastCall?.[0] as {
      shouldBlockFn: () => boolean
    }
    expect(unguarded.shouldBlockFn()).toBe(false)
  })
  it('copies the raw key and announces the result in the already-mounted live region', async () => {
    const user = userEvent.setup()
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    render(page())
    await start()
    const live = screen
      .getAllByRole('status')
      .find((node) => node.classList.contains('text-caption'))!
    expect(live.textContent).toBe('')
    await user.click(screen.getByRole('button', { name: 'Copy key' }))
    expect(clipboard).toHaveBeenCalledWith('ABCDEFGH2345')
    expect(live.textContent).toBe('Key copied')
  })
  it('focuses the confirm-step h3 and preserves the mirrored security back arrow', async () => {
    render(page())
    const back = screen.getByRole('link', { name: 'Back to security' })
    expect(back.querySelector('[data-mirror-rtl]')).not.toBeNull()
    const user = await start()
    await user.click(
      await screen.findByRole('button', { name: 'I have added it' }),
    )
    const heading = screen.getByRole('heading', {
      name: 'Enter a code',
      level: 3,
    })
    expect(document.activeElement).toBe(heading)
    const steps = screen.getByRole('list', { name: 'Set up two-factor' })
    expect(steps.querySelector('[aria-current=step]')?.textContent).toContain(
      'Current step',
    )
    expect(steps.querySelectorAll('li')[0].textContent).toContain('Done')
    expect(steps.querySelectorAll('li')[1].textContent).toContain('Done')
  })
})
describe('proof-gated changes', () => {
  it.each([
    'Turn off two-factor',
    'Replace backup codes',
    Settings['twoFactor.security.replace'],
  ])('requires password and current possession for %s', async (action) => {
    mocks.commit.mockImplementation((value: { operation: string }) =>
      Promise.resolve({
        ...committed,
        operation: value.operation,
        enabled: value.operation !== 'disable',
        backupCodes: value.operation === 'disable' ? undefined : codes,
      }),
    )
    render(page(true))
    const user = await dialog(action)
    const submit =
      action === 'Turn off two-factor'
        ? 'Turn off'
        : action === 'Replace backup codes'
          ? 'Replace'
          : 'Continue'
    await user.click(screen.getByRole('button', { name: submit }))
    if (submit === 'Continue') {
      await screen.findByText('ABCD EFGH 2345')
      expect(mocks.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'replace' }),
        'my-password',
        { kind: 'totp', code: '123456' },
      )
    } else {
      await screen.findByRole('heading', {
        name: submit === 'Turn off' ? 'Confirm it is you' : 'Your backup codes',
      })
      expect(mocks.commit).toHaveBeenCalledWith(expect.anything(), {
        password: 'my-password',
        proof: { kind: 'totp', code: '123456' },
      })
    }
  })
  it('switches proof with the keyboard and clears the previous code', async () => {
    render(page(true))
    const user = await dialog()
    const radios = screen.getAllByRole('radio')
    await user.click(radios[0])
    await user.keyboard('{ArrowRight>}')
    await waitFor(() =>
      expect(radios[1].getAttribute('aria-checked')).toBe('true'),
    )
    await user.keyboard('{/ArrowRight}')
    const field = (await screen.findByLabelText(
      Auth['twoFactor.backup.label'],
      { selector: 'input' },
    )) as HTMLInputElement
    expect(field.value).toBe('')
    await user.type(field, 'abcde-12345')
    await user.click(screen.getByRole('button', { name: 'Turn off' }))
    expect(mocks.commit).toHaveBeenCalledWith(expect.anything(), {
      password: 'my-password',
      proof: { kind: 'backup', code: 'abcde-12345' },
    })
  })
  it.each(['Keep it on', 'Escape', 'Close'])(
    'cancels through %s without mutation and restores focus',
    async (action) => {
      render(page(true))
      const user = await dialog()
      const trigger = screen.getByRole('button', {
        name: 'Turn off two-factor',
        hidden: true,
      })
      if (action === 'Escape') await user.keyboard('{Escape}')
      else await user.click(screen.getByRole('button', { name: action }))
      await waitFor(() => expect(document.activeElement).toBe(trigger))
      expect(mocks.register).not.toHaveBeenCalled()
      await user.click(trigger)
      expect(
        (screen.getByLabelText('Your password') as HTMLInputElement).value,
      ).toBe('')
      expect(
        (screen.getByLabelText('Code from the app') as HTMLInputElement).value,
      ).toBe('')
    },
  )
  it.each([
    'INVALID_PASSWORD',
    'INVALID_CODE',
    'INVALID_BACKUP_CODE',
    'FACTOR_PROOF_USED',
  ])('focuses the correct error field for %s', async (code) => {
    mocks.commit.mockRejectedValue(failure(code, 400))
    render(page(true))
    const user = await dialog()
    await user.click(screen.getByRole('button', { name: 'Turn off' }))
    const field = screen.getByLabelText(
      code === 'INVALID_PASSWORD' ? 'Your password' : 'Code from the app',
    ) as HTMLInputElement
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(field.value).toBe('')
    expect(document.activeElement).toBe(field)
    expect(field.getAttribute('aria-describedby')).toBeTruthy()
  })
  it('retains inputs and honors the authoritative retry deadline without automatic retry', async () => {
    const timer = vi.spyOn(window, 'setTimeout')
    mocks.commit.mockRejectedValue(
      failure('ACCOUNT_TEMPORARILY_LOCKED', 429, Date.now() + 500000),
    )
    render(page(true))
    const user = await dialog()
    await user.click(screen.getByRole('button', { name: 'Turn off' }))
    await waitFor(() =>
      expect(timer.mock.calls.some((args) => Number(args[1]) > 450000)).toBe(
        true,
      ),
    )
    expect(
      (screen.getByLabelText('Your password') as HTMLInputElement).value,
    ).toBe('my-password')
    expect(
      (screen.getByLabelText('Code from the app') as HTMLInputElement).value,
    ).toBe('123456')
    expect(
      (screen.getByRole('button', { name: 'Turn off' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(mocks.commit).toHaveBeenCalledOnce()
  })
  it('blocks duplicate submissions and dismissal until the operation settles', async () => {
    let resolve!: (value: unknown) => void
    mocks.commit.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    render(page(true))
    const user = await dialog()
    await user.click(screen.getByRole('button', { name: 'Turn off' }))
    await user.keyboard('{Enter}{Escape}')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: /Turning off/ })
        .getAttribute('aria-busy'),
    ).toBe('true')
    expect(mocks.commit).toHaveBeenCalledOnce()
    await act(async () =>
      resolve({ ...committed, enabled: false, backupCodes: undefined }),
    )
    await screen.findByRole('heading', { name: 'Confirm it is you' })
  })
  it.each(['unknown', 'refused'])(
    'never reports %s as successful disable',
    async (status) => {
      mocks.commit.mockResolvedValue({ status, enabled: null })
      render(page(true))
      const user = await dialog()
      await user.click(screen.getByRole('button', { name: 'Turn off' }))
      await screen.findByText(Settings['security.other.unknown'])
      expect(mocks.invalidate).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('heading', { name: 'Confirm it is you' }),
      ).toBeNull()
    },
  )
  it('preserves a committed disable if loader refresh fails', async () => {
    mocks.commit.mockResolvedValue({
      ...committed,
      enabled: false,
      backupCodes: undefined,
    })
    mocks.invalidate.mockRejectedValue(new TypeError('offline'))
    render(page(true))
    const user = await dialog()
    await user.click(screen.getByRole('button', { name: 'Turn off' }))
    await screen.findByRole('heading', { name: 'Confirm it is you' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('ignores a late commit from the previous mounted screen', async () => {
    let resolve!: (value: unknown) => void
    mocks.commit.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const view = render(page(true))
    const user = await dialog()
    await user.click(screen.getByRole('button', { name: 'Turn off' }))
    view.unmount()
    render(page(true))
    await screen.findByRole('heading', { name: 'Two-factor is on' })
    await act(async () => resolve({ ...committed, enabled: false }))
    expect(mocks.invalidate).not.toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: 'Two-factor is on' }),
    ).toBeTruthy()
  })
  it('never renders a malformed proposal URI or an arbitrary server message', async () => {
    mocks.prepare.mockResolvedValue({
      proposalId: 'proposal',
      expiresAt: Date.now(),
      totpURI: 'javascript:secret-value',
    })
    render(page(true))
    const user = await dialog(Settings['twoFactor.security.replace'])
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText(Settings['security.other.unknown'])
    expect(document.body.textContent?.includes('secret-value')).toBe(false)
    expect(mocks.commit).not.toHaveBeenCalled()
  })
})

it('confirms replacement with its own proposal and only then displays new codes', async () => {
  render(page(true))
  const user = await dialog(Settings['twoFactor.security.replace'])
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.queryByText(codes[0])).toBeNull()
  await user.click(screen.getByRole('button', { name: 'I have added it' }))
  await user.type(screen.getByLabelText('Code from the app'), '123456')
  await user.click(
    screen.getByRole('button', {
      name: Settings['twoFactor.security.replace'],
    }),
  )
  await screen.findByRole('heading', { name: 'Your backup codes' })
  expect(mocks.commit).toHaveBeenCalledWith(
    expect.objectContaining({ operation: 'replace' }),
    { proposalId: 'proposal', code: '123456' },
  )
})
it.each(['unknown', 'refused'] as const)(
  'reconciles a %s receipt without success or another mutation',
  async (status) => {
    mocks.availability.mockResolvedValue({
      available: true,
      recovery: { id: 'prior' },
    })
    mocks.status.mockResolvedValue({
      status,
      enabled: null,
      cleanupPending: false,
      operation: 'disable',
    })
    render(page(true))
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', {
        name: Settings['security.other.check'],
      }),
    )
    if (status === 'unknown') {
      expect(screen.getByText(Settings['security.other.unknown'])).toBeTruthy()
      expect(mocks.getSession).not.toHaveBeenCalled()
    } else {
      await screen.findByRole('heading', { name: 'Two-factor is on' })
      expect(mocks.getSession).toHaveBeenCalledOnce()
    }
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(screen.queryByText(codes[0])).toBeNull()
  },
)
it.each(['password', 'code'] as const)(
  'retains wizard %s input until its retry timer finishes without automatic requests',
  async (stage) => {
    const timer = vi.spyOn(window, 'setTimeout')
    const endpoint = stage === 'password' ? mocks.prepare : mocks.commit
    endpoint.mockRejectedValue(failure(null, 429, Date.now() + 180000))
    render(page())
    if (stage === 'password') await start()
    else await confirm()
    const button = screen.getByRole('button', {
      name: stage === 'password' ? 'Continue' : 'Turn on two-factor',
    }) as HTMLButtonElement
    await waitFor(() => expect(button.disabled).toBe(true))
    const scheduled = timer.mock.calls.find((args) => Number(args[1]) > 150000)
    expect(scheduled).toBeTruthy()
    act(() => {
      if (typeof scheduled?.[0] === 'function') scheduled[0]()
    })
    expect(button.disabled).toBe(false)
    expect(endpoint).toHaveBeenCalledOnce()
    expect(
      (
        screen.getByLabelText(
          stage === 'password' ? 'Your password' : 'Code from the app',
        ) as HTMLInputElement
      ).value,
    ).toBe(stage === 'password' ? 'my-password' : '123456')
  },
)
it.each(['returned', 'thrown'] as const)(
  'does not render secret material from a %s failure',
  async (kind) => {
    const secret = 'fixture-private-error-material'
    mocks.prepare.mockRejectedValue(
      kind === 'thrown'
        ? new Error(secret)
        : {
            authFailure: {
              code: 'UNKNOWN_FIXTURE',
              status: 400,
              message: secret,
            },
          },
    )
    render(page())
    await start()
    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledOnce())
    expect(document.body.textContent?.includes(secret)).toBe(false)
    expect(
      screen.queryByRole('link', { name: 'Open in your authenticator app' }),
    ).toBeNull()
  },
)
it('blocks proofless and partial-code submissions before registration', async () => {
  const user = userEvent.setup()
  render(page(true))
  await user.click(
    await screen.findByRole('button', { name: 'Turn off two-factor' }),
  )
  const submit = screen.getByRole('button', {
    name: 'Turn off',
  }) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  await user.type(screen.getByLabelText('Your password'), 'my-password')
  expect(submit.disabled).toBe(true)
  await user.type(screen.getByLabelText('Code from the app'), '123')
  expect(submit.disabled).toBe(true)
  await user.click(submit)
  expect(mocks.register).not.toHaveBeenCalled()
  expect(mocks.commit).not.toHaveBeenCalled()
})

it('uses receipt recovery for an explicit post-commit unknown outcome', async () => {
  mocks.commit.mockRejectedValue(failure('FACTOR_OUTCOME_UNKNOWN', 403))
  render(page(true))
  const user = await dialog()
  await user.click(screen.getByRole('button', { name: 'Turn off' }))
  const check = await screen.findByRole('button', {
    name: Settings['security.other.check'],
  })
  await user.click(check)
  expect(mocks.status).toHaveBeenCalledWith('operation')
  expect(mocks.commit).toHaveBeenCalledOnce()
  expect(mocks.register).toHaveBeenCalledOnce()
})
