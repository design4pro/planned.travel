/**
 * The public pages' copy, in pl.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Typografia.** Polski cytuje „…” i składa zakres półpauzą bez spacji.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Zacznij bezpłatnie',
  'action.signIn': 'Zaloguj się',
  'action.pricing': 'Cennik',
  'action.seePricing': 'Zobacz cennik',
  'action.skipToContent': 'Przejdź do treści',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — strona główna',
  'nav.onThisPage': 'Na tej stronie',
  'anchor.planner': 'Planer',
  'anchor.modules': 'Moduły',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Upuść na dzień {day}',
  'legal.summaryNote':
    'Skrót jest tu, żeby go przeczytać. To, co niżej, obowiązuje.',
  'visual.daysTravelled': 'Dni w podróży',
  'visual.acrossEveryTrip': 'na wszystkich wyjazdach',
  'visual.mapFilled': 'wypełnione {percent}% mapy',
  'visual.previewSummary':
    'Podgląd panelu planned.travel: najbliższy wyjazd z datami, liczbą osób i liczbą miejsc; podsumowania odwiedzonych krajów, wyjazdów i dni w podróży; mapa trasy wyjazdu; oraz dwie najbliższe rezerwacje.',
  'visual.placesMapped': {
    one: '{value} miejsce na mapie',
    few: '{value} miejsca na mapie',
    many: '{value} miejsc na mapie',
    other: '{value} miejsca na mapie',
  },
  'visual.splitWays': {
    one: 'bez podziału',
    few: 'podzielone na {value}',
    many: 'podzielone na {value}',
    other: 'podzielone na {value}',
  },
  'visual.tripTotal': 'Suma wyjazdu',
  'visual.paidSplit': 'zapłacił(a) {who} · {split}',
  'visual.nextUp': 'Najbliższe',
  'visual.ofTotal': '{done} z {total}',
  'visual.awaitingReply': 'Czeka na odpowiedź',
  'visual.upcoming': 'Nadchodzące',
  'visual.days': {
    one: '{value} dzień',
    few: '{value} dni',
    many: '{value} dni',
    other: '{value} dnia',
  },
  'visual.places': {
    one: '{value} miejsce',
    few: '{value} miejsca',
    many: '{value} miejsc',
    other: '{value} miejsca',
  },
  'visual.transfersLeft': {
    one: 'został {value} przelew',
    few: 'zostały {value} przelewy',
    many: 'zostało {value} przelewów',
    other: 'zostało {value} przelewu',
  },

  'legal.badge.version': 'Wersja {version}',
  'legal.badge.effective': 'Obowiązuje od {updated}',
  'legal.notice.title': 'To wzór, a nie porada prawna',
  'legal.notice.body':
    'Jest napisany prostym angielskim, żeby był naprawdę użytecznym punktem wyjścia dla małej usługi planowania podróży, a każda luka, którą firma musi wypełnić, jest zaznaczona. Zanim przyjmiesz choćby jednego klienta, zleć przegląd i dostosowanie prawnikowi w swojej jurysdykcji. Nic tutaj nie twierdzi, że planned.travel ma jakąkolwiek certyfikację, audyt czy standard zgodności.',
  'legal.contents': 'Spis treści',
  'legal.shortVersion': 'W skrócie',
  'legal.both': 'Oba dokumenty obowiązują razem.',

  'landing.plans.title': 'Zacznij bezpłatnie. Zapłać, gdy na to zasłuży.',
  'landing.plans.lede':
    'Każdy plan zawiera plan dnia, mapę, budżety i listy pakowania. Plany płatne - od {price} miesięcznie - odblokowują wyjazdy bez limitu, rezerwacje, dziennik, mapy offline i eksporty.',
  'landing.plans.ledeFree':
    'Każdy plan zawiera plan dnia, mapę, budżety i listy pakowania. Plany płatne odblokowują wyjazdy bez limitu, rezerwacje, dziennik, mapy offline i eksporty.',
  'landing.plans.compare': 'Porównaj każdy limit, wiersz po wierszu',
  'landing.questions.title': 'Pytania, odpowiedzi bez owijania',
  'landing.questions.lede':
    'Sześć rzeczy, o które ludzie naprawdę pytają, zanim zaczną planować.',
  'cta.heading': 'Twój następny wyjazd już zasługuje na porządny plan',
  'cta.lede':
    'Dwa wyjazdy, cała mapa, plan dnia i listy pakowania - bezpłatnie, bez karty i bez licznika.',
  'landing.faq.seats.q': 'Czy osoby, z którymi jadę, też muszą płacić?',
  'landing.faq.seats.a':
    'Nie. Każdy, kogo zaprosisz do obszaru roboczego {crew}, jest objęty jego miejscami. Loguje się na własne konto i widzi tylko te wyjazdy, do których go dodałeś.',
  'landing.faq.phone.q': 'Czy działa porządnie na telefonie?',
  'landing.faq.phone.a':
    'Tak. Układy mobilne są rysowane osobno, a nie ściśnięte z wersji na komputer, i to jest strona internetowa, więc nie ma czego instalować ani aktualizować.',
  'landing.faq.offline.q': 'Czy mogę używać mapy bez zasięgu?',
  'landing.faq.offline.a':
    'W planach {solo} i {crew} pobierzesz region przed wylotem, więc mapa nadal się rysuje, gdy wylądujesz bez danych. Edycja samego wyjazdu wymaga połączenia.',
  'landing.faq.privacy.q': 'Kto może zobaczyć mój wyjazd?',
  'landing.faq.privacy.a':
    'Wyjazd należy do jednego obszaru roboczego i otworzą go tylko osoby zaproszone do tego obszaru. Nic nie jest publiczne, nie ma żadnego kanału odkrywania i domyślnie nic nie jest z nikim dzielone.',
  'landing.faq.stop.q':
    'Co stanie się z moimi wyjazdami, jeśli przestanę płacić?',
  'landing.faq.stop.a':
    'Nic nie jest usuwane. Płatne moduły się blokują, wyjazdy zostają dokładnie tam, gdzie są, a wszystko odblokowuje się w chwili wykupienia planu. Plan {free} zostaje bezpłatny, bez licznika.',

  'action.startPlanning': 'Zacznij planować bezpłatnie',
  'cta.comparePlans': 'Porównaj plany',
  'landing.hero.eyebrow': 'Wspólne planowanie wyjazdów',
  'landing.hero.title': 'Zaplanuj wyjazd.',
  'landing.hero.titleQuiet': 'Nie arkusz.',
  'landing.hero.lede':
    'Jeden plan na prawdziwej mapie, dzielony na żywo ze wszystkimi jadącymi - z rezerwacjami, pieniędzmi i listą pakowania w komplecie.',
  'landing.hero.secondary': 'Sprawdź, ile to kosztuje',
  'landing.trust.noCard': 'Bez karty na start',
  'landing.trust.noAds': 'Bez reklam i linków afiliacyjnych',
  'landing.trust.export': 'Wyeksportuj wszystko, kiedy chcesz',

  'proof.eyebrow': 'Prosto z mostu',
  'proof.title': 'Żadnych opinii, bo jeszcze na nie nie zapracowaliśmy',
  'proof.lede':
    'planned.travel jest nowe. Zamiast wymyślać cytat albo pożyczać czyjeś logo, mówimy wprost, co robi, dla kogo jest i czego nigdy ci nie zrobi.',
  'proof.who.label': 'Dla kogo to jest',
  'proof.who.heading': 'Dla osoby, która i tak skończy z arkuszem',
  'proof.who.body':
    'Dla par, rodzin i grup przyjaciół, które chcą jednego planu widocznego dla wszystkich, a nie sześciu zrzutów ekranu, trzech czatów i wspólnej notatki, której nikt nie otwierał od marca.',
  'proof.not.label': 'Czym to nie jest',
  'proof.not.heading':
    'To nie jest serwis rezerwacyjny ani towar na sprzedaż dla takiego',
  'proof.not.body':
    'Nie bierzemy prowizji, nie mamy reklam ani linków afiliacyjnych, więc nic na stronie nie kieruje cię po cichu do konkretnego hotelu. Płacisz nam ty, czyli pracujemy dla ciebie.',
  'proof.where.label': 'Gdzie leżą twoje rzeczy',
  'proof.where.heading': 'Na Cloudflare, w twoim własnym obszarze roboczym',
  'proof.where.body':
    'Wyjazdy siedzą w bazie ograniczonej do twojego obszaru roboczego, a pliki w naszym własnym magazynie obiektów, jedno i drugie podawane z brzegu sieci Cloudflare. Polar, nasz sprzedawca rejestrowy, prowadzi płatność i wystawia fakturę, więc numer twojej karty nigdy do nas nie dociera.',
  'proof.promise.ads.title': 'Zero reklam, zero analityki firm trzecich',
  'proof.promise.ads.body':
    'Nic na tej stronie nie mierzy cię dla kogoś innego.',
  'proof.promise.sold.title':
    'Twoje wyjazdy nigdy nie są sprzedawane ani wynajmowane',
  'proof.promise.sold.body':
    'Ani reklamodawcom, ani firmom turystycznym, ani nikomu.',
  'proof.promise.leave.title': 'Odejdź, kiedy chcesz, i weź wszystko ze sobą',
  'proof.promise.leave.body':
    'Plany w PDF, pliki kalendarza i twoje miejsca jako GeoJSON.',
  'proof.certification':
    'Nie mamy dziś żadnego certyfikatu bezpieczeństwa i nie będziemy udawać, że mamy. Kiedy planned.travel przejdzie audyt względem jakiegoś standardu, to tutaj podamy nazwę standardu, audytora i datę - i ani chwili wcześniej.',

  'feature.modules.title': 'Reszta wyjazdu, ogarnięta',
  'feature.modules.lede':
    'Każdy moduł robi jedną rzecz porządnie i przekazuje swoją pracę pozostałym. Nic tutaj nie jest pustą zakładką czekającą na przyszłe wydanie.',
  'feature.module.lists.benefit': 'Nikt nie przyjedzie bez przejściówki.',
  'feature.module.lists.detail':
    'Pakowanie, zadania, zakupy i dokumenty - jedna lista na jedno zadanie, wspólna dla wszystkich jadących i odhaczana na bieżąco.',
  'feature.module.journal.name': 'Dziennik',
  'feature.module.journal.benefit':
    'Wyjazd staje się opowieścią, a nie folderem.',
  'feature.module.journal.detail':
    'Wpisy w kolejności dat, ze zdjęciami, które zrobiłeś, miejscem, pogodą i tym, jaki ten dzień naprawdę był.',
  'feature.module.atlas.benefit': 'Jedna mapa wszystkiego, gdzie byłeś.',
  'feature.module.atlas.detail':
    'Zaznacz kraj jako odwiedzony i dołącza do twojej mapy świata, z pierwszą wizytą, ostatnią i liczbą powrotów.',
  'feature.module.vacay.benefit': 'Zaklep urlop, zanim kupisz bilet.',
  'feature.module.vacay.detail':
    'Zaznacz dni nieobecności, a rok się wypełnia - weekendy, święta i wolne pozostałych w tej samej siatce.',
  'feature.module.collab.benefit': 'Decyzje zostają przy wyjeździe.',
  'feature.module.collab.detail':
    'Jeden wątek na wyjazd, wspólne notatki na rzeczy, o których wszyscy muszą pamiętać, i ankieta na moment, gdy grupa nie może dogadać się co do kolacji.',
  'feature.module.files.benefit': 'Karty pokładowe tam, gdzie je znajdziesz.',
  'feature.module.files.detail':
    'Potwierdzenia, bilety, dokumenty ubezpieczenia i paragony dołączone do wyjazdu, do którego należą, a nie zakopane w skrzynce.',

  'feature.planner.title': 'Plan dzień po dniu, narysowany na prawdziwej mapie',
  'feature.planner.lede':
    'Zbierz miejsca, które chcesz zobaczyć, a potem przeciągnij je na konkretny dzień. Mapa przerysowuje trasę na bieżąco, więc od razu widzisz, kiedy poranek każe ci przejechać miasto dwa razy.',
  'feature.planner.point.days':
    'Jedna kolumna na dzień, z datą, pogodą i miejscem, w którym nocujesz.',
  'feature.planner.point.unscheduled':
    'Miejsca bez terminu czekają we własnej kolumnie, dopóki nie dostaną dnia.',
  'feature.planner.point.crew':
    'W planie {crew} wszyscy przeciągają jednocześnie: kursory na żywo, natychmiastowa synchronizacja, zero odświeżania.',
  'feature.planner.point.tiles':
    'Kafle wektorowe z naszego własnego magazynu, więc żaden dostawca map nie podgląda, co planujesz.',
  'feature.costs.title': 'Wspólne koszty, które naprawdę się rozliczają',
  'feature.costs.lede':
    'Zapisuj wydatki w walucie wyjazdu, dziel każdy z nich tak, jak się faktycznie umówiliście, i zobacz najkrótszy zestaw przelewów, który zamyka całość.',
  'feature.costs.point.split':
    'Po równo, według udziałów albo co do kwoty - dla każdego wydatku osobno, nie raz na wyjazd.',
  'feature.costs.point.currency':
    'Wszystko przeliczone na jedną walutę wyjazdu, żeby suma coś znaczyła.',
  'feature.costs.point.settle':
    'Widok rozliczenia mówi, kto komu płaci, i zapisuje przelew, gdy się wykona.',
  'feature.costs.point.receipt':
    'Dołącz paragon do wydatku, żeby kwota zawsze miała dowód.',
  'feature.book.title':
    'Każda rezerwacja, z kodem, który potrzebny jest przy wejściu',
  'feature.book.lede':
    'Noclegi, stoliki, wycieczki i bilety na jednej liście, obok lotów, pociągów i promów, które łączą je ze sobą - każde z numerem potwierdzenia i dniem, do którego należy.',
  'feature.book.point.legs':
    'Odcinki transportu mają miejsce, peron, terminal i kod rezerwacji.',
  'feature.book.point.day':
    'Rezerwacja jest przypisana do dnia, więc pojawia się w planie bez przepisywania.',
  'feature.book.point.states':
    'Zgłoszona, potwierdzona i anulowana to osobne stany, a nie notatka w polu.',
  'feature.book.point.export':
    'Wyeksportuj cały wyjazd jako plan PDF albo plik kalendarza, jeszcze przed wylotem.',

  'pricing.faq.trial.q': 'Co się dzieje, gdy kończy się okres próbny?',
  'pricing.faq.trial.a':
    'Okres próbny przechodzi w plan płatny. Polar pobiera metodę płatności na starcie okresu próbnego i obciąża ją w dniu jego zakończenia, więc jeśli zrezygnujesz wcześniej, nic nie zapłacisz. W żadnym wariancie nic nie jest usuwane: płatne moduły się blokują, wyjazdy zostają dokładnie tam, gdzie są, a wszystko odblokowuje się w chwili wykupienia planu.',
  'pricing.faq.seller.q': 'Od kogo właściwie kupuję?',
  'pricing.faq.seller.a':
    'Od Polara. To nasz sprzedawca rejestrowy, czyli sprzedaje ci subskrypcję jako nasz reseller, przyjmuje płatność, wystawia fakturę we własnym imieniu oraz ustala, pobiera i odprowadza podatek od sprzedaży lub VAT, który nalicza twój kraj. Zwroty i spory z kartą też rozstrzyga się z nim. Serwis nadal prowadzimy my i my odpowiadamy na twoje maile.',
  'pricing.faq.change.q': 'Czy mogę zmienić plan w połowie wyjazdu?',
  'pricing.faq.change.a':
    'Tak. Wyższy plan działa natychmiast i jest rozliczany proporcjonalnie do dnia; niższy wchodzi w życie po zakończeniu okresu, który już opłaciłeś, więc nigdy nie tracisz dostępu, za który zapłaciłeś.',
  'pricing.faq.seats.q': 'Jak działa rozliczanie od osoby w planie {crew}?',
  'pricing.faq.seats.a':
    'Płacisz za stanowiska, które faktycznie zajmujesz, a liczbę możesz zmienić w każdej chwili. Niewykorzystane zaproszenia też liczą się do stanowisk, więc przestrzeń nie przekroczy planu po cichu.',
  'pricing.faq.guests.q':
    'Czy osoby, z którymi podróżuję, potrzebują własnej subskrypcji?',
  'pricing.faq.guests.a':
    'Nie. Każdy, kogo zaprosisz do obszaru roboczego {crew}, jest objęty jego miejscami. Loguje się na własne konto i widzi wyjazdy, do których został dodany.',
  'pricing.faq.storage.q': 'Co wlicza się do miejsca na pliki?',
  'pricing.faq.storage.a':
    'Zdjęcia, bilety, potwierdzenia i każdy plik, który dołączysz do wyjazdu. Kafle mapy ani sama aplikacja nigdy się nie liczą. W Ustawieniach widać dokładnie, co zajmuje miejsce.',
  'pricing.faq.export.q': 'Czy mogę zabrać swoje dane?',
  'pricing.faq.export.a':
    'Zawsze. Każdy wyjazd eksportuje się jako plan w PDF i jako plik kalendarza, a twoje miejsca jako GeoJSON. To twoje podróże, nie nasze.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Bez karty, bez terminu, bez licznika',
  'pricing.card.yearlyPerSeat': '{amount} rocznie za osobę, płatne raz',
  'pricing.card.yearly': '{amount} płatne raz w roku',
  'pricing.card.seatsUnlimited': 'Bez limitu osób',
  'pricing.card.tripsUnlimited': 'bez limitu wyjazdów',
  'pricing.card.startFree': 'Zacznij bezpłatnie',
  'pricing.card.startTrial': 'Wypróbuj plan {plan}',
  'pricing.card.popular': 'Najczęściej wybierany',
  'pricing.card.noteYearly': 'Płatne raz w roku. Dwa miesiące od nas.',
  'pricing.card.noteMonthly':
    'Płatne miesięcznie. Zmieniasz albo rezygnujesz, kiedy chcesz.',
  'pricing.card.trial': {
    one: '{value} dzień bezpłatnie, karta z góry, obciążenie po zakończeniu',
    few: '{value} dni bezpłatnie, karta z góry, obciążenie po zakończeniu',
    many: '{value} dni bezpłatnie, karta z góry, obciążenie po zakończeniu',
    other: '{value} dnia bezpłatnie, karta z góry, obciążenie po zakończeniu',
  },
  'pricing.card.seatsUpTo': {
    one: 'Do {value} osoby',
    few: 'Do {value} osób',
    many: 'Do {value} osób',
    other: 'Do {value} osoby',
  },
  'pricing.card.trips': {
    one: '{value} wyjazd naraz',
    few: '{value} wyjazdy naraz',
    many: '{value} wyjazdów naraz',
    other: '{value} wyjazdu naraz',
  },

  'pricing.feature.storage': '{size} na zdjęcia i dokumenty',
  'pricing.feature.storageShared': '{size} wspólnie na zdjęcia i dokumenty',
  'pricing.feature.free.tripsDetail': 'Zarchiwizuj jeden, żeby zacząć następny',
  'pricing.feature.solo.modules': 'Każdy moduł planowania',
  'pricing.feature.solo.modulesDetail':
    'Rezerwacje, dziennik, budżety, pakowanie',
  'pricing.feature.solo.offlineDetail': 'Pobierz regiony przed wylotem',
  'pricing.feature.crew.membersDetail':
    'Rozliczane od osoby, zmienisz kiedy chcesz',
  'pricing.feature.crew.realtimeDetail':
    'Kursory na żywo i natychmiastowa synchronizacja',
  'pricing.feature.crew.supportDetail':
    'Odpowiedź od człowieka w ciągu jednego dnia roboczego',

  'pricing.hero.eyebrow': 'Dwa wyjazdy bezpłatnie, na zawsze',
  'pricing.hero.title': 'Zaplanuj to porządnie.',
  'pricing.hero.titleQuiet': 'Płać za to, czego używasz.',
  'pricing.hero.lede':
    'Zaplanuj dwa wyjazdy za darmo. Odblokuj każdy moduł dla jednej osoby albo zabierz całą ekipę i edytujcie ten sam plan jednocześnie.',
  'pricing.hero.taxNote':
    'Ceny w dolarach amerykańskich, bez podatku od sprzedaży i VAT. Polar jest naszym sprzedawcą rejestrowym: to on widnieje na fakturze, ustala, ile nalicza twój kraj, dodaje to przy płatności i odprowadza. Możesz zrezygnować kiedy chcesz, z wnętrza produktu.',
  'pricing.compare.eyebrow': 'Obok siebie',
  'pricing.compare.title': 'Każdy limit, porównany',
  'pricing.compare.lede':
    'Jedna tabela, generowana z tego samego katalogu, który czyta system rozliczeń. Jeśli wiersz mówi, że moduł jest w planie, kontrola uprawnień się z tym zgadza.',
  'pricing.compare.caption':
    'Porównanie funkcji i limitów we wszystkich trzech planach',
  'pricing.compare.feature': 'Funkcja',
  'pricing.compare.limits': 'Limity',
  'pricing.compare.included': 'W planie',
  'pricing.compare.notIncluded': 'Poza planem',
  'pricing.compare.includedIn': 'W planie {plan}',
  'pricing.compare.notIn': 'Poza planem {plan}',
  'pricing.questions.eyebrow': 'Zanim zapytasz',
  'pricing.questions.title': 'Pytania, odpowiedzi',
  'pricing.questions.lede':
    'Rozliczenia, okresy próbne i odzyskiwanie własnych danych.',
  'pricing.cta.secondary': 'Zobacz, jak to działa',
  'pricing.module.itinerary': 'Plan dzień po dniu',
  'pricing.module.map': 'Interaktywna mapa',
  'pricing.module.budget': 'Budżety i dzielenie wydatków',
  'pricing.module.packing': 'Listy pakowania i zadań',
  'pricing.module.reservations': 'Rezerwacje i noclegi',
  'pricing.module.journal': 'Dziennik podróży',
  'pricing.module.atlas': 'Mapa odwiedzonych krajów',
  'pricing.module.collaboration': 'Zaproś współpodróżnych',
  'pricing.module.realtime': 'Współpraca na żywo',
  'pricing.module.offlineMaps': 'Mapy offline',
  'pricing.module.pdfExport': 'Eksport do PDF i kalendarza',
  'pricing.module.prioritySupport': 'Wsparcie priorytetowe',

  'anchor.plans': 'Plany',
  'anchor.compare': 'Porównanie',
  'anchor.questions': 'Pytania',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Jedno miejsce na plan dnia, mapę, rezerwacje, pieniądze i listę rzeczy do zabrania — wspólne dla wszystkich, którzy jadą.',
  'footer.attribution':
    'Działa na Cloudflare Workers. Dane map © współtwórcy OpenStreetMap. Sprzedaż i faktury: Polar, nasz merchant of record.',
  'footer.column.product': 'Produkt',
  'footer.column.account': 'Konto',
  'footer.link.overview': 'Przegląd',
  'footer.link.everyModule': 'Wszystkie moduły',
  'footer.link.dayPlanner': 'Planer dnia',
  'footer.link.sharedCosts': 'Wspólne koszty',
  'footer.link.reservations': 'Rezerwacje',
  'footer.link.atlasJournal': 'Atlas i dziennik',
  'footer.link.createAccount': 'Utwórz konto',
  'footer.link.terms': 'Regulamin',
  'footer.link.privacy': 'Informacja o prywatności',
} satisfies TranslationOf<typeof En>

export default messages
