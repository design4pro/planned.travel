import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  APP_ROUTES,
  BASELINE_DAY,
  CALENDAR_SELECTIONS,
  DEMO_EMAIL,
  PUBLIC_ROUTES,
  RELATIVE_TIME_SITES,
  THEMES,
  auditRelativeTime,
  auditServerClock,
  captureMode,
  classifyConsoleMessage,
  crossedBoundaries,
  fitViewportToDocument,
  hasSession,
  holdsOn,
  readCaptureState,
  readMapCensus,
  readRelativeTime,
  relativeTimeRegionOf,
  reportServerCalendar,
  settle,
  settleMap,
  shiftServerToday,
  shoot,
  useSession,
  visit,
  watchConsole,
} from './helpers/shoot.ts'
import type {
  ConsoleVerdict,
  RouteCase,
  ServerCalendar,
  Theme,
} from './helpers/shoot.ts'

/**
 * The visual gate.
 *
 * Two Playwright projects (desktop Chromium at 1440x900 and mobile WebKit at
 * 393x852) times two themes is the mechanical half of the quality bar in
 * docs/SPEC.md §2: it catches regressions against an approved baseline. Judging
 * whether the design is *good* is the pixel-critic sub-agent's job, not this
 * file's — these tests only hold the line once a frame has been approved.
 *
 * A baseline is only worth holding if it fails for design reasons and nothing
 * else, so five unrelated sources of drift are handled separately and checked
 * separately: when the shutter opens relative to hydration, the clock the browser
 * reads, the clock the server read, a live map's first idle frame, and the
 * graphics-driver chatter a WebGL capture provokes. A sixth — *which rows* the
 * server's calendar selected — cannot be closed from here and is reported instead
 * of masked. See `e2e/helpers/shoot.ts`.
 */

/**
 * Compare the frame, and when it differs, say whether the calendar moved the rows
 * in it before anyone starts cropping two pictures.
 *
 * The diagnosis is best-effort by construction: it runs only on a failure, it
 * cannot replace the failure it explains, and anything that goes wrong while
 * fetching it is discarded rather than reported instead of the real error. See
 * `reportServerCalendar()`.
 */
async function shootWithCalendarDiagnosis(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  try {
    await shoot(page, route, theme)
  } catch (failure) {
    const crossings = await reportServerCalendar(page, [route]).catch(() => [])
    if (crossings.length > 0) {
      test.info().annotations.push({
        type: 'fixture calendar crossed',
        description: crossings.join('\n'),
      })
    }
    throw failure
  }
}

/**
 * One route, one theme: settle it, insist the console is clean, compare pixels.
 *
 * The console is read twice, once on each side of the shutter, and both readings
 * are the same assertion. Before, so a page that threw during hydration fails with
 * the exception rather than with a picture of the wreckage; after, because
 * Chromium emits its graphics-driver advisory *while* `toHaveScreenshot` captures,
 * so a reading that stopped at the shutter never covered the one warning
 * `classifyConsoleMessage()` exists to classify. Both readings share one array, so
 * the second is a superset of the first.
 *
 * Everything the run can only *report* — a tolerated warning, an exclusion that
 * covered nothing — is attached to the test rather than dropped. A filter nobody
 * can see in a green run is a filter that starts swallowing real defects.
 */
async function frame(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  const watched = watchConsole(page, route)
  await visit(page, route, theme)
  expect(
    watched().fatal,
    `${route.path}: the console must be clean by the time the frame is settled`,
  ).toEqual([])
  await shootWithCalendarDiagnosis(page, route, theme)
  const output = watched()
  expect(
    output.fatal,
    `${route.path}: the console must be clean, including while the frame is captured`,
  ).toEqual([])
  if (output.tolerated.length > 0) {
    // Surfaced, not swallowed: a tolerance that starts hiding real defects has
    // to be readable in the run.
    test.info().annotations.push({
      type: 'tolerated console output',
      description: output.tolerated.join('\n'),
    })
  }
  // After the shutter, and reporting rather than failing when what it found is
  // the calendar's doing: see auditRelativeTime().
  const drift = await auditRelativeTime(page, route)
  if (drift.length > 0) {
    test.info().annotations.push({
      type: 'relative-time exclusion covered nothing',
      description: drift.join('\n'),
    })
  }
}

