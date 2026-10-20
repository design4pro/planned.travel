import '#/components/ui/__tests__/test-env'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Trips from '#/lib/i18n/messages/en/trips'
import Ui from '#/lib/i18n/messages/en/ui'
import { InviteLinkPanel } from '../invite-link-panel'
import type { TripInviteView } from '#/server/repos/invites'

const rpc = vi.hoisted(() => ({
  create: vi.fn(),
  reveal: vi.fn(),
  replace: vi.fn(),
  update: vi.fn(),
}))
vi.mock('../../-server/invite', () => ({
  createInviteLinkFn: rpc.create,
  revealInviteLinkFn: rpc.reveal,
  replaceInviteLinkFn: rpc.replace,
  updateInviteLinkFn: rpc.update,
}))
vi.mock('../../-server/people', () => ({}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => {},
  useRouter: () => ({}),
}))
const active: TripInviteView = {
  id: 'link',
  tripId: 'trip',
  role: 'viewer',
  rotation: 0,
  createdBy: 'owner',
  rotatedAt: new Date(),
  disabledAt: null,
  lastUsedAt: null,
  useCount: 0,
  state: 'active',
}
function show(initial: TripInviteView | null = null, archived = false) {
  return render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('trips', Trips),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <InviteLinkPanel tripId="trip" initial={initial} archived={archived} />
    </I18nProvider>,
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  rpc.reveal.mockResolvedValue({ ok: true, invite: active, secret: 'secret' })
  rpc.create.mockResolvedValue({ ok: true, invite: active, secret: 'secret' })
})
afterEach(cleanup)
describe('invite link panel', () => {
  it('creates by keyboard and moves focus to Copy; announces copy success', async () => {
    const user = userEvent.setup()
    show()
    expect(screen.getByText('No invite link yet')).toBeTruthy()
    await user.tab()
    await user.keyboard('{Enter}')
    const copy = await screen.findByRole('button', { name: 'Copy link' })
    await waitFor(() => expect(document.activeElement).toBe(copy))
    await user.click(copy)
    expect(screen.getByRole('status').textContent).toBe('Link copied')
    expect(rpc.create).toHaveBeenCalledTimes(1)
  })
  it.each(['off', 'stale', 'creator-gone', 'archived'] as const)(
    'hides the URL in %s',
    (state) => {
      show({ ...active, state })
      expect(screen.queryByRole('textbox')).toBeNull()
      if (state === 'creator-gone' || state === 'stale') {
        expect(screen.queryByRole('switch')).toBeNull()
        expect(
          screen.getByRole('button', { name: 'Replace link' }),
        ).toBeTruthy()
      }
      if (state === 'archived') expect(screen.queryByRole('button')).toBeNull()
    },
  )
  it('does not overwrite a concurrent replacement, clears the old URL and reveals the current one', async () => {
    const user = userEvent.setup()
    show(active)
    await screen.findByDisplayValue('http://localhost:3000/join/secret')
    rpc.update.mockResolvedValue({ ok: false, reason: 'changed' })
    rpc.reveal.mockResolvedValue({
      ok: true,
      invite: { ...active, rotation: 2 },
      secret: 'current',
    })
    await user.click(screen.getByRole('switch'))
    await screen.findByDisplayValue('http://localhost:3000/join/current')
    expect(screen.getByRole('status').textContent).toBe(
      'Someone else changed the link. Showing the current one.',
    )
    expect(rpc.update).toHaveBeenCalledTimes(1)
  })
  it('shows an error and allows a state re-read after a lost mutation response', async () => {
    const user = userEvent.setup()
    show()
    rpc.create.mockRejectedValue(new Error('lost response'))
    rpc.reveal.mockRejectedValue(new Error('offline'))
    await user.click(screen.getByRole('button', { name: 'Create link' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Create link' })).toBeNull()
    rpc.reveal.mockResolvedValue({
      ok: true,
      invite: active,
      secret: 'persisted',
    })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByDisplayValue('http://localhost:3000/join/persisted')
    expect(rpc.create).toHaveBeenCalledTimes(1)
  })
  it('asks before upgrading every copy and uses a non-destructive confirmation', async () => {
    const user = userEvent.setup()
    show(active)
    await screen.findByRole('button', { name: 'Copy link' })
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Editor' }))
    expect(rpc.update).not.toHaveBeenCalled()
    expect(
      screen.getByRole('dialog', { name: 'Make people editors?' }),
    ).toBeTruthy()
    rpc.update.mockResolvedValue({
      ok: true,
      invite: { ...active, role: 'editor' },
    })
    rpc.reveal.mockResolvedValue({
      ok: true,
      invite: { ...active, role: 'editor' },
      secret: 'secret',
    })
    await user.click(screen.getByRole('button', { name: 'Make editors' }))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'People who join will become editors',
      ),
    )
    expect(rpc.update).toHaveBeenCalledWith({
      data: { tripId: 'trip', expectedRotation: 0, role: 'editor' },
    })
  })
  it('selects the URL when clipboard access fails', async () => {
    const user = userEvent.setup()
    show(active)
    await screen.findByRole('button', { name: 'Copy link' })
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('denied'),
    )
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(screen.getByRole('status').textContent).toBe(
      'Could not copy. Select the link and copy it yourself.',
    )
    const field = screen.getByRole('textbox') as HTMLInputElement
    expect(document.activeElement).toBe(field)
    expect(field.selectionEnd).toBe(field.value.length)
    expect(field.selectionStart).toBe(0)
  })
  it('keeps a pending switch focused and ignores repeated input', async () => {
    const user = userEvent.setup()
    show(active)
    await screen.findByRole('button', { name: 'Copy link' })
    let complete: ((value: unknown) => void) | undefined
    rpc.update.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    await user.keyboard(' ')
    expect(toggle.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(toggle)
    expect(rpc.update).toHaveBeenCalledTimes(1)
    complete?.({ ok: true, invite: { ...active, state: 'off', rotation: 1 } })
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(document.activeElement).toBe(toggle)
  })
  it('reserves the active controls while the secret is being revealed', () => {
    rpc.reveal.mockImplementation(() => new Promise(() => {}))
    show(active)
    expect(screen.getByRole('switch')).toBeTruthy()
    expect(
      screen.getByText('Nobody has joined through this link yet.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
  })
  it('offers no creation action on an archived trip that has never had a link', () => {
    show(null, true)
    expect(screen.queryByRole('button')).toBeNull()
    expect(
      screen.getByText(
        'This trip is archived. The link does not work while it is, and works again when the trip is restored.',
      ),
    ).toBeTruthy()
  })
  it('returns focus to Replace when cancelling a dead-link replacement', async () => {
    const user = userEvent.setup()
    show({ ...active, state: 'stale' })
    const trigger = screen.getByRole('button', { name: 'Replace link' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(rpc.replace).not.toHaveBeenCalled()
  })
  it.each(['archived', 'creatorGone', 'notOwner'] as const)(
    'recovers focus when a %s refusal removes the switch',
    async (reason) => {
      const user = userEvent.setup()
      show(active)
      await screen.findByDisplayValue('http://localhost:3000/join/secret')
      rpc.update.mockResolvedValue({ ok: false, reason })
      rpc.reveal.mockResolvedValue({
        ok: true,
        invite: {
          ...active,
          state: reason === 'archived' ? 'archived' : 'creator-gone',
        },
        secret: null,
      })
      await user.click(screen.getByRole('switch'))
      await waitFor(() => expect(screen.queryByRole('switch')).toBeNull())
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { name: 'Invite link' }),
        ),
      )
    },
  )
})
