import { randomUUID } from 'node:crypto'
import { describe, test as base } from '@e2e-dev/web'
import { expect } from 'e2e'
import type { Locator } from 'e2e'
import { waitForHydration } from './helpers/readiness'
import { callsServerFn } from '../helpers/server-fn'

// Each behavior owns its invitation and cleans it even when an assertion fails.
const test = base.extend<{ invitation: { email: string; row: Locator } }>({
  invitation: async ({ app, browser, screen }, use) => {
    await app.open('/admin/members')
    await waitForHydration(browser)
    const email = `e2e-${randomUUID()}@example.com`
    const row = screen.getByRole('listitem').filter({ hasText: email })
    try {
      await use({ email, row })
    } finally {
      // Avoid interrupting a successful mutation's router invalidation.
      if (new URL(await browser.url()).pathname !== '/admin/members') {
        await app.open('/admin/members')
      }
      await waitForHydration(browser)
      await screen.getByLabel('Email address', { exact: true }).waitFor()
      if (await row.count()) {
        await row.getByRole('button', 'Revoke', { exact: true }).tap()
        await screen
          .getByRole('dialog')
          .getByRole('button', 'Revoke invitation', { exact: true })
          .tap()
        await expect(row).toHaveCount(0)
      }
    }
  },
})
const pending = test.extend<{ pendingInvitation: Locator }>({
  pendingInvitation: async ({ screen, invitation }, use) => {
    await screen
      .getByLabel('Email address', { exact: true })
      .fill(invitation.email)
    await screen.getByRole('button', 'Invite', { exact: true }).tap()
    await invitation.row.waitFor()
    await use(invitation.row)
  },
})

describe('workspace invitations', { session: 'owner' }, () => {
  test('creates an actionable invitation', async ({ screen, invitation }) => {
    await screen
      .getByLabel('Email address', { exact: true })
      .fill(invitation.email)

    await screen.getByRole('button', 'Invite', { exact: true }).tap()

    await expect(invitation.row).toBeVisible()
    await expect(
      invitation.row.getByRole('button', 'Resend', { exact: true }),
    ).toBeEnabled()
  })

  pending(
    'refuses a duplicate pending invitation',
    async ({ screen, invitation }) => {
      await screen
        .getByLabel('Email address', { exact: true })
        .fill(invitation.email)

      await screen.getByRole('button', 'Invite', { exact: true }).tap()

      await expect(
        screen.getByText('A pending invitation already exists. Use Resend.', {
          exact: true,
        }),
      ).toBeVisible()
      await expect(invitation.row).toHaveCount(1)
    },
  )

  pending(
    'keeps a resent invitation actionable when local delivery recovers',
    async ({ browser, pendingInvitation }) => {
      const requests: string[] = []
      await browser.route('**/_serverFn/**', async (route) => {
        if (
          route.request.method === 'POST' &&
          callsServerFn(
            new URL(route.request.url),
            'resendWorkspaceInvitationFn',
          )
        ) {
          requests.push(route.request.postData ?? '')
        }
        await route.fallback()
      })
      await pendingInvitation
        .getByRole('button', 'Resend', { exact: true })
        .tap()

      await expect.poll(() => requests.length).toBe(1)
      expect(requests[0]).toContain('invitationId')
      await expect(
        pendingInvitation.getByRole('button', 'Revoke', { exact: true }),
      ).toBeEnabled()
    },
  )

  pending(
    'removes a revoked invitation after confirmation',
    async ({ screen, pendingInvitation }) => {
      await pendingInvitation
        .getByRole('button', 'Revoke', { exact: true })
        .tap()

      await screen
        .getByRole('dialog')
        .getByRole('button', 'Revoke invitation', { exact: true })
        .tap()

      await expect(pendingInvitation).toHaveCount(0)
    },
  )
})
