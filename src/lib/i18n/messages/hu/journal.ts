/**
 * The travel journal's copy, in hu.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Többes szám.** `one` · `other`; a magyar szám után egyes számot használ.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Nincs beállítva',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Ezt az utazást nem sikerült betölteni',
  'story.back': 'Minden utazás',
  'story.loading': 'Betöltés',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Bejegyzések',
  'figure.photos': 'Fényképek',
  'figure.dates': 'Dátumok',
  'figure.visibility': 'Láthatóság',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Ennek az utazásnak még nincs bejegyzése',
  'entries.empty.body':
    'Minden bejegyzés egy pillanat: egy dátum, néhány sor, egy hely és a fényképek, amiket ott készítettél. Írd meg az elsőt, amíg még emlékszel a szagára.',
  'entry.photos.count': {
    one: '{photos} fénykép',
    other: '{photos} fénykép',
  },
  'photo.untitled': 'Feliratozás nélküli fénykép',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Ez az utazás',
  'side.status': 'Állapot',
  'side.started': 'Kezdet',
  'side.ended': 'Vége',
  'side.loosePhotos': 'Szabad fényképek',
  'moods.label': 'Hangulatok',
  'authors.label': 'Írta',
  'authors.count': {
    one: '{authors} szerző',
    other: '{authors} szerző',
  },
} satisfies TranslationOf<typeof En>

export default messages
