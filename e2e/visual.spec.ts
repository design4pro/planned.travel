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
  classifyConsoleMessage,
  crossedBoundaries,
  hasSession,
  holdsOn,
  readCaptureState,
  readRelativeTime,
  reportServerCalendar,
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
 * else, so four unrelated sources of drift are handled separately and checked
 * separately: when the shutter opens relative to hydration, the clock the browser
 * reads, the clock the server read, and a live map's first idle frame. See
 * `e2e/helpers/shoot.ts`.
 */

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
  // After the shutter: see auditRelativeTime().
  await auditRelativeTime(page, route)
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

    for (const route of drifting) {
      const yesterday = await readOn(route, -1)
      const dayBefore = await readOn(route, -2)

      expect(
        dayBefore.excluded,
        `${route.path}: moving the server clock changed nothing inside an excluded region, so this route's exclusion is untested`,
      ).not.toBe(yesterday.excluded)
      expect(
        dayBefore.rest,
        `${route.path}: a string outside every excluded region changed with the calendar — add its site to RELATIVE_TIME_SITES`,
      ).toBe(yesterday.rest)
    }
  })
})

/**
 * The gate's own tables.
 *
 * All of these are pure — no browser, no server — and they cover the three lists
 * that decide what the gate excludes, tolerates and watches for. A mistake in any
 * of them is invisible in a green run, which is the only reason they are asserted
 * rather than reviewed.
 */
test.describe('the gate itself', () => {
  test('every relative-time pattern matches its own corpus', () => {
    for (const site of RELATIVE_TIME_SITES) {
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
    const gl = (handle: string, suffix = ''): string =>
      `[.WebGL-${handle}]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels${suffix}`

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
        what: 'a failed assertion',
        type: 'assert',
        text: 'Assertion failed: expected a tenant scope',
        liveMap: true,
        verdict: 'fatal',
      },
      {
        what: 'the graphics-driver advisory on a map route',
        type: 'warning',
        text: gl('0x13400534c00'),
        liveMap: true,
        verdict: 'tolerated',
      },
      {
        what: 'the same advisory with a different per-run handle and suffix',
        type: 'warning',
        text: gl('0x104004ff000', ' (this message will no longer repeat)'),
        liveMap: true,
        verdict: 'tolerated',
      },
      {
        what: 'the advisory on a route that declares no map',
        type: 'warning',
        text: gl('0x13400534c00'),
        liveMap: false,
        verdict: 'fatal',
      },
      {
        what: 'an app warning that merely quotes the advisory',
        type: 'warning',
        text: `MapLibre lost its context. ${gl('0x13400534c00')}`,
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
