import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import En from '#/lib/i18n/messages/en/modules'

const source = readFileSync('src/routes/_app/vacay.tsx', 'utf8')
describe('leave planner page copy', () => {
  it('renders the header and travellers through catalogue keys', () => {
    for (const key of [
      'vacay.page.eyebrow',
      'vacay.page.title',
      'vacay.page.description',
      'vacay.people.title',
      'vacay.people.you',
    ] as const) {
      expect(En[key]).toBeTruthy()
      expect(source).toContain(`t('modules.${key}'`)
    }
    expect(source).not.toMatch(/(?:eyebrow|title|description|label)="[A-Za-z]/)
    expect(source).not.toContain('${person.name} (you)')
  })
})
