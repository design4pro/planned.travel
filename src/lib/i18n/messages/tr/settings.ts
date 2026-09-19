/**
 * Everything the settings module says, in Turkish.
 *
 * Made from `../en/settings.ts` and from nothing else. `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations, so every sentence here was written against our English source.
 *
 * **One word for a subscription.** A paid tier is «paket» here, as it is in
 * `../tr/shell.ts`, so that the billing screen and the top-bar menu name the
 * same thing the same way.
 *
 * **A plan's name is a word, not a mark.** `billing.plan.<id>.name` is
 * translated like any other noun, because the id — `free`, `solo`, `crew` — is
 * what `src/lib/plans.ts`, Polar and the invoice carry, and no reader ever sees
 * it. `Polar`, `PDF` and `Face ID` stay as they are: a company, a format and a
 * trademark. `Avro` is the Turkish spelling the language academy prescribes for
 * the currency, not a loan of the English one.
 *
 * **A language is never named in English**, and never named here either: all
 * twenty-three come from the frozen registry in `src/lib/i18n/locales.ts`, so no
 * key below spells one.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Hesap',
  'page.title': 'Ayarlar',
  'page.description':
    'Sizinle, çalışma alanınızla ve planned.travel’in davranışıyla ilgili her şey',
  'page.error': 'Ayarlar yüklenmedi',

  'nav.label': 'Ayar bölümleri',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Siz, tarihler ve tutarlar',
  'nav.language': 'Dil',
  'nav.language.hint': 'Her ekranın konuştuğu dil',
  'nav.appearance': 'Görünüm',
  'nav.appearance.hint': 'Tema, hareket ve harita',
  'nav.security': 'Güvenlik',
  'nav.security.hint': 'Şifre, iki adım, geçiş anahtarları',
  'nav.notifications': 'Bildirimler',
  'nav.notifications.hint': 'Gelen kutusu, e-posta ve telefon',
  'nav.workspace': 'Çalışma alanı',
  'nav.workspace.hint': 'Üyeler ve ortak varsayılanlar',
  'nav.billing': 'Ödeme',
  'nav.billing.hint': 'Paket, koltuklar ve faturalar',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Değişiklikleri kaydet',
  'error.retryBody':
    'Hiçbir şey kaybolmadı. Bağlantınızı kontrol edip yeniden deneyin.',
  'role.owner': 'Sahip',
  'role.admin': 'Yönetici',
  'role.member': 'Üye',

  /* -------------------------------------------------- regional option labels */
  /* 206px truncating trigger: «Çalışma alanından» measured 210px and clipped
     live. «Ortak varsayılan» is this catalogue's own wording for the same thing
     in `nav.workspace.hint`, and measures 198px. */
  'regional.workspaceDefault': 'Ortak varsayılan — {value}',
  'regional.currency.AUD': 'Avustralya doları',
  'regional.currency.CAD': 'Kanada doları',
  'regional.currency.CHF': 'İsviçre frangı',
  'regional.currency.EUR': 'Avro',
  'regional.currency.GBP': 'İngiliz sterlini',
  'regional.currency.JPY': 'Japon yeni',
  'regional.currency.PLN': 'Polonya zlotisi',
  'regional.currency.SEK': 'İsveç kronu',
  'regional.currency.USD': 'ABD doları',
  'regional.distance.metric': 'Kilometre',
  'regional.distance.imperial': 'Mil',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Profiliniz yüklenmedi',
  'profile.account.title': 'Hesabınız',
  'profile.account.description':
    'Adınız ve e-posta adresiniz, giriş yaptığınız hesaptan gelir.',
  'profile.email.verified': 'E-posta doğrulandı',
  'profile.email.unverified': 'E-posta doğrulanmadı',
  'profile.twoFactor.on': 'İki adımlı doğrulama açık',
  'profile.figure.workspace': 'Çalışma alanı',
  'profile.figure.role': 'Rol',
  'profile.figure.joined': 'Üyelik başlangıcı',
  'profile.figure.joinedUnknown': 'Kayıtlı değil',
  'profile.regional.title': 'Tarihler, tutarlar ve birimler',
  'profile.regional.description':
    'Bunlar yalnızca sizin için çalışma alanı varsayılanlarının yerine geçer. Birini varsayılanda bırakırsanız çalışma alanını izler.',
  'profile.regional.saving': 'Tercihleriniz kaydediliyor',
  'profile.regional.saved': 'Tercihleriniz kaydedildi',
  'profile.regional.saveFailed': 'Tercihleriniz kaydedilmedi',
  'profile.language.label': 'Dil',
  'profile.language.hint':
    'Kendi ekranında seçilir; orada her dil kendi yazısıyla yazılıdır.',
  'profile.language.action': 'Değiştir',
  'profile.timezone.label': 'Saat dilimi',
  'profile.timezone.hint': 'Kalkış ve varış saatleri buna göre gösterilir.',
  'profile.currency.label': 'Para birimi',
  'profile.currency.hint':
    'Yeni geziler bu para biriminde başlar; her gezi bunu değiştirebilir.',
  'profile.dateFormat.label': 'Tarih biçimi',
  'profile.weekStart.label': 'Hafta şu gün başlar',
  'profile.weekStart.hint':
    'Tatil yılı ızgarası dahil her takvim için geçerlidir.',
  'profile.distance.label': 'Mesafe',

  /* --------------------------------------------------------------- language */
  'language.error': 'Dil ayarlarınız yüklenmedi',
  'language.section.title': 'Dil',
  'language.section.description':
    'Her ekran, her düğme ve her tarih burada seçtiğiniz dilde okunur — yirmi üç dil, her biri kendi yazısıyla.',
  'language.label': 'Bir dil seçin',
  'language.followWorkspace': 'Çalışma alanını izle',
  'language.state.yours': 'Sizin diliniz',
  'language.state.workspace': 'Çalışma alanından geliyor',
  'language.state.hint.override':
    'Kendi seçiminiz. Yalnızca sizin için, giriş yaptığınız her cihazda geçerli.',
  'language.state.hint.workspace':
    'Kendinize ait bir diliniz yok, bu yüzden çalışma alanı hangi dile ayarlıysa onu okuyorsunuz. Bunu bir sahip ya da yönetici Çalışma alanı bölümünden değiştirebilir.',
  'language.saved': 'planned.travel artık {language} konuşuyor',
  'language.saveFailed': 'Diliniz değişmedi',
  'language.saveFailedBody':
    'Hiçbir şey kaybolmadı ve hâlâ {language} okuyorsunuz. Bağlantınızı kontrol edip yeniden seçin.',
  'language.reload.title': 'Diliniz kaydedildi',
  'language.reload.body':
    'Bu sayfa {language} diline geçişi tamamlayamadı. Ürünü yeni dilinizde okumak için sayfayı yenileyin.',
  'language.sample.title': 'Tarihler ve sayılar nasıl okunacak',
  'language.sample.description': 'Aynı üç değer, bu dilin yazdığı biçimde.',
  'language.sample.date': 'Bir tarih',
  'language.sample.number': 'Bir sayı',
  'language.sample.money': 'Bir tutar',
  'language.legal':
    'Koşullar ve gizlilik bildirimi yalnızca İngilizce yayımlanır. Ürünün geri kalanı çevrilmiştir.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Görünüm yüklenmedi',
  'appearance.theme.title': 'Tema',
  'appearance.theme.description':
    'İki tema da tasarlandı, biri diğerinin tersi değil. Gözünüze en rahat geleni seçin.',
  'appearance.theme.light': 'Açık',
  'appearance.theme.lightHint': 'Sıcak kâğıt, gün boyu',
  'appearance.theme.dark': 'Koyu',
  'appearance.theme.darkHint': 'Sıcak kömür grisi, asla siyah değil',
  'appearance.theme.system': 'Sistem',
  'appearance.theme.systemHint': 'Cihazı izler',
  'appearance.theme.showing': 'Şu anda {palette} palet gösteriliyor.',
  'appearance.theme.showingSystem':
    'Şu anda {palette} palet gösteriliyor, cihazınızı izleyerek.',
  'appearance.palette.light': 'açık',
  'appearance.palette.dark': 'koyu',
  'appearance.motion.title': 'Hareket ve haritalar',
  'appearance.motion.label': 'Hareketi azalt',
  'appearance.motion.hint':
    'Giriş animasyonlarını yalın bir solmaya indirir. İşletim sisteminizin kendi hareket azaltma ayarına da her zaman uyulur.',
  'appearance.map.label': 'Harita stili',
  'appearance.map.hint':
    'Planlayıcıda ve dünya haritasında kullanılan taban harita.',
  'appearance.map.workspace': 'Çalışma alanını izle',
  'appearance.map.workspaceHint': 'Çalışma alanının sahibinin seçtiği stil.',
  'appearance.map.auto': 'Otomatik',
  'appearance.map.autoHint': 'Açık veya koyu temanızı izler.',
  'appearance.map.paper': 'Kâğıt',
  'appearance.map.paperHint': 'Hangi temada olursanız olun sıcak ve açık.',
  'appearance.map.charcoal': 'Kömür grisi',
  'appearance.map.charcoalHint': 'Hangi temada olursanız olun sıcak ve koyu.',
  'appearance.map.quiet': 'Sakin',
  'appearance.map.quietHint': 'Yol adları olmadan, iğneleriniz önce okunur.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Paylaşılan bir ekranda',
  'appearance.privacy.codesLabel': 'Onay kodlarını ben isteyene kadar gizle',
  'appearance.privacy.codesHint':
    'Rezervasyon referansları ve onay numaraları; rezervasyon masasında ve ulaşımda, tıklayana veya dokunana kadar maskeli kalır ve başka bir yere geçtiğinizde yeniden maskelenir. Fiyatlar asla gizlenmez.',
  'appearance.saveFailed': 'Bu değişiklik kaydedilmedi',
  'appearance.saveFailedBody':
    'Burada görünüyor ama giriş yapacağınız bir sonraki cihazda olmayacak.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Güvenlik yüklenmedi',
  'security.unverified.title': 'E-posta adresiniz henüz doğrulanmadı',
  'security.unverified.body':
    'Şifre sıfırlamaları ve gezi davetleri {email} adresine gönderilir. Doğrulama, adresin size ait olduğunu kanıtlayan şeydir.',
  'security.unverified.action': 'Bağlantıyı yeniden gönder',
  'security.signin.title': 'Giriş',
  'security.signin.description':
    'Kim olduğunuzu nasıl kanıtlıyorsunuz. İki adımlı doğrulama ve geçiş anahtarları, tek başına şifreden daha güçlüdür.',
  'security.email.label': 'E-posta adresi',
  'security.email.verified': 'Doğrulandı',
  'security.email.unverified': 'Doğrulanmadı',
  'security.password.label': 'Şifre',
  'security.password.hint':
    'İstediğiniz zaman değiştirin — eskisini sormak yerine size tek kullanımlık bir bağlantı gönderilir.',
  'security.password.action': 'Şifreyi değiştir',
  'security.twoFactor.label': 'İki adımlı doğrulama',
  'security.twoFactor.onHint':
    'Her yeni girişte doğrulayıcı uygulamanızdan bir kod istenir.',
  'security.twoFactor.offHint':
    'Şifrenizin üstüne bir doğrulayıcı uygulamadan altı haneli kod ekleyin.',
  'security.twoFactor.on': 'Açık',
  'security.twoFactor.off': 'Kapalı',
  'security.twoFactor.manage': 'Yönet',
  'security.twoFactor.enable': 'Aç',
  'security.passkeys.label': 'Geçiş anahtarları',
  'security.passkeys.hint':
    'Bir şey yazmak yerine parmak izi okuyucuyla, Face ID ile veya güvenlik anahtarıyla girin.',
  'security.passkeys.action': 'Geçiş anahtarlarını yönet',
  'security.session.title': 'Bu oturum',
  'security.session.description': 'Bunu okuduğunuz tarayıcı.',
  'security.session.label': 'Giriş yapan',
  'security.session.expires': '{date} tarihinde doluyor',
  'security.session.expiresSoon': 'yakında',
  'security.session.noExpiry': 'Kayıtlı bitiş tarihi yok',
  'security.signOut.label': 'Çıkış yap',
  'security.signOut.hint':
    'Bu oturumu kapatır ve sizi giriş sayfasına döndürür. Diğer cihazlar açık kalır.',
  'security.signOut.pending': 'Çıkış yapılıyor',
  'security.signOut.failed': 'Çıkış yapılmadı',
  'security.signOut.failedBody': 'Bağlantınızı kontrol edip tekrar deneyin.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Bildirim ayarları yüklenmedi',
  'notifications.title': 'Bildirimler',
  'notifications.description':
    'Her anahtar yalnızca sizin için geçerli. Birini kapatmak olayın gerçekleşmesini engellemez — yalnızca size haber vermemizi engeller.',
  'notifications.caption': 'Hangi bildirim hangi kanala ulaşıyor',
  'notifications.event': 'Olay',
  'notifications.switch': '{event}, {channel} üzerinden',
  'notifications.saveFailed': 'Bu tercih kaydedilmedi',
  'notifications.saveFailedBody':
    'Anahtar eski konumuna döndü. Bağlantınızı kontrol edip yeniden deneyin.',
  'notifications.channel.in_app': 'Uygulamada',
  'notifications.channel.in_app.hint': 'Üst çubuktaki zil',
  'notifications.channel.email': 'E-posta',
  'notifications.channel.email.hint': 'Giriş adresinize gönderilir',
  'notifications.channel.push': 'Anlık bildirim',
  'notifications.channel.push.hint': 'İzin verdiğiniz cihazlarda',
  'notifications.event.trip.invited': 'Gezi davetleri',
  'notifications.event.trip.invited.hint':
    'Birisi sizi planladığı bir geziye ekler.',
  'notifications.event.trip.updated': 'Program değişiklikleri',
  'notifications.event.trip.updated.hint':
    'İçinde olduğunuz bir gezide gün, durak ya da tarih kayar.',
  'notifications.event.trip.starting_soon': 'Kalkış hatırlatmaları',
  'notifications.event.trip.starting_soon.hint':
    'Gezi başlamadan önceki günlerde bir dürtme.',
  'notifications.event.reservation.reminder': 'Rezervasyon hatırlatmaları',
  'notifications.event.reservation.reminder.hint':
    'Bir konaklama, masa ya da bilet yaklaşıyor.',
  'notifications.event.expense.added': 'Yeni masraflar',
  'notifications.event.expense.added.hint':
    'Birisi ortak bir gezide harcanan parayı kaydeder.',
  'notifications.event.expense.settled': 'Kapanan hesaplar',
  'notifications.event.expense.settled.hint':
    'Dahil olduğunuz bir bakiye ödendi.',
  'notifications.event.list.assigned': 'Atanan maddeler',
  'notifications.event.list.assigned.hint':
    'Valiz ya da yapılacaklar listesindeki bir şey size geçer.',
  'notifications.event.collab.message': 'Gezi sohbeti',
  'notifications.event.collab.message.hint':
    'Yolculuk ettiğiniz bir gezide yeni mesajlar.',
  'notifications.event.organization.invited': 'Çalışma alanı davetleri',
  'notifications.event.organization.invited.hint':
    'Bir çalışma alanına davet ediliyorsunuz.',

  'notifications.event.billing.plan_changed': 'Abonelik değişiklikleri',
  'notifications.event.billing.plan_changed.hint':
    'Çalışma alanınız başka bir pakete geçiyor.',
  'notifications.event.billing.invoice_paid': 'Ödeme makbuzları',
  'notifications.event.billing.invoice_paid.hint':
    'Çalışma alanınızın bir faturası ödendi.',
  'notifications.event.billing.payment_failed': 'Ödeme sorunları',
  'notifications.event.billing.payment_failed.hint':
    'Çalışma alanınız için bir tahsilat gerçekleşmedi.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Çalışma alanı yüklenmedi',
  'workspace.summary.description':
    '{plan} paketi · {date} tarihinde oluşturuldu',
  'workspace.summary.createdRecently': 'kısa süre önce',
  'workspace.summary.billingAction': 'Paket ve ödeme',
  'workspace.seats.label': 'Kullanılan koltuk',
  'workspace.seats.value': '{limit} koltuktan {used}',
  'workspace.seats.note':
    'Açık davetler koltuklarınızdan düşer; böylece bir çalışma alanı ödediği paketi asla aşamaz.',
  'workspace.seatsFull.title': 'Bu paketteki tüm koltuklar dolu',
  'workspace.seatsFull.body':
    '{members} ve {invitations}, {limit} koltuğun tamamını dolduruyor.',
  'workspace.seatsFull.action': 'Koltuk ekle',
  'workspace.members.count': {
    one: '{value} üye',
    other: '{value} üye',
  },
  'workspace.invitations.count': {
    one: '{value} bekleyen davet',
    other: '{value} bekleyen davet',
  },
  'workspace.members.title': 'Üyeler',
  'workspace.members.description':
    'Bu çalışma alanındaki gezileri, parayı ve dosyaları görebilen herkes.',
  'workspace.members.tableLabel': 'Bu çalışma alanının üyeleri',
  'workspace.members.person': 'Kişi',
  'workspace.members.role': 'Rol',
  'workspace.members.joined': 'Katıldı',
  'workspace.invitations.title': 'Davetler',
  'workspace.invitations.description': 'Davet edilip henüz katılmamış kişiler.',
  'workspace.invitations.emptyTitle': 'Açık davet yok',
  'workspace.invitations.emptyBody':
    'Bu çalışma alanına davet edilen herkes zaten katıldı.',
  'workspace.invitations.expires': '{date} tarihinde doluyor',
  'workspace.invitations.expiresSoon': 'yakında',
  'workspace.defaults.title': 'Ortak varsayılanlar',
  'workspace.defaults.description':
    'Yeni bir gezi ve yeni bir üye neyle başlar. Herkes bunları kendi profilinde kendisi için değiştirebilir.',
  'workspace.defaults.readOnly': 'Salt okunur',
  'workspace.defaults.saving': 'Çalışma alanı varsayılanları kaydediliyor',
  'workspace.defaults.saved': 'Çalışma alanı varsayılanları kaydedildi',
  'workspace.defaults.saveFailed': 'Çalışma alanı varsayılanları kaydedilmedi',
  'workspace.defaults.saveFailedBody':
    'Bunları yalnızca bir sahip ya da yönetici değiştirebilir. Bağlantınızı kontrol edip yeniden deneyin.',
  'workspace.currency.label': 'Varsayılan para birimi',
  'workspace.currency.hint': 'Yeni gezilerin bütçesi bununla tutulur.',
  'workspace.language.label': 'Dil',
  'workspace.language.hint': 'Kendine dil seçmemiş bir üyenin okuduğu dil.',
  'workspace.timezone.label': 'Saat dilimi',
  'workspace.dateFormat.label': 'Tarih biçimi',
  'workspace.weekStart.label': 'Hafta şu gün başlar',
  'workspace.distance.label': 'Mesafe',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Ödeme bilgileri yüklenmedi',
  'billing.loading': 'Paket ve faturaları yükleniyor',
  'billing.status.none': 'Abonelik yok',
  'billing.status.trialing': 'Deneme',
  'billing.status.active': 'Etkin',
  'billing.status.past_due': 'Ödeme başarısız',
  'billing.status.unpaid': 'Ödenmedi',
  'billing.status.paused': 'Duraklatıldı',
  'billing.status.canceled': 'İptal edildi',
  'billing.status.incomplete': 'Tamamlanmadı',
  'billing.status.incomplete_expired': 'Süresi doldu',

  'billing.checkout.completeTitle': 'Ödeme alındı',
  'billing.checkout.completeBody':
    'Yeni paketiniz uygulanıyor. Polar onayladığı anda burada görünür — genelde birkaç saniye içinde.',
  'billing.checkout.cancelledTitle': 'Ödeme iptal edildi',
  'billing.checkout.cancelledBody':
    'Hiçbir tahsilat yapılmadı ve paketiniz değişmedi.',
  'billing.portal.backTitle': 'Polar’tan dönüş',
  'billing.portal.backBody':
    'Orada değiştirdiğiniz her şey, Polar onaylar onaylamaz buraya iner.',
  'billing.refresh': 'Yenile',
  'billing.readOnly.title': 'Bu çalışma alanının bir üyesisiniz',
  'billing.readOnly.body':
    'Aboneliği yalnızca bir sahip ya da yönetici değiştirebilir. Aşağıdaki her şey sizin için salt okunur.',

  'billing.hero.label': 'Geçerli paket',
  'billing.hero.endsAtPeriod': 'Dönem sonunda biter',
  'billing.hero.perYear': '/ yıl',
  'billing.hero.perMonth': '/ ay',
  'billing.hero.freeAllowance': '{trips} gezi, tek yolcu',
  'billing.hero.perSeatLine': '{seats} üye × {price}',
  'billing.hero.singleTraveller': 'Tek yolcu',
  'billing.price.free': 'Ücretsiz',
  'billing.provider.opening': 'Polar açılıyor',
  'billing.renewal.trialEndsToday':
    'Deneme süren bugün sona eriyor. İptal etmezsen ilk ödeme hemen ardından alınır.',
  'billing.renewal.trialEndsIn': {
    one: 'Deneme süren {value} gün sonra bitiyor, ardından iptal etmezsen ilk ödeme alınır.',
    other:
      'Deneme süren {value} gün sonra bitiyor, ardından iptal etmezsen ilk ödeme alınır.',
  },
  'billing.renewal.trialEnded': 'Deneme süreniz bitti.',
  'billing.renewal.endsNoDate':
    'Bu paket bitecek şekilde ayarlı ve yenilenmeyecek.',
  'billing.renewal.endsOn':
    'Bu paket {date} tarihinde bitiyor. Hiçbir şey silinmez — ücretli modüller yalnızca kilitlenir.',
  'billing.renewal.pastDue':
    'Son ödeme geçmedi. Ücretli modülleri kaybetmemek için kartınızı güncelleyin.',
  'billing.renewal.unpaid': 'Bu abonelik ödenmedi ve ücretli modüller kilitli.',
  'billing.renewal.paused':
    'Bu abonelik duraklatıldı. Yeniden yola çıkmaya hazır olduğunuzda sürdürün.',
  'billing.renewal.lapsed':
    'Rezervasyonları, günlüğü ve çevrimdışı haritaları yeniden açmak için aşağıdan bir paket seçin.',
  'billing.renewal.incomplete': 'Polar bu ödemenin onaylanmasını bekliyor.',
  'billing.renewal.free':
    'Aynı anda iki gezi, bizden. Size küçük gelmeye başlayınca yükseltin.',
  'billing.renewal.auto': 'Otomatik yenilenir.',
  'billing.renewal.renewsOn': '{date} tarihinde yenilenir.',

  'billing.usage.title': 'Kullanım',
  'billing.usage.description':
    'Canlı sayılır, böylece hiçbir gösterge eskimez. Sınırlar şu anda geçerli paketi izler.',
  'billing.quota.seats': 'Üyeler',
  'billing.quota.trips': 'Geziler',
  'billing.quota.storageBytes': 'Depolama',
  'billing.quota.unlimited': 'Sınırsız',
  'billing.quota.noLimit': 'Bu pakette sınır yok',
  'billing.quota.used': 'kullanılan {quota}',
  'billing.quota.over.seats': {
    one: 'Bu paketin sınırının {value} koltuk üstünde',
    other: 'Bu paketin sınırının {value} koltuk üstünde',
  },
  'billing.quota.over.trips': {
    one: 'Bu paketin sınırının {value} gezi yeri üstünde',
    other: 'Bu paketin sınırının {value} gezi yeri üstünde',
  },
  'billing.quota.over.storage': 'Bu paketin sınırının {value} üstünde',
  'billing.quota.exhausted.seats': 'Bu paketteki tüm koltuklar dolu',
  'billing.quota.exhausted.trips': 'Bu paketteki tüm gezi yerleri kullanımda',
  'billing.quota.exhausted.storage': 'Bu paketin depolama alanı doldu',
  'billing.quota.left': '{value} kaldı',

  'billing.plans.title': 'Paketler',
  'billing.plans.description':
    'Paketi istediğiniz zaman değiştirin. Yükseltmeler güne göre oranlanır; düşürme, ödediğiniz dönem bitene kadar bekler.',
  'billing.interval.label': 'Ödeme aralığı',
  'billing.interval.monthly': 'Aylık',
  'billing.interval.yearly': 'Yıllık',
  'billing.plan.free.name': 'Ücretsiz',
  'billing.plan.free.tagline': 'Sıradaki iki gezinizi planlayın',
  'billing.plan.free.feature.trips': 'Aynı anda iki gezi',
  'billing.plan.free.feature.itinerary': 'Gün gün program ve harita',
  'billing.plan.free.feature.lists': 'Valiz listeleri ve basit bütçeler',
  'billing.plan.free.feature.atlas':
    'Nerelerde bulunduğunuzu izleyen dünya haritası',
  'billing.plan.solo.name': 'Bireysel',
  'billing.plan.solo.tagline': 'Her şeyi planlayan yolcu için',
  'billing.plan.solo.feature.trips': 'Sınırsız gezi',
  'billing.plan.solo.feature.modules':
    'Her planlama modülü — rezervasyonlar, günlük, bütçeler, valiz',
  'billing.plan.solo.feature.offline':
    'Uçmadan önce indirdiğiniz çevrimdışı haritalar',
  'billing.plan.solo.feature.export': 'PDF ve takvim dışa aktarımı',
  'billing.plan.crew.name': 'Ekip',
  'billing.plan.crew.tagline': 'Aileler, arkadaşlar ve küçük ekipler için',
  'billing.plan.crew.feature.members':
    'On üyeye kadar, kişi başı ücretlendirme',
  'billing.plan.crew.feature.realtime':
    'Canlı imleçlerle gerçek zamanlı ortak çalışma',
  'billing.plan.crew.feature.everything': 'Sınırsız gezi ve her modül',
  'billing.plan.crew.feature.storage':
    'Herkesin fotoğrafı ve belgesi için ortak alan',

  'billing.plan.current': 'Geçerli paket',
  'billing.plan.currentBadge': 'Geçerli',
  'billing.plan.popular': 'Popüler',
  'billing.plan.switchYearly': 'Yıllığa geç',
  'billing.plan.switchMonthly': 'Aylığa geç',
  'billing.plan.upgradeTo': '{plan} paketine yükselt',
  'billing.plan.changeTo': '{plan} paketine değiştir',
  'billing.plan.perMemberMonth': '/ üye / ay',
  'billing.plan.perMonth': '/ ay',
  'billing.plan.alwaysFree': 'Her zaman ücretsiz, kart gerekmez',
  'billing.plan.billedYearly': 'Yıllık {amount} tahsil edilir',
  'billing.plan.billedMonthly': 'Aylık {amount} tahsil edilir',
  'billing.plan.members': 'Üyeler',
  'billing.plan.membersHint': 'İstediğiniz zaman değiştirin — ödeme buna uyar.',
  'billing.plan.seatOption': {
    one: '{value} üye',
    other: '{value} üye',
  },

  'billing.invoices.number': 'Fatura',
  'billing.invoices.date': 'Tarih',
  'billing.invoices.amount': 'Tutar',
  'billing.invoices.status': 'Durum',
  'billing.invoice.paid': 'Ödendi',
  'billing.invoice.draft': 'Taslak',
  'billing.invoice.void': 'Geçersiz',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Ödeme sağlayıcısı bu isteği reddetti. Birazdan yeniden dene.',
  'billing.planChanged.title': 'Plan güncellendi',
  'billing.planChanged.body':
    'Değişiklik Polar tarafında zaten geçerli; farkı o faturalandıracak. Aşağıdaki özet bir dakika içinde yetişir.',
  'billing.hero.manage': 'Faturalandırmayı yönet',
  'billing.hero.manageHint':
    'Kartlar, fatura adresi, vergi numarası, makbuzlar ve iptal, faturayı kesen Polar tarafında.',
  'billing.hero.manageHintNone':
    'Henüz fatura profili yok. Aşağıdan ücretli bir plan seçmek bir tane oluşturur ve portal o andan sonra açılır.',
  'billing.portal.opening': 'Fatura portalı açılıyor',
  'billing.plan.notApplied': 'Bu değişiklik uygulanmadı',
  'billing.plan.cancelInPortal': 'Portalda iptal et',
  'billing.plan.seatsOverMax': {
    one: 'Bu çalışma alanında {members} üye var ve {plan} en fazla {max} üyeyi faturalandırıyor. Geçmeden önce {value} üyeyi çıkar.',
    other:
      'Bu çalışma alanında {members} üye var ve {plan} en fazla {max} üyeyi faturalandırıyor. Geçmeden önce {value} üyeyi çıkar.',
  },
  'billing.plan.seatsBelowMembers':
    '{members} üyen var. En az o kadar koltuk seç — Polar, atamadan az koltuklu aboneliği reddeder.',
  'billing.orders.title': 'Siparişler',
  'billing.orders.description':
    'Bu çalışma alanının her siparişi, en yeniden başlayarak.',
  'billing.orders.receipts': 'Tüm makbuzlar',
  'billing.orders.unavailableTitle': 'Siparişler yüklenmiyor',
  'billing.orders.unavailableBody':
    'Polar geçmiş için zamanında yanıt vermedi. Yukarıdakilerin hepsi güncel — birazdan yeniden dene ya da tam kaydı fatura portalında oku.',
  'billing.orders.emptyTitle': 'Henüz sipariş yok',
  'billing.orders.emptyCustomer':
    'İlk fatura, bir fatura dönemi kapandığı anda burada görünür.',
  'billing.orders.emptyNoCustomer':
    'Bu çalışma alanından hiç ücret alınmadı. Ücretli bir plan seç, faturalar burada toplanmaya başlar.',
  'billing.orders.tableLabel': 'Sipariş geçmişi',
  'billing.orders.document': 'Belge',
  'billing.orders.dateUnknown': 'Tarih bilinmiyor',
  'billing.order.pending': 'Beklemede',
  'billing.order.refunded': 'İade edildi',
  'billing.order.partiallyRefunded': 'Kısmen iade edildi',
  'billing.order.noInvoiceDraft': 'Sipariş taslak olduğu sürece fatura yok',
  'billing.order.preparing': 'Hazırlanıyor',
  'billing.order.renderingHint':
    'Polar {number} numaralı faturayı hâlâ oluşturuyor. İndirme birkaç saniye içinde geri gelir.',
  'billing.order.fetching': 'Fatura alınıyor',
  'billing.order.generating': 'Polar faturayı hazırlıyor',
  'billing.order.pdfLabel': '{number} numaralı fatura, PDF olarak',
  'billing.order.stillWritingTitle': 'Polar o faturayı hâlâ yazıyor',
  'billing.order.stillWritingBody':
    '{number} numaralı fatura oluşturuluyor. İndirme birkaç saniye içinde kendiliğinden geri gelir.',
  'billing.order.openFailed': 'O fatura açılmadı',
} satisfies TranslationOf<typeof En>

export default messages
