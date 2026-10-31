import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
const media = css.indexOf('@media (prefers-color-scheme: dark) {')
const attribute = css.indexOf(":root[data-theme='dark'] {")
const contexts = {
  light: css.slice(0, media),
  media: css.slice(media, attribute),
  attribute: css.slice(attribute),
}
const tokens = Array.from(
  { length: 8 },
  (_, index) => `--color-data-${index + 1}`,
)

function value(context: string, token: string): string {
  const match = new RegExp(`^\\s*${token}:\\s*(#[0-9a-f]{6});`, 'm').exec(
    context,
  )
  if (!match?.[1]) throw new Error(`Missing opaque colour ${token}`)
  return match[1]
}

function linear(hex: string): number[] {
  return [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = linear(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(first: string, second: string): number {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** sRGB -> CIELAB with the D65 reference white; CIE76 is Euclidean Lab distance. */
function lab(hex: string): number[] {
  const [r = 0, g = 0, b = 0] = linear(hex)
  const f = (n: number): number =>
    n > (6 / 29) ** 3 ? Math.cbrt(n) : n / (3 * (6 / 29) ** 2) + 4 / 29
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047)
  const y = f(luminance(hex))
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

describe('categorical data palette', () => {
  it('redeclares all eight colours identically in both dark contexts', () => {
    expect(media).toBeGreaterThan(0)
    expect(attribute).toBeGreaterThan(media)
    for (const token of tokens) {
      expect(value(contexts.media, token)).toBe(
        value(contexts.attribute, token),
      )
      expect(value(contexts.media, token)).not.toBe(
        value(contexts.light, token),
      )
    }
  })

  for (const [theme, context] of Object.entries(contexts)) {
    it(`${theme}: clears graphical and chip text contrast on every ground`, () => {
      for (const token of tokens) {
        for (const ground of [
          '--color-surface',
          '--color-surface-2',
          '--color-surface-inset',
        ]) {
          const ratio = contrast(value(context, token), value(context, ground))
          expect(ratio, `${token} on ${ground}`).toBeGreaterThanOrEqual(3)
          // The chip uses the existing inset ground rather than unused soft companions.
          if (ground === '--color-surface-inset')
            expect(ratio, token).toBeGreaterThanOrEqual(4.5)
        }
      }
    })

    it(`${theme}: keeps every possible neighbour at least 15 CIE76 apart (product requirement)`, () => {
      const colours = tokens.map((token) => lab(value(context, token)))
      for (let a = 0; a < colours.length; a++) {
        for (let b = a + 1; b < colours.length; b++) {
          const distance = Math.hypot(
            ...colours[a].map((channel, index) => channel - colours[b][index]),
          )
          expect(
            distance,
            `${tokens[a]} / ${tokens[b]}`,
          ).toBeGreaterThanOrEqual(15)
        }
      }
    })
  }
})
