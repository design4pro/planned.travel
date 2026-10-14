/**
 * The control that picks the currency the costs figures are also shown in.
 *
 * Exactly three kinds of choice are enabled: each trip in its own currency, the workspace default
 * (named by its code) and a code a recorded rate answers for. Every other curated code stays on the
 * list, disabled, with the reason written beside it - a reader who cannot pick a currency learns
 * why in words, not from a greyed-out row. The indicator beside the control reads the code the
 * secondary figures are in; the large figures and the totals stay in the budget currency.
 */
import { Badge, SimpleSelect } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { displayCurrencyChoices } from './data'

import type { DisplayCurrency } from '#/lib/money'
import type { CostsDisplayChoices } from '#/server/fns/costs'
import type { DisplayChoiceReason } from './data'

/** An item value cannot be empty, and no currency code can be this, so it stands for "per trip". */
const PER_TRIP = '__per-trip'

export interface DisplayCurrencyMenuProps {
  readonly display: DisplayCurrency
  readonly choices: CostsDisplayChoices
  readonly budgetCurrency: string
  /** A write is in flight: the control keeps its place and focus, and a second pick is ignored until it settles. */
  readonly saving: boolean
  /** `null` is "each trip in its own currency". */
  readonly onChange: (code: string | null) => void
}

export function DisplayCurrencyMenu({
  display,
  choices,
  budgetCurrency,
  saving,
  onChange,
}: DisplayCurrencyMenuProps) {
  const t = useTranslate()
  const { enabled, disabled } = displayCurrencyChoices({
    display,
    choices,
    budgetCurrency,
  })

  const hintFor = (reason: DisplayChoiceReason): string | undefined => {
    if (reason === 'rate') return t('costs.display.menu.rateHint')
    if (reason === 'current') return t('costs.display.menu.currentHint')
    return undefined
  }

  const indicator =
    display.mode === 'fixed'
      ? t('costs.display.indicator.fixed', { code: display.code })
      : t('costs.display.indicator.perTrip')

  const options = [
    { value: PER_TRIP, label: t('costs.display.menu.perTrip') },
    ...enabled.map((choice) => ({
      value: choice.code,
      label:
        choice.reason === 'workspace'
          ? t('costs.display.menu.workspace', { code: choice.code })
          : choice.code,
      description: hintFor(choice.reason),
    })),
    ...disabled.map((code) => ({
      value: code,
      label: code,
      description: t('costs.display.menu.needsLiveRate'),
      disabled: true,
    })),
  ]

  return (
    <div
      data-part="display-currency"
      className="flex shrink-0 items-center gap-2"
    >
      <Badge
        tone={display.mode === 'fixed' ? 'accent' : 'outline'}
        size="sm"
        data-part="display-currency-indicator"
        aria-hidden="true"
      >
        {indicator}
      </Badge>
      <SimpleSelect
        size="sm"
        className="w-44 shrink-0"
        options={options}
        value={display.mode === 'fixed' ? display.code : PER_TRIP}
        // Not `disabled`: a disabled trigger cannot take the focus Radix hands back when the list
        // closes, and the reader would lose their place. A pick made mid-write is ignored instead.
        onValueChange={(next) => {
          if (!saving) onChange(next === PER_TRIP ? null : next)
        }}
        ariaLabel={t('costs.display.label')}
      />
      {/* Always mounted, so a change of its text is announced: the write in flight, then the choice
          now in force (the visible indicator is hidden from a screen reader so it is read once). */}
      <span
        aria-live="polite"
        data-part="display-currency-live"
        className="sr-only"
      >
        {saving ? t('costs.display.menu.saving') : indicator}
      </span>
    </div>
  )
}
