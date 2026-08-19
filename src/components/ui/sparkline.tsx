import * as React from 'react'

import { cn } from '#/lib/cn'

type Point = [number, number]

const round = (n: number): number => Math.round(n * 100) / 100

/**
 * Catmull-Rom through the points, converted to cubic béziers. A straight
 * polyline reads as a chart; a smooth curve reads as an illustration, which is
 * what a sparkline inside an editorial card wants to be.
 *
 * `tension` 0 gives a polyline, 1 gives the standard Catmull-Rom curve.
 */
function smoothPath(points: Array<Point>, tension: number): string {
  if (points.length === 0) return ''

  const head = points[0]
  if (points.length < 3) {
    let simple = `M ${head[0]} ${head[1]}`
    for (let i = 1; i < points.length; i++) {
      simple += ` L ${points[i][0]} ${points[i][1]}`
    }
    return simple
  }

  const clamp = (i: number): Point =>
    points[Math.min(Math.max(i, 0), points.length - 1)]

  let d = `M ${head[0]} ${head[1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = clamp(i - 1)
    const p1 = clamp(i)
    const p2 = clamp(i + 1)
    const p3 = clamp(i + 2)

    const c1x = round(p1[0] + ((p2[0] - p0[0]) / 6) * tension)
    const c1y = round(p1[1] + ((p2[1] - p0[1]) / 6) * tension)
    const c2x = round(p2[0] - ((p3[0] - p1[0]) / 6) * tension)
    const c2y = round(p2[1] - ((p3[1] - p1[1]) / 6) * tension)
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

export type SparklineProps = Omit<
  React.ComponentPropsWithoutRef<'svg'>,
  'children' | 'viewBox'
> & {
  /** Series in reading order. A single point renders as a centred dot. */
  data: Array<number>
  width?: number
  height?: number
  strokeWidth?: number
  /** Fill the area beneath the curve with a vertical fade. */
  area?: boolean
  /** Mark the final point — the "you are here" dot. */
  showEndDot?: boolean
  /** 0 = polyline, 1 = fully rounded. */
  tension?: number
  /**
   * A sparkline is decoration beside a number that already carries the value,
   * so it is `aria-hidden` unless you give it a label.
   */
  label?: string
}

/**
 * A tiny, dependency-free trend curve. Output is deterministic, so it renders
 * identically on the server and the client and never causes a hydration flash.
 * Colour comes from `currentColor`, which lets the same component sit on a
 * white card and on an inverse one with no variant at all.
 */
export const Sparkline = React.forwardRef<SVGSVGElement, SparklineProps>(
  (
    {
      className,
      data,
      width = 72,
      height = 28,
      strokeWidth = 1.75,
      area = false,
      showEndDot = false,
      tension = 0.85,
      label,
      ...props
    },
    ref,
  ) => {
    const geometry = React.useMemo(() => {
      if (data.length === 0) return null

      const inset = strokeWidth
      const usableW = Math.max(1, width - inset * 2)
      const usableH = Math.max(1, height - inset * 2)

      const min = Math.min(...data)
      const max = Math.max(...data)
      const span = max - min || 1

      const points: Array<Point> = data.map((value, i) => [
        round(
          inset +
            (data.length === 1
              ? usableW / 2
              : (i / (data.length - 1)) * usableW),
        ),
        round(inset + usableH - ((value - min) / span) * usableH),
      ])

      const line = smoothPath(points, tension)
      const last = points[points.length - 1]
      const first = points[0]

      return {
        line,
        fill: `${line} L ${last[0]} ${height} L ${first[0]} ${height} Z`,
        last,
      }
    }, [data, width, height, strokeWidth, tension])

    // `useId` output contains delimiter characters that are not safe inside an
    // SVG fragment reference, so strip everything but word characters.
    const gradientId = `pt-spark-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

    if (!geometry) return null

    return (
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        className={cn('overflow-visible', className)}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        {...props}
      >
        {area ? (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={geometry.fill} fill={`url(#${gradientId})`} />
          </>
        ) : null}
        <path
          d={geometry.line}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showEndDot ? (
          <circle
            cx={geometry.last[0]}
            cy={geometry.last[1]}
            r={strokeWidth * 1.4}
            fill="currentColor"
          />
        ) : null}
      </svg>
    )
  },
)
Sparkline.displayName = 'Sparkline'
