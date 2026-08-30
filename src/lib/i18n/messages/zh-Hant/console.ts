/**
 * 平台主控台所說的一切，繁體中文版。
 *
 * 依 `../en/console.ts` 寫成（`docs/SPEC.md` §9）。英文檔即是綱要：
 * `TranslationOf<typeof En>` 會把缺少的鍵與憑空多出的鍵都變成編譯錯誤，
 * `__tests__/parity.test.ts` 則檢查佔位符、複數分支，以及此處是否還殘留英文。
 *
 * **複數。** `Intl.PluralRules('zh-Hant')` 只給 `other` 一個分支，因此帶數量的句子不分單複數，
 * 交由數詞與量詞把話說清楚。
 *
 * **兩套永不混用的角色（§5）。** 平台一側是管理員、策展人、使用者；工作區一側是擁有者、
 * 管理員、成員。「管理員」兩側都有，靠上下文分辨，絕不靠這個詞本身。
 *
 * 用語沿用臺灣慣例：`session` 作「工作階段」、`device` 作「裝置」、`plan` 作「方案」。
 * `Suspend` 是「停用」而非「刪除」：解除之後存取權就回來，文案照實這麼說。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ---------------------------------------------------------------- 分區 -- */

  'nav.label': '主控台分區',
  'nav.overview': '總覽',
  'nav.overview.description': '一眼看盡平台',
  'nav.accounts': '帳戶',
  'nav.accounts.description': '角色、停用與工作階段',
  'nav.runs': '代理程式執行',
  'nav.runs.description': 'Sandcastle 機隊正在打造什麼',

  /* ---------------------------------------------------------------- 外框 -- */

  'shell.eyebrow': '平台本身',
  'shell.title': '主控台',
  'shell.description': '產品本身 —— 帳戶、權限與共用目錄',
  'shell.signedInAs': '目前登入',
  'shell.error.title': '主控台未能載入',
  'shell.notFound.title': '沒有這個帳戶',
  'shell.notFound.body':
    '平台上沒有任何東西帶著這個識別碼。可能是連結產生之後帳戶被刪除了，也可能是網址拼錯了。',
  'shell.allAccounts': '全部帳戶',
  'shell.overview': '主控台總覽',

  'failure.fallback': '這次操作沒有通過。請稍候再試一次。',

  /* ---------------------------------------------------------------- 總覽 -- */

  'overview.error.title': '總覽未能載入',
  'overview.standing.title': '你在平台上的權限',
  'overview.standing.body':
    '帳戶、工作階段以及以他人身分行事都屬於平台管理員，因此主控台只讓你看目錄，別的一概沒有。',
  'overview.stat.accounts': '帳戶',
  'overview.stat.accounts.caption': {
    other: '其中 {staff} 個持有平台角色',
  },
  'overview.stat.admins': '管理員',
  'overview.stat.admins.caption': '對帳戶與工作階段握有全部權力',
  'overview.stat.curators': '策展人',
  'overview.stat.curators.caption': '只管目錄 —— 絕不碰帳戶',
  'overview.stat.suspended': '已停用',
  'overview.stat.suspended.none': '沒有人被擋在外面',
  'overview.stat.suspended.some': '在解除停用之前，處處都被登出',
  'overview.stat.suspended.review': '去看看他們',
  'overview.newest.label': '最新的帳戶',
  'overview.newest.empty.title': '還沒有帳戶',
  'overview.newest.empty.body': '第一個註冊的人會出現在這裡。',
  'overview.catalogue.label': '依狀態看目錄',
  'overview.catalogue.empty.title': '共用目錄尚未開放',
  'overview.catalogue.empty.body':
    '待匯入流程就位之後，這塊面板會把共用目錄裡的每個地點算作草稿、審閱中或已發布，並讓每個數字都能打開背後的清單。',
  'overview.scraping.label': '蒐集執行',
  'overview.scraping.empty.title': '沒有執行過任何來源',
  'overview.scraping.empty.body':
    '來源每週蒐集一次。第一次執行結束後，最近五次會連同各自取到什麼、改動什麼、捨棄什麼一併列在這裡。',

  /* ------------------------------------------------------------ 角色刻度 -- */

  'role.admin': '管理員',
  'role.admin.summary':
    '平台上的全部權力：帳戶、角色、停用、工作階段，以及以他人身分行事。',
  'role.admin.holds.accounts': '建立帳戶並授予平台角色',
  'role.admin.holds.bans': '停用帳戶並解除停用',
  'role.admin.holds.sessions': '結束工作階段並設定密碼',
  'role.admin.holds.impersonate': '以某個帳戶的身分行事十五分鐘',
  'role.admin.holds.curation': '策展人能做的一切',
  'role.admin.withheld.admins': '以另一位平台管理員的身分行事',
  'role.curator': '策展人',
  'role.curator.summary':
    '照管目錄、合輯、來源與共用連結。凡涉及帳戶的一律不碰。',
  'role.curator.holds.places': '讀取、撰寫並發布目錄地點',
  'role.curator.holds.packs': '讀取、撰寫並發布地點合輯',
  'role.curator.holds.sources': '讀取並執行目錄來源',
  'role.curator.holds.shares': '審閱並撤銷共用連結',
  'role.curator.withheld.accounts': '一切觸及帳戶或工作階段的操作',
  'role.curator.withheld.tokens': '簽發或撤銷機器憑證',
  'role.user': '使用者',
  'role.user.summary': '在平台上沒有任何權限。幾乎所有人都屬於這一類。',
  'role.user.withheld.everything': '平台的每一項權限，無一例外',

  /* -------------------------------------------------------------- 單一帳戶 -- */

  'identity.you': '這就是你',
  'status.active': '正常',
  'status.suspended': '已停用',
  'status.permanent': '無限期',
  'status.until': '至 {date}',
  'status.unverified': '未驗證',
  'device.on': '{platform} 上的 {browser}',
  'device.unrecognised': '無法辨識的裝置',

  /* -------------------------------------------------------------- 帳戶清單 -- */

  'users.error.title': '帳戶清單未能載入',
  'users.total': '共 {total} 個',
  'users.loading': '正在載入帳戶',
  'users.table.label': '平台帳戶',
  'users.search.label': '在帳戶中搜尋',
  'users.search.email': '在電子郵件地址中搜尋',
  'users.search.name': '在姓名中搜尋',
  'users.search.column': '要搜尋哪一欄',
  'users.search.submit': '搜尋',
  'users.field.email': '電子郵件',
  'users.field.name': '姓名',
  'users.filter.role.label': '依平台角色篩選',
  'users.filter.role.any': '任何角色',
  'users.filter.role.admin': '管理員',
  'users.filter.role.curator': '策展人',
  'users.filter.status.label': '依帳戶狀態篩選',
  'users.filter.status.any': '任何狀態',
  'users.filter.clear': '清除篩選',
  'users.filter.hint': '可依角色或狀態縮小範圍 —— 一次只用其中一項。',
  'users.column.account': '帳戶',
  'users.column.role': '平台角色',
  'users.column.status': '狀態',
  'users.column.joined': '加入時間',
  'users.column.actions': '操作',
  'users.joined': '於 {date} 加入',
  'users.pastEnd.title': '這一頁已經越過末尾',
  'users.pastEnd.body': {
    other: '這個檢視裡有 {total} 個帳戶，也就是{pages}。第 {page} 頁在那之外。',
  },
  'users.pastEnd.pages': {
    other: '{pages} 頁',
  },
  'users.pastEnd.back': '回到第一頁',
  'users.empty.filtered.title': '沒有符合這些條件的結果',
  'users.empty.filtered.body':
    '平台上沒有帳戶符合這次搜尋。放寬搜尋，或清除篩選以查看全部。',
  'users.empty.title': '沒有可顯示的帳戶',
  'users.empty.body': '這個檢視是空的。什麼都沒被篩掉，也就無從放寬。',

  /* -------------------------------------------------------------- 帳戶頁面 -- */

  'account.error.title': '這個帳戶未能載入',
  'account.loading': '正在載入帳戶',
  'account.meta.lastChange': '最近一次變更',
  'account.meta.id': '帳戶識別碼',
  'account.banned.title': '這個帳戶已被停用',
  'account.banned.noReason': '停用時沒有寫下原因。',
  'account.banned.permanent': ' 在管理員解除之前一直有效。',
  'account.banned.until': ' 會在 {date} 自行解除。',
  'account.banned.untilUnknown': '到期之時',
  'account.authority.label': '在平台上的權限',
  'account.authority.may': '可以',
  'account.authority.mayNot': '不可以',
  'account.authority.none': '在平台上什麼都不能做。',
  'account.workspaces.label': '工作區',
  'account.workspaces.truncated':
    '這個帳戶所屬的工作區不止此處列出的 {listed} 個。',
  'account.workspaces.empty.title': '不屬於任何工作區',
  'account.workspaces.empty.body':
    '這個帳戶還不屬於任何工作區。首次登入時會建立一個，此後受邀加入的每一個都會出現在這裡。',
  'account.workspaces.column.workspace': '工作區',
  'account.workspaces.column.role': '角色',
  'account.workspaces.column.plan': '方案',
  'account.subscription.label': '訂閱',
  'account.subscription.free.title': '正在使用免費方案',
  'account.subscription.free.body':
    '這個帳戶擁有的工作區從未走過結帳流程，因此沒有訂閱紀錄，只在免費方案的額度內運作。',
  'account.subscription.none.title': '沒有向這個帳戶收取任何費用',
  'account.subscription.none.body':
    '這個帳戶不擁有任何工作區。身在別人的工作區裡，並不等於是那個工作區的付費人，所以這裡無從彙整。',
  'account.subscription.endsAtClose': '在計費週期結束時終止',
  'account.subscription.seats': '席次',
  'account.subscription.seatsValue': '{limit} 個中的 {used} 個',
  'account.subscription.ends': '終止',
  'account.subscription.renews': '續訂',
  'account.sessions.label': '使用中的工作階段',
  'account.sessions.truncated':
    '這個帳戶持有的工作階段比一次呼叫所能列出的還多。要確認一個不剩，請從操作選單結束全部工作階段。',
  'account.sessions.empty.title': '處處都已登出',
  'account.sessions.empty.body':
    '這個帳戶沒有任何尚未逾期的工作階段。它再次登入的那一刻就會出現在這裡。',
  'account.sessions.column.device': '裝置',
  'account.sessions.column.address': '位址',
  'account.sessions.column.started': '開始',
  'account.sessions.column.expires': '逾期',
  'account.sessions.impersonated': '由一次代理身分行事而生',
  'account.sessions.noAddress': '未記錄',
  'account.sessions.noAddressLong': '沒有記錄位址',
  'account.sessions.when': '{started} 開始 · {expires} 逾期',
  'account.audit.label': '稽核歷程',
  'account.audit.truncated':
    '帳本裡的項目比這更多。平台的稽核軌跡只增不改，保存四百天。',
  'account.audit.empty.title': '沒有人對這個帳戶做過任何事',
  'account.audit.empty.body':
    '每一次角色變更、停用、設定密碼、結束工作階段與代理身分行事，都會連同執行者一起寫到這裡。沒有人碰過它。',

  /* ----------------------------------------------------- 工作區刻度 -- */

  'workspace.role.owner': '擁有者',
  'workspace.role.admin': '管理員',
  'workspace.role.member': '成員',
  'plan.free': '免費',
  'plan.starter': '入門',
  'plan.pro': '專業',
  'plan.business': '商務',
  'subscription.trialing': '試用中',
  'subscription.active': '生效中',
  'subscription.pastDue': '逾期未付',
  'subscription.canceled': '已取消',
  'subscription.incomplete': '未完成',
  'subscription.expired': '已逾期',
  'subscription.unpaid': '未付款',
  'subscription.paused': '已暫停',

  /* ------------------------------------------------------------ 稽核帳本 -- */

  'audit.action.created': '帳戶已建立',
  'audit.action.updated': '帳戶資料已變更',
  'audit.action.roleChanged': '平台角色已變更',
  'audit.action.banned': '帳戶已停用',
  'audit.action.unbanned': '停用已解除',
  'audit.action.deleted': '帳戶已刪除',
  'audit.action.passwordSet': '密碼由管理員設定',
  'audit.action.emailSet': '電子郵件地址已變更',
  'audit.action.impersonationStarted': '代理身分行事已開始',
  'audit.action.impersonationEnded': '代理身分行事已結束',
  'audit.action.sessionRevoked': '一個工作階段已被結束',
  'audit.action.sessionRevokedAll': '全部工作階段已被結束',
  'audit.actor.system': '平台本身',
  'audit.actor.system.detail': '自動',
  'audit.actor.agent': '一份機器憑證',
  'audit.actor.agent.detail': 'MCP 權杖',
  'audit.actor.deleted': '一個已刪除的帳戶',
  'audit.actorBadge': '當時：{role}',
  'audit.field.name': '姓名',
  'audit.field.email': '電子郵件地址',
  'audit.field.emailVerified': '電子郵件已驗證',
  'audit.field.role': '平台角色',
  'audit.field.banned': '已停用',
  'audit.field.banReason': '原因',
  'audit.field.banExpiresAt': '停用到期',
  'audit.field.revoked': '被結束的工作階段',
  'audit.field.impersonating': '正在代理',
  'audit.field.impersonatedBy': '代理者',
  'audit.field.expiresAt': '工作階段逾期',
  'audit.field.targetRole': '對方的平台角色',
  'audit.field.sessionId': '相關工作階段',
  'audit.value.yes': '是',
  'audit.value.no': '否',
  'audit.value.cleared': '已清空',
  'audit.became': '變為',

  /* ---------------------------------------------------------------- 對話框 -- */

  'dialog.cancel': '取消',

  'create.button': '新增帳戶',
  'create.title': '建立帳戶',
  'create.body': '地址不做驗證，也不會寄出任何郵件 —— 密碼請你親自交給對方。',
  'create.confirm': '建立帳戶',
  'create.name.placeholder': '陳雅雯',
  'create.email': '電子郵件地址',
  'create.email.placeholder': 'yawen@planned.travel',
  'create.password': '密碼',
  'create.password.hint': '長到能成一句話。對方之後可以自行更改。',
  'create.done': '帳戶已建立',
  'create.done.body': '{email} 可以用你設定的密碼登入。',

  'action.menu.label': '對 {name} 的操作',
  'action.group.account': '帳戶',
  'action.group.credentials': '憑證',

  'action.role.item': '變更平台角色',
  'action.role.self': '不能用在自己的帳戶上 —— 把自己降級可能讓平台無人可管。',
  'action.role.body':
    '{name} 在平台本身能做什麼。工作區成員身分是另一套詞彙，不會因此變動。',
  'action.role.confirm': '儲存角色',
  'action.role.current': '目前',
  'action.role.done': '平台角色已更新',
  'action.role.done.body': '{name} 現在在平台上是{role}。',

  'action.impersonate.item': '以該帳戶身分行事',
  'action.impersonate.self': '沒有可代理的人 —— 這是你自己的帳戶。',
  'action.impersonate.banned': '該帳戶已被停用，因此沒有可以套上的工作階段。',
  'action.impersonate.admin':
    '平台上沒有任何角色可以代理管理員，你的角色也不例外。',
  'action.impersonate.title': '以 {name} 的身分行事',
  'action.impersonate.body':
    '接下來十五分鐘，你看到的產品會與這個帳戶看到的一模一樣。',
  'action.impersonate.confirm': '開始',
  'action.impersonate.note.bar':
    '在你結束之前，每個畫面上都會留著一條警示列，而且無法關閉。',
  'action.impersonate.note.platform':
    '代理身分期間，平台操作一律不可用 —— 主控台也一樣。',
  'action.impersonate.note.audit':
    '開始與結束都會連同你的名字寫進平台的稽核軌跡。',

  'action.password.item': '設定密碼',
  'action.password.title': '為 {name} 設定密碼',
  'action.password.body':
    '用它把被擋在門外的人放回帳戶，或把入侵者從被盜的帳戶裡切斷。',
  'action.password.confirm': '設定密碼',
  'action.password.field': '新密碼',
  'action.password.hint.self':
    '一旦設定，所有工作階段都會結束 —— 包括你自己的。',
  'action.password.hint': '一旦設定，這個帳戶持有的每個工作階段都會結束。',
  'action.password.done': '密碼已設定',
  'action.password.done.body': '{name} 已在所有裝置上登出。',

  'action.sessions.item': '結束全部工作階段',
  'action.sessions.body.self':
    '這會讓你的所有裝置登出，包括你正在讀這段話的這一台。',
  'action.sessions.body': '{name} 會在所有裝置上登出，並必須重新登入。',
  'action.sessions.confirm': '結束工作階段',
  'action.sessions.done': '工作階段已結束',
  'action.sessions.done.body': {
    other: '已結束 {revoked} 個工作階段。',
  },

  'action.ban.item': '停用帳戶',
  'action.ban.self': '不能用在自己的帳戶上 —— 停用自己會斷了你回來的路。',
  'action.ban.title': '停用 {name}',
  'action.ban.body':
    '所有工作階段立即結束，在停用被解除或到期之前，該帳戶無法登入。',
  'action.ban.confirm': '停用帳戶',
  'action.ban.reason': '原因',
  'action.ban.reason.hint':
    '會在平台的稽核軌跡裡保存十三個月，除管理員外不向任何人顯示。',
  'action.ban.reason.placeholder': '來自三個工作區的重複濫用檢舉',
  'action.ban.duration': '期間',
  'action.ban.duration.label': '停用期間',
  'action.ban.duration.permanent.body': '一直有效，直到管理員有意解除。',
  'action.ban.duration.day': '24 小時',
  'action.ban.duration.day.body': '長到足以打斷，短到仍算一次介入。',
  'action.ban.duration.week': '7 天',
  'action.ban.duration.week.body': '用一週回應一次申訴。',
  'action.ban.duration.month': '30 天',
  'action.ban.duration.month.body': '一個月的強制沉默。',
  'action.ban.duration.quarter': '90 天',
  'action.ban.duration.quarter.body':
    '主控台提供的最長期間。若要更久，請改用無限期停用。',
  'action.ban.done': '帳戶已停用',
  'action.ban.done.body': '{name} 已在各處登出，而且無法登入。',

  'action.unban.item': '解除停用',
  'action.unban.title': '解除對 {name} 的停用',
  'action.unban.body':
    '該帳戶下一次嘗試即可登入。先前的工作階段一個都不會回來。',
  'action.unban.confirm': '解除停用',
  'action.unban.done': '停用已解除',
  'action.unban.done.body': '{name} 可以重新登入了。沒有恢復任何工作階段。',

  'action.delete.item': '刪除帳戶',
  'action.delete.self': '不能用在自己的帳戶上 —— 那裡沒有回頭路。',
  'action.delete.title': '刪除 {name}',
  'action.delete.body':
    '帳戶、它的工作階段，以及與它綁定的每一份憑證都會消失。此舉無法復原。',
  'action.delete.confirm': '刪除帳戶',
  'action.delete.note':
    '這個人在工作區裡建立的內容，仍歸擁有它的工作區所有。用停用代替刪除，可以保住紀錄而只收走存取權。',
  'action.delete.done': '帳戶已刪除',
  'action.delete.done.body': '{name} 以及與該帳戶綁定的一切都已消失。',

  'session.revoke.label': '結束 {device} 上的工作階段',
  'session.revoke.title': '結束這個工作階段',
  'session.revoke.body':
    '{device} 會在下一次請求時被要求重新登入。如果這正是你此刻所在的工作階段，你也會隨之登出。',
  'session.revoke.confirm': '結束工作階段',
  'session.revoke.done': '工作階段已結束',
  'session.revoke.done.body': '該裝置會在下一次請求時被要求重新登入。',

  /* ------------------------------------------------------ 代理程式執行 -- */

  'runs.error.title': '執行登錄表沒有回應',
  'runs.origin.local': '本機',
  'runs.origin.githubActions': 'GitHub 動作',
  'runs.stat.live': '進行中的執行',
  'runs.stat.live.none': '此刻沒有任何東西在打造',
  'runs.stat.live.some': '以心跳對抗五分鐘的租約',
  'runs.stat.issues': '被占用的議題',
  'runs.stat.issues.caption': '每個都租給一次執行，連同它的祖先與子孫',
  'runs.stat.orphans': '孤立的分支',
  'runs.stat.orphans.none': '沒有無主的工作',
  'runs.stat.orphans.some': '停下的執行留下的提交，正等著被接手',
  'runs.live.empty.title': '沒有已登錄的執行',
  'runs.live.empty.body':
    '一次執行一旦登錄自己就會出現在這裡 —— 無論來自這台機器、另一台機器，或 GitHub 的執行器 —— 並帶著它占下的議題。',
  'runs.holds.nothing': '沒有占用任何議題',
  'runs.holds': '占用 {issues}',
  'runs.uptime': '已執行 {elapsed} · {lease}',
  'runs.lease.expired': '租約已逾期',
  'runs.lease.left': '還剩 {elapsed}',
  'runs.wip.label': '進行中的工作',
  'runs.wip.empty.title': '沒有分支帶著工作',
  'runs.wip.empty.body':
    '分支上一有提交，執行就會把它記下來；如此一來即使執行死掉，下一次占到這個議題的執行也會拿到這份工作，而不必從頭再來。',
  'runs.wip.orphaned': '已孤立',
  'runs.wip.meta': {
    other: '{commits} 個提交 · {elapsed}前',
  },
  'runs.recent.label': '最近結束的執行',
  'runs.recent.empty.title': '還沒有執行結束過',
  'runs.recent.empty.body': '最近五十次執行會連同各自的結局留在這裡。',
  'runs.ago': '{elapsed}前',
  'runs.notCoordinator.title': '這次部署不負責協調機隊',
  'runs.notCoordinator.body':
    '執行登錄表只綁在預備環境上，這是刻意為之：若存在第二份登錄表，兩支機隊都會以為佇列在自己手上 —— 而這恰恰是它存在的唯一目的所要阻止的事。請到預備環境去看機隊。',
} satisfies TranslationOf<typeof En>

export default messages
