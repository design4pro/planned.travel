import type { E2EConfig } from 'e2e'
import { browserJourneyEngine } from './e2e/driver/engine'

const isCI = Boolean(process.env.CI && !['0', 'false'].includes(process.env.CI))
const url =
  process.env.E2E_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  'http://127.0.0.1:3030'
if (!isCI && process.env.PLAYWRIGHT_ALLOW_ANY_PORT !== '1') {
  const port = Number(
    new URL(url).port || (new URL(url).protocol === 'https:' ? 443 : 80),
  )
  if (port < 3030 || port > 3040)
    throw new Error(
      `e2e: refusing ${url}; ports 3030-3040 are reserved for this checkout's QA environment`,
    )
}
export default {
  tests: 'e2e/browser/**/*.e2e.ts',
  targets: [
    {
      name: 'chromium',
      engine: browserJourneyEngine('chromium'),
      app: { url },
    },
    ...(!isCI || process.env.E2E_WEBKIT === '1'
      ? [
          {
            name: 'mobile-safari',
            engine: browserJourneyEngine('webkit'),
            app: { url },
          },
        ]
      : []),
  ],
  credentials: {
    demo: {
      username: process.env.E2E_EMAIL ?? 'rafal@planned.travel',
      password: () =>
        process.env.TEST_DEMO_PASSWORD ??
        process.env.E2E_PASSWORD ??
        'planned-demo-2026',
    },
  },
  workers: 1,
  retries: 0,
  timeout: isCI ? 60_000 : 30_000,
  maxDuration: 30 * 60_000,
  cleanupTimeout: 30_000,
  actionTimeout: 10_000,
  assertionTimeout: 5_000,
  reporters: ['list', 'junit', 'markdown'],
  output: '.e2e/browser',
  cache: 'off',
  trace: 'retain-on-failure',
  video: 'off',
} satisfies E2EConfig
