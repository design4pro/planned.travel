/**
 * Who a trip's spend was divided between, as a proportional bar and the list under it.
 *
 * Built for the inverse "Total trip spend" tile, so every colour is the tile's own
 * on-ground colour: the segments are stepped tints of it and the part of the spend no
 * one was assigned is an outline. The data hues are left out on purpose - they would
 * have to clear 3:1 on white and on near-black, and would put one colour on a category
 * and a traveller on the same screen.
 *
 * Presentation only: it takes names already resolved for the reader ("You", the
 * fallback for a removed traveller), shows names and percents and no amounts, and
 * fetches nothing. The bar is a picture and is hidden from assistive technology; the
 * list beneath it is its text alternative and mirrors its segments in order. With fewer
 * than two segments the bar says nothing, so the label and the list go with it.
 */
import { useId } from 'react'

import { cn } from '#/lib/cn'
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { SharePercent } from './category-donut'
import { memberSegments } from './chart-geometry'

import type { CSSProperties } from 'react'
import type { MemberSegment, MemberShare } from './chart-geometry'

/**
 * The opacity of `--color-inverse-on` for the first, second, third and fourth tinted
 * segment, brightest first. The contrast test composites each one over the tile ground
 * and asks 3:1 (WCAG 1.4.11), so a step is never lowered without it.
 */
export const MEMBER_TINTS = [1, 0.7, 0.52, 0.4] as const

export interface MemberBarProps {
  readonly members: ReadonlyArray<MemberShare>
  /** Integer minor units, the whole the widths are measured against. */
  readonly spentMinor: number
}

function segmentKey(segment: MemberSegment): string {
  return segment.kind === 'member' ? segment.userId : segment.kind
}

/** The tint of a segment by its place in the order; the outline remainder has none. */
function tintOf(segment: MemberSegment, index: number): number | undefined {
  return segment.kind === 'unassigned' ? undefined : MEMBER_TINTS[index]
}

export function MemberBar({ members, spentMinor }: MemberBarProps) {
  const labelId = useId()
  const locale = useLocale()
  const t = useTranslate()
  const segments = memberSegments(members, spentMinor)
  if (segments.length < 2) {
    return null
  }

  const nameOf = (segment: MemberSegment): string => {
    if (segment.kind === 'member') {
      return segment.name
    }
    return segment.kind === 'others'
      ? t('costs.memberBar.others', {
          count: segment.count,
          others: formatNumber(segment.count, locale),
        })
      : t('costs.memberBar.notSplit')
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        id={labelId}
        className="text-micro font-semibold uppercase tracking-label text-inverse-muted"
      >
        {t('costs.memberBar.label')}
      </p>
      <div
        aria-hidden="true"
        data-part="member-bar"
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {segments.map((segment, index) => (
          <Segment
            key={segmentKey(segment)}
            segment={segment}
            tint={tintOf(segment, index)}
            className="h-full min-w-1"
            // Widths are proportional to the share, and a flex grow of 1 would be a
            // fraction of the free space, so it is scaled to a whole number.
            style={{ flexBasis: 0, flexGrow: segment.share * 100 }}
          />
        ))}
      </div>
      <ul
        // Safari drops the list role, and the label with it, from a restyled list.
        role="list"
        aria-labelledby={labelId}
        className="flex flex-col gap-1"
      >
        {segments.map((segment, index) => (
          <li
            key={segmentKey(segment)}
            className="flex items-baseline gap-2 text-caption"
          >
            <Segment
              segment={segment}
              tint={tintOf(segment, index)}
              className="size-2.5 shrink-0 self-center rounded-sm"
            />
            {/* The name wraps: it is never cut off, whatever the width. */}
            <span className="min-w-0 flex-1 text-inverse-on [overflow-wrap:anywhere]">
              {nameOf(segment)}
            </span>
            <span className="sr-only">, </span>
            <span className="shrink-0 tabular-nums text-inverse-muted">
              <SharePercent
                share={segment.share}
                allocated={segment.percent}
                locale={locale}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One mark of the bar or of the list's key: a tint of the on-ground colour, or an outline. */
function Segment({
  segment,
  tint,
  className,
  style,
}: {
  segment: MemberSegment
  tint: number | undefined
  className: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden="true"
      data-segment={segment.kind}
      className={cn(
        'box-border',
        tint === undefined ? 'border border-inverse-muted' : 'bg-inverse-on',
        className,
      )}
      style={{ ...style, opacity: tint }}
    />
  )
}
