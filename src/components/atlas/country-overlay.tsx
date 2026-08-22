import * as React from 'react'
import { createPortal } from 'react-dom'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'

import { IconButton, ScrollArea } from '#/components/ui'
import {
  VISITED_COUNTRY_ZOOM,
  VisitedCountries,
  useMapContext,
} from '#/components/map'
import {
  boundsForPoints,
  countryDetail,
  countryFeatures,
  subscribeCountryDetail,
} from '#/lib/map'
import { countryFacts } from '#/lib/atlas/country-facts'
import { cn } from '#/lib/cn'
import { CountryActions } from './country-actions'
import {
  CountryCard,
  CountryCardError,
  CountryCardSkeleton,
} from './country-card'

import type { CountryActionsGoal, CountryActionsVisit } from './country-actions'
import type { CountryFactColumns } from '#/lib/atlas/country-facts'
import type { MapVisitedCountry } from '#/components/map'
import type {
  CountryFeatureCollection,
  EdgePadding,
  LngLat,
  MapBounds,
} from '#/lib/map'

/**
 * The map's own answer about one country: a hover card that follows the
 * pointer's country, and a click surface that stays put and can be acted on.
 *
 * The screen this replaces reported a click seven hundred pixels away, at the
 * foot of a shelf, and reported a hover not at all — `VisitedCountries` has
 * shipped `onHoverChange` since it was written and nothing had ever listened to
 * it. Everything below is that wire, plus the three hard parts a floating map
 * surface actually consists of: where to put it, how to keep it there while the
 * world moves under it, and how a reader who is not holding a mouse reaches the
 * same facts.
 *
 * **One surface family, two moments.** The reference this screen is judged
 * against ships two disjoint things: a hover card that carries the figures and
 * cannot be acted on, and a click card that carries actions and drops the
 * figures. A reader therefore has to remember what hovering said in order to use
 * what clicking offers. Here both moments are `CountryCard`, struck from one
 * component and one formatter (`countryFacts`), and the click surface is that
 * same card with `CountryActions` joined to it. Nothing the pointer says
 * disappears when the reader commits to it.
 *
 * **Anchored to the shape, never over it.** The reference anchors on the
 * country's centroid, so the card covers the very country it describes — and on
 * a sovereign cut, where France owns Guadeloupe and Réunion, a centroid is in
 * the Atlantic off West Africa. Here the anchor is the projected rectangle of
 * the *landmass under the pointer*: the polygon the reader is actually pointing
 * at, chosen out of that country's rings by proximity, so pointing at French
 * Guiana anchors in South America and pointing at Brittany anchors in Europe.
 * The surface is then placed on whichever side of that rectangle has room — see
 * {@link placeCountrySurface} — and never on top of it.
 *
 * **And anchored to the map's edge once the shape has left it.** Zoom in and
 * drag, and the country a surface belongs to goes off the side of the map. The
 * hover card is decoration and simply stops being drawn; the click surface must
 * not, because hiding a non-modal dialog does not merely conceal it — it makes
 * everything inside unfocusable, which drops the reader's focus to the document
 * body and leaves an open dialog no key can reach. {@link anchorSpan} clamps the
 * rectangle to the map instead, leaving a stub on the edge the country went out
 * of, so the surface stays on screen, stays operable, and its tip points the way
 * back.
 *
 * **Two clear areas, not one.** The hover card is an enhancement, so it may only
 * occupy map the chrome has left free: it never lands on the search pill, the
 * zoom cluster or the shelf, and where there is no room for it, it is simply not
 * drawn. The click surface is the only place a touch reader can act, so it is
 * allowed a second, looser area that reaches down over the shelf when a phone
 * leaves it nowhere else. Both areas are derived from the screen's own
 * `cameraPadding()` declaration rather than from a second set of insets invented
 * here.
 *
 * **A phone gets a composition, not a smaller desktop.** Stacked, the click
 * panel is a 182px fact card over an action block, and it wants five hundred and
 * forty pixels — where a 360px handset has about five hundred and seventy of map
 * and an iPhone in Safari, once its two bars are out, has five hundred and
 * twenty-nine. At full height no side of a framed country ever fits, and the
 * placement used to answer that by centring the panel on the very shape it
 * describes: four fifths of the map covered, no tip, and the country the reader
 * had just pressed underneath the panel about it. So the panel now states a
 * floor it will not go below — {@link PANEL_MIN_HEIGHT} — and gives up height
 * instead, taking the side of the country with the most room; where even the
 * floor will not clear the shape it docks to the edge the country is furthest
 * from rather than sit on top of it. The block inside scrolls behind a mask fade
 * with a bar that is drawn for exactly as long as there is more to read, and the
 * fact card above it never scrolls, so nothing that identifies the country can
 * be cut. Squeezed, the surface is given a *height* and not merely a ceiling:
 * `max-height` alone leaves it indefinite, a percentage height inside an
 * indefinite box resolves to `auto`, and the scroll region grew to its content
 * behind a parent that clips — which put the second write in a strip no gesture
 * could reach.
 *
 * **Hover costs one render per country, not one per pointer frame.** MapLibre
 * fires `mousemove` for every pixel of pointer travel. `VisitedCountries`
 * already dedupes by code before it calls back, and the state that code lands in
 * lives *here* rather than on the screen — so the atlas panel, the countries
 * list and the 237-feature payload memo above this component never see a
 * crossing at all. The pointer's own position is recorded in a ref by a listener
 * registered before the paint layer's, and the paint layer itself is held as a
 * memoised element, so a crossing cannot re-render that either. The test beside
 * this file counts renders on both halves.
 *
 * **The anchor follows a pan without React.** While a surface is open its
 * rectangle is re-projected on MapLibre's own `move` event and written straight
 * onto the element as a transform, a `data-side` and a `--pt-tip` offset. No
 * state changes, so nothing re-renders, and the card stays glued to its country
 * through a drag, a fly-to and a pinch.
 *
 * **Hover is never the only route.** It is `aria-hidden`, and it duplicates
 * nothing — the panel's country record, the countries list and the country
 * search all carry the same facts, and the same two writes are in the shelf as
 * well as here. It does not exist on touch: `VisitedCountries` clears hover on
 * `touchstart`, and this component additionally stands the hover surface down
 * for as long as the last thing to touch the map was a finger, so a tap can
 * never strand a pill behind the surface it opened.
 *
 * **The click surface is a real dialog.** Radix's non-modal `Dialog` gives it
 * `role="dialog"`, an accessible name, Escape, and focus moved into it on open;
 * closing returns focus to the map canvas, which is a tab stop MapLibre already
 * provides. The page behind stays live, because the map behind it is the
 * subject. Both of Radix's own dismissals are stood down on purpose, because
 * this surface belongs to the *selection* rather than to the pointer: the map
 * decides what a press means (another country moves it, open water clears the
 * selection and closes it), the search, the shelf's list and the record all
 * drive the same selection, and the map's own zoom cluster is not "outside" in
 * any sense a reader recognises. Focus *leaving* is not a dismissal either — it
 * is non-modal, and Radix's default closed the panel the instant the country
 * search handed focus back to its own trigger. What is left closes on Escape, on
 * its own control, and when the selection goes away — and for the 150ms it
 * spends leaving it stops answering a press, because a control the reader can
 * see fading away should not be one they can still hit, and two of the controls
 * under it rewrite the traveller's record.
 *
 * **And focus opens on the panel, not on a control in it.** Both of the obvious
 * answers are wrong. Radix's default is the first tab stop, which for a country
 * already on the record reads "Remove … from your atlas" — a panel that opens
 * with the undo of somebody's travel history under the space bar. Moving focus
 * to the dismissal instead traded that for a second defect: the dismissal is
 * *last* in the panel, so the very first Tab left it and the two writes this
 * surface exists for were reachable only backwards. The container is focusable
 * and never a tab stop: a screen reader announces the dialog and the country,
 * and a forward Tab walks into the block rather than out of the panel.
 *
 * **And non-modal is made to mean it.** Radix says a non-modal dialog does not
 * trap focus, and it does not — but it renders one inside a focus scope with
 * `loop` hard-wired on, and that scope loops a Tab press at either edge whether
 * or not it is trapped. The result was a panel that called itself non-modal and
 * bounced every Tab off its own last control, so the shelf, the search field and
 * the map behind it could not be reached by keyboard while it was open.
 * {@link leaveOnTabEdge} settles the press first — it runs before Radix's own
 * handler — by moving focus to the document's next tab stop outside the panel,
 * which leaves that handler nothing to bite on. Forwards that is the shelf,
 * backwards it is the map's own chrome, in the order the document already has.
 *
 * **And it leaves rather than blinking out.** Radix can defer its own content's
 * unmount for an exit animation, but only if the layer above it is still there —
 * and while the open country was derived from the selection, the commit that
 * closed the surface tore the whole subtree down in the same frame, so a
 * `data-[state=closed]` pop-out was styling nothing could ever see.
 * {@link useExitPresence} holds the last target for the length of the exit, and
 * both surfaces use it.
 *
 * **It sits in the layer the tokens reserved for it.** `--z-map-surface` is one
 * step above `--z-map-overlay`, which the shelf and the search pill use, and
 * both are below `--z-nav`. Nothing here portals to `document.body`: the
 * surfaces render into a host the screen provides inside its own clipped slice,
 * so they can pass over the shelf on a phone and can never pass over the app
 * header or the mobile tab bar.
 */

