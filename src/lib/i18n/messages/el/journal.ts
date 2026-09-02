/**
 * The travel journal's copy, in el.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Πληθυντικός.** `one` · `other`. Τα ελληνικά εισαγωγικά είναι «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Δεν έχει οριστεί',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Αυτό το ταξίδι δεν φορτώθηκε',
  'story.back': 'Όλα τα ταξίδια',
  'story.loading': 'Φορτώνει',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Καταχωρίσεις',
  'figure.photos': 'Φωτογραφίες',
  'figure.dates': 'Ημερομηνίες',
  'figure.visibility': 'Ορατότητα',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Αυτό το ταξίδι δεν έχει ακόμη καταχωρίσεις',
  'entries.empty.body':
    'Κάθε καταχώριση είναι μια στιγμή: μια ημερομηνία, λίγες γραμμές, ένας τόπος και οι φωτογραφίες που έβγαλες εκεί. Γράψε την πρώτη όσο θυμάσαι ακόμη τη μυρωδιά της.',
  'entry.photos.count': {
    one: '{photos} φωτογραφία',
    other: '{photos} φωτογραφίες',
  },
  'photo.untitled': 'Φωτογραφία χωρίς λεζάντα',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Αυτό το ταξίδι',
  'side.status': 'Κατάσταση',
  'side.started': 'Έναρξη',
  'side.ended': 'Λήξη',
  'side.loosePhotos': 'Αδέσποτες φωτογραφίες',
  'moods.label': 'Διαθέσεις',
  'authors.label': 'Γράφτηκε από',
  'authors.count': {
    one: '{authors} συγγραφέας',
    other: '{authors} συγγραφείς',
  },
} satisfies TranslationOf<typeof En>

export default messages
