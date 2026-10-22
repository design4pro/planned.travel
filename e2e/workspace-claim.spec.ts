import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { DEMO_EMAIL, signIn } from './helpers/session.ts'

/**
 * 805 - a second browser tab never silently serves the workspace another tab switched to.
 *
 * The active workspace is a column on the session row, so two tabs of one session share it. Tab A is
 * opened in the first workspace, tab B switches to the second, and A's next write must be refused
 * (and write nothing) instead of landing in the workspace A is not showing.
 *
 * The walk signs in on its own, for the reason given above the "switching workspace" block in
 * `journeys.spec.ts`: a switch made with the cached session would move every other test in the run.
 */
const FIRST = "Rafal's Travel"
const SECOND = 'Wolak Family Trips'

async function switchTo(page: Page, workspace: string): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitemradio', { name: workspace }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Account menu' }).click()
  await expect(
    page.getByRole('menuitemradio', { name: workspace }),
  ).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
}

async function tripTitles(page: Page): Promise<string> {
  await page.goto('/trips', { waitUntil: 'networkidle' })
  return page.getByRole('main').innerText()
}

test('a tab that is showing the previous workspace is refused, writes nothing, and offers the current one', async ({
  context,
  page,
  baseURL,
}) => {
  test.setTimeout(120_000)
  await context.clearCookies()
  expect(
    await signIn(page, baseURL),
    `${DEMO_EMAIL} could not sign in - run \`node scripts/seed/seed.mjs\``,
  ).toBe(true)

  // Tab A: the first workspace, with a trip about to be created.
  await page.goto('/trips', { waitUntil: 'networkidle' })
  const title = `Claim proof ${Date.now()}`
  await page
    .getByRole('button', { name: 'New trip', exact: true })
    .filter({ visible: true })
    .first()
    .click()
  const creation = page.getByRole('dialog', { name: /trip/i })
  await creation.getByLabel('Trip name').fill(title)

  // Tab B: the same session switches to the second workspace.
  const other = await context.newPage()
  await other.goto('/dashboard', { waitUntil: 'networkidle' })
  await switchTo(other, SECOND)

  // Tab A submits. The server refuses it before any write, and A says so.
  await creation
    .getByRole('button', { name: 'Create trip', exact: true })
    .click()
  const notice = page.getByRole('alertdialog', {
    name: 'The workspace changed in another tab',
  })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText(FIRST)
  await expect(
    notice.getByRole('button', { name: 'Open the current workspace' }),
  ).toBeFocused()
  await expect(page).toHaveURL(/\/trips$/)

  // "Not now" leaves the tab stopped: the next attempt reopens the notice and sends nothing.
  await notice.getByRole('button', { name: 'Not now' }).click()
  await expect(notice).toBeHidden()
  const serverCalls: Array<string> = []
  page.on('request', (request) => {
    if (request.url().includes('/_serverFn/')) serverCalls.push(request.url())
  })
  await creation
    .getByRole('button', { name: 'Create trip', exact: true })
    .click()
  await expect(notice).toBeVisible()
  expect(serverCalls, 'a stale tab must not keep calling the server').toEqual(
    [],
  )

  // Tab B keeps working in the workspace it switched to, and nothing was written in either one.
  expect(await tripTitles(other)).not.toContain(title)
  await switchTo(other, FIRST)
  expect(await tripTitles(other)).not.toContain(title)

  // The way out is a reload into whatever the session now says; B just switched back to FIRST.
  await notice
    .getByRole('button', { name: 'Open the current workspace' })
    .click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Account menu' }).click()
  await expect(
    page.getByRole('menuitemradio', { name: FIRST }),
  ).toHaveAttribute('aria-checked', 'true')
})
