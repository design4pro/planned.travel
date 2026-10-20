/**
 * Everything the authentication screens say, in Swedish.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Why these screens matter more than their size suggests.** They are the only
 * ones a traveller reaches with no session, so the language comes purely from
 * `Accept-Language` and there is no stored preference to correct a bad guess
 * with. Two thirds of the keys below are validation and failure copy that only
 * appears once something has gone wrong — exactly when a reader can least
 * afford a sentence in a language they do not read.
 *
 * **Plural.** `Intl.PluralRules('sv')` reports `one` and `other`. Swedish
 * "tecken" is invariant under a count while "dag" is not, so the
 * character-count messages carry the same sentence in both branches on purpose.
 *
 * **Names that stay.** `planned.travel` is written out rather than
 * interpolated, `{provider}` is a trademark, and the example domain
 * `example.com` is reserved — only the local part of the address placeholder is
 * translated.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'planned.travel startsida',
  'shell.legal':
    'Genom att fortsätta godtar du villkoren och integritetspolicyn för planned.travel.',

  'panel.eyebrow': 'Planera tillsammans',
  'panel.heading': 'Varje resa, från första nålen till sista vykortet.',
  'panel.body':
    'Gemensamma dagsplaner på en riktig karta, budgetar som faktiskt går ihop, packlistor med minne och en dagbok värd att spara.',
  'panel.map.title': 'En karta, en plan',
  'panel.map.detail': 'Varje stopp, boende och byte i en och samma dagsplan.',
  'panel.group.title': 'Alla i takt',
  'panel.group.detail':
    'Ändringar, röster och kommentarer landar direkt hos hela sällskapet.',
  'panel.costs.title': 'Kostnader som går ihop',
  'panel.costs.detail':
    'Gemensamma budgetar, reglerade belopp, inget kalkylblad.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'eller',
  'divider.orEmail': 'eller använd din mejladress',

  'social.continue': 'Fortsätt med {provider}',
  'social.signUp': 'Skapa konto med {provider}',
  'social.opening': '{provider} öppnas',

  'passkey.action': 'Logga in med en lösenordsnyckel',
  'passkey.waiting': 'Väntar på din enhet',

  'password.show': 'Visa lösenordet',
  'password.hide': 'Dölj lösenordet',
  'password.showNew': 'Visa det nya lösenordet',
  'password.hideNew': 'Dölj det nya lösenordet',
  'password.showConfirm': 'Visa bekräftelsen av lösenordet',
  'password.hideConfirm': 'Dölj bekräftelsen av lösenordet',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Mejladress',
  'field.email.placeholder': 'du@example.com',
  'field.password': 'Lösenord',
  'field.password.placeholder': 'Ditt lösenord',
  'field.newPassword': 'Nytt lösenord',
  'field.newPassword.placeholder': 'En mening du kommer ihåg',
  'field.confirmPassword': 'Bekräfta lösenordet',
  'field.confirmNewPassword': 'Bekräfta det nya lösenordet',
  'field.confirmPassword.placeholder': 'Skriv det en gång till',
  'field.name': 'Ditt namn',
  'field.name.hint': 'Syns för dem du planerar resor med.',
  'field.name.placeholder': 'Elin Lindqvist',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Fyll i din mejladress.',
  'validation.emailTooLong': 'Den mejladressen är för lång.',
  'validation.emailInvalid': 'Det ser inte ut som en mejladress.',
  'validation.passwordRequired': 'Fyll i ditt lösenord.',
  'validation.passwordShort': {
    one: 'Ta minst {value} tecken — en kort mening slår ett listigt ord.',
    other: 'Ta minst {value} tecken — en kort mening slår ett listigt ord.',
  },
  'validation.passwordLong': {
    one: 'Håll dig under {value} tecken.',
    other: 'Håll dig under {value} tecken.',
  },
  'validation.passwordMismatch': 'Lösenorden stämmer inte överens.',
  'validation.nameShort': 'Fyll i ditt namn, så vet ressällskapet vem du är.',
  'validation.nameTooLong': 'Det namnet är för långt.',
  'validation.termsRequired': 'Godta villkoren för att gå vidare.',
  'validation.codeLength': 'Koder från appen har sex siffror.',
  'validation.codeDigits': 'Koder från appen består bara av siffror.',
  'validation.backupShort': 'Den reservkoden verkar för kort.',
  'validation.backupLong': 'Den reservkoden verkar för lång.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Välkommen tillbaka',
  'login.heading': 'Logga in på planned.travel',
  'login.description':
    'Ta upp dina dagsplaner, budgetar och listor exakt där du lämnade dem.',
  'login.newHere': 'Ny här?',
  'login.createAccount': 'Skapa ett konto',
  'login.forgot': 'Glömt lösenordet?',
  'login.remember': 'Håll mig inloggad på den här enheten',
  'login.submit': 'Logga in',
  'login.submitting': 'Du loggas in',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Skapa ditt konto',
  'register.heading': 'Börja planera på ett par minuter',
  'register.description':
    'Ett konto räcker för varje resa, varje ressällskap och varje lista.',
  'register.haveAccount': 'Har du redan ett konto?',
  'register.signIn': 'Logga in',
  'register.terms': 'Jag godtar villkoren och integritetspolicyn.',
  'register.submit': 'Skapa konto',
  'register.submitting': 'Ditt konto skapas',

  'strength.hint': {
    one: 'Minst {value} tecken. En kort mening slår ett listigt ord.',
    other: 'Minst {value} tecken. En kort mening slår ett listigt ord.',
  },
  'strength.tooShort': 'Styrka: för kort',
  'strength.weak': 'Styrka: svagt',
  'strength.fair': 'Styrka: hyfsat',
  'strength.strong': 'Styrka: starkt',
  'strength.excellent': 'Styrka: utmärkt',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Hjälp med lösenordet',
  'forgot.heading': 'Återställ ditt lösenord',
  'forgot.description':
    'Uppge adressen på ditt konto, så mejlar vi en länk där du väljer ett nytt lösenord.',
  'forgot.submit': 'Mejla mig en länk',
  'forgot.submitting': 'Din länk skickas',
  'forgot.back': 'Tillbaka till inloggningen',
  'forgot.sent.eyebrow': 'Titta i inkorgen',
  'forgot.sent.heading': 'Din länk är på väg',
  'forgot.sent.description':
    'Om ett konto använder {email} ligger en länk för ett nytt lösenord i den inkorgen nu.',
  'forgot.sent.title': 'Länken fungerar en gång, i en timme',
  'forgot.sent.body':
    'Kom ingenting fram? Kolla skräpposten och skicka den sedan igen. En ny länk sätter tyst den förra ur spel.',
  'forgot.sent.resend': 'Skicka den igen',
  'forgot.sent.resending': 'Skickas igen',
  'forgot.sent.change': 'Använd en annan mejladress',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Återställning av lösenord',
  'reset.heading': 'Välj ett nytt lösenord',
  'reset.description': {
    one: 'Ta något på minst {value} tecken. En kort mening är lättare att minnas och svårare att gissa.',
    other:
      'Ta något på minst {value} tecken. En kort mening är lättare att minnas och svårare att gissa.',
  },
  'reset.submit': 'Spara det nya lösenordet',
  'reset.submitting': 'Ditt lösenord sparas',
  'reset.back': 'Tillbaka till inloggningen',
  'reset.stale.heading': 'Den här länken går inte att använda',
  'reset.stale.description':
    'Länkar går ut efter en timme och fungerar bara en gång — den tryggaste bytesaffär som finns.',
  'reset.stale.action': 'Begär en ny länk',
  'reset.done.heading': 'Ditt nya lösenord är på plats',
  'reset.done.description':
    'Alla andra sessioner har loggats ut, så den som hade det gamla lösenordet kommer inte in längre.',
  'reset.done.title': 'Utloggad överallt annars',
  'reset.done.body': 'Logga in med ditt nya lösenord och planera vidare.',
  'reset.done.action': 'Logga in',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Verifiering i två steg',
  'twoFactor.heading': 'Bekräfta att det är du',
  'twoFactor.description':
    'Ditt konto skyddas av ett andra steg. Fyll i den aktuella koden från din autentiseringsapp.',
  'twoFactor.back': 'Börja om från inloggningen',
  'twoFactor.methods': 'Sätt att verifiera',
  'twoFactor.totp.tab': 'Autentiseringsapp',
  'twoFactor.totp.label': 'Sexsiffrig kod',
  'twoFactor.totp.hint': 'Koderna byts var 30:e sekund.',
  'twoFactor.totp.submit': 'Bekräfta och fortsätt',
  'twoFactor.backup.tab': 'Reservkod',
  'twoFactor.backup.label': 'Reservkod',
  'twoFactor.backup.hint':
    'Från listan du sparade när du slog på det andra steget. Varje kod fungerar en gång.',
  'twoFactor.backup.submit': 'Använd en reservkod',
  'twoFactor.submitting': 'Din kod kontrolleras',
  'twoFactor.trust.label': 'Lita på den här enheten i 30 dagar',
  'twoFactor.trust.detail':
    'Fram till dess hoppas steget över i den här webbläsaren. Gör det bara på en enhet som är din ensam.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Mejladressen bekräftad',
  'verify.done.heading': 'Allt är klart',
  'verify.done.description':
    'Din adress är bekräftad, så inbjudningar, påminnelser och resesammandrag når fram till dig.',
  'verify.done.title': 'Bekräftad',
  'verify.done.body': '{email} är bekräftad på det här kontot.',
  'verify.done.bodyUnknown': 'Din mejladress är bekräftad på det här kontot.',
  'verify.done.action': 'Gå till din översikt',

  'verify.pending.eyebrow': 'En sista sak',
  'verify.pending.heading': 'Bekräfta din mejladress',
  'verify.pending.description':
    'Vi skickade en bekräftelselänk till {email}. Att öppna den håller kontot återställbart och låter ressällskap bjuda in dig.',
  'verify.pending.wrongAddress': 'Fel adress?',
  'verify.pending.changeIt': 'Ändra den i inställningarna',
  'verify.pending.title': 'Länken gäller i 24 timmar',
  'verify.pending.body':
    'Inget i inkorgen? Kolla skräpposten och skicka den sedan igen.',
  'verify.pending.resentTitle': 'Skickad igen alldeles nyss',
  'verify.pending.resentBody':
    'Ge den en minut och titta sedan i inkorgen — och i skräpposten.',
  'verify.pending.resend': 'Skicka bekräftelsen igen',
  'verify.pending.resending': 'Skickas igen',
  'verify.pending.continue': 'Fortsätt ändå',

  'verify.request.eyebrow': 'Bekräftelse av mejladress',
  'verify.request.heading': 'Skicka en ny bekräftelselänk',
  'verify.request.description':
    'Bekräftelselänkar gäller i 24 timmar och fungerar bara en gång. Uppge din adress, så är en färsk på väg.',
  'verify.request.submit': 'Skicka bekräftelselänk',
  'verify.request.submitting': 'Din länk skickas',
  'verify.request.sentTitle': 'På väg',
  'verify.request.sentBody':
    'Om den adressen har ett konto som väntar på bekräftelse ligger länken i inkorgen nu.',
  'verify.request.change': 'Använd en annan mejladress',
  'verify.request.back': 'Tillbaka till inloggningen',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Inbjudan till en arbetsyta',
  'invitation.heading': 'Gå med i {workspace}',
  'invitation.description':
    'Att tacka ja lägger till dig i arbetsytan och delar dess resor, budgetar och listor med dig.',
  'invitation.invitedAs': 'Inbjuden som {email}',
  'invitation.role': 'Din roll',
  'invitation.means': 'Innebär',
  'invitation.invitedBy': 'Inbjuden av',
  'invitation.expires': 'Går ut',
  'invitation.accept': 'Tacka ja till inbjudan',
  'invitation.accepting': 'Du går med i arbetsytan',
  'invitation.decline': 'Tacka nej',
  'invitation.declining': 'Tackar nej',
  'invitation.reassurance':
    'Du kan lämna en arbetsyta när som helst via dess inställningar, och ingenting du skapar utanför den delas någonsin.',

  'invitation.role.owner': 'Ägare — full kontroll, även över betalningen',
  'invitation.role.admin':
    'Administratör — sköter resor, medlemmar och inställningar',
  'invitation.role.member': 'Medlem — planerar resor jämsides med alla andra',
  'invitation.role.other': '{role} — åtkomst som arbetsytans ägare har bestämt',
  'invitation.role.badge.owner': 'Ägare',
  'invitation.role.badge.admin': 'Administratör',
  'invitation.role.badge.member': 'Medlem',

  'invitation.anonymous.heading': 'Logga in för att se din inbjudan',
  'invitation.anonymous.description':
    'Inbjudningar hör ihop med adressen de skickades till, så vi behöver veta vem du är innan vi kan visa den här.',
  'invitation.anonymous.body':
    'Använd adressen som inbjudan gick till. Sedan tar vi dig raka vägen tillbaka hit.',
  'invitation.anonymous.action': 'Logga in för att fortsätta',
  'invitation.anonymous.noAccount': 'Inget konto än?',
  'invitation.anonymous.register': 'Skapa ett med den inbjudna adressen',

  'invitation.mismatch.heading': 'Den här inbjudan gäller en annan adress',
  'invitation.mismatch.description':
    'Du är inloggad som någon annan, så den här är inte din att tacka ja till.',
  'invitation.mismatch.title': 'Inloggad som {email}',
  'invitation.mismatch.body':
    'Logga ut och in igen med adressen som inbjudan gick till, eller be om en ny inbjudan till det här kontot.',
  'invitation.mismatch.action': 'Byt konto',
  'invitation.mismatch.back': 'Tillbaka till inloggningen',

  'invitation.unverified.heading': 'Bekräfta din mejladress för att gå med',
  'invitation.unverified.description':
    'Arbetsytor tar bara emot bekräftade adresser, så att ingen läggs till genom ett stavfel.',
  'invitation.unverified.title': '{email} är inte bekräftad än',
  'invitation.unverified.body':
    'Öppna bekräftelselänken i inkorgen och kom sedan tillbaka hit. Inbjudan väntar kvar.',
  'invitation.unverified.action': 'Bekräfta min mejladress',
  'invitation.unverified.resend': 'Skicka bekräftelsemejlet igen',

  'invitation.unavailable.heading': 'Den här inbjudan finns inte längre',
  'invitation.unavailable.description':
    'Inbjudningar gäller i sju dagar och upphör i samma stund som de används eller dras tillbaka.',
  'invitation.unavailable.title': 'Här finns inget att tacka ja till',
  'invitation.unavailable.body':
    'Be den som bjöd in dig om en färsk inbjudan, så visar den här sidan den direkt.',
  'invitation.unavailable.dashboard': 'Gå till din översikt',

  'invitation.declined.eyebrow': 'Inbjudan avböjd',
  'invitation.declined.heading': 'Ingen fara — ingenting delades',
  'invitation.declined.description':
    'Arbetsytans ägare har fått besked, och den här länken går inte att använda längre.',
  'invitation.declined.action': 'Gå till din översikt',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Något gick fel',
  'error.unexpected.detail':
    'Det där fungerade inte. Försök igen om en liten stund.',
  'error.rateLimited.title': 'För många försök',
  'error.rateLimited.detail':
    'För din säkerhet har vi pausat inloggningen från den här enheten i några minuter. Försök igen strax.',
  'error.offline.title': 'Ingen uppkoppling',
  'error.offline.detail':
    'Vi nådde inte planned.travel. Kontrollera din uppkoppling och försök igen.',

  'error.credentials.title': 'De uppgifterna hör inte ihop',
  'error.credentials.detail':
    'Kontrollera mejladressen och lösenordet och försök igen. Skapade du kontot med Google eller Apple, använd den knappen i stället.',
  'error.password.title': 'De uppgifterna hör inte ihop',
  'error.password.detail':
    'Kontrollera mejladressen och lösenordet och försök igen.',
  'error.noPassword.title': 'Inget lösenord på det här kontot',
  'error.noPassword.detail':
    'Det här kontot loggar in via en leverantör eller en lösenordsnyckel. Använd ett av alternativen ovanför.',
  'error.unverified.title': 'Bekräfta din mejladress först',
  'error.unverified.detail':
    'Vi skickade en bekräftelselänk när du skapade kontot. Öppna den och kom sedan tillbaka hit.',
  'error.emailTaken.title': 'Den mejladressen är redan registrerad',
  'error.emailTaken.detail':
    'Logga in i stället, eller återställ lösenordet om du har glömt det.',
  'error.noAccount.title': 'Vi hittade inte det kontot',
  'error.noAccount.detail': 'Kontrollera adressen, eller skapa ett nytt konto.',
  'error.passwordTooShort.title': 'Lösenordet är för kort',
  'error.passwordTooShort.detail': 'Välj en längre mening och försök igen.',
  'error.passwordTooLong.title': 'Lösenordet är för långt',
  'error.passwordTooLong.detail': 'Välj en kortare mening och försök igen.',
  'error.linkSpent.title': 'Den här länken gäller inte längre',
  'error.linkSpent.detail':
    'Lösenordslänkar går bara att använda en gång. Begär en färsk, så mejlar vi den direkt.',
  'error.linkExpired.title': 'Den här länken har gått ut',
  'error.linkExpired.detail': 'Begär en ny, så mejlar vi den direkt.',
  'error.linkIncomplete.title': 'Den här länken är ofullständig',
  'error.linkIncomplete.detail':
    'Lösenordslänkar bär ett engångskvitto. Öppna det senaste mejlet, eller begär en färsk länk.',
  'error.sessionExpired.title': 'Din session gick ut',
  'error.sessionExpired.detail': 'Logga in igen och ta vid där du slutade.',
  'error.alreadyVerified.title': 'Redan bekräftad',
  'error.alreadyVerified.detail':
    'Den här mejladressen är bekräftad. Du kan logga in som vanligt.',
  'error.badCode.title': 'Den koden fungerade inte',
  'error.badCode.detail':
    'Koder från appen gäller i 30 sekunder. Vänta på nästa och fyll i alla sex siffrorna.',
  'error.badBackupCode.title': 'Den reservkoden fungerade inte',
  'error.badBackupCode.detail':
    'Varje reservkod fungerar en gång. Prova nästa oanvända kod i listan.',
  'error.locked.title': 'Kontot är tillfälligt låst',
  'error.locked.detail':
    'För många misslyckade försök. För din säkerhet är kontot låst i några minuter.',
  'error.twoFactorOn.title': 'Tvåfaktorsautentisering är redan på',
  'error.twoFactorOn.detail':
    'Om du ställer in den igen skulle din nuvarande autentiseringsapp sluta fungera, så inget har ändrats. Du kan hantera den här.',
  'error.noTwoFactor.title': 'Det andra steget är inte inställt',
  'error.noTwoFactor.detail':
    'Logga in med mejladress och lösenord för att fortsätta.',
  'error.twoFactorExpired.title': 'Börja om från inloggningen',
  'error.twoFactorExpired.detail':
    'Det här steget gick ut. Fyll i mejladress och lösenord en gång till.',
  'error.invitationGone.title': 'Den här inbjudan finns inte längre',
  'error.invitationGone.detail':
    'Den kan ha gått ut, dragits tillbaka eller redan använts. Be om en färsk inbjudan.',
  'error.invitationOther.title': 'Den här inbjudan gäller någon annan',
  'error.invitationOther.detail':
    'Den skickades till en annan mejladress. Logga in med den adressen för att tacka ja.',
  'error.alreadyMember.title': 'Du är redan i den här arbetsytan',
  'error.alreadyMember.detail':
    'Det finns inget att tacka ja till — öppna den från växlaren.',
  'error.workspaceFull.title': 'Den här arbetsytan är full',
  'error.workspaceFull.detail':
    'Den har nått sitt medlemstak. Be en ägare att frigöra en plats eller uppgradera abonnemanget.',
  'error.verifyBeforeJoin.title': 'Bekräfta din mejladress först',
  'error.verifyBeforeJoin.detail':
    'Öppna bekräftelselänken vi mejlade och kom sedan tillbaka till den här inbjudan.',

  'passkeyNotice.added': 'En passnyckel har lagts till på ditt konto',
  'passkeyNotice.removed': 'En passnyckel har tagits bort från ditt konto',
  'passkeyNotice.security': 'Säkerhet',
  'passkeyNotice.action': 'Hantera passnycklar',
  'passkeyNotice.recovery':
    'Om du inte känner igen ändringen, byt lösenord och avsluta okända sessioner. En lösenordsåterställning tar inte bort passnycklar. Granska dem och ta bort dem du inte känner igen.',
  'error.passwordAttemptsLocked.title': 'Lösenordsbekräftelse låst',
  'error.passwordAttemptsLocked.detail':
    'Den här sessionen kan inte längre bekräfta ditt lösenord. Logga ut och logga in igen.',
  'error.passwordResultUnknown.title':
    'Kontrollera dina säkerhetsinställningar',
  'error.passwordResultUnknown.detail':
    'Ändringen kan ha sparats. Håll den här sessionen öppen tills du kan logga in igen. Om du ändrade lösenordet, prova det nya. Om du ersatte reservkoder kan den gamla uppsättningen ha slutat fungera; använd din autentiseringsapp eller en annan inloggad session för att skapa nya koder.',
} satisfies TranslationOf<typeof En>

export default messages
