/**
 * Everything the application shell says, in Vietnamese.
 *
 * Authored from `../en/shell`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Vietnamese does not inflect for number, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. `count` still selects that branch and is never printed; the
 * figure a reader sees arrives already grouped for the locale under its own
 * placeholder.
 *
 * **Register.** The chrome speaks to one traveller as `bạn` — the register a
 * friend planning a holiday uses, not the `quý khách` of an airline notice —
 * and drops the pronoun entirely on buttons, where Vietnamese wants a bare verb
 * (`Mở`, `Chia sẻ`) rather than a sentence.
 *
 * **Classifiers, not plurals.** Where English pluralises a noun, Vietnamese
 * either leaves it bare or reaches for the classifier the thing belongs to —
 * `tin` for a message, `lời mời` for an invitation, `chuyến` for a journey. The
 * counter is chosen per message for that reason; there is no one word that
 * follows every number.
 *
 * **Diacritics.** Nearly every line below stacks a tone mark over a vowel that
 * already carries one — `ế`, `ộ`, `ữ`, `ợ`. Geist and MuseoModerno both ship a
 * Vietnamese subset, so those marks must sit where the face draws them; a
 * fallback face without the subset shows it immediately, which makes this
 * locale the one worth looking at when a font change lands.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  'nav.primary': 'Các mục chính',
  'nav.mobile': 'Các mục',
  'nav.dashboardLink': 'Bảng điều khiển planned.travel',
  'nav.homeLink': 'Trang chủ planned.travel',
  'nav.newTrip': 'Chuyến đi mới',
  'nav.trips': 'Chuyến đi của tôi',
  'nav.trips.short': 'Chuyến đi',
  'nav.vacay': 'Kỳ nghỉ',
  'nav.vacay.short': 'Nghỉ',
  'nav.atlas': 'Bản đồ thế giới',
  'nav.atlas.short': 'Bản đồ',
  'nav.journey': 'Nhật ký',
  'nav.journey.short': 'Nhật ký',

  'trip.nav.label': 'Các mục của chuyến đi',
  'trip.nav.back': 'Chuyến đi',
  'trip.nav.share': 'Chia sẻ',
  'trip.nav.shareLabel': 'Chia sẻ chuyến đi này',
  'trip.tab.plan': 'Lịch trình',
  'trip.tab.transports': 'Di chuyển',
  'trip.tab.book': 'Đặt chỗ',
  'trip.tab.lists': 'Danh sách',
  'trip.tab.costs': 'Chi phí',
  'trip.tab.files': 'Tệp',
  'trip.tab.collab': 'Cùng nhau',

  'account.menu': 'Menu tài khoản',
  'account.settings': 'Cài đặt',
  'account.billing': 'Gói và thanh toán',
  'account.admin': 'Quản trị',
  'account.signOut': 'Đăng xuất',
  'account.signingOut': 'Đang đăng xuất…',
  'account.signOutFailed': 'Chưa đăng xuất được',
  'account.signOutFailedBody': 'Kiểm tra kết nối rồi thử lại.',

  'theme.label': 'Giao diện',
  'theme.light': 'Sáng',
  'theme.dark': 'Tối',
  'theme.system': 'Theo hệ thống',
  'theme.state.light': 'sáng',
  'theme.state.dark': 'tối',
  'theme.state.system': 'theo hệ thống',
  'theme.trigger': 'Giao diện: {state}. Đổi giao diện',

  'bell.none': 'Thông báo, không có mục chưa đọc',
  'bell.unread': { other: 'Thông báo, {unread} mục chưa đọc' },

  'inbox.eyebrow': 'Hộp thư',
  'inbox.title': 'Thông báo',
  'inbox.error': 'Hộp thư của bạn chưa tải được',
  'inbox.allRead': 'Bạn đã đọc hết',
  'inbox.unread': { other: '{unread} tin chưa đọc' },
  'inbox.markAll': 'Đánh dấu đã đọc hết',
  'inbox.markingAll': 'Đang đánh dấu đã đọc hết',
  'inbox.cleared': 'Hộp thư đã sạch',
  'inbox.markAllFailed': 'Chưa đánh dấu đã đọc hết được',
  'inbox.retryHint': 'Kiểm tra kết nối rồi thử lại.',
  'inbox.filter.all': 'Tất cả',
  'inbox.filter.unread': 'Chưa đọc',
  'inbox.waiting': { other: '{invitations} lời mời đang chờ' },
  'inbox.empty.title': 'Hộp thư của bạn trống',
  'inbox.empty.body':
    'Lời mời chuyến đi, thay đổi lịch trình, nhắc đặt chỗ và các khoản đã thanh toán đều về đây.',
  'inbox.empty.action': 'Về bảng điều khiển',
  'inbox.emptyUnread.title': 'Không còn gì chưa đọc',
  'inbox.emptyUnread.body':
    'Bạn đã đọc hết. Chuyển sang Tất cả để xem lại lịch sử.',
  'inbox.emptyUnread.action': 'Xem tất cả',
  'inbox.row.new': 'Mới',
  'inbox.row.accepted': 'Đã nhận',
  'inbox.row.declined': 'Đã từ chối',
  'inbox.row.open': 'Mở',
  'inbox.row.markRead': 'Đã đọc',
  'inbox.row.markingRead': 'Đang đánh dấu đã đọc',
  'inbox.row.markReadFailed': 'Chưa đánh dấu được mục đó',
  'inbox.preferences':
    'Chọn những gì được gửi tới hộp thư, email và điện thoại của bạn.',
  'inbox.preferencesAction': 'Cài đặt thông báo',

  'notification.trip.invited.title': 'Bạn được mời vào {tripTitle}',
  'notification.trip.invited.body': '{actorName} đã thêm bạn vào chuyến đi.',
  'notification.trip.updated.title': '{tripTitle} vừa được cập nhật',
  'notification.trip.updated.body': '{actorName} đã sửa lịch trình.',
  'notification.trip.member_added.title':
    '{memberName} đã tham gia {tripTitle}',
  'notification.trip.member_added.body':
    'Họ xem được lịch trình, các đặt chỗ và chi phí.',
  'notification.trip.member_removed.title': '{memberName} đã rời {tripTitle}',
  'notification.trip.member_removed.body':
    'Quyền vào chuyến đi của họ đã kết thúc.',
  'notification.trip.starting_soon.title': {
    other: '{tripTitle} khởi hành sau {days} ngày',
  },
  'notification.trip.starting_soon.body':
    'Đã đến lúc soát lại danh sách hành lý và các đặt chỗ.',
  'notification.reservation.reminder.title': '{title} sắp đến',
  'notification.reservation.reminder.body':
    'Xem lại giờ và mã xác nhận trong phần đặt chỗ.',
  'notification.reservation.confirmed.title': '{title} đã được xác nhận',
  'notification.reservation.confirmed.body':
    'Đặt chỗ này đã được đánh dấu xác nhận trong {tripTitle}.',
  'notification.expense.added.title': '{actorName} vừa ghi một khoản chi',
  'notification.expense.added.body': '{title} trong {tripTitle}.',
  'notification.expense.settled.title': '{actorName} đã thanh toán xong',
  'notification.expense.settled.body':
    'Khoản còn lại trong {tripTitle} đã được trả.',
  'notification.list.assigned.title': '{actorName} giao cho bạn một việc',
  'notification.list.assigned.body': '{title} trong {tripTitle}.',
  'notification.collab.message.title': '{actorName} vừa nhắn trong {tripTitle}',
  'notification.collab.message.body': '“{preview}”',
  'notification.collab.poll.title': 'Có một cuộc bình chọn trong {tripTitle}',
  'notification.collab.poll.body': '“{question}”',
  'notification.organization.invited.title':
    'Bạn được mời vào {organizationName}',
  'notification.organization.invited.body':
    'Nhận lời mời để vào không gian làm việc và mọi thứ được chia sẻ trong đó.',
  'notification.journey.published.title': '{title} đã được đăng',
  'notification.journey.published.body':
    'Ai có liên kết đều đọc được nhật ký này.',
  'notification.billing.plan_changed.title': 'Gói của bạn đã đổi',
  'notification.billing.plan_changed.body':
    '{organizationName} hiện dùng gói {plan}.',
  'notification.fallback.title':
    'Có thay đổi trong không gian làm việc của bạn',
  'notification.fallback.body': 'Mở chuyến đi để xem đó là gì.',

  'dashboard.error': 'Bảng điều khiển chưa tải được',
  'dashboard.blank.title': 'Chuyến đi kế tiếp bắt đầu từ đây',
  'dashboard.blank.body':
    'Tạo một chuyến đi, thả những nơi bạn muốn tới lên bản đồ, rồi planned.travel dựng lịch trình từng ngày quanh chúng.',
  'dashboard.blank.action': 'Lên kế hoạch',
  'dashboard.blank.secondary': 'Xem bản đồ của bạn',

  'dashboard.upNext': 'Sắp tới',
  'dashboard.openPlan': 'Mở lịch trình',
  'dashboard.hero.travellers': 'Người đi',
  'dashboard.hero.travellersHint': 'trong không gian này',
  'dashboard.hero.dates': 'Ngày đi',
  'dashboard.hero.datesUnset': 'Chưa đặt',
  'dashboard.hero.datesHint': { other: '{days} ngày' },
  'dashboard.hero.datesMissing': 'Thêm ngày để dựng lịch trình',
  'dashboard.hero.startsIn': 'Còn',
  'dashboard.hero.started': 'Đã khởi hành',
  'dashboard.hero.today': 'Hôm nay',
  'dashboard.hero.startUnknown': 'chưa có ngày khởi hành',
  'dashboard.hero.startToday': 'chúc bạn đi vui',
  'dashboard.hero.startPast': { other: 'ngày trước' },
  'dashboard.hero.startFuture': { other: 'ngày' },
  'dashboard.hero.places': 'Địa điểm',
  'dashboard.hero.placesNone': 'chưa ghim gì cả',
  'dashboard.hero.placesHint': 'trên bản đồ',

  'dashboard.stat.countries': 'Quốc gia đã tới',
  'dashboard.stat.countriesUnit': 'trên {total}',
  'dashboard.stat.countriesNone':
    'Đánh dấu một nước để mở bản đồ thế giới của bạn',
  'dashboard.stat.visits': { other: 'Đã ghi {visits} lần ghé' },
  'dashboard.stat.trips': 'Tổng số chuyến đi',
  'dashboard.stat.tripsCaption': '{planning} đang lên · {booked} đã đặt',
  'dashboard.stat.places': 'Địa điểm đã ghim',
  'dashboard.stat.placesNone': 'Chưa có gì trên bản đồ',
  'dashboard.stat.placesAcross': { other: 'trải khắp {trips} chuyến đi' },
  'dashboard.stat.bookings': 'Đặt chỗ đã xác nhận',
  'dashboard.stat.bookingsNone': 'Không có đặt chỗ nào sắp tới',
  'dashboard.stat.bookingsSoon': { other: '{bookings} đặt chỗ đang tới' },

  'dashboard.trips.label': 'Chuyến đi của bạn',
  'dashboard.trips.all': 'Tất cả chuyến đi',
  'dashboard.trips.empty.title': 'Chưa có chuyến đi nào',
  'dashboard.trips.empty.body':
    'Mọi thứ bạn lên kế hoạch sẽ hiện ở đây, mới nhất trước.',
  'dashboard.trips.empty.action': 'Tạo chuyến đi',

  'dashboard.bookings.label': 'Đặt chỗ sắp tới',
  'dashboard.bookings.empty.title': 'Chưa đặt gì cả',
  'dashboard.bookings.empty.body':
    'Chỗ ở, bàn ăn và vé đã xác nhận sẽ hiện ở đây khi ngày đến gần.',

  'dashboard.pipeline.label': 'Tiến độ chuyến đi',
  'dashboard.pipeline.empty':
    'Chưa có gì trong tiến độ. Chuyến đi đầu tiên sẽ được chia theo từng giai đoạn ở đây.',
  'dashboard.pipeline.favourites': { other: '{favourites} mục yêu thích' },
  'dashboard.pipeline.archived': { other: '{archived} chuyến đã lưu trữ' },

  'dashboard.storage.label': 'Dung lượng',
  'dashboard.storage.count': '{used} trên {limit}',
  'dashboard.storage.files': {
    other: '{files} tệp trong mọi chuyến đi, gồm cả ảnh và vé.',
  },
  'dashboard.storage.more': 'Cần thêm chỗ?',
  'dashboard.storage.plans': 'Xem các gói',

  'admin.error': 'Bảng quản trị chưa tải được',
  'admin.denied.title': 'Chỉ quản trị viên mới mở được mục này',
  'admin.denied.body':
    'Nhờ chủ sở hữu hoặc quản trị viên đổi vai trò của bạn nếu bạn thật sự cần.',
  'admin.denied.action': 'Về bảng điều khiển',
  'admin.eyebrow': 'Quản trị không gian',
  'admin.description': 'Gói {plan} · tạo ngày {date}',
  'admin.createdUnknown': 'gần đây',
  'admin.workspaceSettings': 'Cài đặt không gian',
  'admin.billing': 'Gói và thanh toán',

  'admin.invitations.title': { other: 'Còn {invitations} lời mời chưa dùng' },
  'admin.invitations.body':
    'Mỗi lời mời chưa dùng vẫn chiếm một chỗ mà gói của bạn đang trả tiền.',
  'admin.invitations.action': 'Xem lại lời mời',

  'admin.stat.members': 'Thành viên',
  'admin.stat.membersCaption': { other: '{invitations} lời mời đang chờ' },
  'admin.stat.storage': 'Dung lượng',
  'admin.stat.storageUnit': 'trên {limit}',
  'admin.stat.storageUnlimited': 'không giới hạn',
  'admin.stat.storageCaption': 'Tệp, ảnh và bản xuất',
  'admin.stat.audit': 'Mục nhật ký',
  'admin.stat.auditCaption': 'Hoạt động mới nhất hiện ở bên dưới',
  'admin.stat.plan': 'Gói',
  'admin.stat.planCaption': 'Hạn mức được áp ngay tại tầng dữ liệu',

  'admin.quotas.label': 'Hạn mức',
  'admin.quotas.count': { other: '{metrics} chỉ số' },
  'admin.quotas.unlimited': 'Không giới hạn',
  'admin.quotas.value': '{used} trên {limit}',

  'admin.members.label': 'Thành viên',
  'admin.members.table': 'Thành viên của không gian này',
  'admin.members.person': 'Người',
  'admin.members.role': 'Vai trò',
  'admin.members.joined': 'Tham gia',

  'admin.activity.label': 'Hoạt động gần đây',
  'admin.activity.empty.title': 'Chưa ghi nhận gì',
  'admin.activity.empty.body':
    'Mọi thay đổi đáng kể đều được ghi vào nhật ký ngay khi xảy ra.',
  'admin.activity.workspace': 'chính không gian làm việc',
  'admin.actions.label': 'Thao tác nhiều nhất',
  'admin.actions.count': { other: '{actions} thao tác' },

  'tripStatus.draft': 'Nháp',
  'tripStatus.planning': 'Đang lên',
  'tripStatus.booked': 'Đã đặt',
  'tripStatus.active': 'Đang diễn ra',
  'tripStatus.completed': 'Đã xong',
  'tripStatus.archived': 'Đã lưu trữ',

  'bookingStatus.none': 'Chưa đặt',
  'bookingStatus.pending': 'Chờ xác nhận',
  'bookingStatus.confirmed': 'Đã xác nhận',
  'bookingStatus.cancelled': 'Đã hủy',
  'bookingStatus.completed': 'Hoàn tất',

  'bookingType.accommodation': 'Chỗ ở',
  'bookingType.restaurant': 'Bàn ăn',
  'bookingType.activity': 'Hoạt động',
  'bookingType.tour': 'Tham quan',
  'bookingType.ticket': 'Vé',
  'bookingType.transport': 'Di chuyển',
  'bookingType.other': 'Đặt chỗ',

  'role.owner': 'Chủ sở hữu',
  'role.admin': 'Quản trị viên',
  'role.member': 'Thành viên',

  'metric.trips': 'Chuyến đi',
  'metric.places': 'Địa điểm',
  'metric.members': 'Thành viên',
  'metric.files': 'Tệp',
  'metric.storage_bytes': 'Dung lượng',
  'metric.collections': 'Bộ sưu tập',
  'metric.journeys': 'Nhật ký',

  'error.title': 'Phần này chưa tải được',
  'error.body':
    'Không mất gì cả. Hãy thử lại, và nếu vẫn vậy thì phần chi tiết bên dưới là thứ cần gửi cho chúng tôi.',
  'error.retry': 'Thử lại',
  'error.dashboard': 'Về bảng điều khiển',
  'error.unknown': 'Yêu cầu hỏng trước khi kịp hoàn tất.',
  'error.root': 'Có gì đó lệch đường',
  'error.session': 'Quyền vào không gian của bạn đã đổi',

  'notFound.eyebrow': 'Lỗi 404',
  'notFound.title': 'Trang này không có trên bản đồ',
  'notFound.body':
    'Liên kết có thể đã cũ, hoặc chuyến đi mà nó trỏ tới đã bị chuyển hay xóa.',
  'notFound.trips': 'Tất cả chuyến đi',
  'notFound.rootBody':
    'Chúng tôi đã tìm khắp dọc đường. Địa chỉ có thể gõ nhầm, hoặc trang đó đã đi nơi khác.',
  'notFound.home': 'Về trang chủ',
  'notFound.plans': 'Xem các gói cước',

  'session.noWorkspace':
    'Tài khoản của bạn chưa gắn với không gian làm việc nào. Hãy đăng xuất rồi đăng nhập lại để hoàn tất.',
  'session.membershipRemoved': 'Bạn đã bị gỡ khỏi không gian làm việc này.',
} satisfies TranslationOf<typeof En>

export default messages
