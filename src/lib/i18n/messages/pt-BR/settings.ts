/**
 * Everything the settings module says, in Brazilian Portuguese.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Você» with the verb in the third person, as everywhere else in
 * the Brazilian catalogue.
 *
 * **Plural.** `Intl.PluralRules('pt-BR')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Length is load-bearing here.** Two controls on these screens truncate: the
 * hint under each section link, and the trigger of every regional select. Each
 * `nav.*.hint` therefore stays inside the English one's width, and
 * `regional.workspaceDefault` leads with a bare «Padrão» rather than
 * a full translation of «workspace default».
 *
 * **Dates.** Nothing here restates a date format: the Brazilian month and
 * weekday names and the `d de MMM de y` pattern are frozen in
 * `src/lib/format-tables.ts`, and `language.sample.date` renders from it.
 *
 * **Currency names are lower case**, as Portuguese writes them.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Conta',
  'page.title': 'Configurações',
  'page.description':
    'Tudo sobre você, sobre o seu espaço de trabalho e sobre como o planned.travel se comporta',
  'page.error': 'As configurações não carregaram',

  'nav.label': 'Seções das configurações',
  'nav.profile': 'Perfil',
  'nav.profile.hint': 'Você, as datas e o dinheiro',
  'nav.language': 'Idioma',
  'nav.language.hint': 'O idioma de cada tela',
  'nav.appearance': 'Aparência',
  'nav.appearance.hint': 'Tema, movimento e o mapa',
  'nav.security': 'Segurança',
  'nav.security.hint': 'Senha, duas etapas, chaves',
  'nav.notifications': 'Notificações',
  'nav.notifications.hint': 'Caixa, e-mail e celular',
  'nav.workspace': 'Espaço de trabalho',
  'nav.workspace.hint': 'Membros e padrões comuns',
  'nav.billing': 'Pagamento',
  'nav.billing.hint': 'Plano, vagas e faturas',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Salvar as mudanças',
  'error.retryBody': 'Nada foi perdido. Confira sua conexão e tente de novo.',
  'role.owner': 'Proprietário',
  'role.admin': 'Administrador',
  'role.member': 'Membro',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Padrão — {value}',
  'regional.currency.AUD': 'dólar australiano',
  'regional.currency.CAD': 'dólar canadense',
  'regional.currency.CHF': 'franco suíço',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'libra esterlina',
  'regional.currency.JPY': 'iene japonês',
  'regional.currency.PLN': 'zloty polonês',
  'regional.currency.SEK': 'coroa sueca',
  'regional.currency.USD': 'dólar americano',
  'regional.distance.metric': 'Quilômetros',
  'regional.distance.imperial': 'Milhas',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Seu perfil não carregou',
  'profile.account.title': 'Sua conta',
  'profile.account.description':
    'Seu nome e seu e-mail vêm da conta com que você entra.',
  'profile.email.verified': 'E-mail verificado',
  'profile.email.unverified': 'E-mail não verificado',
  'profile.twoFactor.on': 'Duas etapas ligadas',
  'profile.figure.workspace': 'Espaço de trabalho',
  'profile.figure.role': 'Papel',
  'profile.figure.joined': 'Membro desde',
  'profile.figure.joinedUnknown': 'Sem registro',
  'profile.regional.title': 'Datas, dinheiro e unidades',
  'profile.regional.description':
    'Isto vale só para você e passa na frente do padrão do espaço de trabalho. Deixe um como está e ele segue o espaço.',
  'profile.regional.saving': 'Salvando suas preferências',
  'profile.regional.saved': 'Suas preferências estão salvas',
  'profile.regional.saveFailed': 'Suas preferências não foram salvas',
  'profile.language.label': 'Idioma',
  'profile.language.hint':
    'Escolhido em uma tela só dele, onde cada idioma aparece na própria escrita.',
  'profile.language.action': 'Mudar',
  'profile.timezone.label': 'Fuso horário',
  'profile.timezone.hint':
    'Os horários de partida e de chegada aparecem neste fuso.',
  'profile.currency.label': 'Moeda',
  'profile.currency.hint':
    'Viagens novas começam nesta moeda; cada viagem pode trocar.',
  'profile.dateFormat.label': 'Formato de data',
  'profile.weekStart.label': 'A semana começa em',
  'profile.weekStart.hint':
    'Vale para todos os calendários, inclusive a grade anual das férias.',
  'profile.distance.label': 'Distância',

  /* --------------------------------------------------------------- language */
  'language.error': 'Suas configurações de idioma não carregaram',
  'language.section.title': 'Idioma',
  'language.section.description':
    'Cada tela, cada botão e cada data aparecem no idioma que você escolher aqui — vinte e três, cada um escrito na própria escrita.',
  'language.label': 'Escolha um idioma',
  'language.followWorkspace': 'Seguir o espaço de trabalho',
  'language.state.yours': 'Seu idioma',
  'language.state.workspace': 'Vem do espaço de trabalho',
  'language.state.hint.override':
    'É uma escolha sua. Vale só para você, em todos os dispositivos de onde você entrar.',
  'language.state.hint.workspace':
    'Você não tem um idioma próprio, então lê o que o espaço de trabalho estiver usando. Um proprietário ou administrador pode mudar isso em Espaço de trabalho.',
  'language.saved': 'o planned.travel agora fala {language}',
  'language.saveFailed': 'Seu idioma não mudou',
  'language.saveFailedBody':
    'Nada foi perdido e você continua lendo {language}. Confira sua conexão e escolha de novo.',
  'language.reload.title': 'Seu idioma está salvo',
  'language.reload.body':
    'Esta página não conseguiu terminar de mudar para {language}. Recarregue para ler o produto no idioma novo.',
  'language.sample.title': 'Como datas e números vão aparecer',
  'language.sample.description':
    'Os mesmos três valores, escritos como este idioma escreve.',
  'language.sample.date': 'Uma data',
  'language.sample.number': 'Um número',
  'language.sample.money': 'Um valor',
  'language.legal':
    'Os termos e o aviso de privacidade são publicados só em inglês. Todo o resto do produto está traduzido.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'A aparência não carregou',
  'appearance.theme.title': 'Tema',
  'appearance.theme.description':
    'Os dois temas foram desenhados, não invertidos. Fique com o que você lê mais à vontade.',
  'appearance.theme.light': 'Claro',
  'appearance.theme.lightHint': 'Papel quente, o dia inteiro',
  'appearance.theme.dark': 'Escuro',
  'appearance.theme.darkHint': 'Carvão quente, nunca preto',
  'appearance.theme.system': 'Sistema',
  'appearance.theme.systemHint': 'Seguir o aparelho',
  'appearance.theme.showing': 'Agora aparece a paleta {palette}.',
  'appearance.theme.showingSystem':
    'Agora aparece a paleta {palette}, seguindo o seu aparelho.',
  'appearance.palette.light': 'clara',
  'appearance.palette.dark': 'escura',
  'appearance.motion.title': 'Movimento e mapas',
  'appearance.motion.label': 'Reduzir o movimento',
  'appearance.motion.hint':
    'Transforma as animações de entrada em um fade simples. A opção de reduzir movimento do seu sistema também é sempre respeitada.',
  'appearance.map.label': 'Estilo do mapa',
  'appearance.map.hint': 'O mapa base usado no planejador e no mapa-múndi.',
  'appearance.map.workspace': 'Seguir o espaço de trabalho',
  'appearance.map.workspaceHint':
    'O que o proprietário do espaço de trabalho escolheu.',
  'appearance.map.auto': 'Automático',
  'appearance.map.autoHint': 'Segue o seu tema claro ou escuro.',
  'appearance.map.paper': 'Papel',
  'appearance.map.paperHint': 'Quente e claro, seja qual for o seu tema.',
  'appearance.map.charcoal': 'Carvão',
  'appearance.map.charcoalHint': 'Quente e escuro, seja qual for o seu tema.',
  'appearance.map.quiet': 'Discreto',
  'appearance.map.quietHint':
    'Sem nomes de ruas nem de lugares, para os seus alfinetes aparecerem primeiro.',
  'appearance.map.light': 'Papel — claro',
  'appearance.map.dark': 'Carvão — escuro',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Em uma tela compartilhada',
  'appearance.privacy.codesLabel':
    'Ocultar os códigos de confirmação até eu pedir',
  'appearance.privacy.codesHint':
    'As referências de reserva e os números de confirmação ficam mascarados na mesa de reservas e nos transportes até você passar o cursor, focar ou tocar neles. Os preços nunca são ocultados.',
  'appearance.saveFailed': 'Essa mudança não foi guardada',
  'appearance.saveFailedBody':
    'Aqui ela aparece, mas o próximo dispositivo de onde você entrar não vai ter.',

  /* --------------------------------------------------------------- security */
  'security.error': 'A segurança não carregou',
  'security.unverified.title':
    'Seu endereço de e-mail ainda não foi verificado',
  'security.unverified.body':
    'Redefinições de senha e convites de viagem vão para {email}. Verificar é o que prova que o endereço é seu.',
  'security.unverified.action': 'Mandar o link de novo',
  'security.signin.title': 'Acesso',
  'security.signin.description':
    'Como você prova que é você. As duas etapas e as chaves de acesso são mais fortes que uma senha sozinha.',
  'security.email.label': 'Endereço de e-mail',
  'security.email.verified': 'Verificado',
  'security.email.unverified': 'Não verificado',
  'security.password.label': 'Senha',
  'security.password.hint':
    'Mude quando quiser — mandamos um link de uso único em vez de pedir a senha antiga.',
  'security.password.action': 'Mudar a senha',
  'security.twoFactor.label': 'Verificação em duas etapas',
  'security.twoFactor.onHint':
    'Um código do seu aplicativo autenticador é pedido em todo acesso novo.',
  'security.twoFactor.offHint':
    'Some um código de seis dígitos de um aplicativo autenticador à sua senha.',
  'security.twoFactor.on': 'Ligada',
  'security.twoFactor.off': 'Desligada',
  'security.twoFactor.manage': 'Gerenciar',
  'security.twoFactor.enable': 'Ligar',
  'security.passkeys.label': 'Chaves de acesso',
  'security.passkeys.hint':
    'Entre com a digital, com o Face ID ou com uma chave de segurança, sem digitar nada.',
  'security.passkeys.action': 'Gerenciar as chaves de acesso',
  'security.session.title': 'Esta sessão',
  'security.session.description': 'O navegador em que você está lendo isto.',
  'security.session.label': 'Conectado como',
  'security.session.expires': 'Vence {date}',
  'security.session.expiresSoon': 'logo',
  'security.session.noExpiry': 'Nenhum vencimento registrado',
  'security.signOut.label': 'Sair',
  'security.signOut.hint':
    'Encerra esta sessão e leva você de volta à tela de acesso. Os outros dispositivos continuam conectados.',
  'security.signOut.pending': 'Saindo',
  'security.signOut.failed': 'Você não saiu',
  'security.signOut.failedBody': 'Confira sua conexão e tente de novo.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'As configurações de notificação não carregaram',
  'notifications.title': 'Notificações',
  'notifications.description':
    'Cada chave vale só para você. Desligar uma nunca impede o que aconteceu de acontecer — só impede que a gente conte.',
  'notifications.caption': 'Quais notificações chegam em cada canal',
  'notifications.event': 'Evento',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Essa preferência não foi salva',
  'notifications.saveFailedBody':
    'A chave voltou para onde estava. Confira sua conexão e tente de novo.',
  'notifications.channel.in_app': 'No aplicativo',
  'notifications.channel.in_app.hint': 'O sino da barra de cima',
  'notifications.channel.email': 'E-mail',
  'notifications.channel.email.hint': 'Para o endereço com que você entra',
  'notifications.channel.push': 'No celular',
  'notifications.channel.push.hint': 'Nos aparelhos onde você permitiu',
  'notifications.event.trip.invited': 'Convites de viagem',
  'notifications.event.trip.invited.hint':
    'Alguém coloca você em uma viagem que está planejando.',
  'notifications.event.trip.updated': 'Mudanças no roteiro',
  'notifications.event.trip.updated.hint':
    'Um dia, uma parada ou uma data muda em uma viagem sua.',
  'notifications.event.trip.starting_soon': 'Lembretes de partida',
  'notifications.event.trip.starting_soon.hint':
    'Um toque nos dias antes de a viagem começar.',
  'notifications.event.reservation.reminder': 'Lembretes de reserva',
  'notifications.event.reservation.reminder.hint':
    'Uma hospedagem, uma mesa ou um ingresso está chegando.',
  'notifications.event.expense.added': 'Gastos novos',
  'notifications.event.expense.added.hint':
    'Alguém lança dinheiro gasto em uma viagem compartilhada.',
  'notifications.event.expense.settled': 'Contas acertadas',
  'notifications.event.expense.settled.hint':
    'Um saldo do qual você fazia parte foi pago.',
  'notifications.event.list.assigned': 'Itens atribuídos',
  'notifications.event.list.assigned.hint':
    'Algo de uma lista de bagagem ou de tarefas passa a ser seu.',
  'notifications.event.collab.message': 'Conversa da viagem',
  'notifications.event.collab.message.hint':
    'Mensagens novas em uma viagem que você está fazendo.',
  'notifications.event.organization.invited': 'Convites para espaços',
  'notifications.event.organization.invited.hint':
    'Convidam você para um espaço de trabalho.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'O espaço de trabalho não carregou',
  'workspace.summary.description': 'Plano {plan} · criado em {date}',
  'workspace.summary.createdRecently': 'há pouco',
  'workspace.summary.billingAction': 'Plano e pagamento',
  'workspace.seats.label': 'Vagas usadas',
  'workspace.seats.value': '{used} de {limit}',
  'workspace.seats.note':
    'Convites em aberto ocupam vaga, então um espaço nunca passa do plano que paga.',
  'workspace.seatsFull.title': 'Todas as vagas deste plano estão ocupadas',
  'workspace.seatsFull.body':
    '{members} e {invitations} preenchem as {limit} vagas.',
  'workspace.seatsFull.action': 'Adicionar vagas',
  'workspace.members.count': {
    one: '{value} membro',
    many: '{value} membros',
    other: '{value} membros',
  },
  'workspace.invitations.count': {
    one: '{value} convite pendente',
    many: '{value} convites pendentes',
    other: '{value} convites pendentes',
  },
  'workspace.members.title': 'Membros',
  'workspace.members.description':
    'Todo mundo que vê as viagens, as contas e os arquivos deste espaço.',
  'workspace.members.tableLabel': 'Membros deste espaço de trabalho',
  'workspace.members.person': 'Pessoa',
  'workspace.members.role': 'Papel',
  'workspace.members.joined': 'Entrou em',
  'workspace.invitations.title': 'Convites',
  'workspace.invitations.description':
    'Pessoas convidadas que ainda não entraram.',
  'workspace.invitations.emptyTitle': 'Nenhum convite em aberto',
  'workspace.invitations.emptyBody':
    'Todo mundo convidado para este espaço já entrou.',
  'workspace.invitations.expires': 'Vence {date}',
  'workspace.invitations.expiresSoon': 'logo',
  'workspace.defaults.title': 'Padrões comuns',
  'workspace.defaults.description':
    'Com o que uma viagem nova e um membro novo começam. Qualquer pessoa pode mudar isso para si no próprio perfil.',
  'workspace.defaults.readOnly': 'Somente leitura',
  'workspace.defaults.saving': 'Salvando os padrões do espaço',
  'workspace.defaults.saved': 'Os padrões do espaço estão salvos',
  'workspace.defaults.saveFailed': 'Os padrões do espaço não foram salvos',
  'workspace.defaults.saveFailedBody':
    'Só um proprietário ou um administrador pode mudar. Confira sua conexão e tente de novo.',
  'workspace.currency.label': 'Moeda padrão',
  'workspace.currency.hint': 'Viagens novas entram no orçamento nesta moeda.',
  'workspace.language.label': 'Idioma',
  'workspace.language.hint': 'O que lê quem não escolheu um idioma próprio.',
  'workspace.timezone.label': 'Fuso horário',
  'workspace.dateFormat.label': 'Formato de data',
  'workspace.weekStart.label': 'A semana começa em',
  'workspace.distance.label': 'Distância',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'O pagamento não carregou',
  'billing.loading': 'Carregando o plano e os recibos',
  'billing.status.none': 'Sem assinatura',
  'billing.status.trialing': 'Teste',
  'billing.status.active': 'Ativa',
  'billing.status.past_due': 'Pagamento recusado',
  'billing.status.unpaid': 'Não paga',
  'billing.status.paused': 'Pausada',
  'billing.status.canceled': 'Cancelada',
  'billing.status.incomplete': 'Incompleta',
  'billing.status.incomplete_expired': 'Vencida',

  'billing.checkout.completeTitle': 'Pagamento recebido',
  'billing.checkout.completeBody':
    'Seu plano novo está sendo aplicado. Ele aparece aqui assim que a Polar confirmar — em geral em poucos segundos.',
  'billing.checkout.cancelledTitle': 'Pagamento cancelado',
  'billing.checkout.cancelledBody': 'Nada foi cobrado e seu plano não mudou.',
  'billing.portal.backTitle': 'De volta da Polar',
  'billing.portal.backBody':
    'O que você mudou lá chega aqui assim que a Polar confirmar.',
  'billing.refresh': 'Atualizar',
  'billing.readOnly.title': 'Você é membro deste espaço de trabalho',
  'billing.readOnly.body':
    'Só um proprietário ou um administrador pode mexer na assinatura. Para você, tudo abaixo é somente leitura.',

  'billing.hero.label': 'Plano atual',
  'billing.hero.endsAtPeriod': 'Termina no fim do período',
  'billing.hero.perYear': '/ ano',
  'billing.hero.perMonth': '/ mês',
  'billing.hero.freeAllowance': '{trips} viagens, um viajante',
  'billing.hero.perSeatLine': '{seats} membros × {price}',
  'billing.hero.singleTraveller': 'Um viajante',
  'billing.price.free': 'Grátis',
  'billing.provider.opening': 'Abrindo a Polar',
  'billing.renewal.trialEndsToday':
    'Seu teste termina hoje. A primeira cobrança vem em seguida, a menos que você cancele antes.',
  'billing.renewal.trialEndsIn': {
    one: 'Seu teste termina em {value} dia e depois vem a primeira cobrança, a menos que você cancele antes.',
    many: 'Seu teste termina em {value} dias e depois vem a primeira cobrança, a menos que você cancele antes.',
    other:
      'Seu teste termina em {value} dias e depois vem a primeira cobrança, a menos que você cancele antes.',
  },
  'billing.renewal.trialEnded': 'Seu teste terminou.',
  'billing.renewal.endsNoDate':
    'Este plano está marcado para terminar e não vai renovar.',
  'billing.renewal.endsOn':
    'Este plano termina em {date}. Nada é apagado — os módulos pagos apenas travam.',
  'billing.renewal.pastDue':
    'O último pagamento não passou. Atualize o cartão para não perder os módulos pagos.',
  'billing.renewal.unpaid':
    'Esta assinatura está sem pagamento e os módulos pagos estão travados.',
  'billing.renewal.paused':
    'Esta assinatura está pausada. Retome quando estiver pronto para viajar de novo.',
  'billing.renewal.lapsed':
    'Escolha um plano abaixo para destravar de novo as reservas, o diário e os mapas offline.',
  'billing.renewal.incomplete':
    'A Polar ainda espera a confirmação deste pagamento.',
  'billing.renewal.free':
    'Duas viagens por vez, por nossa conta. Mude de plano quando ficar apertado.',
  'billing.renewal.auto': 'Renova sozinho.',
  'billing.renewal.renewsOn': 'Renova em {date}.',

  'billing.usage.title': 'Uso',
  'billing.usage.description':
    'Contado ao vivo, então nenhum medidor fica velho. Os limites seguem o plano em vigor agora.',
  'billing.quota.seats': 'Membros',
  'billing.quota.trips': 'Viagens',
  'billing.quota.storageBytes': 'Armazenamento',
  'billing.quota.unlimited': 'Ilimitado',
  'billing.quota.noLimit': 'Este plano não põe limite',
  'billing.quota.used': '{quota} em uso',
  'billing.quota.over.seats': {
    one: '{value} vaga acima do limite deste plano',
    many: '{value} vagas acima do limite deste plano',
    other: '{value} vagas acima do limite deste plano',
  },
  'billing.quota.over.trips': {
    one: '{value} espaço de viagem acima do limite deste plano',
    many: '{value} espaços de viagem acima do limite deste plano',
    other: '{value} espaços de viagem acima do limite deste plano',
  },
  'billing.quota.over.storage': '{value} acima do limite deste plano',
  'billing.quota.exhausted.seats': 'Todas as vagas deste plano estão ocupadas',
  'billing.quota.exhausted.trips':
    'Todos os espaços de viagem deste plano estão em uso',
  'billing.quota.exhausted.storage': 'O armazenamento deste plano está cheio',
  'billing.quota.left': 'Resta {value}',

  'billing.plans.title': 'Planos',
  'billing.plans.description':
    'Mude de plano quando quiser. Subir de plano é calculado por dia; descer espera o fim do período que você já pagou.',
  'billing.interval.label': 'Período de cobrança',
  'billing.interval.monthly': 'Mensal',
  'billing.interval.yearly': 'Anual',
  'billing.plan.free.name': 'Grátis',
  'billing.plan.free.tagline': 'Planeje suas duas próximas viagens',
  'billing.plan.free.feature.trips': 'Duas viagens por vez',
  'billing.plan.free.feature.itinerary': 'Roteiro dia a dia e mapa',
  'billing.plan.free.feature.lists': 'Listas de bagagem e orçamentos simples',
  'billing.plan.free.feature.atlas':
    'O mapa-múndi que marca onde você já esteve',
  'billing.plan.solo.name': 'Sozinho',
  'billing.plan.solo.tagline': 'Para quem planeja tudo',
  'billing.plan.solo.feature.trips': 'Viagens sem limite',
  'billing.plan.solo.feature.modules':
    'Todos os módulos — reservas, diário, orçamentos, bagagem',
  'billing.plan.solo.feature.offline':
    'Mapas offline para baixar antes de embarcar',
  'billing.plan.solo.feature.export': 'Exportação em PDF e para o calendário',
  'billing.plan.crew.name': 'Em grupo',
  'billing.plan.crew.tagline': 'Para famílias, amigos e times pequenos',
  'billing.plan.crew.feature.members': 'Até dez membros, cobrados por pessoa',
  'billing.plan.crew.feature.realtime':
    'Colaboração ao vivo, com os cursores de todo mundo',
  'billing.plan.crew.feature.everything':
    'Viagens sem limite e todos os módulos',
  'billing.plan.crew.feature.storage':
    'Espaço compartilhado para as fotos e os documentos de todo mundo',

  'billing.plan.current': 'Plano atual',
  'billing.plan.currentBadge': 'Atual',
  'billing.plan.popular': 'O mais escolhido',
  'billing.plan.switchYearly': 'Mudar para anual',
  'billing.plan.switchMonthly': 'Mudar para mensal',
  'billing.plan.upgradeTo': 'Subir para {plan}',
  'billing.plan.changeTo': 'Trocar para {plan}',
  'billing.plan.perMemberMonth': '/ membro / mês',
  'billing.plan.perMonth': '/ mês',
  'billing.plan.alwaysFree': 'Sempre grátis, sem cartão',
  'billing.plan.billedYearly': '{amount} por ano',
  'billing.plan.billedMonthly': '{amount} por mês',
  'billing.plan.members': 'Membros',
  'billing.plan.membersHint': 'Mude quando quiser — a cobrança acompanha.',
  'billing.plan.seatOption': {
    one: '{value} membro',
    many: '{value} membros',
    other: '{value} membros',
  },

  'billing.invoices.number': 'Fatura',
  'billing.invoices.date': 'Data',
  'billing.invoices.amount': 'Valor',
  'billing.invoices.status': 'Situação',
  'billing.invoice.paid': 'Paga',
  'billing.invoice.draft': 'Rascunho',
  'billing.invoice.void': 'Anulada',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'O provedor de pagamento recusou essa solicitação. Tente de novo em um instante.',
  'billing.planChanged.title': 'Plano atualizado',
  'billing.planChanged.body':
    'A mudança já vale na Polar, que vai faturar a diferença. O resumo abaixo se atualiza em até um minuto.',
  'billing.hero.manage': 'Gerenciar cobrança',
  'billing.hero.manageHint':
    'Cartões, endereço de cobrança, CNPJ, recibos e cancelamento ficam na Polar, que emite a nota.',
  'billing.hero.manageHintNone':
    'Ainda não há perfil de cobrança. Escolher um plano pago abaixo cria um, e daí em diante o portal abre.',
  'billing.portal.opening': 'Abrindo o portal de cobrança',
  'billing.plan.notApplied': 'Essa mudança não foi aplicada',
  'billing.plan.cancelInPortal': 'Cancelar no portal',
  'billing.plan.seatsOverMax': {
    one: 'Este espaço tem {members} membros e o {plan} cobra no máximo {max}. Remova {value} membro antes de trocar.',
    many: 'Este espaço tem {members} membros e o {plan} cobra no máximo {max}. Remova {value} membros antes de trocar.',
    other:
      'Este espaço tem {members} membros e o {plan} cobra no máximo {max}. Remova {value} membros antes de trocar.',
  },
  'billing.plan.seatsBelowMembers':
    'Você tem {members} membros. Escolha ao menos essa quantidade de assentos: a Polar recusa uma assinatura com menos assentos do que atribuições.',
  'billing.orders.title': 'Pedidos',
  'billing.orders.description':
    'Todos os pedidos deste espaço, do mais recente ao mais antigo.',
  'billing.orders.receipts': 'Todos os recibos',
  'billing.orders.unavailableTitle': 'Os pedidos não estão carregando',
  'billing.orders.unavailableBody':
    'A Polar não respondeu a tempo para o histórico. Tudo acima está atualizado — tente em um instante ou veja o registro completo no portal de cobrança.',
  'billing.orders.emptyTitle': 'Nenhum pedido ainda',
  'billing.orders.emptyCustomer':
    'A primeira fatura aparece aqui assim que um período de cobrança fecha.',
  'billing.orders.emptyNoCustomer':
    'Este espaço nunca foi cobrado. Escolha um plano pago e as faturas se juntam aqui.',
  'billing.orders.tableLabel': 'Histórico de pedidos',
  'billing.orders.document': 'Documento',
  'billing.orders.dateUnknown': 'Data desconhecida',
  'billing.order.pending': 'Pendente',
  'billing.order.refunded': 'Reembolsado',
  'billing.order.partiallyRefunded': 'Reembolsado em parte',
  'billing.order.noInvoiceDraft':
    'Sem fatura enquanto o pedido for um rascunho',
  'billing.order.preparing': 'Preparando',
  'billing.order.renderingHint':
    'A Polar ainda está gerando a fatura {number}. O download volta em alguns segundos.',
  'billing.order.fetching': 'Buscando a fatura',
  'billing.order.generating': 'A Polar está preparando a fatura',
  'billing.order.pdfLabel': 'Fatura {number} em PDF',
  'billing.order.stillWritingTitle':
    'A Polar ainda está escrevendo essa fatura',
  'billing.order.stillWritingBody':
    'A fatura {number} está sendo gerada. O download volta sozinho em alguns segundos.',
  'billing.order.openFailed': 'Essa fatura não abriu',
} satisfies TranslationOf<typeof En>

export default messages
