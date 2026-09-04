import type { Page } from '@playwright/test'
import { unblockCrossOriginFonts } from './console'
import type { RouteCase } from './routes'
import { settle } from './settle'

/**
 * The two fixtures no product surface can mint for itself.
 *
 * The platform console is behind a *role* rather than behind a session, and an
 * impersonated session is a state an operator enters from inside the console. A
 * run against a database seeded before either existed has to skip the journeys
 * that need them rather than walk a redirect and assert nothing, so both fixtures
 * report whether they are available instead of failing.
 */

/* -------------------------------------------------------------------------------------------------
 * The platform console
 * ---------------------------------------------------------------------------------------------- */

/**
 * The console's own routes, kept out of `APP_ROUTES` on purpose.
 *
 * Three reasons, and none of them is tidiness. The account screen's path carries a `$userId` that
 * only the running database can supply, so it cannot be a constant in a table every audit iterates.
 * The whole tree is behind a *platform role* rather than merely behind a session, so a run against a
 * database seeded before that fixture existed has to skip these rather than walk the redirect to
 * `/dashboard` — a green run that asserted nothing about the console. And `APP_ROUTES` is
 * documented as the six screens the product's own navigation reaches; the console is reached from
 * the user menu, by an operator who already knows it is there.
 *
 * They are walked by the same machinery, so a console screen that 500s, never hydrates or writes to
 * the console fails the run exactly as an application screen does.
 *
 * `/console/users` is walked under an explicit sort, and that is load-bearing rather than
 * decorative. The demo fixture anchors every account's `created_at` to the same instant, so the
 * default `created_at desc` ordering has no tiebreaker and SQLite is free to return the four rows in
 * any order it likes. `?sort=name&dir=asc` is a total order over the fixture, and it exercises the
 * sort control in its active state as well.
 */
const CONSOLE_OVERVIEW_ROUTE: RouteCase = {
  name: 'console',
  path: '/console',
  ready: 'main',
}

/** Named, because the impersonation fixture drives a control on this exact screen. */
export const CONSOLE_ACCOUNTS_ROUTE: RouteCase = {
  name: 'console-users',
  path: '/console/users?sort=name&dir=asc',
  ready: 'main',
}

/**
 * The agent-run registry (`docs/adr/0009`), and what it draws when this deployment is not the one
 * coordinating the fleet.
 *
 * The registry binding is declared on `env.staging` alone - a second registry would let two fleets
 * each believe they hold the backlog - so a local or CI Worker has none, and the screen draws its
 * "this deployment does not coordinate the fleet" state.
 */
const CONSOLE_SANDCASTLE_ROUTE: RouteCase = {
  name: 'console-sandcastle',
  path: '/console/sandcastle',
  ready: 'main',
}

/**
 * The provider meters, reached for the same reason the registry is: an empty state the product
 * ships and every deployment starts in.
 *
 * Nothing in the seed makes an outbound call, so `provider_usage` is empty and every panel draws
 * its designed empty state — which is the state worth walking anyway, because it is the one every
 * deployment starts in.
 */
const CONSOLE_PROVIDERS_ROUTE: RouteCase = {
  name: 'console-providers',
  path: '/console/providers',
  ready: 'main',
}

export const CONSOLE_ROUTES: ReadonlyArray<RouteCase> = [
  CONSOLE_OVERVIEW_ROUTE,
  CONSOLE_ACCOUNTS_ROUTE,
  CONSOLE_SANDCASTLE_ROUTE,
  CONSOLE_PROVIDERS_ROUTE,
]

/**
 * The account `/console/users/$userId` is walked against.
 *
 * A collaborator rather than the demo owner: it is the fixture's `curator`, which is the middle rung
 * of the role scale and therefore the row that exercises the screen's role handling rather than the
 * operator's own.
 */
export const CONSOLE_ACCOUNT_NAME = 'Mika Tanaka'

/**
 * True when the signed-in account can actually open the console.
 *
 * Asked over `page.request` rather than by navigating, and that is a repair rather than a
 * preference. The guard is a `beforeLoad` redirect, so the honest question is which response the
 * server gives — and a probe that answered it by *navigating* left the page half way through loading
 * the client entry, which the next `visit()` then cancelled with its own `goto`. Chromium swallows the
 * aborted module import; WebKit reports it as `pageerror: Importing a module script failed`, and a
 * page error is fatal whatever produced it. Every console route failed on `mobile-safari` and none
 * on `chromium`, which is exactly the shape of a defect that gets blamed on the code under test.
 *
 * `page.request` shares the page's cookie jar and the context's headers, so this is the same
 * request the browser would make, and `maxRedirects: 0` is what makes the redirect readable instead
 * of followed: a `user`-role session is sent to `/dashboard`, an anonymous one to `/login`, and both
 * are "no console".
 */
