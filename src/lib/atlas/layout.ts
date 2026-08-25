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
 * box is `--safe-top + --impersonation-h + --nav-h + 1px` — the impersonation
 * bar is `0rem` on every ordinary session and one whole row while an operator is
 * wearing somebody else's account; the mobile tab bar is `border-t`, so its
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
  /**
   * `--impersonation-h`, in CSS pixels.
   *
   * `0` on every ordinary session, and the warning bar's whole border box while
   * `AppShell` is rendering one (`docs/ACCESS.md` §6.1). It is an inset like any
   * other rather than a special case, which is the only way this file can stay
   * true of both states: a term that is zero most of the time is still a term,
   * and the one it would otherwise be missing from is the screen that owns the
   * whole viewport.
   */
  readonly impersonationHeight: number
  /** `--subnav-h`, in CSS pixels. 3rem in the token file. */
  readonly subnavHeight: number
}

/**
 * The app header, in full.
 *
 * `src/components/layout/top-nav.tsx` is `sticky … border-b` around an `h-nav`
 * row, so its border box is the nav row and the hairline. `--nav-h` names the row
 * and nothing else; the hairline is real layout and every viewport-height
 * expression in the product has to account for it.
 *
 * The safe area and the impersonation bar are listed above the nav because that
 * is the order they occupy: the bar carries `pt-safe` and pins at the viewport
 * top when it exists, and the nav carries it and pins there when it does not.
 * Either way the distance from the top of the screen to the foot of the chrome is
 * this list, summed, and the bar's term is `0rem` in the ordinary case.
 */
export const APP_HEADER: ReadonlyArray<ChromeInset> = [
  { name: 'top safe area', css: 'var(--safe-top)', px: (env) => env.safeTop },
  {
    name: 'impersonation bar',
    css: 'var(--impersonation-h)',
    px: (env) => env.impersonationHeight,
  },
  { name: 'nav row', css: 'var(--nav-h)', px: (env) => env.navHeight },
  { name: 'nav hairline', css: '1px', px: () => 1 },
]

/**
 * The mobile tab bar, in full — `border-t` around `h-16`, plus the home
 * indicator. It is `fixed`, so it covers whatever is behind it rather than
 * displacing it: a full-bleed slice has to stop at its top edge or the map shows
 * through it, and the browser has to be told not to scroll anything into the row
 * it occupies. {@link BOTTOM_CLEARANCE_CSS} is that second reservation, and this
 * list is the one place either of them is measured.
 */
export const MOBILE_TAB_BAR: ReadonlyArray<ChromeInset> = [
  { name: 'tab bar hairline', css: '1px', px: () => 1 },
  // `h-16` in `src/components/layout/mobile-nav.tsx`, written as the literal it
  // is rather than as `--nav-h`: the two are the same 4rem today, and the token
  // names the *header's* row. The test beside this file asserts they agree, so
  // the day one of them moves is a red test rather than a two-pixel mystery.
  { name: 'tab bar row', css: '4rem', px: () => 64 },
  {
    name: 'bottom safe area',
    css: 'var(--safe-bottom)',
    px: (env) => env.safeBottom,
  },
]

/**
 * The trip workspace's own chrome: the band under the app header carrying the
 * trip's name and its tabs.
 *
 * `src/components/layout/trip-sub-nav.tsx` is `sticky … border-b` around an
 * `h-subnav` row, and below `lg` it puts the trip's name on a row of its own
 * above that. Both rows and the hairline are real layout, and the planner's own
 * viewport slice sits underneath all of them.
 */
export const TRIP_SUBNAV: ReadonlyArray<ChromeInset> = [
  { name: 'trip name row', css: '2.75rem', px: () => 44 },
  { name: 'tab row', css: 'var(--subnav-h)', px: (env) => env.subnavHeight },
  { name: 'sub-nav hairline', css: '1px', px: () => 1 },
]