/* ---------------------------------------------------------------- placement */

/** A rectangle in the host layer's own pixels. */
export interface SurfaceBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Which side of the anchor the surface sits on. */
export type SurfaceSide = 'top' | 'bottom' | 'left' | 'right'

export interface SurfacePlacement {
  readonly x: number
  readonly y: number
  readonly side: SurfaceSide
  /**
   * Where the pointer tip goes along the surface's edge, in pixels from its left
   * (for `top`/`bottom`) or its top (for `left`/`right`) — or `null` when the
   * surface had to be clamped so far that a tip would point at open water.
   */
  readonly tip: number | null
  /** True when the surface cleared both the shape and the chrome. */
  readonly clear: boolean
  /**
   * The height the surface was placed at, in pixels, when clearing the shape
   * meant giving some of it up — and `null` when it was placed at the height it
   * asked for.
   *
   * This is the phone's whole answer. A 360px handset has about 570 usable
   * pixels of map and a panel that carries a fact grid *and* two writes wants
   * five hundred and forty of them, so at full height no side of the country
   * ever fits and the surface used to fall back to being centred on the very
   * shape it describes. Squeezed, it sits below the country with the country
   * still on screen, and the block inside it scrolls — which is a designed
   * phone composition rather than a desktop panel dropped onto a phone.
   */
  readonly height: number | null
}

/** The gap between the shape and the surface. `--space-2`. */
const SURFACE_GAP = 8

/**
 * How close to a corner the tip may sit before it is dropped.
 *
 * The tip is an 8px square turned 45°, and the surface's corner is
 * `--radius-lg`. Inside this margin the tip would grow out of a curve rather
 * than out of a straight edge, which reads as a rendering fault.
 */
const TIP_INSET = 16

/** The order sides are offered in: above the shape first, as the eye expects. */
const SIDES: ReadonlyArray<SurfaceSide> = ['top', 'bottom', 'right', 'left']

function clamp(value: number, low: number, high: number): number {
  if (high <= low) return low
  return Math.min(Math.max(value, low), high)
}

/** The smallest rectangle a tip can sensibly point at. */
const MIN_ANCHOR = 12

/** One axis of an anchor, brought back inside the map's own edge. */
export interface AnchorSpan {
  readonly start: number
  readonly size: number
  /** False once the shape has left this axis of the map altogether. */
  readonly onScreen: boolean
}

/**
 * One axis of the shape's rectangle, clipped to the map and never to nothing.
 *
 * A country is only on screen while the reader leaves it there. Zoom into
 * Lisbon with Spain's panel open, or drag the Atlantic under it, and the shape
 * the surface belongs to is off the edge — and a surface that answers that by
 * disappearing takes a reader's focus with it and leaves an open dialog nobody
 * can reach. So the span is clamped rather than dropped: the visible part of the
 * shape if there is one, and otherwise a {@link MIN_ANCHOR} stub pinned to the
 * edge the shape went out of, which keeps the surface on screen and its tip
 * pointing the way back. `onScreen` is the honest report of which of the two
 * happened, for the one caller — the decorative hover card — that would rather
 * not be drawn at all.
 */
export function anchorSpan(
  low: number,
  high: number,
  boxLow: number,
  boxHigh: number,
): AnchorSpan {
  const room = Math.max(boxHigh - boxLow, 0)
  const start = clamp(low, boxLow, boxHigh)
  const end = clamp(high, boxLow, boxHigh)
  const size = Math.min(Math.max(end - start, MIN_ANCHOR), room)
  const centre = (start + end) / 2
  return {
    start: clamp(centre - size / 2, boxLow, Math.max(boxHigh - size, boxLow)),
    size,
    onScreen: high > boxLow && low < boxHigh,
  }
}

/** One side's offer, or `null` when the surface would leave the area. */
function offerSide(
  side: SurfaceSide,
  anchor: SurfaceBox,
  size: { readonly width: number; readonly height: number },
  area: SurfaceBox,
  gap: number,
): { readonly x: number; readonly y: number } | null {
  if (side === 'top' || side === 'bottom') {
    const y =
      side === 'top'
        ? anchor.y - gap - size.height
        : anchor.y + anchor.height + gap
    if (y < area.y || y + size.height > area.y + area.height) return null
    return {
      x: clamp(
        anchor.x + anchor.width / 2 - size.width / 2,
        area.x,
        area.x + area.width - size.width,
      ),
      y,
    }
  }
  const x =
    side === 'left'
      ? anchor.x - gap - size.width
      : anchor.x + anchor.width + gap
  if (x < area.x || x + size.width > area.x + area.width) return null
  return {
    x,
    y: clamp(
      anchor.y + anchor.height / 2 - size.height / 2,
      area.y,
      area.y + area.height - size.height,
    ),
  }
}

/** Where the tip lands, or `null` when it would not point at the shape. */
function tipFor(
  side: SurfaceSide,
  spot: { readonly x: number; readonly y: number },
  anchor: SurfaceBox,
  size: { readonly width: number; readonly height: number },
): number | null {
  const horizontal = side === 'top' || side === 'bottom'
  const centre = horizontal
    ? anchor.x + anchor.width / 2
    : anchor.y + anchor.height / 2
  const extent = horizontal ? size.width : size.height
  const offset = centre - (horizontal ? spot.x : spot.y)
  if (offset < TIP_INSET || offset > extent - TIP_INSET) return null
  return Math.round(offset)
}

export interface PlaceSurfaceInput {
  /** The shape's projected rectangle. */
  readonly anchor: SurfaceBox
  readonly size: { readonly width: number; readonly height: number }
  /**
   * The rectangles the surface may occupy, tried in order. The first is the
   * strict one — map the chrome has left free — and the last is the fallback a
   * surface that must stay reachable is allowed to drop to.
   */
  readonly areas: ReadonlyArray<SurfaceBox>
  readonly gap?: number
  /**
   * The shortest the surface may be squeezed to in order to clear the shape.
   *
   * Omitted for a surface that would rather not be drawn at all — the hover card
   * is decoration, and decoration that has to be shortened to fit has already
   * lost the argument. Given, the placement is allowed a second pass in which the
   * surface gives up height to the side with the most room, which is what turns
   * a phone's click panel from a slab centred on the country into a sheet
   * beneath it.
   */
  readonly minHeight?: number
}

/** The two sides a surface may be squeezed onto. A sheet is never a column. */
const SQUEEZE_SIDES: ReadonlyArray<'top' | 'bottom'> = ['bottom', 'top']

/**
 * The area with the most room in it, whatever order they were offered in.
 *
 * Offered order is a preference — the strictest first — and the last resort is
 * the opposite question: which of them holds the most. The two used to be the
 * same list read from both ends, which was true only for as long as the widest
 * area happened to be the last one. It stopped being true the moment a screen
 * wider than the product's measure grew a narrow chrome-free band beyond it.
 */
function roomiest(areas: ReadonlyArray<SurfaceBox>): SurfaceBox | undefined {
  let best: SurfaceBox | undefined
  for (const area of areas) {
    if (
      best === undefined ||
      area.width * area.height > best.width * best.height
    ) {
      best = area
    }
  }
  return best
}

/** How much room one side of the anchor leaves inside one area. */
function roomBeside(
  side: 'top' | 'bottom',
  anchor: SurfaceBox,
  area: SurfaceBox,
  gap: number,
): number {
  return side === 'bottom'
    ? area.y + area.height - (anchor.y + anchor.height + gap)
    : anchor.y - gap - area.y
}

/**
 * Where a surface goes, given the shape it belongs to and the room there is.
 *
 * Pure arithmetic on four rectangles, so the whole collision behaviour is
 * provable without a map, a browser or a viewport. Every side is offered in turn
 * and the first that fits *entirely inside an area and entirely outside the
 * shape* wins; the cross axis is then clamped into the area, which is what keeps
 * a card for a country at the edge of the screen on screen.
 *
 * A surface that states a {@link PlaceSurfaceInput.minHeight} gets a second pass
 * before it gives up: above and below are offered again with the surface
 * shortened to the room that side actually has, and the taller of the two wins.
 * That answer still clears the shape — it is `clear: true` — and it carries the
 * height it was placed at, so the caller can cap the surface and let the block
 * inside it scroll.
 *
 * When no side fits in any area, at any height, the surface is centred on the
 * shape and clamped, and the answer is marked `clear: false`. A caller whose
 * surface is decoration — the hover card — declines to draw that; a caller whose
 * surface is the only way to act declines to hide it.
 */
