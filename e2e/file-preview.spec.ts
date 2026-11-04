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
  const failures: unknown[] = []
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
    const opened = page.waitForEvent('popup')
    await page.evaluate((url) => window.open(url, '_blank'), source)
    const nativeTab = await opened
    try {
      await nativeTab.waitForLoadState('load')
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
  } catch (error) {
    failures.push(error)
  } finally {
    try {
      const dialog = page.getByRole('dialog', { name })
      if (await dialog.isVisible()) await page.keyboard.press('Escape')
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
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length > 0)
    throw new AggregateError(failures, 'Preview or cleanup failed')
  expect(console().fatal).toEqual([])
})

for (const format of ['text', 'pdf'] as const) {
  test(`Escape closes a focused ${format} preview`, async ({
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
    const name = `preview-${format}-${test.info().project.name}-${Date.now()}.${format === 'pdf' ? 'pdf' : 'txt'}`
    await page.locator('input[type="file"]').setInputFiles({
      name,
      mimeType: format === 'pdf' ? 'application/pdf' : 'text/plain',
      buffer:
        format === 'pdf' ? readablePdf() : Buffer.from('Boarding details'),
    })
    const opener = page
      .getByRole('button', { name, exact: true })
      .filter({ visible: true })
    await expect(opener).toBeVisible({ timeout: 30_000 })
    try {
      await opener.click()
      const dialog = page.getByRole('dialog', { name })
      const text =
        format === 'pdf'
          ? dialog
              .locator('.textLayer')
              .getByText('Boarding details', { exact: true })
              .first()
          : dialog
              .locator('iframe')
              .contentFrame()
              .getByText('Boarding details', { exact: true })
      await text.click()
      if (format === 'pdf') {
        await expect(dialog.locator('canvas').first()).toBeVisible()
        await text.evaluate((element) => {
          const range = document.createRange()
          range.selectNodeContents(element)
          window.getSelection()?.removeAllRanges()
          window.getSelection()?.addRange(range)
        })
        expect(
          await page.evaluate(() => window.getSelection()?.toString()),
        ).toBe('Boarding details')
        const reader = dialog.getByRole('document', { name })
        await reader.focus()
        await page.keyboard.press('End')
        await expect
          .poll(() => reader.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(0)
      }
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
}

function readablePdf() {
  const stream = 'BT /F1 18 Tf 40 740 Td (Boarding details) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 3 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.7\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}
