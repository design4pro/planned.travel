import { expect, test } from '@playwright/test'
import {
  APP_ROUTES,
  DEMO_EMAIL,
  PUBLIC_ROUTES,
  THEMES,
  hasSession,
  shoot,
  useSession,
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
 * Authenticated screens.
 *
 * `scripts/seed` used to create users that deliberately could not sign in, which left everything
 * behind the login page uncovered. The seed now provisions the demo owner with a real credential, so
 * this suite runs after `node scripts/seed/seed.mjs`.
 *
 * When that account cannot sign in the block skips with a reason rather than failing: an unseeded
 * database is a missing fixture, not a design regression, and turning it into a red gate would block
 * the /ultrabuild loop on something no builder can fix.
 */
test.describe('authenticated routes', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
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
