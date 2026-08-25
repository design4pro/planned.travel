import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'

/**
 * Screenshot helpers for the visual gate.
 *
 * The gate that `/ultrabuild` runs needs frames that only change when the design
 * changes. Six things otherwise make a baseline flap, and each one has its own
 * seam so that a regression in one can never be hidden by another. Five of those
 * seams close inside this file; the sixth is closed in the Worker and audited
 * here, for reasons written out under "What this file could not pin".
 *
 * 1. **Paint timing** — fonts, hydration, entrance motion, in-flight images.
 *    `settle()`, which ends on the frame a reader actually sees. Read the note on
 *    `settleOnce()`: the step that waits for React to claim the tree is what
 *    stopped `/settings` failing three runs in six at five times its pixel
 *    budget.
 * 2. **The clock the browser reads** — `FROZEN_NOW`, installed before the first
 *    navigation. This is what the atlas map's recency ramp is computed from. It
 *    pins the wall clock and fakes the page's timer APIs alongside it, which is
 *    why nothing this file runs in the page measures elapsed time with a clock —
 *    read the note on `FROZEN_NOW` before writing anything that does.
 * 3. **The clock the server read, as text** — a countdown that says "in 51d" the
 *    evening a baseline is recorded and "in 50d" the next morning.
 *    `RELATIVE_TIME_SITES` excludes those regions from the comparison; the
 *    tolerance is untouched. Two steps, because a mask is only ever as stable as
 *    the box it is handed: `pinRelativeTime()` rewrites each site's string to a
 *    constant from its own corpus, so the excluded rectangle is the same
 *    rectangle on every run and every calendar day, and the mask then paints over
 *    it so no invented value reaches the picture. Each entry is scoped to the
 *    component that prints it, and the declaration behind it is audited off the
 *    payload (`auditServerClock()`) rather than off the screen, because *how
 *    many* of these strings a screen shows is seam 4's business and not this
 *    one's.
 * 4. **The calendar the server selected rows on** — the Worker also picks *which
 *    rows* a screen shows by comparing a date column against its own notion of
 *    today. That notion is pinned rather than merely observed: `serverToday()`
 *    (`src/server/clock.ts`) accepts a development-only request header, and
 *    `playwright.config.ts` sets it to `BASELINE_DAY` on both browser projects,
 *    so the SSR document and every server-function call that follows it agree on
 *    the day the baselines were recorded. `CALENDAR_SELECTIONS` and
 *    `reportServerCalendar()` remain as the audit of that pin: they read the day
 *    back out of the Worker's own payload, so a pin that stopped arriving is
 *    reported as a named crossing instead of surfacing as an unexplained red
 *    frame. Read "What this file could not pin" below before touching it.
 * 5. **A live WebGL map** — a canvas that has not finished drawing.
 *    `[data-map-ready]`, waited on inside `settle()`. `/atlas` is the one route
 *    that declares one; the failure modes a real canvas cannot be asked to
 *    perform — never latching at all, or latching on a route that declares
 *    nothing — are exercised by `the gate itself` against a document built for
 *    them.
 * 6. **Browser chatter that is not the app talking** — the performance advisory
 *    the software rasteriser headless Chromium paints WebGL with, and the
 *    unused-preload advisory either engine writes about a Vite dev-server URL a
 *    few seconds after the load event. Neither is something the app did, and the
 *    second one arrives or does not according to how long the page stayed open.
 *    `classifyConsoleMessage()`, two anchored patterns, and nothing wider than
 *    that: a warning the app writes itself stays fatal even when it quotes one of
 *    them, and a React hydration report is not a warning at all.
 *
 * ## What this file could not pin
 *
 * Seams 1, 2, 3, 5 and 6 close completely from inside `e2e/`. Seam 4 never could,
 * and the reason is worth keeping written down so nobody spends another round
 * rediscovering it — or tries to solve it from here again.
 *
 * The Worker's `today` reaches the repositories, which filter with it:
 * `listUpcomingTrips` keeps a trip while `endDate >= today`, `listPastTrips`
 * takes it once `endDate <= today`,
 * `listUpcomingReservations` reads forward from `today`, and
 * `listTripsWithoutJourney` ranks by whether a trip has finished, started, or is
 * still ahead. When the calendar crosses one of the fixture's dates the Worker
 * therefore returns a *different set of rows*, and the screen renders one card
 * more, one card fewer, or the same cards in a different order. Measured on the
 * seeded workspace as it stands: on 2026-08-21 the reservation dated 2026-08-20
 * leaves the dashboard's rail, on 2026-08-24 the trip that ends on the 23rd stops
 * being "up next" and joins the journal's finished trips, and after 2026-10-12 the
 * rail is empty for good.
 *
 * No exclusion can absorb that, and the reason is geometry rather than taste. A
 * row entering or leaving a list moves everything below it and changes the height
 * of the document, and `toHaveScreenshot` only compares images of the same size —
 * so a page one row taller fails before any mask, any `threshold` or any
 * `maxDiffPixelRatio` is consulted. Measured on this fixture, by deleting the row
 * the calendar takes next — the reservation dated 2026-08-20, first in the
 * dashboard's rail: the document loses 65px on *both* projects, at 1440x900 on
 * Chromium and at 393x659 on mobile WebKit. 393x659 is the iPhone 15 descriptor's
 * viewport; its 393x852 is the device `screen`, which no capture in this suite is
 * ever taken at. `/atlas` loses nothing on either: it is a fixed-height map slice
 * and it paints no dated row at all, so a crossing reported against its payload
 * moves no atlas frame — which is exactly why the report is a diagnosis and not a
 * verdict. And an exclusion large enough to hold a list whose length the calendar
 * decides is an exclusion over the dashboard's hero and its whole right rail: it
 * would buy a green run by deleting the coverage the gate exists for, which is the
 * same trade as widening `maxDiffPixelRatio` and is refused for the same reason.
 *
 * A browser-side clock cannot reach it either. `page.clock.setFixedTime` patches
 * `Date` in the page; the rows were chosen in the Worker before the document
 * existed, and rewriting `today` in that document (see `shiftServerToday`) changes
 * the *strings* the client recomputes and not the *rows* the server sent.
 *
 * So the repair lives in the Worker, where the decision is made.
 * `serverToday()` in `src/server/clock.ts` is the single place the server answers
 * "what day is it", and on a development request it will take that answer from an
 * `x-pt-server-today` header; `playwright.config.ts` sets that header to
 * `BASELINE_DAY` for both browser projects, on the browser context, so the SSR
 * document and the server-function POSTs that follow it cannot disagree. The
 * guard is `import.meta.env.DEV`, which the production build folds to `false` and
 * drops along with the header name, so nothing deployed can be told what day it
 * is.
 *
 * What stays here is the audit, and it is not decoration.
 * `reportServerCalendar()` reads the day back out of the documents the Worker
 * actually streamed and compares the fixture's dates against `BASELINE_DAY` on
 * both days, so a pin that stopped arriving — a renamed header, a project without
 * it, a run against a production build — is named as "2026-08-23 has been crossed,
 * which moves the journal's finished trips" rather than discovered by cropping two
 * pictures.
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

/**
 * TanStack's development toolbar, which is tooling rather than product.
 *
 * One selector, three uses — hidden before the shutter (`hideDevChrome()`),
 * asserted hidden (`readCaptureState()`) and skipped when the day-boundary probe
 * reads the page's words (`readRelativeTime()`). Three copies of a `data-testid`
 * is three places for it to rot. Exported so a spec can mount a stand-in for it
 * and prove the hiding survives a late arrival.
 */
export const DEV_TOOLBAR = '[data-testid="tanstack_devtools"]'

/**
 * Elements whose text content is source, not copy.
 *
 * The day-boundary probe reads text nodes, and a `<script>` is full of them: the
 * loader payload is serialised into one, `today:"…"` and all, so a walk that
 * counted script text would report the probe's own rewritten input as a page that
 * had moved. `<style>` and `<template>` are the same category — bytes the browser
 * parses rather than words a reader sees.
 */
const TEXT_IS_NOT_COPY: ReadonlyArray<string> = [
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
]

