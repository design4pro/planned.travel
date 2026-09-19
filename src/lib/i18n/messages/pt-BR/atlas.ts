/**
 * The world tracker and the map chrome, in Brazilian Portuguese.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** «Mapa-múndi» for the atlas module — the word `pt-BR/shell.ts`
 * already uses for `nav.atlas` — «viagem» for a trip and «lista de desejos»
 * for the bucket list. The traveller's log of visits is «seu registro», one
 * word chosen once and kept through the search, the stats and the write
 * actions. The address is «você» with the verb in the third person, matching
 * the rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('pt-BR')` reports `one`, `many` and `other`;
 * `many` covers the million-scale round numbers and reads like `other`, the
 * same three branches the rest of the Portuguese catalogue writes.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Portuguese uses, and the parity suite exempts them
 * structurally. `continent.oceania` takes the school-atlas grouping
 * «Austrália e Oceania» rather than the homograph «Oceania», so the label
 * reads as Portuguese instead of tripping the untranslated check.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': 'Mapa-múndi. Nenhum país marcado como visitado ainda.',
  'screen.world.summary':
    'Mapa-múndi com {visited} de {total} países marcados como visitados.',
  'screen.error.title': 'O mapa-múndi não carregou',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Carregando o mapa',
  'map.controls.label': 'Controles do mapa',
  'map.controls.zoomIn': 'Aproximar',
  'map.controls.zoomOut': 'Afastar',
  'map.controls.north': 'Apontar para o norte',
  'map.controls.locate': 'Encontrar minha localização',
  'map.controls.locateFailed': 'Não conseguimos obter sua localização.',
  'map.controls.locateFailedBody':
    'Verifique se o acesso à localização está permitido para este site e tente de novo.',

  'map.attribution.label': 'Dados do mapa de',
  'map.attribution.geocoder': 'Lugares localizados com',

  'map.basemap.title': 'Mapa base indisponível',
  'map.basemap.body':
    'O detalhe das ruas está offline. Cada lugar continua aparecendo na sua posição real, então distâncias e agrupamentos seguem exatos.',
  'map.basemap.credit': 'Litorais de',
  'map.basemap.retry': 'Tentar de novo',
  'map.basemap.retrying': 'Verificando o mapa base',

  'map.engine.unsupported.title': 'Renderização do mapa indisponível',
  'map.engine.unsupported.body':
    'Este navegador não consegue rodar o mapa interativo: ele precisa de WebGL2, e nenhum contexto WebGL2 está disponível aqui. Nada mais nesta tela depende disso.',
  'map.engine.stalled.title': 'O mapa ainda não desenhou nada',
  'map.engine.stalled.body':
    'Nada apareceu no tempo que o mapa tem para começar. Ele ainda pode se recuperar sozinho; nada mais nesta tela depende disso.',

  'map.coverage.partial.title': 'Detalhe de ruas parcial',
  'map.coverage.partial.body': {
    one: 'Os dados publicados do mapa não alcançam {outside} lugar desta viagem. Ele é desenhado na sua posição real sobre os nossos litorais.',
    many: 'Os dados publicados do mapa não alcançam {outside} lugares desta viagem. Eles são desenhados nas suas posições reais sobre os nossos litorais.',
    other:
      'Os dados publicados do mapa não alcançam {outside} lugares desta viagem. Eles são desenhados nas suas posições reais sobre os nossos litorais.',
  },
  'map.coverage.none.title': 'Sem detalhe de ruas aqui',
  'map.coverage.none.body':
    'As ruas ainda não foram publicadas para esta região. Os litorais, os alfinetes e as rotas entre eles são todos reais — só faltam os prédios e as estradas.',
  'map.coverage.dismiss': 'Dispensar o aviso de cobertura do mapa',

  'map.legend.title': 'Legenda',
  'map.legend.collapse': 'Recolher {title}',
  'map.legend.expand': 'Expandir {title}',
  'map.legend.dayPin': 'Exemplo de alfinete de dia',
  'map.legend.dayPinMeaning': 'Dia do roteiro',
  'map.legend.clusterPin': 'Exemplo de alfinete agrupado',
  'map.legend.clusterPinMeaning': 'Lugares agrupados',

  'map.filter.label': 'Filtrar lugares por categoria',
  'map.filter.all': 'Todos',
  'map.filter.category': {
    one: '{name} · {places} lugar',
    many: '{name} · {places} lugares',
    other: '{name} · {places} lugares',
  },

  'map.pin.day': 'Dia {day}',
  'map.pin.cluster': {
    one: '{places} lugar — aproxime para isolá-lo',
    many: '{places} lugares — aproxime para separá-los',
    other: '{places} lugares — aproxime para separá-los',
  },

  'map.place.rating': 'Avaliado em {rating} de {max}',
  'map.place.clause.day': 'dia {day}',
  'map.place.clause.rating': 'avaliado em {rating} de {max}',
  'map.place.clause.visited': 'visitado',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Última visita',
  'legend.recent': {
    one: 'No último ano',
    many: 'Nos últimos {years} anos',
    other: 'Nos últimos {years} anos',
  },
  'legend.middle': 'Há {from}–{to} anos, ou sem data',
  'legend.distant': {
    one: 'Há mais de {years} ano',
    many: 'Há mais de {years} anos',
    other: 'Há mais de {years} anos',
  },
  'legend.unvisited': 'Ainda não visitado',
  'legend.note':
    'O tom mostra só o quão recente foi — a aba País escreve todas as datas.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Cobertura do mundo',
  'panel.coverage.unit': 'de {total}',
  'panel.coverage.caption': '{share} do mundo · {visits}',
  'panel.progress.label': 'A caminho de todos os países',
  'panel.progress.remaining': '{remaining} por visitar',
  'panel.toggle.hide': 'Ocultar os detalhes do mapa-múndi',
  'panel.toggle.show': 'Mostrar os detalhes do mapa-múndi',
  'panel.tabs.label': 'Seções do mapa-múndi',
  'panel.tab.country': 'País',
  'panel.tab.stats': 'Estatísticas',
  'panel.tab.bucket': 'Lista de desejos',
  'panel.back': 'Todos os países',
  'panel.list.label': 'Países visitados',
  'panel.loading': 'Carregando seu mapa-múndi',

  'panel.empty.blank.title': 'Seu mapa ainda está em branco',
  'panel.empty.blank.body':
    'Marque um país como visitado e ele se preenche aqui no mapa, com a primeira e a última visita, quantas vezes você esteve lá e o que você escreveu sobre ele.',
  'panel.empty.pick.title': 'Escolha um país',
  'panel.empty.pick.body':
    'Escolha um no mapa, no campo de busca ou na lista, e a ficha completa dele abre aqui — primeira visita, última visita, a contagem e a sua nota.',

  'panel.stat.places': 'Seus lugares',
  'panel.stat.placesNone': 'Nada fixado em uma viagem ainda',
  'panel.stat.placesCaption': 'Atrações, hospedagens e paradas salvas',
  'panel.stat.regions': 'Regiões',
  'panel.stat.regionsNone': 'Nenhuma região marcada ainda',
  'panel.stat.regionsCaption': 'Estados, províncias, prefeituras',
  'panel.stat.visits': 'Visitas',
  'panel.stat.visitsCaption': 'Cada chegada registrada',
  'panel.stat.trips': 'Suas viagens',
  'panel.stat.tripsCaption': 'Todas as viagens das quais você participa',
  'panel.stat.cities': 'Cidades',
  'panel.stat.citiesCaption': 'Cidades onde você dormiu ou fez parada',
  'panel.stat.days': 'Dias fora',
  'panel.stat.daysCaption': 'Somando todas as viagens do seu registro',
  'panel.continents.label': 'Países por continente',

  'panel.bucket.empty.title': 'Nada na lista',
  'panel.bucket.empty.body':
    'Aquele lugar aonde você sempre quis ir. Adicione, e risque quando chegar lá.',
  'panel.bucket.label': 'Lista de desejos',
  'panel.bucket.progress': '{done} de {total} concluídos',
  'panel.bucket.done': 'Concluídos',
  'panel.bucket.toGo': 'Pendentes',
  'panel.bucket.target': 'até {year}',
  'panel.bucket.hidden': {
    one: 'Mais {entries} item na sua lista, não mostrado aqui.',
    many: 'Mais {entries} itens na sua lista, não mostrados aqui.',
    other: 'Mais {entries} itens na sua lista, não mostrados aqui.',
  },
  'panel.bucket.kind.country': 'País',
  'panel.bucket.kind.region': 'Região',
  'panel.bucket.kind.place': 'Lugar',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'África',
  'continent.antarctica': 'Antártida',
  'continent.asia': 'Ásia',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'América do Norte',
  'continent.oceania': 'Austrália e Oceania',
  'continent.southAmerica': 'América do Sul',
  'continent.unknown': 'Continente não registrado',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Visitado',
  'record.firstVisit': 'Primeira visita',
  'record.lastVisit': 'Última visita',
  'record.visitDates': 'Datas das visitas',
  'record.notRecorded': 'Não registrado',
  'record.datesUnrecorded': 'Datas não registradas',
  'record.visits': {
    one: '{visits} visita',
    many: '{visits} visitas',
    other: '{visits} visitas',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Primeira visita {from}',
  'record.spanTo': 'Última visita {to}',
  'record.visitsUnit': { one: 'visita', many: 'visitas', other: 'visitas' },
  'record.gap.days': {
    one: 'com {gap} dia de intervalo',
    many: 'com {gap} dias de intervalo',
    other: 'com {gap} dias de intervalo',
  },
  'record.gap.months': {
    one: 'com {gap} mês de intervalo',
    many: 'com {gap} meses de intervalo',
    other: 'com {gap} meses de intervalo',
  },
  'record.gap.years': {
    one: 'com {gap} ano de intervalo',
    many: 'com {gap} anos de intervalo',
    other: 'com {gap} anos de intervalo',
  },
  'record.note.empty': 'Nenhuma nota ainda',
  'record.noOutline':
    'Os contornos do mundo que este mapa desenha são cortados em 1:110m, e esse corte funde este território ao estado do qual ele depende — então não há nada para enquadrar no mapa. A visita conta mesmo assim.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ordenar países',
  'list.sort.code': 'Código do país',
  'list.sort.codeStatement': 'Em ordem de código do país, de A a Z.',
  'list.sort.name': 'Nome do país',
  'list.sort.nameStatement':
    'Em ordem de nome do país, de A a Z, depois por código do país.',
  'list.sort.recent': 'Visita mais recente',
  'list.sort.recentStatement':
    'Da visita mais recente para a mais antiga, depois por código do país.',
  'list.sort.visits': 'Mais visitas',
  'list.sort.visitsStatement':
    'Do maior número de visitas para o menor, depois por código do país.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Fundido ao estado do qual depende pelos contornos do mundo, então não há nada para enquadrar no mapa.',
  'list.announce.selected': '{name} selecionado.',
  'list.announce.selectedUnframed': '{name} selecionado. {reason}',
  'list.empty.title': 'Nenhum país no mapa ainda',
  'list.empty.body':
    'Um país aparece aqui assim que uma visita é registrada nele, com a primeira chegada, a mais recente e quantas vezes você esteve lá.',
  'list.loading': 'Carregando os países visitados',
  'list.error.title': 'Seus países não carregaram',
  'list.error.body':
    'O mapa-múndi não conseguiu ler seus países visitados agora. Nada foi perdido — eles continuam registrados.',
  'list.error.retry': 'Tentar de novo',
  'list.error.retrying': 'Carregando seus países',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Encontrar um país',
  'search.loading': 'Carregando seus países',
  'search.placeholder': 'Nome do país ou código',
  'search.entry.notVisited': 'Ainda não visitado',
  'search.entry.noOutline': 'sem contorno no mapa',
  'search.entry.separator': ' · ',
  'search.cleared': 'Seleção desfeita.',
  'search.unframed':
    '{name} não tem contorno na escala do mundo, então o mapa não tem o que enquadrar.',
  'search.unframedVisited':
    '{name} não tem contorno na escala do mundo, então o mapa não tem o que enquadrar. O registro dele não é afetado.',
  'search.results.empty':
    'Nenhum país no seu registro ainda. Digite para buscar entre todos os países do mundo.',
  'search.results.emptyPinned':
    '{name} está selecionado. Nenhum país no seu registro ainda — digite para buscar entre todos os países do mundo.',
  'search.results.record': {
    one: '{countries} país no seu registro.',
    many: '{countries} países no seu registro.',
    other: '{countries} países no seu registro.',
  },
  'search.results.capped': 'Mostrando os primeiros {shown}.',
  'search.results.pinned': '{name} está selecionado e aparece primeiro.',
  'search.results.none': 'Nenhum país corresponde a {term}.',
  'search.results.matches': {
    one: '{countries} país corresponde a {term}.',
    many: '{countries} países correspondem a {term}.',
    other: '{countries} países correspondem a {term}.',
  },
  'search.announce.selected': '{name} selecionado.',
  'search.announce.framing': '{name} selecionado. O mapa o está enquadrando.',
  'search.announce.unframed': '{name} selecionado. {reason}',
  'search.empty.title': 'Nada no seu registro ainda',
  'search.empty.body':
    'Digite o nome de um país, ou o código de duas letras dele, para encontrá-lo no mapa.',
  'search.empty.noMatchTitle': 'Nenhum país corresponde a “{term}”',
  'search.empty.noMatchBody':
    'Confira a grafia, ou tente o código de duas letras — PT encontra Portugal. Todos os {countries} países podem ser buscados, tendo você ido ou não.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Seu registro',
  'actions.visit.absent.title': 'Não visitado',
  'actions.visit.absent.caption': 'Uma visita sem viagem por trás.',
  'actions.visit.title': 'Visitado',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Fora da lista',
  'actions.goal.absent.caption': 'Um lugar aonde você pretende ir.',
  'actions.goal.title': 'Na lista de desejos',
  'actions.goal.waiting': 'Esperando a vez.',
  'actions.goal.target': 'De olho em {year}.',
  'actions.goal.achieved.title': 'Riscado da lista',
  'actions.goal.achieved.caption':
    'Você chegou lá. O item fica como lembrança.',

  'actions.button.remove': 'Remover',
  'actions.button.mark': 'Marcar como visitado',
  'actions.button.add': 'Adicionar à lista',
  'actions.visit.remove.name': 'Remover {name} do seu mapa-múndi',
  'actions.visit.remove.busy': 'Removendo {name} do seu mapa-múndi',
  'actions.visit.add.name': 'Marcar como visitado, {name}',
  'actions.visit.add.busy': 'Marcando {name} como visitado',
  'actions.goal.remove.name': 'Remover {name} da sua lista de desejos',
  'actions.goal.remove.busy': 'Removendo {name} da sua lista de desejos',
  'actions.goal.add.name': 'Adicionar à lista, {name}',
  'actions.goal.add.busy': 'Adicionando {name} à sua lista de desejos',

  'actions.hint': 'Os dois valem na hora, e os dois podem ser desfeitos aqui.',
  'actions.offline':
    'Seu dispositivo não conseguiu falar com o servidor. Verifique a conexão e tente de novo.',
  'actions.toast.marked': 'Marcado como visitado',
  'actions.toast.markedBody': '{name} está no seu mapa-múndi.',
  'actions.toast.markFailed': '{name} não foi marcado',
  'actions.toast.unmarked': 'Removido do seu mapa-múndi',
  'actions.toast.unmarkedBody': '{name} não está mais marcado como visitado.',
  'actions.toast.unmarkFailed': '{name} não foi removido',
  'actions.toast.listed': 'Adicionado à sua lista de desejos',
  'actions.toast.listedBody': '{name} é um lugar aonde você pretende ir.',
  'actions.toast.listFailed': '{name} não foi adicionado',
  'actions.toast.unlisted': 'Removido da sua lista de desejos',
  'actions.toast.unlistedBody': '{name} não está mais na lista.',
  'actions.toast.unlistFailed': '{name} não foi removido',
  'actions.toast.fallback':
    'A alteração não chegou ao servidor. Tente de novo em instantes.',

  'actions.confirm.visit.title': 'Remover {name} do seu mapa-múndi?',
  'actions.confirm.visit.body': {
    one: '{visits} visita registrada{dates} seria apagada{note}. Suas viagens e seus lugares salvos não são tocados.',
    many: '{visits} visitas registradas{dates} seriam apagadas{note}. Suas viagens e seus lugares salvos não são tocados.',
    other:
      '{visits} visitas registradas{dates} seriam apagadas{note}. Suas viagens e seus lugares salvos não são tocados.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', junto com a nota que você escreveu',
  'actions.confirm.goal.title': 'Remover {name} da sua lista de desejos?',
  'actions.confirm.goal.body':
    'Ele já está riscado, então isto também apaga o registro de que você chegou lá. Seu mapa-múndi e suas viagens não são tocados.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Viagem do espaço de trabalho',
    many: 'Viagens do espaço de trabalho',
    other: 'Viagens do espaço de trabalho',
  },
  'card.visits': { one: 'Visita', many: 'Visitas', other: 'Visitas' },
  'card.places': {
    one: 'Lugar do espaço de trabalho',
    many: 'Lugares do espaço de trabalho',
    other: 'Lugares do espaço de trabalho',
  },
  'card.firstTrip': 'Primeira viagem',
  'card.lastTrip': 'Última viagem',
  'card.firstVisit': 'Primeira visita',
  'card.lastVisit': 'Última visita',
  'card.absent': 'Não registrado',
  'card.loading': 'Carregando este país',
  'card.loadingNamed': 'Carregando {name}',
  'card.error.body': 'Esses números não carregaram. Nada foi perdido.',
  'card.error.retry': 'Tentar de novo',
  'overlay.close': 'Fechar {name}',
} satisfies TranslationOf<typeof En>

export default messages
