import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { WorkspaceInvitations } from '../workspace-invitations'

afterEach(cleanup)
const messages = {
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}
it('defaults to member, reports delivery recovery, and only resends expired rows', async () => {
  const act = vi
    .fn()
    .mockResolvedValue({ ok: true, delivered: false, invitationId: 'new' })
  const user = userEvent.setup()
  render(
    <I18nProvider locale="en" messages={messages}>
      <WorkspaceInvitations
        now={Date.parse('2026-10-19')}
        roles={['admin', 'member']}
        invitations={[
          {
            id: 'expired',
            email: 'old@example.com',
            role: 'member',
            expiresAt: '2020-01-01',
            inviterName: 'Original',
            inviterEmail: 'original@example.com',
          },
        ]}
        onAction={act}
        reload={async () => {}}
      />
    </I18nProvider>,
  )
  expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull()
  await user.type(screen.getByLabelText('Email address'), 'new@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  expect(act).toHaveBeenCalledWith('invite', {
    email: 'new@example.com',
    role: 'member',
  })
  expect(
    await screen.findByText(
      'Invitation saved, but email delivery failed. Use Resend to try again.',
    ),
  ).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Resend' }))
  expect(act).toHaveBeenLastCalledWith('resend', { invitationId: 'expired' })
})
it('asks for confirmation before revoking', async () => {
  const act = vi
    .fn()
    .mockResolvedValue({ ok: true, delivered: false, invitationId: 'pending' })
  const user = userEvent.setup()
  render(
    <I18nProvider locale="en" messages={messages}>
      <WorkspaceInvitations
        now={0}
        roles={['member']}
        invitations={[
          {
            id: 'pending',
            email: 'new@example.com',
            role: 'member',
            expiresAt: '2030-01-01',
            inviterName: null,
            inviterEmail: null,
          },
        ]}
        onAction={act}
        reload={async () => {}}
      />
    </I18nProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Revoke' }))
  expect(act).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBe(
    document.activeElement,
  )
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Revoke' })).toBe(
      document.activeElement,
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Revoke' }))
  await user.click(screen.getByRole('button', { name: 'Revoke invitation' }))
  expect(act).toHaveBeenCalledWith('revoke', { invitationId: 'pending' })
  await waitFor(() =>
    expect(screen.getByLabelText('Email address')).toBe(document.activeElement),
  )
})

it('focuses an inline refusal after reloading and blocks unknown outcomes until refresh succeeds', async () => {
  const act = vi
    .fn()
    .mockResolvedValue({ ok: false, reason: 'invitation-exists' })
  const reload = vi.fn().mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(
    <I18nProvider locale="en" messages={messages}>
      <WorkspaceInvitations
        now={0}
        roles={['member']}
        invitations={[]}
        onAction={act}
        reload={reload}
      />
    </I18nProvider>,
  )
  const input = screen.getByLabelText('Email address')
  await user.type(input, 'new@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  await screen.findByText('A pending invitation already exists. Use Resend.')
  expect(document.activeElement).toBe(input)
  act.mockRejectedValueOnce(new Error('response lost'))
  reload.mockRejectedValueOnce(new Error('read failed'))
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  const refresh = await screen.findByRole('button', {
    name: 'Refresh invitations',
  })
  expect(
    screen.getByRole('button', { name: 'Invite' }).hasAttribute('disabled'),
  ).toBe(true)
  await user.click(refresh)
  expect(
    screen.getByRole('button', { name: 'Invite' }).hasAttribute('disabled'),
  ).toBe(false)
})