/** From `lg` the trip's name shares the tab row, so that row goes away. */
export const TRIP_SUBNAV_WIDE: ReadonlyArray<ChromeInset> = TRIP_SUBNAV.slice(1)

/** A list of insets summed as a CSS length: `calc(a + b + c)`. */
export function insetSumCss(insets: ReadonlyArray<ChromeInset>): string {
  return `calc(${insets.map((inset) => inset.css).join('+')})`
}

/** The same list summed in CSS pixels. */
export function insetSum(
  insets: ReadonlyArray<ChromeInset>,
  env: ChromeEnvironment,
): number {
  return insets.reduce((total, inset) => total + inset.px(env), 0)
}

/**
 * Where a bar pinned under the app header has to stick.
 *
 * The header's whole border box, hairline included — which is the term the two
 * sub-navigations were missing, so each of them sat one pixel high and painted
 * over the header's own hairline. A literal string because Tailwind reads source
 * text; the test asserts it is exactly {@link insetSumCss} of
 * {@link APP_HEADER}, so the two cannot drift.
 */
export const APP_HEADER_TOP_CLASS =
  'top-[calc(var(--safe-top)+var(--impersonation-h)+var(--nav-h)+1px)]'

/**
 * The tab bar's box as a CSS length.
 *
 * The bar is `fixed`: it takes no space and covers what is behind it. Two
 * separate reservations answer that, and both read this one expression —
 * `AppShell`'s {@link SHELL_BOTTOM_CLASS}, which gives the box real height at
 * the foot of the outlet, and the `scroll-padding-bottom` beside it in
 * `src/styles/styles.css`, which tells the browser where to stop when it scrolls
 * something into view. Published from the list that measures the bar so none of
 * the three can disagree about how tall it is.
 */
export const BOTTOM_CLEARANCE_CSS = insetSumCss(MOBILE_TAB_BAR)

/**
 * What `AppShell` reserves at the foot of the outlet, per breakpoint.
 *
 * The top edge of the viewport is the shell's — `--impersonation-h` — and so is
 * the bottom one. Below `lg` the tab bar is `fixed`, so it displaces nothing and
 * covers the last row of whatever is behind it; from `lg` it is not rendered at
 * all and there is nothing to clear.
 *
 * It is reserved *once, around the outlet* rather than per route, because a
 * route is free not to use the content well: `AppFrame`'s `bleed` branch is the
 * map surfaces, and a screen that renders neither still renders inside this
 * shell. A reservation that only exists where a component remembered to add it
 * is not a reservation.
 *
 * The arithmetic composes exactly with {@link sliceHeight}: a full-bleed slice
 * already stops at the bar's top edge below `lg`, so adding the same box back
 * underneath it leaves {@link documentHeight} at precisely one viewport at both
 * breakpoints, rather than one viewport minus a bar.
 */
export function shellBottomReserve(wide: boolean): ReadonlyArray<ChromeInset> {
  return wide ? [] : MOBILE_TAB_BAR
}

/**
 * That reservation, as the Tailwind utilities `AppShell` ships.
 *
 * Literal source text, like {@link SLICE_HEIGHT_CLASS} and for the same reason —
 * a class assembled at runtime generates no CSS. `pb-tab-bar` is declared beside
 * `pb-safe` in `src/styles/styles.css` from {@link BOTTOM_CLEARANCE_CSS}, and
 * `src/styles/__tests__/layout-tokens.test.ts` asserts the two agree.
 */
export const SHELL_BOTTOM_CLASS = 'pb-tab-bar lg:pb-0'

/** Every inset the slice gives up, at one breakpoint. */
function sliceInsets(wide: boolean): ReadonlyArray<ChromeInset> {
  return wide ? APP_HEADER : [...APP_HEADER, ...MOBILE_TAB_BAR]
}