export type RouteCase = {
  /** Slug used in the snapshot filename. */
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
   * not screenshotted here. Both halves of
   * the audit, the wait itself and the resize capture path are additionally
   * exercised by `the gate itself` against a document built for them, because the
   * interesting states — a canvas that never latches, a marker on a route that
   * declares nothing — are states no real screen can be asked to enter, and
   * machinery whose first run is the run it is needed on is machinery nobody has
   * tested.
   */
  readonly map?: true
  /**
   * The route's loader payload carries the Worker's `today`, so at least one
   * string on it is the wall clock's to decide.
   *
   * Declared as a fact about the *payload*, not about what is currently on
   * screen, and that distinction is the whole fix for a class of overnight
   * failure this file was written to end. Whether a countdown is *visible*
   * depends on which rows the Worker selected: `TripTile` renders its badge only
   * for a start date inside the next sixty days, so once the fixture's last
   * upcoming trip has started, `/trips` prints no clock-derived string at all —
   * for the seeded workspace, from 2026-10-10. An audit that demanded a declared
   * route "must have something to exclude" would therefore fail four specs that
   * morning, with a message blaming copy that nobody had touched. Payload
   * presence cannot move like that: `today` is a required field on the DTO
   * (`src/routes/_app/-server/overview.ts` and `.../library.ts` both declare
   * `readonly today: string`), returned whether or not a row uses it.
   *
   * So the flag is audited in two places, each asserting only what it can
   * actually see. `auditServerClock()` compares it against the streamed
   * documents in both directions, which is calendar-proof. `auditRelativeTime()`
   * keeps a *visible* clock-derived string fatal on a route that declares
   * nothing — the direction that protects the comparison — and reports, rather
   * than fails, when a declared route happens to show none this run.
   */
  readonly relativeTime?: true
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
 * The year `/vacay` is photographed in.
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
 * The three `relativeTime` routes are exactly the three whose loader payload
 * carries the server's `today` — verified by reading the SSR document for all
 * six: `/dashboard`, `/trips` and `/journey` each contain one `today:"…"`, and
 * `/atlas`, `/vacay` and `/settings` contain none. `auditServerClock()` re-checks
 * that on every run, in both directions.
 *
 * `/atlas` is the one route with a live map, and the flag and the canvas have to
 * travel together: `settleMap()` fails a route that renders a `[data-map-ready]`
 * marker without declaring one *and* a route that declares one and renders none,
 * so neither half can be right on its own. The declaration also moves that route
 * to the viewport-after-resize capture path (see `fitViewportToDocument()`), which
 * is why the four `atlas-*` baselines are re-recorded by whoever owns that screen
 * rather than left to fail.
 */
export const APP_ROUTES: ReadonlyArray<RouteCase> = [
  { name: 'dashboard', path: '/dashboard', ready: 'main', relativeTime: true },
  { name: 'trips', path: '/trips', ready: 'main', relativeTime: true },
  { name: 'atlas', path: '/atlas', ready: 'main', map: true },
  { name: 'journey', path: '/journey', ready: 'main', relativeTime: true },
  { name: 'vacay', path: `/vacay?year=${PINNED_YEAR}`, ready: 'main' },
  { name: 'settings', path: '/settings', ready: 'main' },
]

/**
 * Where the Worker's `today` is read from when the frame under diagnosis carries
 * none of its own.
 *
 * The server's clock is one fact per run, and only three of the six authenticated
 * routes put it in their document. A per-frame diagnosis is scoped to the frame
 * that failed, so `/atlas`, `/vacay` and `/settings` would have nothing to compare
 * their fixture dates against — and, before this existed, threw on the attempt
 * inside a `catch` that discarded the reason. Derived from the declaration rather
 * than listed again, so it cannot disagree with `auditServerClock()`.
 */
export const SERVER_CLOCK_ROUTES: ReadonlyArray<RouteCase> = APP_ROUTES.filter(
  (route) => route.relativeTime === true,
)

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
 * and forcing the media feature globally makes `motion` log a warning. That
 * warning is a *real* one — the app's own motion layer talking — so it is not in
 * TOLERATED_CONSOLE_WARNINGS and must not be put there. A reduced-motion
 * baseline is separate work that has to deal with it honestly.
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
 * puts every seeded country in the band a reader sees today, so the baseline
 * looks like the live product rather than a different one.
 *
 * This fixes the clock *in the browser*. It cannot touch a countdown the Worker
 * rendered into the HTML before the browser existed — that is what
 * RELATIVE_TIME_SITES is for, and the two are deliberately separate seams.
 */
export const FROZEN_NOW = '2026-06-15T12:00:00.000Z'

/* -------------------------------------------------------------------------------------------------
 * The clock the server read
 * ---------------------------------------------------------------------------------------------- */

/** One place in the product where a Worker-side `new Date()` reaches pixels. */
export type RelativeTimeSite = {
  /** Named in every failure message, so a stale entry points at its own source. */
  readonly source: string
  /**
   * The element that renders this string, as a selector — the site's scope.
   *
   * Required, and required to be more than one bare tag, because the pattern
   * below keys on *text* and no component owns a word. `span` filtered on
   * `/^(Today|in \d+d)$/` is a document-wide scan: the day any other span on
   * `/dashboard`, `/trips` or `/journey` reads exactly "Today" it would leave the
   * comparison silently, with nothing in the run to say a region had stopped
   * being compared. Scoping each site to the thing that actually prints it keeps
   * the exclusion the size of what it excuses, and `the gate itself` asserts the
   * scope is a real one.
   */
  readonly within: string
  /** The masked element, resolved inside `within`. */
  readonly region: string
  /**
   * Match the pattern against this descendant of the region instead of against
   * the region's own text.
   *
   * The shape of a stat cell whose *label* flips while its value stays a
   * numeral: the label is what the clock decides, the cell is what gets masked.
   */
  readonly keyedOn?: string
  /**
   * Full-string pattern for every output the clock can produce here.
   *
   * Only clock-derived strings are listed. A state the clock has no hand in —
   * "Dates not set", "No dates yet" — is deliberately absent, because excluding
   * it would hide a real data regression behind a determinism fix.
   */
  readonly drifts: RegExp
  /**
   * Every string this site can print, as the pattern's own corpus.
   *
   * Enumerated rather than trusted: the gate asserts the pattern matches all of
   * them, so a copy change that adds a variant is a failing test rather than a
   * region that has quietly stopped being excluded.
   */
  readonly variants: ReadonlyArray<string>
  /** Nearby strings the clock does not decide, which the pattern must not match. */
  readonly fixed: ReadonlyArray<string>
  /**
   * The one string this site is rewritten to before the shutter, so its box is a
   * constant.
   *
   * A mask is only as stable as the element it covers, and the countdown badge's
   * element *is* its text: `ml-auto` pins its right edge and the content sets its
   * width, so "Today" and "in 50d" mask two different rectangles and the
   * difference between them is unmasked page. That sliver sat well inside
   * `maxDiffPixelRatio`, which was the problem rather than the reprieve: it meant
   * the exclusion held on tolerance instead of by construction, and the tolerance
   * is the one budget this file is not allowed to spend.
   *
   * `pinRelativeTime()` therefore writes this value over whatever the clock
   * produced, and the mask then covers it. Two consequences worth being explicit
   * about: the rectangle is identical on every run and every calendar day, and the
   * placeholder never reaches the picture, because the region it is written into
   * is the region the mask paints over.
   *
   * Chosen as the *narrowest* string in `variants`, so the excluded rectangle is
   * the smallest box that can hold this site's output. Over-excluding by a few
   * pixels would cost nothing measurable and is refused anyway, for the same
   * reason a wider tolerance is. The gate asserts it matches `drifts` and is one
   * of `variants`, so it cannot drift out of the corpus it is drawn from.
   */
  readonly pinned: string
}

/**
 * Every string in the product a Worker-side `new Date()` reaches, and the region
 * of the frame excluded from the comparison because of it.
 *
 * The Worker's `today` travels to the client as `payload.today`, and the
 * countdown is therefore already in the SSR HTML: no browser-side clock,
 * `page.clock` included, can change it, and no amount of settling helps, because
 * it is simply a different string tomorrow. Seam 4's header pins which *rows*
 * the Worker selects, not what a locale prints, so these regions stay excluded
 * from the comparison on their own terms — which is what `toHaveScreenshot`'s
 * `mask` does. The tolerance is untouched: `maxDiffPixelRatio` stays at 0.002,
 * because a tolerance wide enough to swallow a day counter is wide enough to
 * swallow a real regression.
 *
 * Three properties are worth being exact about.
 *
 * **The region, not the glyphs — and the region held still.** A mask box is the
 * size of the element it covers, so an element the clock can resize is an
 * exclusion the clock can move. Two of the three sites are safe by their
 * containers: the dashboard hero is masked at its grid cell, whose geometry the
 * four-column track fixes, and the journey reason line is a block element, so its
 * box is the row width whatever it says. The trip-card badge is not — `ml-auto`
 * pins its right edge and its text sets its width, so "Today" and "in 50d" mask
 * two different rectangles. That is what `pinned` and `pinRelativeTime()` are
 * for: every site's string is rewritten to a constant before the shutter, so the
 * excluded rectangle is a constant too, and the mask then covers the placeholder
 * so it never reaches the picture. The 51 → 50 case that failed round 4 is
 * covered twice over by that: same glyphs masked, same box either way.
 *
 * **The scope, not the word.** Every entry names the element that renders it
 * (`within`), and the pattern is only consulted inside that scope. A bare
 * `span` filtered on `/^(Today|in \d+d)$/` reads as tidy and is a document-wide
 * scan: the first time any other span on those three routes says exactly
 * "Today" it leaves the comparison, and a green run is how you find out.
 *
 * **What this covers, and what it does not.** These are *strings* the clock
 * decides. The clock also decides *which rows* the Worker returns, and that is a
 * different frame rather than a different string — no exclusion reaches it. That
 * half of the problem is measured, not masked: see `CALENDAR_SELECTIONS` and the
 * "What this file cannot pin" note at the top of this file. It also decides *how
 * many* of these strings a screen shows at all, which is why a declared route
 * printing none is reported rather than failed — see `auditRelativeTime()`.
 *
 * Introducing these exclusions re-recorded twelve of the fifty-two baselines —
 * `dashboard`, `trips` and `journey`, both themes, both projects — because a
 * mask paints over the region it excludes, so a masked frame is a different
 * picture by construction and not by regression. Pinning re-recorded eight of
 * those twelve again — `dashboard` and `trips`, all four frames each — because the
 * badge's excluded rectangle is now the size of the pinned string rather than the
 * size of whatever the clock said on the day of recording. `journey` did not move
 * for pinning, which is the expected answer: its region is a block element, so its
 * box never depended on the string in the first place. The other baselines that
 * moved in the same commits moved for reasons recorded on `settleOnce()`.
 */
export const RELATIVE_TIME_SITES: ReadonlyArray<RelativeTimeSite> = [
  {
    source: 'src/routes/_app/-ui/trip-card.tsx — the countdown badge',
    // The badge is the last cell of the tile's meta row, and the whole tile is
    // one link, so the tile is the scope. Every trip tile in the product is this
    // component, on both the dashboard and the trip index.
    within: 'a[href^="/trips/"][href$="/plan"]',
    region: 'span',
    drifts: /^(Today|in \d+d)$/,
    variants: ['Today', 'in 1d', 'in 50d'],
    fixed: ['Active', '7d', '17 – 23 Aug 2026'],
    // The badge is the one site whose box really is its string, so this is the
    // entry `pinned` exists for. "Today" is the narrowest of the three and, being
    // the last cell of a `flex-wrap` row, a narrower badge is also the one change
    // that cannot push the row onto a second line.
    pinned: 'Today',
  },
  {
    source: 'src/routes/_app/dashboard.tsx — the hero "starts in" stat',
    // Keyed on the label, which is the part that flips, and masked at the cell,
    // whose width the four-column grid fixes. The other three hero stats are
    // numerals too, and none of them is allowed to lose coverage over this one.
    within: 'main dl',
    region: ':scope > div',
    keyedOn: 'dt',
    drifts: /^(Starts in|Started)$/,
    variants: ['Starts in', 'Started'],
    fixed: ['Travellers', 'Trip dates', 'Places'],
    // The cell's width is the grid's, so pinning the label changes no geometry
    // here. It is pinned anyway: every site being pinned is a property worth
    // being able to state without exceptions, and a label inside a masked cell
    // costs nothing to hold still.
    pinned: 'Started',
  },
  {
    source:
      'src/routes/_app/journey/index.tsx — the unwritten-trip reason line',
    // The reason line is the last block of a backlog row, and a backlog row is
    // the list item that links to the trip waiting to be written up.
    within: 'li:has(a[href^="/trips/"])',
    region: 'span',
    drifts:
      /^(Happening now|Ended yesterday|Ended \d+ days ago|Starts tomorrow|Starts in \d+ days)$/,
    variants: [
      'Happening now',
      'Ended yesterday',
      'Ended 62 days ago',
      'Starts tomorrow',
      'Starts in 50 days',
    ],
    fixed: ['No dates yet', 'Dates not set'],
    // A block element, so its width is the row's and only its *height* could
    // move — on a narrow viewport, by wrapping. The narrowest variant is
    // therefore the safe pin: it can only ever un-wrap a line, never add one.
    pinned: 'Happening now',
  },
]

/**
 * One site's excluded region, built from its scope rather than from a tag scan.
 *
 * Two shapes, and no more: the region's own text carries the drifting string, or
 * a named descendant does and the region is what gets masked around it. See
 * `keyedOn`.
 */
export function relativeTimeRegionOf(
  page: Page,
  site: RelativeTimeSite,
): Locator {
  const region = page.locator(site.within).locator(site.region)
  return site.keyedOn === undefined
    ? region.filter({ hasText: site.drifts })
    : region.filter({
        has: page.locator(site.keyedOn).filter({ hasText: site.drifts }),
      })
}

/**
 * The element that actually *says* the clock-derived string, which is not always
 * the element that gets masked.
 *
 * Same two shapes as `relativeTimeRegionOf()`, read the other way round: without
 * `keyedOn` the region carries the string itself, and with it the string is in a
 * named descendant and the region is the box around it. This is what
 * `pinRelativeTime()` writes to, and the pattern is anchored (`^…$`) so the match
 * is always a leaf whose whole text is the drifting string.
 */
function relativeTimeStringOf(page: Page, site: RelativeTimeSite): Locator {
  const region = page.locator(site.within).locator(site.region)
  return site.keyedOn === undefined
    ? region.filter({ hasText: site.drifts })
    : region.locator(site.keyedOn).filter({ hasText: site.drifts })
}

/**
 * Rewrite every clock-derived string on this route to its site's pinned value,
 * and say how many it rewrote.
 *
 * The step that makes seam 3 hold by construction rather than on tolerance. A
 * mask covers an element's box, and an element sized by its own text has a box
 * the clock decides: "Today" and "in 50d" are two different rectangles, and the
 * difference between them is page that nothing excludes. Writing the pinned value
 * first makes the rectangle a constant, and the mask that follows means the
 * placeholder is never in the picture — it is written into exactly the region the
 * mask paints over.
 *
 * Called after `settle()` and before the shutter, in `shoot()`. That ordering is
 * load-bearing in both directions: React has committed by then, so nothing
 * re-renders the text back, and the write is a plain DOM mutation React never
 * sees. It is deliberately *not* part of `settle()`, because the day-boundary
 * probe settles the same routes in order to read what the clock produced, and a
 * settle that pinned would hand it two identical readings and prove nothing.
 *
 * Returns the count so a spec can assert the write happened rather than trust it;
 * zero is a legitimate answer on a route whose rows the calendar has moved past
 * (see `auditRelativeTime()`).
 */
export async function pinRelativeTime(
  page: Page,
  route: RouteCase,
): Promise<number> {
  if (route.relativeTime !== true) {
    return 0
  }
  let written = 0
  for (const site of RELATIVE_TIME_SITES) {
    written += await relativeTimeStringOf(page, site).evaluateAll(
      (nodes: Array<Element>, pinned: string) => {
        for (const node of nodes) {
          node.textContent = pinned
        }
        return nodes.length
      },
      site.pinned,
    )
  }
  return written
}

/** Every region of this page excluded from the comparison, in table order. */
function relativeTimeRegions(page: Page): Array<Locator> {
  return RELATIVE_TIME_SITES.map((site) => relativeTimeRegionOf(page, site))
}

/**
 * The same regions as one locator, or null when the table is empty.
 *
 * Playwright resolves the mask list before every capture attempt, and each
 * locator in it is a round trip — see `auditRelativeTime()` on how little slack
 * there is before the shutter. `Locator.or()` folds the whole table into a single
 * resolution, so the exclusion costs the frame one round trip rather than one per
 * site, however long the table grows.
 *
 * The null is not defensive noise. Folding an empty table with a destructured
 * first element produced `mask: [undefined]`, which Playwright accepts and which
 * excludes nothing — an emptied table would have silently turned every exclusion
 * off while the gate's own table specs stayed green. Now the mask list is empty
 * instead of malformed, and `the gate itself` asserts the table is not empty, so
 * this branch is reachable only on the way to a failing spec.
 */
function relativeTimeRegion(page: Page): Locator | null {
  const regions = relativeTimeRegions(page)
  const first = regions.at(0)
  if (first === undefined) {
    return null
  }
  return regions.slice(1).reduce((all, one) => all.or(one), first)
}

/** How many clock-derived elements this page is actually showing. */
async function countRelativeTime(page: Page): Promise<number> {
  const counts = await Promise.all(
    relativeTimeRegions(page).map((region) => region.count()),
  )
  return counts.reduce((total, one) => total + one, 0)
}

/**
 * Re-check what this page shows against what the route table declares, and fail
 * only in the direction that can actually cost the comparison something.
 *
 * **Fatal**: a visible clock-derived string on a route that declares none. That
 * string is inside the comparison, it is a different string tomorrow, and the
 * frame will fail on a morning when nothing was designed. It is the failure this
 * whole file exists to prevent, and there is no calendar in which it is
 * acceptable.
 *
 * **Reported**: a route that declares one and shows none. This looks like the
 * mirror image and is not, because the *number of clock-derived strings on a
 * screen is itself decided by the calendar*. `TripTile` prints its badge only
 * within sixty days of a start date, so on the seeded fixture `/trips` prints
 * none from 2026-10-10 — and an earlier version of this function asserted
 * `toBeGreaterThan(0)` here and would have failed four specs that morning, in
 * both themes on both projects, with a message accusing a copy change that had
 * not happened. A run cannot tell that apart from a real copy change by counting
 * elements, so it says what it saw and leaves the verdict to the frames. The
 * claim that the declaration is not stale is made instead by
 * `auditServerClock()`, off the payload, where the calendar cannot reach it.
 *
 * Called *after* the capture, because it is an audit of the route table rather
 * than a precondition of the frame: a finding here should be read next to a
 * frame that was taken, not instead of one.
 */
export async function auditRelativeTime(
  page: Page,
  route: RouteCase,
): Promise<ReadonlyArray<string>> {
  const found = await countRelativeTime(page)
  if (route.relativeTime !== true) {
    expect(
      found,
      `${route.path} prints a clock-derived string but the route table does not declare \`relativeTime: true\` — add it, so the exclusion is audited rather than accidental`,
    ).toBe(0)
    return []
  }
  if (found > 0) {
    return []
  }
  return [
    `${route.path} declares \`relativeTime: true\` and printed no clock-derived string this run, so its exclusion covered nothing and the whole frame was compared`,
    'that is what the fixture calendar does once it moves past the rows that carry a countdown — see CALENDAR_SELECTIONS — and it is reported rather than failed because counting elements cannot tell it apart from a copy change',
    `the declaration itself is still checked against the payload by auditServerClock(), which the calendar cannot move`,
  ]
}

/**
 * Audit the `relativeTime` declarations against the documents the Worker
 * streamed, in both directions, on a fact no calendar can move.
 *
 * The Worker's `today` reaches a screen exactly one way: the loader puts it on
 * the payload, TanStack Start serialises the payload into the document, and the
 * client recomputes every relative string from that field. So `today:"…"` being
 * in the bytes is equivalent to "the wall clock can decide a string here", and it
 * is a property of the loader rather than of the rows — `readonly today: string`
 * is a required field on both DTOs, present whether or not a row uses it.
 *
 * That makes this the half of the old both-directions audit worth keeping fatal.
 * Verified on the seeded workspace at the time of writing: `/dashboard`,
 * `/trips` and `/journey` each carry exactly one `today`, and `/atlas`, `/vacay`
 * and `/settings` carry none — which is precisely the set of declarations.
 *
 * Only the authenticated routes are audited, and deliberately: signed in, `/login`
 * and `/register` answer 302, so a fetch that follows redirects would read the
 * dashboard's document and report the dashboard's clock against the login page's
 * declaration. A public route that starts printing a clock-derived string is
 * still caught, by `auditRelativeTime()`, on the frame itself.
 */
export async function auditServerClock(
  page: Page,
  routes: ReadonlyArray<RouteCase>,
): Promise<void> {
  for (const route of routes) {
    const response = await page.request.get(route.path)
    expect(
      response.status(),
      `${route.path} should not be an error response`,
    ).toBeLessThan(400)
    const carries = [...(await response.text()).matchAll(TODAY_IN_PAYLOAD)]
      .length
    if (route.relativeTime === true) {
      expect(
        carries,
        `${route.path} declares \`relativeTime: true\` but its document no longer carries the Worker's \`today\` — the loader stopped sending it, so the declaration is stale and the exclusion is guarding nothing`,
      ).toBeGreaterThan(0)
      continue
    }
    expect(
      carries,
      `${route.path} carries the Worker's \`today\` in its payload but does not declare \`relativeTime: true\` — anything it prints from that field is inside the comparison and will move at midnight`,
    ).toBe(0)
  }
}

/** What a route renders, split by whether the gate excludes it or not. */
export type RelativeTimeReading = {
  /** Text inside the excluded regions — the part a new day is allowed to change. */
  readonly excluded: string
  /** Every other word on the route — the part a new day must not change. */
  readonly rest: string
}

/**
 * Read the route's text on both sides of the exclusion.
 *
 * This is what the day-boundary probe compares, and it is a stronger claim than
 * two identical screenshots: `excluded` changing proves the clock really moved,
 * and `rest` not changing proves nothing outside an excluded region depends on
 * it. It is also engine-independent, which a pixel comparison here is not — the
 * probe's rewritten payload makes React re-render the tree, entrance animations
 * replay, and `animations: 'disabled'` cannot settle a transform driven from
 * `requestAnimationFrame`, so on WebKit the mobile dashboard alternates between
 * two equally valid frames. Comparing words measures the calendar; comparing
 * those pixels would measure the motion layer.
 *
 * Read over the whole `<body>`, not over `route.ready`. The screenshot is of the
 * document, so the app shell is in it: a clock-derived string in the top nav, the
 * mobile tab bar or a toast would be inside the comparison, unmasked, and a probe
 * scoped to `main` would never look at it. `route.ready` stays what `settle()`
 * waits on and what `auditRelativeTime()` is measured against; it is not a scope
 * for "what a new day is allowed to change", because nothing about being outside
 * `main` makes a string immune to the calendar.
 *
 * `SCRIPT` and its neighbours are skipped, and that exclusion is not tidiness. The
 * loader payload is serialised into a `<script>` in the body, and it literally
 * contains `today:"…"` — the field the probe rewrites — so a walk that read script
 * text would report the probe's own input as a page that moved, on every route,
 * every time. `<style>` and `<template>` go with it as source rather than copy, and
 * the dev toolbar goes because it is tooling: `hideDevChrome()` takes it out of the
 * frame, so it has no business in the words either.
 */
export async function readRelativeTime(
  page: Page,
): Promise<RelativeTimeReading> {
  const regions = relativeTimeRegions(page)
  const handles = (
    await Promise.all(regions.map((region) => region.elementHandles()))
  ).flat()
  try {
    const excluded = (
      await Promise.all(regions.map((region) => region.allInnerTexts()))
    )
      .flat()
      .map((line) => line.trim())
      .join('\n')

    const rest = await page.evaluate(
      ({ sourceTags, toolbar, skipped }) => {
        const skip = new Set<Node>(skipped)
        const source = new Set(sourceTags)
        const words: Array<string> = []
        const walk = (node: Node): void => {
          if (skip.has(node)) {
            return
          }
          if (node instanceof Text) {
            const value = node.data.trim()
            if (value.length > 0) {
              words.push(value)
            }
            return
          }
          if (
            node instanceof Element &&
            (source.has(node.tagName) || node.matches(toolbar))
          ) {
            return
          }
          node.childNodes.forEach(walk)
        }
        walk(document.body)
        return words.join('\n')
      },
      {
        sourceTags: TEXT_IS_NOT_COPY,
        toolbar: DEV_TOOLBAR,
        skipped: handles,
      },
    )
    return { excluded, rest }
  } finally {
    await Promise.all(handles.map((handle) => handle.dispose()))
  }
}

/** A handle on the intercepted server clock, for the day-boundary probe. */
export type ServerTodayShift = {
  /** Move the `today` the next navigation renders from, in whole days. */
  readonly by: (days: number) => void
  /** How many `today` values the last navigation actually moved. */
  readonly moved: () => number
}

/**
 * Move the server's `today` without waiting for midnight.
 *
 * The header in `playwright.config.ts` holds the Worker on one day; this moves the
 * day the *client* recomputes from, which is a different question and needs a
 * different lever. The value the Worker chose is serialised into the streamed
 * document exactly once per route that uses it (`today:"2026-08-20"`), and every
 * relative-time string on the client is recomputed from that field. Rewriting it
 * in flight therefore renders the same rows on a different calendar day —
 * precisely the change that failed round 4, reproduced on demand instead of
 * waited for, and without moving the rows the pin is there to hold still.
 *
 * The rewrite disagrees with the markup the server already streamed, so React
 * reports a hydration mismatch and re-renders the tree from the payload. That is
 * expected, and it is why the probe does not assert the console: what it is
 * asserting is the final frame, and the final frame is the one the moved clock
 * produces.
 */
export async function shiftServerToday(page: Page): Promise<ServerTodayShift> {
  let offset = 0
  let moved = 0

  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.fallback()
      return
    }
    const response = await route.fetch()
    const body = await response.text()
    moved = 0
    const shifted = body.replace(
      /today:"(\d{4})-(\d{2})-(\d{2})"/g,
      (_whole, year: string, month: string, day: string) => {
        moved += 1
        const at = new Date(
          Date.UTC(Number(year), Number(month) - 1, Number(day)),
        )
        at.setUTCDate(at.getUTCDate() + offset)
        return `today:"${at.toISOString().slice(0, 10)}"`
      },
    )
    await route.fulfill({ response, body: shifted })
  })

  return {
    by: (days: number) => {
      offset = days
    },
    moved: () => moved,
  }
}

