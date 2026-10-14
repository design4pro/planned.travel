/**
 * Changing a trip's budget currency, with the arithmetic shown first.
 *
 * It is a confirmation, not a form: the owner picks the new currency, sees the rate and where it
 * came from, and reads what the change will do - the worked example, how many entries are counted
 * in the new currency, the trip budget before and after, the rounding and any leftover someone
 * would owe - and only then confirms. What is confirmed is exactly what was shown: the commit sends
 * the `to` and `rate` of the preview on screen, and confirm stays disabled until a preview for the
 * current pair has arrived.
 *
 * It owns no data access. The route hands it three functions - the preview, the commit and a re-read
 * of the trip's currency - so it imports nothing from `server/` at run time and tests drive it
 * without a Worker. The server's own refusals reach it as data (`preview.refusal`) or as a message
 * key (`currencyRefusalOf`), both resolved here in the reader's language.
 *
 * The announcements are arranged so each message has one announcer: the result region is a polite
 * live region (busy while the preview is worked out) and the warnings inside it stay silent; a
 * failure is a danger alert outside it, which announces itself on insertion.
 */
import { useEffect, useRef, useState } from 'react'

import {
  Alert,
  Button,
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
  Skeleton,
} from '#/components/ui'
import { currencyRefusalOf } from '#/lib/currency-refusals'
import { formatNumber, formatRate, formatRateInput } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import {
  CURRENCY_OPTIONS,
  MAX_EXCHANGE_RATE,
  MIN_EXCHANGE_RATE,
  currencyCode,
  formatMoney,
  parseRate,
} from '#/lib/money'

import type { Locale, Translate } from '#/lib/i18n'
import type { CostsPerson } from '#/server/fns/costs'
import type { CurrencyChangePreview } from '#/server/repos'

/** A hung commit must not trap the traveller in a modal they cannot leave. */
export const COMMIT_TIMEOUT_MS = 30_000

/** How long the rate may sit still before the preview is asked for it. */
const PREVIEW_DEBOUNCE_MS = 400

/** The pair the preview and the commit are asked about. No `rate` means "the one on record". */
export interface RebaseRequest {
  readonly to: string
  readonly rate?: number
}

export interface CurrencyRebaseDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** The trip's budget currency now. */
  readonly currency: string
  /** Who the leftover lines name. */
  readonly people: ReadonlyArray<CostsPerson>
  readonly loadPreview: (
    request: RebaseRequest,
  ) => Promise<CurrencyChangePreview>
  readonly commit: (request: RebaseRequest) => Promise<unknown>
  /** The trip's budget currency as the server has it now, for after a response was lost. */
  readonly readCurrency: () => Promise<string>
  /** The currency was changed: reload the screen and say so. The dialog has already closed. */
  readonly onChanged: (to: string) => void
}

type Outcome =
  | {
      readonly kind: 'ready'
      readonly key: string
      readonly preview: CurrencyChangePreview
    }
  | { readonly kind: 'failed'; readonly key: string }

interface CommitFailure {
  /** The pair that was being confirmed, so a changed input clears the message. */
  readonly key: string
  readonly kind: 'unknown' | 'changed'
}

type RateProblem = 'invalid' | 'range'

/** Rejects when `promise` has not settled after `ms`; the commit itself may still land. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

/** The rate the owner typed: its value, or why it cannot be used. `null` while nothing is typed. */
function readTypedRate(
  text: string,
): { readonly value: number } | { readonly problem: RateProblem } {
  const value = parseRate(text)
  if (value === null) {
    return { problem: 'invalid' }
  }
  if (value < MIN_EXCHANGE_RATE || value > MAX_EXCHANGE_RATE) {
    return { problem: 'range' }
  }
  return { value }
}

/** The sentence a refusal of the preview is, or `null` for those that are not one. */
function refusalText(
  preview: CurrencyChangePreview,
  t: Translate,
  locale: Locale,
): string | null {
  const refusal = preview.refusal
  switch (refusal?.kind) {
    case 'unconverted-rows':
      return t('costs.rebase.unconverted', {
        count: refusal.count,
        from: currencyCode(preview.from),
      })
    case 'unsplittable':
      return t('costs.rebase.unsplittable', { count: refusal.count })
    case 'amount-out-of-range':
      return t('costs.rebase.outOfRange', { to: currencyCode(preview.to) })
    case 'too-large':
      return t('costs.rebase.tooLarge', {
        changes: formatNumber(refusal.statements, locale),
        limit: formatNumber(refusal.ceiling, locale),
        from: currencyCode(preview.from),
      })
    case 'copy-pending':
      return t('costs.rebase.copyPending')
    default:
      return null
  }
}

