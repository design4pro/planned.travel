/**
 * The colour a category wears in the donut ring and its legend.
 *
 * It is read from the same `text-<hue>` token the ledger's category chip uses
 * (`EXPENSE_CATEGORY_TINT`), so the ring, the legend dot and the chip are one hue by
 * construction, and the colour follows the category rather than its position after a
 * sort. The eight data tokens are distinct in both themes; nothing else in the
 * donut knows where a colour comes from.
 */
import { expenseTint } from '../../../-lib/tone'

/** The hue token of a chip tint such as `bg-surface-inset text-data-1`: `data-1`. */
const TEXT_HUE = /(?:^|\s)text-([a-z0-9-]+)(?:\s|$)/

function hueOf(tint: string | undefined): string | null {
  return tint?.match(TEXT_HUE)?.[1] ?? null
}

/** An opaque CSS colour, `var(--color-<hue>)`. A string outside the enum reads as `other`. */
export function categoryColour(category: string): string {
  const hue = hueOf(expenseTint(category))
  return `var(--color-${hue ?? 'data-8'})`
}
