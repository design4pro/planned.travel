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
  'expense.currencyLabel': 'Az a valuta, amiben a számla készült',
  'expense.convertedTo': 'Átszámítva {currency}-re',
  'expense.convertedHint': 'Mennyi lett {from} a kivonatodon {to}-ben.',
  'expense.convertedNotANumber': 'Írd be az átszámított összeget számként.',
  'expense.dateLabel': 'A kiadás dátuma',
  'expense.paidByHint':
    'Hagyd fizető nélkül, ha olyan számlát írsz fel, amit még senki nem állt.',
  'expense.nobodyYet': 'Még senki',
  'expense.whoPaid': 'Ki fizette',
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
  'payment.whoPaying': 'Ki fizet',
  'payment.whoPaid': 'Ki kapja',
  'payment.amountIn': 'Összeg {currency}-ben',
  'payment.amountPositive': 'Írj be nullánál nagyobb összeget.',
  'payment.how': 'Hogyan',
  'payment.howMade': 'Hogyan történt a fizetés',
  'payment.dateLabel': 'A fizetés dátuma',
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
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Rögzített fizetések',
  'payments.empty.title': 'Még nincs fizetés',
  'payments.empty.body':
    'Amint valaki visszafizet egy egyenleget, az átutalás ide kerül.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'A költségeket megtekintheted, de nem módosíthatod',
  'readOnly.body':
    'Kiadást hozzáadni, módosítani vagy törölni, illetve befizetést rögzíteni csak az utazás tulajdonosai és a szerkesztési joggal rendelkezők tudnak. Ha valamit módosítani kell, kérj meg egy tulajdonost.',
  'readOnly.empty':
    'Ehhez az utazáshoz még nem rögzítettek kiadást. Itt jelennek meg, amint egy tulajdonos vagy szerkesztő hozzáadja őket.',
  'readOnly.settleEmpty':
    'Jelenleg nincs szükség átutalásra. Az esetleges egyenlőtlenség itt jelenne meg.',
} satisfies TranslationOf<typeof En>

export default messages
