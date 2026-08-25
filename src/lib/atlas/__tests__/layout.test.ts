import { describe, expect, it } from 'vitest'

import {
  APP_HEADER,
  CHROME_GAP,
  CHROME_GUTTER,
  MOBILE_TAB_BAR,
  SEARCH_HEIGHT,
  SHELF_CLASS,
  SHELF_FALLBACK,
  SLICE_HEIGHT_CLASS,
  WORLD_CENTRE,
  WORLD_FRAME_CSS,
  WORLD_TILE_SIZE,
  cameraPadding,
  documentHeight,
  mercatorY,
  shelfClear,
  sliceHeight,
  sliceHeightCss,
  worldFrameLift,
  worldSize,
  worldZoom,
} from '../layout'

import type { ChromeEnvironment } from '../layout'

/** A desktop with no safe areas — the geometry the visual gate captures at. */
const DESKTOP: ChromeEnvironment = {
  viewport: 900,
  safeTop: 0,
  safeBottom: 0,
  navHeight: 64,
  impersonationHeight: 0,
}

/** A phone with both safe areas, which is where the tab bar arithmetic bites. */
const PHONE: ChromeEnvironment = {
  viewport: 852,
  safeTop: 59,
  safeBottom: 34,
  navHeight: 64,
  impersonationHeight: 0,
}

/**
 * `--impersonation-h` while the warning bar is on screen: 3.5rem in the token
 * file, and the one term that is zero for almost every session and non-zero for
 * exactly the sessions that most need the map to be the right size.
 */
const IMPERSONATION_BAR = 56

describe('the viewport slice', () => {
  it('leaves the document exactly one viewport tall from lg up', () => {
    for (const viewport of [740, 836, 900, 1024, 1440]) {
      const env = { ...DESKTOP, viewport }
      expect(documentHeight(env, true)).toBe(viewport)
    }
  })

  it('still fits one viewport with the impersonation bar on screen', () => {
    // The bar moves the top of the slice down by its whole row. A model that
    // does not know about it leaves `/atlas` overflowing by exactly one bar
    // during an impersonated session, with every other assertion here still
    // green — which is the drift this case exists to catch.
    for (const viewport of [740, 836, 900, 1024, 1440]) {
      const env = {
        ...DESKTOP,
        viewport,
        impersonationHeight: IMPERSONATION_BAR,
      }
      expect(documentHeight(env, true)).toBe(viewport)
      expect(sliceHeight(env, true)).toBe(
        sliceHeight({ ...DESKTOP, viewport }, true) - IMPERSONATION_BAR,
      )
    }
    const phone = { ...PHONE, impersonationHeight: IMPERSONATION_BAR }
    expect(documentHeight(phone, false)).toBeLessThan(PHONE.viewport)
    expect(sliceHeight(phone, false)).toBe(
      sliceHeight(PHONE, false) - IMPERSONATION_BAR,
    )
  })

  it('carries the impersonation bar as its own inset, above the nav row', () => {
    // Its position in the list is the order the chrome occupies: the bar clears
    // the display cutout when it exists, so it sits between the safe area and
    // the nav row rather than under the hairline.
    expect(APP_HEADER.map((inset) => inset.name)).toEqual([
      'top safe area',
      'impersonation bar',
      'nav row',
      'nav hairline',
    ])
    expect(sliceHeightCss(true)).toContain(
      '-var(--safe-top)-var(--impersonation-h)-var(--nav-h)',
    )
    // Zero-valued by default, so an ordinary session's geometry is untouched.
    expect(sliceHeight(DESKTOP, true)).toBe(
      DESKTOP.viewport - DESKTOP.navHeight - 1,
    )
  })

  it('accounts for the app header hairline, not just the nav row', () => {
    // The regression this file exists for: `--nav-h` names the header's row and
    // the header is `border-b`, so a slice that subtracts only the token leaves
    // the document a pixel taller than the viewport.
    const naive = DESKTOP.viewport - DESKTOP.safeTop - DESKTOP.navHeight
    expect(sliceHeight(DESKTOP, true)).toBe(naive - 1)
    expect(APP_HEADER.map((inset) => inset.name)).toContain('nav hairline')
  })

  it('stops at the top edge of the mobile tab bar, hairline included', () => {
    const barHeight = MOBILE_TAB_BAR.reduce(
      (total, inset) => total + inset.px(PHONE),
      0,
    )
    const headerHeight = APP_HEADER.reduce(
      (total, inset) => total + inset.px(PHONE),
      0,
    )
    expect(sliceHeight(PHONE, false)).toBe(
      PHONE.viewport - headerHeight - barHeight,
    )
    // The bar is fixed, so it costs the slice height without costing document
    // height: the page still fits inside one viewport.
    expect(documentHeight(PHONE, false)).toBeLessThan(PHONE.viewport)
  })

  it('never leaves a negative slice on an absurdly short viewport', () => {
    // Not a design target, but the expression must not invert: a negative height
    // would collapse the map and hand the page back to the document scrollbar.
    expect(sliceHeight({ ...DESKTOP, viewport: 200 }, true)).toBeGreaterThan(0)
  })

  it('ships the same expression it computes, at both breakpoints', () => {
    expect(SLICE_HEIGHT_CLASS.base).toBe(`h-[${sliceHeightCss(false)}]`)
    expect(SLICE_HEIGHT_CLASS.lg).toBe(`lg:h-[${sliceHeightCss(true)}]`)
  })
})

