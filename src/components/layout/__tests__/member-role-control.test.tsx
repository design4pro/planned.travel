// The control mounts Radix-backed primitives, which need the pointer-capture and scroll stubs jsdom
// does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { MemberRoleControl } from '../member-role-control'

import type { Catalogue } from '#/lib/i18n'
import type { MemberRole, MemberRoleOutcome } from '../member-role-control'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))

afterEach(() => {
  cleanup()
  notify.success.mockReset()
  notify.error.mockReset()
})

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

function mount(
  options: {
    isSelf?: boolean
    role?: string
    assignable?: ReadonlyArray<MemberRole>
    onChange?: (role: MemberRole) => Promise<MemberRoleOutcome>
  } = {},
) {
  const onChange = vi.fn(
    options.onChange ?? (async () => ({ ok: true }) as const),
  )
  const user = userEvent.setup()
  render(
    <I18nProvider locale="en" messages={EN}>
      <MemberRoleControl
        isSelf={options.isSelf ?? false}
        memberName="Kasia Nowak"
        role={options.role ?? 'member'}
        assignable={options.assignable ?? ['owner', 'admin', 'member']}
        roleLabel={(role) => LABELS[role] ?? role}
        onChange={onChange}
      />
    </I18nProvider>,
  )
  return { user, onChange }
}

const trigger = () =>
  screen.getByRole('combobox', { name: 'Role of Kasia Nowak' })

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<void> {
  await user.click(trigger())
  await user.click(screen.getByRole('option', { name }))
}

describe('who gets a control', () => {
  it('shows a read-only badge, and no select, on a row the caller may not change', () => {
    mount({ role: 'owner', assignable: [] })

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Owner')).toBeTruthy()
  })

  it('is keyboard operable and named for the member', () => {
    mount()

    expect(trigger().tagName).toBe('BUTTON')
    expect(trigger().textContent).toContain('Member')
  })

  it('offers only the roles the caller may grant', async () => {
    const { user } = mount({ role: 'member', assignable: ['admin', 'member'] })

    await user.click(trigger())

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Admin', 'Member'])
  })
})

describe('changing a role', () => {
  it('sends a demotion straight away and announces the result', async () => {
    const { user, onChange } = mount({ role: 'admin' })

    await choose(user, 'Member')

    expect(onChange).toHaveBeenCalledWith('member')
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Kasia Nowak is now Member.'),
    )
  })

  it('does nothing when the role chosen is the one held', async () => {
    const { user, onChange } = mount({ role: 'admin' })

    await choose(user, 'Admin')

    expect(onChange).not.toHaveBeenCalled()
  })

  it.each([
    [
      'last-owner',
      'The workspace must keep an owner. Make another member an owner first.',
    ],
    [
      'not-permitted',
      'You cannot make that change. Ask a workspace owner to grant the owner role or change an owner.',
    ],
    [
      'impersonated',
      'Roles cannot be changed in this session. Sign in again, or stop impersonating the account before changing roles.',
    ],
  ] as const)(
    'says why in plain words when the answer is %s',
    async (reason, sentence) => {
      const { user } = mount({
        role: 'owner',
        onChange: async () => ({ ok: false, reason }),
      })

      await choose(user, 'Admin')

      await waitFor(() =>
        expect(notify.error).toHaveBeenCalledWith(sentence, expect.anything()),
      )
      expect(notify.success).not.toHaveBeenCalled()
    },
  )
})

describe('making someone an owner', () => {
  it('asks first, with Cancel focused, and sends nothing until confirmed', async () => {
    const { user, onChange } = mount()

    await choose(user, 'Owner')

    const dialog = await screen.findByRole('dialog', {
      name: 'Make Kasia Nowak an owner?',
    })
    expect(dialog.textContent).toContain('can demote or remove any other owner')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    await waitFor(() => expect(document.activeElement).toBe(cancel))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sends nothing when cancelled', async () => {
    const { user, onChange } = mount()
    await choose(user, 'Owner')

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(onChange).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('sends the promotion once it is confirmed', async () => {
    const { user, onChange } = mount()
    await choose(user, 'Owner')

    await user.click(await screen.findByRole('button', { name: 'Make owner' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('owner'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // The trigger is disabled while a request is in flight; a disabled element cannot hold focus, so
  // without a restore the keyboard user is dropped onto the page and starts again from the top.
  it.each([
    ['a direct change', 'Admin', null],
    ['a confirmed promotion', 'Owner', 'Make owner'],
  ])('returns focus to the select after %s', async (_name, role, confirm) => {
    const { user } = mount()
    await choose(user, role)
    if (confirm !== null) {
      await user.click(await screen.findByRole('button', { name: confirm }))
    }

    await waitFor(() => expect(document.activeElement).toBe(trigger()))
  })

  // The dialog gives focus back to whatever held it when it opened, and that was the select option
  // the promotion was picked from, which is gone by then: focus fell to the page.
  it.each([
    [
      'Cancel',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Cancel' })),
    ],
    [
      'Escape',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.keyboard('{Escape}'),
    ],
  ])(
    'returns focus to the select when the promotion is dismissed with %s',
    async (_name, dismiss) => {
      const { user, onChange } = mount()
      await choose(user, 'Owner')
      await screen.findByRole('button', { name: 'Make owner' })

      await dismiss(user)

      await waitFor(() => expect(document.activeElement).toBe(trigger()))
      expect(onChange).not.toHaveBeenCalled()
    },
  )
})

describe('lowering your own authority', () => {
  it.each([
    ['owner', 'Admin', 'manage workspace owners'],
    ['owner', 'Member', 'Workspace console'],
    ['admin', 'Member', 'Workspace console'],
  ])('confirms %s to %s with Cancel focused', async (role, next, lost) => {
    const { user, onChange } = mount({ role, isSelf: true })
    await choose(user, next)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain(lost)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Cancel' }),
      ),
    )
    expect(onChange).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Change my role' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(next.toLowerCase())
    await waitFor(() => expect(document.activeElement).toBe(trigger()))
  })

  it.each(['Cancel', 'Escape', 'Close'])(
    'sends nothing on %s and restores focus',
    async (action) => {
      const { user, onChange } = mount({ role: 'owner', isSelf: true })
      await choose(user, 'Admin')
      await screen.findByRole('dialog')
      if (action === 'Escape') await user.keyboard('{Escape}')
      else await user.click(screen.getByRole('button', { name: action }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(onChange).not.toHaveBeenCalled()
      await waitFor(() => expect(document.activeElement).toBe(trigger()))
    },
  )

  it.each([false, true])(
    'announces pending work and blocks duplicate submissions (self: %s)',
    async (isSelf) => {
      let finish: (outcome: MemberRoleOutcome) => void = () => {
        throw new Error('request not started')
      }
      const { user, onChange } = mount({
        role: 'admin',
        isSelf,
        onChange: () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      })
      await choose(user, 'Member')
      if (isSelf)
        await user.dblClick(
          await screen.findByRole('button', { name: 'Change my role' }),
        )
      expect(screen.getByRole('status').textContent).toBe('Changing role…')
      expect(trigger().hasAttribute('disabled')).toBe(true)
      await user.click(trigger())
      expect(screen.queryByRole('option')).toBeNull()
      expect(onChange).toHaveBeenCalledExactlyOnceWith('member')
      finish({ ok: true })
      await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(trigger()))
    },
  )
})
