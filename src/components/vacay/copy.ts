/** Literal catalogue keys keep every kind and cost line statically discoverable. */
export const KIND_LABEL = {
  vacation: 'modules.vacay.kind.vacation',
  half_day: 'modules.vacay.kind.half_day',
  sick: 'modules.vacay.kind.sick',
  remote: 'modules.vacay.kind.remote',
  holiday: 'modules.vacay.kind.holiday',
  other: 'modules.vacay.kind.other',
} as const
export const COST_LABEL = {
  full: 'modules.vacay.kind.cost.full',
  half: 'modules.vacay.kind.cost.half',
  none: 'modules.vacay.kind.cost.none',
} as const
export const BLOCKED_LABEL = {
  weekend: 'modules.vacay.day.blocked.weekend',
  company: 'modules.vacay.day.blocked.company',
} as const
