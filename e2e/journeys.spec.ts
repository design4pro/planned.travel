import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import {
  CONSOLE_ACCOUNT_NAME,
  CONSOLE_ROUTES,
  IMPERSONATION_BAR,
  IMPERSONATION_TARGET_NAME,
  beginImpersonation,
  consoleAccountPath,
  endImpersonationFixture,
  hasPlatformConsole,
} from './helpers/admin.ts'
import { visit, watchConsole } from './helpers/console.ts'
import { restingCamera } from './helpers/places-and-maps.ts'
import {
  APP_ROUTES,
  PUBLIC_ROUTES,
  THEMES,
  applyTheme,
} from './helpers/routes.ts'
import type { RouteCase, Theme } from './helpers/routes.ts'
import {
  DEMO_EMAIL,
  hasSession,
  signIn,
  useSession,
} from './helpers/session.ts'
import {
  FROZEN_NOW,
  readCaptureState,
  readMapCensus,
  settle,
  settleMap,
} from './helpers/settle.ts'

/**
 * The critical journeys.
 *
 * What survives here is what a browser is the only place to answer. Two
 * projects — desktop Chromium at 1440x900 and mobile WebKit at 393x659, the
 * iPhone 15 descriptor's viewport rather than its 393x852 screen — because the
 * two layouts the design system ships behave differently in ways no jsdom
 * render reproduces: safe-area insets, `100dvh`, momentum scroll, and a real
 * compositor deciding which element a press lands on.
 *
 * The bar for a test in this file, from ADR 0016: its failure mode cannot be
 * produced in a lower layer. Geometry that `placeCountrySurface()` decides is
 * asserted against `placeCountrySurface()`, in
 * `src/components/atlas/__tests__/country-overlay.test.tsx`. What is left is
 * routing, sessions, hydration, WebGL, real hit-testing and sequential focus.
 *
 * Two things every journey carries, because both fail silently otherwise: the
 * console watcher, which turns a React hydration error or an uncaught exception
 * after paint into a red run, and `settle()`, which will not let a journey
 * assert against a document that has not finished arriving.
 *
 * The harness behind them is five modules under `./helpers`, one seam each:
 * `session.ts` (the one sign-in a run gets, and the language pin), `routes.ts`
 * (the screens, the `RouteCase` shape, the theme), `settle.ts` (paint timing,
 * the browser's clock, the live WebGL map), `console.ts` (the visit, and the
 * reading of what the engine said while it settled) and `admin.ts` (the platform
 * console and the impersonated session - the two fixtures no product surface can
 * mint for itself). `console-policy.ts` is pure and graded by vitest.
 */

/**
 * One route, one theme: reach it, settle it, insist the console is clean.
 *
 * The console is the whole net now that no pixel is compared, and it is a good
 * one for exactly the failures a walk can produce: React logs a hydration
 * mismatch as an error, an exception thrown after paint reaches no user-visible
 * surface at all, and both are invisible to a test that only asks whether the
 * page arrived. `visit()` already refuses a response of 400 or worse and waits
 * for the route's own `ready` selector, so what this adds is the reading
 * around it.
 *
 * A tolerated warning is attached to the run rather than dropped. A filter
 * nobody can see in a green run is a filter that starts swallowing real
 * defects.
 *
 * **One page per route, deliberately.** Folding fourteen declarations into one
 * walk is a saving in browser launches, not a licence to grade a route on what
 * the previous one left behind: an unmount runs when the next route is already
 * being watched, and its exceptions land in that route's reading. Reading them
 * there is worse than not reading them - it names the wrong screen. The first
 * version of this walk shared a page and failed on `/forgot-password` with
 * "Cannot clear timer: timer created with requestIdleCallback() but cleared with
 * clearTimeout()", raised while `@radix-ui/react-password-toggle-field` tore down
 * the field on `/login`, one route earlier. (The sentence turned out to be
 * Playwright's fake clock rather than WebKit, and on Chromium it was caught being
 * provoked by Sentry Replay rather than by Radix — most likely the same here; it is
 * tolerated for that reason in `TOLERATED_PAGE_ERRORS`, and the lesson about the
 * wrong screen stands for every exception that is not.) A fresh page is what the
 * fourteen separate declarations gave for free, and it is the only part of them
 * worth keeping.
 */
async function walk(
  context: BrowserContext,
  route: RouteCase,
  theme: Theme,
): Promise<void> {
  const page = await context.newPage()
  try {
    const watched = watchConsole(page, route)
    await visit(page, route, theme)
    const output = watched()
    expect(
      output.fatal,
      `${route.path}: the console must be clean by the time the route has settled`,
    ).toEqual([])
    if (output.tolerated.length > 0) {
      test.info().annotations.push({
        type: 'tolerated console output',
        description: `${route.path}: ${output.tolerated.join('\n')}`,
      })
    }
  } finally {
    await page.close()
  }
}

/**
 * Journey 1: a stranger reaches every screen that does not need an account.
 *
 * One test for the whole table rather than one per route and theme, because
 * what is being asserted is a property of the set: every public route answers,
 * renders its own content, hydrates, and says nothing in the console. Fourteen
 * separate declarations of that bought fourteen browser launches and one bit of
 * information.
 *
 * Both themes, still, and not for the pixels: the theme is emulated through
 * `prefers-color-scheme`, and a component that reads it during render is a
 * component that can throw on one branch and not the other.
 *
 * Hydration is checked on `/login` specifically, folded in from the test that
 * used to guard the shutter. It is the route where the server's document and
 * the reader's differ most — the passkey affordance is a client-only fact
 * (`PasskeyDivider` in src/routes/(auth)/login.tsx resolves
 * `window.PublicKeyCredential` in an effect) — so a `settle()` that stopped
 * waiting for hydration shows up here first.
 */
/**
 * A walk is one test over many documents, and each document is a whole settle.
 *
 * The shape this file replaced was one `test()` per route per theme, so every
 * document had Playwright's 30 s to itself; a journey that visits fourteen of
 * them needs fourteen documents' worth of budget. It is a ceiling and not an
 * expectation - a settle costs two to four seconds on a warm dev server, and
 * nothing waits for this number when the routes behave. The slack is for the
 * first route of a cold run, which pays for Vite's compile as well as its own.
 */
const WALK_TIMEOUT_MS = 180_000

test('a stranger reaches every public screen', async ({ context, page }) => {
  test.setTimeout(WALK_TIMEOUT_MS)
  for (const theme of THEMES) {
    for (const route of PUBLIC_ROUTES) {
      await walk(context, route, theme)
    }
  }

  const login = PUBLIC_ROUTES.find((candidate) => candidate.name === 'login')
  expect(
    login,
    'the login route is what hydration is asserted on',
  ).toBeDefined()
  if (login === undefined) return
  await visit(page, login, 'light')
  const state = await readCaptureState(page, login)
  expect(
    state.hydrated,
    'settle() must end on the hydrated document, or every journey races the client',
  ).toBe(true)
  expect(
    state.devChromeShown,
    'the dev toolbar must be hidden — on a phone it sits over the tab bar and takes presses meant for it',
  ).toBe(false)
})

/**
 * The forgot-password "sent" state keeps both of its actions inside the card.
 *
 * Geometry a real layout engine decides: `Button` is `shrink-0` and `block`
 * makes it `w-full`, so two of them in a row each claim the whole row and the
 * second is pushed out of the panel (#598). Only a desktop-width viewport shows
 * it - below `sm` the column hid the defect - and jsdom computes no boxes.
 *
 * One submit per attempt, deliberately: `/request-password-reset` allows five
 * a client in 300 s (`src/server/auth/index.ts`), and a sixth answers "Too many
 * attempts" instead of the sent state this test waits for. The address is one
 * no account owns: the endpoint answers identically, and no token or mail is made.
 */
