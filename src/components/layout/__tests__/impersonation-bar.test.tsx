// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ImpersonationBar } from '../impersonation-bar'

import type { ShellSession } from '../session'

/**
 * The exit and the router, stood in for.
 *
 * `#/server/fns/console/impersonation` reaches Better Auth and the Cloudflare
 * request scope, neither of which resolves in jsdom, and `useRouter` needs a
 * router above it. What is left is the subject of this file: what the bar says,
 * what it does with the one promise it owns, and what it refuses to grow.
 */
const exit = vi.hoisted(() => ({ end: vi.fn() }))
const router = vi.hoisted(() => ({ invalidate: vi.fn(), navigate: vi.fn() }))

vi.mock('#/server/fns/console/impersonation', () => ({
  endImpersonationFn: exit.end,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

/** A promise this test settles by hand, so "in flight" is a state it can hold. */
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

const NOW = Date.parse('2026-08-25T10:00:00.000Z')

function sessionWith(impersonated: boolean): ShellSession {
  return {
    user: {
      id: 'usr_target',
      name: 'Kasia Nowak',
      email: 'kasia@example.com',
      image: null,
      isAdmin: true,
      platformRole: 'user',
      isPlatformAdmin: false,
      isCurator: false,
    },
    organization: { id: 'org_1', name: 'Nowak Travel', slug: 'nowak-travel' },
    organizations: [],
    impersonatedBy: impersonated
      ? { id: 'usr_operator', name: 'Rafal Wolak', email: 'ops@example.com' }
      : null,
    // 14:59 left, so the first tick is unambiguous in both directions.
    expiresAt: new Date(NOW + 899_000).toISOString(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
  exit.end.mockResolvedValue({ userId: 'usr_target' })
  router.invalidate.mockResolvedValue(undefined)
  router.navigate.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

describe('the impersonation bar', () => {
  it('renders nothing at all on an ordinary session', () => {
    const { container } = render(
      <ImpersonationBar session={sessionWith(false)} />,
    )
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('names the account being acted on and the operator acting', async () => {
    render(<ImpersonationBar session={sessionWith(true)} />)

    const bar = screen.getByRole('region', { name: 'Impersonated session' })
    // Both identities, in the text a reader actually gets — not in an attribute.
    expect(bar.textContent).toContain('Kasia Nowak')
    expect(bar.textContent).toContain('Rafal Wolak')
    expect(bar.textContent).toContain('Impersonated session')
  })

  it('counts the session down from its own expiry, in tabular figures', async () => {
    render(<ImpersonationBar session={sessionWith(true)} />)

    const timer = await screen.findByRole('timer')
    await waitFor(() => {
      expect(timer.textContent).toBe('14:59')
    })
    expect(timer.className).toContain('numeral')
    expect(timer.getAttribute('aria-label')).toBe('14 minutes remaining')

    await vi.advanceTimersByTimeAsync(2_000)
    await waitFor(() => {
      expect(timer.textContent).toBe('14:57')
    })
  })

  it('falls back to the operator id when the row could not be named', () => {
    const session = sessionWith(true)
    render(
      <ImpersonationBar
        session={{
          ...session,
          impersonatedBy: { id: 'usr_operator', name: null, email: null },
        }}
      />,
    )
    expect(
      screen.getByRole('region', { name: 'Impersonated session' }).textContent,
    ).toContain('usr_operator')
  })

  it('says so when the session has already expired, and keeps the way out', async () => {
    // The server-side expiry in docs/ACCESS.md §6.2 ends the session whether the
    // tab is looking or not, so the bar has to describe that rather than count
    // into negative numbers — and the button stays, because a stale cookie still
    // needs clearing.
    const session = sessionWith(true)
    render(
      <ImpersonationBar
        session={{ ...session, expiresAt: new Date(NOW - 5_000).toISOString() }}
      />,
    )

    const timer = await screen.findByRole('timer')
    await waitFor(() => {
      expect(timer.textContent).toBe('00:00')
    })
    expect(timer.getAttribute('aria-label')).toBe(
      'This impersonated session has expired',
    )
    expect(
      screen.getByRole('region', { name: 'Impersonated session' }).textContent,
    ).toContain('Expired')
    expect(
      screen
        .getByRole('button', { name: 'End impersonation' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('offers exactly one control, and it is not a dismiss', () => {
    render(<ImpersonationBar session={sessionWith(true)} />)

    const controls = screen.getAllByRole('button')
    expect(controls).toHaveLength(1)
    expect(controls[0].getAttribute('aria-label')).toBe('End impersonation')
    // The bar is the first thing in the shell, so its only focusable element is
    // the shell's first tab stop. Nothing else here may take focus.
    const bar = screen.getByRole('region', { name: 'Impersonated session' })
    expect(
      bar.querySelectorAll('a, button, input, select, textarea, [tabindex]'),
    ).toHaveLength(1)
    for (const label of ['Dismiss', 'Close', 'Hide']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull()
    }
  })

  it('ends the session, throws away the loaders, and lands on the operator’s own screen', async () => {
    render(<ImpersonationBar session={sessionWith(true)} />)

    await user().click(
      screen.getByRole('button', { name: 'End impersonation' }),
    )

    await waitFor(() => {
      expect(exit.end).toHaveBeenCalledWith({ data: {} })
    })
    // The cookie has been swapped; loader results resolved for the impersonated
    // account must not survive it.
    expect(router.invalidate).toHaveBeenCalledTimes(1)
    expect(router.navigate).toHaveBeenCalledWith({
      to: '/dashboard',
      replace: true,
    })
  })

  it('shows the button busy while the exit is in flight, and never twice', async () => {
    const pending = deferred<{ userId: string }>()
    exit.end.mockReturnValue(pending.promise)
    render(<ImpersonationBar session={sessionWith(true)} />)

    const button = screen.getByRole('button', { name: 'End impersonation' })
    await user().click(button)

    await waitFor(() => {
      expect(button.hasAttribute('disabled')).toBe(true)
    })
    expect(button.getAttribute('aria-busy')).toBe('true')

    await user().click(button)
    expect(exit.end).toHaveBeenCalledTimes(1)

    pending.resolve({ userId: 'usr_target' })
    await waitFor(() => {
      expect(router.invalidate).toHaveBeenCalled()
    })
  })

  it('gives the button back when the exit fails, because it is the only way out', async () => {
    exit.end.mockRejectedValue(new Error('You are not impersonating anyone.'))
    render(<ImpersonationBar session={sessionWith(true)} />)

    const button = screen.getByRole('button', { name: 'End impersonation' })
    await user().click(button)

    await waitFor(() => {
      expect(button.hasAttribute('disabled')).toBe(false)
    })
    expect(router.navigate).not.toHaveBeenCalled()
  })
})
