/**
 * The costs tab's copy, in zh-Hans.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **复数.** 简体中文只有 `other` 一个分支，人数用“位”作量词。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': '你',
  'person.youTarget': '你',
  'person.removed': '已移除的旅行者',
  /* ------------------------------------------------ delete an expense */
  'delete.title': '要删除这笔支出吗？',
  'delete.description': '“{title}”及其分摊将从结算中移除。此操作无法撤销。',
  'delete.failed': '删除失败',
  'delete.failedBody': '这笔支出没能删除。请稍后再试。',
  'delete.noBalances': '没有余额会变动 - 这笔支出没有分摊给任何人。',
  'delete.balancesChange': '{names} 的余额会变动。',
  'delete.confirm': '删除支出',
  'delete.working': '正在删除支出',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': '支出',
  'toolbar.shownOf': '{total} 笔中的 {shown} 笔',
  'toolbar.searchPlaceholder': '搜索支出、备注或付款人…',
  'toolbar.searchLabel': '搜索支出',
  'toolbar.allCategories': '所有类别',
  'toolbar.allDays': '所有日期',
  'toolbar.filterCategory': '按类别筛选',
  'toolbar.filterDay': '按日期筛选',
  'toolbar.whose': '谁的支出',
  'toolbar.paidByMe': '我付的',
  'toolbar.owedToMe': '别人欠我的',
  'toolbar.logged': {
    other: '已记 {value} 笔',
  },

  /* ------------------------------------------- the split editor */
  'split.section': '同行者之间的分摊',
  'split.label': '分摊给',
  'split.everyone': '所有人',
  'split.nobody': '无人',
  'split.how': '这笔支出怎么分',
  'split.method.equal': '平均',
  'split.method.equalHint':
    '纳入的每个人付同样多，除不尽的最小单位归列表中的第一个人。',
  'split.method.exact': '指定金额',
  'split.method.exactHint': '填写每个人实际该付的金额。各笔相加必须等于总额。',
  'split.method.shares': '份额',
  'split.method.sharesHint': '按权重分摊 - 一对情侣算 2 份，其他人各 1 份。',
  'split.method.percentage': '百分比',
  'split.method.percentageHint': '按百分比分摊。各项百分比相加必须是 100。',
  'split.exactFor': '{name} 的确切金额',
  'split.percentFor': '{name} 的百分比',
  'split.sharesFor': '{name} 的份额',
  'split.balanced': '正好',
  'split.allocated': '已分配 {total} 中的 {allocated}',
  'split.over': '超出 {amount}',
  'split.left': '还剩 {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': '金额',
  'field.currency': '货币',
  'field.date': '日期',
  'field.paidBy': '付款人',
  'expense.editTitle': '编辑这笔支出',
  'expense.addTitle': '添加支出',
  'expense.editDescription': '改动金额后，会在下面纳入的所有人之间重新分摊。',
  'expense.addDescription':
    '这趟行程的金额以 {currency} 记账。请按收据本身的货币录入，并填写换算后的金额。',
  'expense.saveFailed': '保存失败',
  'expense.what': '这笔钱花在什么上',
  'expense.whatPlaceholder': '在 Kyubey 的晚餐',
  'expense.amountNotANumber': '请用数字填写金额。',
  'expense.currencyLabel': '这张收据所用的货币',
  'expense.convertedTo': '换算为 {currency}',
  'expense.convertedHint': '你的账单上 {from} 折成 {to} 是多少。',
  'expense.convertedSuggested':
    '根据本次旅行在 {date} 使用的汇率（{rate}）给出的建议。请改成与你的账单一致。',
  'expense.convertedNotANumber': '请用数字填写换算后的金额。',
  'expense.dateLabel': '支出日期',
  'expense.paidByHint': '如果录入的是还没人垫付的收据，付款人可以留空。',
  'expense.nobodyYet': '还没有人',
  'expense.whoPaid': '谁付的',
  'expense.notesHint': '可选。收据上没写的都可以写在这里。',
  'expense.notesPlaceholder': '套餐平摊，饮料各付。',
  'expense.noAmount': '还没有金额',
  'expense.saving': '正在保存支出',
  'expense.saveChanges': '保存修改',
  'expense.add': '添加支出',

  /* ---------------------------------------- the payment dialog */
  'payment.title': '记录一笔付款',
  'payment.description':
    '记录一次转账会把它从双方余额中清掉。这并不会真的转钱 - planned.travel 只管账，转钱靠你的银行。',
  'payment.youSuffix': '{name}（我）',
  'payment.pays': '{from} 付给 {to}',
  'payment.pickTwo': '请选两个不同的人。',
  'payment.paidTo': '收款人',
  'payment.needsTwo': '一笔付款需要两个不同的人。',
  'payment.whoPaying': '谁付款',
  'payment.whoPaid': '谁收款',
  'payment.amountIn': '以 {currency} 计的金额',
  'payment.amountPositive': '请填写大于零的金额。',
  'payment.currencyLabel': '付款所用的货币',
  'payment.how': '方式',
  'payment.howMade': '这笔付款是怎么付的',
  'payment.dateLabel': '付款日期',
  'payment.note': '备注',
  'payment.noteHint': '可选。参考号，或者这笔钱付的是什么。',
  'payment.notePlaceholder': '包含京都的住宿和 JR 通票。',
  'payment.recording': '正在记录付款',
  'payment.confirm': '记录付款',
  'payment.failed': '这笔付款没能记录。请稍后再试。',
  'payment.method.bankTransfer': '银行转账',
  'payment.method.cash': '现金',
  'payment.method.card': '刷卡',
  'payment.method.app': '支付应用',
  'payment.method.other': '其他',

  /* --------------------------------------------------------- settle up */
  'settle.label': '结算',
  'settle.addPayment': '添加付款',
  'settle.action': '结算',
  'settle.empty.title': '大家都已结清',
  'settle.empty.body': '无需转账。记一笔支出，任何差额都会出现在这里。',
  /* ---------------------------------------------------------- balances */
  'balances.label': '余额',
  'balances.count': {
    other: '{travellers} 位旅行者',
  },
  'balances.empty': '支出有了付款人和分摊之后，余额就会出现。',
  /* ------------------------------------------------------- by category */
  'categories.label': '按类别',
  'categories.againstBudget': '对照行程预算',
  'categories.progressLabel': '对照行程预算的支出',
  'categories.empty': '预算项和支出一旦有内容，就会在这里拆解开来。',
  'categories.legendLabel': '按类别划分的支出',
  'categories.planned': '计划 {amount}',
  'categories.nothingSpent': '尚未支出。以下是你的计划。',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': '不到 {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': '这笔钱花在了谁身上',
  'memberBar.others': {
    other: '另外 {others} 位旅行者',
  },
  'memberBar.notSplit': '未分配给任何人',
  'totalTile.label': '行程总支出',
  'totalTile.captionPlanned': '所有旅行者合计计划 {amount}',
  'totalTile.captionBudget': '行程预算 {amount}',
  'totalTile.yourShare': '你的份额',
  'totalTile.youPaid': '你已支付',
  /* ------------------------------------------------- payments recorded */
  'payments.label': '已记录的付款',
  'payments.empty.title': '暂无付款',
  'payments.empty.body': '有人还清余额后，转账会记录在这里。',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': '你可以查看费用，但不能更改',
  'readOnly.body':
    '只有行程的所有者和有编辑权限的人才能添加、修改或删除支出以及记录付款。如需更改，请联系所有者。',
  'readOnly.empty':
    '此行程还没有记录任何支出。所有者或编辑者添加后会显示在这里。',
  'readOnly.settleEmpty': '目前无需任何转账。如有差额，会显示在这里。',
} satisfies TranslationOf<typeof En>

export default messages
