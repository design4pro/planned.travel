import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { classifyConsoleMessage } from './console-policy'
import type { ConsoleReport } from './console-policy'

/**
 * The harness the end-to-end journeys are driven through.
 *
 * It used to be the visual gate's, and most of it was determinism machinery for a
 * pixel comparison that no longer happens (ADR 0016). What is left is what a
 * journey needs to reach a screen and grade what it finds: a session, the route
 * tables, a settle that ends on the frame a reader actually sees, the console
 * policy, and the two fixtures - the platform console and an impersonated session
 * - that no product surface can mint for itself.
 *
 * Five things still have to be held still, and each has its own seam so a failure
 * in one can never be hidden by another.
 *
 * 1. **Paint timing** - fonts, hydration, entrance motion, in-flight images.
 *    `settle()`, which is what turns "the response arrived" into "the route
 *    rendered its own content". Its step that waits for React to claim the tree
 *    is also what keeps the console reading honest: assertions run against a
 *    hydration mismatch that has already happened, not one still in flight.
 * 2. **The clock the browser reads** - `FROZEN_NOW`, installed before the first
 *    navigation. The atlas paints each visited country by how long ago it was
 *    last there, from a client-side `new Date()`, so without this the map
 *    recolours itself the day the calendar crosses a threshold. It pins the wall
 *    clock and fakes the page's timer APIs alongside it, which is why nothing this
 *    file runs in the page measures elapsed time with a clock - read the note on
 *    `FROZEN_NOW` before writing anything that does.
 * 3. **The calendar the server selected rows on** - the Worker picks *which rows*
 *    a screen shows by comparing a date column against its own notion of today.
 *    `serverToday()` (`src/server/clock.ts`) takes that answer from the
 *    `x-pt-server-today` header on a development request, and
 *    `playwright.config.ts` sets it to `FIXTURE_DAY` on both browser projects, so
 *    the SSR document and the server-function POSTs that follow it cannot
 *    disagree. The guard is `import.meta.env.DEV`, which the production build
 *    folds to `false` and drops along with the header name.
 *
 *    The pin outlived the baselines it was recorded for, deliberately. On the
 *    seeded workspace the dashboard's reservation rail empties for good after
 *    2026-10-12, and `trips-core.visual.spec.ts` starts skipping on a fixture it
 *    can no longer find - a suite that goes green by covering less, on a morning
 *    nobody touched it. The audit around the pin is gone; the pin is not.
 * 4. **A live WebGL map** - a canvas that has not finished drawing.
 *    `[data-map-ready]`, waited on inside `settle()`. `/atlas` is the one route in
 *    these tables that declares one; the failure modes a real canvas cannot be
 *    asked to perform - never latching at all, or latching on a route that
 *    declares nothing - are exercised by `the gate itself` against a document
 *    built for them.
 * 5. **Browser chatter that is not the app talking** - the performance advisory
 *    the software rasteriser headless Chromium paints WebGL with, and the
 *    unused-preload advisory either engine writes about a Vite dev-server URL a
 *    few seconds after the load event. `classifyConsoleMessage()` in
 *    `./console-policy`, two anchored patterns, and nothing wider: a warning the
 *    app writes itself stays fatal even when it quotes one of them, and a React
 *    hydration report is not a warning at all. The policy is a separate module
 *    because it is pure, and it is graded by vitest rather than by a browser.
 *
 * A sixth is not a determinism problem but a fixture one. **The language the
 * demo traveller speaks** is a mutable D1 column that `/settings/language` exists
 * to change, so `pinDemoLanguage()` puts it back to the workspace default once
 * per run, in the setup project, and reports the part of that it cannot set
 * itself.
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
 * asserted in prose: the one caller is `cacheSession()`, which `auth.setup.ts`
 * alone runs, and the sign-in fallback a filtered run needs goes to
 * `storeSession()` instead, which touches no fixture data.
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

export const THEMES: ReadonlyArray<Theme> = ['light', 'dark']

/**
 * TanStack's development toolbar, which is tooling rather than product.
 *
 * One selector, two uses — hidden by `settle()` (`hideDevChrome()`) and asserted
 * hidden by `readCaptureState()`. Two copies of a `data-testid` is two places for
 * it to rot.
 *
 * Hiding it is not tidiness now that no frame is compared. Its trigger is a
 * `position: fixed` badge, and on the phone viewport it lands over the "Trips"
 * destination in the tab bar — measured at 0,595, 98x64 — where it takes the
 * press meant for the product. `a finger reaches the same facts on a phone`
 * asserts that from the other side, as a claim about the tab bar rather than
 * about the toolbar.
 */
export const DEV_TOOLBAR = '[data-testid="tanstack_devtools"]'

