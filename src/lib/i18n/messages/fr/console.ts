/**
 * Tout ce que dit la console de la plateforme, en français.
 *
 * Écrit à partir de `../en/console.ts` (`docs/SPEC.md` §9). Le fichier anglais est le schéma :
 * `TranslationOf<typeof En>` fait d'une clé manquante ou inventée une erreur de compilation, et
 * `__tests__/parity.test.ts` vérifie les substituants, les branches de pluriel et qu'il ne reste
 * rien d'anglais ici.
 *
 * **Registre.** Vouvoiement, comme partout ailleurs dans le catalogue français.
 *
 * **Pluriel.** `Intl.PluralRules('fr')` annonce `one`, `many` et `other` ; `many` est la branche
 * CLDR des millions et s'accorde comme `other`.
 *
 * **Deux échelles de rôles qui ne se mélangent jamais** (§5). Sur la plateforme : administrateur,
 * curateur, utilisateur. Dans l'espace de travail : propriétaire, administrateur, membre. Le même
 * mot tombe des deux côtés, donc c'est la phrase autour qui porte la différence.
 *
 * **« Impersonation » se dit « agir au nom de »**, jamais « usurper » : l'acte est autorisé,
 * journalisé et limité à quinze minutes, et le mot français pour la fraude dirait le contraire.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------- sections -- */

  'nav.label': 'Sections de la console',
  'nav.overview': 'Vue d’ensemble',
  'nav.overview.description': 'La plateforme d’un coup d’œil',
  'nav.accounts': 'Comptes',
  'nav.accounts.description': 'Rôles, suspensions et sessions',
  'nav.runs': 'Exécutions d’agents',
  'nav.runs.description': 'Ce que construit la flotte sandcastle',

  /* ------------------------------------------------------------ enveloppe -- */

  'shell.eyebrow': 'Plateforme',
  'shell.title': 'Console de la plateforme',
  'shell.description':
    'Le produit lui-même — les comptes, les pouvoirs et le catalogue commun',
  'shell.signedInAs': 'Connecté en tant que',
  'shell.error.title': 'La console ne s’est pas chargée',
  'shell.notFound.title': 'Aucun compte de ce nom',
  'shell.notFound.body':
    'Rien sur la plateforme ne porte cet identifiant. Le compte a pu être supprimé depuis la création du lien, ou l’adresse a été mal recopiée.',
  'shell.allAccounts': 'Tous les comptes',
  'shell.overview': 'Vue d’ensemble de la console',

  'failure.fallback': 'L’action n’est pas passée. Réessayez dans un instant.',

  /* ------------------------------------------------------- vue d’ensemble -- */

  'overview.error.title': 'La vue d’ensemble ne s’est pas chargée',
  'overview.standing.title': 'Vos pouvoirs sur la plateforme',
  'overview.standing.body':
    'Les comptes, les sessions et le fait d’agir au nom d’autrui appartiennent à un administrateur de la plateforme : la console ne vous montre donc que le catalogue.',
  'overview.stat.accounts': 'Comptes',
  'overview.stat.accounts.caption': {
    one: 'L’un d’eux porte un rôle de plateforme',
    many: '{staff} d’entre eux portent un rôle de plateforme',
    other: '{staff} d’entre eux portent un rôle de plateforme',
  },
  'overview.stat.admins': 'Administrateurs',
  'overview.stat.admins.caption':
    'Pouvoir entier sur les comptes et les sessions',
  'overview.stat.curators': 'Curateurs',
  'overview.stat.curators.caption': 'Le catalogue seul — jamais les comptes',
  'overview.stat.suspended': 'Suspendus',
  'overview.stat.suspended.none': 'Personne n’est mis à la porte',
  'overview.stat.suspended.some':
    'Déconnectés partout tant qu’une suspension n’est pas levée',
  'overview.stat.suspended.review': 'Les examiner',
  'overview.newest.label': 'Comptes les plus récents',
  'overview.newest.empty.title': 'Encore aucun compte',
  'overview.newest.empty.body':
    'La première personne à s’inscrire apparaîtra ici.',
  'overview.catalogue.label': 'Catalogue par état',
  'overview.catalogue.empty.title':
    'Le catalogue commun n’est pas encore ouvert',
  'overview.catalogue.empty.body':
    'Dès que la chaîne d’ingestion sera en place, ce panneau comptera chaque lieu du catalogue commun comme brouillon, en relecture ou publié — et chaque nombre ouvrira la liste qui se tient derrière.',
  'overview.scraping.label': 'Passages de collecte',
  'overview.scraping.empty.title': 'Aucune source n’a été lancée',
  'overview.scraping.empty.body':
    'Les sources sont collectées chaque semaine. Quand le premier passage se terminera, les cinq derniers apparaîtront ici, avec ce que chacun a ingéré, modifié et rejeté.',

  /* --------------------------------------------------- l’échelle des rôles -- */

  'role.admin': 'Administrateur',
  'role.admin.summary':
    'Pouvoir entier sur la plateforme : comptes, rôles, suspensions, sessions et le fait d’agir au nom d’autrui.',
  'role.admin.holds.accounts':
    'Créer des comptes et attribuer les rôles de plateforme',
  'role.admin.holds.bans': 'Suspendre des comptes et lever les suspensions',
  'role.admin.holds.sessions':
    'Révoquer des sessions et définir des mots de passe',
  'role.admin.holds.impersonate':
    'Agir au nom d’un compte pendant quinze minutes',
  'role.admin.holds.curation': 'Tout ce qu’un curateur peut faire',
  'role.admin.withheld.admins':
    'Agir au nom d’un autre administrateur de la plateforme',
  'role.curator': 'Curateur',
  'role.curator.summary':
    'Le catalogue, les recueils, les sources et la modération des partages. Rien qui touche aux comptes.',
  'role.curator.holds.places': 'Lire, écrire et publier les lieux du catalogue',
  'role.curator.holds.packs': 'Lire, écrire et publier les recueils de lieux',
  'role.curator.holds.sources': 'Lire et lancer les sources du catalogue',
  'role.curator.holds.shares': 'Examiner et révoquer les liens partagés',
  'role.curator.withheld.accounts':
    'Tout ce qui touche à un compte ou à une session',
  'role.curator.withheld.tokens':
    'Émettre ou révoquer des identifiants machine',
  'role.user': 'Utilisateur',
  'role.user.summary':
    'Aucun pouvoir sur la plateforme. C’est le cas de presque tout le monde.',
  'role.user.withheld.everything':
    'Chaque pouvoir de la plateforme, sans exception',

  /* ----------------------------------------------------------- un compte -- */

  'identity.you': 'C’est vous',
  'status.active': 'Actif',
  'status.suspended': 'Suspendu',
  'status.permanent': 'Définitive',
  'status.until': 'Jusqu’au {date}',
  'status.unverified': 'Non vérifiée',
  'device.on': '{browser} sur {platform}',
  'device.unrecognised': 'Appareil non reconnu',

  /* ------------------------------------------------------ liste des comptes -- */

  'users.error.title': 'La liste des comptes ne s’est pas chargée',
  'users.total': '{total} au total',
  'users.loading': 'Chargement des comptes',
  'users.table.label': 'Comptes de la plateforme',
  'users.search.label': 'Rechercher des comptes',
  'users.search.email': 'Rechercher dans les adresses e-mail',
  'users.search.name': 'Rechercher dans les noms',
  'users.search.column': 'Dans quelle colonne chercher',
  'users.search.submit': 'Rechercher',
  'users.field.email': 'E-mail',
  'users.field.name': 'Nom',
  'users.filter.role.label': 'Filtrer par rôle de plateforme',
  'users.filter.role.any': 'N’importe quel rôle',
  'users.filter.role.admin': 'Administrateurs',
  'users.filter.role.curator': 'Curateurs',
  'users.filter.status.label': 'Filtrer par état du compte',
  'users.filter.status.any': 'N’importe quel état',
  'users.filter.hint': 'Restreignez par rôle ou par état — un seul à la fois.',
  'users.column.account': 'Compte',
  'users.column.role': 'Rôle de plateforme',
  'users.column.status': 'État',
  'users.column.joined': 'Inscription',
  'users.column.actions': 'Opérations',
  'users.joined': 'Inscrit le {date}',
  'users.pastEnd.title': 'Cette page est au-delà de la fin',
  'users.pastEnd.body': {
    one: 'Cette vue contient un compte, et la page 1 est la seule qu’elle ait.',
    many: 'Cette vue contient {total} comptes, soit {pages}. La page {page} est au-delà.',
    other:
      'Cette vue contient {total} comptes, soit {pages}. La page {page} est au-delà.',
  },
  'users.pastEnd.pages': {
    one: 'une seule page',
    many: '{pages} pages',
    other: '{pages} pages',
  },
  'users.pastEnd.back': 'Revenir à la première page',
  'users.empty.filtered.title': 'Rien ne correspond à ces filtres',
  'users.empty.filtered.body':
    'Aucun compte de la plateforme ne répond à cette recherche. Élargissez-la, ou effacez les filtres pour voir tout le monde.',
  'users.empty.title': 'Aucun compte à montrer',
  'users.empty.body':
    'Cette vue est vide. Rien n’est filtré, il n’y a donc rien à élargir ici.',

  /* --------------------------------------------------------- fiche compte -- */

  'account.error.title': 'Ce compte ne s’est pas chargé',
  'account.loading': 'Chargement du compte',
  'account.meta.lastChange': 'Dernière modification',
  'account.meta.id': 'Identifiant du compte',
  'account.banned.title': 'Ce compte est suspendu',
  'account.banned.noReason': 'Aucun motif n’a été consigné avec la suspension.',
  'account.banned.permanent':
    ' Elle reste en vigueur jusqu’à ce qu’un administrateur la lève.',
  'account.banned.until': ' Elle se lève d’elle-même le {date}.',
  'account.banned.untilUnknown': 'sa date d’échéance',
  'account.authority.label': 'Pouvoirs sur la plateforme',
  'account.authority.may': 'Peut',
  'account.authority.mayNot': 'Ne peut pas',
  'account.authority.none': 'Rien sur la plateforme.',
  'account.workspaces.label': 'Espaces de travail',
  'account.workspaces.truncated':
    'Ce compte appartient à plus d’espaces de travail que les {listed} listés ici.',
  'account.workspaces.empty.title': 'Dans aucun espace de travail',
  'account.workspaces.empty.body':
    'Ce compte n’appartient encore à aucun espace de travail. Un premier est créé lors de la première connexion, et tous ceux auxquels il est invité apparaîtront ici.',
  'account.workspaces.column.workspace': 'Espace de travail',
  'account.workspaces.column.role': 'Rôle',
  'account.workspaces.column.plan': 'Formule',
  'account.subscription.label': 'Abonnement',
  'account.subscription.free.title': 'Sur la formule gratuite',
  'account.subscription.free.body':
    'L’espace de travail que possède ce compte n’est jamais passé par le paiement : il ne porte donc aucun enregistrement d’abonnement et tourne sur les quotas de la formule gratuite.',
  'account.subscription.none.title': 'Rien n’est facturé à ce compte',
  'account.subscription.none.body':
    'Ce compte ne possède aucun espace de travail. Être membre de l’espace d’une autre personne, ce n’est pas être celui à qui cet espace facture : il n’y a donc rien à relever ici.',
  'account.subscription.endsAtClose': 'Prend fin à la clôture de la période',
  'account.subscription.seats': 'Places',
  'account.subscription.seatsValue': '{used} sur {limit}',
  'account.subscription.ends': 'Fin',
  'account.subscription.renews': 'Renouvellement',
  'account.sessions.label': 'Sessions en cours',
  'account.sessions.truncated':
    'Ce compte détient plus de sessions qu’un appel n’en liste. Révoquez toutes les sessions depuis le menu des opérations pour être sûr qu’il n’en reste aucune.',
  'account.sessions.empty.title': 'Déconnecté partout',
  'account.sessions.empty.body':
    'Ce compte ne détient aucune session non expirée. Il apparaîtra ici dès qu’il se reconnectera.',
  'account.sessions.column.device': 'Appareil',
  'account.sessions.column.address': 'Adresse',
  'account.sessions.column.started': 'Début',
  'account.sessions.column.expires': 'Expire',
  'account.sessions.impersonated': 'Née d’une action au nom d’autrui',
  'account.sessions.noAddress': 'Non consignée',
  'account.sessions.noAddressLong': 'Adresse non consignée',
  'account.sessions.when': 'Début {started} · expire {expires}',
  'account.audit.label': 'Historique d’audit',
  'account.audit.truncated':
    'Le registre contient plus d’entrées que celles-ci. La piste d’audit de la plateforme n’accepte que des ajouts et se garde quatre cents jours.',
  'account.audit.empty.title': 'Rien n’a été fait sur ce compte',
  'account.audit.empty.body':
    'Chaque changement de rôle, suspension, mot de passe défini, session révoquée et action au nom d’autrui s’écrit ici, avec le nom de l’opérateur dessus. Personne n’a touché à celui-ci.',

  /* ---------------------------------------- l’échelle de l’espace de travail -- */

  'workspace.role.owner': 'Propriétaire',
  'workspace.role.admin': 'Administrateur',
  'workspace.role.member': 'Membre',
  'plan.free': 'Gratuite',
  'plan.starter': 'Découverte',
  'plan.pro': 'Professionnelle',
  'plan.business': 'Entreprise',
  'subscription.trialing': 'Période d’essai',
  'subscription.active': 'Actif',
  'subscription.pastDue': 'En retard de paiement',
  'subscription.canceled': 'Résilié',
  'subscription.incomplete': 'Incomplet',
  'subscription.expired': 'Expiré',
  'subscription.unpaid': 'Impayé',
  'subscription.paused': 'En pause',

  /* ------------------------------------------------------ registre d’audit -- */

  'audit.action.created': 'Compte créé',
  'audit.action.updated': 'Informations du compte modifiées',
  'audit.action.roleChanged': 'Rôle de plateforme modifié',
  'audit.action.banned': 'Compte suspendu',
  'audit.action.unbanned': 'Suspension levée',
  'audit.action.deleted': 'Compte supprimé',
  'audit.action.passwordSet': 'Mot de passe défini par un administrateur',
  'audit.action.emailSet': 'Adresse e-mail modifiée',
  'audit.action.impersonationStarted': 'Début d’une action au nom d’autrui',
  'audit.action.impersonationEnded': 'Fin d’une action au nom d’autrui',
  'audit.action.impersonationWorkspaceChanged':
    'Changement d’espace pendant une action au nom d’autrui',
  'audit.action.sessionRevoked': 'Une session a été révoquée',
  'audit.action.sessionRevokedAll': 'Toutes les sessions ont été révoquées',
  'audit.actor.system': 'La plateforme elle-même',
  'audit.actor.system.detail': 'automatique',
  'audit.actor.agent': 'Un identifiant machine',
  'audit.actor.agent.detail': 'jeton MCP',
  'audit.actor.deleted': 'Un compte supprimé',
  'audit.actorBadge': '{role} à l’époque',
  'audit.field.name': 'Nom',
  'audit.field.email': 'Adresse e-mail',
  'audit.field.emailVerified': 'E-mail vérifié',
  'audit.field.role': 'Rôle de plateforme',
  'audit.field.banned': 'Suspendu',
  'audit.field.banReason': 'Motif',
  'audit.field.banExpiresAt': 'Fin de la suspension',
  'audit.field.revoked': 'Sessions closes',
  'audit.field.impersonating': 'Agit en tant que',
  'audit.field.impersonatedBy': 'Agi par',
  'audit.field.expiresAt': 'Expiration de la session',
  'audit.field.targetRole': 'Son rôle de plateforme',
  'audit.field.sessionId': 'Session concernée',
  'audit.field.organizationId': 'Espace',
  'audit.value.yes': 'oui',
  'audit.value.no': 'non',
  'audit.value.cleared': 'effacé',
  'audit.became': 'est devenu',

  /* ------------------------------------------------------------- dialogues -- */

  'dialog.cancel': 'Annuler',

  'create.button': 'Nouveau compte',
  'create.title': 'Créer un compte',
  'create.body':
    'L’adresse n’est pas vérifiée et aucun courrier n’est envoyé — transmettez le mot de passe vous-même.',
  'create.confirm': 'Créer le compte',
  'create.name.placeholder': 'Camille Dubois',
  'create.email': 'Adresse e-mail',
  'create.email.placeholder': 'camille@planned.travel',
  'create.password': 'Mot de passe',
  'create.password.hint':
    'Assez long pour être une phrase. Le compte pourra le changer ensuite.',
  'create.done': 'Compte créé',
  'create.done.body':
    '{email} peut se connecter avec le mot de passe que vous avez défini.',

  'action.menu.label': 'Opérations pour {name}',
  'action.group.account': 'Compte',
  'action.group.credentials': 'Identifiants',

  'action.role.item': 'Changer le rôle de plateforme',
  'action.role.self':
    'Pas sur votre propre compte — se rétrograder soi-même peut laisser la plateforme sans administrateur.',
  'action.role.body':
    'Ce que {name} peut faire sur la plateforme elle-même. L’appartenance à un espace de travail est un vocabulaire distinct et ne bouge pas.',
  'action.role.confirm': 'Enregistrer le rôle',
  'action.role.current': 'Actuel',
  'action.role.done': 'Rôle de plateforme mis à jour',
  'action.role.done.body':
    '{name} porte désormais le rôle {role} sur la plateforme.',

  'action.impersonate.item': 'Agir au nom de ce compte',
  'action.impersonate.self':
    'Il n’y a personne à devenir — c’est votre propre compte.',
  'action.impersonate.banned':
    'Le compte est suspendu : il ne détient donc aucune session à endosser.',
  'action.impersonate.admin':
    'Aucun rôle de la plateforme ne peut agir au nom d’un administrateur, le vôtre compris.',
  'action.impersonate.title': 'Agir en tant que {name}',
  'action.impersonate.body':
    'Vous verrez le produit exactement comme ce compte le voit, pendant quinze minutes.',
  'action.impersonate.confirm': 'Commencer',
  'action.impersonate.note.bar':
    'Une barre d’avertissement reste sur chaque écran jusqu’à ce que vous y mettiez fin, et elle ne peut pas être fermée.',
  'action.impersonate.note.platform':
    'Les opérations de plateforme sont indisponibles tant que vous agissez au nom d’une autre personne — la console comprise.',
  'action.impersonate.note.audit':
    'Le début et la fin s’écrivent tous deux dans la piste d’audit de la plateforme, avec votre nom dessus.',

  'action.password.item': 'Définir un mot de passe',
  'action.password.title': 'Définir un mot de passe pour {name}',
  'action.password.body':
    'Servez-vous-en pour récupérer un compte verrouillé ou pour couper l’accès à un attaquant sur un compte compromis.',
  'action.password.confirm': 'Définir le mot de passe',
  'action.password.field': 'Nouveau mot de passe',
  'action.password.hint.self':
    'Toutes les sessions prennent fin à l’enregistrement — la vôtre aussi.',
  'action.password.hint':
    'Toutes les sessions que détient le compte prennent fin à l’enregistrement.',
  'action.password.done': 'Mot de passe défini',
  'action.password.done.body': '{name} a été déconnecté de tous ses appareils.',

  'action.sessions.item': 'Révoquer toutes les sessions',
  'action.sessions.body.self':
    'Cela vous déconnecte de tous vos appareils, y compris celui sur lequel vous lisez ceci.',
  'action.sessions.body':
    '{name} est déconnecté de tous ses appareils et devra se reconnecter.',
  'action.sessions.confirm': 'Révoquer les sessions',
  'action.sessions.done': 'Sessions révoquées',
  'action.sessions.done.body': {
    one: 'Une session a été close.',
    many: '{revoked} sessions ont été closes.',
    other: '{revoked} sessions ont été closes.',
  },

  'action.ban.item': 'Suspendre le compte',
  'action.ban.self':
    'Pas sur votre propre compte — se suspendre soi-même, c’est se retirer le chemin du retour.',
  'action.ban.title': 'Suspendre {name}',
  'action.ban.body':
    'Toutes les sessions prennent fin immédiatement et le compte ne pourra plus se connecter tant que la suspension n’est pas levée ou expirée.',
  'action.ban.confirm': 'Suspendre le compte',
  'action.ban.reason': 'Motif',
  'action.ban.reason.hint':
    'Conservé treize mois dans la piste d’audit de la plateforme, et montré à personne d’autre qu’un administrateur.',
  'action.ban.reason.placeholder':
    'Signalements d’abus répétés depuis trois espaces de travail',
  'action.ban.duration': 'Durée',
  'action.ban.duration.label': 'Durée de la suspension',
  'action.ban.duration.permanent.body':
    'Reste en vigueur jusqu’à ce qu’un administrateur la lève délibérément.',
  'action.ban.duration.day': '24 heures',
  'action.ban.duration.day.body':
    'Assez long pour interrompre, assez court pour rester une intervention.',
  'action.ban.duration.week': '7 jours',
  'action.ban.duration.week.body': 'Une semaine pour répondre à une plainte.',
  'action.ban.duration.month': '30 jours',
  'action.ban.duration.month.body': 'Un mois de silence imposé.',
  'action.ban.duration.quarter': '90 jours',
  'action.ban.duration.quarter.body':
    'Le plus long que propose la console. Au-delà, suspendez définitivement.',
  'action.ban.done': 'Compte suspendu',
  'action.ban.done.body':
    '{name} a été déconnecté partout et ne peut plus se connecter.',

  'action.unban.item': 'Lever la suspension',
  'action.unban.title': 'Lever la suspension de {name}',
  'action.unban.body':
    'Le compte pourra se reconnecter dès sa prochaine tentative. Aucune session antérieure n’est rétablie.',
  'action.unban.confirm': 'Lever la suspension',
  'action.unban.done': 'Suspension levée',
  'action.unban.done.body':
    '{name} peut se reconnecter. Aucune session n’a été rétablie.',

  'action.delete.item': 'Supprimer le compte',
  'action.delete.self': 'Pas sur votre propre compte — on n’en revient pas.',
  'action.delete.title': 'Supprimer {name}',
  'action.delete.body':
    'Le compte, ses sessions et chaque identifiant qui y est rattaché sont retirés. C’est sans retour.',
  'action.delete.confirm': 'Supprimer le compte',
  'action.delete.note':
    'Le contenu d’espace de travail créé par cette personne reste à l’espace qui le possède. Suspendre le compte plutôt que le supprimer garde la trace et retire l’accès.',
  'action.delete.owners':
    'Ce compte est l’unique propriétaire d’un espace comptant d’autres membres. Demandez à un propriétaire de nommer d’abord un autre membre propriétaire dans la console de l’espace, ou suspendez plutôt le compte.',
  'action.delete.done': 'Compte supprimé',
  'action.delete.done.body':
    '{name} et tout ce qui était rattaché au compte ont disparu.',

  'session.revoke.label': 'Clore la session sur {device}',
  'session.revoke.title': 'Clore cette session',
  'session.revoke.body':
    '{device} devra se reconnecter à sa prochaine requête. Si c’est la session dans laquelle vous lisez ceci, vous êtes déconnecté avec elle.',
  'session.revoke.confirm': 'Clore la session',
  'session.revoke.done': 'Session close',
  'session.revoke.done.body':
    'L’appareil devra se reconnecter à sa prochaine requête.',

  /* -------------------------------------------------- exécutions d’agents -- */

  'runs.error.title': 'Le registre des exécutions n’a pas répondu',
  'runs.origin.local': 'En local',
  'runs.origin.githubActions': 'Actions GitHub',
  'runs.stat.live': 'Exécutions en cours',
  'runs.stat.live.none': 'Rien ne se construit en ce moment',
  'runs.stat.live.some': 'Battement de cœur contre un bail de cinq minutes',
  'runs.stat.issues': 'Tickets détenus',
  'runs.stat.issues.caption':
    'Loués à une seule exécution chacun, ascendants et sous-tickets compris',
  'runs.stat.orphans': 'Branches orphelines',
  'runs.stat.orphans.none': 'Aucun travail ne reste sans propriétaire',
  'runs.stat.orphans.some':
    'Commits d’une exécution arrêtée, en attente d’adoption',
  'runs.live.empty.title': 'Aucune exécution enregistrée',
  'runs.live.empty.body':
    'Une exécution apparaît ici dès qu’elle s’enregistre — depuis cette machine, depuis une autre, ou depuis un exécuteur GitHub — avec les tickets qu’elle a pris.',
  'runs.holds.nothing': 'ne détient rien',
  'runs.holds': 'détient {issues}',
  'runs.uptime': '{elapsed} d’activité · {lease}',
  'runs.lease.expired': 'expiré',
  'runs.lease.left': 'encore {elapsed}',
  'runs.wip.label': 'Travail en cours',
  'runs.wip.empty.title': 'Aucune branche ne porte de travail',
  'runs.wip.empty.body':
    'Une exécution consigne sa branche dès qu’elle y a des commits, pour que si elle meurt, la suivante à prendre le ticket se voie proposer ce travail au lieu de le recommencer.',
  'runs.wip.orphaned': 'Orpheline',
  'runs.wip.meta': {
    one: '{commits} commit · il y a {elapsed}',
    many: '{commits} commits · il y a {elapsed}',
    other: '{commits} commits · il y a {elapsed}',
  },
  'runs.recent.label': 'Terminées récemment',
  'runs.recent.empty.title': 'Aucune exécution ne s’est encore terminée',
  'runs.recent.empty.body':
    'Les cinquante dernières exécutions sont gardées ici, avec la façon dont chacune s’est terminée.',
  'runs.ago': 'il y a {elapsed}',
  'runs.notCoordinator.title': 'Ce déploiement ne coordonne pas la flotte',
  'runs.notCoordinator.body':
    'Le registre des exécutions n’est branché que sur la préproduction, et délibérément : un second registre laisserait deux flottes croire chacune qu’elle détient le reliquat, ce qu’il existe précisément pour empêcher. Lisez la flotte sur la préproduction.',
  'nav.providers': 'Fournisseurs',
  'nav.providers.description': 'Appels sortants et leurs plafonds',
  'providers.error.title': 'Impossible de lire les compteurs des fournisseurs',
  'providers.list.label': 'Services externes',
  'providers.status.planned': 'Non intégré',
  'providers.status.planned.description':
    'Rien n’appelle encore ce service, il n’y a donc rien à compter. Il figure ici pour qu’un plafond soit convenu avant le premier appel plutôt qu’après la première facture.',
  'providers.policy.allow': 'Facture au-delà',
  'providers.policy.block': 'Refuse au plafond',
  'providers.badge.blocked': {
    one: 'Un appel refusé',
    many: '{calls} appels refusés',
    other: '{calls} appels refusés',
  },
  'providers.limit.none': 'Aucun plafond convenu · {used} ce mois-ci',
  'providers.limit.value': '{used} sur {limit}',
  'providers.limit.window.day': 'Aujourd’hui',
  'providers.limit.window.month': 'Ce mois-ci',
  'providers.measuring.none': 'Rien encore mesuré',
  'providers.measuring.since': 'Mesure depuis le {date}',
  'providers.stat.calls': 'Appels ce mois-ci',
  'providers.stat.calls.caption': 'Sur tous les services intégrés',
  'providers.stat.errors': 'Appels en échec',
  'providers.stat.errors.caption':
    'Comptés aussi comme appels, car la plupart des fournisseurs les facturent',
  'providers.stat.nearLimit': 'Près d’un plafond',
  'providers.stat.nearLimit.caption': 'Services au-delà de leur seuil d’alerte',
  'providers.stat.blocked': 'Appels refusés',
  'providers.stat.blocked.none': 'Rien n’a été refusé',
  'providers.stat.blocked.some': 'Demande refusée par un plafond',
  'providers.forecast.label': 'Prévision',
  'providers.forecast.provider': 'Service concerné',
  'providers.forecast.monthEnd': 'D’ici la fin du mois',
  'providers.forecast.runRate': 'Par mois à ce rythme',
  'providers.forecast.perWorkspace': 'Par espace de travail et par mois',
  'providers.forecast.noWorkspaceTraffic':
    'Aucun trafic d’espace de travail à moyenner',
  'providers.forecast.window': {
    one: 'Projeté à partir d’une heure de mesure.',
    many: 'Projeté à partir de {hours} heures de mesure.',
    other: 'Projeté à partir de {hours} heures de mesure.',
  },
  'providers.forecast.tooEarly': {
    one: 'Une seule heure mesurée pour l’instant : trop peu pour projeter. Étendre moins d’une journée à un mois relèverait du calcul, pas de la prévision.',
    many: '{hours} heures mesurées pour l’instant : trop peu pour projeter. Étendre moins d’une journée à un mois relèverait du calcul, pas de la prévision.',
    other:
      '{hours} heures mesurées pour l’instant : trop peu pour projeter. Étendre moins d’une journée à un mois relèverait du calcul, pas de la prévision.',
  },
  'providers.forecast.atWorkspaces': 'Pour combien d’espaces de travail',
  'providers.forecast.callsEach': 'Appels par espace et par mois',
  'providers.forecast.projected': 'Environ {calls} appels par mois.',
  'providers.workspaces.label': 'Espaces les plus actifs',
  'providers.workspaces.platform': 'Plateforme (hors espace)',
  'providers.workspaces.empty.title': 'Rien encore attribué',
  'providers.workspaces.empty.description':
    'Un appel fait pour un espace de travail lui est imputé. Les tâches planifiées et le courrier de la plateforme n’appartiennent à aucun et comptent à part.',
  'providers.readOnly':
    'Vous pouvez lire ces compteurs mais pas déplacer un plafond. Modifier une limite ou sa politique demande l’autorisation provider:configure.',
  'providers.status.planned.agreed.month':
    'Plafond convenu : {limit} par mois. Il s’applique dès le premier appel, une fois qu’un client existe.',
  'providers.status.planned.agreed.day':
    'Plafond convenu : {limit} par jour. Il s’applique dès le premier appel, une fois qu’un client existe.',
  'providers.edit.button': 'Modifier',
  'providers.edit.title': 'Plafond pour {provider}',
  'providers.edit.body':
    'Ce que ce déploiement s’est engagé à dépenser chez le fournisseur, et ce qui arrive une fois épuisé.',
  'providers.edit.confirm': 'Enregistrer le plafond',
  'providers.edit.done': 'Plafond enregistré pour {provider}',
  'providers.edit.label': 'Nom',
  'providers.edit.ceiling': 'Appels inclus',
  'providers.edit.ceiling.hint':
    'Laissez vide s’il n’y a aucun plafond convenu. Vide et zéro diffèrent : zéro sous « refuser » écarte chaque appel.',
  'providers.edit.ceiling.placeholder': 'Aucun plafond',
  'providers.edit.window': 'Mesuré sur',
  'providers.edit.window.month': 'Un mois civil',
  'providers.edit.window.month.body': 'La forme habituelle d’un quota inclus.',
  'providers.edit.window.day': 'Une journée',
  'providers.edit.window.day.body':
    'Certains fournisseurs comptent par jour — le plan gratuit de Geoapify est de 3 000 crédits par jour.',
  'providers.edit.policy': 'Au plafond',
  'providers.edit.policy.allow': 'Continuer et payer',
  'providers.edit.policy.allow.body':
    'Les appels dépassent le plafond et la console avertit. Rien ne cesse de fonctionner.',
  'providers.edit.policy.block': 'Refuser les appels suivants',
  'providers.edit.policy.block.body':
    'Les appels sont écartés jusqu’à la remise à zéro. Ce qui dépend de ce fournisseur cesse de fonctionner : ne le choisissez que là où c’est la panne la moins coûteuse.',
  'providers.edit.policy.block.refused':
    '{provider} ne peut pas être refusé : il n’a aucune solution de repli, donc écarter ses appels arrêterait la fonctionnalité au lieu d’en plafonner le coût. Un plafond qui se contente d’avertir reste possible.',
  'providers.edit.warn': 'Avertir à (%)',
  'providers.edit.critical': 'Alerter à (%)',
  'providers.edit.thresholds.hint':
    'Où la jauge passe à l’ambre puis au rouge. L’avertissement ne doit pas dépasser l’alerte.',
} satisfies TranslationOf<typeof En>

export default messages
