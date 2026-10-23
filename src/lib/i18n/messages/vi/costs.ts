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
  'person.removedTarget': 'một người đi đã bị xoá',
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
  'delete.payment.title': 'Xóa khoản thanh toán này?',
  'delete.payment.description':
    '“{title}” rời khỏi bảng tính. Không thể hoàn lại. Để sửa một khoản thanh toán, hãy ghi lại nó.',
  'delete.payment.failedBody':
    'Không xóa được khoản thanh toán. Thử lại sau một lát.',
  'delete.payment.confirm': 'Xóa khoản thanh toán',
  'delete.payment.working': 'Đang xóa khoản thanh toán',

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
  'split.departed': 'Đã rời chuyến đi',
  'split.departedHint':
    'Bỏ chọn người đã rời chuyến đi sẽ xóa vĩnh viễn phần của họ.',
  'split.includeFor': 'Bao gồm {name} trong phần chia này',
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
  'expense.splitOff.title': 'Các phần đã lưu không khớp tổng',
  'expense.splitOff.body':
    'Tổng các phần là {shares}, nhưng chi phí là {total}. Hãy chỉnh các phần rồi lưu để sửa.',
  'expense.what': 'Chi cho việc gì',
  'expense.whatPlaceholder': 'Bữa tối ở Kyubey',
  'expense.amountNotANumber': 'Nhập số tiền dưới dạng số.',
  'expense.convertedTo': 'Quy đổi thành {currency}',
  'expense.convertedHint':
    '{from} quy ra {to} trên sao kê của bạn là bao nhiêu.',
  'expense.convertedSuggested':
    'Gợi ý từ tỷ giá đã dùng trong chuyến đi này ({date}, {rate}). Hãy sửa lại cho khớp với sao kê của bạn.',
  'expense.convertedNotANumber': 'Nhập số tiền quy đổi dưới dạng số.',
  'expense.paidByHint':
    'Để trống người trả nếu bạn đang ghi một biên lai chưa ai ứng.',
  'expense.nobodyYet': 'Chưa có ai',
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
  'payment.amountIn': 'Số tiền bằng {currency}',
  'payment.amountPositive': 'Nhập số tiền lớn hơn không.',
  'payment.how': 'Bằng cách nào',
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
  'categories.legendLabel': 'Chi tiêu theo danh mục',
  'categories.planned': '{amount} dự kiến',
  'categories.nothingSpent':
    'Chưa chi gì cả. Đây là những gì bạn đã lên kế hoạch.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'dưới {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Khoản chi dành cho ai',
  'memberBar.others': {
    other: '{others} người đi khác',
  },
  'memberBar.notSplit': 'Chưa gán cho ai',
  'totalTile.label': 'Tổng chi phí chuyến đi',
  'totalTile.captionPlanned': 'Dự kiến {amount} cho tất cả người đi',
  'totalTile.captionBudget': 'Ngân sách chuyến đi {amount}',
  'totalTile.yourShare': 'Phần của bạn',
  'totalTile.youPaid': 'Bạn đã trả',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Khoản trả đã ghi',
  'payments.empty.title': 'Chưa có khoản trả nào',
  'payments.empty.body':
    'Khi ai đó trả lại số dư, giao dịch sẽ được ghi ở đây.',
  'payments.delete': 'Xóa khoản thanh toán từ {from} cho {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Chuyến đi này đã được lưu trữ. Hãy khôi phục trước khi thay đổi chi phí.',
  'readOnly.title': 'Bạn có thể xem chi phí nhưng không thể thay đổi',
  'readOnly.body':
    'Chỉ chủ chuyến đi và những người được phép chỉnh sửa mới có thể thêm, sửa hoặc xóa khoản chi và ghi nhận thanh toán. Hãy hỏi chủ chuyến đi nếu cần thay đổi gì.',
  'readOnly.empty':
    'Chuyến đi này chưa ghi khoản chi nào. Các khoản chi sẽ hiện ở đây khi chủ chuyến đi hoặc người chỉnh sửa thêm vào.',
  'readOnly.settleEmpty':
    'Hiện chưa cần chuyển khoản nào. Mọi khoản chênh lệch sẽ hiện ở đây.',
  'refusal.rebaseChanged':
    'Chuyến đi đã thay đổi trong lúc bạn xác nhận, nên chưa có gì bị thay đổi. Hãy kiểm tra các số mới rồi xác nhận lại.',
  'refusal.tripCurrencyChanged':
    'Tiền tệ của ngân sách chuyến đi này giờ là {to}, nên chưa lưu gì. Trang đã được làm mới: hãy kiểm tra số tiền rồi lưu lại.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Tiền tệ hiển thị',
  'display.indicator.perTrip': 'Tiền tệ riêng',
  'display.indicator.fixed': 'Cũng bằng {code}',
  'display.menu.perTrip': 'Mỗi chuyến đi theo tiền tệ riêng',
  'display.menu.workspace': '{code} (mặc định của không gian làm việc)',
  'display.menu.rateHint': 'Dùng tỷ giá đã ghi trên một chuyến đi',
  'display.menu.currentHint':
    'Đã chọn, nhưng không có tỷ giá đã ghi nào bao phủ',
  'display.menu.needsLiveRate': 'Cần tỷ giá trực tiếp, hiện chưa có',
  'display.menu.saving': 'Đang lưu lựa chọn của bạn',
  'display.error.title': 'Chưa lưu được tiền tệ hiển thị',
  'display.error.body':
    'Không thể lưu lựa chọn của bạn. Hãy thử lại sau giây lát.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Khoảng {amount} {code} theo tiền tệ hiển thị của bạn',
  'display.row.notConverted': 'Chưa quy đổi',
  'display.alert.title': 'Một số số tiền chưa được quy đổi',
  'display.alert.body':
    'Chưa có tỷ giá nào được ghi cho các cặp tiền tệ này, nên các số tiền đó giữ nguyên theo tiền tệ ngân sách:',
  'display.alert.pair': '{from} sang {to} ngày {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Đổi tiền tệ của ngân sách',
  'rebase.title': 'Đổi tiền tệ của ngân sách',
  'rebase.description':
    'Các số tiền bạn đã nhập được giữ nguyên. Tổng và số dư của chuyến đi được quy đổi sang tiền tệ mới.',
  'rebase.to': 'Tiền tệ mới',
  'rebase.toPlaceholder': 'Chọn một loại tiền tệ',
  'rebase.rateLabel': 'Tỷ giá (1 {from} sang {to})',
  'rebase.rateInverse': 'Tức là 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Nhập tỷ giá lớn hơn không.',
  'rebase.rateOutOfRange':
    'Tỷ giá này có vẻ quá lớn hoặc quá nhỏ. Hãy kiểm tra xem có bị ngược chiều không.',
  'rebase.source.recent':
    'Tỷ giá được dùng gần nhất trong không gian làm việc này',
  'rebase.source.manual': 'Tỷ giá bạn đã nhập',
  'rebase.noRate':
    'Chưa có tỷ giá nào được ghi cho {from} sang {to}. Hãy nhập tỷ giá bạn muốn dùng.',
  'rebase.waitingForRate': 'Bản xem trước sẽ hiện ngay khi có tỷ giá.',
  'rebase.loading': 'Đang tính phần quy đổi',
  'rebase.example':
    '{original} được giữ nguyên như bạn đã nhập và được tính là {converted}.',
  'rebase.count.expenses': {
    other: '{count} khoản chi sẽ được tính bằng {to}.',
  },
  'rebase.count.payments': {
    other: '{count} khoản trả sẽ được tính bằng {to}.',
  },
  'rebase.count.planned': {
    other: '{count} mục dự kiến sẽ được tính bằng {to}.',
  },
  'rebase.pinned':
    'Giá của địa điểm, đặt chỗ, lưu trú và di chuyển vẫn giữ nguyên theo {from}.',
  'rebase.target': 'Ngân sách chuyến đi {before} sẽ thành {after}.',
  'rebase.rounding':
    'Mỗi số tiền chỉ được làm tròn một lần, nên số dư có thể lệch tối đa {amount}.',
  'rebase.leftover': 'Sau thay đổi, {name} sẽ còn nợ {other} {amount}.',
  'rebase.someone': 'Một người',
  'rebase.nothing':
    'Chuyến đi này chưa có gì được định giá, nên không cần quy đổi gì.',
  'rebase.unconverted': {
    other:
      '{count} mục dùng tiền tệ khác {from} nên không thể quy đổi tự động. Thường đó là khoản chi tạo từ một đặt chỗ có giá bằng tiền tệ khác: hãy sửa hoặc xóa rồi thử lại.',
  },
  'rebase.unsplittable': {
    other:
      '{count} khoản chi có cách chia không thể chuyển sang, vì mọi phần chia trong đó đều bằng không. Hãy sửa hoặc xóa rồi thử lại.',
  },
  'rebase.outOfRange':
    'Với tỷ giá này, một số tiền trong chuyến đi sẽ quá lớn để lưu bằng {to}. Hãy kiểm tra tỷ giá và chiều quy đổi.',
  'rebase.tooLarge':
    'Chuyến đi này có quá nhiều mục để đổi trong một lần: cần {changes} thay đổi cùng lúc, trong khi giới hạn là {limit}. Ngân sách tạm thời vẫn tính bằng {from}.',
  'rebase.copyPending':
    'Chuyến đi này vẫn đang được sao chép. Hãy thử lại sau giây lát.',
  'rebase.error': 'Không tải được phần quy đổi. Chưa có gì bị thay đổi.',
  'rebase.commitError':
    'Không đổi được tiền tệ của ngân sách. Chưa có gì bị thay đổi.',
  'rebase.stale':
    'Tiền tệ ngân sách của chuyến đi hiện là {current}, không còn là {from}. Hãy đóng hộp thoại này và mở lại.',
  'rebase.sameCurrency': 'Ngân sách đã dùng {to}. Hãy chọn loại tiền khác.',
  'rebase.commitUnknown':
    'Chúng tôi không thể xác nhận tiền tệ ngân sách đã đổi sang {to} hay chưa. Hãy tải lại trang để kiểm tra trước khi thử lại.',
  'rebase.retry': 'Thử lại',
  'rebase.confirm': 'Đổi sang {to}',
  'rebase.committing': 'Đang đổi tiền tệ của ngân sách',
  'rebase.done': 'Ngân sách giờ tính bằng {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Chưa chi gì cả',
  'screen.summary': '{expenses} · đã chi {spent}',
  'count.expenses': {
    other: '{expenses} khoản chi',
  },
  'screen.exportCsv': 'Xuất CSV',
  'screen.addFirst': 'Thêm khoản chi đầu tiên',
  'screen.empty.title': 'Chưa có khoản chi nào',
  'screen.empty.body':
    'Hãy ghi lại những gì bạn chi ngay khi phát sinh. planned.travel chia cho mọi người đi cùng và giữ tổng cộng dồn bằng {currency}.',
  'screen.filtered.title': 'Không có gì khớp với các bộ lọc này',
  'screen.filtered.body':
    'Hãy mở rộng tìm kiếm, chọn ngày khác hoặc xoá bộ lọc để xem lại cả chuyến đi.',
  'export.empty.title': 'Không có gì để xuất',
  'export.empty.body': 'Không có khoản chi nào khớp với bộ lọc đang bật.',
  'export.ready.title': 'Đã xuất xong',
  'export.ready.body': {
    other: 'Đã ghi {expenses} khoản chi vào CSV.',
  },
  'list.daySpent': 'đã chi {amount}',
  'skeleton.loading': 'Đang tải các khoản chi',
  'row.noPayer': 'Chưa có người trả',
  'row.youPaid': 'Bạn đã trả',
  'row.paid': '{name} đã trả',
  'row.notYourShare': 'không phải phần của bạn',
  'row.yourShare': 'phần của bạn {amount}',
  'row.noteOn': 'Ghi chú cho {title}',
  'row.edit': 'Sửa {title}',
  'row.delete': 'Xoá {title}',
  'row.saving': 'Đang lưu',
  'row.splitOff': 'Các phần không khớp tổng',
  'tile.owe.label': 'Bạn nợ',
  'tile.owe.settled': 'Bạn đã thanh toán xong',
  'tile.owe.pending': 'Thanh toán trước khi bay về nhà',
  'tile.owe.to': 'Cho',
  'tile.owed.label': 'Người khác nợ bạn',
  'tile.owed.none': 'Không ai nợ bạn',
  'tile.owed.pending': 'Vẫn sẽ quay về với bạn',
  'tile.owed.from': 'Từ',
  'tile.outstanding.label': 'Chưa tất toán',
  'tile.outstanding.none': 'Mọi khoản chi đều có người trả',
  'tile.outstanding.some': {
    other: '{expenses} khoản chi chưa có người trả',
  },
  'category.accommodation': 'Chỗ ở',
  'category.transport': 'Di chuyển',
  'category.food': 'Ăn uống',
  'category.activities': 'Hoạt động',
  'category.shopping': 'Mua sắm',
  'category.fees': 'Phí và lệ phí',
  'category.insurance': 'Bảo hiểm',
  'category.other': 'Khác',
  'toolbar.summary.everything': 'Đang hiển thị tất cả',
  'toolbar.summary.filtered': 'Đã lọc: {filters}',
  'toolbar.summary.search': 'khớp với “{term}”',
  'write.added': 'Đã thêm khoản chi',
  'write.updated': 'Đã cập nhật khoản chi',
  'write.deleted': 'Đã xoá khoản chi',
  'write.addFailed': 'Chưa thêm được khoản chi',
  'write.editFailed': 'Chưa lưu được khoản chi',
  'write.deleteFailed': 'Chưa xoá được khoản chi',
  'write.paymentRecorded': 'Đã ghi nhận khoản thanh toán',
  'write.paymentRecordedBody': 'Cả hai số dư đã được cập nhật.',
  'write.paymentFailed': 'Chưa ghi nhận được khoản thanh toán',
  'write.paymentDeleted': 'Đã xoá khoản thanh toán',
  'write.paymentDeleteFailed': 'Chưa xoá được khoản thanh toán',
  'write.rolledBack': 'Thay đổi đã được hoàn lại.',
  'expense.saveFallback': 'Không lưu được khoản chi. Hãy thử lại sau một lát.',
} satisfies TranslationOf<typeof En>

export default messages
