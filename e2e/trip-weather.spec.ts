import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import type { Theme } from './helpers/routes.ts'
import { onRoute, planRoute, tripIdByName } from './helpers/places-and-maps.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'
import { settleMutations } from './helpers/settle.ts'
import {
  BADGE,
  LOADING,
  NOT_YET_RECORDED,
  UNAVAILABLE,
  countLayoutShifts,
  dayHeader,
  dayRegion,
  holdWeatherRead,
  showDays,
  layoutShiftSum,
  shiftsSoFar,
  vendorCalls,
  watchVendorRequests,
} from './helpers/trip-weather.ts'

/**
 * `DOC-08` — the weather of a day, proven as a traveller meets it (`.ai/specs/2026-09-19-per-day-weather.md`).
 *
 * Deterministic without a stub. The demo seed writes the cache entries the planner reads and spends
 * the workspace's weather allowance (`src/routes/api/dev/-seed/weather-cache.ts`), and the suite
 * pins the Worker to the fixture day, so against the seeded trips the days are:
 *
 * | Trip          | Day            | Kind                                        |
 * | ------------- | -------------- | ------------------------------------------- |
 * | Lisbon        | 1              | recorded                                    |
 * | Lisbon        | 2, 3           | not yet recorded                            |
 * | Lisbon        | 4 (today), 5   | forecast                                    |
 * | Lisbon        | 6              | unavailable: no entry, and no allowance left |
 * | Lisbon        | 7              | nothing: no place to ask about              |
 * | Tokyo & Kyoto | 1              | estimate                                    |
 *
 * Everything below reads what a traveller sees - roles, accessible names, geometry - and adds
 * nothing to the Worker. Whether a vendor was asked is read twice: from the browser's requests, and
 * from the console's provider ledger, which counts every call the Worker makes.
 */

const LISBON = 'Lisbon, slowly'
const TOKYO = 'Tokyo & Kyoto'

/** The Lisbon days by the title their section carries, in the order of the trip. */
const LISBON_DAYS = {
  recorded: 'Land and climb',
  notYetOne: 'Alfama on foot',
  notYetTwo: 'Seafood and the market',
  forecastToday: 'Belém',
  forecastNext: 'LX Factory and the bridge',
  unavailable: 'Out to Cascais',
  empty: 'Late flight home',
} as const

/** Two plan screens and a console screen, each cold on a dev server: the budget of the map journeys. */
const WEATHER_JOURNEY_TIMEOUT_MS = 120_000

