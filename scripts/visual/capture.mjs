/**
 * Take the frames a blind A/B pair is made of.
 *
 * The sandcastle loop's neutral capture step runs this — see .sandcastle/pixel-capture-prompt.md —
 * and so does anyone checking a change by hand, which the `verifying-changes` skill points here for.
 * The script exists because the capture procedure used to be two kilobytes of prose in that prompt
 * and every capture agent re-derived it. The bill, measured across two runs: five findings about a
 * theme the capture had switched wrongly, frames photographed with the screen at rest when the item
 * under judgement was a hover state, flat-colour frames filed from a WebGL canvas shot before its
 * first idle, and thirty-six findings about scratch PNGs left at the repository root. Every one of
 * those is a defect of the capture, and every one was reported to the critic as a defect of the
 * product.
 *
 * The seams this closes are the ones e2e/helpers/shoot.ts closes for the gate, and where the two
 * overlap this file follows shoot.ts rather than inventing a second answer:
 *   - the theme is selected with `page.emulateMedia({ colorScheme })` and nothing else. Writing
 *     `data-theme` fights the app's own theme script, and driving the app's theme MENU only opens a
 *     dropdown, which is how three rounds came to report a half-dark frame as a product defect;
 *   - a route with a live map is not photographed until `[data-map-ready="true"]` latches, and it is
 *     waited for again after every resize and every theme change, because a theme swap replaces the
 *     whole style document through setStyle and the marker goes back to false;
 *   - entrance motion is stopped before the shutter, so text is never caught at 20% opacity.
 *
 * `--auth` is refused outright for a screen only a signed-out visitor can see, because the frame
 * would be of the wrong screen under the right filename — which screens and why: ./anonymous-only.mjs.
 *
 * The reference demo has no `--auth`: it is entered by pressing its own "Try the demo" control once
 * (`--enter`), and its welcome overlay is pressed away on every frame (`--dismiss`). Why two flags
 * and not one `--click`: ./click-through.mjs.
 *
 * It deliberately does NOT record anything under e2e/__screenshots__. Those baselines are compared
 * pixel for pixel across machines and belong to Playwright's own projects; this script writes only
 * into the shot directory it is given, for a blind critic to look at.
 *
 * Usage:
 *   node scripts/visual/capture.mjs \
 *     --url http://localhost:3010/atlas \
 *     --out .sandcastle-shots/issue-<n> \
 *     --label A \
 *     --viewports 1440x900,360x800 \
 *     --themes light,dark \
 *     [--auth] [--map] [--state hover-visited] \
 *     [--hover 'selector'] [--click 'selector'] [--settle 800] \
 *     [--enter 'selector'] [--dismiss 'selector']
 *
 * Prints one JSON object on stdout: { requestedUrl, files, console, warnings, captureValid }. Each
 * file records the URL the browser actually landed on, so a redirect the refusal list does not know
 * about — a role-gated route, a screen not yet written — is still visible to whoever reads this.
 * Copy it into your result.
 */

import { mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { anonymousOnlyRefusal } from './anonymous-only.mjs'
import { dismissIfPresent, enterThrough } from './click-through.mjs'

const AUTH_STATE = 'e2e/.auth/demo.json'
const DEV_TOOLBAR = '[data-testid="tanstack_devtools"]'

/**
 * Console output that is the toolchain talking, not the application.
 *
 * Narrower than it looks, and anchored on WHERE the message came from rather than on what it says:
 * only a message whose own stack frame is a Vite dev-server namespace is let through. An error the
 * app raises is still fatal even when it quotes one of these word for word.
 *
 * This list is NOT the gate's list. `TOLERATED_CONSOLE_WARNINGS` in e2e/helpers/shoot.ts governs
 * what fails a Playwright run and must stay as strict as it is; a dev-client HMR handler cannot
 * reach the gate at all, because the gate does not run one. It reached the capture, was reported as
 * a blocking console error, and failed two finished items in round 9 of the atlas run.
 */
const NOT_THE_APP = [
  {
    why: "Vite's dev client and HMR machinery",
    url: /\/@vite\/|\/@react-refresh|\/@id\/|\/@fs\//,
  },
  { why: 'the React DevTools bridge', url: /react[-_]devtools/i },
]

/**
 * The dev server's dependency optimiser has gone stale, which is neither the app's fault nor
 * something to excuse.
 *
 * Excusing it would be worse than failing on it. When `/node_modules/.vite/deps/*` answers 504 the
 * dynamic import of `src/routes/_app/route.tsx` fails, every `_app` route renders its error
 * boundary, and a capture that swallowed the message would file eight photographs of "Something
 * went off route" as a clean result. Round 4 failed a finished item on it as if it were an app
 * error; round 5 photographed a dead server for a whole item and lost 71 Playwright specs to the
 * same cause. Both readings were wrong in different directions, so it gets its own verdict: the
 * CAPTURE is invalid, the item is unjudged, and the fix is named.
 */
const TOOLCHAIN_BROKEN = [
  {
    why: 'the Vite dependency optimiser is stale — `rm -rf node_modules/.vite` and restart the dev server, then re-capture. The page renders its error boundary until you do, so any frame taken now is worthless.',
    url: /\/node_modules\/\.vite\/deps\//,
    text: /504|Outdated Optimize Dep/i,
  },
]

function args() {
  const out = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!key.startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key.slice(2)] = true
    else {
      out[key.slice(2)] = next
      i++
    }
  }
  return out
}

