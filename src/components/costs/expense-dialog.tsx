/**
 * Adding and editing an expense.
 *
 * One form for both, because the fields are identical and a separate "edit" screen
 * is how two dialogs drift apart. It owns no data access: the caller hands it a
 * submit function, and the shape it produces is the shape the server function
 * validates, so there is one description of an expense on the client.
 *
 * The currency pair is the interesting part. `amount` is always typed in whatever
 * currency the receipt was written in; when that is not the trip's own currency a
 * second field appears for the converted figure, and the implied rate is shown
 * under it. That is deliberately manual — we do not have a rate feed, and inventing
 * one would put a number on the screen that nobody can reconcile against a bank
 * statement.
 *
 * The one concession: when this trip has already frozen a rate for the picked currency, the
 * converted field starts out as the figure that rate implies, with a hint saying where it came
 * from. It is a suggestion in a field the reader has not touched, never a value they typed: the
 * first keystroke in the field ends it for good, and what is submitted is still the amount pair,
 * from which the server derives the stored rate. No rate is sent from here.
 */
import { useId, useMemo, useRef, useState } from 'react'
import { Coins, Tag, Wallet } from 'lucide-react'

import {
  Alert,
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
import { formatDate } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { openedCurrencyOptions } from '#/routes/_app/-lib/currency-names'
import {
  OFFERED_CURRENCY_CODES,
  currencyCode,
  convertMinor,
  formatExchangeRate,
  formatRateLine,
  formatMoney,
  parseMoney,
  toAmountInput,
} from '#/lib/money'
import {
  offeredPeople,
  parseDay,
  shareTotalOf,
  sharesDoNotAddUp,
  toDayString,
} from './data'
import { useStaleTripCurrency } from './stale-trip-currency'
import {
  SplitEditor,
  draftForDeparted,
  draftToInputs,
  emptyDraft,
  previewFor,
} from './split-editor'

import type { ReactNode } from 'react'
import type { SplitMethod } from '#/lib/money'
import type {
  CostsDepartedPerson,
  CostsExpense,
  CostsPayload,
  CostsPerson,
  ExpenseCategory,
} from '#/server/fns/costs'
import type { SplitDraft } from './split-editor'

/** A category, already carrying the glyph the module maps it to. */
export interface CategoryOption {
  readonly value: ExpenseCategory
  readonly label: string
  readonly icon: ReactNode
}

/** Exactly the shape `createExpenseFn` and `updateExpenseFn` validate. */
export interface ExpenseFormValue {
  readonly title: string
  readonly category: ExpenseCategory
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly spentOn: string
  readonly paidBy: string | null
  readonly splitMethod: SplitMethod
  readonly notes: string | null
  readonly participants: ReadonlyArray<{
    readonly userId: string
    readonly weight?: number
    readonly shareMinor?: number
    readonly percentage?: number
  }>
  /** The split as it will land, so the caller can draw the row before the server answers. */
  readonly shares: ReadonlyArray<{
    readonly userId: string
    readonly shareMinor: number
    readonly weight: number
  }>
}

/**
 * Props.
 *
 * The caller is expected to give this component a fresh `key` each time it opens
 * it — see `openExpenseDialog` in the costs screen. That is what resets the form,
 * rather than an effect that watches `open`: remounting on open lets the panel
 * keep its exit animation on close, because the instance that is animating out is
 * never the one being re-seeded.
 */
export interface ExpenseDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** `null` opens a blank form; an expense opens it seeded for editing. */
  readonly expense: CostsExpense | null
  readonly people: ReadonlyArray<CostsPerson>
  /**
   * Everyone a stored split names who is no longer on the trip. The dialog lists only those the
   * expense being edited carries, so that saving it does not delete their share.
   */
  readonly departedPeople?: ReadonlyArray<CostsDepartedPerson>
  readonly viewerUserId: string
  readonly tripCurrency: string
  readonly categories: ReadonlyArray<CategoryOption>
  /**
   * The category a new expense opens on. The screen picks the one this trip logs
   * most, which is right far more often than the first item in an alphabetised
   * list ever is.
   */
  readonly defaultCategory: ExpenseCategory
  /** `YYYY-MM-DD`, used as the default date on a new expense. */
  readonly today: string
  /**
   * The rate this trip last froze per foreign currency, from the costs payload. Absent, `null` or
   * without an entry for the picked currency, the converted field is not pre-filled.
   */
  readonly suggestedRate?: CostsPayload['suggestedRate']
  readonly onSubmit: (value: ExpenseFormValue) => Promise<void>
}

