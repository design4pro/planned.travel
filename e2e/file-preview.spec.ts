import { expect, test } from '@playwright/test'
import { hasSession, useSession } from './helpers/session'
import { watchConsole, unblockCrossOriginFonts } from './helpers/console'

// A browser owns row-hover hit testing, native download events and focus restoration.
test('Files preview and adjacent download', async ({
  context,
  page,
  baseURL,
}) => {
  test.setTimeout(120_000)
  await useSession(context, page, baseURL)
  expect(await hasSession(page)).toBe(true)
  const console = watchConsole(page, {
    name: 'file-preview',
    path: '/trips/demo-trip-01-tokyo-and-kyoto/files',
    ready: 'main',
  })
  await unblockCrossOriginFonts(page)
  await page.goto('/trips/demo-trip-01-tokyo-and-kyoto/files')
  const name = `preview-${test.info().project.name}-${Date.now()}.svg`
  const bytes =
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="teal"/></svg>'
  const chooserReady = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose files', exact: true }).click()
  const chooser = await chooserReady
  await chooser.setFiles({
    name,
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(bytes),
  })
  const opener = page
    .getByRole('button', { name, exact: true })
    .filter({ visible: true })
  await expect(opener).toBeVisible({ timeout: 30_000 })
  try {
    await opener.click()
    const dialog = page.getByRole('dialog', { name })
    const image = dialog.getByRole('img', { name })
    await expect(image).toBeVisible()
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(200)
    await expect(dialog.locator('iframe')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    if (!test.info().project.use.isMobile) await opener.hover()
    const control = page
      .getByRole('button', { name: `Download ${name}`, exact: true })
      .filter({ visible: true })
    await expect(control).toHaveCSS('opacity', '1')
    const downloaded = page.waitForEvent('download')
    await control.click()
    expect((await downloaded).suggestedFilename()).toBe(name)
  } finally {
    await page
      .getByRole('button', { name: `Actions for ${name}`, exact: true })
      .filter({ visible: true })
      .click()
    await page.getByRole('menuitem', { name: 'Remove', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Remove', exact: true })
      .click()
    await expect(opener).toHaveCount(0)
  }
  expect(console().fatal).toEqual([])
})
