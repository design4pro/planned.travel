import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import type { RouteCase } from './helpers/routes.ts'
import { DEMO_EMAIL, hasSession, useSession } from './helpers/session.ts'

/**
 * `ACC-03` - a member sees their passkeys and adds one (plan stage 09-S1, ticket 09-S1a).
 *
 * `/passkeys` is not in `APP_ROUTES`: that table is the walk every journey covers, and this is one
 * screen inside the account area. 09-S1b and 09-S1c append their walks to this file.
 *
 * Two halves, in the order they can be trusted in. The first is what everyone gets: the page
 * answers, hydrates, says nothing in the console and does not move when the list resolves. The
 * second is the one thing a stub cannot prove - that the real ceremony works against the real
 * relying party (origin, `rpId`, base64url, the consumed challenge) - and it needs Chromium's
 * virtual authenticator.
 */
const PASSKEYS: RouteCase = {
  name: 'passkeys',
  path: '/passkeys',
  ready: '#passkey-list-heading',
}

/** The passkey rows only: the app shell has list items of its own. */
function rows(page: Page) {
  return page
    .getByRole('region', { name: 'Your passkeys' })
    .getByRole('listitem')
}

const LIST_ENDPOINT = '**/api/auth/passkey/list'
const VERIFY_ENDPOINT = '/api/auth/passkey/register/verify'

/** What the endpoint returns for a registered passkey; the screen reads exactly these fields. */
function listed(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: null,
    deviceType: 'singleDevice',
    backedUp: false,
    aaguid: null,
    createdAt: '2026-08-01T09:00:00.000Z',
    lastUsedAt: null,
    ...overrides,
  }
}

test.describe('ACC-03 - the passkeys page answers for a signed-in member', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session - run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('hydrates, names itself and says nothing in the console', async ({
    page,
  }) => {
    const watched = watchConsole(page, PASSKEYS)
    await visit(page, PASSKEYS, 'light')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Passkeys')
    await expect(
      page.getByRole('heading', { level: 2, name: 'Your passkeys' }),
    ).toBeVisible()
    // The one live region exists whatever happens next, empty until something is announced.
    await expect(page.getByRole('status')).toHaveCount(1)
    await expect(page.getByRole('status')).toHaveText('')

    const output = watched()
    expect(
      output.fatal,
      'the console must be clean once the page settled',
    ).toEqual([])
    if (output.tolerated.length > 0) {
      test.info().annotations.push({
        type: 'tolerated console output',
        description: `${PASSKEYS.path}: ${output.tolerated.join('\n')}`,
      })
    }
  })

  test('is reached from Security, which was a dead link', async ({ page }) => {
    await page.goto('/settings/security', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'Manage passkeys' }).click()

    await expect(page).toHaveURL(/\/passkeys$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Passkeys' }),
    ).toBeVisible()
  })

  test('does not move when the list resolves into rows', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'layout-shift entries exist in Chromium only',
    )

    // Held at the skeleton until the counter is zeroed, so the only shifts counted are the ones
    // the skeleton-to-rows swap itself causes.
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(LIST_ENDPOINT, async (route) => {
      await held
      await route.fulfill({
        json: {
          passkeys: [
            listed('pk_a', { backedUp: true, deviceType: 'multiDevice' }),
            listed('pk_b', {
              name: 'Work laptop',
              lastUsedAt: '2026-09-02T10:00:00.000Z',
            }),
          ],
        },
      })
    })
    await page.addInitScript(() => {
      const probe = { shift: 0 }
      Object.defineProperty(window, '__passkeyShift', { value: probe })
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          }
          if (!shift.hadRecentInput) probe.shift += shift.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await page.goto(PASSKEYS.path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('ul[aria-busy="true"]')).toBeVisible()
    await page.evaluate(() => {
      Reflect.set(Reflect.get(window, '__passkeyShift'), 'shift', 0)
    })

    release()
    // Hydration of a dev-server route can take longer than the default assertion budget.
    await expect(rows(page)).toHaveCount(2, { timeout: 20_000 })
    await expect(page.locator('ul[aria-busy="true"]')).toHaveCount(0)
    await expect(page.getByText('Synced')).toBeVisible()
    await expect(page.getByText('Work laptop')).toBeVisible()
    await expect(page.getByText('Not used to sign in yet')).toBeVisible()

    const shift = await page.evaluate(() =>
      Number(Reflect.get(Reflect.get(window, '__passkeyShift'), 'shift')),
    )
    expect(shift, 'the rows replace the skeleton without moving the page').toBe(
      0,
    )
  })
})