/* -------------------------------------------------------------------------------------------------
 * The calendar the server selected rows on
 * ---------------------------------------------------------------------------------------------- */

/**
 * The day the baselines in `e2e/__screenshots__` were recorded, as the *server*
 * saw it.
 *
 * Whoever re-records a frame whose rows the Worker chose by date moves this to
 * the day they recorded it, in the same commit — and moves `BASELINE_DAY` in
 * `playwright.config.ts` with it, because that is the value the suite pins the
 * Worker's clock to and the two have to name the same day. It is not decoration:
 * `reportServerCalendar()` compares the Worker's `today` against it to decide
 * whether the row sets in those frames are still the row sets the Worker returns,
 * so a stale value would either hide a real move or invent one, and a pin that
 * stopped arriving shows up here as a crossing rather than as a mystery.
 */
export const BASELINE_DAY = '2026-08-20'

/** How a date column is compared against the server's `today`. */
export type CalendarCompare = 'onOrAfter' | 'onOrBefore' | 'before'

/**
 * The comparison itself, kept as a pure function so the table below is data and
 * the arithmetic is testable without a browser. ISO `YYYY-MM-DD` sorts
 * lexicographically, which is why these are string comparisons and not `Date`
 * maths — no timezone, no DST, no off-by-one at midnight.
 */
