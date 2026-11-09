import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { useSession } from './helpers/session'
import { settle } from './helpers/settle'
import { callsServerFn } from './helpers/server-fn'
import Shell from '../src/lib/i18n/messages/en/shell'
import ArabicShell from '../src/lib/i18n/messages/ar/shell'
import type { DashboardPayload } from '../src/routes/_app/-server/overview'
import type { Page } from '@playwright/test'

const { fromCrossJSON, toCrossJSONAsync } = createRequire(
  import.meta.resolve('@tanstack/react-start'),
)('seroval') as {
  fromCrossJSON: (
    value: unknown,
    options: { refs: Map<number, unknown> },
  ) => {
    result: DashboardPayload
  }
  toCrossJSONAsync: (value: unknown) => Promise<unknown>
}

const KEY = 'planned.wide-layout'
const well = (page: Page) => page.locator('main.app-content-width')

async function open(page: Page, path: '/settings/appearance' | '/dashboard') {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await settle(page, {
    name: 'wide-layout',
    path,
    ready:
      path === '/settings/appearance'
        ? '[aria-label="Wide layout"]'
        : '.dashboard-layout',
  })
}

async function remember(page: Page, enabled: boolean) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, String(value)),
    { key: KEY, value: enabled },
  )
}

async function expectAligned(page: Page) {
  const hero = await page.locator('.dashboard-hero').boundingBox()
  const rail = await page.locator('.dashboard-rail').boundingBox()
  expect(hero).not.toBeNull()
  expect(rail).not.toBeNull()
  expect(Math.abs((hero?.y ?? 0) - (rail?.y ?? 0))).toBeLessThan(1)
}

test.beforeEach(async ({ page, context, baseURL }) => {
  expect(await useSession(context, page, baseURL)).toBe(true)
})

test('appearance keyboard switch widens the authenticated shell and restores its cap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await open(page, '/settings/appearance')
  const control = page.getByRole('switch', { name: 'Wide layout' })
  await expect(control).not.toBeChecked()
  expect((await well(page).boundingBox())?.width).toBe(1440)
  await control.focus()
  await page.keyboard.press('Space')
  await expect(control).toBeChecked()
  expect((await well(page).boundingBox())?.width).toBe(2560)
  for (const row of await page.locator('.app-content-width').all()) {
    expect((await row.boundingBox())?.width).toBe(2560)
  }
  await expect(control).toBeFocused()
  await page.keyboard.press('Space')
  await expect(control).not.toBeChecked()
  expect((await well(page).boundingBox())?.width).toBe(1440)
})

test('saved wide mode aligns populated dashboard widgets through reload without hydration errors', async ({
  page,
}) => {
  const hydration: string[] = []
  page.on('console', (message) => {
    if (/hydrat|didn't match|does not match/i.test(message.text()))
      hydration.push(message.text())
  })
  page.on('pageerror', (error) => hydration.push(error.message))
  await page.setViewportSize({ width: 2560, height: 1440 })
  await open(page, '/settings/appearance')
  await page.getByRole('switch', { name: 'Wide layout' }).check()
  await open(page, '/dashboard')
  await expect(page.locator('.dashboard-hero h1')).toBeVisible()
  await expectAligned(page)
  await expect(
    page.locator('[data-part="dashboard-widget-clock"]'),
  ).toHaveCount(1)
  await expect(page.locator('.dashboard-stats')).not.toBeEmpty()
  expect((await well(page).boundingBox())?.width).toBe(2560)
  await page.reload()
  await expectAligned(page)
  expect(hydration).toEqual([])
})

test('same-origin tabs update both layout effects and keep the widget restoration menu', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await open(page, '/dashboard')
  const settings = await context.newPage()
  try {
    await open(settings, '/settings/appearance')
    const control = settings.getByRole('switch', { name: 'Wide layout' })
    await control.check()
    await expect(page.locator('html')).toHaveAttribute('data-wide-layout', '')
    await expectAligned(page)
    await control.uncheck()
    await expect(page.locator('html')).not.toHaveAttribute('data-wide-layout')
    expect((await well(page).boundingBox())?.width).toBe(1440)
    await page.getByRole('button', { name: 'Choose widgets' }).click()
    const widgets = page.getByRole('menuitemcheckbox')
    for (const widget of await widgets.all()) await widget.click()
    await expect(page.locator('.dashboard-rail')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Choose widgets' }),
    ).toBeVisible()
  } finally {
    await settings.close()
  }
})

test('storage denied still permits reversible switching for the current page', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('denied')
      },
    })
  })
  await open(page, '/settings/appearance')
  const control = page.getByRole('switch', { name: 'Wide layout' })
  await control.check()
  await expect(page.locator('html')).toHaveAttribute('data-wide-layout', '')
  await control.uncheck()
  await expect(page.locator('html')).not.toHaveAttribute('data-wide-layout')
})

