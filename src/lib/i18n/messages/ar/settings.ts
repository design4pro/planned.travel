/**
 * Everything the settings module says, in Arabic.
 *
 * Made from `../en/settings.ts` and from nothing else. `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations, so every sentence here was written against our English source.
 *
 * **Six branches.** `Intl.PluralRules` reports zero, one, two, few, many and
 * other for `ar`, and `__tests__/parity.test.ts` requires all six. The forms
 * follow Arabic number agreement: 1 takes the singular, 2 the dual, 3–10 the
 * broken plural, 11–99 the accusative singular and 100 upwards the singular
 * again. `one` and `two` therefore drop the numeral placeholder, and the gate
 * compares the union of placeholders across the branches rather than each
 * branch on its own.
 *
 * **A plan's name is a word, not a mark.** `billing.plan.<id>.name` is
 * translated like any other noun here, because the id — `free`, `solo`, `crew`
 * — is what `src/lib/plans.ts`, Polar and the invoice carry, and no reader ever
 * sees it. `Polar` and `PDF` stay as they are: one is a company, the other a
 * format.
 *
 * **A language is never named in English**, and never named here either: all
 * twenty-three come from the frozen registry in `src/lib/i18n/locales.ts`, so no
 * key below spells one. Currency *names* are translated; the ISO code beside
 * them is derived in the route.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'الحساب',
  'page.title': 'الإعدادات',
  'page.description': 'كل ما يتعلق بك وبمساحة عملك وبطريقة عمل planned.travel',
  'page.error': 'لم تُحمّل الإعدادات',

  'nav.label': 'أقسام الإعدادات',
  'nav.profile': 'الملف الشخصي',
  'nav.profile.hint': 'أنت، وكيف تُقرأ التواريخ والمبالغ',
  'nav.language': 'اللغة',
  'nav.language.hint': 'اللغة التي تتحدث بها كل الشاشات',
  'nav.appearance': 'المظهر',
  'nav.appearance.hint': 'الثيم والحركة والخريطة',
  'nav.security': 'الأمان',
  'nav.security.hint': 'كلمة المرور والتحقق ومفاتيح المرور',
  'nav.notifications': 'الإشعارات',
  'nav.notifications.hint': 'صندوق الوارد والبريد والهاتف',
  'nav.workspace': 'مساحة العمل',
  'nav.workspace.hint': 'الأعضاء والإعدادات المشتركة',
  'nav.billing': 'الفواتير',
  'nav.billing.hint': 'الخطة والمقاعد والإيصالات',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'حفظ التغييرات',
  'error.retryBody': 'لم يُفقد شيء. تحقق من اتصالك ثم أعد المحاولة.',
  'role.owner': 'المالك',
  'role.admin': 'مسؤول',
  'role.member': 'عضو',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'إعداد مساحة العمل — {value}',
  'regional.currency.AUD': 'الدولار الأسترالي',
  'regional.currency.CAD': 'الدولار الكندي',
  'regional.currency.CHF': 'الفرنك السويسري',
  'regional.currency.EUR': 'اليورو',
  'regional.currency.GBP': 'الجنيه الإسترليني',
  'regional.currency.JPY': 'الين الياباني',
  'regional.currency.PLN': 'الزلوتي البولندي',
  'regional.currency.SEK': 'الكرونة السويدية',
  'regional.currency.USD': 'الدولار الأمريكي',
  'regional.distance.metric': 'الكيلومترات',
  'regional.distance.imperial': 'الأميال',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'لم يُحمّل ملفك الشخصي',
  'profile.account.title': 'حسابك',
  'profile.account.description':
    'اسمك وبريدك يأتيان من الحساب الذي تسجّل الدخول به.',
  'profile.email.verified': 'البريد مُوثَّق',
  'profile.email.unverified': 'البريد غير مُوثَّق',
  'profile.twoFactor.on': 'التحقق بخطوتين مُفعَّل',
  'profile.figure.workspace': 'مساحة العمل',
  'profile.figure.role': 'الدور',
  'profile.figure.joined': 'عضو منذ',
  'profile.figure.joinedUnknown': 'غير مسجّل',
  'profile.regional.title': 'التواريخ والمبالغ والوحدات',
  'profile.regional.description':
    'هذه تتجاوز إعدادات مساحة العمل من أجلك وحدك. اترك أيًّا منها على الإعداد الافتراضي ليتبع مساحة العمل.',
  'profile.regional.saving': 'جارٍ حفظ تفضيلاتك',
  'profile.regional.saved': 'حُفظت تفضيلاتك',
  'profile.regional.saveFailed': 'لم تُحفظ تفضيلاتك',
  'profile.language.label': 'اللغة',
  'profile.language.hint':
    'تُختار في شاشة خاصة بها، حيث كل لغة مكتوبة بحروفها.',
  'profile.language.action': 'تغيير',
  'profile.timezone.label': 'المنطقة الزمنية',
  'profile.timezone.hint': 'مواعيد المغادرة والوصول تُعرض وفق هذه المنطقة.',
  'profile.currency.label': 'العملة',
  'profile.currency.hint':
    'الرحلات الجديدة تبدأ بهذه العملة، ويمكن لكل رحلة تجاوزها.',
  'profile.dateFormat.label': 'تنسيق التاريخ',
  'profile.weekStart.label': 'يبدأ الأسبوع يوم',
  'profile.weekStart.hint':
    'ينطبق على كل التقاويم، بما فيها شبكة سنة الإجازات.',
  'profile.distance.label': 'المسافة',

  /* --------------------------------------------------------------- language */
  'language.error': 'لم تُحمّل إعدادات لغتك',
  'language.section.title': 'اللغة',
  'language.section.description':
    'كل شاشة وكل زر وكل تاريخ يُقرأ باللغة التي تختارها هنا — ثلاث وعشرون لغة، كل واحدة مكتوبة بحروفها.',
  'language.label': 'اختر لغة',
  'language.followWorkspace': 'اتبع مساحة العمل',
  'language.state.yours': 'لغتك',
  'language.state.workspace': 'من مساحة العمل',
  'language.state.hint.override':
    'اختيارك الخاص. ينطبق عليك وحدك، على كل جهاز تسجّل منه الدخول.',
  'language.state.hint.workspace':
    'ليست لك لغة خاصة، فأنت تقرأ بما ضُبطت عليه مساحة العمل. ويمكن لمالكها أو أحد مسؤوليها تغيير ذلك من قسم مساحة العمل.',
  'language.saved': 'planned.travel يتحدث الآن {language}',
  'language.saveFailed': 'لم تتغير لغتك',
  'language.saveFailedBody':
    'لم يُفقد شيء وما زلت تقرأ {language}. تحقق من اتصالك ثم اختر مرة أخرى.',
  'language.reload.title': 'لغتك محفوظة',
  'language.reload.body':
    'لم تتمكن هذه الصفحة من إكمال التحويل إلى {language}. أعد تحميلها لتقرأ المنتج بلغتك الجديدة.',
  'language.sample.title': 'كيف تُقرأ التواريخ والأرقام',
  'language.sample.description':
    'القيم الثلاث نفسها، مكتوبة كما تكتبها هذه اللغة.',
  'language.sample.date': 'تاريخ',
  'language.sample.number': 'رقم',
  'language.sample.money': 'مبلغ',
  'language.legal':
    'الشروط وإشعار الخصوصية منشوران بالإنجليزية فقط. وكل ما عدا ذلك في المنتج مترجم.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'لم يُحمّل المظهر',
  'appearance.theme.title': 'الثيم',
  'appearance.theme.description':
    'الثيمان مُصمَّمان، لا أحدهما مقلوب عن الآخر. اختر الأيسر على عينك.',
  'appearance.theme.light': 'فاتح',
  'appearance.theme.lightHint': 'ورق دافئ، طول اليوم',
  'appearance.theme.dark': 'داكن',
  'appearance.theme.darkHint': 'فحمي دافئ، لا أسود أبدًا',
  'appearance.theme.system': 'النظام',
  'appearance.theme.systemHint': 'يتبع الجهاز',
  'appearance.theme.showing': 'المعروض الآن هو اللوح {palette}.',
  'appearance.theme.showingSystem':
    'المعروض الآن هو اللوح {palette}، تبعًا لجهازك.',
  'appearance.palette.light': 'الفاتح',
  'appearance.palette.dark': 'الداكن',
  'appearance.motion.title': 'الحركة والخرائط',
  'appearance.motion.label': 'تقليل الحركة',
  'appearance.motion.hint':
    'يقلّص حركات الدخول إلى تلاشٍ بسيط. وإعداد تقليل الحركة في نظام تشغيلك يُحترم دائمًا كذلك.',
  'appearance.map.label': 'نمط الخريطة',
  'appearance.map.hint': 'الخريطة الأساسية في المخطط والأطلس.',
  'appearance.map.workspace': 'اتبع مساحة العمل',
  'appearance.map.workspaceHint': 'ما اختاره مالك مساحة العمل.',
  'appearance.map.auto': 'تلقائي',
  'appearance.map.autoHint': 'يتبع مظهرك الفاتح أو الداكن.',
  'appearance.map.paper': 'ورقي',
  'appearance.map.paperHint': 'دافئ وفاتح مهما كان المظهر الذي تستخدمه.',
  'appearance.map.charcoal': 'فحمي',
  'appearance.map.charcoalHint': 'دافئ وداكن مهما كان المظهر الذي تستخدمه.',
  'appearance.map.quiet': 'هادئ',
  'appearance.map.quietHint': 'بلا أسماء طرق، لتظهر دبابيسك أولًا.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'على شاشة مشتركة',
  'appearance.privacy.codesLabel': 'إخفاء رموز التأكيد حتى أطلبها',
  'appearance.privacy.codesHint':
    'تبقى مراجع الحجز وأرقام التأكيد مخفيّة في مكتب الحجوزات وفي التنقلات حتى تنقرها أو تلمسها، ثم تُخفى من جديد عندما تنتقل إلى غيرها. أما الأسعار فلا تُخفى أبداً.',
  'appearance.saveFailed': 'لم يُخزَّن ذلك التغيير',
  'appearance.saveFailedBody':
    'يظهر هنا، لكن الجهاز التالي الذي تسجّل منه الدخول لن يحمله.',

  /* --------------------------------------------------------------- security */
  'security.error': 'لم يُحمّل الأمان',
  'security.unverified.title': 'لم يُوثَّق بريدك الإلكتروني بعد',
  'security.unverified.body':
    'تُرسل روابط إعادة كلمة المرور ودعوات الرحلات إلى {email}. وتوثيقه هو ما يُثبت أن العنوان لك.',
  'security.unverified.action': 'أعد إرسال الرابط',
  'security.signin.title': 'تسجيل الدخول',
  'security.signin.description':
    'كيف تُثبت أنك أنت. التحقق بخطوتين ومفاتيح المرور أقوى من كلمة المرور وحدها.',
  'security.email.label': 'البريد الإلكتروني',
  'security.email.verified': 'مُوثَّق',
  'security.email.unverified': 'غير مُوثَّق',
  'security.password.label': 'كلمة المرور',
  'security.password.hint':
    'غيّرها متى شئت — سيصلك رابط لمرة واحدة بدلًا من أن نسألك عن القديمة.',
  'security.password.action': 'تغيير كلمة المرور',
  'security.twoFactor.label': 'التحقق بخطوتين',
  'security.twoFactor.onHint':
    'رمز من تطبيق المصادقة مطلوب عند كل تسجيل دخول جديد.',
  'security.twoFactor.offHint':
    'أضف رمزًا من ستة أرقام من تطبيق مصادقة فوق كلمة مرورك.',
  'security.twoFactor.on': 'مُفعَّل',
  'security.twoFactor.off': 'مُعطَّل',
  'security.twoFactor.manage': 'إدارة',
  'security.twoFactor.enable': 'تفعيل',
  'security.passkeys.label': 'مفاتيح المرور',
  'security.passkeys.hint':
    'سجّل الدخول ببصمة إصبعك أو ببصمة وجهك أو بمفتاح أمان بدلًا من كتابة أي شيء.',
  'security.passkeys.action': 'إدارة مفاتيح المرور',
  'security.session.title': 'هذه الجلسة',
  'security.session.description': 'المتصفح الذي تقرأ فيه هذا.',
  'security.session.label': 'مسجَّل الدخول باسم',
  'security.session.expires': 'تنتهي في {date}',
  'security.session.expiresSoon': 'قريبًا',
  'security.session.noExpiry': 'لا تاريخ انتهاء مسجّل',
  'security.signOut.label': 'تسجيل الخروج',
  'security.signOut.hint':
    'ينهي هذه الجلسة ويعيدك إلى صفحة الدخول. وتبقى أجهزتك الأخرى مسجَّلة.',
  'security.signOut.pending': 'جارٍ تسجيل الخروج',
  'security.signOut.failed': 'لم يتم تسجيل خروجك',
  'security.signOut.failedBody': 'تحقق من اتصالك ثم حاول مرة أخرى.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'لم تُحمّل إعدادات الإشعارات',
  'notifications.title': 'الإشعارات',
  'notifications.description':
    'كل مفتاح ينطبق عليك وحدك. وإيقاف أحدها لا يمنع الحدث من الوقوع — بل يمنعنا فقط من إخبارك به.',
  'notifications.caption': 'أي الإشعارات يصل إلى كل قناة',
  'notifications.event': 'الحدث',
  'notifications.switch': '{event} عبر {channel}',
  'notifications.saveFailed': 'لم يُحفظ ذلك التفضيل',
  'notifications.saveFailedBody':
    'أُعيد المفتاح إلى موضعه. تحقق من اتصالك ثم أعد المحاولة.',
  'notifications.channel.in_app': 'في التطبيق',
  'notifications.channel.in_app.hint': 'الجرس في الشريط العلوي',
  'notifications.channel.email': 'البريد',
  'notifications.channel.email.hint': 'يُرسل إلى عنوان دخولك',
  'notifications.channel.push': 'إشعار فوري',
  'notifications.channel.push.hint': 'على الأجهزة التي سمحت لها بذلك',
  'notifications.event.trip.invited': 'دعوات الرحلات',
  'notifications.event.trip.invited.hint': 'شخص يضيفك إلى رحلة يخطط لها.',
  'notifications.event.trip.updated': 'تغييرات الخطة',
  'notifications.event.trip.updated.hint':
    'يوم أو محطة أو تاريخ يتغير في رحلة أنت فيها.',
  'notifications.event.trip.starting_soon': 'تنبيهات المغادرة',
  'notifications.event.trip.starting_soon.hint':
    'تنبيه في الأيام التي تسبق بداية الرحلة.',
  'notifications.event.reservation.reminder': 'تنبيهات الحجز',
  'notifications.event.reservation.reminder.hint':
    'إقامة أو طاولة أو تذكرة على الأبواب.',
  'notifications.event.expense.added': 'مصاريف جديدة',
  'notifications.event.expense.added.hint':
    'شخص يسجّل مبلغًا صُرف في رحلة مشتركة.',
  'notifications.event.expense.settled': 'الأرصدة المسوّاة',
  'notifications.event.expense.settled.hint': 'رصيد كنت طرفًا فيه تم سداده.',
  'notifications.event.list.assigned': 'العناصر المسندة',
  'notifications.event.list.assigned.hint':
    'عنصر في قائمة حزم أو قائمة مهام يصبح من نصيبك.',
  'notifications.event.collab.message': 'محادثة الرحلة',
  'notifications.event.collab.message.hint': 'رسائل جديدة في رحلة تسافر فيها.',
  'notifications.event.organization.invited': 'دعوات مساحة العمل',
  'notifications.event.organization.invited.hint': 'تُدعى إلى مساحة عمل.',

  'notifications.event.billing.plan_changed': 'تغييرات الاشتراك',
  'notifications.event.billing.plan_changed.hint':
    'انتقال مساحة عملك إلى خطة أخرى.',
  'notifications.event.billing.invoice_paid': 'إيصالات الدفع',
  'notifications.event.billing.invoice_paid.hint':
    'دفع فاتورة خاصة بمساحة عملك.',
  'notifications.event.billing.payment_failed': 'مشكلات الدفع',
  'notifications.event.billing.payment_failed.hint':
    'تعذّر خصم مبلغ من مساحة عملك.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'لم تُحمّل مساحة العمل',
  'workspace.summary.description': 'خطة {plan} · أُنشئت في {date}',
  'workspace.summary.createdRecently': 'حديثًا',
  'workspace.summary.billingAction': 'الخطة والفواتير',
  'workspace.seats.label': 'المقاعد المستخدمة',
  'workspace.seats.value': '{used} من {limit}',
  'workspace.seats.note':
    'الدعوات المعلّقة تُحسب من مقاعدك، فلا يمكن لمساحة عمل أن تتجاوز ما تدفع ثمنه خطتها.',
  'workspace.seatsFull.title': 'كل مقاعد هذه الخطة مشغولة',
  'workspace.seatsFull.body':
    '{members} و{invitations} يشغلون المقاعد {limit} كلها.',
  'workspace.seatsFull.action': 'أضف مقاعد',
  'workspace.members.count': {
    zero: '{value} عضو',
    one: 'عضو واحد',
    two: 'عضوان',
    few: '{value} أعضاء',
    many: '{value} عضوًا',
    other: '{value} عضو',
  },
  'workspace.invitations.count': {
    zero: '{value} دعوة معلّقة',
    one: 'دعوة معلّقة واحدة',
    two: 'دعوتان معلّقتان',
    few: '{value} دعوات معلّقة',
    many: '{value} دعوة معلّقة',
    other: '{value} دعوة معلّقة',
  },
  'workspace.members.title': 'الأعضاء',
  'workspace.members.description':
    'كل من يمكنه رؤية الرحلات والمصاريف والملفات في مساحة العمل هذه.',
  'workspace.members.tableLabel': 'أعضاء مساحة العمل هذه',
  'workspace.members.person': 'الشخص',
  'workspace.members.role': 'الدور',
  'workspace.members.joined': 'تاريخ الانضمام',
  'workspace.invitations.title': 'الدعوات',
  'workspace.invitations.description': 'من دُعي ولم ينضم بعد.',
  'workspace.invitations.emptyTitle': 'لا دعوات معلّقة',
  'workspace.invitations.emptyBody':
    'كل من دُعي إلى مساحة العمل هذه انضم فعلًا.',
  'workspace.invitations.expires': 'تنتهي في {date}',
  'workspace.invitations.expiresSoon': 'قريبًا',
  'workspace.defaults.title': 'الإعدادات المشتركة',
  'workspace.defaults.description':
    'ما تبدأ به رحلة جديدة وعضو جديد. ويمكن لأي شخص تجاوزها لنفسه من ملفه الشخصي.',
  'workspace.defaults.readOnly': 'للقراءة فقط',
  'workspace.defaults.saving': 'جارٍ حفظ إعدادات مساحة العمل',
  'workspace.defaults.saved': 'حُفظت إعدادات مساحة العمل',
  'workspace.defaults.saveFailed': 'لم تُحفظ إعدادات مساحة العمل',
  'workspace.defaults.saveFailedBody':
    'المالك أو المسؤول وحده يغيّرها. تحقق من اتصالك ثم أعد المحاولة.',
  'workspace.currency.label': 'العملة الافتراضية',
  'workspace.currency.hint': 'ميزانيات الرحلات الجديدة تُحسب بها.',
  'workspace.language.label': 'اللغة',
  'workspace.language.hint': 'ما يقرأه عضو لم يختر لغة خاصة به.',
  'workspace.timezone.label': 'المنطقة الزمنية',
  'workspace.dateFormat.label': 'تنسيق التاريخ',
  'workspace.weekStart.label': 'يبدأ الأسبوع يوم',
  'workspace.distance.label': 'المسافة',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'لم تُحمّل الفواتير',
  'billing.loading': 'جارٍ تحميل الخطة وإيصالاتها',
  'billing.status.none': 'لا اشتراك',
  'billing.status.trialing': 'فترة تجريبية',
  'billing.status.active': 'نشط',
  'billing.status.past_due': 'فشل الدفع',
  'billing.status.unpaid': 'غير مدفوع',
  'billing.status.paused': 'موقوف مؤقتًا',
  'billing.status.canceled': 'ملغى',
  'billing.status.incomplete': 'غير مكتمل',
  'billing.status.incomplete_expired': 'منتهي',

  'billing.checkout.completeTitle': 'تم استلام الدفعة',
  'billing.checkout.completeBody':
    'جارٍ تطبيق خطتك الجديدة. وتظهر هنا لحظة تأكيد Polar لها — عادةً في ثوانٍ.',
  'billing.checkout.cancelledTitle': 'أُلغيت عملية الدفع',
  'billing.checkout.cancelledBody': 'لم يُخصم شيء ولم تتغير خطتك.',
  'billing.portal.backTitle': 'عودة من Polar',
  'billing.portal.backBody':
    'كل ما غيّرته هناك يصل إلى هنا بمجرد أن يؤكده Polar.',
  'billing.refresh': 'تحديث',
  'billing.readOnly.title': 'أنت عضو في مساحة العمل هذه',
  'billing.readOnly.body':
    'المالك أو المسؤول وحده يغيّر الاشتراك. وكل ما تحته للقراءة فقط بالنسبة لك.',

  'billing.hero.label': 'الخطة الحالية',
  'billing.hero.endsAtPeriod': 'تنتهي بنهاية الفترة',
  'billing.hero.perYear': '/ سنة',
  'billing.hero.perMonth': '/ شهر',
  'billing.hero.freeAllowance': '{trips} رحلات، مسافر واحد',
  'billing.hero.perSeatLine': '{seats} أعضاء × {price}',
  'billing.hero.singleTraveller': 'مسافر واحد',
  'billing.price.free': 'مجانًا',
  'billing.provider.opening': 'جارٍ فتح Polar',
  'billing.renewal.trialEndsToday':
    'تنتهي فترتك التجريبية اليوم، وسيأتي أول خصم إلا إذا ألغيت قبل ذلك.',
  'billing.renewal.trialEndsIn': {
    zero: 'تنتهي فترتك التجريبية بعد {value} يوم، وسيأتي أول خصم إلا إذا ألغيت قبل ذلك.',
    one: 'تنتهي فترتك التجريبية غدًا، وسيأتي أول خصم إلا إذا ألغيت قبل ذلك.',
    two: 'تنتهي فترتك التجريبية بعد يومين، وسيأتي أول خصم إلا إذا ألغيت قبل ذلك.',
    few: 'تنتهي فترتك التجريبية بعد {value} أيام، وسيأتي أول خصم إلا إذا ألغيت قبل ذلك.',
    many: 'تنتهي فترتك التجريبية بعد {value} يومًا، وسيأتي أول خصم إلا إذا ألغيت قبل ذلك.',
    other:
      'تنتهي فترتك التجريبية بعد {value} يوم، وسيأتي أول خصم إلا إذا ألغيت قبل ذلك.',
  },
  'billing.renewal.trialEnded': 'انتهت فترتك التجريبية.',
  'billing.renewal.endsNoDate': 'هذه الخطة مضبوطة على الانتهاء ولن تُجدَّد.',
  'billing.renewal.endsOn':
    'تنتهي هذه الخطة في {date}. لا يُحذف شيء — الوحدات المدفوعة تُقفل فقط.',
  'billing.renewal.pastDue':
    'لم تنجح الدفعة الأخيرة. حدّث بطاقتك لتجنّب فقدان الوحدات المدفوعة.',
  'billing.renewal.unpaid': 'هذا الاشتراك غير مدفوع، والوحدات المدفوعة مقفلة.',
  'billing.renewal.paused':
    'هذا الاشتراك موقوف مؤقتًا. استأنفه متى استعدت للسفر.',
  'billing.renewal.lapsed':
    'اختر خطة أدناه لتفتح الحجوزات واليوميات والخرائط دون اتصال مرة أخرى.',
  'billing.renewal.incomplete': 'ما زال Polar ينتظر تأكيد هذه الدفعة.',
  'billing.renewal.free': 'رحلتان في وقت واحد، على حسابنا. ارتقِ متى ضاقت بك.',
  'billing.renewal.auto': 'يُجدَّد تلقائيًا.',
  'billing.renewal.renewsOn': 'يُجدَّد في {date}.',

  'billing.usage.title': 'الاستخدام',
  'billing.usage.description':
    'يُحسب مباشرةً، فلا يكون المؤشر قديمًا أبدًا. والحدود تتبع الخطة السارية الآن.',
  'billing.quota.seats': 'الأعضاء',
  'billing.quota.trips': 'الرحلات',
  'billing.quota.storageBytes': 'المساحة',
  'billing.quota.unlimited': 'بلا حدود',
  'billing.quota.places': 'الأماكن',
  'billing.quota.placesHint': 'عبر جميع الرحلات في مساحة العمل هذه',
  'billing.quota.exhausted.places': 'تم استنفاد الحصة المخصصة للأماكن',
  'billing.quota.over.places': 'تم تجاوز حد الأماكن بمقدار {value}',
  'billing.quota.noLimit': 'لا حد على هذه الخطة',
  'billing.quota.used': '{quota} المستخدمة',
  'billing.quota.over.seats': {
    zero: 'تجاوزت حد هذه الخطة بـ {value} مقعد',
    one: 'تجاوزت حد هذه الخطة بمقعد واحد',
    two: 'تجاوزت حد هذه الخطة بمقعدين',
    few: 'تجاوزت حد هذه الخطة بـ {value} مقاعد',
    many: 'تجاوزت حد هذه الخطة بـ {value} مقعدًا',
    other: 'تجاوزت حد هذه الخطة بـ {value} مقعد',
  },
  'billing.quota.over.trips': {
    zero: 'تجاوزت حد هذه الخطة بـ {value} خانة رحلة',
    one: 'تجاوزت حد هذه الخطة بخانة رحلة واحدة',
    two: 'تجاوزت حد هذه الخطة بخانتي رحلة',
    few: 'تجاوزت حد هذه الخطة بـ {value} خانات رحلة',
    many: 'تجاوزت حد هذه الخطة بـ {value} خانة رحلة',
    other: 'تجاوزت حد هذه الخطة بـ {value} خانة رحلة',
  },
  'billing.quota.over.storage': 'تجاوزت حد هذه الخطة بمقدار {value}',
  'billing.quota.exhausted.seats': 'كل مقاعد هذه الخطة مشغولة',
  'billing.quota.exhausted.trips': 'كل خانات الرحلات في هذه الخطة مستخدمة',
  'billing.quota.exhausted.storage': 'مساحة هذه الخطة ممتلئة',
  'billing.quota.left': 'بقي {value}',

  'billing.plans.title': 'الخطط',
  'billing.plans.description':
    'غيّر الخطة متى شئت. الترقيات تُحسب بالتناسب مع اليوم، والتخفيض ينتظر انتهاء الفترة التي دفعت ثمنها.',
  'billing.interval.label': 'دورة الفاتورة',
  'billing.interval.monthly': 'شهريًا',
  'billing.interval.yearly': 'سنويًا',
  'billing.plan.free.name': 'مجانية',
  'billing.plan.free.tagline': 'خطّط لرحلتيك القادمتين',
  'billing.plan.free.feature.trips':
    'رحلتان في وقت واحد وما يصل إلى 150 مكانًا',
  'billing.plan.free.feature.itinerary': 'برنامج يوم بيوم وخريطة',
  'billing.plan.free.feature.lists': 'قوائم حزم وميزانيات بسيطة',
  'billing.plan.free.feature.atlas': 'خريطة العالم التي تتابع أين كنت',
  'billing.plan.solo.name': 'فردية',
  'billing.plan.solo.tagline': 'للمسافر الذي يخطط لكل شيء',
  'billing.plan.solo.feature.trips': 'رحلات وأماكن بلا حدود',
  'billing.plan.solo.feature.modules':
    'كل وحدات التخطيط — الحجوزات واليوميات والميزانيات والحزم',
  'billing.plan.solo.feature.offline': 'خرائط دون اتصال تنزّلها قبل الطيران',
  'billing.plan.solo.feature.export': 'تصدير إلى PDF وإلى التقويم',
  'billing.plan.crew.name': 'جماعية',
  'billing.plan.crew.tagline': 'للعائلات والأصدقاء والفرق الصغيرة',
  'billing.plan.crew.feature.members': 'حتى عشرة أعضاء، بفاتورة لكل شخص',
  'billing.plan.crew.feature.realtime': 'تعاون فوري بمؤشرات حيّة',
  'billing.plan.crew.feature.everything': 'رحلات وأماكن بلا حدود وكل الوحدات',
  'billing.plan.crew.feature.storage': 'مساحة مشتركة لصور الجميع ومستنداتهم',

  'billing.plan.current': 'الخطة الحالية',
  'billing.plan.currentBadge': 'الحالية',
  'billing.plan.popular': 'الأكثر اختيارًا',
  'billing.plan.switchYearly': 'التحويل إلى السنوي',
  'billing.plan.switchMonthly': 'التحويل إلى الشهري',
  'billing.plan.upgradeTo': 'الترقية إلى {plan}',
  'billing.plan.changeTo': 'التغيير إلى {plan}',
  'billing.plan.perMemberMonth': '/ عضو / شهر',
  'billing.plan.perMonth': '/ شهر',
  'billing.plan.alwaysFree': 'مجانية دائمًا، دون بطاقة',
  'billing.plan.billedYearly': '{amount} تُحصَّل سنويًا',
  'billing.plan.billedMonthly': '{amount} تُحصَّل شهريًا',
  'billing.plan.members': 'الأعضاء',
  'billing.plan.membersHint': 'غيّره متى شئت — والفاتورة تتبعه.',
  'billing.plan.seatOption': {
    zero: '{value} عضو',
    one: 'عضو واحد',
    two: 'عضوان',
    few: '{value} أعضاء',
    many: '{value} عضوًا',
    other: '{value} عضو',
  },

  'billing.invoices.number': 'الفاتورة',
  'billing.invoices.date': 'التاريخ',
  'billing.invoices.amount': 'المبلغ',
  'billing.invoices.status': 'الحالة',
  'billing.invoice.paid': 'مدفوعة',
  'billing.invoice.draft': 'مسودة',
  'billing.invoice.void': 'ملغاة',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'رفض مزوّد الدفع هذا الطلب. أعد المحاولة بعد لحظة.',
  'billing.failure.reference': 'رقم مرجعي للدعم: {reference}',
  'billing.failure.forbidden':
    'دورك لا يسمح بذلك في فوترة مساحة العمل هذه. اطلب من مالك أو مسؤول.',
  'billing.failure.providerRefused':
    'لم يقبل Polar هذا التغيير. قارن عدد المقاعد بأعضائك ثم أعد المحاولة أو استخدم بوابة الفوترة.',
  'billing.failure.rateLimited':
    'Polar مشغول الآن. لم يتغير شيء. أعد المحاولة بعد دقيقة.',
  'billing.failure.notConnected':
    'الفوترة غير متصلة بعد في هذا النشر، لذا لم يتغير شيء. تواصل مع الدعم.',
  'billing.failure.orderNotInvoiceable':
    'لا يستطيع Polar إصدار فاتورة لهذا الطلب. إن كان اسم الفوترة أو عنوانها مفقودًا فأضفهما في بوابة الفوترة وأعد المحاولة، وإلا فتواصل مع الدعم.',
  'billing.planChanged.title': 'تم تحديث الخطة',
  'billing.planChanged.body':
    'التغيير سارٍ بالفعل عند Polar، وهي من ستفوتر الفرق. الملخّص أدناه يلحق خلال دقيقة.',
  'billing.discount.toggle': 'هل لديك رمز ترويجي؟',
  'billing.discount.label': 'الرمز الترويجي',
  'billing.discount.hint': 'يُطبَّق على الخطة التي تختارها لاحقًا.',
  'billing.discount.hintCurrent': 'طبِّقه على خطتك الحالية، أو اختر خطة أدناه.',
  'billing.discount.applyCurrent': 'تطبيق على الخطة الحالية',
  'billing.discount.applying': 'جارٍ تطبيق الرمز…',
  'billing.discount.invalidFormat': 'تتكون الرموز من 3 إلى 64 حرفًا ورقمًا.',
  'billing.discount.rejected.invalid':
    'هذا الرمز غير صالح. تحقّق منه وحاول مرة أخرى.',
  'billing.discount.rejected.rateLimited':
    'جرّبت رموزًا كثيرة جدًا. حاول مرة أخرى بعد ساعة.',
  'billing.discount.rejected.notApplicable':
    'هذا الرمز لا ينطبق على هذه الخطة.',
  'billing.discount.rejected.busy':
    'لا يمكن التحقق من الرموز الآن. حاول مرة أخرى بعد دقيقة.',
  'billing.discount.nextRenewal': 'يسري رمزك الترويجي بدءًا من التجديد التالي.',
  'billing.discount.appliedTitle': 'تم تطبيق الرمز الترويجي',
  'billing.hero.manage': 'إدارة الفواتير',
  'billing.hero.manageHint':
    'البطاقات وعنوان الفاتورة والرقم الضريبي والإيصالات والإلغاء كلها عند Polar، وهي من تُصدر الفاتورة.',
  'billing.hero.manageHintNone':
    'لا يوجد ملف فواتير بعد. اختيار خطة مدفوعة أدناه يُنشئ واحدًا، وبعدها تُفتح البوابة.',
  'billing.portal.opening': 'يجري فتح بوابة الفواتير',
  'billing.plan.notApplied': 'لم يُطبَّق هذا التغيير',
  'billing.plan.cancelInPortal': 'ألغِ من البوابة',
  'billing.plan.seatsOverMax': {
    zero: 'تضم مساحة العمل هذه {members} أعضاء، و{plan} تفوتر {max} على الأكثر. أزل {value} عضو قبل التبديل.',
    one: 'تضم مساحة العمل هذه {members} أعضاء، و{plan} تفوتر {max} على الأكثر. أزل عضوًا واحدًا قبل التبديل.',
    two: 'تضم مساحة العمل هذه {members} أعضاء، و{plan} تفوتر {max} على الأكثر. أزل عضوين قبل التبديل.',
    few: 'تضم مساحة العمل هذه {members} أعضاء، و{plan} تفوتر {max} على الأكثر. أزل {value} أعضاء قبل التبديل.',
    many: 'تضم مساحة العمل هذه {members} أعضاء، و{plan} تفوتر {max} على الأكثر. أزل {value} عضوًا قبل التبديل.',
    other:
      'تضم مساحة العمل هذه {members} أعضاء، و{plan} تفوتر {max} على الأكثر. أزل {value} عضو قبل التبديل.',
  },
  'billing.plan.seatsBelowMembers':
    'لديك {members} أعضاء. اختر هذا العدد من المقاعد على الأقل، فـ Polar ترفض اشتراكًا بمقاعد أقل من التعيينات.',
  'billing.orders.title': 'الطلبات',
  'billing.orders.description': 'كل طلب في مساحة العمل هذه، من الأحدث.',
  'billing.orders.receipts': 'كل الإيصالات',
  'billing.orders.unavailableTitle': 'الطلبات لا تُحمَّل',
  'billing.orders.unavailableBody':
    'لم تُجب Polar في الوقت المناسب عن السجل. كل ما فوق حديث، فأعد المحاولة بعد لحظة أو اقرأ السجل الكامل في بوابة الفواتير.',
  'billing.orders.emptyTitle': 'لا طلبات بعد',
  'billing.orders.emptyCustomer':
    'تظهر أول فاتورة هنا بمجرد انتهاء دورة فوترة.',
  'billing.orders.emptyNoCustomer':
    'لم تُحصَّل أي مبالغ من مساحة العمل هذه. اختر خطة مدفوعة وستتجمّع الفواتير هنا.',
  'billing.orders.tableLabel': 'سجل الطلبات',
  'billing.orders.document': 'مستند',
  'billing.orders.dateUnknown': 'تاريخ غير معروف',
  'billing.order.pending': 'قيد الانتظار',
  'billing.order.refunded': 'مُسترَدّ',
  'billing.order.partiallyRefunded': 'مُسترَدّ جزئيًا',
  'billing.order.noInvoiceDraft': 'لا فاتورة ما دام الطلب مسوّدة',
  'billing.order.preparing': 'قيد التحضير',
  'billing.order.renderingHint':
    'ما زالت Polar تُنشئ الفاتورة {number}. سيعود التنزيل بعد ثوانٍ.',
  'billing.order.fetching': 'يجري جلب الفاتورة',
  'billing.order.generating': 'تُحضّر Polar الفاتورة',
  'billing.order.pdfLabel': 'الفاتورة {number} بصيغة PDF',
  'billing.order.stillWritingTitle': 'ما زالت Polar تكتب تلك الفاتورة',
  'billing.order.stillWritingBody':
    'الفاتورة {number} قيد الإنشاء. سيعود التنزيل من تلقاء نفسه بعد ثوانٍ.',
  'billing.order.openFailed': 'لم تُفتح تلك الفاتورة',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'الحساب',
  'passkeys.page.title': 'مفاتيح المرور',
  'passkeys.page.description':
    'يتيح لك مفتاح المرور تسجيل الدخول ببصمة إصبعك أو وجهك أو بمفتاح أمان بدلًا من كتابة أي شيء.',
  'passkeys.page.back': 'العودة إلى الأمان',
  'passkeys.list.label': 'مفاتيح المرور الخاصة بك',
  'passkeys.add.action': 'إضافة مفتاح مرور',
  'passkeys.add.loading': 'في انتظار جهازك',
  'passkeys.add.added': 'تمت إضافة مفتاح المرور',
  'passkeys.add.dismissed': 'لم تتم إضافة أي مفتاح مرور',
  'passkeys.add.exists': 'يحتوي هذا الجهاز بالفعل على مفتاح مرور لحسابك',
  'passkeys.add.failed': 'لم تتم إضافة مفتاح المرور. حاول مرة أخرى.',
  'passkeys.add.stale': 'حفاظًا على أمانك، سجّل الدخول مرة أخرى للمتابعة.',
  'passkeys.error.sessionEnded': 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.',
  'passkeys.signInAgain': 'تسجيل الدخول مرة أخرى',
  'passkeys.add.limit':
    'وصلت إلى الحد الأقصى وهو {value} من مفاتيح المرور. احذف أحدها لتتمكن من إضافة مفتاح آخر.',
  'passkeys.add.unsupported':
    'لا يستطيع هذا المتصفح إنشاء مفاتيح مرور. جرّب متصفحًا أو جهازًا آخر.',
  'passkeys.empty.title': 'لا توجد مفاتيح مرور بعد',
  'passkeys.empty.body':
    'أضف مفتاحًا واحدًا لتسجّل الدخول ببصمة إصبعك أو وجهك أو بمفتاح أمان بدلًا من كتابة أي شيء.',
  'passkeys.row.fallbackName': 'مفتاح مرور · أُضيف في {date}',
  'passkeys.row.added': 'أُضيف في {date}',
  'passkeys.row.lastUsed': 'آخر استخدام: {date}',
  'passkeys.row.neverUsed': 'لم يُستخدم لتسجيل الدخول بعد',
  'passkeys.badge.synced': 'متزامن',
  'passkeys.badge.singleDevice': 'على جهاز واحد فقط',
  'passkeys.error.title': 'تعذّر تحميل مفاتيح المرور الخاصة بك',
  'passkeys.error.retry': 'حاول مرة أخرى',
  'passkeys.error.rateLimited':
    'محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق.',
  'passkeys.error.generic': 'تحقق من اتصالك وحاول مرة أخرى.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': 'إعادة تسمية {name}',
  'passkeys.rename.fieldLabel': 'سمِّ مفتاح المرور هذا',
  'passkeys.rename.placeholder': 'سمّه، مثل هاتف العمل',
  'passkeys.rename.saving': 'جارٍ حفظ الاسم',
  'passkeys.rename.saved': 'تم حفظ الاسم',
  'passkeys.rename.failed': 'لم يتم حفظ الاسم',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': 'إزالة {name}',
  'passkeys.delete.title': 'هل تريد إزالة مفتاح المرور هذا؟',
  'passkeys.delete.body': 'لن تتمكن بعد الآن من تسجيل الدخول باستخدام {name}.',
  'passkeys.delete.password': 'كلمة المرور',
  'passkeys.delete.passwordHint': 'أدخل كلمة المرور للتأكيد.',
  'passkeys.delete.confirmOnly':
    'حسابك لا يحتوي على كلمة مرور. أكّد أنك تريد إزالة مفتاح المرور هذا.',
  'passkeys.delete.confirm': 'إزالة مفتاح المرور',
  'passkeys.delete.cancel': 'إلغاء',
  'passkeys.delete.wrongPassword': 'كلمة المرور هذه غير صحيحة.',
  'passkeys.delete.stale':
    'حفاظًا على أمانك، سجّل الدخول مرة أخرى قبل إزالة مفتاح المرور.',
  'passkeys.delete.removed': 'تمت إزالة مفتاح المرور',
  'passkeys.delete.failed': 'لم تتم إزالة مفتاح المرور. حاول مرة أخرى.',
  'passkeys.delete.removing': 'جارٍ إزالة مفتاح المرور',
  'passkeys.delete.passwordRequired':
    'أدخل كلمة المرور لإزالة مفتاح المرور هذا.',
  'workspace.departure.leave': 'مغادرة مساحة العمل',
  'workspace.departure.remove': 'إزالة العضو',
  'workspace.departure.title': 'إنهاء العضوية في {workspace}؟',
  'workspace.departure.body':
    'سيفقد {name} إمكانية الوصول إلى {workspace}. سيبقى حسابه والرحلات وسجلات التكاليف المحتفظ بها.',
  'workspace.departure.cancel': 'إلغاء',
  'workspace.departure.pending': 'جارٍ إنهاء العضوية…',
  'workspace.departure.lastOwner':
    'عيّن عضوًا آخر مالكًا قبل المغادرة أو إزالة هذا المالك.',
  'workspace.departure.notPermitted':
    'لا يسمح دورك الحالي بإزالة هذا العضو. حدّث قائمة الأعضاء قبل المحاولة مجددًا.',
  'workspace.departure.notFound': 'لم يعد هذا الشخص عضوًا في مساحة العمل هذه.',
  'workspace.departure.impersonated':
    'أوقف انتحال هوية المستخدم قبل تغيير العضوية في مساحة العمل.',
  'workspace.departure.failed':
    'تعذّر تأكيد النتيجة. أعد تحميل مساحة العمل قبل المحاولة مجددًا.',
  'workspace.departure.removed': 'تمت إزالة العضو',
  'workspace.departure.reload': 'إعادة تحميل مساحة العمل',
  'workspace.departure.activationFailed':
    'لقد غادرت مساحة العمل هذه. افتح مساحة العمل التالية للمتابعة.',
  'workspace.departure.recover': 'افتح مساحة العمل التالية',
} satisfies TranslationOf<typeof En>

export default messages
