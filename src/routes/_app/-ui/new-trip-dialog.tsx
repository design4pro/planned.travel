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
      toast.success('Trip created', {
        description: 'Start dropping places on the map.',
      })
      await navigate({ to: '/trips/$tripId/plan', params: { tripId } })
    } catch (cause) {
      setError(
        messageOf(
          cause,
          'The trip could not be created. Try again in a moment.',
        ),
      )
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
        <Button variant="primary" shape="pill" size={size} disabled={disabled}>
          <Plus aria-hidden strokeWidth={2.5} />
          New trip
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Start a new trip</DialogTitle>
          <DialogDescription>
            A title is all you need. Dates build the day-by-day plan, and
            everything else can wait until you know it.
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
              <Alert tone="danger" title="That did not save">
                {error}
              </Alert>
            )}

            <TripFormFields
              form={form}
              placeholders={{
                title: 'Kyoto in cherry-blossom season',
                destination: 'Kyoto, Japan',
              }}
            />
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-trip-form"
            variant="primary"
            shape="pill"
            disabled={!form.canSave}
            loading={saving}
            loadingLabel="Creating the trip"
          >
            Create trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
