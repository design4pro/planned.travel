import { expect, it } from 'vitest'
import { COLLAB_SECTIONS } from '#/lib/collab-sections'
import Trips from '#/lib/i18n/messages/en/trips'
import Modules from '#/lib/i18n/messages/en/modules'
import { COLLAB_SECTION_PRESENTATION } from '../sections'

it('gives every vocabulary section a translated label and an icon', () => {
  const catalogue = Object.fromEntries([
    ...Object.entries(Trips).map(([key, value]) => [`trips.${key}`, value]),
    ...Object.entries(Modules).map(([key, value]) => [`modules.${key}`, value]),
  ])
  expect(Object.keys(COLLAB_SECTION_PRESENTATION)).toEqual(
    COLLAB_SECTIONS.map(({ id }) => id),
  )
  for (const { id } of COLLAB_SECTIONS) {
    expect(catalogue[COLLAB_SECTION_PRESENTATION[id].label]).toBeTruthy()
    expect(COLLAB_SECTION_PRESENTATION[id].icon).toBeTruthy()
  }
})
