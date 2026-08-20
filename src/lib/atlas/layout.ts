/**
 * The atlas screen's geometry, stated once.
 *
 * `/atlas` is the product's only full-bleed route, which means every number in
 * its composition is load-bearing in two places at once: in CSS, where the slice
 * and the floating chrome are laid out, and in JavaScript, where the map camera
 * is told which edges of itself are covered. When those two drift the map lies —
 * a searched country lands under the shelf that was supposed to describe it, or
 * the zoom cluster sits on top of the panel it was lifted clear of.
 *
 * Three facts were each written out at three or more call sites before this file
 * existed, and every one of them had already drifted:
 *
 * **The chrome above and below the slice.** The app header is `border-b`, so its
 * box is `--safe-top + --nav-h + 1px`; the mobile tab bar is `border-t`, so its
 * box is `1px + 4rem + --safe-bottom`. The slice's height expression omitted both
 * hairlines, which put the document at `100svh + 1px` from `lg` up — a full-bleed
 * screen that scrolls by one pixel — and ran the map two pixels under the tab bar
 * on a phone, where the translucent bar showed a dark strip of it.
 * {@link sliceHeight} and {@link documentHeight} are the arithmetic; the tests
 * beside this file assert the document never exceeds the viewport.
 *
 * **The shelf's height.** It appeared as `lg:h-100`, as `27.5rem`, as `9rem` and
 * as a literal `424`, related only by a prose comment — and 400 + 16 + 24 does
 * not equal 400 + 16 + 8, so two of the four disagreed. Here the shelf is
 * *measured* at runtime and published as `--atlas-shelf`; the gap the chrome
 * keeps from it is derived from that one value in CSS and in
 * {@link cameraPadding} alike.
 *
 * **The opening camera.** The live map opens at {@link worldZoom} centred on
 * {@link WORLD_CENTRE}; the static SVG world that stands in for it before the
 * first painted frame has to draw the same frame or the hand-off jumps.
 * {@link worldFrameLift} is the one expression both of them read.
 *
 * Everything here is pure arithmetic on numbers and strings: no React, no DOM,
 * no `#/components` import, so it is testable in a plain Node environment and
 * `src/lib` stays the isomorphic layer `docs/SPEC.md` §6 describes.
 */

import { MAX_MERCATOR_LATITUDE } from '#/lib/map/graticule'

import type { EdgePadding } from '#/lib/map/bounds'

/* ------------------------------------------------------------------- chrome */

/**
 * One thing between the atlas and the edge of the viewport.
 *
 * Held as a list rather than as a single hand-written `calc()` because the list
 * is what the test can walk: a term that goes missing from the expression is a
 * term missing from this array, and the assertion that the two agree is the
 * check the one-pixel overflow slipped past.
 */
export interface ChromeInset {
  /** What it is, for the failure message when the expression drifts. */
  readonly name: string
  /** The CSS length, as it appears inside the `calc()`. */
  readonly css: string
  /** The same length in CSS pixels, given the resolved environment. */
  readonly px: (env: ChromeEnvironment) => number
}

/** The parts of the environment the chrome's height depends on. */
export interface ChromeEnvironment {
  /** `100svh`, in CSS pixels. */
  readonly viewport: number
  /** `--safe-top`. */
  readonly safeTop: number
  /** `--safe-bottom`. */
  readonly safeBottom: number
  /** `--nav-h`, in CSS pixels. 4rem in the token file. */
  readonly navHeight: number
}

/**
 * The app header, in full.
 *
 * `src/components/layout/top-nav.tsx` is `sticky top-0 border-b … pt-safe`
 * around an `h-nav` row, so its border box is all three of these. `--nav-h` names
 * the row and nothing else; the hairline is real layout and every viewport-height
 * expression in the product has to account for it.
 */
export const APP_HEADER: ReadonlyArray<ChromeInset> = [
  { name: 'top safe area', css: 'var(--safe-top)', px: (env) => env.safeTop },
  { name: 'nav row', css: 'var(--nav-h)', px: (env) => env.navHeight },
  { name: 'nav hairline', css: '1px', px: () => 1 },
]

