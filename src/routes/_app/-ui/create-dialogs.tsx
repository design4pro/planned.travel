/**
 * The two "start something" dialogs behind the journal and the collections
 * index. Both follow the same contract as `NewTripDialog`: validate on the
 * client for feedback, validate again on the server for truth, invalidate the
 * router on success, then navigate into the thing that was just created.
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
  Textarea,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { createCollectionFn, createJourneyFn } from '../-server/library'

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return fallback
}

/* ----------------------------------------------------------------- journeys */

export function NewJourneyDialog({
  trips,
  size = 'sm',
  trip,
  label = 'New journey',
  variant = 'primary',
}: {
  trips: ReadonlyArray<{ id: string; title: string }>
  size?: 'sm' | 'md'
  /**
   * Opens the dialog already pointed at one trip, with its title borrowed as a
   * starting point — the shape of the journal's own "this trip has no story yet"
   * prompts, where the reader has already chosen the trip by pressing the button.
   */
  trip?: { readonly id: string; readonly title: string }
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  const router = useRouter()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(trip?.title ?? '')
  const [subtitle, setSubtitle] = useState('')
  const [tripId, setTripId] = useState(trip?.id ?? 'none')
  const [startedOn, setStartedOn] = useState('')
  const [endedOn, setEndedOn] = useState('')

  const outOfOrder = startedOn !== '' && endedOn !== '' && endedOn < startedOn
  const canSave = title.trim().length > 0 && !outOfOrder && !saving

  /**
   * The trips the picker offers.
   *
   * A prompt can name a trip the general list does not carry — the journal offers
   * to write up the trip you are *on*, while the picker is otherwise the finished
   * ones — so the named trip is folded in rather than silently missing from its own
   * dialog.
   */
  const options =
    trip === undefined || trips.some((entry) => entry.id === trip.id)
      ? trips
      : [trip, ...trips]

  function reset(): void {
    setTitle(trip?.title ?? '')
    setSubtitle('')
    setTripId(trip?.id ?? 'none')
    setStartedOn('')
    setEndedOn('')
    setError(null)
  }

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const { journeyId } = await createJourneyFn({
        data: {
          title: title.trim(),
          subtitle: subtitle.trim(),
          tripId: tripId === 'none' ? '' : tripId,
          startedOn,
          endedOn,
        },
      })
      await router.invalidate()
      setOpen(false)
      reset()
      toast.success('Journey started', {
        description: 'Add your first entry to begin the story.',
      })
      await navigate({ to: '/journey/$journeyId', params: { journeyId } })
    } catch (cause) {
      setError(
        messageOf(
          cause,
          'The journey could not be created. Try again in a moment.',
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
        <Button variant={variant} shape="pill" size={size}>
          <Plus aria-hidden strokeWidth={2.5} />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Start a journey</DialogTitle>
          <DialogDescription>
            A journey is the written side of a trip — entries in date order,
            with the photos and the weather you remember it by.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="new-journey-form"
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

            <Field label="Title" required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Two weeks in Kyoto"
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label="Subtitle"
              hint="One line under the title, on the cover."
            >
              <Input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="Temples, trains and far too much matcha"
                maxLength={160}
                autoComplete="off"
              />
            </Field>

            {options.length === 0 ? null : (
              <Field
                label="Based on a trip"
                hint="Optional — links the story back to its plan."
              >
                <SimpleSelect
                  options={[
                    { value: 'none', label: 'Not tied to a trip' },
                    ...options.map((entry) => ({
                      value: entry.id,
                      label: entry.title,
                    })),
                  ]}
                  value={tripId}
                  onValueChange={setTripId}
                  ariaLabel="Based on a trip"
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Started">
                <Input
                  type="date"
                  value={startedOn}
                  onChange={(event) => setStartedOn(event.target.value)}
                />
              </Field>
              <Field
                label="Ended"
                error={
                  outOfOrder ? 'The end date is before the start.' : undefined
                }
              >
                <Input
                  type="date"
                  value={endedOn}
                  min={startedOn === '' ? undefined : startedOn}
                  onChange={(event) => setEndedOn(event.target.value)}
                />
              </Field>
            </div>
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
            form="new-journey-form"
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel="Creating the journey"
          >
            Create journey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------- collections */

/**
 * A collection's colour is *stored* on the row, so the palette has to travel as
 * a hex string the database can hold. Each option is paired with the token class
 * that actually paints the swatch, so nothing on screen is drawn from the hex —
 * the literal is data, never styling.
 */
const SWATCHES: ReadonlyArray<{
  value: string
  className: string
  label: string
}> = [
  { value: '#256256', className: 'bg-brand', label: 'Pine' },
  { value: '#1d4fd8', className: 'bg-info', label: 'Ink blue' },
  { value: '#8a5305', className: 'bg-warning', label: 'Amber' },
  { value: '#136b45', className: 'bg-success', label: 'Green' },
  { value: '#b22f22', className: 'bg-danger', label: 'Red' },
  { value: '#5b5951', className: 'bg-ink-3', label: 'Slate' },
]

const VISIBILITIES: ReadonlyArray<{
  value: 'private' | 'organization' | 'public'
  label: string
}> = [
  { value: 'private', label: 'Only me' },
  { value: 'organization', label: 'Everyone in the workspace' },
  { value: 'public', label: 'Anyone with the link' },
]

export function NewCollectionDialog({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const router = useRouter()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [colour, setColour] = useState(SWATCHES[0]?.value ?? '#256256')
  const [visibility, setVisibility] = useState<
    'private' | 'organization' | 'public'
  >('organization')

  const canSave = name.trim().length > 0 && !saving

  function reset(): void {
    setName('')
    setDescription('')
    setColour(SWATCHES[0]?.value ?? '#256256')
    setVisibility('organization')
    setError(null)
  }

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const { collectionId } = await createCollectionFn({
        data: {
          name: name.trim(),
          description: description.trim(),
          colour,
          visibility,
        },
      })
      await router.invalidate()
      setOpen(false)
      reset()
      toast.success('Collection created', {
        description: 'Start saving places into it.',
      })
      await navigate({
        to: '/collections/$collectionId',
        params: { collectionId },
      })
    } catch (cause) {
      setError(
        messageOf(
          cause,
          'The collection could not be created. Try again in a moment.',
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
        <Button variant="primary" shape="pill" size={size}>
          <Plus aria-hidden strokeWidth={2.5} />
          New collection
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Start a collection</DialogTitle>
          <DialogDescription>
            Somewhere to keep the places you find before you know which trip
            they belong to.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="new-collection-form"
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
                placeholder="Coffee worth crossing town for"
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <Field label="Description">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What belongs in here, and what does not."
                maxLength={2000}
                rows={3}
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-label font-medium text-ink">
                Colour
              </legend>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    aria-pressed={colour === swatch.value}
                    aria-label={swatch.label}
                    onClick={() => setColour(swatch.value)}
                    className={cn(
                      'size-8 rounded-full transition-[box-shadow,transform] duration-base ease-out-quint focus-ring',
                      swatch.className,
                      colour === swatch.value
                        ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface'
                        : 'hover:scale-105',
                    )}
                  />
                ))}
              </div>
            </fieldset>

            <Field label="Who can see it">
              <SimpleSelect
                options={VISIBILITIES.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                value={visibility}
                onValueChange={(next) => {
                  if (
                    next === 'private' ||
                    next === 'organization' ||
                    next === 'public'
                  ) {
                    setVisibility(next)
                  }
                }}
                ariaLabel="Who can see it"
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
            form="new-collection-form"
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel="Creating the collection"
          >
            Create collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
