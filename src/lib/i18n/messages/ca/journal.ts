/**
 * The travel journal's copy, in ca.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` només per a nombres compactes grans.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Sense definir',
  /* -------------------------------------------------- the journey page */
  'story.error': 'No s’ha pogut carregar aquest viatge',
  'story.back': 'Tots els viatges',
  'story.loading': 'S’està carregant',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Entrades',
  'figure.photos': 'Fotos',
  'figure.dates': 'Període',
  'figure.visibility': 'Visibilitat',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Aquest viatge encara no té entrades',
  'entries.empty.body':
    'Cada entrada és un moment: una data, unes línies, un lloc i les fotos que hi vas fer. Escriu la primera mentre encara en recordes l’olor.',
  'entry.photos.count': {
    one: '{photos} foto',
    many: '{photos} fotos',
    other: '{photos} fotos',
  },
  'photo.untitled': 'Foto sense peu',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Aquest viatge',
  'side.status': 'Estat',
  'side.started': 'Inici',
  'side.ended': 'Fi',
  'side.loosePhotos': 'Fotos soltes',
  'moods.label': 'Estats d’ànim',
  'authors.label': 'Escrit per',
  'authors.count': {
    one: '{authors} autor',
    many: '{authors} autors',
    other: '{authors} autors',
  },
} satisfies TranslationOf<typeof En>

export default messages