for (const width of [360, 1280, 2560]) {
  test(`wide dashboard remains reachable in dark mode at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await open(page, '/settings/appearance')
    await remember(page, true)
    await open(page, '/dashboard')
    await expect(
      page.getByRole('button', { name: 'Choose widgets' }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    if (width < 768) {
      await page.getByRole('button', { name: 'Reference', exact: true }).click()
      await expect(
        page.locator('[data-part="dashboard-widgets-sheet"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-part="dashboard-widget-clock"]'),
      ).toHaveCount(1)
      await page.keyboard.press('Escape')
    } else {
      await expect(
        page.locator('[data-part="dashboard-widgets-column"]'),
      ).toBeVisible()
      await expectAligned(page)
    }
  })
}

test('wide preference leaves public reading widths and full-bleed atlas geometry unchanged', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await page.goto('/pricing')
  const reading = page.locator('main .max-w-content').first()
  const publicWidth = await reading.boundingBox()
  expect(publicWidth?.width).toBe(1440)
  await remember(page, true)
  await page.reload()
  expect(await reading.boundingBox()).toEqual(publicWidth)
  await page.goto('/atlas')
  const atlas = await page.locator('main').boundingBox()
  await remember(page, false)
  await page.reload()
  expect(await page.locator('main').boundingBox()).toEqual(atlas)
})

test('saved composition is already applied while application hydration is held', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await open(page, '/settings/appearance')
  await remember(page, true)
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await held
    await route.continue()
  })
  try {
    await page.goto('/dashboard', { waitUntil: 'commit' })
    await expect(page.locator('.dashboard-main')).toHaveCSS('display', 'flex')
    await expect(well(page)).toHaveCSS('max-width', 'none')
    await expectAligned(page)
    expect(
      await page
        .locator('.dashboard-layout')
        .evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith('__reactFiber$')),
        ),
    ).toBe(false)
  } finally {
    release()
  }
  await page.waitForLoadState('networkidle')
  await settle(page, {
    name: 'wide-layout',
    path: '/dashboard',
    ready: '.dashboard-layout',
  })
  await expectAligned(page)
})

test('wide dashboard controls follow the Arabic catalogue at all three widths', async ({
  page,
}) => {
  await open(page, '/settings/appearance')
  await page.getByRole('switch', { name: 'Wide layout' }).check()
  await page.goto('/settings/language', { waitUntil: 'networkidle' })
  await settle(page, {
    name: 'language',
    path: '/settings/language',
    ready: '[data-testid="locale-chip-ar"]',
  })
  // Keep the locale scenario inside this browser context; other workers share the demo account.
  await page.route('**/_serverFn/**', async (route) => {
    const url = new URL(route.request().url())
    if (callsServerFn(url, 'saveLanguagePreference'))
      return route.fulfill({ json: { result: { locale: 'ar' } } })
    if (callsServerFn(url, 'negotiateRequestLocale'))
      return route.fulfill({
        json: { result: { locale: 'ar', dir: 'rtl', signedIn: true } },
      })
    return route.continue()
  })
  await page.getByTestId('locale-chip-ar').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page
    .getByRole('link', { name: ArabicShell['nav.dashboardLink'] })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.dashboard-layout')).toBeVisible()
  for (const width of [2560, 1280, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(
      page.locator('[data-part="dashboard-widgets-menu"]'),
    ).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    if (width < 768) {
      const trigger = page.locator('[data-part="dashboard-widgets-trigger"]')
      await trigger.focus()
      await page.keyboard.press('Enter')
      await expect(
        page.locator('[data-part="dashboard-widgets-sheet"]'),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
    } else {
      await expectAligned(page)
    }
  }
})

test('empty upcoming-trip state keeps the wide composition', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await open(page, '/settings/appearance')
  await page.getByRole('switch', { name: 'Wide layout' }).check()
  // Client navigation lets the same response fixture work in dev and compiled E2E previews.
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
  try {
    await page.getByRole('link', { name: 'planned.travel dashboard' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.dashboard-hero h1')).toHaveText(
      Shell['dashboard.blank.title'],
    )
    await expectAligned(page)
  } finally {
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('client navigation reserves the wide pending composition before the payload arrives', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await open(page, '/settings/appearance')
  await page.getByRole('switch', { name: 'Wide layout' }).check()
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/_serverFn/**', async (route) => {
    const url = new URL(route.request().url())
    if (
      callsServerFn(url, 'loadDashboard') &&
      !callsServerFn(url, 'loadDashboardMascot')
    )
      await held
    await route.continue()
  })
  try {
    await page.getByRole('link', { name: 'planned.travel dashboard' }).click()
    await expect(
      page.locator('.dashboard-hero [aria-busy="true"]'),
    ).toBeVisible()
    await expectAligned(page)
  } finally {
    release()
  }
  await expect(page.locator('.dashboard-hero h1')).toBeVisible()
  await expectAligned(page)
})

test('the stacked tablet widgets retain their existing gap above trips', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 1000 })
  await open(page, '/dashboard')
  const rail = await page.locator('.dashboard-rail').boundingBox()
  const trips = await page.locator('.dashboard-trips').boundingBox()
  expect(rail).not.toBeNull()
  expect(trips).not.toBeNull()
  expect((trips?.y ?? 0) - ((rail?.y ?? 0) + (rail?.height ?? 0))).toBe(24)
})
