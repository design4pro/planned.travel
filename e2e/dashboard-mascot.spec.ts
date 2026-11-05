import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
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

async function openReadyDashboard(page: Page) {
  const refreshed = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      callsServerFn(url, 'loadDashboard') &&
      !callsServerFn(url, 'loadDashboardMascot')
    )
  })
  await page.goto('/dashboard')
  await expect(
    page.getByRole('button', { name: 'Open travel chat' }),
  ).toBeVisible()
  await expect(page.locator('svg[data-band][data-moving]')).toBeAttached({
    timeout: 60_000,
  })
  await refreshed
  await page.waitForLoadState('networkidle')
}

test('dashboard refresh failure focuses recovery and retry rechecks access', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await openReadyDashboard(page)
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
  await expect
    .poll(async () => {
      if (attempts === 0)
        await page.evaluate(() =>
          document.dispatchEvent(new Event('visibilitychange')),
        )
      return attempts
    })
    .toBeGreaterThanOrEqual(1)
  const error = page.getByRole('group', { name: 'The dashboard did not load' })
  await expect(error).toBeFocused()
  const retry = error.getByRole('button', { name: 'Try again' })
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(2)
  await expect(error).toBeFocused()
  blocked = false
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Open travel chat' }),
  ).toBeFocused()
})

test('a delayed failed retry does not take focus back from the shell', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await openReadyDashboard(page)
  let attempts = 0
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/_serverFn/**', async (route) => {
    const url = new URL(route.request().url())
    if (
      callsServerFn(url, 'loadDashboard') &&
      !callsServerFn(url, 'loadDashboardMascot')
    ) {
      attempts += 1
      if (attempts > 1) await held
      await route.abort('failed')
      return
    }
    await route.continue()
  })
  await expect
    .poll(async () => {
      if (attempts === 0)
        await page.evaluate(() =>
          document.dispatchEvent(new Event('visibilitychange')),
        )
      return attempts
    })
    .toBeGreaterThanOrEqual(1)
  const error = page.getByRole('group', { name: 'The dashboard did not load' })
  await expect(error).toBeFocused()
  await error.getByRole('button', { name: 'Try again' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(2)
  const theme = page.getByRole('button', { name: /^Theme:/ })
  await theme.focus()
  release()
  await page.waitForLoadState('networkidle')
  await expect(error).toBeVisible()
  await expect(theme).toBeFocused()
})

test('a delayed successful retry respects a click outside recovery', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await openReadyDashboard(page)
  let attempts = 0
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/_serverFn/**', async (route) => {
    const url = new URL(route.request().url())
    if (
      callsServerFn(url, 'loadDashboard') &&
      !callsServerFn(url, 'loadDashboardMascot')
    ) {
      attempts += 1
      if (attempts === 1) {
        await route.abort('failed')
        return
      }
      await held
    }
    await route.continue()
  })
  await expect
    .poll(async () => {
      if (attempts === 0)
        await page.evaluate(() =>
          document.dispatchEvent(new Event('visibilitychange')),
        )
      return attempts
    })
    .toBeGreaterThanOrEqual(1)
  const error = page.getByRole('group', { name: 'The dashboard did not load' })
  await expect(error).toBeFocused()
  await error.getByRole('button', { name: 'Try again' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(2)
  await page.getByRole('banner').click({ position: { x: 4, y: 4 } })
  release()
  const chat = page.getByRole('button', { name: 'Open travel chat' })
  await expect(chat).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(chat).not.toBeFocused()
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
