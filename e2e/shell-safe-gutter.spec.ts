import { expect, test } from '@playwright/test'
import { AUTH_STATE } from './helpers/session'

import type { Locator, Page } from '@playwright/test'

// `env(safe-area-inset-*)` is 0 in every project this suite runs, so the
// journey overrides the tokens that carry it (`--safe-left` / `--safe-right`).
const INSET = 50

async function sidePadding(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      left: parseFloat(style.paddingLeft),
      right: parseFloat(style.paddingRight),
    }
  })
}

async function simulateNotch(page: Page) {
  await page.addStyleTag({
    content: `:root { --safe-left: ${INSET}px; --safe-right: ${INSET}px; }`,
  })
}

test.describe('signed in', () => {
  test.use({ storageState: AUTH_STATE })

  test('the nav row and the content well clear a notched phone in landscape', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    const navRow = page.locator('header > div').first()
    const well = page.locator('main').first()
    await expect(well).toBeVisible()

    const before = await Promise.all([sidePadding(navRow), sidePadding(well)])
    for (const padding of before) {
      expect(padding.left).toBeLessThan(INSET)
      expect(padding.right).toBeLessThan(INSET)
    }

    await simulateNotch(page)
    for (const row of [navRow, well]) {
      expect((await sidePadding(row)).left).toBeGreaterThanOrEqual(INSET)
      expect((await sidePadding(row)).right).toBeGreaterThanOrEqual(INSET)
    }
  })
})

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the marketing header and footer rows clear a notched phone in landscape', async ({
    page,
  }) => {
    await page.goto('/')
    const headerRow = page.locator('header > div').first()
    const footerRow = page.locator('footer > div').first()
    await expect(headerRow).toBeVisible()

    const before = await Promise.all([
      sidePadding(headerRow),
      sidePadding(footerRow),
    ])
    for (const padding of before) {
      expect(padding.left).toBeLessThan(INSET)
      expect(padding.right).toBeLessThan(INSET)
    }

    await simulateNotch(page)
    for (const row of [headerRow, footerRow]) {
      expect((await sidePadding(row)).left).toBeGreaterThanOrEqual(INSET)
      expect((await sidePadding(row)).right).toBeGreaterThanOrEqual(INSET)
    }
  })
})
