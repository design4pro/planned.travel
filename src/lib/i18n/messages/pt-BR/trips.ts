/**
 * The trip tabs' own copy, in pt-BR.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` só para números compactos grandes.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Não foi possível carregar esta viagem',
  'error.plan': 'Não foi possível carregar o roteiro',
  'error.costs': 'Não foi possível carregar as despesas',
  'error.collab': 'Não foi possível carregar a conversa',
  'error.book': 'Não foi possível carregar as reservas',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Roteiro',
  'plan.places': 'Lugares',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Em conjunto',
  'collab.empty': 'Nada compartilhado ainda',
  'collab.conversation': 'Conversa',
  'collab.count.messages': {
    one: '{messages} mensagem',
    many: '{messages} mensagens',
    other: '{messages} mensagens',
  },
  'collab.count.notes': {
    one: '{notes} nota',
    many: '{notes} notas',
    other: '{notes} notas',
  },
  'collab.count.polls': {
    one: '{polls} enquete',
    many: '{polls} enquetes',
    other: '{polls} enquetes',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Reservas',
  'book.empty': 'Nada reservado ainda',
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
  'book.awaiting': 'Aguardando confirmação',
  'book.nothingHanging': 'Nada pendente',
  'book.chase': 'Cobre isso antes de viajar',
  'book.committed': 'Comprometido',
  'book.committedCaption': 'De todas as reservas desta viagem',
  'book.onItinerary': 'No roteiro',
  'book.pinnedCaption': 'Fixado a um dia do roteiro',
} satisfies TranslationOf<typeof En>

export default messages
