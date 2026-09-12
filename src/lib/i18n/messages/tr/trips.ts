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
  'plan.day.empty': 'Henüz plan yok — buraya bir yer veya not sürükle',
  'plan.move.refused.duplicate': '{name} o günde zaten var',
  'plan.move.refused.duplicateBody': 'Bir yer bir günde yalnızca bir kez yer alabilir. Onu başka bir güne taşıyın.',
  'plan.move.refused.notInIdeas': 'Not günün içinde kalır',
  'plan.move.refused.notInIdeasBody': 'Fikirler bir gün bekleyen yerlerdir. Not, yazıldığı güne aittir.',
  'plan.move.refused.notInAnotherDay': 'Not kendi gününde kalır',
  'plan.move.refused.notInAnotherDayBody': 'Notlar henüz günler arasında taşınamıyor. Notu düzenleyin ya da diğer güne yazın.',
  'plan.move.refused.journeyNotInIdeas': 'Yolculuk günün içinde kalır',
  'plan.move.refused.journeyNotInIdeasBody': 'Fikirler bir gün bekleyen yerlerdir. Yolculuk, gerçekleştiği güne aittir.',
  'plan.move.refused.journeyNotInAnotherDay': 'Yolculuk kendi gününde kalır',
  'plan.move.refused.journeyNotInAnotherDayBody': 'Bir yolculuğun günü tarihlerinden gelir. Bunları Yolculuklar sekmesinde değiştirin.',
  'plan.move.refused.journeyTimed': '{name} {time} kalkıyor',
  'plan.move.refused.journeyTimedBody': 'Kalkış saati tarifenin, planın değil. Yolculuğu saatinin gösterdiği yere koyun.',
  'plan.move.spoken.duplicate': '{name} taşınmadı. O günde zaten var.',
  'plan.move.spoken.notInIdeas': '{name} taşınmadı. Not günün içinde kalır.',
  'plan.move.spoken.notInAnotherDay': '{name} taşınmadı. Not kendi gününde kalır.',
  'plan.move.spoken.timed': '{name} öğesinde {time} var. Saati bırakalım mı diye soruyoruz.',
  'plan.move.spoken.journeyNotInIdeas': '{name} taşınmadı. Yolculuk günün içinde kalır.',
  'plan.move.spoken.journeyNotInAnotherDay': '{name} taşınmadı. Yolculuk kendi gününde kalır.',
  'plan.move.spoken.journeyTimed': '{name} taşınmadı. {time} kalkıyor.',
  'plan.move.error.save': 'Bu taşıma kaydedilmedi',
  'plan.move.error.retry': 'Birazdan tekrar deneyin.',
  'plan.move.dropTime.title': '{name} taşınsın ve {time} kaldırılsın mı?',
  'plan.move.dropTime.body': 'Bu konum üzerindeki saatle çelişiyor. Buraya taşımak saati siler — yeni sıra ile silinen saat birlikte kaydedilir.',
  'plan.move.dropTime.confirm': 'Taşı ve saati kaldır',
  'plan.move.dropTime.cancel': 'Olduğu yerde kalsın',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Not ekle',
  'plan.note.addForDay': 'Not ekle: {day}',
  'plan.note.showMore': 'Daha fazla göster',
  'plan.note.showLess': 'Daha az göster',
  'plan.note.moveUp': 'Yukarı taşı',
  'plan.note.moveDown': 'Aşağı taşı',
  'plan.note.drag': 'Notu yeniden sırala',
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
  'plan.transport.phase.flight.departing': 'Kalkış',
  'plan.transport.phase.flight.travelling': 'Havada',
  'plan.transport.phase.flight.arriving': 'İniş',
  'plan.transport.phase.hire.departing': 'Teslim alma',
  'plan.transport.phase.hire.travelling': 'Kirada',
  'plan.transport.phase.hire.arriving': 'Teslim etme',
  'plan.transport.phase.journey.departing': 'Başlangıç',
  'plan.transport.phase.journey.travelling': 'Yolda',
  'plan.transport.phase.journey.arriving': 'Bitiş',
  'plan.transport.label': '{from} – {to} arası',
  'plan.transport.drag': 'Sırayı değiştir: {journey}',
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
