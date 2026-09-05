/**
 * The trip tabs' own copy, in ar.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **الجمع.** ستة فروع كما تقتضي قواعد CLDR للعربية. **الاتجاه.** من اليمين إلى اليسار.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'تعذّر تحميل هذه الرحلة',
  'error.plan': 'تعذّر تحميل البرنامج',
  'error.costs': 'تعذّر تحميل النفقات',
  'error.collab': 'تعذّر تحميل المحادثة',
  'error.book': 'تعذّر تحميل الحجوزات',
  'error.transports': 'لم تُحمَّل التنقلات',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'البرنامج',
  'plan.places': 'الأماكن',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'معًا',
  'collab.empty': 'لم تتم مشاركة أي شيء بعد',
  'collab.conversation': 'المحادثة',
  'collab.count.messages': {
    zero: '{messages} رسالة',
    one: '{messages} رسالة',
    two: '{messages} رسالتان',
    few: '{messages} رسائل',
    many: '{messages} رسالة',
    other: '{messages} رسالة',
  },
  'collab.count.notes': {
    zero: '{notes} ملاحظة',
    one: '{notes} ملاحظة',
    two: '{notes} ملاحظتان',
    few: '{notes} ملاحظات',
    many: '{notes} ملاحظة',
    other: '{notes} ملاحظة',
  },
  'collab.count.polls': {
    zero: '{polls} استطلاع',
    one: '{polls} استطلاع',
    two: '{polls} استطلاعان',
    few: '{polls} استطلاعات',
    many: '{polls} استطلاعًا',
    other: '{polls} استطلاع',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'الحجوزات',
  'book.empty': 'لم يُحجز أي شيء بعد',
  'book.count.bookings': {
    zero: '{bookings} حجز',
    one: '{bookings} حجز',
    two: '{bookings} حجزان',
    few: '{bookings} حجوزات',
    many: '{bookings} حجزًا',
    other: '{bookings} حجز',
  },
  'book.count.confirmed': {
    zero: '{confirmed} مؤكَّد',
    one: '{confirmed} مؤكَّد',
    two: '{confirmed} مؤكَّدان',
    few: '{confirmed} مؤكَّدة',
    many: '{confirmed} مؤكَّدًا',
    other: '{confirmed} مؤكَّد',
  },
  'book.progressLabel': {
    zero: 'تأكيد {confirmed} من {total} حجز',
    one: 'تأكيد {confirmed} من {total} حجز',
    two: 'تأكيد {confirmed} من {total} حجزين',
    few: 'تأكيد {confirmed} من {total} حجوزات',
    many: 'تأكيد {confirmed} من {total} حجزًا',
    other: 'تأكيد {confirmed} من {total} حجز',
  },
  'book.ofTotal': 'من {total}',
  'book.confirmed': 'مؤكَّدة',
  'book.awaiting': 'بانتظار التأكيد',
  'book.nothingHanging': 'لا شيء معلّق',
  'book.chase': 'تابعها قبل السفر',
  'book.committed': 'ملتزَم به',
  'book.committedCaption': 'عبر كل حجوزات هذه الرحلة',
  'book.onItinerary': 'في البرنامج',
  'book.pinnedCaption': 'مثبَّت على يوم من البرنامج',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'التنقلات',
  'transports.empty': 'لا شيء مسجَّل بعد',
  'transports.count.transports': {
    zero: '{transports} تنقل',
    one: '{transports} تنقل',
    two: '{transports} تنقلان',
    few: '{transports} تنقلات',
    many: '{transports} تنقلًا',
    other: '{transports} تنقل',
  },
  'transports.distance': 'المسافة المقطوعة',
  'transports.equator': '≈ {times}× حول خط الاستواء',
  'transports.noGrouping': 'لا تجميع بعد',
  'transports.mostly': 'غالبًا {mode}',
  'transports.confirmed': 'مؤكَّد',
  'transports.stillPending': {
    zero: '{pending} ما زال معلَّقًا',
    one: '{pending} ما زال معلَّقًا',
    two: '{pending} ما زالا معلَّقين',
    few: '{pending} ما زالت معلَّقة',
    many: '{pending} ما زالت معلَّقة',
    other: '{pending} ما زالت معلَّقة',
  },
  'transports.spent': 'المصروف على السفر',
  'transports.noPrices': 'لا أسعار مسجَّلة',
  'transports.priced': {
    zero: 'عبر {priced} تنقل مسعَّر',
    one: 'عبر {priced} تنقل مسعَّر',
    two: 'عبر {priced} تنقلين مسعَّرين',
    few: 'عبر {priced} تنقلات مسعَّرة',
    many: 'عبر {priced} تنقلًا مسعَّرًا',
    other: 'عبر {priced} تنقل مسعَّر',
  },
} satisfies TranslationOf<typeof En>

export default messages
