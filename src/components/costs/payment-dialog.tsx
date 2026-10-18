/**
 * Recording a payment between two travellers.
 *
 * Opened blank from the settle-up panel's own action, or pre-filled from a
 * suggested transfer — the two paths share one form, so the figure a reader
 * accepted from the suggestion is the figure they can still edit before it is
 * written.
 *
 * Like the expense dialog, this owns no data access. The caller hands it a submit
 * function; it hands back exactly the shape `recordPaymentFn` validates.
 *
 * The currency pair follows the expense dialog's rule. `amount` is typed in whatever
 * currency the money left the account in; when that is not the trip's own, a second
 * field appears for what the payer's statement shows in the trip's currency, and the
 * implied rate is shown under it. The rate is never sent: the server derives it from
 * the two amounts.
 */
import { useId, useRef, useState } from 'react'
import { ArrowRight, Coins } from 'lucide-react'

import {
  Alert,
  Avatar,
  Button,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SimpleSelect,
  Textarea,
} from '#/components/ui'
import { messageOf } from '#/components/modules/shared'
import { currencyRefusalOf } from '#/lib/currency-refusals'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'
import {
  CURRENCY_OPTIONS,
  currencyCode,
  formatExchangeRate,
  formatMoney,
  parseMoney,
  toAmountInput,
} from '#/lib/money'
import { offeredPeople, parseDay, toDayString } from './data'
import { SETTLEMENT_METHOD_OPTIONS } from './payment-methods'
import { useStaleTripCurrency } from './stale-trip-currency'

import type { CostsPerson, SettlementMethod } from '#/server/fns/costs'

/** Exactly the shape `recordPaymentFn` validates. */
export interface PaymentFormValue {
  readonly fromUserId: string
  readonly toUserId: string
  /** The sum in the trip's currency, as the payer's statement shows it. */
  readonly amountMinor: number
  /** The sum that left the account, when it was in another currency. */
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly method: SettlementMethod
  readonly settledOn: string
  readonly note: string | null
}

export interface PaymentSeed {
  readonly fromUserId: string
  readonly toUserId: string
  readonly amountMinor: number
}

export interface PaymentDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Pre-fills the form from a suggested transfer. `null` opens it blank. */
  readonly seed: PaymentSeed | null
  readonly people: ReadonlyArray<CostsPerson>
  readonly viewerUserId: string
  readonly currency: string
  readonly today: string
  readonly onSubmit: (value: PaymentFormValue) => Promise<void>
}

