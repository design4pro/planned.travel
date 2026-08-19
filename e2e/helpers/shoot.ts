import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

/**
 * Screenshot helpers for the visual gate.
 *
 * The gate that `/ultrabuild` runs needs frames that only change when the design
 * changes. Fonts, in-flight images and the first animation frame are the three
 * things that otherwise make a baseline flap, so every capture goes through
 * `settle()` first.
 */

export type Theme = 'light' | 'dark'

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
 */
export async function signIn(
  page: Page,
  baseURL: string | undefined,
): Promise<boolean> {
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: { origin: baseURL ?? 'http://localhost:3000' },
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
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
  return cacheSession(page, baseURL)
}

/** True when the browser context currently holds a usable session. */
export async function hasSession(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/auth/get-session', {
    failOnStatusCode: false,
  })
  if (!response.ok()) {
    return false
  }
  const body: unknown = await response.json().catch(() => null)
  return typeof body === 'object' && body !== null && 'user' in body
}

export const THEMES: ReadonlyArray<Theme> = ['light', 'dark']

export type RouteCase = {
  /** Slug used in the snapshot filename. */
  readonly name: string
  readonly path: string
  /** A selector that proves the route actually rendered its own content. */
  readonly ready: string
}

/**
 * Routes reachable without a session. These are the ones the gate can always
 * cover, on any machine, with no fixtures.
 */
export const PUBLIC_ROUTES: ReadonlyArray<RouteCase> = [
  { name: 'landing', path: '/', ready: 'main' },
  { name: 'pricing', path: '/pricing', ready: 'main' },
  { name: 'login', path: '/login', ready: 'form' },
  { name: 'register', path: '/register', ready: 'form' },
  { name: 'forgot-password', path: '/forgot-password', ready: 'form' },
  { name: 'legal-terms', path: '/legal/terms', ready: 'main' },
  { name: 'legal-privacy', path: '/legal/privacy', ready: 'main' },
]

/**
 * Routes behind auth. Covered only when the run supplies credentials, so a
 * missing fixture reports as skipped rather than as a design regression.
 */
export const APP_ROUTES: ReadonlyArray<RouteCase> = [
  { name: 'dashboard', path: '/dashboard', ready: 'main' },
  { name: 'trips', path: '/trips', ready: 'main' },
  { name: 'atlas', path: '/atlas', ready: 'main' },
  { name: 'journey', path: '/journey', ready: 'main' },
  { name: 'vacay', path: '/vacay', ready: 'main' },
  { name: 'settings', path: '/settings', ready: 'main' },
]

/**
 * Select the theme by emulating the media feature, and nothing else.
 *
 * docs/DESIGN.md guarantees the media-query path works with no attribute set —
 * dark values live in `@media (prefers-color-scheme: dark)` guarded as
 * `:root:not([data-theme="light"])` — so emulation is the whole job. Writing
 * `data-theme` from the test would only fight the app's own theme script, and
 * writing it before `goto` (as an earlier version did) applied it to
 * `about:blank` and was silently discarded.
 *
 * Reduced motion is deliberately NOT forced here: `toHaveScreenshot` already
 * runs with `animations: 'disabled'`, which settles animations at capture time,
 * and forcing the media feature globally makes `motion` log a warning that the
 * console assertion would then read as an app defect.
 */
export async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
}

/**
 * Wait until the frame is worth photographing.
 *
 * Retried, because a route that hydrates into a redirect tears down the execution context underneath
 * an in-flight `page.evaluate` — which surfaced as "Execution context was destroyed" on the atlas
 * route. Re-running the sequence against the new document is the correct response; failing would have
 * reported a navigation as a design defect.
 */
export async function settle(page: Page, ready: string): Promise<void> {
  const ATTEMPTS = 3
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      await settleOnce(page, ready)
      return
    } catch (error) {
      const transient =
        error instanceof Error &&
        /Execution context was destroyed|navigation/i.test(error.message)
      if (!transient || attempt === ATTEMPTS) {
        throw error
      }
      await page.waitForLoadState('domcontentloaded')
    }
  }
}

async function settleOnce(page: Page, ready: string): Promise<void> {
  await page.locator(ready).first().waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // Any <img> already in the DOM must have decoded, or the baseline captures a
  // half-painted card. Missing/broken images resolve too — that is a different
  // test's job to fail on.
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            }),
        ),
    ).then(() => undefined),
  )
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => r())),
  )
  await page.mouse.move(0, 0)
  await page.evaluate(() => window.scrollTo(0, 0))
}

/**
 * Attach a console listener before navigation and return a getter for whatever
 * it caught. The quality bar in docs/SPEC.md §2 is zero console errors, so this
 * is an assertion input, not diagnostics.
 *
 * Assert on the result BEFORE taking a screenshot. Playwright's capture options
 * (`caret: 'hide'`, `animations: 'disabled'`) mutate the page, and on a route
 * with an autofocused input that produces a React hydration-mismatch error which
 * has nothing to do with the app. Reading the console first keeps the assertion
 * strict instead of needing a denylist of the harness's own noise.
 */
export function watchConsole(page: Page): () => ReadonlyArray<string> {
  const problems: Array<string> = []

  page.on('console', (message) => {
    const type = message.type()
    if (type === 'error' || type === 'warning') {
      problems.push(`${type}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    problems.push(`pageerror: ${error.message}`)
  })

  return () => problems
}

/** Navigate, settle, and assert the response was not an error page. */
export async function visit(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  await applyTheme(page, theme)
  const response = await page.goto(route.path, {
    waitUntil: 'domcontentloaded',
  })
  expect(
    response?.status() ?? 0,
    `${route.path} should not be an error response`,
  ).toBeLessThan(400)
  await settle(page, route.ready)
}

/** Full-page baseline comparison, named for the snapshotPathTemplate. */
export async function shoot(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
    fullPage: true,
  })
}
