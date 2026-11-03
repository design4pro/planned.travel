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
    const beforeRefresh = reads
    const refresh = widget.getByRole('button', { name: 'Refresh rates' })
    await refresh.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => reads).toBe(beforeRefresh + 1)
    await expect(refresh).toBeFocused()
    if (width === 360) {
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('button', { name: 'Reference', exact: true }),
      ).toBeFocused()
    }
    await page.getByRole('button', { name: 'Choose widgets' }).click()
    const toggle = page.getByRole('menuitemcheckbox', {
      name: 'Currency converter',
    })
    await toggle.click()
    await expect(widget).toHaveCount(0)
    await toggle.click()
    await page.keyboard.press('Escape')
    if (width === 360)
      await page.getByRole('button', { name: 'Reference', exact: true }).click()
    await expect(widget.locator('output')).toContainText('0.00')
    await widget.getByRole('textbox', { name: 'Amount', exact: true }).fill('')
    if (width === 360) {
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Reference', exact: true }).click()
      const amount = widget.getByRole('textbox', {
        name: 'Amount',
        exact: true,
      })
      const beforeCorrection = reads
      await amount.fill('100')
      expect(reads).toBe(beforeCorrection)
      await amount.press('Tab')
      await expect(widget.locator('output')).toContainText('80.00')
      expect(reads).toBe(beforeCorrection + 1)
    }
  })
}

for (const state of ['stale', 'blocked', 'failure'] as const) {
  test(`keeps ${state} rates honest and preserves keyboard recovery in dark mobile presentation`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(60_000)
    expect(await useSession(context, page, baseURL)).toBe(true)
    await page.setViewportSize({ width: 360, height: 800 })
    await page.emulateMedia({ colorScheme: 'dark' })
    let reads = 0
    await page.route('**/_serverFn/**', async (route) => {
      if (!callsServerFn(new URL(route.request().url()), 'getPublicRatesFn'))
        return route.continue()
      reads++
      const now = Date.now()
      const reason =
        state === 'blocked'
          ? 'provider-blocked'
          : state === 'failure'
            ? 'provider-failed'
            : 'old-observation'
      const result =
        state === 'failure'
          ? { status: 'unavailable', reason, retryAt: now + 300000 }
          : {
              status: 'available',
              freshness: 'stale',
              reason,
              checkedAt: now,
              retryAt: now + 300000,
              snapshot: {
                version: 1,
                provider: 'frankfurter-ecb',
                source: 'ECB',
                base: 'EUR',
                effectiveOn: new Date(now - 5 * 86400000)
                  .toISOString()
                  .slice(0, 10),
                fetchedAt: now,
                rates: { EUR: 1, USD: 1.25 },
              },
            }
      await route.fulfill({ json: { result } })
    })
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    const trigger = page.getByRole('button', { name: 'Reference', exact: true })
    await expect(trigger).toBeVisible({ timeout: 30000 })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const widget = page.locator('[data-part="dashboard-widget-currency"]')
    const status =
      state === 'blocked'
        ? 'The rate service limit has been reached.'
        : state === 'failure'
          ? 'Rates could not be refreshed.'
          : 'These reference rates may be out of date.'
    await expect(
      widget.getByRole('status', { name: '', exact: true }),
    ).toContainText(status)
    if (state === 'failure')
      await expect(widget.locator('output')).toHaveCount(0)
    else await expect(widget.locator('output')).toContainText('1.25')
    const refresh = widget.getByRole('button', { name: 'Refresh rates' })
    await expect(refresh).toHaveAttribute('aria-disabled', 'true')
    const beforeRefresh = reads
    expect(beforeRefresh).toBeGreaterThan(0)
    await refresh.focus()
    await page.keyboard.press('Enter')
    await expect(refresh).toBeFocused()
    expect(reads).toBe(beforeRefresh)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  })
}

