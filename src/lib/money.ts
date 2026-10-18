/**
 * Money, in one place.
 *
 * Every amount that crosses the wire is an integer in the minor unit of its own
 * currency (`docs/SPEC.md` §6). Nothing in this module holds a float that a
 * reader could later see: parsing rounds once, on the way in, and formatting
 * divides once, on the way out.
 *
 * Formatting lives in `src/lib/format.ts` and is reached from here. This module
 * pinned `en-GB` for every reader, on the grounds that a locale differing between
 * the server render and the client one would mismatch every figure on the page —
 * a real hazard, and the reason `format.ts` composes each amount from a frozen
 * per-locale table instead of handing it to `Intl` whole. With that table in
 * place the pin bought nothing and cost every non-English reader the wrong
 * decimal mark, so the formatters below take a locale and delegate.
 *
 * `currencyDisplay: 'narrowSymbol'` was the other reason to pin: `JP¥`, `US$` and
 * `CA$` in front of a 48px display numeral pushed the costs summary out of its
 * own card in an earlier round. `formatMoneyMinor` uses the narrow symbol too, so
 * that holds.
 */

import {
  formatMoneyMinor,
  formatMoneyMinorPlain,
  formatRate,
  minorUnitDigits as frozenMinorUnitDigits,
} from '#/lib/format'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'

import type { Locale } from '#/lib/i18n/locales'

/** The rounding remainder is handed out in whole minor units, never fractions. */
const MINOR_STEP = 1

/** `'5'.charCodeAt(0)` — the half-up threshold on the first dropped digit. */
const FIVE = 53

/* -------------------------------------------------------------------------- */
/* Currency codes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The currencies a traveller can log a receipt in.
 *
 * Deliberately a curated list rather than every ISO 4217 code: a picker with 180
 * rows is a worse experience than one with the thirty currencies our trips are
 * actually priced in, and any code outside it still renders correctly because
 * formatting resolves through `Intl` rather than through this table.
 */
