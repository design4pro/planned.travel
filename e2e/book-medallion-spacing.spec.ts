import { expect, test } from '@playwright/test'
import { visit } from './helpers/console'
import { hasSession, useSession } from './helpers/session'

/** Browser geometry catches stretched grid rows; jsdom cannot measure this. */
test('Book centres both date lines together inside the responsive medallion', async ({
  context,
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000)
  await useSession(context, page, baseURL)
  expect(await hasSession(page), 'the seeded traveller must be signed in').toBe(
    true,
  )
  await visit(page, { name: 'trips', path: '/trips', ready: 'main' }, 'light')
  const href = await page
    .locator('a[href^="/trips/"][href$="/plan"]')
    .first()
    .getAttribute('href')
  expect(href, 'the seeded workspace must contain a trip').toMatch(/\/plan$/)
  const route = {
    name: 'book-medallion',
    path: (href ?? '').replace(/\/plan$/, '/book'),
    ready: '[data-part="new-booking"]',
  }
  await visit(page, route, 'light')
  const title = `Medallion spacing ${testInfo.project.name}`
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  try {
    await page.locator('[data-part="new-booking"]').first().click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('[data-part="type-other"]').click()
    await dialog.getByLabel('Name').fill(title)
    await dialog.getByLabel('Date', { exact: true }).fill('2026-09-30')
    await dialog
      .getByRole('button', { name: 'Add booking', exact: true })
      .click()
    await expect(card).toHaveCount(1)
    const group = card.locator('xpath=ancestor::section[1]')
    const medallion = group
      .locator('span.rounded-full')
      .filter({ has: page.locator('span.font-display') })
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await medallion.scrollIntoViewIfNeeded()
      await expect
        .poll(async () =>
          medallion.evaluate((circle) => circle.getBoundingClientRect().width),
        )
        .toBe(width < 640 ? 56 : 80)
      const geometry = await medallion.evaluate((circle) => {
        const [dayMonth, weekday] = circle.children
        const outer = circle.getBoundingClientRect()
        const top = dayMonth.getBoundingClientRect()
        const bottom = weekday.getBoundingClientRect()
        return {
          gap: bottom.top - top.bottom,
          verticalOffset: Math.abs(
            (top.top + bottom.bottom) / 2 - (outer.top + outer.height / 2),
          ),
          horizontalOffsets: [top, bottom].map((rect) =>
            Math.abs(rect.x + rect.width / 2 - (outer.x + outer.width / 2)),
          ),
          contained: [top, bottom].every(
            (rect) =>
              rect.left >= outer.left &&
              rect.right <= outer.right &&
              rect.top >= outer.top &&
              rect.bottom <= outer.bottom,
          ),
        }
      })
      await testInfo.attach(`medallion-${width}`, {
        body: JSON.stringify(geometry),
        contentType: 'application/json',
      })
      expect(
        geometry.gap,
        'the existing small margin separates adjacent lines',
      ).toBeCloseTo(2, 0)
      expect(geometry.verticalOffset).toBeLessThanOrEqual(1)
      expect(geometry.horizontalOffsets.every((offset) => offset <= 1)).toBe(
        true,
      )
      expect(geometry.contained).toBe(true)
    }
  } finally {
    await page.setViewportSize({ width: 1440, height: 900 })
    if (await card.count()) {
      await card
        .getByRole('button', { name: `Actions for ${title}`, exact: true })
        .click()
      await page
        .getByRole('menuitem', { name: 'Remove booking', exact: true })
        .click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Remove booking', exact: true })
        .click()
      await expect(card).toHaveCount(0)
    }
  }
})
