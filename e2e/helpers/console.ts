import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { classifyConsoleMessage } from './console-policy'
import type { ConsoleReport } from './console-policy'
import { applyTheme } from './routes'
import type { RouteCase, Theme } from './routes'
import { FROZEN_NOW, settle } from './settle'

/**
 * The browser's own account of the visit, and the visit itself.
 *
 * `watchConsole()` is the whole net now that no frame is compared: every journey
 * grades what the engine said while the route was settling, and the quality bar
 * in docs/SPEC.md §2 is zero console errors. The classifier it defers to is pure
 * and lives in `./console-policy`, where vitest can reach it without a browser.
 */

/**
 * The console policy lives in `./console-policy`, which imports nothing, so the
 * classifier and its tolerance table can be tested without a browser. Re-exported
 * here so every caller of this module is unchanged.
 */
export type {
  ConsoleReport,
  ConsoleVerdict,
  ToleratedConsoleWarning,
  ToleratedPageError,
} from './console-policy'
export {
  TOLERATED_CONSOLE_WARNINGS,
  TOLERATED_PAGE_ERRORS,
  classifyConsoleMessage,
} from './console-policy'

/**
 * Attach a console listener before navigation and return a getter for what it
 * caught, split by verdict. The quality bar in docs/SPEC.md §2 is zero console
 * errors, so this is an assertion input, not diagnostics.
 *
 * One watcher per route, and the watcher is attached before the navigation it
 * grades. A journey that walks several routes gives each one its own page for the
 * same reason: an unmount runs while the next route is already being watched, and
 * an exception thrown there would be reported against a screen that did not throw
 * it.
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
    const verdict = classifyConsoleMessage({
      type: 'pageerror',
      text: error.message,
      liveMap,
    })
    if (verdict === 'tolerated') {
      tolerated.push(`pageerror: ${error.message}`)
    } else {
      fatal.push(`pageerror: ${error.message}`)
    }
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
 * system stack — and, because it is announced as four console errors, every walk
 * in the suite then fails on the fonts rather than on what it was asserting.
 *
 * Routing those two origins hands the request to Playwright, which issues it
 * outside the page's CORS enforcement and returns it verbatim — the same bytes,
 * from the same CDN, with the preflight no longer in the way. Nothing about the
 * fonts themselves changes, which is the point.
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
  // navigation rather than after the page has settled.
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
