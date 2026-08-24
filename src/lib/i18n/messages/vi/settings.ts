/**
 * Everything the settings module says, in Vietnamese.
 *
 * Authored from `../en/settings`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Vietnamese does not inflect for number, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair collapses to one branch.
 * `count` still selects it and is never printed; every figure a reader sees
 * arrives already grouped for the locale under its own placeholder.
 *
 * **Currency names take their Vietnamese form**, which usually means a
 * transcribed unit plus the country: `Đô la Úc`, `Bảng Anh`, `Yên Nhật`. The
 * euro takes `Đồng euro`, because Vietnamese wants the unit word in front of a
 * borrowed currency name. The ISO code beside them is derived in the route and
 * is not a key.
 *
 * **`Push` becomes `Thiết bị`.** Vietnamese has no settled word for a push
 * notification, and a column header that reads `Push` teaches a reader nothing;
 * naming the devices is both true and translatable, and the hint under it says
 * which devices are meant.
 *
 * **Plan names are words, not identifiers.** `free`, `solo` and `crew` are the
 * ids Stripe and the invoice carry and no reader ever sees; the words on the
 * screen are `Miễn phí`, `Cá nhân` and `Nhóm`.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  'page.eyebrow': 'Tài khoản',
  'page.title': 'Cài đặt',
  'page.description':
    'Mọi thứ về bạn, về không gian làm việc và cách planned.travel vận hành',
  'page.error': 'Cài đặt chưa tải được',

  'nav.label': 'Các mục cài đặt',
  'nav.profile': 'Hồ sơ',
  'nav.profile.hint': 'Bạn, và cách đọc ngày tháng cùng tiền bạc',
  'nav.language': 'Ngôn ngữ',
  'nav.language.hint': 'Thứ tiếng mọi màn hình dùng',
  'nav.appearance': 'Giao diện',
  'nav.appearance.hint': 'Chủ đề, chuyển động và bản đồ',
  'nav.security': 'Bảo mật',
  'nav.security.hint': 'Mật khẩu, hai bước, khóa truy cập',
  'nav.notifications': 'Thông báo',
  'nav.notifications.hint': 'Hộp thư, email và thiết bị',
  'nav.workspace': 'Không gian làm việc',
  'nav.workspace.hint': 'Thành viên và thiết lập chung',
  'nav.billing': 'Thanh toán',
  'nav.billing.hint': 'Gói, chỗ ngồi và hóa đơn',

  'action.save': 'Lưu thay đổi',
  'error.retryBody': 'Không mất gì cả. Kiểm tra kết nối rồi thử lại.',
  'role.owner': 'Chủ sở hữu',
  'role.admin': 'Quản trị viên',
  'role.member': 'Thành viên',

  'regional.workspaceDefault': 'Mặc định của không gian — {value}',
  'regional.currency.AUD': 'Đô la Úc',
  'regional.currency.CAD': 'Đô la Canada',
  'regional.currency.CHF': 'Franc Thụy Sĩ',
  'regional.currency.EUR': 'Đồng euro',
  'regional.currency.GBP': 'Bảng Anh',
  'regional.currency.JPY': 'Yên Nhật',
  'regional.currency.PLN': 'Złoty Ba Lan',
  'regional.currency.SEK': 'Krona Thụy Điển',
  'regional.currency.USD': 'Đô la Mỹ',
  'regional.distance.metric': 'Ki-lô-mét',
  'regional.distance.imperial': 'Dặm',

  'profile.error': 'Hồ sơ của bạn chưa tải được',
  'profile.account.title': 'Tài khoản của bạn',
  'profile.account.description':
    'Tên và email của bạn lấy từ tài khoản bạn dùng để đăng nhập.',
  'profile.email.verified': 'Email đã xác minh',
  'profile.email.unverified': 'Email chưa xác minh',
  'profile.twoFactor.on': 'Đã bật hai bước',
  'profile.figure.workspace': 'Không gian làm việc',
  'profile.figure.role': 'Vai trò',
  'profile.figure.joined': 'Thành viên từ',
  'profile.figure.joinedUnknown': 'Không có ghi nhận',
  'profile.regional.title': 'Ngày tháng, tiền bạc và đơn vị',
  'profile.regional.description':
    'Những mục này đè lên thiết lập chung, chỉ cho riêng bạn. Để nguyên mặc định thì nó theo không gian làm việc.',
  'profile.regional.saving': 'Đang lưu tùy chọn của bạn',
  'profile.regional.saved': 'Đã lưu tùy chọn của bạn',
  'profile.regional.saveFailed': 'Chưa lưu được tùy chọn của bạn',
  'profile.language.label': 'Ngôn ngữ',
  'profile.language.hint':
    'Chọn ở màn hình riêng, nơi mỗi thứ tiếng được viết bằng chính chữ viết của nó.',
  'profile.language.action': 'Đổi',
  'profile.timezone.label': 'Múi giờ',
  'profile.timezone.hint':
    'Giờ khởi hành và giờ đến đều hiển thị theo múi giờ này.',
  'profile.currency.label': 'Tiền tệ',
  'profile.currency.hint':
    'Chuyến đi mới bắt đầu bằng loại tiền này; mỗi chuyến đều có thể đổi.',
  'profile.dateFormat.label': 'Định dạng ngày',
  'profile.weekStart.label': 'Tuần bắt đầu từ',
  'profile.weekStart.hint': 'Áp dụng cho mọi lịch, kể cả lưới năm của kỳ nghỉ.',
  'profile.distance.label': 'Khoảng cách',

  'language.error': 'Cài đặt ngôn ngữ của bạn chưa tải được',
  'language.section.title': 'Ngôn ngữ',
  'language.section.description':
    'Mọi màn hình, mọi nút bấm và mọi ngày tháng đều đọc bằng thứ tiếng bạn chọn ở đây — hai mươi ba thứ tiếng, mỗi thứ viết bằng chữ viết của chính nó.',
  'language.label': 'Chọn một ngôn ngữ',
  'language.followWorkspace': 'Theo không gian làm việc',
  'language.state.yours': 'Ngôn ngữ của bạn',
  'language.state.workspace': 'Do không gian làm việc cấp',
  'language.state.hint.override':
    'Lựa chọn của riêng bạn. Nó chỉ áp cho bạn, trên mọi thiết bị bạn đăng nhập.',
  'language.state.hint.workspace':
    'Bạn chưa chọn ngôn ngữ riêng, nên bạn đọc theo thiết lập của không gian làm việc. Chủ sở hữu hoặc quản trị viên có thể đổi trong mục Không gian làm việc.',
  'language.saved': 'planned.travel giờ nói {language}',
  'language.saveFailed': 'Ngôn ngữ của bạn chưa được đổi',
  'language.saveFailedBody':
    'Không mất gì cả và bạn vẫn đang đọc {language}. Kiểm tra kết nối, rồi chọn lại.',
  'language.reload.title': 'Ngôn ngữ của bạn đã được lưu',
  'language.reload.body':
    'Trang này chưa kịp chuyển sang {language}. Hãy tải lại để đọc sản phẩm bằng ngôn ngữ mới.',
  'language.sample.title': 'Ngày tháng và con số sẽ đọc thế nào',
  'language.sample.description':
    'Vẫn ba giá trị đó, viết theo cách thứ tiếng này viết.',
  'language.sample.date': 'Một ngày',
  'language.sample.number': 'Một con số',
  'language.sample.money': 'Một khoản tiền',
  'language.legal':
    'Điều khoản và thông báo quyền riêng tư chỉ đăng bằng tiếng Anh. Mọi phần còn lại của sản phẩm đều được dịch.',

  'appearance.error': 'Giao diện chưa tải được',
  'appearance.theme.title': 'Chủ đề',
  'appearance.theme.description':
    'Cả hai chủ đề đều được thiết kế riêng, không phải đảo màu. Chọn cái bạn đọc dễ chịu nhất.',
  'appearance.theme.light': 'Sáng',
  'appearance.theme.lightHint': 'Giấy ấm, suốt cả ngày',
  'appearance.theme.dark': 'Tối',
  'appearance.theme.darkHint': 'Than ấm, không bao giờ đen kịt',
  'appearance.theme.system': 'Hệ thống',
  'appearance.theme.systemHint': 'Theo thiết bị',
  'appearance.theme.showing': 'Đang hiển thị bảng màu {palette}.',
  'appearance.theme.showingSystem':
    'Đang hiển thị bảng màu {palette}, theo thiết bị của bạn.',
  'appearance.palette.light': 'sáng',
  'appearance.palette.dark': 'tối',
  'appearance.motion.title': 'Chuyển động và bản đồ',
  'appearance.motion.label': 'Giảm chuyển động',
  'appearance.motion.hint':
    'Rút gọn hoạt ảnh xuất hiện thành một lần mờ dần. Thiết lập giảm chuyển động của hệ điều hành luôn được tôn trọng.',
  'appearance.map.label': 'Kiểu bản đồ',
  'appearance.map.hint':
    'Nền bản đồ dùng trong phần lên lịch trình và bản đồ thế giới.',
  'appearance.map.workspace': 'Theo không gian làm việc',
  'appearance.map.light': 'Giấy — sáng',
  'appearance.map.dark': 'Than — tối',
  'appearance.saveFailed': 'Thay đổi đó chưa được lưu',
  'appearance.saveFailedBody':
    'Nó đang hiện ở đây, nhưng thiết bị bạn đăng nhập lần tới sẽ không có.',

  'security.error': 'Phần bảo mật chưa tải được',
  'security.unverified.title': 'Địa chỉ email của bạn chưa được xác minh',
  'security.unverified.body':
    'Thư đặt lại mật khẩu và lời mời chuyến đi được gửi tới {email}. Xác minh chính là thứ chứng minh địa chỉ đó là của bạn.',
  'security.unverified.action': 'Gửi lại liên kết',
  'security.signin.title': 'Cách đăng nhập',
  'security.signin.description':
    'Cách bạn chứng minh mình là mình. Xác minh hai bước và khóa truy cập đều mạnh hơn mật khẩu đơn thuần.',
  'security.email.label': 'Địa chỉ email',
  'security.email.verified': 'Đã xác minh',
  'security.email.unverified': 'Chưa xác minh',
  'security.password.label': 'Mật khẩu',
  'security.password.hint':
    'Đổi bất cứ lúc nào — bạn sẽ nhận một liên kết dùng một lần chứ không bị hỏi mật khẩu cũ.',
  'security.password.action': 'Đổi mật khẩu',
  'security.twoFactor.label': 'Xác thực hai bước',
  'security.twoFactor.onHint':
    'Mỗi lần đăng nhập mới đều cần mã từ ứng dụng xác thực.',
  'security.twoFactor.offHint':
    'Thêm một mã sáu chữ số từ ứng dụng xác thực bên cạnh mật khẩu.',
  'security.twoFactor.on': 'Bật',
  'security.twoFactor.off': 'Tắt',
  'security.twoFactor.manage': 'Quản lý',
  'security.twoFactor.enable': 'Bật lên',
  'security.passkeys.label': 'Khóa truy cập',
  'security.passkeys.hint':
    'Đăng nhập bằng vân tay, Face ID hoặc khóa bảo mật mà không phải gõ gì.',
  'security.passkeys.action': 'Quản lý khóa truy cập',
  'security.session.title': 'Phiên này',
  'security.session.description': 'Trình duyệt bạn đang đọc dòng này.',
  'security.session.label': 'Đăng nhập là',
  'security.session.expires': 'Hết hạn {date}',
  'security.session.expiresSoon': 'sắp tới',
  'security.session.noExpiry': 'Không ghi nhận hạn dùng',
  'security.signOut.label': 'Đăng xuất',
  'security.signOut.hint':
    'Kết thúc phiên này và đưa bạn về trang đăng nhập. Các thiết bị khác vẫn đăng nhập.',
  'security.signOut.pending': 'Đang đăng xuất',
  'security.signOut.failed': 'Bạn chưa được đăng xuất',
  'security.signOut.failedBody': 'Kiểm tra kết nối rồi thử lại.',

  'notifications.error': 'Cài đặt thông báo chưa tải được',
  'notifications.title': 'Thông báo',
  'notifications.description':
    'Mỗi công tắc chỉ áp cho riêng bạn. Tắt đi không ngăn được sự việc xảy ra — nó chỉ ngăn chúng tôi báo cho bạn.',
  'notifications.caption': 'Thông báo nào tới kênh nào',
  'notifications.event': 'Sự việc',
  'notifications.switch': '{event} qua {channel}',
  'notifications.saveFailed': 'Tùy chọn đó chưa được lưu',
  'notifications.saveFailedBody':
    'Công tắc đã trả về chỗ cũ. Kiểm tra kết nối rồi thử lại.',
  'notifications.channel.in_app': 'Ứng dụng',
  'notifications.channel.in_app.hint': 'Chuông trên thanh trên cùng',
  'notifications.channel.email': 'Thư điện tử',
  'notifications.channel.email.hint': 'Gửi tới địa chỉ bạn dùng để đăng nhập',
  'notifications.channel.push': 'Thiết bị',
  'notifications.channel.push.hint': 'Trên những thiết bị bạn đã cho phép',
  'notifications.event.trip.invited': 'Lời mời chuyến đi',
  'notifications.event.trip.invited.hint':
    'Ai đó thêm bạn vào chuyến đi họ đang lên kế hoạch.',
  'notifications.event.trip.updated': 'Thay đổi lịch trình',
  'notifications.event.trip.updated.hint':
    'Một ngày, một điểm dừng hay một mốc thời gian đổi chỗ trong chuyến đi của bạn.',
  'notifications.event.trip.starting_soon': 'Nhắc khởi hành',
  'notifications.event.trip.starting_soon.hint':
    'Một lời nhắc trong những ngày trước lúc lên đường.',
  'notifications.event.reservation.reminder': 'Nhắc đặt chỗ',
  'notifications.event.reservation.reminder.hint':
    'Một chỗ ở, một bàn ăn hay một tấm vé sắp đến.',
  'notifications.event.expense.added': 'Khoản chi mới',
  'notifications.event.expense.added.hint':
    'Ai đó ghi lại tiền đã tiêu trong chuyến đi chung.',
  'notifications.event.expense.settled': 'Khoản đã thanh toán',
  'notifications.event.expense.settled.hint':
    'Một khoản bạn có phần đã được trả xong.',
  'notifications.event.list.assigned': 'Việc được giao',
  'notifications.event.list.assigned.hint':
    'Một mục trong danh sách hành lý hay việc cần làm trở thành của bạn.',
  'notifications.event.collab.message': 'Trò chuyện trong chuyến đi',
  'notifications.event.collab.message.hint':
    'Tin nhắn mới trong chuyến đi bạn tham gia.',
  'notifications.event.organization.invited': 'Lời mời không gian làm việc',
  'notifications.event.organization.invited.hint':
    'Bạn được mời vào một không gian làm việc.',

  'workspace.error': 'Không gian làm việc chưa tải được',
  'workspace.summary.description': 'Gói {plan} · tạo ngày {date}',
  'workspace.summary.createdRecently': 'gần đây',
  'workspace.summary.billingAction': 'Gói và thanh toán',
  'workspace.seats.label': 'Chỗ đã dùng',
  'workspace.seats.value': '{used} trên {limit}',
  'workspace.seats.note':
    'Lời mời chưa dùng vẫn chiếm chỗ, nên một không gian không bao giờ vượt quá gói mà nó đang trả tiền.',
  'workspace.seatsFull.title': 'Mọi chỗ trong gói này đã có người',
  'workspace.seatsFull.body':
    '{members} và {invitations} lấp kín cả {limit} chỗ.',
  'workspace.seatsFull.action': 'Thêm chỗ',
  'workspace.members.count': { other: '{value} thành viên' },
  'workspace.invitations.count': { other: '{value} lời mời đang chờ' },
  'workspace.members.title': 'Thành viên',
  'workspace.members.description':
    'Tất cả những người xem được chuyến đi, tiền bạc và tệp trong không gian này.',
  'workspace.members.tableLabel': 'Thành viên của không gian này',
  'workspace.members.person': 'Người',
  'workspace.members.role': 'Vai trò',
  'workspace.members.joined': 'Tham gia',
  'workspace.invitations.title': 'Lời mời',
  'workspace.invitations.description':
    'Những người đã được mời nhưng chưa tham gia.',
  'workspace.invitations.emptyTitle': 'Không còn lời mời nào treo',
  'workspace.invitations.emptyBody':
    'Mọi người được mời vào không gian này đều đã tham gia.',
  'workspace.invitations.expires': 'Hết hạn {date}',
  'workspace.invitations.expiresSoon': 'sắp tới',
  'workspace.defaults.title': 'Thiết lập chung',
  'workspace.defaults.description':
    'Điểm xuất phát của mỗi chuyến đi mới và mỗi thành viên mới. Ai cũng có thể đổi riêng cho mình trong hồ sơ.',
  'workspace.defaults.readOnly': 'Chỉ đọc',
  'workspace.defaults.saving': 'Đang lưu thiết lập chung',
  'workspace.defaults.saved': 'Đã lưu thiết lập chung',
  'workspace.defaults.saveFailed': 'Chưa lưu được thiết lập chung',
  'workspace.defaults.saveFailedBody':
    'Chỉ chủ sở hữu hoặc quản trị viên mới được đổi. Kiểm tra kết nối, rồi thử lại.',
  'workspace.currency.label': 'Tiền tệ mặc định',
  'workspace.currency.hint':
    'Chuyến đi mới được lập ngân sách bằng loại tiền này.',
  'workspace.language.label': 'Ngôn ngữ',
  'workspace.language.hint':
    'Thứ tiếng mà một thành viên chưa tự chọn ngôn ngữ sẽ đọc.',
  'workspace.timezone.label': 'Múi giờ',
  'workspace.dateFormat.label': 'Định dạng ngày',
  'workspace.weekStart.label': 'Tuần bắt đầu từ',
  'workspace.distance.label': 'Khoảng cách',

  'billing.error': 'Phần thanh toán chưa tải được',
  'billing.loading': 'Đang tải gói và các biên nhận',
  'billing.status.none': 'Chưa đăng ký',
  'billing.status.trialing': 'Dùng thử',
  'billing.status.active': 'Đang hoạt động',
  'billing.status.past_due': 'Thanh toán hỏng',
  'billing.status.unpaid': 'Chưa trả',
  'billing.status.paused': 'Đang tạm dừng',
  'billing.status.canceled': 'Đã hủy',
  'billing.status.incomplete': 'Chưa xong',
  'billing.status.incomplete_expired': 'Đã hết hạn',

  'billing.checkout.completeTitle': 'Đã nhận thanh toán',
  'billing.checkout.completeBody':
    'Gói mới của bạn đang được áp. Nó hiện ở đây ngay khi Stripe xác nhận — thường trong vài giây.',
  'billing.checkout.cancelledTitle': 'Đã hủy thanh toán',
  'billing.checkout.cancelledBody':
    'Không có khoản nào bị trừ và gói của bạn không đổi.',
  'billing.portal.backTitle': 'Vừa quay lại từ Stripe',
  'billing.portal.backBody':
    'Mọi thay đổi bạn làm bên đó sẽ về đây ngay khi Stripe xác nhận.',
  'billing.refresh': 'Làm mới',
  'billing.readOnly.title': 'Bạn là thành viên của không gian này',
  'billing.readOnly.body':
    'Chỉ chủ sở hữu hoặc quản trị viên mới đổi được gói đăng ký. Mọi thứ bên dưới chỉ để bạn đọc.',

  'billing.hero.label': 'Gói hiện tại',
  'billing.hero.endsAtPeriod': 'Kết thúc khi hết kỳ',
  'billing.hero.perYear': '/ năm',
  'billing.hero.perMonth': '/ tháng',
  'billing.hero.freeAllowance': '{trips} chuyến đi, một người',
  'billing.hero.perSeatLine': '{seats} thành viên × {price}',
  'billing.hero.singleTraveller': 'Một người đi',
  'billing.hero.paymentMethod': 'Phương thức thanh toán',
  'billing.hero.cancel': 'Hủy gói',
  'billing.price.free': 'Miễn phí',
  'billing.stripe.opening': 'Đang mở Stripe',
  'billing.stripe.failed': 'Không liên lạc được với Stripe',
  'billing.stripe.failedBody':
    'Không có khoản nào bị trừ. Kiểm tra kết nối rồi thử lại sau giây lát.',

  'billing.renewal.trialEndsToday':
    'Bản dùng thử của bạn hết hôm nay. Thêm thẻ để giữ mọi phần luôn mở.',
  'billing.renewal.trialEndsIn': {
    other:
      'Bản dùng thử của bạn còn {value} ngày. Chưa cần thẻ cho tới lúc đó.',
  },
  'billing.renewal.trialEnded': 'Bản dùng thử của bạn đã hết.',
  'billing.renewal.endsNoDate':
    'Gói này được đặt kết thúc và sẽ không gia hạn.',
  'billing.renewal.endsOn':
    'Gói này kết thúc vào {date}. Không có gì bị xóa — các phần trả phí chỉ khóa lại.',
  'billing.renewal.pastDue':
    'Lần thanh toán vừa rồi không qua. Cập nhật thẻ để khỏi mất các phần trả phí.',
  'billing.renewal.unpaid':
    'Gói đăng ký này chưa được trả và các phần trả phí đang khóa.',
  'billing.renewal.paused':
    'Gói đăng ký này đang tạm dừng. Mở lại bất cứ khi nào bạn sẵn sàng lên đường.',
  'billing.renewal.lapsed':
    'Chọn một gói bên dưới để mở lại phần đặt chỗ, nhật ký và bản đồ ngoại tuyến.',
  'billing.renewal.incomplete': 'Stripe vẫn đang chờ khoản này được xác nhận.',
  'billing.renewal.free':
    'Hai chuyến cùng lúc, miễn phí. Nâng gói khi nào bạn thấy chật.',
  'billing.renewal.auto': 'Tự động gia hạn.',
  'billing.renewal.renewsOn': 'Gia hạn vào {date}.',

  'billing.usage.title': 'Mức dùng',
  'billing.usage.description':
    'Đếm trực tiếp, nên đồng hồ không bao giờ cũ. Hạn mức theo đúng gói đang có hiệu lực.',
  'billing.quota.seats': 'Thành viên',
  'billing.quota.trips': 'Chuyến đi',
  'billing.quota.storageBytes': 'Dung lượng',
  'billing.quota.unlimited': 'Không giới hạn',
  'billing.quota.noLimit': 'Gói này không có hạn mức',
  'billing.quota.used': 'Đã dùng {quota}',
  'billing.quota.over.seats': {
    other: 'Vượt {value} chỗ so với hạn mức của gói này',
  },
  'billing.quota.over.trips': {
    other: 'Vượt {value} suất chuyến đi so với hạn mức của gói này',
  },
  'billing.quota.over.storage': 'Vượt {value} so với hạn mức của gói này',
  'billing.quota.exhausted.seats': 'Mọi chỗ trong gói này đã có người',
  'billing.quota.exhausted.trips':
    'Mọi suất chuyến đi của gói này đang dùng hết',
  'billing.quota.exhausted.storage': 'Dung lượng của gói này đã đầy',
  'billing.quota.left': 'còn {value}',

  'billing.plans.title': 'Các gói',
  'billing.plans.description':
    'Đổi gói bất cứ lúc nào. Nâng gói được tính theo ngày; hạ gói đợi tới khi hết kỳ bạn đã trả.',
  'billing.interval.label': 'Chu kỳ thanh toán',
  'billing.interval.monthly': 'Hằng tháng',
  'billing.interval.yearly': 'Hằng năm',
  'billing.interval.saving': 'Tiết kiệm {value}',

  'billing.plan.free.name': 'Miễn phí',
  'billing.plan.free.tagline': 'Lên kế hoạch cho hai chuyến sắp tới',
  'billing.plan.free.feature.trips': 'Hai chuyến cùng lúc',
  'billing.plan.free.feature.itinerary': 'Lịch trình từng ngày và bản đồ',
  'billing.plan.free.feature.lists': 'Danh sách hành lý và ngân sách đơn giản',
  'billing.plan.free.feature.atlas':
    'Bản đồ thế giới ghi lại những nơi bạn từng tới',
  'billing.plan.solo.name': 'Cá nhân',
  'billing.plan.solo.tagline': 'Dành cho người đi tự lo mọi thứ',
  'billing.plan.solo.feature.trips': 'Chuyến đi không giới hạn',
  'billing.plan.solo.feature.modules':
    'Đủ mọi phần lên kế hoạch — đặt chỗ, nhật ký, ngân sách, hành lý',
  'billing.plan.solo.feature.offline':
    'Bản đồ ngoại tuyến tải sẵn trước khi bay',
  'billing.plan.solo.feature.export': 'Xuất PDF và lịch',
  'billing.plan.crew.name': 'Nhóm',
  'billing.plan.crew.tagline': 'Dành cho gia đình, bạn bè và nhóm nhỏ',
  'billing.plan.crew.feature.members':
    'Tối đa mười thành viên, tính tiền theo người',
  'billing.plan.crew.feature.realtime':
    'Cộng tác tức thời với con trỏ hiện sống',
  'billing.plan.crew.feature.everything':
    'Chuyến đi không giới hạn và đủ mọi phần',
  'billing.plan.crew.feature.storage':
    'Chỗ chung cho ảnh và giấy tờ của cả nhóm',

  'billing.plan.current': 'Gói hiện tại',
  'billing.plan.currentBadge': 'Đang dùng',
  'billing.plan.popular': 'Được chuộng',
  'billing.plan.moveTo': 'Chuyển sang {plan}',
  'billing.plan.switchYearly': 'Đổi sang trả theo năm',
  'billing.plan.switchMonthly': 'Đổi sang trả theo tháng',
  'billing.plan.upgradeTo': 'Nâng lên {plan}',
  'billing.plan.changeTo': 'Đổi sang {plan}',
  'billing.plan.perMemberMonth': '/ thành viên / tháng',
  'billing.plan.perMonth': '/ tháng',
  'billing.plan.alwaysFree': 'Miễn phí mãi, không cần thẻ',
  'billing.plan.billedYearly': 'Tính {amount} mỗi năm',
  'billing.plan.billedMonthly': 'Tính {amount} mỗi tháng',
  'billing.plan.members': 'Thành viên',
  'billing.plan.membersHint': 'Đổi bất cứ lúc nào — tiền tính theo đó.',
  'billing.plan.seatOption': { other: '{value} thành viên' },

  'billing.invoices.title': 'Hóa đơn',
  'billing.invoices.description':
    'Mọi biên nhận của không gian này, mới nhất trước.',
  'billing.invoices.portal': 'Cổng thanh toán',
  'billing.invoices.unavailableTitle': 'Biên nhận không tải được',
  'billing.invoices.unavailableBody':
    'Stripe không kịp trả lời phần lịch sử. Mọi thứ bên trên vẫn đúng; mở cổng thanh toán để xem đầy đủ, hoặc quay lại sau ít phút.',
  'billing.invoices.emptyTitle': 'Chưa có hóa đơn nào',
  'billing.invoices.emptyCustomer':
    'Biên nhận đầu tiên hiện ở đây ngay khi một kỳ thanh toán khép lại.',
  'billing.invoices.emptyNoCustomer':
    'Không gian này chưa từng bị tính tiền. Chọn một gói trả phí và các biên nhận sẽ gom về đây.',
  'billing.invoices.tableLabel': 'Lịch sử hóa đơn',
  'billing.invoices.number': 'Hóa đơn',
  'billing.invoices.date': 'Ngày',
  'billing.invoices.period': 'Kỳ',
  'billing.invoices.amount': 'Số tiền',
  'billing.invoices.status': 'Tình trạng',
  'billing.invoices.receipt': 'Biên nhận',
  'billing.invoices.view': 'Xem',
  'billing.invoice.paid': 'Đã trả',
  'billing.invoice.open': 'Đến hạn',
  'billing.invoice.draft': 'Nháp',
  'billing.invoice.void': 'Vô hiệu',
  'billing.invoice.uncollectible': 'Không thu được',
} satisfies TranslationOf<typeof En>

export default messages
