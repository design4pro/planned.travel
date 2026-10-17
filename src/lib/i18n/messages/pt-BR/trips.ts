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
  'notFound.title': 'Não encontramos esta viagem',
  'notFound.body':
    'Ela não está entre as viagens que você pode abrir no espaço de trabalho atual. Pode ter sido excluída ou você pode não ter acesso a ela.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Adicionar um lugar a esta viagem',
  'plan.editor.editTitle': 'Editar este lugar',
  'plan.editor.createDescription':
    'Dê um nome agora e uma posição depois - um lugar não planejado fica no painel de lugares até ser atribuído a um dia.',
  'plan.editor.editDescription':
    'As alterações aplicam-se em todo o lado: mapa, dias atribuídos e lista de locais da viagem.',
  'plan.editor.nameRequired': 'O local precisa de um nome',
  'plan.editor.nameExample': 'por exemplo, Fushimi Inari Taisha',
  'plan.editor.city': 'Cidade',
  'plan.editor.cityExample': 'por exemplo, Quioto',
  'plan.editor.addressExample': 'por exemplo, 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Tempo no local',
  'plan.editor.rating': 'Vale a pena?',
  'plan.editor.latitude': 'Latitude geográfica',
  'plan.editor.longitude': 'Longitude geográfica',
  'plan.editor.positionHint': 'Ou feche e escolha o ponto no mapa.',
  'plan.editor.latitudeError': 'Entre -90 e 90',
  'plan.editor.longitudeError': 'Entre -180 e 180',
  'plan.editor.positionError': 'A posição precisa dos dois números',
  'plan.editor.day': 'Atribuir a um dia',
  'plan.editor.dayHint': 'Deixe vazio para manter no painel de lugares.',
  'plan.editor.unplanned': 'Deixar sem planejar',
  'plan.editor.dayNamed': 'Dia {day} · {title}',
  'plan.editor.stopFallback': 'Esta parada',
  'plan.editor.dayNumber': 'Dia {day}',
  'plan.editor.visited': 'Já visitado',
  'plan.editor.visitedHint': 'Marca o pin com um visto.',
  'plan.editor.saving': 'Salvando o lugar',
  'plan.editor.save': 'Salvar alterações',
  'plan.editor.noCategory': 'Sem categoria',
  'plan.editor.arrive': 'Chegada',
  'plan.editor.leave': 'Partida',
  'plan.editor.timeError': 'A partida deve ser depois da chegada',
  'plan.editor.booking': 'Reserva',
  'plan.editor.note': 'Nota para esta paragem',
  'plan.editor.noteExample': 'Vá cedo - depois das 9, a fila demora uma hora.',
  'plan.editor.savingTimes': 'Salvando os horários',
  'plan.editor.saveTimes': 'Salvar',
  'plan.editor.duration0': 'Sem duração fixa',
  'plan.editor.duration30': '30 minutos',
  'plan.editor.duration45': '45 minutos',
  'plan.editor.duration60': '1 hora',
  'plan.editor.duration90': '1½ horas',
  'plan.editor.duration120': '2 horas',
  'plan.editor.duration180': '3 horas',
  'plan.editor.duration240': 'Meio dia',
  'plan.editor.duration480': 'Um dia inteiro',
  'plan.editor.rating0': 'Sem avaliação',
  'plan.editor.rating1': '★ 1 - dispensar',
  'plan.editor.rating2': '★ 2 - se houver tempo',
  'plan.editor.rating3': '★ 3 - vale a pena',
  'plan.editor.rating4': '★ 4 - muito bom',
  'plan.editor.rating5': '★ 5 - a não perder',
  'plan.editor.bookingNone': 'Não é preciso reservar',
  'plan.editor.bookingPending': 'Por reservar',
  'plan.editor.bookingConfirmed': 'Reservado e confirmado',
  'plan.editor.bookingCompleted': 'Visita concluída',
  'plan.editor.bookingCancelled': 'Cancelado',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Não foi possível carregar esta viagem',
  'error.plan': 'Não foi possível carregar o roteiro',
  'error.costs': 'Não foi possível carregar as despesas',
  'error.collab': 'Não foi possível carregar a conversa',
  'error.book': 'Não foi possível carregar as reservas',
  'error.transports': 'Os deslocamentos não carregaram',
  'error.people': 'Não foi possível carregar as pessoas',
  'header.length': {
    one: '{days} dia',
    many: '{days} dias',
    other: '{days} dias',
  },
  'header.planned': {
    one: '{days} dia planejado',
    many: '{days} dias planejados',
    other: '{days} dias planejados',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Roteiro',
  'plan.places': 'Lugares',
  'plan.readOnly.archived':
    'Esta viagem está arquivada, então o plano é somente leitura.',
  'plan.readOnly.role':
    'Você pode ver este plano. Só o proprietário da viagem e quem pode editar podem alterá-lo.',
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
  'plan.addPlace.label': 'Adicionar um lugar',
  'plan.addPlace.more': 'Mais formas de adicionar um lugar',
  'plan.addPlace.option.map': 'Colocar no mapa',
  'plan.addPlace.forDayNamed': 'Adicionar um lugar, {day}',
  'plan.addPlace.quota':
    'Você atingiu o limite de lugares do seu plano. Faça upgrade para adicionar mais.',
  'plan.addPlace.quotaAction': 'Ver planos',
  'plan.stay.checkIn': 'Entrada',
  'plan.stay.checkOut': 'Saída',
  'plan.day.addStay': 'Adicionar uma hospedagem, {day}',
  'plan.day.addStayShort': 'Adicionar uma hospedagem',
  'plan.handoff.stop': 'Abrir {place} no {service} (abre em uma nova guia)',
  'plan.handoff.day.directions': 'Rotas no {service}',
  'plan.handoff.day.directionsName':
    'Rotas no {service}: {day} (abre em uma nova guia)',
  'plan.handoff.day.directionsPartial':
    'Paradas: as primeiras {carried} de {total}',
  'plan.handoff.day.directionsPartialName':
    'Rotas no {service}: {day}, paradas: as primeiras {carried} de {total} (abre em uma nova guia)',
  'plan.handoff.day.point': 'Ver no {service}',
  'plan.handoff.day.pointName':
    'Ver no {service}: a única parada com localização de {day} (abre em uma nova guia)',
  'plan.drop.hint':
    'Clique com o botão direito no mapa, ou toque e segure, para adicionar um lugar exatamente ali.',
  'plan.drop.armed':
    'Clique no mapa onde ele fica, ou mova o mapa e pressione Enter para soltá-lo no centro.',
  'plan.drop.stop': 'Parar de colocar um novo alfinete',
  'plan.drop.pin': 'Novo lugar',
  'plan.drop.lookingUp': 'Procurando o endereço…',
  'plan.drop.error':
    'Não foi possível soltar o alfinete. Tente de novo em instantes.',
  'plan.place.pastedPosition': 'Lido como latitude {lat}, longitude {lng}',
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
  'plan.transport.drag': 'Reordenar, {journey}',
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
  'people.error.alreadyOnTrip': 'Essa pessoa já está nesta viagem',
  'people.guests.title': 'Viajando com você',
  'people.guests.description': 'Pessoas desta viagem que não têm conta',
  'people.guests.empty': 'Ninguém ainda',
  'people.guests.emptyHint':
    'Um convidado é alguém que viaja com você e não precisa de conta. Adicione pelo nome.',
  'people.guest.badge': 'Convidado',
  'people.guest.add.label': 'Nome',
  'people.guest.add.placeholder': 'Ana',
  'people.guest.add.action': 'Adicionar convidado',
  'people.guest.rename.action': 'Renomear {name}',
  'people.guest.rename.title': 'Renomear {name}',
  'people.guest.rename.confirm': 'Renomear',
  'people.guest.remove.action': 'Remover {name} desta viagem',
  'people.guest.remove.title': 'Remover {name} desta viagem?',
  'people.guest.remove.body': 'O convidado sai. Nada mais muda na viagem.',
  'people.guest.remove.confirm': 'Remover',
  'people.guest.merge.action': '{name} agora é…',
  'people.guest.merge.title': '{name} agora é uma das pessoas desta viagem',
  'people.guest.merge.body':
    'Tudo o que está atribuído a {name} passa para a pessoa escolhida, e o convidado sai. Não dá para desfazer.',
  'people.guest.merge.inherits':
    '{member} herda tudo o que foi atribuído a {name}.',
  'people.guest.merge.placeholder': 'Escolha alguém desta viagem',
  'people.guest.merge.confirm': 'Mesclar',
  'people.guest.merge.done': '{name} agora é {member}',
  'people.guest.merge.nothingMoved':
    'Nada tinha sido atribuído a essa pessoa ainda',
  'people.error.guestNameTaken':
    'Já existe um convidado chamado {name} nesta viagem',
  'people.error.guestLimit':
    'Uma viagem comporta no máximo {limit} convidados, porque uma lista maior dificulta a escolha de participantes e a leitura da divisão de gastos',
  'people.error.guestMergeTarget': 'Escolha alguém que já está nesta viagem',
  'plan.weather.badge.forecast':
    'Previsão: {condition}, máxima de {max}, mínima de {min}',
  'plan.weather.badge.forecastNoCondition':
    'Previsão: máxima de {max}, mínima de {min}',
  'plan.weather.badge.unavailable': 'Tempo indisponível para este dia',
  'plan.weather.badge.loading': 'Carregando o tempo',
  'plan.weather.badge.recorded': 'Registrado: máxima de {max}, mínima de {min}',
  'plan.weather.badge.recordedHigh': 'Registrado: máxima de {max}',
  'plan.weather.badge.recordedLow': 'Registrado: mínima de {min}',
  'plan.weather.badge.estimate':
    'Estimativa: máxima típica de {max}, mínima típica de {min}',
  'plan.weather.badge.estimateHigh': 'Estimativa: máxima típica de {max}',
  'plan.weather.badge.estimateLow': 'Estimativa: mínima típica de {min}',
  'plan.weather.badge.notYetRecorded': 'Ainda não registrado',
  'plan.weather.condition.clear': 'Céu limpo',
  'plan.weather.condition.fair': 'Tempo bom',
  'plan.weather.condition.partlyCloudy': 'Parcialmente nublado',
  'plan.weather.condition.cloudy': 'Nublado',
  'plan.weather.condition.fog': 'Neblina',
  'plan.weather.condition.rain': 'Chuva',
  'plan.weather.condition.heavyRain': 'Chuva forte',
  'plan.weather.condition.sleet': 'Chuva com neve',
  'plan.weather.condition.snow': 'Neve',
  'plan.weather.condition.thunder': 'Trovoada',
  'plan.weather.panel.title': 'Tempo em {date}',
  'plan.weather.panel.temperature': 'Máxima / mínima',
  'plan.weather.panel.precipitation': 'Precipitação',
  'plan.weather.panel.precipitationTypical': 'Precipitação diária típica',
  'plan.weather.panel.probability': '{percent} de chance',
  'plan.weather.panel.wind': 'Vento',
  'plan.weather.panel.sunrise': 'Nascer do sol',
  'plan.weather.panel.sunset': 'Pôr do sol',
  'plan.weather.panel.noSunrise': 'Sem nascer do sol',
  'plan.weather.panel.noSunset': 'Sem pôr do sol',
  'plan.weather.panel.slots': 'Ao longo do dia',
  'plan.weather.panel.slot.night': 'Madrugada',
  'plan.weather.panel.slot.morning': 'Manhã',
  'plan.weather.panel.slot.afternoon': 'Tarde',
  'plan.weather.panel.slot.evening': 'Noite',
  'plan.weather.panel.high': 'Máxima',
  'plan.weather.panel.low': 'Mínima',
  'plan.weather.panel.recordedNote': 'Valores medidos neste dia.',
  'plan.weather.panel.temperatureTypical': 'Máxima / mínima típicas',
  'plan.weather.panel.estimateNote':
    'Uma média de longo prazo para este mês, não uma previsão.',
  'plan.weather.attribution.metNorway':
    'Dados da previsão: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Dados: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Redimensionar itinerário',
  'plan.workspace.resizePlaces': 'Redimensionar lugares',
  'plan.workspace.toggleDay': 'Expandir ou recolher {day}',
  'plan.workspace.days': 'Dias',
  'plan.workspace.showPanel': 'Mostrar o painel {label}',
  'plan.workspace.hidePanel': 'Ocultar o painel {label}',
  'plan.workspace.narrowPanel': 'Estreitar {label}',
  'plan.workspace.widenPanel': 'Alargar {label}',
  'collab.sections.trigger': 'Escolher seções',
  'collab.sections.menuLabel': 'Mostrar para todos nesta viagem',
  'collab.sections.keepOne': 'Pelo menos uma seção deve ficar ativa.',
  'collab.sections.failed': 'A alteração não foi salva',
  'collab.sections.failedBody': 'O menu mostra o estado salvo atualmente.',
  'collab.sections.someHidden': 'Algumas seções estão ocultas nesta viagem.',
  'collab.sections.turnedOff':
    'Esta seção foi desativada para a viagem. Ela será fechada quando você enviar ou apagar o que está escrevendo.',
  'collab.sections.changed': 'As seções desta viagem mudaram.',
  'collab.sections.savedHidden':
    'Salvo. Esta seção está oculta para a viagem e será fechada agora.',
  'plan.place.error.save':
    'Não foi possível salvar o lugar. Tente de novo em instantes.',
  'plan.stop.error.saveTimes':
    'Não foi possível salvar os horários da parada. Tente de novo em instantes.',
  'plan.place.error.delete':
    'Não foi possível excluir o lugar. Tente de novo em instantes.',
  'plan.pin.error.move':
    'Não foi possível mover o marcador. Tente de novo em instantes.',
  'plan.place.toast.created': 'Lugar adicionado',
  'plan.place.toast.updated': 'Lugar atualizado',
  'plan.stop.toast.timesSaved': 'Horários da parada salvos',
  'plan.place.toast.deleted': 'Lugar excluído',
  'plan.pin.toast.moved': '{name} fixado',
} satisfies TranslationOf<typeof En>

export default messages