export function placeCountrySurface({
  anchor,
  size,
  areas,
  gap = SURFACE_GAP,
  minHeight,
}: PlaceSurfaceInput): SurfacePlacement | null {
  for (const area of areas) {
    if (size.width > area.width || size.height > area.height) continue
    for (const side of SIDES) {
      const spot = offerSide(side, anchor, size, area, gap)
      if (spot === null) continue
      return {
        x: Math.round(spot.x),
        y: Math.round(spot.y),
        side,
        tip: tipFor(side, spot, anchor, size),
        clear: true,
        height: null,
      }
    }
  }

  if (minHeight !== undefined && minHeight < size.height) {
    for (const area of areas) {
      if (size.width > area.width) continue
      // Per area rather than across all of them, so the strict area still wins
      // over the looser one even when the looser one could hold more of the
      // surface: the chrome is there to be cleared, not to be outbid.
      let best: SurfacePlacement | null = null
      for (const side of SQUEEZE_SIDES) {
        const height = Math.min(
          size.height,
          Math.floor(roomBeside(side, anchor, area, gap)),
        )
        if (height < minHeight) continue
        const squeezed = { width: size.width, height }
        const spot = offerSide(side, anchor, squeezed, area, gap)
        if (spot === null) continue
        if (best !== null && (best.height ?? 0) >= height) continue
        best = {
          x: Math.round(spot.x),
          y: Math.round(spot.y),
          side,
          tip: tipFor(side, spot, anchor, squeezed),
          clear: true,
          height,
        }
      }
      if (best !== null) return best
    }
  }

  const area = roomiest(areas)
  if (area === undefined) return null

  // Docked, which is the last honest answer before the worst one.
  //
  // Some maps are simply shorter than the surface plus the country: an iPhone in
  // Safari, whose two bars leave 529 pixels of world, cannot hold a panel that
  // clears a framed country at any usable height. Centred on the shape it covers
  // the country *and* the world either side of it, which is the state the
  // reference ships and the one this screen was rejected for. Docked, the sheet
  // takes the edge the country is furthest from, stops as close to the country as
  // the floor allows, and leaves the search pill and a third of the world above
  // it. It still overlaps, so it still reports `clear: false` — decoration
  // declines to draw this, and only the surface that has to stay reachable takes
  // it.
  if (minHeight !== undefined && area.height >= minHeight) {
    const below = anchor.y + anchor.height / 2 <= area.y + area.height / 2
    const edge = area.y + area.height
    const x = Math.round(
      clamp(
        anchor.x + anchor.width / 2 - size.width / 2,
        area.x,
        area.x + Math.max(area.width - size.width, 0),
      ),
    )
    if (below) {
      const top = clamp(
        anchor.y + anchor.height + gap,
        area.y,
        edge - minHeight,
      )
      const height = Math.min(size.height, Math.floor(edge - top))
      return {
        x,
        y: Math.round(edge - height),
        side: 'bottom',
        tip: null,
        clear: false,
        height,
      }
    }
    const bottom = clamp(anchor.y - gap, area.y + minHeight, edge)
    const height = Math.min(size.height, Math.floor(bottom - area.y))
    return {
      x,
      y: Math.round(area.y),
      side: 'top',
      tip: null,
      clear: false,
      height,
    }
  }

  return {
    x: Math.round(
      clamp(
        anchor.x + anchor.width / 2 - size.width / 2,
        area.x,
        area.x + Math.max(area.width - size.width, 0),
      ),
    ),
    y: Math.round(
      clamp(
        anchor.y + anchor.height / 2 - size.height / 2,
        area.y,
        area.y + Math.max(area.height - size.height, 0),
      ),
    ),
    side: 'top',
    tip: null,
    clear: false,
    height: null,
  }
}

/**
 * The width at which the zoom cluster stops being the map's top-right corner.
 *
 * `AtlasScreen`'s chrome puts the cluster at `top-3 right-3` and moves it to
 * `lg:bottom-(--atlas-clear) lg:right-4` — so below `lg` the room it costs is at
 * the top, which {@link cameraPadding} already charges to `padding.top`, and the
 * right inset it also charges is the same room counted twice. A surface that has
 * come down to the bottom of a phone's map is nowhere near the cluster, and the
 * duplicate inset is what left a 54px ribbon of shelf showing down the side of a
 * panel that was otherwise the width of the composition.
 */
const CONTROLS_MOVE_AT = 1024

/**
 * The areas a surface may occupy, from the insets the screen declared and the
 * column it lays its chrome out in.
 *
 * `cameraPadding()` is already the one place this screen states how much of each
 * edge its chrome covers — the camera is told the same four numbers — so the
 * insets are that rectangle exactly. What the insets alone cannot say is *where*
 * those edges are on a screen wider than the product's measure: the search pill,
 * the zoom cluster, the credit and the shelf are positioned inside one centred
 * `--content-max` well, so on a 2560px screen the cluster is 560px in from the
 * map's right edge and an area that subtracted the right inset from the map
 * placed the panel straight over it. `column` is that well's width; the strict
 * area therefore stops at the well's right edge rather than at the map's.
 *
 * Three areas, offered in the order a surface should want them:
 *
 * 1. **strict** — every inset honoured. Every surface may use it, and the hover
 *    card may use nothing else: decoration that sits on the shelf or on the
 *    search pill has stopped being decoration.
 * 2. **outside** — the map beyond the well, on a screen wide enough to have any.
 *    No chrome is out there at all, so a country in the far east or west gets
 *    honest room rather than the shelf.
 * 3. **relaxed** — for the surface that has to be somewhere, and it gives up two
 *    insets. The shelf's, because the click panel carries both writes and cannot
 *    answer "no room" by not being drawn. And, below {@link CONTROLS_MOVE_AT},
 *    the zoom cluster's, because at that width the cluster is the *top* right
 *    corner and `padding.top` is already the inset that clears it.
 *
 * `padding.left` is the plain gutter in both substitutions, so the areas and the
 * chrome cannot drift apart.
 */
export function surfaceAreas(
  box: SurfaceBox,
  padding: EdgePadding,
  column: number = Number.POSITIVE_INFINITY,
): ReadonlyArray<SurfaceBox> {
  const well = Math.min(box.width, Math.max(column, 0))
  const wellRight = box.x + (box.width - well) / 2 + well

  const left = box.x + padding.left
  const top = box.y + padding.top
  const strict: SurfaceBox = {
    x: left,
    y: top,
    width: Math.max(wellRight - padding.right - left, 0),
    height: Math.max(box.height - padding.top - padding.bottom, 0),
  }
  const right =
    box.width < CONTROLS_MOVE_AT ? padding.left : Math.max(padding.right, 0)
  const relaxed: SurfaceBox = {
    x: left,
    y: top,
    width: Math.max(wellRight - right - left, 0),
    height: Math.max(box.height - padding.top - padding.left, 0),
  }
  const outside: SurfaceBox = {
    x: wellRight,
    y: top,
    width: Math.max(box.x + box.width - padding.left - wellRight, 0),
    height: strict.height,
  }

  const areas = [strict]
  if (outside.width > 0) areas.push(outside)
  if (relaxed.height > strict.height || relaxed.width > strict.width) {
    areas.push(relaxed)
  }
  return areas
}

/* ----------------------------------------------------------------- geometry */

/**
 * Every landmass of one country as its own rectangle, solved from the finest cut
 * installed and memoised against the payload it was solved from.
 *
 * A country is one feature and many polygons, and the difference matters here
 * more than anywhere else in the product: the geometry is Natural Earth's
 * *sovereign* cut, so France is metropolitan France plus Guadeloupe, Martinique,
 * Réunion and Mayotte under a single id. One rectangle around all of them spans
 * 118° of longitude and holds French land for almost none of it — which is
 * exactly where the reference puts its card. Per polygon, the reader's own
 * pointer picks the right one.
 *
 * Solved lazily per code rather than eagerly for the world: a session points at
 * a few dozen countries, and the United States alone is 127 rings.
 */
const landmassCache = new WeakMap<
  CountryFeatureCollection,
  Map<string, ReadonlyArray<MapBounds>>
>()

export function countryLandmasses(
  payload: CountryFeatureCollection,
  countryCode: string,
): ReadonlyArray<MapBounds> {
  const code = countryCode.trim().toUpperCase()
  let table = landmassCache.get(payload)
  if (table === undefined) {
    table = new Map<string, ReadonlyArray<MapBounds>>()
    landmassCache.set(payload, table)
  }
  const cached = table.get(code)
  if (cached !== undefined) return cached

  const feature = payload.features.find((row) => row.id === code)
  const solved: Array<MapBounds> = []
  if (feature !== undefined) {
    for (const polygon of feature.geometry.coordinates) {
      const ring = polygon.at(0)
      if (ring === undefined) continue
      const bounds = boundsForPoints(ring)
      if (bounds !== null) solved.push(bounds)
    }
  }
  table.set(code, solved)
  return solved
}

/** How far a point is from a rectangle, in degrees; zero when inside it. */
function distanceToBounds(bounds: MapBounds, point: LngLat): number {
  const [lng, lat] = point
  // The eastern edge may run past 180° for a country that crosses the date line,
  // which is how the rest of the map expresses a crossing. Shifting the pointer
  // onto the same branch is what keeps a pointer at 179°E inside Russia's own
  // rectangle rather than two hundred degrees away from it.
  const shifted = bounds.east > 180 && lng < bounds.west ? lng + 360 : lng
  const dx = Math.max(bounds.west - shifted, shifted - bounds.east, 0)
  const dy = Math.max(bounds.south - lat, lat - bounds.north, 0)
  return Math.sqrt(dx * dx + dy * dy)
}

/** How much of the world a rectangle covers, for the no-pointer fallback. */
function boundsArea(bounds: MapBounds): number {
  return (bounds.east - bounds.west) * (bounds.north - bounds.south)
}

/**
 * The landmass a surface should be anchored to.
 *
 * With a pointer, the polygon it is inside or nearest to — the shape the reader
 * is looking at, with area breaking a tie so a pointer inside two nested
 * rectangles lands on the substantial one. Without a pointer (a country chosen
 * from the search field or the list, where there is none) the largest, which is
 * the principal landmass for every country in the table.
 */