test('the reset-link actions stack inside the panel', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the overflow only existed at the `sm` breakpoint and up')
  const route = PUBLIC_ROUTES.find(
    (candidate) => candidate.name === 'forgot-password',
  )
  if (route === undefined) throw new Error('forgot-password is a public route')
  await visit(page, route, 'light')
  await page.locator('input[type="email"]').fill('nobody-598@example.com')
  await page.getByRole('button', { name: 'Email me a reset link' }).click()

  const resend = page.getByRole('button', { name: 'Send it again' })
  const change = page.getByRole('button', { name: 'Use a different email' })
  await expect(
    change,
    'the sent state never arrived - rate limited? /request-password-reset allows five per 300 s',
  ).toBeVisible()
  await expect(resend).toBeVisible()
  const panel = await page.locator('[data-part="auth-panel"]').boundingBox()
  const first = await resend.boundingBox()
  const second = await change.boundingBox()
  if (panel === null || first === null || second === null) {
    throw new Error('the panel and both actions must have drawn')
  }
  for (const box of [first, second]) {
    expect(box.x).toBeGreaterThanOrEqual(panel.x)
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width)
  }
  expect(
    second.y,
    '"Use a different email" sits below "Send it again"',
  ).toBeGreaterThanOrEqual(first.y + first.height)
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
 * the sandcastle loop on something no change to the product can fix.
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
   * Journey 2: a member reaches every screen behind the session.
   *
   * The same shape as journey 1 and a different claim. A public route needs a
   * router and a renderer; these need a session cookie to survive the hop, the
   * tenant scope to resolve to the demo workspace, and the server's markup to
   * agree with the client's about rows that were selected by a query. Any of
   * the three failing produces a screen that is blank, wrong, or a redirect to
   * `/login` — and `visit()` refuses the redirect's status, `settle()` refuses
   * the blank, and the console refuses the mismatch.
   */
  test('a member reaches every screen behind the session', async ({
    context,
  }) => {
    test.setTimeout(WALK_TIMEOUT_MS)
    for (const theme of THEMES) {
      for (const route of APP_ROUTES) {
        await walk(context, route, theme)
      }
    }
  })

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

  /**
   * What an atlas journey is allowed to take.
   *
   * These are the same shape as the walks above and not the shape Playwright's
   * per-test default is sized for: an atlas journey settles one or two `/atlas`
   * documents with a live WebGL map to finish drawing, and then flies the camera
   * once per country it opens. `chooseCountry()` waits for the camera and its
   * anchored panel to stop moving before the journey probes their boxes.
   * Playwright's 30 s is one document's budget, which is what `WALK_TIMEOUT_MS`
   * above records for the walks and what `trips-core.spec.ts` records at its own
   * `test.setTimeout(90_000)` for the same reason.
   *
   * Measured rather than guessed, at Playwright's default worker count on a
   * loaded machine (half the cores, so eight here): 39.8 s for `the click
   * surface never takes the reader's input`, 29.0 s for `the click surface
   * survives its country leaving the map` and 27.1 s for `a country opens on the
   * map and can be acted on`, against the 30 s they were all sharing. The first
   * of those was already failing about one run in three at two workers with a
   * bare `Test timeout of 30000ms exceeded` and no assertion behind it (issue
   * #384); the other two passed with one and three seconds to spare, which is
   * the same defect that has not been unlucky yet. At one worker they take
   * 6.6-11.3 s, so what the budget absorbs is contention, not work.
   *
   * The phone journey below carries it too, on the argument and not on a
   * measurement: the validation gate runs `--project=chromium`, so it is skipped
   * there and only a full `pnpm e2e` reaches it - on WebKit, doing the same work
   * on a slower engine. Giving it the block's budget is cheaper than waiting for
   * it to be the one that fails.
   *
   * A ceiling, not an expectation - nothing here waits for this number, and a
   * genuinely hung journey still fails, a minute later. Raised for the journeys
   * that need it rather than for the suite, because a suite-wide raise would
   * hide a slow-page regression on every other screen.
   *
   * What it costs, plainly: an `/atlas` that regressed from 11 s to a minute now
   * passes here where the 30 s default would have failed it. That is the trade,
   * and it is worth making only because the failure being traded away carried no
   * information - a bare timeout on a page the snapshot shows fully rendered,
   * indistinguishable from the machine being busy. A regression of that shape on
   * this route is for a measurement to catch, not for a budget four journeys
   * happen to share.
   */
  const ATLAS_JOURNEY_TIMEOUT_MS = 90_000

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
    await restingCamera(page, () => null)
    await expect
      .poll(
        () =>
          page
            .locator('[data-part="country-panel"]')
            .evaluate(async (panel) => {
              const box = () => {
                const { x, y, width, height } = panel.getBoundingClientRect()
                return JSON.stringify({ x, y, width, height })
              }
              const before = box()
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              )
              return box() === before
            }),
        { message: 'the country panel has to stop tracking the camera flight' },
      )
      .toBe(true)
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

  /**
   * Journey 4: a country opens on the map, and the reader can act on it.
   *
   * Both surfaces the map answers with, in one journey, because both are states
   * of one gesture and neither survives a screenshot: a panel that opens on a
   * press, and a card that is gone the moment the pointer leaves.
   *
   * Where the surfaces *land* is not asserted here. `placeCountrySurface()`,
   * `surfaceAreas()` and `chromeFreeAreas()` decide that, and they are asserted
   * against directly in `src/components/atlas/__tests__/country-overlay.test.tsx`
   * over a grid of anchors no live map could be steered onto. What a browser is
   * the only place to answer is upstream of all of it: whether a `mousemove` over
   * a WebGL canvas produces a feature at all, whether a press opens a real dialog,
   * and where focus goes when it does.
   *
   * Focus order is the half that had shipped wrong twice. Radix's default is the
   * first tab stop, which for a country already on the record is the undo of
   * somebody's travel history under the space bar; moving focus to the dismissal
   * instead traded that for the dismissal being last in the panel, so the very
   * first Tab left it and the two writes this surface exists for were reachable
   * only backwards.
   */
  test('a country opens on the map and can be acted on', async ({ page }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    test.setTimeout(ATLAS_JOURNEY_TIMEOUT_MS)
    const watched = watchConsole(page, ATLAS)
    await visit(page, ATLAS, 'dark')
    await chooseCountry(page, 'France')

    const panel = page.getByRole('dialog', { name: 'France' })
    await expect(
      panel,
      'the surface is a real dialog with the country as its name',
    ).toBeVisible()
    // The same figures the hover card carries, and the two writes it does not.
    //
    // France is on the demo record with three visits and no itinerary behind
    // them, which is the state most of the fixture is in: the card reads the
    // visits, and the panel that used to print `Trips 0` beside an action block
    // saying `3 visits` now agrees with it.
    const facts = panel.locator('article[data-country="FR"]')
    await expect(
      facts,
      'a country the map fills reads from the record it was filled from',
    ).toHaveAttribute('data-record', 'visits')
    await expect(facts).toHaveAttribute('data-visited', 'true')
    await expect(panel).toContainText('Visits')
    await expect(panel).toContainText('Workspace places')
    expect(
      await facts.locator('dd').allInnerTexts(),
      'and prints every one of its four figures rather than an absence',
    ).not.toContain('—')
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

    // And the other surface the same map answers with, which only exists
    // while somebody is pointing at it. The panel is dismissed first: a hover
    // card for the country the panel is already about would be the same
    // country said twice.
    //
    // Spain rather than France for the probe: `countryBounds()` is solved over
    // the sovereign cut, so framing France centres the camera between
    // Guadeloupe and Réunion and the middle of the map is the Sahara. Spain's
    // rectangle is one peninsula and the Canaries, and the camera lands on the
    // peninsula — which is what makes "there is land in the middle of the clear
    // map" a fact rather than a hope.
    await chooseCountry(page, 'Spain')
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
    // both months; a country that is not gets its name and nothing else.
    // Whichever the ring found, a card carrying *some* of the grid would be a
    // reader told half a story, so the coherence is what is asserted rather than
    // a country hard-coded here that a fixture change could quietly retire.
    const shown = await page.evaluate(() => {
      const surface = document.querySelector('[data-part="country-hover"]')
      const article = surface?.querySelector('article') ?? null
      return {
        record: article?.getAttribute('data-record') ?? null,
        labels: [...(surface?.querySelectorAll('dt') ?? [])].map((node) =>
          node.textContent.trim(),
        ),
        values: [...(surface?.querySelectorAll('dd') ?? [])].map((node) =>
          node.textContent.trim(),
        ),
        words: (surface?.textContent ?? '').replace(/\s+/g, ' ').trim().length,
        // Rendered geometry, which `textContent` cannot see: a label cut down
        // to its head noun still reads in full to every string above.
        clipped: [...(surface?.querySelectorAll('dt, dt *') ?? [])]
          .filter((node) => node.scrollWidth > node.clientWidth)
          .map((node) => node.textContent.trim()),
      }
    })
    // Which quartet of headings belongs to which record. Most of the demo
    // fixture is countries somebody marked with no trip planned behind them, so
    // the visit reading is the common one and the trip reading is the exception
    // — pinning either alone would assert against the fixture rather than
    // against the card.
    //
    // The trip and place headings carry the workspace qualifier (`ADD-06`): the
    // card counts the workspace's trips and places while the stat tiles above
    // the map count the reader's, and the figures disagree by design. A bare
    // `Trips?` or `Places?` here would fail against the shipped card, so each is
    // spelled as the card spells it.
    const headings = {
      trips: [
        /^Workspace trips?$/,
        /^Workspace places?$/,
        /^First trip$/,
        /^Last trip$/,
      ],
      visits: [
        /^Visits?$/,
        /^Workspace places?$/,
        /^First visit$/,
        /^Last visit$/,
      ],
      none: [
        /^Workspace trips?$/,
        /^Workspace places?$/,
        /^First trip$/,
        /^Last trip$/,
      ],
    } as const
    if (shown.labels.length === 0) {
      expect(
        shown.words,
        'the pill is a country name and a flag, never a card with its numbers missing',
      ).toBeLessThan(40)
    } else {
      const record = shown.record
      expect(
        record,
        'the card has to say which of the three records it is speaking from',
      ).toMatch(/^(trips|visits|none)$/)
      if (record !== 'trips' && record !== 'visits' && record !== 'none') return
      expect(
        shown.labels,
        'the fact grid is all four fields, headed for the record it is reading',
      ).toEqual(headings[record].map((rule) => expect.stringMatching(rule)))
      expect(
        shown.clipped,
        'a heading wraps inside its cell; clipped, the trip heading loses its workspace qualifier',
      ).toEqual([])
      if (record !== 'none') {
        // The whole point of the visit reading, asserted on the running page:
        // a country the map has filled in prints what is known about it, not an
        // em dash under a heading and a nought beside it.
        expect(
          shown.values.join(' '),
          'a country on the record never prints an absence',
        ).not.toContain('—')
      }
    }

    expect(
      watched().fatal,
      'pointing at the map and opening its surface must not put anything in the console',
    ).toEqual([])
  })

  /**
   * Journey 7: a finger reaches the same facts, on a design that is not a
   * smaller copy of the desktop one.
   *
   * This walk is the whole reason the `mobile-safari` project exists. Every
   * assertion in it is a thing WebKit on a 393px handset answers differently from
   * Chromium at 1440x900, and none of them has a jsdom equivalent.
   *
   * It does not run on a pull request. `mobile-safari` was the larger half of every
   * e2e event and the half that ran out of wall clock (#552, #466), so it moved to
   * the nightly `.github/workflows/e2e-webkit.yml`. Nothing below changed — what
   * changed is that a regression in it surfaces within a day rather than within the
   * hour. Touching the map overlay, the panel placement or anything at phone width
   * is the case to run `pnpm e2e --project=mobile-safari` before opening the PR.
   *
   * 1. **`mousemove` does not exist on a finger**, and the browser's synthetic one
   *    arrives *after* the tap - which is exactly how a hover pill ends up
   *    stranded behind the panel the tap opened. The overlay stands hover down for
   *    as long as the last thing to touch the map was a finger.
   * 2. **The composition.** A 393px handset - the geometry is pinned in
   *    `playwright.config.ts` rather than inherited from the device descriptor, so
   *    these numbers cannot move under a playwright bump - leaves about 570 usable
   *    pixels of map, and a panel carrying the fact grid *and* both writes wants
   *    five hundred and forty of them. At full height no side of the country fits,
   *    so the placement used to fall through to being centred on the shape: four
   *    fifths of the map covered, no tip, and the country the reader had just
   *    pressed underneath the panel describing it. It gives up height instead -
   *    down to a floor that still carries the whole card and the first write - and
   *    takes an edge.
   * 3. **Squeezed means scrollable, and scrollable has to scroll.** A `max-height`
   *    alone leaves the surface indefinite, a percentage height inside an
   *    indefinite box resolves to `auto`, and the region grew to its content
   *    behind a parent that clips - so the second write sat in a strip no gesture
   *    could reach.
   * 4. **The tab bar stays reachable.** The shell's four destinations are a fixed
   *    bar at the bottom of a phone, and a full-height map surface is the obvious
   *    thing to cover them with. Hit-tested, for the same reason the shelf tabs
   *    are: what the reader cares about is whether a press arrives. It is also
   *    what holds the harness honest - the dev toolbar's own trigger is a
   *    `position: fixed` badge that sits over the "Trips" tab on this viewport,
   *    measured at 0,595 98x64, and `settle()` is what takes it out of the way.
   * 5. **The fold.** At 360x640, the smallest phone the design system claims, the
   *    action block genuinely does not fit. A fold is a designed answer only for
   *    as long as the reader can tell it from a card that stopped: the mask fade
   *    is the primitive's, and the bar is the part this surface decides. Our
   *    scroll bars are macOS-style overlays, quiet at rest because a pointer is
   *    about to arrive - and here no pointer ever will.
   */
  test('a finger reaches the same facts on a phone', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    test.skip(
      !isMobile,
      'this is the phone composition, and it needs a project with a touchscreen',
    )
    if (ATLAS === undefined) return
    test.setTimeout(ATLAS_JOURNEY_TIMEOUT_MS)
    const watched = watchConsole(page, ATLAS)
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
        // open — on the action block, which writes to the fixture.
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

    // Back to a country this suite can name, because the composition assertions
    // below read boxes and a tap lands wherever the coastline says it lands.
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
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

    const surface = await layer.boundingBox()
    expect(surface, 'the surface has to be placed').not.toBeNull()
    if (surface === null) return
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

    const shell = await page.evaluate(() => {
      const bar = document.querySelector('nav[aria-label="Sections"]')
      if (bar === null) return null
      return [...bar.querySelectorAll('a')].map((link) => {
        const box = link.getBoundingClientRect()
        const under = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        )
        return {
          name: link.textContent.replace(/\s+/g, ' ').trim(),
          pressable: under !== null && link.contains(under),
        }
      })
    })
    expect(
      shell,
      'the phone shell has to be showing its tab bar',
    ).not.toBeNull()
    expect(
      shell?.length,
      'and the bar has to carry destinations for this to assert anything',
    ).toBeGreaterThan(0)
    expect(
      shell?.filter((tab) => !tab.pressable).map((tab) => tab.name),
      'every destination in the tab bar stays reachable with the panel open',
    ).toEqual([])

    // The smallest phone the design system claims, where the block genuinely
    // does not fit and the fold has to say so.
    await page.setViewportSize({ width: 360, height: 640 })
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'Spain')
    await expect(
      page.locator('[data-part="country-surface"]').last(),
      'a 360x640 phone is exactly the viewport the panel gives up height on',
    ).toHaveAttribute('data-fit', 'squeezed')

    const fold = await page.evaluate(() => {
      const region = document.querySelector('[data-part="actions-scroll"]')
      if (region === null) return null
      const viewport = region.querySelector('[data-radix-scroll-area-viewport]')
      const bar = region.querySelector('[data-orientation="vertical"]')
      const thumb = bar?.firstElementChild ?? null
      if (viewport === null || bar === null || thumb === null) return null
      const style = getComputedStyle(bar)
      return {
        overflows: viewport.scrollHeight > viewport.clientHeight + 1,
        faded: getComputedStyle(region).maskImage !== 'none',
        barState: bar.getAttribute('data-state'),
        barOpacity: Number.parseFloat(style.opacity),
        thumb: thumb.getBoundingClientRect().width,
        thumbInk: getComputedStyle(thumb).backgroundColor,
        restingInk: getComputedStyle(document.documentElement)
          .getPropertyValue('--color-scrollbar-thumb')
          .trim(),
      }
    })
    expect(
      fold,
      'the action block has to be on screen to be judged',
    ).not.toBeNull()
    if (fold === null) return
    expect(
      fold.overflows,
      'this is the viewport where the block genuinely does not fit',
    ).toBe(true)
    expect(fold.faded, 'the fold is masked rather than sliced').toBe(true)
    expect(fold.barState, 'and the bar is drawn, not waiting for a hover').toBe(
      'visible',
    )
    expect(fold.barOpacity).toBe(1)
    expect(fold.thumb, 'with a thumb wide enough to see').toBeGreaterThan(0)
    expect(
      fold.thumbInk,
      'at the strength the primitive keeps for a pointer that is never coming',
    ).not.toBe(fold.restingInk)

    expect(
      watched().fatal,
      'the phone composition must not put anything in the console',
    ).toEqual([])
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
    test.setTimeout(ATLAS_JOURNEY_TIMEOUT_MS)
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
    const placed = await panel.boundingBox()
    expect(
      placed,
      'the surface has to be placed before it is dragged',
    ).not.toBeNull()
    if (placed === null) return

    /**
     * A horizontal lane in which both ends of the drag actually reach the map.
     *
     * Hit-tested rather than solved from the chrome's rectangles, and re-read
     * before every drag. The panel re-places itself as the camera moves, the
     * zoom cluster is a column and not the one button `chromeBoxes` can find,
     * and a lane solved once from either of those put the press on a control:
     * the drag then panned nothing and the country never left the map, which
     * fails this test at its own precondition rather than at its subject.
     */
    const from = canvas.x + canvas.width - 60
    const to = canvas.x + 60
    const laneNow = async (): Promise<number | null> =>
      page.evaluate(
        ([left, right]) => {
          const map = document.querySelector('.maplibregl-canvas')
          if (map === null) return null
          const box = map.getBoundingClientRect()
          for (let y = box.top + 40; y < box.bottom - 40; y += 16) {
            if (
              document.elementFromPoint(left, y) === map &&
              document.elementFromPoint(right, y) === map
            ) {
              return y
            }
          }
          return null
        },
        [to, from],
      )

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
      const lane = await laneNow()
      expect(lane, 'the map has to be draggable somewhere').not.toBeNull()
      if (lane === null) return
      await page.mouse.move(from, lane)
      await page.mouse.down()
      await page.mouse.move(to, lane, { steps: 12 })
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
   * Journey 6: the click surface never takes the reader's input from them.
   *
   * Four ways a non-modal surface stops being non-modal, folded into one walk
   * because they are one property and they broke one at a time. All four are
   * arbitration the browser performs and jsdom does not: which element a press
   * lands on, where a Tab goes next, and what the compositor is still drawing
   * while a layer leaves.
   *
   * 1. **The shelf keeps its tabs.** Two surfaces name the same selection - the
   *    panel on the map and the shelf's "Country" tab under it - and for as long
   *    as the panel preferred a whole placement over the shelf to a docked one
   *    above it, it landed flat across that tab strip. At 1440x900 a 674x275
   *    surface covered "Country" outright; at 1200x905 it took "Stats" too. Both
   *    were visible, neither could be pressed. Hit-tested rather than compared as
   *    rectangles: a tab can be covered by the panel, by its tip or by the layer
   *    it sits in, and all the reader cares about is whether a press arrives.
   * 2. **A dismissed surface stops being a target before it stops being visible.**
   *    The layer fades for 150ms, and for every one of those milliseconds the
   *    panel used to stay hit-testable - so a press arriving in that window landed
   *    on a control the reader could see leaving, and two of the controls under it
   *    rewrite the traveller's record. Sampled per animation frame, because the
   *    window is a handful of frames and one probe would be a race.
   * 3. **Tab leaves in both directions.** Radix renders dialog content inside a
   *    focus scope with `loop` hard-wired on, and that scope loops a press at
   *    either edge whether or not it is trapped - so the panel called itself
   *    non-modal and was a keyboard trap anyway.
   * 4. **Reduced motion still gets the focus move.** The panel asked for focus one
   *    style recalculation before its layer had been made visible, and with the
   *    entrance animation running that recalculation always landed first. The
   *    defect existed only for a reader with `prefers-reduced-motion: reduce`, and
   *    only that reader lost the keyboard route into what they had just opened.
   */
  test("the click surface never takes the reader's input", async ({ page }) => {
    test.skip(
      ATLAS === undefined,
      'the atlas route is what this asserts against',
    )
    if (ATLAS === undefined) return
    test.setTimeout(ATLAS_JOURNEY_TIMEOUT_MS)
    const watched = watchConsole(page, ATLAS)
    await visit(page, ATLAS, 'light')
    await chooseCountry(page, 'Spain')
    const spain = page.getByRole('dialog', { name: 'Spain' })
    await expect(spain).toBeVisible()

    const strip = await page.evaluate(() => {
      const tabs = [
        ...document.querySelectorAll('[data-part="atlas-shelf"] [role="tab"]'),
      ]
      return tabs.map((tab) => {
        const box = tab.getBoundingClientRect()
        const under = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        )
        return {
          name: tab.textContent.replace(/\s+/g, ' ').trim(),
          pressable: under !== null && tab.contains(under),
        }
      })
    })
    expect(
      strip.length,
      'the shelf has to be showing its tabs for this to be asserting anything',
    ).toBeGreaterThan(0)
    expect(
      strip.filter((tab) => !tab.pressable).map((tab) => tab.name),
      'every tab the shelf offers stays pressable with the panel open',
    ).toEqual([])

    // The exit, sampled from inside the page: the layer is asked every frame
    // whether a press at the middle of the panel still lands on the panel.
    const box = await spain.boundingBox()
    expect(
      box,
      'the surface has to be placed before it is pressed',
    ).not.toBeNull()
    if (box === null) return
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
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
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
    await expect(spain, 'and the exit finishes').toHaveCount(0)

    // Sequential focus navigation, which is the browser's and not the app's.
    await chooseCountry(page, 'France')
    const france = page.getByRole('dialog', { name: 'France' })
    await expect(france).toBeVisible()

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
      france,
      'and tabbing away is not a dismissal: the panel belongs to the selection',
    ).toBeVisible()

    const dismiss = france.getByRole('button', { name: 'Close France' })
    await dismiss.focus()
    expect(await leave('Shift+Tab'), 'and backwards out of it as well').toBe(
      true,
    )
    await expect(france).toBeVisible()

    await dismiss.focus()
    await expect(
      dismiss,
      'leaving the panel does not put its dismissal out of reach',
    ).toBeFocused()

    // Escape belongs to the topmost dismissable layer, and a keyboard reader
    // opens a tooltip on every icon control their focus passes over - the zoom
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
      france,
      'and it is the dismissible surface it was before the reader left it',
    ).toHaveCount(0)

    expect(
      watched().fatal,
      'none of that may put anything in the console',
    ).toEqual([])

    // And the same route in, for the reader who asked for less movement. A fresh
    // navigation, because the entrance this is about happens once per open and
    // the media query has to be in force before the layer is built.
    //
    // The console watch stops here rather than covering this last act. The
    // animation library writes an advisory the moment it sees the preference
    // ("You have Reduced Motion enabled on your device"), and WebKit reports a
    // `ResizeObserver` loop as a page error while the layer settles into a
    // geometry it did not animate into. Both are the emulation talking, not the
    // product, and a walk that folded them in would either fail on them or teach
    // the classifier to tolerate them everywhere - which is the wrong trade for a
    // state no reader's browser is in unless they asked for it.
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
})

