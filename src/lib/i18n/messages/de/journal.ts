/**
 * The travel journal's copy, in de.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`. **Typografie.** Deutsch zitiert mit „…“.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Nicht gesetzt',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Diese Reise konnte nicht geladen werden',
  'story.back': 'Alle Reisen',
  'story.loading': 'Wird geladen',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Einträge',
  'figure.photos': 'Fotos',
  'figure.dates': 'Daten',
  'figure.visibility': 'Sichtbarkeit',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Diese Reise hat noch keine Einträge',
  'entries.empty.body':
    'Jeder Eintrag ist ein Moment: ein Datum, ein paar Zeilen, ein Ort und die Fotos, die du dort gemacht hast. Schreib den ersten, solange du den Geruch noch in der Nase hast.',
  'entry.photos.count': {
    one: '{photos} Foto',
    other: '{photos} Fotos',
  },
  'photo.untitled': 'Foto ohne Bildtext',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Diese Reise',
  'side.status': 'Zustand',
  'side.started': 'Beginn',
  'side.ended': 'Ende',
  'side.loosePhotos': 'Lose Fotos',
  'moods.label': 'Stimmungen',
  'authors.label': 'Geschrieben von',
  'authors.count': {
    one: '{authors} Autor',
    other: '{authors} Autoren',
  },
} satisfies TranslationOf<typeof En>

export default messages
