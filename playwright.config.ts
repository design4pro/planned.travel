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
 * Ports 3010-3020 are reserved for an automated round; everything below is a
 * developer's own process or another checkout's. Four consecutive rounds ran
 * the suite against a port outside that range — twice against 3000, once
 * against a server answering HTTP 500 to everything, and once against 3002,
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
  if (port < 3010 || port > 3020) {
    throw new Error(
      `playwright: refusing to run against ${baseURL}.\n` +
        `Ports 3010-3020 are reserved for automated rounds; ${port} is not one of them and may ` +
        `belong to another checkout or to the developer.\n` +
        `Start the server with \`pnpm exec vite dev --port 3010 --strictPort\` (never \`pnpm dev\`, ` +
        `whose script hardcodes --port 3000) and pass PLAYWRIGHT_BASE_URL=http://localhost:3010.\n` +
        `To target a preview deployment on purpose, set PLAYWRIGHT_ALLOW_ANY_PORT=1.`,
    )
  }
}

/**
 * The clock the Worker reads, pinned for the whole suite.
 *
 * The server picks *which rows* a screen shows by comparing a fixture date
 * against its own `new Date()` — the dashboard's reservation rail reads forward
 * from today, the journal splits its backlog on it — so a baseline recorded one
 * evening photographs a different set of rows the next morning. No mask absorbs
 * that: a row leaving a list moves everything below it.
 *
 * `serverToday()` in `src/server/clock.ts` therefore accepts this header on a
 * development request, and both browser projects send it on every request the
 * context makes, so the SSR document and the server-function RPCs that follow it
 * agree about the day. The value is the day the baselines in
 * `e2e/__screenshots__` were recorded, kept in step with `BASELINE_DAY` in
 * `e2e/helpers/shoot.ts`; it is deliberately *not* `FROZEN_NOW`, which pins the
 * clock inside the page and is a separate seam with its own reasons.
 *
 * The header is inert against anything but a dev server: the guard around it is
 * `import.meta.env.DEV`, which the production build folds to `false` and drops.
 */
const SERVER_TODAY_HEADER = 'x-pt-server-today'
const BASELINE_DAY = '2026-08-20'
const clockPin = { [SERVER_TODAY_HEADER]: BASELINE_DAY }

/**
 * End-to-end and visual-regression suite.
 *
 * Two projects, matching the two layouts the design system actually ships:
 * a desktop viewport wide enough for the three-column planner, and an iPhone
 * running WebKit — mobile Safari is where safe-area insets, `100dvh` and
 * momentum scrolling behave differently from everything else.
 *
 * Screenshot baselines are per project and per theme, and are compared with
 * animations disabled so a mid-transition frame can never fail a run.
 */
export default defineConfig({
  testDir: './e2e',
  snapshotDir: './e2e/__screenshots__',
  /**
   * `{platform}` is in the path because font rasterisation is not portable.
   *
   * The same correct page, rendered by the same browser build, antialiases text
   * differently on macOS and on Linux. At the 0.2% tolerance below that is
   * enough to fail nearly every frame carrying a paragraph — a difference in
   * where the pixels came from, not in what the design says. Recording one set
   * per platform is what lets the gate run both on a laptop and in CI without
   * either one being a second-class approximation of the other.
   *
   * `-darwin` is recorded locally; `-linux` by the `Update e2e baselines`
   * workflow, which runs in the same container image the gate does. A design
   * change therefore needs both refreshed. See docs/CLOUD.md §4.
   */
  snapshotPathTemplate:
    '{snapshotDir}/{testFileName}/{arg}-{projectName}-{platform}{ext}',
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
  // timeout on 17 tests and left 12 flaky, all timeouts, no pixel diffs
  // (PR #84, run 33155138232). Parallelism in CI comes from the shards in
  // ci.yml; locally Playwright's default (half the cores) applies.
  workers: isCI ? 1 : undefined,
  timeout: 30_000,
  // Per CI shard (ci.yml splits the suite twelve ways): ~2.5 min of tests, sized
  // generously so a retry-heavy shard still reports instead of being cut off —
  // the report is what tells load from regression.
  globalTimeout: isCI ? 10 * 60_000 : undefined,
  reporter: isCI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : [['list'], ['html', { open: 'never' }]],

  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      // ~0.2% of a 1440x900 viewport: absorbs font antialiasing across
      // platforms without hiding a shifted card or a wrong colour.
      maxDiffPixelRatio: 0.002,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
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
    {
      name: 'mobile-safari',
      dependencies: ['setup'],
      // Includes `defaultBrowserType: 'webkit'`, a 393x852 viewport and touch.
      use: { ...devices['iPhone 15'], extraHTTPHeaders: clockPin },
    },
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
