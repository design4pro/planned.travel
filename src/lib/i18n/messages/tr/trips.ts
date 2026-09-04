/**
 * The trip tabs' own copy, in tr.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Çoğul.** `one` · `other`; Türkçede sayıdan sonra ad çoğul eki almaz.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Bu gezi yüklenemedi',
  'error.plan': 'Program yüklenemedi',
  'error.costs': 'Masraflar yüklenemedi',
  'error.collab': 'Sohbet yüklenemedi',
  'error.book': 'Rezervasyonlar yüklenemedi',
  'error.transports': 'Yolculuklar yüklenemedi',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Program',
  'plan.places': 'Yerler',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Birlikte',
  'collab.empty': 'Henüz bir şey paylaşılmadı',
  'collab.conversation': 'Sohbet',
  'collab.count.messages': {
    one: '{messages} mesaj',
    other: '{messages} mesaj',
  },
  'collab.count.notes': {
    one: '{notes} not',
    other: '{notes} not',
  },
  'collab.count.polls': {
    one: '{polls} anket',
    other: '{polls} anket',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Rezervasyonlar',
  'book.empty': 'Henüz rezervasyon yok',
  'book.count.bookings': {
    one: '{bookings} rezervasyon',
    other: '{bookings} rezervasyon',
  },
  'book.count.confirmed': {
    one: '{confirmed} onaylandı',
    other: '{confirmed} onaylandı',
  },
  'book.progressLabel': {
    one: '{total} rezervasyondan {confirmed} tanesi onaylandı',
    other: '{total} rezervasyondan {confirmed} tanesi onaylandı',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': 'Onaylandı',
  'book.awaiting': 'Onay bekliyor',
  'book.nothingHanging': 'Bekleyen yok',
  'book.chase': 'Uçmadan önce halledin',
  'book.committed': 'Bağlanan tutar',
  'book.committedCaption': 'Bu gezinin tüm rezervasyonlarında',
  'book.onItinerary': 'Programda',
  'book.pinnedCaption': 'Programın bir gününe sabitlendi',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Yolculuklar',
  'transports.empty': 'Henüz bir kayıt yok',
  'transports.count.transports': {
    one: '{transports} yolculuk',
    other: '{transports} yolculuk',
  },
  'transports.distance': 'Kat edilen mesafe',
  'transports.equator': '≈ {times}× ekvator turu',
  'transports.noGrouping': 'Henüz gruplanan yok',
  'transports.mostly': 'çoğunlukla {mode}',
  'transports.confirmed': 'Onaylandı',
  'transports.stillPending': {
    one: '{pending} hâlâ bekliyor',
    other: '{pending} hâlâ bekliyor',
  },
  'transports.spent': 'Yolculuğa harcanan',
  'transports.noPrices': 'Kayıtlı fiyat yok',
  'transports.priced': {
    one: 'fiyatı girilmiş {priced} yolculukta',
    other: 'fiyatı girilmiş {priced} yolculukta',
  },
} satisfies TranslationOf<typeof En>

export default messages
