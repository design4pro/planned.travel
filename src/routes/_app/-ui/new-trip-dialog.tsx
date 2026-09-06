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
} from '#/components/ui'
import { messageOf } from '#/components/modules/shared'
import { useTranslate } from '#/lib/i18n'
import { createTripFn } from '../-server/trip-lifecycle'
import { TripFormFields, tripFormPayload, useTripForm } from './trip-form'

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
  const form = useTripForm(
    {
      title: '',
      destination: '',
      startDate: '',
      endDate: '',
      currency: defaultCurrency,
    },
    saving,
  )

  function reset(): void {
    form.reset()
    setError(null)
  }

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const { tripId } = await createTripFn({ data: tripFormPayload(form) })
      await router.invalidate()
      setOpen(false)
      reset()
      toast.success(t('shell.newTrip.created'), {
        description: t('shell.newTrip.createdBody'),
      })
      await navigate({ to: '/trips/$tripId/plan', params: { tripId } })
    } catch (cause) {
      setError(messageOf(cause, t('shell.newTrip.error')))
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
              if (form.canSave) {
                void submit()
              }
            }}
          >
            {error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {error}
              </Alert>
            )}

            <TripFormFields form={form} placeholders />
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
            disabled={!form.canSave}
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
