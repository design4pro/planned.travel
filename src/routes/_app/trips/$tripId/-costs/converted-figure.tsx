/**
 * The figure a row carries in the reader's display currency.
 *
 * It is the quiet second figure: the large amount, the day totals and the tiles stay in the budget
 * currency, so everything on screen that adds up still adds up. The code is written out after the
 * number, never a bare symbol, so two dollars cannot pass for each other. A row no rate converted
 * says so in words instead of repeating its budget-currency amount as though it were converted.
 */
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoneyPlain } from '#/lib/money'

import type { DisplayCurrency } from '#/lib/money'

export interface ConvertedFigureProps {
  readonly display: DisplayCurrency
  /** The amount in the display currency; `null` when no frozen rate answered. */
  readonly convertedMinor: number | null
}

export function ConvertedFigure({
  display,
  convertedMinor,
}: ConvertedFigureProps) {
  const t = useTranslate()
  const locale = useLocale()

  if (display.mode === 'per-trip') {
    return null
  }
  if (convertedMinor === null) {
    return (
      <span
        data-part="converted-figure"
        className="shrink-0 text-caption text-ink-4"
      >
        {t('costs.display.row.notConverted')}
      </span>
    )
  }
  const amount = formatMoneyPlain(convertedMinor, display.code, locale)
  // A span has no role, so an aria-label on it is not announced; the phrase is text instead, and the
  // short visible form is hidden from a screen reader so the figure is read once.
  return (
    <span
      data-part="converted-figure"
      className="shrink-0 text-caption tabular-nums text-ink-3"
    >
      <span aria-hidden="true">
        {t('costs.display.row.converted', { amount, code: display.code })}
      </span>
      <span className="sr-only">
        {t('costs.display.row.convertedLabel', {
          amount,
          code: display.code,
        })}
      </span>
    </span>
  )
}
