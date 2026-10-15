import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import {
  onRoute,
  SEEDED_TRIPS,
  tripIdByName,
} from './helpers/places-and-maps.ts'
import { THEMES } from './helpers/routes.ts'
import type { RouteCase } from './helpers/routes.ts'
import { callsServerFn } from './helpers/server-fn.ts'
import { settleMutations } from './helpers/settle.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'

/**
 * The documents-and-media plan's own end-to-end gate (`docs/plans/06-documents-and-media.md`).
 *
 * One `test.describe` block per stage, named for the stage, each touching no other block - the rule
 * in `docs/plans/12-verification-protocol.md` §4. These tests send nothing to the shared demo
 * workspace: a refused file never leaves the browser.
 */

/**
 * Quoted from `src/lib/i18n/messages/en/modules.ts` (`files.reject.blockedType`) rather than read
 * back through the catalogue, so a key that renders as itself, or an English sentence built in code,
 * cannot satisfy it.
 */
const BLOCKED_XML =
  '“notes.xml” was not added: XML and compressed SVG files are not stored here, for safety. Save it as a PDF or an image and add that instead.'

/** The title of the toast a lone refused file raises (`files.toast.failedOne`). */
const FAILED_ONE = 'That file did not upload'

test.describe('06-S1 — Every way a file gets in', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('an XML file is refused in the traveller’s words, on its own row and in the toast, without a request', async ({
    context,
    page,
  }) => {
    // A seeded trip with no files: a library with rows hydrates a "just now" against the frozen
    // clock's date (a mismatch this stage does not own), and this test grades a silent console.
    const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
    const route: RouteCase = {
      name: 'trip-files',
      path: `/trips/${tripId}/files`,
      ready: 'nav[aria-label="Trip sections"]',
    }

    const report = watchConsole(page, route)
    const sent: Array<string> = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (callsServerFn(url, 'uploadTripFileFn')) sent.push(url.pathname)
    })
    await visit(page, route, 'light')

    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from('<notes/>'),
    })

    // The queue's row is the one list item with a dismiss button; the toast is a list item too.
    const row = page.getByRole('listitem').filter({
      has: page.getByRole('button', { name: 'Dismiss notes.xml' }),
    })
    await expect(row).toContainText(BLOCKED_XML)

    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: FAILED_ONE })
    await expect(toast).toContainText(BLOCKED_XML)

    await settleMutations(page)
    expect(sent, 'a refused file must never leave the machine').toEqual([])
    const { fatal } = report()
    expect(fatal, 'the console stays silent').toEqual([])
  })
})

/**
 * `06-S5` — a calendar that keeps up with the trip
 * (`.ai/specs/2026-10-04-a-calendar-that-keeps-up-with-the-trip.md`).
 *
 * Phase 1 is the file: the Files screen offers the trip as an `.ics`, the server answers it as a
 * calendar, and the action fits the smallest phone the design system claims.
 */

/**
 * A seeded trip with no files: a library with rows hydrates a "just now" against the frozen clock's
 * date (a mismatch the 06-S1 block already steps around), and these tests grade a silent console.
 */
const PORTO = SEEDED_TRIPS.single

const DOWNLOAD_ACTION = 'Download calendar file (.ics)'

/** The smallest phone the design system claims, and the 320px WCAG 1.4.10 measures reflow at. */
const PHONE_WIDTHS = [320, 360] as const
const PHONE_HEIGHT = 740

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
    const tripId = await tripIdByName(context, PORTO)

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

  for (const theme of THEMES)
    for (const width of PHONE_WIDTHS) {
      test(`the action is reachable and fits at ${width}px, ${theme}`, async ({
        context,
      }) => {
        const tripId = await tripIdByName(context, PORTO)
        const route = filesRoute(tripId)
        const page = await context.newPage()
        try {
          await page.setViewportSize({ width, height: PHONE_HEIGHT })
          const report = watchConsole(page, route)
          await visit(page, route, theme)

          const action = page.getByRole('button', { name: DOWNLOAD_ACTION })
          await action.scrollIntoViewIfNeeded()
          await expect(action).toBeVisible()

          const box = await action.boundingBox()
          expect(box, 'the action is on screen').not.toBeNull()
          expect((box?.x ?? -1) >= 0).toBe(true)
          expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width)
          expect(await scrollsSideways(page), 'the page scrolls sideways').toBe(
            false,
          )
          expect(report().fatal, 'the console stays clean').toEqual([])
        } finally {
          await page.close()
        }
      })
    }
})
