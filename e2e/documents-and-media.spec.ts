import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import {
  onRoute,
  SEEDED_TRIPS,
  tripIdByName,
} from './helpers/places-and-maps.ts'
import { THEMES, applyTheme } from './helpers/routes.ts'
import type { RouteCase, Theme } from './helpers/routes.ts'
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

const DROP = '[data-part="file-drop"]'

/** The Files screen of a seeded trip with no files, so the console stays silent (see above). */
async function openEmptyLibrary(
  context: BrowserContext,
  page: Page,
): Promise<() => ReturnType<ReturnType<typeof watchConsole>>> {
  const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
  const route: RouteCase = {
    name: 'trip-files',
    path: `/trips/${tripId}/files`,
    ready: 'nav[aria-label="Trip sections"]',
  }
  const report = watchConsole(page, route)
  await visit(page, route, 'light')
  return report
}

/**
 * One drag event on `selector`, carrying either a file or selected text, the way a browser builds
 * its `DataTransfer`: `types` holds `Files` for the first and `text/plain` for the second.
 */
async function drag(
  page: Page,
  selector: string,
  type: 'dragenter' | 'dragover' | 'dragleave',
  carrying: 'files' | 'text',
): Promise<void> {
  await page
    .locator(selector)
    .first()
    .evaluate(
      (target, input) => {
        const data = new DataTransfer()
        if (input.carrying === 'files') {
          data.items.add(
            new File(['x'], 'ticket.pdf', { type: 'application/pdf' }),
          )
        } else {
          data.setData('text/plain', 'Gate 14')
        }
        target.dispatchEvent(
          new DragEvent(input.type, {
            dataTransfer: data,
            bubbles: true,
            cancelable: true,
          }),
        )
      },
      { type, carrying },
    )
}

type ShiftWindow = { __shifts?: Array<number> }

async function readShifts(page: Page): Promise<Array<number>> {
  return page.evaluate(() => (window as unknown as ShiftWindow).__shifts ?? [])
}

async function shiftsLogged(page: Page): Promise<number> {
  return (await readShifts(page)).length
}