export type RouteCase = {
  /** Slug used in failure messages, so a stale entry points at its own source. */
  readonly name: string
  readonly path: string
  /** A selector that proves the route actually rendered its own content. */
  readonly ready: string
  /**
   * The route mounts a live MapLibre canvas.
   *
   * Declared rather than sniffed. `settle()` waits for every `[data-map-ready]`
   * marker on the page either way, but a marker that has not been rendered *yet*
   * — a map behind a Suspense boundary, or one mounted from an effect — makes a
   * bare probe pass instantly and prove nothing. The declaration closes that: a
   * route that says it has a map must produce a marker, and a route that says it
   * has none must not, so neither half can rot in silence.
   *
   * `/atlas` is the only route in THIS table that carries one - the trip planner
   * at `/trips/$tripId/plan` mounts a map too, but it takes a route param and so is
   * not walked here. Both halves of the audit and the wait itself are additionally
   * exercised by `the gate itself` against a document built for them, because the
   * interesting states — a canvas that never latches, a marker on a route that
   * declares nothing — are states no real screen can be asked to enter, and
   * machinery whose first run is the run it is needed on is machinery nobody has
   * tested.
   */
  readonly map?: true
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
 * The year `/vacay` is walked in.
 *
 * The route defaults its year to the server's `currentYear()`, which makes every
 * numeral, every month grid and the entitlement label on that screen change on 1
 * January — the same rot as the countdown, one year apart. It is also the one
 * clock-derived input the product already accepts from the URL
 * (`validateSearch` in `src/routes/_app/vacay.tsx`), so the gate pins it there
 * instead of excluding anything: the frame is identical to the one the default
 * produces today, and it stays identical after the new year.
 */
export const PINNED_YEAR = 2026

/**
 * Routes behind auth. Covered only when the run supplies credentials, so a
 * missing fixture reports as skipped rather than as a design regression.
 *
 * `/settings/language` is a route rather than a section of `/settings` because a
 * twenty-four-option grid of native names cannot live in a `SettingsRow`, and it
 * is walked separately for the same reason: it is the one screen whose whole
 * subject is a control, and a chip grid that throws on one theme's branch throws
 * nowhere else in this table.
 *
 * `/atlas` is the one route with a live map, and the flag and the canvas have to
 * travel together: `settleMap()` fails a route that renders a `[data-map-ready]`
 * marker without declaring one *and* a route that declares one and renders none,
 * so neither half can be right on its own.
 */
export const APP_ROUTES: ReadonlyArray<RouteCase> = [
  { name: 'dashboard', path: '/dashboard', ready: 'main' },
  { name: 'trips', path: '/trips', ready: 'main' },
  { name: 'atlas', path: '/atlas', ready: 'main', map: true },
  { name: 'journey', path: '/journey', ready: 'main' },
  { name: 'vacay', path: `/vacay?year=${PINNED_YEAR}`, ready: 'main' },
  { name: 'settings', path: '/settings', ready: 'main' },
  { name: 'settings-language', path: '/settings/language', ready: 'main' },
]

/**
 * Select the theme by emulating the media feature, and nothing else.
 *
 * DESIGN.md guarantees the media-query path works with no attribute set —
 * dark values live in `@media (prefers-color-scheme: dark)` guarded as
 * `:root:not([data-theme="light"])` — so emulation is the whole job. Writing
 * `data-theme` from the test would only fight the app's own theme script, and
 * writing it before `goto` (as an earlier version did) applied it to
 * `about:blank` and was silently discarded.
 *
 * Reduced motion is deliberately NOT forced here. Forcing the media feature makes
 * the motion layer log a warning, and that warning is a *real* one — the app's own
 * code talking — so it is not in TOLERATED_CONSOLE_WARNINGS and must not be put
 * there. The one journey that needs the preference emulates it for itself, at the
 * end of its walk, and stops reading the console before it does.
 */
export async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
}

/* -------------------------------------------------------------------------------------------------
 * The clock the browser reads
 * ---------------------------------------------------------------------------------------------- */

/**
 * The instant every gate frame is rendered at, as far as the browser is
 * concerned.
 *
 * `page.clock.setFixedTime` holds the *wall clock* still and lets everything
 * else run: measured on the pinned Playwright in both engines, an in-page
 * `Date.now()` advances by 0 ms across a real 500 ms `setTimeout` while
 * `performance.now()` advances by 501. MapLibre's render loop and React's
 * scheduler therefore keep going, which is the whole reason this is
 * `setFixedTime` and not `clock.install()` — the latter suspends the timers and
 * has to be ticked by hand, and a map would never finish drawing.
 *
 * What it does *not* do is leave the other clocks alone, and the difference cost
 * this gate a round. `setFixedTime` installs the entire clock harness: `Date`,
 * `performance`, `setTimeout`, `setInterval` and `requestAnimationFrame` are all
 * Playwright's own implementations afterwards — `String(setTimeout)` carries no
 * `[native code]` in either engine — and they are then resumed against real time,
 * which is why they still fire and why only `Date` is pinned. The consequence is
 * a rule rather than a curiosity: **nothing running inside the page may measure
 * elapsed time with `Date`**. `settleMutations()` did, subtracting two readings of
 * a frozen clock always gave it 0 ms, its floor could therefore never be
 * satisfied, and every frame in the suite was taken on the give-up cap with no
 * quiet guarantee at all. It now latches on a timer instead of doing arithmetic
 * on any clock, which is immune to this and to a future `clock.install()` alike.
 *
 * The value is arbitrary but not careless. The atlas paints each visited country
 * by how long ago it was last there (`visitRecency`, thresholds at 2 and 8
 * years) from a *client-side* `new Date()`, so without this the map recolours
 * itself the day the calendar crosses a threshold — for the seeded dates, on
 * 2026-09-06. 2026-06-15 sits 83 days from the nearest of those thresholds and
 * puts every seeded country in the band a reader sees today, so the map under
 * test is the map the product draws rather than a different one.
 *
 * This fixes the clock *in the browser*, and only there. What the Worker rendered
 * into the HTML before the browser existed is seam 3's, pinned by a request
 * header from `playwright.config.ts`; the two are deliberately separate.
 */
