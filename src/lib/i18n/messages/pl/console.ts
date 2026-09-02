/**
 * Wszystko, co mówi konsola platformy, po polsku.
 *
 * Napisane z `../en/console.ts` (`docs/SPEC.md` §9). Plik angielski jest schematem;
 * `__tests__/parity.test.ts` sprawdza symbole zastępcze, gałęzie liczby mnogiej i to, że nie
 * zostało tu nic po angielsku.
 *
 * **Liczba mnoga.** `pl` potrzebuje `one` · `few` · `many` · `other`; `other` osiąga się wyłącznie
 * ułamkiem i przyjmuje dopełniacz liczby pojedynczej.
 *
 * **Dwie skale ról nigdy się nie mieszają** (§5). Na platformie są „administrator”, „kurator”
 * i „użytkownik”; w przestrzeni roboczej — „właściciel”, „administrator” i „członek”. To samo
 * angielskie `Admin` pada w obu, więc różnicę niesie zdanie wokół niego, nie samo słowo.
 *
 * **„Suspend” to zawieszenie, nie blokada.** Konto zawieszone da się odwiesić, a rejestr audytu
 * zapisuje jedno i drugie; „zablokowane” sugerowałoby stan trwały, którego produkt nie ma.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* --------------------------------------------------------------- sekcje -- */

  'nav.label': 'Sekcje konsoli',
  'nav.overview': 'Przegląd',
  'nav.overview.description': 'Platforma w skrócie',
  'nav.accounts': 'Konta',
  'nav.accounts.description': 'Role, zawieszenia i sesje',
  'nav.runs': 'Przebiegi agentów',
  'nav.runs.description': 'Co buduje flota sandcastle',

  /* --------------------------------------------------------------- powłoka -- */

  'shell.eyebrow': 'Platforma',
  'shell.title': 'Konsola',
  'shell.description':
    'Sam produkt — konta, uprawnienia i wspólny katalog miejsc',
  'shell.signedInAs': 'Zalogowano jako',
  'shell.error.title': 'Konsola się nie wczytała',
  'shell.notFound.title': 'Nie ma takiego konta',
  'shell.notFound.body':
    'Nic na platformie nie ma tego identyfikatora. Konto mogło zostać usunięte po utworzeniu odnośnika albo adres został przepisany z błędem.',
  'shell.allAccounts': 'Wszystkie konta',
  'shell.overview': 'Przegląd konsoli',

  'failure.fallback': 'Nie udało się wykonać działania. Spróbuj za chwilę.',

  /* -------------------------------------------------------------- przegląd -- */

  'overview.error.title': 'Przegląd się nie wczytał',
  'overview.standing.title': 'Twoje uprawnienia na platformie',
  'overview.standing.body':
    'Konta, sesje i wcielanie się należą do administratora platformy, więc konsola pokazuje ci katalog i nic poza nim.',
  'overview.stat.accounts': 'Konta',
  'overview.stat.accounts.caption': {
    one: 'Jedno z nich pełni rolę na platformie',
    few: '{staff} z nich pełnią rolę na platformie',
    many: '{staff} z nich pełni rolę na platformie',
    other: '{staff} z nich pełni rolę na platformie',
  },
  'overview.stat.admins': 'Administratorzy',
  'overview.stat.admins.caption': 'Pełna władza nad kontami i sesjami',
  'overview.stat.curators': 'Kuratorzy',
  'overview.stat.curators.caption': 'Tylko katalog — nigdy konta',
  'overview.stat.suspended': 'Zawieszone',
  'overview.stat.suspended.none': 'Nikt nie jest odcięty',
  'overview.stat.suspended.some':
    'Wylogowane wszędzie, dopóki zawieszenie nie zostanie zdjęte',
  'overview.stat.suspended.review': 'Przejrzyj je',
  'overview.newest.label': 'Najnowsze konta',
  'overview.newest.empty.title': 'Jeszcze żadnych kont',
  'overview.newest.empty.body':
    'Pierwsza osoba, która się zarejestruje, pojawi się tutaj.',
  'overview.catalogue.label': 'Katalog według stanu',
  'overview.catalogue.empty.title': 'Wspólny katalog jeszcze nie działa',
  'overview.catalogue.empty.body':
    'Kiedy powstanie potok zasilający, ten panel policzy każde miejsce we wspólnym katalogu jako szkic, w recenzji albo opublikowane — a każda liczba otworzy listę, która za nią stoi.',
  'overview.scraping.label': 'Przebiegi zbierania',
  'overview.scraping.empty.title': 'Żadne źródło nie zostało uruchomione',
  'overview.scraping.empty.body':
    'Źródła są zbierane co tydzień. Gdy skończy się pierwszy przebieg, pojawi się tu pięć ostatnich wraz z tym, co każdy z nich wciągnął, zmienił i odrzucił.',

  /* ------------------------------------------------------------- skala ról -- */

  'role.admin': 'Administrator',
  'role.admin.summary':
    'Pełna władza na platformie: konta, role, zawieszenia, sesje i wcielanie się.',
  'role.admin.holds.accounts': 'Zakładanie kont i nadawanie ról platformy',
  'role.admin.holds.bans': 'Zawieszanie kont i zdejmowanie zawieszeń',
  'role.admin.holds.sessions': 'Unieważnianie sesji i ustawianie haseł',
  'role.admin.holds.impersonate': 'Wcielenie się w konto na piętnaście minut',
  'role.admin.holds.curation': 'Wszystko, co wolno kuratorowi',
  'role.admin.withheld.admins':
    'Wcielenie się w innego administratora platformy',
  'role.curator': 'Kurator',
  'role.curator.summary':
    'Katalog, pakiety, źródła i moderacja udostępnień. Nic, co dotyka kont.',
  'role.curator.holds.places':
    'Czytanie, zapis i publikowanie miejsc z katalogu',
  'role.curator.holds.packs': 'Czytanie, zapis i publikowanie pakietów miejsc',
  'role.curator.holds.sources': 'Czytanie i uruchamianie źródeł katalogu',
  'role.curator.holds.shares':
    'Przeglądanie i unieważnianie udostępnionych odnośników',
  'role.curator.withheld.accounts': 'Cokolwiek, co dotyka konta albo sesji',
  'role.curator.withheld.tokens':
    'Wydawanie i unieważnianie poświadczeń maszynowych',
  'role.user': 'Użytkownik',
  'role.user.summary':
    'Żadnego dostępu do platformy. Tak wygląda niemal każdy.',
  'role.user.withheld.everything': 'Każde uprawnienie platformy, bez wyjątku',

  /* ---------------------------------------------------------- jedno konto -- */

  'identity.you': 'To ty',
  'status.active': 'Aktywne',
  'status.suspended': 'Zawieszone',
  'status.permanent': 'Bezterminowo',
  'status.until': 'Do {date}',
  'status.unverified': 'Niepotwierdzony',
  'device.on': '{browser} na {platform}',
  'device.unrecognised': 'Nierozpoznane urządzenie',

  /* --------------------------------------------------------- lista kont -- */

  'users.error.title': 'Lista kont się nie wczytała',
  'users.total': 'łącznie {total}',
  'users.loading': 'Wczytywanie kont',
  'users.table.label': 'Konta platformy',
  'users.search.label': 'Szukaj kont',
  'users.search.email': 'Szukaj po adresie e-mail',
  'users.search.name': 'Szukaj po nazwie',
  'users.search.column': 'W której kolumnie szukać',
  'users.search.submit': 'Szukaj',
  'users.field.email': 'E-mail',
  'users.field.name': 'Nazwa',
  'users.filter.role.label': 'Filtruj według roli platformy',
  'users.filter.role.any': 'Dowolna rola',
  'users.filter.role.admin': 'Administratorzy',
  'users.filter.role.curator': 'Kuratorzy',
  'users.filter.status.label': 'Filtruj według stanu konta',
  'users.filter.status.any': 'Dowolny stan',
  'users.filter.hint': 'Zawężaj rolą albo stanem — po jednym naraz.',
  'users.column.account': 'Konto',
  'users.column.role': 'Rola platformy',
  'users.column.status': 'Stan',
  'users.column.joined': 'Dołączenie',
  'users.column.actions': 'Działania',
  'users.joined': 'Dołączył(a) {date}',
  'users.pastEnd.title': 'Ta strona jest poza końcem',
  'users.pastEnd.body': {
    one: 'W tym widoku jest jedno konto, a strona 1 to jedyna, jaką ma.',
    few: 'W tym widoku są {total} konta, czyli {pages}. Strona {page} leży poza nimi.',
    many: 'W tym widoku jest {total} kont, czyli {pages}. Strona {page} leży poza nimi.',
    other:
      'W tym widoku jest {total} konta, czyli {pages}. Strona {page} leży poza nimi.',
  },
  'users.pastEnd.pages': {
    one: 'jedna strona',
    few: '{pages} strony',
    many: '{pages} stron',
    other: '{pages} strony',
  },
  'users.pastEnd.back': 'Wróć na pierwszą stronę',
  'users.empty.filtered.title': 'Nic nie pasuje do tych filtrów',
  'users.empty.filtered.body':
    'Żadne konto na platformie nie odpowiada temu wyszukiwaniu. Poszerz je albo wyczyść filtry, żeby zobaczyć wszystkich.',
  'users.empty.title': 'Nie ma kont do pokazania',
  'users.empty.body':
    'Ten widok jest pusty. Nic nie jest odfiltrowane, więc nie ma tu czego poszerzać.',

  /* --------------------------------------------------------- ekran konta -- */

  'account.error.title': 'To konto się nie wczytało',
  'account.loading': 'Wczytywanie konta',
  'account.meta.lastChange': 'Ostatnia zmiana',
  'account.meta.id': 'Identyfikator konta',
  'account.banned.title': 'To konto jest zawieszone',
  'account.banned.noReason': 'Przy zawieszeniu nie zapisano powodu.',
  'account.banned.permanent':
    ' Obowiązuje, dopóki administrator go nie zdejmie.',
  'account.banned.until': ' Wygasa samo {date}.',
  'account.banned.untilUnknown': 'w dniu wygaśnięcia',
  'account.authority.label': 'Uprawnienia na platformie',
  'account.authority.may': 'Może',
  'account.authority.mayNot': 'Nie może',
  'account.authority.none': 'Nic na platformie.',
  'account.workspaces.label': 'Przestrzenie robocze',
  'account.workspaces.truncated':
    'To konto należy do większej liczby przestrzeni niż {listed} wypisane tutaj.',
  'account.workspaces.empty.title': 'W żadnej przestrzeni',
  'account.workspaces.empty.body':
    'To konto nie należy jeszcze do żadnej przestrzeni roboczej. Pierwsza powstaje przy pierwszym logowaniu, a każda, do której konto zostanie zaproszone, pojawi się tutaj.',
  'account.workspaces.column.workspace': 'Przestrzeń robocza',
  'account.workspaces.column.role': 'Rola',
  'account.workspaces.column.plan': 'Abonament',
  'account.subscription.label': 'Abonament',
  'account.subscription.free.title': 'Na planie darmowym',
  'account.subscription.free.body':
    'Przestrzeń robocza, której to konto jest właścicielem, nigdy nie przeszła przez płatność, więc nie ma zapisu abonamentu i działa na limitach planu darmowego.',
  'account.subscription.none.title': 'Nic nie obciąża tego konta',
  'account.subscription.none.body':
    'To konto nie jest właścicielem żadnej przestrzeni roboczej. Członek cudzej przestrzeni nie jest tym, komu ta przestrzeń wystawia rachunek, więc nie ma tu czego zbierać.',
  'account.subscription.endsAtClose': 'Kończy się z okresem',
  'account.subscription.seats': 'Miejsca',
  'account.subscription.seatsValue': '{used} z {limit}',
  'account.subscription.ends': 'Koniec',
  'account.subscription.renews': 'Odnowienie',
  'account.sessions.label': 'Aktywne sesje',
  'account.sessions.truncated':
    'To konto ma więcej sesji, niż wypisuje jedno zapytanie. Unieważnij wszystkie sesje z menu działań, żeby mieć pewność, że żadna nie została.',
  'account.sessions.empty.title': 'Wylogowane wszędzie',
  'account.sessions.empty.body':
    'To konto nie ma żadnej niewygasłej sesji. Pojawi się tutaj w chwili, gdy zaloguje się ponownie.',
  'account.sessions.column.device': 'Urządzenie',
  'account.sessions.column.address': 'Adres',
  'account.sessions.column.started': 'Początek',
  'account.sessions.column.expires': 'Wygasa',
  'account.sessions.impersonated': 'Powstała z wcielenia się',
  'account.sessions.noAddress': 'Nie zapisano',
  'account.sessions.noAddressLong': 'Adresu nie zapisano',
  'account.sessions.when': 'Początek {started} · wygasa {expires}',
  'account.audit.label': 'Historia audytu',
  'account.audit.truncated':
    'Rejestr ma więcej wpisów niż te. Ślad audytu platformy jest tylko dopisywany i przechowywany przez czterysta dni.',
  'account.audit.empty.title': 'Nikt nic z tym kontem nie zrobił',
  'account.audit.empty.body':
    'Każda zmiana roli, zawieszenie, ustawienie hasła, unieważnienie sesji i wcielenie się są zapisywane tutaj wraz z nazwiskiem operatora. Tego konta nikt nie dotknął.',

  /* --------------------------------------------- skala przestrzeni roboczej -- */

  'workspace.role.owner': 'Właściciel',
  'workspace.role.admin': 'Administrator',
  'workspace.role.member': 'Członek',
  'plan.free': 'Darmowy',
  'plan.starter': 'Startowy',
  'plan.pro': 'Zawodowy',
  'plan.business': 'Firmowy',
  'subscription.trialing': 'Okres próbny',
  'subscription.active': 'Aktywny',
  'subscription.pastDue': 'Po terminie',
  'subscription.canceled': 'Anulowany',
  'subscription.incomplete': 'Niedokończony',
  'subscription.expired': 'Wygasły',
  'subscription.unpaid': 'Nieopłacony',
  'subscription.paused': 'Wstrzymany',

  /* ------------------------------------------------------- rejestr audytu -- */

  'audit.action.created': 'Konto założone',
  'audit.action.updated': 'Zmieniono dane konta',
  'audit.action.roleChanged': 'Zmieniono rolę platformy',
  'audit.action.banned': 'Konto zawieszone',
  'audit.action.unbanned': 'Zawieszenie zdjęte',
  'audit.action.deleted': 'Konto usunięte',
  'audit.action.passwordSet': 'Hasło ustawione przez administratora',
  'audit.action.emailSet': 'Zmieniono adres e-mail',
  'audit.action.impersonationStarted': 'Rozpoczęto wcielenie się',
  'audit.action.impersonationEnded': 'Zakończono wcielenie się',
  'audit.action.sessionRevoked': 'Unieważniono sesję',
  'audit.action.sessionRevokedAll': 'Unieważniono wszystkie sesje',
  'audit.actor.system': 'Sama platforma',
  'audit.actor.system.detail': 'automatycznie',
  'audit.actor.agent': 'Poświadczenie maszynowe',
  'audit.actor.agent.detail': 'token MCP',
  'audit.actor.deleted': 'Usunięte konto',
  'audit.actorBadge': 'Wtedy: {role}',
  'audit.field.name': 'Nazwa',
  'audit.field.email': 'Adres e-mail',
  'audit.field.emailVerified': 'E-mail potwierdzony',
  'audit.field.role': 'Rola platformy',
  'audit.field.banned': 'Zawieszone',
  'audit.field.banReason': 'Powód',
  'audit.field.banExpiresAt': 'Koniec zawieszenia',
  'audit.field.revoked': 'Zakończone sesje',
  'audit.field.impersonating': 'Wciela się w',
  'audit.field.impersonatedBy': 'Wcielił się',
  'audit.field.expiresAt': 'Sesja wygasa',
  'audit.field.targetRole': 'Ich rola platformy',
  'audit.field.sessionId': 'Sesja',
  'audit.value.yes': 'tak',
  'audit.value.no': 'nie',
  'audit.value.cleared': 'wyczyszczono',
  'audit.became': 'zmieniono na',

  /* --------------------------------------------------------------- okna -- */

  'dialog.cancel': 'Anuluj',

  'create.button': 'Nowe konto',
  'create.title': 'Załóż konto',
  'create.body':
    'Adres nie jest potwierdzany i nie wychodzi żaden list — hasło przekaż sam(a).',
  'create.confirm': 'Załóż konto',
  'create.name.placeholder': 'Anna Kowalska',
  'create.email': 'Adres e-mail',
  'create.email.placeholder': 'anna@planned.travel',
  'create.password': 'Hasło',
  'create.password.hint':
    'Na tyle długie, żeby było frazą. Konto może je potem zmienić.',
  'create.done': 'Konto założone',
  'create.done.body': '{email} może się zalogować hasłem, które ustawiono.',

  'action.menu.label': 'Działania dla {name}',
  'action.group.account': 'Konto',
  'action.group.credentials': 'Poświadczenia',

  'action.role.item': 'Zmień rolę platformy',
  'action.role.self':
    'Nie na własnym koncie — odebranie sobie roli może zostawić platformę bez administratora.',
  'action.role.body':
    'Co {name} może robić na samej platformie. Członkostwo w przestrzeni roboczej to osobne słownictwo i nie zmienia się tutaj.',
  'action.role.confirm': 'Zapisz rolę',
  'action.role.current': 'Obecna',
  'action.role.done': 'Rola platformy zaktualizowana',
  'action.role.done.body': '{name} pełni teraz na platformie rolę: {role}.',

  'action.impersonate.item': 'Wciel się',
  'action.impersonate.self':
    'Nie ma w kogo się wcielić — to twoje własne konto.',
  'action.impersonate.banned':
    'Konto jest zawieszone, więc nie ma sesji, którą można by przywdziać.',
  'action.impersonate.admin':
    'Żadna rola na platformie nie może wcielić się w administratora, twoja też nie.',
  'action.impersonate.title': 'Działaj jako {name}',
  'action.impersonate.body':
    'Zobaczysz produkt dokładnie tak, jak widzi go to konto, przez piętnaście minut.',
  'action.impersonate.confirm': 'Zacznij wcielenie',
  'action.impersonate.note.bar':
    'Pasek ostrzegawczy zostaje na każdym ekranie, dopóki tego nie zakończysz, i nie da się go zamknąć.',
  'action.impersonate.note.platform':
    'Działania platformy są niedostępne, kiedy działasz jako ktoś inny — konsola też.',
  'action.impersonate.note.audit':
    'Początek i koniec trafiają do śladu audytu platformy razem z twoim nazwiskiem.',

  'action.password.item': 'Ustaw hasło',
  'action.password.title': 'Ustaw hasło dla {name}',
  'action.password.body':
    'Użyj tego, żeby odzyskać zablokowane konto albo odciąć napastnika od przejętego.',
  'action.password.confirm': 'Ustaw hasło',
  'action.password.field': 'Nowe hasło',
  'action.password.hint.self':
    'Wszystkie sesje kończą się przy zapisie — twoja także.',
  'action.password.hint': 'Wszystkie sesje tego konta kończą się przy zapisie.',
  'action.password.done': 'Hasło ustawione',
  'action.password.done.body':
    '{name} zostaje wylogowany(-a) ze wszystkich urządzeń.',

  'action.sessions.item': 'Unieważnij wszystkie sesje',
  'action.sessions.body.self':
    'To wyloguje cię ze wszystkich urządzeń, także z tego, na którym to czytasz.',
  'action.sessions.body':
    '{name} zostaje wylogowany(-a) ze wszystkich urządzeń i musi zalogować się ponownie.',
  'action.sessions.confirm': 'Unieważnij sesje',
  'action.sessions.done': 'Sesje unieważnione',
  'action.sessions.done.body': {
    one: 'Zakończono jedną sesję.',
    few: 'Zakończono {revoked} sesje.',
    many: 'Zakończono {revoked} sesji.',
    other: 'Zakończono {revoked} sesji.',
  },

  'action.ban.item': 'Zawieś konto',
  'action.ban.self':
    'Nie na własnym koncie — zawieszenie siebie odbiera ci drogę powrotną.',
  'action.ban.title': 'Zawieś konto {name}',
  'action.ban.body':
    'Wszystkie sesje kończą się natychmiast, a konto nie zaloguje się ponownie, dopóki zawieszenie nie zostanie zdjęte albo nie wygaśnie.',
  'action.ban.confirm': 'Zawieś konto',
  'action.ban.reason': 'Powód',
  'action.ban.reason.hint':
    'Trzymany w śladzie audytu platformy przez trzynaście miesięcy i pokazywany wyłącznie administratorowi.',
  'action.ban.reason.placeholder':
    'Powtarzające się zgłoszenia nadużyć z trzech przestrzeni',
  'action.ban.duration': 'Czas trwania',
  'action.ban.duration.label': 'Czas zawieszenia',
  'action.ban.duration.permanent.body':
    'Obowiązuje, dopóki administrator świadomie go nie zdejmie.',
  'action.ban.duration.day': '24 godziny',
  'action.ban.duration.day.body':
    'Dość długo, żeby przerwać, dość krótko, żeby było interwencją.',
  'action.ban.duration.week': '7 dni',
  'action.ban.duration.week.body': 'Tydzień na odpowiedź na skargę.',
  'action.ban.duration.month': '30 dni',
  'action.ban.duration.month.body': 'Miesiąc wymuszonej ciszy.',
  'action.ban.duration.quarter': '90 dni',
  'action.ban.duration.quarter.body':
    'Najdłużej, ile oferuje konsola. Powyżej — zawieś bezterminowo.',
  'action.ban.done': 'Konto zawieszone',
  'action.ban.done.body':
    '{name} zostaje wylogowany(-a) wszędzie i nie zaloguje się ponownie.',

  'action.unban.item': 'Zdejmij zawieszenie',
  'action.unban.title': 'Zdejmij zawieszenie z konta {name}',
  'action.unban.body':
    'Konto zaloguje się ponownie przy następnej próbie. Żadna wcześniejsza sesja nie wraca.',
  'action.unban.confirm': 'Zdejmij zawieszenie',
  'action.unban.done': 'Zawieszenie zdjęte',
  'action.unban.done.body':
    '{name} może się znowu zalogować. Żadna sesja nie została przywrócona.',

  'action.delete.item': 'Usuń konto',
  'action.delete.self': 'Nie na własnym koncie — nie ma stamtąd powrotu.',
  'action.delete.title': 'Usuń konto {name}',
  'action.delete.body':
    'Konto, jego sesje i każde przypisane do niego poświadczenie zostają usunięte. Tego nie da się cofnąć.',
  'action.delete.confirm': 'Usuń konto',
  'action.delete.note':
    'Treści przestrzeni roboczej stworzone przez tę osobę zostają przy przestrzeni, która jest ich właścicielem. Zawieszenie konta zamiast usunięcia zachowuje zapis, a odbiera dostęp.',
  'action.delete.done': 'Konto usunięte',
  'action.delete.done.body':
    '{name} i wszystko, co było z kontem związane, zniknęło.',

  'session.revoke.label': 'Zakończ sesję na urządzeniu {device}',
  'session.revoke.title': 'Zakończ tę sesję',
  'session.revoke.body':
    'Urządzenie {device} musi zalogować się ponownie przy następnym żądaniu. Jeśli to sesja, w której to czytasz, wylogujesz się razem z nią.',
  'session.revoke.confirm': 'Zakończ sesję',
  'session.revoke.done': 'Sesja zakończona',
  'session.revoke.done.body':
    'Urządzenie musi zalogować się ponownie przy następnym żądaniu.',

  /* ---------------------------------------------------- przebiegi agentów -- */

  'runs.error.title': 'Rejestr przebiegów nie odpowiedział',
  'runs.origin.local': 'Lokalnie',
  'runs.origin.githubActions': 'Akcje GitHuba',
  'runs.stat.live': 'Trwające przebiegi',
  'runs.stat.live.none': 'Nic się w tej chwili nie buduje',
  'runs.stat.live.some': 'Bicie serca wobec pięciominutowej dzierżawy',
  'runs.stat.issues': 'Zajęte zgłoszenia',
  'runs.stat.issues.caption':
    'Dzierżawione po jednym na przebieg, wraz z nadrzędnymi i podrzędnymi',
  'runs.stat.orphans': 'Osierocone gałęzie',
  'runs.stat.orphans.none': 'Żadna praca nie leży bez właściciela',
  'runs.stat.orphans.some':
    'Commity z przebiegu, który się zatrzymał, czekające na przejęcie',
  'runs.live.empty.title': 'Nie zarejestrowano żadnego przebiegu',
  'runs.live.empty.body':
    'Przebieg pojawia się tutaj w chwili rejestracji — z tej maszyny, z innej albo z modułu uruchomieniowego GitHub Actions — razem ze zgłoszeniami, które zajął.',
  'runs.holds.nothing': 'nic nie zajmuje',
  'runs.holds': 'zajmuje {issues}',
  'runs.uptime': 'działa {elapsed} · {lease}',
  'runs.lease.expired': 'wygasła',
  'runs.lease.left': 'zostało {elapsed}',
  'runs.wip.label': 'Praca w toku',
  'runs.wip.empty.title': 'Żadna gałąź nie niesie pracy',
  'runs.wip.empty.body':
    'Przebieg zapisuje swoją gałąź, gdy tylko ma na niej commity, żeby po jego śmierci kolejny, który zajmie to zgłoszenie, dostał tę pracę zamiast zaczynać od nowa.',
  'runs.wip.orphaned': 'Osierocona',
  'runs.wip.meta': {
    one: '{commits} commit · {elapsed} temu',
    few: '{commits} commity · {elapsed} temu',
    many: '{commits} commitów · {elapsed} temu',
    other: '{commits} commita · {elapsed} temu',
  },
  'runs.recent.label': 'Ostatnio zakończone',
  'runs.recent.empty.title': 'Żaden przebieg jeszcze się nie zakończył',
  'runs.recent.empty.body':
    'Trzymane jest tu pięćdziesiąt ostatnich przebiegów wraz z tym, jak każdy się skończył.',
  'runs.ago': '{elapsed} temu',
  'runs.notCoordinator.title': 'To wdrożenie nie koordynuje floty',
  'runs.notCoordinator.body':
    'Rejestr przebiegów jest podpięty wyłącznie na staging, i to celowo: drugi rejestr pozwoliłby dwóm flotom sądzić, że każda trzyma zaległości — a temu właśnie ma zapobiegać. Flotę czytaj na staging.',
  'nav.providers': 'Dostawcy',
  'nav.providers.description': 'Wywołania na zewnątrz i ich pułapy',
  'providers.error.title': 'Nie udało się odczytać liczników dostawców',
  'providers.list.label': 'Usługi',
  'providers.status.planned': 'Niepodpięta',
  'providers.status.planned.description':
    'Nic jeszcze nie woła tej usługi, więc nie ma czego liczyć. Jest na liście po to, by pułap uzgodnić przed pierwszym wywołaniem, a nie po pierwszej fakturze.',
  'providers.policy.allow': 'Przepuszcza ponad pułap',
  'providers.policy.block': 'Odmawia po przekroczeniu',
  'providers.badge.blocked': {
    one: 'Jedno wywołanie odrzucone',
    few: '{calls} wywołania odrzucone',
    many: '{calls} wywołań odrzuconych',
    other: '{calls} wywołania odrzucone',
  },
  'providers.limit.none': 'Brak uzgodnionego pułapu · {used} w tym miesiącu',
  'providers.limit.value': '{used} z {limit}',
  'providers.limit.window.day': 'Dzisiaj',
  'providers.limit.window.month': 'W tym miesiącu',
  'providers.measuring.none': 'Nic jeszcze nie zmierzono',
  'providers.measuring.since': 'Mierzymy od {date}',
  'providers.stat.calls': 'Wywołania w tym miesiącu',
  'providers.stat.calls.caption': 'We wszystkich podpiętych usługach',
  'providers.stat.errors': 'Nieudane wywołania',
  'providers.stat.errors.caption':
    'Liczone także jako wywołania, bo większość dostawców je nalicza',
  'providers.stat.nearLimit': 'Blisko pułapu',
  'providers.stat.nearLimit.caption': 'Usługi powyżej progu ostrzegawczego',
  'providers.stat.blocked': 'Odrzucone wywołania',
  'providers.stat.blocked.none': 'Nic nie zostało odrzucone',
  'providers.stat.blocked.some': 'Zapotrzebowanie odrzucone przez pułap',
  'providers.forecast.label': 'Prognoza',
  'providers.forecast.provider': 'Usługa',
  'providers.forecast.monthEnd': 'Do końca miesiąca',
  'providers.forecast.runRate': 'Miesięcznie przy tym tempie',
  'providers.forecast.perWorkspace': 'Na przestrzeń roboczą, miesięcznie',
  'providers.forecast.noWorkspaceTraffic':
    'Brak ruchu z przestrzeni roboczych do uśrednienia',
  'providers.forecast.window': {
    one: 'Prognoza z jednej godziny pomiaru.',
    few: 'Prognoza z {hours} godz. pomiaru.',
    many: 'Prognoza z {hours} godz. pomiaru.',
    other: 'Prognoza z {hours} godz. pomiaru.',
  },
  'providers.forecast.tooEarly': {
    one: 'Zmierzona dopiero jedna godzina — za mało, by prognozować. Rozciąganie niecałej doby na cały miesiąc byłoby arytmetyką, nie prognozą.',
    few: 'Zmierzone dopiero {hours} godz. — za mało, by prognozować. Rozciąganie niecałej doby na cały miesiąc byłoby arytmetyką, nie prognozą.',
    many: 'Zmierzone dopiero {hours} godz. — za mało, by prognozować. Rozciąganie niecałej doby na cały miesiąc byłoby arytmetyką, nie prognozą.',
    other:
      'Zmierzone dopiero {hours} godz. — za mało, by prognozować. Rozciąganie niecałej doby na cały miesiąc byłoby arytmetyką, nie prognozą.',
  },
  'providers.forecast.atWorkspaces': 'Przy ilu przestrzeniach roboczych',
  'providers.forecast.callsEach': 'Wywołań na każdą, miesięcznie',
  'providers.forecast.projected': 'Około {calls} wywołań miesięcznie.',
  'providers.workspaces.label': 'Najbardziej obciążone przestrzenie',
  'providers.workspaces.platform': 'Platforma (poza przestrzeniami)',
  'providers.workspaces.empty.title': 'Nic jeszcze nie przypisano',
  'providers.workspaces.empty.description':
    'Wywołanie wykonane dla przestrzeni roboczej zapisuje się na jej koncie. Zadania cykliczne i poczta platformy nie należą do żadnej i liczą się osobno.',
  'providers.readOnly':
    'Możesz czytać te liczniki, ale nie zmieniać pułapu. Zmiana limitu lub polityki wymaga uprawnienia provider:configure.',
  'providers.status.planned.agreed.month':
    'Uzgodniony pułap: {limit} miesięcznie. Zadziała od pierwszego wywołania, gdy powstanie klient.',
  'providers.status.planned.agreed.day':
    'Uzgodniony pułap: {limit} dziennie. Zadziała od pierwszego wywołania, gdy powstanie klient.',
  'providers.edit.button': 'Edytuj',
  'providers.edit.title': 'Pułap dla {provider}',
  'providers.edit.body':
    'Ile ta instalacja umówiła się wydać u dostawcy i co się dzieje, gdy pula się skończy.',
  'providers.edit.confirm': 'Zapisz pułap',
  'providers.edit.done': 'Zapisano pułap dla {provider}',
  'providers.edit.label': 'Nazwa',
  'providers.edit.ceiling': 'Wywołania w pakiecie',
  'providers.edit.ceiling.hint':
    'Zostaw puste, jeśli pułapu nie uzgodniono. Puste i zero to co innego: zero przy „odmawiaj” odrzuca każde wywołanie.',
  'providers.edit.ceiling.placeholder': 'Bez pułapu',
  'providers.edit.window': 'Mierzone przez',
  'providers.edit.window.month': 'Miesiąc kalendarzowy',
  'providers.edit.window.month.body': 'Zwykły kształt pakietu w abonamencie.',
  'providers.edit.window.day': 'Dobę',
  'providers.edit.window.day.body':
    'Część dostawców rozlicza dziennie — darmowy plan Geoapify to 3 000 kredytów na dobę.',
  'providers.edit.policy': 'Po osiągnięciu pułapu',
  'providers.edit.policy.allow': 'Wołaj dalej i płać',
  'providers.edit.policy.allow.body':
    'Wywołania idą ponad pułap, a konsola ostrzega. Nic nie przestaje działać.',
  'providers.edit.policy.block': 'Odmawiaj kolejnych wywołań',
  'providers.edit.policy.block.body':
    'Wywołania są odrzucane do końca okna. To, co zależy od tego dostawcy, przestaje działać — wybieraj tylko tam, gdzie taka awaria jest tańsza.',
  'providers.edit.policy.block.refused':
    '{provider} nie może być odrzucany: nie ma zapasowej drogi, więc odcięcie wywołań zatrzymałoby funkcję, a nie ograniczyło koszt. Pułap, który tylko ostrzega, jest nadal dostępny.',
  'providers.edit.warn': 'Ostrzegaj przy (%)',
  'providers.edit.critical': 'Alarmuj przy (%)',
  'providers.edit.thresholds.hint':
    'Gdzie miernik robi się bursztynowy i czerwony. Ostrzeżenie nie może być powyżej alarmu.',
} satisfies TranslationOf<typeof En>

export default messages
