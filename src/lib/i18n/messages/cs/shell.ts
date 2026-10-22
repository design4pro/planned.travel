/**
 * Everything the application shell says, in Czech.
 *
 * Authored from `../en/shell.ts` (`docs/SPEC.md` §8.9 — never from another
 * product's catalogue). `TranslationOf<typeof En>` is the key contract;
 * `__tests__/parity.test.ts` checks placeholders, plural branches and that no
 * value is left in English.
 *
 * **Plural.** Czech uses `one` (1), `few` (2–4), `other` (0 and 5 up) and
 * `many` **for fractions only**, so every `many` branch carries the genitive
 * singular of a decimal ("1,5 dne").
 *
 * **Names of the modules.** `Atlas` is the world map that records where a
 * traveller has been; Czech has no one-word noun a reader would recognise in a
 * nav pill, so it is named for what it is — „Mapa světa“, shortened to „Mapa“.
 * `Journey` is the travel journal, so „Deník“; `Vacay` is time off, so
 * „Dovolená“.
 *
 * **Two senses of „plan“.** English `Plan` is both an itinerary and a
 * subscription. Czech keeps „plán“ for the itinerary and says „tarif“ wherever
 * the sentence is about what the workspace pays for.
 *
 * **Gender.** A Czech past participle agrees with its subject and a
 * notification names a person whose gender we do not know, so nothing below
 * agrees with `{actorName}`: the copy uses a verbal noun („Vyrovnání od …“) or
 * the present tense, both genderless.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Hlavní sekce',
  'nav.mobile': 'Sekce',
  'nav.dashboardLink': 'Přehled planned.travel',
  'nav.homeLink': 'Domovská stránka planned.travel',
  'nav.newTrip': 'Nová cesta',

  'nav.trips': 'Moje cesty',
  'nav.trips.short': 'Cesty',
  'nav.vacay': 'Dovolená',
  'nav.vacay.short': 'Dovolená',
  'nav.atlas': 'Mapa světa',
  'nav.atlas.short': 'Mapa',
  'nav.journey': 'Deník',
  'nav.journey.short': 'Deník',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Sekce cesty',
  'trip.nav.back': 'Cesty',
  'trip.nav.share': 'Sdílet',
  'trip.nav.shareLabel': 'Sdílet tuto cestu',
  'trip.tab.plan': 'Plán',
  'trip.tab.transports': 'Doprava',
  'trip.tab.book': 'Rezervace',
  'trip.tab.lists': 'Seznamy',
  'trip.tab.costs': 'Náklady',
  'trip.tab.files': 'Soubory',
  'trip.tab.collab': 'Spolupráce',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Nabídka účtu',
  'account.settings': 'Nastavení',
  'account.billing': 'Tarif a platby',
  'account.admin': 'Správa',
  'account.signOut': 'Odhlásit se',
  'account.signingOut': 'Odhlašování…',
  'account.signOutFailed': 'Odhlášení se nepovedlo',
  'account.signOutFailedBody': 'Zkontrolujte připojení a zkuste to znovu.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Prostor',
  'workspace.switched': 'Přepnuto na {name}',
  'workspace.switchFailed': 'Prostor se nepodařilo přepnout',
  'workspace.switchFailedBody': 'Zkontrolujte připojení a zkuste to znovu.',
  'workspace.switchUnconfirmedBody':
    'Aktivní pracovní prostor se nepodařilo ověřit. Před pokračováním znovu načtěte stránku.',
  'workspace.switchRateLimitedBody':
    'Příliš mnoho přepnutí pracovního prostoru. Chvíli počkejte a zkuste to znovu.',
  'workspace.create': 'Vytvořit prostor',
  'workspace.createTitle': 'Vytvoření prostoru',
  'workspace.createDescription':
    'Samostatný prostor s vlastními cestami, místy a lidmi. Začíná v tarifu Zdarma a nesdílí tarif prostoru, ve kterém jste.',
  'workspace.createName': 'Název prostoru',
  'workspace.createUpgrade':
    '„{workspace}“ je v tarifu Zdarma a další prostor může vytvořit jen prostor s placeným tarifem. Pokud má některý z vašich dalších prostorů placený tarif, přepněte na něj a vytvořte prostor odtud. Jinak u prostoru „{workspace}“ přejděte na placený tarif.',
  'workspace.createLimitReached':
    'Dosáhli jste největšího počtu prostorů, do kterých může patřit jeden účet.',
  'workspace.createRoleRequired':
    'Prostor může vytvořit jen jeho správce. Požádejte správce tohoto prostoru nebo přepněte na prostor, který spravujete.',
  'workspace.createFailed': 'Prostor se nepodařilo vytvořit',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Vzhled',
  'theme.light': 'Světlý',
  'theme.dark': 'Tmavý',
  'theme.system': 'Podle systému',
  'theme.state.light': 'světlý',
  'theme.state.dark': 'tmavý',
  'theme.state.system': 'podle systému',
  'theme.trigger': 'Téma: {state}. Změnit téma',
  'language.trigger': 'Jazyk: {language}. Změnit jazyk',
  'language.hint':
    'Pamatuje se na tomto zařízení. Po přihlášení platí jazyk nastavený ve vašem účtu; změnit jej můžete v Nastavení.',
  'language.announce': 'Jazyk byl změněn na {language}',
  'language.notApplied':
    'Tento prohlížeč vaši volbu nezachoval. Povolte pro tento web cookies a vyberte jazyk znovu.',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Oznámení, nic nepřečteného',
  'bell.unread': {
    one: 'Oznámení, {unread} nepřečtené',
    few: 'Oznámení, {unread} nepřečtená',
    many: 'Oznámení, {unread} nepřečteného',
    other: 'Oznámení, {unread} nepřečtených',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Doručené',
  'inbox.title': 'Oznámení',
  'inbox.error': 'Vaše doručené se nenačetly',
  'inbox.allRead': 'Vše přečteno',
  'inbox.unread': {
    one: '{unread} nepřečtená zpráva',
    few: '{unread} nepřečtené zprávy',
    many: '{unread} nepřečtené zprávy',
    other: '{unread} nepřečtených zpráv',
  },
  'inbox.markAll': 'Označit přečtené',
  'inbox.markingAll': 'Označuji vše jako přečtené',
  'inbox.cleared': 'Vyčištěno',
  'inbox.markAllFailed': 'Nepovedlo se označit vše',
  'inbox.retryHint': 'Zkontrolujte připojení a zkuste to znovu.',
  'inbox.filter.all': 'Vše',
  'inbox.filter.unread': 'Nepřečtené',
  'inbox.waiting': {
    one: '{invitations} pozvánka čeká',
    few: '{invitations} pozvánky čekají',
    many: '{invitations} pozvánky čeká',
    other: '{invitations} pozvánek čeká',
  },
  'inbox.empty.title': 'Doručené jsou prázdné',
  'inbox.empty.body':
    'Pozvánky na cesty, změny v plánu, upomínky k rezervacím i vyrovnané zůstatky — všechno přichází sem.',
  'inbox.empty.action': 'Zpět na přehled',
  'inbox.emptyUnread.title': 'Nic nepřečteného',
  'inbox.emptyUnread.body':
    'Přečteno je všechno. Přepněte na Vše a projděte si historii.',
  'inbox.emptyUnread.action': 'Zobrazit vše',
  'inbox.row.new': 'Nové',
  'inbox.row.accepted': 'Přijato',
  'inbox.row.declined': 'Odmítnuto',
  'inbox.row.open': 'Otevřít',
  'inbox.row.markRead': 'Přečteno',
  'inbox.row.markingRead': 'Označuji jako přečtené',
  'inbox.row.markReadFailed': 'Nepovedlo se to označit jako přečtené',
  'inbox.preferences':
    'Vyberte, co z toho má chodit do doručených, na e-mail a do telefonu.',
  'inbox.preferencesAction': 'Nastavení oznámení',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Máte pozvánku na {tripTitle}',
  'notification.trip.invited.body': 'Pozvánka od {actorName}.',
  'notification.trip.updated.title': 'Změny u cesty {tripTitle}',
  'notification.trip.updated.body': 'Změna plánu od {actorName}.',
  'notification.trip.member_added.title':
    '{memberName} se přidává k {tripTitle}',
  'notification.trip.member_added.body':
    'Vidí itinerář, rezervace i společné peníze.',
  'notification.trip.member_removed.title': '{memberName} opouští {tripTitle}',
  'notification.trip.member_removed.body': 'Přístup k této cestě skončil.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} začíná za {days} den',
    few: '{tripTitle} začíná za {days} dny',
    many: '{tripTitle} začíná za {days} dne',
    other: '{tripTitle} začíná za {days} dní',
  },
  'notification.trip.starting_soon.body':
    'Je čas zkontrolovat seznam věcí a rezervace.',
  'notification.trip.copied.title': '{tripTitle} je připravená',
  'notification.trip.copied.body': {
    one: 'Přeneseno: {days} den',
    few: 'Přeneseno: {days} dny',
    many: 'Přeneseno: {days} dne',
    other: 'Přeneseno: {days} dní',
  },
  'notification.trip.copied.places': {
    one: '{places} místo',
    few: '{places} místa',
    many: '{places} místa',
    other: '{places} míst',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} poznámka vynechána',
    few: '{dropped} poznámky vynechány',
    many: '{dropped} poznámky vynechány',
    other: '{dropped} poznámek vynecháno',
  },
  'notification.trip.copyFailed.title': '{tripTitle} se nepodařilo zkopírovat',
  'notification.trip.copyFailed.body':
    'Nic se neztratilo. Zkuste to znovu z originálu.',
  'notification.reservation.reminder.title': '{title} se blíží',
  'notification.reservation.reminder.body':
    'Zkontrolujte čas a potvrzovací kód u rezervace.',
  'notification.reservation.confirmed.title': '{title} je potvrzeno',
  'notification.reservation.confirmed.body':
    'Rezervace u cesty {tripTitle} je označená jako potvrzená.',
  'notification.expense.added.title': 'Nový výdaj od {actorName}',
  'notification.expense.added.body': '{title} u cesty {tripTitle}.',
  'notification.expense.settled.title': 'Vyrovnání od {actorName}',
  'notification.expense.settled.body':
    'Zůstatek u cesty {tripTitle} je zaplacený.',
  'notification.list.assigned.title': 'Úkol od {actorName}',
  'notification.list.assigned.body': '{title} u cesty {tripTitle}.',
  'notification.collab.message.title':
    'Nová zpráva od {actorName} v {tripTitle}',
  'notification.collab.message.body': '„{preview}“',
  'notification.collab.poll.title': 'U cesty {tripTitle} běží hlasování',
  'notification.collab.poll.body': '„{question}“',
  'notification.organization.invited.title':
    'Máte pozvánku do {organizationName}',
  'notification.organization.invited.body':
    'Přijměte ji a vstupte do prostoru i ke všemu, co je v něm sdílené.',
  'notification.journey.published.title': 'Zveřejněno: {title}',
  'notification.journey.published.body':
    'Deník si teď přečte každý, kdo má odkaz.',
  'notification.billing.plan_changed.title': 'Změna tarifu',
  'notification.billing.plan_changed.body':
    '{organizationName} má nyní tarif {plan}.',
  'notification.billing.invoice_paid.title': 'Platba přijata',
  'notification.billing.invoice_paid.body':
    'Poslední faktura pro {organizationName} je zaplacená.',
  'notification.billing.payment_failed.title': 'Platba neproběhla',
  'notification.billing.payment_failed.body':
    '{organizationName} má platbu po splatnosti. Aktualizujte platební metodu, ať tarif zůstane.',
  'notification.fallback.title': 'Ve vašem prostoru se něco změnilo',
  'notification.fallback.body': 'Otevřete cestu a podívejte se co.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Přehled se nenačetl',
  'dashboard.blank.title': 'Tady začíná vaše další cesta',
  'dashboard.blank.body':
    'Vytvořte cestu, na mapu vysypte místa, která chcete vidět, a planned.travel kolem nich postaví plán den po dni.',
  'dashboard.blank.action': 'Naplánovat cestu',
  'dashboard.blank.secondary': 'Zobrazit mapu světa',

  'dashboard.upNext': 'Nejbližší cesta',
  'dashboard.openPlan': 'Otevřít plán',
  'dashboard.hero.travellers': 'Cestující',
  'dashboard.hero.datesMissing': 'Zadejte termín a vzniknou dny',
  'dashboard.hero.startsIn': 'Start za',
  'dashboard.hero.started': 'Start byl',
  'dashboard.hero.today': 'Dnes',
  'dashboard.hero.startUnknown': 'bez data startu',
  'dashboard.hero.startToday': 'ať se cesta vydaří',
  'dashboard.hero.startPast': {
    one: 'den zpět',
    few: 'dny zpět',
    many: 'dne zpět',
    other: 'dní zpět',
  },
  'dashboard.hero.startFuture': {
    one: 'den',
    few: 'dny',
    many: 'dne',
    other: 'dní',
  },
  'dashboard.hero.nights': 'Noci',
  'dashboard.hero.companionsHint': 'na této cestě',
  'dashboard.hero.progress': 'Probíhá',
  'dashboard.hero.places': 'Místa',
  'dashboard.hero.placesNone': 'na mapě ještě nic',
  'dashboard.hero.placesHint': 'na mapě',

  'dashboard.stat.countries': 'Navštívené země',
  'dashboard.stat.countriesUnit': 'z {total}',
  'dashboard.stat.countriesNone': 'Označte zemi a mapa světa začne',
  'dashboard.stat.visits': {
    one: '{visits} zapsaná návštěva',
    few: '{visits} zapsané návštěvy',
    many: '{visits} zapsané návštěvy',
    other: '{visits} zapsaných návštěv',
  },
  'dashboard.stat.trips': 'Cesty celkem',
  'dashboard.stat.tripsCaption':
    '{planning} v plánování · {booked} zarezervováno',
  'dashboard.stat.places': 'Místa na mapě',
  'dashboard.stat.placesNone': 'Na mapě ještě nic není',
  'dashboard.stat.placesAcross': {
    one: 'na {trips} cestě',
    few: 'na {trips} cestách',
    many: 'na {trips} cesty',
    other: 'na {trips} cestách',
  },
  'dashboard.stat.bookings': 'Potvrzené rezervace',
  'dashboard.stat.bookingsNone': 'Žádná rezervace se neblíží',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} rezervace se blíží',
    few: '{bookings} rezervace se blíží',
    many: '{bookings} rezervace se blíží',
    other: '{bookings} rezervací se blíží',
  },

  'dashboard.trips.label': 'Vaše cesty',
  'dashboard.trips.all': 'Všechny cesty',
  'dashboard.trips.empty.title': 'Zatím žádné cesty',
  'dashboard.trips.empty.body':
    'Všechno, co naplánujete, se objeví tady — nejnovější nahoře.',
  'dashboard.trips.empty.action': 'Vytvořit cestu',

  'dashboard.bookings.label': 'Nejbližší rezervace',
  'dashboard.bookings.empty.title': 'Zatím nic zarezervováno',
  'dashboard.bookings.empty.body':
    'Potvrzené noclehy, stoly a vstupenky se objeví tady, jak se budou blížit jejich termíny.',

  'dashboard.pipeline.label': 'Fáze cest',
  'dashboard.pipeline.empty': 'Nic v běhu. První cesta to rozdělí po fázích.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} oblíbená',
    few: '{favourites} oblíbené',
    many: '{favourites} oblíbené',
    other: '{favourites} oblíbených',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} archivovaná cesta',
    few: '{archived} archivované cesty',
    many: '{archived} archivované cesty',
    other: '{archived} archivovaných cest',
  },

  'dashboard.storage.label': 'Úložiště',
  'dashboard.storage.count': '{used} z {limit}',
  'dashboard.storage.files': {
    one: '{files} soubor ze všech cest, včetně fotek a vstupenek.',
    few: '{files} soubory ze všech cest, včetně fotek a vstupenek.',
    many: '{files} souboru ze všech cest, včetně fotek a vstupenek.',
    other: '{files} souborů ze všech cest, včetně fotek a vstupenek.',
  },
  'dashboard.storage.more': 'Potřebujete víc místa?',
  'dashboard.storage.plans': 'Zobrazit tarify',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Přehled',
  'dashboard.widgets.choose': 'Vybrat widgety',
  'dashboard.widgets.description':
    'Widgety, které si necháváte vedle nástěnky.',
  'dashboard.clock.label': 'Světový čas',
  'dashboard.clock.add': 'Přidat časové pásmo',
  'dashboard.clock.search': 'Hledat města a oblasti',
  'dashboard.clock.noMatches': 'Žádné časové pásmo s tímto názvem',
  'dashboard.clock.remove': 'Odebrat {zone}',
  'dashboard.clock.offset': '{offset} oproti vašemu času',
  'dashboard.clock.here': 'Váš vlastní čas',
  'dashboard.clock.empty.title': 'Žádná připnutá časová pásma',
  'dashboard.clock.empty.body':
    'Připněte si místo a čtěte jeho čas vedle svého.',
  'dashboard.clock.unknown.title': 'Toto zařízení nezná {zone}',
  'dashboard.clock.unknown.body':
    'Jeho čas zde nelze načíst. Odeberte řádek a tím to vyřešíte.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Konzole správce se nenačetla',
  'admin.denied.title': 'Sem se dostanou jen správci prostoru',
  'admin.denied.body':
    'Pokud to potřebujete, požádejte vlastníka nebo správce tohoto prostoru o změnu své funkce.',
  'admin.denied.action': 'Zpět na přehled',
  'admin.eyebrow': 'Správa prostoru',
  'admin.description': 'Tarif {plan} · vytvořeno {date}',
  'admin.createdUnknown': 'nedávno',
  'admin.workspaceSettings': 'Nastavení prostoru',
  'admin.billing': 'Tarif a platby',

  'admin.invitations.title': {
    one: '{invitations} pozvánka stále otevřená',
    few: '{invitations} pozvánky stále otevřené',
    many: '{invitations} pozvánky stále otevřené',
    other: '{invitations} pozvánek stále otevřených',
  },
  'admin.invitations.body':
    'Každá otevřená pozvánka zabírá jedno z míst, která váš tarif platí.',
  'admin.invitations.action': 'Projít pozvánky',

  'admin.stat.members': 'Členové',
  'admin.stat.membersCaption': {
    one: '{invitations} pozvánka čeká',
    few: '{invitations} pozvánky čekají',
    many: '{invitations} pozvánky čeká',
    other: '{invitations} pozvánek čeká',
  },
  'admin.stat.storage': 'Úložiště',
  'admin.stat.storageUnit': 'z {limit}',
  'admin.stat.storageUnlimited': 'bez limitu',
  'admin.stat.storageCaption': 'Soubory, fotky a exporty',
  'admin.stat.audit': 'Záznamy auditu',
  'admin.stat.auditCaption': 'Nejnovější aktivita je níže',
  'admin.stat.plan': 'Tarif',
  'admin.stat.planCaption': 'Limity se hlídají na hranici repozitářů',

  'admin.quotas.label': 'Limity',
  'admin.quotas.count': {
    one: '{metrics} veličina',
    few: '{metrics} veličiny',
    many: '{metrics} veličiny',
    other: '{metrics} veličin',
  },
  'admin.quotas.unlimited': 'Bez limitu',
  'admin.quotas.value': '{used} z {limit}',

  'admin.members.label': 'Členové',
  'admin.members.table': 'Členové tohoto prostoru',
  'admin.members.person': 'Osoba',
  'admin.members.role': 'Funkce',
  'admin.members.joined': 'Členem od',
  'admin.members.role.label': 'Role uživatele {name}',
  'admin.members.role.saved': '{name} má nyní roli: {role}.',
  'admin.members.role.impersonated': 'Roli nelze změnit, dokud jednáte jako jiný účet.',
  'admin.members.role.notPermitted':
    'Tuto změnu provést nemůžete. Roli vlastníka může udělit nebo změnit jen vlastník.',
  'admin.members.role.lastOwner':
    'Toto je jediný vlastník pracovního prostoru. Nejdřív jmenujte jiného vlastníka.',
  'admin.members.role.notFound': 'Tato osoba už v pracovním prostoru není. Seznam byl obnoven.',
  'admin.members.role.failed': 'Roli se nepodařilo změnit. Zkuste to znovu.',
  'admin.members.role.promote.title': 'Udělat z {name} vlastníka?',
  'admin.members.role.promote.body':
    '{name} bude mít stejnou moc jako vy: fakturaci, členy a nastavení. Vlastník může snížit roli nebo odebrat kteréhokoli jiného vlastníka, i vás.',
  'admin.members.role.promote.confirm': 'Udělat vlastníkem',
  'admin.members.role.promote.cancel': 'Zrušit',

  'admin.activity.label': 'Nedávná aktivita',
  'admin.activity.empty.title': 'Zatím nic zaznamenáno',
  'admin.activity.empty.body':
    'Každý zápis, na kterém záleží, se do auditu přidá v okamžiku, kdy nastane.',
  'admin.activity.workspace': 'prostor sám',
  'admin.actions.label': 'Nejčastější akce',
  'admin.actions.count': {
    one: '{actions} akce',
    few: '{actions} akce',
    many: '{actions} akce',
    other: '{actions} akcí',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Koncept',
  'tripStatus.planning': 'Plánuje se',
  'tripStatus.booked': 'Zarezervováno',
  'tripStatus.active': 'Aktivní',
  'tripStatus.completed': 'Dokončeno',
  'tripStatus.archived': 'Archivováno',

  'bookingStatus.none': 'Bez rezervace',
  'bookingStatus.pending': 'Čeká',
  'bookingStatus.confirmed': 'Potvrzeno',
  'bookingStatus.cancelled': 'Zrušeno',
  'bookingStatus.completed': 'Hotovo',

  'bookingType.accommodation': 'Nocleh',
  'bookingType.restaurant': 'Stůl',
  'bookingType.activity': 'Aktivita',
  'bookingType.tour': 'Výlet',
  'bookingType.ticket': 'Vstupenka',
  'bookingType.transport': 'Přeprava',
  'bookingType.other': 'Rezervace',

  'role.owner': 'Vlastník',
  'role.admin': 'Správce',
  'role.member': 'Člen',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} cesta',
    few: '{value} cesty',
    many: '{value} cesty',
    other: '{value} cest',
  },
  'trips.count.favourites': {
    one: '{value} oblíbená',
    few: '{value} oblíbené',
    many: '{value} oblíbené',
    other: '{value} oblíbených',
  },
  'trips.count.archived': {
    one: '{value} archivovaná',
    few: '{value} archivované',
    many: '{value} archivované',
    other: '{value} archivovaných',
  },
  'trips.atLimit.body':
    'Váš tarif zahrnuje {trips}. Archivujte některou dokončenou nebo přejděte na vyšší tarif, abyste měli více otevřených zároveň.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Nový deník',
  'newJourney.title': 'Začněte deník',
  'newJourney.description':
    'Deník je psaná stránka cesty — zápisy v pořadí dat, s fotkami a počasím, na které si vzpomínáte.',
  'newJourney.titlePlaceholder': 'Dva týdny v Kjótu',
  'newJourney.subtitle': 'Podtitul',
  'newJourney.subtitleHint': 'Jeden řádek pod titulem, na obálce.',
  'newJourney.subtitlePlaceholder': 'Chrámy, vlaky a příliš mnoho matchy',
  'newJourney.trip': 'Podle cesty',
  'newJourney.tripHint': 'Nepovinné — váže vyprávění k jeho plánu.',
  'newJourney.tripNone': 'Bez vazby na cestu',
  'newJourney.datesError': 'Datum konce je před začátkem.',
  'newJourney.submit': 'Vytvořit deník',
  'newJourney.creating': 'Vytváří se deník',
  'newJourney.created': 'Deník začal',
  'newJourney.createdBody': 'Přidejte první zápis a začněte vyprávět.',
  'newJourney.error': 'Deník nešlo vytvořit. Zkuste to za chvíli znovu.',
  'newCollection.trigger': 'Nová kolekce',
  'newCollection.title': 'Začněte kolekci',
  'newCollection.description':
    'Místo pro místa, která najdete, než budete vědět, ke které cestě patří.',
  'newCollection.namePlaceholder': 'Káva, za kterou se jde přes celé město',
  'newCollection.descriptionHint': 'Co sem patří a co ne.',
  'newCollection.submit': 'Vytvořit kolekci',
  'newCollection.creating': 'Vytváří se kolekce',
  'newCollection.created': 'Kolekce vytvořena',
  'newCollection.createdBody': 'Začněte do ní ukládat místa.',
  'newCollection.error': 'Kolekci nešlo vytvořit. Zkuste to za chvíli znovu.',

  'newTrip.title': 'Začněte novou cestu',
  'newTrip.description':
    'Stačí název. Data postaví plán den po dni a ostatní může počkat, až to budete vědět.',
  'newTrip.name': 'Název cesty',
  'newTrip.namePlaceholder': 'Kjóto v době rozkvětu sakur',
  'newTrip.destination': 'Cíl',
  'newTrip.destinationHint': 'Město, region, nebo celá trasa.',
  'newTrip.destinationPlaceholder': 'Kjóto, Japonsko',
  'newTrip.departure': 'Odjezd',
  'newTrip.return': 'Návrat',
  'newTrip.returnError': 'Datum návratu je před odjezdem.',
  'newTrip.currency': 'Měna rozpočtu',
  'newTrip.currencyHint': 'V ní se sčítá každý výdaj této cesty.',
  'newTrip.currencySearch': 'Hledat podle kódu nebo názvu',
  'newTrip.currencyEmpty': 'Žádná měna neodpovídá.',
  'newTrip.currencyFavourites': 'Oblíbené',
  'newTrip.currencyAll': 'Všechny měny',
  'newTrip.summary': 'Shrnutí',
  'newTrip.summaryPlaceholder': 'Dva týdny chrámů, vlaků a ramenu.',
  'newTrip.duration': 'Délka ve dnech',
  'newTrip.durationHint': 'Bez dat cesta začíná tolika dny bez data.',
  'newTrip.durationDerived': 'Vypočítáno z obou dat.',
  'newTrip.reminder': 'Připomenutí před odjezdem',
  'newTrip.reminderNone': 'Žádné',
  'newTrip.reminderBefore': {
    one: '{count} den předem',
    few: '{count} dny předem',
    many: '{count} dne předem',
    other: '{count} dní předem',
  },
  'newTrip.reminderCustom': 'Vlastní',
  'newTrip.reminderCustomDays': 'Dní před odjezdem',
  'newTrip.reminderOn': 'Připomenutí {date}',
  'newTrip.reminderNoDeparture': 'Vyberte datum odjezdu, aby se zobrazil den.',
  'newTrip.submit': 'Vytvořit cestu',
  'newTrip.creating': 'Vytváří se cesta',
  'newTrip.error': 'Cestu nešlo vytvořit. Zkuste to za chvíli znovu.',
  'newTrip.created': 'Cesta vytvořena',
  'newTrip.createdBody': 'Začněte na mapu přidávat místa.',
  'newTrip.coverChoose': 'Přidat titulní obrázek',
  'newTrip.coverChange': 'Změnit titulní obrázek',
  'newTrip.coverHint':
    'Přetáhněte sem obrázek, vložte ho ze schránky nebo vyberte soubor. PNG, JPEG, WebP, AVIF nebo GIF.',
  'newTrip.coverChosen': 'Titulní obrázek: {name}',
  'newTrip.coverRemove': 'Odebrat titulní obrázek',
  'newTrip.coverTypeError':
    'Soubor „{name}“ nelze použít jako titulní obrázek. Vyberte PNG, JPEG, WebP, AVIF nebo GIF.',
  'newTrip.coverSizeError':
    'Soubor „{name}“ je větší než {max}. Vyberte menší obrázek.',
  'newTrip.coverUploading': 'Nahrává se titulní obrázek',
  'newTrip.coverFailedTitle': 'Titulní obrázek se nepřidal',
  'newTrip.coverFailed':
    'Cesta byla vytvořena, ale soubor „{name}“ se nepodařilo nahrát jako titulní obrázek.',
  'newTrip.coverRetry': 'Zkusit znovu',
  'newTrip.coverContinue': 'Otevřít cestu bez titulního obrázku',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Akce pro {title}',
  'tripActions.copy': 'Kopírovat',
  'tripActions.favourite': 'Přidat do oblíbených',
  'tripActions.unfavourite': 'Odebrat z oblíbených',
  'tripActions.edit': 'Upravit',
  'tripActions.archive': 'Archivovat',
  'tripActions.restore': 'Obnovit',
  'tripActions.delete': 'Smazat',
  'tripActions.deleteForGood': 'Smazat natrvalo',
  'tripActions.starFailed': 'Oblíbenou položku se nepodařilo uložit',
  'tripActions.starFallback': 'Cesta je zpátky tak, jak byla.',
  'tripActions.archived': 'Cesta archivována',
  'tripActions.archiveFailed': 'Cestu se nepodařilo archivovat',
  'tripActions.restored': 'Cesta obnovena',
  'tripActions.restoreFailed': 'Cestu se nepodařilo obnovit',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Upravit cestu',
  'editTrip.submit': 'Uložit změny',
  'editTrip.saving': 'Ukládání cesty',
  'editTrip.cancel': 'Zrušit',
  'editTrip.saved': 'Cesta aktualizována',
  'editTrip.errorTitle': 'Neuložilo se to',
  'editTrip.retry': 'Zkusit znovu',
  'editTrip.error': 'Cestu se nepodařilo uložit. Zkuste to za chvíli znovu.',
  'editTrip.coverFailed':
    'Soubor „{name}“ se nepodařilo nahrát jako titulní obrázek. Zatím se neuložilo nic dalšího.',
  'editTrip.coverContinue': 'Uložit bez nového titulního obrázku',
  'editTrip.currencyLocked':
    'Tato cesta už obsahuje ceny, proto tady nejde změnit měnu rozpočtu. Použijte na záložce Náklady tlačítko „Změnit měnu rozpočtu“, nebo nastavte zpět {current} a uložte ostatní změny.',
  'editTrip.currencyReadonly': 'Měna rozpočtu se mění na záložce Náklady.',
  'editTrip.currencyLink': 'Otevřít záložku Náklady',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Smazat „{title}“ nadobro?',
  'deleteTrip.description':
    'Není tu žádné zpět ani koš. Archiv vezme cestu ze seznamu, aniž byste o ni přišli.',
  'deleteTrip.reading': 'Načítáme, co cesta obsahuje',
  'deleteTrip.errorTitle': 'Nenačetlo se to',
  'deleteTrip.summaryError': 'Nepodařilo se načíst, co tato cesta obsahuje.',
  'deleteTrip.confirmLabel': 'Pro potvrzení napište název cesty',
  'deleteTrip.deleting': 'Mazání cesty',
  'deleteTrip.deleted': 'Cesta smazána',
  'deleteTrip.failed': 'Cestu se nepodařilo smazat',
  'deleteTrip.carried.reservations': {
    one: 'rezervace',
    few: 'rezervace',
    many: 'rezervace',
    other: 'rezervací',
  },
  'deleteTrip.carried.transports': {
    one: 'přesun',
    few: 'přesuny',
    many: 'přesunu',
    other: 'přesunů',
  },
  'deleteTrip.carried.expenses': {
    one: 'výdaj',
    few: 'výdaje',
    many: 'výdaje',
    other: 'výdajů',
  },
  'deleteTrip.carried.files': {
    one: 'soubor',
    few: 'soubory',
    many: 'souboru',
    other: 'souborů',
  },
  'deleteTrip.carried.members': {
    one: 'osoba',
    few: 'osoby',
    many: 'osoby',
    other: 'osob',
  },
  'copyTrip.title': 'Kopírovat „{title}“',
  'copyTrip.nameLabel': 'Název kopie',
  'copyTrip.titleRequired': 'Pojmenujte kopii.',
  'copyTrip.datesLabel': 'Termín',
  'copyTrip.datesTogether': 'Nastavte oba termíny, nebo je oba vymažte.',
  'copyTrip.clearDates': 'Kopírovat bez termínu',
  'copyTrip.carries':
    'Dny, místa a poznámky se zkopírují. Rezervace, peníze, soubory a lidé ne.',
  'copyTrip.shorter':
    'To je kratší než originál. Místa z přebývajících dní se přesunou mezi nápady a jejich poznámky zmizí.',
  'copyTrip.submit': 'Kopírovat cestu',
  'copyTrip.copying': 'Kopírování cesty',
  'copyTrip.cancel': 'Zrušit',
  'copyTrip.started': 'Kopíruje se „{title}“',
  'copyTrip.errorTitle': 'Nezkopírovalo se to',
  'copyTrip.error':
    'Cestu se nepodařilo zkopírovat. Zkuste to za chvíli znovu.',

  'trips.error': 'Vaše cesty se nenačetly',
  'trips.eyebrow': 'Prostor',
  'trips.nothingPlanned': 'Zatím nic naplánováno',
  'trips.search': 'Hledat cesty',
  'trips.atLimit.title': 'Vyčerpali jste každou cestu, kterou tarif dovoluje',
  'trips.atLimit.action': 'Porovnat tarify',
  'trips.noMatch.title': 'Tomuto filtru nic neodpovídá',
  'trips.noMatch.body':
    'Zkuste jinou fázi, vymažte hledání nebo se podívejte do archivu.',
  'trips.noMatch.action': 'Zrušit filtry',
  'trips.empty.body':
    'Cesta drží denní plán, mapu, rezervace, seznamy k sbalení a peníze. Začněte jednu a ostatní přijde samo.',
  'trips.next.title': 'Někam dál',
  'trips.next.body':
    'Začněte cestu a planned.travel založí den ke každému datu, připravený na vše, co máte uložené.',
  'trips.savedPlaces': 'Uložená místa',
  'trips.filter.all': 'Vše',
  'trips.filter.favourites': 'Oblíbené',
  'trips.view.label': 'Rozložení',
  'trips.view.grid': 'Mřížka',
  'trips.view.list': 'Seznam',
  'trips.card.favourite': 'Oblíbená',
  'trips.card.noDestination': 'Cíl ještě nezvolen',
  'trips.card.noDates': 'Data ještě nezvolena',
  'trips.card.startsIn': 'za {days} d',
  'trips.card.days': '{days} d',
  'trips.card.copying': 'Kopíruje se',
  'trips.card.copyingLabel': '{title} se ještě kopíruje',
  'trips.card.copyingReason': 'Počkejte, až kopírování skončí.',
  'metric.trips': 'Cesty',
  'metric.places': 'Místa',
  'metric.members': 'Členové',
  'metric.files': 'Soubory',
  'metric.storage_bytes': 'Úložiště',
  'metric.collections': 'Kolekce',
  'metric.journeys': 'Deníky',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Tohle se nenačetlo',
  'error.body':
    'Nic se neztratilo. Zkuste to znovu, a pokud se to bude opakovat, pošlete nám podrobnosti níže.',
  'error.retry': 'Zkusit znovu',
  'error.dashboard': 'Zpět na přehled',
  'error.reported': 'Dostali jsme upozornění a už se na to díváme.',
  'error.reference': 'Referenční číslo',
  'error.feedback.open': 'Napište nám, co se stalo',
  'error.feedback.label': 'Co jste dělali, když se to stalo?',
  'error.feedback.send': 'Odeslat',
  'error.feedback.sent': 'Děkujeme — moc nám to pomůže.',
  'error.feedback.failed':
    'Nepodařilo se odeslat. Referenční číslo výše k nám stále dorazí.',
  'error.root': 'Sjeli jsme z cesty',
  'error.session': 'Váš přístup do prostoru se změnil',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Nahlásit problém',
  'feedback.formTitle': 'Nahlásit problém',
  'feedback.messageLabel': 'Co je špatně, nebo co by se mělo změnit?',
  'feedback.messagePlaceholder': 'Co jste čekali a co se stalo místo toho?',
  'feedback.emailLabel': 'E-mailová adresa',
  'feedback.emailPlaceholder': 'jan@example.com',
  'feedback.isRequiredLabel': '(povinné)',
  'feedback.submitButtonLabel': 'Odeslat hlášení',
  'feedback.cancelButtonLabel': 'Zrušit',
  'feedback.confirmButtonLabel': 'Potvrdit',
  'feedback.addScreenshotButtonLabel': 'Přidat snímek obrazovky',
  'feedback.removeScreenshotButtonLabel': 'Odebrat snímek obrazovky',
  'feedback.highlightToolText': 'Zvýraznit',
  'feedback.hideToolText': 'Skrýt',
  'feedback.successMessageText': 'Děkujeme — hlášení máme.',
  'feedback.errorEmptyMessageText':
    'Nejdřív napište větu — prázdné hlášení nám nic neřekne.',
  'feedback.errorTimeoutText':
    'Trvá to příliš dlouho a nemůžeme potvrdit, že hlášení odešlo.',
  'feedback.errorForbiddenText':
    'Tato stránka nemá oprávnění odesílat hlášení.',
  'feedback.errorGenericText':
    'Odeslání se nezdařilo. Zkontrolujte připojení a jestli do toho nemluví blokovač reklam.',

  'notFound.eyebrow': 'Chyba 404',
  'notFound.title': 'Tato stránka na mapě není',
  'notFound.body':
    'Odkaz může být starý, nebo se cesta, na kterou mířil, přesunula či byla smazána.',
  'notFound.trips': 'Všechny cesty',
  'notFound.rootBody':
    'Hledali jsme po celé trase. Adresa může mít překlep, nebo se stránka posunula dál.',
  'notFound.home': 'Zpět na domovskou stránku',
  'notFound.plans': 'Zobrazit tarify',

  'session.noWorkspace':
    'Váš účet zatím nepatří k žádnému prostoru. Odhlaste se a znovu přihlaste, ať se nastavení dokončí.',
  'session.membershipRemoved': 'Vaše členství v tomto prostoru bylo odebráno.',
  'session.workspaceChanged':
    'Prostor byl změněn v jiné kartě nebo okně. Nic se neuložilo.',
  'session.workspaceChangedTitle': 'Prostor se změnil v jiné kartě',
  'session.workspaceChangedBody':
    'Tato karta zobrazuje {name}, ale prostor byl změněn v jiné kartě nebo okně. Nic se neuložilo.',
  'session.openCurrentWorkspace': 'Otevřít aktuální prostor',
  'session.workspaceChangedDismiss': 'Teď ne',
} satisfies TranslationOf<typeof En>

export default messages
