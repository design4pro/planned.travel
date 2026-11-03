import { expect, test } from '@playwright/test'
import { useSession } from './helpers/session'
import { callsServerFn } from './helpers/server-fn'
import { FROZEN_NOW } from './helpers/settle'

for (const width of [1440, 360]) {
  test(`reference currency conversion remains local and responsive at ${width}px`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(60_000)
    expect(await useSession(context, page, baseURL)).toBe(true)
    await page.setViewportSize({ width, height: 900 })
    let reads = 0
    await page.route('**/_serverFn/**', async (route) => {
      if (!callsServerFn(new URL(route.request().url()), 'getPublicRatesFn'))
        return route.continue()
      reads++
      await route.fulfill({
        json: {
          result: {
            status: 'available',
            freshness: 'fresh',
            reason: null,
            checkedAt: Date.parse(FROZEN_NOW),
            snapshot: {
              version: 1,
              provider: 'frankfurter-ecb',
              source: 'ECB',
              base: 'EUR',
              effectiveOn: FROZEN_NOW.slice(0, 10),
              fetchedAt: Date.parse(FROZEN_NOW),
              rates: { EUR: 1, USD: 1.25, JPY: 150 },
            },
          },
        },
      })
    })
    await page.clock.setFixedTime(new Date(FROZEN_NOW))
    const response = await page.goto('/dashboard', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBeLessThan(400)
    if (width === 360) {
      expect(reads).toBe(0)
      await expect(
        page.getByRole('button', { name: 'Reference', exact: true }),
      ).toBeVisible({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Reference', exact: true }).click()
    }
    const widget = page.locator('[data-part="dashboard-widget-currency"]')
    const output = widget.locator('output')
    await expect(output).toContainText('1.25', { timeout: 30_000 })
    const firstReads = reads
    await widget
      .getByRole('textbox', { name: 'Amount', exact: true })
      .fill('100')
    await expect(output).toContainText('125.00')
    expect(reads).toBe(firstReads)
    await widget.getByRole('button', { name: 'Swap currencies' }).click()
    await expect(output).toContainText('80.00')
    await expect(
      widget.getByRole('textbox', { name: 'Amount', exact: true }),
    ).toHaveValue('100.00')
    await widget
      .getByRole('textbox', { name: 'Amount', exact: true })
      .fill('-1')
    await expect(
      widget.getByRole('textbox', { name: 'Amount', exact: true }),
    ).toHaveAttribute('aria-invalid', 'true')
    await expect(output).toHaveCount(0)
    await widget.getByRole('textbox', { name: 'Amount', exact: true }).fill('0')
    await expect(output).toContainText('0.00')
    await expect(
      widget.getByRole('link', {
        name: 'ECB reference rates are freely available from the ECB.',
      }),
    ).toHaveAttribute('href', /ecb.europa.eu/)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    if (width === 1440) {
      await widget.getByRole('button', { name: 'To currency' }).click()
      await page.getByRole('option', { name: /^USD/ }).click()
      const identityReads = reads
      await page.setViewportSize({ width: 360, height: 900 })
      await page.getByRole('button', { name: 'Reference', exact: true }).click()
      await expect(
        widget.getByRole('textbox', { name: 'Amount', exact: true }),
      ).toHaveValue('0.00')
      await expect(widget).toHaveCount(1)
      await page.setViewportSize({ width: 1440, height: 900 })
      await expect(
        widget.getByRole('textbox', { name: 'Amount', exact: true }),
      ).toHaveValue('0.00')
      await expect(widget).toHaveCount(1)
      expect(reads).toBe(identityReads)
      await widget.getByRole('button', { name: 'To currency' }).click()
      await page.getByRole('option', { name: /^EUR/ }).click()
      await expect(output).toContainText('EUR')
    }
  })
}
