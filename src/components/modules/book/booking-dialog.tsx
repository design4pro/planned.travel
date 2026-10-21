/**
 * Add or edit one booking.
 *
 * The type picker at the top is the whole point: a stay asks for a check-in and a
 * check-out, a table asks for a time it will be held, a ticket asks for the code
 * you show at the door. `booking-form.ts` owns which fields each type shows, what
 * they are called and which of them it will not submit without, so the dialog is
 * a rendering of that contract rather than a fork per type.
 *
 * The one branch is the stay: a stay on a trip with days is dated by the days it runs between rather
 * than by typed dates, so choosing it swaps the date block for `StayFields` and saves through the
 * stay's own writes, which record the booking and its nights together.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  Chip,
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
  toast,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney } from '#/lib/money'
import { createBookingFn, updateBookingFn } from '#/server/fns/reservations'
import { createStayFn, updateStayFn } from '#/server/fns/stays'
import { NOT_SET, fromSelectValue, toSelectValue, useAction } from '../shared'
import { resolve } from '../shared/deferred-message'
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
import { StayFields } from './stay-dialog'

import type { ComboboxOption } from '#/components/ui'
import type { LucideIcon } from 'lucide-react'
import type { MessageKey, Translate } from '#/lib/i18n'
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

const STATUS_LABELS: Record<string, MessageKey> = {
  none: 'modules.book.statusChoice.none',
  pending: 'modules.book.statusChoice.pending',
  confirmed: 'modules.book.status.confirmed',
  completed: 'modules.book.status.completed',
  cancelled: 'modules.book.status.cancelled',
}

/** A day, named the way a person would refer to it. */
export function dayLabel(day: BookingDayOption, t: Translate): string {
  const parts = [t('modules.book.dayNumber', { n: day.dayNumber })]
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
  t: Translate,
): ReadonlyArray<ComboboxOption> {
  return days.flatMap((day) => {
    const label = dayLabel(day, t)
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

/** How long the refusal warning stays up: it names the next step, so it outlives the default. */
const LEDGER_REFUSED_TOAST_MS = 10_000

/**
 * The success toast of a write, kept back when the booking saved but its ledger write was refused:
 * `submit` shows the warning in its place, and a reader must not be told "added" and "not added"
 * for the same save.
 */
function unlessLedgerRefused(
  message: string,
): (result: { readonly ledger: string }) => string | undefined {
  return (result) => (result.ledger === 'failed' ? undefined : message)
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
    startDayId: row.stay?.startDayId ?? '',
    endDayId: row.stay?.endDayId ?? '',
    checkInEndTime: row.stay?.checkInEndTime ?? '',
  }
}

/**
 * A new booking's first draft: empty, or a stay whose first night the caller already knows — the
 * plan board opening this dialog from one of its days.
 */
function newDraft(
  currency: string,
  stayDayId: string | undefined,
): BookingDraft {
  const draft = emptyBookingDraft(currency)
  return stayDayId === undefined
    ? draft
    : { ...draft, type: 'accommodation', startDayId: stayDayId }
}

export function BookingDialog({
  tripId,
  booking,
  days,
  currency,
  initialStayDayId,
  open,
  onOpenChange,
}: {
  tripId: string
  /** Absent for a new booking. */
  booking?: BookingRow
  days: ReadonlyArray<BookingDayOption>
  /** The trip's currency, used when the booking does not carry its own. */
  currency: string
  /**
   * Opens a new booking as a stay checking in on this day. Applied on every open, and ignored when
   * editing: an existing booking's days are its own.
   */
  initialStayDayId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const locale = useLocale()
  const t = useTranslate()

  const editing = booking !== undefined
  const formId = useId()

  const [draft, setDraft] = useState<BookingDraft>(() =>
    newDraft(currency, initialStayDayId),
  )
  const [touched, setTouched] = useState(false)
  /** Saved, with its cost line's split no longer adding up: the one thing left is to say so. */
  const [splitStale, setSplitStale] = useState(false)
  const splitStaleNoticeRef = useRef<HTMLDivElement>(null)

  // The save button is disabled while it saves, which drops focus to the dialog itself; the notice
  // is what the reader needs next, so it takes focus (and is read out) when it appears.
  useEffect(() => {
    if (splitStale) {
      splitStaleNoticeRef.current?.focus()
    }
  }, [splitStale])

  useEffect(() => {
    if (!open) {
      return
    }
    setDraft(
      booking === undefined
        ? newDraft(currency, initialStayDayId)
        : draftFrom(booking, currency),
    )
    setTouched(false)
    setSplitStale(false)
  }, [open, booking, currency, initialStayDayId])

  const create = useAction(createBookingFn, {
    success: unlessLedgerRefused(t('modules.book.toast.added')),
    description: t('modules.book.toast.addedBody'),
    failure: t('modules.book.toast.addFailed'),
  })
  const update = useAction(updateBookingFn, {
    success: unlessLedgerRefused(t('modules.book.toast.updated')),
    failure: t('modules.book.toast.updateFailed'),
  })
  const createStay = useAction(createStayFn, {
    success: unlessLedgerRefused(t('modules.book.toast.added')),
    description: t('modules.book.toast.addedBody'),
    failure: t('modules.book.toast.addFailed'),
  })
  const updateStay = useAction(updateStayFn, {
    success: unlessLedgerRefused(t('modules.book.toast.updated')),
    failure: t('modules.book.toast.updateFailed'),
  })

  /*
   * A stay is dated by the trip's days, so it needs days to choose from. An accommodation booking
   * saved before stays existed has no nights behind it; it keeps its typed dates rather than being
   * turned into a stay by the act of opening it.
   */
  const stayBranch =
    draft.type === 'accommodation' &&
    days.length > 0 &&
    (booking === undefined || booking.stay !== null)
  const stayId = booking?.stay?.id ?? null
  const bookingAction = editing ? update : create
  const stayAction = editing ? updateStay : createStay
  const action = stayBranch ? stayAction : bookingAction
  /*
   * The type of an existing stay is fixed: switching it out would retype a booking whose nights are
   * still linked to it.
   */
  const typeLocked = (booking?.stay ?? null) !== null

  const stops = useMemo(() => stopOptions(days, t), [days, t])
  const stopIds = useMemo(() => stops.map((option) => option.value), [stops])
  const errors = useMemo(
    () =>
      validateBookingDraft(
        draft,
        stayBranch ? { stopIds, stayDays: days } : { stopIds },
      ),
    [draft, stopIds, stayBranch, days],
  )
  const invalid = hasBookingErrors(errors)
  const saveLabel: MessageKey = editing
    ? 'modules.book.action.save'
    : 'modules.book.action.add'
  const shape = bookingShape(draft.type)

  /** The date behind the day this booking is pinned to — the middle link of the ledger's chain. */
  const linkedDayId = stayBranch ? draft.startDayId : draft.dayId
  const linkedDayDate = days.find((day) => day.id === linkedDayId)?.date ?? null
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

  /**
   * Only shows a field's error once the traveller has tried to submit.
   *
   * `validateBookingDraft` hands back a key and its parameters rather than a
   * sentence, so the resolving happens here, where there is a provider —
   * through `resolve`, because a required-field error names the field with a
   * key of its own and that name has to be translated before it is interpolated.
   */
  function errorFor(key: keyof BookingDraft): string | undefined {
    const error = touched ? errors[key] : undefined
    return error === undefined ? undefined : resolve(error, t)
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
    const result = stayBranch
      ? await saveStay(priceMinor)
      : await saveBooking(priceMinor)
    if (result === null) {
      return
    }
    if (result.ledger === 'failed') {
      // A partial success: the booking is on the trip and its cost line is not. The next save of
      // the booking adds the line, because the sync keys off the row's own expense link, so the
      // dialog closes and the warning toast tells the reader so.
      toast.warning(t('modules.book.toast.ledgerRefused'), {
        description: t('modules.book.toast.ledgerRefusedBody'),
        duration: LEDGER_REFUSED_TOAST_MS,
      })
      onOpenChange(false)
      return
    }
    if (result.ledger === 'split-stale') {
      // Also a partial success, and the other way round: the booking and the new amount are
      // saved, the split of its cost line is not. Closing would leave the reader to find a split
      // that no longer adds up, so the dialog says so and waits to be dismissed.
      setSplitStale(true)
      return
    }
    onOpenChange(false)
  }

  /** The stay's two rows in one action. */
  async function saveStay(priceMinor: number) {
    const payload = {
      tripId,
      status: draft.status,
      title: draft.title.trim(),
      provider: draft.provider,
      location: draft.location,
      confirmationNumber: draft.confirmationNumber,
      url: draft.url,
      guests: draft.guests === '' ? 0 : Number.parseInt(draft.guests, 10),
      priceMinor,
      currency: priceMinor === 0 ? '' : draft.currency,
      notes: draft.notes,
      startDayId: draft.startDayId,
      endDayId: draft.endDayId,
      checkInTime: draft.startTime,
      checkInEndTime: draft.checkInEndTime,
      checkOutTime: draft.endTime,
    }
    if (booking === undefined || stayId === null) {
      return createStay.run({ data: payload })
    }
    return updateStay.run({
      data: { ...payload, reservationId: booking.id, stayId },
    })
  }

  async function saveBooking(priceMinor: number) {
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
    return booking === undefined
      ? create.run({ data: payload })
      : update.run({ data: { ...payload, reservationId: booking.id } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('modules.book.dialog.editTitle')
              : t('modules.book.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t(shape.hint, { module: t('shell.trip.tab.transports') })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Outside the form: the form is inert once the booking is saved, the notice is not. */}
          {splitStale ? (
            <Alert
              ref={splitStaleNoticeRef}
              tabIndex={-1}
              tone="warning"
              title={t('modules.book.ledger.splitStale.title')}
              className="mb-5"
            >
              {t('modules.book.ledger.splitStale.body')}
            </Alert>
          ) : null}
          <form
            id={formId}
            // Saved already: "Done" only closes, so an edit typed now would be lost without a word.
            inert={splitStale}
            className={cn('flex flex-col gap-5', splitStale && 'opacity-60')}
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {action.error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {action.error}
              </Alert>
            )}

            <fieldset className="min-w-0">
              <legend className="mb-2 text-label font-medium text-ink">
                {t('modules.book.dialog.typeLegend')}
              </legend>
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {BOOKING_TYPES.map((type) => {
                  const Icon = TYPE_ICON[type]
                  const active = draft.type === type
                  return (
                    <Chip
                      key={type}
                      data-part={`type-${type}`}
                      selected={active}
                      disabled={typeLocked && !active}
                      icon={<Icon aria-hidden />}
                      onClick={() => set('type', type)}
                    >
                      {t(bookingShape(type).label)}
                    </Chip>
                  )
                })}
              </div>
            </fieldset>

            <Field
              label={t('modules.field.name')}
              required
              error={errorFor('title')}
            >
              <Input
                value={draft.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder={t(shape.titlePlaceholder)}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {showsField(draft.type, 'provider') ? (
                <Field
                  label={t(shape.providerLabel)}
                  error={errorFor('provider')}
                >
                  <Input
                    value={draft.provider}
                    onChange={(event) => set('provider', event.target.value)}
                    placeholder={t(shape.providerPlaceholder)}
                    maxLength={200}
                    autoComplete="off"
                  />
                </Field>
              ) : null}
              {showsField(draft.type, 'location') ? (
                <Field
                  label={t(shape.locationLabel)}
                  error={errorFor('location')}
                >
                  <Input
                    value={draft.location}
                    onChange={(event) => set('location', event.target.value)}
                    placeholder={t('modules.book.field.namePlaceholder')}
                    maxLength={200}
                    autoComplete="off"
                  />
                </Field>
              ) : null}
            </div>

            {stayBranch ? (
              <StayFields
                draft={draft}
                days={days}
                dayName={(day) => dayLabel(day, t)}
                onChange={set}
                errorFor={errorFor}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <Field
                    label={t(shape.startLabel)}
                    error={errorFor('startDate')}
                  >
                    <Input
                      type="date"
                      value={draft.startDate}
                      onChange={(event) => set('startDate', event.target.value)}
                    />
                  </Field>
                  {showsField(draft.type, 'startTime') ? (
                    <Field
                      label={t('modules.field.time')}
                      error={errorFor('startTime')}
                    >
                      <Input
                        type="time"
                        value={draft.startTime}
                        onChange={(event) =>
                          set('startTime', event.target.value)
                        }
                        className="w-28"
                      />
                    </Field>
                  ) : null}
                </div>

                {showsField(draft.type, 'endDate') ||
                showsField(draft.type, 'endTime') ? (
                  <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                    {showsField(draft.type, 'endDate') ? (
                      <Field
                        label={t(shape.endLabel)}
                        error={errorFor('endDate')}
                      >
                        <Input
                          type="date"
                          value={draft.endDate}
                          min={
                            draft.startDate === '' ? undefined : draft.startDate
                          }
                          onChange={(event) =>
                            set('endDate', event.target.value)
                          }
                        />
                      </Field>
                    ) : null}
                    {showsField(draft.type, 'endTime') ? (
                      <Field
                        label={t('modules.field.time')}
                        error={errorFor('endTime')}
                      >
                        <Input
                          type="time"
                          value={draft.endTime}
                          onChange={(event) =>
                            set('endTime', event.target.value)
                          }
                          className="w-28"
                        />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {showsField(draft.type, 'guests') ? (
                <Field
                  label={t('modules.book.guests')}
                  error={errorFor('guests')}
                >
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
                  label={t('modules.field.price')}
                  error={errorFor('price')}
                  hint={t('modules.book.field.priceHint')}
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
              <Field label={t('modules.field.status')}>
                <SimpleSelect
                  options={BOOKING_STATUSES.map((value) => ({
                    value,
                    label: t(STATUS_LABELS[value] ?? 'modules.field.status'),
                  }))}
                  value={draft.status}
                  onValueChange={(next) => {
                    if (isBookingStatus(next)) {
                      set('status', next)
                    }
                  }}
                  ariaLabel={t('modules.field.status')}
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
                {t(
                  notice.key,
                  notice.amountMinor === null
                    ? undefined
                    : {
                        money: formatMoney(
                          notice.amountMinor,
                          draft.currency,
                          locale,
                        ),
                      },
                )}
              </p>
            )}

            {showsField(draft.type, 'confirmationNumber') ? (
              <Field
                label={t('modules.book.field.confirmation')}
                error={errorFor('confirmationNumber')}
                hint={t('modules.book.field.confirmationHint')}
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

            {days.length === 0 || stayBranch ? null : (
              <Field
                label={t('modules.book.field.day')}
                hint={t('modules.book.field.dayHint')}
              >
                <SimpleSelect
                  options={[
                    {
                      value: NOT_SET,
                      label: t('modules.book.field.noDay'),
                    },
                    ...days.map((day) => ({
                      value: day.id,
                      label: dayLabel(day, t),
                    })),
                  ]}
                  value={toSelectValue(draft.dayId)}
                  onValueChange={(next) => set('dayId', fromSelectValue(next))}
                  ariaLabel={t('modules.book.field.day')}
                />
              </Field>
            )}

            {showsField(draft.type, 'assignmentId') ? (
              <Field
                label={t('modules.book.field.stop')}
                error={errorFor('assignmentId')}
                hint={t(
                  stops.length === 0
                    ? 'modules.book.field.stopHintEmpty'
                    : 'modules.book.field.stopHint',
                )}
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
                    placeholder={t('modules.book.field.stopPlaceholder')}
                    searchPlaceholder={t('modules.book.field.stopSearch')}
                    emptyMessage={t('modules.book.field.stopEmpty')}
                    ariaLabel={t('modules.book.field.stop')}
                    invalid={errorFor('assignmentId') !== undefined}
                    filter={matchesStop}
                  />
                </div>
              </Field>
            ) : null}

            {showsField(draft.type, 'url') ? (
              <Field
                label={t('modules.book.field.link')}
                error={errorFor('url')}
              >
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

            <Field label={t('modules.field.notes')}>
              <Textarea
                value={draft.notes}
                onChange={(event) => set('notes', event.target.value)}
                placeholder={t('modules.book.field.notesPlaceholder')}
                maxLength={4000}
                rows={3}
                autoResize
                maxRows={8}
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          {splitStale ? null : (
            <Button
              type="button"
              variant="ghost"
              shape="pill"
              onClick={() => onOpenChange(false)}
            >
              {t('modules.action.cancel')}
            </Button>
          )}
          {/* One element before and after the save, so the footer does not jump. */}
          <Button
            type={splitStale ? 'button' : 'submit'}
            form={splitStale ? undefined : formId}
            variant="primary"
            shape="pill"
            disabled={!splitStale && touched && invalid}
            loading={action.pending}
            loadingLabel={t('modules.book.action.saving')}
            onClick={splitStale ? () => onOpenChange(false) : undefined}
          >
            {t(splitStale ? 'modules.book.action.done' : saveLabel)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The screen's primary action, for the module header. */
export function NewBookingAction({ onClick }: { onClick: () => void }) {
  const t = useTranslate()

  return (
    <Button
      data-part="new-booking"
      variant="primary"
      size="sm"
      shape="pill"
      icon={<Plus aria-hidden strokeWidth={2.5} />}
      onClick={onClick}
    >
      {t('modules.book.action.add')}
    </Button>
  )
}

export { TYPE_ICON as BOOKING_TYPE_ICON }
