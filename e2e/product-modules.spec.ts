import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  visit,
  watchConsole,
  unblockCrossOriginFonts,
} from './helpers/console.ts'
import { PINNED_YEAR } from './helpers/routes.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'
import { settle } from './helpers/settle.ts'

/**
 * `08-S1` - a traveller sets their own allowance on the leave planner (plan stage 08-S1, ticket
 * 08-S1a).
 *
 * The walk is the whole keyboard story of the "Days" tile: open it, refuse a value the field cannot
 * hold, cancel, save with Enter and find the figure changed after the reload. Chromium only and
 * serial, because it writes the demo member's allowance row for the pinned year; the walk puts the
 * figure back in its `finally`, so a failed run leaves the fixture as it found it.
 * `playwright.config.ts` names this describe among the fixture writers.
 *
 * `08-S1b` adds the carried-over tile to the same describe: the demo traveller has rows for the
 * year before the pinned one and for the pinned one, so the pinned year's "Carried" is calculated
 * and the earlier year's is an opening balance that can be typed. The walk edits that opening
 * balance and puts it back in its `finally`.
 *
 * `08-S1c` adds the plan's own settings dialog to it: the walk switches carry-over off and on and
 * compares the pinned year's "Carried" figure before and after (no seeded literal), changes the
 * default allowance and reads it on a year the traveller has no row for, and puts both back in its
 * `finally`.
 */
const VACAY: RouteCase = {
  name: 'vacay',
  path: `/vacay?year=${PINNED_YEAR}`,
  ready: 'main',
}

/** A year the demo traveller has no allowance row for, so the tile shows the plan default. */
const UNSET_YEAR = 2031
const UNSET: RouteCase = {
  name: 'vacay-unset-year',
  path: `/vacay?year=${UNSET_YEAR}`,
  ready: 'main',
}

/** The demo traveller's first year in the planner: no row before it, so its carried figure is typed. */
const OPENING_YEAR = PINNED_YEAR - 1
const OPENING: RouteCase = {
  name: 'vacay-opening-balance',
  path: `/vacay?year=${OPENING_YEAR}`,
  ready: 'main',
}

const WIDE = 2560

const TILE = /^Edit days, currently \d+$/

function tile(page: Page) {
  return page.getByRole('button', { name: TILE })
}

function field(page: Page) {
  return page.getByRole('textbox', { name: /^Days/ })
}

function carriedTile(page: Page) {
  return page.getByRole('button', {
    name: /^Edit carried days, currently \d+$/,
  })
}

/** The figure under the "Carried" label, whether it is a button or plain text. */
function carriedFigure(page: Page) {
  return page
    .locator('dt')
    .filter({ hasText: /^Carried$/ })
    .locator('xpath=following-sibling::dd')
}

/**
 * Whether every tile label of the allowance panel sits on one line inside its tile. A label that
 * breaks mid-word ("CARRIE" over "D") makes its tile taller than the others and reads as a typo.
 */
async function tileLabelsFit(page: Page): Promise<boolean> {
  return page.locator('dl dt').evaluateAll((labels) =>
    labels.slice(0, 3).every((label) => {
      const { height } = label.getBoundingClientRect()
      return (
        label.scrollWidth <= label.clientWidth &&
        height < 1.6 * Number.parseFloat(getComputedStyle(label).lineHeight)
      )
    }),
  )
}

function settingsButton(page: Page) {
  return page.getByRole('button', { name: 'Leave plan settings' })
}

function settingsDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Leave plan settings' })
}

function carryOverBox(page: Page) {
  return settingsDialog(page).getByRole('checkbox', {
    name: 'Carry unused days into the next year',
  })
}

function defaultField(page: Page) {
  return settingsDialog(page).getByRole('textbox', {
    name: 'Default allowance (days per year)',
  })
}

function saveSettings(page: Page) {
  return settingsDialog(page).getByRole('button', { name: 'Save settings' })
}

/**
 * Changes the plan settings the way a reader does and waits for the dialog to close onto its
 * button. Used to put them back, so it names no figure of its own.
 */
async function changeSettings(
  page: Page,
  settings: { carryOver?: boolean; defaultDays?: number },
): Promise<void> {
  await settingsButton(page).click()
  if (settings.carryOver !== undefined) {
    const box = carryOverBox(page)
    if ((await box.isChecked()) !== settings.carryOver) await box.click()
  }
  if (settings.defaultDays !== undefined) {
    await defaultField(page).fill(String(settings.defaultDays))
  }
  await defaultField(page).press('Enter')
  await expect(settingsDialog(page)).toHaveCount(0)
  await expect(settingsButton(page)).toBeFocused()
}

/** The plan's default allowance, read from the tile of a year the traveller has no row for. */
async function planDefault(page: Page): Promise<number> {
  await visit(page, UNSET, 'light')
  return figure(page)
}

