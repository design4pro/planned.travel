/**
 * Add or edit one booking.
 *
 * The type picker at the top is the whole point: a stay asks for a check-in and a
 * check-out, a table asks for a time it will be held, a ticket asks for the code
 * you show at the door. `booking-form.ts` owns which fields each type shows, what
 * they are called and which of them it will not submit without, so the dialog is
 * a rendering of that contract rather than a fork per type.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import {
  Bed,
  Landmark,
  MapPin,
  Plus,
  Ticket,
  TrainFront,
  Utensils,
} from 'lucide-react'

import {
  Alert,
  Button,
  Combobox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SimpleSelect,
  Textarea,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { createBookingFn, updateBookingFn } from '#/server/fns/reservations'
import { NOT_SET, fromSelectValue, toSelectValue, useAction } from '../shared'
import {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  bookingShape,
  chooseStop,
  emptyBookingDraft,
  formatMinorForInput,
  hasBookingErrors,
  isBookingStatus,
  isBookingType,
  ledgerNotice,
  parseMoneyToMinor,
  showsField,
  validateBookingDraft,
} from './booking-form'

import type { ComboboxOption } from '#/components/ui'
import type { LucideIcon } from 'lucide-react'
import type {
  BookingDraft,
  BookingStopChoice,
  BookingType,
} from './booking-form'
import type { BookingDayOption, BookingRow } from '#/server/fns/reservations'

const TYPE_ICON: { readonly [K in BookingType]: LucideIcon } = {
  accommodation: Bed,
  restaurant: Utensils,
  activity: Landmark,
  tour: MapPin,
  ticket: Ticket,
  transport: TrainFront,
  other: Ticket,
}

const STATUS_LABELS: Record<string, string> = {
  none: 'No status yet',
  pending: 'Pending — waiting on them',
  confirmed: 'Confirmed',
  completed: 'Done',
  cancelled: 'Cancelled',
}

/** A day, named the way a person would refer to it. */
export function dayLabel(day: BookingDayOption): string {
  const parts = [`Day ${day.dayNumber}`]
  if (day.title !== null && day.title.length > 0) {
    parts.push(day.title)
  } else if (day.date !== null) {
    parts.push(day.date)
  }
  return parts.join(' — ')
}

/**
 * Every stop of the trip as one option list, each row carrying the day it belongs to as its group.
 *
 * The `Combobox` renders a group as an uppercase heading, so "every stop, gathered under its day"
 * is a shape of the data rather than a component of its own. The day label rides along in
 * `description` as well as in `group` so that the search box can match it: the primitive filters on
 * the label and the description, and a reader typing "day 7" is naming the day, not the place.
 */
function stopOptions(
  days: ReadonlyArray<BookingDayOption>,
): ReadonlyArray<ComboboxOption> {
  return days.flatMap((day) => {
    const label = dayLabel(day)
    return day.stops.map((stop) => ({
      value: stop.assignmentId,
      label: stop.placeName,
      description:
        stop.startTime === null ? label : `${label} · ${stop.startTime}`,
      group: label,
    }))
  })
}

/**
 * The picker's own search, over the group heading as well as the label and the description: a
 * reader typing "day 7" is naming the day, and the primitive's own filter cannot see a group.
 */
function matchesStop(option: ComboboxOption, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return true
  }
  return [option.label, option.description, option.group].some(
    (part) => part?.toLowerCase().includes(needle) ?? false,
  )
}

/** The day and date behind one stop, so choosing it can fill an empty date. */
function stopChoice(
  days: ReadonlyArray<BookingDayOption>,
  assignmentId: string,
): BookingStopChoice | null {
  for (const day of days) {
    if (day.stops.some((stop) => stop.assignmentId === assignmentId)) {
      return { assignmentId, dayId: day.id, date: day.date }
    }
  }
  return null
}

/**
 * What the save button offers, which is a statement of what is left to do.
 *
 * After a ledger refusal the booking itself is already saved, so pressing it again is not another
 * save — it is the half that did not go through.
 */
function saveLabel(state: {
  readonly ledgerRefused: boolean
  readonly editing: boolean
}): string {
  if (state.ledgerRefused) {
    return 'Add it to the ledger'
  }
  return state.editing ? 'Save booking' : 'Add booking'
}