export async function hasPlatformConsole(page: Page): Promise<boolean> {
  const response = await page.request.get('/console', {
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  return response.status() === 200
}

/**
 * The account screen's path, read out of the accounts document rather than hardcoded.
 *
 * The demo collaborators carry ids derived from their addresses, so a literal would work today and
 * would be a silent lie the first time that derivation changed. Taken over `page.request` for the
 * same reason as {@link hasPlatformConsole}: the caller's next act is a `goto`, and a navigation
 * here would be the one it cancels.
 *
 * **Matched inside the anchor, not by proximity to the name.** The obvious version of this - find
 * the name, take the nearest `href` before it - resolved the *previous* row for four rounds without
 * anyone noticing, because `Avatar` rendered the same name a second time as a screen-reader label a
 * few hundred bytes ahead of the link, and the nearest href before *that* is the row above. It
 * looked entirely plausible: a real account screen, for the wrong account. So the anchor's own text
 * is what decides, which is the property the row actually guarantees - the account's name is the
 * link.
 *
 * That duplicate is gone: `AccountIdentity` now marks the avatar `aria-hidden`, because the name it
 * repeated is printed one node to the right and every row was announcing the person twice. The
 * matching rule stays as it is anyway. It was never a workaround for the duplicate - it is the only
 * rule that says what this function means, and proximity would go wrong again the first time
 * anything else in a row carried the same string.
 */
export async function consoleAccountPath(page: Page): Promise<string | null> {
  const response = await page.request.get(CONSOLE_ACCOUNTS_ROUTE.path, {
    failOnStatusCode: false,
  })
  if (!response.ok()) {
    return null
  }
  const html = await response.text()
  const links = /href="(\/console\/users\/[^"]+)"/g
  for (const link of html.matchAll(links)) {
    const closed = html.indexOf('</a>', link.index)
    if (closed < 0) {
      continue
    }
    if (html.slice(link.index, closed).includes(CONSOLE_ACCOUNT_NAME)) {
      return link[1]
    }
  }
  return null
}

/* -------------------------------------------------------------------------------------------------
 * The impersonation warning bar
 * ---------------------------------------------------------------------------------------------- */

/** The account the impersonation fixture wears: a plain `user`, never an admin (docs/ACCESS.md §2.4). */
export const IMPERSONATION_TARGET_NAME = 'Jonas Berg'

/** The bar itself. One selector, used by the fixture and by the journeys. */
export const IMPERSONATION_BAR = '[aria-label="Impersonated session"]'

/**
 * Mints an impersonated session by driving the console, which is the only way there is.
 *
 * Not a database fixture and not a forged cookie: `/api/auth/admin/impersonate-user` answers `404`
 * (docs/ACCESS.md §2.6), so the account list's own action is the entire surface. Going through it
 * means the frame this produces is the frame an operator produces, and that the two audit rows
 * either side of it are written exactly as they are in production.
 *
 * Returns `false` when the console is unreachable, so a run against an unseeded database skips with
 * a reason instead of failing on a control it never found.
 */
export async function beginImpersonation(page: Page): Promise<boolean> {
  await unblockCrossOriginFonts(page)
  if (!(await hasPlatformConsole(page))) {
    return false
  }
  await page.goto(CONSOLE_ACCOUNTS_ROUTE.path, {
    waitUntil: 'domcontentloaded',
  })
  // Settled, not merely loaded. The row menu is a Radix trigger, so it does nothing at all until
  // React has claimed the tree - a click on the server's markup is a click on an inert button, and
  // the failure it produces is a timeout on the menu item that never opened.
  await settle(page, CONSOLE_ACCOUNTS_ROUTE)
  await page
    .getByRole('button', { name: `Actions for ${IMPERSONATION_TARGET_NAME}` })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Impersonate' }).click()
  await page.getByRole('button', { name: 'Start impersonating' }).click()
  await page.locator(IMPERSONATION_BAR).waitFor({ timeout: 15_000 })
  // The action swaps the cookie and then sends the router to `/dashboard`, and that navigation is
  // still in flight when the bar first paints. Leaving it in flight makes the next `goto` a race
  // the caller loses with "interrupted by another navigation" - so the fixture hands the browser
  // back settled rather than mid-move.
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  return true
}

/**
 * Hands the operator their own session back.
 *
 * Always run, including after a failed assertion: the browser context is thrown away with the test,
 * but the session row and its `admin_session` cookie are the product's, and leaving one live would
 * leave a `platform.user.impersonation_started` in the ledger with no `_ended` beside it — which
 * docs/ACCESS.md §4.3 defines as the signature of a session that lapsed rather than one that was
 * closed.
 */
export async function endImpersonationFixture(page: Page): Promise<void> {
  const end = page.getByRole('button', { name: 'End impersonation' })
  if ((await end.count()) === 0) {
    return
  }
  // The control is a React button, so a click before hydration lands on inert markup and the bar
  // simply stays. The route is whatever the caller left the browser on, and `settle()` only ever
  // reads `ready` and `map` off the case it is handed.
  await settle(page, { name: 'shell', path: page.url(), ready: 'main' })
  await end.first().click()
  await page
    .locator(IMPERSONATION_BAR)
    .waitFor({ state: 'detached', timeout: 15_000 })
}
