/**
 * The design system's own copy, in Hungarian.
 *
 * Made from `../en/ui.ts` and from nothing else. `docs/SPEC.md` §1 and §8.9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * `satisfies TranslationOf<typeof En>` is the compile-time half of the parity
 * gate: a key English carries and this file does not is a type error, and so is
 * a key only this file carries. `__tests__/parity.test.ts` covers what a type
 * cannot see — a renamed placeholder, a missing plural branch, an English
 * sentence left sitting in a non-English catalogue.
 *
 * **Two branches that say the same thing.** Hungarian takes the singular after a
 * numeral — «3 éjszaka», never «3 éjszakák» — so `one` and `other` are
 * deliberately identical wherever a number precedes the noun.
 * `Intl.PluralRules` still reports both categories for `hu`, and the gate
 * requires both to be present.
 *
 * **Patterns.** Where English holds only placeholders and punctuation,
 * Hungarian orthography decides: a date runs from the largest unit to the
 * smallest and closes the day with a full stop, a range takes the en dash with
 * no spaces around it, and the overflow marker sits on the side opposite the
 * English one, which is the only difference a two-character pattern can carry.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Törlés',
  'action.close': 'Bezárás',
  'action.dismiss': 'Elvetés',
  'action.remove': 'Eltávolítás',
  'action.undo': 'Visszavonás',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Betöltés',
  'status.working': 'Feldolgozás',
  'status.searching': 'Keresés folyik',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} elérhető',
  'avatar.status.away': '{name} nincs a gépnél',
  'avatar.status.busy': '{name} elfoglalt',
  'avatar.status.offline': '{name} nincs bejelentkezve',
  'avatar.overflow': {
    one: 'még {others} fő',
    other: 'még {others} fő',
  },
  'avatar.more': '{hidden}+',

  /* --------------------------------------------------------------- badge */
  'badge.overflow': '+{max}',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Válasszon dátumot',
  'calendar.label.range': 'Válasszon időszakot',
  'calendar.previousMonth': 'Előző hónap',
  'calendar.nextMonth': 'Következő hónap',
  'calendar.monthYear': '{year}. {month}',
  'calendar.grid': '{label} — {month}',
  'calendar.showing': 'Most látható: {months}',
  'calendar.day': '{year}. {month} {day}., {weekday}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Válasszon…',
  'select.unavailable': 'Nem elérhető: {value}',
  'select.unavailableHint':
    'A mentett {value} választás már nem elérhető. Válasszon másikat.',
  'combobox.search': 'Keresés',
  'combobox.empty': 'Nincs találat',
  'combobox.clear': 'Választás törlése',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Dátum megadása',
  'datePicker.clear': 'Dátum törlése',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Időszak megadása',
  'dateRange.clear': 'Időszak törlése',
  'dateRange.presets': 'Gyors időszakok',
  'dateRange.preset.week': 'Következő 7 nap',
  'dateRange.preset.fortnight': 'Következő 2 hét',
  'dateRange.preset.month': 'Következő 30 nap',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': '{start}–…',
  'dateRange.nights': {
    one: '{nights} éjszaka',
    other: '{nights} éjszaka',
  },
  'dateRange.nightsSelected': {
    one: '{nights} éjszaka kiválasztva',
    other: '{nights} éjszaka kiválasztva',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Lapozás',
  'pagination.first': 'Első oldal',
  'pagination.previous': 'Előző oldal',
  'pagination.next': 'Következő oldal',
  'pagination.last': 'Utolsó oldal',
  'pagination.page': '{page}. oldal',
  'pagination.current': '{page}. oldal / {pageCount}',
  'pagination.summary': '{total} elem közül {from}–{to} látható',
} satisfies TranslationOf<typeof En>

export default messages