/**
 * The mobile tab bar, in full — `border-t` around `h-16`, plus the home
 * indicator. It is `fixed`, so it adds nothing to the document's height; the
 * slice still has to stop at its top edge or the map shows through it.
 */
export const MOBILE_TAB_BAR: ReadonlyArray<ChromeInset> = [
  { name: 'tab bar hairline', css: '1px', px: () => 1 },
  { name: 'tab bar row', css: '4rem', px: () => 64 },
  {
    name: 'bottom safe area',
    css: 'var(--safe-bottom)',
    px: (env) => env.safeBottom,
  },
]

/** Every inset the slice gives up, at one breakpoint. */
function sliceInsets(wide: boolean): ReadonlyArray<ChromeInset> {
  return wide ? APP_HEADER : [...APP_HEADER, ...MOBILE_TAB_BAR]
}

/** The slice's height as a CSS length, from the insets themselves. */
export function sliceHeightCss(wide: boolean): string {
  const terms = sliceInsets(wide)
    .map((inset) => `-${inset.css}`)
    .join('')
  return `calc(100svh${terms})`
}

/** The slice's height in CSS pixels, from the same insets. */
export function sliceHeight(env: ChromeEnvironment, wide: boolean): number {
  return sliceInsets(wide).reduce(
    (height, inset) => height - inset.px(env),
    env.viewport,
  )
}

/**
 * How tall the document ends up with the slice in it.
 *
 * The app shell is `min-h-svh` around a header and a `flex-1` main, and the tab
 * bar is `fixed`, so this is the header's box plus the slice. Anything over
 * `viewport` is a scrollbar on a screen that has declared it owns the viewport.
 */
export function documentHeight(env: ChromeEnvironment, wide: boolean): number {
  const header = APP_HEADER.reduce((total, inset) => total + inset.px(env), 0)
  return header + sliceHeight(env, wide)
}

/**
 * The slice's height, as the two Tailwind utilities the screen actually ships.
 *
 * Literal strings, because Tailwind reads source text: a class assembled at
 * runtime generates no CSS. The test asserts each one carries exactly
 * {@link sliceHeightCss} for its breakpoint, so the literals cannot drift from
 * the arithmetic above.
 */
export const SLICE_HEIGHT_CLASS = {
  base: 'h-[calc(100svh-var(--safe-top)-var(--nav-h)-1px-1px-4rem-var(--safe-bottom))]',
  lg: 'lg:h-[calc(100svh-var(--safe-top)-var(--nav-h)-1px)]',
} as const

/* -------------------------------------------------------------------- shelf */

/** The gutter the floating chrome sits on, per breakpoint, in CSS pixels. */
export const CHROME_GUTTER = { base: 12, lg: 16 } as const

/** The breathing space between two floating elements, in CSS pixels. */
export const CHROME_GAP = 8

/** The search pill's own height, in CSS pixels. Fixed: one line of input. */
export const SEARCH_HEIGHT = 52

/**
 * What the shelf measures before it has been measured.
 *
 * Published as a CSS default so the server-rendered pass places the chrome
 * correctly with no JavaScript at all, then replaced by the real measurement.
 * The values are the shapes the shelf is designed to: its own header on a phone,
 * and the definite 25rem the desktop screen gives it.
 */
export const SHELF_FALLBACK = { base: 136, lg: 400 } as const

/** The custom property the measured shelf height is published as. */
export const SHELF_VAR = '--atlas-shelf'

/**
 * The shelf's height and the clearance above it, as the classes that ship.
 *
 * Two declarations rather than one: the fallback is what CSS knows on its own,
 * and the clearance is derived from whatever `--atlas-shelf` currently holds —
 * so the measured value, set inline on the slice, flows straight through to the
 * zoom cluster and the credit without either of them being told a number.
 */