export const CURRENCY_OPTIONS: ReadonlyArray<{
  readonly code: string
  readonly name: string
}> = [
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Pound sterling' },
  { code: 'USD', name: 'US dollar' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish złoty' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'HUF', name: 'Hungarian forint' },
  { code: 'RON', name: 'Romanian leu' },
  { code: 'ISK', name: 'Icelandic króna' },
  { code: 'TRY', name: 'Turkish lira' },
  { code: 'MAD', name: 'Moroccan dirham' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'VND', name: 'Vietnamese dong' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'ARS', name: 'Argentine peso' },
  { code: 'CLP', name: 'Chilean peso' },
]

const CODE_PATTERN = /^[A-Z]{3}$/

/** A three-letter code we are willing to hand to `Intl`. */
export function currencyCode(currency: string | null | undefined): string {
  const code = (currency ?? '').trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : 'EUR'
}

/* -------------------------------------------------------------------------- */
/* Formatters                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How many minor units the currency actually has: 2 for EUR, 0 for JPY, 3 for
 * KWD, so a zero-decimal currency is never divided by a hundred it does not use.
 *
 * Read from the frozen table rather than resolved from `Intl`, because the two
 * runtimes disagree about `HUF` and `IDR` and this number is a divisor: a
 * disagreement here changes the amount, not its punctuation.
 */
export function minorUnitDigits(currency: string | null | undefined): number {
  return frozenMinorUnitDigits(currencyCode(currency))
}

/** 10 ** the currency's minor-unit digits — the divisor between minor and major. */
function minorUnitScale(currency: string | null | undefined): number {
  return 10 ** minorUnitDigits(currency)
}

/** `464880` JPY → `¥464,880`. `238400` GBP → `£2,384.00`. */
export function formatMoney(
  minor: number,
  currency: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatMoneyMinor(minor, currencyCode(currency), locale)
}

/** The same figure with the symbol dropped, for a column that already names it. */
export function formatMoneyPlain(
  minor: number,
  currency: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatMoneyMinorPlain(minor, currencyCode(currency), locale)
}

/**
 * A balance, with its sign carried by a typographic minus rather than a hyphen.
 *
 * Zero is unsigned on purpose: a settled balance is a fact, not a direction, and
 * `+¥0` reads as a rounding artefact.
 */
export function formatSignedMoney(
  minor: number,
  currency: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const magnitude = formatMoney(Math.abs(minor), currency, locale)
  if (minor === 0) {
    return magnitude
  }
  return `${minor > 0 ? '+' : '−'}${magnitude}`
}

/**
 * The conversion line the reference sets under a foreign receipt:
 * `£2,384.00 → ¥464,880`.
 *
 * Returns `null` when there is nothing to convert — no source amount, no source
 * currency, or a source currency that matches the trip's own, in which case the
 * arrow would point at the same number twice.
 */
export function formatConversion(
  input: {
    readonly originalAmountMinor: number | null
    readonly originalCurrency: string | null
    readonly amountMinor: number
    readonly currency: string
  },
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const { originalAmountMinor, originalCurrency, amountMinor, currency } = input
  if (originalAmountMinor === null || originalCurrency === null) {
    return null
  }
  if (currencyCode(originalCurrency) === currencyCode(currency)) {
    return null
  }
  return `${formatMoney(originalAmountMinor, originalCurrency, locale)} → ${formatMoney(amountMinor, currency, locale)}`
}

/**
 * `1 GBP = 1.9500 JPY`, for the quiet line under a converted amount.
 *
 * Derived from the two amounts rather than from a stored rate, so it can never
 * disagree with the figures printed beside it.
 */
export function formatExchangeRate(
  input: {
    readonly originalAmountMinor: number | null
    readonly originalCurrency: string | null
    readonly amountMinor: number
    readonly currency: string
  },
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const rate = impliedRate(input)
  if (rate === null || input.originalCurrency === null) {
    return null
  }
  return formatRateLine(rate, input.originalCurrency, input.currency, locale)
}

/** `1 GBP = 195.37 JPY`: a rate stated outright, for one that is known rather than implied. */
export function formatRateLine(
  rate: number,
  from: string,
  to: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return `1 ${currencyCode(from)} = ${formatRate(rate, locale)} ${currencyCode(to)}`
}

/**
 * Major units of the target currency per major unit of the source currency.
 *
 * `null` when either side is missing or the source amount is zero — dividing by
 * a zero receipt would print `Infinity` at the reader.
 */
export function impliedRate(input: {
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly amountMinor: number
  readonly currency: string
}): number | null {
  const { originalAmountMinor, originalCurrency, amountMinor, currency } = input
  if (
    originalAmountMinor === null ||
    originalCurrency === null ||
    originalAmountMinor === 0
  ) {
    return null
  }
  const source = originalAmountMinor / minorUnitScale(originalCurrency)
  const target = amountMinor / minorUnitScale(currency)
  const rate = target / source
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

/**
 * An amount in one currency's minor unit, expressed in another's.
 *
 * `rate` is major-per-major: `1 <from> = rate <to>`, so the figure is the amount times the rate with
 * the difference in minor-unit digits applied — a yen is not a hundredth of anything, and a dinar has
 * a thousand fils. It is rounded half-up (away from zero) exactly once, at the end, and returned as an
 * integer.
 *
 * Throws on a rate that is not finite and positive (and on an amount that is not a safe integer, or
 * a result that does not fit one) rather than answering `NaN` or `0`: a converted figure that is
 * silently wrong is worse than one that is missing. A same-currency conversion at rate 1 is the
 * identity.
 */
export function convertMinor(
  minor: number,
  rate: number,
  from: string,
  to: string,
): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError('A conversion rate must be a finite, positive number.')
  }
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError('A minor-unit amount must be a safe integer.')
  }
  const digitShift = minorUnitDigits(to) - minorUnitDigits(from)
  // Divide by a power of ten rather than multiply by a negative one: `10 ** 2` is exact, `10 ** -2`
  // is not, and the division is correctly rounded.
  const scaled =
    digitShift >= 0
      ? minor * rate * 10 ** digitShift
      : (minor * rate) / 10 ** -digitShift
  // 15 significant digits is what a double holds honestly; trimming the representation noise stops
  // an exact half (`1.15 × 10`) from landing a hair under it and rounding the wrong way.
  // Half away from zero, so a net balance of -2.5 and +2.5 convert to mirror images, and never `-0`.
  const magnitude = Math.round(Math.abs(Number(scaled.toPrecision(15))))
  const converted = minor < 0 && magnitude !== 0 ? -magnitude : magnitude
  if (!Number.isSafeInteger(converted)) {
    throw new RangeError('The converted amount does not fit a safe integer.')
  }
  return converted
}