/** Records every layout shift no input caused, from before the document exists. */
async function recordShiftsFromTheStart(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = window as unknown as ShiftWindow
    log.__shifts = []
    if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift'))
      return
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        if (!entry.hadRecentInput) {
          log.__shifts?.push(entry.value)
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
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
    const queue = page.locator('[data-part="file-queue"]')
    await expect(queue).toBeInViewport()
    // Viewport intersection alone also accepts a queue hidden behind the sticky trip header.
    await expect
      .poll(() =>
        queue.evaluate((node) => {
          const rect = node.getBoundingClientRect()
          return node.contains(
            document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            ),
          )
        }),
      )
      .toBe(true)

    await settleMutations(page)
    expect(report().fatal, 'the console stays silent').toEqual([])
  })

  test('outside file drops preserve the active upload and queue', async ({
    context,
    page,
  }) => {
    await openLibraryWithFiles(context, page)
    let releaseUpload = (): void => {}
    const heldUpload = new Promise<void>((resolve) => {
      releaseUpload = resolve
    })
    let uploads = 0
    await page.route(
      (url) => callsServerFn(url, 'uploadTripFileFn'),
      async (route) => {
        uploads += 1
        await heldUpload
        await route.fulfill({ json: { ok: true, file: {} } })
      },
    )
    try {
      const uploading = page.waitForRequest((request) =>
        callsServerFn(new URL(request.url()), 'uploadTripFileFn'),
      )
      await page.locator('input[type="file"]').setInputFiles({
        name: 'held.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('held upload'),
      })
      await uploading
      const queue = page.locator('[data-part="file-queue"]')
      await expect(queue).toContainText('held.pdf')
      const before = await queue.textContent()
      const url = page.url()
      for (const selector of ['body', '[data-part="file-queue"]']) {
        for (const type of ['dragover', 'drop']) {
          const cancelled = await page
            .locator(selector)
            .evaluate((target, eventType) => {
              const data = new DataTransfer()
              data.items.add(
                new File(['outside'], 'outside.pdf', {
                  type: 'application/pdf',
                }),
              )
              const event = new DragEvent(eventType, {
                dataTransfer: data,
                bubbles: true,
                cancelable: true,
              })
              target.dispatchEvent(event)
              return event.defaultPrevented
            }, type)
          expect(cancelled).toBe(true)
        }
      }
      expect(page.url()).toBe(url)
      expect(await queue.textContent()).toBe(before)
      await expect(
        queue.getByRole('button', { name: /^Dismiss / }),
      ).toHaveCount(0)
      expect(uploads).toBe(1)
      releaseUpload()
      await expect(
        queue.getByRole('button', { name: /^Dismiss / }),
      ).toBeVisible()
      expect(uploads).toBe(1)
    } finally {
      releaseUpload()
    }
  })

  test('a pasted queue stays below the sticky chrome through upload completion and refresh', async ({
    context,
    page,
  }) => {
    await openLibraryWithFiles(context, page)
    let releaseUpload = (): void => {}
    const heldUpload = new Promise<void>((resolve) => {
      releaseUpload = resolve
    })
    await page.route(
      (url) => callsServerFn(url, 'uploadTripFileFn'),
      async (route) => {
        await heldUpload
        await route.fulfill({ json: { ok: true, file: {} } })
      },
    )
    await page.setViewportSize({ width: 1440, height: 400 })
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
    )
    const queue = page.locator('[data-part="file-queue"]')
    const chrome = page.getByRole('navigation', { name: 'Trip sections' })
    const assertRevealed = async (): Promise<void> => {
      await expect(queue).toBeInViewport({ ratio: 1 })
      await expect
        .poll(async () => {
          const queueBox = await queue.boundingBox()
          const chromeBox = await chrome.boundingBox()
          return (
            queueBox !== null &&
            chromeBox !== null &&
            queueBox.y >= chromeBox.y + chromeBox.height
          )
        })
        .toBe(true)
    }
    const uploading = page.waitForRequest((request) =>
      callsServerFn(new URL(request.url()), 'uploadTripFileFn'),
    )
    try {
      await dispatchPaste(page, 'body', {
        files: [{ name: 'image.png', type: 'image/png' }],
      })
      await uploading
      await assertRevealed()
      const refreshed = page.waitForResponse((response) =>
        callsServerFn(new URL(response.url()), 'loadTripFiles'),
      )
      releaseUpload()
      await refreshed
      await expect(
        queue.getByRole('button', { name: /^Dismiss / }),
      ).toBeVisible()
      await settleMutations(page)
      await assertRevealed()
    } finally {
      releaseUpload()
    }
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
  test('the drop zone turns active for a drag carrying files only, and holds over its own children', async ({
    context,
    page,
  }) => {
    const report = await openEmptyLibrary(context, page)
    await expect(page.locator(DROP), 'the selector matches once').toHaveCount(1)
    await expect(
      page.locator(`${DROP} [data-part="file-drop-overlay"]`),
      'and so does its overlay',
    ).toHaveCount(1)
    const zone = page.locator(DROP)
    await expect(zone).toHaveAttribute('data-state', 'idle')

    await drag(page, DROP, 'dragenter', 'text')
    await drag(page, DROP, 'dragover', 'text')
    await expect(zone, 'selected text leaves the zone idle').toHaveAttribute(
      'data-state',
      'idle',
    )

    await drag(page, DROP, 'dragenter', 'files')
    await expect(zone).toHaveAttribute('data-state', 'active')
    await expect(zone).toContainText('Drop to upload')

    // The pointer moves onto the button: it is entered, then the zone is left.
    await drag(page, `${DROP} button`, 'dragenter', 'files')
    await drag(page, DROP, 'dragleave', 'files')
    await expect(zone, 'a child crossing does not flicker').toHaveAttribute(
      'data-state',
      'active',
    )

    await drag(page, `${DROP} button`, 'dragleave', 'files')
    await expect(zone).toHaveAttribute('data-state', 'idle')

    await settleMutations(page)
    expect(report().fatal, 'the console stays silent').toEqual([])
  })

  test('the drag-over fill moves opacity only and shifts nothing; a refusal adds one bounded row', async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-safari',
      'WebKit publishes no layout-shift entries to assert against',
    )
    await recordShiftsFromTheStart(page)
    const report = await openEmptyLibrary(context, page)
    const bodies = await interceptUploads(page)
    const supported = await page.evaluate(() =>
      PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
    )
    test.skip(!supported, 'this browser reports no layout-shift entries')

    const overlay = page.locator(`${DROP} [data-part="file-drop-overlay"]`)
    await expect(overlay).toHaveCSS('transition-property', 'opacity')
    await expect(overlay).toHaveCSS('pointer-events', 'none')
    await expect(overlay).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator(DROP)).toHaveCSS('transition-duration', '0s')

    // Each mark is how many shifts the page has logged, not `performance.now()`: `visit()` pins the
    // clock with `page.clock`, which fakes `performance.now()` while an entry's `startTime` stays on
    // the real one, so a timestamp mark sits far from the entries and the check passes vacuously.
    const filled = await shiftsLogged(page)
    await drag(page, DROP, 'dragenter', 'files')
    await expect(overlay).toHaveCSS('opacity', '1')
    await settleMutations(page)
    expect(
      (await readShifts(page)).slice(filled),
      'entering the active state shifts nothing',
    ).toEqual([])

    // A refusal inserts its row into the queue, below the zone, and pushes what follows down: that
    // is the queue appearing, not the zone moving, so it is bounded rather than forbidden (the
    // spec's Amendment). One entry, well under the 0.1 that reads as a good page.
    const refused = await shiftsLogged(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from('<notes/>'),
    })
    await expect(
      page.getByRole('listitem').filter({ hasText: BLOCKED_XML }).first(),
    ).toBeVisible()
    await settleMutations(page)
    const inserted = (await readShifts(page)).slice(refused)
    expect(inserted.length, 'the row is one shift at most').toBeLessThanOrEqual(
      1,
    )
    expect(
      inserted.reduce((sum, value) => sum + value, 0),
      'and a small one',
    ).toBeLessThan(0.1)

    expect(bodies, 'the refusal sent nothing to the workspace').toEqual([])
    expect(report().fatal, 'the console stays silent').toEqual([])
  })

  test('the zone filling and a refusal are framed at three widths in both themes', async ({
    context,
    page,
  }, testInfo) => {
    const report = await openEmptyLibrary(context, page)
    const bodies = await interceptUploads(page)
    const zone = page.locator(DROP)
    const overlay = zone.locator('[data-part="file-drop-overlay"]')
    const widths = [
      { width: 360, height: 800 },
      { width: 1280, height: 900 },
      { width: 2560, height: 1440 },
    ]

    // Frames for a person to read, not for a pixel comparison (ADR 0016): attached to the run, and
    // also written to `E2E_FRAMES_DIR` when it is set - a directory outside the repository, which
    // never receives an image.
    const frame = async (name: string): Promise<void> => {
      const body = await page.screenshot({ fullPage: false })
      await testInfo.attach(`${name}.png`, { body, contentType: 'image/png' })
      const outside = process.env.E2E_FRAMES_DIR
      if (outside !== undefined) {
        await mkdir(outside, { recursive: true })
        await writeFile(join(outside, `${name}.png`), body)
      }
    }

    for (const theme of THEMES satisfies ReadonlyArray<Theme>) {
      await applyTheme(page, theme)
      for (const { width, height } of widths) {
        await page.setViewportSize({ width, height })
        const label = `${testInfo.project.name}-${width}-${theme}`
        await zone.scrollIntoViewIfNeeded()

        await drag(page, DROP, 'dragenter', 'files')
        await expect(zone).toHaveAttribute('data-state', 'active')
        await expect(overlay).toHaveCSS('opacity', '1')
        await expect(zone).toContainText('Drop to upload')
        await frame(`drop-active-${label}`)
        await drag(page, DROP, 'dragleave', 'files')
        await expect(zone).toHaveAttribute('data-state', 'idle')

        await page.locator('input[type="file"]').setInputFiles({
          name: 'notes.xml',
          mimeType: 'application/xml',
          buffer: Buffer.from('<notes/>'),
        })
        const row = page.getByRole('listitem').filter({
          has: page.getByRole('button', { name: 'Dismiss notes.xml' }),
        })
        await expect(row).toContainText(BLOCKED_XML)
        await frame(`upload-refused-${label}`)
        await page.getByRole('button', { name: 'Clear finished' }).click()
        await expect(row).toHaveCount(0)
      }
    }

    await settleMutations(page)
    expect(bodies, 'the refusals sent nothing to the workspace').toEqual([])
    expect(report().fatal, 'the console stays silent').toEqual([])
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

test.describe('06-S3b — Everyone on a trip sees its exports', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** A seeded trip with no files and no exports: the panel's real answer is the empty list. */
  async function exportsRoute(context: BrowserContext): Promise<RouteCase> {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
    return {
      name: 'trip-files',
      path: `/trips/${tripId}/files`,
      ready: 'nav[aria-label="Trip sections"]',
    }
  }

  const isList = (url: URL) => callsServerFn(url, 'listTripExportsFn')

  test('a trip with no exports reads once as a plain GET and offers one request', async ({
    context,
    page,
  }) => {
    const route = await exportsRoute(context)
    const report = watchConsole(page, route)
    const listed: Array<{ method: string; body: string | null }> = []
    page.on('request', (request) => {
      if (isList(new URL(request.url()))) {
        listed.push({ method: request.method(), body: request.postData() })
      }
    })
    const forged: Array<string> = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (callsServerFn(url, 'downloadTripExportFn')) forged.push(url.pathname)
    })
    await visit(page, route, 'light')

    const panel = page.locator('[data-part="export-panel"]')
    await expect(
      panel.getByRole('heading', { name: 'Export the trip' }),
    ).toBeVisible()
    await expect(panel.getByText('No exports yet')).toBeVisible()
    await expect(panel.locator('[data-part="export-request"]')).toHaveCount(1)
    await expect(
      panel.getByRole('checkbox', { name: 'Include confirmation codes' }),
    ).not.toBeChecked()
    await expect(panel.locator('[role="status"]')).toHaveText('')

    expect(listed).toHaveLength(1)
    expect(listed[0]?.method).toBe('GET')
    expect(listed[0]?.body).toBeNull()
    expect(forged, 'nothing asks for a download without a click').toEqual([])

    await settleMutations(page)
    expect(report().fatal, 'the console stays silent').toEqual([])
  })

  test('a skeleton holds the place while the list is in flight, and the list replaces it', async ({
    context,
    page,
  }) => {
    const route = await exportsRoute(context)
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(isList, async (handled) => {
      await held
      await handled.continue()
    })
    await visit(page, route, 'light')

    const panel = page.locator('[data-part="export-panel"]')
    await expect(panel.getByTestId('export-skeleton')).toBeVisible()
    await expect(panel.getByTestId('export-skeleton')).toHaveAttribute(
      'aria-busy',
      'true',
    )

    release()
    await expect(panel.getByText('No exports yet')).toBeVisible()
    await expect(panel.getByTestId('export-skeleton')).toHaveCount(0)
  })

  test('a failed list says so with a retry, and the retry puts focus on the heading and reads again', async ({
    context,
    page,
  }) => {
    const route = await exportsRoute(context)
    await page.route(isList, (handled) => handled.abort('failed'))
    await visit(page, route, 'light')

    const panel = page.locator('[data-part="export-panel"]')
    await expect(panel.getByRole('alert')).toContainText(
      'The list of exports did not load.',
    )

    await page.unroute(isList)
    await panel.getByRole('button', { name: 'Try again' }).click()

    await expect(panel.getByText('No exports yet')).toBeVisible()
    await expect(panel.getByRole('alert')).toHaveCount(0)
    await expect(
      panel.getByRole('heading', { name: 'Export the trip' }),
    ).toBeFocused()
  })

  test('the panel fits a 320 px screen, left to right and right to left', async ({
    context,
    page,
  }) => {
    const route = await exportsRoute(context)
    await page.setViewportSize({ width: 320, height: 800 })
    await visit(page, route, 'light')
    const panel = page.locator('[data-part="export-panel"]')
    await expect(panel.getByText('No exports yet')).toBeVisible()

    const overflow = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
    expect(await overflow(), 'no horizontal scroll').toBeLessThanOrEqual(0)

    // The reader's direction is a D1 column the shared demo user must not have changed, so the
    // mirror is applied to the document: logical properties are what is under test, not the words.
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl'
    })
    await expect(panel.getByText('No exports yet')).toBeVisible()
    expect(
      await overflow(),
      'no horizontal scroll when mirrored',
    ).toBeLessThanOrEqual(0)
  })
})

