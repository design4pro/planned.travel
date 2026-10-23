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
  'notFound.title': 'Nem találjuk ezt az utazást',
  'notFound.body':
    'Nem szerepel a jelenlegi munkaterületen megnyitható utazások között. Lehet, hogy törölték, vagy nincs hozzáférésed.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Hely hozzáadása ehhez az utazáshoz',
  'plan.editor.editTitle': 'Hely szerkesztése',
  'plan.editor.createDescription':
    'Adj nevet most, helyzetet később - a nem tervezett hely a helyek paneljén vár, amíg egy naphoz rendeled.',
  'plan.editor.editDescription':
    'A módosítás mindenhol érvényes: a térképen, minden érintett napon és az utazás helylistájában.',
  'plan.editor.nameRequired': 'A helynek nevet kell adni',
  'plan.editor.nameExample': 'pl. Fusimi Inari Taisa',
  'plan.editor.city': 'Város',
  'plan.editor.cityExample': 'pl. Kiotó',
  'plan.editor.addressExample': 'pl. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Ott töltött idő',
  'plan.editor.rating': 'Megéri?',
  'plan.editor.latitude': 'Szélesség',
  'plan.editor.longitude': 'Hosszúság',
  'plan.editor.positionHint':
    'Vagy zárd be, és válaszd ki a pontot a térképen.',
  'plan.editor.latitudeError': '-90 és 90 között',
  'plan.editor.longitudeError': '-180 és 180 között',
  'plan.editor.positionError': 'A helyzethez mindkét szám kell',
  'plan.editor.day': 'Naphoz rendelés',
  'plan.editor.dayHint': 'Hagyd üresen, hogy a helyek paneljén maradjon.',
  'plan.editor.unplanned': 'Maradjon tervezetlen',
  'plan.editor.dayNamed': '{day}. nap · {title}',
  'plan.editor.stopFallback': 'Ez a megálló',
  'plan.editor.dayNumber': '{day}. nap',
  'plan.editor.visited': 'Már meglátogatva',
  'plan.editor.visitedHint': 'Pipával jelöli a térképtűt.',
  'plan.editor.saving': 'Hely mentése',
  'plan.editor.save': 'Módosítások mentése',
  'plan.editor.noCategory': 'Nincs kategória',
  'plan.editor.arrive': 'Érkezés',
  'plan.editor.leave': 'Indulás',
  'plan.editor.timeError': 'Az indulás legyen az érkezés után',
  'plan.editor.booking': 'Foglalás',
  'plan.editor.note': 'Megjegyzés ehhez a megállóhoz',
  'plan.editor.noteExample': 'Menj korán - 9 után egy óra a sor.',
  'plan.editor.savingTimes': 'Időpontok mentése',
  'plan.editor.saveTimes': 'Mentés',
  'plan.editor.duration0': 'Nincs rögzített időtartam',
  'plan.editor.duration30': '30 perc',
  'plan.editor.duration45': '45 perc',
  'plan.editor.duration60': '1 óra',
  'plan.editor.duration90': '1½ óra',
  'plan.editor.duration120': '2 óra',
  'plan.editor.duration180': '3 óra',
  'plan.editor.duration240': 'Fél nap',
  'plan.editor.duration480': 'Egész nap',
  'plan.editor.rating0': 'Nincs értékelés',
  'plan.editor.rating1': '★ 1 - kihagyható',
  'plan.editor.rating2': '★ 2 - ha van idő',
  'plan.editor.rating3': '★ 3 - megéri',
  'plan.editor.rating4': '★ 4 - nagyon jó',
  'plan.editor.rating5': '★ 5 - kihagyhatatlan',
  'plan.editor.bookingNone': 'Nem kell foglalás',
  'plan.editor.bookingPending': 'Még foglalni kell',
  'plan.editor.bookingConfirmed': 'Lefoglalva és visszaigazolva',
  'plan.editor.bookingCompleted': 'Látogatás kész',
  'plan.editor.bookingCancelled': 'Lemondva',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Ezt az utazást nem sikerült betölteni',
  'error.plan': 'Az útitervet nem sikerült betölteni',
  'error.costs': 'A költségeket nem sikerült betölteni',
  'error.collab': 'A beszélgetést nem sikerült betölteni',
  'error.book': 'A foglalásokat nem sikerült betölteni',
  'error.transports': 'Az utak nem töltődtek be',
  'error.people': 'A résztvevőket nem sikerült betölteni',
  'header.length': {
    one: '{days} nap',
    other: '{days} nap',
  },
  'header.planned': {
    one: '{days} nap megtervezve',
    other: '{days} nap megtervezve',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Útiterv',
  'plan.places': 'Helyek',
  'plan.readOnly.archived':
    'Ez az utazás archiválva van, ezért a terv csak olvasható.',
  'plan.readOnly.role':
    'Ezt a tervet megtekintheted. Csak az utazás tulajdonosa és a szerkesztők módosíthatják.',
  'plan.day.empty': 'Még nincs terv – húzz ide egy helyet vagy egy jegyzetet',
  'plan.move.refused.duplicate': '{name} már szerepel azon a napon',
  'plan.move.refused.duplicateBody':
    'Egy hely naponta csak egyszer szerepelhet. Tegye inkább egy másik napra.',
  'plan.move.refused.notInIdeas': 'A jegyzet a napon belül marad',
  'plan.move.refused.notInIdeasBody':
    'Az ötletek napra váró helyek. A jegyzet mindig egy naphoz tartozik.',
  'plan.move.refused.journeyNotInIdeas': 'Az út a napon belül marad',
  'plan.move.refused.journeyNotInIdeasBody':
    'Az ötletek napra váró helyek. Az út ahhoz a naphoz tartozik, amelyiken megtörténik.',
  'plan.move.refused.journeyNotInAnotherDay': 'Az út a saját napján marad',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Az út napja a dátumaiból következik. Módosítsa őket az Utak lapon.',
  'plan.move.refused.journeyTimed': '{name} indulása {time}',
  'plan.move.refused.journeyTimedBody':
    'Az indulási idő a menetrendé, nem a terve. Tegye az utat oda, ahová az órája mutatja.',
  'plan.move.spoken.duplicate':
    '{name} nem lett áthelyezve. Az a nap már tartalmazza.',
  'plan.move.spoken.notInIdeas':
    '{name} nem lett áthelyezve. A jegyzet a napon belül marad.',
  'plan.move.spoken.timed':
    '{name} időpontja {time}. Megkérdezzük, elhagyjuk-e.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} nem lett áthelyezve. Az út a napon belül marad.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} nem lett áthelyezve. Az út a saját napján marad.',
  'plan.move.spoken.journeyTimed':
    '{name} nem lett áthelyezve. Indulás: {time}.',
  'plan.move.error.save': 'A mozgatást nem sikerült menteni',
  'plan.move.error.retry': 'Próbálja meg újra egy pillanat múlva.',
  'plan.move.dropTime.title':
    'Áthelyezi ezt: {name}, és elhagyja a(z) {time} időpontot?',
  'plan.move.dropTime.body':
    'Ez a hely ellentmond a rajta lévő időpontnak. Az ide helyezés törli az időpontot — az új sorrend és a törölt időpont együtt mentődik.',
  'plan.move.dropTime.confirm': 'Áthelyezés az időpont nélkül',
  'plan.move.dropTime.cancel': 'Maradjon, ahol van',
  /* ------------------------------------------- a stop's menu and its delete */
  'plan.stop.menu.editPlace': 'Hely szerkesztése',
  'plan.stop.menu.setTime': 'Időpont megadása',
  'plan.stop.menu.placeOnMap': 'Elhelyezés a térképen',
  'plan.stop.menu.movePin': 'Jelölő áthelyezése',
  'plan.stop.menu.moveToDay': 'Áthelyezés másik napra',
  'plan.stop.menu.backToUnplanned': 'Vissza a tervezetlenek közé',
  'plan.stop.menu.delete': 'Törlés az útból',
  'plan.stop.visited': 'Meglátogatva',
  'plan.delete.title': 'Törlöd: „{name}”?',
  'plan.delete.titleUnnamed': 'Törlöd ezt a helyet?',
  'plan.delete.bodyUnplanned':
    'Teljesen eltűnik az út helyei közül. Ez nem vonható vissza.',
  'plan.delete.bodyOnDays': {
    one: 'Az út {count} napján szerepel, és eltűnik onnan. Ez nem vonható vissza.',
    other:
      'Az út {count} napján szerepel, és mindegyikről eltűnik. Ez nem vonható vissza.',
  },
  'plan.delete.error': 'A törlés nem sikerült',
  'plan.delete.confirm': 'Hely törlése',
  'plan.delete.deleting': 'A hely törlése folyamatban',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Jegyzet hozzáadása',
  'plan.note.addForDay': 'Jegyzet hozzáadása: {day}',
  'plan.addPlace.label': 'Hely hozzáadása',
  'plan.addPlace.more': 'További módok hely hozzáadására',
  'plan.addPlace.option.map': 'Elhelyezés a térképen',
  'plan.addPlace.forDayNamed': 'Hely hozzáadása: {day}',
  'plan.addPlace.quota':
    'Elérted a csomagod helyekre vonatkozó korlátját. Válts magasabb csomagra, hogy többet adhass hozzá.',
  'plan.addPlace.quotaAction': 'Csomagok megtekintése',
  'plan.stay.checkIn': 'Bejelentkezés',
  'plan.stay.checkOut': 'Kijelentkezés',
  'plan.day.addStay': 'Szállás hozzáadása: {day}',
  'plan.day.addStayShort': 'Szállás hozzáadása',
  'plan.handoff.stop':
    '{place} megnyitása itt: {service} (új lapon nyílik meg)',
  'plan.handoff.day.directions': 'Útvonal itt: {service}',
  'plan.handoff.day.directionsName':
    'Útvonal itt: {service}, {day} (új lapon nyílik meg)',
  'plan.handoff.day.directionsPartial':
    'Megállók: első {carried}, összesen {total}',
  'plan.handoff.day.directionsPartialName':
    'Útvonal itt: {service}, {day}, megállók: első {carried}, összesen {total} (új lapon nyílik meg)',
  'plan.handoff.day.point': 'Megjelenítés itt: {service}',
  'plan.handoff.day.pointName':
    'Megjelenítés itt: {service}, {day} egyetlen térképen szereplő megállója (új lapon nyílik meg)',
  'plan.drop.hint':
    'Kattints jobb gombbal a térképre, vagy tartsd rajta az ujjad, hogy pontosan oda adj hozzá egy helyet.',
  'plan.drop.armed':
    'Kattints a térképen oda, ahová tartozik, vagy mozgasd a térképet, és nyomd meg az Entert, hogy a közepére kerüljön.',
  'plan.drop.stop': 'Új gombostű elhelyezésének leállítása',
  'plan.drop.pin': 'Új hely',
  'plan.drop.lookingUp': 'Cím keresése…',
  'plan.drop.error':
    'A tűt nem sikerült elhelyezni. Próbáld újra egy kicsit később.',
  'plan.place.pastedPosition': 'Beolvasva: szélesség {lat}, hosszúság {lng}',
  'plan.note.showMore': 'Több megjelenítése',
  'plan.note.showLess': 'Kevesebb megjelenítése',
  'plan.note.moveUp': 'Mozgatás felfelé',
  'plan.note.moveDown': 'Mozgatás lefelé',
  'plan.note.moveToDay': 'Áthelyezés másik napra',
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
  'plan.transport.phase.flight.departing': 'Felszállás',
  'plan.transport.phase.flight.travelling': 'A levegőben',
  'plan.transport.phase.flight.arriving': 'Leszállás',
  'plan.transport.phase.hire.departing': 'Átvétel',
  'plan.transport.phase.hire.travelling': 'Bérlésben',
  'plan.transport.phase.hire.arriving': 'Leadás',
  'plan.transport.phase.journey.departing': 'Kezdés',
  'plan.transport.phase.journey.travelling': 'Úton',
  'plan.transport.phase.journey.arriving': 'Vége',
  'plan.transport.label': '{from} és {to} között',
  'plan.transport.drag': 'Átrendezés: {journey}',
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
  'book.readOnly.archived':
    'Ez az utazás archiválva van, ezért a foglalások és a szállások csak olvashatók. Állítsd vissza az utazást a módosításukhoz.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'A módosítást elutasítottuk. További módosítások előtt ellenőrizd az utazás aktuális állapotát.',
  'transports.recovery.failed':
    'Az utazást nem sikerült frissíteni. Módosítás előtt próbáld újra.',
  'transports.readOnly.archived':
    'Ez az utazás archiválva van. Állítsd vissza a közlekedés módosításához.',
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
  'people.title': 'Emberek',
  'people.description': 'Ki van ezen az utazáson, és ki találhatja meg',
  'people.members.title': 'Ezen az utazáson',
  'people.members.empty':
    'Erről az utazásról már senki sincs ebben a munkaterületben',
  'people.role.label': 'Szerepkör',
  'people.role.owner': 'Tulajdonos',
  'people.role.editor': 'Szerkesztő',
  'people.role.viewer': 'Megtekintő',
  'people.you': 'Te',
  'people.owner.hint': 'Egy utazásnak mindig marad legalább egy tulajdonosa',
  'people.remove.action': '{name} eltávolítása erről az utazásról',
  'people.remove.title': 'Eltávolítod {name} nevű utast erről az utazásról?',
  'people.remove.body':
    'Azonnal elveszíti a hozzáférést az útitervhez. Amit hozzáadott, az az utazáson marad.',
  'people.remove.confirm': 'Eltávolítás',
  'people.leave.action': 'Kilépés az utazásból',
  'people.leave.title': 'Kilépsz ebből az utazásból?',
  'people.leave.body':
    'Elveszíted a hozzáférést az útitervhez, amíg valaki az utazásról vissza nem vesz.',
  'people.leave.confirm': 'Kilépés',
  'people.cancel': 'Mégse',
  'people.invite.title': 'Valaki hozzáadása',
  'people.invite.placeholder': 'Keresés a munkaterület tagjai között',
  'people.invite.action': 'Hozzáadás az utazáshoz',
  'people.invite.role': 'Így csatlakozik',
  'people.invite.empty': 'A munkaterület minden tagja már ezen az utazáson van',
  'people.invite.emptyHint':
    'Előbb valaki új lép be a munkaterületre, a Beállításokban',
  'people.visibility.title': 'Ki találhatja meg ezt az utazást',
  'people.visibility.switch': 'Látható a munkaterület minden tagjának',
  'people.visibility.private':
    'Ezt az utazást csak az itt felsorolt emberek látják',
  'people.visibility.organization':
    'A munkaterület bármely tagja megnyithatja ezt az utazást',
  'people.visibility.public':
    'Ez az utazás nyilvános hivatkozással van megosztva',
  'people.error.lastOwner':
    'Egy utazásnak marad legalább egy tulajdonosa. Előbb tegyél tulajdonossá valaki mást.',
  'people.error.notInWorkspace': 'Ez a személy nincs ebben a munkaterületben',
  'people.error.alreadyOnTrip': 'Ez a személy már ezen az utazáson van',
  'people.guests.title': 'Veled utaznak',
  'people.guests.description': 'Az utazás résztvevői, akiknek nincs fiókjuk',
  'people.guests.empty': 'Még senki',
  'people.guests.emptyHint':
    'A vendég veled utazik, és nincs szüksége fiókra. Add hozzá a nevével.',
  'people.guest.badge': 'Vendég',
  'people.guest.add.label': 'Neve',
  'people.guest.add.placeholder': 'Réka',
  'people.guest.add.action': 'Vendég hozzáadása',
  'people.guest.rename.action': '{name} átnevezése',
  'people.guest.rename.title': '{name} átnevezése',
  'people.guest.rename.confirm': 'Átnevezés',
  'people.guest.remove.action': '{name} eltávolítása az utazásból',
  'people.guest.remove.title': 'Eltávolítod {name} vendéget az utazásból?',
  'people.guest.remove.body':
    'A vendég törlődik. Semmi más nem változik az utazáson.',
  'people.guest.remove.confirm': 'Eltávolítás',
  'people.guest.merge.action': '{name} mostantól…',
  'people.guest.merge.title': '{name} mostantól az utazás egyik résztvevője',
  'people.guest.merge.body':
    'Minden, ami {name} vendéghez van rendelve, a kiválasztott személyhez kerül, a vendég pedig törlődik. Ez nem vonható vissza.',
  'people.guest.merge.inherits':
    '{member} átveszi mindazt, ami {name} nevén van.',
  'people.guest.merge.placeholder': 'Válassz valakit az utazásból',
  'people.guest.merge.confirm': 'Összevonás',
  'people.guest.merge.done': '{name} mostantól {member}',
  'people.guest.merge.nothingMoved': 'Még semmi sem volt hozzá rendelve',
  'people.error.guestNameTaken': 'Már van {name} nevű vendég ezen az utazáson',
  'people.error.guestLimit':
    'Egy utazáson legfeljebb {limit} vendég lehet, mert egy hosszabb lista nehezen olvashatóvá teszi a résztvevőválasztót és a költségmegosztást',
  'people.error.guestMergeTarget':
    'Válassz valakit, aki már részt vesz az utazáson',
  'plan.weather.badge.forecast':
    'Előrejelzés: {condition}, maximum {max}, minimum {min}',
  'plan.weather.badge.forecastNoCondition':
    'Előrejelzés: maximum {max}, minimum {min}',
  'plan.weather.badge.unavailable': 'Az időjárás nem érhető el erre a napra',
  'plan.weather.badge.loading': 'Időjárás betöltése',
  'plan.weather.badge.recorded': 'Mért adat: maximum {max}, minimum {min}',
  'plan.weather.badge.recordedHigh': 'Mért adat: maximum {max}',
  'plan.weather.badge.recordedLow': 'Mért adat: minimum {min}',
  'plan.weather.badge.estimate':
    'Becslés: jellemző maximum {max}, jellemző minimum {min}',
  'plan.weather.badge.estimateHigh': 'Becslés: jellemző maximum {max}',
  'plan.weather.badge.estimateLow': 'Becslés: jellemző minimum {min}',
  'plan.weather.badge.notYetRecorded': 'Még nincs mért adat',
  'plan.weather.condition.clear': 'Tiszta',
  'plan.weather.condition.fair': 'Derült',
  'plan.weather.condition.partlyCloudy': 'Részben felhős',
  'plan.weather.condition.cloudy': 'Felhős',
  'plan.weather.condition.fog': 'Köd',
  'plan.weather.condition.rain': 'Eső',
  'plan.weather.condition.heavyRain': 'Heves eső',
  'plan.weather.condition.sleet': 'Havas eső',
  'plan.weather.condition.snow': 'Hó',
  'plan.weather.condition.thunder': 'Zivatar',
  'plan.weather.panel.title': 'Időjárás: {date}',
  'plan.weather.panel.temperature': 'Max. / min.',
  'plan.weather.panel.precipitation': 'Csapadék',
  'plan.weather.panel.precipitationTypical': 'Jellemző napi csapadék',
  'plan.weather.panel.probability': '{percent} esély',
  'plan.weather.panel.wind': 'Szél',
  'plan.weather.panel.sunrise': 'Napkelte',
  'plan.weather.panel.sunset': 'Napnyugta',
  'plan.weather.panel.noSunrise': 'Nincs napkelte',
  'plan.weather.panel.noSunset': 'Nincs napnyugta',
  'plan.weather.panel.slots': 'A nap folyamán',
  'plan.weather.panel.slot.night': 'Éjszaka',
  'plan.weather.panel.slot.morning': 'Délelőtt',
  'plan.weather.panel.slot.afternoon': 'Délután',
  'plan.weather.panel.slot.evening': 'Este',
  'plan.weather.panel.high': 'Maximum',
  'plan.weather.panel.low': 'Minimum',
  'plan.weather.panel.recordedNote': 'Mért értékek erre a napra.',
  'plan.weather.panel.temperatureTypical': 'Jellemző max. / min.',
  'plan.weather.panel.estimateNote':
    'Az adott hónap hosszú távú átlaga, nem előrejelzés.',
  'plan.weather.attribution.metNorway':
    'Előrejelzési adatok: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Adatok: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Útiterv átméretezése',
  'plan.workspace.resizePlaces': 'Helyek átméretezése',
  'plan.workspace.toggleDay': '{day} kibontása vagy összecsukása',
  'plan.workspace.days': 'Napok',
  'plan.workspace.showPanel': '{label} panel megjelenítése',
  'plan.workspace.hidePanel': '{label} panel elrejtése',
  'plan.workspace.narrowPanel': '{label} szűkítése',
  'plan.workspace.widenPanel': '{label} szélesítése',
  'collab.sections.tabsLabel': 'Együttműködési szakaszok',
  'collab.sections.trigger': 'Szakaszok kiválasztása',
  'collab.sections.menuLabel': 'Megjelenítés az út minden résztvevőjének',
  'collab.sections.keepOne':
    'Legalább egy szakasznak bekapcsolva kell maradnia.',
  'collab.sections.failed': 'A módosítást nem sikerült menteni',
  'collab.sections.failedBody': 'A menü a jelenleg mentett állapotot mutatja.',
  'collab.sections.someHidden': 'Egyes szakaszok rejtve vannak ezen az úton.',
  'collab.sections.turnedOff':
    'Ezt a szakaszt kikapcsolták az úton. Bezárul, ha elküldöd vagy törlöd a készülő szöveget.',
  'collab.sections.changed': 'Az út szakaszai megváltoztak.',
  'collab.sections.savedHidden':
    'Mentve. Ez a szakasz rejtve van az úton, ezért most bezárul.',
  'plan.place.error.save':
    'Nem sikerült menteni a helyet. Próbálja meg újra egy pillanat múlva.',
  'plan.stop.error.saveTimes':
    'Nem sikerült menteni a megálló időpontjait. Próbálja meg újra egy pillanat múlva.',
  'plan.place.error.delete':
    'Nem sikerült törölni a helyet. Próbálja meg újra egy pillanat múlva.',
  'plan.pin.error.move':
    'Nem sikerült áthelyezni a jelölőt. Próbálja meg újra egy pillanat múlva.',
  'plan.place.toast.created': 'Hely hozzáadva',
  'plan.place.toast.updated': 'Hely frissítve',
  'plan.stop.toast.timesSaved': 'Megálló időpontjai mentve',
  'plan.place.toast.deleted': 'Hely törölve',
  'plan.pin.toast.moved': '{name} megjelölve',
  'join.page.title': 'Utazási meghívólink',
  'join.page.description':
    'Nyissa meg ezt a linket, hogy csatlakozzon egy megosztott utazáshoz a planned.travel oldalon.',
  'join.title.invited': '{inviter} meghívta Önt egy utazásra',
  'join.requirement':
    'Ez a link azoknak működik, akik már tagjai {inviter} munkaterületének.',
  'join.newHere':
    'Új itt? Először kérje meg {inviter} felhasználót, hogy adja hozzá Önt a munkaterületéhez.',
  'join.trip.label': 'Utazás',
  'join.role.label': 'Ebben a szerepben csatlakozna',
  'join.dates.label': 'Dátumok',
  'join.destination.label': 'Úti cél',
  'join.action.signIn': 'Bejelentkezés',
  'join.action.join': 'Csatlakozás az utazáshoz',
  'join.action.joining': 'Csatlakozás az utazáshoz folyamatban',
  'join.action.open': 'Utazás megnyitása',
  'join.action.openIn': 'Utazás megnyitása és munkaterület váltása',
  'join.action.openIn.pending': 'Munkaterület váltása folyamatban',
  'join.loading': 'Meghívó betöltése',
  'join.joined.title': 'Csatlakozott az utazáshoz',
  'join.joined.body': 'Nyissa meg a terv megtekintéséhez.',
  'join.member.title': 'Már részt vesz ezen az utazáson',
  'join.needsWorkspace.title':
    'Ez az utazás olyan munkaterületen van, amelynek Ön nem tagja',
  'join.needsWorkspace.body':
    'Kérje meg {inviter} felhasználót, hogy előbb adja hozzá Önt a munkaterületéhez, majd nyissa meg újra ezt a linket.',
  'join.needsWorkspace.signedInAs':
    'Ezzel a címmel van bejelentkezve: {email}. Mondja meg {inviter} felhasználónak, hogy ezt a címet használja.',
  'join.needsWorkspace.acceptFirst':
    'Ha már kapott e-mailben meghívót egy munkaterületre, először fogadja el azt, majd nyissa meg újra ezt a linket.',
  'join.needsWorkspace.otherAccount': 'Bejelentkezés másik fiókkal',
  'join.unavailable.title': 'Ez a meghívólink nem érhető el',
  'join.unavailable.body':
    'Lehet, hogy a linket lecserélték vagy kikapcsolták. Kérjen újat attól, aki küldte.',
  'join.unavailable.signIn': 'Bejelentkezés',
  'join.unavailable.trips': 'Ugrás az utazásaihoz',
  'join.error.title': 'Nem sikerült betölteni ezt a meghívólinket',
  'join.error.retry': 'Újrapróbálás',
  'join.error.busy':
    'Ez az oldal most túlterhelt. Próbálja újra egy perc múlva.',
  'join.error.join':
    'Nem sikerült csatlakozni. A hivatkozás továbbra is működik, próbálja újra.',
  'join.error.switch': 'Nem sikerült munkaterületet váltani. Próbálja újra.',

  'invite.title': 'Meghívóhivatkozás',
  'invite.description':
    'A munkaterület bármely tagja csatlakozik az utazáshoz a hivatkozás megnyitásával.',
  'invite.empty.title': 'Még nincs meghívóhivatkozás',
  'invite.empty.body':
    'Hozz létre egy hivatkozást, és oszd meg a csoportos csevegésben, hogy a munkaterület tagjai csatlakozhassanak.',
  'invite.action.create': 'Hivatkozás létrehozása',
  'invite.link.label': 'Meghívóhivatkozás',
  'invite.copy': 'Hivatkozás másolása',
  'invite.copied': 'Hivatkozás másolva',
  'invite.copyFailed':
    'Nem sikerült másolni. Jelöld ki a hivatkozást, és másold ki kézzel.',
  'invite.switch.label':
    'A munkaterület bármely tagja csatlakozhat a hivatkozással',
  'invite.switch.onHint':
    'A kikapcsolás minden másolatot érvénytelenít, a már elküldötteket is.',
  'invite.switch.offHint':
    'A bekapcsolás új hivatkozást hoz létre. A korábbiak érvénytelenek maradnak.',
  'invite.off.body':
    'A hivatkozás ki van kapcsolva. Senki sem csatlakozhat vele.',
  'invite.uses': {
    one: 'A hivatkozással csatlakozók száma: {count}',
    other: 'A hivatkozással csatlakozók száma: {count}',
  },
  'invite.uses.never': 'Még senki sem csatlakozott ezzel a hivatkozással.',
  'invite.lastUsed': 'Utolsó csatlakozás: {when}',
  'invite.role.upgrade.title': 'Legyenek szerkesztők?',
  'invite.role.upgrade.body':
    'Ez minden elküldött másolatra és minden mostantól csatlakozó személyre érvényes.',
  'invite.role.upgrade.confirm': 'Szerkesztői jog megadása',
  'invite.replace.action': 'Hivatkozás cseréje',
  'invite.replace.title': 'Lecseréled ezt a hivatkozást?',
  'invite.replace.body':
    'A régi hivatkozás azonnal érvénytelenné válik mindenkinél. A már csatlakozók az utazásban maradnak; szükség esetén távolítsd el őket az alábbi listából.',
  'invite.replace.deadBody':
    'A régi hivatkozás már nem működik. A már csatlakozók az utazásban maradnak.',
  'invite.replace.confirm': 'Hivatkozás cseréje',
  'invite.replace.pending': 'Hivatkozás cseréje folyamatban',
  'invite.stale': 'Ez a hivatkozás már nem működik. Cseréld le.',
  'invite.creatorGone':
    'A hivatkozás létrehozója már nem tulajdonos, ezért a hivatkozás nem működik. Cseréld le.',
  'invite.archived':
    'Az utazás archiválva van. A hivatkozás az utazás visszaállításakor újra működik.',
  'invite.announce.created': 'Meghívóhivatkozás létrehozva',
  'invite.announce.roleEditor': 'Az új csatlakozók szerkesztők lesznek',
  'invite.announce.off': 'Meghívóhivatkozás kikapcsolva',
  'invite.announce.newLink':
    'Az új hivatkozás kész. Másold ki és küldd el újra.',
  'invite.announce.roleViewer': 'Az új csatlakozók megtekintők lesznek',
  'invite.error.title': 'A meghívóhivatkozás nem töltődött be',
  'invite.error.retry': 'Újrapróbálás',
  'invite.refusal.archived': 'Az utazás archiválva van.',
  'invite.refusal.notOwner':
    'Csak az utazás tulajdonosa módosíthatja a hivatkozást.',
  'invite.refusal.changed':
    'Valaki módosította a hivatkozást. Az aktuális látható.',
  'invite.announce.recovered':
    'A hivatkozás aktuális beállításai láthatók. Ellenőrizd őket a következő módosítás előtt.',
} satisfies TranslationOf<typeof En>

export default messages