test.describe('DOC-08 — the weather of a day', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    test.setTimeout(WEATHER_JOURNEY_TIMEOUT_MS)
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('every state of a day is drawn as what it is, and nothing moves when the answer arrives', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, LISBON)
    const callsBefore = await vendorCalls(context)

    const page = await context.newPage()
    try {
      const route = planRoute(tripId)
      const watched = watchConsole(page, route)
      const vendorRequests = watchVendorRequests(page)
      await countLayoutShifts(page)
      const held = await holdWeatherRead(page)

      await visit(page, route, 'light')
      await showDays(page)

      // The page is up and waiting: every dated day shows that it is loading.
      const first = dayHeader(dayRegion(page, LISBON_DAYS.recorded))
      await expect(
        dayRegion(page, LISBON_DAYS.recorded).getByRole('img', {
          name: LOADING,
        }),
      ).toBeVisible()
      const before = await first.boundingBox()
      expect(before, 'the first day header is on screen').not.toBeNull()

      // The shell has done its own loading; what moves from here on, moves for the weather.
      const shellShifts = await shiftsSoFar(page)
      held.release()

      const recorded = dayRegion(page, LISBON_DAYS.recorded)
      await expect(
        recorded.getByRole('button', { name: BADGE.recorded }),
      ).toBeVisible()
      await expect(
        page.getByRole('img', { name: LOADING }),
        'no day is still loading once the answer is in',
      ).toHaveCount(0)
      await settleMutations(page)

      // The header is where it was: a late answer fills a box that was already there.
      expect(await first.boundingBox()).toEqual(before)
      expect(
        await layoutShiftSum(page, shellShifts),
        'the plan route shifted its layout while the weather arrived',
      ).toBe(0)
      test.info().annotations.push({
        type: 'layout shift of the whole visit',
        description: `${await layoutShiftSum(page)} (the shell's nav, before any weather; ${await layoutShiftSum(page, shellShifts)} after the answer)`,
      })

      await expectLisbonStates(page)

      expect(vendorRequests(), 'the browser asked a weather service').toEqual(
        [],
      )
      const output = watched()
      expect(output.fatal, 'the console must be clean').toEqual([])
    } finally {
      await page.close()
    }

    expect(
      await vendorCalls(context),
      'the Worker called a weather service: the allowance was meant to be spent',
    ).toEqual(callsBefore)
  })

  test('a day beyond the forecast is an estimate, marked and named as one', async ({
    context,
  }) => {
    const tripId = await tripIdByName(context, TOKYO)
    await onRoute(context, planRoute(tripId), async (page) => {
      await showDays(page)
      const badge = page.getByRole('button', { name: BADGE.estimate })
      await expect(
        badge,
        'exactly one Tokyo day has a cached climate',
      ).toHaveCount(1)
      await expect(badge).toBeVisible()
      // The sign that sets it apart from a forecast, drawn but never read out.
      await expect(badge).toContainText('≈')
      await expect(
        page.getByRole('button', { name: BADGE.forecast }),
      ).toHaveCount(0)
      // The other days have no entry and no allowance, and say so rather than showing a number.
      await expect(
        page.getByRole('img', { name: UNAVAILABLE }).first(),
      ).toBeVisible()
    })
  })

  test('the badge opens from the keyboard and closes back onto itself', async ({
    context,
  }) => {
    const lisbon = await tripIdByName(context, LISBON)
    await onRoute(context, planRoute(lisbon), async (page) => {
      await showDays(page)
      await openAndCloseByKeyboard(
        page,
        dayRegion(page, LISBON_DAYS.forecastToday),
        BADGE.forecast,
      )
      await openAndCloseByKeyboard(
        page,
        dayRegion(page, LISBON_DAYS.recorded),
        BADGE.recorded,
      )
    })

    const tokyo = await tripIdByName(context, TOKYO)
    await onRoute(context, planRoute(tokyo), async (page) => {
      await showDays(page)
      await openAndCloseByKeyboard(
        page,
        page.getByRole('region').filter({
          has: page.getByRole('button', { name: BADGE.estimate }),
        }),
        BADGE.estimate,
      )
    })
  })
})

/**
 * Pictures of every state, for the pull request - not a comparison. No frame is asserted against a
 * stored image (the suite grades the console and the DOM, not pixels), so this test only runs when
 * `WEATHER_EVIDENCE_DIR` names a directory, and writes one PNG per theme, width and state there.
 */
const EVIDENCE_DIR = process.env.WEATHER_EVIDENCE_DIR
const EVIDENCE_WIDTHS: ReadonlyArray<number> = [360, 1280, 2560]
const EVIDENCE_THEMES: ReadonlyArray<Theme> = ['light', 'dark']
const EVIDENCE_HEIGHT = 900
const EVIDENCE_TIMEOUT_MS = 600_000

