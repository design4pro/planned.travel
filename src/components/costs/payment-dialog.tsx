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
 */
import { useId, useState } from 'react'
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
import { useLocale, useTranslate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'
import {
  currencyCode,
  formatMoney,
  parseMoney,
  toAmountInput,
} from '#/lib/money'
import { parseDay, toDayString } from './data'

import type { CostsPerson, SettlementMethod } from '#/server/fns/costs'

const SETTLEMENT_METHOD_OPTIONS: ReadonlyArray<{
  readonly value: SettlementMethod
  readonly label: MessageKey
}> = [
  { value: 'bank_transfer', label: 'costs.payment.method.bankTransfer' },
  { value: 'cash', label: 'costs.payment.method.cash' },
  { value: 'card', label: 'costs.payment.method.card' },
  { value: 'app', label: 'costs.payment.method.app' },
  { value: 'other', label: 'costs.payment.method.other' },
]

/** Exactly the shape `recordPaymentFn` validates. */
export interface PaymentFormValue {
  readonly fromUserId: string
  readonly toUserId: string
  readonly amountMinor: number
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
  const fallbackFrom = seed?.fromUserId ?? viewerUserId
  const fallbackTo =
    seed?.toUserId ??
    people.find((person) => person.userId !== fallbackFrom)?.userId ??
    ''

  const [fromUserId, setFromUserId] = useState(fallbackFrom)
  const [toUserId, setToUserId] = useState(fallbackTo)
  const [amount, setAmount] = useState(
    seed === null ? '' : toAmountInput(seed.amountMinor, currency),
  )
  const [method, setMethod] = useState<SettlementMethod>('bank_transfer')
  const [settledOn, setSettledOn] = useState(today)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formId = `payment-form-${useId()}`

  const amountMinor = parseMoney(amount, currency)
  const distinct =
    fromUserId !== '' && toUserId !== '' && fromUserId !== toUserId
  const canSave = distinct && amountMinor !== null && amountMinor > 0 && !saving

  const nameOf = (userId: string): string =>
    people.find((person) => person.userId === userId)?.name ?? 'Traveller'

  async function submit(): Promise<void> {
    // `canSave` already proves the amount parsed, so narrowing follows from it.
    if (!canSave) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        fromUserId,
        toUserId,
        amountMinor,
        method,
        settledOn,
        note: note.trim() === '' ? null : note.trim(),
      })
      onOpenChange(false)
    } catch (cause) {
      setError(messageOf(cause, t('costs.payment.failed')))
    } finally {
      setSaving(false)
    }
  }

  const options = people.map((person) => ({
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
            {error === null ? null : (
              <Alert tone="danger" title={t('costs.expense.saveFailed')}>
                {error}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('costs.payment.amountIn', {
                  currency: currencyCode(currency),
                })}
                required
                error={
                  amount.trim() !== '' &&
                  (amountMinor === null || amountMinor === 0)
                    ? t('costs.payment.amountPositive')
                    : undefined
                }
              >
                <Input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={toAmountInput(0, currency)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  leading={<Coins />}
                  required
                />
              </Field>
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
            </div>

            <Field label={t('costs.field.date')}>
              <DatePicker
                value={parseDay(settledOn)}
                onChange={(next) =>
                  setSettledOn(next === null ? today : toDayString(next))
                }
                ariaLabel={t('costs.payment.dateLabel')}
              />
            </Field>

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

/**
 * A server message if there is one, otherwise the catalogue's fallback.
 *
 * The fallback arrives as an argument rather than being read here: this is a
 * plain function outside the component, and the translator belongs to the
 * component that has one.
 */
function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return fallback
}
