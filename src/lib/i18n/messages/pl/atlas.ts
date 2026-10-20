/**
 * The world tracker and the map chrome, in Polish.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** `Mapa świata` for the atlas module, `wyjazd` for a trip,
 * `kraj` for a country and `lista marzeń` for the bucket list — the same words
 * `pl/shell.ts` already uses. The address is the informal second person with
 * the polite capital ("Twoja mapa"), matching the rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('pl')` reports `one` · `few` · `many` ·
 * `other`: `one` is exactly 1, `few` is 2–4 (and 22–24, 32–34 …), `many` is 0
 * and 5–21, and `other` is reached only by a fraction — which is why every
 * `other` branch below carries the genitive singular a decimal takes
 * ("1,5 wizyty").
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Polish uses, and the parity suite exempts them
 * structurally.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Mapa świata. Żaden kraj nie jest jeszcze oznaczony jako odwiedzony.',
  'screen.world.summary':
    'Mapa świata z {visited} z {total} krajów oznaczonymi jako odwiedzone.',
  'screen.error.title': 'Mapa świata się nie wczytała',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Wczytywanie mapy',
  'map.controls.label': 'Sterowanie mapą',
  'map.controls.zoomIn': 'Przybliż',
  'map.controls.zoomOut': 'Oddal',
  'map.controls.north': 'Obróć na północ',
  'map.controls.locate': 'Znajdź moją lokalizację',
  'map.controls.locateFailed': 'Nie udało się ustalić Twojej lokalizacji.',
  'map.controls.locateFailedBody':
    'Sprawdź, czy ta strona ma dostęp do lokalizacji, i spróbuj ponownie.',

  'map.attribution.label': 'Dane mapy od',
  'map.attribution.geocoder': 'Miejsca wyszukane przez',

  'map.basemap.title': 'Mapa podkładowa niedostępna',
  'map.basemap.body':
    'Szczegóły ulic są offline. Każde miejsce jest jednak pokazane na swojej rzeczywistej pozycji, więc odległości i skupiska pozostają dokładne.',
  'map.basemap.credit': 'Linie brzegowe od',
  'map.basemap.retry': 'Spróbuj ponownie',
  'map.basemap.retrying': 'Sprawdzanie mapy podkładowej',

  'map.engine.unsupported.title': 'Renderowanie mapy niedostępne',
  'map.engine.unsupported.body':
    'Ta przeglądarka nie uruchomi interaktywnej mapy: wymaga ona WebGL2, a żaden kontekst WebGL2 nie jest tu dostępny. Nic innego na tym ekranie od niej nie zależy.',
  'map.engine.stalled.title': 'Mapa jeszcze się nie narysowała',
  'map.engine.stalled.body':
    'W czasie przewidzianym na start mapy nic się nie pojawiło. Może jeszcze ruszyć sama z siebie; nic innego na tym ekranie od niej nie zależy.',

  'map.coverage.partial.title': 'Częściowe szczegóły ulic',
  'map.coverage.partial.body': {
    one: 'Opublikowane dane mapy nie obejmują {outside} miejsca tego wyjazdu. Jest ono narysowane na swojej rzeczywistej pozycji na naszych własnych liniach brzegowych.',
    few: 'Opublikowane dane mapy nie obejmują {outside} miejsc tego wyjazdu. Są one narysowane na swoich rzeczywistych pozycjach na naszych własnych liniach brzegowych.',
    many: 'Opublikowane dane mapy nie obejmują {outside} miejsc tego wyjazdu. Są one narysowane na swoich rzeczywistych pozycjach na naszych własnych liniach brzegowych.',
    other:
      'Opublikowane dane mapy nie obejmują {outside} miejsca tego wyjazdu. Są one narysowane na swoich rzeczywistych pozycjach na naszych własnych liniach brzegowych.',
  },
  'map.coverage.none.title': 'Brak szczegółów ulic tutaj',
  'map.coverage.none.body':
    'Ulice dla tego regionu nie są jeszcze opublikowane. Linie brzegowe, pinezki i trasy między nimi są prawdziwe — brakuje tylko budynków i dróg.',
  'map.coverage.dismiss': 'Ukryj uwagę o pokryciu mapy',

  'map.legend.title': 'Legenda',
  'map.legend.collapse': 'Zwiń {title}',
  'map.legend.expand': 'Rozwiń {title}',
  'map.legend.dayPin': 'Przykładowa pinezka dnia',
  'map.legend.dayPinMeaning': 'Dzień planu podróży',
  'map.legend.clusterPin': 'Przykładowa pinezka grupowa',
  'map.legend.clusterPinMeaning': 'Zgrupowane miejsca',

  'map.filter.label': 'Filtruj miejsca według kategorii',
  'map.filter.all': 'Wszystkie',
  'map.filter.category': {
    one: '{name} · {places} miejsce',
    few: '{name} · {places} miejsca',
    many: '{name} · {places} miejsc',
    other: '{name} · {places} miejsca',
  },

  'map.pin.day': 'Dzień {day}',
  'map.pin.cluster': {
    one: '{places} miejsce — przybliż, aby je rozdzielić',
    few: '{places} miejsca — przybliż, aby je rozdzielić',
    many: '{places} miejsc — przybliż, aby je rozdzielić',
    other: '{places} miejsca — przybliż, aby je rozdzielić',
  },

  'map.place.rating': 'Ocena {rating} na {max}',
  'map.place.clause.day': 'dzień {day}',
  'map.place.clause.rating': 'ocena {rating} na {max}',
  'map.place.clause.visited': 'odwiedzone',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Ostatnia wizyta',
  'legend.recent': {
    one: 'W ciągu ostatniego roku',
    few: 'W ciągu ostatnich {years} lat',
    many: 'W ciągu ostatnich {years} lat',
    other: 'W ciągu ostatniego {years} roku',
  },
  'legend.middle': 'Przed {from}–{to} laty lub bez daty',
  'legend.distant': {
    one: 'Ponad {years} rok temu',
    few: 'Ponad {years} lata temu',
    many: 'Ponad {years} lat temu',
    other: 'Ponad {years} roku temu',
  },
  'legend.unvisited': 'Jeszcze nieodwiedzone',
  'legend.note':
    'Odcień pokazuje tylko, jak dawno to było — karta Kraj wypisuje każdą datę.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Pokrycie świata',
  'panel.coverage.unit': 'z {total}',
  'panel.coverage.caption': '{share} świata · {visits}',
  'panel.progress.label': 'W drodze do każdego kraju',
  'panel.progress.remaining': 'Pozostało {remaining}',
  'panel.toggle.hide': 'Ukryj szczegóły mapy świata',
  'panel.toggle.show': 'Pokaż szczegóły mapy świata',
  'panel.tabs.label': 'Sekcje mapy świata',
  'panel.tab.country': 'Kraj',
  'panel.tab.stats': 'Statystyki',
  'panel.tab.bucket': 'Lista marzeń',
  'panel.back': 'Wszystkie kraje',
  'panel.list.label': 'Odwiedzone kraje',
  'panel.loading': 'Wczytywanie Twojej mapy świata',

  'panel.empty.blank.title': 'Twoja mapa jest jeszcze pusta',
  'panel.empty.blank.body':
    'Oznacz kraj jako odwiedzony, a wypełni się tutaj na mapie — z pierwszą i ostatnią wizytą, liczbą pobytów i wszystkim, co o nim napiszesz.',
  'panel.empty.pick.title': 'Wybierz kraj',
  'panel.empty.pick.body':
    'Wskaż go na mapie, w polu wyszukiwania albo na liście, a tutaj otworzy się jego pełny rejestr — pierwsza wizyta, ostatnia wizyta, licznik i Twoja notatka.',

  'panel.stat.places': 'Twoje miejsca',
  'panel.stat.placesNone': 'Nic jeszcze nie przypięto na wyjeździe',
  'panel.stat.placesCaption': 'Zapisane atrakcje, noclegi i przystanki',
  'panel.stat.regions': 'Regiony',
  'panel.stat.regionsNone': 'Brak oznaczonych regionów',
  'panel.stat.regionsCaption': 'Stany, prowincje, prefektury',
  'panel.stat.visits': 'Wizyty',
  'panel.stat.visitsCaption': 'Każdy zapisany przyjazd',
  'panel.stat.trips': 'Twoje wyjazdy',
  'panel.stat.tripsCaption': 'Wszystkie wyjazdy, w których uczestniczysz',
  'panel.stat.cities': 'Miasta',
  'panel.stat.citiesCaption': 'Miejscowości, w których nocowano lub stawano',
  'panel.stat.days': 'Dni w podróży',
  'panel.stat.daysCaption': 'We wszystkich wyjazdach w Twoim rejestrze',
  'panel.continents.label': 'Kraje według kontynentów',

  'panel.bucket.empty.title': 'Na liście nic nie ma',
  'panel.bucket.empty.body':
    'Miejsce, do którego zawsze chciano dotrzeć. Dodaj je i odhacz, gdy tam dojedziesz.',
  'panel.bucket.label': 'Lista marzeń',
  'panel.bucket.progress': 'Ukończono {done} z {total}',
  'panel.bucket.done': 'Zrobione',
  'panel.bucket.toGo': 'Do zrobienia',
  'panel.bucket.target': 'do {year}',
  'panel.bucket.hidden': {
    one: 'Na Twojej liście jest jeszcze {entries} pozycja, niepokazana tutaj.',
    few: 'Na Twojej liście są jeszcze {entries} pozycje, niepokazane tutaj.',
    many: 'Na Twojej liście jest jeszcze {entries} pozycji, niepokazanych tutaj.',
    other:
      'Na Twojej liście jest jeszcze {entries} pozycji, niepokazanej tutaj.',
  },
  'panel.bucket.kind.country': 'Kraj',
  'panel.bucket.kind.region': 'Region kraju',
  'panel.bucket.kind.place': 'Miejsce',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afryka',
  'continent.antarctica': 'Antarktyda',
  'continent.asia': 'Azja',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'Ameryka Północna',
  'continent.oceania': 'Australia i Oceania',
  'continent.southAmerica': 'Ameryka Południowa',
  'continent.unknown': 'Kontynent niezapisany',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Odwiedzone',
  'record.firstVisit': 'Pierwsza wizyta',
  'record.lastVisit': 'Ostatnia wizyta',
  'record.visitDates': 'Daty wizyt',
  'record.notRecorded': 'Niezapisane',
  'record.datesUnrecorded': 'Daty niezapisane',
  'record.visits': {
    one: '{visits} wizyta',
    few: '{visits} wizyty',
    many: '{visits} wizyt',
    other: '{visits} wizyty',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Pierwsza wizyta {from}',
  'record.spanTo': 'Ostatnia wizyta {to}',
  'record.visitsUnit': {
    one: 'wizyta',
    few: 'wizyty',
    many: 'wizyt',
    other: 'wizyty',
  },
  'record.gap.days': {
    one: 'w odstępie {gap} dnia',
    few: 'w odstępie {gap} dni',
    many: 'w odstępie {gap} dni',
    other: 'w odstępie {gap} dnia',
  },
  'record.gap.months': {
    one: 'w odstępie {gap} miesiąca',
    few: 'w odstępie {gap} miesięcy',
    many: 'w odstępie {gap} miesięcy',
    other: 'w odstępie {gap} miesiąca',
  },
  'record.gap.years': {
    one: 'w odstępie {gap} roku',
    few: 'w odstępie {gap} lat',
    many: 'w odstępie {gap} lat',
    other: 'w odstępie {gap} roku',
  },
  'record.note.empty': 'Jeszcze bez notatki',
  'record.noOutline':
    'Kontury świata, które rysuje ta mapa, są przycięte w skali 1:110m, a to scala owo terytorium z jego państwem macierzystym — nie ma więc czego wykadrować na mapie. Wizyta i tak się liczy.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Kolejność krajów',
  'list.sort.code': 'Kod kraju',
  'list.sort.codeStatement': 'Uporządkowano według kodu kraju, od A do Z.',
  'list.sort.name': 'Nazwa kraju',
  'list.sort.nameStatement':
    'Uporządkowano według nazwy kraju, od A do Z, potem według kodu.',
  'list.sort.recent': 'Najnowsza wizyta',
  'list.sort.recentStatement':
    'Uporządkowano od najnowszej wizyty, potem według kodu kraju.',
  'list.sort.visits': 'Najwięcej wizyt',
  'list.sort.visitsStatement':
    'Uporządkowano od największej liczby wizyt, potem według kodu kraju.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Scalone z państwem macierzystym przez kontury świata, więc nie ma czego wykadrować na mapie.',
  'list.announce.selected': 'Wybrano: {name}.',
  'list.announce.selectedUnframed': 'Wybrano: {name}. {reason}',
  'list.empty.title': 'Na mapie nie ma jeszcze żadnych krajów',
  'list.empty.body':
    'Kraj trafia tutaj w chwili zapisania wizyty — z pierwszym przyjazdem, tym najnowszym i liczbą pobytów.',
  'list.loading': 'Wczytywanie odwiedzonych krajów',
  'list.error.title': 'Twoje kraje się nie wczytały',
  'list.error.body':
    'Mapa świata nie zdołała teraz odczytać Twoich odwiedzonych krajów. Nic nie przepadło — wciąż są zapisane.',
  'list.error.retry': 'Spróbuj ponownie',
  'list.error.retrying': 'Wczytywanie Twoich krajów',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Znajdź kraj',
  'search.loading': 'Wczytywanie Twoich krajów',
  'search.placeholder': 'Nazwa lub kod kraju',
  'search.entry.notVisited': 'Jeszcze nieodwiedzony',
  'search.entry.noOutline': 'bez konturu na mapie',
  'search.entry.separator': ' · ',
  'search.cleared': 'Wybór wyczyszczony.',
  'search.unframed':
    '{name} nie ma konturu w skali świata, więc mapa nie ma czego wykadrować.',
  'search.unframedVisited':
    '{name} nie ma konturu w skali świata, więc mapa nie ma czego wykadrować. Rejestr kraju pozostaje bez zmian.',
  'search.results.empty':
    'W Twoim rejestrze nie ma jeszcze żadnych krajów. Pisz, aby przeszukać wszystkie kraje świata.',
  'search.results.emptyPinned':
    'Wybrano: {name}. W Twoim rejestrze nie ma jeszcze żadnych krajów — pisz, aby przeszukać wszystkie kraje świata.',
  'search.results.record': {
    one: 'W Twoim rejestrze jest {countries} kraj.',
    few: 'W Twoim rejestrze są {countries} kraje.',
    many: 'W Twoim rejestrze jest {countries} krajów.',
    other: 'W Twoim rejestrze jest {countries} kraju.',
  },
  'search.results.capped': 'Widoczne pierwsze {shown}.',
  'search.results.pinned': 'Wybrano: {name}, na pierwszym miejscu listy.',
  'search.results.none': 'Do zapytania {term} nie pasuje żaden kraj.',
  'search.results.matches': {
    one: 'Do zapytania {term} pasuje {countries} kraj.',
    few: 'Do zapytania {term} pasują {countries} kraje.',
    many: 'Do zapytania {term} pasuje {countries} krajów.',
    other: 'Do zapytania {term} pasuje {countries} kraju.',
  },
  'search.announce.selected': 'Wybrano: {name}.',
  'search.announce.framing': 'Wybrano: {name}. Mapa właśnie go kadruje.',
  'search.announce.unframed': 'Wybrano: {name}. {reason}',
  'search.empty.title': 'W Twoim rejestrze nic jeszcze nie ma',
  'search.empty.body':
    'Wpisz nazwę kraju albo jego dwuliterowy kod, aby znaleźć go na mapie.',
  'search.empty.noMatchTitle': 'Do zapytania „{term}” nie pasuje żaden kraj',
  'search.empty.noMatchBody':
    'Sprawdź pisownię albo wypróbuj dwuliterowy kod — PT znajdzie Portugalię. Przeszukać można wszystkie {countries} krajów, odwiedzonych czy nie.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Twój rejestr',
  'actions.visit.absent.title': 'Nieodwiedzony',
  'actions.visit.absent.caption': 'Wizyta bez powiązanego wyjazdu.',
  'actions.visit.title': 'Odwiedzony',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Poza listą',
  'actions.goal.absent.caption': 'Miejsce, do którego się wybierasz.',
  'actions.goal.title': 'Na liście marzeń',
  'actions.goal.waiting': 'Czeka na swoją kolej.',
  'actions.goal.target': 'Cel: {year}.',
  'actions.goal.achieved.title': 'Odhaczone z listy',
  'actions.goal.achieved.caption':
    'Udało się dotrzeć. Wpis zostaje jako pamiątka w rejestrze.',

  'actions.button.remove': 'Usuń',
  'actions.button.mark': 'Oznacz jako odwiedzony',
  'actions.button.add': 'Dodaj do listy',
  'actions.visit.remove.name': 'Usuń {name} ze swojej mapy świata',
  'actions.visit.remove.busy': 'Usuwanie {name} z Twojej mapy świata',
  'actions.visit.add.name': 'Oznacz jako odwiedzony: {name}',
  'actions.visit.add.busy': 'Oznaczanie {name} jako odwiedzonego',
  'actions.goal.remove.name': 'Usuń {name} ze swojej listy marzeń',
  'actions.goal.remove.busy': 'Usuwanie {name} z Twojej listy marzeń',
  'actions.goal.add.name': 'Dodaj do listy: {name}',
  'actions.goal.add.busy': 'Dodawanie {name} do Twojej listy marzeń',

  'actions.hint': 'Obie akcje działają od razu i obie można tutaj cofnąć.',
  'actions.offline':
    'Twoje urządzenie nie zdołało połączyć się z serwerem. Sprawdź połączenie i spróbuj ponownie.',
  'actions.toast.marked': 'Oznaczono jako odwiedzony',
  'actions.toast.markedBody': '{name} jest na Twojej mapie świata.',
  'actions.toast.markFailed': '{name}: nie udało się oznaczyć',
  'actions.toast.unmarked': 'Usunięto z Twojej mapy świata',
  'actions.toast.unmarkedBody':
    '{name} nie jest już oznaczony jako odwiedzony.',
  'actions.toast.unmarkFailed': '{name}: nie udało się usunąć',
  'actions.toast.listed': 'Dodano do Twojej listy marzeń',
  'actions.toast.listedBody': '{name} to miejsce, do którego się wybierasz.',
  'actions.toast.listFailed': '{name}: nie udało się dodać',
  'actions.toast.unlisted': 'Usunięto z Twojej listy marzeń',
  'actions.toast.unlistedBody': '{name} nie jest już na liście.',
  'actions.toast.unlistFailed': '{name}: nie udało się usunąć',
  'actions.toast.fallback':
    'Zmiana nie dotarła na serwer. Spróbuj ponownie za chwilę.',

  'actions.confirm.visit.title': 'Usunąć {name} z Twojej mapy świata?',
  'actions.confirm.visit.body': {
    one: 'Wyczyszczona zostałaby {visits} zapisana wizyta{dates}{note}. Twoje wyjazdy i zapisane miejsca pozostają nietknięte.',
    few: 'Wyczyszczone zostałyby {visits} zapisane wizyty{dates}{note}. Twoje wyjazdy i zapisane miejsca pozostają nietknięte.',
    many: 'Wyczyszczonych zostałoby {visits} zapisanych wizyt{dates}{note}. Twoje wyjazdy i zapisane miejsca pozostają nietknięte.',
    other:
      'Wyczyszczone zostałoby {visits} zapisanej wizyty{dates}{note}. Twoje wyjazdy i zapisane miejsca pozostają nietknięte.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ' wraz z dopisaną notatką',
  'actions.confirm.goal.title': 'Usunąć {name} z Twojej listy marzeń?',
  'actions.confirm.goal.body':
    'Pozycja jest już odhaczona, więc zniknie także zapis o tym, że udało się tam dotrzeć. Twoja mapa świata i wyjazdy pozostają nietknięte.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Wyjazd przestrzeni roboczej',
    few: 'Wyjazdy przestrzeni roboczej',
    many: 'Wyjazdów przestrzeni roboczej',
    other: 'Wyjazdu przestrzeni roboczej',
  },
  'card.visits': {
    one: 'Wizyta',
    few: 'Wizyty',
    many: 'Wizyt',
    other: 'Wizyty',
  },
  'card.places': {
    one: 'Miejsce przestrzeni roboczej',
    few: 'Miejsca przestrzeni roboczej',
    many: 'Miejsc przestrzeni roboczej',
    other: 'Miejsca przestrzeni roboczej',
  },
  'card.firstTrip': 'Pierwszy wyjazd',
  'card.lastTrip': 'Ostatni wyjazd',
  'card.firstVisit': 'Pierwsza wizyta',
  'card.lastVisit': 'Ostatnia wizyta',
  'card.absent': 'Niezapisane',
  'card.loading': 'Wczytywanie kraju',
  'card.loadingNamed': 'Wczytywanie: {name}',
  'card.error.body': 'Te liczby się nie wczytały. Nic nie przepadło.',
  'card.error.retry': 'Spróbuj ponownie',
  'overlay.close': 'Zamknij {name}',
  'regions.label': 'Regiony',
  'regions.hint': 'Dodanie regionu oznacza też {country} jako odwiedzony kraj.',
  'regions.keeps':
    'Usunięcie regionu nie usuwa kraju {country} z Twojego atlasu.',
  'regions.keeps.unvisited':
    'Te regiony pozostają w Twoich zapisach. Oznacz {country} jako odwiedzony kraj lub dodaj region, aby przywrócić go na mapie.',
  'regions.empty.title': 'Nie zapisano tu jeszcze regionów',
  'regions.empty.body':
    'Dodaj stan, prowincję lub obszar odwiedzony w kraju {country}.',
  'regions.input.label': 'Dodaj region w kraju {country}',
  'regions.input.placeholder': 'Na przykład Bawaria',
  'regions.add': 'Dodaj region',
  'regions.adding': 'Dodawanie: {region}',
  'regions.remove': 'Usuń {region}',
  'regions.loading': 'Wczytywanie Twoich regionów',
  'regions.status.added': 'Dodano {region}',
  'regions.status.exists': '{region} jest już w Twoich zapisach',
  'regions.status.removed': 'Usunięto {region}',
  'regions.status.addedCountry':
    'Dodano {region}. Kraj {country} jest teraz oznaczony jako odwiedzony.',
  'regions.error.invalid': 'Wpisz nazwę regionu.',
  'regions.error.hidden':
    'Nazwa zawiera niedozwolone znaki. Usuń je i spróbuj ponownie.',
  'regions.error.load':
    'Nie udało się wczytać Twoich regionów w kraju {country}.',
  'regions.error.add': 'Nie udało się dodać {region}. Spróbuj ponownie.',
  'regions.error.remove': 'Nie udało się usunąć {region}. Spróbuj ponownie.',
  'regions.error.full':
    'Zapisano już {limit} regionów. Usuń jeden, aby dodać kolejny.',
  'regions.reload': 'Wczytaj regiony ponownie',
  'actions.confirm.visitRegions.body': {
    one: '{history}Regiony zapisane w kraju {country} pozostaną w Twoich zapisach: {count}.',
    few: '{history}Regiony zapisane w kraju {country} pozostaną w Twoich zapisach: {count}.',
    many: '{history}Regiony zapisane w kraju {country} pozostaną w Twoich zapisach: {count}.',
    other:
      '{history}Regiony zapisane w kraju {country} pozostaną w Twoich zapisach: {count}.',
  },
} satisfies TranslationOf<typeof En>

export default messages
