import { expect, test } from '@playwright/test'
import {
  APP_ROUTES,
  PUBLIC_ROUTES,
  THEMES,
  shoot,
  visit,
  watchConsole,
} from './helpers/shoot.ts'

/**
 * The visual gate.
 *
 * Two Playwright projects (desktop Chromium at 1440x900 and mobile WebKit at
 * 393x852) times two themes is the mechanical half of the quality bar in
 * docs/SPEC.md §2: it catches regressions against an approved baseline. Judging
 * whether the design is *good* is the pixel-critic sub-agent's job, not this
 * file's — these tests only hold the line once a frame has been approved.
 */

test.describe('public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    for (const theme of THEMES) {
      test(`${route.name} renders in ${theme}`, async ({ page }) => {
        const problems = watchConsole(page)
        await visit(page, route, theme)
        // Before the screenshot: capture options mutate the page and would add
        // their own console noise. See watchConsole().
        expect(problems(), 'the console must be clean').toEqual([])
        await shoot(page, route, theme)
      })
    }
  }
})

/**
 * Authenticated screens. `scripts/seed` deliberately creates users that cannot
 * sign in, so this block needs a real account: set E2E_EMAIL and E2E_PASSWORD
 * (a dedicated throwaway account against the local D1) to include it.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe('authenticated routes', () => {
  test.skip(
    !email || !password,
    'set E2E_EMAIL and E2E_PASSWORD to cover the authenticated app',
  )

  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/email/i).fill(email as string)
    await page.getByLabel(/password/i).fill(password as string)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  })

  for (const route of APP_ROUTES) {
    for (const theme of THEMES) {
      test(`${route.name} renders in ${theme}`, async ({ page }) => {
        const problems = watchConsole(page)
        await visit(page, route, theme)
        // Before the screenshot: capture options mutate the page and would add
        // their own console noise. See watchConsole().
        expect(problems(), 'the console must be clean').toEqual([])
        await shoot(page, route, theme)
      })
    }
  }
})
