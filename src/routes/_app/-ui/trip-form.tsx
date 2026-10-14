/**
 * The fields a trip is described by, and the rules over them - once, for both forms.
 *
 * The creation dialog and the edit sheet ask the same questions in different chrome: one opens from a
 * button and navigates into the new trip, the other slides over the tile it edits. Everything between
 * those two ends was the same code twice - the same labels, hints and `maxLength`s, the same
 * date-order rule - which is the drift this file exists to prevent. A form that could create a trip in
 * `PLN` but not edit it back to one would be a trap, and a shared constant alone did not make that
 * unreachable; a shared field set does.
 *
 * **Dates and duration are one fact with two faces.** With both dates set the duration is derived and
 * read only; with neither it is editable and the trip is created with that many undated days. Moving
 * the start keeps the duration (the end follows), moving the end changes it. The payload carries one
 * face, never both: the server refuses a day count beside a date.
 *
 * **The cover is not in the payload.** It is a file, chosen here and uploaded by the caller once the
 * trip exists, so the form holds it beside the values and the payload never carries it.
 */
import { useMemo, useState } from 'react'

import {
  Combobox,
  Field,
  Input,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '#/components/ui'
import {
  FAVOURITE_CURRENCIES,
  currencyMatches,
  mergeCurrencies,
  platformCurrencyCodes,
} from '#/lib/currency-list'
import { formatDate } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { TRIP_DAY_COUNT_MAX, inclusiveDays, shiftDate } from '#/lib/trip-dates'
import { openedCurrencyLabel } from '../settings/-lib/regional'
import { TripCoverField } from './trip-cover-field'

import type { ComboboxOption } from '#/components/ui'

/* -------------------------------------------------------------------------------------------------
 * State
 * ---------------------------------------------------------------------------------------------- */

/** The reminder presets, in days before departure; `0` is none. Anything else is "custom". */
const REMINDER_PRESETS: ReadonlyArray<number> = [0, 1, 3, 9]
const REMINDER_CUSTOM_MAX = 30
/** What a trip row carries until somebody changes it (`trips.reminder_days` defaults to 3). */
export const DEFAULT_REMINDER_DAYS = 3

/** What both forms hold: blank means "no value", and the numbers are held as the reader typed them. */
export interface TripFormValues {
  title: string
  summary: string
  destination: string
  startDate: string
  endDate: string
  /** Whole days as typed, or blank. Mirrors the range while both dates are set. */
  duration: string
  currency: string
  /** Days before departure; `0` is no reminder. Owner-only on edit. */
  reminderDays: number
}

/** The body a submit sends. A day count and a date range are never both in it. */
export interface TripFormPayload {
  title: string
  summary: string
  destination: string
  startDate: string
  endDate: string
  currency: string
  dayCount?: number
  reminderDays?: number
}

export interface TripForm {
  values: TripFormValues
  set: <TField extends keyof TripFormValues>(
    field: TField,
    value: TripFormValues[TField],
  ) => void
  /** Back to the values the form opened with, or to a new set of them. */
  reset: (next?: TripFormValues) => void
  /** The image chosen for the cover, uploaded by the caller once the trip exists. */
  cover: File | null
  /** Edit only: the reader asked to drop the cover the trip already has. */
  coverRemoved: boolean
  chooseCover: (file: File | null) => void
  /** Drops the chosen file, or - with none chosen - the cover the trip already has. */
  removeCover: () => void
  /** Named on the Return field, and the reason {@link TripForm.canSave} is false. */
  datesOutOfOrder: boolean
  /** A name, dates in order, and no save already in flight. */
  canSave: boolean
}

/** Whole days within the creatable range as a string, or blank for anything else. */
function wholeDays(raw: string, max: number): string {
  const count = Number.parseInt(raw.replace(/\D/g, ''), 10)
  return Number.isNaN(count) || count < 1 ? '' : String(Math.min(count, max))
}

/** The duration the range implies, or the current text when the range implies none (inverted). */
function durationOf(values: TripFormValues): string {
  const days = inclusiveDays(values.startDate, values.endDate)
  return days === null ? values.duration : String(days)
}

/**
 * One change applied to the values, with the dates-or-duration rule kept on the way.
 *
 * Pure so the rule is tested without a component: the hook only holds the state it returns.
 */
export function applyTripFormChange<TField extends keyof TripFormValues>(
  current: TripFormValues,
  field: TField,
  value: TripFormValues[TField],
): TripFormValues {
  const next = { ...current, [field]: value }

  if (field === 'startDate') {
    const kept = inclusiveDays(current.startDate, current.endDate)
    if (kept !== null && next.startDate !== '') {
      // Moving the start preserves the duration: the end moves with it.
      next.endDate = shiftDate(next.startDate, kept - 1) ?? current.endDate
    }
    if (next.startDate !== '' && next.endDate !== '') {
      next.duration = durationOf(next)
    }
  } else if (field === 'endDate') {
    // Moving the end changes the duration; an inverted range keeps the old text and is refused inline.
    if (next.startDate !== '' && next.endDate !== '') {
      next.duration = durationOf(next)
    }
  } else if (field === 'duration') {
    next.duration = wholeDays(String(value), TRIP_DAY_COUNT_MAX)
  }

  return next
}

/**
 * The form's state and the one rule over it.
 *
 * `saving` is the caller's, because what a save *is* differs: the dialog creates and then navigates,
 * the sheet patches and then invalidates. What "may I save?" means does not differ, so it is here.
 */
export function useTripForm(
  initial: TripFormValues,
  saving: boolean,
): TripForm {
  const [values, setValues] = useState(initial)
  const [cover, setCover] = useState<File | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)

  const datesOutOfOrder =
    values.startDate !== '' &&
    values.endDate !== '' &&
    values.endDate < values.startDate

  return {
    values,
    set: (field, value) => {
      setValues((current) => applyTripFormChange(current, field, value))
    },
    reset: (next) => {
      setValues(next ?? initial)
      setCover(null)
      setCoverRemoved(false)
    },
    cover,
    coverRemoved,
    chooseCover: (file) => {
      setCover(file)
      setCoverRemoved(false)
    },
    removeCover: () => {
      if (cover === null) {
        setCoverRemoved(true)
      } else {
        setCover(null)
      }
    },
    datesOutOfOrder,
    canSave: values.title.trim().length > 0 && !datesOutOfOrder && !saving,
  }
}

