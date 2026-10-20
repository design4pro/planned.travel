/**
 * The public pages' copy, in hu.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Tipográfia.** A magyar idézőjel „…”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Kezdje ingyen',
  'action.signIn': 'Bejelentkezés',
  'action.pricing': 'Árak',
  'action.seePricing': 'Árak megtekintése',
  'action.skipToContent': 'Ugrás a tartalomra',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — főoldal',
  'nav.onThisPage': 'Ezen az oldalon',
  'anchor.planner': 'Tervező',
  'anchor.modules': 'Modulok',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Dobd a {day}. napra',
  'legal.summaryNote':
    'Az összefoglaló azért van, hogy elolvasd. Ami lentebb áll, az érvényes.',
  'visual.daysTravelled': 'Utazási napok',
  'visual.acrossEveryTrip': 'minden utazáson',
  'visual.mapFilled': 'a térkép {percent}%-a kitöltve',
  'visual.previewSummary':
    'Előnézet a planned.travel áttekintőről: a következő utazás a dátumaival, az utazókkal és a helyek számával; összesítések a meglátogatott országokról, az utazásokról és az utazási napokról; az útvonal térképe; és a következő két foglalás.',
  'visual.placesMapped': {
    one: '{value} hely a térképen',
    other: '{value} hely a térképen',
  },
  'visual.splitWays': {
    one: 'nincs megosztva',
    other: '{value} felé osztva',
  },
  'visual.tripTotal': 'Utazás összesen',
  'visual.paidSplit': '{who} fizette · {split}',
  'visual.nextUp': 'Következik',
  'visual.ofTotal': '{done} / {total}',
  'visual.awaitingReply': 'Válaszra vár',
  'visual.upcoming': 'Közelgő',
  'visual.days': {
    one: '{value} nap',
    other: '{value} nap',
  },
  'visual.places': {
    one: '{value} hely',
    other: '{value} hely',
  },
  'visual.transfersLeft': {
    one: '{value} átutalás van hátra',
    other: '{value} átutalás van hátra',
  },

  'legal.badge.version': '{version}. verzió',
  'legal.badge.effective': 'Hatályos {updated}-tól',
  'legal.notice.title': 'Ez egy minta, nem jogi tanács',
  'legal.notice.body':
    'Egyszerű angolsággal íródott, hogy valóban használható kiindulópont legyen egy kicsi utazástervező szolgáltatáshoz, és minden hiányzó rész, amit egy cégnek ki kell töltenie, jelölve van. Mielőtt egyetlen ügyfelet is elfogadnál, nézze át és igazítsa hozzá egy képzett jogász a te jogrendszeredben. Semmi itt nem állítja, hogy a planned.travel bármilyen tanúsítvánnyal, auditsal vagy megfelelési standarddal rendelkezne.',
  'legal.contents': 'Tartalom',
  'legal.shortVersion': 'Röviden',
  'legal.both': 'A két dokumentum együtt érvényes.',

  'landing.plans.title': 'Kezdj ingyen. Fizess, amikor kiérdemelte.',
  'landing.plans.lede':
    'Minden csomagban ott van a napi tervező, a térkép, a költségvetések és a csomaglisták. A fizetős csomagok - {price} / hó-tól - feloldják a korlátlan utazást, a foglalásokat, a naplót és az exportot.',
  'landing.plans.ledeFree':
    'Minden csomagban ott van a napi tervező, a térkép, a költségvetések és a csomaglisták. A fizetős csomagok feloldják a korlátlan utazást, a foglalásokat, a naplót és az exportot.',
  'landing.plans.compare': 'Vesd össze minden korlátot, soronként',
  'landing.questions.title': 'Kérdések, kerek válaszok',
  'landing.questions.lede':
    'A öt dolog, amit az emberek tényleg tudni akarnak, mielőtt belevágnak.',
  'cta.heading': 'A következő utazásod már megérdemli a rendes tervet',
  'cta.lede':
    'Két utazás, a teljes térkép, a napi terv és a csomaglisták - ingyen, kártya nélkül és visszaszámlálás nélkül.',
  'landing.faq.seats.q': 'Akikkel utazom, azoknak is fizetnie kell?',
  'landing.faq.seats.a':
    'Nem. Aki csak meghívást kap egy {crew} munkaterületre, azt fedezik a munkaterület helyei. A saját fiókjával lép be, és csak azokat az utazásokat látja, amelyekhez hozzáadtad.',
  'landing.faq.phone.q': 'Rendesen működik telefonon?',
  'landing.faq.phone.a':
    'Igen. A mobil elrendezések külön vannak megrajzolva, nem az asztaliakból összenyomva, és ez egy weboldal - nincs mit telepíteni és nincs mit frissen tartani.',
  'landing.faq.privacy.q': 'Ki láthatja az utazásomat?',
  'landing.faq.privacy.a':
    'Egy utazás egyetlen munkaterülethez tartozik, és csak az oda meghívottak nyithatják meg. Semmi nem nyilvános, nincs semmiféle felfedező folyam, és alapból semmit nem osztunk meg senkivel.',
  'landing.faq.stop.q': 'Mi történik az utazásaimmal, ha nem fizetek tovább?',
  'landing.faq.stop.a':
    'Semmi nem törlődik. A fizetős modulok bezárnak, az utazásaid pontosan ott maradnak, ahol vannak, és minden újra kinyílik abban a pillanatban, amikor előfizetsz. A {free} csomag ingyenes marad, visszaszámlálás nélkül.',

  'action.startPlanning': 'Kezdj tervezni ingyen',
  'cta.comparePlans': 'Csomagok összehasonlítása',
  'landing.hero.eyebrow': 'Közös utazástervezés',
  'landing.hero.title': 'Tervezd meg az utazást.',
  'landing.hero.titleQuiet': 'Ne a táblázatot.',
  'landing.hero.lede':
    'Egy útiterv igazi térképen, élőben megosztva mindenkivel, aki utazik - a foglalásokkal, a pénzzel és a csomaglistával együtt.',
  'landing.hero.secondary': 'Nézd meg, mennyibe kerül',
  'landing.trust.noCard': 'Kártya nélkül indulhatsz',
  'landing.trust.noAds': 'Semmi reklám, semmi affiliate link',
  'landing.trust.export': 'Exportálj mindent, bármikor',

  'proof.eyebrow': 'Egyenes válaszok',
  'proof.title': 'Nincsenek vélemények, mert még nem érdemeltük ki őket',
  'proof.lede':
    'A planned.travel új. Ahelyett, hogy idézetet találnánk ki vagy más logóját kérnénk kölcsön, itt pontosan az áll, mit tesz, kinek szól, és mit nem fog veled soha megtenni.',
  'proof.who.label': 'Kinek szól',
  'proof.who.heading': 'Annak, aki végül megcsinálja a táblázatot',
  'proof.who.body':
    'Pároknak, családoknak és baráti köröknek, akik egyetlen tervet akarnak, amit mindenki lát - hat képernyőkép, három csoportos beszélgetés és egy megosztott jegyzet helyett, amit március óta senki nem nyitott meg.',
  'proof.not.label': 'Ami nem',
  'proof.not.heading': 'Nem szállásfoglaló oldal, és nem is eladó egynek',
  'proof.not.body':
    'Nem kérünk jutalékot, nem hordunk reklámot és nem tesszük ki affiliate linket, így egyetlen oldalon sem terel semmi csendben egy adott hotel felé. Te fizetsz nekünk, tehát neked dolgozunk.',
  'proof.where.label': 'Hol lakik, ami a tiéd',
  'proof.where.heading': 'A Cloudflare-en, a saját munkaterületeden',
  'proof.where.body':
    'Az utazások a munkaterületedre szűkített adatbázisban, a fájlok a saját objektumtárolónkban vannak, mindkettő a Cloudflare peremhálózatáról érkezik. A Polar, a jogi értelemben vett viszonteladónk, viszi a fizetést és állítja ki a számlát, így a kártyaszámod soha nem jut el hozzánk.',
  'proof.promise.ads.title': 'Semmi reklám, semmi harmadik feles analitika',
  'proof.promise.ads.body':
    'Ezen az oldalon semmi nem mér téged valaki más számára.',
  'proof.promise.sold.title':
    'Az utazásaidat soha nem adjuk el és nem adjuk bérbe',
  'proof.promise.sold.body': 'Sem hirdetőknek, sem utazási cégeknek, senkinek.',
  'proof.promise.leave.title': 'Menj el, amikor akarsz, és vidd mindent',
  'proof.promise.leave.body':
    'PDF útitervek, naptárfájlok és a helyeid GeoJSON-ban.',
  'proof.certification':
    'Ma nincs semmilyen biztonsági tanúsítványunk, és nem is fogunk ilyet sejtetni. Amikor a planned.travel átmegy egy standard szerinti auditon, itt fogjuk megnevezni a standardot, az auditort és a dátumot - és nem előbb.',

  'feature.modules.title': 'Az utazás többi része, elrendezve',
  'feature.modules.lede':
    'Minden modul egyetlen dolgot végez el rendesen, és átadja a munkáját a többinek. Itt semmi nem üres fül, ami egy jövőbeli kiadásra vár.',
  'feature.module.lists.benefit': 'Senki nem érkezik meg az adapter nélkül.',
  'feature.module.lists.detail':
    'Csomagolás, tennivalók, bevásárlás és dokumentumok - feladatonként egy lista, megosztva mindenkivel, aki utazik, és menet közben kipipálva.',
  'feature.module.journal.name': 'Napló',
  'feature.module.journal.benefit': 'Az utazás történet lesz, nem mappa.',
  'feature.module.journal.detail':
    'Bejegyzések dátum szerint, a fotókkal, amiket készítettél, azzal, hol voltál, milyen idő volt, és milyen volt igazából az a nap.',
  'feature.module.atlas.benefit': 'Egyetlen térkép mindenről, ahol jártál.',
  'feature.module.atlas.detail':
    'Jelöld meglátogatottnak az országot, és felkerül a világtérképedre - az első látogatással, a legutóbbival és azzal, hányszor mentél vissza.',
  'feature.module.vacay.benefit':
    'A szabadságot előbb kérd ki, mint a repülőjegyet.',
  'feature.module.vacay.detail':
    'Jelöld be a napokat, amikor nem vagy itt, és az év kitöltődik - hétvégék, munkaszüneti napok és a többiek szabadsága ugyanabban a rácsban.',
  'feature.module.collab.benefit': 'A döntések az utazásnál maradnak.',
  'feature.module.collab.detail':
    'Egy szál utazásonként, közös jegyzetek arra, amit mindenkinek tudnia kell, és szavazás arra a pillanatra, amikor a társaság nem tud megegyezni a vacsorán.',
  'feature.module.files.benefit': 'Beszállókártyák ott, ahol megtalálod.',
  'feature.module.files.detail':
    'Visszaigazolások, jegyek, biztosítási papírok és számlák ahhoz az utazáshoz csatolva, amelyikhez tartoznak, nem egy postafiókba temetve.',

  'feature.planner.title': 'Napi bontású terv, igazi térképre rajzolva',
  'feature.planner.lede':
    'Gyűjtsd össze a helyeket, amiket látni akarsz, aztán húzd őket egy napra. A térkép menet közben rajzolja újra az útvonalat, így azonnal látod, ha egy délelőtt kétszer viszi át a városon.',
  'feature.planner.point.days':
    'Egy oszlop naponta, dátummal, időjárással és azzal, hol alszol.',
  'feature.planner.point.unscheduled':
    'A dátum nélküli helyek a saját oszlopukban várnak, míg napot nem kapnak.',
  'feature.planner.point.crew':
    'A {crew} csomagban egyszerre húzza mindenki: élő kurzorok, azonnali szinkronizálás, semmi újratöltés.',
  'feature.planner.point.tiles':
    'Vektoros térképszeletek a saját tárolónkból, így egyetlen térképszolgáltató sem figyeli, mit tervezel.',
  'feature.costs.title': 'Közös költségek, amik tényleg kiegyenlítődnek',
  'feature.costs.lede':
    'Írd fel, mit adtál ki, az utazás saját valutájában, oszd meg mindegyiket úgy, ahogy tényleg megbeszéltétek, és nézd meg a legrövidebb átutalás-sort, ami az egészet lezárja.',
  'feature.costs.point.split':
    'Egyenlően, arány szerint vagy pontos összegre - kiadásonként, nem utazásonként.',
  'feature.costs.point.currency':
    'Minden egyetlen utazási valutára átszámítva, hogy az összeg jelentsen valamit.',
  'feature.costs.point.settle':
    'Az elszámolás megmondja, ki kinek fizet, és rögzíti az átutalást, amint megtörtént.',
  'feature.costs.point.receipt':
    'Csatold a számlát a kiadáshoz, hogy a számnak mindig legyen bizonyítéka.',
  'feature.book.title': 'Minden foglalás, a kóddal, ami az ajtóban kell',
  'feature.book.lede':
    'Szállások, asztalok, túrák és belépők egy listán, a repülők, vonatok és kompok mellett, amik közéjük visznek - mindegyik a visszaigazolás számával és a nappal, amihez tartozik.',
  'feature.book.point.legs':
    'Az útszakaszok viszik az ülőhelyet, a vágányt, a terminált és a foglalási kódot.',
  'feature.book.point.day':
    'A foglalás egy naphoz tartozik, így újragépelés nélkül megjelenik a tervben.',
  'feature.book.point.states':
    'A kért, a visszaigazolt és a lemondott külön állapot, nem megjegyzés egy mezőben.',
  'feature.book.point.export':
    'Exportáld az egész utazást PDF útitervként vagy naptárfájlként, még indulás előtt.',

  'pricing.faq.trial.q': 'Mi történik, amikor lejár a próbaidő?',
  'pricing.faq.trial.a':
    'A próbaidő átfordul a fizetős csomagba. A Polar a próbaidő elején elkér egy fizetési módot, és a próbaidő lejáratának napján terheli — ha előbb lemondod, soha nem terhelnek. Egyik esetben sem törlődik semmi: a fizetős modulok bezárnak, az utazásaid pontosan ott maradnak, ahol vannak, és minden újra kinyílik abban a pillanatban, amikor előfizetsz.',
  'pricing.faq.seller.q': 'Kitől vásárolok valójában?',
  'pricing.faq.seller.a':
    'A Polartól. Ő a nyilvántartott értékesítőnk: viszonteladóként ő adja el neked az előfizetést, ő szedi be a fizetést, a saját nevében állítja ki a számlát, és ő határozza meg, szedi be és fizeti be a forgalmi adót vagy áfát, amit az országod kivet. A visszatérítések és a kártyás panaszok is nála zajlanak. A szolgáltatást továbbra is mi működtetjük, és az e-mailjeidre mi válaszolunk.',
  'pricing.faq.change.q': 'Váltahatok csomagot egy utazás közepén?',
  'pricing.faq.change.a':
    'Igen. A feljebb lépés azonnal érvényes és napra arányosított; a lejjebb lépés a már kifizetett időszak végén lép hatályba, tehát soha nem veszítesz olyan hozzáférést, amit kifizettél.',
  'pricing.faq.seats.q':
    'Hogyan működik a tagonkénti számlázás a {crew} csomagban?',
  'pricing.faq.seats.a':
    'A tényleg betöltött helyekért fizetsz, és a számot bármikor módosíthatod. A kiküldött meghívók is beszámítanak, hogy egy munkaterület soha ne lépje túl csendben a csomagot.',
  'pricing.faq.guests.q': 'Kell-e külön előfizetés azoknak, akikkel utazom?',
  'pricing.faq.guests.a':
    'Nem. Aki csak meghívást kap egy {crew} munkaterületre, azt fedezik a munkaterület helyei. A saját fiókjával lép be, és azokat az utazásokat látja, amelyekhez hozzáadták.',
  'pricing.faq.storage.q': 'Mi számít bele a tárhelybe?',
  'pricing.faq.storage.a':
    'Fényképek, jegyek, visszaigazolások és minden fájl, amit egy utazáshoz csatolsz. A térképcsempék és maga az alkalmazás soha nem számítanak bele. A Beállításokban pontosan látod, mi foglal helyet.',
  'pricing.faq.export.q': 'Kiviheteem az adataimat?',
  'pricing.faq.export.a':
    'Mindig. Minden utazás exportálható PDF útitervként és naptárfájlként, a helyeid pedig GeoJSON-ként. Ezek a te utazásaid, nem a mieink.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Nincs kártya, nincs határidő, nincs visszaszámlálás',
  'pricing.card.yearlyPerSeat':
    'Fejenként {amount} egy évre, egyszeri terheléssel',
  'pricing.card.yearly': 'Évente egyszer {amount}',
  'pricing.card.seatsUnlimited': 'Korlátlan tag',
  'pricing.card.tripsUnlimited': 'korlátlan utazás',
  'pricing.card.startFree': 'Kezdj ingyen',
  'pricing.card.startTrial': 'Próbáld ki a(z) {plan} csomagot',
  'pricing.card.popular': 'A legtöbbek választása',
  'pricing.card.noteYearly':
    'Évente egyszer terhelünk. Két hónap a mi vendégségünk.',
  'pricing.card.noteMonthly':
    'Havonta terhelünk. Váltasz vagy lemondod, amikor akarod.',
  'pricing.card.trial': {
    one: '{value} nap ingyen, kártya előre, terhelés a végén',
    other: '{value} nap ingyen, kártya előre, terhelés a végén',
  },
  'pricing.card.seatsUpTo': {
    one: 'Legfeljebb {value} tag',
    other: 'Legfeljebb {value} tag',
  },
  'pricing.card.trips': {
    one: 'egyszerre {value} utazás',
    other: 'egyszerre {value} utazás',
  },

  'pricing.feature.storage': '{size} fotókhoz és dokumentumokhoz',
  'pricing.feature.storageShared': '{size} közösen fotókhoz és dokumentumokhoz',
  'pricing.feature.free.tripsDetail': 'Archiválj egyet, és kezdj egy újat',
  'pricing.feature.solo.modules': 'Minden tervezőmodul',
  'pricing.feature.solo.modulesDetail':
    'Szállások, napló, költségek, csomagolás',
  'pricing.feature.crew.membersDetail':
    'Tagonkénti számlázás, bármikor módosítható',
  'pricing.feature.crew.realtimeDetail':
    'Élő kurzorok és azonnali szinkronizálás',
  'pricing.feature.crew.supportDetail': 'Emberi válasz egy munkanapon belül',

  'pricing.hero.eyebrow': 'Két utazás ingyen, örökre',
  'pricing.hero.title': 'Tervezd meg rendesen.',
  'pricing.hero.titleQuiet': 'Fizess azért, amit használsz.',
  'pricing.hero.lede':
    'Tervezz meg két utazást ingyen. Nyisd meg minden modult egy utazónak, vagy hozd a teljes társaságot, és szerkesszétek ugyanazt a tervet egyszerre.',
  'pricing.hero.taxNote':
    'Az árak amerikai dollárban, forgalmi adó és áfa nélkül. A Polar a nyilvántartott értékesítőnk: ő szerepel a számlán, kiszámolja, mennyit szed be az országod, hozzáadja a fizetésnél és befizeti. Bármikor lemondhatod, a terméken belülről.',
  'pricing.compare.eyebrow': 'Egymás mellett',
  'pricing.compare.title': 'Minden korlát, összevetve',
  'pricing.compare.lede':
    'Egyetlen táblázat, ugyanabból a katalógusból, amit a számlázás olvas. Ha egy sor azt írja, hogy egy modul benne van, a jogosultság-ellenőrzés egyetért vele.',
  'pricing.compare.caption':
    'Funkciók és korlátok összevetése mindhárom csomagban',
  'pricing.compare.feature': 'Funkció',
  'pricing.compare.limits': 'Korlátok',
  'pricing.compare.included': 'Benne van',
  'pricing.compare.notIncluded': 'Nincs benne',
  'pricing.compare.includedIn': 'A(z) {plan} csomagban benne van',
  'pricing.compare.notIn': 'A(z) {plan} csomagban nincs',
  'pricing.questions.eyebrow': 'Mielőtt megkérdezed',
  'pricing.questions.title': 'Kérdések, megválaszolva',
  'pricing.questions.lede':
    'Számlázás, próbaidők és az adataid visszaszerzése.',
  'pricing.cta.secondary': 'Nézd meg, hogyan működik',
  'pricing.module.itinerary': 'Napi terv',
  'pricing.module.map': 'Interaktív térkép',
  'pricing.module.budget': 'Költségvetés és költségmegosztás',
  'pricing.module.packing': 'Csomag- és tennivalólisták',
  'pricing.module.reservations': 'Foglalások',
  'pricing.module.journal': 'Útinapló',
  'pricing.module.atlas': 'Bejárt országok térképe',
  'pricing.module.collaboration': 'Hívj meg más utazókat',
  'pricing.module.realtime': 'Élő együttműködés',
  'pricing.module.offlineMaps': 'Offline térképek',
  'pricing.module.pdfExport': 'PDF- és naptárexport',
  'pricing.module.prioritySupport': 'Elsőbbségi támogatás',

  'anchor.plans': 'Csomagok',
  'anchor.compare': 'Összehasonlítás',
  'anchor.questions': 'Kérdések',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Egy hely az útitervnek, a térképnek, a foglalásoknak, a pénznek és a csomaglistának — megosztva mindenkivel, aki jön.',
  'footer.attribution':
    'Cloudflare Workers rendszeren fut. Térképadatok © az OpenStreetMap közreműködői. Az eladást és a számlázást a Polar, a nyilvántartott kereskedőnk végzi.',
  'footer.column.product': 'Termék',
  'footer.column.account': 'Fiók',
  'footer.link.overview': 'Áttekintés',
  'footer.link.everyModule': 'Az összes modul',
  'footer.link.dayPlanner': 'Napi tervező',
  'footer.link.sharedCosts': 'Közös költségek',
  'footer.link.reservations': 'Foglalások',
  'footer.link.atlasJournal': 'Atlasz és napló',
  'footer.link.createAccount': 'Fiók létrehozása',
  'footer.link.terms': 'Szolgáltatási feltételek',
  'footer.link.privacy': 'Adatvédelmi tájékoztató',
} satisfies TranslationOf<typeof En>

export default messages
