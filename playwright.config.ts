import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI === 'true' || process.env.CI === '1'

/**
 * Point the suite at an already-running server (a `wrangler dev` session, or a
 * deployed preview) instead of starting `pnpm dev`.
 */
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseURL ?? 'http://localhost:3000'

/**
 * Refuse to run against a server this workspace does not own.
 *
 * Ports 3030-3040 are reserved for an automated round; everything below is a
 * developer's own process or another checkout's. The pool used to be 3010-3020; it moved
 * because money-tracker on the same host hardcodes 3010 and has no allocator (run 2272b8e2).
 *
 * Everything else here predates the move. Four consecutive rounds ran the suite against a
 * port outside that range — twice against 3000, once against a server answering HTTP 500 to everything, and once against 3002,
 * which belonged to a different worktree's run. Every one of those produced a
 * page of failures that said nothing about the code under test, and the last
 * one photographed another branch's application.
 *
 * A misdirected suite is worse than no suite: it looks like evidence. So this
 * is a hard stop rather than a warning. Set PLAYWRIGHT_ALLOW_ANY_PORT=1 for a
 * deliberate run against a preview deployment or a hand-started server.
 */
if (!isCI && process.env.PLAYWRIGHT_ALLOW_ANY_PORT !== '1') {
  const port = Number(new URL(baseURL).port || '80')
  if (port < 3030 || port > 3040) {
    throw new Error(
      `playwright: refusing to run against ${baseURL}.\n` +
        `Ports 3030-3040 are reserved for automated rounds; ${port} is not one of them and may ` +
        `belong to another checkout or to the developer.\n` +
        `Start the server with \`pnpm exec vite dev --port 3030 --strictPort\` (never \`pnpm dev\`, ` +
        `whose script hardcodes --port 3000) and pass PLAYWRIGHT_BASE_URL=http://localhost:3030.\n` +
        `To target a preview deployment on purpose, set PLAYWRIGHT_ALLOW_ANY_PORT=1.`,
    )
  }
}

/**
 * The clock the Worker reads, pinned for the whole suite.
 *
 * The server picks *which rows* a screen shows by comparing a fixture date
 * against its own `new Date()` — the dashboard's reservation rail reads forward
 * from today, the journal splits its backlog on it. Unpinned, the fixture drains:
 * on the seeded workspace the rail is empty for good after 2026-10-12, and
 * `trips-core.spec.ts` starts skipping because the trip it navigates is no
 * longer in the list it navigates from. That is a suite going green by covering
 * less, on a morning nobody touched it, which is exactly the silent loss ADR 0016
 * says the thinner e2e layer must not buy.
 *
 * `serverToday()` in `src/server/clock.ts` therefore accepts this header on a
 * development request, and both browser projects send it on every request the
 * context makes, so the SSR document and the server-function RPCs that follow it
 * agree about the day. It is deliberately *not* `FROZEN_NOW`, which pins the clock
 * inside the page and is a separate seam with its own reasons.
 *
 * The header is inert against anything but a dev server: the guard around it is
 * `import.meta.env.DEV`, which the production build folds to `false` and drops.
 */
const SERVER_TODAY_HEADER = 'x-pt-server-today'
const FIXTURE_DAY = '2026-08-20'
const clockPin = { [SERVER_TODAY_HEADER]: FIXTURE_DAY }

/**
 * Whether the `mobile-safari` project is part of this run.
 *
 * It is, everywhere except a CI run that has not asked for it. That asymmetry is
 * the whole point: WebKit is the slower half of the suite, and on the shared
 * runner pool a pull request used to pay for it on every event. Measured on the
 * 2-vCPU runner (run 35101667571), the split fell along project lines — shard 1
 * was all chromium and finished its 52 tests in 882 s, shard 2 was all
 * `mobile-safari` and needed more than the 900 s `globalTimeout` it had for the
 * same 52. That is issue #466, and it was WebKit's cost, not a leak.
 *
 * So the cost moved off the pull-request path rather than being deleted: the
 * project is still declared, still runnable by name, and
 * `.github/workflows/e2e-webkit.yml` runs it nightly with `E2E_WEBKIT=1`. What a
 * pull request no longer buys is same-hour feedback on a WebKit-only defect —
 * that now arrives within a day, against `develop`, and the four comments in the
 * suite that name this project say where it runs.
 *
 * A local run is unaffected and still carries both projects, because the reason
 * to run WebKit at all is strongest where a human is looking at phone-width
 * behaviour. `pnpm e2e --project=mobile-safari` is the direct way to ask for it.
 */
const runsWebKit = !isCI || process.env.E2E_WEBKIT === '1'

/**
 * The end-to-end journeys.
 *
 * Two projects, matching the two layouts the design system actually ships:
 * a desktop viewport wide enough for the three-column planner, and an iPhone
 * running WebKit — mobile Safari is where safe-area insets, `100dvh` and
 * momentum scrolling behave differently from everything else.
 *
 * They do not both run everywhere. `chromium` runs on every event; `mobile-safari`
 * is off the pull-request path and runs nightly instead — `runsWebKit` above
 * carries the measurement that moved it and names where it went.
 *
 * No screenshot is compared here any more (ADR 0016). What a run asserts is that
 * every screen answers, renders its own content, hydrates, says nothing in the
 * console, and lets a reader act on it.
 */
