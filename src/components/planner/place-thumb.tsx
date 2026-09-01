import * as React from 'react'

import { cn } from '#/lib/cn'
import { CategoryIcon } from '#/components/map/category-icon'

/** A category colour arrives as data, so it travels as a custom property. */
type ThumbVars = React.CSSProperties & Record<'--thumb-accent', string>

const VIEW = 40
const RINGS = 3
const SEGMENTS = 28

/**
 * A small stable hash. The same place gets the same landform for its whole life,
 * on the server and on the client, so hydration is silent.
 */
function seedFrom(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/**
 * Concentric closed curves around a seeded centre.
 *
 * The same contour language as a trip cover, redrawn for a 40px tile: three rings
 * instead of nine and a single wobble term instead of two, because at this size
 * more detail is just noise. What it has to achieve is narrow — read as something
 * somebody drew rather than as an image that failed to load — and three arcs and a
 * glyph do that.
 */
function contourPaths(id: string): ReadonlyArray<string> {
  const seed = seedFrom(id)
  const cx = 12 + (seed % 17)
  const cy = 10 + ((seed >> 5) % 21)
  const lobes = 3 + (seed % 3)
  const phase = ((seed >> 9) % 360) * (Math.PI / 180)

  const paths: Array<string> = []
  for (let ring = 0; ring < RINGS; ring += 1) {
    const base = 5 + ring * 6.5
    const points: Array<string> = []
    for (let step = 0; step <= SEGMENTS; step += 1) {
      const angle = (step / SEGMENTS) * Math.PI * 2
      const radius = base * (1 + 0.16 * Math.sin(lobes * angle + phase))
      points.push(
        `${(cx + radius * Math.cos(angle)).toFixed(1)} ${(
          cy +
          radius * Math.sin(angle)
        ).toFixed(1)}`,
      )
    }
    paths.push(`M${points.join('L')}Z`)
  }
  return paths
}

const sizes = {
  sm: 'size-9 rounded-sm',
  md: 'size-11 rounded-md',
} as const

export type PlaceThumbSize = keyof typeof sizes

export interface PlaceThumbProps {
  /** Seeds the drawn fallback. The place id, so the tile is stable for its life. */
  readonly placeId: string
  readonly imageUrl?: string | null
  /** `categories.icon` — the kebab-case `lucide-react` name. */
  readonly icon?: string | null
  /** `categories.colour`. Tints the ground and the glyph. */
  readonly colour?: string | null
  readonly size?: PlaceThumbSize
  readonly className?: string
}

/**
 * The picture on a planner row.
 *
 * The reference planner puts a photograph on every row, and rows without one are
 * exactly where a list stops looking designed. Our places may or may not carry a
 * photograph — most arrive from a guidebook, not an API — so the fallback has to be
 * as good as the photograph rather than an apology for it: the category's own
 * colour as a wash, its glyph, and a contour fragment generated from the place's
 * id. Every row therefore has a picture, no row can flash a broken image, and two
 * places in the same category still look like different places.
 *
 * Decorative throughout: the row's own text already names the place, and a
 * screen-reader user gains nothing from hearing it twice.
 */
export function PlaceThumb({
  placeId,
  imageUrl,
  icon,
  colour,
  size = 'md',
  className,
}: PlaceThumbProps) {
  const [failed, setFailed] = React.useState(false)
  const showImage = typeof imageUrl === 'string' && imageUrl !== '' && !failed
  const vars: ThumbVars = {
    '--thumb-accent': colour ?? 'var(--color-brand)',
  }

  return (
    <span
      aria-hidden="true"
      style={vars}
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden',
        'bg-surface-2 ring-1 ring-edge-faint ring-inset',
        sizes[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <span
            className="absolute inset-0 bg-(--thumb-accent) opacity-12"
            // A tenant can pick any hex, so the wash is the colour at a fixed low
            // opacity rather than a second colour that would have to be derived.
          />
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 size-full text-(--thumb-accent)"
            focusable="false"
          >
            {contourPaths(placeId).map((path, index) => (
              <path
                key={path.slice(0, 16) + String(index)}
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={index === 0 ? 1 : 0.7}
                opacity={0.42 - index * 0.1}
                strokeLinejoin="round"
              />
            ))}
          </svg>
          <span className="relative text-(--thumb-accent)">
            <CategoryIcon name={icon} size={size === 'sm' ? 14 : 16} />
          </span>
        </>
      )}
    </span>
  )
}
