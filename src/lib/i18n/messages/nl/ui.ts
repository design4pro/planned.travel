/**
 * The design system's own copy, in Dutch.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Informal `je`/`jij` throughout the Dutch catalogue. A travel
 * planner speaks to the traveller; `u` would put a bank counter between them.
 *
 * **Plural.** `Intl.PluralRules('nl')` reports `one` and `other`, the same two
 * branches English needs, so every plural message below carries exactly those.
 *
 * **Typography.** Dutch closes a date range up on the en dash ("12–14 mei")
 * rather than setting a spaced em dash, and a month heading binds to its year
 * with a non-breaking space so a narrow calendar cannot break "januari 2026"
 * over two lines.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Wissen',
  'action.clearFilters': 'Filters wissen',
  'action.close': 'Sluiten',
  'action.dismiss': 'Verbergen',
  'action.remove': 'Verwijderen',
  'action.keep': 'Bewaren',
  'action.undo': 'Ongedaan maken',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Bezig met laden',
  'status.working': 'Bezig met opslaan',
  'status.searching': 'Bezig met zoeken',
  'status.removing': 'Wordt verwijderd',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} is nu online',
  'avatar.status.away': '{name} is even weg',
  'avatar.status.busy': '{name} is bezet',
  'avatar.status.offline': '{name} is nu offline',
  'avatar.overflow': {
    one: 'nog {others} persoon',
    other: 'nog {others} personen',
  },
  /**
   * Dutch sets this the way English does: the sign first, meaning "and this
   * many more than the faces shown". Moving it behind the figure would read as
   * "drie of meer", which is untrue — one of the three is already visible. The
   * face is `aria-hidden`, so the exact number is spoken from
   * `avatar.overflow` either way.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * Dutch writes a capped count "99+" — figure, then marker, read as
   * "negenennegentig of meer". The mirrored "+99" would say that
   * ninety-nine new ones had just come in, which is a different claim.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Kies een datum',
  'calendar.label.range': 'Kies een periode',
  'calendar.previousMonth': 'Vorige maand',
  'calendar.nextMonth': 'Volgende maand',
  'calendar.monthYear': '{month}\u00a0{year}',
  'calendar.grid': '{month} – {label}',
  'calendar.showing': 'Te zien: {months}',
  /** The comma is a spoken pause, not Dutch punctuation: this name is read out. */
  'calendar.day': '{weekday}, {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Kiezen …',
  'select.unavailable': 'Niet beschikbaar: {value}',
  'select.unavailableHint':
    'De opgeslagen keuze {value} bestaat niet meer. Kies iets anders.',
  'combobox.search': 'Zoeken',
  'combobox.empty': 'Geen resultaten',
  'combobox.clear': 'Keuze wissen',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Datum kiezen',
  'datePicker.clear': 'Datum wissen',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Data kiezen',
  'dateRange.clear': 'Data wissen',
  'dateRange.presets': 'Snelle periodes',
  'dateRange.preset.week': 'Komende 7 dagen',
  'dateRange.preset.fortnight': 'Komende 2 weken',
  'dateRange.preset.month': 'Komende 30 dagen',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'vanaf {start} – …',
  'dateRange.nights': {
    one: '{nights} nacht',
    other: '{nights} nachten',
  },
  'dateRange.nightsSelected': {
    one: '{nights} nacht gekozen',
    other: '{nights} nachten gekozen',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Paginering',
  'pagination.first': 'Eerste pagina',
  'pagination.previous': 'Vorige pagina',
  'pagination.next': 'Volgende pagina',
  'pagination.last': 'Laatste pagina',
  'pagination.page': 'Pagina {page}',
  'pagination.current': 'Pagina {page} van {pageCount}',
  'pagination.summary': '{from}–{to} van {total} te zien',
} satisfies TranslationOf<typeof En>

export default messages
