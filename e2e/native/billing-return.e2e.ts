import { describe, test } from '@e2e-dev/web'
import { expect } from 'e2e'
import { callsServerFn } from '../helpers/server-fn'
import { waitForHydration } from './helpers/readiness'

describe('billing checkout return', { session: 'owner' }, () => {
  for (const manual of [false, true]) {
    test(`${manual ? 'manual' : 'automatic'} local reads never send a Referer`, async ({
      app,
      browser,
      screen,
    }) => {
      const reads: Array<{ referer: string | undefined }> = []
      await browser.route('**/_serverFn/**', async (route) => {
        if (
          route.request.method === 'GET' &&
          callsServerFn(new URL(route.request.url), 'loadLocalBilling')
        ) {
          reads.push({ referer: route.request.headers.referer })
        }
        await route.fallback()
      })
      if (manual) {
        // The return controller never schedules background reads in a hidden
        // document, while its explicit Refresh action remains available.
        await browser.addInitScript(() => {
          Object.defineProperty(document, 'visibilityState', {
            get: () => 'hidden',
            configurable: true,
          })
        })
      }
      await app.open(
        '/settings/billing?checkout=complete&checkout_id=foreign-checkout',
      )
      await screen
        .getByText('Checking billing status', { exact: true })
        .waitFor()
      await waitForHydration(browser)
      const refresh = screen.getByRole('button', 'Refresh', { exact: true })

      if (manual) await refresh.tap()

      await expect.poll(() => reads.length).toBeGreaterThan(0)
      if (manual) expect(reads).toHaveLength(1)
      expect(reads.every((read) => !read.referer)).toBe(true)
      await expect(refresh).toBeEnabled()
      await expect(browser).toHaveURL(/checkout_id=foreign-checkout/)
    })
  }
})