/** What a reader sees a trip's figures in: the trip's own currency, or one code for every trip. */
export interface DisplayCurrency {
  readonly mode: 'per-trip' | 'fixed'
  readonly code: string
}

/**
 * The currency a reader's figures are shown in, from the stored preference and the trip's own.
 *
 * `null` is "each trip in its own currency" and no code stands in for it, so there is nothing to
 * mistake for a currency. A stored code equal to the trip's own resolves to `per-trip` as well,
 * which is what keeps that case from consulting a rate for a conversion that changes nothing.
 */
export function resolveDisplayCurrency(input: {
  readonly preference: string | null
  readonly tripCurrency: string
}): DisplayCurrency {
  const tripCode = currencyCode(input.tripCurrency)
  if (input.preference === null) {
    return { mode: 'per-trip', code: tripCode }
  }
  const code = input.preference.trim().toUpperCase()
  return code === tripCode
    ? { mode: 'per-trip', code: tripCode }
    : { mode: 'fixed', code }
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A typed major amount into minor units: `2,384.00` GBP → `238400`.
 *
 * Grouping separators and stray currency glyphs are discarded rather than
 * rejected — a reader who pastes `¥ 54,705` out of a banking app should not be
 * told off for it. Anything that is not a single non-negative decimal number
 * returns `null`, and the caller decides what to say about it.
 */
export function parseMoney(
  text: string,
  currency: string | null | undefined,
): number | null {
  // A minus sign of any flavour is rejected rather than stripped: an expense is
  // never negative, and silently turning a negative figure positive is a lie.
  if (/[-\u2212]/.test(text)) {
    return null
  }
  const figure = text
    // Spaces of every width, plus the separators a European locale groups with.
    .replace(/[\s\u00a0\u202f,'\u2019]/g, '')
    // A leading currency glyph, and a trailing code or glyph.
    .replace(/^[^\d.]+/, '')
    .replace(/[^\d.]+$/, '')

  if (figure === '' || figure === '.' || !/^\d*\.?\d*$/.test(figure)) {
    return null
  }

  // Scaled by moving the decimal point in the *string*, not by multiplying a
  // float: `1.005 * 100` is `100.49999999999999` in IEEE 754, which would round a
  // penny away. Money never touches floating point in this module.
  const digits = minorUnitDigits(currency)
  const [whole = '', fraction = ''] = figure.split('.')
  const scaled = `${whole === '' ? '0' : whole}${fraction.padEnd(digits, '0').slice(0, digits)}`
  const dropped = fraction.slice(digits)
  const base = Number.parseInt(scaled, 10)
  if (!Number.isSafeInteger(base)) {
    return null
  }
  const roundUp = dropped !== '' && dropped.charCodeAt(0) >= FIVE
  const minor = base + (roundUp ? MINOR_STEP : 0)
  return Number.isSafeInteger(minor) ? minor : null
}

/**
 * Minor units back into the string a text field should hold: `238400` GBP →
 * `2384.00`. No grouping separators — they are noise inside an input the reader
 * is about to edit.
 */
export function toAmountInput(
  minor: number,
  currency: string | null | undefined,
): string {
  const digits = minorUnitDigits(currency)
  return (minor / 10 ** digits).toFixed(digits)
}

/**
 * The bounds of an exchange rate (`1 old = rate new`) a trip's budget currency can be re-based at:
 * wide enough for VND to KWD and back, narrow enough to catch a typo. The server holds the same two
 * numbers (`MIN_REBASE_RATE`, `MAX_REBASE_RATE`); a test pins the pair.
 */
export const MIN_EXCHANGE_RATE = 1e-7
export const MAX_EXCHANGE_RATE = 1e7

/** Full-width, Arabic-Indic and Persian digits and the Arabic decimal mark, as ASCII. */
export function toAsciiDigits(text: string): string {
  return text
    .replace(/[\uff10-\uff19]/g, (ch) => String(ch.charCodeAt(0) - 0xff10))
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\u066b\uff0e]/g, '.')
    .replace(/[\u066c\uff0c]/g, ',')
}

/**
 * A rate typed into a field, in the locale's own notation or the other one: `0,0060` and `0.0060`
 * both read `0.006`. `null` for anything that is not a positive number.
 *
 * Whichever separator comes last is the decimal mark when both appear (`1.234,5`, `1,234.5`); one
 * that repeats is grouping (`1,234,567`); a single one is a decimal mark, so a lone `1,234` is
 * `1.234`. That last reading is a guess, which is why the dialog prints the inverse beside the rate:
 * a rate read the wrong way round is visible before it is confirmed.
 */
export function parseRate(text: string): number | null {
  const figure = toAsciiDigits(text).replace(/[\s\u00a0\u202f]/g, '')
  if (!/^[\d.,]+$/.test(figure)) {
    return null
  }
  const last = Math.max(figure.lastIndexOf('.'), figure.lastIndexOf(','))
  // A mark that appears once, and last, is the decimal mark; one that repeats is grouping.
  const decimalAt =
    last >= 0 && figure.split(figure.charAt(last)).length === 2 ? last : -1
  const whole = decimalAt < 0 ? figure : figure.slice(0, decimalAt)
  const fraction = decimalAt < 0 ? '' : figure.slice(decimalAt + 1)
  const value = Number(`${whole.replace(/[.,]/g, '')}.${fraction || '0'}`)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** A percentage typed into a field. `null` for anything outside 0–100. */
export function parsePercentage(text: string): number | null {
  const trimmed = text.trim().replace('%', '')
  if (trimmed === '') {
    return null
  }
  const value = Number.parseFloat(trimmed)
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null
  }
  return value
}

/** A share weight typed into a field. `null` for anything outside 0–1000. */
export function parseWeight(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') {
    return null
  }
  const value = Number.parseFloat(trimmed)
  if (!Number.isFinite(value) || value < 0 || value > 1000) {
    return null
  }
  return value
}

