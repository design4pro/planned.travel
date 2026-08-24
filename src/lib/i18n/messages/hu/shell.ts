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

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Megjelenés',
  'theme.light': 'Világos',
  'theme.dark': 'Sötét',
  'theme.system': 'Rendszer szerint',
  'theme.state.light': 'világos',
  'theme.state.dark': 'sötét',
  'theme.state.system': 'a rendszert követi',
  'theme.trigger': 'Téma: {state}. Téma módosítása',

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
  'notification.trip.invited.title': 'Meghívták a {tripTitle} utazásra',
  'notification.trip.invited.body': '{actorName} hozzáadta Önt az utazáshoz.',
  'notification.trip.updated.title': 'A {tripTitle} frissült',
  'notification.trip.updated.body': '{actorName} módosította a tervet.',
  'notification.trip.member_added.title':
    '{memberName} csatlakozott a {tripTitle} utazáshoz',
  'notification.trip.member_added.body':
    'Látja az útitervet, a foglalásokat és a költségeket.',
  'notification.trip.member_removed.title':
    '{memberName} kilépett a {tripTitle} utazásból',
  'notification.trip.member_removed.body':
    'Az utazáshoz való hozzáférése megszűnt.',
  'notification.trip.starting_soon.title': {
    one: 'A {tripTitle} {days} nap múlva indul',
    other: 'A {tripTitle} {days} nap múlva indul',
  },
  'notification.trip.starting_soon.body':
    'Ideje átnézni a csomaglistát és a foglalásokat.',
  'notification.reservation.reminder.title': 'A {title} hamarosan következik',
  'notification.reservation.reminder.body':
    'Az időpontot és a visszaigazoló kódot a foglalásnál találja.',
  'notification.reservation.confirmed.title': 'A {title} megerősítve',
  'notification.reservation.confirmed.body':
    'A foglalás megerősítettként szerepel a {tripTitle} utazásban.',
  'notification.expense.added.title': '{actorName} költséget rögzített',
  'notification.expense.added.body': '{title} a {tripTitle} utazásban.',
  'notification.expense.settled.title': '{actorName} kiegyenlítette a számlát',
  'notification.expense.settled.body':
    'A {tripTitle} utazás egyenlege ki van fizetve.',
  'notification.list.assigned.title': '{actorName} Önhöz rendelt egy tételt',
  'notification.list.assigned.body': '{title} a {tripTitle} utazásban.',
  'notification.collab.message.title':
    '{actorName} írt a {tripTitle} utazásban',
  'notification.collab.message.body': '„{preview}”',
  'notification.collab.poll.title': 'Szavazás indult a {tripTitle} utazásban',
  'notification.collab.poll.body': '„{question}”',
  'notification.organization.invited.title':
    'Meghívták a {organizationName} munkaterületre',
  'notification.organization.invited.body':
    'Fogadja el, és csatlakozik a munkaterülethez és mindenhez, amit ott megosztanak.',
  'notification.journey.published.title': 'A {title} megjelent',
  'notification.journey.published.body':
    'A linkkel mostantól bárki elolvashatja a naplót.',
  'notification.billing.plan_changed.title': 'Megváltozott a csomagja',
  'notification.billing.plan_changed.body':
    'A {organizationName} mostantól a {plan} csomagot használja.',
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
  'dashboard.hero.travellersHint': 'a munkaterületen',
  'dashboard.hero.dates': 'Utazás dátumai',
  'dashboard.hero.datesUnset': 'Nincs megadva',
  'dashboard.hero.datesHint': { one: '{days} nap', other: '{days} nap' },
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
  'dashboard.storage.count': '{used} a {limit} keretből',
  'dashboard.storage.files': {
    one: '{files} fájl az összes utazásban, a fotókkal és a jegyekkel együtt.',
    other:
      '{files} fájl az összes utazásban, a fotókkal és a jegyekkel együtt.',
  },
  'dashboard.storage.more': 'Több helyre van szüksége?',
  'dashboard.storage.plans': 'Csomagok megtekintése',

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
  'error.unknown': 'A kérés még befejezés előtt elbukott.',
  'error.root': 'Letértünk az útról',
  'error.session': 'Megváltozott a munkaterülethez való hozzáférése',

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
} satisfies TranslationOf<typeof En>

export default messages
