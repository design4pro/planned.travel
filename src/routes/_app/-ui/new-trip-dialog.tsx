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
import { attachCover } from './trip-cover-upload'
import {
  DEFAULT_REMINDER_DAYS,
  TripFormFields,
  tripFormPayload,
  useTripForm,
} from './trip-form'

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
  const [coverProgress, setCoverProgress] = useState<number | null>(null)
  /**
   * Set once the trip exists but its cover did not land. The form is not shown again from here: a
   * second submit would create a second trip, so the only moves left are to retry the cover or to
   * go on without one.
   */
  const [coverFailure, setCoverFailure] = useState<{
    tripId: string
    filename: string
    uploadedFileId: string | null
  } | null>(null)
  const form = useTripForm(
    {
      title: '',
      summary: '',
      destination: '',
      startDate: '',
      endDate: '',
      duration: '',
      currency: defaultCurrency,
      reminderDays: DEFAULT_REMINDER_DAYS,
    },
    saving,
  )

  function reset(): void {
    form.reset()
    setError(null)
    setCoverFailure(null)
    setCoverProgress(null)
  }

  async function finish(tripId: string): Promise<void> {
    await router.invalidate()
    setOpen(false)
    reset()
    toast.success(t('shell.newTrip.created'), {
      description: t('shell.newTrip.createdBody'),
    })
    await navigate({ to: '/trips/$tripId/plan', params: { tripId } })
  }

  /**
   * Puts the chosen image on a trip that exists. A failure never undoes the trip: it is kept and the
   * reader is offered the way on without a cover.
   */
  async function addCover(
    tripId: string,
    file: File,
    uploadedFileId: string | null,
  ): Promise<void> {
    setCoverProgress(0)
    const attached = await attachCover({
      tripId,
      file,
      uploadedFileId,
      onProgress: setCoverProgress,
    })
    setCoverProgress(null)
    if (attached.ok) {
      await finish(tripId)
      return
    }
    setCoverFailure({
      tripId,
      filename: attached.filename,
      uploadedFileId: attached.uploadedFileId,
    })
  }

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const { tripId } = await createTripFn({
        data: tripFormPayload(form, { creating: true, owner: true }),
      })
      if (form.cover === null) {
        await finish(tripId)
      } else {
        await addCover(tripId, form.cover, null)
      }
    } catch (cause) {
      setError(messageOf(cause, t('shell.newTrip.error')))
    } finally {
      setSaving(false)
    }
  }

  async function retryCover(): Promise<void> {
    if (coverFailure === null || form.cover === null) {
      return
    }
    setSaving(true)
    try {
      await addCover(
        coverFailure.tripId,
        form.cover,
        coverFailure.uploadedFileId,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A save in flight owns the dialog: closing it would wipe the form the answer is for.
        if (saving) return
        setOpen(next)
        if (!next) {
          // The trip exists even when its cover did not land; the list has to show it.
          if (coverFailure !== null) {
            void router.invalidate()
          }
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

            {coverFailure === null ? (
              <TripFormFields
                form={form}
                placeholders
                coverProgress={coverProgress}
              />
            ) : (
              <Alert tone="warning" title={t('shell.newTrip.coverFailedTitle')}>
                {t('shell.newTrip.coverFailed', {
                  name: coverFailure.filename,
                })}
              </Alert>
            )}
          </form>
        </DialogBody>

        {coverFailure === null ? (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              shape="pill"
              disabled={saving}
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
        ) : (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              shape="pill"
              disabled={saving}
              onClick={() => {
                void retryCover()
              }}
            >
              {t('shell.newTrip.coverRetry')}
            </Button>
            <Button
              type="button"
              variant="primary"
              shape="pill"
              disabled={saving}
              onClick={() => {
                setSaving(true)
                void finish(coverFailure.tripId).finally(() => {
                  setSaving(false)
                })
              }}
            >
              {t('shell.newTrip.coverContinue')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
