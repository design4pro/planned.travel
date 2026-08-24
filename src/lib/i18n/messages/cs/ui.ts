/**
 * The design system's own copy, in Czech.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Plural.** `Intl.PluralRules('cs')` reports `one` · `few` · `many` ·
 * `other`, and Czech assigns them unlike the other Slavic locales: `one` is
 * exactly 1, `few` is 2–4, `other` covers 0 and everything from 5 up, and
 * `many` is reached **only by a fraction** — which is why every `many` branch
 * below carries the genitive singular a decimal takes ("1,5 noci").
 *
 * **Typography.** Czech closes a range up around the en dash ("12.–14. května")
 * and quotes with „…“. A month and its year are joined by a non-breaking space,
 * written as an escape so a reader of this file can see it is deliberate.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Vymazat',
  'action.close': 'Zavřít',
  'action.dismiss': 'Skrýt',
  'action.remove': 'Odebrat',
  'action.undo': 'Vrátit zpět',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Načítání',
  'status.working': 'Zpracování',
  'status.searching': 'Hledání',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} je online',
  'avatar.status.away': '{name} je pryč',
  'avatar.status.busy': '{name}: nerušit',
  'avatar.status.offline': '{name} je offline',
  'avatar.overflow': {
    one: '{others} další člověk',
    few: '{others} další lidé',
    many: '{others} dalšího člověka',
    other: '{others} dalších lidí',
  },
  /**
   * The sign sits after the number here. English writes `+3`; a Czech reader
   * meets the same figure as `3+`, and the face is `aria-hidden`, so the exact
   * count is spoken from `avatar.overflow` either way.
   */
  'avatar.more': '{hidden}+',

  /* --------------------------------------------------------------- badge */
  'badge.overflow': '+{max}',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Vyberte datum',
  'calendar.label.range': 'Vyberte rozmezí dat',
  'calendar.previousMonth': 'Předchozí měsíc',
  'calendar.nextMonth': 'Další měsíc',
  /**
   * A month and its year are one unit, and Czech typesetting does not break
   * them apart: the space between them is a non-breaking one, written as an
   * escape rather than as an invisible character for the same reason
   * `src/lib/format-tables.ts` writes its currency patterns that way.
   */
  'calendar.monthYear': '{month}\u00a0{year}',
  'calendar.grid': '{month} – {label}',
  'calendar.showing': 'Zobrazeno: {months}',
  'calendar.day': '{weekday} {day}. {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Vyberte…',
  'select.unavailable': 'Nedostupné: {value}',
  'select.unavailableHint':
    'Uložená volba {value} už není k dispozici. Vyberte jinou.',
  'combobox.search': 'Hledat',
  'combobox.empty': 'Žádné výsledky',
  'combobox.clear': 'Zrušit výběr',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Zvolte datum',
  'datePicker.clear': 'Smazat datum',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Zvolte data',
  'dateRange.clear': 'Smazat data',
  'dateRange.presets': 'Rychlá rozmezí',
  'dateRange.preset.week': 'Příštích 7 dní',
  'dateRange.preset.fortnight': 'Příští 2 týdny',
  'dateRange.preset.month': 'Příštích 30 dní',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'od {start} – …',
  'dateRange.nights': {
    one: '{nights} noc',
    few: '{nights} noci',
    many: '{nights} noci',
    other: '{nights} nocí',
  },
  'dateRange.nightsSelected': {
    one: 'vybrána {nights} noc',
    few: 'vybrány {nights} noci',
    many: 'vybráno {nights} noci',
    other: 'vybráno {nights} nocí',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Stránkování',
  'pagination.first': 'První stránka',
  'pagination.previous': 'Předchozí stránka',
  'pagination.next': 'Další stránka',
  'pagination.last': 'Poslední stránka',
  'pagination.page': 'Stránka {page}',
  'pagination.current': 'Stránka {page} z {pageCount}',
  'pagination.summary': 'Zobrazeno {from}–{to} z {total}',
} satisfies TranslationOf<typeof En>

export default messages
