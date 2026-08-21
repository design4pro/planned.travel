import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  APP_ROUTES,
  BASELINE_DAY,
  CALENDAR_SELECTIONS,
  DEMO_EMAIL,
  DEV_TOOLBAR,
  DOM_QUIET_CAP_MS,
  DOM_QUIET_FLOOR_MS,
  DOM_QUIET_MS,
  FROZEN_NOW,
  PUBLIC_ROUTES,
  RELATIVE_TIME_SITES,
  SERVER_CLOCK_ROUTES,
  THEMES,
  auditRelativeTime,
  auditServerClock,
  captureMode,
  classifyConsoleMessage,
  crossedBoundaries,
  fitViewportToDocument,
  hasSession,
  holdsOn,
  pinRelativeTime,
  readCaptureState,
  readMapCensus,
  readRelativeTime,
  relativeTimeRegionOf,
  reportServerCalendar,
  settle,
  settleMap,
  settleMutations,
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
 * 393x659, the iPhone 15 descriptor's viewport rather than its 393x852 screen)
 * times two themes is the mechanical half of the quality bar in
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
 * The diagnosis runs only on a failure and never replaces the failure it explains,
 * so the original error is always what the run reports. What it no longer does is
 * throw away the reason it could not be read: an earlier version discarded every
 * error from `reportServerCalendar()`, and what it was silently discarding was that
 * function asserting a server `today` on a route that carries none — so the
 * per-frame diagnosis was dead for `/atlas`, `/vacay` and `/settings`, in a suite
 * that stayed green because the only symptom was a missing annotation.
 * `reportServerCalendar()` now reads the clock from `SERVER_CLOCK_ROUTES` when the
 * frame's own route has none, and anything that still goes wrong is attached under
 * its own heading instead of vanishing.
 */
