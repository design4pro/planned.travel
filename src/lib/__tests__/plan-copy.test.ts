import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import settings from '#/lib/i18n/messages/en/settings'
import { PLANS, PLAN_IDS, PLAN_LIST } from '#/lib/plans'
import { PLAN_ALLOWANCE_CLAIMS, PLAN_COPY } from '#/lib/plan-copy'
import { TIER_FOR_PLAN } from '#/server/billing/limits'
import { PLAN_QUOTAS, UNLIMITED } from '#/server/db/types'

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

/**
 * The screen reads the catalogue, not the English on `plans.ts`.
 *
 * This suite was suspended while `billing.tsx` was the pre-localisation screen: it held on
 * `develop`, and the merge that replaced Stripe's invoice model with Polar's could not keep the
 * localised version, because it no longer compiled against the types it read. The screen that
 * survived rendered `plan.name`, `plan.tagline` and `plan.features` straight into the DOM, and 101
 * catalogued `settings.billing.*` keys sat in 23 languages with nothing asking for them.
 *
 * The screen is localised again, so these four assertions are live and they are what says so.
 */
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

/**
 * The numbers the copy spells out, checked against the plans that own them.
 *
 * `plans.ts` and the mapped tier in `PLAN_QUOTAS` own the published allowances.
 * The catalogue restates them as words or numerals so a translator can put the
 * count in their own grammar. That is a duplicated fact, and the reasoning
 * in `../plan-copy.ts` used to admit the trade without guarding it: the two
 * agreed, and nothing kept them agreeing. This is the guard. It reads the limit
 * from its owner, spells it, and requires the shipped English sentence to
 * contain that word or numeral — so the sentence fails here the moment either side moves.
 */
const ALLOWANCE_WORDS = new Map<number, string>([
  [1, 'one'],
  [2, 'two'],
  [10, 'ten'],
])

/** How this module's copy writes an allowance. `null` is unlimited. */
function spellAllowance(limit: number | null): string {
  if (limit === null) return 'unlimited'
  const word = ALLOWANCE_WORDS.get(limit)
  // Allowances with a known word use it; larger counts use numerals.
  return word ?? String(limit)
}

/** Match the places allowance itself, rather than an unlimited trips claim beside it. */
function placesAllowancePattern(limit: number | null): RegExp {
  const allowance = spellAllowance(limit)
  return new RegExp(`\\b${allowance} (?:trips(?:,| and) )?places\\b`, 'u')
}

describe('the copy states the allowances the plans actually carry', () => {
  it.each(PLAN_ALLOWANCE_CLAIMS.map((claim) => [claim.key, claim]))(
    '%s spells the live limit',
    (_key, claim) => {
      let limit: number | null
      if (claim.quota === 'places') {
        const ceiling = PLAN_QUOTAS[TIER_FOR_PLAN[claim.plan]].places
        limit = ceiling === UNLIMITED ? null : ceiling
      } else {
        limit = PLANS[claim.plan].limits[claim.quota]
      }
      const word = spellAllowance(limit)
      const short = claim.key.replace(/^settings\./, '')
      const value = settings[short as keyof typeof settings]
      expect(typeof value).toBe('string')
      if (claim.quota === 'places') {
        expect(String(value).toLowerCase()).toMatch(
          placesAllowancePattern(limit),
        )
        expect(String(value).toLowerCase()).not.toMatch(/\bper trip\b/u)
      }
      expect(String(value).toLowerCase()).toMatch(
        new RegExp(`\\b${word}\\b`, 'u'),
      )
    },
  )

  it('guards a places claim on the existing bullet for every plan', () => {
    const places = PLAN_ALLOWANCE_CLAIMS.filter(
      (claim) => claim.quota === 'places',
    )
    expect(places.map((claim) => claim.plan).sort()).toEqual(
      [...PLAN_IDS].sort(),
    )
    for (const claim of places) {
      expect(PLAN_COPY[claim.plan].features).toContain(claim.key)
    }
  })

  it.each([
    ['unlimited trips and 500 places', null],
    ['unlimited trips', null],
    ['two trips at a time and up to 151 places', 150],
    ['two trips at a time and up to 1500 places', 150],
  ] as const)('rejects a misleading places allowance: %s', (copy, limit) => {
    expect(copy).not.toMatch(placesAllowancePattern(limit))
  })

  it('names a key the catalogue carries in every claim', () => {
    for (const claim of PLAN_ALLOWANCE_CLAIMS) {
      expect(Object.keys(settings)).toContain(
        claim.key.replace(/^settings\./, ''),
      )
    }
  })

  it('claims every plan whose allowance the copy words rather than formats', () => {
    // A plan absent from the table is a plan whose sentences carry no number,
    // and this is what notices when a new one is written with one.
    expect(
      [...new Set(PLAN_ALLOWANCE_CLAIMS.map((claim) => claim.plan))].sort(),
    ).toEqual([...PLAN_IDS].sort())
  })
})
