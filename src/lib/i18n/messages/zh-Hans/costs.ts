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
  'split.departed': '已离开行程',
  'split.departedHint': '取消勾选已离开行程的人，会永久删除其份额。',
  'split.includeFor': '将{name}纳入此次分摊',
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
  'refusal.rebaseChanged':
    '你确认的过程中行程发生了变化，所以没有做任何更改。请核对新的金额后再次确认。',
  'refusal.tripCurrencyChanged':
    '这趟行程的预算货币现在是 {to}，所以没有保存。页面已刷新，请核对金额后再次保存。',
  /* ---------------------------------------- display currency (#844) */
  'display.label': '显示货币',
  'display.indicator.perTrip': '行程自身货币',
  'display.indicator.fixed': '同时以 {code} 显示',
  'display.menu.perTrip': '每个行程使用其自身货币',
  'display.menu.workspace': '{code}（工作区默认）',
  'display.menu.rateHint': '使用行程中已记录的汇率',
  'display.menu.currentHint': '已选择，但没有已记录的汇率适用',
  'display.menu.needsLiveRate': '需要实时汇率，目前尚不可用',
  'display.menu.saving': '正在保存你的选择',
  'display.error.title': '未能保存显示货币',
  'display.error.body': '无法保存你的选择，请稍后再试。',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': '按你的显示货币约合 {amount} {code}',
  'display.row.notConverted': '未换算',
  'display.alert.title': '部分金额尚未换算',
  'display.alert.body':
    '这些货币对没有已记录的汇率，因此相关金额仍以预算货币显示：',
  'display.alert.pair': '{date} 的 {from} 兑 {to}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': '更改预算货币',
  'rebase.title': '更改预算货币',
  'rebase.description':
    '你输入的金额保持不变。这趟行程的合计和余额会换算成新的货币。',
  'rebase.to': '新货币',
  'rebase.toPlaceholder': '选择货币',
  'rebase.rateLabel': '汇率（1 {from} 兑 {to}）',
  'rebase.rateInverse': '也就是 1 {to} = {inverse} {from}。',
  'rebase.rateInvalid': '请输入大于零的汇率。',
  'rebase.rateOutOfRange': '这个汇率看起来过大或过小，请检查兑换方向是否反了。',
  'rebase.source.recent': '此工作区最近使用的汇率',
  'rebase.source.manual': '你输入的汇率',
  'rebase.noRate': '没有 {from} 兑 {to} 的汇率记录。请输入你想使用的汇率。',
  'rebase.waitingForRate': '有了汇率就会显示预览。',
  'rebase.loading': '正在计算换算结果',
  'rebase.example': '{original} 保持你输入的样子，并按 {converted} 计算。',
  'rebase.count.expenses': {
    other: '{count} 笔支出将按 {to} 计算。',
  },
  'rebase.count.payments': {
    other: '{count} 笔付款将按 {to} 计算。',
  },
  'rebase.count.planned': {
    other: '{count} 个计划项将按 {to} 计算。',
  },
  'rebase.pinned': '地点、预订、住宿和交通的价格仍以 {from} 计价。',
  'rebase.target': '行程预算 {before} 将变为 {after}。',
  'rebase.rounding': '每笔金额只四舍五入一次，因此余额最多可能变动 {amount}。',
  'rebase.leftover': '更改后，{name} 将欠 {other} {amount}。',
  'rebase.someone': '某人',
  'rebase.nothing': '这趟行程还没有定价的内容，所以无需换算。',
  'rebase.unconverted': {
    other:
      '有 {count} 条记录使用的不是 {from}，无法自动换算。它们通常是由以其他货币定价的预订生成的支出：请编辑或删除后再试。',
  },
  'rebase.unsplittable': {
    other:
      '有 {count} 笔支出的分摊无法沿用，因为其中每一份都是零。请编辑或删除后再试。',
  },
  'rebase.outOfRange':
    '按这个汇率，行程中有一笔金额会大到无法以 {to} 存储。请检查汇率和兑换方向。',
  'rebase.tooLarge':
    '这趟行程的记录太多，无法一次改完：需要同时做 {changes} 处更改，而上限是 {limit}。预算暂时仍以 {from} 计。',
  'rebase.copyPending': '这趟行程仍在复制中。请稍后再试。',
  'rebase.error': '无法加载换算结果。没有做任何更改。',
  'rebase.commitError': '无法更改预算货币。没有做任何更改。',
  'rebase.stale':
    '行程的预算货币现在是{current}，不再是{from}。请关闭此对话框后重新打开。',
  'rebase.sameCurrency': '预算已使用{to}。请选择其他货币。',
  'rebase.commitUnknown':
    '无法确认预算货币是否已更改为{to}。请先刷新页面检查，再重试。',
  'rebase.retry': '重试',
  'rebase.confirm': '改为 {to}',
  'rebase.committing': '正在更改预算货币',
  'rebase.done': '预算现在以 {to} 计。',
  // The costs screen (#1031)
  'screen.nothingSpent': '还没有支出',
  'screen.summary': '{expenses} · 已花费 {spent}',
  'count.expenses': {
    other: '{expenses} 笔支出',
  },
  'screen.exportCsv': '导出 CSV',
  'screen.addFirst': '添加第一笔支出',
  'screen.empty.title': '还没有支出',
  'screen.empty.body':
    '花了钱随手记一笔。planned.travel 会在所有旅行者之间分摊，并以 {currency} 计算累计总额。',
  'screen.filtered.title': '没有符合这些筛选条件的支出',
  'screen.filtered.body':
    '放宽搜索范围、换一天，或清除筛选，即可再次看到整个行程。',
  'export.empty.title': '没有可导出的内容',
  'export.empty.body': '没有符合当前筛选条件的支出。',
  'export.ready.title': '导出已就绪',
  'export.ready.body': {
    other: '已将 {expenses} 笔支出写入 CSV。',
  },
  'list.daySpent': '已花费 {amount}',
  'skeleton.loading': '正在加载支出',
  'row.noPayer': '暂无付款人',
  'row.youPaid': '你付的款',
  'row.paid': '{name} 付的款',
  'row.notYourShare': '不在你的分摊内',
  'row.yourShare': '你的部分 {amount}',
  'row.noteOn': '{title} 的备注',
  'row.edit': '编辑 {title}',
  'row.delete': '删除 {title}',
  'row.saving': '正在保存',
  'tile.owe.label': '你欠',
  'tile.owe.settled': '你已全部结清',
  'tile.owe.pending': '回家之前把账结清',
  'tile.owe.to': '付给',
  'tile.owed.label': '欠你',
  'tile.owed.none': '没有人欠你钱',
  'tile.owed.pending': '还有款项待还给你',
  'tile.owed.from': '来自',
  'tile.outstanding.label': '未结清',
  'tile.outstanding.none': '每笔支出都有付款人',
  'tile.outstanding.some': {
    other: '{expenses} 笔支出暂无付款人',
  },
  'category.accommodation': '住宿',
  'category.transport': '交通',
  'category.food': '餐饮',
  'category.activities': '活动',
  'category.shopping': '购物',
  'category.fees': '费用与手续费',
  'category.insurance': '保险',
  'category.other': '其他',
  'toolbar.summary.everything': '正在显示全部',
  'toolbar.summary.filtered': '已筛选：{filters}',
  'toolbar.summary.search': '匹配“{term}”',
  'write.added': '已添加支出',
  'write.updated': '已更新支出',
  'write.deleted': '已删除支出',
  'write.addFailed': '支出未能添加',
  'write.editFailed': '支出未能保存',
  'write.deleteFailed': '支出未能删除',
  'write.paymentRecorded': '已记录付款',
  'write.paymentRecordedBody': '双方的余额都已更新。',
  'write.paymentFailed': '付款未能记录',
  'write.rolledBack': '更改已撤回。',
  'expense.saveFallback': '无法保存这笔支出。请稍后再试。',
  'delete.removedTraveller': '一位已移除的旅行者',
} satisfies TranslationOf<typeof En>

export default messages
