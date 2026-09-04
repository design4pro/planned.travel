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

  it('clears the mobile tab bar in scroll geometry and nowhere else', () => {
    // The bottom edge is not the shell's to lay out. `AppFrame` already pads the
    // content well for the bar and a full-bleed slice already stops at its top
    // edge, so a third box under the outlet is dead canvas rather than
    // clearance — 96px of gutter against a 65px bar, at 360px and at 768px.
    // What neither of those can do is move a scroll position, which is what the
    // rule below is for and all it is for.
    const css = stylesheet().replace(/\s+/g, '')
    expect(css).not.toContain('pb-tab-bar')
    // Anchored, because `scroll-padding-bottom` carries the same expression one
    // rule below and an unanchored search matches its tail.
    expect(css).not.toMatch(/[;{]padding-bottom:calc\(1px\+4rem/)
  })

  it('stops the browser scrolling anything under it, in that document only', () => {
    // `scroll-padding-bottom` moves where the browser stops when it scrolls a
    // focused field or an anchor into view, and changes no element's size — the
    // one reservation that can be made across a whole document without moving a
    // single existing screen. The expression comes from `MOBILE_TAB_BAR`, so it
    // and the bar cannot disagree about how tall it is.
    const css = stylesheet().replace(/\s+/g, '')
    expect(css).toContain(
      `html:has([data-app-shell]){scroll-padding-bottom:${BOTTOM_CLEARANCE_CSS.replace(/\s+/g, '')};}`,
    )
    expect(css).toContain('scroll-padding-bottom:0px;')
    // Scoped, because only the authenticated shell renders a tab bar: an
    // unscoped rule reserves against bottom chrome the marketing tree, the auth
    // tree and the error document do not have.
    expect(
      [...stylesheet().matchAll(/scroll-padding-bottom:/g)],
      'declarations of scroll-padding-bottom',
    ).toHaveLength(2)
    expect(css).not.toContain('html{scroll-padding-bottom')
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

/**
 * The two map tiers, and the header they must both stay under.
 *
 * This used to be asserted in the browser, by opening `/atlas`, pressing a
 * country and reading `getComputedStyle().zIndex` off the rendered layers. The
 * claim never needed a browser: it is an ordering between three declared
 * numbers, and the only way it breaks is somebody editing one of them. Reading
 * `tokens.css` off disk catches the same edit in milliseconds, and catches it on
 * every route rather than only on the one the gate happened to photograph.
 *
 * What is deliberately *not* here is that the surfaces host actually claims the
 * tier — that is a render fact, and it is asserted where the overlay renders.
 */
describe('the map surface tiers', () => {
  it('puts the map chrome below the map surfaces, and both below the app header', () => {
    // The reason the two tiers exist at all: a card summoned over the zoom
    // cluster has to land beside it rather than slide under it, and neither
    // tier may ever cover the app nav.
    const { attribute } = contexts()
    const overlay = declaredValue(attribute, '--z-map-overlay')
    const surface = declaredValue(attribute, '--z-map-surface')
    const nav = declaredValue(attribute, '--z-nav')
    expect(overlay, '--z-map-overlay').toBeDefined()
    expect(surface, '--z-map-surface').toBeDefined()
    expect(nav, '--z-nav').toBeDefined()
    expect(Number(overlay)).toBeLessThan(Number(surface))
    expect(Number(surface)).toBeLessThan(Number(nav))
  })

  it('declares both tiers once, in the theme-independent block', () => {
    const { light, media } = contexts()
    for (const token of ['--z-map-overlay', '--z-map-surface'] as const) {
      expect(declaredValue(light, token), `${token} in :root`).toBeUndefined()
      expect(
        declaredValue(media, token),
        `${token} in the dark media block`,
      ).toBeUndefined()
    }
  })

  it('ships both as utilities, in the same form as every other z token', () => {
    // A component writes `z-map-surface` exactly as it writes `z-nav`, and
    // Tailwind emits nothing at all for a `@utility` that is not there.
    const css = stylesheet()
    expect(css).toContain(
      '@utility z-map-overlay {\n  z-index: var(--z-map-overlay);\n}',
    )
    expect(css).toContain(
      '@utility z-map-surface {\n  z-index: var(--z-map-surface);\n}',
    )
  })

  it('has the atlas surface layer claim the surface tier by name', () => {
    // The tier means nothing until something stands on it, and the thing that
    // does is one class in one composed string. Radix's own popover layers
    // default to `--z-dropdown`, which is *above* `--z-nav`, so a surface layer
    // that lost this class would not fall to the back — it would float over the
    // app header and, on a phone, over the tab bar.
    const screen = readFileSync(
      join(stylesDir(), '..', 'routes', '_app', '-ui', 'atlas-screen.tsx'),
      'utf8',
    )
    const layer = /const SURFACE_LAYER = cn\(([\s\S]*?)\n\)/.exec(screen)
    expect(layer, 'SURFACE_LAYER').not.toBeNull()
    expect(layer?.[1]).toContain('z-map-surface')
  })
})
