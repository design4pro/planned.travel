import * as React from 'react'

import { cn } from '#/lib/cn'
import { MAP_ATTRIBUTION } from '#/lib/map/style'
import { focusRing } from '#/components/ui'

export type MapAttributionProps = React.ComponentPropsWithoutRef<'div'>

/**
 * Data credit for the basemap.
 *
 * MapLibre ships its own attribution control, but it comes with its own white
 * pill, its own blue links and its own type — three things that read as a
 * third-party widget bolted onto the product. This is the same obligation
 * discharged in our own palette, at our own type scale, in both themes, with real
 * links that are reachable by keyboard.
 */
export const MapAttribution = React.forwardRef<
  HTMLDivElement,
  MapAttributionProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'pointer-events-none absolute right-2 bottom-2 z-dropdown flex items-center gap-1',
      'rounded-full bg-glass px-2.5 py-1 text-caption text-ink-3 ring-1 ring-glass-edge ring-inset backdrop-glass',
      className,
    )}
    {...props}
  >
    <span className="sr-only">Map data from</span>
    {MAP_ATTRIBUTION.map((entry, index) => (
      <React.Fragment key={entry.href}>
        {index > 0 ? (
          <span aria-hidden="true" className="text-ink-4">
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
  </div>
))
MapAttribution.displayName = 'MapAttribution'
