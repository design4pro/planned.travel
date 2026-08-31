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
 */
async function removeTransports(page: Page, title: string): Promise<void> {
  const cards = page.locator('article').filter({ hasText: title })
  for (let left = await cards.count(); left > 0; left -= 1) {
    await cards
      .first()
      .getByRole('button', { name: `Actions for ${title}` })
      .click()
    await page.getByRole('menuitem', { name: 'Remove transport' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Remove transport' })
      .click()
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
    await removeTransports(page, title)

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
    await removeTransports(page, title)

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
    await removeTransports(page, title)

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
    await removeTransports(page, title)

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
