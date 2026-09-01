/**
 * The public pages' copy, in pt-BR.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Tipografia.** O português do Brasil usa “…” nas citações.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Comece grátis',
  'action.signIn': 'Entrar',
  'action.pricing': 'Preços',
  'action.seePricing': 'Ver preços',
  'action.skipToContent': 'Ir para o conteúdo',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — início',
  'nav.onThisPage': 'Nesta página',
  'anchor.planner': 'Planejador',
  'anchor.modules': 'Módulos',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Solte no dia {day}',
  'legal.summaryNote':
    'O resumo está aqui para ser lido. O que vale de verdade é o que vem abaixo.',
  'visual.daysTravelled': 'Dias de viagem',
  'visual.acrossEveryTrip': 'em todas as viagens',
  'visual.mapFilled': '{percent}% do mapa preenchido',
  'visual.previewSummary':
    'Uma prévia do painel do planned.travel: a próxima viagem com as datas, os viajantes e a quantidade de lugares; totais de países visitados, viagens e dias de viagem; um mapa da rota; e as duas próximas reservas.',
  'visual.placesMapped': {
    one: '{value} lugar no mapa',
    many: '{value} lugares no mapa',
    other: '{value} lugares no mapa',
  },
  'visual.splitWays': {
    one: 'sem divisão',
    many: 'dividido entre {value}',
    other: 'dividido entre {value}',
  },
  'visual.tripTotal': 'Total da viagem',
  'visual.paidSplit': '{who} pagou · {split}',
  'visual.nextUp': 'A seguir',
  'visual.ofTotal': '{done} de {total}',
  'visual.awaitingReply': 'Aguardando resposta',
  'visual.upcoming': 'Próximos',
  'visual.days': {
    one: '{value} dia',
    many: '{value} dias',
    other: '{value} dias',
  },
  'visual.places': {
    one: '{value} lugar',
    many: '{value} lugares',
    other: '{value} lugares',
  },
  'visual.transfersLeft': {
    one: 'falta {value} transferência',
    many: 'faltam {value} transferências',
    other: 'faltam {value} transferências',
  },

  'legal.badge.version': 'Versão {version}',
  'legal.badge.effective': 'Em vigor desde {updated}',
  'legal.notice.title': 'Isto é um modelo, não uma orientação jurídica',
  'legal.notice.body':
    'Está escrito em inglês simples para ser um ponto de partida realmente útil para um pequeno serviço de planejamento de viagens, e cada lacuna que uma empresa precisa preencher está destacada. Peça a um advogado qualificado da sua jurisdição para revisar e adaptar antes de você aceitar um único cliente. Nada aqui afirma que o planned.travel tenha qualquer certificação, auditoria ou padrão de conformidade.',
  'legal.contents': 'Conteúdo',
  'legal.shortVersion': 'A versão curta',
  'legal.both': 'Os dois documentos se aplicam juntos.',

  'landing.plans.title': 'Comece de graça. Pague só quando merecer.',
  'landing.plans.lede':
    'Todo plano inclui o planejador diário, o mapa, os orçamentos e as listas de bagagem. Os planos pagos - a partir de {price} por mês - liberam viagens ilimitadas, reservas, o diário, mapas offline e exportações.',
  'landing.plans.ledeFree':
    'Todo plano inclui o planejador diário, o mapa, os orçamentos e as listas de bagagem. Os planos pagos liberam viagens ilimitadas, reservas, o diário, mapas offline e exportações.',
  'landing.plans.compare': 'Compare cada limite, linha por linha',
  'landing.questions.title': 'Perguntas, respondidas sem rodeios',
  'landing.questions.lede':
    'As seis coisas que as pessoas realmente querem saber antes de começar.',
  'cta.heading': 'Sua próxima viagem já merece ser planejada direito',
  'cta.lede':
    'Duas viagens, o mapa inteiro, o roteiro e as listas de bagagem: de graça, sem cartão e sem contagem regressiva.',
  'landing.faq.seats.q': 'As pessoas com quem eu viajo também precisam pagar?',
  'landing.faq.seats.a':
    'Não. Todo mundo que você convida para um espaço de trabalho {crew} está coberto pelas vagas dele. Cada um entra com a própria conta e vê só as viagens em que você o adicionou.',
  'landing.faq.phone.q': 'Funciona bem no celular?',
  'landing.faq.phone.a':
    'Sim. Os layouts de celular são desenhados separadamente, não comprimidos a partir dos de desktop, e é um site: não tem nada para instalar nem para manter atualizado.',
  'landing.faq.offline.q': 'Consigo usar o mapa sem sinal?',
  'landing.faq.offline.a':
    'Com {solo} e {crew} você pode baixar uma região antes de voar, então o mapa continua desenhando quando você aterrissa sem dados. Editar a viagem em si precisa de conexão.',
  'landing.faq.privacy.q': 'Quem pode ver a minha viagem?',
  'landing.faq.privacy.a':
    'Uma viagem pertence a um espaço de trabalho, e só as pessoas convidadas para aquele espaço podem abri-la. Nada é público, não existe feed de descoberta e, por padrão, nada é compartilhado com ninguém.',
  'landing.faq.stop.q':
    'O que acontece com as minhas viagens se eu parar de pagar?',
  'landing.faq.stop.a':
    'Nada é apagado. Os módulos pagos travam, suas viagens ficam exatamente onde estão, e tudo destrava no momento em que você assina. O {free} continua de graça, sem contagem regressiva.',

  'action.startPlanning': 'Comece a planejar de graça',
  'cta.comparePlans': 'Compare os planos',
  'landing.hero.eyebrow': 'Planejamento de viagem em grupo',
  'landing.hero.title': 'Planeje a viagem.',
  'landing.hero.titleQuiet': 'Não a planilha.',
  'landing.hero.lede':
    'Um roteiro num mapa de verdade, compartilhado ao vivo com todos que viajam - com as reservas, o dinheiro e a lista de bagagem anexados.',
  'landing.hero.secondary': 'Veja quanto custa',
  'landing.trust.noCard': 'Sem cartão para começar',
  'landing.trust.noAds': 'Sem anúncios nem links de afiliado',
  'landing.trust.export': 'Exporte tudo, quando quiser',

  'proof.eyebrow': 'Respostas diretas',
  'proof.title': 'Sem depoimentos, porque a gente ainda não os mereceu',
  'proof.lede':
    'O planned.travel é novo. Em vez de inventar uma citação ou pegar o logo de alguém emprestado, aqui está exatamente o que ele faz, para quem serve e o que nunca vai fazer com você.',
  'proof.who.label': 'Para quem é',
  'proof.who.heading': 'Para quem acaba montando a planilha',
  'proof.who.body':
    'Casais, famílias e grupos de amigos que querem um plano que todos vejam, em vez de seis capturas de tela, três grupos de conversa e uma nota compartilhada que ninguém abre desde março.',
  'proof.not.label': 'O que não é',
  'proof.not.heading': 'Não é site de reservas, nem está à venda para um',
  'proof.not.body':
    'Não recebemos comissão, não temos anúncios e não colocamos links de afiliado, então nada numa página empurra você discretamente para um hotel específico. Você paga a gente, ou seja, trabalhamos para você.',
  'proof.where.label': 'Onde ficam suas coisas',
  'proof.where.heading': 'Na Cloudflare, no seu próprio espaço de trabalho',
  'proof.where.body':
    'As viagens ficam num banco de dados restrito ao seu espaço de trabalho e os arquivos no nosso próprio armazenamento de objetos, os dois servidos da borda da Cloudflare. A Polar, nossa revendedora oficial, cuida do pagamento e emite a nota, então o número do seu cartão nunca chega até nós.',
  'proof.promise.ads.title': 'Sem publicidade, sem analytics de terceiros',
  'proof.promise.ads.body':
    'Nada nesta página está medindo você para outra pessoa.',
  'proof.promise.sold.title': 'Suas viagens nunca são vendidas nem alugadas',
  'proof.promise.sold.body':
    'Nem para anunciantes, nem para empresas de turismo, nem para ninguém.',
  'proof.promise.leave.title': 'Vá embora quando quiser, com tudo',
  'proof.promise.leave.body':
    'Roteiros em PDF, arquivos de calendário e seus lugares em GeoJSON.',
  'proof.certification':
    'Hoje não temos nenhuma certificação de segurança, e não vamos insinuar que temos. Quando o planned.travel for auditado por um padrão, é aqui que vamos dizer o padrão, o auditor e a data - e não antes.',

  'feature.modules.title': 'O resto da viagem, resolvido',
  'feature.modules.lede':
    'Cada módulo faz uma coisa bem feita e entrega o trabalho dele aos outros. Aqui não tem aba de enfeite esperando uma versão futura.',
  'feature.module.lists.benefit': 'Ninguém chega sem o adaptador.',
  'feature.module.lists.detail':
    'Bagagem, tarefas, compras e documentos: uma lista por assunto, compartilhada com todos que viajam e marcada conforme acontece.',
  'feature.module.journal.name': 'Diário',
  'feature.module.journal.benefit': 'A viagem virou narrativa, não pasta.',
  'feature.module.journal.detail':
    'Registros em ordem de data com as fotos que você tirou, onde você estava, o tempo e como o dia foi de verdade.',
  'feature.module.atlas.benefit': 'Um mapa de todo lugar onde você já esteve.',
  'feature.module.atlas.detail':
    'Marque um país como visitado e ele entra no seu mapa-múndi, com a primeira visita, a mais recente e quantas vezes você voltou.',
  'feature.module.vacay.benefit': 'Peça as férias antes de comprar o voo.',
  'feature.module.vacay.detail':
    'Marque os dias em que você está fora e o ano se preenche: fins de semana, feriados e as folgas de todo mundo na mesma grade.',
  'feature.module.collab.benefit': 'As decisões ficam com a viagem.',
  'feature.module.collab.detail':
    'Um tópico por viagem, notas compartilhadas para o que todos precisam lembrar e uma votação para quando o grupo não concorda sobre o jantar.',
  'feature.module.files.benefit':
    'Cartões de embarque onde você consegue achar.',
  'feature.module.files.detail':
    'Confirmações, ingressos, apólices e recibos anexados à viagem a que pertencem, não enterrados numa caixa de entrada.',

  'feature.planner.title': 'Um roteiro dia a dia desenhado num mapa de verdade',
  'feature.planner.lede':
    'Junte os lugares que você quer ver e arraste-os para um dia. O mapa redesenha a rota conforme você trabalha, então você vê na hora quando uma manhã faz você cruzar a cidade duas vezes.',
  'feature.planner.point.days':
    'Uma coluna por dia, com a data, o tempo e o lugar onde você dorme.',
  'feature.planner.point.unscheduled':
    'Lugares sem data esperam na coluna deles até receberem um dia.',
  'feature.planner.point.crew':
    'No {crew} todos arrastam ao mesmo tempo: cursores ao vivo, sincronização instantânea, sem recarregar.',
  'feature.planner.point.tiles':
    'Tiles vetoriais servidos do nosso próprio armazenamento, então nenhum fornecedor de mapas observa o que você planeja.',
  'feature.costs.title': 'Despesas divididas que realmente fecham',
  'feature.costs.lede':
    'Registre o que você gasta na moeda da viagem, divida cada despesa como vocês combinaram de verdade e veja o menor conjunto de transferências que fecha tudo.',
  'feature.costs.point.split':
    'Em partes iguais, por cota ou pelo valor exato: por despesa, não por viagem.',
  'feature.costs.point.currency':
    'Tudo convertido para uma só moeda da viagem, para o total significar algo.',
  'feature.costs.point.settle':
    'A tela de acerto diz quem paga quem e registra a transferência quando ela acontece.',
  'feature.costs.point.receipt':
    'Anexe o comprovante à despesa, para o número sempre ter a prova dele.',
  'feature.book.title': 'Cada reserva, com o código que você precisa na porta',
  'feature.book.lede':
    'Hospedagens, mesas, tours e ingressos em uma lista, ao lado dos voos, trens e balsas que levam você entre eles: cada um com o número de confirmação e o dia a que pertence.',
  'feature.book.point.legs':
    'Os trechos carregam o assento, a plataforma, o terminal e o código da reserva.',
  'feature.book.point.day':
    'Uma reserva fica ligada a um dia, então aparece no roteiro sem redigitar.',
  'feature.book.point.states':
    'Solicitada, confirmada e cancelada são estados separados, não uma anotação num campo.',
  'feature.book.point.export':
    'Exporte a viagem inteira como roteiro em PDF ou arquivo de calendário antes de voar.',

  'pricing.faq.trial.q': 'O que acontece quando o teste termina?',
  'pricing.faq.trial.a':
    'O teste vira o plano pago. A Polar guarda uma forma de pagamento quando o teste começa e cobra no dia em que ele termina, então se você cancelar antes nunca é cobrado. Em nenhum caso algo é apagado: os módulos pagos travam, suas viagens ficam exatamente onde estão e tudo destrava no momento em que você assina.',
  'pricing.faq.seller.q': 'De quem eu estou comprando, na prática?',
  'pricing.faq.seller.a':
    'Da Polar. Ela é nossa revendedora oficial: vende a assinatura para você como revendedora, recebe o pagamento, emite a nota em nome próprio e determina, recolhe e repassa o imposto sobre vendas ou o IVA que o seu país cobra. Reembolsos e contestações de cartão também se resolvem com ela. O serviço continua sendo nosso, e somos nós que respondemos seus e-mails.',
  'pricing.faq.change.q': 'Posso mudar de plano no meio de uma viagem?',
  'pricing.faq.change.a':
    'Sim. As subidas de plano valem na hora e são rateadas por dia; as descidas passam a valer no fim do período que você já pagou, então nunca perde um acesso que pagou.',
  'pricing.faq.seats.q': 'Como funciona a cobrança por membro no {crew}?',
  'pricing.faq.seats.a':
    'Você paga pelos assentos que realmente ocupa, e pode mudar o número quando quiser. Convites em aberto contam nos seus assentos, então um espaço nunca ultrapassa o plano sem avisar.',
  'pricing.faq.guests.q': 'Quem viaja comigo precisa de assinatura própria?',
  'pricing.faq.guests.a':
    'Não. Todo mundo que você convida para um espaço de trabalho {crew} está coberto pelas vagas dele. Entram com a própria conta e veem as viagens em que foram incluídos.',
  'pricing.faq.storage.q': 'O que conta para o armazenamento?',
  'pricing.faq.storage.a':
    'Fotos, passagens, confirmações e qualquer arquivo que você anexe a uma viagem. Os tiles do mapa e o próprio aplicativo nunca contam. Nas Configurações você vê exatamente o que está ocupando espaço.',
  'pricing.faq.export.q': 'Consigo levar meus dados embora?',
  'pricing.faq.export.a':
    'Sempre. Cada viagem sai como roteiro em PDF e como arquivo de calendário, e seus lugares saem como GeoJSON. São suas viagens, não nossas.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Sem cartão, sem prazo, sem contagem',
  'pricing.card.yearlyPerSeat': '{amount} por ano por membro, cobrados uma vez',
  'pricing.card.yearly': '{amount} cobrados uma vez por ano',
  'pricing.card.seatsUnlimited': 'Membros ilimitados',
  'pricing.card.tripsUnlimited': 'viagens ilimitadas',
  'pricing.card.startFree': 'Comece de graça',
  'pricing.card.startTrial': 'Experimente o {plan}',
  'pricing.card.popular': 'O mais escolhido',
  'pricing.card.noteYearly':
    'Cobrado uma vez por ano. Dois meses são por nossa conta.',
  'pricing.card.noteMonthly':
    'Cobrado por mês. Troque ou cancele quando quiser.',
  'pricing.card.trial': {
    one: '{value} dia de teste, cartão na frente, cobrança ao terminar',
    many: '{value} dias de teste, cartão na frente, cobrança ao terminar',
    other: '{value} dias de teste, cartão na frente, cobrança ao terminar',
  },
  'pricing.card.seatsUpTo': {
    one: 'Até {value} membro',
    many: 'Até {value} membros',
    other: 'Até {value} membros',
  },
  'pricing.card.trips': {
    one: '{value} viagem por vez',
    many: '{value} viagens por vez',
    other: '{value} viagens por vez',
  },

  'pricing.feature.storage': '{size} para fotos e documentos',
  'pricing.feature.storageShared':
    '{size} compartilhados para fotos e documentos',
  'pricing.feature.free.tripsDetail': 'Arquive uma para começar outra',
  'pricing.feature.solo.modules': 'Todos os módulos de planejamento',
  'pricing.feature.solo.modulesDetail': 'Reservas, diário, orçamentos, bagagem',
  'pricing.feature.solo.offlineDetail': 'Baixe as regiões antes de voar',
  'pricing.feature.crew.membersDetail':
    'Cobrado por membro, mude quando quiser',
  'pricing.feature.crew.realtimeDetail':
    'Cursores ao vivo e sincronização instantânea',
  'pricing.feature.crew.supportDetail': 'Resposta de uma pessoa em um dia útil',

  'pricing.hero.eyebrow': 'Duas viagens grátis, para sempre',
  'pricing.hero.title': 'Planeje do jeito certo.',
  'pricing.hero.titleQuiet': 'Pague pelo que usar.',
  'pricing.hero.lede':
    'Planeje duas viagens de graça. Libere todos os módulos para um viajante, ou leve o grupo inteiro e editem o mesmo roteiro ao mesmo tempo.',
  'pricing.hero.taxNote':
    'Preços em dólares americanos, sem imposto sobre vendas nem IVA. A Polar é nossa revendedora oficial: é ela que aparece na sua nota, calcula o que o seu país cobra, soma no pagamento e repassa. Cancele quando quiser, de dentro do produto.',
  'pricing.compare.eyebrow': 'Lado a lado',
  'pricing.compare.title': 'Cada limite, comparado',
  'pricing.compare.lede':
    'Uma tabela, gerada do mesmo catálogo que o sistema de cobrança lê. Se uma linha diz que um módulo está incluído, a verificação de permissões concorda.',
  'pricing.compare.caption':
    'Comparação de recursos e limites entre os três planos',
  'pricing.compare.feature': 'Recurso',
  'pricing.compare.limits': 'Limites',
  'pricing.compare.included': 'Incluído',
  'pricing.compare.notIncluded': 'Não incluído',
  'pricing.compare.includedIn': 'Incluído no {plan}',
  'pricing.compare.notIn': 'Fora do {plan}',
  'pricing.questions.eyebrow': 'Antes de você perguntar',
  'pricing.questions.title': 'Perguntas, respondidas',
  'pricing.questions.lede':
    'Cobrança, testes e como pegar seus dados de volta.',
  'pricing.cta.secondary': 'Veja como funciona',
  'pricing.module.itinerary': 'Roteiro dia a dia',
  'pricing.module.map': 'Mapa interativo',
  'pricing.module.budget': 'Orçamentos e divisão de gastos',
  'pricing.module.packing': 'Listas de bagagem e tarefas',
  'pricing.module.reservations': 'Reservas',
  'pricing.module.journal': 'Diário de viagem',
  'pricing.module.atlas': 'Mapa de países visitados',
  'pricing.module.collaboration': 'Convidar outros viajantes',
  'pricing.module.realtime': 'Colaboração ao vivo',
  'pricing.module.offlineMaps': 'Mapas offline',
  'pricing.module.pdfExport': 'Exportação em PDF e calendário',
  'pricing.module.prioritySupport': 'Suporte prioritário',

  'anchor.plans': 'Planos',
  'anchor.compare': 'Comparação',
  'anchor.questions': 'Perguntas',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Um só lugar para o roteiro, o mapa, as reservas, o dinheiro e a lista de bagagem — compartilhado com todo mundo que vai.',
  'footer.attribution':
    'Roda em Cloudflare Workers. Dados de mapa © colaboradores do OpenStreetMap. Venda e faturamento pela Polar, nossa revendedora oficial.',
  'footer.column.product': 'Produto',
  'footer.column.account': 'Conta',
  'footer.link.overview': 'Visão geral',
  'footer.link.everyModule': 'Todos os módulos',
  'footer.link.dayPlanner': 'Planejador do dia',
  'footer.link.sharedCosts': 'Despesas compartilhadas',
  'footer.link.reservations': 'Reservas',
  'footer.link.atlasJournal': 'Atlas e diário',
  'footer.link.createAccount': 'Criar uma conta',
  'footer.link.terms': 'Termos de serviço',
  'footer.link.privacy': 'Aviso de privacidade',
} satisfies TranslationOf<typeof En>

export default messages
