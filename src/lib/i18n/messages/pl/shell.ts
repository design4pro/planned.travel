/**
 * Everything the application shell says, in Polish.
 *
 * Authored from `../en/shell.ts` (`docs/SPEC.md` §8.9 — never from another
 * product's catalogue). `TranslationOf<typeof En>` is the key contract;
 * `__tests__/parity.test.ts` checks placeholders, plural branches and that no
 * value is left in English.
 *
 * **Plural.** `pl` needs `one` · `few` · `many` · `other`; `other` is a
 * fraction only, so it carries the genitive singular ("1,5 dnia").
 *
 * **Names of the modules.** `Atlas` is the world map that records where a
 * traveller has been, and Polish has no separate noun for it that a reader
 * would recognise in a nav pill, so it is named for what it is — „Mapa
 * świata”, shortened to „Mapa”. `Journey` is the travel journal, so
 * „Dziennik”; `Vacay` is time off, so „Urlopy”.
 *
 * **Gender.** Polish participles agree with their subject, and a notification
 * names a person whose gender we do not know. Every stored notification below
 * is therefore written so that no word agrees with `{actorName}` — a passive
 * ("Plan zmieniony przez {actorName}"), a verbal noun ("Rozliczenie od
 * {actorName}") or the present tense, which is genderless in Polish.
 *
 * **Etykieta sekcji na dashboardzie — 95 px**, zmierzone w Chromium na
 * `/dashboard` przy 360: licznik obok niej jest `shrink-0`, więc cała reszta
 * wiersza przypada na `.truncate`. „Twoje wyjazdy" wersalikami zajmuje
 * 104 px i zostaje ucięte, dlatego `dashboard.trips.label` to samo
 * „Wyjazdy" (57 px) — polszczyzna w nagłówkach i tak opuszcza zaimek
 * dzierżawczy, który angielski zachowuje.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Główne sekcje',
  'nav.mobile': 'Sekcje',
  'nav.dashboardLink': 'Pulpit planned.travel',
  'nav.homeLink': 'Strona główna planned.travel',
  'nav.newTrip': 'Nowy wyjazd',

  'nav.trips': 'Moje wyjazdy',
  'nav.trips.short': 'Wyjazdy',
  'nav.vacay': 'Urlopy',
  'nav.vacay.short': 'Urlopy',
  'nav.atlas': 'Mapa świata',
  'nav.atlas.short': 'Mapa',
  'nav.journey': 'Dziennik',
  'nav.journey.short': 'Dziennik',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Sekcje wyjazdu',
  'trip.nav.back': 'Wyjazdy',
  'trip.nav.share': 'Udostępnij',
  'trip.nav.shareLabel': 'Udostępnij ten wyjazd',
  'trip.tab.plan': 'Plan dnia',
  'trip.tab.transports': 'Transport',
  'trip.tab.book': 'Rezerwacje',
  'trip.tab.lists': 'Listy',
  'trip.tab.costs': 'Koszty',
  'trip.tab.files': 'Pliki',
  'trip.tab.collab': 'Współpraca',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Menu konta',
  'account.settings': 'Ustawienia',
  'account.billing': 'Plan i płatności',
  'account.admin': 'Administracja',
  'account.signOut': 'Wyloguj się',
  'account.signingOut': 'Wylogowywanie…',
  'account.signOutFailed': 'Nie udało się wylogować',
  'account.signOutFailedBody': 'Sprawdź połączenie i spróbuj ponownie.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Wygląd',
  'theme.light': 'Jasny',
  'theme.dark': 'Ciemny',
  'theme.system': 'Jak w systemie',
  'theme.state.light': 'jasny',
  'theme.state.dark': 'ciemny',
  'theme.state.system': 'jak w systemie',
  'theme.trigger': 'Motyw: {state}. Zmień motyw',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Powiadomienia, nic nieprzeczytanego',
  'bell.unread': {
    one: 'Powiadomienia, {unread} nieprzeczytane',
    few: 'Powiadomienia, {unread} nieprzeczytane',
    many: 'Powiadomienia, {unread} nieprzeczytanych',
    other: 'Powiadomienia, {unread} nieprzeczytanego',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Skrzynka',
  'inbox.title': 'Powiadomienia',
  'inbox.error': 'Skrzynka się nie wczytała',
  'inbox.allRead': 'Wszystko przeczytane',
  'inbox.unread': {
    one: '{unread} nieprzeczytana wiadomość',
    few: '{unread} nieprzeczytane wiadomości',
    many: '{unread} nieprzeczytanych wiadomości',
    other: '{unread} nieprzeczytanej wiadomości',
  },
  'inbox.markAll': 'Oznacz przeczytane',
  'inbox.markingAll': 'Oznaczanie wszystkiego jako przeczytane',
  'inbox.cleared': 'Skrzynka wyczyszczona',
  'inbox.markAllFailed': 'Nie udało się oznaczyć wszystkiego',
  'inbox.retryHint': 'Sprawdź połączenie i spróbuj ponownie.',
  'inbox.filter.all': 'Wszystko',
  'inbox.filter.unread': 'Nieprzeczytane',
  'inbox.waiting': {
    one: '{invitations} zaproszenie czeka',
    few: '{invitations} zaproszenia czekają',
    many: '{invitations} zaproszeń czeka',
    other: '{invitations} zaproszenia czeka',
  },
  'inbox.empty.title': 'Skrzynka jest pusta',
  'inbox.empty.body':
    'Zaproszenia na wyjazdy, zmiany w planach, przypomnienia o rezerwacjach i rozliczone salda — wszystko trafia tutaj.',
  'inbox.empty.action': 'Powrót do pulpitu',
  'inbox.emptyUnread.title': 'Nic nieprzeczytanego',
  'inbox.emptyUnread.body':
    'Wszystko jest przeczytane. Przejdź do Wszystko, aby zajrzeć w historię.',
  'inbox.emptyUnread.action': 'Pokaż wszystko',
  'inbox.row.new': 'Nowe',
  'inbox.row.accepted': 'Przyjęte',
  'inbox.row.declined': 'Odrzucone',
  'inbox.row.open': 'Otwórz',
  'inbox.row.markRead': 'Przeczytane',
  'inbox.row.markingRead': 'Oznaczanie jako przeczytane',
  'inbox.row.markReadFailed': 'Nie udało się tego oznaczyć',
  'inbox.preferences':
    'Wybierz, które z nich mają trafiać do skrzynki, na e-mail i na telefon.',
  'inbox.preferencesAction': 'Ustawienia powiadomień',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Masz zaproszenie na {tripTitle}',
  'notification.trip.invited.body': 'Zaproszenie wysłane przez {actorName}.',
  'notification.trip.updated.title': 'Zmiany w {tripTitle}',
  'notification.trip.updated.body': 'Plan zmieniony przez {actorName}.',
  'notification.trip.member_added.title': '{memberName} dołącza do {tripTitle}',
  'notification.trip.member_added.body':
    'Ta osoba widzi plan, rezerwacje i rozliczenia.',
  'notification.trip.member_removed.title': '{memberName} opuszcza {tripTitle}',
  'notification.trip.member_removed.body':
    'Dostęp do tego wyjazdu został zakończony.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} zaczyna się za {days} dzień',
    few: '{tripTitle} zaczyna się za {days} dni',
    many: '{tripTitle} zaczyna się za {days} dni',
    other: '{tripTitle} zaczyna się za {days} dnia',
  },
  'notification.trip.starting_soon.body':
    'Czas sprawdzić listę rzeczy i rezerwacje.',
  'notification.reservation.reminder.title': '{title} — już blisko',
  'notification.reservation.reminder.body':
    'Sprawdź godzinę i numer potwierdzenia w rezerwacji.',
  'notification.reservation.confirmed.title': '{title} — potwierdzone',
  'notification.reservation.confirmed.body':
    'Rezerwacja w {tripTitle} została oznaczona jako potwierdzona.',
  'notification.expense.added.title': 'Nowy wydatek od {actorName}',
  'notification.expense.added.body': '{title} w {tripTitle}.',
  'notification.expense.settled.title': 'Rozliczenie od {actorName}',
  'notification.expense.settled.body':
    'Saldo w {tripTitle} zostało uregulowane.',
  'notification.list.assigned.title': 'Zadanie przypisane przez {actorName}',
  'notification.list.assigned.body': '{title} w {tripTitle}.',
  'notification.collab.message.title':
    'Nowa wiadomość od {actorName} w {tripTitle}',
  'notification.collab.message.body': '„{preview}”',
  'notification.collab.poll.title': 'Trwa głosowanie w {tripTitle}',
  'notification.collab.poll.body': '„{question}”',
  'notification.organization.invited.title':
    'Masz zaproszenie do {organizationName}',
  'notification.organization.invited.body':
    'Przyjmij je, aby wejść do przestrzeni i wszystkiego, co w niej udostępnione.',
  'notification.journey.published.title': 'Opublikowano {title}',
  'notification.journey.published.body':
    'Każdy, kto ma link, może teraz czytać ten dziennik.',
  'notification.billing.plan_changed.title': 'Zmiana planu',
  'notification.billing.plan_changed.body':
    '{organizationName} korzysta teraz z planu {plan}.',
  'notification.fallback.title': 'Coś się zmieniło w Twojej przestrzeni',
  'notification.fallback.body': 'Otwórz wyjazd, aby zobaczyć co.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Pulpit się nie wczytał',
  'dashboard.blank.title': 'Tu zaczyna się Twój następny wyjazd',
  'dashboard.blank.body':
    'Utwórz wyjazd, zaznacz na mapie miejsca, które chcesz zobaczyć, a planned.travel zbuduje wokół nich plan dzień po dniu.',
  'dashboard.blank.action': 'Zaplanuj wyjazd',
  'dashboard.blank.secondary': 'Zobacz mapę świata',

  'dashboard.upNext': 'Najbliższy wyjazd',
  'dashboard.openPlan': 'Otwórz plan',
  'dashboard.hero.travellers': 'Podróżni',
  'dashboard.hero.travellersHint': 'w tej przestrzeni',
  'dashboard.hero.dates': 'Daty wyjazdu',
  'dashboard.hero.datesUnset': 'Brak',
  'dashboard.hero.datesHint': {
    one: '{days} dzień',
    few: '{days} dni',
    many: '{days} dni',
    other: '{days} dnia',
  },
  'dashboard.hero.datesMissing': 'Dodaj daty, aby zbudować dni',
  'dashboard.hero.startsIn': 'Start za',
  'dashboard.hero.started': 'Start był',
  'dashboard.hero.today': 'Dziś',
  'dashboard.hero.startUnknown': 'bez daty startu',
  'dashboard.hero.startToday': 'powodzenia w drodze',
  'dashboard.hero.startPast': {
    one: 'dzień temu',
    few: 'dni temu',
    many: 'dni temu',
    other: 'dnia temu',
  },
  'dashboard.hero.startFuture': {
    one: 'dzień',
    few: 'dni',
    many: 'dni',
    other: 'dnia',
  },
  'dashboard.hero.places': 'Miejsca',
  'dashboard.hero.placesNone': 'nic jeszcze na mapie',
  'dashboard.hero.placesHint': 'na mapie',

  'dashboard.stat.countries': 'Odwiedzone kraje',
  'dashboard.stat.countriesUnit': 'z {total}',
  'dashboard.stat.countriesNone': 'Zaznacz kraj, aby zacząć swoją mapę świata',
  'dashboard.stat.visits': {
    one: '{visits} zapisana wizyta',
    few: '{visits} zapisane wizyty',
    many: '{visits} zapisanych wizyt',
    other: '{visits} zapisanej wizyty',
  },
  'dashboard.stat.trips': 'Wyjazdy łącznie',
  'dashboard.stat.tripsCaption':
    '{planning} w planowaniu · {booked} zarezerwowanych',
  'dashboard.stat.places': 'Miejsca na mapie',
  'dashboard.stat.placesNone': 'Na mapie jeszcze nic nie ma',
  'dashboard.stat.placesAcross': {
    one: 'w {trips} wyjeździe',
    few: 'w {trips} wyjazdach',
    many: 'w {trips} wyjazdach',
    other: 'w {trips} wyjazdu',
  },
  'dashboard.stat.bookings': 'Potwierdzone rezerwacje',
  'dashboard.stat.bookingsNone': 'Brak nadchodzących rezerwacji',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} rezerwacja w drodze',
    few: '{bookings} rezerwacje w drodze',
    many: '{bookings} rezerwacji w drodze',
    other: '{bookings} rezerwacji w drodze',
  },

  'dashboard.trips.label': 'Wyjazdy',
  'dashboard.trips.all': 'Wszystkie wyjazdy',
  'dashboard.trips.empty.title': 'Jeszcze żadnych wyjazdów',
  'dashboard.trips.empty.body':
    'Wszystko, co zaplanujesz, pojawi się tutaj — najnowsze na górze.',
  'dashboard.trips.empty.action': 'Utwórz wyjazd',

  'dashboard.bookings.label': 'Nadchodzące rezerwacje',
  'dashboard.bookings.empty.title': 'Jeszcze bez rezerwacji',
  'dashboard.bookings.empty.body':
    'Potwierdzone noclegi, stoliki i bilety pojawią się tutaj, gdy zbliżą się ich daty.',

  'dashboard.pipeline.label': 'Etapy wyjazdów',
  'dashboard.pipeline.empty':
    'Nic w toku. Pierwszy wyjazd rozbije to na etapy.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} ulubiony',
    few: '{favourites} ulubione',
    many: '{favourites} ulubionych',
    other: '{favourites} ulubionego',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} zarchiwizowany wyjazd',
    few: '{archived} zarchiwizowane wyjazdy',
    many: '{archived} zarchiwizowanych wyjazdów',
    other: '{archived} zarchiwizowanego wyjazdu',
  },

  'dashboard.storage.label': 'Miejsce',
  'dashboard.storage.count': '{used} z {limit}',
  'dashboard.storage.files': {
    one: '{files} plik ze wszystkich wyjazdów, razem ze zdjęciami i biletami.',
    few: '{files} pliki ze wszystkich wyjazdów, razem ze zdjęciami i biletami.',
    many: '{files} plików ze wszystkich wyjazdów, razem ze zdjęciami i biletami.',
    other:
      '{files} pliku ze wszystkich wyjazdów, razem ze zdjęciami i biletami.',
  },
  'dashboard.storage.more': 'Mało miejsca?',
  'dashboard.storage.plans': 'Zobacz plany',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Konsola administratora się nie wczytała',
  'admin.denied.title': 'To miejsce jest tylko dla administratorów przestrzeni',
  'admin.denied.body':
    'Jeśli potrzebujesz tu wejść, poproś właściciela lub administratora tej przestrzeni o zmianę Twojej roli.',
  'admin.denied.action': 'Powrót do pulpitu',
  'admin.eyebrow': 'Administracja przestrzeni',
  'admin.description': 'Abonament {plan} · utworzono {date}',
  'admin.createdUnknown': 'niedawno',
  'admin.workspaceSettings': 'Ustawienia przestrzeni',
  'admin.billing': 'Plan i płatności',

  'admin.invitations.title': {
    one: '{invitations} zaproszenie wciąż otwarte',
    few: '{invitations} zaproszenia wciąż otwarte',
    many: '{invitations} zaproszeń wciąż otwartych',
    other: '{invitations} zaproszenia wciąż otwartego',
  },
  'admin.invitations.body':
    'Każde otwarte zaproszenie zajmuje jedno z miejsc, które opłaca Twój plan.',
  'admin.invitations.action': 'Przejrzyj zaproszenia',

  'admin.stat.members': 'Członkowie',
  'admin.stat.membersCaption': {
    one: '{invitations} zaproszenie w toku',
    few: '{invitations} zaproszenia w toku',
    many: '{invitations} zaproszeń w toku',
    other: '{invitations} zaproszenia w toku',
  },
  'admin.stat.storage': 'Miejsce',
  'admin.stat.storageUnit': 'z {limit}',
  'admin.stat.storageUnlimited': 'bez limitu',
  'admin.stat.storageCaption': 'Pliki, zdjęcia i eksporty',
  'admin.stat.audit': 'Wpisy audytu',
  'admin.stat.auditCaption': 'Najnowsza aktywność jest poniżej',
  'admin.stat.plan': 'Abonament',
  'admin.stat.planCaption': 'Limity pilnowane są na granicy repozytoriów',

  'admin.quotas.label': 'Limity',
  'admin.quotas.count': {
    one: '{metrics} miara',
    few: '{metrics} miary',
    many: '{metrics} miar',
    other: '{metrics} miary',
  },
  'admin.quotas.unlimited': 'Bez limitu',
  'admin.quotas.value': '{used} z {limit}',

  'admin.members.label': 'Członkowie',
  'admin.members.table': 'Członkowie tej przestrzeni',
  'admin.members.person': 'Osoba',
  'admin.members.role': 'Rola',
  'admin.members.joined': 'Data dołączenia',

  'admin.activity.label': 'Ostatnia aktywność',
  'admin.activity.empty.title': 'Nic jeszcze nie zostało zapisane',
  'admin.activity.empty.body':
    'Każdy istotny zapis trafia do dziennika audytu w chwili, w której się dzieje.',
  'admin.activity.workspace': 'sama przestrzeń',
  'admin.actions.label': 'Najczęstsze działania',
  'admin.actions.count': {
    one: '{actions} działanie',
    few: '{actions} działania',
    many: '{actions} działań',
    other: '{actions} działania',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Szkic',
  'tripStatus.planning': 'W planowaniu',
  'tripStatus.booked': 'Zarezerwowany',
  'tripStatus.active': 'Aktywny',
  'tripStatus.completed': 'Zakończony',
  'tripStatus.archived': 'Zarchiwizowany',

  'bookingStatus.none': 'Bez rezerwacji',
  'bookingStatus.pending': 'W toku',
  /**
   * The dashboard's reservation rows put this chip beside a truncating date
   * line, so every pixel it takes comes straight off that line. At 360px
   * `Potwierdzona` measured 90px and clipped the Sunday row; `Przyjęta` is the
   * natural answer to `W toku` anyway — the booking has been accepted.
   */
  'bookingStatus.confirmed': 'Przyjęta',
  'bookingStatus.cancelled': 'Anulowana',
  'bookingStatus.completed': 'Zrealizowana',

  'bookingType.accommodation': 'Nocleg',
  'bookingType.restaurant': 'Stolik',
  'bookingType.activity': 'Atrakcja',
  'bookingType.tour': 'Wycieczka',
  'bookingType.ticket': 'Bilet',
  'bookingType.transport': 'Przejazd',
  'bookingType.other': 'Rezerwacja',

  'role.owner': 'Właściciel',
  'role.admin': 'Administrator',
  'role.member': 'Członek',

  'metric.trips': 'Wyjazdy',
  'metric.places': 'Miejsca',
  'metric.members': 'Członkowie',
  'metric.files': 'Pliki',
  'metric.storage_bytes': 'Miejsce',
  'metric.collections': 'Kolekcje',
  'metric.journeys': 'Dzienniki',

  /* -------------------------------------------------------------- failures */
  'error.title': 'To się nie wczytało',
  'error.body':
    'Nic nie zginęło. Spróbuj ponownie, a jeśli będzie się powtarzać — prześlij nam szczegóły z dołu strony.',
  'error.retry': 'Spróbuj ponownie',
  'error.dashboard': 'Powrót do pulpitu',
  'error.reported': 'Wiemy o tym i już się temu przyglądamy.',
  'error.reference': 'Numer zgłoszenia',
  'error.feedback.open': 'Napisz nam, co się stało',
  'error.feedback.label': 'Co robiłeś, kiedy to się stało?',
  'error.feedback.send': 'Wyślij',
  'error.feedback.sent': 'Dziękujemy — to nam bardzo pomaga.',
  'error.feedback.failed':
    'Nie udało się wysłać. Numer zgłoszenia powyżej i tak do nas trafia.',
  'error.root': 'Zjechaliśmy z trasy',
  'error.session': 'Twój dostęp do przestrzeni się zmienił',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Zgłoś problem',
  'feedback.formTitle': 'Zgłoś problem',
  'feedback.messageLabel': 'Co jest nie tak albo co należy zmienić?',
  'feedback.messagePlaceholder':
    'Co miało się wydarzyć, a co się stało zamiast tego?',
  'feedback.emailLabel': 'Adres e-mail',
  'feedback.emailPlaceholder': 'anna@example.com',
  'feedback.isRequiredLabel': '(wymagane)',
  'feedback.submitButtonLabel': 'Wyślij zgłoszenie',
  'feedback.cancelButtonLabel': 'Anuluj',
  'feedback.confirmButtonLabel': 'Potwierdź',
  'feedback.addScreenshotButtonLabel': 'Dodaj zrzut ekranu',
  'feedback.removeScreenshotButtonLabel': 'Usuń zrzut ekranu',
  'feedback.highlightToolText': 'Zaznacz',
  'feedback.hideToolText': 'Ukryj',
  'feedback.successMessageText': 'Dziękujemy — zgłoszenie do nas dotarło.',
  'feedback.errorEmptyMessageText':
    'Najpierw napisz zdanie — puste zgłoszenie nic nam nie mówi.',
  'feedback.errorTimeoutText':
    'To trwa zbyt długo i nie możemy potwierdzić, że zgłoszenie zostało wysłane.',
  'feedback.errorForbiddenText':
    'Ta strona nie ma uprawnień do wysyłania zgłoszeń.',
  'feedback.errorGenericText':
    'Nie udało się wysłać. Sprawdź połączenie i to, czy nie przeszkadza blokada reklam.',

  'notFound.eyebrow': 'Błąd 404',
  'notFound.title': 'Tej strony nie ma na mapie',
  'notFound.body':
    'Link mógł się przedawnić albo wyjazd, na który wskazywał, został przeniesiony lub usunięty.',
  'notFound.trips': 'Wszystkie wyjazdy',
  'notFound.rootBody':
    'Szukaliśmy na całej trasie. Adres może mieć literówkę albo strona ruszyła dalej.',
  'notFound.home': 'Powrót na stronę główną',
  'notFound.plans': 'Zobacz plany',

  'session.noWorkspace':
    'Twoje konto nie jest jeszcze przypisane do żadnej przestrzeni. Wyloguj się i zaloguj ponownie, aby dokończyć konfigurację.',
  'session.membershipRemoved':
    'Twoje członkostwo w tej przestrzeni zostało usunięte.',
} satisfies TranslationOf<typeof En>

export default messages