export const FROZEN_NOW = '2026-06-15T12:00:00.000Z'

/* -------------------------------------------------------------------------------------------------
 * The map
 * ---------------------------------------------------------------------------------------------- */

/**
 * How long a live map gets to finish drawing.
 *
 * `MapCanvas` publishes `data-map-ready="false"` from its first render and
 * latches it to `"true"` on MapLibre's own `idle` event — "no camera transition
 * in progress, every requested tile loaded, every fade finished", which is
 * exactly the pixel-stability predicate a screenshot needs. A renderer that will
 * never draw at all latches the same marker off `MAP_ENGINE_TIMEOUT_MS` (6000 ms
 * in `src/components/map/map-context.tsx`), so the honestly-degraded "basemap
 * unavailable" panel is reached instead of waited out.
 *
 * 15 s covers both: measured locally at ~1.0 s on Chromium/SwiftShader and
 * ~0.9 s on WebKit against a cold tile archive, with the 6 s stall clock as the
 * only hard number to clear, and it stays well inside the 30 s test timeout.
 */
export const MAP_READY_TIMEOUT_MS = 15_000

/** What the page says about its maps at the moment the census was taken. */
export type MapCensus = {
  readonly total: number
  readonly unsettled: number
}

/**
 * Count the readiness markers in the document, and how many are still drawing.
 *
 * Run as a page function rather than through two locators, so the census is one
 * round trip and one instant: a marker that latches between two queries would
 * otherwise be counted in one and not the other.
 */
function censusIn(): MapCensus {
  const markers = Array.from(document.querySelectorAll('[data-map-ready]'))
  return {
    total: markers.length,
    unsettled: markers.filter(
      (marker) => marker.getAttribute('data-map-ready') !== 'true',
    ).length,
  }
}

/** The census, exported so a spec can drive `settleMap()` without a real map. */
export async function readMapCensus(page: Page): Promise<MapCensus> {
  return page.evaluate(censusIn)
}

/**
 * Hold until no map on the page is still drawing, and audit the
 * declaration in both directions.
 *
 * Taken from a census the settling sequence already collected, so the twelve
 * routes with no map pay nothing at all for the wait: the polling assertion is
 * entered only when a marker exists *and* reads `false`.
 *
 * `timeout` is a parameter for one reason: the only way to prove this fails
 * loudly rather than settling on an unfinished canvas is to hand it a marker
 * that never latches, which no real screen can be asked to produce, and a spec
 * should not spend MAP_READY_TIMEOUT_MS proving it. Every caller in `settle()`
 * uses the default.
 */
export async function settleMap(
  page: Page,
  route: RouteCase,
  census: MapCensus,
  timeout: number = MAP_READY_TIMEOUT_MS,
): Promise<void> {
  if (census.unsettled > 0) {
    await expect(
      page.locator('[data-map-ready="false"]'),
      `${route.path}: a map on this page has not finished drawing`,
    ).toHaveCount(0, { timeout })
  }
  if (route.map === true) {
    expect(
      census.total,
      `${route.path} declares \`map: true\` but rendered no [data-map-ready] marker — either the map stopped mounting or the declaration is stale`,
    ).toBeGreaterThan(0)
    return
  }
  expect(
    census.total,
    `${route.path} mounts a live map but the route table does not declare \`map: true\` — add it, so the route settles after the canvas has finished drawing`,
  ).toBe(0)
}

/* -------------------------------------------------------------------------------------------------
 * Settling
 * ---------------------------------------------------------------------------------------------- */

/**
 * Wait until the page is worth asserting against.
 *
 * Retried, because a route that hydrates into a redirect tears down the execution context underneath
 * an in-flight `page.evaluate` — which surfaced as "Execution context was destroyed" on the atlas
 * route. Re-running the sequence against the new document is the correct response; failing would have
 * reported a navigation as a design defect.
 *
 * The sequence itself is documented on `settleOnce()`. It ends on the page the
 * product actually shows a reader.
 */
