import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'

/**
 * Screenshot helpers for the visual gate.
 *
 * The gate that `/ultrabuild` runs needs frames that only change when the design
 * changes. Six things otherwise make a baseline flap, and each one has its own
 * seam here so that a regression in one can never be hidden by another:
 *
 * 1. **Paint timing** — fonts, hydration, entrance motion, in-flight images.
 *    `settle()`, which ends on the frame a reader actually sees. Read the note on
 *    `settleOnce()`: the step that waits for React to claim the tree is what
 *    stopped `/settings` failing three runs in six at five times its pixel
 *    budget.
 * 2. **The clock the browser reads** — `FROZEN_NOW`, installed before the first
 *    navigation. This is what the atlas map's recency ramp is computed from.
 * 3. **The clock the server read, as text** — a countdown that says "in 51d" the
 *    evening a baseline is recorded and "in 50d" the next morning.
 *    `RELATIVE_TIME_SITES` excludes those regions from the comparison; the
 *    tolerance is untouched. Each entry is scoped to the component that prints
 *    it, and the declaration behind it is audited off the payload
 *    (`auditServerClock()`) rather than off the screen, because *how many* of
 *    these strings a screen shows is seam 4's business and not this one's.
 * 4. **The calendar the server selected rows on** — the Worker also picks *which
 *    rows* a screen shows by comparing a date column against its own
 *    `new Date()`. `CALENDAR_SELECTIONS` is the table of those comparisons and
 *    `reportServerCalendar()` attaches the offending date, the query that reads it
 *    and the region it moves to the run. Read "What this file cannot pin" below
 *    before touching it.
 * 5. **A live WebGL map** — a canvas that has not finished drawing.
 *    `[data-map-ready]`, waited on inside `settle()`. `/atlas` is the one route
 *    that declares one; the failure modes a real canvas cannot be asked to
 *    perform — never latching at all, or latching on a route that declares
 *    nothing — are exercised by `the gate itself` against a document built for
 *    them.
 * 6. **Graphics-driver chatter** — a performance advisory from the software
 *    rasteriser headless Chromium paints WebGL with, which is not something the
 *    app did. `classifyConsoleMessage()`, and nothing wider than that.
 *
 * ## What this file cannot pin
 *
 * Seams 1, 2, 3, 5 and 6 close completely from inside `e2e/`. Seam 4 does not, and
 * the reason is worth writing down so nobody spends another round rediscovering
 * it.
 *
 * `todayIso()` runs in the Worker (`src/routes/_app/-server/serialise.ts`) and is
 * handed to the repositories, which filter with it: `listUpcomingTrips` keeps a
 * trip while `endDate >= today`, `listPastTrips` takes it once `endDate <= today`,
 * `listUpcomingReservations` reads forward from `today`, and
 * `listTripsWithoutJourney` ranks by whether a trip has finished, started, or is
 * still ahead. When the calendar crosses one of the fixture's dates the Worker
 * therefore returns a *different set of rows*, and the screen renders one card
 * more, one card fewer, or the same cards in a different order. Measured on the
 * seeded workspace as it stands: on 2026-08-21 the reservation dated 2026-08-20
 * leaves the dashboard's rail, on 2026-08-24 the trip that ends on the 23rd stops
 * being "up next" and joins the atlas's finished trips, and after 2026-10-12 the
 * rail is empty for good.
 *
 * No exclusion can absorb that, and the reason is geometry rather than taste. A
 * row entering or leaving a list moves everything below it and changes the height
 * of the document, and `toHaveScreenshot` only compares images of the same size —
 * so a page one row taller fails before any mask, any `threshold` or any
 * `maxDiffPixelRatio` is consulted. Measured on this fixture, by deleting the row
 * the calendar takes next: the dashboard loses 43px of document at 1440x900 and
 * 42px at 393x852, and `/atlas` loses 43px at 393x852 where its single column
 * stacks the rail under the main content — while the same deletion costs the
 * 1440px atlas nothing, because there the rail is the shorter column. That
 * asymmetry is also why round 4 failed on mobile only. And an exclusion large
 * enough to hold a list whose length the calendar decides is an exclusion over the
 * dashboard's hero and its whole right rail: it would buy a green run by deleting
 * the coverage the gate exists for, which is the same trade as widening
 * `maxDiffPixelRatio` and is refused for the same reason.
 *
 * A browser-side clock cannot reach it either. `page.clock.setFixedTime` patches
 * `Date` in the page; the rows were chosen in the Worker before the document
 * existed, and rewriting `today` in that document (see `shiftServerToday`) changes
 * the *strings* the client recomputes and not the *rows* the server sent.
 *
 * The two mechanisms that do close seam 4 both live outside this file: pin the
 * Worker's clock for a dev request, or move the seeded windows away from the
 * server's today so no fixture date sits next to it. Until one of them lands,
 * `reportServerCalendar()` is the honest half of the job — the run says "the
 * fixture crossed 2026-08-23 and the rows moved" instead of showing two pictures
 * and letting a reader guess.
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
   * `/atlas` is the first and so far only route that carries one. Both halves of
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
 * `page.clock.setFixedTime` patches `Date` only — `setTimeout`,
 * `requestAnimationFrame` and `performance.now()` keep running, so MapLibre's
 * render loop and React's scheduler are untouched. `clock.install()` would fake
 * all of those and has to be ticked by hand, and a map would never finish
 * drawing.
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
}

/**
 * Every string in the product a Worker-side `new Date()` reaches, and the region
 * of the frame excluded from the comparison because of it.
 *
 * `todayIso()` in `src/routes/_app/-server/serialise.ts` is a plain `new Date()`,
 * and its value travels to the client as `payload.today`. The countdown is
 * therefore already in the SSR HTML: no browser-side clock, `page.clock`
 * included, can change it, and no amount of settling helps, because it is simply
 * a different string tomorrow. The only honest answer available from inside
 * `e2e/` is to exclude those regions from the comparison, which is what
 * `toHaveScreenshot`'s `mask` does. The tolerance is untouched:
 * `maxDiffPixelRatio` stays at 0.002, because a tolerance wide enough to swallow
 * a day counter is wide enough to swallow a real regression.
 *
 * Three properties are worth being exact about.
 *
 * **The region, not the glyphs.** A mask box is the size of the element it
 * covers, so masking a numeral alone would still move when the numeral changed
 * width. The dashboard hero is masked at its grid cell, whose geometry the
 * four-column track fixes — label flip, digit count and all. The trip-card badge
 * and the journey reason line are masked at the element: the badge is stable for
 * any value of the same rendered width, which is the "in 51d" → "in 50d" case
 * that failed round 4, and the reason line is a block element, so its box is the
 * row width whatever it says.
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
 * picture by construction and not by regression. The other six baselines that
 * moved in the same commit moved for an unrelated reason, recorded on
 * `settleOnce()`.
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
 * `todayIso()` reaches a screen exactly one way: the loader puts it on the
 * payload, TanStack Start serialises the payload into the document, and the
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
 */
