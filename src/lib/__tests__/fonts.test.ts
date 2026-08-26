import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { FONT_PRECONNECT_ORIGINS, FONT_STYLESHEET_HREF } from '#/lib/fonts'

/**
 * `src/lib/fonts.ts` is data, not markup: it names the eight families the
 * product's 23 languages need and the two origins that serve them, and the
 * document shell renders them. These tests hold the two invariants that no
 * type can express.
 *
 * Paths are resolved from `process.cwd()` rather than `import.meta.url`,
 * because this file runs in the `ui` (jsdom) project where `import.meta.url` is
 * an `http:` URL and `fileURLToPath` throws on it.
 */
const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8')

/**
 * Every family in the request, and the script each one is there to draw. Geist
 * and MuseoModerno are the two faces `docs/DESIGN.md` pins; the six Noto cuts
 * are the scripts neither of them serves.
 */
const REQUESTED_FAMILIES = [
  'Geist',
  'MuseoModerno',
  'Noto Sans',
  'Noto Sans Arabic',
  'Noto Sans JP',
  'Noto Sans KR',
  'Noto Sans SC',
  'Noto Sans TC',
] as const

describe('FONT_STYLESHEET_HREF', () => {
  const url = new URL(FONT_STYLESHEET_HREF)
  const families = url.searchParams.getAll('family')

  it('asks fonts.googleapis.com for the CSS2 API', () => {
    expect(url.origin).toBe('https://fonts.googleapis.com')
    expect(url.pathname).toBe('/css2')
  })

  it('carries all eight families', () => {
    expect(families.map((entry) => entry.split(':')[0])).toEqual([
      ...REQUESTED_FAMILIES,
    ])
  })

  it.each(REQUESTED_FAMILIES)('requests a weight axis for %s', (family) => {
    const entry = families.find((candidate) =>
      candidate.startsWith(`${family}:`),
    )
    expect(entry).toBeDefined()
    expect(entry).toMatch(/:wght@[\d.;]+(\.\.[\d.]+)?$/)
  })

  it('sets display=swap once, for every face in the response', () => {
    expect(url.searchParams.getAll('display')).toEqual(['swap'])
  })

  it('keeps the families alphabetical, which the CSS2 API answers 400 without', () => {
    const names = families.map((entry) => entry.split(':')[0])
    expect(names).toEqual([...names].sort())
  })
})

