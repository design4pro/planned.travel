/**
 * Everything the application shell says, in German.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular throughout. A travel planner talks to
 * the traveller, so the whole German catalogue says „du", never „Sie", and no
 * screen switches voice halfway down.
 *
 * **Plural.** `Intl.PluralRules('de')` reports `one` and `other`, the same two
 * branches English needs.
 *
 * **Words chosen once and kept.** `trip` is „Reise" everywhere, `workspace` is
 * „Arbeitsbereich", `plan` in the billing sense is „Tarif" and `plan` in the
 * itinerary sense is „Ablauf" — English uses one word for both and German must
 * not, or the trip tab and the subscription row read as the same thing.
 * `Atlas` is „Weltkarte", because the section is the world map that records
 * where the traveller has been and a German reader would not look for it under
 * a Latin noun.
 *
 * **Length.** Compound nouns run long, so every label that shares a row with
 * others — the nav, the tab bar, the status badges — is kept to one word or two
 * short ones, and the `.short` forms are genuinely shorter rather than copies.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Hauptbereiche',
  'nav.mobile': 'Bereiche',
  'nav.dashboardLink': 'planned.travel Übersicht',
  'nav.homeLink': 'planned.travel Startseite',
  'nav.newTrip': 'Neue Reise',

  'nav.trips': 'Meine Reisen',
  'nav.trips.short': 'Reisen',
  'nav.vacay': 'Urlaub',
  'nav.vacay.short': 'Urlaub',
  'nav.atlas': 'Weltkarte',
  'nav.atlas.short': 'Karte',
  'nav.journey': 'Tagebuch',
  'nav.journey.short': 'Tagebuch',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Bereiche dieser Reise',
  'trip.nav.back': 'Reisen',
  'trip.nav.share': 'Teilen',
  'trip.nav.shareLabel': 'Diese Reise teilen',
  'trip.tab.plan': 'Ablauf',
  'trip.tab.transports': 'Transfers',
  'trip.tab.book': 'Buchen',
  'trip.tab.lists': 'Listen',
  'trip.tab.costs': 'Kosten',
  'trip.tab.files': 'Dateien',
  'trip.tab.collab': 'Austausch',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Kontomenü',
  'account.settings': 'Einstellungen',
  'account.billing': 'Tarif und Abrechnung',
  'account.admin': 'Verwaltung',
  'account.signOut': 'Abmelden',
  'account.signingOut': 'Du wirst abgemeldet …',
  'account.signOutFailed': 'Das Abmelden hat nicht geklappt',
  'account.signOutFailedBody':
    'Prüfe deine Verbindung und versuche es noch einmal.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Darstellung',
  'theme.light': 'Hell',
  'theme.dark': 'Dunkel',
  'theme.system': 'Wie das Gerät',
  'theme.state.light': 'hell',
  'theme.state.dark': 'dunkel',
  'theme.state.system': 'wie das Gerät',
  'theme.trigger': 'Darstellung: {state}. Darstellung wechseln',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Mitteilungen, alles gelesen',
  'bell.unread': {
    one: 'Mitteilungen, {unread} ungelesen',
    other: 'Mitteilungen, {unread} ungelesen',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Posteingang',
  'inbox.title': 'Mitteilungen',
  'inbox.error': 'Dein Posteingang wurde nicht geladen',
  'inbox.allRead': 'Alles gelesen',
  'inbox.unread': {
    one: '{unread} ungelesene Nachricht',
    other: '{unread} ungelesene Nachrichten',
  },
  'inbox.markAll': 'Alle als gelesen',
  'inbox.markingAll': 'Alles wird als gelesen markiert',
  'inbox.cleared': 'Posteingang geleert',
  'inbox.markAllFailed': 'Es ließ sich nicht alles als gelesen markieren',
  'inbox.retryHint': 'Prüfe deine Verbindung und versuche es noch einmal.',
  'inbox.filter.all': 'Alles',
  'inbox.filter.unread': 'Ungelesen',
  'inbox.waiting': {
    one: '{invitations} Einladung wartet',
    other: '{invitations} Einladungen warten',
  },
  'inbox.empty.title': 'Dein Posteingang ist leer',
  'inbox.empty.body':
    'Reiseeinladungen, Planänderungen, Buchungserinnerungen und beglichene Beträge landen alle hier.',
  'inbox.empty.action': 'Zurück zur Übersicht',
  'inbox.emptyUnread.title': 'Nichts Ungelesenes',
  'inbox.emptyUnread.body':
    'Du hast alles gelesen. Wechsle auf Alles, um in der Historie zurückzublättern.',
  'inbox.emptyUnread.action': 'Alles anzeigen',
  'inbox.row.new': 'Neu',
  'inbox.row.accepted': 'Angenommen',
  'inbox.row.declined': 'Abgelehnt',
  'inbox.row.open': 'Öffnen',
  'inbox.row.markRead': 'Gelesen',
  'inbox.row.markingRead': 'Wird als gelesen markiert',
  'inbox.row.markReadFailed': 'Das ließ sich nicht als gelesen markieren',
  'inbox.preferences':
    'Lege fest, was davon deinen Posteingang, deine E-Mails und dein Handy erreicht.',
  'inbox.preferencesAction': 'Mitteilungseinstellungen',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Du wurdest zu {tripTitle} eingeladen',
  'notification.trip.invited.body':
    '{actorName} hat dich zu der Reise hinzugefügt.',
  'notification.trip.updated.title': '{tripTitle} wurde geändert',
  'notification.trip.updated.body': '{actorName} hat den Ablauf angepasst.',
  'notification.trip.member_added.title':
    '{memberName} ist jetzt bei {tripTitle} dabei',
  'notification.trip.member_added.body':
    'Ablauf, Buchungen und Kosten sind damit einsehbar.',
  'notification.trip.member_removed.title':
    '{memberName} hat {tripTitle} verlassen',
  'notification.trip.member_removed.body':
    'Der Zugang zu dieser Reise ist beendet.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} beginnt in {days} Tag',
    other: '{tripTitle} beginnt in {days} Tagen',
  },
  'notification.trip.starting_soon.body':
    'Zeit, Packliste und Buchungen durchzugehen.',
  'notification.reservation.reminder.title': '{title} steht bevor',
  'notification.reservation.reminder.body':
    'Prüfe Uhrzeit und Buchungsnummer direkt bei der Buchung.',
  'notification.reservation.confirmed.title': '{title} ist bestätigt',
  'notification.reservation.confirmed.body':
    'Die Buchung wurde bei {tripTitle} als bestätigt vermerkt.',
  'notification.expense.added.title': '{actorName} hat eine Ausgabe erfasst',
  'notification.expense.added.body': '{title} bei {tripTitle}.',
  'notification.expense.settled.title': '{actorName} hat ausgeglichen',
  'notification.expense.settled.body':
    'Der offene Betrag bei {tripTitle} ist bezahlt.',
  'notification.list.assigned.title':
    '{actorName} hat dir einen Punkt zugewiesen',
  'notification.list.assigned.body': '{title} bei {tripTitle}.',
  'notification.collab.message.title':
    '{actorName} hat bei {tripTitle} geschrieben',
  /**
   * The reader's own words, set in German quotation marks. English hands the
   * preview through bare; a quoted fragment is what marks it as somebody else's
   * sentence rather than ours, and every language in this catalogue set does it
   * with its own pair of marks.
   */
  'notification.collab.message.body': '„{preview}"',
  'notification.collab.poll.title': 'Bei {tripTitle} läuft eine Abstimmung',
  'notification.collab.poll.body': '„{question}"',
  'notification.organization.invited.title':
    'Du wurdest zu {organizationName} eingeladen',
  'notification.organization.invited.body':
    'Nimm an, um dem Arbeitsbereich und allem darin beizutreten.',
  'notification.journey.published.title': '{title} ist veröffentlicht',
  'notification.journey.published.body':
    'Wer den Link hat, kann das Tagebuch ab jetzt lesen.',
  'notification.billing.plan_changed.title': 'Dein Tarif hat sich geändert',
  'notification.billing.plan_changed.body':
    '{organizationName} nutzt jetzt den Tarif {plan}.',
  'notification.fallback.title':
    'In deinem Arbeitsbereich hat sich etwas geändert',
  'notification.fallback.body': 'Öffne die Reise, um zu sehen, was es war.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Die Übersicht wurde nicht geladen',
  'dashboard.blank.title': 'Hier beginnt deine nächste Reise',
  'dashboard.blank.body':
    'Leg eine Reise an, setz die Orte auf die Karte, die du sehen willst, und planned.travel baut den Ablauf Tag für Tag darum herum.',
  'dashboard.blank.action': 'Reise planen',
  'dashboard.blank.secondary': 'Zur Weltkarte',

  'dashboard.upNext': 'Als Nächstes',
  'dashboard.openPlan': 'Ablauf öffnen',
  'dashboard.hero.travellers': 'Mitreisende',
  'dashboard.hero.travellersHint': 'im Arbeitsbereich',
  'dashboard.hero.dates': 'Reisedaten',
  'dashboard.hero.datesUnset': 'Offen',
  'dashboard.hero.datesHint': { one: '{days} Tag', other: '{days} Tage' },
  'dashboard.hero.datesMissing': 'Daten eintragen, dann entstehen die Tage',
  'dashboard.hero.startsIn': 'Beginnt in',
  'dashboard.hero.started': 'Begonnen vor',
  'dashboard.hero.today': 'Heute',
  'dashboard.hero.startUnknown': 'kein Startdatum',
  'dashboard.hero.startToday': 'gute Reise',
  'dashboard.hero.startPast': { one: 'Tag', other: 'Tagen' },
  'dashboard.hero.startFuture': { one: 'Tag', other: 'Tagen' },
  'dashboard.hero.places': 'Orte',
  'dashboard.hero.placesNone': 'noch nichts auf der Karte',
  'dashboard.hero.placesHint': 'auf der Karte',

  'dashboard.stat.countries': 'Bereiste Länder',
  'dashboard.stat.countriesUnit': 'von {total}',
  'dashboard.stat.countriesNone':
    'Markiere ein Land, dann beginnt deine Weltkarte',
  'dashboard.stat.visits': {
    one: '{visits} Aufenthalt erfasst',
    other: '{visits} Aufenthalte erfasst',
  },
  'dashboard.stat.trips': 'Reisen insgesamt',
  'dashboard.stat.tripsCaption': '{planning} in Planung · {booked} gebucht',
  'dashboard.stat.places': 'Orte auf der Karte',
  'dashboard.stat.placesNone': 'Noch nichts auf der Karte',
  'dashboard.stat.placesAcross': {
    one: 'auf {trips} Reise',
    other: 'auf {trips} Reisen',
  },
  'dashboard.stat.bookings': 'Bestätigte Buchungen',
  'dashboard.stat.bookingsNone': 'Keine Buchungen in Sicht',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} Buchung steht an',
    other: '{bookings} Buchungen stehen an',
  },

  'dashboard.trips.label': 'Deine Reisen',
  'dashboard.trips.all': 'Alle Reisen',
  'dashboard.trips.empty.title': 'Noch keine Reisen',
  'dashboard.trips.empty.body':
    'Alles, was du planst, taucht hier auf, das Neueste zuerst.',
  'dashboard.trips.empty.action': 'Reise anlegen',

  'dashboard.bookings.label': 'Kommende Buchungen',
  'dashboard.bookings.empty.title': 'Noch nichts gebucht',
  'dashboard.bookings.empty.body':
    'Bestätigte Unterkünfte, Tische und Tickets erscheinen hier, sobald ihr Datum näher rückt.',

  'dashboard.pipeline.label': 'Reisen nach Stand',
  'dashboard.pipeline.empty':
    'Noch nichts in Arbeit. Deine erste Reise schlüsselt das hier nach Stand auf.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} Favorit',
    other: '{favourites} Favoriten',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} archivierte Reise',
    other: '{archived} archivierte Reisen',
  },

  'dashboard.storage.label': 'Speicher',
  'dashboard.storage.count': '{used} von {limit}',
  'dashboard.storage.files': {
    one: '{files} Datei über alle Reisen hinweg, Fotos und Tickets inbegriffen.',
    other:
      '{files} Dateien über alle Reisen hinweg, Fotos und Tickets inbegriffen.',
  },
  'dashboard.storage.more': 'Mehr Platz nötig?',
  'dashboard.storage.plans': 'Tarife ansehen',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Die Verwaltung wurde nicht geladen',
  'admin.denied.title':
    'Das öffnen nur Inhaber und Administratoren des Arbeitsbereichs',
  'admin.denied.body':
    'Bitte einen Inhaber oder einen Administrator dieses Arbeitsbereichs, deine Rolle zu ändern, wenn du das brauchst.',
  'admin.denied.action': 'Zurück zur Übersicht',
  'admin.eyebrow': 'Arbeitsbereich verwalten',
  'admin.description': 'Tarif {plan} · angelegt {date}',
  'admin.createdUnknown': 'kürzlich',
  'admin.workspaceSettings': 'Einstellungen des Arbeitsbereichs',
  'admin.billing': 'Tarif und Abrechnung',

  'admin.invitations.title': {
    one: '{invitations} Einladung ist noch offen',
    other: '{invitations} Einladungen sind noch offen',
  },
  'admin.invitations.body':
    'Jede offene Einladung zählt gegen die Plätze, die dein Tarif bezahlt.',
  'admin.invitations.action': 'Einladungen prüfen',

  'admin.stat.members': 'Mitglieder',
  'admin.stat.membersCaption': {
    one: '{invitations} Einladung offen',
    other: '{invitations} Einladungen offen',
  },
  'admin.stat.storage': 'Speicher',
  'admin.stat.storageUnit': 'von {limit}',
  'admin.stat.storageUnlimited': 'ohne Grenze',
  'admin.stat.storageCaption': 'Dateien, Fotos und Exporte',
  'admin.stat.audit': 'Protokolleinträge',
  'admin.stat.auditCaption': 'Die jüngsten Vorgänge stehen weiter unten',
  'admin.stat.plan': 'Tarif',
  'admin.stat.planCaption':
    'Kontingente greifen unten an der Datenschicht, nicht im Bildschirm',

  'admin.quotas.label': 'Kontingente',
  'admin.quotas.count': {
    one: '{metrics} Kennzahl',
    other: '{metrics} Kennzahlen',
  },
  'admin.quotas.unlimited': 'Unbegrenzt',
  'admin.quotas.value': '{used} von {limit}',

  'admin.members.label': 'Mitglieder',
  'admin.members.table': 'Mitglieder dieses Arbeitsbereichs',
  'admin.members.person': 'Name',
  'admin.members.role': 'Rolle',
  'admin.members.joined': 'Dabei seit',

  'admin.activity.label': 'Letzte Vorgänge',
  'admin.activity.empty.title': 'Noch nichts aufgezeichnet',
  'admin.activity.empty.body':
    'Jeder Schreibvorgang, der zählt, wird laufend im Protokoll ergänzt.',
  'admin.activity.workspace': 'der Arbeitsbereich selbst',
  'admin.actions.label': 'Häufigste Vorgänge',
  'admin.actions.count': {
    one: '{actions} Vorgang',
    other: '{actions} Vorgänge',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Entwurf',
  'tripStatus.planning': 'In Planung',
  'tripStatus.booked': 'Gebucht',
  'tripStatus.active': 'Läuft',
  'tripStatus.completed': 'Abgeschlossen',
  'tripStatus.archived': 'Archiviert',

  'bookingStatus.none': 'Nicht gebucht',
  'bookingStatus.pending': 'Ausstehend',
  'bookingStatus.confirmed': 'Bestätigt',
  'bookingStatus.cancelled': 'Storniert',
  'bookingStatus.completed': 'Erledigt',

  'bookingType.accommodation': 'Unterkunft',
  'bookingType.restaurant': 'Tisch',
  'bookingType.activity': 'Aktivität',
  'bookingType.tour': 'Führung',
  'bookingType.ticket': 'Eintritt',
  'bookingType.transport': 'Fahrt',
  'bookingType.other': 'Buchung',

  'role.owner': 'Inhaber',
  'role.admin': 'Administrator',
  'role.member': 'Mitglied',

  'metric.trips': 'Reisen',
  'metric.places': 'Orte',
  'metric.members': 'Mitglieder',
  'metric.files': 'Dateien',
  'metric.storage_bytes': 'Speicher',
  'metric.collections': 'Sammlungen',
  'metric.journeys': 'Tagebücher',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Das wurde nicht geladen',
  'error.body':
    'Nichts ist verloren. Versuch es noch einmal, und wenn es weiter passiert, schick uns die Angabe von unten.',
  'error.retry': 'Noch einmal versuchen',
  'error.dashboard': 'Zurück zur Übersicht',
  'error.unknown': 'Die Anfrage brach ab, bevor sie fertig war.',
  'error.root': 'Da ist etwas vom Weg abgekommen',
  'error.session': 'Dein Zugang zum Arbeitsbereich hat sich geändert',

  'notFound.eyebrow': 'Fehler 404',
  'notFound.title': 'Diese Seite steht auf keiner Karte',
  'notFound.body':
    'Der Link ist womöglich veraltet, oder die Reise dahinter wurde verschoben oder gelöscht.',
  'notFound.trips': 'Alle Reisen',
  'notFound.rootBody':
    'Wir haben die ganze Strecke abgesucht. Vielleicht ist die Adresse vertippt, oder die Seite ist längst weitergezogen.',
  'notFound.home': 'Zurück zum Anfang',
  'notFound.plans': 'Tarife ansehen',

  'session.noWorkspace':
    'Dein Konto hängt noch an keinem Arbeitsbereich. Melde dich ab und wieder an, um das abzuschließen.',
  'session.membershipRemoved':
    'Deine Mitgliedschaft in diesem Arbeitsbereich wurde beendet.',
} satisfies TranslationOf<typeof En>

export default messages