describe('the shelf', () => {
  it('derives the chrome clearance from the measured shelf', () => {
    expect(shelfClear({ wide: true, shelf: 400, controls: 44 })).toBe(
      400 + CHROME_GUTTER.lg + CHROME_GAP,
    )
    expect(shelfClear({ wide: false, shelf: 134, controls: 44 })).toBe(
      134 + CHROME_GUTTER.base + CHROME_GAP,
    )
  })

  it('keeps the CSS fallback in step with the declared fallback height', () => {
    // The class is what a server-rendered pass places the chrome with, so a
    // fallback that disagrees with the number the camera uses puts the zoom
    // cluster and the map's own idea of the covered edge in two places.
    expect(SHELF_CLASS.fallback).toContain(
      `--atlas-shelf:${SHELF_FALLBACK.base / 16}rem`,
    )
    expect(SHELF_CLASS.fallback).toContain(
      `lg:[--atlas-shelf:${SHELF_FALLBACK.lg / 16}rem]`,
    )
    expect(SHELF_CLASS.height).toBe(`lg:h-[${SHELF_FALLBACK.lg / 16}rem]`)
  })

  it('derives the clearance class from the same gutter and gap', () => {
    expect(SHELF_CLASS.clear).toContain(
      `calc(var(--atlas-shelf)+${(CHROME_GUTTER.base + CHROME_GAP) / 16}rem)`,
    )
    expect(SHELF_CLASS.clear).toContain(
      `calc(var(--atlas-shelf)+${(CHROME_GUTTER.lg + CHROME_GAP) / 16}rem)`,
    )
  })
})

describe('the camera padding', () => {
  it('keeps the whole shelf clear at the bottom', () => {
    const geometry = { wide: true, shelf: 400, controls: 44 } as const
    expect(cameraPadding(geometry).bottom).toBe(shelfClear(geometry))
  })

  it('clears the search pill at the top and the zoom cluster at the right', () => {
    const padding = cameraPadding({ wide: true, shelf: 400, controls: 44 })
    expect(padding.top).toBe(CHROME_GUTTER.lg + SEARCH_HEIGHT + CHROME_GAP)
    expect(padding.right).toBe(CHROME_GUTTER.lg + 44 + CHROME_GAP)
    expect(padding.left).toBe(CHROME_GUTTER.lg)
  })

  it('clears both the pill and the cluster at the top below lg, where they share the row', () => {
    const padding = cameraPadding({ wide: false, shelf: 134, controls: 44 })
    expect(padding.top).toBeGreaterThanOrEqual(
      CHROME_GUTTER.base + SEARCH_HEIGHT + CHROME_GAP,
    )
    expect(padding.top).toBeGreaterThanOrEqual(
      CHROME_GUTTER.base + 44 + CHROME_GAP,
    )
  })

  it('leaves room to draw at every width the product supports', () => {
    for (const width of [360, 393, 768, 1024, 1440, 2560]) {
      const wide = width >= 1024
      const padding = cameraPadding({
        wide,
        shelf: wide ? 400 : 134,
        controls: 44,
      })
      expect(padding.left + padding.right).toBeLessThan(width)
    }
  })
})

