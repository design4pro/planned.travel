import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import type { RouteCase } from './helpers/routes.ts'
import { settleMutations } from './helpers/settle.ts'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  hasSession,
  useSession,
} from './helpers/session.ts'

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
   * Open the journal and take the trip this block walks. Behind the session
   * gate a journal that links to no trip address can only mean its markup or the
   * seed changed, so the block fails on it rather than skipping into green.
   */
  async function journalTripToWalk(page: Page): Promise<string> {
    await visit(page, JOURNAL, 'light')
    const tripId = await linkedTripId(page)
    expect(
      tripId,
      'the "Waiting for a story" list on the journal has to offer a demo trip with no journey attached — run `node scripts/seed/seed.mjs` to restore the fixture',
    ).not.toBeNull()
    // The assertion above has already thrown when the id is missing; this only
    // keeps the type honest for the callers.
    if (tripId === null) throw new Error('unreachable: the assertion failed')
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

  /**
   * A trip on the index in whichever layout this viewport draws: the grid's tile above `md`, the
   * row below it (`01-S7`), where the grid is still in the document but hidden. `:visible` keeps
   * every lookup on the copy a reader can actually reach.
   */
  const CARD = '[data-part="trip-tile"]:visible, [data-part="trip-row"]:visible'
  const TRIGGER = '[data-part="trip-actions-trigger"]:visible'

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
    const heading = page.locator(CARD).first().getByRole('heading')
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
    await expect(page.locator(CARD)).toHaveCount(0)

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
      // The heavy branch: nothing arms it but the trip's own name, trimmed.
      // One character short rather than one too many: the dialog trims what was typed, so a
      // trailing space is the name and arms it (issue #557).
      await field.fill(title.slice(0, -1))
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

  /**
   * A trip on the index in whichever layout this viewport draws: the grid's tile above `md`, the
   * row below it (`01-S7`), where the grid is still in the document but hidden. `:visible` keeps
   * every lookup on the copy a reader can actually reach.
   */
  const CARD = '[data-part="trip-tile"]:visible, [data-part="trip-row"]:visible'
  const TRIGGER = '[data-part="trip-actions-trigger"]:visible'
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
    const tile = page.locator(CARD).filter({ hasNotText: NO_DATES }).first()
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
   *
   * **Settled before it is handed back.** Visible is not arrived: the menu that opened the dialog
   * is still on its exit animation and handing focus back, and the dialog is still on its entrance.
   * A trace of the red run shows the Dates trigger clicked 11 ms after the dialog turned visible,
   * and the popover that click opened lost to that focus hand-off — its first day "not stable",
   * then "detached from the DOM", with the range unchanged underneath. Every caller goes on to
   * press something inside the dialog, so the wait lives here rather than in each of them.
   */
  async function openCopyDialog(page: Page): Promise<string> {
    const { tile, title } = await datedTrip(page)
    const menu = await openMenu(page, tile)
    await menu.getByRole('menuitem', { name: 'Copy' }).click()
    await expect(page.locator(DIALOG)).toBeVisible()
    await settleMutations(page)
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
   *
   * **The grid is settled between the two clicks.** The first click half-opens the range, which
   * re-renders the grid and puts the field's "set both dates" error under the trigger the popover
   * is anchored to. A second click sent straight after it retried against "element is not stable"
   * and then "element was detached from the DOM". Waiting for the DOM to go quiet is the claim that
   * fits — here and in `openCopyDialog()` — and a longer timeout would only widen the window the
   * race hides in.
   */
  async function shortenToTwoDays(page: Page): Promise<void> {
    await page
      .locator(DIALOG)
      .getByRole('button', { name: 'Dates', exact: true })
      .click()
    const days = page.locator('table[role="grid"] button')
    await days.nth(0).click()
    await settleMutations(page)
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
  /**
   * The add control's accessible name ends in the day's own title, which the seed
   * decides, so the walk matches the stem and takes the first day it finds.
   */
  const ADD_NOTE_NAME = /^Add a note for /
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
        .getByRole('button', { name: ADD_NOTE_NAME })
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

    await page.getByRole('button', { name: ADD_NOTE_NAME }).first().click()

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

test.describe('01-S4b — The day is one sequence on screen', () => {
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
  const ADD_NOTE_NAME = /^Add a note for /
  /** Distinctive enough that neither can match a seeded row. */
  const EARLY = 'Sequence walk — the early note'
  const LATE = 'Sequence walk — the late note'

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
   * A trip whose planner has a day to write a note into — the first one that offers
   * the add control, for the reason `01-S2`'s walk records: a trip with no dates has
   * no day sections at all, so the first card is not it by default.
   */
  async function planTripToWalk(page: Page): Promise<string> {
    const tripIds = await plannedTripIds(page)
    test.skip(tripIds.length === 0, 'the workspace lists no trip to walk into')

    for (const tripId of tripIds) {
      await visit(page, planRoute(tripId), 'light')
      const found = await page
        .getByRole('button', { name: ADD_NOTE_NAME })
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
   * Writes one note into the first day that will take one.
   *
   * The editor closes on the write, not on the reload that follows it, so the walk
   * waits for the row itself — reading the day between the two would read it without
   * the note that was just saved.
   */
  async function writeNote(page: Page, body: string, time: string) {
    await page.getByRole('button', { name: ADD_NOTE_NAME }).first().click()
    const editor = page.locator(DIALOG)
    await expect(editor).toBeVisible()
    await editor.getByRole('textbox', { name: 'Note', exact: true }).fill(body)
    await editor.getByRole('textbox', { name: 'Time' }).fill(time)
    await editor.getByRole('button', { name: 'Save note' }).click()
    await expect(editor).toBeHidden()
    await expect(rowOf(page, body)).toHaveCount(1)
  }

  /**
   * The day's whole sequence, in the order it is on screen: a stop's item id and a
   * note's `note:`-prefixed one, read off the single list they now share.
   *
   * One list is the assertion, not just the fixture — reading both kinds out of one
   * `ul` is what proves the day stopped being a run of stops with notes bolted under it.
   */
  async function sequenceOf(page: Page, body: string): Promise<Array<string>> {
    return page.evaluate((text) => {
      const rows = [...document.querySelectorAll('li[data-planner-note]')]
      const mine = rows.find((row) => row.textContent.includes(text))
      const list = mine?.closest('ul')
      if (list === null || list === undefined) return []
      return [...list.children].flatMap((child) => {
        const note = child.getAttribute('data-planner-note')
        if (note !== null) return [`note:${note}`]
        const stop = child.getAttribute('data-planner-item')
        return stop === null ? [] : [stop]
      })
    }, body)
  }

  function rowOf(page: Page, body: string) {
    return page.locator('li[data-planner-note]').filter({ hasText: body })
  }

  /**
   * Deletes every note carrying this walk's marker, however many there are.
   *
   * A loop rather than a single delete because the demo workspace is a shared fixture
   * and a run that died mid-walk left its two notes behind: the next run would then
   * find two rows where it wrote one. Run before the walk as well as after it, so a
   * crash costs the following run nothing.
   */
  async function sweep(page: Page, body: string) {
    const rows = rowOf(page, body)
    for (let left = await rows.count(); left > 0; left -= 1) {
      // The action cluster floats over the headline and takes no pointer until the
      // row is hovered, so a click aimed straight at it lands on the words instead.
      await rows.first().hover()
      await rows.first().getByRole('button', { name: 'Delete note' }).click()
      const confirm = page.locator(DIALOG)
      await expect(confirm).toBeVisible()
      await confirm.getByRole('button', { name: 'Delete note' }).click()
      await expect(rows).toHaveCount(left - 1)
    }
  }

  /**
   * The whole slice in one walk: one sequence, a note dragged in it, and the question
   * a timed row asks before it is moved against its own clock.
   *
   * It sweeps away both notes at the end, because the demo workspace is a shared
   * fixture and a retry has to find the day as it was left.
   */
  test('a note drags among the stops, and a timed drop asks first', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      'the itinerary lives in a sheet on a phone; this asserts the rail’s own composition',
    )
    // Several documents, each with a live map to finish drawing — `01-S2`'s walk
    // records the same ceiling for the same reason, and this one pays that price
    // before it starts: two writes, a keyboard drag and a dialog all follow the same
    // trip discovery. A ceiling, not an expectation; a warm run finishes in under 20 s.
    test.setTimeout(180_000)

    const tripId = await planTripToWalk(page)
    const route = planRoute(tripId)
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    await sweep(page, EARLY)
    await sweep(page, LATE)

    // Two late times rather than one at each end of the day: whatever the seeded
    // stops carry, 23:45 and 23:50 sort last and in that order, so the two notes end
    // up adjacent and the drag below is exactly one step — and one step against the
    // clock, whichever day this workspace offered.
    await writeNote(page, EARLY, '23:45')
    await writeNote(page, LATE, '23:50')

    const before = await sequenceOf(page, LATE)
    const last = before.length - 1
    // One list holding stops and notes alike, sorted by the clock rather than by
    // arrival: the two markers are its final pair, in the order their times ask for,
    // and at least one stop shares the list with them. Asserted as membership rather
    // than by absolute slot, because the seeded day's own shape is not this walk's to
    // depend on — `01-S2`'s block writes into the same workspace.
    expect(before.some((id) => !id.startsWith('note:'))).toBe(true)
    expect(before[last]).toMatch(/^note:/)
    expect(before[last - 1]).toMatch(/^note:/)

    // Lifted by its own handle and stepped over the note above it, which puts 23:50
    // before 23:45 — the one thing the engine will not do without being asked.
    //
    // Each press waits for the live region to catch up rather than for a millisecond
    // count: the sensor is not listening until the lift has been announced, and a
    // walk that fires the arrow key before then drops it on the floor.
    // The drag's own live region, told apart from the map's polite hint by the
    // urgency it publishes rather than by the id `@dnd-kit` happens to generate.
    const spoken = page.locator('[role="status"][aria-live="assertive"]')
    await rowOf(page, LATE).hover()
    await rowOf(page, LATE)
      .getByRole('button', { name: 'Reorder note' })
      .focus()
    await page.keyboard.press('Space')
    await expect(spoken).toContainText('Picked up')
    // Pressed again until the region answers: `@dnd-kit` measures its droppables a
    // frame after the lift, and an arrow key that arrives first is discarded with no
    // trace. Retrying the press is the only signal there is that it was heard, and a
    // press the sensor did hear only ever moves the note further from 23:45.
    await expect(async () => {
      await page.keyboard.press('ArrowUp')
      await expect(spoken).toContainText('Now over', { timeout: 500 })
    }).toPass({ timeout: 10_000 })
    await page.keyboard.press('Space')

    const question = page.locator(DIALOG)
    await expect(question).toBeVisible()
    await expect(question.getByText(/drop its 23:50\?$/)).toBeVisible()

    // Declined: the day is exactly as it was, and nothing was written.
    await question.getByRole('button', { name: 'Keep it where it is' }).click()
    await expect(question).toBeHidden()
    expect(await sequenceOf(page, LATE)).toEqual(before)

    await sweep(page, LATE)
    await sweep(page, EARLY)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })
})

test.describe('01-S5 — The dashboard’s reference column, and the clock in it', () => {
  /**
   * This block's route table. One route, because the column, its menu and its
   * clock are all properties of `/dashboard` and of nothing else — the stage
   * adds no server work and no second screen to walk to.
   */
  const DASHBOARD: RouteCase = {
    name: 'dashboard',
    path: '/dashboard',
    ready: 'main',
  }

  const COLUMN = '[data-part="dashboard-widgets-column"]'
  const SHEET_TRIGGER = '[data-part="dashboard-widgets-trigger"]'
  const SHEET = '[data-part="dashboard-widgets-sheet"]'
  const MENU_TRIGGER = '[data-part="dashboard-widgets-menu"]'
  const CLOCK_ROW = '[data-part="clock-row"]'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * The phone's half of the layout, and the clock read against a clock that
   * cannot move.
   *
   * Both halves of the suite's time pinning meet on this widget: the context runs
   * in `UTC`, so the zone the browser reports as the reader's own is `UTC`, and
   * `visit()` fixes the in-page `Date` at `FROZEN_NOW` — midday. A reader who has
   * never picked a zone gets exactly one row, their own, and that row has to read
   * the pinned minute. Asserted as a substring rather than as the whole cell
   * because whether the catalogue's locale prints a meridiem is the formatter's
   * business, not this claim's.
   *
   * Below `md` the column is not hidden but unmounted, which is the property that
   * keeps one clock timer in the document rather than two.
   */
  test('the phone opens the widgets in a sheet, and the clock reads the pinned minute', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      !isMobile,
      'the sheet is the phone’s way in; a wide viewport mounts the column instead',
    )
    const report = watchConsole(page, DASHBOARD)
    await visit(page, DASHBOARD, 'light')

    await expect(page.locator(COLUMN)).toHaveCount(0)
    await expect(page.locator(CLOCK_ROW)).toHaveCount(0)

    await page.locator(SHEET_TRIGGER).click()
    const sheet = page.locator(SHEET)
    await expect(sheet).toBeVisible()

    const rows = sheet.locator(CLOCK_ROW)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toHaveAttribute('data-zone', 'UTC')
    await expect(rows.first()).toContainText('12:00')

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The wide half, and the one behaviour the stage is named for: the column is
   * the reader's to dismiss, and dismissing all of it takes the column with it.
   *
   * The menu is asserted to survive that, because it is the only way back. It
   * lives in the dashboard header rather than in the column for exactly this
   * reason, and a menu that had been mounted inside the widgets would leave a
   * reader who switched the last one off with a dashboard they could not undo.
   */
  test('the reference column stands beside the trips, and folds away when every widget is off', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      'the phone has no column to fold; its half of the layout is the sheet above',
    )
    const report = watchConsole(page, DASHBOARD)
    await visit(page, DASHBOARD, 'light')

    const column = page.locator(COLUMN)
    await expect(column).toBeVisible()
    await expect(column.locator(CLOCK_ROW)).toHaveCount(1)
    // The sheet's trigger belongs to the phone alone: one surface is mounted at a
    // time, so a wide document that also carried it would be drawing the widgets
    // twice.
    await expect(page.locator(SHEET_TRIGGER)).toHaveCount(0)

    await page.locator(MENU_TRIGGER).click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    // Four, because the clock joined the three panels the rail already carried.
    // A menu that governed only the clock could not honour the claim below.
    const items = menu.getByRole('menuitemcheckbox')
    await expect(items).toHaveCount(4)

    const count = await items.count()
    for (let index = 0; index < count; index += 1) {
      // Ticking an item does not close the menu — deciding what the column holds
      // is several decisions, not one — so the next click lands without
      // reopening anything.
      await items.nth(index).click()
    }

    await expect(column).toHaveCount(0)
    await expect(menu).toBeVisible()

    // And back: the widget returns to the column, which is what makes the fold a
    // preference rather than a loss.
    await items.first().click()
    await expect(column).toBeVisible()
    await expect(column.locator(CLOCK_ROW)).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })
})

test.describe('01-S6a — Who is on this trip', () => {
  /**
   * This block's route table. The trips index is the one screen that links a
   * trip by id; the bookings tab is a section with no live map, which makes it
   * the cheapest place to find the sub-navigation the first case walks from.
   */
  const TRIPS: RouteCase = { name: 'trips', path: '/trips', ready: 'main' }

  const bookRoute = (tripId: string): RouteCase => ({
    name: 'trip-book',
    path: `/trips/${tripId}/book`,
    ready: TRIP_SECTIONS,
  })

  const peopleRoute = (tripId: string): RouteCase => ({
    name: 'trip-people',
    path: `/trips/${tripId}/people`,
    ready: TRIP_SECTIONS,
  })

  const MEMBERS_HEADING = 'On this trip'
  const VISIBILITY_HEADING = 'Who can find this trip'
  const INVITE = 'Add somebody'
  const OWNER_HINT = 'A trip always keeps at least one owner'
  /** Every role control on the screen: the label joined to the person it belongs to. */
  const ROLE_CONTROL = /^Role · /
  const REMOVE_CONTROL = / from this trip$/

  /**
   * The account the fixture puts on trips as an `editor` and never as an owner,
   * which is the only way to observe the non-owner rendering: the demo owner
   * owns every trip in the workspace, so signing in as them can never produce
   * the screen case 4 is about. All four fixture accounts share the one
   * password (`scripts/seed/seed.mjs`).
   */
  const EDITOR_EMAIL = 'mika@planned.travel'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** Every trip the index links a planner for, in the order the cards sit in. */
  async function listedTripIds(page: Page): Promise<ReadonlyArray<string>> {
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

  /** The first trip the index links, or a skip — there is nothing to walk without one. */
  async function aTripToWalk(page: Page): Promise<string> {
    const ids = await listedTripIds(page)
    test.skip(
      ids.length === 0,
      'the workspace lists no trip to open the people route on',
    )
    if (ids.length === 0) throw new Error('unreachable: the test was skipped')
    return ids[0]
  }

  /**
   * The caller's own row, found by the badge that marks it rather than by a
   * name this spec would otherwise restate from the fixture.
   */
  function ownRow(page: Page) {
    return page.locator('li').filter({ hasText: 'You' }).first()
  }

  test('the Share button in the sub-navigation opens the people route', async ({
    page,
  }) => {
    const tripId = await aTripToWalk(page)
    const route = bookRoute(tripId)
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    // Two are in the document at every width — one for the narrow bar, one for
    // the wide one — and exactly one of them is the reader's.
    const share = page
      .getByRole('link', { name: 'Share this trip' })
      .filter({ visible: true })
    await expect(share).toHaveCount(1)
    await share.click()

    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/people(\\?|$)`))
    await expect(
      page.getByRole('heading', { name: MEMBERS_HEADING }),
    ).toBeVisible()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the route lists the trip’s people and says who can find it', async ({
    page,
  }) => {
    const tripId = await aTripToWalk(page)
    const route = peopleRoute(tripId)
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    await expect(
      page.getByRole('heading', { name: MEMBERS_HEADING }),
    ).toBeVisible()
    // The reader is on the trip they are reading — every seeded trip carries the
    // demo owner, and a members list that answered without their row would mean
    // the participant read never reached the payload.
    await expect(ownRow(page)).toBeVisible()

    await expect(
      page.getByRole('heading', { name: VISIBILITY_HEADING }),
    ).toBeVisible()
    // The card always says the stored state in words. Which of the three it is
    // belongs to the fixture, so the claim is that one of them is said — not
    // which — and that the sentence is never absent.
    await expect(
      page.getByText(
        /(Only the people listed here can see this trip|Anyone in this workspace can open this trip|This trip is shared with a public link)/,
      ),
    ).toBeVisible()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the invite control offers somebody in the workspace who is not on the trip', async ({
    page,
  }) => {
    const ids = await listedTripIds(page)
    test.skip(
      ids.length === 0,
      'the workspace lists no trip to open the people route on',
    )

    /*
     * Not the first trip by default: the invite control resolves to an empty
     * state on a trip that already holds everybody in the workspace, which is
     * the screen behaving exactly as designed and nothing for this case to
     * press. So each trip is asked in turn for the picker this test is here to
     * open.
     */
    let opened: string | null = null
    for (const tripId of ids) {
      await visit(page, peopleRoute(tripId), 'light')
      if ((await page.getByRole('button', { name: INVITE }).count()) > 0) {
        opened = tripId
        break
      }
    }
    test.skip(
      opened === null,
      'every trip in the workspace already holds every one of its members, so no picker is offered',
    )

    const report = watchConsole(page, peopleRoute(opened ?? ''))
    await page.getByRole('button', { name: INVITE }).click()

    const options = page.getByRole('listbox').getByRole('option')
    await expect(options.first()).toBeVisible()
    // Somebody the workspace has and the trip does not: the subtraction happens
    // on the server, so an empty list here would mean it did not.
    expect(await options.count()).toBeGreaterThan(0)

    await page.keyboard.press('Escape')

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('a reader who is not the owner is offered no control at all', async ({
    context,
    page,
    baseURL,
  }) => {
    // A second account for one case, because the rendering under test is a
    // property of the *reader's* trip role and the cached session has only ever
    // been an owner. One extra sign-in a run stays well inside the endpoint's
    // ten-a-minute budget.
    await context.clearCookies()
    const signedIn = await page.request.post('/api/auth/sign-in/email', {
      headers: { origin: baseURL ?? 'http://localhost:3000' },
      data: { email: EDITOR_EMAIL, password: DEMO_PASSWORD },
      failOnStatusCode: false,
    })
    test.skip(
      !signedIn.ok(),
      `${EDITOR_EMAIL} has no account — run \`node scripts/seed/seed.mjs\` to provision the fixture`,
    )

    const ids = await listedTripIds(page)
    test.skip(
      ids.length === 0,
      'the editor is on no trip, so there is no non-owner screen to read',
    )

    const route = peopleRoute(ids[0])
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    await expect(
      page.getByRole('heading', { name: MEMBERS_HEADING }),
    ).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: ROLE_CONTROL }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: REMOVE_CONTROL }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: INVITE })).toHaveCount(0)
    // Nor the last-owner hint: it explains a control this reader was never
    // offered, and about somebody else's standing on the trip at that.
    await expect(page.getByText(OWNER_HINT)).toHaveCount(0)

    // The visibility card is still read, and read as a sentence: a switch here
    // would be a control whose write `updateTrip` refuses.
    await expect(
      page.getByRole('heading', { name: VISIBILITY_HEADING }),
    ).toBeVisible()
    await expect(page.getByRole('switch')).toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('a trip’s sole owner is offered neither verb, and is told why', async ({
    page,
  }) => {
    const tripId = await aTripToWalk(page)
    const route = peopleRoute(tripId)
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    const own = ownRow(page)
    await expect(own).toBeVisible()
    // Every seeded trip has exactly one owner, and it is the demo account. Both
    // controls that row would otherwise carry end in the last-owner refusal, so
    // the row says why instead of going quiet.
    await expect(own).toContainText(OWNER_HINT)
    await expect(own.getByRole('combobox')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Leave this trip' }),
    ).toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })
})