/**
 * The two trip sections a route parameter keeps out of `APP_ROUTES`.
 *
 * `/trips/<id>/transports` and `/trips/<id>/book` are the surfaces the recovered
 * transport and booking work rebuilt, and both are addressed by an id the
 * database mints — so neither can sit in a static table, and until now no
 * journey rendered either of them at all.
 *
 * Two failure modes here belong to a browser and to nothing below it.
 *
 * **The document is composed twice.** Both timelines render weekdays, dates,
 * counts and money on the Worker and again in the browser, and workerd and
 * WebKit resolve `Intl` from different ICU builds. A disagreement is a
 * hydration error, and it is the reason `src/lib/format.ts` freezes its date
 * shapes in a table at all. This is the gate that proves the freeze holds on
 * the two screens leaning hardest on it — `trips-core.spec.ts` documents the
 * same divergence biting the costs tab from the other side.
 *
 * **A key that names no message renders as itself.** These screens moved onto
 * the message catalogue in the change that recovered them, and a mistyped key is
 * invisible to a unit test that asserts on keys. It is not invisible on a
 * screen: it arrives as `modules.transports.…` in the middle of a sentence,
 * which is exactly how five raw keys reached the colour picker earlier in the
 * same migration.
 */
const TRIP_SECTIONS = 'nav[aria-label="Trip sections"]'

