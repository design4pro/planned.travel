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
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Not ekle',
  'plan.note.addForDay': 'Bu güne not ekle',
  'plan.note.showMore': 'Daha fazla göster',
  'plan.note.showLess': 'Daha az göster',
  'plan.note.moveUp': 'Yukarı taşı',
  'plan.note.moveDown': 'Aşağı taşı',
  'plan.note.edit': 'Notu düzenle',
  'plan.note.delete': 'Notu sil',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Not ekle',
  'plan.note.dialog.editTitle': 'Notu düzenle',
  'plan.note.field.body': 'Not',
  'plan.note.field.bodyHint': 'Tek satır. Günde görünen budur.',
  'plan.note.field.detail': 'Ayrıntılar',
  'plan.note.field.detailHint':
    'Başlıklar, listeler, bağlantılar, alıntılar, kod ve tablolar.',
  'plan.note.field.time': 'Saat',
  'plan.note.field.timeHint': 'İsteğe bağlı, 24 saat biçiminde.',
  'plan.note.field.icon': 'Simge',
  'plan.note.tab.write': 'Yaz',
  'plan.note.tab.preview': 'Önizleme',
  'plan.note.previewEmpty': 'Henüz önizlenecek bir şey yok',
  'plan.note.save': 'Notu kaydet',
  'plan.note.cancel': 'Vazgeç',
  'plan.note.confirmDelete': 'Bu not silinsin mi?',
  'plan.note.confirmDeleteBody': 'Not ve ayrıntıları bu günden kaldırılır.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Not eklendi',
  'plan.note.toast.updated': 'Not kaydedildi',
  'plan.note.toast.deleted': 'Not silindi',
  'plan.note.error.save': 'Not kaydedilmedi',
  'plan.note.error.delete': 'Not silinemedi',
  'plan.note.error.move': 'Bu taşıma kaydedilmedi',
  'plan.note.error.retry': 'Birazdan tekrar deneyin.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Hatırlatma',
  'plan.note.icon.clock': 'Saat',
  'plan.note.icon.flashlight': 'El feneri',
  'plan.note.icon.footprints': 'Yürüyüş',
  'plan.note.icon.info': 'Bilgi',
  'plan.note.icon.luggage': 'Bagaj',
  'plan.note.icon.package': 'Paket',
  'plan.note.icon.ticket': 'Biletler',
  'plan.note.icon.trainFront': 'Tren',
  'plan.note.icon.wifi': 'İnternet',
  'plan.note.icon.stickyNote': 'Not',
  'plan.note.icon.utensils': 'Yemek',
  'plan.note.icon.bus': 'Ulaşım',
  'plan.note.icon.bedDouble': 'Konaklama',
  'plan.note.icon.camera': 'Fotoğraf',
  'plan.note.icon.mapPin': 'Yer',
  'plan.note.icon.wallet': 'Para',
  'plan.note.icon.umbrella': 'Yağmur',
  'plan.note.icon.triangleAlert': 'Uyarı',
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
