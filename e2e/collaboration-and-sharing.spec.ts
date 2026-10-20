import { expect, test } from '@playwright/test'
import { useSession, hasSession } from './helpers/session'
import { unblockCrossOriginFonts, visit, watchConsole } from './helpers/console'
import { settle } from './helpers/settle'

test.describe('07-S2 - Collaboration sections follow the viewport', () => {
  test('keeps only enabled tabs on a phone and shows every panel at xl', async ({
    context,
    page,
    baseURL,
  }) => {
    await unblockCrossOriginFonts(page)
    await page.route(
      /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
      async (route) => {
        const headers = await route.request().allHeaders()
        for (const name of Object.keys(headers))
          if (name.toLowerCase() === 'x-pt-server-today') delete headers[name]
        await route.continue({ headers })
      },
    )
    await useSession(context, page, baseURL)
    expect(await hasSession(page)).toBe(true)
    await visit(page, { name: 'trips', path: '/trips', ready: 'main' }, 'light')
    const trip = page
      .locator('a[href^="/trips/"][href$="/plan"]:visible')
      .first()
    await expect(trip).toBeVisible()
    const href = await trip.getAttribute('href')
    expect(href).toBeTruthy()
    const path = href?.replace(/\/plan$/, '/collab') ?? ''
    const route = { name: 'collaboration', path, ready: 'main' }
    const consoleReport = watchConsole(page, route)
    await visit(page, route, 'light')
    const menu = page.getByRole('button', {
      name: 'Choose sections',
      exact: true,
    })
    await expect(menu).toHaveCount(1)
    await menu.click()
    const polls = page.getByRole('menuitemcheckbox', {
      name: 'Polls',
      exact: true,
    })
    await expect(polls).toHaveCount(1)
    const names = ['Conversation', 'Notes', 'Polls'] as const
    const original = await Promise.all(
      names.map(async (name) => ({
        name,
        on:
          (await page
            .getByRole('menuitemcheckbox', { name, exact: true })
            .getAttribute('aria-checked')) === 'true',
      })),
    )
    try {
      for (const name of ['Conversation', 'Notes']) {
        const item = page.getByRole('menuitemcheckbox', { name, exact: true })
        if ((await item.getAttribute('aria-checked')) !== 'true')
          await item.click()
        await expect(item).toHaveAttribute('aria-checked', 'true')
      }
      if ((await polls.getAttribute('aria-checked')) === 'true')
        await polls.click()
      await expect(polls).toHaveAttribute('aria-checked', 'false')
      await page.keyboard.press('Escape')
      await page.reload()
      await settle(page, route)
      await expect(page.locator('[data-collab-section="polls"]')).toHaveCount(0)
      await page.setViewportSize({ width: 360, height: 800 })
      await expect(
        page.getByRole('tablist', { name: 'Collaboration sections' }),
      ).toHaveCount(1)
      await expect(page.getByRole('tab')).toHaveCount(2)
      await expect(page.locator('[data-collab-section]:visible')).toHaveCount(1)
      await page.getByRole('tab', { name: 'Notes', exact: true }).click()
      await expect(page.locator('[data-collab-section="notes"]')).toBeVisible()
      await page.setViewportSize({ width: 1280, height: 900 })
      await expect(
        page.getByRole('tablist', {
          name: 'Collaboration sections',
          includeHidden: true,
        }),
      ).toBeHidden()
      await expect(page.locator('[data-collab-section]:visible')).toHaveCount(2)
    } finally {
      await page.keyboard.press('Escape')
      await menu.click()
      // Restore enabled sections first so the last-section guard never blocks cleanup.
      for (const setting of [
        ...original.filter(({ on }) => on),
        ...original.filter(({ on }) => !on),
      ]) {
        const item = page.getByRole('menuitemcheckbox', {
          name: setting.name,
          exact: true,
        })
        if (
          ((await item.getAttribute('aria-checked')) === 'true') !==
          setting.on
        )
          await item.click()
        await expect(item).toHaveAttribute('aria-checked', String(setting.on))
      }
      await page.keyboard.press('Escape')
    }
    expect(consoleReport().fatal).toEqual([])
  })
})

