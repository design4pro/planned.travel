/**
 * The costs tab's copy, in pl.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `Intl.PluralRules('pl')` daje `one` · `few` · `many` ·
 * `other`: `one` to dokładnie 1, `few` to 2–4, `many` to 0 i 5–21, a `other`
 * osiąga tylko liczba dziesiętna — stąd dopełniacz liczby pojedynczej w tej
 * gałęzi.
 *
 * **Typografia.** Polski składa zakres półpauzą bez spacji i cytuje „…”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Ty',
  'person.youTarget': 'Tobie',
  'person.removed': 'Usunięty podróżnik',
  'person.removedTarget': 'usunięty podróżnik',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Usunąć ten wydatek?',
  'delete.description':
    '„{title}” i jego podział znikają z rozliczenia. Tego nie da się cofnąć.',
  'delete.failed': 'Nie udało się usunąć',
  'delete.failedBody': 'Nie udało się usunąć wydatku. Spróbuj za chwilę.',
  'delete.noBalances':
    'Żadne saldo się nie zmieni - nic nie było na to dzielone.',
  'delete.balancesChange': 'Zmieniają się salda: {names}.',
  'delete.confirm': 'Usuń wydatek',
  'delete.working': 'Usuwanie wydatku',
  'delete.payment.title': 'Usunąć tę płatność?',
  'delete.payment.description':
    '„{title}” znika z rozliczenia. Tego nie da się cofnąć. Aby poprawić płatność, zapisz ją jeszcze raz.',
  'delete.payment.failedBody':
    'Nie udało się usunąć płatności. Spróbuj za chwilę.',
  'delete.payment.confirm': 'Usuń płatność',
  'delete.payment.working': 'Usuwanie płatności',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Wydatki',
  'toolbar.shownOf': '{shown} z {total}',
  'toolbar.searchPlaceholder': 'Szukaj w wydatkach, notatkach lub płatnikach…',
  'toolbar.searchLabel': 'Szukaj w wydatkach',
  'toolbar.allCategories': 'Wszystkie kategorie',
  'toolbar.allDays': 'Wszystkie dni',
  'toolbar.filterCategory': 'Filtruj po kategorii',
  'toolbar.filterDay': 'Filtruj po dniu',
  'toolbar.whose': 'Czyje wydatki',
  'toolbar.paidByMe': 'Zapłacone przeze mnie',
  'toolbar.owedToMe': 'Należne mnie',
  'toolbar.logged': {
    one: '{value} zapisany',
    few: '{value} zapisane',
    many: '{value} zapisanych',
    other: '{value} zapisanego',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Podział między podróżnych',
  'split.label': 'Podział między',
  'split.everyone': 'Wszyscy',
  'split.nobody': 'Nikt',
  'split.departed': 'Nie ma już w podróży',
  'split.departedHint':
    'Po zapisaniu zmian udział odznaczonej osoby, której już nie ma w podróży, zostanie usunięty na stałe.',
  'split.removedNumbered': 'Usunięty podróżnik {number}',
  'split.includeRemoved': 'Uwzględnij usuniętego podróżnika w tym podziale',
  'split.includeRemovedNumbered':
    'Uwzględnij usuniętego podróżnika {number} w tym podziale',
  'split.includeFor': 'Uwzględnij {name} w tym podziale',
  'split.how': 'Jak dzieli się ten wydatek',
  'split.method.equal': 'Po równo',
  'split.method.equalHint':
    'Każdy uwzględniony płaci tyle samo, a nieparzysta najmniejsza jednostka idzie do pierwszej osoby na liście.',
  'split.method.exact': 'Co do kwoty',
  'split.method.exactHint':
    'Wpisz, ile każdy naprawdę ma zapłacić. Kwoty muszą się zsumować do całości.',
  'split.method.shares': 'Udziały',
  'split.method.sharesHint':
    'Zważ podział - 2 udziały dla pary, 1 dla pozostałych.',
  'split.method.percentage': 'Procenty',
  'split.method.percentageHint':
    'Podział procentowy. Procenty muszą się zsumować do 100.',
  'split.exactFor': 'Dokładna kwota dla {name}',
  'split.percentFor': 'Procent dla {name}',
  'split.sharesFor': 'Udziały dla {name}',
  'split.balanced': 'Zgadza się',
  'split.allocated': 'przypisane {allocated} z {total}',
  'split.over': '{amount} za dużo',
  'split.left': 'zostało {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Kwota',
  'field.currency': 'Waluta',
  'field.date': 'Data',
  'field.paidBy': 'Zapłacił',
  'expense.editTitle': 'Edytuj ten wydatek',
  'expense.addTitle': 'Dodaj wydatek',
  'expense.editDescription':
    'Zmiana kwoty dzieli ją ponownie między wszystkich uwzględnionych poniżej.',
  'expense.addDescription':
    'Kwoty tego wyjazdu trzymamy w {currency}. Zapisz paragon w jego własnej walucie i podaj, na ile się przeliczył.',
  'expense.saveFailed': 'Nie udało się zapisać',
  'expense.splitOff.title': 'Zapisane udziały nie sumują się do kwoty',
  'expense.splitOff.body':
    'Razem dają {shares}, a suma to {total}. Sprawdź podział poniżej i zapisz, aby to naprawić.',
  'expense.what': 'Za co to było',
  'expense.whatPlaceholder': 'Kolacja w Kyubey',
  'expense.amountNotANumber': 'Wpisz kwotę jako liczbę.',
  'expense.convertedTo': 'Przeliczone na {currency}',
  'expense.convertedHint': 'Ile {from} wyszło w {to} na twoim wyciągu.',
  'expense.convertedSuggested':
    'Podpowiedź z kursu użytego w tej podróży dnia {date} ({rate}). Zmień kwotę, aby zgadzała się z twoim wyciągiem.',
  'expense.convertedNotANumber': 'Wpisz przeliczoną kwotę jako liczbę.',
  'expense.paidByHint':
    'Zostaw bez płatnika, jeśli zapisujesz paragon, którego nikt jeszcze nie pokrył.',
  'expense.nobodyYet': 'Jeszcze nikt',
  'expense.notesHint': 'Opcjonalnie. Cokolwiek, czego paragon nie mówi.',
  'expense.notesPlaceholder': 'Podzielone menu degustacyjne, napoje osobno.',
  'expense.noAmount': 'Jeszcze bez kwoty',
  'expense.saving': 'Zapisywanie wydatku',
  'expense.saveChanges': 'Zapisz zmiany',
  'expense.add': 'Dodaj wydatek',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Zapisz płatność',
  'payment.description':
    'Zapisanie przelewu zdejmuje go z obu sald. Nie przenosi żadnych pieniędzy - planned.travel prowadzi rozliczenie, przelew robi twój bank.',
  'payment.youSuffix': '{name} (ty)',
  'payment.pays': '{from} płaci {to}',
  'payment.pickTwo': 'Wybierz dwie różne osoby.',
  'payment.paidTo': 'Zapłacone do',
  'payment.needsTwo': 'Płatność wymaga dwóch różnych osób.',
  'payment.amountIn': 'Kwota w {currency}',
  'payment.amountPositive': 'Wpisz kwotę większą od zera.',
  'payment.how': 'Jak',
  'payment.note': 'Notatka',
  'payment.noteHint': 'Opcjonalnie. Numer referencyjny albo za co to było.',
  'payment.notePlaceholder': 'Za hotel w Kioto i bilety JR.',
  'payment.recording': 'Zapisywanie płatności',
  'payment.confirm': 'Zapisz płatność',
  'payment.failed': 'Nie udało się zapisać płatności. Spróbuj za chwilę.',
  'payment.method.bankTransfer': 'Przelew bankowy',
  'payment.method.cash': 'Gotówka',
  'payment.method.card': 'Karta',
  'payment.method.app': 'Aplikacja płatnicza',
  'payment.method.other': 'Coś innego',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Rozliczenie',
  'settle.addPayment': 'Dodaj wpłatę',
  'settle.action': 'Rozlicz',
  'settle.empty.title': 'Wszyscy są na zero',
  'settle.empty.body':
    'Nic nie trzeba przelewać. Dodaj wydatek, a każda nierówność pojawi się tutaj.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Salda',
  'balances.count': {
    one: '{travellers} podróżnik',
    few: '{travellers} podróżnicy',
    many: '{travellers} podróżników',
    other: '{travellers} podróżnika',
  },
  'balances.empty': 'Salda pojawią się, gdy wydatek ma płatnika i podział.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Według kategorii',
  'categories.againstBudget': 'Wobec budżetu wyjazdu',
  'categories.progressLabel': 'Wydane wobec budżetu wyjazdu',
  'categories.empty':
    'Pozycje budżetu i wydatki rozbijają się tutaj, gdy jest co rozbijać.',
  'categories.legendLabel': 'Wydatki według kategorii',
  'categories.planned': '{amount} zaplanowano',
  'categories.nothingSpent': 'Jeszcze nic nie wydano. Oto, co zaplanowano.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'mniej niż {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Na kogo wydano pieniądze',
  'memberBar.others': {
    one: '{others} inny podróżnik',
    few: '{others} innych podróżników',
    many: '{others} innych podróżników',
    other: '{others} innego podróżnika',
  },
  'memberBar.notSplit': 'Nieprzypisane nikomu',
  'totalTile.label': 'Łączne wydatki na podróż',
  'totalTile.captionPlanned': 'Zaplanowano {amount} dla wszystkich podróżników',
  'totalTile.captionBudget': 'Budżet podróży: {amount}',
  'totalTile.yourShare': 'Twój udział',
  'totalTile.youPaid': 'Zapłacone przez Ciebie',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Zapisane wpłaty',
  'payments.empty.title': 'Jeszcze bez wpłat',
  'payments.empty.body':
    'Gdy ktoś oddaje saldo, przelew zostaje zapisany tutaj.',
  'payments.delete': 'Usuń płatność od {from} do {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Ta podróż jest zarchiwizowana. Przywróć ją, aby zmienić koszty.',
  'readOnly.title': 'Koszty możesz przeglądać, ale nie zmieniać',
  'readOnly.body':
    'Wydatki dodają, zmieniają i usuwają oraz wpłaty zapisują tylko właściciele wyjazdu i osoby, które mogą go edytować. Jeśli coś trzeba poprawić, poproś właściciela.',
  'readOnly.empty':
    'Na tym wyjeździe nie zapisano jeszcze żadnych wydatków. Pojawią się tutaj, gdy doda je właściciel lub edytor.',
  'readOnly.settleEmpty':
    'Na razie nie trzeba robić żadnych przelewów. Ewentualna nierównowaga pojawiłaby się tutaj.',
  'refusal.rebaseChanged':
    'Wyjazd zmienił się w trakcie potwierdzania, więc nic nie zostało zmienione. Sprawdź nowe kwoty i potwierdź ponownie.',
  'refusal.tripCurrencyChanged':
    'Waluta budżetu tego wyjazdu to teraz {to}, więc nic nie zostało zapisane. Strona została odświeżona: sprawdź kwotę i zapisz ponownie.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Waluta wyświetlania',
  'display.indicator.perTrip': 'Waluta wyjazdu',
  'display.indicator.fixed': 'Także w {code}',
  'display.menu.perTrip': 'Każdy wyjazd w jego walucie',
  'display.menu.workspace': '{code} (domyślna w przestrzeni)',
  'display.menu.rateHint': 'Używa kursu zapisanego na wyjeździe',
  'display.menu.currentHint':
    'Wybrana, ale żaden zapisany kurs jej nie obejmuje',
  'display.menu.needsLiveRate':
    'Wymaga kursu bieżącego, który nie jest jeszcze dostępny',
  'display.menu.disabledHint':
    'Waluty bez zapisanego kursu są na liście, ale nie można ich wybrać: wymagają kursu bieżącego, który nie jest jeszcze dostępny.',
  'display.menu.saving': 'Zapisywanie wyboru',
  'display.error.title': 'Nie zapisano waluty wyświetlania',
  'display.error.body':
    'Nie udało się zapisać wyboru. Spróbuj ponownie za chwilę.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': 'Około {amount} {code} w walucie wyświetlania',
  'display.row.notConverted': 'Nieprzeliczone',
  'display.alert.title': 'Część kwot nie jest przeliczona',
  'display.alert.body':
    'Dla tych par walut nie zapisano kursu, więc te kwoty zostają w walucie budżetu:',
  'display.alert.pair': '{from} na {to}, {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Zmień walutę budżetu',
  'rebase.title': 'Zmiana waluty budżetu',
  'rebase.description':
    'Wpisane kwoty zostają takie, jakie je wpisano. Sumy i salda tego wyjazdu zostaną przeliczone na nową walutę.',
  'rebase.to': 'Nowa waluta',
  'rebase.toPlaceholder': 'Wybierz walutę',
  'rebase.rateLabel': 'Kurs wymiany (1 {from} w {to})',
  'rebase.rateInverse': 'Czyli 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Wpisz kurs większy od zera.',
  'rebase.rateOutOfRange':
    'Ten kurs wygląda na zdecydowanie za duży lub za mały. Sprawdź, w którą stronę jest podany.',
  'rebase.source.recent': 'Ostatni kurs użyty w tej przestrzeni',
  'rebase.source.manual': 'Kurs wpisany przez ciebie',
  'rebase.noRate':
    'Brak zapisanego kursu {from} na {to}. Wpisz kurs, którego chcesz użyć.',
  'rebase.waitingForRate': 'Podgląd pojawi się, gdy tylko będzie kurs.',
  'rebase.loading': 'Trwa przeliczanie',
  'rebase.example':
    '{original} zostaje tak, jak wpisano, i jest liczone jako {converted}.',
  'rebase.count.expenses': {
    one: '{count} wydatek zostanie policzony w {to}.',
    few: '{count} wydatki zostaną policzone w {to}.',
    many: '{count} wydatków zostanie policzonych w {to}.',
    other: '{count} wydatku zostanie policzonego w {to}.',
  },
  'rebase.count.payments': {
    one: '{count} płatność zostanie policzona w {to}.',
    few: '{count} płatności zostaną policzone w {to}.',
    many: '{count} płatności zostanie policzonych w {to}.',
    other: '{count} płatności zostanie policzonej w {to}.',
  },
  'rebase.count.planned': {
    one: '{count} zaplanowana pozycja zostanie policzona w {to}.',
    few: '{count} zaplanowane pozycje zostaną policzone w {to}.',
    many: '{count} zaplanowanych pozycji zostanie policzonych w {to}.',
    other: '{count} zaplanowanej pozycji zostanie policzonej w {to}.',
  },
  'rebase.pinned':
    'Ceny miejsc, rezerwacji, noclegów i przejazdów zostają w {from}.',
  'rebase.target': 'Budżet wyjazdu {before} zmieni się na {after}.',
  'rebase.rounding':
    'Każda kwota jest zaokrąglana raz, więc saldo może się zmienić najwyżej o {amount}.',
  'rebase.leftover':
    'Po zmianie: {name} - dług wobec {other} wyniesie {amount}.',
  'rebase.someone': 'Ktoś',
  'rebase.nothing':
    'Nic na tym wyjeździe nie ma jeszcze ceny, więc nie ma czego przeliczać.',
  'rebase.unconverted': {
    one: '{count} pozycja jest w innej walucie niż {from} i nie da się jej przeliczyć automatycznie. To zwykle wydatek utworzony z rezerwacji z ceną w innej walucie: edytuj go lub usuń, a potem spróbuj ponownie.',
    few: '{count} pozycje są w innej walucie niż {from} i nie da się ich przeliczyć automatycznie. To zwykle wydatki utworzone z rezerwacji z ceną w innej walucie: edytuj je lub usuń, a potem spróbuj ponownie.',
    many: '{count} pozycji jest w innej walucie niż {from} i nie da się ich przeliczyć automatycznie. To zwykle wydatki utworzone z rezerwacji z ceną w innej walucie: edytuj je lub usuń, a potem spróbuj ponownie.',
    other:
      '{count} pozycji jest w innej walucie niż {from} i nie da się ich przeliczyć automatycznie. To zwykle wydatki utworzone z rezerwacji z ceną w innej walucie: edytuj je lub usuń, a potem spróbuj ponownie.',
  },
  'rebase.unsplittable': {
    one: '{count} wydatek ma podział, którego nie da się przenieść, bo każdy udział w nim wynosi zero. Edytuj go lub usuń, a potem spróbuj ponownie.',
    few: '{count} wydatki mają podział, którego nie da się przenieść, bo każdy udział w nich wynosi zero. Edytuj je lub usuń, a potem spróbuj ponownie.',
    many: '{count} wydatków ma podział, którego nie da się przenieść, bo każdy udział w nich wynosi zero. Edytuj je lub usuń, a potem spróbuj ponownie.',
    other:
      '{count} wydatku ma podział, którego nie da się przenieść, bo każdy udział w nim wynosi zero. Edytuj go lub usuń, a potem spróbuj ponownie.',
  },
  'rebase.outOfRange':
    'Przy tym kursie jakaś kwota na wyjeździe byłaby zbyt duża, by zapisać ją w {to}. Sprawdź kurs i w którą stronę jest podany.',
  'rebase.tooLarge':
    'Ten wyjazd ma za dużo pozycji, by zmienić je w jednym kroku: potrzeba by {changes} zmian naraz, a limit to {limit}. Budżet na razie zostaje w {from}.',
  'rebase.copyPending':
    'Ten wyjazd jest jeszcze kopiowany. Spróbuj ponownie za chwilę.',
  'rebase.error':
    'Nie udało się wczytać przeliczenia. Nic nie zostało zmienione.',
  'rebase.commitError':
    'Nie udało się zmienić waluty budżetu. Nic nie zostało zmienione.',
  'rebase.stale':
    'Waluta budżetu podróży to teraz {current}, a nie {from}. Zamknij to okno i otwórz je ponownie.',
  'rebase.sameCurrency': 'Budżet jest już w walucie {to}. Wybierz inną walutę.',
  'rebase.commitUnknown':
    'Nie udało się potwierdzić, czy waluta budżetu zmieniła się na {to}. Zanim spróbujesz ponownie, odśwież stronę i sprawdź.',
  'rebase.retry': 'Spróbuj ponownie',
  'rebase.confirm': 'Zmień na {to}',
  'rebase.committing': 'Zmieniam walutę budżetu',
  'rebase.done': 'Budżet jest teraz w {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Jeszcze nic nie wydano',
  'screen.summary': '{expenses} · wydano {spent}',
  'count.expenses': {
    one: '{expenses} wydatek',
    few: '{expenses} wydatki',
    many: '{expenses} wydatków',
    other: '{expenses} wydatku',
  },
  'screen.exportCsv': 'Eksportuj CSV',
  'screen.addFirst': 'Dodaj pierwszy wydatek',
  'screen.empty.title': 'Brak wydatków',
  'screen.empty.body':
    'Zapisuj wydatki na bieżąco. planned.travel dzieli je między wszystkich podróżnych i trzyma bieżącą sumę w {currency}.',
  'screen.filtered.title': 'Nic nie pasuje do tych filtrów',
  'screen.filtered.body':
    'Rozszerz wyszukiwanie, wybierz inny dzień albo wyczyść filtry, żeby znów zobaczyć cały wyjazd.',
  'export.empty.title': 'Nie ma czego eksportować',
  'export.empty.body': 'Żaden wydatek nie pasuje do włączonych filtrów.',
  'export.ready.title': 'Eksport gotowy',
  'export.ready.body': {
    one: 'Do pliku CSV zapisano {expenses} wydatek.',
    few: 'Do pliku CSV zapisano {expenses} wydatki.',
    many: 'Do pliku CSV zapisano {expenses} wydatków.',
    other: 'Do pliku CSV zapisano {expenses} wydatku.',
  },
  'export.csv.title': 'Tytuł',
  'export.csv.category': 'Kategoria',
  'export.csv.originalAmount': 'Kwota oryginalna',
  'export.csv.originalCurrency': 'Waluta oryginalna',
  'export.csv.rate': 'Kurs',
  'export.csv.splitMethod': 'Sposób podziału',
  'export.csv.notes': 'Notatki',
  'export.csv.amountIn': 'Kwota w {currency}',
  'list.daySpent': 'wydano {amount}',
  'skeleton.loading': 'Wczytywanie wydatków',
  'row.noPayer': 'Brak płatnika',
  'row.youPaid': 'Zapłacone przez Ciebie',
  'row.paid': '{name} zapłacił(a)',
  'row.notYourShare': 'to nie Twoja część',
  'row.yourShare': 'Twoja część: {amount}',
  'row.noteOn': 'Notatka do: {title}',
  'row.edit': 'Edytuj: {title}',
  'row.delete': 'Usuń: {title}',
  'row.saving': 'Zapisywanie',
  'row.splitOff': 'Udziały nie sumują się do kwoty',
  'tile.owe.label': 'Twój dług',
  'tile.owe.settled': 'Wszystko rozliczone',
  'tile.owe.pending': 'Rozlicz się przed powrotem do domu',
  'tile.owe.to': 'Komu',
  'tile.owed.label': 'Należy Ci się',
  'tile.owed.none': 'Nikt nie jest Ci nic winien',
  'tile.owed.pending': 'Jeszcze do Ciebie wróci',
  'tile.owed.from': 'Od kogo',
  'tile.outstanding.label': 'Do rozliczenia',
  'tile.outstanding.none': 'Każdy wydatek ma płatnika',
  'tile.outstanding.some': {
    one: '{expenses} wydatek bez płatnika',
    few: '{expenses} wydatki bez płatnika',
    many: '{expenses} wydatków bez płatnika',
    other: '{expenses} wydatku bez płatnika',
  },
  'category.accommodation': 'Nocleg',
  'category.transport': 'Transport',
  'category.food': 'Jedzenie i picie',
  'category.activities': 'Atrakcje',
  'category.shopping': 'Zakupy',
  'category.fees': 'Opłaty',
  'category.insurance': 'Ubezpieczenie',
  'category.other': 'Inne',
  'toolbar.summary.everything': 'Widać wszystko',
  'toolbar.summary.filtered': 'Filtry: {filters}',
  'toolbar.summary.search': 'pasuje do „{term}”',
  'write.added': 'Dodano wydatek',
  'write.updated': 'Zaktualizowano wydatek',
  'write.deleted': 'Usunięto wydatek',
  'write.addFailed': 'Nie dodano wydatku',
  'write.editFailed': 'Nie zapisano wydatku',
  'write.deleteFailed': 'Nie usunięto wydatku',
  'write.paymentRecorded': 'Zapisano płatność',
  'write.paymentRecordedBody': 'Oba salda są zaktualizowane.',
  'write.paymentFailed': 'Nie zapisano płatności',
  'write.paymentDeleted': 'Usunięto płatność',
  'write.paymentDeleteFailed': 'Nie usunięto płatności',
  'write.rolledBack': 'Zmiana została cofnięta.',
  'expense.saveFallback': 'Nie udało się zapisać wydatku. Spróbuj za chwilę.',
} satisfies TranslationOf<typeof En>

export default messages
