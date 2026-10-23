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
  'notFound.title': 'Bu seyahati bulamıyoruz',
  'notFound.body':
    'Mevcut çalışma alanında açabileceğin seyahatler arasında değil. Silinmiş olabilir veya erişim iznin olmayabilir.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Bu geziye yer ekle',
  'plan.editor.editTitle': 'Bu yeri düzenle',
  'plan.editor.createDescription':
    'Şimdi bir ad verin, konumu sonra belirleyin - planlanmamış bir yer, bir güne eklenene kadar yerler panelinde bekler.',
  'plan.editor.editDescription':
    'Değişiklikler her yerde geçerlidir: haritada, atanan tüm günlerde ve gezinin yer listesinde.',
  'plan.editor.nameRequired': 'Yerin bir adı olmalı',
  'plan.editor.nameExample': 'ör. Fushimi Inari Taisha',
  'plan.editor.city': 'Şehir',
  'plan.editor.cityExample': 'ör. Kyoto',
  'plan.editor.addressExample': 'ör. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Orada geçirilecek süre',
  'plan.editor.rating': 'Gitmeye değer mi?',
  'plan.editor.latitude': 'Enlem',
  'plan.editor.longitude': 'Boylam',
  'plan.editor.positionHint': 'Veya kapatıp haritada noktayı seçin.',
  'plan.editor.latitudeError': '-90 ile 90 arasında',
  'plan.editor.longitudeError': '-180 ile 180 arasında',
  'plan.editor.positionError': 'Konum için iki sayı da gerekli',
  'plan.editor.day': 'Bir güne ekle',
  'plan.editor.dayHint': 'Yerler panelinde tutmak için boş bırakın.',
  'plan.editor.unplanned': 'Planlamadan bırak',
  'plan.editor.dayNamed': '{day}. gün · {title}',
  'plan.editor.stopFallback': 'Bu durak',
  'plan.editor.dayNumber': '{day}. gün',
  'plan.editor.visited': 'Zaten ziyaret edildi',
  'plan.editor.visitedHint': 'İğneyi bir onay işaretiyle işaretler.',
  'plan.editor.saving': 'Yer kaydediliyor',
  'plan.editor.save': 'Değişiklikleri kaydet',
  'plan.editor.noCategory': 'Kategori yok',
  'plan.editor.arrive': 'Varış',
  'plan.editor.leave': 'Ayrılış',
  'plan.editor.timeError': 'Ayrılış varıştan sonra olmalı',
  'plan.editor.booking': 'Rezervasyon',
  'plan.editor.note': 'Bu durak için not',
  'plan.editor.noteExample':
    'Erken gidin - sabah 9’dan sonra kuyruk bir saat sürer.',
  'plan.editor.savingTimes': 'Saatler kaydediliyor',
  'plan.editor.saveTimes': 'Kaydet',
  'plan.editor.duration0': 'Sabit süre yok',
  'plan.editor.duration30': '30 dakika',
  'plan.editor.duration45': '45 dakika',
  'plan.editor.duration60': '1 saat',
  'plan.editor.duration90': '1½ saat',
  'plan.editor.duration120': '2 saat',
  'plan.editor.duration180': '3 saat',
  'plan.editor.duration240': 'Yarım gün',
  'plan.editor.duration480': 'Tam gün',
  'plan.editor.rating0': 'Puan verilmedi',
  'plan.editor.rating1': '★ 1 - atla',
  'plan.editor.rating2': '★ 2 - zaman varsa',
  'plan.editor.rating3': '★ 3 - değer',
  'plan.editor.rating4': '★ 4 - çok iyi',
  'plan.editor.rating5': '★ 5 - kaçırma',
  'plan.editor.bookingNone': 'Rezervasyon gerekmiyor',
  'plan.editor.bookingPending': 'Rezervasyon yapılacak',
  'plan.editor.bookingConfirmed': 'Rezerve edildi ve onaylandı',
  'plan.editor.bookingCompleted': 'Ziyaret tamamlandı',
  'plan.editor.bookingCancelled': 'İptal edildi',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Bu gezi yüklenemedi',
  'error.plan': 'Program yüklenemedi',
  'error.costs': 'Masraflar yüklenemedi',
  'error.collab': 'Sohbet yüklenemedi',
  'error.book': 'Rezervasyonlar yüklenemedi',
  'error.transports': 'Yolculuklar yüklenemedi',
  'error.people': 'Kişiler yüklenemedi',
  'header.length': {
    one: '{days} gün',
    other: '{days} gün',
  },
  'header.planned': {
    one: '{days} gün planlandı',
    other: '{days} gün planlandı',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Program',
  'plan.places': 'Yerler',
  'plan.readOnly.archived':
    'Bu seyahat arşivlendi, bu yüzden plan salt okunur.',
  'plan.readOnly.role':
    'Bu planı görüntüleyebilirsiniz. Yalnızca seyahatin sahibi ve düzenleyiciler değiştirebilir.',
  'plan.day.empty': 'Henüz plan yok — buraya bir yer veya not sürükle',
  'plan.move.refused.duplicate': '{name} o günde zaten var',
  'plan.move.refused.duplicateBody':
    'Bir yer bir günde yalnızca bir kez yer alabilir. Onu başka bir güne taşıyın.',
  'plan.move.refused.notInIdeas': 'Not günün içinde kalır',
  'plan.move.refused.notInIdeasBody':
    'Fikirler bir gün bekleyen yerlerdir. Not her zaman bir güne aittir.',
  'plan.move.refused.journeyNotInIdeas': 'Yolculuk günün içinde kalır',
  'plan.move.refused.journeyNotInIdeasBody':
    'Fikirler bir gün bekleyen yerlerdir. Yolculuk, gerçekleştiği güne aittir.',
  'plan.move.refused.journeyNotInAnotherDay': 'Yolculuk kendi gününde kalır',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Bir yolculuğun günü tarihlerinden gelir. Bunları Yolculuklar sekmesinde değiştirin.',
  'plan.move.refused.journeyTimed': '{name} {time} kalkıyor',
  'plan.move.refused.journeyTimedBody':
    'Kalkış saati tarifenin, planın değil. Yolculuğu saatinin gösterdiği yere koyun.',
  'plan.move.spoken.duplicate': '{name} taşınmadı. O günde zaten var.',
  'plan.move.spoken.notInIdeas': '{name} taşınmadı. Not günün içinde kalır.',
  'plan.move.spoken.timed':
    '{name} öğesinde {time} var. Saati bırakalım mı diye soruyoruz.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} taşınmadı. Yolculuk günün içinde kalır.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} taşınmadı. Yolculuk kendi gününde kalır.',
  'plan.move.spoken.journeyTimed': '{name} taşınmadı. {time} kalkıyor.',
  'plan.move.error.save': 'Bu taşıma kaydedilmedi',
  'plan.move.error.retry': 'Birazdan tekrar deneyin.',
  'plan.move.dropTime.title': '{name} taşınsın ve {time} kaldırılsın mı?',
  'plan.move.dropTime.body':
    'Bu konum üzerindeki saatle çelişiyor. Buraya taşımak saati siler — yeni sıra ile silinen saat birlikte kaydedilir.',
  'plan.move.dropTime.confirm': 'Taşı ve saati kaldır',
  'plan.move.dropTime.cancel': 'Olduğu yerde kalsın',
  /* ------------------------------------------- a stop's menu and its delete */
  'plan.stop.menu.editPlace': 'Yeri düzenle',
  'plan.stop.menu.setTime': 'Saat belirle',
  'plan.stop.menu.placeOnMap': 'Haritaya yerleştir',
  'plan.stop.menu.movePin': 'İğnesini taşı',
  'plan.stop.menu.moveToDay': 'Başka bir güne taşı',
  'plan.stop.menu.backToUnplanned': 'Planlanmamışlara geri al',
  'plan.stop.menu.delete': 'Geziden sil',
  'plan.delete.title': '{name} silinsin mi?',
  'plan.delete.bodyUnplanned':
    'Gezinin yerlerinden tamamen kalkar. Bu işlem geri alınamaz.',
  'plan.delete.bodyOnDays': {
    one: 'Bu gezinin {count} gününde yer alıyor ve o günden kalkar. Bu işlem geri alınamaz.',
    other:
      'Bu gezinin {count} gününde yer alıyor ve hepsinden kalkar. Bu işlem geri alınamaz.',
  },
  'plan.delete.error': 'Silinemedi',
  'plan.delete.confirm': 'Yeri sil',
  'plan.delete.deleting': 'Yer siliniyor',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Not ekle',
  'plan.note.addForDay': 'Not ekle: {day}',
  'plan.addPlace.label': 'Yer ekle',
  'plan.addPlace.more': 'Yer eklemenin diğer yolları',
  'plan.addPlace.option.map': 'Haritaya yerleştir',
  'plan.addPlace.forDayNamed': 'Yer ekle: {day}',
  'plan.addPlace.quota':
    'Planınızdaki yer sınırına ulaştınız. Daha fazla eklemek için planınızı yükseltin.',
  'plan.addPlace.quotaAction': 'Planları gör',
  'plan.stay.checkIn': 'Giriş',
  'plan.stay.checkOut': 'Çıkış',
  'plan.day.addStay': 'Konaklama ekle: {day}',
  'plan.day.addStayShort': 'Konaklama ekle',
  'plan.handoff.stop':
    '{place} konumunu {service} içinde aç (yeni sekmede açılır)',
  'plan.handoff.day.directions': '{service} içinde yol tarifi',
  'plan.handoff.day.directionsName':
    '{service} içinde yol tarifi: {day} (yeni sekmede açılır)',
  'plan.handoff.day.directionsPartial':
    'Duraklar: {total} duraktan ilk {carried}',
  'plan.handoff.day.directionsPartialName':
    '{service} içinde yol tarifi: {day}, duraklar: {total} duraktan ilk {carried} (yeni sekmede açılır)',
  'plan.handoff.day.point': '{service} içinde göster',
  'plan.handoff.day.pointName':
    '{service} içinde göster: {day} için haritada konumu olan tek durak (yeni sekmede açılır)',
  'plan.drop.hint':
    'Tam oraya bir yer eklemek için haritaya sağ tıklayın veya basılı tutun.',
  'plan.drop.armed':
    'Haritada gideceği yere tıklayın ya da haritayı kaydırıp ortaya bırakmak için Enter tuşuna basın.',
  'plan.drop.stop': 'Yeni raptiye yerleştirmeyi durdur',
  'plan.drop.pin': 'Yeni yer',
  'plan.drop.lookingUp': 'Adres aranıyor…',
  'plan.drop.error': 'İğne bırakılamadı. Birazdan tekrar dene.',
  'plan.place.pastedPosition': 'Enlem {lat}, boylam {lng} olarak okundu',
  'plan.note.showMore': 'Daha fazla göster',
  'plan.note.showLess': 'Daha az göster',
  'plan.note.moveUp': 'Yukarı taşı',
  'plan.note.moveDown': 'Aşağı taşı',
  'plan.note.moveToDay': 'Başka bir güne taşı',
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
  'book.readOnly.archived':
    'Bu seyahat arşivlendi, bu yüzden rezervasyonlar ve konaklamalar salt okunur. Değiştirmek için seyahati geri yükleyin.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Bu değişiklik reddedildi. Başka değişiklikler yapmadan önce seyahatin güncel durumunu kontrol edin.',
  'transports.recovery.failed':
    'Seyahat yenilenemedi. Değişiklik yapmadan önce tekrar deneyin.',
  'transports.readOnly.archived':
    'Bu seyahat arşivlenmiş. Ulaşımı değiştirmek için geri yükleyin.',
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
  'people.title': 'Kişiler',
  'people.description': 'Bu gezide kimler var ve geziyi kimler bulabilir',
  'people.members.title': 'Bu gezide',
  'people.members.empty': 'Bu gezideki kimse artık bu çalışma alanında değil',
  'people.role.label': 'Rol',
  'people.role.owner': 'Sahip',
  'people.role.editor': 'Düzenleyici',
  'people.role.viewer': 'İzleyici',
  'people.you': 'Siz',
  'people.owner.hint': 'Bir gezide her zaman en az bir sahip kalır',
  'people.remove.action': '{name} kişisini bu geziden çıkar',
  'people.remove.title': '{name} kişisi bu geziden çıkarılsın mı?',
  'people.remove.body':
    'Programa erişimi hemen sona erer. Eklediği şeyler gezide kalır.',
  'people.remove.confirm': 'Çıkar',
  'people.leave.action': 'Bu geziden ayrıl',
  'people.leave.title': 'Bu geziden ayrılınsın mı?',
  'people.leave.body':
    'Gezideki biri sizi yeniden ekleyene kadar programa erişiminizi kaybedersiniz.',
  'people.leave.confirm': 'Ayrıl',
  'people.cancel': 'Vazgeç',
  'people.invite.title': 'Birini ekle',
  'people.invite.placeholder': 'Bu çalışma alanındaki kişileri ara',
  'people.invite.action': 'Geziye ekle',
  'people.invite.role': 'Şu rolle katılır',
  'people.invite.empty': 'Bu çalışma alanındaki herkes zaten bu gezide',
  'people.invite.emptyHint':
    'Önce yeni biri çalışma alanına katılır, Ayarlar’dan',
  'people.visibility.title': 'Bu geziyi kimler bulabilir',
  'people.visibility.switch': 'Çalışma alanındaki herkese görünür',
  'people.visibility.private':
    'Bu geziyi yalnızca burada listelenen kişiler görebilir',
  'people.visibility.organization':
    'Bu çalışma alanındaki herkes bu geziyi açabilir',
  'people.visibility.public':
    'Bu gezi herkese açık bir bağlantıyla paylaşılıyor',
  'people.error.lastOwner':
    'Bir gezide en az bir sahip kalır. Önce başka birini sahip yapın.',
  'people.error.notInWorkspace': 'Bu kişi bu çalışma alanında değil',
  'people.error.alreadyOnTrip': 'Bu kişi zaten bu seyahatte',
  'people.guests.title': 'Seninle seyahat edenler',
  'people.guests.description': 'Bu gezide hesabı olmayan kişiler',
  'people.guests.empty': 'Henüz kimse yok',
  'people.guests.emptyHint':
    'Misafir, seninle seyahat eden ve hesaba ihtiyacı olmayan biridir. Onu adıyla ekle.',
  'people.guest.badge': 'Misafir',
  'people.guest.add.label': 'Adı',
  'people.guest.add.placeholder': 'Elif',
  'people.guest.add.action': 'Misafir ekle',
  'people.guest.rename.action': '{name} adını değiştir',
  'people.guest.rename.title': '{name} adını değiştir',
  'people.guest.rename.confirm': 'Adını değiştir',
  'people.guest.remove.action': '{name} bu geziden çıkar',
  'people.guest.remove.title': '{name} bu geziden çıkarılsın mı?',
  'people.guest.remove.body':
    'Misafir kaldırılır. Gezide başka hiçbir şey değişmez.',
  'people.guest.remove.confirm': 'Çıkar',
  'people.guest.merge.action': '{name} artık…',
  'people.guest.merge.title': '{name} artık bu gezideki kişilerden biri',
  'people.guest.merge.body':
    '{name} kişisine atanan her şey seçtiğin kişiye geçer ve misafir kaldırılır. Bu işlem geri alınamaz.',
  'people.guest.merge.inherits':
    '{name} için atanan her şey {member} kişisine geçer.',
  'people.guest.merge.placeholder': 'Bu geziden birini seç',
  'people.guest.merge.confirm': 'Birleştir',
  'people.guest.merge.done': '{name} artık {member}',
  'people.guest.merge.nothingMoved': 'Bu kişiye henüz hiçbir şey atanmamıştı',
  'people.error.guestNameTaken': 'Bu gezide {name} adlı bir misafir zaten var',
  'people.error.guestLimit':
    'Bir gezide en fazla {limit} misafir olabilir; daha uzun bir liste katılımcı seçimini ve masraf paylaşımını okumayı zorlaştırır',
  'people.error.guestMergeTarget': 'Bu gezide zaten olan birini seç',
  'plan.weather.badge.forecast':
    'Tahmin: {condition}, en yüksek {max}, en düşük {min}',
  'plan.weather.badge.forecastNoCondition':
    'Tahmin: en yüksek {max}, en düşük {min}',
  'plan.weather.badge.unavailable': 'Bu gün için hava durumu kullanılamıyor',
  'plan.weather.badge.loading': 'Hava durumu yükleniyor',
  'plan.weather.badge.recorded': 'Kaydedilen: en yüksek {max}, en düşük {min}',
  'plan.weather.badge.recordedHigh': 'Kaydedilen: en yüksek {max}',
  'plan.weather.badge.recordedLow': 'Kaydedilen: en düşük {min}',
  'plan.weather.badge.estimate':
    'Yaklaşık değer: tipik en yüksek {max}, en düşük {min}',
  'plan.weather.badge.estimateHigh': 'Yaklaşık değer: tipik en yüksek {max}',
  'plan.weather.badge.estimateLow': 'Yaklaşık değer: tipik en düşük {min}',
  'plan.weather.badge.notYetRecorded': 'Henüz kaydedilmedi',
  'plan.weather.condition.clear': 'Açık',
  'plan.weather.condition.fair': 'Güzel',
  'plan.weather.condition.partlyCloudy': 'Parçalı bulutlu',
  'plan.weather.condition.cloudy': 'Bulutlu',
  'plan.weather.condition.fog': 'Sis',
  'plan.weather.condition.rain': 'Yağmur',
  'plan.weather.condition.heavyRain': 'Sağanak yağmur',
  'plan.weather.condition.sleet': 'Karla karışık yağmur',
  'plan.weather.condition.snow': 'Kar',
  'plan.weather.condition.thunder': 'Gök gürültülü fırtına',
  'plan.weather.panel.title': '{date} hava durumu',
  'plan.weather.panel.temperature': 'En yüksek / en düşük',
  'plan.weather.panel.precipitation': 'Yağış',
  'plan.weather.panel.precipitationTypical': 'Günlük tipik yağış',
  'plan.weather.panel.probability': '{percent} ihtimal',
  'plan.weather.panel.wind': 'Rüzgâr',
  'plan.weather.panel.sunrise': 'Gün doğumu',
  'plan.weather.panel.sunset': 'Gün batımı',
  'plan.weather.panel.noSunrise': 'Gün doğumu yok',
  'plan.weather.panel.noSunset': 'Gün batımı yok',
  'plan.weather.panel.slots': 'Gün boyunca',
  'plan.weather.panel.slot.night': 'Gece',
  'plan.weather.panel.slot.morning': 'Sabah',
  'plan.weather.panel.slot.afternoon': 'Öğleden sonra',
  'plan.weather.panel.slot.evening': 'Akşam',
  'plan.weather.panel.high': 'En yüksek',
  'plan.weather.panel.low': 'En düşük',
  'plan.weather.panel.recordedNote': 'Bu güne ait ölçülen değerler.',
  'plan.weather.panel.temperatureTypical': 'Tipik en yüksek / en düşük',
  'plan.weather.panel.estimateNote':
    'Bu ay için uzun vadeli ortalama; tahmin değildir.',
  'plan.weather.attribution.metNorway':
    'Tahmin verileri: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Veriler: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Gezi planını yeniden boyutlandır',
  'plan.workspace.resizePlaces': 'Yerleri yeniden boyutlandır',
  'plan.workspace.toggleDay': '{day} bölümünü genişlet veya daralt',
  'plan.workspace.days': 'Günler',
  'plan.workspace.showPanel': '{label} panelini göster',
  'plan.workspace.hidePanel': '{label} panelini gizle',
  'plan.workspace.narrowPanel': '{label} daralt',
  'plan.workspace.widenPanel': '{label} genişlet',
  'collab.sections.tabsLabel': 'İş birliği bölümleri',
  'collab.sections.trigger': 'Bölümleri seç',
  'collab.sections.menuLabel': 'Bu seyahatteki herkese göster',
  'collab.sections.keepOne': 'En az bir bölüm açık kalmalıdır.',
  'collab.sections.failed': 'Değişiklik kaydedilmedi',
  'collab.sections.failedBody': 'Menü şu anda kayıtlı olan durumu gösterir.',
  'collab.sections.someHidden': 'Bu seyahatte bazı bölümler gizlidir.',
  'collab.sections.turnedOff':
    'Bu bölüm seyahat için kapatıldı. Yazdıklarınızı gönderdiğinizde veya temizlediğinizde kapanır.',
  'collab.sections.changed': 'Bu seyahatin bölümleri değişti.',
  'collab.sections.savedHidden':
    'Kaydedildi. Bu bölüm seyahat için gizli olduğundan şimdi kapanıyor.',
  'plan.place.error.save': 'Yer kaydedilemedi. Birazdan tekrar deneyin.',
  'plan.stop.error.saveTimes':
    'Durak saatleri kaydedilemedi. Birazdan tekrar deneyin.',
  'plan.place.error.delete': 'Yer silinemedi. Birazdan tekrar deneyin.',
  'plan.pin.error.move': 'İşaretçi taşınamadı. Birazdan tekrar deneyin.',
  'plan.place.toast.created': 'Yer eklendi',
  'plan.place.toast.updated': 'Yer güncellendi',
  'plan.stop.toast.timesSaved': 'Durak saatleri kaydedildi',
  'plan.place.toast.deleted': 'Yer silindi',
  'plan.pin.toast.moved': '{name} işaretlendi',
  'join.page.title': 'Gezi davet bağlantısı',
  'join.page.description':
    'planned.travel üzerindeki ortak bir geziye katılmak için bu bağlantıyı açın.',
  'join.title.invited': '{inviter} sizi bir geziye davet etti',
  'join.requirement':
    'Bu bağlantı, {inviter} adlı kişinin çalışma alanında zaten bulunan kişiler için çalışır.',
  'join.newHere':
    'Burada yeni misiniz? Önce {inviter} adlı kişiden sizi çalışma alanına eklemesini isteyin.',
  'join.trip.label': 'Gezi',
  'join.role.label': 'Katılacağınız rol',
  'join.dates.label': 'Tarihler',
  'join.destination.label': 'Varış noktası',
  'join.action.signIn': 'Giriş yap',
  'join.action.join': 'Geziye katıl',
  'join.action.joining': 'Geziye katılıyorsunuz',
  'join.action.open': 'Geziyi aç',
  'join.action.openIn': 'Geziyi aç ve çalışma alanını değiştir',
  'join.action.openIn.pending': 'Çalışma alanı değiştiriliyor',
  'join.loading': 'Davet yükleniyor',
  'join.joined.title': 'Gezidesiniz',
  'join.joined.body': 'Planı görmek için açın.',
  'join.member.title': 'Bu gezide zaten varsınız',
  'join.needsWorkspace.title':
    'Bu gezi, üyesi olmadığınız bir çalışma alanında',
  'join.needsWorkspace.body':
    'Önce {inviter} adlı kişiden sizi çalışma alanına eklemesini isteyin, ardından bu bağlantıyı yeniden açın.',
  'join.needsWorkspace.signedInAs':
    '{email} olarak giriş yaptınız. {inviter} adlı kişiye bu adresi kullanmasını söyleyin.',
  'join.needsWorkspace.acceptFirst':
    'Zaten bir çalışma alanı davet e-postanız varsa önce onu kabul edin, ardından bu bağlantıyı yeniden açın.',
  'join.needsWorkspace.otherAccount': 'Başka bir hesapla giriş yap',
  'join.unavailable.title': 'Bu davet bağlantısı kullanılamıyor',
  'join.unavailable.body':
    'Bağlantı değiştirilmiş ya da kapatılmış olabilir. Bağlantıyı gönderen kişiden yenisini isteyin.',
  'join.unavailable.signIn': 'Giriş yap',
  'join.unavailable.trips': 'Gezilerinize git',
  'join.error.title': 'Bu davet bağlantısı yüklenemedi',
  'join.error.retry': 'Tekrar dene',
  'join.error.busy': 'Bu sayfa şu anda yoğun. Bir dakika sonra tekrar deneyin.',
  'join.error.join':
    'Katılım sağlanamadı. Bağlantı hâlâ çalışıyor, tekrar deneyin.',
  'join.error.switch': 'Çalışma alanı değiştirilemedi. Tekrar deneyin.',

  'invite.title': 'Davet bağlantısı',
  'invite.description':
    'Bu çalışma alanında bağlantıyı açan herkes geziye katılır.',
  'invite.empty.title': 'Henüz davet bağlantısı yok',
  'invite.empty.body':
    'Bir bağlantı oluşturup grup sohbetinde paylaşın; bu çalışma alanındaki kişiler katılabilsin.',
  'invite.action.create': 'Bağlantı oluştur',
  'invite.link.label': 'Davet bağlantısı',
  'invite.copy': 'Bağlantıyı kopyala',
  'invite.copied': 'Bağlantı kopyalandı',
  'invite.copyFailed': 'Kopyalanamadı. Bağlantıyı seçip kendiniz kopyalayın.',
  'invite.switch.label':
    'Bu çalışma alanında bağlantısı olan herkes katılabilir',
  'invite.switch.onHint':
    'Kapatmak, gönderilmiş kopyalar dahil bağlantıyı herkes için geçersiz kılar.',
  'invite.switch.offHint':
    'Açmak yeni bir bağlantı oluşturur. Önceki bağlantılar geçersiz kalır.',
  'invite.off.body': 'Bağlantı kapalı. Kimse bununla katılamaz.',
  'invite.uses': {
    one: 'Bu bağlantıyla katılan kişi sayısı: {count}',
    other: 'Bu bağlantıyla katılan kişi sayısı: {count}',
  },
  'invite.uses.never': 'Bu bağlantıyla henüz kimse katılmadı.',
  'invite.lastUsed': 'Son katılım: {when}',
  'invite.role.upgrade.title': 'Düzenleme yetkisi verilsin mi?',
  'invite.role.upgrade.body':
    'Bu, gönderilen tüm kopyalar ve bundan sonra katılacak herkes için geçerlidir.',
  'invite.role.upgrade.confirm': 'Düzenleme yetkisi ver',
  'invite.replace.action': 'Bağlantıyı değiştir',
  'invite.replace.title': 'Bu bağlantı değiştirilsin mi?',
  'invite.replace.body':
    'Eski bağlantı hemen herkes için geçersiz olur. Önceden katılanlar gezide kalır; gerekirse aşağıdaki listeden çıkarın.',
  'invite.replace.deadBody':
    'Eski bağlantı artık çalışmıyor. Önceden katılanlar gezide kalır.',
  'invite.replace.confirm': 'Bağlantıyı değiştir',
  'invite.replace.pending': 'Bağlantı değiştiriliyor',
  'invite.stale': 'Bu bağlantı artık çalışmıyor. Değiştirin.',
  'invite.creatorGone':
    'Bağlantıyı oluşturan kişi artık gezi sahibi olmadığı için bağlantı çalışmıyor. Değiştirin.',
  'invite.archived':
    'Bu gezi arşivlenmiş. Gezi geri yüklendiğinde bağlantı yeniden çalışır.',
  'invite.announce.created': 'Davet bağlantısı oluşturuldu',
  'invite.announce.roleEditor': 'Yeni katılanlar düzenleme yetkisi alacak',
  'invite.announce.off': 'Davet bağlantısı kapatıldı',
  'invite.announce.newLink':
    'Yeni bağlantı hazır. Kopyalayıp yeniden gönderin.',
  'invite.announce.roleViewer': 'Yeni katılanlar görüntüleme yetkisi alacak',
  'invite.error.title': 'Davet bağlantısı yüklenemedi',
  'invite.error.retry': 'Yeniden dene',
  'invite.refusal.archived': 'Bu gezi arşivlenmiş.',
  'invite.refusal.notOwner':
    'Davet bağlantısını yalnızca gezi sahibi değiştirebilir.',
  'invite.refusal.changed':
    'Başka biri bağlantıyı değiştirdi. Güncel bağlantı gösteriliyor.',
  'invite.announce.recovered':
    'Güncel bağlantı ayarları gösteriliyor. Yeni bir değişiklikten önce kontrol edin.',
} satisfies TranslationOf<typeof En>

export default messages