export async function readRelativeTime(
  page: Page,
  route: RouteCase,
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
      ({ selector, skipped }) => {
        const root = document.querySelector(selector)
        if (root === null) {
          return ''
        }
        const skip = new Set<Node>(skipped)
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
          node.childNodes.forEach(walk)
        }
        walk(root)
        return words.join('\n')
      },
      { selector: route.ready, skipped: handles },
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
 * The Worker's `todayIso()` cannot be reached from a test, but the value it
 * produced is serialised into the streamed document exactly once per route that
 * uses it (`today:"2026-08-20"`), and every relative-time string on the client is
 * recomputed from that field. Rewriting it in flight therefore renders the same
 * data on a different calendar day — precisely the change that failed round 4,
 * reproduced on demand instead of waited for.
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
 * the day they recorded it, in the same commit. It is not decoration:
 * `reportServerCalendar()` compares the Worker's `today` against it to decide
 * whether the row sets in those frames are still the row sets the Worker returns,
 * and a stale value would either hide a real move or invent one.
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
 * column against `todayIso()`.
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
    moves: "the atlas 'Recent trips' panel and the journal's finished trips",
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
type CalendarSighting = {
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
 */
async function readServerCalendar(
  page: Page,
  routes: ReadonlyArray<RouteCase>,
): Promise<ServerCalendar> {
  const todays = new Set<string>()
  const dates: Array<CalendarSighting> = []

  for (const route of routes) {
    const response = await page.request.get(route.path)
    expect(
      response.status(),
      `${route.path} should not be an error response`,
    ).toBeLessThan(400)
    const body = await response.text()

    for (const found of body.matchAll(TODAY_IN_PAYLOAD)) {
      todays.add(found[1])
    }
    for (const found of body.matchAll(FIXTURE_DATE_IN_PAYLOAD)) {
      const field = found[1] === 'startDate' ? 'startDate' : 'endDate'
      dates.push({ route: route.path, field, date: found[2] })
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
 * The three assertions that remain are about this function being able to see
 * anything at all — no server `today`, no fixture dates, or two different days in
 * one run. Those are faults in the run, not in the calendar, and a run that
 * cannot read the payload is a run whose diagnosis would be silence.
 */
export async function reportServerCalendar(
  page: Page,
  routes: ReadonlyArray<RouteCase>,
): Promise<ReadonlyArray<string>> {
  const calendar = await readServerCalendar(page, routes)

  expect(
    calendar.todays,
    'no route stamped a server `today` into its document — the report would be reading nothing, so either the payload shape moved or the routes list is wrong',
  ).not.toEqual([])
  expect(
    calendar.todays,
    'the documents in this run disagree about what day it is, so the run straddled midnight — start it again',
  ).toHaveLength(1)
  expect(
    calendar.dates,
    'no route carried a fixture date, so nothing here is being checked — seed the demo workspace before running the gate',
  ).not.toEqual([])

  const [today] = calendar.todays
  const crossed = crossedBoundaries(calendar, today, BASELINE_DAY)
  if (crossed.length === 0) {
    return []
  }
  return [
    `the server's today is ${today}; the baselines in e2e/__screenshots__ were recorded on ${BASELINE_DAY}`,
    ...crossed.map(describeBoundary),
    'a frame that fails below and holds one of these regions is the calendar moving, not a design regression',
  ]
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
 * Measured on this app at :3003: hydration lands 85–256 ms after
 * `domcontentloaded` on Chromium at 1440x900 and 196–427 ms on WebKit at 393x852,
 * and after this quiet period four consecutive full-page captures are
 * byte-identical on both engines. Without it, WebKit's first capture differed from
 * the three that followed it.
 */
const DOM_QUIET_MS = 150
const DOM_QUIET_CAP_MS = 2_000

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

/** Hold until nothing in the document has mutated for `DOM_QUIET_MS`. */
async function settleMutations(page: Page): Promise<void> {
  await page.evaluate(
    ({ quietMs, capMs }) =>
      new Promise<void>((resolve) => {
        let quiet = 0
        const observer = new MutationObserver(() => restart())
        const stop = (): void => {
          observer.disconnect()
          window.clearTimeout(quiet)
          resolve()
        }
        const restart = (): void => {
          window.clearTimeout(quiet)
          quiet = window.setTimeout(stop, quietMs)
        }
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        })
        window.setTimeout(stop, capMs)
        restart()
      }),
    { quietMs: DOM_QUIET_MS, capMs: DOM_QUIET_CAP_MS },
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
 * Hidden by writing `display: none` on the element itself rather than by adding
 * a stylesheet: the trigger is `position: fixed` inside a zero-height wrapper, so
 * this moves no layout, and touching an existing node avoids appending one React
 * would have to reconcile around.
 */
async function hideDevChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    const toolbar = document.querySelector('[data-testid="tanstack_devtools"]')
    if (toolbar instanceof HTMLElement) {
      toolbar.style.display = 'none'
    }
  })
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
 *  4. nothing in the document has mutated for `DOM_QUIET_MS`, which is where a
 *     staggered entrance finishes and where a client-only panel arrives;
 *  5. every `<img>` now in the DOM has decoded — after 3 and 4, so an image the
 *     client added is included rather than missed;
 *  6. the dev toolbar is out of the frame;
 *  7. pointer and scroll reset, and only then the map census: the reset is the
 *     last thing that can set a hover feature-state on a map, so reading the
 *     marker after it folds any repaint it caused into the map's own first
 *     `idle` — the marker latches once and cannot report a second settle;
 *  8. the map has finished drawing (`settleMap`);
 *  9. two animation frames, last, so the commit for everything above is on
 *     screen before anything is captured.
 *
 * Steps 3 and 4 moved six of the fifty-two baselines, and exactly six: `login`
 * in both themes on both projects, where the passkey affordance is client-only,
 * and `settings` in both themes on mobile-safari, where the native controls and
 * the avatar are. Twelve more baselines were re-recorded in the same commit and
 * not by these steps — `dashboard`, `trips` and `journey`, which changed because
 * the relative-time exclusion started painting over the regions it excludes; the
 * attribution is on RELATIVE_TIME_SITES. The remaining thirty-four came back
 * byte-identical, which is the evidence that neither change photographs a
 * different design — one stopped photographing it early, the other covered part
 * of it up.
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
  const devChromeShown = await page.evaluate(() => {
    const toolbar = document.querySelector('[data-testid="tanstack_devtools"]')
    return (
      toolbar instanceof HTMLElement &&
      getComputedStyle(toolbar).display !== 'none'
    )
  })
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
 * The one entry is not an app warning at all. Headless Chromium paints WebGL
 * through a software rasteriser, and its GL layer reports — by its own fields,
 * source `OpenGL`, type `Performance`, severity `High` — that reading the
 * drawing buffer back to composite it stalled the GPU. It is a driver advisory
 * about a code path we do not own, it does not exist on hardware, and only a
 * page with a WebGL canvas can produce it, which is why it is scoped to
 * `map: true` routes and stays fatal everywhere else. The per-context pointer in
 * the prefix changes every run, so the pattern is anchored on the shape and
 * never on the handle; anchoring it at the start is what keeps an app warning
 * that merely quotes the advisory fatal.
 */
export const TOLERATED_CONSOLE_WARNINGS: ReadonlyArray<ToleratedConsoleWarning> =
  [
    {
      why: "headless Chromium's software rasteriser reporting that compositing the WebGL canvas stalled on a pixel readback",
      match:
        /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, /,
      onlyWithLiveMap: true,
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
export async function visit(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
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
  // The resize is a layout change like any other, so the page settles again —
  // which is also where the map's post-resize repaint is waited out.
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
 */
export async function shoot(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  const name = `${route.name}-${theme}.png`
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
