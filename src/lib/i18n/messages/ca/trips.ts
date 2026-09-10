/**
 * The trip tabs' own copy, in ca.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` només per a nombres compactes grans.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'No s’ha pogut carregar aquest viatge',
  'error.plan': 'No s’ha pogut carregar l’itinerari',
  'error.costs': 'No s’han pogut carregar les despeses',
  'error.collab': 'No s’ha pogut carregar la conversa',
  'error.book': 'No s’han pogut carregar les reserves',
  'error.transports': 'Els trajectes no s’han carregat',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerari',
  'plan.places': 'Llocs',
  'plan.day.empty': 'Res planificat: arrossega aquí un lloc o una nota',
  'plan.move.refused.duplicate': '{name} ja és en aquell dia',
  'plan.move.refused.duplicateBody': 'Un lloc només pot aparèixer un cop per dia. Mou-lo a un altre dia.',
  'plan.move.refused.notInIdeas': 'Una nota es queda dins del dia',
  'plan.move.refused.notInIdeasBody': 'Les idees són llocs que esperen un dia. Una nota pertany al dia per al qual es va escriure.',
  'plan.move.refused.notInAnotherDay': 'Una nota es queda al seu dia',
  'plan.move.refused.notInAnotherDayBody': 'Encara no es poden moure notes entre dies. Editeu la nota o escriviu-la a l’altre dia.',
  'plan.move.spoken.duplicate': '{name} no s’ha mogut. Aquell dia ja el té.',
  'plan.move.spoken.notInIdeas': '{name} no s’ha mogut. Una nota es queda dins del dia.',
  'plan.move.spoken.notInAnotherDay': '{name} no s’ha mogut. Una nota es queda al seu dia.',
  'plan.move.spoken.timed': '{name} porta l’hora {time}. Us preguntem si voleu deixar-la anar.',
  'plan.move.error.save': 'Aquest moviment no s’ha desat',
  'plan.move.error.retry': 'Torneu-ho a provar d’aquí a un moment.',
  'plan.move.dropTime.title': 'Voleu moure {name} i deixar anar les {time}?',
  'plan.move.dropTime.body': 'Aquesta posició contradiu l’hora que té. Moure’l aquí esborra l’hora: el nou ordre i l’hora esborrada es desen alhora.',
  'plan.move.dropTime.confirm': 'Mou-lo i esborra l’hora',
  'plan.move.dropTime.cancel': 'Deixa’l on és',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Afegeix una nota',
  'plan.note.addForDay': 'Afegeix una nota, {day}',
  'plan.note.showMore': 'Mostra’n més',
  'plan.note.showLess': 'Mostra’n menys',
  'plan.note.moveUp': 'Mou amunt',
  'plan.note.moveDown': 'Mou avall',
  'plan.note.drag': 'Reordena la nota',
  'plan.note.edit': 'Edita la nota',
  'plan.note.delete': 'Suprimeix la nota',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Afegeix una nota',
  'plan.note.dialog.editTitle': 'Edita la nota',
  'plan.note.field.body': 'Nota',
  'plan.note.field.bodyHint': 'Una línia. És el que mostra el dia.',
  'plan.note.field.detail': 'Detalls',
  'plan.note.field.detailHint':
    'Títols, llistes, enllaços, cites, codi i taules.',
  'plan.note.field.time': 'Hora',
  'plan.note.field.timeHint': 'Opcional, en format de 24 hores.',
  'plan.note.field.icon': 'Icona',
  'plan.note.tab.write': 'Escriu',
  'plan.note.tab.preview': 'Previsualització',
  'plan.note.previewEmpty': 'Encara no hi ha res per previsualitzar',
  'plan.note.save': 'Desa la nota',
  'plan.note.cancel': 'Cancel·la',
  'plan.note.confirmDelete': 'Voleu suprimir aquesta nota?',
  'plan.note.confirmDeleteBody':
    'La nota i els seus detalls desapareixen d’aquest dia.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Nota afegida',
  'plan.note.toast.updated': 'Nota desada',
  'plan.note.toast.deleted': 'Nota suprimida',
  'plan.note.error.save': 'La nota no s’ha desat',
  'plan.note.error.delete': 'La nota no s’ha suprimit',
  'plan.note.error.retry': 'Torneu-ho a provar d’aquí a un moment.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Recordatori',
  'plan.note.icon.clock': 'Hora',
  'plan.note.icon.flashlight': 'Llanterna',
  'plan.note.icon.footprints': 'Caminada',
  'plan.note.icon.info': 'Informació',
  'plan.note.icon.luggage': 'Equipatge',
  'plan.note.icon.package': 'Paquet',
  'plan.note.icon.ticket': 'Entrades',
  'plan.note.icon.trainFront': 'Tren',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Nota',
  'plan.note.icon.utensils': 'Menjar',
  'plan.note.icon.bus': 'Transport públic',
  'plan.note.icon.bedDouble': 'Allotjament',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Lloc',
  'plan.note.icon.wallet': 'Diners',
  'plan.note.icon.umbrella': 'Pluja',
  'plan.note.icon.triangleAlert': 'Avís',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Plegats',
  'collab.empty': 'Encara no s’ha compartit res',
  'collab.conversation': 'Conversa',
  'collab.count.messages': {
    one: '{messages} missatge',
    many: '{messages} missatges',
    other: '{messages} missatges',
  },
  'collab.count.notes': {
    one: '{notes} nota',
    many: '{notes} notes',
    other: '{notes} notes',
  },
  'collab.count.polls': {
    one: '{polls} enquesta',
    many: '{polls} enquestes',
    other: '{polls} enquestes',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Reserves',
  'book.empty': 'Encara no hi ha res reservat',
  'book.count.bookings': {
    one: '{bookings} reserva',
    many: '{bookings} reserves',
    other: '{bookings} reserves',
  },
  'book.count.confirmed': {
    one: '{confirmed} confirmada',
    many: '{confirmed} confirmades',
    other: '{confirmed} confirmades',
  },
  'book.progressLabel': {
    one: '{confirmed} de {total} reserva confirmada',
    many: '{confirmed} de {total} reserves confirmades',
    other: '{confirmed} de {total} reserves confirmades',
  },
  'book.ofTotal': 'de {total}',
  'book.confirmed': 'Confirmades',
  'book.awaiting': 'Pendent de confirmació',
  'book.nothingHanging': 'Res pendent',
  'book.chase': 'Reclama-les abans de volar',
  'book.committed': 'Compromès',
  'book.committedCaption': 'De totes les reserves d’aquest viatge',
  'book.onItinerary': 'A l’itinerari',
  'book.pinnedCaption': 'Fixat a un dia del pla',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Trajectes',
  'transports.empty': 'Encara no s’ha registrat res',
  'transports.count.transports': {
    one: '{transports} trajecte',
    many: '{transports} trajectes',
    other: '{transports} trajectes',
  },
  'transports.distance': 'Distància recorreguda',
  'transports.equator': '≈ {times}× la volta a l’equador',
  'transports.noGrouping': 'Encara no s’ha agrupat res',
  'transports.mostly': 'sobretot {mode}',
  'transports.confirmed': 'Confirmats',
  'transports.stillPending': {
    one: '{pending} encara pendent',
    many: '{pending} encara pendents',
    other: '{pending} encara pendents',
  },
  'transports.spent': 'Gastat en desplaçaments',
  'transports.noPrices': 'Cap preu registrat',
  'transports.priced': {
    one: 'en {priced} trajecte amb preu',
    many: 'en {priced} trajectes amb preu',
    other: 'en {priced} trajectes amb preu',
  },
} satisfies TranslationOf<typeof En>

export default messages