/** The two widths the spec names: the phone column and the three-column planner. */
const WIDTHS = [360, 1280] as const

/** True when something in the document is wider than the viewport. */
async function overflowsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
}

/** The figure the tile shows, read from its accessible name. */
async function figure(page: Page): Promise<number> {
  const name = (await tile(page).getAttribute('aria-label')) ?? ''
  return Number(/(\d+)$/.exec(name)?.[1])
}

/** Sets the allowance through the editor, the way a reader does. */
async function setAllowance(page: Page, days: number): Promise<void> {
  await tile(page).click()
  await field(page).fill(String(days))
  await field(page).press('Enter')
  await expect(field(page)).toHaveCount(0)
  await expect(tile(page)).toHaveAttribute(
    'aria-label',
    `Edit days, currently ${days}`,
  )
}

test.describe('08-S1 - a traveller sets their own allowance', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'the walk writes the demo member’s allowance row, which two projects would count against each other',
  )

  /** Ordered: the walk reads the figure first and puts it back last, and only one test may hold it. */
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session - run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('08-S5b follows a Sunday-first workspace @chromium-only', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await unblockCrossOriginFonts(page)
    const selectWeek = async (value: string) => {
      await page
        .getByRole('combobox', { name: 'Week starts on', exact: true })
        .click()
      await page.getByRole('option', { name: value, exact: true }).click()
      const written = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/_serverFn/'),
      )
      await page
        .getByRole('button', { name: 'Save changes', exact: true })
        .click()
      expect((await written).ok()).toBe(true)
    }
    await page.goto('/settings/organization', { waitUntil: 'networkidle' })
    const workspace = page.getByRole('combobox', {
      name: 'Week starts on',
      exact: true,
    })
    const originalWorkspace = (await workspace.innerText()).trim()
    await page.goto('/settings', { waitUntil: 'networkidle' })
    const originalUser = (
      await page
        .getByRole('combobox', { name: 'Week starts on', exact: true })
        .innerText()
    ).trim()
    try {
      if (!originalUser.startsWith('Workspace default'))
        await selectWeek('Workspace default — ' + originalWorkspace)
      await page.goto('/settings/organization', { waitUntil: 'networkidle' })
      if (originalWorkspace !== 'Sunday') await selectWeek('Sunday')
      await page.goto('/vacay?year=2026', { waitUntil: 'networkidle' })
      const january = page.getByRole('grid', {
        name: 'January 2026',
        exact: true,
      })
      await expect(january.getByRole('columnheader').first()).toHaveAttribute(
        'abbr',
        'Sunday',
      )
      const first = january.getByRole('button', { name: /^1 Jan 2026/ })
      await expect(first.locator('xpath=../preceding-sibling::td')).toHaveCount(
        4,
      )
      const august = page.getByRole('grid', {
        name: 'August 2026',
        exact: true,
      })
      const fifth = august.getByRole('button', { name: /^5 Aug 2026/ })
      await fifth.focus()
      await fifth.press('Home')
      await expect(
        august.getByRole('button', { name: /^2 Aug 2026/ }),
      ).toBeFocused()
      await page.keyboard.press('End')
      await expect(
        august.getByRole('button', { name: /^8 Aug 2026/ }),
      ).toBeFocused()
      for (const day of [1, 2, 8, 9]) {
        await expect(
          august.getByRole('button', { name: new RegExp(`^${day} Aug 2026`) }),
        ).toHaveClass(/bg-surface-inset/)
      }
    } finally {
      await page.goto('/settings/organization', { waitUntil: 'networkidle' })
      if (originalWorkspace !== 'Sunday') await selectWeek(originalWorkspace)
      if (!originalUser.startsWith('Workspace default')) {
        await page.goto('/settings', { waitUntil: 'networkidle' })
        await selectWeek(originalUser)
      }
    }
  })

  test('08-S5a logs and clears a day with the keyboard @chromium-only', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const watched = watchConsole(page, UNSET)
    await unblockCrossOriginFonts(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(UNSET.path, { waitUntil: 'networkidle' })
    const grid = page.locator('[data-part="vacay-year"]')
    const cell = grid.getByRole('button', { name: /^4 Dec 2031/ })
    await expect(grid.locator('table button[tabindex="0"]')).toHaveCount(1)
    const jan31 = grid.getByRole('button', { name: /^31 Jan 2031/ })
    await jan31.focus()
    await jan31.press('ArrowRight')
    await expect(
      grid.getByRole('button', { name: /^1 Feb 2031/ }),
    ).toBeFocused()
    await cell.focus()
    await cell.press('Enter')
    await expect(
      page.getByRole('dialog', { name: 'Mark 4 Dec 2031' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: /^Half day of leave/ })
      .press('Enter')
    await expect(cell).toBeFocused()
    await expect(cell).toHaveAttribute('aria-label', /Half day of leave/)
    await expect(
      page.locator('[data-part="vacay-bottom-region"]').getByRole('status'),
    ).toContainText('days left')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(cell).toHaveAttribute('aria-label', /Half day of leave/)
    expect(watched().fatal).toEqual([])
    await cell.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const clear = page.getByRole('button', { name: 'Clear this day' })
    await clear.click()
    await expect(cell).not.toHaveAttribute('aria-label', /Half day of leave/)
  })

  for (const width of WIDTHS) {
    test(`08-S5a failure recovery at ${width}px @chromium-only`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await unblockCrossOriginFonts(page)
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto(UNSET.path, { waitUntil: 'networkidle' })
      const cell = page
        .locator('[data-part="vacay-year"]')
        .getByRole('button', { name: /^4 Dec 2031/ })
      await page.route('**/_serverFn/**', (route) =>
        route.request().method() === 'POST'
          ? route.abort('failed')
          : route.continue(),
      )
      try {
        await cell.click()
        await page.getByRole('button', { name: /^Leave\s*Uses/ }).click()
        await expect(page.getByRole('alert')).toContainText('4 Dec 2031')
        await expect(cell).toBeFocused()
        const retry = page.getByRole('button', { name: 'Try again' })
        await expect(retry).toBeVisible()
        const box = await retry.boundingBox()
        expect(box).not.toBeNull()
        expect((box?.y ?? 800) + (box?.height ?? 0)).toBeLessThan(800 - 100)
        await expect(cell).not.toHaveAttribute('aria-label', /Leave/)
      } finally {
        await page.unroute('**/_serverFn/**')
      }
    })
  }

  for (const locale of ['ar', 'pl', 'vi', 'zh-Hans']) {
    test(`08-S5a month headings fit in ${locale} @chromium-only`, async ({
      page,
    }) => {
      test.setTimeout(60_000)
      await unblockCrossOriginFonts(page)
      await page.setViewportSize({ width: 1280, height: 900 })
      try {
        await page.goto('/settings/language', { waitUntil: 'networkidle' })
        const chip = page.getByTestId(`locale-chip-${locale}`)
        await chip.scrollIntoViewIfNeeded()
        if ((await chip.getAttribute('data-selected')) === null) {
          const saved = page.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              response.url().includes('/_serverFn/'),
          )
          await chip.click()
          await saved
        }
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        await page.goto(UNSET.path, { waitUntil: 'networkidle' })
        const headings = page.locator('[id^="vacay-month-"]')
        await expect(headings).toHaveCount(12)
        expect(
          await headings.evaluateAll((nodes) =>
            nodes
              .filter((node) => node.scrollWidth > node.clientWidth + 1)
              .map((node) => node.textContent),
          ),
        ).toEqual([])
      } finally {
        await page.goto('/settings/language', { waitUntil: 'networkidle' })
        const reset = page.getByTestId('locale-chip-workspace')
        await reset.scrollIntoViewIfNeeded()
        if ((await reset.getAttribute('data-selected')) === null) {
          const saved = page.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              response.url().includes('/_serverFn/'),
          )
          await reset.click()
          await saved
        }
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      }
    })
  }

  test('opens the editor, refuses a bad value, cancels, saves with Enter and puts the figure back', async ({
    page,
  }) => {
    const watched = watchConsole(page, VACAY)
    await visit(page, VACAY, 'light')

    await expect(
      page.getByRole('heading', { level: 2, name: `Allowance ${PINNED_YEAR}` }),
    ).toBeVisible()
    const original = await figure(page)
    const next = original === 21 ? 22 : 21

    try {
      // Escape cancels and writes nothing; focus is back on the tile.
      await tile(page).click()
      await expect(field(page)).toBeFocused()
      await field(page).fill(String(next))
      await field(page).press('Escape')
      await expect(field(page)).toHaveCount(0)
      await expect(tile(page)).toBeFocused()
      expect(await figure(page)).toBe(original)

      // A value the field cannot hold keeps the editor open, flagged and described.
      await tile(page).click()
      await field(page).fill('400')
      await field(page).press('Enter')
      await expect(field(page)).toHaveAttribute('aria-invalid', 'true')
      await expect(field(page)).toBeFocused()
      await expect(
        page.getByText('Enter a whole number from 0 to 365.'),
      ).toBeVisible()

      // The open editor with its message fits both widths.
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        expect(
          await overflowsHorizontally(page),
          `the open editor must not overflow at ${width}px`,
        ).toBe(false)
      }
      await field(page).press('Escape')

      // Enter saves, the screen reloads with the new figure and the live region says so.
      await tile(page).click()
      await field(page).fill(String(next))
      await field(page).press('Enter')
      await expect(field(page)).toHaveCount(0)
      await expect(tile(page)).toHaveAttribute(
        'aria-label',
        `Edit days, currently ${next}`,
      )
      await expect(tile(page)).toBeFocused()
      await expect(
        page.getByRole('status').filter({ hasText: 'Allowance saved.' }),
      ).toHaveCount(1)

      // It is the server's figure, not a local one: a reload shows the same.
      // Settled, not just loaded: the `finally` below clicks the tile, and a click on the server-
      // rendered button before hydration opens nothing.
      await page.reload({ waitUntil: 'domcontentloaded' })
      await settle(page, VACAY)
      await expect(tile(page)).toHaveAttribute(
        'aria-label',
        `Edit days, currently ${next}`,
      )
    } finally {
      await setAllowance(page, original)
    }

    const output = watched()
    expect(
      output.fatal,
      'the console must be clean once the page settled',
    ).toEqual([])
    if (output.tolerated.length > 0) {
      test.info().annotations.push({
        type: 'tolerated console output',
        description: `${VACAY.path}: ${output.tolerated.join('\n')}`,
      })
    }
  })

  test('opens and cancels in the dark theme without overflowing, and writes nothing', async ({
    page,
  }) => {
    await visit(page, VACAY, 'dark')
    const original = await figure(page)

    await tile(page).click()
    await expect(field(page)).toBeFocused()
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await overflowsHorizontally(page),
        `the open editor must not overflow at ${width}px in the dark theme`,
      ).toBe(false)
    }
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(field(page)).toHaveCount(0)
    await expect(tile(page)).toBeFocused()
    expect(await figure(page)).toBe(original)
  })

  test('shows the default caption full width, and a failed write keeps the value and offers a retry', async ({
    page,
  }) => {
    await visit(page, UNSET, 'light')
    const caption = page.getByText('Default allowance. Select to set your own.')
    await expect(caption).toBeVisible()

    // The first state a new traveller sees fits both widths, with and without the editor.
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await overflowsHorizontally(page),
        `the default state must not overflow at ${width}px`,
      ).toBe(false)
    }

    // Failing only the write: the re-read that follows is a GET and still succeeds, so a retry is
    // offered. Nothing reaches the database, so the fixture is untouched.
    await page.route('**/_serverFn/**', (route) =>
      route.request().method() === 'POST'
        ? route.abort('failed')
        : route.continue(),
    )
    await tile(page).click()
    await field(page).fill('30')
    await field(page).press('Enter')

    await expect(
      page.getByRole('alert').filter({ hasText: 'could not be saved' }),
    ).toBeVisible()
    await expect(field(page)).toHaveValue('30')
    await expect(field(page)).toBeFocused()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'Allowance saved.' }),
    ).toHaveCount(0)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await overflowsHorizontally(page),
        `the failed-write state must not overflow at ${width}px`,
      ).toBe(false)
    }

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(field(page)).toHaveCount(0)
  })
  test('shows the pinned year’s carried figure as the previous year’s leftover, in plain text', async ({
    page,
  }) => {
    await visit(page, VACAY, 'light')

    await expect(page.getByText(`Carried from ${OPENING_YEAR}`)).toBeVisible()
    await expect(carriedTile(page)).toHaveCount(0)
    // Nothing was used in the earlier year, so all 28 days of its allowance carry in.
    await expect(carriedFigure(page)).toHaveText('28')
    expect(await tileLabelsFit(page), 'the tile labels fit their tiles').toBe(
      true,
    )
  })

  test('edits the opening balance, sees the next year follow it, and puts it back', async ({
    page,
  }) => {
    await visit(page, OPENING, 'light')
    await expect(
      page.getByText(`Brought in from before ${OPENING_YEAR}. Select to edit.`),
    ).toBeVisible()
    expect(await tileLabelsFit(page), 'the tile labels fit their tiles').toBe(
      true,
    )
    const original = Number(
      /(\d+)$/.exec(
        (await carriedTile(page).getAttribute('aria-label')) ?? '',
      )?.[1],
    )
    const next = original + 4

    try {
      await carriedTile(page).click()
      const carriedField = page.getByRole('textbox', { name: /^Carried/ })
      await expect(carriedField).toBeFocused()
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        expect(
          await overflowsHorizontally(page),
          `the open carried editor must not overflow at ${width}px`,
        ).toBe(false)
      }
      await carriedField.fill(String(next))
      await carriedField.press('Enter')
      await expect(carriedField).toHaveCount(0)
      await expect(carriedTile(page)).toHaveAttribute(
        'aria-label',
        `Edit carried days, currently ${next}`,
      )
      await expect(carriedTile(page)).toBeFocused()

      // The year after it was rewritten in the same request, not on the next visit.
      await visit(page, VACAY, 'light')
      await expect(carriedFigure(page)).toHaveText(String(28 + next))
    } finally {
      await visit(page, OPENING, 'light')
      await carriedTile(page).click()
      const carriedField = page.getByRole('textbox', { name: /^Carried/ })
      await carriedField.fill(String(original))
      await carriedField.press('Enter')
      await expect(carriedTile(page)).toHaveAttribute(
        'aria-label',
        `Edit carried days, currently ${original}`,
      )
    }
  })

  test('shows a year without a row the leftover of the year before', async ({
    page,
  }) => {
    // 2027 has no row; 2026 has one, so 2027 shows what 2026 leaves: a year the traveller never
    // saved still carries into the next.
    const next: RouteCase = {
      name: 'vacay-row-less-year',
      path: `/vacay?year=${PINNED_YEAR + 1}`,
      ready: 'main',
    }
    await visit(page, next, 'light')

    await expect(page.getByText(`Carried from ${PINNED_YEAR}`)).toBeVisible()
    await expect(carriedTile(page)).toHaveCount(0)
    await expect(
      page.getByText('Default allowance. Select to set your own.'),
    ).toBeVisible()
  })

  test('switches carry-over off and on without losing the carried figure, and puts the settings back', async ({
    page,
  }) => {
    const watched = watchConsole(page, VACAY)
    await visit(page, VACAY, 'light')
    const carried = await carriedFigure(page).innerText()
    expect(
      Number(carried),
      'the pinned year carries something',
    ).toBeGreaterThan(0)

    try {
      // The dialog opens on the plan's values, named by its title, with the hints linked to it.
      await settingsButton(page).click()
      await expect(settingsDialog(page)).toBeVisible()
      await expect(carryOverBox(page)).toBeChecked()
      await expect(defaultField(page)).toHaveValue(/^\d+$/)

      // Saving with nothing changed closes without a request and returns focus to the button.
      let writes = 0
      await page.route('**/_serverFn/**', (route) => {
        if (route.request().method() === 'POST') writes += 1
        return route.continue()
      })
      await saveSettings(page).click()
      await expect(settingsDialog(page)).toHaveCount(0)
      await expect(settingsButton(page)).toBeFocused()
      expect(writes, 'an empty change makes no call').toBe(0)
      await page.unroute('**/_serverFn/**')

      // Off: the figure is hidden, not erased; on: it comes back, with no recompute in between.
      await changeSettings(page, { carryOver: false })
      await expect(carriedFigure(page)).toHaveText('0')
      await expect(page.getByText('Carry-over is off')).toBeVisible()
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: 'Leave plan settings saved.' }),
      ).toHaveCount(1)

      await changeSettings(page, { carryOver: true })
      await expect(carriedFigure(page)).toHaveText(carried)
    } finally {
      await changeSettings(page, { carryOver: true })
    }

    expect(watched().fatal, 'the console must be clean').toEqual([])
  })

  test('changes the default allowance for a year without a row, and puts it back', async ({
    page,
  }) => {
    // Four cold page loads against the dev server: more than the default budget.
    test.slow()
    const original = await planDefault(page)
    const next = original === 30 ? 31 : 30

    try {
      await visit(page, VACAY, 'light')
      await changeSettings(page, { defaultDays: next })

      await visit(page, UNSET, 'light')
      await expect(tile(page)).toHaveAttribute(
        'aria-label',
        `Edit days, currently ${next}`,
      )
      await expect(
        page.getByText('Default allowance. Select to set your own.'),
      ).toBeVisible()
    } finally {
      await visit(page, VACAY, 'light')
      await changeSettings(page, { defaultDays: original })
    }
  })

  test('refuses an invalid default, keeps the dialog open and lands on the field', async ({
    page,
  }) => {
    await visit(page, VACAY, 'light')
    await settingsButton(page).click()

    await defaultField(page).fill('400')
    await defaultField(page).press('Enter')

    await expect(settingsDialog(page)).toBeVisible()
    await expect(defaultField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(defaultField(page)).toBeFocused()
    // The field's own message and the hidden alert that announces it say the same words.
    await expect(
      settingsDialog(page)
        .getByText('Enter a whole number from 0 to 365.')
        .first(),
    ).toBeVisible()
    await expect(settingsDialog(page).getByRole('alert')).toHaveText(
      'Enter a whole number from 0 to 365.',
    )

    await page.keyboard.press('Escape')
    await expect(settingsDialog(page)).toHaveCount(0)
    await expect(settingsButton(page)).toBeFocused()
  })

  test('keeps the settings button tall enough to touch at 360px, and Save in view with the keyboard up', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await visit(page, VACAY, 'light')

    const box = await settingsButton(page).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)

    // The header wraps at this width; the year switcher must move as one group, never split.
    const previous = await page
      .getByRole('link', { name: 'Previous year' })
      .boundingBox()
    const next = await page
      .getByRole('link', { name: 'Next year' })
      .boundingBox()
    expect(previous && next && Math.abs(previous.y - next.y) < 2).toBe(true)

    // 360x500 stands in for a phone with its keyboard up: the visible area is short.
    await page.setViewportSize({ width: 360, height: 500 })
    await settingsButton(page).click()
    await defaultField(page).focus()
    const inView = await saveSettings(page).evaluate((button) => {
      const { top, bottom } = button.getBoundingClientRect()
      const height = window.visualViewport?.height ?? window.innerHeight
      return top >= 0 && bottom <= height
    })
    expect(inView, 'Save stays inside the visual viewport').toBe(true)
    expect(await overflowsHorizontally(page)).toBe(false)
    await page.keyboard.press('Escape')
    await expect(settingsDialog(page)).toHaveCount(0)
  })

  test('opens the dialog in both themes at 360, 1280 and 2560 without overflowing, and writes nothing', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark'] as const) {
      await visit(page, VACAY, theme)
      for (const width of [...WIDTHS, WIDE]) {
        await page.setViewportSize({ width, height: 900 })
        await settingsButton(page).click()
        await expect(settingsDialog(page)).toBeVisible()
        expect(
          await overflowsHorizontally(page),
          `the open dialog must not overflow at ${width}px in the ${theme} theme`,
        ).toBe(false)
        await page.keyboard.press('Escape')
        await expect(settingsDialog(page)).toHaveCount(0)
        await expect(settingsButton(page)).toBeFocused()
      }
    }
  })

  test('keeps the dialog open with the values on a failed save and moves focus to the alert', async ({
    page,
  }) => {
    await visit(page, VACAY, 'light')
    await settingsButton(page).click()
    await carryOverBox(page).click()

    // Failing only the write: nothing reaches the database, so the fixture is untouched.
    await page.route('**/_serverFn/**', (route) =>
      route.request().method() === 'POST'
        ? route.abort('failed')
        : route.continue(),
    )
    await saveSettings(page).click()

    const alert = settingsDialog(page).getByRole('alert')
    await expect(alert).toContainText('could not be saved')
    await expect(alert).toBeFocused()
    await expect(settingsDialog(page)).toBeVisible()
    await expect(carryOverBox(page)).not.toBeChecked()
    await page.unroute('**/_serverFn/**')
    await page.keyboard.press('Escape')
    await expect(settingsDialog(page)).toHaveCount(0)
  })
  // Reuses the Chromium-only serial fixture harness above.
  test('08-S4a - renames a collection and changes a saved place status, then restores both', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const routeCase: RouteCase = {
      name: 'collection-management',
      path: '/collections',
      ready: 'main',
    }
    const watched = watchConsole(page, routeCase)
    await visit(page, routeCase, 'light')
    await page.locator('main a[href^="/collections/"]').first().click()
    await expect(
      page.getByRole('button', { name: /^Actions for / }),
    ).toBeVisible()
    const heading = page.getByRole('heading', { level: 1 })
    const originalName = await heading.innerText()
    const nextName = originalName + ' - edited'
    const firstCard = page
      .locator('main li')
      .filter({
        has: page.getByRole('button', { name: /: status .*Change status/ }),
      })
      .first()
    const statusTrigger = firstCard.getByRole('button', {
      name: /: status .*Change status/,
    })
    const originalStatus = (await statusTrigger.innerText()).trim()
    const nextStatus = originalStatus === 'Visited' ? 'Idea' : 'Visited'
    const detailPath = new URL(page.url()).pathname
    async function rename(name: string) {
      await page.getByRole('button', { name: /^Actions for / }).click()
      await page.getByRole('menuitem', { name: 'Edit details' }).click()
      const dialog = page.getByRole('dialog')
      await dialog
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill(name)
      await dialog.getByRole('button', { name: 'Save changes' }).click()
      await expect(dialog).toHaveCount(0)
      await expect(heading).toHaveText(name)
    }
    async function status(name: string) {
      await statusTrigger.click()
      await page.getByRole('menuitemradio', { name, exact: true }).click()
      await expect(statusTrigger).toHaveText(name)
    }
    try {
      await rename(nextName)
      await status(nextStatus)
      await rename(originalName)
      await status(originalStatus)
      await page
        .getByRole('link', { name: new RegExp('^' + originalStatus) })
        .click()
      const filteredTriggers = page.getByRole('button', {
        name: /: status .*Change status/,
      })
      await expect
        .poll(async () => {
          const statuses = await filteredTriggers.allTextContents()
          return (
            statuses.length > 0 &&
            statuses.every((value) => value.trim() === originalStatus)
          )
        })
        .toBe(true)
      const nextTriggerName =
        (await filteredTriggers.count()) > 1
          ? await filteredTriggers.nth(1).getAttribute('aria-label')
          : null
      const changedPlace = await statusTrigger.getAttribute('aria-label')
      await statusTrigger.click()
      await page
        .getByRole('menuitemradio', { name: nextStatus, exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: changedPlace ?? '', exact: true }),
      ).toHaveCount(0)
      if (nextTriggerName) {
        await expect(
          page.getByRole('button', { name: nextTriggerName, exact: true }),
        ).toBeFocused()
      } else {
        await expect(
          page.getByRole('heading', { name: 'Nothing matches that filter' }),
        ).toBeFocused()
      }
      await expect(
        page.getByRole('status').filter({ hasText: 'hidden by the filter' }),
      ).toContainText(nextStatus)
      await page.goto(detailPath)
      await settle(page, {
        name: 'collection-detail',
        path: detailPath,
        ready: 'main',
      })
      await status(originalStatus)
    } finally {
      await page.keyboard.press('Escape')
      await page.goto(detailPath)
      await settle(page, {
        name: 'collection-detail',
        path: detailPath,
        ready: 'main',
      })
      if ((await heading.innerText()) !== originalName)
        await rename(originalName)
      if ((await statusTrigger.innerText()).trim() !== originalStatus)
        await status(originalStatus)
    }
    expect(watched().fatal).toEqual([])
  })
})

