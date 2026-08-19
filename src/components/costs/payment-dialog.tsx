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
import { currencyCode, formatMoney, parseMoney, toAmountInput } from '#/lib/money'
import { parseDay, toDayString } from './data'

import type { CostsPerson, SettlementMethod } from '#/server/fns/costs'

const SETTLEMENT_METHOD_OPTIONS: ReadonlyArray<{
  readonly value: SettlementMethod
  readonly label: string
}> = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'app', label: 'Payment app' },
  { value: 'other', label: 'Something else' },
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
  const fallbackFrom = seed?.fromUserId ?? viewerUserId
  const fallbackTo =
    seed?.toUserId ?? people.find((person) => person.userId !== fallbackFrom)?.userId ?? ''

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
  const distinct = fromUserId !== '' && toUserId !== '' && fromUserId !== toUserId
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
      setError(messageOf(cause))
    } finally {
      setSaving(false)
    }
  }

  const options = people.map((person) => ({
    value: person.userId,
    label: person.userId === viewerUserId ? `${person.name} (you)` : person.name,
    description: person.email === '' ? undefined : person.email,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Logging a transfer clears it from both balances. It does not move any
            money — planned.travel keeps the ledger, your bank moves the cash.
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
              <Alert tone="danger" title="That did not save">
                {error}
              </Alert>
            )}

            <div className="flex items-center gap-3 rounded-lg border border-edge-faint bg-surface-2 p-3">
              <Avatar name={nameOf(fromUserId)} size="sm" />
              <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-4" />
              <Avatar name={nameOf(toUserId)} size="sm" />
              <p className="min-w-0 flex-1 truncate text-caption text-ink-2">
                {distinct
                  ? `${nameOf(fromUserId)} pays ${nameOf(toUserId)}`
                  : 'Pick two different travellers.'}
              </p>
              <span className="shrink-0 font-display text-subtitle font-bold tabular-nums text-ink">
                {formatMoney(amountMinor ?? 0, currency)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Paid by" required>
                <SimpleSelect
                  options={options}
                  value={fromUserId}
                  onValueChange={setFromUserId}
                  ariaLabel="Who is paying"
                />
              </Field>
              <Field
                label="Paid to"
                required
                error={distinct ? undefined : 'A payment needs two different travellers.'}
              >
                <SimpleSelect
                  options={options}
                  value={toUserId === '' ? undefined : toUserId}
                  onValueChange={setToUserId}
                  ariaLabel="Who is being paid"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`Amount in ${currencyCode(currency)}`}
                required
                error={
                  amount.trim() !== '' && (amountMinor === null || amountMinor === 0)
                    ? 'Enter an amount greater than zero.'
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
              <Field label="How">
                <SimpleSelect
                  options={[...SETTLEMENT_METHOD_OPTIONS]}
                  value={method}
                  onValueChange={(next) => setMethod(asMethod(next))}
                  ariaLabel="How the payment was made"
                />
              </Field>
            </div>

            <Field label="Date">
              <DatePicker
                value={parseDay(settledOn)}
                onChange={(next) => setSettledOn(next === null ? today : toDayString(next))}
                ariaLabel="Date of the payment"
              />
            </Field>

            <Field label="Note" hint="Optional. A reference, or what it covered.">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                autoResize
                maxRows={4}
                maxLength={500}
                size="sm"
                placeholder="Covers the Kyoto hotel and the JR passes."
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" shape="pill" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel="Recording the payment"
          >
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The select's string, narrowed to the methods the schema allows. */
function asMethod(value: string): SettlementMethod {
  return SETTLEMENT_METHOD_OPTIONS.find((entry) => entry.value === value)?.value ?? 'other'
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return 'The payment could not be recorded. Try again in a moment.'
}