export const SHELF_CLASS = {
  /** The desktop shelf's definite height. `SHELF_FALLBACK.lg` in rem. */
  height: 'lg:h-[25rem]',
  fallback: '[--atlas-shelf:8.5rem] lg:[--atlas-shelf:25rem]',
  clear:
    '[--atlas-clear:calc(var(--atlas-shelf)+1.25rem)] lg:[--atlas-clear:calc(var(--atlas-shelf)+1.5rem)]',
} as const

/** Everything the chrome's placement depends on, resolved. */
export interface ShelfGeometry {
  /** True from `lg` up, where the desktop composition applies. */
  readonly wide: boolean
  /** The shelf's measured height in CSS pixels. */
  readonly shelf: number
  /** The zoom cluster's own width in CSS pixels — `MAP_CONTROLS_WIDTH`. */
  readonly controls: number
}

/**
 * How far above the slice's bottom edge the chrome has to start to clear the
 * shelf: the shelf itself, the gutter it floats on, and one gap.
 *
 * This is the number `--atlas-clear` resolves to, and the same number the camera
 * is told to keep free at the bottom. One expression, so they cannot disagree.
 */
export function shelfClear(geometry: ShelfGeometry): number {
  const gutter = geometry.wide ? CHROME_GUTTER.lg : CHROME_GUTTER.base
  return geometry.shelf + gutter + CHROME_GAP
}

/**
 * The insets the camera must keep clear, derived from the chrome that covers
 * them rather than picked by eye.
 *
 * Handed to `MapCanvas`, which uses it to place its own notices, and to
 * `CountrySearch`, which clamps its fly-to against it. Two numbers that
 * disagreed put a searched country underneath the panel describing it.
 */
export function cameraPadding(geometry: ShelfGeometry): EdgePadding {
  const gutter = geometry.wide ? CHROME_GUTTER.lg : CHROME_GUTTER.base
  const top = gutter + SEARCH_HEIGHT + CHROME_GAP
  const controls = gutter + geometry.controls + CHROME_GAP

  return {
    // The zoom cluster is the top-right corner below `lg` and the bottom-right
    // corner from `lg`, so it costs the right edge either way.
    top: geometry.wide ? top : Math.max(top, controls),
    right: controls,
    bottom: shelfClear(geometry),
    left: gutter,
  }
}

/* ------------------------------------------------------------------- camera */

/** MapLibre's own tile size, and therefore the width of the world at zoom 0. */
export const WORLD_TILE_SIZE = 512

/**
 * Where the map opens, and why it is a centre and a zoom rather than a
 * rectangle.
 *
 * Two MapLibre facts decide it, and both were measured rather than assumed. The
 * camera is *always* constrained so the Mercator square covers the container
 * vertically — `latRange` defaults to ±85.05 and cannot be widened — so the world
 * can never be smaller than the canvas is tall. And with `renderWorldCopies`
 * off, which it must be or a wide screen highlights every visited country two
 * and a bit times, nothing fills the space either side of the world: handing
 * `fitBounds` a world rectangle produced a square map letterboxed in 300px of
 * page colour on both flanks.
 *
 * So the opening zoom is stated rather than fitted: the one that makes a single
 * world exactly span the longer edge of the container. It is also the floor, so
 * zooming out can never reach the letterbox.
 *
 * The latitude is 14°S rather than the equator because the shelf covers the foot
 * of the map, and a centred camera puts the middle of the world behind it. 14°S
 * is the southernmost centre that still keeps Iceland, the northernmost country
 * on our own record, above the shelf, and it buys about forty degrees of
 * southern hemisphere for it.
 */
export const WORLD_CENTRE: readonly [number, number] = [0, -14]

/**
 * Normalised Web Mercator y for a latitude: `0` at the north edge of the square,
 * `1` at the south edge, `0.5` on the equator.
 */
export function mercatorY(lat: number): number {
  const clamped = Math.min(
    Math.max(lat, -MAX_MERCATOR_LATITUDE),
    MAX_MERCATOR_LATITUDE,
  )
  const radians = (clamped * Math.PI) / 180
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI)
}