/** The trips list, which is the one screen that links to a trip by its id. */
const TRIPS = APP_ROUTES.find((candidate) => candidate.name === 'trips')

/**
 * The id behind the first trip card, or a skip.
 *
 * Read off the card's own link rather than from a fixture, so the walk follows
 * the same address a reader would. A workspace with no trips leaves this block
 * nothing to render and says so. `titled` narrows it to the card carrying that title,
 * for a walk that needs one trip's content rather than any trip's chrome.
 */
async function aTripToWalk(page: Page, titled?: string): Promise<string> {
  if (TRIPS === undefined) throw new Error('APP_ROUTES has no trips entry')
  await visit(page, TRIPS, 'light')
  const tripId = await page.evaluate((title) => {
    for (const anchor of document.querySelectorAll('a[href^="/trips/"]')) {
      if (title !== undefined && !anchor.textContent.includes(title)) continue
      const match = /^\/trips\/([^/?#]+)\/plan$/.exec(
        anchor.getAttribute('href') ?? '',
      )
      if (match !== null) return match[1]
    }
    return null
  }, titled)
  test.skip(tripId === null, 'the workspace lists no trip to walk into')
  if (tripId === null) throw new Error('unreachable: the test was skipped')
  return tripId
}

test.describe('the trip sections behind a route parameter', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * Every message key the shipped catalogue can produce, as it would look if it
   * escaped unresolved. Read off the document's text rather than off a list of
   * the keys this change added, so a key any future change mistypes on these two
   * screens is caught by the same assertion.
   *
   * All eleven namespaces, not only `modules`: the timelines come from the
   * module components, but the page around them - headings, empty states, the
   * summary cards - is `trips`, and the shell above it is `shell`. A guard that
   * watched one namespace would have read the same screen and seen nothing.
   */
  async function rawMessageKeys(page: Page): Promise<Array<string>> {
    return page.evaluate(() => {
      const namespaces =
        'atlas|auth|console|costs|journal|marketing|modules|settings|shell|trips|ui'
      const text = document.body.innerText
      return [
        ...new Set(
          text.match(new RegExp(`\\b(?:${namespaces})\\.[a-z][\\w.]*`, 'gu')) ??
            [],
        ),
      ]
    })
  }

  for (const tab of ['transports', 'book'] as const) {
    test(`the ${tab} tab arrives composed the same way twice`, async ({
      page,
    }) => {
      const tripId = await aTripToWalk(page)
      const route: RouteCase = {
        name: `trip-${tab}`,
        path: `/trips/${tripId}/${tab}`,
        ready: TRIP_SECTIONS,
      }

      // Watched from before the navigation: a hydration mismatch is reported
      // while the document is being adopted, which is over before any assertion
      // below could run.
      const report = watchConsole(page, route)
      await visit(page, route, 'light')

      await expect(
        page.locator(`${TRIP_SECTIONS} a[aria-current="page"]`),
      ).toHaveAttribute('href', route.path)

      const keys = await rawMessageKeys(page)
      expect(keys, `unresolved message keys on ${route.path}`).toEqual([])

      const verdict = report()
      expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
    })
  }

  /**
   * The planner's day is one sequence, and a journey is the third thing in it.
   *
   * Graded in a browser because this is the only layer where the whole path is real:
   * three server functions inside one loader, the arrangement merged on the client, and
   * a `SortableContext` deciding which `<li>` a day's list actually holds. The
   * arithmetic is graded by unit tests, and the failure left for here is the one they
   * cannot produce — a journey rendered into a list of its own, beside the day rather
   * than inside it, which is exactly what a reader would see if the model and the
   * arrangement ever disagreed about what a day contains.
   *
   * Run at both viewports, because the day list is one element rendered in two places:
   * `plan-screen.tsx` puts `itinerary` in a `lg:` rail on a desktop and in the bottom
   * sheet the "Days" button opens on a phone, and below `lg` the rail is not rendered at
   * all. Opening the sheet is what makes the same assertion reachable on WebKit at 393px,
   * rather than leaving the phone composition of this feature ungraded.
   */
  test('a day draws its journeys inside its own sequence', async ({
    page,
    isMobile,
  }) => {
    // The flagship trip, by the title a reader sees: it is the one the seed gives journeys
    // and notes on the same days, and the first card in the list carries neither.
    const tripId = await aTripToWalk(page, 'Tokyo & Kyoto')
    const route: RouteCase = {
      name: 'trip-plan',
      path: `/trips/${tripId}/plan`,
      ready: TRIP_SECTIONS,
      map: true,
    }

    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    if (isMobile) {
      await page.getByRole('button', { name: 'Days' }).click()
    }

    const journeys = page.locator('[data-part="planner-transport-row"]')
    await expect(
      journeys.first(),
      'the flagship trip draws no journey on any of its days',
    ).toBeVisible()

    // Siblings of the day's stops and notes, under the one list the day renders — the
    // board would be lying about "one day, one number line" if they sat anywhere else.
    // The seeded trips give at least one day all three kinds, which is the case under test.
    const days = await journeys.evaluateAll((rows) =>
      rows.map((row) => {
        const siblings = [...(row.parentElement?.children ?? [])]
        return {
          listed: siblings.every((child) => child.tagName === 'LI'),
          stop: siblings.some((child) => {
            const itemId = child.getAttribute('data-planner-item')
            return itemId !== null && !itemId.startsWith('leg:')
          }),
          note: siblings.some((child) =>
            child.hasAttribute('data-planner-note'),
          ),
        }
      }),
    )
    expect(
      days.every((day) => day.listed),
      'a journey row was drawn outside a day list',
    ).toBe(true)
    const full = days.findIndex((day) => day.stop && day.note)
    expect(
      full,
      'no day holds a stop, a note and a journey in its one sequence',
    ).toBeGreaterThanOrEqual(0)
    const first = journeys.nth(full)

    // Said in words, because the grip is the whole of a journey's keyboard affordance
    // and an unnamed one is a handle a screen reader announces as nothing at all.
    const named = first.locator('button[aria-label], [role="img"][aria-label]')
    expect(await named.count()).toBeGreaterThan(0)
    for (const label of await named.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label') ?? ''),
    )) {
      expect(label.trim(), 'a journey row carries an empty name').not.toBe('')
    }

    const keys = await rawMessageKeys(page)
    expect(keys, `unresolved message keys on ${route.path}`).toEqual([])

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /** Picks a day in one of the stay dialog's two day selects, by the day's number. */
  async function chooseDay(
    page: Page,
    part: string,
    dayNumber: number,
  ): Promise<void> {
    await page
      .getByRole('dialog')
      .locator(`[data-part="${part}"] button`)
      .click()
    await page
      .getByRole('option', {
        name: new RegExp(`^Day ${dayNumber}(?!\\d)`, 'u'),
      })
      .click()
  }

  /**
   * A stay is chosen as the days it runs between, and the dialog says how many nights that is.
   *
   * Graded in a browser because the count is the answer to two Radix selects the reader drives, and
   * only a real pointer proves the answer follows them: the arithmetic itself is `stayNights`'s,
   * graded by vitest. Nothing is saved — the block reads the demo trip and leaves it as it found it.
   */
  test('a stay states the nights between the days it is given', async ({
    page,
  }) => {
    // The flagship trip is the seeded one long enough to hold a stay from day 1 to day 4.
    const tripId = await aTripToWalk(page, 'Tokyo & Kyoto')
    const route: RouteCase = {
      name: 'trip-book',
      path: `/trips/${tripId}/book`,
      ready: TRIP_SECTIONS,
    }

    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    await page.locator('[data-part="new-booking"]').first().click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('[data-part="type-accommodation"]').click()

    await chooseDay(page, 'stay-check-in-day', 1)
    await chooseDay(page, 'stay-check-out-day', 4)

    const nights = dialog.locator('[data-part="stay-nights"]')
    await expect(nights).toHaveText(/^3 nights · Day 1\b.* to Day 4\b/u)
    await expect(nights).toHaveCSS('font-variant-numeric', 'tabular-nums')
    // A stay is dated by its days; a typed date beside them would be a second answer.
    await expect(dialog.locator('input[type="date"]')).toHaveCount(0)

    const keys = await rawMessageKeys(page)
    expect(keys, `unresolved message keys on ${route.path}`).toEqual([])

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * A stay booked from a day of the plan comes back as that run of days' header facts.
   *
   * Graded in a browser because the whole loop is only real here: the day's own control opens the
   * desk's dialog with that day already the first night, the save goes through `createStayFn`, and
   * the board's loader re-reads the nights. The header rule itself is `stayFactsOn`'s, graded by
   * vitest. The walk writes to the shared demo trip, so it sweeps what it wrote before and after —
   * the same way the import walk gives the fixture back.
   */
  test('a stay booked from a day of the plan heads every day it covers', async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(90_000)
    /**
     * In the stay's name, and in nothing the seed writes. The project is part of it because
     * both projects walk the same demo trip at once locally, and neither may sweep or count
     * the other's stay.
     */
    const STAY = `Stay walk (${test.info().project.name}): Harbour Inn`
    const tripId = await aTripToWalk(page, 'Tokyo & Kyoto')
    const plan: RouteCase = {
      name: 'trip-plan',
      path: `/trips/${tripId}/plan`,
      ready: TRIP_SECTIONS,
      map: true,
    }
    const book: RouteCase = {
      name: 'trip-book',
      path: `/trips/${tripId}/book`,
      ready: TRIP_SECTIONS,
    }

    /** Removes every booking the walk wrote, and its nights with it. */
    async function sweep(): Promise<void> {
      await visit(page, book, 'light')
      const cards = page
        .locator('article')
        .filter({ has: page.locator('h4', { hasText: STAY }) })
      for (
        let left = await cards.count();
        left > 0;
        left = await cards.count()
      ) {
        await cards
          .first()
          .getByRole('button', { name: /^Actions for / })
          .click()
        await page
          .getByRole('menuitem', { name: 'Remove booking and stay' })
          .click()
        await page
          .getByRole('dialog', { name: /^Remove / })
          .getByRole('button', { name: 'Remove booking and stay' })
          .click()
        await expect.poll(async () => cards.count()).toBeLessThan(left)
      }
    }

    await sweep()

    const report = watchConsole(page, plan)
    await visit(page, plan, 'light')
    if (isMobile) {
      await page.getByRole('button', { name: 'Days' }).click()
    }

    await page
      .getByRole('button', { name: /^Add a stay for / })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.locator('[data-part="stay-check-in-day"] [role="combobox"]'),
      'the day the dialog was opened from is the first night',
    ).toHaveText(/^Day 1\b/u)
    await dialog.getByRole('textbox', { name: /^Name/u }).fill(STAY)
    await chooseDay(page, 'stay-check-out-day', 3)
    await dialog.getByRole('button', { name: 'Add booking' }).click()
    await expect(dialog).toBeHidden()

    const facts = page
      .locator('[data-part="day-stay"]')
      .filter({ hasText: STAY })
    await expect(facts).toHaveCount(3)
    await expect(facts.nth(0)).toContainText('Check in')
    await expect(facts.nth(0)).not.toContainText('Check out')
    await expect(facts.nth(1)).toHaveText(STAY)
    await expect(facts.nth(2)).toContainText('Check out')
    await expect(facts.nth(2)).not.toContainText('Check in')

    const keys = await rawMessageKeys(page)
    expect(keys, `unresolved message keys on ${plan.path}`).toEqual([])

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])

    await sweep()
  })
})

