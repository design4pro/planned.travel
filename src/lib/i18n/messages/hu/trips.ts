/**
 * The trip tabs' own copy, in hu.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Többes szám.** `one` · `other`; a magyar szám után egyes számot használ.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Ezt az utazást nem sikerült betölteni',
  'error.plan': 'Az útitervet nem sikerült betölteni',
  'error.costs': 'A költségeket nem sikerült betölteni',
  'error.collab': 'A beszélgetést nem sikerült betölteni',
  'error.book': 'A foglalásokat nem sikerült betölteni',
  'error.transports': 'Az utak nem töltődtek be',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Útiterv',
  'plan.places': 'Helyek',
  'plan.day.empty': 'Még nincs terv – húzz ide egy helyet vagy egy jegyzetet',
  'plan.move.refused.duplicate': '{name} már szerepel azon a napon',
  'plan.move.refused.duplicateBody': 'Egy hely naponta csak egyszer szerepelhet. Tegye inkább egy másik napra.',
  'plan.move.refused.notInIdeas': 'A jegyzet a napon belül marad',
  'plan.move.refused.notInIdeasBody': 'Az ötletek napra váró helyek. A jegyzet ahhoz a naphoz tartozik, amelyikre írták.',
  'plan.move.refused.notInAnotherDay': 'A jegyzet a saját napján marad',
  'plan.move.refused.notInAnotherDayBody': 'A jegyzetek egyelőre nem helyezhetők át másik napra. Szerkessze a jegyzetet, vagy írja meg a másik napon.',
  'plan.move.spoken.duplicate': '{name} nem lett áthelyezve. Az a nap már tartalmazza.',
  'plan.move.spoken.notInIdeas': '{name} nem lett áthelyezve. A jegyzet a napon belül marad.',
  'plan.move.spoken.notInAnotherDay': '{name} nem lett áthelyezve. A jegyzet a saját napján marad.',
  'plan.move.error.save': 'A mozgatást nem sikerült menteni',
  'plan.move.error.retry': 'Próbálja meg újra egy pillanat múlva.',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Jegyzet hozzáadása',
  'plan.note.addForDay': 'Jegyzet hozzáadása: {day}',
  'plan.note.showMore': 'Több megjelenítése',
  'plan.note.showLess': 'Kevesebb megjelenítése',
  'plan.note.moveUp': 'Mozgatás felfelé',
  'plan.note.moveDown': 'Mozgatás lefelé',
  'plan.note.drag': 'Jegyzet átrendezése',
  'plan.note.edit': 'Jegyzet szerkesztése',
  'plan.note.delete': 'Jegyzet törlése',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Jegyzet hozzáadása',
  'plan.note.dialog.editTitle': 'Jegyzet szerkesztése',
  'plan.note.field.body': 'Jegyzet',
  'plan.note.field.bodyHint': 'Egy sor. Ez jelenik meg a napnál.',
  'plan.note.field.detail': 'Részletek',
  'plan.note.field.detailHint':
    'Címsorok, listák, hivatkozások, idézetek, kód és táblázatok.',
  'plan.note.field.time': 'Időpont',
  'plan.note.field.timeHint': 'Nem kötelező, 24 órás formátumban.',
  'plan.note.field.icon': 'Ikon',
  'plan.note.tab.write': 'Írás',
  'plan.note.tab.preview': 'Előnézet',
  'plan.note.previewEmpty': 'Még nincs mit megjeleníteni',
  'plan.note.save': 'Jegyzet mentése',
  'plan.note.cancel': 'Mégse',
  'plan.note.confirmDelete': 'Törli ezt a jegyzetet?',
  'plan.note.confirmDeleteBody':
    'A jegyzet és a részletei eltűnnek erről a napról.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Jegyzet hozzáadva',
  'plan.note.toast.updated': 'Jegyzet mentve',
  'plan.note.toast.deleted': 'Jegyzet törölve',
  'plan.note.error.save': 'A jegyzetet nem sikerült menteni',
  'plan.note.error.delete': 'A jegyzetet nem sikerült törölni',
  'plan.note.error.move': 'A mozgatást nem sikerült menteni',
  'plan.note.error.retry': 'Próbálja meg újra egy pillanat múlva.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Emlékeztető',
  'plan.note.icon.clock': 'Időpont',
  'plan.note.icon.flashlight': 'Zseblámpa',
  'plan.note.icon.footprints': 'Séta',
  'plan.note.icon.info': 'Információ',
  'plan.note.icon.luggage': 'Poggyász',
  'plan.note.icon.package': 'Csomag',
  'plan.note.icon.ticket': 'Jegyek',
  'plan.note.icon.trainFront': 'Vonat',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Jegyzet',
  'plan.note.icon.utensils': 'Étkezés',
  'plan.note.icon.bus': 'Közlekedés',
  'plan.note.icon.bedDouble': 'Szállás',
  'plan.note.icon.camera': 'Fénykép',
  'plan.note.icon.mapPin': 'Hely',
  'plan.note.icon.wallet': 'Pénz',
  'plan.note.icon.umbrella': 'Eső',
  'plan.note.icon.triangleAlert': 'Figyelmeztetés',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Közösen',
  'collab.empty': 'Még semmit sem osztottak meg',
  'collab.conversation': 'Beszélgetés',
  'collab.count.messages': {
    one: '{messages} üzenet',
    other: '{messages} üzenet',
  },
  'collab.count.notes': {
    one: '{notes} jegyzet',
    other: '{notes} jegyzet',
  },
  'collab.count.polls': {
    one: '{polls} szavazás',
    other: '{polls} szavazás',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Foglalások',
  'book.empty': 'Még nincs foglalás',
  'book.count.bookings': {
    one: '{bookings} foglalás',
    other: '{bookings} foglalás',
  },
  'book.count.confirmed': {
    one: '{confirmed} megerősítve',
    other: '{confirmed} megerősítve',
  },
  'book.progressLabel': {
    one: '{total} foglalásból {confirmed} megerősítve',
    other: '{total} foglalásból {confirmed} megerősítve',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': 'Megerősítve',
  'book.awaiting': 'Megerősítésre vár',
  'book.nothingHanging': 'Semmi sem lóg',
  'book.chase': 'Intézd el indulás előtt',
  'book.committed': 'Lekötve',
  'book.committedCaption': 'Az utazás összes foglalására',
  'book.onItinerary': 'Az útitervben',
  'book.pinnedCaption': 'Az útiterv egy napjához rögzítve',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Utak',
  'transports.empty': 'Még nincs rögzítve semmi',
  'transports.count.transports': {
    one: '{transports} út',
    other: '{transports} út',
  },
  'transports.distance': 'Megtett távolság',
  'transports.equator': '≈ {times}× az Egyenlítő körül',
  'transports.noGrouping': 'Még nincs csoportosítva semmi',
  'transports.mostly': 'többnyire {mode}',
  'transports.confirmed': 'Megerősítve',
  'transports.stillPending': {
    one: '{pending} még függőben',
    other: '{pending} még függőben',
  },
  'transports.spent': 'Utazásra költve',
  'transports.noPrices': 'Nincs rögzített ár',
  'transports.priced': {
    one: '{priced} árazott úton',
    other: '{priced} árazott úton',
  },
} satisfies TranslationOf<typeof En>

export default messages
