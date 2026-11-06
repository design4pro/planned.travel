import { expect, test } from '@playwright/test'

test('feedback returns focus after Cancel and Escape @chromium-only', async ({
  page,
}) => {
  test.skip(
    !process.env.VITE_SENTRY_DSN,
    'Feedback requires a configured Sentry DSN',
  )
  await page.goto('/login')
  const trigger = page.getByRole('button', { name: 'Report a problem' })
  const cancel = page.getByRole('button', { name: 'Cancel' })
  await expect(trigger).toBeVisible({ timeout: 45_000 })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(cancel).toBeVisible()
  await cancel.click()
  await expect
    .poll(() =>
      trigger.evaluate(
        (el) => (el.getRootNode() as ShadowRoot).activeElement === el,
      ),
    )
    .toBe(true)
  await page.keyboard.press('Enter')
  await expect(cancel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(cancel).toBeHidden()
  await expect
    .poll(() =>
      trigger.evaluate(
        (el) => (el.getRootNode() as ShadowRoot).activeElement === el,
      ),
    )
    .toBe(true)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await trigger.click()
  await expect(cancel).toBeVisible()
})
