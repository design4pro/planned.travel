/**
 * The trip tabs' own copy, in cs.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurál.** `one` · `few` · `many` · `other`; `many` je desetinné číslo.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Tuto cestu se nepodařilo načíst',
  'error.plan': 'Program se nepodařilo načíst',
  'error.costs': 'Náklady se nepodařilo načíst',
  'error.collab': 'Konverzaci se nepodařilo načíst',
  'error.book': 'Rezervace se nepodařilo načíst',
  'error.transports': 'Přesuny se nenačetly',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Program',
  'plan.places': 'Místa',
  'plan.day.empty': 'Nic naplánováno – přetáhni sem místo nebo poznámku',
  'plan.move.refused.duplicate': '{name} v tom dni už je',
  'plan.move.refused.duplicateBody': 'Místo se může v jednom dni objevit jen jednou. Přesuňte ho na jiný den.',
  'plan.move.refused.notInIdeas': 'Poznámka zůstává ve dni',
  'plan.move.refused.notInIdeasBody': 'Nápady jsou místa, která čekají na svůj den. Poznámka patří ke dni, ke kterému byla napsána.',
  'plan.move.refused.notInAnotherDay': 'Poznámka zůstává u svého dne',
  'plan.move.refused.notInAnotherDayBody': 'Poznámky zatím nelze přesouvat mezi dny. Upravte poznámku, nebo ji napište k jinému dni.',
  'plan.move.spoken.duplicate': '{name} se nepřesunul. Ten den ho už má.',
  'plan.move.spoken.notInIdeas': '{name} se nepřesunul. Poznámka zůstává ve dni.',
  'plan.move.spoken.notInAnotherDay': '{name} se nepřesunul. Poznámka zůstává u svého dne.',
  'plan.move.error.save': 'Přesunutí se nepodařilo uložit',
  'plan.move.error.retry': 'Zkuste to za chvíli znovu.',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Přidat poznámku',
  'plan.note.addForDay': 'Přidat poznámku: {day}',
  'plan.note.showMore': 'Zobrazit více',
  'plan.note.showLess': 'Zobrazit méně',
  'plan.note.moveUp': 'Posunout nahoru',
  'plan.note.moveDown': 'Posunout dolů',
  'plan.note.drag': 'Změnit pořadí poznámky',
  'plan.note.edit': 'Upravit poznámku',
  'plan.note.delete': 'Smazat poznámku',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Přidat poznámku',
  'plan.note.dialog.editTitle': 'Upravit poznámku',
  'plan.note.field.body': 'Poznámka',
  'plan.note.field.bodyHint': 'Jeden řádek. To se u dne zobrazí.',
  'plan.note.field.detail': 'Podrobnosti',
  'plan.note.field.detailHint':
    'Nadpisy, seznamy, odkazy, citace, kód a tabulky.',
  'plan.note.field.time': 'Čas',
  'plan.note.field.timeHint': 'Nepovinné, ve 24hodinovém formátu.',
  'plan.note.field.icon': 'Ikona',
  'plan.note.tab.write': 'Psaní',
  'plan.note.tab.preview': 'Náhled',
  'plan.note.previewEmpty': 'Zatím není co zobrazit v náhledu',
  'plan.note.save': 'Uložit poznámku',
  'plan.note.cancel': 'Zrušit',
  'plan.note.confirmDelete': 'Smazat tuto poznámku?',
  'plan.note.confirmDeleteBody':
    'Poznámka i její podrobnosti z tohoto dne zmizí.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Poznámka přidána',
  'plan.note.toast.updated': 'Poznámka uložena',
  'plan.note.toast.deleted': 'Poznámka smazána',
  'plan.note.error.save': 'Poznámku se nepodařilo uložit',
  'plan.note.error.delete': 'Poznámku se nepodařilo smazat',
  'plan.note.error.move': 'Přesunutí se nepodařilo uložit',
  'plan.note.error.retry': 'Zkuste to za chvíli znovu.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Připomínka',
  'plan.note.icon.clock': 'Čas',
  'plan.note.icon.flashlight': 'Baterka',
  'plan.note.icon.footprints': 'Procházka',
  'plan.note.icon.info': 'Informace',
  'plan.note.icon.luggage': 'Zavazadla',
  'plan.note.icon.package': 'Balíček',
  'plan.note.icon.ticket': 'Vstupenky',
  'plan.note.icon.trainFront': 'Vlak',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Poznámka',
  'plan.note.icon.utensils': 'Jídlo',
  'plan.note.icon.bus': 'Doprava',
  'plan.note.icon.bedDouble': 'Ubytování',
  'plan.note.icon.camera': 'Fotka',
  'plan.note.icon.mapPin': 'Místo',
  'plan.note.icon.wallet': 'Peníze',
  'plan.note.icon.umbrella': 'Déšť',
  'plan.note.icon.triangleAlert': 'Upozornění',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Společně',
  'collab.empty': 'Zatím nic nesdíleno',
  'collab.conversation': 'Konverzace',
  'collab.count.messages': {
    one: '{messages} zpráva',
    few: '{messages} zprávy',
    many: '{messages} zprávy',
    other: '{messages} zpráv',
  },
  'collab.count.notes': {
    one: '{notes} poznámka',
    few: '{notes} poznámky',
    many: '{notes} poznámky',
    other: '{notes} poznámek',
  },
  'collab.count.polls': {
    one: '{polls} anketa',
    few: '{polls} ankety',
    many: '{polls} ankety',
    other: '{polls} anket',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Rezervace',
  'book.empty': 'Zatím nic rezervováno',
  'book.count.bookings': {
    one: '{bookings} rezervace',
    few: '{bookings} rezervace',
    many: '{bookings} rezervace',
    other: '{bookings} rezervací',
  },
  'book.count.confirmed': {
    one: '{confirmed} potvrzená',
    few: '{confirmed} potvrzené',
    many: '{confirmed} potvrzené',
    other: '{confirmed} potvrzených',
  },
  'book.progressLabel': {
    one: '{confirmed} z {total} rezervace potvrzena',
    few: '{confirmed} z {total} rezervací potvrzeny',
    many: '{confirmed} z {total} rezervací potvrzeny',
    other: '{confirmed} z {total} rezervací potvrzeno',
  },
  'book.ofTotal': 'z {total}',
  'book.confirmed': 'Potvrzené',
  'book.awaiting': 'Čeká na potvrzení',
  'book.nothingHanging': 'Nic nevisí',
  'book.chase': 'Vyřeš to před odletem',
  'book.committed': 'Závazky',
  'book.committedCaption': 'Ze všech rezervací této cesty',
  'book.onItinerary': 'V programu',
  'book.pinnedCaption': 'Připnuto ke dni programu',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Přesuny',
  'transports.empty': 'Zatím nic zaznamenáno',
  'transports.count.transports': {
    one: '{transports} přesun',
    few: '{transports} přesuny',
    many: '{transports} přesunu',
    other: '{transports} přesunů',
  },
  'transports.distance': 'Ujetá vzdálenost',
  'transports.equator': '≈ {times}× kolem rovníku',
  'transports.noGrouping': 'Zatím nic seskupeno',
  'transports.mostly': 'převážně {mode}',
  'transports.confirmed': 'Potvrzeno',
  'transports.stillPending': {
    one: '{pending} stále čeká',
    few: '{pending} stále čekají',
    many: '{pending} stále čeká',
    other: '{pending} stále čeká',
  },
  'transports.spent': 'Utraceno za cestování',
  'transports.noPrices': 'Žádné ceny nezaznamenány',
  'transports.priced': {
    one: 'napříč {priced} oceněným přesunem',
    few: 'napříč {priced} oceněnými přesuny',
    many: 'napříč {priced} oceněnými přesuny',
    other: 'napříč {priced} oceněnými přesuny',
  },
} satisfies TranslationOf<typeof En>

export default messages
