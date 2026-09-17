import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { DEV_TOOLBAR } from './routes'
import type { RouteCase } from './routes'

/**
 * Turning "the response arrived" into "the route rendered its own content".
 *
 * Three of the five seams the harness holds still live here: the clock the
 * browser reads, the live WebGL map, and paint timing itself - fonts, hydration,
 * entrance motion, in-flight images. The step that waits for React to claim the
 * tree is also what keeps the console reading honest: a journey's assertions run
 * against a hydration mismatch that has already happened, not one still in
 * flight.
 */

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

/**
 * How long a route that mounts a live map gets for React to claim its tree.
 *
 * Every other route hydrates inside Playwright's flat `actionTimeout` (10 s in
 * `playwright.config.ts`). `/atlas` did not, on the 2-vCPU CI runner: MAP-05
 * failed there with the page rendered and the hydration wait out of time
 * (issue #477, run 34760110795). The extra budget is named on every route that
 * declares `map: true`, not only `/atlas`, rather than absorbed by a suite-wide
 * raise, which would hide a slow-hydration regression on every other screen —
 * the argument `ATLAS_JOURNEY_TIMEOUT_MS` makes in `journeys.spec.ts`.
 *
 * A ceiling, not an expectation: a page that hydrates waits for none of it.
 */
const MAP_HYDRATION_TIMEOUT_MS = 20_000

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
 * Whether a failure reads as the page having navigated out from under the
 * sequence, rather than as the sequence having found something wrong.
 *
 * `settle()` decides whether to retry by matching the failure's *text*, which is
 * the only evidence Playwright gives it. Exported because `settleOnce()` appends
 * a hydration diagnostic to that same text: the two are one contract, and a test
 * that restated this pattern instead of calling it would go green on exactly the
 * change that breaks them apart.
 */
export function readsAsTransient(message: string): boolean {
  return /Execution context was destroyed|navigation/i.test(message)
}

/**
 * The same patterns, removed from text that is about to be appended to a failure.
 *
 * A diagnostic that names a node from `navigation.tsx` — or a class called
 * `navigation-rail` — would otherwise satisfy `readsAsTransient()` on its own and
 * turn a hard timeout into a silent retry, spending the shard's budget three
 * times over to reach the same failure. The replacement is a character rather
 * than nothing on purpose: dropping the match outright could splice two
 * neighbouring fragments into a fresh one.
 */
export function scrubbedOfRetryTriggers(detail: string): string {
  return detail.replace(/navigation|Execution context was destroyed/gi, '…')
}

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
        error instanceof Error && readsAsTransient(error.message)
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
 * answer was "always the cap" (see `settleMutations()`). `the harness itself` asserts
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
 * What `hydratedIn` was looking at, for the one case where it stayed `false`
 * until the wait ran out.
 *
 * `page.waitForFunction` can only report that a predicate never went truthy, so
 * a hydration timeout says nothing about *why*. Run 35101667571 left three of
 * them and no way to choose between the two explanations: a tree React had not
 * finished claiming, or one whose last element in document order is not React's
 * to claim at all. The traces could not settle it either — every successful wait
 * in them finished under 4.7 s and every failed one sat exactly on the 10 s
 * ceiling, which is the shape of both. This names the node instead.
 *
 * Deliberately *not* folded into `hydratedIn`. That predicate is shared with
 * `readCaptureState()` so the two cannot disagree about what "hydrated" means,
 * and `CaptureState.hydrated` is a boolean a spec asserts on; this runs only
 * once the wait has already failed, and changes nothing about the answer.
 */
function describeHydration(selector: string): string {
  const claimed = (node: Element): boolean =>
    Object.keys(node).some((key) => key.startsWith('__reactFiber$'))
  const root = document.querySelector(selector)
  if (root === null) {
    return `nothing matches ${selector}`
  }
  if (!claimed(root)) {
    return `${selector} itself carries no fiber, so React never reached it`
  }
  const nodes = Array.from(root.querySelectorAll('*'))
  const unclaimed = nodes.filter((node) => !claimed(node))
  const name = (node: Element): string =>
    `${node.tagName.toLowerCase()}${node.id === '' ? '' : `#${node.id}`}` +
    `${node.getAttribute('data-tsd-source') === null ? '' : ` from ${node.getAttribute('data-tsd-source')}`}`
  // Guarded on the length rather than on the element being `undefined`, which is
  // what an index past the end really gives back: `noUncheckedIndexedAccess` is
  // off, so the type says `Element` and a comparison against `undefined` reads as
  // dead code. This is the same shape `hydratedIn` uses on the same list.
  if (nodes.length === 0) {
    return `${selector} is claimed and holds no elements`
  }
  const last = nodes[nodes.length - 1]
  return (
    `${nodes.length} elements under ${selector}, ${unclaimed.length} without a fiber; ` +
    `last in document order is ${name(last)}, which is ` +
    `${claimed(last) ? 'claimed' : 'the one the wait is still waiting for'}`
  )
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
 * the suite while every route in the suite passed. `the harness itself` measures this
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
  try {
    await page.waitForFunction(hydratedIn, route.ready, {
      timeout: route.map === true ? MAP_HYDRATION_TIMEOUT_MS : undefined,
    })
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    // The diagnostic can never be what fails the step. If the context is gone
    // the timeout is still the finding, and it is rethrown as it arrived.
    const detail = await page
      .evaluate(describeHydration, route.ready)
      .catch(() => 'the page could not be read once the wait had failed')
    // `settle()` chooses whether to retry by matching this message, so a node
    // named after `navigation.tsx` — or a class called `navigation-rail` —
    // would quietly turn a hard timeout into a retry. Scrubbed, not trusted.
    error.message = `${error.message}\nhydration: ${scrubbedOfRetryTriggers(detail)}`
    throw error
  }
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
