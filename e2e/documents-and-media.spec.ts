import { expect, test } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import { SEEDED_TRIPS, tripIdByName } from './helpers/places-and-maps.ts'
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
    const tripId = await tripIdByName(context, SEEDED_TRIPS.spanning)
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

    const row = page.getByRole('listitem').filter({ hasText: 'notes.xml' })
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
