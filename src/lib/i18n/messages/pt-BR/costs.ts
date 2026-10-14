/**
 * The costs tab's copy, in pt-BR.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` só para números compactos
 * grandes.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Você',
  'person.youTarget': 'você',
  'person.removed': 'Viajante removido',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Excluir esta despesa?',
  'delete.description':
    '“{title}” e a divisão dela saem da conta. Isso não pode ser desfeito.',
  'delete.failed': 'Não deu para excluir',
  'delete.failedBody':
    'Não foi possível excluir a despesa. Tente de novo em um instante.',
  'delete.noBalances': 'Nenhum saldo muda: não havia nada dividido nela.',
  'delete.balancesChange': 'Os saldos de {names} mudam.',
  'delete.confirm': 'Excluir despesa',
  'delete.working': 'Excluindo a despesa',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Despesas',
  'toolbar.shownOf': '{shown} de {total}',
  'toolbar.searchPlaceholder': 'Busque em despesas, notas ou quem pagou…',
  'toolbar.searchLabel': 'Buscar despesas',
  'toolbar.allCategories': 'Todas as categorias',
  'toolbar.allDays': 'Todos os dias',
  'toolbar.filterCategory': 'Filtrar por categoria',
  'toolbar.filterDay': 'Filtrar por dia',
  'toolbar.whose': 'Despesas de quem',
  'toolbar.paidByMe': 'Pagas por mim',
  'toolbar.owedToMe': 'Me devem',
  'toolbar.logged': {
    one: '{value} registrada',
    many: '{value} registradas',
    other: '{value} registradas',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Divisão entre os viajantes',
  'split.label': 'Dividir entre',
  'split.everyone': 'Todos',
  'split.nobody': 'Ninguém',
  'split.how': 'Como esta despesa se divide',
  'split.method.equal': 'Igualmente',
  'split.method.equalHint':
    'Todos os incluídos pagam o mesmo, e a unidade mínima sobrando vai para a primeira pessoa da lista.',
  'split.method.exact': 'Exato',
  'split.method.exactHint':
    'Escreva quanto cada um deve de verdade. Os valores têm que somar o total.',
  'split.method.shares': 'Cotas',
  'split.method.sharesHint':
    'Pondere a divisão: 2 cotas para um casal, 1 para os demais.',
  'split.method.percentage': 'Porcentagem',
  'split.method.percentageHint':
    'Divisão por porcentagem. As porcentagens têm que somar 100.',
  'split.exactFor': 'Valor exato de {name}',
  'split.percentFor': 'Porcentagem de {name}',
  'split.sharesFor': 'Cotas de {name}',
  'split.balanced': 'Fecha',
  'split.allocated': '{allocated} de {total} atribuído',
  'split.over': '{amount} a mais',
  'split.left': 'faltam {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Valor',
  'field.currency': 'Moeda',
  'field.date': 'Data',
  'field.paidBy': 'Pago por',
  'expense.editTitle': 'Editar esta despesa',
  'expense.addTitle': 'Adicionar uma despesa',
  'expense.editDescription':
    'Mudar o valor faz a divisão de novo entre todos os incluídos abaixo.',
  'expense.addDescription':
    'Os valores desta viagem ficam em {currency}. Registre um comprovante na moeda dele e anote quanto deu na conversão.',
  'expense.saveFailed': 'Não deu para salvar',
  'expense.what': 'Foi para quê',
  'expense.whatPlaceholder': 'Jantar no Kyubey',
  'expense.amountNotANumber': 'Escreva o valor como número.',
  'expense.currencyLabel': 'Moeda em que este comprovante foi emitido',
  'expense.convertedTo': 'Convertido para {currency}',
  'expense.convertedHint': 'Quanto {from} deu em {to} no seu extrato.',
  'expense.convertedSuggested':
    'Sugerido a partir da taxa usada nesta viagem em {date} ({rate}). Altere para bater com o seu extrato.',
  'expense.convertedNotANumber': 'Escreva o valor convertido como número.',
  'expense.dateLabel': 'Data da despesa',
  'expense.paidByHint':
    'Deixe sem pagante se você está registrando um comprovante que ninguém cobriu ainda.',
  'expense.nobodyYet': 'Ninguém ainda',
  'expense.whoPaid': 'Quem pagou',
  'expense.notesHint': 'Opcional. O que o comprovante não diz.',
  'expense.notesPlaceholder': 'Menu degustação dividido, bebidas à parte.',
  'expense.noAmount': 'Ainda sem valor',
  'expense.saving': 'Salvando a despesa',
  'expense.saveChanges': 'Salvar alterações',
  'expense.add': 'Adicionar despesa',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Registrar um pagamento',
  'payment.description':
    'Registrar uma transferência tira ela dos dois saldos. Não move dinheiro: o planned.travel cuida da conta, o dinheiro é o seu banco que move.',
  'payment.youSuffix': '{name} (você)',
  'payment.pays': '{from} paga {to}',
  'payment.pickTwo': 'Escolha duas pessoas diferentes.',
  'payment.paidTo': 'Pago para',
  'payment.needsTwo': 'Um pagamento precisa de duas pessoas diferentes.',
  'payment.whoPaying': 'Quem paga',
  'payment.whoPaid': 'Quem recebe',
  'payment.amountIn': 'Valor em {currency}',
  'payment.amountPositive': 'Escreva um valor maior que zero.',
  'payment.currencyLabel': 'Moeda em que o pagamento foi feito',
  'payment.how': 'Como',
  'payment.howMade': 'Como o pagamento foi feito',
  'payment.dateLabel': 'Data do pagamento',
  'payment.note': 'Observação',
  'payment.noteHint': 'Opcional. Uma referência, ou o que isso cobriu.',
  'payment.notePlaceholder': 'Cobre o hotel de Quioto e os passes JR.',
  'payment.recording': 'Registrando o pagamento',
  'payment.confirm': 'Registrar pagamento',
  'payment.failed':
    'Não foi possível registrar o pagamento. Tente de novo em um instante.',
  'payment.method.bankTransfer': 'Transferência bancária',
  'payment.method.cash': 'Dinheiro',
  'payment.method.card': 'Cartão',
  'payment.method.app': 'App de pagamento',
  'payment.method.other': 'Outra coisa',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Acerto de contas',
  'settle.addPayment': 'Adicionar pagamento',
  'settle.action': 'Acertar',
  'settle.empty.title': 'Todos estão quites',
  'settle.empty.body':
    'Nenhuma transferência é necessária. Registre uma despesa e qualquer desequilíbrio aparecerá aqui.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldos',
  'balances.count': {
    one: '{travellers} viajante',
    many: '{travellers} viajantes',
    other: '{travellers} viajantes',
  },
  'balances.empty':
    'Os saldos aparecem quando uma despesa tem quem pagou e uma divisão.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Por categoria',
  'categories.againstBudget': 'Em relação ao orçamento da viagem',
  'categories.progressLabel': 'Gasto em relação ao orçamento da viagem',
  'categories.empty':
    'As linhas do orçamento e as despesas se detalham aqui quando há algo a detalhar.',
  'categories.legendLabel': 'Gastos por categoria',
  'categories.planned': '{amount} previstos',
  'categories.nothingSpent': 'Nada foi gasto ainda. Veja o que você planejou.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'menos de {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Para quem o dinheiro foi gasto',
  'memberBar.others': {
    one: '{others} outro viajante',
    many: '{others} outros viajantes',
    other: '{others} outros viajantes',
  },
  'memberBar.notSplit': 'Não atribuído a ninguém',
  'totalTile.label': 'Gasto total da viagem',
  'totalTile.captionPlanned': '{amount} previstos para todos os viajantes',
  'totalTile.captionBudget': '{amount} de orçamento para a viagem',
  'totalTile.yourShare': 'Sua parte',
  'totalTile.youPaid': 'Você pagou',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Pagamentos registrados',
  'payments.empty.title': 'Ainda sem pagamentos',
  'payments.empty.body':
    'Quando alguém devolve um saldo, a transferência fica registrada aqui.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Você pode ver os custos, mas não alterá-los',
  'readOnly.body':
    'Só os proprietários da viagem e quem pode editá-la adicionam, alteram ou excluem despesas e registram pagamentos. Fale com um proprietário se algo precisar mudar.',
  'readOnly.empty':
    'Nenhuma despesa foi registrada nesta viagem ainda. Elas aparecem aqui quando um proprietário ou um editor as adicionar.',
  'readOnly.settleEmpty':
    'No momento, nenhuma transferência é necessária. Qualquer desequilíbrio apareceria aqui.',
  'refusal.rebaseChanged':
    'A viagem mudou enquanto você confirmava, então nada foi alterado. Confira os novos valores e confirme de novo.',
  'refusal.tripCurrencyChanged':
    'A moeda do orçamento desta viagem agora é {to}, então nada foi salvo. A página foi atualizada: confira o valor e salve de novo.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Moeda de exibição',
  'display.indicator.perTrip': 'Moeda própria',
  'display.indicator.fixed': 'Também em {code}',
  'display.menu.perTrip': 'Cada viagem na sua moeda',
  'display.menu.workspace': '{code} (padrão do espaço)',
  'display.menu.rateHint': 'Usa uma taxa já registrada em uma viagem',
  'display.menu.currentHint': 'Escolhida, mas nenhuma taxa registrada a cobre',
  'display.menu.needsLiveRate':
    'Precisa de uma taxa ao vivo, que ainda não está disponível',
  'display.menu.saving': 'Salvando sua escolha',
  'display.error.title': 'A moeda de exibição não foi salva',
  'display.error.body':
    'Não foi possível salvar sua escolha. Tente novamente em instantes.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Cerca de {amount} {code} na sua moeda de exibição',
  'display.row.notConverted': 'Não convertido',
  'display.alert.title': 'Alguns valores não foram convertidos',
  'display.alert.body':
    'Não há taxa registrada para estes pares de moedas, então esses valores ficam na moeda do orçamento:',
  'display.alert.pair': '{from} para {to} em {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Alterar moeda do orçamento',
  'rebase.title': 'Alterar a moeda do orçamento',
  'rebase.description':
    'Os valores que você digitou continuam como estão. Os totais e saldos desta viagem são convertidos para a nova moeda.',
  'rebase.to': 'Nova moeda',
  'rebase.toPlaceholder': 'Escolha uma moeda',
  'rebase.rateLabel': 'Taxa de câmbio (1 {from} em {to})',
  'rebase.rateInverse': 'Ou seja, 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Escreva uma taxa maior que zero.',
  'rebase.rateOutOfRange':
    'Essa taxa parece grande ou pequena demais. Confira em que sentido ela está.',
  'rebase.source.recent': 'A última taxa usada neste espaço',
  'rebase.source.manual': 'A taxa que você digitou',
  'rebase.noRate':
    'Não há taxa registrada de {from} para {to}. Digite a taxa que quer usar.',
  'rebase.waitingForRate': 'A prévia aparece assim que houver uma taxa.',
  'rebase.loading': 'Calculando a conversão',
  'rebase.example':
    '{original} continua como você digitou e é contado como {converted}.',
  'rebase.count.expenses': {
    one: '{count} despesa será contada em {to}.',
    many: '{count} despesas serão contadas em {to}.',
    other: '{count} despesas serão contadas em {to}.',
  },
  'rebase.count.payments': {
    one: '{count} pagamento será contado em {to}.',
    many: '{count} pagamentos serão contados em {to}.',
    other: '{count} pagamentos serão contados em {to}.',
  },
  'rebase.count.planned': {
    one: '{count} item previsto será contado em {to}.',
    many: '{count} itens previstos serão contados em {to}.',
    other: '{count} itens previstos serão contados em {to}.',
  },
  'rebase.pinned':
    'Os preços de lugares, reservas, hospedagens e transportes continuam em {from}.',
  'rebase.target': 'O orçamento da viagem, {before}, passa a ser {after}.',
  'rebase.rounding':
    'Cada valor é arredondado uma vez, então um saldo pode variar em até {amount}.',
  'rebase.leftover':
    'Depois da mudança, {name} ficaria devendo {amount} a {other}.',
  'rebase.someone': 'Alguém',
  'rebase.nothing':
    'Nada nesta viagem tem preço ainda, então não há o que converter.',
  'rebase.unconverted': {
    one: '{count} lançamento está em outra moeda que não {from} e não pode ser convertido automaticamente. Em geral é uma despesa criada a partir de uma reserva com preço em outra moeda: edite ou exclua e tente de novo.',
    many: '{count} lançamentos estão em outra moeda que não {from} e não podem ser convertidos automaticamente. Em geral são despesas criadas a partir de reservas com preço em outra moeda: edite ou exclua e tente de novo.',
    other:
      '{count} lançamentos estão em outra moeda que não {from} e não podem ser convertidos automaticamente. Em geral são despesas criadas a partir de reservas com preço em outra moeda: edite ou exclua e tente de novo.',
  },
  'rebase.unsplittable': {
    one: '{count} despesa tem uma divisão que não pode ser mantida, porque todas as partes nela são zero. Edite ou exclua e tente de novo.',
    many: '{count} despesas têm uma divisão que não pode ser mantida, porque todas as partes nelas são zero. Edite ou exclua e tente de novo.',
    other:
      '{count} despesas têm uma divisão que não pode ser mantida, porque todas as partes nelas são zero. Edite ou exclua e tente de novo.',
  },
  'rebase.outOfRange':
    'Com essa taxa, um valor da viagem ficaria grande demais para ser guardado em {to}. Confira a taxa e o sentido dela.',
  'rebase.tooLarge':
    'Esta viagem tem lançamentos demais para mudar de uma vez: seriam {changes} alterações juntas e o limite é {limit}. O orçamento continua em {from} por enquanto.',
  'rebase.copyPending':
    'Esta viagem ainda está sendo copiada. Tente de novo daqui a pouco.',
  'rebase.error': 'Não foi possível carregar a conversão. Nada foi alterado.',
  'rebase.commitError':
    'Não foi possível alterar a moeda do orçamento. Nada foi alterado.',
  'rebase.sameCurrency': 'O orçamento já está em {to}. Escolha outra moeda.',
  'rebase.commitUnknown':
    'Não conseguimos confirmar se a moeda do orçamento mudou para {to}. Recarregue a página para conferir antes de tentar de novo.',
  'rebase.retry': 'Tentar de novo',
  'rebase.confirm': 'Mudar para {to}',
  'rebase.committing': 'Alterando a moeda do orçamento',
  'rebase.done': 'O orçamento agora está em {to}.',
} satisfies TranslationOf<typeof En>

export default messages