function draftFrom(row: BookingRow, fallbackCurrency: string): BookingDraft {
  const currency = row.currency ?? fallbackCurrency
  return {
    type: isBookingType(row.type) ? row.type : 'other',
    status: isBookingStatus(row.status) ? row.status : 'none',
    title: row.title,
    provider: row.provider ?? '',
    location: row.location ?? '',
    confirmationNumber: row.confirmationNumber ?? '',
    url: row.url ?? '',
    startDate: row.startDate ?? '',
    startTime: row.startTime ?? '',
    endDate: row.endDate ?? '',
    endTime: row.endTime ?? '',
    guests: row.guests === null || row.guests === 0 ? '' : String(row.guests),
    price: formatMinorForInput(row.priceMinor, currency),
    currency,
    dayId: row.dayId ?? '',
    assignmentId: row.assignmentId ?? '',
    notes: row.notes ?? '',
  }
}

export function BookingDialog({
  tripId,
  booking,
  days,
  currency,
  open,
  onOpenChange,
}: {
  tripId: string
  /** Absent for a new booking. */
  booking?: BookingRow
  days: ReadonlyArray<BookingDayOption>
  /** The trip's currency, used when the booking does not carry its own. */
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const editing = booking !== undefined
  const formId = useId()

  const [draft, setDraft] = useState<BookingDraft>(() =>
    emptyBookingDraft(currency),
  )
  const [touched, setTouched] = useState(false)
  /**
   * The booking this dialog has already written, when it wrote one and stayed open.
   *
   * Only a ledger refusal leaves it open after a successful save, and the retry has to be an
   * *update* of that row rather than a second create — otherwise pressing "Add it to the ledger"
   * would book the same thing twice.
   */
  const [savedId, setSavedId] = useState<string | null>(null)
  const [ledgerRefused, setLedgerRefused] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setDraft(
      booking === undefined
        ? emptyBookingDraft(currency)
        : draftFrom(booking, currency),
    )
    setTouched(false)
    setSavedId(null)
    setLedgerRefused(false)
  }, [open, booking, currency])

  const create = useAction(createBookingFn, {
    success: 'Booking added',
    description: 'It is on the timeline now.',
    failure: 'The booking was not added',
  })
  const update = useAction(updateBookingFn, {
    success: 'Booking updated',
    failure: 'The booking was not updated',
  })
  const action = editing || savedId !== null ? update : create

  const stops = useMemo(() => stopOptions(days), [days])
  const stopIds = useMemo(() => stops.map((option) => option.value), [stops])
  const errors = useMemo(
    () => validateBookingDraft(draft, { stopIds }),
    [draft, stopIds],
  )
  const invalid = hasBookingErrors(errors)
  const shape = bookingShape(draft.type)

  /** The date behind the day this booking is pinned to — the middle link of the ledger's chain. */
  const linkedDayDate = days.find((day) => day.id === draft.dayId)?.date ?? null
  /*
   * The last link of that chain, read off day one rather than sent as a field of its own.
   *
   * A trip's day run is built from its own start date, so day one's date *is* the trip's start
   * date, and an undated trip's days carry none. Deriving it here keeps the payload the route
   * already forwards unchanged — the alternative is a new prop through two files this stage does
   * not own — and it is the same figure the server falls back to, so the sentence under the price
   * cannot promise a line the server then declines to write.
   */
  const tripStartDate = days.at(0)?.date ?? null
  const notice = ledgerNotice(draft, {
    /*
     * The link the row carried when the dialog opened, and deliberately not `savedId`: the only
     * thing that leaves this dialog open after a successful save is a ledger write that was
     * *refused*, so at that moment there is still no line and the retry has one to add rather than
     * one to update.
     */
    linked: booking?.hasLedgerLine ?? false,
    dayDate: linkedDayDate,
    tripStartDate,
  })

  function set<TKey extends keyof BookingDraft>(
    key: TKey,
    value: BookingDraft[TKey],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /** Only shows a field's error once the traveller has tried to submit. */
  function errorFor(key: keyof BookingDraft): string | undefined {
    return touched ? errors[key] : undefined
  }

  /** The picker hands back an id; `chooseStop` is what turns it into a day and a date. */
  function pickStop(next: string | null): void {
    setDraft((current) =>
      chooseStop(current, next === null ? null : stopChoice(days, next)),
    )
  }

  async function submit(): Promise<void> {
    setTouched(true)
    if (invalid) {
      return
    }
    const priceMinor = parseMoneyToMinor(draft.price, draft.currency) ?? 0
    const payload = {
      tripId,
      type: draft.type,
      status: draft.status,
      title: draft.title.trim(),
      provider: draft.provider,
      location: draft.location,
      confirmationNumber: draft.confirmationNumber,
      url: draft.url,
      startDate: draft.startDate,
      startTime: draft.startTime,
      endDate: draft.endDate,
      endTime: draft.endTime,
      guests: draft.guests === '' ? 0 : Number.parseInt(draft.guests, 10),
      priceMinor,
      currency: priceMinor === 0 ? '' : draft.currency,
      dayId: draft.dayId,
      assignmentId: draft.assignmentId,
      notes: draft.notes,
    }
    const existingId = booking?.id ?? savedId
    const result =
      existingId === null
        ? await create.run({ data: payload })
        : await update.run({ data: { ...payload, reservationId: existingId } })
    if (result === null) {
      return
    }
    if (result.ledger === 'failed') {
      // A partial success: the booking is on the trip and its cost line is not. Saying so and
      // closing would leave the reader to discover a missing line later, so the dialog stays open
      // and offers the half that failed.
      setSavedId(result.reservationId)
      setLedgerRefused(true)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit this booking' : 'Add a booking'}
          </DialogTitle>
          <DialogDescription>{shape.hint}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {action.error === null ? null : (
              <Alert tone="danger" title="That did not save">
                {action.error}
              </Alert>
            )}

            {ledgerRefused ? (
              <Alert tone="warning" title="Saved, but not added to the costs">
                The booking is on the trip. Adding its cost line to the trip’s
                costs did not go through — try that half again.
              </Alert>
            ) : null}

            <fieldset className="min-w-0">
              <legend className="mb-2 text-label font-medium text-ink">
                What kind of booking
              </legend>
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {BOOKING_TYPES.map((type) => {
                  const Icon = TYPE_ICON[type]
                  const active = draft.type === type
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('type', type)}
                      className={cn(
                        'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-caption font-semibold whitespace-nowrap focus-ring',
                        'transition-[background-color,border-color,color] duration-base ease-out-quint',
                        active
                          ? 'border-transparent bg-accent text-accent-on'
                          : 'border-edge bg-surface text-ink-2 hover:border-edge-strong hover:text-ink',
                      )}
                    >
                      <Icon aria-hidden className="size-3.5" />
                      {bookingShape(type).label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <Field label="Name" required error={errorFor('title')}>
              <Input
                value={draft.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder={shape.titlePlaceholder}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {showsField(draft.type, 'provider') ? (
                <Field label={shape.providerLabel} error={errorFor('provider')}>
                  <Input
                    value={draft.provider}
                    onChange={(event) => set('provider', event.target.value)}
                    placeholder={shape.providerPlaceholder}
                    maxLength={200}
                    autoComplete="off"
                  />
                </Field>
              ) : null}
              {showsField(draft.type, 'location') ? (
                <Field label={shape.locationLabel} error={errorFor('location')}>
                  <Input
                    value={draft.location}
                    onChange={(event) => set('location', event.target.value)}
                    placeholder="Nishishinjuku 1-19-3"
                    maxLength={200}
                    autoComplete="off"
                  />
                </Field>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                <Field label={shape.startLabel} error={errorFor('startDate')}>
                  <Input
                    type="date"
                    value={draft.startDate}
                    onChange={(event) => set('startDate', event.target.value)}
                  />
                </Field>
                {showsField(draft.type, 'startTime') ? (
                  <Field label="Time" error={errorFor('startTime')}>
                    <Input
                      type="time"
                      value={draft.startTime}
                      onChange={(event) => set('startTime', event.target.value)}
                      className="w-28"
                    />
                  </Field>
                ) : null}
              </div>

              {showsField(draft.type, 'endDate') ||
              showsField(draft.type, 'endTime') ? (
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  {showsField(draft.type, 'endDate') ? (
                    <Field label={shape.endLabel} error={errorFor('endDate')}>
                      <Input
                        type="date"
                        value={draft.endDate}
                        min={
                          draft.startDate === '' ? undefined : draft.startDate
                        }
                        onChange={(event) => set('endDate', event.target.value)}
                      />
                    </Field>
                  ) : null}
                  {showsField(draft.type, 'endTime') ? (
                    <Field label="Time" error={errorFor('endTime')}>
                      <Input
                        type="time"
                        value={draft.endTime}
                        onChange={(event) => set('endTime', event.target.value)}
                        className="w-28"
                      />
                    </Field>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {showsField(draft.type, 'guests') ? (
                <Field label="Guests" error={errorFor('guests')}>
                  <Input
                    value={draft.guests}
                    onChange={(event) => set('guests', event.target.value)}
                    inputMode="numeric"
                    placeholder="2"
                  />
                </Field>
              ) : null}
              {showsField(draft.type, 'price') ? (
                <Field
                  label="Price"
                  error={errorFor('price')}
                  hint="Leave it empty if it is not settled yet."
                >
                  <Input
                    value={draft.price}
                    onChange={(event) => set('price', event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    trailing={
                      <span className="text-caption text-ink-4">
                        {draft.currency}
                      </span>
                    }
                  />
                </Field>
              ) : null}
              <Field label="Status">
                <SimpleSelect
                  options={BOOKING_STATUSES.map((value) => ({
                    value,
                    label: STATUS_LABELS[value] ?? value,
                  }))}
                  value={draft.status}
                  onValueChange={(next) => {
                    if (isBookingStatus(next)) {
                      set('status', next)
                    }
                  }}
                  ariaLabel="Status"
                />
              </Field>
            </div>

            {notice === null ? null : (
              <p
                data-part="ledger-notice"
                /*
                 * `role="status"` rather than an `Alert`: this is a running commentary on the price
                 * field, so it is announced politely as the reader types and never interrupts them.
                 * The entrance reuses the shared `pt-rise` keyframe at `--duration-fast`; the
                 * stylesheet's global `prefers-reduced-motion` rule collapses it.
                 */
                role="status"
                className={cn(
                  'rounded-lg px-3 py-2 text-caption tabular-nums',
                  '[animation:pt-rise_var(--duration-fast)_var(--ease-out-quint)_both]',
                  notice.tone === 'warning'
                    ? 'bg-warning-soft text-ink-2'
                    : 'bg-info-soft text-ink-2',
                )}
              >
                {notice.message}
              </p>
            )}

            {showsField(draft.type, 'confirmationNumber') ? (
              <Field
                label="Confirmation number"
                error={errorFor('confirmationNumber')}
                hint="The code you will be asked for at the desk."
              >
                <Input
                  value={draft.confirmationNumber}
                  onChange={(event) =>
                    set('confirmationNumber', event.target.value)
                  }
                  placeholder="TK-4821-99"
                  maxLength={200}
                  autoComplete="off"
                  className="font-mono tracking-wide uppercase"
                />
              </Field>
            ) : null}

            {days.length === 0 ? null : (
              <Field
                label="Attach to a day"
                hint="Pins it to the itinerary so it shows up on the plan."
              >
                <SimpleSelect
                  options={[
                    { value: NOT_SET, label: 'Not on the itinerary' },
                    ...days.map((day) => ({
                      value: day.id,
                      label: dayLabel(day),
                    })),
                  ]}
                  value={toSelectValue(draft.dayId)}
                  onValueChange={(next) => set('dayId', fromSelectValue(next))}
                  ariaLabel="Attach to a day"
                />
              </Field>
            )}

            {showsField(draft.type, 'assignmentId') ? (
              <Field
                label="Linked stop"
                error={errorFor('assignmentId')}
                hint={
                  stops.length === 0
                    ? 'Add a place to a day first, then you can attach this booking to it'
                    : 'Which stop of the plan this booking is for.'
                }
              >
                {/*
                 * The `data-part` hook a capture is driven by, on a wrapper rather than on the
                 * trigger: `Combobox`'s props are declared rather than spread, so it takes no
                 * arbitrary attribute. The wrapper is the trigger's only parent, so a click at its
                 * centre lands on the button inside it.
                 */}
                <div data-part="stop-picker" className="w-full">
                  <Combobox
                    options={[...stops]}
                    value={
                      draft.assignmentId === '' ? null : draft.assignmentId
                    }
                    onChange={pickStop}
                    disabled={stops.length === 0}
                    clearable
                    placeholder="Not tied to a stop"
                    searchPlaceholder="Search stops and days"
                    emptyMessage="No stop matches that"
                    ariaLabel="Linked stop"
                    invalid={errorFor('assignmentId') !== undefined}
                    filter={matchesStop}
                  />
                </div>
              </Field>
            ) : null}

            {showsField(draft.type, 'url') ? (
              <Field label="Link" error={errorFor('url')}>
                <Input
                  type="url"
                  value={draft.url}
                  onChange={(event) => set('url', event.target.value)}
                  placeholder="https://"
                  maxLength={2000}
                  autoComplete="off"
                />
              </Field>
            ) : null}

            <Field label="Notes">
              <Textarea
                value={draft.notes}
                onChange={(event) => set('notes', event.target.value)}
                placeholder="Late check-in arranged. Ask for a room away from the lift."
                maxLength={4000}
                rows={3}
                autoResize
                maxRows={8}
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={touched && invalid}
            loading={action.pending}
            loadingLabel="Saving the booking"
          >
            {saveLabel({ ledgerRefused, editing })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The screen's primary action, for the module header. */
export function NewBookingAction({ onClick }: { onClick: () => void }) {
  return (
    <Button
      data-part="new-booking"
      variant="primary"
      shape="pill"
      onClick={onClick}
    >
      <Plus aria-hidden strokeWidth={2.5} />
      Add booking
    </Button>
  )
}

export { TYPE_ICON as BOOKING_TYPE_ICON }
