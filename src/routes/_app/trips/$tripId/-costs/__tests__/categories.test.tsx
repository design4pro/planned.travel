import { describe, expect, it } from 'vitest'

import { namespaceTranslate } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import {
  EXPENSE_CATEGORY_ORDER,
  categoryLabel,
  categoryOptions,
} from '../categories'

const t = namespaceTranslate('costs', Costs)

describe('categoryLabel', () => {
  it('names every category the schema knows from the catalogue', () => {
    expect(
      EXPENSE_CATEGORY_ORDER.map((category) => categoryLabel(category, t)),
    ).toEqual([
      'Accommodation',
      'Transport',
      'Food & drink',
      'Activities',
      'Shopping',
      'Fees & charges',
      'Insurance',
      'Other',
    ])
  })

  it('falls back to "other" for a category retired from the schema, never the raw token', () => {
    expect(categoryLabel('mystery', t)).toBe('Other')
    expect(categoryLabel('', t)).toBe('Other')
  })

  it('resolves through the translator it is given, so no locale is cached for another', () => {
    const loud = ((key: string) => key.toUpperCase()) as typeof t

    expect(categoryLabel('food', loud)).toBe('COSTS.CATEGORY.FOOD')
    expect(categoryLabel('food', t)).toBe('Food & drink')
  })
})

describe('categoryOptions', () => {
  it('lists every category in presentation order, labelled for the reader', () => {
    const options = categoryOptions(t)

    expect(options.map((option) => option.value)).toEqual([
      ...EXPENSE_CATEGORY_ORDER,
    ])
    expect(options.map((option) => option.label)).toEqual(
      EXPENSE_CATEGORY_ORDER.map((category) => categoryLabel(category, t)),
    )
  })
})