export function anchorLandmass(
  masses: ReadonlyArray<MapBounds>,
  point: LngLat | null,
): MapBounds | null {
  let best: MapBounds | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const bounds of masses) {
    const score =
      point === null
        ? -boundsArea(bounds)
        : distanceToBounds(bounds, point) - boundsArea(bounds) * 1e-6
    if (score < bestScore) {
      bestScore = score
      best = bounds
    }
  }
  return best
}

/* -------------------------------------------------------------------- input */

/** One country's figures and its record, as the overlay needs them. */
export interface CountryOverlayCountry {
  readonly countryCode: string
  /** Trips that have started and name this country. */
  readonly tripCount: number
  /** Saved places inside it the traveller has ticked off. */
  readonly placeCount: number
  readonly firstTripOn: string | null
  readonly lastTripOn: string | null
  /** The visit on record, for the action block and for the card's fact grid. */
  readonly visit: CountryActionsVisit
}

/**
 * One row of the overlay's input, read as the eight columns a card prints.
 *
 * The overlay holds a country's two records in two shapes — the trip
 * aggregates flat on the row, the visit nested under `visit`, because the
 * action block wants the visit as an object and the card wants it as columns —
 * and the defect this function exists to remove is what happens when a call
 * site bridges that by hand: it picks the four trip fields, forgets the three
 * visit ones, and every country somebody marked without planning a trip renders
 * as the empty state while the record panel two centimetres away prints the
 * visits and their dates. That shipped. So the bridge is written once, here,
 * and the three surfaces spread it rather than each listing props.
 *
 * `null` is a real argument, not a defensive one: the hover card and the panel
 * are both opened by a country code, and a code the payload has no row for is
 * a country with nothing recorded — which is a state the card draws, not an
 * error. Every column then reads as its own zero.
 */
function factColumns(
  countryCode: string,
  country: CountryOverlayCountry | null,
): CountryFactColumns {
  return {
    countryCode,
    tripCount: country?.tripCount ?? 0,
    placeCount: country?.placeCount ?? 0,
    firstTripOn: country?.firstTripOn ?? null,
    lastTripOn: country?.lastTripOn ?? null,
    visitCount: country?.visit.visitCount ?? 0,
    firstVisitedOn: country?.visit.firstVisitedOn ?? null,
    lastVisitedOn: country?.visit.lastVisitedOn ?? null,
  }
}

/** One country's entry on the bucket list, whichever end of the list it is at. */
export interface CountryOverlayGoal extends CountryActionsGoal {
  readonly countryCode: string
}

/**
 * Whether the figures behind the surface are the current ones.
 *
 * `loading` is the window after a write, while the router re-reads the atlas and
 * the numbers on screen are still the ones from before it. `failed` is a read
 * that did not come back. Both are states of the *screen's* payload rather than
 * of a request this component makes — it makes none — which is why they arrive
 * as a prop.
 */
export type CountryOverlayStatus = 'ready' | 'loading' | 'failed'

export interface CountryOverlayProps {
  /** The traveller's record, for the paint layer. */
  readonly visits: ReadonlyArray<MapVisitedCountry>
  /** Every country with something recorded against it. */
  readonly countries: ReadonlyArray<CountryOverlayCountry>
  /** Every country the bucket list names, uncapped. */
  readonly bucketList: ReadonlyArray<CountryOverlayGoal>
  readonly selectedCode: string | null
  /**
   * Bumped once per selection gesture.
   *
   * Selection alone cannot open the surface: a reader who dismissed the panel
   * for France and then pressed France again would get nothing, because the
   * selected code never changed. The token is what makes "choose it again" a new
   * request.
   */
  readonly selectionToken: number
  readonly onSelect: (countryCode: string | null) => void
  /** The insets the screen's chrome covers, as the camera is already told. */
  readonly padding: EdgePadding
  /** Where the surfaces render. The screen owns it, inside its own slice. */
  readonly container: HTMLElement | null
  readonly status?: CountryOverlayStatus
  /** Re-reads the atlas. Offered on the failed card, and nowhere else. */
  readonly onRetry?: () => void
}

/* ------------------------------------------------------------------- layout */

/**
 * Held as class strings so the hover card, the pill and the click panel are cut
 * from one geometry — the tip in particular is one element with one set of
 * edges, rather than three that drift apart on the first edit.
 */
const layout = {
  /**
   * The positioned wrapper.
   *
   * It carries the transform this component writes on every frame of a pan, and
   * it deliberately carries no `data-motion-transform`: that attribute is how the
   * product collapses *choreography* under `prefers-reduced-motion`, and it is
   * declared `transform: none !important`. Put it here and a reader who asked for
   * less movement would get every card stacked in the corner of the map. The
   * entrance lives one level in, on the surface itself, where switching it off
   * costs nothing but the animation.
   */
  wrapper: cn(
    'group pointer-events-none absolute top-0 left-0 z-map-surface',
    'max-w-(--pt-max-w)',
    // The exit, on the layer rather than on the card. The card inside plays its
    // own 150ms pop-out, but the tip is drawn out here and would otherwise snap
    // out of existence a frame before the surface it belongs to finished
    // leaving. One opacity transition over the whole layer takes both with it,
    // and it is the only property animated here — the transform on this element
    // is the anchor, written every frame of a pan, and must never be eased.
    'transition-opacity duration-fast ease-out-quint',
    'data-[state=closed]:opacity-0',
  ),
  /**
   * Withdrawn rather than clamped — and only ever for the hover card.
   *
   * A decorative surface with nowhere to go that clears the shape and the chrome
   * is better not drawn. The click surface is the opposite case and must never
   * carry this: it holds focus and both writes, and hiding it with
   * `visibility: hidden` does not merely conceal it — it makes everything inside
   * unfocusable, which drops the reader's focus to the document body and leaves
   * an open dialog that no key can reach. That is exactly what happened when the
   * anchored country was zoomed off the map, and again on the very first commit
   * under `prefers-reduced-motion`, where the panel asked for focus one style
   * recalculation before this class had been lifted.
   */
  withdraw: 'data-[placed=false]:invisible',
  /** The hover surfaces hug the card they hold; the panel states its own width. */
  hug: 'w-max',
  panelWidth: 'w-96 @md:w-auto',
  /** The tip, drawn from the card's own ground so it reads as its corner. */
  tip: cn(
    'pointer-events-none absolute size-2 rotate-45 border-map-card-edge bg-map-card',
    'group-data-[tip=none]:hidden',
    'group-data-[side=top]:-bottom-1 group-data-[side=top]:left-(--pt-tip) group-data-[side=top]:-translate-x-1/2 group-data-[side=top]:border-r group-data-[side=top]:border-b',
    'group-data-[side=bottom]:-top-1 group-data-[side=bottom]:left-(--pt-tip) group-data-[side=bottom]:-translate-x-1/2 group-data-[side=bottom]:border-t group-data-[side=bottom]:border-l',
    'group-data-[side=left]:-right-1 group-data-[side=left]:top-(--pt-tip) group-data-[side=left]:-translate-y-1/2 group-data-[side=left]:border-t group-data-[side=left]:border-r',
    'group-data-[side=right]:-left-1 group-data-[side=right]:top-(--pt-tip) group-data-[side=right]:-translate-y-1/2 group-data-[side=right]:border-b group-data-[side=right]:border-l',
  ),
  /** Enter 220ms, exit 150ms, transform and opacity only. */
  motion:
    'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
  /**
   * The click panel: one surface, a column on a phone and a row from `@md`.
   *
   * A column, because 288px of card over 288px of actions is four hundred pixels
   * tall; a row, because three hundred and thirty-five is all the clear map a
   * 1440×900 screen has under its shelf. `--pt-max-h` is written by the
   * placement pass, so the panel is never taller than the room there is and the
   * scroll inside it is only ever entered when there genuinely is none.
   */
  surface: cn(
    'pointer-events-auto relative flex max-h-(--pt-max-h) w-full flex-col overflow-hidden',
    'rounded-lg border border-map-card-edge bg-map-card text-left shadow-popover',
    'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
    // Dismissed, and therefore no longer a target. The layer fades for 150ms and
    // for every one of them the panel used to stay hit-testable, so a press
    // arriving in that window landed on a control the reader could see leaving —
    // and two of the controls under it rewrite the traveller's record. The
    // wrapper is the `group`, so the exit it is already driving turns this off
    // in the same frame it starts fading.
    'group-data-[state=closed]:pointer-events-none',
    // Squeezed, the ceiling becomes a floor as well — and that is a layout fact,
    // not a flourish. `max-height` alone leaves the surface's height *indefinite*,
    // and a percentage height inside an indefinite box resolves to `auto`: the
    // scroll region's own viewport grew to its content, overflowed a parent that
    // clips, and the second write ended up in a strip no gesture could reach.
    // Stated as a height, every box down the chain is definite and the region
    // scrolls the way it says it does.
    'group-data-[fit=squeezed]:h-(--pt-max-h)',
    '@md:flex-row',
  ),
  /**
   * The card's column. Its width is a custom property rather than two competing
   * width utilities: `@md:w-72` and `2xl:@md:w-80` both apply on a 2560px screen
   * and nothing in the cascade decides between them, whereas two declarations of
   * one variable resolve in source order every time.
   */
  factsColumn: cn(
    'min-w-0 shrink-0 [--pt-card-w:18rem] 2xl:[--pt-card-w:20rem]',
    '@md:w-(--pt-card-w)',
  ),
  /**
   * The card, flush inside the panel: the panel is already the surface, so the
   * card gives up its own edge, radius and shadow rather than drawing a second
   * box inside the first. `2xl:w-full` is not redundant — it is what stands the
   * card's own `2xl:w-80` down, which `w-full` alone cannot reach.
   *
   * The header gives up its right edge to the close control floating over it, so
   * a long country name truncates instead of running under the glyph.
   */
  facts: cn(
    'w-full max-w-full rounded-none border-0 shadow-none 2xl:w-full',
    '[&_[data-part=header]]:pr-12',
    // Side by side the two columns are never the same height — the action block
    // carries two rows and a message strip — and a fact grid that stopped ninety
    // pixels short of the panel's own edge read as a card that had failed to
    // finish. The grid takes the difference instead: two rows of equal share,
    // which lands the numerals in a generous cell rather than in a void.
    '@md:flex @md:h-full @md:flex-col',
    '@md:[&>dl]:min-h-0 @md:[&>dl]:flex-1 @md:[&>dl]:grid-rows-2',
    // And the label-and-value pair centred in the taller cell rather than
    // pinned to its top, so the two rows read as a pair of equal fields instead
    // of as content that ran out.
    '@md:[&>dl>div]:flex @md:[&>dl>div]:flex-col @md:[&>dl>div]:justify-center',
  ),
  /**
   * The action block's column: a rule under the card, beside it from `@md`.
   *
   * 24rem is not a look, it is the width the block needs to stop stacking. Its
   * two rows put the control on its own line under the title below 20rem of
   * *container*, and `px-4` either side puts the floor at 22rem before the
   * glyph, the copy and the button share a line — which is the difference
   * between a panel 245px tall and one 355px tall, and 355 is taller than the
   * clear map a 1440×900 screen has under its shelf. One grid step above the
   * floor rather than on it, so a longer label cannot put the rows back. Stated
   * as a fixed basis rather than as `flex-1`, so the panel's own shrink-to-fit
   * width is the two columns and not the block's max-content.
   */
  actionsColumn: cn(
    'flex min-h-0 min-w-0 flex-1 flex-col border-t border-edge-faint',
    '@md:w-96 @md:flex-none @md:border-t-0 @md:border-l',
  ),
  /**
   * `z-map-surface`, not `z-10`.
   *
   * `CountryCard` carries that same tier on its own root — it is designed to be
   * a floating object in its own right — so a close control at any lower tier
   * paints *underneath* an opaque card and simply is not there. Matching the
   * tier and coming later in the document is what puts it on top, and the panel
   * around it is the stacking context that keeps the pair from reaching the app
   * header.
   */
  close: 'absolute top-2 right-2 z-map-surface',
} as const