export function holdsOn(
  compare: CalendarCompare,
  date: string,
  today: string,
): boolean {
  switch (compare) {
    case 'onOrAfter':
      return date >= today
    case 'onOrBefore':
      return date <= today
    case 'before':
      return date < today
  }
}

/** One comparison the Worker makes between a fixture date and its own clock. */
export type CalendarSelection = {
  /** The repository function and the predicate, so a failure is traceable. */
  readonly source: string
  /** The payload field the predicate reads. */
  readonly field: 'startDate' | 'endDate'
  readonly compare: CalendarCompare
  /** What the screen does differently once the comparison flips. */
  readonly moves: string
}

/**
 * Every place the Worker decides *which rows a screen shows* by comparing a date
 * column against `serverToday()`.
 *
 * Read off the repositories rather than guessed:
 * `listUpcomingTrips` (src/server/repos/trips.ts) keeps a trip while
 * `endDate >= today` and falls back to `startDate >= today` for an undated one;
 * `listPastTrips` takes it once `endDate <= today`;
 * `listUpcomingReservations` (src/server/repos/reservations.ts) keeps a booking
 * while `startDate >= today`; and `listTripsWithoutJourney`
 * (src/server/repos/journey.ts) ranks the journal's backlog into finished
 * (`endDate < today`), under way (`startDate <= today`), still ahead and undated.
 *
 * Both `before` and `onOrBefore` are listed because they flip on different
 * mornings — `endDate < today` turns over the day after `endDate <= today` does —
 * and a table that collapsed them would miss a real move by one day.
 *
 * A date is matched by field name, not by the kind of row it came from. Two key
 * names is all this couples to, which is the point: a table that keyed on the
 * order of fields inside a DTO would quietly find nothing the day somebody
 * reordered one, and an audit that finds nothing passes. The cost is one class of
 * over-report — a reservation's `endDate` is not compared against `today` by any
 * query, but it is tested here — and it is a cost worth paying, because a
 * reservation's end can only be crossed *after* its start, and its start is a
 * genuine boundary that has already fired. The audit can therefore be late, never
 * silent, and late is the harmless direction.
 */