/**
 * The caller keys this component per opening, as it does the other money dialogs, so the form
 * starts empty every time and is never re-seeded mid exit animation.
 */
export function CurrencyRebaseDialog({
  open,
  onOpenChange,
  currency,
  people,
  loadPreview,
  commit,
  readCurrency,
  onChanged,
}: CurrencyRebaseDialogProps) {
  const t = useTranslate()
  const locale = useLocale()
  const from = currencyCode(currency)

  const [to, setTo] = useState('')
  const [rateText, setRateText] = useState('')
  // Until the owner types, the rate is the one the server answered; the field only shows it.
  const [touched, setTouched] = useState(false)
  // Enter asks for the preview now instead of after the pause.
  const [instant, setInstant] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [committing, setCommitting] = useState(false)
  const [failure, setFailure] = useState<CommitFailure | null>(null)

  const retryRef = useRef<HTMLButtonElement>(null)
  const changedRef = useRef<HTMLDivElement>(null)
  // The latest functions, read when a request fires rather than when the effect last ran.
  const loadRef = useRef(loadPreview)
  loadRef.current = loadPreview

  const typed = touched ? readTypedRate(rateText) : null
  const typedRate = typed !== null && 'value' in typed ? typed.value : null
  const rateProblem =
    typed !== null && 'problem' in typed ? typed.problem : null

  // What the preview on screen has to match for confirm to open: the currency and the rate, or the
  // rate on record while the owner has not typed one. `null` while there is nothing to ask about.
  let requestKey: string | null = null
  if (to !== '') {
    if (!touched) {
      requestKey = `${to}|auto`
    } else if (typedRate !== null) {
      requestKey = `${to}|${typedRate}`
    }
  }

  const settled =
    outcome !== null && requestKey !== null && outcome.key === requestKey
      ? outcome
      : null
  const loading = requestKey !== null && settled === null
  const ready = settled?.kind === 'ready' ? settled.preview : null
  const refusal = ready?.refusal ?? null
  const previewFailed =
    settled?.kind === 'failed' || refusal?.kind === 'same-currency'
  // Nothing priced and no rate asked for: the change is only the label.
  const nothingToConvert =
    ready !== null && refusal === null && ready.rate === null
  const confirmable =
    !committing && ready !== null && refusal === null && !previewFailed

  useEffect(() => {
    if (requestKey === null) {
      return
    }
    const request: RebaseRequest = {
      to,
      rate: touched && typedRate !== null ? typedRate : undefined,
    }
    let live = true
    const run = (): void => {
      loadRef
        .current(request)
        .then((preview) => {
          if (live) setOutcome({ kind: 'ready', key: requestKey, preview })
        })
        .catch(() => {
          if (live) setOutcome({ kind: 'failed', key: requestKey })
        })
    }
    if (!touched || instant) {
      run()
      return () => {
        live = false
      }
    }
    const timer = setTimeout(run, PREVIEW_DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
    // The key names the pair; `attempt` and `instant` re-ask for the same one.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, attempt, instant])

  const shownFailure =
    failure !== null && failure.key === requestKey ? failure : null
  useEffect(() => {
    if (shownFailure?.kind === 'unknown') {
      retryRef.current?.focus()
    } else if (shownFailure?.kind === 'changed') {
      changedRef.current?.focus()
    }
  }, [shownFailure])

  function askAgain(): void {
    setOutcome(null)
    setAttempt((count) => count + 1)
  }

  function finish(changedTo: string): void {
    onOpenChange(false)
    onChanged(changedTo)
  }

  async function submit(): Promise<void> {
    if (!confirmable || ready === null || requestKey === null) {
      return
    }
    const request: RebaseRequest = { to: ready.to, rate: ready.rate?.value }
    const key = requestKey
    setFailure(null)
    setCommitting(true)
    try {
      await withTimeout(commit(request), COMMIT_TIMEOUT_MS)
      finish(request.to)
    } catch (cause) {
      setCommitting(false)
      if (currencyRefusalOf(cause) === 'costs.refusal.rebaseChanged') {
        // Something moved since the preview: show why, and work out the figures again.
        setFailure({ key, kind: 'changed' })
        askAgain()
        return
      }
      // A lost response is not a failed change: ask the server before saying nothing happened.
      const now = await readCurrency().catch(() => null)
      if (now !== null && currencyCode(now) === currencyCode(request.to)) {
        finish(request.to)
        return
      }
      setFailure({ key, kind: 'unknown' })
    }
  }

  const options = CURRENCY_OPTIONS.filter((entry) => entry.code !== from).map(
    (entry) => ({
      value: entry.code,
      label: entry.code,
      description: entry.name,
    }),
  )

  const shownRate = touched ? rateText : (ready?.rate?.value ?? null)
  const rateValue = touched ? typedRate : (ready?.rate?.value ?? null)
  const rateField =
    typeof shownRate === 'number'
      ? formatRateInput(shownRate, locale)
      : (shownRate ?? '')
  const rateErrorKey =
    rateProblem === 'range'
      ? 'costs.rebase.rateOutOfRange'
      : 'costs.rebase.rateInvalid'
  const rateSource = (() => {
    if (touched) return t('costs.rebase.source.manual')
    if (ready?.rate?.source === 'recent') return t('costs.rebase.source.recent')
    if (ready?.rate?.source === 'manual') return t('costs.rebase.source.manual')
    return null
  })()
  const rateHint =
    refusal?.kind === 'no-rate' ? (
      t('costs.rebase.noRate', { from, to: currencyCode(to) })
    ) : rateValue === null ? undefined : (
      <>
        {rateSource === null ? null : <span>{rateSource}. </span>}
        <span>
          {t('costs.rebase.rateInverse', {
            from,
            to: currencyCode(to),
            inverse: formatRate(1 / rateValue, locale),
          })}
        </span>
      </>
    )

  const nameOf = (userId: string): string =>
    people.find((person) => person.userId === userId)?.name ??
    t('costs.rebase.someone')

  const refusalMessage = ready === null ? null : refusalText(ready, t, locale)

  const guard = (event: Event): void => {
    if (committing) event.preventDefault()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // The outcome of a commit cannot be missed, so nothing closes the dialog while one is out.
        if (!committing) onOpenChange(next)
      }}
    >
      <DialogContent
        size="md"
        hideClose={committing}
        onEscapeKeyDown={guard}
        onPointerDownOutside={guard}
        onInteractOutside={guard}
      >
        <DialogHeader>
          <DialogTitle>{t('costs.rebase.title')}</DialogTitle>
          <DialogDescription>{t('costs.rebase.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            <Field label={t('costs.rebase.to')} disabled={committing}>
              <SimpleSelect
                options={options}
                value={to === '' ? undefined : to}
                placeholder={t('costs.rebase.toPlaceholder')}
                disabled={committing}
                onValueChange={(next) => {
                  setTo(next)
                  setTouched(false)
                  setRateText('')
                  setInstant(false)
                  setFailure(null)
                }}
              />
            </Field>

            {to === '' ? null : (
              <>
                <Field
                  label={t('costs.rebase.rateLabel', {
                    from,
                    to: currencyCode(to),
                  })}
                  required={!nothingToConvert}
                  disabled={committing}
                  hint={rateHint}
                  error={rateProblem === null ? undefined : t(rateErrorKey)}
                >
                  <Input
                    value={rateField}
                    aria-required={!nothingToConvert}
                    onChange={(event) => {
                      setTouched(true)
                      setInstant(false)
                      setFailure(null)
                      setRateText(event.target.value)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      // Enter previews; only the confirm button commits.
                      event.preventDefault()
                      if (loading) setInstant(true)
                    }}
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                  />
                </Field>

                <div
                  data-part="rebase-result"
                  aria-live="polite"
                  aria-busy={loading || undefined}
                  className="flex min-h-44 flex-col gap-2"
                >
                  {loading ? (
                    <>
                      <span className="sr-only">
                        {t('costs.rebase.loading')}
                      </span>
                      <Skeleton className="h-5 w-11/12" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-5 w-4/5" />
                      <Skeleton className="h-5 w-2/3" />
                    </>
                  ) : null}
                  {!loading && ready === null && !previewFailed ? (
                    <p className="text-caption text-ink-3">
                      {t('costs.rebase.waitingForRate')}
                    </p>
                  ) : null}
                  {!loading && refusal?.kind === 'no-rate' ? (
                    <p className="text-caption text-ink-3">
                      {t('costs.rebase.waitingForRate')}
                    </p>
                  ) : null}
                  {refusalMessage === null ? null : (
                    <Alert tone="warning" size="sm" aria-live="off">
                      {refusalMessage}
                    </Alert>
                  )}
                  {ready !== null && refusal === null ? (
                    nothingToConvert ? (
                      <p className="text-body text-ink">
                        {t('costs.rebase.nothing')}
                      </p>
                    ) : (
                      <Arithmetic
                        preview={ready}
                        nameOf={nameOf}
                        t={t}
                        locale={locale}
                      />
                    )
                  ) : null}
                </div>

                {previewFailed ? (
                  <Alert
                    tone="danger"
                    size="sm"
                    actions={
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        shape="pill"
                        onClick={askAgain}
                      >
                        {t('costs.rebase.retry')}
                      </Button>
                    }
                  >
                    {t('costs.rebase.error')}
                  </Alert>
                ) : null}

                {shownFailure?.kind === 'unknown' ? (
                  <Alert
                    tone="danger"
                    size="sm"
                    actions={
                      <Button
                        ref={retryRef}
                        type="button"
                        variant="secondary"
                        size="sm"
                        shape="pill"
                        onClick={() => void submit()}
                      >
                        {t('costs.rebase.retry')}
                      </Button>
                    }
                  >
                    {t('costs.rebase.commitError')}
                  </Alert>
                ) : null}

                {shownFailure?.kind === 'changed' ? (
                  <Alert ref={changedRef} tone="danger" size="sm" tabIndex={-1}>
                    {t('costs.refusal.rebaseChanged')}
                  </Alert>
                ) : null}
              </>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            disabled={committing}
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            shape="pill"
            disabled={!confirmable}
            loading={committing}
            loadingLabel={t('costs.rebase.committing')}
            onClick={() => void submit()}
          >
            {t('costs.rebase.confirm', {
              to: to === '' ? '…' : currencyCode(to),
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ArithmeticProps {
  readonly preview: CurrencyChangePreview
  readonly nameOf: (userId: string) => string
  readonly t: Translate
  readonly locale: Locale
}

/** The lines of a preview that went through: what is converted, to what, and what it costs in rounding. */
function Arithmetic({ preview, nameOf, t, locale }: ArithmeticProps) {
  const { counts, example, budgetTarget, balances } = preview
  const to = currencyCode(preview.to)
  const from = currencyCode(preview.from)
  const lines: Array<{ readonly key: string; readonly text: string }> = []

  if (example !== null) {
    lines.push({
      key: 'example',
      text: t('costs.rebase.example', {
        original: formatMoney(
          example.original.amountMinor,
          example.original.currency,
          locale,
        ),
        converted: formatMoney(
          example.converted.amountMinor,
          example.converted.currency,
          locale,
        ),
      }),
    })
  }
  if (counts.expenses > 0) {
    lines.push({
      key: 'expenses',
      text: t('costs.rebase.count.expenses', { count: counts.expenses, to }),
    })
  }
  if (counts.settlements > 0) {
    lines.push({
      key: 'payments',
      text: t('costs.rebase.count.payments', { count: counts.settlements, to }),
    })
  }
  if (counts.budgetItems > 0) {
    lines.push({
      key: 'planned',
      text: t('costs.rebase.count.planned', { count: counts.budgetItems, to }),
    })
  }
  if (counts.pinnedPrices > 0) {
    lines.push({ key: 'pinned', text: t('costs.rebase.pinned', { from }) })
  }
  if (budgetTarget !== null) {
    lines.push({
      key: 'target',
      text: t('costs.rebase.target', {
        before: formatMoney(budgetTarget.before, preview.from, locale),
        after: formatMoney(budgetTarget.after, preview.to, locale),
      }),
    })
  }
  if (balances !== null && balances.maxMovementMinor > 0) {
    lines.push({
      key: 'rounding',
      text: t('costs.rebase.rounding', {
        amount: formatMoney(balances.maxMovementMinor, preview.to, locale),
      }),
    })
  }
  for (const leftover of balances?.leftovers ?? []) {
    lines.push({
      key: `leftover-${leftover.userId}-${leftover.otherUserId}`,
      text: t('costs.rebase.leftover', {
        name: nameOf(leftover.userId),
        other: nameOf(leftover.otherUserId),
        amount: formatMoney(leftover.amountMinor, preview.to, locale),
      }),
    })
  }

  return (
    <ul className="flex flex-col gap-1.5 text-body tabular-nums text-ink">
      {lines.map((line) => (
        <li key={line.key}>{line.text}</li>
      ))}
    </ul>
  )
}
