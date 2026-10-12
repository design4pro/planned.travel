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
} satisfies TranslationOf<typeof En>

export default messages
