/**
 * The travel journal's copy, in sv.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Inte angivet',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Den här resan kunde inte läsas in',
  'story.back': 'Alla resor',
  'story.loading': 'Läser in',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Inlägg',
  'figure.photos': 'Foton',
  'figure.dates': 'Datum',
  'figure.visibility': 'Synlighet',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Den här resan har inga inlägg än',
  'entries.empty.body':
    'Varje inlägg är ett ögonblick: ett datum, några rader, en plats och fotona du tog där. Skriv det första medan du fortfarande minns lukten.',
  'entry.photos.count': {
    one: '{photos} foto',
    other: '{photos} foton',
  },
  'photo.untitled': 'Foto utan bildtext',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Den här resan',
  'side.status': 'Tillstånd',
  'side.started': 'Början',
  'side.ended': 'Slut',
  'side.loosePhotos': 'Lösa foton',
  'moods.label': 'Sinnesstämningar',
  'authors.label': 'Skrivet av',
  'authors.count': {
    one: '{authors} författare',
    other: '{authors} författare',
  },
} satisfies TranslationOf<typeof En>

export default messages
