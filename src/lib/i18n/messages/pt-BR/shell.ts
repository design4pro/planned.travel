/**
 * Everything the application shell says, in Brazilian Portuguese.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Você» with the verb in the third person, and Brazilian
 * vocabulary throughout — «celular», «ingresso», «arquivo» — matching
 * `./ui.ts` and `./settings.ts`.
 *
 * **Plural.** `Intl.PluralRules('pt-BR')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Feature names are translated, not borrowed.** «Atlas», «Vacay» and
 * «Journey» would be English words in a Brazilian nav, so each says what its
 * screen is: o mapa-múndi, as férias, o diário.
 *
 * **Dates.** Nothing here restates a date format: the Brazilian month and
 * weekday names and the `d de MMM de y` pattern are frozen in
 * `src/lib/format-tables.ts`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Seções principais',
  'nav.mobile': 'Seções',
  'nav.dashboardLink': 'Painel do planned.travel',
  'nav.homeLink': 'Início do planned.travel',
  'nav.newTrip': 'Nova viagem',

  'nav.trips': 'Minhas viagens',
  'nav.trips.short': 'Viagens',
  'nav.vacay': 'Férias',
  'nav.vacay.short': 'Férias',
  'nav.atlas': 'Mapa-múndi',
  'nav.atlas.short': 'Mapa',
  'nav.journey': 'Diário',
  'nav.journey.short': 'Diário',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Seções da viagem',
  'trip.nav.back': 'Viagens',
  'trip.nav.share': 'Compartilhar',
  'trip.nav.shareLabel': 'Compartilhar esta viagem',
  'trip.tab.plan': 'Roteiro',
  'trip.tab.transports': 'Deslocamentos',
  'trip.tab.book': 'Reservas',
  'trip.tab.lists': 'Listas',
  'trip.tab.costs': 'Gastos',
  'trip.tab.files': 'Arquivos',
  'trip.tab.collab': 'Grupo',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Menu da conta',
  'account.settings': 'Configurações',
  'account.billing': 'Plano e pagamento',
  'account.admin': 'Administração',
  'account.signOut': 'Sair',
  'account.signingOut': 'Saindo…',
  'account.signOutFailed': 'Não foi possível sair',
  'account.signOutFailedBody': 'Confira sua conexão e tente de novo.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Aparência',
  'theme.light': 'Claro',
  'theme.dark': 'Escuro',
  'theme.system': 'Seguir o sistema',
  'theme.state.light': 'claro',
  'theme.state.dark': 'escuro',
  'theme.state.system': 'seguindo o sistema',
  'theme.trigger': 'Tema: {state}. Mudar o tema',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Notificações, nenhuma não lida',
  'bell.unread': {
    one: 'Notificações, {unread} não lida',
    many: 'Notificações, {unread} não lidas',
    other: 'Notificações, {unread} não lidas',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Caixa de entrada',
  'inbox.title': 'Notificações',
  'inbox.error': 'Sua caixa de entrada não carregou',
  'inbox.allRead': 'Está tudo lido',
  'inbox.unread': {
    one: '{unread} mensagem não lida',
    many: '{unread} mensagens não lidas',
    other: '{unread} mensagens não lidas',
  },
  'inbox.markAll': 'Marcar tudo como lido',
  'inbox.markingAll': 'Marcando tudo como lido',
  'inbox.cleared': 'Caixa de entrada em dia',
  'inbox.markAllFailed': 'Não foi possível marcar tudo como lido',
  'inbox.retryHint': 'Confira sua conexão e tente de novo.',
  'inbox.filter.all': 'Tudo',
  'inbox.filter.unread': 'Não lidas',
  'inbox.waiting': {
    one: '{invitations} convite esperando',
    many: '{invitations} convites esperando',
    other: '{invitations} convites esperando',
  },
  'inbox.empty.title': 'Sua caixa de entrada está vazia',
  'inbox.empty.body':
    'Convites de viagem, mudanças de roteiro, lembretes de reserva e contas acertadas chegam todos aqui.',
  'inbox.empty.action': 'Voltar ao painel',
  'inbox.emptyUnread.title': 'Nada por ler',
  'inbox.emptyUnread.body':
    'Você leu tudo. Mude para Tudo para rever o histórico.',
  'inbox.emptyUnread.action': 'Mostrar tudo',
  'inbox.row.new': 'Novo',
  'inbox.row.accepted': 'Aceito',
  'inbox.row.declined': 'Recusado',
  'inbox.row.open': 'Abrir',
  'inbox.row.markRead': 'Lida',
  'inbox.row.markingRead': 'Marcando como lida',
  'inbox.row.markReadFailed': 'Não foi possível marcar como lida',
  'inbox.preferences':
    'Escolha quais delas chegam à sua caixa, ao seu e-mail e ao seu celular.',
  'inbox.preferencesAction': 'Configurações de notificação',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Você foi convidado para {tripTitle}',
  'notification.trip.invited.body': '{actorName} adicionou você à viagem.',
  'notification.trip.updated.title': '{tripTitle} mudou',
  'notification.trip.updated.body': '{actorName} alterou o roteiro.',
  'notification.trip.member_added.title': '{memberName} entrou em {tripTitle}',
  'notification.trip.member_added.body':
    'Agora vê o roteiro, as reservas e as contas.',
  'notification.trip.member_removed.title': '{memberName} saiu de {tripTitle}',
  'notification.trip.member_removed.body':
    'O acesso dessa pessoa à viagem terminou.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} começa em {days} dia',
    many: '{tripTitle} começa em {days} dias',
    other: '{tripTitle} começa em {days} dias',
  },
  'notification.trip.starting_soon.body':
    'Hora de revisar a lista de bagagem e as reservas.',
  'notification.reservation.reminder.title': '{title} está chegando',
  'notification.reservation.reminder.body':
    'Confira o horário e o código de confirmação na reserva.',
  'notification.reservation.confirmed.title': '{title} está confirmada',
  'notification.reservation.confirmed.body':
    'A reserva consta como confirmada em {tripTitle}.',
  'notification.expense.added.title': '{actorName} lançou um gasto',
  'notification.expense.added.body': '{title}, em {tripTitle}.',
  'notification.expense.settled.title': '{actorName} acertou as contas',
  'notification.expense.settled.body': 'O saldo de {tripTitle} está pago.',
  'notification.list.assigned.title': '{actorName} atribuiu um item a você',
  'notification.list.assigned.body': '{title}, em {tripTitle}.',
  'notification.collab.message.title': '{actorName} escreveu em {tripTitle}',
  'notification.collab.message.body': '“{preview}”',
  'notification.collab.poll.title': 'Há uma enquete aberta em {tripTitle}',
  'notification.collab.poll.body': '“{question}”',
  'notification.organization.invited.title':
    'Você foi convidado para {organizationName}',
  'notification.organization.invited.body':
    'Aceite para entrar no espaço de trabalho e em tudo o que é compartilhado nele.',
  'notification.journey.published.title': '{title} foi publicado',
  'notification.journey.published.body':
    'Agora qualquer pessoa com o link pode ler o diário.',
  'notification.billing.plan_changed.title': 'Seu plano mudou',
  'notification.billing.plan_changed.body':
    '{organizationName} agora está no plano {plan}.',
  'notification.fallback.title': 'Algo mudou no seu espaço de trabalho',
  'notification.fallback.body': 'Abra a viagem para ver o que foi.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'O painel não carregou',
  'dashboard.blank.title': 'Sua próxima viagem começa aqui',
  'dashboard.blank.body':
    'Crie uma viagem, marque no mapa os lugares que você quer ver e o planned.travel monta o roteiro dia a dia em volta deles.',
  'dashboard.blank.action': 'Planejar uma viagem',
  'dashboard.blank.secondary': 'Ver seu mapa-múndi',

  'dashboard.upNext': 'A seguir',
  'dashboard.openPlan': 'Abrir o roteiro',
  'dashboard.hero.travellers': 'Viajantes',
  'dashboard.hero.travellersHint': 'neste espaço',
  'dashboard.hero.dates': 'Datas',
  'dashboard.hero.datesUnset': 'Sem definir',
  'dashboard.hero.datesHint': {
    one: '{days} dia',
    many: '{days} dias',
    other: '{days} dias',
  },
  'dashboard.hero.datesMissing': 'Adicione datas para criar os dias',
  'dashboard.hero.startsIn': 'Começa em',
  'dashboard.hero.started': 'Começou há',
  'dashboard.hero.today': 'Hoje',
  'dashboard.hero.startUnknown': 'sem data de início',
  'dashboard.hero.startToday': 'boa viagem',
  /**
   * The label over the numeral already carries «há», so the unit under it is
   * only the word for a day — Portuguese would otherwise say it twice.
   */
  'dashboard.hero.startPast': {
    one: 'dia',
    many: 'dias',
    other: 'dias',
  },
  'dashboard.hero.startFuture': {
    one: 'dia',
    many: 'dias',
    other: 'dias',
  },
  'dashboard.hero.places': 'Lugares',
  'dashboard.hero.placesNone': 'ainda não há nada no mapa',
  'dashboard.hero.placesHint': 'no mapa',

  'dashboard.stat.countries': 'Países visitados',
  'dashboard.stat.countriesUnit': 'de {total}',
  'dashboard.stat.countriesNone': 'Marque um país para começar seu mapa',
  'dashboard.stat.visits': {
    one: '{visits} visita registrada',
    many: '{visits} visitas registradas',
    other: '{visits} visitas registradas',
  },
  'dashboard.stat.trips': 'Viagens no total',
  'dashboard.stat.tripsCaption': '{planning} em preparo · {booked} com reserva',
  'dashboard.stat.places': 'Lugares no mapa',
  'dashboard.stat.placesNone': 'Ainda não há nada no mapa',
  'dashboard.stat.placesAcross': {
    one: 'em {trips} viagem',
    many: 'em {trips} viagens',
    other: 'em {trips} viagens',
  },
  'dashboard.stat.bookings': 'Reservas confirmadas',
  'dashboard.stat.bookingsNone': 'Nenhuma reserva a caminho',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} reserva a caminho',
    many: '{bookings} reservas a caminho',
    other: '{bookings} reservas a caminho',
  },

  'dashboard.trips.label': 'Suas viagens',
  'dashboard.trips.all': 'Todas as viagens',
  'dashboard.trips.empty.title': 'Ainda não há viagens',
  'dashboard.trips.empty.body':
    'Tudo o que você planejar aparece aqui, da mais recente para a mais antiga.',
  'dashboard.trips.empty.action': 'Criar uma viagem',

  'dashboard.bookings.label': 'Próximas reservas',
  'dashboard.bookings.empty.title': 'Ainda não há nada reservado',
  'dashboard.bookings.empty.body':
    'Hospedagens, mesas e ingressos confirmados aparecem aqui conforme a data se aproxima.',

  'dashboard.pipeline.label': 'Viagens por etapa',
  'dashboard.pipeline.empty':
    'Nada em andamento. Sua primeira viagem vai preencher estas etapas.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} favorita',
    many: '{favourites} favoritas',
    other: '{favourites} favoritas',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} viagem arquivada',
    many: '{archived} viagens arquivadas',
    other: '{archived} viagens arquivadas',
  },

  'dashboard.storage.label': 'Armazenamento',
  'dashboard.storage.count': '{used} de {limit}',
  'dashboard.storage.files': {
    one: '{files} arquivo em todas as viagens, com fotos e passagens.',
    many: '{files} arquivos em todas as viagens, com fotos e passagens.',
    other: '{files} arquivos em todas as viagens, com fotos e passagens.',
  },
  'dashboard.storage.more': 'Precisa de mais espaço?',
  'dashboard.storage.plans': 'Ver os planos',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'O console de administração não carregou',
  'admin.denied.title': 'Só administradores do espaço abrem isto',
  'admin.denied.body':
    'Se precisar, peça a um proprietário ou a um administrador deste espaço para mudar seu papel.',
  'admin.denied.action': 'Voltar ao painel',
  'admin.eyebrow': 'Administração do espaço',
  'admin.description': 'Plano {plan} · criado em {date}',
  'admin.createdUnknown': 'há pouco',
  'admin.workspaceSettings': 'Configurações do espaço',
  'admin.billing': 'Plano e pagamento',

  'admin.invitations.title': {
    one: '{invitations} convite ainda em aberto',
    many: '{invitations} convites ainda em aberto',
    other: '{invitations} convites ainda em aberto',
  },
  'admin.invitations.body':
    'Cada convite em aberto ocupa uma das vagas que o seu plano paga.',
  'admin.invitations.action': 'Revisar os convites',

  'admin.stat.members': 'Membros',
  'admin.stat.membersCaption': {
    one: '{invitations} convite pendente',
    many: '{invitations} convites pendentes',
    other: '{invitations} convites pendentes',
  },
  'admin.stat.storage': 'Armazenamento',
  'admin.stat.storageUnit': 'de {limit}',
  'admin.stat.storageUnlimited': 'sem teto',
  'admin.stat.storageCaption': 'Arquivos, fotos e exportações',
  'admin.stat.audit': 'Registros de auditoria',
  'admin.stat.auditCaption': 'A atividade mais recente está logo abaixo',
  'admin.stat.plan': 'Plano',
  'admin.stat.planCaption': 'As cotas são aplicadas na camada de dados',

  'admin.quotas.label': 'Cotas',
  'admin.quotas.count': {
    one: '{metrics} métrica',
    many: '{metrics} métricas',
    other: '{metrics} métricas',
  },
  'admin.quotas.unlimited': 'Ilimitado',
  'admin.quotas.value': '{used} de {limit}',

  'admin.members.label': 'Membros',
  'admin.members.table': 'Membros deste espaço de trabalho',
  'admin.members.person': 'Pessoa',
  'admin.members.role': 'Papel',
  'admin.members.joined': 'Entrou em',

  'admin.activity.label': 'Atividade recente',
  'admin.activity.empty.title': 'Ainda não há nada registrado',
  'admin.activity.empty.body':
    'Toda gravação que importa entra no registro na hora em que acontece.',
  'admin.activity.workspace': 'o próprio espaço de trabalho',
  'admin.actions.label': 'Ações mais frequentes',
  'admin.actions.count': {
    one: '{actions} ação',
    many: '{actions} ações',
    other: '{actions} ações',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Rascunho',
  'tripStatus.planning': 'Em preparo',
  'tripStatus.booked': 'Reservada',
  'tripStatus.active': 'Em andamento',
  'tripStatus.completed': 'Concluída',
  'tripStatus.archived': 'Arquivada',

  'bookingStatus.none': 'Sem reserva',
  'bookingStatus.pending': 'Pendente',
  'bookingStatus.confirmed': 'Confirmada',
  'bookingStatus.cancelled': 'Cancelada',
  'bookingStatus.completed': 'Finalizada',

  'bookingType.accommodation': 'Hospedagem',
  'bookingType.restaurant': 'Mesa',
  'bookingType.activity': 'Atividade',
  'bookingType.tour': 'Passeio',
  'bookingType.ticket': 'Ingresso',
  'bookingType.transport': 'Transporte',
  'bookingType.other': 'Reserva',

  'role.owner': 'Proprietário',
  'role.admin': 'Administrador',
  'role.member': 'Membro',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} viagem',
    many: '{value} viagens',
    other: '{value} viagens',
  },
  'trips.count.favourites': {
    one: '{value} favorita',
    many: '{value} favoritas',
    other: '{value} favoritas',
  },
  'trips.count.archived': {
    one: '{value} arquivada',
    many: '{value} arquivadas',
    other: '{value} arquivadas',
  },
  'trips.atLimit.body':
    'Seu plano cobre {trips}. Arquive alguma que você terminou ou passe para um plano maior para manter mais abertas ao mesmo tempo.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Novo diário',
  'newJourney.title': 'Comece um diário',
  'newJourney.description':
    'Um diário é o lado escrito de uma viagem: entradas em ordem de data, com as fotos e o clima de que você se lembra.',
  'newJourney.titlePlaceholder': 'Duas semanas em Quioto',
  'newJourney.subtitle': 'Subtítulo',
  'newJourney.subtitleHint': 'Uma linha sob o título, na capa.',
  'newJourney.subtitlePlaceholder': 'Templos, trens e matcha demais',
  'newJourney.trip': 'Com base em uma viagem',
  'newJourney.tripHint': 'Opcional: liga a história ao plano dela.',
  'newJourney.tripNone': 'Sem viagem associada',
  'newJourney.datesError': 'A data de fim é anterior ao início.',
  'newJourney.submit': 'Criar diário',
  'newJourney.creating': 'Criando o diário',
  'newJourney.created': 'Diário começado',
  'newJourney.createdBody':
    'Adicione a primeira entrada para começar a história.',
  'newJourney.error':
    'Não foi possível criar o diário. Tente de novo em um instante.',
  'newCollection.trigger': 'Nova coleção',
  'newCollection.title': 'Comece uma coleção',
  'newCollection.description':
    'Um lugar para os lugares que você encontra antes de saber a que viagem pertencem.',
  'newCollection.namePlaceholder': 'Um café que vale atravessar a cidade',
  'newCollection.descriptionHint': 'O que entra aqui e o que não entra.',
  'newCollection.submit': 'Criar coleção',
  'newCollection.creating': 'Criando a coleção',
  'newCollection.created': 'Coleção criada',
  'newCollection.createdBody': 'Comece a salvar lugares nela.',
  'newCollection.error':
    'Não foi possível criar a coleção. Tente de novo em um instante.',

  'newTrip.title': 'Comece uma viagem nova',
  'newTrip.description':
    'Um título já basta. As datas montam o plano dia a dia, e o resto pode esperar até você saber.',
  'newTrip.name': 'Nome da viagem',
  'newTrip.namePlaceholder': 'Quioto na temporada das cerejeiras',
  'newTrip.destination': 'Destino',
  'newTrip.destinationHint': 'Uma cidade, uma região ou a rota inteira.',
  'newTrip.destinationPlaceholder': 'Quioto, Japão',
  'newTrip.departure': 'Partida',
  'newTrip.return': 'Retorno',
  'newTrip.returnError': 'A data de retorno é anterior à partida.',
  'newTrip.currency': 'Moeda do orçamento',
  'newTrip.currencyHint': 'Nela somamos cada gasto desta viagem.',
  'newTrip.submit': 'Criar viagem',
  'newTrip.creating': 'Criando a viagem',
  'newTrip.error':
    'Não foi possível criar a viagem. Tente de novo em um instante.',
  'newTrip.created': 'Viagem criada',
  'newTrip.createdBody': 'Comece a marcar lugares no mapa.',

  /* ------------------------------------ who can see a thing */
  'visibility.label': 'Quem pode ver',
  'visibility.private': 'Só eu',
  'visibility.organization': 'Todos no espaço',
  'visibility.public': 'Qualquer pessoa com o link',

  'trips.error': 'Suas viagens não carregaram',
  'trips.eyebrow': 'Espaço',
  'trips.nothingPlanned': 'Nada planejado ainda',
  'trips.search': 'Buscar viagens',
  'trips.atLimit.title':
    'Você preencheu todas as viagens que o seu plano permite',
  'trips.atLimit.action': 'Comparar planos',
  'trips.noMatch.title': 'Nada corresponde a esse filtro',
  'trips.noMatch.body': 'Tente outra etapa, limpe a busca ou olhe no arquivo.',
  'trips.noMatch.action': 'Redefinir filtros',
  'trips.empty.body':
    'Uma viagem reúne o roteiro, o mapa, as reservas, as listas de bagagem e o dinheiro. Comece uma e o resto vem depois.',
  'trips.next.title': 'Para algum lugar depois',
  'trips.next.body':
    'Comece uma viagem e o planned.travel cria um dia por data, pronto para o que você salvou.',
  'trips.savedPlaces': 'Lugares salvos',
  'trips.filter.all': 'Todas',
  'trips.filter.favourites': 'Favoritas',
  'trips.card.favourite': 'Favorita',
  'trips.card.noDestination': 'Destino ainda não definido',
  'trips.card.noDates': 'Datas a definir',
  'trips.card.startsIn': 'em {days} d',
  'trips.card.days': '{days} d',
  'metric.trips': 'Viagens',
  'metric.places': 'Lugares',
  'metric.members': 'Membros',
  'metric.files': 'Arquivos',
  'metric.storage_bytes': 'Armazenamento',
  'metric.collections': 'Coleções',
  'metric.journeys': 'Diários',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Isto não carregou',
  'error.body':
    'Nada foi perdido. Tente de novo e, se continuar acontecendo, mande para a gente o detalhe abaixo.',
  'error.retry': 'Tentar de novo',
  'error.dashboard': 'Voltar ao painel',
  'error.reported': 'Fomos avisados e já estamos verificando.',
  'error.reference': 'Referência',
  'error.feedback.open': 'Conte o que aconteceu',
  'error.feedback.label': 'O que você estava fazendo quando isso aconteceu?',
  'error.feedback.send': 'Enviar',
  'error.feedback.sent': 'Obrigado — isso ajuda muito.',
  'error.feedback.failed':
    'Não foi enviado. A referência acima chega até nós mesmo assim.',
  'error.root': 'Saímos da rota',
  'error.session': 'Seu acesso ao espaço de trabalho mudou',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Relatar um problema',
  'feedback.formTitle': 'Relatar um problema',
  'feedback.messageLabel': 'O que está errado, ou o que deveria mudar?',
  'feedback.messagePlaceholder':
    'O que você esperava e o que aconteceu no lugar?',
  'feedback.emailLabel': 'Endereço de e-mail',
  'feedback.emailPlaceholder': 'voce@example.com',
  'feedback.isRequiredLabel': '(obrigatório)',
  'feedback.submitButtonLabel': 'Enviar o relato',
  'feedback.cancelButtonLabel': 'Cancelar',
  'feedback.confirmButtonLabel': 'Confirmar',
  'feedback.addScreenshotButtonLabel': 'Adicionar uma captura de tela',
  'feedback.removeScreenshotButtonLabel': 'Remover a captura de tela',
  'feedback.highlightToolText': 'Destacar',
  'feedback.hideToolText': 'Ocultar',
  'feedback.successMessageText': 'Obrigado — recebemos seu relato.',
  'feedback.errorEmptyMessageText':
    'Escreva uma frase primeiro — um relato vazio não nos diz nada.',
  'feedback.errorTimeoutText':
    'Está demorando demais, e não conseguimos confirmar que o relato foi enviado.',
  'feedback.errorForbiddenText':
    'Esta página não tem permissão para enviar relatos.',
  'feedback.errorGenericText':
    'Não foi enviado. Confira a conexão e se há um bloqueador de anúncios no caminho.',

  'notFound.eyebrow': 'Erro 404',
  'notFound.title': 'Esta página não está no mapa',
  'notFound.body':
    'O link pode estar velho, ou a viagem para a qual ele apontava foi movida ou apagada.',
  'notFound.trips': 'Todas as viagens',
  'notFound.rootBody':
    'Procuramos ao longo de toda a rota. O endereço pode ter um erro de digitação, ou a página mudou de lugar.',
  'notFound.home': 'Voltar ao início',
  'notFound.plans': 'Ver os planos',

  'session.noWorkspace':
    'Sua conta ainda não está ligada a um espaço de trabalho. Saia e entre de novo para terminar de configurá-la.',
  'session.membershipRemoved':
    'Sua participação neste espaço de trabalho foi removida.',
} satisfies TranslationOf<typeof En>

export default messages
