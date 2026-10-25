/**
 * The trip tabs' own copy, in fr.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Pluriel.** `one` · `many` · `other` ; `many` ne sert qu’aux grands nombres compacts.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  'notFound.title': 'Nous ne trouvons pas ce voyage',
  'notFound.body':
    'Il ne figure pas parmi les voyages que vous pouvez ouvrir dans votre espace de travail actuel. Il a peut-être été supprimé ou vous n’y avez pas accès.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Ajouter un lieu à ce voyage',
  'plan.editor.editTitle': 'Modifier ce lieu',
  'plan.editor.createDescription':
    'Donnez-lui un nom maintenant et une position plus tard - un lieu non planifié attend dans le panneau des lieux avant son ajout à une journée.',
  'plan.editor.editDescription':
    'Les changements s’appliquent partout : carte, journées concernées et liste des lieux du voyage.',
  'plan.editor.nameRequired': 'Un lieu doit avoir un nom',
  'plan.editor.nameExample': 'p. ex. Fushimi Inari Taisha',
  'plan.editor.city': 'Ville',
  'plan.editor.cityExample': 'p. ex. Kyoto',
  'plan.editor.addressExample': 'p. ex. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Durée sur place',
  'plan.editor.rating': 'Ça vaut le détour ?',
  'plan.editor.latitude': 'Latitude géographique',
  'plan.editor.longitude': 'Longitude géographique',
  'plan.editor.positionHint':
    'Ou fermez ceci et choisissez le point sur la carte.',
  'plan.editor.latitudeError': 'Entre -90 et 90',
  'plan.editor.longitudeError': 'Entre -180 et 180',
  'plan.editor.positionError': 'Une position nécessite les deux nombres',
  'plan.editor.day': 'Ajouter à une journée',
  'plan.editor.dayHint':
    'Laissez vide pour garder le lieu dans le panneau des lieux.',
  'plan.editor.unplanned': 'Laisser non planifié',
  'plan.editor.dayNamed': 'Jour {day} · {title}',
  'plan.editor.stopFallback': 'Cet arrêt',
  'plan.editor.dayNumber': 'Jour {day}',
  'plan.editor.visited': 'Déjà visité',
  'plan.editor.visitedHint': 'Ajoute une coche au repère.',
  'plan.editor.saving': 'Enregistrement du lieu',
  'plan.editor.save': 'Enregistrer les modifications',
  'plan.editor.noCategory': 'Sans catégorie',
  'plan.editor.arrive': 'Arrivée',
  'plan.editor.leave': 'Départ',
  'plan.editor.timeError': 'Le départ doit suivre l’arrivée',
  'plan.editor.booking': 'Réservation',
  'plan.editor.note': 'Note pour cette étape',
  'plan.editor.noteExample': 'Venez tôt - après 9 h, l’attente dure une heure.',
  'plan.editor.savingTimes': 'Enregistrement des horaires',
  'plan.editor.saveTimes': 'Enregistrer',
  'plan.editor.duration0': 'Sans durée fixe',
  'plan.editor.duration30': '30 minutes sur place',
  'plan.editor.duration45': '45 minutes sur place',
  'plan.editor.duration60': '1 heure',
  'plan.editor.duration90': '1½ heure',
  'plan.editor.duration120': '2 heures',
  'plan.editor.duration180': '3 heures',
  'plan.editor.duration240': 'Une demi-journée',
  'plan.editor.duration480': 'Une journée entière',
  'plan.editor.rating0': 'Non évalué',
  'plan.editor.rating1': '★ 1 - à éviter',
  'plan.editor.rating2': '★ 2 - s’il reste du temps',
  'plan.editor.rating3': '★ 3 - vaut le détour',
  'plan.editor.rating4': '★ 4 - très bien',
  'plan.editor.rating5': '★ 5 - à ne pas manquer',
  'plan.editor.bookingNone': 'Aucune réservation nécessaire',
  'plan.editor.bookingPending': 'À réserver',
  'plan.editor.bookingConfirmed': 'Réservé et confirmé',
  'plan.editor.bookingCompleted': 'Visite terminée',
  'plan.editor.bookingCancelled': 'Annulé',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Ce voyage n’a pas pu être chargé',
  'error.plan': 'L’itinéraire n’a pas pu être chargé',
  'error.costs': 'Les dépenses n’ont pas pu être chargées',
  'error.collab': 'La conversation n’a pas pu être chargée',
  'error.book': 'Les réservations n’ont pas pu être chargées',
  'error.transports': 'Les trajets n’ont pas été chargés',
  'error.people': 'Les personnes n’ont pas pu être chargées',
  'header.length': {
    one: '{days} jour',
    many: '{days} jours',
    other: '{days} jours',
  },
  'header.planned': {
    one: '{days} jour planifié',
    many: '{days} jours planifiés',
    other: '{days} jours planifiés',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinéraire',
  'plan.places': 'Lieux',
  'plan.readOnly.archived':
    'Ce voyage est archivé, le programme est donc en lecture seule.',
  'plan.readOnly.role':
    'Vous pouvez consulter ce programme. Seuls le propriétaire du voyage et les éditeurs peuvent le modifier.',
  'plan.day.empty': 'Rien de prévu — déposez ici un lieu ou une note',
  'plan.move.refused.duplicate': '{name} est déjà dans cette journée',
  'plan.move.refused.duplicateBody':
    'Un lieu ne peut apparaître qu’une fois par journée. Déplacez-le vers une autre journée.',
  'plan.move.refused.notInIdeas': 'Une note reste dans la journée',
  'plan.move.refused.notInIdeasBody':
    'Les idées sont des lieux en attente d’une journée. Une note appartient toujours à une journée.',
  'plan.move.refused.journeyNotInIdeas': 'Un trajet reste dans la journée',
  'plan.move.refused.journeyNotInIdeasBody':
    'Les idées sont des lieux en attente d’une journée. Un trajet appartient à la journée où il a lieu.',
  'plan.move.refused.journeyNotInAnotherDay': 'Un trajet reste dans sa journée',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'La journée d’un trajet vient de ses dates. Modifiez-les dans l’onglet Trajets.',
  'plan.move.refused.journeyTimed': '{name} part à {time}',
  'plan.move.refused.journeyTimedBody':
    'Une heure de départ appartient à l’horaire, pas au plan. Placez le trajet là où son horloge le met.',
  'plan.move.spoken.duplicate':
    '{name} n’a pas été déplacé. Cette journée le contient déjà.',
  'plan.move.spoken.notInIdeas':
    '{name} n’a pas été déplacé. Une note reste dans la journée.',
  'plan.move.spoken.timed':
    '{name} porte {time}. Nous demandons s’il faut l’abandonner.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} n’a pas été déplacé. Un trajet reste dans la journée.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} n’a pas été déplacé. Un trajet reste dans sa journée.',
  'plan.move.spoken.journeyTimed':
    '{name} n’a pas été déplacé. Départ à {time}.',
  'plan.move.error.save': 'Ce déplacement n’a pas été enregistré',
  'plan.move.error.retry': 'Réessayez dans un instant.',
  'plan.move.dropTime.title': 'Déplacer {name} et abandonner {time} ?',
  'plan.move.dropTime.body':
    'Cette position contredit l’heure qui y figure. Le déplacer ici efface l’heure : le nouvel ordre et l’heure effacée sont enregistrés ensemble.',
  'plan.move.dropTime.confirm': 'Déplacer et effacer l’heure',
  'plan.move.dropTime.cancel': 'Le laisser où il est',
  /* ------------------------------------------- a stop's menu and its delete */
  'plan.stop.menu.editPlace': 'Modifier le lieu',
  'plan.stop.menu.setTime': 'Définir une heure',
  'plan.stop.menu.placeOnMap': 'Le placer sur la carte',
  'plan.stop.menu.movePin': 'Déplacer son repère',
  'plan.stop.menu.moveToDay': 'Déplacer vers un autre jour',
  'plan.stop.menu.backToUnplanned': 'Remettre en non planifié',
  'plan.stop.menu.delete': 'Supprimer du voyage',
  'plan.stop.visited': 'Visité',
  'plan.delete.title': 'Supprimer « {name} » ?',
  'plan.delete.titleUnnamed': 'Supprimer ce lieu ?',
  'plan.delete.bodyUnplanned':
    'Il disparaît entièrement des lieux du voyage. Cette action est irréversible.',
  'plan.delete.bodyOnDays': {
    one: 'Il figure sur {count} jour de ce voyage et en disparaît. Cette action est irréversible.',
    many: 'Il figure sur {count} jours de ce voyage et disparaît de tous. Cette action est irréversible.',
    other:
      'Il figure sur {count} jours de ce voyage et disparaît de tous. Cette action est irréversible.',
  },
  'plan.delete.error': 'La suppression a échoué',
  'plan.delete.confirm': 'Supprimer le lieu',
  'plan.delete.deleting': 'Suppression du lieu',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Ajouter une note',
  'plan.note.addForDay': 'Ajouter une note, {day}',
  'plan.addPlace.label': 'Ajouter un lieu',
  'plan.addPlace.more': 'Autres façons d’ajouter un lieu',
  'plan.addPlace.option.map': 'Le placer sur la carte',
  'plan.addPlace.forDayNamed': 'Ajouter un lieu, {day}',
  'plan.addPlace.quota':
    'Vous avez atteint la limite de lieux de votre formule. Passez à une formule supérieure pour en ajouter.',
  'plan.addPlace.quotaAction': 'Voir les formules',
  'plan.stay.checkIn': 'Arrivée',
  'plan.stay.checkOut': 'Départ',
  'plan.day.addStay': 'Ajouter un hébergement, {day}',
  'plan.day.addStayShort': 'Ajouter un hébergement',
  'plan.handoff.stop':
    'Ouvrir {place} dans {service} (s’ouvre dans un nouvel onglet)',
  'plan.handoff.day.directions': 'Itinéraire dans {service}',
  'plan.handoff.day.directionsName':
    'Itinéraire dans {service} : {day} (s’ouvre dans un nouvel onglet)',
  'plan.handoff.day.directionsPartial':
    'Étapes : les {carried} premières sur {total}',
  'plan.handoff.day.directionsPartialName':
    'Itinéraire dans {service} : {day}, étapes : les {carried} premières sur {total} (s’ouvre dans un nouvel onglet)',
  'plan.handoff.day.point': 'Afficher dans {service}',
  'plan.handoff.day.pointName':
    'Afficher dans {service} : la seule étape localisée de {day} (s’ouvre dans un nouvel onglet)',
  'plan.handoff.day.part': 'Partie {n} sur {count}',
  'plan.handoff.day.directionsPartName':
    'Itinéraire dans {service}, partie {n} sur {count}, {day} (s’ouvre dans un nouvel onglet)',
  'plan.handoff.day.directionsPartialPartName':
    'Itinéraire dans {service}, partie {n} sur {count}, étapes : les {carried} premières sur {total}, {day} (s’ouvre dans un nouvel onglet)',
  'plan.handoff.day.pointPartName':
    'Afficher dans {service}, partie {n} sur {count}, {day} (s’ouvre dans un nouvel onglet)',
  'plan.drop.hint':
    'Faites un clic droit sur la carte, ou maintenez-la enfoncée, pour ajouter un lieu à cet endroit précis.',
  'plan.drop.armed':
    'Cliquez sur la carte à son emplacement, ou déplacez la carte et appuyez sur Entrée pour le déposer au centre.',
  'plan.drop.stop': 'Arrêter de placer un nouveau repère',
  'plan.drop.pin': 'Nouveau lieu',
  'plan.drop.lookingUp': 'Recherche de l’adresse…',
  'plan.drop.error':
    'L’épingle n’a pas pu être posée. Réessayez dans un instant.',
  'plan.place.pastedPosition': 'Lu comme latitude {lat}, longitude {lng}',
  'plan.note.showMore': 'Afficher plus',
  'plan.note.showLess': 'Afficher moins',
  'plan.note.moveUp': 'Monter',
  'plan.note.moveDown': 'Descendre',
  'plan.note.moveToDay': 'Déplacer vers un autre jour',
  'plan.note.drag': 'Réorganiser la note',
  'plan.note.edit': 'Modifier la note',
  'plan.note.delete': 'Supprimer la note',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Ajouter une note',
  'plan.note.dialog.editTitle': 'Modifier la note',
  'plan.note.field.body': 'Note',
  'plan.note.field.bodyHint': 'Une ligne. C’est ce que la journée affiche.',
  'plan.note.field.detail': 'Détails',
  'plan.note.field.detailHint':
    'Titres, listes, liens, citations, code et tableaux.',
  'plan.note.field.time': 'Heure',
  'plan.note.field.timeHint': 'Facultatif, au format 24 heures.',
  'plan.note.field.icon': 'Icône',
  'plan.note.tab.write': 'Rédiger',
  'plan.note.tab.preview': 'Aperçu',
  'plan.note.previewEmpty': 'Rien à afficher en aperçu pour l’instant',
  'plan.note.save': 'Enregistrer la note',
  'plan.note.cancel': 'Annuler',
  'plan.note.confirmDelete': 'Supprimer cette note ?',
  'plan.note.confirmDeleteBody':
    'La note et ses détails disparaissent de cette journée.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Note ajoutée',
  'plan.note.toast.updated': 'Note enregistrée',
  'plan.note.toast.deleted': 'Note supprimée',
  'plan.note.error.save': 'La note n’a pas été enregistrée',
  'plan.note.error.delete': 'La note n’a pas été supprimée',
  'plan.note.error.retry': 'Réessayez dans un instant.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Rappel',
  'plan.note.icon.clock': 'Heure',
  'plan.note.icon.flashlight': 'Lampe torche',
  'plan.note.icon.footprints': 'À pied',
  'plan.note.icon.info': 'Information',
  'plan.note.icon.luggage': 'Bagages',
  'plan.note.icon.package': 'Colis',
  'plan.note.icon.ticket': 'Billets',
  'plan.note.icon.trainFront': 'Train',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Mémo',
  'plan.note.icon.utensils': 'Repas',
  'plan.note.icon.bus': 'Transports',
  'plan.note.icon.bedDouble': 'Hébergement',
  'plan.note.icon.camera': 'Photo',
  'plan.note.icon.mapPin': 'Lieu',
  'plan.note.icon.wallet': 'Argent',
  'plan.note.icon.umbrella': 'Pluie',
  'plan.note.icon.triangleAlert': 'Attention',
  'plan.transport.phase.flight.departing': 'Décollage',
  'plan.transport.phase.flight.travelling': 'En vol',
  'plan.transport.phase.flight.arriving': 'Atterrissage',
  'plan.transport.phase.hire.departing': 'Prise en charge',
  'plan.transport.phase.hire.travelling': 'En location',
  'plan.transport.phase.hire.arriving': 'Restitution',
  'plan.transport.phase.journey.departing': 'Début',
  'plan.transport.phase.journey.travelling': 'En route',
  'plan.transport.phase.journey.arriving': 'Fin',
  'plan.transport.label': 'De {from} à {to}',
  'plan.transport.drag': 'Réorganiser, {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Ensemble',
  'collab.empty': 'Rien de partagé pour l’instant',
  'collab.conversation': 'Discussion',
  'collab.count.messages': {
    one: '{messages} message',
    many: '{messages} messages',
    other: '{messages} messages',
  },
  'collab.count.notes': {
    one: '{notes} note',
    many: '{notes} notes',
    other: '{notes} notes',
  },
  'collab.count.polls': {
    one: '{polls} sondage',
    many: '{polls} sondages',
    other: '{polls} sondages',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Réservations',
  'book.empty': 'Rien de réservé pour l’instant',
  'book.count.bookings': {
    one: '{bookings} réservation',
    many: '{bookings} réservations',
    other: '{bookings} réservations',
  },
  'book.count.confirmed': {
    one: '{confirmed} confirmée',
    many: '{confirmed} confirmées',
    other: '{confirmed} confirmées',
  },
  'book.progressLabel': {
    one: '{confirmed} réservation confirmée sur {total}',
    many: '{confirmed} réservations confirmées sur {total}',
    other: '{confirmed} réservations confirmées sur {total}',
  },
  'book.ofTotal': 'sur {total}',
  'book.confirmed': 'Confirmées',
  'book.awaiting': 'En attente de confirmation',
  'book.nothingHanging': 'Rien en suspens',
  'book.chase': 'Relancez avant le départ',
  'book.committed': 'Engagé',
  'book.committedCaption': 'Sur toutes les réservations de ce voyage',
  'book.onItinerary': 'Dans l’itinéraire',
  'book.pinnedCaption': 'Épinglé à un jour du plan',
  'book.readOnly.archived':
    'Ce voyage est archivé, les réservations et les séjours sont donc en lecture seule. Restaurez le voyage pour les modifier.',
  'book.readOnly.role':
    'Vous pouvez consulter ces réservations et séjours. Seuls le propriétaire du voyage et les éditeurs peuvent les modifier.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Cette modification a été refusée. Vérifiez l’état actuel du voyage avant de faire d’autres modifications.',
  'transports.recovery.failed':
    'Le voyage n’a pas pu être actualisé. Réessayez avant de faire des modifications.',
  'transports.readOnly.archived':
    'Ce voyage est archivé. Restaurez-le pour modifier les transports.',
  'transports.readOnly.role':
    'Vous pouvez consulter ces transports. Seuls le propriétaire du voyage et les éditeurs peuvent les modifier.',
  'transports.title': 'Trajets',
  'transports.empty': 'Rien de noté pour l’instant',
  'transports.count.transports': {
    one: '{transports} trajet',
    many: '{transports} trajets',
    other: '{transports} trajets',
  },
  'transports.distance': 'Distance parcourue',
  'transports.equator': '≈ {times}× le tour de l’équateur',
  'transports.noGrouping': 'Rien de regroupé pour l’instant',
  'transports.mostly': 'surtout {mode}',
  'transports.confirmed': 'Confirmés',
  'transports.stillPending': {
    one: '{pending} encore en attente',
    many: '{pending} encore en attente',
    other: '{pending} encore en attente',
  },
  'transports.spent': 'Dépensé en transport',
  'transports.noPrices': 'Aucun prix noté',
  'transports.priced': {
    one: 'sur {priced} trajet chiffré',
    many: 'sur {priced} trajets chiffrés',
    other: 'sur {priced} trajets chiffrés',
  },
  'people.title': 'Personnes',
  'people.description': 'Qui participe à ce voyage, et qui peut le trouver',
  'people.members.title': 'Sur ce voyage',
  'people.members.empty':
    'Plus personne de ce voyage ne fait partie de cet espace de travail',
  'people.role.label': 'Rôle',
  'people.role.owner': 'Propriétaire',
  'people.role.editor': 'Éditeur',
  'people.role.viewer': 'Lecteur',
  'people.you': 'Vous',
  'people.owner.hint': 'Un voyage garde toujours au moins un propriétaire',
  'people.remove.action': 'Retirer {name} de ce voyage',
  'people.remove.title': 'Retirer {name} de ce voyage ?',
  'people.remove.body':
    'Cette personne perd immédiatement l’accès à l’itinéraire. Ce qu’elle a ajouté reste sur le voyage.',
  'people.remove.confirm': 'Retirer',
  'people.leave.action': 'Quitter ce voyage',
  'people.leave.title': 'Quitter ce voyage ?',
  'people.leave.body':
    'Vous perdez l’accès à l’itinéraire jusqu’à ce que quelqu’un du voyage vous rajoute.',
  'people.leave.confirm': 'Quitter',
  'people.cancel': 'Annuler',
  'people.invite.title': 'Ajouter quelqu’un',
  'people.invite.placeholder':
    'Rechercher les personnes de cet espace de travail',
  'people.invite.action': 'Ajouter au voyage',
  'people.invite.role': 'Rejoint en tant que',
  'people.invite.empty':
    'Tout le monde dans cet espace participe déjà à ce voyage',
  'people.invite.emptyHint':
    'Quelqu’un de nouveau rejoint d’abord l’espace, dans les Réglages',
  'people.visibility.title': 'Qui peut trouver ce voyage',
  'people.visibility.switch': 'Visible par tout l’espace de travail',
  'people.visibility.private':
    'Seules les personnes listées ici voient ce voyage',
  'people.visibility.organization':
    'Toute personne de cet espace peut ouvrir ce voyage',
  'people.visibility.public': 'Ce voyage est partagé par un lien public',
  'people.error.lastOwner':
    'Un voyage garde au moins un propriétaire. Nommez d’abord quelqu’un d’autre propriétaire.',
  'people.error.notInWorkspace':
    'Cette personne n’est pas dans cet espace de travail',
  'people.error.alreadyOnTrip': 'Cette personne fait déjà partie de ce voyage',
  'people.guests.title': 'Ils voyagent avec vous',
  'people.guests.description':
    'Les personnes de ce voyage qui n’ont pas de compte',
  'people.guests.empty': 'Personne pour l’instant',
  'people.guests.emptyHint':
    'Un invité voyage avec vous sans avoir besoin de compte. Ajoutez-le par son nom.',
  'people.guest.badge': 'Invité',
  'people.guest.add.label': 'Son nom',
  'people.guest.add.placeholder': 'Léa',
  'people.guest.add.action': 'Ajouter un invité',
  'people.guest.rename.action': 'Renommer {name}',
  'people.guest.rename.title': 'Renommer {name}',
  'people.guest.rename.confirm': 'Renommer',
  'people.guest.remove.action': 'Retirer {name} de ce voyage',
  'people.guest.remove.title': 'Retirer {name} de ce voyage ?',
  'people.guest.remove.body':
    'L’invité est retiré. Rien d’autre ne change dans le voyage.',
  'people.guest.remove.confirm': 'Retirer',
  'people.guest.merge.action': '{name} est désormais…',
  'people.guest.merge.title':
    '{name} fait désormais partie des personnes de ce voyage',
  'people.guest.merge.body':
    'Tout ce qui était attribué à {name} passe à la personne choisie, et l’invité est retiré. Cette action est irréversible.',
  'people.guest.merge.inherits':
    '{member} reprend tout ce qui est attribué à {name}.',
  'people.guest.merge.placeholder': 'Choisissez quelqu’un de ce voyage',
  'people.guest.merge.confirm': 'Fusionner',
  'people.guest.merge.done': '{name} est désormais {member}',
  'people.guest.merge.nothingMoved': 'Rien ne lui était encore attribué',
  'people.error.guestNameTaken':
    'Un invité nommé {name} fait déjà partie de ce voyage',
  'people.error.guestLimit':
    'Un voyage compte au plus {limit} invités, car une liste plus longue rend illisibles le choix des participants et le partage des dépenses',
  'people.error.guestMergeTarget':
    'Choisissez quelqu’un qui fait déjà partie de ce voyage',
  'plan.weather.badge.forecast':
    'Prévisions : {figures}, {condition} (max. {max}, min. {min})',
  'plan.weather.badge.forecastNoCondition':
    'Prévisions : {figures} (max. {max}, min. {min})',
  'plan.weather.badge.unavailable': 'Météo indisponible pour ce jour',
  'plan.weather.badge.loading': 'Chargement de la météo',
  'plan.weather.badge.recorded': 'Relevé : max. {max}, min. {min}',
  'plan.weather.badge.recordedHigh': 'Relevé : max. {max}',
  'plan.weather.badge.recordedLow': 'Relevé : min. {min}',
  'plan.weather.badge.estimate':
    'Estimation : max. habituelle {max}, min. habituelle {min}',
  'plan.weather.badge.estimateHigh': 'Estimation : max. habituelle {max}',
  'plan.weather.badge.estimateLow': 'Estimation : min. habituelle {min}',
  'plan.weather.badge.notYetRecorded': 'Pas encore relevé',
  'plan.weather.condition.clear': 'Dégagé',
  'plan.weather.condition.fair': 'Beau temps',
  'plan.weather.condition.partlyCloudy': 'Partiellement nuageux',
  'plan.weather.condition.cloudy': 'Nuageux',
  'plan.weather.condition.fog': 'Brouillard',
  'plan.weather.condition.rain': 'Pluie',
  'plan.weather.condition.heavyRain': 'Forte pluie',
  'plan.weather.condition.sleet': 'Neige fondue',
  'plan.weather.condition.snow': 'Neige',
  'plan.weather.condition.thunder': 'Orage',
  'plan.weather.panel.title': 'Météo du {date}',
  'plan.weather.panel.temperature': 'Maximale / minimale',
  'plan.weather.panel.precipitation': 'Précipitations',
  'plan.weather.panel.precipitationTypical':
    'Précipitations quotidiennes habituelles',
  'plan.weather.panel.probability': '{percent} de probabilité',
  'plan.weather.panel.wind': 'Vent',
  'plan.weather.panel.sunrise': 'Lever du soleil',
  'plan.weather.panel.sunset': 'Coucher du soleil',
  'plan.weather.panel.noSunrise': 'Pas de lever du soleil',
  'plan.weather.panel.noSunset': 'Pas de coucher du soleil',
  'plan.weather.panel.slots': 'Au fil de la journée',
  'plan.weather.panel.slot.night': 'Nuit',
  'plan.weather.panel.slot.morning': 'Matin',
  'plan.weather.panel.slot.afternoon': 'Après-midi',
  'plan.weather.panel.slot.evening': 'Soir',
  'plan.weather.panel.high': 'Maximale',
  'plan.weather.panel.low': 'Minimale',
  'plan.weather.panel.recordedNote': 'Valeurs mesurées pour ce jour.',
  'plan.weather.panel.temperatureTypical': 'Max. / min. habituelles',
  'plan.weather.panel.estimateNote':
    'Moyenne à long terme pour ce mois, et non une prévision.',
  'plan.weather.attribution.metNorway':
    'Données de prévision : MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Données : NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Redimensionner l’itinéraire',
  'plan.workspace.resizePlaces': 'Redimensionner les lieux',
  'plan.workspace.toggleDay': 'Déplier ou replier {day}',
  'plan.workspace.days': 'Jours',
  'plan.workspace.showPanel': 'Afficher le panneau {label}',
  'plan.workspace.hidePanel': 'Masquer le panneau {label}',
  'plan.workspace.narrowPanel': 'Réduire {label}',
  'plan.workspace.widenPanel': 'Élargir {label}',
  'collab.sections.tabsLabel': 'Sections de collaboration',
  'collab.sections.trigger': 'Choisir les sections',
  'collab.sections.menuLabel': 'Afficher pour tous les participants du voyage',
  'collab.sections.keepOne': 'Au moins une section reste activée.',
  'collab.sections.failed': 'La modification n’a pas été enregistrée',
  'collab.sections.failedBody':
    'Le menu affiche l’état actuellement enregistré.',
  'collab.sections.someHidden':
    'Certaines sections sont masquées pour ce voyage.',
  'collab.sections.turnedOff':
    'Cette section a été désactivée pour le voyage. Elle se fermera quand vous enverrez ou effacerez votre brouillon.',
  'collab.sections.changed': 'Les sections de ce voyage ont changé.',
  'collab.sections.savedHidden':
    'Enregistré. Cette section est masquée pour le voyage et se ferme maintenant.',
  'plan.place.error.save':
    'Le lieu n’a pas pu être enregistré. Réessayez dans un instant.',
  'plan.stop.error.saveTimes':
    'Les horaires de l’étape n’ont pas pu être enregistrés. Réessayez dans un instant.',
  'plan.place.error.delete':
    'Le lieu n’a pas pu être supprimé. Réessayez dans un instant.',
  'plan.pin.error.move':
    'Le repère n’a pas pu être déplacé. Réessayez dans un instant.',
  'plan.place.toast.created': 'Lieu ajouté',
  'plan.place.toast.updated': 'Lieu mis à jour',
  'plan.stop.toast.timesSaved': 'Horaires de l’étape enregistrés',
  'plan.place.toast.deleted': 'Lieu supprimé',
  'plan.pin.toast.moved': '{name} épinglé',
  'join.page.title': 'Lien d’invitation au voyage',
  'join.page.description':
    'Ouvrez ce lien pour rejoindre un voyage partagé sur planned.travel.',
  'join.title.invited': '{inviter} vous invite à un voyage',
  'join.requirement':
    'Ce lien fonctionne pour les personnes déjà présentes dans l’espace de travail de {inviter}.',
  'join.newHere':
    'Première visite ? Demandez d’abord à {inviter} de vous ajouter à son espace de travail.',
  'join.trip.label': 'Voyage',
  'join.role.label': 'Vous rejoindriez en tant que',
  'join.dates.label': 'Dates du voyage',
  'join.destination.label': 'Destination du voyage',
  'join.action.signIn': 'Se connecter',
  'join.action.join': 'Rejoindre le voyage',
  'join.action.joining': 'Vous rejoignez le voyage',
  'join.action.open': 'Ouvrir le voyage',
  'join.action.openIn': 'Ouvrir le voyage et changer d’espace de travail',
  'join.action.openIn.pending': 'Changement d’espace de travail',
  'join.loading': 'Chargement de l’invitation',
  'join.joined.title': 'Vous avez rejoint le voyage',
  'join.joined.body': 'Ouvrez-le pour voir le programme.',
  'join.member.title': 'Vous participez déjà à ce voyage',
  'join.needsWorkspace.title':
    'Ce voyage se trouve dans un espace de travail dont vous ne faites pas partie',
  'join.needsWorkspace.body':
    'Demandez d’abord à {inviter} de vous ajouter à son espace de travail, puis rouvrez ce lien.',
  'join.needsWorkspace.signedInAs':
    'Vous êtes connecté avec l’adresse {email}. Dites à {inviter} d’utiliser cette adresse.',
  'join.needsWorkspace.acceptFirst':
    'Si vous avez déjà reçu un e-mail d’invitation à un espace de travail, acceptez-le d’abord, puis rouvrez ce lien.',
  'join.needsWorkspace.otherAccount': 'Se connecter avec un autre compte',
  'join.unavailable.title': 'Ce lien d’invitation n’est pas disponible',
  'join.unavailable.body':
    'Le lien a peut-être été remplacé ou désactivé. Demandez-en un nouveau à la personne qui vous l’a envoyé.',
  'join.unavailable.signIn': 'Se connecter',
  'join.unavailable.trips': 'Aller à vos voyages',
  'join.error.title': 'Nous n’avons pas pu charger ce lien d’invitation',
  'join.error.retry': 'Réessayer',
  'join.error.busy':
    'Cette page est très sollicitée. Réessayez dans une minute.',
  'join.error.join':
    'Impossible de rejoindre le voyage. Le lien fonctionne toujours, réessayez.',
  'join.error.switch': 'Impossible de changer d’espace de travail. Réessayez.',

  'invite.title': 'Lien d’invitation',
  'invite.description':
    'Toute personne de cet espace qui ouvre le lien rejoint le voyage.',
  'invite.empty.title': 'Aucun lien d’invitation',
  'invite.empty.body':
    'Créez un lien et partagez-le dans votre discussion de groupe pour permettre aux membres de cet espace de vous rejoindre.',
  'invite.action.create': 'Créer un lien',
  'invite.link.label': 'Lien d’invitation',
  'invite.copy': 'Copier le lien',
  'invite.copied': 'Lien copié',
  'invite.copyFailed':
    'Copie impossible. Sélectionnez le lien et copiez-le vous-même.',
  'invite.switch.label':
    'Toute personne de cet espace ayant le lien peut rejoindre le voyage',
  'invite.switch.onHint':
    'Désactiver le lien l’invalide pour tout le monde, y compris les copies déjà envoyées.',
  'invite.switch.offHint':
    'La réactivation crée un nouveau lien. Les anciens restent invalides.',
  'invite.off.body':
    'Le lien est désactivé. Personne ne peut l’utiliser pour rejoindre le voyage.',
  'invite.uses': {
    one: 'Personnes ayant rejoint via ce lien : {count}',
    many: 'Personnes ayant rejoint via ce lien : {count}',
    other: 'Personnes ayant rejoint via ce lien : {count}',
  },
  'invite.uses.never': 'Personne n’a encore rejoint le voyage via ce lien.',
  'invite.lastUsed': 'Dernière arrivée : {when}',
  'invite.role.upgrade.title': 'Accorder le rôle d’éditeur ?',
  'invite.role.upgrade.body':
    'Cela concerne toutes les copies déjà envoyées et toute personne qui rejoint le voyage à partir de maintenant.',
  'invite.role.upgrade.confirm': 'Accorder le rôle d’éditeur',
  'invite.replace.action': 'Remplacer le lien',
  'invite.replace.title': 'Remplacer ce lien ?',
  'invite.replace.body':
    'L’ancien lien sera immédiatement invalidé pour tous. Les personnes déjà inscrites restent dans le voyage ; retirez-les de la liste ci-dessous si nécessaire.',
  'invite.replace.deadBody':
    'L’ancien lien ne fonctionne plus. Les personnes déjà inscrites restent dans le voyage.',
  'invite.replace.confirm': 'Remplacer le lien',
  'invite.replace.pending': 'Remplacement du lien',
  'invite.stale': 'Ce lien ne fonctionne plus. Remplacez-le.',
  'invite.creatorGone':
    'Ce lien ne fonctionne plus car son créateur n’est plus propriétaire. Remplacez-le.',
  'invite.archived':
    'Ce voyage est archivé. Le lien fonctionnera à nouveau lorsque le voyage sera restauré.',
  'invite.announce.created': 'Lien d’invitation créé',
  'invite.announce.roleEditor':
    'Les prochaines personnes auront le rôle d’éditeur',
  'invite.announce.off': 'Lien d’invitation désactivé',
  'invite.announce.newLink': 'Nouveau lien prêt. Copiez-le et renvoyez-le.',
  'invite.announce.roleViewer':
    'Les prochaines personnes auront le rôle de lecteur',
  'invite.error.title': 'Le lien d’invitation n’a pas pu être chargé',
  'invite.error.retry': 'Réessayer',
  'invite.refusal.archived': 'Ce voyage est archivé.',
  'invite.refusal.notOwner':
    'Seul un propriétaire du voyage peut modifier le lien.',
  'invite.refusal.changed':
    'Quelqu’un a modifié le lien. Le lien actuel est affiché.',
  'invite.announce.recovered':
    'Les paramètres actuels du lien sont affichés. Vérifiez-les avant toute autre modification.',
} satisfies TranslationOf<typeof En>

export default messages