export interface TripFormPayloadOptions {
  /**
   * Whether this submit creates the trip. Only a create can carry a day count, and the update schema
   * is strict, so the edit sheet must not send one.
   */
  creating: boolean
  /** Whether the reader owns the trip; the reminder is the owner's to set. */
  owner: boolean
}

/** The values a submit sends: trimmed where the column is free text, one face of dates-or-duration. */
export function tripFormPayload(
  form: TripForm,
  { creating, owner }: TripFormPayloadOptions,
): TripFormPayload {
  const { values } = form
  const undated = values.startDate === '' && values.endDate === ''
  const dayCount = Number.parseInt(values.duration, 10)
  return {
    title: values.title.trim(),
    summary: values.summary.trim(),
    destination: values.destination.trim(),
    startDate: values.startDate,
    endDate: values.endDate,
    currency: values.currency,
    ...(creating && undated && dayCount >= 1 ? { dayCount } : {}),
    ...(owner ? { reminderDays: values.reminderDays } : {}),
  }
}

/* -------------------------------------------------------------------------------------------------
 * Fields
 * ---------------------------------------------------------------------------------------------- */

export interface TripFormFieldsProps {
  form: TripForm
  /**
   * Whether this is an empty form, which is the only thing the two callers differ on in the words.
   *
   * The edit sheet says no: a placeholder beside a value the reader typed themselves is noise, and
   * beside a value they cleared it is a suggestion they did not ask for. The words themselves are
   * not a caller's to pass - there is one pair of them and this file's own namespace owns it.
   */
  placeholders?: boolean
  /**
   * Whether a duration can stand alone, with no dates. A create makes that many undated days; an edit
   * has no way to, so the sheet hides the field rather than offer one that would do nothing.
   */
  undatedDays?: boolean
  /** Renders the owner-only fields. The sheet passes whether the payload's role says owner. */
  owner?: boolean
  /** The cover the trip already has, shown in the cover region on edit. */
  currentCoverUrl?: string | null
  /** `0`-`1` while the chosen cover uploads, otherwise `null`. */
  coverProgress?: number | null
}

