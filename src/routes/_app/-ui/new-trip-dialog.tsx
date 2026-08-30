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
import { createTripFn } from '../-server/trip-lifecycle'

/** The currencies a trip is most often budgeted in, plus the workspace default. */
const CURRENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'CHF', label: 'CHF — Swiss franc' },
  { value: 'PLN', label: 'PLN — Polish złoty' },
  { value: 'SEK', label: 'SEK — Swedish krona' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
  { value: 'AUD', label: 'AUD — Australian dollar' },
  { value: 'CAD', label: 'CAD — Canadian dollar' },
]

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return 'The trip could not be created. Try again in a moment.'
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
      toast.success('Trip created', {
        description: 'Start dropping places on the map.',
      })
      await navigate({ to: '/trips/$tripId/plan', params: { tripId } })
    } catch (cause) {
      setError(messageOf(cause))
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
              if (canSave) {
                void submit()
              }
            }}
          >
            {error === null ? null : (
              <Alert tone="danger" title="That did not save">
                {error}
              </Alert>
            )}

            <Field label="Trip name" required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Kyoto in cherry-blossom season"
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label="Destination"
              hint="A city, a region, or the whole route."
            >
              <Input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Kyoto, Japan"
                maxLength={160}
                autoComplete="off"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Departure">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              <Field
                label="Return"
                error={
                  datesOutOfOrder
                    ? 'The return date is before departure.'
                    : undefined
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
              label="Budget currency"
              hint="Every expense on this trip is totalled in it."
            >
              <SimpleSelect
                options={[...CURRENCIES]}
                value={currency}
                onValueChange={setCurrency}
                ariaLabel="Budget currency"
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-trip-form"
            variant="primary"
            shape="pill"
            disabled={!canSave}
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
