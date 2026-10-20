/**
 * The costs tab's copy, in zh-Hant.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複數.** 繁體中文只有 `other` 一個分支，人數用「位」作量詞。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': '你',
  'person.youTarget': '你',
  'person.removed': '已移除的旅行者',
  'person.removedTarget': '一位已移除的旅行者',
  /* ------------------------------------------------ delete an expense */
  'delete.title': '要刪除這筆支出嗎？',
  'delete.description': '「{title}」及其分攤將從結算中移除。此操作無法復原。',
  'delete.failed': '刪除失敗',
  'delete.failedBody': '這筆支出沒能刪除。請稍後再試。',
  'delete.noBalances': '沒有餘額會變動 - 這筆支出沒有分攤給任何人。',
  'delete.balancesChange': '{names} 的餘額會變動。',
  'delete.confirm': '刪除支出',
  'delete.working': '正在刪除支出',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': '支出',
  'toolbar.shownOf': '{total} 筆中的 {shown} 筆',
  'toolbar.searchPlaceholder': '搜尋支出、備註或付款人…',
  'toolbar.searchLabel': '搜尋支出',
  'toolbar.allCategories': '所有類別',
  'toolbar.allDays': '所有日期',
  'toolbar.filterCategory': '按類別篩選',
  'toolbar.filterDay': '按日期篩選',
  'toolbar.whose': '誰的支出',
  'toolbar.paidByMe': '我付的',
  'toolbar.owedToMe': '別人欠我的',
  'toolbar.logged': {
    other: '已記 {value} 筆',
  },

  /* ------------------------------------------- the split editor */
  'split.section': '同行者之間的分攤',
  'split.label': '分攤給',
  'split.everyone': '所有人',
  'split.nobody': '無人',
  'split.departed': '已離開行程',
  'split.departedHint': '取消勾選已離開行程的人，會永久刪除其份額。',
  'split.includeFor': '將{name}納入此次分攤',
  'split.how': '這筆支出怎麼分',
  'split.method.equal': '平均',
  'split.method.equalHint':
    '納入的每個人付一樣多，除不盡的最小單位歸清單中的第一個人。',
  'split.method.exact': '指定金額',
  'split.method.exactHint': '填寫每個人實際該付的金額。各筆相加必須等於總額。',
  'split.method.shares': '份額',
  'split.method.sharesHint': '按權重分攤 - 一對情侶算 2 份，其他人各 1 份。',
  'split.method.percentage': '百分比',
  'split.method.percentageHint': '按百分比分攤。各項百分比相加必須是 100。',
  'split.exactFor': '{name} 的確切金額',
  'split.percentFor': '{name} 的百分比',
  'split.sharesFor': '{name} 的份額',
  'split.balanced': '剛好',
  'split.allocated': '已分配 {total} 中的 {allocated}',
  'split.over': '超出 {amount}',
  'split.left': '還剩 {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': '金額',
  'field.currency': '貨幣',
  'field.date': '日期',
  'field.paidBy': '付款人',
  'expense.editTitle': '編輯這筆支出',
  'expense.addTitle': '新增支出',
  'expense.editDescription': '改動金額後，會在下面納入的所有人之間重新分攤。',
  'expense.addDescription':
    '這趟行程的金額以 {currency} 記帳。請按收據本身的貨幣輸入，並填寫換算後的金額。',
  'expense.saveFailed': '儲存失敗',
  'expense.what': '這筆錢花在什麼上',
  'expense.whatPlaceholder': '在 Kyubey 的晚餐',
  'expense.amountNotANumber': '請用數字填寫金額。',
  'expense.currencyLabel': '這張收據所用的貨幣',
  'expense.convertedTo': '換算為 {currency}',
  'expense.convertedHint': '你的帳單上 {from} 折成 {to} 是多少。',
  'expense.convertedSuggested':
    '依據本次旅行在 {date} 使用的匯率（{rate}）所提供的建議。請改成與你的帳單一致。',
  'expense.convertedNotANumber': '請用數字填寫換算後的金額。',
  'expense.dateLabel': '支出日期',
  'expense.paidByHint': '如果輸入的是還沒人代墊的收據，付款人可以留空。',
  'expense.nobodyYet': '還沒有人',
  'expense.whoPaid': '誰付的',
  'expense.notesHint': '選填。收據上沒寫的都可以寫在這裡。',
  'expense.notesPlaceholder': '套餐平攤，飲料各付。',
  'expense.noAmount': '還沒有金額',
  'expense.saving': '正在儲存支出',
  'expense.saveChanges': '儲存修改',
  'expense.add': '新增支出',

  /* ---------------------------------------- the payment dialog */
  'payment.title': '記錄一筆付款',
  'payment.description':
    '記錄一次轉帳會把它從雙方餘額中清掉。這並不會真的轉錢 - planned.travel 只管帳，轉錢靠你的銀行。',
  'payment.youSuffix': '{name}（我）',
  'payment.pays': '{from} 付給 {to}',
  'payment.pickTwo': '請選兩個不同的人。',
  'payment.paidTo': '收款人',
  'payment.needsTwo': '一筆付款需要兩個不同的人。',
  'payment.whoPaying': '誰付款',
  'payment.whoPaid': '誰收款',
  'payment.amountIn': '以 {currency} 計的金額',
  'payment.amountPositive': '請填寫大於零的金額。',
  'payment.currencyLabel': '付款所用的貨幣',
  'payment.how': '方式',
  'payment.howMade': '這筆付款是怎麼付的',
  'payment.dateLabel': '付款日期',
  'payment.note': '備註',
  'payment.noteHint': '選填。參考號，或者這筆錢付的是什麼。',
  'payment.notePlaceholder': '包含京都的住宿和 JR 通票。',
  'payment.recording': '正在記錄付款',
  'payment.confirm': '記錄付款',
  'payment.failed': '這筆付款沒能記錄。請稍後再試。',
  'payment.method.bankTransfer': '銀行轉帳',
  'payment.method.cash': '現金',
  'payment.method.card': '刷卡',
  'payment.method.app': '支付應用',
  'payment.method.other': '其他',

  /* --------------------------------------------------------- settle up */
  'settle.label': '結算',
  'settle.addPayment': '新增付款',
  'settle.action': '結算',
  'settle.empty.title': '大家都已結清',
  'settle.empty.body': '無需轉帳。記一筆支出，任何差額都會出現在這裡。',
  /* ---------------------------------------------------------- balances */
  'balances.label': '餘額',
  'balances.count': {
    other: '{travellers} 位旅行者',
  },
  'balances.empty': '支出有了付款人與分攤之後，餘額就會出現。',
  /* ------------------------------------------------------- by category */
  'categories.label': '依類別',
  'categories.againstBudget': '對照行程預算',
  'categories.progressLabel': '對照行程預算的支出',
  'categories.empty': '預算項目與支出一旦有內容，就會在這裡拆解開來。',
  'categories.legendLabel': '依類別劃分的支出',
  'categories.planned': '預計 {amount}',
  'categories.nothingSpent': '尚未支出。以下是你的計畫。',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': '不到 {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': '這筆錢花在了誰身上',
  'memberBar.others': {
    other: '另外 {others} 位旅行者',
  },
  'memberBar.notSplit': '未分配給任何人',
  'totalTile.label': '行程總支出',
  'totalTile.captionPlanned': '所有旅行者合計預計 {amount}',
  'totalTile.captionBudget': '行程預算 {amount}',
  'totalTile.yourShare': '你的份額',
  'totalTile.youPaid': '你已支付',
  /* ------------------------------------------------- payments recorded */
  'payments.label': '已記錄的付款',
  'payments.empty.title': '尚無付款',
  'payments.empty.body': '有人還清餘額後，轉帳會記錄在這裡。',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived': '此行程已封存。請先還原行程再修改費用。',
  'readOnly.title': '你可以查看費用，但無法變更',
  'readOnly.body':
    '只有行程的擁有者和具編輯權限的人才能新增、修改或刪除支出並記錄付款。如需變更，請聯絡擁有者。',
  'readOnly.empty':
    '此行程尚未記錄任何支出。擁有者或編輯者新增後會顯示在這裡。',
  'readOnly.settleEmpty': '目前不需要任何轉帳。若有差額，會顯示在這裡。',
  'refusal.rebaseChanged':
    '你確認的過程中行程發生了變化，所以沒有做任何變更。請核對新的金額後再次確認。',
  'refusal.tripCurrencyChanged':
    '這趟行程的預算貨幣現在是 {to}，所以沒有儲存。頁面已重新整理，請核對金額後再次儲存。',
  /* ---------------------------------------- display currency (#844) */
  'display.label': '顯示貨幣',
  'display.indicator.perTrip': '行程自身貨幣',
  'display.indicator.fixed': '同時以 {code} 顯示',
  'display.menu.perTrip': '每個行程使用其自身貨幣',
  'display.menu.workspace': '{code}（工作區預設）',
  'display.menu.rateHint': '使用行程中已記錄的匯率',
  'display.menu.currentHint': '已選擇，但沒有已記錄的匯率適用',
  'display.menu.needsLiveRate': '需要即時匯率，目前尚無法使用',
  'display.menu.saving': '正在儲存你的選擇',
  'display.error.title': '未能儲存顯示貨幣',
  'display.error.body': '無法儲存你的選擇，請稍後再試。',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': '依你的顯示貨幣約合 {amount} {code}',
  'display.row.notConverted': '未換算',
  'display.alert.title': '部分金額尚未換算',
  'display.alert.body':
    '這些貨幣對沒有已記錄的匯率，因此相關金額仍以預算貨幣顯示：',
  'display.alert.pair': '{date} 的 {from} 兌 {to}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': '變更預算貨幣',
  'rebase.title': '變更預算貨幣',
  'rebase.description':
    '你輸入的金額維持不變。這趟行程的合計和餘額會換算成新的貨幣。',
  'rebase.to': '新貨幣',
  'rebase.toPlaceholder': '選擇貨幣',
  'rebase.rateLabel': '匯率（1 {from} 兌 {to}）',
  'rebase.rateInverse': '也就是 1 {to} = {inverse} {from}。',
  'rebase.rateInvalid': '請輸入大於零的匯率。',
  'rebase.rateOutOfRange': '這個匯率看起來過大或過小，請檢查兌換方向是否反了。',
  'rebase.source.recent': '此工作區最近使用的匯率',
  'rebase.source.manual': '你輸入的匯率',
  'rebase.noRate': '沒有 {from} 兌 {to} 的匯率記錄。請輸入你想使用的匯率。',
  'rebase.waitingForRate': '有了匯率就會顯示預覽。',
  'rebase.loading': '正在計算換算結果',
  'rebase.example': '{original} 維持你輸入的樣子，並按 {converted} 計算。',
  'rebase.count.expenses': {
    other: '{count} 筆支出將按 {to} 計算。',
  },
  'rebase.count.payments': {
    other: '{count} 筆付款將按 {to} 計算。',
  },
  'rebase.count.planned': {
    other: '{count} 個計劃項目將按 {to} 計算。',
  },
  'rebase.pinned': '地點、預訂、住宿和交通的價格仍以 {from} 計價。',
  'rebase.target': '行程預算 {before} 將變為 {after}。',
  'rebase.rounding': '每筆金額只四捨五入一次，因此餘額最多可能變動 {amount}。',
  'rebase.leftover': '變更後，{name} 將欠 {other} {amount}。',
  'rebase.someone': '某人',
  'rebase.nothing': '這趟行程還沒有定價的內容，所以無需換算。',
  'rebase.unconverted': {
    other:
      '有 {count} 筆記錄使用的不是 {from}，無法自動換算。它們通常是由以其他貨幣定價的預訂產生的支出：請編輯或刪除後再試。',
  },
  'rebase.unsplittable': {
    other:
      '有 {count} 筆支出的分攤無法沿用，因為其中每一份都是零。請編輯或刪除後再試。',
  },
  'rebase.outOfRange':
    '依這個匯率，行程中有一筆金額會大到無法以 {to} 儲存。請檢查匯率和兌換方向。',
  'rebase.tooLarge':
    '這趟行程的記錄太多，無法一次改完：需要同時做 {changes} 處變更，而上限是 {limit}。預算暫時仍以 {from} 計。',
  'rebase.copyPending': '這趟行程仍在複製中。請稍後再試。',
  'rebase.error': '無法載入換算結果。沒有做任何變更。',
  'rebase.commitError': '無法變更預算貨幣。沒有做任何變更。',
  'rebase.stale':
    '行程的預算貨幣現在是{current}，不再是{from}。請關閉此對話框後重新開啟。',
  'rebase.sameCurrency': '預算已使用{to}。請選擇其他貨幣。',
  'rebase.commitUnknown':
    '無法確認預算貨幣是否已變更為{to}。請先重新整理頁面檢查，再重試。',
  'rebase.retry': '重試',
  'rebase.confirm': '改為 {to}',
  'rebase.committing': '正在變更預算貨幣',
  'rebase.done': '預算現在以 {to} 計。',
  // The costs screen (#1031)
  'screen.nothingSpent': '還沒有支出',
  'screen.summary': '{expenses} · 已花費 {spent}',
  'count.expenses': {
    other: '{expenses} 筆支出',
  },
  'screen.exportCsv': '匯出 CSV',
  'screen.addFirst': '新增第一筆支出',
  'screen.empty.title': '還沒有支出',
  'screen.empty.body':
    '花了錢隨手記一筆。planned.travel 會在所有旅行者之間分攤，並以 {currency} 計算累計總額。',
  'screen.filtered.title': '沒有符合這些篩選條件的支出',
  'screen.filtered.body':
    '放寬搜尋範圍、換一天，或清除篩選，即可再次看到整個行程。',
  'export.empty.title': '沒有可匯出的內容',
  'export.empty.body': '沒有符合目前篩選條件的支出。',
  'export.ready.title': '匯出已就緒',
  'export.ready.body': {
    other: '已將 {expenses} 筆支出寫入 CSV。',
  },
  'list.daySpent': '已花費 {amount}',
  'skeleton.loading': '正在載入支出',
  'row.noPayer': '尚無付款人',
  'row.youPaid': '你付的款',
  'row.paid': '{name} 付的款',
  'row.notYourShare': '不在你的分攤內',
  'row.yourShare': '你的部分 {amount}',
  'row.noteOn': '{title} 的備註',
  'row.edit': '編輯 {title}',
  'row.delete': '刪除 {title}',
  'row.saving': '正在儲存',
  'tile.owe.label': '你欠',
  'tile.owe.settled': '你已全部結清',
  'tile.owe.pending': '回家之前把帳結清',
  'tile.owe.to': '付給',
  'tile.owed.label': '欠你',
  'tile.owed.none': '沒有人欠你錢',
  'tile.owed.pending': '還有款項待還給你',
  'tile.owed.from': '來自',
  'tile.outstanding.label': '未結清',
  'tile.outstanding.none': '每筆支出都有付款人',
  'tile.outstanding.some': {
    other: '{expenses} 筆支出尚無付款人',
  },
  'category.accommodation': '住宿',
  'category.transport': '交通',
  'category.food': '餐飲',
  'category.activities': '活動',
  'category.shopping': '購物',
  'category.fees': '費用與手續費',
  'category.insurance': '保險',
  'category.other': '其他',
  'toolbar.summary.everything': '正在顯示全部',
  'toolbar.summary.filtered': '已篩選：{filters}',
  'toolbar.summary.search': '符合「{term}」',
  'write.added': '已新增支出',
  'write.updated': '已更新支出',
  'write.deleted': '已刪除支出',
  'write.addFailed': '支出未能新增',
  'write.editFailed': '支出未能儲存',
  'write.deleteFailed': '支出未能刪除',
  'write.paymentRecorded': '已記錄付款',
  'write.paymentRecordedBody': '雙方的餘額都已更新。',
  'write.paymentFailed': '付款未能記錄',
  'write.rolledBack': '變更已撤回。',
  'expense.saveFallback': '無法儲存這筆支出。請稍後再試。',
} satisfies TranslationOf<typeof En>

export default messages
