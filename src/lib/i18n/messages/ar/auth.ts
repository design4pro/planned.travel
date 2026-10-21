/**
 * Everything the authentication screens say, in Arabic.
 *
 * Made from `../en/auth.ts` and from nothing else. `docs/SPEC.md` §1 and §9 rule 9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * These are the only screens a traveller reaches with no session, so their
 * language comes from the visitor cookie, then `Accept-Language`, then English. Two thirds of the keys are validation messages
 * and failure alerts, which appear exactly when a reader can least afford a
 * sentence in a language they do not read.
 *
 * **Six branches.** `Intl.PluralRules` reports zero, one, two, few, many and
 * other for `ar`, and the gate requires all six. The four plural messages below
 * count *characters*, so they follow Arabic number agreement: 1 the singular, 2
 * the dual, 3–10 the broken plural, 11–99 the accusative singular, 100 upwards
 * the singular again. `one` and `two` drop the numeral placeholder, because
 * «حرف واحد» and «حرفين» already carry the count.
 *
 * **What is not translated.** `{provider}` is a trademark, `planned.travel` is
 * our own wordmark and `example.com` is the reserved example domain — only the
 * local part of the sample address and the sample person's name are localised,
 * so an Arabic reader sees a name that reads as a name.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'الصفحة الرئيسية لـ planned.travel',
  'shell.legal':
    'بالمتابعة فإنك توافق على شروط خدمة planned.travel وإشعار الخصوصية.',

  'panel.eyebrow': 'خططوا معًا',
  'panel.heading': 'كل رحلة، من أول دبوس إلى آخر بطاقة بريدية.',
  'panel.body':
    'برامج مشتركة على خريطة حقيقية، وميزانيات تتوازن فعلًا، وقوائم حزم لا تنسى، ويوميات تستحق الاحتفاظ بها.',
  'panel.map.title': 'خريطة واحدة، خطة واحدة',
  'panel.map.detail': 'كل محطة وإقامة وانتقال في برنامج واحد.',
  'panel.group.title': 'الجميع على الخطوة نفسها',
  'panel.group.detail':
    'التعديلات والتصويتات والتعليقات تصل مباشرةً إلى المجموعة كلها.',
  'panel.costs.title': 'تكاليف تُحسب بدقة',
  'panel.costs.detail': 'ميزانيات مشتركة، وأرصدة مسوّاة، ولا جدول بيانات.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'أو',
  'divider.orEmail': 'أو استخدم بريدك',

  'social.continue': 'المتابعة بـ {provider}',
  'social.signUp': 'إنشاء حساب بـ {provider}',
  'social.opening': 'جارٍ فتح {provider}',

  'passkey.action': 'الدخول بمفتاح مرور',
  'passkey.waiting': 'في انتظار جهازك',

  'password.show': 'إظهار كلمة المرور',
  'password.hide': 'إخفاء كلمة المرور',
  'password.showNew': 'إظهار كلمة المرور الجديدة',
  'password.hideNew': 'إخفاء كلمة المرور الجديدة',
  'password.showConfirm': 'إظهار تأكيد كلمة المرور',
  'password.hideConfirm': 'إخفاء تأكيد كلمة المرور',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'البريد الإلكتروني',
  'field.email.placeholder': 'sara@example.com',
  'field.password': 'كلمة المرور',
  'field.password.placeholder': 'كلمة مرورك',
  'field.newPassword': 'كلمة المرور الجديدة',
  'field.newPassword.placeholder': 'عبارة تتذكرها',
  'field.confirmPassword': 'تأكيد كلمة المرور',
  'field.confirmNewPassword': 'تأكيد كلمة المرور الجديدة',
  'field.confirmPassword.placeholder': 'اكتبها مرة أخرى',
  'field.name': 'اسمك',
  'field.name.hint': 'يظهر لمن تخطط الرحلات معهم.',
  'field.name.placeholder': 'ليلى منصور',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'أدخل بريدك الإلكتروني.',
  'validation.emailTooLong': 'هذا البريد الإلكتروني طويل جدًا.',
  'validation.emailInvalid': 'هذا لا يشبه بريدًا إلكترونيًا.',
  'validation.passwordRequired': 'أدخل كلمة مرورك.',
  'validation.passwordShort': {
    zero: 'استخدم {value} حرف على الأقل — عبارة قصيرة أفضل من كلمة بارعة.',
    one: 'استخدم حرفًا واحدًا على الأقل — عبارة قصيرة أفضل من كلمة بارعة.',
    two: 'استخدم حرفين على الأقل — عبارة قصيرة أفضل من كلمة بارعة.',
    few: 'استخدم {value} أحرف على الأقل — عبارة قصيرة أفضل من كلمة بارعة.',
    many: 'استخدم {value} حرفًا على الأقل — عبارة قصيرة أفضل من كلمة بارعة.',
    other: 'استخدم {value} حرف على الأقل — عبارة قصيرة أفضل من كلمة بارعة.',
  },
  'validation.passwordLong': {
    zero: 'أبقها أقل من {value} حرف.',
    one: 'أبقها أقل من حرف واحد.',
    two: 'أبقها أقل من حرفين.',
    few: 'أبقها أقل من {value} أحرف.',
    many: 'أبقها أقل من {value} حرفًا.',
    other: 'أبقها أقل من {value} حرف.',
  },
  'validation.passwordMismatch': 'كلمتا المرور غير متطابقتين.',
  'validation.nameShort': 'أدخل اسمك ليعرف رفاق الرحلة من أنت.',
  'validation.nameTooLong': 'هذا الاسم طويل جدًا.',
  'validation.termsRequired': 'يرجى قبول الشروط للمتابعة.',
  'validation.codeLength': 'رموز المصادقة من ستة أرقام.',
  'validation.codeDigits': 'رموز المصادقة أرقام فقط.',
  'validation.backupShort': 'هذا الرمز الاحتياطي يبدو قصيرًا جدًا.',
  'validation.backupLong': 'هذا الرمز الاحتياطي يبدو طويلًا جدًا.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'مرحبًا بعودتك',
  'login.heading': 'الدخول إلى planned.travel',
  'login.description': 'التقط برامجك وميزانياتك وقوائمك من حيث تركتها بالضبط.',
  'login.newHere': 'جديد هنا؟',
  'login.createAccount': 'أنشئ حسابًا',
  'login.forgot': 'نسيت كلمة المرور؟',
  'login.remember': 'أبقني مسجَّل الدخول على هذا الجهاز',
  'login.submit': 'دخول',
  'login.submitting': 'جارٍ تسجيل دخولك',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'أنشئ حسابك',
  'register.heading': 'ابدأ التخطيط في دقيقتين',
  'register.description': 'حساب واحد يغطي كل رحلة وكل رفيق سفر وكل قائمة.',
  'register.haveAccount': 'لديك حساب بالفعل؟',
  'register.signIn': 'دخول',
  'register.terms': 'أوافق على شروط الخدمة وإشعار الخصوصية.',
  'register.submit': 'إنشاء حساب',
  'register.submitting': 'جارٍ إنشاء حسابك',

  'strength.hint': {
    zero: '{value} حرف على الأقل. عبارة قصيرة أفضل من كلمة بارعة.',
    one: 'حرف واحد على الأقل. عبارة قصيرة أفضل من كلمة بارعة.',
    two: 'حرفان على الأقل. عبارة قصيرة أفضل من كلمة بارعة.',
    few: '{value} أحرف على الأقل. عبارة قصيرة أفضل من كلمة بارعة.',
    many: '{value} حرفًا على الأقل. عبارة قصيرة أفضل من كلمة بارعة.',
    other: '{value} حرف على الأقل. عبارة قصيرة أفضل من كلمة بارعة.',
  },
  'strength.tooShort': 'القوة: قصيرة جدًا',
  'strength.weak': 'القوة: ضعيفة',
  'strength.fair': 'القوة: مقبولة',
  'strength.strong': 'القوة: قوية',
  'strength.excellent': 'القوة: ممتازة',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'مساعدة كلمة المرور',
  'forgot.heading': 'أعد تعيين كلمة مرورك',
  'forgot.description':
    'أخبرنا بالعنوان المسجّل في حسابك وسنرسل إليك رابطًا لتعيين كلمة مرور جديدة.',
  'forgot.submit': 'أرسل لي رابط إعادة التعيين',
  'forgot.submitting': 'جارٍ إرسال رابطك',
  'forgot.back': 'العودة إلى الدخول',
  'forgot.sent.eyebrow': 'تحقق من بريدك',
  'forgot.sent.heading': 'رابط إعادة التعيين في طريقه إليك',
  'forgot.sent.description':
    'إن كان هناك حساب يستخدم {email}، فرابط اختيار كلمة مرور جديدة موجود في ذلك البريد الآن.',
  'forgot.sent.title': 'الرابط يعمل مرة واحدة، ولمدة ساعة',
  'forgot.sent.body':
    'لم يصل شيء؟ تحقق من البريد المزعج ثم أرسله مرة أخرى. وطلب رابط جديد يُلغي السابق بهدوء.',
  'forgot.sent.resend': 'أرسله مرة أخرى',
  'forgot.sent.resending': 'جارٍ الإرسال مرة أخرى',
  'forgot.sent.change': 'استخدم بريدًا آخر',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'إعادة تعيين كلمة المرور',
  'reset.heading': 'اختر كلمة مرور جديدة',
  'reset.description': {
    zero: 'اختر شيئًا لا يقل عن {value} حرف. العبارة القصيرة أسهل في التذكر وأصعب في التخمين.',
    one: 'اختر شيئًا لا يقل عن حرف واحد. العبارة القصيرة أسهل في التذكر وأصعب في التخمين.',
    two: 'اختر شيئًا لا يقل عن حرفين. العبارة القصيرة أسهل في التذكر وأصعب في التخمين.',
    few: 'اختر شيئًا لا يقل عن {value} أحرف. العبارة القصيرة أسهل في التذكر وأصعب في التخمين.',
    many: 'اختر شيئًا لا يقل عن {value} حرفًا. العبارة القصيرة أسهل في التذكر وأصعب في التخمين.',
    other:
      'اختر شيئًا لا يقل عن {value} حرف. العبارة القصيرة أسهل في التذكر وأصعب في التخمين.',
  },
  'reset.submit': 'تعيين كلمة المرور الجديدة',
  'reset.submitting': 'جارٍ حفظ كلمة مرورك',
  'reset.back': 'العودة إلى الدخول',
  'reset.stale.heading': 'لا يمكن استخدام هذا الرابط',
  'reset.stale.description':
    'روابط إعادة التعيين تنتهي بعد ساعة وتعمل مرة واحدة فقط — وهي أأمن مقايضة ممكنة.',
  'reset.stale.action': 'اطلب رابطًا جديدًا',
  'reset.done.heading': 'كلمة مرورك الجديدة جاهزة',
  'reset.done.description':
    'أُخرجت كل الجلسات الأخرى، فمن كان يعرف كلمة المرور القديمة لم يبق له طريق للدخول.',
  'reset.done.title': 'تم الخروج من كل مكان آخر',
  'reset.done.body': 'ادخل بكلمة مرورك الجديدة لتتابع التخطيط.',
  'reset.done.action': 'دخول',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'التحقق بخطوتين',
  'twoFactor.heading': 'أكّد أنك أنت',
  'twoFactor.description':
    'حسابك محمي بعامل ثانٍ. أدخل الرمز الحالي من تطبيق المصادقة.',
  'twoFactor.back': 'ابدأ من جديد من صفحة الدخول',
  'twoFactor.methods': 'طريقة التحقق',
  'twoFactor.totp.tab': 'تطبيق المصادقة',
  'twoFactor.totp.label': 'رمز من ستة أرقام',
  'twoFactor.totp.hint': 'الرموز تتجدد كل ثلاثين ثانية.',
  'twoFactor.totp.submit': 'تحقق وتابع',
  'twoFactor.backup.tab': 'رمز احتياطي',
  'twoFactor.backup.label': 'الرمز الاحتياطي',
  'twoFactor.backup.hint':
    'من القائمة التي حفظتها عند تفعيل التحقق بخطوتين. وكل رمز يعمل مرة واحدة.',
  'twoFactor.backup.submit': 'استخدم رمزًا احتياطيًا',
  'twoFactor.submitting': 'جارٍ التحقق من رمزك',
  'twoFactor.trust.label': 'ثق بهذا الجهاز لمدة ثلاثين يومًا',
  'twoFactor.trust.detail':
    'تخطَّ هذه الخطوة في هذا المتصفح حتى ذلك الحين. ولا تفعل ذلك إلا على جهاز لك وحدك.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'تم تأكيد البريد',
  'verify.done.heading': 'كل شيء جاهز',
  'verify.done.description':
    'عنوانك مُوثَّق، فستصلك الدعوات والتنبيهات وملخصات الرحلات.',
  'verify.done.title': 'مُوثَّق',
  'verify.done.body': 'تم تأكيد {email} على هذا الحساب.',
  'verify.done.bodyUnknown': 'تم تأكيد بريدك الإلكتروني على هذا الحساب.',
  'verify.done.action': 'اذهب إلى لوحتك',

  'verify.pending.eyebrow': 'أمر أخير',
  'verify.pending.heading': 'أكّد بريدك الإلكتروني',
  'verify.pending.description':
    'أرسلنا رابط تأكيد إلى {email}. وفتحه يجعل حسابك قابلًا للاسترجاع ويسمح لرفاق الرحلة بدعوتك.',
  'verify.pending.wrongAddress': 'العنوان خطأ؟',
  'verify.pending.changeIt': 'غيّره من الإعدادات',
  'verify.pending.title': 'الرابط صالح أربعًا وعشرين ساعة',
  'verify.pending.body':
    'لا شيء في بريدك؟ تحقق من البريد المزعج ثم أرسله مرة أخرى.',
  'verify.pending.resentTitle': 'أُرسل مرة أخرى الآن',
  'verify.pending.resentBody':
    'أمهله دقيقة ثم تحقق من بريدك — ومن مجلد البريد المزعج أيضًا.',
  'verify.pending.resend': 'إعادة إرسال التأكيد',
  'verify.pending.resending': 'جارٍ الإرسال مرة أخرى',
  'verify.pending.continue': 'المتابعة على أي حال',

  'verify.request.eyebrow': 'تأكيد البريد',
  'verify.request.heading': 'أرسل رابط تأكيد جديدًا',
  'verify.request.description':
    'روابط التأكيد صالحة أربعًا وعشرين ساعة وتعمل مرة واحدة. أخبرنا بعنوانك وسيكون رابط جديد في طريقه.',
  'verify.request.submit': 'أرسل رابط التأكيد',
  'verify.request.submitting': 'جارٍ إرسال رابطك',
  'verify.request.sentTitle': 'في الطريق',
  'verify.request.sentBody':
    'إن كان لذلك العنوان حساب ينتظر التأكيد، فالرابط في بريده الآن.',
  'verify.request.change': 'استخدم بريدًا آخر',
  'verify.request.back': 'العودة إلى الدخول',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'دعوة إلى مساحة عمل',
  'invitation.heading': 'انضم إلى {workspace}',
  'invitation.description':
    'القبول يضيفك إلى مساحة العمل هذه ويشارك معك رحلاتها وميزانياتها وقوائمها.',
  'invitation.invitedAs': 'الدعوة موجّهة إلى {email}',
  'invitation.role': 'دورك',
  'invitation.means': 'يعني',
  'invitation.invitedBy': 'الدعوة من',
  'invitation.expires': 'تنتهي',
  'invitation.accept': 'قبول الدعوة',
  'invitation.accepting': 'جارٍ الانضمام إلى مساحة العمل',
  'invitation.decline': 'رفض',
  'invitation.declining': 'جارٍ الرفض',
  'invitation.reassurance':
    'يمكنك مغادرة مساحة العمل في أي وقت من إعداداتها، وما تنشئه خارجها لا يُشارَك أبدًا.',

  'invitation.role.owner': 'المالك — تحكم كامل، بما فيه الفواتير',
  'invitation.role.admin': 'مسؤول — إدارة الرحلات والأعضاء والإعدادات',
  'invitation.role.member': 'عضو — يخطط الرحلات مع الجميع',
  'invitation.role.other': '{role} — الوصول يحدده مالك مساحة العمل',
  'invitation.role.badge.owner': 'المالك',
  'invitation.role.badge.admin': 'مسؤول',
  'invitation.role.badge.member': 'عضو',

  'invitation.anonymous.heading': 'ادخل لترى دعوتك',
  'invitation.anonymous.description':
    'الدعوات مرتبطة بالبريد الذي أُرسلت إليه، فنحتاج أن نعرف من أنت قبل أن نعرضها لك.',
  'invitation.anonymous.body':
    'استخدم العنوان الذي أُرسلت إليه الدعوة. وسنعيدك إلى هنا مباشرةً بعد ذلك.',
  'invitation.anonymous.action': 'ادخل للمتابعة',
  'invitation.anonymous.noAccount': 'لا حساب بعد؟',
  'invitation.anonymous.register': 'أنشئ حسابًا بالعنوان المدعو',

  'invitation.mismatch.heading': 'هذه الدعوة لعنوان آخر',
  'invitation.mismatch.description':
    'أنت مسجَّل الدخول بحساب آخر، فليست هذه الدعوة لك لتقبلها.',
  'invitation.mismatch.title': 'مسجَّل الدخول باسم {email}',
  'invitation.mismatch.body':
    'سجّل الخروج وادخل بالعنوان الذي أُرسلت إليه الدعوة، أو اطلب دعوة جديدة إلى هذا الحساب.',
  'invitation.mismatch.action': 'تبديل الحساب',
  'invitation.mismatch.back': 'العودة إلى الدخول',

  'invitation.unverified.heading': 'أكّد بريدك لتنضم',
  'invitation.unverified.description':
    'مساحات العمل لا تقبل إلا العناوين المؤكدة، فلا يُضاف أحد بخطأ مطبعي.',
  'invitation.unverified.title': 'لم يُؤكَّد {email} بعد',
  'invitation.unverified.body':
    'افتح رابط التأكيد في بريدك ثم عد إلى هذه الصفحة. وستكون الدعوة في انتظارك.',
  'invitation.unverified.action': 'أكّد بريدي',
  'invitation.unverified.resend': 'إعادة إرسال بريد التأكيد',

  'invitation.unavailable.heading': 'هذه الدعوة لم تعد متاحة',
  'invitation.unavailable.description':
    'الدعوات صالحة سبعة أيام، وتنتهي لحظة استخدامها أو سحبها.',
  'invitation.unavailable.title': 'لا شيء لقبوله هنا',
  'invitation.unavailable.body':
    'اطلب من دعاك أن يرسل دعوة جديدة، وستظهر في هذه الصفحة فورًا.',
  'invitation.unavailable.dashboard': 'اذهب إلى لوحتك',

  'invitation.declined.eyebrow': 'رُفضت الدعوة',
  'invitation.declined.heading': 'لا مشكلة — لم يُشارَك شيء',
  'invitation.declined.description':
    'أُبلغ مالك مساحة العمل، ولم يعد هذا الرابط قابلًا للاستخدام.',
  'invitation.declined.action': 'اذهب إلى لوحتك',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'حدث خطأ ما',
  'error.unexpected.detail': 'لم ينجح ذلك. يرجى المحاولة بعد لحظات.',
  'error.rateLimited.title': 'محاولات كثيرة جدًا',
  'error.rateLimited.detail':
    'لأمانك أوقفنا الدخول من هذا الجهاز لدقائق. أعد المحاولة قريبًا.',
  'error.offline.title': 'لا اتصال',
  'error.offline.detail':
    'لم نتمكن من الوصول إلى planned.travel. تحقق من اتصالك ثم أعد المحاولة.',

  'error.credentials.title': 'هذه البيانات غير متطابقة',
  'error.credentials.detail':
    'راجع البريد وكلمة المرور ثم أعد المحاولة. وإن أنشأت حسابك بـ Google أو Apple فاستخدم ذلك الزر.',
  'error.password.title': 'هذه البيانات غير متطابقة',
  'error.password.detail': 'راجع البريد وكلمة المرور ثم أعد المحاولة.',
  'error.noPassword.title': 'لا كلمة مرور على هذا الحساب',
  'error.noPassword.detail':
    'هذا الحساب يدخل بمزوّد اجتماعي أو بمفتاح مرور. استخدم أحد الخيارات أعلاه.',
  'error.unverified.title': 'أكّد بريدك أولًا',
  'error.unverified.detail':
    'أرسلنا لك رابط تأكيد عند إنشاء الحساب. افتحه ثم عد إلى هنا.',
  'error.emailTaken.title': 'هذا البريد مسجَّل بالفعل',
  'error.emailTaken.detail':
    'ادخل بدلًا من ذلك، أو أعد تعيين كلمة مرورك إن نسيتها.',
  'error.noAccount.title': 'لم نجد ذلك الحساب',
  'error.noAccount.detail': 'راجع العنوان، أو أنشئ حسابًا جديدًا.',
  'error.passwordTooShort.title': 'كلمة المرور قصيرة جدًا',
  'error.passwordTooShort.detail': 'اختر عبارة أطول ثم أعد المحاولة.',
  'error.passwordTooLong.title': 'كلمة المرور طويلة جدًا',
  'error.passwordTooLong.detail': 'اختر عبارة أقصر ثم أعد المحاولة.',
  'error.linkSpent.title': 'هذا الرابط لم يعد صالحًا',
  'error.linkSpent.detail':
    'روابط كلمة المرور تُستخدم مرة واحدة. اطلب واحدًا جديدًا وسنرسله فورًا.',
  'error.linkExpired.title': 'انتهت صلاحية هذا الرابط',
  'error.linkExpired.detail': 'اطلب واحدًا جديدًا وسنرسله فورًا.',
  'error.linkIncomplete.title': 'هذا الرابط ناقص',
  'error.linkIncomplete.detail':
    'روابط إعادة التعيين تحمل رمزًا لمرة واحدة. افتح أحدث رسالة، أو اطلب رابطًا جديدًا.',
  'error.sessionExpired.title': 'انتهت جلستك',
  'error.sessionExpired.detail': 'ادخل مرة أخرى لتتابع من حيث توقفت.',
  'error.alreadyVerified.title': 'مؤكَّد بالفعل',
  'error.alreadyVerified.detail': 'هذا البريد مُوثَّق. يمكنك الدخول كالمعتاد.',
  'error.badCode.title': 'هذا الرمز لم ينجح',
  'error.badCode.detail':
    'رموز المصادقة تدوم ثلاثين ثانية. انتظر الرمز التالي وأدخل الأرقام الستة كلها.',
  'error.badBackupCode.title': 'هذا الرمز الاحتياطي لم ينجح',
  'error.badBackupCode.detail':
    'كل رمز احتياطي يعمل مرة واحدة. جرّب الرمز التالي غير المستخدم من قائمتك.',
  'error.locked.title': 'الحساب مقفل مؤقتًا',
  'error.locked.detail':
    'محاولات تحقق فاشلة كثيرة. لأمانك هذا الحساب مقفل لدقائق.',
  'error.twoFactorOn.title': 'المصادقة الثنائية مفعّلة بالفعل',
  'error.twoFactorOn.detail':
    'إعدادها مرة أخرى سيوقف عمل تطبيق المصادقة الحالي، لذلك لم يتغير شيء. يمكنك إدارتها من هنا.',
  'error.noTwoFactor.title': 'التحقق بخطوتين غير مُعدّ',
  'error.noTwoFactor.detail': 'ادخل ببريدك وكلمة مرورك للمتابعة.',
  'error.twoFactorExpired.title': 'ابدأ من جديد من صفحة الدخول',
  'error.twoFactorExpired.detail':
    'انتهت صلاحية خطوة التحقق هذه. أدخل بريدك وكلمة مرورك مرة أخرى.',
  'error.invitationGone.title': 'هذه الدعوة لم تعد متاحة',
  'error.invitationGone.detail':
    'قد تكون انتهت أو سُحبت أو استُخدمت من قبل. اطلب دعوة جديدة.',
  'error.invitationOther.title': 'هذه الدعوة لشخص آخر',
  'error.invitationOther.detail':
    'أُرسلت إلى بريد مختلف. ادخل بذلك البريد لتقبلها.',
  'error.alreadyMember.title': 'أنت في مساحة العمل هذه بالفعل',
  'error.alreadyMember.detail': 'لا شيء لقبوله — افتحها من مبدّل مساحات العمل.',
  'error.workspaceFull.title': 'مساحة العمل هذه ممتلئة',
  'error.workspaceFull.detail':
    'بلغت حد أعضائها. اطلب من المالك تحرير مقعد أو ترقية الخطة.',
  'error.verifyBeforeJoin.title': 'أكّد بريدك أولًا',
  'error.verifyBeforeJoin.detail':
    'افتح رابط التأكيد الذي أرسلناه إليك ثم عد إلى هذه الدعوة.',

  'passkeyNotice.added': 'أُضيف مفتاح مرور إلى حسابك',
  'passkeyNotice.removed': 'أُزيل مفتاح مرور من حسابك',
  'passkeyNotice.security': 'الأمان',
  'passkeyNotice.action': 'إدارة مفاتيح المرور',
  'passkeyNotice.recovery':
    'إذا لم تتعرف على هذا التغيير، فغيّر كلمة المرور وأنهِ الجلسات غير المعروفة. إعادة تعيين كلمة المرور لا تزيل مفاتيح المرور. راجع مفاتيح المرور وأزل أي مفتاح لا تتعرف عليه.',
  'error.passwordAttemptsLocked.title': 'تم قفل تأكيد كلمة المرور',
  'error.passwordAttemptsLocked.detail':
    'لم يعد بإمكان هذه الجلسة تأكيد كلمة مرورك. سجّل الخروج ثم سجّل الدخول مجددًا.',
  'error.passwordResultUnknown.title': 'تحقق من إعدادات الأمان',
  'error.passwordResultUnknown.detail':
    'ربما تم حفظ التغيير. أبقِ هذه الجلسة مفتوحة حتى تتمكن من تسجيل الدخول مجددًا. إذا غيّرت كلمة المرور، فجرّب الجديدة. إذا استبدلت الرموز الاحتياطية، فقد لا تعمل المجموعة القديمة؛ استخدم تطبيق المصادقة أو جلسة أخرى مسجّلًا فيها الدخول لإنشاء مجموعة جديدة.',
} satisfies TranslationOf<typeof En>

export default messages
