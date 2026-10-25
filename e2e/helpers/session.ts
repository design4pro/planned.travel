import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

/**
 * The one authenticated session a run gets, and the fixture state it depends on.
 *
 * `/sign-in/email` is rate limited to ten attempts a minute, so signing in per
 * test is not an option: the setup project signs in once, caches the cookies, and
 * every browser project starts from that file. The language pin lives here too,
 * because it is the same kind of thing - a mutable column the product itself can
 * change, put back to a known value once per run rather than per test.
 */

/**
 * The demo account the seed provisions.
 *
 * `scripts/seed/seed.mjs` creates this account when it is missing and reconciles its password when it
 * is not, so `node scripts/seed/seed.mjs` is all that stands between a fresh clone and authenticated
 * coverage. The password is a fixture for a local database, not a secret.
 *
 * Keep DEMO_PASSWORD in step with DEFAULT_DEMO_PASSWORD in `scripts/seed/seed.mjs` — they are
 * deliberately duplicated because that script is plain `.mjs` with no exports, and a drift between
 * them shows up as a skipped authenticated suite rather than a failure.
 */
export const DEMO_EMAIL = process.env.E2E_EMAIL ?? 'rafal@planned.travel'
export const DEMO_PASSWORD = process.env.E2E_PASSWORD ?? 'planned-demo-2026'

/**
 * Sign in over the API rather than through the form.
 *
 * `page.request` shares the page's cookie jar, so the session cookie the endpoint sets is live in the
 * browser context immediately — one request per test instead of a full form round trip, and a failure
 * here is unambiguous rather than a mystery timeout on a selector. Better Auth enforces an Origin
 * header on state-changing requests, hence the explicit one.
 *
 * The account defaults to the demo owner. Another fixture person (all four share the seed password)
 * signs in by email, from a context whose cookie jar was cleared first so the cached owner session is
 * never the one answering.
 */
export async function signIn(
  page: Page,
  baseURL: string | undefined,
  email: string = DEMO_EMAIL,
): Promise<boolean> {
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: { origin: baseURL ?? 'http://localhost:3000' },
    data: { email, password: DEMO_PASSWORD },
    failOnStatusCode: false,
  })
  return response.ok()
}

/** Where the one authenticated session for a run is cached. Gitignored. */
export const AUTH_STATE = 'e2e/.auth/demo.json'

type StoredState = { cookies: Array<never>; origins: Array<never> }

/**
 * Signs in once and caches the session for the whole run.
 *
 * Signing in per test is not an option: `/sign-in/email` is rate limited to ten attempts a minute
 * (see `rateLimit.customRules` in src/server/auth), and this suite has more tests than that, so the
 * later ones were turned away with a 429 and skipped. One sign-in, cached cookies, no limit.
 */
export async function cacheSession(
  page: Page,
  baseURL: string | undefined,
): Promise<boolean> {
  if (!(await storeSession(page, baseURL))) {
    return false
  }
  await pinDemoLanguage(page)
  return true
}

/**
 * The sign-in and the cache file, and nothing else.
 *
 * Split out so that the fallback path in `useSession()` can reach the session
 * without reaching the *pin*. `pinDemoLanguage()` writes to the shared fixture,
 * and `useSession()` is called from a `beforeEach` — so while the two were one
 * function, a run with no cached session (the documented filtered-run case)
 * performed a navigation and a D1 write inside every authenticated test, once
 * per worker, against a database every worker shares. That contradicts the pin's
 * own contract of running once per run in the setup project, which is the only
 * place a write to the fixture belongs.
 */
async function storeSession(
  page: Page,
  baseURL: string | undefined,
): Promise<boolean> {
  await mkdir(dirname(AUTH_STATE), { recursive: true })
  if (!(await signIn(page, baseURL))) {
    await writeFile(
      AUTH_STATE,
      JSON.stringify({ cookies: [], origins: [] }),
      'utf8',
    )
    return false
  }
  await page.context().storageState({ path: AUTH_STATE })
  return true
}

/**
 * The demo traveller's language, put back to the workspace's before a run.
 *
 * Every authenticated screen is a *sentence*, and which sentence the Worker
 * renders is a mutable D1 column: `user_settings.locale`. Nothing in this file
 * used to touch it, and `/settings/language` exists to change it — so one
 * exploratory click, one interrupted spec, or one agent driving the picker by hand
 * leaves the shared fixture speaking another language, and every journey behind
 * the session then asserts against words nobody wrote. That is not a
 * hypothetical: it was found set to `ar`, which red-lined 29 tests, with no
 * indication that the *fixture* had moved rather than the product.
 *
 * The reset is the product's own writer — the follow-the-workspace chip, which
 * clears the override to `NULL` — rather than a SQL statement or a guessed
 * server-function URL. Two consequences, both wanted: it exercises the same write
 * the screen offers, so a pin that stops working is a defect worth knowing about;
 * and it needs no privilege the demo account does not have.
 *
 * It runs once per run, in the setup project, because it is the only place a
 * write belongs — a per-test reset would be a write per frame against a
 * database every worker shares. That is enforced by the call graph rather than
 * asserted in prose: the callers are `cacheSession()`, which `auth.setup.ts`
 * alone runs, and the `finally` of the one Chromium-only serial walk that
 * writes the demo member's language ("the visitor language after a signed-in
 * choice" in `journeys.spec.ts`), which puts the fixture back and asserts it
 * did. The sign-in fallback a filtered run needs goes to `storeSession()`
 * instead, which touches no fixture data.
 *
 * The workspace default itself is not ours to set: it is `organization_settings`
 * and an owner's to change. So the pin verifies rather than assumes, and reports
 * the one thing it cannot fix.
 */
