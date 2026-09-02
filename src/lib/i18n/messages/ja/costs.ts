/**
 * The costs tab's copy, in ja.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複数形.** 日本語は `other` の一分岐のみ。数詞は助数詞を伴うため、
 * 人数は「{travellers}人」と組む。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'あなた',
  'person.youTarget': 'あなた',
  'person.removed': '削除された旅行者',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'この支出を削除しますか？',
  'delete.description':
    '「{title}」とその分担が精算から消えます。取り消せません。',
  'delete.failed': '削除できませんでした',
  'delete.failedBody':
    '支出を削除できませんでした。少し待って、もう一度お試しください。',
  'delete.noBalances':
    '残高は変わりません。この支出は誰にも分けられていません。',
  'delete.balancesChange': '{names} の残高が変わります。',
  'delete.confirm': '支出を削除',
  'delete.working': '支出を削除しています',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': '支出',
  'toolbar.shownOf': '{total} 件中 {shown} 件',
  'toolbar.searchPlaceholder': '支出・メモ・支払った人を検索…',
  'toolbar.searchLabel': '支出を検索',
  'toolbar.allCategories': 'すべてのカテゴリ',
  'toolbar.allDays': 'すべての日',
  'toolbar.filterCategory': 'カテゴリで絞り込む',
  'toolbar.filterDay': '日付で絞り込む',
  'toolbar.whose': '誰の支出か',
  'toolbar.paidByMe': '自分が支払った分',
  'toolbar.owedToMe': '自分に返ってくる分',
  'toolbar.logged': {
    other: '{value} 件',
  },

  /* ------------------------------------------- the split editor */
  'split.section': '同行者間の分担',
  'split.label': '分担する相手',
  'split.everyone': '全員',
  'split.nobody': 'なし',
  'split.how': 'この支出の分け方',
  'split.method.equal': '均等',
  'split.method.equalHint':
    '対象の全員が同額を負担し、割り切れない最小単位はリストの先頭の人が引き受けます。',
  'split.method.exact': '金額指定',
  'split.method.exactHint':
    '各自が実際に負担する額を入力します。合計が総額と一致する必要があります。',
  'split.method.shares': '比率',
  'split.method.sharesHint':
    '重みを付けて分けます。カップルなら2、ほかは1というふうに。',
  'split.method.percentage': 'パーセント',
  'split.method.percentageHint':
    'パーセントで分けます。合計が100になる必要があります。',
  'split.exactFor': '{name} の正確な金額',
  'split.percentFor': '{name} のパーセント',
  'split.sharesFor': '{name} の比率',
  'split.balanced': '一致',
  'split.allocated': '{total} のうち {allocated} を割り当て',
  'split.over': '{amount} 超過',
  'split.left': '残り {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': '金額',
  'field.currency': '通貨',
  'field.date': '日付',
  'field.paidBy': '支払った人',
  'expense.editTitle': 'この支出を編集',
  'expense.addTitle': '支出を追加',
  'expense.editDescription':
    '金額を変えると、下で対象になっている全員のあいだで再度分担されます。',
  'expense.addDescription':
    'この旅行の金額は {currency} で管理します。レシートはその通貨で記録し、換算後の額を入力してください。',
  'expense.saveFailed': '保存できませんでした',
  'expense.what': '何の費用か',
  'expense.whatPlaceholder': 'Kyubey での夕食',
  'expense.amountNotANumber': '金額は数字で入力してください。',
  'expense.currencyLabel': 'このレシートが書かれている通貨',
  'expense.convertedTo': '{currency} に換算',
  'expense.convertedHint': '明細で {from} が {to} でいくらになったか。',
  'expense.convertedNotANumber': '換算後の金額は数字で入力してください。',
  'expense.dateLabel': '支出した日',
  'expense.paidByHint':
    '誰も立て替えていないレシートを記録するなら、支払った人は空のままで構いません。',
  'expense.nobodyYet': 'まだ誰もいません',
  'expense.whoPaid': '支払った人',
  'expense.notesHint': '任意。レシートに書かれていないこと。',
  'expense.notesPlaceholder': 'コース料理は割り勘、飲み物は別。',
  'expense.noAmount': 'まだ金額がありません',
  'expense.saving': '支出を保存しています',
  'expense.saveChanges': '変更を保存',
  'expense.add': '支出を追加',

  /* ---------------------------------------- the payment dialog */
  'payment.title': '支払いを記録',
  'payment.description':
    '送金を記録すると、双方の残高から消えます。実際にお金が動くわけではありません。planned.travel は帳簿を持つだけで、送金するのはあなたの銀行です。',
  'payment.youSuffix': '{name}（自分）',
  'payment.pays': '{from} から {to} へ',
  'payment.pickTwo': '別々の2人を選んでください。',
  'payment.paidTo': '受け取った人',
  'payment.needsTwo': '支払いには別々の2人が必要です。',
  'payment.whoPaying': '支払う人',
  'payment.whoPaid': '受け取る人',
  'payment.amountIn': '{currency} での金額',
  'payment.amountPositive': '0 より大きい金額を入力してください。',
  'payment.how': '方法',
  'payment.howMade': '支払いの方法',
  'payment.dateLabel': '支払った日',
  'payment.note': 'メモ',
  'payment.noteHint': '任意。参照番号や、何の分か。',
  'payment.notePlaceholder': '京都のホテルと JR パスの分。',
  'payment.recording': '支払いを記録しています',
  'payment.confirm': '支払いを記録',
  'payment.failed':
    '支払いを記録できませんでした。少し待って、もう一度お試しください。',
  'payment.method.bankTransfer': '銀行振込',
  'payment.method.cash': '現金',
  'payment.method.card': 'カード',
  'payment.method.app': '決済アプリ',
  'payment.method.other': 'その他',

  /* --------------------------------------------------------- settle up */
  'settle.label': '精算',
  'settle.addPayment': '支払いを記録',
  'settle.action': '精算する',
  'settle.empty.title': '全員が精算済みです',
  'settle.empty.body':
    '送金は必要ありません。支出を記録すると、差額がここに表示されます。',
  /* ---------------------------------------------------------- balances */
  'balances.label': '残高',
  'balances.count': {
    other: '{travellers}人',
  },
  'balances.empty': '支出に支払者と分担が設定されると残高が表示されます。',
  /* ------------------------------------------------------- by category */
  'categories.label': 'カテゴリー別',
  'categories.againstBudget': '旅行の予算に対して',
  'categories.progressLabel': '旅行の予算に対する支出',
  'categories.empty':
    '予算項目と支出は、内訳が生まれた時点でここに分解されます。',
  /* ------------------------------------------------- payments recorded */
  'payments.label': '記録された支払い',
  'payments.empty.title': 'まだ支払いはありません',
  'payments.empty.body': '誰かが残高を返済すると、送金がここに記録されます。',
} satisfies TranslationOf<typeof En>

export default messages
