/**
 * The trip route sheet.
 *
 * Every planning screen answers a spatial question — how far apart are these,
 * which cluster is walkable, what did we leave stranded on the far side of the
 * river — and a list of addresses answers none of them. So the plan screen leads
 * with a drawing of the trip: each stop at its true Mercator position, the days
 * joined in the order they are walked, and a scale bar so the gaps mean something.
 *
 * It is deliberately *not* a tiled basemap. Street detail belongs to the map
 * surface in `#/components/map`, which needs a vector archive to say anything at
 * all; this panel is drawn entirely from the trip's own coordinates plus the
 * coastlines bundled in `#/lib/map/world`, so it renders the same on a plane as it
 * does in the office, and it never degrades into a grey rectangle. What it claims
 * is exactly what it shows: which land the stops are on, relative position, order
 * and distance.
 */

import * as React from 'react'

import { cn } from '#/lib/cn'
import { landPath } from '#/lib/map/world'
import { SectionLabel } from '#/components/ui'

import type { DegreeBox, Projection } from '#/lib/map/world'

/* ------------------------------------------------------------------ geometry */

/** The drawing's own coordinate space. Aspect is handled by `preserveAspectRatio`. */
const VIEW = { width: 480, height: 480 } as const
/** Room for the header line above and the scale bar below. */
const INSET = { x: 46, y: 62 } as const

const EARTH_RADIUS_KM = 6371

/**
 * How wide the sheet must be, in degrees of longitude, before the generalised
 * coastline is drawn under the stops. Twenty degrees is roughly the width of
 * western Europe: at that scale one drawing unit is tens of kilometres and the
 * outline's nine-kilometre tolerance disappears.
 */
const LAND_MIN_SPAN_DEGREES = 20

export interface RouteStop {
  readonly id: string
  readonly name: string
  readonly lat: number
  readonly lng: number
  /** 1-based itinerary day. `null` for a place that has not been placed yet. */
  readonly dayNumber: number | null
  /** Order within the day, ascending. */
  readonly order: number
  /** Category colour from the tenant's own taxonomy. */
  readonly colour: string | null
}

interface Projected extends RouteStop {
  readonly x: number
  readonly y: number
}

/** Web Mercator y, in the same units as longitude, clamped short of the poles. */
function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat))
  const radians = (clamped * Math.PI) / 180
  return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + radians / 2))
}