/**
 * The message a helper failed with, or null when it did not fail.
 *
 * Several of the harness's own mechanisms exist in order to *fail* — a map that
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
 * The harness's own mechanics.
 *
 * These drive the settle path against a document built for the purpose, rather
 * than against the product. A mistake in any of them is invisible in a green run
 * - a map wait that never waits, a console watch that grades nothing - which is
 * the only reason they are asserted rather than reviewed.
 */
/**
 * The platform console.
 *
 * Its own block rather than three more entries in `APP_ROUTES`, for the reasons written on
 * `CONSOLE_ROUTES`: the account screen's path is minted by the database, and the whole tree is
 * behind a platform role rather than merely behind a session. That second fact is why the skip below
 * is measured by loading `/console` and reading the URL the browser ended on. A `user`-role session
 * is redirected to `/dashboard`, and a suite that captured that would commit a photograph of the
 * dashboard under the name `console-light-chromium.png` — a baseline that holds forever and proves
 * the opposite of what its name says. `node scripts/seed/seed.mjs` is what provisions the role.
 */
test.describe('platform console', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
    test.skip(
      !(await hasPlatformConsole(page)),
      `${DEMO_EMAIL} holds no platform role, so /console redirects — run \`node scripts/seed/seed.mjs\` to provision it`,
    )
  })

  /**
   * Journey 8: the operator console is closed by role and reachable with it.
   *
   * The account screen is included by asking the accounts list for a row's own
   * path rather than by writing one down: the path is minted by the database,
   * so a hard-coded one would be a fixture assertion wearing a route's clothes.
   *
   * The gate on this whole block is the `beforeEach` above, and it is the point
   * of the journey as much as the walk is. `hasPlatformConsole()` loads
   * `/console` and reads the URL the browser ended on, so a session without the
   * role skips here rather than quietly walking a redirect to `/dashboard` and
   * calling it a console.
   */
  test('an operator reaches every console screen', async ({
    context,
    page,
  }) => {
    test.setTimeout(WALK_TIMEOUT_MS)
    for (const theme of THEMES) {
      for (const route of CONSOLE_ROUTES) {
        await walk(context, route, theme)
      }
    }

    const path = await consoleAccountPath(page)
    expect(
      path,
      `the accounts list has no row for ${CONSOLE_ACCOUNT_NAME} — the demo fixture has changed`,
    ).not.toBeNull()
    if (path === null) return
    await walk(context, { name: 'console-user', path, ready: 'main' }, 'light')
  })
})

