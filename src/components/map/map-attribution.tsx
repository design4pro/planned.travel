import * as React from 'react'

import { cn } from '#/lib/cn'
import { GEOAPIFY_CREDITS } from '#/lib/geo/credits'
import { MAP_ATTRIBUTION } from '#/lib/map/style'
import { focusRing } from '#/components/ui'
import { useAtlasCopy } from './copy'
import { useAttributionSlot, useMapContext } from './map-context'

import type { MapCredit } from '#/lib/map/style'

export interface MapCreditListProps {
  readonly credits: ReadonlyArray<MapCredit>
}

/**
 * The credit links themselves, with nothing around them.
 *
 * Inline elements only, so this drops into a sentence as readily as into the
 * pill below — and it exists precisely so there is one implementation of "a
 * credit link" rather than one per surface that owes a credit. The two surfaces
 * are the pill, which credits the tiles, and the "basemap unavailable" panel,
 * which credits the outlines it is drawing in their place.
 */
export function MapCreditList({ credits }: MapCreditListProps) {
  return (
    <>
      {credits.map((entry, index) => (
        <React.Fragment key={entry.href}>
          {index > 0 ? (
            // Spaced with a margin rather than by the parent's `gap`, so the
            // separator reads the same in a flex pill and inside a sentence.
            <span aria-hidden="true" className="mx-1 text-ink-4">
              ·
            </span>
          ) : null}
          <a
            href={entry.href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'pointer-events-auto rounded-sm underline decoration-edge-strong underline-offset-2',
              'transition-colors duration-fast ease-out-quint hover:text-ink hover:decoration-ink-3',
              focusRing,
            )}
          >
            {entry.label}
          </a>
        </React.Fragment>
      ))}
    </>
  )
}

export type MapAttributionProps = React.ComponentPropsWithoutRef<'div'>

/**
 * The geocoder's credits the tile credit does not already carry.
 *
 * Both sources credit OpenStreetMap, and one line naming it twice would be noise, so
 * a geocoder credit is dropped when its link is already on the line.
 */
const GEOCODER_CREDITS: ReadonlyArray<MapCredit> = GEOAPIFY_CREDITS.filter(
  (credit) => !MAP_ATTRIBUTION.some((entry) => entry.href === credit.url),
).map((credit) => ({ label: credit.name, href: credit.url }))

/**
 * Data credit for the vector basemap.
 *
 * MapLibre ships its own attribution control, but it comes with its own white
 * pill, its own blue links and its own type — three things that read as a
 * third-party widget bolted onto the product. This is the same obligation
 * discharged in our own palette, at our own type scale, in both themes, with real
 * links that are reachable by keyboard.
 *
 * The credit follows the data, and with no archive there is no tile data: every
 * line on screen then comes from the outlines bundled with the app. Crediting
 * OpenStreetMap there would name a source the reader cannot see, so the pill
 * stands down entirely — and the credit for what *is* drawn travels with
 * `BasemapNotice`, the panel that explains it. That is not a credit lost: the
 * canvas renders that panel for exactly as long as the archive is missing, so
 * the outlines are named once, in the one place a reader is already looking,
 * and never as a second pill stacked behind the panel where nobody can read it.
 *
 * The geocoder is credited on the same line (ADR 0013): every coordinate a map
 * draws may have come from it, so its credit follows the tile credit wherever
 * that is shown, as a second segment with its own sentence rather than a second
 * badge.
 *
 * Placing one of these inside a `MapCanvas` also takes the map's single credit
 * slot, so the canvas stands its own default copy down rather than leaving a
 * screen reader to read the same credit twice.
 */
export const MapAttribution = React.forwardRef<
  HTMLDivElement,
  MapAttributionProps
>(({ className, ...props }, ref) => {
  const t = useAtlasCopy()
  const { basemap } = useMapContext()
  useAttributionSlot()

  // Only a confirmed archive earns the tile credit. `loading` is reachable
  // exactly once — while a retry from `unavailable` is in flight — and there the
  // bundled outlines are still the thing being drawn, still credited by the
  // notice that is still on screen.
  if (basemap !== 'available') return null

  return (
    <div
      ref={ref}
      className={cn(
        // Logical, so the credit sits at the end of the reading order in `ar`
        // as it does in `en`. A host that needs it physically placed overrides
        // with `right-*`/`left-*`, which Tailwind emits later and so wins.
        'pointer-events-none absolute end-2 bottom-2 z-map-overlay flex items-center',
        'rounded-full bg-glass px-2.5 py-1 text-caption text-ink-3 ring-1 ring-glass-edge ring-inset backdrop-glass',
        className,
      )}
      {...props}
    >
      <span className="sr-only">{t('atlas.map.attribution.label')}</span>
      <MapCreditList credits={MAP_ATTRIBUTION} />
      {GEOCODER_CREDITS.length === 0 ? null : (
        <>
          <span aria-hidden="true" className="mx-1 text-ink-4">
            ·
          </span>
          <span className="sr-only">{t('atlas.map.attribution.geocoder')}</span>
          <MapCreditList credits={GEOCODER_CREDITS} />
        </>
      )}
    </div>
  )
})
MapAttribution.displayName = 'MapAttribution'
