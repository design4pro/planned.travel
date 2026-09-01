/**
 * The travel journal's copy, in it.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurale.** `one` · `many` · `other`; `many` solo per i numeri compatti grandi.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Non impostato',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Non è stato possibile caricare questo viaggio',
  'story.back': 'Tutti i viaggi',
  'story.loading': 'Caricamento',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Voci',
  'figure.photos': 'Foto',
  'figure.dates': 'Date',
  'figure.visibility': 'Visibilità',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Questo viaggio non ha ancora voci',
  'entries.empty.body':
    'Ogni voce è un momento: una data, qualche riga, un luogo e le foto che hai scattato lì. Scrivi la prima mentre ne ricordi ancora l’odore.',
  'entry.photos.count': {
    one: '{photos} foto',
    many: '{photos} foto',
    other: '{photos} foto',
  },
  'photo.untitled': 'Foto senza didascalia',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Questo viaggio',
  'side.status': 'Stato',
  'side.started': 'Inizio',
  'side.ended': 'Fine',
  'side.loosePhotos': 'Foto sciolte',
  'moods.label': 'Stati d’animo',
  'authors.label': 'Scritto da',
  'authors.count': {
    one: '{authors} autore',
    many: '{authors} autori',
    other: '{authors} autori',
  },
} satisfies TranslationOf<typeof En>

export default messages
