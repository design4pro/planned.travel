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
  'error.transports': 'Os deslocamentos não carregaram',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Roteiro',
  'plan.places': 'Lugares',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Adicionar uma nota',
  'plan.note.addForDay': 'Adicionar uma nota, {day}',
  'plan.note.showMore': 'Mostrar mais',
  'plan.note.showLess': 'Mostrar menos',
  'plan.note.moveUp': 'Mover para cima',
  'plan.note.moveDown': 'Mover para baixo',
  'plan.note.edit': 'Editar a nota',
  'plan.note.delete': 'Excluir a nota',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Adicionar uma nota',
  'plan.note.dialog.editTitle': 'Editar a nota',
  'plan.note.field.body': 'Nota',
  'plan.note.field.bodyHint': 'Uma linha. É o que o dia mostra.',
  'plan.note.field.detail': 'Detalhes',
  'plan.note.field.detailHint':
    'Títulos, listas, links, citações, código e tabelas.',
  'plan.note.field.time': 'Horário',
  'plan.note.field.timeHint': 'Opcional, no formato de 24 horas.',
  'plan.note.field.icon': 'Ícone',
  'plan.note.tab.write': 'Escrever',
  'plan.note.tab.preview': 'Prévia',
  'plan.note.previewEmpty': 'Ainda não há nada para ver na prévia',
  'plan.note.save': 'Salvar a nota',
  'plan.note.cancel': 'Cancelar',
  'plan.note.confirmDelete': 'Excluir esta nota?',
  'plan.note.confirmDeleteBody': 'A nota e os detalhes dela somem deste dia.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Nota adicionada',
  'plan.note.toast.updated': 'Nota salva',
  'plan.note.toast.deleted': 'Nota excluída',
  'plan.note.error.save': 'A nota não foi salva',
  'plan.note.error.delete': 'A nota não foi excluída',
  'plan.note.error.move': 'Essa mudança de ordem não foi salva',
  'plan.note.error.retry': 'Tente de novo em instantes.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Lembrete',
  'plan.note.icon.clock': 'Horário',
  'plan.note.icon.flashlight': 'Lanterna',
  'plan.note.icon.footprints': 'Caminhada',
  'plan.note.icon.info': 'Informação',
  'plan.note.icon.luggage': 'Bagagem',
  'plan.note.icon.package': 'Pacote',
  'plan.note.icon.ticket': 'Ingressos',
  'plan.note.icon.trainFront': 'Trem',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Nota',
  'plan.note.icon.utensils': 'Comida',
  'plan.note.icon.bus': 'Transporte',
  'plan.note.icon.bedDouble': 'Hospedagem',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Lugar',
  'plan.note.icon.wallet': 'Dinheiro',
  'plan.note.icon.umbrella': 'Chuva',
  'plan.note.icon.triangleAlert': 'Aviso',
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
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Deslocamentos',
  'transports.empty': 'Nada registrado ainda',
  'transports.count.transports': {
    one: '{transports} deslocamento',
    many: '{transports} deslocamentos',
    other: '{transports} deslocamentos',
  },
  'transports.distance': 'Distância percorrida',
  'transports.equator': '≈ {times}× a volta ao equador',
  'transports.noGrouping': 'Nada agrupado ainda',
  'transports.mostly': 'principalmente {mode}',
  'transports.confirmed': 'Confirmados',
  'transports.stillPending': {
    one: '{pending} ainda pendente',
    many: '{pending} ainda pendentes',
    other: '{pending} ainda pendentes',
  },
  'transports.spent': 'Gasto com viagem',
  'transports.noPrices': 'Nenhum preço registrado',
  'transports.priced': {
    one: 'em {priced} deslocamento com preço',
    many: 'em {priced} deslocamentos com preço',
    other: 'em {priced} deslocamentos com preço',
  },
} satisfies TranslationOf<typeof En>

export default messages
