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
