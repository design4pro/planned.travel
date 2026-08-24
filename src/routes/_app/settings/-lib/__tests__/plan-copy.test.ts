import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import settings from '#/lib/i18n/messages/en/settings'
import { PLAN_IDS, PLAN_LIST } from '#/lib/plans'
import { PLAN_COPY } from '../plan-copy'

/**
 * The billing screen's plan copy, and the rule that put it in the catalogue.
 *
 * `src/lib/plans.ts` ships an English `name`, `tagline` and `features` for every
 * plan. The comparison cards used to render them straight, which is an
 * untranslated string on a translated screen — `docs/SPEC.md` §8.6 — so the
 * screen reads keys instead. Two things then have to stay true, and neither is
 * expressible as a type: every plan the catalogue can put in front of a customer
 * has copy, and the screen has actually stopped reading the other source.
 */

const BILLING = readFileSync(
  join(process.cwd(), 'src', 'routes', '_app', 'settings', 'billing.tsx'),
  'utf8',
)

/** Every key the table names, in one list, prefix stripped as the catalogue holds it. */
function keysOf(): ReadonlyArray<string> {
  return Object.values(PLAN_COPY).flatMap((copy) => [
    copy.name,
    copy.tagline,
    ...copy.features,
  ])
}

describe('every plan a customer can be shown has copy', () => {
  it('covers the whole catalogue', () => {
    expect(Object.keys(PLAN_COPY).sort()).toEqual([...PLAN_IDS].sort())
    for (const plan of PLAN_LIST) {
      expect(PLAN_COPY[plan.id]).toBeDefined()
    }
  })

  it('gives each card exactly four bullets', () => {
    for (const id of PLAN_IDS) {
      expect(PLAN_COPY[id].features).toHaveLength(4)
    }
  })

  it('names every key once', () => {
    const keys = keysOf()
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('reads keys the catalogue carries, each with real copy', () => {
    for (const key of keysOf()) {
      const short = key.replace(/^settings\./, '')
      expect(Object.keys(settings)).toContain(short)
      const value = settings[short as keyof typeof settings]
      expect(typeof value).toBe('string')
      expect(String(value).trim().length).toBeGreaterThan(0)
    }
  })
})

describe('the screen no longer reads the English catalogue', () => {
  it.each(['name', 'tagline', 'features'])('never renders plan.%s', (field) => {
    // A comment quoting the field would read as a use, so the source is
    // stripped of comments first — the same treatment `copy-rules.test.ts`
    // gives every file in this module.
    const code = BILLING.replace(/\/\*[\s\S]*?\*\//g, '').replace(
      /^\s*\/\/.*$/gm,
      '',
    )
    expect(code).not.toContain(`plan.${field}`)
  })

  it('renders a plan name from the catalogue instead', () => {
    expect(BILLING).toContain('PLAN_COPY')
  })
})
