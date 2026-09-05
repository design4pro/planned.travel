/**
 * The five fields a trip is described by, and the rules over them — once, for both forms.
 *
 * The creation dialog and the edit sheet ask the same questions in different chrome: one opens from a
 * button and navigates into the new trip, the other slides over the tile it edits. Everything between
 * those two ends was the same code twice — the same labels, hints and `maxLength`s, the same
 * date-order rule, the same five `useState`s — which is the drift this file exists to prevent. A form
 * that could create a trip in `PLN` but not edit it back to one would be a trap, and a shared
 * constant alone did not make that unreachable; a shared field set does.
 *
 * `01-S8` widens this to the full field set over the whole ISO-4217 list, and does it here: one edit,
 * and both forms move together because there is only one of them.
 */
import { useState } from 'react'

import { Field, Input, SimpleSelect } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { currencyLabel } from '../settings/-lib/regional'

import type { Translate } from '#/lib/i18n'

/* -------------------------------------------------------------------------------------------------
 * Currencies
 * ---------------------------------------------------------------------------------------------- */

/**
 * The currencies a trip is most often budgeted in, plus the workspace default.
 *
 * The codes are the product's choice; the words beside them are not. Both used to be written out
 * here, which put a second English copy of nine currency names beside the translated set
 * `settings/-lib/regional.ts` already owns.
 */
const CURRENCY_CODES: ReadonlyArray<string> = [
  'EUR',
  'GBP',
  'USD',
  'CHF',
  'PLN',
  'SEK',
  'JPY',
  'AUD',
  'CAD',
]

function currencyOptions(
  t: Translate,
): ReadonlyArray<{ value: string; label: string }> {
  return CURRENCY_CODES.map((code) => ({
    value: code,
    label: currencyLabel(t, code),
  }))
}

/* -------------------------------------------------------------------------------------------------
 * State
 * ---------------------------------------------------------------------------------------------- */

/** What both forms hold, in the shape the server functions accept: blank means "no value". */
export interface TripFormValues {
  title: string
  destination: string
  startDate: string
  endDate: string
  currency: string
}

export interface TripForm {
  values: TripFormValues
  set: <TField extends keyof TripFormValues>(
    field: TField,
    value: TripFormValues[TField],
  ) => void
  /** Back to the values the form opened with, or to a new set of them. */
  reset: (next?: TripFormValues) => void
  /** Named on the Return field, and the reason {@link TripForm.canSave} is false. */
  datesOutOfOrder: boolean
  /** A name, dates in order, and no save already in flight. */
  canSave: boolean
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

  const datesOutOfOrder =
    values.startDate !== '' &&
    values.endDate !== '' &&
    values.endDate < values.startDate

  return {
    values,
    set: (field, value) => {
      setValues((current) => ({ ...current, [field]: value }))
    },
    reset: (next) => {
      setValues(next ?? initial)
    },
    datesOutOfOrder,
    canSave: values.title.trim().length > 0 && !datesOutOfOrder && !saving,
  }
}

/** The values a submit sends: trimmed where the column is free text. */
export function tripFormPayload(form: TripForm): TripFormValues {
  return {
    ...form.values,
    title: form.values.title.trim(),
    destination: form.values.destination.trim(),
  }
}

/* -------------------------------------------------------------------------------------------------
 * Fields
 * ---------------------------------------------------------------------------------------------- */

export interface TripFormFieldsProps {
  form: TripForm
  /**
   * Whether this is an empty form, which is the only thing the two callers differ on.
   *
   * The edit sheet says no: a placeholder beside a value the reader typed themselves is noise, and
   * beside a value they cleared it is a suggestion they did not ask for. The words themselves are
   * not a caller's to pass - there is one pair of them and this file's own namespace owns it.
   */
  placeholders?: boolean
}

export function TripFormFields({ form, placeholders }: TripFormFieldsProps) {
  const t = useTranslate()
  const { values, set } = form

  return (
    <>
      <Field label={t('shell.newTrip.name')} required>
        <Input
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder={
            placeholders === true
              ? t('shell.newTrip.namePlaceholder')
              : undefined
          }
          maxLength={120}
          autoComplete="off"
          required
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
            placeholders === true
              ? t('shell.newTrip.destinationPlaceholder')
              : undefined
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

      <Field
        label={t('shell.newTrip.currency')}
        hint={t('shell.newTrip.currencyHint')}
      >
        <SimpleSelect
          options={[...currencyOptions(t)]}
          value={values.currency}
          onValueChange={(next) => set('currency', next)}
          ariaLabel={t('shell.newTrip.currency')}
        />
      </Field>
    </>
  )
}