test.describe('07-S10 - The owner controls the trip invite link', () => {
  test('creates by keyboard, keeps member counts, invites anonymously and revokes old copies', async ({
    context,
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    await unblockCrossOriginFonts(page)
    await useSession(context, page, baseURL)
    expect(await hasSession(page)).toBe(true)
    const report = watchConsole(page, {
      name: 'invite-panel',
      path: '/trips',
      ready: 'main',
    })
    await visit(page, { name: 'trips', path: '/trips', ready: 'main' }, 'light')
    const title = `Invite link proof ${Date.now()}`
    await page
      .getByRole('button', { name: 'New trip', exact: true })
      .first()
      .click()
    const creation = page.getByRole('dialog')
    await creation.getByLabel('Trip name').fill(title)
    await creation
      .getByRole('button', { name: 'Create trip', exact: true })
      .click()
    await expect(page).toHaveURL(/\/trips\/[^/]+\/plan$/)
    const peoplePath = new URL(page.url()).pathname.replace(
      /\/plan$/,
      '/people',
    )
    const anonymous = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    // Attribute shifts to this panel, not the shell's unrelated font and badge changes.
    await page.addInitScript(() => {
      const entries: number[] = []
      ;(window as unknown as Record<string, number[]>).__inviteShifts = entries
      if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift'))
        return
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
            sources: { node: Node | null }[]
          }
          if (
            !shift.hadRecentInput &&
            shift.sources.some(
              ({ node }) =>
                node instanceof Element &&
                node.closest('section[aria-labelledby]')?.querySelector('h2')
                  ?.textContent === 'Invite link',
            )
          )
            entries.push(shift.value)
        }
      }).observe({ type: 'layout-shift' })
    })
    try {
      await visit(
        page,
        { name: 'people', path: peoplePath, ready: 'main' },
        'light',
      )
      const panel = page.getByRole('region', {
        name: 'Invite link',
        exact: true,
      })
      await expect(panel.getByText('No invite link yet')).toBeVisible()
      await page.waitForTimeout(650)
      if (
        await page.evaluate(() =>
          PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
        )
      ) {
        // A deliberately displaced heading proves the observer detects shifts inside its section.
        await panel.locator('h2').evaluate((heading) => {
          heading.style.marginTop = '48px'
        })
        await page.waitForTimeout(100)
        expect(
          await page.evaluate(
            () =>
              (window as unknown as Record<string, number[]>).__inviteShifts
                .length,
          ),
        ).toBeGreaterThan(0)
        await panel.locator('h2').evaluate((heading) => {
          heading.style.marginTop = ''
        })
        await page.waitForTimeout(100)
        await page.evaluate(() => {
          ;(
            window as unknown as Record<string, number[]>
          ).__inviteShifts.length = 0
        })
      }

      // Reach the action by keyboard, without clicking or programmatically focusing it.
      for (let tabs = 0; tabs < 60; tabs++) {
        if (
          await panel
            .getByRole('button', { name: 'Create link', exact: true })
            .evaluate((button) => button === document.activeElement)
        )
          break
        await page.keyboard.press('Tab')
      }
      await expect(
        panel.getByRole('button', { name: 'Create link', exact: true }),
      ).toBeFocused()
      await page.keyboard.press('Enter')
      const copy = panel.getByRole('button', { name: 'Copy link', exact: true })
      await expect(copy).toBeFocused()
      // Clipboard support varies across engines. A browser-owned recorder proves the copied value.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (value: string) => {
              ;(window as unknown as Record<string, string>).__inviteClipboard =
                value
            },
          },
        })
      })
      await page.keyboard.press('Enter')
      await expect(panel.getByRole('status')).toHaveText('Link copied')
      const oldUrl = await panel
        .getByRole('textbox', { name: 'Invite link', exact: true })
        .inputValue()
      expect(
        await page.evaluate(
          () => (window as unknown as Record<string, string>).__inviteClipboard,
        ),
      ).toBe(oldUrl)
      await expect(
        panel.getByText('Nobody has joined through this link yet.'),
      ).toBeVisible()
      const member = await context.newPage()
      await member.goto(oldUrl)
      await expect(
        member.getByRole('heading', { name: 'You are already on this trip' }),
      ).toBeVisible()
      await member.close()
      const guest = await anonymous.newPage()
      await guest.goto(oldUrl)
      const signIn = guest.getByRole('link', { name: 'Sign in', exact: true })
      await expect(signIn).toBeVisible()
      const signInUrl = new URL(
        (await signIn.getAttribute('href')) ?? '',
        baseURL,
      )
      expect(signInUrl.pathname).toBe('/login')
      expect(signInUrl.searchParams.get('redirect')).toBe(
        new URL(oldUrl).pathname,
      )
      await page.reload()
      await settle(page, { name: 'people', path: peoplePath, ready: 'main' })
      await expect(
        panel.getByText('Nobody has joined through this link yet.'),
      ).toBeVisible()
      await panel
        .getByRole('button', { name: 'Replace link', exact: true })
        .click()
      const confirmation = page.getByRole('dialog', {
        name: 'Replace this link?',
      })
      await confirmation
        .getByRole('button', { name: 'Replace link', exact: true })
        .click()
      await expect(panel.getByRole('status')).toHaveText(
        'New invite link ready. Copy it and send it again.',
      )
      await expect(
        panel.getByRole('textbox', { name: 'Invite link', exact: true }),
      ).not.toHaveValue(oldUrl)
      const response = await guest.goto(oldUrl)
      expect(response?.status()).toBe(404)
      await expect(
        guest.getByRole('heading', {
          name: 'This invite link is not available',
        }),
      ).toBeVisible()
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.setViewportSize({ width: 360, height: 800 })
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true)
        await expect(panel.getByRole('switch')).toHaveAccessibleName(
          'Anyone in this workspace with the link can join',
        )
      }
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      )
      expect(
        await page.evaluate(() =>
          (window as unknown as Record<string, number[]>).__inviteShifts.reduce(
            (sum, value) => sum + value,
            0,
          ),
        ),
      ).toBe(0)
      expect(report().fatal).toEqual([])
    } finally {
      await anonymous.close()
      // This journey owns the new empty trip, including its link. Remove only its own fixture.
      await page.goto(`${baseURL}/trips`)
      await settle(page, { name: 'trips', path: '/trips', ready: 'main' })
      await page
        .getByRole('button', { name: `Actions for ${title}`, exact: true })
        .click()
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
      const deletion = page.getByRole('dialog')
      await deletion
        .getByRole('button', { name: 'Delete permanently', exact: true })
        .click()
      await expect(deletion).toBeHidden()
    }
  })
  test('keeps recovery headings visible below sticky navigation', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    await unblockCrossOriginFonts(page)
    await useSession(context, page, baseURL)
    await visit(page, { name: 'trips', path: '/trips', ready: 'main' }, 'light')
    const title = `Invite focus proof ${Date.now()}`
    await page
      .getByRole('button', { name: 'New trip', exact: true })
      .first()
      .click()
    const creation = page.getByRole('dialog')
    await creation.getByLabel('Trip name').fill(title)
    await creation
      .getByRole('button', { name: 'Create trip', exact: true })
      .click()
    await expect(page).toHaveURL(/\/trips\/[^/]+\/plan$/)
    const path = new URL(page.url()).pathname.replace(/\/plan$/, '/people')
    try {
      await visit(page, { name: 'people', path, ready: 'main' }, 'light')
      const panel = page.getByRole('region', {
        name: 'Invite link',
        exact: true,
      })
      await panel
        .getByRole('button', { name: 'Create link', exact: true })
        .click()
      await expect(
        panel.getByRole('button', { name: 'Copy link', exact: true }),
      ).toBeVisible()
      const heading = panel.getByRole('heading', {
        name: 'Invite link',
        exact: true,
      })
      const assertVisibleFocus = async () => {
        await expect(heading).toBeFocused()
        await expect
          .poll(() =>
            heading.evaluate((node) => {
              const rect = node.getBoundingClientRect()
              if (rect.top < 0 || rect.bottom > window.innerHeight) return false
              return [
                rect.top + 1,
                rect.top + rect.height / 2,
                rect.bottom - 1,
              ].every((y) => {
                const hit = document.elementFromPoint(
                  rect.left + rect.width / 2,
                  y,
                )
                return hit !== null && node.contains(hit)
              })
            }),
          )
          .toBe(true)
      }
      for (const viewport of [
        { width: 360, height: 800 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport)
        try {
          await context.setOffline(true)
          await panel.getByRole('switch').click()
          await expect(panel.getByRole('alert')).toBeVisible()
          await assertVisibleFocus()
          await test.info().attach(`recovery-error-${viewport.width}`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          })
        } finally {
          await context.setOffline(false)
        }
        await panel
          .getByRole('button', { name: 'Try again', exact: true })
          .click()
        await expect(
          panel.getByRole('button', { name: 'Copy link', exact: true }),
        ).toBeVisible()
        await assertVisibleFocus()
        await test.info().attach(`recovery-retry-${viewport.width}`, {
          body: await page.screenshot({ mask: [panel.getByRole('textbox')] }),
          contentType: 'image/png',
        })
      }
    } finally {
      await context.setOffline(false)
      await page.goto(`${baseURL}/trips`)
      await settle(page, { name: 'trips', path: '/trips', ready: 'main' })
      await page
        .getByRole('button', { name: `Actions for ${title}`, exact: true })
        .click()
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
      const deletion = page.getByRole('dialog')
      await deletion
        .getByRole('button', { name: 'Delete permanently', exact: true })
        .click()
      await expect(deletion).toBeHidden()
    }
  })
})
