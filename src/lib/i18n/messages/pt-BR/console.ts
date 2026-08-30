/**
 * Tudo o que o console da plataforma diz, em português do Brasil.
 *
 * Escrito a partir de `../en/console.ts` (`docs/SPEC.md` §9). O arquivo em inglês é o esquema:
 * `TranslationOf<typeof En>` transforma uma chave ausente ou inventada em erro de compilação, e
 * `__tests__/parity.test.ts` confere os marcadores, os ramos de plural e que aqui não sobre nada
 * em inglês.
 *
 * **Registro.** «Você» com o verbo na terceira pessoa, como no resto do catálogo brasileiro.
 *
 * **Plural.** `Intl.PluralRules('pt-BR')` informa `one`, `many` e `other`; `many` é o ramo CLDR
 * dos milhões e concorda como `other`.
 *
 * **Duas escalas de papéis que nunca se misturam** (§5). Na plataforma: administrador, curador,
 * usuário. No espaço de trabalho: dono, administrador, membro. A mesma palavra cai nas duas, então
 * quem carrega a diferença é a frase em volta.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------- seções -- */

  'nav.label': 'Seções do console',
  'nav.overview': 'Visão geral',
  'nav.overview.description': 'A plataforma num relance',
  'nav.accounts': 'Contas',
  'nav.accounts.description': 'Papéis, suspensões e sessões',
  'nav.runs': 'Execuções de agentes',
  'nav.runs.description': 'O que a frota sandcastle está construindo',

  /* -------------------------------------------------------------- casca -- */

  'shell.eyebrow': 'Plataforma',
  'shell.title': 'Console da plataforma',
  'shell.description': 'O produto em si — contas, poderes e o catálogo comum',
  'shell.signedInAs': 'Conectado como',
  'shell.error.title': 'O console não carregou',
  'shell.notFound.title': 'Nenhuma conta com esse identificador',
  'shell.notFound.body':
    'Nada na plataforma carrega esse identificador. A conta pode ter sido excluída depois que o link foi criado, ou o endereço pode ter sido copiado errado.',
  'shell.allAccounts': 'Todas as contas',
  'shell.overview': 'Visão geral do console',

  'failure.fallback': 'A ação não passou. Tente de novo daqui a pouco.',

  /* -------------------------------------------------------- visão geral -- */

  'overview.error.title': 'A visão geral não carregou',
  'overview.standing.title': 'Os seus poderes na plataforma',
  'overview.standing.body':
    'Contas, sessões e agir em nome de outra pessoa pertencem a um administrador da plataforma, então o console mostra a você o catálogo e nada além disso.',
  'overview.stat.accounts': 'Contas',
  'overview.stat.accounts.caption': {
    one: 'Uma delas carrega um papel de plataforma',
    many: '{staff} delas carregam um papel de plataforma',
    other: '{staff} delas carregam um papel de plataforma',
  },
  'overview.stat.admins': 'Administradores',
  'overview.stat.admins.caption': 'Poder inteiro sobre contas e sessões',
  'overview.stat.curators': 'Curadores',
  'overview.stat.curators.caption': 'Só o catálogo — nunca as contas',
  'overview.stat.suspended': 'Suspensas',
  'overview.stat.suspended.none': 'Ninguém está trancado do lado de fora',
  'overview.stat.suspended.some':
    'Desconectadas em todo lugar até que a suspensão seja levantada',
  'overview.stat.suspended.review': 'Ver quais são',
  'overview.newest.label': 'Contas mais novas',
  'overview.newest.empty.title': 'Ainda não há contas',
  'overview.newest.empty.body':
    'A primeira pessoa a se cadastrar aparece aqui.',
  'overview.catalogue.label': 'Catálogo por situação',
  'overview.catalogue.empty.title': 'O catálogo comum ainda não está aberto',
  'overview.catalogue.empty.body':
    'Assim que a esteira de ingestão entrar no ar, este painel vai contar cada lugar do catálogo comum como rascunho, em revisão ou publicado — e cada número abre a lista que está por trás.',
  'overview.scraping.label': 'Rodadas de coleta',
  'overview.scraping.empty.title': 'Nenhuma fonte foi executada',
  'overview.scraping.empty.body':
    'As fontes são coletadas toda semana. Quando a primeira rodada terminar, as cinco últimas aparecem aqui com o que cada uma ingeriu, mudou e descartou.',

  /* ------------------------------------------------- a escala de papéis -- */

  'role.admin': 'Administrador',
  'role.admin.summary':
    'Poder inteiro na plataforma: contas, papéis, suspensões, sessões e agir em nome de outra pessoa.',
  'role.admin.holds.accounts': 'Criar contas e definir papéis de plataforma',
  'role.admin.holds.bans': 'Suspender contas e levantar suspensões',
  'role.admin.holds.sessions': 'Revogar sessões e definir senhas',
  'role.admin.holds.impersonate':
    'Agir em nome de uma conta por quinze minutos',
  'role.admin.holds.curation': 'Tudo o que um curador pode fazer',
  'role.admin.withheld.admins':
    'Agir em nome de outro administrador da plataforma',
  'role.curator': 'Curador',
  'role.curator.summary':
    'O catálogo, as coletâneas, as fontes e a moderação de links compartilhados. Nada que toque nas contas.',
  'role.curator.holds.places': 'Ler, escrever e publicar lugares do catálogo',
  'role.curator.holds.packs': 'Ler, escrever e publicar coletâneas de lugares',
  'role.curator.holds.sources': 'Ler e executar fontes do catálogo',
  'role.curator.holds.shares': 'Revisar e revogar links compartilhados',
  'role.curator.withheld.accounts':
    'Qualquer coisa que toque numa conta ou numa sessão',
  'role.curator.withheld.tokens': 'Emitir ou revogar credenciais de máquina',
  'role.user': 'Usuário',
  'role.user.summary': 'Nenhum poder na plataforma. É quase todo mundo.',
  'role.user.withheld.everything': 'Todo poder da plataforma, sem exceção',

  /* ------------------------------------------------------------ uma conta -- */

  'identity.you': 'É você',
  'status.active': 'Ativa',
  'status.suspended': 'Suspensa',
  'status.permanent': 'Por tempo indeterminado',
  'status.until': 'Até {date}',
  'status.unverified': 'Não verificado',
  'device.on': '{browser} no {platform}',
  'device.unrecognised': 'Aparelho não reconhecido',

  /* ---------------------------------------------------- lista de contas -- */

  'users.error.title': 'A lista de contas não carregou',
  'users.total': '{total} no total',
  'users.loading': 'Carregando as contas',
  'users.table.label': 'Contas da plataforma',
  'users.search.label': 'Buscar contas',
  'users.search.email': 'Buscar nos endereços de e-mail',
  'users.search.name': 'Buscar nos nomes',
  'users.search.column': 'Em qual coluna buscar',
  'users.search.submit': 'Buscar',
  'users.field.email': 'E-mail',
  'users.field.name': 'Nome',
  'users.filter.role.label': 'Filtrar por papel de plataforma',
  'users.filter.role.any': 'Qualquer papel',
  'users.filter.role.admin': 'Administradores',
  'users.filter.role.curator': 'Curadores',
  'users.filter.status.label': 'Filtrar pela situação da conta',
  'users.filter.status.any': 'Qualquer situação',
  'users.filter.clear': 'Limpar os filtros',
  'users.filter.hint': 'Estreite por papel ou por situação — um de cada vez.',
  'users.column.account': 'Conta',
  'users.column.role': 'Papel de plataforma',
  'users.column.status': 'Situação',
  'users.column.joined': 'Entrada',
  'users.column.actions': 'Ações',
  'users.joined': 'Entrou em {date}',
  'users.pastEnd.title': 'Essa página está além do fim',
  'users.pastEnd.body': {
    one: 'Nesta visão há uma conta, e a página 1 é a única que ela tem.',
    many: 'Nesta visão há {total} contas, ou seja, {pages}. A página {page} está além.',
    other:
      'Nesta visão há {total} contas, ou seja, {pages}. A página {page} está além.',
  },
  'users.pastEnd.pages': {
    one: 'uma única página',
    many: '{pages} páginas',
    other: '{pages} páginas',
  },
  'users.pastEnd.back': 'Voltar para a primeira página',
  'users.empty.filtered.title': 'Nada combina com esses filtros',
  'users.empty.filtered.body':
    'Nenhuma conta da plataforma responde a esta busca. Alargue a busca, ou limpe os filtros para ver todo mundo.',
  'users.empty.title': 'Nenhuma conta para mostrar',
  'users.empty.body':
    'Esta visão está vazia. Nada está filtrado, então não há o que alargar aqui.',

  /* --------------------------------------------------- página da conta -- */

  'account.error.title': 'Essa conta não carregou',
  'account.loading': 'Carregando a conta',
  'account.meta.lastChange': 'Última mudança',
  'account.meta.id': 'Identificador da conta',
  'account.banned.title': 'Esta conta está suspensa',
  'account.banned.noReason': 'Nenhum motivo foi anotado junto com a suspensão.',
  'account.banned.permanent':
    ' Continua valendo até que um administrador a levante.',
  'account.banned.until': ' Ela se levanta sozinha em {date}.',
  'account.banned.untilUnknown': 'a data de vencimento dela',
  'account.authority.label': 'Poderes na plataforma',
  'account.authority.may': 'Pode',
  'account.authority.mayNot': 'Não pode',
  'account.authority.none': 'Nada na plataforma.',
  'account.workspaces.label': 'Espaços de trabalho',
  'account.workspaces.truncated':
    'Esta conta pertence a mais espaços de trabalho do que os {listed} listados aqui.',
  'account.workspaces.empty.title': 'Em nenhum espaço de trabalho',
  'account.workspaces.empty.body':
    'Esta conta ainda não pertence a nenhum espaço de trabalho. Um é criado na primeira vez que ela entra, e todo espaço para o qual for convidada aparece aqui.',
  'account.workspaces.column.workspace': 'Espaço de trabalho',
  'account.workspaces.column.role': 'Papel',
  'account.workspaces.column.plan': 'Plano',
  'account.subscription.label': 'Assinatura',
  'account.subscription.free.title': 'No plano grátis',
  'account.subscription.free.body':
    'O espaço de trabalho de que esta conta é dona nunca passou pelo caixa, então não carrega registro de assinatura e roda nas cotas do plano grátis.',
  'account.subscription.none.title': 'Nada é cobrado desta conta',
  'account.subscription.none.body':
    'Esta conta não é dona de nenhum espaço de trabalho. Ser membro do espaço de outra pessoa não é ser quem esse espaço cobra, então não há nada a recolher aqui.',
  'account.subscription.endsAtClose': 'Termina no fechamento do período',
  'account.subscription.seats': 'Lugares',
  'account.subscription.seatsValue': '{used} de {limit}',
  'account.subscription.ends': 'Termina',
  'account.subscription.renews': 'Renova',
  'account.sessions.label': 'Sessões vivas',
  'account.sessions.truncated':
    'Esta conta segura mais sessões do que uma chamada lista. Revogue todas as sessões pelo menu de ações para ter certeza de que não sobrou nenhuma.',
  'account.sessions.empty.title': 'Desconectada em todo lugar',
  'account.sessions.empty.body':
    'Esta conta não segura nenhuma sessão que não tenha expirado. Ela aparece aqui no momento em que entrar de novo.',
  'account.sessions.column.device': 'Aparelho',
  'account.sessions.column.address': 'Endereço',
  'account.sessions.column.started': 'Início',
  'account.sessions.column.expires': 'Expira',
  'account.sessions.impersonated': 'Nascida de agir em nome da conta',
  'account.sessions.noAddress': 'Não anotado',
  'account.sessions.noAddressLong': 'Endereço não anotado',
  'account.sessions.when': 'Início {started} · expira {expires}',
  'account.audit.label': 'Histórico de auditoria',
  'account.audit.truncated':
    'O registro guarda mais entradas do que estas. A trilha de auditoria da plataforma só aceita acréscimos e fica guardada por quatrocentos dias.',
  'account.audit.empty.title': 'Nada foi feito com esta conta',
  'account.audit.empty.body':
    'Toda mudança de papel, suspensão, senha definida, sessão revogada e ação em nome da conta é escrita aqui com o nome de quem fez. Nesta aqui ninguém mexeu.',

  /* ------------------------------- a escala do espaço de trabalho -- */

  'workspace.role.owner': 'Dono',
  'workspace.role.admin': 'Administrador',
  'workspace.role.member': 'Membro',
  'plan.free': 'Grátis',
  'plan.starter': 'Inicial',
  'plan.pro': 'Profissional',
  'plan.business': 'Empresarial',
  'subscription.trialing': 'Em teste',
  'subscription.active': 'Ativa',
  'subscription.pastDue': 'Em atraso',
  'subscription.canceled': 'Cancelada',
  'subscription.incomplete': 'Incompleta',
  'subscription.expired': 'Expirada',
  'subscription.unpaid': 'Não paga',
  'subscription.paused': 'Pausada',

  /* ------------------------------------------------ registro de auditoria -- */

  'audit.action.created': 'Conta criada',
  'audit.action.updated': 'Dados da conta mudados',
  'audit.action.roleChanged': 'Papel de plataforma mudado',
  'audit.action.banned': 'Conta suspensa',
  'audit.action.unbanned': 'Suspensão levantada',
  'audit.action.deleted': 'Conta excluída',
  'audit.action.passwordSet': 'Senha definida por um administrador',
  'audit.action.emailSet': 'Endereço de e-mail mudado',
  'audit.action.impersonationStarted': 'Começou a agir em nome da conta',
  'audit.action.impersonationEnded': 'Parou de agir em nome da conta',
  'audit.action.sessionRevoked': 'Uma sessão foi revogada',
  'audit.action.sessionRevokedAll': 'Todas as sessões foram revogadas',
  'audit.actor.system': 'A própria plataforma',
  'audit.actor.system.detail': 'automático',
  'audit.actor.agent': 'Uma credencial de máquina',
  'audit.actor.agent.detail': 'token MCP',
  'audit.actor.deleted': 'Uma conta excluída',
  'audit.actorBadge': 'Na época: {role}',
  'audit.field.name': 'Nome',
  'audit.field.email': 'Endereço de e-mail',
  'audit.field.emailVerified': 'E-mail verificado',
  'audit.field.role': 'Papel de plataforma',
  'audit.field.banned': 'Suspensa',
  'audit.field.banReason': 'Motivo',
  'audit.field.banExpiresAt': 'Fim da suspensão',
  'audit.field.revoked': 'Sessões encerradas',
  'audit.field.impersonating': 'Agindo como',
  'audit.field.impersonatedBy': 'Agida por',
  'audit.field.expiresAt': 'A sessão expira',
  'audit.field.targetRole': 'O papel de plataforma dela',
  'audit.field.sessionId': 'Sessão',
  'audit.value.yes': 'sim',
  'audit.value.no': 'não',
  'audit.value.cleared': 'esvaziado',
  'audit.became': 'virou',

  /* ------------------------------------------------------------- diálogos -- */

  'dialog.cancel': 'Cancelar',

  'create.button': 'Nova conta',
  'create.title': 'Criar uma conta',
  'create.body':
    'O endereço não é verificado e nenhuma mensagem sai — entregue a senha você mesmo.',
  'create.confirm': 'Criar conta',
  'create.name.placeholder': 'Marina Ribeiro',
  'create.email': 'Endereço de e-mail',
  'create.email.placeholder': 'marina@planned.travel',
  'create.password': 'Senha',
  'create.password.hint':
    'Longa o bastante para ser uma frase. A conta pode trocar depois.',
  'create.done': 'Conta criada',
  'create.done.body': '{email} pode entrar com a senha que você definiu.',

  'action.menu.label': 'Ações para {name}',
  'action.group.account': 'Conta',
  'action.group.credentials': 'Credenciais',

  'action.role.item': 'Mudar o papel de plataforma',
  'action.role.self':
    'Não na sua própria conta — rebaixar a si mesmo pode deixar a plataforma sem administrador.',
  'action.role.body':
    'O que {name} pode fazer na plataforma em si. Pertencer a um espaço de trabalho é um vocabulário à parte e não se mexe.',
  'action.role.confirm': 'Salvar o papel',
  'action.role.current': 'Atual',
  'action.role.done': 'Papel de plataforma atualizado',
  'action.role.done.body': '{name} agora carrega o papel {role} na plataforma.',

  'action.impersonate.item': 'Agir em nome da conta',
  'action.impersonate.self':
    'Não há ninguém em quem se tornar — esta é a sua própria conta.',
  'action.impersonate.banned':
    'A conta está suspensa, então não segura nenhuma sessão para vestir.',
  'action.impersonate.admin':
    'Nenhum papel na plataforma pode agir em nome de um administrador, nem o seu.',
  'action.impersonate.title': 'Agir como {name}',
  'action.impersonate.body':
    'Você verá o produto exatamente como esta conta vê, por quinze minutos.',
  'action.impersonate.confirm': 'Começar',
  'action.impersonate.note.bar':
    'Uma barra de aviso fica em toda tela até você encerrar, e não dá para fechá-la.',
  'action.impersonate.note.platform':
    'As ações de plataforma ficam indisponíveis enquanto você age em nome de outra pessoa — inclusive o console.',
  'action.impersonate.note.audit':
    'O começo e o fim são os dois escritos na trilha de auditoria da plataforma, com o seu nome neles.',

  'action.password.item': 'Definir uma senha',
  'action.password.title': 'Definir uma senha para {name}',
  'action.password.body':
    'Use isto para recuperar uma conta trancada do lado de fora ou para cortar o acesso de um invasor numa conta comprometida.',
  'action.password.confirm': 'Definir a senha',
  'action.password.field': 'Nova senha',
  'action.password.hint.self':
    'Toda sessão termina quando isto é feito — inclusive a sua.',
  'action.password.hint':
    'Toda sessão que a conta segura termina quando isto é feito.',
  'action.password.done': 'Senha definida',
  'action.password.done.body': '{name} foi desconectado de todos os aparelhos.',

  'action.sessions.item': 'Revogar todas as sessões',
  'action.sessions.body.self':
    'Isto desconecta você de todos os aparelhos, inclusive daquele em que está lendo isto.',
  'action.sessions.body':
    '{name} é desconectado de todos os aparelhos e terá de entrar de novo.',
  'action.sessions.confirm': 'Revogar as sessões',
  'action.sessions.done': 'Sessões revogadas',
  'action.sessions.done.body': {
    one: 'Uma sessão foi encerrada.',
    many: '{revoked} sessões foram encerradas.',
    other: '{revoked} sessões foram encerradas.',
  },

  'action.ban.item': 'Suspender a conta',
  'action.ban.self':
    'Não na sua própria conta — suspender a si mesmo tira o seu caminho de volta.',
  'action.ban.title': 'Suspender {name}',
  'action.ban.body':
    'Toda sessão termina na hora e a conta não consegue entrar de novo até que a suspensão seja levantada ou vença.',
  'action.ban.confirm': 'Suspender conta',
  'action.ban.reason': 'Motivo',
  'action.ban.reason.hint':
    'Guardado por treze meses na trilha de auditoria da plataforma, e mostrado a ninguém além de um administrador.',
  'action.ban.reason.placeholder':
    'Denúncias de abuso repetidas vindas de três espaços de trabalho',
  'action.ban.duration': 'Duração',
  'action.ban.duration.label': 'Duração da suspensão',
  'action.ban.duration.permanent.body':
    'Continua valendo até que um administrador a levante de propósito.',
  'action.ban.duration.day': '24 horas',
  'action.ban.duration.day.body':
    'Longo o bastante para interromper, curto o bastante para ser uma intervenção.',
  'action.ban.duration.week': '7 dias',
  'action.ban.duration.week.body': 'Uma semana para responder a uma queixa.',
  'action.ban.duration.month': '30 dias',
  'action.ban.duration.month.body': 'Um mês de silêncio forçado.',
  'action.ban.duration.quarter': '90 dias',
  'action.ban.duration.quarter.body':
    'O mais longo que o console oferece. Além disso, suspenda por tempo indeterminado.',
  'action.ban.done': 'Conta suspensa',
  'action.ban.done.body':
    '{name} foi desconectado em todo lugar e não consegue entrar de novo.',

  'action.unban.item': 'Levantar a suspensão',
  'action.unban.title': 'Levantar a suspensão de {name}',
  'action.unban.body':
    'A conta consegue entrar de novo já na próxima tentativa. Nenhuma sessão anterior é devolvida.',
  'action.unban.confirm': 'Levantar a suspensão',
  'action.unban.done': 'Suspensão levantada',
  'action.unban.done.body':
    '{name} consegue entrar de novo. Nenhuma sessão foi devolvida.',

  'action.delete.item': 'Excluir a conta',
  'action.delete.self': 'Não na sua própria conta — de lá não se volta.',
  'action.delete.title': 'Excluir {name}',
  'action.delete.body':
    'A conta, as sessões dela e toda credencial presa a ela são removidas. Isto não dá para desfazer.',
  'action.delete.confirm': 'Excluir conta',
  'action.delete.note':
    'O conteúdo de espaço de trabalho que esta pessoa criou fica com o espaço que é dono dele. Suspender a conta em vez de excluir guarda o registro e tira o acesso.',
  'action.delete.done': 'Conta excluída',
  'action.delete.done.body':
    '{name} e tudo o que estava preso à conta se foram.',

  'session.revoke.label': 'Encerrar a sessão em {device}',
  'session.revoke.title': 'Encerrar esta sessão',
  'session.revoke.body':
    '{device} terá de entrar de novo na próxima requisição. Se for a sessão em que você está lendo isto, você é desconectado junto.',
  'session.revoke.confirm': 'Encerrar a sessão',
  'session.revoke.done': 'Sessão encerrada',
  'session.revoke.done.body':
    'O aparelho terá de entrar de novo na próxima requisição.',

  /* ---------------------------------------------- execuções de agentes -- */

  'runs.error.title': 'O registro de execuções não respondeu',
  'runs.origin.local': 'Máquina local',
  'runs.origin.githubActions': 'Ações do GitHub',
  'runs.stat.live': 'Execuções vivas',
  'runs.stat.live.none': 'Nada está sendo construído agora',
  'runs.stat.live.some': 'Batendo contra um aluguel de cinco minutos',
  'runs.stat.issues': 'Chamados segurados',
  'runs.stat.issues.caption':
    'Alugados a uma execução cada, com ancestrais e subchamados',
  'runs.stat.orphans': 'Ramos órfãos',
  'runs.stat.orphans.none': 'Nenhum trabalho está largado sem dono',
  'runs.stat.orphans.some':
    'Commits de uma execução que parou, esperando ser adotados',
  'runs.live.empty.title': 'Nenhuma execução está registrada',
  'runs.live.empty.body':
    'Uma execução aparece aqui no momento em que se registra — desta máquina, de outra, ou de um executor do GitHub — com os chamados que ela tomou.',
  'runs.holds.nothing': 'não segura nada',
  'runs.holds': 'segura {issues}',
  'runs.uptime': '{elapsed} no ar · {lease}',
  'runs.lease.expired': 'vencido',
  'runs.lease.left': 'faltam {elapsed}',
  'runs.wip.label': 'Trabalho em andamento',
  'runs.wip.empty.title': 'Nenhum ramo está carregando trabalho',
  'runs.wip.empty.body':
    'Uma execução anota o ramo dela assim que tem commits nele, para que, se a execução morrer, a próxima a tomar o chamado receba o trabalho em vez de começar de novo.',
  'runs.wip.orphaned': 'Órfão',
  'runs.wip.meta': {
    one: '{commits} commit · há {elapsed}',
    many: '{commits} commits · há {elapsed}',
    other: '{commits} commits · há {elapsed}',
  },
  'runs.recent.label': 'Terminadas há pouco',
  'runs.recent.empty.title': 'Nenhuma execução terminou ainda',
  'runs.recent.empty.body':
    'As cinquenta últimas execuções ficam guardadas aqui com o jeito que cada uma terminou.',
  'runs.ago': 'há {elapsed}',
  'runs.notCoordinator.title': 'Esta implantação não coordena a frota',
  'runs.notCoordinator.body':
    'O registro de execuções está ligado só no ambiente de homologação, e de propósito: um segundo registro deixaria duas frotas acreditarem cada uma que segura a fila, que é justamente o que ele existe para impedir. Leia a frota na homologação.',
  'nav.providers': 'Provedores',
  'nav.providers.description': 'Chamadas externas e seus tetos',
  'providers.error.title': 'Não foi possível ler os medidores dos provedores',
  'providers.list.label': 'Serviços',
  'providers.status.planned': 'Não integrado',
  'providers.status.planned.description':
    'Nada chama esse serviço ainda, então não há o que contar. Ele aparece aqui para que um teto seja acordado antes da primeira chamada, e não depois da primeira fatura.',
  'providers.policy.allow': 'Cobra acima do teto',
  'providers.policy.block': 'Recusa ao atingir o teto',
  'providers.badge.blocked': {
    one: 'Uma chamada recusada',
    many: '{calls} chamadas recusadas',
    other: '{calls} chamadas recusadas',
  },
  'providers.limit.none': 'Sem teto acordado · {used} neste mês',
  'providers.limit.value': '{used} de {limit}',
  'providers.limit.window.day': 'Hoje',
  'providers.limit.window.month': 'Neste mês',
  'providers.measuring.none': 'Nada medido ainda',
  'providers.measuring.since': 'Medindo desde {date}',
  'providers.stat.calls': 'Chamadas neste mês',
  'providers.stat.calls.caption': 'Em todos os serviços integrados',
  'providers.stat.errors': 'Chamadas com falha',
  'providers.stat.errors.caption':
    'Também contam como chamadas, porque a maioria dos provedores as cobra',
  'providers.stat.nearLimit': 'Perto de um teto',
  'providers.stat.nearLimit.caption': 'Serviços acima do limiar de aviso',
  'providers.stat.blocked': 'Chamadas recusadas',
  'providers.stat.blocked.none': 'Nada foi recusado',
  'providers.stat.blocked.some': 'Demanda recusada por um teto',
  'providers.forecast.label': 'Previsão',
  'providers.forecast.provider': 'Serviço',
  'providers.forecast.monthEnd': 'Até o fim do mês',
  'providers.forecast.runRate': 'Por mês neste ritmo',
  'providers.forecast.perWorkspace': 'Por espaço de trabalho, por mês',
  'providers.forecast.noWorkspaceTraffic':
    'Sem tráfego de espaços para calcular a média',
  'providers.forecast.window': {
    one: 'Projetado a partir de uma hora de medição.',
    many: 'Projetado a partir de {hours} horas de medição.',
    other: 'Projetado a partir de {hours} horas de medição.',
  },
  'providers.forecast.tooEarly': {
    one: 'Apenas uma hora medida até agora: pouco para projetar. Esticar menos de um dia para um mês seria aritmética, não previsão.',
    many: 'Apenas {hours} horas medidas até agora: pouco para projetar. Esticar menos de um dia para um mês seria aritmética, não previsão.',
    other:
      'Apenas {hours} horas medidas até agora: pouco para projetar. Esticar menos de um dia para um mês seria aritmética, não previsão.',
  },
  'providers.forecast.atWorkspaces': 'Com quantos espaços de trabalho',
  'providers.forecast.callsEach': 'Chamadas por espaço, por mês',
  'providers.forecast.projected': 'Cerca de {calls} chamadas por mês.',
  'providers.workspaces.label': 'Espaços mais ativos',
  'providers.workspaces.platform': 'Plataforma (sem espaço)',
  'providers.workspaces.empty.title': 'Nada atribuído ainda',
  'providers.workspaces.empty.description':
    'Uma chamada feita para um espaço de trabalho é registrada nele. Tarefas agendadas e e-mails da plataforma não pertencem a nenhum e são contados à parte.',
  'providers.readOnly':
    'Você pode ler estes medidores, mas não mover um teto. Alterar um limite ou sua política exige a permissão provider:configure.',
} satisfies TranslationOf<typeof En>

export default messages
