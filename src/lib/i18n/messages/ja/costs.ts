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
  'person.removedTarget': '削除された旅行者',
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
  'split.departed': '旅行から抜けました',
  'split.departedHint':
    '旅行から抜けた人のチェックを外すと、その人の負担分は完全に削除されます。',
  'split.includeFor': '{name}をこの分割に含める',
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
  'expense.convertedSuggested':
    'この旅行で {date} に使われたレート ({rate}) から提案しています。明細に合わせて変更してください。',
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
  'payment.currencyLabel': '支払いに使った通貨',
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
  'categories.legendLabel': 'カテゴリ別の支出',
  'categories.planned': '予定 {amount}',
  'categories.nothingSpent':
    'まだ支出はありません。予定している内容は次のとおりです。',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': '{percent}未満',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': '誰のための支出か',
  'memberBar.others': {
    other: 'ほか{others}人',
  },
  'memberBar.notSplit': '誰にも割り当てなし',
  'totalTile.label': '旅行の支出合計',
  'totalTile.captionPlanned': '全員で{amount}を予定',
  'totalTile.captionBudget': '旅行の予算は{amount}',
  'totalTile.yourShare': 'あなたの負担額',
  'totalTile.youPaid': 'あなたの支払額',
  /* ------------------------------------------------- payments recorded */
  'payments.label': '記録された支払い',
  'payments.empty.title': 'まだ支払いはありません',
  'payments.empty.body': '誰かが残高を返済すると、送金がここに記録されます。',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'この旅行はアーカイブされています。費用を変更する前に復元してください。',
  'readOnly.title': '費用は閲覧のみで、変更はできません',
  'readOnly.body':
    '経費の追加・編集・削除や支払いの記録ができるのは、旅行のオーナーと編集権限のあるメンバーだけです。変更が必要な場合はオーナーにお問い合わせください。',
  'readOnly.empty':
    'この旅行にはまだ経費が記録されていません。オーナーまたは編集者が追加すると、ここに表示されます。',
  'readOnly.settleEmpty':
    '現在、送金は必要ありません。差額が生じた場合はここに表示されます。',
  'refusal.rebaseChanged':
    '確認している間に旅行が変更されたため、何も変更されていません。新しい金額を確認して、もう一度確定してください。',
  'refusal.tripCurrencyChanged':
    'この旅行の予算の通貨が {to} に変わったため、保存されませんでした。ページを更新しました。金額を確認して、もう一度保存してください。',
  /* ---------------------------------------- display currency (#844) */
  'display.label': '表示通貨',
  'display.indicator.perTrip': 'その旅行の通貨',
  'display.indicator.fixed': '{code} でも表示',
  'display.menu.perTrip': '各旅行をその旅行の通貨で',
  'display.menu.workspace': '{code}（ワークスペースの既定）',
  'display.menu.rateHint': '旅行に記録済みのレートを使用します',
  'display.menu.currentHint':
    '選択中ですが、記録済みのレートが対応していません',
  'display.menu.needsLiveRate':
    'リアルタイムのレートが必要ですが、まだ利用できません',
  'display.menu.saving': '選択を保存しています',
  'display.error.title': '表示通貨を保存できませんでした',
  'display.error.body':
    '選択を保存できませんでした。しばらくしてからもう一度お試しください。',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': '表示通貨でおよそ {amount} {code}',
  'display.row.notConverted': '未換算',
  'display.alert.title': '一部の金額は換算されていません',
  'display.alert.body':
    '次の通貨ペアにはレートが記録されていないため、これらの金額は予算の通貨のままです：',
  'display.alert.pair': '{date} の {from} から {to}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': '予算の通貨を変更',
  'rebase.title': '予算の通貨を変更する',
  'rebase.description':
    '入力した金額はそのまま残ります。この旅行の合計と残高は新しい通貨に換算されます。',
  'rebase.to': '新しい通貨',
  'rebase.toPlaceholder': '通貨を選択',
  'rebase.rateLabel': '為替レート（1 {from} あたりの {to}）',
  'rebase.rateInverse': 'つまり 1 {to} = {inverse} {from} です。',
  'rebase.rateInvalid': '0 より大きいレートを入力してください。',
  'rebase.rateOutOfRange':
    'このレートは大きすぎる、または小さすぎるようです。通貨の向きを確認してください。',
  'rebase.source.recent': 'このワークスペースで最後に使ったレート',
  'rebase.source.manual': '入力したレート',
  'rebase.noRate':
    '{from} から {to} へのレートが記録されていません。使用するレートを入力してください。',
  'rebase.waitingForRate': 'レートが決まるとプレビューが表示されます。',
  'rebase.loading': '換算を計算しています',
  'rebase.example':
    '{original} は入力したまま残り、{converted} として集計されます。',
  'rebase.count.expenses': {
    other: '支出 {count} 件が {to} で集計されます。',
  },
  'rebase.count.payments': {
    other: '支払い {count} 件が {to} で集計されます。',
  },
  'rebase.count.planned': {
    other: '予定の項目 {count} 件が {to} で集計されます。',
  },
  'rebase.pinned': '場所、予約、宿泊、移動の価格は {from} のままです。',
  'rebase.target': '旅行の予算 {before} は {after} になります。',
  'rebase.rounding':
    '金額ごとに1回ずつ丸めるため、残高が最大 {amount} ずれることがあります。',
  'rebase.leftover': '変更後、{name} は {other} に {amount} の借りが残ります。',
  'rebase.someone': '誰か',
  'rebase.nothing':
    'この旅行にはまだ金額の入った項目がないため、換算するものはありません。',
  'rebase.unconverted': {
    other:
      '{count} 件が {from} 以外の通貨のため、自動で換算できません。多くは、別の通貨の価格が付いた予約から作られた支出です。編集または削除してから、もう一度お試しください。',
  },
  'rebase.unsplittable': {
    other:
      '{count} 件の支出は、すべての負担額が 0 のため、分担を引き継げません。編集または削除してから、もう一度お試しください。',
  },
  'rebase.outOfRange':
    'このレートだと、旅行内の金額が {to} で保存できないほど大きくなります。レートと通貨の向きを確認してください。',
  'rebase.tooLarge':
    'この旅行は項目が多すぎて一度に変更できません。一度に {changes} 件の変更が必要ですが、上限は {limit} 件です。予算は当面 {from} のままです。',
  'rebase.copyPending':
    'この旅行はまだコピー中です。しばらくしてからもう一度お試しください。',
  'rebase.error': '換算を読み込めませんでした。何も変更されていません。',
  'rebase.commitError':
    '予算の通貨を変更できませんでした。何も変更されていません。',
  'rebase.stale':
    '旅行の予算通貨は現在{from}ではなく{current}です。このダイアログを閉じて、開き直してください。',
  'rebase.sameCurrency': '予算はすでに{to}です。別の通貨を選んでください。',
  'rebase.commitUnknown':
    '予算の通貨が{to}に変更されたか確認できませんでした。もう一度試す前に、ページを再読み込みして確認してください。',
  'rebase.retry': 'もう一度試す',
  'rebase.confirm': '{to} に変更',
  'rebase.committing': '予算の通貨を変更しています',
  'rebase.done': '予算は {to} になりました。',
  // The costs screen (#1031)
  'screen.nothingSpent': 'まだ支出はありません',
  'screen.summary': '{expenses} · 支出 {spent}',
  'count.expenses': {
    other: '{expenses} 件',
  },
  'screen.exportCsv': 'CSV を書き出す',
  'screen.addFirst': '最初の支出を追加',
  'screen.empty.title': 'まだ支出がありません',
  'screen.empty.body':
    '使ったお金をその都度記録しましょう。planned.travel が旅行者全員で分担し、{currency} で累計を管理します。',
  'screen.filtered.title': '条件に合う支出はありません',
  'screen.filtered.body':
    '検索条件を広げる、別の日を選ぶ、またはフィルターを解除すると、旅行全体が再び表示されます。',
  'export.empty.title': '書き出す内容がありません',
  'export.empty.body': '適用中のフィルターに合う支出がありません。',
  'export.ready.title': '書き出しの準備ができました',
  'export.ready.body': {
    other: '{expenses} 件の支出を CSV に書き出しました。',
  },
  'list.daySpent': '支出 {amount}',
  'skeleton.loading': '支出を読み込み中',
  'row.noPayer': '支払った人が未設定',
  'row.youPaid': 'あなたが支払い',
  'row.paid': '{name} が支払い',
  'row.notYourShare': 'あなたの分担ではありません',
  'row.yourShare': 'あなたの分 {amount}',
  'row.noteOn': '{title} のメモ',
  'row.edit': '{title} を編集',
  'row.delete': '{title} を削除',
  'row.saving': '保存中',
  'tile.owe.label': '支払うべき額',
  'tile.owe.settled': 'すべて精算済みです',
  'tile.owe.pending': '帰国前に精算しましょう',
  'tile.owe.to': '支払先',
  'tile.owed.label': 'あなたが受け取る額',
  'tile.owed.none': '受け取る分はありません',
  'tile.owed.pending': 'まだ戻ってきていません',
  'tile.owed.from': '支払元',
  'tile.outstanding.label': '未精算',
  'tile.outstanding.none': 'すべての支出に支払った人がいます',
  'tile.outstanding.some': {
    other: '支払った人が未設定の支出 {expenses} 件',
  },
  'category.accommodation': '宿泊',
  'category.transport': '交通',
  'category.food': '飲食',
  'category.activities': 'アクティビティ',
  'category.shopping': 'ショッピング',
  'category.fees': '手数料・諸費用',
  'category.insurance': '保険',
  'category.other': 'その他',
  'toolbar.summary.everything': 'すべて表示中',
  'toolbar.summary.filtered': '絞り込み: {filters}',
  'toolbar.summary.search': '「{term}」に一致',
  'write.added': '支出を追加しました',
  'write.updated': '支出を更新しました',
  'write.deleted': '支出を削除しました',
  'write.addFailed': '支出を追加できませんでした',
  'write.editFailed': '支出を保存できませんでした',
  'write.deleteFailed': '支出を削除できませんでした',
  'write.paymentRecorded': '支払いを記録しました',
  'write.paymentRecordedBody': '双方の残高を更新しました。',
  'write.paymentFailed': '支払いを記録できませんでした',
  'write.rolledBack': '変更を元に戻しました。',
  'expense.saveFallback':
    '支出を保存できませんでした。しばらくしてからもう一度お試しください。',
} satisfies TranslationOf<typeof En>

export default messages
