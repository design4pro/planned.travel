/** The year has one roving stop; month movement preserves the day where possible. */
export function moveDay(
  date: string,
  key: string,
  rtl: boolean,
  weekStartsOn = 1,
): string {
  const current = new Date(`${date}T00:00:00Z`)
  const year = current.getUTCFullYear()
  const next = new Date(current)
  const offsets: Record<string, number> = {
    ArrowRight: rtl ? -1 : 1,
    ArrowLeft: rtl ? 1 : -1,
    ArrowUp: -7,
    ArrowDown: 7,
  }
  if (key in offsets) next.setUTCDate(next.getUTCDate() + offsets[key])
  else if (key === 'Home' || key === 'End') {
    const column = (next.getUTCDay() - weekStartsOn + 7) % 7
    next.setUTCDate(next.getUTCDate() - column + (key === 'End' ? 6 : 0))
  } else if (key === 'PageUp' || key === 'PageDown') {
    const day = next.getUTCDate()
    next.setUTCDate(1)
    next.setUTCMonth(next.getUTCMonth() + (key === 'PageUp' ? -1 : 1))
    const last = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate()
    next.setUTCDate(Math.min(day, last))
  }
  const result = next.toISOString().slice(0, 10)
  if (result < `${year}-01-01`) return `${year}-01-01`
  if (result > `${year}-12-31`) return `${year}-12-31`
  return result
}