test.describe('DOC-08 — evidence', () => {
  test.skip(
    EVIDENCE_DIR === undefined,
    'set WEATHER_EVIDENCE_DIR to write the pull request pictures',
  )

  test('every state, light and dark, at 360, 1280 and 2560', async ({
    context,
    page: session,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'the pictures are taken once, in chromium',
    )
    test.setTimeout(EVIDENCE_TIMEOUT_MS)
    await useSession(context, session, baseURL)
    test.skip(!(await hasSession(session)), `${DEMO_EMAIL} has no session`)
    const outDir = EVIDENCE_DIR ?? ''
    await mkdir(outDir, { recursive: true })

    const lisbon = await tripIdByName(context, LISBON)
    const tokyo = await tripIdByName(context, TOKYO)

    const shoot = async (
      target: Locator | Page,
      theme: Theme,
      width: number,
      state: string,
    ) => {
      await target.screenshot({
        path: join(outDir, `${theme}-${width}-${state}.png`),
      })
    }

    for (const theme of EVIDENCE_THEMES) {
      for (const width of EVIDENCE_WIDTHS) {
        const page = await context.newPage()
        try {
          await page.setViewportSize({ width, height: EVIDENCE_HEIGHT })
          const held = await holdWeatherRead(page)
          await visit(page, planRoute(lisbon), theme)
          await showDays(page)

          const day = (title: string) => dayRegion(page, title)
          await expect(
            day(LISBON_DAYS.recorded).getByRole('img', { name: LOADING }),
          ).toBeVisible()
          await shoot(day(LISBON_DAYS.recorded), theme, width, 'loading')

          held.release()
          await expect(
            day(LISBON_DAYS.recorded).getByRole('button', {
              name: BADGE.recorded,
            }),
          ).toBeVisible()
          await settleMutations(page)

          await shoot(day(LISBON_DAYS.forecastToday), theme, width, 'forecast')
          await shoot(day(LISBON_DAYS.recorded), theme, width, 'recorded')
          await shoot(
            day(LISBON_DAYS.notYetOne),
            theme,
            width,
            'not-yet-recorded',
          )
          await shoot(day(LISBON_DAYS.unavailable), theme, width, 'unavailable')

          await openByKeyboard(
            page,
            day(LISBON_DAYS.forecastToday),
            BADGE.forecast,
          )
          await shoot(page, theme, width, 'forecast-popover')
        } finally {
          await page.close()
        }

        const away = await context.newPage()
        try {
          await away.setViewportSize({ width, height: EVIDENCE_HEIGHT })
          await visit(away, planRoute(tokyo), theme)
          await showDays(away)
          const estimate = away.getByRole('region').filter({
            has: away.getByRole('button', { name: BADGE.estimate }),
          })
          await expect(estimate).toBeVisible()
          await shoot(estimate, theme, width, 'estimate')
          await openByKeyboard(away, estimate, BADGE.estimate)
          await shoot(away, theme, width, 'estimate-popover')
        } finally {
          await away.close()
        }
      }
    }
  })
})

/** Every Lisbon day, by what a traveller reads on it. */
async function expectLisbonStates(page: Page): Promise<void> {
  const day = (title: string) => dayRegion(page, title)

  await expect(
    day(LISBON_DAYS.recorded).getByRole('button', { name: BADGE.recorded }),
  ).toBeVisible()
  for (const title of [LISBON_DAYS.notYetOne, LISBON_DAYS.notYetTwo]) {
    await expect(
      day(title).getByRole('img', { name: NOT_YET_RECORDED }),
    ).toBeVisible()
  }
  for (const title of [LISBON_DAYS.forecastToday, LISBON_DAYS.forecastNext]) {
    await expect(
      day(title).getByRole('button', { name: BADGE.forecast }),
    ).toBeVisible()
  }
  await expect(
    day(LISBON_DAYS.unavailable).getByRole('img', { name: UNAVAILABLE }),
  ).toBeVisible()

  // A day with no place asks nothing and draws nothing: no badge, no dash, no number.
  const empty = day(LISBON_DAYS.empty)
  await expect(
    empty.getByRole('button', { name: /^(Forecast|Recorded|Estimate)/ }),
  ).toHaveCount(0)
  await expect(
    empty.getByRole('img', {
      name: new RegExp(`^(${LOADING}|${NOT_YET_RECORDED}|${UNAVAILABLE})$`),
    }),
  ).toHaveCount(0)
}

/** Tab from the day's header to its badge and open it with Enter: the keyboard way in. */
async function openByKeyboard(
  page: Page,
  region: Locator,
  name: RegExp,
): Promise<Locator> {
  const badge = region.getByRole('button', { name })
  await dayHeader(region).focus()
  await page.keyboard.press('Tab')
  await expect(badge).toBeFocused()

  await page.keyboard.press('Enter')
  const panel = page.getByRole('dialog', { name: /^Weather for / })
  await expect(panel).toBeVisible()
  return panel
}

/**
 * Open the badge from the keyboard, close it with Escape, and land back on the badge: the whole
 * keyboard contract of a popover, in the order a reader performs it.
 */
async function openAndCloseByKeyboard(
  page: Page,
  region: Locator,
  name: RegExp,
): Promise<void> {
  const panel = await openByKeyboard(page, region, name)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(region.getByRole('button', { name })).toBeFocused()
}
