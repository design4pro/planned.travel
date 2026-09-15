/**
 * Which console output fails a run, and which the browser is merely muttering.
 *
 * Split out of the browser helpers so it can be exercised without one: nothing here
 * imports Playwright, so the tolerance table and the classifier are reachable
 * from the vitest `tooling` project. `./console.ts` re-exports the whole surface, so
 * every existing caller is unchanged.
 */

/** Which console output fails the run, and which was deliberately let through. */
export type ConsoleReport = {
  readonly fatal: ReadonlyArray<string>
  readonly tolerated: ReadonlyArray<string>
}

export type ConsoleVerdict = 'fatal' | 'tolerated' | 'ignored'

/** One narrowly-scoped exception to "a warning fails the run". */
export type ToleratedConsoleWarning = {
  /** Why this is the browser talking rather than the app. */
  readonly why: string
  readonly match: RegExp
  /** Tolerated only on a route that declares a live map. */
  readonly onlyWithLiveMap: boolean
}

/**
 * The complete list of console warnings a journey does not fail on.
 *
 * docs/SPEC.md §2 asks for zero console errors *or warnings*, and that bar still
 * bites. Everything below stays fatal, on every route, with no exception:
 *
 * - every `pageerror`, which is an uncaught exception, but for the single
 *   harness-made one in `TOLERATED_PAGE_ERRORS` below;
 * - every `console.error`, MapLibre's and React's included;
 * - every `console.assert`;
 * - every `console.warn` not matched by an entry in this list — which is every
 *   React hydration and key warning, every deprecation notice, every
 *   failed-resource warning, and anything the app writes itself.
 *
 * Message types the suite has never read — `log`, `info`, `debug`, `trace` and
 * the rest — stay ignored, as before.
 *
 * Neither entry is an app warning, and neither can become one: both patterns are
 * anchored at the start of the message, so a warning the app writes itself is
 * fatal even when it quotes one of these word for word. A React hydration report
 * cannot reach this list at all — React 19 surfaces a mismatch as an uncaught
 * error through `window.reportError` and, in development, as a `console.error`,
 * and `classifyConsoleMessage()` answers `fatal` for both before it is ever
 * consulted. A warning-only tolerance is structurally incapable of swallowing one.
 *
 * **The graphics-driver advisory.** Headless Chromium paints WebGL through a
 * software rasteriser, and its GL layer reports — by its own fields, source
 * `OpenGL`, type `Performance`, severity `High` — that reading the drawing buffer
 * back to composite it stalled the GPU. It is a driver advisory about a code path
 * we do not own, it does not exist on hardware, and only a page with a WebGL
 * canvas can produce it, which is why it is scoped to `map: true` routes and stays
 * fatal everywhere else. The per-context pointer in the prefix changes every run,
 * so the pattern is anchored on the shape and never on the handle.
 *
 * **The unused-preload advisory.** The engine's own resource loader, a few seconds
 * after the load event, about a resource the *dev server* handed the parser. It
 * failed `register renders in dark` on mobile WebKit in one full run of four, and
 * what decided which run was how long the page happened to stay open — the
 * emission window is fixed and the app on screen has no part in it. Reproduced
 * verbatim in both engines against this origin: WebKit ends the message "Please
 * make sure it wasn't preloaded for nothing." and Chromium "Please make sure it
 * has an appropriate `as` value and it is preloaded intentionally.", so the
 * pattern stops at the sentence they share.
 *
 * Its scope is the URL, and the URL is what makes the tolerance narrow rather
 * than convenient. The resource has to be served by a development server —
 * `localhost` or a loopback address with a port — under a path only `vite dev`
 * publishes: `/src/…` is the source tree, anything under `/@` is one of the dev
 * server's own namespaces (`/@vite/`, `/@id/`, `/@fs/`, `/@tanstack-start/`,
 * `/@react-refresh`), and `/node_modules/…` is an unbundled dependency. The deployed Worker serves none of them; it serves hashed
 * `/assets/*` instead, and the identical advisory about an `/assets/…` URL — or
 * about any host that is not the loopback — stays fatal, because there it would be
 * a real preload the built application asked for and did not use. Both halves are
 * asserted in `the harness itself`.
 */
