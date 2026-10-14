import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import { SEEDED_TRIPS, tripIdByName } from './helpers/places-and-maps.ts'
import { THEMES } from './helpers/routes.ts'
import type { RouteCase, Theme } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'
import { settleMutations } from './helpers/settle.ts'

/**
 * `04-S1` - the payment dialog in a currency other than the trip's
 * (`docs/plans/04-budget-and-currencies.md`, stage 04-S1).
 *
 * The dialog is opened on the seeded Tokyo & Kyoto trip, whose accounting currency is the yen, and a
 * payment is typed in pounds: the amount that left the account, then what the payer's statement
 * shows in yen. Everything below reads what a traveller sees - roles, accessible names - and never
 * the rate, which the server derives and the dialog only prints as a hint.
 *
 * The frames are written next to the report (`testInfo.outputPath`), one per theme and width, for
 * the pull request. No frame is compared against a stored image (ADR 0016). The screenshot harness
 * the plan names (`shoot.ts`, `capture.mjs`) is not built; this spec stands on the helpers the
 * other module specs use.
 */

const TRIP = SEEDED_TRIPS.spanning
const PICKER = '[data-part="payment-currency"]'
const WIDTHS: ReadonlyArray<number> = [360, 1280, 2560]
const HEIGHT = 900

/** Two cold routes and a dialog on a dev server: the budget of the other module journeys. */
const JOURNEY_TIMEOUT_MS = 180_000

function costsRoute(tripId: string): RouteCase {
  return { name: 'trip-costs', path: `/trips/${tripId}/costs`, ready: 'main' }
}

/** The dialog open on a pound payment, with both amounts typed and the rate hint showing. */
async function openForeignPayment(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add payment' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Record a payment' })
  await expect(dialog).toBeVisible()

  // The attribute the evidence is driven through must exist exactly once in the running app.
  await expect(page.locator(PICKER)).toHaveCount(1)
  await expect(
    dialog.getByLabel(/Converted to/),
    'the converted field stays hidden until the currency differs',
  ).toHaveCount(0)

  await page.locator(PICKER).getByRole('combobox').click()
  await page.getByRole('option', { name: /GBP/ }).click()

  await dialog.getByLabel(/Amount in GBP/).fill('596.00')
  await dialog.getByLabel(/Converted to [A-Z]{3}/).fill('46,488')
  await expect(dialog.getByText(/^1 GBP = .+ [A-Z]{3}$/)).toBeVisible()
  await settleMutations(page)
}

test.describe('04-S1 — payment currency', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    test.setTimeout(JOURNEY_TIMEOUT_MS)
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('a payment in pounds reveals the converted field and the rate it implies', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, TRIP)
    const page = await context.newPage()
    try {
      const route = costsRoute(tripId)
      const watched = watchConsole(page, route)
      await visit(page, route, 'light')

      await openForeignPayment(page)

      const dialog = page.getByRole('dialog', { name: 'Record a payment' })
      await expect(
        dialog.getByRole('button', { name: 'Record payment' }),
      ).toBeEnabled()
      // Back to the trip's own currency, the extra field goes again.
      await page.locator(PICKER).getByRole('combobox').click()
      await page.getByRole('option', { name: /JPY/ }).click()
      await expect(dialog.getByLabel(/Converted to/)).toHaveCount(0)

      expect(watched().fatal, 'the console must be clean').toEqual([])
    } finally {
      await page.close()
    }
  })

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`the foreign-currency payment dialog, ${theme}, ${width}px`, async ({
        context,
      }, testInfo) => {
        const tripId = await tripIdByName(context, TRIP)
        const page = await context.newPage()
        try {
          await frame(page, tripId, theme, width, testInfo)
        } finally {
          await page.close()
        }
      })
    }
  }
})

/** One frame: the dialog at rest on a foreign-currency payment, written beside the report. */
async function frame(
  page: Page,
  tripId: string,
  theme: Theme,
  width: number,
  testInfo: TestInfo,
): Promise<void> {
  const route = costsRoute(tripId)
  const watched = watchConsole(page, route)
  await page.setViewportSize({ width, height: HEIGHT })
  await visit(page, route, theme)
  await openForeignPayment(page)

  await page.screenshot({
    path: testInfo.outputPath(`foreign-payment-${width}-${theme}.png`),
  })
  expect(watched().fatal, 'the console must be clean').toEqual([])
}
