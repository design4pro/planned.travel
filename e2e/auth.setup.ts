import { test as setup } from '@playwright/test'
import { CONSOLE_ROUTES } from './helpers/admin.ts'
import { APP_ROUTES, PUBLIC_ROUTES } from './helpers/routes.ts'
import { DEMO_EMAIL, cacheSession } from './helpers/session.ts'

/**
 * Signs the demo account in once per run and caches the session for every other spec.
 *
 * A dedicated setup project rather than a `beforeEach`: `/sign-in/email` is rate limited to ten
 * attempts a minute, and the visual suite has more authenticated tests than that, so per-test
 * sign-in made the last ones fail with a 429.
 *
 * This never fails. An unseeded database is a missing fixture, not a broken build — it writes an
 * empty session and the authenticated specs skip themselves with an actionable reason.
 */
setup('cache the demo session', async ({ page, baseURL }) => {
  const ok = await cacheSession(page, baseURL)
  if (!ok) {
    console.warn(
      `[auth.setup] ${DEMO_EMAIL} could not sign in — authenticated specs will skip. ` +
        `Run: node scripts/seed/seed.mjs`,
    )
  }

  // Warm the dev server before the browser projects fan out. Vite transforms a
  // route's modules on its first request, and a cold server hit by several
  // workers at once answers 500 on routes it has not transformed yet — a page of
  // retries that says nothing about the code under test. One sequential pass
  // here, with the session already in the cookie jar, and every later request
  // finds the module graph ready. Status codes are irrelevant: an anonymous
  // console redirect transforms the same modules a 200 would.
  for (const route of [...PUBLIC_ROUTES, ...APP_ROUTES, ...CONSOLE_ROUTES]) {
    await page.request.get(route.path, { failOnStatusCode: false })
  }
})
