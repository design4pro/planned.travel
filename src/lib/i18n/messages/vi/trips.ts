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
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Lịch trình',
  'plan.places': 'Địa điểm',
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
} satisfies TranslationOf<typeof En>

export default messages