/* ----------------------------------------------------------------- presence */

/** How long an outgoing surface stays mounted for its exit. `--duration-fast`. */
const EXIT_MS = 150

/** A country under the pointer, and where the pointer was when it arrived. */
interface HoverTarget {
  readonly code: string
  readonly point: LngLat | null
}

/** The country a press left behind, and the rectangle it is anchored to. */
interface PanelTarget {
  readonly code: string
  readonly frame: AnchorFrame
}

interface SurfacePresence<T> {
  readonly target: T | null
  readonly state: 'open' | 'closed'
}

/**
 * Keeps an outgoing surface mounted while it leaves.
 *
 * Both surfaces need this and for the same reason, which is why it is one hook.
 * Radix has presence machinery of its own, and the panel's content uses it — but
 * it can only defer the content's *own* unmount, and what actually removed the
 * panel was this component: the open country was derived from the selection, so
 * the commit that closed the surface also stopped rendering the layer holding
 * it, and a `data-[state=closed]` exit that never gets a frame is dead styling.
 * Holding the last target for the length of the exit is what gives both the card
 * and the panel their 150ms out.
 *
 * One render per change either way: the timer fires once, not per frame, and a
 * target that is still the same object re-sets identical state, which React
 * drops.
 */
function useExitPresence<T>(target: T | null): SurfacePresence<T> {
  const [shown, setShown] = React.useState<T | null>(target)

  React.useEffect(() => {
    if (target !== null) {
      setShown(target)
      return
    }
    if (shown === null) return
    const timer = window.setTimeout(() => setShown(null), EXIT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [target, shown])

  // The live target wins whenever there is one: `shown` is a frame behind by
  // construction, and a surface reopened on a different country inside the exit
  // window would otherwise render the country it was *last* about for one
  // commit before the effect caught up.
  return { target: target ?? shown, state: target === null ? 'closed' : 'open' }
}

/* --------------------------------------------------------- anchored surface */

/** The map's box expressed in the host layer's own coordinates. */
function mapOffset(map: HTMLElement, host: HTMLElement): SurfaceBox {
  const canvas = map.getBoundingClientRect()
  const layer = host.getBoundingClientRect()
  return {
    x: canvas.left - layer.left,
    y: canvas.top - layer.top,
    width: canvas.width,
    height: canvas.height,
  }
}

/**
 * The width the screen lays its floating chrome out in, resolved from the token
 * that states it.
 *
 * `--content-max` is the product's measure, and `AtlasScreen` positions the
 * search pill, the zoom cluster, the credit and the shelf inside one centred well
 * of exactly that width rather than against the viewport's own edges. On a screen
 * no wider than the measure the two are the same rectangle and this changes
 * nothing; above it — a 2560px screen has 1120px spare — it is the difference
 * between subtracting the zoom cluster's inset from the map's right edge, where
 * there is nothing, and from the well's, where the cluster actually is.
 *
 * Read from the DOM rather than repeated as a number here, because the token file
 * is where a measure is allowed to change. Read once per resize and held, because
 * `place()` runs once per rendered frame of a pan and `getComputedStyle` there is
 * a forced style recalculation sixty times a second.
 */
function chromeColumn(host: HTMLElement): number {
  const declared = getComputedStyle(host)
    .getPropertyValue('--content-max')
    .trim()
  const measure = Number.parseFloat(declared)
  if (!Number.isFinite(measure)) return Number.POSITIVE_INFINITY
  if (!declared.endsWith('rem')) return measure
  const root = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  )
  return Number.isFinite(root) ? measure * root : Number.POSITIVE_INFINITY
}

/**
 * The map, cropped to the layer the surfaces are actually drawn in.
 *
 * The two are not the same rectangle by one pixel a side, and it is deliberate:
 * the atlas draws exactly one world, so the antimeridian lands on the drawing's
 * own left and right edge, and the screen overhangs the drawing by a pixel each
 * way so the graticule's first meridian and every ring that touches the date line
 * fall outside the clip instead of down the edge of the screen as a seam.
 *
 * Projection has to use the true box — that pixel is real map. Placement must
 * not: the gutters the areas are measured from are the composition's, and a
 * surface solved against the overhang lands a pixel outside the column the shelf
 * and the search pill are laid out in, which on a phone is a visible misfit
 * between a full-width sheet and the shelf underneath it.
 */
function placementBox(box: SurfaceBox, host: HTMLElement): SurfaceBox {
  const left = Math.max(box.x, 0)
  const top = Math.max(box.y, 0)
  const right = Math.min(box.x + box.width, host.clientWidth)
  const bottom = Math.min(box.y + box.height, host.clientHeight)
  return {
    x: left,
    y: top,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  }
}

/**
 * What an anchored surface needs to place itself.
 *
 * The insets rather than the areas: the areas are a function of the map's box,
 * which changes on every resize, so they are solved inside the placement pass
 * where the box is measured. Handing down a rectangle solved during a render
 * would leave a card anchored to the viewport the page opened at.
 */
interface AnchorFrame {
  readonly bounds: MapBounds
  readonly padding: EdgePadding
  /** True for a surface that may only occupy map the chrome has left free. */
  readonly strict: boolean
}

interface AnchoredSurfaceProps {
  readonly frame: AnchorFrame
  /** The layer the surface is positioned inside. */
  readonly host: HTMLElement
  /**
   * Withdrawn rather than clamped when nothing clears the shape, and withdrawn
   * again once the shape itself has left the map. Only ever true for the hover
   * card: a surface that holds focus is never hidden, whatever the camera does.
   */
  readonly decorative: boolean
  /**
   * The shortest this surface may be squeezed to rather than cover its shape.
   *
   * Only the click panel offers one — see {@link PlaceSurfaceInput.minHeight}.
   * The card the hover shows is decoration and answers "no room" by not being
   * drawn, which costs the reader nothing at all.
   */
  readonly minHeight?: number
  /** Drives the layer's exit. `closed` fades it, tip and all. */
  readonly state: 'open' | 'closed'
  readonly className: string
  readonly children: React.ReactNode
}

/**
 * One positioned layer, glued to a rectangle of the world.
 *
 * Everything about the position is written imperatively. That is not an
 * optimisation, it is the requirement: the anchor moves on every frame of a pan
 * and of a fly-to, and a React state update per frame would re-render the card,
 * the action block and the four `useAction` hooks inside it sixty times a second.
 * The transform, the side, the tip offset and the two size ceilings are DOM
 * writes on one element instead, so a pan costs one `project()` and one style
 * mutation.
 */
function AnchoredSurface({
  frame,
  host,
  decorative,
  minHeight,
  state,
  className,
  children,
}: AnchoredSurfaceProps) {
  const { map } = useMapContext()
  const nodeRef = React.useRef<HTMLDivElement | null>(null)
  const frameRef = React.useRef(frame)
  frameRef.current = frame
  /**
   * The surface's own box, and the two ceilings it was measured under.
   *
   * Held rather than re-read, because a pan calls the placement sixty times a
   * second and `offsetWidth` immediately after a style write is the textbook
   * layout thrash: the write invalidates layout, the read forces it back. The
   * ceilings only move when the *viewport* does, so the pair is compared first
   * and the measurement is taken only when something has actually changed.
   */
  const sizeRef = React.useRef({ width: 0, height: 0 })
  const capRef = React.useRef({ width: -1, height: -1 })
  /**
   * The ceiling currently written on the element, which is not always the area's.
   *
   * A squeezed surface is *shorter* than the room its area has, and the height
   * the placement solved from has to stay the height it would take if the room
   * came back — otherwise the first squeeze would ratchet: measure the squeezed
   * box, squeeze that, measure again. So every measurement is taken with the
   * area's own ceiling restored, and the squeeze is re-applied after it.
   */
  const fitRef = React.useRef(-1)
  /** The chrome column's width, re-read only when the viewport moves. */
  const columnRef = React.useRef(Number.POSITIVE_INFINITY)

  const measure = React.useCallback(() => {
    const node = nodeRef.current
    if (node === null) return
    columnRef.current = chromeColumn(host)
    const cap = capRef.current.height
    if (cap >= 0 && fitRef.current !== cap) {
      node.style.setProperty('--pt-max-h', `${cap}px`)
      fitRef.current = cap
    }
    sizeRef.current = { width: node.offsetWidth, height: node.offsetHeight }
  }, [host])

  const place = React.useCallback(() => {
    const node = nodeRef.current
    const current = frameRef.current
    if (node === null || map === null) return

    const box = mapOffset(map.getContainer(), host)

    // Latitudes are already clamped to what Mercator can draw; the eastern edge
    // is not, because a country that crosses the date line is expressed with it
    // past 180°. The atlas draws exactly one world, so a longitude outside the
    // line has no pixel — the edge is brought back to it, and the rectangle is
    // clipped to what is on screen straight after anyway.
    const east = Math.min(current.bounds.east, 180)
    const west = Math.max(current.bounds.west, -180)
    const first = map.project([west, current.bounds.north])
    const second = map.project([east, current.bounds.south])

    // Clipped to the map, and never clipped away: a country dragged or zoomed
    // off the edge leaves a stub on the edge it went out of, so the surface
    // stays on screen with its tip pointing after it. `onScreen` is what the
    // hover card reads to withdraw instead.
    const horizontal = anchorSpan(
      Math.min(first.x, second.x) + box.x,
      Math.max(first.x, second.x) + box.x,
      box.x,
      box.x + box.width,
    )
    const vertical = anchorSpan(
      Math.min(first.y, second.y) + box.y,
      Math.max(first.y, second.y) + box.y,
      box.y,
      box.y + box.height,
    )
    const onScreen = horizontal.onScreen && vertical.onScreen

    const solved = surfaceAreas(
      placementBox(box, host),
      current.padding,
      columnRef.current,
    )
    const areas = current.strict ? solved.slice(0, 1) : solved
    // The roomiest of them, not the last: the ceilings are an upper bound on
    // what the surface may become, and an area it will never be placed in must
    // not be allowed to shrink it. The placement below still rejects any area
    // the measured surface will not fit inside.
    const area = roomiest(areas)
    if (area === undefined) return
    // Written before the measurement, because the surface reads them: the panel
    // is capped at the room there is, and the scroll inside it only ever engages
    // when the cap actually bites.
    const capWidth = Math.round(area.width)
    const capHeight = Math.round(area.height)
    if (
      capRef.current.width !== capWidth ||
      capRef.current.height !== capHeight
    ) {
      node.style.setProperty('--pt-max-w', `${capWidth}px`)
      capRef.current = { width: capWidth, height: capHeight }
      measure()
    }

    const size = sizeRef.current
    if (size.width === 0 || size.height === 0) return

    const spot = placeCountrySurface({
      anchor: {
        x: horizontal.start,
        y: vertical.start,
        width: horizontal.size,
        height: vertical.size,
      },
      size,
      areas,
      minHeight,
    })
    if (spot === null) return

    // The ceiling the placement chose, which is the area's own unless clearing
    // the shape cost the surface some height. Written before the transform so
    // the frame the reader sees carries both at once.
    const fit = spot.height ?? capHeight
    if (fitRef.current !== fit) {
      node.style.setProperty('--pt-max-h', `${fit}px`)
      fitRef.current = fit
    }
    node.dataset.fit = spot.height === null ? 'full' : 'squeezed'

    node.style.transform = `translate3d(${spot.x}px, ${spot.y}px, 0)`
    node.dataset.side = spot.side
    node.dataset.tip = spot.tip === null ? 'none' : 'on'
    if (spot.tip !== null) {
      node.style.setProperty('--pt-tip', `${spot.tip}px`)
    }
    // The click surface is never withdrawn. It carries the reader's focus and
    // both writes, and `visibility: hidden` would take the focus with it — so
    // only decoration is allowed to answer "nowhere to go" or "gone from the
    // map" by not being drawn.
    node.dataset.placed =
      decorative && (!spot.clear || !onScreen) ? 'false' : 'true'
    // Reported rather than merely acted on: "the shape this belongs to has left
    // the map" is the state the click surface must survive, and a gate that had
    // to infer it from pixels would be asserting against the camera.
    node.dataset.anchor = onScreen ? 'visible' : 'offscreen'
  }, [map, host, decorative, minHeight, measure])

  // After every render, because the surface's own size is what half the
  // arithmetic reads and a status change or a longer country name moves it.
  React.useLayoutEffect(() => {
    measure()
    place()
  })

  React.useEffect(() => {
    if (map === null) return
    const node = nodeRef.current
    const remeasure = (): void => {
      measure()
      place()
    }
    // `move` rather than `moveend`: MapLibre emits it once per rendered frame of
    // a pan, a zoom and a fly-to, which is exactly the cadence the anchor has to
    // keep up with — and it is the one path that must not re-measure, because
    // nothing about the surface itself has changed.
    //
    // The observer below cannot loop on the squeeze, and the reason is worth
    // stating: `remeasure` restores the area's ceiling, reads, and re-applies the
    // squeeze inside one callback, so the size the browser settles on is the size
    // it just reported. A notification is only ever raised again by a content
    // change, which is the thing the observer is here for.
    map.on('move', place)
    map.on('resize', remeasure)
    const observer =
      node === null || typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(remeasure)
    if (node !== null) observer?.observe(node)
    return () => {
      map.off('move', place)
      map.off('resize', remeasure)
      observer?.disconnect()
    }
  }, [map, place, measure])

  return (
    <div
      ref={nodeRef}
      data-part="country-surface"
      data-placed="false"
      data-state={state}
      className={cn(layout.wrapper, decorative && layout.withdraw, className)}
    >
      {children}
      <span aria-hidden="true" data-part="tip" className={layout.tip} />
    </div>
  )
}

/* ------------------------------------------------------------------- panel */

/** The card's three states, at one geometry, inside the panel. */
function PanelFacts({
  countryCode,
  country,
  status,
  onRetry,
}: {
  readonly countryCode: string
  readonly country: CountryOverlayCountry | null
  readonly status: CountryOverlayStatus
  readonly onRetry?: () => void
}) {
  if (status === 'loading') {
    return (
      <CountryCardSkeleton countryCode={countryCode} className={layout.facts} />
    )
  }
  if (status === 'failed') {
    return (
      <CountryCardError
        countryCode={countryCode}
        onRetry={onRetry}
        className={layout.facts}
      />
    )
  }
  return (
    <CountryCard
      {...factColumns(countryCode, country)}
      headingLevel={3}
      className={layout.facts}
    />
  )
}

/* ------------------------------------------------------------- tab order */

/**
 * Everything inside one element that a Tab press can land on, in document order.
 *
 * A tree walk rather than a selector list, because the set has to agree with the
 * browser's own: `tabIndex >= 0` is true of every natively focusable element
 * *and* of anything given an explicit index, which no list of tag names covers.
 *
 * The three exclusions are all measured rather than assumed. `tabIndex` is a
 * reflection of the attribute and nothing else, so a `<button disabled>` and an
 * `<input type="hidden">` both still report `0` — and the action block disables
 * its own controls while a write is in flight, which would otherwise put a dead
 * button at the end of the panel and hide the real edge behind it. A subtree
 * that is hidden, `inert` or `aria-hidden` is rejected outright rather than
 * skipped, because a walk into one ends with focus somewhere no reader can see.
 */
function tabStops(root: HTMLElement): ReadonlyArray<HTMLElement> {
  const doc = root.ownerDocument
  const found: Array<HTMLElement> = []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP
      if (node.hidden || node.hasAttribute('inert')) {
        return NodeFilter.FILTER_REJECT
      }
      if (node.getAttribute('aria-hidden') === 'true') {
        return NodeFilter.FILTER_REJECT
      }
      if (node.hasAttribute('disabled')) return NodeFilter.FILTER_SKIP
      if (node instanceof HTMLInputElement && node.type === 'hidden') {
        return NodeFilter.FILTER_SKIP
      }
      return node.tabIndex >= 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP
    },
  })
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (node instanceof HTMLElement) found.push(node)
  }
  return found
}