/** A container's box in CSS pixels. */
export interface ViewportBox {
  readonly width: number
  readonly height: number
}

/**
 * The zoom at which one world exactly spans the container's longer edge.
 *
 * Rounded to three places to keep the number readable in a URL or a log, and
 * rounded *up* rather than to nearest: this value is also the zoom floor, and
 * `log2(700/512)` truncated downwards leaves the world 0.1px narrower than the
 * container, which MapLibre silently corrects by zooming in and re-centring on
 * the latitude range's midpoint — losing the 14°S the frame was chosen for.
 */
export function worldZoom(box: ViewportBox): number {
  const edge = Math.max(box.width, box.height, 1)
  const exact = Math.log2(edge / WORLD_TILE_SIZE)
  return Math.ceil(exact * 1000) / 1000
}

/** The width of one world at the opening zoom, in CSS pixels. */
export function worldSize(box: ViewportBox): number {
  return WORLD_TILE_SIZE * 2 ** worldZoom(box)
}

/**
 * How far the map canvas overhangs its visible frame on each side, in CSS
 * pixels.
 *
 * The atlas is the one map in the product with `renderWorldCopies` off, which
 * makes the world's own edge — the antimeridian — coincide exactly with the
 * canvas's left and right edges. Two things are drawn on that line: the
 * generated graticule's first meridian, at -180°, and the outline stroke of every
 * country whose ring touches the date line, Antarctica and Russia among them.
 * Half of each lands inside the frame and the other half outside, which reads as
 * a one-pixel rendering seam down the edge of the screen rather than as the
 * feature it is.
 *
 * So the canvas is a pixel wider than its frame on both sides and the frame
 * clips it. The world still spans the frame exactly — MapLibre's own longitude
 * constraint sees the wider container — and the line on the seam falls outside.
 * The static world behind it takes the same overhang, so the two stay in step.
 */
const CANVAS_OVERHANG = 1

/** The canvas's box, given the frame it overhangs. */
export function canvasBox(frame: ViewportBox): ViewportBox {
  return {
    width: frame.width + CANVAS_OVERHANG * 2,
    height: frame.height,
  }
}

/**
 * How far the world is lifted above a container-centred position, in CSS pixels.
 *
 * The static SVG world draws the whole Mercator square scaled to cover the
 * container, which is exactly what {@link worldZoom} produces for a camera
 * centred on the equator. {@link WORLD_CENTRE} is not the equator, so the
 * fallback has to shift by the same amount MapLibre does — and no further:
 * MapLibre's own constraint keeps the square covering the container vertically,
 * so the lift is capped at the slack there actually is. That cap is why the
 * hand-off is motionless on a phone, where there is none.
 *
 * The fallback ships {@link WORLD_FRAME_CSS}.lift, which states the same thing
 * in container query units so the browser resolves it with no measurement. This
 * is its arithmetic twin: the invariant written as numbers, where it can be
 * asserted against a real container at a real width rather than read out of a
 * CSS string.
 */
export function worldFrameLift(box: ViewportBox): number {
  const size = worldSize(box)
  const wanted = (mercatorY(WORLD_CENTRE[1]) - 0.5) * size
  const available = Math.max((size - box.height) / 2, 0)
  return Math.min(wanted, available)
}

/**
 * The same lift as a CSS length, resolved by the browser against the container
 * rather than by us against a measurement.
 *
 * Container query units mean the static world is already in the right place in
 * the server-rendered document: there is no measure-then-move frame, and
 * therefore nothing to shift after paint. `cqh` needs a size container, which is
 * why the element carrying these is `@container-size`.
 */
export const WORLD_FRAME_CSS = {
  /** `max(cqw, cqh)` — the longer edge, which one world spans. */
  edge: 'max(100cqw, 100cqh)',
  lift: `min(calc(${(mercatorY(WORLD_CENTRE[1]) - 0.5).toFixed(5)} * max(100cqw, 100cqh)), max(calc((max(100cqw, 100cqh) - 100cqh) / 2), 0px))`,
} as const
