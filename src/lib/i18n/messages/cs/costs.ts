/**
 * The costs tab's copy, in cs.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurál.** `one` · `few` · `many` · `other`: `one` je 1, `few` je 2–4,
 * `many` je desetinné číslo a `other` zbytek. **Typografie.** Čeština cituje
 * „…“.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Ty',
  'person.youTarget': 'tobě',
  'person.removed': 'Odebraný cestovatel',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Smazat tento výdaj?',
  'delete.description':
    '„{title}“ a jeho rozdělení mizí z vyúčtování. Tohle nelze vzít zpět.',
  'delete.failed': 'Smazání se nepovedlo',
  'delete.failedBody': 'Výdaj se nepodařilo smazat. Zkuste to za chvíli.',
  'delete.noBalances':
    'Žádný zůstatek se nemění - nic na něm nebylo rozdělené.',
  'delete.balancesChange': 'Mění se zůstatky: {names}.',
  'delete.confirm': 'Smazat výdaj',
  'delete.working': 'Výdaj se maže',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Výdaje',
  'toolbar.shownOf': '{shown} z {total}',
  'toolbar.searchPlaceholder': 'Hledat ve výdajích, poznámkách nebo plátcích…',
  'toolbar.searchLabel': 'Hledat ve výdajích',
  'toolbar.allCategories': 'Všechny kategorie',
  'toolbar.allDays': 'Všechny dny',
  'toolbar.filterCategory': 'Filtrovat podle kategorie',
  'toolbar.filterDay': 'Filtrovat podle dne',
  'toolbar.whose': 'Čí výdaje',
  'toolbar.paidByMe': 'Zaplaceno mnou',
  'toolbar.owedToMe': 'Dluží mi',
  'toolbar.logged': {
    one: '{value} zapsaný',
    few: '{value} zapsané',
    many: '{value} zapsaného',
    other: '{value} zapsaných',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Rozdělení mezi cestující',
  'split.label': 'Rozdělit mezi',
  'split.everyone': 'Všichni',
  'split.nobody': 'Nikdo',
  'split.how': 'Jak se tento výdaj dělí',
  'split.method.equal': 'Rovným dílem',
  'split.method.equalHint':
    'Každý zahrnutý platí stejně a přebývající nejmenší jednotka jde prvnímu v seznamu.',
  'split.method.exact': 'Přesně',
  'split.method.exactHint':
    'Napište, kolik kdo skutečně dluží. Částky musí dát dohromady celek.',
  'split.method.shares': 'Podíly',
  'split.method.sharesHint':
    'Zvažte rozdělení - 2 podíly pro pár, 1 pro ostatní.',
  'split.method.percentage': 'Procenta',
  'split.method.percentageHint':
    'Rozdělení podle procent. Procenta musí dát 100.',
  'split.exactFor': 'Přesná částka pro {name}',
  'split.percentFor': 'Procenta pro {name}',
  'split.sharesFor': 'Podíly pro {name}',
  'split.balanced': 'Souhlasí',
  'split.allocated': 'přiděleno {allocated} z {total}',
  'split.over': '{amount} navíc',
  'split.left': 'zbývá {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Částka',
  'field.currency': 'Měna',
  'field.date': 'Datum',
  'field.paidBy': 'Zaplatil',
  'expense.editTitle': 'Upravit tento výdaj',
  'expense.addTitle': 'Přidat výdaj',
  'expense.editDescription':
    'Změna částky ji znovu rozdělí mezi všechny zahrnuté níž.',
  'expense.addDescription':
    'Částky se u této cesty vedou v {currency}. Zapište účtenku v její vlastní měně a doplňte, na kolik se přepočítala.',
  'expense.saveFailed': 'Uložení se nepovedlo',
  'expense.what': 'Za co to bylo',
  'expense.whatPlaceholder': 'Večeře v Kyubey',
  'expense.amountNotANumber': 'Zadejte částku jako číslo.',
  'expense.currencyLabel': 'Měna, ve které je účtenka vystavená',
  'expense.convertedTo': 'Přepočteno na {currency}',
  'expense.convertedHint': 'Kolik {from} vyšlo v {to} na vašem výpisu.',
  'expense.convertedSuggested':
    'Navrženo podle kurzu použitého na této cestě dne {date} ({rate}). Upravte částku tak, aby seděla s vaším výpisem.',
  'expense.convertedNotANumber': 'Zadejte přepočtenou částku jako číslo.',
  'expense.dateLabel': 'Datum výdaje',
  'expense.paidByHint':
    'Nechte bez plátce, pokud zapisujete účtenku, kterou ještě nikdo nepokryl.',
  'expense.nobodyYet': 'Ještě nikdo',
  'expense.whoPaid': 'Kdo zaplatil',
  'expense.notesHint': 'Nepovinné. Cokoli, co účtenka neříká.',
  'expense.notesPlaceholder': 'Rozdělené degustační menu, pití zvlášť.',
  'expense.noAmount': 'Ještě bez částky',
  'expense.saving': 'Výdaj se ukládá',
  'expense.saveChanges': 'Uložit změny',
  'expense.add': 'Přidat výdaj',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Zaznamenat platbu',
  'payment.description':
    'Zaznamenaný převod zmizí z obou zůstatků. Nepřesouvá žádné peníze - planned.travel vede vyúčtování, peníze posílá vaše banka.',
  'payment.youSuffix': '{name} (vy)',
  'payment.pays': '{from} platí {to}',
  'payment.pickTwo': 'Vyberte dva různé lidi.',
  'payment.paidTo': 'Zaplaceno komu',
  'payment.needsTwo': 'Platba potřebuje dva různé lidi.',
  'payment.whoPaying': 'Kdo platí',
  'payment.whoPaid': 'Kdo dostává',
  'payment.amountIn': 'Částka v {currency}',
  'payment.amountPositive': 'Zadejte částku větší než nula.',
  'payment.currencyLabel': 'Měna, ve které byla platba provedena',
  'payment.how': 'Jak',
  'payment.howMade': 'Jak platba proběhla',
  'payment.dateLabel': 'Datum platby',
  'payment.note': 'Poznámka',
  'payment.noteHint': 'Nepovinné. Reference, nebo za co to bylo.',
  'payment.notePlaceholder': 'Pokrývá hotel v Kjótu a jízdenky JR.',
  'payment.recording': 'Platba se zaznamenává',
  'payment.confirm': 'Zaznamenat platbu',
  'payment.failed': 'Platbu se nepodařilo zaznamenat. Zkuste to za chvíli.',
  'payment.method.bankTransfer': 'Bankovní převod',
  'payment.method.cash': 'Hotovost',
  'payment.method.card': 'Karta',
  'payment.method.app': 'Platební aplikace',
  'payment.method.other': 'Něco jiného',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Vyrovnání',
  'settle.addPayment': 'Přidat platbu',
  'settle.action': 'Vyrovnat',
  'settle.empty.title': 'Všichni jsou vyrovnáni',
  'settle.empty.body':
    'Není potřeba žádný převod. Přidej výdaj a každá nerovnost se objeví tady.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Zůstatky',
  'balances.count': {
    one: '{travellers} cestovatel',
    few: '{travellers} cestovatelé',
    many: '{travellers} cestovatele',
    other: '{travellers} cestovatelů',
  },
  'balances.empty': 'Zůstatky se objeví, když má výdaj plátce a rozdělení.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Podle kategorie',
  'categories.againstBudget': 'Vůči rozpočtu cesty',
  'categories.progressLabel': 'Utraceno vůči rozpočtu cesty',
  'categories.empty':
    'Položky rozpočtu i výdaje se tady rozepíšou, až bude co rozepsat.',
  'categories.legendLabel': 'Výdaje podle kategorie',
  'categories.planned': 'plánováno {amount}',
  'categories.nothingSpent':
    'Zatím nic nevydáno. Tady je, co máte naplánováno.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'méně než {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Na koho se utratilo',
  'memberBar.others': {
    one: '{others} další cestovatel',
    few: '{others} další cestovatelé',
    many: '{others} dalšího cestovatele',
    other: '{others} dalších cestovatelů',
  },
  'memberBar.notSplit': 'Nikomu nepřiřazeno',
  'totalTile.label': 'Celkové výdaje na cestu',
  'totalTile.captionPlanned': 'Plánováno {amount} pro všechny cestovatele',
  'totalTile.captionBudget': 'Rozpočet cesty: {amount}',
  'totalTile.yourShare': 'Tvůj podíl',
  'totalTile.youPaid': 'Zaplaceno tebou',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Zaznamenané platby',
  'payments.empty.title': 'Zatím žádné platby',
  'payments.empty.body': 'Když někdo vrátí zůstatek, převod se zaznamená sem.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Náklady lze prohlížet, ale ne měnit',
  'readOnly.body':
    'Výdaje přidávat, upravovat a mazat a zapisovat platby mohou jen vlastníci cesty a lidé s právem ji upravovat. Pokud je třeba něco změnit, požádejte vlastníka.',
  'readOnly.empty':
    'Na této cestě zatím nejsou zapsány žádné výdaje. Objeví se tady, jakmile je přidá vlastník nebo editor.',
  'readOnly.settleEmpty':
    'Teď není potřeba žádný převod. Případný nevyrovnaný zůstatek se ukáže tady.',
  'refusal.rebaseChanged':
    'Cesta se změnila, zatímco jste potvrzovali, takže se nic nezměnilo. Zkontrolujte nové částky a potvrďte znovu.',
  'refusal.tripCurrencyChanged':
    'Měna rozpočtu této cesty je nyní {to}, proto se nic neuložilo. Stránka byla obnovena: zkontrolujte částku a uložte znovu.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Zobrazená měna',
  'display.indicator.perTrip': 'Vlastní měna',
  'display.indicator.fixed': 'Také v {code}',
  'display.menu.perTrip': 'Každá cesta ve své měně',
  'display.menu.workspace': '{code} (výchozí v pracovním prostoru)',
  'display.menu.rateHint': 'Použije kurz už uložený u cesty',
  'display.menu.currentHint': 'Vybraná, ale žádný uložený kurz ji nepokrývá',
  'display.menu.needsLiveRate':
    'Vyžaduje aktuální kurz, který zatím není k dispozici',
  'display.menu.saving': 'Ukládám váš výběr',
  'display.error.title': 'Zobrazená měna nebyla uložena',
  'display.error.body':
    'Váš výběr se nepodařilo uložit. Zkuste to za chvíli znovu.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Přibližně {amount} {code} ve vaší zobrazené měně',
  'display.row.notConverted': 'Nepřepočteno',
  'display.alert.title': 'Některé částky nejsou přepočtené',
  'display.alert.body':
    'Pro tyto dvojice měn není uložený kurz, proto tyto částky zůstávají v měně rozpočtu:',
  'display.alert.pair': '{from} na {to} dne {date}',
} satisfies TranslationOf<typeof En>

export default messages
