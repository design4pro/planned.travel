import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import { SEEDED_TRIPS, tripIdByName } from './helpers/places-and-maps.ts'
import { THEMES } from './helpers/routes.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'

/**
 * The filter bar over the Expenses list, at the narrowest width the product claims to support.
 *
 * `docs/SPEC.md` §2 requires 360px to work. The bar held its controls in one strip that scrolled
 * sideways with nothing to say so, and the controls past the page's edge - the day select, the
 * view tabs - were simply not there for a phone. What is asserted is that every control is inside the
 * viewport and that nothing in the bar is wider than the bar. The bar does not vary by trip role, so
 * the demo owner is the only account the journey needs.
 *
 * Chromium only, once per theme, at an explicit width: the claim is about layout, not about two engines.
 */

const TRIP = SEEDED_TRIPS.spanning
const WIDTH = 360
const HEIGHT = 800

/** Two cold routes on a dev server: the budget of the other module journeys. */
const JOURNEY_TIMEOUT_MS = 180_000

const FILTERS = '[data-part="costs-filters"]'

function costsRoute(tripId: string): RouteCase {
  return { name: 'trip-costs', path: `/trips/${tripId}/costs`, ready: 'main' }
}

/**
 * Whether the bar, or any of its children, is wider than the box it sits in.
 *
 * The screen-reader-only live region is left out: it is a clipped 1px box by construction.
 */
async function overflowsSideways(page: Page): Promise<boolean> {
  return page
    .locator(FILTERS)
    .evaluate(
      (bar) =>
        bar.scrollWidth > bar.clientWidth ||
        Array.from(bar.querySelectorAll('*:not(.sr-only)')).some(
          (child) =>
            child.getBoundingClientRect().right >
              bar.getBoundingClientRect().right + 0.5 ||
            child.getBoundingClientRect().left <
              bar.getBoundingClientRect().left - 0.5,
        ),
    )
}

/**
 * The view tab labels of the catalogue's longest words, in the order of the three tabs (all, paid by
 * me, owed to me): `nl`, `tr`, `el` and `de` as written in `src/lib/i18n/messages/<locale>/`, then
 * the three longest single words together, so the active tab (semibold, two-digit count) carries one.
 * The locale is a stored setting of the account, so the labels are put into the tabs here rather
 * than switching the demo user's language for a layout check.
 */
const LONG_TAB_LABELS: ReadonlyArray<ReadonlyArray<string>> = [
  ['Alle', 'Door mij betaald', 'Mij verschuldigd'],
  ['Tümü', 'Benim ödediklerim', 'Bana borçlu olunan'],
  ['Όλα', 'Πληρωμένα από εμένα', 'Μου οφείλουν'],
  ['Alle', 'Von mir bezahlt', 'Mir geschuldet'],
  ['Mij verschuldigd', 'Benim ödediklerim', 'Πληρωμένα από εμένα'],
]

/**
 * The tabs whose content (label and count) reaches past the tab's own content box, the border box
 * less its horizontal padding: a word that only runs into the padding already crowds the next tab.
 */
async function spillingTabs(bar: Locator): Promise<Array<string>> {
  return bar.getByRole('tab').evaluateAll((tabs) =>
    tabs
      .filter((tab) => {
        const range = document.createRange()
        range.selectNodeContents(tab)
        const content = range.getBoundingClientRect()
        const box = tab.getBoundingClientRect()
        const style = getComputedStyle(tab)
        const left = box.left + Number.parseFloat(style.paddingLeft)
        const right = box.right - Number.parseFloat(style.paddingRight)
        return content.left < left - 0.5 || content.right > right + 0.5
      })
      .map((tab) => tab.textContent ?? ''),
  )
}

/**
 * Replace the text of each tab's label, keeping the count that follows it, and check that it took:
 * a tab whose label is not a bare text node would otherwise keep its English text and pass.
 */
