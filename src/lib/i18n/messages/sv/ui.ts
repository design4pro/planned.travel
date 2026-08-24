/**
 * The design system's own copy, in Swedish.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** `du` throughout, which is simply how Swedish addresses anyone.
 *
 * **Plural.** `Intl.PluralRules('sv')` reports `one` and `other`, the same two
 * branches English needs, so every plural message below carries exactly those.
 *
 * **Typography.** Swedish closes a date range up on the en dash ("12–14 maj")
 * rather than setting a spaced em dash, and a month heading binds to its year
 * with a non-breaking space so a narrow calendar cannot break "januari 2026"
 * over two lines. A spoken date takes "den" before the day.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Töm',
  'action.close': 'Stäng',
  'action.dismiss': 'Dölj',
  'action.remove': 'Ta bort',
  'action.undo': 'Ångra',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Läser in',
  'status.working': 'Sparar',
  'status.searching': 'Söker',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} är online',
  'avatar.status.away': '{name} är strax tillbaka',
  'avatar.status.busy': '{name} är upptagen',
  'avatar.status.offline': '{name} är offline',
  'avatar.overflow': {
    one: '{others} person till',
    other: '{others} personer till',
  },
  /**
   * The figure leads and the marker follows, the way a Swedish reader meets a
   * capped count. The face is `aria-hidden`, so the exact number is spoken from
   * `avatar.overflow` either way.
   */
  'avatar.more': '{hidden}+',

  /* --------------------------------------------------------------- badge */
  'badge.overflow': '+{max}',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Välj ett datum',
  'calendar.label.range': 'Välj en period',
  'calendar.previousMonth': 'Föregående månad',
  'calendar.nextMonth': 'Nästa månad',
  'calendar.monthYear': '{month}\u00a0{year}',
  'calendar.grid': '{month} – {label}',
  'calendar.showing': 'Visar {months}',
  /** Swedish speaks a date with "den" before the day: "måndag den 12 januari". */
  'calendar.day': '{weekday} den {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Välj …',
  'select.unavailable': 'Ej tillgängligt: {value}',
  'select.unavailableHint':
    'Det sparade valet {value} finns inte längre. Välj något annat.',
  'combobox.search': 'Sök',
  'combobox.empty': 'Inga träffar',
  'combobox.clear': 'Rensa valet',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Välj datum',
  'datePicker.clear': 'Rensa datumet',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Välj period',
  'dateRange.clear': 'Rensa datumen',
  'dateRange.presets': 'Snabbval',
  'dateRange.preset.week': 'Kommande 7 dagar',
  'dateRange.preset.fortnight': 'Kommande 2 veckor',
  'dateRange.preset.month': 'Kommande 30 dagar',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'från {start} – …',
  'dateRange.nights': {
    one: '{nights} natt',
    other: '{nights} nätter',
  },
  'dateRange.nightsSelected': {
    one: '{nights} natt vald',
    other: '{nights} nätter valda',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Sidnavigering',
  'pagination.first': 'Första sidan',
  'pagination.previous': 'Föregående sida',
  'pagination.next': 'Nästa sida',
  'pagination.last': 'Sista sidan',
  'pagination.page': 'Sida {page}',
  'pagination.current': 'Sida {page} av {pageCount}',
  'pagination.summary': 'Visar {from}–{to} av {total}',
} satisfies TranslationOf<typeof En>

export default messages