/* -------------------------------------------------------------------------- */
/* Split arithmetic                                                           */
/* -------------------------------------------------------------------------- */

const SPLIT_METHOD_VALUES = ['equal', 'exact', 'shares', 'percentage'] as const

export type SplitMethod = (typeof SPLIT_METHOD_VALUES)[number]

export function isSplitMethod(value: string): value is SplitMethod {
  return (SPLIT_METHOD_VALUES as ReadonlyArray<string>).includes(value)
}

/** One traveller's stake in an expense, in whichever unit the method uses. */
export interface SplitInput {
  readonly userId: string
  /** Relative weight for `shares`. Ignored by the other methods. */
  readonly weight?: number
  /** Exact amount for `exact`, in the expense's minor unit. */
  readonly shareMinor?: number
  /** Whole or fractional percent for `percentage`. The set must add up to 100. */
  readonly percentage?: number
}

export interface SplitRow {
  readonly userId: string
  readonly shareMinor: number
}

/**
 * What the split editor needs to render, in one value.
 *
 * `balanced` is the gate on saving: a split that does not add up to the expense
 * would be rejected by the repository anyway, and finding that out from a toast
 * after a round trip is a worse experience than never being allowed to submit.
 */
export interface SplitPreview {
  readonly rows: ReadonlyArray<SplitRow>
  /** What the rows currently add up to. */
  readonly allocatedMinor: number
  /** `amountMinor − allocatedMinor`. Zero exactly when the split is settled. */
  readonly remainderMinor: number
  /** Sum of the editable unit: percent points for `percentage`, weights for `shares`. */
  readonly weightTotal: number
  readonly balanced: boolean
  /** Reader-facing reason the split cannot be saved yet, or `null`. */
  readonly error: string | null
}

