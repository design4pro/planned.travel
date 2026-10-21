/**
 * Everything the authentication screens say, in Dutch.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §9 rule 9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Why the register matters most here.** These are the only screens a
 * traveller reaches with no session, so the language comes from
 * the visitor cookie, then `Accept-Language`, then English. They say `je` like the rest of the Dutch catalogue: an account that
 * greets you with `u` and then plans your holiday with `je` reads as two
 * products.
 *
 * **Plural.** `Intl.PluralRules('nl')` reports `one` and `other`. Dutch
 * "teken" and "dag" behave differently under a count — the first is invariant
 * and the second is not — so the character-count messages carry the same
 * sentence in both branches on purpose.
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
  'shell.home': 'planned.travel startpagina',
  'shell.legal':
    'Als je doorgaat ga je akkoord met de voorwaarden en de privacyverklaring van planned.travel.',

  'panel.eyebrow': 'Samen plannen',
  'panel.heading':
    'Elke reis, van de eerste speld tot de laatste ansichtkaart.',
  'panel.body':
    'Gedeelde dagplannen op een echte kaart, budgetten die echt kloppen, paklijsten met geheugen en een dagboek dat je bewaart.',
  'panel.map.title': 'Eén kaart, één plan',
  'panel.map.detail': 'Elke stop, overnachting en overstap in één dagplan.',
  'panel.group.title': 'Iedereen gelijk op',
  'panel.group.detail':
    'Wijzigingen, stemmen en opmerkingen komen live bij de hele groep binnen.',
  'panel.costs.title': 'Kosten die kloppen',
  'panel.costs.detail':
    'Gedeelde budgetten, vereffende bedragen, geen rekenblad.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'of',
  'divider.orEmail': 'of gebruik je e-mailadres',

  'social.continue': 'Doorgaan met {provider}',
  'social.signUp': 'Aanmelden met {provider}',
  'social.opening': '{provider} wordt geopend',

  'passkey.action': 'Inloggen met een toegangssleutel',
  'passkey.waiting': 'Wachten op je apparaat',

  'password.show': 'Wachtwoord tonen',
  'password.hide': 'Wachtwoord verbergen',
  'password.showNew': 'Nieuw wachtwoord tonen',
  'password.hideNew': 'Nieuw wachtwoord verbergen',
  'password.showConfirm': 'Bevestiging van het wachtwoord tonen',
  'password.hideConfirm': 'Bevestiging van het wachtwoord verbergen',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'E-mailadres',
  'field.email.placeholder': 'jij@example.com',
  'field.password': 'Wachtwoord',
  'field.password.placeholder': 'Je wachtwoord',
  'field.newPassword': 'Nieuw wachtwoord',
  'field.newPassword.placeholder': 'Een zin die je onthoudt',
  'field.confirmPassword': 'Wachtwoord bevestigen',
  'field.confirmNewPassword': 'Nieuw wachtwoord bevestigen',
  'field.confirmPassword.placeholder': 'Typ het nog een keer',
  'field.name': 'Je naam',
  'field.name.hint': 'Zichtbaar voor de mensen met wie je reizen plant.',
  'field.name.placeholder': 'Sanne de Vries',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Vul je e-mailadres in.',
  'validation.emailTooLong': 'Dat e-mailadres is te lang.',
  'validation.emailInvalid': 'Dat lijkt geen e-mailadres.',
  'validation.passwordRequired': 'Vul je wachtwoord in.',
  'validation.passwordShort': {
    one: 'Neem minstens {value} teken — een korte zin verslaat een slim woord.',
    other:
      'Neem minstens {value} tekens — een korte zin verslaat een slim woord.',
  },
  'validation.passwordLong': {
    one: 'Blijf onder {value} teken.',
    other: 'Blijf onder {value} tekens.',
  },
  'validation.passwordMismatch': 'Die wachtwoorden komen niet overeen.',
  'validation.nameShort':
    'Vul je naam in, zodat reisgenoten weten wie je bent.',
  'validation.nameTooLong': 'Die naam is te lang.',
  'validation.termsRequired': 'Ga akkoord met de voorwaarden om door te gaan.',
  'validation.codeLength': 'Codes uit de app hebben zes cijfers.',
  'validation.codeDigits': 'Codes uit de app bestaan alleen uit cijfers.',
  'validation.backupShort': 'Die herstelcode lijkt te kort.',
  'validation.backupLong': 'Die herstelcode lijkt te lang.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Welkom terug',
  'login.heading': 'Inloggen bij planned.travel',
  'login.description':
    'Pak je dagplannen, budgetten en lijsten precies weer op waar je ze liet liggen.',
  'login.newHere': 'Nieuw hier?',
  'login.createAccount': 'Een account aanmaken',
  'login.forgot': 'Wachtwoord vergeten?',
  'login.remember': 'Ingelogd blijven op dit apparaat',
  'login.submit': 'Inloggen',
  'login.submitting': 'Je wordt ingelogd',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Je account aanmaken',
  'register.heading': 'In een paar minuten aan het plannen',
  'register.description':
    'Eén account dekt elke reis, elke reisgenoot en elke lijst.',
  'register.haveAccount': 'Heb je al een account?',
  'register.signIn': 'Inloggen',
  'register.terms': 'Ik ga akkoord met de voorwaarden en de privacyverklaring.',
  'register.submit': 'Account aanmaken',
  'register.submitting': 'Je account wordt aangemaakt',

  'strength.hint': {
    one: 'Minstens {value} teken. Een korte zin verslaat een slim woord.',
    other: 'Minstens {value} tekens. Een korte zin verslaat een slim woord.',
  },
  'strength.tooShort': 'Sterkte: te kort',
  'strength.weak': 'Sterkte: zwak',
  'strength.fair': 'Sterkte: redelijk',
  'strength.strong': 'Sterkte: sterk',
  'strength.excellent': 'Sterkte: uitstekend',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Hulp bij je wachtwoord',
  'forgot.heading': 'Je wachtwoord opnieuw instellen',
  'forgot.description':
    'Geef het adres van je account, dan mailen we je een link om een nieuw wachtwoord te kiezen.',
  'forgot.submit': 'Mail me een link',
  'forgot.submitting': 'Je link wordt verstuurd',
  'forgot.back': 'Terug naar inloggen',
  'forgot.sent.eyebrow': 'Kijk in je postvak',
  'forgot.sent.heading': 'Je link is onderweg',
  'forgot.sent.description':
    'Als een account {email} gebruikt, ligt er nu een link in dat postvak om een nieuw wachtwoord te kiezen.',
  'forgot.sent.title': 'De link werkt één keer, één uur lang',
  'forgot.sent.body':
    'Niets binnengekomen? Kijk in de spam en stuur hem daarna opnieuw. Een nieuwe link zet de vorige stilletjes buiten werking.',
  'forgot.sent.resend': 'Stuur hem opnieuw',
  'forgot.sent.resending': 'Wordt opnieuw verstuurd',
  'forgot.sent.change': 'Een ander e-mailadres gebruiken',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Wachtwoord opnieuw instellen',
  'reset.heading': 'Kies een nieuw wachtwoord',
  'reset.description': {
    one: 'Neem iets van minstens {value} teken. Een korte zin is makkelijker te onthouden en moeilijker te raden.',
    other:
      'Neem iets van minstens {value} tekens. Een korte zin is makkelijker te onthouden en moeilijker te raden.',
  },
  'reset.submit': 'Nieuw wachtwoord instellen',
  'reset.submitting': 'Je wachtwoord wordt opgeslagen',
  'reset.back': 'Terug naar inloggen',
  'reset.stale.heading': 'Deze link is niet bruikbaar',
  'reset.stale.description':
    'Links verlopen na een uur en werken maar één keer — de veiligste ruil die er is.',
  'reset.stale.action': 'Vraag een nieuwe link aan',
  'reset.done.heading': 'Je nieuwe wachtwoord staat klaar',
  'reset.done.description':
    'Alle andere sessies zijn uitgelogd, dus wie het oude wachtwoord had komt er niet meer in.',
  'reset.done.title': 'Overal elders uitgelogd',
  'reset.done.body': 'Log in met je nieuwe wachtwoord en plan rustig verder.',
  'reset.done.action': 'Inloggen',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Verificatie in twee stappen',
  'twoFactor.heading': 'Bevestig dat jij het bent',
  'twoFactor.description':
    'Je account is beschermd met een tweede stap. Vul de huidige code uit je verificatie-app in.',
  'twoFactor.back': 'Opnieuw beginnen bij inloggen',
  'twoFactor.methods': 'Manier van verifiëren',
  'twoFactor.totp.tab': 'Verificatie-app',
  'twoFactor.totp.label': 'Code van zes cijfers',
  'twoFactor.totp.hint': 'De codes wisselen elke 30 seconden.',
  'twoFactor.totp.submit': 'Bevestigen en doorgaan',
  'twoFactor.backup.tab': 'Herstelcode',
  'twoFactor.backup.label': 'Herstelcode',
  'twoFactor.backup.hint':
    'Uit de lijst die je bewaarde toen je de tweede stap aanzette. Elke code werkt één keer.',
  'twoFactor.backup.submit': 'Herstelcode gebruiken',
  'twoFactor.submitting': 'Je code wordt gecontroleerd',
  'twoFactor.trust.label': 'Dit apparaat 30 dagen vertrouwen',
  'twoFactor.trust.detail':
    'Tot dan sla je deze stap over in deze browser. Doe dit alleen op een apparaat dat alleen van jou is.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'E-mail bevestigd',
  'verify.done.heading': 'Je bent er helemaal klaar voor',
  'verify.done.description':
    'Je adres is bevestigd, dus uitnodigingen, herinneringen en reisoverzichten bereiken je.',
  'verify.done.title': 'Bevestigd',
  'verify.done.body': '{email} is bevestigd op dit account.',
  'verify.done.bodyUnknown': 'Je e-mailadres is bevestigd op dit account.',
  'verify.done.action': 'Naar je overzicht',

  'verify.pending.eyebrow': 'Nog één ding',
  'verify.pending.heading': 'Bevestig je e-mailadres',
  'verify.pending.description':
    'We hebben een bevestigingslink naar {email} gestuurd. Die openen houdt je account herstelbaar en laat reisgenoten je uitnodigen.',
  'verify.pending.wrongAddress': 'Verkeerd adres?',
  'verify.pending.changeIt': 'Pas het aan in de instellingen',
  'verify.pending.title': 'De link is 24 uur geldig',
  'verify.pending.body':
    'Niets in je postvak? Kijk in de spam en stuur hem daarna opnieuw.',
  'verify.pending.resentTitle': 'Zojuist opnieuw verstuurd',
  'verify.pending.resentBody':
    'Geef het een minuut en kijk dan in je postvak — en in de map met spam.',
  'verify.pending.resend': 'Bevestiging opnieuw sturen',
  'verify.pending.resending': 'Wordt opnieuw verstuurd',
  'verify.pending.continue': 'Toch doorgaan',

  'verify.request.eyebrow': 'Bevestiging van je e-mail',
  'verify.request.heading': 'Een nieuwe bevestigingslink sturen',
  'verify.request.description':
    'Bevestigingslinks zijn 24 uur geldig en werken maar één keer. Geef je adres, dan is er een verse onderweg.',
  'verify.request.submit': 'Bevestigingslink sturen',
  'verify.request.submitting': 'Je link wordt verstuurd',
  'verify.request.sentTitle': 'Onderweg',
  'verify.request.sentBody':
    'Als er bij dat adres een account op bevestiging wacht, ligt de link nu in dat postvak.',
  'verify.request.change': 'Een ander e-mailadres gebruiken',
  'verify.request.back': 'Terug naar inloggen',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Uitnodiging voor een werkruimte',
  'invitation.heading': 'Meedoen met {workspace}',
  'invitation.description':
    'Accepteren voegt je toe aan deze werkruimte en deelt de reizen, budgetten en lijsten met je.',
  'invitation.invitedAs': 'Uitgenodigd als {email}',
  'invitation.role': 'Jouw rol',
  'invitation.means': 'Betekent',
  'invitation.invitedBy': 'Uitgenodigd door',
  'invitation.expires': 'Verloopt',
  'invitation.accept': 'Uitnodiging accepteren',
  'invitation.accepting': 'Je wordt lid van de werkruimte',
  'invitation.decline': 'Weigeren',
  'invitation.declining': 'Wordt geweigerd',
  'invitation.reassurance':
    'Je kunt een werkruimte op elk moment verlaten via de instellingen, en niets wat je daarbuiten maakt wordt ooit gedeeld.',

  'invitation.role.owner':
    'Eigenaar — volledige zeggenschap, ook over de facturen',
  'invitation.role.admin': 'Beheerder — beheert reizen, leden en instellingen',
  'invitation.role.member': 'Lid — plant reizen samen met alle anderen',
  'invitation.role.other':
    '{role} — toegang zoals de eigenaar die heeft ingesteld',
  'invitation.role.badge.owner': 'Eigenaar',
  'invitation.role.badge.admin': 'Beheerder',
  'invitation.role.badge.member': 'Lid',

  'invitation.anonymous.heading': 'Log in om je uitnodiging te zien',
  'invitation.anonymous.description':
    'Uitnodigingen horen bij het adres waarnaar ze zijn gestuurd, dus we moeten weten wie je bent voordat we deze kunnen tonen.',
  'invitation.anonymous.body':
    'Gebruik het adres waarnaar de uitnodiging ging. Daarna brengen we je meteen hierheen terug.',
  'invitation.anonymous.action': 'Inloggen om door te gaan',
  'invitation.anonymous.noAccount': 'Nog geen account?',
  'invitation.anonymous.register': 'Maak er een met het uitgenodigde adres',

  'invitation.mismatch.heading': 'Deze uitnodiging is voor een ander adres',
  'invitation.mismatch.description':
    'Je bent als iemand anders ingelogd, dus deze is niet van jou om te accepteren.',
  'invitation.mismatch.title': 'Ingelogd als {email}',
  'invitation.mismatch.body':
    'Log uit en weer in met het adres waarnaar de uitnodiging ging, of vraag om een nieuwe uitnodiging voor dit account.',
  'invitation.mismatch.action': 'Van account wisselen',
  'invitation.mismatch.back': 'Terug naar inloggen',

  'invitation.unverified.heading': 'Bevestig je e-mail om mee te doen',
  'invitation.unverified.description':
    'Werkruimtes nemen alleen bevestigde adressen op, zodat niemand er door een typefout in belandt.',
  'invitation.unverified.title': '{email} is nog niet bevestigd',
  'invitation.unverified.body':
    'Open de bevestigingslink in je postvak en kom dan terug naar deze pagina. De uitnodiging blijft wachten.',
  'invitation.unverified.action': 'Mijn e-mail bevestigen',
  'invitation.unverified.resend': 'Bevestigingsmail opnieuw sturen',

  'invitation.unavailable.heading': 'Deze uitnodiging bestaat niet meer',
  'invitation.unavailable.description':
    'Uitnodigingen zijn zeven dagen geldig en vervallen zodra ze gebruikt of ingetrokken worden.',
  'invitation.unavailable.title': 'Hier valt niets te accepteren',
  'invitation.unavailable.body':
    'Vraag degene die je uitnodigde om een verse uitnodiging, dan toont deze pagina hem meteen.',
  'invitation.unavailable.dashboard': 'Naar je overzicht',

  'invitation.declined.eyebrow': 'Uitnodiging geweigerd',
  'invitation.declined.heading': 'Geen probleem — er is niets gedeeld',
  'invitation.declined.description':
    'De eigenaar van de werkruimte heeft bericht gekregen en deze link is niet meer bruikbaar.',
  'invitation.declined.action': 'Naar je overzicht',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Er ging iets mis',
  'error.unexpected.detail': 'Dat werkte niet. Probeer het zo meteen nog eens.',
  'error.rateLimited.title': 'Te veel pogingen',
  'error.rateLimited.detail':
    'Voor je veiligheid hebben we het inloggen vanaf dit apparaat een paar minuten stilgelegd. Probeer het zo weer.',
  'error.offline.title': 'Geen verbinding',
  'error.offline.detail':
    'We konden planned.travel niet bereiken. Controleer je verbinding en probeer het opnieuw.',

  'error.credentials.title': 'Deze gegevens horen niet bij elkaar',
  'error.credentials.detail':
    'Controleer het e-mailadres en het wachtwoord en probeer het opnieuw. Meldde je je aan met Google of Apple, gebruik dan die knop.',
  'error.password.title': 'Deze gegevens horen niet bij elkaar',
  'error.password.detail':
    'Controleer het e-mailadres en het wachtwoord en probeer het opnieuw.',
  'error.noPassword.title': 'Geen wachtwoord op dit account',
  'error.noPassword.detail':
    'Dit account logt in via een aanbieder of een toegangssleutel. Gebruik een van de opties hierboven.',
  'error.unverified.title': 'Bevestig eerst je e-mail',
  'error.unverified.detail':
    'We stuurden je bij het aanmelden een bevestigingslink. Open die en kom dan hier terug.',
  'error.emailTaken.title': 'Dat e-mailadres is al geregistreerd',
  'error.emailTaken.detail':
    'Log in plaats daarvan in, of stel je wachtwoord opnieuw in als je het vergeten bent.',
  'error.noAccount.title': 'Dat account konden we niet vinden',
  'error.noAccount.detail':
    'Controleer het adres, of maak een nieuw account aan.',
  'error.passwordTooShort.title': 'Wachtwoord te kort',
  'error.passwordTooShort.detail':
    'Kies een langere zin en probeer het opnieuw.',
  'error.passwordTooLong.title': 'Wachtwoord te lang',
  'error.passwordTooLong.detail':
    'Kies een kortere zin en probeer het opnieuw.',
  'error.linkSpent.title': 'Deze link is niet meer geldig',
  'error.linkSpent.detail':
    'Wachtwoordlinks werken maar één keer. Vraag een verse aan, dan mailen we hem meteen.',
  'error.linkExpired.title': 'Deze link is verlopen',
  'error.linkExpired.detail': 'Vraag een nieuwe aan, dan mailen we hem meteen.',
  'error.linkIncomplete.title': 'Deze link is onvolledig',
  'error.linkIncomplete.detail':
    'Wachtwoordlinks dragen een eenmalig kenmerk. Open de nieuwste mail, of vraag een verse link aan.',
  'error.sessionExpired.title': 'Je sessie is verlopen',
  'error.sessionExpired.detail':
    'Log opnieuw in en ga verder waar je gebleven was.',
  'error.alreadyVerified.title': 'Al bevestigd',
  'error.alreadyVerified.detail':
    'Dit e-mailadres is bevestigd. Je kunt gewoon inloggen.',
  'error.badCode.title': 'Die code werkte niet',
  'error.badCode.detail':
    'Codes uit de app zijn 30 seconden geldig. Wacht op de volgende en vul alle zes de cijfers in.',
  'error.badBackupCode.title': 'Die herstelcode werkte niet',
  'error.badBackupCode.detail':
    'Elke herstelcode werkt één keer. Probeer de volgende ongebruikte code uit je lijst.',
  'error.locked.title': 'Account tijdelijk op slot',
  'error.locked.detail':
    'Te veel mislukte pogingen. Voor je veiligheid staat dit account een paar minuten op slot.',
  'error.twoFactorOn.title': 'Tweestapsverificatie staat al aan',
  'error.twoFactorOn.detail':
    'Opnieuw instellen zou ervoor zorgen dat je huidige authenticator niet meer werkt. Daarom is er niets gewijzigd. Je kunt deze hier beheren.',
  'error.noTwoFactor.title': 'De tweede stap staat niet ingesteld',
  'error.noTwoFactor.detail':
    'Log in met je e-mailadres en wachtwoord om door te gaan.',
  'error.twoFactorExpired.title': 'Begin opnieuw bij het inloggen',
  'error.twoFactorExpired.detail':
    'Deze stap is verlopen. Vul je e-mailadres en wachtwoord nog een keer in.',
  'error.invitationGone.title': 'Deze uitnodiging bestaat niet meer',
  'error.invitationGone.detail':
    'Hij is misschien verlopen, ingetrokken of al gebruikt. Vraag om een verse uitnodiging.',
  'error.invitationOther.title': 'Deze uitnodiging is voor iemand anders',
  'error.invitationOther.detail':
    'Hij ging naar een ander e-mailadres. Log met dat adres in om hem te accepteren.',
  'error.alreadyMember.title': 'Je zit al in deze werkruimte',
  'error.alreadyMember.detail':
    'Er valt niets te accepteren — open hem via de wisselaar.',
  'error.workspaceFull.title': 'Deze werkruimte is vol',
  'error.workspaceFull.detail':
    'Het ledenmaximum is bereikt. Vraag een eigenaar om een plaats vrij te maken of het abonnement op te waarderen.',
  'error.verifyBeforeJoin.title': 'Bevestig eerst je e-mail',
  'error.verifyBeforeJoin.detail':
    'Open de bevestigingslink die we je mailden en kom dan terug naar deze uitnodiging.',

  'passkeyNotice.added': 'Er is een passkey aan je account toegevoegd',
  'passkeyNotice.removed': 'Er is een passkey uit je account verwijderd',
  'passkeyNotice.security': 'Beveiliging',
  'passkeyNotice.action': 'Passkeys beheren',
  'passkeyNotice.recovery':
    'Herken je deze wijziging niet, wijzig dan je wachtwoord en beëindig onbekende sessies. Een wachtwoordreset verwijdert geen passkeys. Controleer je passkeys en verwijder degene die je niet herkent.',
  'error.passwordAttemptsLocked.title': 'Wachtwoordbevestiging geblokkeerd',
  'error.passwordAttemptsLocked.detail':
    'Deze sessie kan je wachtwoord niet meer bevestigen. Log uit en log opnieuw in.',
  'error.passwordResultUnknown.title': 'Controleer je beveiligingsinstellingen',
  'error.passwordResultUnknown.detail':
    'De wijziging is mogelijk opgeslagen. Houd deze sessie open totdat je opnieuw kunt inloggen. Heb je je wachtwoord gewijzigd, probeer dan het nieuwe. Heb je back-upcodes vervangen, dan werkt de oude set mogelijk niet meer; gebruik je authenticator of een andere ingelogde sessie om een nieuwe set te maken.',
} satisfies TranslationOf<typeof En>

export default messages
