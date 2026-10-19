import { expect, test } from '@playwright/test'
import { useSession } from './helpers/session.ts'
import { visit } from './helpers/console.ts'

test('workspace invitation create, duplicate refusal, resend recovery and revoke', async ({
  context,
  page,
  baseURL,
}) => {
  expect(await useSession(context, page, baseURL)).toBe(true)
  await visit(
    page,
    { name: 'workspace', path: '/admin', ready: 'main' },
    'light',
  )
  const email = `invite-${Date.now()}@example.com`
  const input = page.getByLabel('Email address', { exact: true })
  await input.fill(email)
  await page.getByRole('button', { name: 'Invite', exact: true }).click()
  const row = page.getByRole('listitem').filter({ hasText: email })
  await expect(row).toBeVisible()
  // Local queues may be unavailable; either outcome must retain an actionable row.
  await expect(
    row.getByRole('button', { name: 'Resend', exact: true }),
  ).toBeEnabled()
  await input.fill(email)
  await page.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect(
    page.getByText('A pending invitation already exists. Use Resend.', {
      exact: true,
    }),
  ).toBeVisible()
  await row.getByRole('button', { name: 'Resend', exact: true }).click()
  await expect(
    row.getByRole('button', { name: 'Revoke', exact: true }),
  ).toBeEnabled()
  await row.getByRole('button', { name: 'Revoke', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Revoke invitation', exact: true })
    .click()
  await expect(row).toHaveCount(0)
})
