/**
 * The public pages' copy, in fr.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Typographie.** Le français cite avec « … » et met une espace insécable avant « : ».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Commencer gratuitement',
  'action.signIn': 'Se connecter',
  'action.pricing': 'Tarifs',
  'action.seePricing': 'Voir les tarifs',
  'action.skipToContent': 'Aller au contenu',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — accueil',
  'nav.onThisPage': 'Sur cette page',
  'anchor.planner': 'Planificateur',
  'anchor.modules': 'Fonctionnalités',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Déposer sur le jour {day}',
  'legal.summaryNote':
    'Le résumé est là pour être lu. Ce qui s’applique vraiment, c’est ce qui suit.',
  'visual.daysTravelled': 'Jours de voyage',
  'visual.acrossEveryTrip': 'sur tous les voyages',
  'visual.mapFilled': '{percent} % de la carte remplie',
  'visual.previewSummary':
    'Un aperçu du tableau de bord planned.travel : le prochain voyage avec ses dates, ses voyageurs et son nombre de lieux ; les totaux de pays visités, de voyages et de jours de voyage ; une carte de l’itinéraire ; et les deux prochaines réservations.',
  'visual.placesMapped': {
    one: '{value} lieu sur la carte',
    many: '{value} lieux sur la carte',
    other: '{value} lieux sur la carte',
  },
  'visual.splitWays': {
    one: 'non partagé',
    many: 'partagé entre {value}',
    other: 'partagé entre {value}',
  },
  'visual.tripTotal': 'Total du voyage',
  'visual.paidSplit': 'payé par {who} · {split}',
  'visual.nextUp': 'À suivre',
  'visual.ofTotal': '{done} sur {total}',
  'visual.awaitingReply': 'En attente de réponse',
  'visual.upcoming': 'À venir',
  'visual.days': {
    one: '{value} jour',
    many: '{value} jours',
    other: '{value} jours',
  },
  'visual.places': {
    one: '{value} lieu',
    many: '{value} lieux',
    other: '{value} lieux',
  },
  'visual.transfersLeft': {
    one: '{value} virement restant',
    many: '{value} virements restants',
    other: '{value} virements restants',
  },

  'legal.badge.version': 'Version {version}',
  'legal.badge.effective': 'En vigueur depuis le {updated}',
  'legal.notice.title': 'Ceci est un modèle, pas un conseil juridique',
  'legal.notice.body':
    'Il est rédigé en anglais simple pour constituer un point de départ réellement utile pour un petit service de préparation de voyages, et chaque vide qu’une entreprise doit combler est signalé. Faites-le relire et adapter par un juriste qualifié dans votre juridiction avant d’accepter le moindre client. Rien ici n’affirme une certification, un audit ou une norme de conformité que planned.travel détiendrait.',
  'legal.contents': 'Sommaire',
  'legal.shortVersion': 'La version courte',
  'legal.both': 'Les deux documents s’appliquent ensemble.',

  'landing.plans.title': 'Commencez gratuitement. Payez quand ça le mérite.',
  'landing.plans.lede':
    'Toutes les formules incluent le planning quotidien, la carte, les budgets et les listes à emporter. Les formules payantes - à partir de {price} par mois - débloquent les voyages illimités, les réservations, le carnet et les exports.',
  'landing.plans.ledeFree':
    'Toutes les formules incluent le planning quotidien, la carte, les budgets et les listes à emporter. Les formules payantes débloquent les voyages illimités, les réservations, le carnet et les exports.',
  'landing.plans.compare': 'Comparer chaque limite, ligne par ligne',
  'landing.questions.title': 'Des questions, des réponses nettes',
  'landing.questions.lede':
    'Les cinq choses que les gens veulent vraiment savoir avant de commencer.',
  'cta.heading': 'Votre prochain voyage mérite déjà d’être bien préparé',
  'cta.lede':
    'Deux voyages, toute la carte, l’itinéraire et les listes à emporter : gratuitement, sans carte et sans compte à rebours.',
  'landing.faq.seats.q':
    'Les gens avec qui je voyage doivent-ils payer aussi ?',
  'landing.faq.seats.a':
    'Non. Toutes les personnes que vous invitez dans un espace de travail {crew} sont couvertes par ses places. Elles se connectent avec leur propre compte et ne voient que les voyages auxquels vous les avez ajoutées.',
  'landing.faq.phone.q': 'Est-ce que ça marche bien sur téléphone ?',
  'landing.faq.phone.a':
    'Oui. Les mises en page mobiles sont dessinées à part, et non compressées depuis celles de bureau, et c’est un site web : il n’y a rien à installer ni à maintenir à jour.',
  'landing.faq.privacy.q': 'Qui peut voir mon voyage ?',
  'landing.faq.privacy.a':
    'Un voyage appartient à un seul espace de travail, et seules les personnes invitées dans cet espace peuvent l’ouvrir. Rien n’est public, il n’y a aucun fil de découverte, et rien n’est partagé avec qui que ce soit par défaut.',
  'landing.faq.stop.q': 'Qu’arrive-t-il à mes voyages si j’arrête de payer ?',
  'landing.faq.stop.a':
    'Rien n’est supprimé. Les modules payants se verrouillent, vos voyages restent exactement où ils sont, et tout se rouvre dès que vous vous abonnez. {free} reste gratuite, sans compte à rebours.',

  'action.startPlanning': 'Commencer gratuitement',
  'cta.comparePlans': 'Comparer les formules',
  'landing.hero.eyebrow': 'Préparation de voyage à plusieurs',
  'landing.hero.title': 'Préparez le voyage.',
  'landing.hero.titleQuiet': 'Pas le tableur.',
  'landing.hero.lede':
    'Un itinéraire sur une vraie carte, partagé en direct avec tous ceux qui partent - avec les réservations, l’argent et la liste à emporter rattachés.',
  'landing.hero.secondary': 'Voir ce que ça coûte',
  'landing.trust.noCard': 'Sans carte pour commencer',
  'landing.trust.noAds': 'Aucune publicité, aucun lien d’affiliation',
  'landing.trust.export': 'Tout exporter, quand vous voulez',

  'proof.eyebrow': 'Réponses directes',
  'proof.title':
    'Pas de témoignages, parce que nous ne les avons pas encore mérités',
  'proof.lede':
    'planned.travel est récent. Plutôt que d’inventer une citation ou d’emprunter le logo de quelqu’un, voici exactement ce qu’il fait, à qui il s’adresse et ce qu’il ne vous fera jamais.',
  'proof.who.label': 'À qui c’est destiné',
  'proof.who.heading': 'À celui qui finit par faire le tableur',
  'proof.who.body':
    'Aux couples, aux familles et aux groupes d’amis qui veulent un seul plan visible par tous, plutôt que six captures d’écran, trois groupes de discussion et une note partagée que personne n’a ouverte depuis mars.',
  'proof.not.label': 'Ce que ce n’est pas',
  'proof.not.heading': 'Ni un site de réservation, ni à vendre à l’un d’eux',
  'proof.not.body':
    'Nous ne prenons aucune commission, n’affichons aucune publicité et ne plaçons aucun lien d’affiliation : rien sur une page ne vous pousse discrètement vers un hôtel en particulier. C’est vous qui nous payez, donc nous travaillons pour vous.',
  'proof.where.label': 'Où vivent vos affaires',
  'proof.where.heading': 'Sur Cloudflare, dans votre propre espace de travail',
  'proof.where.body':
    'Les voyages sont dans une base de données limitée à votre espace de travail, les fichiers dans notre propre stockage d’objets, les deux servis depuis la périphérie de Cloudflare. Polar, notre revendeur officiel, gère le paiement et émet la facture : votre numéro de carte ne nous parvient jamais.',
  'proof.promise.ads.title': 'Pas de publicité, pas d’analytique tierce',
  'proof.promise.ads.body':
    'Rien sur cette page ne vous mesure pour quelqu’un d’autre.',
  'proof.promise.sold.title': 'Vos voyages ne sont jamais vendus ni loués',
  'proof.promise.sold.body':
    'Ni à des annonceurs, ni à des voyagistes, à personne.',
  'proof.promise.leave.title': 'Partez quand vous voulez, avec tout',
  'proof.promise.leave.body':
    'Itinéraires PDF, fichiers calendrier et vos lieux en GeoJSON.',
  'proof.certification':
    'Nous n’avons aujourd’hui aucune certification de sécurité, et nous n’allons pas en laisser croire une. Quand planned.travel sera audité selon une norme, c’est ici que nous nommerons la norme, l’auditeur et la date - pas avant.',

  'feature.modules.title': 'Le reste du voyage, réglé',
  'feature.modules.lede':
    'Chaque module fait une seule chose correctement et transmet son travail aux autres. Rien ici n’est un onglet en attente d’une future version.',
  'feature.module.lists.benefit': 'Personne n’arrive sans l’adaptateur.',
  'feature.module.lists.detail':
    'Bagages, tâches, courses et documents : une liste par sujet, partagée avec tous ceux qui partent et cochée au fil des choses.',
  'feature.module.journal.name': 'Carnet',
  'feature.module.journal.benefit':
    'Le voyage devient un récit, pas un dossier.',
  'feature.module.journal.detail':
    'Des entrées par date, avec les photos que vous avez prises, l’endroit, la météo et ce que la journée a vraiment donné.',
  'feature.module.atlas.benefit':
    'Une carte de tous les endroits où vous êtes allé.',
  'feature.module.atlas.detail':
    'Marquez un pays comme visité et il rejoint votre carte du monde, avec la première visite, la dernière et le nombre de fois où vous y êtes retourné.',
  'feature.module.vacay.benefit': 'Posez les congés avant de réserver le vol.',
  'feature.module.vacay.detail':
    'Marquez les jours où vous êtes absent et l’année se remplit : week-ends, jours fériés et les congés de tout le monde dans la même grille.',
  'feature.module.collab.benefit': 'Les décisions restent avec le voyage.',
  'feature.module.collab.detail':
    'Un fil par voyage, des notes partagées pour ce que tout le monde doit retenir, et un sondage quand le groupe n’arrive pas à choisir le dîner.',
  'feature.module.files.benefit':
    'Les cartes d’embarquement là où vous les trouverez.',
  'feature.module.files.detail':
    'Confirmations, billets, attestations d’assurance et reçus rattachés au voyage auquel ils appartiennent, pas enfouis dans une boîte mail.',

  'feature.planner.title':
    'Un programme jour par jour tracé sur une vraie carte',
  'feature.planner.lede':
    'Rassemblez les lieux que vous voulez voir, puis glissez-les sur une journée. La carte redessine l’itinéraire au fur et à mesure : vous voyez tout de suite quand une matinée vous fait traverser la ville deux fois.',
  'feature.planner.point.days':
    'Une colonne par jour, avec sa date, sa météo et l’endroit où vous dormez.',
  'feature.planner.point.unscheduled':
    'Les lieux sans date attendent dans leur propre colonne jusqu’à ce qu’ils aient un jour.',
  'feature.planner.point.crew':
    'Sur {crew}, tout le monde glisse en même temps : curseurs en direct, synchronisation instantanée, aucun rechargement.',
  'feature.planner.point.tiles':
    'Des tuiles vectorielles servies depuis notre propre stockage : aucun fournisseur de cartes ne regarde ce que vous préparez.',
  'feature.costs.title': 'Des dépenses partagées qui se soldent vraiment',
  'feature.costs.lede':
    'Notez vos dépenses dans la devise du voyage, partagez chacune comme vous en êtes réellement convenus, et voyez la série de virements la plus courte qui solde le tout.',
  'feature.costs.point.split':
    'À parts égales, par quote-part ou au montant exact : par dépense, pas par voyage.',
  'feature.costs.point.currency':
    'Tout converti dans une seule devise de voyage, pour que le total veuille dire quelque chose.',
  'feature.costs.point.settle':
    'La vue de solde dit qui paie qui, et enregistre le virement dès qu’il est fait.',
  'feature.costs.point.receipt':
    'Joignez le justificatif à la dépense : le montant a toujours sa preuve.',
  'feature.book.title':
    'Chaque réservation, avec le code qu’il vous faut à l’entrée',
  'feature.book.lede':
    'Hébergements, tables, visites et billets sur une seule liste, à côté des vols, trains et ferries qui vous mènent de l’un à l’autre : chacun avec son numéro de confirmation et le jour auquel il appartient.',
  'feature.book.point.legs':
    'Les trajets portent la place, le quai, le terminal et le code de réservation.',
  'feature.book.point.day':
    'Une réservation est rattachée à un jour : elle apparaît dans le programme sans être ressaisie.',
  'feature.book.point.states':
    'Demandée, confirmée et annulée sont des états distincts, pas une note dans un champ.',
  'feature.book.point.export':
    'Exportez tout le voyage en itinéraire PDF ou en fichier calendrier avant de partir.',

  'pricing.faq.trial.q': "Que se passe-t-il à la fin de l'essai ?",
  'pricing.faq.trial.a':
    "L'essai se transforme en formule payante. Polar enregistre un moyen de paiement au début de l'essai et le débite le jour où l'essai se termine : résiliez avant, et vous n'êtes jamais débité. Rien n'est jamais supprimé dans un cas comme dans l'autre : les modules payants se verrouillent, vos voyages restent exactement où ils sont, et tout se rouvre dès que vous vous abonnez.",
  'pricing.faq.seller.q': 'À qui est-ce que j’achète en réalité ?',
  'pricing.faq.seller.a':
    "À Polar. C'est notre revendeur officiel : il vous vend l'abonnement en tant que revendeur, encaisse le paiement, émet la facture en son propre nom, et détermine, collecte et reverse la taxe de vente ou la TVA que votre pays applique. Les remboursements et les litiges de carte se règlent aussi avec lui. C'est toujours nous qui faisons tourner le service et qui répondons à vos e-mails.",
  'pricing.faq.change.q': 'Puis-je changer de formule au milieu d’un voyage ?',
  'pricing.faq.change.a':
    "Oui. Les montées en formule s'appliquent immédiatement et sont calculées au prorata du jour ; les descentes prennent effet à la fin de la période déjà payée, donc vous ne perdez jamais un accès que vous avez payé.",
  'pricing.faq.seats.q':
    'Comment fonctionne la facturation par membre sur {crew} ?',
  'pricing.faq.seats.a':
    "Vous payez les places que vous occupez réellement, et vous pouvez changer ce nombre à tout moment. Les invitations en attente comptent dans vos places, pour qu'un espace ne dépasse jamais la formule sans le dire.",
  'pricing.faq.guests.q':
    'Mes compagnons de voyage ont-ils besoin de leur propre abonnement ?',
  'pricing.faq.guests.a':
    'Non. Toutes les personnes que vous invitez dans un espace de travail {crew} sont couvertes par ses places. Elles se connectent avec leur propre compte et voient les voyages auxquels elles ont été ajoutées.',
  'pricing.faq.storage.q': 'Qu’est-ce qui compte dans le stockage ?',
  'pricing.faq.storage.a':
    "Les photos, les billets, les confirmations et tout fichier que vous joignez à un voyage. Les tuiles de carte et l'application elle-même ne comptent jamais. Vous voyez exactement ce qui occupe de la place dans les Réglages.",
  'pricing.faq.export.q': 'Puis-je récupérer mes données ?',
  'pricing.faq.export.a':
    "Toujours. Chaque voyage s'exporte en itinéraire PDF et en fichier calendrier, et vos lieux s'exportent en GeoJSON. Ce sont vos voyages, pas les nôtres.",

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Sans carte, sans échéance, sans compte à rebours',
  'pricing.card.yearlyPerSeat': '{amount} par an et par membre, en une fois',
  'pricing.card.yearly': '{amount} facturés en une fois par an',
  'pricing.card.seatsUnlimited': 'Membres illimités',
  'pricing.card.tripsUnlimited': 'voyages illimités',
  'pricing.card.startFree': 'Commencer gratuitement',
  'pricing.card.startTrial': 'Essayer {plan}',
  'pricing.card.popular': 'Le plus choisi',
  'pricing.card.noteYearly': 'Facturé une fois par an. Deux mois offerts.',
  'pricing.card.noteMonthly':
    'Facturé au mois. Changez ou résiliez quand vous voulez.',
  'pricing.card.trial': {
    one: '{value} jour d’essai, carte à l’avance, prélèvement à la fin',
    many: '{value} jours d’essai, carte à l’avance, prélèvement à la fin',
    other: '{value} jours d’essai, carte à l’avance, prélèvement à la fin',
  },
  'pricing.card.seatsUpTo': {
    one: 'Jusqu’à {value} membre',
    many: 'Jusqu’à {value} membres',
    other: 'Jusqu’à {value} membres',
  },
  'pricing.card.trips': {
    one: '{value} voyage à la fois',
    many: '{value} voyages à la fois',
    other: '{value} voyages à la fois',
  },

  'pricing.feature.storage': '{size} pour les photos et les documents',
  'pricing.feature.storageShared':
    '{size} partagés pour les photos et les documents',
  'pricing.feature.free.tripsDetail':
    'Archivez-en un pour en commencer un autre',
  'pricing.feature.solo.modules': 'Tous les modules de préparation',
  'pricing.feature.solo.modulesDetail':
    'Réservations, carnet, budgets, bagages',
  'pricing.feature.crew.membersDetail':
    'Facturé par membre, modifiable à tout moment',
  'pricing.feature.crew.realtimeDetail':
    'Curseurs en direct et synchronisation instantanée',
  'pricing.feature.crew.supportDetail': 'Une réponse humaine en un jour ouvré',

  'pricing.hero.eyebrow': 'Deux voyages gratuits, pour toujours',
  'pricing.hero.title': 'Planifiez comme il faut.',
  'pricing.hero.titleQuiet': 'Payez ce que vous utilisez.',
  'pricing.hero.lede':
    "Planifiez deux voyages gratuitement. Débloquez chaque module pour un voyageur, ou emmenez toute l'équipe et modifiez le même itinéraire en même temps.",
  'pricing.hero.taxNote':
    "Prix en dollars américains, hors taxe de vente ou TVA. Polar est notre revendeur officiel : c'est lui qui figure sur votre facture, qui détermine ce que votre pays prélève, l'ajoute au paiement et le reverse. Résiliez quand vous voulez, depuis le produit.",
  'pricing.compare.eyebrow': 'Côte à côte',
  'pricing.compare.title': 'Chaque limite, comparée',
  'pricing.compare.lede':
    "Un tableau, généré depuis le même catalogue que lit la facturation. Si une ligne dit qu'un module est inclus, le contrôle des droits est d'accord.",
  'pricing.compare.caption':
    'Comparaison des fonctionnalités et des limites sur les trois formules',
  'pricing.compare.feature': 'Fonctionnalité',
  'pricing.compare.limits': 'Limites',
  'pricing.compare.included': 'Inclus',
  'pricing.compare.notIncluded': 'Non inclus',
  'pricing.compare.includedIn': 'Inclus dans {plan}',
  'pricing.compare.notIn': 'Pas dans {plan}',
  'pricing.questions.eyebrow': 'Avant que vous ne demandiez',
  'pricing.questions.title': 'Questions, réponses',
  'pricing.questions.lede':
    'Facturation, essais et récupération de vos données.',
  'pricing.cta.secondary': 'Voir comment ça marche',
  'pricing.module.itinerary': 'Itinéraire jour par jour',
  'pricing.module.map': 'Carte interactive',
  'pricing.module.budget': 'Budgets et partage des dépenses',
  'pricing.module.packing': 'Listes à emporter et à faire',
  'pricing.module.reservations': 'Réservations',
  'pricing.module.journal': 'Carnet de voyage',
  'pricing.module.atlas': 'Carte du monde visitée',
  'pricing.module.collaboration': "Inviter d'autres voyageurs",
  'pricing.module.realtime': 'Collaboration en direct',
  'pricing.module.offlineMaps': 'Cartes hors ligne',
  'pricing.module.pdfExport': 'Export PDF et calendrier',
  'pricing.module.prioritySupport': 'Support prioritaire',

  'anchor.plans': 'Formules',
  'anchor.compare': 'Comparatif',
  'anchor.questions': 'Questions fréquentes',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Un seul endroit pour l’itinéraire, la carte, les réservations, l’argent et la liste de bagages — partagé avec tous ceux qui partent.',
  'footer.attribution':
    'Fonctionne sur Cloudflare Workers. Données cartographiques © les contributeurs d’OpenStreetMap. Vente et facturation par Polar, notre marchand officiel.',
  'footer.column.product': 'Produit',
  'footer.column.account': 'Compte',
  'footer.link.overview': 'Aperçu',
  'footer.link.everyModule': 'Tous les modules',
  'footer.link.dayPlanner': 'Planificateur de journée',
  'footer.link.sharedCosts': 'Dépenses partagées',
  'footer.link.reservations': 'Réservations',
  'footer.link.atlasJournal': 'Atlas et carnet',
  'footer.link.createAccount': 'Créer un compte',
  'footer.link.terms': 'Conditions d’utilisation',
  'footer.link.privacy': 'Avis de confidentialité',
} satisfies TranslationOf<typeof En>

export default messages
