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
import { SwatchPicker } from '#/components/modules/shared'
import { useTranslate } from '#/lib/i18n'

import { REQUIRED_DEFAULT, REQUIRED_SWATCHES } from '#/lib/swatches'
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
  label,
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
  /** Defaults to the shell's own "New journey", translated. */
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  const t = useTranslate()
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
      toast.success(t('shell.newJourney.created'), {
        description: t('shell.newJourney.createdBody'),
      })
      await navigate({ to: '/journey/$journeyId', params: { journeyId } })
    } catch (cause) {
      setError(messageOf(cause, t('shell.newJourney.error')))
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
          variant={variant}
          shape="pill"
          size={size}
          icon={<Plus aria-hidden strokeWidth={2.5} />}
        >
          {label ?? t('shell.newJourney.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('shell.newJourney.title')}</DialogTitle>
          <DialogDescription>
            {t('shell.newJourney.description')}
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
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {error}
              </Alert>
            )}

            <Field label={t('modules.collab.note.field.title')} required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('shell.newJourney.titlePlaceholder')}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label={t('shell.newJourney.subtitle')}
              hint={t('shell.newJourney.subtitleHint')}
            >
              <Input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder={t('shell.newJourney.subtitlePlaceholder')}
                maxLength={160}
                autoComplete="off"
              />
            </Field>

            {options.length === 0 ? null : (
              <Field
                label={t('shell.newJourney.trip')}
                hint={t('shell.newJourney.tripHint')}
              >
                <SimpleSelect
                  options={[
                    { value: 'none', label: t('shell.newJourney.tripNone') },
                    ...options.map((entry) => ({
                      value: entry.id,
                      label: entry.title,
                    })),
                  ]}
                  value={tripId}
                  onValueChange={setTripId}
                  ariaLabel={t('shell.newJourney.trip')}
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('journal.side.started')}>
                <Input
                  type="date"
                  value={startedOn}
                  onChange={(event) => setStartedOn(event.target.value)}
                />
              </Field>
              <Field
                label={t('journal.side.ended')}
                error={
                  outOfOrder ? t('shell.newJourney.datesError') : undefined
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
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form="new-journey-form"
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel={t('shell.newJourney.creating')}
          >
            {t('shell.newJourney.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------- collections */

export function NewCollectionDialog({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const t = useTranslate()
  const router = useRouter()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [colour, setColour] = useState(REQUIRED_DEFAULT)

  const canSave = name.trim().length > 0 && !saving

  function reset(): void {
    setName('')
    setDescription('')
    setColour(REQUIRED_DEFAULT)
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
        },
      })
      await router.invalidate()
      setOpen(false)
      reset()
      toast.success(t('shell.newCollection.created'), {
        description: t('shell.newCollection.createdBody'),
      })
      await navigate({
        to: '/collections/$collectionId',
        params: { collectionId },
      })
    } catch (cause) {
      setError(messageOf(cause, t('shell.newCollection.error')))
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
          icon={<Plus aria-hidden strokeWidth={2.5} />}
        >
          {t('shell.newCollection.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('shell.newCollection.title')}</DialogTitle>
          <DialogDescription>
            {t('shell.newCollection.description')}
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
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {error}
              </Alert>
            )}

            <Field label={t('modules.field.name')} required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('shell.newCollection.namePlaceholder')}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <Field label={t('modules.files.field.description')}>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('shell.newCollection.descriptionHint')}
                maxLength={2000}
                rows={3}
              />
            </Field>

            <SwatchPicker
              value={colour}
              onChange={setColour}
              legend={t('modules.colour.legend')}
              /* `collections.colour` is `notNull`, so there is no "no colour"
                 to offer and the palette ends on the neutral instead. */
              swatches={REQUIRED_SWATCHES}
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
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form="new-collection-form"
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={saving}
            loadingLabel={t('shell.newCollection.creating')}
          >
            {t('shell.newCollection.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
