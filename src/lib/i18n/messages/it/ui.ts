/**
 * The design system's own copy, in Italian.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular — «tu» — throughout, the voice an
 * Italian consumer product uses with the person holding the phone. The whole
 * Italian catalogue keeps it, so no screen turns to «Lei» halfway down.
 *
 * **Plural.** `Intl.PluralRules('it')` reports `one`, `many` and `other`.
 * `many` is the branch CLDR keeps for the millions, where Italian inflects the
 * noun exactly as it does in `other`.
 *
 * **Typography.** Sentence case: Italian capitalises neither months nor
 * weekdays. A month binds to its year with a non-breaking space so a narrow
 * calendar cannot break «gennaio 2026» over two lines, and a range takes a
 * closed-up en dash.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Svuota',
  'action.close': 'Chiudi',
  'action.dismiss': 'Nascondi',
  'action.remove': 'Rimuovi',
  'action.undo': 'Annulla',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Caricamento',
  'status.working': 'Salvataggio',
  'status.searching': 'Ricerca',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} è online',
  'avatar.status.away': '{name} è assente',
  'avatar.status.busy': '{name} è occupato',
  'avatar.status.offline': '{name} è offline',
  'avatar.overflow': {
    one: '{others} altra persona',
    many: '{others} altre persone',
    other: '{others} altre persone',
  },
  /**
   * Italian leads with the sign, the way English does: «+3» means "three more
   * than the faces on screen". After the figure it would read as «tre o più»,
   * which is untrue — one of them is already visible. The face is
   * `aria-hidden`, so the number is spoken from `avatar.overflow`.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * «99+» is the Italian notation as well — figure first, marker after, read
   * as «novantanove o più». The mirrored «+99» would say that ninety-nine had
   * just arrived, which is a different claim.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Scegli una data',
  'calendar.label.range': 'Scegli un periodo',
  'calendar.previousMonth': 'Mese precedente',
  'calendar.nextMonth': 'Mese successivo',
  'calendar.monthYear': '{month}\u00a0{year}',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'In vista: {months}',
  'calendar.day': '{weekday}, {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Seleziona…',
  'select.unavailable': 'Non disponibile: {value}',
  'select.unavailableHint':
    'La scelta salvata {value} non è più disponibile. Scegline un’altra.',
  'combobox.search': 'Cerca',
  'combobox.empty': 'Nessun risultato',
  'combobox.clear': 'Annulla la selezione',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Scegli una data',
  'datePicker.clear': 'Rimuovi la data',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Scegli le date',
  'dateRange.clear': 'Rimuovi le date',
  'dateRange.presets': 'Periodi rapidi',
  'dateRange.preset.week': 'Prossimi 7 giorni',
  'dateRange.preset.fortnight': 'Prossime 2 settimane',
  'dateRange.preset.month': 'Prossimi 30 giorni',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'dal {start} a…',
  'dateRange.nights': {
    one: '{nights} notte',
    many: '{nights} notti',
    other: '{nights} notti',
  },
  'dateRange.nightsSelected': {
    one: '{nights} notte scelta',
    many: '{nights} notti scelte',
    other: '{nights} notti scelte',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Impaginazione',
  'pagination.first': 'Prima pagina',
  'pagination.previous': 'Pagina precedente',
  'pagination.next': 'Pagina successiva',
  'pagination.last': 'Ultima pagina',
  'pagination.page': 'Pagina {page}',
  'pagination.current': 'Pagina {page} di {pageCount}',
  'pagination.summary': 'In vista {from}–{to} di {total}',
} satisfies TranslationOf<typeof En>

export default messages
