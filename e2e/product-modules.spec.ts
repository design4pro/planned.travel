import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
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
})
