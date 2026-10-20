/** One vocabulary and cost table for the picker and persisted allowance. */
export const ENTRY_KINDS = [
  'vacation',
  'half_day',
  'sick',
  'remote',
  'holiday',
  'other',
] as const
export type EntryKind = (typeof ENTRY_KINDS)[number]
export const ENTRY_KIND_COST: Record<EntryKind, number> = {
  vacation: 1,
  half_day: 0.5,
  sick: 0,
  remote: 0,
  holiday: 0,
  other: 0,
}
export const KIND_COST_LINE = {
  vacation: 'full',
  half_day: 'half',
  sick: 'none',
  remote: 'none',
  holiday: 'none',
  other: 'none',
} as const
export const MAX_ENTRY_RANGE_DAYS = 366