/** The tab stop the document offers on the far side of one element. */
function tabStopBeyond(
  panel: HTMLElement,
  forwards: boolean,
): HTMLElement | null {
  const body = panel.ownerDocument.body
  const outside = tabStops(body).filter((node) => !panel.contains(node))
  const wanted = forwards
    ? Node.DOCUMENT_POSITION_FOLLOWING
    : Node.DOCUMENT_POSITION_PRECEDING
  let answer: HTMLElement | null = null
  for (const node of outside) {
    if ((panel.compareDocumentPosition(node) & wanted) === 0) continue
    // Forwards the first match is the answer; backwards the last one is, and
    // the walk is in document order either way.
    if (forwards) return node
    answer = node
  }
  return answer
}

/**
 * Hands a Tab press at either edge of a layer to the rest of the document.
 *
 * Called on the layer's own `keydown`, which is dispatched before the focus
 * scope's — so by the time Radix looks, the active element is outside the scope
 * and its loop has nothing to bite on. Presses that are not at an edge are left
 * entirely alone, and so is the degenerate case of a page with no other tab stop
 * on the far side, where looping is the only thing left to do.
 */
function leaveOnTabEdge(event: React.KeyboardEvent<HTMLElement>): void {
  if (event.defaultPrevented) return
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
    return
  }
  const panel = event.currentTarget
  const active = panel.ownerDocument.activeElement
  if (!(active instanceof HTMLElement)) return

  const stops = tabStops(panel)
  const edge = event.shiftKey ? stops.at(0) : stops.at(-1)
  if (edge === undefined || edge !== active) return

  const target = tabStopBeyond(panel, !event.shiftKey)
  if (target === null) return
  event.preventDefault()
  target.focus({ preventScroll: true })
}

