import { expect, test } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import { tripIdByName } from './helpers/places-and-maps.ts'
import type { RouteCase } from './helpers/routes.ts'
import { signIn } from './helpers/session.ts'

/**
 * The costs tab as the two non-owner trip roles meet it.
 *
 * The header always offers "Export CSV"; "Settle up" and "Add expense" belong to the people who can
 * write, and everyone else gets a notice saying so (#837). The demo owner owns every trip, so no other
 * journey can see either rendering. Each journey signs in as a fixture person of its own, from a cookie
 * jar cleared first, so the cached owner session is never the one answering - and a sign-in that fails
 * fails the journey: an unseeded fixture must not read as green.
 *
 * Jonas is a `viewer` on Lisbon (the seed adds that row for this journey) and an `editor` on
 * Dolomites. The brief named Priya for the editor, but the seed suspends her, so she cannot sign in.
 *
 * Chromium only, one sign-in per journey: `/sign-in/email` allows ten a minute across the whole run,
 * and the gate is about the role, not about two engines.
 */

const VIEWER_TRIP = 'Lisbon, slowly'
const EDITOR_TRIP = 'Dolomites, hut to hut'
const JONAS = 'jonas@planned.travel'

/** Two cold routes on a dev server: the budget of the other module journeys. */
const JOURNEY_TIMEOUT_MS = 180_000

function costsRoute(tripId: string): RouteCase {
  return { name: 'trip-costs', path: `/trips/${tripId}/costs`, ready: 'main' }
}

test.describe('the costs tab by trip role', () => {
  test.beforeEach(async ({ context, page, baseURL }, testInfo) => {
    test.setTimeout(JOURNEY_TIMEOUT_MS)
    test.skip(
      testInfo.project.name !== 'chromium',
      'the role gate is not engine-specific, and each journey spends one of the ten sign-ins a minute',
    )
    await context.clearCookies()
    expect(
      await signIn(page, baseURL, JONAS),
      `${JONAS} could not sign in - run \`node scripts/seed/seed.mjs\``,
    ).toBe(true)
  })

  test('a trip viewer reads the costs, sees the notice and can export, but cannot write', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, VIEWER_TRIP)
    const page = await context.newPage()
    try {
      const route = costsRoute(tripId)
      const watched = watchConsole(page, route)
      await visit(page, route, 'light')

      await expect(
        page.getByText('You can read the costs, not change them'),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(
        0,
      )
      await expect(
        page.getByRole('button', { name: 'Add expense' }),
      ).toHaveCount(0)

      const exportCsv = page.getByRole('button', { name: 'Export CSV' })
      await expect(exportCsv).toBeVisible()
      const saved = page.waitForEvent('download')
      await exportCsv.click()
      expect((await saved).suggestedFilename()).toMatch(/\.csv$/)

      expect(watched().fatal, 'the console must be clean').toEqual([])
    } finally {
      await page.close()
    }
  })

  test('a trip editor sees every write control and no read-only notice', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, EDITOR_TRIP)
    const page = await context.newPage()
    try {
      const route = costsRoute(tripId)
      const watched = watchConsole(page, route)
      await visit(page, route, 'light')

      await expect(
        page.getByRole('button', { name: 'Settle up' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Add expense' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Export CSV' }),
      ).toBeVisible()
      await expect(
        page.getByText('You can read the costs, not change them'),
      ).toHaveCount(0)

      expect(watched().fatal, 'the console must be clean').toEqual([])
    } finally {
      await page.close()
    }
  })
})
