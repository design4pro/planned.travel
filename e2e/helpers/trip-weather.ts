import { expect } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'

/**
 * What `e2e/trip-weather.spec.ts` needs to look at a day's weather the way a traveller does, and to
 * prove two things a traveller can only feel: that nothing moved when the answer arrived, and that
 * nothing was asked of a weather service to produce it.
 *
 * Nothing here reaches the Worker. The weather read is held and released from the browser's side of
 * the wire, the layout shifts are the browser's own account of itself, and the calls a vendor was
 * sent are read from the console's provider screen, which is where an operator would look.
 */

/** The hosts the Worker would call for a reading. The browser never should either. */
const WEATHER_HOSTS: ReadonlyArray<string> = [
  'api.met.no',
  'power.larc.nasa.gov',
]

/** The services whose call counts the provider screen is read for. */
export type WeatherVendor = 'met-norway' | 'nasa-power'

/** What a day's badge is called, by what it is. The first word is what a reader hears first. */
export const BADGE = {
  forecast: /^Forecast/,
  recorded: /^Recorded/,
  estimate: /^Estimate/,
} as const

export const NOT_YET_RECORDED = 'Not yet recorded'
export const UNAVAILABLE = 'Weather unavailable for this day'
export const LOADING = 'Loading weather'

/** The planner's section for one day, by the title its header carries. */
export function dayRegion(page: Page, title: string): Locator {
  const escaped = title.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  return page.getByRole('region', { name: new RegExp(`^${escaped}, `) })
}

/** A day's header button: the first button in its section, ahead of the weather badge. */
export function dayHeader(region: Locator): Locator {
  return region.getByRole('button').first()
}

/**
 * Hold the trip's weather read until `release()`, so the "before" of a before-and-after is a page
 * that is up and waiting, not a page that has not started.
 *
 * The read is a GET to `/_serverFn/<id>`, and the id is the base64 of the module and export that
 * serve it, so the request is recognised by the name of the function it calls and by nothing else.
 */
export async function holdWeatherRead(
  page: Page,
): Promise<{ readonly release: () => void }> {
  let release: () => void = () => undefined
  const open = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    (url) => {
      const id = url.pathname.split('/').at(-1) ?? ''
      return (
        url.pathname.startsWith('/_serverFn/') &&
        Buffer.from(id, 'base64url').toString().includes('loadTripWeatherFn')
      )
    },
    async (route) => {
      await open
      await route.continue()
    },
  )
  return { release }
}

/** The page's own list of layout shifts, as the browser reported them. */
const SHIFTS_KEY = '__ptLayoutShifts'

type LayoutShiftEntry = PerformanceEntry & {
  readonly value: number
  readonly hadRecentInput: boolean
}

/**
 * Start recording layout shifts from the first byte of the next navigation.
 *
 * `buffered` replays the shifts the browser recorded before the observer existed, and a shift that
 * follows the reader's own input is not recorded, as the Core Web Vitals definition has it.
 *
 * They are kept in the order they were reported, and a journey marks its place in that list rather
 * than a time: the suite fixes the page's clock, and a fixed clock does not agree with the
 * timestamps the browser puts on a shift.
 */
export async function countLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    const holder = window as unknown as Record<string, Array<number>>
    holder[key] = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as LayoutShiftEntry
        if (!shift.hadRecentInput) {
          holder[key].push(shift.value)
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  }, SHIFTS_KEY)
}

/** Two frames, so a shift the last change caused has been reported before it is read. */
async function afterTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

/**
 * Let the shell finish what it does on its own - fonts in, a frame or two of quiet - and return
 * how many shifts it caused. Those belong to the page loading, not to a weather answer.
 */
export async function shiftsSoFar(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready)
  await afterTwoFrames(page)
  return page.evaluate(
    (key) => (window as unknown as Record<string, Array<number>>)[key].length,
    SHIFTS_KEY,
  )
}

/** The sum of the shifts reported after the first `skip` of them (all of them, when omitted). */
export async function layoutShiftSum(page: Page, skip = 0): Promise<number> {
  await afterTwoFrames(page)
  return page.evaluate(
    ([key, from]) =>
      (window as unknown as Record<string, Array<number>>)[key]
        .slice(from)
        .reduce((sum, value) => sum + value, 0),
    [SHIFTS_KEY, skip] as const,
  )
}

/** Every request this page makes to a weather vendor, so the list can be asserted empty. */
export function watchVendorRequests(page: Page): () => ReadonlyArray<string> {
  const seen: Array<string> = []
  page.on('request', (request) => {
    if (WEATHER_HOSTS.includes(new URL(request.url()).hostname)) {
      seen.push(request.url())
    }
  })
  return () => seen
}

/**
 * How many calls each weather service has been sent this month, read where an operator reads it.
 *
 * The browser cannot see what the Worker calls, so the provider ledger is the network of the
 * server: every outbound call goes through one wrapper that counts it. The demo account is the
 * platform admin, which is why it can open the screen. A count is compared before and after rather
 * than against zero, because a database that has been used for something else is not empty.
 */
export async function vendorCalls(
  context: BrowserContext,
): Promise<Record<WeatherVendor, number>> {
  const page = await context.newPage()
  try {
    await page.goto('/console/providers', { waitUntil: 'domcontentloaded' })
    const main = page.getByRole('main')
    // The slug is also an option of the ceiling editor further down; the ledger row comes first.
    await expect(
      main.getByText('nasa-power', { exact: true }).first(),
    ).toBeVisible({ timeout: 30_000 })
    await expect(main.getByText(/this month/).first()).toBeVisible()
    const text = await main.innerText()
    const read = (vendor: WeatherVendor): number => {
      const match = new RegExp(`${vendor}[\\s\\S]*?([\\d,]+) this month`).exec(
        text,
      )
      if (match === null) {
        throw new Error(`/console/providers does not state calls for ${vendor}`)
      }
      return Number(match[1].replaceAll(',', ''))
    }
    return {
      'met-norway': read('met-norway'),
      'nasa-power': read('nasa-power'),
    }
  } finally {
    await page.close()
  }
}