test.describe('ACC-03 - a member adds a passkey on this device', () => {
  /*
   * Chromium only, for two reasons. The CDP `WebAuthn` domain that provides a virtual
   * authenticator exists nowhere else, and the walk writes a credential row for the demo member,
   * which two projects would count against each other. `playwright.config.ts` names this
   * describe among the fixture writers.
   */
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'the virtual authenticator is a Chromium DevTools feature, and the walk writes the member’s passkey rows',
  )

  /** Ordered: the walk counts rows before and after, and only one test may hold the account. */
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
    test.skip(
      !(await hasSession(page)),
      `${DEMO_EMAIL} has no session - run \`node scripts/seed/seed.mjs\` to provision the demo account`,
    )
  })

  test('adds a passkey with a virtual authenticator, and it is still there after a reload', async ({
    context,
    page,
    baseURL,
  }) => {
    // The relying-party id is `localhost` (`src/server/auth/env.ts`). On any other host the
    // browser refuses the ceremony with a SecurityError, which would read as a product defect
    // rather than a mis-pointed run - so this fails loudly instead of skipping.
    expect(
      new URL(baseURL ?? 'http://localhost:3000').hostname,
      'the passkey ceremony needs PLAYWRIGHT_BASE_URL=http://localhost:<port>',
    ).toBe('localhost')

    const cdp = await context.newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    const { authenticatorId } = await cdp.send(
      'WebAuthn.addVirtualAuthenticator',
      {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      },
    )
    let created: string | null = null

    try {
      const watched = watchConsole(page, PASSKEYS)
      await visit(page, PASSKEYS, 'light')
      // The empty state draws a second Add button; the header's is the first.
      const add = page.getByRole('button', { name: 'Add a passkey' }).first()
      await expect(add).toBeEnabled()
      const before = await rows(page).count()

      const verified = page.waitForResponse(
        (response) =>
          response.url().endsWith(VERIFY_ENDPOINT) &&
          response.request().method() === 'POST',
      )
      await add.click()
      const response = await verified
      expect(response.status(), 'the real ceremony verifies').toBe(200)
      const body: unknown = await response.json()
      created =
        typeof body === 'object' &&
        body !== null &&
        'passkey' in body &&
        typeof body.passkey === 'object' &&
        body.passkey !== null &&
        'id' in body.passkey &&
        typeof body.passkey.id === 'string'
          ? body.passkey.id
          : null
      expect(created, 'verify answers with the new passkey').not.toBeNull()

      await expect(page.getByRole('status')).toHaveText('Passkey added')
      await expect(rows(page)).toHaveCount(before + 1)
      await expect(add, 'focus comes back to the button').toBeFocused()
      // The row has no name yet; the fallback is display-only.
      await expect(page.getByText(/^Passkey · added /)).toBeVisible()

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(rows(page)).toHaveCount(before + 1, { timeout: 20_000 })

      expect(
        watched().fatal,
        'the console stays clean through the ceremony',
      ).toEqual([])
    } finally {
      // Nothing in 09-S1a removes a passkey, so the walk cleans up through the endpoint; the
      // delete dialog arrives with 09-S1c. Both calls are best effort: a failed cleanup must
      // not hide the failure that got us here.
      if (created !== null) {
        await page.request.post('/api/auth/passkey/delete', {
          headers: { origin: baseURL ?? 'http://localhost:3000' },
          data: { id: created },
          failOnStatusCode: false,
        })
      }
      await cdp
        .send('WebAuthn.removeVirtualAuthenticator', { authenticatorId })
        .catch(() => undefined)
      await cdp.send('WebAuthn.disable').catch(() => undefined)
    }
  })
})
