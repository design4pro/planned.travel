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

/**
 * Opens the account menu and reads whether `workspace` is the checked one. A click before the page
 * has hydrated opens nothing, so each attempt starts from a closed menu and the whole open-and-read
 * is retried. The menu is left open.
 */
async function expectActive(page: Page, workspace: string): Promise<void> {
  await expect(async () => {
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Account menu' }).click()
    await expect(
      page.getByRole('menuitemradio', { name: workspace }),
    ).toHaveAttribute('aria-checked', 'true', { timeout: 8_000 })
  }).toPass({ timeout: 45_000 })
}

async function switchTo(page: Page, workspace: string): Promise<void> {
  const item = page.getByRole('menuitemradio', { name: workspace })
  // Only the opening is retried: the click on the item changes the session, so a second one would
  // find the workspace already active.
  await expect(async () => {
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Account menu' }).click()
    await expect(item).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 45_000 })
  await item.click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expectActive(page, workspace)
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
  const creation = page.getByRole('dialog', { name: /trip/i })
  // A click before the page has hydrated opens nothing, so the open is retried.
  await expect(async () => {
    await page
      .getByRole('button', { name: 'New trip', exact: true })
      .filter({ visible: true })
      .first()
      .click()
    await creation.getByLabel('Trip name').fill(title, { timeout: 5_000 })
  }).toPass({ timeout: 45_000 })

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
  await expect(notice.getByRole('button', { name: 'Not now' })).toBeFocused()
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

  // The way out is a reload into whatever the session now says; B just switched back to FIRST. The
  // trip name typed into A's creation dialog is unsent text, so the press asks before it discards
  // that, and takes focus to the safe choice.
  await notice
    .getByRole('button', { name: 'Open the current workspace' })
    .click()
  await expect(
    notice.getByText('Text you have not sent in this tab will be lost.'),
  ).toBeVisible()
  await expect(notice.getByRole('button', { name: 'Not now' })).toBeFocused()
  await expect(page).toHaveURL(/\/trips$/)
  // A deliberate press goes on once the question has settled; one made inside that moment is
  // ignored, so the press is retried until the reload starts.
  await expect(async () => {
    await notice.getByRole('button', { name: 'Open anyway' }).click()
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  // A full reload into the workspace B just switched back to.
  await expectActive(page, FIRST)
})

/**
 * 979 - the same stale tab, on the trip's live-collaboration indicator.
 *
 * A browser WebSocket cannot read why an upgrade was refused, so the socket door answers a tab that
 * states another workspace than the session's by accepting the upgrade and closing it at once with a
 * dedicated code. Tab A's socket is dropped after tab B switched workspace, so its next connect is
 * the one the door closes: the pill must say live updates stopped, the retries must end, and the way
 * out is the same "Open the current workspace" the server-function notice offers.
 */
test('a trip tab whose workspace changed says why live updates stopped and stops retrying', async ({
  context,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000)
  await context.clearCookies()
  expect(
    await signIn(page, baseURL),
    `${DEMO_EMAIL} could not sign in - run \`node scripts/seed/seed.mjs\``,
  ).toBe(true)

  // Count the tab's socket attempts, and keep the first so it can be dropped on cue.
  const sockets: Array<{ url: string; drop: () => void }> = []
  await page.routeWebSocket(/\/api\/trip-room\//, (ws) => {
    ws.connectToServer()
    sockets.push({
      url: ws.url(),
      drop: () => void ws.close({ code: 1001, reason: 'test drop' }),
    })
  })

  // Tab A: a trip's collaboration screen in the first workspace, connected and live.
  await page.goto('/trips', { waitUntil: 'networkidle' })
  const trip = page.locator('a[href^="/trips/"][href$="/plan"]:visible').first()
  await expect(trip).toBeVisible()
  const href = await trip.getAttribute('href')
  expect(href).toBeTruthy()
  await page.goto(href?.replace(/\/plan$/, '/collab') ?? '', {
    waitUntil: 'networkidle',
  })
  const pill = page.getByRole('status').filter({ hasText: /^Live$/ })
  await expect(pill).toBeVisible({ timeout: 30_000 })
  expect(
    new URL(sockets[0]?.url ?? '').searchParams.get('workspace'),
  ).toBeTruthy()

  // Tab B: the same session switches to the second workspace.
  const other = await context.newPage()
  await other.goto('/dashboard', { waitUntil: 'networkidle' })
  await switchTo(other, SECOND)

  // Tab A's socket drops, and its reconnect states the workspace it is still showing.
  sockets[0]?.drop()
  const stopped = page
    .getByRole('status')
    .filter({ hasText: 'Live updates stopped' })
  await expect(stopped).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByText(
      'This tab belongs to a workspace that was changed in another tab or window.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reconnect' })).toHaveCount(0)

  // Retries ended: well past the first backoff steps, no further attempt was made.
  const attempts = sockets.length
  await page.waitForTimeout(5_000)
  expect(sockets.length, 'a stale tab must stop reconnecting').toBe(attempts)

  // The way out is a reload into whatever the session now says: tab B switched to SECOND. A
  // half-written message in the conversation is unsent text, so the press only asks, with focus on
  // Cancel, and Cancel keeps the tab (and the message) as it is, with focus back on the button.
  const composer = page.getByPlaceholder('Say something to the group…')
  await composer.fill('A half-written message')
  await page.getByRole('button', { name: 'Open the current workspace' }).click()
  await expect(
    page.getByText('Text you have not sent in this tab will be lost.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await expect(page).toHaveURL(/\/collab$/)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(composer).toHaveValue('A half-written message')
  await expect(
    page.getByRole('button', { name: 'Open the current workspace' }),
  ).toBeFocused()

  // With nothing left to lose the way out goes straight through.
  await composer.fill('')
  await page.getByRole('button', { name: 'Open the current workspace' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expectActive(page, SECOND)

  // Leave the shared session in the first workspace for the rest of the run.
  await switchTo(other, FIRST)
})