test.describe('public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    for (const theme of THEMES) {
      test(`${route.name} renders in ${theme}`, async ({ page }) => {
        await frame(page, route, theme)
      })
    }
  }

  /**
   * What `settle()` promises the shutter, checked rather than assumed.
   *
   * Both halves are otherwise silent. A `settle()` that stopped waiting for
   * hydration would photograph whichever document won a race — the failure this
   * round fixed, worth five times `/settings`'s pixel budget in three runs of six
   * — and a dev toolbar that stopped being hidden would sit in the corner of every
   * frame. Either would read as a design change on the next run.
   *
   * `/login` is the route this is asserted on because it is the one where the two
   * documents differ most: the passkey affordance is a client-only fact
   * (`PasskeyDivider` in src/routes/(auth)/login.tsx resolves
   * `window.PublicKeyCredential` in an effect), so the server's markup does not
   * contain it and the reader's does.
   */
  test('the captured frame is hydrated and carries no dev tooling', async ({
    page,
  }) => {
    const route = PUBLIC_ROUTES.find((candidate) => candidate.name === 'login')
    expect(route, 'the login route is what this asserts against').toBeDefined()
    if (route === undefined) {
      return
    }
    await visit(page, route, 'light')
    const state = await readCaptureState(page, route)
    expect(
      state.hydrated,
      'settle() must end on the hydrated frame, or the gate photographs a race',
    ).toBe(true)
    expect(
      state.devChromeShown,
      'the dev toolbar must be out of the frame, or every baseline carries tooling',
    ).toBe(false)
  })
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

  /**
   * The row sets, before any pixel is compared.
   *
   * Every frame below is a photograph of rows the Worker chose by comparing a
   * fixture date against its own clock, and when the calendar crosses one of those
   * dates the rows move: one card more, one card fewer, or the same cards in a
   * different order. No mask can absorb that — at 393px the page is a single
   * column, so the document gets taller and `toHaveScreenshot` refuses two images
   * of different sizes before it looks at any tolerance.
   *
   * This test says which date moved and what it moves, and then passes. It is a
   * diagnosis attached to the run, not a verdict on it: the frames that hold those
   * rows fail on their own if they moved, and a second red test that repeats the
   * reason would only put the gate's verdict in the calendar's hands on days when
   * nothing the gate photographs changed at all. See `reportServerCalendar()` and
   * the note at the top of `e2e/helpers/shoot.ts` for why the repair is not
   * available from `e2e/`.
   */
  test('the fixture calendar is reported against the baseline day', async ({
    page,
  }) => {
    const crossings = await reportServerCalendar(page, APP_ROUTES)
    if (crossings.length > 0) {
      test.info().annotations.push({
        type: 'fixture calendar crossed',
        description: crossings.join('\n'),
      })
    }
  })

  /**
   * The route table's `relativeTime` claim, against the documents the Worker
   * streamed — the half of that audit the calendar cannot move.
   *
   * Whether a countdown is *visible* is the calendar's decision: `TripTile`
   * prints its badge only inside sixty days of a start date, so once the
   * fixture's last upcoming trip has started, `/trips` shows none. Whether the
   * Worker *sent* its clock is not: `today` is a required field on the payload.
   * So this is where a stale declaration is caught, and `auditRelativeTime()` is
   * free to report the empty screen instead of failing four specs over it.
   */
  test('every route that carries the server clock declares it', async ({
    page,
  }) => {
    await auditServerClock(page, APP_ROUTES)
  })

  for (const route of APP_ROUTES) {
    for (const theme of THEMES) {
      test(`${route.name} renders in ${theme}`, async ({ page }) => {
        await frame(page, route, theme)
      })
    }
  }

  /**
   * The day boundary, without waiting for one.
   *
   * Round 4 was failed by two dashboard frames whose only difference was a
   * countdown badge reading "in 51d" the evening the baseline was recorded and
   * "in 50d" the next morning. This is the regression test for it. The server's
   * `today` is rewritten in flight, one day at a time, and each route is read
   * twice: what the excluded regions say has to change, or the probe moved
   * nothing and proves nothing, and every other word on the route has to stay
   * exactly as it was, or something outside an excluded region is counting days.
   *
   * Two shifted days rather than shifted-versus-real, because rewriting `today`
   * makes React re-render from the payload, and a re-rendered page is not the
   * same page as one hydrated in place. Comparing two shifted days keeps the only
   * variable the one under test.
   *
   * Words rather than pixels: see `readRelativeTime()`. Comparing the frames here
   * would measure the motion layer replaying its entrance animations, not the
   * calendar — while the claim about pixels is the mask's to make, and the mask
   * is what the baselines above already exercise.
   *
   * The two halves are asserted differently on purpose. "Nothing outside an
   * excluded region moved" holds for every route on every day and is asserted for
   * every route. "Something inside an excluded region moved" can only be asserted
   * of a route that is currently *showing* one, and how many it shows is decided
   * by which rows the Worker selected — so a route showing none is reported and
   * skipped, and the run instead insists that at least one route proved it. That
   * is the difference between a probe that fails when the exclusions rot and one
   * that fails when the fixture ages.
   */
  test('a day boundary changes nothing outside an excluded region', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const drifting = APP_ROUTES.filter((route) => route.relativeTime === true)
    expect(
      drifting.length,
      'no route declares relativeTime — the day-boundary probe would prove nothing',
    ).toBeGreaterThan(0)

    const shift = await shiftServerToday(page)

    const readOn = async (route: RouteCase, days: number) => {
      shift.by(days)
      // A blank document between the two visits: navigating to the same URL
      // twice in a row races the router's own navigation and Playwright reports
      // it as an interrupted `goto`.
      await page.goto('about:blank')
      await visit(page, route, 'light')
      expect(
        shift.moved(),
        `${route.path} declares relativeTime but its document carries no server \`today\` to move — the probe would be reading the same page twice`,
      ).toBeGreaterThan(0)
      // No extra hydration wait: `visit()` ends on the hydrated, settled frame,
      // which is exactly the text the client recomputed from the rewritten
      // payload. See `settleOnce()`.
      return readRelativeTime(page, route)
    }

    let proven = 0
    for (const route of drifting) {
      const yesterday = await readOn(route, -1)
      const dayBefore = await readOn(route, -2)

      // Asserted for every route, on both days, whatever the calendar has done
      // to the rows: the payload's `today` moved, so any word outside an excluded
      // region that moved with it is a site missing from the table.
      expect(
        dayBefore.rest,
        `${route.path}: a string outside every excluded region changed with the calendar — add its site to RELATIVE_TIME_SITES`,
      ).toBe(yesterday.rest)

      if (yesterday.excluded === '' && dayBefore.excluded === '') {
        // Reported, not failed, and for the same reason `auditRelativeTime()`
        // reports it: whether a countdown is on screen at all is decided by
        // which rows the Worker selected. From 2026-10-10 the seeded fixture
        // prints none on `/trips`, and a probe that insisted otherwise would go
        // red that morning for the calendar rather than for the exclusions.
        test.info().annotations.push({
          type: 'relative-time exclusion covered nothing',
          description: `${route.path} printed no clock-derived string on either probed day, so only the "nothing else moved" half of the probe ran for it`,
        })
        continue
      }
      expect(
        dayBefore.excluded,
        `${route.path}: moving the server clock changed nothing inside an excluded region, so this route's exclusion is untested`,
      ).not.toBe(yesterday.excluded)
      proven += 1
    }

    expect(
      proven,
      'no route printed a clock-derived string on either probed day, so nothing here exercised an exclusion — the fixture has drifted past every countdown it had, and the masks are now untested',
    ).toBeGreaterThan(0)
  })

  /**
   * October, without waiting for October.
   *
   * `TripTile` renders its badge only for a start date inside the next sixty days,
   * and it computes that from `payload.today` on the client — so pushing the
   * server's `today` past the fixture's last start date removes every countdown
   * from `/trips` while leaving every row exactly where it was. That is precisely
   * the state the seeded workspace reaches on 2026-10-10, and the state a previous
   * version of this gate failed four specs on, in both themes on both projects,
   * with a message accusing a copy change nobody had made.
   *
   * The assertion is that the run now *says* what it saw and passes: the audit
   * reports, the frame is still compared in full, and the verdict stays with the
   * pixels. The declaration itself is not left unchecked — `auditServerClock()`
   * makes that claim off the payload, where the calendar cannot reach it.
   */
  test('a countdown the calendar has removed is reported, not failed', async ({
    page,
  }) => {
    const route = APP_ROUTES.find((candidate) => candidate.name === 'trips')
    expect(
      route,
      'the trip index is the route that ages out first',
    ).toBeDefined()
    if (route === undefined) {
      return
    }

    const shift = await shiftServerToday(page)
    // Past the last start date the fixture holds, so no tile is inside its
    // sixty-day window and the badge is not rendered at all.
    shift.by(60)
    await visit(page, route, 'light')
    expect(
      shift.moved(),
      `${route.path} carries no server \`today\` to move, so this proves nothing`,
    ).toBeGreaterThan(0)

    const drift = await auditRelativeTime(page, route)
    expect(
      drift.length,
      `${route.path} still printed a clock-derived string sixty days on, so this is not the state the audit is being tested against`,
    ).toBeGreaterThan(0)
    expect(
      drift.join('\n'),
      'the report has to name what moved the rows, or a reader is left cropping screenshots again',
    ).toContain('CALENDAR_SELECTIONS')
  })
})