const opt = args()
const need = (k) => {
  const v = opt[k]
  if (typeof v !== 'string') {
    console.error(`capture: --${k} is required`)
    process.exit(2)
  }
  return v
}
/** A bare `--flag` parses as `true`, an explicit `--flag true` as the string. Both mean yes. */
const flag = (k) => opt[k] === true || opt[k] === 'true'

const url = need('url')
const outDir = resolve(need('out'))
const label = need('label')
const viewports = String(opt.viewports ?? '1440x900,768x1024,360x800,2560x1440')
  .split(',')
  .map((v) => {
    const [w, h] = v.trim().split('x').map(Number)
    return { w, h, name: String(w) }
  })
const themes = String(opt.themes ?? 'light,dark')
  .split(',')
  .map((t) => t.trim())
const statePrefix = typeof opt.state === 'string' ? `${opt.state}-` : ''
const settleMs = Number(opt.settle ?? 600)

const warnings = []
const consoleMessages = []

/**
 * The verdict a console message earns, and the reason to print beside it.
 *
 * `toolchain-broken` is checked first because it is the stricter verdict: it invalidates the whole
 * capture, where `not-the-app` only excuses one message. Should a message ever match both lists, the
 * order is what stops a stale-optimiser 504 being excused and its error-boundary frames filed as a
 * clean result.
 */
function classify(from, text) {
  const broken = TOOLCHAIN_BROKEN.find(
    (rule) => rule.url.test(from) && rule.text.test(text),
  )
  if (broken) return { verdict: 'toolchain-broken', why: broken.why }

  const excused = NOT_THE_APP.find((rule) => rule.url.test(from))
  if (excused) return { verdict: 'not-the-app', why: excused.why }

  return { verdict: 'fatal', why: undefined }
}

/** Stop entrance motion, and hide tooling that is not the product. */
async function quiesce(page) {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
  })
  await page.evaluate((sel) => {
    for (const el of document.querySelectorAll(sel)) el.remove()
  }, DEV_TOOLBAR)
}

/**
 * Wait for the frame a reader actually sees.
 *
 * Ordered so each wait is meaningful: fonts before layout settles, the map's own idle marker last,
 * because a style reload restarts it.
 */