test.describe('06-S3b - Requesting a trip export', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    expect(await hasSession(page), 'The seeded demo session is available').toBe(
      true,
    )
  })

  test('sends only request flags, supports Space and keeps focus after a refused network request', async ({
    context,
    page,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
    const route: RouteCase = {
      name: 'trip-files',
      path: `/trips/${tripId}/files`,
      ready: 'nav[aria-label="Trip sections"]',
    }
    const report = watchConsole(page, route)
    const requests: Array<{ method: string; body: string }> = []
    // Never forward this mutation: even a request whose queue cannot run spends the demo allowance.
    await page.route(
      (url) => callsServerFn(url, 'requestTripExportFn'),
      async (intercepted) => {
        requests.push({
          method: intercepted.request().method(),
          body: intercepted.request().postData() ?? '',
        })
        await intercepted.fulfill({ status: 500, body: '' })
      },
    )
    const expectedNetworkFailures: Array<string> = []
    page.on('console', (message) => {
      const source = message.location().url
      if (
        message.type() === 'error' &&
        source &&
        callsServerFn(new URL(source), 'requestTripExportFn') &&
        message.text().includes('500')
      ) {
        expectedNetworkFailures.push('error: ' + message.text())
      }
    })
    await visit(page, route, 'light')
    const panel = page.locator('[data-part="export-panel"]')
    const request = panel.locator('[data-part="export-request"]')
    await expect(request).toHaveCount(1)
    await expect(request).toBeEnabled()
    await expect(panel.getByRole('status')).toHaveCount(1)
    await expect(panel.getByRole('status')).toHaveText('')
    const checkbox = panel.getByRole('checkbox', {
      name: 'Include confirmation codes',
    })
    await expect(checkbox).not.toBeChecked()
    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toBeChecked()
    await request.click()
    await expect(page.getByText('The export was not started')).toBeVisible()
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.body).toContain(tripId)
    // Decode the actual request with Start's installed serializer; never fabricate a wire frame.
    const { fromJSON } = createRequire(
      import.meta.resolve('@tanstack/react-start'),
    )('seroval') as {
      fromJSON: (value: unknown) => unknown
    }
    expect(fromJSON(JSON.parse(requests[0]?.body ?? 'null'))).toEqual({
      data: { tripId, notify: false, includeReferences: true },
    })
    expect(requests[0]?.body).not.toMatch(/@|email|address/iu)
    await expect(request).toBeEnabled()
    await expect(request).toBeFocused()
    await expect(panel.getByRole('status')).toHaveCount(1)
    await expect(panel.getByRole('status')).toHaveText('')
    await settleMutations(page)
    // The intercepted HTTP 500 has one native resource diagnostic; no app error is allowed.
    expect(expectedNetworkFailures).toHaveLength(1)
    expect(report().fatal).toEqual(expectedNetworkFailures)
  })
})

