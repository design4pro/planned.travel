/**
 * The design system's own copy, in Catalan.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular, and an action is written as an
 * imperative — «Tanca», «Desa», «Tria» — which is the house style of Catalan
 * software and what the whole Catalan catalogue keeps.
 *
 * **Plural.** `Intl.PluralRules('ca')` reports `one`, `many` and `other`.
 * `many` is the branch CLDR keeps for the millions, where Catalan inflects the
 * noun exactly as it does in `other`.
 *
 * **Dates.** `src/lib/format-tables.ts` already carries the frozen Catalan
 * month, weekday and short-date forms, including the `del` before a year that
 * the runtimes disagreed about — so nothing here restates a date format. The
 * two calendar patterns below only order the parts the formatter hands over,
 * and they leave the preposition off the month on purpose: Catalan elides it
 * before a vowel («d’abril», «d’agost», «d’octubre») and a fixed pattern
 * cannot, so it would be wrong three months of the year.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Buida',
  'action.close': 'Tanca',
  'action.dismiss': 'Amaga',
  'action.remove': 'Suprimeix',
  'action.undo': 'Desfés',

  /* -------------------------------------------------------------- status */
  'status.loading': 'S’està carregant',
  'status.working': 'S’està desant',
  'status.searching': 'S’està cercant',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} està en línia',
  'avatar.status.away': '{name} és fora',
  'avatar.status.busy': '{name} està ocupat',
  'avatar.status.offline': '{name} està sense connexió',
  'avatar.overflow': {
    one: '{others} persona més',
    many: '{others} persones més',
    other: '{others} persones més',
  },
  /**
   * Catalan puts the sign first, as English does: «+3» says "three more than
   * the faces shown". Behind the figure it would read as «tres o més», which
   * is false — one of them is already on screen. The face is `aria-hidden`, so
   * the exact number always reaches a screen reader through `avatar.overflow`.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * A capped count is «99+» in Catalan too — figure, then marker, read as
   * «noranta-nou o més». The mirrored «+99» would announce ninety-nine
   * arrivals, which is a different fact.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Tria una data',
  'calendar.label.range': 'Tria un interval de dates',
  'calendar.previousMonth': 'Mes anterior',
  'calendar.nextMonth': 'Mes següent',
  'calendar.monthYear': '{month} del {year}',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'Es mostra {months}',
  'calendar.day': '{weekday}, {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Tria…',
  'select.unavailable': 'No disponible: {value}',
  'select.unavailableHint':
    'L’opció desada {value} ja no hi és. Tria’n una altra.',
  'combobox.search': 'Cerca',
  'combobox.empty': 'Cap coincidència',
  'combobox.clear': 'Treu la selecció',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Tria una data',
  'datePicker.clear': 'Treu la data',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Tria les dates',
  'dateRange.clear': 'Treu les dates',
  'dateRange.presets': 'Intervals ràpids',
  'dateRange.preset.week': 'Pròxims 7 dies',
  'dateRange.preset.fortnight': 'Pròximes 2 setmanes',
  'dateRange.preset.month': 'Pròxims 30 dies',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'Del {start} a…',
  'dateRange.nights': {
    one: '{nights} nit',
    many: '{nights} nits',
    other: '{nights} nits',
  },
  'dateRange.nightsSelected': {
    one: '{nights} nit triada',
    many: '{nights} nits triades',
    other: '{nights} nits triades',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Paginació',
  'pagination.first': 'Primera pàgina',
  'pagination.previous': 'Pàgina anterior',
  'pagination.next': 'Pàgina següent',
  'pagination.last': 'Última pàgina',
  'pagination.page': 'Pàgina {page}',
  'pagination.current': 'Pàgina {page} de {pageCount}',
  'pagination.summary': 'Es mostren {from}–{to} de {total}',
} satisfies TranslationOf<typeof En>

export default messages
