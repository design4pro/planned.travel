import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'

/**
 * The trips-core plan's own end-to-end gate (`docs/plans/01-trips-core.md`).
 *
 * One `test.describe` block per stage, named for the stage, each declaring its
 * own route table and touching no other block — so two stages of the same wave
 * can append here without either editing the other's evidence.
 */

/**
 * The sub-navigation, addressed by role, accessible name and a published ARIA
 * state rather than by a class name. Both are asserted to resolve before
 * anything is concluded from them.
 */
const TRIP_SECTIONS = 'nav[aria-label="Trip sections"]'
const ACTIVE_TAB = `${TRIP_SECTIONS} a[aria-current="page"]`

test.describe('01-S3 — A trip reopens on the tab you left it on', () => {
  /**
   * This block's route table. `/journey` earns its place rather than being a
   * detour: its "Waiting for a story" list is the product's one link to a
   * trip's *own* address, `/trips/<id>`, and that address is where the
   * remembered tab is read. Every other surface links straight into a tab.
   */
  const JOURNAL: RouteCase = {
    name: 'journal',
    path: '/journey',
    ready: 'main',
  }

  const costsUrl = (tripId: string): RegExp =>
    new RegExp(`/trips/${tripId}/costs(\\?|$)`)

  const tripSection = (tripId: string, tab: string): RouteCase => ({
    name: `trip-${tab}`,
    path: `/trips/${tripId}/${tab}`,
    ready: TRIP_SECTIONS,
  })

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** The id behind the journal's first link to a trip rather than to a tab. */
  async function linkedTripId(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      for (const anchor of document.querySelectorAll('a[href^="/trips/"]')) {
        const match = /^\/trips\/([^/?#]+)$/.exec(
          anchor.getAttribute('href') ?? '',
        )
        if (match !== null) return match[1]
      }
      return null
    })
  }

  /**
   * Open the journal and take the trip this block walks, or skip — a workspace
   * whose journal links to no trip address leaves this block nothing to measure.
   */
  async function journalTripToWalk(page: Page): Promise<string> {
    await visit(page, JOURNAL, 'light')
    const tripId = await linkedTripId(page)
    test.skip(
      tripId === null,
      'the journal lists no trip of its own, so there is no link to a trip address to walk',
    )
    // `test.skip()` above ends the test when the id is missing; this only keeps
    // the type honest for the callers.
    if (tripId === null) throw new Error('unreachable: the test was skipped')
    return tripId
  }

  /** Open a tab of a trip the long way round, and prove the strip is on it. */
  async function openTab(
    page: Page,
    tripId: string,
    tab: string,
  ): Promise<void> {
    const route = tripSection(tripId, tab)
    await visit(page, route, 'light')
    await expect(page.locator(ACTIVE_TAB)).toHaveCount(1)
    await expect(page.locator(ACTIVE_TAB)).toHaveAttribute('href', route.path)
  }

  test('a trip reopens on the tab it was left on', async ({ page }) => {
    const tripId = await journalTripToWalk(page)
    await openTab(page, tripId, 'costs')

    /**
     * Watched from here rather than from the first navigation, because from
     * here on is this stage's own surface: the journal, the walk into the trip
     * address and the redirect that reads the browser's storage. A hydration
     * mismatch is the specific failure that redirect risks, and React 19
     * reports one as both an uncaught error and a `console.error`.
     *
     * The cold load of the costs tab above is deliberately outside the window.
     * It carries a hydration mismatch of its own, on `mobile-safari` only and
     * at HEAD before this stage — the expense day headings render "Wed, 19 Aug"
     * from the Worker and "Wed 19 Aug" from WebKit's `Intl`. That belongs to
     * whoever owns the date format, not to this block, and swallowing it here
     * as a tolerated warning would hide it from them.
     */
    const report = watchConsole(page, JOURNAL)

    // Leave the trip entirely, then walk back into it the way a reader does.
    await visit(page, JOURNAL, 'light')
    await page.click(`a[href="/trips/${tripId}"]`)

    // The costs route carries its own `view` search parameter, so the tab is the
    // end of the path rather than the end of the address.
    await expect(page).toHaveURL(costsUrl(tripId))
    await expect(page.locator(ACTIVE_TAB)).toHaveAttribute(
      'href',
      `/trips/${tripId}/costs`,
    )

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The other half of the same contract, and the reason the redirect is guarded
   * on `typeof window`: `beforeLoad` runs on the Worker for a cold load, where
   * neither storage object exists. A cold load therefore lands on the plan
   * however loudly this browser remembers the costs tab — the honest behaviour,
   * asserted rather than assumed, because the alternative is a hydration
   * mismatch dressed as a feature.
   *
   * Asked of the Worker as a request rather than as a navigation. That is the
   * whole claim — what the *server* answers for an address it has no memory of
   * — and it is measured without opening the planner, whose live map is the
   * most expensive document in the app and has nothing to do with this.
   */
  test('the Worker answers a trip address with the plan', async ({ page }) => {
    const tripId = await journalTripToWalk(page)
    await openTab(page, tripId, 'costs')

    // Without this the assertion below is vacuous: it would also hold for a
    // browser that had remembered nothing at all.
    const remembered = await page.evaluate(() =>
      window.localStorage.getItem('planned.trip-tab'),
    )
    expect(
      remembered,
      'the browser has to have remembered the costs tab for the next line to mean anything',
    ).toContain('costs')

    const response = await page.request.get(`/trips/${tripId}`, {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(307)
    expect(response.headers()['location']).toBe(`/trips/${tripId}/plan`)
  })

  /**
   * The lifetime assertion, and the one a `sessionStorage`-backed module would
   * fail: `sessionStorage` is per tab by construction, so a second page in the
   * same context is the cheapest measurement that tells the two areas apart
   * from outside the code.
   */
  test('the memory outlives the tab that made it', async ({
    context,
    page,
  }) => {
    const tripId = await journalTripToWalk(page)
    await openTab(page, tripId, 'costs')

    const second = await context.newPage()
    try {
      const report = watchConsole(second, JOURNAL)
      await visit(second, JOURNAL, 'light')
      await second.click(`a[href="/trips/${tripId}"]`)

      await expect(second).toHaveURL(costsUrl(tripId))
      const verdict = report()
      expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
    } finally {
      await second.close()
    }
  })
})

test.describe('01-S1 — Who may see a trip and who may change it', () => {
  /**
   * This block's route table. One route, because one is what the claim needs: the trip index is
   * where every tile the demo owner owns is rendered, and the action menu is a property of the tile
   * rather than of the screen around it.
   */
  const TRIPS: RouteCase = {
    name: 'trips',
    path: '/trips',
    ready: 'main',
  }

  /** The same screen with the favourites scope picked, which is a different read. */
  const FAVOURITES: RouteCase = {
    name: 'trips-favourites',
    path: '/trips?scope=favourites',
    ready: 'main',
  }

  const TRIGGER = '[data-part="trip-actions-trigger"]'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * The name of the first tile on the index, read from its heading — the string the trigger's
   * accessible name has to contain, so the assertion below is measured against the page rather than
   * against a fixture this spec restates.
   */
  async function firstTripTitle(page: Page): Promise<string> {
    // By role rather than by tag: the index renders its tiles at `h2` and the dashboard grid at
    // `h3`, and which level a card takes is the surrounding outline's business, not this claim's.
    const heading = page
      .locator('[data-part="trip-tile"]')
      .first()
      .getByRole('heading')
    await expect(heading).toHaveCount(1)
    return (await heading.innerText()).trim()
  }

  test('the trigger on an owned tile names its own trip', async ({ page }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    const title = await firstTripTitle(page)
    const trigger = page.locator(TRIGGER).first()

    // The demo owner owns every trip in the fixture, so a tile with no trigger at all would mean the
    // role never reached the payload — the failure mode a menu that renders unconditionally hides.
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAccessibleName(`Actions for ${title}`)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the menu offers the owner Edit and Archive, and the sheet opens on the trip', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    const title = await firstTripTitle(page)
    await page.locator(TRIGGER).first().click()

    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(
      menu.getByRole('menuitem', { name: /^(Archive|Restore)$/ }),
    ).toBeVisible()
    await expect(
      menu.getByRole('menuitem', { name: /^(Favourite|Unfavourite)$/ }),
    ).toBeVisible()
    await expect(
      menu.getByRole('menuitem', { name: /^Delete( permanently)?$/ }),
    ).toBeVisible()
    // Five since `01-S1d` added Copy. The count is asserted rather than left implicit because a menu
    // that grew a sixth item nobody named here is a menu whose contents drifted from this claim.
    await expect(menu.getByRole('menuitem')).toHaveCount(5)

    await menu.getByRole('menuitem', { name: 'Edit' }).click()

    const sheet = page.locator('[data-part="trip-edit-sheet"]')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByLabel('Trip name')).toHaveValue(title)

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The trigger is a real tab stop, not a hover-only affordance. Above `md` it rests at zero opacity
   * and is revealed by `group-focus-within` as well as by hover, which is exactly the property a
   * CSS-only reveal loses the day somebody swaps the selector for `group-hover` alone — and losing
   * it makes every trip's actions unreachable without a pointer.
   */
  test('the trigger is reachable by keyboard', async ({ page }) => {
    await visit(page, TRIPS, 'light')

    const trigger = page.locator(TRIGGER).first()
    await trigger.focus()
    await expect(trigger).toBeFocused()
    await expect(trigger).toBeVisible()
  })

  /**
   * The favourites scope, which after `01-S1b` is a read of `trip_favourites` for the acting user.
   *
   * Deliberately read-only, like every other case in this block. Two of the demo trips carry
   * `trips.is_favourite = true` — the shared column decision 5 retires — so a scope that still read
   * it would answer with those two tiles here. An empty list over a `0` pill is the only answer the
   * per-person table can give a workspace where nobody has starred anything yet, and it is measured
   * without writing a row, so this spec cannot leave a star behind for the frames another worker is
   * capturing at the same moment.
   */
  test('the favourites scope answers from the reader’s own bookmarks, not the trip’s flag', async ({
    page,
  }) => {
    const report = watchConsole(page, FAVOURITES)
    await visit(page, FAVOURITES, 'light')

    await expect(page.getByRole('link', { name: 'Favourites 0' })).toBeVisible()
    await expect(page.locator('[data-part="trip-tile"]')).toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The graduated confirmation (PRD #104 decision 10), measured without deleting anything.
   *
   * The claim is not "this fixture's first trip is heavy" — that is the seed's business and it can
   * change. It is that the **dialog and the server agree**: the confirmation field is rendered when
   * and only when `requiresTitle` came back true, and the button is armed when and only when the
   * ceremony that answer asked for has been met. Both branches are asserted, so the case is honest
   * whichever kind of trip the fixture leads with.
   *
   * Nothing is submitted. The delete is terminal and the fixture is shared with every other worker.
   */
  test('the delete dialog asks as hard as the server says it must', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    const title = await firstTripTitle(page)
    await page.locator(TRIGGER).first().click()
    await page
      .getByRole('menu')
      .getByRole('menuitem', { name: /^Delete( permanently)?$/ })
      .click()

    const dialog = page.locator('[data-part="trip-delete-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(title)

    const confirm = dialog.getByRole('button', { name: 'Delete permanently' })
    const field = dialog.getByLabel(/Type the trip’s name/)

    // The summary is fetched when the dialog opens, so the button's resting state is "not yet".
    await expect(confirm).toBeDisabled()

    // The inventory is drawn only once that answer lands, and it always names at least the one
    // member every trip has — so waiting for its first line is what makes the branch below a reading
    // of the answer rather than a race with the skeleton it replaces.
    await expect(dialog.getByRole('listitem').first()).toBeVisible()

    if ((await field.count()) === 1) {
      // The heavy branch: nothing arms it but the trip's own name, character for character.
      await field.fill(`${title} `)
      await expect(confirm).toBeDisabled()
      await field.fill(title)
      await expect(confirm).toBeEnabled()
    } else {
      // The light branch: the server said the trip carries nothing, so it arms on its own.
      await expect(confirm).toBeEnabled()
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The star is the one item a reader who owns nothing still gets (PRD #104 decision 6), so it is
   * the item whose label has to be right: it names the state a press would move the trip *to*.
   * Nothing is starred in the fixture, so every tile offers "Favourite".
   */
  test('every tile offers the star, labelled by what a press would do', async ({
    page,
  }) => {
    await visit(page, TRIPS, 'light')

    await page.locator(TRIGGER).first().click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(
      menu.getByRole('menuitem', { name: 'Favourite', exact: true }),
    ).toBeVisible()
    await expect(
      menu.getByRole('menuitem', { name: 'Unfavourite', exact: true }),
    ).toHaveCount(0)
  })
})

test.describe('01-S1d — Copying a trip is asked for before it is started', () => {
  /**
   * This block's route table and its own selectors.
   *
   * Deliberately duplicated from `01-S1` rather than hoisted out of it: this file's contract is that
   * a block declares what it reads and touches no other block's evidence, so that two stages of the
   * same wave can append here without either editing the other's assertions.
   */
  const TRIPS: RouteCase = {
    name: 'trips',
    path: '/trips',
    ready: 'main',
  }

  const TRIGGER = '[data-part="trip-actions-trigger"]'
  const DIALOG = '[data-part="trip-copy-dialog"]'

  /**
   * What an undated trip prints where a dated one prints its run — `shell.trips.card.noDates`.
   *
   * This block walks a *dated* trip rather than whichever tile the index leads with, because the
   * fixture holds one deliberate draft with no dates at all ("Patagonia traverse", a title and an
   * intention). A copy of that one has no run to be shortened, so it would answer the two claims
   * below by never reaching them — the silent kind of pass.
   */
  const NO_DATES = 'Dates to be set'

  /**
   * The boundary the dialog states before the reader commits, and the note a shortened range earns.
   *
   * Quoted from `src/lib/i18n/messages/en/shell.ts` rather than read back through the catalogue,
   * because the claim under test is that a reader sees *these sentences* — a spec that asked the
   * catalogue what the catalogue says would pass against a key that resolved to anything at all.
   */
  const CARRIES =
    'Days, places and notes come across. Bookings, money, files and people do not.'
  const SHORTER =
    'That is shorter than the original. The extra days’ places move to ideas, and their notes are dropped.'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * The first tile on the index whose trip actually runs over dates, and the name it carries.
   *
   * The name is read from the tile's own heading rather than restated from the fixture, so the
   * assertion that the dialog names the right trip is measured against the page.
   */
  async function datedTrip(page: Page): Promise<{
    tile: ReturnType<Page['locator']>
    title: string
  }> {
    const tile = page
      .locator('[data-part="trip-tile"]')
      .filter({ hasNotText: NO_DATES })
      .first()
    test.skip(
      (await tile.count()) === 0,
      'every trip in this workspace is undated, so there is no run for a copy to shorten',
    )
    // By role rather than by tag: which heading level a card takes is the surrounding outline's
    // business, not this claim's.
    const heading = tile.getByRole('heading')
    await expect(heading).toHaveCount(1)
    return { tile, title: (await heading.innerText()).trim() }
  }

  /**
   * Open a tile's actions menu from the keyboard, and prove it opened.
   *
   * Deliberately not a click. The trigger sits on a card that lifts on hover, so a pointer press
   * arrives while the element under it is still moving and the menu it opens is positioned over the
   * trigger it came from — which makes "did that press open the menu, or open it and then land on
   * its first item?" a question of timing rather than of behaviour. It cost one failure in a loaded
   * full-suite run, where the ordering assertion below timed out against a page that had already
   * advanced to the copy dialog. Focus and Enter carry no coordinates, so neither does the answer.
   */
  async function openMenu(page: Page, tile: ReturnType<Page['locator']>) {
    await tile.locator(TRIGGER).focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
  }

  /**
   * Open that tile's menu and take the Copy item to the dialog it opens.
   *
   * **Nothing here submits.** The copy is an additive write against the workspace every other block
   * and both browser projects share, and it is not undone by reloading: one run per project would
   * leave two trips behind, and a later run would read one of them as its first tile — a copying
   * tile, whose Edit item `01-S1` clicks and whose menu is frozen. The dialog is what this stage
   * added to the browser, and the dialog is what is measured; that the write behind it does the
   * right thing is `src/server/repos/__tests__/trip-lifecycle.test.ts`'s claim, not this file's.
   */
  async function openCopyDialog(page: Page): Promise<string> {
    const { tile, title } = await datedTrip(page)
    const menu = await openMenu(page, tile)
    await menu.getByRole('menuitem', { name: 'Copy' }).click()
    await expect(page.locator(DIALOG)).toBeVisible()
    return title
  }

  /**
   * Shorten the run to two days by taking the first two cells of the calendar.
   *
   * The grid renders whole weeks in chronological order and the dialog sets no `minDate`, so the
   * first two buttons are two consecutive days whatever month the picker opened on — which is what
   * makes this independent of which dated trip the index happens to lead with. Every dated trip in
   * the demo fixture runs seven days or more (`src/routes/api/dev/-seed/dataset/trips.ts`), so two
   * days is reliably shorter; a fixture that ever led with a one-day trip would fail this loudly
   * rather than quietly stop exercising the branch.
   */
  async function shortenToTwoDays(page: Page): Promise<void> {
    await page
      .locator(DIALOG)
      .getByRole('button', { name: 'Dates', exact: true })
      .click()
    const days = page.locator('table[role="grid"] button')
    await days.nth(0).click()
    await days.nth(1).click()
  }

  test('Copy leads the menu and opens a dialog rather than starting a write', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    const { tile, title } = await datedTrip(page)
    const menu = await openMenu(page, tile)

    // Copy is the first of the two items every reader gets (PRD #104 decision 6), so its position is
    // part of the claim: the star is what a viewer's menu ends with, not what it opens with.
    await expect(menu.getByRole('menuitem').first()).toHaveAccessibleName(
      'Copy',
    )

    await menu.getByRole('menuitem', { name: 'Copy' }).click()

    const dialog = page.locator(DIALOG)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading')).toContainText(title)
    // The copy opens under the source's own name, which is the answer a reader is most likely to
    // keep, and the source's own run — so the dates field is a correction rather than a blank.
    await expect(dialog.getByLabel('Name the copy')).toHaveValue(title)

    // Spec Q4: the boundary is standing text, told before the reader commits rather than enumerated
    // afterwards in the completion notification.
    await expect(dialog.getByText(CARRIES)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the short-range note is earned by shortening the range, and withdrawn with it', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')
    await openCopyDialog(page)

    const dialog = page.locator(DIALOG)
    // At rest the copy runs exactly as long as its source, so there is no consequence to state.
    await expect(dialog.getByText(SHORTER)).toHaveCount(0)

    await shortenToTwoDays(page)
    await expect(dialog.getByText(SHORTER)).toBeVisible()

    // An undated copy is a template: it has no run, so there is nothing for a run to be shorter than.
    await dialog.getByRole('button', { name: 'Copy without dates' }).click()
    await expect(dialog.getByText(SHORTER)).toHaveCount(0)
    await expect(
      dialog.getByRole('button', { name: 'Copy without dates' }),
    ).toHaveCount(0)

    /**
     * Dismissed with Cancel rather than with Escape, unlike the case above.
     *
     * The picker's popover is a dismissable layer of its own, and it unmounts on an exit animation
     * — so an Escape sent right after a range was picked lands on a layer that is closing rather
     * than on the dialog underneath it, and whether it reaches the dialog is a race. Cancel is the
     * control a reader actually reaches for, and it is not a race.
     */
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The two ways the form refuses, both of which disarm the same button.
   *
   * A copy with no name and a range with one end are the only inputs `copyTripInputSchema` rejects,
   * and a dialog that let either of them reach the server would turn a correctable mistake into a
   * round trip that fails.
   */
  test('the submit is disarmed by an empty name and by a half-picked range', async ({
    page,
  }) => {
    await visit(page, TRIPS, 'light')
    await openCopyDialog(page)

    const dialog = page.locator(DIALOG)
    const submit = dialog.getByRole('button', { name: 'Copy trip' })
    await expect(submit).toBeEnabled()

    await dialog.getByLabel('Name the copy').fill('')
    await expect(dialog.getByText('Give the copy a name.')).toBeVisible()
    await expect(submit).toBeDisabled()

    await dialog.getByLabel('Name the copy').fill('Lisbon, again')
    await expect(submit).toBeEnabled()

    // One end picked is the state the picker passes through mid-selection; the form says which of
    // the two ways out to take rather than silently accepting half a range.
    await dialog.getByRole('button', { name: 'Dates', exact: true }).click()
    await page.locator('table[role="grid"] button').first().click()
    await expect(
      dialog.getByText('Set both dates, or clear them both.'),
    ).toBeVisible()
    await expect(submit).toBeDisabled()
  })
})

test.describe('01-S2 — A day note you can write', () => {
  /** This block's route table. The trips list is the one screen that links a trip by id. */
  const TRIPS: RouteCase = { name: 'trips', path: '/trips', ready: 'main' }

  /** The planner mounts a live MapLibre canvas, so the walk has to declare one. */
  const planRoute = (tripId: string): RouteCase => ({
    name: 'trip-plan',
    path: `/trips/${tripId}/plan`,
    ready: TRIP_SECTIONS,
    map: true,
  })

  const DIALOG = '[role="dialog"]'
  const NOTE = 'li[data-planner-note]'
  /** Distinctive enough that the sweep at the end cannot match a seeded note. */
  const BODY = 'A note this walk wrote'
  const DETAIL = 'Bring the paper tickets'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** Every trip the list links a planner for, in the order the cards sit in. */
  async function plannedTripIds(page: Page): Promise<ReadonlyArray<string>> {
    await visit(page, TRIPS, 'light')
    return page.evaluate(() => {
      const ids: string[] = []
      for (const anchor of document.querySelectorAll('a[href^="/trips/"]')) {
        const match = /^\/trips\/([^/?#]+)\/plan$/.exec(
          anchor.getAttribute('href') ?? '',
        )
        if (match !== null && !ids.includes(match[1])) ids.push(match[1])
      }
      return ids
    })
  }

  /**
   * A trip whose planner has a day to write a note into.
   *
   * The first card is not it by default: a trip with no departure and no return date
   * has no day sections at all, and therefore no add control — the walk would time out
   * on a screen that is behaving exactly as designed. So it asks each planner in turn
   * and takes the first that offers the control this test is here to press.
   */
  async function planTripToWalk(page: Page): Promise<string> {
    const tripIds = await plannedTripIds(page)
    test.skip(tripIds.length === 0, 'the workspace lists no trip to walk into')

    for (const tripId of tripIds) {
      await visit(page, planRoute(tripId), 'light')
      const found = await page
        .getByRole('button', { name: 'Add a note for this day' })
        .first()
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
      if (found) return tripId
    }

    test.skip(
      true,
      'no trip in this workspace has both dates and a membership that may write, so no planner offers a day to note',
    )
    throw new Error('unreachable: the test was skipped')
  }

  /**
   * The whole slice in one walk: write, read, disclose, sweep away.
   *
   * It ends by deleting what it wrote, because the demo workspace is a shared fixture and
   * a retry has to find the day as it was left — a walk that accumulated a note per run
   * would eventually be asserting against its own litter.
   */
  test('a note is written with an icon and a detail, then swept away', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      'the itinerary lives in a sheet on a phone; this asserts the rail’s own composition',
    )
    // Several documents, not one: the trips list, a planner per candidate trip, and then
    // the planner this walks — each with a live map to finish drawing. Playwright's 30 s
    // is one document's budget, which is what `journeys.spec.ts` records at its own
    // `WALK_TIMEOUT_MS`. A ceiling, not an expectation: a warm run finishes in under 20 s.
    test.setTimeout(90_000)

    const tripId = await planTripToWalk(page)
    const route = planRoute(tripId)
    // Watched from before the navigation: a hydration mismatch is reported while the
    // document is being adopted, which is over before any assertion below could run.
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    await page
      .getByRole('button', { name: 'Add a note for this day' })
      .first()
      .click()

    const editor = page.locator(DIALOG)
    await expect(editor).toBeVisible()
    // By role rather than by label: the picker's sticky note is also called "Note",
    // and the required marker on the field's label puts a `*` in its text.
    await editor.getByRole('textbox', { name: 'Note', exact: true }).fill(BODY)
    await editor
      .getByRole('textbox', { name: 'Details', exact: true })
      .fill(`## Packing\n\n- ${DETAIL}`)
    // The picker is one radio group, so the vocabulary is reachable by name.
    await editor.getByRole('radio', { name: 'Tickets' }).click()
    await editor.getByRole('button', { name: 'Save note' }).click()
    await expect(editor).toBeHidden()

    const note = page.locator(NOTE).filter({ hasText: BODY })
    await expect(note).toHaveCount(1)
    await expect(note.getByRole('img', { name: 'Tickets' })).toBeVisible()

    // The detail is behind the disclosure and nowhere else: a note is one line until a
    // reader asks for more.
    await expect(note.getByText(DETAIL)).toHaveCount(0)
    await note.getByRole('button', { name: 'Show more' }).click()
    await expect(note.getByText(DETAIL)).toBeVisible()
    await note.getByRole('button', { name: 'Show less' }).click()
    await expect(note.getByText(DETAIL)).toHaveCount(0)

    await note.getByRole('button', { name: 'Delete note' }).click()
    const confirm = page.locator(DIALOG)
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Delete note' }).click()
    await expect(page.locator(NOTE).filter({ hasText: BODY })).toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })
})
