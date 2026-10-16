import { expect, test } from '@playwright/test'
import { useSession, hasSession } from './helpers/session'
import { watchConsole } from './helpers/console'
import { settleMutations } from './helpers/settle'

test.describe('07-S2 - Collaboration sections follow the viewport', () => {
  test('keeps only enabled tabs on a phone and shows every panel at xl', async ({
    context,
    page,
    baseURL,
  }) => {
    await useSession(context, page, baseURL)
    expect(await hasSession(page)).toBe(true)
    await page.goto('/trips')
    const trip = page
      .locator('a[href^="/trips/"][href$="/plan"]:visible')
      .first()
    await expect(trip).toBeVisible()
    const href = await trip.getAttribute('href')
    expect(href).toBeTruthy()
    const path = href?.replace(/\/plan$/, '/collab') ?? ''
    const consoleReport = watchConsole(page, {
      name: 'collaboration',
      path,
      ready: 'main',
    })
    await page.goto(path)
    await settleMutations(page)
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
    const wasOn = (await polls.getAttribute('aria-checked')) === 'true'
    try {
      if (wasOn) await polls.click()
      await expect(polls).toHaveAttribute('aria-checked', 'false')
      await page.keyboard.press('Escape')
      await page.reload()
      await settleMutations(page)
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
      expect(consoleReport().fatal).toEqual([])
    } finally {
      await page.keyboard.press('Escape')
      await menu.click()
      if (((await polls.getAttribute('aria-checked')) === 'true') !== wasOn)
        await polls.click()
      await expect(polls).toHaveAttribute('aria-checked', String(wasOn))
      await page.keyboard.press('Escape')
    }
  })
})
