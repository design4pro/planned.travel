/**
 * The carry-over rule of the leave planner: the days a traveller does not use in one year follow
 * them into the next.
 *
 * The one owner of the rule and of its rounding (`docs/SPEC.md` §8). The repository persists what
 * {@link walkCarryOver} says, the panel only asks {@link hasFractionalLeftover}; neither repeats
 * the arithmetic. No React and no server imports, so the rule is tested as a table.
 */

/** The most a year can carry in: the stored column refuses more. */
export const CARRIED_OVER_MAX_DAYS = 365

/** One traveller's year, as the walk reads it. */
export interface CarryOverRow {
  readonly year: number
  readonly entitlementDays: number
  readonly carriedOverDays: number
  /** Days consumed in the year, counting a half day as 0.5. */
  readonly usedDays: number
}

/**
 * What a leftover carries into the next year: whole days only (a half day is not leave anyone
 * could take), never below zero (a debt does not carry) and never above the stored maximum.
 */
export function wholeDaysThatCarry(leftover: number): number {
  return Math.min(Math.max(Math.floor(leftover), 0), CARRIED_OVER_MAX_DAYS)
}

/** True when a year ends with days to spare of which only the whole ones carry. */
export function hasFractionalLeftover(leftover: number): boolean {
  return leftover > 0 && !Number.isInteger(leftover)
}

/**
 * The carried-over figure each row should hold, in the order given.
 *
 * `rows` is one traveller's years, ascending. A row with no row for `year - 1` is an **opening
 * balance** and keeps what is stored; every other row gets the leftover of the year before it, which
 * includes what that year was itself carried, so a leftover compounds down a chain. A missing year
 * breaks the chain: the walk never bridges a gap.
 */
export function walkCarryOver(
  rows: ReadonlyArray<CarryOverRow>,
): Array<number> {
  const walked: Array<number> = []
  let previous: CarryOverRow | undefined
  for (const row of rows) {
    const carried =
      previous === undefined || previous.year !== row.year - 1
        ? row.carriedOverDays
        : wholeDaysThatCarry(
            previous.entitlementDays +
              previous.carriedOverDays -
              previous.usedDays,
          )
    walked.push(carried)
    previous = { ...row, carriedOverDays: carried }
  }
  return walked
}
