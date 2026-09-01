/**
 * Creating a trip.
 *
 * The only write on the trip index, and the one that makes the whole product
 * reachable, so it lives beside the screen that needs it rather than in a
 * feature module of its own.
 */
import { useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

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
  DialogTrigger,
  Field,
  Input,
  SimpleSelect,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { currencyLabel } from '../settings/-lib/regional'
import { createTripFn } from '../-server/overview'

import type { Translate } from '#/lib/i18n'

/**
 * The currencies a trip is most often budgeted in, plus the workspace default.
 *
 * The codes are the product's choice; the words beside them are not. Both used
 * to be written out here, which put a second English copy of nine currency names
 * beside the translated set `settings/-lib/regional.ts` already owns.
 */
const CURRENCY_CODES: ReadonlyArray<string> = [
  'EUR',
  'GBP',
  'USD',
  'CHF',
  'PLN',
  'SEK',
  'JPY',
  'AUD',
  'CAD',
]

function currencyOptions(
  t: Translate,
): ReadonlyArray<{ value: string; label: string }> {
  return CURRENCY_CODES.map((code) => ({
    value: code,
    label: currencyLabel(t, code),
  }))
}

function messageOf(t: Translate, error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return t('shell.newTrip.error')
}

export interface NewTripDialogProps {
  /** The workspace default currency, pre-selected for a new trip. */
  defaultCurrency?: string
  /** Blocks the trigger when the plan has no room for another trip. */
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function NewTripDialog({
  defaultCurrency = 'EUR',
  disabled = false,
  size = 'sm',
}: NewTripDialogProps) {
  const t = useTranslate()
  const router = useRouter()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)

  const datesOutOfOrder =
    startDate !== '' && endDate !== '' && endDate < startDate
  const canSave = title.trim().length > 0 && !datesOutOfOrder && !saving

  function reset(): void {
    setTitle('')
    setDestination('')
    setStartDate('')
    setEndDate('')
    setCurrency(defaultCurrency)
    setError(null)
  }

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const { tripId } = await createTripFn({
        data: {
          title: title.trim(),
          destination: destination.trim(),
          startDate,
          endDate,
          currency,
        },
      })
      await router.invalidate()
      setOpen(false)
      reset()
      toast.success(t('shell.newTrip.created'), {
        description: t('shell.newTrip.createdBody'),
      })
      await navigate({ to: '/trips/$tripId/plan', params: { tripId } })
    } catch (cause) {
      setError(messageOf(t, cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          reset()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="primary"
          shape="pill"
          size={size}
          disabled={disabled}
          icon={<Plus aria-hidden strokeWidth={2.5} />}
        >
          {t('shell.nav.newTrip')}
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('shell.newTrip.title')}</DialogTitle>
          <DialogDescription>
            {t('shell.newTrip.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="new-trip-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSave) {
                void submit()
              }
            }}
          >
            {error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {error}
              </Alert>
            )}

            <Field label={t('shell.newTrip.name')} required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('shell.newTrip.namePlaceholder')}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label={t('shell.newTrip.destination')}
              hint={t('shell.newTrip.destinationHint')}
            >
              <Input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder={t('shell.newTrip.destinationPlaceholder')}
                maxLength={160}
                autoComplete="off"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('shell.newTrip.departure')}>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              <Field
                label={t('shell.newTrip.return')}
                error={
                  datesOutOfOrder ? t('shell.newTrip.returnError') : undefined
                }
              >
                <Input
                  type="date"
                  value={endDate}
                  min={startDate === '' ? undefined : startDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </Field>
            </div>

            <Field
              label={t('shell.newTrip.currency')}
              hint={t('shell.newTrip.currencyHint')}
            >
              <SimpleSelect
                options={[...currencyOptions(t)]}
                value={currency}
                onValueChange={setCurrency}
                ariaLabel={t('shell.newTrip.currency')}
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => {
              setOpen(false)
            }}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form="new-trip-form"
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel={t('shell.newTrip.creating')}
          >
            {t('shell.newTrip.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