export async function settle(page: Page, route: RouteCase): Promise<void> {
  const ATTEMPTS = 3
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      await settleOnce(page, route)
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

/**
 * How long the frame gets to stop changing, and how long it gets to try.
 *
 * `DOM_QUIET_MS` is the pause with no mutation anywhere in the document that
 * counts as "finished". It sits at the bottom of the 150–260 ms band
 * DESIGN.md gives entrance motion, which is enough for a staggered list that
 * is still arriving to keep resetting it, and it is many animation frames longer
 * than the reflow it is really there to wait out. `DOM_QUIET_CAP_MS` stops the
 * wait dead if something on the page mutates forever — a dev-server heartbeat, a
 * live clock — so the sequence degrades to "wait two seconds" rather than to a
 * test timeout.
 *
 * Measured on this app at :3003, at the two viewports the suite actually runs:
 * hydration lands 85–256 ms after `domcontentloaded` on Chromium at 1440x900 and
 * 196–427 ms on WebKit at 393x659, and after this quiet period the document has
 * stopped changing under the assertions on both engines.
 *
 * `DOM_QUIET_FLOOR_MS` is the one thing quiet alone cannot express: a control that
 * mounts on a *timer*, in a document that has nothing else to do while the timer
 * runs. The app's avatar is exactly that — `src/components/layout/kit.tsx` renders
 * Radix's fallback with `delayMs={200}` when a user has an image, so the initials
 * land about 200 ms after mount and nothing mutates in between. A 150 ms quiet
 * window can therefore close at ~150 ms, 50 ms before the initials exist, and the
 * page a journey then reads is one the product has not finished rendering.
 * Holding the observer open past the longest timer the product arms means the
 * mutation is seen and quiet restarts after it. 350 ms is that timer plus half of
 * it again, and it stays well under the cap.
 *
 * All three are exported because the numbers are only half the guarantee: the
 * other half is *which* of them the wait actually ends on, and for a while the
 * answer was "always the cap" (see `settleMutations()`). `the gate itself` asserts
 * that under the frozen clock the quiet path still resolves, and it needs the cap
 * to state what it is asserting the wait came in under.
 */
export const DOM_QUIET_MS = 150
export const DOM_QUIET_FLOOR_MS = 350
export const DOM_QUIET_CAP_MS = 2_000

/**
 * The signal that React has claimed the whole tree.
 *
 * React stamps `__reactFiber$…` on each host node as it hydrates it, so the last
 * element in document order carrying one means the walk reached the end. Run in
 * the page, and shared by `settle()` and `readCaptureState()` so the two cannot
 * disagree about what "hydrated" means.
 */
function hydratedIn(selector: string): boolean {
  const claimed = (node: Element): boolean =>
    Object.keys(node).some((key) => key.startsWith('__reactFiber$'))
  const root = document.querySelector(selector)
  if (root === null || !claimed(root)) {
    return false
  }
  const nodes = root.querySelectorAll('*')
  return nodes.length === 0 || claimed(nodes[nodes.length - 1])
}

/**
 * Hold until nothing in the document has mutated for `DOM_QUIET_MS`, and never
 * before `DOM_QUIET_FLOOR_MS` has passed.
 *
 * The floor is not padding. A mutation observer can only report a mutation, so a
 * quiet window that closes before a timer-driven control has mounted reports quiet
 * on a document that is about to change — see `DOM_QUIET_FLOOR_MS`. Holding the
 * observer open until the floor keeps that mutation inside the window, where it
 * restarts the quiet period like any other.
 *
 * **Three timers and two latches, and not one reading of a clock.** The first
 * version of this expressed the floor as arithmetic — `Date.now()` at open,
 * `Date.now()` again on every quiet window, hold if the difference was under the
 * floor — and it was wrong from the moment it met `FROZEN_NOW`. `visit()` installs
 * `page.clock.setFixedTime` before the first navigation, so in-page `Date` does not
 * move: the difference was 0 ms on every evaluation, the floor was never satisfied,
 * `stop()` rescheduled itself forever, and the only path that ever resolved was the
 * cap. Measured on this app in both engines: 2003 ms and 2004 ms, every route, for
 * a wait whose designed answer is 353 ms. The suite was not reading unsettled
 * pages — two seconds is longer than the quiet path it was meant to take — but it
 * had no quiet guarantee at all, and it was paying 1.65 s a route to have none.
 *
 * `performance.now()` would have fixed it (it advances in real time under a fixed
 * `Date`, measured), and it is still a clock. This does not read one. The floor is
 * a `setTimeout` armed once at open that flips a latch, the quiet window is a
 * `setTimeout` restarted by the observer that flips another, and the wait ends on
 * the first moment both latches are set — whichever order they land in. So a quiet
 * window that closes at 150 ms waits for the floor at 350, and a mutation at 349 ms
 * clears the quiet latch and pushes the end to 499, exactly as the arithmetic
 * version intended. Nothing here can be broken by a fixed clock, and nothing here
 * would break under a future `clock.install()` either.
 *
 * The cap stays outside both latches, as it always has: it is the one timer whose
 * job is to give up, and the floor must never be able to defer it.
 *
 * The repair shortened every settle in the suite from ~2000 ms of holding to
 * ~350 ms, and the whole suite stayed green across consecutive full runs — which
 * is the evidence that the extra 1.65 s was buying nothing, and that what the
 * floor now guarantees is what the cap was accidentally providing.
 *
 * Exported for the same reason `readMapCensus()` is: which of the three timers the
 * wait ends on is invisible in a green run, and it was wrong for every route in
 * the suite while every route in the suite passed. `the gate itself` measures this
 * function directly — with the frozen clock installed — rather than measuring
 * `settle()`, so what it asserts is the wait and not the round trips around it.
 */
export async function settleMutations(page: Page): Promise<void> {
  await page.evaluate(
    ({ quietMs, floorMs, capMs }) =>
      new Promise<void>((resolve) => {
        let quiet = 0
        let floor = 0
        let cap = 0
        let quietElapsed = false
        let floorReached = false
        const observer = new MutationObserver(() => restart())
        const finish = (): void => {
          observer.disconnect()
          window.clearTimeout(quiet)
          window.clearTimeout(floor)
          window.clearTimeout(cap)
          resolve()
        }
        const stop = (): void => {
          quietElapsed = true
          // Quiet, but only believable once the floor has passed: a control the
          // product mounts on a timer has not arrived yet, and the observer will
          // see it and clear this latch again.
          if (floorReached) {
            finish()
          }
        }
        const restart = (): void => {
          quietElapsed = false
          window.clearTimeout(quiet)
          quiet = window.setTimeout(stop, quietMs)
        }
        floor = window.setTimeout(() => {
          floorReached = true
          if (quietElapsed) {
            finish()
          }
        }, floorMs)
        // The cap ends the wait whatever the observer is seeing, so a page that
        // mutates forever degrades to a fixed pause instead of a test timeout. It
        // is deliberately not routed through `stop()`: the floor must never be able
        // to defer the one timer whose job is to give up.
        cap = window.setTimeout(finish, capMs)
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        })
        restart()
      }),
    {
      quietMs: DOM_QUIET_MS,
      floorMs: DOM_QUIET_FLOOR_MS,
      capMs: DOM_QUIET_CAP_MS,
    },
  )
}