/**
 * The caller keys this component per opening, the same way it keys the expense
 * dialog, so the form is seeded on mount and never re-seeded mid exit animation.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  seed,
  people,
  viewerUserId,
  currency,
  today,
  onSubmit,
}: PaymentDialogProps) {
  const t = useTranslate()
  const locale = useLocale()
  // A member who left the workspace is not offered for new money, only on a payment that carries them.
  const offered = offeredPeople(people, [
    seed?.fromUserId ?? null,
    seed?.toUserId ?? null,
  ])
  const fallbackFrom = seed?.fromUserId ?? viewerUserId
  const fallbackTo =
    seed?.toUserId ??
    offered.find((person) => person.userId !== fallbackFrom)?.userId ??
    ''

  const [fromUserId, setFromUserId] = useState(fallbackFrom)
  const [toUserId, setToUserId] = useState(fallbackTo)
  const [amount, setAmount] = useState(
    seed === null ? '' : toAmountInput(seed.amountMinor, currency),
  )
  const [sourceCurrency, setSourceCurrency] = useState(currencyCode(currency))
  const [converted, setConverted] = useState('')
  const [method, setMethod] = useState<SettlementMethod>('bank_transfer')
  const [settledOn, setSettledOn] = useState(today)
  const [note, setNote] = useState('')
  // What the dialog opened with: a Settle-suggested amount is in the currency the suggestion was made
  // in, so after a re-basing it is only worth keeping if the reader typed it.
  const [openedAmount] = useState(amount)
  const amountRef = useRef<HTMLInputElement>(null)
  const convertedRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const foreign = currencyCode(sourceCurrency) !== currencyCode(currency)
  // The figure that carries the old currency's digits: the converted one when there is one.
  const stale = useStaleTripCurrency(currency, saving, () =>
    foreign ? convertedRef.current : amountRef.current,
  )
  const formId = `payment-form-${useId()}`

  // The trip's currency changed while this was open and the screen has refreshed: what was typed
  // stays, a currency control still on the old one follows the trip, and a converted figure (which
  // was in the old currency) is dropped rather than saved under the new one.
  if (stale.adopt !== null) {
    stale.adopted()
    if (currencyCode(sourceCurrency) === stale.adopt.from) {
      setSourceCurrency(stale.adopt.to)
    }
    if (
      amount === openedAmount &&
      currencyCode(sourceCurrency) === stale.adopt.from
    ) {
      setAmount('')
    }
    setConverted('')
  }
  const staleMessage =
    stale.messageFor === null
      ? undefined
      : t('costs.refusal.tripCurrencyChanged', { to: stale.messageFor })

  const typedMinor = parseMoney(amount, sourceCurrency)
  const staleOnAmount = foreign ? undefined : staleMessage
  const amountError =
    amount.trim() !== '' && (typedMinor === null || typedMinor === 0)
      ? t('costs.payment.amountPositive')
      : staleOnAmount
  const amountMinor = foreign ? parseMoney(converted, currency) : typedMinor
  const rate = foreign
    ? formatExchangeRate(
        {
          originalAmountMinor: typedMinor,
          originalCurrency: sourceCurrency,
          amountMinor: amountMinor ?? 0,
          currency,
        },
        locale,
      )
    : null
  const distinct =
    fromUserId !== '' && toUserId !== '' && fromUserId !== toUserId
  const canSave =
    distinct &&
    typedMinor !== null &&
    typedMinor > 0 &&
    amountMinor !== null &&
    amountMinor > 0 &&
    !saving &&
    // After a stale-currency refusal the typed digits are still in the old currency, so the amount
    // has to be looked at (edited) before it can be saved again.
    stale.messageFor === null
  const convertedInvalid =
    foreign &&
    converted.trim() !== '' &&
    !(amountMinor !== null && amountMinor > 0)
  const convertedErrorKey: MessageKey =
    amountMinor === null
      ? 'costs.expense.convertedNotANumber'
      : 'costs.payment.amountPositive'

  /**
   * The suggested amount a Settle press seeds is in the trip's currency. Picking another
   * currency moves it to the converted field, where it still means what it says, instead of
   * relabelling it as a sum in the new currency; picking the trip's currency again moves it back.
   */
  const changeSourceCurrency = (next: string): void => {
    const seeded =
      seed === null ? null : toAmountInput(seed.amountMinor, currency)
    const toForeign = currencyCode(next) !== currencyCode(currency)
    if (seeded !== null && toForeign && !foreign && amount === seeded) {
      setAmount('')
      setConverted(seeded)
    } else if (
      seeded !== null &&
      !toForeign &&
      foreign &&
      amount === '' &&
      converted === seeded
    ) {
      setAmount(seeded)
      setConverted('')
    }
    stale.dismiss()
    setSourceCurrency(next)
  }

  const nameOf = (userId: string): string =>
    people.find((person) => person.userId === userId)?.name ??
    t('costs.rebase.someone')

  async function submit(): Promise<void> {
    // `canSave` already proves the amount parsed, so narrowing follows from it.
    if (!canSave) {
      return
    }
    setSaving(true)
    setError(null)
    stale.dismiss()
    try {
      await onSubmit({
        fromUserId,
        toUserId,
        amountMinor,
        originalAmountMinor: foreign ? typedMinor : null,
        originalCurrency: foreign ? currencyCode(sourceCurrency) : null,
        method,
        settledOn,
        note: note.trim() === '' ? null : note.trim(),
      })
      onOpenChange(false)
    } catch (cause) {
      if (currencyRefusalOf(cause) === 'costs.refusal.tripCurrencyChanged') {
        stale.refuse(currencyCode(currency))
      } else {
        setError(messageOf(cause, t('costs.payment.failed')))
      }
    } finally {
      setSaving(false)
    }
  }

  const options = offered.map((person) => ({
    value: person.userId,
    label:
      person.userId === viewerUserId
        ? t('costs.payment.youSuffix', { name: person.name })
        : person.name,
    description: person.email === '' ? undefined : person.email,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('costs.payment.title')}</DialogTitle>
          <DialogDescription>
            {t('costs.payment.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {error === null && !stale.pending ? null : (
              <Alert tone="danger" title={t('costs.expense.saveFailed')}>
                {error ?? t('costs.refusal.rebaseChanged')}
              </Alert>
            )}

            <div className="flex items-center gap-3 rounded-lg border border-edge-faint bg-surface-2 p-3">
              <Avatar name={nameOf(fromUserId)} size="sm" />
              <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-4" />
              <Avatar name={nameOf(toUserId)} size="sm" />
              <p className="min-w-0 flex-1 truncate text-caption text-ink-2">
                {distinct
                  ? t('costs.payment.pays', {
                      from: nameOf(fromUserId),
                      to: nameOf(toUserId),
                    })
                  : t('costs.payment.pickTwo')}
              </p>
              <span className="shrink-0 font-display text-subtitle font-bold tabular-nums text-ink">
                {formatMoney(amountMinor ?? 0, currency, locale)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('costs.field.paidBy')} required>
                <SimpleSelect
                  options={options}
                  value={fromUserId}
                  onValueChange={setFromUserId}
                  ariaLabel={t('costs.payment.whoPaying')}
                />
              </Field>
              <Field
                label={t('costs.payment.paidTo')}
                required
                error={distinct ? undefined : t('costs.payment.needsTwo')}
              >
                <SimpleSelect
                  options={options}
                  value={toUserId === '' ? undefined : toUserId}
                  onValueChange={setToUserId}
                  ariaLabel={t('costs.payment.whoPaid')}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
              <Field
                label={t('costs.payment.amountIn', {
                  currency: currencyCode(sourceCurrency),
                })}
                required
                error={amountError}
              >
                <Input
                  ref={amountRef}
                  value={amount}
                  onChange={(event) => {
                    stale.dismiss()
                    setAmount(event.target.value)
                  }}
                  placeholder={toAmountInput(0, sourceCurrency)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  leading={<Coins />}
                  required
                />
              </Field>
              <Field
                label={t('costs.field.currency')}
                disabled={saving}
                data-part="payment-currency"
              >
                <SimpleSelect
                  options={CURRENCY_OPTIONS.map((entry) => ({
                    value: entry.code,
                    label: entry.code,
                    description: entry.name,
                  }))}
                  value={sourceCurrency}
                  onValueChange={changeSourceCurrency}
                  ariaLabel={t('costs.payment.currencyLabel')}
                />
              </Field>
            </div>

            {foreign ? (
              <Field
                label={t('costs.expense.convertedTo', {
                  currency: currencyCode(currency),
                })}
                required
                disabled={saving}
                hint={
                  rate ??
                  t('costs.expense.convertedHint', {
                    from: currencyCode(sourceCurrency),
                    to: currencyCode(currency),
                  })
                }
                error={convertedInvalid ? t(convertedErrorKey) : staleMessage}
              >
                <Input
                  ref={convertedRef}
                  value={converted}
                  onChange={(event) => {
                    stale.dismiss()
                    setConverted(event.target.value)
                  }}
                  placeholder={toAmountInput(0, currency)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  leading={<Coins />}
                  required
                />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('costs.payment.how')}>
                <SimpleSelect
                  options={SETTLEMENT_METHOD_OPTIONS.map((entry) => ({
                    value: entry.value,
                    label: t(entry.label),
                  }))}
                  value={method}
                  onValueChange={(next) => setMethod(asMethod(next))}
                  ariaLabel={t('costs.payment.howMade')}
                />
              </Field>
              <Field label={t('costs.field.date')}>
                <DatePicker
                  value={parseDay(settledOn)}
                  onChange={(next) =>
                    setSettledOn(next === null ? today : toDayString(next))
                  }
                  ariaLabel={t('costs.payment.dateLabel')}
                />
              </Field>
            </div>

            <Field
              label={t('costs.payment.note')}
              hint={t('costs.payment.noteHint')}
            >
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                autoResize
                maxRows={4}
                maxLength={500}
                size="sm"
                placeholder={t('costs.payment.notePlaceholder')}
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel={t('costs.payment.recording')}
          >
            {t('costs.payment.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The select's string, narrowed to the methods the schema allows. */
function asMethod(value: string): SettlementMethod {
  return (
    SETTLEMENT_METHOD_OPTIONS.find((entry) => entry.value === value)?.value ??
    'other'
  )
}
