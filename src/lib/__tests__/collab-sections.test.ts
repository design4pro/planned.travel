import { describe, expect, it } from 'vitest'
import {
  COLLAB_SECTIONS,
  activeCollabSection,
  collabLayout,
  collabSectionChangeSchema,
  enabledCollabSections,
  resolveCollabSections,
  visibleCollabSections,
} from '../collab-sections'

const defaults = { conversation: true, notes: true, polls: true }

describe('collaboration sections', () => {
  it.each([
    null,
    undefined,
    false,
    1,
    'notes',
    [],
    {},
    { conversation: false, notes: false, polls: false, future: true },
  ])('resolves unusable stored values to defaults: %j', (stored) => {
    expect(resolveCollabSections(stored)).toEqual(defaults)
  })

  it('ignores unknown keys, preserves known booleans and defaults missing or invalid values', () => {
    expect(
      resolveCollabSections({
        conversation: false,
        notes: true,
        polls: false,
        future: true,
      }),
    ).toEqual({ conversation: false, notes: true, polls: false })
    expect(
      resolveCollabSections({ conversation: false, notes: 'false' }),
    ).toEqual({ conversation: false, notes: true, polls: true })
  })

  it('returns enabled ids and draft sections in registry order', () => {
    const sections = resolveCollabSections({
      conversation: false,
      notes: true,
      polls: false,
    })
    expect(enabledCollabSections(sections)).toEqual(['notes'])
    expect(
      enabledCollabSections(
        resolveCollabSections({
          polls: true,
          notes: true,
          conversation: false,
        }),
      ),
    ).toEqual(['notes', 'polls'])
    expect(
      visibleCollabSections(sections, new Set(['polls', 'conversation'])),
    ).toEqual(['conversation', 'notes', 'polls'])
    expect(visibleCollabSections(sections, new Set())).toEqual(['notes'])
  })

  it.each([
    [['conversation'], 'single'],
    [['notes'], 'single'],
    [['polls'], 'single'],
    [['notes', 'polls'], 'single'],
    [['conversation', 'notes'], 'split'],
    [['conversation', 'polls'], 'split'],
  ] as const)('lays out visible %j as %s', (visible, layout) => {
    expect(collabLayout(visible)).toBe(layout)
  })

  it('keeps a visible selection, including a draft, or falls back to the first visible section', () => {
    const visible = visibleCollabSections(
      resolveCollabSections({ conversation: false }),
      new Set(['conversation']),
    )
    expect(activeCollabSection(visible, 'conversation')).toBe('conversation')
    expect(activeCollabSection(['notes', 'polls'], 'conversation')).toBe(
      'notes',
    )
    expect(activeCollabSection(['notes', 'polls'], null)).toBe('notes')
  })

  it('accepts exactly the registry ids and one boolean switch', () => {
    expect(collabSectionChangeSchema.shape.section.options).toEqual(
      COLLAB_SECTIONS.map(({ id }) => id),
    )
    for (const { id } of COLLAB_SECTIONS) {
      expect(
        collabSectionChangeSchema.safeParse({
          tripId: 'trip',
          section: id,
          on: false,
        }).success,
      ).toBe(true)
    }
    for (const data of [
      { tripId: 'trip', section: 'future', on: true },
      { tripId: 'trip', section: 'notes', on: 'false' },
      { tripId: '', section: 'notes', on: true },
      { tripId: 'trip', section: 'notes', on: true, extra: true },
    ])
      expect(collabSectionChangeSchema.safeParse(data).success).toBe(false)
  })
})
