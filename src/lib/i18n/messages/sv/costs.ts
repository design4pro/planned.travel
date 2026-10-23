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
  'person.removedTarget': 'en borttagen resenär',
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
  'delete.payment.title': 'Ta bort den här betalningen?',
  'delete.payment.description':
    '”{title}” lämnar avräkningen. Det går inte att ångra. Vill du rätta en betalning, registrera den på nytt.',
  'delete.payment.failedBody':
    'Betalningen kunde inte tas bort. Försök igen om en stund.',
  'delete.payment.confirm': 'Ta bort betalning',
  'delete.payment.working': 'Betalningen tas bort',

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
  'expense.splitOff.title': 'De sparade andelarna summerar inte till totalen',
  'expense.splitOff.body':
    'De blir tillsammans {shares}, men kostnaden är {total}. Justera andelarna och spara för att rätta till det.',
  'expense.what': 'Vad var det för',
  'expense.whatPlaceholder': 'Middag på Kyubey',
  'expense.amountNotANumber': 'Skriv beloppet som ett tal.',
  'expense.convertedTo': 'Omräknat till {currency}',
  'expense.convertedHint': 'Vad {from} blev i {to} på ditt utdrag.',
  'expense.convertedSuggested':
    'Föreslaget utifrån kursen som användes på den här resan den {date} ({rate}). Ändra så att det stämmer med ditt kontoutdrag.',
  'expense.convertedNotANumber': 'Skriv det omräknade beloppet som ett tal.',
  'expense.paidByHint':
    'Lämna den utan betalare om du skriver upp ett kvitto ingen har täckt än.',
  'expense.nobodyYet': 'Ingen än',
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
  'payment.amountIn': 'Belopp i {currency}',
  'payment.amountPositive': 'Skriv ett belopp större än noll.',
  'payment.how': 'Hur',
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
  'payments.delete': 'Ta bort betalningen från {from} till {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Den här resan är arkiverad. Återställ den innan du ändrar kostnaderna.',
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
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Ändra budgetvaluta',
  'rebase.title': 'Ändra budgetvalutan',
  'rebase.description':
    'Beloppen du skrev in står kvar som de är. Resans summor och saldon räknas om till den nya valutan.',
  'rebase.to': 'Ny valuta',
  'rebase.toPlaceholder': 'Välj en valuta',
  'rebase.rateLabel': 'Växelkurs (1 {from} i {to})',
  'rebase.rateInverse': 'Det betyder 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Skriv en kurs som är större än noll.',
  'rebase.rateOutOfRange':
    'Kursen ser alldeles för stor eller för liten ut. Kontrollera åt vilket håll den gäller.',
  'rebase.source.recent': 'Den senast använda kursen i den här arbetsytan',
  'rebase.source.manual': 'Kursen du skrev in',
  'rebase.noRate':
    'Det finns ingen sparad kurs för {from} till {to}. Skriv in den kurs du vill använda.',
  'rebase.waitingForRate': 'Förhandsvisningen visas så fort det finns en kurs.',
  'rebase.loading': 'Räknar ut omräkningen',
  'rebase.example':
    '{original} står kvar som du skrev det och räknas som {converted}.',
  'rebase.count.expenses': {
    one: '{count} utgift räknas i {to}.',
    other: '{count} utgifter räknas i {to}.',
  },
  'rebase.count.payments': {
    one: '{count} betalning räknas i {to}.',
    other: '{count} betalningar räknas i {to}.',
  },
  'rebase.count.planned': {
    one: '{count} planerad post räknas i {to}.',
    other: '{count} planerade poster räknas i {to}.',
  },
  'rebase.pinned':
    'Priser på platser, bokningar, boenden och färder står kvar i {from}.',
  'rebase.target': 'Resans budget {before} blir {after}.',
  'rebase.rounding':
    'Varje belopp avrundas en gång, så ett saldo kan förskjutas med upp till {amount}.',
  'rebase.leftover':
    'Efter ändringen skulle {name} vara skyldig {other} {amount}.',
  'rebase.someone': 'Någon',
  'rebase.nothing':
    'Inget på den här resan har något pris än, så det finns inget att räkna om.',
  'rebase.unconverted': {
    one: '{count} post är i en annan valuta än {from} och kan inte räknas om automatiskt. Det är oftast en utgift som skapats från en bokning med pris i en annan valuta: redigera eller ta bort den och försök igen.',
    other:
      '{count} poster är i en annan valuta än {from} och kan inte räknas om automatiskt. Det är oftast utgifter som skapats från bokningar med pris i en annan valuta: redigera eller ta bort dem och försök igen.',
  },
  'rebase.unsplittable': {
    one: '{count} utgift har en delning som inte kan föras över, eftersom alla andelar i den är noll. Redigera eller ta bort den och försök igen.',
    other:
      '{count} utgifter har en delning som inte kan föras över, eftersom alla andelar i dem är noll. Redigera eller ta bort dem och försök igen.',
  },
  'rebase.outOfRange':
    'Med den här kursen skulle ett belopp på resan bli för stort för att sparas i {to}. Kontrollera kursen och åt vilket håll den gäller.',
  'rebase.tooLarge':
    'Den här resan har för många poster för att ändras i ett steg: det skulle krävas {changes} ändringar på en gång och gränsen är {limit}. Budgeten står kvar i {from} tills vidare.',
  'rebase.copyPending': 'Resan kopieras fortfarande. Försök igen om en stund.',
  'rebase.error': 'Omräkningen kunde inte läsas in. Inget har ändrats.',
  'rebase.commitError': 'Vi kunde inte ändra budgetvalutan. Inget har ändrats.',
  'rebase.stale':
    'Resans budgetvaluta är nu {current}, inte {from}. Stäng dialogrutan och öppna den igen.',
  'rebase.sameCurrency': 'Budgeten är redan i {to}. Välj en annan valuta.',
  'rebase.commitUnknown':
    'Vi kunde inte bekräfta om budgetvalutan ändrades till {to}. Ladda om sidan och kontrollera innan du försöker igen.',
  'rebase.retry': 'Försök igen',
  'rebase.confirm': 'Ändra till {to}',
  'rebase.committing': 'Ändrar budgetvalutan',
  'rebase.done': 'Budgeten är nu i {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Inget spenderat ännu',
  'screen.summary': '{expenses} · {spent} spenderat',
  'count.expenses': {
    one: '{expenses} utgift',
    other: '{expenses} utgifter',
  },
  'screen.exportCsv': 'Exportera CSV',
  'screen.addFirst': 'Lägg till den första utgiften',
  'screen.empty.title': 'Inga utgifter ännu',
  'screen.empty.body':
    'Skriv upp vad du spenderar längs vägen. planned.travel delar upp det mellan alla resenärer och håller löpande summa i {currency}.',
  'screen.filtered.title': 'Inget matchar de filtren',
  'screen.filtered.body':
    'Bredda sökningen, välj en annan dag eller rensa filtren för att se hela resan igen.',
  'export.empty.title': 'Inget att exportera',
  'export.empty.body': 'Ingen utgift matchar de filter som är på.',
  'export.ready.title': 'Exporten är klar',
  'export.ready.body': {
    one: '{expenses} utgift skriven till CSV.',
    other: '{expenses} utgifter skrivna till CSV.',
  },
  'list.daySpent': '{amount} spenderat',
  'skeleton.loading': 'Laddar utgifterna',
  'row.noPayer': 'Ingen betalare ännu',
  'row.youPaid': 'Du betalade',
  'row.paid': '{name} betalade',
  'row.notYourShare': 'inte din andel',
  'row.yourShare': '{amount} är dina',
  'row.noteOn': 'Anteckning om {title}',
  'row.edit': 'Redigera {title}',
  'row.delete': 'Ta bort {title}',
  'row.saving': 'Sparar',
  'row.splitOff': 'Andelarna summerar inte till totalen',
  'tile.owe.label': 'Du är skyldig',
  'tile.owe.settled': 'Du är helt kvitt',
  'tile.owe.pending': 'Gör upp innan du flyger hem',
  'tile.owe.to': 'Till',
  'tile.owed.label': 'Du ska ha',
  'tile.owed.none': 'Ingen är skyldig dig något',
  'tile.owed.pending': 'Kommer fortfarande tillbaka till dig',
  'tile.owed.from': 'Från',
  'tile.outstanding.label': 'Utestående',
  'tile.outstanding.none': 'Varje utgift har en betalare',
  'tile.outstanding.some': {
    one: '{expenses} utgift utan betalare ännu',
    other: '{expenses} utgifter utan betalare ännu',
  },
  'category.accommodation': 'Boende',
  'category.transport': 'Transport',
  'category.food': 'Mat och dryck',
  'category.activities': 'Aktiviteter',
  'category.shopping': 'Inköp',
  'category.fees': 'Avgifter',
  'category.insurance': 'Försäkring',
  'category.other': 'Övrigt',
  'toolbar.summary.everything': 'Visar allt',
  'toolbar.summary.filtered': 'Filtrerat: {filters}',
  'toolbar.summary.search': 'matchar ”{term}”',
  'write.added': 'Utgift tillagd',
  'write.updated': 'Utgift uppdaterad',
  'write.deleted': 'Utgift borttagen',
  'write.addFailed': 'Utgiften lades inte till',
  'write.editFailed': 'Utgiften sparades inte',
  'write.deleteFailed': 'Utgiften togs inte bort',
  'write.paymentRecorded': 'Betalning registrerad',
  'write.paymentRecordedBody': 'Båda saldona är uppdaterade.',
  'write.paymentFailed': 'Betalningen registrerades inte',
  'write.paymentDeleted': 'Betalning borttagen',
  'write.paymentDeleteFailed': 'Betalningen togs inte bort',
  'write.rolledBack': 'Ändringen ångrades.',
  'expense.saveFallback':
    'Utgiften kunde inte sparas. Försök igen om en stund.',
} satisfies TranslationOf<typeof En>

export default messages
