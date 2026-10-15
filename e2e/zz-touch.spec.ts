import { devices, expect, test } from '@playwright/test'
import { useSession } from './helpers/session.ts'
import { SEEDED_TRIPS, tripIdByName } from './helpers/places-and-maps.ts'

test.use({ ...devices['Pixel 7'] })
test('hint hidden on touch', async ({ context, page, baseURL }) => {
  await useSession(context, page, baseURL)
  const tripId = await tripIdByName(context, SEEDED_TRIPS.single)
  await page.goto(`/trips/${tripId}/files`)
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeVisible()
  console.log('MEDIA', await page.evaluate(() => [matchMedia('(hover: none)').matches, matchMedia('(pointer: coarse)').matches].join()))
  await expect(page.locator('[data-part="file-paste-hint"]')).toBeHidden()
})
