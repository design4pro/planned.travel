import { expect, test } from '@playwright/test'
import { hasSession, useSession } from './helpers/session'
import { settle } from './helpers/settle'
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
  const route = {
    name: 'file-preview',
    path: '/trips/demo-trip-01-tokyo-and-kyoto/files',
    ready: '[data-part="file-drop"]',
  }
  const console = watchConsole(page, route)
  await unblockCrossOriginFonts(page)
  await page.goto(route.path)
  // This journey creates current-dated files, so keep the browser and server clocks together.
  await settle(page, route)
  const name = `preview-${test.info().project.name}-${Date.now()}.svg`
  await page.evaluate(() => localStorage.removeItem('preview-svg-executed'))
  const bytes =
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><script>localStorage.setItem("preview-svg-executed", "yes")</script><rect width="200" height="100" fill="teal"/></svg>'
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
  const control = page
    .getByRole('button', { name: `Download ${name}`, exact: true })
    .filter({ visible: true })
  if (test.info().project.use.isMobile) {
    await expect(control).toHaveCSS('opacity', '1')
  } else {
    await page.mouse.move(0, 0)
    await expect(control).toHaveCSS('opacity', '0')
    await opener.hover()
    await expect(control).toHaveCSS('opacity', '1')
  }
  try {
    await opener.click()
    const dialog = page.getByRole('dialog', { name })
    const image = dialog.getByRole('img', { name })
    await expect(image).toBeVisible()
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(200)
    await expect(dialog.locator('iframe')).toHaveCount(0)
    // Native “Open image in new tab” navigates directly to the exposed image source.
    const source = await image.getAttribute('src')
    if (source === null) throw new Error('Missing image source')
    const nativeTab = await context.newPage()
    try {
      await nativeTab.goto(source)
      expect(await nativeTab.evaluate(() => document.contentType)).toBe(
        'image/png',
      )
      expect(
        await page.evaluate(() => localStorage.getItem('preview-svg-executed')),
      ).toBeNull()
    } finally {
      await nativeTab.close()
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    if (!test.info().project.use.isMobile) await opener.hover()
    await expect(control).toHaveCSS('opacity', '1')
    const downloaded = page.waitForEvent('download')
    await control.click()
    expect((await downloaded).suggestedFilename()).toBe(name)
  } finally {
    await page
      .getByRole('button', { name: `Actions for ${name}`, exact: true })
      .filter({ visible: true })
      .click()
    await page
      .getByRole('menuitem', { name: 'Remove file', exact: true })
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Remove file', exact: true })
      .click()
    await expect(opener).toHaveCount(0)
  }
  expect(console().fatal).toEqual([])
})

test('Escape closes a focused plain-text preview', async ({
  context,
  page,
  baseURL,
}) => {
  test.setTimeout(120_000)
  await useSession(context, page, baseURL)
  expect(await hasSession(page)).toBe(true)
  const route = {
    name: 'text-preview',
    path: '/trips/demo-trip-01-tokyo-and-kyoto/files',
    ready: '[data-part="file-drop"]',
  }
  const console = watchConsole(page, route)
  await unblockCrossOriginFonts(page)
  await page.goto(route.path)
  await settle(page, route)
  const name = `preview-text-${test.info().project.name}-${Date.now()}.txt`
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('Boarding details'),
    })
  const opener = page
    .getByRole('button', { name, exact: true })
    .filter({ visible: true })
  await expect(opener).toBeVisible({ timeout: 30_000 })
  try {
    await opener.click()
    const dialog = page.getByRole('dialog', { name })
    const text = dialog
      .locator('iframe')
      .contentFrame()
      .getByText('Boarding details', { exact: true })
    await text.click()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  } finally {
    await page
      .getByRole('button', { name: `Actions for ${name}`, exact: true })
      .filter({ visible: true })
      .click()
    await page
      .getByRole('menuitem', { name: 'Remove file', exact: true })
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Remove file', exact: true })
      .click()
    await expect(opener).toHaveCount(0)
  }
  expect(console().fatal).toEqual([])
})
