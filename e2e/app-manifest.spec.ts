import { expect, test } from '@playwright/test'
import { unblockCrossOriginFonts, watchConsole } from './helpers/console'
import { AUTH_STATE } from './helpers/session'

// Parsing is forced through Chromium's own manifest loader: otherwise a headless
// visit can leave even malformed JSON unfetched and the console falsely silent.
test.use({ storageState: AUTH_STATE })

test('the dashboard announces a valid installed-app manifest @chromium-only', async ({
  page,
  context,
  request,
}) => {
  const consoleReport = watchConsole(page, {
    name: 'dashboard',
    path: '/dashboard',
    ready: 'main',
  })
  for (const path of [
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon-180.png',
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()['content-type'], path).toMatch(
      path.endsWith('.png') ? /image\/png/ : /json/,
    )
  }
  await unblockCrossOriginFonts(page)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
  const cdp = await context.newCDPSession(page)
  const manifest = await cdp.send('Page.getAppManifest')
  expect(manifest.errors).toEqual([])
  expect(manifest.url).toMatch(/\/manifest\.webmanifest$/)
  expect(consoleReport().fatal).toEqual([])
})
