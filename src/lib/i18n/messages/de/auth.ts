/**
 * Everything the authentication screens say, in German.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Why the register matters most here.** These are the only screens a
 * traveller reaches with no session, so the language comes purely from
 * `Accept-Language` and there is no stored preference to correct a bad guess
 * with. They say „du" like the rest of the German catalogue: an account that
 * greets you with „Sie" and then plans your holiday with „du" reads as two
 * products.
 *
 * **Plural.** `Intl.PluralRules('de')` reports `one` and `other`. German
 * „Zeichen" and „Tag" behave differently under a count — the first is invariant
 * and the second is not — so the character-count messages carry the same
 * sentence in both branches on purpose, while the day-count ones do not.
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
  'shell.home': 'planned.travel Startseite',
  'shell.legal':
    'Wenn du fortfährst, stimmst du den Nutzungsbedingungen und dem Datenschutzhinweis von planned.travel zu.',

  'panel.eyebrow': 'Gemeinsam planen',
  'panel.heading':
    'Jede Reise, von der ersten Nadel bis zur letzten Postkarte.',
  'panel.body':
    'Gemeinsame Abläufe auf einer echten Karte, Budgets, die wirklich aufgehen, Packlisten mit Gedächtnis und ein Tagebuch, das man behält.',
  'panel.map.title': 'Eine Karte, ein Ablauf',
  'panel.map.detail':
    'Jeder Halt, jede Unterkunft und jeder Transfer in einem Ablauf.',
  'panel.group.title': 'Alle im Gleichschritt',
  'panel.group.detail':
    'Änderungen, Stimmen und Kommentare kommen live bei der ganzen Gruppe an.',
  'panel.costs.title': 'Kosten, die aufgehen',
  'panel.costs.detail':
    'Gemeinsame Budgets, ausgeglichene Beträge, keine Tabelle.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'oder',
  'divider.orEmail': 'oder nimm deine E-Mail',

  'social.continue': 'Weiter mit {provider}',
  'social.signUp': 'Mit {provider} registrieren',
  'social.opening': '{provider} wird geöffnet',

  'passkey.action': 'Mit Zugangsschlüssel anmelden',
  'passkey.waiting': 'Warten auf dein Gerät',

  'password.show': 'Passwort zeigen',
  'password.hide': 'Passwort verbergen',
  'password.showNew': 'Neues Passwort zeigen',
  'password.hideNew': 'Neues Passwort verbergen',
  'password.showConfirm': 'Passwortbestätigung zeigen',
  'password.hideConfirm': 'Passwortbestätigung verbergen',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'E-Mail-Adresse',
  'field.email.placeholder': 'du@example.com',
  'field.password': 'Passwort',
  'field.password.placeholder': 'Dein Passwort',
  'field.newPassword': 'Neues Passwort',
  'field.newPassword.placeholder': 'Ein Satz, den du dir merkst',
  'field.confirmPassword': 'Passwort bestätigen',
  'field.confirmNewPassword': 'Neues Passwort bestätigen',
  'field.confirmPassword.placeholder': 'Noch einmal tippen',
  'field.name': 'Dein Name',
  'field.name.hint': 'Sichtbar für alle, mit denen du Reisen planst.',
  'field.name.placeholder': 'Lena Brandt',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Gib deine E-Mail-Adresse ein.',
  'validation.emailTooLong': 'Diese E-Mail-Adresse ist zu lang.',
  'validation.emailInvalid': 'Das sieht nicht nach einer E-Mail-Adresse aus.',
  'validation.passwordRequired': 'Gib dein Passwort ein.',
  'validation.passwordShort': {
    one: 'Nimm mindestens {value} Zeichen — ein kurzer Satz schlägt ein kluges Wort.',
    other:
      'Nimm mindestens {value} Zeichen — ein kurzer Satz schlägt ein kluges Wort.',
  },
  'validation.passwordLong': {
    one: 'Bleib unter {value} Zeichen.',
    other: 'Bleib unter {value} Zeichen.',
  },
  'validation.passwordMismatch': 'Diese Passwörter stimmen nicht überein.',
  'validation.nameShort':
    'Gib deinen Namen ein, damit Mitreisende wissen, wer du bist.',
  'validation.nameTooLong': 'Dieser Name ist zu lang.',
  'validation.termsRequired':
    'Bitte akzeptiere die Bedingungen, um weiterzugehen.',
  'validation.codeLength': 'Authenticator-Codes haben sechs Ziffern.',
  'validation.codeDigits': 'Authenticator-Codes bestehen nur aus Ziffern.',
  'validation.backupShort': 'Dieser Notfallcode wirkt zu kurz.',
  'validation.backupLong': 'Dieser Notfallcode wirkt zu lang.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Willkommen zurück',
  'login.heading': 'Bei planned.travel anmelden',
  'login.description':
    'Nimm Abläufe, Budgets und Listen genau dort wieder auf, wo du sie liegen gelassen hast.',
  'login.newHere': 'Neu hier?',
  'login.createAccount': 'Konto anlegen',
  'login.forgot': 'Passwort vergessen?',
  'login.remember': 'Auf diesem Gerät angemeldet bleiben',
  'login.submit': 'Anmelden',
  'login.submitting': 'Du wirst angemeldet',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Dein Konto anlegen',
  'register.heading': 'In ein paar Minuten losplanen',
  'register.description':
    'Ein Konto deckt jede Reise, jede Begleitung und jede Liste ab.',
  'register.haveAccount': 'Schon ein Konto?',
  'register.signIn': 'Anmelden',
  'register.terms':
    'Ich stimme den Nutzungsbedingungen und dem Datenschutzhinweis zu.',
  'register.submit': 'Konto anlegen',
  'register.submitting': 'Dein Konto wird angelegt',

  'strength.hint': {
    one: 'Mindestens {value} Zeichen. Ein kurzer Satz schlägt ein kluges Wort.',
    other:
      'Mindestens {value} Zeichen. Ein kurzer Satz schlägt ein kluges Wort.',
  },
  'strength.tooShort': 'Stärke: zu kurz',
  'strength.weak': 'Stärke: schwach',
  'strength.fair': 'Stärke: brauchbar',
  'strength.strong': 'Stärke: stark',
  'strength.excellent': 'Stärke: hervorragend',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Hilfe zum Passwort',
  'forgot.heading': 'Passwort zurücksetzen',
  'forgot.description':
    'Nenn uns die Adresse deines Kontos, dann schicken wir dir einen Link für ein neues Passwort.',
  'forgot.submit': 'Schick mir einen Link',
  'forgot.submitting': 'Dein Link wird verschickt',
  'forgot.back': 'Zurück zur Anmeldung',
  'forgot.sent.eyebrow': 'Schau in dein Postfach',
  'forgot.sent.heading': 'Dein Link ist unterwegs',
  'forgot.sent.description':
    'Falls ein Konto {email} nutzt, liegt jetzt ein Link für ein neues Passwort in diesem Postfach.',
  'forgot.sent.title': 'Der Link gilt einmal, für eine Stunde',
  'forgot.sent.body':
    'Nichts angekommen? Sieh im Spam nach und schick ihn dann noch einmal. Ein neuer Link setzt den vorherigen still außer Kraft.',
  'forgot.sent.resend': 'Noch einmal schicken',
  'forgot.sent.resending': 'Wird noch einmal verschickt',
  'forgot.sent.change': 'Andere E-Mail nutzen',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Passwort zurücksetzen',
  'reset.heading': 'Wähle ein neues Passwort',
  'reset.description': {
    one: 'Nimm etwas mit mindestens {value} Zeichen. Ein kurzer Satz ist leichter zu merken und schwerer zu raten.',
    other:
      'Nimm etwas mit mindestens {value} Zeichen. Ein kurzer Satz ist leichter zu merken und schwerer zu raten.',
  },
  'reset.submit': 'Neues Passwort setzen',
  'reset.submitting': 'Dein Passwort wird gespeichert',
  'reset.back': 'Zurück zur Anmeldung',
  'reset.stale.heading': 'Dieser Link lässt sich nicht nutzen',
  'reset.stale.description':
    'Links zum Zurücksetzen verfallen nach einer Stunde und gelten nur einmal — der sicherste mögliche Handel.',
  'reset.stale.action': 'Neuen Link anfordern',
  'reset.done.heading': 'Dein neues Passwort steht',
  'reset.done.description':
    'Alle anderen Sitzungen wurden abgemeldet, damit niemand mit dem alten Passwort noch hineinkommt.',
  'reset.done.title': 'Überall sonst abgemeldet',
  'reset.done.body': 'Melde dich mit dem neuen Passwort an und plane weiter.',
  'reset.done.action': 'Anmelden',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Bestätigung in zwei Schritten',
  'twoFactor.heading': 'Bestätige, dass du es bist',
  'twoFactor.description':
    'Dein Konto ist durch einen zweiten Faktor geschützt. Gib den aktuellen Code aus deiner Authenticator-App ein.',
  'twoFactor.back': 'Noch einmal bei der Anmeldung beginnen',
  'twoFactor.methods': 'Art der Bestätigung',
  'twoFactor.totp.tab': 'App-Code',
  'twoFactor.totp.label': 'Sechsstelliger Code',
  'twoFactor.totp.hint': 'Die Codes wechseln alle 30 Sekunden.',
  'twoFactor.totp.submit': 'Bestätigen und weiter',
  'twoFactor.backup.tab': 'Notfallcode',
  'twoFactor.backup.label': 'Notfallcode',
  'twoFactor.backup.hint':
    'Aus der Liste, die du beim Einschalten von Zwei-Faktor gespeichert hast. Jeder Code gilt einmal.',
  'twoFactor.backup.submit': 'Notfallcode nutzen',
  'twoFactor.submitting': 'Dein Code wird geprüft',
  'twoFactor.trust.label': 'Diesem Gerät 30 Tage vertrauen',
  'twoFactor.trust.detail':
    'Bis dahin entfällt dieser Schritt in diesem Browser. Mach das nur auf einem Gerät, das dir allein gehört.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'E-Mail bestätigt',
  'verify.done.heading': 'Alles bereit',
  'verify.done.description':
    'Deine Adresse ist bestätigt, damit Einladungen, Erinnerungen und Reiseberichte dich erreichen.',
  'verify.done.title': 'Bestätigt',
  'verify.done.body': '{email} ist für dieses Konto bestätigt.',
  'verify.done.bodyUnknown':
    'Deine E-Mail-Adresse ist für dieses Konto bestätigt.',
  'verify.done.action': 'Zu deiner Übersicht',

  'verify.pending.eyebrow': 'Nur noch eins',
  'verify.pending.heading': 'Bestätige deine E-Mail-Adresse',
  'verify.pending.description':
    'Wir haben einen Bestätigungslink an {email} geschickt. Ihn zu öffnen hält dein Konto wiederherstellbar und erlaubt Mitreisenden, dich einzuladen.',
  'verify.pending.wrongAddress': 'Falsche Adresse?',
  'verify.pending.changeIt': 'In den Einstellungen ändern',
  'verify.pending.title': 'Der Link gilt 24 Stunden',
  'verify.pending.body':
    'Nichts im Postfach? Sieh im Spam nach und schick ihn dann noch einmal.',
  'verify.pending.resentTitle': 'Gerade noch einmal verschickt',
  'verify.pending.resentBody':
    'Gib ihm eine Minute und sieh dann im Postfach nach — und im Spam-Ordner.',
  'verify.pending.resend': 'Bestätigung erneut schicken',
  'verify.pending.resending': 'Wird noch einmal verschickt',
  'verify.pending.continue': 'Trotzdem weiter',

  'verify.request.eyebrow': 'Bestätigung der E-Mail',
  'verify.request.heading': 'Neuen Bestätigungslink schicken',
  'verify.request.description':
    'Bestätigungslinks gelten 24 Stunden und nur einmal. Nenn uns deine Adresse, dann ist ein frischer unterwegs.',
  'verify.request.submit': 'Bestätigungslink schicken',
  'verify.request.submitting': 'Dein Link wird verschickt',
  'verify.request.sentTitle': 'Unterwegs',
  'verify.request.sentBody':
    'Wenn zu dieser Adresse ein Konto auf Bestätigung wartet, liegt der Link jetzt in ihrem Postfach.',
  'verify.request.change': 'Andere E-Mail nutzen',
  'verify.request.back': 'Zurück zur Anmeldung',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Einladung in einen Arbeitsbereich',
  'invitation.heading': '{workspace} beitreten',
  'invitation.description':
    'Mit dem Annehmen kommst du in diesen Arbeitsbereich und siehst seine Reisen, Budgets und Listen.',
  'invitation.invitedAs': 'Eingeladen als {email}',
  'invitation.role': 'Deine Rolle',
  'invitation.means': 'Bedeutet',
  'invitation.invitedBy': 'Eingeladen von',
  'invitation.expires': 'Läuft ab',
  'invitation.accept': 'Einladung annehmen',
  'invitation.accepting': 'Du trittst dem Arbeitsbereich bei',
  'invitation.decline': 'Ablehnen',
  'invitation.declining': 'Wird abgelehnt',
  'invitation.reassurance':
    'Du kannst einen Arbeitsbereich jederzeit über seine Einstellungen verlassen, und nichts, was du außerhalb anlegst, wird je geteilt.',

  'invitation.role.owner': 'Inhaber — volle Kontrolle, samt Abrechnung',
  'invitation.role.admin':
    'Administrator — verwaltet Reisen, Mitglieder und Einstellungen',
  'invitation.role.member':
    'Mitglied — plant Reisen mit allen anderen zusammen',
  'invitation.role.other':
    '{role} — Zugriff, wie ihn der Inhaber festgelegt hat',
  'invitation.role.badge.owner': 'Inhaber',
  'invitation.role.badge.admin': 'Administrator',
  'invitation.role.badge.member': 'Mitglied',

  'invitation.anonymous.heading': 'Melde dich an, um deine Einladung zu sehen',
  'invitation.anonymous.description':
    'Einladungen hängen an der Adresse, an die sie geschickt wurden, also müssen wir wissen, wer du bist, bevor wir dir diese hier zeigen.',
  'invitation.anonymous.body':
    'Nimm die Adresse, an die die Einladung ging. Danach bringen wir dich direkt hierher zurück.',
  'invitation.anonymous.action': 'Zum Weitermachen anmelden',
  'invitation.anonymous.noAccount': 'Noch kein Konto?',
  'invitation.anonymous.register': 'Eins mit der eingeladenen Adresse anlegen',

  'invitation.mismatch.heading': 'Diese Einladung gilt einer anderen Adresse',
  'invitation.mismatch.description':
    'Du bist als jemand anderes angemeldet, also ist diese hier nicht deine.',
  'invitation.mismatch.title': 'Angemeldet als {email}',
  'invitation.mismatch.body':
    'Melde dich ab und mit der eingeladenen Adresse wieder an, oder bitte um eine neue Einladung für dieses Konto.',
  'invitation.mismatch.action': 'Konto wechseln',
  'invitation.mismatch.back': 'Zurück zur Anmeldung',

  'invitation.unverified.heading': 'Bestätige deine E-Mail, um beizutreten',
  'invitation.unverified.description':
    'Arbeitsbereiche nehmen nur bestätigte Adressen auf, damit niemand durch einen Tippfehler hineingerät.',
  'invitation.unverified.title': '{email} ist noch nicht bestätigt',
  'invitation.unverified.body':
    'Öffne den Bestätigungslink in deinem Postfach und komm dann auf diese Seite zurück. Die Einladung wartet.',
  'invitation.unverified.action': 'Meine E-Mail bestätigen',
  'invitation.unverified.resend': 'Bestätigungsmail erneut schicken',

  'invitation.unavailable.heading': 'Diese Einladung gibt es nicht mehr',
  'invitation.unavailable.description':
    'Einladungen gelten sieben Tage und erlöschen, sobald sie genutzt oder zurückgezogen werden.',
  'invitation.unavailable.title': 'Hier gibt es nichts anzunehmen',
  'invitation.unavailable.body':
    'Bitte die Person, die dich eingeladen hat, um eine frische Einladung, dann zeigt diese Seite sie sofort.',
  'invitation.unavailable.dashboard': 'Zu deiner Übersicht',

  'invitation.declined.eyebrow': 'Einladung abgelehnt',
  'invitation.declined.heading': 'Kein Problem — geteilt wurde nichts',
  'invitation.declined.description':
    'Der Inhaber des Arbeitsbereichs ist informiert, und dieser Link lässt sich nicht mehr nutzen.',
  'invitation.declined.action': 'Zu deiner Übersicht',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Da ist etwas schiefgegangen',
  'error.unexpected.detail':
    'Das hat nicht geklappt. Versuch es gleich noch einmal.',
  'error.rateLimited.title': 'Zu viele Versuche',
  'error.rateLimited.detail':
    'Zu deiner Sicherheit haben wir die Anmeldung von diesem Gerät für ein paar Minuten angehalten. Versuch es in Kürze noch einmal.',
  'error.offline.title': 'Keine Verbindung',
  'error.offline.detail':
    'Wir konnten planned.travel nicht erreichen. Prüfe deine Verbindung und versuche es noch einmal.',

  'error.credentials.title': 'Diese Angaben passen nicht zusammen',
  'error.credentials.detail':
    'Prüfe E-Mail-Adresse und Passwort und versuch es noch einmal. Wenn du dich mit Google oder Apple registriert hast, nimm stattdessen diese Schaltfläche.',
  'error.password.title': 'Diese Angaben passen nicht zusammen',
  'error.password.detail':
    'Prüfe E-Mail-Adresse und Passwort und versuch es noch einmal.',
  'error.noPassword.title': 'Kein Passwort für dieses Konto',
  'error.noPassword.detail':
    'Dieses Konto meldet sich über einen Anbieter oder einen Zugangsschlüssel an. Nimm eine der Möglichkeiten oben.',
  'error.unverified.title': 'Bestätige zuerst deine E-Mail',
  'error.unverified.detail':
    'Wir haben dir bei der Registrierung einen Bestätigungslink geschickt. Öffne ihn und komm dann hierher zurück.',
  'error.emailTaken.title': 'Diese E-Mail ist schon registriert',
  'error.emailTaken.detail':
    'Melde dich stattdessen an, oder setz dein Passwort zurück, wenn du es vergessen hast.',
  'error.noAccount.title': 'Dieses Konto konnten wir nicht finden',
  'error.noAccount.detail': 'Prüfe die Adresse, oder leg ein neues Konto an.',
  'error.passwordTooShort.title': 'Passwort zu kurz',
  'error.passwordTooShort.detail':
    'Wähle einen längeren Satz und versuch es noch einmal.',
  'error.passwordTooLong.title': 'Passwort zu lang',
  'error.passwordTooLong.detail':
    'Wähle einen kürzeren Satz und versuch es noch einmal.',
  'error.linkSpent.title': 'Dieser Link gilt nicht mehr',
  'error.linkSpent.detail':
    'Passwortlinks lassen sich nur einmal nutzen. Fordere einen frischen an, dann schicken wir ihn sofort per E-Mail.',
  'error.linkExpired.title': 'Dieser Link ist abgelaufen',
  'error.linkExpired.detail':
    'Fordere einen neuen an, dann schicken wir ihn sofort per E-Mail.',
  'error.linkIncomplete.title': 'Dieser Link ist unvollständig',
  'error.linkIncomplete.detail':
    'Links zum Zurücksetzen tragen ein einmaliges Kürzel. Öffne die neueste E-Mail, oder fordere einen frischen Link an.',
  'error.sessionExpired.title': 'Deine Sitzung ist abgelaufen',
  'error.sessionExpired.detail':
    'Melde dich noch einmal an und mach dort weiter, wo du aufgehört hast.',
  'error.alreadyVerified.title': 'Schon bestätigt',
  'error.alreadyVerified.detail':
    'Diese E-Mail-Adresse ist bestätigt. Du kannst dich ganz normal anmelden.',
  'error.badCode.title': 'Dieser Code hat nicht funktioniert',
  'error.badCode.detail':
    'Authenticator-Codes gelten 30 Sekunden. Warte auf den nächsten und gib alle sechs Ziffern ein.',
  'error.badBackupCode.title': 'Dieser Notfallcode hat nicht funktioniert',
  'error.badBackupCode.detail':
    'Jeder Notfallcode gilt einmal. Nimm den nächsten ungenutzten aus deiner Liste.',
  'error.locked.title': 'Konto vorübergehend gesperrt',
  'error.locked.detail':
    'Zu viele fehlgeschlagene Versuche. Zu deiner Sicherheit ist dieses Konto für ein paar Minuten gesperrt.',
  'error.twoFactorOn.title':
    'Die Zwei-Faktor-Authentifizierung ist bereits aktiv',
  'error.twoFactorOn.detail':
    'Eine erneute Einrichtung würde deine aktuelle Authenticator-App unbrauchbar machen. Deshalb wurde nichts geändert. Du kannst sie hier verwalten.',
  'error.noTwoFactor.title': 'Zwei-Faktor ist nicht eingerichtet',
  'error.noTwoFactor.detail':
    'Melde dich mit E-Mail und Passwort an, um weiterzumachen.',
  'error.twoFactorExpired.title': 'Beginn noch einmal bei der Anmeldung',
  'error.twoFactorExpired.detail':
    'Dieser Bestätigungsschritt ist abgelaufen. Gib E-Mail und Passwort noch einmal ein.',
  'error.invitationGone.title': 'Diese Einladung gibt es nicht mehr',
  'error.invitationGone.detail':
    'Sie ist womöglich abgelaufen, zurückgezogen oder schon genutzt worden. Bitte um eine frische Einladung.',
  'error.invitationOther.title': 'Diese Einladung gilt jemand anderem',
  'error.invitationOther.detail':
    'Sie ging an eine andere E-Mail-Adresse. Melde dich mit dieser Adresse an, um sie anzunehmen.',
  'error.alreadyMember.title': 'Du bist schon in diesem Arbeitsbereich',
  'error.alreadyMember.detail':
    'Es gibt nichts anzunehmen — öffne ihn über den Wechsler.',
  'error.workspaceFull.title': 'Dieser Arbeitsbereich ist voll',
  'error.workspaceFull.detail':
    'Er hat sein Mitgliederlimit erreicht. Bitte einen Inhaber, einen Platz frei zu machen oder den Tarif zu erhöhen.',
  'error.verifyBeforeJoin.title': 'Bestätige zuerst deine E-Mail',
  'error.verifyBeforeJoin.detail':
    'Öffne den Bestätigungslink, den wir dir geschickt haben, und komm dann zu dieser Einladung zurück.',

  'passkeyNotice.added': 'Ein Passkey wurde deinem Konto hinzugefügt',
  'passkeyNotice.removed': 'Ein Passkey wurde aus deinem Konto entfernt',
  'passkeyNotice.security': 'Sicherheit',
  'passkeyNotice.action': 'Passkeys verwalten',
  'passkeyNotice.recovery':
    'Wenn du diese Änderung nicht erkennst, ändere dein Passwort und beende unbekannte Sitzungen. Ein Zurücksetzen des Passworts entfernt keine Passkeys. Prüfe deine Passkeys und entferne unbekannte.',
  'error.passwordAttemptsLocked.title': 'Passwortbestätigung gesperrt',
  'error.passwordAttemptsLocked.detail':
    'Diese Sitzung kann dein Passwort nicht mehr bestätigen. Melde dich ab und erneut an.',
  'error.passwordResultUnknown.title': 'Prüfe deine Sicherheitseinstellungen',
  'error.passwordResultUnknown.detail':
    'Die Änderung wurde möglicherweise gespeichert. Halte diese Sitzung offen, bis du dich wieder anmelden kannst. Falls du dein Passwort geändert hast, versuche das neue. Falls du Backup-Codes ersetzt hast, funktioniert der alte Satz möglicherweise nicht mehr; nutze deine Authenticator-App oder eine andere angemeldete Sitzung, um neue Codes zu erstellen.',
} satisfies TranslationOf<typeof En>

export default messages
