// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SIGN_OUT_ENDPOINT } from '#/components/layout/session'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Marketing from '#/lib/i18n/messages/en/marketing'
import Shell from '#/lib/i18n/messages/en/shell'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { JoinCard, JoinFrame, JoinSkeleton, RetryCard } from '../join-card'

import type { Catalogue } from '#/lib/i18n'
import type { JoinAnswer } from '../../-lib/join'
import type { InviteView } from '../../-lib/view'
import type { ReactNode } from 'react'

const auth = vi.hoisted(() => ({ setActive: vi.fn() }))

vi.mock('#/lib/auth/client', () => ({
  authClient: { organization: { setActive: auth.setActive } },
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const EN: Catalogue = {
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('marketing', Marketing),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const PATH = '/join/the-secret'
const noop = () => Promise.resolve()

const joinedAnswer: JoinAnswer = {
  outcome: 'joined',
  tripId: 'trip-1',
  organizationId: 'org-1',
  switchWorkspace: false,
}

function renderView(
  view: InviteView,
  onRetry: () => Promise<void> = noop,
  onJoin: () => Promise<JoinAnswer> = () => Promise.resolve(joinedAnswer),
) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <JoinCard view={view} path={PATH} onRetry={onRetry} onJoin={onJoin} />
    </I18nProvider>,
  )
}

const invited = {
  state: 'invited',
  signedIn: false,
  tripTitle: 'Lisbon',
  inviterName: 'Ada',
  inviterImage: null,
  role: 'editor',
} as const

const signedIn = {
  ...invited,
  signedIn: true,
  startDate: '2027-05-01',
  endDate: '2027-05-09',
  destination: 'Portugal',
} as const

beforeEach(() => auth.setActive.mockReset())
afterEach(cleanup)

describe('JoinCard', () => {
  it('invites an anonymous visitor to sign in and come back to the same link', () => {
    renderView(invited)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Ada invited you to a trip',
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "This link works for people who are already in Ada's workspace.",
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'New here? Ask Ada to add you to their workspace first.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'),
    ).toBe(`/login?redirect=${encodeURIComponent(PATH)}`)
    expect(screen.getByText('Lisbon')).toBeTruthy()
    expect(screen.getByText('Editor')).toBeTruthy()
    expect(screen.queryByText('Dates')).toBeNull()
  })

  it('shows a signed-in visitor the dates and destination and one action to join', () => {
    renderView(signedIn)
    expect(screen.getByText('Dates')).toBeTruthy()
    expect(screen.getByText('Portugal')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    expect(screen.queryByText(/New here/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Join this trip' })).toBeTruthy()
  })

  it('opens the trip for a member whose workspace is already active', () => {
    renderView({
      state: 'member',
      tripId: 'trip-1',
      organizationId: 'org-1',
      switchWorkspace: false,
    })
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'You are already on this trip',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Open the trip' }).getAttribute('href'),
    ).toBe('/trips/trip-1')
  })

  it('sends a member whose session ended to sign in again instead of offering a retry that cannot work', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    auth.setActive.mockResolvedValueOnce({ error: { status: 401 } })
    renderView({
      state: 'member',
      tripId: 'trip-1',
      organizationId: 'org-1',
      switchWorkspace: true,
    })
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Open the trip and switch workspace',
      }),
    )
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent(PATH)}`,
      ),
    )
    expect(screen.queryByText(/Could not switch workspace/)).toBeNull()
    vi.unstubAllGlobals()
  })

  it('switches workspace before it opens the trip, and says so when that fails', async () => {
    auth.setActive.mockResolvedValueOnce({ error: { status: 500 } })
    renderView({
      state: 'member',
      tripId: 'trip-1',
      organizationId: 'org-1',
      switchWorkspace: true,
    })
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Open the trip and switch workspace',
      }),
    )
    expect(auth.setActive).toHaveBeenCalledWith({ organizationId: 'org-1' })
    await waitFor(() =>
      expect(
        screen.getByText('Could not switch workspace. Try again.'),
      ).toBeTruthy(),
    )
    expect(
      screen.getByRole('button', {
        name: 'Open the trip and switch workspace',
      }),
    ).toBeTruthy()
  })

  it('tells someone outside the workspace which address they are using and what to do', () => {
    renderView({
      state: 'needs-workspace',
      tripTitle: 'Lisbon',
      inviterName: 'Ada',
      email: 'out@example.test',
    })
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'This trip is in a workspace you are not part of',
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'You are signed in as out@example.test. Tell Ada to use this address.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to your trips' })).toBeTruthy()
    expect(screen.queryByText('Lisbon')).toBeNull()
  })

  it('ends the session before it goes to sign in as someone else', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const fetched = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetched)
    renderView({
      state: 'needs-workspace',
      tripTitle: 'Lisbon',
      inviterName: 'Ada',
      email: 'out@example.test',
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Sign in with another account' }),
    )
    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(fetched).toHaveBeenCalledWith(
      SIGN_OUT_ENDPOINT,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(assign).toHaveBeenCalledWith(
      `/login?redirect=${encodeURIComponent(PATH)}`,
    )
    vi.unstubAllGlobals()
  })

  it('stays on the card and says so when the session cannot be ended', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    renderView({
      state: 'needs-workspace',
      tripTitle: 'Lisbon',
      inviterName: 'Ada',
      email: 'out@example.test',
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Sign in with another account' }),
    )
    expect(await screen.findByText('Could not sign you out')).toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('sends an anonymous visitor to sign in and a signed-in one to their trips from a dead link', () => {
    const { unmount } = renderView({ state: 'unavailable', signedIn: false })
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'This invite link is not available',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()
    unmount()
    renderView({ state: 'unavailable', signedIn: true })
    expect(
      screen
        .getByRole('link', { name: 'Go to your trips' })
        .getAttribute('href'),
    ).toBe('/trips')
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
  })

  it('says the page is busy, without blame, and lets the visitor try again', async () => {
    const retry = vi.fn(() => Promise.resolve())
    renderView({ state: 'busy', retryAfter: 30 }, retry)
    expect(
      screen.getByText('This page is busy. Try again in a minute.'),
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})

describe('joining from the card', () => {
  const join = () =>
    userEvent.click(screen.getByRole('button', { name: 'Join this trip' }))

  it('puts the traveller on the trip, says so and moves focus to the new heading', async () => {
    const onJoin = vi.fn(() => Promise.resolve(joinedAnswer))
    renderView(signedIn, noop, onJoin)
    await join()
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'You are on the trip',
    })
    expect(onJoin).toHaveBeenCalledOnce()
    expect(screen.getByText('Open it to see the plan.')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Open the trip' }).getAttribute('href'),
    ).toBe('/trips/trip-1')
    expect(document.activeElement).toBe(heading)
    // The focus move is the announcement: no live region speaks as well.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("offers to switch workspace first when the active one is not the trip's", async () => {
    renderView(signedIn, noop, () =>
      Promise.resolve({ ...joinedAnswer, switchWorkspace: true }),
    )
    await join()
    expect(
      await screen.findByRole('button', {
        name: 'Open the trip and switch workspace',
      }),
    ).toBeTruthy()
  })

  it('keeps the button and says so when the switch after joining fails', async () => {
    auth.setActive.mockResolvedValueOnce({ error: { status: 500 } })
    renderView(signedIn, noop, () =>
      Promise.resolve({ ...joinedAnswer, switchWorkspace: true }),
    )
    await join()
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Open the trip and switch workspace',
      }),
    )
    expect(auth.setActive).toHaveBeenCalledWith({ organizationId: 'org-1' })
    expect(
      await screen.findByText('Could not switch workspace. Try again.'),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'Open the trip and switch workspace',
      }),
    ).toBeTruthy()
  })

  it('shows joined, not already a member, when a retry comes back as member straight after the tap', async () => {
    renderView(signedIn, noop, () =>
      Promise.resolve({ ...joinedAnswer, outcome: 'member' }),
    )
    await join()
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You are on the trip',
      }),
    ).toBeTruthy()
    expect(screen.queryByText('You are already on this trip')).toBeNull()
  })

  it('holds the button busy and named for the joining while the request runs', async () => {
    let finish: (answer: JoinAnswer) => void = () => undefined
    renderView(
      signedIn,
      noop,
      () => new Promise<JoinAnswer>((resolve) => (finish = resolve)),
    )
    await join()
    const busy = screen.getByRole('button', { name: /Joining the trip/ })
    expect(busy.getAttribute('aria-busy')).toBe('true')
    finish(joinedAnswer)
    await screen.findByRole('heading', {
      level: 1,
      name: 'You are on the trip',
    })
  })

  it('shows the unavailable card in place, with focus on its heading, when the link is refused', async () => {
    const retry = vi.fn(() => Promise.resolve())
    renderView(signedIn, retry, () =>
      Promise.resolve({ outcome: 'unavailable' }),
    )
    await join()
    const heading = await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Join this trip' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(heading))
    // A reload could hand back the invited card; the answer already said enough.
    expect(retry).not.toHaveBeenCalled()
  })

  it('reloads the card when the traveller turns out not to be in the workspace', async () => {
    const retry = vi.fn(() => Promise.resolve())
    renderView(signedIn, retry, () =>
      Promise.resolve({ outcome: 'needs-workspace' }),
    )
    await join()
    await waitFor(() => expect(retry).toHaveBeenCalledOnce())
  })

  it('says the page is busy without blame, announced by an alert, with the button described by it', async () => {
    renderView(signedIn, noop, () =>
      Promise.resolve({ outcome: 'busy', retryAfter: 30 }),
    )
    await join()
    const button = await screen.findByRole('button', { name: 'Join this trip' })
    expect(
      screen.getByText('This page is busy. Try again in a minute.'),
    ).toBeTruthy()
    // Focus never left the button, so no focus move can announce this: the alert does.
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('This page is busy. Try again in a minute.')
    expect(button.getAttribute('aria-describedby')).toBe(alert.id)
  })

  it('keeps the link usable after a failed join, announces it and lets the traveller try again', async () => {
    const onJoin = vi
      .fn<() => Promise<JoinAnswer>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(joinedAnswer)
    renderView(signedIn, noop, onJoin)
    await join()
    await screen.findByRole('button', { name: 'Join this trip' })
    expect(screen.getByRole('alert').textContent).toBe(
      'Could not join. The link still works - try again.',
    )
    await join()
    await screen.findByRole('heading', {
      level: 1,
      name: 'You are on the trip',
    })
    expect(onJoin).toHaveBeenCalledTimes(2)
  })
})

describe('the rest of the page', () => {
  it('holds the retry button busy while the page reloads and focuses the new card heading', async () => {
    let finish: () => void = noop
    const retry = vi.fn(
      () => new Promise<void>((resolve) => (finish = () => resolve())),
    )
    const page = (view: InviteView) => (
      <I18nProvider locale="en" messages={EN}>
        <JoinFrame>
          <JoinCard
            view={view}
            path={PATH}
            onRetry={retry}
            onJoin={() => Promise.resolve(joinedAnswer)}
          />
        </JoinFrame>
      </I18nProvider>
    )
    const { rerender } = render(page({ state: 'busy', retryAfter: 30 }))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      screen
        .getByRole('button', { name: /Try again/ })
        .getAttribute('aria-busy'),
    ).toBe('true')
    finish()
    // The same frame stays mounted: only the card in it changes, as it does after a real retry.
    rerender(page(invited))
    expect(document.activeElement?.textContent).toBe(
      'Ada invited you to a trip',
    )
  })

  it('offers a retry without the busy line when the read failed', () => {
    render(
      <I18nProvider locale="en" messages={EN}>
        <RetryCard busy={false} onRetry={noop} />
      </I18nProvider>,
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByText(/busy/)).toBeNull()
  })

  it('announces the loading state once', () => {
    render(
      <I18nProvider locale="en" messages={EN}>
        <JoinSkeleton />
      </I18nProvider>,
    )
    expect(screen.getByRole('status').textContent).toBe('Loading the invite')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('wears guest chrome that keeps no sign-up link, with one main landmark', () => {
    render(
      <I18nProvider locale="en" messages={EN}>
        <JoinFrame>
          <p>card</p>
        </JoinFrame>
      </I18nProvider>,
    )
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeTruthy()
    expect(
      screen.queryByRole('link', { name: /Start free|Sign in/ }),
    ).toBeNull()
    expect(screen.queryByRole('link', { name: 'See pricing' })).toBeNull()
  })
})
