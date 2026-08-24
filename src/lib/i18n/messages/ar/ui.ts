/**
 * The design system's own copy, in Arabic.
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
 * **Six branches.** `ar` has the widest grammar in the set: `Intl.PluralRules`
 * reports zero, one, two, few, many and other, and the gate requires all six.
 * The forms follow Arabic number agreement — 1 takes the singular, 2 the dual,
 * 3–10 the broken plural, 11–99 the accusative singular and 100 upwards the
 * singular again — so `one` and `two` carry the noun alone where a numeral
 * beside the dual would read as a stutter. The union of placeholders across the
 * branches is what the gate compares, so a branch may leave `{nights}` out.
 *
 * **Patterns.** Three keys hold only placeholders and punctuation in English.
 * Arabic convention decides them here: CLDR's Arabic date patterns set an
 * Arabic comma before the year, ranges read "from … to …" rather than taking a
 * dash, and the overflow marker sits on the side opposite the English one so a
 * bidi-isolated badge still reads the way Arabic writes it.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'مسح',
  'action.close': 'إغلاق',
  'action.dismiss': 'تجاهل',
  'action.remove': 'إزالة',
  'action.undo': 'تراجع',

  /* -------------------------------------------------------------- status */
  'status.loading': 'جارٍ التحميل',
  'status.working': 'جارٍ التنفيذ',
  'status.searching': 'جارٍ البحث',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} متصل الآن',
  'avatar.status.away': '{name} بعيد عن الشاشة',
  'avatar.status.busy': '{name} مشغول',
  'avatar.status.offline': '{name} غير متصل',
  'avatar.overflow': {
    zero: '{others} آخرين',
    one: 'شخص آخر',
    two: 'شخصان آخران',
    few: '{others} آخرين',
    many: '{others} آخر',
    other: '{others} آخر',
  },
  /**
   * The only message in this catalogue whose token order deliberately differs
   * from English, and it differs so that the two render the SAME.
   *
   * The overflow face in `src/components/ui/avatar-stack.tsx` is a bare span:
   * unlike the count badge below it carries no `data-numeric`, so it inherits
   * `dir="rtl"` and the bidi algorithm reorders the run. Measured in Chromium
   * against the built stylesheet, with the component's own markup: a logical
   * `+{hidden}` paints as `2+`, and a logical `{hidden}+` paints as `+2`. The
   * mark English puts before the number therefore has to be written after it
   * to arrive before it — `+2`, "two more faces", not `2+`, "two or more".
   *
   * If that span is ever isolated the way the badge is, this flips back to
   * `+{hidden}` on the same day.
   */
  'avatar.more': '{hidden}+',

  /* --------------------------------------------------------------- badge */
  /**
   * Not the mirror image of `avatar.more`, because the count badge DOES carry
   * `data-numeric`, and `src/styles/styles.css` pins that to `direction: ltr;
   * unicode-bidi: isolate`. Inside an isolate the logical order is the painted
   * order, so `+{max}` would genuinely paint `+99` — "ninety-nine arrived"
   * rather than "ninety-nine or more". Arabic writes the cap exactly as
   * English does. Measured in the same probe: logical `99+` paints `99+`.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'اختر تاريخًا',
  'calendar.label.range': 'اختر فترة زمنية',
  'calendar.previousMonth': 'الشهر السابق',
  'calendar.nextMonth': 'الشهر التالي',
  'calendar.monthYear': '{month}، {year}',
  'calendar.grid': '{label} — {month}',
  'calendar.showing': 'يُعرض {months}',
  'calendar.day': '{weekday}، {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'اختر…',
  'select.unavailable': 'غير متاح: {value}',
  'select.unavailableHint': 'الخيار المحفوظ {value} لم يعد متاحًا. اختر غيره.',
  'combobox.search': 'بحث',
  'combobox.empty': 'لا نتائج مطابقة',
  'combobox.clear': 'إلغاء الاختيار',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'حدّد تاريخًا',
  'datePicker.clear': 'مسح التاريخ',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'حدّد التاريخين',
  'dateRange.clear': 'مسح التاريخين',
  'dateRange.presets': 'فترات جاهزة',
  'dateRange.preset.week': 'الأيام السبعة القادمة',
  'dateRange.preset.fortnight': 'الأسبوعان القادمان',
  'dateRange.preset.month': 'الثلاثون يومًا القادمة',
  'dateRange.value': 'من {start} إلى {end}',
  'dateRange.valuePending': 'من {start} إلى …',
  'dateRange.nights': {
    zero: '{nights} ليلة',
    one: 'ليلة واحدة',
    two: 'ليلتان',
    few: '{nights} ليال',
    many: '{nights} ليلة',
    other: '{nights} ليلة',
  },
  'dateRange.nightsSelected': {
    zero: 'لم تُحدَّد أي ليلة',
    one: 'ليلة واحدة محددة',
    two: 'ليلتان محددتان',
    few: '{nights} ليال محددة',
    many: '{nights} ليلة محددة',
    other: '{nights} ليلة محددة',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'ترقيم الصفحات',
  'pagination.first': 'الصفحة الأولى',
  'pagination.previous': 'الصفحة السابقة',
  'pagination.next': 'الصفحة التالية',
  'pagination.last': 'الصفحة الأخيرة',
  'pagination.page': 'الصفحة {page}',
  'pagination.current': 'الصفحة {page} من {pageCount}',
  'pagination.summary': 'يُعرض {from}–{to} من {total}',
} satisfies TranslationOf<typeof En>

export default messages
