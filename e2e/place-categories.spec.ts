import { expect, test } from '@playwright/test'
import { callsServerFn } from './helpers/server-fn'
import { signIn, useSession } from './helpers/session'
import { settle } from './helpers/settle'
import { watchConsole } from './helpers/console'

// Category CRUD is undated; the fixture clock header must not reach font or telemetry origins.
test.use({ extraHTTPHeaders: {}, actionTimeout: 30_000 })

const settings = {
  name: 'settings-places',
  path: '/settings/places',
  ready: '[data-part="taxonomy-row"]',
}

test('category settings refresh planner options and recover a deleted category without losing the place draft', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000)
  await useSession(context, page, baseURL)
  const watched = watchConsole(page, settings)
  const name = `Category ${test.info().project.name} ${Date.now()}`
  const renamed = `${name} renamed`
  await page.goto(settings.path)
  await settle(page, settings)
  const create = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Add category', exact: true }),
  })
  await create.getByLabel('Name', { exact: false }).fill(name)
  await create.getByRole('button', { name: 'Add category' }).click()
  let row = page.locator('[data-part="taxonomy-row"]').filter({ hasText: name })
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('aria-busy', 'false')
  await row.getByRole('button', { name: `Rename ${name}`, exact: true }).click()
  await row.getByRole('textbox', { name: /^Name/ }).fill(renamed)
  await row.getByLabel('Colour').fill('#123456')
  const updateRequest = page.waitForRequest((request) =>
    callsServerFn(new URL(request.url()), 'updateCategoryFn'),
  )
  await row.getByRole('button', { name: 'Save changes' }).click()
  const captured = await updateRequest
  row = page.locator('[data-part="taxonomy-row"]').filter({ hasText: renamed })
  await expect(row).toHaveAttribute('aria-busy', 'false')
  const up = row.getByRole('button', { name: `Move ${renamed} up` })
  const direction = (await up.isEnabled()) ? 'up' : 'down'
  const move = row.getByRole('button', { name: `Move ${renamed} ${direction}` })
  await expect(move).toBeEnabled()
  const moved = page.waitForResponse((response) =>
    callsServerFn(new URL(response.url()), 'moveCategoryFn'),
  )
  await move.focus()
  await page.keyboard.press('Enter')
  await moved
  await expect(row).toHaveAttribute('aria-busy', 'false')
  await expect(
    row.getByRole('button', { name: `Rename ${renamed}` }),
  ).toBeFocused()

  const member = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  })
  try {
    const memberPage = await member.newPage()
    expect(await signIn(memberPage, baseURL, 'jonas@planned.travel')).toBe(true)
    await memberPage.goto(settings.path)
    await expect(
      memberPage.getByText(
        'Workspace owners and admins can manage categories.',
      ),
    ).toBeVisible()
    await expect(memberPage.locator('[data-part="taxonomy-edit"]')).toHaveCount(
      0,
    )
    const response = await member.request.post(captured.url(), {
      data: captured.postData() ?? '',
      headers: {
        origin: baseURL ?? '',
        'content-type':
          captured.headers()['content-type'] ?? 'application/json',
        'x-planned-workspace': captured.headers()['x-planned-workspace'] ?? '',
      },
    })
    // RPC envelopes can carry refusals with HTTP 200; the persisted value is the authority.
    expect(
      response.status() >= 400 ||
        (await response.text()).includes('planned-travel/failure/'),
    ).toBe(true)
    await memberPage.reload()
    await expect(memberPage.getByText(renamed, { exact: true })).toBeVisible()
  } finally {
    await member.close()
  }

  const tripTitle = `Category journey ${name}`
  await page.goto('/trips')
  await settle(page, { name: 'trips', path: '/trips', ready: 'main' })
  await page
    .getByRole('button', { name: 'New trip', exact: true })
    .first()
    .click()
  const tripDialog = page.getByRole('dialog')
  await tripDialog.getByLabel('Trip name').fill(tripTitle)
  await tripDialog
    .getByRole('button', { name: 'Create trip', exact: true })
    .click()
  await expect(page).toHaveURL(/\/trips\/[^/]+\/plan(?:\?|$)/)
  const tripId = new URL(page.url()).pathname.split('/')[2]
  try {
    const plan = {
      name: 'trip-plan',
      path: `/trips/${tripId}/plan`,
      ready: 'main',
      map: true as const,
    }
    expect(watched().fatal).toEqual([])
    const planConsole = watchConsole(page, plan)
    await page.goto(plan.path)
    await settle(page, plan)
    // The primary add control is available in the responsive places panel.
    if (!(await page.locator('[data-part="add-place"]').isVisible())) {
      await page.getByRole('button', { name: 'Places', exact: true }).click()
    }
    await page.locator('[data-part="add-place"]').click()
    const dialog = page.getByRole('dialog')
    const placeName = `Draft ${name}`
    await dialog.getByLabel('Name', { exact: false }).fill(placeName)
    const category = dialog.getByRole('combobox', { name: 'Category' })
    await category.focus()
    await page.keyboard.press('Space')
    await page.getByRole('option', { name: renamed, exact: true }).click()
    // Persist a categorized place first; deleting its category must preserve both its row and pin.
    const savedName = `Saved ${name}`
    await dialog.getByLabel('Name', { exact: false }).fill(savedName)
    await dialog.getByLabel('Latitude').fill('50.06')
    await dialog.getByLabel('Longitude').fill('19.94')
    await dialog
      .getByRole('button', { name: 'Add a place', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    // Selecting the place keeps its pin separate from legitimate nearby clusters.
    await page
      .locator('[data-planner-place]')
      .filter({ hasText: savedName })
      .getByRole('button', { name: new RegExp(`^${savedName},`) })
      .click()
    const pin = page
      .locator('.maplibregl-marker')
      .getByRole('button', { name: new RegExp(savedName) })
    await expect(pin).toHaveAttribute('aria-label', new RegExp(renamed))
    await page
      .getByRole('button', { name: `Actions for ${savedName}`, exact: true })
      .click()
    await page
      .getByRole('menuitem', { name: 'Edit place', exact: true })
      .click()
    const edit = page.getByRole('dialog')
    await edit.getByLabel('Name', { exact: false }).fill(placeName)
    const otherTab = await context.newPage()
    try {
      await otherTab.goto(settings.path)
      await settle(otherTab, settings)
      await otherTab
        .getByRole('button', { name: `Delete ${renamed}`, exact: true })
        .click()
      await expect(otherTab.getByRole('dialog')).toContainText(
        'Places will be kept.',
      )
      await otherTab
        .getByRole('dialog')
        .getByRole('button', { name: 'Delete', exact: true })
        .click()
      await expect(otherTab.getByRole('dialog')).toHaveCount(0)
      await dialog
        .getByRole('button', { name: 'Save changes', exact: true })
        .click()
      await expect(
        dialog
          .getByText(
            'This category was removed. Choose another category or leave the place uncategorized.',
          )
          .first(),
      ).toBeVisible()
      await expect(dialog.getByLabel('Name', { exact: false })).toHaveValue(
        placeName,
      )
      await category.focus()
      await page.keyboard.press('Space')
      await page
        .getByRole('option', { name: 'No category', exact: true })
        .click()
      await dialog
        .getByRole('button', { name: 'Save changes', exact: true })
        .click()
      await expect(dialog).toHaveCount(0)
      await page.reload()
      await settle(page, plan)
      const preservedPin = page
        .locator('.maplibregl-marker')
        .getByRole('button', { name: new RegExp(placeName) })
      await expect(preservedPin).toBeVisible()
      await expect(preservedPin).not.toHaveAttribute(
        'aria-label',
        new RegExp(renamed),
      )
      await expect(
        page.getByRole('button', { name: renamed, exact: true }),
      ).toHaveCount(0)
      expect(planConsole().fatal).toEqual([])
    } finally {
      await otherTab.close()
    }
  } finally {
    await page.goto('/trips')
    await settle(page, { name: 'trips', path: '/trips', ready: 'main' })
    const card = page
      .locator(
        '[data-part="trip-tile"]:visible, [data-part="trip-row"]:visible',
      )
      .filter({ hasText: tripTitle })
      .first()
    await card.locator('[data-part="trip-actions-trigger"]').click()
    await page
      .getByRole('menuitem', { name: /^Delete( permanently)?$/ })
      .click()
    const removal = page.locator('[data-part="trip-delete-dialog"]')
    await expect(removal.getByRole('listitem').first()).toBeVisible()
    const confirmation = removal.getByLabel(/Type the trip’s name/)
    if (await confirmation.count()) await confirmation.fill(tripTitle)
    await removal.getByRole('button', { name: 'Delete permanently' }).click()
    await expect(removal).toBeHidden()
  }
})

