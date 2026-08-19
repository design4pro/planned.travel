/**
 * The cover a trip or a journal entry gets when it has no photograph.
 *
 * A tinted band with a badge in one corner and flags in the other reads as an
 * image that failed to load, and an oversized initial reads as a watermark.
 * What reads as a cover somebody *drew* is contour lines: the one graphic every
 * traveller already associates with terrain, generated from the record's own id
 * so the same trip always gets the same landform, and stroked in `currentColor`
 * so the palette is chosen by the wash rather than by this file.
 *
 * Everything here is deterministic arithmetic — no assets, no requests, no
 * randomness — so the server and the client draw the identical path list and
 * hydration is silent.
 */

import { cn } from '#/lib/cn'

/** The drawing box. Cropped, never stretched, whatever the card's width is. */
const VIEW = { width: 100, height: 40 } as const

const RINGS = 9
/** Vertices per contour. Enough that the curve reads as smooth at 4× scale. */
const SEGMENTS = 56

/**
 * A small stable hash, so a cover never changes between renders or reloads.
 * Exported because the wash a card picks has to come from the same number as the
 * landform, or a re-ordered palette silently re-pairs colour with drawing.
 */
export function seedFrom(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/**
 * Concentric closed curves around a seeded centre, each radius perturbed by two
 * out-of-phase sine terms. Two terms rather than one: a single term draws a
 * flower, two draw something that reads as a coastline.
 */
export function contourPaths(id: string): ReadonlyArray<string> {
  const seed = seedFrom(id)
  const cx = 26 + (seed % 48)
  const cy = 8 + ((seed >> 5) % 24)
  const lobes = 3 + (seed % 3)
  const phase = ((seed >> 9) % 360) * (Math.PI / 180)
  const stretch = 1.25 + ((seed >> 13) % 5) / 10

  const paths: Array<string> = []
  for (let ring = 0; ring < RINGS; ring += 1) {
    const base = 3.5 + ring * 4.2
    const points: Array<string> = []
    for (let step = 0; step <= SEGMENTS; step += 1) {
      const angle = (step / SEGMENTS) * Math.PI * 2
      const wobble =
        1 +
        0.15 * Math.sin(lobes * angle + phase) +
        0.07 * Math.sin(2 * lobes * angle - phase * 1.7)
      const radius = base * wobble
      const x = cx + radius * Math.cos(angle) * stretch
      const y = cy + radius * Math.sin(angle)
      points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
    }
    paths.push(`M${points.join('L')}Z`)
  }
  return paths
}

export interface CoverArtProps {
  /** Seeds the landform. The record's id, so the cover is stable for its life. */
  readonly id: string
  /** Gradient wash utilities, e.g. `from-brand-subtle via-brand-subtle/45`. */
  readonly wash: string
  /** Text-colour utility the contours inherit, e.g. `text-brand/40`. */
  readonly ink: string
  readonly className?: string
}

export function CoverArt({ id, wash, ink, className }: CoverArtProps) {
  const paths = contourPaths(id)

  return (
    <span aria-hidden className={cn('absolute inset-0', className)}>
      <span
        className={cn('absolute inset-0 bg-linear-to-br to-transparent', wash)}
      />
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid slice"
        className={cn('absolute inset-0 size-full', ink)}
        focusable="false"
      >
        {paths.map((path, index) => (
          <path
            key={path.slice(0, 24) + String(index)}
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={index === 0 ? 0.9 : 0.55}
            // The innermost rings sit closest to the eye, so they carry the most
            // weight and the outer ones fade into the wash.
            opacity={1 - index * 0.085}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </span>
  )
}
