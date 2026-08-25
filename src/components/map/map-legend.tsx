import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  GlassPanel,
  IconButton,
  SectionLabel,
  transitionBase,
} from '#/components/ui'
import { formatNumber } from '#/lib/format'
import { useAtlasI18n } from './copy'
import { ClusterPin, DayPin } from './pins'
import { CategoryIcon } from './category-icon'

import type { MapCorner } from './map-controls'
import type { MapCategory } from './types'

type CategoryVars = React.CSSProperties & Record<'--map-category', string>

/** The same four logical corners the control cluster uses — see `MapCorner`. */
const CORNERS: Readonly<Record<MapCorner, string>> = {
  'top-left': 'top-4 start-4',
  'top-right': 'top-4 end-4',
  'bottom-left': 'bottom-4 start-4',
  'bottom-right': 'end-4 bottom-10',
  custom: '',
}

export interface MapLegendProps {
  readonly categories: ReadonlyArray<MapCategory>
  /** Place count per category id. Rendered with tabular numerals. */
  readonly counts?: Readonly<Record<string, number>>
  /** Overrides the panel's own heading. Defaults to the translated one. */
  readonly title?: string
  /** Explains the numbered pin and the cluster badge. Default `true`. */
  readonly showPinKey?: boolean
  readonly position?: MapCorner
  readonly defaultOpen?: boolean
  readonly className?: string
}

/**
 * The key to what is on the map.
 *
 * Collapsible, because on a phone the map *is* the screen and a legend that
 * cannot get out of the way is a legend that gets in the way. Collapsed it is a
 * labelled header the reader can still read; the toggle is a real button with
 * `aria-expanded`, so the state is announced rather than implied by a chevron.
 */
export function MapLegend({
  categories,
  counts,
  title,
  showPinKey = true,
  position = 'bottom-left',
  defaultOpen = true,
  className,
}: MapLegendProps) {
  const { locale, t } = useAtlasI18n()
  const heading = title ?? t('atlas.map.legend.title')
  const [open, setOpen] = React.useState(defaultOpen)
  const bodyId = React.useId()

  if (categories.length === 0 && !showPinKey) return null

  return (
    <GlassPanel
      radius="lg"
      padding="sm"
      className={cn(
        'absolute z-map-overlay w-52 max-w-[calc(100%-2rem)]',
        CORNERS[position],
        className,
      )}
    >
      <SectionLabel
        as="h2"
        action={
          <IconButton
            variant="ghost"
            size="xs"
            label={
              open
                ? t('atlas.map.legend.collapse', { title: heading })
                : t('atlas.map.legend.expand', { title: heading })
            }
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((current) => !current)}
            icon={
              <ChevronDown
                size={14}
                strokeWidth={2.5}
                className={cn(transitionBase, open ? 'rotate-0' : '-rotate-90')}
              />
            }
          />
        }
      >
        {heading}
      </SectionLabel>

      {open ? (
        <div id={bodyId} className="mt-2.5 space-y-2.5">
          {categories.length > 0 ? (
            <ul className="space-y-1.5">
              {categories.map((category) => {
                const vars: CategoryVars = { '--map-category': category.colour }
                const count = counts?.[category.id]
                return (
                  <li
                    key={category.id}
                    className="flex items-center gap-2"
                    style={vars}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-(--map-category)/12 text-(--map-category)"
                    >
                      <CategoryIcon
                        name={category.icon}
                        size={11}
                        strokeWidth={2.5}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-caption text-ink-2">
                      {category.name}
                    </span>
                    {typeof count === 'number' ? (
                      <span
                        data-numeric=""
                        className="shrink-0 text-caption text-ink-4 tabular-nums"
                      >
                        {formatNumber(count, locale)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}

          {showPinKey ? (
            <ul
              className={cn(
                'space-y-1.5',
                categories.length > 0 && 'border-t border-glass-edge pt-2.5',
              )}
            >
              <li className="flex items-center gap-2">
                <DayPin
                  day={2}
                  size="sm"
                  interactive={false}
                  label={t('atlas.map.legend.dayPin')}
                />
                <span className="text-caption text-ink-3">
                  {t('atlas.map.legend.dayPinMeaning')}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <ClusterPin
                  count={6}
                  weight="sm"
                  interactive={false}
                  label={t('atlas.map.legend.clusterPin')}
                />
                <span className="text-caption text-ink-3">
                  {t('atlas.map.legend.clusterPinMeaning')}
                </span>
              </li>
            </ul>
          ) : null}
        </div>
      ) : null}
    </GlassPanel>
  )
}
