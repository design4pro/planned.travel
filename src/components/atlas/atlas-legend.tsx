import * as React from 'react'

import { SectionLabel, Skeleton } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  DISTANT_AFTER_YEARS,
  RECENT_WITHIN_YEARS,
} from '#/lib/map/visit-recency'

import type { VisitRamp } from '#/lib/map/visit-recency'

/**
 * The map's key.
 *
 * The atlas paints one hue and lets lightness carry how recently each country
 * was last visited. That is a good data map and an unreadable one on its own:
 * adjacent stops on the ramp measure 1.20–1.25:1 against each other, which is a
 * difference a reader can see but cannot decode. `visited-countries.tsx` says so
 * in its own header and hands the obligation to whichever screen mounts it —
 * WCAG 1.4.1 is not something a paint expression can discharge.
 *
 * So this exists, and three things about it are deliberate.
 *
 * **The numbers come from the ramp, not from a copywriter.** `RECENT_WITHIN_YEARS`
 * and `DISTANT_AFTER_YEARS` are the very constants `visitRecency()` cuts the ramp
 * at. Retune the ramp and this legend retunes with it; hard-coded prose would
 * quietly start lying on the first change, and a key that disagrees with the map
 * is worse than no key.
 *
 * **Colour is never the only carrier.** Every swatch is labelled in words, the
 * four steps are in a stated order, and the footnote points at the countries
 * list, where each country's actual dates are written out in text. A reader who
 * cannot separate the three greens loses nothing — the same information is on
 * screen as prose.
 *
 * **Unvisited land is a step, not the absence of one.** The map draws the whole
 * world, so the pale fill means something specific and gets named. Left out, the
 * reader is invited to guess whether a pale country is unvisited or unrecorded.
 *
 * Every step's label is 12px at full opacity — the floor the rest of the atlas
 * holds, and precisely where the bar we are measured against fails: its own key
 * renders at 9px and about 2.4:1 against its panel. The only 11px type here is
 * the product's own `SectionLabel`, which is a heading rather than a value.
 */

/** One row of the key: a fill, what it means, and how it is measured. */
interface LegendStep {
  /** The `VisitRamp` stop it paints, or `unvisited` for bare land. */
  readonly id: VisitRamp | 'unvisited'
  /** The swatch's own classes — fill plus the hairline that separates it. */
  readonly swatch: string
  readonly label: string
}

/**
 * The four fills a reader can see on the map, in ramp order.
 *
 * Recent first, because the map is read as "where have I been lately"; unvisited
 * last, because it is the ground everything else is measured against.
 */
function legendSteps(
  recent: number,
  distant: number,
): ReadonlyArray<LegendStep> {
  return [
    {
      id: 'visitedRecent',
      swatch: 'bg-country-visited-recent ring-country-visited-edge',
      label: recent === 1 ? 'Within the last year' : `Within ${recent} years`,
    },
    {
      id: 'visited',
      swatch: 'bg-country-visited ring-country-visited-edge',
      label: `${recent}–${distant} years ago`,
    },
    {
      id: 'visitedDistant',
      swatch: 'bg-country-visited-distant ring-country-visited-edge',
      label: `Over ${distant} years ago`,
    },
    {
      id: 'unvisited',
      swatch: 'bg-country-land ring-country-land-edge',
      label: 'Not visited yet',
    },
  ]
}

/**
 * Shared with {@link AtlasLegendSkeleton}, so the loading shape cannot drift from
 * the key it stands in for and swap one for the other without moving the panel.
 */
const layout = {
  root: 'flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2',
  /** The eyebrow is the key's heading, so it is a real one. */
  heading: 'shrink-0',
  list: 'flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2',
  item: 'flex min-w-0 items-center gap-2',
  /** A hairline inside the swatch, so a pale fill still has an edge on glass. */
  swatch: 'size-3 shrink-0 rounded-xs ring-1 ring-inset',
  label: 'min-w-0 text-caption tabular-nums text-ink-2',
  /**
   * Held back on a phone, where the shelf is a drawer with 190px of content in
   * it and this sentence costs three lines of that. What it points at — the
   * countries list, with every date written out — is on the same screen, one tab
   * away, so nothing is lost but the signpost.
   */
  note: 'hidden min-w-0 basis-full text-caption text-ink-3 sm:block xl:basis-auto',
} as const

export interface AtlasLegendProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children'
> {
  /**
   * Where the ramp's strong end stops, in years. Defaults to the constant the
   * map itself paints from; a caller only overrides it to demonstrate the key.
   */
  readonly recentWithinYears?: number
  /** Where the faint end starts, in years. Same default, same reason. */
  readonly distantAfterYears?: number
}

export const AtlasLegend = React.forwardRef<HTMLDivElement, AtlasLegendProps>(
  (
    {
      recentWithinYears = RECENT_WITHIN_YEARS,
      distantAfterYears = DISTANT_AFTER_YEARS,
      className,
      ...props
    },
    ref,
  ) => {
    const headingId = React.useId()
    const steps = legendSteps(recentWithinYears, distantAfterYears)

    return (
      <div
        ref={ref}
        role="group"
        aria-labelledby={headingId}
        data-part="legend"
        className={cn(layout.root, className)}
        {...props}
      >
        <SectionLabel as="h3" id={headingId} className={layout.heading}>
          Last visit
        </SectionLabel>

        <ul className={layout.list}>
          {steps.map((step) => (
            <li key={step.id} data-step={step.id} className={layout.item}>
              {/* Decoration. The label beside it is what states the step, which
                  is the whole point of a key. */}
              <span
                aria-hidden="true"
                className={cn(layout.swatch, step.swatch)}
              />
              <span className={layout.label}>{step.label}</span>
            </li>
          ))}
        </ul>

        <p className={layout.note}>
          Shade shows recency only — every date is written out under Countries.
        </p>
      </div>
    )
  },
)
AtlasLegend.displayName = 'AtlasLegend'

/**
 * The key's loading shape, cut from the same `layout` strings so the panel's
 * footer measures the same before and after the read lands.
 */
export const AtlasLegendSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(layout.root, className)}
    {...props}
  >
    <Skeleton radius="sm" className="h-3 w-16 shrink-0" />
    <div className={layout.list}>
      {[0, 1, 2, 3].map((step) => (
        <div key={step} className={layout.item}>
          <Skeleton radius="sm" className={layout.swatch} />
          <Skeleton radius="sm" className="h-3 w-24" />
        </div>
      ))}
    </div>
  </div>
))
AtlasLegendSkeleton.displayName = 'AtlasLegendSkeleton'
