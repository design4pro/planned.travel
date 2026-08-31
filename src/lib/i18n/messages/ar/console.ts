/**
 * كل ما تقوله وحدة تحكّم المنصّة، بالعربية.
 *
 * مكتوب انطلاقًا من `../en/console.ts` (`docs/SPEC.md` §9). الملف الإنجليزي هو المخطّط:
 * `TranslationOf<typeof En>` يحوّل أي مفتاح ناقص أو مخترَع إلى خطأ في الترجمة، و
 * `__tests__/parity.test.ts` يتحقّق من المتغيّرات ومن فروع الجمع ومن أنّه لم يبقَ هنا نصٌّ إنجليزي.
 *
 * **الجمع.** تعطي `Intl.PluralRules('ar')` ستة فروع: `zero` و`one` و`two` و`few` (٣–١٠) و
 * `many` (١١–٩٩) و`other`. الفروع كلها مكتوبة، لا واحد منها مكرّر لمجرّد ملء الفراغ.
 *
 * **سُلَّمان للأدوار لا يختلطان أبدًا** (§5). على المنصّة: مسؤول، أمين محتوى، مستخدم. في مساحة
 * العمل: مالك، مسؤول، عضو. كلمة «مسؤول» ترد في السُّلَّمين، والجملة المحيطة وحدها تفرّق بينهما.
 *
 * `Suspend` هنا «إيقاف» لا «حذف»: الوصول يعود برفع الإيقاف، والصياغة تقول ذلك صراحةً.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* -------------------------------------------------------------- الأقسام -- */

  'nav.label': 'أقسام وحدة التحكّم',
  'nav.overview': 'نظرة عامة',
  'nav.overview.description': 'المنصّة في لمحة',
  'nav.accounts': 'الحسابات',
  'nav.accounts.description': 'الأدوار والإيقافات والجلسات',
  'nav.runs': 'تشغيلات الوكلاء',
  'nav.runs.description': 'ما يبنيه أسطول Sandcastle',

  /* ---------------------------------------------------------------- الإطار -- */

  'shell.eyebrow': 'المنصّة نفسها',
  'shell.title': 'وحدة التحكّم',
  'shell.description': 'المنتج ذاته — الحسابات والصلاحيات والدليل المشترك',
  'shell.signedInAs': 'دخلتَ باسم',
  'shell.error.title': 'لم تُحمَّل وحدة التحكّم',
  'shell.notFound.title': 'لا حساب بهذا المعرّف',
  'shell.notFound.body':
    'لا شيء على المنصّة يحمل هذا المعرّف. قد يكون الحساب حُذف بعد إنشاء الرابط، أو أن في العنوان خطأ إملائيًا.',
  'shell.allAccounts': 'كل الحسابات',
  'shell.overview': 'نظرة عامة على وحدة التحكّم',

  'failure.fallback': 'لم يمرّ الإجراء. أعِد المحاولة بعد قليل.',

  /* ----------------------------------------------------------- نظرة عامة -- */

  'overview.error.title': 'لم تُحمَّل النظرة العامة',
  'overview.standing.title': 'صلاحياتك على المنصّة',
  'overview.standing.body':
    'الحسابات والجلسات والعمل نيابةً عن غيرك تعود كلها إلى مسؤول المنصّة، ولذلك تعرض لك وحدة التحكّم الدليل، ولا شيء سواه.',
  'overview.stat.accounts': 'الحسابات',
  'overview.stat.accounts.caption': {
    zero: 'لا واحد منها يحمل دورًا على المنصّة',
    one: 'واحد منها يحمل دورًا على المنصّة',
    two: 'اثنان منها يحملان دورًا على المنصّة',
    few: '{staff} منها تحمل دورًا على المنصّة',
    many: '{staff} منها تحمل دورًا على المنصّة',
    other: '{staff} منها تحمل دورًا على المنصّة',
  },
  'overview.stat.admins': 'المسؤولون',
  'overview.stat.admins.caption': 'سلطة كاملة على الحسابات والجلسات',
  'overview.stat.curators': 'أمناء المحتوى',
  'overview.stat.curators.caption': 'الدليل وحده — ولا حساب البتّة',
  'overview.stat.suspended': 'الموقوفون',
  'overview.stat.suspended.none': 'لم يبقَ أحد في الخارج',
  'overview.stat.suspended.some': 'مُخرَجون من كل جلسة حتى يُرفَع الإيقاف',
  'overview.stat.suspended.review': 'راجِعهم',
  'overview.newest.label': 'أحدث الحسابات',
  'overview.newest.empty.title': 'لا حسابات بعد',
  'overview.newest.empty.body': 'أول من يسجّل سيظهر هنا.',
  'overview.catalogue.label': 'الدليل بحسب الحالة',
  'overview.catalogue.empty.title': 'الدليل المشترك لم يُفتَح بعد',
  'overview.catalogue.empty.body':
    'حين يستقرّ خطّ الاستيراد، ستعدّ هذه اللوحة كل مكان في الدليل المشترك مسودةً أو قيد المراجعة أو منشورًا — وستفتح القائمة خلف كل رقم.',
  'overview.scraping.label': 'تشغيلات الجمع',
  'overview.scraping.empty.title': 'لم يُشغَّل أي مصدر',
  'overview.scraping.empty.body':
    'تُجمَع المصادر مرّة في الأسبوع. بعد أول تشغيل ستظهر هنا آخر خمسة، مع ما أخذه كلٌّ منها وما غيّره وما أسقطه.',

  /* ------------------------------------------------------- سُلَّم الأدوار -- */

  'role.admin': 'مسؤول',
  'role.admin.summary':
    'سلطة كاملة على المنصّة: الحسابات والأدوار والإيقافات والجلسات والعمل نيابةً عن غيره.',
  'role.admin.holds.accounts': 'إنشاء الحسابات ومنح أدوار المنصّة',
  'role.admin.holds.bans': 'إيقاف الحسابات ورفع الإيقاف عنها',
  'role.admin.holds.sessions': 'إنهاء الجلسات وتعيين كلمات المرور',
  'role.admin.holds.impersonate': 'العمل نيابةً عن حساب مدّة خمس عشرة دقيقة',
  'role.admin.holds.curation': 'كل ما يستطيعه أمين المحتوى',
  'role.admin.withheld.admins': 'العمل نيابةً عن مسؤول آخر على المنصّة',
  'role.curator': 'أمين محتوى',
  'role.curator.summary':
    'العناية بالدليل والمجموعات والمصادر والروابط المشتركة. ولا شيء يمسّ الحسابات.',
  'role.curator.holds.places': 'قراءة أماكن الدليل وكتابتها ونشرها',
  'role.curator.holds.packs': 'قراءة مجموعات الأماكن وكتابتها ونشرها',
  'role.curator.holds.sources': 'قراءة مصادر الدليل وتشغيلها',
  'role.curator.holds.shares': 'مراجعة الروابط المشتركة وإبطالها',
  'role.curator.withheld.accounts': 'كل ما يمسّ حسابًا أو جلسة',
  'role.curator.withheld.tokens': 'إصدار بيانات اعتماد الآلات وإبطالها',
  'role.user': 'مستخدم',
  'role.user.summary':
    'لا صلاحية على المنصّة إطلاقًا. وهذا يعني الجميع تقريبًا.',
  'role.user.withheld.everything': 'كل صلاحية على المنصّة، دون استثناء',

  /* ------------------------------------------------------------ حساب واحد -- */

  'identity.you': 'هذا أنت',
  'status.active': 'نشط',
  'status.suspended': 'موقوف',
  'status.permanent': 'دائم',
  'status.until': 'حتى {date}',
  'status.unverified': 'غير مؤكَّد',
  'device.on': '{browser} على {platform}',
  'device.unrecognised': 'جهاز غير معروف',

  /* --------------------------------------------------------- قائمة الحسابات -- */

  'users.error.title': 'لم تُحمَّل قائمة الحسابات',
  'users.total': 'المجموع {total}',
  'users.loading': 'تُحمَّل الحسابات',
  'users.table.label': 'حسابات المنصّة',
  'users.search.label': 'ابحث في الحسابات',
  'users.search.email': 'ابحث في عناوين البريد',
  'users.search.name': 'ابحث في الأسماء',
  'users.search.column': 'في أي عمود يجري البحث',
  'users.search.submit': 'ابحث',
  'users.field.email': 'البريد',
  'users.field.name': 'الاسم',
  'users.filter.role.label': 'تصفية بدور المنصّة',
  'users.filter.role.any': 'أي دور',
  'users.filter.role.admin': 'المسؤولون',
  'users.filter.role.curator': 'أمناء المحتوى',
  'users.filter.status.label': 'تصفية بحالة الحساب',
  'users.filter.status.any': 'أي حالة',
  'users.filter.clear': 'امسح التصفية',
  'users.filter.hint': 'ضيِّق بالدور أو بالحالة — بواحد منهما في كل مرّة.',
  'users.column.account': 'الحساب',
  'users.column.role': 'دور المنصّة',
  'users.column.status': 'الحالة',
  'users.column.joined': 'الانضمام',
  'users.column.actions': 'الإجراءات',
  'users.joined': 'انضمّ في {date}',
  'users.pastEnd.title': 'هذه الصفحة بعد آخر القائمة',
  'users.pastEnd.body': {
    zero: 'لا حساب في هذا العرض، والصفحة ١ هي كل ما فيه.',
    one: 'في هذا العرض حساب واحد، والصفحة ١ هي وحدها ما لديه.',
    two: 'في هذا العرض حسابان، أي {pages}. الصفحة {page} بعد ذلك الحدّ.',
    few: 'في هذا العرض {total} حسابات، أي {pages}. الصفحة {page} بعد ذلك الحدّ.',
    many: 'في هذا العرض {total} حسابًا، أي {pages}. الصفحة {page} بعد ذلك الحدّ.',
    other:
      'في هذا العرض {total} حساب، أي {pages}. الصفحة {page} بعد ذلك الحدّ.',
  },
  'users.pastEnd.pages': {
    zero: 'لا صفحة',
    one: 'صفحة واحدة',
    two: 'صفحتان',
    few: '{pages} صفحات',
    many: '{pages} صفحة',
    other: '{pages} صفحة',
  },
  'users.pastEnd.back': 'عُد إلى الصفحة الأولى',
  'users.empty.filtered.title': 'لا شيء يطابق هذه التصفية',
  'users.empty.filtered.body':
    'لا حساب على المنصّة يوافق هذا البحث. وسِّع البحث أو امسح التصفية لترى الجميع.',
  'users.empty.title': 'لا حسابات لعرضها',
  'users.empty.body': 'هذا العرض فارغ. لم يُصفَّ شيء، فلا شيء هنا يمكن توسيعه.',

  /* --------------------------------------------------------- صفحة الحساب -- */

  'account.error.title': 'لم يُحمَّل هذا الحساب',
  'account.loading': 'يُحمَّل الحساب',
  'account.meta.lastChange': 'آخر تغيير',
  'account.meta.id': 'معرّف الحساب',
  'account.banned.title': 'هذا الحساب موقوف',
  'account.banned.noReason': 'لم يُكتب سبب مع الإيقاف.',
  'account.banned.permanent': ' يبقى قائمًا حتى يرفعه مسؤول.',
  'account.banned.until': ' يُرفَع من تلقاء نفسه في {date}.',
  'account.banned.untilUnknown': 'عند انقضاء المدّة',
  'account.authority.label': 'الصلاحيات على المنصّة',
  'account.authority.may': 'يستطيع',
  'account.authority.mayNot': 'لا يستطيع',
  'account.authority.none': 'لا شيء على المنصّة.',
  'account.workspaces.label': 'مساحات العمل',
  'account.workspaces.truncated':
    'ينتمي هذا الحساب إلى مساحات عمل أكثر من {listed} المذكورة هنا.',
  'account.workspaces.empty.title': 'ليس في أي مساحة عمل',
  'account.workspaces.empty.body':
    'لا ينتمي هذا الحساب بعدُ إلى أي مساحة عمل. تُنشَأ واحدة عند أول دخول، وكل مساحة يُدعى إليها ستظهر هنا.',
  'account.workspaces.column.workspace': 'مساحة العمل',
  'account.workspaces.column.role': 'الدور',
  'account.workspaces.column.plan': 'الباقة',
  'account.subscription.label': 'الاشتراك',
  'account.subscription.free.title': 'على الباقة المجانية',
  'account.subscription.free.body':
    'مساحة العمل التي يملكها هذا الحساب لم تمرّ يومًا بالدفع، فليس لها سجل اشتراك وهي تعمل ضمن حدود الباقة المجانية.',
  'account.subscription.none.title': 'لا شيء يُفوتَر على هذا الحساب',
  'account.subscription.none.body':
    'لا يملك هذا الحساب أي مساحة عمل. والعضوية في مساحة غيره لا تجعله من تُرسَل إليه الفاتورة، فلا شيء هنا يُجمَع.',
  'account.subscription.endsAtClose': 'ينتهي مع نهاية الدورة',
  'account.subscription.seats': 'المقاعد',
  'account.subscription.seatsValue': '{used} من {limit}',
  'account.subscription.ends': 'ينتهي',
  'account.subscription.renews': 'يُجدَّد',
  'account.sessions.label': 'الجلسات الحيّة',
  'account.sessions.truncated':
    'يحمل هذا الحساب جلسات أكثر مما يسرده نداء واحد. لتتأكّد من ألّا تبقى واحدة، أنهِ كل الجلسات من قائمة الإجراءات.',
  'account.sessions.empty.title': 'مُخرَج من كل جلسة',
  'account.sessions.empty.body':
    'لا جلسة سارية لهذا الحساب. سيظهر هنا لحظة دخوله من جديد.',
  'account.sessions.column.device': 'الجهاز',
  'account.sessions.column.address': 'العنوان',
  'account.sessions.column.started': 'البدء',
  'account.sessions.column.expires': 'الانقضاء',
  'account.sessions.impersonated': 'وُلدت من عمل نيابةً عن الحساب',
  'account.sessions.noAddress': 'غير مسجَّل',
  'account.sessions.noAddressLong': 'العنوان غير مسجَّل',
  'account.sessions.when': 'بدأت {started} · تنقضي {expires}',
  'account.audit.label': 'سجل المراجعة',
  'account.audit.truncated':
    'يحمل السجل مدخلات أكثر من هذه. أثر المراجعة على المنصّة يُضاف إليه ولا يُعدَّل، ويُحفَظ أربعمائة يوم.',
  'account.audit.empty.title': 'لم يُفعَل شيء بهذا الحساب',
  'account.audit.empty.body':
    'كل تغيير دور وإيقاف وكلمة مرور مُعيَّنة وجلسة مُنهاة وعمل نيابةً عن الحساب يُكتب هنا مع اسم فاعله. ولم يمسّه أحد.',

  /* --------------------------------------------- سُلَّم مساحة العمل -- */

  'workspace.role.owner': 'المالك',
  'workspace.role.admin': 'مسؤول',
  'workspace.role.member': 'عضو',
  'plan.free': 'مجانية',
  'plan.starter': 'البداية',
  'plan.pro': 'احترافية',
  'plan.business': 'الأعمال',
  'subscription.trialing': 'فترة تجريبية',
  'subscription.active': 'نشط',
  'subscription.pastDue': 'متأخّر السداد',
  'subscription.canceled': 'مُلغى',
  'subscription.incomplete': 'غير مكتمل',
  'subscription.expired': 'منتهٍ',
  'subscription.unpaid': 'غير مدفوع',
  'subscription.paused': 'موقوف مؤقتًا',

  /* ------------------------------------------------------- دفتر المراجعة -- */

  'audit.action.created': 'أُنشئ الحساب',
  'audit.action.updated': 'تغيّرت بيانات الحساب',
  'audit.action.roleChanged': 'تغيّر دور المنصّة',
  'audit.action.banned': 'أُوقف الحساب',
  'audit.action.unbanned': 'رُفع الإيقاف',
  'audit.action.deleted': 'حُذف الحساب',
  'audit.action.passwordSet': 'عيَّن مسؤول كلمة المرور',
  'audit.action.emailSet': 'تغيّر عنوان البريد',
  'audit.action.impersonationStarted': 'بدأ العمل نيابةً عن الحساب',
  'audit.action.impersonationEnded': 'انتهى العمل نيابةً عن الحساب',
  'audit.action.sessionRevoked': 'أُنهيت جلسة',
  'audit.action.sessionRevokedAll': 'أُنهيت كل الجلسات',
  'audit.actor.system': 'المنصّة نفسها',
  'audit.actor.system.detail': 'تلقائيًا',
  'audit.actor.agent': 'بيانات اعتماد آلة',
  'audit.actor.agent.detail': 'رمز MCP',
  'audit.actor.deleted': 'حساب محذوف',
  'audit.actorBadge': 'حينها: {role}',
  'audit.field.name': 'الاسم',
  'audit.field.email': 'عنوان البريد',
  'audit.field.emailVerified': 'تأكيد البريد',
  'audit.field.role': 'دور المنصّة',
  'audit.field.banned': 'موقوف',
  'audit.field.banReason': 'السبب',
  'audit.field.banExpiresAt': 'انتهاء الإيقاف',
  'audit.field.revoked': 'الجلسات المُنهاة',
  'audit.field.impersonating': 'يعمل نيابةً عن',
  'audit.field.impersonatedBy': 'يعمل نيابةً عنه',
  'audit.field.expiresAt': 'انقضاء الجلسة',
  'audit.field.targetRole': 'دوره على المنصّة',
  'audit.field.sessionId': 'الجلسة المعنيّة',
  'audit.value.yes': 'نعم',
  'audit.value.no': 'لا',
  'audit.value.cleared': 'أُفرغ',
  'audit.became': 'صار',

  /* ---------------------------------------------------------- نوافذ الحوار -- */

  'dialog.cancel': 'إلغاء',

  'create.button': 'حساب جديد',
  'create.title': 'أنشئ حسابًا',
  'create.body':
    'لا يُؤكَّد العنوان ولا يخرج أي بريد — سلِّم كلمة المرور بنفسك.',
  'create.confirm': 'أنشئ الحساب',
  'create.name.placeholder': 'ليلى منصور',
  'create.email': 'عنوان البريد',
  'create.email.placeholder': 'laila@planned.travel',
  'create.password': 'كلمة المرور',
  'create.password.hint':
    'طويلة بما يكفي لتكون عبارة. ويستطيع صاحب الحساب تغييرها لاحقًا.',
  'create.done': 'أُنشئ الحساب',
  'create.done.body': 'يستطيع {email} الدخول بكلمة المرور التي عيّنتها.',

  'action.menu.label': 'إجراءات {name}',
  'action.group.account': 'الحساب',
  'action.group.credentials': 'بيانات الاعتماد',

  'action.role.item': 'غيِّر دور المنصّة',
  'action.role.self': 'ليس على حسابك — خفض نفسك قد يترك المنصّة بلا مسؤول.',
  'action.role.body':
    'ما يستطيع {name} فعله على المنصّة نفسها. والعضوية في مساحات العمل مفردات أخرى لا يحرّكها هذا.',
  'action.role.confirm': 'احفظ الدور',
  'action.role.current': 'الحالي',
  'action.role.done': 'حُدِّث دور المنصّة',
  'action.role.done.body': 'يحمل {name} الآن دور {role} على المنصّة.',

  'action.impersonate.item': 'اعمل نيابةً عن الحساب',
  'action.impersonate.self': 'لا أحد لتصير إليه — هذا حسابك أنت.',
  'action.impersonate.banned': 'الحساب موقوف، فليست له جلسة تلبسها.',
  'action.impersonate.admin':
    'لا دور على المنصّة يعمل نيابةً عن مسؤول، ودورك منها.',
  'action.impersonate.title': 'اعمل نيابةً عن {name}',
  'action.impersonate.body':
    'سترى المنتج خمس عشرة دقيقة كما يراه هذا الحساب تمامًا.',
  'action.impersonate.confirm': 'ابدأ',
  'action.impersonate.note.bar':
    'يبقى شريط تحذير على كل شاشة حتى تنتهي، ولا يمكن إغلاقه.',
  'action.impersonate.note.platform':
    'ما دمت تعمل نيابةً عن غيرك فإجراءات المنصّة غير متاحة — ووحدة التحكّم منها.',
  'action.impersonate.note.audit':
    'يُكتب البدء والانتهاء في أثر المراجعة على المنصّة، مقرونَين باسمك.',

  'action.password.item': 'عيِّن كلمة مرور',
  'action.password.title': 'عيِّن كلمة مرور لـ {name}',
  'action.password.body':
    'استعمل هذا لإعادة أحدهم إلى حساب أُغلق دونه، أو لقطع مهاجم عن حساب استولى عليه.',
  'action.password.confirm': 'عيِّن كلمة المرور',
  'action.password.field': 'كلمة مرور جديدة',
  'action.password.hint.self':
    'ما إن تُعيَّن حتى تنتهي كل الجلسات — وجلستك منها.',
  'action.password.hint': 'ما إن تُعيَّن حتى تنتهي كل جلسة يحملها الحساب.',
  'action.password.done': 'عُيِّنت كلمة المرور',
  'action.password.done.body': 'أُخرج {name} من كل جهاز.',

  'action.sessions.item': 'أنهِ كل الجلسات',
  'action.sessions.body.self':
    'هذا يُخرجك من كل جهازٍ لك، بما فيه الجهاز الذي تقرأ عليه هذا.',
  'action.sessions.body':
    'سيُخرَج {name} من كل جهاز وسيضطرّ إلى الدخول من جديد.',
  'action.sessions.confirm': 'أنهِ الجلسات',
  'action.sessions.done': 'أُنهيت الجلسات',
  'action.sessions.done.body': {
    zero: 'لم تُنهَ أي جلسة.',
    one: 'أُنهيت جلسة واحدة.',
    two: 'أُنهيت جلستان.',
    few: 'أُنهيت {revoked} جلسات.',
    many: 'أُنهيت {revoked} جلسة.',
    other: 'أُنهيت {revoked} جلسة.',
  },

  'action.ban.item': 'أوقِف الحساب',
  'action.ban.self': 'ليس على حسابك — إيقاف نفسك يقطع عنك طريق العودة.',
  'action.ban.title': 'أوقِف {name}',
  'action.ban.body':
    'تنتهي كل الجلسات فورًا، ولا يستطيع الحساب الدخول حتى يُرفَع الإيقاف أو تنقضي مدّته.',
  'action.ban.confirm': 'أوقِف الحساب',
  'action.ban.reason': 'السبب',
  'action.ban.reason.hint':
    'يُحفَظ في أثر المراجعة على المنصّة ثلاثة عشر شهرًا ولا يُعرَض على أحد غير مسؤول.',
  'action.ban.reason.placeholder': 'بلاغات إساءة متكرّرة من ثلاث مساحات عمل',
  'action.ban.duration': 'المدّة',
  'action.ban.duration.label': 'مدّة الإيقاف',
  'action.ban.duration.permanent.body': 'يبقى قائمًا حتى يرفعه مسؤول عن قصد.',
  'action.ban.duration.day': '٢٤ ساعة',
  'action.ban.duration.day.body':
    'طويلة بما يكفي لتقطع، وقصيرة بما يكفي لتبقى تدخّلًا.',
  'action.ban.duration.week': '٧ أيام',
  'action.ban.duration.week.body': 'أسبوع للردّ على شكوى.',
  'action.ban.duration.month': '٣٠ يومًا',
  'action.ban.duration.month.body': 'شهر من الصمت المفروض.',
  'action.ban.duration.quarter': '٩٠ يومًا',
  'action.ban.duration.quarter.body':
    'أطول مدّة تعرضها وحدة التحكّم. وما بعدها إيقاف دائم.',
  'action.ban.done': 'أُوقف الحساب',
  'action.ban.done.body': 'أُخرج {name} من كل مكان ولا يستطيع الدخول.',

  'action.unban.item': 'ارفع الإيقاف',
  'action.unban.title': 'ارفع الإيقاف عن {name}',
  'action.unban.body':
    'يستطيع الحساب الدخول من المحاولة التالية. ولا تعود أي جلسة سابقة.',
  'action.unban.confirm': 'ارفع الإيقاف',
  'action.unban.done': 'رُفع الإيقاف',
  'action.unban.done.body':
    'يستطيع {name} الدخول من جديد. ولم تُستعَد أي جلسة.',

  'action.delete.item': 'احذف الحساب',
  'action.delete.self': 'ليس على حسابك — لا رجعة من هناك.',
  'action.delete.title': 'احذف {name}',
  'action.delete.body':
    'يذهب الحساب وجلساته وكل بيانات اعتماد مربوطة به. وهذا لا يُتراجَع عنه.',
  'action.delete.confirm': 'احذف الحساب',
  'action.delete.note':
    'ما أنشأه هذا الشخص داخل مساحة عمل يبقى للمساحة التي تملكه. والإيقاف بدل الحذف يحفظ الأثر ويسحب الوصول.',
  'action.delete.done': 'حُذف الحساب',
  'action.delete.done.body': 'ذهب {name} وكل ما كان مربوطًا بالحساب.',

  'session.revoke.label': 'أنهِ الجلسة على {device}',
  'session.revoke.title': 'أنهِ هذه الجلسة',
  'session.revoke.body':
    'سيضطرّ {device} إلى الدخول من جديد عند أول طلب تالٍ. وإن كانت هذه هي الجلسة التي تقرأ فيها هذا، فستخرج معها.',
  'session.revoke.confirm': 'أنهِ الجلسة',
  'session.revoke.done': 'أُنهيت الجلسة',
  'session.revoke.done.body':
    'سيضطرّ الجهاز إلى الدخول من جديد عند أول طلب تالٍ.',

  /* --------------------------------------------------------- تشغيلات الوكلاء -- */

  'runs.error.title': 'لم يستجب سجل التشغيلات',
  'runs.origin.local': 'محلي',
  'runs.origin.githubActions': 'إجراءات GitHub',
  'runs.stat.live': 'التشغيلات الحيّة',
  'runs.stat.live.none': 'لا شيء يُبنى الآن',
  'runs.stat.live.some': 'نبض في مواجهة حجزٍ مدّته خمس دقائق',
  'runs.stat.issues': 'المسائل المحجوزة',
  'runs.stat.issues.caption': 'كل واحدة محجوزة لتشغيل واحد، مع أسلافها وفروعها',
  'runs.stat.orphans': 'الفروع اليتيمة',
  'runs.stat.orphans.none': 'لا عمل بلا صاحب',
  'runs.stat.orphans.some': 'إيداعات تشغيل توقّف، تنتظر من يتبنّاها',
  'runs.live.empty.title': 'لا تشغيل مسجَّل',
  'runs.live.empty.body':
    'يظهر التشغيل هنا لحظة تسجيله لنفسه — من هذا الجهاز أو من غيره أو من منفّذ GitHub — ومعه المسائل التي أخذها.',
  'runs.holds.nothing': 'لا يحجز شيئًا',
  'runs.holds': 'يحجز {issues}',
  'runs.uptime': 'يعمل منذ {elapsed} · {lease}',
  'runs.lease.expired': 'انقضى الحجز',
  'runs.lease.left': 'بقي {elapsed}',
  'runs.wip.label': 'عمل جارٍ',
  'runs.wip.empty.title': 'لا فرع يحمل عملًا',
  'runs.wip.empty.body':
    'يسجّل التشغيل فرعه ما إن يظهر عليه إيداع؛ فإذا مات، عُرض هذا العمل على التشغيل التالي الذي يأخذ المسألة بدل أن يبدأ من الصفر.',
  'runs.wip.orphaned': 'يتيم',
  'runs.wip.meta': {
    zero: 'لا إيداع · منذ {elapsed}',
    one: 'إيداع واحد · منذ {elapsed}',
    two: 'إيداعان · منذ {elapsed}',
    few: '{commits} إيداعات · منذ {elapsed}',
    many: '{commits} إيداعًا · منذ {elapsed}',
    other: '{commits} إيداع · منذ {elapsed}',
  },
  'runs.recent.label': 'ما انتهى حديثًا',
  'runs.recent.empty.title': 'لم ينتهِ أي تشغيل بعد',
  'runs.recent.empty.body':
    'تبقى هنا آخر خمسين تشغيلًا، مع الكيفية التي انتهى بها كلٌّ منها.',
  'runs.ago': 'منذ {elapsed}',
  'runs.notCoordinator.title': 'هذا النشر لا ينسّق الأسطول',
  'runs.notCoordinator.body':
    'سجل التشغيلات مربوط ببيئة التجهيز وحدها، وذلك عن قصد: سجل ثانٍ يجعل كلا الأسطولين يظنّ أنه هو من يمسك الطابور — وهذا بالضبط ما وُجد ليمنعه. اقرأ الأسطول في بيئة التجهيز.',
  'nav.providers': 'المزوّدون',
  'nav.providers.description': 'الاستدعاءات الصادرة وسقوفها',
  'providers.error.title': 'تعذّرت قراءة عدّادات المزوّدين',
  'providers.list.label': 'الخدمات',
  'providers.status.planned': 'غير مُدمجة',
  'providers.status.planned.description':
    'لا شيء يستدعي هذه الخدمة بعد، فلا شيء يُعدّ. وهي مذكورة هنا كي يُتَّفق على سقف قبل أول استدعاء لا بعد أول فاتورة.',
  'providers.policy.allow': 'يُحاسب فوق السقف',
  'providers.policy.block': 'يرفض عند السقف',
  'providers.badge.blocked': {
    zero: 'لا استدعاءات مرفوضة',
    one: 'استدعاء واحد مرفوض',
    two: 'استدعاءان مرفوضان',
    few: '{calls} استدعاءات مرفوضة',
    many: '{calls} استدعاءً مرفوضًا',
    other: '{calls} استدعاء مرفوض',
  },
  'providers.limit.none': 'لا سقف متَّفق عليه · {used} هذا الشهر',
  'providers.limit.value': '{used} من {limit}',
  'providers.limit.window.day': 'اليوم',
  'providers.limit.window.month': 'هذا الشهر',
  'providers.measuring.none': 'لم يُقَس شيء بعد',
  'providers.measuring.since': 'القياس منذ {date}',
  'providers.stat.calls': 'الاستدعاءات هذا الشهر',
  'providers.stat.calls.caption': 'عبر كل الخدمات المُدمجة',
  'providers.stat.errors': 'استدعاءات فاشلة',
  'providers.stat.errors.caption':
    'تُعدّ استدعاءات أيضًا، لأن معظم المزوّدين يحاسبون عليها',
  'providers.stat.nearLimit': 'قرب السقف',
  'providers.stat.nearLimit.caption': 'خدمات تجاوزت عتبة التنبيه',
  'providers.stat.blocked': 'استدعاءات مرفوضة',
  'providers.stat.blocked.none': 'لم يُرفض شيء',
  'providers.stat.blocked.some': 'طلب رفضه سقف',
  'providers.forecast.label': 'التوقّع',
  'providers.forecast.provider': 'الخدمة',
  'providers.forecast.monthEnd': 'بحلول نهاية الشهر',
  'providers.forecast.runRate': 'شهريًا بهذه الوتيرة',
  'providers.forecast.perWorkspace': 'لكل مساحة عمل شهريًا',
  'providers.forecast.noWorkspaceTraffic':
    'لا حركة من مساحات العمل لحساب المتوسط',
  'providers.forecast.window': {
    zero: 'توقّع من ساعة واحدة من القياس.',
    one: 'توقّع من ساعة واحدة من القياس.',
    two: 'توقّع من ساعة واحدة من القياس.',
    few: 'توقّع من {hours} ساعة من القياس.',
    many: 'توقّع من {hours} ساعة من القياس.',
    other: 'توقّع من {hours} ساعة من القياس.',
  },
  'providers.forecast.tooEarly': {
    zero: 'لم تُقَس سوى ساعة واحدة حتى الآن، وهي أقل من أن يُتوقَّع منها. مدّ أقل من يوم إلى شهر حساب لا توقّع.',
    one: 'لم تُقَس سوى ساعة واحدة حتى الآن، وهي أقل من أن يُتوقَّع منها. مدّ أقل من يوم إلى شهر حساب لا توقّع.',
    two: 'لم تُقَس سوى ساعة واحدة حتى الآن، وهي أقل من أن يُتوقَّع منها. مدّ أقل من يوم إلى شهر حساب لا توقّع.',
    few: 'لم يُقَس سوى {hours} ساعة حتى الآن، وهي أقل من أن يُتوقَّع منها. مدّ أقل من يوم إلى شهر حساب لا توقّع.',
    many: 'لم يُقَس سوى {hours} ساعة حتى الآن، وهي أقل من أن يُتوقَّع منها. مدّ أقل من يوم إلى شهر حساب لا توقّع.',
    other:
      'لم يُقَس سوى {hours} ساعة حتى الآن، وهي أقل من أن يُتوقَّع منها. مدّ أقل من يوم إلى شهر حساب لا توقّع.',
  },
  'providers.forecast.atWorkspaces': 'عند كم مساحة عمل',
  'providers.forecast.callsEach': 'استدعاءات لكل مساحة شهريًا',
  'providers.forecast.projected': 'نحو {calls} استدعاء شهريًا.',
  'providers.workspaces.label': 'أنشط مساحات العمل',
  'providers.workspaces.platform': 'المنصّة (بلا مساحة عمل)',
  'providers.workspaces.empty.title': 'لم يُنسب شيء بعد',
  'providers.workspaces.empty.description':
    'الاستدعاء الذي يجري لمساحة عمل يُقيَّد عليها. أعمال الجدولة وبريد المنصّة لا تخصّ أي مساحة وتُعدّ على حدة.',
  'providers.readOnly':
    'يمكنك قراءة هذه العدّادات لا تحريك سقف. تغيير حدّ أو سياسته يتطلّب صلاحية provider:configure.',
  'providers.status.planned.agreed.month':
    'السقف المتَّفق عليه: {limit} شهريًا. يسري من أول استدعاء، حالما يوجد عميل برمجي.',
  'providers.status.planned.agreed.day':
    'السقف المتَّفق عليه: {limit} يوميًا. يسري من أول استدعاء، حالما يوجد عميل برمجي.',
  'providers.edit.button': 'تحرير',
  'providers.edit.title': 'سقف {provider}',
  'providers.edit.body':
    'ما اتَّفق هذا النشر على إنفاقه لدى المزوّد، وما يحدث عند نفاده.',
  'providers.edit.confirm': 'حفظ السقف',
  'providers.edit.done': 'حُفظ سقف {provider}',
  'providers.edit.label': 'الاسم',
  'providers.edit.ceiling': 'الاستدعاءات المشمولة',
  'providers.edit.ceiling.hint':
    'اتركه فارغًا إن لم يُتَّفق على سقف. الفارغ والصفر مختلفان: الصفر مع «الرفض» يردّ كل استدعاء.',
  'providers.edit.ceiling.placeholder': 'بلا سقف',
  'providers.edit.window': 'يُقاس على',
  'providers.edit.window.month': 'شهر تقويمي',
  'providers.edit.window.month.body': 'الشكل المعتاد للحصة المشمولة.',
  'providers.edit.window.day': 'يوم',
  'providers.edit.window.day.body':
    'بعض المزوّدين يحاسبون يوميًا — خطة Geoapify المجانية 3٬000 رصيد في اليوم.',
  'providers.edit.policy': 'عند السقف',
  'providers.edit.policy.allow': 'واصِل الاستدعاء وادفع',
  'providers.edit.policy.allow.body':
    'تستمر الاستدعاءات فوق السقف وتنبّه لوحة التحكّم. لا شيء يتوقّف.',
  'providers.edit.policy.block': 'ارفض الاستدعاءات التالية',
  'providers.edit.policy.block.body':
    'تُردّ الاستدعاءات حتى تُصفَّر النافذة. ما يعتمد على هذا المزوّد يتوقّف — فاخترها حيث يكون هذا العطل هو الأرخص فقط.',
  'providers.edit.policy.block.refused':
    'لا يمكن رفض {provider}: لا بديل له، فردّ استدعاءاته يوقف الميزة بدل أن يحدّ كلفتها. ويبقى السقف الذي ينبّه فقط متاحًا.',
  'providers.edit.warn': 'التنبيه عند (%)',
  'providers.edit.critical': 'الإنذار عند (%)',
  'providers.edit.thresholds.hint':
    'حيث يتحوّل المؤشّر إلى الكهرماني ثم الأحمر. لا يجوز أن يعلو التنبيه على الإنذار.',
} satisfies TranslationOf<typeof En>

export default messages
