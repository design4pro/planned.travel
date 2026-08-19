import { test as setup } from '@playwright/test'
import { DEMO_EMAIL, cacheSession } from './helpers/shoot.ts'

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
})