/**
 * The impersonation warning bar, and the door it must keep shut.
 *
 * There was no coverage here because there was no fixture:
 * `/admin/impersonate-user` answers `404` (docs/ACCESS.md §2.6), so nothing
 * outside the platform console can mint the session. The console can, so this
 * drives it — and every test below ends by handing the session back, in a
 * `finally`, because a run that left one impersonated would poison every
 * worker that reused the cookie jar after it.
 */
test.describe('the impersonation warning bar', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * Journey 9: the acting operator is told, at the width the copy is worst at.
   *
   * `docs/ACCESS.md` §6.1 makes this the one piece of chrome that may never be
   * missing, never dismissed and never covered. The bar's copy degrades by
   * breakpoint — the operator's name, the acted-on address and the "Ends in"
   * label each have their own — so it is driven at 360px, the narrowest width
   * the product claims to support, which neither project's viewport visits.
   *
   * Chromium only, and at one width rather than the four frames this used to
   * record: what is asserted is that the three statements survive the narrowest
   * layout, and that is a claim about the copy, not about two engines.
   */
  test('an acting operator is told whose session this is', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'driven once at an explicit width rather than once per project viewport',
    )
    await applyTheme(page, 'light')
    await page.clock.setFixedTime(new Date(FROZEN_NOW))
    await page.setViewportSize({ width: 360, height: 900 })

    const started = await beginImpersonation(page)
    test.skip(
      !started,
      `${DEMO_EMAIL} holds no platform role, so impersonation cannot be started — run \`node scripts/seed/seed.mjs\``,
    )

    try {
      const bar = page.locator(IMPERSONATION_BAR)
      await expect(bar).toBeVisible()
      // §6.1 in three assertions: it says whose session this is, who is acting,
      // and offers the way out — at the width the copy's own breakpoints could
      // lose one of them.
      await expect(bar).toContainText(IMPERSONATION_TARGET_NAME)
      await expect(bar).toContainText('Rafal Wolak')
      await expect(
        bar.getByRole('button', { name: 'End impersonation' }),
      ).toBeEnabled()
    } finally {
      await endImpersonationFixture(page)
    }
  })

  test('the console is closed to an impersonated session', async ({ page }) => {
    const started = await beginImpersonation(page)
    test.skip(
      !started,
      `${DEMO_EMAIL} holds no platform role — run \`node scripts/seed/seed.mjs\``,
    )
    try {
      // docs/ACCESS.md §6.4: `requirePermission` denies every statement in the dictionary while
      // `session.impersonatedBy` is set, so a console reachable in this state would be a page of
      // controls whose server functions all answer 403.
      //
      // Asked of the server rather than by navigating, for the reason written on
      // `hasPlatformConsole()`: the impersonated session has just been handed a client-side
      // navigation of its own, and a `goto` racing it reports "interrupted by another navigation"
      // instead of reporting the guard. The redirect is the guard's whole answer either way.
      expect(
        await hasPlatformConsole(page),
        'an impersonated session must not reach the platform console',
      ).toBe(false)
    } finally {
      await endImpersonationFixture(page)
    }
  })
})

test.describe('the harness itself', () => {
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
})

/**
 * Whether a request calls the named server function.
 *
 * The segment after `/_serverFn/` is the function's id, base64-encoded, and the
 * export's name is inside it. The id as a whole is a build artefact; the name is
 * the one handle on a call that survives a rebuild.
 */
function callsServerFn(url: URL, name: string): boolean {
  const id = url.pathname.split('/_serverFn/').at(1)
  if (id === undefined) return false
  return Buffer.from(decodeURIComponent(id), 'base64')
    .toString('utf8')
    .includes(name)
}

/**
 * 03-S7 — a confirmation file read into the booking desk.
 *
 * The one walk here that writes, and it goes through every seam a unit test
 * stubs: the real `uploadFile` over `XMLHttpRequest`, the local queue consumer
 * draining a real envelope into KV, the bounded poll, and the confirm writing
 * into D1. It ends on the desk, because "the rows arrived carrying the
 * unchecked-import marker" is a statement about the screen, not about a
 * function's return value.
 *
 * The demo workspace is a shared fixture, so everything this block writes is
 * swept away before the walk and after it, and a run that died half way costs
 * the next run nothing: every booking carries {@link IMPORT_MARKER} in its
 * title, and every file it uploads is named for {@link UPLOADED}.
 */