interface CountryPanelProps {
  readonly countryCode: string
  readonly country: CountryOverlayCountry | null
  readonly goal: CountryActionsGoal | null
  readonly status: CountryOverlayStatus
  readonly onRetry?: () => void
  readonly onCloseAutoFocus: (event: Event) => void
  readonly onInteractOutside: (event: Event) => void
  readonly onFocusOutside: (event: Event) => void
}

/**
 * The panel a press leaves behind: the same card, plus the two writes.
 *
 * `DialogPrimitive` rather than the product's own `DialogContent`, because that
 * wrapper is a modal: it portals to `document.body`, dims the page behind a
 * scrim and traps focus. All three are wrong over a map whose subject is the
 * thing behind the panel. The non-modal content gives the parts that are right —
 * a role, a name, Escape and focus — and nothing else.
 *
 * Except that it also gives one thing that is wrong, and silently. Radix renders
 * a dialog's content inside a focus scope with `loop` hard-wired to `true` and
 * `trapped` set from `modal`, and that scope loops on `loop` *alone*: its key
 * handler bails only when both flags are off. So a panel that declares itself
 * non-modal still bounced every Tab press off its own last control and every
 * Shift+Tab off its first, which made the shelf, the search field and the map
 * behind it unreachable by keyboard for as long as it was open — a trap in a
 * layer whose whole point is that the page behind it stays live.
 *
 * {@link leaveOnTabEdge} is the answer, and it is deliberately not a second
 * focus scope. It runs *before* Radix's handler — a `Slot` merges the child's
 * event handler ahead of its own — and it settles the question that handler is
 * about to ask, by moving focus to the document's own next tab stop outside the
 * panel and cancelling the press. Radix then reads an active element that is no
 * longer an edge of the scope, finds nothing to do, and the reader has simply
 * tabbed out of a panel that is still open behind them.
 */
function CountryPanel({
  countryCode,
  country,
  goal,
  status,
  onRetry,
  onCloseAutoFocus,
  onInteractOutside,
  onFocusOutside,
}: CountryPanelProps) {
  const name = countryFacts(factColumns(countryCode, country)).name
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <DialogPrimitive.Content
      ref={panelRef}
      data-part="country-panel"
      data-country={countryCode}
      data-motion-transform=""
      // The card below already prints the country, both figures and both dates.
      // Pointing `aria-describedby` at the panel would read the whole card out
      // as a description of itself before the reader reached any of it.
      aria-describedby={undefined}
      // Focusable, and only programmatically: the panel itself is where focus
      // lands when it opens, so it needs to accept focus without ever becoming a
      // tab stop of its own.
      tabIndex={-1}
      className={cn(layout.surface, layout.motion)}
      // Focus lands on the panel, not on a control inside it.
      //
      // Radix's default is the first tab stop, which here is the action block's
      // first row — and for a country already on the record that control reads
      // "Remove … from your atlas". A panel that opens with the undo of somebody's
      // travel history under the space bar is a panel that will eventually be
      // pressed by accident. The previous answer was to focus the dismissal
      // instead, and it traded one defect for another: the dismissal is *last* in
      // the panel, so the very first Tab left, and the two writes this surface
      // exists for could only be reached by tabbing backwards.
      //
      // The container is the answer to both. A screen reader announces the
      // dialog's role and its name — the country — the reading order is the facts
      // and then what can be done about them, and a forward Tab walks into the
      // block rather than out of the panel.
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        panelRef.current?.focus({ preventScroll: true })
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      onFocusOutside={onFocusOutside}
      onInteractOutside={onInteractOutside}
      // Non-modal has to mean it. Radix's focus scope loops a Tab press at
      // either edge whether or not the scope is trapped, so without this the
      // panel is a keyboard trap and the shelf behind it is unreachable.
      onKeyDown={leaveOnTabEdge}
    >
      <DialogPrimitive.Title className="sr-only">{name}</DialogPrimitive.Title>

      <div className={layout.factsColumn}>
        <PanelFacts
          countryCode={countryCode}
          country={country}
          status={status}
          onRetry={onRetry}
        />
      </div>

      <div className={layout.actionsColumn}>
        {/* `fade` is the mask and the bar is the affordance. Both appear only on
            a viewport that genuinely cannot hold the block — a short phone with
            the shelf beneath it — and the card above never scrolls, so nothing
            that identifies the country can ever be cut.

            `type="auto"` rather than the primitive's hover default: on the
            viewport where this actually scrolls the reader has no pointer to
            hover with, and a mask fade on its own is a design flourish that could
            equally be a card that stops. The bar is drawn for exactly as long as
            there is something under the fold and never a moment longer. */}
        <ScrollArea fade type="auto" axis="vertical" className="min-h-0 flex-1">
          <CountryActions
            key={countryCode}
            countryCode={countryCode}
            visit={country?.visit ?? null}
            bucketGoal={goal}
            headingLevel={4}
            // 20px above and below rather than 16. `ScrollArea`'s fade is a
            // `--space-4` mask at both edges and it is painted whether or not
            // the region is actually scrolling, so a block padded to exactly
            // that distance has its first and last line sitting inside the
            // gradient — copy that looks half-erased on a panel that fits
            // perfectly. One grid step of clearance keeps the fade on padding,
            // and leaves it saying only what it is for: there is more below.
            className="px-4 py-5"
          />
        </ScrollArea>
      </div>

      <DialogPrimitive.Close asChild>
        <IconButton
          icon={<X />}
          label={`Close ${name}`}
          size="sm"
          variant="ghost"
          className={layout.close}
        />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  )
}

/* ------------------------------------------------------------------ overlay */

/** How long after a touch a `mousemove` is still the browser's echo of it. */
const TOUCH_GRACE_MS = 700

/**
 * The shortest the click panel may be squeezed to rather than cover its country.
 *
 * 18rem, and the number is the composition rather than a look. Stacked — which
 * is the phone's layout — the panel is the fact card at 182px over the action
 * block, and eighteen rem leaves the whole card plus the block's heading and its
 * first row above the fold, with the fade and the bar saying there is a second.
 * Below that the squeeze would be buying room by hiding the thing the reader
 * pressed the country to see, and being centred over the country is the better
 * of two bad answers.
 */
const PANEL_MIN_HEIGHT = 288

