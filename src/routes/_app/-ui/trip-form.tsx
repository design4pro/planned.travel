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

/* -------------------------------------------------------------------------------------------------
 * Currencies
 * ---------------------------------------------------------------------------------------------- */

/** One option on a budget-currency field: the ISO code, and the label shown beside it. */
export interface TripCurrency {
  value: string
  label: string
}

/** The currencies a trip is most often budgeted in. */
export const TRIP_CURRENCIES: ReadonlyArray<TripCurrency> = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'CHF', label: 'CHF — Swiss franc' },
  { value: 'PLN', label: 'PLN — Polish złoty' },
  { value: 'SEK', label: 'SEK — Swedish krona' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
  { value: 'AUD', label: 'AUD — Australian dollar' },
  { value: 'CAD', label: 'CAD — Canadian dollar' },
]

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
   * Shown on an empty form only. The edit sheet passes none: a placeholder beside a value the reader
   * typed themselves is noise, and beside a value they cleared it is a suggestion they did not ask
   * for.
   */
  placeholders?: { title: string; destination: string }
}

export function TripFormFields({ form, placeholders }: TripFormFieldsProps) {
  const { values, set } = form

  return (
    <>
      <Field label="Trip name" required>
        <Input
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder={placeholders?.title}
          maxLength={120}
          autoComplete="off"
          required
        />
      </Field>

      <Field label="Destination" hint="A city, a region, or the whole route.">
        <Input
          value={values.destination}
          onChange={(event) => set('destination', event.target.value)}
          placeholder={placeholders?.destination}
          maxLength={160}
          autoComplete="off"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Departure">
          <Input
            type="date"
            value={values.startDate}
            onChange={(event) => set('startDate', event.target.value)}
          />
        </Field>
        <Field
          label="Return"
          error={
            form.datesOutOfOrder
              ? 'The return date is before departure.'
              : undefined
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
        label="Budget currency"
        hint="Every expense on this trip is totalled in it."
      >
        <SimpleSelect
          options={[...TRIP_CURRENCIES]}
          value={values.currency}
          onValueChange={(next) => set('currency', next)}
          ariaLabel="Budget currency"
        />
      </Field>
    </>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Failure
 * ---------------------------------------------------------------------------------------------- */

/**
 * What to show the reader when a save is refused.
 *
 * A `RepositoryError` arrives with a sentence written for a person — "A trip cannot end before it
 * starts." — and that sentence is better than anything this layer could compose. Anything else (a
 * dropped connection, a thrown string) gets the caller's fallback.
 */
export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return fallback
}
