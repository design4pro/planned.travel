/**
 * The travel journal's copy, in fr.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Pluriel.** `one` · `many` · `other` ; `many` ne sert qu’aux grands
 * nombres compacts. **Typographie.** Le français cite avec « … ».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Non défini',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Ce voyage n’a pas pu être chargé',
  'story.back': 'Tous les voyages',
  'story.loading': 'Chargement',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Entrées',
  'figure.photos': 'Photographies',
  'figure.dates': 'Période',
  'figure.visibility': 'Visibilité',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Ce voyage n’a encore aucune entrée',
  'entries.empty.body':
    'Chaque entrée est un instant : une date, quelques lignes, un lieu et les photos que vous y avez prises. Écrivez la première pendant que vous en sentez encore l’odeur.',
  'entry.photos.count': {
    one: '{photos} photo',
    many: '{photos} photos',
    other: '{photos} photos',
  },
  'photo.untitled': 'Photo sans légende',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Ce voyage',
  'side.status': 'Statut',
  'side.started': 'Début',
  'side.ended': 'Fin',
  'side.loosePhotos': 'Photos isolées',
  'moods.label': 'Humeurs',
  'authors.label': 'Écrit par',
  'authors.count': {
    one: '{authors} auteur',
    many: '{authors} auteurs',
    other: '{authors} auteurs',
  },
} satisfies TranslationOf<typeof En>

export default messages
