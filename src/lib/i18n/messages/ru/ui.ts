/**
 * The design system's own copy, in Russian.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Plural.** `Intl.PluralRules('ru')` reports `one` · `few` · `many` ·
 * `other`: `one` for 1, 21, 31 …, `few` for 2–4, 22–24 …, `many` for 0 and
 * 5–20, and `other` for fractions — which take the genitive singular
 * ("1,5 ночи"), the same form as `few`.
 *
 * **Typography.** Russian sets a range and an apposition with a spaced em dash,
 * quotes with «…», and writes a year with the `г.` marker, so several patterns
 * here differ from the English source by more than their words.
 *
 * **Digits stay Latin.** `LOCALE_FORMATS.ru` renders `1 234` through
 * `Intl.NumberFormat`, and every number a reader sees arrives already grouped
 * (§8's rule on numbers inside messages).
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Очистить',
  'action.close': 'Закрыть',
  'action.dismiss': 'Скрыть',
  'action.remove': 'Убрать',
  'action.undo': 'Отменить',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Загрузка',
  'status.working': 'Выполняется',
  'status.searching': 'Идёт поиск',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} в сети',
  'avatar.status.away': '{name} отсутствует',
  'avatar.status.busy': '{name}: не беспокоить',
  'avatar.status.offline': '{name} не в сети',
  'avatar.overflow': {
    one: 'ещё {others} человек',
    few: 'ещё {others} человека',
    many: 'ещё {others} человек',
    other: 'ещё {others} человека',
  },
  /**
   * The sign sits after the number here. English writes `+3`; a Russian reader
   * meets the same figure as `3+`, and the face is `aria-hidden`, so the exact
   * count is spoken from `avatar.overflow` either way.
   */
  'avatar.more': '{hidden}+',

  /* --------------------------------------------------------------- badge */
  'badge.overflow': '+{max}',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Выберите дату',
  'calendar.label.range': 'Выберите период',
  'calendar.previousMonth': 'Предыдущий месяц',
  'calendar.nextMonth': 'Следующий месяц',
  /** Russian marks a bare year with `г.`: «январь 2026 г.». */
  'calendar.monthYear': '{month} {year} г.',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'Показано: {months}',
  /**
   * Commas rather than a running date: the frozen CLDR table holds the
   * nominative month ("январь"), and a Russian date would need the genitive
   * ("12 января"). A comma-separated list reads correctly in speech without
   * inventing a case the table does not carry.
   */
  'calendar.day': '{weekday}, {day}, {month} {year} г.',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Выберите…',
  'select.unavailable': 'Недоступно: {value}',
  'select.unavailableHint':
    'Сохранённый вариант {value} больше недоступен. Выберите другой.',
  'combobox.search': 'Поиск',
  'combobox.empty': 'Ничего не найдено',
  'combobox.clear': 'Сбросить выбор',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Укажите дату',
  'datePicker.clear': 'Убрать дату',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Укажите даты',
  'dateRange.clear': 'Убрать даты',
  'dateRange.presets': 'Быстрые периоды',
  'dateRange.preset.week': 'Ближайшие 7 дней',
  'dateRange.preset.fortnight': 'Ближайшие 2 недели',
  'dateRange.preset.month': 'Ближайшие 30 дней',
  'dateRange.value': '{start} — {end}',
  'dateRange.valuePending': 'с {start} — …',
  'dateRange.nights': {
    one: '{nights} ночь',
    few: '{nights} ночи',
    many: '{nights} ночей',
    other: '{nights} ночи',
  },
  'dateRange.nightsSelected': {
    one: 'выбрана {nights} ночь',
    few: 'выбрано {nights} ночи',
    many: 'выбрано {nights} ночей',
    other: 'выбрано {nights} ночи',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Постраничная навигация',
  'pagination.first': 'Первая страница',
  'pagination.previous': 'Предыдущая страница',
  'pagination.next': 'Следующая страница',
  'pagination.last': 'Последняя страница',
  'pagination.page': 'Страница {page}',
  'pagination.current': 'Страница {page} из {pageCount}',
  'pagination.summary': 'Показано {from}–{to} из {total}',
} satisfies TranslationOf<typeof En>

export default messages
