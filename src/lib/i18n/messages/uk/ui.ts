/**
 * The design system's own copy, in Ukrainian.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Plural.** `Intl.PluralRules('uk')` reports `one` · `few` · `many` ·
 * `other`: `one` for 1, 21, 31 …, `few` for 2–4, 22–24 …, `many` for 0 and
 * 5–20, and `other` for fractions, which take the genitive singular
 * ("1,5 ночі").
 *
 * **Typography.** Ukrainian sets a range and an apposition with a spaced em
 * dash, quotes with «…», writes a year with the `р.` marker, and uses the
 * typographic apostrophe U+2019 rather than an ASCII quote.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Очистити',
  'action.clearFilters': 'Скинути фільтри',
  'action.close': 'Закрити',
  'action.dismiss': 'Сховати',
  'action.remove': 'Прибрати',
  'action.keep': 'Залишити',
  'action.undo': 'Скасувати',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Завантаження',
  'status.working': 'Виконується',
  'status.searching': 'Шукаємо',
  'status.removing': 'Вилучення',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} у мережі',
  'avatar.status.away': '{name} не на місці',
  'avatar.status.busy': '{name}: не турбувати',
  'avatar.status.offline': '{name} не в мережі',
  'avatar.overflow': {
    one: 'ще {others} особа',
    few: 'ще {others} особи',
    many: 'ще {others} осіб',
    other: 'ще {others} особи',
  },
  /**
   * The face at the end of a crowded stack. `+3` reads "three more", and Ukrainian
   * marks it exactly where English does — the plus belongs in front of the
   * figure, not after it, where it would instead read "three or more".
   * `{hidden}` arrives already grouped in this locale's digits.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * A count that has run past the badge's cap: `99+` says "ninety-nine or
   * more", which is the same marker and the same side as English uses.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Виберіть дату',
  'calendar.label.range': 'Виберіть період',
  'calendar.previousMonth': 'Попередній місяць',
  'calendar.nextMonth': 'Наступний місяць',
  /** Ukrainian marks a bare year with `р.`: «січень 2026 р.». */
  'calendar.monthYear': '{month} {year} р.',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'Показано: {months}',
  /**
   * Commas rather than a running date: the frozen CLDR table holds the
   * nominative month («січень»), and a Ukrainian date would need the genitive
   * («12 січня»). A comma-separated list reads correctly in speech without
   * inventing a case the table does not carry.
   */
  'calendar.day': '{weekday}, {day}, {month} {year} р.',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Виберіть…',
  'select.unavailable': 'Недоступно: {value}',
  'select.unavailableHint':
    'Збережений вибір {value} більше недоступний. Виберіть інший.',
  'combobox.search': 'Пошук',
  'combobox.empty': 'Нічого не знайдено',
  'combobox.clear': 'Скинути вибір',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Вкажіть дату',
  'datePicker.clear': 'Прибрати дату',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Вкажіть дати',
  'dateRange.clear': 'Прибрати дати',
  'dateRange.presets': 'Швидкі періоди',
  'dateRange.preset.week': 'Найближчі 7 днів',
  'dateRange.preset.fortnight': 'Найближчі 2 тижні',
  'dateRange.preset.month': 'Найближчі 30 днів',
  'dateRange.value': '{start} — {end}',
  'dateRange.valuePending': 'з {start} — …',
  'dateRange.nights': {
    one: '{nights} ніч',
    few: '{nights} ночі',
    many: '{nights} ночей',
    other: '{nights} ночі',
  },
  'dateRange.nightsSelected': {
    one: 'вибрано {nights} ніч',
    few: 'вибрано {nights} ночі',
    many: 'вибрано {nights} ночей',
    other: 'вибрано {nights} ночі',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Навігація сторінками',
  'pagination.first': 'Перша сторінка',
  'pagination.previous': 'Попередня сторінка',
  'pagination.next': 'Наступна сторінка',
  'pagination.last': 'Остання сторінка',
  'pagination.page': 'Сторінка {page}',
  'pagination.current': 'Сторінка {page} з {pageCount}',
  'pagination.summary': 'Показано {from}–{to} з {total}',
} satisfies TranslationOf<typeof En>

export default messages
