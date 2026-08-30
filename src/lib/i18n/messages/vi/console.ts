/**
 * Tất cả những gì bảng điều khiển nền tảng nói ra, bằng tiếng Việt.
 *
 * Viết từ `../en/console.ts` (`docs/SPEC.md` §9). Tệp tiếng Anh là lược đồ:
 * `TranslationOf<typeof En>` biến mọi khoá thiếu hoặc bịa thêm thành lỗi biên dịch, còn
 * `__tests__/parity.test.ts` kiểm tra chỗ thay thế, nhánh số nhiều và việc không còn tiếng Anh sót
 * lại ở đây.
 *
 * **Số nhiều.** `Intl.PluralRules('vi')` chỉ cho một nhánh `other`: danh từ không đổi theo số
 * lượng, nên chính con số mới nói lên điều đó.
 *
 * **Hai thang vai trò không bao giờ lẫn nhau** (§5). Trên nền tảng: quản trị viên, người phụ trách,
 * người dùng. Trong không gian làm việc: chủ sở hữu, quản trị viên, thành viên. Chữ «quản trị viên»
 * có ở cả hai thang, chỉ câu chữ xung quanh mới phân biệt được.
 *
 * `Suspend` ở đây là «đình chỉ» chứ không phải «xoá»: gỡ đình chỉ là quyền truy cập quay lại, và
 * lời văn nói thẳng điều đó.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* -------------------------------------------------------------- các mục -- */

  'nav.label': 'Các mục của bảng điều khiển',
  'nav.overview': 'Tổng quan',
  'nav.overview.description': 'Nền tảng trong một cái nhìn',
  'nav.accounts': 'Tài khoản',
  'nav.accounts.description': 'Vai trò, đình chỉ và phiên đăng nhập',
  'nav.runs': 'Lượt chạy của tác nhân',
  'nav.runs.description': 'Đội Sandcastle đang dựng những gì',

  /* ------------------------------------------------------------------ khung -- */

  'shell.eyebrow': 'Chính nền tảng',
  'shell.title': 'Bảng điều khiển',
  'shell.description':
    'Bản thân sản phẩm — tài khoản, quyền hạn và danh mục dùng chung',
  'shell.signedInAs': 'Đang đăng nhập với tư cách',
  'shell.error.title': 'Không tải được bảng điều khiển',
  'shell.notFound.title': 'Không có tài khoản nào như vậy',
  'shell.notFound.body':
    'Không có gì trên nền tảng mang định danh này. Có thể tài khoản đã bị xoá sau khi liên kết được tạo, hoặc địa chỉ bị gõ sai.',
  'shell.allAccounts': 'Tất cả tài khoản',
  'shell.overview': 'Tổng quan bảng điều khiển',

  'failure.fallback': 'Thao tác không thành. Hãy thử lại sau ít phút.',

  /* --------------------------------------------------------------- tổng quan -- */

  'overview.error.title': 'Không tải được phần tổng quan',
  'overview.standing.title': 'Quyền hạn của bạn trên nền tảng',
  'overview.standing.body':
    'Tài khoản, phiên đăng nhập và việc hành động thay người khác đều thuộc về quản trị viên nền tảng, nên bảng điều khiển chỉ cho bạn xem danh mục, không có gì khác.',
  'overview.stat.accounts': 'Tài khoản',
  'overview.stat.accounts.caption': {
    other: '{staff} trong số đó giữ một vai trò trên nền tảng',
  },
  'overview.stat.admins': 'Quản trị viên',
  'overview.stat.admins.caption': 'Toàn quyền với tài khoản và phiên đăng nhập',
  'overview.stat.curators': 'Người phụ trách',
  'overview.stat.curators.caption':
    'Chỉ danh mục — không bao giờ đụng tới tài khoản',
  'overview.stat.suspended': 'Bị đình chỉ',
  'overview.stat.suspended.none': 'Không ai bị bỏ lại bên ngoài',
  'overview.stat.suspended.some':
    'Bị thoát khỏi mọi nơi cho tới khi được gỡ đình chỉ',
  'overview.stat.suspended.review': 'Xem lại họ',
  'overview.newest.label': 'Tài khoản mới nhất',
  'overview.newest.empty.title': 'Chưa có tài khoản nào',
  'overview.newest.empty.body': 'Người đăng ký đầu tiên sẽ hiện ra ở đây.',
  'overview.catalogue.label': 'Danh mục theo trạng thái',
  'overview.catalogue.empty.title': 'Danh mục dùng chung chưa mở',
  'overview.catalogue.empty.body':
    'Khi luồng nhập liệu vào đúng chỗ, bảng này sẽ đếm mỗi địa điểm trong danh mục dùng chung là bản nháp, đang duyệt hay đã đăng — và mở ra danh sách đằng sau từng con số.',
  'overview.scraping.label': 'Các lượt thu thập',
  'overview.scraping.empty.title': 'Chưa nguồn nào được chạy',
  'overview.scraping.empty.body':
    'Các nguồn được thu thập mỗi tuần một lần. Sau lượt chạy đầu tiên, năm lượt gần nhất sẽ nằm ở đây, kèm theo mỗi lượt lấy gì, đổi gì và bỏ gì.',

  /* --------------------------------------------------------- thang vai trò -- */

  'role.admin': 'Quản trị viên',
  'role.admin.summary':
    'Toàn quyền trên nền tảng: tài khoản, vai trò, đình chỉ, phiên đăng nhập và hành động thay người khác.',
  'role.admin.holds.accounts': 'Tạo tài khoản và cấp vai trò trên nền tảng',
  'role.admin.holds.bans': 'Đình chỉ tài khoản và gỡ đình chỉ',
  'role.admin.holds.sessions': 'Kết thúc phiên đăng nhập và đặt mật khẩu',
  'role.admin.holds.impersonate':
    'Hành động thay một tài khoản trong mười lăm phút',
  'role.admin.holds.curation': 'Mọi việc người phụ trách làm được',
  'role.admin.withheld.admins':
    'Hành động thay một quản trị viên nền tảng khác',
  'role.curator': 'Người phụ trách',
  'role.curator.summary':
    'Chăm sóc danh mục, bộ sưu tập, nguồn và liên kết chia sẻ. Không có gì đụng tới tài khoản.',
  'role.curator.holds.places': 'Đọc, viết và đăng các địa điểm trong danh mục',
  'role.curator.holds.packs': 'Đọc, viết và đăng các bộ sưu tập địa điểm',
  'role.curator.holds.sources': 'Đọc và chạy các nguồn của danh mục',
  'role.curator.holds.shares': 'Xem lại và thu hồi liên kết chia sẻ',
  'role.curator.withheld.accounts':
    'Mọi thứ đụng tới một tài khoản hay một phiên đăng nhập',
  'role.curator.withheld.tokens': 'Cấp hoặc thu hồi thông tin xác thực của máy',
  'role.user': 'Người dùng',
  'role.user.summary':
    'Không có quyền hạn nào trên nền tảng. Đây là gần như tất cả mọi người.',
  'role.user.withheld.everything':
    'Mọi quyền hạn của nền tảng, không trừ điều gì',

  /* ---------------------------------------------------------- một tài khoản -- */

  'identity.you': 'Đây là bạn',
  'status.active': 'Đang hoạt động',
  'status.suspended': 'Bị đình chỉ',
  'status.permanent': 'Vô thời hạn',
  'status.until': 'Đến {date}',
  'status.unverified': 'Chưa xác minh',
  'device.on': '{browser} trên {platform}',
  'device.unrecognised': 'Thiết bị không nhận ra',

  /* ------------------------------------------------------ danh sách tài khoản -- */

  'users.error.title': 'Không tải được danh sách tài khoản',
  'users.total': 'trong tổng số {total}',
  'users.loading': 'Đang tải tài khoản',
  'users.table.label': 'Tài khoản của nền tảng',
  'users.search.label': 'Tìm trong các tài khoản',
  'users.search.email': 'Tìm trong địa chỉ email',
  'users.search.name': 'Tìm trong tên',
  'users.search.column': 'Tìm trong cột nào',
  'users.search.submit': 'Tìm',
  'users.field.email': 'Địa chỉ email',
  'users.field.name': 'Tên',
  'users.filter.role.label': 'Lọc theo vai trò trên nền tảng',
  'users.filter.role.any': 'Vai trò bất kỳ',
  'users.filter.role.admin': 'Quản trị viên',
  'users.filter.role.curator': 'Người phụ trách',
  'users.filter.status.label': 'Lọc theo trạng thái tài khoản',
  'users.filter.status.any': 'Trạng thái bất kỳ',
  'users.filter.clear': 'Xoá bộ lọc',
  'users.filter.hint':
    'Thu hẹp theo vai trò hoặc theo trạng thái — mỗi lần một thứ.',
  'users.column.account': 'Tài khoản',
  'users.column.role': 'Vai trò trên nền tảng',
  'users.column.status': 'Trạng thái',
  'users.column.joined': 'Tham gia',
  'users.column.actions': 'Thao tác',
  'users.joined': 'Tham gia ngày {date}',
  'users.pastEnd.title': 'Trang này nằm quá cuối danh sách',
  'users.pastEnd.body': {
    other:
      'Khung nhìn này có {total} tài khoản, tức là {pages}. Trang {page} nằm ngoài chỗ đó.',
  },
  'users.pastEnd.pages': {
    other: '{pages} trang',
  },
  'users.pastEnd.back': 'Quay về trang đầu',
  'users.empty.filtered.title': 'Không có gì khớp với bộ lọc này',
  'users.empty.filtered.body':
    'Không tài khoản nào trên nền tảng đáp lại lần tìm này. Hãy mở rộng tìm kiếm, hoặc xoá bộ lọc để thấy tất cả mọi người.',
  'users.empty.title': 'Không có tài khoản nào để hiện',
  'users.empty.body':
    'Khung nhìn này trống. Không có gì bị lọc ra, nên cũng chẳng có gì để nới rộng.',

  /* ------------------------------------------------------- trang tài khoản -- */

  'account.error.title': 'Không tải được tài khoản này',
  'account.loading': 'Đang tải tài khoản',
  'account.meta.lastChange': 'Thay đổi gần nhất',
  'account.meta.id': 'Định danh tài khoản',
  'account.banned.title': 'Tài khoản này đang bị đình chỉ',
  'account.banned.noReason': 'Không có lý do nào được ghi cùng lần đình chỉ.',
  'account.banned.permanent':
    ' Còn hiệu lực cho tới khi một quản trị viên gỡ bỏ.',
  'account.banned.until': ' Tự gỡ vào ngày {date}.',
  'account.banned.untilUnknown': 'khi hết hạn',
  'account.authority.label': 'Quyền hạn trên nền tảng',
  'account.authority.may': 'Được phép',
  'account.authority.mayNot': 'Không được phép',
  'account.authority.none': 'Không gì trên nền tảng cả.',
  'account.workspaces.label': 'Không gian làm việc',
  'account.workspaces.truncated':
    'Tài khoản này thuộc về nhiều không gian làm việc hơn {listed} được liệt kê ở đây.',
  'account.workspaces.empty.title': 'Không thuộc không gian làm việc nào',
  'account.workspaces.empty.body':
    'Tài khoản này chưa thuộc về không gian làm việc nào. Một không gian được tạo ở lần đăng nhập đầu tiên, và mỗi nơi mời tài khoản vào sẽ hiện ra ở đây.',
  'account.workspaces.column.workspace': 'Không gian làm việc',
  'account.workspaces.column.role': 'Vai trò',
  'account.workspaces.column.plan': 'Gói',
  'account.subscription.label': 'Đăng ký',
  'account.subscription.free.title': 'Đang ở gói miễn phí',
  'account.subscription.free.body':
    'Không gian làm việc mà tài khoản này sở hữu chưa từng đi qua khâu thanh toán, nên nó không có hồ sơ đăng ký và chạy trong giới hạn của gói miễn phí.',
  'account.subscription.none.title':
    'Không có gì được tính phí cho tài khoản này',
  'account.subscription.none.body':
    'Tài khoản này không sở hữu không gian làm việc nào. Là thành viên trong không gian của người khác không có nghĩa là người được xuất hoá đơn, nên ở đây chẳng có gì để gộp lại.',
  'account.subscription.endsAtClose': 'Kết thúc khi hết kỳ',
  'account.subscription.seats': 'Chỗ ngồi',
  'account.subscription.seatsValue': '{used} trên {limit}',
  'account.subscription.ends': 'Kết thúc',
  'account.subscription.renews': 'Gia hạn',
  'account.sessions.label': 'Phiên đang sống',
  'account.sessions.truncated':
    'Tài khoản này giữ nhiều phiên hơn số mà một lần gọi liệt kê được. Để chắc chắn không còn phiên nào, hãy kết thúc mọi phiên từ trình đơn thao tác.',
  'account.sessions.empty.title': 'Đã thoát khỏi mọi nơi',
  'account.sessions.empty.body':
    'Tài khoản này không có phiên nào còn hạn. Nó sẽ hiện ra ở đây ngay khi đăng nhập lại.',
  'account.sessions.column.device': 'Thiết bị',
  'account.sessions.column.address': 'Địa chỉ',
  'account.sessions.column.started': 'Bắt đầu',
  'account.sessions.column.expires': 'Hết hạn',
  'account.sessions.impersonated':
    'Sinh ra từ một lần hành động thay tài khoản',
  'account.sessions.noAddress': 'Không ghi lại',
  'account.sessions.noAddressLong': 'Không ghi lại địa chỉ',
  'account.sessions.when': 'Bắt đầu {started} · hết hạn {expires}',
  'account.audit.label': 'Lịch sử kiểm toán',
  'account.audit.truncated':
    'Sổ cái còn nhiều mục hơn thế. Dấu vết kiểm toán của nền tảng chỉ thêm chứ không sửa, và được giữ bốn trăm ngày.',
  'account.audit.empty.title': 'Chưa ai làm gì với tài khoản này',
  'account.audit.empty.body':
    'Mỗi lần đổi vai trò, đình chỉ, đặt mật khẩu, kết thúc phiên và hành động thay tài khoản đều được ghi vào đây kèm tên người thực hiện. Chưa ai chạm vào nó.',

  /* ------------------------------ thang không gian làm việc -- */

  'workspace.role.owner': 'Chủ sở hữu',
  'workspace.role.admin': 'Quản trị viên',
  'workspace.role.member': 'Thành viên',
  'plan.free': 'Miễn phí',
  'plan.starter': 'Khởi đầu',
  'plan.pro': 'Chuyên nghiệp',
  'plan.business': 'Doanh nghiệp',
  'subscription.trialing': 'Đang dùng thử',
  'subscription.active': 'Đang hiệu lực',
  'subscription.pastDue': 'Quá hạn thanh toán',
  'subscription.canceled': 'Đã huỷ',
  'subscription.incomplete': 'Chưa hoàn tất',
  'subscription.expired': 'Đã hết hạn',
  'subscription.unpaid': 'Chưa thanh toán',
  'subscription.paused': 'Đang tạm dừng',

  /* --------------------------------------------------------- sổ kiểm toán -- */

  'audit.action.created': 'Tài khoản được tạo',
  'audit.action.updated': 'Thông tin tài khoản thay đổi',
  'audit.action.roleChanged': 'Vai trò trên nền tảng thay đổi',
  'audit.action.banned': 'Tài khoản bị đình chỉ',
  'audit.action.unbanned': 'Đình chỉ được gỡ',
  'audit.action.deleted': 'Tài khoản bị xoá',
  'audit.action.passwordSet': 'Mật khẩu do một quản trị viên đặt',
  'audit.action.emailSet': 'Địa chỉ email thay đổi',
  'audit.action.impersonationStarted': 'Bắt đầu hành động thay tài khoản',
  'audit.action.impersonationEnded': 'Kết thúc hành động thay tài khoản',
  'audit.action.sessionRevoked': 'Một phiên bị kết thúc',
  'audit.action.sessionRevokedAll': 'Mọi phiên đều bị kết thúc',
  'audit.actor.system': 'Chính nền tảng',
  'audit.actor.system.detail': 'tự động',
  'audit.actor.agent': 'Một thông tin xác thực của máy',
  'audit.actor.agent.detail': 'mã thông báo MCP',
  'audit.actor.deleted': 'Một tài khoản đã bị xoá',
  'audit.actorBadge': 'Khi đó: {role}',
  'audit.field.name': 'Tên',
  'audit.field.email': 'Địa chỉ email',
  'audit.field.emailVerified': 'Email đã xác minh',
  'audit.field.role': 'Vai trò trên nền tảng',
  'audit.field.banned': 'Bị đình chỉ',
  'audit.field.banReason': 'Lý do',
  'audit.field.banExpiresAt': 'Đình chỉ kết thúc',
  'audit.field.revoked': 'Các phiên bị kết thúc',
  'audit.field.impersonating': 'Đang hành động thay',
  'audit.field.impersonatedBy': 'Được hành động thay bởi',
  'audit.field.expiresAt': 'Phiên hết hạn',
  'audit.field.targetRole': 'Vai trò của họ trên nền tảng',
  'audit.field.sessionId': 'Phiên liên quan',
  'audit.value.yes': 'có',
  'audit.value.no': 'không',
  'audit.value.cleared': 'đã xoá trắng',
  'audit.became': 'thành',

  /* ---------------------------------------------------------- hộp thoại -- */

  'dialog.cancel': 'Huỷ',

  'create.button': 'Tài khoản mới',
  'create.title': 'Tạo tài khoản',
  'create.body':
    'Địa chỉ không được xác minh và không có thư nào gửi đi — hãy tự tay trao mật khẩu.',
  'create.confirm': 'Tạo tài khoản',
  'create.name.placeholder': 'Nguyễn Thu Hà',
  'create.email': 'Địa chỉ email',
  'create.email.placeholder': 'thuha@planned.travel',
  'create.password': 'Mật khẩu',
  'create.password.hint':
    'Đủ dài để thành một câu. Chủ tài khoản có thể đổi sau.',
  'create.done': 'Đã tạo tài khoản',
  'create.done.body': '{email} có thể đăng nhập bằng mật khẩu bạn vừa đặt.',

  'action.menu.label': 'Thao tác với {name}',
  'action.group.account': 'Tài khoản',
  'action.group.credentials': 'Thông tin xác thực',

  'action.role.item': 'Đổi vai trò trên nền tảng',
  'action.role.self':
    'Không dùng cho chính tài khoản bạn — hạ cấp chính mình có thể để nền tảng không còn quản trị viên nào.',
  'action.role.body':
    '{name} được làm gì trên chính nền tảng. Tư cách thành viên trong không gian làm việc là một bộ từ vựng khác và không hề nhúc nhích vì việc này.',
  'action.role.confirm': 'Lưu vai trò',
  'action.role.current': 'Hiện tại',
  'action.role.done': 'Đã cập nhật vai trò trên nền tảng',
  'action.role.done.body': '{name} giờ giữ vai trò {role} trên nền tảng.',

  'action.impersonate.item': 'Hành động thay tài khoản',
  'action.impersonate.self':
    'Không có ai để hoá thành — đây là tài khoản của chính bạn.',
  'action.impersonate.banned':
    'Tài khoản đang bị đình chỉ, nên nó không có phiên nào để bạn khoác lên.',
  'action.impersonate.admin':
    'Không vai trò nào trên nền tảng được hành động thay một quản trị viên, kể cả vai trò của bạn.',
  'action.impersonate.title': 'Hành động thay {name}',
  'action.impersonate.body':
    'Trong mười lăm phút, bạn sẽ thấy sản phẩm đúng như tài khoản này thấy.',
  'action.impersonate.confirm': 'Bắt đầu',
  'action.impersonate.note.bar':
    'Một thanh cảnh báo ở lại trên mọi màn hình cho tới khi bạn kết thúc, và không thể đóng lại.',
  'action.impersonate.note.platform':
    'Trong lúc hành động thay người khác, các thao tác của nền tảng không dùng được — bảng điều khiển cũng vậy.',
  'action.impersonate.note.audit':
    'Cả lúc bắt đầu lẫn lúc kết thúc đều được ghi vào dấu vết kiểm toán của nền tảng, kèm tên bạn.',

  'action.password.item': 'Đặt mật khẩu',
  'action.password.title': 'Đặt mật khẩu cho {name}',
  'action.password.body':
    'Dùng cách này để đưa một người trở lại tài khoản đã khoá họ ở ngoài, hoặc cắt kẻ tấn công khỏi một tài khoản bị chiếm.',
  'action.password.confirm': 'Đặt mật khẩu',
  'action.password.field': 'Mật khẩu mới',
  'action.password.hint.self':
    'Vừa đặt xong là mọi phiên đều kết thúc — kể cả phiên của bạn.',
  'action.password.hint':
    'Vừa đặt xong là mọi phiên mà tài khoản đang giữ đều kết thúc.',
  'action.password.done': 'Đã đặt mật khẩu',
  'action.password.done.body': '{name} đã bị thoát khỏi mọi thiết bị.',

  'action.sessions.item': 'Kết thúc mọi phiên',
  'action.sessions.body.self':
    'Việc này sẽ thoát khỏi mọi thiết bị của bạn, kể cả thiết bị bạn đang đọc dòng này.',
  'action.sessions.body':
    '{name} sẽ bị thoát khỏi mọi thiết bị và phải đăng nhập lại.',
  'action.sessions.confirm': 'Kết thúc các phiên',
  'action.sessions.done': 'Đã kết thúc các phiên',
  'action.sessions.done.body': {
    other: 'Đã kết thúc {revoked} phiên.',
  },

  'action.ban.item': 'Đình chỉ tài khoản',
  'action.ban.self':
    'Không dùng cho chính tài khoản bạn — tự đình chỉ mình là cắt mất đường quay lại.',
  'action.ban.title': 'Đình chỉ {name}',
  'action.ban.body':
    'Mọi phiên kết thúc ngay lập tức, và tài khoản không đăng nhập được cho tới khi đình chỉ được gỡ hoặc hết hạn.',
  'action.ban.confirm': 'Đình chỉ tài khoản',
  'action.ban.reason': 'Lý do',
  'action.ban.reason.hint':
    'Được giữ trong dấu vết kiểm toán của nền tảng mười ba tháng và không hiện ra với ai ngoài quản trị viên.',
  'action.ban.reason.placeholder':
    'Báo cáo lạm dụng lặp lại từ ba không gian làm việc',
  'action.ban.duration': 'Thời hạn',
  'action.ban.duration.label': 'Thời hạn đình chỉ',
  'action.ban.duration.permanent.body':
    'Còn hiệu lực cho tới khi một quản trị viên chủ ý gỡ bỏ.',
  'action.ban.duration.day': '24 giờ',
  'action.ban.duration.day.body':
    'Đủ dài để cắt ngang, đủ ngắn để vẫn là một lần can thiệp.',
  'action.ban.duration.week': '7 ngày',
  'action.ban.duration.week.body': 'Một tuần để trả lời một khiếu nại.',
  'action.ban.duration.month': '30 ngày',
  'action.ban.duration.month.body': 'Một tháng im lặng bắt buộc.',
  'action.ban.duration.quarter': '90 ngày',
  'action.ban.duration.quarter.body':
    'Thời hạn dài nhất mà bảng điều khiển đưa ra. Dài hơn nữa thì hãy đình chỉ vô thời hạn.',
  'action.ban.done': 'Đã đình chỉ tài khoản',
  'action.ban.done.body':
    '{name} đã bị thoát khỏi mọi nơi và không đăng nhập được.',

  'action.unban.item': 'Gỡ đình chỉ',
  'action.unban.title': 'Gỡ đình chỉ cho {name}',
  'action.unban.body':
    'Tài khoản đăng nhập lại được ngay từ lần thử kế tiếp. Không phiên cũ nào quay lại.',
  'action.unban.confirm': 'Gỡ đình chỉ',
  'action.unban.done': 'Đã gỡ đình chỉ',
  'action.unban.done.body':
    '{name} lại đăng nhập được. Không phiên nào được khôi phục.',

  'action.delete.item': 'Xoá tài khoản',
  'action.delete.self':
    'Không dùng cho chính tài khoản bạn — từ đó thì không có đường quay lại.',
  'action.delete.title': 'Xoá {name}',
  'action.delete.body':
    'Tài khoản, các phiên của nó và mọi thông tin xác thực gắn với nó đều biến mất. Việc này không thể hoàn tác.',
  'action.delete.confirm': 'Xoá tài khoản',
  'action.delete.note':
    'Những gì người này tạo ra bên trong một không gian làm việc vẫn thuộc về không gian sở hữu chúng. Đình chỉ thay vì xoá sẽ giữ lại dấu vết mà chỉ thu hồi quyền truy cập.',
  'action.delete.done': 'Đã xoá tài khoản',
  'action.delete.done.body':
    '{name} và mọi thứ gắn với tài khoản ấy đều đã biến mất.',

  'session.revoke.label': 'Kết thúc phiên trên {device}',
  'session.revoke.title': 'Kết thúc phiên này',
  'session.revoke.body':
    '{device} sẽ phải đăng nhập lại ngay ở yêu cầu kế tiếp. Nếu đây chính là phiên bạn đang đọc dòng này, bạn cũng sẽ thoát ra cùng nó.',
  'session.revoke.confirm': 'Kết thúc phiên',
  'session.revoke.done': 'Đã kết thúc phiên',
  'session.revoke.done.body':
    'Thiết bị sẽ phải đăng nhập lại ở yêu cầu kế tiếp.',

  /* --------------------------------------------- lượt chạy của tác nhân -- */

  'runs.error.title': 'Sổ đăng ký lượt chạy không trả lời',
  'runs.origin.local': 'Máy cục bộ',
  'runs.origin.githubActions': 'Hành động GitHub',
  'runs.stat.live': 'Lượt chạy đang sống',
  'runs.stat.live.none': 'Lúc này không có gì đang được dựng',
  'runs.stat.live.some': 'Nhịp đập chống lại hợp đồng thuê năm phút',
  'runs.stat.issues': 'Vấn đề đang bị giữ',
  'runs.stat.issues.caption':
    'Mỗi vấn đề được thuê bởi một lượt chạy, cùng tổ tiên và con cháu của nó',
  'runs.stat.orphans': 'Nhánh mồ côi',
  'runs.stat.orphans.none': 'Không có phần việc nào vô chủ',
  'runs.stat.orphans.some':
    'Những commit của một lượt chạy đã dừng, đang chờ người nhận',
  'runs.live.empty.title': 'Chưa lượt chạy nào được đăng ký',
  'runs.live.empty.body':
    'Một lượt chạy hiện ra ở đây ngay khi tự đăng ký — từ máy này, từ máy khác, hay từ một máy chạy của GitHub — kèm những vấn đề nó đã giữ.',
  'runs.holds.nothing': 'không giữ gì cả',
  'runs.holds': 'đang giữ {issues}',
  'runs.uptime': 'chạy được {elapsed} · {lease}',
  'runs.lease.expired': 'hợp đồng thuê đã hết hạn',
  'runs.lease.left': 'còn {elapsed}',
  'runs.wip.label': 'Việc đang làm dở',
  'runs.wip.empty.title': 'Không nhánh nào mang việc',
  'runs.wip.empty.body':
    'Một lượt chạy ghi lại nhánh của mình ngay khi có commit trên đó; nhờ vậy nếu nó chết, lượt chạy kế tiếp nhận vấn đề sẽ được trao phần việc này thay vì bắt đầu lại từ đầu.',
  'runs.wip.orphaned': 'Mồ côi',
  'runs.wip.meta': {
    other: '{commits} commit · {elapsed} trước',
  },
  'runs.recent.label': 'Vừa kết thúc gần đây',
  'runs.recent.empty.title': 'Chưa lượt chạy nào kết thúc',
  'runs.recent.empty.body':
    'Năm mươi lượt chạy gần nhất ở lại đây, kèm theo cách mỗi lượt kết thúc.',
  'runs.ago': '{elapsed} trước',
  'runs.notCoordinator.title': 'Bản triển khai này không điều phối đội',
  'runs.notCoordinator.body':
    'Sổ đăng ký lượt chạy chỉ gắn với môi trường dàn dựng, và đó là cố ý: một sổ thứ hai sẽ khiến cả hai đội đều tin rằng hàng đợi nằm trong tay mình — đúng cái điều duy nhất mà nó sinh ra để ngăn lại. Hãy xem đội ở môi trường dàn dựng.',
} satisfies TranslationOf<typeof En>

export default messages
