/**
 * The design system's own copy, in German.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** German second person singular throughout — a travel planner
 * addresses the traveller, not their employer. The whole German catalogue keeps
 * that voice, so no screen switches from „du" to „Sie" halfway down.
 *
 * **Plural.** `Intl.PluralRules('de')` reports `one` and `other`, the same two
 * branches English needs, so every plural message below carries exactly those.
 *
 * **Typography.** A range takes a closed-up en dash („12.–14. Mai"), never the
 * spaced em dash English sets, and a month heading binds to its year with a
 * non-breaking space so a narrow calendar cannot break „Januar 2026" over two
 * lines.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Leeren',
  'action.close': 'Schließen',
  'action.dismiss': 'Ausblenden',
  'action.remove': 'Entfernen',
  'action.undo': 'Rückgängig',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Wird geladen',
  'status.working': 'Wird gespeichert',
  'status.searching': 'Wird gesucht',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} ist online',
  'avatar.status.away': '{name} ist gleich zurück',
  'avatar.status.busy': '{name} ist beschäftigt',
  'avatar.status.offline': '{name} ist offline',
  'avatar.overflow': {
    one: '{others} weitere Person',
    other: '{others} weitere Personen',
  },
  /**
   * German writes this exactly as English does: the sign leads and means "and
   * this many more beyond the faces you can see". Putting it after the figure
   * would turn it into "drei oder mehr", which is false — one of those people
   * is already on screen. The face is `aria-hidden`, so the exact number is
   * spoken from `avatar.overflow` either way.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * "99+" is the German notation too — figure first, marker after, read as
   * "neunundneunzig oder mehr". The mirrored form "+99" would announce that
   * ninety-nine new items had just arrived, which is a different fact.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Datum wählen',
  'calendar.label.range': 'Zeitraum wählen',
  'calendar.previousMonth': 'Voriger Monat',
  'calendar.nextMonth': 'Nächster Monat',
  'calendar.monthYear': '{month}\u00a0{year}',
  'calendar.grid': '{month} – {label}',
  'calendar.showing': 'Angezeigt: {months}',
  /** German writes the day with its ordinal point: „Montag, 12. Januar 2026". */
  'calendar.day': '{weekday}, {day}. {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Bitte wählen …',
  'select.unavailable': 'Nicht verfügbar: {value}',
  'select.unavailableHint':
    'Die gespeicherte Auswahl {value} gibt es nicht mehr. Bitte wähle etwas anderes.',
  'combobox.search': 'Suchen',
  'combobox.empty': 'Keine Treffer',
  'combobox.clear': 'Auswahl aufheben',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Datum aussuchen',
  'datePicker.clear': 'Datum entfernen',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Zeitraum aussuchen',
  'dateRange.clear': 'Zeitraum entfernen',
  'dateRange.presets': 'Schnelle Zeiträume',
  'dateRange.preset.week': 'Nächste 7 Tage',
  'dateRange.preset.fortnight': 'Nächste 2 Wochen',
  'dateRange.preset.month': 'Nächste 30 Tage',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'ab {start} – …',
  'dateRange.nights': {
    one: '{nights} Nacht',
    other: '{nights} Nächte',
  },
  'dateRange.nightsSelected': {
    one: '{nights} Nacht gewählt',
    other: '{nights} Nächte gewählt',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Seitenwechsel',
  'pagination.first': 'Erste Seite',
  'pagination.previous': 'Vorige Seite',
  'pagination.next': 'Nächste Seite',
  'pagination.last': 'Letzte Seite',
  'pagination.page': 'Seite {page}',
  'pagination.current': 'Seite {page} von {pageCount}',
  'pagination.summary': 'Angezeigt: {from}–{to} von {total}',
} satisfies TranslationOf<typeof En>

export default messages