test.describe('a confirmation file read into the booking desk', () => {
  /** In every title the fixture calendar carries, and in nothing the seed writes. */
  const IMPORT_MARKER = 'Import walk'

  /** The stem every file this block uploads is named with, and the seed none. */
  const UPLOADED = 'import-walk'

  /** None reads as a lodging: a lodging row would reach the geocoder on confirm. */
  const EVENTS = [
    {
      uid: 'harbour-tour',
      title: `${IMPORT_MARKER}: harbour tour`,
      start: '20260304T090000Z',
      end: '20260304T110000Z',
    },
    {
      uid: 'cooking-class',
      title: `${IMPORT_MARKER}: cooking class`,
      start: '20260305T170000Z',
      end: '20260305T200000Z',
    },
    {
      uid: 'museum-entry',
      title: `${IMPORT_MARKER}: museum entry`,
      start: '20260306T100000Z',
      end: '20260306T120000Z',
    },
  ] as const

  /** The row the walk unticks before confirming. */
  const PRUNED = EVENTS[1]

  const CALENDAR = Buffer.from(
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//planned.travel//e2e//EN',
      ...EVENTS.flatMap((event) => [
        'BEGIN:VEVENT',
        `UID:${event.uid}@e2e.planned.travel`,
        `SUMMARY:${event.title}`,
        `DTSTART:${event.start}`,
        `DTEND:${event.end}`,
        'END:VEVENT',
      ]),
      'END:VCALENDAR',
    ].join('\r\n'),
  )

  const bookRoute = (tripId: string): RouteCase => ({
    name: 'trip-book-import',
    path: `/trips/${tripId}/book`,
    ready: TRIP_SECTIONS,
  })

  /** Where {@link sweepFiles} goes to take back what the walk uploaded. */
  const filesRoute = (tripId: string): RouteCase => ({
    name: 'trip-files-import',
    path: `/trips/${tripId}/files`,
    ready: TRIP_SECTIONS,
  })

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  async function openImport(page: Page) {
    await page.locator('[data-part="import-bookings"]').click()
    const dialog = page.getByRole('dialog', {
      name: 'Import bookings from a file',
    })
    await expect(dialog).toBeVisible()
    return dialog
  }

  function importedCards(page: Page) {
    return page
      .locator('article')
      .filter({ has: page.locator('h4', { hasText: IMPORT_MARKER }) })
  }

  /**
   * Removes every booking carrying the marker, however many there are.
   *
   * Addressed through the first card each time rather than by title, because a
   * run that died after confirming leaves two cards of the same name behind.
   *
   * The count is re-read each pass and the assertion is "fewer than before",
   * rather than counting down from a number taken once. A count read while the
   * list is still settling after the removal's invalidation can be one higher
   * than the list ever returns to, and `toHaveCount(left - 1)` then waits out
   * its timeout for a number that will never arrive — which is what made this
   * walk fail about one run in three. Nothing is weakened: the loop still ends
   * only at zero, and every pass must take at least one item away.
   */
  async function sweep(page: Page): Promise<void> {
    const cards = importedCards(page)
    for (let left = await cards.count(); left > 0; left = await cards.count()) {
      await cards
        .first()
        .getByRole('button', { name: /^Actions for / })
        .click()
      await page.getByRole('menuitem', { name: 'Remove booking' }).click()
      await page
        .getByRole('dialog', { name: /^Remove / })
        .getByRole('button', { name: 'Remove booking' })
        .click()
      await expect.poll(async () => cards.count()).toBeLessThan(left)
    }
  }

  /**
   * Removes every file the walk uploaded, however many are left behind.
   *
   * {@link sweep} takes back the bookings, but the file is a second thing this
   * block writes and it outlives them: a confirmed import attaches its source to
   * the trip, and a refused one leaves the upload that was already stored before
   * the refusal — neither carries a `reservation_id`, so removing the bookings
   * does not remove them.
   *
   * They cannot be left there. `readTripForDelete` counts a trip's records as
   * `reservations + transports + expenses + files`, and `DELETE_CONFIRM_THRESHOLD`
   * puts `requiresTitle` on the far side of *any one* of them. So a file left on
   * this trip changes how a dialog **another** spec opens is allowed to behave —
   * `trips-core.spec.ts` walks the same leading trip and asks the delete dialog
   * how hard it asks. A walk that borrows the shared fixture gives it back.
   *
   * Counted the same way as {@link sweep}, for the same reason.
   */
  async function sweepFiles(page: Page, tripId: string): Promise<void> {
    await visit(page, filesRoute(tripId), 'light')
    const rows = page.getByRole('row').filter({ hasText: UPLOADED })
    for (let left = await rows.count(); left > 0; left = await rows.count()) {
      await rows
        .first()
        .getByRole('button', { name: /^Actions for / })
        .click()
      await page.getByRole('menuitem', { name: 'Remove file' }).click()
      await page
        .getByRole('dialog', { name: /^Remove / })
        .getByRole('button', { name: 'Remove file' })
        .click()
      await expect.poll(async () => rows.count()).toBeLessThan(left)
    }
  }

  test('a calendar is read, pruned and written to the desk as unchecked imports', async ({
    page,
  }) => {
    // An upload, a queue batch, a poll, a write and two sweeps, against a dev
    // server. A ceiling, not an expectation.
    test.setTimeout(120_000)

    const tripId = await aTripToWalk(page)
    const route = bookRoute(tripId)

    // Both leading sweeps run before the console watch opens, because clearing a
    // dead run's leavings is not part of what this walk is asked to prove — and
    // `sweepFiles` steps through the files route, whose relative timestamps
    // hydrate with a mismatch this block does not own.
    await visit(page, route, 'light')
    await sweep(page)
    // A run that died between the upload and the confirm leaves a file and no
    // booking, so the file sweep is not merely the mirror of the one above.
    await sweepFiles(page, tripId)

    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    const dialog = await openImport(page)
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'import-walk.ics',
      mimeType: 'text/calendar',
      buffer: CALENDAR,
    })

    // The consumer batches for up to five seconds and the poll asks every two,
    // so the list is well inside the poll's own twenty-second budget.
    const review = dialog.getByRole('group', { name: 'What we read' })
    await expect(review.getByRole('checkbox')).toHaveCount(EVENTS.length, {
      timeout: 30_000,
    })
    await expect(
      dialog.getByRole('button', { name: `Add ${EVENTS.length} bookings` }),
      'freshly read rows arrive selected',
    ).toBeEnabled()

    await review.getByRole('checkbox', { name: PRUNED.title }).click()
    const confirm = dialog.getByRole('button', {
      name: `Add ${EVENTS.length - 1} bookings`,
    })
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect(dialog).toBeHidden()
    await expect(
      page.getByText(`${EVENTS.length - 1} bookings added`),
    ).toBeVisible()

    const cards = importedCards(page)
    await expect(cards).toHaveCount(EVENTS.length - 1)
    await expect(
      cards.filter({ hasText: PRUNED.title }),
      'an unticked row must not reach the desk',
    ).toHaveCount(0)
    for (const card of await cards.all()) {
      await expect(card.locator('[data-part="import-marker"]')).toHaveText(
        'Unchecked import',
      )
    }

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])

    await sweep(page)
    await sweepFiles(page, tripId)
  })

  test('a file the import cannot read is refused by name, and nothing uploads', async ({
    page,
  }) => {
    const tripId = await aTripToWalk(page)
    const route = bookRoute(tripId)
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    const sent: Array<string> = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (
        callsServerFn(url, 'uploadTripFileFn') ||
        callsServerFn(url, 'startBookingImportFn')
      ) {
        sent.push(url.pathname)
      }
    })

    const dialog = await openImport(page)
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'voucher.pkpass',
      mimeType: 'application/vnd.apple.pkpass',
      buffer: Buffer.from('PK'),
    })

    await expect(
      dialog.getByText('“voucher.pkpass” is not a file this import can read', {
        exact: false,
      }),
    ).toBeVisible()
    await expect(
      dialog.locator('[data-part="import-drop"]'),
      'a refusal leaves the drop target ready for another file',
    ).toBeEnabled()
    expect(sent, 'a refused file must never leave the machine').toEqual([])

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The ceiling, reached through a real refusal with only its code changed.
   *
   * The demo workspace is on a plan with an allowance and nothing can spend it
   * from a browser, so the refusal is not waited for — it is made. A document
   * job runs for real: upload, envelope, the meter spent, and the local
   * consumer refusing it, because `vite dev` has no model binding and a job
   * that cannot reach one stages a refusal. The poll's answer is then fetched
   * from the server as it is and fulfilled with the refusal's code read as
   * `ceiling`. Nothing about the payload's shape is written by hand: seroval
   * frames are not a format to forge, and a fabricated one deserialises to
   * `undefined` rather than failing.
   */
  test('a workspace past its reading allowance is told so in its own words', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    await page.route(
      (url) => callsServerFn(url, 'getBookingImportFn'),
      async (intercepted) => {
        const response = await intercepted.fetch()
        const body = (await response.text()).replace(
          /"(?:unknown|unreadable)"/gu,
          '"ceiling"',
        )
        await intercepted.fulfill({ response, body })
      },
    )

    const tripId = await aTripToWalk(page)
    const route = bookRoute(tripId)
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    const dialog = await openImport(page)
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'import-walk.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(`${EVENTS[0].title}, 4 March 2026 at 09:00.`),
    })

    await expect(
      dialog.getByText(
        'Reading a confirmation file is not part of this workspace’s plan',
      ),
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      dialog.getByRole('group', { name: 'What we read' }),
      'a refused job has nothing to review',
    ).toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])

    // A refused job keeps the shell's import card on every screen until it is
    // dismissed, and at phone width that fixed card sits over the files list's
    // row actions, so `sweepFiles` could not click them. Dismissed here, where
    // the refusal is known to have landed, rather than guessed at in the sweep.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    const widget = page.locator('[data-part="book-import-widget"]')
    await widget.getByRole('button', { name: 'Dismiss' }).click()
    await expect(widget).toBeHidden()

    // The refusal comes back after the upload has already been stored, so this
    // walk leaves a file behind even though it wrote no booking.
    await sweepFiles(page, tripId)
  })
})

