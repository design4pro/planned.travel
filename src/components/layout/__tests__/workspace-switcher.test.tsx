// The menu mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

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

beforeEach(() => {
  auth.setActive.mockReset()
  router.clearCache.mockReset()
  router.invalidate.mockReset()
  router.navigate.mockReset()
  notify.error.mockReset()
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

  it('offers no way to create a workspace in this slice', async () => {
    await mount(sessionOf([ALPHA, BETA]))

    expect(screen.queryByText(/create/i)).toBeNull()
    expect(auth.setActive).not.toHaveBeenCalled()
  })

  it('does nothing when the active workspace is chosen again', async () => {
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Alpha Travel' }),
    )

    expect(auth.setActive).not.toHaveBeenCalled()
    expect(router.navigate).not.toHaveBeenCalled()
  })
})

describe('switching', () => {
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
  it('tells the reader and stays where it is when the request never arrived', async () => {
    auth.setActive.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    await vi.waitFor(() => {
      expect(notify.error).toHaveBeenCalledExactlyOnceWith(
        'Could not switch workspace',
        { description: 'Check your connection and try again.' },
      )
    })
    expect(router.navigate).not.toHaveBeenCalled()
    expect(router.invalidate).not.toHaveBeenCalled()
  })

  it('tells the reader and stays where it is on any refusal that is not a 403', async () => {
    auth.setActive.mockResolvedValue({
      data: null,
      error: { status: 500, code: 'INTERNAL', message: 'boom' },
    })
    const { user } = await mount(sessionOf([ALPHA, BETA]))

    await user.click(screen.getByRole('menuitemradio', { name: 'Beta Family' }))

    await vi.waitFor(() => {
      expect(notify.error).toHaveBeenCalledTimes(1)
    })
    expect(router.navigate).not.toHaveBeenCalled()
    expect(router.invalidate).not.toHaveBeenCalled()
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
