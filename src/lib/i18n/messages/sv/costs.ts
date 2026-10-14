/**
 * The costs tab's copy, in sv.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Du',
  'person.youTarget': 'dig',
  'person.removed': 'Borttagen resenär',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Ta bort den här utgiften?',
  'delete.description':
    '”{title}” och dess fördelning lämnar avräkningen. Det går inte att ångra.',
  'delete.failed': 'Borttagningen misslyckades',
  'delete.failedBody': 'Utgiften kunde inte tas bort. Försök igen om en stund.',
  'delete.noBalances': 'Inget saldo ändras - inget var fördelat på den.',
  'delete.balancesChange': 'Saldona för {names} ändras.',
  'delete.confirm': 'Ta bort utgift',
  'delete.working': 'Utgiften tas bort',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Utgifter',
  'toolbar.shownOf': '{shown} av {total}',
  'toolbar.searchPlaceholder': 'Sök i utgifter, anteckningar eller betalare…',
  'toolbar.searchLabel': 'Sök utgifter',
  'toolbar.allCategories': 'Alla kategorier',
  'toolbar.allDays': 'Alla dagar',
  'toolbar.filterCategory': 'Filtrera på kategori',
  'toolbar.filterDay': 'Filtrera på dag',
  'toolbar.whose': 'Vems utgifter',
  'toolbar.paidByMe': 'Betalda av mig',
  'toolbar.owedToMe': 'Jag ska ha',
  'toolbar.logged': {
    one: '{value} registrerad',
    other: '{value} registrerade',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Fördelning mellan resenärerna',
  'split.label': 'Fördela mellan',
  'split.everyone': 'Alla',
  'split.nobody': 'Ingen',
  'split.departed': 'Har lämnat resan',
  'split.departedName': 'En tidigare resenär',
  'split.departedHint':
    'Om du avmarkerar någon som har lämnat resan tas den personens andel bort för gott.',
  'split.includeFor': 'Ta med {name} i den här fördelningen',
  'split.how': 'Hur den här utgiften fördelas',
  'split.method.equal': 'Jämnt',
  'split.method.equalHint':
    'Alla som räknas med betalar lika mycket, och den överblivna minsta enheten går till den första i listan.',
  'split.method.exact': 'Exakt',
  'split.method.exactHint':
    'Skriv vad var och en faktiskt ska betala. Beloppen måste bli summan.',
  'split.method.shares': 'Andelar',
  'split.method.sharesHint':
    'Vikta fördelningen - 2 andelar för ett par, 1 för alla andra.',
  'split.method.percentage': 'Procent',
  'split.method.percentageHint': 'Fördela i procent. Procenten måste bli 100.',
  'split.exactFor': 'Exakt belopp för {name}',
  'split.percentFor': 'Procent för {name}',
  'split.sharesFor': 'Andelar för {name}',
  'split.balanced': 'Stämmer',
  'split.allocated': '{allocated} av {total} fördelat',
  'split.over': '{amount} för mycket',
  'split.left': '{amount} kvar',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Belopp',
  'field.currency': 'Valuta',
  'field.date': 'Datum',
  'field.paidBy': 'Betalad av',
  'expense.editTitle': 'Redigera den här utgiften',
  'expense.addTitle': 'Lägg till en utgift',
  'expense.editDescription':
    'Om du ändrar beloppet fördelas det om mellan alla som räknas med nedan.',
  'expense.addDescription':
    'Belopp hålls i {currency} för den här resan. Skriv upp ett kvitto i dess egen valuta och ange vad det blev omräknat.',
  'expense.saveFailed': 'Det gick inte att spara',
  'expense.what': 'Vad var det för',
  'expense.whatPlaceholder': 'Middag på Kyubey',
  'expense.amountNotANumber': 'Skriv beloppet som ett tal.',
  'expense.currencyLabel': 'Valuta som kvittot är skrivet i',
  'expense.convertedTo': 'Omräknat till {currency}',
  'expense.convertedHint': 'Vad {from} blev i {to} på ditt utdrag.',
  'expense.convertedSuggested':
    'Föreslaget utifrån kursen som användes på den här resan den {date} ({rate}). Ändra så att det stämmer med ditt kontoutdrag.',
  'expense.convertedNotANumber': 'Skriv det omräknade beloppet som ett tal.',
  'expense.dateLabel': 'Datum för utgiften',
  'expense.paidByHint':
    'Lämna den utan betalare om du skriver upp ett kvitto ingen har täckt än.',
  'expense.nobodyYet': 'Ingen än',
  'expense.whoPaid': 'Vem som betalade',
  'expense.notesHint': 'Frivilligt. Allt kvittot inte säger.',
  'expense.notesPlaceholder': 'Delad avsmakningsmeny, drycker separat.',
  'expense.noAmount': 'Inget belopp än',
  'expense.saving': 'Utgiften sparas',
  'expense.saveChanges': 'Spara ändringar',
  'expense.add': 'Lägg till utgift',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Registrera en betalning',
  'payment.description':
    'En registrerad överföring försvinner ur båda saldona. Den flyttar inga pengar - planned.travel håller avräkningen, din bank flyttar pengarna.',
  'payment.youSuffix': '{name} (du)',
  'payment.pays': '{from} betalar {to}',
  'payment.pickTwo': 'Välj två olika personer.',
  'payment.paidTo': 'Betalad till',
  'payment.needsTwo': 'En betalning behöver två olika personer.',
  'payment.whoPaying': 'Vem som betalar',
  'payment.whoPaid': 'Vem som får',
  'payment.amountIn': 'Belopp i {currency}',
  'payment.amountPositive': 'Skriv ett belopp större än noll.',
  'payment.currencyLabel': 'Valuta som betalningen gjordes i',
  'payment.how': 'Hur',
  'payment.howMade': 'Hur betalningen gjordes',
  'payment.dateLabel': 'Datum för betalningen',
  'payment.note': 'Anteckning',
  'payment.noteHint': 'Frivilligt. En referens, eller vad den täckte.',
  'payment.notePlaceholder': 'Täcker hotellet i Kyoto och JR-korten.',
  'payment.recording': 'Betalningen registreras',
  'payment.confirm': 'Registrera betalning',
  'payment.failed':
    'Betalningen kunde inte registreras. Försök igen om en stund.',
  'payment.method.bankTransfer': 'Banköverföring',
  'payment.method.cash': 'Kontant',
  'payment.method.card': 'Kort',
  'payment.method.app': 'Betalapp',
  'payment.method.other': 'Något annat',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Gör upp',
  'settle.addPayment': 'Lägg till betalning',
  'settle.action': 'Gör upp',
  'settle.empty.title': 'Alla är kvitt',
  'settle.empty.body':
    'Inga överföringar behövs. Lägg till en utgift och varje obalans dyker upp här.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldon',
  'balances.count': {
    one: '{travellers} resenär',
    other: '{travellers} resenärer',
  },
  'balances.empty':
    'Saldon visas när en utgift har en betalare och en fördelning.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Per kategori',
  'categories.againstBudget': 'Mot resans budget',
  'categories.progressLabel': 'Spenderat mot resans budget',
  'categories.empty':
    'Budgetposter och utgifter bryts ner här när det finns något att bryta ner.',
  'categories.legendLabel': 'Utgifter per kategori',
  'categories.planned': '{amount} planerat',
  'categories.nothingSpent': 'Inget är utgivet än. Det här har ni planerat.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'mindre än {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Vem pengarna gick till',
  'memberBar.others': {
    one: '{others} annan resenär',
    other: '{others} andra resenärer',
  },
  'memberBar.notSplit': 'Inte tilldelat någon',
  'totalTile.label': 'Reseutgifter totalt',
  'totalTile.captionPlanned': '{amount} planerat för alla resenärer',
  'totalTile.captionBudget': '{amount} i budget för resan',
  'totalTile.yourShare': 'Din andel',
  'totalTile.youPaid': 'Du betalade',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Registrerade betalningar',
  'payments.empty.title': 'Inga betalningar än',
  'payments.empty.body':
    'När någon betalar tillbaka ett saldo loggas överföringen här.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Du kan se kostnaderna men inte ändra dem',
  'readOnly.body':
    'Bara resens ägare och de som får redigera den lägger till, ändrar eller tar bort utgifter och registrerar betalningar. Fråga en ägare om något behöver ändras.',
  'readOnly.empty':
    'Inga utgifter har registrerats för den här resan än. De visas här när en ägare eller redigerare lägger till dem.',
  'readOnly.settleEmpty':
    'Just nu behövs inga överföringar. Eventuell obalans skulle visas här.',
  'refusal.rebaseChanged':
    'Resan ändrades medan du bekräftade, så ingenting har ändrats. Kontrollera de nya beloppen och bekräfta igen.',
  'refusal.tripCurrencyChanged':
    'Budgetvalutan för den här resan är nu {to}, så ingenting sparades. Sidan har uppdaterats: kontrollera beloppet och spara igen.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Visningsvaluta',
  'display.indicator.perTrip': 'Egen valuta',
  'display.indicator.fixed': 'Även i {code}',
  'display.menu.perTrip': 'Varje resa i sin egen valuta',
  'display.menu.workspace': '{code} (arbetsytans standard)',
  'display.menu.rateHint': 'Använder en kurs som redan är sparad på en resa',
  'display.menu.currentHint': 'Vald, men ingen sparad kurs täcker den',
  'display.menu.needsLiveRate':
    'Kräver en aktuell kurs, som inte är tillgänglig ännu',
  'display.menu.saving': 'Sparar ditt val',
  'display.error.title': 'Visningsvalutan sparades inte',
  'display.error.body': 'Ditt val kunde inte sparas. Försök igen om en stund.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': 'Ungefär {amount} {code} i din visningsvaluta',
  'display.row.notConverted': 'Inte omräknat',
  'display.alert.title': 'Vissa belopp är inte omräknade',
  'display.alert.body':
    'För dessa valutapar finns ingen sparad kurs, så beloppen stannar i budgetvalutan:',
  'display.alert.pair': '{from} till {to} den {date}',
} satisfies TranslationOf<typeof En>

export default messages
