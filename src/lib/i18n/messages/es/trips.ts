/**
 * The trip tabs' own copy, in es.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` solo para números compactos grandes.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'No se pudo cargar este viaje',
  'error.plan': 'No se pudo cargar el itinerario',
  'error.costs': 'No se pudieron cargar los gastos',
  'error.collab': 'No se pudo cargar la conversación',
  'error.book': 'No se pudieron cargar las reservas',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerario',
  'plan.places': 'Lugares',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'En común',
  'collab.empty': 'Todavía no se ha compartido nada',
  'collab.conversation': 'Conversación',
  'collab.count.messages': {
    one: '{messages} mensaje',
    many: '{messages} mensajes',
    other: '{messages} mensajes',
  },
  'collab.count.notes': {
    one: '{notes} nota',
    many: '{notes} notas',
    other: '{notes} notas',
  },
  'collab.count.polls': {
    one: '{polls} encuesta',
    many: '{polls} encuestas',
    other: '{polls} encuestas',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Reservas',
  'book.empty': 'Todavía no hay nada reservado',
  'book.count.bookings': {
    one: '{bookings} reserva',
    many: '{bookings} reservas',
    other: '{bookings} reservas',
  },
  'book.count.confirmed': {
    one: '{confirmed} confirmada',
    many: '{confirmed} confirmadas',
    other: '{confirmed} confirmadas',
  },
  'book.progressLabel': {
    one: '{confirmed} de {total} reserva confirmada',
    many: '{confirmed} de {total} reservas confirmadas',
    other: '{confirmed} de {total} reservas confirmadas',
  },
  'book.ofTotal': 'de {total}',
  'book.confirmed': 'Confirmadas',
  'book.awaiting': 'A la espera de confirmación',
  'book.nothingHanging': 'Nada pendiente',
  'book.chase': 'Reclámalas antes de volar',
  'book.committed': 'Comprometido',
  'book.committedCaption': 'De todas las reservas de este viaje',
  'book.onItinerary': 'En el itinerario',
  'book.pinnedCaption': 'Fijado a un día del plan',
} satisfies TranslationOf<typeof En>

export default messages