/** Every inset the trip planner's own slice gives up, at one breakpoint. */
function tripSliceInsets(wide: boolean): ReadonlyArray<ChromeInset> {
  return wide
    ? [...APP_HEADER, ...TRIP_SUBNAV_WIDE]
    : [...APP_HEADER, ...TRIP_SUBNAV, ...MOBILE_TAB_BAR]
}

/** The trip planner's slice height as a CSS length, from its own insets. */
export function tripSliceHeightCss(wide: boolean): string {
  const terms = tripSliceInsets(wide)
    .map((inset) => `-${inset.css}`)
    .join('')
  return `calc(100svh${terms})`
}

/** The same height in CSS pixels. */
export function tripSliceHeight(env: ChromeEnvironment, wide: boolean): number {
  return tripSliceInsets(wide).reduce(
    (height, inset) => height - inset.px(env),
    env.viewport,
  )
}

/**
 * How tall the document ends up on a trip screen that owns the viewport.
 *
 * The header and the sub-navigation are both in flow, the tab bar is `fixed`,
 * and the shell reserves the tab bar's box under the outlet — so this is those
 * three plus the slice. Anything over `viewport` is a scrollbar on a screen that
 * has declared it owns the viewport — and this expression was two pixels over
 * it, one for each hairline, until the planner's height was derived from these
 * lists rather than written out by hand.
 */
export function tripDocumentHeight(
  env: ChromeEnvironment,
  wide: boolean,
): number {
  const chrome = wide
    ? [...APP_HEADER, ...TRIP_SUBNAV_WIDE]
    : [...APP_HEADER, ...TRIP_SUBNAV]
  return (
    insetSum(chrome, env) +
    tripSliceHeight(env, wide) +
    insetSum(shellBottomReserve(wide), env)
  )
}

/**
 * The collaboration rail, pinned below both bars with a gutter of its own.
 *
 * Not a viewport slice: the rail scrolls with the page until it reaches the foot
 * of the chrome and then stays. It composes the same list for the same reason —
 * a rail that stops one pixel high tucks its top edge under the sub-navigation's
 * hairline, which reads as a rendering fault rather than as a sticky element.
 */
export const TRIP_RAIL_STICKY_CLASS =
  'xl:top-[calc(var(--safe-top)+var(--impersonation-h)+var(--nav-h)+1px+var(--subnav-h)+1px+1.5rem)]'

/**
 * The trip planner's slice, as the two Tailwind utilities the screen ships.
 *
 * The same contract as {@link SLICE_HEIGHT_CLASS}: literal strings, because a
 * class assembled at runtime generates no CSS, with a test asserting each one
 * carries exactly {@link tripSliceHeightCss} for its breakpoint.
 */
export const TRIP_SLICE_HEIGHT_CLASS = {
  base: 'h-[calc(100svh-var(--safe-top)-var(--impersonation-h)-var(--nav-h)-1px-2.75rem-var(--subnav-h)-1px-1px-4rem-var(--safe-bottom))]',
  lg: 'lg:h-[calc(100svh-var(--safe-top)-var(--impersonation-h)-var(--nav-h)-1px-var(--subnav-h)-1px)]',
} as const

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
 * The app shell is `min-h-svh` around a header, a `flex-1` outlet and the box it
 * reserves for the tab bar, so this is the header, the slice and that box.
 * Anything over `viewport` is a scrollbar on a screen that has declared it owns
 * the viewport; anything under it is dead canvas below a full-bleed surface.
 */
export function documentHeight(env: ChromeEnvironment, wide: boolean): number {
  return (
    insetSum(APP_HEADER, env) +
    sliceHeight(env, wide) +
    insetSum(shellBottomReserve(wide), env)
  )
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
  base: 'h-[calc(100svh-var(--safe-top)-var(--impersonation-h)-var(--nav-h)-1px-1px-4rem-var(--safe-bottom))]',
  lg: 'lg:h-[calc(100svh-var(--safe-top)-var(--impersonation-h)-var(--nav-h)-1px)]',
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
