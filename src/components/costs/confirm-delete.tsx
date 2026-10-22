/**
 * The confirmation in front of a delete.
 *
 * Deleting an expense re-writes four people's balances, so it gets a real
 * confirmation rather than an undo-toast gamble: it names the expense, shows the
 * amount that is about to leave the ledger, and puts the destructive verb on the
 * destructive button. A recorded payment moves two balances and is just as permanent,
 * so it asks through the same dialog, in its own words (`subject`).
 *
 * `Keep it` is the default focus target. The dialog is not a place to lose money by
 * pressing Enter.
 */
import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'

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
} from '#/components/ui'
import { messageOf } from '#/components/modules/shared'
import { formatList } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney } from '#/lib/money'

/** What is being deleted; it only picks the words, the dialog behaves the same. */
export type DeleteSubject = 'expense' | 'payment'

const COPY = {
  expense: {
    title: 'costs.delete.title',
    description: 'costs.delete.description',
    failedBody: 'costs.delete.failedBody',
    confirm: 'costs.delete.confirm',
    working: 'costs.delete.working',
  },
  payment: {
    title: 'costs.delete.payment.title',
    description: 'costs.delete.payment.description',
    failedBody: 'costs.delete.payment.failedBody',
    confirm: 'costs.delete.payment.confirm',
    working: 'costs.delete.payment.working',
  },
} as const

export interface ConfirmDeleteDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** The expense's title, or the payment's "payer → payee". */
  readonly title: string
  /** Defaults to an expense. */
  readonly subject?: DeleteSubject
  readonly amountMinor: number
  readonly currency: string
  /** Who is affected, already resolved to names. */
  readonly affects: ReadonlyArray<string>
  readonly onConfirm: () => Promise<void>
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  subject = 'expense',
  amountMinor,
  currency,
  affects,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const t = useTranslate()
  const copy = COPY[subject]
  const locale = useLocale()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(): Promise<void> {
    setWorking(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (cause) {
      setError(messageOf(cause, t(copy.failedBody)))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(copy.title)}</DialogTitle>
          <DialogDescription>
            {t(copy.description, { title })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error === null ? null : (
            <Alert tone="danger" title={t('costs.delete.failed')}>
              {error}
            </Alert>
          )}
          <div className="flex items-center gap-3 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-3">
            <TriangleAlert
              aria-hidden
              className="size-4 shrink-0 text-danger"
            />
            <p className="min-w-0 flex-1 text-caption text-ink-2">
              {affects.length === 0
                ? t('costs.delete.noBalances')
                : t('costs.delete.balancesChange', {
                    names: formatList(affects, locale),
                  })}
            </p>
            <span className="shrink-0 font-display text-subtitle font-bold tabular-nums text-danger">
              {formatMoney(amountMinor, currency, locale)}
            </span>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            shape="pill"
            autoFocus
            onClick={() => onOpenChange(false)}
          >
            {t('ui.action.keep')}
          </Button>
          <Button
            type="button"
            variant="danger"
            shape="pill"
            loading={working}
            loadingLabel={t(copy.working)}
            onClick={() => void confirm()}
          >
            {t(copy.confirm)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
