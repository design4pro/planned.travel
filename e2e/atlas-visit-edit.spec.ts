import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { visit } from './helpers/console'
import { useSession } from './helpers/session'
import { settle } from './helpers/settle'

const route = {
  name: 'atlas-visit-edit',
  path: '/atlas',
  ready: 'main',
  map: true,
} as const
async function selectFrance(page: Page) {
  await page.getByRole('button', { name: 'Find a country' }).click()
  await page.getByRole('combobox', { name: 'Find a country' }).fill('France')
  await page.getByRole('option', { name: 'France' }).first().click()
  return page.locator(
    '[data-part="country-panel"] [data-part="country-visit-editor"]',
  )
}

test.describe('Atlas visit corrections @chromium-only', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  test.beforeEach(async ({ context, page, baseURL }) => {
    await useSession(context, page, baseURL)
  })
  for (const width of [360, 1280]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`edits, clears and restores a visit at ${width} in ${theme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: width === 360 ? 800 : 900 })
        await visit(page, route, theme)
        let editor = await selectFrance(page)
        await editor.getByRole('button', { name: 'Edit visit' }).click()
        const first = editor.getByLabel('First visit')
        const last = editor.getByLabel('Last visit')
        const note = editor.getByLabel('Note', { exact: true })
        await expect(first).toBeVisible()
        const facts = page.locator(
          '[data-part="country-panel"] > div > article > dl',
        )
        if (width === 360) await expect(facts).toBeHidden()
        else await expect(facts).toBeVisible()
        await expect(
          page
            .locator('[data-part="country-panel"]')
            .getByRole('heading', { name: 'France', level: 3 }),
        ).toBeVisible()
        await first.focus()
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(first).toBeFocused()
        const original = {
          first: await first.inputValue(),
          last: await last.inputValue(),
          note: await note.inputValue(),
        }
        async function save(
          firstValue: string,
          lastValue: string,
          noteValue: string,
        ) {
          await editor.getByLabel('First visit').fill(firstValue)
          await editor.getByLabel('Last visit').fill(lastValue)
          await editor.getByLabel('Note', { exact: true }).fill(noteValue)
          await editor.getByRole('button', { name: 'Save visit' }).focus()
          await page.keyboard.press('Enter')
          await expect(
            editor.getByRole('button', { name: 'Edit visit' }),
          ).toBeVisible()
        }
        try {
          await save(
            '2024-02-29',
            '2025-08-01',
            'Atlas visit correction journey',
          )
          await expect(
            page.locator(
              '[data-part="country-panel"] time[datetime="2024-02"]',
            ),
          ).toBeVisible()
          await editor.getByRole('button', { name: 'Edit visit' }).click()
          await expect(editor.getByLabel('Note', { exact: true })).toHaveValue(
            'Atlas visit correction journey',
          )
          await editor.getByRole('button', { name: 'Cancel' }).click()
          await page.reload()
          await settle(page, route)
          editor = await selectFrance(page)
          await editor.getByRole('button', { name: 'Edit visit' }).click()
          await expect(editor.getByLabel('First visit')).toHaveValue(
            '2024-02-29',
          )
          await expect(editor.getByLabel('Last visit')).toHaveValue(
            '2025-08-01',
          )
          await expect(editor.getByLabel('Note', { exact: true })).toHaveValue(
            'Atlas visit correction journey',
          )
          await editor.scrollIntoViewIfNeeded()
          await page.screenshot({
            path: testInfo.outputPath(`editor-${width}-${theme}.png`),
          })
          await save('2023-01-01', '', 'Corrected visit')
          await editor.getByRole('button', { name: 'Edit visit' }).click()
          await expect(editor.getByLabel('First visit')).toHaveValue(
            '2023-01-01',
          )
          await save('', '', '')
          await editor.getByRole('button', { name: 'Edit visit' }).click()
          await expect(editor.getByLabel('First visit')).toHaveValue('')
          await expect(editor.getByLabel('Last visit')).toHaveValue('')
          await expect(editor.getByLabel('Note', { exact: true })).toHaveValue(
            '',
          )
        } finally {
          if (
            await editor.getByRole('button', { name: 'Edit visit' }).isVisible()
          ) {
            await editor.getByRole('button', { name: 'Edit visit' }).click()
          }
          await save(original.first, original.last, original.note)
          await editor.getByRole('button', { name: 'Edit visit' }).click()
          await expect(editor.getByLabel('Note', { exact: true })).toHaveValue(
            original.note,
          )
          await editor.getByRole('button', { name: 'Cancel' }).click()
          await expect(facts).toBeVisible()
          await expect(
            editor.getByRole('button', { name: 'Edit visit' }),
          ).toBeFocused()
        }
      })
    }
  }
})
