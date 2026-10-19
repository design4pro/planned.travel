import { expect, test } from '@playwright/test'
import { DEMO_PASSWORD } from './helpers/session'

test.use({ storageState: 'e2e/.auth/demo.json' })

/** The seeded workspace has exactly one owner; this journey leaves its data untouched. */
test('workspace membership confirmation cancels and explains the last-owner refusal', async ({
  page,
}) => {
  await page.goto('/settings/organization', { waitUntil: 'networkidle' })
  const leave = page.getByRole('button', {
    name: 'Leave workspace',
    exact: true,
  })
  await expect(leave).toBeVisible()
  await leave.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText("Rafal's Travel")
  await expect(dialog).toContainText(
    'account and retained trips and cost records will stay',
  )
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await leave.click()
  await dialog.getByRole('button', { name: 'Leave workspace' }).click()
  await expect(dialog).toContainText('Make another member an owner')
  await expect(
    dialog.getByRole('button', { name: 'Reload workspace' }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(leave).toBeVisible()
  const removal = page
    .getByRole('button', { name: 'Remove member', exact: true })
    .first()
  await removal.click()
  await expect(dialog).toContainText('will lose access')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(removal).toBeVisible()
})

test('a member leaves a shared workspace and returns to their remaining dashboard', async ({
  browser,
  baseURL,
}) => {
  const owner = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  })
  const leaver = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  })
  const suffix = `${Date.now()}`
  const password = 'test-workspace-departure-1008'
  const email = 'mika@planned.travel'
  const post = async (context: typeof owner, path: string, body: object) => {
    const response = await context.request.post(`/api/auth${path}`, {
      data: body,
      headers: { origin: baseURL ?? '' },
    })
    expect(response.ok(), `${path}: HTTP ${response.status()}`).toBe(true)
    return response.json()
  }
  try {
    await post(owner, '/sign-up/email', {
      name: 'Departure owner',
      email: `departure-owner-${suffix}@example.test`,
      password,
    })
    await post(leaver, '/sign-in/email', {
      email: 'mika@planned.travel',
      password: DEMO_PASSWORD,
    })
    const personalSession = await (
      await leaver.request.get('/api/auth/get-session')
    ).json()
    const personalId = personalSession.session.activeOrganizationId
    const invitation = await post(owner, '/organization/invite-member', {
      email,
      role: 'member',
    })
    await post(leaver, '/organization/accept-invitation', {
      invitationId: invitation.id,
    })
    const page = await leaver.newPage()
    await page.goto('/settings/organization', { waitUntil: 'networkidle' })
    await page
      .getByRole('button', { name: 'Leave workspace', exact: true })
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Leave workspace', exact: true })
      .click()
    await expect(page).toHaveURL(/\/dashboard$/)
    const active = await (
      await leaver.request.get('/api/auth/get-session')
    ).json()
    expect(active.session.activeOrganizationId).toBe(personalId)
    await page.goto('/settings/organization', { waitUntil: 'networkidle' })
    await expect(
      page.getByText("Rafal's Travel", { exact: true }),
    ).toBeVisible()
  } finally {
    await owner.close()
    await leaver.close()
  }
})
