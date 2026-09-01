/**
 * The travel journal's copy, in nl.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Meervoud.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Niet ingesteld',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Deze reis kon niet worden geladen',
  'story.back': 'Alle reizen',
  'story.loading': 'Laden',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Notities',
  'figure.photos': "Foto's",
  'figure.dates': 'Data',
  'figure.visibility': 'Zichtbaarheid',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Deze reis heeft nog geen notities',
  'entries.empty.body':
    "Elke notitie is één moment: een datum, een paar regels, een plek en de foto's die je daar maakte. Schrijf de eerste terwijl je de geur nog ruikt.",
  'entry.photos.count': {
    one: '{photos} foto',
    other: "{photos} foto's",
  },
  'photo.untitled': 'Foto zonder omschrijving',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Deze reis',
  'side.status': 'Toestand',
  'side.started': 'Begin',
  'side.ended': 'Einde',
  'side.loosePhotos': "Losse foto's",
  'moods.label': 'Stemmingen',
  'authors.label': 'Geschreven door',
  'authors.count': {
    one: '{authors} auteur',
    other: '{authors} auteurs',
  },
} satisfies TranslationOf<typeof En>

export default messages
