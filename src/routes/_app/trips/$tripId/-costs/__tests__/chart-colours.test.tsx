import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { EXPENSE_CATEGORY_ORDER } from '../categories'
import { categoryColour } from '../chart-colours'
import { expenseTint } from '../../../../-lib/tone'

// jsdom gives `import.meta.url` an http scheme, so the file is found from the repository root.
const TOKENS = readFileSync(
  join(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
)

function declared(token: string): boolean {
  return new RegExp(`${token}\\s*:`).test(TOKENS)
}

/** The hue the ledger chip draws a category's glyph in: `text-data-1` -> `data-1`. */
function chipHue(category: string): string {
  const hue = expenseTint(category).match(/text-([a-z0-9-]+)/)?.[1]
  if (hue === undefined) {
    throw new Error(`no text hue on the chip tint of ${category}`)
  }
  return hue
}

describe('categoryColour', () => {
  it('gives every category a colour token the stylesheet declares', () => {
    for (const category of EXPENSE_CATEGORY_ORDER) {
      const colour = categoryColour(category)
      const token = colour.match(/^var\((--color-[a-z0-9-]+)\)$/)?.[1]

      expect(token, category).toBeDefined()
      expect(declared(token ?? ''), `${category} -> ${colour}`).toBe(true)
    }
  })

  it('agrees with the ledger chip on the hue of all eight categories', () => {
    expect(EXPENSE_CATEGORY_ORDER).toHaveLength(8)
    for (const category of EXPENSE_CATEGORY_ORDER) {
      expect(categoryColour(category)).toBe(`var(--color-${chipHue(category)})`)
      expect(expenseTint(category).split(/\s+/)).toContain('bg-surface-inset')
    }
  })

  it('maps the eight built-in categories one-to-one to the data tokens', () => {
    expect(new Set(EXPENSE_CATEGORY_ORDER.map(categoryColour))).toEqual(
      new Set(
        Array.from(
          { length: 8 },
          (_, index) => `var(--color-data-${index + 1})`,
        ),
      ),
    )
    expect(expenseTint('retired-category')).toBe(expenseTint('other'))
  })

  it('does not depend on position: the same category is the same colour', () => {
    expect(categoryColour('food')).toBe(categoryColour('food'))
    expect(categoryColour('food')).not.toBe(categoryColour('transport'))
  })

  it('resolves an unknown category like other', () => {
    expect(categoryColour('retired-category')).toBe(categoryColour('other'))
    for (const category of ['', '__proto__', 'constructor']) {
      expect(categoryColour(category)).toBe(categoryColour('other'))
      expect(expenseTint(category)).toBe(expenseTint('other'))
    }
  })
})