async function relabelTabs(
  bar: Locator,
  labels: ReadonlyArray<string>,
): Promise<void> {
  await bar.getByRole('tab').evaluateAll((tabs, next) => {
    tabs.forEach((tab, index) => {
      const label = Array.from(tab.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE,
      )
      if (label !== undefined) label.textContent = next[index] ?? ''
    })
  }, labels)
  for (const [index, label] of labels.entries()) {
    await expect(bar.getByRole('tab').nth(index)).toContainText(label)
  }
}

test.describe('the costs filter bar on a phone', () => {
  test.beforeEach(async ({ context, page, baseURL }, testInfo) => {
    test.setTimeout(JOURNEY_TIMEOUT_MS)
    test.skip(
      testInfo.project.name !== 'chromium',
      'driven once at an explicit width rather than once per project viewport',
    )
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session - run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  for (const theme of THEMES) {
    test(`every control is inside a ${WIDTH}px viewport, ${theme}`, async ({
      context,
    }) => {
      const tripId = await tripIdByName(context, TRIP)
      const page = await context.newPage()
      try {
        const route = costsRoute(tripId)
        const watched = watchConsole(page, route)
        await page.setViewportSize({ width: WIDTH, height: HEIGHT })
        await visit(page, route, theme)

        // The attribute the evidence is driven through must exist exactly once in the running app.
        await expect(page.locator(FILTERS)).toHaveCount(1)
        const bar = page.locator(FILTERS)
        // The bar sits below the stat tiles, so bring it up: in-viewport is then a statement about
        // the horizontal edge alone.
        await bar.scrollIntoViewIfNeeded()

        const controls = [
          bar.getByRole('searchbox', { name: 'Search expenses' }),
          bar.getByRole('combobox', { name: 'Display currency' }),
          bar.getByRole('combobox', { name: 'Filter by category' }),
          bar.getByRole('combobox', { name: 'Filter by day' }),
          bar.getByRole('tab', { name: /^All\b/ }),
          bar.getByRole('tab', { name: /^Paid by me/ }),
          bar.getByRole('tab', { name: /^I'm owed/ }),
        ]
        for (const control of controls) {
          await expect(control).toBeInViewport({ ratio: 1 })
        }

        expect(
          await overflowsSideways(page),
          'nothing in the bar may be wider than the bar',
        ).toBe(false)
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth,
          ),
          'the page itself may not scroll sideways',
        ).toBe(false)

        // The view tabs share the bar's full width: three triggers, edge to edge.
        const list = bar.getByRole('tablist', { name: 'Whose expenses' })
        const listBox = await list.boundingBox()
        const barBox = await bar.boundingBox()
        expect(listBox?.width ?? 0).toBeGreaterThanOrEqual(
          (barBox?.width ?? Infinity) - 1,
        )

        // Each tab holds its own label and count, in English and in the longest labels there are.
        expect(await spillingTabs(bar), 'no tab may spill its content').toEqual(
          [],
        )
        for (const labels of LONG_TAB_LABELS) {
          await relabelTabs(bar, labels)
          expect(
            await spillingTabs(bar),
            `no tab may spill its content with ${labels.join(' / ')}`,
          ).toEqual([])
          expect(
            await overflowsSideways(page),
            `the bar may not widen with ${labels.join(' / ')}`,
          ).toBe(false)
        }

        // Keyboard order is the reading order: search, then the selects, then the tabs.
        await controls[0].focus()
        for (const next of controls.slice(1, 4)) {
          await page.keyboard.press('Tab')
          await expect(next).toBeFocused()
        }
        await page.keyboard.press('Tab')
        await expect(list.getByRole('tab', { selected: true })).toBeFocused()

        const output = watched()
        expect(output.fatal, 'the console must be clean').toEqual([])
        if (output.tolerated.length > 0) {
          test.info().annotations.push({
            type: 'tolerated console output',
            description: `${route.path}: ${output.tolerated.join('\n')}`,
          })
        }
      } finally {
        await page.close()
      }
    })
  }
})