function haversineKm(a: RouteStop, b: RouteStop): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 1 / 2 / 5 / 10 … so the scale bar always reads as a round number. */
function niceStep(value: number): number {
  const exponent = Math.floor(Math.log10(value))
  const magnitude = 10 ** exponent
  const scaled = value / magnitude
  const step = scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1
  return step * magnitude
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString('en-GB')} km`
}

interface Layout {
  readonly stops: ReadonlyArray<Projected>
  /** Projected degrees per drawing unit — the basis of the scale bar. */
  readonly degreesPerUnit: number
  readonly centreLat: number
  /** The same transform the stops went through, for the coastline underneath. */
  readonly project: Projection
  /** Which slice of the globe the sheet can actually show. */
  readonly window: DegreeBox
}

/**
 * Mercator is only conformal *locally*, and a sheet of one trip is local: even a
 * transcontinental trip spans a few tens of degrees. So the coastline is drawn
 * through the identical linear transform as the stops, which is what guarantees a
 * pin sits on its own island rather than a few pixels off it.
 */
function inverseMercatorLat(y: number): number {
  return (
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 2)
  )
}

function project(stops: ReadonlyArray<RouteStop>): Layout | null {
  if (stops.length === 0) return null

  const xs = stops.map((stop) => stop.lng)
  const ys = stops.map((stop) => mercatorY(stop.lat))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  // A single stop, or a perfectly straight line of them, has no extent on one
  // axis. Give it one so the projection stays finite and the pin lands centred.
  const spanX = Math.max(maxX - minX, 0.004)
  const spanY = Math.max(maxY - minY, 0.004)

  const boxW = VIEW.width - INSET.x * 2
  const boxH = VIEW.height - INSET.y * 2
  const scale = Math.min(boxW / spanX, boxH / spanY)

  const drawnW = spanX * scale
  const drawnH = spanY * scale
  const originX = (VIEW.width - drawnW) / 2
  const originY = (VIEW.height - drawnH) / 2
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  const toX = (lng: number) => originX + (lng - midX + spanX / 2) * scale
  const toY = (lat: number) =>
    originY + (midY - mercatorY(lat) + spanY / 2) * scale

  // The inverse of the two transforms above, at the sheet's four edges. A margin
  // of one sheet-width either side keeps a coastline that only *enters* the
  // drawing from being culled before it is projected.
  const lngAt = (x: number) => midX - spanX / 2 + (x - originX) / scale
  const latAt = (y: number) =>
    inverseMercatorLat(midY + spanY / 2 - (y - originY) / scale)

  return {
    stops: stops.map((stop) => ({
      ...stop,
      x: toX(stop.lng),
      y: toY(stop.lat),
    })),
    degreesPerUnit: 1 / scale,
    centreLat:
      (Math.min(...stops.map((s) => s.lat)) +
        Math.max(...stops.map((s) => s.lat))) /
      2,
    project: (lng, lat) => [toX(lng), toY(lat)],
    window: {
      minLng: lngAt(-VIEW.width),
      maxLng: lngAt(VIEW.width * 2),
      minLat: latAt(VIEW.height * 2),
      maxLat: latAt(-VIEW.height),
    },
  }
}

/* ------------------------------------------------------------------- drawing */

export interface TripRouteSheetProps {
  readonly stops: ReadonlyArray<RouteStop>
  /** Shown in the panel's own header, e.g. `8 stops · 12 km walked`. */
  readonly caption?: string
  readonly className?: string
}

/**
 * Groups the stops into one polyline per day, in walking order. Days are drawn
 * separately on purpose: joining the last stop of Tuesday to the first of
 * Wednesday would draw an overnight teleport as if it were a walk.
 */
function routesByDay(
  stops: ReadonlyArray<Projected>,
): ReadonlyArray<{ day: number; points: ReadonlyArray<Projected> }> {
  const byDay = new Map<number, Array<Projected>>()
  for (const stop of stops) {
    if (stop.dayNumber === null) continue
    const bucket = byDay.get(stop.dayNumber)
    if (bucket === undefined) {
      byDay.set(stop.dayNumber, [stop])
    } else {
      bucket.push(stop)
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, points]) => ({
      day,
      points: [...points].sort((a, b) => a.order - b.order),
    }))
}

export function TripRouteSheet({
  stops,
  caption,
  className,
}: TripRouteSheetProps) {
  const layout = React.useMemo(() => project(stops), [stops])

  const scale = React.useMemo(() => {
    if (layout === null) return null
    // One drawing unit in kilometres at the sheet's centre latitude.
    const kmPerDegree =
      (Math.PI / 180) *
      EARTH_RADIUS_KM *
      Math.cos((layout.centreLat * Math.PI) / 180)
    const kmPerUnit = layout.degreesPerUnit * kmPerDegree
    const target = niceStep(kmPerUnit * 180)
    return { km: target, units: target / kmPerUnit }
  }, [layout])

  const walked = React.useMemo(() => {
    if (layout === null) return 0
    let total = 0
    for (const leg of routesByDay(layout.stops)) {
      for (let index = 1; index < leg.points.length; index += 1) {
        total += haversineKm(leg.points[index - 1], leg.points[index])
      }
    }
    return total
  }, [layout])

  // The bundled outlines are generalised to 0.08°, about nine kilometres. Drawn
  // across a continent that is a fraction of a pixel; drawn across one city it
  // would be a lie in the shape of a coastline. So land appears only once the
  // sheet is wide enough to absorb it, and a city trip keeps the drafting sheet,
  // which claims nothing it cannot show.
  const land = React.useMemo(() => {
    if (layout === null) return ''
    const spanDegrees = layout.degreesPerUnit * VIEW.width
    if (spanDegrees < LAND_MIN_SPAN_DEGREES) return ''
    return landPath(layout.window, layout.project)
  }, [layout])

  if (layout === null) return null

  const legs = routesByDay(layout.stops)

  return (
    <section
      className={cn(
        'route-sheet relative overflow-hidden rounded-2xl border border-edge bg-surface shadow-card',
        className,
      )}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4">
        <SectionLabel as="h2">Where everything is</SectionLabel>
        <p className="text-caption text-ink-3">
          {caption ??
            `${stops.length} placed · ${formatKm(walked)} between stops`}
        </p>
      </header>

      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative block size-full"
        role="img"
        aria-label={`Relative positions of ${stops.length} stops across ${legs.length} days, with the route walked on each day.`}
      >
        {land === '' ? null : (
          <path
            aria-hidden
            d={land}
            fill="var(--color-surface-inset)"
            stroke="var(--color-edge-strong)"
            strokeWidth={0.9}
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}

        {legs.map((leg) =>
          leg.points.length < 2 ? null : (
            <polyline
              key={`leg-${leg.day}`}
              points={leg.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="7 6"
              opacity={0.55}
            />
          ),
        )}

        {layout.stops.map((stop) => (
          <g key={stop.id}>
            <circle
              cx={stop.x}
              cy={stop.y}
              r={13}
              fill="var(--color-surface)"
              stroke={stop.colour ?? 'var(--color-edge-strong)'}
              strokeWidth={2.5}
            />
            <text
              x={stop.x}
              y={stop.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--color-ink)"
              fontSize={12}
              fontWeight={600}
            >
              {stop.dayNumber ?? '\u00b7'}
            </text>
          </g>
        ))}

        {scale === null ? null : (
          <g aria-hidden>
            <path
              d={`M ${INSET.x} ${VIEW.height - 26} v 7 h ${scale.units} v -7`}
              fill="none"
              stroke="var(--color-ink-4)"
              strokeWidth={1.5}
            />
            <text
              x={INSET.x + scale.units + 10}
              y={VIEW.height - 18}
              fill="var(--color-ink-3)"
              fontSize={12}
            >
              {formatKm(scale.km)}
            </text>
          </g>
        )}
      </svg>

      <p className="pointer-events-none absolute end-5 bottom-4 text-caption text-ink-4">
        Numbers are days
      </p>
    </section>
  )
}
