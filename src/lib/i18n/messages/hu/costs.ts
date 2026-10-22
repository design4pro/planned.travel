/**
 * The costs tab's copy, in hu.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Többes szám.** `one` · `other`; a magyar szám után egyes számot használ,
 * ezért a két ágazat egybeesik.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Te',
  'person.youTarget': 'neked',
  'person.removed': 'Eltávolított utazó',
  'person.removedTarget': 'egy eltávolított utazó',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Törlöd ezt a kiadást?',
  'delete.description':
    '„{title}” és a felosztása kiesik az elszámolásból. Ezt nem lehet visszavonni.',
  'delete.failed': 'A törlés nem sikerült',
  'delete.failedBody':
    'A kiadást nem sikerült törölni. Próbáld meg egy pillanat múlva.',
  'delete.noBalances':
    'Egyetlen egyenleg sem változik - semmi nem volt rá felosztva.',
  'delete.balancesChange': '{names} egyenlege változik.',
  'delete.confirm': 'Kiadás törlése',
  'delete.working': 'A kiadás törlése folyik',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Kiadások',
  'toolbar.shownOf': '{total} / {shown}',
  'toolbar.searchPlaceholder':
    'Keresés kiadásokban, jegyzetekben vagy fizetők között…',
  'toolbar.searchLabel': 'Keresés a kiadásokban',
  'toolbar.allCategories': 'Minden kategória',
  'toolbar.allDays': 'Minden nap',
  'toolbar.filterCategory': 'Szűrés kategóriára',
  'toolbar.filterDay': 'Szűrés napra',
  'toolbar.whose': 'Kinek a kiadásai',
  'toolbar.paidByMe': 'Én fizettem',
  'toolbar.owedToMe': 'Nekem tartoznak',
  'toolbar.logged': {
    one: '{value} rögzítve',
    other: '{value} rögzítve',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Felosztás az utazók között',
  'split.label': 'Felosztás',
  'split.everyone': 'Mindenki',
  'split.nobody': 'Senki',
  'split.departed': 'Elhagyta az utat',
  'split.departedHint':
    'Ha valakit, aki elhagyta az utat, kijelölés nélkül hagysz, a részesedése végleg törlődik.',
  'split.includeFor': '{name} szerepeljen ebben a felosztásban',
  'split.how': 'Hogyan oszlik meg ez a kiadás',
  'split.method.equal': 'Egyenlően',
  'split.method.equalHint':
    'Mindenki, aki benne van, ugyanannyit fizet, a maradék legkisebb egység pedig a lista első emberéhez kerül.',
  'split.method.exact': 'Pontosan',
  'split.method.exactHint':
    'Írd be, ki mennyit tartozik valójában. Az összegeknek ki kell adniuk a végösszeget.',
  'split.method.shares': 'Részek',
  'split.method.sharesHint':
    'Súlyozd a felosztást - 2 rész egy párnak, 1 mindenki másnak.',
  'split.method.percentage': 'Százalék',
  'split.method.percentageHint':
    'Felosztás százalékban. A százalékoknak 100-at kell adniuk.',
  'split.exactFor': 'Pontos összeg {name} részéről',
  'split.percentFor': 'Százalék {name} részéről',
  'split.sharesFor': 'Részek {name} részéről',
  'split.balanced': 'Kijön',
  'split.allocated': '{total} / {allocated} felosztva',
  'split.over': '{amount} a sok',
  'split.left': '{amount} a hiány',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Összeg',
  'field.currency': 'Valuta',
  'field.date': 'Dátum',
  'field.paidBy': 'Fizette',
  'expense.editTitle': 'Kiadás szerkesztése',
  'expense.addTitle': 'Kiadás hozzáadása',
  'expense.editDescription':
    'Ha módosítod az összeget, újra felosztjuk mindenki között, aki lentebb szerepel.',
  'expense.addDescription':
    'Ennél az utazásnál az összegeket {currency}-ben tartjuk. Írd fel a számlát a saját valutájában, és add meg, mennyi lett átszámítva.',
  'expense.saveFailed': 'A mentés nem sikerült',
  'expense.what': 'Mire volt',
  'expense.whatPlaceholder': 'Vacsora a Kyubeyben',
  'expense.amountNotANumber': 'Írd be az összeget számként.',
  'expense.convertedTo': 'Átszámítva {currency}-re',
  'expense.convertedHint': 'Mennyi lett {from} a kivonatodon {to}-ben.',
  'expense.convertedSuggested':
    'Javasolt érték az ezen az úton használt árfolyam alapján ({date}, {rate}). Módosítsd, hogy egyezzen a kivonatoddal.',
  'expense.convertedNotANumber': 'Írd be az átszámított összeget számként.',
  'expense.paidByHint':
    'Hagyd fizető nélkül, ha olyan számlát írsz fel, amit még senki nem állt.',
  'expense.nobodyYet': 'Még senki',
  'expense.notesHint': 'Nem kötelező. Bármi, amit a számla nem mond el.',
  'expense.notesPlaceholder': 'Megosztott kóstolómenü, az italok külön.',
  'expense.noAmount': 'Még nincs összeg',
  'expense.saving': 'A kiadás mentése folyik',
  'expense.saveChanges': 'Módosítások mentése',
  'expense.add': 'Kiadás hozzáadása',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Fizetés rögzítése',
  'payment.description':
    'A rögzített átutalás kiesik mindkét egyenlegből. Pénzt nem mozgat - a planned.travel az elszámolást vezeti, a pénzt a bankod utalja.',
  'payment.youSuffix': '{name} (te)',
  'payment.pays': '{from} fizet {to} részére',
  'payment.pickTwo': 'Válassz két különböző embert.',
  'payment.paidTo': 'Kinek fizette',
  'payment.needsTwo': 'Egy fizetéshez két különböző ember kell.',
  'payment.amountIn': 'Összeg {currency}-ben',
  'payment.amountPositive': 'Írj be nullánál nagyobb összeget.',
  'payment.how': 'Hogyan',
  'payment.note': 'Megjegyzés',
  'payment.noteHint': 'Nem kötelező. Egy hivatkozás, vagy hogy mit fedezett.',
  'payment.notePlaceholder': 'A kiotói szállást és a JR-bérleteket fedezi.',
  'payment.recording': 'A fizetés rögzítése folyik',
  'payment.confirm': 'Fizetés rögzítése',
  'payment.failed':
    'A fizetést nem sikerült rögzíteni. Próbáld meg egy pillanat múlva.',
  'payment.method.bankTransfer': 'Banki átutalás',
  'payment.method.cash': 'Készpénz',
  'payment.method.card': 'Kártya',
  'payment.method.app': 'Fizetési alkalmazás',
  'payment.method.other': 'Valami más',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Elszámolás',
  'settle.addPayment': 'Fizetés hozzáadása',
  'settle.action': 'Elszámolás',
  'settle.empty.title': 'Mindenki kvittre jött',
  'settle.empty.body':
    'Nincs szükség átutalásra. Vegyél fel egy kiadást, és minden eltérés itt jelenik meg.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Egyenlegek',
  'balances.count': {
    one: '{travellers} utazó',
    other: '{travellers} utazó',
  },
  'balances.empty':
    'Az egyenlegek akkor jelennek meg, ha egy kiadásnak van fizetője és felosztása.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Kategória szerint',
  'categories.againstBudget': 'Az út költségvetéséhez mérve',
  'categories.progressLabel': 'Elköltve az út költségvetéséhez mérve',
  'categories.empty':
    'A költségvetési sorok és a kiadások itt bomlanak le, amint van mit lebontani.',
  'categories.legendLabel': 'Költés kategóriánként',
  'categories.planned': '{amount} tervezve',
  'categories.nothingSpent': 'Még nem költöttetek semmit. Ezt tervezitek.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'kevesebb, mint {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Kire költöttek',
  'memberBar.others': {
    one: '{others} további utazó',
    other: '{others} további utazó',
  },
  'memberBar.notSplit': 'Senkihez nincs rendelve',
  'totalTile.label': 'Az utazás teljes költése',
  'totalTile.captionPlanned': '{amount} tervezve az összes utazónak',
  'totalTile.captionBudget': '{amount} költségvetés az utazásra',
  'totalTile.yourShare': 'A te részed',
  'totalTile.youPaid': 'Te fizettél',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Rögzített fizetések',
  'payments.empty.title': 'Még nincs fizetés',
  'payments.empty.body':
    'Amint valaki visszafizet egy egyenleget, az átutalás ide kerül.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Ez az utazás archiválva van. A költségek módosítása előtt állítsd vissza.',
  'readOnly.title': 'A költségeket megtekintheted, de nem módosíthatod',
  'readOnly.body':
    'Kiadást hozzáadni, módosítani vagy törölni, illetve befizetést rögzíteni csak az utazás tulajdonosai és a szerkesztési joggal rendelkezők tudnak. Ha valamit módosítani kell, kérj meg egy tulajdonost.',
  'readOnly.empty':
    'Ehhez az utazáshoz még nem rögzítettek kiadást. Itt jelennek meg, amint egy tulajdonos vagy szerkesztő hozzáadja őket.',
  'readOnly.settleEmpty':
    'Jelenleg nincs szükség átutalásra. Az esetleges egyenlőtlenség itt jelenne meg.',
  'refusal.rebaseChanged':
    'Az utazás megváltozott, miközben megerősítetted, ezért semmi sem módosult. Nézd át az új összegeket, és erősítsd meg újra.',
  'refusal.tripCurrencyChanged':
    'Az utazás költségvetésének pénzneme mostantól {to}, ezért nem mentődött el. Az oldal frissült: ellenőrizd az összeget, és mentsd újra.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Megjelenítési pénznem',
  'display.indicator.perTrip': 'Saját pénznem',
  'display.indicator.fixed': '{code} is',
  'display.menu.perTrip': 'Minden utazás a saját pénznemében',
  'display.menu.workspace': '{code} (a munkaterület alapértelmezettje)',
  'display.menu.rateHint': 'Egy utazásnál már rögzített árfolyamot használ',
  'display.menu.currentHint':
    'Kiválasztva, de egyetlen rögzített árfolyam sem fedi le',
  'display.menu.needsLiveRate':
    'Élő árfolyam kell hozzá, ami még nem érhető el',
  'display.menu.saving': 'A választás mentése folyamatban',
  'display.error.title': 'A megjelenítési pénznem nem lett elmentve',
  'display.error.body':
    'A választást nem sikerült elmenteni. Próbáld újra egy pillanat múlva.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Kb. {amount} {code} a megjelenítési pénznemedben',
  'display.row.notConverted': 'Nincs átváltva',
  'display.alert.title': 'Néhány összeg nincs átváltva',
  'display.alert.body':
    'Ezekhez a pénznempárokhoz nincs rögzített árfolyam, ezért ezek az összegek a költségkeret pénznemében maradnak:',
  'display.alert.pair': '{from} → {to}, {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Költségvetés pénznemének módosítása',
  'rebase.title': 'A költségvetés pénznemének módosítása',
  'rebase.description':
    'A beírt összegek úgy maradnak, ahogy beírtad őket. Az utazás összesítései és egyenlegei az új pénznemre lesznek átváltva.',
  'rebase.to': 'Új pénznem',
  'rebase.toPlaceholder': 'Válassz pénznemet',
  'rebase.rateLabel': 'Árfolyam (1 {from} ennyi {to})',
  'rebase.rateInverse': 'Vagyis 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Nullánál nagyobb árfolyamot adj meg.',
  'rebase.rateOutOfRange':
    'Ez az árfolyam túl nagynak vagy túl kicsinek tűnik. Ellenőrizd, melyik irányban értendő.',
  'rebase.source.recent': 'A munkaterületen utoljára használt árfolyam',
  'rebase.source.manual': 'Az általad megadott árfolyam',
  'rebase.noRate':
    'Nincs rögzített árfolyam: {from} → {to}. Add meg azt, amelyiket használni szeretnéd.',
  'rebase.waitingForRate': 'Az előnézet megjelenik, amint van árfolyam.',
  'rebase.loading': 'Az átváltás kiszámítása',
  'rebase.example':
    '{original} úgy marad, ahogy beírtad, és {converted} értékben számít.',
  'rebase.count.expenses': {
    one: '{count} kiadás {to} pénznemben lesz számolva.',
    other: '{count} kiadás {to} pénznemben lesz számolva.',
  },
  'rebase.count.payments': {
    one: '{count} fizetés {to} pénznemben lesz számolva.',
    other: '{count} fizetés {to} pénznemben lesz számolva.',
  },
  'rebase.count.planned': {
    one: '{count} tervezett tétel {to} pénznemben lesz számolva.',
    other: '{count} tervezett tétel {to} pénznemben lesz számolva.',
  },
  'rebase.pinned':
    'A helyek, foglalások, szállások és közlekedés árai {from} pénznemben maradnak.',
  'rebase.target': 'Az utazás költségvetése {before} helyett {after} lesz.',
  'rebase.rounding':
    'Minden összeg csak egyszer lesz kerekítve, ezért egy egyenleg legfeljebb {amount} összeggel változhat.',
  'rebase.leftover':
    'A módosítás után {name} {amount} összeggel tartozna {other} részére.',
  'rebase.someone': 'Valaki',
  'rebase.nothing':
    'Ezen az utazáson még semmi nincs beárazva, ezért nincs mit átváltani.',
  'rebase.unconverted': {
    one: '{count} tétel nem {from} pénznemben van, ezért nem váltható át automatikusan. Ez általában egy másik pénznemben beárazott foglalásból létrejött kiadás: szerkeszd vagy töröld, majd próbáld újra.',
    other:
      '{count} tétel nem {from} pénznemben van, ezért nem váltható át automatikusan. Ezek általában másik pénznemben beárazott foglalásokból létrejött kiadások: szerkeszd vagy töröld őket, majd próbáld újra.',
  },
  'rebase.unsplittable': {
    one: '{count} kiadás felosztása nem vihető át, mert minden részesedése nulla. Szerkeszd vagy töröld, majd próbáld újra.',
    other:
      '{count} kiadás felosztása nem vihető át, mert minden részesedésük nulla. Szerkeszd vagy töröld őket, majd próbáld újra.',
  },
  'rebase.outOfRange':
    'Ezzel az árfolyammal az utazás egyik összege túl nagy lenne ahhoz, hogy {to} pénznemben el lehessen tárolni. Ellenőrizd az árfolyamot és az irányát.',
  'rebase.tooLarge':
    'Ennek az utazásnak túl sok tétele van ahhoz, hogy egy lépésben módosítsuk: egyszerre {changes} módosításra lenne szükség, a korlát pedig {limit}. A költségvetés egyelőre {from} pénznemben marad.',
  'rebase.copyPending':
    'Az utazás másolása még folyamatban van. Próbáld újra egy pillanat múlva.',
  'rebase.error': 'Az átváltást nem sikerült betölteni. Semmi sem változott.',
  'rebase.commitError':
    'Nem sikerült módosítani a költségvetés pénznemét. Semmi sem változott.',
  'rebase.stale':
    'Az utazás költségvetési pénzneme mostantól {current}, nem {from}. Zárd be ezt az ablakot, és nyisd meg újra.',
  'rebase.sameCurrency':
    'A költségvetés már {to} pénznemben van. Válassz másik pénznemet.',
  'rebase.commitUnknown':
    'Nem tudtuk megerősíteni, hogy a költségvetés pénzneme {to}-ra változott-e. Újrapróbálkozás előtt töltsd újra az oldalt, és ellenőrizd.',
  'rebase.retry': 'Újra',
  'rebase.confirm': 'Váltás: {to}',
  'rebase.committing': 'A költségvetés pénznemének módosítása folyamatban',
  'rebase.done': 'A költségvetés mostantól {to} pénznemben van.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Még semmi nincs elköltve',
  'screen.summary': '{expenses} · {spent} elköltve',
  'count.expenses': {
    one: '{expenses} kiadás',
    other: '{expenses} kiadás',
  },
  'screen.exportCsv': 'CSV exportálása',
  'screen.addFirst': 'Az első kiadás hozzáadása',
  'screen.empty.title': 'Még nincs kiadás',
  'screen.empty.body':
    'Írd fel menet közben, amit elköltesz. A planned.travel felosztja az összes utazó között, és {currency} pénznemben vezeti az éppen aktuális összeget.',
  'screen.filtered.title': 'Egy kiadás sem felel meg ezeknek a szűrőknek',
  'screen.filtered.body':
    'Szélesítsd a keresést, válassz másik napot, vagy töröld a szűrőket, hogy újra az egész utat lásd.',
  'export.empty.title': 'Nincs mit exportálni',
  'export.empty.body': 'Egy kiadás sem felel meg a bekapcsolt szűrőknek.',
  'export.ready.title': 'Az exportálás kész',
  'export.ready.body': {
    one: '{expenses} kiadás bekerült a CSV-be.',
    other: '{expenses} kiadás bekerült a CSV-be.',
  },
  'list.daySpent': '{amount} elköltve',
  'skeleton.loading': 'A kiadások betöltése',
  'row.noPayer': 'Még nincs fizető',
  'row.youPaid': 'Te fizettél',
  'row.paid': '{name} fizetett',
  'row.notYourShare': 'nem a te részed',
  'row.yourShare': '{amount} a te részed',
  'row.noteOn': 'Megjegyzés ehhez: {title}',
  'row.edit': '{title} szerkesztése',
  'row.delete': '{title} törlése',
  'row.saving': 'Mentés',
  'tile.owe.label': 'Te tartozol',
  'tile.owe.settled': 'Minden rendezve nálad',
  'tile.owe.pending': 'Rendezd, mielőtt hazarepülsz',
  'tile.owe.to': 'Neki',
  'tile.owed.label': 'Neked tartoznak',
  'tile.owed.none': 'Neked senki nem tartozik',
  'tile.owed.pending': 'Még vissza kell kapnod',
  'tile.owed.from': 'Tőle',
  'tile.outstanding.label': 'Függőben',
  'tile.outstanding.none': 'Minden kiadásnak van fizetője',
  'tile.outstanding.some': {
    one: '{expenses} kiadásnak még nincs fizetője',
    other: '{expenses} kiadásnak még nincs fizetője',
  },
  'category.accommodation': 'Szállás',
  'category.transport': 'Közlekedés',
  'category.food': 'Étel és ital',
  'category.activities': 'Programok',
  'category.shopping': 'Vásárlás',
  'category.fees': 'Díjak és költségek',
  'category.insurance': 'Biztosítás',
  'category.other': 'Egyéb',
  'toolbar.summary.everything': 'Minden megjelenik',
  'toolbar.summary.filtered': 'Szűrve: {filters}',
  'toolbar.summary.search': 'egyezik ezzel: „{term}”',
  'write.added': 'Kiadás hozzáadva',
  'write.updated': 'Kiadás frissítve',
  'write.deleted': 'Kiadás törölve',
  'write.addFailed': 'A kiadás nem lett hozzáadva',
  'write.editFailed': 'A kiadás nem lett elmentve',
  'write.deleteFailed': 'A kiadás nem lett törölve',
  'write.paymentRecorded': 'Befizetés rögzítve',
  'write.paymentRecordedBody': 'Mindkét egyenleg frissült.',
  'write.paymentFailed': 'A befizetés nem lett rögzítve',
  'write.rolledBack': 'A módosítás vissza lett vonva.',
  'expense.saveFallback':
    'A kiadást nem sikerült elmenteni. Próbáld újra egy pillanat múlva.',
} satisfies TranslationOf<typeof En>

export default messages
