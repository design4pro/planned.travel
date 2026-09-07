import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import { APP_ROUTES } from './helpers/routes.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'
import { MAP_READY_TIMEOUT_MS } from './helpers/settle.ts'

/**
 * `MAP-05` — the map style a member picks is the map they get.
 *
 * `/settings/appearance` has written `user_settings.map_style` since it shipped
 * and no map has ever read it, so the only way to fail this stage was to watch
 * the ground the canvas paints. That is what this file does: it proves the
 * column reaches a real style document, end to end, across a page load.
 *
 * It is deliberately **not** the guard for `styleKey()` in `map-canvas.tsx`, and
 * cannot be: every read below happens on a freshly opened document, so the map
 * is constructed with the right style and the swap effect never has to fire.
 * A mounted map handed a new preference is the seam `styleKey()` owns, and it is
 * covered where it is observable — `map-canvas.test.tsx`, "restyles a mounted map
 * when a pinned basemap is published" and the two cases beside it.
 *
 * Two claims, in the order they can be trusted in:
 *
 * 1. The picker publishes the catalogue **by id**. A selector that silently
 *    matches nothing would turn everything below into a test that asserts
 *    nothing, so it is checked first and on its own.
 * 2. Charcoal in the light theme paints the canvas dark while the chrome stays
 *    light, and `Follow the workspace` clears the override so the canvas comes
 *    back to the workspace's own cartography. One round trip rather than two
 *    tests, because each half is what stops the other from passing vacuously —
 *    see `readGround()`.
 */

/**
 * `/settings/appearance` is not in `APP_ROUTES`: that table is the walk every
 * journey covers, and this is one screen inside `/settings`. `/atlas` is taken
 * from the table rather than restated, because its `map: true` is what makes
 * `settle()` wait for the canvas to finish drawing before anything reads it.
 */
const APPEARANCE: RouteCase = {
  name: 'settings-appearance',
  path: '/settings/appearance',
  ready: 'main',
}

const ATLAS = APP_ROUTES.find((candidate) => candidate.name === 'atlas')

const OPTION = '[data-part="basemap-option"]'
/** The sentinel the write path reads as "clear my override". */
const FOLLOW_WORKSPACE = `${OPTION}[value=""]`
const CHARCOAL = `${OPTION}[value="planned-dark"]`

/**
 * Ceiling on a settings write, not an expectation of one.
 *
 * `pinDemoLanguage()` in `./helpers/session.ts` waits 15s on the same shape of
 * POST, and that is right for it: it runs in the `setup` project, alone. This
 * file runs inside the suite, where the dev server is answering several workers
 * at once and a write that takes 2s alone takes far longer. Fifteen seconds here
 * was tighter than the 120s the round trip is allowed overall, so the test failed
 * on the fixture's clock rather than on anything it asserts — measured at 15.1s
 * standalone against this 45s ceiling.
 */
const WRITE_TIMEOUT_MS = 45_000

/** What a sample of the drawing buffer says about the ground it painted. */
type CanvasSample = {
  /** Share of sampled pixels the canvas actually drew. */
  readonly opaque: number
  /** Share below the dark threshold — the ocean, on this camera. */
  readonly dark: number
  /** Share above the light threshold — the atlas's own choropleth over it. */
  readonly light: number
  /** Relative luminance of the page chrome, which is not the map. */
  readonly chrome: number
}

