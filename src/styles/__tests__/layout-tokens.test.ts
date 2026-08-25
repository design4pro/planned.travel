import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { BOTTOM_CLEARANCE_CSS } from '#/lib/atlas/layout'
import { cn } from '#/lib/cn'

/**
 * The impersonation bar's two tokens, and the wiring that makes them mean
 * anything.
 *
 * Every fact below is invisible to the compiler and silent when it breaks:
 * Tailwind emits nothing at all for a `@utility` that is not there, `cn()`
 * quietly keeps both classes of a `z-*` pair it does not recognise, and a chrome
 * offset that forgets to compose `--impersonation-h` leaves a full-bleed screen
 * overflowing by exactly one bar with every other test in the suite still green.
 * `docs/ACCESS.md` FU-1 names these two tokens as the phase's own contract, so
 * they are asserted against the files a browser is actually handed.
 */

function stylesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

function tokens(): string {
  return readFileSync(join(stylesDir(), 'tokens.css'), 'utf8')
}

function stylesheet(): string {
  return readFileSync(join(stylesDir(), 'styles.css'), 'utf8')
}

/** The declared value of a custom property inside one slice of a file. */
function declaredValue(slice: string, token: string): string | undefined {
  const match = new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm').exec(slice)
  return match === null ? undefined : match[1].trim()
}

/**
 * The token file's three themed contexts, split the way
 * `src/lib/map/__tests__/palette.test.ts` splits them: the bare `:root` that
 * carries light, the guarded `prefers-color-scheme` block, and the explicit
 * `[data-theme='dark']` block — which the theme-independent tail falls into.
 */
function contexts(): { light: string; media: string; attribute: string } {
  const css = tokens()
  const media = css.indexOf('@media (prefers-color-scheme: dark) {')
  const attribute = css.indexOf(":root[data-theme='dark'] {")
  expect(media, 'guarded dark block').toBeGreaterThan(0)
  expect(attribute, 'explicit dark block').toBeGreaterThan(media)
  return {
    light: css.slice(0, media),
    media: css.slice(media, attribute),
    attribute: css.slice(attribute),
  }
}

describe('the impersonation band', () => {
  it('sits above the toast tier, and therefore above every other layer', () => {
    const { attribute } = contexts()
    const impersonation = declaredValue(attribute, '--z-impersonation')
    const toast = declaredValue(attribute, '--z-toast')
    const modal = declaredValue(attribute, '--z-modal')
    expect(impersonation, '--z-impersonation').toBeDefined()
    expect(Number(impersonation)).toBeGreaterThan(Number(toast))
    expect(Number(impersonation)).toBeGreaterThan(Number(modal))
  })

  it('is declared once, in the theme-independent block', () => {
    // A stacking order has no light and dark value, so a themed copy of it is
    // always a mistake — and one that only shows up in one theme.
    const { light, media } = contexts()
    expect(declaredValue(light, '--z-impersonation')).toBeUndefined()
    expect(declaredValue(media, '--z-impersonation')).toBeUndefined()
  })

  it('ships as a utility, in the same form as every other z token', () => {
    expect(stylesheet()).toContain(
      '@utility z-impersonation {\n  z-index: var(--z-impersonation);\n}',
    )
  })

  it('wins the merge against the tier below it, in both orders', () => {
    // Without both names in `cn()`'s closed `z` group these return two classes
    // and stylesheet order decides which covers the control that ends an
    // impersonated session.
    expect(cn('z-toast', 'z-impersonation')).toBe('z-impersonation')
    expect(cn('z-impersonation', 'z-toast')).toBe('z-toast')
    expect(cn('z-modal', 'z-impersonation')).toBe('z-impersonation')
  })

  it('leaves no `@utility z-*` out of that group', () => {
    // The group is closed only if it lists every name the stylesheet ships.
    const names = [...stylesheet().matchAll(/@utility z-([a-z-]+) \{/g)].map(
      (match) => match[1],
    )
    expect(names.length).toBeGreaterThan(6)
    for (const name of names) {
      expect(cn(`z-${name}`, 'z-nav'), `z-${name}`).toBe('z-nav')
    }
  })
})

describe('the impersonation bar row', () => {
  it('is zero by default, so a shell without the bar is untouched', () => {
    const { attribute } = contexts()
    expect(declaredValue(attribute, '--impersonation-h')).toBe('0rem')
  })

  it('is raised only on the subtree that renders the bar', () => {
    const css = tokens()
    expect(css).toMatch(
      /\[data-impersonated\]\s*\{\s*--impersonation-h:\s*3\.5rem;/,
    )
    // Raised nowhere else: a `:root` copy would move the marketing tree, the
    // auth tree and every portal along with the shell.
    expect(
      [...css.matchAll(/--impersonation-h:/g)],
      'declarations of --impersonation-h',
    ).toHaveLength(2)
  })

  it('ships as a utility, in the same form as `h-nav` and `h-subnav`', () => {
    expect(stylesheet()).toContain(
      '@utility h-impersonation {\n  height: var(--impersonation-h);\n}',
    )
  })
})

describe('the chrome offsets that read the bar', () => {
  it('composes the bar into the distance from the viewport to the foot of the chrome', () => {
    const css = stylesheet()
    expect(css).toContain(
      '@utility top-nav {\n  top: calc(var(--nav-h) + var(--impersonation-h));\n}',
    )
    expect(css).toContain(
      '@utility pt-nav {\n  padding-top: calc(var(--nav-h) + var(--impersonation-h));\n}',
    )
  })

  it('stops the browser scrolling anything under the mobile tab bar', () => {
    // The bottom edge's counterpart to `--impersonation-h` at the top, and
    // deliberately scroll geometry rather than layout: `scroll-padding-bottom`
    // moves where the browser stops and changes no element's size, so a content
    // well that already clears the bar keeps exactly the height it had. The
    // expression comes from `MOBILE_TAB_BAR`, so the reservation and the bar
    // cannot disagree about how tall it is.
    const css = stylesheet().replace(/\s+/g, '')
    expect(css).toContain(
      `scroll-padding-bottom:${BOTTOM_CLEARANCE_CSS.replace(/\s+/g, '')};`,
    )
    // …and released from `lg`, where there is no tab bar to clear.
    expect(css).toContain('scroll-padding-bottom:0px;')
  })

  it('leaves the nav row itself measuring the nav row', () => {
    // `--nav-h` names the header's row and nothing else. A header that grew by
    // the bar's height would leave its contents floating in the middle of it.
    const css = stylesheet()
    expect(css).toContain('@utility h-nav {\n  height: var(--nav-h);\n}')
    expect(css).toContain(
      '@utility min-h-nav {\n  min-height: var(--nav-h);\n}',
    )
  })
})
