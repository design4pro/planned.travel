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
  'person.removedTarget': 'odebraný cestovatel',
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
  'delete.payment.title': 'Smazat tuto platbu?',
  'delete.payment.description':
    '„{title}“ mizí z vyúčtování. Tohle nelze vzít zpět. Chcete-li platbu opravit, zaznamenejte ji znovu.',
  'delete.payment.failedBody':
    'Platbu se nepodařilo smazat. Zkuste to za chvíli.',
  'delete.payment.confirm': 'Smazat platbu',
  'delete.payment.working': 'Platba se maže',

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
  'split.departed': 'Už na cestě není',
  'split.departedHint':
    'Odškrtnutím někoho, kdo cestu opustil, jeho podíl nadobro odstraníte.',
  'split.includeFor': 'Zahrnout {name} do tohoto rozdělení',
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
  'expense.splitOff.title': 'Uložené podíly nesedí',
  'expense.splitOff.body':
    'Dohromady dávají {shares}, ale celkem je to {total}. Zkontroluj rozdělení níže a ulož, aby se to opravilo.',
  'expense.what': 'Za co to bylo',
  'expense.whatPlaceholder': 'Večeře v Kyubey',
  'expense.amountNotANumber': 'Zadejte částku jako číslo.',
  'expense.convertedTo': 'Přepočteno na {currency}',
  'expense.convertedHint': 'Kolik {from} vyšlo v {to} na vašem výpisu.',
  'expense.convertedSuggested':
    'Navrženo podle kurzu použitého na této cestě dne {date} ({rate}). Upravte částku tak, aby seděla s vaším výpisem.',
  'expense.convertedNotANumber': 'Zadejte přepočtenou částku jako číslo.',
  'expense.paidByHint':
    'Nechte bez plátce, pokud zapisujete účtenku, kterou ještě nikdo nepokryl.',
  'expense.nobodyYet': 'Ještě nikdo',
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
  'payment.amountIn': 'Částka v {currency}',
  'payment.amountPositive': 'Zadejte částku větší než nula.',
  'payment.how': 'Jak',
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
  'payments.delete': 'Smazat platbu od {from} pro {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Tato cesta je archivovaná. Před změnou nákladů ji obnovte.',
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
  'display.menu.disabledHint':
    'Měny bez zaznamenaného kurzu jsou v seznamu, ale nelze je vybrat: potřebují aktuální kurz, který zatím není k dispozici.',
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
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Změnit měnu rozpočtu',
  'rebase.title': 'Změna měny rozpočtu',
  'rebase.description':
    'Zadané částky zůstanou tak, jak jste je zadali. Součty a zůstatky této cesty se přepočtou do nové měny.',
  'rebase.to': 'Nová měna',
  'rebase.toPlaceholder': 'Vyberte měnu',
  'rebase.rateLabel': 'Směnný kurz (1 {from} v {to})',
  'rebase.rateInverse': 'To je 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Zadejte kurz větší než nula.',
  'rebase.rateOutOfRange':
    'Ten kurz vypadá příliš velký nebo příliš malý. Zkontrolujte, jakým směrem platí.',
  'rebase.source.recent': 'Kurz naposledy použitý v tomto prostoru',
  'rebase.source.manual': 'Kurz, který jste zadali',
  'rebase.noRate':
    'Pro {from} na {to} není uložený žádný kurz. Zadejte kurz, který chcete použít.',
  'rebase.waitingForRate': 'Náhled se objeví, jakmile bude k dispozici kurz.',
  'rebase.loading': 'Probíhá přepočet',
  'rebase.example':
    '{original} zůstává tak, jak jste to zadali, a počítá se jako {converted}.',
  'rebase.count.expenses': {
    one: '{count} výdaj se započítá v {to}.',
    few: '{count} výdaje se započítají v {to}.',
    many: '{count} výdaje se započítají v {to}.',
    other: '{count} výdajů se započítá v {to}.',
  },
  'rebase.count.payments': {
    one: '{count} platba se započítá v {to}.',
    few: '{count} platby se započítají v {to}.',
    many: '{count} platby se započítají v {to}.',
    other: '{count} plateb se započítá v {to}.',
  },
  'rebase.count.planned': {
    one: '{count} plánovaná položka se započítá v {to}.',
    few: '{count} plánované položky se započítají v {to}.',
    many: '{count} plánované položky se započítají v {to}.',
    other: '{count} plánovaných položek se započítá v {to}.',
  },
  'rebase.pinned':
    'Ceny míst, rezervací, noclehů a dopravy zůstávají v {from}.',
  'rebase.target': 'Rozpočet cesty {before} se změní na {after}.',
  'rebase.rounding':
    'Každá částka se zaokrouhluje jen jednou, takže se zůstatek může posunout nejvýše o {amount}.',
  'rebase.leftover':
    'Po změně by dluh osoby {name} vůči {other} činil {amount}.',
  'rebase.someone': 'Někdo',
  'rebase.nothing':
    'Na této cestě zatím nic nemá cenu, takže není co přepočítat.',
  'rebase.unconverted': {
    one: '{count} záznam je v jiné měně než {from} a nelze ho přepočítat automaticky. Obvykle jde o výdaj vytvořený z rezervace s cenou v jiné měně: upravte ho nebo smažte a zkuste to znovu.',
    few: '{count} záznamy jsou v jiné měně než {from} a nelze je přepočítat automaticky. Obvykle jde o výdaje vytvořené z rezervací s cenou v jiné měně: upravte je nebo smažte a zkuste to znovu.',
    many: '{count} záznamu je v jiné měně než {from} a nelze je přepočítat automaticky. Obvykle jde o výdaje vytvořené z rezervací s cenou v jiné měně: upravte je nebo smažte a zkuste to znovu.',
    other:
      '{count} záznamů je v jiné měně než {from} a nelze je přepočítat automaticky. Obvykle jde o výdaje vytvořené z rezervací s cenou v jiné měně: upravte je nebo smažte a zkuste to znovu.',
  },
  'rebase.unsplittable': {
    one: '{count} výdaj má rozdělení, které nelze převzít, protože všechny podíly v něm jsou nulové. Upravte ho nebo smažte a zkuste to znovu.',
    few: '{count} výdaje mají rozdělení, která nelze převzít, protože všechny podíly v nich jsou nulové. Upravte je nebo smažte a zkuste to znovu.',
    many: '{count} výdaje mají rozdělení, která nelze převzít, protože všechny podíly v nich jsou nulové. Upravte je nebo smažte a zkuste to znovu.',
    other:
      '{count} výdajů má rozdělení, která nelze převzít, protože všechny podíly v nich jsou nulové. Upravte je nebo smažte a zkuste to znovu.',
  },
  'rebase.outOfRange':
    'S tímto kurzem by byla jedna částka na cestě příliš velká na uložení v {to}. Zkontrolujte kurz a jakým směrem platí.',
  'rebase.tooLarge':
    'Tato cesta má příliš mnoho záznamů na změnu najednou: bylo by potřeba {changes} změn naráz a limit je {limit}. Rozpočet zatím zůstává v {from}.',
  'rebase.copyPending': 'Tato cesta se ještě kopíruje. Zkuste to za chvíli.',
  'rebase.error': 'Přepočet se nepodařilo načíst. Nic se nezměnilo.',
  'rebase.commitError': 'Měnu rozpočtu se nepodařilo změnit. Nic se nezměnilo.',
  'rebase.stale':
    'Měna rozpočtu výletu je nyní {current}, ne {from}. Zavřete toto okno a otevřete ho znovu.',
  'rebase.sameCurrency': 'Rozpočet už je v měně {to}. Vyberte jinou měnu.',
  'rebase.commitUnknown':
    'Nepodařilo se potvrdit, zda se měna rozpočtu změnila na {to}. Než to zkusíte znovu, načtěte stránku znovu a ověřte to.',
  'rebase.retry': 'Zkusit znovu',
  'rebase.confirm': 'Změnit na {to}',
  'rebase.committing': 'Měním měnu rozpočtu',
  'rebase.done': 'Rozpočet je nyní v {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Zatím nic neutraceno',
  'screen.summary': '{expenses} · utraceno {spent}',
  'count.expenses': {
    one: '{expenses} výdaj',
    few: '{expenses} výdaje',
    many: '{expenses} výdaje',
    other: '{expenses} výdajů',
  },
  'screen.exportCsv': 'Exportovat CSV',
  'screen.addFirst': 'Přidat první výdaj',
  'screen.empty.title': 'Zatím žádné výdaje',
  'screen.empty.body':
    'Zapisuj, co utrácíš, průběžně. planned.travel to rozdělí mezi všechny cestovatele a drží průběžný součet v {currency}.',
  'screen.filtered.title': 'Těmto filtrům nic neodpovídá',
  'screen.filtered.body':
    'Rozšiř hledání, vyber jiný den nebo zruš filtry, ať znovu uvidíš celou cestu.',
  'export.empty.title': 'Není co exportovat',
  'export.empty.body': 'Zapnutým filtrům neodpovídá žádný výdaj.',
  'export.ready.title': 'Export je hotový',
  'export.ready.body': {
    one: '{expenses} výdaj zapsán do CSV.',
    few: '{expenses} výdaje zapsány do CSV.',
    many: '{expenses} výdaje zapsáno do CSV.',
    other: '{expenses} výdajů zapsáno do CSV.',
  },
  'list.daySpent': 'utraceno {amount}',
  'skeleton.loading': 'Načítání výdajů',
  'row.noPayer': 'Zatím bez plátce',
  'row.youPaid': 'Zaplaceno tebou',
  'row.paid': 'Zaplaceno: {name}',
  'row.notYourShare': 'není tvůj podíl',
  'row.yourShare': '{amount} tvůj podíl',
  'row.noteOn': 'Poznámka k výdaji {title}',
  'row.edit': 'Upravit {title}',
  'row.delete': 'Smazat {title}',
  'row.saving': 'Ukládání',
  'row.splitOff': 'Podíly nesedí',
  'tile.owe.label': 'Dlužíš',
  'tile.owe.settled': 'Vše je vyrovnáno',
  'tile.owe.pending': 'Vyrovnej to před odletem domů',
  'tile.owe.to': 'Komu',
  'tile.owed.label': 'Dluží ti',
  'tile.owed.none': 'Nikdo ti nic nedluží',
  'tile.owed.pending': 'Ještě se ti vrátí',
  'tile.owed.from': 'Od',
  'tile.outstanding.label': 'Nevyřízeno',
  'tile.outstanding.none': 'Každý výdaj má plátce',
  'tile.outstanding.some': {
    one: '{expenses} výdaj zatím bez plátce',
    few: '{expenses} výdaje zatím bez plátce',
    many: '{expenses} výdaje zatím bez plátce',
    other: '{expenses} výdajů zatím bez plátce',
  },
  'category.accommodation': 'Ubytování',
  'category.transport': 'Doprava',
  'category.food': 'Jídlo a pití',
  'category.activities': 'Aktivity',
  'category.shopping': 'Nákupy',
  'category.fees': 'Poplatky',
  'category.insurance': 'Pojištění',
  'category.other': 'Ostatní',
  'toolbar.summary.everything': 'Zobrazeno vše',
  'toolbar.summary.filtered': 'Filtr: {filters}',
  'toolbar.summary.search': 'odpovídá „{term}“',
  'write.added': 'Výdaj přidán',
  'write.updated': 'Výdaj upraven',
  'write.deleted': 'Výdaj smazán',
  'write.addFailed': 'Výdaj se nepřidal',
  'write.editFailed': 'Výdaj se neuložil',
  'write.deleteFailed': 'Výdaj se nesmazal',
  'write.paymentRecorded': 'Platba zaznamenána',
  'write.paymentRecordedBody': 'Oba zůstatky jsou aktualizované.',
  'write.paymentFailed': 'Platba se nezaznamenala',
  'write.paymentDeleted': 'Platba smazána',
  'write.paymentDeleteFailed': 'Platba se nesmazala',
  'write.rolledBack': 'Změna byla vrácena zpět.',
  'expense.saveFallback':
    'Výdaj se nepodařilo uložit. Zkus to za chvíli znovu.',
} satisfies TranslationOf<typeof En>

export default messages