export const CALENDAR_SELECTIONS: ReadonlyArray<CalendarSelection> = [
  {
    source: 'listUpcomingTrips — endDate >= today',
    field: 'endDate',
    compare: 'onOrAfter',
    moves: "the dashboard's hero trip and the trips it lists under it",
  },
  {
    source: 'listPastTrips — endDate <= today',
    field: 'endDate',
    compare: 'onOrBefore',
    // `/atlas` runs this query too and paints nothing from it, so a crossing
    // sighted in the atlas payload is reported and moves no atlas frame. Named
    // for what it moves rather than for where the dates were seen, on purpose:
    // a diagnosis that overstated what it had found would be read once and then
    // ignored.
    moves: "the journal's finished trips",
  },
  {
    source:
      'listTripsWithoutJourney — endDate < today ranks a trip as finished',
    field: 'endDate',
    compare: 'before',
    moves: "the order of the journal's unwritten-trip list",
  },
  {
    source:
      'listUpcomingTrips (undated) and listUpcomingReservations — startDate >= today',
    field: 'startDate',
    compare: 'onOrAfter',
    moves:
      "the dashboard's 'Upcoming reservations' rail and the booking count above it",
  },
  {
    source:
      'listTripsWithoutJourney — startDate <= today ranks a trip as under way',
    field: 'startDate',
    compare: 'onOrBefore',
    moves: "the order of the journal's unwritten-trip list",
  },
]

/** One fixture date, and the route document it was read from. */
export type CalendarSighting = {
  readonly route: string
  readonly field: 'startDate' | 'endDate'
  readonly date: string
}

/** What the server's own documents say about its clock and its fixture. */
export type ServerCalendar = {
  /** Every distinct `today` the Worker stamped into a document this run. */
  readonly todays: ReadonlyArray<string>
  readonly dates: ReadonlyArray<CalendarSighting>
}

const TODAY_IN_PAYLOAD = /"?today"?:"(\d{4}-\d{2}-\d{2})"/g
const FIXTURE_DATE_IN_PAYLOAD = /"?(startDate|endDate)"?:"(\d{4}-\d{2}-\d{2})"/g

/**
 * Read the server's clock and the fixture's dates out of the documents it
 * streams.
 *
 * Over HTTP rather than through a page, because none of this needs a renderer:
 * `page.request` shares the browser context's cookies, so the authenticated
 * documents come back as the signed-in owner, and six fetches cost the run
 * milliseconds instead of six navigations.
 *
 * The loader payload is serialised into the document, so `today:"2026-08-20"` and
 * every `startDate` / `endDate` the screen was given are literally in the bytes.
 * The keys are matched with an optional pair of quotes because the streamed form
 * writes them bare and a plain JSON body would not.
 *
 * The clock and the dates come from two lists rather than one, and that split is
 * the whole reason a single-route diagnosis works at all. Only three of the six
 * authenticated routes stamp a `today`, and carrying a fixture date is a separate
 * question from carrying the clock: `/vacay` and `/settings` carry neither, and
 * `/atlas` has carried dated rows with no clock to compare them against. So
 * reading a crossing off one route means reading its dates from that route and the
 * day from wherever the Worker last stamped one. `clock` is consulted only when
 * `routes` produced no `today` of its own, so the whole-run report still costs
 * exactly one fetch per route.
 */
async function readServerCalendar(
  page: Page,
  routes: ReadonlyArray<RouteCase>,
  clock: ReadonlyArray<RouteCase>,
): Promise<ServerCalendar> {
  const todays = new Set<string>()
  const dates: Array<CalendarSighting> = []

  const documentOf = async (route: RouteCase): Promise<string> => {
    const response = await page.request.get(route.path)
    expect(
      response.status(),
      `${route.path} should not be an error response`,
    ).toBeLessThan(400)
    return response.text()
  }

  for (const route of routes) {
    const body = await documentOf(route)
    for (const found of body.matchAll(TODAY_IN_PAYLOAD)) {
      todays.add(found[1])
    }
    for (const found of body.matchAll(FIXTURE_DATE_IN_PAYLOAD)) {
      const field = found[1] === 'startDate' ? 'startDate' : 'endDate'
      dates.push({ route: route.path, field, date: found[2] })
    }
  }

  if (todays.size === 0) {
    const read = new Set(routes.map((route) => route.path))
    for (const route of clock) {
      if (read.has(route.path)) {
        continue
      }
      for (const found of (await documentOf(route)).matchAll(
        TODAY_IN_PAYLOAD,
      )) {
        todays.add(found[1])
      }
    }
  }

  return { todays: [...todays].sort(), dates }
}

/** A fixture date whose comparison against `today` has flipped since a given day. */
export type CalendarBoundary = {
  readonly selection: CalendarSelection
  readonly date: string
  /** The routes whose payload carried this date. */
  readonly routes: ReadonlyArray<string>
}

/**
 * Which of the Worker's date comparisons answer differently today than they did
 * on `baseline`.
 *
 * Pure, and exact: for every date the fixture actually contains, every rule in
 * `CALENDAR_SELECTIONS` is evaluated on both days and reported only when the two
 * answers disagree. So a run on a day when no fixture date sits between the
 * baseline and today reports nothing at all — the countdowns have moved, and that
 * is the mask's business, not this function's — while the morning a row changes
 * list is reported with the date that moved it.
 */
export function crossedBoundaries(
  calendar: ServerCalendar,
  today: string,
  baseline: string,
): ReadonlyArray<CalendarBoundary> {
  const crossed: Array<CalendarBoundary> = []

  for (const selection of CALENDAR_SELECTIONS) {
    const seen = calendar.dates.filter(
      (sighting) => sighting.field === selection.field,
    )
    const distinct = [...new Set(seen.map((sighting) => sighting.date))].sort()
    for (const date of distinct) {
      if (
        holdsOn(selection.compare, date, baseline) ===
        holdsOn(selection.compare, date, today)
      ) {
        continue
      }
      crossed.push({
        selection,
        date,
        routes: [
          ...new Set(
            seen
              .filter((sighting) => sighting.date === date)
              .map((sighting) => sighting.route),
          ),
        ].sort(),
      })
    }
  }

  return crossed
}

/** What one run of the calendar report found, and the diagnosis it wrote. */
export type ServerCalendarReport = {
  /** The single day every document in this run agreed it was. */
  readonly today: string
  /** Every fixture date the scope carried, so a caller can check it saw one. */
  readonly dates: ReadonlyArray<CalendarSighting>
  readonly crossed: ReadonlyArray<CalendarBoundary>
  /**
   * The diagnosis, ready to attach to a run, and empty when nothing crossed.
   *
   * Lines rather than a formatted block: a Playwright annotation is a string, and
   * a caller that wants one joins them.
   */
  readonly lines: ReadonlyArray<string>
}

/** One crossing as a line a reader can act on without opening this file. */
function describeBoundary(boundary: CalendarBoundary): string {
  return `${boundary.date} has been crossed → ${boundary.selection.source}, which changes ${boundary.selection.moves}; the date is in the payload of ${boundary.routes.join(' and ')}`
}

/**
 * Say whether the fixture has aged past the day its baselines were recorded, and
 * what that moves.
 *
 * This reports; it does not fail. The distinction matters and is the whole shape
 * of this seam.
 *
 * A crossed fixture date does not *cause* a red run — it makes the Worker select
 * different rows, and the frames that photograph those rows then differ on their
 * own. Failing here as well would add a second red test that says the same thing
 * twice and would put the gate's verdict in the hands of the calendar even on the
 * days when nothing the gate photographs actually moved. So the crossing is
 * attached to the run as a diagnosis: when `/dashboard` fails tomorrow, the
 * offending date, the query that reads it and the region it moves are already in
 * the report, and nobody has to crop two pictures to find out why.
 *
 * The two assertions that remain are about this function being able to see a day
 * at all: no server `today` anywhere, or two different ones in one run. Those are
 * faults in the run rather than in the calendar, and a run that cannot read the
 * clock is a run whose diagnosis would be silence.
 *
 * What it deliberately does *not* assert is that the scope carried any fixture
 * date. That used to be here, and it was the bug that made this whole seam
 * unreachable for half the product: a per-frame diagnosis passes a single route,
 * `/settings` and `/vacay` carry no dated row at all, and the assertion fired on
 * a scope that was simply small rather than broken. Worse, the same assertion
 * threw for `/atlas`, `/vacay` and `/settings` before that — none of them stamps a
 * `today` — so the one caller that ran per frame could never report anything and
 * failed silently into a `catch`. "Is the workspace seeded" is a claim about the
 * run, so the run-wide spec makes it, off `dates` in the returned report.
 */