/** Regions write only in Chromium; WebKit checks the same form without changing the shared fixture. */
test.describe('08-S2a - a traveller records regions', () => {
  test.setTimeout(120_000)
  test.describe.configure({ mode: 'serial' })
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    expect(await hasSession(page)).toBe(true)
  })
  for (const theme of ['light', 'dark'] as const) {
    test(`adds and removes a region in ${theme}`, async ({
      page,
      browserName,
    }) => {
      const route: RouteCase = {
        name: 'atlas',
        path: '/atlas',
        ready: 'main',
        map: true,
      }
      const watched = watchConsole(page, route)
      await visit(page, route, theme)
      await page.getByRole('button', { name: 'Find a country' }).click()
      await page
        .getByRole('combobox', { name: 'Find a country' })
        .fill('France')
      await page.getByRole('option', { name: 'France' }).first().click()
      const regions = page.locator(
        '[data-part="country-panel"] [data-part="country-panel-regions"]',
      )
      await expect(regions).toHaveCount(1)
      const input = regions.getByRole('textbox', {
        name: 'Add a region in France',
      })
      await expect(input).toBeEnabled()
      if (browserName === 'chromium') {
        const name = `Atlas journey ${theme}`
        const remove = regions.getByRole('button', {
          name: `Remove ${name}`,
          exact: true,
        })
        await expect(remove).toHaveCount(0)
        try {
          await input.fill(name)
          await input.press('Enter')
          await expect(remove).toBeVisible()
          await expect(
            page.getByRole('button', { name: `Remove ${name}`, exact: true }),
          ).toHaveCount(
            await page.locator('[data-part="country-actions"]').count(),
          )
          await expect(input).toHaveValue('')
          await expect(input).toBeFocused()
          await page.reload()
          await settle(page, route)
          await page.getByRole('button', { name: 'Find a country' }).click()
          await page
            .getByRole('combobox', { name: 'Find a country' })
            .fill('France')
          await page.getByRole('option', { name: 'France' }).first().click()
          await expect(remove).toBeVisible()
        } finally {
          if (await remove.count()) {
            await remove.click()
            await expect(remove).toHaveCount(0)
            await expect(
              page.getByRole('button', { name: `Remove ${name}`, exact: true }),
            ).toHaveCount(0)
          }
        }
      }
      expect(watched().fatal).toEqual([])
    })
  }
})

