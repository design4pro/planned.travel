/**
 * The travel journal's copy, in cs.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurál.** `one` · `few` · `many` · `other`: `many` je desetinné číslo.
 * **Typografie.** Čeština cituje „…“.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Nenastaveno',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Tuto cestu se nepodařilo načíst',
  'story.back': 'Všechny cesty',
  'story.loading': 'Načítání',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Záznamy',
  'figure.photos': 'Fotky',
  'figure.dates': 'Data',
  'figure.visibility': 'Viditelnost',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Tato cesta ještě nemá žádné záznamy',
  'entries.empty.body':
    'Každý záznam je jeden okamžik: datum, několik řádků, místo a fotky, které jsi tam udělal. Napiš první, dokud si ještě pamatuješ, jak to vonělo.',
  'entry.photos.count': {
    one: '{photos} fotka',
    few: '{photos} fotky',
    many: '{photos} fotky',
    other: '{photos} fotek',
  },
  'photo.untitled': 'Fotka bez popisku',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Tato cesta',
  'side.status': 'Stav',
  'side.started': 'Začátek',
  'side.ended': 'Konec',
  'side.loosePhotos': 'Volné fotky',
  'moods.label': 'Nálady',
  'authors.label': 'Napsali',
  'authors.count': {
    one: '{authors} autor',
    few: '{authors} autoři',
    many: '{authors} autora',
    other: '{authors} autorů',
  },
} satisfies TranslationOf<typeof En>

export default messages
