/**
 * The design system's own copy — every word `src/components/ui` says on its own
 * behalf, in Vietnamese.
 *
 * Authored from `../en/ui`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Vietnamese does not inflect a noun for number — a classifier or a bare figure
 * carries it instead — so `Intl.PluralRules` reports the single category
 * `other` and every `one`/`other` pair English writes collapses to one branch.
 * The figure still arrives already grouped by the formatter; the branch only
 * chooses the wording, and here there is one wording.
 *
 * Three things this catalogue does that English does not have to:
 *
 * - **Dates are read largest-part-last but spelled with their units.** The
 *   frozen table in `src/lib/format-tables.ts` hands `{month}` over as
 *   `Tháng 9`, so a heading needs `năm` before the year to read as a date
 *   rather than as two numbers that happen to be adjacent.
 * - **The overflow markers keep English's sides, and that is the correct
 *   translation.** Vietnamese reads `+3` and `99+` exactly as English does: a
 *   leading plus means "three more faces we did not draw", a trailing plus
 *   means "ninety-nine or more". Swapping them inverts what the number says,
 *   so `avatar.more` stays `+{hidden}` and `badge.overflow` stays `{max}+`.
 *   They are byte-identical to English on purpose; neither carries a letter in
 *   any script, so the parity suite's `isUntranslatable` exemption covers them.
 * - **Diacritics are the whole point of the face.** Every value below stacks
 *   tone marks over vowels that already carry a diacritic — `ế`, `ộ`, `ữ` — so
 *   this locale is the one that proves the shipped Vietnamese subsets of Geist
 *   and MuseoModerno are actually being served.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  'action.clear': 'Xóa trắng',
  'action.clearFilters': 'Bỏ bộ lọc',
  'action.close': 'Đóng',
  'action.dismiss': 'Ẩn đi',
  'action.remove': 'Gỡ bỏ',
  'action.keep': 'Giữ lại',
  'action.undo': 'Hoàn tác',
  'status.loading': 'Đang tải',
  'status.working': 'Đang xử lý',
  'status.searching': 'Đang tìm',
  'status.removing': 'Đang xoá',
  'avatar.status.online': '{name} đang trực tuyến',
  'avatar.status.away': '{name} đang vắng mặt',
  'avatar.status.busy': '{name} đang bận',
  'avatar.status.offline': '{name} đang ngoại tuyến',
  'avatar.overflow': { other: '{others} người khác' },
  'avatar.more': '+{hidden}',
  'badge.overflow': '{max}+',
  'calendar.label.date': 'Chọn một ngày',
  'calendar.label.range': 'Chọn khoảng ngày',
  'calendar.previousMonth': 'Tháng trước',
  'calendar.nextMonth': 'Tháng sau',
  'calendar.monthYear': '{month} năm {year}',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'Đang xem {months}',
  'calendar.day': '{weekday}, ngày {day} {month} năm {year}',
  'select.placeholder': 'Chọn…',
  'select.unavailable': 'Không còn dùng được: {value}',
  'select.unavailableHint':
    'Lựa chọn đã lưu {value} không còn nữa. Hãy chọn mục khác.',
  'combobox.search': 'Tìm kiếm',
  'combobox.empty': 'Không có kết quả',
  'combobox.clear': 'Bỏ lựa chọn',
  'datePicker.placeholder': 'Chọn ngày',
  'datePicker.clear': 'Xóa ngày',
  'dateRange.placeholder': 'Chọn khoảng',
  'dateRange.clear': 'Xóa khoảng ngày',
  'dateRange.presets': 'Khoảng dựng sẵn',
  'dateRange.preset.week': '7 ngày tới',
  'dateRange.preset.fortnight': '2 tuần tới',
  'dateRange.preset.month': '30 ngày tới',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'từ {start} – …',
  'dateRange.nights': { other: '{nights} đêm' },
  'dateRange.nightsSelected': { other: 'Đã chọn {nights} đêm' },
  'pagination.label': 'Phân trang',
  'pagination.first': 'Trang đầu',
  'pagination.previous': 'Trang trước',
  'pagination.next': 'Trang sau',
  'pagination.last': 'Trang cuối',
  'pagination.page': 'Trang {page}',
  'pagination.current': 'Trang {page} trên {pageCount}',
  'pagination.summary': 'Đang xem {from}–{to} trong tổng số {total}',
} satisfies TranslationOf<typeof En>

export default messages
