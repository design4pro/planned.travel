/**
 * The console policy, graded without a browser.
 *
 * These cases used to live in `e2e/journeys.spec.ts` under `describe('the gate
 * itself')`, where they cost a Playwright worker and a browser launch to assert
 * something pure. Nothing here touches a page: `classifyConsoleMessage` takes a
 * type, a string and a flag, so it belongs in the unit layer.
 *
 * The advisories are built by the same two helpers the spec used, so a tolerance
 * pattern that stops matching the sentence an engine actually writes fails here
 * rather than by going quietly green in CI.
 */

import { describe, expect, test } from 'vitest'
import { classifyConsoleMessage } from '../console-policy'
import type { ConsoleVerdict } from '../console-policy'

/**
 * The graphics-driver advisory, verbatim.
 *
 * Only a page with a WebGL canvas can produce it, and the per-context pointer in
 * the prefix is different every run — which is exactly why the tolerance is
 * anchored on the shape and never on the handle.
 */
function glAdvisory(handle: string, suffix = ''): string {
  return `[.WebGL-${handle}]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels${suffix}`
}

/**
 * The unused-preload advisory, in each engine's own wording.
 *
 * Both engines produce the same first sentence and diverge only in the advice
 * that follows, which is why the tolerance is anchored on the sentence they share
 * and scoped by the URL rather than by the tail.
 */
const WEBKIT_PRELOAD_TAIL = " Please make sure it wasn't preloaded for nothing."

const CHROMIUM_PRELOAD_TAIL =
  ' Please make sure it has an appropriate `as` value and it is preloaded intentionally.'

function preloadAdvisory(url: string, tail = WEBKIT_PRELOAD_TAIL): string {
  return `The resource ${url} was preloaded using link preload but not used within a few seconds from the window's load event.${tail}`
}

/**
 * What Playwright's fake clock throws when `clearTimeout()` meets one of its idle callbacks.
 *
 * `visit()` installs that clock in every frame, and Sentry Replay schedules through a
 * sandbox iframe's copy while cancelling through the page's, so two clocks' ids meet.
 * The check is the harness's own: a browser says nothing. Caught on the 01-S1d copy
 * dialog on Chromium (issue #402).
 */
const CLOCK_REFUSAL =
  'Cannot clear timer: timer created with requestIdleCallback() but cleared with clearTimeout()'

type Case = {
  readonly what: string
  readonly type: string
  readonly text: string
  readonly liveMap: boolean
  readonly verdict: ConsoleVerdict
}

const CASES: ReadonlyArray<Case> = [
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
    text: glAdvisory('0x104004ff000', ' (this message will no longer repeat)'),
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
    // The message that failed `register renders in dark` on mobile WebKit in one
    // full run of four. `/src/styles/styles.css` is a path only `vite dev` serves,
    // and the engine writes this about it a few seconds after the load event — so
    // whether the gate went red was decided by how long the page stayed open, not
    // by anything on the page.
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
    // The direction that keeps this narrow: the built application preloading an
    // asset it never uses is a real defect, and it is the same sentence.
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
    what: 'an uncaught exception',
    type: 'pageerror',
    text: "TypeError: Cannot read properties of undefined (reading 'from')",
    liveMap: false,
    verdict: 'fatal',
  },
  {
    what: "the fake clock's refusal to clear an idle callback as a timeout",
    type: 'pageerror',
    text: CLOCK_REFUSAL,
    liveMap: false,
    verdict: 'tolerated',
  },
  {
    // Only the pairing that has been seen is let through; the check guards
    // every other mix of schedule and clear as well.
    what: "the clock's refusal for a different pairing",
    type: 'pageerror',
    text: 'Cannot clear timer: timer created with setTimeout() but cleared with cancelIdleCallback()',
    liveMap: false,
    verdict: 'fatal',
  },
  {
    what: 'an uncaught exception that merely quotes the refusal',
    type: 'pageerror',
    text: `Teardown failed. ${CLOCK_REFUSAL}`,
    liveMap: false,
    verdict: 'fatal',
  },
  {
    what: 'the same sentence written to the console rather than thrown',
    type: 'error',
    text: CLOCK_REFUSAL,
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

describe('the console classifier keeps app problems fatal', () => {
  test.each(CASES)('$what is $verdict', (entry) => {
    expect(
      classifyConsoleMessage({
        type: entry.type,
        text: entry.text,
        liveMap: entry.liveMap,
      }),
    ).toBe(entry.verdict)
  })
})
