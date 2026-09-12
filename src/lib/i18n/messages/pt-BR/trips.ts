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
  'error.people': 'Não foi possível carregar as pessoas',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Roteiro',
  'plan.places': 'Lugares',
  'plan.day.empty': 'Nada planejado — arraste um lugar ou uma nota para cá',
  'plan.move.refused.duplicate': '{name} já está nesse dia',
  'plan.move.refused.duplicateBody':
    'Um lugar só pode aparecer uma vez por dia. Mova-o para outro dia.',
  'plan.move.refused.notInIdeas': 'Uma nota fica no dia',
  'plan.move.refused.notInIdeasBody':
    'As ideias são lugares esperando por um dia. Uma nota pertence ao dia para o qual foi escrita.',
  'plan.move.refused.notInAnotherDay': 'Uma nota fica no dia dela',
  'plan.move.refused.notInAnotherDayBody':
    'Ainda não dá para mover notas entre dias. Edite a nota, ou escreva-a no outro dia.',
  'plan.move.refused.journeyNotInIdeas': 'Um deslocamento fica no dia',
  'plan.move.refused.journeyNotInIdeasBody':
    'As ideias são lugares esperando por um dia. Um deslocamento pertence ao dia em que acontece.',
  'plan.move.refused.journeyNotInAnotherDay':
    'Um deslocamento fica no dia dele',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'O dia de um deslocamento vem das datas dele. Mude-as na aba Deslocamentos.',
  'plan.move.refused.journeyTimed': '{name} parte às {time}',
  'plan.move.refused.journeyTimedBody':
    'Um horário de partida é do itinerário, não do plano. Coloque o deslocamento onde o relógio dele manda.',
  'plan.move.spoken.duplicate':
    '{name} não foi movido. Esse dia já tem esse lugar.',
  'plan.move.spoken.notInIdeas': '{name} não foi movido. Uma nota fica no dia.',
  'plan.move.spoken.notInAnotherDay':
    '{name} não foi movido. Uma nota fica no dia dela.',
  'plan.move.spoken.timed':
    '{name} tem o horário {time}. Perguntamos se deve ser removido.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} não foi movido. Um deslocamento fica no dia.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} não foi movido. Um deslocamento fica no dia dele.',
  'plan.move.spoken.journeyTimed': '{name} não foi movido. Parte às {time}.',
  'plan.move.error.save': 'Essa mudança de ordem não foi salva',
  'plan.move.error.retry': 'Tente de novo em instantes.',
  'plan.move.dropTime.title': 'Mover {name} e remover o horário {time}?',
  'plan.move.dropTime.body':
    'Esta posição contradiz o horário definido. Movê-lo para cá apaga o horário — a nova ordem e o horário apagado são salvos juntos.',
  'plan.move.dropTime.confirm': 'Mover e remover o horário',
  'plan.move.dropTime.cancel': 'Deixar onde está',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Adicionar uma nota',
  'plan.note.addForDay': 'Adicionar uma nota, {day}',
  'plan.note.showMore': 'Mostrar mais',
  'plan.note.showLess': 'Mostrar menos',
  'plan.note.moveUp': 'Mover para cima',
  'plan.note.moveDown': 'Mover para baixo',
  'plan.note.drag': 'Reordenar a nota',
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
  'plan.transport.phase.flight.departing': 'Decolagem',
  'plan.transport.phase.flight.travelling': 'Em voo',
  'plan.transport.phase.flight.arriving': 'Pouso',
  'plan.transport.phase.hire.departing': 'Retirada',
  'plan.transport.phase.hire.travelling': 'Alugado',
  'plan.transport.phase.hire.arriving': 'Devolução',
  'plan.transport.phase.journey.departing': 'Início',
  'plan.transport.phase.journey.travelling': 'A caminho',
  'plan.transport.phase.journey.arriving': 'Fim',
  'plan.transport.label': 'De {from} para {to}',
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
  'people.title': 'Pessoas',
  'people.description': 'Quem está nesta viagem e quem pode encontrá-la',
  'people.members.title': 'Nesta viagem',
  'people.members.empty':
    'Ninguém desta viagem está mais neste espaço de trabalho',
  'people.role.label': 'Função',
  'people.role.owner': 'Proprietário',
  'people.role.editor': 'Pode editar',
  'people.role.viewer': 'Pode ver',
  'people.you': 'Você',
  'people.owner.hint': 'Uma viagem sempre mantém pelo menos um proprietário',
  'people.remove.action': 'Remover {name} desta viagem',
  'people.remove.title': 'Remover {name} desta viagem?',
  'people.remove.body':
    'A pessoa perde o acesso ao roteiro na hora. O que ela adicionou continua na viagem.',
  'people.remove.confirm': 'Remover',
  'people.leave.action': 'Sair desta viagem',
  'people.leave.title': 'Sair desta viagem?',
  'people.leave.body':
    'Você perde o acesso ao roteiro até que alguém da viagem adicione você de volta.',
  'people.leave.confirm': 'Sair',
  'people.cancel': 'Cancelar',
  'people.invite.title': 'Adicionar alguém',
  'people.invite.placeholder': 'Busque as pessoas deste espaço de trabalho',
  'people.invite.action': 'Adicionar à viagem',
  'people.invite.role': 'Entra como',
  'people.invite.empty': 'Todo mundo deste espaço já está nesta viagem',
  'people.invite.emptyHint':
    'Primeiro alguém novo entra no espaço, em Configurações',
  'people.visibility.title': 'Quem pode encontrar esta viagem',
  'people.visibility.switch': 'Visível para todo o espaço de trabalho',
  'people.visibility.private':
    'Só as pessoas listadas aqui podem ver esta viagem',
  'people.visibility.organization':
    'Qualquer pessoa deste espaço pode abrir esta viagem',
  'people.visibility.public':
    'Esta viagem está compartilhada com um link público',
  'people.error.lastOwner':
    'Uma viagem mantém pelo menos um proprietário. Torne outra pessoa proprietária primeiro.',
  'people.error.notInWorkspace':
    'Essa pessoa não está neste espaço de trabalho',
} satisfies TranslationOf<typeof En>

export default messages
