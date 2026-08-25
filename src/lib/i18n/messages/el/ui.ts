/**
 * The design system's own copy, in Greek.
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
 * **Gender.** A status line names a person the catalogue has never met, so every
 * one of them is built on a verb rather than on an adjective — «είναι σε
 * σύνδεση», not «συνδεδεμένος» — because the adjective would have to guess.
 *
 * **Patterns.** Where English holds only placeholders and punctuation, Greek
 * convention decides: a month over a calendar grid takes «του» before the year,
 * a range reads «έως» rather than taking a dash, and the overflow marker sits on
 * the side opposite the English one, which is the only difference a
 * two-character pattern can carry.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Καθαρισμός',
  'action.close': 'Κλείσιμο',
  'action.dismiss': 'Απόρριψη',
  'action.remove': 'Αφαίρεση',
  'action.undo': 'Αναίρεση',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Φορτώνει',
  'status.working': 'Σε εξέλιξη',
  'status.searching': 'Αναζητά',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} είναι σε σύνδεση',
  'avatar.status.away': '{name} απουσιάζει',
  'avatar.status.busy': '{name} έχει δηλώσει απασχόληση',
  'avatar.status.offline': '{name} είναι εκτός σύνδεσης',
  'avatar.overflow': {
    one: '{others} ακόμη άτομο',
    other: '{others} ακόμη άτομα',
  },
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Επιλέξτε ημερομηνία',
  'calendar.label.range': 'Επιλέξτε εύρος ημερομηνιών',
  'calendar.previousMonth': 'Προηγούμενος μήνας',
  'calendar.nextMonth': 'Επόμενος μήνας',
  'calendar.monthYear': '{month} του {year}',
  'calendar.grid': '{label} — {month}',
  'calendar.showing': 'Εμφανίζεται {months}',
  'calendar.day': '{weekday}, {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Επιλέξτε…',
  'select.unavailable': 'Μη διαθέσιμο: {value}',
  'select.unavailableHint':
    'Η αποθηκευμένη επιλογή {value} δεν είναι πια διαθέσιμη. Διαλέξτε άλλη.',
  'combobox.search': 'Αναζήτηση',
  'combobox.empty': 'Καμία αντιστοιχία',
  'combobox.clear': 'Καθαρισμός επιλογής',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Διαλέξτε ημερομηνία',
  'datePicker.clear': 'Καθαρισμός ημερομηνίας',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Διαλέξτε ημερομηνίες',
  'dateRange.clear': 'Καθαρισμός ημερομηνιών',
  'dateRange.presets': 'Γρήγορα εύρη',
  'dateRange.preset.week': 'Επόμενες 7 ημέρες',
  'dateRange.preset.fortnight': 'Επόμενες 2 εβδομάδες',
  'dateRange.preset.month': 'Επόμενες 30 ημέρες',
  'dateRange.value': '{start} έως {end}',
  'dateRange.valuePending': '{start} έως …',
  'dateRange.nights': {
    one: '{nights} διανυκτέρευση',
    other: '{nights} διανυκτερεύσεις',
  },
  'dateRange.nightsSelected': {
    one: 'Επιλέχθηκε {nights} διανυκτέρευση',
    other: 'Επιλέχθηκαν {nights} διανυκτερεύσεις',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Σελιδοποίηση',
  'pagination.first': 'Πρώτη σελίδα',
  'pagination.previous': 'Προηγούμενη σελίδα',
  'pagination.next': 'Επόμενη σελίδα',
  'pagination.last': 'Τελευταία σελίδα',
  'pagination.page': 'Σελίδα {page}',
  'pagination.current': 'Σελίδα {page} από {pageCount}',
  'pagination.summary': 'Εμφανίζονται {from}–{to} από {total}',
} satisfies TranslationOf<typeof En>

export default messages
