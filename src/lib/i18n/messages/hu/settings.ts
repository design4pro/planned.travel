/**
 * Everything the settings module says, in Hungarian.
 *
 * Made from `../en/settings.ts` and from nothing else. `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations, so every sentence here was written against our English source.
 *
 * **Address.** The polite third person («Ön») throughout, as in
 * `../hu/shell.ts` — an account screen that switched to the familiar «te»
 * halfway down would read as two different products.
 *
 * **A plan's name is a word, not a mark.** `billing.plan.<id>.name` is
 * translated like any other noun, because the id — `free`, `solo`, `crew` — is
 * what `src/lib/plans.ts`, Polar and the invoice carry, and no reader ever sees
 * it. `Polar`, `PDF` and `Face ID` stay as they are: a company, a format and a
 * trademark.
 *
 * **A language is never named in English**, and never named here either: all
 * twenty-three come from the frozen registry in `src/lib/i18n/locales.ts`, so no
 * key below spells one. Currency names take Hungarian's lower-case spelling.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  'workspace.invite.invite': 'Meghívás',
  'workspace.invite.resend': 'Újraküldés',
  'workspace.invite.revoke': 'Visszavonás',
  'workspace.invite.confirm': 'Meghívás visszavonása',
  'workspace.invite.expired': 'Lejárt',
  'workspace.invite.by': 'Meghívó: {name}',
  'workspace.invite.sent': 'Meghívó elküldve',
  'workspace.invite.revoked': 'Meghívó visszavonva',
  'workspace.invite.delivery':
    'A meghívó mentve, de az e-mail küldése sikertelen. Küldje el újra.',
  'workspace.invite.duplicate':
    'Már van függőben lévő meghívó. Küldje el újra.',
  'workspace.invite.existing': 'Ez a személy már a munkaterület tagja.',
  'workspace.invite.failed':
    'A meghívó nem érhető el. Frissítse a listát és próbálja újra.',
  'workspace.invite.reload': 'Meghívók frissítése',

  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Fiók',
  'page.title': 'Beállítások',
  'page.description':
    'Minden, ami Önről, a munkaterületéről és a planned.travel működéséről szól',
  'page.error': 'A beállítások nem töltődtek be',

  'nav.label': 'Beállítási szakaszok',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Ön, dátumok és összegek',
  'nav.language': 'Nyelv',
  'nav.language.hint': 'Minden képernyő nyelve',
  'nav.appearance': 'Megjelenés',
  'nav.appearance.hint': 'Téma, mozgás és térkép',
  'nav.security': 'Biztonság',
  'nav.security.hint': 'Jelszó, hitelesítés, kulcsok',
  'nav.notifications': 'Értesítések',
  'nav.notifications.hint': 'Postafiók, e-mail és telefon',
  'nav.workspace': 'Munkaterület',
  'nav.workspace.hint': 'Tagok és közös alapértékek',
  'nav.billing': 'Számlázás',
  'nav.billing.hint': 'Csomag, helyek és számlák',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Változtatások mentése',
  'error.retryBody':
    'Semmi nem veszett el. Ellenőrizze a kapcsolatot, majd próbálja újra.',
  'role.owner': 'Tulajdonos',
  'role.admin': 'Adminisztrátor',
  'role.member': 'Tag',

  /* -------------------------------------------------- regional option labels */
  /* 206px truncating trigger, and Hungarian dates are the longest we ship:
     «A munkaterületről» reached 226px on `2026. szept. 23.`, past English's own
     217px. «Közös alapérték» is the wording `nav.workspace.hint` already uses,
     and it drops a leading article that was carrying no meaning here. */
  'regional.workspaceDefault': 'Közös alapérték — {value}',
  'regional.currency.AUD': 'ausztrál dollár',
  'regional.currency.CAD': 'kanadai dollár',
  'regional.currency.CHF': 'svájci frank',
  'regional.currency.EUR': 'euró',
  'regional.currency.GBP': 'font sterling',
  'regional.currency.JPY': 'japán jen',
  'regional.currency.PLN': 'lengyel zloty',
  'regional.currency.SEK': 'svéd korona',
  'regional.currency.USD': 'amerikai dollár',
  'regional.distance.metric': 'Kilométer',
  'regional.distance.imperial': 'Mérföld',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'A profilja nem töltődött be',
  'profile.account.title': 'A fiókja',
  'profile.account.description':
    'A neve és az e-mail-címe abból a fiókból származik, amellyel belép.',
  'profile.email.verified': 'E-mail megerősítve',
  'profile.email.unverified': 'E-mail nincs megerősítve',
  'profile.twoFactor.on': 'Kétfaktoros belépés bekapcsolva',
  'profile.figure.workspace': 'Munkaterület',
  'profile.figure.role': 'Szerepkör',
  'profile.figure.joined': 'Tag ekkortól',
  'profile.figure.joinedUnknown': 'Nincs rögzítve',
  'profile.regional.title': 'Dátumok, összegek és mértékegységek',
  'profile.regional.description':
    'Ezek csak Önnél írják felül a munkaterület alapértékeit. Ha egyet alapértéken hagy, azt a munkaterülettől veszi át.',
  'profile.regional.saving': 'A beállításai mentése folyik',
  'profile.regional.saved': 'A beállításai elmentve',
  'profile.regional.saveFailed': 'A beállításai nem lettek elmentve',
  'profile.language.label': 'Nyelv',
  'profile.language.hint':
    'Külön képernyőn választható, ahol minden nyelv a saját írásával szerepel.',
  'profile.language.action': 'Módosítás',
  'profile.timezone.label': 'Időzóna',
  'profile.timezone.hint':
    'Az indulási és érkezési időpontok ehhez mérten jelennek meg.',
  'profile.currency.label': 'Pénznem',
  'profile.currency.hint':
    'Az új utazások ebben a pénznemben indulnak; minden utazás felülírhatja.',
  'profile.dateFormat.label': 'Dátumformátum',
  'profile.weekStart.label': 'A hét kezdőnapja',
  'profile.weekStart.hint':
    'Minden naptárra érvényes, a szabadságok évnézetére is.',
  'profile.distance.label': 'Távolság',

  /* --------------------------------------------------------------- language */
  'language.error': 'A nyelvi beállításai nem töltődtek be',
  'language.section.title': 'Nyelv',
  'language.section.description':
    'Minden képernyő, minden gomb és minden dátum azon a nyelven olvasható, amelyet itt kiválaszt — huszonhárom nyelv, mindegyik a saját írásával.',
  'language.label': 'Válasszon nyelvet',
  'language.followWorkspace': 'A munkaterületet követi',
  'language.state.yours': 'Az Ön nyelve',
  'language.state.workspace': 'A munkaterülettől jön',
  'language.state.hint.override':
    'Az Ön saját választása. Csak Önre érvényes, minden eszközön, ahonnan belép.',
  'language.state.hint.workspace':
    'Nincs saját nyelve, ezért azt olvassa, amire a munkaterület be van állítva. Ezt a tulajdonos vagy egy admin a Munkaterület résznél módosíthatja.',
  'language.saved': 'A planned.travel mostantól {language} nyelven beszél',
  'language.saveFailed': 'A nyelve nem változott meg',
  'language.saveFailedBody':
    'Semmi nem veszett el, és továbbra is {language} nyelven olvas. Ellenőrizze a kapcsolatot, majd válasszon újra.',
  'language.reload.title': 'A nyelve elmentve',
  'language.reload.body':
    'Ez az oldal nem tudott átváltani erre: {language}. Töltse be újra, hogy a terméket az új nyelvén olvassa.',
  'language.sample.title': 'Így fognak olvasni a dátumok és a számok',
  'language.sample.description':
    'Ugyanaz a három érték, ahogy ez a nyelv írja őket.',
  'language.sample.date': 'Egy dátum',
  'language.sample.number': 'Egy szám',
  'language.sample.money': 'Egy összeg',
  'language.legal':
    'A feltételek és az adatvédelmi tájékoztató csak angolul jelennek meg. A termékben minden más le van fordítva.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'A megjelenés nem töltődött be',
  'appearance.theme.title': 'Téma',
  'appearance.theme.description':
    'Mind a két téma megtervezett, egyik sem a másik kifordítása. Válassza azt, amelyet kényelmesebben olvas.',
  'appearance.theme.light': 'Világos',
  'appearance.theme.lightHint': 'Meleg papír, egész nap',
  'appearance.theme.dark': 'Sötét',
  'appearance.theme.darkHint': 'Meleg szénszürke, soha nem fekete',
  'appearance.theme.system': 'Rendszer',
  'appearance.theme.systemHint': 'Az eszközt követi',
  'appearance.theme.showing': 'Jelenleg ez a paletta látszik: {palette}.',
  'appearance.theme.showingSystem':
    'Jelenleg ez a paletta látszik: {palette} — az eszközét követve.',
  'appearance.palette.light': 'világos',
  'appearance.palette.dark': 'sötét',
  'appearance.motion.title': 'Mozgás és térképek',
  'appearance.motion.label': 'Kevesebb mozgás',
  'appearance.motion.hint':
    'A belépő animációkat egyszerű áttűnésre fogja vissza. Az operációs rendszer saját mozgáscsökkentő beállítását mindig tiszteletben tartjuk.',
  'appearance.map.label': 'Térkép stílusa',
  'appearance.map.hint': 'A tervezőben és az atlaszban használt alaptérkép.',
  'appearance.map.workspace': 'A munkaterületet követi',
  'appearance.map.workspaceHint': 'Amit a munkaterület tulajdonosa választott.',
  'appearance.map.auto': 'Automatikus',
  'appearance.map.autoHint': 'A világos vagy sötét témádat követi.',
  'appearance.map.paper': 'Papír',
  'appearance.map.paperHint': 'Meleg és világos, bármelyik témában.',
  'appearance.map.charcoal': 'Szénszürke',
  'appearance.map.charcoalHint': 'Meleg és sötét, bármelyik témában.',
  'appearance.map.quiet': 'Csendes',
  'appearance.map.quietHint':
    'Utcanevek nélkül, hogy a tűid látszódjanak először.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Megosztott képernyőn',
  'appearance.privacy.codesLabel':
    'Visszaigazolási kódok elrejtése, amíg meg nem nézem őket',
  'appearance.privacy.codesHint':
    'A foglalási hivatkozások és a visszaigazolási számok a foglalások és az utazások nézetében takarva maradnak, amíg rájuk nem kattint vagy meg nem érinti őket, és újra eltakarjuk őket, amikor továbblép. Az árakat sosem rejtjük el.',
  'appearance.saveFailed': 'Ez a módosítás nem lett eltárolva',
  'appearance.saveFailedBody':
    'Itt látszik, de a következő eszközön, ahonnan belép, már nem lesz meg.',

  /* --------------------------------------------------------------- security */
  'security.error': 'A biztonsági beállítások nem töltődtek be',
  'security.unverified.title': 'Az e-mail-címe még nincs megerősítve',
  'security.unverified.body':
    'A jelszó-visszaállításokat és az utazási meghívókat erre a címre küldjük: {email}. A megerősítés az, ami bizonyítja, hogy a cím az Öné.',
  'security.unverified.action': 'Küldje el újra a linket',
  'security.signin.title': 'Belépés',
  'security.signin.description':
    'Ahogyan bizonyítja, hogy Ön az. A kétfaktoros belépés és a belépési kulcs is erősebb a puszta jelszónál.',
  'security.email.label': 'E-mail-cím',
  'security.email.verified': 'Megerősítve',
  'security.email.unverified': 'Nincs megerősítve',
  'security.password.label': 'Jelszó',
  'security.password.hint':
    'Módosítsa, amikor csak szeretné — egyszer használható linket küldünk, a régit nem kérdezzük.',
  'security.password.action': 'Jelszó módosítása',
  'security.twoFactor.label': 'Kétfaktoros hitelesítés',
  'security.twoFactor.onHint':
    'E-mailes és jelszavas bejelentkezéskor kódot kérünk a hitelesítő alkalmazásból, kivéve, ha megbízol ebben a böngészőben.',
  'security.twoFactor.offHint':
    'Tegyen a jelszava mellé egy hatjegyű kódot egy hitelesítő alkalmazásból.',
  'security.twoFactor.on': 'Be',
  'security.twoFactor.off': 'Ki',
  'security.twoFactor.manage': 'Kezelés',
  'security.twoFactor.enable': 'Bekapcsolás',
  'security.passkeys.label': 'Belépési kulcsok',
  'security.passkeys.hint':
    'Lépjen be ujjlenyomattal, Face ID-val vagy biztonsági kulccsal, gépelés nélkül.',
  'security.passkeys.action': 'Belépési kulcsok kezelése',
  'security.session.title': 'Ez a munkamenet',
  'security.session.description': 'A böngésző, amelyben ezt olvassa.',
  'security.session.label': 'Belépve mint',
  'security.session.expires': 'Lejár: {date}',
  'security.session.expiresSoon': 'hamarosan',
  'security.session.noExpiry': 'Nincs rögzített lejárat',
  'security.signOut.label': 'Kijelentkezés',
  'security.signOut.hint':
    'Lezárja ezt a munkamenetet, és visszaviszi a belépési oldalra. A többi eszköz bejelentkezve marad.',
  'security.signOut.pending': 'Kijelentkezés folyik',
  'security.signOut.failed': 'A kijelentkezés nem történt meg',
  'security.signOut.failedBody':
    'Ellenőrizze a kapcsolatot, majd próbálkozzon újra.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Az értesítési beállítások nem töltődtek be',
  'notifications.title': 'Értesítések',
  'notifications.description':
    'Minden kapcsoló csak Önre érvényes. Ha egyet kikapcsol, az esemény ugyanúgy megtörténik — csak nem szólunk róla.',
  'notifications.caption': 'Melyik értesítés melyik csatornára jut el',
  'notifications.event': 'Esemény',
  'notifications.switch': '{event} – {channel} csatornán',
  'notifications.saveFailed': 'Ez a beállítás nem lett elmentve',
  'notifications.saveFailedBody':
    'A kapcsoló visszaállt. Ellenőrizze a kapcsolatot, majd próbálja újra.',
  'notifications.channel.in_app': 'Alkalmazásban',
  'notifications.channel.in_app.hint': 'A csengő a felső sávban',
  'notifications.channel.email': 'E-mail',
  'notifications.channel.email.hint': 'A belépési címére küldjük',
  'notifications.channel.push': 'Push-értesítés',
  'notifications.channel.push.hint': 'Azokon az eszközökön, ahol engedélyezte',
  'notifications.event.trip.invited': 'Utazási meghívók',
  'notifications.event.trip.invited.hint':
    'Valaki hozzáadja Önt egy utazáshoz, amit tervez.',
  'notifications.event.trip.updated': 'Tervmódosítások',
  'notifications.event.trip.updated.hint':
    'Egy nap, egy megálló vagy egy dátum elmozdul egy utazásban, amelyen részt vesz.',
  'notifications.event.trip.starting_soon': 'Indulási emlékeztetők',
  'notifications.event.trip.starting_soon.hint':
    'Egy figyelmeztetés az utazás kezdete előtti napokban.',
  'notifications.event.reservation.reminder': 'Foglalási emlékeztetők',
  'notifications.event.reservation.reminder.hint':
    'Egy szállás, egy asztal vagy egy jegy közeleg.',
  'notifications.event.expense.added': 'Új költségek',
  'notifications.event.expense.added.hint':
    'Valaki elkönyveli egy közös utazás kiadását.',
  'notifications.event.expense.settled': 'Lezárt egyenlegek',
  'notifications.event.expense.settled.hint':
    'Egy egyenleg, amelyben Ön is benne volt, kifizetésre került.',
  'notifications.event.list.assigned': 'Kiosztott tételek',
  'notifications.event.list.assigned.hint':
    'Egy csomag- vagy tennivalólista eleme Önhöz kerül.',
  'notifications.event.collab.message': 'Utazási beszélgetés',
  'notifications.event.collab.message.hint':
    'Új üzenetek egy utazásban, amelyen Ön is ott van.',
  'notifications.event.organization.invited': 'Munkaterületi meghívók',
  'notifications.event.organization.invited.hint':
    'Meghívják egy munkaterületre.',

  'notifications.event.billing.plan_changed': 'Előfizetés változásai',
  'notifications.event.billing.plan_changed.hint':
    'A munkaterülete másik csomagra vált.',
  'notifications.event.billing.invoice_paid': 'Fizetési visszaigazolások',
  'notifications.event.billing.invoice_paid.hint':
    'Kifizették a munkaterülete egyik számláját.',
  'notifications.event.billing.payment_failed': 'Fizetési gondok',
  'notifications.event.billing.payment_failed.hint':
    'A munkaterülete egyik terhelése nem sikerült.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'A munkaterület nem töltődött be',
  'workspace.summary.description': '{plan} csomag · létrehozva {date}',
  'workspace.summary.createdRecently': 'nemrég',
  'workspace.summary.billingAction': 'Csomag és számlázás',
  'workspace.seats.label': 'Használt helyek',
  'workspace.seats.value': '{used} / {limit}',
  'workspace.seats.note':
    'A nyitott meghívók beleszámítanak a helyekbe, így egy munkaterület soha nem lépheti túl azt a csomagot, amelyet fizet.',
  'workspace.seatsFull.title': 'Ebben a csomagban minden hely betöltve',
  'workspace.seatsFull.body':
    '{members} és {invitations} tölti be az összes helyet ({limit}).',
  'workspace.seatsFull.action': 'Helyek hozzáadása',
  'workspace.members.count': {
    one: '{value} tag',
    other: '{value} tag',
  },
  'workspace.invitations.count': {
    one: '{value} nyitott meghívó',
    other: '{value} nyitott meghívó',
  },
  'workspace.members.title': 'Tagok',
  'workspace.members.description':
    'Mindenki, aki látja a munkaterület utazásait, pénzügyeit és fájljait.',
  'workspace.members.tableLabel': 'Ennek a munkaterületnek a tagjai',
  'workspace.members.person': 'Személy',
  'workspace.members.role': 'Szerepkör',
  'workspace.members.joined': 'Csatlakozott',
  'workspace.invitations.title': 'Meghívók',
  'workspace.invitations.description':
    'Akiket meghívtak, de még nem csatlakoztak.',
  'workspace.invitations.emptyTitle': 'Nincs nyitott meghívó',
  'workspace.invitations.emptyBody':
    'Mindenki, akit erre a munkaterületre meghívtak, már csatlakozott.',
  'workspace.invitations.expires': 'Lejár: {date}',
  'workspace.invitations.expiresSoon': 'hamarosan',
  'workspace.defaults.title': 'Közös alapértékek',
  'workspace.defaults.description':
    'Ezekkel indul egy új utazás és egy új tag. Bárki felülírhatja őket magának a profiljában.',
  'workspace.defaults.readOnly': 'Csak olvasható',
  'workspace.defaults.saving': 'A munkaterületi alapértékek mentése folyik',
  'workspace.defaults.saved': 'A munkaterületi alapértékek elmentve',
  'workspace.defaults.saveFailed':
    'A munkaterületi alapértékek nem lettek elmentve',
  'workspace.defaults.saveFailedBody':
    'Csak tulajdonos vagy admin módosíthatja őket. Ellenőrizze a kapcsolatot, majd próbálja újra.',
  'workspace.currency.label': 'Alapértelmezett pénznem',
  'workspace.currency.hint': 'Az új utazások ebben készítik a költségvetést.',
  'workspace.language.label': 'Nyelv',
  'workspace.language.hint':
    'Amit egy olyan tag olvas, aki nem választott magának nyelvet.',
  'workspace.timezone.label': 'Időzóna',
  'workspace.dateFormat.label': 'Dátumformátum',
  'workspace.weekStart.label': 'A hét kezdőnapja',
  'workspace.distance.label': 'Távolság',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'A számlázás nem töltődött be',
  'billing.loading': 'A csomag és a bizonylatok betöltése folyik',
  'billing.status.none': 'Nincs előfizetés',
  'billing.status.trialing': 'Próbaidő',
  'billing.status.active': 'Aktív',
  'billing.status.past_due': 'A fizetés nem sikerült',
  'billing.status.unpaid': 'Kifizetetlen',
  'billing.status.paused': 'Szüneteltetve',
  'billing.status.canceled': 'Lemondva',
  'billing.status.incomplete': 'Befejezetlen',
  'billing.status.incomplete_expired': 'Lejárt',

  'billing.checkout.completeTitle': 'A fizetés megérkezett',
  'billing.checkout.completeBody':
    'Az új csomagja életbe lép. Abban a pillanatban megjelenik itt, amikor a Polar visszaigazolja — általában néhány másodperc alatt.',
  'billing.checkout.cancelledTitle': 'A fizetés megszakadt',
  'billing.checkout.cancelledBody':
    'Semmit nem vontunk le, és a csomagja sem változott.',
  'billing.portal.backTitle': 'Vissza a Polar-tól',
  'billing.portal.backBody':
    'Amit ott módosított, ide is megérkezik, amint a Polar visszaigazolja.',
  'billing.refresh': 'Frissítés',
  'billing.readOnly.title': 'Ön tagja ennek a munkaterületnek',
  'billing.readOnly.body':
    'Az előfizetést csak tulajdonos vagy admin módosíthatja. Az alábbi minden Önnek csak olvasható.',

  'billing.hero.label': 'Jelenlegi csomag',
  'billing.hero.endsAtPeriod': 'A periódus végén lejár',
  'billing.hero.perYear': '/ év',
  'billing.hero.perMonth': '/ hónap',
  'billing.hero.freeAllowance': '{trips} utazás, egy utazó',
  'billing.hero.perSeatLine': '{seats} tag × {price}',
  'billing.hero.singleTraveller': 'Egy utazó',
  'billing.price.free': 'Ingyenes',
  'billing.provider.opening': 'A Polar megnyitása',
  'billing.renewal.trialEndsToday':
    'A próbaidő ma véget ér. Az első terhelés ezután következik, ha előbb nem mondod le.',
  'billing.renewal.trialEndsIn': {
    one: 'A próbaidő {value} nap múlva véget ér, utána jön az első terhelés, ha előbb nem mondod le.',
    other:
      'A próbaidő {value} nap múlva véget ér, utána jön az első terhelés, ha előbb nem mondod le.',
  },
  'billing.renewal.trialEnded': 'A próbaideje véget ért.',
  'billing.renewal.endsNoDate':
    'Ez a csomag lejáratra van állítva, és nem újul meg.',
  'billing.renewal.endsOn':
    'Ez a csomag {date} napján ér véget. Semmi nem törlődik — a fizetős modulok csak lezárnak.',
  'billing.renewal.pastDue':
    'A legutóbbi fizetés nem ment át. Frissítse a kártyáját, hogy ne veszítse el a fizetős modulokat.',
  'billing.renewal.unpaid':
    'Ez az előfizetés kifizetetlen, és a fizetős modulok le vannak zárva.',
  'billing.renewal.paused':
    'Ez az előfizetés szünetel. Folytassa, amint újra útra készen áll.',
  'billing.renewal.lapsed':
    'Válasszon lentebb csomagot, és újra megnyílnak a foglalások és a napló.',
  'billing.renewal.incomplete':
    'A Polar még várja ennek a fizetésnek a visszaigazolását.',
  'billing.renewal.free':
    'Két utazás egyszerre, a mi vendégségünk. Váltson feljebb, amikor kinövi.',
  'billing.renewal.auto': 'Automatikusan megújul.',
  'billing.renewal.renewsOn': 'Megújul: {date}.',

  'billing.usage.title': 'Használat',
  'billing.usage.description':
    'Élőben számoljuk, így egyetlen mérő sem avul el. A korlátok az éppen érvényes csomagot követik.',
  'billing.quota.seats': 'Tagok',
  'billing.quota.trips': 'Utazások',
  'billing.quota.storageBytes': 'Tárhely',
  'billing.quota.unlimited': 'Korlátlan',
  'billing.quota.places': 'Helyek',
  'billing.quota.placesHint': 'A munkaterület összes utazásában',
  'billing.quota.exhausted.places': 'A helyek kerete elfogyott',
  'billing.quota.over.places': 'A helyek korlátja {value} értékkel túllépve',
  'billing.quota.noLimit': 'Ebben a csomagban nincs korlát',
  'billing.quota.used': 'felhasznált {quota}',
  'billing.quota.over.seats': {
    one: '{value} hellyel a csomag korlátja felett',
    other: '{value} hellyel a csomag korlátja felett',
  },
  'billing.quota.over.trips': {
    one: '{value} utazáshellyel a csomag korlátja felett',
    other: '{value} utazáshellyel a csomag korlátja felett',
  },
  'billing.quota.over.storage': '{value} a csomag korlátja felett',
  'billing.quota.exhausted.seats': 'Ebben a csomagban minden hely betöltve',
  'billing.quota.exhausted.trips':
    'Ebben a csomagban minden utazáshely használatban',
  'billing.quota.exhausted.storage': 'Ennek a csomagnak a tárhelye megtelt',
  'billing.quota.left': '{value} maradt',

  'billing.plans.title': 'Csomagok',
  'billing.plans.description':
    'Csomagot bármikor váltson. A felfelé váltás napra arányosított; a lefelé váltás megvárja, hogy a kifizetett periódus leteljen.',
  'billing.interval.label': 'Számlázási időszak',
  'billing.interval.monthly': 'Havi',
  'billing.interval.yearly': 'Éves',
  'billing.plan.free.name': 'Ingyenes',
  'billing.plan.free.tagline': 'Tervezze meg a következő két utazását',
  'billing.plan.free.feature.trips':
    'Két utazás egyszerre és legfeljebb 150 hely',
  'billing.plan.free.feature.itinerary': 'Napra bontott útiterv és térkép',
  'billing.plan.free.feature.lists': 'Csomaglisták és egyszerű költségvetések',
  'billing.plan.free.feature.atlas':
    'A világtérkép, amely számon tartja, hol járt',
  'billing.plan.solo.name': 'Egyéni',
  'billing.plan.solo.tagline': 'Az utazónak, aki mindent megtervez',
  'billing.plan.solo.feature.trips': 'Korlátlan utazás és hely',
  'billing.plan.solo.feature.modules':
    'Minden tervezőmodul — foglalások, napló, költségvetések, csomagolás',
  'billing.plan.solo.feature.storage': '5 GB fényképekhez és dokumentumokhoz',
  'billing.plan.solo.feature.export': 'PDF- és naptárexport',
  'billing.plan.crew.name': 'Csapat',
  'billing.plan.crew.tagline': 'Családoknak, barátoknak és kis csapatoknak',
  'billing.plan.crew.feature.members':
    'Legfeljebb tíz tag, fejenkénti számlázással',
  'billing.plan.crew.feature.realtime':
    'Valós idejű együttműködés élő kurzorokkal',
  'billing.plan.crew.feature.everything':
    'Korlátlan utazás és hely, valamint minden modul',
  'billing.plan.crew.feature.storage':
    'Közös hely mindenki fotóinak és dokumentumainak',

  'billing.plan.current': 'Jelenlegi csomag',
  'billing.plan.currentBadge': 'Jelenlegi',
  'billing.plan.popular': 'Népszerű',
  'billing.plan.switchYearly': 'Váltás évesre',
  'billing.plan.switchMonthly': 'Váltás havira',
  'billing.plan.upgradeTo': 'Váltás feljebb: {plan}',
  'billing.plan.changeTo': 'Módosítás erre: {plan}',
  'billing.plan.perMemberMonth': '/ tag / hónap',
  'billing.plan.perMonth': '/ hónap',
  'billing.plan.alwaysFree': 'Mindig ingyenes, kártya nélkül',
  'billing.plan.billedYearly': '{amount} évente számlázva',
  'billing.plan.billedMonthly': '{amount} havonta számlázva',
  'billing.plan.members': 'Tagok',
  'billing.plan.membersHint': 'Módosítsa bármikor — a számlázás követi.',
  'billing.plan.seatOption': {
    one: '{value} tag',
    other: '{value} tag',
  },

  'billing.invoices.number': 'Számla',
  'billing.invoices.date': 'Dátum',
  'billing.invoices.amount': 'Összeg',
  'billing.invoices.status': 'Állapot',
  'billing.invoice.paid': 'Fizetve',
  'billing.invoice.draft': 'Vázlat',
  'billing.invoice.void': 'Érvénytelen',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'A fizetési szolgáltató elutasította a kérést. Próbáld újra egy pillanat múlva.',
  'billing.failure.reference':
    'Hivatkozási szám az ügyfélszolgálatnak: {reference}',
  'billing.failure.forbidden':
    'A szereped ezt nem engedi a munkaterület számlázásán. Kérd egy tulajdonost vagy adminisztrátort.',
  'billing.failure.providerRefused':
    'A Polar nem fogadta el a módosítást. Vesd össze a helyek számát a tagjaiddal, majd próbáld újra, vagy használd a számlázási portált.',
  'billing.failure.rateLimited':
    'A Polar most túlterhelt. Semmi sem változott. Próbáld újra egy perc múlva.',
  'billing.failure.notConnected':
    'A számlázás ezen a telepítésen még nincs összekötve, ezért semmi sem változott. Fordulj az ügyfélszolgálathoz.',
  'billing.failure.orderNotInvoiceable':
    'A Polar nem tud számlát kiállítani erre a rendelésre. Ha hiányzik a számlázási név vagy cím, add meg a számlázási portálon, és próbáld újra; egyébként fordulj az ügyfélszolgálathoz.',
  'billing.planChanged.title': 'Csomag frissítve',
  'billing.planChanged.body':
    'A változás a Polarnál már érvényes, a különbséget ő számlázza. Az alábbi összegzés egy percen belül utolér.',
  'billing.discount.toggle': 'Van promóciós kódod?',
  'billing.discount.label': 'Promóciós kód',
  'billing.discount.hint': 'A következőként választott csomagra érvényes.',
  'billing.discount.hintCurrent':
    'Alkalmazza a jelenlegi csomagjára, vagy válasszon egy csomagot lent.',
  'billing.discount.applyCurrent': 'Alkalmazás a jelenlegi csomagra',
  'billing.discount.applying': 'Kód alkalmazása…',
  'billing.discount.invalidFormat': 'A kód 3–64 betűből és számjegyből áll.',
  'billing.discount.rejected.invalid':
    'Ez a kód érvénytelen. Ellenőrizd, és próbáld újra.',
  'billing.discount.rejected.rateLimited':
    'Túl sok kódot próbáltál. Próbáld újra egy óra múlva.',
  'billing.discount.rejected.notApplicable':
    'Ez a kód erre a csomagra nem érvényes.',
  'billing.discount.rejected.busy':
    'A kódokat most nem lehet ellenőrizni. Próbáld újra egy perc múlva.',
  'billing.discount.nextRenewal':
    'A promóciós kód a következő megújítástól érvényes.',
  'billing.discount.appliedTitle': 'Promóciós kód alkalmazva',
  'billing.hero.manage': 'Számlázás kezelése',
  'billing.hero.manageHint':
    'A kártyák, a számlázási cím, az adószám, a nyugták és a lemondás a Polarnál vannak, amely a számlát kiállítja.',
  'billing.hero.manageHintNone':
    'Még nincs számlázási profil. Ha lentebb fizetős csomagot választasz, létrejön, és onnantól megnyílik a portál.',
  'billing.portal.opening': 'Számlázási portál megnyitása',
  'billing.plan.notApplied': 'Ez a változás nem lépett érvénybe',
  'billing.plan.cancelInPortal': 'Lemondás a portálon',
  'billing.plan.seatsOverMax': {
    one: 'Ennek a munkaterületnek {members} tagja van, a {plan} pedig legfeljebb {max} tagot számláz. Váltás előtt távolíts el {value} tagot.',
    other:
      'Ennek a munkaterületnek {members} tagja van, a {plan} pedig legfeljebb {max} tagot számláz. Váltás előtt távolíts el {value} tagot.',
  },
  'billing.plan.seatsBelowMembers':
    '{members} tagod van. Válassz legalább ennyi helyet — a Polar elutasítja az előfizetést, ha kevesebb hely van, mint hozzárendelés.',
  'billing.orders.title': 'Megrendelések',
  'billing.orders.description':
    'Ennek a munkaterületnek minden megrendelése, a legújabbtól.',
  'billing.orders.receipts': 'Minden nyugta',
  'billing.orders.unavailableTitle': 'A megrendelések nem töltődnek be',
  'billing.orders.unavailableBody':
    'A Polar nem válaszolt időben az előzményekre. Minden fentebbi élő — próbáld újra egy pillanat múlva, vagy nézd meg a teljes nyilvántartást a számlázási portálon.',
  'billing.orders.emptyTitle': 'Még nincs megrendelés',
  'billing.orders.emptyCustomer':
    'Az első számla akkor jelenik meg itt, amint egy számlázási időszak lezárul.',
  'billing.orders.emptyNoCustomer':
    'Ezt a munkaterületet még soha nem terhelték meg. Válassz fizetős csomagot, és a számlák itt gyűlnek majd.',
  'billing.orders.tableLabel': 'Megrendelési előzmények',
  'billing.orders.document': 'Dokumentum',
  'billing.orders.dateUnknown': 'Ismeretlen dátum',
  'billing.order.pending': 'Folyamatban',
  'billing.order.refunded': 'Visszatérítve',
  'billing.order.partiallyRefunded': 'Részben visszatérítve',
  'billing.order.noInvoiceDraft': 'Amíg a megrendelés piszkozat, nincs számla',
  'billing.order.preparing': 'Készül',
  'billing.order.renderingHint':
    'A Polar még készíti a(z) {number} számlát. A letöltés néhány másodperc múlva visszatér.',
  'billing.order.fetching': 'Számla betöltése',
  'billing.order.generating': 'A Polar készíti a számlát',
  'billing.order.pdfLabel': '{number} számla PDF-ben',
  'billing.order.stillWritingTitle': 'A Polar még írja azt a számlát',
  'billing.order.stillWritingBody':
    'A(z) {number} számla készül. A letöltés magától visszatér néhány másodperc múlva.',
  'billing.order.openFailed': 'Az a számla nem nyílt meg',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Fiók',
  'passkeys.page.title': 'Belépési kulcsok',
  'passkeys.page.description':
    'A belépési kulccsal ujjlenyomattal, arcfelismeréssel vagy biztonsági kulccsal léphet be, gépelés nélkül.',
  'passkeys.page.back': 'Vissza a biztonsághoz',
  'passkeys.list.label': 'Az Ön belépési kulcsai',
  'passkeys.add.action': 'Belépési kulcs hozzáadása',
  'passkeys.add.loading': 'Várakozás az eszközére',
  'passkeys.add.added': 'Belépési kulcs hozzáadva',
  'passkeys.add.dismissed': 'Nem lett belépési kulcs hozzáadva',
  'passkeys.add.exists': 'Ezen az eszközön már van belépési kulcs a fiókjához',
  'passkeys.add.failed': 'A belépési kulcs nem lett hozzáadva. Próbálja újra.',
  'passkeys.add.stale':
    'A biztonsága érdekében a folytatáshoz jelentkezzen be újra.',
  'passkeys.error.sessionEnded':
    'A munkamenete véget ért. A folytatáshoz jelentkezzen be újra.',
  'passkeys.signInAgain': 'Bejelentkezés újra',
  'passkeys.add.limit':
    'Elérte a(z) {value} belépési kulcsos korlátot. Távolítson el egyet, hogy újat adhasson hozzá.',
  'passkeys.add.unsupported':
    'Ez a böngésző nem tud belépési kulcsot létrehozni. Próbáljon másik böngészőt vagy eszközt.',
  'passkeys.empty.title': 'Még nincs belépési kulcs',
  'passkeys.empty.body':
    'Adjon hozzá egyet, és ujjlenyomattal, arcfelismeréssel vagy biztonsági kulccsal léphet be, gépelés nélkül.',
  'passkeys.row.fallbackName': 'Belépési kulcs · hozzáadva: {date}',
  'passkeys.row.added': 'Hozzáadva: {date}',
  'passkeys.row.lastUsed': 'Utoljára használva: {date}',
  'passkeys.row.neverUsed': 'Belépéshez még nem használták',
  'passkeys.badge.synced': 'Szinkronizált',
  'passkeys.badge.singleDevice': 'Csak egy eszközön',
  'passkeys.error.title': 'A belépési kulcsok nem töltődtek be',
  'passkeys.error.retry': 'Újra',
  'passkeys.error.rateLimited':
    'Túl sok próbálkozás. Próbálja újra néhány perc múlva.',
  'passkeys.error.generic': 'Ellenőrizze a kapcsolatot, és próbálja újra.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': '{name} átnevezése',
  'passkeys.rename.fieldLabel': 'Nevezze el ezt a belépési kulcsot',
  'passkeys.rename.placeholder': 'Adjon neki nevet, például Munkahelyi telefon',
  'passkeys.rename.saving': 'A név mentése',
  'passkeys.rename.saved': 'Név elmentve',
  'passkeys.rename.failed': 'A név nem lett elmentve',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': '{name} eltávolítása',
  'passkeys.delete.title': 'Eltávolítja ezt a belépési kulcsot?',
  'passkeys.delete.body': 'Ezzel többé nem tud bejelentkezni: {name}.',
  'passkeys.delete.password': 'Jelszó',
  'passkeys.delete.passwordHint': 'A megerősítéshez adja meg a jelszavát.',
  'passkeys.delete.confirmOnly':
    'A fiókjának nincs jelszava. Erősítse meg, hogy el szeretné távolítani ezt a belépési kulcsot.',
  'passkeys.delete.confirm': 'Belépési kulcs eltávolítása',
  'passkeys.delete.cancel': 'Mégse',
  'passkeys.delete.wrongPassword': 'Ez a jelszó nem helyes.',
  'passkeys.delete.stale':
    'A biztonsága érdekében a belépési kulcs eltávolítása előtt jelentkezzen be újra.',
  'passkeys.delete.removed': 'Belépési kulcs eltávolítva',
  'passkeys.delete.failed':
    'A belépési kulcs eltávolítása nem sikerült. Próbálja újra.',
  'passkeys.delete.removing': 'A belépési kulcs eltávolítása folyamatban',
  'passkeys.delete.passwordRequired':
    'A belépési kulcs eltávolításához adja meg a jelszavát.',
  'workspace.departure.leave': 'Munkaterület elhagyása',
  'workspace.departure.remove': 'Tag eltávolítása',
  'workspace.departure.title': 'Megszünteti a tagságot itt: {workspace}?',
  'workspace.departure.body':
    '{name} elveszíti a hozzáférést ehhez: {workspace}. A fiókja, valamint a megőrzött utak és költségnyilvántartások megmaradnak.',
  'workspace.departure.cancel': 'Mégse',
  'workspace.departure.pending': 'Tagság megszüntetése…',
  'workspace.departure.lastOwner':
    'Távozás vagy a tulajdonos eltávolítása előtt nevezzen ki egy másik tagot tulajdonosnak.',
  'workspace.departure.notPermitted':
    'Jelenlegi szerepköre nem teszi lehetővé a tag eltávolítását. Újabb próbálkozás előtt frissítse a tagok listáját.',
  'workspace.departure.notFound':
    'Ez a személy már nem tagja ennek a munkaterületnek.',
  'workspace.departure.impersonated':
    'A munkaterületi tagság módosítása előtt fejezze be a másik felhasználó megszemélyesítését.',
  'workspace.departure.failed':
    'Az eredmény nem erősíthető meg. Újabb próbálkozás előtt töltse újra a munkaterületet.',
  'workspace.departure.removed': 'Tag eltávolítva',
  'workspace.departure.reload': 'Munkaterület újratöltése',
  'workspace.departure.activationFailed':
    'Kiléptél ebből a munkaterületből. A folytatáshoz nyisd meg a következőt.',
  'workspace.departure.recover': 'Következő munkaterület megnyitása',
  'twoFactor.back': 'Vissza a biztonsághoz',
  'twoFactor.title': 'Kétlépcsős hitelesítés',
  'twoFactor.description':
    'Adj hozzá egy második lépést az e-mailes és jelszavas bejelentkezéshez.',
  'twoFactor.error':
    'Nem sikerült betölteni a kétlépcsős hitelesítés beállításait.',
  'twoFactor.steps.label': 'Kétlépcsős hitelesítés beállítása',
  'twoFactor.steps.password': 'Igazold a személyazonosságod',
  'twoFactor.steps.key': 'Add hozzá a hitelesítő alkalmazáshoz',
  'twoFactor.steps.confirm': 'Írj be egy kódot',
  'twoFactor.steps.state.done': 'Kész',
  'twoFactor.steps.state.current': 'Jelenlegi lépés',
  'twoFactor.steps.state.todo': 'Még nem kezdődött el',
  'twoFactor.password.label': 'A jelszavad',
  'twoFactor.password.hint': 'A bejelentkezés módosítása előtt újra elkérjük.',
  'twoFactor.password.submit': 'Tovább',
  'twoFactor.password.pending': 'Beállítás folyamatban',
  'twoFactor.password.invalid': 'Ez a jelszó helytelen.',
  'twoFactor.key.intro':
    'A telefonodon hitelesítő alkalmazásra van szükség. Add hozzá ezt a kulcsot, majd térj vissza ide. A kétlépcsős hitelesítés még nincs bekapcsolva.',
  'twoFactor.key.matrixLabel':
    'Beállítási kód. Ugyanez a kulcs szövegként is elérhető',
  'twoFactor.key.matrixFailed':
    'Nem sikerült kódot létrehozni ehhez a kulcshoz. Add meg a beállítási kulcsot az alkalmazásban.',
  'twoFactor.key.label': 'Beállítási kulcs',
  'twoFactor.key.copy': 'Kulcs másolása',
  'twoFactor.key.copied': 'Kulcs másolva',
  'twoFactor.key.copyFailed':
    'A böngésző nem tudta másolni a kulcsot. Jelöld ki, és másold kézzel.',
  'twoFactor.key.open': 'Megnyitás a hitelesítő alkalmazásban',
  'twoFactor.key.startOver': 'Újrakezdés',
  'twoFactor.key.startOverHint':
    'Az újrakezdés új kulcsot hoz létre. Az alkalmazáshoz már hozzáadott kulcs nem fog működni.',
  'twoFactor.key.next': 'Hozzáadtam',
  'twoFactor.code.label': 'Kód az alkalmazásból',
  'twoFactor.code.hint': 'Az alkalmazásban most látható hat számjegy.',
  'twoFactor.code.submit': 'Kétlépcsős hitelesítés bekapcsolása',
  'twoFactor.code.pending': 'Ellenőrzés',
  'twoFactor.code.invalid':
    'A kód nem egyezik. Ellenőrizd a telefon óráját, és írd be az alkalmazás legfrissebb kódját.',
  'twoFactor.code.unclear':
    'Nem tudjuk, hogy sikerült-e. Írd be a legfrissebb kódot az újrapróbáláshoz.',
  'twoFactor.rateLimited.title': 'Túl sok próbálkozás rövid idő alatt',
  'twoFactor.rateLimited.password':
    'Várj körülbelül tíz másodpercet, majd próbáld újra. A beírt adatok megmaradtak.',
  'twoFactor.rateLimited.code':
    'Várj legfeljebb egy percet, majd próbáld újra. A beírt adatok megmaradtak.',
  'twoFactor.codes.title': 'A tartalékkódjaid',
  'twoFactor.codes.body':
    'Minden kód egyszer használható, ha elveszíted a telefonod. Csak most láthatók, ezért tárold őket biztonságosan.',
  'twoFactor.codes.copyAll': 'Összes másolása',
  'twoFactor.codes.copied': 'Tartalékkódok másolva',
  'twoFactor.codes.download': 'Letöltés szövegfájlként',
  'twoFactor.codes.copyFailed':
    'A böngésző nem tudta másolni a kódokat. Jelöld ki, és másold kézzel.',
  'twoFactor.codes.stored': 'Elmentettem ezeket a tartalékkódokat',
  'twoFactor.codes.done': 'Befejezés',
  'twoFactor.codes.gate': 'Jelöld be a négyzetet a folytatáshoz.',
  'twoFactor.codes.lost':
    'Ha előbb elhagyod ezt az oldalt, itt készíthetsz új kódkészletet. A régi nem fog működni.',
  'twoFactor.codes.leave.title': 'Kilépsz a kódok mentése nélkül?',
  'twoFactor.codes.leave.body':
    'A tartalékkódok csak egyszer láthatók. Ha most kilépsz, itt készíthetsz új készletet. A régi nem fog működni.',
  'twoFactor.codes.leave.stay': 'Maradok',
  'twoFactor.codes.leave.go': 'Kilépés',
  'twoFactor.on.title': 'A kétlépcsős hitelesítés be van kapcsolva',
  'twoFactor.on.badge': 'Bekapcsolva',
  'twoFactor.on.body':
    'E-mailes és jelszavas bejelentkezéskor kódot kérünk az alkalmazásból, kivéve, ha megbízol ebben a böngészőben. A Google-, Apple- vagy hozzáférési kulcsos bejelentkezés nem kér kódot.',
  'twoFactor.replace.action': 'Tartalékkódok cseréje',
  'twoFactor.replace.title': 'Lecseréled a tartalékkódjaidat?',
  'twoFactor.replace.body':
    'Új készletet kapsz. A jelenlegi a folytatás pillanatában érvénytelenné válik.',
  'twoFactor.replace.confirm': 'Csere',
  'twoFactor.replace.pending': 'Csere folyamatban',
  'twoFactor.nopassword.title': 'Először állíts be jelszót',
  'twoFactor.nopassword.body':
    'Ehhez a fiókhoz jelszó szükséges a kétlépcsős hitelesítéshez. A következő oldal elkéri az e-mail-címed, és beállítási hivatkozást küld. A jelszó beállítása mindenhol kijelentkeztet. Jelentkezz be újra, és térj vissza ide.',
  'twoFactor.nopassword.action': 'Jelszó beállítása',
  'twoFactor.setup.action': 'Beállítási kulcs megjelenítése újra',
  'twoFactor.setup.title': 'Beállítási kulcs',
  'twoFactor.setup.body':
    'Add hozzá ezt a kulcsot egy másik eszközhöz. A többi eszközödön lévő kulcs továbbra is működik.',
  'twoFactor.setup.done': 'Kész',
  'twoFactor.setup.confirm': 'Kulcs megjelenítése',
  'twoFactor.setup.pending': 'Ellenőrzés',
  'twoFactor.off.action': 'Kétlépcsős hitelesítés kikapcsolása',
  'twoFactor.off.title': 'Kikapcsolod a kétlépcsős hitelesítést?',
  'twoFactor.off.body':
    'Aki ismeri a jelszavadat, kód nélkül is bejelentkezhet. A többi bejelentkezett eszközöd bejelentkezve marad.',
  'twoFactor.off.confirm': 'Kikapcsolás',
  'twoFactor.off.pending': 'Kikapcsolás folyamatban',
  'twoFactor.off.cancel': 'Maradjon bekapcsolva',
  'twoFactor.off.done': 'A kétlépcsős hitelesítés ki van kapcsolva',
} satisfies TranslationOf<typeof En>

export default messages
