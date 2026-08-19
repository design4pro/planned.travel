/**
 * Adding a place to a trip without touching the map.
 *
 * The map is the fastest way in, but it is not the only way in — a keyboard user
 * planning from a guidebook gets the same result from this form.
 */
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { MapPin, Plus } from 'lucide-react'
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
import { createPlaceFn } from '../-server/trip'

import type { CategoryChip } from '../-server/trip'

const DURATIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1½ hours' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: 'Half a day' },
  { value: '480', label: 'A full day' },
]

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return 'The place could not be saved. Try again in a moment.'
}

export function AddPlaceDialog({
  tripId,
  categories,
  size = 'sm',
}: {
  tripId: string
  categories: ReadonlyArray<CategoryChip>
  size?: 'sm' | 'md'
}) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  // Radix Select rejects an empty item value, so "none" is the sentinel.
  const [categoryId, setCategoryId] = useState('none')
  const [duration, setDuration] = useState('60')

  const canSave = name.trim().length > 0 && !saving

  function reset(): void {
    setName('')
    setCity('')
    setAddress('')
    setCategoryId('none')
    setDuration('60')
    setError(null)
  }

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await createPlaceFn({
        data: {
          tripId,
          name: name.trim(),
          city: city.trim(),
          address: address.trim(),
          categoryId: categoryId === 'none' ? '' : categoryId,
          durationMinutes: Number.parseInt(duration, 10),
        },
      })
      await router.invalidate()
      setOpen(false)
      reset()
      toast.success('Place added', {
        description: 'It is waiting in the unplanned column.',
      })
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
        <Button variant="primary" shape="pill" size={size}>
          <Plus aria-hidden strokeWidth={2.5} />
          Add place
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add a place to this trip</DialogTitle>
          <DialogDescription>
            It lands in the unplanned column. Drop it on a day when you know
            where it fits.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="add-place-form"
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

            <Field label="Name" required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Fushimi Inari Taisha"
                leading={<MapPin />}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City">
                <Input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Kyoto"
                  maxLength={160}
                  autoComplete="off"
                />
              </Field>
              <Field label="How long there">
                <SimpleSelect
                  options={[...DURATIONS]}
                  value={duration}
                  onValueChange={setDuration}
                  ariaLabel="How long there"
                />
              </Field>
            </div>

            <Field
              label="Address"
              hint="Optional — it helps the map find the right pin later."
            >
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="68 Fukakusa Yabunouchicho"
                maxLength={240}
                autoComplete="off"
              />
            </Field>

            {categories.length === 0 ? null : (
              <Field label="Category">
                <SimpleSelect
                  options={[
                    { value: 'none', label: 'No category' },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                  value={categoryId}
                  onValueChange={setCategoryId}
                  ariaLabel="Category"
                />
              </Field>
            )}
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
            form="add-place-form"
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel="Saving the place"
          >
            Add place
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
