import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { useSession } from './helpers/session'
import { callsServerFn } from './helpers/server-fn'

async function expectUnobscured(control: Locator) {
  await expect(control).toBeFocused()
  expect(
    await control.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      const target = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      )
      return target !== null && node.contains(target)
    }),
  ).toBe(true)
}

test('dashboard refresh failure focuses recovery and retry rechecks access', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await page.goto('/dashboard')
  await expect(
    page.getByRole('button', { name: 'Open travel chat' }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')
  let blocked = true
  let attempts = 0
  await page.route('**/_serverFn/**', async (route) => {
    const url = new URL(route.request().url())
    if (
      blocked &&
      callsServerFn(url, 'loadDashboard') &&
      !callsServerFn(url, 'loadDashboardMascot')
    ) {
      attempts += 1
      await route.abort('failed')
      return
    }
    await route.continue()
  })
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  )
  const error = page.getByRole('group', { name: 'The dashboard did not load' })
  await expect(error).toBeFocused()
  const retry = error.getByRole('button', { name: 'Try again' })
  const firstError = await error.elementHandle()
  expect(firstError).not.toBeNull()
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(2)
  await expect
    .poll(() => firstError?.evaluate((node) => node.isConnected))
    .toBe(false)
  await expect(error).toBeFocused()
  blocked = false
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Open travel chat' }),
  ).toBeFocused()
})

test('dashboard chat and layout remain usable on small screens', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000)
  await useSession(context, page, baseURL)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const chat = page.getByRole('button', { name: 'Open travel chat' })
  await expect(chat).toBeVisible()
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 })
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${width}.png`),
      fullPage: true,
    })
  }
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('svg[data-band][data-moving]')).toBeAttached({
      timeout: 60_000,
    })
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      if (await chat.evaluate((node) => node === document.activeElement)) break
    }
    await expectUnobscured(chat)
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { name: 'Travel chat is unavailable' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(chat).toBeFocused()
    await page.keyboard.press('Space')
    await expect(
      page.getByRole('heading', { name: 'Travel chat is unavailable' }),
    ).toBeVisible()
    const controls = [
      page.getByRole('button', { name: 'Pause animation' }),
      page
        .getByRole('link', {
          name: /^(View reservations|View trip plan|Open notifications)$/,
        })
        .first(),
      page.getByRole('button', { name: 'Dismiss' }),
      page.getByRole('link', { name: 'Open notifications' }),
      page.getByRole('button', { name: 'Close', exact: true }),
    ]
    for (const control of controls) {
      await page.keyboard.press('Tab')
      await expectUnobscured(control)
    }
    await page.keyboard.press('Escape')
    await expect(chat).toBeFocused()
  }
  const plan = page.getByRole('link', { name: 'Open the plan' })
  await expect(plan).toBeVisible()
  const initial = await plan.boundingBox()
  expect(initial).not.toBeNull()
  await chat.click()
  await expect(page.getByText('Travel chat is unavailable')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open notifications' }),
  ).toHaveAttribute('href', '/notifications')
  await page.keyboard.press('Escape')
  await expect(chat).toBeFocused()
  const after = await plan.boundingBox()
  expect(Math.abs((after?.y ?? 0) - (initial?.y ?? 0))).toBeLessThan(2)
  await plan.evaluate((node) => {
    node.style.transition = 'none'
    node.style.transform = 'translateY(20px)'
  })
  const shifted = await plan.boundingBox()
  expect(Math.abs((shifted?.y ?? 0) - (initial?.y ?? 0))).toBeGreaterThan(10)
})
