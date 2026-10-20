/**
 * Everything the authentication screens say, in Polish.
 *
 * Authored from `../en/auth.ts` (`docs/SPEC.md` §8.9). These are the only
 * screens a traveller reaches with no session, so the language comes from
 * `Accept-Language` alone and two thirds of the keys are failures — the moment
 * a reader can least afford a sentence in a language they do not read.
 *
 * **Plural.** `pl` needs `one` · `few` · `many` · `other`, and `other` is a
 * fraction only. A character count is never fractional, so those branches
 * carry the genitive singular for form's sake rather than for a reader.
 *
 * **Gender.** Polish past participles agree with the person addressed, and we
 * do not know theirs. Nothing below says "zalogowałeś" or "zostawiłaś": the
 * copy is impersonal ("Zalogowano jako …") or present tense throughout.
 *
 * **The example address** keeps the reserved `example.com` domain and localises
 * only the local part, so the placeholder and `field.name.placeholder` read as
 * one person.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Strona główna planned.travel',
  'shell.legal':
    'Kontynuując, zgadzasz się na regulamin i informację o prywatności planned.travel.',

  'panel.eyebrow': 'Planujcie razem',
  'panel.heading':
    'Każda podróż — od pierwszej pinezki do ostatniej pocztówki.',
  'panel.body':
    'Wspólne plany na prawdziwej mapie, budżety, które się zgadzają, listy rzeczy, które pamiętają za Ciebie, i dziennik, który warto zachować.',
  'panel.map.title': 'Jedna mapa, jeden plan',
  'panel.map.detail': 'Każdy przystanek, nocleg i przejazd w jednym planie.',
  'panel.group.title': 'Wszyscy w jednym rytmie',
  'panel.group.detail':
    'Zmiany, głosy i komentarze docierają na żywo do całej grupy.',
  'panel.costs.title': 'Koszty, które się sumują',
  'panel.costs.detail': 'Wspólne budżety, rozliczone salda, żadnych arkuszy.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'lub',
  'divider.orEmail': 'albo użyj swojego e-maila',

  'social.continue': 'Kontynuuj z {provider}',
  'social.signUp': 'Zarejestruj się przez {provider}',
  'social.opening': 'Otwieranie {provider}',

  'passkey.action': 'Zaloguj się kluczem dostępu',
  'passkey.waiting': 'Czekamy na Twoje urządzenie',

  'password.show': 'Pokaż hasło',
  'password.hide': 'Ukryj hasło',
  'password.showNew': 'Pokaż nowe hasło',
  'password.hideNew': 'Ukryj nowe hasło',
  'password.showConfirm': 'Pokaż potwierdzenie hasła',
  'password.hideConfirm': 'Ukryj potwierdzenie hasła',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Adres e-mail',
  'field.email.placeholder': 'anna@example.com',
  'field.password': 'Hasło',
  'field.password.placeholder': 'Twoje hasło',
  'field.newPassword': 'Nowe hasło',
  'field.newPassword.placeholder': 'Fraza, którą zapamiętasz',
  'field.confirmPassword': 'Potwierdź hasło',
  'field.confirmNewPassword': 'Potwierdź nowe hasło',
  'field.confirmPassword.placeholder': 'Wpisz je jeszcze raz',
  'field.name': 'Twoje imię',
  'field.name.hint': 'Widzą je osoby, z którymi planujesz wyjazdy.',
  'field.name.placeholder': 'Anna Kowalska',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Podaj swój adres e-mail.',
  'validation.emailTooLong': 'Ten adres e-mail jest za długi.',
  'validation.emailInvalid': 'To nie wygląda na adres e-mail.',
  'validation.passwordRequired': 'Podaj hasło.',
  'validation.passwordShort': {
    one: 'Użyj co najmniej {value} znaku — krótka fraza bije sprytne słowo.',
    few: 'Użyj co najmniej {value} znaków — krótka fraza bije sprytne słowo.',
    many: 'Użyj co najmniej {value} znaków — krótka fraza bije sprytne słowo.',
    other: 'Użyj co najmniej {value} znaku — krótka fraza bije sprytne słowo.',
  },
  'validation.passwordLong': {
    one: 'Zmieść się w {value} znaku.',
    few: 'Zmieść się w {value} znakach.',
    many: 'Zmieść się w {value} znakach.',
    other: 'Zmieść się w {value} znaku.',
  },
  'validation.passwordMismatch': 'Te hasła nie są takie same.',
  'validation.nameShort':
    'Podaj swoje imię, żeby współtowarzysze wiedzieli, kto planuje z nimi wyjazd.',
  'validation.nameTooLong': 'To imię jest za długie.',
  'validation.termsRequired': 'Zaakceptuj regulamin, aby przejść dalej.',
  'validation.codeLength': 'Kody z aplikacji mają sześć cyfr.',
  'validation.codeDigits': 'Kody z aplikacji to same cyfry.',
  'validation.backupShort': 'Ten kod zapasowy wygląda na za krótki.',
  'validation.backupLong': 'Ten kod zapasowy wygląda na za długi.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Dobrze Cię znowu widzieć',
  'login.heading': 'Zaloguj się do planned.travel',
  'login.description':
    'Wróć do swoich planów, budżetów i list dokładnie tam, gdzie się urwały.',
  'login.newHere': 'Pierwszy raz tutaj?',
  'login.createAccount': 'Utwórz konto',
  'login.forgot': 'Nie pamiętasz hasła?',
  'login.remember': 'Nie wylogowuj mnie na tym urządzeniu',
  'login.submit': 'Zaloguj się',
  'login.submitting': 'Logowanie',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Załóż konto',
  'register.heading': 'Zacznij planować w kilka minut',
  'register.description':
    'Jedno konto na wszystkie wyjazdy, wszystkich współtowarzyszy i wszystkie listy.',
  'register.haveAccount': 'Masz już konto?',
  'register.signIn': 'Zaloguj się',
  'register.terms': 'Zgadzam się na regulamin i informację o prywatności.',
  'register.submit': 'Utwórz konto',
  'register.submitting': 'Tworzenie konta',

  'strength.hint': {
    one: 'Co najmniej {value} znak. Krótka fraza bije sprytne słowo.',
    few: 'Co najmniej {value} znaki. Krótka fraza bije sprytne słowo.',
    many: 'Co najmniej {value} znaków. Krótka fraza bije sprytne słowo.',
    other: 'Co najmniej {value} znaku. Krótka fraza bije sprytne słowo.',
  },
  'strength.tooShort': 'Siła: za krótkie',
  'strength.weak': 'Siła: słabe',
  'strength.fair': 'Siła: przeciętne',
  'strength.strong': 'Siła: mocne',
  'strength.excellent': 'Siła: znakomite',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Pomoc z hasłem',
  'forgot.heading': 'Zresetuj hasło',
  'forgot.description':
    'Podaj adres przypisany do konta, a wyślemy e-mailem link do ustawienia nowego hasła.',
  'forgot.submit': 'Wyślij mi link',
  'forgot.submitting': 'Wysyłanie linku',
  'forgot.back': 'Powrót do logowania',
  'forgot.sent.eyebrow': 'Zajrzyj do skrzynki',
  'forgot.sent.heading': 'Link do resetu jest w drodze',
  'forgot.sent.description':
    'Jeśli któreś konto korzysta z adresu {email}, link do wybrania nowego hasła jest już w tej skrzynce.',
  'forgot.sent.title': 'Link działa raz i tylko przez godzinę',
  'forgot.sent.body':
    'Nic nie przyszło? Sprawdź spam, a potem wyślij ponownie. Nowy link po cichu unieważnia poprzedni.',
  'forgot.sent.resend': 'Wyślij ponownie',
  'forgot.sent.resending': 'Wysyłanie ponownie',
  'forgot.sent.change': 'Użyj innego adresu',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Reset hasła',
  'reset.heading': 'Wybierz nowe hasło',
  'reset.description': {
    one: 'Wybierz coś o długości co najmniej {value} znaku. Krótką frazę łatwiej zapamiętać i trudniej zgadnąć.',
    few: 'Wybierz coś o długości co najmniej {value} znaków. Krótką frazę łatwiej zapamiętać i trudniej zgadnąć.',
    many: 'Wybierz coś o długości co najmniej {value} znaków. Krótką frazę łatwiej zapamiętać i trudniej zgadnąć.',
    other:
      'Wybierz coś o długości co najmniej {value} znaku. Krótką frazę łatwiej zapamiętać i trudniej zgadnąć.',
  },
  'reset.submit': 'Ustaw nowe hasło',
  'reset.submitting': 'Zapisywanie hasła',
  'reset.back': 'Powrót do logowania',
  'reset.stale.heading': 'Tego linku nie da się użyć',
  'reset.stale.description':
    'Linki do resetu wygasają po godzinie i działają tylko raz — to najbezpieczniejszy z możliwych kompromisów.',
  'reset.stale.action': 'Poproś o nowy link',
  'reset.done.heading': 'Nowe hasło jest ustawione',
  'reset.done.description':
    'Wszystkie inne sesje zostały wylogowane, więc kto znał stare hasło, nie ma już wejścia.',
  'reset.done.title': 'Wylogowano wszędzie indziej',
  'reset.done.body': 'Zaloguj się nowym hasłem i planuj dalej.',
  'reset.done.action': 'Zaloguj się',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Weryfikacja dwuskładnikowa',
  'twoFactor.heading': 'Potwierdź, że to Ty',
  'twoFactor.description':
    'Twoje konto chroni drugi składnik. Wpisz aktualny kod z aplikacji uwierzytelniającej.',
  'twoFactor.back': 'Zacznij od nowa od logowania',
  'twoFactor.methods': 'Sposób weryfikacji',
  'twoFactor.totp.tab': 'Aplikacja',
  'twoFactor.totp.label': 'Kod z sześciu cyfr',
  'twoFactor.totp.hint': 'Kody odświeżają się co 30 sekund.',
  'twoFactor.totp.submit': 'Zweryfikuj i przejdź dalej',
  'twoFactor.backup.tab': 'Kod zapasowy',
  'twoFactor.backup.label': 'Kod zapasowy',
  'twoFactor.backup.hint':
    'Z listy zapisanej przy włączaniu drugiego składnika. Każdy kod działa raz.',
  'twoFactor.backup.submit': 'Użyj kodu zapasowego',
  'twoFactor.submitting': 'Sprawdzanie kodu',
  'twoFactor.trust.label': 'Zaufaj temu urządzeniu na 30 dni',
  'twoFactor.trust.detail':
    'Do tego czasu ten krok będzie w tej przeglądarce pomijany. Rób to tylko na urządzeniu, które jest wyłącznie Twoje.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'E-mail potwierdzony',
  'verify.done.heading': 'Wszystko gotowe',
  'verify.done.description':
    'Adres jest potwierdzony, więc zaproszenia, przypomnienia i podsumowania wyjazdów będą do Ciebie docierać.',
  'verify.done.title': 'Potwierdzony',
  'verify.done.body': 'Adres {email} jest potwierdzony na tym koncie.',
  'verify.done.bodyUnknown':
    'Twój adres e-mail jest potwierdzony na tym koncie.',
  'verify.done.action': 'Przejdź do pulpitu',

  'verify.pending.eyebrow': 'Jeszcze jedno',
  'verify.pending.heading': 'Potwierdź swój adres e-mail',
  'verify.pending.description':
    'Wysłaliśmy link potwierdzający na {email}. Otwarcie go sprawia, że konto da się odzyskać, a współtowarzysze mogą Cię zapraszać.',
  'verify.pending.wrongAddress': 'Zły adres?',
  'verify.pending.changeIt': 'Zmień go w ustawieniach',
  'verify.pending.title': 'Link jest ważny 24 godziny',
  'verify.pending.body':
    'Nic w skrzynce? Sprawdź spam, a potem wyślij ponownie.',
  'verify.pending.resentTitle': 'Wysłane jeszcze raz',
  'verify.pending.resentBody':
    'Daj temu minutę, a potem zajrzyj do skrzynki — i do spamu.',
  'verify.pending.resend': 'Wyślij potwierdzenie ponownie',
  'verify.pending.resending': 'Wysyłanie ponownie',
  'verify.pending.continue': 'Kontynuuj mimo to',

  'verify.request.eyebrow': 'Potwierdzenie e-maila',
  'verify.request.heading': 'Wyślij nowy link potwierdzający',
  'verify.request.description':
    'Linki potwierdzające są ważne 24 godziny i działają tylko raz. Podaj swój adres, a świeży link rusza w drogę.',
  'verify.request.submit': 'Wyślij link potwierdzający',
  'verify.request.submitting': 'Wysyłanie linku',
  'verify.request.sentTitle': 'Już w drodze',
  'verify.request.sentBody':
    'Jeśli ten adres ma konto czekające na potwierdzenie, link jest już w jego skrzynce.',
  'verify.request.change': 'Użyj innego adresu',
  'verify.request.back': 'Powrót do logowania',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Zaproszenie do przestrzeni',
  'invitation.heading': 'Dołącz do {workspace}',
  'invitation.description':
    'Przyjęcie dodaje Cię do tej przestrzeni i udostępnia Ci jej wyjazdy, budżety i listy.',
  'invitation.invitedAs': 'Zaproszenie na adres {email}',
  'invitation.role': 'Twoja rola',
  'invitation.means': 'Czyli',
  'invitation.invitedBy': 'Zaprasza',
  'invitation.expires': 'Wygasa',
  'invitation.accept': 'Przyjmij zaproszenie',
  'invitation.accepting': 'Dołączanie do przestrzeni',
  'invitation.decline': 'Odrzuć',
  'invitation.declining': 'Odrzucanie',
  'invitation.reassurance':
    'Przestrzeń możesz opuścić w każdej chwili w jej ustawieniach, a nic, co tworzysz poza nią, nie jest udostępniane.',

  'invitation.role.owner': 'Właściciel — pełna kontrola, razem z płatnościami',
  'invitation.role.admin':
    'Administrator — zarządza wyjazdami, ludźmi i ustawieniami',
  'invitation.role.member': 'Członek — planuje wyjazdy razem z innymi',
  'invitation.role.other': '{role} — dostęp ustala właściciel przestrzeni',
  'invitation.role.badge.owner': 'Właściciel',
  'invitation.role.badge.admin': 'Administrator',
  'invitation.role.badge.member': 'Członek',

  'invitation.anonymous.heading': 'Zaloguj się, aby zobaczyć zaproszenie',
  'invitation.anonymous.description':
    'Zaproszenia są powiązane z adresem, na który zostały wysłane, więc musimy wiedzieć, kim jesteś, zanim je pokażemy.',
  'invitation.anonymous.body':
    'Użyj adresu, na który przyszło zaproszenie. Zaraz potem wrócimy z Tobą prosto tutaj.',
  'invitation.anonymous.action': 'Zaloguj się, aby przejść dalej',
  'invitation.anonymous.noAccount': 'Nie masz jeszcze konta?',
  'invitation.anonymous.register': 'Utwórz je na zaproszony adres',

  'invitation.mismatch.heading': 'To zaproszenie jest na inny adres',
  'invitation.mismatch.description':
    'Ta sesja należy do kogoś innego, więc to zaproszenie nie jest Twoje do przyjęcia.',
  'invitation.mismatch.title': 'Zalogowano jako {email}',
  'invitation.mismatch.body':
    'Wyloguj się i zaloguj adresem, na który przyszło zaproszenie, albo poproś o nowe zaproszenie na to konto.',
  'invitation.mismatch.action': 'Zmień konto',
  'invitation.mismatch.back': 'Powrót do logowania',

  'invitation.unverified.heading': 'Potwierdź e-mail, aby dołączyć',
  'invitation.unverified.description':
    'Przestrzenie przyjmują tylko potwierdzone adresy, więc nikt nie zostanie dodany przez literówkę.',
  'invitation.unverified.title': 'Adres {email} nie jest jeszcze potwierdzony',
  'invitation.unverified.body':
    'Otwórz link potwierdzający ze swojej skrzynki i wróć na tę stronę. Zaproszenie będzie czekać.',
  'invitation.unverified.action': 'Potwierdź mój e-mail',
  'invitation.unverified.resend': 'Wyślij e-mail potwierdzający ponownie',

  'invitation.unavailable.heading': 'To zaproszenie jest już nieaktualne',
  'invitation.unavailable.description':
    'Zaproszenia są ważne siedem dni i wygasają w chwili, w której ktoś ich użyje albo je wycofa.',
  'invitation.unavailable.title': 'Nie ma tu czego przyjmować',
  'invitation.unavailable.body':
    'Poproś osobę, która Cię zapraszała, o nowe zaproszenie — ta strona pokaże je od razu.',
  'invitation.unavailable.dashboard': 'Przejdź do pulpitu',

  'invitation.declined.eyebrow': 'Zaproszenie odrzucone',
  'invitation.declined.heading': 'Nie ma sprawy — nic nie zostało udostępnione',
  'invitation.declined.description':
    'Właściciel przestrzeni został o tym powiadomiony, a ten link już nie działa.',
  'invitation.declined.action': 'Przejdź do pulpitu',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Coś poszło nie tak',
  'error.unexpected.detail': 'To nie zadziałało. Spróbuj ponownie za chwilę.',
  'error.rateLimited.title': 'Za dużo prób',
  'error.rateLimited.detail':
    'Dla bezpieczeństwa wstrzymaliśmy logowanie z tego urządzenia na kilka minut. Spróbuj wkrótce.',
  'error.offline.title': 'Brak połączenia',
  'error.offline.detail':
    'Nie udało się połączyć z planned.travel. Sprawdź połączenie i spróbuj ponownie.',

  'error.credentials.title': 'Te dane się nie zgadzają',
  'error.credentials.detail':
    'Sprawdź adres e-mail i hasło, a potem spróbuj ponownie. Jeśli konto powstało przez Google lub Apple, użyj tego przycisku.',
  'error.password.title': 'Te dane się nie zgadzają',
  'error.password.detail':
    'Sprawdź adres e-mail i hasło, a potem spróbuj ponownie.',
  'error.noPassword.title': 'To konto nie ma hasła',
  'error.noPassword.detail':
    'To konto loguje się przez serwis społecznościowy albo kluczem dostępu. Użyj jednej z opcji powyżej.',
  'error.unverified.title': 'Najpierw potwierdź e-mail',
  'error.unverified.detail':
    'Przy rejestracji wysłaliśmy link potwierdzający. Otwórz go i wróć tutaj.',
  'error.emailTaken.title': 'Ten e-mail jest już zarejestrowany',
  'error.emailTaken.detail':
    'Zaloguj się albo zresetuj hasło, jeśli go nie pamiętasz.',
  'error.noAccount.title': 'Nie znaleźliśmy takiego konta',
  'error.noAccount.detail': 'Sprawdź adres albo utwórz nowe konto.',
  'error.passwordTooShort.title': 'Hasło za krótkie',
  'error.passwordTooShort.detail': 'Wybierz dłuższą frazę i spróbuj ponownie.',
  'error.passwordTooLong.title': 'Hasło za długie',
  'error.passwordTooLong.detail': 'Wybierz krótszą frazę i spróbuj ponownie.',
  'error.linkSpent.title': 'Ten link już nie działa',
  'error.linkSpent.detail':
    'Linki do hasła działają tylko raz. Poproś o nowy — wyślemy go od razu.',
  'error.linkExpired.title': 'Ten link wygasł',
  'error.linkExpired.detail': 'Poproś o nowy — wyślemy go od razu.',
  'error.linkIncomplete.title': 'Ten link jest niekompletny',
  'error.linkIncomplete.detail':
    'Linki do resetu hasła noszą jednorazowy token. Otwórz najnowszy e-mail albo poproś o świeży link.',
  'error.sessionExpired.title': 'Sesja wygasła',
  'error.sessionExpired.detail':
    'Zaloguj się ponownie, aby wrócić do przerwanej pracy.',
  'error.alreadyVerified.title': 'Już potwierdzone',
  'error.alreadyVerified.detail':
    'Ten adres e-mail jest zweryfikowany. Możesz zalogować się normalnie.',
  'error.badCode.title': 'Ten kod nie zadziałał',
  'error.badCode.detail':
    'Kody z aplikacji żyją 30 sekund. Poczekaj na następny i wpisz wszystkie sześć cyfr.',
  'error.badBackupCode.title': 'Ten kod zapasowy nie zadziałał',
  'error.badBackupCode.detail':
    'Każdy kod zapasowy działa raz. Spróbuj kolejnego nieużytego z listy.',
  'error.locked.title': 'Konto chwilowo zablokowane',
  'error.locked.detail':
    'Za dużo nieudanych prób weryfikacji. Dla bezpieczeństwa konto jest zablokowane na kilka minut.',
  'error.twoFactorOn.title':
    'Uwierzytelnianie dwuskładnikowe jest już włączone',
  'error.twoFactorOn.detail':
    'Ponowna konfiguracja sprawiłaby, że obecna aplikacja uwierzytelniająca przestałaby działać, więc nic nie zmieniono. Możesz nim zarządzać tutaj.',
  'error.noTwoFactor.title': 'Drugi składnik nie jest ustawiony',
  'error.noTwoFactor.detail':
    'Zaloguj się e-mailem i hasłem, aby przejść dalej.',
  'error.twoFactorExpired.title': 'Zacznij od nowa od logowania',
  'error.twoFactorExpired.detail':
    'Ten krok weryfikacji wygasł. Podaj e-mail i hasło jeszcze raz.',
  'error.invitationGone.title': 'To zaproszenie jest już nieaktualne',
  'error.invitationGone.detail':
    'Mogło wygasnąć, zostać wycofane albo już użyte. Poproś o nowe zaproszenie.',
  'error.invitationOther.title': 'To zaproszenie jest dla kogoś innego',
  'error.invitationOther.detail':
    'Zostało wysłane na inny adres e-mail. Zaloguj się tym adresem, aby je przyjąć.',
  'error.alreadyMember.title': 'Już jesteś w tej przestrzeni',
  'error.alreadyMember.detail':
    'Nie ma czego przyjmować — otwórz ją z przełącznika przestrzeni.',
  'error.workspaceFull.title': 'Ta przestrzeń jest pełna',
  'error.workspaceFull.detail':
    'Osiągnęła limit członków. Poproś właściciela o zwolnienie miejsca albo o wyższy plan.',
  'error.verifyBeforeJoin.title': 'Najpierw potwierdź e-mail',
  'error.verifyBeforeJoin.detail':
    'Otwórz link potwierdzający z naszego e-maila, a potem wróć do tego zaproszenia.',

  'passkeyNotice.added': 'Dodano klucz dostępu do Twojego konta',
  'passkeyNotice.removed': 'Usunięto klucz dostępu z Twojego konta',
  'passkeyNotice.security': 'Bezpieczeństwo',
  'passkeyNotice.action': 'Zarządzaj kluczami dostępu',
  'passkeyNotice.recovery':
    'Jeśli nie rozpoznajesz tej zmiany, zmień hasło i zakończ nieznane sesje. Reset hasła nie usuwa kluczy dostępu. Przejrzyj je i usuń te, których nie rozpoznajesz.',
  'error.passwordAttemptsLocked.title': 'Potwierdzanie hasła zablokowane',
  'error.passwordAttemptsLocked.detail':
    'Ta sesja nie może już potwierdzać hasła. Wyloguj się i zaloguj ponownie.',
  'error.passwordResultUnknown.title': 'Sprawdź ustawienia zabezpieczeń',
  'error.passwordResultUnknown.detail':
    'Zmiana mogła zostać zapisana. Nie zamykaj tej sesji, dopóki nie upewnisz się, że możesz zalogować się ponownie. Jeśli zmieniono hasło, spróbuj nowego. Jeśli wymieniono kody zapasowe, stary zestaw może już nie działać; użyj aplikacji uwierzytelniającej lub innej zalogowanej sesji, aby wygenerować nowy zestaw.',
} satisfies TranslationOf<typeof En>

export default messages
