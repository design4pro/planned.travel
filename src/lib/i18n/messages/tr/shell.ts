/**
 * Everything the application shell says, in Turkish.
 *
 * Made from `../en/shell.ts` and from nothing else. `docs/SPEC.md` §1 and §8.9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * **One word for a subscription.** A paid tier is «paket» throughout this
 * catalogue, not the loan-word «plan», which Turkish keeps for a plan of action
 * — and which is what `trip.tab.plan` is. Reading «paket» on the billing rows
 * and «program» on the itinerary tab is how a Turkish reader tells the two
 * apart.
 *
 * **Two branches that say the same thing.** Turkish takes the singular after a
 * numeral, so `one` and `other` are deliberately identical wherever a number
 * precedes the noun. `Intl.PluralRules` still reports both categories for `tr`
 * and `__tests__/parity.test.ts` requires both.
 *
 * **Stored notification copy.** `src/server/repos/notifications.ts` stores a
 * notification as `titleKey` + `bodyKey` + a `params` record, never as a
 * rendered sentence, so the `notification.*` pairs below are what a row written
 * a year ago resolves against today. A reader's own text is set in Turkish
 * quotation marks, which is the only thing a translator can do to a message that
 * is nothing but a placeholder.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Ana bölümler',
  'nav.mobile': 'Bölümler',
  'nav.dashboardLink': 'planned.travel panosu',
  'nav.homeLink': 'planned.travel ana sayfası',
  'nav.newTrip': 'Yeni gezi',

  'nav.trips': 'Gezilerim',
  'nav.trips.short': 'Geziler',
  'nav.vacay': 'Tatil',
  'nav.vacay.short': 'Tatil',
  'nav.atlas': 'Dünya haritası',
  'nav.atlas.short': 'Dünya',
  'nav.journey': 'Günlük',
  'nav.journey.short': 'Günlük',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Gezi bölümleri',
  'trip.nav.back': 'Geziler',
  'trip.nav.share': 'Paylaş',
  'trip.nav.shareLabel': 'Bu geziyi paylaş',
  'trip.tab.plan': 'Program',
  'trip.tab.transports': 'Ulaşım',
  'trip.tab.book': 'Rezervasyon',
  'trip.tab.lists': 'Listeler',
  'trip.tab.costs': 'Masraflar',
  'trip.tab.files': 'Dosyalar',
  'trip.tab.collab': 'Ekip',

  /* ------------------------------------------------------------ user menu */
  'account.menu': '{name}, hesap menüsü',
  'account.settings': 'Ayarlar',
  'account.billing': 'Paket ve ödeme',
  'account.admin': 'Yönetim',
  'account.signOut': 'Çıkış yap',
  'account.signingOut': 'Çıkış yapılıyor…',
  'account.signOutFailed': 'Çıkış yapılamadı',
  'account.signOutFailedBody': 'Bağlantınızı kontrol edip yeniden deneyin.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Çalışma alanı',
  'workspace.switched': '{name} çalışma alanına geçildi',
  'workspace.switchFailed': 'Çalışma alanı değiştirilemedi',
  'workspace.switchFailedBody': 'Bağlantınızı kontrol edip yeniden deneyin.',
  'workspace.switchUnconfirmedBody':
    'Etkin çalışma alanı doğrulanamadı. Devam etmeden önce sayfayı yeniden yükleyin.',
  'workspace.switchRateLimitedBody':
    'Çok fazla çalışma alanı değişikliği. Biraz bekleyip tekrar deneyin.',
  'workspace.create': 'Çalışma alanı oluştur',
  'workspace.createTitle': 'Çalışma alanı oluşturun',
  'workspace.createDescription':
    'Kendi gezileri, yerleri ve kişileri olan ayrı bir alan. Ücretsiz planla başlar ve içinde bulunduğunuz çalışma alanının planını paylaşmaz.',
  'workspace.createPermanent':
    'planned.travel’da henüz bir çalışma alanını silme seçeneği yok. Oluşturduğunuz veya katıldığınız her çalışma alanı sınıra dahildir: {limit} çalışma alanına üye olduğunuzda yenisini oluşturamazsınız.',
  'workspace.createName': 'Çalışma alanı adı',
  'workspace.createNameRequired': 'Çalışma alanı için bir ad girin.',
  'workspace.createUpgrade':
    '“{workspace}” Ücretsiz planda; yeni bir çalışma alanını yalnızca ücretli planı olan bir çalışma alanı oluşturabilir. Diğer çalışma alanlarınızdan birinin ücretli planı varsa ona geçin ve oradan oluşturun. Aksi halde “{workspace}” alanını ücretli plana yükseltin.',
  'workspace.createLimitReached':
    'Sınırın izin verdiği kadar çalışma alanına üyesiniz, bu yüzden yenisini oluşturamazsınız.',
  'workspace.createRoleRequired':
    'Yeni bir çalışma alanını yalnızca bir çalışma alanı yöneticisi oluşturabilir. Bu çalışma alanının bir yöneticisinden isteyin ya da yönettiğiniz bir çalışma alanına geçin.',
  'workspace.createFailed': 'Çalışma alanı oluşturulamadı',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Görünüm',
  'theme.light': 'Açık',
  'theme.dark': 'Koyu',
  'theme.system': 'Sistemle aynı',
  'theme.state.light': 'açık',
  'theme.state.dark': 'koyu',
  'theme.state.system': 'sistemle aynı',
  'theme.trigger': 'Tema: {state}. Temayı değiştir',
  'language.trigger': 'Dil: {language}. Dili değiştir',
  'language.hint':
    'Bu cihazda hatırlanır. Giriş yaptığınızda hesabınızda ayarlanan dil geçerli olur; bunu Ayarlar’dan değiştirebilirsiniz.',
  'language.announce': 'Dil {language} olarak değiştirildi',
  'language.notApplied':
    'Bu tarayıcı seçiminizi saklamadı. Bu site için çerezlere izin verin, ardından yeniden seçin.',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Bildirimler, okunmamış yok',
  'bell.unread': {
    one: 'Bildirimler, {unread} okunmamış',
    other: 'Bildirimler, {unread} okunmamış',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Gelen kutusu',
  'inbox.title': 'Bildirimler',
  'inbox.error': 'Gelen kutunuz yüklenmedi',
  'inbox.allRead': 'Her şey okundu',
  'inbox.unread': {
    one: '{unread} okunmamış mesaj',
    other: '{unread} okunmamış mesaj',
  },
  'inbox.markAll': 'Tümünü okundu say',
  'inbox.markingAll': 'Tümü okundu sayılıyor',
  'inbox.cleared': 'Gelen kutusu temizlendi',
  'inbox.markAllFailed': 'Tümü okundu sayılamadı',
  'inbox.retryHint': 'Bağlantınızı kontrol edip yeniden deneyin.',
  'inbox.filter.all': 'Her şey',
  'inbox.filter.unread': 'Okunmamış',
  'inbox.waiting': {
    one: '{invitations} davet bekliyor',
    other: '{invitations} davet bekliyor',
  },
  'inbox.empty.title': 'Gelen kutunuz boş',
  'inbox.empty.body':
    'Gezi davetleri, program değişiklikleri, rezervasyon hatırlatmaları ve kapanan hesaplar hep buraya düşer.',
  'inbox.empty.action': 'Panoya dön',
  'inbox.emptyUnread.title': 'Okunmamış bir şey yok',
  'inbox.emptyUnread.body':
    'Her şeyi okudunuz. Geçmişe bakmak için “Her şey” sekmesine geçin.',
  'inbox.emptyUnread.action': 'Her şeyi göster',
  'inbox.row.new': 'Yeni',
  'inbox.row.accepted': 'Kabul edildi',
  'inbox.row.declined': 'Reddedildi',
  'inbox.row.open': 'Aç',
  'inbox.row.markRead': 'Okundu',
  'inbox.row.markingRead': 'Okundu işaretleniyor',
  'inbox.row.markReadFailed': 'Bu okundu sayılamadı',
  'inbox.preferences':
    'Bunlardan hangileri gelen kutunuza, e-postanıza ve telefonunuza ulaşsın, siz seçin.',
  'inbox.preferencesAction': 'Bildirim ayarları',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': '{tripTitle} gezisine davet edildiniz',
  'notification.trip.invited.body': '{actorName} sizi geziye ekledi.',
  'notification.trip.updated.title': '{tripTitle} güncellendi',
  'notification.trip.updated.body': '{actorName} programı değiştirdi.',
  'notification.trip.member_added.title':
    '{memberName}, {tripTitle} gezisine katıldı',
  'notification.trip.member_added.body':
    'Artık programı, rezervasyonları ve masrafları görebilir.',
  'notification.trip.member_removed.title':
    '{memberName}, {tripTitle} gezisinden ayrıldı',
  'notification.trip.member_removed.body': 'Geziye erişimi sona erdi.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} {days} gün sonra başlıyor',
    other: '{tripTitle} {days} gün sonra başlıyor',
  },
  'notification.trip.starting_soon.body':
    'Valiz listesine ve rezervasyonlara bakma vakti.',
  'notification.trip.copied.title': '{tripTitle} hazır',
  'notification.trip.copied.body': {
    one: '{days} gün geldi',
    other: '{days} gün geldi',
  },
  'notification.trip.copied.places': {
    one: '{places} yer',
    other: '{places} yer',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} not düştü',
    other: '{dropped} not düştü',
  },
  'notification.trip.copyFailed.title': '{tripTitle} kopyalanamadı',
  'notification.trip.copyFailed.body':
    'Hiçbir şey kaybolmadı. Aslından yeniden deneyin.',
  'notification.reservation.reminder.title': '{title} yaklaşıyor',
  'notification.reservation.reminder.body':
    'Saati ve onay kodunu rezervasyonun üzerinde bulabilirsiniz.',
  'notification.reservation.confirmed.title': '{title} onaylandı',
  'notification.reservation.confirmed.body':
    'Rezervasyon {tripTitle} gezisinde onaylandı olarak işaretlendi.',
  'notification.expense.added.title': '{actorName} bir masraf ekledi',
  'notification.expense.added.body': '{tripTitle} gezisinde {title}.',
  'notification.expense.settled.title': '{actorName} hesabı kapattı',
  'notification.expense.settled.body': '{tripTitle} gezisindeki bakiye ödendi.',
  'notification.list.assigned.title': '{actorName} size bir madde atadı',
  'notification.list.assigned.body': '{tripTitle} gezisinde {title}.',
  'notification.collab.message.title':
    '{actorName}, {tripTitle} gezisine yazdı',
  'notification.collab.message.body': '“{preview}”',
  'notification.collab.poll.title': '{tripTitle} gezisinde bir anket açıldı',
  'notification.collab.poll.body': '“{question}”',
  'notification.organization.invited.title':
    '{organizationName} çalışma alanına davet edildiniz',
  'notification.organization.invited.body':
    'Kabul edin; çalışma alanına ve orada paylaşılan her şeye katılın.',
  'notification.journey.published.title': '{title} yayımlandı',
  'notification.journey.published.body':
    'Bağlantıya sahip herkes günlüğü artık okuyabilir.',
  'notification.billing.plan_changed.title': 'Paketiniz değişti',
  'notification.billing.plan_changed.body':
    '{organizationName} artık {plan} paketinde.',
  'notification.billing.invoice_paid.title': 'Ödeme alındı',
  'notification.billing.invoice_paid.body':
    '{organizationName} için son fatura ödendi.',
  'notification.billing.payment_failed.title': 'Bir ödeme gerçekleşmedi',
  'notification.billing.payment_failed.body':
    '{organizationName} için gecikmiş bir ödeme var. Paketi korumak için ödeme yöntemini güncelleyin.',
  'notification.fallback.title': 'Çalışma alanınızda bir şey değişti',
  'notification.fallback.body': 'Ne olduğunu görmek için geziyi açın.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Pano yüklenmedi',
  'dashboard.blank.title': 'Sıradaki geziniz burada başlıyor',
  'dashboard.blank.body':
    'Bir gezi oluşturun, görmek istediğiniz yerleri haritaya bırakın; planned.travel gün gün programı onların çevresine kurar.',
  'dashboard.blank.action': 'Gezi planla',
  'dashboard.blank.secondary': 'Dünya haritanıza bakın',

  'dashboard.upNext': 'Sırada',
  'dashboard.openPlan': 'Programı aç',
  'dashboard.hero.travellers': 'Yolcular',
  'dashboard.hero.datesMissing': 'Günlerin kurulması için tarih ekleyin',
  'dashboard.hero.startsIn': 'Başlamasına',
  'dashboard.hero.started': 'Başladı',
  'dashboard.hero.today': 'Bugün',
  'dashboard.hero.startUnknown': 'başlangıç tarihi yok',
  'dashboard.hero.startToday': 'yolunuz açık olsun',
  'dashboard.hero.startPast': { one: 'gün önce', other: 'gün önce' },
  'dashboard.hero.startFuture': { one: 'gün', other: 'gün' },
  'dashboard.hero.nights': 'Gece',
  'dashboard.hero.companionsHint': 'bu gezide',
  'dashboard.hero.progress': 'Devam ediyor',
  'dashboard.hero.places': 'Yerler',
  'dashboard.hero.placesNone': 'haritada henüz bir şey yok',
  'dashboard.hero.placesHint': 'haritada',

  'dashboard.stat.countries': 'Gezilen ülkeler',
  'dashboard.stat.countriesUnit': '{total} ülkeden',
  'dashboard.stat.countriesNone':
    'Haritanızı başlatmak için bir ülke işaretleyin',
  'dashboard.stat.visits': {
    one: '{visits} ziyaret kaydedildi',
    other: '{visits} ziyaret kaydedildi',
  },
  'dashboard.stat.trips': 'Toplam gezi',
  'dashboard.stat.tripsCaption': '{planning} planlanıyor · {booked} rezerve',
  'dashboard.stat.places': 'Haritaya işlenen yerler',
  'dashboard.stat.placesNone': 'Haritada henüz bir şey yok',
  'dashboard.stat.placesAcross': {
    one: '{trips} gezide',
    other: '{trips} gezide',
  },
  'dashboard.stat.bookings': 'Onaylı rezervasyonlar',
  'dashboard.stat.bookingsNone': 'Yaklaşan rezervasyon yok',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} rezervasyon yolda',
    other: '{bookings} rezervasyon yolda',
  },

  'dashboard.trips.label': 'Gezileriniz',
  'dashboard.trips.all': 'Tüm geziler',
  'dashboard.trips.empty.title': 'Henüz gezi yok',
  'dashboard.trips.empty.body':
    'Planladığınız her şey, en yenisi başta olacak şekilde burada görünür.',
  'dashboard.trips.empty.action': 'Gezi oluştur',

  'dashboard.bookings.label': 'Yaklaşan rezervasyonlar',
  'dashboard.bookings.empty.title': 'Henüz rezervasyon yok',
  'dashboard.bookings.empty.body':
    'Onaylı konaklamalar, masalar ve biletler tarihleri yaklaştıkça burada görünür.',

  'dashboard.pipeline.label': 'Gezi akışı',
  'dashboard.pipeline.empty':
    'Akışta bir şey yok. İlk geziniz bunu aşamalara böler.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} favori',
    other: '{favourites} favori',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} arşivlenmiş gezi',
    other: '{archived} arşivlenmiş gezi',
  },

  'dashboard.storage.label': 'Depolama',
  'dashboard.storage.count': '{used} / {limit}',
  'dashboard.storage.files': {
    one: 'Tüm gezilerde {files} dosya var; fotoğraflar ve biletler dahil.',
    other: 'Tüm gezilerde {files} dosya var; fotoğraflar ve biletler dahil.',
  },
  'dashboard.storage.more': 'Daha fazla yer mi gerekiyor?',
  'dashboard.storage.plans': 'Paketlere bak',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Başvuru',
  'dashboard.widgets.choose': 'Widget’ları seç',
  'dashboard.widgets.description': 'Panonuzun yanında tuttuğunuz widget’lar.',
  'dashboard.clock.label': 'Dünya saati',
  'dashboard.clock.add': 'Saat dilimi ekle',
  'dashboard.clock.search': 'Şehir ve bölge ara',
  'dashboard.clock.noMatches': 'Bu adda bir saat dilimi yok',
  'dashboard.clock.remove': '{zone} kaldır',
  'dashboard.clock.offset': 'Kendi saatinize göre {offset}',
  'dashboard.clock.here': 'Kendi saatiniz',
  'dashboard.clock.empty.title': 'Sabitlenmiş saat dilimi yok',
  'dashboard.clock.empty.body':
    'Bir yeri sabitleyin, saatini kendi saatinizin yanında okuyun.',
  'dashboard.clock.unknown.title': 'Bu cihaz {zone} dilimini tanımıyor',
  'dashboard.clock.unknown.body':
    'Saati burada okunamıyor. Satırı kaldırarak bunu giderin.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Yönetim konsolu yüklenmedi',
  'admin.denied.title': 'Bunu yalnızca çalışma alanı yöneticileri açabilir',
  'admin.denied.body':
    'Gerekiyorsa bu çalışma alanının sahibinden ya da bir yöneticisinden rolünüzü değiştirmesini isteyin.',
  'admin.denied.action': 'Panoya dön',
  'admin.eyebrow': 'Çalışma alanı yönetimi',
  'admin.description': '{plan} paketi · {date} tarihinde oluşturuldu',
  'admin.createdUnknown': 'kısa süre önce',
  'admin.workspaceSettings': 'Çalışma alanı ayarları',
  'admin.billing': 'Paket ve ödeme',

  'admin.invitations.title': {
    one: '{invitations} davet hâlâ açık',
    other: '{invitations} davet hâlâ açık',
  },
  'admin.invitations.body':
    'Açık kalan her davet, paketinizin ödediği koltuklardan düşer.',
  'admin.invitations.action': 'Davetleri incele',

  'admin.stat.members': 'Üyeler',
  'admin.stat.membersCaption': {
    one: '{invitations} davet beklemede',
    other: '{invitations} davet beklemede',
  },
  'admin.stat.storage': 'Depolama',
  'admin.stat.storageUnit': '{limit} üzerinden',
  'admin.stat.storageUnlimited': 'sınır yok',
  'admin.stat.storageCaption': 'Dosyalar, fotoğraflar ve dışa aktarmalar',
  'admin.stat.audit': 'Denetim kayıtları',
  'admin.stat.auditCaption': 'En son etkinlik aşağıda görünüyor',
  'admin.stat.plan': 'Paket',
  'admin.stat.planCaption': 'Sınırlar veri deposu sınırında uygulanır',

  'admin.quotas.label': 'Sınırlar',
  'admin.quotas.count': {
    one: '{metrics} ölçüm',
    other: '{metrics} ölçüm',
  },
  'admin.quotas.unlimited': 'Sınırsız',
  'admin.quotas.value': '{limit} üzerinden {used}',

  'admin.members.label': 'Üyeler',
  'admin.members.table': 'Bu çalışma alanının üyeleri',
  'admin.members.person': 'Kişi',
  'admin.members.role': 'Rol',
  'admin.members.joined': 'Katıldı',
  'admin.members.role.label': '{name} rolü',
  'admin.members.role.saved': '{name} artık {role}.',
  'admin.members.role.impersonated': 'Başka bir hesap olarak işlem yaparken rol değiştirilemez.',
  'admin.members.role.notPermitted':
    'Bu değişikliği yapamazsınız. Sahip rolünü yalnızca bir sahip verebilir veya bir sahibi değiştirebilir.',
  'admin.members.role.lastOwner':
    'Bu, çalışma alanının tek sahibi. Önce başka birini sahip yapın.',
  'admin.members.role.notFound': 'Bu kişi artık çalışma alanında değil. Liste yenilendi.',
  'admin.members.role.failed': 'Rol değiştirilemedi. Yeniden deneyin.',
  'admin.members.role.promote.title': '{name} sahip yapılsın mı?',
  'admin.members.role.promote.body':
    '{name} sizinle aynı yetkiye sahip olacak: faturalama, üyeler ve ayarlar. Bir sahip, sizin de aralarında olduğunuz diğer tüm sahiplerin rolünü düşürebilir veya onları çıkarabilir.',
  'admin.members.role.promote.confirm': 'Sahip yap',
  'admin.members.role.promote.cancel': 'İptal',

  'admin.activity.label': 'Son etkinlik',
  'admin.activity.empty.title': 'Henüz kayıt yok',
  'admin.activity.empty.body':
    'Önemli olan her yazma işlemi, gerçekleştiği anda denetim kaydına eklenir.',
  'admin.activity.workspace': 'çalışma alanının kendisi',
  'admin.actions.label': 'En yoğun işlemler',
  'admin.actions.count': {
    one: '{actions} işlem',
    other: '{actions} işlem',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Taslak',
  'tripStatus.planning': 'Planlanıyor',
  'tripStatus.booked': 'Rezerve edildi',
  'tripStatus.active': 'Etkin',
  'tripStatus.completed': 'Tamamlandı',
  'tripStatus.archived': 'Arşivlendi',

  'bookingStatus.none': 'Rezerve edilmedi',
  'bookingStatus.pending': 'Beklemede',
  'bookingStatus.confirmed': 'Onaylandı',
  'bookingStatus.cancelled': 'İptal edildi',
  'bookingStatus.completed': 'Bitti',

  'bookingType.accommodation': 'Konaklama',
  'bookingType.restaurant': 'Masa',
  'bookingType.activity': 'Etkinlik',
  'bookingType.tour': 'Tur',
  'bookingType.ticket': 'Bilet',
  'bookingType.transport': 'Ulaşım',
  'bookingType.other': 'Rezervasyon',

  'role.owner': 'Sahip',
  'role.admin': 'Yönetici',
  'role.member': 'Üye',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} gezi',
    other: '{value} gezi',
  },
  'trips.count.favourites': {
    one: '{value} favori',
    other: '{value} favori',
  },
  'trips.count.archived': {
    one: '{value} arşivde',
    other: '{value} arşivde',
  },
  'trips.atLimit.body':
    'Planın {trips} kapsıyor. Bitirdiğin birini arşivle ya da aynı anda daha fazlasını açık tutmak için üst plana geç.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Yeni günlük',
  'newJourney.title': 'Bir günlük başlat',
  'newJourney.description':
    'Günlük, bir gezinin yazılı yüzüdür — tarih sırasıyla girdiler, hatırladığın fotoğraflar ve hava ile.',
  'newJourney.titlePlaceholder': 'Kyoto’da iki hafta',
  'newJourney.subtitle': 'Alt başlık',
  'newJourney.subtitleHint': 'Başlığın altında tek satır, kapakta.',
  'newJourney.subtitlePlaceholder': 'Tapınaklar, trenler ve fazlasıyla matcha',
  'newJourney.trip': 'Bir geziye dayanarak',
  'newJourney.tripHint': 'İsteğe bağlı — anlatıyı planına bağlar.',
  'newJourney.tripNone': 'Bir geziye bağlı değil',
  'newJourney.datesError': 'Bitiş tarihi başlangıçtan önce.',
  'newJourney.submit': 'Günlük oluştur',
  'newJourney.creating': 'Günlük oluşturuluyor',
  'newJourney.created': 'Günlük başladı',
  'newJourney.createdBody': 'Anlatıya başlamak için ilk girdiyi ekle.',
  'newJourney.error': 'Günlük oluşturulamadı. Birazdan yeniden dene.',
  'newCollection.trigger': 'Yeni derlem',
  'newCollection.title': 'Bir derlem başlat',
  'newCollection.description':
    'Hangi geziye ait olduklarını bilmeden bulduğun yerler için bir yer.',
  'newCollection.namePlaceholder': 'Şehri geçmeye değer bir kahve',
  'newCollection.descriptionHint': 'Buraya ne girer, ne girmez.',
  'newCollection.submit': 'Derlem oluştur',
  'newCollection.creating': 'Derlem oluşturuluyor',
  'newCollection.created': 'Derlem oluşturuldu',
  'newCollection.createdBody': 'İçine yer kaydetmeye başla.',
  'newCollection.error': 'Derlem oluşturulamadı. Birazdan yeniden dene.',

  'newTrip.title': 'Yeni bir gezi başlat',
  'newTrip.description':
    'Bir başlık yeter. Tarihler gün gün planı kurar, gerisi sen bilene kadar bekleyebilir.',
  'newTrip.name': 'Gezi adı',
  'newTrip.namePlaceholder': 'Kiraz çiçeği mevsiminde Kyoto',
  'newTrip.destination': 'Varış yeri',
  'newTrip.destinationHint': 'Bir şehir, bir bölge ya da tüm güzergâh.',
  'newTrip.destinationPlaceholder': 'Kyoto, Japonya',
  'newTrip.departure': 'Gidiş',
  'newTrip.return': 'Dönüş',
  'newTrip.returnError': 'Dönüş tarihi gidişten önce.',
  'newTrip.currency': 'Bütçe para birimi',
  'newTrip.currencyHint': 'Bu gezinin her harcaması onunla toplanır.',
  'newTrip.currencySearch': 'Kod veya ada göre ara',
  'newTrip.currencyEmpty': 'Eşleşen para birimi yok.',
  'newTrip.currencyFavourites': 'Sık kullanılanlar',
  'newTrip.currencyAll': 'Tüm para birimleri',
  'newTrip.summary': 'Özet',
  'newTrip.summaryPlaceholder': 'İki hafta tapınak, tren ve ramen.',
  'newTrip.duration': 'Gün olarak süre',
  'newTrip.durationHint': 'Tarih olmadan gezi, bu kadar tarihsiz günle başlar.',
  'newTrip.durationDerived': 'İki tarihten hesaplanır.',
  'newTrip.reminder': 'Hareketten önce hatırlatma',
  'newTrip.reminderNone': 'Yok',
  'newTrip.reminderBefore': {
    one: '{count} gün önce',
    other: '{count} gün önce',
  },
  'newTrip.reminderCustom': 'Özel',
  'newTrip.reminderCustomDays': 'Hareketten kaç gün önce',
  'newTrip.reminderOn': 'Hatırlatma: {date}',
  'newTrip.reminderNoDeparture': 'Günü görmek için bir hareket tarihi seç.',
  'newTrip.submit': 'Gezi oluştur',
  'newTrip.creating': 'Gezi oluşturuluyor',
  'newTrip.error': 'Gezi oluşturulamadı. Birazdan yeniden dene.',
  'newTrip.created': 'Gezi oluşturuldu',
  'newTrip.createdBody': 'Haritaya yer eklemeye başla.',
  'newTrip.coverChoose': 'Kapak görseli ekle',
  'newTrip.coverChange': 'Kapak görselini değiştir',
  'newTrip.coverHint':
    'Bir görseli buraya bırak, yapıştır ya da bir dosya seç. PNG, JPEG, WebP, AVIF veya GIF.',
  'newTrip.coverChosen': 'Kapak görseli: {name}',
  'newTrip.coverRemove': 'Kapak görselini kaldır',
  'newTrip.coverTypeError':
    '“{name}” kapak görseli olamaz. PNG, JPEG, WebP, AVIF veya GIF seç.',
  'newTrip.coverSizeError':
    '“{name}” {max} boyutundan büyük. Daha küçük bir görsel seç.',
  'newTrip.coverUploading': 'Kapak görseli yükleniyor',
  'newTrip.coverFailedTitle': 'Kapak görseli eklenemedi',
  'newTrip.coverFailed':
    'Gezi oluşturuldu ama “{name}” kapak olarak yüklenemedi.',
  'newTrip.coverRetry': 'Yeniden dene',
  'newTrip.coverContinue': 'Geziyi kapaksız aç',
  'newTrip.people': 'Kişiler',
  'newTrip.peopleHint':
    'Gezi oluşturulur oluşturulmaz eklenirler. Sahibi olmaya devam edersiniz.',
  'newTrip.peoplePlaceholder': 'Çalışma alanınızdan seçin',
  'newTrip.peopleSearch': 'Ada göre ara',
  'newTrip.peopleLoading': 'Çalışma alanınızdaki kişiler yükleniyor',
  'newTrip.peopleLoadError':
    'Çalışma alanınızdaki kişiler yüklenemedi. Geziyi oluşturun ve Kişiler ekranından ekleyin.',
  'newTrip.peopleNone': 'Şimdilik bu çalışma alanındaki tek kişi sizsiniz.',
  'newTrip.peopleNoneMember':
    'Çalışma alanının sahibi veya yöneticisi daha fazla kişiyi davet edebilir.',
  'newTrip.peopleInvite': 'Çalışma alanına kişi davet et',
  'newTrip.peopleChosen': 'Seçilen kişiler ve rolleri',
  'newTrip.peopleFailedTitle': 'Gezi oluşturuldu ama herkes eklenemedi',
  'newTrip.noticeBothTitle': 'Gezi oluşturuldu ama her şey eklenemedi',
  'newTrip.peopleNotInWorkspace':
    '{name} artık bu çalışma alanında olmadığı için eklenmedi.',
  'newTrip.peopleAlreadyOn': '{name} zaten bu gezideydi.',
  'newTrip.peopleUnconfirmed':
    '{name} için ekleme doğrulanamadı. Eklenip eklenmediğini Kişiler ekranından kontrol edin.',
  'newTrip.peopleContinue': 'Devam',
  'newTrip.peopleRetry': 'Tekrar dene',
  'newTrip.coverRetryOnly': 'Kapağı tekrar dene',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': '{title} için işlemler',
  'tripActions.copy': 'Kopyala',
  'tripActions.favourite': 'Favorilere ekle',
  'tripActions.unfavourite': 'Favorilerden çıkar',
  'tripActions.edit': 'Düzenle',
  'tripActions.archive': 'Arşivle',
  'tripActions.restore': 'Geri al',
  'tripActions.delete': 'Sil',
  'tripActions.deleteForGood': 'Kalıcı olarak sil',
  'tripActions.starFailed': 'Favori kaydedilmedi',
  'tripActions.starFallback': 'Gezi eski hâline döndü.',
  'tripActions.archived': 'Gezi arşivlendi',
  'tripActions.archiveFailed': 'Gezi arşivlenemedi',
  'tripActions.restored': 'Gezi geri alındı',
  'tripActions.restoreFailed': 'Gezi geri alınamadı',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Geziyi düzenle',
  'editTrip.submit': 'Değişiklikleri kaydet',
  'editTrip.saving': 'Gezi kaydediliyor',
  'editTrip.cancel': 'Vazgeç',
  'editTrip.saved': 'Gezi güncellendi',
  'editTrip.errorTitle': 'Bu kaydedilmedi',
  'editTrip.retry': 'Yeniden dene',
  'editTrip.error': 'Gezi kaydedilemedi. Birazdan yeniden deneyin.',
  'editTrip.coverFailed':
    '“{name}” kapak olarak yüklenemedi. Başka hiçbir şey henüz kaydedilmedi.',
  'editTrip.coverContinue': 'Yeni kapak olmadan kaydet',
  'editTrip.currencyLocked':
    'Bu gezide zaten fiyatlar var, bu yüzden bütçe para birimi burada değiştirilemez. Masraflar sekmesindeki “Bütçe para birimini değiştir” düğmesini kullanın ya da diğer değişiklikleri kaydetmek için {current} değerine geri döndürün.',
  'editTrip.currencyReadonly':
    'Bütçe para birimi Masraflar sekmesinden değiştirilir.',
  'editTrip.currencyLink': 'Masraflar sekmesini aç',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': '“{title}” kalıcı olarak silinsin mi?',
  'deleteTrip.description':
    'Geri alma da çöp kutusu da yok. Arşivlemek geziyi kaybetmeden listeden çıkarır.',
  'deleteTrip.reading': 'Bu gezinin içeriği okunuyor',
  'deleteTrip.errorTitle': 'Bu yüklenmedi',
  'deleteTrip.summaryError': 'Bu gezinin içeriği okunamadı.',
  'deleteTrip.confirmLabel': 'Onaylamak için gezinin adını yazın',
  'deleteTrip.deleting': 'Gezi siliniyor',
  'deleteTrip.deleted': 'Gezi silindi',
  'deleteTrip.failed': 'Gezi silinemedi',
  'deleteTrip.carried.reservations': {
    one: 'rezervasyon',
    other: 'rezervasyon',
  },
  'deleteTrip.carried.transports': {
    one: 'ulaşım',
    other: 'ulaşım',
  },
  'deleteTrip.carried.expenses': {
    one: 'harcama',
    other: 'harcama',
  },
  'deleteTrip.carried.files': {
    one: 'dosya',
    other: 'dosya',
  },
  'deleteTrip.carried.members': {
    one: 'kişi',
    other: 'kişi',
  },
  'copyTrip.title': '“{title}” kopyala',
  'copyTrip.nameLabel': 'Kopyanın adı',
  'copyTrip.titleRequired': 'Kopyaya bir ad ver.',
  'copyTrip.datesLabel': 'Tarihler',
  'copyTrip.datesTogether': 'İki tarihi de gir ya da ikisini de temizle.',
  'copyTrip.clearDates': 'Tarihsiz kopyala',
  'copyTrip.carries':
    'Günler, yerler ve notlar geliyor. Rezervasyonlar, para, dosyalar ve kişiler gelmiyor.',
  'copyTrip.shorter':
    'Bu, aslından kısa. Fazla günlerin yerleri fikirlere taşınır, notları ise düşer.',
  'copyTrip.submit': 'Geziyi kopyala',
  'copyTrip.copying': 'Gezi kopyalanıyor',
  'copyTrip.cancel': 'Vazgeç',
  'copyTrip.started': '“{title}” kopyalanıyor',
  'copyTrip.errorTitle': 'Bu kopyalanmadı',
  'copyTrip.error': 'Gezi kopyalanamadı. Birazdan yeniden deneyin.',

  'trips.error': 'Gezilerin yüklenemedi',
  'trips.eyebrow': 'Çalışma alanı',
  'trips.nothingPlanned': 'Henüz bir plan yok',
  'trips.search': 'Gezi ara',
  'trips.atLimit.title': 'Planının izin verdiği her geziyi doldurdun',
  'trips.atLimit.action': 'Planları karşılaştır',
  'trips.noMatch.title': 'Bu filtreye uyan bir şey yok',
  'trips.noMatch.body':
    'Başka bir aşama dene, aramayı temizle ya da arşive bak.',
  'trips.noMatch.action': 'Filtreleri sıfırla',
  'trips.empty.body':
    'Bir gezi gün planını, haritayı, rezervasyonları, valiz listelerini ve parayı bir arada tutar. Birini başlat, gerisi gelir.',
  'trips.next.title': 'Sıradaki bir yere',
  'trips.next.body':
    'Bir gezi başlat, planned.travel her tarih için bir gün kurar, kaydettiğin her şeye hazır.',
  'trips.savedPlaces': 'Kayıtlı yerler',
  'trips.filter.all': 'Tümü',
  'trips.filter.favourites': 'Favoriler',
  'trips.view.label': 'Görünüm',
  'trips.view.grid': 'Izgara',
  'trips.view.list': 'Liste',
  'trips.card.favourite': 'Favori',
  'trips.card.noDestination': 'Varış yeri henüz belli değil',
  'trips.card.noDates': 'Tarihler henüz belli değil',
  'trips.card.startsIn': '{days} gün sonra',
  'trips.card.days': '{days} g',
  'trips.card.copying': 'Kopyalanıyor',
  'trips.card.copyingLabel': '{title} hâlâ kopyalanıyor',
  'trips.card.copyingReason': 'Kopyalama bitene kadar bekleyin.',
  'metric.trips': 'Geziler',
  'metric.places': 'Yerler',
  'metric.members': 'Üyeler',
  'metric.files': 'Dosyalar',
  'metric.storage_bytes': 'Depolama',
  'metric.collections': 'Koleksiyonlar',
  'metric.journeys': 'Günlükler',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Bu yüklenmedi',
  'error.body':
    'Hiçbir şey kaybolmadı. Yeniden deneyin; sürerse aşağıdaki ayrıntıyı bize gönderin.',
  'error.retry': 'Yeniden dene',
  'error.dashboard': 'Panoya geri dön',
  'error.reported': 'Bize bildirildi ve konuya bakıyoruz.',
  'error.reference': 'Referans numarası',
  'error.feedback.open': 'Ne olduğunu bize anlatın',
  'error.feedback.label': 'Bu olduğunda ne yapıyordunuz?',
  'error.feedback.send': 'Gönder',
  'error.feedback.sent': 'Teşekkürler — bu bize çok yardımcı oluyor.',
  'error.feedback.failed':
    'Gönderilemedi. Yukarıdaki referans yine de bize ulaşıyor.',
  'error.root': 'Rotadan çıktık',
  'error.session': 'Çalışma alanı erişiminiz değişti',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Sorun bildir',
  'feedback.formTitle': 'Sorun bildir',
  'feedback.messageLabel': 'Ne yanlış ya da ne değişmeli?',
  'feedback.messagePlaceholder': 'Ne bekliyordunuz, onun yerine ne oldu?',
  'feedback.emailLabel': 'E-posta adresi',
  'feedback.emailPlaceholder': 'ali@example.com',
  'feedback.isRequiredLabel': '(zorunlu)',
  'feedback.submitButtonLabel': 'Bildirimi gönder',
  'feedback.cancelButtonLabel': 'Vazgeç',
  'feedback.confirmButtonLabel': 'Onayla',
  'feedback.addScreenshotButtonLabel': 'Ekran görüntüsü ekle',
  'feedback.removeScreenshotButtonLabel': 'Ekran görüntüsünü kaldır',
  'feedback.highlightToolText': 'Vurgula',
  'feedback.hideToolText': 'Gizle',
  'feedback.successMessageText': 'Teşekkürler — bildiriminiz bize ulaştı.',
  'feedback.errorEmptyMessageText':
    'Önce bir cümle yazın — boş bir bildirim bize hiçbir şey anlatmaz.',
  'feedback.errorTimeoutText':
    'Bu çok uzun sürüyor ve bildirimin gönderildiğini doğrulayamıyoruz.',
  'feedback.errorForbiddenText': 'Bu sayfanın bildirim gönderme izni yok.',
  'feedback.errorGenericText':
    'Gönderilemedi. Bağlantıyı ve araya bir reklam engelleyici girip girmediğini kontrol edin.',

  'notFound.eyebrow': 'Hata 404',
  'notFound.title': 'Bu sayfa haritada yok',
  'notFound.body':
    'Bağlantı güncelliğini yitirmiş olabilir ya da işaret ettiği gezi taşınmış veya silinmiş olabilir.',
  'notFound.trips': 'Tüm geziler',
  'notFound.rootBody':
    'Rota boyunca her yere baktık. Adres yanlış yazılmış olabilir ya da sayfa çoktan yola koyulmuş olabilir.',
  'notFound.home': 'Ana sayfaya dön',
  'notFound.plans': 'Paketlerimize bakın',

  'session.noWorkspace':
    'Hesabınız henüz bir çalışma alanına bağlı değil. Kurulumu tamamlamak için çıkış yapıp yeniden girin.',
  'session.membershipRemoved': 'Bu çalışma alanındaki üyeliğiniz kaldırıldı.',
  'session.workspaceChanged':
    'Çalışma alanı başka bir sekmede veya pencerede değiştirildi. Hiçbir şey kaydedilmedi.',
  'session.workspaceChangedTitle': 'Çalışma alanı başka bir sekmede değişti',
  'session.workspaceChangedBody':
    'Bu sekme {name} çalışma alanını gösteriyor, ancak çalışma alanı başka bir sekmede veya pencerede değiştirildi. Hiçbir şey kaydedilmedi.',
  'session.openCurrentWorkspace': 'Geçerli çalışma alanını aç',
  'session.workspaceChangedDismiss': 'Şimdi değil',
} satisfies TranslationOf<typeof En>

export default messages