test.describe('MAP-05 — the basemap a member picks is the basemap they get', () => {
  /**
   * One project, and the reason is the fixture rather than the browser.
   *
   * `playwright.config.ts` records that parallel workers may share one D1 file
   * because the suite writes to it from exactly three places, all of them
   * outside the browser projects. This file is a fourth writer, and it writes
   * the *one* row both projects would be reading — two browsers toggling
   * `user_settings.map_style` for the same member at the same moment is a race
   * whose loser photographs the other's preference. Nothing here is
   * engine-specific to give up: the claim is that a column reaches a style
   * document, and the same document is built in both.
   */
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'this writes the member’s shared map-style row; two projects would race each other for it',
  )

  /**
   * Ordered, not parallel. The selector check has to be believed before the
   * round trip that depends on it is read, and the round trip owns a row that
   * only one test at a time may hold.
   */
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('the picker publishes every entry under its catalogue id', async ({
    page,
  }) => {
    await visit(page, APPEARANCE, 'light')

    // The one assertion the rest of this file rests on: `planned-dark` is
    // addressable by the id the column stores, exactly once.
    await expect(page.locator(CHARCOAL)).toHaveCount(1)

    // And the two the round trip drives it with. `''` is not a basemap — it is
    // the clear-my-override sentinel — so it is asserted separately rather than
    // assumed to be "one of the five".
    await expect(page.locator(FOLLOW_WORKSPACE)).toHaveCount(1)
    await expect(page.locator(OPTION)).toHaveCount(5)
  })

  test('Charcoal paints the canvas dark under a light chrome, and Follow the workspace gives the workspace’s cartography back', async ({
    context,
  }) => {
    /*
     * Four documents, two of them a live map, plus two writes that have to land
     * in D1 before the next document is opened. Playwright's flat 30 s is one
     * document's budget — the reasoning `WALK_TIMEOUT_MS` sets out in
     * `journeys.spec.ts` applies here for the same reason, at a quarter of the
     * distance.
     *
     * Measured, not guessed: this runs in ~15 s alone and went over 30 s only in
     * the full suite, where a second worker is loading MapLibre and its tiles at
     * the same time. A ceiling and not an expectation — nothing waits for this
     * number when the machine is quiet, and a preference that is never read
     * still fails on `expectGround`, not on the clock.
     */
    test.setTimeout(120_000)

    expect(ATLAS, 'the atlas route is what the canvas is read on').toBeDefined()
    if (ATLAS === undefined) return

    try {
      await onRoute(context, APPEARANCE, async (page) => {
        await chooseBasemap(page, CHARCOAL)
        await expect(page.locator(CHARCOAL)).toHaveAttribute(
          'data-state',
          'checked',
        )
      })

      await onRoute(context, ATLAS, async (page) => {
        await expectGround(page, 'dark')
        // The other half of the claim: the preference is the map's, not the
        // product's. A change that dragged the whole app dark with it would
        // satisfy every line above and fail this one.
        const { chrome } = await sampleCanvas(page)
        expect(
          chrome,
          'the chrome stays in the light theme while the map is charcoal',
        ).toBeGreaterThan(200)
      })

      await onRoute(context, APPEARANCE, async (page) => {
        // A fresh document, so this is the column answering rather than the
        // component remembering its own click.
        await expect(page.locator(CHARCOAL)).toHaveAttribute(
          'data-state',
          'checked',
        )
        await chooseBasemap(page, FOLLOW_WORKSPACE)
        await expect(page.locator(FOLLOW_WORKSPACE)).toHaveAttribute(
          'data-state',
          'checked',
        )
        // The defect this stage fixes, read where it is observable: the old
        // handler dropped `''` as `undefined`, so the press wrote nothing and
        // the member kept the id they already held. A reload that still showed
        // Charcoal checked would be that pinned snapshot.
        await page.reload()
        await expect(page.locator(FOLLOW_WORKSPACE)).toHaveAttribute(
          'data-state',
          'checked',
        )
      })

      // The workspace is on Paper, so the ground the same camera framed as
      // charcoal a moment ago is pale again. This is the observable consequence
      // of the override having been cleared, rather than the click having
      // happened.
      await onRoute(context, ATLAS, async (page) => {
        await expectGround(page, 'light')
      })
    } finally {
      // Best-effort: a teardown that throws would replace the assertion error
      // that actually failed the test, and the reader of a red run would see a
      // timeout in the fixture instead of "the ground never went dark". Annotated
      // rather than swallowed, because a clear that failed leaves the shared row
      // dirty for the next run and that is worth saying out loud.
      await clearOverride(context).catch((reason: unknown) => {
        test.info().annotations.push({
          type: 'teardown-failed',
          description: `map_style was not cleared: ${String(reason)}`,
        })
      })
    }
  })
})

/**
 * Open a route on its own page, grade its console, and hand the page to the
 * caller in between.
 *
 * One watcher per route, and the watcher is attached before the navigation it
 * grades — the discipline `watchConsole()` documents. It matters more here than
 * usual: `/atlas` declares a live map and so tolerates the software
 * rasteriser's driver advisory, `/settings/appearance` declares none and so
 * does not, and a single watcher over both would apply the wrong table to one
 * of them.
 */
