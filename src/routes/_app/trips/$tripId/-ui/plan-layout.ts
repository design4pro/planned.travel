import { defineKeyedPreference } from '#/lib/local-preference'

export const RAIL = {
  left: 344,
  right: 328,
  collapsed: 44,
  gutter: 16,
  min: 280,
  max: 400,
  step: 16,
} as const
export interface RailWidths {
  readonly left: number
  readonly right: number
}

export function clampRailWidth(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(RAIL.min, Math.min(RAIL.max, value))
}

export const plannerLayoutPreference = defineKeyedPreference<RailWidths>({
  key: 'planned.planner-layout',
  area: 'local',
  limit: 8,
  fallback: { left: RAIL.left, right: RAIL.right },
  parse(raw) {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return undefined
    const widths = value as Record<string, unknown>
    return {
      left: clampRailWidth(widths.left, RAIL.left),
      right: clampRailWidth(widths.right, RAIL.right),
    }
  },
})

export interface UnfoldedDays {
  readonly known: ReadonlyArray<string>
  readonly open: ReadonlyArray<string>
}
export function isDayExpanded(days: UnfoldedDays | null, id: string): boolean {
  return days === null || !days.known.includes(id) || days.open.includes(id)
}
export const plannerDaysPreference = defineKeyedPreference<UnfoldedDays | null>(
  {
    key: 'planned.planner-days',
    area: 'session',
    limit: 8,
    fallback: null,
    parse(raw) {
      const value: unknown = JSON.parse(raw)
      if (typeof value !== 'object' || value === null) return undefined
      const days = value as Record<string, unknown>
      const strings = (ids: unknown): ids is Array<string> =>
        Array.isArray(ids) && ids.every((id: unknown) => typeof id === 'string')
      if (!strings(days.known) || !strings(days.open)) return undefined
      return { known: days.known, open: days.open }
    },
  },
)
