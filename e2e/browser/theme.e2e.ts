import { settle } from '../helpers/settle'
import { expect, browserTest } from '../driver/test'

const test = browserTest()

const themeColors = 'meta[name="theme-color"]'
const lightMedia = '(prefers-color-scheme: light)'
const darkMedia = '(prefers-color-scheme: dark)'

test('saved document theme survives bootstrap, hydration and client navigation', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    window.localStorage.setItem('planned.theme', 'dark')
  })
  // External modules are blocked here so the assertion observes the inline bootstrap alone.
  const blockScript = '**/*'
  await page.route(blockScript, (route) =>
    route.request().resourceType() === 'script'
      ? route.abort()
      : route.continue(),
  )
  const metas = page.locator(themeColors)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(metas).toHaveCount(1)
  await expect(metas).toHaveAttribute('content', '#121211')

  await page.unroute(blockScript)
  await page.reload()
  await settle(page, {
    name: 'landing',
    path: '/',
    ready: 'footer a[href="/legal/privacy"]',
  })
  await expect(metas).toHaveAttribute('content', '#121211')
  await page.evaluate(() =>
    document.documentElement.setAttribute(
      'data-navigation-test',
      'same-document',
    ),
  )
  await page.locator('footer a[href="/legal/privacy"]').first().click()
  await expect(page).toHaveURL(/\/legal\/privacy$/)
  await expect(page.locator('html')).toHaveAttribute(
    'data-navigation-test',
    'same-document',
  )
  await expect(metas).toHaveCount(1)
  await expect(metas).toHaveAttribute('content', '#121211')
})

test('without JavaScript the document advertises both system colours', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    colorScheme: 'dark',
  })
  try {
    const page = await context.newPage()
    await page.goto('/')
    const metas = page.locator(themeColors)
    await expect(metas).toHaveCount(2)
    await expect(
      metas.and(page.locator(`[media="${lightMedia}"]`)),
    ).toHaveAttribute('content', '#faf9f7')
    await expect(
      metas.and(page.locator(`[media="${darkMedia}"]`)),
    ).toHaveAttribute('content', '#121211')
  } finally {
    await context.close()
  }
})

test.finish()
