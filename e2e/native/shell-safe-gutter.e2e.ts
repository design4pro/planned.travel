import { describe, test } from '@e2e-dev/web'
import type { Browser } from '@e2e-dev/web'
import { expect } from 'e2e'

const INSET = 50

async function readPadding(browser: Browser, selectors: string[]) {
  return browser.evaluate(
    (paths) =>
      paths.map((selector) => {
        const element = document.querySelector(selector)
        if (!element) throw new Error(`Missing shell row: ${selector}`)
        const style = getComputedStyle(element)
        return {
          left: parseFloat(style.paddingLeft),
          right: parseFloat(style.paddingRight),
        }
      }),
    selectors,
  )
}

describe('shell safe-area gutters', () => {
  for (const scenario of [
    {
      name: 'signed-in navigation and content',
      path: '/dashboard',
      selectors: ['header > div', 'main'],
      session: 'owner',
    },
    {
      name: 'marketing header and footer',
      path: '/',
      selectors: ['header > div', 'footer > div'],
    },
  ]) {
    test(
      `${scenario.name} clear a notched phone`,
      { session: scenario.session },
      async ({ app, browser }) => {
        await app.open(scenario.path)
        for (const selector of scenario.selectors)
          await browser.locator(selector).first().waitFor()
        const before = await readPadding(browser, scenario.selectors)
        const width = await browser.evaluate(() => innerWidth)
        const gutter = width >= 1024 ? 32 : width >= 640 ? 24 : 16

        await browser.evaluate((inset) => {
          const style = document.createElement('style')
          style.textContent = `:root { --safe-left: ${inset}px; --safe-right: ${inset}px; }`
          document.head.appendChild(style)
          return null
        }, INSET)
        const after = await readPadding(browser, scenario.selectors)

        for (const padding of before)
          expect(padding).toEqual({ left: gutter, right: gutter })
        for (const padding of after) {
          expect(padding.left).toBeGreaterThanOrEqual(INSET)
          expect(padding.right).toBeGreaterThanOrEqual(INSET)
        }
      },
    )
  }
})