async function onRoute(
  context: BrowserContext,
  route: RouteCase,
  act: (page: Page) => Promise<void>,
): Promise<void> {
  const page = await context.newPage()
  try {
    if (route.map === true) {
      await preserveDrawingBuffer(page)
    }
    const watched = watchConsole(page, route)
    await visit(page, route, 'light')
    await act(page)
    const output = watched()
    expect(
      output.fatal,
      `${route.path}: the console must be clean through this step`,
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
 * Hold until the basemap has painted the ground this entry paints, and say what
 * it painted instead when it never does.
 *
 * Polled rather than read once, and the race is in the readiness marker rather
 * than in the assertion. `data-map-ready` latches on MapLibre's first `idle`
 * and never unlatches, while the preference reaches the map through the app
 * shell's own hydration effect — so on a slow document `settle()` can return on
 * a canvas that has finished drawing `auto` a beat before the swap effect
 * restyles it. Waiting for the ground removes that beat; it does not soften
 * anything, because a preference that is never read never arrives and the poll
 * fails on the timeout with the ground it actually found.
 *
 * `MAP_READY_TIMEOUT_MS` is borrowed for the budget: this is the same question
 * `settle()` asks, one repaint later.
 */
async function expectGround(page: Page, ground: Ground): Promise<void> {
  await expect
    .poll(async () => readGround(await sampleCanvas(page)), {
      timeout: MAP_READY_TIMEOUT_MS,
      message: `the basemap has to settle on ${ground} ground`,
    })
    .toBe(ground)
}

/** The two grounds this journey tells apart. */
type Ground = 'dark' | 'light'

/**
 * Name what the canvas is showing, or why it is neither ground.
 *
 * Every rejection carries its numbers, so a failure reports what the map
 * actually painted rather than "expected dark, received light".
 *
 * The order matters. `opaque` comes first because a buffer that was never read
 * back is transparent black — every channel zero — which reads as dark ground
 * and would let "the canvas is dark" hold on any frame at all. `light` comes
 * next for the mirror image: the atlas paints its own choropleth over the
 * basemap and that land stays light under **both** entries, so a frame with no
 * light in it is a frame that drew nothing rather than a dark basemap.
 */
function readGround(sample: CanvasSample): string {
  const seen = `dark ${sample.dark.toFixed(2)} light ${sample.light.toFixed(2)}`
  if (sample.opaque < 1) {
    return `unread — only ${sample.opaque.toFixed(2)} of the buffer came back opaque`
  }
  if (sample.light < 0.15) {
    return `blank — the atlas’s choropleth is missing, so nothing was drawn over the basemap (${seen})`
  }
  if (sample.dark > 0.4) return 'dark'
  if (sample.dark < 0.05) return 'light'
  return `neither — ${seen}`
}

/**
 * Ask this page's WebGL contexts to keep what they drew.
 *
 * MapLibre creates its context with the default `preserveDrawingBuffer: false`,
 * which lets the compositor throw the buffer away the moment it has been shown.
 * Read afterwards — by `drawImage`, by `toDataURL`, by `readPixels` — such a
 * canvas answers with transparent black, and it answers that way whatever it
 * painted. Measured on this app before the flag was forced: both entries
 * reported `opaque: 0` and `dark: 1`, so a "the canvas is dark" assertion held
 * on Paper as firmly as on Charcoal.
 *
 * The hint changes what the driver may discard, never what is drawn, and it is
 * installed only on the routes whose canvas is read. `readGround()` rejects on
 * `opaque` first for the same reason: if this ever stops taking effect the
 * suite says so, instead of going quietly green on an empty buffer.
 */
async function preserveDrawingBuffer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type GetContext = (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) => unknown
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: GetContext
    }
    const original = proto.getContext
    proto.getContext = function (id, options) {
      const webgl = id === 'webgl' || id === 'webgl2'
      return original.call(
        this,
        id,
        webgl
          ? {
              ...(options as Record<string, unknown> | undefined),
              preserveDrawingBuffer: true,
            }
          : options,
      )
    }
  })
}

