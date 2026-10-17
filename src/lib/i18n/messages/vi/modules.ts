/**
 * The trip modules' own copy, in vi.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Số nhiều.** Tiếng Việt chỉ có nhánh `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Chưa đặt',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Đang kết nối',
  'presence.connecting.body': 'Đang vào phòng trực tiếp của chuyến đi này.',
  'presence.live.title': 'Trực tiếp',
  'presence.live.body':
    'Tin nhắn, ghi chú và bình chọn xuất hiện ở đây ngay khi được tạo.',
  'presence.reconnecting.title': 'Đang kết nối lại',
  'presence.reconnecting.body':
    'Kết nối bị ngắt. Đang thử lại — mọi thứ bạn gửi vẫn được lưu.',
  'presence.offline.title': 'Không trực tiếp',
  'presence.offline.body':
    'Cập nhật trực tiếp đang tắt. Việc lưu vẫn hoạt động; tải lại hoặc thử lại để bắt kịp.',
  'presence.reconnect': 'Kết nối lại',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Mọi lượt di chuyển',
  'transports.empty.title': 'Chưa có lượt di chuyển nào',
  'transports.empty.body':
    'Chuyến bay, tàu, phà và đoạn đường từ sân bay đều ở đây, kèm mã đặt chỗ và số ghế sẵn trong tay đúng ngày — và mỗi lần nối chuyến đều được đối chiếu với lượt trước.',
  'transports.empty.action': 'Thêm lượt di chuyển đầu tiên',
  'transports.filtered.title': 'Không có lượt di chuyển loại đó',
  'transports.filtered.body':
    'Mỗi lượt di chuyển của chuyến này đi một cách khác nhau. Quay lại “{label}” để xem tất cả.',
  'transports.filtered.action': 'Hiện mọi lượt di chuyển',
  'transports.alert.impossible.title': {
    other: '{value} lần nối chuyến không thể thực hiện',
  },
  'transports.alert.impossible.body':
    'Một lượt di chuyển khởi hành trước khi lượt trước đó đến. Các điểm nối bên dưới cho biết lượt nào và lệch bao nhiêu.',
  'transports.alert.tight.title': {
    other: '{value} lần nối chuyến quá sát',
  },
  'transports.alert.tight.body':
    'Vẫn còn thời gian, nhưng không nhiều cho phương tiện bạn phải bắt. Các điểm nối bên dưới cho thấy mỗi lần còn lại bao lâu.',
  'transports.badge.impossible': {
    other: '{value} lần nối chuyến bị vỡ',
  },
  'transports.badge.tight': {
    other: '{value} lần nối chuyến quá sát',
  },
  'transports.badge.ok': 'Mọi lần nối chuyến đều ổn',
  'transports.remove.body':
    'Lượt di chuyển này rời chuyến đi vĩnh viễn, cùng với mã đặt chỗ và số ghế. Nếu chỉ bị huỷ, hãy đặt trạng thái là “Đã huỷ” thay vì xoá.',
  'transports.remove.confirm': 'Xoá lượt di chuyển',
  'transports.menu.edit': 'Sửa lượt di chuyển…',
  'transports.field.service': 'Chuyến',
  'transports.field.bookingRef': 'Mã đặt chỗ',
  'transports.field.seat': 'Ghế',
  'transports.field.distance': 'Khoảng cách',
  'transports.noTime': 'Chưa có giờ',
  'transports.toast.statusFailed.title': 'Trạng thái không thay đổi',
  'transports.toast.statusFailed.body':
    'Lượt di chuyển vẫn ở trạng thái trước đó.',
  'transports.toast.removed': 'Đã xoá lượt di chuyển',
  'transports.toast.removeFailed': 'Không xoá được lượt di chuyển',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Thêm một lượt di chuyển',
  'transports.dialog.editTitle': 'Sửa lượt di chuyển này',
  'transports.dialog.description':
    'Chuyến bay, tàu, phà và đoạn đường từ sân bay. Giờ là giờ địa phương in trên vé.',
  'transports.form.modeLegend': 'Bạn đi bằng gì',
  'transports.form.timingError': 'Kiểm tra lại giờ',
  'transports.field.namePlaceholder': 'Vietnam Airlines từ SGN đến HND',
  'transports.field.place': 'Nơi',
  'transports.field.code': 'Mã',
  'transports.field.date': 'Ngày',
  'transports.field.time': 'Khởi hành sau',
  'transports.field.departurePlaceholder': 'TP.HCM Tân Sơn Nhất',
  'transports.field.arrivalPlaceholder': 'Sân bay Tokyo Haneda',
  'transports.field.carrier': 'Hãng',
  'transports.field.serviceNumber': 'Số hiệu chuyến',
  'transports.field.bookingRefHint': 'Mã bạn sẽ đọc ở quầy.',
  'transports.field.notesPlaceholder':
    'Đã xin ghế cạnh lối đi. Hành lý gửi thẳng tới Kyoto.',
  'transports.action.add': 'Thêm lượt di chuyển',
  'transports.action.save': 'Lưu lượt di chuyển',
  'transports.action.saving': 'Đang lưu lượt di chuyển',
  'transports.toast.added': 'Đã thêm lượt di chuyển',
  'transports.toast.addedBody': 'Nó đã vào thứ tự hành trình.',
  'transports.toast.addFailed': 'Chưa thêm được lượt di chuyển',
  'transports.toast.updated': 'Đã cập nhật lượt di chuyển',
  'transports.toast.updateFailed': 'Chưa cập nhật được lượt di chuyển',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Tên',
  'field.time': 'Giờ',
  'field.price': 'Giá',
  'field.notes': 'Ghi chú',
  'field.status': 'Trạng thái',
  'form.saveError': 'Chưa lưu được',
  'action.cancel': 'Huỷ',
  'action.showCode': 'Hiện {label}',
  'book.status.none': 'Chưa có trạng thái',
  'book.status.pending': 'Chờ xác nhận',
  'book.status.confirmed': 'Đã xác nhận',
  'book.status.completed': 'Đã xong',
  'book.status.cancelled': 'Đã huỷ',
  'book.toast.statusFailed': 'Trạng thái không thay đổi',
  'book.toast.statusFailedBody': 'Chỗ đặt vẫn ở trạng thái trước đó.',
  'book.toast.removed': 'Đã xoá chỗ đặt',
  'book.toast.removeFailed': 'Không xoá được chỗ đặt',
  'book.empty.title': 'Chưa đặt gì',
  'book.empty.body':
    'Chỗ ở, bàn ăn, tour và vé đều thuộc về đây — kèm mã xác nhận ở nơi bạn cần dùng tại cửa, và ngày để chúng lên trục thời gian.',
  'book.empty.action': 'Thêm chỗ đặt đầu tiên',
  'book.filtered.title': 'Chưa có loại nào như vậy',
  'book.filtered.body':
    'Không có đặt chỗ nào thuộc các loại bạn chọn ở đây. Xoá bộ lọc để xem phần còn lại.',
  'book.filtered.action': 'Xoá bộ lọc',
  'book.panel.outstanding': 'Còn phải lo',
  'book.panel.outstandingEmpty':
    'Không còn gì tồn đọng — mọi thứ ở đây đã xong.',
  'book.panel.settled': 'Đã xong',
  'book.panel.settledEmpty': 'Chưa có gì xong — tất cả vẫn còn phải theo.',
  'book.import.badge': 'Bản nhập chưa kiểm',
  'book.import.hint':
    'Nhập từ một email xác nhận. Mở và lưu lại để đánh dấu đã kiểm.',
  'book.import.action': 'Nhập',
  'book.import.title': 'Nhập chỗ đặt từ một tệp',
  'book.import.description':
    'Thả một xác nhận vào đây và chúng tôi sẽ đọc. Chưa có gì vào chuyến cho tới khi bạn xem xong.',
  'book.import.drop.idle': 'Thả tệp vào đây, hoặc tự chọn',
  'book.import.drop.active': 'Nhả ra để thêm',
  'book.import.drop.formats':
    'PDF, thư đã lưu, trang web, ảnh, Word, Excel, tệp lịch hoặc bản xuất JSON.',
  'book.import.drop.limits': 'Tối đa {files} tệp mỗi lần, mỗi tệp tới {size}.',
  'book.import.drop.browse': 'Chọn tệp',
  'book.import.refused.format':
    '“{filename}” không phải tệp mà bản nhập này đọc được. Nó đọc PDF, thư đã lưu, trang web, ảnh, tài liệu Word hoặc Excel, tệp lịch hoặc bản xuất JSON.',
  'book.import.refused.tooMany':
    'Chỉ {files} tệp mỗi lần. Phần còn lại không được thêm.',
  'book.import.refused.tooLarge':
    '“{filename}” nặng {size}. Bản nhập đọc tệp tới {limit}.',
  'book.import.refused.empty': '“{filename}” rỗng, nên không có gì để đọc.',
  'book.import.ceiling.title':
    'Không gian này đã đọc hết xác nhận của tháng nay',
  'book.import.ceiling.body':
    'Gói bao gồm {ceiling} lần đọc tệp mỗi tháng, và hạn mức làm mới vào ngày một. Bạn vẫn có thể thêm chỗ đặt bằng tay.',
  'book.import.ceiling.none':
    'Đọc tệp xác nhận không nằm trong gói của không gian này',
  'book.import.ceiling.noneBody':
    'Nâng gói để được đọc xác nhận thay bạn. Thêm chỗ đặt bằng tay thì luôn có.',
  'book.import.widget.title': 'Đang đọc xác nhận',
  'book.import.widget.working': 'Đã đọc {done} trên {total}',
  'book.import.widget.file': 'Đang đọc “{filename}”',
  'book.import.widget.done': {
    other: '{count} chỗ đặt chờ bạn xem',
  },
  'book.import.widget.review': 'Xem lại',
  'book.import.widget.failed': 'Không đọc được “{filename}”',
  'book.import.widget.stalled': 'Việc này lâu hơn dự tính',
  'book.import.widget.check': 'Xem lại lần nữa',
  'book.import.widget.dismiss': 'Bỏ qua',
  'book.import.review.title': 'Những gì chúng tôi đọc được',
  'book.import.review.from': 'Từ “{filename}”',
  'book.import.review.selectAll': 'Chọn tất cả',
  'book.import.review.selectNone': 'Bỏ chọn hết',
  'book.import.review.confirm': {
    other: 'Thêm {count} chỗ đặt',
  },
  'book.import.review.confirmNone': 'Chọn một chỗ đặt để thêm',
  'book.import.review.cancel': 'Huỷ',
  'book.import.review.needsReview': 'Cần xem lại',
  'book.import.review.needsReviewHint':
    'Một số ô không có trong tài liệu. Thêm xong thì mở chỗ đặt ra xem.',
  'book.import.review.noPrice': 'Không đọc ra giá',
  'book.import.review.noPriceHint':
    'Tài liệu không ghi rõ giá, nên ô này để trống thay vì đoán.',
  'book.import.review.untitled': 'Chỗ đặt chưa có tên',
  'book.import.empty.title':
    'Chúng tôi không tìm thấy chỗ đặt nào trong tệp đó',
  'book.import.empty.body':
    '“{filename}” không có gì trông giống một xác nhận. Thử tệp khác, hoặc thêm chỗ đặt bằng tay.',
  'book.import.failed.title': 'Không đọc được “{filename}”',
  'book.import.failed.body':
    'Tệp mở được nhưng không dựng ra được gì. Thử tệp khác, hoặc thêm chỗ đặt bằng tay.',
  'book.import.failed.retry': 'Thử tệp khác',
  'book.import.uploadFailed': '“{filename}” chưa tải lên được',
  'book.import.uploadRetry': 'Thử lại',
  'book.import.actionFailed': 'Hãy thử lại sau giây lát.',
  'book.import.toast.added': {
    other: 'Đã thêm {count} chỗ đặt',
  },
  'book.import.partial.title': 'Đã thêm {written} trên {total} chỗ đặt',
  'book.import.partial.body':
    'Phần còn lại vẫn đang được chọn. Thêm lần nữa chỉ ghi những cái đó.',
  'book.import.partial.retry': 'Thêm phần còn lại',
  'book.journeyLink': 'Ở thẻ di chuyển',
  'filter.all': 'Tất cả',
  'book.remove.body':
    'Nó rời trục thời gian vĩnh viễn. Nếu chỉ bị huỷ, hãy đặt trạng thái là “Đã huỷ” để giữ lại bản ghi.',
  'book.remove.confirm': 'Xoá chỗ đặt',
  'book.menu.edit': 'Sửa chỗ đặt…',
  'book.menu.open': 'Mở chỗ đặt',
  'book.noDate': 'Chưa có ngày',
  'book.until': 'Đến',
  'book.provider': 'Nhà cung cấp',
  'book.where': 'Ở đâu',
  'book.guests': 'Số người',
  'book.confirmation': 'Mã xác nhận',
  'book.undated': 'Cho chúng một ngày và chúng sẽ lên trục thời gian',
  statusOf: 'Trạng thái của {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Chưa có trạng thái nào',
  'book.statusChoice.pending': 'Chờ xác nhận — đang đợi phía họ',
  'book.dialog.addTitle': 'Thêm một chỗ đặt',
  'book.dialog.editTitle': 'Sửa chỗ đặt này',
  'book.dialog.typeLegend': 'Loại chỗ đặt nào',
  'book.field.namePlaceholder': '15 Nguyễn Huệ',
  'book.field.priceHint': 'Để trống nếu chưa thanh toán.',
  'book.field.confirmation': 'Mã xác nhận',
  'book.field.confirmationHint': 'Mã họ sẽ hỏi ở quầy.',
  'book.field.day': 'Gắn vào một ngày',
  'book.field.dayHint': 'Ghim vào lịch trình để nó hiện trong kế hoạch.',
  'book.field.noDay': 'Ngoài lịch trình',
  'book.field.link': 'Liên kết',
  'book.field.notesPlaceholder':
    'Đã hẹn nhận phòng muộn. Xin phòng xa thang máy.',
  'book.action.add': 'Thêm chỗ đặt',
  'book.action.save': 'Lưu chỗ đặt',
  'book.action.saving': 'Đang lưu chỗ đặt',
  'book.toast.added': 'Đã thêm chỗ đặt',
  'book.toast.addedBody': 'Nó đã lên trục thời gian.',
  'book.toast.addFailed': 'Chưa thêm được chỗ đặt',
  'book.toast.updated': 'Đã cập nhật chỗ đặt',
  'book.toast.updateFailed': 'Chưa cập nhật được chỗ đặt',

  'book.emptyFacts':
    'Ngoài tên thì chưa có gì. Mở ra để thêm giờ, giá và mã xác nhận.',
  'book.onItinerary': 'Trong lịch trình: {day}',
  'book.dayNumber': 'Ngày {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Khác',
  'book.field.host': 'Khách sạn hoặc chủ nhà',
  'book.field.restaurant': 'Tên nhà hàng',
  'book.field.operator': 'Đơn vị tổ chức',
  'book.field.issuer': 'Do ai phát hành',
  'book.field.carrier': 'Nhà vận chuyển',
  'book.field.address': 'Địa chỉ',
  'book.field.meetingPoint': 'Điểm hẹn',
  'book.field.venue': 'Địa điểm',
  'book.field.fromTo': 'Từ và đến',
  'book.field.checkIn': 'Nhận phòng',
  'book.field.date': 'Ngày',
  'book.field.validOn': 'Có hiệu lực',
  'book.field.departs': 'Khởi hành',
  'book.field.checkOut': 'Trả phòng',
  'book.field.ends': 'Kết thúc',
  'book.field.arrives': 'Đến',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Bảo tàng Ghibli',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Ai đang giữ chỗ này cho bạn',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 phòng twin',
  'book.example.restaurantTitle': 'Ăn tối ở Den',
  'book.example.activityTitle': 'teamLab Planets, 4 vé',
  'book.example.tourTitle': 'Đi bộ trong rừng tre Arashiyama',
  'book.example.ticketTitle': 'Bảo tàng Ghibli, vào lúc 10:00',
  'book.example.transportTitle': 'Nozomi 21 đi Kyoto',
  'book.example.otherTitle': 'Bạn đã đặt gì',
  'book.hint.accommodation':
    'Một khách sạn, một ryokan, một căn hộ — bất cứ nơi nào bạn ngủ.',
  'book.hint.restaurant': 'Một bàn đã đặt. Giờ mới là điều họ giữ bạn.',
  'book.hint.activity': 'Một lớp học, một nhà tắm, một trải nghiệm đã đặt.',
  'book.hint.tour': 'Một nơi, một giờ, và người dẫn đang đợi.',
  'book.hint.ticket':
    'Vào theo giờ, vé vào bảo tàng, một trận đấu. Giữ mã trong tay.',
  'book.hint.transport':
    'Một chỗ ngồi đã đặt. Lượt di chuyển đầy đủ kèm mã thuộc về {module}.',
  'book.hint.other':
    'Bất cứ thứ gì giữ dưới tên bạn mà không khớp phần nào khác.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Xếp hành lý',
  'lists.kind.todo': 'Việc cần làm',
  'lists.kind.shopping': 'Mua sắm',
  'lists.kind.documents': 'Giấy tờ',
  'lists.kind.fallback': 'Danh sách',
  'colour.none': 'Không màu',
  'colour.pine': 'Xanh thông',
  'colour.inkBlue': 'Xanh mực',
  'colour.amber': 'Hổ phách',
  'colour.green': 'Xanh lá',
  'colour.red': 'Đỏ',
  'colour.slate': 'Xám đá',
  'lists.toast.created': 'Đã tạo danh sách',
  'lists.toast.createdBody': 'Thêm điều đầu tiên bạn không được quên.',
  'lists.toast.createFailed': 'Chưa tạo được danh sách',
  'lists.toast.updated': 'Đã cập nhật danh sách',
  'lists.toast.updateFailed': 'Chưa cập nhật được danh sách',
  'lists.error.weightLimit': 'Giới hạn khối lượng là một số nguyên gam.',
  'lists.dialog.editTitle': 'Sửa danh sách này',
  'lists.dialog.editBody':
    'Đổi tên, đổi loại danh sách, hoặc giao cho một người.',
  'lists.dialog.addBody':
    'Xếp hành lý, việc cần làm, mua sắm và giấy tờ không được quên — mỗi thứ một danh sách riêng.',
  'lists.action.new': 'Danh sách mới',
  'lists.field.namePlaceholder': 'Hành lý xách tay',
  'lists.field.kind': 'Loại',
  'lists.field.kindAria': 'Loại danh sách',
  'lists.field.owner': 'Thuộc về',
  'lists.field.ownerHint': 'Danh sách dùng chung thì ai cũng tích được.',
  'lists.field.everyone': 'Mọi người trong chuyến đi',
  'lists.field.weightLimit': 'Giới hạn khối lượng',
  'lists.field.weightLimitHint':
    'Gam. Để trống nếu không có giới hạn nào phải giữ.',
  'colour.legend': 'Màu',
  'lists.action.saving': 'Đang lưu danh sách',
  'lists.action.save': 'Lưu danh sách',
  'lists.action.create': 'Tạo danh sách',
  'lists.item.toast.added': 'Đã thêm mục',
  'lists.item.toast.addFailed': 'Chưa thêm được mục',
  'lists.item.toast.updated': 'Đã cập nhật mục',
  'lists.item.toast.updateFailed': 'Chưa cập nhật được mục',
  'lists.item.error.quantity': 'Số lượng là một số nguyên từ 1 đến 999.',
  'lists.item.error.weight': 'Khối lượng là một số nguyên gam.',
  'lists.item.dialog.editTitle': 'Sửa mục này',
  'lists.item.dialog.addTitle': 'Thêm một mục',
  'lists.item.field.label': 'Mục',
  'lists.item.field.placeholder': 'Hộ chiếu',
  'field.category': 'Phân loại',
  'lists.item.field.categoryHint':
    'Gom danh sách dưới một tiêu đề. Không bắt buộc.',
  'lists.item.field.categoryPlaceholder': 'Giấy tờ',
  'lists.item.field.priority': 'Ưu tiên',
  'lists.priorityChoice.high': 'Cao — đừng quên',
  'lists.priorityChoice.low': 'Thấp — nếu còn chỗ',
  'lists.priorityChoice.normal': 'Thường',
  'lists.item.field.quantity': 'Số lượng',
  'lists.item.field.weight': 'Khối lượng',
  'lists.item.field.weightHint': 'Gam, mỗi cái.',
  'lists.item.field.owner': 'Việc này của ai',
  'lists.item.owner.nobody': 'Không ai cụ thể',
  'lists.item.action.saving': 'Đang lưu mục',
  'lists.item.action.save': 'Lưu mục',
  'lists.item.action.add': 'Thêm vào danh sách',
  'lists.template.loadError': 'Hiện chưa tải được các mẫu.',
  'lists.template.toast.added': 'Đã thêm danh sách từ một mẫu',
  'lists.template.toast.addFailed': 'Mẫu chưa được áp dụng',
  'lists.template.error.apply': 'Cái đó chưa áp dụng được',
  'lists.template.error.load': 'Các mẫu chưa tải được',
  'lists.template.empty.title': 'Chưa có mẫu nào',
  'lists.template.empty.body':
    'Khi bạn có một danh sách mà bạn sẽ làm lại y như vậy, hãy lưu thành mẫu — nó sẽ hiện ở đây cho mọi chuyến sau.',
  'lists.template.applying': 'Đang áp dụng mẫu',
  'lists.template.dialogTitle': 'Bắt đầu từ một mẫu',
  'lists.template.loading': 'Đang tải các mẫu',
  'lists.template.apply': 'Áp dụng mẫu',
  'lists.template.from': 'Từ một mẫu',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Chưa giao ai',
  'lists.toast.listRemoved': 'Đã xóa danh sách',
  'lists.toast.listRemoveFailed': 'Chưa xóa được danh sách',
  'lists.toast.itemRemoved': 'Đã xóa mục',
  'lists.toast.itemRemoveFailed': 'Chưa xóa được mục',
  'lists.toast.reset': 'Đã đặt lại danh sách',
  'lists.toast.resetBody': 'Mọi dấu tích đã được bỏ, sẵn sàng cho chuyến sau.',
  'lists.toast.resetFailed': 'Chưa đặt lại được danh sách',
  'lists.toast.tickFailed': 'Dấu tích chưa được lưu',
  'lists.toast.tickFailedBody': 'Mục đã trở lại như trước.',
  'lists.toast.assignFailed': 'Việc giao cho ai chưa được lưu',
  'lists.toast.orderFailed': 'Thứ tự mới chưa được lưu',
  'lists.toast.orderFailedBody': 'Danh sách đã trở lại như trước.',
  'lists.filter.todo': 'Vẫn còn phải làm',
  'lists.filter.done': 'Xong',
  'lists.scope.all': 'Tất cả danh sách',
  'lists.scope.shared': 'Dùng chung',
  'lists.scope.mine': 'Của tôi',
  'lists.empty.mine.title': 'Bạn chưa có danh sách riêng nào',
  'lists.empty.shared.title': 'Chưa có danh sách dùng chung nào',
  'lists.empty.mine.body':
    'Danh sách riêng chỉ bạn tích — tiện cho những thứ không ai khác cần thấy.',
  'lists.empty.shared.body':
    'Danh sách dùng chung thì ai cũng tích, nên hai người không mang cùng một cục chuyển điện.',
  'lists.remove.list': 'Xóa danh sách',
  'lists.remove.item': 'Xóa mục',
  'lists.remove.itemBody':
    'Nó rời khỏi danh sách này. Không có gì khác thay đổi.',
  'lists.menu.editList': 'Sửa danh sách…',
  'lists.menu.tickAll': 'Tích hết',
  'lists.menu.untickAll': 'Bỏ tích hết',
  'lists.menu.reset': 'Đặt lại cho chuyến sau',
  'lists.menu.dragOrderLong': 'Chuyển sang thứ tự bạn có thể kéo',
  'lists.menu.groupAgain': 'Gom theo phân loại lần nữa',
  'lists.menu.dragOrder': 'Chuyển sang thứ tự kéo được',
  'lists.menu.groupByCategory': 'Gom theo phân loại',
  'lists.weight.packed': 'Đã xếp {weight}',
  'lists.weight.packedOver': 'Đã xếp {weight} — vượt giới hạn',
  'lists.weight.packedOf': 'Đã xếp {weight} trên {limit} được phép',
  'lists.weight.packedOfOver':
    'Đã xếp {weight} trên {limit} được phép — vượt giới hạn',
  'lists.progress.ticked': 'Đã tích {done} trên {total}',
  'lists.items.empty.title': 'Danh sách này đang trống',
  'lists.items.empty.body':
    'Thêm điều đầu tiên bạn không được quên — ô bên dưới là nhanh nhất.',
  'lists.items.doneEmpty.title': 'Chưa tích gì cả',
  'lists.items.doneEmpty.body': 'Tích một thứ và nó sẽ hiện ở đây.',
  'lists.items.todoEmpty.title': 'Ở đây đã xong hết',
  'lists.items.todoEmpty.body':
    'Mọi mục trong danh sách này đều đã tích. Chuyển sang “{label}” để xem.',
  'lists.category.other': 'Tất cả phần còn lại',
  'lists.dnd.fallbackName': 'mục này',
  'lists.dnd.picked': 'Đã nhấc {name}.',
  'lists.dnd.dropped': 'Đã đặt {name}. Thứ tự mới đang được lưu.',
  'lists.dnd.cancelled': 'Đã hủy. Thứ tự không đổi.',
  'lists.menu.editItem': 'Sửa mục…',
  'lists.quickAdd.placeholder': 'Nhập một mục rồi nhấn Enter',
  'lists.quickAdd.aria': 'Thêm một mục vào danh sách này',
  'lists.quickAdd.detailsHint':
    'Thêm kèm khối lượng, phân loại hoặc người phụ trách',
  'lists.quickAdd.detailsAria': 'Thêm một mục với đầy đủ chi tiết',
  'lists.show': 'Hiện',
  'lists.priority.high': 'Cao',
  'lists.action.add': 'Thêm',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    other: '{count} mục',
  },
  'lists.template.copiedIn': {
    other: 'Đã chép {count} mục, sẵn sàng để tích.',
  },
  'lists.remove.listBody': {
    other:
      'Danh sách và {count} mục của nó rời khỏi chuyến này. Các mẫu bạn đã lưu không bị ảnh hưởng.',
  },

  'lists.item.dialog.body':
    'Ngoài tên thì mọi thứ đều không bắt buộc — có khối lượng thì tổng hành lý mới thật, có phân loại thì danh sách mới gom được.',
  'lists.template.dialogBody':
    'Mẫu là một danh sách bạn đã lưu trước đó. Áp dụng một mẫu sẽ chép nó thành danh sách mới trong chuyến này — bản gốc vẫn nguyên.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Xóa “{name}”?',
  actionsFor: 'Thao tác cho {name}',
  'lists.dnd.reorder': 'Sắp xếp lại {name}',
  'lists.action.untickItem': 'Bỏ tích {name}',
  'lists.action.tickOffItem': 'Tích {name}',
  'lists.item.assignAria': 'Giao {name} cho ai đó',
  'lists.item.reassignAria': '{item} là của {owner} — giao lại',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Đặt cho chỗ đặt này một cái tên bạn nhận ra trong danh sách.',
  'error.titleLong': 'Giữ tên dưới 160 ký tự.',
  'book.error.required': 'Chỗ đặt này còn thiếu {field}.',
  'book.error.timeNeedsDate': 'Một giờ cần ngày mà nó thuộc về.',
  'book.error.endTimeNeedsDate': 'Giờ kết thúc cần ngày mà nó thuộc về.',
  'book.error.endsBeforeStart': 'Cái này kết thúc trước khi bắt đầu.',
  'book.fieldName.checkInDay': 'ngày nhận phòng',
  'book.fieldName.checkOutDay': 'ngày trả phòng',
  'book.stay.pickDay': 'Chọn một ngày',
  'book.stay.nights': {
    other: '{count} đêm',
  },
  'book.stay.range': 'từ {from} đến {to}',
  'book.stay.label': 'Lưu trú',
  'book.remove.keepsNights':
    'Các đêm vẫn ở trong chuyến đi. Chỉ chỗ đặt bị xoá.',
  'book.menu.removeWithStay': 'Xoá chỗ đặt và lưu trú',
  'book.removeStay.body': 'Cả chỗ đặt lẫn các đêm nó chi trả đều bị xoá.',
  'book.toast.stayRemoved': 'Đã xoá chỗ đặt và lưu trú',
  'book.error.endTimeBeforeStart': 'Giờ kết thúc sớm hơn giờ bắt đầu.',
  'book.error.guests': 'Số khách phải là số nguyên tối đa 1000.',
  'error.price': 'Số tiền này chúng tôi không đọc được.',
  'book.error.url': 'Liên kết phải bắt đầu bằng http:// hoặc https://.',
  'book.error.confirmationLong': 'Mã xác nhận này quá dài để lưu.',
  'book.error.stopGone': 'Điểm dừng đó không còn trong chuyến đi này.',
  'book.ledger.unlinked':
    'Dòng chi phí của đặt chỗ này vẫn nằm trong chi phí chuyến đi, nhưng không còn liên kết với đặt chỗ.',
  'book.ledger.updated':
    'Dòng chi phí của đặt chỗ này sẽ được cập nhật thành {money}.',
  'book.ledger.needsDate':
    'Hãy đặt ngày cho đặt chỗ này để chi phí của nó được thêm vào chi phí chuyến đi.',
  'book.ledger.added':
    'Một dòng {money} sẽ được thêm vào chi phí của chuyến đi này.',
  'book.fieldName.provider': 'nhà vận chuyển',
  'book.fieldName.location': 'địa điểm',
  'book.fieldName.confirmationNumber': 'mã xác nhận',
  'book.fieldName.link': 'liên kết',
  'book.fieldName.date': 'ngày',
  'book.fieldName.time': 'giờ',
  'book.fieldName.endDate': 'ngày kết thúc',
  'book.fieldName.endTime': 'giờ kết thúc',
  'book.fieldName.guests': 'số khách',
  'book.fieldName.price': 'giá',
  'book.fieldName.stop': 'điểm dừng',
  'book.field.stop': 'Điểm dừng liên kết',
  'book.field.stopHint': 'Đặt chỗ này thuộc điểm dừng nào của kế hoạch.',
  'book.field.stopHintEmpty':
    'Hãy thêm một địa điểm vào một ngày trước, rồi mới gắn đặt chỗ này vào đó',
  'book.field.stopPlaceholder': 'Không gắn điểm dừng',
  'book.field.stopSearch': 'Tìm trong điểm dừng và ngày',
  'book.field.stopEmpty': 'Không có điểm dừng nào khớp',
  'book.ledger.refused.title': 'Đã lưu, nhưng chưa thêm vào chi phí',
  'book.ledger.refused.body':
    'Đặt chỗ đã nằm trong chuyến đi. Việc thêm dòng chi phí vào chi phí chuyến đi không thành — hãy thử lại nửa đó.',
  'book.action.ledgerRetry': 'Thêm vào chi phí',
  'book.ledger.splitStale.title': 'Đã lưu, nhưng phần chia không còn khớp',
  'book.ledger.splitStale.body':
    'Đặt chỗ và giá mới đã được lưu, nhưng cách chia khoản chi phí này không theo kịp tổng mới. Hãy mở khoản đó trong Chi phí và sửa lại phần chia.',
  'book.action.done': 'Xong',
  'book.copyConfirmation': 'mã xác nhận của {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Chuyến bay',
  'transports.mode.train': 'Tàu hỏa',
  'transports.mode.bus': 'Xe khách',
  'transports.mode.ferry': 'Phà',
  'transports.mode.car': 'Xe hơi',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Xe công cộng',
  'transports.mode.metro': 'Tàu điện ngầm',
  'transports.mode.tram': 'Tàu điện',
  'transports.mode.bike': 'Xe đạp',
  'transports.mode.walk': 'Đi bộ',
  'transports.mode.other': 'Khác',
  'transports.mode.fallback': 'Lượt di chuyển',
  'transports.rank.earliest': 'Đến sớm nhất',
  'transports.rank.fewestChanges': 'Ít lần chuyển nhất',
  'transports.connection.findStop': 'Tìm điểm dừng',
  'transports.connection.findStopSearch': 'SGN, Sài Gòn, TP.HCM…',
  'transports.connection.findStopEmpty':
    'Không có điểm dừng nào tên đó trong danh mục.',
  'transports.connection.hideStops': 'Ẩn các điểm dừng',
  'transports.connection.seeStops': 'Xem các điểm dừng',
  'transports.connection.saving': 'Đang lưu tuyến',
  'transports.connection.use': 'Chọn tuyến này',
  'transports.connection.onFoot': 'Đi bộ',
  'transports.connection.service': 'Chuyến',
  'transports.connection.direct': 'thẳng',
  'transports.connection.changes': {
    other: '{changes} lần chuyển',
  },
  'transports.connection.tooLong':
    'Tuyến này có hơn {max} chặng, nhiều hơn sức chứa của một bản ghi hành trình. Hãy tìm chặng ngắn hơn và ghi phần còn lại riêng.',
  'transports.connection.refusal.ceiling': 'Tháng này đã hết lượt tìm',
  'transports.connection.refusal.unconfigured':
    'Tìm tuyến bị tắt trên bản triển khai này',
  'transports.connection.refusal.provider':
    'Dịch vụ thời gian biểu không trả lời',
  'transports.connection.refusal.plan': 'Tìm tuyến không nằm trong gói này',
  'transports.connection.refusal.planBody':
    'Nâng gói để tìm thời gian biểu ngay trong chuyến đi. Chặng đi vẫn có thể ghi tay.',
  'transports.connection.refusal.ceilingBody':
    'Hạn mức {ceiling} lượt của tháng đã dùng hết, sẽ làm mới vào ngày đầu tháng sau. Chặng đi vẫn có thể ghi tay.',
  'transports.connection.refusal.unconfiguredBody':
    'Ở đây chưa cài dịch vụ thời gian biểu nên không tìm gì cả. Hãy ghi chặng đi bằng tay.',
  'transports.connection.refusal.providerBody':
    'Không có gì trả về để hiển thị. Thử lại sau giây lát, hoặc ghi chặng đi bằng tay.',
  'transports.connection.invitation':
    'Hai điểm dừng và một ngày, thời gian biểu sẽ trả lời. Không có gì được lưu cho tới khi bạn chọn.',
  'transports.connection.empty':
    'Không tìm thấy tuyến nào giữa hai điểm dừng đó vào ngày đó. Hãy thử ga lân cận, hoặc mở rộng bộ lọc phương tiện.',
  'transports.connection.credit': 'Dữ liệu lịch trình từ',
  'transports.connection.searchFailed': 'Tìm kiếm không chạy',
  'transports.connection.searchFailedBody': 'Hãy thử lại sau giây lát.',
  'transports.connection.saved': 'Đã lưu tuyến',
  'transports.connection.replaced': 'Đã thay lộ trình',
  'transports.connection.replacedBody': 'Mã đặt chỗ và chỗ ngồi vẫn nguyên.',
  'transports.connection.saveFailed': 'Tuyến chưa được lưu',
  'transports.connection.saveError': 'Chưa lưu được',
  'transports.connection.fromHint':
    'Hãy chọn một điểm dừng — thời gian biểu được hỏi ở đâu, không phải tên gọi.',
  'transports.connection.toHint': 'Hãy chọn một điểm dừng từ danh mục.',
  'transports.connection.timeHint':
    'Lịch trình trả về vài chuyến kế tiếp, nên giờ này quyết định là những chuyến nào.',
  'transports.connection.onlyModes': 'Chỉ những phương tiện này',
  'transports.connection.searching': 'Đang tìm trong thời gian biểu',
  'transports.connection.search': 'Tìm tuyến',
  'transports.connection.title': 'Từ {from} đến {to}',
  'transports.status.idea': 'Ý tưởng',
  'transports.status.pending': 'Chờ xác nhận',
  'transports.status.confirmed': 'Đã xác nhận',
  'transports.status.completed': 'Đã xong',
  'transports.status.cancelled': 'Đã hủy',
  'transports.end.fromAirport': 'Sân bay đi',
  'transports.end.toAirport': 'Sân bay đến',
  'transports.end.fromPort': 'Cảng đi',
  'transports.end.toPort': 'Cảng đến',
  'transports.end.fromStation': 'Ga đi',
  'transports.end.toStation': 'Ga đến',
  'transports.end.from': 'Từ',
  'transports.end.to': 'Đến',
  'transports.end.pickUp': 'Nhận xe',
  'transports.end.dropOff': 'Trả xe',
  'transports.end.departureDay': 'Ngày khởi hành',
  'transports.end.arrivalDay': 'Ngày đến',
  'transports.end.pickUpDay': 'Ngày nhận xe',
  'transports.end.returnDay': 'Ngày trả xe',
  'transports.dayNumber': 'Ngày {n}',
  'transports.error.titleEmpty':
    'Đặt cho lượt di chuyển này một cái tên bạn nhận ra trong danh sách.',
  'transports.error.date': 'Ngày viết theo YYYY-MM-DD.',
  'transports.error.time': 'Giờ viết theo HH:MM, đồng hồ 24 giờ.',
  'transports.error.departureNeedsDate':
    'Giờ khởi hành cần ngày mà nó thuộc về.',
  'transports.error.arrivalNeedsDate': 'Giờ đến cần ngày mà nó thuộc về.',
  'transports.error.code': 'Mã gồm 2 đến 8 chữ hoặc số.',
  'transports.error.distance': 'Khoảng cách là số kilômét, tối đa 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Lượt di chuyển này đến trước khi khởi hành.',
  'transports.error.timingHint':
    'Dịch một trong hai giờ để thực sự bắt được lượt di chuyển này.',
  'transports.error.arrivalDayBeforeDeparture':
    'Ngày đến rơi vào trước ngày khởi hành.',
  'transports.error.returnDayBeforePickUp':
    'Ngày trả xe rơi vào trước ngày nhận xe.',
  'transports.field.noDay': 'Chưa có ngày',
  'transports.fill.legend': 'Cách điền phần này',
  'transports.fill.manual': 'Tự nhập',
  'transports.fill.searchAgain': 'Tìm lại',
  'transports.fill.search': 'Tìm chuyến nối',
  'transports.chain.unsplit': 'Gộp lại thành một chuyến',
  'transports.field.arrivalDayHint':
    'Chuyến đến vào sáng hôm sau sẽ ghi điều đó ở đây.',
  'transports.chain.splitHint':
    'Chuyển tiếp giữa đường? Ghi từng phần với số hiệu, sân ga, chỗ ngồi và giờ riêng.',
  'transports.chain.split': 'Chia thành các chặng',
  'transports.chain.stopNumber': 'điểm dừng {n}',
  'transports.chain.change': 'Chuyển {n}',
  'transports.chain.removeStation': 'Xoá {label}',
  'transports.chain.findStation': 'Tìm sân bay hoặc nhà ga',
  'transports.chain.findStationFor': 'Tìm sân bay hoặc nhà ga cho {label}',
  'transports.chain.findPlaceholder': 'SGN, Tân Sơn Nhất, TP.HCM…',
  'transports.chain.findEmpty':
    'Không có kết quả — hãy tự nhập điểm dừng bên dưới.',
  'transports.chain.stopLabel': 'Điểm dừng',
  'transports.chain.stopPlaceholder': 'Ga Sài Gòn',
  'transports.chain.timezoneHint': 'Điểm dừng này theo đồng hồ nào',
  'transports.chain.timezoneAt': 'Múi giờ tại {label}',
  'transports.chain.timezonePlaceholder': 'Chưa nêu',
  'transports.chain.timezoneSearch': 'Hà Nội, Tokyo, UTC…',
  'transports.chain.acrossClocks': '{gap} qua hai đồng hồ',
  'transports.chain.addStopAfter': 'Thêm điểm dừng sau {label}',
  'transports.chain.servicePlaceholder': 'SE4',
  'transports.chain.leaves': 'Rời {label}',
  'transports.chain.reaches': 'Tới {label}',
  'transports.chain.dayOfLeg': '{label} của chặng {n}',
  'transports.chain.formError': 'Không thể lưu chuỗi này',
  'transports.chain.atCap':
    'Một chuỗi chứa nhiều nhất {max} chặng — đó là giới hạn của một lần lưu, không phải giới hạn số lần chuyển của hành trình.',
  'transports.chain.hint':
    'Thêm điểm dừng vào bất kỳ chặng nào để ghi lại lần đổi tàu; mỗi chặng giữ số hiệu, sân ga và ghế riêng.',
  'transports.field.timezone': 'Múi giờ',
  'transports.field.platform': 'Sân ga',
  'transports.chain.legNumber': 'Chặng {n}',
  'transports.chain.platform': 'Sân ga {value}',
  'transports.chain.seat': 'Ghế {value}',
  'transports.chain.error.stopName':
    'Mỗi điểm dừng cần một tên — đây là nơi bạn chuyển tiếp.',
  'transports.chain.error.stopNameLong':
    'Tên điểm dừng phải ngắn hơn 200 ký tự.',
  'transports.chain.error.timezone': 'Chọn một múi giờ từ danh sách.',
  'transports.chain.error.tooManyLegs': 'Một chuỗi chứa tối đa {max} chặng.',
  'transports.bookingRefFor': 'mã đặt chỗ của {title}',
  'transports.doorToDoor': 'Tính cả đi lại là {gap}.',
  'transports.title.fromTo': '{operator} từ {from} đến {to}',
  'transports.title.from': '{operator} từ {from}',
  'transports.title.to': '{operator} đến {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Không có giờ nào để so',
  'transports.junction.unknown.detail':
    'Điền ngày và giờ cho cả hai lượt di chuyển, việc nối chuyến này sẽ được kiểm tra giúp bạn.',
  'transports.junction.impossible.headline':
    'Khởi hành trước khi lượt di chuyển trước tới {gap}',
  'transports.junction.impossible.detail':
    '“{to}” khởi hành trước khi “{from}” tới, nên không bắt được cả hai. Dịch một lượt.',
  'transports.junction.tight.headline': '{gap} để nối chuyến',
  'transports.junction.tight.detail':
    '{mode} thường cần khoảng {required}. Lần này hơi sát.',
  'transports.junction.tight.detailAt':
    '{mode} ở {place} thường cần khoảng {required}. Lần này hơi sát.',
  'transports.junction.ok.headline': 'Cách nhau {gap}',
  'transports.junction.ok.detail':
    'Tới {landing} nhưng lượt di chuyển sau khởi hành từ {boarding} — bạn sẽ phải sang bên đó.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Đã chia sẻ ghi chú',
  'collab.note.toast.sharedBody': 'Mọi người trong chuyến đi đều thấy rồi.',
  'collab.note.toast.shareFailed': 'Chưa chia sẻ được ghi chú',
  'collab.note.toast.updated': 'Đã cập nhật ghi chú',
  'collab.note.toast.updateFailed': 'Chưa cập nhật được ghi chú',
  'collab.note.dialog.editTitle': 'Sửa ghi chú này',
  'collab.note.dialog.addTitle': 'Ghi chú chung mới',
  'collab.note.dialog.body':
    'Quán ăn nên thử, quy định visa, mã cửa chính — mọi thứ cả chuyến cần nhớ, gom một chỗ.',
  'collab.note.field.title': 'Tiêu đề',
  'collab.note.field.titlePlaceholder': 'Mã cửa chính',
  'collab.note.field.body': 'Ghi chú',
  'collab.note.field.bodyPlaceholder':
    '4821 rồi bấm dấu thăng. Hộp chìa khóa nằm bên trái cửa.',
  'collab.note.field.categoryHint': 'Gom bảng theo một bộ lọc. Không bắt buộc.',
  'collab.note.field.categoryPlaceholder': 'Hậu cần',
  'collab.note.field.pin': 'Ghim lên đầu bảng',
  'collab.note.field.pinHint':
    'Ghi chú đã ghim luôn đứng trước, thêm gì nữa cũng vậy.',
  'collab.note.action.saving': 'Đang lưu ghi chú',
  'collab.note.action.save': 'Lưu ghi chú',
  'collab.note.action.share': 'Chia sẻ ghi chú',
  'collab.poll.toast.opened': 'Đã mở bình chọn',
  'collab.poll.toast.openedBody': 'Mọi người trong chuyến đi có thể bình chọn.',
  'collab.poll.toast.openFailed': 'Chưa mở được bình chọn',
  'collab.poll.dialog.addTitle': 'Bình chọn mới',
  'collab.poll.field.question': 'Câu hỏi',
  'collab.poll.field.questionPlaceholder': 'Tối cuối mình ăn ở đâu?',
  'collab.poll.field.optionsLegend': 'Lựa chọn',
  'collab.poll.field.option': 'Phương án {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Thêm một phương án',
  'collab.poll.action.addOption': 'Thêm một phương án',
  'collab.poll.action.removeOption': 'Bỏ phương án {n}',
  'collab.poll.field.multi': 'Cho chọn nhiều hơn một',
  'collab.poll.field.multiHint':
    'Tắt thì mỗi người một phiếu, đổi ý thì phiếu chuyển sang.',
  'collab.poll.action.opening': 'Đang mở bình chọn',
  'collab.poll.action.open': 'Mở bình chọn',
  'collab.poll.error.tooFew':
    'Bình chọn cần ít nhất hai thứ để chọn giữa chúng.',
  'collab.poll.error.duplicate':
    'Hai phương án nói cùng một điều. Hãy diễn đạt mỗi cái một cách.',
  'collab.presence.viewingNow': 'đang xem',
  'collab.presence.unnamed': 'Thành viên chưa đặt tên',
  'collab.presence.tabsOpen': {
    other: '{name} — {count} thẻ đang mở',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Đồng ý',
  'collab.reaction.love': 'Thích quá',
  'collab.reaction.funny': 'Buồn cười',
  'collab.reaction.celebrate': 'Chúc mừng',
  'collab.reaction.thanks': 'Cảm ơn',
  'collab.reaction.looking': 'Đang xem',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, có cả bạn',
  'collab.thread.today': 'Hôm nay',
  'collab.thread.emptyBody':
    'Mọi người trong chuyến đi này cùng dùng một cuộc trò chuyện. Các quyết định ở đây được lưu cùng chuyến đi thay vì rải rác trong các nhóm trò chuyện.',
  'collab.thread.empty': 'Chưa có tin nhắn nào',
  'collab.toast.reactionFailed': 'Chưa lưu được biểu cảm',
  'collab.toast.messageDeleted': 'Đã xóa tin nhắn',
  'collab.toast.deleteFailed': 'Chưa xóa được tin nhắn',
  'collab.toast.notSent': 'Chưa gửi',
  'collab.toast.notSentBody': 'Không gửi được tin nhắn. Thử lại sau một lát.',
  'collab.toast.messageUpdated': 'Đã cập nhật tin nhắn',
  'collab.toast.editFailed': 'Chưa lưu được chỉnh sửa',
  'collab.message.deleteTitle': 'Xóa tin nhắn này?',
  'collab.message.deleteBody':
    'Nội dung biến khỏi luồng. Các trả lời cho nó vẫn ở nguyên chỗ.',
  'collab.message.delete': 'Xóa tin nhắn',
  'collab.message.reply': 'Trả lời',
  'collab.message.menuEdit': 'Sửa tin nhắn…',
  'collab.message.react': 'Bày tỏ với tin nhắn này',
  'collab.message.edited': 'đã sửa',
  'collab.message.actionsFor': 'Thao tác cho tin nhắn của {name}',
  'collab.compose.editingYours': 'Bạn đang sửa tin nhắn của mình',
  'collab.compose.replyingTo': 'Đang trả lời {name}',
  'collab.compose.cancelReply': 'Hủy trả lời',
  'collab.compose.cancelEdit': 'Hủy sửa',
  'collab.compose.placeholder': 'Nhắn cho cả chuyến',
  'collab.compose.placeholderText': 'Nhắn gì đó cho cả nhóm…',
  'collab.compose.editPlaceholder': 'Sửa tin nhắn của bạn',
  'collab.compose.editPlaceholderText': 'Đổi lại điều bạn đã nói…',
  'collab.compose.send': 'Gửi tin nhắn',
  'collab.compose.savingEdit': 'Đang lưu chỉnh sửa',
  'collab.compose.save': 'Lưu',
  'collab.hint.sends': 'để gửi',
  'collab.hint.addsLine': 'để xuống dòng',
  'collab.hint.cancels': 'để hủy',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Đã xóa ghi chú',
  'collab.toast.noteRemoveFailed': 'Chưa xóa được ghi chú',
  'collab.notes.empty.title': 'Chưa có ghi chú chung nào',
  'collab.notes.empty.body':
    'Quán ăn nên thử, quy định visa, mã cửa chính — mọi thứ cả chuyến cần nhớ.',
  'collab.notes.empty.action': 'Viết ghi chú đầu tiên',
  'collab.note.menu.edit': 'Sửa ghi chú…',
  'collab.note.menu.unpin': 'Bỏ ghim',
  'collab.note.menu.pin': 'Ghim lên đầu',
  'collab.note.remove': 'Xóa ghi chú',
  'collab.note.removeBody':
    'Ghi chú sẽ mất khỏi bảng của mọi người trong chuyến.',
  'collab.note.new': 'Ghi chú mới',
  'collab.poll.toast.voteFailed': 'Chưa lưu được phiếu của bạn',
  'collab.poll.toast.voteFailedBody': 'Số phiếu không đổi.',
  'collab.poll.toast.closed': 'Đã đóng bình chọn',
  'collab.poll.toast.closeFailed': 'Chưa đóng được bình chọn',
  'collab.poll.toast.removed': 'Đã xóa bình chọn',
  'collab.poll.toast.removeFailed': 'Chưa xóa được bình chọn',
  'collab.polls.heading': 'Các bình chọn',
  'collab.polls.empty.title': 'Không có bình chọn nào đang mở',
  'collab.polls.empty.body':
    'Khi cả nhóm không thống nhất được nhà hàng, hãy đưa ra bỏ phiếu và để câu trả lời tự ngã ngũ.',
  'collab.polls.empty.action': 'Hỏi cả nhóm',
  'collab.poll.menu.close': 'Đóng bình chọn',
  'collab.poll.remove': 'Xóa bình chọn',
  'collab.poll.removeTitle': 'Xóa bình chọn này?',
  'collab.poll.actionsFor': 'Thao tác cho bình chọn “{question}”',
  'collab.badge.pinned': 'Đã ghim',
  'collab.badge.closed': 'Đã đóng',
  'collab.badge.open': 'Đang mở',
  'collab.badge.multi': 'Chọn nhiều',
  'collab.badge.leading': 'Dẫn đầu',
  'collab.poll.removeBody': {
    other: '“{question}” và {count} phiếu của nó mất với mọi người.',
  },
  'collab.poll.result': {
    other: '{label} — {votes} trên {count} phiếu',
  },
  'collab.poll.resultMine': {
    other: '{label} — {votes} trên {count} phiếu, có phiếu của bạn',
  },
  'collab.poll.voteCount': {
    other: '{count} phiếu',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Tài liệu',
  'files.kind.photo': 'Ảnh',
  'files.kind.ticket': 'Vé',
  'files.kind.receipt': 'Biên lai',
  'files.kind.map': 'Bản đồ',
  'files.kind.other': 'Khác',
  'files.kindChoice.ticket': 'Vé hoặc thẻ ra vào',
  'files.kindChoice.map': 'Bản đồ hoặc lộ trình',
  'files.toast.removed': 'Đã xóa tệp',
  'files.toast.removeFailed': 'Chưa xóa được tệp',
  'files.toast.downloadFailed': 'Tải xuống chưa bắt đầu',
  'files.toast.gone': 'Tệp này không còn dùng được trong thẻ này.',
  'files.toast.uploadFailed': 'Tải lên thất bại. Thử lại nhé.',
  'files.toast.updated': 'Đã cập nhật tệp',
  'files.toast.updateFailed': 'Chưa cập nhật được tệp',
  'files.storage.full': 'Không gian làm việc này đã hết dung lượng',
  'files.storage.used':
    'Đã dùng {used} trên {limit}. Xóa bớt một tệp bên dưới, hoặc lên gói cao hơn, trước khi thêm gì nữa.',
  'files.storage.perFile': 'tối đa {size} mỗi tệp',
  'files.action.add': 'Thêm tệp',
  'files.action.choose': 'Chọn tệp',
  'files.action.upload': 'Tải tệp lên',
  'files.calendar.live.action': 'Liên kết lịch cập nhật',
  'files.calendar.live.title': 'Liên kết lịch cập nhật',
  'files.calendar.warning':
    'Bất kỳ ai có liên kết này đều có thể đọc địa điểm, thời gian, địa chỉ và ghi chú của chuyến đi mà không cần tài khoản. Hãy bảo vệ như mật khẩu.',
  'files.calendar.enable.action': 'Tạo liên kết',
  'files.calendar.link.once':
    'Sao chép ngay - chúng tôi chỉ hiển thị một lần. Nếu làm mất, hãy tạo liên kết mới; liên kết cũ sẽ ngừng hoạt động.',
  'files.calendar.link.address': 'Địa chỉ liên kết',
  'files.calendar.link.copy': 'Sao chép liên kết',
  'files.calendar.link.copied': 'Đã sao chép liên kết',
  'files.calendar.link.copyFailed':
    'Không thể sao chép. Hãy chọn địa chỉ và tự sao chép.',
  'files.calendar.link.open': 'Mở trong ứng dụng lịch',
  'files.calendar.link.google': 'Thêm vào Google Lịch',
  'files.calendar.link.outlook': 'Thêm vào Outlook',
  'files.calendar.link.done': 'Xong',
  'files.calendar.link.stays':
    'Mã xác nhận, giá và tệp vẫn ở trong planned.travel.',
  'files.calendar.freshness':
    'Ứng dụng lịch có thể mất vài giờ, đôi khi lâu hơn, để hiển thị thay đổi.',
  'files.calendar.state.on': 'Liên kết lịch đang bật',
  'files.calendar.state.lastFetched':
    'Một lịch đã kiểm tra liên kết này lần cuối {when}',
  'files.calendar.state.neverFetched': 'Chưa được tải',
  'files.calendar.rotate.action': 'Tạo liên kết mới',
  'files.calendar.rotate.confirmTitle': 'Tạo liên kết mới?',
  'files.calendar.rotate.confirmBody':
    'Liên kết cũ ngừng hoạt động ngay. Các lịch dùng liên kết đó sẽ ngừng cập nhật cho đến khi bạn cung cấp liên kết mới.',
  'files.calendar.rotate.busy': 'Đang tạo liên kết mới…',
  'files.calendar.error.rotate':
    'Chúng tôi không thể xác nhận liên kết mới đã được tạo. Trạng thái hiện tại hiển thị bên dưới; hãy thử lại nếu cần.',
  'files.calendar.rotate.confirm': 'Tạo liên kết mới',
  'files.calendar.off.action': 'Tắt',
  'files.calendar.off.confirmTitle': 'Tắt liên kết lịch này?',
  'files.calendar.off.confirmBody':
    'Liên kết sẽ ngừng hoạt động ngay. Lịch giữ các sự kiện đã có nhưng không cập nhật nữa.',
  'files.calendar.off.confirm': 'Tắt',
  'files.calendar.off.busy': 'Đang tắt…',
  'files.calendar.closeGuard.title': 'Đóng mà không sao chép liên kết?',
  'files.calendar.closeGuard.body':
    'Chúng tôi không thể hiển thị lại. Bạn sẽ phải tạo liên kết mới.',
  'files.calendar.closeGuard.confirm': 'Vẫn đóng',
  'files.calendar.closeGuard.cancel': 'Giữ mở',
  'files.calendar.error.enable':
    'Không thể xác nhận liên kết đã được tạo. Trạng thái hiện tại ở bên dưới. Nếu đang bật nhưng bạn chưa thấy liên kết, hãy tắt rồi tạo lại.',
  'files.calendar.error.off':
    'Không thể xác nhận liên kết đã được tắt. Trạng thái hiện tại ở bên dưới; hãy thử lại nếu cần.',
  'files.calendar.error.load':
    'Không thể kiểm tra liên kết lịch của chuyến đi này. Hãy thử lại.',
  'files.calendar.retry': 'Thử lại',
  'files.calendar.off.confirmBodyUnused':
    'Liên kết này chưa được sử dụng. Nó sẽ ngừng hoạt động ngay.',
  'files.calendar.link.fallback':
    'Nếu không thêm được trên điện thoại, hãy mở trang này trên máy tính.',
  'files.calendar.link.newTab': 'mở trong thẻ mới',
  'files.calendar.title': 'Lịch',
  'files.calendar.description':
    'Đưa chuyến đi này vào ứng dụng lịch bạn đang dùng.',
  'files.calendar.download.action': 'Tải tệp lịch (.ics)',
  'files.calendar.download.hint':
    'Ảnh chụp nhanh chuyến đi ở thời điểm hiện tại. Tệp không tự cập nhật.',
  'files.calendar.undated':
    'Chuyến đi này chưa có ngày, nên chỉ các đặt chỗ và hành trình có ngày mới xuất hiện.',
  'files.calendar.download.error':
    'Chúng tôi không thể chuẩn bị tệp. Hãy thử lại.',
  'files.calendar.timesNote':
    'Các hành trình có múi giờ hiển thị cùng một thời điểm ở mọi nơi. Mọi thứ khác hiển thị đúng giờ đã lên kế hoạch, dù lịch của bạn ở đâu.',
  'files.drop.active': 'Thả ra để tải lên',
  'files.drop.pasteHint': 'dán hình ảnh đã sao chép hoặc ảnh chụp màn hình',
  'files.reject.blockedType':
    '“{name}” chưa được thêm: tệp XML và tệp SVG nén không được lưu ở đây vì lý do an toàn. Hãy lưu nó thành PDF hoặc hình ảnh rồi thêm tệp đó thay thế.',
  'files.drop.idle': 'Kéo tệp vào đây',
  'files.empty.title': 'Chuyến này chưa có tệp nào',
  'files.empty.body':
    'Mọi thứ mà bình thường bạn phải lục hộp thư ở quầy làm thủ tục đều nằm ở đây, gắn với chuyến đi của nó.',
  'files.empty.hint':
    'Thẻ lên máy bay, xác nhận khách sạn, vé, giấy tờ bảo hiểm và các biên lai chứng minh chi tiêu.',
  'files.heading': 'Tệp đính kèm',
  'files.tableCaption': 'Tệp gắn với chuyến này',
  'files.menu.download': 'Tải xuống',
  'files.menu.rename': 'Đổi tên và mô tả…',
  'files.menu.remove': 'Xóa tệp',
  'files.remove.body':
    'Tệp bị xóa khỏi kho lưu trữ lẫn khỏi chuyến đi, giải phóng {size}. Không hoàn tác được.',
  'files.queue.clear': 'Dọn phần đã xong',
  'files.column.file': 'Tệp',
  'files.column.size': 'Kích cỡ',
  'files.column.addedBy': 'Người thêm',
  'files.column.when': 'Lúc nào',
  'files.status.uploaded': 'Đã tải lên',
  'files.status.failed': 'Thất bại',
  'files.status.cancelled': 'Đã hủy',
  'files.status.uploading': 'Đang tải lên',
  'files.status.waiting': 'Đang chờ',
  'files.error.nameEmpty': 'Tệp cần một cái tên để bạn tìm lại.',
  'files.field.kindHint':
    'Quyết định nó nằm dưới bộ lọc nào và mang biểu tượng gì.',
  'files.field.kindAria': 'Loại tệp',
  'files.field.description': 'Mô tả',
  'files.field.descriptionPlaceholder':
    'Đơn bảo hiểm — bao cả đoàn, đường dây bồi thường ở trang 2.',
  'files.dialog.title': 'Chi tiết tệp',
  'files.action.saving': 'Đang lưu tệp',
  'files.action.save': 'Lưu chi tiết',
  'files.queue.someFailed': {
    other:
      '{count} tệp chưa tải lên được. Lý do nằm ở từng dòng — phần còn lại của lô không bị ảnh hưởng.',
  },

  'files.action.cancelUploadOf': 'Hủy tải lên {name}',
  'files.action.dismissOf': 'Bỏ qua {name}',
  'files.status.downloadingOf': 'Đang tải xuống {name}',
  'files.status.uploadingOf': 'Đang tải lên {name}',
  'files.status.uploadingCount': {
    other: 'Đang tải lên {count} tệp',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - tạo lúc {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': '{title} đã sẵn sàng',
  'files.export.email.body': {
    other:
      'Bản xuất chuyến đi đã sẵn sàng. Bản này được lưu trong {count} ngày.',
  },
  'files.export.email.action': 'Mở {title}',
  'files.export.email.text': 'Bản xuất chuyến đi đã sẵn sàng: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Xuất chuyến đi',
  'files.export.description':
    'Bản sao có thể in của chuyến đi: các ngày, điểm dừng, đặt chỗ, di chuyển và nơi ở. Đưa cho người không có tài khoản.',
  'files.export.kept': {
    other: 'Mỗi bản xuất được lưu trong {count} ngày.',
  },
  'files.export.empty.title': 'Chưa có bản xuất nào',
  'files.export.empty.body':
    'Tạo bản sao có thể in của chuyến đi để gửi cho người không có tài khoản.',
  'files.export.empty.bodyViewer':
    'Chủ sở hữu hoặc người chỉnh sửa chuyến đi có thể tạo.',
  'files.export.format.pdf': 'Tệp PDF',
  'files.export.format.html': 'Trang để in',
  'files.export.artifact': 'Bản xuất chuyến đi, {date}',
  'files.export.download': 'Tải xuống',
  'files.export.downloadLabelPdf': 'Tải xuống tệp PDF tạo lúc {date}',
  'files.export.downloadLabelHtml': 'Tải xuống trang để in tạo lúc {date}',
  'files.export.error.list': 'Danh sách bản xuất chưa tải được.',
  'files.export.retry': 'Thử lại',
  'files.export.error.missing':
    'Bản xuất đó không còn được lưu. Hãy xuất lại chuyến đi.',
  'files.export.error.missingViewer': 'Bản xuất đó không còn được lưu.',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Đã hủy tải lên.',
  'files.error.badAnswer':
    'Máy chủ trả về câu trả lời mà trình duyệt này không đọc được.',
  'files.error.connection':
    'Kết nối rớt giữa chừng khi tải lên. Kiểm tra mạng rồi thử lại.',
  'files.error.timeout': 'Tải lên hết giờ. Thử lại nhé.',
  'files.error.refused': 'Máy chủ từ chối lần tải lên này ({status}).',
  'files.error.downloadShape':
    'Bản tải xuống trở về ở dạng chúng tôi không lưu được.',
  'files.error.downloadFailed': 'Tải xuống thất bại ({status}).',
  'files.toast.uploadedOne': 'Đã tải tệp lên',
  'files.toast.uploadedManyBody': 'Đã thêm {size} vào chuyến này.',
  'files.toast.failedOne': 'Tệp đó chưa tải lên được',
  'files.toast.failedManyBody': 'Hàng đợi bên dưới nói lý do cho từng cái.',
  'files.error.tooMany': {
    other:
      'Mỗi lần chỉ thêm được {count} tệp, nên “{name}” bị bỏ lại. Thả riêng nó vào lần nữa.',
  },
  'files.toast.uploadedMany': {
    other: 'Đã tải lên {count} tệp',
  },
  'files.toast.failedMany': {
    other: '{count} tệp chưa tải lên được',
  },

  'files.export.request': 'Xuất chuyến đi',
  'files.export.includeReferences': 'Bao gồm mã xác nhận',
  'files.export.includeReferencesHint':
    'Không chọn nếu bạn gửi tệp cho người ngoài không gian làm việc.',
  'files.export.pending':
    'Đang chuẩn bị bản xuất. Bạn có thể rời trang; tệp sẽ hiện trong danh sách khi sẵn sàng.',
  'files.export.slow':
    'Quá trình lâu hơn bình thường. Tệp sẽ hiện ở đây khi sẵn sàng. Nếu không thấy, hãy xuất lại.',
  'files.export.refresh': 'Làm mới',
  'files.export.ready': 'Bản xuất đã sẵn sàng',
  'files.export.quota': {
    other:
      'Đã dùng hết hạn mức {count} lần xuất mỗi tháng của không gian này. Bộ đếm bắt đầu lại vào {date}.',
  },
  'files.export.error.request': 'Chưa bắt đầu xuất',
  'files.export.error.requestBody':
    'Lần thử này không bị tính. Hãy thử lại sau ít phút.',
  'files.export.doc.overview': 'Tổng quan',
  'files.export.doc.timezone': 'Múi giờ',
  'files.export.doc.days': 'Ngày',
  'files.export.doc.day': { other: 'Ngày {count} - {date}' },
  'files.export.doc.dayUndated': { other: 'Ngày {count}' },
  'files.export.doc.dayEmpty': 'Chưa có kế hoạch.',
  'files.export.doc.reservations': 'Đặt chỗ',
  'files.export.doc.transport': 'Di chuyển',
  'files.export.doc.reference': 'Mã xác nhận {code}',
  'files.export.doc.route': '{from} đến {to}',
  'files.export.doc.stays': 'Nơi chúng ta ở',
  'files.export.doc.nights': { other: 'Số đêm: {count}' },
  'files.export.doc.truncatedDays': {
    other:
      'Không thể chứa tất cả các ngày trong một tài liệu. Hiển thị {count} ngày đầu.',
  },
  'files.export.doc.truncatedRows': {
    other: 'Hiển thị {count} mục đầu trong tổng số {total}.',
  },
  'files.export.notify': 'Gửi email khi đã sẵn sàng',
  'files.export.viewer':
    'Chỉ chủ sở hữu và người chỉnh sửa có thể tạo bản xuất. Bạn có thể tải các bản hiện có.',
  'files.export.jump': 'Đến các bản xuất',
  'files.export.fromLink': 'Từ liên kết của bạn',
  'files.export.linkGone':
    'Bản xuất này không còn được lưu. Hãy tạo bản mới bên dưới.',
  'files.export.allowance': {
    other: 'Đã dùng {used} trong {count} bản xuất tháng này',
  },
  'files.export.allowanceUnlimited': {
    other: '{count} bản xuất trong tháng này',
  },
  'files.export.linkGoneViewer': 'Bản xuất đó không còn được lưu.',
} satisfies TranslationOf<typeof En>

export default messages
