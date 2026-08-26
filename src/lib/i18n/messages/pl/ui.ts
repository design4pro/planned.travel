/**
 * The design system's own copy, in Polish.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `Intl.PluralRules('pl')` reports `one` · `few` · `many` ·
 * `other`: `one` is exactly 1, `few` is 2–4 (and 22–24, 32–34 …), `many` is 0
 * and 5–21, and `other` is reached only by a fraction — which is why every
 * `other` branch below carries the genitive singular a decimal takes
 * ("1,5 nocy").
 *
 * **Typography.** Polish sets a range with a closed-up en dash ("12–14 maja"),
 * not a spaced em dash, and it quotes with „…”. Both differ from the English
 * source on purpose.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Wyczyść',
  'action.close': 'Zamknij',
  'action.dismiss': 'Ukryj',
  'action.remove': 'Usuń',
  'action.undo': 'Cofnij',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Wczytywanie',
  'status.working': 'Przetwarzanie',
  'status.searching': 'Szukanie',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} jest w sieci',
  'avatar.status.away': '{name} zaraz wraca',
  'avatar.status.busy': '{name}: nie przeszkadzać',
  'avatar.status.offline': '{name} jest offline',
  'avatar.overflow': {
    one: '{others} inna osoba',
    few: '{others} inne osoby',
    many: '{others} innych osób',
    other: '{others} innej osoby',
  },
  /**
   * The face at the end of a crowded stack. `+3` reads "three more", and Polish
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
  'calendar.label.date': 'Wybierz datę',
  'calendar.label.range': 'Wybierz zakres dat',
  'calendar.previousMonth': 'Poprzedni miesiąc',
  'calendar.nextMonth': 'Następny miesiąc',
  /** Polish writes a year in prose with the `r.` marker: „styczeń 2026 r.”. */
  'calendar.monthYear': '{month} {year} r.',
  'calendar.grid': '{month} – {label}',
  'calendar.showing': 'Widoczne: {months}',
  /**
   * Commas rather than a bare sequence: the frozen CLDR table holds the
   * nominative month ("styczeń"), and Polish would want the genitive
   * ("12 stycznia") in a running date. A list reads correctly in speech
   * without inventing a case the table does not carry.
   */
  'calendar.day': '{weekday}, {day}, {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Wybierz…',
  'select.unavailable': 'Niedostępne: {value}',
  'select.unavailableHint':
    'Zapisany wybór {value} nie jest już dostępny. Wskaż inny.',
  'combobox.search': 'Szukaj',
  'combobox.empty': 'Brak wyników',
  'combobox.clear': 'Wyczyść wybór',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Wskaż datę',
  'datePicker.clear': 'Usuń datę',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Wskaż daty',
  'dateRange.clear': 'Usuń daty',
  'dateRange.presets': 'Szybkie zakresy',
  'dateRange.preset.week': 'Najbliższe 7 dni',
  'dateRange.preset.fortnight': 'Najbliższe 2 tygodnie',
  'dateRange.preset.month': 'Najbliższe 30 dni',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'od {start} – …',
  'dateRange.nights': {
    one: '{nights} noc',
    few: '{nights} noce',
    many: '{nights} nocy',
    other: '{nights} nocy',
  },
  'dateRange.nightsSelected': {
    one: 'wybrano {nights} noc',
    few: 'wybrano {nights} noce',
    many: 'wybrano {nights} nocy',
    other: 'wybrano {nights} nocy',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Podział na strony',
  'pagination.first': 'Pierwsza strona',
  'pagination.previous': 'Poprzednia strona',
  'pagination.next': 'Następna strona',
  'pagination.last': 'Ostatnia strona',
  'pagination.page': 'Strona {page}',
  'pagination.current': 'Strona {page} z {pageCount}',
  'pagination.summary': 'Widoczne {from}–{to} z {total}',
} satisfies TranslationOf<typeof En>

export default messages