test('reserves the asynchronous converter footprint through the first response', async ({
  page,
  context,
  baseURL,
  browserName,
}, testInfo) => {
  test.setTimeout(90_000)
  expect(await useSession(context, page, baseURL)).toBe(true)
  await page.setViewportSize({ width: 360, height: 800 })
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/_serverFn/**', async (route) => {
    if (!callsServerFn(new URL(route.request().url()), 'getPublicRatesFn'))
      return route.continue()
    await held
    const now = Date.now()
    await route.fulfill({
      json: {
        result: {
          status: 'available',
          freshness: 'fresh',
          reason: null,
          checkedAt: now,
          snapshot: {
            version: 1,
            provider: 'frankfurter-ecb',
            source: 'ECB',
            base: 'EUR',
            effectiveOn: new Date(now).toISOString().slice(0, 10),
            fetchedAt: now,
            rates: { EUR: 1, USD: 1.25 },
          },
        },
      },
    })
  })
  try {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('button', { name: 'Reference', exact: true }),
    ).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Reference', exact: true }).click()
    const widget = page.locator('[data-part="dashboard-widget-currency"]')
    const refresh = widget.getByRole('button', { name: 'Refresh rates' })
    await expect(
      widget.getByRole('status', { name: '', exact: true }),
    ).toContainText('Loading')
    await refresh.scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)
    const before = await refresh.boundingBox()
    const footprint = await widget.boundingBox()
    if (browserName === 'chromium') {
      await page.evaluate(() => {
        const probe = { own: 0, other: 0, reset: () => {}, stop: () => {} }
        const observer = new PerformanceObserver((list) => {
          for (const item of list.getEntries()) {
            const shift = item as PerformanceEntry & {
              value: number
              sources?: Array<{ node?: Node }>
            }
            if (
              shift.sources?.some(
                (source) =>
                  source.node instanceof Element &&
                  source.node.closest(
                    '[data-part="dashboard-widget-currency"]',
                  ),
              )
            )
              probe.own += shift.value
            else probe.other += shift.value
          }
        })
        observer.observe({ type: 'layout-shift', buffered: false })
        probe.reset = () => {
          observer.takeRecords()
          probe.own = 0
          probe.other = 0
        }
        probe.stop = () => observer.disconnect()
        ;(window as unknown as CurrencyShiftWindow).currencyShift = probe
      })
      await refresh.evaluate((node) => {
        node.style.marginBlockStart = '40px'
      })
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                (window as unknown as CurrencyShiftWindow).currencyShift.own,
            ),
          { message: 'The widget probe must detect an intentional shift' },
        )
        .toBeGreaterThan(0)
      await refresh.evaluate((node) => {
        node.style.marginBlockStart = ''
      })
      await page.waitForTimeout(250)
      await page.evaluate(() =>
        (window as unknown as CurrencyShiftWindow).currencyShift.reset(),
      )
    }
    release()
    await expect(widget.locator('output')).toContainText('1.25')
    await page.waitForTimeout(250)
    const after = await refresh.boundingBox()
    expect(before).not.toBeNull()
    expect(after?.y).toBe(before?.y)
    expect((await widget.boundingBox())?.height).toBe(footprint?.height)
    if (browserName === 'chromium') {
      const shifts = await page.evaluate(() => {
        const probe = (window as unknown as CurrencyShiftWindow).currencyShift
        probe.stop()
        return { own: probe.own, other: probe.other }
      })
      await testInfo.attach('converter-layout-shifts', {
        body: JSON.stringify(shifts),
        contentType: 'application/json',
      })
      expect(shifts.own).toBe(0)
    }
  } finally {
    release()
  }
})

interface CurrencyShiftWindow {
  currencyShift: {
    own: number
    other: number
    reset: () => void
    stop: () => void
  }
}

for (const [picker, lastWidget] of [
  [false, false],
  [true, false],
  [true, true],
]) {
  test(`returns focus after a cross-tab hide: picker=${picker}, last=${lastWidget}`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(90_000)
    expect(await useSession(context, page, baseURL)).toBe(true)
    await page.setViewportSize({ width: 360, height: 800 })
    if (lastWidget)
      await page.addInitScript(() =>
        localStorage.setItem(
          'planned.dashboard-widgets',
          JSON.stringify({ shown: ['currency'], zones: [] }),
        ),
      )
    await page.route('**/_serverFn/**', (route) => {
      if (!callsServerFn(new URL(route.request().url()), 'getPublicRatesFn'))
        return route.continue()
      return route.fulfill({
        json: { result: { status: 'unavailable', reason: 'provider-failed' } },
      })
    })
    const other = await context.newPage()
    try {
      await other.goto('/pricing', { waitUntil: 'domcontentloaded' })
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
      const trigger = page.getByRole('button', {
        name: 'Reference',
        exact: true,
      })
      await expect(trigger).toBeVisible({ timeout: 30000 })
      await trigger.click()
      const widget = page.locator('[data-part="dashboard-widget-currency"]')
      if (picker) {
        await widget.getByRole('button', { name: 'To currency' }).click()
        await expect(page.getByRole('combobox')).toBeFocused()
      } else await widget.getByRole('textbox', { name: 'Amount' }).focus()
      await other.evaluate(
        (last) =>
          localStorage.setItem(
            'planned.dashboard-widgets',
            JSON.stringify({
              shown: last ? [] : ['clock', 'bookings', 'tripMix', 'storage'],
              zones: [],
            }),
          ),
        lastWidget,
      )
      await expect(widget).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(
        page.getByRole('button', {
          name: lastWidget ? 'Choose widgets' : 'Reference',
          exact: true,
        }),
      ).toBeFocused()
    } finally {
      await other.close()
    }
  })
}
