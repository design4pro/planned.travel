/**
 * The costs tab's copy, in vi.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Số nhiều.** Tiếng Việt chỉ có một nhánh `other`; số người đi kèm “người”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Bạn',
  'person.youTarget': 'bạn',
  'person.removed': 'Người đi đã bị xoá',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Xóa khoản chi này?',
  'delete.description':
    '“{title}” và cách chia của nó rời khỏi bảng tính. Không thể hoàn lại.',
  'delete.failed': 'Không xóa được',
  'delete.failedBody': 'Không xóa được khoản chi. Thử lại sau một lát.',
  'delete.noBalances':
    'Không có số dư nào thay đổi - khoản này chưa chia cho ai.',
  'delete.balancesChange': 'Số dư của {names} thay đổi.',
  'delete.confirm': 'Xóa khoản chi',
  'delete.working': 'Đang xóa khoản chi',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Khoản chi',
  'toolbar.shownOf': '{shown} trên {total}',
  'toolbar.searchPlaceholder': 'Tìm trong khoản chi, ghi chú hoặc người trả…',
  'toolbar.searchLabel': 'Tìm khoản chi',
  'toolbar.allCategories': 'Mọi hạng mục',
  'toolbar.allDays': 'Mọi ngày',
  'toolbar.filterCategory': 'Lọc theo hạng mục',
  'toolbar.filterDay': 'Lọc theo ngày',
  'toolbar.whose': 'Khoản chi của ai',
  'toolbar.paidByMe': 'Tôi đã trả',
  'toolbar.owedToMe': 'Người khác nợ tôi',
  'toolbar.logged': {
    other: 'đã ghi {value}',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Chia giữa những người đi',
  'split.label': 'Chia giữa',
  'split.everyone': 'Mọi người',
  'split.nobody': 'Không ai',
  'split.how': 'Khoản chi này chia thế nào',
  'split.method.equal': 'Chia đều',
  'split.method.equalHint':
    'Mọi người được tính đều trả bằng nhau, và đơn vị nhỏ nhất còn lại thuộc về người đầu danh sách.',
  'split.method.exact': 'Đúng số tiền',
  'split.method.exactHint':
    'Ghi số tiền mỗi người thực sự phải trả. Tổng các số phải bằng tổng chung.',
  'split.method.shares': 'Phần',
  'split.method.sharesHint':
    'Cân trọng số khi chia - 2 phần cho một đôi, 1 cho những người khác.',
  'split.method.percentage': 'Phần trăm',
  'split.method.percentageHint':
    'Chia theo phần trăm. Các phần trăm phải cộng lại thành 100.',
  'split.exactFor': 'Số tiền chính xác cho {name}',
  'split.percentFor': 'Phần trăm cho {name}',
  'split.sharesFor': 'Số phần cho {name}',
  'split.balanced': 'Khớp',
  'split.allocated': 'đã phân {allocated} trên {total}',
  'split.over': 'thừa {amount}',
  'split.left': 'còn {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Số tiền',
  'field.currency': 'Tiền tệ',
  'field.date': 'Ngày',
  'field.paidBy': 'Người trả',
  'expense.editTitle': 'Sửa khoản chi này',
  'expense.addTitle': 'Thêm khoản chi',
  'expense.editDescription':
    'Đổi số tiền thì khoản này được chia lại giữa tất cả những người có trong danh sách dưới đây.',
  'expense.addDescription':
    'Số tiền của chuyến này được giữ bằng {currency}. Ghi biên lai theo đúng tiền tệ của nó và cho biết quy đổi ra bao nhiêu.',
  'expense.saveFailed': 'Không lưu được',
  'expense.what': 'Chi cho việc gì',
  'expense.whatPlaceholder': 'Bữa tối ở Kyubey',
  'expense.amountNotANumber': 'Nhập số tiền dưới dạng số.',
  'expense.currencyLabel': 'Tiền tệ ghi trên biên lai này',
  'expense.convertedTo': 'Quy đổi thành {currency}',
  'expense.convertedHint':
    '{from} quy ra {to} trên sao kê của bạn là bao nhiêu.',
  'expense.convertedNotANumber': 'Nhập số tiền quy đổi dưới dạng số.',
  'expense.dateLabel': 'Ngày phát sinh khoản chi',
  'expense.paidByHint':
    'Để trống người trả nếu bạn đang ghi một biên lai chưa ai ứng.',
  'expense.nobodyYet': 'Chưa có ai',
  'expense.whoPaid': 'Ai đã trả',
  'expense.notesHint': 'Không bắt buộc. Bất cứ điều gì biên lai không nói.',
  'expense.notesPlaceholder': 'Chia suất nếm thử, đồ uống tính riêng.',
  'expense.noAmount': 'Chưa có số tiền',
  'expense.saving': 'Đang lưu khoản chi',
  'expense.saveChanges': 'Lưu thay đổi',
  'expense.add': 'Thêm khoản chi',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Ghi nhận một khoản trả',
  'payment.description':
    'Ghi nhận một lần chuyển tiền sẽ xóa nó khỏi cả hai số dư. Việc này không chuyển tiền thật - planned.travel giữ sổ, ngân hàng của bạn mới chuyển tiền.',
  'payment.youSuffix': '{name} (bạn)',
  'payment.pays': '{from} trả cho {to}',
  'payment.pickTwo': 'Chọn hai người khác nhau.',
  'payment.paidTo': 'Trả cho',
  'payment.needsTwo': 'Một khoản trả cần hai người khác nhau.',
  'payment.whoPaying': 'Ai trả',
  'payment.whoPaid': 'Ai nhận',
  'payment.amountIn': 'Số tiền bằng {currency}',
  'payment.amountPositive': 'Nhập số tiền lớn hơn không.',
  'payment.how': 'Bằng cách nào',
  'payment.howMade': 'Khoản trả được thực hiện thế nào',
  'payment.dateLabel': 'Ngày trả',
  'payment.note': 'Ghi chú',
  'payment.noteHint':
    'Không bắt buộc. Một mã tham chiếu, hoặc khoản này chi trả cho gì.',
  'payment.notePlaceholder': 'Trả cho khách sạn Kyoto và vé JR.',
  'payment.recording': 'Đang ghi nhận khoản trả',
  'payment.confirm': 'Ghi nhận khoản trả',
  'payment.failed': 'Không ghi nhận được khoản trả. Thử lại sau một lát.',
  'payment.method.bankTransfer': 'Chuyển khoản ngân hàng',
  'payment.method.cash': 'Tiền mặt',
  'payment.method.card': 'Thẻ',
  'payment.method.app': 'Ứng dụng thanh toán',
  'payment.method.other': 'Cách khác',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Quyết toán',
  'settle.addPayment': 'Thêm khoản trả',
  'settle.action': 'Quyết toán',
  'settle.empty.title': 'Mọi người đã sạch nợ',
  'settle.empty.body':
    'Không cần chuyển khoản nào. Thêm một chi phí và mọi lệch lạc sẽ hiện ở đây.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Số dư',
  'balances.count': {
    other: '{travellers} người',
  },
  'balances.empty':
    'Số dư xuất hiện khi một chi phí có người trả và cách chia.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Theo hạng mục',
  'categories.againstBudget': 'So với ngân sách chuyến đi',
  'categories.progressLabel': 'Đã chi so với ngân sách chuyến đi',
  'categories.empty':
    'Các dòng ngân sách và chi phí sẽ được bóc tách ở đây khi có gì để bóc tách.',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Khoản trả đã ghi',
  'payments.empty.title': 'Chưa có khoản trả nào',
  'payments.empty.body':
    'Khi ai đó trả lại số dư, giao dịch sẽ được ghi ở đây.',
} satisfies TranslationOf<typeof En>

export default messages
