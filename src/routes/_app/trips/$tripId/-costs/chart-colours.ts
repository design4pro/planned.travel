/**
 * The colour a category wears in the donut ring and its legend.
 *
 * It is read from the same `text-<hue>` token the ledger's category chip uses
 * (`EXPENSE_CATEGORY_TINT`), so the ring, the legend dot and the chip are one hue by
 * construction, and the colour follows the category rather than its position after a
 * sort. This is the single function to replace when the category palette gets its own
 * data tokens: nothing else in the donut knows where a colour comes from.
 */
import { EXPENSE_CATEGORY_TINT } from '../../../-lib/tone'

/** The hue token of a chip tint such as `bg-info-soft text-info`: `info`. */
const TEXT_HUE = /(?:^|\s)text-([a-z0-9-]+)(?:\s|$)/

function hueOf(tint: string | undefined): string | null {
  return tint?.match(TEXT_HUE)?.[1] ?? null
}

/** An opaque CSS colour, `var(--color-<hue>)`. A string outside the enum reads as `other`. */
export function categoryColour(category: string): string {
  const hue =
    hueOf(EXPENSE_CATEGORY_TINT[category]) ?? hueOf(EXPENSE_CATEGORY_TINT.other)
  return `var(--color-${hue ?? 'ink-3'})`
}