test.describe('01-S6b — A guest on a trip', () => {
  const peopleRoute = (tripId: string): RouteCase => ({
    name: 'trip-people',
    path: `/trips/${tripId}/people`,
    ready: TRIP_SECTIONS,
  })

  const GUESTS_HEADING = 'Travelling with you'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /** The first trip the index links a planner for — every seeded trip is the demo owner's. */
  async function aTripToWalk(page: Page): Promise<string> {
    await visit(page, { name: 'trips', path: '/trips', ready: 'main' }, 'light')
    const href = await page
      .locator('a[href^="/trips/"][href$="/plan"]')
      .first()
      .getAttribute('href')
      .catch(() => null)
    const id = href === null ? null : /^\/trips\/([^/?#]+)\/plan$/.exec(href)
    test.skip(
      id === null,
      'the workspace lists no trip to open the people route on',
    )
    if (id === null) throw new Error('unreachable: the test was skipped')
    return id[1]
  }

  test('an owner adds a guest, opens the merge dialog without committing, and removes them', async ({
    page,
  }) => {
    const tripId = await aTripToWalk(page)
    const route = peopleRoute(tripId)
    const report = watchConsole(page, route)
    await visit(page, route, 'light')

    await expect(
      page.getByRole('heading', { name: GUESTS_HEADING }),
    ).toBeVisible()

    // A name no earlier run left behind, so a duplicate refusal cannot pass for success.
    const name = `E2E guest ${Date.now()}`
    const field = page.getByLabel('Their name')
    await field.fill(name)
    await field.press('Enter')

    const row = page.locator('li').filter({ hasText: name })
    await expect(row).toBeVisible()
    // The field sits in one place whether the list was empty or not, so the keyboard stays in it.
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('')
    await expect(row).toContainText('Guest')

    // The merge is irreversible, so the case only proves the dialog asks: the confirm stays
    // disarmed until somebody is chosen, and Escape leaves the guest where they were.
    await page.getByRole('button', { name: `${name} is now…` }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Merge' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(row).toBeVisible()

    await page
      .getByRole('button', { name: `Remove ${name} from this trip` })
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Remove', exact: true })
      .click()
    await expect(row).toHaveCount(0)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })
})

test.describe('01-S7 — Reading a list of trips two ways, and finding the archived ones', () => {
  /**
   * This block's route table. One route: the mode, its switch and the archived fold are all
   * properties of the trip index. The dashboard's progress bar and strip are a component's, and
   * `src/routes/_app/-ui/__tests__/trip-hero-strip.test.tsx` covers them.
   */
  const TRIPS: RouteCase = {
    name: 'trips',
    path: '/trips',
    ready: 'main',
  }

  const LIST_SWITCH = '[data-part="trip-view-list"]'
  const GRID_SWITCH = '[data-part="trip-view-grid"]'
  const ROW = '[data-part="trip-row"]'
  const DISCLOSURE = '[data-part="trip-archive-disclosure"]'
  const TRIGGER = '[data-part="trip-actions-trigger"]'

  test.beforeEach(async ({ context, page, baseURL, isMobile }) => {
    test.skip(
      isMobile,
      'the switch is a wide-viewport control; the phone reads the index as rows already',
    )
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * The mode is a presentation of the list the loader already holds, so switching it is a URL
   * change and nothing else: the trips loader is not called on the way from the grid to the rows or
   * back. A switch that refetched would still pass every visual check and fail this one.
   */
  test('the switch lays the same trips out as rows, in the URL, without asking the server again', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    const tiles = page.locator('[data-part="trip-tile"]:visible')
    await expect(tiles.first()).toBeVisible()
    const tileCount = await tiles.count()

    // The trips loader by name, decoded from the function id: the `_app` layout's own loader runs on
    // every navigation and is not this stage's claim.
    const loaderCalls: Array<string> = []
    page.on('request', (request) => {
      const id = new URL(request.url()).pathname.split('/_serverFn/').at(1)
      if (
        id !== undefined &&
        Buffer.from(decodeURIComponent(id), 'base64')
          .toString('utf8')
          .includes('loadTrips')
      ) {
        loaderCalls.push(request.url())
      }
    })

    await page.locator(LIST_SWITCH).click()
    await expect(page).toHaveURL(/[?&]view=list(&|$)/)
    await expect(page.locator(LIST_SWITCH)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator(`${ROW}:visible`)).toHaveCount(tileCount)
    await expect(page.locator('[data-part="trip-tile"]:visible')).toHaveCount(0)

    await page.locator(GRID_SWITCH).click()
    await expect(page).toHaveURL(/[?&]view=grid(&|$)/)
    await expect(tiles).toHaveCount(tileCount)

    expect(loaderCalls, loaderCalls.join('\n')).toEqual([])

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The remembered mode is a default for in-app navigation only. A cold load of `/trips` is the
   * server's render, and the server has no storage to read, so it paints the grid and the URL says
   * nothing; the next in-app arrival is seeded with the stored mode, replacing rather than adding a
   * history entry, so Back returns to where the reader came from.
   */
  test('a remembered list is the default for an in-app arrival, never for a cold visit', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'planned.trips-view',
        JSON.stringify({ mode: 'list', archiveOpen: false }),
      )
    })
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    await expect(
      page.locator('[data-part="trip-tile"]:visible').first(),
    ).toBeVisible()
    await expect(page).not.toHaveURL(/[?&]view=/)
    await expect(page.locator(LIST_SWITCH)).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    // The top bar's `New trip` is a plain link to the index, which is the in-app arrival.
    await visit(
      page,
      { name: 'dashboard', path: '/dashboard', ready: 'main' },
      'light',
    )
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'New trip', exact: true })
      .click()
    await expect(page).toHaveURL(/\/trips\?view=list$/)
    await expect(page.locator(`${ROW}:visible`).first()).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard$/)

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  /**
   * The demo workspace carries no archived trip, so this test makes one and puts it back: the last
   * row, which is never the dashboard's prominent trip nor the tile another block reads first. The
   * fold is asserted to be a real disclosure — a button whose `aria-expanded` follows it and whose
   * body names the archived trip — and the restore runs even when an assertion fails.
   */
  test('an archived trip waits in a closed fold at the foot of the index, and opens on request', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, { ...TRIPS, path: '/trips?view=list' }, 'light')

    const rows = page.locator(`${ROW}:visible`)
    await expect(rows.first()).toBeVisible()
    const last = rows.last()
    const title = (await last.getByRole('heading').innerText()).trim()

    await last.locator(TRIGGER).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()

    try {
      const disclosure = page.locator(DISCLOSURE)
      await expect(disclosure).toBeVisible()
      await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator('#trip-archive')).toHaveCount(0)

      await disclosure.click()
      await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
      const archive = page.locator('#trip-archive')
      await expect(
        archive.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible()
    } finally {
      const archived = page
        .locator('#trip-archive')
        .locator(ROW)
        .filter({
          has: page.getByRole('heading', { name: title, exact: true }),
        })
      if ((await page.locator('#trip-archive').count()) === 0) {
        await page.locator(DISCLOSURE).click()
      }
      await archived.locator(TRIGGER).click()
      await page.getByRole('menuitem', { name: 'Restore' }).click()
      await expect(archived).toHaveCount(0)
      await settleMutations(page)
    }

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })
})