/**
 * Take the development toolbar out of the way.
 *
 * `src/routes/__root.tsx` mounts TanStack's devtools behind
 * `import.meta.env.DEV`, and it appears as a 60x60 fixed trigger over the
 * bottom-right of the viewport the moment the tree hydrates. It is tooling, not
 * product: Vite replaces the flag with `false` in the deployed bundle, so no
 * reader ever sees it.
 *
 * It is not merely untidy. On the phone viewport the trigger lands *on* the
 * shell's tab bar - measured on WebKit at 393x659 and again at 393x852, the
 * trigger's own box over the "Trips" destination at 0,595, 98x64 - and
 * `document.elementFromPoint` at the middle of that tab resolves inside the
 * toolbar. A finger aiming at Trips reaches the dev server. Hiding it is what
 * makes every touch assertion in this suite a statement about the product, and
 * `a finger reaches the same facts on a phone` asserts the tab bar is reachable
 * from the other side, so this cannot rot silently.
 *
 * Hidden by a rule, not by an inline style. Writing `display: none` onto the
 * element is a one-shot: it hides whatever exists at that instant, and the trigger
 * has two ways past it. It can mount *after* this step — the toolbar is
 * client-only and arrives whenever the dev server gets round to it — and its own
 * React render owns its `style` attribute, so a re-render puts back what it had
 * before.
 *
 * A stylesheet rule cannot be raced or re-rendered away. `!important` beats an
 * inline style, and a rule matches an element that does not exist yet, so the
 * trigger is hidden whenever it arrives and stays hidden however often it renders.
 * It moves no layout either: the trigger is `position: fixed` inside a zero-height
 * wrapper. The tag goes in `<head>` under a known id and is written once per
 * document, so re-settling after a viewport resize does not stack another copy.
 */
const DEV_CHROME_STYLE_ID = 'planned-gate-hide-dev-chrome'

async function hideDevChrome(page: Page): Promise<void> {
  await page.evaluate(
    ({ selector, id }) => {
      if (document.getElementById(id) !== null) {
        return
      }
      const style = document.createElement('style')
      style.id = id
      style.textContent = `${selector}{display:none !important}`
      document.head.appendChild(style)
    },
    { selector: DEV_TOOLBAR, id: DEV_CHROME_STYLE_ID },
  )
}

/**
 * The settling sequence.
 *
 * Ordered, and the order is the whole point: every step is a thing that would
 * otherwise still be happening while a journey asserted against the page.
 *
 *  1. the route's own content is on screen;
 *  2. webfonts have loaded, so nothing reflows from a fallback face;
 *  3. **React has hydrated the tree.** Without it a journey reads whichever of two
 *     documents won a race: the server's markup, or the client's. They are not the
 *     same page - on `/login` they differ by 109px of document height, because the
 *     passkey affordance can only be resolved in the browser - and a console
 *     assertion taken across that boundary is graded against a hydration that has
 *     not finished;
 *  4. nothing in the document has mutated for `DOM_QUIET_MS`, and not before
 *     `DOM_QUIET_FLOOR_MS` — which is where a staggered entrance finishes, where a
 *     client-only panel arrives, and where a control the product mounts on a timer
 *     is waited for rather than raced;
 *  5. every `<img>` now in the DOM has decoded — after 3 and 4, so an image the
 *     client added is included rather than missed;
 *  6. the dev toolbar is hidden — a stylesheet rule rather than an inline style, so
 *     a trigger that mounts after this step or re-renders over its own `style`
 *     attribute is still out of the way of the controls under it;
 *  7. pointer and scroll reset, and only then the map census: the reset is the
 *     last thing that can set a hover feature-state on a map, so reading the
 *     marker after it folds any repaint it caused into the map's own first
 *     `idle` — the marker latches once and cannot report a second settle;
 *  8. the map has finished drawing (`settleMap`);
 *  9. two animation frames, last, so the commit for everything above is on screen
 *     before the journey touches it.
 */
