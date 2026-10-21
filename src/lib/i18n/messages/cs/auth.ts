/**
 * Everything the authentication screens say, in Czech.
 *
 * Authored from `../en/auth.ts` (`docs/SPEC.md` §9 rule 9). These screens are
 * reachable with no session, so their language comes from the visitor cookie, then `Accept-Language`, then English and two thirds of the keys are failures — the moment a reader can least
 * afford a sentence in a language they do not read.
 *
 * **Plural.** Czech `one` (1) · `few` (2–4) · `other` (0 and 5 up) · `many`
 * **for fractions only**. A character count is never fractional, so the `many`
 * branches carry the decimal form for completeness rather than for a reader.
 *
 * **Gender.** Nothing below puts the reader into a gendered participle:
 * „Přihlášeno jako …“ rather than „Přihlásil jste se …“.
 *
 * **The example address** keeps the reserved `example.com` domain and localises
 * only the local part, so it and `field.name.placeholder` read as one person.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Domovská stránka planned.travel',
  'shell.legal':
    'Pokračováním souhlasíte s podmínkami služby a se zásadami ochrany osobních údajů planned.travel.',

  'panel.eyebrow': 'Plánujte společně',
  'panel.heading': 'Každá cesta — od prvního špendlíku po poslední pohlednici.',
  'panel.body':
    'Společné itineráře na skutečné mapě, rozpočty, které opravdu vyjdou, seznamy věcí, které si pamatují za vás, a deník, který stojí za uchování.',
  'panel.map.title': 'Jedna mapa, jeden plán',
  'panel.map.detail': 'Každá zastávka, nocleh i přejezd v jednom itineráři.',
  'panel.group.title': 'Všichni v jednom rytmu',
  'panel.group.detail':
    'Úpravy, hlasy a komentáře přicházejí naživo celé skupině.',
  'panel.costs.title': 'Náklady, které vyjdou',
  'panel.costs.detail': 'Společné rozpočty, vyrovnané zůstatky, žádné tabulky.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'nebo',
  'divider.orEmail': 'nebo použijte svůj e-mail',

  'social.continue': 'Pokračovat přes {provider}',
  'social.signUp': 'Zaregistrovat se přes {provider}',
  'social.opening': 'Otevírám {provider}',

  'passkey.action': 'Přihlásit se přístupovým klíčem',
  'passkey.waiting': 'Čekáme na vaše zařízení',

  'password.show': 'Zobrazit heslo',
  'password.hide': 'Skrýt heslo',
  'password.showNew': 'Zobrazit nové heslo',
  'password.hideNew': 'Skrýt nové heslo',
  'password.showConfirm': 'Zobrazit potvrzení hesla',
  'password.hideConfirm': 'Skrýt potvrzení hesla',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'E-mailová adresa',
  'field.email.placeholder': 'jan@example.com',
  'field.password': 'Heslo',
  'field.password.placeholder': 'Vaše heslo',
  'field.newPassword': 'Nové heslo',
  'field.newPassword.placeholder': 'Fráze, kterou si zapamatujete',
  'field.confirmPassword': 'Potvrďte heslo',
  'field.confirmNewPassword': 'Potvrďte nové heslo',
  'field.confirmPassword.placeholder': 'Napište ho ještě jednou',
  'field.name': 'Vaše jméno',
  'field.name.hint': 'Uvidí ho lidé, s nimiž plánujete cesty.',
  'field.name.placeholder': 'Jan Novák',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Zadejte svou e-mailovou adresu.',
  'validation.emailTooLong': 'Tato e-mailová adresa je příliš dlouhá.',
  'validation.emailInvalid': 'To nevypadá na e-mailovou adresu.',
  'validation.passwordRequired': 'Zadejte heslo.',
  'validation.passwordShort': {
    one: 'Použijte alespoň {value} znak — krátká fráze vyhraje nad chytrým slovem.',
    few: 'Použijte alespoň {value} znaky — krátká fráze vyhraje nad chytrým slovem.',
    many: 'Použijte alespoň {value} znaku — krátká fráze vyhraje nad chytrým slovem.',
    other:
      'Použijte alespoň {value} znaků — krátká fráze vyhraje nad chytrým slovem.',
  },
  'validation.passwordLong': {
    one: 'Vejděte se do {value} znaku.',
    few: 'Vejděte se do {value} znaků.',
    many: 'Vejděte se do {value} znaku.',
    other: 'Vejděte se do {value} znaků.',
  },
  'validation.passwordMismatch': 'Tato hesla se neshodují.',
  'validation.nameShort':
    'Zadejte své jméno, ať spolucestující vědí, kdo s nimi plánuje.',
  'validation.nameTooLong': 'Toto jméno je příliš dlouhé.',
  'validation.termsRequired':
    'Přijměte prosím podmínky, abyste mohli pokračovat.',
  'validation.codeLength': 'Kódy z autentizační aplikace mají šest číslic.',
  'validation.codeDigits': 'Kódy z autentizační aplikace jsou jen číslice.',
  'validation.backupShort': 'Tento záložní kód vypadá příliš krátce.',
  'validation.backupLong': 'Tento záložní kód vypadá příliš dlouze.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Vítejte zpátky',
  'login.heading': 'Přihlaste se do planned.travel',
  'login.description':
    'Vraťte se ke svým itinerářům, rozpočtům a seznamům přesně tam, kde skončily.',
  'login.newHere': 'Jste tu poprvé?',
  'login.createAccount': 'Vytvořit účet',
  'login.forgot': 'Zapomněli jste heslo?',
  'login.remember': 'Nechat mě přihlášeného na tomto zařízení',
  'login.submit': 'Přihlásit se',
  'login.submitting': 'Přihlašování',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Vytvořte si účet',
  'register.heading': 'Začněte plánovat za pár minut',
  'register.description':
    'Jeden účet pokryje každou cestu, každého spolucestujícího i každý seznam.',
  'register.haveAccount': 'Už máte účet?',
  'register.signIn': 'Přihlásit se',
  'register.terms':
    'Souhlasím s podmínkami služby a se zásadami ochrany osobních údajů.',
  'register.submit': 'Vytvořit účet',
  'register.submitting': 'Vytvářím účet',

  'strength.hint': {
    one: 'Alespoň {value} znak. Krátká fráze vyhraje nad chytrým slovem.',
    few: 'Alespoň {value} znaky. Krátká fráze vyhraje nad chytrým slovem.',
    many: 'Alespoň {value} znaku. Krátká fráze vyhraje nad chytrým slovem.',
    other: 'Alespoň {value} znaků. Krátká fráze vyhraje nad chytrým slovem.',
  },
  'strength.tooShort': 'Síla: příliš krátké',
  'strength.weak': 'Síla: slabé',
  'strength.fair': 'Síla: průměrné',
  'strength.strong': 'Síla: silné',
  'strength.excellent': 'Síla: výborné',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Pomoc s heslem',
  'forgot.heading': 'Obnovte si heslo',
  'forgot.description':
    'Řekněte nám adresu vedenou u účtu a pošleme na ni odkaz pro nastavení nového hesla.',
  'forgot.submit': 'Poslat mi odkaz',
  'forgot.submitting': 'Posílám odkaz',
  'forgot.back': 'Zpět na přihlášení',
  'forgot.sent.eyebrow': 'Podívejte se do pošty',
  'forgot.sent.heading': 'Odkaz na obnovu je na cestě',
  'forgot.sent.description':
    'Pokud některý účet používá {email}, odkaz na výběr nového hesla je právě v té poště.',
  'forgot.sent.title': 'Odkaz platí hodinu a jen jednou',
  'forgot.sent.body':
    'Nic nepřišlo? Zkontrolujte spam a pak odkaz pošlete znovu. Nový odkaz tiše ruší ten předchozí.',
  'forgot.sent.resend': 'Poslat znovu',
  'forgot.sent.resending': 'Posílám znovu',
  'forgot.sent.change': 'Použít jiný e-mail',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Obnova hesla',
  'reset.heading': 'Vyberte si nové heslo',
  'reset.description': {
    one: 'Vyberte něco dlouhé alespoň {value} znak. Krátkou frázi si snáz zapamatujete a hůř se hádá.',
    few: 'Vyberte něco dlouhé alespoň {value} znaky. Krátkou frázi si snáz zapamatujete a hůř se hádá.',
    many: 'Vyberte něco dlouhé alespoň {value} znaku. Krátkou frázi si snáz zapamatujete a hůř se hádá.',
    other:
      'Vyberte něco dlouhé alespoň {value} znaků. Krátkou frázi si snáz zapamatujete a hůř se hádá.',
  },
  'reset.submit': 'Nastavit nové heslo',
  'reset.submitting': 'Ukládám heslo',
  'reset.back': 'Zpět na přihlášení',
  'reset.stale.heading': 'Tento odkaz nelze použít',
  'reset.stale.description':
    'Odkazy na obnovu platí hodinu a fungují jen jednou — nejbezpečnější možná výměna.',
  'reset.stale.action': 'Vyžádat nový odkaz',
  'reset.done.heading': 'Nové heslo je nastavené',
  'reset.done.description':
    'Všechna ostatní sezení byla odhlášena, takže kdo znal staré heslo, už dovnitř nemá jak.',
  'reset.done.title': 'Odhlášeno všude jinde',
  'reset.done.body': 'Přihlaste se novým heslem a plánujte dál.',
  'reset.done.action': 'Přihlásit se',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Dvoufázové ověření',
  'twoFactor.heading': 'Potvrďte, že jste to vy',
  'twoFactor.description':
    'Váš účet chrání druhý faktor. Zadejte aktuální kód z autentizační aplikace.',
  'twoFactor.back': 'Začít znovu od přihlášení',
  'twoFactor.methods': 'Způsob ověření',
  'twoFactor.totp.tab': 'Aplikace',
  'twoFactor.totp.label': 'Šestimístný kód',
  'twoFactor.totp.hint': 'Kódy se obnovují každých 30 sekund.',
  'twoFactor.totp.submit': 'Ověřit a pokračovat',
  'twoFactor.backup.tab': 'Záložní kód',
  'twoFactor.backup.label': 'Záložní kód',
  'twoFactor.backup.hint':
    'Ze seznamu, který jste si uložili při zapnutí dvoufázového ověření. Každý kód funguje jednou.',
  'twoFactor.backup.submit': 'Použít záložní kód',
  'twoFactor.submitting': 'Kontroluji kód',
  'twoFactor.trust.label': 'Věřit tomuto zařízení 30 dní',
  'twoFactor.trust.detail':
    'Do té doby tento krok v tomto prohlížeči přeskočíme. Dělejte to jen na zařízení, které je jen vaše.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'E-mail potvrzen',
  'verify.done.heading': 'Máte hotovo',
  'verify.done.description':
    'Adresa je ověřená, takže pozvánky, upomínky a přehledy cest k vám dojdou.',
  'verify.done.title': 'Ověřeno',
  'verify.done.body': 'Adresa {email} je u tohoto účtu potvrzená.',
  'verify.done.bodyUnknown':
    'Vaše e-mailová adresa je u tohoto účtu potvrzená.',
  'verify.done.action': 'Přejít na přehled',

  'verify.pending.eyebrow': 'Ještě jedna věc',
  'verify.pending.heading': 'Potvrďte svou e-mailovou adresu',
  'verify.pending.description':
    'Poslali jsme potvrzovací odkaz na {email}. Když ho otevřete, půjde účet obnovit a spolucestující vás budou moci zvát.',
  'verify.pending.wrongAddress': 'Špatná adresa?',
  'verify.pending.changeIt': 'Změňte ji v nastavení',
  'verify.pending.title': 'Odkaz platí 24 hodin',
  'verify.pending.body':
    'Nic v poště? Zkontrolujte spam a pak odkaz pošlete znovu.',
  'verify.pending.resentTitle': 'Právě odesláno znovu',
  'verify.pending.resentBody':
    'Dejte tomu minutu a pak se podívejte do pošty — i do spamu.',
  'verify.pending.resend': 'Poslat potvrzení znovu',
  'verify.pending.resending': 'Posílám znovu',
  'verify.pending.continue': 'Pokračovat i tak',

  'verify.request.eyebrow': 'Potvrzení e-mailu',
  'verify.request.heading': 'Poslat nový potvrzovací odkaz',
  'verify.request.description':
    'Potvrzovací odkazy platí 24 hodin a fungují jen jednou. Řekněte nám svou adresu a nový je na cestě.',
  'verify.request.submit': 'Poslat potvrzovací odkaz',
  'verify.request.submitting': 'Posílám odkaz',
  'verify.request.sentTitle': 'Už je na cestě',
  'verify.request.sentBody':
    'Pokud u té adresy čeká účet na potvrzení, odkaz je právě v její poště.',
  'verify.request.change': 'Použít jiný e-mail',
  'verify.request.back': 'Zpět na přihlášení',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Pozvánka do prostoru',
  'invitation.heading': 'Připojte se k {workspace}',
  'invitation.description':
    'Přijetím se přidáte do tohoto prostoru a budou s vámi sdílené jeho cesty, rozpočty i seznamy.',
  'invitation.invitedAs': 'Pozvánka na adresu {email}',
  'invitation.role': 'Vaše funkce',
  'invitation.means': 'Znamená',
  'invitation.invitedBy': 'Zve vás',
  'invitation.expires': 'Platí do',
  'invitation.accept': 'Přijmout pozvánku',
  'invitation.accepting': 'Vstupuji do prostoru',
  'invitation.decline': 'Odmítnout',
  'invitation.declining': 'Odmítám',
  'invitation.reassurance':
    'Prostor můžete kdykoli opustit v jeho nastavení a nic, co vytvoříte mimo něj, se nikdy nesdílí.',

  'invitation.role.owner': 'Vlastník — plná kontrola včetně plateb',
  'invitation.role.admin': 'Správce — spravuje cesty, lidi a nastavení',
  'invitation.role.member': 'Člen — plánuje cesty společně s ostatními',
  'invitation.role.other': '{role} — přístup nastavuje vlastník prostoru',
  'invitation.role.badge.owner': 'Vlastník',
  'invitation.role.badge.admin': 'Správce',
  'invitation.role.badge.member': 'Člen',

  'invitation.anonymous.heading': 'Přihlaste se a pozvánku uvidíte',
  'invitation.anonymous.description':
    'Pozvánky jsou svázané s adresou, na kterou byly poslané, takže musíme vědět, kdo jste, než vám tuhle ukážeme.',
  'invitation.anonymous.body':
    'Použijte adresu, na kterou pozvánka přišla. Hned potom vás vrátíme zpátky sem.',
  'invitation.anonymous.action': 'Přihlásit se a pokračovat',
  'invitation.anonymous.noAccount': 'Ještě nemáte účet?',
  'invitation.anonymous.register': 'Vytvořte ho na pozvanou adresu',

  'invitation.mismatch.heading': 'Tato pozvánka patří jiné adrese',
  'invitation.mismatch.description':
    'Toto sezení patří někomu jinému, takže tuhle pozvánku nemáte jak přijmout.',
  'invitation.mismatch.title': 'Přihlášeno jako {email}',
  'invitation.mismatch.body':
    'Odhlaste se a přihlaste adresou, na kterou pozvánka přišla, nebo si nechte poslat novou pozvánku na tento účet.',
  'invitation.mismatch.action': 'Přepnout účet',
  'invitation.mismatch.back': 'Zpět na přihlášení',

  'invitation.unverified.heading': 'Potvrďte e-mail a můžete vstoupit',
  'invitation.unverified.description':
    'Prostory přijímají jen potvrzené adresy, aby nikdo nebyl přidán kvůli překlepu.',
  'invitation.unverified.title': 'Adresa {email} ještě není potvrzená',
  'invitation.unverified.body':
    'Otevřete potvrzovací odkaz ve své poště a vraťte se na tuto stránku. Pozvánka tu bude čekat.',
  'invitation.unverified.action': 'Potvrdit můj e-mail',
  'invitation.unverified.resend': 'Poslat potvrzovací e-mail znovu',

  'invitation.unavailable.heading': 'Tato pozvánka už není k dispozici',
  'invitation.unavailable.description':
    'Pozvánky platí sedm dní a končí v okamžiku, kdy je někdo použije nebo je zruší.',
  'invitation.unavailable.title': 'Není tu co přijmout',
  'invitation.unavailable.body':
    'Požádejte o novou pozvánku toho, kdo vás zval, a tato stránka ji hned ukáže.',
  'invitation.unavailable.dashboard': 'Přejít na přehled',

  'invitation.declined.eyebrow': 'Pozvánka odmítnuta',
  'invitation.declined.heading': 'Nic se neděje — nic nebylo sdíleno',
  'invitation.declined.description':
    'Vlastník prostoru se to dozvěděl a tento odkaz už nelze použít.',
  'invitation.declined.action': 'Přejít na přehled',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Něco se nepovedlo',
  'error.unexpected.detail': 'Tohle nefungovalo. Zkuste to prosím za chvíli.',
  'error.rateLimited.title': 'Příliš mnoho pokusů',
  'error.rateLimited.detail':
    'Kvůli bezpečnosti jsme přihlašování z tohoto zařízení na pár minut pozastavili. Zkuste to brzy znovu.',
  'error.offline.title': 'Bez připojení',
  'error.offline.detail':
    'Nepodařilo se spojit s planned.travel. Zkontrolujte připojení a zkuste to znovu.',

  'error.credentials.title': 'Tyto údaje se neshodují',
  'error.credentials.detail':
    'Zkontrolujte e-mailovou adresu a heslo a zkuste to znovu. Pokud jste se registrovali přes Google nebo Apple, použijte to tlačítko.',
  'error.password.title': 'Tyto údaje se neshodují',
  'error.password.detail':
    'Zkontrolujte e-mailovou adresu a heslo a zkuste to znovu.',
  'error.noPassword.title': 'Tento účet nemá heslo',
  'error.noPassword.detail':
    'Tento účet se přihlašuje přes sociální službu nebo přístupovým klíčem. Použijte jednu z možností výše.',
  'error.unverified.title': 'Nejprve potvrďte e-mail',
  'error.unverified.detail':
    'Při registraci jsme vám poslali potvrzovací odkaz. Otevřete ho a vraťte se sem.',
  'error.emailTaken.title': 'Tento e-mail je už zaregistrovaný',
  'error.emailTaken.detail':
    'Přihlaste se, nebo si obnovte heslo, pokud jste ho zapomněli.',
  'error.noAccount.title': 'Takový účet jsme nenašli',
  'error.noAccount.detail': 'Zkontrolujte adresu, nebo si vytvořte nový účet.',
  'error.passwordTooShort.title': 'Heslo je příliš krátké',
  'error.passwordTooShort.detail': 'Vyberte delší frázi a zkuste to znovu.',
  'error.passwordTooLong.title': 'Heslo je příliš dlouhé',
  'error.passwordTooLong.detail': 'Vyberte kratší frázi a zkuste to znovu.',
  'error.linkSpent.title': 'Tento odkaz už neplatí',
  'error.linkSpent.detail':
    'Odkazy k heslu jdou použít jen jednou. Vyžádejte si nový a hned ho pošleme.',
  'error.linkExpired.title': 'Tento odkaz vypršel',
  'error.linkExpired.detail': 'Vyžádejte si nový a hned ho pošleme.',
  'error.linkIncomplete.title': 'Tento odkaz je nekompletní',
  'error.linkIncomplete.detail':
    'Odkazy na obnovu hesla nesou jednorázový token. Otevřete nejnovější e-mail, nebo si vyžádejte nový odkaz.',
  'error.sessionExpired.title': 'Vaše sezení vypršelo',
  'error.sessionExpired.detail':
    'Přihlaste se znovu a navažte tam, kde jste skončili.',
  'error.alreadyVerified.title': 'Už potvrzeno',
  'error.alreadyVerified.detail':
    'Tato e-mailová adresa je ověřená. Můžete se přihlásit jako obvykle.',
  'error.badCode.title': 'Tento kód nefungoval',
  'error.badCode.detail':
    'Kódy z aplikace platí 30 sekund. Počkejte na další a zadejte všech šest číslic.',
  'error.badBackupCode.title': 'Tento záložní kód nefungoval',
  'error.badBackupCode.detail':
    'Každý záložní kód funguje jednou. Zkuste další nepoužitý ze svého seznamu.',
  'error.locked.title': 'Účet je dočasně zamčený',
  'error.locked.detail':
    'Příliš mnoho neúspěšných pokusů o ověření. Kvůli bezpečnosti je účet na pár minut zamčený.',
  'error.twoFactorOn.title': 'Dvoufázové ověření už je zapnuté',
  'error.twoFactorOn.detail':
    'Nové nastavení by zastavilo fungování současného autentikátoru, proto se nic nezměnilo. Spravovat ho můžete zde.',
  'error.noTwoFactor.title': 'Dvoufázové ověření není nastavené',
  'error.noTwoFactor.detail': 'Pokračujte přihlášením e-mailem a heslem.',
  'error.twoFactorExpired.title': 'Začněte znovu od přihlášení',
  'error.twoFactorExpired.detail':
    'Tento krok ověření vypršel. Zadejte e-mail a heslo ještě jednou.',
  'error.invitationGone.title': 'Tato pozvánka už není k dispozici',
  'error.invitationGone.detail':
    'Mohla vypršet, být zrušená, nebo už být použitá. Požádejte o novou pozvánku.',
  'error.invitationOther.title': 'Tato pozvánka patří někomu jinému',
  'error.invitationOther.detail':
    'Byla poslaná na jinou e-mailovou adresu. Přihlaste se tou adresou a přijměte ji.',
  'error.alreadyMember.title': 'V tomto prostoru už jste',
  'error.alreadyMember.detail':
    'Není co přijímat — otevřete ho z přepínače prostorů.',
  'error.workspaceFull.title': 'Tento prostor je plný',
  'error.workspaceFull.detail':
    'Dosáhl limitu členů. Požádejte vlastníka, ať uvolní místo nebo navýší tarif.',
  'error.verifyBeforeJoin.title': 'Nejprve potvrďte e-mail',
  'error.verifyBeforeJoin.detail':
    'Otevřete potvrzovací odkaz z našeho e-mailu a vraťte se k této pozvánce.',

  'passkeyNotice.added': 'Do vašeho účtu byl přidán přístupový klíč',
  'passkeyNotice.removed': 'Z vašeho účtu byl odebrán přístupový klíč',
  'passkeyNotice.security': 'Zabezpečení',
  'passkeyNotice.action': 'Spravovat přístupové klíče',
  'passkeyNotice.recovery':
    'Pokud tuto změnu nepoznáváte, změňte heslo a ukončete neznámé relace. Obnovení hesla neodebere přístupové klíče. Zkontrolujte je a odeberte ty, které nepoznáváte.',
  'error.passwordAttemptsLocked.title': 'Potvrzení hesla je zablokováno',
  'error.passwordAttemptsLocked.detail':
    'V této relaci už nelze potvrdit heslo. Odhlaste se a znovu se přihlaste.',
  'error.passwordResultUnknown.title': 'Zkontrolujte nastavení zabezpečení',
  'error.passwordResultUnknown.detail':
    'Změna se mohla uložit. Nechte tuto relaci otevřenou, dokud se nebudete moci znovu přihlásit. Pokud jste měnili heslo, zkuste nové. Pokud jste nahrazovali záložní kódy, staré už nemusí fungovat; pomocí ověřovací aplikace nebo jiné přihlášené relace vygenerujte novou sadu.',
} satisfies TranslationOf<typeof En>

export default messages
