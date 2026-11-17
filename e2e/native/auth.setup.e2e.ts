import { test } from '@e2e-dev/web'
import { credentials, expect } from 'e2e'
import { waitForHydration } from './helpers/readiness'
import { callsServerFn } from '../helpers/server-fn'

test.setup(
  'authenticate the seeded owner',
  { sessions: ['owner'] },
  async ({ app, browser, screen, session }) => {
    await app.open('/login')
    await waitForHydration(browser, 'form')
    await screen
      .getByLabel('Email address')
      .fill(credentials.user('demo').username)
    await screen
      .getByLabel('Password', { exact: true })
      .fill(credentials.user('demo').password)
    await screen.getByRole('button', 'Sign in', { exact: true }).tap()
    await expect(browser).toHaveURL(/\/dashboard(?:\?|$)/)

    // A previous exploratory session may have changed the persisted language.
    await app.open('/settings/language')
    await waitForHydration(browser)
    const workspace = screen.getByTestId('locale-chip-workspace')
    await workspace.waitFor()
    if ((await workspace.getAttribute('data-selected')) === null) {
      let saved = false
      await browser.route('**/_serverFn/**', async (route) => {
        if (
          route.request.method !== 'POST' ||
          !callsServerFn(new URL(route.request.url), 'saveLanguagePreference')
        ) {
          await route.fallback()
          return
        }
        const response = await route.fetch()
        await route.fulfill({
          status: response.status,
          headers: response.headers,
          body: await response.body(),
        })
        saved = true
      })
      await workspace.tap()
      await expect.poll(() => saved, { timeout: 15_000 }).toBe(true)
      await browser.unrouteAll()
      await browser.reload()
    }
    await expect(workspace).toHaveAttribute('data-selected', '')
    expect(await browser.evaluate(() => document.documentElement.lang)).toBe(
      'en',
    )
    await session.save('owner')
  },
)
