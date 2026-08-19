import * as React from 'react'
import { Layers } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  Chip,
  GlassToolbar,
  Tooltip,
  TooltipProvider,
  focusRing,
  transitionBase,
} from '#/components/ui'
import { CategoryIcon } from './category-icon'
import { useRovingFocus } from './use-roving-focus'

import type { MapCategory } from './types'

/** A category colour arrives as data, so it travels as a custom property. */
type CategoryVars = React.CSSProperties & Record<'--map-category', string>

export interface CategoryFilterBarProps {
  readonly categories: ReadonlyArray<MapCategory>
  /** Selected category ids. Empty means "everything", not "nothing". */
  readonly selected: ReadonlyArray<string>
  readonly onChange: (next: ReadonlyArray<string>) => void
  /** Place count per category id, shown in each tooltip. */
  readonly counts?: Readonly<Record<string, number>>
  /** Total places, shown on the "All" chip. */
  readonly total?: number
  readonly className?: string
  readonly label?: string
}

interface CategoryButtonProps {
  readonly category: MapCategory
  readonly selected: boolean
  readonly count: number | undefined
  readonly onToggle: () => void
  readonly item: ReturnType<ReturnType<typeof useRovingFocus>['itemProps']>
}

/**
 * One category toggle.
 *
 * The filled state is `--color-accent`, not the category's own colour: a tenant
 * can pick any hex, and a pale one would leave the glyph unreadable. The colour
 * still identifies the category — as a dot that reads as the same key used by the
 * pin rings and the legend — while contrast stays guaranteed in both themes.
 */
function CategoryButton({
  category,
  selected,
  count,
  onToggle,
  item,
}: CategoryButtonProps) {
  const vars: CategoryVars = { '--map-category': category.colour }
  const hint =
    count === undefined
      ? category.name
      : `${category.name} · ${count} ${count === 1 ? 'place' : 'places'}`

  return (
    <Tooltip content={hint} side="bottom">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={category.name}
        onClick={onToggle}
        style={vars}
        className={cn(
          'relative grid size-9 shrink-0 place-items-center rounded-full',
          transitionBase,
          focusRing,
          selected
            ? 'bg-accent text-accent-on shadow-card'
            : 'text-ink-3 hover:bg-hover hover:text-ink',
        )}
        {...item}
      >
        <CategoryIcon name={category.icon} size={16} />
        <span
          aria-hidden="true"
          className={cn(
            'absolute right-1 bottom-1 size-1.5 rounded-full bg-(--map-category)',
            selected && 'ring-1 ring-accent-on/40',
          )}
        />
      </button>
    </Tooltip>
  )
}

/**
 * The category filter that floats over the map.
 *
 * A real toolbar of real toggle buttons: one tab stop, arrow keys between the
 * categories, `aria-pressed` on each so a screen reader hears the filter state
 * rather than guessing from a colour. Icon-only by design — the reference bar is
 * the strongest thing on that screen and it earns the space by staying glyphs —
 * with the name in both the tooltip and the accessible name, so nothing depends
 * on recognising an icon.
 */
export function CategoryFilterBar({
  categories,
  selected,
  onChange,
  counts,
  total,
  className,
  label = 'Filter places by category',
}: CategoryFilterBarProps) {
  const selectedSet = React.useMemo(() => new Set(selected), [selected])
  // The "All" chip is the first item in the roving order.
  const roving = useRovingFocus({
    count: categories.length + 1,
    orientation: 'horizontal',
  })

  const toggle = (id: string): void => {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  if (categories.length === 0) return null

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <GlassToolbar
        label={label}
        onKeyDown={roving.onKeyDown}
        className={cn(
          'absolute top-4 left-1/2 z-dropdown max-w-[calc(100%-2rem)] -translate-x-1/2',
          'gap-1 overflow-x-auto scrollbar-none',
          className,
        )}
      >
        <Chip
          size="md"
          tone="neutral"
          selected={selectedSet.size === 0}
          count={total}
          icon={<Layers />}
          onClick={() => onChange([])}
          className="shrink-0"
          {...roving.itemProps(0)}
        >
          All
        </Chip>

        {categories.map((category, index) => (
          <CategoryButton
            key={category.id}
            category={category}
            selected={selectedSet.has(category.id)}
            count={counts?.[category.id]}
            onToggle={() => toggle(category.id)}
            item={roving.itemProps(index + 1)}
          />
        ))}
      </GlassToolbar>
    </TooltipProvider>
  )
}