test('deleting the last starter leaves an intentionally empty list after reopening', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000)
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { 'accept-language': 'en' },
  })
  try {
    const suffix = `${test.info().project.name}-${Date.now()}`
    const signup = await context.request.post('/api/auth/sign-up/email', {
      headers: { origin: baseURL ?? '' },
      data: {
        email: `categories-${suffix}@example.test`,
        name: 'Category traveller',
        password: 'categories-local-fixture-1845',
      },
    })
    expect(signup.ok()).toBe(true)
    const page = await context.newPage()
    await page.goto('/settings/places')
    const rows = page.locator('[data-part="taxonomy-row"]')
    await settle(page, settings)
    await expect(rows).toHaveCount(8)
    for (let count = 8; count > 0; count--) {
      await rows.first().locator('[data-part="taxonomy-delete"]').click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Delete', exact: true })
        .click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(rows).toHaveCount(count - 1)
    }
    await expect(
      page.getByText('No categories yet. Places can stay uncategorized.'),
    ).toBeVisible()
    await page.goto('/dashboard')
    await page.goto('/settings/places')
    await expect(rows).toHaveCount(0)
    await expect(
      page.getByText('No categories yet. Places can stay uncategorized.'),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Add category' }),
    ).toBeEnabled()
  } finally {
    await context.close()
  }
})
