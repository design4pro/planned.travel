import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { onRoute, tripIdByName } from './helpers/places-and-maps.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'

/**
 * `06-S5` — a calendar that keeps up with the trip
 * (`.ai/specs/2026-10-04-a-calendar-that-keeps-up-with-the-trip.md`).
 *
 * Phase 1 is the file: the Files screen offers the trip as an `.ics`, the server answers it as a
 * calendar, and the action fits the smallest phone the design system claims.
 */

const LISBON = 'Lisbon, slowly'

const DOWNLOAD_ACTION = 'Download calendar file (.ics)'

/** The smallest phone the design system claims. */
const PHONE = { width: 360, height: 740 } as const

function filesRoute(tripId: string): RouteCase {
  return {
    name: 'trip-files',
    path: `/trips/${tripId}/files`,
    ready: 'nav[aria-label="Trip sections"]',
  }
}

/** Whether the page scrolls sideways: the signature of an action that does not fit its screen. */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
}

test.describe('06-S5 — a calendar that keeps up with the trip', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('the Files screen offers the trip as a calendar file, and the server answers it as one', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, LISBON)

    await onRoute(context, filesRoute(tripId), async (page) => {
      const action = page.getByRole('button', { name: DOWNLOAD_ACTION })
      await expect(action).toBeVisible()

      const answered = page.waitForResponse((response) =>
        (response.headers()['content-type'] ?? '').startsWith('text/calendar'),
      )
      const saved = page.waitForEvent('download')
      await action.click()

      const response = await answered
      expect(response.status()).toBe(200)
      expect(response.headers()['cache-control']).toBe('private, no-store')
      expect(response.headers()['content-disposition']).toMatch(
        /^attachment; filename\*=UTF-8''.+\.ics$/,
      )
      expect((await saved).suggestedFilename()).toMatch(/\.ics$/)

      // The button is usable again once the file has been handed over.
      await expect(action).toBeEnabled()
    })
  })

  test('the action is reachable and fits at 360px', async ({ context }) => {
    const tripId = await tripIdByName(context, LISBON)

    await onRoute(context, filesRoute(tripId), async (page) => {
      await page.setViewportSize(PHONE)
      const action = page.getByRole('button', { name: DOWNLOAD_ACTION })
      await action.scrollIntoViewIfNeeded()
      await expect(action).toBeVisible()

      const box = await action.boundingBox()
      expect(box, 'the action is on screen').not.toBeNull()
      expect((box?.x ?? -1) >= 0).toBe(true)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(PHONE.width)
      expect(await scrollsSideways(page), 'the page scrolls sideways').toBe(
        false,
      )
    })
  })
})
