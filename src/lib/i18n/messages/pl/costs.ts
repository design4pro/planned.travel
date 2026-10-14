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
  'expense.what': 'Za co to było',
  'expense.whatPlaceholder': 'Kolacja w Kyubey',
  'expense.amountNotANumber': 'Wpisz kwotę jako liczbę.',
  'expense.currencyLabel': 'Waluta, w której wystawiono paragon',
  'expense.convertedTo': 'Przeliczone na {currency}',
  'expense.convertedHint': 'Ile {from} wyszło w {to} na twoim wyciągu.',
  'expense.convertedSuggested':
    'Podpowiedź z kursu użytego w tej podróży dnia {date} ({rate}). Zmień kwotę, aby zgadzała się z twoim wyciągiem.',
  'expense.convertedNotANumber': 'Wpisz przeliczoną kwotę jako liczbę.',
  'expense.dateLabel': 'Data wydatku',
  'expense.paidByHint':
    'Zostaw bez płatnika, jeśli zapisujesz paragon, którego nikt jeszcze nie pokrył.',
  'expense.nobodyYet': 'Jeszcze nikt',
  'expense.whoPaid': 'Kto zapłacił',
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
  'payment.whoPaying': 'Kto płaci',
  'payment.whoPaid': 'Kto otrzymuje',
  'payment.amountIn': 'Kwota w {currency}',
  'payment.amountPositive': 'Wpisz kwotę większą od zera.',
  'payment.currencyLabel': 'Waluta, w której dokonano płatności',
  'payment.how': 'Jak',
  'payment.howMade': 'Jak wykonano płatność',
  'payment.dateLabel': 'Data płatności',
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
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Koszty możesz przeglądać, ale nie zmieniać',
  'readOnly.body':
    'Wydatki dodają, zmieniają i usuwają oraz wpłaty zapisują tylko właściciele wyjazdu i osoby, które mogą go edytować. Jeśli coś trzeba poprawić, poproś właściciela.',
  'readOnly.empty':
    'Na tym wyjeździe nie zapisano jeszcze żadnych wydatków. Pojawią się tutaj, gdy doda je właściciel lub edytor.',
  'readOnly.settleEmpty':
    'Na razie nie trzeba robić żadnych przelewów. Ewentualna nierównowaga pojawiłaby się tutaj.',
} satisfies TranslationOf<typeof En>

export default messages
