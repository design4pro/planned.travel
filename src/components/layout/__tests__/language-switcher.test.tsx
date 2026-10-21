// The popover mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import PlSettings from '#/lib/i18n/messages/pl/settings'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { LanguageSwitcher } from '../language-switcher'

import type { Catalogue, Locale } from '#/lib/i18n'

/**
 * The real switcher, popover and picker, with the three things that leave the
 * browser as the only fakes: the visitor save, the router (`invalidate`, its
 * match state and the root loader's data) and the toast surface.
 *
 * `invalidate` is where a language change becomes observable, so the fake
 * router applies `served` to the root match when it runs — "the cookie was
 * kept" is `served === asked`, "it was not" is `served` staying where it was.
 */
const router = vi.hoisted(() => ({
  invalidate: vi.fn(),
  state: {
    matches: [] as Array<{
      routeId: string
      status: 'success' | 'error'
      loaderData?: {
        locale: string
        signedIn: boolean
        messages: Record<string, string>
      }
    }>,
  },
}))
const notify = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  rootRouteId: '__root__',
  useRouter: () => router,
  useRouterState: ({
    select,
  }: {
    select: (state: typeof router.state) => unknown
  }) => select(router.state),
}))
vi.mock('sonner', () => ({ toast: notify }))

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('ui', Ui),
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

/** What the root loader answers on the next `invalidate()`. */
let served: Locale

function setRoot(
  signedIn: boolean,
  locale: Locale = 'en',
  messages: Record<string, string> = { loaded: 'yes' },
): void {
  router.state.matches = [
    {
      routeId: '__root__',
      status: 'success',
      loaderData: { locale, signedIn, messages },
    },
  ]
}

beforeEach(() => {
  served = 'en'
  setRoot(false)
  router.invalidate.mockReset()
  router.invalidate.mockImplementation(async () => {
    setRoot(false, served)
  })
  notify.error.mockReset()
  notify.warning.mockReset()
  notify.success.mockReset()
})
afterEach(cleanup)

type Save = (locale: Locale) => Promise<{ locale: Locale }>

function mount(save: Save = async (locale) => ({ locale })) {
  const user = userEvent.setup()
  const saveSpy = vi.fn(save)
  render(
    <I18nProvider locale="en" messages={EN}>
      <button type="button">before</button>
      <LanguageSwitcher save={saveSpy} />
    </I18nProvider>,
  )
  return { user, save: saveSpy }
}

const trigger = (): HTMLElement =>
  screen.getByRole('button', { name: 'Language: English. Change language' })
const chip = (tag: string): HTMLElement =>
  screen.getByTestId(`locale-chip-${tag}`)

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger())
  return screen.findByRole('dialog')
}

describe('LanguageSwitcher — who sees it', () => {
  it('renders a trigger for a signed-out visitor', () => {
    mount()
    expect(trigger()).toBeTruthy()
  })

  it('renders nothing for a signed-in person', () => {
    setRoot(true)
    mount()
    expect(screen.queryByRole('button', { name: /Language/ })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays out of the way while no root match has loaded yet', () => {
    router.state.matches = []
    mount()
    expect(trigger()).toBeTruthy()
  })
})

describe('LanguageSwitcher — the trigger', () => {
  it('is 40px high, carries the active language in its name, and shows the native name from sm', () => {
    mount()
    const button = trigger()
    expect(button.className).toContain('h-10')
    const visible = button.querySelector('[lang="en"]')
    expect(visible?.textContent).toBe('English')
    expect(visible?.className).toContain('hidden sm:inline')
  })
})

describe('LanguageSwitcher — the popover', () => {
  it('is named, describes its group with the hint, and offers the 23 languages without a follow row', async () => {
    const { user } = mount()
    const dialog = await open(user)
    expect(dialog.getAttribute('aria-label')).toBe(Settings['language.label'])
    const group = screen.getByRole('radiogroup')
    const hint = screen.getByText(Shell['language.hint'])
    expect(group.getAttribute('aria-describedby')).toBe(hint.id)
    expect(screen.getAllByRole('radio')).toHaveLength(23)
    expect(screen.queryByTestId('locale-chip-workspace')).toBeNull()
    expect(chip('en').getAttribute('aria-checked')).toBe('true')
  })

  it('opens from the keyboard and closes on Escape with focus back on the trigger', async () => {
    const { user } = mount()
    trigger().focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger())
  })
})