/** Phase 2: only Chromium mutates the shared fixture; both projects inspect the resting dialog. */
test.describe('06-S5b — live calendar link', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    expect(await hasSession(page), 'the demo account is provisioned').toBe(true)
  })

  for (const theme of THEMES) {
    test(`the warning and create control fit a 360px phone, ${theme}`, async ({
      context,
    }, testInfo) => {
      const tripId = await tripIdByName(context, PORTO)
      const route = filesRoute(tripId)
      const page = await context.newPage()
      try {
        await page.setViewportSize({ width: 360, height: PHONE_HEIGHT })
        const report = watchConsole(page, route)
        await visit(page, route, theme)
        await page.route(
          (url) => callsServerFn(url, 'loadCalendarFeedsFn'),
          async (request) => {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            await request.continue()
          },
        )
        let finishModuleLoad = () => {}
        const moduleReady = new Promise<void>((resolve) => {
          finishModuleLoad = resolve
        })
        await page.route(
          (url) => url.pathname.endsWith('/calendar-live.tsx'),
          async (request) => {
            await moduleReady
            await request.continue()
          },
        )
        const trigger = page.getByRole('button', {
          name: 'Live calendar link',
          exact: true,
        })
        const triggerBox = await trigger.boundingBox()
        try {
          await trigger.click()
          await expect(trigger).toHaveAttribute('aria-busy', 'true')
          await expect(trigger).toBeFocused()
          const pendingTriggerBox = await trigger.boundingBox()
          expect(pendingTriggerBox?.width).toBe(triggerBox?.width)
          expect(pendingTriggerBox?.height).toBe(triggerBox?.height)
          await page.screenshot({
            path: testInfo.outputPath(`calendar-module-loading-${theme}.png`),
            fullPage: true,
          })
        } finally {
          finishModuleLoad()
        }
        const dialog = page.getByRole('dialog', {
          name: 'Live calendar link',
          exact: true,
        })
        await expect(dialog).toBeVisible()
        await expect(dialog.locator('[aria-busy]')).toHaveAttribute(
          'aria-busy',
          'true',
        )
        await dialog.evaluate(async (element) => {
          await Promise.all(
            element
              .getAnimations({ subtree: true })
              .map((animation) => animation.finished.catch(() => undefined)),
          )
        })
        const pendingBox = await dialog.boundingBox()
        await expect(dialog.getByText(/Anyone with this link/)).toBeVisible()
        await expect(
          dialog.getByRole('button', { name: 'Create a link' }),
        ).toBeVisible()
        const loadedBox = await dialog.boundingBox()
        expect(loadedBox?.height).toBe(pendingBox?.height)
        expect(loadedBox?.y).toBe(pendingBox?.y)
        expect(await scrollsSideways(page)).toBe(false)
        const controls = await dialog.getByRole('button').all()
        for (const control of controls) {
          const box = await control.boundingBox()
          expect(box?.width).toBeGreaterThanOrEqual(24)
          expect(box?.height).toBeGreaterThanOrEqual(24)
        }
        await page.screenshot({
          path: testInfo.outputPath(`calendar-live-${theme}.png`),
          fullPage: true,
        })
        await dialog.getByRole('button', { name: 'Done', exact: true }).click()
        expect(report().fatal).toEqual([])
      } finally {
        await page.close()
      }
    })
  }

  test(
    'a keyboard-created link rotates, invalidates the old URL and ends revoked',
    { tag: '@chromium-only' },
    async ({ context, page, playwright }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.setViewportSize({ width: 320, height: PHONE_HEIGHT })
      const tripId = await tripIdByName(context, PORTO)
      await visit(page, filesRoute(tripId), 'light')
      await page.getByRole('button', { name: 'Live calendar link' }).focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', {
        name: 'Live calendar link',
        exact: true,
      })
      const create = dialog.getByRole('button', { name: 'Create a link' })
      await expect(create).toBeVisible()
      await create.focus()
      await page.keyboard.press('Enter')
      const address = dialog.getByRole('region', { name: 'Link address' })
      await expect(address).toBeFocused()
      expect(await scrollsSideways(page)).toBe(false)
      expect(
        await address.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      const tripTab = dialog.getByRole('tab', {
        name: 'This trip',
        exact: true,
      })
      const workspaceTab = dialog.getByRole('tab', {
        name: 'My trips',
        exact: true,
      })
      await tripTab.focus()
      await page.keyboard.press('ArrowRight')
      await expect(workspaceTab).toBeFocused()
      await expect(tripTab).toHaveAttribute('aria-selected', 'true')
      const savedLink = await address.textContent()
      await page.keyboard.press('Enter')
      await expect(workspaceTab).toHaveAttribute('aria-selected', 'true')
      await expect(
        dialog.getByText(/50 with the latest start dates/),
      ).toBeVisible()
      await tripTab.focus()
      await page.keyboard.press('Enter')
      await expect(address).toHaveText(savedLink ?? '')
      await address.focus()
      const url = (await address.textContent())?.trim()
      expect(url).toMatch(/\/api\/feed\/[A-Za-z0-9_-]{32}\.ics$/)
      if (!url) throw new Error('No link address')
      const unauthenticated = await playwright.request.newContext()
      try {
        const response = await unauthenticated.get(url)
        expect(response.status()).toBe(200)
        expect(response.headers()['cache-control']).toBe('private, no-store')
        expect(await response.text()).toContain('BEGIN:VCALENDAR')
        expect(await dialog.locator('a[href]').count()).toBe(0)
        await page.keyboard.press('Escape')
        const guard = page.getByRole('dialog', {
          name: 'Close without copying the link?',
        })
        await expect(guard).toBeVisible()
        await guard.getByRole('button', { name: 'Keep open' }).focus()
        await page.keyboard.press('Enter')
        await expect(guard).not.toBeVisible()
        await expect(address).toBeFocused()
        await dialog
          .getByRole('button', { name: 'Copy link', exact: true })
          .focus()
        await page.keyboard.press('Enter')
        await expect(dialog.getByRole('status')).toHaveText('Link copied')
        await dialog.getByRole('button', { name: 'Done', exact: true }).focus()
        await page.keyboard.press('Enter')
        const trigger = page.getByRole('button', {
          name: 'Live calendar link',
          exact: true,
        })
        await expect(trigger).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(dialog.getByText('Calendar link is on')).toBeVisible()
        await expect(dialog.getByText(url, { exact: true })).toHaveCount(0)
        await dialog
          .getByRole('button', { name: 'Make a new link', exact: true })
          .click()
        const rotate = page.getByRole('dialog', { name: 'Make a new link?' })
        await expect(rotate).toBeVisible()
        await rotate
          .getByRole('button', { name: 'Make a new link', exact: true })
          .click()
        await expect(address).toBeFocused()
        const newUrl = (await address.textContent())?.trim()
        if (!newUrl) throw new Error('No rotated link address')
        expect(newUrl).not.toBe(url)
        const stale = await unauthenticated.get(url)
        const unknown = await unauthenticated.get(
          url.replace(/[^/]+\.ics$/, `${'Z'.repeat(32)}.ics`),
        )
        expect(stale.status()).toBe(404)
        expect(await stale.text()).toBe(await unknown.text())
        const updated = await unauthenticated.get(newUrl)
        expect(updated.status()).toBe(200)
        expect(await updated.text()).toContain('BEGIN:VCALENDAR')
        await page.keyboard.press('Escape')
        await expect(guard).toBeVisible()
        await guard.getByRole('button', { name: 'Keep open' }).click()

        await dialog
          .getByRole('button', { name: 'Turn off', exact: true })
          .focus()
        await page.keyboard.press('Enter')
        const off = page.getByRole('dialog', {
          name: 'Turn off this calendar link?',
        })
        await off.getByRole('button', { name: 'Turn off', exact: true }).focus()
        await page.keyboard.press('Enter')
        await expect(create).toBeFocused()
        expect((await unauthenticated.get(url)).status()).toBe(404)
        expect((await unauthenticated.get(newUrl)).status()).toBe(404)
        await workspaceTab.click()
        await expect(create).toBeVisible()
        await create.focus()
        await page.keyboard.press('Enter')
        await expect(address).toBeFocused()
        const workspaceUrl = (await address.textContent())?.trim()
        if (!workspaceUrl) throw new Error('No workspace link address')
        const workspaceResponse = await unauthenticated.get(workspaceUrl)
        expect(workspaceResponse.status()).toBe(200)
        expect(await workspaceResponse.text()).toContain(
          'X-WR-CALNAME:planned.travel',
        )
        await dialog
          .getByRole('button', { name: 'Turn off', exact: true })
          .click()
        await page
          .getByRole('dialog', { name: 'Turn off this calendar link?' })
          .getByRole('button', { name: 'Turn off', exact: true })
          .click()
        await expect(create).toBeFocused()
        expect((await unauthenticated.get(workspaceUrl)).status()).toBe(404)
      } finally {
        // Even a failed assertion leaves this live credential revoked through the actual UI.
        if (
          await dialog
            .getByRole('button', { name: 'Turn off', exact: true })
            .isVisible()
            .catch(() => false)
        ) {
          await dialog
            .getByRole('button', { name: 'Turn off', exact: true })
            .click()
          await page
            .getByRole('dialog', { name: 'Turn off this calendar link?' })
            .getByRole('button', { name: 'Turn off', exact: true })
            .click()
          await expect(create).toBeVisible()
        }
        await unauthenticated.dispose()
      }
    },
  )
})