/** Radix rejects an empty item value, so the unclaimed payer needs a sentinel. */
const NO_PAYER = '__none'

interface FormState {
  readonly title: string
  readonly amount: string
  readonly currency: string
  readonly converted: string
  readonly category: ExpenseCategory
  readonly spentOn: string
  readonly paidBy: string
  readonly notes: string
}

/**
 * A stored category string, narrowed against the list the module supplies. A row
 * written before a category was retired still opens in the form — it just opens on
 * `other` rather than on a value the select has no option for.
 */
function asCategory(
  value: string,
  categories: ReadonlyArray<CategoryOption>,
): ExpenseCategory {
  return categories.find((entry) => entry.value === value)?.value ?? 'other'
}

/**
 * Keeps the left-to-right rate (`1 GBP = 195.00 JPY`) in one piece inside a right-to-left sentence;
 * without the isolate the bidi algorithm scatters its words and the brackets around them.
 */
const LTR_ISOLATE_START = '\u2066'
const POP_ISOLATE = '\u2069'

/**
 * The converted figure a frozen rate implies for the typed amount, as the field would hold it, or
 * `''` when there is nothing to suggest. An amount too large to convert, or one that converts to
 * nothing, is nothing to suggest, not an error or a `0.00` to show.
 */
function suggestedFigure(
  typedMinor: number | null,
  rate: number | undefined,
  from: string,
  to: string,
): string {
  if (rate === undefined || typedMinor === null || typedMinor <= 0) {
    return ''
  }
  try {
    const convertedMinor = convertMinor(typedMinor, rate, from, to)
    return convertedMinor > 0 ? toAmountInput(convertedMinor, to) : ''
  } catch (cause) {
    if (cause instanceof RangeError) {
      return ''
    }
    throw cause
  }
}