async function settleOnce(page: Page, route: RouteCase): Promise<void> {
  await page.locator(route.ready).first().waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForFunction(hydratedIn, route.ready)
  await settleMutations(page)
  // Missing/broken images resolve too — that is a different test's job to fail
  // on, not this one's to hang on.
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
  await hideDevChrome(page)
  await page.mouse.move(0, 0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await settleMap(page, route, await readMapCensus(page))
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

/** What `settle()` promises about the page it hands back. */
export type CaptureState = {
  /** React has claimed the whole tree, so the page is the client's, not the server's. */
  readonly hydrated: boolean
  /** The dev toolbar is still on screen, where it takes presses meant for the product. */
  readonly devChromeShown: boolean
}

/**
 * Read back the two conditions `settle()` exists to guarantee.
 *
 * Asserted by a spec rather than trusted, because both failures are silent: a
 * `settle()` that stopped waiting for hydration would grade whichever document won
 * a race, and a dev toolbar that stopped being hidden would sit over the phone's
 * tab bar. Neither announces itself.
 */
export async function readCaptureState(
  page: Page,
  route: RouteCase,
): Promise<CaptureState> {
  const hydrated = await page.evaluate(hydratedIn, route.ready)
  const devChromeShown = await page.evaluate((selector) => {
    const toolbar = document.querySelector(selector)
    return (
      toolbar instanceof HTMLElement &&
      getComputedStyle(toolbar).display !== 'none'
    )
  }, DEV_TOOLBAR)
  return { hydrated, devChromeShown }
}

/**
 * The console policy lives in `./console-policy`, which imports nothing, so the
 * classifier and its tolerance table can be tested without a browser. Re-exported
 * here so every caller of this module is unchanged.
 */
export type {
  ConsoleReport,
  ConsoleVerdict,
  ToleratedConsoleWarning,
} from './console-policy'
export {
  TOLERATED_CONSOLE_WARNINGS,
  classifyConsoleMessage,
} from './console-policy'

/**
 * Attach a console listener before navigation and return a getter for what it
 * caught, split by verdict. The quality bar in docs/SPEC.md §2 is zero console
 * errors, so this is an assertion input, not diagnostics.
 *
 * One watcher per route, and the watcher is attached before the navigation it
 * grades. A journey that walks several routes gives each one its own page for the
 * same reason: an unmount runs while the next route is already being watched, and
 * an exception thrown there would be reported against a screen that did not throw
 * it.
 *
 * `tolerated` is returned rather than dropped on purpose. A filter that starts
 * swallowing real defects has to be visible in the run, not invisible by
 * construction, so the spec attaches whatever landed there to the test.
 */
export function watchConsole(
  page: Page,
  route: RouteCase,
): () => ConsoleReport {
  const fatal: Array<string> = []
  const tolerated: Array<string> = []
  const liveMap = route.map === true

  page.on('console', (message) => {
    const type = message.type()
    const text = message.text()
    const verdict = classifyConsoleMessage({ type, text, liveMap })
    if (verdict === 'fatal') {
      fatal.push(`${type}: ${text}`)
    } else if (verdict === 'tolerated') {
      tolerated.push(`${type}: ${text}`)
    }
  })
  page.on('pageerror', (error) => {
    fatal.push(`pageerror: ${error.message}`)
  })

  return () => ({ fatal, tolerated })
}

/** Navigate and settle, asserting the response was not an error page. */
/**
 * The webfont origins the document reaches for, and the pages already cleared to
 * reach them.
 *
 * Both are declared in `src/routes/__root.tsx`: the stylesheet comes from
 * `fonts.googleapis.com` and the `woff2` files it names come from
 * `fonts.gstatic.com`, which is the only cross-origin subresource in the
 * product.
 */
const WEBFONT_ORIGINS = [
  'https://fonts.googleapis.com/**',
  'https://fonts.gstatic.com/**',
] as const
const fontsUnblocked = new WeakSet<Page>()

/**
 * Take the webfont requests out of the browser's CORS path.
 *
 * Seam 4's pin (`playwright.config.ts`) rides on `extraHTTPHeaders`, and a
 * context header is sent to *every* origin the page touches — including the
 * font CDN. A font file is fetched in CORS mode, so a request carrying one
 * header outside the CORS safelist stops being a simple request and earns a
 * preflight; `fonts.gstatic.com` answers that preflight without naming the
 * header, the browser refuses the response, and both faces fall back to the
 * system stack — and, because it is announced as four console errors, every walk
 * in the suite then fails on the fonts rather than on what it was asserting.
 *
 * Routing those two origins hands the request to Playwright, which issues it
 * outside the page's CORS enforcement and returns it verbatim — the same bytes,
 * from the same CDN, with the preflight no longer in the way. Nothing about the
 * fonts themselves changes, which is the point.
 *
 * Registered once per page rather than once per navigation, because `visit()`
 * runs several times in some specs and Playwright keeps every handler it is
 * given.
 */
export async function unblockCrossOriginFonts(page: Page): Promise<void> {
  if (fontsUnblocked.has(page)) {
    return
  }
  fontsUnblocked.add(page)
  for (const origin of WEBFONT_ORIGINS) {
    await page.route(origin, (route) => route.continue())
  }
}

export async function visit(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  await unblockCrossOriginFonts(page)
  await applyTheme(page, theme)
  // Before `goto`, and before the document exists: the fixed time is installed
  // as an init script. It costs the frame nothing, because it runs on the
  // navigation rather than after the page has settled.
  await page.clock.setFixedTime(new Date(FROZEN_NOW))
  const response = await page.goto(route.path, {
    waitUntil: 'domcontentloaded',
  })
  expect(
    response?.status() ?? 0,
    `${route.path} should not be an error response`,
  ).toBeLessThan(400)

  await settle(page, route)
}

/* -------------------------------------------------------------------------------------------------
 * The platform console
 * ---------------------------------------------------------------------------------------------- */

/**
 * The console's own routes, kept out of `APP_ROUTES` on purpose.
 *
 * Three reasons, and none of them is tidiness. The account screen's path carries a `$userId` that
 * only the running database can supply, so it cannot be a constant in a table every audit iterates.
 * The whole tree is behind a *platform role* rather than merely behind a session, so a run against a
 * database seeded before that fixture existed has to skip these rather than walk the redirect to
 * `/dashboard` — a green run that asserted nothing about the console. And `APP_ROUTES` is
 * documented as the six screens the product's own navigation reaches; the console is reached from
 * the user menu, by an operator who already knows it is there.
 *
 * They are walked by the same machinery, so a console screen that 500s, never hydrates or writes to
 * the console fails the run exactly as an application screen does.
 *
 * `/console/users` is walked under an explicit sort, and that is load-bearing rather than
 * decorative. The demo fixture anchors every account's `created_at` to the same instant, so the
 * default `created_at desc` ordering has no tiebreaker and SQLite is free to return the four rows in
 * any order it likes. `?sort=name&dir=asc` is a total order over the fixture, and it exercises the
 * sort control in its active state as well.
 */
const CONSOLE_OVERVIEW_ROUTE: RouteCase = {
  name: 'console',
  path: '/console',
  ready: 'main',
}

/** Named, because the impersonation fixture drives a control on this exact screen. */
export const CONSOLE_ACCOUNTS_ROUTE: RouteCase = {
  name: 'console-users',
  path: '/console/users?sort=name&dir=asc',
  ready: 'main',
}

/**
 * The agent-run registry (`docs/adr/0009`), and what it draws when this deployment is not the one
 * coordinating the fleet.
 *
 * The registry binding is declared on `env.staging` alone - a second registry would let two fleets
 * each believe they hold the backlog - so a local or CI Worker has none, and the screen draws its
 * "this deployment does not coordinate the fleet" state.
 */
const CONSOLE_SANDCASTLE_ROUTE: RouteCase = {
  name: 'console-sandcastle',
  path: '/console/sandcastle',
  ready: 'main',
}

/**
 * The provider meters, reached for the same reason the registry is: an empty state the product
 * ships and every deployment starts in.
 *
 * Nothing in the seed makes an outbound call, so `provider_usage` is empty and every panel draws
 * its designed empty state — which is the state worth walking anyway, because it is the one every
 * deployment starts in.
 */
const CONSOLE_PROVIDERS_ROUTE: RouteCase = {
  name: 'console-providers',
  path: '/console/providers',
  ready: 'main',
}

export const CONSOLE_ROUTES: ReadonlyArray<RouteCase> = [
  CONSOLE_OVERVIEW_ROUTE,
  CONSOLE_ACCOUNTS_ROUTE,
  CONSOLE_SANDCASTLE_ROUTE,
  CONSOLE_PROVIDERS_ROUTE,
]

/**
 * The account `/console/users/$userId` is walked against.
 *
 * A collaborator rather than the demo owner: it is the fixture's `curator`, which is the middle rung
 * of the role scale and therefore the row that exercises the screen's role handling rather than the
 * operator's own.
 */
export const CONSOLE_ACCOUNT_NAME = 'Mika Tanaka'

/**
 * True when the signed-in account can actually open the console.
 *
 * Asked over `page.request` rather than by navigating, and that is a repair rather than a
 * preference. The guard is a `beforeLoad` redirect, so the honest question is which response the
 * server gives — and a probe that answered it by *navigating* left the page half way through loading
 * the client entry, which the next `visit()` then cancelled with its own `goto`. Chromium swallows the
 * aborted module import; WebKit reports it as `pageerror: Importing a module script failed`, and a
 * page error is fatal whatever produced it. Every console route failed on `mobile-safari` and none
 * on `chromium`, which is exactly the shape of a defect that gets blamed on the code under test.
 *
 * `page.request` shares the page's cookie jar and the context's headers, so this is the same
 * request the browser would make, and `maxRedirects: 0` is what makes the redirect readable instead
 * of followed: a `user`-role session is sent to `/dashboard`, an anonymous one to `/login`, and both
 * are "no console".
 */
export async function hasPlatformConsole(page: Page): Promise<boolean> {
  const response = await page.request.get('/console', {
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  return response.status() === 200
}

/**
 * The account screen's path, read out of the accounts document rather than hardcoded.
 *
 * The demo collaborators carry ids derived from their addresses, so a literal would work today and
 * would be a silent lie the first time that derivation changed. Taken over `page.request` for the
 * same reason as {@link hasPlatformConsole}: the caller's next act is a `goto`, and a navigation
 * here would be the one it cancels.
 *
 * **Matched inside the anchor, not by proximity to the name.** The obvious version of this - find
 * the name, take the nearest `href` before it - resolved the *previous* row for four rounds without
 * anyone noticing, because `Avatar` rendered the same name a second time as a screen-reader label a
 * few hundred bytes ahead of the link, and the nearest href before *that* is the row above. It
 * looked entirely plausible: a real account screen, for the wrong account. So the anchor's own text
 * is what decides, which is the property the row actually guarantees - the account's name is the
 * link.
 *
 * That duplicate is gone: `AccountIdentity` now marks the avatar `aria-hidden`, because the name it
 * repeated is printed one node to the right and every row was announcing the person twice. The
 * matching rule stays as it is anyway. It was never a workaround for the duplicate - it is the only
 * rule that says what this function means, and proximity would go wrong again the first time
 * anything else in a row carried the same string.
 */
export async function consoleAccountPath(page: Page): Promise<string | null> {
  const response = await page.request.get(CONSOLE_ACCOUNTS_ROUTE.path, {
    failOnStatusCode: false,
  })
  if (!response.ok()) {
    return null
  }
  const html = await response.text()
  const links = /href="(\/console\/users\/[^"]+)"/g
  for (const link of html.matchAll(links)) {
    const closed = html.indexOf('</a>', link.index)
    if (closed < 0) {
      continue
    }
    if (html.slice(link.index, closed).includes(CONSOLE_ACCOUNT_NAME)) {
      return link[1]
    }
  }
  return null
}

/* -------------------------------------------------------------------------------------------------
 * The impersonation warning bar
 * ---------------------------------------------------------------------------------------------- */

/** The account the impersonation fixture wears: a plain `user`, never an admin (docs/ACCESS.md §2.4). */
export const IMPERSONATION_TARGET_NAME = 'Jonas Berg'

/** The bar itself. One selector, used by the fixture and by the journeys. */
export const IMPERSONATION_BAR = '[aria-label="Impersonated session"]'

/**
 * Mints an impersonated session by driving the console, which is the only way there is.
 *
 * Not a database fixture and not a forged cookie: `/api/auth/admin/impersonate-user` answers `404`
 * (docs/ACCESS.md §2.6), so the account list's own action is the entire surface. Going through it
 * means the frame this produces is the frame an operator produces, and that the two audit rows
 * either side of it are written exactly as they are in production.
 *
 * Returns `false` when the console is unreachable, so a run against an unseeded database skips with
 * a reason instead of failing on a control it never found.
 */
export async function beginImpersonation(page: Page): Promise<boolean> {
  await unblockCrossOriginFonts(page)
  if (!(await hasPlatformConsole(page))) {
    return false
  }
  await page.goto(CONSOLE_ACCOUNTS_ROUTE.path, {
    waitUntil: 'domcontentloaded',
  })
  // Settled, not merely loaded. The row menu is a Radix trigger, so it does nothing at all until
  // React has claimed the tree - a click on the server's markup is a click on an inert button, and
  // the failure it produces is a timeout on the menu item that never opened.
  await settle(page, CONSOLE_ACCOUNTS_ROUTE)
  await page
    .getByRole('button', { name: `Actions for ${IMPERSONATION_TARGET_NAME}` })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Impersonate' }).click()
  await page.getByRole('button', { name: 'Start impersonating' }).click()
  await page.locator(IMPERSONATION_BAR).waitFor({ timeout: 15_000 })
  // The action swaps the cookie and then sends the router to `/dashboard`, and that navigation is
  // still in flight when the bar first paints. Leaving it in flight makes the next `goto` a race
  // the caller loses with "interrupted by another navigation" - so the fixture hands the browser
  // back settled rather than mid-move.
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  return true
}

/**
 * Hands the operator their own session back.
 *
 * Always run, including after a failed assertion: the browser context is thrown away with the test,
 * but the session row and its `admin_session` cookie are the product's, and leaving one live would
 * leave a `platform.user.impersonation_started` in the ledger with no `_ended` beside it — which
 * docs/ACCESS.md §4.3 defines as the signature of a session that lapsed rather than one that was
 * closed.
 */
export async function endImpersonationFixture(page: Page): Promise<void> {
  const end = page.getByRole('button', { name: 'End impersonation' })
  if ((await end.count()) === 0) {
    return
  }
  // The control is a React button, so a click before hydration lands on inert markup and the bar
  // simply stays. The route is whatever the caller left the browser on, and `settle()` only ever
  // reads `ready` and `map` off the case it is handed.
  await settle(page, { name: 'shell', path: page.url(), ready: 'main' })
  await end.first().click()
  await page
    .locator(IMPERSONATION_BAR)
    .waitFor({ state: 'detached', timeout: 15_000 })
}
