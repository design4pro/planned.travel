import { expect, test } from '@playwright/test'
import { pinDemoLanguage, signIn, useSession } from './helpers/session'
import { unblockCrossOriginFonts, visit, watchConsole } from './helpers/console'
import { callsServerFn } from './helpers/server-fn'
import { showDays } from './helpers/trip-weather'
import { restingCamera } from './helpers/places-and-maps'
import { readCaptureState, settle } from './helpers/settle'

const tripId = 'demo-trip-02-lisbon-long-weekend'
const path = `/trips/${tripId}/plan`
test.beforeEach(async ({ context, page, baseURL }) => {
  test.setTimeout(120_000)
  await useSession(context, page, baseURL)
  await unblockCrossOriginFonts(page)
  await page.route('https://*.ingest.us.sentry.io/**', (route) =>
    route.continue(),
  )
})

test('Day reading stays nonmodal, minimises, reopens and switches to a Place', async ({
  page,
}) => {
  const consoleReport = watchConsole(page, {
    name: 'trip-plan',
    path,
    ready: 'nav[aria-label="Trip sections"]',
    map: true,
  })
  let reads = 0
  page.on('request', (request) => {
    if (callsServerFn(new URL(request.url()), 'loadBookingDeskFn')) reads++
  })
  await visit(
    page,
    {
      name: 'trip-plan',
      path,
      ready: 'nav[aria-label="Trip sections"]',
      map: true,
    },
    'light',
  )
  await expect(page.locator('[data-plan-loaded]')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.locator('[data-workspace-splash]')).toHaveCount(0, {
    timeout: 60_000,
  })
  await showDays(page)
  const day = page.locator('[data-planner-day]').first()
  const header = day.locator('[data-planner-day-header]')
  await header.focus()
  await expect(header).toBeFocused()
  await page.keyboard.press('Enter')
  const panel = page.locator('[data-day-detail]')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { level: 2 })).toBeFocused()
  await expect(
    panel.getByRole('heading', { name: 'Stays', exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole('heading', { name: 'Notes', exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole('heading', { name: 'Reservations', exact: true }),
  ).toBeVisible()
  await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  expect(reads).toBe(1)
  const geometry = await panel.boundingBox()
  const workspace = await page.locator('[data-plan-loaded]').boundingBox()
  expect(
    geometry && workspace && geometry.height <= workspace.height / 2 + 1,
  ).toBe(true)
  await panel.getByRole('button', { name: 'Minimise day details' }).click()
  await expect(
    panel.getByRole('button', { name: 'Expand day details' }),
  ).toBeFocused()
  await expect(
    panel.getByRole('heading', { name: 'Notes', exact: true }),
  ).toHaveCount(0)
  await panel.getByRole('button', { name: 'Expand day details' }).click()
  await expect(panel.getByRole('heading', { level: 2 })).toBeFocused()
  expect(reads).toBe(1)
  await page.locator('[data-plan-loaded] > h1').focus()
  await page.keyboard.press('Escape')
  await expect(panel).toBeVisible()
  await panel.getByRole('heading', { level: 2 }).focus()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await showDays(page)
  await header.click()
  await expect(panel).toBeVisible()
  expect(reads).toBe(1)
  await showDays(page)
  const placeRow = page.locator('[data-planner-place]').first()
  const placeId = await placeRow.getAttribute('data-planner-place')
  const placeName = await placeRow.locator('span.text-label').innerText()
  await placeRow.locator(':scope > button:not([aria-roledescription])').click()
  await expect(panel).toHaveCount(0)
  const placeDetail = page.getByRole('region', { name: placeName, exact: true })
  if (placeId === null) throw new Error('Place row has no identifier')
  await expect(placeDetail).toHaveAttribute('data-place-detail', placeId)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const outside = page.locator('[data-plan-loaded] > h1')
  await outside.focus()
  await page.mouse.move(0, 0)
  await expect(placeDetail).toBeInViewport({ ratio: 1 })
  await expect(placeDetail).toContainText(placeName)
  await showDays(page)
  await header.click()
  await expect(panel).toBeVisible()
  await expect(placeDetail).toHaveCount(0)
  const pin = page
    .locator('.maplibregl-marker')
    .getByRole('button', { name: new RegExp(placeName) })
  await pin.focus()
  await expect(placeDetail).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(panel).toHaveCount(0)
  await outside.focus()
  await page.mouse.move(0, 0)
  await expect(placeDetail).toBeVisible()
  await expect(outside).toBeFocused()
  const openPlaces = async () => {
    const toggle = page.getByRole('button', { name: 'Places', exact: true })
    if ((page.viewportSize()?.width ?? 1440) < 1024) await toggle.click()
  }
  await openPlaces()
  const search = page.getByRole('searchbox', {
    name: "Search this trip's places",
  })
  await search.fill('no matching map place')
  if (await page.getByRole('dialog').count())
    await page.keyboard.press('Escape')
  await showDays(page)
  await header.click()
  await expect(placeDetail).toHaveCount(0)
  await showDays(page)
  await placeRow.locator(':scope > button:not([aria-roledescription])').click()
  await expect(panel).toHaveCount(0)
  await expect(pin).toHaveCount(0)
  await expect(placeDetail).toBeInViewport({ ratio: 1 })
  await outside.focus()
  await expect(placeDetail).toContainText(placeName)
  await openPlaces()
  await search.clear()
  if (await page.getByRole('dialog').count())
    await page.keyboard.press('Escape')
  await placeDetail
    .getByRole('button', { name: `Close ${placeName}`, exact: true })
    .click()
  await expect(placeDetail).toHaveCount(0)
  await expect(outside).toBeFocused()
  expect(consoleReport().fatal).toEqual([])
})

test('Sheet selections hand focus to Place reading at both mobile heights', async ({
  page,
}) => {
  const route = {
    name: 'trip-plan',
    path,
    ready: '[data-plan-loaded]',
    map: true as const,
  }
  const report = watchConsole(page, route)
  await visit(page, route, 'light')
  for (const height of [450, 800]) {
    await page.setViewportSize({ width: 360, height })
    await settle(page, route)
    for (const fromDay of [false, true]) {
      if (fromDay) {
        await showDays(page)
        await page.locator('[data-planner-day-header]').first().click()
        await expect(page.locator('[data-day-detail] h2').first()).toBeFocused()
      }
      await showDays(page)
      const row = page.locator('[data-planner-place]').first()
      const name = await row.locator('span.text-label').innerText()
      await row.locator(':scope > button:not([aria-roledescription])').focus()
      await page.keyboard.press('Enter')
      const detail = page.getByRole('region', { name, exact: true })
      await expect(page.getByRole('dialog')).toHaveCount(0)
      const heading = detail.getByRole('heading', { name, exact: true })
      await expect(heading).toBeFocused()
      await expect(heading).toHaveCSS('outline-style', 'solid')
      await expect(heading).toHaveCSS('outline-width', '2px')
      const outside = page.locator('[data-plan-loaded] > h1')
      await outside.focus()
      await page.mouse.move(0, 0)
      await expect(outside).toBeFocused()
      await expect(detail).toBeVisible()
      await detail
        .getByRole('button', { name: `Close ${name}`, exact: true })
        .click()
      await expect(detail).toHaveCount(0)
      await expect(outside).toBeFocused()
    }
  }
  expect(report().fatal).toEqual([])
})

test('a failed Reservation read keeps Day content and can be retried', async ({
  page,
}) => {
  let fail = true
  await page.route(
    (url) => callsServerFn(url, 'loadBookingDeskFn'),
    (route) => (fail ? route.abort('failed') : route.continue()),
  )
  await visit(
    page,
    {
      name: 'trip-plan',
      path,
      ready: 'nav[aria-label="Trip sections"]',
      map: true,
    },
    'light',
  )
  await expect(page.locator('[data-plan-loaded]')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.locator('[data-workspace-splash]')).toHaveCount(0, {
    timeout: 60_000,
  })
  await showDays(page)
  await page.locator('[data-planner-day-header]').first().click()
  const panel = page.locator('[data-day-detail]')
  await expect(panel.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(panel.getByText('No reservations for this day')).toHaveCount(0)
  await expect(panel.getByRole('heading', { level: 2 })).toBeVisible()
  fail = false
  await panel.getByRole('button', { name: 'Retry' }).click()
  await expect(panel.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
    'aria-busy',
    'false',
  )
})

test('an undated Day adds a Stay with a real confirmation and refreshes underneath the dialog', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Day detail fixture ${Date.now()}`
  const tripsRoute = { name: 'trips', path: '/trips', ready: 'main' }
  await page.goto('/trips', { waitUntil: 'networkidle', timeout: 60_000 })
  await expect
    .poll(async () => (await readCaptureState(page, tripsRoute)).hydrated, {
      timeout: 60_000,
    })
    .toBe(true)
  await page
    .getByRole('button', { name: 'New trip', exact: true })
    .first()
    .click()
  const create = page.getByRole('dialog')
  await create.getByLabel('Trip name').fill(title)
  await create.getByLabel('Duration in days').fill('2')
  await create.getByRole('button', { name: 'Create trip', exact: true }).click()
  await expect(page).toHaveURL(/\/trips\/[^/]+\/plan/)
  try {
    await expect(page.locator('[data-workspace-splash]')).toHaveCount(0, {
      timeout: 60_000,
    })
    await page.mouse.move(0, 0)
    await expect(
      page.locator('[data-sonner-toast][data-type="success"]'),
    ).toHaveCount(0, { timeout: 10_000 })
    await showDays(page)
    const removedDayId = await page
      .locator('[data-planner-day]')
      .first()
      .getAttribute('data-planner-day')
    if (removedDayId === null) throw new Error('Day identity missing')
    await page.locator('[data-planner-day-header]').first().click()
    const panel = page.locator('[data-day-detail]')
    await expect(panel.getByText('Dates not set')).toBeVisible()
    await expect(panel.getByText('No stay for this day')).toBeVisible()
    const add = panel.getByRole('button', { name: 'Add stay', exact: true })
    await add.click()
    let dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('combobox', { name: 'Check in', exact: true }),
    ).toContainText('Day 1')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(add).toBeFocused()
    await add.click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Day detail hotel')
    await dialog
      .getByRole('combobox', { name: 'Check out', exact: true })
      .click()
    await page.getByRole('option', { name: /Day 2/ }).click()
    await dialog
      .getByLabel('Confirmation number', { exact: true })
      .fill('DAY-1718')
    await dialog
      .getByRole('button', { name: 'Add booking', exact: true })
      .focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0, { timeout: 30_000 })
    await expect(
      panel.getByText('Day detail hotel', { exact: true }).first(),
    ).toBeVisible()
    await expect(panel.getByText('DAY-1718', { exact: true })).toBeVisible()
    const heading = panel.getByRole('heading', { level: 2 })
    await expect(heading).toBeFocused()
    await expect(heading).toHaveCSS('outline-style', 'solid')
    await expect(heading).toHaveCSS('outline-width', '2px')
    // Return a successful board generation without the selected identity after a real write.
    await page.route(
      (url) => callsServerFn(url, 'loadPlanBoard'),
      async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain(removedDayId)
        await route.fulfill({
          response,
          body: body.replaceAll(removedDayId, `${removedDayId}-replacement`),
        })
      },
    )
    await showDays(page)
    await page
      .getByRole('button', { name: 'Add a note for Day 1', exact: true })
      .click()
    const note = page.getByRole('dialog')
    await note.getByRole('textbox', { name: /^Note/ }).fill('Refresh this Day')
    await note.getByRole('button', { name: 'Save note', exact: true }).click()
    await expect(panel).toHaveCount(0, { timeout: 30_000 })
    await expect(
      page.getByText('This day is no longer available.', { exact: true }),
    ).toBeVisible()
  } finally {
    // Finish the held board reads before fixture deletion or context disposal.
    await page.unrouteAll({ behavior: 'wait' })
    await page.goto('/trips', { waitUntil: 'networkidle', timeout: 60_000 })
    await expect
      .poll(async () => (await readCaptureState(page, tripsRoute)).hydrated, {
        timeout: 60_000,
      })
      .toBe(true)
    const tile = page
      .locator('[data-part="trip-tile"], [data-part="trip-row"]')
      .filter({ hasText: title, visible: true })
      .first()
    await tile.locator('[data-part="trip-actions-trigger"]').click()
    await page
      .getByRole('menuitem', { name: /^Delete( permanently)?$/ })
      .click()
    const remove = page.locator('[data-part="trip-delete-dialog"]')
    await expect(remove.getByRole('listitem').first()).toBeVisible()
    const name = remove.getByLabel(/Type the trip’s name/)
    if (await name.count()) await name.fill(title)
    await remove.getByRole('button', { name: 'Delete permanently' }).click()
    await expect(remove).toBeHidden()
  }
})

test('an archived Day with only static Notes scrolls by keyboard and lets Tab leave', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const title = `Static Day keyboard ${Date.now()}`
  const tripsRoute = { name: 'trips', path: '/trips?view=list', ready: 'main' }
  await visit(page, tripsRoute, 'light')
  await page
    .getByRole('button', { name: 'New trip', exact: true })
    .first()
    .click()
  const create = page.getByRole('dialog')
  await create.getByLabel('Trip name').fill(title)
  await create.getByLabel('Duration in days').fill('1')
  await create.getByRole('button', { name: 'Create trip', exact: true }).click()
  await expect(page).toHaveURL(/\/trips\/[^/]+\/plan/)
  const fixturePath = new URL(page.url()).pathname
  const tile = page
    .locator('[data-part="trip-tile"], [data-part="trip-row"]')
    .filter({ hasText: title, visible: true })
    .first()
  const failures: unknown[] = []
  try {
    await expect(page.locator('[data-workspace-splash]')).toHaveCount(0, {
      timeout: 60_000,
    })
    await page
      .getByRole('button', { name: 'Add a note for Day 1', exact: true })
      .click()
    const note = page.getByRole('dialog')
    await note
      .getByRole('textbox', { name: /^Note/ })
      .fill('Keyboard reading fixture')
    await note
      .getByLabel('Details', { exact: true })
      .fill(
        'Plain static travel notes with no links or interactive controls. '.repeat(
          60,
        ),
      )
    await note.getByRole('button', { name: 'Save note', exact: true }).click()
    await expect(note).toHaveCount(0)
    await expect(
      page.getByText('Keyboard reading fixture', { exact: true }),
    ).toBeVisible()
    await visit(page, tripsRoute, 'light')
    await tile.locator('[data-part="trip-actions-trigger"]').click()
    // Wait for this mutation's refresh, not the previous navigation's idle event.
    const refreshed = Promise.all(
      ['loadTrips', 'loadShell'].map(async (name) => {
        const response = await page.waitForResponse((answer) =>
          callsServerFn(new URL(answer.url()), name),
        )
        expect(response.ok()).toBe(true)
        expect(await response.finished()).toBeNull()
      }),
    )
    await page.getByRole('menuitem', { name: 'Archive', exact: true }).click()
    await expect(page.getByText('Trip archived', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await refreshed
    await expect(tile).toHaveCount(0)

    await page.setViewportSize({ width: 360, height: 450 })
    const route = {
      name: 'trip-plan',
      path: fixturePath,
      ready: '[data-plan-loaded]',
      map: true,
    } as const
    const report = watchConsole(page, route)
    await visit(page, route, 'light')
    await showDays(page)
    await page.locator('[data-planner-day-header]').first().focus()
    await page.keyboard.press('Enter')
    const panel = page.locator('[data-day-detail]')
    const body = panel.getByRole('group')
    const heading = panel.getByRole('heading', { level: 2 })
    await expect(heading).toBeFocused()
    await expect(heading).toHaveCSS('outline-style', 'solid')
    await expect(heading).toHaveCSS('outline-width', '2px')
    await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await expect(body.locator('a,button,input,textarea,select')).toHaveCount(0)
    await expect(body).toContainText('Keyboard reading fixture')
    for (let step = 0; step < 5; step++) await page.keyboard.press('Tab')
    await expect(body).toBeFocused()
    const headerBefore = await panel.locator('header').boundingBox()
    const cameraBefore = await restingCamera(page, () => null)
    await expect(body).toBeFocused()
    await page.keyboard.press('PageDown')
    await expect
      .poll(() => body.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0)
    expect(await panel.locator('header').boundingBox()).toEqual(headerBefore)
    const cameraAfter = await restingCamera(page, () => null)
    expect(cameraAfter.center).toEqual(cameraBefore.center)
    expect(cameraAfter.zoom).toBe(cameraBefore.zoom)
    await page.keyboard.press('Tab')
    expect(
      await panel.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(false)
    expect(
      await page.evaluate(() => document.activeElement === document.body),
    ).toBe(false)
    await page.keyboard.press('Shift+Tab')
    await expect(body).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(page.locator('[data-plan-loaded] > h1')).toBeFocused()
    await showDays(page)
    await page.locator('[data-planner-day-header]').first().click()
    await expect(panel.getByRole('heading', { level: 2 })).toBeFocused()
    for (let step = 0; step < 3; step++) await page.keyboard.press('Tab')
    await expect(
      panel.getByRole('button', { name: 'Minimise day details' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(body).toHaveCount(0)
    await expect(
      panel.getByRole('button', { name: 'Expand day details' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(heading).toBeFocused()
    await expect(heading).toHaveCSS('outline-style', 'solid')
    await expect(heading).toHaveCSS('outline-width', '2px')
    expect(report().fatal).toEqual([])
  } catch (error) {
    failures.push(error)
  }
  try {
    await visit(page, tripsRoute, 'light')
    if (!(await tile.count()))
      await page.locator('[data-part="trip-archive-disclosure"]').click()
    const deleteAction = page.getByRole('menuitem', {
      name: /^Delete( permanently)?$/,
    })
    await expect(async () => {
      if (!(await page.getByRole('menu').count())) {
        await tile.locator('[data-part="trip-actions-trigger"]').click()
      }
      await expect(deleteAction).toBeEnabled()
      // Leave time to reopen a detached menu within the outer retry window.
      await deleteAction.click({ timeout: 5_000 })
    }).toPass({ timeout: 15_000 })
    const remove = page.locator('[data-part="trip-delete-dialog"]')
    await expect(remove.getByRole('listitem').first()).toBeVisible()
    const name = remove.getByLabel(/Type the trip’s name/)
    if (await name.count()) await name.fill(title)
    await remove.getByRole('button', { name: 'Delete permanently' }).click()
    await expect(remove).toBeHidden()
    await expect(tile).toHaveCount(0)
  } catch (error) {
    failures.push(error)
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      'Keyboard regression or fixture cleanup failed',
    )
  }
})

test('a viewer and an archived Trip retain readable Day details without Stay writes', async ({
  page,
  context,
  baseURL,
}) => {
  await context.clearCookies()
  expect(await signIn(page, baseURL, 'jonas@planned.travel')).toBe(true)
  await visit(
    page,
    {
      name: 'trip-plan',
      path,
      ready: 'nav[aria-label="Trip sections"]',
      map: true,
    },
    'light',
  )
  await showDays(page)
  await page.locator('[data-planner-day-header]').first().click()
  const panel = page.locator('[data-day-detail]')
  await expect(
    panel.getByRole('heading', { name: 'Stays', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Add (a )?stay/i }),
  ).toHaveCount(0)
  await context.clearCookies()
  expect(await signIn(page, baseURL)).toBe(true)
  await visit(
    page,
    {
      name: 'trip-plan',
      path: '/trips/demo-trip-04-marrakech-riad-week/plan',
      ready: 'nav[aria-label="Trip sections"]',
      map: true,
    },
    'light',
  )
  await showDays(page)
  await page.locator('[data-planner-day-header]').first().click()
  await expect(
    panel.getByRole('heading', { name: 'Stays', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Add (a )?stay/i }),
  ).toHaveCount(0)
})

test('desktop, mobile and a 200% equivalent viewport retain a usable map and no inline overflow', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await visit(
    page,
    {
      name: 'trip-plan',
      path,
      ready: 'nav[aria-label="Trip sections"]',
      map: true,
    },
    'dark',
  )
  await showDays(page)
  await page.locator('[data-planner-day-header]').first().click()
  const panel = page.locator('[data-day-detail]')
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 360, height: 800 },
    { width: 720, height: 450 },
  ]) {
    await page.setViewportSize(viewport)
    await settle(page, {
      name: 'trip-plan',
      path,
      ready: '[data-day-detail]',
      map: true,
    })
    await expect(panel).toBeVisible()
    await expect
      .poll(() =>
        panel.evaluate((node) => {
          const box = node.getBoundingClientRect()
          const map = node
            .closest('[data-plan-loaded]')
            ?.getBoundingClientRect()
          return (
            map !== undefined &&
            box.height <= map.height / 2 + 1 &&
            box.x >= 0 &&
            box.x + box.width <= window.innerWidth &&
            node.scrollWidth <= node.clientWidth + 1
          )
        }),
      )
      .toBe(true)
    const controls = page.getByRole('toolbar', { name: 'Map controls' })
    await expect
      .poll(async () => {
        const reachable = await controls
          .getByRole('button')
          .evaluateAll((buttons) =>
            buttons.map((button) => {
              const controlBox = button.getBoundingClientRect()
              return button.contains(
                document.elementFromPoint(
                  controlBox.x + controlBox.width / 2,
                  controlBox.y + controlBox.height / 2,
                ),
              )
            }),
          )
        return reachable.length > 0 && reachable.every(Boolean)
      })
      .toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
  }
  const headerBox = await panel.locator('header').boundingBox()
  const cameraBefore = await restingCamera(page, () => null)
  const body = panel.locator(':scope > div')
  await panel.getByRole('link').first().focus()
  await page.keyboard.press('PageDown')
  await expect
    .poll(() => body.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0)
  await panel.getByRole('link').last().scrollIntoViewIfNeeded()
  await expect(panel.getByRole('link').last()).toBeInViewport()
  expect(await panel.locator('header').boundingBox()).toEqual(headerBox)
  const cameraAfter = await restingCamera(page, () => null)
  expect(cameraAfter.center).toEqual(cameraBefore.center)
  expect(cameraAfter.zoom).toBe(cameraBefore.zoom)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await restingCamera(page, (camera) =>
    camera.zoom > cameraAfter.zoom ? null : 'Zoom did not change',
  )
  await page.locator('[data-plan-loaded] > h1').focus()
  await page.keyboard.press('Escape')
  await expect(panel).toBeVisible()
})

test('Reservation loading preserves panel geometry and the shift probe detects movement @chromium-only', async ({
  page,
}) => {
  let release = () => {}
  let held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    (url) => callsServerFn(url, 'loadBookingDeskFn'),
    async (route) => {
      await held
      await route.continue()
    },
  )
  await visit(
    page,
    {
      name: 'trip-plan',
      path,
      ready: 'nav[aria-label="Trip sections"]',
      map: true,
    },
    'light',
  )
  await showDays(page)
  await page.locator('[data-planner-day-header]').first().click()
  const panel = page.locator('[data-day-detail]')
  await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
    'aria-busy',
    'true',
  )
  const before = await panel.boundingBox()
  await page.evaluate(() => {
    type Shift = PerformanceEntry & {
      value: number
      sources?: Array<{
        node?: Node
        previousRect?: DOMRectReadOnly
        currentRect?: DOMRectReadOnly
      }>
    }
    const readings: Array<{
      value: number
      panel: boolean
      sources: Array<{ text: string | null; before: unknown; after: unknown }>
    }> = []
    Object.assign(window, { dayDetailShifts: readings })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as Shift
        readings.push({
          value: shift.value,
          sources: (shift.sources ?? []).map((source) => ({
            text: source.node?.textContent?.slice(0, 100) ?? null,
            before: source.previousRect,
            after: source.currentRect,
          })),
          panel:
            shift.sources?.some(
              (source) =>
                source.node instanceof Element &&
                source.node.closest('[data-day-detail]') !== null,
            ) ?? false,
        })
      }
    }).observe({ type: 'layout-shift' })
  })
  release()
  await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  expect(await panel.boundingBox()).toEqual(before)
  const stable = await page.evaluate(
    () =>
      (
        window as unknown as {
          dayDetailShifts: Array<{ value: number; panel: boolean }>
        }
      ).dayDetailShifts,
  )
  await test.info().attach('layout-shifts', {
    body: JSON.stringify(stable),
    contentType: 'application/json',
  })
  expect(
    stable
      .filter((entry) => entry.panel)
      .reduce((sum, entry) => sum + entry.value, 0),
  ).toBe(0)
  const noteText = `Refresh ${Date.now().toString().slice(-5)}`
  await page
    .locator('[data-planner-day]')
    .nth(1)
    .getByRole('button', { name: /^Add a note for / })
    .click()
  const editor = page.getByRole('dialog')
  await editor.getByRole('textbox', { name: /^Note/ }).fill(noteText)
  const row = panel.locator('section[aria-busy] li').first()
  await row.evaluate((node) => node.scrollIntoView({ block: 'center' }))
  const position = () =>
    row.evaluate((node) => {
      const box = node.getBoundingClientRect()
      const section = node.closest('section')!.getBoundingClientRect()
      return { y: box.y, inset: box.y - section.y, height: box.height }
    })
  const knownPosition = await position()
  held = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await editor.getByRole('button', { name: 'Save note', exact: true }).click()
    await expect(editor).toHaveCount(0)
    try {
      await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
        'aria-busy',
        'true',
      )
      expect(await position()).toEqual(knownPosition)
    } finally {
      release()
    }
    await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'false',
    )
    expect(await position()).toEqual(knownPosition)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    const refreshed = await page.evaluate(
      () =>
        (
          window as unknown as {
            dayDetailShifts: Array<{ value: number; panel: boolean }>
          }
        ).dayDetailShifts,
    )
    await test
      .info()
      .attach('background-layout-shifts', {
        body: JSON.stringify(refreshed),
        contentType: 'application/json',
      })
    expect(
      refreshed
        .filter((entry) => entry.panel)
        .reduce((sum, entry) => sum + entry.value, 0),
    ).toBe(0)
    await panel.locator('header').evaluate((node) => {
      node.style.marginTop = '40px'
    })
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              dayDetailShifts: Array<{ value: number; panel: boolean }>
            }
          ).dayDetailShifts.some((entry) => entry.panel && entry.value > 0),
        ),
      )
      .toBe(true)
    await panel.locator('header').evaluate((node) => {
      node.style.marginTop = ''
    })
  } finally {
    release()
    const savedNote = page
      .locator('[data-planner-note]')
      .filter({ hasText: noteText })
    const remove = savedNote.getByRole('button', { name: 'Delete note' })
    await remove.focus()
    await remove.press('Enter')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete note', exact: true })
      .click()
    await expect(savedNote).toHaveCount(0)
  }
})

test('overlapping Stays keep their actual windows and chronological order', async ({
  page,
}) => {
  const route = {
    name: 'trip-plan',
    path: '/trips/demo-trip-01-tokyo-and-kyoto/plan',
    ready: 'nav[aria-label="Trip sections"]',
    map: true,
  } as const
  await visit(page, route, 'light')
  await showDays(page)
  await page.locator('[data-planner-day-header]').nth(4).click()
  const stays = page.locator('[data-day-detail] section').first()
  await expect(
    stays.getByText('Hotel Gracery Shinjuku', { exact: true }),
  ).toBeVisible()
  await expect(
    stays.getByText('Hotel Indigo Hakone Gora', { exact: true }),
  ).toBeVisible()
  const names = await stays.locator('li > p.font-semibold').allTextContents()
  expect(names).toEqual(['Hotel Gracery Shinjuku', 'Hotel Indigo Hakone Gora'])
  await expect(
    stays.getByText('Check in · 15:00 – 23:00', { exact: true }),
  ).toBeVisible()
})

test('short planner controls and feedback stay usable by pointer @chromium-only @feedback-sdk', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const consoleReport = watchConsole(page, {
    name: 'trip-plan',
    path,
    ready: 'nav[aria-label="Trip sections"]',
    map: true,
  })
  const deliveries: Array<{ width: number; height: number; status: number }> = []
  for (const viewport of [
    { width: 720, height: 450 },
    { width: 360, height: 450 },
  ]) {
    await page.setViewportSize(viewport)
    await visit(
      page,
      {
        name: 'trip-plan',
        path,
        ready: 'nav[aria-label="Trip sections"]',
        map: true,
      },
      'light',
    )
    await showDays(page)
    await page.locator('[data-planner-day-header]').first().click()
    const panel = page.locator('[data-day-detail]')
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: 'Minimise day details' }).click()
    await expect(
      panel.getByRole('button', { name: 'Expand day details' }),
    ).toBeFocused()
    await panel.getByRole('button', { name: 'Expand day details' }).click()
    await expect(panel.getByRole('heading', { level: 2 })).toBeFocused()
    for (const name of ['Days', 'Places']) {
      await panel.getByRole('button', { name, exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    for (const name of ['Days', 'Places']) {
      const action = page.getByRole('button', { name, exact: true })
      await action.focus()
      for (const height of [800, viewport.height]) {
        await page.setViewportSize({ ...viewport, height })
        await expect
          .poll(() =>
            action.evaluate(
              (node) => node.closest('[data-day-detail]') !== null,
            ),
          )
          .toBe(height === viewport.height)
        await expect(action).toBeFocused()
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
    }
    const detailHeading = panel.getByRole('heading', { level: 2 })
    await detailHeading.focus()
    for (const height of [800, viewport.height]) {
      await page.setViewportSize({ ...viewport, height })
      await expect
        .poll(() =>
          page
            .getByRole('button', { name: 'Days', exact: true })
            .evaluate((node) => node.closest('[data-day-detail]') !== null),
        )
        .toBe(height === viewport.height)
      await expect(detailHeading).toBeFocused()
    }
    const report = page.getByRole('button', {
      name: 'Report a problem',
      exact: true,
    })
    await expect(report).toHaveCount(1)
    await report.click()
    const feedback = page.getByRole('dialog').filter({
      has: page.getByRole('heading', {
        name: 'Report a problem',
        exact: true,
      }),
    })
    await expect(feedback).toBeVisible({ timeout: 60_000 })
    await feedback.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(feedback).not.toBeVisible()
    const compactFocus = await report.evaluate((node) => node.matches(':focus'))
    await report.focus()
    await page.keyboard.press('Enter')
    await expect(feedback).toBeVisible()
    await feedback.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(feedback).not.toBeVisible()
    await panel.getByRole('button', { name: 'Close day details' }).click()
    await expect(panel).toHaveCount(0)
    await report.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(report).toBeFocused()
    await page.setViewportSize({ ...viewport, height: 800 })
    await expect(report).toHaveText('Report a problem')
    await expect(report).toBeFocused()
    await page.setViewportSize(viewport)
    await expect(report).toHaveText('')
    await expect(report).toBeFocused()
    const outside = page.locator('nav[aria-label="Trip sections"] a').first()
    await outside.focus()
    await page.setViewportSize({ ...viewport, height: 800 })
    await expect(report).toHaveText('Report a problem')
    await expect(outside).toBeFocused()
    await page.setViewportSize(viewport)
    await expect(report).toHaveText('')
    await expect(outside).toBeFocused()
    await page.setViewportSize({ ...viewport, height: 800 })
    await expect(report).toHaveText('Report a problem')
    await expect(report).toHaveCount(1)
    await report.click()
    await expect(feedback).toBeVisible()
    await feedback.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(feedback).not.toBeVisible()
    expect(await report.evaluate((node) => node.matches(':focus'))).toBe(
      compactFocus,
    )
    await report.click()
    await expect(feedback).toBeVisible()
    await feedback.locator('textarea').fill('Local feedback delivery test')
    const delivered = page.waitForResponse((response) => {
      const request = response.request()
      return (
        request.method() === 'POST' &&
        new URL(response.url()).origin === 'http://127.0.0.1:4318' &&
        request.postData()?.includes('"type":"feedback"') === true
      )
    })
    await feedback.getByRole('button', { name: 'Send report' }).click()
    deliveries.push({ ...viewport, status: (await delivered).status() })
    await expect(
      page.getByText('Thank you — we have your report.'),
    ).toBeVisible()
  }
  expect(deliveries).toEqual([
    { width: 720, height: 450, status: 204 },
    { width: 360, height: 450, status: 204 },
  ])
  expect(consoleReport().fatal).toEqual([])
})

test('a short Arabic Day detail keeps its full date and a readable scrolling body', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.goto('/settings/language', {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await expect
    .poll(
      async () =>
        (
          await readCaptureState(page, {
            name: 'language',
            path: '/settings/language',
            ready: '[data-testid="locale-chip-ar"]',
          })
        ).hydrated,
      { timeout: 60_000 },
    )
    .toBe(true)
  try {
    const written = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/_serverFn/'),
    )
    await page.getByTestId('locale-chip-ar').click()
    await written
    await page.setViewportSize({ width: 360, height: 450 })
    await page.goto(path, { waitUntil: 'networkidle', timeout: 60_000 })
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('[data-plan-loaded]')).toBeVisible()
    await expect(page.locator('[data-workspace-splash]')).toHaveCount(0)
    await page.getByRole('button', { name: 'الأيام', exact: true }).click()
    await page.locator('[data-planner-day-header]').first().click()
    const panel = page.locator('[data-day-detail]')
    await expect(panel.getByRole('heading', { level: 2 })).toBeFocused()
    await expect(panel.locator('section[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'false',
    )
    const body = panel.locator(':scope > div')
    await expect
      .poll(() =>
        body.evaluate((node) => {
          const style = getComputedStyle(node)
          const box = node.getBoundingClientRect()
          const panelBox = node.parentElement!.getBoundingClientRect()
          const visibleHeight =
            Math.min(box.bottom, panelBox.bottom, innerHeight) -
            Math.max(box.top, panelBox.top, 0)
          return (
            visibleHeight >= 40 &&
            visibleHeight -
              parseFloat(style.paddingTop) -
              parseFloat(style.paddingBottom) >=
              parseFloat(style.lineHeight)
          )
        }),
      )
      .toBe(true)
    const title = body.getByText('Land and climb', { exact: true })
    await expect(title).toBeVisible()
    expect(
      await title.evaluate((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        const bounds = node.getBoundingClientRect()
        const bodyBounds = node.parentElement!.getBoundingClientRect()
        return [...range.getClientRects()].every(
          (box) =>
            box.left >= bounds.left - 1 &&
            box.right <= bounds.right + 1 &&
            box.top >= bodyBounds.top - 1 &&
            box.bottom <= bodyBounds.bottom + 1,
        )
      }),
    ).toBe(true)
    const header = panel.locator('header')
    const date = header.locator('p')
    await expect(date).toContainText('2026')
    expect(
      await date.evaluate((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        const bounds = node.getBoundingClientRect()
        return [...range.getClientRects()].every(
          (box) =>
            box.left >= bounds.left - 1 &&
            box.right <= bounds.right + 1 &&
            box.top >= bounds.top - 1 &&
            box.bottom <= bounds.bottom + 1,
        )
      }),
    ).toBe(true)
    const headerBefore = await header.boundingBox()
    const reservation = panel.locator('section[aria-busy] a').first()
    await reservation.scrollIntoViewIfNeeded()
    await expect(reservation).toBeInViewport({ ratio: 1 })
    expect(await body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
    expect(await header.boundingBox()).toEqual(headerBefore)
    const panelBounds = await panel.boundingBox()
    const mapBounds = await page.locator('[data-plan-loaded]').boundingBox()
    expect(
      panelBounds &&
        mapBounds &&
        panelBounds.height <= mapBounds.height / 2 + 1,
    ).toBe(true)
    await panel.getByRole('button', { name: 'تصغير تفاصيل اليوم' }).click()
    await expect(
      panel.getByRole('button', { name: 'توسيع تفاصيل اليوم' }),
    ).toBeFocused()
    await expect(date).toBeInViewport({ ratio: 1 })
    await panel.getByRole('button', { name: 'توسيع تفاصيل اليوم' }).click()
    for (const name of ['الأيام', 'الأماكن']) {
      await panel.getByRole('button', { name, exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    await panel.getByRole('button', { name: 'إغلاق تفاصيل اليوم' }).click()
    await expect(panel).toHaveCount(0)
  } finally {
    expect(await pinDemoLanguage(page)).toBe(true)
  }
})