export async function reportServerCalendar(
  page: Page,
  routes: ReadonlyArray<RouteCase>,
  clock: ReadonlyArray<RouteCase> = SERVER_CLOCK_ROUTES,
): Promise<ServerCalendarReport> {
  const calendar = await readServerCalendar(page, routes, clock)

  expect(
    calendar.todays,
    'no document in this run stamped a server `today`, neither the routes under diagnosis nor the ones that carry the clock — so either the payload shape moved or SERVER_CLOCK_ROUTES is wrong',
  ).not.toEqual([])
  expect(
    calendar.todays,
    'the documents in this run disagree about what day it is, so the run straddled midnight — start it again',
  ).toHaveLength(1)

  const [today] = calendar.todays
  const crossed = crossedBoundaries(calendar, today, BASELINE_DAY)
  const lines =
    crossed.length === 0
      ? []
      : [
          `the server's today is ${today}; the baselines in e2e/__screenshots__ were recorded on ${BASELINE_DAY}`,
          ...crossed.map(describeBoundary),
          'a frame that fails below and holds one of these regions is the calendar moving, not a design regression',
        ]
  return { today, dates: calendar.dates, crossed, lines }
}

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
 * unavailable" panel gets photographed instead of waited out.
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
 * Hold the shutter until no map on the page is still drawing, and audit the
 * declaration in both directions.
 *
 * Taken from a census the settling sequence already collected, so the twelve
 * routes with no map pay nothing at all for the wait: the polling assertion is
 * entered only when a marker exists *and* reads `false`. That parsimony is not
 * premature — see the note on `auditRelativeTime()` about how little slack there
 * is before the shutter.
 *
 * `timeout` is a parameter for one reason: the only way to prove this fails
 * loudly rather than photographing an unfinished canvas is to hand it a marker
 * that never latches, which no real screen can be asked to produce, and a spec
 * should not spend MAP_READY_TIMEOUT_MS proving it. Every caller in the capture
 * path uses the default.
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
    `${route.path} mounts a live map but the route table does not declare \`map: true\` — add it, so the frame is captured after the canvas has finished drawing`,
  ).toBe(0)
}

/* -------------------------------------------------------------------------------------------------
 * Settling and capturing
 * ---------------------------------------------------------------------------------------------- */

/**
 * Wait until the frame is worth photographing.
 *
 * Retried, because a route that hydrates into a redirect tears down the execution context underneath
 * an in-flight `page.evaluate` — which surfaced as "Execution context was destroyed" on the atlas
 * route. Re-running the sequence against the new document is the correct response; failing would have
 * reported a navigation as a design defect.
 *
 * The sequence itself is documented on `settleOnce()`. It ends on the frame the
 * product actually shows a reader, which is the only frame in the run that is the
 * same every time.
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
 * docs/DESIGN.md gives entrance motion, which is enough for a staggered list that
 * is still arriving to keep resetting it, and it is many animation frames longer
 * than the reflow it is really there to wait out. `DOM_QUIET_CAP_MS` stops the
 * wait dead if something on the page mutates forever — a dev-server heartbeat, a
 * live clock — so the sequence degrades to "wait two seconds" rather than to a
 * test timeout.
 *
 * Measured on this app at :3003, at the two viewports the suite actually runs:
 * hydration lands 85–256 ms after `domcontentloaded` on Chromium at 1440x900 and
 * 196–427 ms on WebKit at 393x659, and after this quiet period four consecutive
 * full-page captures are byte-identical on both engines. Without it, WebKit's first
 * capture differed from the three that followed it.
 *
 * `DOM_QUIET_FLOOR_MS` is the one thing quiet alone cannot express: a control that
 * mounts on a *timer*, in a document that has nothing else to do while the timer
 * runs. The app's avatar is exactly that — `src/components/layout/kit.tsx` renders
 * Radix's fallback with `delayMs={200}` when a user has an image, so the initials
 * land about 200 ms after mount and nothing mutates in between. A 150 ms quiet
 * window can therefore close at ~150 ms, 50 ms before the initials exist, and the
 * frame is a blank circle instead of "RW". Both frames are inside
 * `maxDiffPixelRatio`, which is why this never turned a run red and why the
 * committed baselines held the blank one: it is a flap the tolerance was paying
 * for. Holding the observer open past the longest timer the product arms means the
 * mutation is seen and quiet restarts after it, so the frame is the same frame
 * every run. 350 ms is that timer plus half of it again, and it stays well under
 * the cap.
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
 * the page, and shared by the capture path and the day-boundary probe so the two
 * cannot disagree about what "hydrated" means.
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
 * cap. Measured on this app in both engines: 2003 ms and 2004 ms, every frame, for
 * a wait whose designed answer is 353 ms. The gate was not photographing unsettled
 * pages — two seconds is longer than the quiet path it was meant to take — but it
 * had no quiet guarantee at all, and it was paying 1.65 s a frame to have none.
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
 * **No baseline moved for this.** Worth stating, because the repair shortens every
 * frame in the suite from ~2000 ms of holding to ~350 ms, and a shorter hold is the
 * shape of change that photographs a page mid-render. All fifty-two frames compared
 * clean against the baselines recorded under the cap, on both projects, in
 * consecutive full runs — which is the evidence that the extra 1.65 s was buying
 * nothing a reader could see, and that what the floor now guarantees is what the
 * cap was accidentally providing.
 *
 * Exported for the same reason `readMapCensus()` is: which of the three timers the
 * wait ends on is invisible in a green run, and it was wrong for every frame in
 * the suite while every frame in the suite passed. `the gate itself` measures this
 * function directly — with the gate's own frozen clock installed — rather than
 * measuring `settle()`, so what it asserts is the wait and not the round trips
 * around it.
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
 * Take the development toolbar out of the frame.
 *
 * `src/routes/__root.tsx` mounts TanStack's devtools behind
 * `import.meta.env.DEV`, and it appears as a 60x60 fixed trigger over the
 * bottom-right of the viewport the moment the tree hydrates. It is tooling, not
 * product: Vite replaces the flag with `false` in the deployed bundle, so no
 * reader ever sees it. Hiding it is what keeps the baseline a picture of the
 * product rather than a picture of the dev server.
 *
 * Hidden by a rule, not by an inline style, and the difference is a defect this
 * round found in the recorded baselines. Writing `display: none` onto the element
 * is a one-shot: it hides whatever exists at that instant, and the trigger has two
 * ways to get past it. It can mount *after* this step — the toolbar is client-only
 * and arrives whenever the dev server gets round to it, which under a full
 * fifty-two-frame run in parallel workers is measurably later than under a
 * three-route one — and its own React render owns its `style` attribute, so a
 * re-render puts back what it had before. Either way the trigger is in the frame.
 * Both were, in the committed baselines: the palm-tree trigger sits over the
 * "Journey" tab in every mobile-safari frame recorded before this change, which is
 * ~3500 differing pixels the next run either reproduced or failed on depending on
 * how loaded the machine was.
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
 * The deterministic capture sequence.
 *
 * Ordered, and the order is the whole point: every step is a thing that would
 * otherwise still be happening while the shutter is open.
 *
 *  1. the route's own content is on screen;
 *  2. webfonts have loaded, so nothing reflows from a fallback face;
 *  3. **React has hydrated the tree** — the step this round added. Before it, the
 *     gate photographed whichever of two documents won a race: the server's
 *     markup, or the client's. They are not the same picture. `/settings` failed
 *     three full-suite runs in six at a 0.01 diff ratio — five times the 0.002
 *     budget — and the diff, reproduced here, is the native `<select>` controls
 *     and the avatar the client renders, landing in some runs and not others. On
 *     `/login` the two documents differ by 109px of document height, because the
 *     passkey affordance can only be resolved in the browser;
 *  4. nothing in the document has mutated for `DOM_QUIET_MS`, and not before
 *     `DOM_QUIET_FLOOR_MS` — which is where a staggered entrance finishes, where a
 *     client-only panel arrives, and where a control the product mounts on a timer
 *     is waited for rather than raced;
 *  5. every `<img>` now in the DOM has decoded — after 3 and 4, so an image the
 *     client added is included rather than missed;
 *  6. the dev toolbar is ruled out of the frame — a stylesheet rule rather than an
 *     inline style, so a trigger that mounts after this step or re-renders over its
 *     own `style` attribute is still hidden;
 *  7. pointer and scroll reset, and only then the map census: the reset is the
 *     last thing that can set a hover feature-state on a map, so reading the
 *     marker after it folds any repaint it caused into the map's own first
 *     `idle` — the marker latches once and cannot report a second settle;
 *  8. the map has finished drawing (`settleMap`);
 *  9. two animation frames, last, so the commit for everything above is on
 *     screen before anything is captured.
 *
 * Steps 3 and 4 moved six of the fifty-two baselines when step 3 was added, and
 * exactly six: `login` in both themes on both projects, where the passkey
 * affordance is client-only, and `settings` in both themes on mobile-safari, where
 * the native controls and the avatar are.
 *
 * Step 4's floor and step 6's rule moved thirty more, and every one of them is a
 * picture of the product finishing something the old sequence photographed it
 * halfway through. The list below is the whole thirty, with nothing left over:
 * attributed by differencing each committed pair and reading the connected
 * components of the difference, rather than by reasoning about what ought to have
 * moved. (The same commit re-recorded the four `atlas-*` frames. Those belong to
 * whoever owns that screen and are not this sequence's doing; the other eighteen
 * of the fifty-two came back byte-identical, which is the evidence that none of
 * this photographs a different design.)
 *
 * - **the theme toggle — nineteen frames, every dark frame that carries a
 *   header.** The twelve dark public ones (`landing`, `pricing`, `register`,
 *   `forgot-password`, `legal/terms`, `legal/privacy`, both projects), the five
 *   dark app frames on Chromium (`dashboard`, `journey`, `trips`, `vacay`,
 *   `settings`), and `trips` and `vacay` in dark on mobile WebKit. One 16–18px
 *   glyph in each: the sun the toggle shows before the client has resolved the
 *   colour scheme, now the moon a reader in dark mode actually sees.
 * - **the account chip — thirteen app frames, on both projects.** This is the
 *   entry an earlier version of this note got wrong: it claimed the avatar moved
 *   "every Chromium app frame", and it moved mobile WebKit too. All ten Chromium
 *   app frames, both themes, where a blank black disc is now the initials "RW"
 *   and the name beside it re-rendered with them; and three mobile ones — `vacay`
 *   in light, where the whole 32px disc moved, and `trips` and `vacay` in dark,
 *   where the initials did. Radix's fallback is given `delayMs={200}` in
 *   `src/components/layout/kit.tsx`, and 200 ms was on the wrong side of a 150 ms
 *   quiet window. It did not move the other five mobile app frames because which
 *   side of that race a recording landed on was luck, and those five had been
 *   recorded on the winning side — which is the failure mode, not an exception to
 *   it.
 * - **`settings` in both themes on Chromium — two frames.** Its six native
 *   `<select>` controls were photographed empty. They now read "Workspace
 *   default — en-GB", "GBP — Pound sterling" and the rest, because the values
 *   arrive after the old quiet window had already closed.
 * - **the dev toolbar's trigger — five mobile frames.** `dashboard` and `journey`
 *   in both themes and `trips` in light carried it, sitting over the "Journey"
 *   tab. On `trips` in light the whole frame differs by 3,927 pixels against a
 *   budget of 1,322 — three times over `maxDiffPixelRatio`, spent on a picture of
 *   the dev server.
 *
 * Eight of the thirty also moved for a reason that is not this sequence's:
 * `dashboard` and `trips`, all four frames each, whose countdown badge is now
 * masked at the size of its pinned string — on `trips` in light on Chromium the
 * excluded rectangle went from 52x20 at +411+718 to 50x20 at +413+718, which is
 * the two pixels of unmasked page that pinning exists to remove. The attribution
 * for that is on RELATIVE_TIME_SITES.
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

/** What `settle()` promises about the frame it hands to the shutter. */
export type CaptureState = {
  /** React has claimed the whole tree, so the frame is the client's, not the server's. */
  readonly hydrated: boolean
  /** The dev toolbar is still on screen, which would put tooling in the baseline. */
  readonly devChromeShown: boolean
}

