import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { useSession } from './helpers/session'
import { callsServerFn } from './helpers/server-fn'
import type { DashboardPayload } from '../src/routes/_app/-server/overview'

const { fromCrossJSON, toCrossJSONAsync } = createRequire(
  import.meta.resolve('@tanstack/react-start'),
)('seroval') as {
  fromCrossJSON: (
    value: unknown,
    options: { refs: Map<number, unknown> },
  ) => { result: DashboardPayload }
  toCrossJSONAsync: (value: unknown) => Promise<unknown>
}

async function emptyDashboardResponse(page: Page) {
  await page.route('**/_serverFn/**', async (route) => {
    const url = new URL(route.request().url())
    if (
      !callsServerFn(url, 'loadDashboard') ||
      callsServerFn(url, 'loadDashboardMascot')
    )
      return route.continue()
    const response = await route.fetch()
    const body = fromCrossJSON(await response.json(), { refs: new Map() })
    await route.fulfill({
      response,
      body: JSON.stringify(
        await toCrossJSONAsync({
          ...body,
          result: { ...body.result, upNext: null, elapsed: null, upcoming: [] },
        }),
      ),
    })
  })
}

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

async function openHydratedMascot(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('button', { name: 'Open travel chat' }),
  ).toBeVisible()
  await expect(page.locator('svg[data-band][data-moving]')).toBeAttached({
    timeout: 60_000,
  })
}

async function openReadyDashboard(page: Page) {
  await openHydratedMascot(page)
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

test('an empty featured-trip slot has no mascot stage or controls', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await page.goto('/settings/appearance')
  await emptyDashboardResponse(page)
  await page.getByRole('link', { name: 'planned.travel dashboard' }).click()
  await expect(
    page.getByRole('link', { name: 'Plan a trip', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'See your atlas', exact: true }),
  ).toBeVisible()
  await expect(page.locator('[data-mascot-stage]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Open travel chat' }),
  ).toHaveCount(0)
})

test('losing the last featured trip removes its panel and recovers keyboard focus', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await openReadyDashboard(page)
  const chat = page.getByRole('button', { name: 'Open travel chat' })
  await chat.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Travel chat is unavailable')).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).focus()
  await emptyDashboardResponse(page)
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  )
  await expect(page.locator('[data-mascot-stage]')).toHaveCount(0)
  await expect(page.getByText('Travel chat is unavailable')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Plan a trip', exact: true }),
  ).toBeFocused()
})

