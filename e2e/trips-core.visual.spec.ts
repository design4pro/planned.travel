import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  DEMO_EMAIL,
  hasSession,
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
  }

  const costsUrl = (tripId: string): RegExp =>
    new RegExp(`/trips/${tripId}/costs(\\?|$)`)

  const tripSection = (tripId: string, tab: string): RouteCase => ({
    name: `trip-${tab}`,
    path: `/trips/${tripId}/${tab}`,
    ready: TRIP_SECTIONS,
  })

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** The id behind the journal's first link to a trip rather than to a tab. */
  async function linkedTripId(page: Page): Promise<string | null> {
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

  /**
   * Open the journal and take the trip this block walks, or skip — a workspace
   * whose journal links to no trip address leaves this block nothing to measure.
   */
  async function journalTripToWalk(page: Page): Promise<string> {
    await visit(page, JOURNAL, 'light')
    const tripId = await linkedTripId(page)
    test.skip(
      tripId === null,
      'the journal lists no trip of its own, so there is no link to a trip address to walk',
    )
    // `test.skip()` above ends the test when the id is missing; this only keeps
    // the type honest for the callers.
    if (tripId === null) throw new Error('unreachable: the test was skipped')
    return tripId
  }

  /** Open a tab of a trip the long way round, and prove the strip is on it. */
  async function openTab(
    page: Page,
    tripId: string,
    tab: string,
  ): Promise<void> {
    const route = tripSection(tripId, tab)
    await visit(page, route, 'light')
    await expect(page.locator(ACTIVE_TAB)).toHaveCount(1)
    await expect(page.locator(ACTIVE_TAB)).toHaveAttribute('href', route.path)
  }

  test('a trip reopens on the tab it was left on', async ({ page }) => {
    const tripId = await journalTripToWalk(page)
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
   * neither storage object exists. A cold load therefore lands on the plan
   * however loudly this browser remembers the costs tab — the honest behaviour,
   * asserted rather than assumed, because the alternative is a hydration
   * mismatch dressed as a feature.
   *
   * Asked of the Worker as a request rather than as a navigation. That is the
   * whole claim — what the *server* answers for an address it has no memory of
   * — and it is measured without opening the planner, whose live map is the
   * most expensive document in the app and has nothing to do with this.
   */
  test('the Worker answers a trip address with the plan', async ({ page }) => {
    const tripId = await journalTripToWalk(page)
    await openTab(page, tripId, 'costs')

    // Without this the assertion below is vacuous: it would also hold for a
    // browser that had remembered nothing at all.
    const remembered = await page.evaluate(() =>
      window.localStorage.getItem('planned.trip-tab'),
    )
    expect(
      remembered,
      'the browser has to have remembered the costs tab for the next line to mean anything',
    ).toContain('costs')

    const response = await page.request.get(`/trips/${tripId}`, {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(307)
    expect(response.headers()['location']).toBe(`/trips/${tripId}/plan`)
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
    const tripId = await journalTripToWalk(page)
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
