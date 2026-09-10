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
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Không tải được chuyến đi này',
  'error.plan': 'Không tải được lịch trình',
  'error.costs': 'Không tải được chi phí',
  'error.collab': 'Không tải được cuộc trò chuyện',
  'error.book': 'Không tải được các chỗ đã đặt',
  'error.transports': 'Không tải được các lượt di chuyển',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Lịch trình',
  'plan.places': 'Địa điểm',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Thêm ghi chú',
  'plan.note.addForDay': 'Thêm ghi chú, {day}',
  'plan.note.showMore': 'Xem thêm',
  'plan.note.showLess': 'Thu gọn',
  'plan.note.moveUp': 'Di chuyển lên',
  'plan.note.moveDown': 'Di chuyển xuống',
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
  'plan.note.error.move': 'Thay đổi thứ tự chưa được lưu',
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
} satisfies TranslationOf<typeof En>

export default messages
