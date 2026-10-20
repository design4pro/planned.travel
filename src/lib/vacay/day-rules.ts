import { ENTRY_KIND_COST, MAX_ENTRY_RANGE_DAYS } from './entry-kinds'
import type { EntryKind } from './entry-kinds'

export interface DayRules {
  readonly blockWeekends: boolean
  readonly companyHolidaysEnabled: boolean
  readonly companyHolidays: ReadonlySet<string>
}
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}
export function blockedReason(
  date: string,
  rules: DayRules,
): 'weekend' | 'company' | null {
  if (rules.blockWeekends && isWeekend(date)) return 'weekend'
  if (rules.companyHolidaysEnabled && rules.companyHolidays.has(date))
    return 'company'
  return null
}
export function daysToWrite(
  from: string,
  to: string,
  kind: EntryKind,
  rules: DayRules,
) {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const length = (end - start) / 86_400_000 + 1
  if (!Number.isInteger(length) || length < 1 || length > MAX_ENTRY_RANGE_DAYS)
    throw new RangeError('Invalid leave date range')
  const dates = Array.from({ length }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  )
  const writable = dates.filter((date) => blockedReason(date, rules) === null)
  return {
    dates: writable,
    skipped: dates.length - writable.length,
    cost: writable.length * ENTRY_KIND_COST[kind],
  }
}