/**
 * 640 - switching workspace from the account menu.
 *
 * The demo owner belongs to two workspaces (`ensureSecondWorkspace` in the seed): the first holds
 * the six demo trips, the second holds one of its own.
 *
 * The walk signs in again instead of using the cached session, and that is the whole reason this
 * block is not under `useSession`. The active workspace is a column on the *session row*, and the
 * cached cookie is one session shared by every worker, so a switch made with it would move every
 * other test in the run into the second workspace while it was still reading the first. A session of
 * its own is dropped with the context and leaves the fixture exactly where it found it.
 */
test.describe('switching workspace', () => {
  const FIRST = { name: "Rafal's Travel", trip: 'Lisbon, slowly' }
  const SECOND = { name: 'Wolak Family Trips', trip: 'Sopot, a family weekend' }

  /**
   * Asserted on the open menu and retried, not read once: the check moves when the router has
   * re-read the shell, which is the step after the navigation the URL assertion waits for.
   */
  async function expectActive(page: Page, workspace: string): Promise<void> {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await expect(
      page.getByRole('menuitemradio', { name: workspace }),
    ).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
  }

  async function switchTo(page: Page, workspace: string): Promise<void> {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitemradio', { name: workspace }).click()
    // The switch lands on the dashboard before it drops the cached loaders, so a detail route
    // belonging to the workspace just left is never re-run against the new one.
    await expect(page).toHaveURL(/\/dashboard$/)
    await expectActive(page, workspace)
  }

  test('a reader sees only the workspace they are in, and gets the first one back', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    await context.clearCookies()
    // Not a skip: this is the only browser proof that a switch follows the reader's data, and a
    // sign-in that failed (the rate limit, an unseeded database) must fail it, not report it green.
    expect(
      await signIn(page, baseURL),
      `${DEMO_EMAIL} could not sign in - run \`node scripts/seed/seed.mjs\``,
    ).toBe(true)
    if (TRIPS === undefined) throw new Error('APP_ROUTES has no trips entry')

    const firstTripId = await aTripToWalk(page, FIRST.trip)
    await expect(page.getByText(FIRST.trip).first()).toBeVisible()
    await expect(page.getByText(SECOND.trip)).toHaveCount(0)
    await expectActive(page, FIRST.name)

    // Switch from a trip's own page: invalidating there, before the dashboard, would re-run the
    // trip loader against the second workspace and show its error panel. Reached by clicking, not
    // `goto`: a press on the account menu before hydration opens nothing.
    await page.locator(`a[href="/trips/${firstTripId}/plan"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/trips/${firstTripId}/plan$`))
    await switchTo(page, SECOND.name)
    await expect(
      page.getByText(FIRST.trip),
      'the dashboard the switch lands on must not show the first workspace’s trips',
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'This trip did not load' }),
    ).toHaveCount(0)

    await visit(page, TRIPS, 'light')
    await expect(page.getByText(SECOND.trip).first()).toBeVisible()
    await expect(
      page.getByText(FIRST.trip),
      'the first workspace’s trips must not follow the reader into the second',
    ).toHaveCount(0)

    // The first workspace's trip, asked for by id while the second is active: the trip does not
    // load, and none of its data is on screen.
    await page.goto(`/trips/${firstTripId}/plan`)
    await expect(
      page.getByRole('heading', { name: 'This trip did not load' }),
    ).toBeVisible()
    await expect(page.getByText(FIRST.trip)).toHaveCount(0)

    await visit(page, TRIPS, 'light')
    await switchTo(page, FIRST.name)
    await expect(page.getByText(SECOND.trip)).toHaveCount(0)
    await visit(page, TRIPS, 'light')
    await expect(page.getByText(FIRST.trip).first()).toBeVisible()
    await expect(page.getByText(SECOND.trip)).toHaveCount(0)
  })

  async function openCreateDialog(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Create workspace' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Create a workspace' }),
    ).toBeVisible()
  }

  /**
   * The seed gives the first workspace a Crew subscription and the second none, so one demo account
   * walks both arms of the plan gate. Each arm signs in on its own for the reason given above the
   * block: creating a workspace activates it on the session row.
   *
   * The paid arm leaves a workspace behind (there is no way to delete one yet), and the account is
   * limited to twenty; a database seeded afresh per run, as the gate does, never gets near that.
   */
  test('a paid workspace creates another and lands in it empty', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    await context.clearCookies()
    expect(
      await signIn(page, baseURL),
      `${DEMO_EMAIL} could not sign in - run \`node scripts/seed/seed.mjs\``,
    ).toBe(true)
    if (TRIPS === undefined) throw new Error('APP_ROUTES has no trips entry')

    const created = `Created in e2e ${Date.now()}`
    // `networkidle`: a press on the account menu before hydration opens nothing.
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expectActive(page, FIRST.name)

    await openCreateDialog(page)
    await page.getByRole('textbox', { name: /Workspace name/ }).fill(created)
    await page
      .getByRole('dialog', { name: 'Create a workspace' })
      .getByRole('button', { name: 'Create workspace' })
      .click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expectActive(page, created)

    await visit(page, TRIPS, 'light')
    await expect(
      page.getByText(FIRST.trip),
      'a new workspace starts empty: the first one’s trips must not follow the reader in',
    ).toHaveCount(0)
    await expect(page.getByText(SECOND.trip)).toHaveCount(0)
  })

  test('a free workspace is shown the upgrade and gains no workspace', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    await context.clearCookies()
    expect(
      await signIn(page, baseURL),
      `${DEMO_EMAIL} could not sign in - run \`node scripts/seed/seed.mjs\``,
    ).toBe(true)

    // `networkidle`: a press on the account menu before hydration opens nothing.
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await switchTo(page, SECOND.name)

    await openCreateDialog(page)
    const dialog = page.getByRole('dialog', { name: 'Create a workspace' })
    await page
      .getByRole('textbox', { name: /Workspace name/ })
      .fill('Should not exist')
    await dialog.getByRole('button', { name: 'Create workspace' }).click()

    await expect(
      dialog.getByRole('alert'),
      'a refusal is explained in the dialog the reader is looking at',
    ).toContainText('part of a paid plan')
    await expect(
      dialog.getByRole('link', { name: 'Plan and billing' }),
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: /Workspace name/ }),
      'a refusal wrote nothing, so what was typed stays',
    ).toHaveValue('Should not exist')

    await page.keyboard.press('Escape')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account menu' }).click()
    // Waits for the list itself first, so the absence below is not read from a menu not yet open.
    // Counted by name, not by size: the paid journey creates a workspace on the same account.
    await expect(
      page.getByRole('menuitemradio', { name: SECOND.name }),
    ).toBeVisible()
    await expect(
      page.getByRole('menuitemradio', { name: 'Should not exist' }),
    ).toHaveCount(0)
    await page.keyboard.press('Escape')
  })
})
