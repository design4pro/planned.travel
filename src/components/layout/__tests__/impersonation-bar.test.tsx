// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Dialog, DialogContent, DialogTitle } from '#/components/ui'
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
/** The toast surface, captured: what the operator is told is under test here. */
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('#/server/fns/console/impersonation', () => ({
  endImpersonationFn: exit.end,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))
vi.mock('sonner', () => ({ toast: notify }))

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

  it('installs no clock on an ordinary session', () => {
    // The countdown lives in an inner component that only an impersonated
    // session mounts. Called from the outer one it would be unconditional — a
    // one-second interval and a `setState` per tick on every authenticated page
    // of every session in the product, to render nothing.
    const interval = vi.spyOn(globalThis, 'setInterval')
    render(<ImpersonationBar session={sessionWith(false)} />)
    expect(interval).not.toHaveBeenCalled()

    render(<ImpersonationBar session={sessionWith(true)} />)
    expect(interval).toHaveBeenCalled()
    interval.mockRestore()
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

  it('gives each identity a line of its own where the row is narrow', () => {
    // At 360px the identity column is about 190px. One shared line put the two
    // names in competition and the operator, being last, lost it; capping the
    // operator at half the row stopped it vanishing but stranded the account's
    // unused slack, so a long operator name was still clipped with a quarter of
    // its own line empty beside it. jsdom lays nothing out, so what is asserted
    // is the mechanism: the column stacks below `sm` and only becomes a row from
    // `sm`, and neither span carries a width ceiling that could hold space back
    // from the other.
    render(<ImpersonationBar session={sessionWith(true)} />)
    const bar = screen.getByRole('region', { name: 'Impersonated session' })

    const identity = bar.querySelector('p')
    expect(identity?.className).toContain('flex-col')
    expect(identity?.className).toContain('sm:flex-row')

    const [acted, operator] = [...(identity?.children ?? [])]
    expect(acted.textContent).toContain('Kasia Nowak')
    expect(operator.textContent).toContain('Rafal Wolak')
    // Each clips only itself…
    expect(acted.className).toContain('truncate')
    expect(operator.className).toContain('truncate')
    expect(acted.className).toContain('min-w-0')
    expect(operator.className).toContain('min-w-0')
    // …and neither is given a ceiling or refused the right to shrink, which is
    // what leaves the sharing to the space actually available.
    for (const span of [acted, operator]) {
      expect(span.className).not.toMatch(/\bmax-w-/)
      expect(span.className).not.toMatch(/\bshrink-0\b/)
    }
    expect(acted.contains(operator)).toBe(false)
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

  it('stays reachable while a modal traps focus inside itself', async () => {
    // A Radix modal takes the bar away three separate times: `hideOthers()`
    // marks it `aria-hidden`, `DismissableLayer` puts `pointer-events: none` on
    // the body, and `FocusScope` pulls focus back into the panel. ACCESS §6.1
    // says the one control that ends somebody else's session may not be covered
    // — and a focus trap covers it as surely as a toast does.
    render(
      <>
        <ImpersonationBar session={sessionWith(true)} />
        <Dialog open>
          <DialogContent hideClose>
            <DialogTitle>Suspend this account</DialogTitle>
            <button type="button">Inside the dialog</button>
          </DialogContent>
        </Dialog>
      </>,
    )

    const inside = await screen.findByRole('button', {
      name: 'Inside the dialog',
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(inside)
    })

    // AT: found by role at all, which means the subtree is not `aria-hidden`.
    const bar = screen.getByRole('region', { name: 'Impersonated session' })
    expect(bar.getAttribute('aria-hidden')).toBeNull()
    expect(bar.getAttribute('aria-live')).toBe('off')
    // Pointer: the body is inert, this is not, and its band is above the modal.
    expect(bar.className).toContain('pointer-events-auto')
    expect(bar.className).toContain('z-impersonation')

    // Keyboard: the chord the button publishes as `aria-keyshortcuts`, pressed
    // from inside the panel, lands focus on the exit — and it stays there.
    const control = screen.getByRole('button', { name: 'End impersonation' })
    expect(control.getAttribute('aria-keyshortcuts')).toBe('Alt+Shift+E')
    fireEvent.keyDown(inside, { code: 'KeyE', altKey: true, shiftKey: true })
    await waitFor(() => {
      expect(document.activeElement).toBe(control)
    })
    fireEvent.focusIn(control)
    expect(document.activeElement).toBe(control)
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

  it('tells the operator what to do rather than repeating the failure', async () => {
    // The plugin answers a missing signed `admin_session` cookie with an
    // internal 500 describing its own lookup. Rendered verbatim, an operator
    // holding somebody else's live credential reads a stack-trace fragment
    // instead of an instruction.
    const internal = 'Failed to find admin session'
    exit.end.mockRejectedValue(new Error(internal))
    render(<ImpersonationBar session={sessionWith(true)} />)

    await user().click(
      screen.getByRole('button', { name: 'End impersonation' }),
    )

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalled()
    })
    const [title, options] = notify.error.mock.calls[0] as [
      string,
      { description?: string },
    ]
    expect(title).toBe('Could not end impersonation')
    expect(options.description).not.toContain(internal)
    expect(options.description).toMatch(/Reload the page/)
  })

  it('reports the exit that happened, not the refresh that did not', async () => {
    // The session is already the operator's own by the time the router is
    // touched. Reporting a failed `invalidate` as "could not end impersonation"
    // tells somebody holding their own credential that they are still holding
    // somebody else's — the more dangerous of the two wrong answers.
    router.invalidate.mockRejectedValue(new Error('loader blew up'))
    render(<ImpersonationBar session={sessionWith(true)} />)

    await user().click(
      screen.getByRole('button', { name: 'End impersonation' }),
    )

    await waitFor(() => {
      expect(notify.success).toHaveBeenCalled()
    })
    expect(notify.error).not.toHaveBeenCalled()
    const [title, options] = notify.success.mock.calls[0] as [
      string,
      { description?: string },
    ]
    expect(title).toBe('Impersonation ended')
    // …and it says what is still owed, rather than pretending nothing happened.
    expect(options.description).toMatch(/Reload the page/)
  })

  it('recognises the exit’s own refusal and answers it in kind', async () => {
    // `ConsoleActionError` crosses the serialization boundary as data, so the
    // code is read structurally rather than with `instanceof`.
    exit.end.mockRejectedValue(
      Object.assign(new Error('not impersonating'), {
        code: 'not-impersonating',
      }),
    )
    render(<ImpersonationBar session={sessionWith(true)} />)

    await user().click(
      screen.getByRole('button', { name: 'End impersonation' }),
    )

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalled()
    })
    const [, options] = notify.error.mock.calls[0] as [
      string,
      { description?: string },
    ]
    expect(options.description).toMatch(/already your own/)
  })
})
