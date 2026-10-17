// The menu mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { UserMenu } from '../user-menu'

import type { Catalogue } from '#/lib/i18n'
import type { ShellOrganization, ShellSession } from '../session'

/**
 * The real `UserMenu`, with the three things that leave the browser as the only fakes.
 *
 * `setActive` is Better Auth's own client call, `navigate` and `invalidate` are the router's, and
 * `toast` is the surface the reader is told on. Everything between them - the radio group, the
 * order the three calls run in, what a refusal does - is the code that ships. `useRouter` needs a
 * router above it and `Link` a router context, so both are replaced; `toAuthFailure` is kept real,
 * because how a failed call is read is part of what is under test.
 */
const auth = vi.hoisted(() => ({ setActive: vi.fn() }))
const router = vi.hoisted(() => ({
  clearCache: vi.fn(),
  invalidate: vi.fn(),
  navigate: vi.fn(),
  state: { matches: [] as Array<{ status: 'success' | 'error' | 'notFound' }> },
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const workspace = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('#/lib/auth/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authClient: { organization: { setActive: auth.setActive } },
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('sonner', () => ({ toast: notify }))
vi.mock('#/server/fns/workspace', () => ({
  createWorkspaceFn: workspace.create,
}))

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const ALPHA: ShellOrganization = {
  id: 'org_a',
  name: 'Alpha Travel',
  slug: 'alpha',
}
const BETA: ShellOrganization = {
  id: 'org_b',
  name: 'Beta Family',
  slug: 'beta',
}
const GAMMA: ShellOrganization = {
  id: 'org_c',
  name: 'Gamma Clients',
  slug: 'gamma',
}

function sessionOf(
  organizations: ReadonlyArray<ShellOrganization>,
  active: ShellOrganization = organizations[0],
): ShellSession {
  return {
    user: {
      id: 'usr_1',
      name: 'Kasia Nowak',
      email: 'kasia@example.com',
      image: null,
      isAdmin: true,
      platformRole: 'user',
      isPlatformAdmin: false,
      isCurator: false,
    },
    organization: active,
    organizations,
    impersonatedBy: null,
    expiresAt: '2026-10-07T10:00:00.000Z',
  }
}

/** A promise this test settles by hand, so "the switch is in flight" is a state it can hold. */
function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

async function mount(session: ShellSession) {
  const user = userEvent.setup()
  render(
    <I18nProvider locale="en" messages={EN}>
      <UserMenu session={session} />
    </I18nProvider>,
  )
  const open = () =>
    user.click(screen.getByRole('button', { name: 'Account menu' }))
  await open()
  return { user, open }
}

/** The workspace radios, in menu order, as `[name, checked]`. */
function workspaces(): Array<[string, boolean]> {
  return screen
    .getAllByRole('menuitemradio')
    .map((item) => [
      item.textContent.trim(),
      item.getAttribute('aria-checked') === 'true',
    ])
}

/**
 * The switch's announcement region. Found by role while the menu is open: the open menu is modal
 * and hides everything outside it from assistive technology except an `aria-live` region, so
 * finding it here proves a screen reader still reaches it.
 */
function switchStatus(): HTMLElement {
  return screen.getByRole('status')
}

/** What a screen reader reads as the description of `element`, following `aria-describedby`. */
function descriptionOf(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
}

beforeEach(() => {
  auth.setActive.mockReset()
  router.clearCache.mockReset()
  router.invalidate.mockReset()
  router.navigate.mockReset()
  router.state.matches = []
  notify.success.mockReset()
  notify.error.mockReset()
  workspace.create.mockReset()
  auth.setActive.mockResolvedValue({ data: {}, error: null })
  router.invalidate.mockResolvedValue(undefined)
  router.navigate.mockResolvedValue(undefined)
})

describe('the workspace switcher in the account menu', () => {
  it('names the one workspace a reader has and checks it', async () => {
    await mount(sessionOf([ALPHA]))

    expect(screen.getByRole('group', { name: 'Workspace' })).not.toBeNull()
    expect(workspaces()).toEqual([['Alpha Travel', true]])
  })

  it('lists every workspace and checks the active one, not the first', async () => {
    await mount(sessionOf([ALPHA, BETA, GAMMA], BETA))

    expect(workspaces()).toEqual([
      ['Alpha Travel', false],
      ['Beta Family', true],
      ['Gamma Clients', false],
    ])
  })

  it('offers "Create workspace" to every reader, enabled, whatever their workspaces', async () => {
    await mount(sessionOf([ALPHA]))

    const item = screen.getByRole('menuitem', { name: 'Create workspace' })
    expect(item.getAttribute('aria-disabled')).toBeNull()
    expect(auth.setActive).not.toHaveBeenCalled()
  })

  it('does nothing when the active workspace is chosen again', async () => {
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Alpha Travel' }),
    )

    expect(auth.setActive).not.toHaveBeenCalled()
    expect(router.navigate).not.toHaveBeenCalled()
    expect(notify.success).not.toHaveBeenCalled()
  })
})

describe('workspace names', () => {
  it.each([
    ['Straße', 'STRASSE'],
    ['ος', 'ΟΣ'],
    ['ﬃ', 'FFI'],
  ])('folds %s and %s to the same name', async (first, second) => {
    await mount(
      sessionOf([
        { ...ALPHA, name: first },
        { ...BETA, name: second },
      ]),
    )
    expect(
      screen.getByRole('menuitemradio', { name: new RegExp(ALPHA.slug) }),
    ).toBeTruthy()
    expect(
      screen.getByRole('menuitemradio', { name: new RegExp(BETA.slug) }),
    ).toBeTruthy()
  })

  it('does not fold a dotless i into i', async () => {
    await mount(
      sessionOf([
        { ...ALPHA, name: 'I' },
        { ...BETA, name: 'ı' },
      ]),
    )
    expect(screen.queryByText(ALPHA.slug)).toBeNull()
    expect(screen.queryByText(BETA.slug)).toBeNull()
  })

  it('adds the slug to the accessible name only for colliding names', async () => {
    await mount(
      sessionOf([
        { ...ALPHA, name: ' Café ' },
        { ...BETA, name: 'CAFE\u0301' },
        GAMMA,
      ]),
    )

    for (const slug of ['alpha', 'beta']) {
      const row = screen.getByRole('menuitemradio', { name: new RegExp(slug) })
      const line = within(row).getByText(slug)
      expect(line.getAttribute('dir')).toBe('ltr')
      expect(line.tagName).toBe('SPAN')
      expect(line.parentElement?.className).toContain(
        '[overflow-wrap:anywhere]',
      )
      expect(row.className).toContain('min-h-11')
    }
    expect(screen.queryByText('gamma')).toBeNull()
  })

  it('keeps diacritically different names distinct', async () => {
    await mount(
      sessionOf([
        { ...ALPHA, name: 'Rafał' },
        { ...BETA, name: 'Rafal' },
      ]),
    )
    expect(workspaces()).toEqual([
      ['Rafał', true],
      ['Rafal', false],
    ])
    expect(screen.queryByText('alpha')).toBeNull()
    expect(screen.queryByText('beta')).toBeNull()
  })

  it('shows no slug for a single workspace', async () => {
    await mount(sessionOf([ALPHA]))
    expect(screen.queryByText(ALPHA.slug)).toBeNull()
  })
})

describe('switching', () => {
  it('announces the chosen name, isolated, after navigation, invalidation and menu closure', async () => {
    const calls: Array<string> = []
    const navigating = deferred<void>()
    const invalidating = deferred<void>()
    router.navigate.mockImplementation(() => {
      calls.push('navigate')
      return navigating.promise
    })
    router.invalidate.mockImplementation(() => {
      calls.push('invalidate')
      return invalidating.promise
    })
    notify.success.mockImplementation(() => {
      expect(screen.queryByRole('menu', { hidden: true })).toBeNull()
      expect(
        screen
          .getByRole('button', { name: 'Account menu' })
          .closest('[aria-hidden="true"]'),
      ).toBeNull()
      calls.push('menu closed', 'toast')
    })
    const name = 'عائلة Beta'
    const { user } = await mount(sessionOf([ALPHA, { ...BETA, name }]))
    await user.click(screen.getByRole('menuitemradio', { name }))
    expect(notify.success).not.toHaveBeenCalled()
    navigating.resolve()
    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))
    expect(notify.success).not.toHaveBeenCalled()
    invalidating.resolve()
    await vi.waitFor(() => {
      expect(notify.success).toHaveBeenCalledExactlyOnceWith(
        'Switched to \u2068' + name + '\u2069',
      )
    })
    expect(calls).toEqual(['navigate', 'invalidate', 'menu closed', 'toast'])
  })

  it('activates the chosen id, then goes to the dashboard, then drops every cached loader', async () => {
    const calls: Array<string> = []
    auth.setActive.mockImplementation(async () => {
      calls.push('setActive')
      return { data: {}, error: null }
    })
    router.clearCache.mockImplementation(() => {
      calls.push('clearCache')
    })
    router.navigate.mockImplementation(async () => {
      calls.push('navigate')
    })
    router.invalidate.mockImplementation(async () => {
      calls.push('invalidate')
    })
    const { user } = await mount(sessionOf([ALPHA, BETA, GAMMA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    expect(auth.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: 'org_b',
    })
    // `replace`: Back must not return to a trip that belongs to the workspace just left.
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith({
      to: '/dashboard',
      replace: true,
    })
    // The previous workspace's cached `/dashboard` is dropped before the navigation can show it.
    expect(calls).toEqual(['setActive', 'clearCache', 'navigate', 'invalidate'])
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('does not move the check, or leave the page, until the switch has resolved', async () => {
    const pending = deferred<{ data: object; error: null }>()
    auth.setActive.mockReturnValue(pending.promise)
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    expect(workspaces()).toEqual([
      ['Alpha Travel', true],
      ['Beta Family', false],
    ])
    expect(router.navigate).not.toHaveBeenCalled()
    expect(router.invalidate).not.toHaveBeenCalled()

    pending.resolve({ data: {}, error: null })
    await vi.waitFor(() => {
      expect(router.invalidate).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps the menu open and busy while in flight, ignores a second choice, then closes', async () => {
    const pending = deferred<{ data: object; error: null }>()
    auth.setActive.mockReturnValue(pending.promise)
    const { user } = await mount(sessionOf([ALPHA, BETA, GAMMA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    // The reader can see something is happening, instead of a menu that vanished and did nothing.
    expect(screen.getByRole('menu')).not.toBeNull()
    expect(
      screen
        .getByRole('group', { name: 'Workspace' })
        .getAttribute('aria-busy'),
    ).toBe('true')
    // A spinner is hidden from a screen reader, so a status region says the switch is running.
    expect(switchStatus().textContent).toBe('Loading')
    // The other choices say they are unavailable instead of silently doing nothing.
    expect(
      screen
        .getByRole('menuitemradio', { name: 'Gamma Clients' })
        .getAttribute('aria-disabled'),
    ).toBe('true')

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Gamma Clients' }),
    )
    expect(auth.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: 'org_b',
    })

    pending.resolve({ data: {}, error: null })
    await vi.waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
    })
    expect(auth.setActive).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledTimes(1))
  })

  it('announces the switch from a region outside the menu, empty when idle', async () => {
    const pending = deferred<{ data: object; error: null }>()
    auth.setActive.mockReturnValue(pending.promise)
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    // ARIA 1.2 does not allow a status region among a menu's children.
    expect(within(screen.getByRole('menu')).queryByRole('status')).toBeNull()
    expect(switchStatus().getAttribute('aria-live')).toBe('polite')
    expect(switchStatus().textContent).toBe('')
    expect(switchStatus().closest('[aria-hidden="true"]')).toBeNull()

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    expect(within(screen.getByRole('menu')).queryByRole('status')).toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(switchStatus().textContent).toBe('Loading')

    pending.resolve({ data: {}, error: null })
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(switchStatus().textContent).toBe('')
  })

  it('describes only the pending workspace by that region', async () => {
    const pending = deferred<{ data: object; error: null }>()
    auth.setActive.mockReturnValue(pending.promise)
    const { user } = await mount(sessionOf([ALPHA, BETA, GAMMA]))
    const beta = screen.getByRole('menuitemradio', { name: 'Beta Family' })
    const gamma = screen.getByRole('menuitemradio', { name: 'Gamma Clients' })
    expect(descriptionOf(beta)).toBe('')

    await user.click(beta)

    expect(beta.getAttribute('aria-describedby')).toBe(switchStatus().id)
    expect(descriptionOf(beta)).toBe('Loading')
    expect(gamma.hasAttribute('aria-describedby')).toBe(false)
    expect(
      screen
        .getByRole('menuitemradio', { name: 'Alpha Travel' })
        .hasAttribute('aria-describedby'),
    ).toBe(false)

    pending.resolve({ data: {}, error: null })
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('keeps the announcement and the pending item description when the menu is reopened mid-switch', async () => {
    const pending = deferred<{ data: object; error: null }>()
    auth.setActive.mockReturnValue(pending.promise)
    const { user, open } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    // The region outlives the menu, so a reopened menu does not mount it already saying "Loading".
    expect(switchStatus().textContent).toBe('Loading')

    await open()

    expect(
      screen
        .getByRole('group', { name: 'Workspace' })
        .getAttribute('aria-busy'),
    ).toBe('true')
    expect(
      descriptionOf(screen.getByRole('menuitemradio', { name: 'Beta Family' })),
    ).toBe('Loading')
    expect(within(screen.getByRole('menu')).queryByRole('status')).toBeNull()

    pending.resolve({ data: {}, error: null })
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('ignores a second tap on the enabled pending workspace', async () => {
    const pending = deferred<{ data: object; error: null }>()
    auth.setActive.mockReturnValue(pending.promise)
    const { user } = await mount(sessionOf([ALPHA, BETA]))
    const beta = screen.getByRole('menuitemradio', { name: 'Beta Family' })

    await user.click(beta)
    expect(beta.getAttribute('aria-disabled')).toBeNull()
    await user.click(beta)
    expect(auth.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: 'org_b',
    })
    expect(screen.getByRole('menu')).not.toBeNull()

    pending.resolve({ data: {}, error: null })
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it.each([false, true])(
    'locks all account actions until switching settles (failure: %s)',
    async (fails) => {
      const pending = deferred<{
        data: object | null
        error: { status: number } | null
      }>()
      auth.setActive.mockReturnValue(pending.promise)
      const signOutRequest = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}'))
      const session = sessionOf([ALPHA, BETA])
      const { user, open } = await mount({
        ...session,
        user: { ...session.user, isPlatformAdmin: true },
      })
      const names = [
        'Settings',
        'Plan and billing',
        'Admin',
        'Platform console',
        'Sign out',
        'Create workspace',
      ]

      await user.click(
        screen.getByRole('menuitemradio', { name: 'Beta Family' }),
      )
      for (const name of names) {
        const item = screen.getByRole('menuitem', { name })
        expect(item.getAttribute('aria-disabled')).toBe('true')
        expect(item.hasAttribute('href')).toBe(false)
        fireEvent.click(item)
      }
      // Keyboard activation must skip disabled destinations too.
      await user.keyboard('{End}{Enter}')
      expect(router.navigate).not.toHaveBeenCalled()
      expect(signOutRequest).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByRole('menu')).not.toBeNull()

      pending.resolve(
        fails
          ? { data: null, error: { status: 500 } }
          : { data: {}, error: null },
      )
      await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      await open()
      for (const name of names) {
        expect(
          screen.getByRole('menuitem', { name }).getAttribute('aria-disabled'),
        ).toBeNull()
      }
      expect(
        screen.getByRole('menuitem', { name: 'Settings' }).getAttribute('href'),
      ).toBe('/settings')
    },
  )

  it('still refuses a second switch after the menu was closed and reopened mid-flight', async () => {
    const pending = deferred<{ data: object; error: null }>()
    auth.setActive.mockReturnValue(pending.promise)
    const { user, open } = await mount(sessionOf([ALPHA, BETA, GAMMA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))
    // Escape closes the menu and unmounts its content, which used to take the guard with it.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    await open()

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Gamma Clients' }),
    )
    expect(auth.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: 'org_b',
    })

    pending.resolve({ data: {}, error: null })
    await vi.waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  it('closes the menu when the active workspace is chosen again', async () => {
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Alpha Travel' }),
    )

    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('a switch that fails', () => {
  it.each([401, 403, 500, 'network'])(
    'never announces success after %s',
    async (status) => {
      if (status === 'network')
        auth.setActive.mockRejectedValue(new TypeError('Failed to fetch'))
      else
        auth.setActive.mockResolvedValue({
          data: null,
          error: { status, code: 'REFUSED', message: 'Refused' },
        })
      const { user } = await mount(sessionOf([ALPHA, BETA]))
      await user.click(screen.getByRole('menuitemradio', { name: BETA.name }))
      await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(notify.error).toHaveBeenCalledTimes(1)
      expect(notify.success).not.toHaveBeenCalled()
    },
  )

  it('tells the reader and re-syncs after a network failure', async () => {
    auth.setActive.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    await vi.waitFor(() => {
      expect(notify.error).toHaveBeenCalledExactlyOnceWith(
        'Could not switch workspace',
        {
          description:
            'The active workspace could not be confirmed. Reload the page before continuing.',
        },
      )
    })
    expect(router.clearCache).toHaveBeenCalledTimes(1)
    expect(router.navigate).toHaveBeenCalledWith({
      to: '/dashboard',
      replace: true,
    })
    expect(router.invalidate).toHaveBeenCalledTimes(1)
  })

  it.each([400, 429, 500, 503])(
    'tells the reader and re-syncs after a %s refusal',
    async (status) => {
      auth.setActive.mockResolvedValue({
        data: null,
        error: { status, code: 'INTERNAL', message: 'boom' },
      })
      const { user } = await mount(sessionOf([ALPHA, BETA]))

      await user.click(
        screen.getByRole('menuitemradio', { name: 'Beta Family' }),
      )

      await vi.waitFor(() => {
        expect(notify.error).toHaveBeenCalledTimes(1)
      })
      expect(router.clearCache).toHaveBeenCalledTimes(1)
      expect(router.navigate).toHaveBeenCalledWith({
        to: '/dashboard',
        replace: true,
      })
      expect(router.invalidate).toHaveBeenCalledTimes(1)
      if (status === 429) {
        expect(notify.error).toHaveBeenCalledWith(
          'Could not switch workspace',
          {
            description:
              'Too many workspace switches. Wait a moment and try again.',
          },
        )
      }
    },
  )

  it.each(['error', 'notFound'] as const)(
    'does not announce success when the router stores %s without rejecting',
    async (status) => {
      router.invalidate.mockImplementation(async () => {
        router.state.matches = [{ status }]
      })
      const { user } = await mount(sessionOf([ALPHA, BETA]))

      await user.click(screen.getByRole('menuitemradio', { name: BETA.name }))

      await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(notify.error).toHaveBeenCalledExactlyOnceWith(
        'Could not switch workspace',
        {
          description:
            'The active workspace could not be confirmed. Reload the page before continuing.',
        },
      )
      expect(notify.success).not.toHaveBeenCalled()
    },
  )

  it('waits for the foreground reload and keeps account actions locked until it settles', async () => {
    const reload = deferred<void>()
    router.invalidate.mockReturnValue(reload.promise)
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: BETA.name }))

    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))
    expect(router.invalidate).toHaveBeenCalledExactlyOnceWith({ sync: true })
    expect(
      screen
        .getByRole('menuitem', { name: 'Settings' })
        .getAttribute('aria-disabled'),
    ).toBe('true')
    expect(
      screen
        .getByRole('menuitem', { name: 'Sign out' })
        .getAttribute('aria-disabled'),
    ).toBe('true')
    await user.click(screen.getByRole('menuitemradio', { name: BETA.name }))
    expect(auth.setActive).toHaveBeenCalledTimes(1)
    expect(notify.success).not.toHaveBeenCalled()

    reload.resolve()
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(notify.success).toHaveBeenCalledTimes(1)
  })

  it('reports an unconfirmed workspace if activation succeeds but re-sync fails', async () => {
    router.invalidate.mockRejectedValue(new TypeError('Offline'))
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(notify.error).toHaveBeenCalledExactlyOnceWith(
      'Could not switch workspace',
      {
        description:
          'The active workspace could not be confirmed. Reload the page before continuing.',
      },
    )
    expect(router.invalidate).toHaveBeenCalledTimes(1)
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('keeps the failure truthful and releases the menu if re-sync also fails offline', async () => {
    auth.setActive.mockRejectedValue(new TypeError('Failed to fetch'))
    router.navigate.mockRejectedValue(new TypeError('Offline'))
    const { user, open } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(notify.error).toHaveBeenCalledExactlyOnceWith(
      'Could not switch workspace',
      {
        description:
          'The active workspace could not be confirmed. Reload the page before continuing.',
      },
    )
    expect(router.clearCache).toHaveBeenCalledTimes(1)
    expect(router.navigate).toHaveBeenCalledTimes(1)
    await open()
    expect(
      screen
        .getByRole('menuitem', { name: 'Settings' })
        .getAttribute('aria-disabled'),
    ).toBeNull()
  })

  it('re-syncs after a FORBIDDEN, because Better Auth has already cleared the active workspace', async () => {
    // Better Auth nulls `session.activeOrganizationId` before it refuses a non-member, so the next
    // request lands in the oldest membership. A screen that kept showing the old workspace would
    // be showing data the session no longer points at.
    const calls: Array<string> = []
    auth.setActive.mockResolvedValue({
      data: null,
      error: {
        status: 403,
        code: 'USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION',
        message: 'You are not a member of this organization',
      },
    })
    notify.error.mockImplementation(() => calls.push('toast'))
    router.clearCache.mockImplementation(() => {
      calls.push('clearCache')
    })
    router.navigate.mockImplementation(async () => {
      calls.push('navigate')
    })
    router.invalidate.mockImplementation(async () => {
      calls.push('invalidate')
    })
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    await vi.waitFor(() => {
      expect(calls).toEqual(['toast', 'clearCache', 'navigate', 'invalidate'])
    })
    expect(router.navigate).toHaveBeenCalledWith({
      to: '/dashboard',
      replace: true,
    })
    // The refusal is not a connection problem, so the toast does not say it is one.
    expect(notify.error).toHaveBeenCalledExactlyOnceWith(
      'Could not switch workspace',
      undefined,
    )
  })

  it('re-syncs after a 401 too, so the shell can send the reader to sign in', async () => {
    auth.setActive.mockResolvedValue({
      data: null,
      error: { status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
    })
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    await vi.waitFor(() => {
      expect(router.invalidate).toHaveBeenCalledTimes(1)
    })
    expect(router.navigate).toHaveBeenCalledTimes(1)
  })
})

describe('a long list', () => {
  const TEN = Array.from({ length: 10 }, (_, index) => ({
    id: `org_${index}`,
    name: `Workspace ${index + 1}`,
    slug: `workspace-${index + 1}`,
  }))

  it('scrolls inside its own bounded container and bounds the account menu to the viewport', async () => {
    await mount(sessionOf(TEN))

    const scroller = screen.getByRole('group', {
      name: 'Workspace',
    }).parentElement
    expect(scroller?.classList.contains('max-h-64')).toBe(true)
    expect(scroller?.classList.contains('overflow-y-auto')).toBe(true)
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(10)

    // The account menu cannot outgrow the viewport, so Sign out stays reachable at 400% zoom or in
    // landscape. The bound is set on this menu only: the shared `contentClass` stays untouched.
    const menu = screen.getByRole('menu')
    expect(menu.className).toContain(
      'max-h-[var(--radix-dropdown-menu-content-available-height)]',
    )
    expect(menu.className).toContain('overflow-y-auto')
  })

  it('reaches the last workspace from the keyboard', async () => {
    const { user } = await mount(sessionOf(TEN))

    await user.keyboard('{Home}')
    await user.keyboard('{ArrowDown}'.repeat(9))

    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', { name: 'Workspace 10' }),
    )
  })
})

describe('creating a workspace', () => {
  async function openDialog(session: ShellSession = sessionOf([ALPHA, BETA])) {
    const mounted = await mount(session)
    await mounted.user.click(
      screen.getByRole('menuitem', { name: 'Create workspace' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create a workspace',
    })
    return { ...mounted, dialog }
  }

  async function submit(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.type(
      screen.getByRole('textbox', { name: /Workspace name/ }),
      name,
    )
    await user.click(screen.getByRole('button', { name: 'Create workspace' }))
  }

  it('opens a labelled dialog beside the menu, which closes, and says it starts on Free without the current plan', async () => {
    const { dialog } = await openDialog()

    expect(screen.queryByRole('menu')).toBeNull()
    expect(dialog.textContent).toContain(
      'It starts on the Free plan and does not share the plan of the workspace you are in.',
    )
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: /Workspace name/ }),
    )
  })

  it('will not submit a blank name', async () => {
    const { user } = await openDialog()

    expect(
      screen
        .getByRole('button', { name: 'Create workspace' })
        .hasAttribute('disabled'),
    ).toBe(true)
    await user.type(
      screen.getByRole('textbox', { name: /Workspace name/ }),
      '   ',
    )
    expect(
      screen
        .getByRole('button', { name: 'Create workspace' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(workspace.create).not.toHaveBeenCalled()
  })

  it('creates it, closes the dialog and lands in the new workspace the way a switch does', async () => {
    const calls: Array<string> = []
    workspace.create.mockImplementation(async () => {
      calls.push('create')
      return { ok: true, organizationId: 'org_new', activated: true }
    })
    router.clearCache.mockImplementation(() => {
      calls.push('clearCache')
    })
    router.navigate.mockImplementation(async () => {
      calls.push('navigate')
    })
    router.invalidate.mockImplementation(async () => {
      calls.push('invalidate')
    })
    const { user } = await openDialog()

    await submit(user, '  Lisbon  ')

    await vi.waitFor(() => {
      expect(calls).toEqual(['create', 'clearCache', 'navigate', 'invalidate'])
    })
    expect(workspace.create).toHaveBeenCalledExactlyOnceWith({
      data: { name: 'Lisbon' },
    })
    expect(router.navigate).toHaveBeenCalledWith({
      to: '/dashboard',
      replace: true,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    // Creation never goes through the client-side plugin endpoint.
    expect(auth.setActive).not.toHaveBeenCalled()
  })

  it('returns focus to the account menu trigger when the dialog closes', async () => {
    const { user } = await openDialog()

    await user.keyboard('{Escape}')

    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Account menu' }),
    )
  })

  it('explains an upgrade refusal by naming the active workspace, with the link to billing, and keeps the name', async () => {
    workspace.create.mockResolvedValue({
      ok: false,
      reason: 'upgrade-required',
    })
    const { user } = await openDialog(sessionOf([ALPHA, BETA], BETA))

    await submit(user, 'Lisbon')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      '\u201C\u2068Beta Family\u2069\u201D is on the Free plan, and only a workspace on a paid plan can create another. If another of your workspaces is on a paid plan, switch to it and create from there. Otherwise, upgrade \u201C\u2068Beta Family\u2069\u201D.',
    )
    expect(
      within(alert)
        .getByRole('link', { name: 'Plan and billing' })
        .getAttribute('href'),
    ).toBe('/settings/billing')
    expect(
      (
        screen.getByRole('textbox', {
          name: /Workspace name/,
        }) as HTMLInputElement
      ).value,
    ).toBe('Lisbon')
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it('shows the active workspace name as plain text, never as markup, isolated from the sentence direction', async () => {
    workspace.create.mockResolvedValue({
      ok: false,
      reason: 'upgrade-required',
    })
    const hostile: ShellOrganization = {
      id: 'org_h',
      name: '<img src=x onerror=alert(1)>',
      slug: 'hostile',
    }
    const { user } = await openDialog(sessionOf([hostile]))

    await submit(user, 'Lisbon')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      '\u2068<img src=x onerror=alert(1)>\u2069',
    )
    expect(alert.querySelector('img')).toBeNull()
  })

  it.each([
    [
      'limit-reached',
      'You have reached the most workspaces one account can belong to.',
    ],
    [
      'role-required',
      'Only a workspace admin can create a workspace. Ask an admin of this workspace, or switch to a workspace you administer.',
    ],
  ])(
    'says %s categorically, with no billing link and no number',
    async (reason, copy) => {
      workspace.create.mockResolvedValue({ ok: false, reason })
      const { user } = await openDialog()

      await submit(user, 'Lisbon')

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain(copy)
      expect(within(alert).queryByRole('link')).toBeNull()
      expect(alert.textContent).not.toMatch(/\d/)
      expect(router.navigate).not.toHaveBeenCalled()
    },
  )

  it('shows the authored sentence of a thrown refusal', async () => {
    workspace.create.mockRejectedValue(
      new Error(
        encodePublicFailure({
          kind: 'refusal',
          message:
            'Creating a workspace is unavailable while you are impersonating someone.',
        }),
      ),
    )
    const { user } = await openDialog()

    await submit(user, 'Lisbon')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
      'Creating a workspace is unavailable while you are impersonating someone.',
    )
    // A server sentence is English whatever the locale, so it is marked as such.
    expect(alert.querySelector('[lang="en"][dir="ltr"]')).not.toBeNull()
    // A refusal wrote nothing: the page behind the dialog stays where it is.
    expect(router.invalidate).not.toHaveBeenCalled()
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it('closes and says so when the workspace was written but could not be activated', async () => {
    workspace.create.mockResolvedValue({
      ok: true,
      organizationId: 'org_new',
      activated: false,
    })
    const { user } = await openDialog()

    await submit(user, 'Lisbon')

    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(notify.error).toHaveBeenCalledWith('Could not switch workspace', {
      description: 'Check your connection and try again.',
    })
    // The switcher re-reads the shell, so the written workspace is in the list.
    expect(router.invalidate).toHaveBeenCalled()
  })

  it('keeps the dialog open while the create is in flight, and announces the wait', async () => {
    const pending = deferred<{
      ok: true
      organizationId: string
      activated: boolean
    }>()
    workspace.create.mockReturnValue(pending.promise)
    const { user } = await openDialog()

    await submit(user, 'Lisbon')
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(
      within(screen.getByRole('dialog')).getByRole('status').textContent,
    ).toBe('Loading')

    pending.resolve({ ok: true, organizationId: 'org_new', activated: true })
    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('falls back to the catalogue sentence for any other failure, and re-reads the shell', async () => {
    workspace.create.mockRejectedValue(new Error('D1_ERROR: no such column'))
    const { user } = await openDialog()

    await submit(user, 'Lisbon')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Could not create the workspace')
    expect(alert.textContent).not.toContain('D1_ERROR')
    // Activation can fail after the workspace was written; the switcher should then list it.
    expect(router.invalidate).toHaveBeenCalled()
  })

  it('starts the next opening clean', async () => {
    workspace.create.mockResolvedValue({ ok: false, reason: 'role-required' })
    const { user } = await openDialog()
    await submit(user, 'Lisbon')
    await screen.findByRole('alert')
    await user.keyboard('{Escape}')
    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Create workspace' }))

    await screen.findByRole('dialog', { name: 'Create a workspace' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      (
        screen.getByRole('textbox', {
          name: /Workspace name/,
        }) as HTMLInputElement
      ).value,
    ).toBe('')
  })
})
