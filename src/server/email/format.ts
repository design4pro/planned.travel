/**
 * Copy fragments the billing templates share.
 *
 * They reuse `src/lib/format.ts` rather than reformatting money and dates a
 * second time, so a mail and the billing screen never disagree about what
 * `$28.00` or `23 Jun 2026` looks like.
 */

import { formatDate, formatMoneyMinor, pluralise } from '#/lib/format'

import type { BillingInterval } from '#/lib/plans'

/** `Monthly` / `Yearly` — the label a fact row carries. */
export function intervalLabel(interval: BillingInterval): string {
  return interval === 'monthly' ? 'Monthly' : 'Yearly'
}

/** `month` / `year` — the noun after a slash in an amount. */
export function intervalNoun(interval: BillingInterval): string {
  return interval === 'monthly' ? 'month' : 'year'
}

/** `$28.00 / month`, in the currency Polar actually charged. */
export function amountPerPeriod(
  amountMinor: number,
  currency: string,
  interval: BillingInterval,
): string {
  return `${formatMoneyMinor(amountMinor, currency)} / ${intervalNoun(interval)}`
}

/** `4 members` — only ever shown for a plan that bills per seat. */
export function seatLabel(seats: number): string {
  return pluralise(seats, 'member')
}

/**
 * `23 Jun 2026`, falling back to the raw instant rather than to an empty string:
 * a date that failed to parse is still information, and a blank is a lie.
 */
export function dateLabel(instant: string): string {
  return formatDate(instant) ?? instant
}

/** The name to greet by. Falls back to `there` rather than to an empty line. */
export function firstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0] ?? 'there'
}

/** `45 minutes`, `an hour`, `24 hours`, `7 days` — a window a reader can plan by. */
export function expiryWindow(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    if (hours % 24 === 0) {
      const days = hours / 24
      return days === 1 ? '24 hours' : `${days} days`
    }
    return hours === 1 ? 'an hour' : `${hours} hours`
  }
  return `${minutes} minutes`
}

/** Why an auth message reached this address. */
export const AUTH_FOOTER =
  'You received this because this address was used to sign in to or manage an account.'

/** Why a billing message reached this address. */
export function billingFooter(organizationName: string): string {
  return `You received this because you look after billing for ${organizationName}.`
}