export default defineConfig({
  testDir: './e2e',
  /**
   * `.spec.ts` and nothing else, because `e2e/` is no longer only Playwright's.
   *
   * The console policy is pure - it grades a string against a table and imports
   * nothing - so it is tested by the `tooling` vitest project, from a file that
   * lives beside the helper it covers. Playwright's default `testMatch` claims
   * `*.test.ts` as well, so it collected that file, tried to run vitest's
   * `describe` inside its own runner, and failed the whole suite before a single
   * browser had started. The `setup` project carries its own `testMatch` for
   * `auth.setup.ts` and is unaffected by this.
   */
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Parallel workers share one dev server and one D1 file, and that is safe
  // because the suite writes to the fixture from exactly three places: the
  // sign-in and the language pin (setup project only, which finishes before
  // the browser projects start), and the impersonation fixture — whose session
  // lives in its own test's cookie jar and whose audit rows no photographed
  // console screen renders. The real contention is the auth rate limiter's
  // single per-path bucket, which `hasSession()` now asks once per worker.
  // One per CI shard, measured: two workers on the 2-vCPU runner starved the
  // atlas tests — MapLibre renders through software WebGL there, and with two
  // browsers plus Vite SSR competing, React hydration outran the 10 s action
  // timeout on 17 tests and left 12 flaky, all timeouts (PR #84, run
  // 33155138232). That was measured over eighty-seven test instances a project
  // and has not been re-measured over fourteen; the starvation was contention
  // for one software renderer, which fewer tests do not relieve, so it stands
  // until somebody times it. Parallelism in CI comes from the shards in
  // ci.yml; locally Playwright's default (half the cores) applies.
  workers: isCI ? 1 : undefined,
  // Doubled under CI, because the runner is about three times slower than the
  // machine this number was chosen on and the budget was sized on the wrong one.
  // Measured: `the click surface never takes the reader's input` is 10.7 s in
  // chromium locally and blew the 30 s budget on all three attempts on the
  // 2-vCPU runner (run 33804783700) — three identical failures is a budget, not
  // a flake. The penalty is the same everywhere: the whole suite is 4.1 min
  // locally at one worker and ~7-8 min a shard there, on software WebGL. Raised
  // uniformly rather than per test, so the next atlas journey to sit near the
  // edge does not have to discover this again; `globalTimeout` still bounds the
  // shard, and a genuinely hung test still fails, one minute later.
  //
  // The uniform raise did not hold, and the reason is the one it hoped to avoid:
  // the whole atlas block sits near the edge, not one journey in it. Measured at
  // the local default worker count, 39.8 s, 29.0 s and 27.1 s against the 30 s
  // here, the first of them red about one run in three (issue #384). They now
  // carry `ATLAS_JOURNEY_TIMEOUT_MS` in `e2e/journeys.spec.ts` instead — a budget
  // named where the cost is, which is what makes it reviewable. This stays the
  // budget for every test that does not carry its own: raising it again would
  // absorb a slow-page regression on every other screen rather than report it.
  timeout: isCI ? 60_000 : 30_000,
  // Per CI shard (ci.yml splits the suite two ways, and e2e-webkit.yml does the
  // same for its own project). Measured on the 2-vCPU runner while both projects
  // ran on every event: 6m41s of journeys on shard 1 and over 8 min on shard 2,
  // against the ~3 min a local run at two workers suggested. 15 min leaves a
  // retry-heavy shard room to finish and report instead of being cut off — the
  // report is what tells load from regression — and stays under ci.yml's own
  // `timeout-minutes: 20`, which must never be the one that fires first.
  //
  // Both sides of the split now sit well inside it: a pull request shards ~52
  // chromium tests two ways where one shard used to carry all 52 in 882 s, and
  // the nightly WebKit run shards its own project the same way. The budget is
  // unchanged on purpose — it bounds a hung shard, and that job did not change.
  globalTimeout: isCI ? 15 * 60_000 : undefined,
  reporter: [
    // `github` writes GitHub annotations and is noise in a terminal; `list` is the
    // progressive output a human or an agent reads while the suite runs. That is the
    // only difference a CI run makes to the reporter list.
    isCI ? ['github'] : ['list'],
    ['html', { open: 'never' }],
    // Written on every run that reaches it, so a red suite leaves a machine-readable
    // verdict beside the HTML report. CI overrides the whole list with `--reporter=blob`
    // and never gets here. Absent means "the run did not finish", never "nothing failed".
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  expect: {
    timeout: 5_000,
  },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    // Deterministic rendering: fixed locale, zone and theme keep both the
    // screenshots and any date assertion stable. Dark theme and reduced motion
    // are per-test concerns — switch them with `page.emulateMedia()`.
    locale: 'en-GB',
    timezoneId: 'UTC',
    colorScheme: 'light',
  },

  projects: [
    // Signs the demo account in once and caches the session. Both browser projects
    // depend on it because `/sign-in/email` is rate limited to ten attempts a
    // minute, which per-test sign-in blows through.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        extraHTTPHeaders: clockPin,
      },
    },
    // Absent from a pull request's run and present everywhere else — see
    // `runsWebKit` above for why, and for where it runs instead. Spread rather
    // than filtered afterwards, so a CI run that did not ask for it fails
    // `--project=mobile-safari` loudly instead of silently matching nothing.
    ...(runsWebKit
      ? [
          {
            name: 'mobile-safari',
            dependencies: ['setup'],
            use: {
              ...devices['iPhone 15'],
              // Pinned rather than inherited: journey 7's composition argument is measured
              // against this exact geometry (`e2e/journeys.spec.ts`), so a playwright bump
              // must not move it under the test. Everything else — WebKit, touch, the
              // device scale and the user agent — still comes from the descriptor.
              viewport: { width: 393, height: 659 },
              extraHTTPHeaders: clockPin,
            },
          },
        ]
      : []),
  ],

  webServer:
    externalBaseURL === undefined
      ? {
          command: 'pnpm dev',
          url: baseURL,
          // Locally, attach to the dev server that is probably already up;
          // in CI always start a clean one so the run is reproducible.
          reuseExistingServer: !isCI,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        }
      : undefined,
})
