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
} satisfies TranslationOf<typeof En>

export default messages
