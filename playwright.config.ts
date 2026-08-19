import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI === 'true' || process.env.CI === '1'

/**
 * Point the suite at an already-running server (a `wrangler dev` session, or a
 * deployed preview) instead of starting `pnpm dev`.
 */
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseURL ?? 'http://localhost:3000'

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
  snapshotPathTemplate: '{snapshotDir}/{testFileName}/{arg}-{projectName}{ext}',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Serialised in CI: a single dev server backed by one D1 file is the
  // bottleneck, and parallel writers would make failures irreproducible.
  workers: isCI ? 1 : undefined,
  timeout: 30_000,
  globalTimeout: isCI ? 20 * 60_000 : undefined,
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
      },
    },
    {
      name: 'mobile-safari',
      dependencies: ['setup'],
      // Includes `defaultBrowserType: 'webkit'`, a 393x852 viewport and touch.
      use: { ...devices['iPhone 15'] },
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