export function CountryOverlay({
  visits,
  countries,
  bucketList,
  selectedCode,
  selectionToken,
  onSelect,
  padding,
  container,
  status = 'ready',
  onRetry,
}: CountryOverlayProps) {
  const { map } = useMapContext()

  const [hovered, setHovered] = React.useState<HoverTarget | null>(null)
  /** The gesture whose panel the reader has dismissed. */
  const [dismissed, setDismissed] = React.useState<number | null>(null)
  /** Where the pointer was when the open selection was made, if it was a press. */
  const [openPoint, setOpenPoint] = React.useState<LngLat | null>(null)
  /** True once the layer has faded too far to answer a pointer at all. */
  const [offScale, setOffScale] = React.useState(false)
  /** True while the last thing to touch the map was a finger. */
  const [coarse, setCoarse] = React.useState(false)

  const pointerRef = React.useRef<LngLat | null>(null)
  const touchedAtRef = React.useRef(0)
  const fromMapRef = React.useRef(false)

  /**
   * The finest outlines installed, as a value that changes when they land.
   *
   * `countryBounds()` answers with one rectangle for a whole country; this
   * component needs them per landmass, so it reads the payload and solves the
   * rectangles it needs. Both cuts promote the same ISO ids, so the swap is
   * invisible except in precision.
   */
  const detail = React.useSyncExternalStore(
    subscribeCountryDetail,
    countryDetail,
    () => null,
  )
  const payload = detail?.features ?? countryFeatures()

  const factsByCode = React.useMemo(() => {
    const table = new Map<string, CountryOverlayCountry>()
    for (const row of countries) {
      table.set(row.countryCode.trim().toUpperCase(), row)
    }
    return table
  }, [countries])

  const goalsByCode = React.useMemo(() => {
    const table = new Map<string, CountryActionsGoal>()
    for (const row of bucketList) {
      table.set(row.countryCode.trim().toUpperCase(), {
        id: row.id,
        targetYear: row.targetYear,
        isAchieved: row.isAchieved,
      })
    }
    return table
  }, [bucketList])

  /**
   * The pointer, and the shape of the pointing device, recorded without a render.
   *
   * Registered before the paint layer's own listener — the overlay is rendered
   * above `VisitedCountries` for exactly that reason — so the position is
   * already current by the time a crossing is reported. It is a ref because
   * nothing on screen depends on where the pointer is, only on which country it
   * is over.
   */
  React.useEffect(() => {
    if (map === null) return

    const onMove = (event: { lngLat: { lng: number; lat: number } }): void => {
      pointerRef.current = [event.lngLat.lng, event.lngLat.lat]
      if (performance.now() - touchedAtRef.current > TOUCH_GRACE_MS) {
        setCoarse((current) => (current ? false : current))
      }
    }
    const onTouch = (): void => {
      touchedAtRef.current = performance.now()
      setCoarse((current) => (current ? current : true))
    }
    const onZoom = (): void => {
      const beyond = map.getZoom() > VISITED_COUNTRY_ZOOM.interactiveMax
      setOffScale((current) => (current === beyond ? current : beyond))
    }

    onZoom()
    map.on('mousemove', onMove)
    map.on('touchstart', onTouch)
    map.on('zoom', onZoom)
    return () => {
      map.off('mousemove', onMove)
      map.off('touchstart', onTouch)
      map.off('zoom', onZoom)
    }
  }, [map])

  const onHoverChange = React.useCallback((code: string | null) => {
    setHovered(
      code === null
        ? null
        : { code: code.trim().toUpperCase(), point: pointerRef.current },
    )
  }, [])

  /**
   * A press on the map carries a pointer with it; a search result and a list row
   * do not. Recording which of the two opened the panel is what stops a country
   * chosen by name from being anchored at whatever the mouse last touched.
   */
  const handleSelect = React.useCallback(
    (code: string | null) => {
      fromMapRef.current = true
      setOpenPoint(code === null ? null : pointerRef.current)
      onSelect(code)
    },
    [onSelect],
  )

  React.useEffect(() => {
    if (fromMapRef.current) {
      fromMapRef.current = false
      return
    }
    setOpenPoint(null)
  }, [selectedCode, selectionToken])

  /**
   * The paint layer, held as an element rather than re-created.
   *
   * A crossing changes this component's state, and without this the whole layer
   * would re-render on it — four effects keyed on the style epoch and a memo over
   * 237 features, once per country the pointer touches. Memoised, the element is
   * identical between renders and React skips the subtree entirely.
   */
  const paint = React.useMemo(
    () => (
      <VisitedCountries
        visits={visits}
        selectedCode={selectedCode}
        onSelect={handleSelect}
        onHoverChange={onHoverChange}
      />
    ),
    [visits, selectedCode, handleSelect, onHoverChange],
  )

  const open =
    selectedCode !== null && dismissed !== selectionToken && !offScale
  const openCode = open ? selectedCode.trim().toUpperCase() : null

  /**
   * Hover stands down for three separate reasons, and each is its own defect if
   * it is missed: a finger has no hover to show, a layer past the fade has no
   * shape to point at, and a card over the country the panel is already about
   * would be the same country said twice.
   */
  const hoverTarget =
    coarse || offScale || hovered === null || hovered.code === openCode
      ? null
      : hovered
  const hover = useExitPresence(hoverTarget)
  const hoverCode = hover.target?.code ?? null

  const hoverFrame = React.useMemo((): AnchorFrame | null => {
    if (hover.target === null) return null
    const bounds = anchorLandmass(
      countryLandmasses(payload, hover.target.code),
      hover.target.point,
    )
    return bounds === null ? null : { bounds, padding, strict: true }
  }, [hover.target, padding, payload])

  const panelFrame = React.useMemo((): AnchorFrame | null => {
    if (openCode === null) return null
    const bounds = anchorLandmass(
      countryLandmasses(payload, openCode),
      openPoint,
    )
    return bounds === null ? null : { bounds, padding, strict: false }
  }, [openCode, openPoint, padding, payload])

  /**
   * The panel's country and its rectangle, held together and held on.
   *
   * One value rather than two, because the exit needs both: for the 150ms after
   * a dismissal the selection has already gone, and a surface still leaving the
   * screen has to keep printing the country it was about rather than fall back
   * to zeroes for a country it no longer names.
   */
  const panelTarget = React.useMemo(
    (): PanelTarget | null =>
      openCode === null || panelFrame === null
        ? null
        : { code: openCode, frame: panelFrame },
    [openCode, panelFrame],
  )
  const panel = useExitPresence(panelTarget)
  const panelCode = panel.target?.code ?? null

  const close = React.useCallback(() => {
    setDismissed(selectionToken)
  }, [selectionToken])

  const returnFocus = React.useCallback(
    (event: Event) => {
      event.preventDefault()
      map?.getCanvas().focus({ preventScroll: true })
    },
    [map],
  )

  /**
   * Focus leaving the panel is not a dismissal either.
   *
   * The panel is deliberately non-modal, so a reader is free to tab out of it
   * into the search field, the shelf or the map and back again — and the shelf
   * is showing the very same country. Radix's default is to treat a focus move
   * outside a layer as an interaction outside it, which closed the panel the
   * instant the country search restored focus to its own trigger after a
   * selection. It survived on a fast machine and lost the race on a slow one,
   * which is the worst shape a defect can have.
   */
  const keepOnFocusMove = React.useCallback((event: Event) => {
    event.preventDefault()
  }, [])

  /**
   * A press outside the panel is not a dismissal, wherever it lands.
   *
   * The panel belongs to the selection, and four surfaces drive that selection:
   * the map, the search field, the shelf's list and the record. Radix's default
   * treats a press on any of them as "the reader is done with this layer", which
   * is wrong for every one of them. The map already decides what a press means —
   * another country moves the panel, open water clears the selection and closes
   * it — so letting the layer close first would turn every country-to-country
   * press into an exit followed by an entrance. And the map's own zoom cluster
   * is not "outside" in any sense a reader recognises: the first version of this
   * only spared presses inside MapLibre's container, so pressing `+` twice threw
   * away the panel the reader was zooming in to read.
   *
   * What is left is a surface that closes on Escape, on its own control, and
   * when the selection it is about goes away. All three are deliberate.
   */
  const keepOnOutsidePress = React.useCallback((event: Event) => {
    event.preventDefault()
  }, [])

  const hoverCountry =
    hoverCode === null ? null : (factsByCode.get(hoverCode) ?? null)
  const panelCountry =
    panelCode === null ? null : (factsByCode.get(panelCode) ?? null)
  const panelGoal =
    panelCode === null ? null : (goalsByCode.get(panelCode) ?? null)

  const surfaces =
    container === null
      ? null
      : createPortal(
          <>
            {hoverCode === null || hoverFrame === null ? null : (
              <AnchoredSurface
                key={`hover-${hoverCode}`}
                frame={hoverFrame}
                host={container}
                decorative
                state={hover.state}
                className={layout.hug}
              >
                <div
                  aria-hidden="true"
                  data-part="country-hover"
                  data-country={hoverCode}
                  data-state={hover.state}
                  data-motion-transform=""
                  className={cn('flex', layout.motion)}
                >
                  {hoverCountry === null ? (
                    <CountryCard
                      variant="compact"
                      countryCode={hoverCode}
                      decorative
                    />
                  ) : (
                    <CountryCard
                      {...factColumns(hoverCode, hoverCountry)}
                      decorative
                    />
                  )}
                </div>
              </AnchoredSurface>
            )}

            {/* `panelTarget` is what the dialog is open *about*; `panel.target`
                is what is still on screen. They differ for exactly the 150ms of
                the exit, and that gap is the whole point: Radix can only defer
                its own content's unmount, so while this component tore the
                layer down in the same commit as the close, the pop-out had no
                frame to play in and the panel simply blinked out. */}
            <DialogPrimitive.Root
              open={panelTarget !== null}
              modal={false}
              onOpenChange={(next) => {
                if (!next) close()
              }}
            >
              {panel.target === null ? null : (
                <AnchoredSurface
                  key={`panel-${panel.target.code}`}
                  frame={panel.target.frame}
                  host={container}
                  decorative={false}
                  minHeight={PANEL_MIN_HEIGHT}
                  state={panel.state}
                  className={layout.panelWidth}
                >
                  <CountryPanel
                    countryCode={panel.target.code}
                    country={panelCountry}
                    goal={panelGoal}
                    status={status}
                    onRetry={onRetry}
                    onCloseAutoFocus={returnFocus}
                    onFocusOutside={keepOnFocusMove}
                    onInteractOutside={keepOnOutsidePress}
                  />
                </AnchoredSurface>
              )}
            </DialogPrimitive.Root>
          </>,
          container,
        )

  return (
    <>
      {surfaces}
      {paint}
    </>
  )
}
