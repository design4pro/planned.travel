import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import { PINNED_YEAR } from './helpers/routes.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'

/**
 * `08-S1` - a traveller sets their own allowance on the leave planner (plan stage 08-S1, ticket
 * 08-S1a).
 *
 * The walk is the whole keyboard story of the "Days" tile: open it, refuse a value the field cannot
 * hold, cancel, save with Enter and find the figure changed after the reload. Chromium only and
 * serial, because it writes the demo member's allowance row for the pinned year; the walk puts the
 * figure back in its `finally`, so a failed run leaves the fixture as it found it.
 * `playwright.config.ts` names this describe among the fixture writers.
 */
const VACAY: RouteCase = {
  name: 'vacay',
  path: `/vacay?year=${PINNED_YEAR}`,
  ready: 'main',
}

const TILE = /^Edit days, currently \d+$/

function tile(page: Page) {
  return page.getByRole('button', { name: TILE })
}

function field(page: Page) {
  return page.getByRole('textbox', { name: 'Days' })
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
      await page.reload({ waitUntil: 'domcontentloaded' })
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
})