describe('FONT_PRECONNECT_ORIGINS', () => {
  it('warms the API host and the file host, the file host as anonymous CORS', () => {
    expect(FONT_PRECONNECT_ORIGINS).toEqual([
      { href: 'https://fonts.googleapis.com' },
      { href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
    ])
  })

  it('warms the origin the stylesheet is actually fetched from', () => {
    const origins = FONT_PRECONNECT_ORIGINS.map(({ href }) => href)
    expect(origins).toContain(new URL(FONT_STYLESHEET_HREF).origin)
  })
})

/**
 * The href and the stacks in `tokens.css` are two halves of one decision: a
 * family requested but not named in a stack downloads for nothing, and a family
 * named in a stack but not requested is a script that silently falls to a
 * platform default. Neither file can check the other at compile time, so this
 * does.
 */
describe('the stacks in tokens.css', () => {
  const tokens = read('src/styles/tokens.css')
  const stacks = ['--font-ui', '--font-display'] as const

  const stackOf = (name: string) => {
    const match = tokens.match(new RegExp(`\\n\\s*${name}:([^;]+);`))
    if (!match) throw new Error(`${name} is not declared in tokens.css`)
    return match[1]
  }

  it.each(stacks)('resolves %s through the shared sub-stacks', (name) => {
    const stack = stackOf(name)
    expect(stack).toContain('var(--font-han)')
    expect(stack).toContain('var(--font-cjk-fallback)')
  })

  it.each(REQUESTED_FAMILIES)(
    'names %s ahead of the generic system entries',
    (family) => {
      const named = stacks.map(stackOf).concat(stackOf('--font-han')).join('\n')
      // MuseoModerno is the display voice and Geist the UI one, so each appears
      // in exactly one stack; the six Noto cuts appear in both.
      expect(named).toContain(`'${family}'`)
    },
  )

  it.each(stacks)(
    'ends %s with a generic system list, never a bare family',
    (name) => {
      expect(stackOf(name)).toMatch(/var\(--font-system(-display)?\)\s*$/)
    },
  )

  /**
   * The ordering rule, which is the whole of the layout-shift guarantee: a web
   * face is followed immediately by the compensator tuned to it, never by a
   * second web face first. A `local()` compensator is available on the first
   * frame, so it only ever draws while the face in front of it is in flight —
   * but a web face wedged in between draws then too, with its own metrics.
   *
   * Measured in Chromium 150 at 100px with MuseoModerno's file blocked and Noto
   * Sans's allowed: `Noto Sans` sitting between the two gave a Latin heading a
   * 136px line box on a 107px baseline against MuseoModerno's 160/115, against
   * 158/114 with the pairing in this order.
   */
  it.each([
    ['--font-display', 'MuseoModerno', 'Planned Display Fallback'],
    ['--font-ui', 'Geist', 'Planned Latin Fallback'],
    ['--font-display', 'Noto Sans', 'Planned Greek Fallback'],
    ['--font-ui', 'Noto Sans', 'Planned Greek Fallback'],
    ['--font-display', 'Noto Sans Arabic', 'Planned Arabic Fallback'],
    ['--font-ui', 'Noto Sans Arabic', 'Planned Arabic Fallback'],
  ])(
    'pairs %s: %s is compensated by %s with no face between',
    (stack, face, compensator) => {
      const families = stackOf(stack)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
      const faceAt = families.indexOf(`'${face}'`)
      const compensatorAt = families.indexOf(`'${compensator}'`)
      expect(faceAt).toBeGreaterThan(-1)
      expect(compensatorAt).toBeGreaterThan(-1)
      // Nothing between them but other compensators — never a second web face.
      for (const between of families.slice(faceAt + 1, compensatorAt)) {
        expect(between).toMatch(/^'Planned |^'Geist Sans'$/)
      }
      expect(compensatorAt).toBeGreaterThan(faceAt)
    },
  )

  it('gives the display stack its own compensator rather than the UI one', () => {
    // The Latin compensator is tuned to Geist (asc 1.005 / desc 0.295) and the
    // display face is MuseoModerno (1.145 / 0.445). Reaching for the UI
    // compensator in a heading is a 22% line-box jump on swap.
    const display = stackOf('--font-display')
    expect(display).toContain(`'Planned Display Fallback'`)
    expect(display).not.toContain(`'Planned Latin Fallback'`)
    expect(stackOf('--font-ui')).not.toContain('Planned Display Fallback')
  })

  it('reaches the Cyrillic compensator from the display stack only', () => {
    // MuseoModerno has no Cyrillic subset, so `ru` and `uk` headings are drawn
    // by Noto Sans and need its metrics. Geist carries its own Cyrillic, so the
    // UI stack answers that range from `Planned Latin Fallback` instead.
    expect(stackOf('--font-display')).toContain(`'Planned Cyrillic Fallback'`)
    expect(stackOf('--font-ui')).not.toContain('Planned Cyrillic Fallback')
  })

  it('asks the Kana compensator before the Han one', () => {
    // `Planned Han Fallback` resolves to PingFang SC, which draws no kana, and
    // a family whose matched face lacks the glyph is skipped entirely.
    const cjk = stackOf('--font-cjk-fallback')
    expect(cjk.indexOf(`'Planned Kana Fallback'`)).toBeGreaterThan(-1)
    expect(cjk.indexOf(`'Planned Kana Fallback'`)).toBeLessThan(
      cjk.indexOf(`'Planned Han Fallback'`),
    )
  })
})

/**
 * One metric-compensated `@font-face` per web face per script it draws, or the
 * swap moves the page. The pairing is checked by name here; the geometry itself
 * is checked in the browser, where the two states are measured at
 * `font-size: 100px`.
 */
describe('the compensated faces in styles.css', () => {
  const styles = read('src/styles/styles.css')

  const faceOf = (family: string) => {
    const match = styles.match(
      new RegExp(`@font-face \\{[^}]*font-family: '${family}';[^}]*\\}`, 'g'),
    )
    if (!match) throw new Error(`no @font-face declares '${family}'`)
    return match
  }

  const COMPENSATORS = [
    'Planned Latin Fallback',
    'Planned Display Fallback',
    'Planned Cyrillic Fallback',
    'Planned Greek Fallback',
    'Planned Arabic Fallback',
    'Planned Kana Fallback',
    'Planned Han Fallback',
    'Planned Hangul Fallback',
  ] as const

  it.each(COMPENSATORS)('declares %s exactly once', (family) => {
    expect(faceOf(family)).toHaveLength(1)
  })

  it.each(COMPENSATORS)('overrides every vertical metric on %s', (family) => {
    for (const face of faceOf(family)) {
      expect(face).toMatch(/ascent-override:/)
      expect(face).toMatch(/descent-override:/)
      expect(face).toMatch(/line-gap-override: 0%/)
      expect(face).toMatch(/unicode-range:/)
      // A compensator that downloads is not a compensator — it has to be
      // whatever the reader already has installed.
      expect(face).not.toMatch(/url\(/)
    }
  })

  it('compensates the display face to MuseoModerno, and to nothing else', () => {
    const [display] = faceOf('Planned Display Fallback')
    // MuseoModerno: asc 1.145, desc 0.445, x-height 0.510 against Arial's
    // 0.5186 — so size-adjust 98.34% and the overrides divided by it.
    expect(display).toContain('size-adjust: 98.34%')
    expect(display).toContain('ascent-override: 116.43%')
    expect(display).toContain('descent-override: 45.25%')
    // It leads `Noto Sans` in the stack, so its range has to stop where
    // MuseoModerno's subsets stop or it would claim Cyrillic and Greek from the
    // face that actually draws them.
    expect(display).not.toContain('U+0400-052F')
    expect(display).not.toContain('U+0370-03FF')
  })

  it('compensates Cyrillic headings to Noto Sans, which draws them', () => {
    const [cyrillic] = faceOf('Planned Cyrillic Fallback')
    expect(cyrillic).toContain('U+0400-052F')
    expect(cyrillic).toContain('size-adjust: 103.36%')
    expect(cyrillic).toContain('ascent-override: 103.42%')
  })

  it('splits Kana out of the Han range, in both directions', () => {
    const [kana] = faceOf('Planned Kana Fallback')
    const [han] = faceOf('Planned Han Fallback')
    // Hiragana, katakana and the halfwidth forms belong to the Japanese locals.
    expect(kana).toContain('U+3040-30FF')
    expect(kana).toContain('U+FF61-FF9F')
    expect(kana).toMatch(/local\('Hiragino Sans W3'\)/)
    // And the Han face, which resolves to PingFang SC, must not claim them.
    expect(han).not.toContain('U+3000-30FF')
    expect(han).not.toContain('U+FF00-FFEF')
  })
})