type RegionShiftProbe = Window & {
  regionShiftProbe: {
    own: number
    other: number
    entries: number
    reset: () => void
    stop: () => void
  }
}

test.describe('08-S2a - region loading and both hosts', () => {
  test.setTimeout(120_000)
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    expect(await hasSession(page)).toBe(true)
  })
  for (const width of [360, 1280]) {
    test(`keeps loading stable and all controls reachable at ${width}`, async ({
      page,
      browserName,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 })
      const route: RouteCase = {
        name: 'atlas',
        path: '/atlas',
        ready: 'main',
        map: true,
      }
      const watched = watchConsole(page, route)
      await visit(page, route, 'light')
      let release: () => void = () => {}
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/_serverFn/**', async (request) => {
        if (request.request().method() !== 'GET') {
          await request.continue()
          return
        }
        const response = await request.fetch()
        const body = await response.text()
        if (body.includes('"regions"') && body.includes('"total"')) await held
        await request.fulfill({ response })
      })
      try {
        await page.getByRole('button', { name: 'Find a country' }).click()
        await page
          .getByRole('combobox', { name: 'Find a country' })
          .fill('France')
        await page.getByRole('option', { name: 'France' }).first().click()
        const panel = page.locator('[data-part="country-panel"]')
        const section = panel.locator('[data-part="country-panel-regions"]')
        await expect(section).toHaveCount(1)
        await expect(section.getByRole('textbox')).toBeDisabled()
        await section.scrollIntoViewIfNeeded()
        if (browserName === 'chromium') {
          await page.evaluate(() => {
            const probe = {
              own: 0,
              other: 0,
              entries: 0,
              reset: () => {},
              stop: () => {},
            }
            const observer = new PerformanceObserver((list) => {
              for (const item of list.getEntries()) {
                const shift = item as PerformanceEntry & {
                  value: number
                  sources?: Array<{ node?: Node }>
                }
                probe.entries += 1
                const own = shift.sources?.some(
                  (source) =>
                    source.node instanceof Element &&
                    source.node.closest(
                      '[data-part="country-panel-regions"]',
                    ) !== null,
                )
                if (own) probe.own += shift.value
                else probe.other += shift.value
              }
            })
            observer.observe({ type: 'layout-shift', buffered: false })
            probe.reset = () => {
              observer.takeRecords()
              probe.own = 0
              probe.other = 0
              probe.entries = 0
            }
            probe.stop = () => observer.disconnect()
            ;(window as unknown as RegionShiftProbe).regionShiftProbe = probe
          })
          const form = section.locator('form')
          await form.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          await form.evaluate((node) => {
            node.style.paddingInlineStart = '40px'
          })
          await page.waitForTimeout(250)
          await form.evaluate((node) => {
            node.style.paddingInlineStart = '0px'
          })
          await expect
            .poll(
              () =>
                page.evaluate(
                  () =>
                    (window as unknown as RegionShiftProbe).regionShiftProbe
                      .own,
                ),
              {
                message:
                  'the probe must detect an intentional shift inside the measured section',
              },
            )
            .toBeGreaterThan(0)
          await testInfo.attach('region-positive-shift-probe', {
            body: JSON.stringify(
              await page.evaluate(
                () => (window as unknown as RegionShiftProbe).regionShiftProbe,
              ),
            ),
            contentType: 'application/json',
          })
          await page.waitForTimeout(250)
          await page.evaluate(() =>
            (window as unknown as RegionShiftProbe).regionShiftProbe.reset(),
          )
        }
        release()
        const input = section.getByRole('textbox', {
          name: 'Add a region in France',
        })
        await expect(input).toBeEnabled()
        await page.waitForTimeout(200)
        if (browserName === 'chromium') {
          const measured = await page.evaluate(() => {
            const probe = (window as unknown as RegionShiftProbe)
              .regionShiftProbe
            probe.stop()
            return {
              own: probe.own,
              other: probe.other,
              entries: probe.entries,
            }
          })
          await testInfo.attach('region-loading-shifts', {
            body: JSON.stringify(measured),
            contentType: 'application/json',
          })
          expect(measured.own).toBe(0)
        }
        const hosts = page.locator('[data-part="country-actions"]')
        expect(await hosts.count()).toBeGreaterThanOrEqual(1)
        if (width === 1280) await expect(hosts).toHaveCount(2)
        for (const host of await hosts.all()) {
          await expect(
            host.locator('[data-part="country-panel-regions"]'),
          ).toHaveCount(1)
          expect(
            await host.evaluate((node) => {
              const controls = [...node.querySelectorAll('button,input')]
              const region = node.querySelector(
                '[data-part="country-panel-regions"]',
              )
              const inputIndex = controls.findIndex(
                (control) => control.tagName === 'INPUT',
              )
              const regionStart = controls.findIndex((control) =>
                region?.contains(control),
              )
              return (
                regionStart >= 2 &&
                inputIndex >= regionStart &&
                controls[inputIndex + 1]?.getAttribute('type') === 'submit'
              )
            }),
          ).toBe(true)
        }
        await input.scrollIntoViewIfNeeded()
        await input.focus()
        await expect(input).toBeInViewport()
        expect(
          await panel.evaluate((node) => {
            const box = node.getBoundingClientRect()
            return box.left >= 0 && box.right <= innerWidth
          }),
        ).toBe(true)
        if (width === 360) {
          // A reduced visual viewport exercises the space left by a phone keyboard.
          await page.setViewportSize({ width: 360, height: 480 })
          await input.scrollIntoViewIfNeeded()
          await expect(input).toBeInViewport()
        }
        expect(watched().fatal).toEqual([])
      } finally {
        release()
        await page.unroute('**/_serverFn/**')
      }
    })
  }
})
