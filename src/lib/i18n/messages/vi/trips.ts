/**
 * The trip tabs' own copy, in vi.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Số nhiều.** Tiếng Việt chỉ có nhánh `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Thêm địa điểm vào chuyến đi này',
  'plan.editor.editTitle': 'Sửa địa điểm này',
  'plan.editor.createDescription':
    'Đặt tên ngay và vị trí sau - địa điểm chưa lên kế hoạch sẽ chờ trong bảng địa điểm đến khi bạn thêm vào một ngày.',
  'plan.editor.editDescription':
    'Thay đổi áp dụng ở mọi nơi: bản đồ, mọi ngày đã gán và danh sách địa điểm của chuyến đi.',
  'plan.editor.nameRequired': 'Địa điểm cần có tên',
  'plan.editor.nameExample': 'ví dụ: Fushimi Inari Taisha',
  'plan.editor.city': 'Thành phố',
  'plan.editor.cityExample': 'ví dụ: Kyoto',
  'plan.editor.addressExample': 'ví dụ: 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Thời gian lưu lại',
  'plan.editor.rating': 'Có đáng đến không?',
  'plan.editor.latitude': 'Vĩ độ',
  'plan.editor.longitude': 'Kinh độ',
  'plan.editor.positionHint': 'Hoặc đóng và chọn điểm trên bản đồ.',
  'plan.editor.latitudeError': 'Từ -90 đến 90',
  'plan.editor.longitudeError': 'Từ -180 đến 180',
  'plan.editor.positionError': 'Vị trí cần cả hai số',
  'plan.editor.day': 'Thêm vào một ngày',
  'plan.editor.dayHint': 'Để trống để giữ trong bảng địa điểm.',
  'plan.editor.unplanned': 'Để chưa lên kế hoạch',
  'plan.editor.dayNamed': 'Ngày {day} · {title}',
  'plan.editor.stopFallback': 'Điểm dừng này',
  'plan.editor.dayNumber': 'Ngày {day}',
  'plan.editor.visited': 'Đã ghé thăm',
  'plan.editor.visitedHint': 'Đánh dấu ghim bằng dấu tích.',
  'plan.editor.saving': 'Đang lưu địa điểm',
  'plan.editor.save': 'Lưu thay đổi',
  'plan.editor.noCategory': 'Không có danh mục',
  'plan.editor.arrive': 'Đến',
  'plan.editor.leave': 'Rời đi',
  'plan.editor.timeError': 'Giờ rời đi phải sau giờ đến',
  'plan.editor.booking': 'Đặt chỗ',
  'plan.editor.note': 'Ghi chú cho điểm dừng này',
  'plan.editor.noteExample': 'Đi sớm - sau 9 giờ sáng phải xếp hàng một tiếng.',
  'plan.editor.savingTimes': 'Đang lưu thời gian',
  'plan.editor.saveTimes': 'Lưu',
  'plan.editor.duration0': 'Không có thời lượng cố định',
  'plan.editor.duration30': '30 phút',
  'plan.editor.duration45': '45 phút',
  'plan.editor.duration60': '1 giờ',
  'plan.editor.duration90': '1 giờ rưỡi',
  'plan.editor.duration120': '2 giờ',
  'plan.editor.duration180': '3 giờ',
  'plan.editor.duration240': 'Nửa ngày',
  'plan.editor.duration480': 'Cả ngày',
  'plan.editor.rating0': 'Chưa đánh giá',
  'plan.editor.rating1': '★ 1 - bỏ qua',
  'plan.editor.rating2': '★ 2 - nếu có thời gian',
  'plan.editor.rating3': '★ 3 - đáng đến',
  'plan.editor.rating4': '★ 4 - rất tốt',
  'plan.editor.rating5': '★ 5 - đừng bỏ lỡ',
  'plan.editor.bookingNone': 'Không cần đặt chỗ',
  'plan.editor.bookingPending': 'Chưa đặt chỗ',
  'plan.editor.bookingConfirmed': 'Đã đặt và xác nhận',
  'plan.editor.bookingCompleted': 'Đã tham quan xong',
  'plan.editor.bookingCancelled': 'Đã hủy',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Không tải được chuyến đi này',
  'error.plan': 'Không tải được lịch trình',
  'error.costs': 'Không tải được chi phí',
  'error.collab': 'Không tải được cuộc trò chuyện',
  'error.book': 'Không tải được các chỗ đã đặt',
  'error.transports': 'Không tải được các lượt di chuyển',
  'error.people': 'Không tải được danh sách người tham gia',
  'header.length': {
    other: '{days} ngày',
  },
  'header.planned': {
    other: 'Đã lên kế hoạch {days} ngày',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Lịch trình',
  'plan.places': 'Địa điểm',
  'plan.readOnly.archived':
    'Chuyến đi này đã được lưu trữ nên kế hoạch chỉ có thể xem.',
  'plan.readOnly.role':
    'Bạn có thể xem kế hoạch này. Chỉ chủ sở hữu chuyến đi và người chỉnh sửa mới có thể thay đổi.',
  'plan.day.empty': 'Chưa có gì — kéo một địa điểm hoặc ghi chú vào đây',
  'plan.move.refused.duplicate': '{name} đã có trong ngày đó',
  'plan.move.refused.duplicateBody':
    'Một địa điểm chỉ xuất hiện một lần mỗi ngày. Hãy chuyển nó sang ngày khác.',
  'plan.move.refused.notInIdeas': 'Ghi chú ở lại trong ngày',
  'plan.move.refused.notInIdeasBody':
    'Ý tưởng là những địa điểm đang chờ một ngày. Ghi chú thuộc về ngày mà nó được viết.',
  'plan.move.refused.notInAnotherDay': 'Ghi chú ở lại ngày của nó',
  'plan.move.refused.notInAnotherDayBody':
    'Ghi chú chưa thể chuyển sang ngày khác. Hãy sửa ghi chú, hoặc viết nó ở ngày kia.',
  'plan.move.refused.journeyNotInIdeas': 'Chuyến đi ở lại trong ngày',
  'plan.move.refused.journeyNotInIdeasBody':
    'Ý tưởng là những địa điểm đang chờ một ngày. Chuyến đi thuộc về ngày mà nó diễn ra.',
  'plan.move.refused.journeyNotInAnotherDay': 'Chuyến đi ở lại ngày của nó',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Ngày của chuyến đi đến từ ngày giờ của nó. Hãy đổi chúng ở thẻ Di chuyển.',
  'plan.move.refused.journeyTimed': '{name} khởi hành lúc {time}',
  'plan.move.refused.journeyTimedBody':
    'Giờ khởi hành thuộc về lịch chạy, không thuộc về kế hoạch. Hãy đặt chuyến đi đúng chỗ mà đồng hồ của nó chỉ.',
  'plan.move.spoken.duplicate': '{name} chưa được chuyển. Ngày đó đã có rồi.',
  'plan.move.spoken.notInIdeas':
    '{name} chưa được chuyển. Ghi chú ở lại trong ngày.',
  'plan.move.spoken.notInAnotherDay':
    '{name} chưa được chuyển. Ghi chú ở lại ngày của nó.',
  'plan.move.spoken.timed':
    '{name} có giờ {time}. Chúng tôi hỏi xem có bỏ giờ không.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} chưa được chuyển. Chuyến đi ở lại trong ngày.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} chưa được chuyển. Chuyến đi ở lại ngày của nó.',
  'plan.move.spoken.journeyTimed':
    '{name} chưa được chuyển. Khởi hành lúc {time}.',
  'plan.move.error.save': 'Thay đổi thứ tự chưa được lưu',
  'plan.move.error.retry': 'Hãy thử lại sau giây lát.',
  'plan.move.dropTime.title': 'Chuyển {name} và bỏ giờ {time}?',
  'plan.move.dropTime.body':
    'Vị trí này mâu thuẫn với giờ đã đặt. Chuyển đến đây sẽ xóa giờ — thứ tự mới và giờ đã xóa được lưu cùng nhau.',
  'plan.move.dropTime.confirm': 'Chuyển và bỏ giờ',
  'plan.move.dropTime.cancel': 'Giữ nguyên chỗ cũ',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Thêm ghi chú',
  'plan.note.addForDay': 'Thêm ghi chú, {day}',
  'plan.addPlace.label': 'Thêm địa điểm',
  'plan.addPlace.more': 'Các cách khác để thêm địa điểm',
  'plan.addPlace.option.map': 'Đặt lên bản đồ',
  'plan.addPlace.forDayNamed': 'Thêm địa điểm, {day}',
  'plan.addPlace.quota':
    'Bạn đã đạt giới hạn số địa điểm của gói hiện tại. Hãy nâng cấp để thêm nữa.',
  'plan.addPlace.quotaAction': 'Xem các gói',
  'plan.stay.checkIn': 'Nhận phòng',
  'plan.stay.checkOut': 'Trả phòng',
  'plan.day.addStay': 'Thêm chỗ ở, {day}',
  'plan.day.addStayShort': 'Thêm chỗ ở',
  'plan.handoff.stop': 'Mở {place} trong {service} (mở trong tab mới)',
  'plan.handoff.day.directions': 'Chỉ đường trong {service}',
  'plan.handoff.day.directionsName':
    'Chỉ đường trong {service}: {day} (mở trong tab mới)',
  'plan.handoff.day.directionsPartial':
    'Điểm dừng: {carried} đầu tiên trong {total}',
  'plan.handoff.day.directionsPartialName':
    'Chỉ đường trong {service}: {day}, điểm dừng: {carried} đầu tiên trong {total} (mở trong tab mới)',
  'plan.handoff.day.point': 'Xem trong {service}',
  'plan.handoff.day.pointName':
    'Xem trong {service}: điểm dừng duy nhất có vị trí của {day} (mở trong tab mới)',
  'plan.drop.hint':
    'Nhấp chuột phải vào bản đồ, hoặc nhấn giữ, để thêm một địa điểm ngay tại đó.',
  'plan.drop.armed':
    'Nhấp vào bản đồ ở nơi nó thuộc về, hoặc di chuyển bản đồ rồi nhấn Enter để thả nó ở giữa.',
  'plan.drop.stop': 'Dừng đặt ghim mới',
  'plan.drop.pin': 'Địa điểm mới',
  'plan.drop.lookingUp': 'Đang tìm địa chỉ…',
  'plan.drop.error': 'Không thể thả ghim. Hãy thử lại sau giây lát.',
  'plan.place.pastedPosition': 'Đã đọc là vĩ độ {lat}, kinh độ {lng}',
  'plan.note.showMore': 'Xem thêm',
  'plan.note.showLess': 'Thu gọn',
  'plan.note.moveUp': 'Di chuyển lên',
  'plan.note.moveDown': 'Di chuyển xuống',
  'plan.note.drag': 'Sắp xếp lại ghi chú',
  'plan.note.edit': 'Sửa ghi chú',
  'plan.note.delete': 'Xóa ghi chú',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Thêm ghi chú',
  'plan.note.dialog.editTitle': 'Sửa ghi chú',
  'plan.note.field.body': 'Ghi chú',
  'plan.note.field.bodyHint': 'Một dòng. Đây là phần hiển thị trong ngày.',
  'plan.note.field.detail': 'Chi tiết',
  'plan.note.field.detailHint':
    'Tiêu đề, danh sách, liên kết, trích dẫn, mã và bảng.',
  'plan.note.field.time': 'Giờ',
  'plan.note.field.timeHint': 'Không bắt buộc, theo định dạng 24 giờ.',
  'plan.note.field.icon': 'Biểu tượng',
  'plan.note.tab.write': 'Soạn',
  'plan.note.tab.preview': 'Xem trước',
  'plan.note.previewEmpty': 'Chưa có gì để xem trước',
  'plan.note.save': 'Lưu ghi chú',
  'plan.note.cancel': 'Hủy',
  'plan.note.confirmDelete': 'Xóa ghi chú này?',
  'plan.note.confirmDeleteBody':
    'Ghi chú và phần chi tiết sẽ biến mất khỏi ngày này.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Đã thêm ghi chú',
  'plan.note.toast.updated': 'Đã lưu ghi chú',
  'plan.note.toast.deleted': 'Đã xóa ghi chú',
  'plan.note.error.save': 'Ghi chú chưa được lưu',
  'plan.note.error.delete': 'Ghi chú chưa được xóa',
  'plan.note.error.retry': 'Hãy thử lại sau giây lát.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Nhắc nhở',
  'plan.note.icon.clock': 'Giờ',
  'plan.note.icon.flashlight': 'Đèn pin',
  'plan.note.icon.footprints': 'Đi bộ',
  'plan.note.icon.info': 'Thông tin',
  'plan.note.icon.luggage': 'Hành lý',
  'plan.note.icon.package': 'Bưu kiện',
  'plan.note.icon.ticket': 'Vé',
  'plan.note.icon.trainFront': 'Tàu hỏa',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Ghi chú',
  'plan.note.icon.utensils': 'Đồ ăn',
  'plan.note.icon.bus': 'Di chuyển',
  'plan.note.icon.bedDouble': 'Chỗ ở',
  'plan.note.icon.camera': 'Ảnh',
  'plan.note.icon.mapPin': 'Địa điểm',
  'plan.note.icon.wallet': 'Tiền',
  'plan.note.icon.umbrella': 'Mưa',
  'plan.note.icon.triangleAlert': 'Cảnh báo',
  'plan.transport.phase.flight.departing': 'Cất cánh',
  'plan.transport.phase.flight.travelling': 'Trên không',
  'plan.transport.phase.flight.arriving': 'Hạ cánh',
  'plan.transport.phase.hire.departing': 'Nhận xe',
  'plan.transport.phase.hire.travelling': 'Đang thuê',
  'plan.transport.phase.hire.arriving': 'Trả xe',
  'plan.transport.phase.journey.departing': 'Bắt đầu',
  'plan.transport.phase.journey.travelling': 'Đang đi',
  'plan.transport.phase.journey.arriving': 'Kết thúc',
  'plan.transport.label': 'Từ {from} đến {to}',
  'plan.transport.drag': 'Sắp xếp lại, {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Cùng nhau',
  'collab.empty': 'Chưa chia sẻ gì',
  'collab.conversation': 'Trò chuyện',
  'collab.count.messages': {
    other: '{messages} tin nhắn',
  },
  'collab.count.notes': {
    other: '{notes} ghi chú',
  },
  'collab.count.polls': {
    other: '{polls} bình chọn',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Chỗ đã đặt',
  'book.empty': 'Chưa đặt gì',
  'book.count.bookings': {
    other: '{bookings} lượt đặt',
  },
  'book.count.confirmed': {
    other: 'đã xác nhận {confirmed}',
  },
  'book.progressLabel': {
    other: 'đã xác nhận {confirmed} trong {total} lượt đặt',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': 'Đã xác nhận',
  'book.awaiting': 'Chờ xác nhận',
  'book.nothingHanging': 'Không có gì treo',
  'book.chase': 'Giục trước khi bay',
  'book.committed': 'Đã cam kết',
  'book.committedCaption': 'Trên toàn bộ chỗ đã đặt của chuyến này',
  'book.onItinerary': 'Trong lịch trình',
  'book.pinnedCaption': 'Đã ghim vào một ngày của lịch trình',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Di chuyển',
  'transports.empty': 'Chưa ghi gì',
  'transports.count.transports': {
    other: '{transports} lượt di chuyển',
  },
  'transports.distance': 'Quãng đường đã đi',
  'transports.equator': '≈ {times}× vòng quanh xích đạo',
  'transports.noGrouping': 'Chưa nhóm được gì',
  'transports.mostly': 'chủ yếu là {mode}',
  'transports.confirmed': 'Đã xác nhận',
  'transports.stillPending': {
    other: '{pending} vẫn đang chờ',
  },
  'transports.spent': 'Chi cho di chuyển',
  'transports.noPrices': 'Chưa ghi giá nào',
  'transports.priced': {
    other: 'trên {priced} lượt di chuyển có giá',
  },
  'people.title': 'Người tham gia',
  'people.description': 'Ai đang trong chuyến đi này và ai có thể tìm thấy nó',
  'people.members.title': 'Trong chuyến đi này',
  'people.members.empty':
    'Không còn ai của chuyến đi này ở trong không gian này',
  'people.role.label': 'Vai trò',
  'people.role.owner': 'Chủ sở hữu',
  'people.role.editor': 'Người chỉnh sửa',
  'people.role.viewer': 'Người xem',
  'people.you': 'Bạn',
  'people.owner.hint': 'Mỗi chuyến đi luôn giữ ít nhất một chủ sở hữu',
  'people.remove.action': 'Gỡ {name} khỏi chuyến đi này',
  'people.remove.title': 'Gỡ {name} khỏi chuyến đi này?',
  'people.remove.body':
    'Người đó mất quyền xem lịch trình ngay lập tức. Những gì họ đã thêm vẫn ở lại chuyến đi.',
  'people.remove.confirm': 'Gỡ',
  'people.leave.action': 'Rời chuyến đi này',
  'people.leave.title': 'Rời chuyến đi này?',
  'people.leave.body':
    'Bạn sẽ mất quyền xem lịch trình cho đến khi có người trong chuyến đi thêm bạn lại.',
  'people.leave.confirm': 'Rời',
  'people.cancel': 'Huỷ',
  'people.invite.title': 'Thêm người',
  'people.invite.placeholder': 'Tìm người trong không gian này',
  'people.invite.action': 'Thêm vào chuyến đi',
  'people.invite.role': 'Tham gia với vai trò',
  'people.invite.empty':
    'Mọi người trong không gian này đều đã ở trong chuyến đi',
  'people.invite.emptyHint':
    'Trước tiên hãy mời người mới vào không gian, trong Cài đặt',
  'people.visibility.title': 'Ai có thể tìm thấy chuyến đi này',
  'people.visibility.switch': 'Hiển thị với mọi người trong không gian',
  'people.visibility.private':
    'Chỉ những người có tên ở đây mới xem được chuyến đi này',
  'people.visibility.organization':
    'Bất kỳ ai trong không gian này đều mở được chuyến đi này',
  'people.visibility.public':
    'Chuyến đi này được chia sẻ bằng liên kết công khai',
  'people.error.lastOwner':
    'Mỗi chuyến đi giữ ít nhất một chủ sở hữu. Hãy đặt người khác làm chủ sở hữu trước.',
  'people.error.notInWorkspace': 'Người đó không có trong không gian này',
  'people.error.alreadyOnTrip': 'Người đó đã có trong chuyến đi này',
  'people.guests.title': 'Đi cùng bạn',
  'people.guests.description':
    'Những người trong chuyến đi này không có tài khoản',
  'people.guests.empty': 'Chưa có ai',
  'people.guests.emptyHint':
    'Khách là người đi cùng bạn mà không cần tài khoản. Hãy thêm họ bằng tên.',
  'people.guest.badge': 'Khách',
  'people.guest.add.label': 'Tên của họ',
  'people.guest.add.placeholder': 'Lan',
  'people.guest.add.action': 'Thêm khách',
  'people.guest.rename.action': 'Đổi tên {name}',
  'people.guest.rename.title': 'Đổi tên {name}',
  'people.guest.rename.confirm': 'Đổi tên',
  'people.guest.remove.action': 'Xoá {name} khỏi chuyến đi này',
  'people.guest.remove.title': 'Xoá {name} khỏi chuyến đi này?',
  'people.guest.remove.body':
    'Khách sẽ bị xoá. Không có gì khác trong chuyến đi thay đổi.',
  'people.guest.remove.confirm': 'Xoá',
  'people.guest.merge.action': '{name} giờ là…',
  'people.guest.merge.title':
    '{name} giờ là một trong những người của chuyến đi này',
  'people.guest.merge.body':
    'Mọi thứ đã giao cho {name} sẽ chuyển sang người bạn chọn, và khách sẽ bị xoá. Không thể hoàn tác.',
  'people.guest.merge.inherits': '{member} sẽ nhận mọi thứ đã gán cho {name}.',
  'people.guest.merge.placeholder': 'Chọn một người trong chuyến đi này',
  'people.guest.merge.confirm': 'Gộp',
  'people.guest.merge.done': '{name} giờ là {member}',
  'people.guest.merge.nothingMoved': 'Chưa có gì được giao cho họ',
  'people.error.guestNameTaken':
    'Đã có một khách tên {name} trong chuyến đi này',
  'people.error.guestLimit':
    'Một chuyến đi có tối đa {limit} khách, vì danh sách dài hơn khiến việc chọn người tham gia và đọc phần chia chi phí trở nên khó khăn',
  'people.error.guestMergeTarget': 'Chọn một người đã có trong chuyến đi này',
  'plan.weather.badge.forecast':
    'Dự báo: {condition}, cao nhất {max}, thấp nhất {min}',
  'plan.weather.badge.forecastNoCondition':
    'Dự báo: cao nhất {max}, thấp nhất {min}',
  'plan.weather.badge.unavailable': 'Không có thông tin thời tiết cho ngày này',
  'plan.weather.badge.loading': 'Đang tải thời tiết',
  'plan.weather.badge.recorded': 'Đã ghi nhận: cao nhất {max}, thấp nhất {min}',
  'plan.weather.badge.recordedHigh': 'Đã ghi nhận: cao nhất {max}',
  'plan.weather.badge.recordedLow': 'Đã ghi nhận: thấp nhất {min}',
  'plan.weather.badge.estimate':
    'Ước tính: cao nhất thường là {max}, thấp nhất thường là {min}',
  'plan.weather.badge.estimateHigh': 'Ước tính: cao nhất thường là {max}',
  'plan.weather.badge.estimateLow': 'Ước tính: thấp nhất thường là {min}',
  'plan.weather.badge.notYetRecorded': 'Chưa ghi nhận',
  'plan.weather.condition.clear': 'Trời quang',
  'plan.weather.condition.fair': 'Trời đẹp',
  'plan.weather.condition.partlyCloudy': 'Có mây rải rác',
  'plan.weather.condition.cloudy': 'Nhiều mây',
  'plan.weather.condition.fog': 'Sương mù',
  'plan.weather.condition.rain': 'Mưa',
  'plan.weather.condition.heavyRain': 'Mưa lớn',
  'plan.weather.condition.sleet': 'Mưa tuyết',
  'plan.weather.condition.snow': 'Tuyết',
  'plan.weather.condition.thunder': 'Dông',
  'plan.weather.panel.title': 'Thời tiết ngày {date}',
  'plan.weather.panel.temperature': 'Cao nhất / thấp nhất',
  'plan.weather.panel.precipitation': 'Lượng mưa',
  'plan.weather.panel.precipitationTypical': 'Lượng mưa thường gặp mỗi ngày',
  'plan.weather.panel.probability': 'Xác suất {percent}',
  'plan.weather.panel.wind': 'Gió',
  'plan.weather.panel.sunrise': 'Mặt trời mọc',
  'plan.weather.panel.sunset': 'Mặt trời lặn',
  'plan.weather.panel.noSunrise': 'Không có mặt trời mọc',
  'plan.weather.panel.noSunset': 'Không có mặt trời lặn',
  'plan.weather.panel.slots': 'Trong ngày',
  'plan.weather.panel.slot.night': 'Đêm',
  'plan.weather.panel.slot.morning': 'Sáng',
  'plan.weather.panel.slot.afternoon': 'Chiều',
  'plan.weather.panel.slot.evening': 'Tối',
  'plan.weather.panel.high': 'Cao nhất',
  'plan.weather.panel.low': 'Thấp nhất',
  'plan.weather.panel.recordedNote': 'Giá trị đo được của ngày này.',
  'plan.weather.panel.temperatureTypical': 'Cao nhất / thấp nhất thường gặp',
  'plan.weather.panel.estimateNote':
    'Mức trung bình dài hạn của tháng này, không phải dự báo.',
  'plan.weather.attribution.metNorway': 'Dữ liệu dự báo: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Dữ liệu: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Đổi chiều rộng lịch trình',
  'plan.workspace.resizePlaces': 'Đổi chiều rộng địa điểm',
  'plan.workspace.toggleDay': 'Mở rộng hoặc thu gọn {day}',
  'plan.workspace.days': 'Ngày',
  'plan.workspace.showPanel': 'Hiện bảng {label}',
  'plan.workspace.hidePanel': 'Ẩn bảng {label}',
  'plan.workspace.narrowPanel': 'Thu hẹp {label}',
  'plan.workspace.widenPanel': 'Mở rộng {label}',
} satisfies TranslationOf<typeof En>

export default messages
