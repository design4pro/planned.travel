import { expect, test } from '@playwright/test'
import { planRoute, tripIdByName } from './helpers/places-and-maps.ts'
import { useSession } from './helpers/session.ts'
import { visit } from './helpers/console.ts'
import { dayRegion, holdWeatherRead, BADGE } from './helpers/trip-weather.ts'

test('probe', async ({ context, page, baseURL }) => {
  test.setTimeout(120_000)
  await useSession(context, page, baseURL)
  const tripId = await tripIdByName(context, 'Lisbon, slowly')
  const p = await context.newPage()
  await p.addInitScript(() => {
    const w = window as any
    w.__who = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as any[]) {
        for (const s of e.sources ?? []) {
          const n = s.node as HTMLElement | null
          w.__who.push({ v: e.value, html: n?.outerHTML?.slice(0, 200), parent: n?.parentElement?.outerHTML?.slice(0, 160), conn: n?.isConnected, region: n?.closest('[role=region]')?.getAttribute('aria-label') })
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  const held = await holdWeatherRead(p)
  await visit(p, planRoute(tripId), 'light')
  await p.waitForTimeout(1500)
  held.release()
  await expect(dayRegion(p, 'Land and climb').getByRole('button', { name: BADGE.recorded })).toBeVisible()
  await p.waitForTimeout(1500)
  console.log('WHO', JSON.stringify(await p.evaluate(() => (window as any).__who), null, 1))
})
