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
 *
 * **Three keys are shorter than a literal translation, and measurement is
 * why.** Each sits in a `.truncate` box, and a faithful phrase clipped into an
 * ellipsis reads worse than a shorter true one:
 *
 * - `dashboard.hero.companionsHint` is `ở chuyến này`, not `trong chuyến đi
 *   này` — the tile is 107px, and the longer phrase clips. Both render "on
 *   this trip"; `ở` is the plainer preposition.
 * - `dashboard.trips.label` is `Chuyến đi`, not `Chuyến đi của bạn` — 126px in
 *   a 111px label. The list underneath is the reader's own, and the sibling
 *   key `dashboard.trips.all` already reads `Tất cả chuyến đi`.
 * - `bookingStatus.confirmed` is `Đã chốt`, not `Đã xác nhận`. The badge and
 *   the date share one row, so the badge's width comes straight off the date:
 *   `Đã xác nhận` measured 81px and left the date 145px to draw `Thứ 2, 12 thg
 *   10 · 19:00 – 21:00` in, which needs 169px. `Đã chốt` measures 56px and
 *   gives the date 170px. `chốt` is what a Vietnamese traveller says when a
 *   booking stops being provisional, so the shorter word is also the warmer
 *   one; `Chờ xác nhận` stays long because its row's date is short.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  'toaster.label': 'Thông báo',
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

  'account.menu': '{name}, menu tài khoản',
  'account.settings': 'Cài đặt',
  'account.billing': 'Gói và thanh toán',
  'account.admin': 'Quản trị',
  'account.signOut': 'Đăng xuất',
  'account.signingOut': 'Đang đăng xuất…',
  'account.signOutFailed': 'Chưa đăng xuất được',
  'account.signOutFailedBody': 'Kiểm tra kết nối rồi thử lại.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Không gian',
  'workspace.switched': 'Đã chuyển sang {name}',
  'workspace.switchFailed': 'Chưa chuyển được không gian',
  'workspace.switchFailedBody': 'Kiểm tra kết nối rồi thử lại.',
  'workspace.switchUnconfirmedBody':
    'Không thể xác nhận không gian làm việc đang hoạt động. Hãy tải lại trang trước khi tiếp tục.',
  'workspace.switchRateLimitedBody':
    'Bạn đã chuyển không gian làm việc quá nhiều lần. Hãy đợi một lát rồi thử lại.',
  'workspace.create': 'Tạo không gian',
  'workspace.createTitle': 'Tạo một không gian',
  'workspace.createDescription':
    'Một không gian riêng với chuyến đi, địa điểm và người của riêng nó. Bắt đầu ở gói Miễn phí và không dùng chung gói với không gian bạn đang ở.',
  'workspace.createPermanent':
    'planned.travel chưa có tùy chọn xóa một không gian. Mỗi không gian bạn tạo hoặc tham gia đều được tính vào giới hạn: khi bạn thuộc {limit} không gian, bạn không thể tạo thêm.',
  'workspace.createName': 'Tên không gian',
  'workspace.createNameRequired': 'Nhập tên cho không gian.',
  'workspace.createUpgrade':
    '“{workspace}” đang ở gói Miễn phí, và chỉ không gian ở gói trả phí mới tạo được không gian khác. Nếu một không gian khác của bạn đang ở gói trả phí, hãy chuyển sang đó và tạo từ đó. Nếu không, hãy nâng cấp “{workspace}”.',
  'workspace.createLimitReached':
    'Bạn đã thuộc số không gian tối đa mà giới hạn cho phép, nên không thể tạo thêm.',
  'workspace.createRoleRequired':
    'Chỉ quản trị viên của không gian mới tạo được không gian. Hãy nhờ một quản trị viên của không gian này, hoặc chuyển sang không gian bạn quản trị.',
  'workspace.createFailed': 'Chưa tạo được không gian',

  'theme.label': 'Giao diện',
  'theme.light': 'Sáng',
  'theme.dark': 'Tối',
  'theme.system': 'Theo hệ thống',
  'theme.state.light': 'sáng',
  'theme.state.dark': 'tối',
  'theme.state.system': 'theo hệ thống',
  'theme.trigger': 'Giao diện: {state}. Đổi giao diện',
  'language.trigger': 'Ngôn ngữ: {language}. Đổi ngôn ngữ',
  'language.hint':
    'Được ghi nhớ trên thiết bị này. Sau khi bạn đăng nhập, ngôn ngữ đặt trong tài khoản sẽ được áp dụng; bạn có thể đổi trong Cài đặt.',
  'language.announce': 'Đã đổi ngôn ngữ sang {language}',
  'language.notApplied':
    'Trình duyệt này không lưu lựa chọn của bạn. Hãy cho phép cookie cho trang này rồi chọn lại.',

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
  'notification.trip.copied.title': '{tripTitle} đã sẵn sàng',
  'notification.trip.copied.body': {
    other: 'Đã sao sang {days} ngày',
  },
  'notification.trip.copied.places': {
    other: '{places} địa điểm',
  },
  'notification.trip.copied.dropped': {
    other: 'bỏ {dropped} ghi chú',
  },
  'notification.trip.copyFailed.title': 'Không sao chép được {tripTitle}',
  'notification.trip.copyFailed.body':
    'Không mất gì cả. Hãy thử lại từ bản gốc.',
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
  'notification.billing.invoice_paid.title': 'Đã nhận thanh toán',
  'notification.billing.invoice_paid.body':
    'Hoá đơn gần nhất của {organizationName} đã được thanh toán.',
  'notification.billing.payment_failed.title':
    'Một khoản thanh toán không thành công',
  'notification.billing.payment_failed.body':
    '{organizationName} đang quá hạn thanh toán. Hãy cập nhật phương thức thanh toán để giữ gói.',
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
  'dashboard.hero.datesMissing': 'Thêm ngày để dựng lịch trình',
  'dashboard.hero.startsIn': 'Còn',
  'dashboard.hero.started': 'Đã khởi hành',
  'dashboard.hero.today': 'Hôm nay',
  'dashboard.hero.startUnknown': 'chưa có ngày khởi hành',
  'dashboard.hero.startToday': 'chúc bạn đi vui',
  'dashboard.hero.startPast': { other: 'ngày trước' },
  'dashboard.hero.startFuture': { other: 'ngày' },
  'dashboard.hero.nights': 'Số đêm',
  'dashboard.hero.companionsHint': 'ở chuyến này',
  'dashboard.hero.progress': 'Đang diễn ra',
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

  'dashboard.trips.label': 'Chuyến đi',
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
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Tham chiếu',
  'dashboard.widgets.choose': 'Chọn tiện ích',
  'dashboard.widgets.description':
    'Những tiện ích bạn giữ bên cạnh bảng điều khiển.',
  'dashboard.clock.label': 'Đồng hồ thế giới',
  'dashboard.clock.add': 'Thêm múi giờ',
  'dashboard.clock.search': 'Tìm thành phố và khu vực',
  'dashboard.clock.noMatches': 'Không có múi giờ nào tên như vậy',
  'dashboard.clock.remove': 'Xóa {zone}',
  'dashboard.clock.offset': '{offset} so với giờ của bạn',
  'dashboard.clock.here': 'Giờ của chính bạn',
  'dashboard.clock.empty.title': 'Chưa ghim múi giờ nào',
  'dashboard.clock.empty.body':
    'Ghim một nơi để đọc đồng hồ của nơi đó bên cạnh đồng hồ của bạn.',
  'dashboard.clock.unknown.title': 'Thiết bị này không biết {zone}',
  'dashboard.clock.unknown.body':
    'Không thể đọc giờ của nó ở đây. Xóa hàng để khắc phục.',

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
  'admin.members.role.label': 'Vai trò của {name}',
  'admin.members.role.saved': '{name} hiện là {role}.',
  'admin.members.role.impersonated':
    'Không thể đổi vai trò khi bạn đang thao tác với tư cách một tài khoản khác.',
  'admin.members.role.notPermitted':
    'Bạn không thể thực hiện thay đổi này. Chỉ chủ sở hữu mới có thể cấp vai trò chủ sở hữu hoặc thay đổi một chủ sở hữu.',
  'admin.members.role.lastOwner':
    'Đây là chủ sở hữu duy nhất của không gian làm việc. Hãy chỉ định người khác làm chủ sở hữu trước.',
  'admin.members.role.notFound':
    'Người này không còn trong không gian làm việc. Danh sách đã được làm mới.',
  'admin.members.role.failed': 'Không thể đổi vai trò. Hãy thử lại.',
  'admin.members.role.promote.title': 'Đặt {name} làm chủ sở hữu?',
  'admin.members.role.promote.body':
    '{name} sẽ có quyền lực ngang bạn: thanh toán, thành viên và cài đặt. Một chủ sở hữu có thể hạ vai trò hoặc xoá bất kỳ chủ sở hữu nào khác, kể cả bạn.',
  'admin.members.role.promote.confirm': 'Đặt làm chủ sở hữu',
  'admin.members.role.promote.cancel': 'Huỷ',

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
  'bookingStatus.confirmed': 'Đã chốt',
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

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    other: '{value} chuyến đi',
  },
  'trips.count.favourites': {
    other: '{value} yêu thích',
  },
  'trips.count.archived': {
    other: '{value} đã lưu trữ',
  },
  'trips.atLimit.body':
    'Gói của bạn bao gồm {trips}. Hãy lưu trữ một chuyến đã xong, hoặc lên gói cao hơn để mở nhiều hơn cùng lúc.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Nhật ký mới',
  'newJourney.title': 'Bắt đầu một nhật ký',
  'newJourney.description':
    'Nhật ký là mặt viết của một chuyến đi — các mục theo thứ tự ngày, với ảnh và thời tiết bạn còn nhớ.',
  'newJourney.titlePlaceholder': 'Hai tuần ở Kyoto',
  'newJourney.subtitle': 'Phụ đề',
  'newJourney.subtitleHint': 'Một dòng dưới tiêu đề, trên bìa.',
  'newJourney.subtitlePlaceholder': 'Đền chùa, tàu và quá nhiều matcha',
  'newJourney.trip': 'Dựa trên một chuyến đi',
  'newJourney.tripHint':
    'Không bắt buộc — gắn câu chuyện với lịch trình của nó.',
  'newJourney.tripNone': 'Không gắn với chuyến đi nào',
  'newJourney.datesError': 'Ngày kết thúc trước ngày bắt đầu.',
  'newJourney.submit': 'Tạo nhật ký',
  'newJourney.creating': 'Đang tạo nhật ký',
  'newJourney.created': 'Đã bắt đầu nhật ký',
  'newJourney.createdBody': 'Thêm mục đầu tiên để mở đầu câu chuyện.',
  'newJourney.error': 'Không tạo được nhật ký. Thử lại sau một lát.',
  'newCollection.trigger': 'Bộ sưu tập mới',
  'newCollection.title': 'Bắt đầu một bộ sưu tập',
  'newCollection.description':
    'Một nơi cho những địa điểm bạn tìm thấy trước khi biết chúng thuộc chuyến đi nào.',
  'newCollection.namePlaceholder': 'Cà phê đáng để đi hết thành phố',
  'newCollection.descriptionHint': 'Cái gì thuộc về đây, cái gì không.',
  'newCollection.submit': 'Tạo bộ sưu tập',
  'newCollection.creating': 'Đang tạo bộ sưu tập',
  'newCollection.created': 'Đã tạo bộ sưu tập',
  'newCollection.createdBody': 'Bắt đầu lưu địa điểm vào đó.',
  'newCollection.error': 'Không tạo được bộ sưu tập. Thử lại sau một lát.',

  'newTrip.title': 'Bắt đầu chuyến đi mới',
  'newTrip.description':
    'Chỉ cần một tiêu đề. Các mốc ngày sẽ dựng lịch trình từng ngày, phần còn lại có thể chờ đến khi bạn biết.',
  'newTrip.name': 'Tên chuyến đi',
  'newTrip.namePlaceholder': 'Kyoto vào mùa hoa anh đào',
  'newTrip.destination': 'Điểm đến',
  'newTrip.destinationHint': 'Một thành phố, một vùng, hoặc cả hành trình.',
  'newTrip.destinationPlaceholder': 'Kyoto, Nhật Bản',
  'newTrip.departure': 'Khởi hành',
  'newTrip.return': 'Trở về',
  'newTrip.returnError': 'Ngày trở về sớm hơn ngày khởi hành.',
  'newTrip.currency': 'Tiền tệ của ngân sách',
  'newTrip.currencyHint': 'Mọi chi phí của chuyến đi được cộng theo đơn vị đó.',
  'newTrip.currencySearch': 'Tìm theo mã hoặc tên',
  'newTrip.currencyEmpty': 'Không có loại tiền nào khớp.',
  'newTrip.currencyFavourites': 'Yêu thích',
  'newTrip.currencyAll': 'Tất cả loại tiền',
  'newTrip.summary': 'Tóm tắt',
  'newTrip.summaryPlaceholder': 'Hai tuần với đền chùa, tàu hỏa và ramen.',
  'newTrip.duration': 'Thời lượng theo ngày',
  'newTrip.durationHint':
    'Không có ngày cụ thể, chuyến đi bắt đầu với số ngày chưa có ngày này.',
  'newTrip.durationDerived': 'Tính từ hai ngày đã chọn.',
  'newTrip.reminder': 'Nhắc trước ngày khởi hành',
  'newTrip.reminderNone': 'Không',
  'newTrip.reminderBefore': {
    other: '{count} ngày trước',
  },
  'newTrip.reminderCustom': 'Tùy chỉnh',
  'newTrip.reminderCustomDays': 'Số ngày trước khi khởi hành',
  'newTrip.reminderOn': 'Nhắc vào {date}',
  'newTrip.reminderNoDeparture': 'Chọn ngày khởi hành để xem ngày nhắc.',
  'newTrip.submit': 'Tạo chuyến đi',
  'newTrip.creating': 'Đang tạo chuyến đi',
  'newTrip.error': 'Không tạo được chuyến đi. Thử lại sau một lát.',
  'newTrip.created': 'Đã tạo chuyến đi',
  'newTrip.createdBody': 'Bắt đầu đặt địa điểm lên bản đồ.',
  'newTrip.coverChoose': 'Thêm ảnh bìa',
  'newTrip.coverChange': 'Đổi ảnh bìa',
  'newTrip.coverHint':
    'Thả ảnh vào đây, dán ảnh hoặc chọn tệp. PNG, JPEG, WebP, AVIF hoặc GIF.',
  'newTrip.coverChosen': 'Ảnh bìa: {name}',
  'newTrip.coverRemove': 'Xóa ảnh bìa',
  'newTrip.coverTypeError':
    '“{name}” không dùng được làm ảnh bìa. Hãy chọn PNG, JPEG, WebP, AVIF hoặc GIF.',
  'newTrip.coverSizeError': '“{name}” lớn hơn {max}. Hãy chọn ảnh nhỏ hơn.',
  'newTrip.coverUploading': 'Đang tải ảnh bìa lên',
  'newTrip.coverFailedTitle': 'Chưa thêm được ảnh bìa',
  'newTrip.coverFailed':
    'Đã tạo chuyến đi, nhưng không tải “{name}” lên làm ảnh bìa được.',
  'newTrip.coverRetry': 'Thử lại',
  'newTrip.coverContinue': 'Mở chuyến đi không có ảnh bìa',
  'newTrip.people': 'Người tham gia',
  'newTrip.peopleHint':
    'Họ được thêm ngay khi chuyến đi được tạo. Bạn vẫn là chủ sở hữu.',
  'newTrip.peoplePlaceholder': 'Chọn từ không gian làm việc',
  'newTrip.peopleSearch': 'Tìm theo tên',
  'newTrip.peopleLoading': 'Đang tải những người trong không gian làm việc',
  'newTrip.peopleLoadError':
    'Không tải được những người trong không gian làm việc. Hãy tạo chuyến đi rồi thêm họ ở màn hình Người tham gia.',
  'newTrip.peopleNone':
    'Hiện bạn là người duy nhất trong không gian làm việc này.',
  'newTrip.peopleNoneMember':
    'Chủ sở hữu hoặc quản trị viên của không gian làm việc có thể mời thêm người.',
  'newTrip.peopleInvite': 'Mời người vào không gian làm việc',
  'newTrip.peopleChosen': 'Những người đã chọn và vai trò của họ',
  'newTrip.peopleFailedTitle':
    'Đã tạo chuyến đi, nhưng chưa thêm được tất cả mọi người',
  'newTrip.noticeBothTitle': 'Đã tạo chuyến đi, nhưng chưa thêm được tất cả',
  'newTrip.peopleNotInWorkspace':
    '{name} không còn trong không gian làm việc này nên chưa được thêm.',
  'newTrip.peopleAlreadyOn': '{name} đã có trong chuyến đi này.',
  'newTrip.peopleUnconfirmed':
    'Không xác nhận được việc thêm {name}. Hãy kiểm tra ở Người tham gia xem đã thêm chưa.',
  'newTrip.peopleContinue': 'Tiếp tục',
  'newTrip.peopleRetry': 'Thử lại',
  'newTrip.coverRetryOnly': 'Thử lại ảnh bìa',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Thao tác cho {title}',
  'tripActions.copy': 'Sao chép',
  'tripActions.favourite': 'Thêm vào yêu thích',
  'tripActions.unfavourite': 'Bỏ khỏi yêu thích',
  'tripActions.edit': 'Sửa',
  'tripActions.archive': 'Lưu trữ',
  'tripActions.restore': 'Khôi phục',
  'tripActions.delete': 'Xóa',
  'tripActions.deleteForGood': 'Xóa vĩnh viễn',
  'tripActions.starFailed': 'Không lưu được mục yêu thích',
  'tripActions.starFallback': 'Chuyến đi đã trở lại như cũ.',
  'tripActions.archived': 'Đã lưu trữ chuyến đi',
  'tripActions.archiveFailed': 'Không lưu trữ được chuyến đi',
  'tripActions.restored': 'Đã khôi phục chuyến đi',
  'tripActions.restoreFailed': 'Không khôi phục được chuyến đi',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Sửa chuyến đi',
  'editTrip.submit': 'Lưu thay đổi',
  'editTrip.saving': 'Đang lưu chuyến đi',
  'editTrip.cancel': 'Hủy',
  'editTrip.saved': 'Đã cập nhật chuyến đi',
  'editTrip.errorTitle': 'Chưa lưu được',
  'editTrip.retry': 'Thử lại',
  'editTrip.error': 'Không lưu được chuyến đi. Hãy thử lại sau giây lát.',
  'editTrip.coverFailed':
    'Không tải “{name}” lên làm ảnh bìa được. Chưa lưu thêm gì khác.',
  'editTrip.coverContinue': 'Lưu mà không có ảnh bìa mới',
  'editTrip.currencyLocked':
    'Chuyến đi này đã có giá, nên không thể đổi tiền tệ của ngân sách tại đây. Hãy dùng nút “Đổi tiền tệ của ngân sách” ở tab Chi phí, hoặc đặt lại {current} để lưu các thay đổi khác.',
  'editTrip.currencyReadonly': 'Tiền tệ của ngân sách được đổi ở tab Chi phí.',
  'editTrip.currencyLink': 'Mở tab Chi phí',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Xóa vĩnh viễn “{title}”?',
  'deleteTrip.description':
    'Không có hoàn tác và không có thùng rác. Lưu trữ đưa chuyến đi ra khỏi danh sách mà không làm mất nó.',
  'deleteTrip.reading': 'Đang đọc nội dung của chuyến đi này',
  'deleteTrip.errorTitle': 'Chưa tải được',
  'deleteTrip.summaryError': 'Không đọc được nội dung của chuyến đi này.',
  'deleteTrip.confirmLabel': 'Nhập tên chuyến đi để xác nhận',
  'deleteTrip.deleting': 'Đang xóa chuyến đi',
  'deleteTrip.deleted': 'Đã xóa chuyến đi',
  'deleteTrip.failed': 'Không xóa được chuyến đi',
  'deleteTrip.carried.reservations': {
    other: 'đặt chỗ',
  },
  'deleteTrip.carried.transports': {
    other: 'chặng di chuyển',
  },
  'deleteTrip.carried.expenses': {
    other: 'khoản chi',
  },
  'deleteTrip.carried.files': {
    other: 'tệp',
  },
  'deleteTrip.carried.members': {
    other: 'người',
  },
  'copyTrip.title': 'Sao chép “{title}”',
  'copyTrip.nameLabel': 'Tên bản sao',
  'copyTrip.titleRequired': 'Hãy đặt tên cho bản sao.',
  'copyTrip.datesLabel': 'Ngày',
  'copyTrip.datesTogether': 'Hãy nhập cả hai ngày, hoặc xóa cả hai.',
  'copyTrip.clearDates': 'Sao chép không kèm ngày',
  'copyTrip.carries':
    'Các ngày, địa điểm và ghi chú được sao sang. Đặt chỗ, tiền bạc, tệp và người thì không.',
  'copyTrip.shorter':
    'Khoảng này ngắn hơn bản gốc. Địa điểm của những ngày dôi ra sẽ chuyển vào ý tưởng, còn ghi chú của chúng bị bỏ.',
  'copyTrip.submit': 'Sao chép chuyến đi',
  'copyTrip.copying': 'Đang sao chép chuyến đi',
  'copyTrip.cancel': 'Hủy',
  'copyTrip.started': 'Đang sao chép “{title}”',
  'copyTrip.errorTitle': 'Chưa sao chép được',
  'copyTrip.error': 'Không sao chép được chuyến đi. Hãy thử lại sau giây lát.',

  'trips.error': 'Không tải được các chuyến đi của bạn',
  'trips.eyebrow': 'Không gian',
  'trips.nothingPlanned': 'Chưa có kế hoạch nào',
  'trips.search': 'Tìm chuyến đi',
  'trips.atLimit.title': 'Bạn đã dùng hết số chuyến đi gói của bạn cho phép',
  'trips.atLimit.action': 'So sánh các gói',
  'trips.noMatch.title': 'Không có gì khớp với bộ lọc đó',
  'trips.noMatch.body':
    'Thử giai đoạn khác, xoá ô tìm kiếm, hoặc xem trong lưu trữ.',
  'trips.noMatch.action': 'Đặt lại bộ lọc',
  'trips.empty.body':
    'Một chuyến đi giữ lịch trình, bản đồ, các đặt chỗ, danh sách hành lý và tiền. Bắt đầu một chuyến, phần còn lại theo sau.',
  'trips.next.title': 'Đi đâu tiếp',
  'trips.next.body':
    'Bắt đầu một chuyến và planned.travel dựng một ngày cho mỗi mốc, sẵn cho những gì bạn đã lưu.',
  'trips.savedPlaces': 'Địa điểm đã lưu',
  'trips.filter.all': 'Tất cả',
  'trips.filter.favourites': 'Yêu thích',
  'trips.view.label': 'Bố cục',
  'trips.view.grid': 'Lưới',
  'trips.view.list': 'Danh sách',
  'trips.card.favourite': 'Được yêu thích',
  'trips.card.noDestination': 'Chưa chọn điểm đến',
  'trips.card.noDates': 'Chưa chọn ngày',
  'trips.card.startsIn': 'sau {days} ngày',
  'trips.card.days': '{days} ngày',
  'trips.card.copying': 'Đang sao chép',
  'trips.card.copyingLabel': '{title} vẫn đang được sao chép',
  'trips.card.copyingReason': 'Hãy đợi sao chép xong.',
  'trips.card.archivedReason': 'Hãy khôi phục chuyến đi này để chỉnh sửa.',
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
  'error.reported': 'Chúng tôi đã nhận được thông báo và đang kiểm tra.',
  'error.reference': 'Mã tham chiếu',
  'error.feedback.open': 'Cho chúng tôi biết chuyện gì đã xảy ra',
  'error.feedback.label': 'Bạn đang làm gì khi việc này xảy ra?',
  'error.feedback.send': 'Gửi',
  'error.feedback.sent': 'Cảm ơn bạn — điều này rất hữu ích.',
  'error.feedback.failed':
    'Chưa gửi được. Mã tham chiếu ở trên vẫn đến được với chúng tôi.',
  'error.root': 'Có gì đó lệch đường',
  'error.session': 'Quyền vào không gian của bạn đã đổi',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Báo cáo sự cố',
  'feedback.formTitle': 'Báo cáo sự cố',
  'feedback.messageLabel': 'Có gì sai, hoặc cần thay đổi điều gì?',
  'feedback.messagePlaceholder': 'Bạn mong đợi điều gì, và điều gì đã xảy ra?',
  'feedback.emailLabel': 'Địa chỉ email',
  'feedback.emailPlaceholder': 'ban@vidu.com',
  'feedback.isRequiredLabel': '(bắt buộc)',
  'feedback.submitButtonLabel': 'Gửi báo cáo',
  'feedback.cancelButtonLabel': 'Huỷ',
  'feedback.confirmButtonLabel': 'Xác nhận',
  'feedback.addScreenshotButtonLabel': 'Thêm ảnh chụp màn hình',
  'feedback.removeScreenshotButtonLabel': 'Gỡ ảnh chụp màn hình',
  'feedback.highlightToolText': 'Đánh dấu',
  'feedback.hideToolText': 'Che',
  'feedback.successMessageText': 'Cảm ơn bạn — chúng tôi đã nhận được báo cáo.',
  'feedback.errorEmptyMessageText':
    'Hãy viết một câu trước — báo cáo trống không cho chúng tôi biết gì cả.',
  'feedback.errorTimeoutText':
    'Việc này mất quá lâu, và chúng tôi không thể xác nhận báo cáo đã được gửi.',
  'feedback.errorForbiddenText': 'Trang này không được phép gửi báo cáo.',
  'feedback.errorGenericText':
    'Không gửi được. Kiểm tra kết nối, và xem có trình chặn quảng cáo nào cản đường không.',

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
  'session.workspaceChanged':
    'Không gian làm việc đã được đổi ở một tab hoặc cửa sổ khác. Chưa có gì được lưu.',
  'session.workspaceChangedTitle': 'Không gian làm việc đã đổi ở tab khác',
  'session.workspaceChangedBody':
    'Tab này đang hiển thị {name}, nhưng không gian làm việc đã được đổi ở một tab hoặc cửa sổ khác. Chưa có gì được lưu.',
  'session.openCurrentWorkspace': 'Mở không gian làm việc hiện tại',
  'session.workspaceChangedDismiss': 'Để sau',
} satisfies TranslationOf<typeof En>

export default messages