function weightsFor(
  method: SplitMethod,
  participants: ReadonlyArray<SplitInput>,
): Array<number> {
  return participants.map((part) => {
    if (method === 'equal') {
      return 1
    }
    if (method === 'percentage') {
      return part.percentage ?? 0
    }
    return part.weight ?? 1
  })
}

function sum(values: ReadonlyArray<number>): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * Splits `amountMinor` proportionally to `weights`, then hands the rounding
 * remainder out one minor unit at a time in order, so the rows always add up to
 * exactly `amountMinor` and the same input always produces the same split.
 *
 * This mirrors `computeShares` in `src/server/repos/expenses.ts` deliberately:
 * the repository stays the authority on what is stored, and this is what lets the
 * editor show the reader the same numbers before they commit to them.
 */
function distribute(
  amountMinor: number,
  weights: ReadonlyArray<number>,
  denominator: number,
): Array<number> {
  const raw = weights.map((weight) =>
    Math.floor((amountMinor * weight) / denominator),
  )
  let remainder = amountMinor - sum(raw)
  return raw.map((value) => {
    const extra = remainder >= MINOR_STEP ? MINOR_STEP : 0
    remainder -= extra
    return value + extra
  })
}

/**
 * The split as it will be stored. Only ever called with a balanced input — the
 * editor will not enable saving otherwise — so the rows always total the expense.
 */
export function splitShares(
  amountMinor: number,
  method: SplitMethod,
  participants: ReadonlyArray<SplitInput>,
): Array<SplitRow> {
  if (participants.length === 0) {
    return []
  }
  if (method === 'exact') {
    return participants.map((part) => ({
      userId: part.userId,
      shareMinor: part.shareMinor ?? 0,
    }))
  }
  const weights = weightsFor(method, participants)
  const weightTotal = sum(weights)
  if (weightTotal <= 0) {
    return participants.map((part) => ({ userId: part.userId, shareMinor: 0 }))
  }
  const shares = distribute(amountMinor, weights, weightTotal)
  return participants.map((part, index) => ({
    userId: part.userId,
    shareMinor: shares[index] ?? 0,
  }))
}

/** Percentages are floats; comparing them to 100 needs a tolerance, not equality. */
const PERCENT_EPSILON = 0.001

/**
 * The live preview under the split editor: every traveller's share, what the
 * shares add up to, and how far that is from the expense total.
 *
 * An unbalanced split is previewed against its own nominal denominator rather
 * than against the weights that happen to be typed so far — 40% of a ¥1,000
 * receipt is ¥400 whether or not the other 60% has been entered yet. Handing the
 * rounding remainder out in that state would quietly over-allocate the people at
 * the top of the list, so it is held back until the split settles.
 */
