/**
 * The world tracker and the map chrome, in Arabic.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * الأطلس for the tracker, رحلة for a trip, قائمة الأمنيات for the bucket list,
 * مساحة العمل for the workspace.
 *
 * **Six branches.** `Intl.PluralRules` for `ar` reports zero, one, two, few,
 * many and other, and the gate requires all six. The forms follow Arabic
 * number agreement — 1 takes the singular, 2 the dual, 3–10 the broken plural,
 * 11–99 the accusative singular and 100 upwards the singular again — so `one`
 * and `two` carry the noun alone where a numeral beside the dual would read as
 * a stutter. The union of placeholders across branches is what the gate
 * compares, so a branch may leave a token out.
 *
 * **Patterns.** Ranges read «من … إلى …» rather than taking a dash, matching
 * this locale's `ui` catalogue, and clause lists join with the Arabic comma.
 * Country names stay English by design (`src/lib/atlas/country-names.ts` is a
 * frozen table); the bidi algorithm isolates them inside the Arabic sentence.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  'panel.stats.empty.title': 'لا يوجد ما يُحصى بعد',
  'panel.stats.empty.body':
    'حدّد بلدًا على الخريطة أو خطّط لرحلة، وستبدأ أرقامك بالظهور هنا.',
  'panel.stats.empty.action': 'خطّط لرحلة',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': 'خريطة العالم. لم تُسجَّل زيارة أي دولة بعد.',
  'screen.world.summary':
    'خريطة العالم وقد سُجِّلت زيارة {visited} من {total} دولة.',
  'screen.error.title': 'لم يُحمَّل الأطلس',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'جارٍ تحميل الخريطة',
  'map.controls.label': 'أدوات التحكم في الخريطة',
  'map.controls.zoomIn': 'تقريب',
  'map.controls.zoomOut': 'إبعاد',
  'map.controls.north': 'توجيه نحو الشمال',
  'map.controls.locate': 'تحديد موقعي',
  'map.controls.locateFailed': 'تعذّر علينا تحديد موقعك.',
  'map.controls.locateFailedBody':
    'تأكد من السماح لهذا الموقع بالوصول إلى موقعك الجغرافي، ثم حاول مجددًا.',

  'map.attribution.label': 'بيانات الخريطة من',
  'map.attribution.geocoder': 'تم تحديد الأماكن بواسطة',

  'map.basemap.title': 'خريطة الأساس غير متاحة',
  'map.basemap.body':
    'تفاصيل الشوارع غير متصلة حاليًا. لا يزال كل مكان معروضًا في موضعه الحقيقي، لذا تبقى المسافات والمجموعات دقيقة.',
  'map.basemap.credit': 'السواحل من',
  'map.basemap.retry': 'حاول مجددًا',
  'map.basemap.retrying': 'جارٍ التحقق من خريطة الأساس',

  'map.engine.unsupported.title': 'رسم الخريطة غير متاح',
  'map.engine.unsupported.body':
    'لا يستطيع هذا المتصفح تشغيل الخريطة التفاعلية: فهي تحتاج إلى WebGL2 ولا يتوفر هنا. لا شيء آخر في هذه الشاشة يعتمد عليها.',
  'map.engine.stalled.title': 'لم تُرسم الخريطة بعد',
  'map.engine.stalled.body':
    'لم يظهر شيء خلال المهلة الممنوحة للخريطة كي تبدأ. قد تعود للعمل من تلقاء نفسها؛ ولا شيء آخر في هذه الشاشة يعتمد عليها.',

  'map.coverage.partial.title': 'تفاصيل شوارع جزئية',
  'map.coverage.partial.body': {
    zero: 'لا تقصر بيانات الخريطة المنشورة عن أي مكان في هذه الرحلة.',
    one: 'تتوقف بيانات الخريطة المنشورة قبل مكان واحد من أماكن هذه الرحلة. وهو مرسوم في موضعه الحقيقي على سواحلنا الخاصة.',
    two: 'تتوقف بيانات الخريطة المنشورة قبل مكانين من أماكن هذه الرحلة. وهما مرسومان في موضعيهما الحقيقيين على سواحلنا الخاصة.',
    few: 'تتوقف بيانات الخريطة المنشورة قبل {outside} أماكن من هذه الرحلة. وهي مرسومة في مواضعها الحقيقية على سواحلنا الخاصة.',
    many: 'تتوقف بيانات الخريطة المنشورة قبل {outside} مكانًا من أماكن هذه الرحلة. وهي مرسومة في مواضعها الحقيقية على سواحلنا الخاصة.',
    other:
      'تتوقف بيانات الخريطة المنشورة قبل {outside} مكان من أماكن هذه الرحلة. وهي مرسومة في مواضعها الحقيقية على سواحلنا الخاصة.',
  },
  'map.coverage.none.title': 'لا تفاصيل شوارع هنا',
  'map.coverage.none.body':
    'لم تُنشر الشوارع لهذه المنطقة بعد. السواحل والدبابيس والمسارات بينها كلها حقيقية — لا ينقص سوى المباني والطرق.',
  'map.coverage.dismiss': 'إخفاء ملاحظة تغطية الخريطة',

  'map.legend.title': 'مفتاح الخريطة',
  'map.legend.collapse': 'طي {title}',
  'map.legend.expand': 'توسيع {title}',
  'map.legend.dayPin': 'مثال على دبوس يوم',
  'map.legend.dayPinMeaning': 'يوم في خط الرحلة',
  'map.legend.clusterPin': 'مثال على دبوس مجمّع',
  'map.legend.clusterPinMeaning': 'أماكن مجمّعة',

  'map.filter.label': 'تصفية الأماكن حسب الفئة',
  'map.filter.all': 'الكل',
  'map.filter.category': {
    zero: '{name} · لا أماكن',
    one: '{name} · مكان واحد',
    two: '{name} · مكانان',
    few: '{name} · {places} أماكن',
    many: '{name} · {places} مكانًا',
    other: '{name} · {places} مكان',
  },

  'map.pin.day': 'اليوم {day}',
  'map.pin.cluster': {
    zero: 'لا أماكن هنا',
    one: 'مكان واحد — قرِّب لعرضه على حدة',
    two: 'مكانان — قرِّب للفصل بينهما',
    few: '{places} أماكن — قرِّب للفصل بينها',
    many: '{places} مكانًا — قرِّب للفصل بينها',
    other: '{places} مكان — قرِّب للفصل بينها',
  },

  'map.place.rating': 'التقييم {rating} من {max}',
  'map.place.clause.day': 'اليوم {day}',
  'map.place.clause.rating': 'التقييم {rating} من {max}',
  'map.place.clause.visited': 'تمت زيارته',
  'map.place.clause.separator': '، ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'آخر زيارة',
  'legend.recent': {
    zero: 'خلال أقل من عام',
    one: 'خلال العام الأخير',
    two: 'خلال العامين الأخيرين',
    few: 'خلال آخر {years} أعوام',
    many: 'خلال آخر {years} عامًا',
    other: 'خلال آخر {years} عام',
  },
  'legend.middle': 'قبل ما بين {from} و{to} أعوام، أو بلا تاريخ',
  'legend.distant': {
    zero: 'قبل أقل من عام',
    one: 'قبل أكثر من عام',
    two: 'قبل أكثر من عامين',
    few: 'قبل أكثر من {years} أعوام',
    many: 'قبل أكثر من {years} عامًا',
    other: 'قبل أكثر من {years} عام',
  },
  'legend.unvisited': 'لم تُزر بعد',
  'legend.note':
    'يعبّر التدرّج عن حداثة الزيارة فقط — وتبيّن لسان «الدولة» كل تاريخ كاملًا.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'تغطية العالم',
  'panel.coverage.unit': 'من {total}',
  'panel.coverage.caption': '{share} من العالم · {visits}',
  'panel.progress.label': 'نحو كل دولة',
  'panel.progress.remaining': 'بقيت {remaining}',
  'panel.toggle.hide': 'إخفاء تفاصيل الأطلس',
  'panel.toggle.show': 'عرض تفاصيل الأطلس',
  'panel.tabs.label': 'أقسام الأطلس',
  'panel.tab.country': 'الدولة',
  'panel.tab.stats': 'الإحصاءات',
  'panel.tab.bucket': 'قائمة الأمنيات',
  'panel.back': 'كل الدول',
  'panel.list.label': 'الدول المُزارة',
  'panel.loading': 'جارٍ تحميل أطلسك',

  'panel.empty.blank.title': 'خريطتك ما زالت فارغة',
  'panel.empty.blank.body':
    'سجِّل زيارة دولة وستتلوّن هنا على الخريطة، مع أول زيارة وآخرها، وعدد المرات التي ذهبت فيها، وكل ما كتبته عنها.',
  'panel.empty.pick.title': 'اختر دولة',
  'panel.empty.pick.body':
    'اختر واحدة على الخريطة أو في حقل البحث أو من القائمة، وسيُفتح سجلها الكامل هنا — أول زيارة وآخر زيارة والعدّاد وملاحظتك.',

  'panel.stat.places': 'أماكنك',
  'panel.stat.placesNone': 'لم يُثبَّت شيء في رحلة بعد',
  'panel.stat.placesCaption': 'معالم وإقامات ومحطات محفوظة',
  'panel.stat.regions': 'مناطقك',
  'panel.stat.regionsNone': 'لم تُسجَّل مناطق بعد',
  'panel.stat.regionsCaption': 'ولايات ومقاطعات ومحافظات',
  'panel.stat.visits': 'زياراتك',
  'panel.stat.visitsCaption': 'كل وصول مسجَّل',
  'panel.stat.trips': 'رحلاتك',
  'panel.stat.tripsCaption': 'كل رحلة تشارك فيها',
  'panel.stat.cities': 'مدنك',
  'panel.stat.citiesCaption': 'مدن بتَّ أو توقفت فيها',
  'panel.stat.days': 'أيام سفرك',
  'panel.stat.daysCaption': 'عبر كل رحلة في سجلك',
  'panel.continents.label': 'الدول حسب القارة',

  'panel.bucket.empty.title': 'لا شيء في القائمة',
  'panel.bucket.empty.body':
    'مكان طالما نويت الذهاب إليه. أضفه، ثم اشطبه حين تصل.',
  'panel.bucket.label': 'قائمة الأمنيات',
  'panel.bucket.progress': 'أُنجز {done} من {total}',
  'panel.bucket.done': 'تحقق',
  'panel.bucket.toGo': 'متبقٍ',
  'panel.bucket.target': 'بحلول {year}',
  'panel.bucket.hidden': {
    zero: 'لا مدخلات أخرى في قائمتك.',
    one: 'مدخل آخر واحد في قائمتك، غير معروض هنا.',
    two: 'مدخلان آخران في قائمتك، غير معروضين هنا.',
    few: '{entries} مدخلات أخرى في قائمتك، غير معروضة هنا.',
    many: '{entries} مدخلًا آخر في قائمتك، غير معروضة هنا.',
    other: '{entries} مدخل آخر في قائمتك، غير معروضة هنا.',
  },
  'panel.bucket.kind.country': 'دولة',
  'panel.bucket.kind.region': 'منطقة',
  'panel.bucket.kind.place': 'مكان',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'أفريقيا',
  'continent.antarctica': 'القارة القطبية الجنوبية',
  'continent.asia': 'آسيا',
  'continent.europe': 'أوروبا',
  'continent.northAmerica': 'أمريكا الشمالية',
  'continent.oceania': 'أوقيانوسيا',
  'continent.southAmerica': 'أمريكا الجنوبية',
  'continent.unknown': 'القارة غير مسجَّلة',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'تمت الزيارة',
  'record.firstVisit': 'أول زيارة',
  'record.lastVisit': 'آخر زيارة',
  'record.visitDates': 'تواريخ الزيارات',
  'record.notRecorded': 'غير مسجَّل',
  'record.datesUnrecorded': 'التواريخ غير مسجَّلة',
  'record.visits': {
    zero: 'لا زيارات',
    one: 'زيارة واحدة',
    two: 'زيارتان',
    few: '{visits} زيارات',
    many: '{visits} زيارة',
    other: '{visits} زيارة',
  },
  'record.span': 'من {from} إلى {to}',
  'record.spanFrom': 'أول زيارة {from}',
  'record.spanTo': 'آخر زيارة {to}',
  'record.visitsUnit': {
    zero: 'زيارات',
    one: 'زيارة',
    two: 'زيارتان',
    few: 'زيارات',
    many: 'زيارة',
    other: 'زيارة',
  },
  'record.gap.days': {
    zero: 'بفارق أقل من يوم',
    one: 'بفارق يوم واحد',
    two: 'بفارق يومين',
    few: 'بفارق {gap} أيام',
    many: 'بفارق {gap} يومًا',
    other: 'بفارق {gap} يوم',
  },
  'record.gap.months': {
    zero: 'بفارق أقل من شهر',
    one: 'بفارق شهر واحد',
    two: 'بفارق شهرين',
    few: 'بفارق {gap} أشهر',
    many: 'بفارق {gap} شهرًا',
    other: 'بفارق {gap} شهر',
  },
  'record.gap.years': {
    zero: 'بفارق أقل من عام',
    one: 'بفارق عام واحد',
    two: 'بفارق عامين',
    few: 'بفارق {gap} أعوام',
    many: 'بفارق {gap} عامًا',
    other: 'بفارق {gap} عام',
  },
  'record.note.empty': 'لا ملاحظة بعد',
  'record.noOutline':
    'حدود العالم التي ترسمها هذه الخريطة مقصوصة بمقياس ‎1:110m‎، وهو يطوي هذا الإقليم داخل دولته الأم — فلا يوجد ما يُؤطَّر على الخريطة. الزيارة محسوبة على أي حال.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'ترتيب الدول',
  'list.sort.code': 'رمز الدولة',
  'list.sort.codeStatement': 'مرتَّبة حسب رمز الدولة، من A إلى Z.',
  'list.sort.name': 'اسم الدولة',
  'list.sort.nameStatement':
    'مرتَّبة حسب اسم الدولة، من A إلى Z، ثم حسب رمز الدولة.',
  'list.sort.recent': 'أحدث زيارة',
  'list.sort.recentStatement': 'الأحدث زيارةً أولًا، ثم حسب رمز الدولة.',
  'list.sort.visits': 'الأكثر زيارات',
  'list.sort.visitsStatement': 'الأكثر زياراتٍ أولًا، ثم حسب رمز الدولة.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'تطويها حدود العالم داخل دولتها الأم، فلا يوجد ما يُؤطَّر على الخريطة.',
  'list.announce.selected': 'اختيرت {name}.',
  'list.announce.selectedUnframed': 'اختيرت {name}. {reason}',
  'list.empty.title': 'لا دول على الخريطة بعد',
  'list.empty.body':
    'تظهر الدولة هنا لحظة تسجيل زيارة لها، مع أول وصول وآخره وعدد المرات التي ذهبت فيها.',
  'list.loading': 'جارٍ تحميل الدول المُزارة',
  'list.error.title': 'لم تُحمَّل دولك',
  'list.error.body':
    'تعذّر على الأطلس قراءة الدول التي زرتها الآن. لم يُفقد شيء — فهي ما زالت مسجَّلة.',
  'list.error.retry': 'حاول مجددًا',
  'list.error.retrying': 'جارٍ تحميل دولك',

  /* ------------------------------------------------------------- the search */
  'search.label': 'ابحث عن دولة',
  'search.loading': 'جارٍ تحميل دولك',
  'search.placeholder': 'اسم الدولة أو رمزها',
  'search.entry.notVisited': 'لم تُزر بعد',
  'search.entry.noOutline': 'بلا حدود على الخريطة',
  'search.entry.separator': ' · ',
  'search.cleared': 'أُلغي الاختيار.',
  'search.unframed':
    'لا حدود لـ{name} على مقياس العالم، فليس لدى الخريطة ما تؤطّره.',
  'search.unframedVisited':
    'لا حدود لـ{name} على مقياس العالم، فليس لدى الخريطة ما تؤطّره. سجلها لم يتأثر.',
  'search.results.empty': 'لا دول في سجلك بعد. اكتب للبحث في كل دول العالم.',
  'search.results.emptyPinned':
    '{name} مختارة. لا دول في سجلك بعد — اكتب للبحث في كل دول العالم.',
  'search.results.record': {
    zero: 'لا دول في سجلك.',
    one: 'دولة واحدة في سجلك.',
    two: 'دولتان في سجلك.',
    few: '{countries} دول في سجلك.',
    many: '{countries} دولة في سجلك.',
    other: '{countries} دولة في سجلك.',
  },
  'search.results.capped': 'تُعرض أول {shown}.',
  'search.results.pinned': '{name} مختارة ومعروضة أولًا.',
  'search.results.none': 'لا دولة تطابق {term}.',
  'search.results.matches': {
    zero: 'لا دولة تطابق {term}.',
    one: 'دولة واحدة تطابق {term}.',
    two: 'دولتان تطابقان {term}.',
    few: '{countries} دول تطابق {term}.',
    many: '{countries} دولة تطابق {term}.',
    other: '{countries} دولة تطابق {term}.',
  },
  'search.announce.selected': 'اختيرت {name}.',
  'search.announce.framing': 'اختيرت {name}. الخريطة تؤطّرها الآن.',
  'search.announce.unframed': 'اختيرت {name}. {reason}',
  'search.empty.title': 'لا شيء في سجلك بعد',
  'search.empty.body':
    'اكتب اسم دولة، أو رمزها المكوَّن من حرفين، لتجدها على الخريطة.',
  'search.empty.noMatchTitle': 'لا دولة تطابق «{term}»',
  'search.empty.noMatchBody':
    'تحقق من الكتابة، أو جرّب الرمز المكوَّن من حرفين — PT يجد البرتغال. كل الدول الـ{countries} قابلة للبحث، سواء زرتها أم لا.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'سجلك',
  'actions.visit.absent.title': 'لم تُزر',
  'actions.visit.absent.caption': 'زيارة لا تقف خلفها رحلة.',
  'actions.visit.title': 'تمت زيارتها',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'ليست في القائمة',
  'actions.goal.absent.caption': 'مكان تنوي الذهاب إليه.',
  'actions.goal.title': 'في قائمة الأمنيات',
  'actions.goal.waiting': 'تنتظر دورها.',
  'actions.goal.target': 'الهدف {year}.',
  'actions.goal.achieved.title': 'شُطبت من القائمة',
  'actions.goal.achieved.caption': 'وصلت إلى هناك. يبقى المدخل شاهدًا على ذلك.',

  'actions.button.remove': 'إزالة',
  'actions.button.mark': 'تسجيل زيارة',
  'actions.button.add': 'أضف إلى القائمة',
  'actions.visit.remove.name': 'إزالة {name} من أطلسك',
  'actions.visit.remove.busy': 'تجري إزالة {name} من أطلسك',
  'actions.visit.add.name': 'تسجيل زيارة، {name}',
  'actions.visit.add.busy': 'يجري تسجيل زيارة {name}',
  'actions.goal.remove.name': 'إزالة {name} من قائمة أمنياتك',
  'actions.goal.remove.busy': 'تجري إزالة {name} من قائمة أمنياتك',
  'actions.goal.add.name': 'أضف إلى القائمة، {name}',
  'actions.goal.add.busy': 'تجري إضافة {name} إلى قائمة أمنياتك',

  'actions.hint': 'كلاهما يسري فورًا، وكلاهما يمكن التراجع عنه هنا.',
  'actions.offline':
    'تعذّر على جهازك الوصول إلى الخادم. تحقق من الاتصال وحاول مجددًا.',
  'actions.toast.marked': 'سُجِّلت الزيارة',
  'actions.toast.markedBody': '{name} الآن في أطلسك.',
  'actions.toast.markFailed': 'لم تُسجَّل زيارة {name}',
  'actions.toast.unmarked': 'أُزيلت من أطلسك',
  'actions.toast.unmarkedBody': 'لم تعد {name} مسجَّلة كدولة مُزارة.',
  'actions.toast.unmarkFailed': 'لم تُزَل {name}',
  'actions.toast.listed': 'أُضيفت إلى قائمة أمنياتك',
  'actions.toast.listedBody': '{name} مكان تنوي الذهاب إليه.',
  'actions.toast.listFailed': 'لم تُضف {name}',
  'actions.toast.unlisted': 'أُزيلت من قائمة أمنياتك',
  'actions.toast.unlistedBody': 'لم تعد {name} في القائمة.',
  'actions.toast.unlistFailed': 'لم تُزَل {name}',
  'actions.toast.fallback': 'لم يصل التغيير إلى الخادم. حاول مجددًا بعد قليل.',

  'actions.confirm.visit.title': 'إزالة {name} من أطلسك؟',
  'actions.confirm.visit.body': {
    zero: 'لا زيارات مسجَّلة{dates} ستُمسح{note}. رحلاتك وأماكنك المحفوظة لن تُمسّ.',
    one: 'ستُمسح زيارة مسجَّلة واحدة{dates}{note}. رحلاتك وأماكنك المحفوظة لن تُمسّ.',
    two: 'ستُمسح زيارتان مسجَّلتان{dates}{note}. رحلاتك وأماكنك المحفوظة لن تُمسّ.',
    few: 'ستُمسح {visits} زيارات مسجَّلة{dates}{note}. رحلاتك وأماكنك المحفوظة لن تُمسّ.',
    many: 'ستُمسح {visits} زيارة مسجَّلة{dates}{note}. رحلاتك وأماكنك المحفوظة لن تُمسّ.',
    other:
      'ستُمسح {visits} زيارة مسجَّلة{dates}{note}. رحلاتك وأماكنك المحفوظة لن تُمسّ.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': '، ومعها الملاحظة التي كتبتها',
  'actions.confirm.goal.title': 'إزالة {name} من قائمة أمنياتك؟',
  'actions.confirm.goal.body':
    'قد شُطبت من القائمة بالفعل، لذا يُزال معها أيضًا سجل وصولك إلى هناك. أطلسك ورحلاتك لن يُمسّا.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    zero: 'رحلات مساحة العمل',
    one: 'رحلة مساحة العمل',
    two: 'رحلتا مساحة العمل',
    few: 'رحلات مساحة العمل',
    many: 'رحلة مساحة العمل',
    other: 'رحلة مساحة العمل',
  },
  'card.visits': {
    zero: 'زيارات',
    one: 'زيارة',
    two: 'زيارتان',
    few: 'زيارات',
    many: 'زيارة',
    other: 'زيارة',
  },
  'card.places': {
    zero: 'أماكن مساحة العمل',
    one: 'مكان مساحة العمل',
    two: 'مكانا مساحة العمل',
    few: 'أماكن مساحة العمل',
    many: 'مكان مساحة العمل',
    other: 'مكان مساحة العمل',
  },
  'card.firstTrip': 'أول رحلة',
  'card.lastTrip': 'آخر رحلة',
  'card.firstVisit': 'أول زيارة',
  'card.lastVisit': 'آخر زيارة',
  'card.absent': 'غير مسجَّل',
  'card.loading': 'جارٍ تحميل هذه الدولة',
  'card.loadingNamed': 'جارٍ تحميل {name}',
  'card.error.body': 'لم تُحمَّل هذه الأرقام. لم يُفقد شيء.',
  'card.error.retry': 'حاول مجددًا',
  'overlay.close': 'إغلاق {name}',
  'regions.label': 'المناطق',
  'regions.hint': 'تؤدي إضافة منطقة أيضًا إلى تحديد {country} كبلد تمت زيارته.',
  'regions.keeps': 'لا تؤدي إزالة منطقة إلى إزالة {country} من أطلسك.',
  'regions.keeps.unvisited':
    'تبقى هذه المناطق في سجلك. حدد {country} كبلد تمت زيارته أو أضف منطقة لإعادته إلى خريطتك.',
  'regions.empty.title': 'لم تُسجل مناطق هنا بعد',
  'regions.empty.body': 'أضف ولاية أو مقاطعة أو منطقة زرتها في {country}.',
  'regions.input.label': 'إضافة منطقة في {country}',
  'regions.input.placeholder': 'على سبيل المثال، بافاريا',
  'regions.add': 'إضافة منطقة',
  'regions.adding': 'جارٍ إضافة {region}',
  'regions.remove': 'إزالة {region}',
  'regions.loading': 'جارٍ تحميل مناطقك',
  'regions.status.added': 'تمت إضافة {region}',
  'regions.status.exists': '{region} مسجلة بالفعل',
  'regions.status.removed': 'تمت إزالة {region}',
  'regions.status.addedCountry':
    'تمت إضافة {region}. تم الآن تحديد {country} كبلد تمت زيارته.',
  'regions.error.invalid': 'أدخل اسم المنطقة.',
  'regions.error.hidden':
    'يحتوي الاسم على أحرف غير مسموح بها. أزلها وحاول مجددًا.',
  'regions.error.load': 'تعذر تحميل مناطقك في {country}.',
  'regions.error.add': 'تعذرت إضافة {region}. حاول مجددًا.',
  'regions.error.remove': 'تعذرت إزالة {region}. حاول مجددًا.',
  'regions.error.full': 'سجلت {limit} منطقة. أزل واحدة لإضافة أخرى.',
  'regions.reload': 'إعادة تحميل المناطق',
  'actions.confirm.visitRegions.body': {
    zero: '{history}تبقى المناطق التي سجلتها في {country} في سجلك: {count}.',
    one: '{history}تبقى المناطق التي سجلتها في {country} في سجلك: {count}.',
    two: '{history}تبقى المناطق التي سجلتها في {country} في سجلك: {count}.',
    few: '{history}تبقى المناطق التي سجلتها في {country} في سجلك: {count}.',
    many: '{history}تبقى المناطق التي سجلتها في {country} في سجلك: {count}.',
    other: '{history}تبقى المناطق التي سجلتها في {country} في سجلك: {count}.',
  },
  'regions.error.uncertain':
    'تعذر تأكيد التغيير. أعد تحميل مناطقك للتحقق مما تم حفظه.',
  'regions.status.refreshFailed':
    '{result} تعذر تحديث الأطلس. أعد تحميله لتحديث الخريطة.',

  'panel.stat.periodLabel': 'عرض الأرقام للفترة',
  'panel.stat.allTime': 'كل الأوقات',
  'panel.stat.groupAll': 'أرقام كل الأوقات',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'أرقام عام {year}',
  'panel.stat.announceAll': 'تُعرض أرقام كل الأوقات.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'تُعرض أرقام عام {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'رحلات تبدأ في عام {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'في رحلات تبدأ في عام {year}',
  'panel.stat.countries': 'البلدان في رحلاتك',
  'panel.stat.countriesCaption': 'بلدان مختلفة ضمن هذه الرحلات',
  'panel.stat.streak': 'سنوات سفرك المتتالية',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'رحلات كل عام، من {first} إلى {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'رحلة في عام {last}',
  'panel.stat.streakNone': 'أضف رحلة بتواريخ لبدء سلسلة',
} satisfies TranslationOf<typeof En>

export default messages
