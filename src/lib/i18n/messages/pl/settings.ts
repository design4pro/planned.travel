/**
 * Everything the settings module says, in Polish.
 *
 * Authored from `../en/settings.ts` (`docs/SPEC.md` §8.9). The English file is
 * the schema; `__tests__/parity.test.ts` checks the placeholders, the plural
 * branches and that nothing English is left sitting here (§8.6).
 *
 * **Plural.** `pl` needs `one` · `few` · `many` · `other`; `other` is reached
 * by a fraction only and takes the genitive singular.
 *
 * **Currency names are lower case**, because Polish writes them that way:
 * "euro", "funt szterling", "złoty polski". Only the ISO code beside them is
 * capitalised, and that code is derived in the route rather than translated.
 *
 * **Plan names are words, not proper nouns** (see the English file's note on
 * `billing.plan.*`): the stable identifier is the plan *id*, which no reader
 * sees. `Solo` is the traveller who plans alone, so „Podróżnik”; `Crew` is the
 * group, so „Ekipa”.
 *
 * **„Plan” means two things** in English — an itinerary and a subscription.
 * Polish keeps „plan” for the itinerary and says „abonament” where the sentence
 * is about what the workspace pays for, so a bare `Plan` label never reads as
 * the day-by-day plan of a trip.
 *
 * **Dwa twarde budżety pikselowe**, zmierzone w Chromium na `/settings` przy
 * 1440 (oba `.truncate`, więc nadmiar zostaje ucięty, a nie zawinięty):
 * podpowiedź pod każdym odnośnikiem nawigacji bocznej ma 196 px, a przycisk
 * regionalnego `Select` 206 px. Angielski oryginał sięga odpowiednio 189 px i
 * 212 px, więc dosłowny, dłuższy przekład zostaje przycięty. Dlatego
 * `nav.security.hint` brzmi „Hasło, drugi składnik i klucze" (159 px), a
 * `regional.workspaceDefault` zaczyna się od „Z przestrzeni — " (175 px z
 * najdłuższą wartością), nie od „Ustawienie przestrzeni — " (235 px).
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Konto',
  'page.title': 'Ustawienia',
  'page.description':
    'Wszystko o Tobie, Twojej przestrzeni i o tym, jak zachowuje się planned.travel',
  'page.error': 'Ustawienia się nie wczytały',

  'nav.label': 'Sekcje ustawień',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Ty oraz zapis dat i pieniędzy',
  'nav.language': 'Język',
  'nav.language.hint': 'Język, którym mówi każdy ekran',
  'nav.appearance': 'Wygląd',
  'nav.appearance.hint': 'Motyw, animacje i mapa',
  'nav.security': 'Bezpieczeństwo',
  'nav.security.hint': 'Hasło, drugi składnik i klucze',
  'nav.notifications': 'Powiadomienia',
  'nav.notifications.hint': 'Skrzynka, e-mail i telefon',
  'nav.workspace': 'Przestrzeń',
  'nav.workspace.hint': 'Członkowie i wspólne ustawienia',
  'nav.billing': 'Płatności',
  'nav.billing.hint': 'Plan, miejsca i faktury',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Zapisz zmiany',
  'error.retryBody': 'Nic nie zginęło. Sprawdź połączenie i spróbuj ponownie.',
  'role.owner': 'Właściciel',
  'role.admin': 'Administrator',
  'role.member': 'Członek',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Z przestrzeni — {value}',
  'regional.currency.AUD': 'dolar australijski',
  'regional.currency.CAD': 'dolar kanadyjski',
  'regional.currency.CHF': 'frank szwajcarski',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'funt szterling',
  'regional.currency.JPY': 'jen japoński',
  'regional.currency.PLN': 'złoty polski',
  'regional.currency.SEK': 'korona szwedzka',
  'regional.currency.USD': 'dolar amerykański',
  'regional.distance.metric': 'Kilometry',
  'regional.distance.imperial': 'Mile',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Twój profil się nie wczytał',
  'profile.account.title': 'Twoje konto',
  'profile.account.description':
    'Imię i adres e-mail pochodzą z konta, którym się logujesz.',
  'profile.email.verified': 'E-mail potwierdzony',
  'profile.email.unverified': 'E-mail niepotwierdzony',
  'profile.twoFactor.on': 'Drugi składnik włączony',
  'profile.figure.workspace': 'Przestrzeń',
  'profile.figure.role': 'Rola',
  'profile.figure.joined': 'Członek od',
  'profile.figure.joinedUnknown': 'Nie zapisano',
  'profile.regional.title': 'Daty, pieniądze i jednostki',
  'profile.regional.description':
    'To nadpisuje ustawienia przestrzeni tylko dla Ciebie. Pozostaw wybór domyślny, a pole pójdzie za przestrzenią.',
  'profile.regional.saving': 'Zapisywanie preferencji',
  'profile.regional.saved': 'Twoje preferencje są zapisane',
  'profile.regional.saveFailed': 'Twoje preferencje nie zostały zapisane',
  'profile.language.label': 'Język',
  'profile.language.hint':
    'Wybierany na własnym ekranie, gdzie każdy język zapisany jest swoim pismem.',
  'profile.language.action': 'Zmień',
  'profile.timezone.label': 'Strefa czasowa',
  'profile.timezone.hint':
    'Godziny wyjazdów i przyjazdów pokazujemy względem niej.',
  'profile.currency.label': 'Waluta',
  'profile.currency.hint':
    'Nowe wyjazdy startują w tej walucie; każdy wyjazd może ją zmienić.',
  'profile.dateFormat.label': 'Format daty',
  'profile.weekStart.label': 'Tydzień zaczyna się od',
  'profile.weekStart.hint':
    'Dotyczy każdego kalendarza, także rocznej siatki urlopów.',
  'profile.distance.label': 'Odległość',

  /* --------------------------------------------------------------- language */
  'language.error': 'Ustawienia języka się nie wczytały',
  'language.section.title': 'Język',
  'language.section.description':
    'Każdy ekran, każdy przycisk i każda data czytają się w języku, który tu wybierzesz — jest ich dwadzieścia trzy, każdy zapisany swoim pismem.',
  'language.label': 'Wybierz język',
  'language.followWorkspace': 'Idź za przestrzenią',
  'language.state.yours': 'Twój język',
  'language.state.workspace': 'Z ustawień przestrzeni',
  'language.state.hint.override':
    'Twój własny wybór. Dotyczy tylko Ciebie, na każdym urządzeniu, z którego się logujesz.',
  'language.state.hint.workspace':
    'Nie masz własnego języka, więc czytasz w tym, na który ustawiona jest przestrzeń. Właściciel albo administrator może to zmienić w sekcji Przestrzeń.',
  'language.saved': 'planned.travel mówi teraz w języku {language}',
  'language.saveFailed': 'Język nie został zmieniony',
  'language.saveFailedBody':
    'Nic nie zginęło i nadal czytasz w języku {language}. Sprawdź połączenie i wybierz ponownie.',
  'language.reload.title': 'Twój język jest zapisany',
  'language.reload.body':
    'Ta strona nie zdążyła przełączyć się na {language}. Odśwież ją, aby czytać produkt w nowym języku.',
  'language.sample.title': 'Jak będą się czytać daty i liczby',
  'language.sample.description':
    'Te same trzy wartości, zapisane tak, jak zapisuje je ten język.',
  'language.sample.date': 'Data',
  'language.sample.number': 'Liczba',
  'language.sample.money': 'Kwota',
  'language.legal':
    'Regulamin i informacja o prywatności są publikowane tylko po angielsku. Wszystko inne w produkcie jest przetłumaczone.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Wygląd się nie wczytał',
  'appearance.theme.title': 'Motyw',
  'appearance.theme.description':
    'Oba motywy są zaprojektowane, a nie odwrócone. Wybierz ten, który czyta się wygodniej.',
  'appearance.theme.light': 'Jasny',
  'appearance.theme.lightHint': 'Ciepły papier, przez cały dzień',
  'appearance.theme.dark': 'Ciemny',
  'appearance.theme.darkHint': 'Ciepły grafit, nigdy czerń',
  'appearance.theme.system': 'Systemowy',
  'appearance.theme.systemHint': 'Zgodnie z urządzeniem',
  'appearance.theme.showing': 'W tej chwili obowiązuje paleta {palette}.',
  'appearance.theme.showingSystem':
    'W tej chwili obowiązuje paleta {palette}, zgodnie z ustawieniem urządzenia.',
  'appearance.palette.light': 'jasna',
  'appearance.palette.dark': 'ciemna',
  'appearance.motion.title': 'Animacje i mapy',
  'appearance.motion.label': 'Ogranicz animacje',
  'appearance.motion.hint':
    'Zwija animacje wejścia do zwykłego przejścia. Systemowe ustawienie ograniczania ruchu jest zawsze respektowane.',
  'appearance.map.label': 'Styl mapy',
  'appearance.map.hint': 'Mapa bazowa planera i mapy świata.',
  'appearance.map.workspace': 'Idź za przestrzenią',
  'appearance.map.light': 'Papier — jasna',
  'appearance.map.dark': 'Grafit — ciemna',
  'appearance.saveFailed': 'Ta zmiana nie została zapisana',
  'appearance.saveFailedBody':
    'Widać ją tutaj, ale kolejne urządzenie, z którego się zalogujesz, jej nie będzie miało.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Bezpieczeństwo się nie wczytało',
  'security.unverified.title':
    'Twój adres e-mail nie jest jeszcze potwierdzony',
  'security.unverified.body':
    'Resety hasła i zaproszenia na wyjazdy trafiają na {email}. Potwierdzenie jest dowodem, że ten adres jest Twój.',
  'security.unverified.action': 'Wyślij link ponownie',
  'security.signin.title': 'Logowanie',
  'security.signin.description':
    'Czym dowodzisz, że to Ty. Drugi składnik i klucze dostępu są mocniejsze niż samo hasło.',
  'security.email.label': 'Adres e-mail',
  'security.email.verified': 'Potwierdzony',
  'security.email.unverified': 'Niepotwierdzony',
  'security.password.label': 'Hasło',
  'security.password.hint':
    'Zmieniaj je, kiedy chcesz — dostaniesz jednorazowy link, a nie pytanie o stare hasło.',
  'security.password.action': 'Zmień hasło',
  'security.twoFactor.label': 'Uwierzytelnianie dwuskładnikowe',
  'security.twoFactor.onHint':
    'Przy każdym nowym logowaniu wymagany jest kod z aplikacji uwierzytelniającej.',
  'security.twoFactor.offHint':
    'Dodaj do hasła sześciocyfrowy kod z aplikacji uwierzytelniającej.',
  'security.twoFactor.on': 'Wł.',
  'security.twoFactor.off': 'Wył.',
  'security.twoFactor.manage': 'Zarządzaj',
  'security.twoFactor.enable': 'Włącz',
  'security.passkeys.label': 'Klucze dostępu',
  'security.passkeys.hint':
    'Loguj się czytnikiem odcisku, Face ID albo kluczem sprzętowym, bez wpisywania czegokolwiek.',
  'security.passkeys.action': 'Zarządzaj kluczami',
  'security.session.title': 'Ta sesja',
  'security.session.description': 'Przeglądarka, w której to czytasz.',
  'security.session.label': 'Zalogowano jako',
  'security.session.expires': 'Wygasa {date}',
  'security.session.expiresSoon': 'wkrótce',
  'security.session.noExpiry': 'Brak zapisanego terminu',
  'security.signOut.label': 'Wyloguj się',
  'security.signOut.hint':
    'Kończy tę sesję i wraca na stronę logowania. Inne urządzenia zostają zalogowane.',
  'security.signOut.pending': 'Wylogowywanie',
  'security.signOut.failed': 'Nie udało się wylogować',
  'security.signOut.failedBody': 'Sprawdź połączenie i spróbuj ponownie.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Ustawienia powiadomień się nie wczytały',
  'notifications.title': 'Powiadomienia',
  'notifications.description':
    'Każdy przełącznik dotyczy tylko Ciebie. Wyłączenie go nie zatrzymuje zdarzenia — zatrzymuje tylko naszą wiadomość o nim.',
  'notifications.caption': 'Które powiadomienia docierają do którego kanału',
  'notifications.event': 'Zdarzenie',
  'notifications.switch': '{event} – {channel}',
  'notifications.saveFailed': 'Ta preferencja nie została zapisana',
  'notifications.saveFailedBody':
    'Przełącznik wrócił na miejsce. Sprawdź połączenie i spróbuj ponownie.',
  'notifications.channel.in_app': 'W aplikacji',
  'notifications.channel.in_app.hint': 'Dzwonek na górnym pasku',
  'notifications.channel.email': 'E-mail',
  'notifications.channel.email.hint': 'Na adres, którym się logujesz',
  'notifications.channel.push': 'Na telefon',
  'notifications.channel.push.hint':
    'Na urządzeniach, na których na to pozwolisz',
  'notifications.event.trip.invited': 'Zaproszenia na wyjazdy',
  'notifications.event.trip.invited.hint':
    'Ktoś dodaje Cię do wyjazdu, który planuje.',
  'notifications.event.trip.updated': 'Zmiany w planie',
  'notifications.event.trip.updated.hint':
    'Dzień, przystanek albo data przesuwa się w wyjeździe, w którym jesteś.',
  'notifications.event.trip.starting_soon': 'Przypomnienia o wyjeździe',
  'notifications.event.trip.starting_soon.hint':
    'Delikatne przypomnienie w dniach przed startem wyjazdu.',
  'notifications.event.reservation.reminder': 'Przypomnienia o rezerwacjach',
  'notifications.event.reservation.reminder.hint':
    'Zbliża się nocleg, stolik albo bilet.',
  'notifications.event.expense.added': 'Nowe wydatki',
  'notifications.event.expense.added.hint':
    'Ktoś zapisuje pieniądze wydane na wspólnym wyjeździe.',
  'notifications.event.expense.settled': 'Rozliczone salda',
  'notifications.event.expense.settled.hint':
    'Saldo, które Cię dotyczyło, zostało uregulowane.',
  'notifications.event.list.assigned': 'Przypisane zadania',
  'notifications.event.list.assigned.hint':
    'Coś z listy pakowania albo listy zadań staje się Twoje.',
  'notifications.event.collab.message': 'Rozmowa o wyjeździe',
  'notifications.event.collab.message.hint':
    'Nowe wiadomości w wyjeździe, na który jedziesz.',
  'notifications.event.organization.invited': 'Zaproszenia do przestrzeni',
  'notifications.event.organization.invited.hint':
    'Ktoś zaprasza Cię do przestrzeni roboczej.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Przestrzeń się nie wczytała',
  'workspace.summary.description': 'Abonament {plan} · utworzono {date}',
  'workspace.summary.createdRecently': 'niedawno',
  'workspace.summary.billingAction': 'Plan i płatności',
  'workspace.seats.label': 'Zajęte miejsca',
  'workspace.seats.value': '{used} z {limit}',
  'workspace.seats.note':
    'Otwarte zaproszenia zajmują miejsca, więc przestrzeń nigdy nie wyjdzie ponad plan, który opłaca.',
  'workspace.seatsFull.title': 'Wszystkie miejsca w tym planie są zajęte',
  'workspace.seatsFull.body':
    '{members} i {invitations} wypełniają limit {limit} miejsc.',
  'workspace.seatsFull.action': 'Dodaj miejsca',
  'workspace.members.count': {
    one: '{value} członek',
    few: '{value} członkowie',
    many: '{value} członków',
    other: '{value} członka',
  },
  'workspace.invitations.count': {
    one: '{value} zaproszenie w toku',
    few: '{value} zaproszenia w toku',
    many: '{value} zaproszeń w toku',
    other: '{value} zaproszenia w toku',
  },
  'workspace.members.title': 'Członkowie',
  'workspace.members.description':
    'Wszyscy, którzy widzą wyjazdy, pieniądze i pliki w tej przestrzeni.',
  'workspace.members.tableLabel': 'Członkowie tej przestrzeni',
  'workspace.members.person': 'Osoba',
  'workspace.members.role': 'Rola',
  'workspace.members.joined': 'Data dołączenia',
  'workspace.invitations.title': 'Zaproszenia',
  'workspace.invitations.description':
    'Osoby, które zostały zaproszone, ale jeszcze nie dołączyły.',
  'workspace.invitations.emptyTitle': 'Brak otwartych zaproszeń',
  'workspace.invitations.emptyBody':
    'Wszyscy zaproszeni do tej przestrzeni już dołączyli.',
  'workspace.invitations.expires': 'Wygasa {date}',
  'workspace.invitations.expiresSoon': 'wkrótce',
  'workspace.defaults.title': 'Wspólne ustawienia',
  'workspace.defaults.description':
    'Z czym startuje nowy wyjazd i nowa osoba. Każdy może nadpisać to dla siebie w swoim profilu.',
  'workspace.defaults.readOnly': 'Tylko do odczytu',
  'workspace.defaults.saving': 'Zapisywanie ustawień przestrzeni',
  'workspace.defaults.saved': 'Ustawienia przestrzeni są zapisane',
  'workspace.defaults.saveFailed':
    'Ustawienia przestrzeni nie zostały zapisane',
  'workspace.defaults.saveFailedBody':
    'Zmieniać je może tylko właściciel albo administrator. Sprawdź połączenie i spróbuj ponownie.',
  'workspace.currency.label': 'Domyślna waluta',
  'workspace.currency.hint': 'W niej budżetowane są nowe wyjazdy.',
  'workspace.language.label': 'Język',
  'workspace.language.hint':
    'To, co czyta osoba, która nie wybrała własnego języka.',
  'workspace.timezone.label': 'Strefa czasowa',
  'workspace.dateFormat.label': 'Format daty',
  'workspace.weekStart.label': 'Tydzień zaczyna się od',
  'workspace.distance.label': 'Odległość',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Płatności się nie wczytały',
  'billing.loading': 'Wczytywanie planu i rachunków',
  'billing.status.none': 'Brak subskrypcji',
  'billing.status.trialing': 'Okres próbny',
  'billing.status.active': 'Aktywna',
  'billing.status.past_due': 'Płatność nieudana',
  'billing.status.unpaid': 'Nieopłacona',
  'billing.status.paused': 'Wstrzymana',
  'billing.status.canceled': 'Anulowana',
  'billing.status.incomplete': 'Niedokończona',
  'billing.status.incomplete_expired': 'Wygasła',

  'billing.checkout.completeTitle': 'Płatność przyjęta',
  'billing.checkout.completeBody':
    'Nowy plan jest właśnie wprowadzany. Pojawi się tutaj w chwili, w której Polar go potwierdzi — zwykle w kilka sekund.',
  'billing.checkout.cancelledTitle': 'Płatność przerwana',
  'billing.checkout.cancelledBody':
    'Nic nie zostało obciążone, a plan się nie zmienił.',
  'billing.portal.backTitle': 'Powrót ze Polar',
  'billing.portal.backBody':
    'Wszystko, co tam zmieniono, pojawi się tutaj, gdy Polar to potwierdzi.',
  'billing.refresh': 'Odśwież',
  'billing.readOnly.title': 'Jesteś członkiem tej przestrzeni',
  'billing.readOnly.body':
    'Subskrypcję może zmienić tylko właściciel albo administrator. Wszystko poniżej jest dla Ciebie tylko do odczytu.',

  'billing.hero.label': 'Aktualny plan',
  'billing.hero.endsAtPeriod': 'Kończy się z końcem okresu',
  'billing.hero.perYear': '/ rok',
  'billing.hero.perMonth': '/ mies.',
  'billing.hero.freeAllowance': '{trips} wyjazdy, jeden podróżny',
  'billing.hero.perSeatLine': '{seats} × {price}',
  'billing.hero.singleTraveller': 'Jeden podróżny',
  'billing.hero.paymentMethod': 'Metoda płatności',
  'billing.hero.cancel': 'Zrezygnuj z planu',
  'billing.price.free': 'Bezpłatnie',
  'billing.provider.opening': 'Otwieranie Polar',
  'billing.provider.failed': 'Nie udało się połączyć ze Polar',
  'billing.provider.failedBody':
    'Nic nie zostało obciążone. Sprawdź połączenie i spróbuj za chwilę.',

  'billing.renewal.trialEndsToday':
    'Okres próbny kończy się dziś. Dodaj kartę, aby zachować odblokowane moduły.',
  'billing.renewal.trialEndsIn': {
    one: 'Okres próbny kończy się za {value} dzień. Do tego czasu karta nie jest potrzebna.',
    few: 'Okres próbny kończy się za {value} dni. Do tego czasu karta nie jest potrzebna.',
    many: 'Okres próbny kończy się za {value} dni. Do tego czasu karta nie jest potrzebna.',
    other:
      'Okres próbny kończy się za {value} dnia. Do tego czasu karta nie jest potrzebna.',
  },
  'billing.renewal.trialEnded': 'Okres próbny się skończył.',
  'billing.renewal.endsNoDate':
    'Ten plan ma się zakończyć i nie odnowi się ponownie.',
  'billing.renewal.endsOn':
    'Ten plan kończy się {date}. Nic nie zostanie usunięte — płatne moduły po prostu się zablokują.',
  'billing.renewal.pastDue':
    'Ostatnia płatność nie przeszła. Zaktualizuj kartę, aby nie stracić płatnych modułów.',
  'billing.renewal.unpaid':
    'Ta subskrypcja jest nieopłacona, a płatne moduły są zablokowane.',
  'billing.renewal.paused':
    'Ta subskrypcja jest wstrzymana. Wznów ją, kiedy znów będziesz w drodze.',
  'billing.renewal.lapsed':
    'Wybierz plan poniżej, aby znów odblokować rezerwacje, dziennik i mapy offline.',
  'billing.renewal.incomplete':
    'Polar wciąż czeka na potwierdzenie tej płatności.',
  'billing.renewal.free':
    'Dwa wyjazdy naraz, na nasz koszt. Wyższy plan wybierzesz, kiedy zrobi się ciasno.',
  'billing.renewal.auto': 'Odnawia się automatycznie.',
  'billing.renewal.renewsOn': 'Odnawia się {date}.',

  'billing.usage.title': 'Zużycie',
  'billing.usage.description':
    'Liczone na żywo, więc licznik nigdy nie jest przedawniony. Limity idą za planem obowiązującym w tej chwili.',
  'billing.quota.seats': 'Członkowie',
  'billing.quota.trips': 'Wyjazdy',
  'billing.quota.storageBytes': 'Miejsce',
  'billing.quota.unlimited': 'Bez limitu',
  'billing.quota.noLimit': 'W tym planie bez limitu',
  'billing.quota.used': 'Zużyte: {quota}',
  'billing.quota.over.seats': {
    one: '{value} miejsce powyżej limitu tego planu',
    few: '{value} miejsca powyżej limitu tego planu',
    many: '{value} miejsc powyżej limitu tego planu',
    other: '{value} miejsca powyżej limitu tego planu',
  },
  'billing.quota.over.trips': {
    one: '{value} miejsce na wyjazd powyżej limitu tego planu',
    few: '{value} miejsca na wyjazdy powyżej limitu tego planu',
    many: '{value} miejsc na wyjazdy powyżej limitu tego planu',
    other: '{value} miejsca na wyjazd powyżej limitu tego planu',
  },
  'billing.quota.over.storage': '{value} powyżej limitu tego planu',
  'billing.quota.exhausted.seats': 'Wszystkie miejsca w tym planie są zajęte',
  'billing.quota.exhausted.trips':
    'Wszystkie miejsca na wyjazdy w tym planie są w użyciu',
  'billing.quota.exhausted.storage': 'Miejsce w tym planie się skończyło',
  'billing.quota.left': 'Zostało {value}',

  'billing.plans.title': 'Plany',
  'billing.plans.description':
    'Plan zmieniasz, kiedy chcesz. Wyższy rozliczamy proporcjonalnie do dnia, a niższy czeka na koniec opłaconego okresu.',
  'billing.interval.label': 'Okres rozliczeniowy',
  /**
   * The two cadences ride inside one pill above the plan cards, and that pill
   * has 326px at 360px wide. `Miesięcznie` / `Rocznie` / `Oszczędzasz` pushed it
   * 20px past the card edge, so the adverbs give way to the equally ordinary
   * `Co miesiąc` / `Co rok`, and the badge says how much cheaper rather than
   * who is doing the saving.
   */
  'billing.interval.monthly': 'Co miesiąc',
  'billing.interval.yearly': 'Co rok',
  'billing.interval.saving': 'Taniej o {value}',
  'billing.plan.free.name': 'Darmowy',
  'billing.plan.free.tagline': 'Zaplanuj dwa najbliższe wyjazdy',
  'billing.plan.free.feature.trips': 'Dwa wyjazdy naraz',
  'billing.plan.free.feature.itinerary': 'Plan dzień po dniu i mapa',
  'billing.plan.free.feature.lists': 'Listy pakowania i proste budżety',
  'billing.plan.free.feature.atlas':
    'Mapa świata, która pamięta odwiedzone kraje',
  'billing.plan.solo.name': 'Podróżnik',
  'billing.plan.solo.tagline': 'Dla osoby, która planuje wszystko',
  'billing.plan.solo.feature.trips': 'Wyjazdy bez limitu',
  'billing.plan.solo.feature.modules':
    'Każdy moduł planowania — rezerwacje, dziennik, budżety, pakowanie',
  'billing.plan.solo.feature.offline': 'Mapy offline pobrane przed odlotem',
  'billing.plan.solo.feature.export': 'Eksport do PDF i kalendarza',
  'billing.plan.crew.name': 'Ekipa',
  'billing.plan.crew.tagline': 'Dla rodzin, przyjaciół i małych zespołów',
  'billing.plan.crew.feature.members':
    'Do dziesięciu osób, rozliczane od osoby',
  'billing.plan.crew.feature.realtime':
    'Współpraca na żywo z widocznymi kursorami',
  'billing.plan.crew.feature.everything':
    'Wyjazdy bez limitu i wszystkie moduły',
  'billing.plan.crew.feature.storage':
    'Wspólne miejsce na zdjęcia i dokumenty całej grupy',

  'billing.plan.current': 'Aktualny plan',
  'billing.plan.currentBadge': 'Obecny',
  'billing.plan.popular': 'Popularny',
  'billing.plan.moveTo': 'Przejdź na {plan}',
  'billing.plan.switchYearly': 'Rozliczaj rocznie',
  'billing.plan.switchMonthly': 'Rozliczaj miesięcznie',
  'billing.plan.upgradeTo': 'Podnieś do {plan}',
  'billing.plan.changeTo': 'Zmień na {plan}',
  'billing.plan.perMemberMonth': '/ os. / mies.',
  'billing.plan.perMonth': '/ mies.',
  'billing.plan.alwaysFree': 'Zawsze darmowy, bez karty',
  'billing.plan.billedYearly': '{amount} rozliczane rocznie',
  'billing.plan.billedMonthly': '{amount} rozliczane miesięcznie',
  'billing.plan.members': 'Członkowie',
  'billing.plan.membersHint': 'Zmieniaj, kiedy chcesz — płatność idzie za tym.',
  'billing.plan.seatOption': {
    one: '{value} członek',
    few: '{value} członkowie',
    many: '{value} członków',
    other: '{value} członka',
  },

  'billing.invoices.title': 'Faktury',
  'billing.invoices.description':
    'Wszystkie rachunki tej przestrzeni, najnowsze na górze.',
  'billing.invoices.portal': 'Portal płatności',
  'billing.invoices.unavailableTitle': 'Rachunki się nie wczytują',
  'billing.invoices.unavailableBody':
    'Polar nie odpowiedział na czas z historią. Wszystko powyżej jest aktualne; pełny zapis znajdziesz w portalu płatności albo wróć tu za chwilę.',
  'billing.invoices.emptyTitle': 'Jeszcze żadnych faktur',
  'billing.invoices.emptyCustomer':
    'Pierwszy rachunek pojawi się tutaj, gdy zamknie się okres rozliczeniowy.',
  'billing.invoices.emptyNoCustomer':
    'Ta przestrzeń nigdy nie była obciążona. Wybierz płatny plan, a rachunki zaczną się tu zbierać.',
  'billing.invoices.tableLabel': 'Historia faktur',
  'billing.invoices.number': 'Faktura',
  'billing.invoices.date': 'Data',
  'billing.invoices.period': 'Okres',
  'billing.invoices.amount': 'Kwota',
  'billing.invoices.status': 'Stan',
  'billing.invoices.receipt': 'Rachunek',
  'billing.invoices.view': 'Otwórz',
  'billing.invoice.paid': 'Zapłacona',
  'billing.invoice.open': 'Do zapłaty',
  'billing.invoice.draft': 'Szkic',
  'billing.invoice.void': 'Unieważniona',
  'billing.invoice.uncollectible': 'Nieściągalna',
} satisfies TranslationOf<typeof En>

export default messages
