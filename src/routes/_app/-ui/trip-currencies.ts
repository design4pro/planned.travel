/**
 * The currencies a trip is most often budgeted in.
 *
 * One list rather than one per form: the creation dialog and the edit sheet must offer the same
 * choices — a trip created in `PLN` that could not be edited back to it would be a trap — and a
 * shared constant is the only way to make that structurally true rather than merely currently true.
 *
 * `01-S8` replaces both forms with one field set over the full ISO-4217 list, at which point this
 * file is deleted rather than edited.
 */

/** One option on a budget-currency field: the ISO code, and the label shown beside it. */
export interface TripCurrency {
  value: string
  label: string
}

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
