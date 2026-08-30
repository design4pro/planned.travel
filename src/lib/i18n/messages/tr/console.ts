/**
 * Platform konsolunun söylediği her şey, Türkçe.
 *
 * `../en/console.ts` temel alınarak yazıldı (`docs/SPEC.md` §9). İngilizce dosya şemadır:
 * `TranslationOf<typeof En>` eksik ya da uydurulmuş bir anahtarı derleme hatasına çevirir,
 * `__tests__/parity.test.ts` ise yer tutucuları, çoğul dallarını ve burada İngilizce hiçbir şeyin
 * kalmadığını denetler.
 *
 * **Çoğul.** `Intl.PluralRules('tr')` `one` ve `other` bildirir; Türkçede sayıdan sonra ad tekil
 * kalır, bu yüzden iki dalda da ad tekildir.
 *
 * **Birbirine hiç karışmayan iki rol ölçeği** (§5). Platformda: yönetici, küratör, kullanıcı.
 * Çalışma alanında: sahip, yönetici, üye. Aynı sözcük ikisine de düşer, farkı çevresindeki cümle
 * taşır.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* -------------------------------------------------------------- bölümler -- */

  'nav.label': 'Konsol bölümleri',
  'nav.overview': 'Genel bakış',
  'nav.overview.description': 'Platform bir bakışta',
  'nav.accounts': 'Hesaplar',
  'nav.accounts.description': 'Roller, askıya almalar ve oturumlar',
  'nav.runs': 'Ajan koşuları',
  'nav.runs.description': 'Sandcastle filosunun ne kurduğu',

  /* ----------------------------------------------------------------- kabuk -- */

  'shell.eyebrow': 'Platform yönetimi',
  'shell.title': 'Konsol',
  'shell.description': 'Ürünün kendisi — hesaplar, yetkiler ve ortak katalog',
  'shell.signedInAs': 'Şu olarak girildi:',
  'shell.error.title': 'Konsol yüklenmedi',
  'shell.notFound.title': 'Böyle bir hesap yok',
  'shell.notFound.body':
    'Platformda hiçbir şey bu kimliği taşımıyor. Hesap, bağlantı oluşturulduktan sonra silinmiş ya da adres yanlış yazılmış olabilir.',
  'shell.allAccounts': 'Tüm hesaplar',
  'shell.overview': 'Konsolun genel görünümü',

  'failure.fallback': 'İşlem geçmedi. Birazdan yeniden deneyin.',

  /* ------------------------------------------------------------ genel bakış -- */

  'overview.error.title': 'Genel bakış yüklenmedi',
  'overview.standing.title': 'Platformdaki yetkileriniz',
  'overview.standing.body':
    'Hesaplar, oturumlar ve başkasının adına iş görmek bir platform yöneticisine aittir, bu yüzden konsol size kataloğu gösterir, başka bir şey değil.',
  'overview.stat.accounts': 'Hesaplar',
  'overview.stat.accounts.caption': {
    one: 'Bunlardan biri platform rolü taşıyor',
    other: 'Bunlardan {staff} tanesi platform rolü taşıyor',
  },
  'overview.stat.admins': 'Yöneticiler',
  'overview.stat.admins.caption': 'Hesaplar ve oturumlar üzerinde tam yetki',
  'overview.stat.curators': 'Küratörler',
  'overview.stat.curators.caption': 'Yalnızca katalog — asla hesaplar',
  'overview.stat.suspended': 'Askıya alınmış',
  'overview.stat.suspended.none': 'Kimse dışarıda kalmadı',
  'overview.stat.suspended.some':
    'Askı kaldırılana dek her yerde oturumu kapalı',
  'overview.stat.suspended.review': 'Onlara bakın',
  'overview.newest.label': 'En yeni hesaplar',
  'overview.newest.empty.title': 'Henüz hesap yok',
  'overview.newest.empty.body': 'İlk kaydolan kişi burada görünür.',
  'overview.catalogue.label': 'Duruma göre katalog',
  'overview.catalogue.empty.title': 'Ortak katalog henüz açık değil',
  'overview.catalogue.empty.body':
    'Veri alma hattı yerine oturunca bu pano ortak katalogdaki her yeri taslak, incelemede ya da yayımlanmış olarak sayacak — ve her sayı arkasındaki listeyi açacak.',
  'overview.scraping.label': 'Toplama koşuları',
  'overview.scraping.empty.title': 'Hiçbir kaynak çalıştırılmadı',
  'overview.scraping.empty.body':
    'Kaynaklar haftada bir toplanır. İlk koşu bitince son beşi, her birinin ne aldığı, ne değiştirdiği ve neyi elediğiyle birlikte burada görünür.',

  /* ------------------------------------------------------------ rol ölçeği -- */

  'role.admin': 'Yönetici',
  'role.admin.summary':
    'Platformda tam yetki: hesaplar, roller, askıya almalar, oturumlar ve başkasının adına iş görmek.',
  'role.admin.holds.accounts': 'Hesap açmak ve platform rolü vermek',
  'role.admin.holds.bans': 'Hesap askıya almak ve askıyı kaldırmak',
  'role.admin.holds.sessions': 'Oturum iptal etmek ve şifre belirlemek',
  'role.admin.holds.impersonate':
    'On beş dakika boyunca bir hesabın adına iş görmek',
  'role.admin.holds.curation': 'Bir küratörün yapabildiği her şey',
  'role.admin.withheld.admins':
    'Başka bir platform yöneticisinin adına iş görmek',
  'role.curator': 'Küratör',
  'role.curator.summary':
    'Katalog, derlemeler, kaynaklar ve paylaşılan bağlantıların denetimi. Hesaplara dokunan hiçbir şey yok.',
  'role.curator.holds.places': 'Katalog yerlerini okumak, yazmak ve yayımlamak',
  'role.curator.holds.packs': 'Yer derlemelerini okumak, yazmak ve yayımlamak',
  'role.curator.holds.sources': 'Katalog kaynaklarını okumak ve çalıştırmak',
  'role.curator.holds.shares':
    'Paylaşılan bağlantıları incelemek ve iptal etmek',
  'role.curator.withheld.accounts': 'Bir hesaba ya da oturuma dokunan her şey',
  'role.curator.withheld.tokens':
    'Makine kimlik bilgisi vermek ya da iptal etmek',
  'role.user': 'Kullanıcı',
  'role.user.summary':
    'Platformda hiçbir yetki yok. Bu, neredeyse herkes demek.',
  'role.user.withheld.everything': 'Platformun her yetkisi, istisnasız',

  /* --------------------------------------------------------- tek bir hesap -- */

  'identity.you': 'Bu sizsiniz',
  'status.active': 'Etkin',
  'status.suspended': 'Askıya alınmış',
  'status.permanent': 'Süresiz',
  'status.until': '{date} tarihine dek',
  'status.unverified': 'Doğrulanmamış',
  'device.on': '{platform} üzerinde {browser}',
  'device.unrecognised': 'Tanınmayan cihaz',

  /* ----------------------------------------------------------- hesap listesi -- */

  'users.error.title': 'Hesap listesi yüklenmedi',
  'users.total': 'toplam {total}',
  'users.loading': 'Hesaplar yükleniyor',
  'users.table.label': 'Platform hesapları',
  'users.search.label': 'Hesaplarda ara',
  'users.search.email': 'E-posta adreslerinde ara',
  'users.search.name': 'Adlarda ara',
  'users.search.column': 'Hangi sütunda aranacak',
  'users.search.submit': 'Ara',
  'users.field.email': 'E-posta',
  'users.field.name': 'Ad',
  'users.filter.role.label': 'Platform rolüne göre süz',
  'users.filter.role.any': 'Herhangi bir rol',
  'users.filter.role.admin': 'Yöneticiler',
  'users.filter.role.curator': 'Küratörler',
  'users.filter.status.label': 'Hesap durumuna göre süz',
  'users.filter.status.any': 'Herhangi bir durum',
  'users.filter.clear': 'Süzgeçleri temizle',
  'users.filter.hint':
    'Role ya da duruma göre daraltın — her seferinde birine.',
  'users.column.account': 'Hesap',
  'users.column.role': 'Platform rolü',
  'users.column.status': 'Durum',
  'users.column.joined': 'Katılım',
  'users.column.actions': 'İşlemler',
  'users.joined': '{date} tarihinde katıldı',
  'users.pastEnd.title': 'Bu sayfa sonun ötesinde',
  'users.pastEnd.body': {
    one: 'Bu görünümde bir hesap var ve 1. sayfa sahip olduğu tek sayfa.',
    other:
      'Bu görünümde {total} hesap var, yani {pages}. {page}. sayfa bunun ötesinde kalıyor.',
  },
  'users.pastEnd.pages': {
    one: 'tek bir sayfa',
    other: '{pages} sayfa',
  },
  'users.pastEnd.back': 'İlk sayfaya dön',
  'users.empty.filtered.title': 'Bu süzgeçlere hiçbir şey uymuyor',
  'users.empty.filtered.body':
    'Platformdaki hiçbir hesap bu aramaya karşılık gelmiyor. Aramayı genişletin ya da herkesi görmek için süzgeçleri temizleyin.',
  'users.empty.title': 'Gösterilecek hesap yok',
  'users.empty.body':
    'Bu görünüm boş. Hiçbir şey süzülmüş değil, yani burada genişletilecek bir şey yok.',

  /* ------------------------------------------------------------ hesap sayfası -- */

  'account.error.title': 'Bu hesap yüklenmedi',
  'account.loading': 'Hesap yükleniyor',
  'account.meta.lastChange': 'Son değişiklik',
  'account.meta.id': 'Hesap kimliği',
  'account.banned.title': 'Bu hesap askıya alınmış',
  'account.banned.noReason':
    'Askıya almayla birlikte hiçbir gerekçe yazılmamış.',
  'account.banned.permanent': ' Bir yönetici kaldırana dek yürürlükte kalır.',
  'account.banned.until': ' {date} tarihinde kendiliğinden kalkar.',
  'account.banned.untilUnknown': 'sona erme tarihinde',
  'account.authority.label': 'Platformdaki yetkiler',
  'account.authority.may': 'Yapabilir',
  'account.authority.mayNot': 'Yapamaz',
  'account.authority.none': 'Platformda hiçbir şey.',
  'account.workspaces.label': 'Çalışma alanları',
  'account.workspaces.truncated':
    'Bu hesap, burada sayılan {listed} tanesinden daha çok çalışma alanına ait.',
  'account.workspaces.empty.title': 'Hiçbir çalışma alanında değil',
  'account.workspaces.empty.body':
    'Bu hesap henüz hiçbir çalışma alanına ait değil. İlk girişte bir tane oluşturulur ve davet edildiği her alan burada görünür.',
  'account.workspaces.column.workspace': 'Çalışma alanı',
  'account.workspaces.column.role': 'Rol',
  'account.workspaces.column.plan': 'Paket',
  'account.subscription.label': 'Abonelik',
  'account.subscription.free.title': 'Ücretsiz pakette',
  'account.subscription.free.body':
    'Bu hesabın sahibi olduğu çalışma alanı hiç kasadan geçmedi, bu yüzden abonelik kaydı taşımıyor ve ücretsiz paketin sınırlarıyla çalışıyor.',
  'account.subscription.none.title': 'Bu hesaba hiçbir şey faturalanmıyor',
  'account.subscription.none.body':
    'Bu hesabın hiçbir çalışma alanı yok. Başkasının alanında üye olmak, o alanın fatura kestiği kişi olmak değildir, yani burada toplanacak bir şey yok.',
  'account.subscription.endsAtClose': 'Dönem kapanışında biter',
  'account.subscription.seats': 'Koltuk',
  'account.subscription.seatsValue': '{limit} koltuktan {used} tanesi',
  'account.subscription.ends': 'Bitiş',
  'account.subscription.renews': 'Yenilenir',
  'account.sessions.label': 'Canlı oturumlar',
  'account.sessions.truncated':
    'Bu hesap, tek bir çağrının sıraladığından daha çok oturum tutuyor. Hiçbirinin kalmadığından emin olmak için işlemler menüsünden tüm oturumları iptal edin.',
  'account.sessions.empty.title': 'Her yerde oturumu kapalı',
  'account.sessions.empty.body':
    'Bu hesabın süresi dolmamış hiçbir oturumu yok. Yeniden giriş yaptığı anda burada görünür.',
  'account.sessions.column.device': 'Cihaz',
  'account.sessions.column.address': 'Adres',
  'account.sessions.column.started': 'Başlangıç',
  'account.sessions.column.expires': 'Sona erer',
  'account.sessions.impersonated': 'Hesap adına iş görmeden doğdu',
  'account.sessions.noAddress': 'Yazılmamış',
  'account.sessions.noAddressLong': 'Adres yazılmamış',
  'account.sessions.when': 'Başlangıç {started} · sona erer {expires}',
  'account.audit.label': 'Denetim geçmişi',
  'account.audit.truncated':
    'Kayıt defteri bundan çok girdi tutuyor. Platformun denetim izi yalnızca eklemeye açıktır ve dört yüz gün saklanır.',
  'account.audit.empty.title': 'Bu hesaba hiçbir şey yapılmamış',
  'account.audit.empty.body':
    'Her rol değişikliği, askıya alma, belirlenen şifre, iptal edilen oturum ve hesap adına iş görme, yapanın adıyla birlikte buraya yazılır. Buna kimse dokunmamış.',

  /* ---------------------------------------------- çalışma alanı ölçeği -- */

  'workspace.role.owner': 'Sahip',
  'workspace.role.admin': 'Yönetici',
  'workspace.role.member': 'Üye',
  'plan.free': 'Ücretsiz',
  'plan.starter': 'Başlangıç',
  'plan.pro': 'Profesyonel',
  'plan.business': 'Kurumsal',
  'subscription.trialing': 'Deneme',
  'subscription.active': 'Etkin',
  'subscription.pastDue': 'Vadesi geçmiş',
  'subscription.canceled': 'İptal edilmiş',
  'subscription.incomplete': 'Eksik',
  'subscription.expired': 'Süresi dolmuş',
  'subscription.unpaid': 'Ödenmemiş',
  'subscription.paused': 'Duraklatılmış',

  /* ------------------------------------------------------- denetim defteri -- */

  'audit.action.created': 'Hesap açıldı',
  'audit.action.updated': 'Hesap bilgileri değişti',
  'audit.action.roleChanged': 'Platform rolü değişti',
  'audit.action.banned': 'Hesap askıya alındı',
  'audit.action.unbanned': 'Askı kaldırıldı',
  'audit.action.deleted': 'Hesap silindi',
  'audit.action.passwordSet': 'Şifre bir yönetici tarafından belirlendi',
  'audit.action.emailSet': 'E-posta adresi değişti',
  'audit.action.impersonationStarted': 'Hesap adına iş görme başladı',
  'audit.action.impersonationEnded': 'Hesap adına iş görme bitti',
  'audit.action.sessionRevoked': 'Bir oturum iptal edildi',
  'audit.action.sessionRevokedAll': 'Tüm oturumlar iptal edildi',
  'audit.actor.system': 'Platformun kendisi',
  'audit.actor.system.detail': 'otomatik',
  'audit.actor.agent': 'Bir makine kimlik bilgisi',
  'audit.actor.agent.detail': 'MCP jetonu',
  'audit.actor.deleted': 'Silinmiş bir hesap',
  'audit.actorBadge': 'O sırada: {role}',
  'audit.field.name': 'Ad',
  'audit.field.email': 'E-posta adresi',
  'audit.field.emailVerified': 'E-posta doğrulandı',
  'audit.field.role': 'Platform rolü',
  'audit.field.banned': 'Askıya alınmış',
  'audit.field.banReason': 'Gerekçe',
  'audit.field.banExpiresAt': 'Askının bitişi',
  'audit.field.revoked': 'Kapatılan oturumlar',
  'audit.field.impersonating': 'Şu adına iş görüyor:',
  'audit.field.impersonatedBy': 'Adına iş gören',
  'audit.field.expiresAt': 'Oturum sona erer',
  'audit.field.targetRole': 'Onun platform rolü',
  'audit.field.sessionId': 'Oturum',
  'audit.value.yes': 'evet',
  'audit.value.no': 'hayır',
  'audit.value.cleared': 'boşaltıldı',
  'audit.became': 'şu oldu:',

  /* ------------------------------------------------------------ iletişim kutuları -- */

  'dialog.cancel': 'Vazgeç',

  'create.button': 'Yeni hesap',
  'create.title': 'Hesap aç',
  'create.body':
    'Adres doğrulanmaz ve hiçbir posta çıkmaz — şifreyi kendiniz elden verin.',
  'create.confirm': 'Hesabı aç',
  'create.name.placeholder': 'Elif Yılmaz',
  'create.email': 'E-posta adresi',
  'create.email.placeholder': 'elif@planned.travel',
  'create.password': 'Şifre',
  'create.password.hint':
    'Bir cümle olacak kadar uzun. Hesap sonradan değiştirebilir.',
  'create.done': 'Hesap açıldı',
  'create.done.body': '{email} belirlediğiniz şifreyle giriş yapabilir.',

  'action.menu.label': '{name} için işlemler',
  'action.group.account': 'Hesap',
  'action.group.credentials': 'Kimlik bilgileri',

  'action.role.item': 'Platform rolünü değiştir',
  'action.role.self':
    'Kendi hesabınızda olmaz — kendinizi indirmek platformu yöneticisiz bırakabilir.',
  'action.role.body':
    '{name} platformun kendisinde ne yapabilir. Çalışma alanı üyeliği ayrı bir söz dağarcığıdır ve bununla kımıldamaz.',
  'action.role.confirm': 'Rolü kaydet',
  'action.role.current': 'Şu anki',
  'action.role.done': 'Platform rolü güncellendi',
  'action.role.done.body': '{name} artık platformda {role} rolünü taşıyor.',

  'action.impersonate.item': 'Hesap adına iş gör',
  'action.impersonate.self': 'Olunacak kimse yok — bu sizin kendi hesabınız.',
  'action.impersonate.banned':
    'Hesap askıya alınmış, bu yüzden üstünüze geçireceğiniz bir oturumu yok.',
  'action.impersonate.admin':
    'Platformda hiçbir rol bir yöneticinin adına iş göremez, sizinki de.',
  'action.impersonate.title': '{name} olarak iş gör',
  'action.impersonate.body':
    'Ürünü on beş dakika boyunca tam olarak bu hesabın gördüğü gibi göreceksiniz.',
  'action.impersonate.confirm': 'Başlat',
  'action.impersonate.note.bar':
    'Siz bitirene dek her ekranda bir uyarı çubuğu durur ve kapatılamaz.',
  'action.impersonate.note.platform':
    'Başkasının adına iş görürken platform işlemleri kullanılamaz — konsol da.',
  'action.impersonate.note.audit':
    'Başlangıç da bitiş de platformun denetim izine, adınızla birlikte yazılır.',

  'action.password.item': 'Şifre belirle',
  'action.password.title': '{name} için şifre belirle',
  'action.password.body':
    'Bunu kilitli kalmış bir hesabı geri almak ya da ele geçirilmiş bir hesaptan saldırganı kesmek için kullanın.',
  'action.password.confirm': 'Şifreyi belirle',
  'action.password.field': 'Yeni şifre',
  'action.password.hint.self': 'Belirlendiğinde her oturum biter — sizinki de.',
  'action.password.hint': 'Belirlendiğinde hesabın tuttuğu her oturum biter.',
  'action.password.done': 'Şifre belirlendi',
  'action.password.done.body': '{name} her cihazdan çıkarıldı.',

  'action.sessions.item': 'Tüm oturumları iptal et',
  'action.sessions.body.self':
    'Bu sizi her cihazdan çıkarır, bunu okuduğunuz cihazdan da.',
  'action.sessions.body':
    '{name} her cihazdan çıkarılır ve yeniden giriş yapmak zorunda kalır.',
  'action.sessions.confirm': 'Oturumları iptal et',
  'action.sessions.done': 'Oturumlar iptal edildi',
  'action.sessions.done.body': {
    one: 'Bir oturum kapatıldı.',
    other: '{revoked} oturum kapatıldı.',
  },

  'action.ban.item': 'Hesabı askıya al',
  'action.ban.self':
    'Kendi hesabınızda olmaz — kendinizi askıya almak dönüş yolunuzu elinizden alır.',
  'action.ban.title': '{name} hesabını askıya al',
  'action.ban.body':
    'Her oturum hemen biter ve askı kaldırılana ya da sona erene dek hesap yeniden giriş yapamaz.',
  'action.ban.confirm': 'Hesabı askıya al',
  'action.ban.reason': 'Gerekçe',
  'action.ban.reason.hint':
    'Platformun denetim izinde on üç ay tutulur ve bir yöneticiden başka kimseye gösterilmez.',
  'action.ban.reason.placeholder':
    'Üç çalışma alanından gelen yinelenen kötüye kullanım bildirimleri',
  'action.ban.duration': 'Süre',
  'action.ban.duration.label': 'Askı süresi',
  'action.ban.duration.permanent.body':
    'Bir yönetici bilerek kaldırana dek yürürlükte kalır.',
  'action.ban.duration.day': '24 saat',
  'action.ban.duration.day.body':
    'Kesintiye uğratacak kadar uzun, bir müdahale kalacak kadar kısa.',
  'action.ban.duration.week': '7 gün',
  'action.ban.duration.week.body': 'Bir şikâyeti yanıtlamak için bir hafta.',
  'action.ban.duration.month': '30 gün',
  'action.ban.duration.month.body': 'Bir ay zorunlu sessizlik.',
  'action.ban.duration.quarter': '90 gün',
  'action.ban.duration.quarter.body':
    'Konsolun sunduğu en uzun süre. Ötesi için süresiz askıya alın.',
  'action.ban.done': 'Hesap askıya alındı',
  'action.ban.done.body':
    '{name} her yerden çıkarıldı ve yeniden giriş yapamaz.',

  'action.unban.item': 'Askıyı kaldır',
  'action.unban.title': '{name} hesabının askısını kaldır',
  'action.unban.body':
    'Hesap bir sonraki denemeden başlayarak yeniden giriş yapabilir. Önceki hiçbir oturum geri gelmez.',
  'action.unban.confirm': 'Askıyı kaldır',
  'action.unban.done': 'Askı kaldırıldı',
  'action.unban.done.body':
    '{name} yeniden giriş yapabilir. Hiçbir oturum geri getirilmedi.',

  'action.delete.item': 'Hesabı sil',
  'action.delete.self': 'Kendi hesabınızda olmaz — oradan dönüş yok.',
  'action.delete.title': '{name} hesabını sil',
  'action.delete.body':
    'Hesap, oturumları ve ona bağlı her kimlik bilgisi kaldırılır. Bu geri alınamaz.',
  'action.delete.confirm': 'Hesabı sil',
  'action.delete.note':
    'Bu kişinin oluşturduğu çalışma alanı içeriği, sahibi olan çalışma alanında kalır. Silmek yerine hesabı askıya almak kaydı korur, erişimi alır.',
  'action.delete.done': 'Hesap silindi',
  'action.delete.done.body': '{name} ve hesaba bağlı olan her şey gitti.',

  'session.revoke.label': '{device} üzerindeki oturumu kapat',
  'session.revoke.title': 'Bu oturumu kapat',
  'session.revoke.body':
    '{device} bir sonraki istekte yeniden giriş yapmak zorunda. Bunu okuduğunuz oturumsa, siz de onunla birlikte çıkarılırsınız.',
  'session.revoke.confirm': 'Oturumu kapat',
  'session.revoke.done': 'Oturum kapatıldı',
  'session.revoke.done.body':
    'Cihaz bir sonraki istekte yeniden giriş yapmak zorunda.',

  /* ------------------------------------------------------------ ajan koşuları -- */

  'runs.error.title': 'Koşu kütüğü yanıt vermedi',
  'runs.origin.local': 'Yerel',
  'runs.origin.githubActions': 'GitHub Eylemleri',
  'runs.stat.live': 'Canlı koşular',
  'runs.stat.live.none': 'Şu anda hiçbir şey kurulmuyor',
  'runs.stat.live.some': 'Beş dakikalık kiraya karşı kalp atışı',
  'runs.stat.issues': 'Tutulan kayıtlar',
  'runs.stat.issues.caption':
    'Her biri tek bir koşuya kiralanmış, ataları ve alt kayıtlarıyla',
  'runs.stat.orphans': 'Öksüz dallar',
  'runs.stat.orphans.none': 'Sahipsiz duran iş yok',
  'runs.stat.orphans.some':
    'Duran bir koşudan kalan commit’ler, sahiplenilmeyi bekliyor',
  'runs.live.empty.title': 'Kayıtlı koşu yok',
  'runs.live.empty.body':
    'Bir koşu kendini kaydettiği anda burada görünür — bu makineden, başka bir makineden ya da bir GitHub çalıştırıcısından — aldığı kayıtlarla birlikte.',
  'runs.holds.nothing': 'hiçbir şey tutmuyor',
  'runs.holds': '{issues} tutuyor',
  'runs.uptime': '{elapsed} ayakta · {lease}',
  'runs.lease.expired': 'süresi doldu',
  'runs.lease.left': '{elapsed} kaldı',
  'runs.wip.label': 'Süren iş',
  'runs.wip.empty.title': 'Hiçbir dal iş taşımıyor',
  'runs.wip.empty.body':
    'Bir koşu, dalında commit olur olmaz onu yazar; böylece koşu ölürse kaydı alan sonraki koşuya işe yeniden başlamak yerine bu iş sunulur.',
  'runs.wip.orphaned': 'Öksüz',
  'runs.wip.meta': {
    one: '{commits} commit · {elapsed} önce',
    other: '{commits} commit · {elapsed} önce',
  },
  'runs.recent.label': 'Yakınlarda biten',
  'runs.recent.empty.title': 'Henüz hiçbir koşu bitmedi',
  'runs.recent.empty.body':
    'Son elli koşu, her birinin nasıl bittiğiyle birlikte burada tutulur.',
  'runs.ago': '{elapsed} önce',
  'runs.notCoordinator.title': 'Bu dağıtım filoyu eşgüdümlemiyor',
  'runs.notCoordinator.body':
    'Koşu kütüğü yalnızca hazırlık ortamına bağlıdır, hem de bilerek: ikinci bir kütük, iki filonun da kuyruğu kendisinin tuttuğuna inanmasına yol açardı — ki engellemek için var olduğu tek şey budur. Filoyu hazırlık ortamında okuyun.',
} satisfies TranslationOf<typeof En>

export default messages