/**
 * Read back the two conditions `settle()` exists to guarantee.
 *
 * Asserted by a spec rather than trusted, because both failures are silent: a
 * `settle()` that stopped waiting for hydration would photograph whichever
 * document won a race, and a dev toolbar that stopped being hidden would put a
 * 60x60 badge in the corner of every frame. Either would look like a design
 * change on the next run and nothing would say otherwise.
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

/** Which console output fails the run, and which was deliberately let through. */
export type ConsoleReport = {
  readonly fatal: ReadonlyArray<string>
  readonly tolerated: ReadonlyArray<string>
}

export type ConsoleVerdict = 'fatal' | 'tolerated' | 'ignored'

/** One narrowly-scoped exception to "a warning fails the run". */
export type ToleratedConsoleWarning = {
  /** Why this is the browser talking rather than the app. */
  readonly why: string
  readonly match: RegExp
  /** Tolerated only on a route that declares a live map. */
  readonly onlyWithLiveMap: boolean
}

/**
 * The complete list of console warnings the gate does not fail on.
 *
 * docs/SPEC.md §2 asks for zero console errors *or warnings*, and that bar still
 * bites. Everything below stays fatal, on every route, with no exception:
 *
 * - every `pageerror`, which is an uncaught exception;
 * - every `console.error`, MapLibre's and React's included;
 * - every `console.assert`;
 * - every `console.warn` not matched by an entry in this list — which is every
 *   React hydration and key warning, every deprecation notice, every
 *   failed-resource warning, and anything the app writes itself.
 *
 * Message types the gate has never read — `log`, `info`, `debug`, `trace` and
 * the rest — stay ignored, as before.
 *
 * Neither entry is an app warning, and neither can become one: both patterns are
 * anchored at the start of the message, so a warning the app writes itself is
 * fatal even when it quotes one of these word for word. A React hydration report
 * cannot reach this list at all — React 19 surfaces a mismatch as an uncaught
 * error through `window.reportError` and, in development, as a `console.error`,
 * and `classifyConsoleMessage()` answers `fatal` for both before it is ever
 * consulted. A warning-only tolerance is structurally incapable of swallowing one.
 *
 * **The graphics-driver advisory.** Headless Chromium paints WebGL through a
 * software rasteriser, and its GL layer reports — by its own fields, source
 * `OpenGL`, type `Performance`, severity `High` — that reading the drawing buffer
 * back to composite it stalled the GPU. It is a driver advisory about a code path
 * we do not own, it does not exist on hardware, and only a page with a WebGL
 * canvas can produce it, which is why it is scoped to `map: true` routes and stays
 * fatal everywhere else. The per-context pointer in the prefix changes every run,
 * so the pattern is anchored on the shape and never on the handle.
 *
 * **The unused-preload advisory.** The engine's own resource loader, a few seconds
 * after the load event, about a resource the *dev server* handed the parser. It
 * failed `register renders in dark` on mobile WebKit in one full run of four, and
 * what decided which run was how long the page happened to stay open — the
 * emission window is fixed and the app on screen has no part in it. Reproduced
 * verbatim in both engines against this origin: WebKit ends the message "Please
 * make sure it wasn't preloaded for nothing." and Chromium "Please make sure it
 * has an appropriate `as` value and it is preloaded intentionally.", so the
 * pattern stops at the sentence they share.
 *
 * Its scope is the URL, and the URL is what makes the tolerance narrow rather
 * than convenient. The resource has to be served by a development server —
 * `localhost` or a loopback address with a port — under a path only `vite dev`
 * publishes: `/src/…` is the source tree, anything under `/@` is one of the dev
 * server's own namespaces (`/@vite/`, `/@id/`, `/@fs/`, `/@tanstack-start/`,
 * `/@react-refresh`), and `/node_modules/…` is an unbundled dependency. The deployed Worker serves none of them; it serves hashed
 * `/assets/*` instead, and the identical advisory about an `/assets/…` URL — or
 * about any host that is not the loopback — stays fatal, because there it would be
 * a real preload the built application asked for and did not use. Both halves are
 * asserted in `the gate itself`.
 */
export const TOLERATED_CONSOLE_WARNINGS: ReadonlyArray<ToleratedConsoleWarning> =
  [
    {
      why: "headless Chromium's software rasteriser reporting that compositing the WebGL canvas stalled on a pixel readback",
      match:
        /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, /,
      onlyWithLiveMap: true,
    },
    {
      why: "the browser's resource loader reporting that a Vite dev-server URL was speculatively preloaded and not used — a path that exists only under `vite dev`, and a warning whose arrival depends on how long the page stayed open rather than on what the page rendered",
      match:
        /^The resource https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+\/(?:src\/|node_modules\/|@)\S* was preloaded using link preload but not used within a few seconds from the window's load event\./,
      onlyWithLiveMap: false,
    },
  ]

/** Where one console message lands: fails the run, is let through, or is noise. */
export function classifyConsoleMessage(message: {
  readonly type: string
  readonly text: string
  readonly liveMap: boolean
}): ConsoleVerdict {
  if (message.type === 'error' || message.type === 'assert') {
    return 'fatal'
  }
  if (message.type !== 'warning') {
    return 'ignored'
  }
  const tolerated = TOLERATED_CONSOLE_WARNINGS.some(
    (rule) =>
      (rule.onlyWithLiveMap ? message.liveMap : true) &&
      rule.match.test(message.text),
  )
  return tolerated ? 'tolerated' : 'fatal'
}

