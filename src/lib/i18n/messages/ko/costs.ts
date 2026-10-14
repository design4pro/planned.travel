/**
 * The costs tab's copy, in ko.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **복수형.** 한국어는 `other` 한 분기만 사용하고, 사람 수는 “명”으로 센다.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': '나',
  'person.youTarget': '나에게',
  'person.removed': '삭제된 여행자',
  /* ------------------------------------------------ delete an expense */
  'delete.title': '이 지출을 삭제할까요?',
  'delete.description':
    '「{title}」과 그 분담이 정산에서 사라집니다. 되돌릴 수 없습니다.',
  'delete.failed': '삭제하지 못했습니다',
  'delete.failedBody':
    '지출을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  'delete.noBalances':
    '잔액은 바뀌지 않습니다. 이 지출은 아무에게도 나뉘지 않았습니다.',
  'delete.balancesChange': '{names}의 잔액이 바뀝니다.',
  'delete.confirm': '지출 삭제',
  'delete.working': '지출을 삭제하는 중',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': '지출',
  'toolbar.shownOf': '{total}개 중 {shown}개',
  'toolbar.searchPlaceholder': '지출·메모·결제한 사람 검색…',
  'toolbar.searchLabel': '지출 검색',
  'toolbar.allCategories': '모든 분류',
  'toolbar.allDays': '모든 날짜',
  'toolbar.filterCategory': '분류로 걸러 보기',
  'toolbar.filterDay': '날짜로 걸러 보기',
  'toolbar.whose': '누구의 지출인지',
  'toolbar.paidByMe': '내가 결제한 것',
  'toolbar.owedToMe': '내가 받을 것',
  'toolbar.logged': {
    other: '{value}건 기록',
  },

  /* ------------------------------------------- the split editor */
  'split.section': '동행자 간 분담',
  'split.label': '분담 대상',
  'split.everyone': '전원',
  'split.nobody': '없음',
  'split.how': '이 지출을 나누는 방식',
  'split.method.equal': '균등',
  'split.method.equalHint':
    '포함된 사람 모두 같은 금액을 냅니다. 나누어 떨어지지 않는 최소 단위는 목록 첫 사람이 맡습니다.',
  'split.method.exact': '금액 지정',
  'split.method.exactHint':
    '각자가 실제로 낼 금액을 입력하세요. 합계가 총액과 맞아야 합니다.',
  'split.method.shares': '지분',
  'split.method.sharesHint':
    '가중치를 두어 나눕니다. 커플은 2, 나머지는 1처럼.',
  'split.method.percentage': '퍼센트',
  'split.method.percentageHint': '퍼센트로 나눕니다. 합계가 100이어야 합니다.',
  'split.exactFor': '{name}의 정확한 금액',
  'split.percentFor': '{name}의 퍼센트',
  'split.sharesFor': '{name}의 지분',
  'split.balanced': '맞음',
  'split.allocated': '{total} 중 {allocated} 배정',
  'split.over': '{amount} 초과',
  'split.left': '{amount} 남음',

  /* ---------------------------------------- the expense dialog */
  'field.amount': '금액',
  'field.currency': '통화',
  'field.date': '날짜',
  'field.paidBy': '결제한 사람',
  'expense.editTitle': '이 지출 수정',
  'expense.addTitle': '지출 추가',
  'expense.editDescription':
    '금액을 바꾸면 아래에 포함된 모두에게 다시 나뉩니다.',
  'expense.addDescription':
    '이 여행의 금액은 {currency}로 관리합니다. 영수증은 그 통화로 기록하고, 환산된 금액을 적어 주세요.',
  'expense.saveFailed': '저장하지 못했습니다',
  'expense.what': '무엇에 쓴 돈인지',
  'expense.whatPlaceholder': 'Kyubey에서 저녁',
  'expense.amountNotANumber': '금액을 숫자로 입력해 주세요.',
  'expense.currencyLabel': '이 영수증에 적힌 통화',
  'expense.convertedTo': '{currency}로 환산',
  'expense.convertedHint': '명세서에서 {from}이 {to}로 얼마가 되었는지.',
  'expense.convertedSuggested':
    '이 여행에서 {date}에 사용한 환율({rate})을 바탕으로 제안한 금액입니다. 명세서에 맞게 수정하세요.',
  'expense.convertedNotANumber': '환산된 금액을 숫자로 입력해 주세요.',
  'expense.dateLabel': '지출한 날짜',
  'expense.paidByHint':
    '아직 아무도 대신 내지 않은 영수증이라면 결제한 사람을 비워 두세요.',
  'expense.nobodyYet': '아직 없음',
  'expense.whoPaid': '누가 결제했는지',
  'expense.notesHint': '선택. 영수증에 없는 내용은 여기에.',
  'expense.notesPlaceholder': '코스 요리는 나눠 내고, 음료는 따로.',
  'expense.noAmount': '아직 금액이 없습니다',
  'expense.saving': '지출을 저장하는 중',
  'expense.saveChanges': '변경 사항 저장',
  'expense.add': '지출 추가',

  /* ---------------------------------------- the payment dialog */
  'payment.title': '결제 기록하기',
  'payment.description':
    '송금을 기록하면 양쪽 잔액에서 사라집니다. 실제로 돈이 움직이는 것은 아닙니다. planned.travel은 장부만 관리하고, 송금은 당신의 은행이 합니다.',
  'payment.youSuffix': '{name}(나)',
  'payment.pays': '{from} → {to}',
  'payment.pickTwo': '서로 다른 두 사람을 고르세요.',
  'payment.paidTo': '받은 사람',
  'payment.needsTwo': '결제에는 서로 다른 두 사람이 필요합니다.',
  'payment.whoPaying': '보내는 사람',
  'payment.whoPaid': '받는 사람',
  'payment.amountIn': '{currency} 금액',
  'payment.amountPositive': '0보다 큰 금액을 입력해 주세요.',
  'payment.currencyLabel': '결제에 사용한 통화',
  'payment.how': '방법',
  'payment.howMade': '결제 방법',
  'payment.dateLabel': '결제한 날짜',
  'payment.note': '메모',
  'payment.noteHint': '선택. 참조 번호나 무엇에 쓴 돈인지.',
  'payment.notePlaceholder': '교토 숙소와 JR 패스 몫.',
  'payment.recording': '결제를 기록하는 중',
  'payment.confirm': '결제 기록',
  'payment.failed': '결제를 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  'payment.method.bankTransfer': '계좌 이체',
  'payment.method.cash': '현금',
  'payment.method.card': '카드',
  'payment.method.app': '결제 앱',
  'payment.method.other': '그 외',

  /* --------------------------------------------------------- settle up */
  'settle.label': '정산',
  'settle.addPayment': '결제 추가',
  'settle.action': '정산하기',
  'settle.empty.title': '모두 정산되었습니다',
  'settle.empty.body':
    '송금할 것이 없습니다. 지출을 기록하면 차액이 여기에 표시됩니다.',
  /* ---------------------------------------------------------- balances */
  'balances.label': '잔액',
  'balances.count': {
    other: '여행자 {travellers}명',
  },
  'balances.empty': '지출에 결제자와 분담이 있으면 잔액이 표시됩니다.',
  /* ------------------------------------------------------- by category */
  'categories.label': '카테고리별',
  'categories.againstBudget': '여행 예산 대비',
  'categories.progressLabel': '여행 예산 대비 지출',
  'categories.empty': '예산 항목과 지출은 나눌 것이 생기면 여기에 나뉩니다.',
  'categories.legendLabel': '카테고리별 지출',
  'categories.planned': '{amount} 예정',
  'categories.nothingSpent':
    '아직 지출이 없습니다. 계획한 항목은 다음과 같습니다.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': '{percent} 미만',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': '누구를 위한 지출인가요',
  'memberBar.others': {
    other: '외 여행자 {others}명',
  },
  'memberBar.notSplit': '누구에게도 배정되지 않음',
  'totalTile.label': '여행 총지출',
  'totalTile.captionPlanned': '모든 여행자 합계 {amount} 예정',
  'totalTile.captionBudget': '여행 예산 {amount}',
  'totalTile.yourShare': '내 분담액',
  'totalTile.youPaid': '내가 결제한 금액',
  /* ------------------------------------------------- payments recorded */
  'payments.label': '기록된 결제',
  'payments.empty.title': '아직 결제가 없습니다',
  'payments.empty.body': '누군가 잔액을 갚으면 송금이 여기에 기록됩니다.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': '비용은 볼 수만 있고 변경할 수 없습니다',
  'readOnly.body':
    '지출을 추가·수정·삭제하고 결제를 기록할 수 있는 사람은 여행의 소유자와 편집 권한이 있는 사람뿐입니다. 변경이 필요하면 소유자에게 문의하세요.',
  'readOnly.empty':
    '이 여행에는 아직 기록된 지출이 없습니다. 소유자나 편집자가 추가하면 여기에 표시됩니다.',
  'readOnly.settleEmpty':
    '지금은 송금이 필요하지 않습니다. 차액이 생기면 여기에 표시됩니다.',
  'refusal.rebaseChanged':
    '확인하는 동안 여행이 바뀌어서 아무것도 변경되지 않았습니다. 새 금액을 확인한 뒤 다시 확인해 주세요.',
  'refusal.tripCurrencyChanged':
    '이 여행의 예산 통화가 이제 {to}(이)라서 저장되지 않았습니다. 페이지를 새로 고쳤으니 금액을 확인한 뒤 다시 저장해 주세요.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': '표시 통화',
  'display.indicator.perTrip': '여행 자체 통화',
  'display.indicator.fixed': '{code}로도 표시',
  'display.menu.perTrip': '각 여행을 해당 여행의 통화로',
  'display.menu.workspace': '{code}(작업 공간 기본값)',
  'display.menu.rateHint': '여행에 이미 기록된 환율을 사용합니다',
  'display.menu.currentHint':
    '선택했지만 기록된 환율이 이 통화를 지원하지 않습니다',
  'display.menu.needsLiveRate': '아직 사용할 수 없는 실시간 환율이 필요합니다',
  'display.menu.saving': '선택을 저장하는 중',
  'display.error.title': '표시 통화를 저장하지 못했습니다',
  'display.error.body':
    '선택을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': '표시 통화로 약 {amount} {code}',
  'display.row.notConverted': '환산 안 됨',
  'display.alert.title': '일부 금액이 환산되지 않았습니다',
  'display.alert.body':
    '다음 통화 쌍에는 기록된 환율이 없어 해당 금액은 예산 통화로 유지됩니다:',
  'display.alert.pair': '{date} {from} → {to}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': '예산 통화 변경',
  'rebase.title': '예산 통화 변경하기',
  'rebase.description':
    '입력한 금액은 그대로 유지됩니다. 이 여행의 합계와 잔액은 새 통화로 환산됩니다.',
  'rebase.to': '새 통화',
  'rebase.toPlaceholder': '통화 선택',
  'rebase.rateLabel': '환율 (1 {from} 기준 {to})',
  'rebase.rateInverse': '즉, 1 {to} = {inverse} {from}입니다.',
  'rebase.rateInvalid': '0보다 큰 환율을 입력해 주세요.',
  'rebase.rateOutOfRange':
    '환율이 너무 크거나 너무 작아 보입니다. 통화의 방향이 맞는지 확인해 주세요.',
  'rebase.source.recent': '이 작업 공간에서 마지막으로 사용한 환율',
  'rebase.source.manual': '직접 입력한 환율',
  'rebase.noRate':
    '{from} → {to} 환율이 기록되어 있지 않습니다. 사용할 환율을 입력해 주세요.',
  'rebase.waitingForRate': '환율이 정해지면 미리보기가 표시됩니다.',
  'rebase.loading': '환산 중입니다',
  'rebase.example':
    '{original}은(는) 입력한 그대로 유지되며 {converted}(으)로 집계됩니다.',
  'rebase.count.expenses': {
    other: '지출 {count}건이 {to}(으)로 집계됩니다.',
  },
  'rebase.count.payments': {
    other: '결제 {count}건이 {to}(으)로 집계됩니다.',
  },
  'rebase.count.planned': {
    other: '예정 항목 {count}건이 {to}(으)로 집계됩니다.',
  },
  'rebase.pinned': '장소, 예약, 숙소, 이동의 가격은 {from}(으)로 유지됩니다.',
  'rebase.target': '여행 예산이 {before}에서 {after}(으)로 바뀝니다.',
  'rebase.rounding':
    '금액마다 한 번씩 반올림하므로 잔액이 최대 {amount}만큼 달라질 수 있습니다.',
  'rebase.leftover':
    '변경 후에는 {name}이(가) {other}에게 {amount}을(를) 갚아야 합니다.',
  'rebase.someone': '누군가',
  'rebase.nothing':
    '이 여행에는 아직 가격이 입력된 항목이 없어 환산할 것이 없습니다.',
  'rebase.unconverted': {
    other:
      '{count}건이 {from} 이외의 통화라서 자동으로 환산할 수 없습니다. 대개 다른 통화로 가격이 매겨진 예약에서 만들어진 지출입니다. 수정하거나 삭제한 뒤 다시 시도해 주세요.',
  },
  'rebase.unsplittable': {
    other:
      '지출 {count}건은 모든 분담액이 0이라 분담 내역을 옮길 수 없습니다. 수정하거나 삭제한 뒤 다시 시도해 주세요.',
  },
  'rebase.outOfRange':
    '이 환율로는 여행의 금액이 {to}(으)로 저장하기에는 너무 커집니다. 환율과 통화의 방향을 확인해 주세요.',
  'rebase.tooLarge':
    '이 여행은 항목이 너무 많아 한 번에 변경할 수 없습니다. 한 번에 {changes}건을 바꿔야 하는데 한도는 {limit}건입니다. 예산은 당분간 {from}(으)로 유지됩니다.',
  'rebase.copyPending':
    '이 여행을 아직 복사하는 중입니다. 잠시 후 다시 시도해 주세요.',
  'rebase.error': '환산 결과를 불러오지 못했습니다. 변경된 내용은 없습니다.',
  'rebase.commitError':
    '예산 통화를 변경하지 못했습니다. 변경된 내용은 없습니다.',
  'rebase.retry': '다시 시도',
  'rebase.confirm': '{to}(으)로 변경',
  'rebase.committing': '예산 통화를 변경하는 중입니다',
  'rebase.done': '예산이 {to}(으)로 바뀌었습니다.',
} satisfies TranslationOf<typeof En>

export default messages
