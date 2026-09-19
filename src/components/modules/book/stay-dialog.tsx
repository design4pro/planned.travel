/**
 * The stay branch of the booking dialog: the nights, chosen as the trip's days they run between.
 *
 * A stay is recorded as the run of nights it covers rather than as a point in time, so where every
 * other booking type types a date, this one picks the check-in day and the check-out day from the
 * trip — and states the number of nights as the reader chooses them, so nobody counts them by hand.
 * The booking's own fields (name, price, status, code) stay in `booking-dialog.tsx`; only the block
 * that dates the booking is swapped for this one.
 */
import { Field, Input, SimpleSelect } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { stayRange } from './booking-form'

import type { BookingDraft } from './booking-form'
import type { BookingDayOption } from '#/server/fns/reservations'

export interface StayFieldsProps {
  readonly draft: BookingDraft
  readonly days: ReadonlyArray<BookingDayOption>
  /** A day as the dialog names it everywhere else — handed in so the two cannot drift apart. */
  readonly dayName: (day: BookingDayOption) => string
  readonly onChange: <TKey extends keyof BookingDraft>(
    key: TKey,
    value: BookingDraft[TKey],
  ) => void
  /** The field's error, already resolved — `undefined` until the reader has tried to submit. */
  readonly errorFor: (key: keyof BookingDraft) => string | undefined
}

export function StayFields({
  draft,
  days,
  dayName,
  onChange,
  errorFor,
}: StayFieldsProps) {
  const t = useTranslate()

  const options = days.map((day) => ({
    value: day.id,
    label: dayName(day),
  }))
  const range = stayRange(draft.startDayId, draft.endDayId, days)
  // Both time fields are labelled "Time" on screen, under the day they belong to; spoken alone, the
  // two would be indistinguishable, so each names its side of the stay as well.
  const checkInTimeName = `${t('modules.book.field.checkIn')}, ${t('modules.field.time')}`
  const checkOutTimeName = `${t('modules.book.field.checkOut')}, ${t('modules.field.time')}`

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Field
            label={t('modules.book.field.checkIn')}
            required
            error={errorFor('startDayId')}
          >
            <div data-part="stay-check-in-day" className="w-full">
              <SimpleSelect
                options={options}
                value={draft.startDayId}
                onValueChange={(next) => onChange('startDayId', next)}
                placeholder={t('modules.book.stay.pickDay')}
                invalid={errorFor('startDayId') !== undefined}
                ariaLabel={t('modules.book.field.checkIn')}
              />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('modules.field.time')}
              error={errorFor('startTime')}
            >
              <Input
                type="time"
                value={draft.startTime}
                onChange={(event) => onChange('startTime', event.target.value)}
                aria-label={checkInTimeName}
              />
            </Field>
            <Field
              label={t('modules.book.until')}
              error={errorFor('checkInEndTime')}
            >
              <Input
                type="time"
                value={draft.checkInEndTime}
                onChange={(event) =>
                  onChange('checkInEndTime', event.target.value)
                }
              />
            </Field>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Field
            label={t('modules.book.field.checkOut')}
            required
            error={errorFor('endDayId')}
          >
            <div data-part="stay-check-out-day" className="w-full">
              <SimpleSelect
                options={options}
                value={draft.endDayId}
                onValueChange={(next) => onChange('endDayId', next)}
                placeholder={t('modules.book.stay.pickDay')}
                invalid={errorFor('endDayId') !== undefined}
                ariaLabel={t('modules.book.field.checkOut')}
              />
            </div>
          </Field>
          <Field label={t('modules.field.time')} error={errorFor('endTime')}>
            <Input
              type="time"
              value={draft.endTime}
              onChange={(event) => onChange('endTime', event.target.value)}
              aria-label={checkOutTimeName}
            />
          </Field>
        </div>
      </div>

      {/*
       * Announced politely as the reader picks the days: the count is the answer to the question
       * the two selects ask, and a reader of the screen hears it without leaving the control.
       */}
      <p
        data-part="stay-nights"
        role="status"
        className="min-h-5 text-caption tabular-nums text-ink-3"
      >
        {range === null
          ? null
          : `${t('modules.book.stay.nights', { count: range.nights })} · ${t(
              'modules.book.stay.range',
              {
                from: dayName(range.first),
                to: dayName(range.last),
              },
            )}`}
      </p>
    </div>
  )
}
