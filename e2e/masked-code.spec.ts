import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit } from './helpers/console.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'

/**
 * `#213` — a masked code reveals in place and masks again when the reader moves on.
 *
 * jsdom reproduces neither of the two WebKit focus behaviours the control is built
 * around, so this is the only pin on them, and it earns its place in the
 * `mobile-safari` project (nightly on CI, local by default):
 *
 * - Safari focuses no button on a click. Without the reveal's explicit `focus()`
 *   a pointer reveal leaves nothing focused, `blur` never fires, and the code
 *   stays revealed after a click elsewhere. Chromium goes red here too, because
 *   the masked button's own `mousedown` moves no focus either.
 * - Safari blurs a focused button on `mousedown`. Without `preventDefault()` the
 *   press re-masks the code, and the release reveals it again — so the state is
 *   read *while the pointer is held*, where the two paths differ. After the
 *   release they both end on `revealed`, and a plain second click would pass
 *   either way.
 *
 * The assertions read `data-state` rather than the clipboard, which WebKit's
 * automation does not grant, and rather than the "copied" affordance, which a
 * refused write never shows.
 *
 * The seed writes no booking, so the walk adds one of its own — named for its
 * project, so the two browser projects never sweep each other's — and takes it
 * back. The preference is the member's one row and both projects write it; CI
 * never runs the two in the same job, and locally the write sits immediately
 * before the document that reads it.
 */

const MASK_SWITCH = '[data-part="mask-confirmation-codes"]'
const CODE = 'MW-4821907'

const APPEARANCE: RouteCase = {
  name: 'settings-appearance',
  path: '/settings/appearance',
  ready: 'main',
}
const TRIPS: RouteCase = { name: 'trips', path: '/trips', ready: 'main' }
const TRIP_SECTIONS = 'nav[aria-label="Trip sections"]'

async function aTrip(page: Page): Promise<string> {
  await visit(page, TRIPS, 'light')
  const href = await page
    .locator('a[href^="/trips/"][href$="/plan"]')
    .first()
    .getAttribute('href')
  const tripId = /^\/trips\/([^/?#]+)\/plan$/.exec(href ?? '')?.[1]
  test.skip(tripId === undefined, 'the workspace lists no trip to walk into')
  if (tripId === undefined) throw new Error('unreachable: the test was skipped')
  return tripId
}

/** Sets the member's preference and waits for the server to store it. */
async function maskCodes(page: Page, on: boolean): Promise<void> {
  await visit(page, APPEARANCE, 'light')
  const toggle = page.locator(MASK_SWITCH)
  if ((await toggle.getAttribute('aria-checked')) === String(on)) return
  const written = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/_serverFn/'),
  )
  await toggle.click()
  await written
  // The write is followed by a router invalidation, which is over once the
  // switch is no longer busy; a navigation before that is interrupted by it.
  await expect(toggle).toBeEnabled()
  await expect(toggle).toHaveAttribute('aria-checked', String(on))
}

test.describe('a masked code reveals in place and masks again', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('a click reveals, a held press keeps it, moving on masks it', async ({
    page,
  }, testInfo) => {
    // Two settings writes, a booking written and removed, four documents.
    test.setTimeout(120_000)

    const title = `Mask walk ${testInfo.project.name}`
    const tripId = await aTrip(page)
    const book: RouteCase = {
      name: 'trip-book-mask',
      path: `/trips/${tripId}/book`,
      ready: TRIP_SECTIONS,
    }
    const cards = page
      .locator('article')
      .filter({ has: page.locator('h4', { hasText: title }) })

    async function sweep(): Promise<void> {
      await visit(page, book, 'light')
      for (
        let left = await cards.count();
        left > 0;
        left = await cards.count()
      ) {
        await cards
          .first()
          .getByRole('button', { name: /^Actions for / })
          .click()
        await page.getByRole('menuitem', { name: 'Remove booking' }).click()
        await page
          .getByRole('dialog', { name: /^Remove / })
          .getByRole('button', { name: 'Remove booking' })
          .click()
        await expect.poll(async () => cards.count()).toBeLessThan(left)
      }
    }

    try {
      await sweep()
      await page.locator('[data-part="new-booking"]').click()
      const dialog = page.getByRole('dialog', { name: 'Add a booking' })
      await dialog.locator('[data-part="type-other"]').click()
      await dialog.getByLabel('Name').fill(title)
      await dialog.getByLabel('Confirmation number').fill(CODE)
      await dialog.getByRole('button', { name: 'Add booking' }).click()
      await expect(dialog).toBeHidden()
      // The save invalidates the route; the card is what says it has settled.
      await expect(cards).toHaveCount(1)

      await maskCodes(page, true)
      await visit(page, book, 'light')

      // Radix triggers on the card carry `data-state` too (`open`/`closed`).
      const code = cards.locator(
        '[data-state="masked"], [data-state="revealed"]',
      )
      await expect(code).toHaveAttribute('data-state', 'masked')
      await expect(cards).not.toContainText(CODE)

      await code.hover()
      await expect(code, 'a hover reveals nothing').toHaveAttribute(
        'data-state',
        'masked',
      )

      await code.click()
      await expect(code).toHaveAttribute('data-state', 'revealed')
      await expect(code).toContainText(CODE)

      // The `preventDefault()` pin: a press on the revealed code moves no focus,
      // so nothing re-masks it between the press and the release.
      await page.mouse.down()
      await expect(
        code,
        'a held press keeps the code revealed',
      ).toHaveAttribute('data-state', 'revealed')
      await page.mouse.up()

      // The `focus()` pin: only a focused code can blur when the reader moves on.
      await page.locator('h1').first().click()
      await expect(code, 'moving on masks the code').toHaveAttribute(
        'data-state',
        'masked',
      )
    } finally {
      await sweep()
      await maskCodes(page, false)
    }
  })
})
