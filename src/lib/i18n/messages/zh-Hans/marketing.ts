/**
 * The public pages' copy, in zh-Hans.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **排版.** 产品名保留拉丁字母；破折号用中文全角。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': '免费开始',
  'action.signIn': '登录',
  'action.pricing': '定价',
  'action.seePricing': '查看定价',
  'action.skipToContent': '跳到主要内容',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — 首页',
  'nav.onThisPage': '本页目录',
  'anchor.planner': '行程规划',
  'anchor.modules': '模块',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': '放到第 {day} 天',
  'legal.summaryNote': '简要版是给人读的。真正适用的是下面的条款。',
  'visual.daysTravelled': '旅行天数',
  'visual.acrossEveryTrip': '所有行程合计',
  'visual.mapFilled': '地图已填 {percent}%',
  'visual.previewSummary':
    'planned.travel 面板预览：下一趟行程及其日期、同行人数和地点数量；已到过的国家、行程总数和旅行天数的合计；行程路线地图；以及接下来的两份预订。',
  'visual.placesMapped': {
    other: '地图上 {value} 个地点',
  },
  'visual.splitWays': {
    other: '{value} 人均摊',
  },
  'visual.tripTotal': '行程总额',
  'visual.paidSplit': '{who} 付款 · {split}',
  'visual.nextUp': '接下来',
  'visual.ofTotal': '第 {done} 项，共 {total} 项',
  'visual.awaitingReply': '等待回复',
  'visual.upcoming': '即将到来',
  'visual.days': {
    other: '{value} 天',
  },
  'visual.places': {
    other: '{value} 个地点',
  },
  'visual.transfersLeft': {
    other: '还剩 {value} 笔转账',
  },

  'legal.badge.version': '版本 {version}',
  'legal.badge.effective': '{updated} 起生效',
  'legal.notice.title': '这是模板，不是法律意见',
  'legal.notice.body':
    '它用浅显的英语写成，目的是给一个小型旅行规划服务一个真正可用的起点，企业必须补齐的每处空缺都已标出。在接下第一位客户之前，请让你所在司法辖区的合格律师审阅并调整。这里没有任何内容声称 planned.travel 持有某项认证、审计或合规标准。',
  'legal.contents': '目录',
  'legal.shortVersion': '简要版',
  'legal.both': '两份文件同时适用。',

  'landing.plans.title': '免费开始。等它值得了再付钱。',
  'landing.plans.lede':
    '每个方案都含逐日规划、地图、预算和行李清单。付费方案 - 每月 {price} 起 - 解锁不限次数的行程、预订、日志和导出。',
  'landing.plans.ledeFree':
    '每个方案都含逐日规划、地图、预算和行李清单。付费方案解锁不限次数的行程、预订、日志和导出。',
  'landing.plans.compare': '逐行比较每一项上限',
  'landing.questions.title': '问题，直接回答',
  'landing.questions.lede': '大家在动手之前真正想知道的六件事。',
  'cta.heading': '你下一趟旅程已经值得好好规划',
  'cta.lede':
    '两趟行程、整张地图、逐日安排和行李清单：免费，不用绑卡，也没有倒计时。',
  'landing.faq.seats.q': '和我同行的人也要付钱吗？',
  'landing.faq.seats.a':
    '不用。你邀请进{crew}工作区的每个人都算在这个工作区的名额里。他们用自己的账号登录，只看得到你把他们加进去的那些行程。',
  'landing.faq.phone.q': '在手机上能好好用吗？',
  'landing.faq.phone.a':
    '能。手机版式是单独画的，不是从桌面版挤下来的；而且这是一个网站，没有东西要装，也没有东西要更新。',
  'landing.faq.privacy.q': '谁能看到我的行程？',
  'landing.faq.privacy.a':
    '一趟行程属于一个工作区，只有被邀请进那个工作区的人才能打开。没有任何内容是公开的，没有发现流，默认也不会分享给任何人。',
  'landing.faq.stop.q': '如果我停止付费，我的行程会怎样？',
  'landing.faq.stop.a':
    '什么都不会删。付费模块会锁上，你的行程原地不动，一旦订阅就全部解锁。{free}继续免费，没有倒计时。',

  'action.startPlanning': '免费开始规划',
  'cta.comparePlans': '比较各个方案',
  'landing.hero.eyebrow': '一起规划旅程',
  'landing.hero.title': '规划这趟旅程。',
  'landing.hero.titleQuiet': '而不是表格。',
  'landing.hero.lede':
    '真实地图上的一份行程，实时分享给所有同行的人 - 预订、花费和行李清单都挂在上面。',
  'landing.hero.secondary': '看看要花多少',
  'landing.trust.noCard': '开始不用绑卡',
  'landing.trust.noAds': '没有广告，没有联盟链接',
  'landing.trust.export': '随时导出全部内容',

  'proof.eyebrow': '直白的答案',
  'proof.title': '没有客户评价，因为我们还没资格拿到',
  'proof.lede':
    'planned.travel 还很新。与其编一句好评或借别人的标志，不如把它做什么、给谁用、以及绝不会对你做什么，都直接写在这里。',
  'proof.who.label': '给谁用',
  'proof.who.heading': '给那个最后总要去做表格的人',
  'proof.who.body':
    '给那些想要一份所有人都看得到的计划的情侣、家庭和朋友团 - 而不是六张截图、三个群聊，还有一份三月之后没人打开过的共享笔记。',
  'proof.not.label': '它不是什么',
  'proof.not.heading': '不是订房网站，也不打算卖给这种网站',
  'proof.not.body':
    '我们不收佣金、不带广告、不放联盟链接，所以页面上没有任何东西会悄悄把你推向某家酒店。付钱的是你，所以我们为你做事。',
  'proof.where.label': '你的东西放在哪里',
  'proof.where.heading': '在 Cloudflare 上，在你自己的工作区里',
  'proof.where.body':
    '行程存在仅限于你工作区的数据库里，文件存在我们自己的对象存储里，两者都从 Cloudflare 的边缘节点提供。作为登记销售方的 Polar 负责结账并开具发票，所以你的卡号从不会到我们这里。',
  'proof.promise.ads.title': '没有广告，没有第三方分析',
  'proof.promise.ads.body': '这个页面上没有任何东西在替别人衡量你。',
  'proof.promise.sold.title': '你的行程绝不出售、绝不出租',
  'proof.promise.sold.body': '不给广告商，不给旅游公司，不给任何人。',
  'proof.promise.leave.title': '想走就走，把所有东西带上',
  'proof.promise.leave.body':
    'PDF 行程表、日历文件，以及你的地点导出为 GeoJSON。',
  'proof.certification':
    '我们目前没有任何安全认证，也不会暗示自己有。等 planned.travel 按某个标准接受审计，我们会在这里写出标准名称、审计方和日期 - 在那之前不会。',

  'feature.modules.title': '行程的其余部分，一并搞定',
  'feature.modules.lede':
    '每个模块只把一件事做好，再把成果交给其他模块。这里没有一个等着将来版本的占位标签。',
  'feature.module.lists.benefit': '不会有人忘了带转换插头。',
  'feature.module.lists.detail':
    '行李、待办、要买的东西和证件：一件事一份清单，与同行的人共享，边做边勾。',
  'feature.module.journal.name': '日志',
  'feature.module.journal.benefit': '旅程变成故事，而不是一个文件夹。',
  'feature.module.journal.detail':
    '按日期排列的记录，带上你拍的照片、当时在哪、天气，以及那天真实的感受。',
  'feature.module.atlas.benefit': '一张地图装下你去过的所有地方。',
  'feature.module.atlas.detail':
    '把一个国家标为已去过，它就进入你的世界地图：第一次、最近一次，以及你回去过几次。',
  'feature.module.vacay.benefit': '先请到假，再订机票。',
  'feature.module.vacay.detail':
    '标出你不在的日子，一年就自己填满：周末、法定假日，还有其他人的休假都在同一张格子里。',
  'feature.module.collab.benefit': '决定跟着行程留下来。',
  'feature.module.collab.detail':
    '每趟行程一个话题，大家都得记住的事放进共享笔记，晚饭定不下来就投票。',
  'feature.module.files.benefit': '登机牌放在你找得到的地方。',
  'feature.module.files.detail':
    '确认单、门票、保险文件和收据都挂在它们所属的那趟行程上，不会埋在收件箱里。',

  'feature.planner.title': '画在真实地图上的逐日行程',
  'feature.planner.lede':
    '把想去的地方收集起来，再拖到某一天。地图会随手重画路线，所以一上午要横穿城市两次，你立刻就看得见。',
  'feature.planner.point.days': '一天一列，带上日期、天气，以及当晚住哪里。',
  'feature.planner.point.unscheduled':
    '还没排期的地点待在自己那一列，直到分到某一天。',
  'feature.planner.point.crew':
    '在{crew}里所有人同时拖动：实时光标、即时同步、无需刷新。',
  'feature.planner.point.tiles':
    '矢量瓦片由我们自己的存储提供，没有任何地图供应商看着你做计划。',
  'feature.costs.title': '真能结清的共同开支',
  'feature.costs.lede':
    '用行程本身的货币记下花费，按你们真正约定的方式拆分每一笔，然后看清结全部账所需的最短转账组合。',
  'feature.costs.point.split':
    '平均分、按份额分，或按确切金额：逐笔设定，而不是整趟统一。',
  'feature.costs.point.currency': '一切折算成单一行程货币，总额才有意义。',
  'feature.costs.point.settle': '结算视图写明谁付给谁，转账完成后随即记录。',
  'feature.costs.point.receipt': '把收据附在支出上，数字永远带着凭证。',
  'feature.book.title': '每一份预订，都带上门口要用的编号',
  'feature.book.lede':
    '住宿、餐位、导览和门票在同一份清单里，旁边就是把你送来送去的航班、火车和轮渡：每一项都有确认号和所属日期。',
  'feature.book.point.legs': '交通段落带着座位、站台、航站楼和预订编号。',
  'feature.book.point.day': '预订挂在某一天上，不用重新输入就出现在行程里。',
  'feature.book.point.states':
    '已申请、已确认、已取消是各自独立的状态，不是某个字段里的备注。',
  'feature.book.point.export': '出发前把整趟行程导出成 PDF 行程表或日历文件。',

  'pricing.faq.trial.q': '试用期结束后会怎样？',
  'pricing.faq.trial.a':
    '试用期会直接转为付费套餐。Polar 在试用开始时记录一种支付方式，并在试用结束当天扣款；在那之前取消，就不会被扣款。两种情况下都不会删除任何东西：付费模块锁定，行程留在原处，一旦订阅便全部重新开启。',
  'pricing.faq.seller.q': '我究竟是在向谁购买？',
  'pricing.faq.seller.a':
    '向 Polar。它是我们的登记销售方：作为分销商把订阅卖给你，收取款项，以自己的名义开具发票，并核定、征收并缴纳你所在国家收取的销售税或增值税。退款和银行卡争议也与它处理。服务仍由我们运营，邮件也由我们回复。',
  'pricing.faq.change.q': '能在行程进行到一半时换套餐吗？',
  'pricing.faq.change.a':
    '可以。升级立即生效并按天折算；降级在你已付费的周期结束后生效，所以你不会失去已付费的访问权限。',
  'pricing.faq.seats.q': '{crew}的按人计费是怎么算的？',
  'pricing.faq.seats.a':
    '你只为实际占用的席位付费，人数随时可改。尚未接受的邀请也计入席位，因此工作区不会悄悄超出套餐。',
  'pricing.faq.guests.q': '和我同行的人需要各自订阅吗？',
  'pricing.faq.guests.a':
    '不需要。你邀请进{crew}工作区的每个人都由该工作区的席位覆盖。他们用自己的账号登录，只看到被加入的行程。',
  'pricing.faq.storage.q': '哪些内容算进存储空间？',
  'pricing.faq.storage.a':
    '照片、票据、确认单，以及你附加到行程的任何文件。地图瓦片和应用本身从不计入。在设置里可以准确看到什么占用了空间。',
  'pricing.faq.export.q': '我能把自己的数据带走吗？',
  'pricing.faq.export.a':
    '随时可以。每段行程都能导出为 PDF 行程和日历文件，你的地点可导出为 GeoJSON。这是你的旅行，不是我们的。',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': '无需信用卡，无期限，无倒计时',
  'pricing.card.yearlyPerSeat': '每人每年 {amount}，一次收取',
  'pricing.card.yearly': '每年一次收取 {amount}',
  'pricing.card.seatsUnlimited': '成员数不限',
  'pricing.card.tripsUnlimited': '行程数不限',
  'pricing.card.startFree': '免费开始',
  'pricing.card.startTrial': '试用 {plan}',
  'pricing.card.popular': '最多人选择',
  'pricing.card.noteYearly': '每年收取一次。两个月由我们请。',
  'pricing.card.noteMonthly': '按月收取。随时更换或取消。',
  'pricing.card.trial': {
    other: '{value} 天免费试用，先绑卡，结束时收取',
  },
  'pricing.card.seatsUpTo': {
    other: '最多 {value} 人',
  },
  'pricing.card.trips': {
    other: '同时 {value} 段行程',
  },

  'pricing.feature.storage': '{size} 用于照片和文档',
  'pricing.feature.storageShared': '{size} 共享空间，用于照片和文档',
  'pricing.feature.free.tripsDetail': '归档一次行程即可开始下一次',
  'pricing.feature.solo.modules': '全部规划模块',
  'pricing.feature.solo.modulesDetail': '预订、日志、预算、行李',
  'pricing.feature.crew.membersDetail': '按成员计费，随时调整',
  'pricing.feature.crew.realtimeDetail': '实时光标与即时同步',
  'pricing.feature.crew.supportDetail': '一个工作日内由真人回复',

  'pricing.hero.eyebrow': '两次行程永久免费',
  'pricing.hero.title': '好好地做计划。',
  'pricing.hero.titleQuiet': '按用量付费。',
  'pricing.hero.lede':
    '免费规划两次行程。一个人可解锁全部模块，或者带上整队人，一起编辑同一份行程。',
  'pricing.hero.taxNote':
    '价格以美元计，不含销售税或增值税。Polar 是我们的登记销售方：发票上是它，它计算你所在国家收取的税额、在结账时加上并代为缴纳。你可以随时在产品内取消。',
  'pricing.compare.eyebrow': '并排比较',
  'pricing.compare.title': '每项上限，一目了然',
  'pricing.compare.lede':
    '一张表，来自计费系统读取的同一份目录。若某行说模块包含在内，权限检查也这么认。',
  'pricing.compare.caption': '三个套餐的功能与上限对比',
  'pricing.compare.feature': '功能',
  'pricing.compare.limits': '上限',
  'pricing.compare.included': '包含',
  'pricing.compare.notIncluded': '不包含',
  'pricing.compare.includedIn': '{plan} 包含',
  'pricing.compare.notIn': '{plan} 不包含',
  'pricing.questions.eyebrow': '在你开口之前',
  'pricing.questions.title': '问题，已解答',
  'pricing.questions.lede': '计费、试用，以及把数据带走。',
  'pricing.cta.secondary': '看看它怎么用',
  'pricing.module.itinerary': '逐日行程',
  'pricing.module.map': '交互地图',
  'pricing.module.budget': '预算与费用分摊',
  'pricing.module.packing': '行李与待办清单',
  'pricing.module.reservations': '预订',
  'pricing.module.journal': '旅行日志',
  'pricing.module.atlas': '到访国家地图',
  'pricing.module.collaboration': '邀请同行者',
  'pricing.module.realtime': '实时协作',
  'pricing.module.offlineMaps': '离线地图',
  'pricing.module.pdfExport': 'PDF 与日历导出',
  'pricing.module.prioritySupport': '优先支持',

  'anchor.plans': '套餐',
  'anchor.compare': '对比',
  'anchor.questions': '常见问题',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    '行程、地图、预订、账目和行李清单都在一处——与同行的每个人共享。',
  'footer.attribution':
    '运行于 Cloudflare Workers。地图数据 © OpenStreetMap 贡献者。由记录商户 Polar 负责销售与开票。',
  'footer.column.product': '产品',
  'footer.column.account': '账户',
  'footer.link.overview': '概览',
  'footer.link.everyModule': '全部模块',
  'footer.link.dayPlanner': '每日规划',
  'footer.link.sharedCosts': '共同开支',
  'footer.link.reservations': '预订',
  'footer.link.atlasJournal': '地图册与旅行日志',
  'footer.link.createAccount': '创建账户',
  'footer.link.terms': '服务条款',
  'footer.link.privacy': '隐私声明',
} satisfies TranslationOf<typeof En>

export default messages
