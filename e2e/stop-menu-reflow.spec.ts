import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { signIn } from './helpers/session'
import { readCaptureState, settle } from './helpers/settle'
import { callsServerFn } from './helpers/server-fn'

const LANGUAGE = {
  name: 'language',
  path: '/settings/language',
  ready: '[data-testid="locale-chip-workspace"]',
}
const PLAN = '/trips/demo-trip-01-tokyo-and-kyoto/plan'
const DAYS = { pl: 'Dni', de: 'Tage', ar: 'الأيام' }
const CONFIRM = {
  pl: 'Przenieś i usuń godzinę',
  de: 'Verschieben und Zeit entfernen',
  ar: 'انقل وأسقط الوقت',
}
const MOVE = {
  pl: 'Przenieś do innego dnia',
  de: 'Auf einen anderen Tag verschieben',
  ar: 'نقل إلى يوم آخر',
}

async function contained(panel: Locator, page: Page) {
  await expect(panel).toBeVisible()
  await expect
    .poll(async () => {
      const box = await panel.boundingBox()
      return (
        box !== null &&
        box.x >= 0 &&
        box.x + box.width <= (page.viewportSize()?.width ?? 0)
      )
    })
    .toBe(true)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
}

// shortcut: locale overrides share fixture users; run with one worker until accounts are isolated per test.
test.describe.configure({ mode: 'serial' })

for (const locale of ['pl', 'de', 'ar'] as const) {
  test(`stop destinations reflow, scroll and accept keyboard selection in ${locale}`, async ({
    page,
    baseURL,
  }, info) => {
    test.setTimeout(180_000)
    await page.emulateMedia({
      colorScheme: info.project.name === 'mobile-safari' ? 'dark' : 'light',
    })
    // Separate fixture users keep the two browser projects' language writes independent.
    const email =
      info.project.name === 'mobile-safari'
        ? 'mika@planned.travel'
        : 'rafal@planned.travel'
    expect(await signIn(page, baseURL, email)).toBe(true)
    await page.goto(LANGUAGE.path)
    // Cold Vite loads the client graph before the menu journey can begin.
    await expect
      .poll(async () => (await readCaptureState(page, LANGUAGE)).hydrated, {
        timeout: 30_000,
      })
      .toBe(true)
    await settle(page, LANGUAGE)
    const originalLocale = await page.locator('html').getAttribute('lang')
    const original = await page
      .locator('[data-testid^="locale-chip-"][aria-checked="true"]')
      .getAttribute('data-testid')
    expect(original).not.toBeNull()
    try {
      await page.getByTestId(`locale-chip-${locale}`).click()
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      const widths =
        locale === 'pl' && info.project.name === 'chromium'
          ? [360, 1440]
          : [360]
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 })
        if (width === 360) {
          await page.goto(PLAN)
          await page
            .locator('[data-plan-loaded]')
            .waitFor({ state: 'visible', timeout: 60_000 })
          await settle(page, {
            name: 'plan',
            path: PLAN,
            ready: '[data-plan-loaded]',
            map: true,
          })
          await page
            .getByRole('button', { name: DAYS[locale], exact: true })
            .click()
        }
        const trigger = page
          .locator('li[data-planner-item]')
          .getByRole('button', { name: /Senso-ji/ })
          .last()
        await expect(trigger).toBeVisible()
        await trigger.click()
        const move = page.getByRole('menuitem', {
          name: MOVE[locale],
          exact: true,
        })
        let openKey = 'Enter'
        if (width !== 360)
          openKey = locale === 'ar' ? 'ArrowLeft' : 'ArrowRight'
        await move.focus()
        await page.keyboard.press(openKey)
        const panel =
          width === 360
            ? page.getByRole('menu').getByRole('group')
            : page.getByRole('menu').last()
        await contained(panel, page)
        await contained(
          panel.getByRole('menuitem').first().locator('span').last(),
          page,
        )
        const destinations = panel.getByRole('menuitem')
        await expect(destinations).toHaveCount(11)
        await page.keyboard.press('Escape')
        await expect(move).toBeFocused()
        await page.keyboard.press(openKey)
        await expect(panel.getByRole('menuitem').first()).toBeFocused()
        for (let index = 1; index < 11; index++) {
          await page.keyboard.press('ArrowDown')
          await expect(panel.getByRole('menuitem').nth(index)).toBeFocused()
        }
        const last = panel.getByRole('menuitem').last()
        await expect(last).toBeFocused()
        await contained(last, page)
        expect(
          await panel.evaluate((element) => element.scrollTop),
        ).toBeGreaterThan(0)
        await info.attach(`${locale}-${width}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
        // Exercise the planner's existing move without modifying the shared itinerary.
        await page.route('**/_serverFn/**', (route) =>
          route.request().method() === 'POST'
            ? route.abort('failed')
            : route.continue(),
        )
        const write = page.waitForRequest((request) =>
          callsServerFn(new URL(request.url()), 'reorderPlanFn'),
        )
        const refused = page.waitForEvent('requestfailed', {
          predicate: (request) =>
            callsServerFn(new URL(request.url()), 'reorderPlanFn'),
        })
        if (info.project.name === 'mobile-safari' && locale === 'de')
          await last.tap()
        else await page.keyboard.press('Enter')
        await page
          .getByRole('button', { name: CONFIRM[locale], exact: true })
          .click()
        expect((await write).postData()).toContain('demo-trip-01')
        await refused
        await page.unroute('**/_serverFn/**')
        if (width === 360) {
          await page.keyboard.press('Escape')
          await expect(page.getByRole('dialog')).toHaveCount(0)
        }
      }
    } finally {
      await page.unroute('**/_serverFn/**')
      await page.goto(LANGUAGE.path)
      await expect
        .poll(async () => (await readCaptureState(page, LANGUAGE)).hydrated, {
          timeout: 30_000,
        })
        .toBe(true)
      await settle(page, LANGUAGE)
      if (original !== null) {
        await page.getByTestId(original).click()
        await expect(page.getByTestId(original)).toHaveAttribute(
          'aria-checked',
          'true',
        )
        if (originalLocale !== null)
          await expect(page.locator('html')).toHaveAttribute(
            'lang',
            originalLocale,
          )
      }
    }
  })
}
