/**
 * The world tracker and the map chrome, in Hungarian.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** `Atlasz` for the atlas module, `utazás` for a trip,
 * `ország` for a country and `bakancslista` for the bucket list — the first
 * three are the words `hu/shell.ts` already uses, and the address is the
 * formal Ön throughout, matching the rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('hu')` reports `one` · `other`. A noun after
 * a numeral stays singular in Hungarian ("5 ország"), so the two branches
 * often carry the same words — the branch still exists because the locale's
 * CLDR data demands it.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Hungarian uses, and the parity suite exempts them
 * structurally.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  'panel.stats.empty.title': 'Még nincs mit számolni',
  'panel.stats.empty.body':
    'Jelölj meg egy országot a térképen, vagy tervezz utazást, és itt megjelennek a számaid.',
  'panel.stats.empty.action': 'Utazás tervezése',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Világtérkép. Még egyetlen ország sincs meglátogatottként megjelölve.',
  'screen.world.summary':
    'Világtérkép, amelyen {total} országból {visited} van meglátogatottként megjelölve.',
  'screen.error.title': 'Az atlasz nem töltődött be',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'A térkép betöltése',
  'map.controls.label': 'Térképvezérlők',
  'map.controls.zoomIn': 'Nagyítás',
  'map.controls.zoomOut': 'Kicsinyítés',
  'map.controls.north': 'Északra fordítás',
  'map.controls.locate': 'Saját hely megkeresése',
  'map.controls.locateFailed': 'Nem sikerült meghatározni az Ön helyzetét.',
  'map.controls.locateFailedBody':
    'Ellenőrizze, hogy az oldal hozzáférhet-e a helyadatokhoz, majd próbálja újra.',

  'map.attribution.label': 'Térképadatok forrása:',
  'map.attribution.geocoder': 'Helyek keresése:',

  'map.basemap.title': 'Az alaptérkép nem érhető el',
  'map.basemap.body':
    'Az utcaszintű részletek offline vannak. Minden hely így is a valós helyén látszik, ezért a távolságok és a csoportok pontosak maradnak.',
  'map.basemap.credit': 'Partvonalak forrása:',
  'map.basemap.retry': 'Újrapróbálkozás',
  'map.basemap.retrying': 'Az alaptérkép keresése',

  'map.engine.unsupported.title': 'A térkép megjelenítése nem érhető el',
  'map.engine.unsupported.body':
    'Ez a böngésző nem tudja futtatni az interaktív térképet: WebGL2 kell hozzá, és itt nincs elérhető WebGL2-környezet. A képernyőn semmi más nem függ tőle.',
  'map.engine.stalled.title': 'A térkép még nem rajzolódott ki',
  'map.engine.stalled.body':
    'A térkép indulására szánt idő alatt semmi sem jelent meg. Lehet, hogy magától még helyrejön; a képernyőn semmi más nem függ tőle.',

  'map.coverage.partial.title': 'Részleges utcaszintű részletek',
  'map.coverage.partial.body': {
    one: 'A közzétett térképadatok az utazás {outside} helyét nem fedik le. A saját partvonalainkon, a valós helyén jelenik meg.',
    other:
      'A közzétett térképadatok az utazás {outside} helyét nem fedik le. A saját partvonalainkon, a valós helyükön jelennek meg.',
  },
  'map.coverage.none.title': 'Itt nincs utcaszintű részlet',
  'map.coverage.none.body':
    'Erre a térségre még nincsenek közzétéve utcák. A partvonalak, a tűk és a köztük futó útvonalak mind valósak — csak az épületek és az utak hiányoznak.',
  'map.coverage.dismiss': 'A térképlefedettségi megjegyzés elrejtése',

  'map.legend.title': 'Jelmagyarázat',
  'map.legend.collapse': '{title} összecsukása',
  'map.legend.expand': '{title} kibontása',
  'map.legend.dayPin': 'Példa naptűre',
  'map.legend.dayPinMeaning': 'Útiterv-nap',
  'map.legend.clusterPin': 'Példa csoporttűre',
  'map.legend.clusterPinMeaning': 'Csoportosított helyek',

  'map.filter.label': 'Helyek szűrése kategória szerint',
  'map.filter.all': 'Mind',
  'map.filter.category': {
    one: '{name} · {places} hely',
    other: '{name} · {places} hely',
  },

  'map.pin.day': '{day}. nap',
  'map.pin.cluster': {
    one: '{places} hely — nagyítson rá a szétválasztásukhoz',
    other: '{places} hely — nagyítson rá a szétválasztásukhoz',
  },

  'map.place.rating': 'Értékelés: {rating} / {max}',
  'map.place.clause.day': '{day}. nap',
  'map.place.clause.rating': 'értékelés: {rating} / {max}',
  'map.place.clause.visited': 'meglátogatva',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Utolsó látogatás',
  'legend.recent': {
    one: 'Az elmúlt egy évben',
    other: 'Az elmúlt {years} évben',
  },
  'legend.middle': '{from}–{to} éve, vagy dátum nélkül',
  'legend.distant': {
    one: 'Több mint {years} éve',
    other: 'Több mint {years} éve',
  },
  'legend.unvisited': 'Még nem meglátogatott',
  'legend.note':
    'Az árnyalat csak azt mutatja, milyen régen járt ott — az Ország lap minden dátumot kiír.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Világlefedettség',
  'panel.coverage.unit': '{total} közül',
  'panel.coverage.caption': '{share} a világból · {visits}',
  'panel.progress.label': 'Úton minden ország felé',
  'panel.progress.remaining': 'Még {remaining} van hátra',
  'panel.toggle.hide': 'Az atlasz részleteinek elrejtése',
  'panel.toggle.show': 'Az atlasz részleteinek megjelenítése',
  'panel.tabs.label': 'Az atlasz szakaszai',
  'panel.tab.country': 'Ország',
  'panel.tab.stats': 'Statisztika',
  'panel.tab.bucket': 'Bakancslista',
  'panel.back': 'Minden ország',
  'panel.list.label': 'Meglátogatott országok',
  'panel.loading': 'Az atlasza betöltése',

  'panel.empty.blank.title': 'A térképe még üres',
  'panel.empty.blank.body':
    'Jelöljön meg egy országot meglátogatottként, és itt megjelenik a térképen — az első és az utolsó látogatással, a látogatások számával és mindazzal, amit róla írt.',
  'panel.empty.pick.title': 'Válasszon egy országot',
  'panel.empty.pick.body':
    'Válassza ki a térképen, a keresőmezőben vagy a listában, és itt megnyílik a teljes bejegyzése — első látogatás, utolsó látogatás, a számláló és az Ön jegyzete.',

  'panel.stat.places': 'A helyei',
  'panel.stat.placesNone': 'Még semmi sincs kitűzve egy utazáson sem',
  'panel.stat.placesCaption': 'Mentett látnivalók, szállások és megállók',
  'panel.stat.regions': 'Régióid',
  'panel.stat.regionsNone': 'Még nincs megjelölt régió',
  'panel.stat.regionsCaption': 'Államok, tartományok, prefektúrák',
  'panel.stat.visits': 'Látogatásaid',
  'panel.stat.visitsCaption': 'Minden rögzített megérkezés',
  'panel.stat.trips': 'Az utazásai',
  'panel.stat.tripsCaption': 'Minden utazása, amelyen részt vesz',
  'panel.stat.cities': 'Városaid',
  'panel.stat.citiesCaption': 'Települések, ahol megszállt vagy megállt',
  'panel.stat.days': 'Utazási napjaid',
  'panel.stat.daysCaption': 'A nyilvántartás összes utazásán át',
  'panel.continents.label': 'Országok földrészenként',

  'panel.bucket.empty.title': 'A lista üres',
  'panel.bucket.empty.body':
    'Egy hely, ahová mindig is el akart jutni. Vegye fel, és pipálja ki, amikor odaér.',
  'panel.bucket.label': 'Bakancslista',
  'panel.bucket.progress': '{total} közül {done} kész',
  'panel.bucket.done': 'Kész',
  'panel.bucket.toGo': 'Hátravan',
  'panel.bucket.target': '{year}-ig',
  'panel.bucket.hidden': {
    one: 'Még {entries} elem van a listáján, itt nem látható.',
    other: 'Még {entries} elem van a listáján, itt nem láthatók.',
  },
  'panel.bucket.kind.country': 'Ország',
  'panel.bucket.kind.region': 'Régió',
  'panel.bucket.kind.place': 'Hely',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afrika',
  'continent.antarctica': 'Antarktisz',
  'continent.asia': 'Ázsia',
  'continent.europe': 'Európa',
  'continent.northAmerica': 'Észak-Amerika',
  'continent.oceania': 'Óceánia',
  'continent.southAmerica': 'Dél-Amerika',
  'continent.unknown': 'A földrész nincs rögzítve',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Meglátogatva',
  'record.firstVisit': 'Első látogatás',
  'record.lastVisit': 'Utolsó látogatás',
  'record.visitDates': 'Látogatások dátumai',
  'record.notRecorded': 'Nincs rögzítve',
  'record.datesUnrecorded': 'A dátumok nincsenek rögzítve',
  'record.visits': {
    one: '{visits} látogatás',
    other: '{visits} látogatás',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Első látogatás: {from}',
  'record.spanTo': 'Utolsó látogatás: {to}',
  'record.visitsUnit': { one: 'látogatás', other: 'látogatás' },
  'record.gap.days': {
    one: '{gap} nap különbséggel',
    other: '{gap} nap különbséggel',
  },
  'record.gap.months': {
    one: '{gap} hónap különbséggel',
    other: '{gap} hónap különbséggel',
  },
  'record.gap.years': {
    one: '{gap} év különbséggel',
    other: '{gap} év különbséggel',
  },
  'record.note.empty': 'Még nincs jegyzet',
  'record.noOutline':
    'A térkép által rajzolt világkontúrok 1:110m méretaránynál vannak elvágva, ami ezt a területet az anyaországába olvasztja — a térképen ezért nincs mit keretbe fogni. A látogatás így is számít.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Országok sorrendje',
  'list.sort.code': 'Országkód',
  'list.sort.codeStatement': 'Országkód szerint rendezve, A-tól Z-ig.',
  'list.sort.name': 'Országnév',
  'list.sort.nameStatement':
    'Országnév szerint rendezve, A-tól Z-ig, majd országkód szerint.',
  'list.sort.recent': 'Legutóbbi látogatás',
  'list.sort.recentStatement':
    'A legutóbbi látogatással kezdve, majd országkód szerint rendezve.',
  'list.sort.visits': 'Legtöbb látogatás',
  'list.sort.visitsStatement':
    'A legtöbb látogatással kezdve, majd országkód szerint rendezve.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'A világkontúrok az anyaországába olvasztják, a térképen ezért nincs mit keretbe fogni.',
  'list.announce.selected': '{name} kiválasztva.',
  'list.announce.selectedUnframed': '{name} kiválasztva. {reason}',
  'list.empty.title': 'Még nincs ország a térképen',
  'list.empty.body':
    'Egy ország abban a pillanatban ide kerül, amikor látogatást rögzít hozzá — az első megérkezéssel, a legutóbbival és a látogatások számával.',
  'list.loading': 'A meglátogatott országok betöltése',
  'list.error.title': 'Az országai nem töltődtek be',
  'list.error.body':
    'Az atlasz most nem tudta beolvasni a meglátogatott országait. Semmi sem veszett el — továbbra is rögzítve vannak.',
  'list.error.retry': 'Újrapróbálkozás',
  'list.error.retrying': 'Az országai betöltése',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Ország keresése',
  'search.loading': 'Az országai betöltése',
  'search.placeholder': 'Országnév vagy kód',
  'search.entry.notVisited': 'Még nem meglátogatott',
  'search.entry.noOutline': 'nincs térképi kontúrja',
  'search.entry.separator': ' · ',
  'search.cleared': 'A kijelölés törölve.',
  'search.unframed':
    '{name} világléptékben nem rendelkezik kontúrral, a térképnek ezért nincs mit keretbe fognia.',
  'search.unframedVisited':
    '{name} világléptékben nem rendelkezik kontúrral, a térképnek ezért nincs mit keretbe fognia. A bejegyzését ez nem érinti.',
  'search.results.empty':
    'A nyilvántartásában még nincs ország. Gépeljen, és a világ minden országában kereshet.',
  'search.results.emptyPinned':
    '{name} kiválasztva. A nyilvántartásában még nincs ország — gépeljen, és a világ minden országában kereshet.',
  'search.results.record': {
    one: '{countries} ország szerepel a nyilvántartásában.',
    other: '{countries} ország szerepel a nyilvántartásában.',
  },
  'search.results.capped': 'Az első {shown} látható.',
  'search.results.pinned': '{name} kiválasztva, a lista élén szerepel.',
  'search.results.none': 'Egy ország sem egyezik ezzel: {term}.',
  'search.results.matches': {
    one: '{countries} ország egyezik ezzel: {term}.',
    other: '{countries} ország egyezik ezzel: {term}.',
  },
  'search.announce.selected': '{name} kiválasztva.',
  'search.announce.framing': '{name} kiválasztva. A térkép keretbe fogja.',
  'search.announce.unframed': '{name} kiválasztva. {reason}',
  'search.empty.title': 'A nyilvántartásában még nincs semmi',
  'search.empty.body':
    'Írjon be egy országnevet vagy a kétbetűs kódját, és megtalálja a térképen.',
  'search.empty.noMatchTitle': 'Egy ország sem egyezik ezzel: „{term}”',
  'search.empty.noMatchBody':
    'Ellenőrizze a helyesírást, vagy próbálja a kétbetűs kódot — a PT megtalálja Portugáliát. Mind a {countries} ország kereshető, akár járt ott, akár nem.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Saját nyilvántartás',
  'actions.visit.absent.title': 'Nem meglátogatott',
  'actions.visit.absent.caption': 'Látogatás utazás nélkül.',
  'actions.visit.title': 'Meglátogatva',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Nincs a listán',
  'actions.goal.absent.caption': 'Egy hely, ahová el akar jutni.',
  'actions.goal.title': 'A bakancslistán',
  'actions.goal.waiting': 'Várja, hogy sorra kerüljön.',
  'actions.goal.target': 'Cél: {year}.',
  'actions.goal.achieved.title': 'Kipipálva a listáról',
  'actions.goal.achieved.caption':
    'Eljutott oda. A bejegyzés emlékként megmarad.',

  'actions.button.remove': 'Eltávolítás',
  'actions.button.mark': 'Megjelölés meglátogatottként',
  'actions.button.add': 'Felvétel a listára',
  'actions.visit.remove.name': '{name} eltávolítása az atlaszából',
  'actions.visit.remove.busy': '{name} eltávolítása az atlaszából folyamatban',
  'actions.visit.add.name': 'Megjelölés meglátogatottként: {name}',
  'actions.visit.add.busy': '{name} megjelölése meglátogatottként',
  'actions.goal.remove.name': '{name} eltávolítása a bakancslistájáról',
  'actions.goal.remove.busy':
    '{name} eltávolítása a bakancslistájáról folyamatban',
  'actions.goal.add.name': 'Felvétel a listára: {name}',
  'actions.goal.add.busy': '{name} felvétele a bakancslistájára',

  'actions.hint':
    'Mindkettő azonnal érvénybe lép, és mindkettő itt visszavonható.',
  'actions.offline':
    'Az eszköze nem érte el a kiszolgálót. Ellenőrizze a kapcsolatot, majd próbálja újra.',
  'actions.toast.marked': 'Meglátogatottként megjelölve',
  'actions.toast.markedBody': '{name} felkerült az atlaszára.',
  'actions.toast.markFailed': '{name} megjelölése nem sikerült',
  'actions.toast.unmarked': 'Eltávolítva az atlaszáról',
  'actions.toast.unmarkedBody':
    '{name} már nincs meglátogatottként megjelölve.',
  'actions.toast.unmarkFailed': '{name} eltávolítása nem sikerült',
  'actions.toast.listed': 'Felkerült a bakancslistájára',
  'actions.toast.listedBody': '{name} egy hely, ahová el akar jutni.',
  'actions.toast.listFailed': '{name} felvétele nem sikerült',
  'actions.toast.unlisted': 'Eltávolítva a bakancslistájáról',
  'actions.toast.unlistedBody': '{name} már nincs a listán.',
  'actions.toast.unlistFailed': '{name} eltávolítása nem sikerült',
  'actions.toast.fallback':
    'A módosítás nem jutott el a kiszolgálóig. Próbálja újra kicsit később.',

  'actions.confirm.visit.title': 'Eltávolítja {name} országot az atlaszáról?',
  'actions.confirm.visit.body': {
    one: '{visits} rögzített látogatás{dates} törlődne{note}. Az utazásait és a mentett helyeit ez nem érinti.',
    other:
      '{visits} rögzített látogatás{dates} törlődne{note}. Az utazásait és a mentett helyeit ez nem érinti.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', a hozzá írt jegyzetével együtt',
  'actions.confirm.goal.title':
    'Eltávolítja {name} országot a bakancslistájáról?',
  'actions.confirm.goal.body':
    'Már ki van pipálva, így az a bejegyzés is törlődik, hogy eljutott oda. Az atlaszát és az utazásait ez nem érinti.',

  /* ------------------------------------------------- the card over the map */
  // Hungarian does not pluralise the noun after a numeral, so the branch a
  // count selects never changes the word — the same rule `card.visits` and
  // `card.places` below already follow.
  'card.trips': {
    one: 'A munkaterület utazása',
    other: 'A munkaterület utazása',
  },
  'card.visits': { one: 'Látogatás', other: 'Látogatás' },
  'card.places': { one: 'A munkaterület helye', other: 'A munkaterület helye' },
  'card.firstTrip': 'Első utazás',
  'card.lastTrip': 'Utolsó utazás',
  'card.firstVisit': 'Első látogatás',
  'card.lastVisit': 'Utolsó látogatás',
  'card.absent': 'Nincs rögzítve',
  'card.loading': 'Az ország betöltése',
  'card.loadingNamed': '{name} betöltése',
  'card.error.body': 'Ezek a számok nem töltődtek be. Semmi sem veszett el.',
  'card.error.retry': 'Újrapróbálkozás',
  'overlay.close': '{name} bezárása',
  'regions.label': 'Régiók',
  'regions.hint':
    'Egy régió hozzáadása {country} országot is meglátogatottnak jelöli.',
  'regions.keeps':
    'Egy régió eltávolítása nem törli {country} országot az atlaszodból.',
  'regions.keeps.unvisited':
    'Ezek a régiók megmaradnak. Jelöld {country} országot meglátogatottnak vagy adj hozzá egy régiót, hogy visszakerüljön a térképre.',
  'regions.empty.title': 'Még nincs itt rögzített régió',
  'regions.empty.body':
    'Adj hozzá egy államot, tartományt vagy területet, amelyet {country} területén meglátogattál.',
  'regions.input.label': 'Régió hozzáadása: {country}',
  'regions.input.placeholder': 'Például Bajorország',
  'regions.add': 'Régió hozzáadása',
  'regions.adding': '{region} hozzáadása',
  'regions.remove': '{region} eltávolítása',
  'regions.loading': 'Régióid betöltése',
  'regions.status.added': '{region} hozzáadva',
  'regions.status.exists': '{region} már szerepel a feljegyzéseidben',
  'regions.status.removed': '{region} eltávolítva',
  'regions.status.addedCountry':
    '{region} hozzáadva. {country} most már meglátogatottként szerepel.',
  'regions.error.invalid': 'Adj meg egy régiónevet.',
  'regions.error.hidden':
    'A név nem engedélyezett karaktereket tartalmaz. Távolítsd el őket és próbáld újra.',
  'regions.error.load': 'Nem sikerült betölteni a régióidat: {country}.',
  'regions.error.add': 'Nem sikerült hozzáadni: {region}. Próbáld újra.',
  'regions.error.remove': 'Nem sikerült eltávolítani: {region}. Próbáld újra.',
  'regions.error.full':
    'Már {limit} régiót rögzítettél. Új hozzáadásához távolíts el egyet.',
  'regions.reload': 'Régiók újratöltése',
  'actions.confirm.visitRegions.body': {
    one: '{history}A(z) {country} területén rögzített régióid megmaradnak: {count}.',
    other:
      '{history}A(z) {country} területén rögzített régióid megmaradnak: {count}.',
  },
  'regions.error.uncertain':
    'A módosítást nem sikerült megerősíteni. Töltsd újra a régióidat, és ellenőrizd, mi lett elmentve.',
  'regions.status.refreshFailed':
    '{result} Az atlaszt nem sikerült frissíteni. Töltsd újra a térkép frissítéséhez.',

  'panel.stat.periodLabel': 'Adatok megjelenítése',
  'panel.stat.allTime': 'Teljes időszak',
  'panel.stat.groupAll': 'A teljes időszak adatai',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'A kiválasztott év adatai: {year}',
  'panel.stat.announceAll': 'A teljes időszak adatai láthatók.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'A kiválasztott év adatai láthatók: {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Az indulás éve: {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'Az utazások indulási éve: {year}',
  'panel.stat.countries': 'Országok az utazásaidon',
  'panel.stat.countriesCaption': 'Az utazások különböző országai',
  'panel.stat.streak': 'Egymást követő utazási éveid',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange':
    'Utazás minden évben, kezdőév: {first}, záróév: {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Egy utazás, év: {last}',
  'panel.stat.streakNone':
    'Adj hozzá dátummal ellátott utazást a sorozat indításához',
  'visitEdit.edit': 'Látogatás szerkesztése',
  'visitEdit.note': 'Jegyzet',
  'visitEdit.save': 'Látogatás mentése',
  'visitEdit.cancel': 'Mégse',
  'visitEdit.loading': 'Látogatás betöltése',
  'visitEdit.saving': 'Látogatás mentése folyamatban',
  'visitEdit.failed':
    'A mentést nem sikerült megerősíteni. A piszkozat megmarad; próbáld újra.',
  'visitEdit.missing':
    'Ez a látogatás már nem érhető el. Nyisd meg újra az országot.',
  'visitEdit.noteInvalid': 'Legfeljebb 2000 karaktert használj.',
  'visitEdit.bounds': 'Az első látogatás nem lehet az utolsó után.',
  'visitEdit.future': 'A mai vagy egy korábbi dátumot válassz.',
  'visitEdit.dateInvalid': 'Adj meg valós dátumot ÉÉÉÉ-HH-NN formátumban.',
  'visitEdit.reload': 'Mentve. Adatlap újratöltése',
} satisfies TranslationOf<typeof En>

export default messages