test('Nomi travels inside a stationary target and freezes for keyboard activation', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() =>
    localStorage.setItem('planned.mascot', 'playing'),
  )
  await openHydratedMascot(page)
  const chat = page.getByRole('button', { name: 'Open travel chat' })
  const bird = page.locator('svg[data-band]')
  await chat.scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  const segmentDurations = await bird.evaluate((node) => {
    const originalBand = node.getAttribute('data-band')
    const durations = []
    for (const band of ['settled', 'eager', 'countdown']) {
      node.setAttribute('data-band', band)
      const effect = node.getAnimations()[0]?.effect as KeyframeEffect
      const frames = effect.getKeyframes()
      const period = Number(effect.getTiming().duration)
      for (let index = 1; index < frames.length; index++) {
        if (frames[index].transform !== frames[index - 1].transform)
          durations.push(
            period *
              (frames[index].computedOffset - frames[index - 1].computedOffset),
          )
      }
    }
    node.setAttribute('data-band', originalBand!)
    return durations
  })
  expect(segmentDurations).toHaveLength(6)
  for (const duration of segmentDurations) {
    expect(duration).toBeGreaterThanOrEqual(150)
    expect(duration).toBeLessThanOrEqual(260)
  }
  const { target, samples } = await chat.evaluate(async (button) => {
    const illustration = button.querySelector('svg[data-band]')
    const animation = illustration?.getAnimations()[0]
    if (!illustration || !animation)
      throw new Error('Nomi travel animation did not start')
    const bounds = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }
    const initialBounds = bounds(button)
    const measurements = []
    for (const progress of [0, 0.35, 0.6, 0.85, 1]) {
      animation.currentTime =
        Number(animation.effect?.getTiming().duration) * progress
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      measurements.push({
        illustration: bounds(illustration),
        control: bounds(button),
      })
    }
    return { target: initialBounds, samples: measurements }
  })
  for (const sample of samples) {
    expect(sample.illustration.x).toBeGreaterThanOrEqual(target.x - 1)
    expect(
      sample.illustration.x + sample.illustration.width,
    ).toBeLessThanOrEqual(target.x + target.width + 1)
    expect(sample.control).toEqual(target)
  }
  const positions = samples.map((sample) => sample.illustration.x)
  expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(30)
  await chat.focus()
  await expect(chat).toBeFocused()
  await expect(bird).toHaveCSS('animation-play-state', 'paused')
  const heldTime = await bird.evaluate(async (node) => {
    const animation = node.getAnimations()[0]
    if (!animation)
      throw new Error('Nomi travel animation disappeared on focus')
    await animation.ready
    return animation.currentTime
  })
  await expect(page.locator('.pt-mascot-reaction')).not.toHaveCSS(
    'transform',
    'none',
  )
  expect(
    await bird.evaluate((node) => node.getAnimations()[0]?.currentTime),
  ).toBe(heldTime)
  await page.keyboard.press('Enter')
  await expect(page.getByText('Travel chat is unavailable')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(chat).toBeFocused()
})

test('live motion preferences and hidden tabs stop both illustration loops', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() =>
    localStorage.setItem('planned.mascot', 'playing'),
  )
  await openHydratedMascot(page)
  await page.mouse.move(0, 0)
  const bird = page.locator('svg[data-band]')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(bird).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.pt-mascot-pose')).toHaveCSS('transform', 'none')
  await expect(page.locator('.pt-mascot-reaction')).toHaveCSS(
    'transform',
    'none',
  )
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(bird).toHaveCSS('animation-name', /^pt-mascot-travel/)
  const pause = page.getByRole('button', { name: 'Pause animation' })
  await pause.focus()
  await expect(bird).toHaveCSS('animation-play-state', 'running')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(bird).toHaveCSS('animation-play-state', 'paused')
  await expect(page.locator('.pt-mascot-pose')).toHaveCSS(
    'animation-play-state',
    'paused',
  )
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'visibilityState')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(bird).toHaveCSS('animation-play-state', 'running')
})

for (const preference of ['paused', 'playing'] as const) {
  test(`restores the stored ${preference} preference before starting motion`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, page, baseURL)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.addInitScript(
      (stored) => localStorage.setItem('planned.mascot', stored),
      preference,
    )
    await openHydratedMascot(page)
    const bird = page.locator('svg[data-band][data-moving]')
    await page.mouse.move(0, 0)
    const pose = page.locator('.pt-mascot-pose')
    const pause = page.getByRole('button', { name: 'Pause animation' })
    const pressed = preference === 'paused'
    await expect(pause).toHaveAttribute('aria-pressed', String(pressed))
    await expect(bird).toHaveCSS(
      'animation-play-state',
      pressed ? 'paused' : 'running',
    )
    await expect(pose).toHaveCSS(
      'animation-play-state',
      pressed ? 'paused' : 'running',
    )
    await pause.click()
    await page.mouse.move(0, 0)
    await expect(pause).toHaveAttribute('aria-pressed', String(!pressed))
    expect(
      await page.evaluate(() => localStorage.getItem('planned.mascot')),
    ).toBe(pressed ? 'playing' : 'paused')
    await expect(bird).toHaveCSS(
      'animation-play-state',
      pressed ? 'running' : 'paused',
    )
    await expect(pose).toHaveCSS(
      'animation-play-state',
      pressed ? 'running' : 'paused',
    )
  })
}
