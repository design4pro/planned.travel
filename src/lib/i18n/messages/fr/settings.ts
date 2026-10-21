/**
 * Everything the settings module says, in French.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Vouvoiement, as everywhere else in the French catalogue.
 *
 * **Plural.** `Intl.PluralRules('fr')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Length is load-bearing here.** Two controls on these screens truncate: the
 * hint under each section link, and the trigger of every regional select. Each
 * `nav.*.hint` therefore stays inside the English one's width, and
 * `regional.workspaceDefault` leads with «Par défaut» rather than a full
 * translation of «workspace default», which would push the currency name out of
 * the trigger.
 *
 * **Currency names are lower case**, as French writes them, and the ISO code
 * beside them is derived in the route rather than translated.
 *
 * **Plan names are words, not proper nouns.** `Solo` and `Crew` name a way of
 * travelling, so French says «En solo» and «En groupe»; the stable identifier
 * is the plan id in `src/lib/plans.ts`, which no reader ever sees.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  'workspace.invite.invite': 'Inviter',
  'workspace.invite.resend': 'Renvoyer',
  'workspace.invite.revoke': 'Révoquer',
  'workspace.invite.confirm': 'Révoquer l’invitation',
  'workspace.invite.expired': 'Expirée',
  'workspace.invite.by': 'Invitation de {name}',
  'workspace.invite.sent': 'Invitation envoyée',
  'workspace.invite.revoked': 'Invitation révoquée',
  'workspace.invite.delivery':
    'Invitation enregistrée, mais l’envoi a échoué. Renvoyez-la.',
  'workspace.invite.duplicate':
    'Une invitation est déjà en attente. Renvoyez-la.',
  'workspace.invite.existing':
    'Cette personne est déjà membre de l’espace de travail.',
  'workspace.invite.failed':
    'Invitation indisponible. Actualisez la liste et réessayez.',
  'workspace.invite.reload': 'Actualiser les invitations',

  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Compte',
  'page.title': 'Réglages',
  'page.description':
    'Tout ce qui vous concerne, votre espace de travail et la façon dont planned.travel se comporte',
  'page.error': 'Les réglages ne se sont pas chargés',

  'nav.label': 'Sections des réglages',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Vous, les dates et l’argent',
  'nav.language': 'Langue',
  'nav.language.hint': 'La langue de chaque écran',
  'nav.appearance': 'Apparence',
  'nav.appearance.hint': 'Thème, animations et carte',
  'nav.security': 'Sécurité',
  'nav.security.hint': 'Mot de passe, codes, clés',
  'nav.notifications': 'Vos notifications',
  'nav.notifications.hint': 'Boîte, e-mails et mobile',
  'nav.workspace': 'Espace de travail',
  'nav.workspace.hint': 'Membres et réglages communs',
  'nav.billing': 'Facturation',
  'nav.billing.hint': 'Formule, places et factures',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Enregistrer les modifications',
  'error.retryBody': 'Rien n’est perdu. Vérifiez votre connexion et réessayez.',
  'role.owner': 'Propriétaire',
  'role.admin': 'Administrateur',
  'role.member': 'Membre',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Par défaut — {value}',
  'regional.currency.AUD': 'dollar australien',
  'regional.currency.CAD': 'dollar canadien',
  'regional.currency.CHF': 'franc suisse',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'livre sterling',
  'regional.currency.JPY': 'yen japonais',
  'regional.currency.PLN': 'zloty polonais',
  'regional.currency.SEK': 'couronne suédoise',
  'regional.currency.USD': 'dollar américain',
  'regional.distance.metric': 'Kilomètres',
  'regional.distance.imperial': 'Milles',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Votre profil ne s’est pas chargé',
  'profile.account.title': 'Votre compte',
  'profile.account.description':
    'Votre nom et votre e-mail viennent du compte avec lequel vous vous connectez.',
  'profile.email.verified': 'Adresse vérifiée',
  'profile.email.unverified': 'Adresse non vérifiée',
  'profile.twoFactor.on': 'Double authentification active',
  'profile.figure.workspace': 'Espace de travail',
  'profile.figure.role': 'Rôle',
  'profile.figure.joined': 'Membre depuis',
  'profile.figure.joinedUnknown': 'Non enregistré',
  'profile.regional.title': 'Dates, argent et unités',
  'profile.regional.description':
    'Ces réglages remplacent ceux de l’espace de travail, pour vous seul. Laissez-en un tel quel et il suit l’espace.',
  'profile.regional.saving': 'Enregistrement de vos préférences',
  'profile.regional.saved': 'Vos préférences sont enregistrées',
  'profile.regional.saveFailed': 'Vos préférences n’ont pas été enregistrées',
  'profile.language.label': 'Langue',
  'profile.language.hint':
    'Choisie sur son propre écran, où chaque langue est écrite dans son écriture.',
  'profile.language.action': 'Changer',
  'profile.timezone.label': 'Fuseau horaire',
  'profile.timezone.hint':
    'Les heures de départ et d’arrivée sont affichées dans ce fuseau.',
  'profile.currency.label': 'Devise',
  'profile.currency.hint':
    'Les nouveaux voyages démarrent dans cette devise ; chacun peut en changer.',
  'profile.dateFormat.label': 'Format de date',
  'profile.weekStart.label': 'La semaine commence le',
  'profile.weekStart.hint':
    'Vaut pour tous les calendriers, y compris la grille annuelle des vacances.',
  'profile.distance.label': 'Unité de distance',

  /* --------------------------------------------------------------- language */
  'language.error': 'Vos réglages de langue ne se sont pas chargés',
  'language.section.title': 'Langue',
  'language.section.description':
    'Chaque écran, chaque bouton et chaque date se lisent dans la langue choisie ici — vingt-trois, chacune écrite dans sa propre écriture.',
  'language.label': 'Choisissez une langue',
  'language.followWorkspace': 'Suivre l’espace de travail',
  'language.state.yours': 'Votre langue',
  'language.state.workspace': 'Fournie par l’espace de travail',
  'language.state.hint.override':
    'Votre propre choix. Il vaut pour vous seul, sur tous les appareils depuis lesquels vous vous connectez.',
  'language.state.hint.workspace':
    'Vous n’avez pas de langue à vous\u00a0: vous lisez celle de l’espace de travail. Un propriétaire ou un administrateur peut la changer dans Espace de travail.',
  'language.saved': 'planned.travel parle maintenant {language}',
  'language.saveFailed': 'Votre langue n’a pas été changée',
  'language.saveFailedBody':
    'Rien n’est perdu et vous lisez toujours {language}. Vérifiez votre connexion, puis choisissez de nouveau.',
  'language.reload.title': 'Votre langue est enregistrée',
  'language.reload.body':
    'Cette page n’a pas pu terminer le passage à {language}. Rechargez-la pour lire le produit dans votre nouvelle langue.',
  'language.sample.title': 'Comment se liront les dates et les nombres',
  'language.sample.description':
    'Les trois mêmes valeurs, écrites comme cette langue les écrit.',
  'language.sample.date': 'Une date',
  'language.sample.number': 'Un nombre',
  'language.sample.money': 'Un montant',
  'language.legal':
    'Les conditions et la politique de confidentialité ne sont publiées qu’en anglais. Tout le reste du produit est traduit.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'L’apparence ne s’est pas chargée',
  'appearance.theme.title': 'Thème',
  'appearance.theme.description':
    'Les deux thèmes sont dessinés, pas inversés. Prenez celui que vous lisez le plus confortablement.',
  'appearance.theme.light': 'Clair',
  'appearance.theme.lightHint': 'Papier chaud, toute la journée',
  'appearance.theme.dark': 'Sombre',
  'appearance.theme.darkHint': 'Charbon chaud, jamais noir',
  'appearance.theme.system': 'Système',
  'appearance.theme.systemHint': 'Suivre l’appareil',
  'appearance.theme.showing': 'Palette {palette} à l’écran.',
  'appearance.theme.showingSystem':
    'Palette {palette} à l’écran, d’après votre appareil.',
  'appearance.palette.light': 'claire',
  'appearance.palette.dark': 'sombre',
  'appearance.motion.title': 'Animations et cartes',
  'appearance.motion.label': 'Réduire les animations',
  'appearance.motion.hint':
    'Réduit les animations d’entrée à un simple fondu. Le réglage de réduction des animations de votre système est toujours respecté, lui aussi.',
  'appearance.map.label': 'Style de carte',
  'appearance.map.hint':
    'Le fond de carte utilisé par le planificateur et la carte du monde.',
  'appearance.map.workspace': 'Suivre l’espace de travail',
  'appearance.map.workspaceHint':
    'Le choix du propriétaire de l’espace de travail.',
  'appearance.map.auto': 'Automatique',
  'appearance.map.autoHint': 'Suit votre thème clair ou sombre.',
  'appearance.map.paper': 'Papier',
  'appearance.map.paperHint': 'Chaud et clair, quel que soit votre thème.',
  'appearance.map.charcoal': 'Charbon',
  'appearance.map.charcoalHint': 'Chaud et sombre, quel que soit votre thème.',
  'appearance.map.quiet': 'Discret',
  'appearance.map.quietHint':
    'Sans noms de rues, pour que vos épingles ressortent d’abord.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Sur un écran partagé',
  'appearance.privacy.codesLabel':
    'Masquer les codes de confirmation jusqu’à ce que je les demande',
  'appearance.privacy.codesHint':
    'Les références de réservation et les numéros de confirmation restent masqués sur le bureau des réservations et sur les transports jusqu’à ce que vous cliquiez dessus ou les touchiez, et se masquent de nouveau dès que vous passez à autre chose. Les prix ne sont jamais masqués.',
  'appearance.saveFailed': 'Ce changement n’a pas été enregistré',
  'appearance.saveFailedBody':
    'Il s’applique ici, mais le prochain appareil depuis lequel vous vous connecterez ne l’aura pas.',

  /* --------------------------------------------------------------- security */
  'security.error': 'La sécurité ne s’est pas chargée',
  'security.unverified.title': 'Votre adresse e-mail n’est pas encore vérifiée',
  'security.unverified.body':
    'Les réinitialisations de mot de passe et les invitations aux voyages sont envoyées à {email}. La vérifier, c’est prouver que l’adresse est bien la vôtre.',
  'security.unverified.action': 'Renvoyer le lien',
  'security.signin.title': 'Connexion',
  'security.signin.description':
    'Comment vous prouvez que c’est vous. La double authentification et les clés d’accès sont toutes deux plus solides qu’un mot de passe seul.',
  'security.email.label': 'Adresse e-mail',
  'security.email.verified': 'Vérifiée',
  'security.email.unverified': 'Non vérifiée',
  'security.password.label': 'Mot de passe',
  'security.password.hint':
    'Changez-le quand vous voulez — un lien à usage unique vous sera envoyé plutôt qu’une demande de l’ancien.',
  'security.password.action': 'Changer de mot de passe',
  'security.twoFactor.label': 'Double authentification',
  'security.twoFactor.onHint':
    'Un code de votre application est demandé lors de la connexion par e-mail et mot de passe, sauf si ce navigateur est approuvé.',
  'security.twoFactor.offHint':
    'Ajoutez un code à six chiffres d’une application d’authentification par-dessus votre mot de passe.',
  'security.twoFactor.on': 'Active',
  'security.twoFactor.off': 'Inactive',
  'security.twoFactor.manage': 'Gérer',
  'security.twoFactor.enable': 'Activer',
  'security.passkeys.label': 'Clés d’accès',
  'security.passkeys.hint':
    'Connectez-vous avec le lecteur d’empreinte, Face ID ou une clé de sécurité, sans rien saisir.',
  'security.passkeys.action': 'Gérer les clés d’accès',
  'security.session.title': 'Cette session',
  'security.session.description': 'Le navigateur dans lequel vous lisez ceci.',
  'security.session.label': 'Connecté en tant que',
  'security.session.expires': 'Expire {date}',
  'security.session.expiresSoon': 'bientôt',
  'security.session.noExpiry': 'Aucune expiration enregistrée',
  'security.signOut.label': 'Se déconnecter',
  'security.signOut.hint':
    'Met fin à cette session et vous ramène à la page de connexion. Les autres appareils restent connectés.',
  'security.signOut.pending': 'Déconnexion en cours',
  'security.signOut.failed': 'Vous n’avez pas été déconnecté',
  'security.signOut.failedBody': 'Vérifiez votre connexion et réessayez.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Les réglages de notification ne se sont pas chargés',
  'notifications.title': 'Vos notifications',
  'notifications.description':
    'Chaque interrupteur ne vaut que pour vous. En couper un n’empêche jamais l’événement d’avoir lieu — cela empêche seulement qu’on vous en parle.',
  'notifications.caption': 'Quelles notifications atteignent quel canal',
  'notifications.event': 'Événement',
  'notifications.switch': '{event}\u00a0: {channel}',
  'notifications.saveFailed': 'Cette préférence n’a pas été enregistrée',
  'notifications.saveFailedBody':
    'L’interrupteur a été remis en place. Vérifiez votre connexion et réessayez.',
  'notifications.channel.in_app': 'Dans l’application',
  'notifications.channel.in_app.hint': 'La cloche de la barre du haut',
  'notifications.channel.email': 'E-mail',
  'notifications.channel.email.hint': 'Vers votre adresse de connexion',
  'notifications.channel.push': 'Mobile',
  'notifications.channel.push.hint':
    'Sur les appareils où vous l’avez autorisé',
  'notifications.event.trip.invited': 'Invitations aux voyages',
  'notifications.event.trip.invited.hint':
    'Quelqu’un vous ajoute à un voyage qu’il prépare.',
  'notifications.event.trip.updated': 'Changements de programme',
  'notifications.event.trip.updated.hint':
    'Une journée, une étape ou une date bouge sur un voyage où vous êtes.',
  'notifications.event.trip.starting_soon': 'Rappels de départ',
  'notifications.event.trip.starting_soon.hint':
    'Un rappel dans les jours qui précèdent un départ.',
  'notifications.event.reservation.reminder': 'Rappels de réservation',
  'notifications.event.reservation.reminder.hint':
    'Un hébergement, une table ou un billet approche.',
  'notifications.event.expense.added': 'Nouvelles dépenses',
  'notifications.event.expense.added.hint':
    'Quelqu’un note de l’argent dépensé sur un voyage partagé.',
  'notifications.event.expense.settled': 'Comptes soldés',
  'notifications.event.expense.settled.hint':
    'Un solde auquel vous participiez a été réglé.',
  'notifications.event.list.assigned': 'Éléments attribués',
  'notifications.event.list.assigned.hint':
    'Quelque chose d’une liste de bagages ou de tâches devient le vôtre.',
  'notifications.event.collab.message': 'Conversation du voyage',
  'notifications.event.collab.message.hint':
    'Nouveaux messages dans un voyage auquel vous participez.',
  'notifications.event.organization.invited': 'Invitations aux espaces',
  'notifications.event.organization.invited.hint':
    'On vous invite dans un espace de travail.',

  'notifications.event.billing.plan_changed': 'Changements d’abonnement',
  'notifications.event.billing.plan_changed.hint':
    'Votre espace de travail change de formule.',
  'notifications.event.billing.invoice_paid': 'Reçus de paiement',
  'notifications.event.billing.invoice_paid.hint':
    'Une facture de votre espace de travail a été réglée.',
  'notifications.event.billing.payment_failed': 'Problèmes de paiement',
  'notifications.event.billing.payment_failed.hint':
    'Un prélèvement pour votre espace de travail a échoué.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'L’espace de travail ne s’est pas chargé',
  'workspace.summary.description': 'Formule {plan} · créé le {date}',
  'workspace.summary.createdRecently': 'récemment',
  'workspace.summary.billingAction': 'Formule et facturation',
  'workspace.seats.label': 'Places occupées',
  'workspace.seats.value': '{used} sur {limit}',
  'workspace.seats.note':
    'Les invitations en attente comptent dans vos places\u00a0: un espace ne peut donc jamais dépasser la formule qu’il paie.',
  'workspace.seatsFull.title': 'Toutes les places de cette formule sont prises',
  'workspace.seatsFull.body':
    '{members} et {invitations} remplissent les {limit} places.',
  'workspace.seatsFull.action': 'Ajouter des places',
  'workspace.members.count': {
    one: '{value} membre',
    many: '{value} membres',
    other: '{value} membres',
  },
  'workspace.invitations.count': {
    one: '{value} invitation en attente',
    many: '{value} invitations en attente',
    other: '{value} invitations en attente',
  },
  'workspace.members.title': 'Membres',
  'workspace.members.description':
    'Toutes les personnes qui voient les voyages, les comptes et les fichiers de cet espace.',
  'workspace.members.tableLabel': 'Membres de cet espace de travail',
  'workspace.members.person': 'Personne',
  'workspace.members.role': 'Rôle',
  'workspace.members.joined': 'Arrivée',
  'workspace.invitations.title': 'Invitations en attente',
  'workspace.invitations.description':
    'Les personnes invitées qui n’ont pas encore rejoint l’espace.',
  'workspace.invitations.emptyTitle': 'Aucune invitation en attente',
  'workspace.invitations.emptyBody':
    'Toutes les personnes invitées dans cet espace l’ont déjà rejoint.',
  'workspace.invitations.expires': 'Expire {date}',
  'workspace.invitations.expiresSoon': 'bientôt',
  'workspace.defaults.title': 'Réglages communs',
  'workspace.defaults.description':
    'Ce avec quoi démarrent un nouveau voyage et un nouveau membre. Chacun peut les remplacer pour lui-même dans son profil.',
  'workspace.defaults.readOnly': 'Lecture seule',
  'workspace.defaults.saving': 'Enregistrement des réglages communs',
  'workspace.defaults.saved': 'Les réglages communs sont enregistrés',
  'workspace.defaults.saveFailed':
    'Les réglages communs n’ont pas été enregistrés',
  'workspace.defaults.saveFailedBody':
    'Seul un propriétaire ou un administrateur peut les changer. Vérifiez votre connexion, puis réessayez.',
  'workspace.currency.label': 'Devise par défaut',
  'workspace.currency.hint': 'Les nouveaux voyages sont budgétés dedans.',
  'workspace.language.label': 'Langue',
  'workspace.language.hint':
    'Ce que lit un membre qui n’a pas choisi de langue à lui.',
  'workspace.timezone.label': 'Fuseau horaire',
  'workspace.dateFormat.label': 'Format de date',
  'workspace.weekStart.label': 'La semaine commence le',
  'workspace.distance.label': 'Unité de distance',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'La facturation ne s’est pas chargée',
  'billing.loading': 'Chargement de la formule et de ses reçus',
  'billing.status.none': 'Aucun abonnement',
  'billing.status.trialing': 'Essai',
  'billing.status.active': 'Actif',
  'billing.status.past_due': 'Paiement refusé',
  'billing.status.unpaid': 'Impayé',
  'billing.status.paused': 'En pause',
  'billing.status.canceled': 'Résilié',
  'billing.status.incomplete': 'Incomplet',
  'billing.status.incomplete_expired': 'Expiré',

  'billing.checkout.completeTitle': 'Paiement reçu',
  'billing.checkout.completeBody':
    'Votre nouvelle formule est en cours d’application. Elle apparaît ici dès que Polar la confirme — en général en quelques secondes.',
  'billing.checkout.cancelledTitle': 'Paiement abandonné',
  'billing.checkout.cancelledBody':
    'Rien n’a été débité et votre formule n’a pas changé.',
  'billing.portal.backTitle': 'De retour de Polar',
  'billing.portal.backBody':
    'Ce que vous y avez changé arrive ici dès que Polar le confirme.',
  'billing.refresh': 'Actualiser',
  'billing.readOnly.title': 'Vous êtes membre de cet espace de travail',
  'billing.readOnly.body':
    'Seul un propriétaire ou un administrateur peut changer l’abonnement. Tout ce qui suit est en lecture seule pour vous.',

  'billing.hero.label': 'Formule en cours',
  'billing.hero.endsAtPeriod': 'Prend fin à la clôture de la période',
  'billing.hero.perYear': '/ an',
  'billing.hero.perMonth': '/ mois',
  'billing.hero.freeAllowance': '{trips} voyages, un voyageur',
  'billing.hero.perSeatLine': '{seats} membres × {price}',
  'billing.hero.singleTraveller': 'Un voyageur',
  'billing.price.free': 'Gratuit',
  'billing.provider.opening': 'Ouverture de Polar',
  'billing.renewal.trialEndsToday':
    "Votre essai se termine aujourd'hui. Le premier prélèvement suit, sauf si vous annulez avant.",
  'billing.renewal.trialEndsIn': {
    one: 'Votre essai se termine dans {value} jour, puis le premier prélèvement suit, sauf si vous annulez avant.',
    many: 'Votre essai se termine dans {value} jours, puis le premier prélèvement suit, sauf si vous annulez avant.',
    other:
      'Votre essai se termine dans {value} jours, puis le premier prélèvement suit, sauf si vous annulez avant.',
  },
  'billing.renewal.trialEnded': 'Votre essai est terminé.',
  'billing.renewal.endsNoDate':
    'Cette formule est prévue pour s’arrêter et ne sera pas reconduite.',
  'billing.renewal.endsOn':
    'Cette formule s’arrête le {date}. Rien n’est supprimé — les modules payants se verrouillent, voilà tout.',
  'billing.renewal.pastDue':
    'Le dernier paiement n’est pas passé. Mettez votre carte à jour pour ne pas perdre les modules payants.',
  'billing.renewal.unpaid':
    'Cet abonnement est impayé et les modules payants sont verrouillés.',
  'billing.renewal.paused':
    'Cet abonnement est en pause. Reprenez-le quand vous serez prêt à repartir.',
  'billing.renewal.lapsed':
    'Choisissez une formule ci-dessous pour rouvrir les réservations et le journal.',
  'billing.renewal.incomplete':
    'Polar attend encore la confirmation de ce paiement.',
  'billing.renewal.free':
    'Deux voyages à la fois, offerts. Changez de formule le jour où cela devient étroit.',
  'billing.renewal.auto': 'Reconduction automatique.',
  'billing.renewal.renewsOn': 'Reconduction le {date}.',

  'billing.usage.title': 'Consommation',
  'billing.usage.description':
    'Comptée en direct, donc aucun compteur n’est périmé. Les limites suivent la formule en vigueur à l’instant.',
  'billing.quota.seats': 'Membres',
  'billing.quota.trips': 'Voyages',
  'billing.quota.storageBytes': 'Stockage',
  'billing.quota.unlimited': 'Illimité',
  'billing.quota.places': 'Lieux',
  'billing.quota.placesHint': 'Sur tous les voyages de cet espace de travail',
  'billing.quota.exhausted.places': 'Le quota de lieux est épuisé',
  'billing.quota.over.places': 'Limite de lieux dépassée de {value}',
  'billing.quota.noLimit': 'Aucune limite sur cette formule',
  'billing.quota.used': '{quota} utilisés',
  'billing.quota.over.seats': {
    one: '{value} place au-dessus de la limite de cette formule',
    many: '{value} places au-dessus de la limite de cette formule',
    other: '{value} places au-dessus de la limite de cette formule',
  },
  'billing.quota.over.trips': {
    one: '{value} voyage au-dessus de la limite de cette formule',
    many: '{value} voyages au-dessus de la limite de cette formule',
    other: '{value} voyages au-dessus de la limite de cette formule',
  },
  'billing.quota.over.storage':
    '{value} au-dessus de la limite de cette formule',
  'billing.quota.exhausted.seats':
    'Toutes les places de cette formule sont prises',
  'billing.quota.exhausted.trips':
    'Tous les emplacements de voyage de cette formule servent déjà',
  'billing.quota.exhausted.storage': 'Le stockage de cette formule est plein',
  'billing.quota.left': 'Il reste {value}',

  'billing.plans.title': 'Formules',
  'billing.plans.description':
    'Changez de formule quand vous voulez. Une montée en gamme est calculée au jour près ; une baisse attend la fin de la période déjà payée.',
  'billing.interval.label': 'Période de facturation',
  'billing.interval.monthly': 'Mensuelle',
  'billing.interval.yearly': 'Annuelle',
  'billing.plan.free.name': 'Gratuite',
  'billing.plan.free.tagline': 'Préparez vos deux prochains voyages',
  'billing.plan.free.feature.trips':
    'Deux voyages à la fois et jusqu’à 150 lieux',
  'billing.plan.free.feature.itinerary': 'Programme jour par jour et carte',
  'billing.plan.free.feature.lists': 'Listes de bagages et budgets simples',
  'billing.plan.free.feature.atlas':
    'La carte du monde qui retient où vous êtes allé',
  'billing.plan.solo.name': 'En solo',
  'billing.plan.solo.tagline': 'Pour le voyageur qui prépare tout',
  'billing.plan.solo.feature.trips': 'Voyages et lieux illimités',
  'billing.plan.solo.feature.modules':
    'Tous les modules — réservations, journal, budgets, bagages',
  'billing.plan.solo.feature.storage': '5 Go pour les photos et documents',
  'billing.plan.solo.feature.export': 'Export PDF et calendrier',
  'billing.plan.crew.name': 'En groupe',
  'billing.plan.crew.tagline': 'Pour les familles, les amis et les équipes',
  'billing.plan.crew.feature.members':
    'Jusqu’à dix membres, facturés par personne',
  'billing.plan.crew.feature.realtime':
    'Collaboration en direct, curseurs compris',
  'billing.plan.crew.feature.everything':
    'Voyages et lieux illimités et tous les modules',
  'billing.plan.crew.feature.storage':
    'De la place partagée pour les photos et les documents de tout le monde',

  'billing.plan.current': 'Formule en cours',
  'billing.plan.currentBadge': 'En cours',
  'billing.plan.popular': 'La plus choisie',
  'billing.plan.switchYearly': 'Passer à l’année',
  'billing.plan.switchMonthly': 'Passer au mois',
  'billing.plan.upgradeTo': 'Monter vers {plan}',
  'billing.plan.changeTo': 'Changer pour {plan}',
  'billing.plan.perMemberMonth': '/ membre / mois',
  'billing.plan.perMonth': '/ mois',
  'billing.plan.alwaysFree': 'Toujours gratuite, sans carte',
  'billing.plan.billedYearly': '{amount} facturés à l’année',
  'billing.plan.billedMonthly': '{amount} facturés au mois',
  'billing.plan.members': 'Membres',
  'billing.plan.membersHint': 'Modifiable à tout moment — la facture suit.',
  'billing.plan.seatOption': {
    one: '{value} membre',
    many: '{value} membres',
    other: '{value} membres',
  },

  'billing.invoices.number': 'Facture',
  'billing.invoices.date': 'Date d’émission',
  'billing.invoices.amount': 'Montant',
  'billing.invoices.status': 'Statut',
  'billing.invoice.paid': 'Payée',
  'billing.invoice.draft': 'Brouillon',
  'billing.invoice.void': 'Annulée',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Le prestataire de paiement a refusé cette demande. Réessayez dans un instant.',
  'billing.failure.reference':
    'Référence à communiquer au support : {reference}',
  'billing.failure.forbidden':
    'Votre rôle ne permet pas cela pour la facturation de cet espace de travail. Demandez à un propriétaire ou à un administrateur.',
  'billing.failure.providerRefused':
    'Polar n’a pas accepté cette modification. Comparez le nombre de places à vos membres, puis réessayez ou utilisez le portail de facturation.',
  'billing.failure.rateLimited':
    'Polar est très sollicité en ce moment. Rien n’a été modifié. Réessayez dans une minute.',
  'billing.failure.notConnected':
    'La facturation n’est pas encore connectée sur ce déploiement, donc rien n’a été modifié. Contactez le support.',
  'billing.failure.orderNotInvoiceable':
    'Polar ne peut pas émettre de facture pour cette commande. S’il manque le nom ou l’adresse de facturation, ajoutez-les dans le portail de facturation et réessayez ; sinon, contactez le support.',
  'billing.planChanged.title': 'Formule mise à jour',
  'billing.planChanged.body':
    "Le changement est déjà effectif chez Polar, qui facturera la différence. Le récapitulatif ci-dessous se met à jour en moins d'une minute.",
  'billing.discount.toggle': 'Vous avez un code promo ?',
  'billing.discount.label': 'Code promo',
  'billing.discount.hint': 'Appliqué à la formule que vous choisirez ensuite.',
  'billing.discount.hintCurrent':
    'Appliquez-le à votre formule actuelle ou choisissez une formule ci-dessous.',
  'billing.discount.applyCurrent': 'Appliquer à la formule actuelle',
  'billing.discount.applying': 'Application du code…',
  'billing.discount.invalidFormat':
    'Un code compte de 3 à 64 lettres et chiffres.',
  'billing.discount.rejected.invalid':
    'Ce code n’est pas valide. Vérifiez-le et réessayez.',
  'billing.discount.rejected.rateLimited':
    'Trop de codes essayés. Réessayez dans une heure.',
  'billing.discount.rejected.notApplicable':
    'Ce code ne s’applique pas à cette formule.',
  'billing.discount.rejected.busy':
    'Impossible de vérifier les codes pour le moment. Réessayez dans une minute.',
  'billing.discount.nextRenewal':
    'Votre code promo s’applique à partir de votre prochain renouvellement.',
  'billing.discount.appliedTitle': 'Code promo appliqué',
  'billing.hero.manage': 'Gérer la facturation',
  'billing.hero.manageHint':
    'Cartes, adresse de facturation, numéro de TVA, reçus et résiliation sont chez Polar, qui émet la facture.',
  'billing.hero.manageHintNone':
    "Il n'y a pas encore de profil de facturation. Choisir une formule payante ci-dessous en crée un, et le portail s'ouvre ensuite.",
  'billing.portal.opening': 'Ouverture du portail de facturation',
  'billing.plan.notApplied': "Ce changement n'a pas été appliqué",
  'billing.plan.cancelInPortal': 'Résilier dans le portail',
  'billing.plan.seatsOverMax': {
    one: 'Cet espace compte {members} membres et {plan} en facture {max} au maximum. Retirez {value} membre avant de changer.',
    many: 'Cet espace compte {members} membres et {plan} en facture {max} au maximum. Retirez {value} membres avant de changer.',
    other:
      'Cet espace compte {members} membres et {plan} en facture {max} au maximum. Retirez {value} membres avant de changer.',
  },
  'billing.plan.seatsBelowMembers':
    'Vous avez {members} membres. Choisissez au moins autant de places — Polar refuse un abonnement comptant moins de places que d’affectations.',
  'billing.orders.title': 'Commandes',
  'billing.orders.description':
    'Toutes les commandes de cet espace, la plus récente en premier.',
  'billing.orders.receipts': 'Tous les reçus',
  'billing.orders.unavailableTitle': 'Les commandes ne se chargent pas',
  'billing.orders.unavailableBody':
    "Polar n'a pas répondu à temps pour l'historique. Tout ce qui précède est à jour — réessayez dans un instant ou consultez le relevé complet dans le portail de facturation.",
  'billing.orders.emptyTitle': 'Aucune commande',
  'billing.orders.emptyCustomer':
    "La première facture apparaît ici dès la clôture d'une période de facturation.",
  'billing.orders.emptyNoCustomer':
    'Cet espace n’a jamais été facturé. Choisissez une formule payante et les factures se rassembleront ici.',
  'billing.orders.tableLabel': 'Historique des commandes',
  'billing.orders.document': 'Document',
  'billing.orders.dateUnknown': 'Date inconnue',
  'billing.order.pending': 'En attente',
  'billing.order.refunded': 'Remboursée',
  'billing.order.partiallyRefunded': 'Partiellement remboursée',
  'billing.order.noInvoiceDraft':
    'Pas de facture tant que la commande est un brouillon',
  'billing.order.preparing': 'Préparation',
  'billing.order.renderingHint':
    'Polar génère encore la facture {number}. Le téléchargement revient dans quelques secondes.',
  'billing.order.fetching': 'Récupération de la facture',
  'billing.order.generating': 'Polar prépare la facture',
  'billing.order.pdfLabel': 'Facture {number} en PDF',
  'billing.order.stillWritingTitle': 'Polar rédige encore cette facture',
  'billing.order.stillWritingBody':
    'La facture {number} est en cours de génération. Le téléchargement revient de lui-même dans quelques secondes.',
  'billing.order.openFailed': "Cette facture ne s'est pas ouverte",
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Compte',
  'passkeys.page.title': 'Clés d’accès',
  'passkeys.page.description':
    'Une clé d’accès vous permet de vous connecter avec votre empreinte, votre visage ou une clé de sécurité, sans rien saisir.',
  'passkeys.page.back': 'Retour à la sécurité',
  'passkeys.list.label': 'Vos clés d’accès',
  'passkeys.add.action': 'Ajouter une clé d’accès',
  'passkeys.add.loading': 'En attente de votre appareil',
  'passkeys.add.added': 'Clé d’accès ajoutée',
  'passkeys.add.dismissed': 'Aucune clé d’accès n’a été ajoutée',
  'passkeys.add.exists':
    'Cet appareil a déjà une clé d’accès pour votre compte',
  'passkeys.add.failed': 'La clé d’accès n’a pas été ajoutée. Réessayez.',
  'passkeys.add.stale': 'Pour votre sécurité, reconnectez-vous pour continuer.',
  'passkeys.error.sessionEnded':
    'Votre session est terminée. Reconnectez-vous pour continuer.',
  'passkeys.signInAgain': 'Se reconnecter',
  'passkeys.add.limit':
    'Vous avez atteint la limite de {value} clés d’accès. Supprimez-en une pour en ajouter une autre.',
  'passkeys.add.unsupported':
    'Ce navigateur ne peut pas créer de clés d’accès. Essayez un autre navigateur ou un autre appareil.',
  'passkeys.empty.title': 'Aucune clé d’accès pour l’instant',
  'passkeys.empty.body':
    'Ajoutez-en une et connectez-vous avec votre empreinte, votre visage ou une clé de sécurité, sans rien saisir.',
  'passkeys.row.fallbackName': 'Clé d’accès · ajoutée le {date}',
  'passkeys.row.added': 'Ajoutée le {date}',
  'passkeys.row.lastUsed': 'Dernière utilisation : {date}',
  'passkeys.row.neverUsed': 'Pas encore utilisée pour se connecter',
  'passkeys.badge.synced': 'Synchronisée',
  'passkeys.badge.singleDevice': 'Sur un seul appareil',
  'passkeys.error.title': 'Vos clés d’accès ne se sont pas chargées',
  'passkeys.error.retry': 'Réessayer',
  'passkeys.error.rateLimited':
    'Trop de tentatives. Réessayez dans quelques minutes.',
  'passkeys.error.generic': 'Vérifiez votre connexion et réessayez.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': 'Renommer {name}',
  'passkeys.rename.fieldLabel': 'Nommez cette clé d’accès',
  'passkeys.rename.placeholder': 'Donnez-lui un nom, par exemple Téléphone pro',
  'passkeys.rename.saving': 'Enregistrement du nom',
  'passkeys.rename.saved': 'Nom enregistré',
  'passkeys.rename.failed': 'Le nom n’a pas été enregistré',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': 'Supprimer {name}',
  'passkeys.delete.title': 'Supprimer cette clé d’accès ?',
  'passkeys.delete.body': 'Vous ne pourrez plus vous connecter avec {name}.',
  'passkeys.delete.password': 'Mot de passe',
  'passkeys.delete.passwordHint':
    'Saisissez votre mot de passe pour confirmer.',
  'passkeys.delete.confirmOnly':
    'Votre compte n’a pas de mot de passe. Confirmez que vous voulez supprimer cette clé d’accès.',
  'passkeys.delete.confirm': 'Supprimer la clé d’accès',
  'passkeys.delete.cancel': 'Annuler',
  'passkeys.delete.wrongPassword': 'Ce mot de passe n’est pas le bon.',
  'passkeys.delete.stale':
    'Pour votre sécurité, reconnectez-vous avant de supprimer une clé d’accès.',
  'passkeys.delete.removed': 'Clé d’accès supprimée',
  'passkeys.delete.failed': 'La clé d’accès n’a pas été supprimée. Réessayez.',
  'passkeys.delete.removing': 'Suppression de la clé d’accès',
  'passkeys.delete.passwordRequired':
    'Saisissez votre mot de passe pour supprimer cette clé d’accès.',
  'workspace.departure.leave': 'Quitter l’espace de travail',
  'workspace.departure.remove': 'Retirer le membre',
  'workspace.departure.title': 'Mettre fin à l’adhésion à {workspace} ?',
  'workspace.departure.body':
    '{name} perdra l’accès à {workspace}. Son compte ainsi que les voyages et les relevés de frais conservés resteront.',
  'workspace.departure.cancel': 'Annuler',
  'workspace.departure.pending': 'Fin de l’adhésion…',
  'workspace.departure.lastOwner':
    'Désignez un autre membre comme propriétaire avant de quitter cet espace ou de retirer ce propriétaire.',
  'workspace.departure.notPermitted':
    'Votre rôle actuel ne permet pas de retirer ce membre. Actualisez la liste des membres avant de réessayer.',
  'workspace.departure.notFound':
    'Cette personne n’est plus membre de cet espace de travail.',
  'workspace.departure.impersonated':
    'Arrêtez l’usurpation d’identité avant de modifier l’adhésion à l’espace de travail.',
  'workspace.departure.failed':
    'Le résultat n’a pas pu être confirmé. Rechargez l’espace de travail avant de réessayer.',
  'workspace.departure.removed': 'Membre supprimé',
  'workspace.departure.reload': 'Recharger l’espace de travail',
  'workspace.departure.activationFailed':
    'Vous avez quitté cet espace de travail. Ouvrez le suivant pour continuer.',
  'workspace.departure.recover': 'Ouvrir le prochain espace',
  'twoFactor.back': 'Retour à la sécurité',
  'twoFactor.title': 'Authentification à deux facteurs',
  'twoFactor.description':
    'Ajoutez une étape lors de la connexion par e-mail et mot de passe.',
  'twoFactor.error': 'Impossible de charger vos paramètres à deux facteurs.',
  'twoFactor.steps.label': 'Configurer les deux facteurs',
  'twoFactor.steps.password': 'Confirmez votre identité',
  'twoFactor.steps.key': 'Ajoutez la clé à votre application',
  'twoFactor.steps.confirm': 'Saisissez un code',
  'twoFactor.steps.state.done': 'Terminé',
  'twoFactor.steps.state.current': 'Étape actuelle',
  'twoFactor.steps.state.todo': 'Non commencé',
  'twoFactor.password.label': 'Votre mot de passe',
  'twoFactor.password.hint':
    'Nous le redemandons avant de modifier votre connexion.',
  'twoFactor.password.submit': 'Continuer',
  'twoFactor.password.pending': 'Configuration en cours',
  'twoFactor.password.invalid': 'Ce mot de passe est incorrect.',
  'twoFactor.key.intro':
    'Il vous faut une application d’authentification sur votre téléphone. Ajoutez-y cette clé, puis revenez ici. Les deux facteurs ne sont pas encore activés.',
  'twoFactor.key.label': 'Clé de configuration',
  'twoFactor.key.copy': 'Copier la clé',
  'twoFactor.key.copied': 'Clé copiée',
  'twoFactor.key.copyFailed':
    'Votre navigateur n’a pas copié la clé. Sélectionnez-la et copiez-la manuellement.',
  'twoFactor.key.open': 'Ouvrir dans votre application d’authentification',
  'twoFactor.key.startOver': 'Recommencer',
  'twoFactor.key.startOverHint':
    'Recommencer crée une nouvelle clé. Une clé déjà ajoutée à une application cessera de fonctionner.',
  'twoFactor.key.next': 'Je l’ai ajoutée',
  'twoFactor.code.label': 'Code de l’application',
  'twoFactor.code.hint':
    'Les six chiffres affichés actuellement par l’application.',
  'twoFactor.code.submit': 'Activer les deux facteurs',
  'twoFactor.code.pending': 'Vérification en cours',
  'twoFactor.code.invalid':
    'Ce code ne correspond pas. Vérifiez l’heure du téléphone et saisissez le code le plus récent de l’application.',
  'twoFactor.code.unclear':
    'Nous ne savons pas si cela a fonctionné. Saisissez le code le plus récent pour réessayer.',
  'twoFactor.rateLimited.title': 'Trop de tentatives rapprochées',
  'twoFactor.rateLimited.password':
    'Attendez environ dix secondes, puis réessayez. Vos saisies sont conservées.',
  'twoFactor.rateLimited.code':
    'Attendez jusqu’à une minute, puis réessayez. Vos saisies sont conservées.',
  'twoFactor.codes.title': 'Vos codes de secours',
  'twoFactor.codes.body':
    'Chaque code fonctionne une fois si vous perdez votre téléphone. Ils ne sont affichés que maintenant : conservez-les en lieu sûr.',
  'twoFactor.codes.copyAll': 'Tout copier',
  'twoFactor.codes.copied': 'Codes de secours copiés',
  'twoFactor.codes.download': 'Télécharger au format texte',
  'twoFactor.codes.copyFailed':
    'Votre navigateur n’a pas copié les codes. Sélectionnez-les et copiez-les manuellement.',
  'twoFactor.codes.stored': 'J’ai conservé ces codes de secours',
  'twoFactor.codes.done': 'Terminer',
  'twoFactor.codes.gate': 'Cochez la case pour continuer.',
  'twoFactor.codes.lost':
    'Si vous quittez cette page avant, vous pourrez créer un nouveau jeu ici. L’ancien ne fonctionnera plus.',
  'twoFactor.codes.leave.title': 'Partir sans conserver vos codes ?',
  'twoFactor.codes.leave.body':
    'Vos codes de secours ne sont affichés qu’une fois. Si vous partez, vous pourrez créer un nouveau jeu ici. L’ancien ne fonctionnera plus.',
  'twoFactor.codes.leave.stay': 'Rester ici',
  'twoFactor.codes.leave.go': 'Quitter',
  'twoFactor.on.title': 'Les deux facteurs sont activés',
  'twoFactor.on.badge': 'Activés',
  'twoFactor.on.body':
    'Nous demandons un code de l’application lors de la connexion par e-mail et mot de passe, sauf si ce navigateur est approuvé. Les connexions par Google, Apple ou clé d’accès ne demandent pas de code.',
  'twoFactor.replace.action': 'Remplacer les codes de secours',
  'twoFactor.replace.title': 'Remplacer vos codes de secours ?',
  'twoFactor.replace.body':
    'Vous recevrez un nouveau jeu. Le jeu actuel cesse de fonctionner dès que vous continuez.',
  'twoFactor.replace.confirm': 'Remplacer',
  'twoFactor.replace.pending': 'Remplacement en cours',
  'twoFactor.nopassword.title': 'Définissez d’abord un mot de passe',
  'twoFactor.nopassword.body':
    'Les deux facteurs nécessitent un mot de passe pour ce compte. La page suivante demande votre e-mail et envoie un lien pour en définir un. Cela vous déconnecte partout. Reconnectez-vous, puis revenez ici.',
  'twoFactor.nopassword.action': 'Définir un mot de passe',
  'twoFactor.setup.action': 'Afficher à nouveau la clé de configuration',
  'twoFactor.setup.title': 'Clé de configuration',
  'twoFactor.setup.body':
    'Ajoutez cette clé sur un autre appareil. La clé sur vos autres appareils continue de fonctionner.',
  'twoFactor.setup.done': 'Terminé',
  'twoFactor.setup.confirm': 'Afficher la clé',
  'twoFactor.setup.pending': 'Vérification',
  'twoFactor.off.action': 'Désactiver la double authentification',
  'twoFactor.off.title': 'Désactiver la double authentification ?',
  'twoFactor.off.body':
    'Toute personne connaissant votre mot de passe pourra se connecter sans code. Vos autres appareils connectés resteront connectés.',
  'twoFactor.off.confirm': 'Désactiver',
  'twoFactor.off.pending': 'Désactivation',
  'twoFactor.off.cancel': 'La garder activée',
  'twoFactor.off.done': 'La double authentification est désactivée',
} satisfies TranslationOf<typeof En>

export default messages
