/**
 * The sign-in, sign-up, recovery and invitation screens, in Vietnamese.
 *
 * Authored from `../en/auth`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * These are the only screens a traveller reaches with no session, so the
 * language is negotiated from `Accept-Language` alone and there is no stored
 * preference to correct a bad guess with. Two thirds of the keys are validation
 * and failure copy, read at the worst possible moment — so they are whole
 * sentences with the subject restored, because Vietnamese error copy that drops
 * the pronoun reads as a machine talking to itself.
 *
 * Vietnamese does not inflect for number, so `Intl.PluralRules` reports the
 * single category `other` and each `one`/`other` pair collapses to one branch.
 * `{value}` still arrives already grouped for the locale.
 *
 * **Terms this catalogue fixes.** `mật khẩu` for a password, `khóa truy cập`
 * for a passkey rather than the untranslated English, `không gian làm việc` for
 * a workspace, `bạn đồng hành` for a trip-mate. The placeholder address and the
 * placeholder name are localised together — `ban@vidu.com` and
 * `Nguyễn Minh Anh` read as one person, and the address stays unaccented
 * because a mailbox is ASCII. The provider names in `social.*` are trademarks
 * and arrive as data.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  'shell.home': 'Trang chủ planned.travel',
  'shell.legal':
    'Khi tiếp tục, bạn đồng ý với điều khoản dịch vụ và thông báo quyền riêng tư của planned.travel.',

  'panel.eyebrow': 'Cùng nhau lên kế hoạch',
  'panel.heading':
    'Mọi chuyến đi, từ chiếc ghim đầu tiên đến tấm bưu thiếp cuối cùng.',
  'panel.body':
    'Lịch trình chung trên bản đồ thật, ngân sách khớp đến từng đồng, danh sách hành lý không quên gì, và một cuốn nhật ký đáng giữ.',
  'panel.map.title': 'Một bản đồ, một lịch trình',
  'panel.map.detail':
    'Mọi điểm dừng, chỗ ở và chặng nối trong cùng một lịch trình.',
  'panel.group.title': 'Cả nhóm cùng nhịp',
  'panel.group.detail':
    'Chỉnh sửa, bình chọn và bình luận tới cả nhóm ngay lập tức.',
  'panel.costs.title': 'Chi phí khớp nhau',
  'panel.costs.detail':
    'Ngân sách chung, các khoản chia xong xuôi, không cần bảng tính.',

  'divider.or': 'hoặc',
  'divider.orEmail': 'hoặc dùng email của bạn',

  'social.continue': 'Tiếp tục với {provider}',
  'social.signUp': 'Đăng ký với {provider}',
  'social.opening': 'Đang mở {provider}',

  'passkey.action': 'Đăng nhập bằng khóa truy cập',
  'passkey.waiting': 'Đang chờ thiết bị của bạn',

  'password.show': 'Hiện mật khẩu',
  'password.hide': 'Ẩn mật khẩu',
  'password.showNew': 'Hiện mật khẩu mới',
  'password.hideNew': 'Ẩn mật khẩu mới',
  'password.showConfirm': 'Hiện phần xác nhận mật khẩu',
  'password.hideConfirm': 'Ẩn phần xác nhận mật khẩu',

  'field.email': 'Địa chỉ email',
  'field.email.placeholder': 'ban@vidu.com',
  'field.password': 'Mật khẩu',
  'field.password.placeholder': 'Mật khẩu của bạn',
  'field.newPassword': 'Mật khẩu mới',
  'field.newPassword.placeholder': 'Một câu bạn sẽ nhớ',
  'field.confirmPassword': 'Xác nhận mật khẩu',
  'field.confirmNewPassword': 'Xác nhận mật khẩu mới',
  'field.confirmPassword.placeholder': 'Gõ lại một lần nữa',
  'field.name': 'Tên của bạn',
  'field.name.hint':
    'Hiện với những người cùng lên kế hoạch chuyến đi với bạn.',
  'field.name.placeholder': 'Nguyễn Minh Anh',

  'validation.emailRequired': 'Hãy nhập địa chỉ email của bạn.',
  'validation.emailTooLong': 'Địa chỉ email đó quá dài.',
  'validation.emailInvalid': 'Cái đó không giống một địa chỉ email.',
  'validation.passwordRequired': 'Hãy nhập mật khẩu của bạn.',
  'validation.passwordShort': {
    other:
      'Dùng ít nhất {value} ký tự — một câu ngắn tốt hơn một từ khôn khéo.',
  },
  'validation.passwordLong': { other: 'Giữ dưới {value} ký tự.' },
  'validation.passwordMismatch': 'Hai mật khẩu đó không khớp nhau.',
  'validation.nameShort': 'Nhập tên của bạn để bạn đồng hành biết bạn là ai.',
  'validation.nameTooLong': 'Tên đó quá dài.',
  'validation.termsRequired': 'Hãy chấp nhận điều khoản để tiếp tục.',
  'validation.codeLength': 'Mã xác thực gồm sáu chữ số.',
  'validation.codeDigits': 'Mã xác thực chỉ gồm chữ số.',
  'validation.backupShort': 'Mã dự phòng đó trông hơi ngắn.',
  'validation.backupLong': 'Mã dự phòng đó trông hơi dài.',

  'login.eyebrow': 'Chào bạn trở lại',
  'login.heading': 'Đăng nhập planned.travel',
  'login.description':
    'Tiếp tục lịch trình, ngân sách và danh sách đúng chỗ bạn dừng lại.',
  'login.newHere': 'Lần đầu ghé qua?',
  'login.createAccount': 'Tạo tài khoản',
  'login.forgot': 'Quên mật khẩu?',
  'login.remember': 'Giữ đăng nhập trên thiết bị này',
  'login.submit': 'Đăng nhập',
  'login.submitting': 'Đang đưa bạn vào',

  'register.eyebrow': 'Tạo tài khoản của bạn',
  'register.heading': 'Bắt đầu lên kế hoạch trong vài phút',
  'register.description':
    'Một tài khoản đủ cho mọi chuyến đi, mọi bạn đồng hành và mọi danh sách.',
  'register.haveAccount': 'Đã có tài khoản?',
  'register.signIn': 'Đăng nhập',
  'register.terms':
    'Tôi đồng ý với điều khoản dịch vụ và thông báo quyền riêng tư.',
  'register.submit': 'Tạo tài khoản',
  'register.submitting': 'Đang tạo tài khoản của bạn',

  'strength.hint': {
    other: 'Ít nhất {value} ký tự. Một câu ngắn tốt hơn một từ khôn khéo.',
  },
  'strength.tooShort': 'Độ mạnh: Quá ngắn',
  'strength.weak': 'Độ mạnh: Yếu',
  'strength.fair': 'Độ mạnh: Tạm ổn',
  'strength.strong': 'Độ mạnh: Mạnh',
  'strength.excellent': 'Độ mạnh: Rất mạnh',

  'forgot.eyebrow': 'Trợ giúp mật khẩu',
  'forgot.heading': 'Đặt lại mật khẩu của bạn',
  'forgot.description':
    'Cho chúng tôi biết địa chỉ trên tài khoản của bạn, chúng tôi sẽ gửi email một liên kết để đặt mật khẩu mới.',
  'forgot.submit': 'Gửi cho tôi liên kết đặt lại',
  'forgot.submitting': 'Đang gửi liên kết cho bạn',
  'forgot.back': 'Về trang đăng nhập',
  'forgot.sent.eyebrow': 'Kiểm tra hộp thư',
  'forgot.sent.heading': 'Liên kết của bạn đang trên đường tới',
  'forgot.sent.description':
    'Nếu có tài khoản dùng {email}, liên kết để chọn mật khẩu mới đang nằm trong hộp thư đó.',
  'forgot.sent.title': 'Liên kết dùng được một lần, trong một giờ',
  'forgot.sent.body':
    'Chưa thấy gì? Xem thư rác, rồi gửi lại. Xin liên kết mới sẽ lặng lẽ vô hiệu liên kết cũ.',
  'forgot.sent.resend': 'Gửi lại',
  'forgot.sent.resending': 'Đang gửi lại',
  'forgot.sent.change': 'Dùng email khác',

  'reset.eyebrow': 'Đặt lại mật khẩu',
  'reset.heading': 'Chọn mật khẩu mới',
  'reset.description': {
    other:
      'Chọn một mật khẩu dài ít nhất {value} ký tự. Một câu ngắn vừa dễ nhớ vừa khó đoán.',
  },
  'reset.submit': 'Lưu mật khẩu mới',
  'reset.submitting': 'Đang lưu mật khẩu của bạn',
  'reset.back': 'Về trang đăng nhập',
  'reset.stale.heading': 'Liên kết đó không dùng được',
  'reset.stale.description':
    'Liên kết đặt lại hết hạn sau một giờ và chỉ dùng được một lần — đánh đổi an toàn nhất có thể.',
  'reset.stale.action': 'Xin liên kết mới',
  'reset.done.heading': 'Mật khẩu mới của bạn đã có hiệu lực',
  'reset.done.description':
    'Mọi phiên khác đã bị đăng xuất, nên ai từng biết mật khẩu cũ cũng không còn đường vào.',
  'reset.done.title': 'Đã đăng xuất ở mọi nơi khác',
  'reset.done.body': 'Đăng nhập bằng mật khẩu mới để tiếp tục lên kế hoạch.',
  'reset.done.action': 'Đăng nhập',

  'twoFactor.eyebrow': 'Xác minh hai bước',
  'twoFactor.heading': 'Xác nhận đúng là bạn',
  'twoFactor.description':
    'Tài khoản của bạn được bảo vệ bằng một bước thứ hai. Nhập mã hiện tại trong ứng dụng xác thực.',
  'twoFactor.back': 'Bắt đầu lại từ trang đăng nhập',
  'twoFactor.methods': 'Cách xác minh',
  'twoFactor.totp.tab': 'Ứng dụng xác thực',
  'twoFactor.totp.label': 'Mã sáu chữ số',
  'twoFactor.totp.hint': 'Mã đổi mới mỗi 30 giây.',
  'twoFactor.totp.submit': 'Xác minh rồi tiếp tục',
  'twoFactor.backup.tab': 'Mã dự phòng',
  'twoFactor.backup.label': 'Mã dự phòng',
  'twoFactor.backup.hint':
    'Lấy từ danh sách bạn đã lưu khi bật xác minh hai bước. Mỗi mã dùng được một lần.',
  'twoFactor.backup.submit': 'Dùng mã dự phòng',
  'twoFactor.submitting': 'Đang kiểm tra mã của bạn',
  'twoFactor.trust.label': 'Tin thiết bị này trong 30 ngày',
  'twoFactor.trust.detail':
    'Bỏ qua bước này trên trình duyệt này cho tới lúc đó. Chỉ làm vậy với thiết bị của riêng bạn.',

  'verify.done.eyebrow': 'Đã xác nhận email',
  'verify.done.heading': 'Xong hết rồi',
  'verify.done.description':
    'Địa chỉ của bạn đã được xác minh, nên lời mời, lời nhắc và bản tóm tắt chuyến đi sẽ tới được bạn.',
  'verify.done.title': 'Đã xác minh',
  'verify.done.body': '{email} đã được xác nhận trên tài khoản này.',
  'verify.done.bodyUnknown':
    'Địa chỉ email của bạn đã được xác nhận trên tài khoản này.',
  'verify.done.action': 'Tới bảng điều khiển',

  'verify.pending.eyebrow': 'Còn một việc cuối',
  'verify.pending.heading': 'Xác nhận địa chỉ email của bạn',
  'verify.pending.description':
    'Chúng tôi đã gửi một liên kết xác nhận tới {email}. Mở nó để tài khoản luôn khôi phục được và để bạn đồng hành mời được bạn.',
  'verify.pending.wrongAddress': 'Sai địa chỉ?',
  'verify.pending.changeIt': 'Đổi trong cài đặt',
  'verify.pending.title': 'Liên kết có hiệu lực 24 giờ',
  'verify.pending.body': 'Hộp thư chưa có gì? Xem thư rác, rồi gửi lại.',
  'verify.pending.resentTitle': 'Vừa gửi lại xong',
  'verify.pending.resentBody':
    'Đợi một phút, rồi xem hộp thư — và cả mục thư rác.',
  'verify.pending.resend': 'Gửi lại xác nhận',
  'verify.pending.resending': 'Đang gửi lại',
  'verify.pending.continue': 'Cứ tiếp tục',

  'verify.request.eyebrow': 'Xác nhận email',
  'verify.request.heading': 'Gửi liên kết xác nhận mới',
  'verify.request.description':
    'Liên kết xác nhận có hiệu lực 24 giờ và chỉ dùng một lần. Cho biết địa chỉ của bạn, liên kết mới sẽ tới ngay.',
  'verify.request.submit': 'Gửi liên kết xác nhận',
  'verify.request.submitting': 'Đang gửi liên kết cho bạn',
  'verify.request.sentTitle': 'Đang trên đường',
  'verify.request.sentBody':
    'Nếu địa chỉ đó có tài khoản đang chờ xác nhận, liên kết đã nằm trong hộp thư.',
  'verify.request.change': 'Dùng email khác',
  'verify.request.back': 'Về trang đăng nhập',

  'invitation.eyebrow': 'Lời mời vào không gian làm việc',
  'invitation.heading': 'Tham gia {workspace}',
  'invitation.description':
    'Nhận lời mời sẽ thêm bạn vào không gian này và chia sẻ các chuyến đi, ngân sách cùng danh sách của nó với bạn.',
  'invitation.invitedAs': 'Được mời với địa chỉ {email}',
  'invitation.role': 'Vai trò của bạn',
  'invitation.means': 'Nghĩa là',
  'invitation.invitedBy': 'Người mời',
  'invitation.expires': 'Hết hạn',
  'invitation.accept': 'Nhận lời mời',
  'invitation.accepting': 'Đang tham gia không gian làm việc',
  'invitation.decline': 'Từ chối',
  'invitation.declining': 'Đang từ chối',
  'invitation.reassurance':
    'Bạn có thể rời một không gian bất cứ lúc nào trong phần cài đặt của nó, và mọi thứ bạn tạo bên ngoài đều không bị chia sẻ.',

  'invitation.role.owner': 'Chủ sở hữu — toàn quyền, kể cả thanh toán',
  'invitation.role.admin':
    'Quản trị viên — quản lý chuyến đi, thành viên và cài đặt',
  'invitation.role.member': 'Thành viên — lên kế hoạch cùng mọi người',
  'invitation.role.other': '{role} — quyền do chủ sở hữu không gian đặt',
  'invitation.role.badge.owner': 'Chủ sở hữu',
  'invitation.role.badge.admin': 'Quản trị viên',
  'invitation.role.badge.member': 'Thành viên',

  'invitation.anonymous.heading': 'Đăng nhập để xem lời mời',
  'invitation.anonymous.description':
    'Lời mời gắn với địa chỉ email mà nó được gửi tới, nên chúng tôi cần biết bạn là ai trước khi hiện nó ra.',
  'invitation.anonymous.body':
    'Hãy dùng địa chỉ đã nhận lời mời. Chúng tôi sẽ đưa bạn quay lại đây ngay sau đó.',
  'invitation.anonymous.action': 'Đăng nhập để tiếp tục',
  'invitation.anonymous.noAccount': 'Chưa có tài khoản?',
  'invitation.anonymous.register': 'Tạo tài khoản bằng địa chỉ được mời',

  'invitation.mismatch.heading': 'Lời mời này dành cho địa chỉ khác',
  'invitation.mismatch.description':
    'Bạn đang đăng nhập bằng tài khoản khác, nên lời mời này không phải của bạn.',
  'invitation.mismatch.title': 'Đang đăng nhập là {email}',
  'invitation.mismatch.body':
    'Hãy đăng xuất rồi đăng nhập bằng địa chỉ đã nhận lời mời, hoặc xin một lời mời mới cho tài khoản này.',
  'invitation.mismatch.action': 'Đổi tài khoản',
  'invitation.mismatch.back': 'Về trang đăng nhập',

  'invitation.unverified.heading': 'Xác nhận email để tham gia',
  'invitation.unverified.description':
    'Không gian làm việc chỉ nhận địa chỉ đã xác nhận, nên không ai bị thêm vào vì một lỗi gõ nhầm.',
  'invitation.unverified.title': '{email} chưa được xác nhận',
  'invitation.unverified.body':
    'Mở liên kết xác nhận trong hộp thư, rồi quay lại trang này. Lời mời vẫn sẽ chờ bạn.',
  'invitation.unverified.action': 'Xác nhận email của tôi',
  'invitation.unverified.resend': 'Gửi lại thư xác nhận',

  'invitation.unavailable.heading': 'Lời mời này không còn dùng được',
  'invitation.unavailable.description':
    'Lời mời có hiệu lực bảy ngày, và mất hiệu lực ngay khi được dùng hoặc bị thu hồi.',
  'invitation.unavailable.title': 'Không có gì để nhận ở đây',
  'invitation.unavailable.body':
    'Nhờ người đã mời gửi một lời mời mới, trang này sẽ hiện nó ra ngay.',
  'invitation.unavailable.dashboard': 'Tới bảng điều khiển',

  'invitation.declined.eyebrow': 'Đã từ chối lời mời',
  'invitation.declined.heading': 'Không sao — chưa có gì được chia sẻ',
  'invitation.declined.description':
    'Chủ sở hữu không gian đã được báo, và liên kết này không dùng lại được nữa.',
  'invitation.declined.action': 'Tới bảng điều khiển',

  'error.unexpected.title': 'Có gì đó trục trặc',
  'error.unexpected.detail':
    'Việc đó chưa xong. Vui lòng thử lại sau giây lát.',
  'error.rateLimited.title': 'Thử quá nhiều lần',
  'error.rateLimited.detail':
    'Vì an toàn của bạn, chúng tôi tạm dừng đăng nhập từ thiết bị này vài phút. Thử lại sau ít phút nhé.',
  'error.offline.title': 'Không có kết nối',
  'error.offline.detail':
    'Chúng tôi không liên lạc được với planned.travel. Kiểm tra kết nối rồi thử lại.',

  'error.credentials.title': 'Thông tin đó không khớp',
  'error.credentials.detail':
    'Kiểm tra lại địa chỉ email và mật khẩu rồi thử lại. Nếu bạn đăng ký bằng Google hay Apple, hãy dùng nút đó.',
  'error.password.title': 'Thông tin đó không khớp',
  'error.password.detail':
    'Kiểm tra lại địa chỉ email và mật khẩu rồi thử lại.',
  'error.noPassword.title': 'Tài khoản này không có mật khẩu',
  'error.noPassword.detail':
    'Tài khoản này đăng nhập bằng nhà cung cấp mạng xã hội hoặc khóa truy cập. Hãy dùng một trong các lựa chọn ở trên.',
  'error.unverified.title': 'Xác nhận email trước đã',
  'error.unverified.detail':
    'Chúng tôi đã gửi liên kết xác nhận khi bạn đăng ký. Mở nó rồi quay lại đây.',
  'error.emailTaken.title': 'Email đó đã được đăng ký',
  'error.emailTaken.detail':
    'Hãy đăng nhập, hoặc đặt lại mật khẩu nếu bạn quên.',
  'error.noAccount.title': 'Chúng tôi không tìm thấy tài khoản đó',
  'error.noAccount.detail': 'Kiểm tra lại địa chỉ, hoặc tạo tài khoản mới.',
  'error.passwordTooShort.title': 'Mật khẩu quá ngắn',
  'error.passwordTooShort.detail': 'Chọn một câu mật khẩu dài hơn rồi thử lại.',
  'error.passwordTooLong.title': 'Mật khẩu quá dài',
  'error.passwordTooLong.detail': 'Chọn một câu mật khẩu ngắn hơn rồi thử lại.',
  'error.linkSpent.title': 'Liên kết này không còn hiệu lực',
  'error.linkSpent.detail':
    'Liên kết mật khẩu chỉ dùng được một lần. Xin một liên kết mới, chúng tôi sẽ gửi email ngay.',
  'error.linkExpired.title': 'Liên kết này đã hết hạn',
  'error.linkExpired.detail':
    'Xin một liên kết mới, chúng tôi sẽ gửi email ngay.',
  'error.linkIncomplete.title': 'Liên kết này bị thiếu',
  'error.linkIncomplete.detail':
    'Liên kết đặt lại mật khẩu mang theo một mã dùng một lần. Mở email mới nhất, hoặc xin một liên kết mới.',
  'error.sessionExpired.title': 'Phiên của bạn đã hết hạn',
  'error.sessionExpired.detail':
    'Đăng nhập lại để tiếp tục từ chỗ bạn dừng lại.',
  'error.alreadyVerified.title': 'Đã xác nhận rồi',
  'error.alreadyVerified.detail':
    'Địa chỉ email này đã được xác minh. Bạn có thể đăng nhập như bình thường.',
  'error.badCode.title': 'Mã đó không dùng được',
  'error.badCode.detail':
    'Mã xác thực chỉ sống 30 giây. Đợi mã kế tiếp rồi nhập đủ sáu chữ số.',
  'error.badBackupCode.title': 'Mã dự phòng đó không dùng được',
  'error.badBackupCode.detail':
    'Mỗi mã dự phòng chỉ dùng một lần. Thử mã kế tiếp còn nguyên trong danh sách của bạn.',
  'error.locked.title': 'Tài khoản tạm bị khóa',
  'error.locked.detail':
    'Quá nhiều lần xác minh hỏng. Vì an toàn, tài khoản này bị khóa vài phút.',
  'error.noTwoFactor.title': 'Chưa bật xác minh hai bước',
  'error.noTwoFactor.detail':
    'Đăng nhập bằng email và mật khẩu của bạn để tiếp tục.',
  'error.twoFactorExpired.title': 'Bắt đầu lại từ trang đăng nhập',
  'error.twoFactorExpired.detail':
    'Bước xác minh này đã hết hạn. Nhập lại email và mật khẩu của bạn một lần nữa.',
  'error.invitationGone.title': 'Lời mời này không còn dùng được',
  'error.invitationGone.detail':
    'Có thể nó đã hết hạn, bị thu hồi, hoặc đã được dùng. Hãy xin một lời mời mới.',
  'error.invitationOther.title': 'Lời mời này dành cho người khác',
  'error.invitationOther.detail':
    'Nó được gửi tới một địa chỉ email khác. Đăng nhập bằng địa chỉ đó để nhận.',
  'error.alreadyMember.title': 'Bạn đã ở trong không gian này',
  'error.alreadyMember.detail':
    'Không có gì để nhận — hãy mở nó từ ô chuyển không gian làm việc.',
  'error.workspaceFull.title': 'Không gian này đã đầy',
  'error.workspaceFull.detail':
    'Số thành viên đã chạm trần. Nhờ chủ sở hữu nhường một chỗ hoặc nâng gói.',
  'error.verifyBeforeJoin.title': 'Xác nhận email trước đã',
  'error.verifyBeforeJoin.detail':
    'Mở liên kết xác nhận chúng tôi đã gửi, rồi quay lại lời mời này.',
} satisfies TranslationOf<typeof En>

export default messages