function initialState(
  expense: CostsExpense | null,
  tripCurrency: string,
  today: string,
  categories: ReadonlyArray<CategoryOption>,
  defaultCategory: ExpenseCategory,
): FormState {
  if (expense === null) {
    return {
      title: '',
      amount: '',
      currency: currencyCode(tripCurrency),
      converted: '',
      category: defaultCategory,
      spentOn: today,
      paidBy: NO_PAYER,
      notes: '',
    }
  }
  const foreign =
    expense.originalCurrency !== null && expense.originalAmountMinor !== null
  return {
    title: expense.title,
    currency: foreign
      ? currencyCode(expense.originalCurrency)
      : currencyCode(expense.currency),
    // Seeded without grouping separators: a field the reader is about to edit is
    // easier to work in as `2384.00` than as `2,384.00`.
    amount: foreign
      ? toAmountInput(expense.originalAmountMinor, expense.originalCurrency)
      : toAmountInput(expense.amountMinor, expense.currency),
    converted: foreign
      ? toAmountInput(expense.amountMinor, expense.currency)
      : '',
    category: asCategory(expense.category, categories),
    spentOn: expense.spentOn,
    paidBy: expense.paidBy ?? NO_PAYER,
    notes: expense.notes ?? '',
  }
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  people,
  departedPeople,
  viewerUserId,
  tripCurrency,
  categories,
  defaultCategory,
  today,
  suggestedRate,
  onSubmit,
}: ExpenseDialogProps) {
  const t = useTranslate()
  const locale = useLocale()
  const editing = expense !== null
  // Fixed when the dialog opens, like the draft: a member who left the workspace is not offered for
  // new money, but stays on an expense that already carries them.
  const [offered] = useState(() =>
    offeredPeople(people, [
      expense?.paidBy ?? null,
      ...(expense?.shares.map((share) => share.userId) ?? []),
    ]),
  )
  const [form, setForm] = useState<FormState>(() =>
    initialState(expense, tripCurrency, today, categories, defaultCategory),
  )
  // Fixed when the dialog opens, like the draft it seeds: a person who leaves the trip while this is
  // open keeps the row they had.
  const [departed] = useState(() =>
    (departedPeople ?? []).filter((person) =>
      expense?.shares.some((share) => share.userId === person.userId),
    ),
  )
  // The edited expense's own payer when they have left the trip: the select must keep offering
  // them, or its stored value has no option and picking someone else cannot be undone. Never a
  // payer of another expense, and a share holder who is not the payer stays out of the select.
  const [departedPayer] = useState(() => {
    const payerId = expense?.paidBy ?? null
    if (
      payerId === null ||
      people.some((person) => person.userId === payerId)
    ) {
      return null
    }
    return (
      departedPeople?.find((person) => person.userId === payerId) ?? {
        userId: payerId,
        name: null,
      }
    )
  })
  const [draft, setDraft] = useState<SplitDraft>(() =>
    expense === null
      ? emptyDraft(offered)
      : draftForDeparted(
          offered,
          departed,
          expense.amountMinor,
          expense.currency,
          expense.splitMethod,
          expense.shares,
          locale,
        ),
  )
  // What the stored shares add up to when that is not the expense's total. Read off the stored rows
  // and fixed when the dialog opens, like the draft: the editor below re-derives an equal, percent
  // or shares split from the amount and would read balanced, which is why this says otherwise (#883).
  const [storedOff] = useState(() =>
    expense !== null && sharesDoNotAddUp(expense)
      ? {
          sharesMinor: shareTotalOf(expense) ?? 0,
          totalMinor: expense.amountMinor,
          currency: expense.currency,
        }
      : null,
  )
  // Up while the converted field is still the one the dialog opened with (empty) and the reader has
  // not typed in it. Never raised again: a stored or typed figure must not be overwritten, and a
  // field the reader cleared is theirs.
  const [suggesting, setSuggesting] = useState(form.converted === '')
  // What the dialog opened with: an edited expense's stored digits are in the currency it was saved
  // in, so after a re-basing they are only worth keeping if the reader typed them.
  const [openedAmount] = useState(form.amount)
  const amountRef = useRef<HTMLInputElement>(null)
  const convertedRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const foreign = currencyCode(form.currency) !== currencyCode(tripCurrency)
  // The figure that carries the old currency's digits: the converted one when there is one.
  const stale = useStaleTripCurrency(tripCurrency, saving, () =>
    foreign ? convertedRef.current : amountRef.current,
  )
  const formId = `expense-form-${useId()}`
  const descriptionId = `expense-description-${useId()}`
  const noticeId = `expense-notice-${useId()}`

  // The trip's currency changed while this was open and the screen has refreshed: what was typed
  // stays, a currency control still on the old one follows the trip, and a converted figure (which
  // was in the old currency) is dropped and offered again from the trip's rates.
  if (stale.adopt !== null) {
    stale.adopted()
    setForm({
      ...form,
      currency:
        currencyCode(form.currency) === stale.adopt.from
          ? stale.adopt.to
          : form.currency,
      amount:
        editing &&
        form.amount === openedAmount &&
        currencyCode(form.currency) === stale.adopt.from
          ? ''
          : form.amount,
      converted: '',
    })
    setSuggesting(true)
  }
  const staleMessage =
    stale.messageFor === null
      ? undefined
      : t('costs.refusal.tripCurrencyChanged', { to: stale.messageFor })

  const typedMinor = parseMoney(form.amount, form.currency, locale)
  const staleOnAmount = foreign ? undefined : staleMessage
  const amountError =
    form.amount.trim() !== '' && typedMinor === null
      ? t('costs.expense.amountNotANumber')
      : staleOnAmount
  const suggestion = suggestedRate?.[currencyCode(form.currency)]
  const suggested =
    suggesting && foreign
      ? suggestedFigure(
          typedMinor,
          suggestion?.rate,
          form.currency,
          tripCurrency,
        )
      : ''
  // Computed here, not in an effect, so the figure follows the amount and the currency at once.
  const converted = suggesting ? suggested : form.converted
  const convertedMinor = foreign
    ? parseMoney(converted, tripCurrency, locale)
    : typedMinor
  const amountMinor = convertedMinor ?? 0

  const preview = useMemo(
    () => previewFor(draft, amountMinor, tripCurrency, locale),
    [draft, amountMinor, tripCurrency, locale],
  )

  const rate = foreign
    ? formatExchangeRate(
        {
          originalAmountMinor: typedMinor,
          originalCurrency: form.currency,
          amountMinor,
          currency: tripCurrency,
        },
        locale,
      )
    : null
  const convertedHint =
    suggested !== '' && suggestion !== undefined
      ? t('costs.expense.convertedSuggested', {
          date:
            formatDate(suggestion.observedOn, locale) ?? suggestion.observedOn,
          rate:
            LTR_ISOLATE_START +
            formatRateLine(
              suggestion.rate,
              form.currency,
              tripCurrency,
              locale,
            ) +
            POP_ISOLATE,
        })
      : (rate ??
        t('costs.expense.convertedHint', {
          from: currencyCode(form.currency),
          to: currencyCode(tripCurrency),
        }))

  const titleOk = form.title.trim().length > 0
  const amountOk = typedMinor !== null && (!foreign || convertedMinor !== null)
  // After a stale-currency refusal the typed digits are still in the old currency, so the amount
  // has to be looked at (edited) before it can be saved again.
  const canSave =
    titleOk &&
    amountOk &&
    preview.balanced &&
    !saving &&
    stale.messageFor === null

  async function submit(): Promise<void> {
    if (!canSave) {
      return
    }
    setSaving(true)
    setError(null)
    stale.dismiss()
    try {
      await onSubmit({
        title: form.title.trim(),
        category: form.category,
        amountMinor,
        currency: currencyCode(tripCurrency),
        originalAmountMinor: foreign ? typedMinor : null,
        originalCurrency: foreign ? currencyCode(form.currency) : null,
        spentOn: form.spentOn,
        paidBy: form.paidBy === NO_PAYER ? null : form.paidBy,
        splitMethod: draft.method,
        notes: form.notes.trim() === '' ? null : form.notes.trim(),
        participants: draftToInputs(draft, tripCurrency, locale),
        shares: sharesOf(draft, preview),
      })
      onOpenChange(false)
    } catch (cause) {
      if (currencyRefusalOf(cause) === 'costs.refusal.tripCurrencyChanged') {
        stale.refuse(currencyCode(tripCurrency))
      } else {
        setError(messageOf(cause, t('costs.expense.saveFallback')))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        // The warning is part of what the dialog says on open: a polite region that mounts already
        // filled is not announced, and focus lands on the field below it. The description carries its own id
        // (below), which replaces Radix's default, so it is named here whether or not the warning is up.
        aria-describedby={
          storedOff === null ? descriptionId : `${descriptionId} ${noticeId}`
        }
      >
        <DialogHeader>
          <DialogTitle>
            {t(editing ? 'costs.expense.editTitle' : 'costs.expense.addTitle')}
          </DialogTitle>
          <DialogDescription id={descriptionId}>
            {editing
              ? t('costs.expense.editDescription')
              : t('costs.expense.addDescription', {
                  currency: currencyCode(tripCurrency),
                })}
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

            {storedOff === null ? null : (
              <Alert
                id={noticeId}
                tone="warning"
                title={t('costs.expense.splitOff.title')}
              >
                {t('costs.expense.splitOff.body', {
                  shares: formatMoney(
                    storedOff.sharesMinor,
                    storedOff.currency,
                    locale,
                  ),
                  total: formatMoney(
                    storedOff.totalMinor,
                    storedOff.currency,
                    locale,
                  ),
                })}
              </Alert>
            )}

            <Field label={t('costs.expense.what')} required>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder={t('costs.expense.whatPlaceholder')}
                leading={<Tag />}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
              <Field
                label={t('costs.field.amount')}
                required
                error={amountError}
              >
                <Input
                  ref={amountRef}
                  value={form.amount}
                  onChange={(event) => {
                    stale.dismiss()
                    setForm({ ...form, amount: event.target.value })
                  }}
                  placeholder={toAmountInput(0, form.currency)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  leading={<Coins />}
                  required
                />
              </Field>
              <Field label={t('costs.field.currency')}>
                <SimpleSelect
                  options={openedCurrencyOptions(
                    t,
                    locale,
                    OFFERED_CURRENCY_CODES,
                  )}
                  value={form.currency}
                  onValueChange={(next) => {
                    stale.dismiss()
                    setForm({ ...form, currency: next })
                  }}
                />
              </Field>
            </div>

            {foreign ? (
              <Field
                label={t('costs.expense.convertedTo', {
                  currency: currencyCode(tripCurrency),
                })}
                required
                hint={convertedHint}
                error={
                  converted.trim() !== '' && convertedMinor === null
                    ? t('costs.expense.convertedNotANumber')
                    : staleMessage
                }
              >
                <Input
                  ref={convertedRef}
                  value={converted}
                  onChange={(event) => {
                    stale.dismiss()
                    setSuggesting(false)
                    setForm({ ...form, converted: event.target.value })
                  }}
                  placeholder={toAmountInput(0, tripCurrency)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  leading={<Coins />}
                  required
                />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('modules.field.category')}>
                <SimpleSelect
                  options={categories.map((entry) => ({
                    value: entry.value,
                    label: entry.label,
                    icon: entry.icon,
                  }))}
                  value={form.category}
                  onValueChange={(next) =>
                    setForm({ ...form, category: asCategory(next, categories) })
                  }
                />
              </Field>
              <Field label={t('costs.field.date')}>
                <DatePicker
                  value={parseDay(form.spentOn)}
                  onChange={(next) =>
                    setForm({
                      ...form,
                      spentOn: next === null ? today : toDayString(next),
                    })
                  }
                />
              </Field>
            </div>

            <Field
              label={t('costs.field.paidBy')}
              hint={t('costs.expense.paidByHint')}
            >
              <SimpleSelect
                options={[
                  { value: NO_PAYER, label: t('costs.expense.nobodyYet') },
                  ...(departedPayer === null
                    ? []
                    : [
                        {
                          value: departedPayer.userId,
                          label:
                            departedPayer.name ?? t('costs.person.removed'),
                        },
                      ]),
                  ...offered.map((person) => ({
                    value: person.userId,
                    label:
                      person.userId === viewerUserId
                        ? t('costs.payment.youSuffix', { name: person.name })
                        : person.name,
                    description: person.email === '' ? undefined : person.email,
                  })),
                ]}
                value={form.paidBy}
                onValueChange={(next) => setForm({ ...form, paidBy: next })}
              />
            </Field>

            <SplitEditor
              people={offered}
              departedPeople={departed}
              viewerUserId={viewerUserId}
              draft={draft}
              onDraftChange={setDraft}
              amountMinor={amountMinor}
              currency={tripCurrency}
              preview={preview}
              disabled={saving}
            />

            <Field
              label={t('modules.field.notes')}
              hint={t('costs.expense.notesHint')}
            >
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                rows={2}
                autoResize
                maxRows={5}
                maxLength={4000}
                size="sm"
                placeholder={t('costs.expense.notesPlaceholder')}
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <span className="me-auto hidden items-baseline gap-2 text-caption text-ink-3 sm:flex">
            <Wallet aria-hidden className="size-3.5 self-center" />
            {amountOk
              ? formatMoney(amountMinor, tripCurrency, locale)
              : t('costs.expense.noAmount')}
          </span>
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
            loadingLabel={t('costs.expense.saving')}
          >
            {t(editing ? 'costs.expense.saveChanges' : 'costs.expense.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The split rows as the repository will store them, weight included.
 *
 * `exact` stores a weight of 1 for every row because the amounts are the input —
 * the same convention `computeShares` uses, so an expense that round-trips through
 * this form keeps the weights it had.
 */
function sharesOf(
  draft: SplitDraft,
  preview: {
    readonly rows: ReadonlyArray<{
      readonly userId: string
      readonly shareMinor: number
    }>
  },
): Array<{
  readonly userId: string
  readonly shareMinor: number
  readonly weight: number
}> {
  const weights = new Map(
    draft.rows.map((row) => [
      row.userId,
      draft.method === 'shares'
        ? Number.parseFloat(row.weight) || 0
        : draft.method === 'percentage'
          ? Number.parseFloat(row.percentage) || 0
          : 1,
    ]),
  )
  return preview.rows.map((row) => ({
    userId: row.userId,
    shareMinor: row.shareMinor,
    weight: weights.get(row.userId) ?? 1,
  }))
}
