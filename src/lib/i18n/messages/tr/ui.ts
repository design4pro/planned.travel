/**
 * The design system's own copy, in Turkish.
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
 * **Two branches that say the same thing.** Turkish takes the singular after a
 * numeral — «3 gece», never «3 geceler» — so `one` and `other` are deliberately
 * identical wherever a number precedes the noun. `Intl.PluralRules` still
 * reports both categories for `tr`, and the gate requires both to be present.
 *
 * **Patterns.** Where English holds only placeholders and punctuation, Turkish
 * convention decides: a range takes the short dash rather than the en dash, a
 * date reads day, month, year and then the weekday, and the overflow marker sits
 * on the side opposite the English one, which is the only difference a
 * two-character pattern can carry.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Temizle',
  'action.close': 'Kapat',
  'action.dismiss': 'Yoksay',
  'action.remove': 'Kaldır',
  'action.undo': 'Geri al',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Yükleniyor',
  'status.working': 'İşleniyor',
  'status.searching': 'Aranıyor',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} çevrimiçi',
  'avatar.status.away': '{name} klavyeden uzakta',
  'avatar.status.busy': '{name} meşgul',
  'avatar.status.offline': '{name} çevrimdışı',
  'avatar.overflow': {
    one: '{others} kişi daha',
    other: '{others} kişi daha',
  },
  'avatar.more': '{hidden}+',

  /* --------------------------------------------------------------- badge */
  'badge.overflow': '+{max}',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Bir tarih seçin',
  'calendar.label.range': 'Tarih aralığı seçin',
  'calendar.previousMonth': 'Önceki ay',
  'calendar.nextMonth': 'Sonraki ay',
  'calendar.monthYear': '{year} {month}',
  'calendar.grid': '{label} — {month}',
  'calendar.showing': '{months} gösteriliyor',
  'calendar.day': '{day} {month} {year}, {weekday}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Seçin…',
  'select.unavailable': 'Kullanılamıyor: {value}',
  'select.unavailableHint':
    'Kayıtlı {value} seçimi artık kullanılamıyor. Başka birini seçin.',
  'combobox.search': 'Ara',
  'combobox.empty': 'Eşleşme yok',
  'combobox.clear': 'Seçimi temizle',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Tarih belirleyin',
  'datePicker.clear': 'Tarihi temizle',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Tarihleri belirleyin',
  'dateRange.clear': 'Tarihleri temizle',
  'dateRange.presets': 'Hazır aralıklar',
  'dateRange.preset.week': 'Önümüzdeki 7 gün',
  'dateRange.preset.fortnight': 'Önümüzdeki 2 hafta',
  'dateRange.preset.month': 'Önümüzdeki 30 gün',
  'dateRange.value': '{start} - {end}',
  'dateRange.valuePending': '{start} - …',
  'dateRange.nights': {
    one: '{nights} gece',
    other: '{nights} gece',
  },
  'dateRange.nightsSelected': {
    one: '{nights} gece seçildi',
    other: '{nights} gece seçildi',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Sayfalama',
  'pagination.first': 'İlk sayfa',
  'pagination.previous': 'Önceki sayfa',
  'pagination.next': 'Sonraki sayfa',
  'pagination.last': 'Son sayfa',
  'pagination.page': '{page}. sayfa',
  'pagination.current': 'Sayfa {page} / {pageCount}',
  'pagination.summary': '{total} kaydın {from}–{to} arası gösteriliyor',
} satisfies TranslationOf<typeof En>

export default messages
