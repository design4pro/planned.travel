/**
 * The sign-in, sign-up, recovery and invitation screens, in Simplified Chinese.
 *
 * Authored from `../en/auth`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Chinese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. Punctuation is mainland convention — full-width ，。（） and the
 * enumeration comma 、 — and the vocabulary is mainland too: 设置, 登录, 文件,
 * 默认.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  'shell.home': 'planned.travel 首页',
  'shell.legal': '继续即表示你同意 planned.travel 的服务条款与隐私声明。',
  'panel.eyebrow': '一起计划',
  'panel.heading': '每一趟旅行，从第一枚图钉到最后一张明信片。',
  'panel.body':
    '在真实地图上共享的行程、真能对得上的预算、会替你记住东西的行李清单，还有一份值得留着的旅行日志。',
  'panel.map.title': '一张地图，一份计划',
  'panel.map.detail': '把每个落脚点、住宿和交通都放进同一份行程。',
  'panel.group.title': '所有人步调一致',
  'panel.group.detail': '编辑、投票和评论都会实时送到每个人眼前。',
  'panel.costs.title': '账目对得上',
  'panel.costs.detail': '共享预算、结清余额，不用再开表格。',
  'divider.or': '或者',
  'divider.orEmail': '或者用邮箱',
  'social.continue': '使用{provider}继续',
  'social.signUp': '使用{provider}注册',
  'social.opening': '正在打开{provider}',
  'passkey.action': '用通行密钥登录',
  'passkey.waiting': '正在等待你的设备',
  'password.show': '显示密码',
  'password.hide': '隐藏密码',
  'password.showNew': '显示新密码',
  'password.hideNew': '隐藏新密码',
  'password.showConfirm': '显示确认密码',
  'password.hideConfirm': '隐藏确认密码',
  'field.email': '邮箱地址',
  'field.email.placeholder': 'yourname@example.com',
  'field.password': '密码',
  'field.password.placeholder': '你的密码',
  'field.newPassword': '新密码',
  'field.newPassword.placeholder': '一句你记得住的话',
  'field.confirmPassword': '确认密码',
  'field.confirmNewPassword': '确认新密码',
  'field.confirmPassword.placeholder': '请再输入一次',
  'field.name': '你的名字',
  'field.name.hint': '会展示给和你一起计划行程的人。',
  'field.name.placeholder': '李明',
  'validation.emailRequired': '请输入邮箱地址。',
  'validation.emailTooLong': '这个邮箱地址太长了。',
  'validation.emailInvalid': '这看起来不像一个邮箱地址。',
  'validation.passwordRequired': '请输入密码。',
  'validation.passwordShort': {
    other: '请至少用 {value} 个字符——一句短句子比一个刁钻的单词更牢靠。',
  },
  'validation.passwordLong': { other: '请控制在 {value} 个字符以内。' },
  'validation.passwordMismatch': '两次输入的密码不一致。',
  'validation.nameShort': '请填上名字，让同行的人知道你是谁。',
  'validation.nameTooLong': '这个名字太长了。',
  'validation.termsRequired': '请先接受服务条款再继续。',
  'validation.codeLength': '验证器的验证码是六位数字。',
  'validation.codeDigits': '验证器的验证码只有数字。',
  'validation.backupShort': '这个备用码看起来太短了。',
  'validation.backupLong': '这个备用码看起来太长了。',
  'login.eyebrow': '欢迎回来',
  'login.heading': '登录 planned.travel',
  'login.description': '行程、预算和清单都停在你离开的地方，接着来就好。',
  'login.newHere': '第一次来？',
  'login.createAccount': '创建账号',
  'login.forgot': '忘记密码？',
  'login.remember': '在这台设备上保持登录',
  'login.submit': '登录',
  'login.submitting': '正在为你登录',
  'register.eyebrow': '创建你的账号',
  'register.heading': '几分钟就能开始计划',
  'register.description':
    '一个账号管住每一趟旅行、每一位同行的人和每一份清单。',
  'register.haveAccount': '已经有账号了？',
  'register.signIn': '登录',
  'register.terms': '我同意服务条款与隐私声明。',
  'register.submit': '创建账号',
  'register.submitting': '正在创建你的账号',
  'strength.hint': {
    other: '至少 {value} 个字符。一句短句子比一个刁钻的单词更牢靠。',
  },
  'strength.tooShort': '强度：太短',
  'strength.weak': '强度：弱',
  'strength.fair': '强度：一般',
  'strength.strong': '强度：强',
  'strength.excellent': '强度：很强',
  'forgot.eyebrow': '密码帮助',
  'forgot.heading': '重设你的密码',
  'forgot.description':
    '告诉我们账号用的邮箱地址，我们会发一封邮件，里面有设置新密码的链接。',
  'forgot.submit': '把重设链接发给我',
  'forgot.submitting': '正在发送链接',
  'forgot.back': '返回登录',
  'forgot.sent.eyebrow': '请查收邮箱',
  'forgot.sent.heading': '重设链接已经在路上',
  'forgot.sent.description':
    '如果有账号用的是 {email}，设置新密码的链接现在就在那个邮箱里。',
  'forgot.sent.title': '链接只在一小时内有效，且只能用一次',
  'forgot.sent.body':
    '什么都没收到？先看看垃圾邮件，再重新发一次。重新申请会让上一个链接悄悄作废。',
  'forgot.sent.resend': '再发一次',
  'forgot.sent.resending': '正在重新发送',
  'forgot.sent.change': '换一个邮箱',
  'reset.eyebrow': '重设密码',
  'reset.heading': '设一个新密码',
  'reset.description': {
    other: '请选一个至少 {value} 个字符的密码。短句子好记，也更难被猜到。',
  },
  'reset.submit': '设置新密码',
  'reset.submitting': '正在保存密码',
  'reset.back': '返回登录',
  'reset.stale.heading': '这个链接不能用了',
  'reset.stale.description':
    '重设链接一小时后失效，而且只能用一次——这是最稳妥的取舍。',
  'reset.stale.action': '申请新链接',
  'reset.done.heading': '新密码已经设好',
  'reset.done.description':
    '其他所有会话都已退出登录，知道旧密码的人也再没有入口。',
  'reset.done.title': '已在其他设备退出登录',
  'reset.done.body': '用新密码登录，接着计划下一趟。',
  'reset.done.action': '登录',
  'twoFactor.eyebrow': '两步验证',
  'twoFactor.heading': '确认是你本人',
  'twoFactor.description':
    '这个账号有第二重保护。请输入验证器应用里当前显示的验证码。',
  'twoFactor.back': '从登录重新开始',
  'twoFactor.methods': '验证方式',
  'twoFactor.totp.tab': '验证器应用',
  'twoFactor.totp.label': '六位验证码',
  'twoFactor.totp.hint': '验证码每 30 秒换一次。',
  'twoFactor.totp.submit': '验证并继续',
  'twoFactor.backup.tab': '备用码',
  'twoFactor.backup.label': '备用码',
  'twoFactor.backup.hint':
    '来自你开启两步验证时保存的那份清单，每个码只能用一次。',
  'twoFactor.backup.submit': '使用备用码',
  'twoFactor.submitting': '正在核对验证码',
  'twoFactor.trust.label': '在这台设备上信任 30 天',
  'twoFactor.trust.detail':
    '在那之前，这个浏览器会跳过这一步。只在完全属于你自己的设备上这么做。',
  'verify.done.eyebrow': '邮箱已确认',
  'verify.done.heading': '一切就绪',
  'verify.done.description':
    '地址已经验证，邀请、提醒和行程摘要都能送到你手上。',
  'verify.done.title': '已验证',
  'verify.done.body': '{email} 已在这个账号上确认。',
  'verify.done.bodyUnknown': '你的邮箱地址已在这个账号上确认。',
  'verify.done.action': '前往我的面板',
  'verify.pending.eyebrow': '还差一步',
  'verify.pending.heading': '确认你的邮箱地址',
  'verify.pending.description':
    '我们已把确认链接发到 {email}。打开它，账号就能找回，同行的人也能邀请你。',
  'verify.pending.wrongAddress': '地址不对？',
  'verify.pending.changeIt': '在设置里改',
  'verify.pending.title': '链接有效期 24 小时',
  'verify.pending.body': '邮箱里什么都没有？先看看垃圾邮件，再重新发一次。',
  'verify.pending.resentTitle': '刚刚又发了一次',
  'verify.pending.resentBody': '等一分钟，再看看收件箱和垃圾邮件。',
  'verify.pending.resend': '重新发送确认邮件',
  'verify.pending.resending': '正在重新发送',
  'verify.pending.continue': '先继续使用',
  'verify.request.eyebrow': '邮箱确认',
  'verify.request.heading': '发一个新的确认链接',
  'verify.request.description':
    '确认链接有效期 24 小时，且只能用一次。留下地址，新的链接马上就发。',
  'verify.request.submit': '发送确认链接',
  'verify.request.submitting': '正在发送链接',
  'verify.request.sentTitle': '已经出发',
  'verify.request.sentBody':
    '如果那个地址上有账号还等着确认，链接现在就在它的收件箱里。',
  'verify.request.change': '换一个邮箱',
  'verify.request.back': '返回登录',
  'invitation.eyebrow': '工作区邀请',
  'invitation.heading': '加入{workspace}',
  'invitation.description':
    '接受后你会成为这个工作区的成员，它的行程、预算和清单都会与你共享。',
  'invitation.invitedAs': '以 {email} 受邀',
  'invitation.role': '你的角色',
  'invitation.means': '意味着',
  'invitation.invitedBy': '邀请人',
  'invitation.expires': '有效期至',
  'invitation.accept': '接受邀请',
  'invitation.accepting': '正在加入工作区',
  'invitation.decline': '拒绝',
  'invitation.declining': '正在拒绝',
  'invitation.reassurance':
    '你随时可以在工作区设置里离开，在它之外创建的东西永远不会被共享。',
  'invitation.role.owner': '所有者——掌管一切，包括账单',
  'invitation.role.admin': '管理员——管理行程、成员和设置',
  'invitation.role.member': '成员——和大家一起计划行程',
  'invitation.role.other': '{role}——权限由工作区所有者设定',
  'invitation.role.badge.owner': '所有者',
  'invitation.role.badge.admin': '管理员',
  'invitation.role.badge.member': '成员',
  'invitation.anonymous.heading': '登录后即可查看邀请',
  'invitation.anonymous.description':
    '邀请与发送时的邮箱地址绑定，所以要先知道你是谁，才能把这封邀请给你看。',
  'invitation.anonymous.body':
    '请用收到邀请的那个地址登录，随后我们会把你直接带回这里。',
  'invitation.anonymous.action': '登录后继续',
  'invitation.anonymous.noAccount': '还没有账号？',
  'invitation.anonymous.register': '用受邀的地址创建一个',
  'invitation.mismatch.heading': '这封邀请是发给另一个地址的',
  'invitation.mismatch.description':
    '你现在登录的是别的账号，所以这封邀请不该由你接受。',
  'invitation.mismatch.title': '当前登录：{email}',
  'invitation.mismatch.body':
    '退出后用收到邀请的地址重新登录，或者让对方给这个账号再发一封邀请。',
  'invitation.mismatch.action': '切换账号',
  'invitation.mismatch.back': '返回登录',
  'invitation.unverified.heading': '确认邮箱后才能加入',
  'invitation.unverified.description':
    '工作区只接受已确认的地址，谁也不会因为一个笔误被拉进来。',
  'invitation.unverified.title': '{email} 还没有确认',
  'invitation.unverified.body':
    '打开邮箱里的确认链接，然后回到这个页面。邀请会一直等着你。',
  'invitation.unverified.action': '确认我的邮箱',
  'invitation.unverified.resend': '重新发送确认邮件',
  'invitation.unavailable.heading': '这封邀请已经不能用了',
  'invitation.unavailable.description':
    '邀请的有效期是七天，一旦被使用或被撤回也会立刻失效。',
  'invitation.unavailable.title': '这里没有可接受的邀请',
  'invitation.unavailable.body':
    '请邀请你的人重新发一封，这个页面会立刻显示出来。',
  'invitation.unavailable.dashboard': '前往我的面板',
  'invitation.declined.eyebrow': '已拒绝邀请',
  'invitation.declined.heading': '没关系——什么都没有被共享',
  'invitation.declined.description':
    '工作区所有者已经知道了，这个链接也不能再用。',
  'invitation.declined.action': '前往我的面板',
  'error.unexpected.title': '出了点问题',
  'error.unexpected.detail': '这次没成功。请稍后再试一次。',
  'error.rateLimited.title': '尝试次数太多',
  'error.rateLimited.detail':
    '为了安全，这台设备的登录已暂停几分钟。请过一会儿再试。',
  'error.offline.title': '没有网络连接',
  'error.offline.detail': '我们连不上 planned.travel。请检查网络后再试一次。',
  'error.credentials.title': '这些信息对不上',
  'error.credentials.detail':
    '请核对邮箱地址和密码后再试。如果当初用 Google 或 Apple 注册，请改用上面的按钮。',
  'error.password.title': '这些信息对不上',
  'error.password.detail': '请核对邮箱地址和密码后再试一次。',
  'error.noPassword.title': '这个账号没有设密码',
  'error.noPassword.detail':
    '这个账号用第三方登录或通行密钥登录，请从上面的选项里选一个。',
  'error.unverified.title': '请先确认邮箱',
  'error.unverified.detail': '注册时我们给你发过确认链接。打开它，再回到这里。',
  'error.emailTaken.title': '这个邮箱已经注册过了',
  'error.emailTaken.detail': '直接登录就好，忘了密码就重设一个。',
  'error.noAccount.title': '找不到这个账号',
  'error.noAccount.detail': '请核对地址，或者创建一个新账号。',
  'error.passwordTooShort.title': '密码太短',
  'error.passwordTooShort.detail': '请换一句更长的密码再试一次。',
  'error.passwordTooLong.title': '密码太长',
  'error.passwordTooLong.detail': '请换一句更短的密码再试一次。',
  'error.linkSpent.title': '这个链接已经失效',
  'error.linkSpent.detail':
    '密码链接只能用一次。重新申请，我们马上发一封新的给你。',
  'error.linkExpired.title': '这个链接已过期',
  'error.linkExpired.detail': '重新申请一个，我们马上发给你。',
  'error.linkIncomplete.title': '这个链接不完整',
  'error.linkIncomplete.detail':
    '重设密码的链接带着一次性令牌。请打开最新的那封邮件，或者重新申请一个链接。',
  'error.sessionExpired.title': '登录状态已过期',
  'error.sessionExpired.detail': '重新登录就能接着刚才的地方继续。',
  'error.alreadyVerified.title': '早已确认',
  'error.alreadyVerified.detail': '这个邮箱地址已经验证过了，照常登录即可。',
  'error.badCode.title': '这个验证码不对',
  'error.badCode.detail':
    '验证器的验证码只有 30 秒。等下一个出现，再把六位数字都填上。',
  'error.badBackupCode.title': '这个备用码不对',
  'error.badBackupCode.detail':
    '每个备用码只能用一次。请试试清单里还没用过的下一个。',
  'error.locked.title': '账号已暂时锁定',
  'error.locked.detail': '验证失败太多次。为了安全，这个账号会锁定几分钟。',
  'error.twoFactorOn.title': '双重验证已开启',
  'error.twoFactorOn.detail':
    '重新设置会导致当前的身份验证器失效，因此未作任何更改。你可以在此管理。',
  'error.noTwoFactor.title': '还没有设置两步验证',
  'error.noTwoFactor.detail': '用邮箱和密码登录就能继续。',
  'error.twoFactorExpired.title': '请从登录重新开始',
  'error.twoFactorExpired.detail':
    '这一步验证已经超时。请再输入一次邮箱和密码。',
  'error.invitationGone.title': '这封邀请已经不能用了',
  'error.invitationGone.detail':
    '它可能过期、被撤回，或者已经被用过了。请对方再发一封邀请。',
  'error.invitationOther.title': '这封邀请是发给别人的',
  'error.invitationOther.detail':
    '它发给了另一个邮箱地址。用那个地址登录就能接受。',
  'error.alreadyMember.title': '你已经在这个工作区里了',
  'error.alreadyMember.detail':
    '没有需要接受的邀请——从工作区切换菜单打开它就好。',
  'error.workspaceFull.title': '这个工作区已经满了',
  'error.workspaceFull.detail':
    '成员数已到上限。请所有者腾出一个席位，或者升级方案。',
  'error.verifyBeforeJoin.title': '请先确认邮箱',
  'error.verifyBeforeJoin.detail':
    '打开我们发给你的确认链接，然后回到这封邀请。',

  'passkeyNotice.added': '你的账户已添加通行密钥',
  'passkeyNotice.removed': '你的账户已移除通行密钥',
  'passkeyNotice.security': '安全',
  'passkeyNotice.action': '管理通行密钥',
  'passkeyNotice.recovery':
    '如果你不认识此更改，请更改密码并结束不熟悉的会话。重置密码不会移除通行密钥。请检查通行密钥并移除不认识的密钥。',
} satisfies TranslationOf<typeof En>

export default messages