export async function pinDemoLanguage(page: Page): Promise<boolean> {
  const chip = page.locator('[data-testid="locale-chip-workspace"]')
  try {
    // `networkidle`, not the default `load`: a visible chip is not a hydrated
    // chip, and a click that lands before hydration is swallowed silently —
    // `data-selected` then never arrives and this helper reports a failure that
    // is really a race with its own page.
    await page.goto('/settings/language', { waitUntil: 'networkidle' })
    await chip.waitFor({ state: 'visible', timeout: 15_000 })
    if ((await chip.getAttribute('data-selected')) === null) {
      // Armed before the click, because the response can arrive first.
      const written = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/_serverFn/'),
        { timeout: 15_000 },
      )
      await chip.scrollIntoViewIfNeeded()
      await chip.click()
      await expect(chip).toHaveAttribute('data-selected', '', {
        timeout: 15_000,
      })
      // That attribute is optimistic: the picker's host moves the selection
      // before the POST answers, so the control never stalls under a click.
      // Reloading on it alone navigates away mid-flight, and a cancelled
      // request leaves the very row this helper exists to clear exactly as it
      // was. So the write is awaited first, and only then is the pin confirmed
      // against the *server* — a fresh document, negotiated from the row the
      // write was meant to change. Reading `html.lang` off the optimistic page
      // instead raced the write, and losing that race made this helper report
      // that the workspace supplies a language it does not.
      await written
      await page.reload()
      await chip.waitFor({ state: 'visible', timeout: 15_000 })
      if ((await chip.getAttribute('data-selected')) === null) {
        console.warn(
          `[shoot] the demo traveller's language override did not clear — ` +
            `/settings/language still shows a language of their own after a ` +
            `reload. Every journey behind the session assumes there is none.`,
        )
        return false
      }
    }
    const lang = await page
      .locator('html')
      .evaluate((node: HTMLElement) => node.lang)
    if (lang !== 'en') {
      console.warn(
        `[shoot] the demo workspace supplies "${lang}", not "en" — every ` +
          `journey behind the session reads English. Reset it under ` +
          `/settings/organization, or re-run: node scripts/seed/seed.mjs`,
      )
      return false
    }
    return true
  } catch (cause: unknown) {
    console.warn(
      `[shoot] could not pin the demo traveller's language: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    )
    return false
  }
}

/** The cached session, or null when there is none worth using. */
export async function loadSession(): Promise<StoredState | null> {
  try {
    const parsed = JSON.parse(await readFile(AUTH_STATE, 'utf8')) as StoredState
    return parsed.cookies.length > 0 ? parsed : null
  } catch {
    return null
  }
}

/**
 * Puts the cached session into this context, signing in once as a fallback when no cache exists —
 * which keeps the suite working when it is run with a filter that excludes the setup project.
 */
export async function useSession(
  context: BrowserContext,
  page: Page,
  baseURL: string | undefined,
): Promise<boolean> {
  const stored = await loadSession()
  if (stored !== null) {
    await context.addCookies(stored.cookies)
    return true
  }
  // Deliberately not `cacheSession()`: this runs from a `beforeEach`, and the
  // language pin that function performs is a write to the shared fixture that
  // belongs to the setup project alone. And not `storeSession()` either: that
  // one writes the cache file, and with several workers each discovering the
  // missing cache at once they would race to overwrite the same file — the
  // cookies land in this context through `page.request` regardless.
  return signIn(page, baseURL)
}

/**
 * True once this worker has seen a usable session in the browser context.
 *
 * Remembered per worker process: every authenticated `beforeEach` installs the
 * same cached cookies, so one positive probe answers for the rest of the run.
 * The probe is `/api/auth/get-session`, which shares the auth rate limiter's
 * single per-path bucket (100 a minute) — asked once per test, 94 tests a run
 * compressed into a few minutes by parallel workers would trip it and turn the
 * whole authenticated suite into false skips.
 */
let sessionSeen = false

export async function hasSession(page: Page): Promise<boolean> {
  if (sessionSeen) {
    return true
  }
  const response = await page.request.get('/api/auth/get-session', {
    failOnStatusCode: false,
  })
  if (!response.ok()) {
    return false
  }
  const body: unknown = await response.json().catch(() => null)
  sessionSeen = typeof body === 'object' && body !== null && 'user' in body
  return sessionSeen
}