export const TOLERATED_CONSOLE_WARNINGS: ReadonlyArray<ToleratedConsoleWarning> =
  [
    {
      why: "headless Chromium's software rasteriser reporting that compositing the WebGL canvas stalled on a pixel readback",
      match:
        /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, /,
      onlyWithLiveMap: true,
    },
    {
      why: "the browser's resource loader reporting that a Vite dev-server URL was speculatively preloaded and not used — a path that exists only under `vite dev`, and a warning whose arrival depends on how long the page stayed open rather than on what the page rendered",
      match:
        /^The resource https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+\/(?:src\/|node_modules\/|@)\S* was preloaded using link preload but not used within a few seconds from the window's load event\./,
      onlyWithLiveMap: false,
    },
  ]

/** One narrowly-scoped exception to "an uncaught exception fails the run". */
export type ToleratedPageError = {
  /** Why this is the test harness throwing rather than the app. */
  readonly why: string
  readonly match: RegExp
}

/**
 * The complete list of uncaught exceptions a journey does not fail on.
 *
 * Since ADR 0016 the console is the whole net a journey casts, so every entry here
 * is coverage given up. It holds one, and what makes that one admissible is that
 * no browser and no line of this application can write it.
 *
 * **Two fake clocks, one id.** `visit()` pins the page's clock with
 * `page.clock.setFixedTime`, and Playwright does that by replacing the timer
 * functions of every frame with its own (`packages/injected/src/clock.ts` in
 * playwright-core). Each frame's replacement counts its ids from the same start, and
 * it throws this sentence when `clearTimeout()` is handed an id it holds as a live
 * `requestIdleCallback()`.
 *
 * Sentry Session Replay hands it one. Its flush debounce (`@sentry/core`'s
 * `debounce`, called by `ReplayContainer`) schedules through
 * `getNativeImplementation('setTimeout')`, which — finding the page's `setTimeout`
 * no longer native — borrows the one from a hidden sandbox iframe, and that frame
 * has a fake clock of its own. The debounce then cancels with the page's
 * `clearTimeout()`, and whenever the iframe's timeout and a page idle callback share
 * a number, the page's clock objects. Caught with its stack on the 01-S1d copy
 * dialog on Chromium, from a keyboard breadcrumb (issue #402); the same sentence was
 * blamed on `@radix-ui/react-password-toggle-field` on WebKit
 * (`e2e/journeys.spec.ts`), where the sign-in form is typed into. Without the fake
 * clock `window.setTimeout` is native, Sentry takes it, and there is no second clock
 * — so no build and no browser raises this. It needs a `VITE_SENTRY_DSN` in the
 * local env to happen at all, which is why CI, which sets none, has never seen it.
 *
 * What the entry gives up is this one pairing: were the app itself ever to cancel an
 * idle callback with `clearTimeout()` — a silent no-op in a browser — the journeys
 * would not say so. Nothing under `src/` schedules an idle callback today.
 *
 * Anchored at both ends, on this one pairing, and read only for a `pageerror`: the
 * same sentence written to the console, the check's other pairings, and an exception
 * that merely quotes it all stay fatal. Asserted in `__tests__/console-policy.test.ts`.
 */
export const TOLERATED_PAGE_ERRORS: ReadonlyArray<ToleratedPageError> = [
  {
    why: "Playwright's fake clock refusing a `clearTimeout()` whose id Sentry Replay took from a sandbox iframe's own fake clock and which collides with a page idle callback — two clocks only the harness installs",
    match:
      /^Cannot clear timer: timer created with requestIdleCallback\(\) but cleared with clearTimeout\(\)$/,
  },
]

/** Where one console message lands: fails the run, is let through, or is noise. */
export function classifyConsoleMessage(message: {
  readonly type: string
  readonly text: string
  readonly liveMap: boolean
}): ConsoleVerdict {
  if (message.type === 'pageerror') {
    const tolerated = TOLERATED_PAGE_ERRORS.some((rule) =>
      rule.match.test(message.text),
    )
    return tolerated ? 'tolerated' : 'fatal'
  }
  if (message.type === 'error' || message.type === 'assert') {
    return 'fatal'
  }
  if (message.type !== 'warning') {
    return 'ignored'
  }
  const tolerated = TOLERATED_CONSOLE_WARNINGS.some(
    (rule) =>
      (rule.onlyWithLiveMap ? message.liveMap : true) &&
      rule.match.test(message.text),
  )
  return tolerated ? 'tolerated' : 'fatal'
}
