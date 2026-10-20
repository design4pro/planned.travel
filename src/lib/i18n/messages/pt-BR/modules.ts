/**
 * The trip modules' own copy, in pt-BR.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Não definido',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Conectando',
  'presence.connecting.body': 'Entrando na sala ao vivo desta viagem.',
  'presence.live.title': 'Ao vivo',
  'presence.live.body': 'Mensagens, notas e votos chegam aqui na hora.',
  'presence.reconnecting.title': 'Reconectando',
  'presence.reconnecting.body':
    'A conexão caiu. Tentando de novo: tudo o que você envia é salvo do mesmo jeito.',
  'presence.offline.title': 'Fora do ar',
  'presence.offline.body':
    'As atualizações ao vivo estão desligadas. Tudo continua salvando; recarregue ou tente de novo para se atualizar.',
  'presence.reconnect': 'Reconectar',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Todos os deslocamentos',
  'transports.empty.title': 'Ainda sem deslocamentos',
  'transports.empty.body':
    'Voos, trens, balsas e o trajeto do aeroporto moram aqui, com os códigos de reserva e números de assento à mão no dia — e cada conexão conferida contra a anterior.',
  'transports.empty.action': 'Adicionar o primeiro deslocamento',
  'transports.filtered.title': 'Nenhum deslocamento desse tipo',
  'transports.filtered.body':
    'Cada deslocamento desta viagem vai de um jeito diferente. Volte para “{label}” para ver todos.',
  'transports.filtered.action': 'Mostrar todos os deslocamentos',
  'transports.alert.impossible.title': {
    one: 'Uma conexão é impossível',
    many: '{value} conexões são impossíveis',
    other: '{value} conexões são impossíveis',
  },
  'transports.alert.impossible.body':
    'Um deslocamento parte antes de o anterior chegar. Os nós abaixo dizem quais e por quanto.',
  'transports.alert.tight.title': {
    one: 'Uma conexão está apertada',
    many: '{value} conexões estão apertadas',
    other: '{value} conexões estão apertadas',
  },
  'transports.alert.tight.body':
    'Há tempo, mas pouco para o meio que você vai pegar. Os nós abaixo mostram quanto cada um deixa.',
  'transports.badge.impossible': {
    one: '{value} conexão quebrada',
    many: '{value} conexões quebradas',
    other: '{value} conexões quebradas',
  },
  'transports.badge.tight': {
    one: '{value} conexão apertada',
    many: '{value} conexões apertadas',
    other: '{value} conexões apertadas',
  },
  'transports.badge.ok': 'Todas as conexões funcionam',
  'transports.remove.body':
    'O deslocamento sai desta viagem de vez, junto com a referência da reserva e o assento. Se ele só foi cancelado, mude o status para Cancelado em vez disso.',
  'transports.remove.confirm': 'Remover o deslocamento',
  'transports.menu.edit': 'Editar o deslocamento…',
  'transports.field.service': 'Serviço',
  'transports.field.bookingRef': 'Referência da reserva',
  'transports.field.seat': 'Assento',
  'transports.field.distance': 'Distância',
  'transports.noTime': 'Ainda sem horário',
  'transports.toast.statusFailed.title': 'O status não mudou',
  'transports.toast.statusFailed.body':
    'O deslocamento continua no estado anterior.',
  'transports.toast.removed': 'Deslocamento removido',
  'transports.toast.removeFailed': 'O deslocamento não foi removido',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Adicionar um deslocamento',
  'transports.dialog.editTitle': 'Editar este deslocamento',
  'transports.dialog.description':
    'Voos, trens, balsas e o trajeto do aeroporto. Os horários são os locais impressos no bilhete.',
  'transports.form.modeLegend': 'Como você vai',
  'transports.form.timingError': 'Confira os horários',
  'transports.field.namePlaceholder': 'LATAM de GRU a HND',
  'transports.field.place': 'Local',
  'transports.field.code': 'Código',
  'transports.field.date': 'Data',
  'transports.field.time': 'Partida a partir de',
  'transports.field.departurePlaceholder': 'São Paulo Guarulhos',
  'transports.field.arrivalPlaceholder': 'Tóquio Haneda',
  'transports.field.carrier': 'Companhia',
  'transports.field.serviceNumber': 'Número do serviço',
  'transports.field.bookingRefHint':
    'O código que você vai informar no balcão.',
  'transports.field.notesPlaceholder':
    'Pedido assento no corredor. Bagagem despachada até Quioto.',
  'transports.action.add': 'Adicionar o deslocamento',
  'transports.action.save': 'Salvar o deslocamento',
  'transports.action.saving': 'Salvando o deslocamento',
  'transports.toast.added': 'Deslocamento adicionado',
  'transports.toast.addedBody': 'Já está na ordem da viagem.',
  'transports.toast.addFailed': 'O deslocamento não foi adicionado',
  'transports.toast.updated': 'Deslocamento atualizado',
  'transports.toast.updateFailed': 'O deslocamento não foi atualizado',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Nome',
  'field.time': 'Hora',
  'field.price': 'Preço',
  'field.notes': 'Notas',
  'field.status': 'Situação',
  'form.saveError': 'Isso não foi salvo',
  'action.cancel': 'Cancelar',
  'action.showCode': 'Mostrar {label}',
  'book.status.none': 'Sem situação',
  'book.status.pending': 'Pendente',
  'book.status.confirmed': 'Confirmada',
  'book.status.completed': 'Concluída',
  'book.status.cancelled': 'Cancelada',
  'book.toast.statusFailed': 'A situação não mudou',
  'book.toast.statusFailedBody': 'A reserva continua no estado anterior.',
  'book.toast.removed': 'Reserva removida',
  'book.toast.removeFailed': 'A reserva não foi removida',
  'book.empty.title': 'Nada reservado ainda',
  'book.empty.body':
    'Hospedagens, mesas, passeios e ingressos ficam aqui — com o número de confirmação onde você vai achar na porta, e a data que os coloca na linha do tempo.',
  'book.empty.action': 'Adicionar a primeira reserva',
  'book.filtered.title': 'Ainda nada desse tipo',
  'book.filtered.body':
    'Não há nada reservado dos tipos que você escolheu. Limpe o filtro para ver o resto do balcão.',
  'book.filtered.action': 'Limpar filtro',
  'book.panel.outstanding': 'Ainda a resolver',
  'book.panel.outstandingEmpty': 'Nada pendente — tudo aqui está resolvido.',
  'book.panel.settled': 'Resolvido',
  'book.panel.settledEmpty':
    'Nada resolvido ainda — está tudo por correr atrás.',
  'book.import.badge': 'Importação não conferida',
  'book.import.hint':
    'Importado de uma confirmação. Abra e salve para marcá-lo como conferido.',
  'book.import.action': 'Importar',
  'book.import.title': 'Importar reservas de um arquivo',
  'book.import.description':
    'Solte uma confirmação e nós a leremos. Nada entra na viagem antes de você ver.',
  'book.import.drop.idle': 'Solte os arquivos aqui, ou procure',
  'book.import.drop.active': 'Solte para adicionar',
  'book.import.drop.formats':
    'PDF, e-mail salvo, página web, foto, Word, Excel, arquivo de calendário ou exportação JSON.',
  'book.import.drop.limits':
    'Até {files} arquivos por vez, cada um até {size}.',
  'book.import.drop.browse': 'Procurar arquivos',
  'book.import.refused.format':
    '“{filename}” não é um arquivo que esta importação saiba ler. Ela lê um PDF, um e-mail salvo, uma página web, uma foto, um documento do Word ou do Excel, um arquivo de calendário ou uma exportação JSON.',
  'book.import.refused.tooMany':
    'Só {files} arquivos por vez. O resto não entrou.',
  'book.import.refused.tooLarge':
    '“{filename}” tem {size}. Uma importação lê arquivos de até {limit}.',
  'book.import.refused.empty':
    '“{filename}” está vazio, então não há nada para ler.',
  'book.import.ceiling.title':
    'Este espaço já leu todas as confirmações deste mês',
  'book.import.ceiling.body':
    'O plano inclui {ceiling} leituras de arquivo por mês, e a cota renova no dia primeiro. Você ainda pode adicionar uma reserva à mão.',
  'book.import.ceiling.none':
    'Ler um arquivo de confirmação não faz parte do plano deste espaço',
  'book.import.ceiling.noneBody':
    'Mude de plano para ter uma confirmação lida para você. Adicionar uma reserva à mão está sempre disponível.',
  'book.import.widget.title': 'Lendo confirmações',
  'book.import.widget.working': '{done} de {total} lidos',
  'book.import.widget.file': 'Lendo “{filename}”',
  'book.import.widget.done': {
    one: 'Uma reserva pronta para conferir',
    many: '{count} reservas prontas para conferir',
    other: '{count} reservas prontas para conferir',
  },
  'book.import.widget.review': 'Conferir',
  'book.import.widget.failed': '“{filename}” não pôde ser lido',
  'book.import.widget.stalled': 'Isto está levando mais do que o previsto',
  'book.import.widget.check': 'Olhar de novo',
  'book.import.widget.dismiss': 'Dispensar',
  'book.import.review.title': 'O que lemos',
  'book.import.review.from': 'De “{filename}”',
  'book.import.review.selectAll': 'Selecionar tudo',
  'book.import.review.selectNone': 'Não selecionar nada',
  'book.import.review.confirm': {
    one: 'Adicionar {count} reserva',
    many: 'Adicionar {count} reservas',
    other: 'Adicionar {count} reservas',
  },
  'book.import.review.confirmNone': 'Selecione uma reserva para adicionar',
  'book.import.review.cancel': 'Cancelar',
  'book.import.review.needsReview': 'Vale olhar',
  'book.import.review.needsReviewHint':
    'Alguns campos não estavam no documento. Abra a reserva depois de adicioná-la.',
  'book.import.review.noPrice': 'Nenhum preço lido',
  'book.import.review.noPriceHint':
    'O documento não dizia nenhum com clareza, então ficou vazio em vez de adivinhado.',
  'book.import.review.untitled': 'Reserva sem título',
  'book.import.empty.title': 'Não encontramos nenhuma reserva nesse arquivo',
  'book.import.empty.body':
    '“{filename}” não tinha nada que pareça uma confirmação. Tente outro arquivo, ou adicione a reserva à mão.',
  'book.import.failed.title': '“{filename}” não pôde ser lido',
  'book.import.failed.body':
    'O arquivo abriu, mas não deu para tirar nada dele. Tente outro arquivo, ou adicione a reserva à mão.',
  'book.import.failed.retry': 'Tentar outro arquivo',
  'book.import.uploadFailed': '“{filename}” não subiu',
  'book.import.uploadRetry': 'Tentar de novo',
  'book.import.actionFailed': 'Tente de novo daqui a pouco.',
  'book.import.toast.added': {
    one: 'Uma reserva adicionada',
    many: '{count} reservas adicionadas',
    other: '{count} reservas adicionadas',
  },
  'book.import.partial.title':
    '{written} de {total} reservas foram adicionadas',
  'book.import.partial.body':
    'O resto continua selecionado. Adicionar de novo grava só essas.',
  'book.import.partial.retry': 'Adicionar o resto',
  'book.journeyLink': 'Na aba de transportes',
  'filter.all': 'Tudo',
  'book.remove.body':
    'Ela sai da linha do tempo de vez. Se só foi cancelada, mude a situação para Cancelada para manter o registro.',
  'book.remove.confirm': 'Remover a reserva',
  'book.menu.edit': 'Editar a reserva…',
  'book.menu.open': 'Abrir a reserva',
  'book.noDate': 'Ainda sem data',
  'book.until': 'Até',
  'book.provider': 'Fornecedor',
  'book.where': 'Onde',
  'book.guests': 'Pessoas',
  'book.confirmation': 'Confirmação',
  'book.undated': 'Dê uma data a elas e entram na linha do tempo',
  statusOf: 'Situação de {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Ainda sem situação',
  'book.statusChoice.pending': 'Pendente — esperando por eles',
  'book.dialog.addTitle': 'Adicionar uma reserva',
  'book.dialog.editTitle': 'Editar esta reserva',
  'book.dialog.typeLegend': 'Que tipo de reserva',
  'book.field.namePlaceholder': 'Rua Augusta 1500',
  'book.field.priceHint': 'Deixe vazio se ainda não foi pago.',
  'book.field.confirmation': 'Número de confirmação',
  'book.field.confirmationHint': 'O código que vão pedir no balcão.',
  'book.field.day': 'Vincular a um dia',
  'book.field.dayHint': 'Fixa no roteiro para aparecer no plano.',
  'book.field.noDay': 'Fora do roteiro',
  'book.field.link': 'Link do site',
  'book.field.notesPlaceholder':
    'Check-in tardio combinado. Pedir quarto longe do elevador.',
  'book.action.add': 'Adicionar a reserva',
  'book.action.save': 'Salvar a reserva',
  'book.action.saving': 'Salvando a reserva',
  'book.toast.added': 'Reserva adicionada',
  'book.toast.addedBody': 'Já está na linha do tempo.',
  'book.toast.addFailed': 'A reserva não foi adicionada',
  'book.toast.updated': 'Reserva atualizada',
  'book.toast.updateFailed': 'A reserva não foi atualizada',

  'book.emptyFacts':
    'Além do nome ainda não há nada. Abra para adicionar o horário, o preço e o número de confirmação.',
  'book.onItinerary': 'No roteiro: {day}',
  'book.dayNumber': 'Dia {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Outro',
  'book.field.host': 'Hotel ou anfitrião',
  'book.field.restaurant': 'Nome do restaurante',
  'book.field.operator': 'Operadora',
  'book.field.issuer': 'Emitido por',
  'book.field.carrier': 'Transportadora',
  'book.field.address': 'Endereço',
  'book.field.meetingPoint': 'Ponto de encontro',
  'book.field.venue': 'Local do evento',
  'book.field.fromTo': 'De e para',
  'book.field.checkIn': 'Entrada',
  'book.field.date': 'Data',
  'book.field.validOn': 'Válido em',
  'book.field.departs': 'Parte',
  'book.field.checkOut': 'Saída',
  'book.field.ends': 'Termina',
  'book.field.arrives': 'Chega',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Museu Ghibli',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Quem está guardando isso para você',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 quartos twin',
  'book.example.restaurantTitle': 'Jantar no Den',
  'book.example.activityTitle': 'teamLab Planets, 4 ingressos',
  'book.example.tourTitle': 'Caminhada no bambuzal de Arashiyama',
  'book.example.ticketTitle': 'Museu Ghibli, entrada às 10:00',
  'book.example.transportTitle': 'Nozomi 21 para Quioto',
  'book.example.otherTitle': 'O que você reservou',
  'book.hint.accommodation':
    'Um hotel, um ryokan, um apartamento — onde você dormir.',
  'book.hint.restaurant':
    'Uma mesa reservada. O horário é o que vão cobrar de você.',
  'book.hint.activity':
    'Uma aula, uma casa de banhos, uma experiência reservada.',
  'book.hint.tour': 'Um lugar, uma hora e um guia esperando.',
  'book.hint.ticket':
    'Uma entrada com horário, um passe de museu, um jogo. Deixe o código à mão.',
  'book.hint.transport':
    'Um assento reservado. Deslocamentos completos com códigos ficam em {module}.',
  'book.hint.other': 'Qualquer coisa no seu nome que não caiba nas outras.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Bagagem',
  'lists.kind.todo': 'A fazer',
  'lists.kind.shopping': 'Compras',
  'lists.kind.documents': 'Documentos',
  'lists.kind.fallback': 'Lista',
  'colour.none': 'Sem cor',
  'colour.pine': 'Pinho',
  'colour.inkBlue': 'Azul tinta',
  'colour.amber': 'Âmbar',
  'colour.green': 'Verde',
  'colour.red': 'Vermelho',
  'colour.slate': 'Ardósia',
  'lists.toast.created': 'Lista criada',
  'lists.toast.createdBody':
    'Adicione a primeira coisa que você não pode esquecer.',
  'lists.toast.createFailed': 'A lista não foi criada',
  'lists.toast.updated': 'Lista atualizada',
  'lists.toast.updateFailed': 'A lista não foi atualizada',
  'lists.error.weightLimit': 'Um limite de peso é um número inteiro de gramas.',
  'lists.dialog.editTitle': 'Editar esta lista',
  'lists.dialog.editBody':
    'Renomeie, mude o tipo de lista ou passe para um único viajante.',
  'lists.dialog.addBody':
    'Bagagem, tarefas, compras e os documentos que você não pode esquecer: cada um com sua própria lista.',
  'lists.action.new': 'Nova lista',
  'lists.field.namePlaceholder': 'Bagagem de mão',
  'lists.field.kind': 'Tipo',
  'lists.field.kindAria': 'Tipo de lista',
  'lists.field.owner': 'Pertence a',
  'lists.field.ownerHint': 'As listas compartilhadas qualquer um marca.',
  'lists.field.everyone': 'Todos na viagem',
  'lists.field.weightLimit': 'Limite de peso',
  'lists.field.weightLimitHint':
    'Gramas. Deixe vazio se não houver limite a respeitar.',
  'colour.legend': 'Cor',
  'lists.action.saving': 'Salvando a lista',
  'lists.action.save': 'Salvar a lista',
  'lists.action.create': 'Criar a lista',
  'lists.item.toast.added': 'Item adicionado',
  'lists.item.toast.addFailed': 'O item não foi adicionado',
  'lists.item.toast.updated': 'Item atualizado',
  'lists.item.toast.updateFailed': 'O item não foi atualizado',
  'lists.item.error.quantity': 'Uma quantidade é um número inteiro de 1 a 999.',
  'lists.item.error.weight': 'Um peso é um número inteiro de gramas.',
  'lists.item.dialog.editTitle': 'Editar este item',
  'lists.item.dialog.addTitle': 'Adicionar um item',
  'lists.item.field.label': 'Item da lista',
  'lists.item.field.placeholder': 'Passaporte',
  'field.category': 'Categoria',
  'lists.item.field.categoryHint': 'Agrupa a lista sob um título. Opcional.',
  'lists.item.field.categoryPlaceholder': 'Documentos',
  'lists.item.field.priority': 'Prioridade',
  'lists.priorityChoice.high': 'Alta — não esqueça',
  'lists.priorityChoice.low': 'Baixa — se sobrar espaço',
  'lists.priorityChoice.normal': 'Média',
  'lists.item.field.quantity': 'Quantidade',
  'lists.item.field.weight': 'Peso',
  'lists.item.field.weightHint': 'Gramas, por unidade.',
  'lists.item.field.owner': 'De quem é essa tarefa',
  'lists.item.owner.nobody': 'Ninguém em especial',
  'lists.item.action.saving': 'Salvando o item',
  'lists.item.action.save': 'Salvar o item',
  'lists.item.action.add': 'Adicionar à lista',
  'lists.template.loadError': 'Não foi possível carregar os modelos agora.',
  'lists.template.toast.added': 'Lista adicionada de um modelo',
  'lists.template.toast.addFailed': 'O modelo não foi aplicado',
  'lists.template.error.apply': 'Isso não pôde ser aplicado',
  'lists.template.error.load': 'Os modelos não carregaram',
  'lists.template.empty.title': 'Ainda não há modelos',
  'lists.template.empty.body':
    'Salve uma lista como modelo quando tiver uma que você montaria de novo igual, e ela vai aparecer aqui em toda viagem futura.',
  'lists.template.applying': 'Aplicando o modelo',
  'lists.template.dialogTitle': 'Começar de um modelo',
  'lists.template.loading': 'Carregando modelos',
  'lists.template.apply': 'Aplicar o modelo',
  'lists.template.from': 'De um modelo',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Sem responsável',
  'lists.toast.listRemoved': 'Lista removida',
  'lists.toast.listRemoveFailed': 'A lista não foi removida',
  'lists.toast.itemRemoved': 'Item removido',
  'lists.toast.itemRemoveFailed': 'O item não foi removido',
  'lists.toast.reset': 'Lista zerada',
  'lists.toast.resetBody':
    'Tudo está desmarcado e pronto para a próxima viagem.',
  'lists.toast.resetFailed': 'A lista não foi zerada',
  'lists.toast.tickFailed': 'A marcação não foi salva',
  'lists.toast.tickFailedBody': 'O item voltou ao que era.',
  'lists.toast.assignFailed': 'A atribuição não foi salva',
  'lists.toast.orderFailed': 'A nova ordem não foi salva',
  'lists.toast.orderFailedBody': 'A lista voltou ao que era.',
  'lists.filter.todo': 'Ainda a fazer',
  'lists.filter.done': 'Feito',
  'lists.scope.all': 'Todas as listas',
  'lists.scope.shared': 'Compartilhadas',
  'lists.scope.mine': 'Minhas',
  'lists.empty.mine.title': 'Você ainda não tem listas próprias',
  'lists.empty.shared.title': 'Ainda não há listas compartilhadas',
  'lists.empty.mine.body':
    'Uma lista sua só você marca: útil para o que mais ninguém precisa ver.',
  'lists.empty.shared.body':
    'Uma lista compartilhada qualquer um marca, assim duas pessoas não levam o mesmo adaptador.',
  'lists.remove.list': 'Remover a lista',
  'lists.remove.item': 'Remover o item',
  'lists.remove.itemBody': 'Ele sai desta lista. Nada mais muda.',
  'lists.menu.editList': 'Editar a lista…',
  'lists.menu.tickAll': 'Marcar tudo',
  'lists.menu.untickAll': 'Desmarcar tudo',
  'lists.menu.reset': 'Zerar para a próxima viagem',
  'lists.menu.dragOrderLong': 'Mudar para uma ordem que você pode arrastar',
  'lists.menu.groupAgain': 'Agrupar por categoria de novo',
  'lists.menu.dragOrder': 'Mudar para uma ordem arrastável',
  'lists.menu.groupByCategory': 'Agrupar por categoria',
  'lists.weight.packed': '{weight} na mala',
  'lists.weight.packedOver': '{weight} na mala — acima do limite',
  'lists.weight.packedOf': '{weight} na mala de {limit} permitidos',
  'lists.weight.packedOfOver':
    '{weight} na mala de {limit} permitidos — acima do limite',
  'lists.progress.ticked': '{done} de {total} marcados',
  'lists.items.empty.title': 'Esta lista está vazia',
  'lists.items.empty.body':
    'Adicione a primeira coisa que você não pode esquecer: o campo abaixo é o caminho mais rápido.',
  'lists.items.doneEmpty.title': 'Ainda nada marcado',
  'lists.items.doneEmpty.body': 'Marque alguma coisa e ela aparece aqui.',
  'lists.items.todoEmpty.title': 'Aqui já está tudo feito',
  'lists.items.todoEmpty.body':
    'Todos os itens desta lista estão marcados. Mude para “{label}” para vê-los.',
  'lists.category.other': 'Todo o resto',
  'lists.dnd.fallbackName': 'este item',
  'lists.dnd.picked': '{name} pego.',
  'lists.dnd.dropped': '{name} solto. A nova ordem está sendo salva.',
  'lists.dnd.cancelled': 'Cancelado. A ordem não mudou.',
  'lists.menu.editItem': 'Editar o item…',
  'lists.quickAdd.placeholder': 'Escreva um item e aperte Enter',
  'lists.quickAdd.aria': 'Adicionar um item a esta lista',
  'lists.quickAdd.detailsHint': 'Adicionar com peso, categoria ou responsável',
  'lists.quickAdd.detailsAria': 'Adicionar um item com todos os detalhes',
  'lists.show': 'Mostrar',
  'lists.priority.high': 'Alta',
  'lists.action.add': 'Adicionar',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} item',
    many: '{count} itens',
    other: '{count} itens',
  },
  'lists.template.copiedIn': {
    one: '{count} item copiado, pronto para marcar.',
    many: '{count} itens copiados, prontos para marcar.',
    other: '{count} itens copiados, prontos para marcar.',
  },
  'lists.remove.listBody': {
    one: 'A lista e o seu {count} item saem desta viagem. Os modelos salvos ficam intactos.',
    many: 'A lista e os seus {count} itens saem desta viagem. Os modelos salvos ficam intactos.',
    other:
      'A lista e os seus {count} itens saem desta viagem. Os modelos salvos ficam intactos.',
  },

  'lists.item.dialog.body':
    'Tudo além do nome é opcional: um peso torna o total da mala real, e uma categoria agrupa a lista.',
  'lists.template.dialogBody':
    'Um modelo é uma lista que você já salvou. Aplicar um copia ela como uma lista nova nesta viagem: o original fica intacto.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Remover “{name}”?',
  actionsFor: 'Ações para {name}',
  'lists.dnd.reorder': 'Reordenar {name}',
  'lists.action.untickItem': 'Desmarcar {name}',
  'lists.action.tickOffItem': 'Marcar {name}',
  'lists.item.assignAria': 'Atribuir {name} a alguém',
  'lists.item.reassignAria': '{item} é de {owner}: reatribuir',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Dê a esta reserva um nome que você reconheça numa lista.',
  'error.titleLong': 'Mantenha o nome com menos de 160 caracteres.',
  'book.error.required': 'Falta nesta reserva: {field}.',
  'book.error.timeNeedsDate': 'Um horário precisa do dia em que ele cai.',
  'book.error.endTimeNeedsDate':
    'Um horário de fim precisa do dia em que ele cai.',
  'book.error.endsBeforeStart': 'Isso termina antes de começar.',
  'book.fieldName.checkInDay': 'dia de entrada',
  'book.fieldName.checkOutDay': 'dia de saída',
  'book.stay.pickDay': 'Escolha um dia',
  'book.stay.nights': {
    one: '{count} noite',
    many: '{count} noites',
    other: '{count} noites',
  },
  'book.stay.range': 'de {from} a {to}',
  'book.stay.label': 'Estadia',
  'book.remove.keepsNights':
    'As noites ficam na viagem. Só a reserva é removida.',
  'book.menu.removeWithStay': 'Remover a reserva e a estadia',
  'book.removeStay.body': 'A reserva e as noites que ela paga são removidas.',
  'book.toast.stayRemoved': 'Reserva e estadia removidas',
  'book.error.endTimeBeforeStart': 'O horário de fim é antes do de início.',
  'book.error.guests': 'O número de pessoas precisa ser um inteiro até 1000.',
  'error.price': 'Esse valor não conseguimos ler.',
  'book.error.url': 'Um link precisa começar com http:// ou https://.',
  'book.error.confirmationLong':
    'Esse número de confirmação é comprido demais para guardar.',
  'book.error.stopGone': 'Essa parada não está mais nesta viagem.',
  'book.ledger.unlinked':
    'A linha de custo desta reserva continuará nos custos da viagem, mas não estará mais vinculada a ela.',
  'book.ledger.updated': 'A linha de custo desta reserva passará para {money}.',
  'book.ledger.needsDate':
    'Dê uma data a esta reserva e o custo dela entrará nos custos da viagem.',
  'book.ledger.added':
    'Uma linha de {money} será adicionada aos custos desta viagem.',
  'book.fieldName.provider': 'operadora',
  'book.fieldName.location': 'local',
  'book.fieldName.confirmationNumber': 'número de confirmação',
  'book.fieldName.link': 'endereço do site',
  'book.fieldName.date': 'data',
  'book.fieldName.time': 'horário',
  'book.fieldName.endDate': 'data de fim',
  'book.fieldName.endTime': 'horário de fim',
  'book.fieldName.guests': 'número de pessoas',
  'book.fieldName.price': 'preço',
  'book.fieldName.stop': 'parada',
  'book.field.stop': 'Parada vinculada',
  'book.field.stopHint': 'A qual parada do plano esta reserva se refere.',
  'book.field.stopHintEmpty':
    'Adicione primeiro um lugar a um dia e depois você poderá vincular esta reserva a ele',
  'book.field.stopPlaceholder': 'Sem parada',
  'book.field.stopSearch': 'Busque paradas e dias',
  'book.field.stopEmpty': 'Nenhuma parada corresponde',
  'book.ledger.refused.title': 'Salvo, mas não adicionado aos custos',
  'book.ledger.refused.body':
    'A reserva está na viagem. Adicionar a linha de custo aos custos da viagem não deu certo — tente essa metade de novo.',
  'book.action.ledgerRetry': 'Adicionar aos custos',
  'book.ledger.splitStale.title': 'Salvo, mas a divisão não bate mais',
  'book.ledger.splitStale.body':
    'A reserva e o novo preço foram salvos, mas a divisão deste custo não conseguiu acompanhar o novo total. Abra o item em Custos e corrija a divisão.',
  'book.action.done': 'Concluído',
  'book.copyConfirmation': 'o número de confirmação de {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Voo',
  'transports.mode.train': 'Trem',
  'transports.mode.bus': 'Ônibus',
  'transports.mode.ferry': 'Balsa',
  'transports.mode.car': 'Carro',
  'transports.mode.taxi': 'Táxi',
  'transports.mode.transit': 'Transporte',
  'transports.mode.metro': 'Metrô',
  'transports.mode.tram': 'Bonde',
  'transports.mode.bike': 'Bicicleta',
  'transports.mode.walk': 'A pé',
  'transports.mode.other': 'Outro',
  'transports.mode.fallback': 'Deslocamento',
  'transports.rank.earliest': 'Chegada mais cedo',
  'transports.rank.fewestChanges': 'Menos baldeações',
  'transports.connection.findStop': 'Busque uma parada',
  'transports.connection.findStopSearch': 'GRU, Luz, São Paulo…',
  'transports.connection.findStopEmpty':
    'Nenhuma parada com esse nome no catálogo.',
  'transports.connection.hideStops': 'Esconder as paradas',
  'transports.connection.seeStops': 'Ver as paradas',
  'transports.connection.saving': 'Salvando a conexão',
  'transports.connection.use': 'Usar esta',
  'transports.connection.onFoot': 'A pé',
  'transports.connection.service': 'Serviço',
  'transports.connection.direct': 'direto',
  'transports.connection.changes': {
    one: '{changes} baldeação',
    many: '{changes} baldeações',
    other: '{changes} baldeações',
  },
  'transports.connection.tooLong':
    'Esta conexão tem mais de {max} trechos, mais do que cabe num único registro de viagem. Busque um salto mais curto e anote o resto à parte.',
  'transports.connection.refusal.ceiling': 'Não restam buscas neste mês',
  'transports.connection.refusal.unconfigured':
    'A busca de conexões está desligada neste deployment',
  'transports.connection.refusal.provider':
    'O serviço de horários não respondeu',
  'transports.connection.refusal.plan':
    'A busca de conexões não faz parte deste plano',
  'transports.connection.refusal.planBody':
    'Mude de plano para consultar horários de dentro de uma viagem. Um trecho continua podendo ser anotado à mão.',
  'transports.connection.refusal.ceilingBody':
    'A cota mensal de {ceiling} acabou e renova no primeiro dia do mês que vem. Um trecho continua podendo ser anotado à mão.',
  'transports.connection.refusal.unconfiguredBody':
    'Nenhum serviço de horários está configurado aqui, então nada foi buscado. Anote o trecho à mão.',
  'transports.connection.refusal.providerBody':
    'Não voltou nada para mostrar. Tente de novo daqui a pouco ou anote o trecho à mão.',
  'transports.connection.invitation':
    'Duas paradas e uma data, e os horários respondem. Nada é salvo até você escolher uma.',
  'transports.connection.empty':
    'Nenhuma conexão foi encontrada entre essas duas paradas nessa data. Tente uma estação vizinha, ou amplie o filtro de modos.',
  'transports.connection.credit': 'Dados de horários de',
  'transports.connection.searchFailed': 'A busca não rodou',
  'transports.connection.searchFailedBody': 'Tente de novo daqui a pouco.',
  'transports.connection.saved': 'Conexão salva',
  'transports.connection.replaced': 'Rota substituída',
  'transports.connection.replacedBody':
    'O código da reserva e o assento ficam intactos.',
  'transports.connection.saveFailed': 'A conexão não foi salva',
  'transports.connection.saveError': 'Isso não foi salvo',
  'transports.connection.fromHint':
    'Escolha uma parada — a um horário se pergunta onde, não como se chama.',
  'transports.connection.toHint': 'Escolha uma parada do catálogo.',
  'transports.connection.timeHint':
    'Um horário responde com as próximas partidas, então isto decide quais.',
  'transports.connection.onlyModes': 'Só estes modos',
  'transports.connection.searching': 'Buscando nos horários',
  'transports.connection.search': 'Buscar conexões',
  'transports.connection.title': 'De {from} a {to}',
  'transports.status.idea': 'Ideia',
  'transports.status.pending': 'Pendente',
  'transports.status.confirmed': 'Confirmado',
  'transports.status.completed': 'Concluído',
  'transports.status.cancelled': 'Cancelado',
  'transports.end.fromAirport': 'Aeroporto de saída',
  'transports.end.toAirport': 'Aeroporto de chegada',
  'transports.end.fromPort': 'Porto de saída',
  'transports.end.toPort': 'Porto de chegada',
  'transports.end.fromStation': 'Estação de saída',
  'transports.end.toStation': 'Estação de chegada',
  'transports.end.from': 'De onde',
  'transports.end.to': 'Para onde',
  'transports.end.pickUp': 'Retirada',
  'transports.end.dropOff': 'Devolução',
  'transports.end.departureDay': 'Dia da partida',
  'transports.end.arrivalDay': 'Dia da chegada',
  'transports.end.pickUpDay': 'Dia da retirada',
  'transports.end.returnDay': 'Dia da devolução',
  'transports.dayNumber': 'Dia {n}',
  'transports.error.titleEmpty':
    'Dê a este deslocamento um nome que você reconheça numa lista.',
  'transports.error.date': 'Uma data se escreve AAAA-MM-DD.',
  'transports.error.time':
    'Um horário se escreve HH:MM no formato de 24 horas.',
  'transports.error.departureNeedsDate':
    'Um horário de partida precisa do dia em que ele cai.',
  'transports.error.arrivalNeedsDate':
    'Um horário de chegada precisa do dia em que ele cai.',
  'transports.error.code': 'Um código tem de 2 a 8 letras ou dígitos.',
  'transports.error.distance':
    'Uma distância é um número de quilômetros, até 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Este deslocamento chega antes de partir.',
  'transports.error.timingHint':
    'Mova um dos dois horários para o deslocamento poder ser pego de verdade.',
  'transports.error.arrivalDayBeforeDeparture':
    'O dia da chegada vem antes do dia da partida.',
  'transports.error.returnDayBeforePickUp':
    'O dia da devolução vem antes do dia da retirada.',
  'transports.field.noDay': 'Ainda sem dia',
  'transports.fill.legend': 'Como preencher isto',
  'transports.fill.manual': 'Digitar você mesmo',
  'transports.fill.searchAgain': 'Buscar de novo',
  'transports.fill.search': 'Buscar conexões',
  'transports.chain.unsplit': 'Voltar a ser uma viagem só',
  'transports.field.arrivalDayHint':
    'Uma viagem que chega na manhã seguinte diz isso aqui.',
  'transports.chain.splitHint':
    'Baldeação no caminho? Registre cada parte com o próprio número do serviço, plataforma, assento e horários.',
  'transports.chain.split': 'Dividir em trechos',
  'transports.chain.stopNumber': 'parada {n}',
  'transports.chain.change': 'Baldeação {n}',
  'transports.chain.removeStation': 'Remover {label}',
  'transports.chain.findStation': 'Busque um aeroporto ou estação',
  'transports.chain.findStationFor':
    'Busque um aeroporto ou estação para {label}',
  'transports.chain.findPlaceholder': 'GRU, Guarulhos, São Paulo…',
  'transports.chain.findEmpty':
    'Sem correspondência — digite a parada você mesmo abaixo.',
  'transports.chain.stopLabel': 'Parada',
  'transports.chain.stopPlaceholder': 'São Paulo Luz',
  'transports.chain.timezoneHint': 'Em que relógio esta parada corre',
  'transports.chain.timezoneAt': 'Fuso horário em {label}',
  'transports.chain.timezonePlaceholder': 'Não informado',
  'transports.chain.timezoneSearch': 'Tóquio, Lisboa, UTC…',
  'transports.chain.acrossClocks': '{gap} entre dois relógios',
  'transports.chain.addStopAfter': 'Adicionar parada depois de {label}',
  'transports.chain.servicePlaceholder': 'Serra Verde 8',
  'transports.chain.leaves': 'Sai de {label}',
  'transports.chain.reaches': 'Chega a {label}',
  'transports.chain.dayOfLeg': '{label} do trecho {n}',
  'transports.chain.formError': 'Esta cadeia não pode ser salva',
  'transports.chain.atCap':
    'Uma cadeia comporta no máximo {max} trechos — é um limite do que um salvamento carrega, não de quantas baldeações uma viagem pode ter.',
  'transports.chain.hint':
    'Adicione uma parada em qualquer trecho para registrar uma troca de trem; cada trecho guarda seu número, plataforma e assento.',
  'transports.field.timezone': 'Fuso horário',
  'transports.field.platform': 'Plataforma',
  'transports.chain.legNumber': 'Trecho {n}',
  'transports.chain.platform': 'Plataforma {value}',
  'transports.chain.seat': 'Assento {value}',
  'transports.chain.error.stopName':
    'Toda parada precisa de um nome — é aqui que você faz a baldeação.',
  'transports.chain.error.stopNameLong':
    'O nome de uma parada deve ter menos de 200 caracteres.',
  'transports.chain.error.timezone': 'Escolha um fuso horário na lista.',
  'transports.chain.error.tooManyLegs':
    'Uma cadeia comporta no máximo {max} trechos.',
  'transports.bookingRefFor': 'o código de reserva de {title}',
  'transports.doorToDoor': 'São {gap} de porta a porta.',
  'transports.title.fromTo': '{operator} de {from} para {to}',
  'transports.title.from': '{operator} saindo de {from}',
  'transports.title.to': '{operator} para {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Nenhum horário para comparar',
  'transports.junction.unknown.detail':
    'Coloque data e hora nos dois deslocamentos e esta conexão será checada para você.',
  'transports.junction.impossible.headline':
    'Sai {gap} antes de o deslocamento anterior chegar',
  'transports.junction.impossible.detail':
    '“{to}” sai antes de “{from}” chegar, então não dá para pegar os dois. Mova um deles.',
  'transports.junction.tight.headline': '{gap} para a conexão',
  'transports.junction.tight.detail':
    'Para {mode} normalmente se precisa de cerca de {required}. Aqui está apertado.',
  'transports.junction.tight.detailAt':
    'Para {mode} em {place} normalmente se precisa de cerca de {required}. Aqui está apertado.',
  'transports.junction.ok.headline': '{gap} de intervalo',
  'transports.junction.ok.detail':
    'Chega em {landing} mas o deslocamento seguinte sai de {boarding} — vai ser preciso atravessar.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Nota compartilhada',
  'collab.note.toast.sharedBody': 'Todos na viagem já veem.',
  'collab.note.toast.shareFailed': 'A nota não foi compartilhada',
  'collab.note.toast.updated': 'Nota atualizada',
  'collab.note.toast.updateFailed': 'A nota não foi atualizada',
  'collab.note.dialog.editTitle': 'Editar esta nota',
  'collab.note.dialog.addTitle': 'Nova nota compartilhada',
  'collab.note.dialog.body':
    'Restaurantes recomendados, regras de visto, o código do portão: tudo o que a viagem inteira precisa lembrar, num só lugar.',
  'collab.note.field.title': 'Título',
  'collab.note.field.titlePlaceholder': 'Código do portão',
  'collab.note.field.body': 'Nota',
  'collab.note.field.bodyPlaceholder':
    '4821 e depois a tecla jogo da velha. A caixa de chaves fica à esquerda da porta.',
  'collab.note.field.categoryHint': 'Agrupa o quadro sob um filtro. Opcional.',
  'collab.note.field.categoryPlaceholder': 'Logística',
  'collab.note.field.pin': 'Fixar no topo do quadro',
  'collab.note.field.pinHint':
    'As notas fixadas vêm primeiro, seja o que for adicionado.',
  'collab.note.action.saving': 'Salvando a nota',
  'collab.note.action.save': 'Salvar a nota',
  'collab.note.action.share': 'Compartilhar a nota',
  'collab.poll.toast.opened': 'Votação aberta',
  'collab.poll.toast.openedBody': 'Todos na viagem já podem votar.',
  'collab.poll.toast.openFailed': 'A votação não foi aberta',
  'collab.poll.dialog.addTitle': 'Nova votação',
  'collab.poll.field.question': 'Pergunta',
  'collab.poll.field.questionPlaceholder':
    'Onde a gente janta na última noite?',
  'collab.poll.field.optionsLegend': 'Opções de voto',
  'collab.poll.field.option': 'Resposta {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Outra resposta',
  'collab.poll.action.addOption': 'Adicionar uma resposta',
  'collab.poll.action.removeOption': 'Remover a resposta {n}',
  'collab.poll.field.multi': 'Deixar escolher mais de uma',
  'collab.poll.field.multiHint':
    'Desligado é um voto por pessoa, e mudar de ideia move o voto.',
  'collab.poll.action.opening': 'Abrindo a votação',
  'collab.poll.action.open': 'Abrir a votação',
  'collab.poll.error.tooFew':
    'Uma votação precisa de pelo menos duas coisas para escolher.',
  'collab.poll.error.duplicate':
    'Duas respostas dizem a mesma coisa. Dê a cada uma a sua redação.',
  'collab.presence.viewingNow': 'estão vendo agora',
  'collab.presence.unnamed': 'Membro sem nome',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} aba aberta',
    many: '{name} — {count} abas abertas',
    other: '{name} — {count} abas abertas',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Concordo',
  'collab.reaction.love': 'Adorei',
  'collab.reaction.funny': 'Engraçado',
  'collab.reaction.celebrate': 'Vamos comemorar',
  'collab.reaction.thanks': 'Obrigado',
  'collab.reaction.looking': 'Olhando',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, incluindo você',
  'collab.thread.today': 'Hoje',
  'collab.thread.emptyBody':
    'Todas as pessoas desta viagem compartilham uma conversa. As decisões tomadas aqui ficam com a viagem, em vez de se espalharem por conversas em grupo.',
  /** Invitation to write the first message of an empty conversation, not a command. */
  'collab.thread.empty': 'Comece a conversa',
  'collab.thread.loadOlder': 'Carregar mensagens anteriores',
  'collab.thread.loadingOlder': 'Carregando mensagens anteriores',
  'collab.thread.loadOlderFailed':
    'Não foi possível carregar as mensagens anteriores',
  'collab.thread.retry': 'Tentar novamente',
  'collab.thread.start': 'É aqui que a conversa começa',
  'collab.thread.loadedEarlier': {
    one: '{earlier} mensagem anterior carregada',
    many: '{earlier} mensagens anteriores carregadas',
    other: '{earlier} mensagens anteriores carregadas',
  },
  'collab.thread.newFrom': 'Nova mensagem de {name}',
  'collab.thread.newMany': {
    one: '{new} nova mensagem',
    many: '{new} novas mensagens',
    other: '{new} novas mensagens',
  },
  'collab.toast.reactionFailed': 'A reação não foi salva',
  'collab.toast.messageDeleted': 'Mensagem excluída',
  'collab.toast.deleteFailed': 'A mensagem não foi excluída',
  'collab.toast.notSent': 'Não enviada',
  'collab.toast.notSentBody':
    'A mensagem não pôde ser enviada. Tente daqui a pouco.',
  'collab.toast.messageUpdated': 'Mensagem atualizada',
  'collab.toast.editFailed': 'A alteração não foi salva',
  'collab.message.deleteTitle': 'Excluir esta mensagem?',
  'collab.message.deleteBody':
    'O texto sai do fio. As respostas continuam no lugar delas.',
  'collab.message.delete': 'Excluir a mensagem',
  'collab.message.reply': 'Responder',
  'collab.message.menuEdit': 'Editar a mensagem…',
  'collab.message.react': 'Reagir a esta mensagem',
  'collab.message.edited': 'editada',
  'collab.message.actionsFor': 'Ações para a mensagem de {name}',
  'collab.compose.editingYours': 'Você está editando sua mensagem',
  'collab.compose.replyingTo': 'Respondendo a {name}',
  'collab.compose.cancelReply': 'Cancelar a resposta',
  'collab.compose.cancelEdit': 'Cancelar a edição',
  'collab.compose.placeholder': 'Escreva para a viagem',
  'collab.compose.placeholderText': 'Diga algo para o grupo…',
  'collab.compose.editPlaceholder': 'Editar sua mensagem',
  'collab.compose.editPlaceholderText': 'Mude o que você disse…',
  'collab.compose.send': 'Enviar a mensagem',
  'collab.compose.savingEdit': 'Salvando a alteração',
  'collab.compose.save': 'Salvar',
  /** Textarea description for a fine pointer; input-method composition never sends. */
  'collab.compose.keysHint':
    'Pressione Enter para enviar, Shift e Enter para uma nova linha.',
  /** Added to the textarea description only while replying or editing. */
  'collab.compose.keysHintEsc': 'Pressione Escape para cancelar.',
  /** Textarea description on a coarse pointer; Enter adds a line. */
  'collab.compose.keysHintTouch':
    'Use o botão de envio para enviar a mensagem.',
  /** Button retries the failed send or edit using the text currently in the field. */
  'collab.compose.retry': 'Tentar novamente',
  /** Fixed failed-edit body, also used as the edit toast fallback; never server diagnostics. */
  'collab.toast.editFailedBody':
    'Suas alterações continuam na caixa de texto. Verifique a conexão e tente novamente.',
  'collab.hint.sends': 'envia',
  'collab.hint.addsLine': 'pula uma linha',
  'collab.hint.cancels': 'cancela',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Nota removida',
  'collab.toast.noteRemoveFailed': 'A nota não foi removida',
  'collab.notes.empty.title': 'Nenhuma nota compartilhada',
  'collab.notes.empty.body':
    'Restaurantes recomendados, regras de visto, o código do portão: tudo o que a viagem inteira precisa lembrar.',
  'collab.notes.empty.action': 'Escreva a primeira nota',
  'collab.note.menu.edit': 'Editar a nota…',
  'collab.note.menu.unpin': 'Desafixar',
  'collab.note.menu.pin': 'Fixar no topo',
  'collab.note.remove': 'Remover a nota',
  'collab.note.removeBody': 'A nota sai do quadro para todos na viagem.',
  'collab.note.new': 'Nota nova',
  'collab.poll.toast.voteFailed': 'Seu voto não foi salvo',
  'collab.poll.toast.voteFailedBody': 'A contagem continua a mesma.',
  'collab.poll.toast.closed': 'Votação encerrada',
  'collab.poll.toast.closeFailed': 'A votação não foi encerrada',
  'collab.poll.toast.removed': 'Votação removida',
  'collab.poll.toast.removeFailed': 'A votação não foi removida',
  'collab.polls.heading': 'Votações',
  'collab.polls.empty.title': 'Nenhuma votação aberta',
  'collab.polls.empty.body':
    'Quando o grupo não chega a um acordo sobre restaurante, leve à votação e deixe a resposta se resolver sozinha.',
  'collab.polls.empty.action': 'Pergunte ao grupo',
  'collab.poll.menu.close': 'Encerrar a votação',
  'collab.poll.remove': 'Remover a votação',
  'collab.poll.removeTitle': 'Remover esta votação?',
  'collab.poll.actionsFor': 'Ações para a votação “{question}”',
  'collab.badge.pinned': 'Fixada',
  'collab.badge.closed': 'Encerrada',
  'collab.badge.open': 'Aberta',
  'collab.badge.multi': 'Escolha múltipla',
  'collab.badge.leading': 'Na frente',
  'collab.poll.removeBody': {
    one: '“{question}” e o seu {count} voto saem para todos.',
    many: '“{question}” e os seus {count} votos saem para todos.',
    other: '“{question}” e os seus {count} votos saem para todos.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} de {count} voto',
    many: '{label} — {votes} de {count} votos',
    other: '{label} — {votes} de {count} votos',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} de {count} voto, incluindo o seu',
    many: '{label} — {votes} de {count} votos, incluindo o seu',
    other: '{label} — {votes} de {count} votos, incluindo o seu',
  },
  'collab.poll.voteCount': {
    one: '{count} voto',
    many: '{count} votos',
    other: '{count} votos',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Documento',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Ingresso',
  'files.kind.receipt': 'Recibo',
  'files.kind.map': 'Mapa',
  'files.kind.other': 'Outro',
  'files.kindChoice.ticket': 'Ingresso ou passe',
  'files.kindChoice.map': 'Mapa ou rota',
  'files.toast.removed': 'Arquivo removido',
  'files.toast.removeFailed': 'O arquivo não foi removido',
  'files.toast.downloadFailed': 'O download não começou',
  'files.toast.gone': 'O arquivo não está mais disponível nesta aba.',
  'files.toast.uploadFailed': 'O envio falhou. Tente de novo.',
  'files.toast.updated': 'Arquivo atualizado',
  'files.toast.updateFailed': 'O arquivo não foi atualizado',
  'files.storage.full': 'Este espaço ficou sem armazenamento',
  'files.storage.used':
    'Usados {used} de {limit}. Remova um arquivo abaixo, ou suba de plano, antes de adicionar mais alguma coisa.',
  'files.storage.perFile': 'até {size} cada',
  'files.action.add': 'Adicionar arquivos',
  'files.action.choose': 'Escolher arquivos',
  'files.action.upload': 'Enviar arquivos',
  'files.places.title': 'Arquivo de lugares',
  'files.places.description':
    'Baixe os lugares desta viagem como GeoJSON, incluindo os que não têm coordenadas.',
  'files.places.action': 'Baixar lugares (.geojson)',
  'files.places.empty': 'Adicione lugares a esta viagem para baixá-los.',
  'files.places.error':
    'Não foi possível preparar o arquivo de lugares. Tente novamente.',
  'files.places.pending': 'Preparando o arquivo de lugares…',
  'files.places.done': 'Arquivo de lugares baixado.',
  'files.calendar.live.action': 'Link de calendário atualizado',
  'files.calendar.live.title': 'Link de calendário atualizado',
  'files.calendar.warning':
    'Qualquer pessoa com este link pode ler lugares, horários, endereços e notas da viagem sem uma conta. Proteja-o como uma senha.',
  'files.calendar.enable.action': 'Criar um link',
  'files.calendar.link.once':
    'Copie agora - só mostramos uma vez. Se perder, crie um novo link; o antigo deixará de funcionar.',
  'files.calendar.link.address': 'Endereço do link',
  'files.calendar.link.copy': 'Copiar link',
  'files.calendar.link.copied': 'Link copiado',
  'files.calendar.link.copyFailed':
    'Não foi possível copiar. Selecione o endereço e copie manualmente.',
  'files.calendar.link.open': 'Abrir no seu aplicativo de calendário',
  'files.calendar.link.google': 'Adicionar ao Google Agenda',
  'files.calendar.link.outlook': 'Adicionar ao Outlook',
  'files.calendar.link.done': 'Pronto',
  'files.calendar.link.stays':
    'Números de confirmação, preços e arquivos ficam no planned.travel.',
  'files.calendar.freshness':
    'Aplicativos de calendário podem levar várias horas, às vezes mais, para mostrar uma alteração.',
  'files.calendar.state.on': 'O link de calendário está ativo',
  'files.calendar.state.lastFetched':
    'Um calendário consultou este link pela última vez {when}',
  'files.calendar.state.neverFetched': 'Ainda não consultado',
  'files.calendar.rotate.action': 'Criar um novo link',
  'files.calendar.rotate.confirmTitle': 'Criar um novo link?',
  'files.calendar.rotate.confirmBody':
    'O link antigo para de funcionar agora. Os calendários que o usam deixam de ser atualizados até você fornecer o novo link.',
  'files.calendar.rotate.busy': 'Criando um novo link…',
  'files.calendar.error.rotate':
    'Não foi possível confirmar a criação de um novo link. O estado atual está abaixo; tente novamente se precisar.',
  'files.calendar.rotate.confirm': 'Criar um novo link',
  'files.calendar.off.action': 'Desativar',
  'files.calendar.off.confirmTitle': 'Desativar este link de calendário?',
  'files.calendar.off.confirmBody':
    'O link para de funcionar imediatamente. Os calendários mantêm os eventos já recebidos, mas deixam de atualizá-los.',
  'files.calendar.off.confirm': 'Desativar',
  'files.calendar.off.busy': 'Desativando…',
  'files.calendar.closeGuard.title': 'Fechar sem copiar o link?',
  'files.calendar.closeGuard.body':
    'Não podemos mostrá-lo novamente. Você terá que criar outro.',
  'files.calendar.closeGuard.confirm': 'Fechar mesmo assim',
  'files.calendar.closeGuard.cancel': 'Manter aberto',
  'files.calendar.error.enable':
    'Não foi possível confirmar a criação do link. O estado atual aparece abaixo. Se estiver ativo, mas você não o viu, desative-o e crie novamente.',
  'files.calendar.error.off':
    'Não foi possível confirmar a desativação do link. O estado atual aparece abaixo; tente novamente se necessário.',
  'files.calendar.error.load':
    'Não foi possível verificar o link de calendário desta viagem. Tente novamente.',
  'files.calendar.retry': 'Tentar novamente',
  'files.calendar.off.confirmBodyUnused':
    'Este link ainda não foi usado. Ele para de funcionar imediatamente.',
  'files.calendar.link.fallback':
    'Se não conseguir adicioná-lo no celular, abra esta página em um computador.',
  'files.calendar.link.newTab': 'abre em uma nova aba',
  'files.calendar.title': 'Calendário',
  'files.calendar.description':
    'Leve esta viagem para o aplicativo de calendário que você já usa.',
  'files.calendar.download.action': 'Baixar arquivo de calendário (.ics)',
  'files.calendar.download.hint':
    'Um retrato da viagem como ela está agora. Ele não é atualizado.',
  'files.calendar.undated':
    'Esta viagem ainda não tem datas, então só aparecerão reservas e trajetos com data.',
  'files.calendar.download.error':
    'Não foi possível preparar o arquivo. Tente novamente.',
  'files.calendar.timesNote':
    'Trajetos com fuso horário aparecem no mesmo momento em qualquer lugar. Todo o resto aparece no horário planejado do relógio, onde quer que esteja o seu calendário.',
  'files.drop.active': 'Solte para enviar',
  'files.drop.pasteHint': 'cola uma imagem copiada ou uma captura de tela',
  'files.reject.blockedType':
    '“{name}” não foi adicionado: arquivos XML e SVG compactados não são guardados aqui, por segurança. Salve como PDF ou imagem e adicione isso no lugar.',
  'files.drop.idle': 'Arraste arquivos para cá',
  'files.empty.title': 'Nenhum arquivo nesta viagem',
  'files.empty.body':
    'Tudo o que você teria que garimpar numa caixa de entrada no balcão de check-in fica aqui, junto da viagem a que pertence.',
  'files.empty.hint':
    'Cartões de embarque, confirmações de hotel, ingressos, documentos do seguro e os recibos que sustentam suas despesas.',
  'files.heading': 'Anexos',
  'files.tableCaption': 'Arquivos anexados a esta viagem',
  'files.menu.download': 'Baixar',
  'files.menu.rename': 'Renomear e descrever…',
  'files.menu.remove': 'Remover o arquivo',
  'files.remove.body':
    'O arquivo é apagado do armazenamento e também da viagem, e {size} são liberados. Isso não dá para desfazer.',
  'files.queue.clear': 'Limpar os concluídos',
  'files.column.file': 'Arquivo',
  'files.column.size': 'Tamanho',
  'files.column.addedBy': 'Adicionado por',
  'files.column.when': 'Quando',
  'files.status.uploaded': 'Enviado',
  'files.status.failed': 'Falhou',
  'files.status.cancelled': 'Cancelado',
  'files.status.uploading': 'Enviando',
  'files.status.waiting': 'Aguardando',
  'files.error.nameEmpty':
    'Um arquivo precisa de um nome pelo qual você o encontre.',
  'files.field.kindHint':
    'Decide sob qual filtro ele fica e qual símbolo recebe.',
  'files.field.kindAria': 'Tipo de arquivo',
  'files.field.description': 'Descrição',
  'files.field.descriptionPlaceholder':
    'Apólice de seguro — cobre o grupo inteiro, telefone de sinistro na página 2.',
  'files.dialog.title': 'Detalhes do arquivo',
  'files.action.saving': 'Salvando o arquivo',
  'files.action.save': 'Salvar os detalhes',
  'files.queue.someFailed': {
    one: '{count} arquivo não foi enviado. O motivo está em cada linha: nada mais do lote foi afetado.',
    many: '{count} arquivos não foram enviados. O motivo está em cada linha: nada mais do lote foi afetado.',
    other:
      '{count} arquivos não foram enviados. O motivo está em cada linha: nada mais do lote foi afetado.',
  },

  'files.action.cancelUploadOf': 'Cancelar o envio de {name}',
  'files.action.dismissOf': 'Descartar {name}',
  'files.status.downloadingOf': 'Baixando {name}',
  'files.status.uploadingOf': 'Enviando {name}',
  'files.status.uploadingCount': {
    one: 'Enviando {count} arquivo',
    many: 'Enviando {count} arquivos',
    other: 'Enviando {count} arquivos',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - gerado em {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': 'Pronto: {title}',
  'files.export.email.body': {
    one: 'A exportação da viagem está pronta. Ela fica guardada por {count} dia.',
    many: 'A exportação da viagem está pronta. Ela fica guardada por {count} dias.',
    other:
      'A exportação da viagem está pronta. Ela fica guardada por {count} dias.',
  },
  'files.export.email.action': 'Abrir {title}',
  'files.export.email.text': 'A exportação da viagem está pronta: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Exportar a viagem',
  'files.export.description':
    'Uma cópia imprimível da viagem: dias, paradas, reservas, transporte e hospedagens. Entregue a quem não tem conta.',
  'files.export.kept': {
    one: 'Cada exportação fica guardada por {count} dia.',
    many: 'Cada exportação fica guardada por {count} dias.',
    other: 'Cada exportação fica guardada por {count} dias.',
  },
  'files.export.empty.title': 'Ainda não há exportações',
  'files.export.empty.body':
    'Faça uma cópia imprimível da viagem para enviar a quem não tem conta.',
  'files.export.empty.bodyViewer':
    'O proprietário ou um editor da viagem pode fazer uma.',
  'files.export.format.pdf': 'Arquivo PDF',
  'files.export.format.html': 'Página imprimível',
  'files.export.artifact': 'Exportação da viagem, {date}',
  'files.export.download': 'Baixar',
  'files.export.downloadLabelPdf': 'Baixar o PDF criado em {date}',
  'files.export.downloadLabelHtml':
    'Baixar a página imprimível criada em {date}',
  'files.export.error.list': 'A lista de exportações não carregou.',
  'files.export.retry': 'Tentar de novo',
  'files.export.error.missing':
    'Essa exportação não está mais guardada. Exporte a viagem de novo.',
  'files.export.error.missingViewer': 'Essa exportação não está mais guardada.',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Envio cancelado.',
  'files.error.badAnswer':
    'O servidor mandou uma resposta que este navegador não soube ler.',
  'files.error.connection':
    'A conexão caiu durante o envio. Confira sua rede e tente de novo.',
  'files.error.timeout': 'O envio estourou o tempo. Tente de novo.',
  'files.error.refused': 'O servidor recusou o envio ({status}).',
  'files.error.downloadShape':
    'O download voltou num formato que não deu para salvar.',
  'files.error.downloadFailed': 'O download falhou ({status}).',
  'files.toast.uploadedOne': 'Arquivo enviado',
  'files.toast.uploadedManyBody': '{size} adicionados a esta viagem.',
  'files.toast.failedOne': 'Esse arquivo não foi enviado',
  'files.toast.failedManyBody': 'A fila abaixo diz o motivo de cada um.',
  'files.error.tooMany': {
    one: 'Só dá para adicionar {count} arquivo por vez, então “{name}” ficou de fora. Solte ele de novo sozinho.',
    many: 'Só dá para adicionar {count} arquivos por vez, então “{name}” ficou de fora. Solte ele de novo sozinho.',
    other:
      'Só dá para adicionar {count} arquivos por vez, então “{name}” ficou de fora. Solte ele de novo sozinho.',
  },
  'files.toast.uploadedMany': {
    one: '{count} arquivo enviado',
    many: '{count} arquivos enviados',
    other: '{count} arquivos enviados',
  },
  'files.toast.failedMany': {
    one: '{count} arquivo não foi enviado',
    many: '{count} arquivos não foram enviados',
    other: '{count} arquivos não foram enviados',
  },

  'files.export.request': 'Exportar a viagem',
  'files.export.includeReferences': 'Incluir códigos de confirmação',
  'files.export.includeReferencesHint':
    'Deixe desmarcado se for enviar o arquivo a alguém de fora do seu espaço.',
  'files.export.pending':
    'Preparando a exportação. Você pode sair desta página; o arquivo aparecerá na lista quando estiver pronto.',
  'files.export.slow':
    'Está demorando mais que o normal. O arquivo aparecerá aqui quando estiver pronto. Caso contrário, exporte novamente.',
  'files.export.refresh': 'Atualizar',
  'files.export.ready': 'Sua exportação está pronta',
  'files.export.quota': {
    one: 'A cota mensal deste espaço de {count} exportações foi esgotada. A contagem recomeça em {date}.',
    many: 'A cota mensal deste espaço de {count} exportações foi esgotada. A contagem recomeça em {date}.',
    other:
      'A cota mensal deste espaço de {count} exportações foi esgotada. A contagem recomeça em {date}.',
  },
  'files.export.error.request': 'A exportação não foi iniciada',
  'files.export.error.requestBody':
    'Esta tentativa não foi contabilizada. Tente novamente em instantes.',
  'files.export.doc.overview': 'Visão geral',
  'files.export.doc.timezone': 'Fuso horário',
  'files.export.doc.days': 'Dias',
  'files.export.doc.day': {
    one: 'Dia {count} - {date}',
    many: 'Dia {count} - {date}',
    other: 'Dia {count} - {date}',
  },
  'files.export.doc.dayUndated': {
    one: 'Dia {count}',
    many: 'Dia {count}',
    other: 'Dia {count}',
  },
  'files.export.doc.dayEmpty': 'Nada planejado ainda.',
  'files.export.doc.reservations': 'Reservas',
  'files.export.doc.transport': 'Transporte',
  'files.export.doc.reference': 'Referência {code}',
  'files.export.doc.route': '{from} a {to}',
  'files.export.doc.stays': 'Onde vamos ficar',
  'files.export.doc.nights': {
    one: 'Noites: {count}',
    many: 'Noites: {count}',
    other: 'Noites: {count}',
  },
  'files.export.doc.truncatedDays': {
    one: 'Nem todos os dias cabem em um documento. Os primeiros {count} dias são mostrados.',
    many: 'Nem todos os dias cabem em um documento. Os primeiros {count} dias são mostrados.',
    other:
      'Nem todos os dias cabem em um documento. Os primeiros {count} dias são mostrados.',
  },
  'files.export.doc.truncatedRows': {
    one: 'Mostrando os primeiros {count} de {total}.',
    many: 'Mostrando os primeiros {count} de {total}.',
    other: 'Mostrando os primeiros {count} de {total}.',
  },
  'files.export.notify': 'Avise por e-mail quando estiver pronta',
  'files.export.viewer':
    'Somente proprietários e editores podem criar uma exportação. Você pode baixar as existentes.',
  'files.export.jump': 'Ir para exportações',
  'files.export.fromLink': 'Do seu link',
  'files.export.linkGone':
    'Esta exportação não está mais armazenada. Crie uma nova abaixo.',
  'files.export.allowance': {
    one: '{used} de {count} exportação usada neste mês',
    many: '{used} de {count} exportações usadas neste mês',
    other: '{used} de {count} exportações usadas neste mês',
  },
  'files.export.allowanceUnlimited': {
    one: '{count} exportação neste mês',
    many: '{count} exportações neste mês',
    other: '{count} exportações neste mês',
  },
  'files.export.linkGoneViewer': 'Essa exportação não está mais guardada.',
  'files.calendar.tab.trip': 'Esta viagem',
  'files.calendar.tab.workspace': 'Minhas viagens',
  'files.calendar.workspace.warning':
    'Qualquer pessoa com este link pode ler sem conta as viagens não arquivadas de que você participa neste espaço: as {count} com as datas de início mais recentes. Novas viagens aparecem automaticamente. Proteja-o como uma senha.',
  'files.calendar.workspace.nameNote':
    'Este link aparece no calendário como “planned.travel”. Renomeie-o se você tiver mais de um.',
  /* ----------------------------------- the leave planner's allowance */
  'vacay.allowance.label': 'Cota de dias {year}',
  'vacay.allowance.daysLeft': {
    one: 'Restam {value} dia',
    many: 'Restam {value} dias',
    other: 'Restam {value} dias',
  },
  'vacay.allowance.daysOver': {
    one: 'Excedido em {value} dia',
    many: 'Excedido em {value} dias',
    other: 'Excedido em {value} dias',
  },
  'vacay.allowance.progress': 'Dias usados: {used} de {total}',
  'vacay.allowance.tile.days': 'Dias',
  'vacay.allowance.tile.used': 'Usados',
  'vacay.allowance.tile.carried': 'Transferidos',
  'vacay.allowance.tile.edit.days': 'Editar dias, atualmente {value}',
  'vacay.allowance.input.days': 'Sua cota para {year}',
  'vacay.allowance.input.invalid': 'Digite um número inteiro de 0 a 365.',
  'vacay.allowance.save': 'Salvar',
  'vacay.allowance.cancel': 'Cancelar',
  'vacay.allowance.saving': 'Salvando…',
  'vacay.allowance.default.hint': 'Cota padrão. Selecione para definir a sua.',
  'vacay.allowance.saved': 'Cota salva.',
  'vacay.allowance.error.days': {
    one: 'Não foi possível salvar sua cota. {year} ainda mostra {value} dia.',
    many: 'Não foi possível salvar sua cota. {year} ainda mostra {value} dias.',
    other:
      'Não foi possível salvar sua cota. {year} ainda mostra {value} dias.',
  },
  'vacay.allowance.retry': 'Tentar novamente',
  'vacay.allowance.tile.edit.carried':
    'Editar dias transferidos, atualmente {value}',
  'vacay.allowance.input.carried': 'Dias transferidos para {year}',
  'vacay.allowance.carried.from': 'Transferidos de {year}',
  'vacay.allowance.carried.opening':
    'Trazidos de antes de {year}. Selecione para editar.',
  'vacay.allowance.carried.off': 'A transferência está desativada',
  'vacay.allowance.carried.wholeDays':
    'Só dias inteiros são transferidos para o ano seguinte; o meio dia que sobra não é.',
  'vacay.allowance.error.derived':
    'Os dias transferidos para {year} agora são calculados a partir de {previousYear}, então não podem ser editados.',
  'vacay.allowance.error.carried': {
    one: 'Não foi possível salvar seus dias transferidos. {year} ainda mostra {value} dia.',
    many: 'Não foi possível salvar seus dias transferidos. {year} ainda mostra {value} dias.',
    other:
      'Não foi possível salvar seus dias transferidos. {year} ainda mostra {value} dias.',
  },
  'vacay.allowance.superseded': {
    one: 'Os dias transferidos para {year} agora são calculados a partir de {previousYear}. Você havia informado {value} dia.',
    many: 'Os dias transferidos para {year} agora são calculados a partir de {previousYear}. Você havia informado {value} dias.',
    other:
      'Os dias transferidos para {year} agora são calculados a partir de {previousYear}. Você havia informado {value} dias.',
  },
  'vacay.pending.loading': 'Carregando',
  'vacay.error.title': 'Não foi possível carregar o planejador de férias',
  'vacay.year.previous': 'Ano anterior',
  'vacay.year.next': 'Próximo ano',
  'vacay.settings.open': 'Configurações do plano de férias',
  'vacay.settings.title': 'Configurações do plano de férias',
  'vacay.settings.description':
    'Como os dias não usados são transferidos e quantos dias você tem por padrão.',
  'vacay.settings.carryOver':
    'Transferir os dias não usados para o ano seguinte',
  'vacay.settings.carryOver.hint':
    'Ao desativar, os dias transferidos ficam ocultos, mas não são apagados.',
  'vacay.settings.defaultAllowance': 'Cota padrão (dias por ano)',
  'vacay.settings.defaultAllowance.hint':
    'Vale para os anos em que você não definiu a sua própria cota.',
  'vacay.settings.save': 'Salvar configurações',
  'vacay.settings.cancel': 'Cancelar',
  'vacay.settings.saved': 'Configurações do plano de férias salvas.',
  'vacay.settings.error':
    'Não foi possível salvar as configurações do plano de férias. Nada foi alterado.',
  'collections.page.eyebrow': 'Coleção',
  'collections.page.all': 'Todos',
  'collections.page.back': 'Todas as coleções',
  'collections.page.savedPlaces': {
    one: 'Locais guardados: {count}',
    many: 'Locais guardados: {count}',
    other: 'Locais guardados: {count}',
  },
  'collections.page.loadErrorTitle': 'Não foi possível carregar esta coleção',
  'collections.status.idea': 'Ideia',
  'collections.status.shortlisted': 'Pré-selecionado',
  'collections.status.planned': 'Planeado',
  'collections.status.visited': 'Visitado',
  'collections.status.rejected': 'Rejeitado',
  'collections.empty.title': 'Ainda não há locais guardados',
  'collections.empty.body':
    'Guarda um local do mapa, de outra viagem ou de uma recomendação para o adicionar a esta coleção.',
  'collections.filtered.title': 'Nada corresponde a esse filtro',
  'collections.filtered.body':
    'Experimenta outro estado ou remove o filtro de etiqueta.',
  'collections.filtered.reset': 'Redefinir filtros',
  'collections.filtered.showing': {
    one: 'Locais guardados visíveis: {count}',
    many: 'Locais guardados visíveis: {count}',
    other: 'Locais guardados visíveis: {count}',
  },
  'collections.filters.statusGroup': 'Filtrar por estado',
  'collections.labels.filterGroup': 'Filtrar por etiqueta',
  'collections.labels.panel': 'Etiquetas desta coleção',
  'collections.card.noLocation': 'Localização não registada',
  'collections.card.noPrice': 'Preço não indicado',
  'collections.card.website': 'Sítio web',
  'collections.actions.trigger': 'Ações para {name}',
  'collections.actions.edit': 'Editar detalhes',
  'collections.actions.delete': 'Eliminar coleção…',
  'collections.edit.title': 'Editar coleção',
  'collections.edit.name': 'Nome',
  'collections.edit.description': 'Descrição',
  'collections.edit.colour': 'Cor',
  'collections.edit.submit': 'Salvar alterações',
  'collections.edit.saving': 'Salvando',
  'collections.edit.cancel': 'Cancelar',
  'collections.edit.saved': 'Coleção atualizada',
  'collections.edit.errorTitle': 'Não foi possível guardar',
  'collections.edit.error':
    'Não foi possível confirmar a gravação. Verifica a coleção antes de tentar novamente.',
  'collections.edit.nameRequired': 'Dá um nome à coleção.',
  'collections.edit.nameTooLong': {
    one: 'Comprimento máximo do nome em caracteres: {count}',
    many: 'Comprimento máximo do nome em caracteres: {count}',
    other: 'Comprimento máximo do nome em caracteres: {count}',
  },
  'collections.edit.currentColour': 'Cor atual',
  'collections.delete.title': 'Eliminar {name}?',
  'collections.delete.loading': 'A carregar o conteúdo da coleção',
  'collections.delete.loadErrorTitle': 'Não foi possível verificar a coleção',
  'collections.delete.loadError':
    'Não foi possível ler a coleção atual. Tenta novamente.',
  'collections.delete.retry': 'Tentar de novo',
  'collections.delete.places': {
    one: 'Locais guardados: {count}',
    many: 'Locais guardados: {count}',
    other: 'Locais guardados: {count}',
  },
  'collections.delete.labels': {
    one: 'Etiquetas: {count}',
    many: 'Etiquetas: {count}',
    other: 'Etiquetas: {count}',
  },
  'collections.delete.irreversible':
    'Esta ação não pode ser anulada. Os locais guardados e as etiquetas serão eliminados com a coleção. Os locais das tuas viagens não serão alterados.',
  'collections.delete.typeName': 'Escreve o nome da coleção para a eliminar.',
  'collections.delete.nameLabel': 'Nome da coleção',
  'collections.delete.nameNeeded':
    'Esta coleção contém agora locais guardados. Escreve o nome para a eliminar.',
  'collections.delete.confirm': 'Eliminar coleção',
  'collections.delete.deleting': 'A eliminar',
  'collections.delete.cancel': 'Cancelar',
  'collections.delete.deleted': 'Coleção eliminada',
  'collections.delete.error':
    'Não foi possível confirmar a eliminação. Verifica a coleção e tenta novamente.',
  'collections.statusPicker.trigger':
    '{place}: estado {status}. Alterar estado',
  'collections.statusPicker.legend': 'Estado de {place}',
  'collections.statusPicker.saved': '{place}: estado definido como {status}',
  'collections.statusPicker.hiddenNow':
    '{place} tem agora o estado {status} e está oculto pelo filtro',
  'collections.statusPicker.error':
    'Não foi possível confirmar o estado de {place}. Verifica-o antes de tentar novamente.',
  'collections.statusPicker.retry': 'Tentar de novo',

  'collections.edit.retry': 'Tentar de novo',
  'files.readOnly.title': 'Arquivos somente para leitura',
  'files.readOnly.role':
    'Somente proprietários e editores da viagem podem enviar, renomear ou excluir arquivos. Você ainda pode baixá-los.',
  'vacay.kind.vacation': 'Férias',
  'vacay.kind.half_day': 'Meio dia de férias',
  'vacay.kind.sick': 'Licença médica',
  'vacay.kind.remote': 'Trabalho remoto',
  'vacay.kind.holiday': 'Feriado',
  'vacay.kind.other': 'Outro',
  'vacay.kind.cost.full': 'Usa 1 dia do seu saldo',
  'vacay.kind.cost.half': 'Usa meio dia do seu saldo',
  'vacay.kind.cost.none': 'Não usa seu saldo',
  'vacay.day.clear': 'Limpar este dia',
  'vacay.day.choose': 'Escolha o tipo de ausência',
  'vacay.day.retry': 'Tentar novamente',
  'vacay.day.title': 'Marcar {date}',
  'vacay.day.cleared': '{date} limpo.',
  'vacay.day.saved': '{kind}: {date}.',
  'vacay.day.blocked.weekend':
    'Meu tempo livre: os fins de semana estão bloqueados neste plano.',
  'vacay.day.blocked.company':
    'Meu tempo livre: as folgas da empresa estão bloqueadas neste plano.',
  'vacay.day.failed':
    'Não foi possível salvar {date}. A última entrada salva é exibida.',
  'vacay.grid.empty': 'Nenhum dia marcado em {year}',
  'vacay.grid.gesture': 'Selecione um dia para marcar uma ausência.',
  'vacay.grid.today': 'Ir para hoje',
  'vacay.grid.start': 'Ir para o início do ano',
  'vacay.grid.help':
    'As setas mudam o dia ou a semana, Page Up e Page Down o mês, Home e End os limites da semana. Selecione um dia para marcá-lo.',
  'vacay.grid.others': 'Outros viajantes ausentes: {value}',
  'vacay.legend.title': 'Legenda de marcas',
  'vacay.legend.company': 'Folga da empresa',
  'vacay.legend.other': 'Outra pessoa ausente',
  'vacay.legend.weekend': 'Fim de semana',
} satisfies TranslationOf<typeof En>

export default messages
