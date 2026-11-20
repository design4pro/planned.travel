import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { expect, browserTest } from '../driver/test'

import { seedReleaseBrowserFixture } from '../../src/server/repos/__tests__/release-history-browser-fixture'
import { callsServerFn } from '../helpers/server-fn'
import { unblockCrossOriginFonts } from '../helpers/console'
import { useSession, pinDemoLanguage } from '../helpers/session'
import { tabNavigationKey } from '../driver/keyboard'
import { readPublicFailure } from '../../src/lib/errors'

const { fromCrossJSON } = createRequire(
  import.meta.resolve('@tanstack/react-start'),
)('seroval') as {
  fromCrossJSON: (
    value: unknown,
    options: { refs: Map<number, unknown>; plugins: unknown[] },
  ) => { error?: unknown; result?: unknown }
}

const { defaultSerovalPlugins } = createRequire(
  import.meta.resolve('@tanstack/react-router'),
)('@tanstack/router-core') as { defaultSerovalPlugins: unknown[] }

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
      return route.abort('failed')
    }
    return route.continue()
  })
  try {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/settings', { waitUntil: 'networkidle' })
    const sections = page.getByRole('navigation', { name: 'Settings sections' })
    const releaseLink = sections.getByRole('link', {
      name: 'Release history',
      exact: true,
    })
    async function discoverReleaseLink() {
      await sections.getByRole('link', { name: 'Profile', exact: true }).focus()
      for (let index = 0; index < 7; index++)
        await page.keyboard.press(tabNavigationKey())
      await expect(releaseLink).toBeFocused()
      await expect
        .poll(async () => {
          const bounds = await releaseLink.boundingBox()
          return (
            bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= 360
          )
        })
        .toBe(true)
    }
    await discoverReleaseLink()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/settings\/releases$/)
    const retry = page.getByRole('button', { name: 'Retry', exact: true })
    await expect(retry).toBeVisible()
    await retry.focus()
    refuse = false
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
    await page.goBack()
    await expect(page).toHaveURL(/\/settings$/)
    await page.goForward()
    await expect(page.getByRole('article')).toHaveCount(20)
    await page.reload()
    await expect(page.getByRole('article')).toHaveCount(20)
    await page.goBack()
    await expect(page).toHaveURL(/\/settings$/)
    await discoverReleaseLink()
    if (testInfo.project.use.isMobile) await releaseLink.tap()
    else await releaseLink.click()
    await expect(page).toHaveURL(/\/settings\/releases$/)
    await expect(page.getByRole('article')).toHaveCount(20)
    await expect(page.getByRole('article').first()).toContainText(
      `Version ${fixture.major}.0.0`,
    )
    const anonymous = await context.browser()!.newContext({ baseURL })
    try {
      const document = await anonymous.request.get('/settings/releases', {
        maxRedirects: 0,
      })
      expect(document.status()).toBe(302)
      expect(new URL(document.headers().location, baseURL).pathname).toBe(
        '/login',
      )
      expect(await document.text()).not.toContain(`${fixture.major}.0.0`)
      const response = await anonymous.request.get(listingUrl, {
        headers: {
          origin: baseURL,
          'sec-fetch-site': 'same-origin',
          'x-tsr-serverFn': 'true',
        },
      })
      // TanStack serializes the authored error inside its successful RPC transport.
      // Its exact public envelope, not a generic 500/CSRF refusal, proves the auth guard ran.
      expect(response.status()).toBe(200)
      const body = await response.json()
      const decoded = fromCrossJSON(body, {
        refs: new Map(),
        plugins: defaultSerovalPlugins,
      })
      expect(decoded.result).toBeUndefined()
      expect(decoded.error).toBeInstanceOf(Error)
      expect(readPublicFailure(decoded.error)).toEqual({
        kind: 'refusal',
        message: 'You need to sign in to continue.',
      })
      expect(JSON.stringify(body)).not.toContain(`${fixture.major}.0.0`)
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
    refuse = false
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

test('keeps a single maximum-length release readable without pagination', async ({
  page,
  context,
  baseURL,
}) => {
  expect(await useSession(context, page, baseURL)).toBe(true)
  await unblockCrossOriginFonts(page)
  const title = 'W'.repeat(240)
  const fixture = seedReleaseBrowserFixture(undefined, {
    visibleCount: 1,
    body: {
      title,
      summary: ['A detailed release summary. '.repeat(80)],
      features: ['A reliable journey.'],
      fixes: [],
    },
  })
  try {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/settings/releases')
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: 'Show older releases' }),
    ).toHaveCount(0)
    const heading = page.getByRole('heading', { name: title, exact: true })
    await expect(heading).toBeVisible()
    expect(
      await heading.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  } finally {
    fixture.cleanup()
  }
})

test.finish()
