/**
 * The costs tab's copy, in nl.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Meervoud.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Jij',
  'person.youTarget': 'jou',
  'person.removed': 'Verwijderde reiziger',
  'person.removedTarget': 'een verwijderde reiziger',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Deze uitgave verwijderen?',
  'delete.description':
    '‘{title}’ en de verdeling ervan gaan uit de afrekening. Dit kun je niet terugdraaien.',
  'delete.failed': 'Verwijderen is mislukt',
  'delete.failedBody':
    'De uitgave kon niet worden verwijderd. Probeer het straks nog eens.',
  'delete.noBalances': 'Geen enkel saldo verandert - er was niets op verdeeld.',
  'delete.balancesChange': 'De saldi van {names} veranderen.',
  'delete.confirm': 'Uitgave verwijderen',
  'delete.working': 'Uitgave wordt verwijderd',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Uitgaven',
  'toolbar.shownOf': '{shown} van {total}',
  'toolbar.searchPlaceholder': 'Zoek in uitgaven, notities of betalers…',
  'toolbar.searchLabel': 'Uitgaven zoeken',
  'toolbar.allCategories': 'Alle categorieën',
  'toolbar.allDays': 'Alle dagen',
  'toolbar.filterCategory': 'Filteren op categorie',
  'toolbar.filterDay': 'Filteren op dag',
  'toolbar.whose': 'Wiens uitgaven',
  'toolbar.paidByMe': 'Door mij betaald',
  'toolbar.owedToMe': 'Mij verschuldigd',
  'toolbar.logged': {
    one: '{value} vastgelegd',
    other: '{value} vastgelegd',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Verdeling tussen reisgenoten',
  'split.label': 'Verdelen tussen',
  'split.everyone': 'Iedereen',
  'split.nobody': 'Niemand',
  'split.departed': 'Heeft de reis verlaten',
  'split.departedHint':
    'Als je iemand uitvinkt die de reis heeft verlaten, wordt het aandeel definitief verwijderd.',
  'split.includeFor': '{name} opnemen in deze verdeling',
  'split.how': 'Hoe deze uitgave verdeeld wordt',
  'split.method.equal': 'Gelijk',
  'split.method.equalHint':
    'Iedereen die meedoet betaalt hetzelfde, en de overgebleven kleinste eenheid gaat naar de eerste in de lijst.',
  'split.method.exact': 'Exact',
  'split.method.exactHint':
    'Vul in wat ieder werkelijk verschuldigd is. De bedragen moeten samen het totaal zijn.',
  'split.method.shares': 'Delen',
  'split.method.sharesHint':
    'Weeg de verdeling - 2 delen voor een koppel, 1 voor de rest.',
  'split.method.percentage': 'Procent',
  'split.method.percentageHint':
    'Verdelen op procent. De percentages moeten samen 100 zijn.',
  'split.exactFor': 'Exact bedrag voor {name}',
  'split.percentFor': 'Percentage voor {name}',
  'split.sharesFor': 'Delen voor {name}',
  'split.balanced': 'Klopt',
  'split.allocated': '{allocated} van {total} verdeeld',
  'split.over': '{amount} te veel',
  'split.left': '{amount} over',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Bedrag',
  'field.currency': 'Valuta',
  'field.date': 'Datum',
  'field.paidBy': 'Betaald door',
  'expense.editTitle': 'Deze uitgave bewerken',
  'expense.addTitle': 'Een uitgave toevoegen',
  'expense.editDescription':
    'Als je het bedrag wijzigt, wordt het opnieuw verdeeld over iedereen die hieronder meedoet.',
  'expense.addDescription':
    'Bedragen worden voor deze reis in {currency} bijgehouden. Leg een bon vast in zijn eigen valuta en noteer waar hij op uitkwam.',
  'expense.saveFailed': 'Opslaan is mislukt',
  'expense.what': 'Waar was het voor',
  'expense.whatPlaceholder': 'Diner bij Kyubey',
  'expense.amountNotANumber': 'Vul het bedrag in als getal.',
  'expense.convertedTo': 'Omgerekend naar {currency}',
  'expense.convertedHint': 'Waar {from} op je afschrift in {to} op uitkwam.',
  'expense.convertedSuggested':
    'Voorgesteld op basis van de koers die op deze reis op {date} is gebruikt ({rate}). Pas het aan zodat het klopt met je afschrift.',
  'expense.convertedNotANumber': 'Vul het omgerekende bedrag in als getal.',
  'expense.paidByHint':
    'Laat het zonder betaler als je een bon vastlegt die nog niemand heeft voorgeschoten.',
  'expense.nobodyYet': 'Nog niemand',
  'expense.notesHint': 'Optioneel. Alles wat de bon niet zegt.',
  'expense.notesPlaceholder': 'Menu gedeeld, drankjes apart.',
  'expense.noAmount': 'Nog geen bedrag',
  'expense.saving': 'Uitgave wordt opgeslagen',
  'expense.saveChanges': 'Wijzigingen opslaan',
  'expense.add': 'Uitgave toevoegen',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Een betaling vastleggen',
  'payment.description':
    'Een vastgelegde overboeking verdwijnt uit beide saldi. Er wordt geen geld verplaatst - planned.travel houdt de afrekening bij, jouw bank maakt het over.',
  'payment.youSuffix': '{name} (jij)',
  'payment.pays': '{from} betaalt {to}',
  'payment.pickTwo': 'Kies twee verschillende mensen.',
  'payment.paidTo': 'Betaald aan',
  'payment.needsTwo': 'Een betaling heeft twee verschillende mensen nodig.',
  'payment.amountIn': 'Bedrag in {currency}',
  'payment.amountPositive': 'Vul een bedrag groter dan nul in.',
  'payment.how': 'Hoe',
  'payment.note': 'Notitie',
  'payment.noteHint': 'Optioneel. Een referentie, of waar het voor was.',
  'payment.notePlaceholder': 'Dekt het hotel in Kyoto en de JR-passen.',
  'payment.recording': 'Betaling wordt vastgelegd',
  'payment.confirm': 'Betaling vastleggen',
  'payment.failed':
    'De betaling kon niet worden vastgelegd. Probeer het straks nog eens.',
  'payment.method.bankTransfer': 'Bankoverboeking',
  'payment.method.cash': 'Contant',
  'payment.method.card': 'Kaart',
  'payment.method.app': 'Betaalapp',
  'payment.method.other': 'Iets anders',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Afrekenen',
  'settle.addPayment': 'Betaling toevoegen',
  'settle.action': 'Afrekenen',
  'settle.empty.title': 'Iedereen staat quitte',
  'settle.empty.body':
    'Er zijn geen overboekingen nodig. Voeg een uitgave toe en elk verschil komt hier te staan.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldi',
  'balances.count': {
    one: '{travellers} reiziger',
    other: '{travellers} reizigers',
  },
  'balances.empty':
    'Saldi verschijnen zodra een uitgave een betaler en een verdeling heeft.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Per categorie',
  'categories.againstBudget': 'Ten opzichte van het reisbudget',
  'categories.progressLabel': 'Besteed ten opzichte van het reisbudget',
  'categories.empty':
    'Budgetregels en uitgaven worden hier uitgesplitst zodra er iets uit te splitsen valt.',
  'categories.legendLabel': 'Uitgaven per categorie',
  'categories.planned': '{amount} gepland',
  'categories.nothingSpent':
    'Nog niets uitgegeven. Dit is wat je hebt gepland.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'minder dan {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Voor wie het geld is uitgegeven',
  'memberBar.others': {
    one: '{others} andere reiziger',
    other: '{others} andere reizigers',
  },
  'memberBar.notSplit': 'Aan niemand toegewezen',
  'totalTile.label': 'Totale reiskosten',
  'totalTile.captionPlanned': '{amount} gepland voor alle reizigers',
  'totalTile.captionBudget': '{amount} budget voor de reis',
  'totalTile.yourShare': 'Jouw aandeel',
  'totalTile.youPaid': 'Jij betaalde',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Vastgelegde betalingen',
  'payments.empty.title': 'Nog geen betalingen',
  'payments.empty.body':
    'Zodra iemand een saldo terugbetaalt, wordt de overboeking hier vastgelegd.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Deze reis is gearchiveerd. Herstel de reis voordat je de kosten wijzigt.',
  'readOnly.title': 'Je kunt de kosten bekijken, maar niet wijzigen',
  'readOnly.body':
    'Alleen de eigenaren van de reis en mensen die hem mogen bewerken voegen uitgaven toe, wijzigen of verwijderen ze en leggen betalingen vast. Vraag een eigenaar als er iets moet veranderen.',
  'readOnly.empty':
    'Er zijn nog geen uitgaven vastgelegd voor deze reis. Ze verschijnen hier zodra een eigenaar of bewerker ze toevoegt.',
  'readOnly.settleEmpty':
    'Er zijn op dit moment geen overboekingen nodig. Een eventueel verschil zou hier verschijnen.',
  'refusal.rebaseChanged':
    'De reis is veranderd terwijl je bevestigde, dus er is niets gewijzigd. Controleer de nieuwe bedragen en bevestig opnieuw.',
  'refusal.tripCurrencyChanged':
    'De valuta van het budget van deze reis is nu {to}, dus er is niets opgeslagen. De pagina is vernieuwd: controleer het bedrag en sla opnieuw op.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Weergavevaluta',
  'display.indicator.perTrip': 'Eigen valuta',
  'display.indicator.fixed': 'Ook in {code}',
  'display.menu.perTrip': 'Elke reis in zijn eigen valuta',
  'display.menu.workspace': '{code} (standaard van de werkruimte)',
  'display.menu.rateHint':
    'Gebruikt een koers die al op een reis is vastgelegd',
  'display.menu.currentHint': 'Gekozen, maar geen vastgelegde koers dekt hem',
  'display.menu.needsLiveRate':
    'Heeft een actuele koers nodig, die nog niet beschikbaar is',
  'display.menu.saving': 'Je keuze wordt opgeslagen',
  'display.error.title': 'De weergavevaluta is niet opgeslagen',
  'display.error.body':
    'Je keuze kon niet worden opgeslagen. Probeer het zo opnieuw.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': 'Ongeveer {amount} {code} in je weergavevaluta',
  'display.row.notConverted': 'Niet omgerekend',
  'display.alert.title': 'Sommige bedragen zijn niet omgerekend',
  'display.alert.body':
    'Voor deze valutaparen is geen koers vastgelegd, dus die bedragen blijven in de budgetvaluta:',
  'display.alert.pair': '{from} naar {to} op {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Valuta van het budget wijzigen',
  'rebase.title': 'De valuta van het budget wijzigen',
  'rebase.description':
    'De bedragen die je hebt ingevoerd blijven zoals je ze hebt ingevoerd. De totalen en saldi van deze reis worden omgerekend naar de nieuwe valuta.',
  'rebase.to': 'Nieuwe valuta',
  'rebase.toPlaceholder': 'Kies een valuta',
  'rebase.rateLabel': 'Wisselkoers (1 {from} in {to})',
  'rebase.rateInverse': 'Dat is 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Vul een koers groter dan nul in.',
  'rebase.rateOutOfRange':
    'Die koers lijkt veel te groot of te klein. Controleer in welke richting hij geldt.',
  'rebase.source.recent': 'De laatst gebruikte koers in deze werkruimte',
  'rebase.source.manual': 'De koers die je hebt ingevuld',
  'rebase.noRate':
    'Er is geen koers vastgelegd voor {from} naar {to}. Vul de koers in die je wilt gebruiken.',
  'rebase.waitingForRate': 'Het voorbeeld verschijnt zodra er een koers is.',
  'rebase.loading': 'De omrekening wordt berekend',
  'rebase.example':
    '{original} blijft staan zoals je het hebt ingevoerd en telt mee als {converted}.',
  'rebase.count.expenses': {
    one: '{count} uitgave wordt meegeteld in {to}.',
    other: '{count} uitgaven worden meegeteld in {to}.',
  },
  'rebase.count.payments': {
    one: '{count} betaling wordt meegeteld in {to}.',
    other: '{count} betalingen worden meegeteld in {to}.',
  },
  'rebase.count.planned': {
    one: '{count} geplande post wordt meegeteld in {to}.',
    other: '{count} geplande posten worden meegeteld in {to}.',
  },
  'rebase.pinned':
    'De prijzen van plaatsen, reserveringen, verblijven en vervoer blijven in {from}.',
  'rebase.target': 'Het reisbudget {before} wordt {after}.',
  'rebase.rounding':
    'Elk bedrag wordt maar één keer afgerond, dus een saldo kan met maximaal {amount} verschuiven.',
  'rebase.leftover':
    'Na de wijziging zou {name} {other} {amount} verschuldigd zijn.',
  'rebase.someone': 'Iemand',
  'rebase.nothing':
    'Op deze reis heeft nog niets een prijs, dus er hoeft niets te worden omgerekend.',
  'rebase.unconverted': {
    one: '{count} post staat in een andere valuta dan {from} en kan niet automatisch worden omgerekend. Meestal is dit een uitgave die is aangemaakt vanuit een reservering met een prijs in een andere valuta: pas hem aan of verwijder hem en probeer het opnieuw.',
    other:
      '{count} posten staan in een andere valuta dan {from} en kunnen niet automatisch worden omgerekend. Meestal zijn dit uitgaven die zijn aangemaakt vanuit reserveringen met een prijs in een andere valuta: pas ze aan of verwijder ze en probeer het opnieuw.',
  },
  'rebase.unsplittable': {
    one: '{count} uitgave heeft een verdeling die niet kan worden overgenomen, omdat alle aandelen nul zijn. Pas hem aan of verwijder hem en probeer het opnieuw.',
    other:
      '{count} uitgaven hebben een verdeling die niet kan worden overgenomen, omdat alle aandelen nul zijn. Pas ze aan of verwijder ze en probeer het opnieuw.',
  },
  'rebase.outOfRange':
    'Met deze koers zou een bedrag op de reis te groot zijn om in {to} op te slaan. Controleer de koers en de richting ervan.',
  'rebase.tooLarge':
    'Deze reis heeft te veel posten om in één keer te wijzigen: er zouden {changes} wijzigingen tegelijk nodig zijn en de limiet is {limit}. Het budget blijft voorlopig in {from}.',
  'rebase.copyPending':
    'Deze reis wordt nog gekopieerd. Probeer het zo meteen opnieuw.',
  'rebase.error':
    'De omrekening kon niet worden geladen. Er is niets gewijzigd.',
  'rebase.commitError':
    'We konden de valuta van het budget niet wijzigen. Er is niets gewijzigd.',
  'rebase.stale':
    'De budgetvaluta van de reis is nu {current}, niet {from}. Sluit dit venster en open het opnieuw.',
  'rebase.sameCurrency': 'Het budget staat al in {to}. Kies een andere valuta.',
  'rebase.commitUnknown':
    'We konden niet bevestigen of de budgetvaluta is gewijzigd naar {to}. Laad de pagina opnieuw om het te controleren voordat je het nog eens probeert.',
  'rebase.retry': 'Opnieuw proberen',
  'rebase.confirm': 'Wijzigen naar {to}',
  'rebase.committing': 'De valuta van het budget wordt gewijzigd',
  'rebase.done': 'Het budget staat nu in {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Nog niets uitgegeven',
  'screen.summary': '{expenses} · {spent} uitgegeven',
  'count.expenses': {
    one: '{expenses} uitgave',
    other: '{expenses} uitgaven',
  },
  'screen.exportCsv': 'CSV exporteren',
  'screen.addFirst': 'Eerste uitgave toevoegen',
  'screen.empty.title': 'Nog geen uitgaven',
  'screen.empty.body':
    'Leg vast wat je uitgeeft terwijl je onderweg bent. planned.travel verdeelt het over alle reizigers en houdt het lopende totaal bij in {currency}.',
  'screen.filtered.title': 'Niets komt overeen met deze filters',
  'screen.filtered.body':
    'Zoek breder, kies een andere dag of wis de filters om weer de hele reis te zien.',
  'export.empty.title': 'Niets om te exporteren',
  'export.empty.body': 'Geen enkele uitgave past bij de filters die aanstaan.',
  'export.ready.title': 'Export klaar',
  'export.ready.body': {
    one: '{expenses} uitgave naar CSV geschreven.',
    other: '{expenses} uitgaven naar CSV geschreven.',
  },
  'list.daySpent': '{amount} uitgegeven',
  'skeleton.loading': 'Uitgaven laden',
  'row.noPayer': 'Nog geen betaler',
  'row.youPaid': 'Jij hebt betaald',
  'row.paid': '{name} heeft betaald',
  'row.notYourShare': 'niet jouw deel',
  'row.yourShare': '{amount} van jou',
  'row.noteOn': 'Notitie bij {title}',
  'row.edit': '{title} bewerken',
  'row.delete': '{title} verwijderen',
  'row.saving': 'Opslaan',
  'tile.owe.label': 'Jij betaalt nog',
  'tile.owe.settled': 'Je staat helemaal quitte',
  'tile.owe.pending': 'Reken af voordat je naar huis vliegt',
  'tile.owe.to': 'Aan',
  'tile.owed.label': 'Jij krijgt nog',
  'tile.owed.none': 'Niemand is jou iets verschuldigd',
  'tile.owed.pending': 'Komt nog bij je terug',
  'tile.owed.from': 'Van',
  'tile.outstanding.label': 'Openstaand',
  'tile.outstanding.none': 'Elke uitgave heeft een betaler',
  'tile.outstanding.some': {
    one: '{expenses} uitgave nog zonder betaler',
    other: '{expenses} uitgaven nog zonder betaler',
  },
  'category.accommodation': 'Accommodatie',
  'category.transport': 'Vervoer',
  'category.food': 'Eten en drinken',
  'category.activities': 'Activiteiten',
  'category.shopping': 'Winkelen',
  'category.fees': 'Kosten en heffingen',
  'category.insurance': 'Verzekering',
  'category.other': 'Overig',
  'toolbar.summary.everything': 'Alles wordt getoond',
  'toolbar.summary.filtered': 'Gefilterd: {filters}',
  'toolbar.summary.search': 'passend bij ‘{term}’',
  'write.added': 'Uitgave toegevoegd',
  'write.updated': 'Uitgave bijgewerkt',
  'write.deleted': 'Uitgave verwijderd',
  'write.addFailed': 'De uitgave is niet toegevoegd',
  'write.editFailed': 'De uitgave is niet opgeslagen',
  'write.deleteFailed': 'De uitgave is niet verwijderd',
  'write.paymentRecorded': 'Betaling vastgelegd',
  'write.paymentRecordedBody': 'Beide saldi zijn bijgewerkt.',
  'write.paymentFailed': 'De betaling is niet vastgelegd',
  'write.rolledBack': 'De wijziging is teruggedraaid.',
  'expense.saveFallback':
    'De uitgave kon niet worden opgeslagen. Probeer het zo meteen opnieuw.',
} satisfies TranslationOf<typeof En>

export default messages
