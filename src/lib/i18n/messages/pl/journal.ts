/**
 * The travel journal's copy, in pl.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Liczba mnoga.** `one` · `few` · `many` · `other`; `other` osiąga tylko
 * liczba dziesiętna, stąd dopełniacz liczby pojedynczej.
 *
 * **Typografia.** Polski cytuje „…” i składa zakres półpauzą bez spacji.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Nie ustawiono',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Nie udało się wczytać tej podróży',
  'story.back': 'Wszystkie podróże',
  'story.loading': 'Wczytywanie',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Wpisy',
  'figure.photos': 'Zdjęcia',
  'figure.dates': 'Daty',
  'figure.visibility': 'Widoczność',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Ta podróż nie ma jeszcze wpisów',
  'entries.empty.body':
    'Każdy wpis to jedna chwila: data, kilka zdań, miejsce i zdjęcia, które tam zrobiłeś. Napisz pierwszy, póki jeszcze pamiętasz zapach tego dnia.',
  'entry.photos.count': {
    one: '{photos} zdjęcie',
    few: '{photos} zdjęcia',
    many: '{photos} zdjęć',
    other: '{photos} zdjęcia',
  },
  'photo.untitled': 'Zdjęcie bez podpisu',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Ta podróż',
  'side.status': 'Stan',
  'side.started': 'Początek',
  'side.ended': 'Koniec',
  'side.loosePhotos': 'Luźne zdjęcia',
  'moods.label': 'Nastroje',
  'authors.label': 'Napisali',
  'authors.count': {
    one: '{authors} autor',
    few: '{authors} autorzy',
    many: '{authors} autorów',
    other: '{authors} autora',
  },
} satisfies TranslationOf<typeof En>

export default messages
