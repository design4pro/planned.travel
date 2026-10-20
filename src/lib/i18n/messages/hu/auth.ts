/**
 * Everything the authentication screens say, in Hungarian.
 *
 * Made from `../en/auth.ts` and from nothing else. `docs/SPEC.md` §1 and §8.9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * These are the only screens a traveller reaches with no session, so their
 * language comes purely from `Accept-Language` and there is no stored preference
 * to correct a bad guess with. Two thirds of the keys are validation messages
 * and failure alerts, which surface exactly when a reader can least afford a
 * sentence in a language they do not read.
 *
 * **Address.** The polite third person («Ön», and the formal imperative that
 * goes with it) throughout, matching `./settings.ts` and `./shell.ts`. A sign-in
 * screen that used the familiar «te» and an account screen that did not would
 * read as two different products.
 *
 * **Two branches that read alike.** Hungarian puts the singular after a numeral,
 * so `one` and `other` carry the same wording in the four plural messages below.
 * Both categories are still written out, because `Intl.PluralRules` reports both
 * for `hu` and a missing branch is a runtime hole.
 *
 * **What is not translated.** `{provider}` is a trademark, `planned.travel` is
 * our own wordmark — spelled out rather than inflected, because Hungarian would
 * otherwise need a hyphenated suffix on it — and `example.com` is the reserved
 * example domain. Only the local part of the sample address and the sample
 * person's name are localised, so a Hungarian reader sees a name that reads as
 * a name, family name first as the language writes it.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'planned.travel főoldal',
  'shell.legal':
    'A folytatással elfogadja a planned.travel felhasználási feltételeit és adatkezelési tájékoztatóját.',

  'panel.eyebrow': 'Közös tervezés',
  'panel.heading': 'Minden utazás, az első térképtűtől az utolsó képeslapig.',
  'panel.body':
    'Közös útitervek valódi térképen, költségvetés, amely tényleg kijön, csomaglisták, amelyek emlékeznek, és napló, amelyet érdemes megőrizni.',
  'panel.map.title': 'Egy térkép, egy terv',
  'panel.map.detail':
    'Minden megálló, szállás és átszállás egyetlen útitervben.',
  'panel.group.title': 'Mindenki egy ütemben',
  'panel.group.detail':
    'A módosítások, szavazatok és hozzászólások azonnal megjelennek az egész csapatnak.',
  'panel.costs.title': 'Költségek, amelyek kijönnek',
  'panel.costs.detail': 'Közös kassza, rendezett egyenlegek, táblázat nélkül.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'vagy',
  'divider.orEmail': 'vagy az e-mail-címével',

  'social.continue': 'Folytatás {provider} fiókkal',
  'social.signUp': 'Regisztráció {provider} fiókkal',
  'social.opening': '{provider} megnyitása',

  'passkey.action': 'Bejelentkezés belépési kulccsal',
  'passkey.waiting': 'Várakozás az eszközére',

  'password.show': 'Jelszó megjelenítése',
  'password.hide': 'Jelszó elrejtése',
  'password.showNew': 'Az új jelszó megjelenítése',
  'password.hideNew': 'Az új jelszó elrejtése',
  'password.showConfirm': 'A jelszó megerősítésének megjelenítése',
  'password.hideConfirm': 'A jelszó megerősítésének elrejtése',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'E-mail-cím',
  'field.email.placeholder': 'anna@example.com',
  'field.password': 'Jelszó',
  'field.password.placeholder': 'A jelszava',
  'field.newPassword': 'Új jelszó',
  'field.newPassword.placeholder': 'Egy mondat, amelyet megjegyez',
  'field.confirmPassword': 'Jelszó megerősítése',
  'field.confirmNewPassword': 'Az új jelszó megerősítése',
  'field.confirmPassword.placeholder': 'Írja be még egyszer',
  'field.name': 'Az Ön neve',
  'field.name.hint': 'Ezt látják azok, akikkel együtt tervez.',
  'field.name.placeholder': 'Kovács Anna',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Adja meg az e-mail-címét.',
  'validation.emailTooLong': 'Ez az e-mail-cím túl hosszú.',
  'validation.emailInvalid': 'Ez nem tűnik e-mail-címnek.',
  'validation.passwordRequired': 'Adja meg a jelszavát.',
  'validation.passwordShort': {
    one: 'Legalább {value} karakter kell — egy rövid mondat többet ér a találékony szónál.',
    other:
      'Legalább {value} karakter kell — egy rövid mondat többet ér a találékony szónál.',
  },
  'validation.passwordLong': {
    one: 'Legfeljebb {value} karakter lehet.',
    other: 'Legfeljebb {value} karakter lehet.',
  },
  'validation.passwordMismatch': 'A két jelszó nem egyezik.',
  'validation.nameShort': 'Adja meg a nevét, hogy az útitársak tudják, ki Ön.',
  'validation.nameTooLong': 'Ez a név túl hosszú.',
  'validation.termsRequired': 'A folytatáshoz fogadja el a feltételeket.',
  'validation.codeLength': 'A hitelesítő kódok hat számjegyűek.',
  'validation.codeDigits': 'A hitelesítő kódok csak számjegyekből állnak.',
  'validation.backupShort': 'Ez a tartalék kód túl rövidnek tűnik.',
  'validation.backupLong': 'Ez a tartalék kód túl hosszúnak tűnik.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Üdv újra',
  'login.heading': 'Jelentkezzen be a planned.travel oldalára',
  'login.description':
    'Folytassa az útiterveit, költségvetéseit és listáit pontosan ott, ahol abbahagyta.',
  'login.newHere': 'Most jár itt először?',
  'login.createAccount': 'Fiók létrehozása',
  'login.forgot': 'Elfelejtette a jelszavát?',
  'login.remember': 'Maradjak bejelentkezve ezen az eszközön',
  'login.submit': 'Bejelentkezés',
  'login.submitting': 'Bejelentkezés folyamatban',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Új fiók létrehozása',
  'register.heading': 'Pár perc, és indulhat a tervezés',
  'register.description':
    'Egyetlen fiók elég minden utazáshoz, minden útitárshoz és minden listához.',
  'register.haveAccount': 'Van már fiókja?',
  'register.signIn': 'Bejelentkezés',
  'register.terms':
    'Elfogadom a felhasználási feltételeket és az adatkezelési tájékoztatót.',
  'register.submit': 'Fiók létrehozása',
  'register.submitting': 'A fiók létrehozása folyamatban',

  'strength.hint': {
    one: 'Legalább {value} karakter. Egy rövid mondat többet ér a találékony szónál.',
    other:
      'Legalább {value} karakter. Egy rövid mondat többet ér a találékony szónál.',
  },
  'strength.tooShort': 'Erősség: túl rövid',
  'strength.weak': 'Erősség: gyenge',
  'strength.fair': 'Erősség: megfelelő',
  'strength.strong': 'Erősség: erős',
  'strength.excellent': 'Erősség: kiváló',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Jelszósegítség',
  'forgot.heading': 'Állítsa vissza a jelszavát',
  'forgot.description':
    'Adja meg a fiókjához tartozó címet, és e-mailben küldünk egy hivatkozást, amellyel új jelszót állíthat be.',
  'forgot.submit': 'Kérem a visszaállító hivatkozást',
  'forgot.submitting': 'A hivatkozás küldése folyamatban',
  'forgot.back': 'Vissza a bejelentkezéshez',
  'forgot.sent.eyebrow': 'Nézze meg a postafiókját',
  'forgot.sent.heading': 'A visszaállító hivatkozás úton van',
  'forgot.sent.description':
    'Ha egy fiók a(z) {email} címet használja, az új jelszó választásához szükséges hivatkozás már abban a postafiókban van.',
  'forgot.sent.title': 'A hivatkozás egyszer, egy órán át működik',
  'forgot.sent.body':
    'Nem érkezett meg semmi? Nézze meg a levélszemetet, majd küldje el újra. Az új kérés csendben visszavonja az előzőt.',
  'forgot.sent.resend': 'Küldés újra',
  'forgot.sent.resending': 'Újraküldés folyamatban',
  'forgot.sent.change': 'Másik e-mail-cím megadása',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Jelszó-visszaállítás',
  'reset.heading': 'Válasszon új jelszót',
  'reset.description': {
    one: 'Válasszon legalább {value} karakter hosszú jelszót. Egy rövid mondatot könnyebb megjegyezni és nehezebb kitalálni.',
    other:
      'Válasszon legalább {value} karakter hosszú jelszót. Egy rövid mondatot könnyebb megjegyezni és nehezebb kitalálni.',
  },
  'reset.submit': 'Új jelszó beállítása',
  'reset.submitting': 'A jelszó mentése folyamatban',
  'reset.back': 'Vissza a bejelentkezéshez',
  'reset.stale.heading': 'Ez a hivatkozás nem használható',
  'reset.stale.description':
    'A visszaállító hivatkozások egy óra után lejárnak, és csak egyszer működnek — ez a lehető legbiztonságosabb csere.',
  'reset.stale.action': 'Új hivatkozás kérése',
  'reset.done.heading': 'Az új jelszava készen áll',
  'reset.done.description':
    'Minden más munkamenetből kiléptettük, így aki ismerte a régi jelszót, többé nem tud belépni.',
  'reset.done.title': 'Mindenhol máshol kijelentkeztetve',
  'reset.done.body':
    'Jelentkezzen be az új jelszavával, és folytassa a tervezést.',
  'reset.done.action': 'Bejelentkezés',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Kétfaktoros hitelesítés',
  'twoFactor.heading': 'Igazolja, hogy Ön az',
  'twoFactor.description':
    'A fiókját egy második tényező is védi. Adja meg a hitelesítő alkalmazásban éppen látható kódot.',
  'twoFactor.back': 'Kezdje elölről a bejelentkezéssel',
  'twoFactor.methods': 'Ellenőrzési mód',
  'twoFactor.totp.tab': 'Hitelesítő',
  'twoFactor.totp.label': 'Hatjegyű kód',
  'twoFactor.totp.hint': 'A kódok fél percenként frissülnek.',
  'twoFactor.totp.submit': 'Ellenőrzés és folytatás',
  'twoFactor.backup.tab': 'Tartalék kód',
  'twoFactor.backup.label': 'Tartalék kód',
  'twoFactor.backup.hint':
    'Arról a listáról, amelyet a kétfaktoros hitelesítés bekapcsolásakor mentett el. Minden kód egyszer használható.',
  'twoFactor.backup.submit': 'Tartalék kód használata',
  'twoFactor.submitting': 'A kód ellenőrzése folyamatban',
  'twoFactor.trust.label': 'Megbízom ebben az eszközben 30 napig',
  'twoFactor.trust.detail':
    'Addig kihagyjuk ezt a lépést ebben a böngészőben. Csak olyan eszközön tegye, amelyet Önön kívül más nem használ.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'E-mail-cím megerősítve',
  'verify.done.heading': 'Minden készen áll',
  'verify.done.description':
    'A címe megerősített, így a meghívók, az emlékeztetők és az utazási összefoglalók el fognak jutni Önhöz.',
  'verify.done.title': 'Megerősítve',
  'verify.done.body': 'A(z) {email} cím megerősítve ehhez a fiókhoz.',
  'verify.done.bodyUnknown': 'Az e-mail-címe megerősítve ehhez a fiókhoz.',
  'verify.done.action': 'Tovább az irányítópultra',

  'verify.pending.eyebrow': 'Már csak egy lépés',
  'verify.pending.heading': 'Erősítse meg az e-mail-címét',
  'verify.pending.description':
    'Megerősítő hivatkozást küldtünk a(z) {email} címre. Ha megnyitja, a fiókja visszaszerezhető marad, és az útitársak meg tudják hívni.',
  'verify.pending.wrongAddress': 'Nem ez a címe?',
  'verify.pending.changeIt': 'Módosítsa a beállításokban',
  'verify.pending.title': 'A hivatkozás 24 óráig él',
  'verify.pending.body':
    'Nincs semmi a postafiókjában? Nézze meg a levélszemetet, majd küldje el újra.',
  'verify.pending.resentTitle': 'Épp most küldtük el újra',
  'verify.pending.resentBody':
    'Adjon neki egy percet, aztán nézze meg a postafiókját — és a levélszemetet is.',
  'verify.pending.resend': 'Megerősítés újraküldése',
  'verify.pending.resending': 'Újraküldés folyamatban',
  'verify.pending.continue': 'Folytatás mégis',

  'verify.request.eyebrow': 'E-mail-cím megerősítése',
  'verify.request.heading': 'Új megerősítő hivatkozás küldése',
  'verify.request.description':
    'A megerősítő hivatkozások 24 óráig élnek, és csak egyszer működnek. Adja meg a címét, és már küldjük is az újat.',
  'verify.request.submit': 'Megerősítő hivatkozás küldése',
  'verify.request.submitting': 'A hivatkozás küldése folyamatban',
  'verify.request.sentTitle': 'Úton van',
  'verify.request.sentBody':
    'Ha ehhez a címhez megerősítésre váró fiók tartozik, a hivatkozás már a postafiókjában van.',
  'verify.request.change': 'Másik e-mail-cím megadása',
  'verify.request.back': 'Vissza a bejelentkezéshez',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Munkaterületi meghívó',
  'invitation.heading': 'Csatlakozzon ide: {workspace}',
  'invitation.description':
    'Az elfogadással belép erre a munkaterületre, és megosztjuk Önnel az utazásait, költségvetéseit és listáit.',
  'invitation.invitedAs': 'Meghívva mint {email}',
  'invitation.role': 'Az Ön szerepköre',
  'invitation.means': 'Ez azt jelenti',
  'invitation.invitedBy': 'Meghívta',
  'invitation.expires': 'Lejár',
  'invitation.accept': 'Meghívó elfogadása',
  'invitation.accepting': 'Csatlakozás a munkaterülethez',
  'invitation.decline': 'Elutasítás',
  'invitation.declining': 'Elutasítás folyamatban',
  'invitation.reassurance':
    'Egy munkaterületet bármikor elhagyhat annak beállításaiból, és amit azon kívül készít, azt soha nem osztjuk meg.',

  'invitation.role.owner':
    'Tulajdonos — teljes hozzáférés, a számlázással együtt',
  'invitation.role.admin':
    'Adminisztrátor — utazások, tagok és beállítások kezelése',
  'invitation.role.member': 'Tag — tervezés mindenki mással együtt',
  'invitation.role.other':
    '{role} — a hozzáférést a munkaterület tulajdonosa szabja meg',
  'invitation.role.badge.owner': 'Tulajdonos',
  'invitation.role.badge.admin': 'Adminisztrátor',
  'invitation.role.badge.member': 'Tag',

  'invitation.anonymous.heading': 'Jelentkezzen be a meghívója megtekintéséhez',
  'invitation.anonymous.description':
    'A meghívók ahhoz az e-mail-címhez tartoznak, amelyre elküldtük őket, ezért tudnunk kell, ki Ön, mielőtt megmutatjuk ezt.',
  'invitation.anonymous.body':
    'Azt a címet használja, amelyre a meghívó érkezett. Utána azonnal visszahozzuk ide.',
  'invitation.anonymous.action': 'Bejelentkezés a folytatáshoz',
  'invitation.anonymous.noAccount': 'Még nincs fiókja?',
  'invitation.anonymous.register': 'Hozzon létre egyet a meghívott címmel',

  'invitation.mismatch.heading': 'Ez a meghívó másik címre szól',
  'invitation.mismatch.description':
    'Jelenleg más fiókkal van bejelentkezve, így ezt nem Ön fogadhatja el.',
  'invitation.mismatch.title': 'Bejelentkezve mint {email}',
  'invitation.mismatch.body':
    'Jelentkezzen ki, majd lépjen be azzal a címmel, amelyre a meghívó érkezett, vagy kérjen új meghívót erre a fiókra.',
  'invitation.mismatch.action': 'Fiókváltás',
  'invitation.mismatch.back': 'Vissza a bejelentkezéshez',

  'invitation.unverified.heading': 'Erősítse meg a címét a csatlakozáshoz',
  'invitation.unverified.description':
    'A munkaterületek csak megerősített címeket fogadnak el, így senki nem kerülhet be egy elgépelés miatt.',
  'invitation.unverified.title': 'A(z) {email} cím még nincs megerősítve',
  'invitation.unverified.body':
    'Nyissa meg a postafiókjában lévő megerősítő hivatkozást, majd térjen vissza erre az oldalra. A meghívó itt várja majd.',
  'invitation.unverified.action': 'Megerősítem a címemet',
  'invitation.unverified.resend': 'Megerősítő e-mail újraküldése',

  'invitation.unavailable.heading': 'Ez a meghívó már nem érhető el',
  'invitation.unavailable.description':
    'A meghívók hét napig élnek, és abban a pillanatban lejárnak, amint felhasználják vagy visszavonják őket.',
  'invitation.unavailable.title': 'Itt nincs mit elfogadni',
  'invitation.unavailable.body':
    'Kérjen új meghívót attól, aki hívta, és ez az oldal azonnal meg is mutatja.',
  'invitation.unavailable.dashboard': 'Tovább az irányítópultra',

  'invitation.declined.eyebrow': 'Meghívó elutasítva',
  'invitation.declined.heading': 'Semmi baj — semmit nem osztottunk meg',
  'invitation.declined.description':
    'A munkaterület tulajdonosa értesült róla, és ez a hivatkozás többé nem használható.',
  'invitation.declined.action': 'Tovább az irányítópultra',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Valami félrement',
  'error.unexpected.detail':
    'Ez most nem sikerült. Kérjük, próbálja újra egy pillanat múlva.',
  'error.rateLimited.title': 'Túl sok próbálkozás',
  'error.rateLimited.detail':
    'Biztonsági okból néhány percre szüneteltetjük a bejelentkezést erről az eszközről. Próbálja újra hamarosan.',
  'error.offline.title': 'Nincs kapcsolat',
  'error.offline.detail':
    'Nem értük el a planned.travel szolgáltatást. Ellenőrizze a kapcsolatát, és próbálja újra.',

  'error.credentials.title': 'Ezek az adatok nem egyeznek',
  'error.credentials.detail':
    'Ellenőrizze az e-mail-címet és a jelszót, majd próbálja újra. Ha Google- vagy Apple-fiókkal regisztrált, azt a gombot használja.',
  'error.password.title': 'Ezek az adatok nem egyeznek',
  'error.password.detail':
    'Ellenőrizze az e-mail-címet és a jelszót, majd próbálja újra.',
  'error.noPassword.title': 'Ehhez a fiókhoz nem tartozik jelszó',
  'error.noPassword.detail':
    'Ez a fiók közösségi szolgáltatóval vagy belépési kulccsal lép be. Válasszon a fenti lehetőségek közül.',
  'error.unverified.title': 'Előbb erősítse meg a címét',
  'error.unverified.detail':
    'A regisztrációkor küldtünk egy megerősítő hivatkozást. Nyissa meg, majd térjen vissza ide.',
  'error.emailTaken.title': 'Ez az e-mail-cím már regisztrálva van',
  'error.emailTaken.detail':
    'Jelentkezzen be inkább, vagy állítsa vissza a jelszavát, ha elfelejtette.',
  'error.noAccount.title': 'Nem találtuk ezt a fiókot',
  'error.noAccount.detail': 'Ellenőrizze a címet, vagy hozzon létre új fiókot.',
  'error.passwordTooShort.title': 'Túl rövid jelszó',
  'error.passwordTooShort.detail':
    'Válasszon hosszabb jelmondatot, és próbálja újra.',
  'error.passwordTooLong.title': 'Túl hosszú jelszó',
  'error.passwordTooLong.detail':
    'Válasszon rövidebb jelmondatot, és próbálja újra.',
  'error.linkSpent.title': 'Ez a hivatkozás már nem érvényes',
  'error.linkSpent.detail':
    'A jelszavas hivatkozások csak egyszer használhatók. Kérjen újat, és azonnal küldjük e-mailben.',
  'error.linkExpired.title': 'Ez a hivatkozás lejárt',
  'error.linkExpired.detail': 'Kérjen újat, és azonnal küldjük e-mailben.',
  'error.linkIncomplete.title': 'Ez a hivatkozás hiányos',
  'error.linkIncomplete.detail':
    'A jelszó-visszaállító hivatkozások egyszer használatos kulcsot hordoznak. Nyissa meg a legutóbbi levelet, vagy kérjen új hivatkozást.',
  'error.sessionExpired.title': 'A munkamenete lejárt',
  'error.sessionExpired.detail':
    'Jelentkezzen be újra, és folytassa ott, ahol abbahagyta.',
  'error.alreadyVerified.title': 'Már megerősítve',
  'error.alreadyVerified.detail':
    'Ez az e-mail-cím megerősített. A szokásos módon bejelentkezhet.',
  'error.badCode.title': 'Ez a kód nem működött',
  'error.badCode.detail':
    'A hitelesítő kódok fél percig élnek. Várja meg a következőt, és írja be mind a hat számjegyet.',
  'error.badBackupCode.title': 'Ez a tartalék kód nem működött',
  'error.badBackupCode.detail':
    'Minden tartalék kód egyszer használható. Próbálja a lista következő, még fel nem használt kódját.',
  'error.locked.title': 'A fiók átmenetileg zárolva',
  'error.locked.detail':
    'Túl sok sikertelen ellenőrzési kísérlet. Biztonsági okból néhány percre zároltuk ezt a fiókot.',
  'error.twoFactorOn.title': 'A kétlépcsős hitelesítés már be van kapcsolva',
  'error.twoFactorOn.detail':
    'Az újbóli beállítás miatt a jelenlegi hitelesítő alkalmazásod nem működne tovább, ezért semmit sem módosítottunk. Itt kezelheted.',
  'error.noTwoFactor.title': 'A kétfaktoros hitelesítés nincs beállítva',
  'error.noTwoFactor.detail':
    'A folytatáshoz jelentkezzen be az e-mail-címével és a jelszavával.',
  'error.twoFactorExpired.title': 'Kezdje elölről a bejelentkezéssel',
  'error.twoFactorExpired.detail':
    'Ez az ellenőrzési lépés lejárt. Adja meg még egyszer az e-mail-címét és a jelszavát.',
  'error.invitationGone.title': 'Ez a meghívó már nem érhető el',
  'error.invitationGone.detail':
    'Lehet, hogy lejárt, visszavonták, vagy már felhasználták. Kérjen új meghívót.',
  'error.invitationOther.title': 'Ez a meghívó valaki másnak szól',
  'error.invitationOther.detail':
    'Másik e-mail-címre küldtük. Jelentkezzen be azzal a címmel az elfogadáshoz.',
  'error.alreadyMember.title': 'Ön már tagja ennek a munkaterületnek',
  'error.alreadyMember.detail':
    'Nincs mit elfogadni — nyissa meg a munkaterület-váltóból.',
  'error.workspaceFull.title': 'Ez a munkaterület megtelt',
  'error.workspaceFull.detail':
    'Elérte a taglétszám-korlátját. Kérje meg a tulajdonost, hogy szabadítson fel egy helyet, vagy bővítse a csomagot.',
  'error.verifyBeforeJoin.title': 'Előbb erősítse meg a címét',
  'error.verifyBeforeJoin.detail':
    'Nyissa meg az e-mailben küldött megerősítő hivatkozást, majd térjen vissza ehhez a meghívóhoz.',

  'passkeyNotice.added': 'Új hozzáférési kulcs került a fiókodhoz',
  'passkeyNotice.removed': 'Egy hozzáférési kulcsot eltávolítottak a fiókodból',
  'passkeyNotice.security': 'Biztonság',
  'passkeyNotice.action': 'Hozzáférési kulcsok kezelése',
  'passkeyNotice.recovery':
    'Ha nem ismered fel ezt a módosítást, változtasd meg a jelszavad, és zárd be az ismeretlen munkameneteket. A jelszó visszaállítása nem távolítja el a hozzáférési kulcsokat. Ellenőrizd őket, és távolítsd el az ismeretleneket.',
} satisfies TranslationOf<typeof En>

export default messages
