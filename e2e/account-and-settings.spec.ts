import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit, watchConsole } from './helpers/console.ts'
import type { RouteCase } from './helpers/routes.ts'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  hasSession,
  useSession,
} from './helpers/session.ts'

/**
 * `ACC-03` - a member sees their passkeys, adds one, names it and takes it away (plan stage 09-S1,
 * tickets 09-S1a, 09-S1b and 09-S1c).
 *
 * `/passkeys` is not in `APP_ROUTES`: that table is the walk every journey covers, and this is one
 * screen inside the account area.
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
const RENAME_ENDPOINT = '/api/auth/passkey/rename'
const DELETE_ENDPOINT = '/api/auth/passkey/delete'

/** Resolves with the reply to the next rename request. */
function renameReply(page: Page) {
  return page.waitForResponse(
    (reply) =>
      reply.url().endsWith(RENAME_ENDPOINT) &&
      reply.request().method() === 'POST',
  )
}

/** Resolves with the reply to the next remove request. */
function deleteReply(page: Page) {
  return page.waitForResponse(
    (reply) =>
      reply.url().endsWith(DELETE_ENDPOINT) &&
      reply.request().method() === 'POST',
  )
}

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
    // Shifts are split by where they happen. The skeleton-to-rows swap is the section's own; the
    // app shell around it (a badge count, a late font) may settle in the same window on a slow
    // runner, and that is not this screen's to answer for, so it is only reported.
    await page.addInitScript(() => {
      const probe = { section: 0, shell: 0, shellSources: [] as string[] }
      Object.defineProperty(window, '__passkeyShift', { value: probe })
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
            sources?: Array<{ node: Node | null }>
          }
          if (shift.hadRecentInput) continue
          const sources = shift.sources ?? []
          const inSection = sources.some(({ node }) => {
            const element = node instanceof Element ? node : node?.parentElement
            return (
              element === null ||
              element === undefined ||
              element.closest(
                'section[aria-labelledby="passkey-list-heading"]',
              ) !== null
            )
          })
          if (inSection) probe.section += shift.value
          else {
            probe.shell += shift.value
            probe.shellSources.push(
              ...sources.map(({ node }) =>
                node instanceof Element ? node.tagName : 'gone',
              ),
            )
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await page.goto(PASSKEYS.path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('ul[aria-busy="true"]')).toBeVisible()
    await page.evaluate(() => {
      const probe = Reflect.get(window, '__passkeyShift')
      Reflect.set(probe, 'section', 0)
      Reflect.set(probe, 'shell', 0)
      Reflect.set(probe, 'shellSources', [])
    })

    release()
    // Hydration of a dev-server route can take longer than the default assertion budget.
    await expect(rows(page)).toHaveCount(2, { timeout: 20_000 })
    await expect(page.locator('ul[aria-busy="true"]')).toHaveCount(0)
    await expect(page.getByText('Synced')).toBeVisible()
    await expect(page.getByText('Work laptop')).toBeVisible()
    await expect(page.getByText('Not used to sign in yet')).toBeVisible()

    const shifts = await page.evaluate(() => {
      const probe = Reflect.get(window, '__passkeyShift')
      return {
        section: Number(Reflect.get(probe, 'section')),
        shell: Number(Reflect.get(probe, 'shell')),
        shellSources: String(Reflect.get(probe, 'shellSources')),
      }
    })
    if (shifts.shell > 0) {
      test.info().annotations.push({
        type: 'shell layout shift (not this screen)',
        description: `${shifts.shell} from ${shifts.shellSources}`,
      })
    }
    expect(
      shifts.section,
      'the rows replace the skeleton without moving the page',
    ).toBe(0)
  })
})

test.describe('ACC-03 - a member adds a passkey on this device, names it and takes it away', () => {
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

  test('adds a passkey with a virtual authenticator, names and renames it, keeps it across a reload and removes it with the password', async ({
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
      // The ceremony sent no name: the new row opens in rename mode, with focus in the field.
      const field = page.getByRole('textbox', { name: 'Name this passkey' })
      await expect(
        field,
        'focus goes to the new row’s rename input',
      ).toBeFocused()
      await expect(page.getByText(/^Passkey · added /)).toBeVisible()

      // Naming it: Enter saves, the name replaces the fallback, focus returns to the Rename control.
      await field.fill('Work phone')
      const named = renameReply(page)
      await field.press('Enter')
      expect((await named).status(), 'naming it succeeds').toBe(200)
      await expect(
        rows(page).getByText('Work phone', { exact: true }),
      ).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('Name saved')
      const rename = page.getByRole('button', { name: 'Rename Work phone' })
      await expect(rename, 'focus returns to the Rename control').toBeFocused()

      // Renaming it later goes through the same control.
      await rename.click()
      await expect(field).toHaveValue('Work phone')
      await field.fill('Laptop')
      const renamed = renameReply(page)
      await field.press('Enter')
      expect((await renamed).status(), 'renaming it succeeds').toBe(200)
      await expect(
        rows(page).getByText('Laptop', { exact: true }),
      ).toBeVisible()

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(rows(page)).toHaveCount(before + 1, { timeout: 20_000 })
      await expect(
        rows(page).getByText('Laptop', { exact: true }),
        'the name is stored, not only drawn',
      ).toBeVisible()

      // Taking it away: the demo member has a password, so the dialog asks for it. A wrong one is
      // refused on the field and the row stays; the right one removes it.
      await page.getByRole('button', { name: 'Remove Laptop' }).click()
      const dialog = page.getByRole('dialog', { name: 'Remove this passkey?' })
      const password = dialog.getByLabel('Password')
      await expect(password).toBeFocused()
      await password.fill(`${DEMO_PASSWORD}-wrong`)
      const refused = deleteReply(page)
      await dialog.getByRole('button', { name: 'Remove passkey' }).click()
      expect((await refused).status(), 'a wrong password is refused').toBe(400)
      await expect(
        dialog.getByText('That password is not right.'),
      ).toBeVisible()
      await expect(password, 'focus goes back to the password').toBeFocused()
      await expect(rows(page)).toHaveCount(before + 1)

      await password.fill(DEMO_PASSWORD)
      const removed = deleteReply(page)
      await dialog.getByRole('button', { name: 'Remove passkey' }).click()
      expect((await removed).status(), 'the right password removes it').toBe(
        200,
      )
      await expect(dialog).toBeHidden()
      await expect(rows(page)).toHaveCount(before)
      await expect(page.getByRole('status')).toHaveText('Passkey removed')
      await expect(
        page.getByRole('button', { name: 'Add a passkey' }).first(),
        'focus goes to the Add button',
      ).toBeFocused()
      created = null

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(
        page.getByRole('region', { name: 'Your passkeys' }),
      ).toBeVisible()
      await expect(rows(page), 'the removal is stored').toHaveCount(before)

      expect(
        watched().fatal,
        'the console stays clean through the ceremony',
      ).toEqual([])
    } finally {
      // A walk that failed before the removal still owns its row, so the cleanup deletes it through
      // the endpoint with the member's password. Both calls are best effort: a failed cleanup must
      // not hide the failure that got us here.
      if (created !== null) {
        await page.request.post(DELETE_ENDPOINT, {
          headers: { origin: baseURL ?? 'http://localhost:3000' },
          data: { id: created, password: DEMO_PASSWORD },
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
