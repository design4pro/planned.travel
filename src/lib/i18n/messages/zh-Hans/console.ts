/**
 * 平台控制台所说的一切，简体中文版。
 *
 * 依据 `../en/console.ts` 写成（`docs/SPEC.md` §9）。英文文件即模式：
 * `TranslationOf<typeof En>` 会把缺失的键和凭空多出的键都变成编译错误，
 * `__tests__/parity.test.ts` 则检查占位符、复数分支，以及这里有没有残留英文。
 *
 * **复数。** `Intl.PluralRules('zh-Hans')` 只给出 `other` 一个分支，因此带数量的句子不分单复数，
 * 由数词和量词把意思说清楚。
 *
 * **两套永不混用的角色（§5）。** 平台一侧是管理员、策展人、用户；工作空间一侧是所有者、
 * 管理员、成员。「管理员」两侧都有，靠上下文区分，绝不靠这个词本身。
 *
 * `Suspend` 是「停用」而非「删除」：解除之后访问权就回来了，文案对此直说。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ---------------------------------------------------------------- 分区 -- */

  'nav.label': '控制台分区',
  'nav.overview': '概览',
  'nav.overview.description': '一眼看清平台',
  'nav.accounts': '账户',
  'nav.accounts.description': '角色、停用与会话',
  'nav.runs': '智能体运行',
  'nav.runs.description': 'Sandcastle 机队正在造什么',

  /* ---------------------------------------------------------------- 外壳 -- */

  'shell.eyebrow': '平台本身',
  'shell.title': '控制台',
  'shell.description': '产品本身 —— 账户、权限与共享目录',
  'shell.signedInAs': '当前登录',
  'shell.error.title': '控制台未能加载',
  'shell.notFound.title': '没有这个账户',
  'shell.notFound.body':
    '平台上没有任何东西带着这个标识。可能是链接生成之后账户被删除了，也可能是地址写错了。',
  'shell.allAccounts': '全部账户',
  'shell.overview': '控制台概览',

  'failure.fallback': '这次操作没有通过。请稍后再试。',

  /* ---------------------------------------------------------------- 概览 -- */

  'overview.error.title': '概览未能加载',
  'overview.standing.title': '你在平台上的权限',
  'overview.standing.body':
    '账户、会话以及以他人身份行事都属于平台管理员，因此控制台只向你展示目录，别的什么也没有。',
  'overview.stat.accounts': '账户',
  'overview.stat.accounts.caption': {
    other: '其中 {staff} 个持有平台角色',
  },
  'overview.stat.admins': '管理员',
  'overview.stat.admins.caption': '对账户与会话拥有全部权力',
  'overview.stat.curators': '策展人',
  'overview.stat.curators.caption': '只管目录 —— 绝不碰账户',
  'overview.stat.suspended': '已停用',
  'overview.stat.suspended.none': '没有人被挡在外面',
  'overview.stat.suspended.some': '在解除停用之前，处处都被退出登录',
  'overview.stat.suspended.review': '去看看他们',
  'overview.newest.label': '最新账户',
  'overview.newest.empty.title': '还没有账户',
  'overview.newest.empty.body': '第一个注册的人会出现在这里。',
  'overview.catalogue.label': '按状态看目录',
  'overview.catalogue.empty.title': '共享目录尚未开放',
  'overview.catalogue.empty.body':
    '待导入流水线就位之后，这块面板会把共享目录里的每个地点计为草稿、审核中或已发布，并让每个数字都能打开背后的清单。',
  'overview.scraping.label': '采集运行',
  'overview.scraping.empty.title': '没有运行过任何来源',
  'overview.scraping.empty.body':
    '来源每周采集一次。第一次运行结束后，最近五次会连同各自取到什么、改动什么、丢弃什么一并列在这里。',

  /* ------------------------------------------------------------ 角色刻度 -- */

  'role.admin': '管理员',
  'role.admin.summary':
    '平台上的全部权力：账户、角色、停用、会话，以及以他人身份行事。',
  'role.admin.holds.accounts': '创建账户并授予平台角色',
  'role.admin.holds.bans': '停用账户并解除停用',
  'role.admin.holds.sessions': '结束会话并设置密码',
  'role.admin.holds.impersonate': '以某个账户的身份行事十五分钟',
  'role.admin.holds.curation': '策展人能做的一切',
  'role.admin.withheld.admins': '以另一位平台管理员的身份行事',
  'role.curator': '策展人',
  'role.curator.summary':
    '照管目录、合辑、来源与共享链接。凡涉及账户的一概不碰。',
  'role.curator.holds.places': '读取、编写并发布目录地点',
  'role.curator.holds.packs': '读取、编写并发布地点合辑',
  'role.curator.holds.sources': '读取并运行目录来源',
  'role.curator.holds.shares': '审阅并吊销共享链接',
  'role.curator.withheld.accounts': '一切触及账户或会话的操作',
  'role.curator.withheld.tokens': '签发或吊销机器凭据',
  'role.user': '用户',
  'role.user.summary': '在平台上没有任何权限。几乎所有人都是这一类。',
  'role.user.withheld.everything': '平台的每一项权限，无一例外',

  /* -------------------------------------------------------------- 单个账户 -- */

  'identity.you': '这就是你',
  'status.active': '正常',
  'status.suspended': '已停用',
  'status.permanent': '无限期',
  'status.until': '至 {date}',
  'status.unverified': '未验证',
  'device.on': '{platform} 上的 {browser}',
  'device.unrecognised': '无法识别的设备',

  /* -------------------------------------------------------------- 账户列表 -- */

  'users.error.title': '账户列表未能加载',
  'users.total': '共 {total} 个',
  'users.loading': '正在加载账户',
  'users.table.label': '平台账户',
  'users.search.label': '在账户中搜索',
  'users.search.email': '在邮箱地址中搜索',
  'users.search.name': '在姓名中搜索',
  'users.search.column': '在哪一列里搜索',
  'users.search.submit': '搜索',
  'users.field.email': '邮箱',
  'users.field.name': '姓名',
  'users.filter.role.label': '按平台角色筛选',
  'users.filter.role.any': '任意角色',
  'users.filter.role.admin': '管理员',
  'users.filter.role.curator': '策展人',
  'users.filter.status.label': '按账户状态筛选',
  'users.filter.status.any': '任意状态',
  'users.filter.clear': '清除筛选',
  'users.filter.hint': '可按角色或状态收窄 —— 一次只用其中一项。',
  'users.column.account': '账户',
  'users.column.role': '平台角色',
  'users.column.status': '状态',
  'users.column.joined': '加入时间',
  'users.column.actions': '操作',
  'users.joined': '于 {date} 加入',
  'users.pastEnd.title': '这一页已经越过末尾',
  'users.pastEnd.body': {
    other: '这个视图里有 {total} 个账户，也就是{pages}。第 {page} 页在这之外。',
  },
  'users.pastEnd.pages': {
    other: '{pages} 页',
  },
  'users.pastEnd.back': '回到第一页',
  'users.empty.filtered.title': '没有符合这些筛选条件的结果',
  'users.empty.filtered.body':
    '平台上没有账户符合这次搜索。放宽搜索，或清除筛选以查看全部。',
  'users.empty.title': '没有可显示的账户',
  'users.empty.body': '这个视图是空的。什么都没有被筛掉，也就无从放宽。',

  /* -------------------------------------------------------------- 账户页面 -- */

  'account.error.title': '这个账户未能加载',
  'account.loading': '正在加载账户',
  'account.meta.lastChange': '最近一次改动',
  'account.meta.id': '账户标识',
  'account.banned.title': '这个账户已被停用',
  'account.banned.noReason': '停用时没有记下原因。',
  'account.banned.permanent': ' 在管理员解除之前一直有效。',
  'account.banned.until': ' 会在 {date} 自行解除。',
  'account.banned.untilUnknown': '到期之时',
  'account.authority.label': '在平台上的权限',
  'account.authority.may': '可以',
  'account.authority.mayNot': '不可以',
  'account.authority.none': '在平台上什么也做不了。',
  'account.workspaces.label': '工作空间',
  'account.workspaces.truncated':
    '这个账户所属的工作空间不止这里列出的 {listed} 个。',
  'account.workspaces.empty.title': '不属于任何工作空间',
  'account.workspaces.empty.body':
    '这个账户还不属于任何工作空间。首次登录时会创建一个，此后被邀请加入的每一个都会出现在这里。',
  'account.workspaces.column.workspace': '工作空间',
  'account.workspaces.column.role': '角色',
  'account.workspaces.column.plan': '套餐',
  'account.subscription.label': '订阅',
  'account.subscription.free.title': '正在使用免费套餐',
  'account.subscription.free.body':
    '这个账户拥有的工作空间从未走过结账流程，因此没有订阅记录，只在免费套餐的额度内运行。',
  'account.subscription.none.title': '没有向这个账户收取任何费用',
  'account.subscription.none.body':
    '这个账户不拥有任何工作空间。身在别人的工作空间里，并不等于是那个工作空间的付费人，所以这里无从汇总。',
  'account.subscription.endsAtClose': '在计费周期结束时终止',
  'account.subscription.seats': '席位',
  'account.subscription.seatsValue': '{limit} 个中的 {used} 个',
  'account.subscription.ends': '终止',
  'account.subscription.renews': '续订',
  'account.sessions.label': '活跃会话',
  'account.sessions.truncated':
    '这个账户持有的会话比一次调用能列出的还多。要确认一个不剩，请在操作菜单里结束全部会话。',
  'account.sessions.empty.title': '处处都已退出登录',
  'account.sessions.empty.body':
    '这个账户没有任何未过期的会话。它再次登录的那一刻就会出现在这里。',
  'account.sessions.column.device': '设备',
  'account.sessions.column.address': '地址',
  'account.sessions.column.started': '开始',
  'account.sessions.column.expires': '过期',
  'account.sessions.impersonated': '由一次代理身份行事而生',
  'account.sessions.noAddress': '未记录',
  'account.sessions.noAddressLong': '没有记录地址',
  'account.sessions.when': '{started} 开始 · {expires} 过期',
  'account.audit.label': '审计历史',
  'account.audit.truncated':
    '账本里的条目比这更多。平台的审计轨迹只增不改，保存四百天。',
  'account.audit.empty.title': '没有人对这个账户做过任何事',
  'account.audit.empty.body':
    '每一次角色变更、停用、设置密码、结束会话和代理身份行事，都会连同操作者一起写到这里。没有人碰过它。',

  /* --------------------------------------------------- 工作空间刻度 -- */

  'workspace.role.owner': '所有者',
  'workspace.role.admin': '管理员',
  'workspace.role.member': '成员',
  'plan.free': '免费',
  'plan.starter': '入门',
  'plan.pro': '专业',
  'plan.business': '商务',
  'subscription.trialing': '试用中',
  'subscription.active': '生效中',
  'subscription.pastDue': '逾期未付',
  'subscription.canceled': '已取消',
  'subscription.incomplete': '未完成',
  'subscription.expired': '已过期',
  'subscription.unpaid': '未付款',
  'subscription.paused': '已暂停',

  /* ------------------------------------------------------------ 审计账本 -- */

  'audit.action.created': '账户已创建',
  'audit.action.updated': '账户信息已变更',
  'audit.action.roleChanged': '平台角色已变更',
  'audit.action.banned': '账户已停用',
  'audit.action.unbanned': '停用已解除',
  'audit.action.deleted': '账户已删除',
  'audit.action.passwordSet': '密码由管理员设置',
  'audit.action.emailSet': '邮箱地址已变更',
  'audit.action.impersonationStarted': '代理身份行事已开始',
  'audit.action.impersonationEnded': '代理身份行事已结束',
  'audit.action.sessionRevoked': '一个会话已被结束',
  'audit.action.sessionRevokedAll': '全部会话已被结束',
  'audit.actor.system': '平台本身',
  'audit.actor.system.detail': '自动',
  'audit.actor.agent': '一份机器凭据',
  'audit.actor.agent.detail': 'MCP 令牌',
  'audit.actor.deleted': '一个已删除的账户',
  'audit.actorBadge': '当时：{role}',
  'audit.field.name': '姓名',
  'audit.field.email': '邮箱地址',
  'audit.field.emailVerified': '邮箱已验证',
  'audit.field.role': '平台角色',
  'audit.field.banned': '已停用',
  'audit.field.banReason': '原因',
  'audit.field.banExpiresAt': '停用到期',
  'audit.field.revoked': '被结束的会话',
  'audit.field.impersonating': '正在代理',
  'audit.field.impersonatedBy': '代理者',
  'audit.field.expiresAt': '会话过期',
  'audit.field.targetRole': '对方的平台角色',
  'audit.field.sessionId': '相关会话',
  'audit.value.yes': '是',
  'audit.value.no': '否',
  'audit.value.cleared': '已清空',
  'audit.became': '变为',

  /* ---------------------------------------------------------------- 对话框 -- */

  'dialog.cancel': '取消',

  'create.button': '新建账户',
  'create.title': '创建账户',
  'create.body': '地址不做验证，也不会发出任何邮件 —— 密码请你自己交给对方。',
  'create.confirm': '创建账户',
  'create.name.placeholder': '林晓',
  'create.email': '邮箱地址',
  'create.email.placeholder': 'xiaolin@planned.travel',
  'create.password': '密码',
  'create.password.hint': '长到能成一句话。对方之后可以自行更改。',
  'create.done': '账户已创建',
  'create.done.body': '{email} 可以用你设置的密码登录。',

  'action.menu.label': '对 {name} 的操作',
  'action.group.account': '账户',
  'action.group.credentials': '凭据',

  'action.role.item': '更改平台角色',
  'action.role.self': '不能用在自己的账户上 —— 把自己降级可能让平台无人可管。',
  'action.role.body':
    '{name} 在平台本身能做什么。工作空间成员身份是另一套词汇，不会因此改动。',
  'action.role.confirm': '保存角色',
  'action.role.current': '当前',
  'action.role.done': '平台角色已更新',
  'action.role.done.body': '{name} 现在在平台上是{role}。',

  'action.impersonate.item': '以该账户身份行事',
  'action.impersonate.self': '没有可代理的人 —— 这是你自己的账户。',
  'action.impersonate.banned': '该账户已被停用，因此没有可以套用的会话。',
  'action.impersonate.admin':
    '平台上没有任何角色可以代理管理员，你的角色也不例外。',
  'action.impersonate.title': '以 {name} 的身份行事',
  'action.impersonate.body':
    '接下来十五分钟，你看到的产品会与这个账户看到的完全一致。',
  'action.impersonate.confirm': '开始',
  'action.impersonate.note.bar':
    '在你结束之前，每个界面上都会留着一条警示条，且无法关闭。',
  'action.impersonate.note.platform':
    '代理身份期间，平台操作一律不可用 —— 控制台也一样。',
  'action.impersonate.note.audit':
    '开始与结束都会连同你的名字写进平台的审计轨迹。',

  'action.password.item': '设置密码',
  'action.password.title': '为 {name} 设置密码',
  'action.password.body':
    '用它把被挡在门外的人放回账户，或者把入侵者从被盗账户里切断。',
  'action.password.confirm': '设置密码',
  'action.password.field': '新密码',
  'action.password.hint.self': '一经设置，所有会话都会结束 —— 包括你自己的。',
  'action.password.hint': '一经设置，这个账户持有的每个会话都会结束。',
  'action.password.done': '密码已设置',
  'action.password.done.body': '{name} 已在所有设备上退出登录。',

  'action.sessions.item': '结束全部会话',
  'action.sessions.body.self':
    '这会让你的所有设备退出登录，包括你正在读这段话的这一台。',
  'action.sessions.body': '{name} 将在所有设备上退出登录，并需要重新登录。',
  'action.sessions.confirm': '结束会话',
  'action.sessions.done': '会话已结束',
  'action.sessions.done.body': {
    other: '已结束 {revoked} 个会话。',
  },

  'action.ban.item': '停用账户',
  'action.ban.self': '不能用在自己的账户上 —— 停用自己会断掉你回来的路。',
  'action.ban.title': '停用 {name}',
  'action.ban.body':
    '所有会话立即结束，在停用被解除或到期之前，该账户无法登录。',
  'action.ban.confirm': '停用账户',
  'action.ban.reason': '原因',
  'action.ban.reason.hint':
    '会在平台的审计轨迹里保存十三个月，除管理员外不向任何人展示。',
  'action.ban.reason.placeholder': '来自三个工作空间的重复滥用举报',
  'action.ban.duration': '时长',
  'action.ban.duration.label': '停用时长',
  'action.ban.duration.permanent.body': '一直有效，直到管理员有意解除。',
  'action.ban.duration.day': '24 小时',
  'action.ban.duration.day.body': '长到足以打断，短到仍算一次干预。',
  'action.ban.duration.week': '7 天',
  'action.ban.duration.week.body': '用一周时间回应一次投诉。',
  'action.ban.duration.month': '30 天',
  'action.ban.duration.month.body': '一个月的强制沉默。',
  'action.ban.duration.quarter': '90 天',
  'action.ban.duration.quarter.body':
    '控制台提供的最长时长。若要更久，请改用无限期停用。',
  'action.ban.done': '账户已停用',
  'action.ban.done.body': '{name} 已在各处退出登录，且无法登录。',

  'action.unban.item': '解除停用',
  'action.unban.title': '解除对 {name} 的停用',
  'action.unban.body': '该账户下一次尝试即可登录。此前的会话一个都不会回来。',
  'action.unban.confirm': '解除停用',
  'action.unban.done': '停用已解除',
  'action.unban.done.body': '{name} 可以重新登录了。没有恢复任何会话。',

  'action.delete.item': '删除账户',
  'action.delete.self': '不能用在自己的账户上 —— 那里没有回头路。',
  'action.delete.title': '删除 {name}',
  'action.delete.body':
    '账户、它的会话，以及与它绑定的每一份凭据都会消失。此举无法撤销。',
  'action.delete.confirm': '删除账户',
  'action.delete.note':
    '这个人在工作空间里创建的内容，仍归拥有它的工作空间所有。用停用代替删除，可以保住记录而只收走访问权。',
  'action.delete.done': '账户已删除',
  'action.delete.done.body': '{name} 以及与该账户绑定的一切都已消失。',

  'session.revoke.label': '结束 {device} 上的会话',
  'session.revoke.title': '结束这个会话',
  'session.revoke.body':
    '{device} 会在下一次请求时被要求重新登录。如果这正是你此刻所在的会话，你也会随之退出登录。',
  'session.revoke.confirm': '结束会话',
  'session.revoke.done': '会话已结束',
  'session.revoke.done.body': '该设备会在下一次请求时被要求重新登录。',

  /* -------------------------------------------------------- 智能体运行 -- */

  'runs.error.title': '运行注册表没有响应',
  'runs.origin.local': '本地',
  'runs.origin.githubActions': 'GitHub 操作',
  'runs.stat.live': '进行中的运行',
  'runs.stat.live.none': '此刻没有任何东西在建造',
  'runs.stat.live.some': '以心跳对抗五分钟的租约',
  'runs.stat.issues': '被占用的议题',
  'runs.stat.issues.caption': '每个都租给一次运行，连同它的祖先与子孙',
  'runs.stat.orphans': '孤立的分支',
  'runs.stat.orphans.none': '没有无主的工作',
  'runs.stat.orphans.some': '停下的运行留下的提交，正等着被接手',
  'runs.live.empty.title': '没有已登记的运行',
  'runs.live.empty.body':
    '一次运行一旦登记自己就会出现在这里 —— 无论来自这台机器、另一台机器，还是 GitHub 的执行器 —— 并带着它占下的议题。',
  'runs.holds.nothing': '没有占用任何议题',
  'runs.holds': '占用 {issues}',
  'runs.uptime': '已运行 {elapsed} · {lease}',
  'runs.lease.expired': '租约已过期',
  'runs.lease.left': '还剩 {elapsed}',
  'runs.wip.label': '进行中的工作',
  'runs.wip.empty.title': '没有分支带着工作',
  'runs.wip.empty.body':
    '分支上一有提交，运行就会把它记下来；这样即使运行死掉，下一次占到这个议题的运行也会拿到这份工作，而不必从头再来。',
  'runs.wip.orphaned': '已孤立',
  'runs.wip.meta': {
    other: '{commits} 个提交 · {elapsed}前',
  },
  'runs.recent.label': '最近结束的运行',
  'runs.recent.empty.title': '还没有运行结束过',
  'runs.recent.empty.body': '最近五十次运行会连同各自的结局留在这里。',
  'runs.ago': '{elapsed}前',
  'runs.notCoordinator.title': '这次部署不负责协调机队',
  'runs.notCoordinator.body':
    '运行注册表只绑定在预发布环境上，这是有意为之：若存在第二份注册表，两支机队都会以为队列在自己手里 —— 而这恰恰是它存在的唯一目的所要阻止的事。请到预发布环境去看机队。',
  'nav.providers': '服务商',
  'nav.providers.description': '对外调用及其上限',
  'providers.error.title': '无法读取服务商计数',
  'providers.list.label': '服务',
  'providers.status.planned': '尚未接入',
  'providers.status.planned.description':
    '目前还没有代码调用这个服务，所以无从计数。把它列在这里，是为了在第一次调用之前就谈好上限，而不是等第一张账单之后。',
  'providers.policy.allow': '超出仍计费',
  'providers.policy.block': '到达上限即拒绝',
  'providers.badge.blocked': {
    other: '已拒绝 {calls} 次调用',
  },
  'providers.limit.none': '尚未约定上限 · 本月 {used} 次',
  'providers.limit.value': '{limit} 次中的 {used} 次',
  'providers.limit.window.day': '今天',
  'providers.limit.window.month': '本月',
  'providers.measuring.none': '还没有任何测量',
  'providers.measuring.since': '自 {date} 起测量',
  'providers.stat.calls': '本月调用',
  'providers.stat.calls.caption': '涵盖所有已接入的服务',
  'providers.stat.errors': '失败的调用',
  'providers.stat.errors.caption': '同样计为调用，因为多数服务商照样收费',
  'providers.stat.nearLimit': '接近上限',
  'providers.stat.nearLimit.caption': '已越过告警阈值的服务',
  'providers.stat.blocked': '被拒绝的调用',
  'providers.stat.blocked.none': '没有任何调用被拒绝',
  'providers.stat.blocked.some': '被上限挡下的需求',
  'providers.forecast.label': '预测',
  'providers.forecast.provider': '服务',
  'providers.forecast.monthEnd': '到月底',
  'providers.forecast.runRate': '按此速度每月',
  'providers.forecast.perWorkspace': '每个工作区每月',
  'providers.forecast.noWorkspaceTraffic': '没有工作区流量可供平均',
  'providers.forecast.window': {
    other: '基于 {hours} 小时的测量推算。',
  },
  'providers.forecast.tooEarly': {
    other:
      '目前只测量了 {hours} 小时，还不足以推算。把不到一天的数据拉成一个月是算术，不是预测。',
  },
  'providers.forecast.atWorkspaces': '按多少个工作区',
  'providers.forecast.callsEach': '每个工作区每月调用数',
  'providers.forecast.projected': '每月约 {calls} 次。',
  'providers.workspaces.label': '调用最多的工作区',
  'providers.workspaces.platform': '平台（不属于工作区）',
  'providers.workspaces.empty.title': '尚未归属任何调用',
  'providers.workspaces.empty.description':
    '为某个工作区发起的调用会记在它名下。定时任务和平台邮件不属于任何工作区，单独计数。',
  'providers.readOnly':
    '你可以查看这些计数，但不能调整上限。修改限额或其策略需要 provider:configure 权限。',
  'providers.status.planned.agreed.month':
    '已约定上限：每月 {limit}。一旦有了客户端，从第一次调用起生效。',
  'providers.status.planned.agreed.day':
    '已约定上限：每天 {limit}。一旦有了客户端，从第一次调用起生效。',
  'providers.edit.button': '编辑',
  'providers.edit.title': '{provider} 的上限',
  'providers.edit.body': '本部署与服务商约定的花费，以及用完之后会发生什么。',
  'providers.edit.confirm': '保存上限',
  'providers.edit.done': '已保存 {provider} 的上限',
  'providers.edit.label': '名称',
  'providers.edit.ceiling': '包含的调用数',
  'providers.edit.ceiling.hint':
    '没有约定上限就留空。留空和零不是一回事：搭配“拒绝”的零会挡下每一次调用。',
  'providers.edit.ceiling.placeholder': '无上限',
  'providers.edit.window': '计量周期',
  'providers.edit.window.month': '一个自然月',
  'providers.edit.window.month.body': '套餐额度通常的形态。',
  'providers.edit.window.day': '一天',
  'providers.edit.window.day.body':
    '有些服务商按天计量——Geoapify 的免费方案是每天 3,000 点。',
  'providers.edit.policy': '到达上限时',
  'providers.edit.policy.allow': '继续调用并付费',
  'providers.edit.policy.allow.body':
    '调用会越过上限继续，控制台发出告警。没有东西会停。',
  'providers.edit.policy.block': '拒绝后续调用',
  'providers.edit.policy.block.body':
    '在周期重置前调用会被挡下。依赖这个服务商的功能会停摆——只在这种失败更划算的地方选它。',
  'providers.edit.policy.block.refused':
    '{provider} 不能被拒绝：它没有退路，挡下调用只会让功能停摆，而不是控制成本。仅告警的上限仍然可以设。',
  'providers.edit.warn': '告警阈值（%）',
  'providers.edit.critical': '严重阈值（%）',
  'providers.edit.thresholds.hint':
    '进度条转黄和转红的位置。告警不能高于严重。',
} satisfies TranslationOf<typeof En>

export default messages