test.describe('06-S3c - Export links and remaining allowance', () => {
  test.setTimeout(90_000)
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    expect(await hasSession(page)).toBe(true)
  })

  test('marks a linked row below the headers, announces it and focuses the jump destination', async ({
    context,
    page,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
    const { toCrossJSONAsync } = createRequire(
      import.meta.resolve('@tanstack/react-start'),
    )('seroval') as {
      toCrossJSONAsync: (value: unknown) => Promise<unknown>
    }
    await page.route(
      (url) => callsServerFn(url, 'listTripExportsFn'),
      async (handled) => {
        await handled.fulfill({
          contentType: 'application/json',
          headers: { 'x-tss-serialized': 'true' },
          body: JSON.stringify(
            await toCrossJSONAsync({
              result: {
                canRequest: true,
                allowance: {
                  used: 3,
                  limit: 3,
                  month: '2026-10',
                  resetsOn: '2026-11-01',
                },
                artifacts: [
                  {
                    taskId: 'linked-export',
                    format: 'pdf',
                    sizeBytes: 2048,
                    createdAt: Date.parse('2026-08-19T12:00:00Z'),
                  },
                ],
              },
              context: {},
            }),
          ),
        })
      },
    )
    const route: RouteCase = {
      name: 'trip-files',
      path: `/trips/${tripId}/files?export=linked-export`,
      ready: '[data-part="export-panel"] [aria-current="true"]',
    }
    const report = watchConsole(page, route)
    await visit(page, route, 'light')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const panel = page.locator('[data-part="export-panel"]')
    const row = panel.locator('[aria-current="true"]')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('From your link')
    await expect(panel.getByRole('status')).toContainText('Trip export,')
    const headerBottom = await page
      .locator('nav[aria-label="Trip sections"]')
      .evaluate((node) => node.getBoundingClientRect().bottom)
    expect((await row.boundingBox())?.y).toBeGreaterThanOrEqual(headerBottom)
    const request = panel.locator('[data-part="export-request"]')
    await expect(request).toBeDisabled()
    const describedBy = await request.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(
      'starts again',
    )
    await expect(panel.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: 'Go to exports' }).click()
    const heading = panel.getByRole('heading', { name: 'Export the trip' })
    await expect(heading).toBeFocused()
    expect((await heading.boundingBox())?.y).toBeGreaterThanOrEqual(
      headerBottom,
    )
    await page.setViewportSize({ width: 320, height: 800 })
    for (const dir of ['ltr', 'rtl']) {
      await page.evaluate((direction) => {
        document.documentElement.dir = direction
      }, dir)
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0)
    }
    expect(report().fatal).toEqual([])
  })

  test('handles missing and malformed email links and restores a pending row on reload', async ({
    context,
    page,
  }) => {
    const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
    const { toCrossJSONAsync } = createRequire(
      import.meta.resolve('@tanstack/react-start'),
    )('seroval') as { toCrossJSONAsync: (value: unknown) => Promise<unknown> }
    await page.route(
      (url) => callsServerFn(url, 'listTripExportsFn'),
      async (handled) => {
        await handled.fulfill({
          contentType: 'application/json',
          headers: { 'x-tss-serialized': 'true' },
          body: JSON.stringify(
            await toCrossJSONAsync({
              result: {
                artifacts: [],
                canRequest: true,
                allowance: {
                  used: 0,
                  limit: 3,
                  month: '2026-10',
                  resetsOn: '2026-11-01',
                },
              },
              context: {},
            }),
          ),
        })
      },
    )
    const route: RouteCase = {
      name: 'trip-files',
      path: `/trips/${tripId}/files?export=unknown-export`,
      ready: '[data-part="export-panel"] [role="status"]',
    }
    const report = watchConsole(page, route)
    await visit(page, route, 'light')
    const panel = page.locator('[data-part="export-panel"]')
    await expect(panel.getByRole('status')).toHaveText(
      'That export is no longer kept. Make a new one below.',
    )
    await expect(panel.locator('[aria-current]')).toHaveCount(0)
    await page.evaluate((id) => {
      sessionStorage.setItem(
        `trip-export-pending:${id}`,
        JSON.stringify({ taskId: 'pending-reload', queuedAt: Date.now() }),
      )
    }, tripId)
    await page.reload()
    await expect(panel.locator('[data-state="pending"]')).toBeVisible({
      timeout: 20_000,
    })
    await expect(panel.locator('[data-part="export-request"]')).toBeDisabled()
    await page.goto(`/trips/${tripId}/files?export=%3Cdamaged%3E`)
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('status')).toHaveText('')
    await expect(panel.locator('[aria-current]')).toHaveCount(0)
    expect(report().fatal).toEqual([])
  })
})