test.describe('01-S8a — One trip form for creating and editing', () => {
  /** One route: the index carries both the create button and every tile's Edit sheet. */
  const TRIPS: RouteCase = {
    name: 'trips',
    path: '/trips',
    ready: 'main',
  }

  const CARD = '[data-part="trip-tile"]:visible, [data-part="trip-row"]:visible'
  const TRIGGER = '[data-part="trip-actions-trigger"]:visible'

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session — run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  /**
   * Nothing here saves: a created trip would be one more row in the demo workspace and a quota the
   * other blocks count on. The dialog is opened, read, driven and cancelled; the write path is
   * covered where the repository lives.
   */
  test('the create dialog derives the duration from two dates, keeps it when the start moves, and offers the whole currency list', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    await page
      .getByRole('button', { name: 'New trip' })
      .filter({ visible: true })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Summary')).toBeVisible()
    await expect(
      dialog.getByRole('radiogroup', { name: 'Reminder before departure' }),
    ).toBeVisible()

    // Neither date: the duration is the reader's to type.
    const duration = dialog.getByLabel('Duration in days')
    await expect(duration).toBeEditable()
    await duration.fill('5')
    await expect(duration).toHaveValue('5')

    // Both dates: it is read-only and derived; moving the start keeps it and moves the end.
    await dialog.getByLabel('Departure', { exact: true }).fill('2030-06-01')
    await dialog.getByLabel('Return', { exact: true }).fill('2030-06-04')
    await expect(duration).not.toBeEditable()
    await expect(duration).toHaveValue('4')
    await dialog.getByLabel('Departure', { exact: true }).fill('2030-06-10')
    await expect(dialog.getByLabel('Return', { exact: true })).toHaveValue(
      '2030-06-13',
    )
    await expect(duration).toHaveValue('4')

    // The return date moves the duration instead.
    await dialog.getByLabel('Return', { exact: true }).fill('2030-06-12')
    await expect(duration).toHaveValue('3')

    // An inverted range is named on the Return field and disarms the save.
    await dialog.getByLabel('Return', { exact: true }).fill('2030-06-01')
    await expect(
      dialog.getByText('The return date is before departure.'),
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Create trip' }),
    ).toBeDisabled()

    // The currency list is searchable on a name the nine curated codes do not include.
    await dialog.getByRole('button', { name: 'Budget currency' }).click()
    await page.getByRole('combobox').fill('norwegian')
    await expect(page.getByRole('option', { name: /NOK/ })).toBeVisible()

    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the save button is in view on a 360-pixel phone, without scrolling the form', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    await page
      .getByRole('button', { name: 'New trip' })
      .filter({ visible: true })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Create trip' }),
    ).toBeInViewport()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })

  test('the edit sheet renders the same field set, the reminder as the owner’s, seeded from the trip', async ({
    page,
  }) => {
    const report = watchConsole(page, TRIPS)
    await visit(page, TRIPS, 'light')

    await page.locator(CARD).first().locator(TRIGGER).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    const sheet = page.locator('[data-part="trip-edit-sheet"]')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByLabel('Summary')).toBeVisible()
    await expect(sheet.getByLabel('Departure', { exact: true })).toBeVisible()
    await expect(
      sheet.getByRole('button', { name: 'Budget currency' }),
    ).toBeVisible()
    // Exactly one radio is checked: the trip's stored reminder, never an unseeded group.
    await expect(
      sheet
        .getByRole('radiogroup', { name: 'Reminder before departure' })
        .getByRole('radio', { checked: true }),
    ).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()

    const verdict = report()
    expect(verdict.fatal, verdict.fatal.join('\n')).toEqual([])
  })
})
