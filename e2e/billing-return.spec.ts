import { expect, test } from '@playwright/test'
import { useSession } from './helpers/session'
import { settle } from './helpers/settle'

test('checkout automatic and manual local reads never send a Referer', async ({
  page,
  context,
  baseURL,
}) => {
  await useSession(context, page, baseURL)
  const reads: Array<{ url: string; referer: string | undefined }> = []
  page.on('request', (request) => {
    if (request.headers()['x-tsr-serverfn'] === 'true') {
      reads.push({ url: request.url(), referer: request.headers().referer })
    }
  })
  await page.goto(
    '/settings/billing?checkout=complete&checkout_id=foreign-checkout',
  )
  await settle(page, {
    name: 'billing',
    path: '/settings/billing',
    ready: 'main',
  })
  await expect(page.getByText('Checking billing status')).toBeVisible()
  // Automatic reads use the same RPC as Refresh; compare both actual browser requests.
  await expect
    .poll(() => reads.filter((read) => !read.referer).length)
    .toBeGreaterThan(0)
  const automatic = reads.find((read) => !read.referer)!
  await expect(
    page.getByRole('button', { name: 'Refresh', exact: true }),
  ).toBeEnabled()
  const manualRequest = page.waitForRequest(
    (request) => request.url() === automatic.url,
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  const manual = await manualRequest
  expect(manual.headers().referer).toBeFalsy()
  expect(automatic.referer).toBeFalsy()
  console.info(
    'billing local-read Referer:',
    JSON.stringify({
      automatic: automatic.referer ?? null,
      manual: manual.headers().referer ?? null,
    }),
  )
  expect(page.url()).toContain('checkout_id=foreign-checkout')
})
