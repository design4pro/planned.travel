/**
 * The world tracker and the map chrome, in Vietnamese.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** `Bản đồ thế giới` for the atlas module, `chuyến đi` for a
 * trip, `quốc gia` for a country and `danh sách mơ ước` for the bucket list —
 * the first three are the words `vi/shell.ts` already uses, and the reader is
 * addressed as `bạn`, matching the rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('vi')` reports `other` only — Vietnamese
 * nouns do not inflect for number after a numeral — so every plural message
 * below is a single `other` branch.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Vietnamese uses, and the parity suite exempts them
 * structurally.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Bản đồ thế giới. Chưa có quốc gia nào được đánh dấu là đã tới.',
  'screen.world.summary':
    'Bản đồ thế giới với {visited} trên {total} quốc gia được đánh dấu là đã tới.',
  'screen.error.title': 'Bản đồ thế giới chưa tải được',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Đang tải bản đồ',
  'map.controls.label': 'Điều khiển bản đồ',
  'map.controls.zoomIn': 'Phóng to',
  'map.controls.zoomOut': 'Thu nhỏ',
  'map.controls.north': 'Xoay về hướng bắc',
  'map.controls.locate': 'Tìm vị trí của tôi',
  'map.controls.locateFailed': 'Chúng tôi không lấy được vị trí của bạn.',
  'map.controls.locateFailedBody':
    'Kiểm tra xem trang này đã được phép truy cập vị trí chưa, rồi thử lại.',

  'map.attribution.label': 'Dữ liệu bản đồ từ',

  'map.basemap.title': 'Bản đồ nền không khả dụng',
  'map.basemap.body':
    'Chi tiết đường phố đang ngoại tuyến. Mọi địa điểm vẫn hiển thị đúng vị trí thật, nên khoảng cách và các cụm điểm vẫn chính xác.',
  'map.basemap.credit': 'Đường bờ biển từ',
  'map.basemap.retry': 'Thử lại',
  'map.basemap.retrying': 'Đang kiểm tra bản đồ nền',

  'map.engine.unsupported.title': 'Không thể vẽ bản đồ',
  'map.engine.unsupported.body':
    'Trình duyệt này không chạy được bản đồ tương tác: bản đồ cần WebGL2, và ở đây không có ngữ cảnh WebGL2 nào khả dụng. Không phần nào khác trên màn hình này phụ thuộc vào nó.',
  'map.engine.stalled.title': 'Bản đồ vẫn chưa được vẽ',
  'map.engine.stalled.body':
    'Không có gì xuất hiện trong khoảng thời gian dành cho bản đồ khởi động. Nó có thể sẽ tự phục hồi; không phần nào khác trên màn hình này phụ thuộc vào nó.',

  'map.coverage.partial.title': 'Chi tiết đường phố một phần',
  'map.coverage.partial.body': {
    other:
      'Dữ liệu bản đồ đã phát hành chưa phủ tới {outside} địa điểm của chuyến đi này. Chúng vẫn được vẽ đúng vị trí thật trên đường bờ biển của riêng chúng tôi.',
  },
  'map.coverage.none.title': 'Chưa có chi tiết đường phố ở đây',
  'map.coverage.none.body':
    'Đường phố cho vùng này chưa được phát hành. Đường bờ biển, các ghim và các tuyến đường giữa chúng đều là thật — chỉ thiếu nhà cửa và đường sá.',
  'map.coverage.dismiss': 'Ẩn ghi chú về độ phủ bản đồ',

  'map.legend.title': 'Chú giải',
  'map.legend.collapse': 'Thu gọn {title}',
  'map.legend.expand': 'Mở rộng {title}',
  'map.legend.dayPin': 'Ghim ngày mẫu',
  'map.legend.dayPinMeaning': 'Ngày trong lịch trình',
  'map.legend.clusterPin': 'Ghim nhóm mẫu',
  'map.legend.clusterPinMeaning': 'Các địa điểm được gộp nhóm',

  'map.filter.label': 'Lọc địa điểm theo danh mục',
  'map.filter.all': 'Tất cả',
  'map.filter.category': { other: '{name} · {places} địa điểm' },

  'map.pin.day': 'Ngày {day}',
  'map.pin.cluster': {
    other: '{places} địa điểm — phóng to để tách chúng ra',
  },

  'map.place.rating': 'Được đánh giá {rating} trên {max}',
  'map.place.clause.day': 'ngày {day}',
  'map.place.clause.rating': 'được đánh giá {rating} trên {max}',
  'map.place.clause.visited': 'đã tới',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Lần tới gần nhất',
  'legend.recent': { other: 'Trong vòng {years} năm qua' },
  'legend.middle': '{from}–{to} năm trước, hoặc chưa ghi ngày',
  'legend.distant': { other: 'Hơn {years} năm trước' },
  'legend.unvisited': 'Chưa tới',
  'legend.note':
    'Sắc độ chỉ cho biết đã bao lâu — thẻ Quốc gia ghi rõ từng ngày tháng.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Độ phủ thế giới',
  'panel.coverage.unit': 'trên {total}',
  'panel.coverage.caption': '{share} thế giới · {visits}',
  'panel.progress.label': 'Trên đường tới mọi quốc gia',
  'panel.progress.remaining': 'Còn {remaining}',
  'panel.toggle.hide': 'Ẩn chi tiết bản đồ thế giới',
  'panel.toggle.show': 'Hiện chi tiết bản đồ thế giới',
  'panel.tabs.label': 'Các mục của bản đồ thế giới',
  'panel.tab.country': 'Quốc gia',
  'panel.tab.stats': 'Thống kê',
  'panel.tab.bucket': 'Danh sách mơ ước',
  'panel.back': 'Tất cả quốc gia',
  'panel.list.label': 'Quốc gia đã tới',
  'panel.loading': 'Đang tải bản đồ của bạn',

  'panel.empty.blank.title': 'Bản đồ của bạn vẫn còn trống',
  'panel.empty.blank.body':
    'Đánh dấu một quốc gia là đã tới và nó sẽ được tô lên bản đồ ở đây — cùng lần tới đầu tiên và gần nhất, số lần bạn đã đến và những gì bạn viết về nó.',
  'panel.empty.pick.title': 'Chọn một quốc gia',
  'panel.empty.pick.body':
    'Chọn trên bản đồ, trong ô tìm kiếm hoặc từ danh sách, và hồ sơ đầy đủ của nó sẽ mở ra ở đây — lần tới đầu tiên, lần gần nhất, số lần và ghi chú của bạn.',

  'panel.stat.places': 'Địa điểm',
  'panel.stat.placesNone': 'Chưa ghim gì trong chuyến đi nào',
  'panel.stat.placesCaption': 'Điểm tham quan, chỗ ở và điểm dừng đã lưu',
  'panel.stat.regions': 'Vùng',
  'panel.stat.regionsNone': 'Chưa đánh dấu vùng nào',
  'panel.stat.regionsCaption': 'Bang, tỉnh, quận hạt',
  'panel.stat.visits': 'Lượt thăm',
  'panel.stat.visitsCaption': 'Mọi lần đặt chân được ghi lại',
  'panel.stat.trips': 'Chuyến đi',
  'panel.stat.tripsCaption': 'Chỉ tính các chuyến đã hoàn thành',
  'panel.stat.cities': 'Thành phố',
  'panel.stat.citiesCaption': 'Nơi bạn đã nghỉ đêm hoặc dừng chân',
  'panel.stat.days': 'Ngày xa nhà',
  'panel.stat.daysCaption': 'Tính trên mọi chuyến đi trong hồ sơ của bạn',
  'panel.continents.label': 'Quốc gia theo châu lục',

  'panel.bucket.empty.title': 'Danh sách còn trống',
  'panel.bucket.empty.body':
    'Một nơi bạn luôn muốn đặt chân tới. Thêm vào, rồi đánh dấu hoàn thành khi bạn đến nơi.',
  'panel.bucket.label': 'Danh sách mơ ước',
  'panel.bucket.progress': 'Xong {done} trên {total}',
  'panel.bucket.done': 'Đã xong',
  'panel.bucket.toGo': 'Còn lại',
  'panel.bucket.target': 'trước năm {year}',
  'panel.bucket.hidden': {
    other:
      'Còn {entries} mục khác trong danh sách của bạn chưa hiển thị ở đây.',
  },
  'panel.bucket.kind.country': 'Quốc gia',
  'panel.bucket.kind.region': 'Vùng',
  'panel.bucket.kind.place': 'Địa điểm',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Châu Phi',
  'continent.antarctica': 'Châu Nam Cực',
  'continent.asia': 'Châu Á',
  'continent.europe': 'Châu Âu',
  'continent.northAmerica': 'Bắc Mỹ',
  'continent.oceania': 'Châu Đại Dương',
  'continent.southAmerica': 'Nam Mỹ',
  'continent.unknown': 'Chưa ghi châu lục',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Đã tới',
  'record.firstVisit': 'Lần tới đầu tiên',
  'record.lastVisit': 'Lần tới gần nhất',
  'record.visitDates': 'Ngày các lần tới',
  'record.notRecorded': 'Chưa ghi lại',
  'record.datesUnrecorded': 'Chưa ghi ngày tháng',
  'record.visits': { other: '{visits} lần tới' },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Lần tới đầu tiên {from}',
  'record.spanTo': 'Lần tới gần nhất {to}',
  'record.visitsUnit': { other: 'lần tới' },
  'record.gap.days': { other: 'cách nhau {gap} ngày' },
  'record.gap.months': { other: 'cách nhau {gap} tháng' },
  'record.gap.years': { other: 'cách nhau {gap} năm' },
  'record.note.empty': 'Chưa có ghi chú',
  'record.noOutline':
    'Đường nét thế giới mà bản đồ này vẽ được cắt ở tỷ lệ 1:110m, khiến lãnh thổ này bị gộp vào quốc gia mẹ — nên trên bản đồ không có gì để đóng khung. Lần tới vẫn được tính.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Sắp xếp quốc gia',
  'list.sort.code': 'Mã quốc gia',
  'list.sort.codeStatement': 'Sắp xếp theo mã quốc gia, từ A đến Z.',
  'list.sort.name': 'Tên quốc gia',
  'list.sort.nameStatement':
    'Sắp xếp theo tên quốc gia, từ A đến Z, rồi theo mã quốc gia.',
  'list.sort.recent': 'Lần tới mới nhất',
  'list.sort.recentStatement':
    'Sắp xếp theo lần tới mới nhất trước, rồi theo mã quốc gia.',
  'list.sort.visits': 'Nhiều lần tới nhất',
  'list.sort.visitsStatement':
    'Sắp xếp theo số lần tới nhiều nhất trước, rồi theo mã quốc gia.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Bị đường nét thế giới gộp vào quốc gia mẹ, nên trên bản đồ không có gì để đóng khung.',
  'list.announce.selected': 'Đã chọn {name}.',
  'list.announce.selectedUnframed': 'Đã chọn {name}. {reason}',
  'list.empty.title': 'Chưa có quốc gia nào trên bản đồ',
  'list.empty.body':
    'Một quốc gia sẽ xuất hiện ở đây ngay khi có lần tới được ghi lại — cùng lần đặt chân đầu tiên, lần gần nhất và số lần bạn đã đến.',
  'list.loading': 'Đang tải các quốc gia đã tới',
  'list.error.title': 'Danh sách quốc gia của bạn chưa tải được',
  'list.error.body':
    'Bản đồ thế giới hiện chưa đọc được các quốc gia bạn đã tới. Không có gì bị mất — tất cả vẫn được ghi lại.',
  'list.error.retry': 'Thử lại',
  'list.error.retrying': 'Đang tải quốc gia của bạn',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Tìm một quốc gia',
  'search.loading': 'Đang tải quốc gia của bạn',
  'search.placeholder': 'Tên hoặc mã quốc gia',
  'search.entry.notVisited': 'Chưa tới',
  'search.entry.noOutline': 'không có đường nét trên bản đồ',
  'search.entry.separator': ' · ',
  'search.cleared': 'Đã bỏ chọn.',
  'search.unframed':
    '{name} không có đường nét ở tỷ lệ thế giới, nên bản đồ không có gì để đóng khung.',
  'search.unframedVisited':
    '{name} không có đường nét ở tỷ lệ thế giới, nên bản đồ không có gì để đóng khung. Hồ sơ của nó không bị ảnh hưởng.',
  'search.results.empty':
    'Hồ sơ của bạn chưa có quốc gia nào. Gõ để tìm mọi quốc gia trên thế giới.',
  'search.results.emptyPinned':
    'Đã chọn {name}. Hồ sơ của bạn chưa có quốc gia nào — gõ để tìm mọi quốc gia trên thế giới.',
  'search.results.record': {
    other: '{countries} quốc gia trong hồ sơ của bạn.',
  },
  'search.results.capped': 'Đang hiển thị {shown} mục đầu tiên.',
  'search.results.pinned': 'Đã chọn {name}, xếp ở đầu danh sách.',
  'search.results.none': 'Không có quốc gia nào khớp với {term}.',
  'search.results.matches': {
    other: '{countries} quốc gia khớp với {term}.',
  },
  'search.announce.selected': 'Đã chọn {name}.',
  'search.announce.framing': 'Đã chọn {name}. Bản đồ đang đóng khung nó.',
  'search.announce.unframed': 'Đã chọn {name}. {reason}',
  'search.empty.title': 'Hồ sơ của bạn chưa có gì',
  'search.empty.body':
    'Gõ tên quốc gia, hoặc mã hai chữ cái của nó, để tìm trên bản đồ.',
  'search.empty.noMatchTitle': 'Không có quốc gia nào khớp với “{term}”',
  'search.empty.noMatchBody':
    'Kiểm tra chính tả, hoặc thử mã hai chữ cái — PT sẽ tìm ra Bồ Đào Nha. Cả {countries} quốc gia đều tìm được, dù bạn đã tới hay chưa.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Hồ sơ của bạn',
  'actions.visit.absent.title': 'Chưa tới',
  'actions.visit.absent.caption': 'Một lần tới không gắn với chuyến đi nào.',
  'actions.visit.title': 'Đã tới',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Chưa có trong danh sách',
  'actions.goal.absent.caption': 'Một nơi bạn định sẽ đến.',
  'actions.goal.title': 'Trong danh sách mơ ước',
  'actions.goal.waiting': 'Đang chờ đến lượt.',
  'actions.goal.target': 'Nhắm tới năm {year}.',
  'actions.goal.achieved.title': 'Đã gạch khỏi danh sách',
  'actions.goal.achieved.caption':
    'Bạn đã đến nơi. Mục này được giữ lại làm kỷ niệm.',

  'actions.button.remove': 'Xóa',
  'actions.button.mark': 'Đánh dấu đã tới',
  'actions.button.add': 'Thêm vào danh sách',
  'actions.visit.remove.name': 'Xóa {name} khỏi bản đồ của bạn',
  'actions.visit.remove.busy': 'Đang xóa {name} khỏi bản đồ của bạn',
  'actions.visit.add.name': 'Đánh dấu đã tới, {name}',
  'actions.visit.add.busy': 'Đang đánh dấu {name} là đã tới',
  'actions.goal.remove.name': 'Xóa {name} khỏi danh sách mơ ước của bạn',
  'actions.goal.remove.busy': 'Đang xóa {name} khỏi danh sách mơ ước của bạn',
  'actions.goal.add.name': 'Thêm vào danh sách, {name}',
  'actions.goal.add.busy': 'Đang thêm {name} vào danh sách mơ ước của bạn',

  'actions.hint':
    'Cả hai đều có hiệu lực ngay, và cả hai đều có thể hoàn tác tại đây.',
  'actions.offline':
    'Thiết bị của bạn không kết nối được với máy chủ. Kiểm tra kết nối rồi thử lại.',
  'actions.toast.marked': 'Đã đánh dấu là đã tới',
  'actions.toast.markedBody': '{name} đã có trên bản đồ của bạn.',
  'actions.toast.markFailed': 'Chưa đánh dấu được {name}',
  'actions.toast.unmarked': 'Đã xóa khỏi bản đồ của bạn',
  'actions.toast.unmarkedBody': '{name} không còn được đánh dấu là đã tới.',
  'actions.toast.unmarkFailed': 'Chưa xóa được {name}',
  'actions.toast.listed': 'Đã thêm vào danh sách mơ ước của bạn',
  'actions.toast.listedBody': '{name} là nơi bạn định sẽ đến.',
  'actions.toast.listFailed': 'Chưa thêm được {name}',
  'actions.toast.unlisted': 'Đã xóa khỏi danh sách mơ ước của bạn',
  'actions.toast.unlistedBody': '{name} không còn trong danh sách.',
  'actions.toast.unlistFailed': 'Chưa xóa được {name}',
  'actions.toast.fallback':
    'Thay đổi chưa tới được máy chủ. Hãy thử lại sau giây lát.',

  'actions.confirm.visit.title': 'Xóa {name} khỏi bản đồ của bạn?',
  'actions.confirm.visit.body': {
    other:
      '{visits} lần tới đã ghi{dates} sẽ bị xóa{note}. Các chuyến đi và địa điểm đã lưu của bạn không bị đụng tới.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ' cùng ghi chú bạn đã viết kèm',
  'actions.confirm.goal.title': 'Xóa {name} khỏi danh sách mơ ước của bạn?',
  'actions.confirm.goal.body':
    'Mục này đã được gạch xong, nên xóa nó cũng xóa luôn dấu mốc rằng bạn đã đến nơi. Bản đồ và các chuyến đi của bạn không bị đụng tới.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { other: 'Chuyến đi' },
  'card.visits': { other: 'Lần tới' },
  'card.places': { other: 'Địa điểm' },
  'card.firstTrip': 'Chuyến đi đầu tiên',
  'card.lastTrip': 'Chuyến đi gần nhất',
  'card.firstVisit': 'Lần tới đầu tiên',
  'card.lastVisit': 'Lần tới gần nhất',
  'card.absent': 'Chưa ghi lại',
  'card.loading': 'Đang tải quốc gia này',
  'card.loadingNamed': 'Đang tải {name}',
  'card.error.body': 'Các số liệu này chưa tải được. Không có gì bị mất.',
  'card.error.retry': 'Thử lại',
  'overlay.close': 'Đóng {name}',
} satisfies TranslationOf<typeof En>

export default messages
