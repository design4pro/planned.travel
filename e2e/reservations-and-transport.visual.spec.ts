import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  DEMO_EMAIL,
  auditServerClock,
  hasSession,
  settle,
  useSession,
  visit,
  watchConsole,
} from './helpers/shoot.ts'
import type { RouteCase } from './helpers/shoot.ts'

/**
 * The reservations-and-transport plan's own end-to-end gate
 * (`docs/plans/03-reservations-and-transport.md`), per
 * `docs/plans/12-verification-protocol.md` §4: one spec file per plan file, one
 * `test.describe` block per stage, each with its own route table and touching no
 * other block — so two stages of the same plan can append here without either
 * editing the other's evidence.
 *
 * **No frame is filed by this block, and that is a decision rather than an
 * omission.** Recording a baseline means running Playwright with
 * `--update-snapshots`, which the implementation loop is forbidden to do, and this
 * ticket declares no visual change for the orchestrator to re-record. So this
 * block asserts everything about the screen that is not a picture — the published
 * selector the capture is driven by, the relabelled controls that only exist once
 * the dialog is open, a silent console and no layout shift after the settle — and
 * `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` stays empty
 * until whoever records the frames records them. What is here fails for the same
 * reasons a frame would, minus the pixels.
 */

/** The trip the seeded workspace guarantees, and the tab this stage owns. */
const TRIP_ID = 'demo-trip-01-tokyo-and-kyoto'

/**
 * The action that opens the dialog, published as `data-part` so the selector
 * survives a restyle. `03-S1`'s declared non-resting state is reached through it.
 */
const NEW_TRANSPORT = '[data-part="new-transport"]'

/**
 * Choose the nth day from one of the dialog's two day selects.
 *
 * By accessible name and option index rather than by label text: the option
 * labels carry the trip's own day titles, which belong to the fixture and not to
 * this stage.
 */
async function pickDay(page: Page, name: string, nth: number): Promise<void> {
  const trigger = page.getByRole('dialog').getByRole('combobox', { name })
  await trigger.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()

  /*
   * Driven from the keyboard rather than by clicking the option, and the reason
   * is a defect this stage found rather than a Playwright quirk: `--z-dropdown`
   * is 50 and `--z-overlay` is 60 (`src/styles/tokens.css:717-718`), so a Radix
   * popper portalled from inside a `Dialog` renders *under* the dialog's scrim.
   * `document.elementFromPoint` at the centre of this listbox returns the
   * overlay, and the same is true of the booking dialog's own day select, which
   * shipped before this ticket — so it is pre-existing and reported on the issue
   * rather than fixed here, from a stage that owns neither the token scale nor
   * `components/ui/select.tsx`.
   *
   * The keyboard path is the one WCAG 2.2 requires to work anyway, so asserting
   * through it is coverage rather than a workaround. Waiting for focus to reach
   * an option first is not optional: Radix moves it a frame after the content
   * mounts, and a key pressed before that lands on the trigger and is lost.
   */
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('role') === 'option',
  )
  /*
   * One step at a time, each waited for. Radix moves the focus inside a
   * `setTimeout`, so two `ArrowDown`s pressed back to back are both computed
   * from the same starting item and land one step down between them — and an
   * `Enter` that follows immediately selects whatever was still focused.
   */
  for (let step = 0; step < nth; step += 1) {
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(
      (index: number) =>
        [...document.querySelectorAll('[role="option"]')][index] ===
        document.activeElement,
      step + 1,
    )
  }
  await page.keyboard.press('Enter')

  // The two triggers sit in one dialog, so the first menu has to be gone before
  // the second is opened.
  await expect(listbox).toHaveCount(0)
  await expect(trigger).not.toHaveText('No day yet')
}

/**
 * Delete every card carrying this title, so the seeded workspace the other specs
 * photograph is the one they started with.
 *
 * `action` is the label the row's menu item and the confirmation button both
 * carry — `Remove transport` for one card, `Remove booking` for the other. The
 * two rows are the same card with the same menu, so this is one walk rather than
 * one per stage.
 */
async function removeCards(
  page: Page,
  title: string,
  action: string,
): Promise<void> {
  const cards = page.locator('article').filter({ hasText: title })
  for (let left = await cards.count(); left > 0; left -= 1) {
    await cards
      .first()
      .getByRole('button', { name: `Actions for ${title}` })
      .click()
    await page.getByRole('menuitem', { name: action }).click()
    await page.getByRole('dialog').getByRole('button', { name: action }).click()
    await expect(cards).toHaveCount(left - 1)
  }
}

