import { expect, test } from '@playwright/test'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEMO_PASSWORD } from './helpers/session'
import { settle } from './helpers/settle'

const WORKSPACE = {
  name: 'workspace',
  path: '/settings/organization',
  ready: 'table',
} as const

test.use({ storageState: 'e2e/.auth/demo.json' })

/** The seeded workspace has exactly one owner; this journey leaves its data untouched. */
test('workspace membership confirmation cancels and explains the last-owner refusal', async ({
  page,
}) => {
  await page.goto('/settings/organization', { waitUntil: 'networkidle' })
  await settle(page, WORKSPACE)
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

for (const provision of [false, true])
  test(`a member leaves and reaches their ${provision ? 'new personal' : 'remaining'} workspace dashboard`, async ({
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
    const suffix = `${Date.now()}-${test.info().parallelIndex}`
    const leaverName = `Leaver${suffix}`
    const recoveryTrigger = `departure_recovery_${suffix.replace(/[^a-z0-9]/gi, '_')}`
    const password = 'test-workspace-departure-1008'
    const email = provision
      ? `departure-member-${suffix}@example.test`
      : 'mika@planned.travel'
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
      if (provision) {
        await post(leaver, '/sign-up/email', {
          name: leaverName,
          email,
          password,
        })
        const db = localFixtureDb()
        db.prepare('update user set email_verified = 1 where email = ?').run(
          email,
        )
        db.close()
      }
      await post(leaver, '/sign-in/email', {
        email,
        password: provision ? password : DEMO_PASSWORD,
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
      if (!provision) {
        const management = await owner.newPage()
        await management.goto('/settings/organization', {
          waitUntil: 'networkidle',
        })
        await settle(management, WORKSPACE)
        const targetRow = management.getByRole('row').filter({ hasText: email })
        await targetRow
          .getByRole('button', { name: 'Remove member', exact: true })
          .click()
        await management
          .getByRole('dialog')
          .getByRole('button', { name: 'Remove member', exact: true })
          .click()
        await expect(
          management.getByText('Member removed', { exact: true }),
        ).toBeVisible()
        await expect(
          management.getByRole('table', { name: 'Members of this workspace' }),
        ).toBeFocused()
        await expect(targetRow).toHaveCount(0)
        const replacement = await post(owner, '/organization/invite-member', {
          email,
          role: 'member',
        })
        await post(leaver, '/organization/accept-invitation', {
          invitationId: replacement.id,
        })
        await management.close()
      }
      if (provision) {
        // Fixture only: the fresh account starts with only its invited membership. No product record is erased.
        const db = localFixtureDb()
        db.exec('PRAGMA foreign_keys = ON')
        db.prepare('delete from organization where id = ?').run(personalId)
        const personalName = `${leaverName}'s Travel`.replace(/'/g, "''")
        db.exec(
          `create trigger ${recoveryTrigger} before insert on organization when NEW.name = '${personalName}' begin select raise(abort, 'simulated departure activation failure'); end`,
        )
        db.close()
      }
      const page = await leaver.newPage()
      await page.goto('/settings/organization', { waitUntil: 'networkidle' })
      await settle(page, WORKSPACE)
      await page
        .getByRole('button', { name: 'Leave workspace', exact: true })
        .click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Leave workspace', exact: true })
        .click()
      if (provision) {
        const dialog = page.getByRole('dialog')
        await expect(dialog).toContainText('You left this workspace', {
          timeout: 20_000,
        })
        await expect(page).toHaveURL(/\/settings\/organization$/)
        const db = localFixtureDb()
        db.exec(`drop trigger ${recoveryTrigger}`)
        db.close()
        await dialog
          .getByRole('button', { name: 'Open next workspace' })
          .click()
      }
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 })
      const active = await (
        await leaver.request.get('/api/auth/get-session')
      ).json()
      if (provision)
        expect(active.session.activeOrganizationId).not.toBe(personalId)
      else expect(active.session.activeOrganizationId).toBe(personalId)
      await page.goto('/settings/organization', { waitUntil: 'networkidle' })
      await settle(page, WORKSPACE)
      await expect(
        page.getByText(
          provision ? `${leaverName}'s Travel` : "Rafal's Travel",
          {
            exact: true,
          },
        ),
      ).toBeVisible()
    } finally {
      if (provision) {
        const db = localFixtureDb()
        db.exec(`drop trigger if exists ${recoveryTrigger}`)
        db.close()
      }
      await owner.close()
      await leaver.close()
    }
  })

/** Test-only access to the local D1 fixture, like the auth integration harness. */
function localFixtureDb(): DatabaseSync {
  const directory = join(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
  )
  const filename = readdirSync(directory).find(
    (name) => name !== 'metadata.sqlite' && name.endsWith('.sqlite'),
  )
  if (!filename) throw new Error('Local D1 fixture has not been provisioned')
  const db = new DatabaseSync(join(directory, filename))
  db.exec('PRAGMA busy_timeout = 5000')
  return db
}
