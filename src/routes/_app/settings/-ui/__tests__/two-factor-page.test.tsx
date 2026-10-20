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
  enable: vi.fn(),
  verifyTotp: vi.fn(),
  generateBackupCodes: vi.fn(),
  invalidate: vi.fn(),
  blocker: { status: 'idle', proceed: vi.fn(), reset: vi.fn() },
  blockOptions: vi.fn(),
}))
vi.mock('#/lib/auth/client', async (load) => ({
  ...(await load<typeof AuthClientModule>()),
  authClient: {
    listAccounts: mocks.listAccounts,
    getSession: mocks.getSession,
    twoFactor: {
      enable: mocks.enable,
      verifyTotp: mocks.verifyTotp,
      generateBackupCodes: mocks.generateBackupCodes,
    },
  },
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
function page(on = false) {
  return (
    <I18nProvider locale="en" messages={messages}>
      <TwoFactorSettings twoFactorEnabled={on} />
    </I18nProvider>
  )
}
async function start() {
  const user = userEvent.setup()
  await screen.findByLabelText('Your password')
  await user.type(screen.getByLabelText('Your password'), 'my-password')
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
beforeEach(() => {
  vi.clearAllMocks()
  mocks.listAccounts.mockResolvedValue({
    data: [{ providerId: 'credential' }],
    error: null,
  })
  mocks.getSession.mockResolvedValue({
    data: { user: { twoFactorEnabled: false } },
    error: null,
  })
  mocks.enable.mockResolvedValue({
    data: {
      totpURI: 'otpauth://totp/test?secret=ABCDEFGH2345',
      backupCodes: codes,
    },
    error: null,
  })
  mocks.verifyTotp.mockResolvedValue({ data: { status: true }, error: null })
  mocks.generateBackupCodes.mockResolvedValue({
    data: { backupCodes: codes },
    error: null,
  })
  mocks.invalidate.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
describe('two-factor settings', () => {
  it('makes no session or second-factor call on mount', async () => {
    render(page())
    await screen.findByLabelText('Your password')
    expect(mocks.listAccounts).toHaveBeenCalledOnce()
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.enable).not.toHaveBeenCalled()
    expect(mocks.verifyTotp).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Two-factor authentication',
    )
    expect(
      screen
        .getByRole('list', { name: 'Set up two-factor' })
        .querySelector('[aria-current=step]')?.textContent,
    ).toContain('Current step')
  })
  it('enrols without trustDevice and preserves the one-time codes across a loader refresh until acknowledged', async () => {
    const view = render(page())
    const user = await confirm()
    const heading = await screen.findByRole('heading', {
      name: 'Your backup codes',
      level: 3,
    })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    expect(mocks.getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    })
    expect(mocks.enable).toHaveBeenCalledWith({ password: 'my-password' })
    expect(mocks.verifyTotp).toHaveBeenCalledWith({ code: '123456' })
    expect(screen.queryByLabelText(/trust/i)).toBeNull()
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
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })
  it('shows the shared typed key as a blocked left-to-right paragraph and focuses each step', async () => {
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
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    await screen.findByLabelText('Your password')
    expect(screen.queryByText('ABCD EFGH 2345')).toBeNull()
  })
  it('clears a refused password and focuses its field', async () => {
    mocks.enable.mockResolvedValue({
      error: { code: 'INVALID_PASSWORD', status: 400 },
    })
    render(page())
    await start()
    const field = screen.getByLabelText('Your password') as HTMLInputElement
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(field.value).toBe('')
    expect(document.activeElement).toBe(field)
  })
  it('keeps a wrong code as a field error', async () => {
    mocks.verifyTotp.mockResolvedValue({
      error: { code: 'INVALID_CODE', status: 400 },
    })
    render(page())
    await confirm()
    const field = screen.getByLabelText('Code from the app') as HTMLInputElement
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(field.value).toBe('123456')
    expect(document.activeElement).toBe(field)
  })
  it.each(['precheck', 'refusal'])(
    'recovers an already-on %s without reenrolling',
    async (kind) => {
      if (kind === 'precheck')
        mocks.getSession.mockResolvedValue({
          data: { user: { twoFactorEnabled: true } },
        })
      else
        mocks.enable.mockResolvedValue({
          error: { code: 'TWO_FACTOR_ALREADY_ENABLED', status: 400 },
        })
      render(page())
      await start()
      const heading = await screen.findByRole('heading', {
        name: 'Two-factor is on',
      })
      expect(document.activeElement).toBe(heading)
      expect(screen.getByText('Two-factor is already on')).toBeTruthy()
      if (kind === 'precheck') expect(mocks.enable).not.toHaveBeenCalled()
    },
  )
  it('does not enable when the fresh session read fails', async () => {
    mocks.getSession.mockRejectedValue(new TypeError('offline'))
    render(page())
    await start()
    await screen.findByText(Auth['error.offline.detail'])
    expect(mocks.enable).not.toHaveBeenCalled()
    expect(
      (screen.getByLabelText('Your password') as HTMLInputElement).value,
    ).toBe('my-password')
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
  it.each([true, false])(
    'rereads the session exactly once after an uncertain confirmation (on=%s)',
    async (on) => {
      mocks.verifyTotp.mockRejectedValue(new TypeError('offline'))
      mocks.getSession
        .mockResolvedValueOnce({ data: { user: { twoFactorEnabled: false } } })
        .mockResolvedValueOnce({ data: { user: { twoFactorEnabled: on } } })
      render(page())
      await confirm()
      if (on) await screen.findByRole('heading', { name: 'Your backup codes' })
      else {
        const alert = (
          await screen.findAllByText(
            'We could not tell whether that worked. Enter the newest code to try again.',
          )
        )[0]
        expect(document.activeElement).toBe(alert.closest('[role=status]'))
        expect(
          (screen.getByLabelText('Code from the app') as HTMLInputElement)
            .value,
        ).toBe('123456')
      }
      expect(mocks.getSession).toHaveBeenCalledTimes(2)
      expect(mocks.verifyTotp).toHaveBeenCalledOnce()
    },
  )
  it('shows only the on view and replaces codes after a fresh password', async () => {
    const user = userEvent.setup()
    render(page(true))
    expect(mocks.listAccounts).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Replace backup codes' }),
    )
    expect(
      screen.getByText(
        'You will get a new set. The set you have now stops working as soon as you continue.',
      ),
    ).toBeTruthy()
    await user.type(screen.getByLabelText('Your password'), 'fresh-password')
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    const panelHeading = await screen.findByRole('heading', {
      name: 'Your backup codes',
      level: 3,
    })
    await waitFor(() => expect(document.activeElement).toBe(panelHeading))
    expect(mocks.generateBackupCodes).toHaveBeenCalledWith({
      password: 'fresh-password',
    })
    expect(screen.queryByLabelText('Your password')).toBeNull()
  })
  it.each(['password', 'code'])(
    'keeps typed values and applies the %s endpoint wait without retries',
    async (stage) => {
      const timer = vi.spyOn(window, 'setTimeout')
      render(page())
      if (stage === 'password') {
        mocks.enable.mockResolvedValue({ error: { status: 429 } })
        await start()
      } else {
        mocks.verifyTotp.mockResolvedValue({ error: { status: 429 } })
        await confirm()
      }
      const message =
        stage === 'password'
          ? 'Wait about ten seconds, then try again. Nothing you typed was lost.'
          : 'Wait up to a minute, then try again. Nothing you typed was lost.'
      const alert = await screen.findByText(message)
      expect(document.activeElement).toBe(alert.closest('[role=status]'))
      expect(
        (
          screen.getByLabelText(
            stage === 'password' ? 'Your password' : 'Code from the app',
          ) as HTMLInputElement
        ).value,
      ).toBe(stage === 'password' ? 'my-password' : '123456')
      const duration = stage === 'password' ? 10000 : 60000
      const scheduled = timer.mock.calls.find((args) => args[1] === duration)
      expect(scheduled).toBeTruthy()
      const button = screen.getByRole('button', {
        name: stage === 'password' ? 'Continue' : 'Turn on two-factor',
      })
      expect((button as HTMLButtonElement).disabled).toBe(true)
      act(() => {
        if (typeof scheduled?.[0] === 'function') scheduled[0]()
      })
      expect((button as HTMLButtonElement).disabled).toBe(false)
      expect(mocks.enable).toHaveBeenCalledOnce()
      if (stage === 'code') expect(mocks.verifyTotp).toHaveBeenCalledOnce()
      expect(screen.queryByText(Auth['error.rateLimited.detail'])).toBeNull()
    },
  )
  it('keeps the code and reports uncertainty when the recovery read fails', async () => {
    mocks.verifyTotp.mockRejectedValue(new TypeError('offline'))
    mocks.getSession
      .mockResolvedValueOnce({ data: { user: { twoFactorEnabled: false } } })
      .mockRejectedValueOnce(new TypeError('offline'))
    render(page())
    await confirm()
    await screen.findAllByText(Settings['twoFactor.code.unclear'])
    expect(mocks.getSession).toHaveBeenCalledTimes(2)
    expect(
      screen.queryByRole('heading', { name: 'Your backup codes' }),
    ).toBeNull()
    expect(
      (screen.getByLabelText('Code from the app') as HTMLInputElement).value,
    ).toBe('123456')
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
    const live = screen.getByRole('status')
    expect(live.textContent).toBe('')
    await user.click(screen.getByRole('button', { name: 'Copy key' }))
    expect(clipboard).toHaveBeenCalledWith('ABCDEFGH2345')
    expect(live.textContent).toBe('Key copied')
  })
  it('returns focus to the password-dialog trigger on cancel and clears its password', async () => {
    const user = userEvent.setup()
    render(page(true))
    const trigger = screen.getByRole('button', { name: 'Replace backup codes' })
    await user.click(trigger)
    await user.type(screen.getByLabelText('Your password'), 'forget-me')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    await user.click(trigger)
    expect(
      (screen.getByLabelText('Your password') as HTMLInputElement).value,
    ).toBe('')
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
  it('clears an invalid replacement password and associates its focused field error', async () => {
    mocks.generateBackupCodes.mockResolvedValue({
      error: { status: 400, code: 'INVALID_PASSWORD' },
    })
    const user = userEvent.setup()
    render(page(true))
    await user.click(
      screen.getByRole('button', { name: 'Replace backup codes' }),
    )
    const field = screen.getByLabelText('Your password') as HTMLInputElement
    await user.type(field, 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(field.value).toBe('')
    expect(document.activeElement).toBe(field)
    expect(
      document.getElementById(field.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe(Settings['twoFactor.password.invalid'])
    expect(
      screen.queryByRole('heading', { name: 'Your backup codes' }),
    ).toBeNull()
  })
  it('retains the replacement password during its ten-second rate limit without retrying', async () => {
    mocks.generateBackupCodes.mockResolvedValue({ error: { status: 429 } })
    const timer = vi.spyOn(window, 'setTimeout')
    const user = userEvent.setup()
    render(page(true))
    await user.click(
      screen.getByRole('button', { name: 'Replace backup codes' }),
    )
    const field = screen.getByLabelText('Your password') as HTMLInputElement
    await user.type(field, 'keep-this-password')
    const submit = screen.getByRole('button', {
      name: 'Replace',
    }) as HTMLButtonElement
    await user.click(submit)
    const warning = await screen.findByText(
      Settings['twoFactor.rateLimited.password'],
    )
    expect(document.activeElement).toBe(warning.closest('[role=status]'))
    expect(field.value).toBe('keep-this-password')
    expect(submit.disabled).toBe(true)
    const scheduled = timer.mock.calls.find((args) => args[1] === 10000)
    expect(scheduled).toBeTruthy()
    act(() => {
      if (typeof scheduled?.[0] === 'function') scheduled[0]()
    })
    expect(submit.disabled).toBe(false)
    expect(mocks.generateBackupCodes).toHaveBeenCalledOnce()
    expect(screen.queryByText(Auth['error.rateLimited.detail'])).toBeNull()
  })
  it('retains a replacement password after a dropped connection and waits for an explicit retry', async () => {
    mocks.generateBackupCodes.mockRejectedValue(new TypeError('offline'))
    const user = userEvent.setup()
    render(page(true))
    await user.click(
      screen.getByRole('button', { name: 'Replace backup codes' }),
    )
    const field = screen.getByLabelText('Your password') as HTMLInputElement
    await user.type(field, 'keep-this-password')
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    await screen.findByText(Auth['error.offline.detail'])
    expect(field.value).toBe('keep-this-password')
    expect(mocks.generateBackupCodes).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('heading', { name: 'Your backup codes' }),
    ).toBeNull()
    expect(
      screen.getByRole('dialog').hasAttribute('data-sentry-block') ||
        field.closest('[data-sentry-block]') !== null,
    ).toBe(true)
  })
})