async function shootWithCalendarDiagnosis(
  page: Page,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  try {
    await shoot(page, route, theme)
  } catch (failure) {
    const annotation = await reportServerCalendar(page, [route]).then(
      (report) =>
        report.lines.length === 0
          ? null
          : {
              type: 'fixture calendar crossed',
              description: report.lines.join('\n'),
            },
      (error: unknown) => ({
        type: 'fixture calendar unreadable',
        description: [
          `the calendar diagnosis for ${route.path} could not be read, so this frame failed without one:`,
          error instanceof Error ? error.message : String(error),
        ].join('\n'),
      }),
    )
    if (annotation !== null) {
      test.info().annotations.push(annotation)
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
    const report = await reportServerCalendar(page, APP_ROUTES)
    // The one thing this spec does assert, because it is a claim about the run
    // rather than about the calendar: the workspace has dated rows to compare at
    // all. A per-frame diagnosis cannot make it — `/settings` and `/vacay` carry
    // no dated row by design — so it is made once, here, where "none anywhere"
    // really does mean an unseeded database.
    expect(
      report.dates,
      'no authenticated route carried a fixture date, so nothing here is being checked — run `node scripts/seed/seed.mjs` before the gate',
    ).not.toEqual([])
    if (report.lines.length > 0) {
      test.info().annotations.push({
        type: 'fixture calendar crossed',
        description: report.lines.join('\n'),
      })
    }
  })

  /**
   * The per-frame diagnosis, on the routes that used to make it throw.
   *
   * Three of the six authenticated screens stamp no server `today` at all —
   * `/atlas`, which has shipped dated rows without a clock to compare them
   * against, and `/vacay` and `/settings`, which ship neither.
   * `shootWithCalendarDiagnosis()` scopes the report to the single route whose
   * frame failed, so every one of them used to hit
   * `reportServerCalendar()`'s "no route stamped a server `today`" assertion — and
   * the `catch` around it threw the reason away. The diagnosis was therefore dead
   * for exactly the frames CALENDAR_SELECTIONS says a crossed `endDate` moves, in a
   * suite that could not go red over it.
   *
   * So it is asserted directly, route by route: the report resolves, it agrees with
   * the run about what day it is, and no route is excused for being small.
   */
  test('every route can be diagnosed on its own, clock or no clock', async ({
    page,
  }) => {
    const run = await reportServerCalendar(page, APP_ROUTES)
    for (const route of APP_ROUTES) {
      const report = await reportServerCalendar(page, [route])
      expect(
        report.today,
        `${route.path} could not be diagnosed on its own — a frame that fails on this route would report no calendar at all`,
      ).toBe(run.today)
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
   * The two surfaces the atlas map answers with, which no baseline can hold.
   *
   * A screenshot is a picture of a page at rest, and both of these exist only
   * while somebody is pointing at the map: a hover card that is gone the moment
   * the pointer leaves, and a panel that opens on a press. Recording either as a
   * frame would mean recording a synthetic pointer position into a baseline and
   * then defending it against every future change of camera — so what is held
   * here is behaviour and geometry instead. The resting frame above is unchanged
   * by design: with nothing hovered and nothing selected, the overlay draws no
   * DOM at all, and the four atlas baselines are byte-identical to the ones
   * recorded before it existed.
   *
   * The country is chosen through the search field rather than by hunting for
   * pixels. That is the one route to a country that works identically on a
   * desktop pointer and on a phone, it frames the country in the middle of
   * whatever map the chrome has left free — which is what makes the hover probe
   * below deterministic — and it is itself one of the three non-pointer routes
   * that keep the map's surfaces from ever being the only way to reach a fact.
   */
  const ATLAS = APP_ROUTES.find((candidate) => candidate.name === 'atlas')

  /** Chooses a country by name, the way a reader with no mouse would. */
  async function chooseCountry(page: Page, name: string): Promise<void> {
    await page.getByRole('button', { name: 'Find a country' }).click()
    await page.getByRole('combobox', { name: 'Find a country' }).fill(name)
    await page.getByRole('option', { name }).first().click()
    await expect(
      page.locator('[data-part="country-panel"]'),
      'choosing a country has to open the map surface, whichever route chose it',
    ).toBeVisible()
    // The camera frames it, and the anchor tracks the flight; the probes below
    // read boxes, so they wait for it to come to rest.
    await page.waitForTimeout(1_500)
  }

  /** Every box the map surfaces are forbidden to land on. */
  async function chromeBoxes(page: Page) {
    return page.evaluate(() => {
      const box = (selector: string) => {
        const node = document.querySelector(selector)
        return node === null ? null : node.getBoundingClientRect().toJSON()
      }
      return {
        search: box('[aria-label="Find a country"]'),
        zoom: box('[aria-label="Zoom in"]'),
        shelf: box('[data-part="atlas-shelf"]'),
        header: box('header'),
      }
    })
  }

  test('the atlas map answers a pointer with a card that clears its chrome', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    const watched = watchConsole(page, ATLAS)
    await visit(page, ATLAS, 'light')
    // Spain rather than France: `countryBounds()` is solved over the sovereign
    // cut, so framing France centres the camera between Guadeloupe and Réunion
    // and the middle of the map is the Sahara. Spain's rectangle is one
    // peninsula and the Canaries, and the camera lands on the peninsula — which
    // is what makes "there is land in the middle of the clear map" a fact rather
    // than a hope. The search is still the route, because it is the one that
    // works identically with a pointer and with a finger.
    await chooseCountry(page, 'Spain')
    // The panel is dismissed first: a hover card for the country the panel is
    // already about would be the same country said twice, and this test is
    // about the hover surface on its own.
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-part="country-panel"]')).toHaveCount(0)

    const canvas = await page.locator('.maplibregl-canvas').boundingBox()
    expect(
      canvas,
      'the map has to have drawn before it can be pointed at',
    ).not.toBeNull()
    if (canvas === null) return
    const chrome = await chromeBoxes(page)
    const clearTop = chrome.search?.bottom ?? canvas.y
    const clearBottom = chrome.shelf?.top ?? canvas.y + canvas.height
    const card = page.locator('[data-part="country-hover"]')

    // A ring around the middle of the clear map rather than one point: a
    // coastline is a coastline, and a probe that insisted on a single pixel
    // being land would be asserting against the camera rather than against the
    // card.
    const centre = {
      x: canvas.x + canvas.width / 2,
      y: (clearTop + clearBottom) / 2,
    }
    let found = false
    for (const dy of [0, -40, 40, -80, 80]) {
      for (const dx of [0, -40, 40, -80, 80]) {
        await page.mouse.move(centre.x + dx, centre.y + dy)
        if ((await card.count()) > 0) {
          found = true
          break
        }
      }
      if (found) break
    }
    expect(
      found,
      'the framed country fills the middle of the clear map, so a pointer there must find it',
    ).toBe(true)

    await expect(
      card,
      'the card is decoration: the same facts are in the panel, the record and the list',
    ).toHaveAttribute('aria-hidden', 'true')
    expect(
      await card.getAttribute('data-country'),
      'the card has to name the country under the pointer with its ISO code',
    ).toMatch(/^[A-Z]{2}$/)
    expect(
      (await card.textContent())?.trim() ?? '',
      'and print that country in words',
    ).not.toBe('')
    expect(
      await card.locator('button, a, [tabindex]').count(),
      'nothing inside a decorative surface may take focus',
    ).toBe(0)

    // The two shapes the hover surface takes, and the rule that there is no
    // third. A country on the record gets the whole fact grid — both figures and
    // both trip months; a country that is not gets its name and nothing else.
    // Whichever the ring found, a card carrying *some* of the grid would be a
    // reader told half a story, so the coherence is what is asserted rather than
    // a country hard-coded here that a fixture change could quietly retire.
    const shown = await page.evaluate(() => {
      const surface = document.querySelector('[data-part="country-hover"]')
      return {
        labels: [...(surface?.querySelectorAll('dt') ?? [])].map((node) =>
          node.textContent.trim(),
        ),
        words: (surface?.textContent ?? '').replace(/\s+/g, ' ').trim().length,
      }
    })
    if (shown.labels.length === 0) {
      expect(
        shown.words,
        'the pill is a country name and a flag, never a card with its numbers missing',
      ).toBeLessThan(40)
    } else {
      expect(
        shown.labels,
        'the fact grid is all four fields, in the order the card declares them',
      ).toEqual([
        expect.stringMatching(/^Trips?$/),
        expect.stringMatching(/^Places?$/),
        'First trip',
        'Last trip',
      ])
    }

    const surface = await page
      .locator('[data-part="country-surface"]')
      .first()
      .boundingBox()
    expect(
      surface,
      'the card has to be placed before it is judged',
    ).not.toBeNull()
    if (surface === null) return
    const apart = (
      other: { x: number; y: number; width: number; height: number } | null,
    ) =>
      other === null ||
      surface.x + surface.width <= other.x ||
      surface.x >= other.x + other.width ||
      surface.y + surface.height <= other.y ||
      surface.y >= other.y + other.height
    expect(
      apart(chrome.search),
      'the card must never land on the search pill',
    ).toBe(true)
    expect(
      apart(chrome.zoom),
      'the card must never land on the zoom cluster',
    ).toBe(true)
    expect(apart(chrome.shelf), 'the card must never land on the shelf').toBe(
      true,
    )

    expect(
      watched().fatal,
      'pointing at the map must not put anything in the console',
    ).toEqual([])
  })

  test('pressing a country opens a surface that carries the actions and answers the keyboard', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    const watched = watchConsole(page, ATLAS)
    await visit(page, ATLAS, 'dark')
    await chooseCountry(page, 'France')

    const panel = page.getByRole('dialog', { name: 'France' })
    await expect(
      panel,
      'the surface is a real dialog with the country as its name',
    ).toBeVisible()
    // The same figures the hover card carries, and the two writes it does not.
    await expect(panel).toContainText('Trips')
    await expect(panel).toContainText('Places')
    await expect(
      panel.getByRole('button', {
        name: /^(Mark visited|Remove France from your atlas)/,
      }),
    ).toBeVisible()
    await expect(
      panel.getByRole('button', {
        name: /^(Add to list|Remove France from your bucket list)/,
      }),
    ).toBeVisible()

    // On the panel itself, and both writes ahead of the way out.
    //
    // Radix's default is the first tab stop, which for a country already on the
    // record is the undo of somebody's travel history under the space bar. The
    // previous answer moved focus to the dismissal instead and traded that for a
    // second defect: the dismissal is last in the panel, so the very first Tab
    // left it and the two writes this surface exists for were reachable only
    // backwards. The container announces the dialog's role and its country, and
    // walking forwards from it reaches the writes first.
    expect(
      await page.evaluate(() => {
        const surface = document.querySelector('[data-part="country-panel"]')
        if (surface === null) return null
        const stops = [
          ...surface.querySelectorAll<HTMLElement>('button:not([disabled])'),
        ].map(
          (node) => node.getAttribute('aria-label') ?? node.innerText.trim(),
        )
        return {
          onPanel: surface === document.activeElement,
          first: stops.at(0),
        }
      }),
      'focus opens on the surface, and the first control forwards is a write',
    ).toEqual({
      onPanel: true,
      first: expect.stringMatching(/^(Mark visited|Remove France)/),
    })

    await page.keyboard.press('Escape')
    await expect(panel, 'Escape closes it').toHaveCount(0)
    expect(
      await page.evaluate(() => document.activeElement?.tagName ?? null),
      'and focus returns to the map, which is where the reader was',
    ).toBe('CANVAS')

    expect(
      watched().fatal,
      'opening and closing the surface must not put anything in the console',
    ).toEqual([])
  })

  /**
   * The rule for the other kind of pointer.
   *
   * `mousemove` does not exist on a finger, and the browser's own synthetic one
   * arrives *after* the tap — which is exactly how a hover pill ends up stranded
   * behind the panel that tap opened. The overlay stands hover down for as long
   * as the last thing to touch the map was a finger, and this is where that is
   * checked, on the project that actually has one.
   */
  test('a tap opens the surface and leaves no hover card behind it', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    test.skip(
      !isMobile,
      'this is the touch rule, and it needs a project with a touchscreen',
    )
    if (ATLAS === undefined) return
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'Spain')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-part="country-panel"]')).toHaveCount(0)

    const canvas = await page.locator('.maplibregl-canvas').boundingBox()
    expect(canvas, 'the map has to have drawn to be tapped').not.toBeNull()
    if (canvas === null) return
    const chrome = await chromeBoxes(page)
    const centre = {
      x: canvas.x + canvas.width / 2,
      y:
        ((chrome.search?.bottom ?? canvas.y) +
          (chrome.shelf?.top ?? canvas.y + canvas.height)) /
        2,
    }

    // A ring of taps rather than one, for the same reason the pointer probe
    // uses one: a coastline is a coastline, and a tap that lands in the sea is
    // the map correctly answering "nowhere".
    const panel = page.locator('[data-part="country-panel"]')
    let opened = false
    for (const dy of [0, -40, 40, -80, 80]) {
      for (const dx of [0, -40, 40, -80, 80]) {
        // Checked before the tap as well as waited for after it, and the two
        // guards answer different halves of the same hazard. A tap that has
        // landed on a country but not yet committed reads as "nothing opened",
        // and the next tap in the ring then lands *inside* the surface that did
        // open — on the action block, which writes to the fixture every later
        // frame in this suite is compared against. Waiting closes the common
        // case; only re-reading before the next tap closes the slow one, where
        // the surface arrived after the wait gave up.
        if ((await panel.count()) > 0) {
          opened = true
          break
        }
        await page.touchscreen.tap(centre.x + dx, centre.y + dy)
        opened = await panel
          .waitFor({ state: 'attached', timeout: 1_000 })
          .then(() => true)
          .catch(() => false)
        if (opened) break
      }
      if (opened) break
    }
    expect(
      opened,
      'a tap on a country is the touch route to the facts and to both writes',
    ).toBe(true)
    expect(
      await page.locator('[data-part="country-hover"]').count(),
      'and it must not leave a pointer affordance stranded behind the panel',
    ).toBe(0)
  })

  /**
   * The phone's composition, which is a different design and not a smaller one.
   *
   * A 393px handset leaves about 570 usable pixels of map, and a panel carrying
   * the fact grid *and* both writes wants five hundred and forty of them. At full
   * height no side of the country fits, so the placement used to fall through to
   * being centred on the shape: four fifths of the map covered, no tip, and the
   * country the reader had just pressed underneath the panel describing it.
   *
   * It gives up height instead — down to a floor that still carries the whole
   * card and the first write — and the block inside it scrolls behind a mask
   * fade with a bar that is drawn for exactly as long as there is more to see.
   * `data-tip="on"` is the load-bearing assertion: a tip is only ever solved for
   * a surface that was placed on a *side* of the shape, so it cannot be true of
   * one sitting on top of it.
   */
  test('the click surface clears the country it describes on a phone', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    test.skip(
      !isMobile,
      'this is the phone composition, and it needs the phone viewport',
    )
    if (ATLAS === undefined) return
    const watched = watchConsole(page, ATLAS)
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'Spain')

    const layer = page.locator('[data-part="country-surface"]').first()
    await expect(layer).toBeVisible()
    expect(
      await layer.getAttribute('data-fit'),
      'it gave up height rather than take the map',
    ).toBe('squeezed')
    expect(
      await layer.getAttribute('data-side'),
      'and it took an edge: above the country or below it, never over it',
    ).toMatch(/^(top|bottom)$/)

    const canvas = await page.locator('.maplibregl-canvas').boundingBox()
    const surface = await layer.boundingBox()
    expect(canvas, 'the map has to have drawn').not.toBeNull()
    expect(surface, 'and the surface has to be placed').not.toBeNull()
    if (canvas === null || surface === null) return
    expect(
      surface.height,
      'the surface never takes more than two thirds of the map',
    ).toBeLessThanOrEqual(canvas.height * 0.67)
    expect(
      Math.max(
        surface.y - canvas.y,
        canvas.y + canvas.height - (surface.y + surface.height),
      ),
      'and it leaves a band of world the reader can still read',
    ).toBeGreaterThan(150)

    // Squeezed means scrollable, and scrollable has to actually scroll. A
    // `max-height` alone leaves the surface indefinite, a percentage height
    // inside an indefinite box resolves to `auto`, and the region grew to its
    // content behind a parent that clips — so the second write sat in a strip no
    // gesture could reach.
    const scrolling = await page.evaluate(() => {
      const view = document.querySelector<HTMLElement>(
        '[data-part="country-panel"] [data-radix-scroll-area-viewport]',
      )
      if (view === null) return null
      const bar = document.querySelector(
        '[data-part="country-panel"] [data-orientation="vertical"]',
      )
      view.scrollTop = view.scrollHeight
      return {
        overflowing: view.scrollHeight > view.clientHeight + 1,
        moved: view.scrollTop > 0,
        bar: bar?.getAttribute('data-state') ?? 'absent',
      }
    })
    expect(scrolling, 'the region under test has to exist').not.toBeNull()
    if (scrolling === null) return
    expect(
      scrolling.overflowing
        ? { moved: scrolling.moved, bar: scrolling.bar }
        : null,
      'when there is more below, the region scrolls to it and says so with a bar',
    ).toEqual(scrolling.overflowing ? { moved: true, bar: 'visible' } : null)

    expect(
      watched().fatal,
      'the phone composition must not put anything in the console',
    ).toEqual([])
  })

  /**
   * Above the product's own measure the chrome stops being at the map's edges.
   *
   * `AtlasScreen` positions the search pill, the zoom cluster, the credit and the
   * shelf inside one centred `--content-max` well, so on a 2560px screen the zoom
   * cluster is 560 pixels in from the right-hand edge of the map. A placement
   * that subtracted the cluster's inset from the *map* was subtracting it from
   * open water and putting the panel straight over the cluster — the reader could
   * see the two zoom buttons through the gap under the panel and could not press
   * either. The clearance has to be measured against the well.
   */
  test('the click surface clears the chrome column on a screen wider than it', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    test.skip(
      isMobile,
      'a phone is narrower than the measure, so it has no column to clear',
    )
    if (ATLAS === undefined) return
    const watched = watchConsole(page, ATLAS)
    await page.setViewportSize({ width: 2560, height: 900 })
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'Spain')

    const chrome = await chromeBoxes(page)
    const surface = await page
      .locator('[data-part="country-surface"]')
      .first()
      .boundingBox()
    expect(
      surface,
      'the panel has to be placed before it is judged',
    ).not.toBeNull()
    if (surface === null) return
    const apart = (
      other: { x: number; y: number; width: number; height: number } | null,
    ) =>
      other === null ||
      surface.x + surface.width <= other.x ||
      surface.x >= other.x + other.width ||
      surface.y + surface.height <= other.y ||
      surface.y >= other.y + other.height

    expect(
      chrome.zoom === null ? null : chrome.zoom.x < 2560 - 200,
      'the cluster has to be inside the column for this to be testing anything',
    ).toBe(true)
    expect(
      apart(chrome.zoom),
      'the panel must never land on the zoom cluster, wherever the column puts it',
    ).toBe(true)
    expect(apart(chrome.search), 'nor on the search pill').toBe(true)

    expect(
      watched().fatal,
      'a screen wider than the measure must not put anything in the console',
    ).toEqual([])
  })

  /**
   * A dismissed surface stops being a target before it stops being visible.
   *
   * The layer fades for 150ms, and for every one of those milliseconds the panel
   * used to stay hit-testable — so a press arriving in that window landed on a
   * control the reader could see leaving, and two of the controls under it
   * rewrite the traveller's record. Sampled per animation frame rather than at
   * one instant, because the window is a handful of frames and a single probe
   * would be a race.
   */
  test('the dismissed surface stops answering a press while it leaves', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'France')

    const panel = page.getByRole('dialog', { name: 'France' })
    const box = await panel.boundingBox()
    expect(
      box,
      'the surface has to be placed before it is pressed',
    ).not.toBeNull()
    if (box === null) return
    const spot = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

    const sampling = page.evaluate(
      (at) =>
        new Promise<Array<string>>((resolve) => {
          const seen: Array<string> = []
          let frames = 0
          const tick = (): void => {
            const layer = document.querySelector(
              '[data-part="country-surface"]',
            )
            const surface = document.querySelector(
              '[data-part="country-panel"]',
            )
            if (layer === null || surface === null) {
              resolve(seen)
              return
            }
            if (layer.getAttribute('data-state') === 'closed') {
              const hit = document.elementFromPoint(at.x, at.y)
              seen.push(surface.contains(hit) ? 'panel' : 'through')
            }
            frames += 1
            if (frames < 60) {
              requestAnimationFrame(tick)
              return
            }
            resolve(seen)
          }
          requestAnimationFrame(tick)
        }),
      spot,
    )
    await page.keyboard.press('Escape')
    const samples = await sampling

    expect(
      samples.length,
      'the exit has to have frames, or this proves nothing',
    ).toBeGreaterThan(0)
    expect(
      samples.every((sample) => sample === 'through'),
      'every frame of the exit lets the press reach the map instead',
    ).toBe(true)
  })

  /**
   * What happens to the surface when its country leaves.
   *
   * A reader zooms in to read a country and then drags the world, and the shape
   * the panel is anchored to goes off the edge of the map. The first version
   * answered that by hiding the layer — which does not merely conceal a
   * non-modal dialog, it makes everything inside it unfocusable: the reader's
   * focus fell to the document body and an open dialog was left that no key
   * could reach. The anchor is clamped to the map's own edge instead, so the
   * surface stays on screen, stays operable, and its tip points the way back.
   */
  test('the click surface survives its country leaving the map', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    const watched = watchConsole(page, ATLAS)
    await visit(page, ATLAS, 'light')
    // Spain rather than France, for the reason `chooseCountry` gives: a
    // sovereign cut puts France's rectangle across two oceans, and the camera
    // has to actually arrive somewhere pannable.
    await chooseCountry(page, 'Spain')

    const panel = page.getByRole('dialog', { name: 'Spain' })
    await expect(panel).toBeVisible()
    const layer = page.locator('[data-part="country-surface"]').first()

    const canvas = await page.locator('.maplibregl-canvas').boundingBox()
    expect(canvas, 'the map has to have drawn to be dragged').not.toBeNull()
    if (canvas === null) return

    // One step of zoom, and then drag. At the opening zoom the atlas draws
    // exactly one world into its container, so there is nothing to pan; and
    // zooming on past `VISITED_COUNTRY_ZOOM.interactiveMax` is not the state
    // under test — the layer stops answering a pointer there and closes the
    // surface on purpose.
    const chrome = await chromeBoxes(page)
    const placed = await panel.boundingBox()
    expect(
      placed,
      'the surface has to be placed before it is dragged',
    ).not.toBeNull()
    if (placed === null) return
    const shelfTop = chrome.shelf?.top ?? canvas.y + canvas.height
    const lane =
      shelfTop - (placed.y + placed.height) > 60
        ? (placed.y + placed.height + shelfTop) / 2
        : ((chrome.search?.bottom ?? canvas.y) + placed.y) / 2

    // Through the map's own control, which is also the shortest statement of the
    // other half of this: the zoom cluster is rendered beside MapLibre's
    // container rather than inside it, so a dismissable layer with Radix's
    // default rules treated pressing `+` as "the reader is done with this
    // panel" and threw away the surface they were zooming in to read.
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.waitForTimeout(700)
    await expect(
      panel,
      'the map\u2019s own controls do not dismiss the map\u2019s own surface',
    ).toBeVisible()

    let gone = false
    for (let step = 0; step < 8 && !gone; step += 1) {
      await page.mouse.move(canvas.x + canvas.width - 60, lane)
      await page.mouse.down()
      await page.mouse.move(canvas.x + 60, lane, { steps: 12 })
      await page.mouse.up()
      await page.waitForTimeout(350)
      gone = (await layer.getAttribute('data-anchor')) === 'offscreen'
    }
    expect(
      gone,
      'zooming away from the country has to take it off the map, or this proves nothing',
    ).toBe(true)

    await expect(
      panel,
      'the surface stays on screen when its country does not',
    ).toBeVisible()
    const close = panel.getByRole('button', { name: 'Close Spain' })
    await close.focus()
    expect(
      await page.evaluate(() => {
        const surface = document.querySelector('[data-part="country-panel"]')
        return surface?.contains(document.activeElement) ?? false
      }),
      'and it is still reachable, which is what being hidden took away',
    ).toBe(true)

    await page.keyboard.press('Escape')
    await expect(panel, 'and Escape still closes it').toHaveCount(0)

    expect(
      watched().fatal,
      'none of that may put anything in the console',
    ).toEqual([])
  })

  /**
   * Non-modal has to mean it, and Radix does not give that away for free.
   *
   * A dialog's content is rendered inside a focus scope with `loop` hard-wired
   * on, and that scope loops a Tab press at either of its edges whether or not
   * it is trapped — so the panel called itself non-modal and was a keyboard trap
   * anyway: Tab and Shift+Tab both bounced off it forever and the shelf, the
   * search field and the map behind it could not be reached at all while it was
   * open. Asserted in a real browser rather than only in jsdom, because the
   * thing under test is the browser's own sequential focus navigation.
   */
  test('the click surface can be tabbed out of in both directions', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    const watched = watchConsole(page, ATLAS)
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'France')

    const panel = page.getByRole('dialog', { name: 'France' })
    await expect(panel).toBeVisible()

    /** Walks to the far edge of the panel, then one press past it. */
    const leave = async (key: 'Tab' | 'Shift+Tab'): Promise<boolean> => {
      for (let press = 0; press < 12; press += 1) {
        const inside = await page.evaluate(() => {
          const surface = document.querySelector('[data-part="country-panel"]')
          return surface?.contains(document.activeElement) ?? false
        })
        if (!inside) return true
        await page.keyboard.press(key)
      }
      return false
    }

    // Focus opens on the panel itself, so forwards is a walk through the action
    // block to the dismissal and out, and backwards leaves at once.
    expect(
      await leave('Tab'),
      'a reader must be able to tab forwards out of the panel',
    ).toBe(true)
    await expect(
      panel,
      'and tabbing away is not a dismissal: the panel belongs to the selection',
    ).toBeVisible()

    await panel.getByRole('button', { name: 'Close France' }).focus()
    expect(await leave('Shift+Tab'), 'and backwards out of it as well').toBe(
      true,
    )
    await expect(panel).toBeVisible()

    // And back in, and dismissed from there.
    const dismiss = panel.getByRole('button', { name: 'Close France' })
    await dismiss.focus()
    await expect(
      dismiss,
      'leaving the panel does not put its dismissal out of reach',
    ).toBeFocused()

    // Escape belongs to the topmost dismissable layer, and a keyboard reader
    // opens a tooltip on every icon control their focus passes over — the zoom
    // cluster on the way out, the panel's own dismissal on the way back. Each of
    // those is a layer above this one for as long as it is leaving, so the press
    // is repeated until they have gone, which is the sequence a reader performs
    // rather than a sequence invented to make an assertion pass.
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press('Escape')
      if ((await page.locator('[data-part="country-panel"]').count()) === 0) {
        break
      }
      await page.waitForTimeout(250)
    }
    await expect(
      panel,
      'and it is the dismissible surface it was before the reader left it',
    ).toHaveCount(0)

    expect(
      watched().fatal,
      'none of that may put anything in the console',
    ).toEqual([])
  })

  /**
   * The reader who asked for less movement still gets the focus move.
   *
   * Both are motion-layer decisions and only one of them is motion. The panel
   * asked for focus one style recalculation before the layer it lives in had
   * been made visible, and with the entrance animation running that
   * recalculation always landed first — so the defect existed only for a reader
   * with `prefers-reduced-motion: reduce`, and only that reader lost the
   * keyboard route into the surface they had just opened.
   */
  test('reduced motion still moves focus into the click surface', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'France')

    expect(
      await page.evaluate(() => {
        const surface = document.querySelector('[data-part="country-panel"]')
        return {
          inside: surface?.contains(document.activeElement) ?? false,
          onPanel: surface === document.activeElement,
        }
      }),
      'focus moves into the surface whatever the reader has asked motion to do',
    ).toEqual({ inside: true, onPanel: true })

    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('dialog', { name: 'France' }),
      'and Escape still closes it',
    ).toHaveCount(0)
  })

  /**
   * The exit, which has to have a frame to play in.
   *
   * Radix marks its content `data-state="closed"` and defers the unmount until
   * the animation it finds there has run. That only works if the layer above it
   * is still rendered: while the open country was derived from the selection,
   * the commit that closed the surface tore the whole subtree down in the same
   * frame and the pop-out was dead styling. Sampled per animation frame rather
   * than at one instant, because a 150ms exit is a handful of frames and a
   * single probe would be a race.
   */
  test('the click surface plays an exit instead of blinking out', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'France')

    const sampling = page.evaluate(
      () =>
        new Promise<Array<string>>((resolve) => {
          const seen: Array<string> = []
          const deadline = 40
          const tick = (): void => {
            const layer = document.querySelector(
              '[data-part="country-surface"]',
            )
            const panel = document.querySelector('[data-part="country-panel"]')
            seen.push(
              layer === null
                ? 'gone'
                : `${layer.getAttribute('data-state') ?? '?'}:${
                    panel === null
                      ? 'unmounted'
                      : getComputedStyle(panel).animationName
                  }`,
            )
            if (seen.length < deadline) {
              requestAnimationFrame(tick)
              return
            }
            resolve(seen)
          }
          requestAnimationFrame(tick)
        }),
    )
    await page.keyboard.press('Escape')
    const frames = await sampling

    expect(
      frames.some((sample) => sample.startsWith('closed:')),
      'the layer stays mounted, marked closed, while it leaves',
    ).toBe(true)
    expect(
      frames.some((sample) => sample.endsWith(':pt-pop-out')),
      'and the exit the design system names is the one that runs',
    ).toBe(true)
    expect(frames.at(-1), 'and then it is gone').toBe('gone')
  })

  /**
   * The layer the surfaces claim, checked against the tokens rather than
   * against a picture.
   *
   * Radix's own popover layers default to `--z-dropdown`, which is above
   * `--z-nav`; a surface that inherited that default would float over the app
   * header and, on a phone, over the tab bar. The three tiers are read off the
   * live document so a token retune cannot silently reorder them.
   */
  test('the map surfaces sit above the shelf and below the app header', async ({
    page,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'France')

    const layers = await page.evaluate(() => {
      const zOf = (node: Element | null) =>
        node === null
          ? null
          : Number.parseInt(getComputedStyle(node).zIndex, 10)
      const style = getComputedStyle(document.documentElement)
      return {
        surface: zOf(document.querySelector('[data-part="country-surfaces"]')),
        shelf: zOf(document.querySelector('[data-part="atlas-shelf"]')),
        nav: Number.parseInt(style.getPropertyValue('--z-nav'), 10),
        mapSurface: Number.parseInt(
          style.getPropertyValue('--z-map-surface'),
          10,
        ),
        mapOverlay: Number.parseInt(
          style.getPropertyValue('--z-map-overlay'),
          10,
        ),
        portalled:
          document.body.querySelector(
            ':scope > [data-part="country-panel"]',
          ) !== null,
      }
    })

    expect(
      layers.mapOverlay,
      'the shelf tier is below the surface tier',
    ).toBeLessThan(layers.mapSurface)
    expect(layers.mapSurface, 'and both are below the app header').toBeLessThan(
      layers.nav,
    )
    expect(layers.surface, 'the surface layer claims the surface tier').toBe(
      layers.mapSurface,
    )
    expect(
      layers.portalled,
      'nothing here portals to the document body, where it would escape the slice',
    ).toBe(false)
  })

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
   * The words are the whole `<body>`, not the route's own root. The screenshot is
   * of the document, so a countdown in the top nav or the mobile tab bar would be
   * inside the comparison and unmasked, and a probe scoped to `main` would never
   * have looked at it.
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
      return readRelativeTime(page)
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
  options: {
    readonly latchAfterMs?: number
    /**
     * Markup outside `main`, for the app shell.
     *
     * The screenshot is of the document, so a string in the top nav or the mobile
     * tab bar is in the frame — which is why the day-boundary probe reads the whole
     * `<body>`. Asserting that needs a page with something outside the route's own
     * root, and no real screen can be asked to put a countdown in its header.
     */
    readonly shell?: string
  } = {},
): Promise<void> {
  // A whole document, not a fragment: without a doctype the engine renders in
  // quirks mode, and without the viewport meta mobile WebKit lays the page out at
  // 980px and scales it, which makes a 120px document report as 2125px tall and
  // the resize path fire on a page that already fits.
  await page.setContent(
    `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0">${options.shell ?? ''}<main style="min-width:120px;min-height:120px">${body}</main></body></html>`,
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
 * The unused-preload advisory, verbatim, in each engine's own wording.
 *
 * Not transcribed from a failing run: reproduced against this origin by serving a
 * document whose only content is two `<link rel="preload" as="style">` tags that
 * nothing uses, one under a dev-server path and one under a built-asset path, and
 * reading what each engine then wrote to the console. Both produce the same first
 * sentence for both URLs and diverge only in the advice that follows — which is
 * why the tolerance is anchored on the sentence they share and scoped by the URL
 * rather than by the tail.
 *
 * `WEBKIT_PRELOAD_TAIL` is the wording that actually failed a run of the suite,
 * on mobile WebKit, on `/register` in dark.
 */
const WEBKIT_PRELOAD_TAIL = " Please make sure it wasn't preloaded for nothing."

const CHROMIUM_PRELOAD_TAIL =
  ' Please make sure it has an appropriate `as` value and it is preloaded intentionally.'

function preloadAdvisory(url: string, tail = WEBKIT_PRELOAD_TAIL): string {
  return `The resource ${url} was preloaded using link preload but not used within a few seconds from the window's load event.${tail}`
}

/** The hosts a development server answers on, and the only ones the tolerance covers. */
const LOOPBACK_HOSTS: ReadonlyArray<string> = [
  'localhost',
  '127.0.0.1',
  '[::1]',
]

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
      // The pinned value is written over the live string before the shutter, so a
      // value the pattern no longer matches would leave the region unmasked, and a
      // value outside the corpus would put copy on the screen the product cannot
      // print.
      expect(
        site.pinned,
        `${site.source}: the pinned string has to be one this site's own pattern matches, or pinning it takes the region out of the mask`,
      ).toMatch(site.drifts)
      expect(
        site.variants,
        `${site.source}: pin to a string the product can actually print, not to an invented one`,
      ).toContain(site.pinned)
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
        // The message that failed `register renders in dark` on mobile WebKit in
        // one full run of four. `/src/styles/styles.css` is a path only `vite dev`
        // serves, and the engine writes this about it a few seconds after the load
        // event — so whether the gate went red was decided by how long the page
        // stayed open, not by anything on the page.
        what: 'the unused-preload advisory about a dev-server stylesheet',
        type: 'warning',
        text: preloadAdvisory('http://localhost:3000/src/styles/styles.css'),
        liveMap: false,
        verdict: 'tolerated',
      },
      {
        what: "the same advisory in Chromium's wording, on a loopback address",
        type: 'warning',
        text: preloadAdvisory(
          'http://127.0.0.1:3003/@id/virtual:tanstack-start-dev-client-entry',
          CHROMIUM_PRELOAD_TAIL,
        ),
        liveMap: false,
        verdict: 'tolerated',
      },
      {
        what: 'the advisory about an unbundled dependency the dev server served',
        type: 'warning',
        text: preloadAdvisory(
          'http://localhost:3003/node_modules/.vite/deps/maplibre-gl.js',
        ),
        liveMap: false,
        verdict: 'tolerated',
      },
      {
        // The direction that keeps this narrow: the built application preloading
        // an asset it never uses is a real defect, and it is the same sentence.
        what: 'the advisory about a hashed asset the deployed bundle preloaded',
        type: 'warning',
        text: preloadAdvisory('http://localhost:3003/assets/app-9f3c1a2b.css'),
        liveMap: false,
        verdict: 'fatal',
      },
      {
        what: 'the advisory from a host that is not a development server',
        type: 'warning',
        text: preloadAdvisory('https://planned.travel/src/styles/styles.css'),
        liveMap: false,
        verdict: 'fatal',
      },
      {
        what: 'an app warning that merely quotes the preload advisory',
        type: 'warning',
        text: `The theme script bailed out. ${preloadAdvisory('http://localhost:3003/src/styles/styles.css')}`,
        liveMap: false,
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
  test("the console watcher splits the browser's advisories from the app's own mistakes", async ({
    page,
  }) => {
    const watched = watchConsole(page, SYNTHETIC_MAP)
    await syntheticPage(page, '<p>A page with a console.</p>')

    await page.evaluate(
      ([driver, preload]) => {
        console.warn(driver)
        console.warn(preload)
        console.error(
          "Hydration failed because the server rendered text didn't match the client.",
        )
        window.setTimeout(() => {
          throw new Error('a component threw after paint')
        }, 0)
      },
      [
        glAdvisory('0x13400534c00'),
        preloadAdvisory('http://localhost:3000/src/styles/styles.css'),
      ] as const,
    )

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
      report.tolerated.join('\n'),
      'the unused-preload advisory is the browser talking about a URL only the dev server serves',
    ).toContain('/src/styles/styles.css was preloaded')
    expect(
      report.fatal.join('\n'),
      'a hydration error is the defect this repo has actually shipped, and it stays fatal',
    ).toContain('Hydration failed')
    expect(
      report.fatal.join('\n'),
      'an uncaught exception after paint reaches the run through pageerror, not through console',
    ).toContain('a component threw after paint')
  })

  /**
   * The advisory as the engine itself writes it, rather than as this file quotes
   * it.
   *
   * The tolerance is a pattern matched against a string, so a spec built entirely
   * out of `console.warn` proves the pattern matches what *this file* believes the
   * message says. Both are worth having, and only one of them notices the day an
   * engine rewords it: this drives a real unused preload on a real dev-server
   * origin and lets WebKit and Chromium write their own message.
   *
   * Two preloads, one under a dev-server path and one under a built-asset path,
   * because the interesting property is not that the advisory is tolerated — it is
   * that the identical sentence about an `/assets/…` URL is not. A tolerance that
   * could not tell them apart would be a licence to preload anything.
   *
   * The engine emits this "a few seconds from the window's load event", so the
   * spec polls rather than waits a fixed time, and it is the one spec here allowed
   * to be slow.
   */
  test('the engine writes the preload advisory this gate tolerates, and not the one it does not', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(30_000)
    // The tolerance is scoped to a development origin by design, so pointing the
    // suite at a deployed preview leaves nothing here to assert — and the
    // advisory would correctly be fatal there.
    const origin = baseURL === undefined ? null : new URL(baseURL).hostname
    test.skip(
      origin === null || !LOOPBACK_HOSTS.includes(origin),
      'this run is not against a development origin, where the tolerance does not apply at all',
    )

    const DEV_URL = '/src/styles/styles.css'
    const BUILT_URL = '/assets/gate-probe-9f3c1a2b.css'
    const stylesheet = { contentType: 'text/css', body: 'body{}' }

    await page.route(`**${DEV_URL}`, (route) => route.fulfill(stylesheet))
    await page.route(`**${BUILT_URL}`, (route) => route.fulfill(stylesheet))
    await page.route('**/gate/unused-preloads', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html lang="en"><head><link rel="preload" as="style" href="${DEV_URL}"><link rel="preload" as="style" href="${BUILT_URL}"></head><body><main>Two preloads nothing uses.</main></body></html>`,
      }),
    )

    const watched = watchConsole(page, SYNTHETIC_PLAIN)
    await page.goto('/gate/unused-preloads', { waitUntil: 'load' })

    await expect
      .poll(() => watched().fatal.length, {
        message:
          'the engine has to write the advisory about the built asset, or this spec is asserting nothing',
        timeout: 20_000,
      })
      .toBe(1)

    const report = watched()
    expect(
      report.fatal.join('\n'),
      'a built asset preloaded and not used is the application asking for something it never needed, and it stays fatal',
    ).toContain(BUILT_URL)
    expect(
      report.tolerated.join('\n'),
      "the same sentence about a path only `vite dev` serves is the dev server's, not the product's",
    ).toContain(DEV_URL)
    expect(
      report.fatal.join('\n'),
      'the dev-server advisory must not also reach the fatal list',
    ).not.toContain(DEV_URL)
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

  /**
   * The dev toolbar, kept out of the frame however late it arrives.
   *
   * Not hypothetical: every mobile-safari baseline recorded before this change has
   * the toolbar's trigger sitting over the "Journey" tab, ~3500 differing pixels
   * that the next run either reproduced or failed on depending on how loaded the
   * machine was. The old mechanism wrote `display: none` onto whatever existed at
   * that instant, and the trigger has two ways round that — mounting later, and
   * re-rendering over its own `style` attribute — so what it hid was a matter of
   * timing. A rule with `!important` can be raced by neither, and both halves are
   * asserted here, because both are silent in a green run.
   */
  test('the dev toolbar stays out of the frame when it arrives after the settle', async ({
    page,
  }) => {
    await syntheticPage(page, '<p>No tooling on this page yet.</p>')
    await settle(page, SYNTHETIC_PLAIN)

    // Mounted after the settle, with an inline `display` of its own — the two
    // things that used to defeat the one-shot write, together. Written as the
    // markup the toolbar actually renders and then checked against `DEV_TOOLBAR`,
    // so the stand-in and the selector cannot drift apart in silence.
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div data-testid="tanstack_devtools" style="display:block;position:fixed;inset:auto 0 0 auto;width:60px;height:60px"></div>',
      )
    })

    expect(
      await page.locator(DEV_TOOLBAR).count(),
      'the stand-in has to match the selector the gate hides, or this asserts nothing',
    ).toBe(1)
    expect(
      (await readCaptureState(page, SYNTHETIC_PLAIN)).devChromeShown,
      'a toolbar that mounts after the settle, carrying its own inline display, must still be out of the frame',
    ).toBe(false)
  })

  /**
   * A control the product mounts on a timer, waited for rather than raced.
   *
   * The app's avatar is one: Radix's fallback is given `delayMs={200}`, so the
   * initials arrive about 200 ms after mount with nothing mutating in between — and
   * a 150 ms quiet window can close in that gap and photograph a blank circle. Both
   * frames sit inside `maxDiffPixelRatio`, so it never turned a run red; it just
   * meant the baseline was whichever one the recording machine happened to produce.
   * `DOM_QUIET_FLOOR_MS` holds the observer open past that timer.
   */
  test('a control that mounts on a timer is in the settled frame', async ({
    page,
  }) => {
    // Under the clock the gate actually installs, because that is the one
    // configuration this has to hold in — and the configuration it stopped holding
    // in the moment `FROZEN_NOW` arrived.
    await page.clock.setFixedTime(new Date(FROZEN_NOW))
    await syntheticPage(page, '<p>Copy.</p>')
    // Later than the quiet window and earlier than the floor: the whole point is
    // that quiet alone cannot see it coming.
    await page.evaluate(() => {
      window.setTimeout(() => {
        const late = document.createElement('span')
        late.id = 'mounts-on-a-timer'
        late.textContent = 'RW'
        document.querySelector('main')?.appendChild(late)
      }, 250)
    })

    await settle(page, SYNTHETIC_PLAIN)

    expect(
      await page.locator('#mounts-on-a-timer').count(),
      'settle() returned before a timer-driven control had mounted, so the frame is the one before the product finished rendering',
    ).toBe(1)
  })

  /**
   * Which of the three timers the wait actually ends on, under the clock the gate
   * installs.
   *
   * This is the regression test for a defect that was invisible for every frame in
   * the suite while every frame in the suite passed. `settleMutations()` used to
   * express its floor as arithmetic — `Date.now()` at open, `Date.now()` again on
   * each quiet window — and `visit()` installs `page.clock.setFixedTime` before the
   * first navigation, so the difference was 0 ms on every evaluation. The floor was
   * never satisfied, the quiet path rescheduled itself forever, and the only timer
   * that ever resolved was the one whose job is to give up: measured at 2003 ms on
   * Chromium and 2004 ms on WebKit, every frame, for a wait whose designed answer
   * is 353 ms. Nothing went red over it. The gate simply had no quiet guarantee at
   * all and was paying 1.65 s a frame to have none.
   *
   * So the freeze is asserted first, in the page, rather than assumed: without it
   * this spec would pass against the arithmetic it exists to reject. `Date` must
   * not move across a real delay and `performance.now()` must — which is also the
   * measurement behind the rule that nothing running in the page may time itself
   * with a clock.
   *
   * The wait is then measured from the Node side, where the clock is real, and
   * asserted from both ends: at least the floor, so a timer-driven control is still
   * waited for, and comfortably short of the cap, so it is the quiet path that
   * ended it. `settleMutations()` is measured directly rather than through
   * `settle()`, so the numbers are the wait and not the round trips around it.
   */
  test('the settle ends on a quiet document, not on the give-up cap', async ({
    page,
  }) => {
    expect(
      DOM_QUIET_FLOOR_MS,
      'a floor no longer than the quiet window is not a floor, and the timer-driven control it exists for goes back to being a race',
    ).toBeGreaterThan(DOM_QUIET_MS)

    await page.clock.setFixedTime(new Date(FROZEN_NOW))
    await syntheticPage(page, '<p>A document with nothing left to do.</p>')

    const clock = await page.evaluate(async () => {
      const wall = Date.now()
      const monotonic = performance.now()
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 400)
      })
      return {
        wall: Date.now() - wall,
        monotonic: Math.round(performance.now() - monotonic),
      }
    })
    expect(
      clock.wall,
      'the frozen clock is the precondition: if `Date` moves in the page, this spec is not testing the configuration the gate runs in',
    ).toBe(0)
    expect(
      clock.monotonic,
      'the page timers have to keep running, or a map would never finish drawing and this would be `clock.install()` rather than `setFixedTime`',
    ).toBeGreaterThanOrEqual(300)

    const started = Date.now()
    await settleMutations(page)
    const held = Date.now() - started

    expect(
      held,
      'the wait returned before the floor, so a control the product mounts on a timer is a race again',
    ).toBeGreaterThanOrEqual(DOM_QUIET_FLOOR_MS)
    expect(
      held,
      'the wait ended on the give-up cap, which means the quiet path is unreachable and no frame in the suite has a quiet guarantee',
    ).toBeLessThan(DOM_QUIET_CAP_MS)
  })

  /**
   * The give-up timer, which the floor must never be able to defer.
   *
   * A dev-server heartbeat, a live clock, a spinner: a document that mutates
   * forever has no quiet window to offer, and the wait has to degrade to a fixed
   * pause rather than to a test timeout. The cap is the only one of the three
   * timers that is not behind a latch, and this is what says so.
   */
  test('a document that never stops mutating gives up on the cap', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(FROZEN_NOW))
    await syntheticPage(page, '<p>Never still.</p>')
    await page.evaluate(() => {
      let tick = 0
      window.setInterval(() => {
        tick += 1
        document.querySelector('main')?.setAttribute('data-tick', String(tick))
      }, 50)
    })

    const started = Date.now()
    await settleMutations(page)
    const held = Date.now() - started

    expect(
      held,
      'a page that mutates forever must still hold the full cap, or the wait is ending on something the observer never saw',
    ).toBeGreaterThanOrEqual(DOM_QUIET_CAP_MS)
    expect(
      held,
      'the cap has to end the wait on its own: a floor that can defer it turns a busy page into a test timeout',
    ).toBeLessThan(DOM_QUIET_CAP_MS * 2)
  })

  /**
   * The excluded rectangle, held still by construction rather than by tolerance.
   *
   * A mask covers an element's box, and the countdown badge's box *is* its text:
   * `ml-auto` fixes its right edge and the content sets its width, so "in 1d" and
   * "in 50d" mask two different rectangles and the difference between them is
   * unmasked page. It hid inside `maxDiffPixelRatio`, which is precisely why it
   * needed fixing — the tolerance is the one budget this gate is not allowed to
   * spend, and an exclusion that leans on it is an exclusion that fails the
   * morning something else needs the room.
   *
   * Asserted in both directions on the same markup: unpinned, the two clock values
   * really do produce different boxes, so the defect is reproduced rather than
   * assumed; pinned, they produce the same box to the pixel.
   */
  test('pinning makes the excluded region the same rectangle whatever the clock says', async ({
    page,
  }) => {
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

    // The tile's meta row as the product builds it: a flex row whose last cell is
    // pushed right, inside the link that covers the whole tile.
    const tile = (countdown: string) =>
      `<a href="/trips/x/plan" style="display:block;width:320px;font:14px sans-serif"><div style="display:flex;gap:16px"><span>17 &ndash; 23 Aug 2026</span><span style="margin-left:auto">${countdown}</span></div></a>`

    const boxesFor = async (countdown: string) => {
      await syntheticPage(page, tile(countdown))
      const loose = await relativeTimeRegionOf(page, badge).boundingBox()
      const written = await pinRelativeTime(page, SYNTHETIC_CLOCK)
      const held = await relativeTimeRegionOf(page, badge).boundingBox()
      return { loose, held, written }
    }

    const short = await boxesFor('in 1d')
    const long = await boxesFor('in 50d')

    expect(
      short.written,
      'the pin has to find the badge, or this spec proves nothing about it',
    ).toBe(1)
    expect(
      long.written,
      'the pin has to find the badge, or this spec proves nothing about it',
    ).toBe(1)
    expect(
      short.loose?.width,
      'the defect being fixed: unpinned, two clock values mask two different rectangles',
    ).not.toBe(long.loose?.width)
    expect(
      short.held,
      'pinned, the excluded rectangle is the same rectangle — the exclusion no longer depends on what the clock said',
    ).toEqual(long.held)

    // And a route that declares no clock is left exactly as the product rendered
    // it: pinning is scoped by the same declaration the mask is.
    await syntheticPage(page, tile('in 50d'))
    expect(
      await pinRelativeTime(page, SYNTHETIC_PLAIN),
      'a route with no declared clock has nothing to pin, and its copy must not be rewritten',
    ).toBe(0)
    await expect(
      page.locator('a[href="/trips/x/plan"]'),
      'the undeclared route keeps its own words',
    ).toContainText('in 50d')
  })

  /**
   * What the day-boundary probe reads, and what it refuses to read.
   *
   * Two failures, opposite in shape. The probe used to walk `route.ready` — `main`
   * on every authenticated route — so a clock-derived string rendered by the app
   * shell was inside the screenshot, outside every mask, and outside the one check
   * that would have noticed: the probe would have compared two empty strings and
   * passed. And the walk has to skip `<script>`, because the loader payload is
   * serialised into one and the probe's whole method is rewriting `today` inside
   * it — a walk that counted script text would report its own input as a page that
   * moved, on every route, every run.
   */
  test('the day-boundary probe reads the whole document and not the source in it', async ({
    page,
  }) => {
    await syntheticPage(
      page,
      '<p>Nothing in here is the wall clock&rsquo;s.</p>',
      {
        shell: '<header><span>in 51d</span></header>',
      },
    )
    const shell = await readRelativeTime(page)
    expect(
      shell.rest,
      'a countdown in the app shell is in the frame, so it has to be in the words the probe compares',
    ).toContain('in 51d')

    await syntheticPage(
      page,
      '<p>Copy</p><script type="application/json">{"today":"2026-08-20"}</script>',
    )
    const source = await readRelativeTime(page)
    expect(
      source.rest,
      'the payload the probe rewrites lives in a script tag, and reading it back would make every route look like it moved',
    ).toBe('Copy')
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

  /**
   * The fallback the per-frame diagnosis stands on.
   *
   * `reportServerCalendar()` reads the server's day from `SERVER_CLOCK_ROUTES`
   * whenever the route under diagnosis carries none, and that list is derived from
   * the route table rather than written twice. An empty one would put the function
   * straight back into the assertion this round removed — "no document stamped a
   * server `today`" — for exactly the three frames that need the fallback, and the
   * only symptom would be a missing annotation on a failing frame.
   */
  test('the calendar report has somewhere to read the clock from', () => {
    expect(
      SERVER_CLOCK_ROUTES.length,
      'with no clock route the per-frame diagnosis has no day to compare a fixture date against, and it fails silently into an annotation nobody gets',
    ).toBeGreaterThan(0)
    for (const route of SERVER_CLOCK_ROUTES) {
      expect(
        route.relativeTime,
        `${route.path} is in the clock list without declaring the clock — the list has stopped being derived from the route table`,
      ).toBe(true)
    }
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
