/**
 * Everything the application shell says, in French.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Vouvoiement throughout, matching `./ui.ts` and `./settings.ts`.
 *
 * **Plural.** `Intl.PluralRules('fr')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Feature names are translated, not borrowed.** «Atlas», «Vacay» and
 * «Journey» are English words a French reader would have to decode, so the nav
 * names what each screen is: la carte du monde, les vacances, le journal.
 *
 * **Typography.** A non-breaking space precedes every colon and question mark,
 * and guillemets take one inside each mark — which is why the quoted
 * notification bodies below are not bare braces.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Rubriques principales',
  'nav.mobile': 'Rubriques',
  'nav.dashboardLink': 'Tableau de bord planned.travel',
  'nav.homeLink': 'Accueil planned.travel',
  'nav.newTrip': 'Nouveau voyage',

  'nav.trips': 'Mes voyages',
  'nav.trips.short': 'Voyages',
  'nav.vacay': 'Vacances',
  'nav.vacay.short': 'Vacances',
  'nav.atlas': 'Carte du monde',
  'nav.atlas.short': 'Carte',
  'nav.journey': 'Journal',
  'nav.journey.short': 'Journal',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Sections du voyage',
  'trip.nav.back': 'Voyages',
  'trip.nav.share': 'Partager',
  'trip.nav.shareLabel': 'Partager ce voyage',
  'trip.tab.plan': 'Programme',
  'trip.tab.transports': 'Trajets',
  'trip.tab.book': 'Réservations',
  'trip.tab.lists': 'Listes',
  'trip.tab.costs': 'Dépenses',
  'trip.tab.files': 'Fichiers',
  'trip.tab.collab': 'Groupe',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Menu du compte',
  'account.settings': 'Réglages',
  'account.billing': 'Formule et facturation',
  'account.admin': 'Administration',
  'account.signOut': 'Se déconnecter',
  'account.signingOut': 'Déconnexion…',
  'account.signOutFailed': 'Impossible de vous déconnecter',
  'account.signOutFailedBody': 'Vérifiez votre connexion et réessayez.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Espace',
  'workspace.switched': 'Vous êtes dans {name}',
  'workspace.switchFailed': 'Impossible de changer d’espace',
  'workspace.switchFailedBody': 'Vérifiez votre connexion et réessayez.',
  'workspace.switchUnconfirmedBody':
    'L’espace de travail actif n’a pas pu être confirmé. Rechargez la page avant de continuer.',
  'workspace.switchRateLimitedBody':
    'Trop de changements d’espace de travail. Patientez un instant et réessayez.',
  'workspace.create': 'Créer un espace',
  'workspace.createTitle': 'Créer un nouvel espace',
  'workspace.createDescription':
    'Un espace distinct avec ses propres voyages, lieux et personnes. Il démarre avec l’offre Gratuite et ne partage pas l’offre de l’espace où vous êtes.',
  'workspace.createName': 'Nom de l’espace',
  'workspace.createUpgrade':
    '« {workspace} » est dans l’offre Gratuite, et seul un espace avec une offre payante peut en créer un autre. Si l’un de vos autres espaces a une offre payante, passez-y et créez depuis celui-ci. Sinon, faites passer « {workspace} » à une offre payante.',
  'workspace.createLimitReached':
    'Vous avez atteint le nombre maximal d’espaces auxquels un compte peut appartenir.',
  'workspace.createRoleRequired':
    'Seul un administrateur de l’espace peut créer un espace. Demandez à un administrateur de cet espace ou passez à un espace que vous administrez.',
  'workspace.createFailed': 'Impossible de créer l’espace',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Apparence',
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'theme.system': 'Comme le système',
  'theme.state.light': 'clair',
  'theme.state.dark': 'sombre',
  'theme.state.system': 'aligné sur le système',
  'theme.trigger': 'Thème\u00a0: {state}. Changer de thème',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Notifications, aucune non lue',
  'bell.unread': {
    one: 'Notifications, {unread} non lue',
    many: 'Notifications, {unread} non lues',
    other: 'Notifications, {unread} non lues',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Boîte de réception',
  'inbox.title': 'Vos notifications',
  'inbox.error': 'Votre boîte de réception ne s’est pas chargée',
  'inbox.allRead': 'Tout est lu',
  'inbox.unread': {
    one: '{unread} message non lu',
    many: '{unread} messages non lus',
    other: '{unread} messages non lus',
  },
  'inbox.markAll': 'Tout marquer comme lu',
  'inbox.markingAll': 'Marquage de tout comme lu',
  'inbox.cleared': 'Boîte de réception à jour',
  'inbox.markAllFailed': 'Impossible de tout marquer comme lu',
  'inbox.retryHint': 'Vérifiez votre connexion et réessayez.',
  'inbox.filter.all': 'Tout',
  'inbox.filter.unread': 'Non lues',
  'inbox.waiting': {
    one: '{invitations} invitation en attente',
    many: '{invitations} invitations en attente',
    other: '{invitations} invitations en attente',
  },
  'inbox.empty.title': 'Votre boîte de réception est vide',
  'inbox.empty.body':
    'Les invitations aux voyages, les changements de programme, les rappels de réservation et les comptes soldés arrivent tous ici.',
  'inbox.empty.action': 'Retour au tableau de bord',
  'inbox.emptyUnread.title': 'Rien de non lu',
  'inbox.emptyUnread.body':
    'Vous avez tout lu. Passez à Tout pour revoir l’historique.',
  'inbox.emptyUnread.action': 'Tout afficher',
  'inbox.row.new': 'Nouveau',
  'inbox.row.accepted': 'Acceptée',
  'inbox.row.declined': 'Refusée',
  'inbox.row.open': 'Ouvrir',
  'inbox.row.markRead': 'Lue',
  'inbox.row.markingRead': 'Marquage comme lue',
  'inbox.row.markReadFailed': 'Impossible de marquer cette notification',
  'inbox.preferences':
    'Choisissez lesquelles arrivent dans votre boîte, dans vos e-mails et sur votre téléphone.',
  'inbox.preferencesAction': 'Réglages des notifications',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Vous êtes invité à {tripTitle}',
  'notification.trip.invited.body': '{actorName} vous a ajouté au voyage.',
  'notification.trip.updated.title': '{tripTitle} a changé',
  'notification.trip.updated.body': '{actorName} a modifié le programme.',
  'notification.trip.member_added.title': '{memberName} a rejoint {tripTitle}',
  'notification.trip.member_added.body':
    'Cette personne voit désormais l’itinéraire, les réservations et les comptes.',
  'notification.trip.member_removed.title': '{memberName} a quitté {tripTitle}',
  'notification.trip.member_removed.body': 'Son accès au voyage est terminé.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} commence dans {days} jour',
    many: '{tripTitle} commence dans {days} jours',
    other: '{tripTitle} commence dans {days} jours',
  },
  'notification.trip.starting_soon.body':
    'Le moment de revoir la liste de bagages et les réservations.',
  'notification.trip.copied.title': '{tripTitle} est prêt',
  'notification.trip.copied.body': {
    one: 'Repris : {days} jour',
    many: 'Repris : {days} jours',
    other: 'Repris : {days} jours',
  },
  'notification.trip.copied.places': {
    one: '{places} lieu',
    many: '{places} lieux',
    other: '{places} lieux',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} note abandonnée',
    many: '{dropped} notes abandonnées',
    other: '{dropped} notes abandonnées',
  },
  'notification.trip.copyFailed.title': '{tripTitle} n’a pas pu être copié',
  'notification.trip.copyFailed.body':
    'Rien n’a été perdu. Réessayez depuis l’original.',
  'notification.reservation.reminder.title': '{title}, c’est bientôt',
  'notification.reservation.reminder.body':
    'Vérifiez l’heure et le code de confirmation sur la réservation.',
  'notification.reservation.confirmed.title': '{title} est confirmée',
  'notification.reservation.confirmed.body':
    'La réservation est marquée confirmée sur {tripTitle}.',
  'notification.expense.added.title': '{actorName} a ajouté une dépense',
  'notification.expense.added.body': '{title}, sur {tripTitle}.',
  'notification.expense.settled.title': '{actorName} a soldé les comptes',
  'notification.expense.settled.body': 'Le solde de {tripTitle} est payé.',
  'notification.list.assigned.title': '{actorName} vous a confié un élément',
  'notification.list.assigned.body': '{title}, sur {tripTitle}.',
  'notification.collab.message.title': '{actorName} a écrit dans {tripTitle}',
  'notification.collab.message.body': '«\u00a0{preview}\u00a0»',
  'notification.collab.poll.title': 'Un sondage est ouvert sur {tripTitle}',
  'notification.collab.poll.body': '«\u00a0{question}\u00a0»',
  'notification.organization.invited.title':
    'Vous êtes invité à {organizationName}',
  'notification.organization.invited.body':
    'Acceptez pour rejoindre l’espace de travail et tout ce qui y est partagé.',
  'notification.journey.published.title': '{title} est publié',
  'notification.journey.published.body':
    'Toute personne qui a le lien peut désormais lire le journal.',
  'notification.billing.plan_changed.title': 'Votre formule a changé',
  'notification.billing.plan_changed.body':
    '{organizationName} est maintenant sur la formule {plan}.',
  'notification.billing.invoice_paid.title': 'Paiement reçu',
  'notification.billing.invoice_paid.body':
    'La dernière facture de {organizationName} est réglée.',
  'notification.billing.payment_failed.title': 'Un paiement a échoué',
  'notification.billing.payment_failed.body':
    '{organizationName} a un paiement en retard. Mettez à jour le moyen de paiement pour conserver la formule.',
  'notification.fallback.title':
    'Quelque chose a changé dans votre espace de travail',
  'notification.fallback.body': 'Ouvrez le voyage pour voir quoi.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Le tableau de bord ne s’est pas chargé',
  'dashboard.blank.title': 'Votre prochain voyage commence ici',
  'dashboard.blank.body':
    'Créez un voyage, posez sur la carte les endroits que vous voulez voir, et planned.travel construira le programme jour par jour autour d’eux.',
  'dashboard.blank.action': 'Préparer un voyage',
  'dashboard.blank.secondary': 'Voir votre carte du monde',

  'dashboard.upNext': 'À venir',
  'dashboard.openPlan': 'Ouvrir le programme',
  'dashboard.hero.travellers': 'Voyageurs',
  'dashboard.hero.datesMissing': 'Ajoutez des dates pour créer les journées',
  'dashboard.hero.startsIn': 'Départ dans',
  'dashboard.hero.started': 'Depuis',
  'dashboard.hero.today': 'Aujourd’hui',
  'dashboard.hero.startUnknown': 'sans date de départ',
  'dashboard.hero.startToday': 'bon voyage',
  /**
   * The label above the numeral already carries «depuis», so the unit under it
   * is only the word for a day — French would otherwise say it twice.
   */
  'dashboard.hero.startPast': {
    one: 'jour',
    many: 'jours',
    other: 'jours',
  },
  'dashboard.hero.startFuture': {
    one: 'jour',
    many: 'jours',
    other: 'jours',
  },
  'dashboard.hero.nights': 'Nuits',
  'dashboard.hero.companionsHint': 'sur ce voyage',
  'dashboard.hero.progress': 'En cours',
  'dashboard.hero.places': 'Lieux',
  'dashboard.hero.placesNone': 'rien sur la carte pour l’instant',
  'dashboard.hero.placesHint': 'sur la carte',

  'dashboard.stat.countries': 'Pays visités',
  'dashboard.stat.countriesUnit': 'sur {total}',
  'dashboard.stat.countriesNone': 'Marquez un pays pour ouvrir votre carte',
  'dashboard.stat.visits': {
    one: '{visits} visite enregistrée',
    many: '{visits} visites enregistrées',
    other: '{visits} visites enregistrées',
  },
  'dashboard.stat.trips': 'Voyages au total',
  'dashboard.stat.tripsCaption':
    '{planning} en préparation · {booked} avec réservation',
  'dashboard.stat.places': 'Lieux sur la carte',
  'dashboard.stat.placesNone': 'Rien sur la carte pour l’instant',
  'dashboard.stat.placesAcross': {
    one: 'sur {trips} voyage',
    many: 'sur {trips} voyages',
    other: 'sur {trips} voyages',
  },
  'dashboard.stat.bookings': 'Réservations confirmées',
  'dashboard.stat.bookingsNone': 'Aucune réservation à venir',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} réservation en approche',
    many: '{bookings} réservations en approche',
    other: '{bookings} réservations en approche',
  },

  'dashboard.trips.label': 'Vos voyages',
  'dashboard.trips.all': 'Tous les voyages',
  'dashboard.trips.empty.title': 'Aucun voyage pour l’instant',
  'dashboard.trips.empty.body':
    'Tout ce que vous préparez apparaîtra ici, du plus récent au plus ancien.',
  'dashboard.trips.empty.action': 'Créer un voyage',

  'dashboard.bookings.label': 'Réservations à venir',
  'dashboard.bookings.empty.title': 'Rien de réservé pour l’instant',
  'dashboard.bookings.empty.body':
    'Les hébergements, les tables et les billets confirmés apparaissent ici à l’approche de leur date.',

  'dashboard.pipeline.label': 'Voyages par étape',
  'dashboard.pipeline.empty':
    'Rien en cours. Votre premier voyage remplira ces étapes.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} favori',
    many: '{favourites} favoris',
    other: '{favourites} favoris',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} voyage archivé',
    many: '{archived} voyages archivés',
    other: '{archived} voyages archivés',
  },

  'dashboard.storage.label': 'Stockage',
  'dashboard.storage.count': '{used} sur {limit}',
  'dashboard.storage.files': {
    one: '{files} fichier sur l’ensemble des voyages, photos et billets compris.',
    many: '{files} fichiers sur l’ensemble des voyages, photos et billets compris.',
    other:
      '{files} fichiers sur l’ensemble des voyages, photos et billets compris.',
  },
  'dashboard.storage.more': 'Besoin de plus de place\u00a0?',
  'dashboard.storage.plans': 'Voir les formules',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Référence',
  'dashboard.widgets.choose': 'Choisir les widgets',
  'dashboard.widgets.description':
    'Les widgets que vous gardez à côté de votre tableau de bord.',
  'dashboard.clock.label': 'Horloge mondiale',
  'dashboard.clock.add': 'Ajouter un fuseau horaire',
  'dashboard.clock.search': 'Rechercher des villes et des régions',
  'dashboard.clock.noMatches': 'Aucun fuseau horaire de ce nom',
  'dashboard.clock.remove': 'Retirer {zone}',
  'dashboard.clock.offset': '{offset} par rapport à votre heure',
  'dashboard.clock.here': 'Votre propre heure',
  'dashboard.clock.empty.title': 'Aucun fuseau horaire épinglé',
  'dashboard.clock.empty.body':
    'Épinglez un lieu et lisez son heure à côté de la vôtre.',
  'dashboard.clock.unknown.title': 'Cet appareil ne connaît pas {zone}',
  'dashboard.clock.unknown.body':
    'Son heure ne peut pas être lue ici. Retirez la ligne pour corriger cela.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'La console d’administration ne s’est pas chargée',
  'admin.denied.title': 'Réservé aux administrateurs de l’espace',
  'admin.denied.body':
    'Demandez à un propriétaire ou à un administrateur de cet espace de changer votre rôle si vous en avez besoin.',
  'admin.denied.action': 'Retour au tableau de bord',
  'admin.eyebrow': 'Administration de l’espace',
  'admin.description': 'Formule {plan} · créé le {date}',
  'admin.createdUnknown': 'récemment',
  'admin.workspaceSettings': 'Réglages de l’espace',
  'admin.billing': 'Formule et facturation',

  'admin.invitations.title': {
    one: '{invitations} invitation encore en attente',
    many: '{invitations} invitations encore en attente',
    other: '{invitations} invitations encore en attente',
  },
  'admin.invitations.body':
    'Chaque invitation en attente occupe une des places que votre formule paie.',
  'admin.invitations.action': 'Revoir les invitations',

  'admin.stat.members': 'Membres',
  'admin.stat.membersCaption': {
    one: '{invitations} invitation en attente',
    many: '{invitations} invitations en attente',
    other: '{invitations} invitations en attente',
  },
  'admin.stat.storage': 'Stockage',
  'admin.stat.storageUnit': 'sur {limit}',
  'admin.stat.storageUnlimited': 'sans plafond',
  'admin.stat.storageCaption': 'Fichiers, photos et exports',
  'admin.stat.audit': 'Entrées du journal',
  'admin.stat.auditCaption': 'L’activité la plus récente est ci-dessous',
  'admin.stat.plan': 'Formule',
  'admin.stat.planCaption': 'Les quotas sont appliqués côté données',

  'admin.quotas.label': 'Limites',
  'admin.quotas.count': {
    one: '{metrics} mesure',
    many: '{metrics} mesures',
    other: '{metrics} mesures',
  },
  'admin.quotas.unlimited': 'Illimité',
  'admin.quotas.value': '{used} sur {limit}',

  'admin.members.label': 'Membres',
  'admin.members.table': 'Membres de cet espace de travail',
  'admin.members.person': 'Personne',
  'admin.members.role': 'Rôle',
  'admin.members.joined': 'Arrivée',

  'admin.activity.label': 'Activité récente',
  'admin.activity.empty.title': 'Rien d’enregistré pour l’instant',
  'admin.activity.empty.body':
    'Chaque écriture qui compte est ajoutée au journal au moment où elle a lieu.',
  'admin.activity.workspace': 'l’espace de travail lui-même',
  'admin.actions.label': 'Actions les plus fréquentes',
  'admin.actions.count': {
    one: '{actions} action',
    many: '{actions} actions',
    other: '{actions} actions',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Brouillon',
  'tripStatus.planning': 'En préparation',
  'tripStatus.booked': 'Réservé',
  'tripStatus.active': 'En cours',
  'tripStatus.completed': 'Terminé',
  'tripStatus.archived': 'Archivé',

  'bookingStatus.none': 'Non réservée',
  'bookingStatus.pending': 'En attente',
  'bookingStatus.confirmed': 'Confirmée',
  'bookingStatus.cancelled': 'Annulée',
  'bookingStatus.completed': 'Terminée',

  'bookingType.accommodation': 'Hébergement',
  'bookingType.restaurant': 'Restaurant',
  'bookingType.activity': 'Activité',
  'bookingType.tour': 'Visite',
  'bookingType.ticket': 'Billet',
  'bookingType.transport': 'Trajet',
  'bookingType.other': 'Réservation',

  'role.owner': 'Propriétaire',
  'role.admin': 'Administrateur',
  'role.member': 'Membre',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} voyage',
    many: '{value} voyages',
    other: '{value} voyages',
  },
  'trips.count.favourites': {
    one: '{value} favori',
    many: '{value} favoris',
    other: '{value} favoris',
  },
  'trips.count.archived': {
    one: '{value} archivé',
    many: '{value} archivés',
    other: '{value} archivés',
  },
  'trips.atLimit.body':
    'Votre formule couvre {trips}. Archivez-en un que vous avez terminé, ou passez à une formule supérieure pour en garder plus ouverts à la fois.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Nouveau carnet',
  'newJourney.title': 'Commencer un carnet',
  'newJourney.description':
    "Un carnet est le versant écrit d'un voyage — des entrées dans l'ordre des dates, avec les photos et la météo dont vous vous souvenez.",
  'newJourney.titlePlaceholder': 'Deux semaines à Kyoto',
  'newJourney.subtitle': 'Sous-titre',
  'newJourney.subtitleHint': 'Une ligne sous le titre, en couverture.',
  'newJourney.subtitlePlaceholder':
    'Temples, trains et beaucoup trop de matcha',
  'newJourney.trip': "À partir d'un voyage",
  'newJourney.tripHint': 'Facultatif — relie le récit à son plan.',
  'newJourney.tripNone': 'Sans voyage associé',
  'newJourney.datesError': 'La date de fin précède le début.',
  'newJourney.submit': 'Créer le carnet',
  'newJourney.creating': 'Création du carnet',
  'newJourney.created': 'Carnet commencé',
  'newJourney.createdBody':
    'Ajoutez votre première entrée pour lancer le récit.',
  'newJourney.error':
    "Le carnet n'a pas pu être créé. Réessayez dans un instant.",
  'newCollection.trigger': 'Nouvelle collection',
  'newCollection.title': 'Commencer une collection',
  'newCollection.description':
    'Un endroit pour les lieux que vous trouvez avant de savoir à quel voyage ils appartiennent.',
  'newCollection.namePlaceholder': 'Un café qui vaut la traversée de la ville',
  'newCollection.descriptionHint': "Ce qui entre ici, et ce qui n'y entre pas.",
  'newCollection.submit': 'Créer la collection',
  'newCollection.creating': 'Création de la collection',
  'newCollection.created': 'Collection créée',
  'newCollection.createdBody': 'Commencez à y enregistrer des lieux.',
  'newCollection.error':
    "La collection n'a pas pu être créée. Réessayez dans un instant.",

  'newTrip.title': 'Commencer un nouveau voyage',
  'newTrip.description':
    'Un titre suffit. Les dates construisent le plan jour par jour, et le reste peut attendre que vous le sachiez.',
  'newTrip.name': 'Nom du voyage',
  'newTrip.namePlaceholder': 'Kyoto à la saison des cerisiers',
  'newTrip.destination': 'Destination',
  'newTrip.destinationHint': 'Une ville, une région, ou tout l’itinéraire.',
  'newTrip.destinationPlaceholder': 'Kyoto, Japon',
  'newTrip.departure': 'Départ',
  'newTrip.return': 'Retour',
  'newTrip.returnError': 'La date de retour précède le départ.',
  'newTrip.currency': 'Devise du budget',
  'newTrip.currencyHint': 'Chaque dépense de ce voyage y est totalisée.',
  'newTrip.currencySearch': 'Rechercher par code ou nom',
  'newTrip.currencyEmpty': 'Aucune devise ne correspond.',
  'newTrip.currencyFavourites': 'Favorites',
  'newTrip.currencyAll': 'Toutes les devises',
  'newTrip.summary': 'Résumé',
  'newTrip.summaryPlaceholder':
    'Deux semaines de temples, de trains et de ramen.',
  'newTrip.duration': 'Durée en jours',
  'newTrip.durationHint':
    'Sans dates, le voyage commence avec ce nombre de jours sans date.',
  'newTrip.durationDerived': 'Calculée à partir des deux dates.',
  'newTrip.reminder': 'Rappel avant le départ',
  'newTrip.reminderNone': 'Aucun',
  'newTrip.reminderBefore': {
    one: '{count} jour avant',
    many: '{count} de jours avant',
    other: '{count} jours avant',
  },
  'newTrip.reminderCustom': 'Personnalisé',
  'newTrip.reminderCustomDays': 'Jours avant le départ',
  'newTrip.reminderOn': 'Rappel le {date}',
  'newTrip.reminderNoDeparture':
    'Choisissez une date de départ pour voir le jour.',
  'newTrip.submit': 'Créer le voyage',
  'newTrip.creating': 'Création du voyage',
  'newTrip.error': "Le voyage n'a pas pu être créé. Réessayez dans un instant.",
  'newTrip.created': 'Voyage créé',
  'newTrip.createdBody': 'Commencez à poser des lieux sur la carte.',
  'newTrip.coverChoose': 'Ajouter une image de couverture',
  'newTrip.coverChange': 'Changer l’image de couverture',
  'newTrip.coverHint':
    'Déposez une image ici, collez-en une ou choisissez un fichier. PNG, JPEG, WebP, AVIF ou GIF.',
  'newTrip.coverChosen': 'Image de couverture : {name}',
  'newTrip.coverRemove': 'Retirer l’image de couverture',
  'newTrip.coverTypeError':
    '« {name} » ne peut pas servir d’image de couverture. Choisissez un PNG, JPEG, WebP, AVIF ou GIF.',
  'newTrip.coverSizeError':
    '« {name} » dépasse {max}. Choisissez une image plus légère.',
  'newTrip.coverUploading': 'Envoi de l’image de couverture',
  'newTrip.coverFailedTitle': 'L’image de couverture n’a pas été ajoutée',
  'newTrip.coverFailed':
    'Le voyage a été créé, mais « {name} » n’a pas pu être envoyé comme couverture.',
  'newTrip.coverRetry': 'Réessayer',
  'newTrip.coverContinue': 'Ouvrir le voyage sans couverture',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Actions pour {title}',
  'tripActions.copy': 'Copier',
  'tripActions.favourite': 'Ajouter aux favoris',
  'tripActions.unfavourite': 'Retirer des favoris',
  'tripActions.edit': 'Modifier',
  'tripActions.archive': 'Archiver',
  'tripActions.restore': 'Restaurer',
  'tripActions.delete': 'Supprimer',
  'tripActions.deleteForGood': 'Supprimer définitivement',
  'tripActions.starFailed': 'Le favori n’a pas été enregistré',
  'tripActions.starFallback': 'Le voyage a retrouvé son état précédent.',
  'tripActions.archived': 'Voyage archivé',
  'tripActions.archiveFailed': 'Le voyage n’a pas pu être archivé',
  'tripActions.restored': 'Voyage restauré',
  'tripActions.restoreFailed': 'Le voyage n’a pas pu être restauré',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Modifier le voyage',
  'editTrip.submit': 'Enregistrer les modifications',
  'editTrip.saving': 'Enregistrement du voyage',
  'editTrip.cancel': 'Annuler',
  'editTrip.saved': 'Voyage mis à jour',
  'editTrip.errorTitle': 'Cela n’a pas été enregistré',
  'editTrip.retry': 'Réessayer',
  'editTrip.error':
    'Le voyage n’a pas pu être enregistré. Réessayez dans un instant.',
  'editTrip.coverFailed':
    '« {name} » n’a pas pu être envoyé comme couverture. Rien d’autre n’a encore été enregistré.',
  'editTrip.coverContinue': 'Enregistrer sans la nouvelle couverture',
  'editTrip.currencyLocked':
    'Ce voyage contient déjà des prix : la devise du budget ne peut donc pas être modifiée ici. Utilisez Changer la devise du budget dans l’onglet Dépenses, ou remettez {current} pour enregistrer vos autres modifications.',
  'editTrip.currencyReadonly':
    'La devise du budget se change dans l’onglet Dépenses.',
  'editTrip.currencyLink': 'Ouvrir l’onglet Dépenses',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Supprimer « {title} » définitivement ?',
  'deleteTrip.description':
    'Il n’y a ni annulation ni corbeille. L’archive sort un voyage de la liste sans le perdre.',
  'deleteTrip.reading': 'Lecture du contenu de ce voyage',
  'deleteTrip.errorTitle': 'Cela n’a pas été chargé',
  'deleteTrip.summaryError': 'Le contenu de ce voyage n’a pas pu être lu.',
  'deleteTrip.confirmLabel': 'Saisissez le nom du voyage pour confirmer',
  'deleteTrip.deleting': 'Suppression du voyage',
  'deleteTrip.deleted': 'Voyage supprimé',
  'deleteTrip.failed': 'Le voyage n’a pas pu être supprimé',
  'deleteTrip.carried.reservations': {
    one: 'réservation',
    many: 'réservations',
    other: 'réservations',
  },
  'deleteTrip.carried.transports': {
    one: 'trajet',
    many: 'trajets',
    other: 'trajets',
  },
  'deleteTrip.carried.expenses': {
    one: 'dépense',
    many: 'dépenses',
    other: 'dépenses',
  },
  'deleteTrip.carried.files': {
    one: 'fichier',
    many: 'fichiers',
    other: 'fichiers',
  },
  'deleteTrip.carried.members': {
    one: 'personne',
    many: 'personnes',
    other: 'personnes',
  },
  'copyTrip.title': 'Copier « {title} »',
  'copyTrip.nameLabel': 'Nom de la copie',
  'copyTrip.titleRequired': 'Donnez un nom à la copie.',
  'copyTrip.datesLabel': 'Période',
  'copyTrip.datesTogether':
    'Renseignez les deux dates, ou effacez-les toutes les deux.',
  'copyTrip.clearDates': 'Copier sans dates',
  'copyTrip.carries':
    'Les jours, les lieux et les notes suivent. Les réservations, l’argent, les fichiers et les personnes non.',
  'copyTrip.shorter':
    'C’est plus court que l’original. Les lieux des jours en trop passent dans les idées et leurs notes sont abandonnées.',
  'copyTrip.submit': 'Copier le voyage',
  'copyTrip.copying': 'Copie du voyage en cours',
  'copyTrip.cancel': 'Annuler',
  'copyTrip.started': 'Copie de « {title} » en cours',
  'copyTrip.errorTitle': 'Cela n’a pas été copié',
  'copyTrip.error':
    'Le voyage n’a pas pu être copié. Réessayez dans un instant.',

  'trips.error': 'Vos voyages ne se sont pas chargés',
  'trips.eyebrow': 'Espace',
  'trips.nothingPlanned': 'Rien de prévu pour le moment',
  'trips.search': 'Rechercher un voyage',
  'trips.atLimit.title':
    'Vous avez utilisé tous les voyages que votre formule permet',
  'trips.atLimit.action': 'Comparer les formules',
  'trips.noMatch.title': 'Rien ne correspond à ce filtre',
  'trips.noMatch.body':
    "Changez d'étape, videz la recherche ou regardez dans les archives.",
  'trips.noMatch.action': 'Réinitialiser les filtres',
  'trips.empty.body':
    "Un voyage réunit l'itinéraire, la carte, les réservations, les listes à emporter et l'argent. Lancez-en un, le reste suit.",
  'trips.next.title': 'Quelque part ensuite',
  'trips.next.body':
    'Lancez un voyage et planned.travel crée un jour par date, prêt pour tout ce que vous avez enregistré.',
  'trips.savedPlaces': 'Lieux enregistrés',
  'trips.filter.all': 'Tous',
  'trips.filter.favourites': 'Favoris',
  'trips.view.label': 'Affichage',
  'trips.view.grid': 'Grille',
  'trips.view.list': 'Liste',
  'trips.card.favourite': 'Favori',
  'trips.card.noDestination': 'Destination encore à définir',
  'trips.card.noDates': 'Dates à définir',
  'trips.card.startsIn': 'dans {days} j',
  'trips.card.days': '{days} j',
  'trips.card.copying': 'Copie en cours',
  'trips.card.copyingLabel': '{title} est encore en cours de copie',
  'trips.card.copyingReason': 'Attendez la fin de la copie.',
  'metric.trips': 'Voyages',
  'metric.places': 'Lieux',
  'metric.members': 'Membres',
  'metric.files': 'Fichiers',
  'metric.storage_bytes': 'Stockage',
  'metric.collections': 'Sélections',
  'metric.journeys': 'Journaux',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Cela ne s’est pas chargé',
  'error.body':
    'Rien n’est perdu. Réessayez, et si cela se répète, le détail ci-dessous est ce qu’il faut nous envoyer.',
  'error.retry': 'Réessayer',
  'error.dashboard': 'Retour au tableau de bord',
  'error.reported':
    'Nous avons été prévenus et nous regardons ce qui s’est passé.',
  'error.reference': 'Référence',
  'error.feedback.open': 'Dites-nous ce qui s’est passé',
  'error.feedback.label': 'Que faisiez-vous au moment du problème ?',
  'error.feedback.send': 'Envoyer',
  'error.feedback.sent': 'Merci — cela nous aide.',
  'error.feedback.failed':
    'L’envoi n’a pas abouti. La référence ci-dessus nous parvient quand même.',
  'error.root': 'Nous voilà hors piste',
  'error.session': 'Votre accès à l’espace de travail a changé',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Signaler un problème',
  'feedback.formTitle': 'Signaler un problème',
  'feedback.messageLabel':
    'Qu’est-ce qui ne va pas, ou que faudrait-il changer ?',
  'feedback.messagePlaceholder':
    'À quoi vous attendiez-vous, et que s’est-il passé à la place ?',
  'feedback.emailLabel': 'Adresse e-mail',
  'feedback.emailPlaceholder': 'vous@example.com',
  'feedback.isRequiredLabel': '(obligatoire)',
  'feedback.submitButtonLabel': 'Envoyer le signalement',
  'feedback.cancelButtonLabel': 'Annuler',
  'feedback.confirmButtonLabel': 'Confirmer',
  'feedback.addScreenshotButtonLabel': 'Ajouter une capture d’écran',
  'feedback.removeScreenshotButtonLabel': 'Retirer la capture d’écran',
  'feedback.highlightToolText': 'Surligner',
  'feedback.hideToolText': 'Masquer',
  'feedback.successMessageText': 'Merci — nous avons bien votre signalement.',
  'feedback.errorEmptyMessageText':
    'Écrivez d’abord une phrase — un signalement vide ne nous apprend rien.',
  'feedback.errorTimeoutText':
    'Cela prend trop de temps, et nous ne pouvons pas confirmer l’envoi du signalement.',
  'feedback.errorForbiddenText':
    'Cette page n’est pas autorisée à envoyer des signalements.',
  'feedback.errorGenericText':
    'L’envoi a échoué. Vérifiez la connexion, et si un bloqueur de publicités s’interpose.',

  'notFound.eyebrow': 'Erreur 404',
  'notFound.title': 'Cette page n’est pas sur la carte',
  'notFound.body':
    'Le lien est peut-être périmé, ou le voyage qu’il visait a été déplacé ou supprimé.',
  'notFound.trips': 'Tous les voyages',
  'notFound.rootBody':
    'Nous avons cherché tout le long de la route. L’adresse comporte peut-être une faute, ou la page a changé de place depuis.',
  'notFound.home': 'Retour à l’accueil',
  'notFound.plans': 'Voir les formules',

  'session.noWorkspace':
    'Votre compte n’est rattaché à aucun espace de travail. Déconnectez-vous puis reconnectez-vous pour terminer sa mise en place.',
  'session.membershipRemoved':
    'Votre appartenance à cet espace de travail a été retirée.',
} satisfies TranslationOf<typeof En>

export default messages