/**
 * What the basemap actually painted, classified rather than compared.
 *
 * The canvas itself is sampled, not a screenshot of it: the atlas floats a
 * search field, a zoom cluster, an attribution line and a 400px shelf over the
 * map, and every one of them is light chrome that would be counted as
 * cartography. Nearest-neighbour downscaling keeps the classification honest —
 * smoothing would turn a coastline into a band of midtones that is neither.
 *
 * Bands rather than a mean, because a mean cannot tell "the ground went dark"
 * from "the whole frame went dark", and on this screen only the first is the
 * preference working: the atlas paints its own choropleth over the basemap, so
 * the land stays light whichever entry is chosen. Measured on the demo
 * workspace at 1440x900: Charcoal `dark 0.68 / light 0.29`, Paper
 * `dark 0.00 / light 0.97`.
 */
async function sampleCanvas(page: Page): Promise<CanvasSample> {
  return page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')
    if (canvas === null) {
      throw new Error('the map drew no canvas to sample')
    }
    const SIDE = 96
    const DARK = 64
    const LIGHT = 160
    const off = document.createElement('canvas')
    off.width = SIDE
    off.height = SIDE
    const context = off.getContext('2d')
    if (context === null) {
      throw new Error('no 2d context to sample the canvas into')
    }
    context.imageSmoothingEnabled = false
    context.drawImage(canvas, 0, 0, SIDE, SIDE)
    const { data } = context.getImageData(0, 0, SIDE, SIDE)

    const luminance = (r: number, g: number, b: number): number =>
      0.2126 * r + 0.7152 * g + 0.0722 * b

    const total = data.length / 4
    let opaque = 0
    let dark = 0
    let light = 0
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] === 255) opaque += 1
      const value = luminance(data[index], data[index + 1], data[index + 2])
      if (value < DARK) dark += 1
      else if (value > LIGHT) light += 1
    }

    // The chrome, read from the surface the theme paints the page with rather
    // than from anything the map touches.
    const chrome = getComputedStyle(document.body).backgroundColor
    const channels = chrome.match(/\d+(\.\d+)?/g) ?? []
    return {
      opaque: opaque / total,
      dark: dark / total,
      light: light / total,
      chrome:
        channels.length < 3
          ? -1
          : luminance(
              Number(channels[0]),
              Number(channels[1]),
              Number(channels[2]),
            ),
    }
  })
}

/**
 * Press an entry and wait for the column behind it, not for the card.
 *
 * The picker moves its own selection before the write answers, so the card is
 * checked either way; `pinDemoLanguage()` in `./helpers/session.ts` learned the
 * same lesson about the language chips. The response is armed before the click
 * because it can arrive first.
 */
async function chooseBasemap(page: Page, option: string): Promise<void> {
  const written = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/_serverFn/'),
    { timeout: WRITE_TIMEOUT_MS },
  )
  await page.locator(option).click()
  // Asserted rather than folded into the predicate: a failed write is a response
  // too, and the picker is optimistic, so the `checked` assertions after this
  // would pass on a write that never reached the column. Read as an expectation
  // it names the status; read as a filter it would only ever time out.
  const response = await written
  expect(response.status(), `the ${option} write was refused`).toBeLessThan(400)
}

/**
 * Put the member back on the workspace's map style, which is where local D1
 * starts: `user_settings.map_style` is `NULL` for every row.
 *
 * The round trip ends here anyway; this is what makes a *failed* run leave the
 * fixture as it found it, so the next one starts where the first did rather
 * than opening on somebody else's Charcoal.
 */
async function clearOverride(context: BrowserContext): Promise<void> {
  const page = await context.newPage()
  try {
    // Plain `load`, deliberately not `networkidle`: this runs while the rest of
    // the suite has the dev server busy, and a document that is still prefetching
    // sibling routes never goes idle inside the test timeout — which is how the
    // teardown, not the assertion, failed the first full-suite run. The wait that
    // matters is the one on the next line, and it is a stronger signal anyway.
    await page.goto(APPEARANCE.path)
    const follow = page.locator(FOLLOW_WORKSPACE)
    await follow.waitFor({ state: 'visible', timeout: WRITE_TIMEOUT_MS })
    if ((await follow.getAttribute('data-state')) !== 'checked') {
      await chooseBasemap(page, FOLLOW_WORKSPACE)
    }
  } finally {
    await page.close()
  }
}