/**
 * Attach a console listener before navigation and return a getter for what it
 * caught, split by verdict. The quality bar in docs/SPEC.md §2 is zero console
 * errors, so this is an assertion input, not diagnostics.
 *
 * Assert on `fatal` on both sides of the capture, which this round made possible.
 * Playwright's capture options (`caret: 'hide'`, `animations: 'disabled'`) and
 * its mask overlays mutate the page, and while the gate photographed a document
 * React had not hydrated yet, those mutations produced a hydration-mismatch error
 * of the harness's own making — reproduced on `/trips` in both engines, and gone
 * the moment `settle()` started ending on the hydrated frame. So the reading no
 * longer has to stop at the shutter, and it should not: Chromium emits the
 * graphics-driver advisory *during* `toHaveScreenshot`'s captures, which means an
 * assertion that ran only before them was never testing the one warning the
 * classifier exists for.
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
 * system stack. Every frame in the suite is then a picture of the wrong
 * typeface, announced as four console errors rather than as the typographic
 * regression it looks like.
 *
 * Routing those two origins hands the request to Playwright, which issues it
 * outside the page's CORS enforcement and returns it verbatim — the same bytes,
 * from the same CDN, with the preflight no longer in the way. Nothing about the
 * fonts themselves changes, which is the point: the baselines were recorded with
 * the real faces and still match them.
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
  // navigation rather than between settling and the shutter.
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

/**
 * The regions this route's frame excludes, and only for a route that declares
 * one.
 *
 * Resolving a locator is a round trip, and Playwright resolves the mask list
 * before every capture — see `auditRelativeTime()` on how little slack there is
 * before the shutter. The ten routes with no clock-derived copy therefore pay
 * nothing, and are captured exactly as they were before this existed.
 */
function maskFor(page: Page, route: RouteCase): Array<Locator> {
  if (route.relativeTime !== true) {
    return []
  }
  const region = relativeTimeRegion(page)
  return region === null ? [] : [region]
}

/** How a route's frame is captured, and why the two differ. */
export type CaptureMode = 'full-page' | 'viewport-after-resize'

/**
 * Which capture path a route takes.
 *
 * A named decision rather than an inline branch, so the mapping is assertable
 * without recording a baseline for a page that is not the product — a capture
 * path first exercised on the day it is needed is a path nobody has tested, and
 * this one is silent when it is wrong: `fullPage` on a live map does not fail, it
 * times out.
 */
export function captureMode(route: RouteCase): CaptureMode {
  return route.map === true ? 'viewport-after-resize' : 'full-page'
}

/**
 * Grow the viewport to the document, then settle again.
 *
 * The alternative — Chromium's `fullPage` capture — perturbs the viewport to
 * reach below the fold, the page emits `resize`, MapLibre re-sizes its canvas and
 * repaints mid-capture, and because `toHaveScreenshot` needs two consecutive
 * identical captures the assertion times out instead of failing cleanly. Measured
 * on the planner's map screen: `fullPage: true` fired one `resize` per capture and
 * produced three different images, while resizing once and then capturing the
 * viewport produced four identical ones. Same coverage, without the perturbation.
 *
 * **What the re-settle after the resize does, and what it does not.** It re-runs
 * the DOM-level guarantees against the new layout — the `ready` root, fonts,
 * hydration, mutation-quiet, images, the pointer reset, two animation frames — and
 * it re-takes the map census, so a resize that unmounted the canvas fails here
 * rather than in a picture. It does *not* wait for the canvas's repaint, and an
 * earlier version of this comment claimed it did. It cannot: the readiness marker
 * latches once and never returns to `false` (that contract is the whole reason
 * `settleMap()` can be cheap), and MapLibre redrawing its own framebuffer mutates
 * no DOM, so neither `settleMap()` nor `settleMutations()` has anything to observe.
 * The repaint is covered instead by `toHaveScreenshot`'s own stability loop, which
 * will not compare until two consecutive captures are identical — a real guarantee,
 * and the one this path has always actually relied on. A cheaper and more direct
 * signal would be a resize epoch published next to the readiness marker; that
 * belongs to whoever owns `MapCanvas`, not to `e2e/`.
 *
 * Returns whether it resized, which is what a spec can assert without recording a
 * baseline for a page that is not the product.
 */
export async function fitViewportToDocument(
  page: Page,
  route: RouteCase,
): Promise<boolean> {
  const viewport = page.viewportSize()
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  )
  if (viewport === null || height <= viewport.height) {
    return false
  }
  await page.setViewportSize({ width: viewport.width, height })
  await settle(page, route)
  return true
}

/**
 * Baseline comparison, named for the snapshotPathTemplate.
 *
 * Two capture paths, one per `captureMode()`: a page with no live map is
 * photographed full-page, and a page with one is photographed at a viewport
 * grown to the document instead. See `fitViewportToDocument()` for the
 * measurement behind that.
 *
 * Both paths pin the clock-derived strings first. It has to happen here rather
 * than in `settle()` — the day-boundary probe settles these same routes in order
 * to read what the clock produced — and it has to happen before
 * `fitViewportToDocument()`, because pinning is a text change and a text change
 * can be a layout change, so the height that decides the viewport must be measured
 * on the page that is about to be photographed.
 */
export async function shoot(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  const name = `${route.name}-${theme}.png`
  await pinRelativeTime(page, route)
  if (captureMode(route) === 'full-page') {
    await expect(page).toHaveScreenshot(name, {
      fullPage: true,
      mask: maskFor(page, route),
    })
    return
  }
  await fitViewportToDocument(page, route)
  await expect(page).toHaveScreenshot(name, {
    fullPage: false,
    mask: maskFor(page, route),
  })
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
 * database seeded before that fixture existed has to skip these rather than photograph the redirect
 * to `/dashboard` — which is a frame that looks like evidence and is not. And `APP_ROUTES` is
 * documented as the six screens the product's own navigation reaches; the console is reached from
 * the user menu, by an operator who already knows it is there.
 *
 * They are still audited by the same machinery: `frame()` runs `auditRelativeTime()` over them, and
 * the spec runs `auditServerClock()` over the same list, so a console screen that starts printing a
 * clock-derived string is as fatal here as anywhere else.
 *
 * `/console/users` is photographed under an explicit sort, and that is load-bearing rather than
 * decorative. The demo fixture anchors every account's `created_at` to the same instant, so the
 * default `created_at desc` ordering has no tiebreaker and SQLite is free to return the four rows in
 * any order it likes — a baseline recorded under it would hold whatever order that database file
 * happened to produce. `?sort=name&dir=asc` is a total order over the fixture, and it photographs
 * the sort control in its active state as well.
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

export const CONSOLE_ROUTES: ReadonlyArray<RouteCase> = [
  CONSOLE_OVERVIEW_ROUTE,
  CONSOLE_ACCOUNTS_ROUTE,
]

/**
 * The account the `/console/users/$userId` baseline is recorded against.
 *
 * A collaborator rather than the demo owner, and specifically one that has never signed in. The
 * account screen lists live sessions with their start and expiry instants, and those are minted by
 * the wall clock at sign-in — the operator's own account would put two moving timestamps in a
 * committed frame. This one holds none, so the panel shows its designed empty state and the frame is
 * the same every run. It is also the fixture's `curator`, which is what puts the middle rung of the
 * role scale in the picture.
 *
 * **The seed gives this account a password now, so "holds none" is a property somebody can break.**
 * The three collaborators are signable, because a curator who cannot sign in cannot demonstrate that
 * they see the catalogue and not the accounts tab. Signing in as one of them locally leaves a live
 * session, and this frame then carries a session row with two wall-clock instants in it. That is a
 * real diff and not a flake: revoke it from the account's own actions menu — *Revoke every session*
 * — and the frame comes back. The seed cannot do it for you: a session lives in KV as well as D1,
 * and only the product's own path takes down both.
 */
export const CONSOLE_ACCOUNT_NAME = 'Mika Tanaka'

/**
 * True when the signed-in account can actually open the console.
 *
 * Asked over `page.request` rather than by navigating, and that is a repair rather than a
 * preference. The guard is a `beforeLoad` redirect, so the honest question is which response the
 * server gives — and a probe that answered it by *navigating* left the page half way through loading
 * the client entry, which `frame()` then cancelled with its own `goto`. Chromium swallows the
 * aborted module import; WebKit reports it as `pageerror: Importing a module script failed`, and the
 * gate reads a page error as fatal whatever produced it. Every console frame failed on
 * `mobile-safari` and none on `chromium`, which is exactly the shape of a defect that gets blamed on
 * the code under test.
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
 * the name, take the nearest `href` before it - photographed the *previous* row for four rounds of
 * baselines without anyone noticing, because `Avatar` rendered the same name a second time as a
 * screen-reader label a few hundred bytes ahead of the link, and the nearest href before *that* is
 * the row above. The frames looked entirely plausible: a real account screen, for the wrong account,
 * committed under a name that says otherwise. So the anchor's own text is what decides, which is the
 * property the row actually guarantees - the account's name is the link.
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

/** The bar itself. One selector, used by the fixture, the mask and the capture. */
export const IMPERSONATION_BAR = '[aria-label="Impersonated session"]'

/**
 * The live countdown inside it, which is the one thing in that bar a baseline cannot hold.
 *
 * `docs/ACCESS.md` §6.2 gives an impersonated session 900 seconds and §6.1 requires the remaining
 * time on screen as a live figure. The session is minted against the wall clock and the page's clock
 * is frozen at `FROZEN_NOW`, so the two disagree by however far the fixture's day is from the
 * recording day — the figure is neither 15:00 nor stable. It is excluded from the comparison, and
 * nothing else about the bar is.
 */
export const IMPERSONATION_TIMER = `${IMPERSONATION_BAR} [role="timer"]`

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
