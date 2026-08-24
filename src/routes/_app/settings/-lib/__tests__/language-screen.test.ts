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

describe('only the write itself can be rolled back', () => {
  /**
   * The commit is two `try` blocks, and the split is the whole point.
   *
   * `saveLanguagePreference`, `router.invalidate()` and `loadCatalogue()` used
   * to share one, whose `catch` treated all three as "the save failed": it put
   * the chip back and said "you are still reading English". A catalogue chunk
   * that fails to fetch after a successful write therefore left D1 holding the
   * new tag and `<html lang>` already flipped, with the control and the sentence
   * both contradicting the document. Nothing about that is visible to `tsc`, and
   * re-joining the blocks is a two-line edit.
   */
  const BLOCKS = [
    ...CODE.matchAll(/\n {4}try \{\n([\s\S]*?)\n {4}\} catch \{/g),
  ]

  it('commits inside two blocks, not one', () => {
    expect(BLOCKS).toHaveLength(2)
  })

  it('keeps the invalidation and the catalogue out of the write block', () => {
    const write = BLOCKS[0]?.[1] ?? ''
    expect(write).toContain('saveLanguagePreference(')
    expect(write).not.toContain('router.invalidate')
    expect(write).not.toContain('loadCatalogue')
  })

  it('rolls the selection back from the write block alone', () => {
    const after = CODE.slice(CODE.indexOf('} catch {'))
    const [failedWrite, failedSwitch] = after.split(/\n {4}try \{/)
    expect(failedWrite).toContain('setChoice(previous)')
    expect(failedWrite).toContain('toast.error(')
    // The row was written, so the second failure may report and nothing else.
    expect(failedSwitch).not.toContain('setChoice(previous)')
    expect(failedSwitch).toContain('router.invalidate')
    expect(failedSwitch).toContain('toast.warning(')
  })
})

describe('the loading shape is the loaded screen with its values missing', () => {
  it('frames both states with the same section component', () => {
    // A bare `Card` takes its own `p-5` and draws no header band, which is what
    // made the pending screen 241.75px shorter than the one it replaced at
    // 1440px and 296.81px shorter at 393px — and, through 8px of inner width,
    // gave the chip grid six columns against the loaded five.
    const sections = [...CODE.matchAll(/<SettingsSection\b/g)]
    expect(sections).toHaveLength(4)
    expect(CODE).not.toContain('<Card')
  })

  it('reads its headings from the catalogue rather than shimmering them', () => {
    for (const key of [
      'settings.language.section.title',
      'settings.language.section.description',
      'settings.language.sample.title',
      'settings.language.sample.description',
    ]) {
      expect([...CODE.matchAll(new RegExp(`'${key}'`, 'g'))]).toHaveLength(2)
    }
  })

  it('stacks both hints so neither state nor loading changes the height', () => {
    // `min-h` would need a line count per breakpoint per language; one grid cell
    // holding both sentences is as tall as the longer of them by construction.
    expect(CODE).toMatch(/<Hints state="pending"/)
    expect(CODE).toMatch(/<Hints state=\{/)
    const hints = /function Hints\(([\s\S]*?)\n\}/.exec(CODE)?.[1] ?? ''
    expect(hints).toContain("'settings.language.state.hint.override'")
    expect(hints).toContain("'settings.language.state.hint.workspace'")
    expect([...hints.matchAll(/HINT_CELL/g)].length).toBeGreaterThanOrEqual(2)
    expect(hints).toContain('invisible')
  })
})
