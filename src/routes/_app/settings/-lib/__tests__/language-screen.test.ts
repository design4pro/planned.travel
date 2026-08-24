import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Two properties of `/settings/language` that live in its source rather than in
 * any value a test can call.
 *
 * Both were defects the round before this one, and both are invisible to `tsc`:
 *
 * - **The success toast is spoken in the language it just switched on.** The
 *   translator a component closed over belongs to the render that created it, so
 *   `t('settings.language.saved')` after a commit is the *outgoing* locale — a
 *   traveller moving to German was told so in English, in the one sentence whose
 *   whole job is to prove the change took effect. The screen builds a translator
 *   for the incoming locale instead. A regression here is a single character (`t`
 *   back in place of the new translator) and no type notices.
 * - **The picker and its skeleton are handed the same column rule.** The mobile
 *   column count is set from this screen, through the `className` the picker
 *   publishes, and the skeleton's entire contract is being the height of the
 *   thing it replaces. One of the two left out is a 570px jump at 393px on the
 *   frame after the loader settles — which is worse than no skeleton at all.
 */

const SCREEN = readFileSync(
  join(process.cwd(), 'src', 'routes', '_app', 'settings', 'language.tsx'),
  'utf8',
)

/** Prose in a doc comment is not code; the regexes below quote what they ban. */
const CODE = SCREEN.replace(/\/\*[\s\S]*?\*\//g, '').replace(
  /^\s*\/\/.*$/gm,
  '',
)

describe('the screen announces the change in the language it changed to', () => {
  it('builds a translator for the locale the write landed on', () => {
    expect(CODE).toContain('createTranslator(')
    expect(CODE).toContain('await loadCatalogue(')
  })

  it('does not print the success toast with the render-time translator', () => {
    const callee = /toast\.success\(\s*([A-Za-z_$][\w$]*)\(/.exec(CODE)
    expect(callee).not.toBeNull()
    expect(callee?.[1]).not.toBe('t')
  })

  it('keeps the render-time translator for the failure toast', () => {
    // Nothing changed on a rejected save, so the reader is still reading the
    // locale they arrived in, and that is the one this sentence belongs in.
    expect(CODE).toMatch(/toast\.error\(\s*t\(/)
  })
})

describe('the picker and its skeleton share one column rule', () => {
  it('passes the same constant to both', () => {
    const uses = [
      ...CODE.matchAll(/<LanguagePicker(?:Skeleton)?\b[\s\S]*?\/>/g),
    ]
    expect(uses).toHaveLength(2)
    for (const use of uses) {
      expect(use[0]).toContain('className={PICKER_COLUMNS}')
    }
  })

  it('applies it below the sm breakpoint only', () => {
    // The five-column desktop grid is the accepted design and the committed
    // desktop baselines; only the phone needed a denser rule.
    const declaration = /const PICKER_COLUMNS = \[([\s\S]*?)\]/.exec(CODE)
    expect(declaration).not.toBeNull()
    const rules = (declaration?.[1] ?? '')
      .split(',')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule.startsWith("'max-sm:")).toBe(true)
    }
  })
})
