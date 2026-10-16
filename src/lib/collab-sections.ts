/** The closed vocabulary and defaults for a trip's collaboration sections. */
import { z } from 'zod'

export const COLLAB_SECTIONS = [
  { id: 'conversation', defaultOn: true },
  { id: 'notes', defaultOn: true },
  { id: 'polls', defaultOn: true },
] as const

export type CollabSectionId = (typeof COLLAB_SECTIONS)[number]['id']
export type CollabSections = Readonly<Record<CollabSectionId, boolean>>

function sectionRecord(
  valueFor: (id: CollabSectionId, defaultOn: boolean) => boolean,
): CollabSections {
  return Object.fromEntries(
    COLLAB_SECTIONS.map(({ id, defaultOn }) => [id, valueFor(id, defaultOn)]),
  ) as CollabSections
}

/** Tolerates older and newer stored records, always leaving a known section enabled. */
export function resolveCollabSections(stored: unknown): CollabSections {
  const record =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {}
  const sections = sectionRecord((id, defaultOn) =>
    typeof record[id] === 'boolean' ? record[id] : defaultOn,
  )
  if (enabledCollabSections(sections).length === 0) {
    return sectionRecord((_id, defaultOn) => defaultOn)
  }
  return sections
}

export function enabledCollabSections(
  sections: CollabSections,
): Array<CollabSectionId> {
  return COLLAB_SECTIONS.filter(({ id }) => sections[id]).map(({ id }) => id)
}

/** Unsent work keeps its section visible even when a peer switches it off. */
export function visibleCollabSections(
  sections: CollabSections,
  withDraft: ReadonlySet<CollabSectionId>,
): Array<CollabSectionId> {
  return COLLAB_SECTIONS.filter(
    ({ id }) => sections[id] || withDraft.has(id),
  ).map(({ id }) => id)
}

export function collabLayout(
  visible: ReadonlyArray<CollabSectionId>,
): 'single' | 'split' {
  return visible.includes('conversation') && visible.length > 1
    ? 'split'
    : 'single'
}

export function activeCollabSection(
  visible: ReadonlyArray<CollabSectionId>,
  selected: CollabSectionId | null,
): CollabSectionId | undefined {
  if (selected !== null && visible.includes(selected)) return selected
  return visible[0]
}

export const collabSectionChangeSchema = z.strictObject({
  tripId: z.string().trim().min(1).max(64),
  section: z.enum(COLLAB_SECTIONS.map(({ id }) => id)),
  on: z.boolean(),
})
