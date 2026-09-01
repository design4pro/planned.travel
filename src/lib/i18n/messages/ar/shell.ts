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
  'dashboard.hero.travellersHint': 'في مساحة العمل هذه',
  'dashboard.hero.dates': 'تواريخ الرحلة',
  'dashboard.hero.datesUnset': 'غير محددة',
  'dashboard.hero.datesHint': {
    zero: '{days} يوم',
    one: 'يوم واحد',
    two: 'يومان',
    few: '{days} أيام',
    many: '{days} يومًا',
    other: '{days} يوم',
  },
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
  'newTrip.submit': 'أنشئ الرحلة',
  'newTrip.creating': 'يجري إنشاء الرحلة',
  'newTrip.error': 'لم يتسنَّ إنشاء الرحلة. أعد المحاولة بعد لحظة.',
  'newTrip.created': 'أُنشئت الرحلة',
  'newTrip.createdBody': 'ابدأ بوضع الأماكن على الخريطة.',

  /* ------------------------------------ who can see a thing */
  'visibility.label': 'من يمكنه رؤيته',
  'visibility.private': 'أنا فقط',
  'visibility.organization': 'كل من في مساحة العمل',
  'visibility.public': 'كل من لديه الرابط',

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
  'trips.card.favourite': 'مفضّلة',
  'trips.card.noDestination': 'الوجهة غير محدَّدة بعد',
  'trips.card.noDates': 'التواريخ غير محدَّدة بعد',
  'trips.card.startsIn': 'بعد {days} يوم',
  'trips.card.days': '{days} يوم',
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
