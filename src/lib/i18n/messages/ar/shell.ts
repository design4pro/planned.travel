/**
 * Everything the application shell says, in Arabic.
 *
 * Made from `../en/shell.ts` and from nothing else. `docs/SPEC.md` §1 and §8.9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * **Six branches.** `Intl.PluralRules` reports zero, one, two, few, many and
 * other for `ar`, and `__tests__/parity.test.ts` requires all six. The forms
 * follow Arabic number agreement: 1 takes the singular, 2 the dual, 3–10 the
 * broken plural, 11–99 the accusative singular and 100 upwards the singular
 * again. `one` and `two` therefore drop the numeral placeholder — «رحلة واحدة»
 * and «رحلتان» already say how many, and the gate compares the union of
 * placeholders across the branches rather than each branch separately.
 *
 * **Stored notification copy.** `src/server/repos/notifications.ts` stores a
 * notification as `titleKey` + `bodyKey` + a `params` record, never as a
 * rendered sentence, so the `notification.*` pairs below are what a row written
 * a year ago resolves against today. A reader's own text — a chat preview, a
 * poll question — is set in Arabic quotation marks, which is the only thing a
 * translator can do to a message that is nothing but a placeholder.
 *
 * **Numbers.** §8's rule holds: `count` selects the branch and is never
 * printed. A figure a reader sees arrives as its own placeholder, already
 * grouped by `src/lib/format.ts`. `ar` as a bare tag carries the `latn`
 * numbering system, so 1,234 is correct here and Arabic-Indic digits, which
 * belong to tags we do not ship, would be wrong.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'الأقسام الرئيسية',
  'nav.mobile': 'الأقسام',
  'nav.dashboardLink': 'لوحة planned.travel',
  'nav.homeLink': 'الصفحة الرئيسية لـ planned.travel',
  'nav.newTrip': 'رحلة جديدة',

  'nav.trips': 'رحلاتي',
  'nav.trips.short': 'الرحلات',
  'nav.vacay': 'الإجازات',
  'nav.vacay.short': 'إجازات',
  'nav.atlas': 'الأطلس',
  'nav.atlas.short': 'أطلس',
  'nav.journey': 'اليوميات',
  'nav.journey.short': 'يوميات',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'أقسام الرحلة',
  'trip.nav.back': 'الرحلات',
  'trip.nav.share': 'مشاركة',
  'trip.nav.shareLabel': 'شارك هذه الرحلة',
  'trip.tab.plan': 'الخطة',
  'trip.tab.transports': 'التنقلات',
  'trip.tab.book': 'الحجز',
  'trip.tab.lists': 'القوائم',
  'trip.tab.costs': 'التكاليف',
  'trip.tab.files': 'الملفات',
  'trip.tab.collab': 'التعاون',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'قائمة الحساب',
  'account.settings': 'الإعدادات',
  'account.billing': 'الخطة والفواتير',
  'account.admin': 'الإدارة',
  'account.signOut': 'تسجيل الخروج',
  'account.signingOut': 'جارٍ تسجيل الخروج…',
  'account.signOutFailed': 'تعذّر تسجيل خروجك',
  'account.signOutFailedBody': 'تحقق من اتصالك ثم أعد المحاولة.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'مساحة العمل',
  'workspace.switched': 'تم التبديل إلى {name}',
  'workspace.switchFailed': 'تعذّر تبديل مساحة العمل',
  'workspace.switchFailedBody': 'تحقق من اتصالك ثم أعد المحاولة.',
  'workspace.switchUnconfirmedBody':
    'تعذر تأكيد مساحة العمل النشطة. أعد تحميل الصفحة قبل المتابعة.',
  'workspace.switchRateLimitedBody':
    'تم تبديل مساحة العمل مرات كثيرة. انتظر قليلاً ثم حاول مجدداً.',
  'workspace.create': 'إنشاء مساحة عمل',
  'workspace.createTitle': 'إنشاء مساحة عمل جديدة',
  'workspace.createDescription':
    'مساحة منفصلة برحلاتها وأماكنها وأشخاصها. تبدأ على الخطة المجانية.',
  'workspace.createName': 'اسم مساحة العمل',
  'workspace.createUpgrade': 'إنشاء مساحات عمل إضافية جزء من الخطط المدفوعة.',
  'workspace.createLimitReached':
    'وصلت إلى أقصى عدد من مساحات العمل يمكن لحساب واحد الانضمام إليه.',
  'workspace.createRoleRequired':
    'يمكن لمسؤول مساحة العمل فقط إنشاء مساحة عمل. اطلب ذلك من مسؤول هذه المساحة، أو انتقل إلى مساحة تديرها.',
  'workspace.createFailed': 'تعذّر إنشاء مساحة العمل',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'المظهر',
  'theme.light': 'فاتح',
  'theme.dark': 'داكن',
  'theme.system': 'حسب النظام',
  'theme.state.light': 'الفاتح',
  'theme.state.dark': 'الداكن',
  'theme.state.system': 'مطابق للنظام',
  'theme.trigger': 'المظهر: {state}. تغيير المظهر',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'الإشعارات، لا شيء غير مقروء',
  'bell.unread': {
    zero: 'الإشعارات، {unread} إشعار غير مقروء',
    one: 'الإشعارات، إشعار واحد غير مقروء',
    two: 'الإشعارات، إشعاران غير مقروءين',
    few: 'الإشعارات، {unread} إشعارات غير مقروءة',
    many: 'الإشعارات، {unread} إشعارًا غير مقروء',
    other: 'الإشعارات، {unread} إشعار غير مقروء',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'صندوق الوارد',
  'inbox.title': 'الإشعارات',
  'inbox.error': 'لم يُحمّل صندوق الوارد',
  'inbox.allRead': 'كل شيء مقروء',
  'inbox.unread': {
    zero: '{unread} رسالة غير مقروءة',
    one: 'رسالة واحدة غير مقروءة',
    two: 'رسالتان غير مقروءتين',
    few: '{unread} رسائل غير مقروءة',
    many: '{unread} رسالة غير مقروءة',
    other: '{unread} رسالة غير مقروءة',
  },
  'inbox.markAll': 'تعليم الكل كمقروء',
  'inbox.markingAll': 'جارٍ تعليم كل شيء كمقروء',
  'inbox.cleared': 'أُفرغ صندوق الوارد',
  'inbox.markAllFailed': 'تعذّر تعليم كل شيء كمقروء',
  'inbox.retryHint': 'تحقق من اتصالك ثم حاول مرة أخرى.',
  'inbox.filter.all': 'كل شيء',
  'inbox.filter.unread': 'غير المقروء',
  'inbox.waiting': {
    zero: '{invitations} دعوة في الانتظار',
    one: 'دعوة واحدة في الانتظار',
    two: 'دعوتان في الانتظار',
    few: '{invitations} دعوات في الانتظار',
    many: '{invitations} دعوة في الانتظار',
    other: '{invitations} دعوة في الانتظار',
  },
  'inbox.empty.title': 'صندوق الوارد فارغ',
  'inbox.empty.body':
    'دعوات الرحلات وتغييرات الخطة وتنبيهات الحجز والأرصدة المسوّاة تصل كلها إلى هنا.',
  'inbox.empty.action': 'العودة إلى اللوحة',
  'inbox.emptyUnread.title': 'لا جديد غير مقروء',
  'inbox.emptyUnread.body':
    'قرأت كل شيء. انتقل إلى «كل شيء» لتستعرض السجل السابق.',
  'inbox.emptyUnread.action': 'اعرض كل شيء',
  'inbox.row.new': 'جديد',
  'inbox.row.accepted': 'مقبولة',
  'inbox.row.declined': 'مرفوضة',
  'inbox.row.open': 'فتح',
  'inbox.row.markRead': 'مقروء',
  'inbox.row.markingRead': 'جارٍ التعليم كمقروء',
  'inbox.row.markReadFailed': 'تعذّر تعليم ذلك كمقروء',
  'inbox.preferences': 'اختر أيًّا منها يصل إلى صندوق الوارد وبريدك وهاتفك.',
  'inbox.preferencesAction': 'إعدادات الإشعارات',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'تلقيت دعوة إلى {tripTitle}',
  'notification.trip.invited.body': 'أضافك {actorName} إلى الرحلة.',
  'notification.trip.updated.title': 'تم تحديث {tripTitle}',
  'notification.trip.updated.body': 'غيّر {actorName} الخطة.',
  'notification.trip.member_added.title': 'انضم {memberName} إلى {tripTitle}',
  'notification.trip.member_added.body':
    'يمكنه الآن رؤية البرنامج والحجوزات والمصاريف.',
  'notification.trip.member_removed.title':
    'غادر {memberName} رحلة {tripTitle}',
  'notification.trip.member_removed.body': 'انتهى وصوله إلى الرحلة.',
  'notification.trip.starting_soon.title': {
    zero: 'تبدأ {tripTitle} بعد {days} يوم',
    one: 'تبدأ {tripTitle} بعد يوم واحد',
    two: 'تبدأ {tripTitle} بعد يومين',
    few: 'تبدأ {tripTitle} بعد {days} أيام',
    many: 'تبدأ {tripTitle} بعد {days} يومًا',
    other: 'تبدأ {tripTitle} بعد {days} يوم',
  },
  'notification.trip.starting_soon.body':
    'حان وقت مراجعة قائمة الحزم والحجوزات.',
  'notification.trip.copied.title': '{tripTitle} جاهزة',
  'notification.trip.copied.body': {
    zero: 'لم ينتقل أي يوم',
    one: 'انتقل يوم واحد',
    two: 'انتقل يومان',
    few: 'انتقلت {days} أيام',
    many: 'انتقل {days} يومًا',
    other: 'انتقل {days} يوم',
  },
  'notification.trip.copied.places': {
    zero: 'ولا مكان',
    one: 'مكان واحد',
    two: 'مكانان',
    few: '{places} أماكن',
    many: '{places} مكانًا',
    other: '{places} مكان',
  },
  'notification.trip.copied.dropped': {
    zero: 'لم تُسقَط أي ملاحظة',
    one: 'أُسقطت ملاحظة واحدة',
    two: 'أُسقطت ملاحظتان',
    few: 'أُسقطت {dropped} ملاحظات',
    many: 'أُسقطت {dropped} ملاحظة',
    other: 'أُسقطت {dropped} ملاحظة',
  },
  'notification.trip.copyFailed.title': 'تعذّر نسخ {tripTitle}',
  'notification.trip.copyFailed.body': 'لم يُفقَد شيء. حاول مرة أخرى من الأصل.',
  'notification.reservation.reminder.title': 'يقترب موعد {title}',
  'notification.reservation.reminder.body':
    'راجع الوقت ورمز التأكيد في الحجز نفسه.',
  'notification.reservation.confirmed.title': 'تم تأكيد {title}',
  'notification.reservation.confirmed.body':
    'صار الحجز مؤكَّدًا في رحلة {tripTitle}.',
  'notification.expense.added.title': 'أضاف {actorName} مصروفًا',
  'notification.expense.added.body': '{title} في {tripTitle}.',
  'notification.expense.settled.title': 'سوّى {actorName} حسابه',
  'notification.expense.settled.body': 'تم سداد الرصيد في {tripTitle}.',
  'notification.list.assigned.title': 'أسند إليك {actorName} عنصرًا',
  'notification.list.assigned.body': '{title} في {tripTitle}.',
  'notification.collab.message.title': 'كتب {actorName} في {tripTitle}',
  'notification.collab.message.body': '«{preview}»',
  'notification.collab.poll.title': 'هناك تصويت مفتوح في {tripTitle}',
  'notification.collab.poll.body': '«{question}»',
  'notification.organization.invited.title':
    'تلقيت دعوة إلى {organizationName}',
  'notification.organization.invited.body':
    'اقبل الدعوة لتنضم إلى مساحة العمل وكل ما يُشارَك فيها.',
  'notification.journey.published.title': 'تم نشر {title}',
  'notification.journey.published.body':
    'يمكن لأي شخص لديه الرابط قراءة اليوميات الآن.',
  'notification.billing.plan_changed.title': 'تغيّرت خطتك',
  'notification.billing.plan_changed.body':
    'أصبحت {organizationName} على خطة {plan}.',
  'notification.billing.invoice_paid.title': 'تم استلام الدفعة',
  'notification.billing.invoice_paid.body':
    'تم دفع أحدث فاتورة لـ {organizationName}.',
  'notification.billing.payment_failed.title': 'تعذّر إتمام الدفع',
  'notification.billing.payment_failed.body':
    'على {organizationName} دفعة متأخرة. حدّث طريقة الدفع للحفاظ على الخطة.',
  'notification.fallback.title': 'حدث تغيير في مساحة عملك',
  'notification.fallback.body': 'افتح الرحلة لترى ما هو.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'لم تُحمّل اللوحة',
  'dashboard.blank.title': 'رحلتك القادمة تبدأ من هنا',
  'dashboard.blank.body':
    'أنشئ رحلة، وضع على الخريطة الأماكن التي تريد رؤيتها، وسيبني planned.travel خطة الأيام حولها.',
  'dashboard.blank.action': 'خطّط رحلة',
  'dashboard.blank.secondary': 'اطّلع على أطلسك',

  'dashboard.upNext': 'التالي',
  'dashboard.openPlan': 'افتح الخطة',
  'dashboard.hero.travellers': 'المسافرون',
  'dashboard.hero.datesMissing': 'أضف التواريخ لتُبنى الأيام',
  'dashboard.hero.startsIn': 'تبدأ بعد',
  'dashboard.hero.started': 'بدأت',
  'dashboard.hero.today': 'اليوم',
  'dashboard.hero.startUnknown': 'بلا تاريخ بداية',
  'dashboard.hero.startToday': 'رحلة موفقة',
  'dashboard.hero.startPast': {
    zero: 'أيام مضت',
    one: 'يوم مضى',
    two: 'يومان مضيا',
    few: 'أيام مضت',
    many: 'يومًا مضى',
    other: 'يوم مضى',
  },
  'dashboard.hero.startFuture': {
    zero: 'أيام',
    one: 'يوم',
    two: 'يومان',
    few: 'أيام',
    many: 'يومًا',
    other: 'يوم',
  },
  'dashboard.hero.nights': 'الليالي',
  'dashboard.hero.companionsHint': 'في هذه الرحلة',
  'dashboard.hero.progress': 'جارية الآن',
  'dashboard.hero.places': 'الأماكن',
  'dashboard.hero.placesNone': 'لا شيء على الخريطة بعد',
  'dashboard.hero.placesHint': 'على الخريطة',

  'dashboard.stat.countries': 'الدول التي زرتها',
  'dashboard.stat.countriesUnit': 'من {total}',
  'dashboard.stat.countriesNone': 'علّم دولة لتبدأ أطلسك',
  'dashboard.stat.visits': {
    zero: '{visits} زيارة مسجّلة',
    one: 'زيارة واحدة مسجّلة',
    two: 'زيارتان مسجّلتان',
    few: '{visits} زيارات مسجّلة',
    many: '{visits} زيارة مسجّلة',
    other: '{visits} زيارة مسجّلة',
  },
  'dashboard.stat.trips': 'إجمالي الرحلات',
  'dashboard.stat.tripsCaption': '{planning} قيد التخطيط · {booked} محجوزة',
  'dashboard.stat.places': 'الأماكن على الخريطة',
  'dashboard.stat.placesNone': 'لم يُضف شيء إلى الخريطة بعد',
  'dashboard.stat.placesAcross': {
    zero: 'في {trips} رحلة',
    one: 'في رحلة واحدة',
    two: 'في رحلتين',
    few: 'في {trips} رحلات',
    many: 'في {trips} رحلة',
    other: 'في {trips} رحلة',
  },
  'dashboard.stat.bookings': 'الحجوزات المؤكدة',
  'dashboard.stat.bookingsNone': 'لا حجوزات قادمة',
  'dashboard.stat.bookingsSoon': {
    zero: '{bookings} حجز في الطريق',
    one: 'حجز واحد في الطريق',
    two: 'حجزان في الطريق',
    few: '{bookings} حجوزات في الطريق',
    many: '{bookings} حجزًا في الطريق',
    other: '{bookings} حجز في الطريق',
  },

  'dashboard.trips.label': 'رحلاتك',
  'dashboard.trips.all': 'كل الرحلات',
  'dashboard.trips.empty.title': 'لا رحلات بعد',
  'dashboard.trips.empty.body': 'كل ما تخطط له يظهر هنا، الأحدث أولًا.',
  'dashboard.trips.empty.action': 'أنشئ رحلة',

  'dashboard.bookings.label': 'الحجوزات القادمة',
  'dashboard.bookings.empty.title': 'لا حجوزات بعد',
  'dashboard.bookings.empty.body':
    'تظهر هنا الإقامات والطاولات والتذاكر المؤكدة كلما اقترب موعدها.',

  'dashboard.pipeline.label': 'مسار الرحلات',
  'dashboard.pipeline.empty':
    'لا شيء في المسار. أول رحلة لك ستوزّع هذا على مراحله.',
  'dashboard.pipeline.favourites': {
    zero: '{favourites} رحلة مفضلة',
    one: 'رحلة مفضلة واحدة',
    two: 'رحلتان مفضلتان',
    few: '{favourites} رحلات مفضلة',
    many: '{favourites} رحلة مفضلة',
    other: '{favourites} رحلة مفضلة',
  },
  'dashboard.pipeline.archived': {
    zero: '{archived} رحلة مؤرشفة',
    one: 'رحلة واحدة مؤرشفة',
    two: 'رحلتان مؤرشفتان',
    few: '{archived} رحلات مؤرشفة',
    many: '{archived} رحلة مؤرشفة',
    other: '{archived} رحلة مؤرشفة',
  },

  'dashboard.storage.label': 'المساحة',
  'dashboard.storage.count': '{used} من {limit}',
  'dashboard.storage.files': {
    zero: '{files} ملف في كل رحلاتك، بينها الصور والتذاكر.',
    one: 'ملف واحد في كل رحلاتك، بينه الصور والتذاكر.',
    two: 'ملفان في كل رحلاتك، بينهما الصور والتذاكر.',
    few: '{files} ملفات في كل رحلاتك، بينها الصور والتذاكر.',
    many: '{files} ملفًا في كل رحلاتك، بينها الصور والتذاكر.',
    other: '{files} ملف في كل رحلاتك، بينها الصور والتذاكر.',
  },
  'dashboard.storage.more': 'تحتاج مساحة أكبر؟',
  'dashboard.storage.plans': 'اطّلع على الخطط',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'مرجع',
  'dashboard.widgets.choose': 'اختر الأدوات',
  'dashboard.widgets.description': 'الأدوات التي تبقيها بجانب لوحتك.',
  'dashboard.clock.label': 'ساعة عالمية',
  'dashboard.clock.add': 'أضف منطقة زمنية',
  'dashboard.clock.search': 'ابحث عن المدن والمناطق',
  'dashboard.clock.noMatches': 'لا توجد منطقة زمنية بهذا الاسم',
  'dashboard.clock.remove': 'إزالة {zone}',
  'dashboard.clock.offset': '{offset} عن توقيتك',
  'dashboard.clock.here': 'توقيتك أنت',
  'dashboard.clock.empty.title': 'لا توجد مناطق زمنية مثبّتة',
  'dashboard.clock.empty.body': 'ثبّت مكانًا واقرأ ساعته بجانب ساعتك.',
  'dashboard.clock.unknown.title': 'هذا الجهاز لا يعرف {zone}',
  'dashboard.clock.unknown.body':
    'لا يمكن قراءة توقيتها هنا. أزل الصف لتصحيح ذلك.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'لم تُحمّل لوحة الإدارة',
  'admin.denied.title': 'مسؤولو مساحة العمل وحدهم يفتحون هذه الصفحة',
  'admin.denied.body':
    'اطلب من مالك مساحة العمل أو أحد مسؤوليها تغيير دورك إن كنت بحاجة إليه.',
  'admin.denied.action': 'العودة إلى اللوحة',
  'admin.eyebrow': 'إدارة مساحة العمل',
  'admin.description': 'خطة {plan} · أُنشئت في {date}',
  'admin.createdUnknown': 'حديثًا',
  'admin.workspaceSettings': 'إعدادات مساحة العمل',
  'admin.billing': 'الخطة والفواتير',

  'admin.invitations.title': {
    zero: '{invitations} دعوة لا تزال معلّقة',
    one: 'دعوة واحدة لا تزال معلّقة',
    two: 'دعوتان لا تزالان معلّقتين',
    few: '{invitations} دعوات لا تزال معلّقة',
    many: '{invitations} دعوة لا تزال معلّقة',
    other: '{invitations} دعوة لا تزال معلّقة',
  },
  'admin.invitations.body':
    'كل دعوة معلّقة تُحسب من المقاعد التي تدفع خطتك ثمنها.',
  'admin.invitations.action': 'مراجعة الدعوات',

  'admin.stat.members': 'الأعضاء',
  'admin.stat.membersCaption': {
    zero: '{invitations} دعوة قيد الانتظار',
    one: 'دعوة واحدة قيد الانتظار',
    two: 'دعوتان قيد الانتظار',
    few: '{invitations} دعوات قيد الانتظار',
    many: '{invitations} دعوة قيد الانتظار',
    other: '{invitations} دعوة قيد الانتظار',
  },
  'admin.stat.storage': 'المساحة',
  'admin.stat.storageUnit': 'من {limit}',
  'admin.stat.storageUnlimited': 'بلا حد',
  'admin.stat.storageCaption': 'الملفات والصور وملفات التصدير',
  'admin.stat.audit': 'قيود التدقيق',
  'admin.stat.auditCaption': 'أحدث النشاط معروض أدناه',
  'admin.stat.plan': 'الخطة',
  'admin.stat.planCaption': 'الحدود تُطبَّق عند حدّ مستودع البيانات',

  'admin.quotas.label': 'الحدود',
  'admin.quotas.count': {
    zero: '{metrics} مقياس',
    one: 'مقياس واحد',
    two: 'مقياسان',
    few: '{metrics} مقاييس',
    many: '{metrics} مقياسًا',
    other: '{metrics} مقياس',
  },
  'admin.quotas.unlimited': 'بلا حدود',
  'admin.quotas.value': '{used} من أصل {limit}',

  'admin.members.label': 'الأعضاء',
  'admin.members.table': 'أعضاء مساحة العمل هذه',
  'admin.members.person': 'الشخص',
  'admin.members.role': 'الدور',
  'admin.members.joined': 'تاريخ الانضمام',

  'admin.activity.label': 'النشاط الأخير',
  'admin.activity.empty.title': 'لا شيء مسجّل بعد',
  'admin.activity.empty.body':
    'كل كتابة ذات أثر تُضاف إلى سجل التدقيق لحظة حدوثها.',
  'admin.activity.workspace': 'مساحة العمل نفسها',
  'admin.actions.label': 'أكثر الإجراءات تكرارًا',
  'admin.actions.count': {
    zero: '{actions} إجراء',
    one: 'إجراء واحد',
    two: 'إجراءان',
    few: '{actions} إجراءات',
    many: '{actions} إجراءً',
    other: '{actions} إجراء',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'مسودة',
  'tripStatus.planning': 'قيد التخطيط',
  'tripStatus.booked': 'محجوزة',
  'tripStatus.active': 'جارية',
  'tripStatus.completed': 'منتهية',
  'tripStatus.archived': 'مؤرشفة',

  'bookingStatus.none': 'غير محجوز',
  'bookingStatus.pending': 'قيد الانتظار',
  'bookingStatus.confirmed': 'مؤكَّد',
  'bookingStatus.cancelled': 'ملغى',
  'bookingStatus.completed': 'منجز',

  'bookingType.accommodation': 'إقامة',
  'bookingType.restaurant': 'طاولة',
  'bookingType.activity': 'نشاط',
  'bookingType.tour': 'جولة',
  'bookingType.ticket': 'تذكرة',
  'bookingType.transport': 'تنقل',
  'bookingType.other': 'حجز',

  'role.owner': 'المالك',
  'role.admin': 'مسؤول',
  'role.member': 'عضو',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    zero: '{value} رحلة',
    one: 'رحلة واحدة',
    two: 'رحلتان',
    few: '{value} رحلات',
    many: '{value} رحلة',
    other: '{value} رحلة',
  },
  'trips.count.favourites': {
    zero: '{value} مفضّلة',
    one: 'مفضّلة واحدة',
    two: 'مفضّلتان',
    few: '{value} مفضّلات',
    many: '{value} مفضّلة',
    other: '{value} مفضّلة',
  },
  'trips.count.archived': {
    zero: '{value} في الأرشيف',
    one: 'واحدة في الأرشيف',
    two: 'اثنتان في الأرشيف',
    few: '{value} في الأرشيف',
    many: '{value} في الأرشيف',
    other: '{value} في الأرشيف',
  },
  'trips.atLimit.body':
    'خطتك تغطي {trips}. أرشِف واحدة انتهت، أو ارتقِ بالخطة لتُبقي عددًا أكبر مفتوحًا في الوقت نفسه.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'دفتر رحلة جديد',
  'newJourney.title': 'ابدأ دفتر رحلة',
  'newJourney.description':
    'دفتر الرحلة هو وجهها المكتوب: مُدخلات بترتيب التواريخ، مع الصور والطقس الذي تتذكره.',
  'newJourney.titlePlaceholder': 'أسبوعان في كيوتو',
  'newJourney.subtitle': 'عنوان فرعي',
  'newJourney.subtitleHint': 'سطر واحد تحت العنوان، على الغلاف.',
  'newJourney.subtitlePlaceholder': 'معابد وقطارات وماتشا أكثر من اللازم',
  'newJourney.trip': 'استنادًا إلى رحلة',
  'newJourney.tripHint': 'اختياري — يربط الحكاية بخطتها.',
  'newJourney.tripNone': 'غير مرتبط برحلة',
  'newJourney.datesError': 'تاريخ الانتهاء قبل البداية.',
  'newJourney.submit': 'أنشئ الدفتر',
  'newJourney.creating': 'يجري إنشاء الدفتر',
  'newJourney.created': 'بدأ الدفتر',
  'newJourney.createdBody': 'أضف أول مُدخل لتبدأ الحكاية.',
  'newJourney.error': 'لم يتسنَّ إنشاء الدفتر. أعد المحاولة بعد لحظة.',
  'newCollection.trigger': 'مجموعة جديدة',
  'newCollection.title': 'ابدأ مجموعة',
  'newCollection.description':
    'مكان للأماكن التي تجدها قبل أن تعرف إلى أي رحلة تنتمي.',
  'newCollection.namePlaceholder': 'قهوة تستحق عبور المدينة',
  'newCollection.descriptionHint': 'ما ينتمي إلى هنا وما لا ينتمي.',
  'newCollection.submit': 'أنشئ المجموعة',
  'newCollection.creating': 'يجري إنشاء المجموعة',
  'newCollection.created': 'أُنشئت المجموعة',
  'newCollection.createdBody': 'ابدأ بحفظ الأماكن فيها.',
  'newCollection.error': 'لم يتسنَّ إنشاء المجموعة. أعد المحاولة بعد لحظة.',

  'newTrip.title': 'ابدأ رحلة جديدة',
  'newTrip.description':
    'العنوان وحده يكفي. التواريخ تبني خطة الأيام، وما تبقّى يمكن أن ينتظر حتى تعرفه.',
  'newTrip.name': 'اسم الرحلة',
  'newTrip.namePlaceholder': 'كيوتو في موسم أزهار الكرز',
  'newTrip.destination': 'الوجهة',
  'newTrip.destinationHint': 'مدينة، أو منطقة، أو المسار كله.',
  'newTrip.destinationPlaceholder': 'كيوتو، اليابان',
  'newTrip.departure': 'المغادرة',
  'newTrip.return': 'العودة',
  'newTrip.returnError': 'تاريخ العودة قبل المغادرة.',
  'newTrip.currency': 'عملة الميزانية',
  'newTrip.currencyHint': 'بها يُجمَع كل مصروف في هذه الرحلة.',
  'newTrip.currencySearch': 'ابحث بالرمز أو الاسم',
  'newTrip.currencyEmpty': 'لا توجد عملة مطابقة.',
  'newTrip.currencyFavourites': 'المفضلة',
  'newTrip.currencyAll': 'كل العملات',
  'newTrip.summary': 'الملخص',
  'newTrip.summaryPlaceholder': 'أسبوعان من المعابد والقطارات والرامن.',
  'newTrip.duration': 'المدة بالأيام',
  'newTrip.durationHint':
    'من دون تواريخ، تبدأ الرحلة بهذا العدد من الأيام غير المؤرخة.',
  'newTrip.durationDerived': 'تُحسب من التاريخين.',
  'newTrip.reminder': 'تذكير قبل المغادرة',
  'newTrip.reminderNone': 'بدون',
  'newTrip.reminderBefore': {
    zero: 'قبل {count} يوم',
    one: 'قبل يوم واحد',
    two: 'قبل يومين',
    few: 'قبل {count} أيام',
    many: 'قبل {count} يومًا',
    other: 'قبل {count} يوم',
  },
  'newTrip.reminderCustom': 'مخصص',
  'newTrip.reminderCustomDays': 'عدد الأيام قبل المغادرة',
  'newTrip.reminderOn': 'التذكير في {date}',
  'newTrip.reminderNoDeparture': 'اختر تاريخ المغادرة لتعرف اليوم.',
  'newTrip.submit': 'أنشئ الرحلة',
  'newTrip.creating': 'يجري إنشاء الرحلة',
  'newTrip.error': 'لم يتسنَّ إنشاء الرحلة. أعد المحاولة بعد لحظة.',
  'newTrip.created': 'أُنشئت الرحلة',
  'newTrip.createdBody': 'ابدأ بوضع الأماكن على الخريطة.',
  'newTrip.coverChoose': 'أضف صورة غلاف',
  'newTrip.coverChange': 'غيّر صورة الغلاف',
  'newTrip.coverHint':
    'أسقط صورة هنا أو الصقها أو اختر ملفًا. PNG أو JPEG أو WebP أو AVIF أو GIF.',
  'newTrip.coverChosen': 'صورة الغلاف: {name}',
  'newTrip.coverRemove': 'أزل صورة الغلاف',
  'newTrip.coverTypeError':
    'لا يمكن استخدام «{name}» صورة غلاف. اختر ملف PNG أو JPEG أو WebP أو AVIF أو GIF.',
  'newTrip.coverSizeError': 'حجم «{name}» أكبر من {max}. اختر صورة أصغر.',
  'newTrip.coverUploading': 'يجري رفع صورة الغلاف',
  'newTrip.coverFailedTitle': 'لم تُضف صورة الغلاف',
  'newTrip.coverFailed': 'أُنشئت الرحلة، لكن تعذّر رفع «{name}» كغلاف لها.',
  'newTrip.coverRetry': 'حاول مرة أخرى',
  'newTrip.coverContinue': 'افتح الرحلة بلا غلاف',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'إجراءات {title}',
  'tripActions.copy': 'نسخ',
  'tripActions.favourite': 'إضافة إلى المفضّلة',
  'tripActions.unfavourite': 'إزالة من المفضّلة',
  'tripActions.edit': 'تعديل',
  'tripActions.archive': 'أرشفة',
  'tripActions.restore': 'استعادة',
  'tripActions.delete': 'حذف',
  'tripActions.deleteForGood': 'حذف نهائي',
  'tripActions.starFailed': 'لم يُحفَظ التفضيل',
  'tripActions.starFallback': 'عادت الرحلة كما كانت.',
  'tripActions.archived': 'تمت أرشفة الرحلة',
  'tripActions.archiveFailed': 'تعذّرت أرشفة الرحلة',
  'tripActions.restored': 'تمت استعادة الرحلة',
  'tripActions.restoreFailed': 'تعذّرت استعادة الرحلة',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'تعديل الرحلة',
  'editTrip.submit': 'حفظ التغييرات',
  'editTrip.saving': 'جارٍ حفظ الرحلة',
  'editTrip.cancel': 'إلغاء',
  'editTrip.saved': 'تم تحديث الرحلة',
  'editTrip.errorTitle': 'لم يُحفَظ ذلك',
  'editTrip.retry': 'حاول مرة أخرى',
  'editTrip.error': 'تعذّر حفظ الرحلة. حاول مرة أخرى بعد قليل.',
  'editTrip.coverFailed': 'تعذّر رفع «{name}» كغلاف. لم يُحفظ أي شيء آخر بعد.',
  'editTrip.coverContinue': 'احفظ بلا الغلاف الجديد',
  'editTrip.currencyLocked':
    'لهذه الرحلة أسعار مسجَّلة بالفعل، لذا لا يمكن تغيير عملة الميزانية من هنا. استخدم «غيّر عملة الميزانية» في تبويب التكاليف، أو أعِد ضبطها على {current} لحفظ تغييراتك الأخرى.',
  'editTrip.currencyReadonly': 'تُغيَّر عملة الميزانية من تبويب التكاليف.',
  'editTrip.currencyLink': 'افتح تبويب التكاليف',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'حذف «{title}» نهائيًا؟',
  'deleteTrip.description':
    'لا تراجع ولا سلة محذوفات. الأرشفة تُخرج الرحلة من القائمة دون فقدانها.',
  'deleteTrip.reading': 'جارٍ قراءة محتويات هذه الرحلة',
  'deleteTrip.errorTitle': 'لم يتم التحميل',
  'deleteTrip.summaryError': 'تعذّرت قراءة محتويات هذه الرحلة.',
  'deleteTrip.confirmLabel': 'اكتب اسم الرحلة للتأكيد',
  'deleteTrip.deleting': 'جارٍ حذف الرحلة',
  'deleteTrip.deleted': 'تم حذف الرحلة',
  'deleteTrip.failed': 'تعذّر حذف الرحلة',
  'deleteTrip.carried.reservations': {
    zero: 'حجز',
    one: 'حجز',
    two: 'حجزان',
    few: 'حجوزات',
    many: 'حجزًا',
    other: 'حجز',
  },
  'deleteTrip.carried.transports': {
    zero: 'تنقّل',
    one: 'تنقّل',
    two: 'تنقّلان',
    few: 'تنقّلات',
    many: 'تنقّلًا',
    other: 'تنقّل',
  },
  'deleteTrip.carried.expenses': {
    zero: 'مصروف',
    one: 'مصروف',
    two: 'مصروفان',
    few: 'مصروفات',
    many: 'مصروفًا',
    other: 'مصروف',
  },
  'deleteTrip.carried.files': {
    zero: 'ملف',
    one: 'ملف',
    two: 'ملفان',
    few: 'ملفات',
    many: 'ملفًا',
    other: 'ملف',
  },
  'deleteTrip.carried.members': {
    zero: 'شخص',
    one: 'شخص',
    two: 'شخصان',
    few: 'أشخاص',
    many: 'شخصًا',
    other: 'شخص',
  },
  'copyTrip.title': 'نسخ «{title}»',
  'copyTrip.nameLabel': 'اسم النسخة',
  'copyTrip.titleRequired': 'أعطِ النسخة اسمًا.',
  'copyTrip.datesLabel': 'التواريخ',
  'copyTrip.datesTogether': 'حدّد التاريخين معًا أو امسحهما معًا.',
  'copyTrip.clearDates': 'نسخ بدون تواريخ',
  'copyTrip.carries':
    'الأيام والأماكن والملاحظات تنتقل إلى النسخة. أما الحجوزات والمصاريف والملفات والأشخاص فلا.',
  'copyTrip.shorter':
    'هذه المدة أقصر من الأصل. أماكن الأيام الزائدة تنتقل إلى الأفكار، وتُسقَط ملاحظاتها.',
  'copyTrip.submit': 'نسخ الرحلة',
  'copyTrip.copying': 'يجري نسخ الرحلة',
  'copyTrip.cancel': 'إلغاء',
  'copyTrip.started': 'يجري نسخ «{title}»',
  'copyTrip.errorTitle': 'لم يُنسَخ ذلك',
  'copyTrip.error': 'تعذّر نسخ الرحلة. حاول مرة أخرى بعد قليل.',

  'trips.error': 'لم تُحمَّل رحلاتك',
  'trips.eyebrow': 'مساحة العمل',
  'trips.nothingPlanned': 'لا شيء مخطَّط بعد',
  'trips.search': 'ابحث في الرحلات',
  'trips.atLimit.title': 'استهلكت كل رحلة تسمح بها خطتك',
  'trips.atLimit.action': 'قارن الخطط',
  'trips.noMatch.title': 'لا شيء يطابق هذا المرشِّح',
  'trips.noMatch.body': 'جرّب مرحلة أخرى، أو أفرِغ البحث، أو انظر في الأرشيف.',
  'trips.noMatch.action': 'صفِّر المرشِّحات',
  'trips.empty.body':
    'الرحلة تجمع خطة الأيام والخريطة والحجوزات وقوائم الحِمل والمال. ابدأ واحدة ويأتي الباقي وراءها.',
  'trips.next.title': 'إلى مكان بعد ذلك',
  'trips.next.body':
    'ابدأ رحلة وسيبني planned.travel يومًا لكل تاريخ، جاهزًا لكل ما حفظته.',
  'trips.savedPlaces': 'الأماكن المحفوظة',
  'trips.filter.all': 'الكل',
  'trips.filter.favourites': 'المفضّلة',
  'trips.view.label': 'طريقة العرض',
  'trips.view.grid': 'شبكة',
  'trips.view.list': 'قائمة',
  'trips.card.favourite': 'مفضّلة',
  'trips.card.noDestination': 'الوجهة غير محدَّدة بعد',
  'trips.card.noDates': 'التواريخ غير محدَّدة بعد',
  'trips.card.startsIn': 'بعد {days} يوم',
  'trips.card.days': '{days} يوم',
  'trips.card.copying': 'قيد النسخ',
  'trips.card.copyingLabel': 'لا يزال {title} قيد النسخ',
  'trips.card.copyingReason': 'انتظر حتى ينتهي النسخ.',
  'metric.trips': 'الرحلات',
  'metric.places': 'الأماكن',
  'metric.members': 'الأعضاء',
  'metric.files': 'الملفات',
  'metric.storage_bytes': 'المساحة',
  'metric.collections': 'المجموعات',
  'metric.journeys': 'اليوميات',

  /* -------------------------------------------------------------- failures */
  'error.title': 'لم يُحمّل هذا',
  'error.body':
    'لم يُفقد شيء. أعد المحاولة، وإن تكرر الأمر فأرسل لنا التفصيل الظاهر أدناه.',
  'error.retry': 'أعد المحاولة',
  'error.dashboard': 'الرجوع إلى اللوحة',
  'error.reported': 'وصلنا إشعار بالمشكلة ونحن نبحث فيها.',
  'error.reference': 'الرقم المرجعي',
  'error.feedback.open': 'أخبرنا بما حدث',
  'error.feedback.label': 'ماذا كنت تفعل عندما حدث هذا؟',
  'error.feedback.send': 'إرسال',
  'error.feedback.sent': 'شكرًا لك — هذا يساعدنا.',
  'error.feedback.failed': 'لم يُرسَل. الرقم المرجعي أعلاه ما زال يصل إلينا.',
  'error.root': 'خرجنا عن المسار',
  'error.session': 'تغيّر وصولك إلى مساحة العمل',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'الإبلاغ عن مشكلة',
  'feedback.formTitle': 'الإبلاغ عن مشكلة',
  'feedback.messageLabel': 'ما الخطأ، أو ما الذي ينبغي تغييره؟',
  'feedback.messagePlaceholder': 'ماذا كنت تتوقع، وماذا حدث بدلًا من ذلك؟',
  'feedback.emailLabel': 'البريد الإلكتروني',
  'feedback.emailPlaceholder': 'sara@example.com',
  'feedback.isRequiredLabel': '(مطلوب)',
  'feedback.submitButtonLabel': 'إرسال البلاغ',
  'feedback.cancelButtonLabel': 'إلغاء',
  'feedback.confirmButtonLabel': 'تأكيد',
  'feedback.addScreenshotButtonLabel': 'إضافة لقطة شاشة',
  'feedback.removeScreenshotButtonLabel': 'إزالة لقطة الشاشة',
  'feedback.highlightToolText': 'تمييز',
  'feedback.hideToolText': 'إخفاء',
  'feedback.successMessageText': 'شكرًا لك — وصلنا بلاغك.',
  'feedback.errorEmptyMessageText':
    'اكتب جملة أولًا — البلاغ الفارغ لا يخبرنا بشيء.',
  'feedback.errorTimeoutText':
    'الأمر يستغرق وقتًا طويلًا، ولا يمكننا تأكيد إرسال البلاغ.',
  'feedback.errorForbiddenText': 'هذه الصفحة غير مسموح لها بإرسال البلاغات.',
  'feedback.errorGenericText':
    'لم يُرسَل. تحقق من الاتصال، وممّا إذا كان مانع الإعلانات يعترض الطريق.',

  'notFound.eyebrow': 'خطأ 404',
  'notFound.title': 'هذه الصفحة ليست على الخريطة',
  'notFound.body':
    'قد يكون الرابط قديمًا، أو أن الرحلة التي كان يشير إليها نُقلت أو حُذفت.',
  'notFound.trips': 'كل الرحلات',
  'notFound.rootBody':
    'بحثنا في كل مكان على الطريق. قد يكون العنوان مكتوبًا خطأً، أو أن الصفحة انتقلت منذ ذلك الحين.',
  'notFound.home': 'العودة إلى الرئيسية',
  'notFound.plans': 'اطّلع على خططنا',

  'session.noWorkspace':
    'حسابك غير مرتبط بمساحة عمل بعد. سجّل الخروج ثم الدخول مرة أخرى لإكمال إعداده.',
  'session.membershipRemoved': 'أُلغيت عضويتك في مساحة العمل هذه.',
} satisfies TranslationOf<typeof En>

export default messages