describe('LanguageSwitcher — choosing a language', () => {
  it('saves, re-runs the loaders, closes, returns focus and announces in the new language', async () => {
    served = 'pl'
    const { user, save } = mount()
    await open(user)
    await user.click(chip('pl'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(save).toHaveBeenCalledWith('pl')
    expect(router.invalidate).toHaveBeenCalledWith({ forcePending: true })
    expect(document.activeElement).toBe(trigger())
    // The new language's translator, not the `t` of the render that began the save.
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Zmieniono język na Polski',
      ),
    )
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
    expect(notify.warning).not.toHaveBeenCalled()
  })

  it('keeps the live region outside the portalled popover and empty before a switch', async () => {
    const { user } = mount()
    const dialog = await open(user)
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')
    expect(dialog.contains(region)).toBe(false)
  })

  it('shows the pending chip, locks the group and writes once while the save is in flight', async () => {
    served = 'pl'
    const write = deferred<{ locale: Locale }>()
    const { user, save } = mount(() => write.promise)
    await open(user)
    await user.click(chip('pl'))

    expect(chip('pl').getAttribute('aria-busy')).toBe('true')
    await user.click(chip('de'))
    expect(save).toHaveBeenCalledTimes(1)

    write.resolve({ locale: 'pl' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('still announces when Escape closed the popover during the save', async () => {
    served = 'pl'
    const write = deferred<{ locale: Locale }>()
    const { user } = mount(() => write.promise)
    await open(user)
    await user.click(chip('pl'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status').textContent).toBe('')

    write.resolve({ locale: 'pl' })
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Zmieniono język na Polski',
      ),
    )
    expect(document.activeElement).toBe(trigger())
  })

  it('marks the trigger busy while the save runs, so a closed popover still shows work in flight', async () => {
    served = 'pl'
    const write = deferred<{ locale: Locale }>()
    const { user } = mount(() => write.promise)
    await open(user)
    await user.click(chip('pl'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger().getAttribute('aria-busy')).toBe('true')

    write.resolve({ locale: 'pl' })
    await waitFor(() => expect(trigger().getAttribute('aria-busy')).toBeNull())
  })

  it('leaves focus where the person put it when they moved on during the save', async () => {
    served = 'pl'
    const write = deferred<{ locale: Locale }>()
    const { user } = mount(() => write.promise)
    await open(user)
    await user.click(chip('pl'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const elsewhere = screen.getByRole('button', { name: 'before' })
    elsewhere.focus()

    write.resolve({ locale: 'pl' })
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Zmieniono język na Polski',
      ),
    )
    expect(document.activeElement).toBe(elsewhere)
  })

  it('is unapplied, with the switcher gone, when the refresh shows the person is signed in', async () => {
    router.invalidate.mockImplementation(async () => {
      setRoot(true, 'en')
    })
    const { user } = mount()
    await open(user)
    await user.click(chip('pl'))

    await waitFor(() => expect(notify.warning).toHaveBeenCalled())
    expect(notify.warning).toHaveBeenCalledWith(Shell['language.notApplied'])
    expect(screen.queryByRole('button', { name: /Language/ })).toBeNull()
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('is rejected quietly: the existing toast, the popover stays, nothing is announced', async () => {
    const { user } = mount(async () => {
      throw new Error('Failed to fetch')
    })
    await open(user)
    await user.click(chip('pl'))

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(notify.error).toHaveBeenCalledWith(
      Settings['language.saveFailed'],
      expect.objectContaining({
        description: expect.stringContaining('English'),
      }),
    )
    expect(router.invalidate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('is stale when a match ended in its error boundary: the reload toast, no announcement', async () => {
    served = 'pl'
    router.invalidate.mockImplementation(async () => {
      setRoot(false, 'pl')
      router.state.matches = [
        ...router.state.matches,
        { routeId: '/login', status: 'error' },
      ]
    })
    const { user } = mount()
    await open(user)
    await user.click(chip('pl'))

    await waitFor(() => expect(notify.warning).toHaveBeenCalled())
    // The page is Polish by now, so the toast is too.
    expect(notify.warning).toHaveBeenCalledWith(
      PlSettings['language.reload.title'],
      expect.anything(),
    )
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('is stale, not a cookie complaint, when the root loader fell back to English with no messages', async () => {
    router.invalidate.mockImplementation(async () => {
      setRoot(false, 'en', {})
    })
    const { user } = mount()
    await open(user)
    await user.click(chip('pl'))

    await waitFor(() => expect(notify.warning).toHaveBeenCalled())
    expect(notify.warning).toHaveBeenCalledWith(
      Settings['language.reload.title'],
      expect.anything(),
    )
    expect(notify.warning).not.toHaveBeenCalledWith(
      Shell['language.notApplied'],
    )
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('is unapplied when the browser did not keep the cookie: told so in the language still on screen, never announced', async () => {
    // `served` stays `en`: the cookie never came back on the request.
    const { user } = mount()
    await open(user)
    await user.click(chip('pl'))

    await waitFor(() => expect(notify.warning).toHaveBeenCalled())
    expect(notify.warning).toHaveBeenCalledWith(Shell['language.notApplied'])
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('does not change the selection by moving focus with the arrows', async () => {
    const { user, save } = mount()
    await open(user)
    chip('en').focus()
    await user.keyboard('{ArrowRight}')
    expect(save).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(chip('en'))
  })
})