async function settle(page, { map }) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  if (map) {
    // Absence of an unsettled marker, plus at least one marker present — the same two-sided check
    // `settleMap()` makes in e2e/helpers/shoot.ts. A bare wait for `[data-map-ready="true"]` was
    // tried first and hung: the marker sits on a wrapper Playwright does not always call visible.
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-map-ready]').length > 0 &&
        document.querySelectorAll('[data-map-ready="false"]').length === 0,
      undefined,
      { timeout: 25_000 },
    )
  }
  await page.waitForTimeout(settleMs)
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function main() {
  const wantsAuth = flag('auth')

  // Both refusals come before anything is created or launched: once a frame exists there is
  // nothing left downstream to tell a redirect target apart from the product. Which screens are
  // anonymous-only, and why that list is short: ./anonymous-only.mjs.
  const refusal = wantsAuth ? anonymousOnlyRefusal(url) : undefined
  if (refusal) {
    console.error(`capture: ${refusal}`)
    process.exit(2)
  }

  // `--auth` is our cached session and `--enter` is how the reference makes one for itself. Both
  // on one URL means the caller has mixed the two sides up, and whichever won would file the
  // wrong product under the right filename.
  if (wantsAuth && typeof opt.enter === 'string') {
    console.error(
      'capture: --auth and --enter exclude each other. --auth is our side (the cached ' +
        `${AUTH_STATE}); --enter is the reference side, which signs itself in through a control ` +
        'on its own sign-in screen.',
    )
    process.exit(2)
  }

  if (wantsAuth && !existsSync(AUTH_STATE)) {
    console.error(
      `capture: --auth was asked for but ${AUTH_STATE} does not exist. ` +
        `Run the Playwright setup project first: pnpm exec playwright test --project=setup`,
    )
    process.exit(2)
  }

  await mkdir(outDir, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    storageState: wantsAuth ? AUTH_STATE : undefined,
    deviceScaleFactor: 1,
    locale: 'en-GB',
    timezoneId: 'UTC',
  })

  // The clock the Worker reads, pinned to the same day as the baselines when the caller asks for
  // it. Scoped to this origin by hand: setting it context-wide is what made Google Fonts reject the
  // preflight and recorded every baseline in the fallback face.
  const serverToday = process.env.PT_SERVER_TODAY
  if (serverToday) {
    const origin = new URL(url).origin
    await context.route('**/*', async (route) => {
      const target = route.request().url()
      if (!target.startsWith(origin)) return route.continue()
      return route.continue({
        headers: {
          ...route.request().headers(),
          'x-pt-server-today': serverToday,
        },
      })
    })
  }

  const page = await context.newPage()
  page.on('console', (msg) => {
    const type = msg.type()
    if (type !== 'error' && type !== 'warning') return
    const from = msg.location()?.url ?? ''
    const text = msg.text().slice(0, 400)
    consoleMessages.push({ type, text, from, ...classify(from, text) })
  })

  const files = []
  const hasMap = flag('map')

  // Once, not per frame: the session it creates lives in a cookie, so every `page.goto` below
  // arrives signed in. Before the first viewport is set, because the sign-in screen's layout is
  // not what is being photographed.
  if (typeof opt.enter === 'string') {
    await enterThrough(page, { url, selector: opt.enter, settleMs })
  }

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    for (const theme of themes) {
      await page.emulateMedia({ colorScheme: theme })
      await page.goto(url, { waitUntil: 'commit', timeout: 45_000 })

      // A cached session that has expired does not fail — it redirects, and the frame filed is the
      // login screen. A critic handed that reports the product as having no content at all. Refuse
      // it here, where the fix is one command, rather than downstream where it is a wasted round.
      if (wantsAuth && new URL(page.url()).pathname.startsWith('/login')) {
        throw new Error(
          `--auth was asked for but ${url} redirected to ${page.url()}. The cached session in ` +
            `${AUTH_STATE} is stale or the workspace is unseeded. Refresh it with: ` +
            `PLAYWRIGHT_BASE_URL=${new URL(url).origin} pnpm exec playwright test --project=setup`,
        )
      }

      await settle(page, { map: hasMap })
      await quiesce(page)

      // Per frame, before any hover or click: an overlay that re-renders on every hard load would
      // otherwise swallow the pointer, and the frame would be of the overlay.
      const dismissed =
        typeof opt.dismiss === 'string'
          ? await dismissIfPresent(page, { selector: opt.dismiss, settleMs })
          : undefined

      if (typeof opt.hover === 'string') {
        await page.locator(opt.hover).first().hover({ timeout: 15_000 })
        await page.waitForTimeout(settleMs)
      }
      if (typeof opt.click === 'string') {
        await page.locator(opt.click).first().click({ timeout: 15_000 })
        await page.waitForTimeout(settleMs)
      }

      // Read the viewport back. A frame whose measured size is not the one intended sends the
      // critic after a responsive defect that does not exist.
      const measured = await page.evaluate(() => ({
        w: window.innerWidth,
        h: window.innerHeight,
      }))
      if (measured.w !== vp.w) {
        warnings.push(
          `viewport ${vp.w} measured as ${measured.w} — frame not filed`,
        )
        continue
      }

      const name = `${statePrefix}${vp.name}-${theme}-${label}.png`
      const path = `${outDir}/${name}`
      await page.screenshot({
        path,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      })
      const { size } = await stat(path)

      // A flat frame compresses to almost nothing. This is the cheap version of "did the canvas
      // finish drawing" and it has caught exactly the failure it was written for.
      if (size < 15_000 && vp.w >= 768) {
        warnings.push(
          `${name} is ${Math.round(size / 1024)}KB — ` +
            `suspiciously flat for a ${vp.w}px frame, likely shot before the page finished painting`,
        )
      }
      // Read back at the shutter rather than at the response, so a redirect the app makes after
      // hydration — and a `--click` that navigates — is the URL reported for this frame.
      files.push({
        viewport: vp.name,
        theme,
        landedUrl: page.url(),
        path,
        bytes: size,
        // Only when `--dismiss` was given: whether its control was on this frame and pressed.
        ...(dismissed === undefined ? {} : { dismissed }),
      })
    }
  }

  await context.close()
  await browser.close()

  const fatal = consoleMessages.filter((m) => m.verdict === 'fatal')
  const excused = consoleMessages.filter((m) => m.verdict === 'not-the-app')
  const broken = consoleMessages.filter((m) => m.verdict === 'toolchain-broken')
  const brokenReasons = [...new Set(broken.map((m) => m.why))]
  console.log(
    JSON.stringify(
      {
        requestedUrl: url,
        files,
        console: {
          fatal: fatal.map(
            (m) => `${m.type}: ${m.text}${m.from ? ` — at ${m.from}` : ''}`,
          ),
          notTheApp: excused.map((m) => `${m.text.slice(0, 120)} (${m.why})`),
          toolchainBroken: brokenReasons,
        },
        warnings,
        captureValid: broken.length === 0,
      },
      null,
      2,
    ),
  )
  if (broken.length) {
    console.error(
      `capture: THESE FRAMES ARE INVALID — ${brokenReasons.join(' ')}`,
    )
    process.exit(2)
  }
}

main().catch((error) => {
  console.error(
    `capture: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
})
