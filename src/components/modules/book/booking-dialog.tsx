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
  Chip,
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
import { useTranslate } from '#/lib/i18n'
import { createBookingFn, updateBookingFn } from '#/server/fns/reservations'
import { NOT_SET, fromSelectValue, toSelectValue, useAction } from '../shared'
import { resolve } from '../shared/deferred-message'
import {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  bookingShape,
  emptyBookingDraft,
  formatMinorForInput,
  hasBookingErrors,
  isBookingStatus,
  isBookingType,
  parseMoneyToMinor,
  showsField,
  validateBookingDraft,
} from './booking-form'

import type { LucideIcon } from 'lucide-react'
import type { MessageKey, Translate } from '#/lib/i18n'
import type { BookingDraft, BookingType } from './booking-form'
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
  const t = useTranslate()
  const editing = booking !== undefined
  const formId = useId()

  const [draft, setDraft] = useState<BookingDraft>(() =>
    emptyBookingDraft(currency),
  )
  const [touched, setTouched] = useState(false)

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
  }, [open, booking, currency])

  const create = useAction(createBookingFn, {
    success: t('modules.book.toast.added'),
    description: t('modules.book.toast.addedBody'),
    failure: t('modules.book.toast.addFailed'),
  })
  const update = useAction(updateBookingFn, {
    success: t('modules.book.toast.updated'),
    failure: t('modules.book.toast.updateFailed'),
  })
  const action = editing ? update : create

  const errors = useMemo(() => validateBookingDraft(draft), [draft])
  const invalid = hasBookingErrors(errors)
  const shape = bookingShape(draft.type)

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
      notes: draft.notes,
    }
    const result = editing
      ? await update.run({
          data: { ...payload, reservationId: booking.id },
        })
      : await create.run({ data: payload })
    if (result !== null) {
      onOpenChange(false)
    }
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
          <form
            id={formId}
            className="flex flex-col gap-5"
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
                      selected={active}
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
                        onChange={(event) => set('endDate', event.target.value)}
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

            {days.length === 0 ? null : (
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
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={touched && invalid}
            loading={action.pending}
            loadingLabel={t('modules.book.action.saving')}
          >
            {editing
              ? t('modules.book.action.save')
              : t('modules.book.action.add')}
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
