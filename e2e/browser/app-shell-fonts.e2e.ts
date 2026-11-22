import { tabNavigationKey } from '../driver/keyboard'
import { browserTest, expect } from '../driver/test'
import { unblockCrossOriginFonts } from '../helpers/console'
import { planRoute, tripIdByName } from '../helpers/places-and-maps'
import { useSession } from '../helpers/session'
import { FROZEN_NOW, settle } from '../helpers/settle'
import {
  countLayoutShifts,
  layoutShiftSum,
  layoutShiftsReported,
} from '../helpers/trip-weather'

const test = browserTest()

test.configure({ timeout: 120_000 })
test.beforeEach(async ({ context, page, baseURL }) => {
  await useSession(context, page, baseURL)
})

for (const width of [1440, 393]) {
  for (const screen of ['plan', 'settings'] as const) {
    test(`keeps ${screen} navigation stable while fonts load at ${width}px @chromium-only`, async ({
      context,
    }) => {
      const route =
        screen === 'plan'
          ? planRoute(await tripIdByName(context, 'Lisbon, slowly'))
          : { name: 'settings', path: '/settings', ready: 'main' }
      const page = await context.newPage()
      await page.setViewportSize({ width, height: 900 })
      await countLayoutShifts(page)
      await unblockCrossOriginFonts(page)
      let releaseFonts: () => void = () => undefined
      const fontsReleased = new Promise<void>((resolve) => {
        releaseFonts = resolve
      })
      await page.clock.setFixedTime(new Date(FROZEN_NOW))
      await page.route('https://fonts.gstatic.com/**', async (request) => {
        await fontsReleased
        await request.continue()
      })

      try {
        const response = await page.goto(route.path, {
          waitUntil: 'domcontentloaded',
        })
        expect(response?.ok()).toBe(true)
        const header = page.getByRole('banner')
        const brand = header.getByRole('link', {
          name: 'planned.travel dashboard',
        })
        await expect(brand).toBeVisible()
        await expect(brand).toHaveText('planned.')
        const chrome = header
          .or(page.getByRole('navigation', { name: 'Sections', exact: true }))
          .or(page.getByRole('navigation', { name: 'Trip sections' }))
        const geometry = () =>
          chrome
            .locator('a:visible, button:visible')
            .evaluateAll((items) =>
              items.map((item) => item.getBoundingClientRect().toJSON()),
            )
        expect(await layoutShiftsReported(page)).toBe(true)
        // Keep the files held past Chromium's short optional font block period.
        await page.waitForTimeout(200)
        expect(await layoutShiftSum(page)).toBe(0)
        const before = await geometry()
        const fontResponse = page.waitForResponse(
          (font) => font.request().resourceType() === 'font' && font.ok(),
        )
        releaseFonts()
        await fontResponse
        await settle(page, route)
        expect(await geometry()).toEqual(before)
        expect(await layoutShiftSum(page)).toBe(0)

        await brand.focus()
        await page.keyboard.press(tabNavigationKey())
        await expect(header.locator(':focus')).toBeVisible()
        await expect(brand).not.toBeFocused()
      } finally {
        releaseFonts()
        await page.close()
      }
    })
  }
}

test.finish()
