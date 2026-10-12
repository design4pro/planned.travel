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
    'Les idées sont des lieux en attente d’une journée. Une note appartient à la journée pour laquelle elle a été écrite.',
  'plan.move.refused.notInAnotherDay': 'Une note reste dans sa journée',
  'plan.move.refused.notInAnotherDayBody':
    'Les notes ne peuvent pas encore changer de journée. Modifiez la note, ou écrivez-la dans l’autre journée.',
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
  'plan.move.spoken.notInAnotherDay':
    '{name} n’a pas été déplacé. Une note reste dans sa journée.',
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
  /* ---------------------------------------------- the transports tab */
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
    'Prévisions : {condition}, max. {max}, min. {min}',
  'plan.weather.badge.forecastNoCondition':
    'Prévisions : max. {max}, min. {min}',
  'plan.weather.badge.unavailable': 'Météo indisponible pour ce jour',
  'plan.weather.badge.loading': 'Chargement de la météo',
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
  'plan.weather.attribution.metNorway':
    'Données de prévision : MET Norway, CC BY 4.0',
} satisfies TranslationOf<typeof En>

export default messages