export function splitPreview(
  amountMinor: number,
  method: SplitMethod,
  participants: ReadonlyArray<SplitInput>,
): SplitPreview {
  if (participants.length === 0) {
    return {
      rows: [],
      allocatedMinor: 0,
      remainderMinor: amountMinor,
      weightTotal: 0,
      balanced: false,
      error: 'Choose at least one traveller to split this between.',
    }
  }

  if (method === 'exact') {
    const rows = participants.map((part) => ({
      userId: part.userId,
      shareMinor: part.shareMinor ?? 0,
    }))
    const allocatedMinor = sum(rows.map((row) => row.shareMinor))
    const remainderMinor = amountMinor - allocatedMinor
    return {
      rows,
      allocatedMinor,
      remainderMinor,
      weightTotal: allocatedMinor,
      balanced: remainderMinor === 0,
      error:
        remainderMinor === 0
          ? null
          : remainderMinor > 0
            ? 'The exact amounts are short of the total.'
            : 'The exact amounts add up to more than the total.',
    }
  }

  const weights = weightsFor(method, participants)
  const weightTotal = sum(weights)

  if (weightTotal <= 0) {
    return {
      rows: participants.map((part) => ({
        userId: part.userId,
        shareMinor: 0,
      })),
      allocatedMinor: 0,
      remainderMinor: amountMinor,
      weightTotal,
      balanced: false,
      error:
        method === 'percentage'
          ? 'Percentages must add up to 100.'
          : 'Give at least one traveller a share.',
    }
  }

  if (method === 'percentage') {
    const balanced = Math.abs(weightTotal - 100) <= PERCENT_EPSILON
    const shares = balanced
      ? distribute(amountMinor, weights, 100)
      : weights.map((weight) => Math.floor((amountMinor * weight) / 100))
    const rows = participants.map((part, index) => ({
      userId: part.userId,
      shareMinor: shares[index] ?? 0,
    }))
    const allocatedMinor = sum(shares)
    return {
      rows,
      allocatedMinor,
      remainderMinor: amountMinor - allocatedMinor,
      weightTotal,
      balanced,
      error: balanced ? null : 'Percentages must add up to 100.',
    }
  }

  const shares = distribute(amountMinor, weights, weightTotal)
  const rows = participants.map((part, index) => ({
    userId: part.userId,
    shareMinor: shares[index] ?? 0,
  }))
  const allocatedMinor = sum(shares)
  return {
    rows,
    allocatedMinor,
    remainderMinor: amountMinor - allocatedMinor,
    weightTotal,
    balanced: true,
    error: null,
  }
}

/**
 * The shortest set of transfers that clears a set of balances: greedily match the
 * largest debtor against the largest creditor until every balance is zero, which
 * needs at most `people − 1` transfers.
 *
 * Mirrors `suggestSettlements` in the expenses repository so the panel can keep
 * showing the right transfers while a just-recorded payment is still in flight.
 */
export function suggestTransfers(
  balances: ReadonlyArray<{
    readonly userId: string
    readonly balanceMinor: number
  }>,
): Array<{
  readonly fromUserId: string
  readonly toUserId: string
  readonly amountMinor: number
}> {
  const creditors = balances
    .filter((row) => row.balanceMinor > 0)
    .map((row) => ({ userId: row.userId, amount: row.balanceMinor }))
    .sort((left, right) => right.amount - left.amount)
  const debtors = balances
    .filter((row) => row.balanceMinor < 0)
    .map((row) => ({ userId: row.userId, amount: -row.balanceMinor }))
    .sort((left, right) => right.amount - left.amount)

  const transfers: Array<{
    readonly fromUserId: string
    readonly toUserId: string
    readonly amountMinor: number
  }> = []
  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    // `.at()` rather than `[]`: it types the miss as `undefined`, so the guard
    // below is a real check rather than one the compiler proves away.
    const creditor = creditors.at(creditorIndex)
    const debtor = debtors.at(debtorIndex)
    if (creditor === undefined || debtor === undefined) {
      break
    }
    const amountMinor = Math.min(creditor.amount, debtor.amount)
    if (amountMinor > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountMinor,
      })
    }
    creditor.amount -= amountMinor
    debtor.amount -= amountMinor
    if (creditor.amount === 0) {
      creditorIndex += 1
    }
    if (debtor.amount === 0) {
      debtorIndex += 1
    }
  }

  return transfers
}
