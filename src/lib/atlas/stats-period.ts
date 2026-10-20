/** Read-only presentation of the traveller's existing roll-up rows. */
export interface StatsPeriodRow {
  readonly statYear: number
  readonly tripCount: number
  readonly placeCount: number
  readonly cityCount: number
  readonly countryCount: number
  readonly dayCount: number
  readonly distanceMetres: number
  readonly yearStreak: number
}

export function statsPeriod(
  rows: ReadonlyArray<StatsPeriodRow>,
  chosen: number,
) {
  const years = rows
    .filter((row) => row.statYear > 0 && row.tripCount > 0)
    .map((row) => row.statYear)
    .sort((a, b) => b - a)
  const period = years.includes(chosen) ? chosen : 0
  const row = rows.find((candidate) => candidate.statYear === period) ?? null
  const count =
    rows.find((candidate) => candidate.statYear === 0)?.yearStreak ?? 0
  const last = years[0] ?? 0
  return {
    period,
    periods: [0, ...years],
    row,
    tiles:
      period === 0
        ? ['places', 'regions', 'visits', 'trips', 'cities', 'days', 'streak']
        : ['places', 'trips', 'cities', 'days', 'countries'],
    distanceMetres:
      row !== null && row.distanceMetres > 0 ? row.distanceMetres : null,
    streak: period === 0 ? { count, first: last - count + 1, last } : null,
  }
}