/**
 * The message a helper failed with, or null when it did not fail.
 *
 * Several of the gate's own mechanisms exist in order to *fail* — a map that
 * never finishes drawing, a route table that disagrees with the page — and a spec
 * proving one of them fails loudly has to catch that failure rather than throw
 * it. Returning the message keeps the assertion about the message, which is the
 * part a reader of a red run actually needs to be right.
 */
async function failureOf(work: Promise<unknown>): Promise<string | null> {
  try {
    await work
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** Route cases for the documents below, which are not the product. */
const SYNTHETIC_MAP: RouteCase = {
  name: 'gate-map',
  path: '/gate/declares-a-map',
  ready: 'main',
  map: true,
}
const SYNTHETIC_PLAIN: RouteCase = {
  name: 'gate-plain',
  path: '/gate/declares-nothing',
  ready: 'main',
}
const SYNTHETIC_CLOCK: RouteCase = {
  name: 'gate-clock',
  path: '/gate/declares-a-clock',
  ready: 'main',
  relativeTime: true,
}

/**
 * A document with the two things `settle()` looks for and nothing else: a visible
 * `ready` root, and whatever markers the case under test needs.
 *
 * Built rather than borrowed because the states worth asserting are states no real
 * screen can be asked to enter: a canvas that never latches, a marker on a route
 * that declares nothing, a route that declares one and renders none. `/atlas`
 * covers the happy path on every run; these cover the failures, which are the
 * half that has to be loud.
 *
 * React's claim on the tree is stamped by hand. `settle()` waits for the
 * `__reactFiber$…` key React writes onto each host node as it hydrates it, and a
 * page React never rendered carries none; the stamp is the one part of a real page
 * this cannot borrow, so it is the fiber key itself rather than a stand-in for it.
 */
async function syntheticPage(
  page: Page,
  body: string,
  options: { readonly latchAfterMs?: number } = {},
): Promise<void> {
  // A whole document, not a fragment: without a doctype the engine renders in
  // quirks mode, and without the viewport meta mobile WebKit lays the page out at
  // 980px and scales it, which makes a 120px document report as 2125px tall and
  // the resize path fire on a page that already fits.
  await page.setContent(
    `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0"><main style="min-width:120px;min-height:120px">${body}</main></body></html>`,
  )
  await page.evaluate((latchAfterMs) => {
    document.querySelectorAll('main, main *').forEach((node) => {
      Object.assign(node, { __reactFiber$gate: {} })
    })
    if (latchAfterMs === undefined) {
      return
    }
    window.setTimeout(() => {
      document.querySelectorAll('[data-map-ready]').forEach((marker) => {
        marker.setAttribute('data-map-ready', 'true')
      })
    }, latchAfterMs)
  }, options.latchAfterMs)
}

/** A sized stand-in for a WebGL canvas, in whichever readiness state is wanted. */
function mapMarker(ready: boolean, height = 120): string {
  return `<div data-map-ready="${ready ? 'true' : 'false'}" style="width:120px;height:${height}px"></div>`
}

/**
 * The graphics-driver advisory, verbatim, with its per-context handle.
 *
 * Headless Chromium's software rasteriser writes this while compositing a WebGL
 * canvas, and the pointer in the prefix is different every run — which is exactly
 * why the tolerance is anchored on the shape and never on the handle.
 */
function glAdvisory(handle: string, suffix = ''): string {
  return `[.WebGL-${handle}]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels${suffix}`
}

/**
 * The gate's own tables and its own mechanics.
 *
 * The table specs are pure — no browser, no server — and cover the lists that
 * decide what the gate excludes, tolerates and watches for. The rest drive the
 * capture path itself against a document built for the purpose. A mistake in any
 * of them is invisible in a green run, which is the only reason they are asserted
 * rather than reviewed.
 */
test.describe('the gate itself', () => {
  test('every relative-time pattern matches its own corpus', () => {
    expect(
      RELATIVE_TIME_SITES.length,
      'an empty table folds to an empty mask: every exclusion would silently stop excluding anything, in a run that stayed green',
    ).toBeGreaterThan(0)

    for (const site of RELATIVE_TIME_SITES) {
      expect(
        site.within,
        `${site.source}: a scope of one bare tag is a document-wide text scan, which excludes any element that happens to say the same words`,
      ).toMatch(/[\s>[.#:]/)
      expect(
        site.region.length,
        `${site.source}: name the element that gets masked, or the mask covers the scope`,
      ).toBeGreaterThan(0)
      expect(
        site.variants.length,
        `${site.source}: list the strings this site can print, or its pattern is untested`,
      ).toBeGreaterThan(0)
      for (const variant of site.variants) {
        expect(
          variant,
          `${site.source}: a clock-derived string the pattern does not match is a region that has stopped being excluded`,
        ).toMatch(site.drifts)
      }
      for (const fixed of site.fixed) {
        expect(
          fixed,
          `${site.source}: this string is not the clock's doing and must stay inside the comparison`,
        ).not.toMatch(site.drifts)
      }
    }
  })

  test('the console classifier keeps app problems fatal', () => {
    const cases: ReadonlyArray<{
      readonly what: string
      readonly type: string
      readonly text: string
      readonly liveMap: boolean
      readonly verdict: ConsoleVerdict
    }> = [
      {
        what: 'an uncaught console error',
        type: 'error',
        text: 'Uncaught TypeError: t is not a function',
        liveMap: true,
        verdict: 'fatal',
      },
      {
        what: 'a React key warning',
        type: 'warning',
        text: 'Each child in a list should have a unique "key" prop.',
        liveMap: true,
        verdict: 'fatal',
      },
      {
        // The defect this repo has actually shipped: workerd rendered the en-GB
        // abbreviated month as "Sept" where WebKit rendered "Sep", and every
        // September date on a server-rendered page threw this on /atlas.
        what: 'a React hydration error on a map route',
        type: 'error',
        text: "Hydration failed because the server rendered text didn't match the client.",
        liveMap: true,
        verdict: 'fatal',
      },
      {
        what: 'the hydration recovery warning that follows it',
        type: 'warning',
        text: 'There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.',
        liveMap: true,
        verdict: 'fatal',
      },
      {
        what: 'a failed assertion',
        type: 'assert',
        text: 'Assertion failed: expected a tenant scope',
        liveMap: true,
        verdict: 'fatal',
      },
      {
        what: 'the graphics-driver advisory on a map route',
        type: 'warning',
        text: glAdvisory('0x13400534c00'),
        liveMap: true,
        verdict: 'tolerated',
      },
      {
        what: 'the same advisory with a different per-run handle and suffix',
        type: 'warning',
        text: glAdvisory(
          '0x104004ff000',
          ' (this message will no longer repeat)',
        ),
        liveMap: true,
        verdict: 'tolerated',
      },
      {
        what: 'the advisory on a route that declares no map',
        type: 'warning',
        text: glAdvisory('0x13400534c00'),
        liveMap: false,
        verdict: 'fatal',
      },
      {
        what: 'an app warning that merely quotes the advisory',
        type: 'warning',
        text: `MapLibre lost its context. ${glAdvisory('0x13400534c00')}`,
        liveMap: true,
        verdict: 'fatal',
      },
      {
        what: 'ordinary logging',
        type: 'log',
        text: 'hydrated',
        liveMap: false,
        verdict: 'ignored',
      },
      {
        what: 'informational output',
        type: 'info',
        text: 'Download the React DevTools',
        liveMap: false,
        verdict: 'ignored',
      },
    ]

    for (const entry of cases) {
      expect(
        classifyConsoleMessage({
          type: entry.type,
          text: entry.text,
          liveMap: entry.liveMap,
        }),
        entry.what,
      ).toBe(entry.verdict)
    }
  })

  /**
   * The classifier is wired to the page, not just correct in isolation.
   *
   * Three separate seams meet in `watchConsole()`: the `console` listener, the
   * `pageerror` listener, and the `liveMap` flag it takes off the route table. A
   * classifier that graded perfectly while the listener dropped the message, or
   * while `liveMap` was read from the wrong place, would produce a permanently
   * green console assertion — which is the one assertion in this suite whose
   * failure mode is silence.
   */
  test("the console watcher splits the advisory from the app's own mistakes", async ({
    page,
  }) => {
    const watched = watchConsole(page, SYNTHETIC_MAP)
    await syntheticPage(page, '<p>A page with a console.</p>')

    await page.evaluate((advisory) => {
      console.warn(advisory)
      console.error(
        "Hydration failed because the server rendered text didn't match the client.",
      )
      window.setTimeout(() => {
        throw new Error('a component threw after paint')
      }, 0)
    }, glAdvisory('0x13400534c00'))

    await expect
      .poll(() => watched().fatal.length, {
        message: 'both app problems have to reach the report',
      })
      .toBe(2)

    const report = watched()
    expect(
      report.tolerated.join('\n'),
      'the driver advisory is the browser talking about a code path we do not own',
    ).toContain('GPU stall due to ReadPixels')
    expect(
      report.fatal.join('\n'),
      'a hydration error is the defect this repo has actually shipped, and it stays fatal',
    ).toContain('Hydration failed')
    expect(
      report.fatal.join('\n'),
      'an uncaught exception after paint reaches the run through pageerror, not through console',
    ).toContain('a component threw after paint')
  })

  test('a date comparison flips on the right morning and not the one before', () => {
    // `endDate <= today` turns over on the date itself; `endDate < today` waits
    // for the morning after. Collapsing the two would let a row change list a day
    // before the audit noticed.
    expect(holdsOn('onOrBefore', '2026-08-23', '2026-08-22')).toBe(false)
    expect(holdsOn('onOrBefore', '2026-08-23', '2026-08-23')).toBe(true)
    expect(holdsOn('before', '2026-08-23', '2026-08-23')).toBe(false)
    expect(holdsOn('before', '2026-08-23', '2026-08-24')).toBe(true)
    expect(holdsOn('onOrAfter', '2026-08-23', '2026-08-23')).toBe(true)
    expect(holdsOn('onOrAfter', '2026-08-23', '2026-08-24')).toBe(false)
  })

  test('a crossed fixture date is reported and an untouched one is not', () => {
    // The seeded fixture as it actually stands: a trip ending on the 23rd, the
    // next starting on the 21st, a finished trip from June and a booked one in
    // October. Every one of these is a date the Worker compares against its own
    // clock, which is why these frames cannot simply be left alone.
    const calendar: ServerCalendar = {
      todays: ['2026-08-20'],
      dates: [
        { route: '/dashboard', field: 'endDate', date: '2026-08-23' },
        { route: '/trips', field: 'endDate', date: '2026-08-23' },
        { route: '/trips', field: 'startDate', date: '2026-08-21' },
        { route: '/atlas', field: 'endDate', date: '2026-06-20' },
        { route: '/dashboard', field: 'startDate', date: '2026-10-09' },
      ],
    }

    expect(
      crossedBoundaries(calendar, '2026-08-20', BASELINE_DAY),
      'the day the baselines were recorded cannot have moved anything',
    ).toEqual([])

    const distant: ServerCalendar = {
      todays: ['2026-08-20'],
      dates: [
        { route: '/dashboard', field: 'startDate', date: '2026-10-09' },
        { route: '/dashboard', field: 'endDate', date: '2026-10-20' },
      ],
    }
    expect(
      crossedBoundaries(distant, '2026-08-22', BASELINE_DAY),
      'a fixture whose dates are nowhere near today must stay quiet, or the audit cries wolf and gets ignored',
    ).toEqual([])

    // The 21st: the trip starting that morning stops being "still ahead" in the
    // journal's ranking and any reservation dated the 20th drops out of the
    // dashboard rail.
    const started = crossedBoundaries(calendar, '2026-08-21', BASELINE_DAY)
    expect(
      [...new Set(started.map((boundary) => boundary.date))],
      'a start date passing moves the journal ranking, so it has to be reported',
    ).toEqual(['2026-08-21'])
    expect(
      started.map((boundary) => boundary.selection.compare),
      'only the comparison that actually flipped may be reported',
    ).toEqual(['onOrBefore'])
    expect(started[0]?.routes).toEqual(['/trips'])

    // The 24th: the trip that ended on the 23rd leaves the upcoming selection and
    // joins the past one. This is round 4's failure, reproduced as arithmetic.
    const ended = crossedBoundaries(calendar, '2026-08-24', BASELINE_DAY)
    expect(
      [...new Set(ended.map((boundary) => boundary.date))].sort(),
      'the fixture date that moves a trip from upcoming to past has to be reported',
    ).toEqual(['2026-08-21', '2026-08-23'])
    expect(
      ended
        .filter((boundary) => boundary.date === '2026-08-23')
        .map((boundary) => boundary.selection.compare)
        .sort(),
      'a trip changing list trips three separate predicates, and each one names a different region',
    ).toEqual(['before', 'onOrAfter', 'onOrBefore'])
    expect(
      ended.find((boundary) => boundary.date === '2026-08-23')?.routes,
      'the routes carrying the date are named, so a reader knows which frames moved',
    ).toEqual(['/dashboard', '/trips'])
  })

  /**
   * The readiness wait, on a canvas that latches late.
   *
   * The latch is deliberately past `DOM_QUIET_CAP_MS`, so the census is taken
   * while the marker still reads `false` and the readiness wait is what ends the
   * settle. With a shorter latch the mutation-quiet step would have absorbed it
   * and this would have passed without the wait ever being entered — which is
   * exactly how a dead seam looks green.
   */
  test('a live map holds the shutter until it has finished drawing', async ({
    page,
  }) => {
    const LATCH_MS = 2_400
    const started = Date.now()
    await syntheticPage(page, mapMarker(false), { latchAfterMs: LATCH_MS })

    await settle(page, SYNTHETIC_MAP)

    expect(
      Date.now() - started,
      'settle() returned before the canvas latched, so the shutter is not waiting on the map at all',
    ).toBeGreaterThanOrEqual(LATCH_MS)
    expect(
      await readMapCensus(page),
      'the frame must be taken on a map that has finished drawing',
    ).toEqual({ total: 1, unsettled: 0 })
  })

  test('a map that never finishes drawing fails rather than being photographed', async ({
    page,
  }) => {
    await syntheticPage(page, mapMarker(false))
    const census = await readMapCensus(page)
    expect(census, 'the census is what the wait is entered on').toEqual({
      total: 1,
      unsettled: 1,
    })

    // A second rather than MAP_READY_TIMEOUT_MS: the assertion under test is the
    // message, not the patience.
    expect(
      await failureOf(settleMap(page, SYNTHETIC_MAP, census, 1_000)),
      'an unsettled canvas must fail loudly, or the baseline is a picture of a half-drawn map',
    ).toContain('has not finished drawing')
  })

  test('the map declaration is audited in both directions', async ({
    page,
  }) => {
    await syntheticPage(page, '<p>Not a map</p>')
    expect(
      await failureOf(settle(page, SYNTHETIC_MAP)),
      'a route that claims a map and renders none has a stale declaration, and the wait it asked for is dead code',
    ).toContain('rendered no [data-map-ready] marker')

    await syntheticPage(page, mapMarker(true))
    expect(
      await failureOf(settle(page, SYNTHETIC_PLAIN)),
      'an undeclared map is a frame captured before the canvas settled, and the GL advisory it emits is fatal on that route',
    ).toContain('does not declare `map: true`')
  })

  /**
   * The other half of what `map: true` changes: how the frame is taken.
   *
   * `fullPage` on a live map perturbs the viewport, MapLibre repaints mid-capture
   * and `toHaveScreenshot` times out instead of failing — so a map route is
   * photographed at a viewport grown to the document instead. Asserted on the
   * resize itself rather than on a baseline, because a baseline for a page that is
   * not the product is a baseline nobody should keep.
   */
  test('a map route is captured at a viewport grown to the document', async ({
    page,
  }) => {
    expect(captureMode(SYNTHETIC_PLAIN)).toBe('full-page')
    expect(captureMode(SYNTHETIC_MAP)).toBe('viewport-after-resize')

    // A page that fits is left alone: a resize is a `resize` event, and a
    // `resize` event is a repaint the shutter would then have to wait out again.
    await syntheticPage(page, mapMarker(true))
    expect(
      await fitViewportToDocument(page, SYNTHETIC_MAP),
      'a document shorter than the viewport must not be resized at all',
    ).toBe(false)

    const TALL_PX = 2_600
    await syntheticPage(page, mapMarker(true, TALL_PX))
    expect(
      await fitViewportToDocument(page, SYNTHETIC_MAP),
      'a document taller than the viewport must be fitted, or the capture misses everything below the fold',
    ).toBe(true)
    expect(
      page.viewportSize()?.height ?? 0,
      'the viewport must reach the foot of the document',
    ).toBeGreaterThanOrEqual(TALL_PX)
  })

  /**
   * The exclusion audit, in the two directions it actually has.
   *
   * Fatal one way: a countdown nothing excludes is inside the comparison and is a
   * different string tomorrow. Reported the other way: whether a countdown is on
   * screen at all is decided by which rows the Worker selected, so a declared
   * route showing none is the fixture ageing, not the copy moving. An earlier
   * version failed here, and would have turned `/trips` red in both themes on both
   * projects from 2026-10-10 with a message accusing a copy change nobody made.
   */
  test('a clock-derived string is fatal off-table and reported when the calendar hides it', async ({
    page,
  }) => {
    // The countdown badge as the product renders it: inside the link that covers
    // the trip tile.
    await syntheticPage(page, '<a href="/trips/x/plan"><span>in 51d</span></a>')
    expect(
      await failureOf(auditRelativeTime(page, SYNTHETIC_PLAIN)),
      'an unexcluded countdown is the whole failure this gate exists to prevent',
    ).toContain('does not declare `relativeTime: true`')
    expect(
      await auditRelativeTime(page, SYNTHETIC_CLOCK),
      'a declared route showing its countdown has nothing to report',
    ).toEqual([])

    await syntheticPage(
      page,
      '<p>No string here is the wall clock&rsquo;s.</p>',
    )
    expect(
      await auditRelativeTime(page, SYNTHETIC_PLAIN),
      'a route with no clock-derived string and no declaration is simply correct',
    ).toEqual([])
    const reported = await auditRelativeTime(page, SYNTHETIC_CLOCK)
    expect(
      reported.length,
      'a declared route with nothing to exclude has to be reported, not failed: the fixture decides how many countdowns a screen shows',
    ).toBeGreaterThan(0)
    expect(
      reported.join('\n'),
      'the report has to name the thing that moves the rows, or it is a riddle',
    ).toContain('CALENDAR_SELECTIONS')
  })

  test('an exclusion covers the component that prints it and not the word', async ({
    page,
  }) => {
    await syntheticPage(page, '<span>Today</span>')
    expect(
      await auditRelativeTime(page, SYNTHETIC_PLAIN),
      'a span that merely says "Today" is not a countdown, and excluding it would delete coverage nobody asked to lose',
    ).toEqual([])

    await syntheticPage(
      page,
      '<span>Today</span><a href="/trips/x/plan"><span>Today</span></a>',
    )
    const badge = RELATIVE_TIME_SITES.find((site) =>
      site.source.includes('trip-card'),
    )
    expect(
      badge,
      'the trip-card countdown is the site under test',
    ).toBeDefined()
    if (badge === undefined) {
      return
    }
    expect(
      await relativeTimeRegionOf(page, badge).count(),
      'only the badge inside a trip tile is excluded; the identical word outside one stays in the comparison',
    ).toBe(1)
  })

  test('every calendar selection names a source and what it moves', () => {
    expect(
      CALENDAR_SELECTIONS.length,
      'an empty table would make the audit vacuously green',
    ).toBeGreaterThan(0)
    for (const selection of CALENDAR_SELECTIONS) {
      expect(
        selection.source,
        'a selection with no source cannot be traced back to the query that reads it',
      ).toMatch(/^list[A-Za-z]+/)
      expect(
        selection.moves.length,
        `${selection.source}: say what moves, or a failure tells a reader nothing`,
      ).toBeGreaterThan(0)
    }
  })
})
