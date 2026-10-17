/**
 * The sign-in, sign-up, recovery and invitation screens, in Traditional Chinese.
 *
 * Authored from `../en/auth`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Chinese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. This is Taiwan usage rather than a character conversion of
 * `../zh-Hans`: 設定 not 设置, 登入 not 登录, 檔案 not 文件, 預設 not 默认, and the
 * corner brackets 「」 where the mainland catalogue quotes with “”.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  'shell.home': 'planned.travel 首頁',
  'shell.legal': '繼續使用即表示你同意 planned.travel 的服務條款與隱私權聲明。',
  'panel.eyebrow': '一起規劃',
  'panel.heading': '每一趟旅行，從第一根圖釘到最後一張明信片。',
  'panel.body':
    '在真實地圖上共用的行程、算得清的預算、會替你記住東西的行李清單，還有一本值得留著的旅行日誌。',
  'panel.map.title': '一張地圖，一份計劃',
  'panel.map.detail': '把每個停留點、住宿和交通都收進同一份行程。',
  'panel.group.title': '所有人步調一致',
  'panel.group.detail': '編輯、投票和留言都會即時送到每個人眼前。',
  'panel.costs.title': '帳目算得清',
  'panel.costs.detail': '共用預算、結清餘額，不必再開試算表。',
  'divider.or': '或者',
  'divider.orEmail': '或者用電子郵件',
  'social.continue': '以{provider}繼續',
  'social.signUp': '以{provider}註冊',
  'social.opening': '正在開啟{provider}',
  'passkey.action': '以密碼金鑰登入',
  'passkey.waiting': '正在等候你的裝置',
  'password.show': '顯示密碼',
  'password.hide': '隱藏密碼',
  'password.showNew': '顯示新密碼',
  'password.hideNew': '隱藏新密碼',
  'password.showConfirm': '顯示確認密碼',
  'password.hideConfirm': '隱藏確認密碼',
  'field.email': '電子郵件地址',
  'field.email.placeholder': 'yourname@example.com',
  'field.password': '密碼',
  'field.password.placeholder': '你的密碼',
  'field.newPassword': '新密碼',
  'field.newPassword.placeholder': '一句你記得住的話',
  'field.confirmPassword': '確認密碼',
  'field.confirmNewPassword': '確認新密碼',
  'field.confirmPassword.placeholder': '請再輸入一次',
  'field.name': '你的名字',
  'field.name.hint': '會顯示給和你一起規劃行程的人。',
  'field.name.placeholder': '陳怡君',
  'validation.emailRequired': '請輸入電子郵件地址。',
  'validation.emailTooLong': '這個電子郵件地址太長了。',
  'validation.emailInvalid': '這看起來不像電子郵件地址。',
  'validation.passwordRequired': '請輸入密碼。',
  'validation.passwordShort': {
    other: '請至少用 {value} 個字元——一句短句子比一個刁鑽的單字更牢靠。',
  },
  'validation.passwordLong': { other: '請控制在 {value} 個字元以內。' },
  'validation.passwordMismatch': '兩次輸入的密碼不一樣。',
  'validation.nameShort': '請填上名字，讓同行的人知道你是誰。',
  'validation.nameTooLong': '這個名字太長了。',
  'validation.termsRequired': '請先接受服務條款再繼續。',
  'validation.codeLength': '驗證器的驗證碼是六位數字。',
  'validation.codeDigits': '驗證器的驗證碼只有數字。',
  'validation.backupShort': '這組備用碼看起來太短了。',
  'validation.backupLong': '這組備用碼看起來太長了。',
  'login.eyebrow': '歡迎回來',
  'login.heading': '登入 planned.travel',
  'login.description': '行程、預算和清單都停在你離開的地方，接著來就好。',
  'login.newHere': '第一次來嗎？',
  'login.createAccount': '建立帳號',
  'login.forgot': '忘記密碼了嗎？',
  'login.remember': '在這台裝置上保持登入',
  'login.submit': '登入',
  'login.submitting': '正在為你登入',
  'register.eyebrow': '建立你的帳號',
  'register.heading': '幾分鐘就能開始規劃',
  'register.description':
    '一個帳號管得住每一趟旅行、每一位同行的人和每一份清單。',
  'register.haveAccount': '已經有帳號了嗎？',
  'register.signIn': '登入',
  'register.terms': '我同意服務條款與隱私權聲明。',
  'register.submit': '建立帳號',
  'register.submitting': '正在建立你的帳號',
  'strength.hint': {
    other: '至少 {value} 個字元。一句短句子比一個刁鑽的單字更牢靠。',
  },
  'strength.tooShort': '強度：太短',
  'strength.weak': '強度：弱',
  'strength.fair': '強度：普通',
  'strength.strong': '強度：強',
  'strength.excellent': '強度：很強',
  'forgot.eyebrow': '密碼協助',
  'forgot.heading': '重設你的密碼',
  'forgot.description':
    '告訴我們帳號用的地址，我們會寄一封信給你，裡面有設定新密碼的連結。',
  'forgot.submit': '把重設連結寄給我',
  'forgot.submitting': '正在寄出連結',
  'forgot.back': '回到登入',
  'forgot.sent.eyebrow': '請查看你的信箱',
  'forgot.sent.heading': '重設連結已經在路上',
  'forgot.sent.description':
    '如果有帳號用的是 {email}，設定新密碼的連結現在就在那個信箱裡。',
  'forgot.sent.title': '連結只在一小時內有效，而且只能用一次',
  'forgot.sent.body':
    '什麼都沒收到嗎？先看看垃圾信件匣，再重新寄一次。重新申請會讓上一個連結靜靜失效。',
  'forgot.sent.resend': '再寄一次',
  'forgot.sent.resending': '正在重新寄出',
  'forgot.sent.change': '換一個電子郵件',
  'reset.eyebrow': '重設密碼',
  'reset.heading': '設一組新密碼',
  'reset.description': {
    other: '請挑一組至少 {value} 個字元的密碼。短句子好記，也更難被猜到。',
  },
  'reset.submit': '設定新密碼',
  'reset.submitting': '正在儲存你的密碼',
  'reset.back': '回到登入',
  'reset.stale.heading': '這個連結不能用了',
  'reset.stale.description':
    '重設連結一小時後失效，而且只能用一次——這是最穩當的取捨。',
  'reset.stale.action': '申請新的連結',
  'reset.done.heading': '新密碼已經設好',
  'reset.done.description':
    '其他所有工作階段都已登出，知道舊密碼的人也再沒有入口。',
  'reset.done.title': '已在其他地方登出',
  'reset.done.body': '用新密碼登入，接著規劃下一趟。',
  'reset.done.action': '登入',
  'twoFactor.eyebrow': '兩步驗證',
  'twoFactor.heading': '確認是你本人',
  'twoFactor.description':
    '這個帳號多了一道保護。請輸入驗證器應用程式上現在顯示的驗證碼。',
  'twoFactor.back': '從登入重新開始',
  'twoFactor.methods': '驗證方式',
  'twoFactor.totp.tab': '驗證器',
  'twoFactor.totp.label': '六位數驗證碼',
  'twoFactor.totp.hint': '驗證碼每 30 秒換一次。',
  'twoFactor.totp.submit': '驗證並繼續',
  'twoFactor.backup.tab': '備用碼',
  'twoFactor.backup.label': '備用碼',
  'twoFactor.backup.hint':
    '來自你開啟兩步驗證時存下的那份清單，每一組只能用一次。',
  'twoFactor.backup.submit': '使用備用碼',
  'twoFactor.submitting': '正在核對驗證碼',
  'twoFactor.trust.label': '信任這台裝置 30 天',
  'twoFactor.trust.detail':
    '在那之前，這個瀏覽器會跳過這一步。只在完全屬於你自己的裝置上這麼做。',
  'verify.done.eyebrow': '電子郵件已確認',
  'verify.done.heading': '一切就緒',
  'verify.done.description':
    '地址已經驗證，邀請、提醒和行程摘要都能送到你手上。',
  'verify.done.title': '已驗證',
  'verify.done.body': '{email} 已在這個帳號上確認。',
  'verify.done.bodyUnknown': '你的電子郵件地址已在這個帳號上確認。',
  'verify.done.action': '前往總覽',
  'verify.pending.eyebrow': '還差一步',
  'verify.pending.heading': '請確認你的電子郵件地址',
  'verify.pending.description':
    '我們把確認連結寄到 {email}。打開它，帳號就找得回來，同行的人也能邀請你。',
  'verify.pending.wrongAddress': '地址不對嗎？',
  'verify.pending.changeIt': '在設定裡改',
  'verify.pending.title': '連結的效期是 24 小時',
  'verify.pending.body': '信箱裡什麼都沒有嗎？先看看垃圾信件匣，再重新寄一次。',
  'verify.pending.resentTitle': '剛剛又寄了一次',
  'verify.pending.resentBody': '等一分鐘，再看看收件匣和垃圾信件匣。',
  'verify.pending.resend': '重新寄出確認信',
  'verify.pending.resending': '正在重新寄出',
  'verify.pending.continue': '先繼續使用',
  'verify.request.eyebrow': '電子郵件確認',
  'verify.request.heading': '寄一個新的確認連結',
  'verify.request.description':
    '確認連結的效期是 24 小時，而且只能用一次。留下地址，新的連結馬上就寄出。',
  'verify.request.submit': '寄出確認連結',
  'verify.request.submitting': '正在寄出連結',
  'verify.request.sentTitle': '已經出發',
  'verify.request.sentBody':
    '如果那個地址上有帳號還等著確認，連結現在就在它的收件匣裡。',
  'verify.request.change': '換一個電子郵件',
  'verify.request.back': '回到登入',
  'invitation.eyebrow': '工作區邀請',
  'invitation.heading': '加入{workspace}',
  'invitation.description':
    '接受之後你會成為這個工作區的成員，它的行程、預算和清單都會與你共用。',
  'invitation.invitedAs': '以 {email} 受邀',
  'invitation.role': '你的角色',
  'invitation.means': '代表',
  'invitation.invitedBy': '邀請人',
  'invitation.expires': '有效期限',
  'invitation.accept': '接受邀請',
  'invitation.accepting': '正在加入工作區',
  'invitation.decline': '婉拒',
  'invitation.declining': '正在婉拒',
  'invitation.reassurance':
    '你隨時可以從工作區設定裡離開，在它之外建立的東西永遠不會被共用。',
  'invitation.role.owner': '擁有者——掌管一切，包含帳務',
  'invitation.role.admin': '管理員——管理行程、成員和設定',
  'invitation.role.member': '成員——和大家一起規劃行程',
  'invitation.role.other': '{role}——權限由工作區擁有者設定',
  'invitation.role.badge.owner': '擁有者',
  'invitation.role.badge.admin': '管理員',
  'invitation.role.badge.member': '成員',
  'invitation.anonymous.heading': '登入後就能看到邀請',
  'invitation.anonymous.description':
    '邀請跟著寄出時的地址走，所以要先知道你是誰，才能把這一封給你看。',
  'invitation.anonymous.body':
    '請用收到邀請的那個地址登入，之後我們會把你直接帶回這裡。',
  'invitation.anonymous.action': '登入後繼續',
  'invitation.anonymous.noAccount': '還沒有帳號嗎？',
  'invitation.anonymous.register': '用受邀的地址建一個',
  'invitation.mismatch.heading': '這封邀請是給另一個地址的',
  'invitation.mismatch.description':
    '你現在登入的是別的帳號，所以這封邀請不該由你接受。',
  'invitation.mismatch.title': '目前登入：{email}',
  'invitation.mismatch.body':
    '登出後用收到邀請的地址重新登入，或者請對方再寄一封給這個帳號。',
  'invitation.mismatch.action': '切換帳號',
  'invitation.mismatch.back': '回到登入',
  'invitation.unverified.heading': '確認電子郵件後才能加入',
  'invitation.unverified.description':
    '工作區只接受已確認的地址，沒有人會因為一個筆誤被加進來。',
  'invitation.unverified.title': '{email} 還沒有確認',
  'invitation.unverified.body':
    '打開信箱裡的確認連結，再回到這個頁面。邀請會一直等著你。',
  'invitation.unverified.action': '確認我的電子郵件',
  'invitation.unverified.resend': '重新寄出確認信',
  'invitation.unavailable.heading': '這封邀請已經不能用了',
  'invitation.unavailable.description':
    '邀請的效期是七天，一旦被使用或被收回也會立刻失效。',
  'invitation.unavailable.title': '這裡沒有可以接受的邀請',
  'invitation.unavailable.body':
    '請邀請你的人重新寄一封，這個頁面會立刻顯示出來。',
  'invitation.unavailable.dashboard': '前往總覽',
  'invitation.declined.eyebrow': '已婉拒邀請',
  'invitation.declined.heading': '沒關係——什麼都沒有被共用',
  'invitation.declined.description':
    '工作區擁有者已經知道了，這個連結也不能再用。',
  'invitation.declined.action': '前往總覽',
  'error.unexpected.title': '出了點狀況',
  'error.unexpected.detail': '這次沒有成功。請稍後再試一次。',
  'error.rateLimited.title': '嘗試次數太多',
  'error.rateLimited.detail':
    '為了安全，這台裝置的登入先暫停幾分鐘。請過一會兒再試。',
  'error.offline.title': '沒有連線',
  'error.offline.detail': '我們連不上 planned.travel。請檢查網路後再試一次。',
  'error.credentials.title': '這些資料對不起來',
  'error.credentials.detail':
    '請核對電子郵件地址和密碼後再試。如果當初用 Google 或 Apple 註冊，請改用上面的按鈕。',
  'error.password.title': '這些資料對不起來',
  'error.password.detail': '請核對電子郵件地址和密碼後再試一次。',
  'error.noPassword.title': '這個帳號沒有設密碼',
  'error.noPassword.detail':
    '這個帳號是用社群帳號或密碼金鑰登入的，請從上面的選項挑一個。',
  'error.unverified.title': '請先確認電子郵件',
  'error.unverified.detail': '註冊時我們寄過確認連結給你。打開它，再回到這裡。',
  'error.emailTaken.title': '這個電子郵件已經註冊過了',
  'error.emailTaken.detail': '直接登入就好，忘了密碼就重設一組。',
  'error.noAccount.title': '找不到這個帳號',
  'error.noAccount.detail': '請核對地址，或者建立一個新帳號。',
  'error.passwordTooShort.title': '密碼太短',
  'error.passwordTooShort.detail': '請換一句更長的密碼再試一次。',
  'error.passwordTooLong.title': '密碼太長',
  'error.passwordTooLong.detail': '請換一句更短的密碼再試一次。',
  'error.linkSpent.title': '這個連結已經失效',
  'error.linkSpent.detail':
    '密碼連結只能用一次。重新申請，我們馬上寄一封新的給你。',
  'error.linkExpired.title': '這個連結已過期',
  'error.linkExpired.detail': '重新申請一個，我們馬上寄給你。',
  'error.linkIncomplete.title': '這個連結不完整',
  'error.linkIncomplete.detail':
    '重設密碼的連結帶著一次性的權杖。請打開最新那封信，或者重新申請一個連結。',
  'error.sessionExpired.title': '登入狀態已過期',
  'error.sessionExpired.detail': '重新登入就能接著剛才的地方繼續。',
  'error.alreadyVerified.title': '早就確認過了',
  'error.alreadyVerified.detail': '這個電子郵件地址已經驗證過，照常登入就好。',
  'error.badCode.title': '這組驗證碼不對',
  'error.badCode.detail':
    '驗證器的驗證碼只有 30 秒。等下一組出現，再把六位數字都填上。',
  'error.badBackupCode.title': '這組備用碼不對',
  'error.badBackupCode.detail':
    '每一組備用碼只能用一次。請試試清單裡還沒用過的下一組。',
  'error.locked.title': '帳號暫時鎖住了',
  'error.locked.detail': '驗證失敗太多次。為了安全，這個帳號會鎖上幾分鐘。',
  'error.noTwoFactor.title': '還沒有設定兩步驗證',
  'error.noTwoFactor.detail': '用電子郵件和密碼登入就能繼續。',
  'error.twoFactorExpired.title': '請從登入重新開始',
  'error.twoFactorExpired.detail':
    '這一步驗證已經逾時。請再輸入一次電子郵件和密碼。',
  'error.invitationGone.title': '這封邀請已經不能用了',
  'error.invitationGone.detail':
    '它可能過期、被收回，或者已經被用過了。請對方再寄一封邀請。',
  'error.invitationOther.title': '這封邀請是給別人的',
  'error.invitationOther.detail':
    '它寄給了另一個電子郵件地址。用那個地址登入就能接受。',
  'error.alreadyMember.title': '你已經在這個工作區裡了',
  'error.alreadyMember.detail':
    '沒有要接受的邀請——從工作區切換選單打開它就好。',
  'error.workspaceFull.title': '這個工作區滿了',
  'error.workspaceFull.detail':
    '成員人數已到上限。請擁有者騰出一個席次，或者升級方案。',
  'error.verifyBeforeJoin.title': '請先確認電子郵件',
  'error.verifyBeforeJoin.detail': '打開我們寄給你的確認連結，再回到這封邀請。',

  'passkeyNotice.added': '你的帳戶已新增通行密鑰',
  'passkeyNotice.removed': '你的帳戶已移除通行密鑰',
  'passkeyNotice.security': '安全性',
  'passkeyNotice.action': '管理通行密鑰',
  'passkeyNotice.recovery':
    '如果你不認識此變更，請更改密碼並結束不熟悉的工作階段。重設密碼不會移除通行密鑰。請檢查通行密鑰並移除不認識的密鑰。',
} satisfies TranslationOf<typeof En>

export default messages
