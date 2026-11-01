// The dialogs mount Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'

import type { Catalogue } from '#/lib/i18n'
import type { TripPeoplePayload } from '../../-server/people'

const mocks = vi.hoisted(() => ({
  visibility: vi.fn(),
  removeGuest: vi.fn(),
  renameGuest: vi.fn(),
  mergeGuest: vi.fn(),
  removeMember: vi.fn(),
  invalidate: vi.fn(),
}))

// The screen's module imports the server functions, which reach `cloudflare:workers`.
vi.mock('../../-server/people', () => ({
  addTripGuestFn: vi.fn(),
  addTripMemberFn: vi.fn(),
  leaveTripFn: vi.fn(),
  mergeTripGuestFn: mocks.mergeGuest,
  removeTripGuestFn: mocks.removeGuest,
  removeTripMemberFn: mocks.removeMember,
  renameTripGuestFn: mocks.renameGuest,
  setTripRoleFn: vi.fn(),
  setTripVisibilityFn: mocks.visibility,
}))
vi.mock('../../-server/invite', () => ({}))
vi.mock('../../../../-ui/trip-header', () => ({ TripModuleHeader: () => null }))
vi.mock('../invite-link-panel', () => ({ InviteLinkPanel: () => null }))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => {},
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))

const { PeopleScreen } = await import('../people-screen')

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('trips', Trips),
  ...namespaceCatalogue('ui', Ui),
}

const REFUSED = 'You can no longer manage this trip.'

const owned: TripPeoplePayload = {
  tripId: 't1',
  visibility: 'private',
  viewerUserId: 'user-me',
  viewerRole: 'owner',
  participants: [
    {
      kind: 'member',
      memberId: 'member-me',
      userId: 'user-me',
      role: 'owner',
      colour: null,
      name: 'Me',
      image: null,
    },
    {
      kind: 'member',
      memberId: 'member-marek',
      userId: 'user-marek',
      role: 'editor',
      colour: null,
      name: 'Marek',
      image: null,
    },
    { kind: 'guest', guestId: 'guest-anna', displayName: 'Anna', colour: null },
  ],
  invitable: [],
  guestLimit: 10,
  invite: null,
  inviteArchived: false,
}
const demoted: TripPeoplePayload = { ...owned, viewerRole: 'editor' }

function failedWith(kind: 'refusal' | 'validation' | 'unexpected'): Error {
  return new Error(
    encodePublicFailure(
      kind === 'unexpected'
        ? { kind, reference: 'ref-1' }
        : { kind, message: REFUSED },
    ),
  )
}

function screenFor(data: TripPeoplePayload) {
  return (
    <I18nProvider locale="en" messages={EN}>
      <PeopleScreen data={data} />
    </I18nProvider>
  )
}

/** Mounts the owner's screen; the next re-read hands the same screen the demoted payload. */
function mountOwner() {
  const view = render(screenFor(owned))
  mocks.invalidate.mockImplementation(async () => {
    view.rerender(screenFor(demoted))
  })
  return view
}

const switchLabel = 'Visible to everyone in the workspace'

beforeEach(() => {
  mocks.invalidate.mockReset()
})

afterEach(() => {
  cleanup()
  for (const mock of Object.values(mocks)) mock.mockReset()
})

describe('a write the server refused as a refusal', () => {
  it('re-reads the screen, keeps the refusal once, takes the control away and focuses the refusal', async () => {
    mocks.visibility.mockRejectedValue(failedWith('refusal'))
    mountOwner()

    await userEvent.click(screen.getByRole('switch', { name: switchLabel }))

    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(REFUSED)
    expect(screen.queryByRole('switch', { name: switchLabel })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rename Anna' })).toBeNull()
    // The switch held focus and left with the owner controls; nothing offers to resend the write.
    expect(document.activeElement).toBe(alert.parentElement)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('closes an open dialog on the refusal, which cannot write again, and focuses the refusal', async () => {
    mocks.removeGuest.mockRejectedValue(failedWith('refusal'))
    mountOwner()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Anna from this trip' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await act(async () => {})

    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    expect(mocks.removeGuest).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(REFUSED)
    expect(document.activeElement).toBe(alert.parentElement)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('still shows the refusal when the dialog was cancelled before the answer came', async () => {
    let refuse!: (error: Error) => void
    mocks.removeGuest.mockReturnValue(
      new Promise<never>((_, no) => {
        refuse = no
      }),
    )
    mountOwner()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Anna from this trip' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await act(async () => refuse(failedWith('refusal')))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain(REFUSED)
  })

  it('shows the refusal even when the re-read itself fails', async () => {
    mocks.visibility.mockRejectedValue(failedWith('refusal'))
    render(screenFor(owned))
    mocks.invalidate.mockRejectedValue(new Error('offline'))

    await userEvent.click(screen.getByRole('switch', { name: switchLabel }))

    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toContain(REFUSED)
  })
})

describe('a write that failed any other way', () => {
  it.each(['validation', 'unexpected'] as const)(
    'does not re-read after a %s failure',
    async (kind) => {
      mocks.visibility.mockRejectedValue(failedWith(kind))
      mountOwner()

      await userEvent.click(screen.getByRole('switch', { name: switchLabel }))

      expect(screen.getByRole('alert')).toBeTruthy()
      expect(mocks.invalidate).not.toHaveBeenCalled()
      expect(screen.getByRole('switch', { name: switchLabel })).toBeTruthy()
    },
  )

  it('does not re-read after a named outcome such as the last-owner rule', async () => {
    mocks.removeMember.mockResolvedValue({ ok: false, reason: 'last-owner' })
    mountOwner()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Marek from this trip' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await act(async () => {})

    expect(mocks.removeMember).toHaveBeenCalledTimes(1)
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
})
