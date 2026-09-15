/**
 * The trip modules' own copy, in fr.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Pluriel.** `one` · `many` · `other`. **Typographie.** Le français cite avec « … ».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Non défini',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Connexion',
  'presence.connecting.body':
    'Nous entrons dans le salon en direct de ce voyage.',
  'presence.live.title': 'En direct',
  'presence.live.body':
    'Messages, notes et votes arrivent ici au fur et à mesure.',
  'presence.reconnecting.title': 'Reconnexion',
  'presence.reconnecting.body':
    'La connexion a lâché. Nouvelle tentative — tout ce que vous envoyez est quand même enregistré.',
  'presence.offline.title': 'Hors direct',
  'presence.offline.body':
    'Les mises à jour en direct sont coupées. Tout s’enregistre encore ; rechargez ou réessayez pour rattraper.',
  'presence.reconnect': 'Se reconnecter',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Tous les trajets',
  'transports.empty.title': 'Aucun trajet pour l’instant',
  'transports.empty.body':
    'Vols, trains, ferries et le trajet depuis l’aéroport vivent ici, avec leurs codes de réservation et numéros de siège sous la main le jour J — et chaque enchaînement vérifié contre le précédent.',
  'transports.empty.action': 'Ajouter le premier trajet',
  'transports.filtered.title': 'Aucun trajet de ce type',
  'transports.filtered.body':
    'Chaque trajet de ce voyage se fait autrement. Revenez à « {label} » pour les voir tous.',
  'transports.filtered.action': 'Afficher tous les trajets',
  'transports.alert.impossible.title': {
    one: 'Un enchaînement est impossible',
    many: '{value} enchaînements sont impossibles',
    other: '{value} enchaînements sont impossibles',
  },
  'transports.alert.impossible.body':
    'Un trajet part avant l’arrivée du précédent. Les jonctions ci-dessous disent lesquelles, et de combien.',
  'transports.alert.tight.title': {
    one: 'Un enchaînement est juste',
    many: '{value} enchaînements sont justes',
    other: '{value} enchaînements sont justes',
  },
  'transports.alert.tight.body':
    'Il y a du temps, mais peu pour le mode que vous attrapez. Les jonctions ci-dessous montrent ce que chacune laisse.',
  'transports.badge.impossible': {
    one: '{value} enchaînement rompu',
    many: '{value} enchaînements rompus',
    other: '{value} enchaînements rompus',
  },
  'transports.badge.tight': {
    one: '{value} enchaînement juste',
    many: '{value} enchaînements justes',
    other: '{value} enchaînements justes',
  },
  'transports.badge.ok': 'Chaque enchaînement tient',
  'transports.remove.body':
    'Le trajet quitte ce voyage pour de bon, avec sa référence de réservation et son siège. S’il est seulement annulé, mettez plutôt son statut sur Annulé.',
  'transports.remove.confirm': 'Supprimer le trajet',
  'transports.menu.edit': 'Modifier le trajet…',
  'transports.field.service': 'Liaison',
  'transports.field.bookingRef': 'Référence de réservation',
  'transports.field.seat': 'Siège',
  'transports.field.distance': 'Distance parcourue',
  'transports.noTime': 'Pas encore d’horaire',
  'transports.toast.statusFailed.title': 'Le statut n’a pas changé',
  'transports.toast.statusFailed.body':
    'Le trajet est resté dans son état précédent.',
  'transports.toast.removed': 'Trajet supprimé',
  'transports.toast.removeFailed': 'Le trajet n’a pas été supprimé',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Ajouter un trajet',
  'transports.dialog.editTitle': 'Modifier ce trajet',
  'transports.dialog.description':
    'Vols, trains, ferries et le trajet depuis l’aéroport. Les horaires sont ceux, locaux, imprimés sur le billet.',
  'transports.form.modeLegend': 'Comment voyagez-vous',
  'transports.form.timingError': 'Vérifiez les horaires',
  'transports.field.namePlaceholder': 'Air France de CDG à HND',
  'transports.field.place': 'Lieu',
  'transports.field.code': 'Indicatif',
  'transports.field.date': 'Jour',
  'transports.field.time': 'Départ à partir de',
  'transports.field.departurePlaceholder': 'Paris Charles-de-Gaulle',
  'transports.field.arrivalPlaceholder': 'Tokyo-Haneda',
  'transports.field.carrier': 'Transporteur',
  'transports.field.serviceNumber': 'Numéro de service',
  'transports.field.bookingRefHint': 'Le code que vous donnerez au comptoir.',
  'transports.field.notesPlaceholder':
    'Place côté couloir demandée. Bagages enregistrés jusqu’à Kyoto.',
  'transports.action.add': 'Ajouter le trajet',
  'transports.action.save': 'Enregistrer le trajet',
  'transports.action.saving': 'Enregistrement du trajet',
  'transports.toast.added': 'Trajet ajouté',
  'transports.toast.addedBody': 'Il est désormais dans l’ordre du voyage.',
  'transports.toast.addFailed': 'Le trajet n’a pas été ajouté',
  'transports.toast.updated': 'Trajet mis à jour',
  'transports.toast.updateFailed': 'Le trajet n’a pas été mis à jour',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Libellé',
  'field.time': 'Heure',
  'field.price': 'Prix',
  'field.notes': 'Remarques',
  'field.status': 'Statut',
  'form.saveError': 'Cela n’a pas été enregistré',
  'action.cancel': 'Annuler',
  'action.showCode': 'Afficher {label}',
  'book.status.none': 'Sans statut',
  'book.status.pending': 'En attente',
  'book.status.confirmed': 'Confirmée',
  'book.status.completed': 'Terminée',
  'book.status.cancelled': 'Annulée',
  'book.toast.statusFailed': 'Le statut n’a pas changé',
  'book.toast.statusFailedBody':
    'La réservation est restée dans son état précédent.',
  'book.toast.removed': 'Réservation supprimée',
  'book.toast.removeFailed': 'La réservation n’a pas été supprimée',
  'book.empty.title': 'Rien de réservé pour l’instant',
  'book.empty.body':
    'Hébergements, tables, visites et billets vont ici — avec le numéro de confirmation là où vous le retrouverez à la porte, et la date qui les place sur la frise.',
  'book.empty.action': 'Ajouter la première réservation',
  'book.filtered.title': 'Rien de ce type pour l’instant',
  'book.filtered.body':
    'Rien n’est réservé parmi les types que vous avez choisis. Effacez le filtre pour voir le reste du comptoir.',
  'book.filtered.action': 'Effacer le filtre',
  'book.panel.outstanding': 'Encore à régler',
  'book.panel.outstandingEmpty': 'Rien en attente — tout ici est réglé.',
  'book.panel.settled': 'Réglé',
  'book.panel.settledEmpty':
    'Rien de réglé pour l’instant — tout reste à relancer.',
  'book.import.badge': 'Import non vérifié',
  'book.import.hint':
    'Importé depuis une confirmation. Ouvrez-le et enregistrez-le pour le marquer vérifié.',
  'book.import.action': 'Importer',
  'book.import.title': 'Importer des réservations depuis un fichier',
  'book.import.description':
    'Dépose une confirmation, nous la lirons. Rien n’entre dans le voyage avant que tu l’aies vu.',
  'book.import.drop.idle': 'Dépose les fichiers ici, ou parcours-les',
  'book.import.drop.active': 'Relâche pour ajouter',
  'book.import.drop.formats':
    'PDF, e-mail enregistré, page web, photo, Word, Excel, fichier de calendrier ou export JSON.',
  'book.import.drop.limits':
    'Jusqu’à {files} fichiers à la fois, chacun jusqu’à {size}.',
  'book.import.drop.browse': 'Parcourir les fichiers',
  'book.import.refused.format':
    '« {filename} » n’est pas un fichier que cet import sait lire. Il lit un PDF, un e-mail enregistré, une page web, une photo, un document Word ou Excel, un fichier de calendrier ou un export JSON.',
  'book.import.refused.tooMany':
    'Seulement {files} fichiers à la fois. Le reste n’a pas été ajouté.',
  'book.import.refused.tooLarge':
    '« {filename} » pèse {size}. Un import lit des fichiers jusqu’à {limit}.',
  'book.import.refused.empty':
    '« {filename} » est vide, il n’y a donc rien à lire.',
  'book.import.ceiling.title':
    'Cet espace a lu toutes ses confirmations ce mois-ci',
  'book.import.ceiling.body':
    'La formule comprend {ceiling} lectures de fichier par mois, et le quota se renouvelle le premier. Tu peux toujours ajouter une réservation à la main.',
  'book.import.ceiling.none':
    'Lire un fichier de confirmation ne fait pas partie de la formule de cet espace',
  'book.import.ceiling.noneBody':
    'Change de formule pour qu’une confirmation soit lue pour toi. Ajouter une réservation à la main reste toujours possible.',
  'book.import.widget.title': 'Lecture des confirmations',
  'book.import.widget.working': '{done} sur {total} lus',
  'book.import.widget.file': 'Lecture de « {filename} »',
  'book.import.widget.done': {
    one: 'Une réservation prête à vérifier',
    many: '{count} réservations prêtes à vérifier',
    other: '{count} réservations prêtes à vérifier',
  },
  'book.import.widget.review': 'Vérifier',
  'book.import.widget.failed': '« {filename} » n’a pas pu être lu',
  'book.import.widget.stalled': 'C’est plus long que prévu',
  'book.import.widget.check': 'Revérifier',
  'book.import.widget.dismiss': 'Masquer',
  'book.import.review.title': 'Ce que nous avons lu',
  'book.import.review.from': 'De « {filename} »',
  'book.import.review.selectAll': 'Tout sélectionner',
  'book.import.review.selectNone': 'Ne rien sélectionner',
  'book.import.review.confirm': {
    one: 'Ajouter {count} réservation',
    many: 'Ajouter {count} réservations',
    other: 'Ajouter {count} réservations',
  },
  'book.import.review.confirmNone': 'Sélectionne une réservation à ajouter',
  'book.import.review.cancel': 'Annuler',
  'book.import.review.needsReview': 'À regarder',
  'book.import.review.needsReviewHint':
    'Certains champs n’étaient pas dans le document. Ouvre la réservation après l’avoir ajoutée.',
  'book.import.review.noPrice': 'Aucun prix lu',
  'book.import.review.noPriceHint':
    'Le document n’en indiquait aucun clairement, le champ est donc resté vide plutôt que deviné.',
  'book.import.review.untitled': 'Réservation sans titre',
  'book.import.empty.title':
    'Nous n’avons trouvé aucune réservation dans ce fichier',
  'book.import.empty.body':
    '« {filename} » ne contenait rien qui ressemble à une confirmation. Essaie un autre fichier, ou ajoute la réservation à la main.',
  'book.import.failed.title': '« {filename} » n’a pas pu être lu',
  'book.import.failed.body':
    'Le fichier s’est ouvert mais rien n’en est sorti. Essaie un autre fichier, ou ajoute la réservation à la main.',
  'book.import.failed.retry': 'Essayer un autre fichier',
  'book.import.uploadFailed': '« {filename} » n’a pas été envoyé',
  'book.import.uploadRetry': 'Réessayer',
  'book.import.toast.added': {
    one: 'Une réservation ajoutée',
    many: '{count} réservations ajoutées',
    other: '{count} réservations ajoutées',
  },
  'book.import.partial.title':
    '{written} réservations sur {total} ont été ajoutées',
  'book.import.partial.body':
    'Le reste est toujours sélectionné. Réessayer n’écrit que celles-là.',
  'book.import.partial.retry': 'Ajouter le reste',
  'book.journeyLink': 'Dans l’onglet transports',
  'filter.all': 'Tout',
  'book.remove.body':
    'Elle quitte la frise définitivement. Si elle est seulement annulée, mettez plutôt son statut sur Annulée pour garder la trace.',
  'book.remove.confirm': 'Supprimer la réservation',
  'book.menu.edit': 'Modifier la réservation…',
  'book.menu.open': 'Ouvrir la réservation',
  'book.noDate': 'Pas encore de date',
  'book.until': 'Jusqu’au',
  'book.provider': 'Prestataire',
  'book.where': 'Où',
  'book.guests': 'Personnes',
  'book.confirmation': 'Référence',
  'book.undated': 'Donnez-leur une date et elles rejoignent la frise',
  statusOf: 'Statut de {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Pas encore de statut',
  'book.statusChoice.pending': 'En attente — de leur côté',
  'book.dialog.addTitle': 'Ajouter une réservation',
  'book.dialog.editTitle': 'Modifier cette réservation',
  'book.dialog.typeLegend': 'Quel type de réservation',
  'book.field.namePlaceholder': '15 rue de Rivoli',
  'book.field.priceHint': 'Laissez vide si ce n’est pas encore réglé.',
  'book.field.confirmation': 'Numéro de confirmation',
  'book.field.confirmationHint': 'Le code qu’on vous demandera au comptoir.',
  'book.field.day': 'Rattacher à un jour',
  'book.field.dayHint':
    'L’épingle à l’itinéraire pour qu’elle apparaisse au programme.',
  'book.field.noDay': 'Hors itinéraire',
  'book.field.link': 'Lien',
  'book.field.notesPlaceholder':
    'Arrivée tardive convenue. Demander une chambre loin de l’ascenseur.',
  'book.action.add': 'Ajouter la réservation',
  'book.action.save': 'Enregistrer la réservation',
  'book.action.saving': 'Enregistrement de la réservation',
  'book.toast.added': 'Réservation ajoutée',
  'book.toast.addedBody': 'Elle est désormais sur la frise.',
  'book.toast.addFailed': 'La réservation n’a pas été ajoutée',
  'book.toast.updated': 'Réservation mise à jour',
  'book.toast.updateFailed': 'La réservation n’a pas été mise à jour',

  'book.emptyFacts':
    'Rien d’autre que le nom pour l’instant. Ouvre-le pour ajouter l’heure, le prix et le numéro de confirmation.',
  'book.onItinerary': 'À l’itinéraire : {day}',
  'book.dayNumber': 'Jour {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Autre',
  'book.field.host': 'Hôtel ou hôte',
  'book.field.restaurant': 'Nom du restaurant',
  'book.field.operator': 'Organisateur',
  'book.field.issuer': 'Émis par',
  'book.field.carrier': 'Transporteur',
  'book.field.address': 'Adresse',
  'book.field.meetingPoint': 'Point de rendez-vous',
  'book.field.venue': 'Lieu',
  'book.field.fromTo': 'De et vers',
  'book.field.checkIn': 'Arrivée',
  'book.field.date': 'Jour',
  'book.field.validOn': 'Valable le',
  'book.field.departs': 'Départ',
  'book.field.checkOut': 'Départ',
  'book.field.ends': 'Fin',
  'book.field.arrives': 'Arrivée',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Musée Ghibli',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Qui garde cela pour vous',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 chambres twin',
  'book.example.restaurantTitle': 'Dîner au Den',
  'book.example.activityTitle': 'teamLab Planets, 4 billets',
  'book.example.tourTitle': 'Balade dans la bambouseraie d’Arashiyama',
  'book.example.ticketTitle': 'Musée Ghibli, entrée à 10:00',
  'book.example.transportTitle': 'Nozomi 21 pour Kyoto',
  'book.example.otherTitle': 'Ce que vous avez réservé',
  'book.hint.accommodation':
    'Un hôtel, un ryokan, un appartement — partout où vous dormez.',
  'book.hint.restaurant': 'Une table réservée. C’est l’heure qui vous engage.',
  'book.hint.activity': 'Un cours, un bain public, une expérience réservée.',
  'book.hint.tour': 'Un lieu, une heure, et un guide qui attend.',
  'book.hint.ticket':
    'Une entrée horodatée, un pass musée, un match. Garde le code à portée.',
  'book.hint.transport':
    'Une place réservée. Les trajets complets avec codes vont dans {module}.',
  'book.hint.other':
    'Tout ce qui est retenu à votre nom et n’entre pas ailleurs.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Bagages',
  'lists.kind.todo': 'À faire',
  'lists.kind.shopping': 'Courses',
  'lists.kind.documents': 'Papiers',
  'lists.kind.fallback': 'Liste',
  'colour.none': 'Sans couleur',
  'colour.pine': 'Pin',
  'colour.inkBlue': 'Bleu encre',
  'colour.amber': 'Ambre',
  'colour.green': 'Vert',
  'colour.red': 'Rouge',
  'colour.slate': 'Ardoise',
  'lists.toast.created': 'Liste créée',
  'lists.toast.createdBody':
    'Ajoute la première chose que tu ne dois pas oublier.',
  'lists.toast.createFailed': 'La liste n’a pas été créée',
  'lists.toast.updated': 'Liste mise à jour',
  'lists.toast.updateFailed': 'La liste n’a pas été mise à jour',
  'lists.error.weightLimit':
    'Une limite de poids est un nombre entier de grammes.',
  'lists.dialog.editTitle': 'Modifier cette liste',
  'lists.dialog.editBody':
    'Renomme-la, change son type ou confie-la à un seul voyageur.',
  'lists.dialog.addBody':
    'Bagages, tâches, courses et les documents à ne pas oublier — chacun a sa propre liste.',
  'lists.action.new': 'Nouvelle liste',
  'lists.field.namePlaceholder': 'Bagage à main',
  'lists.field.kind': 'Type',
  'lists.field.kindAria': 'Type de liste',
  'lists.field.owner': 'Appartient à',
  'lists.field.ownerHint': 'Les listes partagées se cochent à plusieurs.',
  'lists.field.everyone': 'Tout le monde sur le voyage',
  'lists.field.weightLimit': 'Limite de poids',
  'lists.field.weightLimitHint':
    'Grammes. Laisse vide s’il n’y a aucune limite à respecter.',
  'colour.legend': 'Couleur',
  'lists.action.saving': 'Enregistrement de la liste',
  'lists.action.save': 'Enregistrer la liste',
  'lists.action.create': 'Créer la liste',
  'lists.item.toast.added': 'Élément ajouté',
  'lists.item.toast.addFailed': 'L’élément n’a pas été ajouté',
  'lists.item.toast.updated': 'Élément mis à jour',
  'lists.item.toast.updateFailed': 'L’élément n’a pas été mis à jour',
  'lists.item.error.quantity': 'Une quantité est un nombre entier de 1 à 999.',
  'lists.item.error.weight': 'Un poids est un nombre entier de grammes.',
  'lists.item.dialog.editTitle': 'Modifier cet élément',
  'lists.item.dialog.addTitle': 'Ajouter un élément',
  'lists.item.field.label': 'Élément',
  'lists.item.field.placeholder': 'Passeport',
  'field.category': 'Catégorie',
  'lists.item.field.categoryHint':
    'Regroupe la liste sous un titre. Facultatif.',
  'lists.item.field.categoryPlaceholder': 'Papiers',
  'lists.item.field.priority': 'Priorité',
  'lists.priorityChoice.high': 'Haute — ne pas oublier',
  'lists.priorityChoice.low': 'Basse — s’il reste de la place',
  'lists.priorityChoice.normal': 'Normale',
  'lists.item.field.quantity': 'Quantité',
  'lists.item.field.weight': 'Poids',
  'lists.item.field.weightHint': 'Grammes, par unité.',
  'lists.item.field.owner': 'À qui revient cette tâche',
  'lists.item.owner.nobody': 'Personne en particulier',
  'lists.item.action.saving': 'Enregistrement de l’élément',
  'lists.item.action.save': 'Enregistrer l’élément',
  'lists.item.action.add': 'Ajouter à la liste',
  'lists.template.loadError':
    'Les modèles n’ont pas pu être chargés pour le moment.',
  'lists.template.toast.added': 'Liste ajoutée depuis un modèle',
  'lists.template.toast.addFailed': 'Le modèle n’a pas été appliqué',
  'lists.template.error.apply': 'Cela ne s’est pas appliqué',
  'lists.template.error.load': 'Les modèles ne se sont pas chargés',
  'lists.template.empty.title': 'Aucun modèle pour l’instant',
  'lists.template.empty.body':
    'Enregistre une liste comme modèle dès que tu en as une que tu refarais à l’identique, et elle apparaîtra ici pour chaque voyage à venir.',
  'lists.template.applying': 'Application du modèle',
  'lists.template.dialogTitle': 'Partir d’un modèle',
  'lists.template.loading': 'Chargement des modèles',
  'lists.template.apply': 'Appliquer le modèle',
  'lists.template.from': 'Depuis un modèle',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Non attribué',
  'lists.toast.listRemoved': 'Liste supprimée',
  'lists.toast.listRemoveFailed': 'La liste n’a pas été supprimée',
  'lists.toast.itemRemoved': 'Élément supprimé',
  'lists.toast.itemRemoveFailed': 'L’élément n’a pas été supprimé',
  'lists.toast.reset': 'Liste réinitialisée',
  'lists.toast.resetBody': 'Tout est décoché et prêt pour le prochain voyage.',
  'lists.toast.resetFailed': 'La liste n’a pas été réinitialisée',
  'lists.toast.tickFailed': 'La coche n’a pas été enregistrée',
  'lists.toast.tickFailedBody': 'L’élément est revenu tel qu’il était.',
  'lists.toast.assignFailed': 'L’attribution n’a pas été enregistrée',
  'lists.toast.orderFailed': 'Le nouvel ordre n’a pas été enregistré',
  'lists.toast.orderFailedBody': 'La liste est revenue telle qu’elle était.',
  'lists.filter.todo': 'Encore à faire',
  'lists.filter.done': 'Terminé',
  'lists.scope.all': 'Toutes les listes',
  'lists.scope.shared': 'Partagées',
  'lists.scope.mine': 'Les miennes',
  'lists.empty.mine.title': 'Aucune liste à toi pour l’instant',
  'lists.empty.shared.title': 'Aucune liste partagée pour l’instant',
  'lists.empty.mine.body':
    'Une liste à toi n’est cochée que par toi — pratique pour ce que personne d’autre n’a besoin de voir.',
  'lists.empty.shared.body':
    'Une liste partagée se coche à plusieurs, comme ça deux personnes n’emportent pas le même adaptateur.',
  'lists.remove.list': 'Supprimer la liste',
  'lists.remove.item': 'Supprimer l’élément',
  'lists.remove.itemBody': 'Il quitte cette liste. Rien d’autre ne change.',
  'lists.menu.editList': 'Modifier la liste…',
  'lists.menu.tickAll': 'Tout cocher',
  'lists.menu.untickAll': 'Tout décocher',
  'lists.menu.reset': 'Réinitialiser pour le prochain voyage',
  'lists.menu.dragOrderLong': 'Passer à un ordre que tu peux glisser',
  'lists.menu.groupAgain': 'Regrouper à nouveau par catégorie',
  'lists.menu.dragOrder': 'Passer à un ordre déplaçable',
  'lists.menu.groupByCategory': 'Regrouper par catégorie',
  'lists.weight.packed': '{weight} emballés',
  'lists.weight.packedOver': '{weight} emballés — au-delà de la limite',
  'lists.weight.packedOf': '{weight} emballés sur {limit} autorisés',
  'lists.weight.packedOfOver':
    '{weight} emballés sur {limit} autorisés — au-delà de la limite',
  'lists.progress.ticked': '{done} sur {total} cochés',
  'lists.items.empty.title': 'Cette liste est vide',
  'lists.items.empty.body':
    'Ajoute la première chose que tu ne dois pas oublier — le champ ci-dessous est le plus rapide.',
  'lists.items.doneEmpty.title': 'Rien de coché pour l’instant',
  'lists.items.doneEmpty.body': 'Coche quelque chose et ça apparaîtra ici.',
  'lists.items.todoEmpty.title': 'Tout est fait ici',
  'lists.items.todoEmpty.body':
    'Chaque élément de cette liste est coché. Passe à « {label} » pour les voir.',
  'lists.category.other': 'Tout le reste',
  'lists.dnd.fallbackName': 'cet élément',
  'lists.dnd.picked': '{name} attrapé.',
  'lists.dnd.dropped':
    '{name} déposé. Le nouvel ordre est en cours d’enregistrement.',
  'lists.dnd.cancelled': 'Annulé. L’ordre est inchangé.',
  'lists.menu.editItem': 'Modifier l’élément…',
  'lists.quickAdd.placeholder': 'Saisis un élément et appuie sur Entrée',
  'lists.quickAdd.aria': 'Ajouter un élément à cette liste',
  'lists.quickAdd.detailsHint':
    'Ajouter avec un poids, une catégorie ou une personne',
  'lists.quickAdd.detailsAria': 'Ajouter un élément avec tous ses détails',
  'lists.show': 'Afficher',
  'lists.priority.high': 'Haute',
  'lists.action.add': 'Ajouter',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} élément',
    many: '{count} éléments',
    other: '{count} éléments',
  },
  'lists.template.copiedIn': {
    one: '{count} élément copié, prêt à cocher.',
    many: '{count} éléments copiés, prêts à cocher.',
    other: '{count} éléments copiés, prêts à cocher.',
  },
  'lists.remove.listBody': {
    one: 'La liste et son {count} élément quittent ce voyage. Les modèles enregistrés ne changent pas.',
    many: 'La liste et ses {count} éléments quittent ce voyage. Les modèles enregistrés ne changent pas.',
    other:
      'La liste et ses {count} éléments quittent ce voyage. Les modèles enregistrés ne changent pas.',
  },

  'lists.item.dialog.body':
    'Tout sauf le nom est facultatif — un poids rend le total du sac réel, et une catégorie regroupe la liste.',
  'lists.template.dialogBody':
    'Un modèle est une liste que tu as déjà enregistrée. En appliquer un la copie comme nouvelle liste sur ce voyage — l’original reste intact.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Supprimer « {name} » ?',
  actionsFor: 'Actions pour {name}',
  'lists.dnd.reorder': 'Réordonner {name}',
  'lists.action.untickItem': 'Décocher {name}',
  'lists.action.tickOffItem': 'Cocher {name}',
  'lists.item.assignAria': 'Attribuer {name} à quelqu’un',
  'lists.item.reassignAria': '{item} revient à {owner} — réattribuer',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Donne à cette réservation un nom que tu reconnaîtras dans une liste.',
  'error.titleLong': 'Garde le nom sous 160 caractères.',
  'book.error.required': 'Il manque à cette réservation : {field}.',
  'book.error.timeNeedsDate': 'Une heure a besoin du jour où elle tombe.',
  'book.error.endTimeNeedsDate':
    'Une heure de fin a besoin du jour où elle tombe.',
  'book.error.endsBeforeStart': 'Cela se termine avant de commencer.',
  'book.error.endTimeBeforeStart': 'L’heure de fin est avant l’heure de début.',
  'book.error.guests':
    'Le nombre de personnes doit être un entier jusqu’à 1000.',
  'error.price': 'Ce montant nous est illisible.',
  'book.error.url': 'Un lien doit commencer par http:// ou https://.',
  'book.error.confirmationLong':
    'Ce numéro de confirmation est trop long à enregistrer.',
  'book.error.stopGone': 'Cet arrêt ne fait plus partie de ce voyage.',
  'book.ledger.unlinked':
    'La ligne de coût de cette réservation restera dans les coûts du voyage, sans plus y être liée.',
  'book.ledger.updated':
    'La ligne de coût de cette réservation passera à {money}.',
  'book.ledger.needsDate':
    'Donnez une date à cette réservation et son coût rejoindra les coûts du voyage.',
  'book.ledger.added':
    'Une ligne de {money} sera ajoutée aux coûts de ce voyage.',
  'book.fieldName.provider': 'organisateur',
  'book.fieldName.location': 'lieu',
  'book.fieldName.confirmationNumber': 'numéro de confirmation',
  'book.fieldName.link': 'lien',
  'book.fieldName.date': 'jour',
  'book.fieldName.time': 'heure',
  'book.fieldName.endDate': 'date de fin',
  'book.fieldName.endTime': 'heure de fin',
  'book.fieldName.guests': 'nombre de personnes',
  'book.fieldName.price': 'prix',
  'book.fieldName.stop': 'arrêt',
  'book.field.stop': 'Arrêt lié',
  'book.field.stopHint': 'À quel arrêt du plan cette réservation correspond.',
  'book.field.stopHintEmpty':
    'Ajoutez d’abord un lieu à une journée, puis vous pourrez y rattacher cette réservation',
  'book.field.stopPlaceholder': 'Lié à aucun arrêt',
  'book.field.stopSearch': 'Rechercher parmi les arrêts et les journées',
  'book.field.stopEmpty': 'Aucun arrêt ne correspond',
  'book.ledger.refused.title': 'Enregistré, mais pas ajouté aux dépenses',
  'book.ledger.refused.body':
    'La réservation est sur le voyage. L’ajout de sa ligne de dépense aux dépenses du voyage n’a pas abouti — réessayez cette moitié.',
  'book.action.ledgerRetry': 'Ajouter aux dépenses',
  'book.copyConfirmation': 'le numéro de confirmation de {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Vol',
  'transports.mode.train': 'Train',
  'transports.mode.bus': 'Bus',
  'transports.mode.ferry': 'Ferry',
  'transports.mode.car': 'Voiture',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Transports',
  'transports.mode.metro': 'Métro',
  'transports.mode.tram': 'Tramway',
  'transports.mode.bike': 'Vélo',
  'transports.mode.walk': 'À pied',
  'transports.mode.other': 'Autre',
  'transports.mode.fallback': 'Trajet',
  'transports.rank.earliest': 'Arrivée la plus tôt',
  'transports.rank.fewestChanges': 'Moins de correspondances',
  'transports.connection.findStop': 'Trouver un arrêt',
  'transports.connection.findStopSearch': 'CDG, Gare de Lyon, Paris…',
  'transports.connection.findStopEmpty':
    'Aucun arrêt de ce nom dans le catalogue.',
  'transports.connection.hideStops': 'Masquer les arrêts',
  'transports.connection.seeStops': 'Voir les arrêts',
  'transports.connection.saving': 'Enregistrement de la connexion',
  'transports.connection.use': 'Prendre celle-ci',
  'transports.connection.onFoot': 'À pied',
  'transports.connection.service': 'Ligne',
  'transports.connection.direct': 'sans correspondance',
  'transports.connection.changes': {
    one: '{changes} correspondance',
    many: '{changes} correspondances',
    other: '{changes} correspondances',
  },
  'transports.connection.tooLong':
    'Cette connexion compte plus de {max} tronçons, soit plus qu’un seul enregistrement de voyage ne contient. Cherchez un saut plus court et notez le reste à part.',
  'transports.connection.refusal.ceiling': 'Plus aucune recherche ce mois-ci',
  'transports.connection.refusal.unconfigured':
    'La recherche de connexions est désactivée sur ce déploiement',
  'transports.connection.refusal.provider':
    'Le service d’horaires n’a pas répondu',
  'transports.connection.refusal.plan':
    'La recherche de connexions ne fait pas partie de cette formule',
  'transports.connection.refusal.planBody':
    'Changez de formule pour interroger les horaires depuis un voyage. Un trajet peut toujours être saisi à la main.',
  'transports.connection.refusal.ceilingBody':
    'Le quota mensuel de {ceiling} est épuisé ; il se renouvelle le premier du mois prochain. Un trajet peut toujours être saisi à la main.',
  'transports.connection.refusal.unconfiguredBody':
    'Aucun service d’horaires n’est configuré ici, donc rien n’a été cherché. Saisissez le trajet à la main.',
  'transports.connection.refusal.providerBody':
    'Rien n’est revenu à afficher. Réessayez dans un instant, ou saisissez le trajet à la main.',
  'transports.connection.invitation':
    'Deux arrêts et une date, et l’horaire répond. Rien n’est enregistré tant que vous n’avez pas choisi.',
  'transports.connection.empty':
    'Aucune connexion trouvée entre ces deux arrêts à cette date. Essayez une gare voisine ou élargissez le filtre de modes.',
  'transports.connection.searchFailed': 'La recherche n’a pas eu lieu',
  'transports.connection.searchFailedBody': 'Réessayez dans un instant.',
  'transports.connection.saved': 'Connexion enregistrée',
  'transports.connection.replaced': 'Itinéraire remplacé',
  'transports.connection.replacedBody':
    'Le code de réservation et le siège restent intacts.',
  'transports.connection.saveFailed': 'La connexion n’a pas été enregistrée',
  'transports.connection.saveError': 'Cela n’a pas été enregistré',
  'transports.connection.fromHint':
    'Choisissez un arrêt — on demande à un horaire où, pas comment cela s’appelle.',
  'transports.connection.toHint': 'Choisissez un arrêt dans le catalogue.',
  'transports.connection.timeHint':
    'Un horaire répond avec les prochains départs, donc ceci décide lesquels.',
  'transports.connection.onlyModes': 'Seulement ces modes',
  'transports.connection.searching': 'Recherche dans les horaires',
  'transports.connection.search': 'Rechercher des connexions',
  'transports.connection.title': 'De {from} à {to}',
  'transports.status.idea': 'Idée',
  'transports.status.pending': 'En attente',
  'transports.status.confirmed': 'Confirmé',
  'transports.status.completed': 'Terminé',
  'transports.status.cancelled': 'Annulé',
  'transports.end.fromAirport': 'Aéroport de départ',
  'transports.end.toAirport': 'Aéroport d’arrivée',
  'transports.end.fromPort': 'Port de départ',
  'transports.end.toPort': 'Port d’arrivée',
  'transports.end.fromStation': 'Gare de départ',
  'transports.end.toStation': 'Gare d’arrivée',
  'transports.end.from': 'Départ',
  'transports.end.to': 'Arrivée',
  'transports.end.pickUp': 'Prise en charge',
  'transports.end.dropOff': 'Restitution',
  'transports.end.departureDay': 'Jour de départ',
  'transports.end.arrivalDay': 'Jour d’arrivée',
  'transports.end.pickUpDay': 'Jour de prise en charge',
  'transports.end.returnDay': 'Jour de restitution',
  'transports.dayNumber': 'Jour {n}',
  'transports.error.titleEmpty':
    'Donne à ce trajet un nom que tu reconnaîtras dans une liste.',
  'transports.error.date': 'Une date s’écrit AAAA-MM-JJ.',
  'transports.error.time': 'Une heure s’écrit HH:MM sur 24 heures.',
  'transports.error.departureNeedsDate':
    'Une heure de départ a besoin du jour où elle tombe.',
  'transports.error.arrivalNeedsDate':
    'Une heure d’arrivée a besoin du jour où elle tombe.',
  'transports.error.code': 'Un code fait 2 à 8 lettres ou chiffres.',
  'transports.error.distance':
    'Une distance est un nombre de kilomètres, jusqu’à 100 000.',
  'transports.error.arrivesBeforeDeparts': 'Ce trajet arrive avant de partir.',
  'transports.error.timingHint':
    'Décale l’un des deux pour que le trajet soit réellement attrapable.',
  'transports.error.arrivalDayBeforeDeparture':
    'Le jour d’arrivée précède le jour de départ.',
  'transports.error.returnDayBeforePickUp':
    'Le jour de restitution précède le jour de prise en charge.',
  'transports.toast.chainFailed': 'Les tronçons n’ont pas été enregistrés',
  'transports.toast.chainFallback':
    'Le voyage a été enregistré, mais pas ses tronçons.',
  'transports.field.noDay': 'Aucun jour pour l’instant',
  'transports.fill.legend': 'Comment remplir ceci',
  'transports.fill.manual': 'Saisir vous-même',
  'transports.fill.searchAgain': 'Chercher à nouveau',
  'transports.fill.search': 'Chercher des correspondances',
  'transports.chain.unsplit': 'Refaire un seul voyage',
  'transports.field.arrivalDayHint':
    'Un voyage qui arrive le lendemain matin le dit ici.',
  'transports.chain.splitHint':
    'Changement en route ? Notez chaque partie avec son propre numéro de service, quai, siège et horaires.',
  'transports.chain.split': 'Découper en tronçons',
  'transports.chain.stopNumber': 'arrêt {n}',
  'transports.chain.change': 'Correspondance {n}',
  'transports.chain.removeStation': 'Supprimer {label}',
  'transports.chain.findStation': 'Trouver un aéroport ou une gare',
  'transports.chain.findStationFor':
    'Trouver un aéroport ou une gare pour {label}',
  'transports.chain.findPlaceholder': 'CDG, Roissy, Paris…',
  'transports.chain.findEmpty':
    'Aucun résultat — saisissez l’arrêt vous-même ci-dessous.',
  'transports.chain.stopLabel': 'Arrêt',
  'transports.chain.stopPlaceholder': 'Paris Gare de Lyon',
  'transports.chain.timezoneHint': 'Sur quelle horloge se lit cet arrêt',
  'transports.chain.timezoneAt': 'Fuseau horaire à {label}',
  'transports.chain.timezonePlaceholder': 'Non précisé',
  'transports.chain.timezoneSearch': 'Tokyo, Lisbonne, UTC…',
  'transports.chain.acrossClocks': '{gap} entre deux horloges',
  'transports.chain.addStopAfter': 'Ajouter un arrêt après {label}',
  'transports.chain.servicePlaceholder': 'TGV 6215',
  'transports.chain.leaves': 'Départ de {label}',
  'transports.chain.reaches': 'Arrivée à {label}',
  'transports.chain.dayOfLeg': '{label} du tronçon {n}',
  'transports.chain.formError': 'Cette chaîne ne peut pas être enregistrée',
  'transports.chain.atCap':
    'Une chaîne contient au plus {max} tronçons — c’est une limite de ce qu’un enregistrement transporte, pas du nombre de correspondances d’un voyage.',
  'transports.chain.hint':
    'Ajoutez un arrêt sur n’importe quel tronçon pour noter un changement de train ; chaque tronçon garde son numéro, sa voie et son siège.',
  'transports.field.timezone': 'Fuseau horaire',
  'transports.field.platform': 'Voie',
  'transports.chain.legNumber': 'Tronçon {n}',
  'transports.chain.platform': 'Voie {value}',
  'transports.chain.seat': 'Siège {value}',
  'transports.chain.error.stopName':
    'Chaque arrêt a besoin d’un nom — c’est là que vous changez.',
  'transports.chain.error.stopNameLong':
    'Le nom d’un arrêt doit rester sous 200 caractères.',
  'transports.chain.error.timezone':
    'Choisissez un fuseau horaire dans la liste.',
  'transports.chain.error.tooManyLegs':
    'Une chaîne contient au plus {max} tronçons.',
  'transports.bookingRefFor': 'la référence de réservation de {title}',
  'transports.doorToDoor': 'Cela fait {gap} de porte à porte.',
  'transports.title.fromTo': '{operator} de {from} à {to}',
  'transports.title.from': '{operator} au départ de {from}',
  'transports.title.to': '{operator} vers {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Aucune heure à comparer',
  'transports.junction.unknown.detail':
    'Renseigne la date et l’heure des deux trajets, et cette correspondance sera vérifiée pour toi.',
  'transports.junction.impossible.headline':
    'Part {gap} avant l’arrivée du trajet précédent',
  'transports.junction.impossible.detail':
    '« {to} » part avant l’arrivée de « {from} » : impossible d’avoir les deux. Décale l’un des deux.',
  'transports.junction.tight.headline': '{gap} pour la correspondance',
  'transports.junction.tight.detail':
    'Pour {mode}, il faut d’ordinaire environ {required}. Là, c’est juste.',
  'transports.junction.tight.detailAt':
    'Pour {mode}, il faut d’ordinaire environ {required} à {place}. Là, c’est juste.',
  'transports.junction.ok.headline': '{gap} d’écart',
  'transports.junction.ok.detail':
    'Arrivée à {landing} mais le trajet suivant part de {boarding} — il faudra traverser.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Note partagée',
  'collab.note.toast.sharedBody':
    'Tout le monde sur le voyage la voit désormais.',
  'collab.note.toast.shareFailed': 'La note n’a pas été partagée',
  'collab.note.toast.updated': 'Note mise à jour',
  'collab.note.toast.updateFailed': 'La note n’a pas été mise à jour',
  'collab.note.dialog.editTitle': 'Modifier cette note',
  'collab.note.dialog.addTitle': 'Nouvelle note partagée',
  'collab.note.dialog.body':
    'Des restaurants conseillés, des règles de visa, le code de la porte — tout ce que le voyage entier doit retenir, au même endroit.',
  'collab.note.field.title': 'Titre',
  'collab.note.field.titlePlaceholder': 'Code de la porte',
  'collab.note.field.body': 'Contenu',
  'collab.note.field.bodyPlaceholder':
    '4821, puis la touche dièse. La boîte à clés est à gauche de la porte.',
  'collab.note.field.categoryHint':
    'Regroupe le tableau sous un filtre. Facultatif.',
  'collab.note.field.categoryPlaceholder': 'Logistique',
  'collab.note.field.pin': 'Épingler en haut du tableau',
  'collab.note.field.pinHint':
    'Les notes épinglées passent devant, quoi qu’on ajoute ensuite.',
  'collab.note.action.saving': 'Enregistrement de la note',
  'collab.note.action.save': 'Enregistrer la note',
  'collab.note.action.share': 'Partager la note',
  'collab.poll.toast.opened': 'Sondage ouvert',
  'collab.poll.toast.openedBody': 'Tout le monde sur le voyage peut voter.',
  'collab.poll.toast.openFailed': 'Le sondage n’a pas été ouvert',
  'collab.poll.dialog.addTitle': 'Nouveau sondage',
  'collab.poll.field.question': 'Question',
  'collab.poll.field.questionPlaceholder': 'Où mange-t-on le dernier soir ?',
  'collab.poll.field.optionsLegend': 'Choix',
  'collab.poll.field.option': 'Réponse {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Une autre réponse',
  'collab.poll.action.addOption': 'Ajouter une réponse',
  'collab.poll.action.removeOption': 'Supprimer la réponse {n}',
  'collab.poll.field.multi': 'Autoriser plusieurs choix',
  'collab.poll.field.multiHint':
    'Désactivé, c’est une voix par personne, et changer d’avis la déplace.',
  'collab.poll.action.opening': 'Ouverture du sondage',
  'collab.poll.action.open': 'Ouvrir le sondage',
  'collab.poll.error.tooFew':
    'Un sondage a besoin d’au moins deux choses entre lesquelles choisir.',
  'collab.poll.error.duplicate':
    'Deux réponses disent la même chose. Donne à chacune sa propre formulation.',
  'collab.presence.viewingNow': 'regardent en ce moment',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} onglet ouvert',
    many: '{name} — {count} onglets ouverts',
    other: '{name} — {count} onglets ouverts',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'D’accord',
  'collab.reaction.love': 'J’adore',
  'collab.reaction.funny': 'Drôle',
  'collab.reaction.celebrate': 'On fête',
  'collab.reaction.thanks': 'Merci',
  'collab.reaction.looking': 'Je regarde',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, toi compris',
  'collab.thread.today': 'Aujourd’hui',
  'collab.thread.empty': 'Aucun message pour l’instant',
  'collab.toast.reactionFailed': 'La réaction n’a pas été enregistrée',
  'collab.toast.messageDeleted': 'Message supprimé',
  'collab.toast.deleteFailed': 'Le message n’a pas été supprimé',
  'collab.toast.notSent': 'Non envoyé',
  'collab.toast.notSentBody':
    'Le message n’a pas pu être envoyé. Réessaie dans un instant.',
  'collab.toast.messageUpdated': 'Message mis à jour',
  'collab.toast.editFailed': 'La modification n’a pas été enregistrée',
  'collab.message.deleteTitle': 'Supprimer ce message ?',
  'collab.message.deleteBody':
    'Le texte disparaît du fil. Les réponses gardent leur place.',
  'collab.message.delete': 'Supprimer le message',
  'collab.message.reply': 'Répondre',
  'collab.message.menuEdit': 'Modifier le message…',
  'collab.message.react': 'Réagir à ce message',
  'collab.message.edited': 'modifié',
  'collab.message.actionsFor': 'Actions pour le message de {name}',
  'collab.compose.editingYours': 'Tu modifies ton message',
  'collab.compose.replyingTo': 'Réponse à {name}',
  'collab.compose.cancelReply': 'Annuler la réponse',
  'collab.compose.cancelEdit': 'Annuler la modification',
  'collab.compose.placeholder': 'Écris au voyage',
  'collab.compose.editPlaceholder': 'Modifier ton message',
  'collab.compose.editPlaceholderText': 'Change ce que tu as dit…',
  'collab.compose.send': 'Envoyer le message',
  'collab.compose.savingEdit': 'Enregistrement de la modification',
  'collab.compose.save': 'Enregistrer',
  'collab.hint.sends': 'envoie',
  'collab.hint.addsLine': 'ajoute une ligne',
  'collab.hint.cancels': 'annule',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Note supprimée',
  'collab.toast.noteRemoveFailed': 'La note n’a pas été supprimée',
  'collab.notes.empty.title': 'Aucune note partagée',
  'collab.notes.empty.body':
    'Des restaurants conseillés, des règles de visa, le code de la porte — tout ce que le voyage entier doit retenir.',
  'collab.notes.empty.action': 'Écris la première note',
  'collab.note.menu.edit': 'Modifier la note…',
  'collab.note.menu.unpin': 'Désépingler',
  'collab.note.menu.pin': 'Épingler en haut',
  'collab.note.remove': 'Supprimer la note',
  'collab.note.removeBody':
    'La note disparaît du tableau pour tout le monde sur le voyage.',
  'collab.note.new': 'Nouvelle note',
  'collab.poll.toast.voteFailed': 'Ta voix n’a pas été enregistrée',
  'collab.poll.toast.voteFailedBody': 'Le décompte reste inchangé.',
  'collab.poll.toast.closed': 'Sondage clos',
  'collab.poll.toast.closeFailed': 'Le sondage n’a pas été clos',
  'collab.poll.toast.removed': 'Sondage supprimé',
  'collab.poll.toast.removeFailed': 'Le sondage n’a pas été supprimé',
  'collab.polls.heading': 'Sondages',
  'collab.polls.empty.title': 'Aucun sondage ouvert',
  'collab.polls.empty.body':
    "Quand le groupe n'arrive pas à se décider sur un restaurant, mettez-le au vote et laissez la réponse se trancher d'elle-même.",
  'collab.polls.empty.action': 'Demander au groupe',
  'collab.poll.menu.close': 'Clore le sondage',
  'collab.poll.remove': 'Supprimer le sondage',
  'collab.poll.removeTitle': 'Supprimer ce sondage ?',
  'collab.poll.actionsFor': 'Actions pour le sondage « {question} »',
  'collab.badge.pinned': 'Épinglée',
  'collab.badge.closed': 'Clos',
  'collab.badge.open': 'Ouvert',
  'collab.badge.multi': 'Choix multiple',
  'collab.badge.leading': 'En tête',
  'collab.poll.removeBody': {
    one: '« {question} » et sa {count} voix disparaissent pour tout le monde.',
    many: '« {question} » et ses {count} voix disparaissent pour tout le monde.',
    other:
      '« {question} » et ses {count} voix disparaissent pour tout le monde.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} sur {count} voix',
    many: '{label} — {votes} sur {count} voix',
    other: '{label} — {votes} sur {count} voix',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} sur {count} voix, la tienne comprise',
    many: '{label} — {votes} sur {count} voix, la tienne comprise',
    other: '{label} — {votes} sur {count} voix, la tienne comprise',
  },
  'collab.poll.voteCount': {
    one: '{count} voix',
    many: '{count} voix',
    other: '{count} voix',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Document',
  'files.kind.photo': 'Photo',
  'files.kind.ticket': 'Billet',
  'files.kind.receipt': 'Reçu',
  'files.kind.map': 'Carte',
  'files.kind.other': 'Autre',
  'files.kindChoice.ticket': 'Billet ou laissez-passer',
  'files.kindChoice.map': 'Carte ou itinéraire',
  'files.toast.removed': 'Fichier supprimé',
  'files.toast.removeFailed': 'Le fichier n’a pas été supprimé',
  'files.toast.downloadFailed': 'Le téléchargement n’a pas démarré',
  'files.toast.gone': 'Le fichier n’est plus disponible dans cet onglet.',
  'files.toast.uploadFailed': 'L’envoi a échoué. Réessaie.',
  'files.toast.updated': 'Fichier mis à jour',
  'files.toast.updateFailed': 'Le fichier n’a pas été mis à jour',
  'files.storage.full': 'Cet espace de travail n’a plus de stockage',
  'files.storage.used':
    '{used} sur {limit} sont utilisés. Supprime un fichier ci-dessous, ou passe à une formule supérieure, avant d’ajouter autre chose.',
  'files.storage.perFile': 'jusqu’à {size} chacun',
  'files.action.add': 'Ajouter des fichiers',
  'files.action.choose': 'Choisir des fichiers',
  'files.action.upload': 'Envoyer les fichiers',
  'files.drop.active': 'Lâche pour envoyer',
  'files.drop.idle': 'Fais glisser des fichiers ici',
  'files.empty.title': 'Aucun fichier sur ce voyage',
  'files.empty.body':
    'Tout ce que tu devrais autrement déterrer d’une boîte mail au comptoir d’enregistrement est ici, rattaché au voyage concerné.',
  'files.empty.hint':
    'Cartes d’embarquement, confirmations d’hôtel, billets, documents d’assurance et les reçus qui justifient tes dépenses.',
  'files.heading': 'Pièces jointes',
  'files.tableCaption': 'Fichiers rattachés à ce voyage',
  'files.menu.download': 'Télécharger',
  'files.menu.rename': 'Renommer et décrire…',
  'files.menu.remove': 'Supprimer le fichier',
  'files.remove.body':
    'Le fichier est effacé du stockage comme du voyage, et {size} se libèrent. C’est irréversible.',
  'files.queue.clear': 'Effacer les terminés',
  'files.column.file': 'Fichier',
  'files.column.size': 'Taille',
  'files.column.addedBy': 'Ajouté par',
  'files.column.when': 'Quand',
  'files.status.uploaded': 'Envoyé',
  'files.status.failed': 'Échoué',
  'files.status.cancelled': 'Annulé',
  'files.status.uploading': 'Envoi en cours',
  'files.status.waiting': 'En attente',
  'files.error.nameEmpty':
    'Un fichier a besoin d’un nom qui te permette de le retrouver.',
  'files.field.kindHint':
    'Décide sous quel filtre il se range et quel symbole il reçoit.',
  'files.field.kindAria': 'Type de fichier',
  'files.field.description': 'Description',
  'files.field.descriptionPlaceholder':
    'Police d’assurance — couvre tout le groupe, numéro de sinistre page 2.',
  'files.dialog.title': 'Détails du fichier',
  'files.action.saving': 'Enregistrement du fichier',
  'files.action.save': 'Enregistrer les détails',
  'files.queue.someFailed': {
    one: '{count} fichier n’a pas été envoyé. La raison est sur chaque ligne — rien d’autre dans le lot n’a été touché.',
    many: '{count} fichiers n’ont pas été envoyés. La raison est sur chaque ligne — rien d’autre dans le lot n’a été touché.',
    other:
      '{count} fichiers n’ont pas été envoyés. La raison est sur chaque ligne — rien d’autre dans le lot n’a été touché.',
  },

  'files.action.cancelUploadOf': 'Annuler l’envoi de {name}',
  'files.action.dismissOf': 'Masquer {name}',
  'files.status.downloadingOf': 'Téléchargement de {name}',
  'files.status.uploadingOf': 'Envoi de {name}',
  'files.status.uploadingCount': {
    one: 'Envoi de {count} fichier',
    many: 'Envoi de {count} fichiers',
    other: 'Envoi de {count} fichiers',
  },

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Envoi annulé.',
  'files.error.badAnswer':
    'Le serveur a renvoyé une réponse que ce navigateur n’a pas su lire.',
  'files.error.connection':
    'La connexion a lâché pendant l’envoi. Vérifie ton réseau et réessaie.',
  'files.error.timeout': 'L’envoi a expiré. Réessaie.',
  'files.error.refused': 'Le serveur a refusé l’envoi ({status}).',
  'files.error.downloadShape':
    'Le téléchargement est revenu sous une forme que nous ne pouvions pas enregistrer.',
  'files.error.downloadFailed': 'Le téléchargement a échoué ({status}).',
  'files.toast.uploadedOne': 'Fichier envoyé',
  'files.toast.uploadedManyBody': '{size} ajoutés à ce voyage.',
  'files.toast.failedOne': 'Ce fichier n’a pas été envoyé',
  'files.toast.failedManyBody': 'La file ci-dessous dit pourquoi pour chacun.',
  'files.error.tooMany': {
    one: 'On ne peut ajouter que {count} fichier à la fois, donc « {name} » a été laissé de côté. Remets-le tout seul.',
    many: 'On ne peut ajouter que {count} fichiers à la fois, donc « {name} » a été laissé de côté. Remets-le tout seul.',
    other:
      'On ne peut ajouter que {count} fichiers à la fois, donc « {name} » a été laissé de côté. Remets-le tout seul.',
  },
  'files.toast.uploadedMany': {
    one: '{count} fichier envoyé',
    many: '{count} fichiers envoyés',
    other: '{count} fichiers envoyés',
  },
  'files.toast.failedMany': {
    one: '{count} fichier n’a pas été envoyé',
    many: '{count} fichiers n’ont pas été envoyés',
    other: '{count} fichiers n’ont pas été envoyés',
  },
} satisfies TranslationOf<typeof En>

export default messages
