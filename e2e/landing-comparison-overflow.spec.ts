import type { Locator } from '@playwright/test'

import { expect, test } from '@playwright/test'

// Fonts must cover the label at its actual weight before layout is evidence.
async function loadedComparisonFont(link: Locator) {
  return link.evaluate((element) => {
    const style = getComputedStyle(element)
    const weight = Number(style.fontWeight)
    const faces = Array.from(document.fonts).filter((face) => {
      const weights = face.weight.split(' ').map(Number)
      return (
        face.family.replace(/["']/g, '') === 'Geist' &&
        face.style === style.fontStyle &&
        face.status === 'loaded' &&
        weight >= weights[0] &&
        weight <= (weights[1] ?? weights[0])
      )
    })
    return (
      Array.from(element.textContent ?? '').every((character) => {
        const point = character.codePointAt(0) ?? -1
        return faces.some((face) =>
          face.unicodeRange.split(',').some((range) => {
            const [start, end = start] = range
              .trim()
              .replace(/^U\+/i, '')
              .split('-')
            return (
              point >= Number.parseInt(start.replace(/\?/g, '0'), 16) &&
              point <= Number.parseInt(end.replace(/\?/g, 'F'), 16)
            )
          }),
        )
      }) && faces.length > 0
    )
  })
}

for (const locale of ['uk', 'en', 'fr', 'de', 'ar']) {
  test(`landing comparison remains readable and usable in ${locale}`, async ({
    browser,
    baseURL,
    browserName,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL,
      // The server fixture clock pin must not reach public font providers.
      extraHTTPHeaders: {},
      locale,
      viewport: { width: 360, height: 800 },
    })
    try {
      const page = await context.newPage()
      const comparison = page
        .locator('#plans')
        .getByRole('link')
        .and(page.locator('[href="/pricing"]'))

      await page.goto('/', { waitUntil: 'networkidle' })
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await page.evaluate(() => document.fonts.ready)
      await comparison.scrollIntoViewIfNeeded()
      if (locale === 'uk') {
        const matchingFontLoaded = await loadedComparisonFont(comparison)
        await testInfo.attach('comparison-font', {
          body: JSON.stringify({ matchingFontLoaded }),
          contentType: 'application/json',
        })
        expect(
          matchingFontLoaded,
          'Environment prerequisite: Geist must cover the Ukrainian label at its rendered weight',
        ).toBe(true)
        if (browserName === 'chromium') {
          const cdp = await context.newCDPSession(page)
          try {
            await cdp.send('DOM.enable')
            await cdp.send('CSS.enable')
            const document = await cdp.send('DOM.getDocument')
            const node = await cdp.send('DOM.querySelector', {
              nodeId: document.root.nodeId,
              selector: '#plans a[href="/pricing"]',
            })
            const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', {
              nodeId: node.nodeId,
            })
            await testInfo.attach('comparison-glyph-fonts', {
              body: JSON.stringify(fonts),
              contentType: 'application/json',
            })
            const usedFonts = fonts.filter((font) => font.glyphCount > 0)
            expect(usedFonts.length).toBeGreaterThan(0)
            expect(
              usedFonts.every(
                (font) => font.isCustomFont && font.familyName === 'Geist',
              ),
              'Environment prerequisite: the actual Ukrainian glyphs must use Geist',
            ).toBe(true)
          } finally {
            await cdp.detach()
          }
        }
      }

      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        const geometry = await comparison.evaluate((link) => {
          const bounds = link.getBoundingClientRect()
          const text = document.createRange()
          text.selectNodeContents(link)
          const header = document.querySelector('header')
          return {
            documentWidth: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth,
            left: bounds.left,
            right: bounds.right,
            clipped: link.scrollHeight > link.clientHeight,
            textInside: Array.from(text.getClientRects()).every(
              (rect) =>
                rect.left >= bounds.left &&
                rect.right <= bounds.right &&
                rect.top >= bounds.top &&
                rect.bottom <= bounds.bottom,
            ),
            headerWidth: header?.clientWidth,
            headerScrollWidth: header?.scrollWidth,
          }
        })
        await testInfo.attach('comparison-geometry-' + width, {
          body: JSON.stringify(geometry),
          contentType: 'application/json',
        })
        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport)
        expect(geometry.left).toBeGreaterThanOrEqual(0)
        expect(geometry.right).toBeLessThanOrEqual(geometry.viewport)
        expect(geometry.clipped).toBe(false)
        expect(geometry.textInside).toBe(true)
        expect(geometry.headerWidth).toBe(width)
        expect(geometry.headerScrollWidth).toBe(width)
      }

      if (locale === 'uk') {
        await page.setViewportSize({ width: 360, height: 800 })
        await comparison.click()
        await expect(page).toHaveURL(/\/pricing$/)

        await page.goto('/', { waitUntil: 'networkidle' })
        await comparison.scrollIntoViewIfNeeded()
        await comparison.focus()
        // macOS WebKit includes links in keyboard navigation with Option-Tab.
        const modifier =
          browserName === 'webkit' && process.platform === 'darwin'
            ? 'Alt+'
            : ''
        await page.keyboard.press(`${modifier}Tab`)
        await page.keyboard.press(`${modifier}Shift+Tab`)
        await expect(comparison).toBeFocused()
        await expect
          .poll(() =>
            comparison.evaluate((link) => {
              const style = getComputedStyle(link)
              return (
                link.matches(':focus-visible') &&
                style.outlineStyle !== 'none' &&
                Number.parseFloat(style.outlineWidth) >= 2
              )
            }),
          )
          .toBe(true)
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(/\/pricing$/)
      }
    } finally {
      await context.close()
    }
  })
}
