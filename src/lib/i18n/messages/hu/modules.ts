/**
 * The trip modules' own copy, in hu.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Többes szám.** `one` · `other`; a magyar szám után egyes számot használ.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Nincs beállítva',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Kapcsolódás',
  'presence.connecting.body': 'Belépünk az utazás élő szobájába.',
  'presence.live.title': 'Élő',
  'presence.live.body':
    'Az üzenetek, jegyzetek és szavazatok azonnal ideérnek.',
  'presence.reconnecting.title': 'Újrakapcsolódás',
  'presence.reconnecting.body':
    'A kapcsolat megszakadt. Újrapróbáljuk — amit elküldesz, akkor is mentve lesz.',
  'presence.offline.title': 'Nincs élő kapcsolat',
  'presence.offline.body':
    'Az élő frissítések ki vannak kapcsolva. A mentés működik; töltsd újra vagy próbáld újra a felzárkózáshoz.',
  'presence.reconnect': 'Újrakapcsolódás',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Minden út',
  'transports.empty.title': 'Még nincs egy út sem',
  'transports.empty.body':
    'A repülők, vonatok, kompok és a reptérről vezető út mind itt lakik, foglalási kódokkal és üléshelyekkel kézre esően az adott napon — és minden átszállás az előzőhöz mérve ellenőrizve.',
  'transports.empty.action': 'Add hozzá az első utat',
  'transports.filtered.title': 'Nincs ilyen fajta út',
  'transports.filtered.body':
    'Ezen az utazáson minden út máshogy megy. Lépj vissza a „{label}” szűrőre, hogy mindet lásd.',
  'transports.filtered.action': 'Minden út megjelenítése',
  'transports.alert.impossible.title': {
    one: '{value} átszállás nem megy',
    other: '{value} átszállás nem megy',
  },
  'transports.alert.impossible.body':
    'Egy út előbb indul, mint hogy az előző megérkezne. A lenti csomópontok megmondják, melyek és mennyivel.',
  'transports.alert.tight.title': {
    one: '{value} átszállás szoros',
    other: '{value} átszállás szoros',
  },
  'transports.alert.tight.body':
    'Van idő, de nem sok arra a járműre, amit el kell érni. A lenti csomópontok mutatják, mennyit hagy mindegyik.',
  'transports.badge.impossible': {
    one: '{value} elszakadt átszállás',
    other: '{value} elszakadt átszállás',
  },
  'transports.badge.tight': {
    one: '{value} szoros átszállás',
    other: '{value} szoros átszállás',
  },
  'transports.badge.ok': 'Minden átszállás összejön',
  'transports.remove.body':
    'Az út végleg lekerül erről az utazásról, a foglalási számával és az ülésével együtt. Ha csak törölték, inkább állítsd az állapotát „Törölve” értékre.',
  'transports.remove.confirm': 'Út eltávolítása',
  'transports.menu.edit': 'Út szerkesztése…',
  'transports.field.service': 'Járat',
  'transports.field.bookingRef': 'Foglalási szám',
  'transports.field.seat': 'Ülés',
  'transports.field.distance': 'Távolság',
  'transports.noTime': 'Még nincs időpont',
  'transports.toast.statusFailed.title': 'Az állapot nem változott',
  'transports.toast.statusFailed.body': 'Az út a korábbi állapotában maradt.',
  'transports.toast.removed': 'Út eltávolítva',
  'transports.toast.removeFailed': 'Az út nem lett eltávolítva',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Út hozzáadása',
  'transports.dialog.editTitle': 'Ennek az útnak a szerkesztése',
  'transports.dialog.description':
    'Repülők, vonatok, kompok és a reptérről vezető út. Az időpontok a jegyre nyomtatott helyi időpontok.',
  'transports.form.modeLegend': 'Mivel utazol',
  'transports.form.timingError': 'Ellenőrizd az időpontokat',
  'transports.field.namePlaceholder': 'Wizz Air BUD-ról HND-re',
  'transports.field.place': 'Hely',
  'transports.field.code': 'Kód',
  'transports.field.date': 'Dátum',
  'transports.field.time': 'Indulás ettől',
  'transports.field.departurePlaceholder': 'Budapest Liszt Ferenc',
  'transports.field.arrivalPlaceholder': 'Tokió Haneda',
  'transports.field.carrier': 'Szolgáltató',
  'transports.field.serviceNumber': 'Járatszám',
  'transports.field.bookingRefHint': 'A kód, amit a pultnál felolvasol.',
  'transports.field.notesPlaceholder':
    'Folyosó melletti ülést kértünk. A csomag Kiotóig fel van adva.',
  'transports.action.add': 'Út hozzáadása',
  'transports.action.save': 'Út mentése',
  'transports.action.saving': 'Út mentése folyamatban',
  'transports.toast.added': 'Út hozzáadva',
  'transports.toast.addedBody': 'Már benne van az utazás sorrendjében.',
  'transports.toast.addFailed': 'Az út nem lett hozzáadva',
  'transports.toast.updated': 'Út frissítve',
  'transports.toast.updateFailed': 'Az út nem lett frissítve',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Megnevezés',
  'field.time': 'Időpont',
  'field.price': 'Ár',
  'field.notes': 'Jegyzetek',
  'field.status': 'Állapot',
  'form.saveError': 'Ez nem mentődött el',
  'action.cancel': 'Mégse',
  'action.showCode': '{label} megjelenítése',
  'book.status.none': 'Állapot nélkül',
  'book.status.pending': 'Várakozik',
  'book.status.confirmed': 'Megerősítve',
  'book.status.completed': 'Lezárva',
  'book.status.cancelled': 'Törölve',
  'book.toast.statusFailed': 'Az állapot nem változott',
  'book.toast.statusFailedBody': 'A foglalás a korábbi állapotában maradt.',
  'book.toast.removed': 'Foglalás eltávolítva',
  'book.toast.removeFailed': 'A foglalás nem lett eltávolítva',
  'book.empty.title': 'Még nincs foglalás',
  'book.empty.body':
    'A szállások, asztalok, túrák és jegyek ide tartoznak — a visszaigazolási számmal ott, ahol az ajtóban megtalálod, és a dátummal, ami felteszi őket az időszalagra.',
  'book.empty.action': 'Add hozzá az első foglalást',
  'book.filtered.title': 'Ilyesmi még nincs',
  'book.filtered.body':
    'A kiválasztott típusokból itt nincs foglalás. Töröld a szűrőt, és látod a pult többi részét.',
  'book.filtered.action': 'Szűrő törlése',
  'book.panel.outstanding': 'Még rendezni kell',
  'book.panel.outstandingEmpty':
    'Nincs függőben semmi — itt minden rendezve van.',
  'book.panel.settled': 'Rendezve',
  'book.panel.settledEmpty':
    'Még semmi sincs rendezve — mindennek utána kell járni.',
  'book.import.badge': 'Ellenőrizetlen import',
  'book.import.hint':
    'Egy visszaigazolásból importálva. Nyisd meg és mentsd el, ezzel ellenőrzöttnek jelölöd.',
  'book.import.action': 'Importálás',
  'book.import.title': 'Foglalások importálása fájlból',
  'book.import.description':
    'Dobj ide egy visszaigazolást, és elolvassuk. Semmi nem kerül az útra, amíg meg nem nézted.',
  'book.import.drop.idle': 'Dobd ide a fájlokat, vagy válaszd ki őket',
  'book.import.drop.active': 'Engedd el, és bekerül',
  'book.import.drop.formats':
    'PDF, mentett e-mail, weboldal, fotó, Word, Excel, naptárfájl vagy JSON-export.',
  'book.import.drop.limits':
    'Egyszerre legfeljebb {files} fájl, egyenként {size} méretig.',
  'book.import.drop.browse': 'Fájlok kiválasztása',
  'book.import.refused.format':
    'A „{filename}” nem olyan fájl, amit ez az importálás el tud olvasni. PDF-et, mentett e-mailt, weboldalt, fotót, Word- vagy Excel-dokumentumot, naptárfájlt vagy JSON-exportot olvas.',
  'book.import.refused.tooMany':
    'Egyszerre csak {files} fájl. A többi nem került be.',
  'book.import.refused.tooLarge':
    'A „{filename}” {size}. Az importálás {limit} méretig olvas fájlokat.',
  'book.import.refused.empty':
    'A „{filename}” üres, így nincs mit elolvasni rajta.',
  'book.import.ceiling.title':
    'Ez a munkatér ebben a hónapban minden visszaigazolását elolvasta',
  'book.import.ceiling.body':
    'A csomag {ceiling} fájlolvasást tartalmaz havonta, a keret pedig elsején újraindul. Foglalást kézzel továbbra is hozzáadhatsz.',
  'book.import.ceiling.none':
    'A visszaigazolás elolvasása nem része ennek a munkatérnek a csomagjának',
  'book.import.ceiling.noneBody':
    'Válts nagyobb csomagra, és elolvassuk helyetted a visszaigazolást. Kézzel bármikor hozzáadhatsz foglalást.',
  'book.import.widget.title': 'Visszaigazolásokat olvasunk',
  'book.import.widget.working': '{done} / {total} elolvasva',
  'book.import.widget.file': 'A „{filename}” olvasása',
  'book.import.widget.done': {
    one: 'Egy foglalás áll készen átnézésre',
    other: '{count} foglalás áll készen átnézésre',
  },
  'book.import.widget.review': 'Átnézés',
  'book.import.widget.failed': 'A „{filename}” nem volt olvasható',
  'book.import.widget.stalled': 'Ez a várhatónál hosszabb ideig tart',
  'book.import.widget.check': 'Nézd meg újra',
  'book.import.widget.dismiss': 'Eltüntetés',
  'book.import.review.title': 'Amit elolvastunk',
  'book.import.review.from': 'Innen: „{filename}”',
  'book.import.review.selectAll': 'Mindet kijelöli',
  'book.import.review.selectNone': 'Egyiket sem jelöli ki',
  'book.import.review.confirm': {
    one: '{count} foglalás hozzáadása',
    other: '{count} foglalás hozzáadása',
  },
  'book.import.review.confirmNone': 'Jelölj ki egy foglalást a hozzáadáshoz',
  'book.import.review.cancel': 'Mégse',
  'book.import.review.needsReview': 'Rá kell nézni',
  'book.import.review.needsReviewHint':
    'Néhány mező nem volt benne a dokumentumban. Hozzáadás után nyisd meg a foglalást.',
  'book.import.review.noPrice': 'Ár nem olvasható ki',
  'book.import.review.noPriceHint':
    'A dokumentum egyiket sem írta ki tisztán, így üresen maradt, nem tippeltük meg.',
  'book.import.review.untitled': 'Cím nélküli foglalás',
  'book.import.empty.title': 'Nem találtunk foglalást abban a fájlban',
  'book.import.empty.body':
    'A „{filename}” nem tartalmazott semmit, ami visszaigazolásra hasonlít. Próbálj másik fájlt, vagy add hozzá a foglalást kézzel.',
  'book.import.failed.title': 'A „{filename}” nem volt olvasható',
  'book.import.failed.body':
    'A fájl megnyílt, de semmit nem lehetett kihozni belőle. Próbálj másik fájlt, vagy add hozzá a foglalást kézzel.',
  'book.import.failed.retry': 'Másik fájl kipróbálása',
  'book.import.uploadFailed': 'A „{filename}” nem töltődött fel',
  'book.import.uploadRetry': 'Próbáld újra',
  'book.import.actionFailed': 'Próbáld újra egy pillanat múlva.',
  'book.import.toast.added': {
    one: 'Egy foglalás hozzáadva',
    other: '{count} foglalás hozzáadva',
  },
  'book.import.partial.title': '{written} foglalás került be a {total} közül',
  'book.import.partial.body':
    'A többi továbbra is ki van jelölve. Az újbóli hozzáadás csak azokat írja be.',
  'book.import.partial.retry': 'A többi hozzáadása',
  'book.journeyLink': 'A közlekedés fülön',
  'filter.all': 'Minden',
  'book.remove.body':
    'Végleg lekerül az időszalagról. Ha csak törölték, inkább állítsd az állapotát „Törölve” értékre, hogy a nyoma megmaradjon.',
  'book.remove.confirm': 'Foglalás eltávolítása',
  'book.menu.edit': 'Foglalás szerkesztése…',
  'book.menu.open': 'Foglalás megnyitása',
  'book.noDate': 'Még nincs dátum',
  'book.until': 'Eddig',
  'book.provider': 'Szolgáltató',
  'book.where': 'Hol',
  'book.guests': 'Fő',
  'book.confirmation': 'Visszaigazolás',
  'book.undated': 'Adj nekik dátumot, és felkerülnek az időszalagra',
  statusOf: '{title} állapota',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Még állapot nélkül',
  'book.statusChoice.pending': 'Várakozik — rajtuk a sor',
  'book.dialog.addTitle': 'Foglalás hozzáadása',
  'book.dialog.editTitle': 'Ennek a foglalásnak a szerkesztése',
  'book.dialog.typeLegend': 'Milyen foglalás',
  'book.field.namePlaceholder': 'Andrássy út 15',
  'book.field.priceHint': 'Hagyd üresen, ha még nincs kifizetve.',
  'book.field.confirmation': 'Visszaigazolási szám',
  'book.field.confirmationHint': 'A kód, amit a pultnál kérni fognak.',
  'book.field.day': 'Egy naphoz kötés',
  'book.field.dayHint': 'Az útitervhez rögzíti, így megjelenik a tervben.',
  'book.field.noDay': 'Az útitervön kívül',
  'book.field.link': 'Hivatkozás',
  'book.field.notesPlaceholder':
    'Késői érkezés egyeztetve. Kérj lifttől távoli szobát.',
  'book.action.add': 'Foglalás hozzáadása',
  'book.action.save': 'Foglalás mentése',
  'book.action.saving': 'Foglalás mentése folyamatban',
  'book.toast.added': 'Foglalás hozzáadva',
  'book.toast.addedBody': 'Már az időszalagon van.',
  'book.toast.addFailed': 'A foglalás nem lett hozzáadva',
  'book.toast.updated': 'Foglalás frissítve',
  'book.toast.updateFailed': 'A foglalás nem lett frissítve',

  'book.emptyFacts':
    'A nevén kívül még semmi sincs rögzítve. Nyisd meg, és add meg az időt, az árat és a visszaigazolási számot.',
  'book.onItinerary': 'Az útitervben: {day}',
  'book.dayNumber': '{n}. nap',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Egyéb',
  'book.field.host': 'Szálloda vagy vendéglátó',
  'book.field.restaurant': 'Étterem neve',
  'book.field.operator': 'Szervező',
  'book.field.issuer': 'Kiállította',
  'book.field.carrier': 'Szállító',
  'book.field.address': 'Cím',
  'book.field.meetingPoint': 'Találkozási pont',
  'book.field.venue': 'Helyszín',
  'book.field.fromTo': 'Honnan és hová',
  'book.field.checkIn': 'Bejelentkezés',
  'book.field.date': 'Dátum',
  'book.field.validOn': 'Érvényes',
  'book.field.departs': 'Indul',
  'book.field.checkOut': 'Kijelentkezés',
  'book.field.ends': 'Véget ér',
  'book.field.arrives': 'Megérkezik',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Ghibli Múzeum',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Ki tartja ezt neked',
  'book.example.accommodationTitle':
    'Hotel Gracery Shinjuku · 2 kétágyas szoba',
  'book.example.restaurantTitle': 'Vacsora a Denben',
  'book.example.activityTitle': 'teamLab Planets, 4 belépő',
  'book.example.tourTitle': 'Séta az arashiyamai bambuszerdőben',
  'book.example.ticketTitle': 'Ghibli Múzeum, 10:00-as belépés',
  'book.example.transportTitle': 'Nozomi 21 Kiotóba',
  'book.example.otherTitle': 'Mit foglaltál',
  'book.hint.accommodation':
    'Egy hotel, egy ryokan, egy lakás — bárhol, ahol alszol.',
  'book.hint.restaurant':
    'Egy lefoglalt asztal. Az időpont az, amin fogni fognak.',
  'book.hint.activity': 'Egy óra, egy fürdő, egy lefoglalt élmény.',
  'book.hint.tour': 'Egy hely, egy idő, és egy várakozó idegenvezető.',
  'book.hint.ticket':
    'Időpontos belépés, múzeumi bérlet, egy meccs. A kód legyen kéznél.',
  'book.hint.transport':
    'Egy lefoglalt hely. A teljes utak kódokkal a {module} alá tartoznak.',
  'book.hint.other':
    'Bármi, ami a nevedre van fenntartva, és nem illik a többihez.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Csomagolás',
  'lists.kind.todo': 'Tennivalók',
  'lists.kind.shopping': 'Bevásárlás',
  'lists.kind.documents': 'Iratok',
  'lists.kind.fallback': 'Lista',
  'colour.none': 'Nincs szín',
  'colour.pine': 'Fenyő',
  'colour.inkBlue': 'Tintakék',
  'colour.amber': 'Borostyán',
  'colour.green': 'Zöld',
  'colour.red': 'Vörös',
  'colour.slate': 'Pala',
  'lists.toast.created': 'Lista létrehozva',
  'lists.toast.createdBody':
    'Írd be elsőként azt, amit nem szabad elfelejtened.',
  'lists.toast.createFailed': 'A lista nem jött létre',
  'lists.toast.updated': 'Lista frissítve',
  'lists.toast.updateFailed': 'A lista nem lett frissítve',
  'lists.error.weightLimit': 'A súlyhatár egész szám grammban.',
  'lists.dialog.editTitle': 'Ennek a listának a szerkesztése',
  'lists.dialog.editBody':
    'Nevezd át, változtasd meg a fajtáját, vagy add át egyetlen utasnak.',
  'lists.dialog.addBody':
    'Csomagolás, tennivalók, bevásárlás és az iratok, amiket nem szabad elfelejteni — mindegyik saját listát kap.',
  'lists.action.new': 'Új lista',
  'lists.field.namePlaceholder': 'Kézipoggyász',
  'lists.field.kind': 'Fajta',
  'lists.field.kindAria': 'A lista fajtája',
  'lists.field.owner': 'Ehhez tartozik',
  'lists.field.ownerHint': 'A közös listákat bárki kipipálhatja.',
  'lists.field.everyone': 'Mindenki az úton',
  'lists.field.weightLimit': 'Súlyhatár',
  'lists.field.weightLimitHint':
    'Gramm. Hagyd üresen, ha nincs betartandó határ.',
  'colour.legend': 'Szín',
  'lists.action.saving': 'Lista mentése folyamatban',
  'lists.action.save': 'Lista mentése',
  'lists.action.create': 'Lista létrehozása',
  'lists.item.toast.added': 'Elem hozzáadva',
  'lists.item.toast.addFailed': 'Az elem nem lett hozzáadva',
  'lists.item.toast.updated': 'Elem frissítve',
  'lists.item.toast.updateFailed': 'Az elem nem lett frissítve',
  'lists.item.error.quantity': 'A darabszám egész szám 1-től 999-ig.',
  'lists.item.error.weight': 'A súly egész szám grammban.',
  'lists.item.dialog.editTitle': 'Ennek az elemnek a szerkesztése',
  'lists.item.dialog.addTitle': 'Elem hozzáadása',
  'lists.item.field.label': 'Elem',
  'lists.item.field.placeholder': 'Útlevél',
  'field.category': 'Kategória',
  'lists.item.field.categoryHint':
    'Egy cím alá csoportosítja a listát. Nem kötelező.',
  'lists.item.field.categoryPlaceholder': 'Iratok',
  'lists.item.field.priority': 'Fontosság',
  'lists.priorityChoice.high': 'Magas — el ne felejtsd',
  'lists.priorityChoice.low': 'Alacsony — ha van még hely',
  'lists.priorityChoice.normal': 'Átlagos',
  'lists.item.field.quantity': 'Darabszám',
  'lists.item.field.weight': 'Súly',
  'lists.item.field.weightHint': 'Gramm, darabonként.',
  'lists.item.field.owner': 'Kinek a dolga ez',
  'lists.item.owner.nobody': 'Senki különösen',
  'lists.item.action.saving': 'Elem mentése folyamatban',
  'lists.item.action.save': 'Elem mentése',
  'lists.item.action.add': 'Hozzáadás a listához',
  'lists.template.loadError': 'A sablonokat most nem sikerült betölteni.',
  'lists.template.toast.added': 'Lista hozzáadva egy sablonból',
  'lists.template.toast.addFailed': 'A sablon nem lett alkalmazva',
  'lists.template.error.apply': 'Ezt nem sikerült alkalmazni',
  'lists.template.error.load': 'A sablonok nem töltődtek be',
  'lists.template.empty.title': 'Még nincsenek sablonok',
  'lists.template.empty.body':
    'Mentsd el sablonként azt a listát, amit ugyanígy újra összeállítanál, és ott lesz minden későbbi úton.',
  'lists.template.applying': 'Sablon alkalmazása folyamatban',
  'lists.template.dialogTitle': 'Indulás sablonból',
  'lists.template.loading': 'Sablonok betöltése',
  'lists.template.apply': 'Sablon alkalmazása',
  'lists.template.from': 'Sablonból',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Nincs hozzárendelve',
  'lists.toast.listRemoved': 'Lista eltávolítva',
  'lists.toast.listRemoveFailed': 'A lista nem lett eltávolítva',
  'lists.toast.itemRemoved': 'Elem eltávolítva',
  'lists.toast.itemRemoveFailed': 'Az elem nem lett eltávolítva',
  'lists.toast.reset': 'Lista visszaállítva',
  'lists.toast.resetBody': 'Minden pipa lekerült, készen a következő útra.',
  'lists.toast.resetFailed': 'A lista nem lett visszaállítva',
  'lists.toast.tickFailed': 'A pipa nem lett elmentve',
  'lists.toast.tickFailedBody': 'Az elem visszaállt úgy, ahogy volt.',
  'lists.toast.assignFailed': 'A hozzárendelés nem lett elmentve',
  'lists.toast.orderFailed': 'Az új sorrend nem lett elmentve',
  'lists.toast.orderFailedBody': 'A lista visszaállt úgy, ahogy volt.',
  'lists.filter.todo': 'Még hátravan',
  'lists.filter.done': 'Kész',
  'lists.scope.all': 'Minden lista',
  'lists.scope.shared': 'Közös',
  'lists.scope.mine': 'Sajátom',
  'lists.empty.mine.title': 'Még nincs saját listád',
  'lists.empty.shared.title': 'Még nincs közös lista',
  'lists.empty.mine.body':
    'A saját listádat csak te pipálod ki — jó arra, amit senki másnak nem kell látnia.',
  'lists.empty.shared.body':
    'A közös listát bárki kipipálhatja, így nem tesz be két ember ugyanolyan adaptert.',
  'lists.remove.list': 'Lista eltávolítása',
  'lists.remove.item': 'Elem eltávolítása',
  'lists.remove.itemBody': 'Lekerül erről a listáról. Semmi más nem változik.',
  'lists.menu.editList': 'Lista szerkesztése…',
  'lists.menu.tickAll': 'Mindet kipipálom',
  'lists.menu.untickAll': 'Minden pipa levétele',
  'lists.menu.reset': 'Visszaállítás a következő útra',
  'lists.menu.dragOrderLong': 'Átváltás olyan sorrendre, amit húzhatsz',
  'lists.menu.groupAgain': 'Csoportosítás kategória szerint újra',
  'lists.menu.dragOrder': 'Átváltás húzható sorrendre',
  'lists.menu.groupByCategory': 'Csoportosítás kategória szerint',
  'lists.weight.packed': '{weight} bepakolva',
  'lists.weight.packedOver': '{weight} bepakolva — a határ felett',
  'lists.weight.packedOf': '{weight} bepakolva a megengedett {limit}-ból',
  'lists.weight.packedOfOver':
    '{weight} bepakolva a megengedett {limit}-ból — a határ felett',
  'lists.progress.ticked': '{total} közül {done} kipipálva',
  'lists.items.empty.title': 'Ez a lista üres',
  'lists.items.empty.body':
    'Írd be elsőként azt, amit nem szabad elfelejtened — a lenti mező a leggyorsabb.',
  'lists.items.doneEmpty.title': 'Még semmi sincs kipipálva',
  'lists.items.doneEmpty.body': 'Pipálj ki valamit, és itt megjelenik.',
  'lists.items.todoEmpty.title': 'Itt minden készen van',
  'lists.items.todoEmpty.body':
    'Ezen a listán minden elem ki van pipálva. Váltsd át erre: „{label}”, és látod őket.',
  'lists.category.other': 'Minden egyéb',
  'lists.dnd.fallbackName': 'ezt az elemet',
  'lists.dnd.picked': '{name} felvéve.',
  'lists.dnd.dropped': '{name} letéve. Az új sorrend mentése folyamatban.',
  'lists.dnd.cancelled': 'Megszakítva. A sorrend változatlan.',
  'lists.menu.editItem': 'Elem szerkesztése…',
  'lists.quickAdd.placeholder': 'Írj be egy elemet, és nyomj Entert',
  'lists.quickAdd.aria': 'Elem hozzáadása ehhez a listához',
  'lists.quickAdd.detailsHint':
    'Hozzáadás súllyal, kategóriával vagy személlyel',
  'lists.quickAdd.detailsAria': 'Elem hozzáadása minden részletével',
  'lists.show': 'Megjelenítés',
  'lists.priority.high': 'Magas',
  'lists.action.add': 'Hozzáadás',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} elem',
    other: '{count} elem',
  },
  'lists.template.copiedIn': {
    one: '{count} elem átmásolva, kipipálásra készen.',
    other: '{count} elem átmásolva, kipipálásra készen.',
  },
  'lists.remove.listBody': {
    one: 'A lista és a {count} eleme lekerül erről az útról. Az elmentett sablonok érintetlenek.',
    other:
      'A lista és a {count} eleme lekerül erről az útról. Az elmentett sablonok érintetlenek.',
  },

  'lists.item.dialog.body':
    'A nevén kívül minden opcionális — a súllyal a csomag összege valóságos lesz, a kategóriával pedig csoportokba rendeződik a lista.',
  'lists.template.dialogBody':
    'A sablon egy korábban elmentett listád. Ha alkalmazod, új listaként másolódik erre az útra — az eredeti érintetlen marad.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Eltávolítod ezt: „{name}”?',
  actionsFor: 'Műveletek ehhez: {name}',
  'lists.dnd.reorder': '{name} átrendezése',
  'lists.action.untickItem': '{name} pipájának levétele',
  'lists.action.tickOffItem': '{name} kipipálása',
  'lists.item.assignAria': '{name} odaadása valakinek',
  'lists.item.reassignAria': '{item} {owner} feladata — add oda másnak',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Adj ennek a foglalásnak nevet, amit egy listában felismersz.',
  'error.titleLong': 'A név maradjon 160 karakter alatt.',
  'book.error.required': 'Ebből a foglalásból hiányzik: {field}.',
  'book.error.timeNeedsDate': 'Egy időponthoz kell a nap is, amire esik.',
  'book.error.endTimeNeedsDate':
    'A befejezés időpontjához kell a nap is, amire esik.',
  'book.error.endsBeforeStart': 'Ez előbb ér véget, mint ahogy elkezdődik.',
  'book.fieldName.checkInDay': 'bejelentkezés napja',
  'book.fieldName.checkOutDay': 'kijelentkezés napja',
  'book.stay.pickDay': 'Válassz napot',
  'book.stay.nights': {
    one: '{count} éjszaka',
    other: '{count} éjszaka',
  },
  'book.stay.range': '{from} – {to}',
  'book.stay.label': 'Szállás',
  'book.remove.keepsNights':
    'Az éjszakák az utazásban maradnak. Csak a foglalás kerül törlésre.',
  'book.menu.removeWithStay': 'Foglalás és szállás eltávolítása',
  'book.removeStay.body':
    'A foglalás és az általa fizetett éjszakák is eltávolításra kerülnek.',
  'book.toast.stayRemoved': 'Foglalás és szállás eltávolítva',
  'book.error.endTimeBeforeStart': 'A befejezés időpontja korábbi a kezdésnél.',
  'book.error.guests': 'A személyek száma egész szám legyen, legfeljebb 1000.',
  'error.price': 'Ezt az összeget nem tudjuk értelmezni.',
  'book.error.url':
    'A hivatkozásnak http:// vagy https:// előtaggal kell kezdődnie.',
  'book.error.confirmationLong':
    'Ez a visszaigazolási szám túl hosszú ahhoz, hogy eltároljuk.',
  'book.error.stopGone': 'Ez a megálló már nem szerepel ezen az úton.',
  'book.ledger.unlinked':
    'A foglalás költségsora az út költségei között marad, de már nem kapcsolódik a foglaláshoz.',
  'book.ledger.updated': 'A foglalás költségsora {money} összegre módosul.',
  'book.ledger.needsDate':
    'Adjon dátumot a foglalásnak, és a költsége bekerül az út költségei közé.',
  'book.ledger.added': 'Az út költségeihez {money} összegű sor kerül.',
  'book.fieldName.provider': 'szolgáltató',
  'book.fieldName.location': 'helyszín',
  'book.fieldName.confirmationNumber': 'visszaigazolási szám',
  'book.fieldName.link': 'hivatkozás',
  'book.fieldName.date': 'dátum',
  'book.fieldName.time': 'időpont',
  'book.fieldName.endDate': 'befejezés dátuma',
  'book.fieldName.endTime': 'befejezés időpontja',
  'book.fieldName.guests': 'személyek száma',
  'book.fieldName.price': 'ár',
  'book.fieldName.stop': 'megálló',
  'book.field.stop': 'Kapcsolt megálló',
  'book.field.stopHint': 'A terv melyik megállójához tartozik ez a foglalás.',
  'book.field.stopHintEmpty':
    'Előbb adj egy helyet valamelyik naphoz, utána köthető hozzá ez a foglalás',
  'book.field.stopPlaceholder': 'Nincs megállóhoz kötve',
  'book.field.stopSearch': 'Keresés megállók és napok között',
  'book.field.stopEmpty': 'Nincs találat a megállók közt',
  'book.ledger.refused.title': 'Mentve, de a költségekhez nem került be',
  'book.ledger.refused.body':
    'A foglalás rajta van az úton. A költségsorát nem sikerült az út költségeihez adni — próbáld újra ezt a felét.',
  'book.action.ledgerRetry': 'Hozzáadás a költségekhez',
  'book.copyConfirmation': '{title} visszaigazolási száma',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Repülés',
  'transports.mode.train': 'Vonat',
  'transports.mode.bus': 'Busz',
  'transports.mode.ferry': 'Komp',
  'transports.mode.car': 'Autó',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Közösségi közlekedés',
  'transports.mode.metro': 'Metró',
  'transports.mode.tram': 'Villamos',
  'transports.mode.bike': 'Kerékpár',
  'transports.mode.walk': 'Gyalog',
  'transports.mode.other': 'Egyéb',
  'transports.mode.fallback': 'Út',
  'transports.rank.earliest': 'Legkorábbi érkezés',
  'transports.rank.fewestChanges': 'Legkevesebb átszállás',
  'transports.connection.findStop': 'Keress megállót',
  'transports.connection.findStopSearch': 'BUD, Keleti, Budapest…',
  'transports.connection.findStopEmpty':
    'Ilyen nevű megálló nincs a katalógusban.',
  'transports.connection.hideStops': 'Megállók elrejtése',
  'transports.connection.seeStops': 'Megállók mutatása',
  'transports.connection.saving': 'Mentem a kapcsolatot',
  'transports.connection.use': 'Ezt választom',
  'transports.connection.onFoot': 'Gyalog',
  'transports.connection.service': 'Járat',
  'transports.connection.direct': 'közvetlen',
  'transports.connection.changes': {
    one: '{changes} átszállás',
    other: '{changes} átszállás',
  },
  'transports.connection.tooLong':
    'Ennek a kapcsolatnak több mint {max} szakasza van, több, mint amennyi egy utazásrekordba fér. Keress rövidebb szakaszt, a többit külön írd fel.',
  'transports.connection.refusal.ceiling':
    'Ebben a hónapban nincs több keresés',
  'transports.connection.refusal.unconfigured':
    'A kapcsolatkeresés ki van kapcsolva ezen a telepítésen',
  'transports.connection.refusal.provider':
    'A menetrendszolgáltatás nem válaszolt',
  'transports.connection.refusal.plan':
    'A kapcsolatkeresés nem része ennek a csomagnak',
  'transports.connection.refusal.planBody':
    'Válts csomagot, hogy az utazáson belülről kereshess a menetrendekben. Egy szakasz kézzel is rögzíthető.',
  'transports.connection.refusal.ceilingBody':
    'A havi {ceiling} keret elfogyott, és a következő hónap elsején újul meg. Egy szakasz kézzel is rögzíthető.',
  'transports.connection.refusal.unconfiguredBody':
    'Itt nincs beállítva menetrendszolgáltatás, így semmi nem lett lekérdezve. Rögzítsd a szakaszt kézzel.',
  'transports.connection.refusal.providerBody':
    'Nem jött vissza semmi megjeleníthető. Próbáld újra egy pillanat múlva, vagy rögzítsd a szakaszt kézzel.',
  'transports.connection.invitation':
    'Két megálló és egy dátum, és a menetrend válaszol. Semmi sem mentődik, amíg nem választasz.',
  'transports.connection.empty':
    'Azon a napon nem találtunk kapcsolatot a két megálló között. Próbálj szomszédos állomást, vagy bővítsd a szűrőt.',
  'transports.connection.credit': 'Menetrendi adatok forrása:',
  'transports.connection.searchFailed': 'A keresés nem futott le',
  'transports.connection.searchFailedBody': 'Próbáld újra egy pillanat múlva.',
  'transports.connection.saved': 'Kapcsolat mentve',
  'transports.connection.replaced': 'Útvonal lecserélve',
  'transports.connection.replacedBody':
    'A foglalási kód és az ülés érintetlen marad.',
  'transports.connection.saveFailed': 'A kapcsolat nem mentődött',
  'transports.connection.saveError': 'Ez nem mentődött',
  'transports.connection.fromHint':
    'Válassz megállót — a menetrendet arról kérdezed, hol, nem arról, hogy hívják.',
  'transports.connection.toHint': 'Válassz megállót a katalógusból.',
  'transports.connection.timeHint':
    'A menetrend a következő indulásokkal válaszol, ez dönti el, melyekkel.',
  'transports.connection.onlyModes': 'Csak ezek a módok',
  'transports.connection.searching': 'Keresek a menetrendben',
  'transports.connection.search': 'Kapcsolatok keresése',
  'transports.connection.title': '{from} — {to}',
  'transports.status.idea': 'Ötlet',
  'transports.status.pending': 'Várakozik',
  'transports.status.confirmed': 'Megerősítve',
  'transports.status.completed': 'Kész',
  'transports.status.cancelled': 'Lemondva',
  'transports.end.fromAirport': 'Indulási repülőtér',
  'transports.end.toAirport': 'Érkezési repülőtér',
  'transports.end.fromPort': 'Indulási kikötő',
  'transports.end.toPort': 'Érkezési kikötő',
  'transports.end.fromStation': 'Indulási állomás',
  'transports.end.toStation': 'Érkezési állomás',
  'transports.end.from': 'Honnan',
  'transports.end.to': 'Hová',
  'transports.end.pickUp': 'Átvétel',
  'transports.end.dropOff': 'Leadás',
  'transports.end.departureDay': 'Indulás napja',
  'transports.end.arrivalDay': 'Érkezés napja',
  'transports.end.pickUpDay': 'Átvétel napja',
  'transports.end.returnDay': 'Leadás napja',
  'transports.dayNumber': '{n}. nap',
  'transports.error.titleEmpty':
    'Adj ennek az útnak nevet, amit egy listában felismersz.',
  'transports.error.date': 'A dátumot ÉÉÉÉ-HH-NN alakban írjuk.',
  'transports.error.time': 'Az időt ÓÓ:PP alakban, 24 órás formában írjuk.',
  'transports.error.departureNeedsDate':
    'Az indulás időpontjához kell a nap is, amire esik.',
  'transports.error.arrivalNeedsDate':
    'Az érkezés időpontjához kell a nap is, amire esik.',
  'transports.error.code': 'A kód 2-től 8 betű vagy számjegy.',
  'transports.error.distance':
    'A távolság kilométerben megadott szám, legfeljebb 100 000.',
  'transports.error.arrivesBeforeDeparts':
    'Ez az út előbb érkezik meg, mint ahogy elindul.',
  'transports.error.timingHint':
    'Tolj el az egyik időpontot, hogy az út valóban elérhető legyen.',
  'transports.error.arrivalDayBeforeDeparture':
    'Az érkezés napja megelőzi az indulás napját.',
  'transports.error.returnDayBeforePickUp':
    'A leadás napja megelőzi az átvétel napját.',
  'transports.field.noDay': 'Még nincs nap',
  'transports.fill.legend': 'Hogyan töltse ki',
  'transports.fill.manual': 'Írja be maga',
  'transports.fill.searchAgain': 'Keresés újra',
  'transports.fill.search': 'Csatlakozások keresése',
  'transports.chain.unsplit': 'Legyen újra egyetlen utazás',
  'transports.field.arrivalDayHint':
    'Az az utazás, amelyik másnap reggel érkezik, itt mondja meg.',
  'transports.chain.splitHint':
    'Átszállás útközben? Rögzítse minden részét saját járatszámmal, vágánnyal, hellyel és időpontokkal.',
  'transports.chain.split': 'Szakaszokra bontás',
  'transports.chain.stopNumber': '{n}. megálló',
  'transports.chain.change': '{n}. átszállás',
  'transports.chain.removeStation': '{label} eltávolítása',
  'transports.chain.findStation': 'Keress repteret vagy állomást',
  'transports.chain.findStationFor':
    'Keress repteret vagy állomást ehhez: {label}',
  'transports.chain.findPlaceholder': 'BUD, Liszt Ferenc, Budapest…',
  'transports.chain.findEmpty': 'Nincs találat — írd be lent a megállót magad.',
  'transports.chain.stopLabel': 'Megálló',
  'transports.chain.stopPlaceholder': 'Budapest Keleti',
  'transports.chain.timezoneHint': 'Melyik óra szerint jár ez a megálló',
  'transports.chain.timezoneAt': 'Időzóna itt: {label}',
  'transports.chain.timezonePlaceholder': 'Nincs megadva',
  'transports.chain.timezoneSearch': 'Tokió, Lisszabon, UTC…',
  'transports.chain.acrossClocks': '{gap} két óra között',
  'transports.chain.addStopAfter': 'Megálló hozzáadása {label} után',
  'transports.chain.servicePlaceholder': 'IC 604 Kékes',
  'transports.chain.leaves': 'Indul innen: {label}',
  'transports.chain.reaches': 'Érkezik ide: {label}',
  'transports.chain.dayOfLeg': '{n}. szakasz {label}',
  'transports.chain.formError': 'Ez a lánc nem menthető',
  'transports.chain.atCap':
    'Egy lánc legfeljebb {max} szakaszt fog — ez arra korlát, mennyit bír egy mentés, nem arra, hány átszállása lehet egy útnak.',
  'transports.chain.hint':
    'Adj hozzá megállót bármelyik szakaszhoz, ha vonatot cserélsz; minden szakasz megtartja a saját járatszámát, vágányát és ülését.',
  'transports.field.timezone': 'Időzóna',
  'transports.field.platform': 'Vágány',
  'transports.chain.legNumber': '{n}. szakasz',
  'transports.chain.platform': '{value}. vágány',
  'transports.chain.seat': '{value}. ülés',
  'transports.chain.error.stopName':
    'Minden megállónak kell név — itt száll át.',
  'transports.chain.error.stopNameLong':
    'A megálló neve legyen 200 karakternél rövidebb.',
  'transports.chain.error.timezone': 'Válasszon időzónát a listából.',
  'transports.chain.error.tooManyLegs':
    'Egy lánc legfeljebb {max} szakaszt tartalmaz.',
  'transports.bookingRefFor': '{title} foglalási száma',
  'transports.doorToDoor': 'Ez {gap} háztól házig.',
  'transports.title.fromTo': '{operator} {from}–{to}',
  'transports.title.from': '{operator} {from}-ból',
  'transports.title.to': '{operator} {to}-ba',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Nincs mit összehasonlítani',
  'transports.junction.unknown.detail':
    'Add meg mindkét útnál a dátumot és az időt, és ezt az átszállást ellenőrizzük neked.',
  'transports.junction.impossible.headline':
    '{gap}-cal az előző út megérkezése előtt indul',
  'transports.junction.impossible.detail':
    'A(z) „{to}” elindul, mielőtt a(z) „{from}” megérkezik, így nem érhető el mindkettő. Tolj el az egyiket.',
  'transports.junction.tight.headline': '{gap} az átszállásra',
  'transports.junction.tight.detail':
    'A(z) {mode} általában körülbelül {required} igényel. Ez szoros.',
  'transports.junction.tight.detailAt':
    'A(z) {mode} {place} esetében általában körülbelül {required} igényel. Ez szoros.',
  'transports.junction.ok.headline': '{gap} közte',
  'transports.junction.ok.detail':
    '{landing} a megérkezés, de a következő út {boarding} felől indul — át kell érned.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Jegyzet megosztva',
  'collab.note.toast.sharedBody': 'Az úton mindenki látja már.',
  'collab.note.toast.shareFailed': 'A jegyzet nem lett megosztva',
  'collab.note.toast.updated': 'Jegyzet frissítve',
  'collab.note.toast.updateFailed': 'A jegyzet nem lett frissítve',
  'collab.note.dialog.editTitle': 'Ennek a jegyzetnek a szerkesztése',
  'collab.note.dialog.addTitle': 'Új közös jegyzet',
  'collab.note.dialog.body':
    'Étteremajánlók, vízumszabályok, a bejárati kód — minden, amire az egész útnak emlékeznie kell, egy helyen.',
  'collab.note.field.title': 'Cím',
  'collab.note.field.titlePlaceholder': 'Bejárati kód',
  'collab.note.field.body': 'Jegyzet',
  'collab.note.field.bodyPlaceholder':
    '4821, aztán a kettőskereszt. A kulcsszekrény az ajtótól balra van.',
  'collab.note.field.categoryHint':
    'Egy szűrő alá csoportosítja a táblát. Nem kötelező.',
  'collab.note.field.categoryPlaceholder': 'Szervezés',
  'collab.note.field.pin': 'Kitűzés a tábla tetejére',
  'collab.note.field.pinHint':
    'A kitűzött jegyzetek elöl állnak, bármi kerül még oda.',
  'collab.note.action.saving': 'Jegyzet mentése folyamatban',
  'collab.note.action.save': 'Jegyzet mentése',
  'collab.note.action.share': 'Jegyzet megosztása',
  'collab.poll.toast.opened': 'Szavazás megnyitva',
  'collab.poll.toast.openedBody': 'Az úton mindenki szavazhat már.',
  'collab.poll.toast.openFailed': 'A szavazás nem lett megnyitva',
  'collab.poll.dialog.addTitle': 'Új szavazás',
  'collab.poll.field.question': 'Kérdés',
  'collab.poll.field.questionPlaceholder': 'Hol eszünk az utolsó este?',
  'collab.poll.field.optionsLegend': 'Válaszok',
  'collab.poll.field.option': 'Válasz {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Még egy válasz',
  'collab.poll.action.addOption': 'Válasz hozzáadása',
  'collab.poll.action.removeOption': 'Válasz eltávolítása {n}',
  'collab.poll.field.multi': 'Több is választható legyen',
  'collab.poll.field.multiHint':
    'Kikapcsolva fejenként egy szavazat, és a véleményváltás átviszi.',
  'collab.poll.action.opening': 'Szavazás megnyitása folyamatban',
  'collab.poll.action.open': 'Szavazás megnyitása',
  'collab.poll.error.tooFew':
    'Egy szavazáshoz legalább két dolog kell, amiből választani lehet.',
  'collab.poll.error.duplicate':
    'Két válasz ugyanazt mondja. Adj mindegyiknek külön megfogalmazást.',
  'collab.presence.viewingNow': 'nézi éppen',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} nyitott lap',
    other: '{name} — {count} nyitott lap',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Egyetértek',
  'collab.reaction.love': 'Imádom',
  'collab.reaction.funny': 'Vicces',
  'collab.reaction.celebrate': 'Ünnepeljünk',
  'collab.reaction.thanks': 'Köszönöm',
  'collab.reaction.looking': 'Nézem',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, veled együtt',
  'collab.thread.today': 'Ma',
  'collab.thread.empty': 'Még nincsenek üzenetek',
  'collab.toast.reactionFailed': 'A reakció nem lett elmentve',
  'collab.toast.messageDeleted': 'Üzenet törölve',
  'collab.toast.deleteFailed': 'Az üzenet nem lett törölve',
  'collab.toast.notSent': 'Nem ment el',
  'collab.toast.notSentBody':
    'Az üzenetet nem sikerült elküldeni. Próbáld újra egy pillanat múlva.',
  'collab.toast.messageUpdated': 'Üzenet frissítve',
  'collab.toast.editFailed': 'A módosítás nem lett elmentve',
  'collab.message.deleteTitle': 'Törlöd ezt az üzenetet?',
  'collab.message.deleteBody':
    'A szöveg eltűnik a beszélgetésből. A rá adott válaszok a helyükön maradnak.',
  'collab.message.delete': 'Üzenet törlése',
  'collab.message.reply': 'Válasz',
  'collab.message.menuEdit': 'Üzenet szerkesztése…',
  'collab.message.react': 'Reagálás erre az üzenetre',
  'collab.message.edited': 'szerkesztve',
  'collab.message.actionsFor': 'Műveletek {name} üzenetéhez',
  'collab.compose.editingYours': 'A saját üzenetedet szerkeszted',
  'collab.compose.replyingTo': 'Válasz neki: {name}',
  'collab.compose.cancelReply': 'Válasz megszakítása',
  'collab.compose.cancelEdit': 'Szerkesztés megszakítása',
  'collab.compose.placeholder': 'Írj az útnak',
  'collab.compose.placeholderText': 'Írj valamit a csoportnak…',
  'collab.compose.editPlaceholder': 'A saját üzeneted szerkesztése',
  'collab.compose.editPlaceholderText': 'Változtasd meg, amit mondtál…',
  'collab.compose.send': 'Üzenet küldése',
  'collab.compose.savingEdit': 'Módosítás mentése folyamatban',
  'collab.compose.save': 'Mentés',
  'collab.hint.sends': 'küld',
  'collab.hint.addsLine': 'új sort kezd',
  'collab.hint.cancels': 'megszakít',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Jegyzet eltávolítva',
  'collab.toast.noteRemoveFailed': 'A jegyzet nem lett eltávolítva',
  'collab.notes.empty.title': 'Nincsenek közös jegyzetek',
  'collab.notes.empty.body':
    'Étteremajánlók, vízumszabályok, a bejárati kód — minden, amire az egész útnak emlékeznie kell.',
  'collab.notes.empty.action': 'Írd meg az első jegyzetet',
  'collab.note.menu.edit': 'Jegyzet szerkesztése…',
  'collab.note.menu.unpin': 'Kitűzés levétele',
  'collab.note.menu.pin': 'Kitűzés a tetejére',
  'collab.note.remove': 'Jegyzet eltávolítása',
  'collab.note.removeBody': 'A jegyzet mindenki tábláján eltűnik az úton.',
  'collab.note.new': 'Új jegyzet',
  'collab.poll.toast.voteFailed': 'A szavazatod nem lett elmentve',
  'collab.poll.toast.voteFailedBody': 'A számolás nem változott.',
  'collab.poll.toast.closed': 'Szavazás lezárva',
  'collab.poll.toast.closeFailed': 'A szavazás nem lett lezárva',
  'collab.poll.toast.removed': 'Szavazás eltávolítva',
  'collab.poll.toast.removeFailed': 'A szavazás nem lett eltávolítva',
  'collab.polls.heading': 'Szavazások',
  'collab.polls.empty.title': 'Nincs nyitott szavazás',
  'collab.polls.empty.body':
    'Ha a csoport nem tud megegyezni egy étteremben, tegyétek szavazásra, és hagyjátok, hogy a válasz magától eldőljön.',
  'collab.polls.empty.action': 'Kérdezd meg a csoportot',
  'collab.poll.menu.close': 'Szavazás lezárása',
  'collab.poll.remove': 'Szavazás eltávolítása',
  'collab.poll.removeTitle': 'Eltávolítod ezt a szavazást?',
  'collab.poll.actionsFor': 'Műveletek a(z) „{question}” szavazáshoz',
  'collab.badge.pinned': 'Kitűzve',
  'collab.badge.closed': 'Lezárva',
  'collab.badge.open': 'Nyitva',
  'collab.badge.multi': 'Több is választható',
  'collab.badge.leading': 'Vezet',
  'collab.poll.removeBody': {
    one: 'A(z) „{question}” és a {count} szavazata mindenkinél eltűnik.',
    other: 'A(z) „{question}” és a {count} szavazata mindenkinél eltűnik.',
  },
  'collab.poll.result': {
    one: '{label} — {count} szavazatból {votes}',
    other: '{label} — {count} szavazatból {votes}',
  },
  'collab.poll.resultMine': {
    one: '{label} — {count} szavazatból {votes}, a tiéddel együtt',
    other: '{label} — {count} szavazatból {votes}, a tiéddel együtt',
  },
  'collab.poll.voteCount': {
    one: '{count} szavazat',
    other: '{count} szavazat',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Dokumentum',
  'files.kind.photo': 'Fénykép',
  'files.kind.ticket': 'Jegy',
  'files.kind.receipt': 'Nyugta',
  'files.kind.map': 'Térkép',
  'files.kind.other': 'Egyéb',
  'files.kindChoice.ticket': 'Jegy vagy belépő',
  'files.kindChoice.map': 'Térkép vagy útvonal',
  'files.toast.removed': 'Fájl eltávolítva',
  'files.toast.removeFailed': 'A fájl nem lett eltávolítva',
  'files.toast.downloadFailed': 'A letöltés nem indult el',
  'files.toast.gone': 'Ez a fájl ezen a lapon már nem érhető el.',
  'files.toast.uploadFailed': 'A feltöltés nem sikerült. Próbáld újra.',
  'files.toast.updated': 'Fájl frissítve',
  'files.toast.updateFailed': 'A fájl nem lett frissítve',
  'files.storage.full': 'Ebben a munkaterületben elfogyott a tárhely',
  'files.storage.used':
    '{limit} helyből {used} foglalt. Törölj lentebb egy fájlt, vagy lépj feljebb egy csomagot, mielőtt bármi mást hozzáadnál.',
  'files.storage.perFile': 'egyenként legfeljebb {size}',
  'files.action.add': 'Fájlok hozzáadása',
  'files.action.choose': 'Fájlok kiválasztása',
  'files.action.upload': 'Fájlok feltöltése',
  'files.drop.active': 'Engedd el a feltöltéshez',
  'files.drop.idle': 'Húzd ide a fájlokat',
  'files.empty.title': 'Nincsenek fájlok ezen az úton',
  'files.empty.body':
    'Minden, amit különben az utaskezelő pultnál kellene előkotornod a postafiókodból, itt van, ahhoz az úthoz csatolva, amiről szól.',
  'files.empty.hint':
    'Beszállókártyák, szállásvisszaigazolások, jegyek, biztosítási papírok és a nyugták, amik alátámasztják a kiadásaidat.',
  'files.heading': 'Csatolmányok',
  'files.tableCaption': 'Ehhez az úthoz csatolt fájlok',
  'files.menu.download': 'Letöltés',
  'files.menu.rename': 'Átnevezés és leírás…',
  'files.menu.remove': 'Fájl eltávolítása',
  'files.remove.body':
    'A fájl a tárhelyről is törlődik, nemcsak az útról, és {size} szabadul fel. Ez nem vonható vissza.',
  'files.queue.clear': 'Kész elemek eltakarítása',
  'files.column.file': 'Fájl',
  'files.column.size': 'Méret',
  'files.column.addedBy': 'Hozzáadta',
  'files.column.when': 'Mikor',
  'files.status.uploaded': 'Feltöltve',
  'files.status.failed': 'Sikertelen',
  'files.status.cancelled': 'Megszakítva',
  'files.status.uploading': 'Feltöltés folyamatban',
  'files.status.waiting': 'Várakozik',
  'files.error.nameEmpty': 'A fájlnak olyan név kell, ami alapján megtalálod.',
  'files.field.kindHint':
    'Eldönti, melyik szűrő alá kerül és milyen jelet kap.',
  'files.field.kindAria': 'A fájl fajtája',
  'files.field.description': 'Leírás',
  'files.field.descriptionPlaceholder':
    'Biztosítási kötvény — az egész társaságra szól, kárbejelentő a 2. oldalon.',
  'files.dialog.title': 'A fájl adatai',
  'files.action.saving': 'Fájl mentése folyamatban',
  'files.action.save': 'Adatok mentése',
  'files.queue.someFailed': {
    one: '{count} fájl nem töltődött fel. Az ok minden sorban ott van — a köteg többi részét ez nem érintette.',
    other:
      '{count} fájl nem töltődött fel. Az ok minden sorban ott van — a köteg többi részét ez nem érintette.',
  },

  'files.action.cancelUploadOf': '{name} feltöltésének megszakítása',
  'files.action.dismissOf': '{name} elrejtése',
  'files.status.downloadingOf': '{name} letöltése',
  'files.status.uploadingOf': '{name} feltöltése',
  'files.status.uploadingCount': {
    one: '{count} fájl feltöltése',
    other: '{count} fájl feltöltése',
  },

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'A feltöltés megszakítva.',
  'files.error.badAnswer':
    'A kiszolgáló olyan választ küldött, amit ez a böngésző nem tudott elolvasni.',
  'files.error.connection':
    'A kapcsolat megszakadt feltöltés közben. Nézd meg a hálózatot, és próbáld újra.',
  'files.error.timeout': 'A feltöltés túllépte az időt. Próbáld újra.',
  'files.error.refused': 'A kiszolgáló elutasította a feltöltést ({status}).',
  'files.error.downloadShape':
    'A letöltés olyan formában jött vissza, amit nem tudtunk elmenteni.',
  'files.error.downloadFailed': 'A letöltés nem sikerült ({status}).',
  'files.toast.uploadedOne': 'Fájl feltöltve',
  'files.toast.uploadedManyBody': '{size} került hozzá ehhez az úthoz.',
  'files.toast.failedOne': 'Az a fájl nem töltődött fel',
  'files.toast.failedManyBody': 'A lenti sor mindegyiknél megmondja, miért.',
  'files.error.tooMany': {
    one: 'Egyszerre csak {count} fájl adható hozzá, ezért a(z) „{name}” kimaradt. Húzd be újra magában.',
    other:
      'Egyszerre csak {count} fájl adható hozzá, ezért a(z) „{name}” kimaradt. Húzd be újra magában.',
  },
  'files.toast.uploadedMany': {
    one: '{count} fájl feltöltve',
    other: '{count} fájl feltöltve',
  },
  'files.toast.failedMany': {
    one: '{count} fájl nem töltődött fel',
    other: '{count} fájl nem töltődött fel',
  },
} satisfies TranslationOf<typeof En>

export default messages
