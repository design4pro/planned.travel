import { cn } from '#/lib/cn'
import type { TripArtPoint } from '#/server/community/read-model'

export function TripArt({
  points,
  dayCount = 0,
  className,
}: {
  points: ReadonlyArray<TripArtPoint>
  dayCount?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 320 200"
      width="320"
      height="200"
      aria-hidden="true"
      focusable="false"
      className={cn(
        'aspect-[8/5] h-auto w-full bg-brand-subtle text-brand',
        className,
      )}
    >
      <circle cx="270" cy="30" r="110" fill="currentColor" opacity="0.06" />
      <text
        x="24"
        y="172"
        fontSize="144"
        fontWeight="600"
        fill="currentColor"
        opacity="0.12"
      >
        {dayCount || ''}
      </text>
      {points.length === 0 ? (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M90 140 145 65 175 105 198 82 240 140Z" />
          <circle cx="220" cy="57" r="12" />
        </g>
      ) : (
        points.map((point, index) => {
          const previous = points[index - 1]
          const x = 30 + point.x * 260
          const y = 30 + point.y * 140
          return (
            <g key={index}>
              {previous && !point.startsSegment ? (
                <path
                  d={`M${30 + previous.x * 260} ${30 + previous.y * 140}L${x} ${y}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              ) : null}
              <circle cx={x} cy={y} r="4" fill="currentColor" />
            </g>
          )
        })
      )}
    </svg>
  )
}
