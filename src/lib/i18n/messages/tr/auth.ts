/**
 * Everything the authentication screens say, in Turkish.
 *
 * Made from `../en/auth.ts` and from nothing else. `docs/SPEC.md` §1 and §9 rule 9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * These are the only screens a traveller reaches with no session, so their
 * language comes from the visitor cookie, then `Accept-Language`, then English. Two thirds of the keys are validation messages
 * and failure alerts, which appear exactly when a reader can least afford a
 * sentence in a language they do not read.
 *
 * **Two branches that say the same thing.** Turkish takes the singular after a
 * numeral, so the four plural messages below repeat themselves; both categories
 * still have to be present because `Intl.PluralRules` reports both for `tr`.
 *
 * **What is not translated.** `{provider}` is a trademark, `planned.travel` is
 * our own wordmark and `example.com` is the reserved example domain — only the
 * local part of the sample address and the sample person's name are localised,
 * so a Turkish reader sees a name that reads as a name.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'planned.travel ana sayfası',
  'shell.legal':
    'Devam ederek planned.travel hizmet koşullarını ve gizlilik bildirimini kabul etmiş olursunuz.',

  'panel.eyebrow': 'Birlikte planlayın',
  'panel.heading': 'Her gezi, ilk iğneden son kartpostala kadar.',
  'panel.body':
    'Gerçek bir harita üzerinde ortak programlar, gerçekten denk gelen bütçeler, unutmayan valiz listeleri ve saklamaya değer bir günlük.',
  'panel.map.title': 'Tek harita, tek program',
  'panel.map.detail': 'Her durak, konaklama ve aktarma tek bir programda.',
  'panel.group.title': 'Herkes aynı adımda',
  'panel.group.detail':
    'Düzenlemeler, oylar ve yorumlar tüm gruba anında düşer.',
  'panel.costs.title': 'Hesabı tutan masraflar',
  'panel.costs.detail': 'Ortak bütçeler, kapanan hesaplar, hiç tablo yok.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'veya',
  'divider.orEmail': 'ya da e-postanızla',

  'social.continue': '{provider} ile devam et',
  'social.signUp': '{provider} ile kaydol',
  'social.opening': '{provider} açılıyor',

  'passkey.action': 'Geçiş anahtarıyla gir',
  'passkey.waiting': 'Cihazınız bekleniyor',

  'password.show': 'Şifreyi göster',
  'password.hide': 'Şifreyi gizle',
  'password.showNew': 'Yeni şifreyi göster',
  'password.hideNew': 'Yeni şifreyi gizle',
  'password.showConfirm': 'Şifre onayını göster',
  'password.hideConfirm': 'Şifre onayını gizle',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'E-posta adresi',
  'field.email.placeholder': 'ali@example.com',
  'field.password': 'Şifre',
  'field.password.placeholder': 'Şifreniz',
  'field.newPassword': 'Yeni şifre',
  'field.newPassword.placeholder': 'Aklınızda kalacak bir söz',
  'field.confirmPassword': 'Şifreyi onayla',
  'field.confirmNewPassword': 'Yeni şifreyi onayla',
  'field.confirmPassword.placeholder': 'Bir kez daha yazın',
  'field.name': 'Adınız',
  'field.name.hint': 'Birlikte gezi planladığınız kişilere görünür.',
  'field.name.placeholder': 'Elif Yılmaz',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'E-posta adresinizi girin.',
  'validation.emailTooLong': 'Bu e-posta adresi çok uzun.',
  'validation.emailInvalid': 'Bu bir e-posta adresine benzemiyor.',
  'validation.passwordRequired': 'Şifrenizi girin.',
  'validation.passwordShort': {
    one: 'En az {value} karakter kullanın — kısa bir söz, zekice bir kelimeden iyidir.',
    other:
      'En az {value} karakter kullanın — kısa bir söz, zekice bir kelimeden iyidir.',
  },
  'validation.passwordLong': {
    one: 'En fazla {value} karakter olsun.',
    other: 'En fazla {value} karakter olsun.',
  },
  'validation.passwordMismatch': 'Şifreler birbirini tutmuyor.',
  'validation.nameShort':
    'Adınızı girin, yol arkadaşlarınız kim olduğunuzu bilsin.',
  'validation.nameTooLong': 'Bu ad çok uzun.',
  'validation.termsRequired': 'Devam etmek için lütfen koşulları kabul edin.',
  'validation.codeLength': 'Doğrulayıcı kodları altı hanelidir.',
  'validation.codeDigits': 'Doğrulayıcı kodları yalnızca rakamdan oluşur.',
  'validation.backupShort': 'Bu yedek kod çok kısa görünüyor.',
  'validation.backupLong': 'Bu yedek kod çok uzun görünüyor.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Tekrar hoş geldiniz',
  'login.heading': 'planned.travel’e giriş yapın',
  'login.description':
    'Programlarınızı, bütçelerinizi ve listelerinizi bıraktığınız yerden alın.',
  'login.newHere': 'Yeni misiniz?',
  'login.createAccount': 'Hesap oluşturun',
  'login.forgot': 'Şifrenizi mi unuttunuz?',
  'login.remember': 'Bu cihazda oturumum açık kalsın',
  'login.submit': 'Giriş yap',
  'login.submitting': 'Girişiniz yapılıyor',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Hesabınızı oluşturun',
  'register.heading': 'İki dakikada planlamaya başlayın',
  'register.description':
    'Tek hesap her geziyi, her yol arkadaşını ve her listeyi kapsar.',
  'register.haveAccount': 'Zaten hesabınız var mı?',
  'register.signIn': 'Giriş yap',
  'register.terms':
    'Hizmet koşullarını ve gizlilik bildirimini kabul ediyorum.',
  'register.submit': 'Hesap oluştur',
  'register.submitting': 'Hesabınız oluşturuluyor',

  'strength.hint': {
    one: 'En az {value} karakter. Kısa bir söz, zekice bir kelimeden iyidir.',
    other: 'En az {value} karakter. Kısa bir söz, zekice bir kelimeden iyidir.',
  },
  'strength.tooShort': 'Güç: Çok kısa',
  'strength.weak': 'Güç: Zayıf',
  'strength.fair': 'Güç: Orta',
  'strength.strong': 'Güç: Güçlü',
  'strength.excellent': 'Güç: Mükemmel',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Şifre yardımı',
  'forgot.heading': 'Şifrenizi sıfırlayın',
  'forgot.description':
    'Hesabınızdaki adresi bize söyleyin, yeni şifre belirlemeniz için bir bağlantı gönderelim.',
  'forgot.submit': 'Sıfırlama bağlantısı gönder',
  'forgot.submitting': 'Bağlantınız gönderiliyor',
  'forgot.back': 'Girişe dön',
  'forgot.sent.eyebrow': 'Gelen kutunuza bakın',
  'forgot.sent.heading': 'Sıfırlama bağlantınız yolda',
  'forgot.sent.description':
    '{email} adresini kullanan bir hesap varsa, yeni şifre seçme bağlantısı şu anda o gelen kutusunda.',
  'forgot.sent.title': 'Bağlantı bir kez, bir saat boyunca çalışır',
  'forgot.sent.body':
    'Hiçbir şey gelmedi mi? Gereksiz klasörüne bakın, sonra yeniden gönderin. Yeni bir bağlantı istemek, öncekini sessizce geçersiz kılar.',
  'forgot.sent.resend': 'Yeniden gönder',
  'forgot.sent.resending': 'Yeniden gönderiliyor',
  'forgot.sent.change': 'Başka bir e-posta kullan',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Şifre sıfırlama',
  'reset.heading': 'Yeni bir şifre seçin',
  'reset.description': {
    one: 'En az {value} karakterlik bir şey seçin. Kısa bir söz hem akılda kalır hem de tahmin edilmesi zordur.',
    other:
      'En az {value} karakterlik bir şey seçin. Kısa bir söz hem akılda kalır hem de tahmin edilmesi zordur.',
  },
  'reset.submit': 'Yeni şifreyi kaydet',
  'reset.submitting': 'Şifreniz kaydediliyor',
  'reset.back': 'Girişe dön',
  'reset.stale.heading': 'Bu bağlantı kullanılamıyor',
  'reset.stale.description':
    'Sıfırlama bağlantıları bir saat sonra biter ve yalnızca bir kez çalışır — mümkün olan en güvenli takas.',
  'reset.stale.action': 'Yeni bağlantı isteyin',
  'reset.done.heading': 'Yeni şifreniz hazır',
  'reset.done.description':
    'Diğer bütün oturumlar kapatıldı; eski şifreyi bilen kişinin artık girecek bir yolu yok.',
  'reset.done.title': 'Diğer her yerden çıkış yapıldı',
  'reset.done.body': 'Planlamaya devam etmek için yeni şifrenizle giriş yapın.',
  'reset.done.action': 'Giriş yap',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'İki adımlı doğrulama',
  'twoFactor.heading': 'Sizin olduğunuzu doğrulayın',
  'twoFactor.description':
    'Hesabınız ikinci bir adımla korunuyor. Doğrulayıcı uygulamanızdaki güncel kodu girin.',
  'twoFactor.back': 'Girişten yeniden başlayın',
  'twoFactor.methods': 'Doğrulama yöntemi',
  'twoFactor.totp.tab': 'Doğrulayıcı',
  'twoFactor.totp.label': 'Altı haneli kod',
  'twoFactor.totp.hint': 'Kodlar otuz saniyede bir yenilenir.',
  'twoFactor.totp.submit': 'Doğrula ve devam et',
  'twoFactor.backup.tab': 'Yedek kod',
  'twoFactor.backup.label': 'Yedek kod',
  'twoFactor.backup.hint':
    'İki adımlı doğrulamayı açtığınızda kaydettiğiniz listeden. Her kod bir kez çalışır.',
  'twoFactor.backup.submit': 'Yedek kod kullan',
  'twoFactor.submitting': 'Kodunuz kontrol ediliyor',
  'twoFactor.trust.label': 'Bu cihaza otuz gün güven',
  'twoFactor.trust.detail':
    'O zamana kadar bu tarayıcıda bu adımı atlar. Bunu yalnızca size ait bir cihazda yapın.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'E-posta onaylandı',
  'verify.done.heading': 'Her şey hazır',
  'verify.done.description':
    'Adresiniz doğrulandı; davetler, hatırlatmalar ve gezi özetleri size ulaşacak.',
  'verify.done.title': 'Doğrulandı',
  'verify.done.body': '{email} bu hesapta onaylandı.',
  'verify.done.bodyUnknown': 'E-posta adresiniz bu hesapta onaylandı.',
  'verify.done.action': 'Panonuza gidin',

  'verify.pending.eyebrow': 'Son bir şey',
  'verify.pending.heading': 'E-posta adresinizi onaylayın',
  'verify.pending.description':
    '{email} adresine bir onay bağlantısı gönderdik. Onu açmak hesabınızı kurtarılabilir tutar ve yol arkadaşlarınızın sizi davet etmesini sağlar.',
  'verify.pending.wrongAddress': 'Adres yanlış mı?',
  'verify.pending.changeIt': 'Ayarlardan değiştirin',
  'verify.pending.title': 'Bağlantı 24 saat geçerli',
  'verify.pending.body':
    'Gelen kutunuzda bir şey yok mu? Gereksiz klasörüne bakın, sonra yeniden gönderin.',
  'verify.pending.resentTitle': 'Az önce yeniden gönderildi',
  'verify.pending.resentBody':
    'Bir dakika verin, sonra gelen kutunuza — ve gereksiz klasörüne — bakın.',
  'verify.pending.resend': 'Onayı yeniden gönder',
  'verify.pending.resending': 'Yeniden gönderiliyor',
  'verify.pending.continue': 'Yine de devam et',

  'verify.request.eyebrow': 'E-posta onayı',
  'verify.request.heading': 'Yeni bir onay bağlantısı gönder',
  'verify.request.description':
    'Onay bağlantıları 24 saat geçerlidir ve yalnızca bir kez çalışır. Adresinizi söyleyin, yenisi yola çıksın.',
  'verify.request.submit': 'Onay bağlantısı gönder',
  'verify.request.submitting': 'Bağlantınız gönderiliyor',
  'verify.request.sentTitle': 'Yolda',
  'verify.request.sentBody':
    'O adresin onay bekleyen bir hesabı varsa, bağlantı şu anda gelen kutusunda.',
  'verify.request.change': 'Başka bir e-posta kullan',
  'verify.request.back': 'Girişe dön',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Çalışma alanı daveti',
  'invitation.heading': '{workspace} alanına katıl',
  'invitation.description':
    'Kabul etmek sizi bu çalışma alanına ekler ve gezilerini, bütçelerini ve listelerini sizinle paylaşır.',
  'invitation.invitedAs': '{email} olarak davet edildiniz',
  'invitation.role': 'Rolünüz',
  'invitation.means': 'Yani',
  'invitation.invitedBy': 'Davet eden',
  'invitation.expires': 'Doluyor',
  'invitation.accept': 'Daveti kabul et',
  'invitation.accepting': 'Çalışma alanına katılıyorsunuz',
  'invitation.decline': 'Reddet',
  'invitation.declining': 'Reddediliyor',
  'invitation.reassurance':
    'Bir çalışma alanından, onun ayarlarından dilediğiniz zaman ayrılabilirsiniz; dışında oluşturduğunuz hiçbir şey paylaşılmaz.',

  'invitation.role.owner': 'Sahip — ödeme dahil tam yetki',
  'invitation.role.admin': 'Yönetici — gezileri, üyeleri ve ayarları yönetir',
  'invitation.role.member': 'Üye — herkesle birlikte gezi planlar',
  'invitation.role.other': '{role} — erişimi çalışma alanı sahibi belirler',
  'invitation.role.badge.owner': 'Sahip',
  'invitation.role.badge.admin': 'Yönetici',
  'invitation.role.badge.member': 'Üye',

  'invitation.anonymous.heading': 'Davetinizi görmek için giriş yapın',
  'invitation.anonymous.description':
    'Davetler gönderildikleri e-posta adresine bağlıdır, bu yüzden size göstermeden önce kim olduğunuzu bilmemiz gerekir.',
  'invitation.anonymous.body':
    'Davetin gönderildiği adresi kullanın. Ardından sizi doğrudan buraya geri getireceğiz.',
  'invitation.anonymous.action': 'Devam etmek için giriş yapın',
  'invitation.anonymous.noAccount': 'Henüz hesabınız yok mu?',
  'invitation.anonymous.register': 'Davet edilen adresle bir hesap oluşturun',

  'invitation.mismatch.heading': 'Bu davet başka bir adrese ait',
  'invitation.mismatch.description':
    'Başka biri olarak giriş yaptınız, bu yüzden bu davet sizin kabul edeceğiniz davet değil.',
  'invitation.mismatch.title': '{email} olarak giriş yapıldı',
  'invitation.mismatch.body':
    'Çıkış yapıp davetin gönderildiği adresle girin ya da bu hesaba yeni bir davet isteyin.',
  'invitation.mismatch.action': 'Hesap değiştir',
  'invitation.mismatch.back': 'Girişe dön',

  'invitation.unverified.heading': 'Katılmak için e-postanızı onaylayın',
  'invitation.unverified.description':
    'Çalışma alanları yalnızca onaylanmış adresleri kabul eder; böylece kimse bir yazım hatasıyla eklenmez.',
  'invitation.unverified.title': '{email} henüz onaylanmadı',
  'invitation.unverified.body':
    'Gelen kutunuzdaki onay bağlantısını açın, sonra bu sayfaya dönün. Davet sizi bekliyor olacak.',
  'invitation.unverified.action': 'E-postamı onayla',
  'invitation.unverified.resend': 'Onay e-postasını yeniden gönder',

  'invitation.unavailable.heading': 'Bu davet artık geçerli değil',
  'invitation.unavailable.description':
    'Davetler yedi gün geçerlidir ve kullanıldıkları ya da geri çekildikleri anda kapanır.',
  'invitation.unavailable.title': 'Burada kabul edilecek bir şey yok',
  'invitation.unavailable.body':
    'Sizi davet eden kişiden yeni bir davet göndermesini isteyin; bu sayfa onu hemen gösterecek.',
  'invitation.unavailable.dashboard': 'Panonuza gidin',

  'invitation.declined.eyebrow': 'Davet reddedildi',
  'invitation.declined.heading': 'Sorun değil — hiçbir şey paylaşılmadı',
  'invitation.declined.description':
    'Çalışma alanının sahibine bildirildi ve bu bağlantı artık kullanılamaz.',
  'invitation.declined.action': 'Panonuza gidin',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Bir şeyler ters gitti',
  'error.unexpected.detail': 'Bu olmadı. Lütfen biraz sonra yeniden deneyin.',
  'error.rateLimited.title': 'Çok fazla deneme',
  'error.rateLimited.detail':
    'Güvenliğiniz için bu cihazdan girişi birkaç dakika durdurduk. Kısa süre sonra deneyin.',
  'error.offline.title': 'Bağlantı yok',
  'error.offline.detail':
    'planned.travel’e ulaşamadık. Bağlantınızı kontrol edip yeniden deneyin.',

  'error.credentials.title': 'Bu bilgiler uyuşmuyor',
  'error.credentials.detail':
    'E-posta adresini ve şifreyi kontrol edip yeniden deneyin. Google ya da Apple ile kaydolduysanız o düğmeyi kullanın.',
  'error.password.title': 'Bu bilgiler uyuşmuyor',
  'error.password.detail':
    'E-posta adresini ve şifreyi kontrol edip yeniden deneyin.',
  'error.noPassword.title': 'Bu hesapta şifre yok',
  'error.noPassword.detail':
    'Bu hesap bir sosyal sağlayıcıyla ya da geçiş anahtarıyla giriş yapıyor. Yukarıdaki seçeneklerden birini kullanın.',
  'error.unverified.title': 'Önce e-postanızı onaylayın',
  'error.unverified.detail':
    'Kaydolduğunuzda size bir onay bağlantısı gönderdik. Onu açın, sonra buraya dönün.',
  'error.emailTaken.title': 'Bu e-posta zaten kayıtlı',
  'error.emailTaken.detail':
    'Bunun yerine giriş yapın ya da unuttuysanız şifrenizi sıfırlayın.',
  'error.noAccount.title': 'Bu hesabı bulamadık',
  'error.noAccount.detail':
    'Adresi kontrol edin ya da yeni bir hesap oluşturun.',
  'error.passwordTooShort.title': 'Şifre çok kısa',
  'error.passwordTooShort.detail': 'Daha uzun bir söz seçip yeniden deneyin.',
  'error.passwordTooLong.title': 'Şifre çok uzun',
  'error.passwordTooLong.detail': 'Daha kısa bir söz seçip yeniden deneyin.',
  'error.linkSpent.title': 'Bu bağlantı artık geçerli değil',
  'error.linkSpent.detail':
    'Şifre bağlantıları yalnızca bir kez kullanılabilir. Yenisini isteyin, hemen e-postayla gönderelim.',
  'error.linkExpired.title': 'Bu bağlantının süresi doldu',
  'error.linkExpired.detail': 'Yenisini isteyin, hemen e-postayla gönderelim.',
  'error.linkIncomplete.title': 'Bu bağlantı eksik',
  'error.linkIncomplete.detail':
    'Şifre sıfırlama bağlantıları tek kullanımlık bir belirteç taşır. En son e-postayı açın ya da yeni bir bağlantı isteyin.',
  'error.sessionExpired.title': 'Oturumunuzun süresi doldu',
  'error.sessionExpired.detail':
    'Kaldığınız yerden devam etmek için yeniden giriş yapın.',
  'error.alreadyVerified.title': 'Zaten onaylı',
  'error.alreadyVerified.detail':
    'Bu e-posta adresi doğrulanmış. Normal şekilde giriş yapabilirsiniz.',
  'error.badCode.title': 'Bu kod işe yaramadı',
  'error.badCode.detail':
    'Doğrulayıcı kodları otuz saniye geçerlidir. Bir sonrakini bekleyip altı hanenin tamamını girin.',
  'error.badBackupCode.title': 'Bu yedek kod işe yaramadı',
  'error.badBackupCode.detail':
    'Her yedek kod bir kez çalışır. Listenizdeki bir sonraki kullanılmamış kodu deneyin.',
  'error.locked.title': 'Hesap geçici olarak kilitli',
  'error.locked.detail':
    'Çok fazla başarısız doğrulama denemesi. Güvenliğiniz için bu hesap birkaç dakika kilitli.',
  'error.twoFactorOn.title': 'İki faktörlü kimlik doğrulama zaten açık',
  'error.twoFactorOn.detail':
    'Yeniden ayarlamak mevcut doğrulayıcının çalışmasını durduracağı için hiçbir şey değiştirilmedi. Buradan yönetebilirsin.',
  'error.noTwoFactor.title': 'İki adımlı doğrulama kurulmamış',
  'error.noTwoFactor.detail':
    'Devam etmek için e-postanız ve şifrenizle giriş yapın.',
  'error.twoFactorExpired.title': 'Girişten yeniden başlayın',
  'error.twoFactorExpired.detail':
    'Bu doğrulama adımının süresi doldu. E-postanızı ve şifrenizi bir kez daha girin.',
  'error.invitationGone.title': 'Bu davet artık geçerli değil',
  'error.invitationGone.detail':
    'Süresi dolmuş, geri çekilmiş ya da çoktan kullanılmış olabilir. Yeni bir davet isteyin.',
  'error.invitationOther.title': 'Bu davet başkasına ait',
  'error.invitationOther.detail':
    'Başka bir e-posta adresine gönderildi. Kabul etmek için o adresle giriş yapın.',
  'error.alreadyMember.title': 'Bu çalışma alanında zaten varsınız',
  'error.alreadyMember.detail':
    'Kabul edilecek bir şey yok — çalışma alanı değiştiriciden açın.',
  'error.workspaceFull.title': 'Bu çalışma alanı dolu',
  'error.workspaceFull.detail':
    'Üye sınırına ulaştı. Bir sahipten koltuk açmasını ya da paketi yükseltmesini isteyin.',
  'error.verifyBeforeJoin.title': 'Önce e-postanızı onaylayın',
  'error.verifyBeforeJoin.detail':
    'Size gönderdiğimiz onay bağlantısını açın, sonra bu davete dönün.',

  'passkeyNotice.added': 'Hesabınıza bir geçiş anahtarı eklendi',
  'passkeyNotice.removed': 'Hesabınızdan bir geçiş anahtarı kaldırıldı',
  'passkeyNotice.security': 'Güvenlik',
  'passkeyNotice.action': 'Geçiş anahtarlarını yönet',
  'passkeyNotice.recovery':
    'Bu değişikliği tanımıyorsanız parolanızı değiştirin ve tanımadığınız oturumları sonlandırın. Parolayı sıfırlamak geçiş anahtarlarını kaldırmaz. Geçiş anahtarlarınızı inceleyin ve tanımadıklarınızı kaldırın.',
  'error.passwordAttemptsLocked.title': 'Parola doğrulama kilitlendi',
  'error.passwordAttemptsLocked.detail':
    'Bu oturum artık parolanızı doğrulayamaz. Oturumu kapatıp yeniden giriş yapın.',
  'error.passwordResultUnknown.title': 'Güvenlik ayarlarınızı kontrol edin',
  'error.passwordResultUnknown.detail':
    'Değişiklik kaydedilmiş olabilir. Yeniden giriş yapabileceğinizden emin olana kadar bu oturumu açık tutun. Parolanızı değiştirdiyseniz yenisini deneyin. Yedek kodları değiştirdiyseniz eski kodlar artık çalışmayabilir; yeni bir set oluşturmak için kimlik doğrulama uygulamanızı veya açık olan başka bir oturumu kullanın.',
} satisfies TranslationOf<typeof En>

export default messages