test.describe('03-S1 — A transport that knows which day it leaves and which day it lands', () => {
  /**
   * This block's route table. One route: the transports tab of the seeded trip.
   *
   * `relativeTime: true` is measured, not assumed, and it contradicts the stage
   * text — which declares both trip tabs `relativeTime: false`. Every trip tab's
   * document carries the Worker's `today`, because the *layout* loader puts it
   * there (`loadTripHeader`, `src/routes/_app/-server/trip.ts:132`), not this
   * tab's own loader. The flag is a fact about the payload rather than about what
   * this screen prints, and `auditServerClock()` reads it off the streamed
   * document in both directions: declaring `false` here failed on both projects.
   */
  const TRANSPORTS: RouteCase = {
    name: 'trip-transports',
    path: `/trips/${TRIP_ID}/transports`,
    ready: 'main',
    relativeTime: true,
  }

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('the transports tab renders, and says nothing to the console', async ({
    page,
  }) => {
    const report = watchConsole(page, TRANSPORTS)
    await visit(page, TRANSPORTS, 'light')

    await expect(page.locator('h1, h2').first()).toBeVisible()

    // The selector the capture is driven by has to resolve, or the frame that
    // would be filed from it is a frame of the wrong thing.
    await expect(page.locator(NEW_TRANSPORT)).toHaveCount(1)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the declaration matches what the Worker sends', async ({ page }) => {
    await auditServerClock(page, [TRANSPORTS])
  })

  /**
   * The relabelling, read off the running screen rather than off the unit test:
   * `endpointLabels()` decides four strings and this is the assertion that they
   * reach the controls a person actually operates. A hire car is picked up and
   * returned; every other mode departs and arrives.
   */
  test('a hire car is picked up and returned, and a flight is not', async ({
    page,
  }) => {
    const report = watchConsole(page, TRANSPORTS)
    await visit(page, TRANSPORTS, 'light')

    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The dialog opens on `flight`, which is the generic pair.
    await expect(
      dialog.getByRole('combobox', { name: 'Departure day' }),
    ).toHaveCount(1)
    await expect(
      dialog.getByRole('combobox', { name: 'Arrival day' }),
    ).toHaveCount(1)

    await dialog.getByRole('button', { name: 'Car', exact: true }).click()

    await expect(
      dialog.getByRole('combobox', { name: 'Pick-up day' }),
    ).toHaveCount(1)
    await expect(
      dialog.getByRole('combobox', { name: 'Return day' }),
    ).toHaveCount(1)
    await expect(
      dialog.getByRole('combobox', { name: 'Departure day' }),
    ).toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The round trip, because the one hazard this stage carries is invisible from
   * the unit tests: an object schema strips a key it does not declare, so a day
   * the screen chooses and the write validator has never heard of would be a
   * column written null with every test green (PRD #167, decision 26). This drives
   * the real dialog against the real Worker and reads the answer back off a
   * reloaded page, so nothing here can be satisfied by optimistic state.
   *
   * It writes to the seeded workspace and removes what it wrote in the same test,
   * so the fixture the other specs photograph is the fixture they started with —
   * and it runs on one project rather than two, because what it proves is a
   * server contract and a second browser writing the same fixture buys nothing
   * but a second chance to leave a row behind.
   */
  test('the two days it was given survive the round trip', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'the claim is about what the Worker stored, not about how a browser renders it',
    )
    const title = `Overnight to Kyoto ${test.info().project.name}`
    const report = watchConsole(page, TRANSPORTS)
    await visit(page, TRANSPORTS, 'light')

    // A run that died between the write and the clean-up leaves its row behind,
    // and a second one would then measure the wrong card. Start from nothing.
    await removeCards(page, title, 'Remove transport')

    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('textbox', { name: 'Name' }).fill(title)

    // The first two days of the trip, in order: a journey that leaves on one and
    // lands on the next is the whole point of the second reference.
    await pickDay(page, 'Departure day', 1)
    await pickDay(page, 'Arrival day', 2)

    await dialog.getByRole('button', { name: 'Add transport' }).click()
    await expect(dialog).toBeHidden()

    // Read back from the Worker, not from the client's optimistic copy.
    await visit(page, TRANSPORTS, 'light')
    const card = page.locator('article').filter({ hasText: title })
    await expect(card).toHaveCount(1)
    await expect(card.locator('[data-part="day-chip"]')).toHaveText([
      'Day 1',
      'Day 2',
    ])

    // Put the fixture back the way it was found.
    await removeCards(page, title, 'Remove transport')

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * `12-verification-protocol.md` §6: zero layout shift *after the settle*, not
   * after navigation. The entry type is Chromium-only and `observe()` does not
   * throw in WebKit, so a WebKit score of `0` means "unsupported" and is reported
   * as a skip rather than presented as a pass.
   */
  test('nothing moves after the screen has settled', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'layout-shift is a Chromium-only entry type; observe() records nothing here, so a score of 0 would prove nothing',
    )
    await page.addInitScript(() => {
      const readings: Array<{ at: number; value: number }> = []
      Object.defineProperty(window, '__layoutShift', { value: readings })
      if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        return
      }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          }
          if (!shift.hadRecentInput) {
            readings.push({ at: shift.startTime, value: shift.value })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await visit(page, TRANSPORTS, 'light')
    // The skip above is by project; this is the same fact read off the engine,
    // so a Chromium that stopped supporting the entry type fails loudly instead
    // of scoring a silent zero.
    expect(
      await page.evaluate(() =>
        PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
      ),
    ).toBe(true)

    const mark = await page.evaluate(() => performance.now())

    // Exercise what this stage is about: open the declared state, and settle again.
    await page.locator(NEW_TRANSPORT).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await settle(page, TRANSPORTS)

    const after = await page.evaluate((since: number) => {
      const readings = (
        window as unknown as {
          __layoutShift: Array<{ at: number; value: number }>
        }
      ).__layoutShift
      return readings
        .filter((entry) => entry.at > since)
        .reduce((total, entry) => total + entry.value, 0)
    }, mark)

    test.info().annotations.push({
      type: 'layout shift after settle',
      description: String(after),
    })
    expect(after).toBe(0)
  })
})

test.describe('03-S4 — A booking that knows which stop it is for, and what it cost', () => {
  /**
   * This block's route table: the bookings desk of the seeded trip.
   *
   * `relativeTime: true` for the reason `03-S1`'s block measures above — every trip tab's document
   * carries the Worker's `today` because the *layout* loader puts it there, not this tab's own.
   */
  const BOOK: RouteCase = {
    name: 'trip-book',
    path: `/trips/${TRIP_ID}/book`,
    ready: 'main',
    relativeTime: true,
  }

  /**
   * The action that opens the dialog, and the picker inside it. Both are published as `data-part`
   * so the selectors a capture is driven by survive a restyle, and both are asserted to resolve
   * here before any frame is filed from them.
   */
  const NEW_BOOKING = '[data-part="new-booking"]'
  const STOP_PICKER = '[data-part="stop-picker"]'

  /**
   * The console verdict, with one pre-existing defect subtracted on WebKit and on nothing else.
   *
   * `bookings-timeline.tsx:89` builds its day heading with a module-local
   * `Intl.DateTimeFormat`, and workerd and WebKit resolve that from different ICU builds:
   * the Worker renders `Fri, 9 Oct` and WebKit hydrates `Fri 9 Oct`, which React reports as a
   * hydration mismatch. It is `12-verification-protocol.md` §7.2 exactly, it shipped long before
   * this stage, and the plan assigns the repair to `03-S6`, which owns that file — this stage owns
   * neither it nor `TOLERATED_CONSOLE_WARNINGS`, so it is subtracted here, named, rather than
   * tolerated globally or fixed from a stage that does not carry the file.
   *
   * Chromium keeps the strict reading, and both projects render the same components, so a
   * hydration mismatch introduced by *this* stage still fails.
   */
  /** React writes the sentence with either apostrophe, depending on the build. */
  const TEXT_MISMATCH =
    /Hydration failed because the server rendered text didn['’]t match/

  function consoleFatal(
    fatal: ReadonlyArray<string>,
    browserName: string,
  ): ReadonlyArray<string> {
    if (browserName === 'chromium') {
      return fatal
    }
    return fatal.filter((line) => !TEXT_MISMATCH.test(line))
  }

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('the bookings desk renders, and says nothing to the console', async ({
    browserName,
    page,
  }) => {
    const report = watchConsole(page, BOOK)
    await visit(page, BOOK, 'light')

    await expect(page.locator('h1, h2').first()).toBeVisible()
    await expect(page.locator(NEW_BOOKING)).toHaveCount(1)

    const fatal = consoleFatal(report().fatal, browserName)
    expect(fatal, fatal.join('\n')).toEqual([])
  })

  test('the declaration matches what the Worker sends', async ({ page }) => {
    await auditServerClock(page, [BOOK])
  })

  /**
   * The stop picker, and the one thing about it a unit test cannot see: that the options reach it
   * from the Worker at all. A stop travels inside the day it belongs to, so a payload that dropped
   * the nesting would leave a picker that opens onto nothing.
   *
   * A stay is the exception the rule is written around — it covers a run of nights and does not
   * belong to one stop — so the same dialog is asked for both answers.
   */
  test('offers every stop of the trip, gathered under its day', async ({
    browserName,
    page,
  }) => {
    const report = watchConsole(page, BOOK)
    await visit(page, BOOK, 'light')

    await page.locator(NEW_BOOKING).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The dialog opens on `accommodation`, the one type that is not offered a stop.
    await expect(dialog.locator(STOP_PICKER)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Table', exact: true }).click()
    await expect(dialog.locator(STOP_PICKER)).toHaveCount(1)

    await dialog.locator(STOP_PICKER).click()
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    // Groups are the days, and there is at least one stop under one of them: the seeded trip has
    // a plan, and a picker that renders no group is a payload that lost the nesting.
    await expect(listbox.getByRole('group').first()).toBeVisible()
    await expect(listbox.getByRole('option').first()).toBeVisible()

    const fatal = consoleFatal(report().fatal, browserName)
    expect(fatal, fatal.join('\n')).toEqual([])
  })

  /**
   * The notice under the price, read off the running screen.
   *
   * It states the effect *before* the save, so it has to appear on a keystroke and say the amount
   * in the booking's own currency. This is also the assertion that catches the whole chain being
   * wired up wrong: the notice is computed from the draft, the trip's days and the booking's own
   * link, and none of those reach it if the loader's payload changed shape.
   */
  test('says what the trip’s costs will do, before the booking is saved', async ({
    browserName,
    page,
  }) => {
    const report = watchConsole(page, BOOK)
    await visit(page, BOOK, 'light')

    await page.locator(NEW_BOOKING).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const notice = dialog.locator('[data-part="ledger-notice"]')
    await expect(notice).toHaveCount(0)

    await dialog.getByRole('textbox', { name: 'Price' }).fill('42')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('will be added to this trip’s costs')

    // Clearing it again takes the sentence with it: there is no line to talk about.
    await dialog.getByRole('textbox', { name: 'Price' }).fill('')
    await expect(notice).toHaveCount(0)

    const fatal = consoleFatal(report().fatal, browserName)
    expect(fatal, fatal.join('\n')).toEqual([])
  })

  /**
   * The round trip, for the hazard neither the unit tests nor the loader test can see: both write
   * validators are `z.object`s, so a stop the screen chooses and a validator has never heard of is
   * a column written null with every test still green (PRD #167, decision 26).
   *
   * It drives the real dialog against the real Worker and reads the answer back off a reloaded
   * page, then removes what it wrote, so the fixture the other specs photograph is the one they
   * started with. One project rather than two: the claim is about what the Worker stored.
   */
  test('the stop and the cost line survive the round trip', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'the claim is about what the Worker stored, not about how a browser renders it',
    )
    const title = `Dinner at Den ${test.info().project.name}`
    const report = watchConsole(page, BOOK)
    await visit(page, BOOK, 'light')

    await removeCards(page, title, 'Remove booking')

    await page.locator(NEW_BOOKING).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // `Other` asks for nothing beyond a name, so what this test drives is the stop and the price
    // rather than a type's own required fields.
    await dialog.getByRole('button', { name: 'Other', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Name' }).fill(title)
    await dialog.getByRole('textbox', { name: 'Price' }).fill('42')

    // The stop picker is a real combobox: focus stays in the search box and the arrow keys move
    // the highlight, which is also the keyboard path WCAG 2.2 requires to work.
    await dialog.locator(STOP_PICKER).click()
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toHaveCount(0)

    // Choosing a stop fills the empty date from the day it sits on, so the booking is now dated
    // and the notice has stopped asking for one.
    await expect(dialog.locator('[data-part="ledger-notice"]')).toContainText(
      'will be added to this trip’s costs',
    )

    await dialog.getByRole('button', { name: 'Add booking' }).click()
    await expect(dialog).toBeHidden()

    // Read back from the Worker, not from the client's optimistic copy.
    await visit(page, BOOK, 'light')
    const card = page.locator('article').filter({ hasText: title })
    await expect(card).toHaveCount(1)

    await removeCards(page, title, 'Remove booking')

    const fatal = consoleFatal(report().fatal, browserName)
    expect(fatal, fatal.join('\n')).toEqual([])
  })

  /**
   * `12-verification-protocol.md` §6: zero layout shift *after the settle*. The notice appears on a
   * keystroke, which is `hadRecentInput` and therefore excluded by the observer below — so this is
   * the assertion about the resting screen it is meant to be.
   */
  test('nothing moves after the screen has settled', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'layout-shift is a Chromium-only entry type; observe() records nothing here, so a score of 0 would prove nothing',
    )
    await page.addInitScript(() => {
      const readings: Array<{ at: number; value: number }> = []
      Object.defineProperty(window, '__layoutShift', { value: readings })
      if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        return
      }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          }
          if (!shift.hadRecentInput) {
            readings.push({ at: shift.startTime, value: shift.value })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await visit(page, BOOK, 'light')
    expect(
      await page.evaluate(() =>
        PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
      ),
    ).toBe(true)

    const mark = await page.evaluate(() => performance.now())

    await page.locator(NEW_BOOKING).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await settle(page, BOOK)

    const after = await page.evaluate((since: number) => {
      const readings = (
        window as unknown as {
          __layoutShift: Array<{ at: number; value: number }>
        }
      ).__layoutShift
      return readings
        .filter((entry) => entry.at > since)
        .reduce((total, entry) => total + entry.value, 0)
    }, mark)

    test.info().annotations.push({
      type: 'layout shift after settle',
      description: String(after),
    })
    expect(after).toBe(0)
  })
})

test.describe('03-S2b — A journey with more than two stations, and times that say which clock they are on', () => {
  /**
   * The same route table `03-S1` measured, restated rather than shared: two
   * stages of one plan must be able to change their own evidence without
   * touching each other's (`12-verification-protocol.md` §4).
   */
  const TRANSPORTS: RouteCase = {
    name: 'trip-transports',
    path: `/trips/${TRIP_ID}/transports`,
    ready: 'main',
    relativeTime: true,
  }

  /** The two selectors this stage publishes for the capture to be driven by. */
  const SPLIT = '[data-part="split-leg"]'
  const CHAIN = '[data-part="chain-editor"]'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * The declared state, and the proof that the selectors reaching it resolve.
   *
   * Reading the JSX is not a verification: both attributes exist for the frame
   * that will be filed from them, so both are asserted to resolve — and the
   * count of station name fields is what says a three-station journey is on
   * screen rather than merely that something rendered.
   */
  test('the chain editor opens on a three-station journey', async ({
    page,
  }) => {
    const report = watchConsole(page, TRANSPORTS)
    await visit(page, TRANSPORTS, 'light')

    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Unbroken, a journey is two endpoints and one quiet way into the chain.
    await expect(dialog.locator(CHAIN)).toHaveCount(0)
    await expect(dialog.locator(SPLIT)).toHaveCount(1)

    await dialog.locator(SPLIT).click()
    const chain = dialog.locator(CHAIN)
    await expect(chain).toHaveCount(1)
    await expect(chain.getByRole('textbox', { name: 'Stop' })).toHaveCount(2)

    // One leg, so one place to add a stop; the button says which stop it follows.
    await chain.getByRole('button', { name: /^Add a stop after / }).click()
    await expect(chain.getByRole('textbox', { name: 'Stop' })).toHaveCount(3)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The chain leaving the browser and coming back off a reloaded page.
   *
   * The unit tests prove N stations make N−1 legs in memory; only this proves
   * that what the dialog posts is what the Worker stores and what the next
   * reader sees. It runs on Chromium alone because the claim is about the
   * server, and a second browser writing the same fixture buys nothing but a
   * second chance to leave a row behind — which is also why it removes what it
   * wrote in the same test.
   */
  test('three stations survive the round trip as two legs', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'the claim is about what the Worker stored, not about how a browser renders it',
    )
    const title = `Osaka to Tokyo ${test.info().project.name}`
    const report = watchConsole(page, TRANSPORTS)
    await visit(page, TRANSPORTS, 'light')

    // A run that died between the write and the clean-up leaves its row behind.
    await removeCards(page, title, 'Remove transport')

    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Train', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Name' }).fill(title)

    await dialog.locator(SPLIT).click()
    const editor = dialog.locator(CHAIN)
    await editor.getByRole('button', { name: /^Add a stop after / }).click()

    const stops = editor.getByRole('textbox', { name: 'Stop' })
    await expect(stops).toHaveCount(3)
    await stops.nth(0).fill('Shin-Osaka')
    await stops.nth(1).fill('Nagoya')
    await stops.nth(2).fill('Tokyo')

    /*
     * Scoped to the editor, not to the dialog: the record's own "Service number"
     * field is still on screen below the chain, and an unscoped substring match
     * on "Service" would find all three and fill the wrong one.
     */
    const services = editor.getByRole('textbox', { name: 'Service' })
    await expect(services).toHaveCount(2)
    await services.nth(0).fill('Hikari 500')
    await services.nth(1).fill('Nozomi 24')

    await dialog.getByRole('button', { name: 'Add transport' }).click()
    await expect(dialog).toBeHidden()

    // Read back from the Worker, not from the client's optimistic copy.
    await visit(page, TRANSPORTS, 'light')
    const card = page.locator('article').filter({ hasText: title })
    await expect(card).toHaveCount(1)
    const chain = card.locator('[data-part="chain"]')
    await expect(chain).toHaveCount(1)
    await expect(chain.getByText('Nagoya')).toHaveCount(1)
    await expect(chain.getByText('Hikari 500')).toHaveCount(1)
    await expect(chain.getByText('Nozomi 24')).toHaveCount(1)

    // Put the fixture back the way it was found.
    await removeCards(page, title, 'Remove transport')

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * `12-verification-protocol.md` §6, over this stage's own declared state: the
   * chain editor is the surface on which somebody reaches for a height
   * transition by reflex, and a height transition is a layout-affecting property
   * `DESIGN.md` forbids. Adding two stops after the settle mark and scoring `0`
   * is what says the rows below take their new positions in one frame rather
   * than being interpolated into them.
   */
  test('inserting a stop moves nothing that had already settled', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'layout-shift is a Chromium-only entry type; observe() records nothing here, so a score of 0 would prove nothing',
    )
    await page.addInitScript(() => {
      const readings: Array<{ at: number; value: number }> = []
      Object.defineProperty(window, '__layoutShift', { value: readings })
      if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        return
      }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          }
          if (!shift.hadRecentInput) {
            readings.push({ at: shift.startTime, value: shift.value })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await visit(page, TRANSPORTS, 'light')
    expect(
      await page.evaluate(() =>
        PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
      ),
    ).toBe(true)

    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await settle(page, TRANSPORTS)

    const mark = await page.evaluate(() => performance.now())

    await dialog.locator(SPLIT).click()
    const editor = dialog.locator(CHAIN)
    await expect(editor).toHaveCount(1)
    await editor
      .getByRole('button', { name: /^Add a stop after / })
      .first()
      .click()
    await expect(editor.getByRole('textbox', { name: 'Stop' })).toHaveCount(3)
    await settle(page, TRANSPORTS)

    const after = await page.evaluate((since: number) => {
      const readings = (
        window as unknown as {
          __layoutShift: Array<{ at: number; value: number }>
        }
      ).__layoutShift
      return readings
        .filter((entry) => entry.at > since)
        .reduce((total, entry) => total + entry.value, 0)
    }, mark)

    test.info().annotations.push({
      type: 'layout shift after settle',
      description: String(after),
    })
    expect(after).toBe(0)
  })
})

test.describe('03-S3 — A connection the traveller did not have to look up', () => {
  /**
   * The same route table the two stages above measured, restated rather than
   * shared for the reason `12-verification-protocol.md` §4 gives: one stage must
   * be able to change its own evidence without touching another's.
   */
  const TRANSPORTS: RouteCase = {
    name: 'trip-transports',
    path: `/trips/${TRIP_ID}/transports`,
    ready: 'main',
    relativeTime: true,
  }

  /** The selectors this stage publishes, so a capture is driven by them and not by styling. */
  const MODE_FORM = '[data-part="transport-mode-form"]'
  const MODE_SEARCH = '[data-part="transport-mode-search"]'
  const SEARCH = '[data-part="connection-search"]'
  const RUN = '[data-part="connection-search-run"]'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * **Three of this stage's six declared states are not reachable from this
   * container, and saying so is the point of this comment.**
   *
   * A ranked list, one result expanded and the meter's refusal all need an
   * answer from the provider. There is no answer to be had here and no honest
   * way to fake one at this level: `page.route` intercepts the *browser's*
   * requests, and the call this surface makes is made by the Worker, three
   * layers behind the server function. Stubbing it would mean a switch in
   * production code that exists only for a test, which is exactly what the
   * dependency seam in `src/server/transit/search.ts` was built to avoid — the
   * ranked list, the cache hit, the ceiling refusal and the malformed answer are
   * each asserted there, against a stubbed client, in
   * `src/server/transit/__tests__/search.test.ts`.
   *
   * A second reason bites before that one: the airport and station catalogue
   * ships empty until its artefact is loaded into D1 (#200), so the two stop
   * pickers have nothing to offer and a search cannot be composed at all. What
   * this block asserts is therefore everything the browser really can see — that
   * the second mode exists, that it is the one the traveller has to ask for,
   * that it refuses to run on an incomplete question, and that reaching it moves
   * nothing that had already settled.
   */
  test('the second mode is offered, and is not the one the dialog opens on', async ({
    page,
  }) => {
    const report = watchConsole(page, TRANSPORTS)
    await visit(page, TRANSPORTS, 'light')

    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The trip has dates, so the switch is there; the form is what it opens on.
    await expect(dialog.locator(MODE_FORM)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(dialog.locator(MODE_SEARCH)).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(dialog.locator(SEARCH)).toHaveCount(0)

    await dialog.locator(MODE_SEARCH).click()
    await expect(dialog.locator(SEARCH)).toHaveCount(1)
    /*
     * The footer's save goes with the form: what is saved here is one chosen row, so the button
     * belongs on the row that names it. The remaining ghost reads `Close` rather than `Cancel`,
     * which is asserted through `Cancel` disappearing — the dialog's own dismiss control is also
     * named `Close`, so counting that word would count the wrong button as well as the right one.
     */
    await expect(
      dialog.getByRole('button', { name: 'Add transport' }),
    ).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0)

    // And back again, with the form exactly as it was.
    await dialog.locator(MODE_FORM).click()
    await expect(dialog.locator(SEARCH)).toHaveCount(0)
    await expect(
      dialog.getByRole('button', { name: 'Add transport' }),
    ).toHaveCount(1)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(1)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The one refusal that needs no provider: a question with a stop missing.
   *
   * Asserted through the control's own disabled state rather than by clicking
   * and watching nothing happen, because "nothing happened" is also what a
   * broken handler looks like.
   */
  test('will not spend a search on an incomplete question', async ({
    page,
  }) => {
    const report = watchConsole(page, TRANSPORTS)
    await visit(page, TRANSPORTS, 'light')

    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator(MODE_SEARCH).click()

    const run = dialog.locator(RUN)
    await expect(run).toBeDisabled()

    // The mode filter is part of the question and answers on its own.
    const train = dialog.getByRole('button', { name: 'Train', exact: true })
    await expect(train).toHaveAttribute('aria-pressed', 'false')
    await train.click()
    await expect(train).toHaveAttribute('aria-pressed', 'true')

    // Still refused: a filter is not a stop.
    await expect(run).toBeDisabled()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The layout-shift rule, over the switch that swaps one panel for another.
   *
   * The two modes are different heights, so what is asserted is the same thing
   * `03-S2b` asserts about an inserted row: after the dialog has settled, no
   * unshifted layout is scored — the panel is replaced, not interpolated into.
   */
  test('reaching the second mode moves nothing that had already settled', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'layout-shift is a Chromium-only entry type; observe() records nothing here, so a score of 0 would prove nothing',
    )
    await page.addInitScript(() => {
      const readings: Array<{ at: number; value: number }> = []
      Object.defineProperty(window, '__layoutShift', { value: readings })
      if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        return
      }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          }
          if (!shift.hadRecentInput) {
            readings.push({ at: shift.startTime, value: shift.value })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await visit(page, TRANSPORTS, 'light')
    await page.locator(NEW_TRANSPORT).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await settle(page, TRANSPORTS)

    const mark = await page.evaluate(() => performance.now())

    await dialog.locator(MODE_SEARCH).click()
    await expect(dialog.locator(SEARCH)).toHaveCount(1)
    await settle(page, TRANSPORTS)

    const after = await page.evaluate((since: number) => {
      const readings = (
        window as unknown as {
          __layoutShift: Array<{ at: number; value: number }>
        }
      ).__layoutShift
      return readings
        .filter((entry) => entry.at > since)
        .reduce((total, entry) => total + entry.value, 0)
    }, mark)

    test.info().annotations.push({
      type: 'layout shift after settle',
      description: String(after),
    })
    expect(after).toBe(0)
  })
})

test.describe('03-S6 — The desk: what is settled, what is not, and what is nobody else’s business', () => {
  /**
   * This block's three route tables. The two trip tabs carry `relativeTime`
   * for the reason `03-S1`'s block measured — the trip *layout* loader puts the
   * Worker's `today` in the document, not the tab's own — and the settings
   * screen carries none, because it renders no fixture date at all.
   */
  const BOOK: RouteCase = {
    name: 'trip-book',
    path: `/trips/${TRIP_ID}/book`,
    ready: 'main',
    relativeTime: true,
  }
  const TRANSPORTS_TAB: RouteCase = {
    name: 'trip-transports',
    path: `/trips/${TRIP_ID}/transports`,
    ready: 'main',
    relativeTime: true,
  }
  const APPEARANCE: RouteCase = {
    name: 'settings-appearance',
    path: '/settings/appearance',
    ready: 'main',
  }

  /**
   * Every selector this stage publishes, and every one of them is asserted to
   * resolve before it is used — a capture driven by a `data-part` that silently
   * matches nothing photographs the resting screen and calls it a state.
   */
  const OUTSTANDING = '[data-part="group-toggle-outstanding"]'
  const SETTLED = '[data-part="group-toggle-settled"]'
  const STAY_CHIP = '[data-part="type-chip-accommodation"]'
  const CODE = '[data-part="confirmation-code"]'
  const MASK_SWITCH = '[data-part="mask-confirmation-codes"]'

  /**
   * The session record the type filter keeps, written before the page exists.
   *
   * This is how the third empty state — "a filter that matches nothing" — is
   * reached at all: the chips only ever offer kinds the trip actually has, so no
   * sequence of clicks can produce an empty result. A stored lens can, which is
   * exactly the case the state exists for, and writing it here proves the
   * preference is read as well as written.
   */
  async function filterToMissingType(page: Page): Promise<void> {
    await page.addInitScript(
      ({ tripId }: { tripId: string }) => {
        window.sessionStorage.setItem(
          'planned.book-types',
          JSON.stringify({ v: 1, entries: [[tripId, ['transport']]] }),
        )
      },
      { tripId: TRIP_ID },
    )
  }

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * The console verdict is **strict on every project**, and that is this block's
   * own evidence rather than a formality.
   *
   * `03-S4` had to subtract a hydration mismatch on WebKit: `bookings-timeline`
   * built its day heading with a module-local `Intl.DateTimeFormat`, workerd
   * rendered `Fri, 9 Oct` and WebKit hydrated `Fri 9 Oct`, and React reported
   * the difference — `12-verification-protocol.md` §7.2 exactly. This stage owns
   * that file and replaced both formatters with `formatWeekday` and `formatDate`,
   * which answer from a frozen CLDR table. Nothing is subtracted here, and if the
   * repair regresses this test is what says so.
   */
  test('the desk reads as two panels, and says nothing to the console', async ({
    page,
  }) => {
    const report = watchConsole(page, BOOK)
    await visit(page, BOOK, 'light')

    await expect(page.locator(OUTSTANDING)).toHaveCount(1)
    await expect(page.locator(SETTLED)).toHaveCount(1)

    // Both open on a reader who has folded nothing, which is what makes a
    // collapsed frame judgeable against the expanded one it came from.
    await expect(page.locator(OUTSTANDING)).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(page.locator(SETTLED)).toHaveAttribute('aria-expanded', 'true')

    // The seeded trip has both halves, so neither panel is proving itself empty.
    await expect(page.locator('article')).not.toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the declaration matches what the Worker sends', async ({ page }) => {
    await auditServerClock(page, [BOOK])
  })

  /**
   * The fold, and the half of it a unit test cannot see: that it survives the
   * reader leaving. Nobody should fold the same list twice.
   */
  test('a folded panel is still folded when the reader comes back', async ({
    page,
  }) => {
    const report = watchConsole(page, BOOK)
    await visit(page, BOOK, 'light')

    const settled = page.locator(SETTLED)
    await settled.click()
    await expect(settled).toHaveAttribute('aria-expanded', 'false')

    await visit(page, BOOK, 'light')
    await expect(page.locator(SETTLED)).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    // The other panel is untouched: the memory is per panel, not per desk.
    await expect(page.locator(OUTSTANDING)).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    // Put the browser back the way it was found, for the next spec in this file.
    await page.locator(SETTLED).click()
    await expect(page.locator(SETTLED)).toHaveAttribute('aria-expanded', 'true')

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /** The lens: multi-select chips that narrow the desk and let go of it again. */
  test('a type chip narrows the desk and clears again', async ({ page }) => {
    const report = watchConsole(page, BOOK)
    await visit(page, BOOK, 'light')

    const before = await page.locator('article').count()
    expect(before).toBeGreaterThan(1)

    const chip = page.locator(STAY_CHIP)
    await expect(chip).toHaveCount(1)
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')

    const filtered = await page.locator('article').count()
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(before)

    // Pressing it again is "no lens" rather than "nothing matches".
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('article')).toHaveCount(before)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /** The third empty state, and the one a product usually forgets. */
  test('a filter that matches nothing says so, and offers the way out', async ({
    page,
  }) => {
    const report = watchConsole(page, BOOK)
    await filterToMissingType(page)
    await visit(page, BOOK, 'light')

    await expect(page.locator('article')).toHaveCount(0)
    await expect(page.getByText('No travel on this trip yet')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filter' }).click()
    await expect(page.locator('article')).not.toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The whole chain, end to end: the switch on the appearance screen, the
   * writer behind it, the merge in the repository, and **both** reading
   * surfaces.
   *
   * The preference is set the way a reader would set it rather than by writing
   * the row from the spec, because a frame of the desk says nothing about
   * whether the transport card obeys the same switch — and a preference that
   * half the product ignores is the defect a critic files first.
   *
   * One project, and it restores what it changed: the setting belongs to the
   * shared demo account, so leaving it on would hand the next spec a screen its
   * fixture never asked for.
   */
  test('the switch masks a code on both surfaces, and reveals it per card', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'the claim is about what the Worker stored and served, not about how a browser renders it',
    )
    const report = watchConsole(page, BOOK)

    try {
      await visit(page, APPEARANCE, 'light')
      const control = page.locator(MASK_SWITCH)
      await expect(control).toHaveCount(1)
      await expect(control).toHaveAttribute('aria-checked', 'false')
      await control.click()
      await expect(control).toHaveAttribute('aria-checked', 'true')

      // The desk, read back from the Worker with the preference on.
      await visit(page, BOOK, 'light')
      const stay = page
        .locator('article')
        .filter({ hasText: 'Hotel Gracery Shinjuku' })
      await expect(stay.locator(CODE)).toHaveCount(1)

      /*
       * The value is not merely invisible — it is not in the document. A code
       * hidden behind `opacity: 0` is still readable by a find-in-page, a
       * screenshot pipeline and the accessibility tree, which is not hidden.
       */
      expect(await page.content()).not.toContain('HG-8842190')

      const maskedBefore = await page.locator(CODE).count()
      expect(maskedBefore).toBeGreaterThan(1)

      // Hover, because that is one of the three ways the reveal is reachable and
      // the one a mouse takes first.
      await stay.locator(CODE).hover()
      await expect(stay.getByText('HG-8842190')).toBeVisible()
      // Revealing one card reveals exactly one card, and never the preference.
      await expect(page.locator(CODE)).toHaveCount(maskedBefore - 1)

      // And the second obeying surface, which takes the same boolean as a prop.
      await visit(page, TRANSPORTS_TAB, 'light')
      const flight = page
        .locator('article')
        .filter({ hasText: 'London Heathrow → Tokyo Haneda' })
      await expect(flight.locator(CODE)).toHaveCount(1)
      expect(await page.content()).not.toContain('K4TZ9M')

      await flight.locator(CODE).hover()
      await expect(flight.getByText('K4TZ9M')).toBeVisible()
    } finally {
      await visit(page, APPEARANCE, 'light')
      const control = page.locator(MASK_SWITCH)
      if ((await control.getAttribute('aria-checked')) === 'true') {
        await control.click()
        await expect(control).toHaveAttribute('aria-checked', 'false')
      }
    }

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * `12-verification-protocol.md` §6: zero layout shift *after the settle*.
   *
   * The disclosure and the reveal are both `hadRecentInput` and therefore
   * excluded by the observer, so this is the assertion about the resting screen
   * it is meant to be — and the resting screen is the one that matters here,
   * because the fold is read from storage in the commit after hydration and a
   * reader who has folded nothing sees the state the server rendered.
   */
  test('nothing moves after the desk has settled', async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'layout-shift is a Chromium-only entry type; observe() records nothing here, so a score of 0 would prove nothing',
    )
    await page.addInitScript(() => {
      const readings: Array<{ at: number; value: number }> = []
      Object.defineProperty(window, '__layoutShift', { value: readings })
      if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        return
      }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          }
          if (!shift.hadRecentInput) {
            readings.push({ at: shift.startTime, value: shift.value })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await visit(page, BOOK, 'light')
    expect(
      await page.evaluate(() =>
        PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
      ),
    ).toBe(true)

    const mark = await page.evaluate(() => performance.now())
    await settle(page, BOOK)

    const after = await page.evaluate((since: number) => {
      const readings = (
        window as unknown as {
          __layoutShift: Array<{ at: number; value: number }>
        }
      ).__layoutShift
      return readings
        .filter((entry) => entry.at > since)
        .reduce((total, entry) => total + entry.value, 0)
    }, mark)

    test.info().annotations.push({
      type: 'layout shift after settle',
      description: String(after),
    })
    expect(after).toBe(0)
  })
})
