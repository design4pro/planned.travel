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
    // Copy arrives in the last `01-S1` slice; a menu that already carried it here would be a menu
    // whose item has no server function behind it.
    await expect(
      menu.getByRole('menuitem', { name: /^Delete( permanently)?$/ }),
    ).toBeVisible()
    await expect(menu.getByRole('menuitem')).toHaveCount(4)

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