describe('the opening camera', () => {
  it('makes one world span the container’s longer edge', () => {
    for (const box of [
      { width: 1440, height: 836 },
      { width: 2560, height: 1375 },
      { width: 768, height: 894 },
      { width: 393, height: 694 },
      { width: 360, height: 610 },
    ]) {
      expect(worldSize(box)).toBeGreaterThanOrEqual(
        Math.max(box.width, box.height),
      )
    }
  })

  it('never rounds the world smaller than the container', () => {
    // A world a fraction narrower than the viewport is silently corrected by
    // MapLibre — it zooms in and re-centres on the latitude range's midpoint,
    // which throws away the centre the frame was chosen for. 700 is the height
    // that exposed it: log2(700/512) truncates downwards.
    for (let edge = 320; edge <= 2600; edge += 1) {
      const size = WORLD_TILE_SIZE * 2 ** worldZoom({ width: 1, height: edge })
      expect(size).toBeGreaterThanOrEqual(edge)
    }
  })

  it('places the equator where Web Mercator does', () => {
    expect(mercatorY(0)).toBeCloseTo(0.5, 10)
    expect(mercatorY(-90)).toBeCloseTo(1, 3)
    expect(mercatorY(90)).toBeCloseTo(0, 3)
    // Monotonic north to south, which is what makes the lift a single number.
    expect(mercatorY(60)).toBeLessThan(mercatorY(-60))
  })
})

describe('the static-to-live hand-off', () => {
  it('lifts the fallback world by the same amount the live camera does', () => {
    const box = { width: 1440, height: 836 }
    const size = worldSize(box)
    const wanted = (mercatorY(WORLD_CENTRE[1]) - 0.5) * size
    expect(worldFrameLift(box)).toBeCloseTo(wanted, 6)
  })

  it('caps the lift where MapLibre caps the camera', () => {
    // A portrait phone has no vertical slack: the Mercator square is exactly as
    // tall as the container, so MapLibre holds the equator in the middle however
    // far south the requested centre is. A fallback that lifted anyway would
    // hand off with a visible jump in the one place it is most obvious.
    // Sub-pixel rather than exactly zero: the zoom is rounded up to three
    // places, which leaves a fraction of a pixel of slack and no more.
    expect(worldFrameLift({ width: 360, height: 610 })).toBeLessThan(1)
    expect(worldFrameLift({ width: 393, height: 694 })).toBeLessThan(1)
    expect(worldFrameLift({ width: 393, height: 900 })).toBeLessThan(1)
  })

  it('grows the lift with the container, never past the slack', () => {
    for (const box of [
      { width: 1440, height: 836 },
      { width: 2560, height: 1375 },
      { width: 768, height: 700 },
    ]) {
      const lift = worldFrameLift(box)
      expect(lift).toBeGreaterThan(0)
      expect(lift).toBeLessThanOrEqual((worldSize(box) - box.height) / 2)
    }
  })

  it('states the lift in CSS from the same latitude', () => {
    const ratio = (mercatorY(WORLD_CENTRE[1]) - 0.5).toFixed(5)
    expect(WORLD_FRAME_CSS.lift).toContain(ratio)
    expect(WORLD_FRAME_CSS.edge).toBe('max(100cqw, 100cqh)')
  })
})
