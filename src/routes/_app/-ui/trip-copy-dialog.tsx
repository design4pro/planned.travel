/**
 * Copying a trip: the one question the reader is asked before the two-phase write starts.
 *
 * The dialog is deliberately small. `copyTripFn` mints the trip and returns inside one round trip,
 * and everything that scales with the source's inventory happens afterwards in the `trip-copy`
 * queue handler — so the only things worth asking for here are the copy's name and the dates it
 * should run over. On success the reader stays on the list (PRD #104 / spec Q3): the new tile
 * appears in its copying state, and navigating into a planner whose days have not landed yet would
 * hand them an empty trip and call it theirs.
 *
 * **What does not come across is said here, before the reader commits**, rather than enumerated
 * afterwards in the completion notification (spec Q4). A boundary a reader learns about after the
 * fact is a boundary they learn about too late to choose differently.
 *
 * **The short-range note is a hint, not an `Alert`.** Shortening the range is a legitimate choice
 * whose consequence — the extra days' places land in ideas and their notes are dropped — is worth
 * stating; painting it in a warning colour would train the reader to ignore warnings.
 */
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  Alert,
  Button,
  DateRangePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  isoDay,
} from '#/components/ui'
import { messageOf } from '#/components/modules/shared'
import { useTranslate } from '#/lib/i18n'
import { copyTripFn } from '../-server/trip-lifecycle'
import { daysBetween } from '../-lib/format'

import type { DateRange } from '#/components/ui'
import type { TripCard } from '../-server/overview'

/**
 * A `YYYY-MM-DD` column as local midnight.
 *
 * The calendar grid reads a picked date back with `isoDay`, which uses local getters, so a range
 * seeded with `#/lib/format`'s UTC parse would come back one day earlier everywhere west of
 * Greenwich. The two conversions have to agree, so this is the local one.
 */
function localDay(value: string | null): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (parts === null) {
    return null
  }
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
}

/**
 * The source's own run, prefilled. `null` unless the source has **both** ends.
 *
 * A trip with a departure date and no return is an ordinary shape the trip form saves —
 * `datesInOrder` only compares the two when both are there — and prefilling that half-open range
 * would open the dialog already invalid: `halfOpen` below would be true before the reader touched
 * anything, the Dates field would show its "set both" error and the Copy button would be disabled.
 * A source with one end is treated as an undated template, which is the state the reader can act
 * on rather than one they have to repair.
 */
function rangeOf(trip: TripCard): DateRange | null {
  const from = localDay(trip.startDate)
  const to = localDay(trip.endDate)
  return from === null || to === null ? null : { from, to }
}

export interface TripCopyDialogProps {
  trip: TripCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TripCopyDialog({
  trip,
  open,
  onOpenChange,
}: TripCopyDialogProps) {
  const t = useTranslate()
  const router = useRouter()

  const [title, setTitle] = useState(trip.title)
  const [range, setRange] = useState<DateRange | null>(rangeOf(trip))
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * A range with one end picked, which the picker produces mid-selection.
   *
   * `copyTripInputSchema` refuses it, so the form refuses it too and says which of the two ways out
   * to take — set the other end, or clear both and copy the trip as a template.
   */
  const halfOpen = range !== null && range.to === undefined
  const named = title.trim().length > 0

  const sourceRun = daysBetween(trip.startDate, trip.endDate)
  const chosenRun =
    range?.to === undefined
      ? null
      : daysBetween(isoDay(range.from), isoDay(range.to))
  const shorter =
    sourceRun !== null && chosenRun !== null && chosenRun < sourceRun

  async function submit(): Promise<void> {
    setCopying(true)
    setError(null)
    const name = title.trim()
    try {
      await copyTripFn({
        data: {
          tripId: trip.id,
          title: name,
          ...(range?.to === undefined
            ? {}
            : { startDate: isoDay(range.from), endDate: isoDay(range.to) }),
        },
      })
      await router.invalidate()
      onOpenChange(false)
      toast.success(t('shell.copyTrip.started', { title: name }))
    } catch (cause) {
      setError(messageOf(cause, t('shell.copyTrip.error')))
    } finally {
      setCopying(false)
    }
  }

  /** The footer's button submits the body's form, so the two need one id between them. */
  const formId = `trip-copy-${trip.id}`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A copy in flight owns the dialog: the write has already started, and dismissing it here
        // would leave the reader with no place for a quota refusal to land.
        if (copying) return
        onOpenChange(next)
      }}
    >
      <DialogContent size="sm" data-part="trip-copy-dialog">
        <DialogHeader>
          <DialogTitle>
            {t('shell.copyTrip.title', { title: trip.title })}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (named && !halfOpen && !copying) {
                void submit()
              }
            }}
          >
            {error === null ? null : (
              <Alert tone="danger" title={t('shell.copyTrip.errorTitle')}>
                {error}
              </Alert>
            )}

            <Field
              label={t('shell.copyTrip.nameLabel')}
              error={named ? undefined : t('shell.copyTrip.titleRequired')}
              required
            >
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                autoComplete="off"
                disabled={copying}
                required
              />
            </Field>

            <Field
              label={t('shell.copyTrip.datesLabel')}
              error={halfOpen ? t('shell.copyTrip.datesTogether') : undefined}
            >
              <DateRangePicker
                value={range}
                onChange={setRange}
                invalid={halfOpen}
                disabled={copying}
                ariaLabel={t('shell.copyTrip.datesLabel')}
              />
            </Field>

            {range === null ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                shape="pill"
                className="self-start"
                disabled={copying}
                onClick={() => setRange(null)}
              >
                {t('shell.copyTrip.clearDates')}
              </Button>
            )}

            {shorter ? (
              <p className="text-caption text-ink-3">
                {t('shell.copyTrip.shorter')}
              </p>
            ) : null}

            <p className="text-caption text-ink-3">
              {t('shell.copyTrip.carries')}
            </p>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            disabled={copying}
            onClick={() => onOpenChange(false)}
          >
            {t('shell.copyTrip.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!named || halfOpen}
            loading={copying}
            loadingLabel={t('shell.copyTrip.copying')}
          >
            {t('shell.copyTrip.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
