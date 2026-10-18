import type { Page } from '@playwright/test'

/**
 * What a journey walks: the screens, and the two knobs a walk turns before it
 * looks at one.
 *
 * A `RouteCase` is a route the suite claims exists, stated as the URL to reach,
 * the selector that proves the route rendered its own content rather than the
 * shell, and whether it draws a live WebGL map. The tables are deliberately
 * exhaustive over what the product's navigation reaches - a screen missing from
 * them is a screen no journey visits.
 */

export type Theme = 'light' | 'dark'

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
   * exercised by `the harness itself` against a document built for them, because the
   * interesting states — a canvas that never latches, a marker on a route that
   * declares nothing — are states no real screen can be asked to enter, and
   * machinery whose first run is the run it is needed on is machinery nobody has
   * tested.
   */
  readonly map?: true
}

/**
 * Routes reachable without a session. These are the ones a journey can always
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
 * numeral, every month grid and the allowance label on that screen change on 1
 * January — the same rot as the countdown, one year apart. It is also the one
 * clock-derived input the product already accepts from the URL
 * (`validateSearch` in `src/routes/_app/vacay.tsx`), so the table pins it there
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
