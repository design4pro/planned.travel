import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const context = await browser.newContext({
  storageState: 'e2e/.auth/demo.json', viewport: { width: 1440, height: 900 },
  colorScheme: 'light', locale: 'en-GB', timezoneId: 'UTC',
})
const page = await context.newPage()
await page.goto('http://localhost:3001/atlas', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)

for (const name of ['France', 'Netherlands']) {
  const box = page.locator('input[placeholder*="country" i], [role="combobox"] input, input[type="text"]').first()
  await box.click(); await page.waitForTimeout(300)
  await box.fill(name); await page.waitForTimeout(900)
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  // read the map centre from the page: hover dead centre and see which country resolves
  await page.mouse.move(720, 300, { steps: 6 }); await page.waitForTimeout(700)
  const centre = await page.evaluate(() => {
    const e = document.querySelector('[data-country]')
    return e ? (e.getAttribute('data-country') + ' :: ' + (e.textContent||'').trim().slice(0,60)) : 'NOTHING UNDER CENTRE (ocean)'
  })
  console.log(name, '-> centre of viewport:', centre)
  await page.screenshot({ path: `flyto-${name}.png` })
  await page.keyboard.press('Escape')
}
await browser.close()
