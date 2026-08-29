import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  DEMO_EMAIL,
  hasSession,
  settle,
  useSession,
  visit,
  watchConsole,
} from './helpers/shoot.ts'
import type { RouteCase } from './helpers/shoot.ts'

/**
 * The trips-core plan's own end-to-end gate (`docs/plans/01-trips-core.md`).
 *
 * One `test.describe` block per stage, named for the stage, each declaring its
 * own route table and touching no other block — so two stages of the same wave
 * can append here without either editing the other's evidence.
 */

/**
 * The sub-navigation, addressed by role, accessible name and a published ARIA
 * state rather than by a class name. Both are asserted to resolve before
 * anything is concluded from them.
 */
const TRIP_SECTIONS = 'nav[aria-label="Trip sections"]'
const ACTIVE_TAB = `${TRIP_SECTIONS} a[aria-current="page"]`

test.describe('01-S3 — A trip reopens on the tab you left it on', () => {
  /**
   * This block's route table. `/journey` earns its place rather than being a
   * detour: its "Waiting for a story" list is the product's one link to a
   * trip's *own* address, `/trips/<id>`, and that address is where the
   * remembered tab is read. Every other surface links straight into a tab.
   */
  const JOURNAL: RouteCase = {
    name: 'journal',
    path: '/journey',
    ready: 'main',
    relativeTime: true,
  }

  const costsUrl = (tripId: string): RegExp =>
    new RegExp(`/trips/${tripId}/costs(\\?|$)`)

  /**
   * `map` is declared rather than sniffed, and the planner is the one tab in
   * this table that carries one: `settle()` refuses a route that mounts a live
   * canvas without saying so.
   */
  const tripSection = (tripId: string, tab: string, map?: true): RouteCase => ({
    name: `trip-${tab}`,
    path: `/trips/${tripId}/${tab}`,
    ready: TRIP_SECTIONS,
    ...(map === true ? { map } : {}),
  })

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** The id behind the journal's first link to a trip rather than to a tab. */
  async function unwrittenTripId(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      for (const anchor of document.querySelectorAll('a[href^="/trips/"]')) {
        const match = /^\/trips\/([^/?#]+)$/.exec(
          anchor.getAttribute('href') ?? '',
        )
        if (match !== null) return match[1]
      }
      return null
    })
  }

  /** Open a tab of a trip the long way round, and prove the strip is on it. */
  async function openTab(
    page: Page,
    tripId: string,
    tab: string,
  ): Promise<void> {
    const route = tripSection(tripId, tab)
    const response = await page.goto(route.path, {
      waitUntil: 'domcontentloaded',
    })
    expect(
      response?.status() ?? 0,
      `${route.path} should not be an error response`,
    ).toBeLessThan(400)
    await settle(page, route)
    await expect(page.locator(ACTIVE_TAB)).toHaveCount(1)
    await expect(page.locator(ACTIVE_TAB)).toHaveAttribute('href', route.path)
  }

  test('a trip reopens on the tab it was left on', async ({ page }) => {
    await visit(page, JOURNAL, 'light')

    const tripId = await unwrittenTripId(page)
    test.skip(
      tripId === null,
      'the journal lists no trip of its own, so there is no link to a trip address to walk',
    )
    if (tripId === null) return

    await openTab(page, tripId, 'costs')

    /**
     * Watched from here rather than from the first navigation, because from
     * here on is this stage's own surface: the journal, the walk into the trip
     * address and the redirect that reads the browser's storage. A hydration
     * mismatch is the specific failure that redirect risks, and React 19
     * reports one as both an uncaught error and a `console.error`.
     *
     * The cold load of the costs tab above is deliberately outside the window.
     * It carries a hydration mismatch of its own, on `mobile-safari` only and
     * at HEAD before this stage — the expense day headings render "Wed, 19 Aug"
     * from the Worker and "Wed 19 Aug" from WebKit's `Intl`. That belongs to
     * whoever owns the date format, not to this block, and swallowing it here
     * as a tolerated warning would hide it from them.
     */
    const report = watchConsole(page, JOURNAL)

    // Leave the trip entirely, then walk back into it the way a reader does.
    await visit(page, JOURNAL, 'light')
    await page.click(`a[href="/trips/${tripId}"]`)

    // The costs route carries its own `view` search parameter, so the tab is the
    // end of the path rather than the end of the address.
    await expect(page).toHaveURL(costsUrl(tripId))
    await expect(page.locator(ACTIVE_TAB)).toHaveAttribute(
      'href',
      `/trips/${tripId}/costs`,
    )

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The other half of the same contract, and the reason the redirect is guarded
   * on `typeof window`: `beforeLoad` runs on the Worker for a cold load, where
   * no storage exists. A cold load therefore lands on the plan however loudly
   * the browser remembers the costs tab — the honest behaviour, asserted rather
   * than assumed, because the alternative is a hydration mismatch dressed as a
   * feature.
   */
  test('a cold load of a trip address lands on the plan', async ({ page }) => {
    await visit(page, JOURNAL, 'light')
    const tripId = await unwrittenTripId(page)
    test.skip(
      tripId === null,
      'the journal lists no trip of its own, so there is no link to a trip address to walk',
    )
    if (tripId === null) return

    await openTab(page, tripId, 'costs')

    const route = tripSection(tripId, 'plan', true)
    const report = watchConsole(page, route)
    await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/plan$`))
    await settle(page, route)
    await expect(page.locator(ACTIVE_TAB)).toHaveAttribute('href', route.path)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The lifetime assertion, and the one a `sessionStorage`-backed module would
   * fail: `sessionStorage` is per tab by construction, so a second page in the
   * same context is the cheapest measurement that tells the two areas apart
   * from outside the code.
   */
  test('the memory outlives the tab that made it', async ({
    context,
    page,
  }) => {
    await visit(page, JOURNAL, 'light')
    const tripId = await unwrittenTripId(page)
    test.skip(
      tripId === null,
      'the journal lists no trip of its own, so there is no link to a trip address to walk',
    )
    if (tripId === null) return

    await openTab(page, tripId, 'costs')

    const second = await context.newPage()
    try {
      const report = watchConsole(second, JOURNAL)
      await visit(second, JOURNAL, 'light')
      await second.click(`a[href="/trips/${tripId}"]`)

      await expect(second).toHaveURL(costsUrl(tripId))
      const verdict = report()
      expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
    } finally {
      await second.close()
    }
  })
})
