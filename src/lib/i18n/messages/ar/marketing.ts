/**
 * The public pages' copy, in ar.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **الاتجاه.** العربية من اليمين إلى اليسار: التنسيق منطقي والأيقونات
 * الاتجاهية تُعكس. أسماء المنتجات الأجنبية تبقى بحروفها اللاتينية.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'ابدأ مجانًا',
  'action.signIn': 'تسجيل الدخول',
  'action.pricing': 'الأسعار',
  'action.seePricing': 'اطّلع على الأسعار',
  'action.skipToContent': 'الانتقال إلى المحتوى',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — الصفحة الرئيسية',
  'nav.onThisPage': 'في هذه الصفحة',
  'anchor.planner': 'المخطِّط',
  'anchor.modules': 'الوحدات',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'أفلِتها في اليوم {day}',
  'legal.summaryNote':
    'الخلاصة هنا لتُقرأ. والذي يُطبَّق فعلًا هو ما في الأسفل.',
  'visual.daysTravelled': 'أيام السفر',
  'visual.acrossEveryTrip': 'في كل الرحلات',
  'visual.mapFilled': 'اكتمل {percent}٪ من الخريطة',
  'visual.previewSummary':
    'معاينة لِلوحة planned.travel: الرحلة القادمة بتواريخها وعدد المسافرين وعدد الأماكن؛ ومجاميع الدول المزارة والرحلات وأيام السفر؛ وخريطة لمسار الرحلة؛ وأقرب حجزين.',
  'visual.placesMapped': {
    zero: '{value} مكان على الخريطة',
    one: 'مكان واحد على الخريطة',
    two: 'مكانان على الخريطة',
    few: '{value} أماكن على الخريطة',
    many: '{value} مكانًا على الخريطة',
    other: '{value} مكان على الخريطة',
  },
  'visual.splitWays': {
    zero: 'دون تقسيم',
    one: 'دون تقسيم',
    two: 'مقسومة على اثنين',
    few: 'مقسومة على {value}',
    many: 'مقسومة على {value}',
    other: 'مقسومة على {value}',
  },
  'visual.tripTotal': 'مجموع الرحلة',
  'visual.paidSplit': 'دفع {who} · {split}',
  'visual.nextUp': 'التالي',
  'visual.ofTotal': '{done} من {total}',
  'visual.awaitingReply': 'بانتظار الرد',
  'visual.upcoming': 'القادمة',
  'visual.days': {
    zero: '{value} يوم',
    one: 'يوم واحد',
    two: 'يومان',
    few: '{value} أيام',
    many: '{value} يومًا',
    other: '{value} يوم',
  },
  'visual.places': {
    zero: '{value} مكان',
    one: 'مكان واحد',
    two: 'مكانان',
    few: '{value} أماكن',
    many: '{value} مكانًا',
    other: '{value} مكان',
  },
  'visual.transfersLeft': {
    zero: 'بقي {value} تحويل',
    one: 'بقي تحويل واحد',
    two: 'بقي تحويلان',
    few: 'بقيت {value} تحويلات',
    many: 'بقي {value} تحويلًا',
    other: 'بقي {value} تحويل',
  },

  'legal.badge.version': 'الإصدار {version}',
  'legal.badge.effective': 'ساري من {updated}',
  'legal.notice.title': 'هذا نموذج، لا مشورة قانونية',
  'legal.notice.body':
    'كُتب بإنجليزية بسيطة ليكون نقطة انطلاق نافعة فعلًا لخدمة صغيرة لتخطيط الرحلات، وكل فراغ يجب أن يملأه العمل مُعلَّم. واعرضه على محام مؤهَّل في نطاق قضائك ليراجعه ويكيّفه قبل أن تقبل عميلًا واحدًا. ولا شيء هنا يزعم شهادة أو مراجعة أو معيار امتثال يحمله planned.travel.',
  'legal.contents': 'المحتويات',
  'legal.shortVersion': 'الخلاصة',
  'legal.both': 'الوثيقتان تُطبَّقان معًا.',

  'landing.plans.title': 'ابدأ مجانًا. وادفع حين يستحق ذلك.',
  'landing.plans.lede':
    'كل خطة تشمل مخطط اليوم والخريطة والميزانيات وقوائم الحِزم. والخطط المدفوعة - من {price} شهريًا - تفتح الرحلات بلا حدود، والحجوزات، والمفكرة، والخرائط دون اتصال، والتصدير.',
  'landing.plans.ledeFree':
    'كل خطة تشمل مخطط اليوم والخريطة والميزانيات وقوائم الحِزم. والخطط المدفوعة تفتح الرحلات بلا حدود، والحجوزات، والمفكرة، والخرائط دون اتصال، والتصدير.',
  'landing.plans.compare': 'قارن كل حدّ، سطرًا بسطر',
  'landing.questions.title': 'أسئلة، وأجوبة بلا لفّ',
  'landing.questions.lede':
    'الأمور الستة التي يريد الناس معرفتها فعلًا قبل أن يبدأوا.',
  'cta.heading': 'رحلتك القادمة تستحق خطة كما ينبغي، من الآن',
  'cta.lede':
    'رحلتان، والخريطة كاملة، وخطة اليوم، وقوائم الحِزم: مجانًا، بلا بطاقة وبلا عدّاد تنازلي.',
  'landing.faq.seats.q': 'هل على من أسافر معهم أن يدفعوا أيضًا؟',
  'landing.faq.seats.a':
    'لا. كل من تدعوه إلى مساحة عمل {crew} تغطّيه مقاعدها. يسجّل الدخول بحسابه الخاص، ولا يرى إلا الرحلات التي أضفته إليها.',
  'landing.faq.phone.q': 'هل يعمل جيدًا على الهاتف؟',
  'landing.faq.phone.a':
    'نعم. تخطيطات الهاتف مرسومة على حدة، وليست مضغوطة من تخطيطات سطح المكتب، وهذا موقع ويب: لا شيء لتثبّته ولا شيء لتُبقيه محدَّثًا.',
  'landing.faq.offline.q': 'هل أستطيع استخدام الخريطة بلا شبكة؟',
  'landing.faq.offline.a':
    'في خطتي {solo} و{crew} تنزّل منطقة قبل الطيران، فتُرسَم الخريطة حتى لو هبطت بلا بيانات. أما تعديل الرحلة نفسها فيحتاج اتصالًا.',
  'landing.faq.privacy.q': 'من يرى رحلتي؟',
  'landing.faq.privacy.a':
    'الرحلة تنتمي إلى مساحة عمل واحدة، ولا يفتحها إلا المدعوّون إليها. لا شيء علنيّ، ولا توجد أي واجهة استكشاف، ولا يُشارَك شيء مع أحد افتراضيًا.',
  'landing.faq.stop.q': 'ماذا يحدث لرحلاتي إن توقفت عن الدفع؟',
  'landing.faq.stop.a':
    'لا شيء يُحذَف. تُقفَل الوحدات المدفوعة، وتبقى رحلاتك في مكانها تمامًا، ويُفتَح كل شيء من جديد لحظة اشتراكك. وخطة {free} تبقى بلا مقابل، بلا عدّاد.',

  'action.startPlanning': 'ابدأ التخطيط مجانًا',
  'cta.comparePlans': 'قارن الخطط',
  'landing.hero.eyebrow': 'تخطيط الرحلات مع الآخرين',
  'landing.hero.title': 'خطِّط للرحلة.',
  'landing.hero.titleQuiet': 'لا للجدول.',
  'landing.hero.lede':
    'خطة واحدة على خريطة حقيقية، مشتركة مباشرة مع كل المسافرين، ومعها الحجوزات والمال وقائمة الحِزم.',
  'landing.hero.secondary': 'انظر كم يكلّف',
  'landing.trust.noCard': 'بلا بطاقة للبدء',
  'landing.trust.noAds': 'بلا إعلانات ولا روابط إحالة',
  'landing.trust.export': 'صدِّر كل شيء، وقت ما تشاء',

  'proof.eyebrow': 'أجوبة مباشرة',
  'proof.title': 'لا شهادات عملاء، لأننا لم نستحقها بعد',
  'proof.lede':
    'planned.travel جديد. وبدلًا من اختلاق اقتباس أو استعارة شعار أحد، هذا بالضبط ما يفعله، ولمن هو، وما لن يفعله بك أبدًا.',
  'proof.who.label': 'لمن هو',
  'proof.who.heading': 'لمن ينتهي به الأمر إلى إعداد الجدول',
  'proof.who.body':
    'للأزواج والعائلات ومجموعات الأصدقاء التي تريد خطة واحدة يراها الجميع، بدلًا من ست صور شاشة وثلاث محادثات جماعية وملاحظة مشتركة لم يفتحها أحد منذ مارس.',
  'proof.not.label': 'ما ليس هو',
  'proof.not.heading': 'ليس موقع حجوزات، ولا معروضًا للبيع لأحدها',
  'proof.not.body':
    'لا نأخذ عمولة، ولا نحمل إعلانات، ولا نضع روابط إحالة، فلا شيء في صفحة يوجّهك بهدوء إلى فندق بعينه. أنت من يدفع لنا، أي أننا نعمل لصالحك.',
  'proof.where.label': 'أين تسكن أشياؤك',
  'proof.where.heading': 'على Cloudflare، في مساحة عملك الخاصة',
  'proof.where.body':
    'الرحلات في قاعدة بيانات محصورة بمساحة عملك، والملفات في مخزن الكائنات الخاص بنا، وكلاهما يُقدَّم من حافة شبكة Cloudflare. وPolar، بائعنا المسجَّل، يدير الدفع ويصدر الفاتورة، فرقم بطاقتك لا يصل إلينا أبدًا.',
  'proof.promise.ads.title': 'لا إعلانات ولا تحليلات لأطراف ثالثة',
  'proof.promise.ads.body': 'لا شيء في هذه الصفحة يقيسك لحساب شخص آخر.',
  'proof.promise.sold.title': 'رحلاتك لا تُباع ولا تُؤجَّر أبدًا',
  'proof.promise.sold.body': 'لا للمعلنين، ولا لشركات السفر، ولا لأحد.',
  'proof.promise.leave.title': 'ارحل وقت ما تشاء، وخُذ كل شيء معك',
  'proof.promise.leave.body':
    'خطط بصيغة PDF، وملفات تقويم، وأماكنك بصيغة GeoJSON.',
  'proof.certification':
    'لا نملك اليوم أي شهادة أمنية، ولن نُلوّح بواحدة. وحين يُراجَع planned.travel وفق معيار، هنا سنذكر المعيار والمراجع والتاريخ - لا قبل ذلك.',

  'feature.modules.title': 'بقية الرحلة، مرتَّبة',
  'feature.modules.lede':
    'كل وحدة تؤدي عملًا واحدًا كما ينبغي، وتسلّم نتيجته إلى البقية. لا شيء هنا تبويب فارغ ينتظر إصدارًا قادمًا.',
  'feature.module.lists.benefit': 'لا أحد يصل بلا محوِّل الكهرباء.',
  'feature.module.lists.detail':
    'الحِزم والمهام والمشتريات والمستندات: قائمة لكل غرض، مشتركة مع كل المسافرين وتُعلَّم أولًا بأول.',
  'feature.module.journal.name': 'المفكرة',
  'feature.module.journal.benefit': 'الرحلة تصبح حكاية، لا مجلدًا.',
  'feature.module.journal.detail':
    'مدخلات بترتيب التاريخ، مع الصور التي التقطتها، وأين كنت، والطقس، وكيف كان اليوم فعلًا.',
  'feature.module.atlas.benefit': 'خريطة واحدة لكل مكان زرته.',
  'feature.module.atlas.detail':
    'علِّم بلدًا كمزار، فينضم إلى خريطة عالمك: أول زيارة، وأحدثها، وكم مرة عدت.',
  'feature.module.vacay.benefit': 'اطلب الإجازة قبل أن تحجز الطيران.',
  'feature.module.vacay.detail':
    'علِّم الأيام التي تكون فيها غائبًا فتمتلئ السنة: نهايات الأسابيع، والأعياد الرسمية، وإجازات الآخرين في الشبكة نفسها.',
  'feature.module.collab.benefit': 'القرارات تبقى مع الرحلة.',
  'feature.module.collab.detail':
    'خيط واحد لكل رحلة، وملاحظات مشتركة لما يجب أن يتذكره الجميع، وتصويت للحظة التي لا تتفق فيها المجموعة على العشاء.',
  'feature.module.files.benefit': 'بطاقات الصعود في مكان تجدها فيه.',
  'feature.module.files.detail':
    'التأكيدات والتذاكر ووثائق التأمين والإيصالات مرفقة بالرحلة التي تنتمي إليها، لا مدفونة في بريد.',

  'feature.planner.title': 'خطة يوم بيوم مرسومة على خريطة حقيقية',
  'feature.planner.lede':
    'اجمع الأماكن التي تريد رؤيتها، ثم اسحبها إلى يوم بعينه. الخريطة تعيد رسم المسار وأنت تعمل، فترى فورًا حين يجعلك صباح واحد تعبر المدينة مرتين.',
  'feature.planner.point.days':
    'عمود لكل يوم، مع تاريخه وطقسه والمكان الذي تنام فيه.',
  'feature.planner.point.unscheduled':
    'الأماكن بلا موعد تنتظر في عمودها الخاص حتى تحصل على يوم.',
  'feature.planner.point.crew':
    'في {crew} يسحب الجميع في الوقت نفسه: مؤشرات مباشرة، مزامنة فورية، بلا إعادة تحميل.',
  'feature.planner.point.tiles':
    'بلاطات متجهية من مخزننا الخاص، فلا مزوّد خرائط يراقب ما تخطط له.',
  'feature.costs.title': 'مصاريف مشتركة تُسوّى فعلًا',
  'feature.costs.lede':
    'دوّن ما تصرفه بعملة الرحلة، وقسّم كل مصروف كما اتفقتم عليه فعلًا، وشاهد أقصر سلسلة تحويلات تُغلق الحساب كله.',
  'feature.costs.point.split':
    'بالتساوي، أو بالنسبة، أو بالمبلغ الدقيق: لكل مصروف، لا لكل رحلة.',
  'feature.costs.point.currency':
    'كل شيء محوَّل إلى عملة رحلة واحدة، حتى يعني المجموع شيئًا.',
  'feature.costs.point.settle':
    'شاشة التسوية تقول من يدفع لمن، وتسجّل التحويل بمجرد حدوثه.',
  'feature.costs.point.receipt':
    'أرفق الإيصال بالمصروف، ليبقى للرقم دليله دائمًا.',
  'feature.book.title': 'كل حجز، مع الرمز الذي تحتاجه عند الباب',
  'feature.book.lede':
    'الإقامات والطاولات والجولات والتذاكر في قائمة واحدة، بجوار الرحلات الجوية والقطارات والعبّارات التي تنقلك بينها: لكل منها رقم تأكيده واليوم الذي ينتمي إليه.',
  'feature.book.point.legs':
    'مراحل التنقل تحمل المقعد والرصيف والصالة ورمز الحجز.',
  'feature.book.point.day': 'الحجز مرتبط بيوم، فيظهر في الخطة دون إعادة كتابة.',
  'feature.book.point.states':
    'مطلوب ومؤكَّد وملغى حالات منفصلة، لا ملاحظة في خانة.',
  'feature.book.point.export':
    'صدِّر الرحلة كاملة كخطة PDF أو ملف تقويم، قبل أن تطير.',

  'pricing.faq.trial.q': 'ماذا يحدث عند انتهاء الفترة التجريبية؟',
  'pricing.faq.trial.a':
    'تتحول الفترة التجريبية إلى الخطة المدفوعة. تأخذ Polar وسيلة دفع عند بدء الفترة وتخصم في اليوم الذي تنتهي فيه، فإن ألغيت قبل ذلك لا يُخصم منك شيء أبدًا. ولا يُحذَف شيء في الحالتين: تُقفَل الوحدات المدفوعة، وتبقى رحلاتك في مكانها تمامًا، ويُفتح كل شيء من جديد لحظة اشتراكك.',
  'pricing.faq.seller.q': 'من مَن أشتري في الواقع؟',
  'pricing.faq.seller.a':
    'من Polar. هي بائعنا المسجَّل، أي أنها تبيعك الاشتراك بصفتها موزِّعًا لنا، وتتلقّى الدفع، وتُصدر الفاتورة باسمها، وتحدِّد ضريبة البيع أو القيمة المضافة التي يفرضها بلدك وتجمعها وتورِّدها. كما تُسوَّى معها المبالغ المرتجعة ونزاعات البطاقات. ما زلنا نحن من نُشغِّل الخدمة ونجيب على بريدك.',
  'pricing.faq.change.q': 'هل أستطيع تغيير الخطة في منتصف رحلة؟',
  'pricing.faq.change.a':
    'نعم. الترقية تسري فورًا وتُحسَب بالتناسب اليومي، والتخفيض يسري في نهاية المدة التي دفعتها بالفعل، فلا تفقد أبدًا وصولًا دفعت مقابله.',
  'pricing.faq.seats.q': 'كيف تعمل الفاتورة لكل عضو في خطة {crew}؟',
  'pricing.faq.seats.a':
    'تدفع مقابل المقاعد المشغولة فعلًا، ويمكنك تغيير العدد في أي وقت. والدعوات المعلَّقة تُحسَب على مقاعدك، فلا تتجاوز مساحة العمل الخطة بهدوء.',
  'pricing.faq.guests.q': 'هل يحتاج من أسافر معهم إلى اشتراك خاص؟',
  'pricing.faq.guests.a':
    'لا. كل من تدعوه إلى مساحة عمل {crew} تغطّيه مقاعدها. يسجّل الدخول بحسابه الخاص ويرى الرحلات التي أُضيف إليها.',
  'pricing.faq.storage.q': 'ما الذي يُحسَب على المساحة؟',
  'pricing.faq.storage.a':
    'الصور والتذاكر والتأكيدات وأي ملف تُرفقه برحلة. أما بلاطات الخريطة والتطبيق نفسه فلا تُحسَب أبدًا. وفي الإعدادات ترى بالضبط ما يشغل المساحة.',
  'pricing.faq.export.q': 'هل أستطيع إخراج بياناتي؟',
  'pricing.faq.export.a':
    'دائمًا. كل رحلة تُصدَّر خطةً بصيغة PDF وملفَّ تقويم، وأماكنك تُصدَّر بصيغة GeoJSON. إنها رحلاتك، لا رحلاتنا.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'بلا بطاقة، بلا موعد، بلا عدّ تنازلي',
  'pricing.card.yearlyPerSeat': '{amount} في السنة لكل عضو، تُدفع مرة واحدة',
  'pricing.card.yearly': '{amount} تُدفع مرة واحدة في السنة',
  'pricing.card.seatsUnlimited': 'أعضاء بلا حدّ',
  'pricing.card.tripsUnlimited': 'رحلات بلا حدّ',
  'pricing.card.startFree': 'ابدأ مجانًا',
  'pricing.card.startTrial': 'جرّب {plan}',
  'pricing.card.popular': 'الأكثر اختيارًا',
  'pricing.card.noteYearly': 'تُحصَّل مرة واحدة في السنة. شهران على حسابنا.',
  'pricing.card.noteMonthly': 'تُحصَّل شهريًا. تُغيّر أو تُلغي وقت ما تشاء.',
  'pricing.card.trial': {
    zero: 'تجربة {value} يوم مجانًا، البطاقة مقدَّمًا، والخصم عند الانتهاء',
    one: 'تجربة يوم واحد مجانًا، البطاقة مقدَّمًا، والخصم عند الانتهاء',
    two: 'تجربة يومين مجانًا، البطاقة مقدَّمًا، والخصم عند الانتهاء',
    few: 'تجربة {value} أيام مجانًا، البطاقة مقدَّمًا، والخصم عند الانتهاء',
    many: 'تجربة {value} يومًا مجانًا، البطاقة مقدَّمًا، والخصم عند الانتهاء',
    other: 'تجربة {value} يوم مجانًا، البطاقة مقدَّمًا، والخصم عند الانتهاء',
  },
  'pricing.card.seatsUpTo': {
    zero: 'حتى {value} عضو',
    one: 'عضو واحد',
    two: 'عضوان',
    few: 'حتى {value} أعضاء',
    many: 'حتى {value} عضوًا',
    other: 'حتى {value} عضو',
  },
  'pricing.card.trips': {
    zero: '{value} رحلة في وقت واحد',
    one: 'رحلة واحدة في وقت واحد',
    two: 'رحلتان في وقت واحد',
    few: '{value} رحلات في وقت واحد',
    many: '{value} رحلة في وقت واحد',
    other: '{value} رحلة في وقت واحد',
  },

  'pricing.feature.storage': '{size} للصور والمستندات',
  'pricing.feature.storageShared': '{size} مشتركة للصور والمستندات',
  'pricing.feature.free.tripsDetail': 'أرشِف واحدة لتبدأ أخرى',
  'pricing.feature.solo.modules': 'كل وحدات التخطيط',
  'pricing.feature.solo.modulesDetail': 'الحجوزات، المفكرة، الميزانيات، الحِزم',
  'pricing.feature.solo.offlineDetail': 'نزِّل المناطق قبل الطيران',
  'pricing.feature.crew.membersDetail':
    'الفاتورة لكل عضو، تُغيّرها وقت ما تشاء',
  'pricing.feature.crew.realtimeDetail': 'مؤشرات مباشرة ومزامنة فورية',
  'pricing.feature.crew.supportDetail': 'رد من شخص خلال يوم عمل واحد',

  'pricing.hero.eyebrow': 'رحلتان مجانًا، للأبد',
  'pricing.hero.title': 'خطِّط لها كما ينبغي.',
  'pricing.hero.titleQuiet': 'ادفع مقابل ما تستخدمه.',
  'pricing.hero.lede':
    'خطِّط لرحلتين مجانًا. افتح كل وحدة لمسافر واحد، أو أحضر المجموعة كلها وحرِّروا خطة الرحلة نفسها في الوقت ذاته.',
  'pricing.hero.taxNote':
    'الأسعار بالدولار الأمريكي، دون ضريبة البيع أو القيمة المضافة. Polar هي بائعنا المسجَّل: هي التي تظهر على فاتورتك، وتحسب ما يفرضه بلدك، وتضيفه عند الدفع وتوَرِّده. يمكنك الإلغاء وقت ما تشاء، من داخل المنتج.',
  'pricing.compare.eyebrow': 'جنبًا إلى جنب',
  'pricing.compare.title': 'كل حدّ، بالمقارنة',
  'pricing.compare.lede':
    'جدول واحد، مبنيّ من الفهرس نفسه الذي تقرأه أنظمة الفوترة. إن قال سطر إن وحدة مشمولة، فإن فحص الصلاحيات يوافقه.',
  'pricing.compare.caption': 'مقارنة الميزات والحدود في الخطط الثلاث',
  'pricing.compare.feature': 'الميزة',
  'pricing.compare.limits': 'الحدود',
  'pricing.compare.included': 'مشمولة',
  'pricing.compare.notIncluded': 'غير مشمولة',
  'pricing.compare.includedIn': 'مشمولة في {plan}',
  'pricing.compare.notIn': 'غير موجودة في {plan}',
  'pricing.questions.eyebrow': 'قبل أن تسأل',
  'pricing.questions.title': 'أسئلة وأجوبة',
  'pricing.questions.lede': 'الفوترة والفترات التجريبية واستعادة بياناتك.',
  'pricing.cta.secondary': 'انظر كيف تعمل',
  'pricing.module.itinerary': 'خطة يومًا بيوم',
  'pricing.module.map': 'خريطة تفاعلية',
  'pricing.module.budget': 'الميزانيات وتقسيم المصروفات',
  'pricing.module.packing': 'قوائم الحِمل والمهام',
  'pricing.module.reservations': 'الحجوزات',
  'pricing.module.journal': 'دفتر الرحلة',
  'pricing.module.atlas': 'خريطة الدول التي زرتها',
  'pricing.module.collaboration': 'ادعُ مسافرين آخرين',
  'pricing.module.realtime': 'تعاون فوري',
  'pricing.module.offlineMaps': 'خرائط بلا اتصال',
  'pricing.module.pdfExport': 'تصدير PDF والتقويم',
  'pricing.module.prioritySupport': 'دعم بأولوية',

  'anchor.plans': 'الخطط',
  'anchor.compare': 'المقارنة',
  'anchor.questions': 'الأسئلة',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'مكان واحد لبرنامج الرحلة والخريطة والحجوزات والمال وقائمة الأمتعة — مشترك مع كل من سيسافر.',
  'footer.attribution':
    'يعمل على Cloudflare Workers. بيانات الخرائط © مساهمو OpenStreetMap. البيع والفواتير عبر Polar، تاجر السجل لدينا.',
  'footer.column.product': 'المنتج',
  'footer.column.account': 'الحساب',
  'footer.link.overview': 'نظرة عامة',
  'footer.link.everyModule': 'كل الوحدات',
  'footer.link.dayPlanner': 'مخطِّط اليوم',
  'footer.link.sharedCosts': 'النفقات المشتركة',
  'footer.link.reservations': 'الحجوزات',
  'footer.link.atlasJournal': 'الأطلس واليوميات',
  'footer.link.createAccount': 'إنشاء حساب',
  'footer.link.terms': 'شروط الخدمة',
  'footer.link.privacy': 'إشعار الخصوصية',
} satisfies TranslationOf<typeof En>

export default messages
