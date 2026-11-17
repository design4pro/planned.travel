import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, browserTest } from '../driver/test'

import { seedReleaseBrowserFixture } from '../../src/server/repos/__tests__/release-history-browser-fixture'
import { callsServerFn } from '../helpers/server-fn'
import { unblockCrossOriginFonts } from '../helpers/console'
import { useSession, pinDemoLanguage } from '../helpers/session'

const test = browserTest()
// Both browser targets share one local fixture and demo locale.
test.configure({ mode: 'serial', timeout: 180_000 })

/** Mutates only local synthetic release rows and restores the traveller's locale in finally. */
test('reads published releases with a real session, retries and switches exact-version locales', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  expect(new URL(baseURL ?? '').hostname).toMatch(/^(127\.0\.0\.1|localhost)$/)
  expect(await useSession(context, page, baseURL)).toBe(true)
  await unblockCrossOriginFonts(page)
  // Keep the external telemetry transport local, including WebKit preflights.
  // Application requests and page errors remain observable and asserted below.
  await context.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (
        /^https:\/\/[^/]+\.ingest(?:\.[^/]+)?\.sentry\.io\/api\/\d+\/envelope\//.test(
          url,
        )
      )
        return Promise.resolve(
          new Response('{}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      return originalFetch(input, init)
    }
  })
  const fixture = seedReleaseBrowserFixture()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let refuse = true
  let listingUrl = ''
  await page.route('**/_serverFn/**', async (route) => {
    if (!callsServerFn(new URL(route.request().url()), 'loadReleaseHistory'))
      return route.continue()
    listingUrl = route.request().url()
    if (refuse) {
      refuse = false
      return route.abort('failed')
    }
    return route.continue()
  })
  try {
    await page.goto('/settings/releases')
    const retry = page.getByRole('button', { name: 'Retry', exact: true })
    await expect(retry).toBeVisible()
    await retry.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('article')).toHaveCount(20)
    await expect(
      page.getByRole('heading', { name: 'Release history', exact: true }),
    ).toBeFocused()
    await expect(
      page.getByRole('heading', {
        name: `Version ${fixture.major}.0.22`,
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(page.getByRole('article').first()).toContainText(
      `Version ${fixture.major}.0.0`,
    )
    const anonymous = await context.browser()!.newContext({ baseURL })
    try {
      const response = await anonymous.request.get(listingUrl)
      expect(response.status()).toBeGreaterThanOrEqual(400)
    } finally {
      await anonymous.close()
    }
    refuse = true
    const older = page.getByRole('button', { name: 'Show older releases' })
    await older.focus()
    await page.keyboard.press('Enter')
    await expect(retry).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(20)
    await expect(retry).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('article')).toHaveCount(22)
    await expect(
      page.getByRole('heading', {
        name: `Version ${fixture.major}.0.20`,
        exact: true,
      }),
    ).toBeFocused()
    await expect(
      page.getByRole('region', { name: 'Release history' }).getByRole('status'),
    ).toContainText('2 older releases loaded.')
    const focusTop = await page
      .locator(':focus')
      .evaluate((node) => node.getBoundingClientRect().top)
    const headerBottom = await page
      .locator('[data-app-shell] header')
      .first()
      .evaluate((node) => node.getBoundingClientRect().bottom)
    expect(focusTop).toBeGreaterThanOrEqual(headerBottom)
    const directory =
      process.env.RELEASE_HISTORY_ARTIFACTS ??
      testInfo.outputPath('release-history')
    mkdirSync(directory, { recursive: true })
    for (const width of [360, 1280, 2560])
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
        await expect(page.locator('h1')).toHaveCount(1)
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({
          path: join(directory, `releases-${width}-${theme}.png`),
        })
      }
    for (const [locale, title] of [
      ['pl', 'Więcej czasu na podróż'],
      ['ar', 'مزيد من الوقت للرحلة'],
    ]) {
      await page.goto('/settings/language', { waitUntil: 'networkidle' })
      const chip = page.getByTestId(`locale-chip-${locale}`)
      await chip.scrollIntoViewIfNeeded()
      await chip.click()
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await page.goto('/settings/releases')
      await expect(
        page.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible()
      await expect(page.getByRole('article').first()).toHaveAttribute(
        'lang',
        locale,
      )
      await expect(page.getByRole('article').nth(1)).toHaveAttribute(
        'lang',
        'en',
      )
      if (locale === 'ar')
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await page.setViewportSize({ width: 360, height: 900 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: join(directory, `releases-${locale}-360-dark.png`),
      })
    }
    expect(errors).toEqual([])
  } finally {
    try {
      expect(await pinDemoLanguage(page)).toBe(true)
    } finally {
      fixture.cleanup()
    }
  }
})

test.finish()
