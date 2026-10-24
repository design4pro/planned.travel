/**
 * Everything the application shell says, in Hungarian.
 *
 * Made from `../en/shell.ts` and from nothing else. `docs/SPEC.md` §1 and §8.9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * **Address.** The product speaks to one traveller in the polite third person
 * («Ön»), which is what a Hungarian reader expects from an account screen, and
 * it holds that register in every sentence rather than slipping into the
 * familiar «te» on the friendlier ones.
 *
 * **Two branches that say the same thing.** Hungarian takes the singular after a
 * numeral, so `one` and `other` are deliberately identical wherever a number
 * precedes the noun. `Intl.PluralRules` still reports both categories for `hu`
 * and `__tests__/parity.test.ts` requires both.
 *
 * **Stored notification copy.** `src/server/repos/notifications.ts` stores a
 * notification as `titleKey` + `bodyKey` + a `params` record, never as a
 * rendered sentence, so the `notification.*` pairs below are what a row written
 * a year ago resolves against today. A reader's own text is set in Hungarian
 * quotation marks, which is the only thing a translator can do to a message that
 * is nothing but a placeholder.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Fő szakaszok',
  'nav.mobile': 'Szakaszok',
  'nav.dashboardLink': 'planned.travel irányítópult',
  'nav.homeLink': 'planned.travel főoldal',
  'nav.newTrip': 'Új utazás',

  'nav.trips': 'Utazásaim',
  'nav.trips.short': 'Utazások',
  'nav.vacay': 'Szabadság',
  'nav.vacay.short': 'Szabadság',
  'nav.atlas': 'Atlasz',
  'nav.atlas.short': 'Atlasz',
  'nav.journey': 'Napló',
  'nav.journey.short': 'Napló',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Az utazás szakaszai',
  'trip.nav.back': 'Utazások',
  'trip.nav.share': 'Megosztás',
  'trip.nav.shareLabel': 'Az utazás megosztása',
  'trip.tab.plan': 'Terv',
  'trip.tab.transports': 'Közlekedés',
  'trip.tab.book': 'Foglalás',
  'trip.tab.lists': 'Listák',
  'trip.tab.costs': 'Költségek',
  'trip.tab.files': 'Fájlok',
  'trip.tab.collab': 'Csapat',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Fiókmenü',
  'account.settings': 'Beállítások',
  'account.billing': 'Csomag és számlázás',
  'account.admin': 'Adminisztráció',
  'account.signOut': 'Kijelentkezés',
  'account.signingOut': 'Kijelentkezés folyamatban…',
  'account.signOutFailed': 'Nem sikerült kijelentkeztetni',
  'account.signOutFailedBody': 'Ellenőrizze a kapcsolatot, majd próbálja újra.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Munkaterület',
  'workspace.switched': 'Átváltottál ide: {name}',
  'workspace.switchFailed': 'Nem sikerült munkaterületet váltani',
  'workspace.switchFailedBody':
    'Ellenőrizze a kapcsolatot, majd próbálja újra.',
  'workspace.switchUnconfirmedBody':
    'Nem sikerült megerősíteni az aktív munkaterületet. A folytatás előtt töltsd újra az oldalt.',
  'workspace.switchRateLimitedBody':
    'Túl sok munkaterületváltás. Várj egy kicsit, majd próbáld újra.',
  'workspace.create': 'Munkaterület létrehozása',
  'workspace.createTitle': 'Új munkaterület létrehozása',
  'workspace.createDescription':
    'Külön terület a saját utazásoknak, helyeknek és embereknek. Az Ingyenes csomaggal indul, és nem osztozik annak a munkaterületnek a csomagján, amelyben éppen van.',
  'workspace.createPermanent':
    'A planned.travel még nem kínál lehetőséget munkaterület törlésére. Minden munkaterület, amelyet létrehozol vagy amelyhez csatlakozol, beleszámít a korlátba: ha {limit} munkaterület tagja vagy, nem hozhatsz létre újat.',
  'workspace.createName': 'A munkaterület neve',
  'workspace.createUpgrade':
    '„{workspace}” az Ingyenes csomagon van, és csak fizetős csomagon lévő munkaterület hozhat létre újat. Ha valamelyik másik munkaterülete fizetős csomagon van, váltson arra, és onnan hozza létre. Egyébként állítsa át fizetős csomagra a(z) „{workspace}” munkaterületet.',
  'workspace.createLimitReached':
    'Elérte azt a legnagyobb munkaterület-számot, amelynek egy fiók tagja lehet.',
  'workspace.createRoleRequired':
    'Munkaterületet csak a munkaterület adminisztrátora hozhat létre. Kérje meg ennek a munkaterületnek az adminisztrátorát, vagy váltson olyan munkaterületre, amelyet Ön kezel.',
  'workspace.createFailed': 'Nem sikerült létrehozni a munkaterületet',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Megjelenés',
  'theme.light': 'Világos',
  'theme.dark': 'Sötét',
  'theme.system': 'Rendszer szerint',
  'theme.state.light': 'világos',
  'theme.state.dark': 'sötét',
  'theme.state.system': 'a rendszert követi',
  'theme.trigger': 'Téma: {state}. Téma módosítása',
  'language.trigger': 'Nyelv: {language}. Nyelv módosítása',
  'language.hint':
    'Ezen az eszközön megjegyezzük. Bejelentkezés után a fiókodban beállított nyelv érvényes; a Beállításokban módosíthatod.',
  'language.announce': 'A nyelv módosítva: {language}',
  'language.notApplied':
    'Ez a böngésző nem tartotta meg a választásodat. Engedélyezd a sütiket ezen az oldalon, majd válassz újra.',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Értesítések, nincs olvasatlan',
  'bell.unread': {
    one: 'Értesítések, {unread} olvasatlan',
    other: 'Értesítések, {unread} olvasatlan',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Postafiók',
  'inbox.title': 'Értesítések',
  'inbox.error': 'A postafiókja nem töltődött be',
  'inbox.allRead': 'Minden elolvasva',
  'inbox.unread': {
    one: '{unread} olvasatlan üzenet',
    other: '{unread} olvasatlan üzenet',
  },
  'inbox.markAll': 'Összes olvasottnak jelölése',
  'inbox.markingAll': 'Minden olvasottnak jelölése folyik',
  'inbox.cleared': 'A postafiók kiürült',
  'inbox.markAllFailed': 'Nem sikerült mindent olvasottnak jelölni',
  'inbox.retryHint': 'Ellenőrizze a kapcsolatot, majd próbálkozzon újra.',
  'inbox.filter.all': 'Minden',
  'inbox.filter.unread': 'Olvasatlan',
  'inbox.waiting': {
    one: '{invitations} meghívó várakozik',
    other: '{invitations} meghívó várakozik',
  },
  'inbox.empty.title': 'A postafiókja üres',
  'inbox.empty.body':
    'Az utazási meghívók, a tervmódosítások, a foglalási emlékeztetők és a lezárt egyenlegek mind itt jelennek meg.',
  'inbox.empty.action': 'Vissza az irányítópultra',
  'inbox.emptyUnread.title': 'Nincs olvasatlan',
  'inbox.emptyUnread.body':
    'Mindent elolvasott. Váltson a „Minden” fülre, ha visszanézne az előzményekben.',
  'inbox.emptyUnread.action': 'Mutasd mindet',
  'inbox.row.new': 'Új',
  'inbox.row.accepted': 'Elfogadva',
  'inbox.row.declined': 'Elutasítva',
  'inbox.row.open': 'Megnyitás',
  'inbox.row.markRead': 'Elolvasva',
  'inbox.row.markingRead': 'Olvasottnak jelölés folyik',
  'inbox.row.markReadFailed': 'Nem sikerült olvasottnak jelölni',
  'inbox.preferences':
    'Válassza ki, melyik érkezzen a postafiókjába, az e-mail-címére és a telefonjára.',
  'inbox.preferencesAction': 'Értesítési beállítások',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Meghívták erre az utazásra: {tripTitle}',
  'notification.trip.invited.body': '{actorName} hozzáadta Önt az utazáshoz.',
  'notification.trip.updated.title': 'Frissült az utazás: {tripTitle}',
  'notification.trip.updated.body': '{actorName} módosította a tervet.',
  'notification.trip.member_added.title':
    '{memberName} csatlakozott az utazáshoz: {tripTitle}',
  'notification.trip.member_added.body':
    'Látja az útitervet, a foglalásokat és a költségeket.',
  'notification.trip.member_removed.title':
    '{memberName} kilépett az utazásból: {tripTitle}',
  'notification.trip.member_removed.body':
    'Az utazáshoz való hozzáférése megszűnt.',
  'notification.trip.starting_soon.title': {
    one: '{days} nap múlva indul: {tripTitle}',
    other: '{days} nap múlva indul: {tripTitle}',
  },
  'notification.trip.starting_soon.body':
    'Ideje átnézni a csomaglistát és a foglalásokat.',
  'notification.trip.copied.title': 'A(z) {tripTitle} kész',
  'notification.trip.copied.body': {
    one: 'Átkerült {days} nap',
    other: 'Átkerült {days} nap',
  },
  'notification.trip.copied.places': {
    one: '{places} hely',
    other: '{places} hely',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} jegyzet kimaradt',
    other: '{dropped} jegyzet kimaradt',
  },
  'notification.trip.copyFailed.title':
    'A(z) {tripTitle} másolása nem sikerült',
  'notification.trip.copyFailed.body':
    'Semmi sem veszett el. Próbáld újra az eredetiből.',
  'notification.reservation.reminder.title': 'Hamarosan következik: {title}',
  'notification.reservation.reminder.body':
    'Az időpontot és a visszaigazoló kódot a foglalásnál találja.',
  'notification.reservation.confirmed.title': 'Megerősítve: {title}',
  'notification.reservation.confirmed.body':
    'A foglalás megerősítettként szerepel ebben az utazásban: {tripTitle}.',
  'notification.expense.added.title': '{actorName} költséget rögzített',
  'notification.expense.added.body': '{title} — utazás: {tripTitle}.',
  'notification.expense.settled.title': '{actorName} kiegyenlítette a számlát',
  'notification.expense.settled.body':
    'Az egyenleg ki van fizetve ebben az utazásban: {tripTitle}.',
  'notification.list.assigned.title': '{actorName} Önhöz rendelt egy tételt',
  'notification.list.assigned.body': '{title} — utazás: {tripTitle}.',
  'notification.collab.message.title':
    '{actorName} írt ebben az utazásban: {tripTitle}',
  'notification.collab.message.body': '„{preview}”',
  'notification.collab.poll.title':
    'Szavazás indult ebben az utazásban: {tripTitle}',
  'notification.collab.poll.body': '„{question}”',
  'notification.organization.invited.title':
    'Meghívták erre a munkaterületre: {organizationName}',
  'notification.organization.invited.body':
    'Fogadja el, és csatlakozik a munkaterülethez és mindenhez, amit ott megosztanak.',
  'notification.journey.published.title': 'Megjelent: {title}',
  'notification.journey.published.body':
    'A linkkel mostantól bárki elolvashatja a naplót.',
  'notification.billing.plan_changed.title': 'Megváltozott a csomagja',
  'notification.billing.plan_changed.body':
    '{organizationName} mostantól ezt a csomagot használja: {plan}.',
  'notification.billing.invoice_paid.title': 'Fizetés beérkezett',
  'notification.billing.invoice_paid.body':
    '{organizationName} legutóbbi számlája ki van fizetve.',
  'notification.billing.payment_failed.title': 'Egy fizetés nem sikerült',
  'notification.billing.payment_failed.body':
    '{organizationName} fizetése késik. Frissítse a fizetési módot, hogy megmaradjon a csomag.',
  'notification.fallback.title': 'Valami megváltozott a munkaterületén',
  'notification.fallback.body':
    'Nyissa meg az utazást, hogy lássa, mi volt az.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Az irányítópult nem töltődött be',
  'dashboard.blank.title': 'A következő utazása itt kezdődik',
  'dashboard.blank.body':
    'Hozzon létre egy utazást, tegye a térképre a helyeket, amiket látni szeretne, és a planned.travel köréjük építi a napi tervet.',
  'dashboard.blank.action': 'Utazás tervezése',
  'dashboard.blank.secondary': 'Nézze meg az atlaszát',

  'dashboard.upNext': 'Következik',
  'dashboard.openPlan': 'Terv megnyitása',
  'dashboard.hero.travellers': 'Utazók',
  'dashboard.hero.datesMissing':
    'Adjon meg dátumokat, hogy felépüljenek a napok',
  'dashboard.hero.startsIn': 'Indulásig',
  'dashboard.hero.started': 'Elindult',
  'dashboard.hero.today': 'Ma',
  'dashboard.hero.startUnknown': 'nincs kezdődátum',
  'dashboard.hero.startToday': 'jó utat',
  'dashboard.hero.startPast': {
    one: 'nappal ezelőtt',
    other: 'nappal ezelőtt',
  },
  'dashboard.hero.startFuture': { one: 'nap', other: 'nap' },
  'dashboard.hero.nights': 'Éjszakák',
  'dashboard.hero.companionsHint': 'ezen az úton',
  'dashboard.hero.progress': 'Folyamatban',
  'dashboard.hero.places': 'Helyek',
  'dashboard.hero.placesNone': 'még nincs semmi a térképen',
  'dashboard.hero.placesHint': 'a térképen',

  'dashboard.stat.countries': 'Meglátogatott országok',
  'dashboard.stat.countriesUnit': '{total} közül',
  'dashboard.stat.countriesNone':
    'Jelöljön meg egy országot, és indul az atlasza',
  'dashboard.stat.visits': {
    one: '{visits} rögzített látogatás',
    other: '{visits} rögzített látogatás',
  },
  'dashboard.stat.trips': 'Összes utazás',
  'dashboard.stat.tripsCaption':
    '{planning} tervezés alatt · {booked} lefoglalva',
  'dashboard.stat.places': 'Térképre tett helyek',
  'dashboard.stat.placesNone': 'Még nincs semmi a térképen',
  'dashboard.stat.placesAcross': {
    one: '{trips} utazásban',
    other: '{trips} utazásban',
  },
  'dashboard.stat.bookings': 'Megerősített foglalások',
  'dashboard.stat.bookingsNone': 'Nincs közelgő foglalás',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} foglalás útban',
    other: '{bookings} foglalás útban',
  },

  'dashboard.trips.label': 'Az utazásai',
  'dashboard.trips.all': 'Összes utazás',
  'dashboard.trips.empty.title': 'Még nincs utazás',
  'dashboard.trips.empty.body':
    'Minden, amit megtervez, itt jelenik meg, a legújabb elöl.',
  'dashboard.trips.empty.action': 'Utazás létrehozása',

  'dashboard.bookings.label': 'Közelgő foglalások',
  'dashboard.bookings.empty.title': 'Még nincs foglalás',
  'dashboard.bookings.empty.body':
    'A megerősített szállások, asztalok és jegyek itt jelennek meg, ahogy közeledik a dátumuk.',

  'dashboard.pipeline.label': 'Utazások folyamata',
  'dashboard.pipeline.empty':
    'Semmi sincs folyamatban. Az első utazása szakaszokra bontja majd ezt.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} kedvenc',
    other: '{favourites} kedvenc',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} archivált utazás',
    other: '{archived} archivált utazás',
  },

  'dashboard.storage.label': 'Tárhely',
  'dashboard.storage.count': '{used} / {limit}',
  'dashboard.storage.files': {
    one: '{files} fájl az összes utazásban, a fotókkal és a jegyekkel együtt.',
    other:
      '{files} fájl az összes utazásban, a fotókkal és a jegyekkel együtt.',
  },
  'dashboard.storage.more': 'Több helyre van szüksége?',
  'dashboard.storage.plans': 'Csomagok megtekintése',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Referencia',
  'dashboard.widgets.choose': 'Widgetek kiválasztása',
  'dashboard.widgets.description':
    'A widgetek, amelyeket az irányítópultja mellett tart.',
  'dashboard.clock.label': 'Világóra',
  'dashboard.clock.add': 'Időzóna hozzáadása',
  'dashboard.clock.search': 'Városok és régiók keresése',
  'dashboard.clock.noMatches': 'Nincs ilyen nevű időzóna',
  'dashboard.clock.remove': '{zone} eltávolítása',
  'dashboard.clock.offset': '{offset} a saját idejéhez képest',
  'dashboard.clock.here': 'A saját ideje',
  'dashboard.clock.empty.title': 'Nincs rögzített időzóna',
  'dashboard.clock.empty.body':
    'Rögzítsen egy helyet, és olvassa az óráját a sajátja mellett.',
  'dashboard.clock.unknown.title':
    'Ez az eszköz nem ismeri a következőt: {zone}',
  'dashboard.clock.unknown.body':
    'Az ideje itt nem olvasható. Távolítsa el a sort a hiba megszüntetéséhez.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Az admin konzol nem töltődött be',
  'admin.denied.title': 'Ezt csak a munkaterület adminjai nyithatják meg',
  'admin.denied.body':
    'Ha szükséges, kérje meg a munkaterület tulajdonosát vagy egy adminját, hogy módosítsa a szerepkörét.',
  'admin.denied.action': 'Vissza az irányítópultra',
  'admin.eyebrow': 'Munkaterület adminisztrációja',
  'admin.description': '{plan} csomag · létrehozva {date}',
  'admin.createdUnknown': 'nemrég',
  'admin.workspaceSettings': 'Munkaterület beállításai',
  'admin.billing': 'Csomag és számlázás',

  'admin.invitations.title': {
    one: '{invitations} meghívó még nyitva van',
    other: '{invitations} meghívó még nyitva van',
  },
  'admin.invitations.body':
    'Minden nyitott meghívó beleszámít a csomag által fizetett helyekbe.',
  'admin.invitations.action': 'Meghívók áttekintése',

  'admin.stat.members': 'Tagok',
  'admin.stat.membersCaption': {
    one: '{invitations} meghívó folyamatban',
    other: '{invitations} meghívó folyamatban',
  },
  'admin.stat.storage': 'Tárhely',
  'admin.stat.storageUnit': '{limit} keretből',
  'admin.stat.storageUnlimited': 'nincs korlát',
  'admin.stat.storageCaption': 'Fájlok, fotók és exportok',
  'admin.stat.audit': 'Naplóbejegyzések',
  'admin.stat.auditCaption': 'A legutóbbi tevékenység lentebb látszik',
  'admin.stat.plan': 'Csomag',
  'admin.stat.planCaption': 'A korlátok az adattár határán érvényesülnek',

  'admin.quotas.label': 'Korlátok',
  'admin.quotas.count': {
    one: '{metrics} mérőszám',
    other: '{metrics} mérőszám',
  },
  'admin.quotas.unlimited': 'Korlátlan',
  'admin.quotas.value': '{used}/{limit}',

  'admin.members.label': 'Tagok',
  'admin.members.table': 'Ennek a munkaterületnek a tagjai',
  'admin.members.person': 'Személy',
  'admin.members.role': 'Szerepkör',
  'admin.members.joined': 'Csatlakozott',
  'admin.members.role.label': '{name} szerepköre',
  'admin.members.role.saved': '{name} mostantól: {role}.',
  'admin.members.role.impersonated': 'A szerepkör nem módosítható, amíg másik fiókként jár el.',
  'admin.members.role.notPermitted':
    'Ezt a módosítást nem végezheti el. A tulajdonosi szerepkört csak tulajdonos adhatja, és csak tulajdonos módosíthatja.',
  'admin.members.role.lastOwner':
    'Ez a munkaterület egyetlen tulajdonosa. Előbb jelöljön ki másik tulajdonost.',
  'admin.members.role.notFound': 'Ez a személy már nincs a munkaterületen. A lista frissült.',
  'admin.members.role.failed': 'A szerepkört nem sikerült módosítani. Próbálja újra.',
  'admin.members.role.promote.title': '{name} legyen tulajdonos?',
  'admin.members.role.promote.body':
    '{name} ugyanakkora hatalmat kap, mint Ön: számlázás, tagok és beállítások. Egy tulajdonos lefokozhat vagy eltávolíthat bármely másik tulajdonost, Önt is.',
  'admin.members.role.promote.confirm': 'Legyen tulajdonos',
  'admin.members.role.promote.cancel': 'Mégse',

  'admin.activity.label': 'Legutóbbi tevékenység',
  'admin.activity.empty.title': 'Még nincs rögzítve semmi',
  'admin.activity.empty.body':
    'Minden fontos írás bekerül a naplóba, amint megtörténik.',
  'admin.activity.workspace': 'maga a munkaterület',
  'admin.actions.label': 'Legsűrűbb műveletek',
  'admin.actions.count': {
    one: '{actions} művelet',
    other: '{actions} művelet',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Vázlat',
  'tripStatus.planning': 'Tervezés alatt',
  'tripStatus.booked': 'Lefoglalva',
  'tripStatus.active': 'Aktív',
  'tripStatus.completed': 'Befejezve',
  'tripStatus.archived': 'Archiválva',

  'bookingStatus.none': 'Nincs lefoglalva',
  'bookingStatus.pending': 'Folyamatban',
  'bookingStatus.confirmed': 'Megerősítve',
  'bookingStatus.cancelled': 'Lemondva',
  'bookingStatus.completed': 'Kész',

  'bookingType.accommodation': 'Szállás',
  'bookingType.restaurant': 'Asztal',
  'bookingType.activity': 'Program',
  'bookingType.tour': 'Túra',
  'bookingType.ticket': 'Jegy',
  'bookingType.transport': 'Közlekedés',
  'bookingType.other': 'Foglalás',

  'role.owner': 'Tulajdonos',
  'role.admin': 'Adminisztrátor',
  'role.member': 'Tag',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} utazás',
    other: '{value} utazás',
  },
  'trips.count.favourites': {
    one: '{value} kedvenc',
    other: '{value} kedvenc',
  },
  'trips.count.archived': {
    one: '{value} archivált',
    other: '{value} archivált',
  },
  'trips.atLimit.body':
    'A csomagod {trips} fed le. Archiválj egy befejezettet, vagy lépj feljebb csomagot, hogy egyszerre többet tarthass nyitva.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Új napló',
  'newJourney.title': 'Kezdj naplót',
  'newJourney.description':
    'A napló az utazás megírt oldala — bejegyzések dátum szerint, a fényképekkel és az időjárással, amire emlékszel.',
  'newJourney.titlePlaceholder': 'Két hét Kiotóban',
  'newJourney.subtitle': 'Alcím',
  'newJourney.subtitleHint': 'Egy sor a cím alatt, a borítón.',
  'newJourney.subtitlePlaceholder':
    'Templomok, vonatok és jóval túl sok matcha',
  'newJourney.trip': 'Egy utazás alapján',
  'newJourney.tripHint': 'Nem kötelező — a történetet a tervéhez köti.',
  'newJourney.tripNone': 'Nincs utazáshoz kötve',
  'newJourney.datesError': 'A záró dátum a kezdet előtt van.',
  'newJourney.submit': 'Napló létrehozása',
  'newJourney.creating': 'Napló létrehozása folyamatban',
  'newJourney.created': 'A napló elindult',
  'newJourney.createdBody':
    'Add hozzá az első bejegyzést, hogy induljon a történet.',
  'newJourney.error':
    'A naplót nem sikerült létrehozni. Próbáld újra egy pillanat múlva.',
  'newCollection.trigger': 'Új gyűjtemény',
  'newCollection.title': 'Kezdj gyűjteményt',
  'newCollection.description':
    'Hely a helyeknek, amiket még azelőtt találsz, hogy tudnád, melyik utazáshoz tartoznak.',
  'newCollection.namePlaceholder': 'Kávé, amiért érdemes átmenni a városon',
  'newCollection.descriptionHint': 'Mi tartozik ide, és mi nem.',
  'newCollection.submit': 'Gyűjtemény létrehozása',
  'newCollection.creating': 'Gyűjtemény létrehozása folyamatban',
  'newCollection.created': 'Gyűjtemény létrehozva',
  'newCollection.createdBody': 'Kezdj helyeket menteni bele.',
  'newCollection.error':
    'A gyűjteményt nem sikerült létrehozni. Próbáld újra egy pillanat múlva.',

  'newTrip.title': 'Kezdj új utazást',
  'newTrip.description':
    'Egy cím elég. A dátumok felépítik a napi tervet, a többi ráér, amikor már tudod.',
  'newTrip.name': 'Az utazás neve',
  'newTrip.namePlaceholder': 'Kiotó a cseresznyevirágzás idején',
  'newTrip.destination': 'Úti cél',
  'newTrip.destinationHint': 'Egy város, egy régió vagy a teljes útvonal.',
  'newTrip.destinationPlaceholder': 'Kiotó, Japán',
  'newTrip.departure': 'Indulás',
  'newTrip.return': 'Visszaút',
  'newTrip.returnError': 'A visszaút dátuma az indulás előtt van.',
  'newTrip.currency': 'Költségvetés pénzneme',
  'newTrip.currencyHint': 'Ebben összegzünk minden kiadást az utazáson.',
  'newTrip.currencySearch': 'Keresés kód vagy név szerint',
  'newTrip.currencyEmpty': 'Nincs ilyen pénznem.',
  'newTrip.currencyFavourites': 'Kedvencek',
  'newTrip.currencyAll': 'Összes pénznem',
  'newTrip.summary': 'Összefoglaló',
  'newTrip.summaryPlaceholder': 'Két hét templomokkal, vonatokkal és ramennel.',
  'newTrip.duration': 'Időtartam napokban',
  'newTrip.durationHint':
    'Dátumok nélkül az utazás ennyi dátum nélküli nappal indul.',
  'newTrip.durationDerived': 'A két dátumból számolva.',
  'newTrip.reminder': 'Emlékeztető indulás előtt',
  'newTrip.reminderNone': 'Nincs',
  'newTrip.reminderBefore': {
    one: '{count} nappal előtte',
    other: '{count} nappal előtte',
  },
  'newTrip.reminderCustom': 'Egyéni',
  'newTrip.reminderCustomDays': 'Napok indulás előtt',
  'newTrip.reminderOn': 'Emlékeztető: {date}',
  'newTrip.reminderNoDeparture':
    'Válasszon indulási dátumot, hogy lássa a napot.',
  'newTrip.submit': 'Utazás létrehozása',
  'newTrip.creating': 'Utazás létrehozása folyamatban',
  'newTrip.error':
    'Az utazást nem sikerült létrehozni. Próbáld újra egy pillanat múlva.',
  'newTrip.created': 'Utazás létrehozva',
  'newTrip.createdBody': 'Kezdj helyeket rakni a térképre.',
  'newTrip.coverChoose': 'Borítókép hozzáadása',
  'newTrip.coverChange': 'Borítókép cseréje',
  'newTrip.coverHint':
    'Húzz ide egy képet, illessz be egyet, vagy válassz egy fájlt. PNG, JPEG, WebP, AVIF vagy GIF.',
  'newTrip.coverChosen': 'Borítókép: {name}',
  'newTrip.coverRemove': 'Borítókép eltávolítása',
  'newTrip.coverTypeError':
    'A(z) „{name}” nem lehet borítókép. Válassz PNG, JPEG, WebP, AVIF vagy GIF fájlt.',
  'newTrip.coverSizeError':
    'A(z) „{name}” nagyobb, mint {max}. Válassz kisebb képet.',
  'newTrip.coverUploading': 'A borítókép feltöltése folyamatban',
  'newTrip.coverFailedTitle': 'A borítóképet nem sikerült hozzáadni',
  'newTrip.coverFailed':
    'Az utazás létrejött, de a(z) „{name}” fájlt nem sikerült borítóként feltölteni.',
  'newTrip.coverRetry': 'Próbáld újra',
  'newTrip.coverContinue': 'Az utazás megnyitása borítókép nélkül',
  'newTrip.people': 'Emberek',
  'newTrip.peopleHint':
    'Az utazás létrehozása után azonnal hozzáadódnak. Te maradsz a tulajdonosa.',
  'newTrip.peoplePlaceholder': 'Válassz a munkaterületedről',
  'newTrip.peopleSearch': 'Keresés név szerint',
  'newTrip.peopleLoading': 'A munkaterület tagjainak betöltése',
  'newTrip.peopleLoadError':
    'A munkaterület tagjait nem sikerült betölteni. Hozd létre az utazást, és add hozzá őket az Emberek képernyőn.',
  'newTrip.peopleNone':
    'Egyelőre te vagy az egyetlen ember ezen a munkaterületen.',
  'newTrip.peopleNoneMember':
    'További embereket a munkaterület tulajdonosa vagy adminisztrátora hívhat meg.',
  'newTrip.peopleInvite': 'Emberek meghívása a munkaterületre',
  'newTrip.peopleChosen': 'Kiválasztott emberek és szerepeik',
  'newTrip.peopleFailedTitle':
    'Az utazás létrejött, de nem mindenki lett hozzáadva',
  'newTrip.noticeBothTitle':
    'Az utazás létrejött, de nem minden lett hozzáadva',
  'newTrip.peopleNotInWorkspace':
    '{name} már nincs ezen a munkaterületen, ezért nem lett hozzáadva.',
  'newTrip.peopleAlreadyOn': '{name} már rajta volt ezen az utazáson.',
  'newTrip.peopleUnconfirmed':
    '{name} hozzáadását nem sikerült megerősíteni. Az Emberek képernyőn ellenőrizheted.',
  'newTrip.peopleContinue': 'Tovább',
  'newTrip.peopleRetry': 'Próbáld újra',
  'newTrip.coverRetryOnly': 'A borító újrapróbálása',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Műveletek: {title}',
  'tripActions.copy': 'Másolás',
  'tripActions.favourite': 'Kedvencekhez adás',
  'tripActions.unfavourite': 'Eltávolítás a kedvencekből',
  'tripActions.edit': 'Szerkesztés',
  'tripActions.archive': 'Archiválás',
  'tripActions.restore': 'Visszaállítás',
  'tripActions.delete': 'Törlés',
  'tripActions.deleteForGood': 'Végleges törlés',
  'tripActions.starFailed': 'A kedvenc nem mentődött el',
  'tripActions.starFallback': 'Az utazás visszaállt a korábbi állapotára.',
  'tripActions.archived': 'Utazás archiválva',
  'tripActions.archiveFailed': 'Az utazást nem sikerült archiválni',
  'tripActions.restored': 'Utazás visszaállítva',
  'tripActions.restoreFailed': 'Az utazást nem sikerült visszaállítani',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Utazás szerkesztése',
  'editTrip.submit': 'Módosítások mentése',
  'editTrip.saving': 'Utazás mentése',
  'editTrip.cancel': 'Mégse',
  'editTrip.saved': 'Utazás frissítve',
  'editTrip.errorTitle': 'Ez nem mentődött el',
  'editTrip.retry': 'Újra',
  'editTrip.error':
    'Az utazást nem sikerült menteni. Próbáld újra egy pillanat múlva.',
  'editTrip.coverFailed':
    'A(z) „{name}” fájlt nem sikerült borítóként feltölteni. Más még nem került mentésre.',
  'editTrip.coverContinue': 'Mentés az új borítókép nélkül',
  'editTrip.currencyLocked':
    'Ennek az utazásnak már vannak árai, ezért a költségvetés pénznemét itt nem lehet módosítani. A Költségek fülön használd a Költségvetés pénznemének módosítása gombot, vagy állítsd vissza {current} értékre, hogy a többi módosításod mentődjön.',
  'editTrip.currencyReadonly':
    'A költségvetés pénznemét a Költségek fülön lehet módosítani.',
  'editTrip.currencyLink': 'A Költségek fül megnyitása',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Véglegesen törlöd ezt: „{title}”?',
  'deleteTrip.description':
    'Nincs visszavonás és nincs kuka. Az archiválás kiveszi az utazást a listából anélkül, hogy elveszne.',
  'deleteTrip.reading': 'Az utazás tartalmának beolvasása',
  'deleteTrip.errorTitle': 'Ez nem töltődött be',
  'deleteTrip.summaryError':
    'Nem sikerült beolvasni, mit tartalmaz ez az utazás.',
  'deleteTrip.confirmLabel': 'A megerősítéshez írd be az utazás nevét',
  'deleteTrip.deleting': 'Utazás törlése',
  'deleteTrip.deleted': 'Utazás törölve',
  'deleteTrip.failed': 'Az utazást nem sikerült törölni',
  'deleteTrip.carried.reservations': {
    one: 'foglalás',
    other: 'foglalás',
  },
  'deleteTrip.carried.transports': {
    one: 'közlekedés',
    other: 'közlekedés',
  },
  'deleteTrip.carried.expenses': {
    one: 'kiadás',
    other: 'kiadás',
  },
  'deleteTrip.carried.files': {
    one: 'fájl',
    other: 'fájl',
  },
  'deleteTrip.carried.members': {
    one: 'fő',
    other: 'fő',
  },
  'copyTrip.title': '„{title}” másolása',
  'copyTrip.nameLabel': 'A másolat neve',
  'copyTrip.titleRequired': 'Adj nevet a másolatnak.',
  'copyTrip.datesLabel': 'Dátumok',
  'copyTrip.datesTogether': 'Add meg mindkét dátumot, vagy töröld mindkettőt.',
  'copyTrip.clearDates': 'Másolás dátumok nélkül',
  'copyTrip.carries':
    'A napok, a helyek és a jegyzetek átkerülnek. A foglalások, a pénz, a fájlok és az emberek nem.',
  'copyTrip.shorter':
    'Ez rövidebb az eredetinél. A fölös napok helyei az ötletek közé kerülnek, a jegyzeteik pedig elvesznek.',
  'copyTrip.submit': 'Utazás másolása',
  'copyTrip.copying': 'Az utazás másolása folyamatban',
  'copyTrip.cancel': 'Mégse',
  'copyTrip.started': '„{title}” másolása folyamatban',
  'copyTrip.errorTitle': 'Ez nem másolódott át',
  'copyTrip.error':
    'Az utazást nem sikerült lemásolni. Próbáld újra kis idő múlva.',

  'trips.error': 'Az utazásaid nem töltődtek be',
  'trips.eyebrow': 'Munkaterület',
  'trips.nothingPlanned': 'Még semmi sincs betervezve',
  'trips.search': 'Utazások keresése',
  'trips.atLimit.title': 'Elfogyott minden utazás, amit a csomagod engedélyez',
  'trips.atLimit.action': 'Csomagok összevetése',
  'trips.noMatch.title': 'Erre a szűrőre semmi nem illik',
  'trips.noMatch.body':
    'Próbálj más szakaszt, töröld a keresést, vagy nézd meg az archívumot.',
  'trips.noMatch.action': 'Szűrők törlése',
  'trips.empty.body':
    'Egy utazás tartja a napi tervet, a térképet, a foglalásokat, a csomaglistákat és a pénzt. Kezdj egyet, a többi jön magától.',
  'trips.next.title': 'Valahová azután',
  'trips.next.body':
    'Kezdj egy utazást, és a planned.travel minden dátumhoz napot készít, készen arra, amit elmentettél.',
  'trips.savedPlaces': 'Mentett helyek',
  'trips.filter.all': 'Mind',
  'trips.filter.favourites': 'Kedvencek',
  'trips.view.label': 'Elrendezés',
  'trips.view.grid': 'Rács',
  'trips.view.list': 'Lista',
  'trips.card.favourite': 'Kedvenc',
  'trips.card.noDestination': 'Úti cél még nincs',
  'trips.card.noDates': 'Dátumok még nincsenek',
  'trips.card.startsIn': '{days} nap múlva',
  'trips.card.days': '{days} n',
  'trips.card.copying': 'Másolás',
  'trips.card.copyingLabel': 'A(z) {title} még másolás alatt áll',
  'trips.card.copyingReason': 'Várd meg, amíg a másolás befejeződik.',
  'metric.trips': 'Utazások',
  'metric.places': 'Helyek',
  'metric.members': 'Tagok',
  'metric.files': 'Fájlok',
  'metric.storage_bytes': 'Tárhely',
  'metric.collections': 'Gyűjtemények',
  'metric.journeys': 'Naplók',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Ez nem töltődött be',
  'error.body':
    'Semmi nem veszett el. Próbálja újra, és ha továbbra is előfordul, az alábbi részletet küldje el nekünk.',
  'error.retry': 'Újrapróbálkozás',
  'error.dashboard': 'Vissza az irányítópulthoz',
  'error.reported': 'Értesültünk róla, és már vizsgáljuk.',
  'error.reference': 'Hivatkozási szám',
  'error.feedback.open': 'Írja meg, mi történt',
  'error.feedback.label': 'Mit csinált, amikor ez történt?',
  'error.feedback.send': 'Küldés',
  'error.feedback.sent': 'Köszönjük — sokat segít.',
  'error.feedback.failed':
    'Nem sikerült elküldeni. A fenti hivatkozás így is eljut hozzánk.',
  'error.root': 'Letértünk az útról',
  'error.session': 'Megváltozott a munkaterülethez való hozzáférése',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Probléma jelentése',
  'feedback.formTitle': 'Probléma jelentése',
  'feedback.messageLabel': 'Mi a hiba, vagy min kellene változtatni?',
  'feedback.messagePlaceholder': 'Mire számítottál, és mi történt helyette?',
  'feedback.emailLabel': 'E-mail-cím',
  'feedback.emailPlaceholder': 'anna@example.com',
  'feedback.isRequiredLabel': '(kötelező)',
  'feedback.submitButtonLabel': 'Jelentés küldése',
  'feedback.cancelButtonLabel': 'Mégse',
  'feedback.confirmButtonLabel': 'Megerősítés',
  'feedback.addScreenshotButtonLabel': 'Képernyőkép hozzáadása',
  'feedback.removeScreenshotButtonLabel': 'Képernyőkép eltávolítása',
  'feedback.highlightToolText': 'Kiemelés',
  'feedback.hideToolText': 'Elrejtés',
  'feedback.successMessageText': 'Köszönjük — megkaptuk a jelentésed.',
  'feedback.errorEmptyMessageText':
    'Először írj egy mondatot — az üres jelentés semmit nem mond nekünk.',
  'feedback.errorTimeoutText':
    'Ez túl sokáig tart, és nem tudjuk megerősíteni, hogy a jelentés elment.',
  'feedback.errorForbiddenText': 'Ez az oldal nem küldhet jelentéseket.',
  'feedback.errorGenericText':
    'Nem sikerült elküldeni. Ellenőrizd a kapcsolatot, és hogy nem szól-e közbe egy reklámblokkoló.',

  'notFound.eyebrow': '404-es hiba',
  'notFound.title': 'Ez az oldal nincs a térképen',
  'notFound.body':
    'Lehet, hogy a link elavult, vagy az utazás, amelyre mutatott, átkerült vagy törlődött.',
  'notFound.trips': 'Összes utazás',
  'notFound.rootBody':
    'Végigkerestük az egész útvonalat. Lehet, hogy elírás van a címben, vagy az oldal azóta továbbállt.',
  'notFound.home': 'Vissza a főoldalra',
  'notFound.plans': 'Csomagjaink megtekintése',

  'session.noWorkspace':
    'A fiókja még nincs munkaterülethez kötve. Jelentkezzen ki, majd újra be, hogy a beállítás befejeződjön.',
  'session.membershipRemoved': 'A munkaterületi tagságát megszüntették.',
  'session.workspaceChanged':
    'A munkaterületet egy másik lapon vagy ablakban megváltoztatták. Semmi sem lett mentve.',
  'session.workspaceChangedTitle':
    'A munkaterület megváltozott egy másik lapon',
  'session.workspaceChangedBody':
    'Ez a lap ezt a munkaterületet mutatja: {name}. A munkaterületet azonban egy másik lapon vagy ablakban megváltoztatták. Semmi sem lett mentve.',
  'session.openCurrentWorkspace': 'Az aktuális munkaterület megnyitása',
  'session.workspaceChangedDismiss': 'Most nem',
} satisfies TranslationOf<typeof En>

export default messages
