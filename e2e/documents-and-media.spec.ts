import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
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

/** The name a pasted screenshot is stored under: local time, digits only (`files.ts` policy). */
const PASTED_PNG = /filename="(\d{8}-\d{6})\.png"/u

/**
 * The seeded trip whose library has rows, reached by a client navigation from another of its screens.
 *
 * A library with rows hydrates a relative time against the frozen clock's date when the document is
 * server-rendered, which a test that grades a silent console must not do; clicking through to the
 * screen renders it in the browser only.
 */
async function openLibraryWithFiles(
  context: BrowserContext,
  page: Page,
): Promise<() => ReturnType<ReturnType<typeof watchConsole>>> {
  const tripId = await tripIdByName(context, SEEDED_TRIPS.spanning)
  const start: RouteCase = {
    name: 'trip-people',
    path: `/trips/${tripId}/people`,
    ready: 'nav[aria-label="Trip sections"]',
  }
  const report = watchConsole(page, start)
  await visit(page, start, 'light')
  await page
    .getByRole('navigation', { name: 'Trip sections' })
    .getByRole('link', { name: 'Files' })
    .click()
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeVisible()
  return report
}

/** Answers every upload with success, and returns what the browser sent. Nothing is stored. */
async function interceptUploads(page: Page): Promise<Array<string>> {
  const bodies: Array<string> = []
  await page.route(
    (url) => callsServerFn(url, 'uploadTripFileFn'),
    async (route) => {
      const body = route.request().postDataBuffer()
      bodies.push(body === null ? '' : new TextDecoder('latin1').decode(body))
      await route.fulfill({ json: { ok: true, file: {} } })
    },
  )
  return bodies
}

/** A paste event carrying `files` (or `text`), dispatched on `selector`; true when not cancelled. */
async function dispatchPaste(
  page: Page,
  selector: string,
  payload: {
    files?: ReadonlyArray<{ name: string; type: string }>
    text?: string
  },
): Promise<boolean> {
  return page
    .locator(selector)
    .first()
    .evaluate((target, input) => {
      const data = new DataTransfer()
      for (const file of input.files ?? []) {
        data.items.add(
          new File([new Uint8Array([137, 80, 78, 71])], file.name, {
            type: file.type,
          }),
        )
      }
      if (input.text !== undefined) data.setData('text/plain', input.text)
      return target.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      )
    }, payload)
}

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
  test('a pasted screenshot enters the queue under a dated name and the queue is brought into view', async ({
    context,
    page,
  }) => {
    const report = await openLibraryWithFiles(context, page)
    const bodies = await interceptUploads(page)

    // A short window scrolled to the bottom puts the place the queue will appear above the fold, so
    // "in view" is something the paste did.
    await page.setViewportSize({
      width: page.viewportSize()?.width ?? 1440,
      height: 400,
    })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    const taken = await dispatchPaste(page, 'body', {
      files: [{ name: 'image.png', type: 'image/png' }],
    })
    expect(taken, 'a paste that carried files is cancelled').toBe(false)

    await expect.poll(() => bodies.length).toBe(1)
    expect(bodies[0]).toMatch(PASTED_PNG)
    await expect(page.locator('[data-part="file-queue"]')).toBeInViewport()

    await settleMutations(page)
    expect(report().fatal, 'the console stays silent').toEqual([])
  })

  test('a paste of text into the details dialog uploads nothing and is not cancelled', async ({
    context,
    page,
  }) => {
    const report = await openLibraryWithFiles(context, page)
    const bodies = await interceptUploads(page)

    // On the page itself, where the screen does listen, a paste with no file keeps its default.
    const onPage = await dispatchPaste(page, 'body', { text: 'Gate 14' })
    expect(onPage, 'a paste of text outside a field is not cancelled').toBe(
      true,
    )

    await page
      .getByRole('button', { name: /^Actions for / })
      .first()
      .click()
    await page.getByRole('menuitem', { name: 'Rename and describe…' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const notCancelled = await dispatchPaste(page, '[role="dialog"] textarea', {
      text: 'Gate 14, boarding at 07:40',
    })
    expect(notCancelled, 'a paste of text keeps its default').toBe(true)

    // A file paste into the same field is the field's business too.
    const fileInField = await dispatchPaste(page, '[role="dialog"] textarea', {
      files: [{ name: 'image.png', type: 'image/png' }],
    })
    expect(fileInField, 'a field and a dialog keep their own paste').toBe(true)

    await settleMutations(page)
    expect(bodies, 'nothing was uploaded').toEqual([])
    expect(report().fatal, 'the console stays silent').toEqual([])
  })

  test('a real keyboard paste of an image reaches the library with focus on Choose files', async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'the clipboard permissions this needs are Chromium’s',
    )
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const report = await openLibraryWithFiles(context, page)
    const bodies = await interceptUploads(page)

    await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 4
      canvas.height = 4
      const blob = await new Promise<Blob>((done, fail) =>
        canvas.toBlob(
          (made) => (made ? done(made) : fail(new Error('no png'))),
          'image/png',
        ),
      )
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
    })

    await page.getByRole('button', { name: 'Choose files' }).focus()
    await page.keyboard.press('ControlOrMeta+V')

    await expect.poll(() => bodies.length).toBe(1)
    expect(bodies[0]).toMatch(PASTED_PNG)

    await settleMutations(page)
    expect(report().fatal, 'the console stays silent').toEqual([])
  })

  test('the hint reads key caps first, is absent on touch and moves nothing when it fades in', async ({
    context,
    page,
  }, testInfo) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
    const route: RouteCase = {
      name: 'trip-files',
      path: `/trips/${tripId}/files`,
      ready: 'nav[aria-label="Trip sections"]',
    }
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    const hint = page.locator('[data-part="file-paste-hint"]')
    if (testInfo.project.name === 'mobile-safari') {
      await expect(hint).toBeHidden()
    } else {
      const reserved = (await hint.boundingBox())?.height
      await expect(hint).toHaveCSS('opacity', '1')
      const shown = (await hint.boundingBox())?.height
      expect(reserved, 'the line reserved its height before it showed').toBe(
        shown,
      )
      await expect(hint).toHaveText(
        /^(Ctrl|⌘)\s*V\s*pastes a copied image or screenshot$/u,
      )
    }

    expect(report().fatal, 'the console stays silent').toEqual([])
  })
})