export function TripFormFields({
  form,
  placeholders,
  undatedDays = true,
  owner = true,
  currentCoverUrl = null,
  coverProgress = null,
}: TripFormFieldsProps) {
  const t = useTranslate()
  const { values, set } = form
  const ask = placeholders === true

  const bothDates = values.startDate !== '' && values.endDate !== ''
  const neitherDate = values.startDate === '' && values.endDate === ''
  const showDuration = undatedDays || !neitherDate

  return (
    <>
      {owner ? (
        <TripCoverField
          file={form.cover}
          currentUrl={currentCoverUrl}
          removed={form.coverRemoved}
          progress={coverProgress}
          disabled={coverProgress !== null}
          onChoose={form.chooseCover}
          onRemove={form.removeCover}
        />
      ) : null}

      <Field label={t('shell.newTrip.name')} required>
        <Input
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder={ask ? t('shell.newTrip.namePlaceholder') : undefined}
          maxLength={120}
          autoComplete="off"
          required
        />
      </Field>

      <Field label={t('shell.newTrip.summary')}>
        <Textarea
          value={values.summary}
          onChange={(event) => set('summary', event.target.value)}
          placeholder={ask ? t('shell.newTrip.summaryPlaceholder') : undefined}
          maxLength={280}
          rows={2}
        />
      </Field>

      <Field
        label={t('shell.newTrip.destination')}
        hint={t('shell.newTrip.destinationHint')}
      >
        <Input
          value={values.destination}
          onChange={(event) => set('destination', event.target.value)}
          placeholder={
            ask ? t('shell.newTrip.destinationPlaceholder') : undefined
          }
          maxLength={160}
          autoComplete="off"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('shell.newTrip.departure')}>
          <Input
            type="date"
            value={values.startDate}
            onChange={(event) => set('startDate', event.target.value)}
          />
        </Field>
        <Field
          label={t('shell.newTrip.return')}
          error={
            form.datesOutOfOrder ? t('shell.newTrip.returnError') : undefined
          }
        >
          <Input
            type="date"
            value={values.endDate}
            min={values.startDate === '' ? undefined : values.startDate}
            onChange={(event) => set('endDate', event.target.value)}
          />
        </Field>
      </div>

      {showDuration ? (
        <Field
          label={t('shell.newTrip.duration')}
          hint={
            neitherDate
              ? t('shell.newTrip.durationHint')
              : t('shell.newTrip.durationDerived')
          }
        >
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            // Both dates make it a read-out; one date alone gives it nothing to stand on yet.
            readOnly={!neitherDate}
            value={bothDates || neitherDate ? values.duration : ''}
            onChange={(event) => set('duration', event.target.value)}
          />
        </Field>
      ) : null}

      <CurrencyField
        value={values.currency}
        onChange={(next) => set('currency', next)}
      />

      {owner ? <ReminderField form={form} /> : null}
    </>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Currency
 * ---------------------------------------------------------------------------------------------- */

function CurrencyField({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const t = useTranslate()
  const locale = useLocale()

  // Built when the field mounts - after a click in both callers - because the platform's names are
  // not byte-identical between the server pass and the client's (see `platformCurrencyName`).
  const options = useMemo<Array<ComboboxOption>>(() => {
    const favourites = new Set(FAVOURITE_CURRENCIES)
    return mergeCurrencies(platformCurrencyCodes(), value).map((code) => ({
      value: code,
      label: openedCurrencyLabel(t, locale, code),
      group: favourites.has(code)
        ? t('shell.newTrip.currencyFavourites')
        : t('shell.newTrip.currencyAll'),
    }))
  }, [t, locale, value])

  return (
    <Field
      label={t('shell.newTrip.currency')}
      hint={t('shell.newTrip.currencyHint')}
    >
      <Combobox
        options={options}
        value={value}
        onChange={(next) => {
          if (next !== null) onChange(next)
        }}
        filter={(option, query) =>
          currencyMatches(option.value, option.label, query)
        }
        searchPlaceholder={t('shell.newTrip.currencySearch')}
        emptyMessage={t('shell.newTrip.currencyEmpty')}
        ariaLabel={t('shell.newTrip.currency')}
      />
    </Field>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Reminder
 * ---------------------------------------------------------------------------------------------- */

const CUSTOM = 'custom'

/**
 * Owner-only. `01-S10` owns what a reminder *does* and how far it may reach; this places the control
 * and shows the day the choice resolves to, so "3 days before" is never left as arithmetic.
 */
function ReminderField({ form }: { form: TripForm }) {
  const t = useTranslate()
  const locale = useLocale()
  const { values, set } = form

  // "Custom" is a choice in its own right: picking it before typing a number must keep it selected.
  const [custom, setCustom] = useState(
    !REMINDER_PRESETS.includes(values.reminderDays),
  )
  const choice = custom ? CUSTOM : String(values.reminderDays)

  const due =
    values.reminderDays > 0 && values.startDate !== ''
      ? shiftDate(values.startDate, -values.reminderDays)
      : null

  return (
    <Field label={t('shell.newTrip.reminder')}>
      <RadioGroup
        value={choice}
        onValueChange={(next) => {
          if (next === CUSTOM) {
            setCustom(true)
            if (REMINDER_PRESETS.includes(values.reminderDays)) {
              set('reminderDays', 7)
            }
            return
          }
          setCustom(false)
          set('reminderDays', Number(next))
        }}
        aria-label={t('shell.newTrip.reminder')}
      >
        {REMINDER_PRESETS.map((days) => (
          <RadioGroupItem
            key={days}
            value={String(days)}
            label={
              days === 0
                ? t('shell.newTrip.reminderNone')
                : t('shell.newTrip.reminderBefore', { count: days })
            }
          />
        ))}
        <RadioGroupItem
          value={CUSTOM}
          label={t('shell.newTrip.reminderCustom')}
        />
      </RadioGroup>

      {custom ? (
        <Input
          className="mt-2.5 max-w-32"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t('shell.newTrip.reminderCustomDays')}
          value={String(values.reminderDays)}
          onChange={(event) =>
            set(
              'reminderDays',
              Number(wholeDays(event.target.value, REMINDER_CUSTOM_MAX) || 1),
            )
          }
        />
      ) : null}

      {values.reminderDays > 0 ? (
        <p className="mt-2 text-caption text-ink-3" aria-live="polite">
          {due === null
            ? t('shell.newTrip.reminderNoDeparture')
            : t('shell.newTrip.reminderOn', {
                date: formatDate(due, locale) ?? due,
              })}
        </p>
      ) : null}
    </Field>
  )
}
