/**
 * The costs tab's copy, in ar.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **الجمع.** `zero` · `one` · `two` · `few` · `many` · `other` — ستة فروع
 * كما تقتضي قواعد CLDR للعربية.
 *
 * **الاتجاه.** العربية تُكتب من اليمين إلى اليسار: التنسيق يستخدم الخصائص
 * المنطقية فقط، والأيقونات الاتجاهية تُعكس.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'أنت',
  'person.youTarget': 'إليك',
  'person.removed': 'مسافر مُزال',
  'person.removedTarget': 'مسافر مُزال',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'أتحذف هذا المصروف؟',
  'delete.description': '«{title}» وتقسيمه يخرجان من الحساب. ولا رجعة في ذلك.',
  'delete.failed': 'لم يُحذف',
  'delete.failedBody': 'لم نتمكن من حذف المصروف. أعِد المحاولة بعد لحظة.',
  'delete.noBalances': 'لا يتغير أي رصيد - لم يكن مقسومًا على أحد.',
  'delete.balancesChange': 'تتغير أرصدة {names}.',
  'delete.confirm': 'احذف المصروف',
  'delete.working': 'يجري حذف المصروف',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'المصاريف',
  'toolbar.shownOf': '{shown} من {total}',
  'toolbar.searchPlaceholder': 'ابحث في المصاريف والملاحظات والدافعين…',
  'toolbar.searchLabel': 'ابحث في المصاريف',
  'toolbar.allCategories': 'كل الفئات',
  'toolbar.allDays': 'كل الأيام',
  'toolbar.filterCategory': 'التصفية حسب الفئة',
  'toolbar.filterDay': 'التصفية حسب اليوم',
  'toolbar.whose': 'مصاريف مَن',
  'toolbar.paidByMe': 'دفعتُها أنا',
  'toolbar.owedToMe': 'لي عند غيري',
  'toolbar.logged': {
    zero: '{value} مسجَّل',
    one: 'واحد مسجَّل',
    two: 'اثنان مسجَّلان',
    few: '{value} مسجَّلة',
    many: '{value} مسجَّلًا',
    other: '{value} مسجَّل',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'التقسيم بين المسافرين',
  'split.label': 'التقسيم بين',
  'split.everyone': 'الجميع',
  'split.nobody': 'لا أحد',
  'split.departed': 'غادر الرحلة',
  'split.departedHint': 'إلغاء تحديد شخص غادر الرحلة يزيل حصته نهائيًا.',
  'split.includeFor': 'تضمين {name} في هذا التقسيم',
  'split.how': 'كيف يُقسَّم هذا المصروف',
  'split.method.equal': 'بالتساوي',
  'split.method.equalHint':
    'كل من شُمِل يدفع المبلغ نفسه، والوحدة الصغرى الزائدة تذهب إلى أول شخص في القائمة.',
  'split.method.exact': 'بالمبلغ',
  'split.method.exactHint':
    'اكتب ما يستحقه كل شخص فعلًا. ومجموع المبالغ يجب أن يساوي الإجمالي.',
  'split.method.shares': 'أنصبة',
  'split.method.sharesHint':
    'رجِّح التقسيم: نصيبان للثنائي، ونصيب واحد لغيرهما.',
  'split.method.percentage': 'نسبة',
  'split.method.percentageHint':
    'التقسيم بالنسبة المئوية. ومجموع النسب يجب أن يساوي 100.',
  'split.exactFor': 'المبلغ الدقيق لـ {name}',
  'split.percentFor': 'النسبة لـ {name}',
  'split.sharesFor': 'أنصبة {name}',
  'split.balanced': 'متوازن',
  'split.allocated': 'وُزِّع {allocated} من {total}',
  'split.over': '{amount} زائدة',
  'split.left': 'بقي {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'المبلغ',
  'field.currency': 'العملة',
  'field.date': 'التاريخ',
  'field.paidBy': 'دفعها',
  'expense.editTitle': 'تعديل هذا المصروف',
  'expense.addTitle': 'إضافة مصروف',
  'expense.editDescription': 'تغيير المبلغ يعيد تقسيمه بين كل من شُمِل أدناه.',
  'expense.addDescription':
    'مبالغ هذه الرحلة تُحفَظ بعملة {currency}. سجِّل الإيصال بعملته، واكتب ما صار إليه بعد التحويل.',
  'expense.saveFailed': 'لم يُحفظ',
  'expense.what': 'لأي شيء كان',
  'expense.whatPlaceholder': 'عشاء في Kyubey',
  'expense.amountNotANumber': 'اكتب المبلغ رقمًا.',
  'expense.convertedTo': 'محوَّل إلى {currency}',
  'expense.convertedHint': 'ما صار إليه {from} بعملة {to} في كشف حسابك.',
  'expense.convertedSuggested':
    'مقترح من السعر المستخدم في هذه الرحلة بتاريخ {date} ({rate}). عدّله ليطابق كشف حسابك.',
  'expense.convertedNotANumber': 'اكتب المبلغ المحوَّل رقمًا.',
  'expense.paidByHint':
    'اتركه بلا دافع إن كنت تسجّل إيصالًا لم يتكفّل به أحد بعد.',
  'expense.nobodyYet': 'لا أحد بعد',
  'expense.notesHint': 'اختياري. كل ما لا يقوله الإيصال.',
  'expense.notesPlaceholder':
    'تقاسمنا قائمة التذوّق، والمشروبات على حساب كل واحد.',
  'expense.noAmount': 'بلا مبلغ بعد',
  'expense.saving': 'يجري حفظ المصروف',
  'expense.saveChanges': 'احفظ التغييرات',
  'expense.add': 'أضف المصروف',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'تسجيل دفعة',
  'payment.description':
    'تسجيل التحويل يرفعه من الرصيدين معًا. وهو لا ينقل أي مال - planned.travel يحفظ الحساب، وبنكك ينقل النقد.',
  'payment.youSuffix': '{name} (أنت)',
  'payment.pays': '{from} يدفع لـ {to}',
  'payment.pickTwo': 'اختر شخصين مختلفين.',
  'payment.paidTo': 'دُفعت إلى',
  'payment.needsTwo': 'الدفعة تحتاج شخصين مختلفين.',
  'payment.amountIn': 'المبلغ بعملة {currency}',
  'payment.amountPositive': 'اكتب مبلغًا أكبر من صفر.',
  'payment.how': 'كيف',
  'payment.note': 'ملاحظة',
  'payment.noteHint': 'اختياري. مرجع، أو ما غطّته.',
  'payment.notePlaceholder': 'تغطي فندق كيوتو وتذاكر JR.',
  'payment.recording': 'يجري تسجيل الدفعة',
  'payment.confirm': 'سجِّل الدفعة',
  'payment.failed': 'لم نتمكن من تسجيل الدفعة. أعِد المحاولة بعد لحظة.',
  'payment.method.bankTransfer': 'تحويل بنكي',
  'payment.method.cash': 'نقدًا',
  'payment.method.card': 'بطاقة',
  'payment.method.app': 'تطبيق دفع',
  'payment.method.other': 'شيء آخر',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'التسوية',
  'settle.addPayment': 'إضافة دفعة',
  'settle.action': 'تسوية',
  'settle.empty.title': 'الحسابات متوازنة',
  'settle.empty.body':
    'لا حاجة إلى أي تحويل. أضف مصروفًا وسيظهر أي اختلال هنا.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'الأرصدة',
  'balances.count': {
    zero: '{travellers} مسافر',
    one: '{travellers} مسافر',
    two: '{travellers} مسافران',
    few: '{travellers} مسافرين',
    many: '{travellers} مسافرًا',
    other: '{travellers} مسافر',
  },
  'balances.empty': 'تظهر الأرصدة عندما يكون للمصروف دافع وتقسيم.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'حسب الفئة',
  'categories.againstBudget': 'مقابل ميزانية الرحلة',
  'categories.progressLabel': 'المصروف مقابل ميزانية الرحلة',
  'categories.empty':
    'تتفصّل بنود الميزانية والمصروفات هنا عندما يكون هناك ما يُفصّل.',
  'categories.legendLabel': 'الإنفاق حسب الفئة',
  'categories.planned': '{amount} مخطط',
  'categories.nothingSpent': 'لم يُنفق شيء بعد. هذا ما خططت له.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'أقل من {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'على مَن أُنفق المال',
  'memberBar.others': {
    zero: '{others} مسافر آخر',
    one: '{others} مسافر آخر',
    two: '{others} مسافران آخران',
    few: '{others} مسافرين آخرين',
    many: '{others} مسافرًا آخر',
    other: '{others} مسافر آخر',
  },
  'memberBar.notSplit': 'غير مخصّص لأي شخص',
  'totalTile.label': 'إجمالي إنفاق الرحلة',
  'totalTile.captionPlanned': 'المخطَّط {amount} لجميع المسافرين',
  'totalTile.captionBudget': 'ميزانية الرحلة {amount}',
  'totalTile.yourShare': 'حصتك',
  'totalTile.youPaid': 'دفعت',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'الدفعات المسجّلة',
  'payments.empty.title': 'لا دفعات بعد',
  'payments.empty.body': 'عندما يسدّد أحدهم رصيدًا، يُسجّل التحويل هنا.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived': 'هذه الرحلة مؤرشفة. استعدها قبل تغيير التكاليف.',
  'readOnly.title': 'يمكنك الاطّلاع على التكاليف لكن لا يمكنك تغييرها',
  'readOnly.body':
    'وحدهم مالكو الرحلة ومن يملكون صلاحية التحرير يمكنهم إضافة النفقات أو تعديلها أو حذفها وتسجيل الدفعات. اطلب من أحد المالكين إذا احتاج شيء إلى تغيير.',
  'readOnly.empty':
    'لم تُسجَّل أي نفقات في هذه الرحلة بعد. ستظهر هنا بمجرد أن يضيفها مالك أو محرّر.',
  'readOnly.settleEmpty':
    'لا حاجة إلى أي تحويلات الآن. أي فرق في الحسابات سيظهر هنا.',
  'refusal.rebaseChanged':
    'تغيّرت الرحلة أثناء التأكيد، لذا لم يتغيّر شيء. راجع الأرقام الجديدة ثم أكّد من جديد.',
  'refusal.tripCurrencyChanged':
    'أصبحت عملة ميزانية هذه الرحلة الآن {to}، لذا لم يُحفظ ما أدخلته. تم تحديث الصفحة: راجع المبلغ ثم احفظ من جديد.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'عملة العرض',
  'display.indicator.perTrip': 'عملته الخاصة',
  'display.indicator.fixed': 'وأيضًا بـ{code}',
  'display.menu.perTrip': 'كل رحلة بعملتها',
  'display.menu.workspace': '{code} (الافتراضية لمساحة العمل)',
  'display.menu.rateHint': 'يستخدم سعرًا سُجّل مسبقًا في رحلة',
  'display.menu.currentHint': 'محددة، لكن لا يغطيها أي سعر مسجّل',
  'display.menu.needsLiveRate': 'تحتاج إلى سعر مباشر غير متاح بعد',
  'display.menu.saving': 'جارٍ حفظ اختيارك',
  'display.error.title': 'لم تُحفظ عملة العرض',
  'display.error.body': 'تعذّر حفظ اختيارك. حاول مرة أخرى بعد قليل.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': 'نحو {amount} {code} بعملة العرض الخاصة بك',
  'display.row.notConverted': 'غير محوّل',
  'display.alert.title': 'بعض المبالغ غير محوّلة',
  'display.alert.body':
    'لا يوجد سعر مسجّل لهذه الأزواج من العملات، لذلك تبقى هذه المبالغ بعملة الميزانية:',
  'display.alert.pair': '{from} إلى {to} في {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'غيّر عملة الميزانية',
  'rebase.title': 'تغيير عملة الميزانية',
  'rebase.description':
    'تبقى المبالغ التي كتبتها كما كتبتها. أما إجماليات هذه الرحلة وأرصدتها فتُحوَّل إلى العملة الجديدة.',
  'rebase.to': 'العملة الجديدة',
  'rebase.toPlaceholder': 'اختر عملة',
  'rebase.rateLabel': 'سعر الصرف (1 {from} مقابل {to})',
  'rebase.rateInverse': 'أي أن \u20661 {to} = {inverse} {from}\u2069.',
  'rebase.rateInvalid': 'أدخل سعرًا أكبر من صفر.',
  'rebase.rateOutOfRange':
    'يبدو هذا السعر كبيرًا جدًا أو صغيرًا جدًا. تحقق من اتجاه التحويل.',
  'rebase.source.recent': 'آخر سعر استُخدم في مساحة العمل هذه',
  'rebase.source.manual': 'السعر الذي أدخلته',
  'rebase.noRate':
    'لا يوجد سعر مسجّل من {from} إلى {to}. أدخل السعر الذي تريد استخدامه.',
  'rebase.waitingForRate': 'تظهر المعاينة بمجرد توفر سعر.',
  'rebase.loading': 'جارٍ حساب التحويل',
  'rebase.example': 'يبقى {original} كما كتبته ويُحتسب على أنه {converted}.',
  'rebase.count.expenses': {
    zero: 'عدد المصروفات التي ستُحتسب بعملة {to}: {count}.',
    one: 'سيُحتسب مصروف واحد ({count}) بعملة {to}.',
    two: 'سيُحتسب مصروفان ({count}) بعملة {to}.',
    few: 'ستُحتسب {count} مصروفات بعملة {to}.',
    many: 'سيُحتسب {count} مصروفًا بعملة {to}.',
    other: 'سيُحتسب {count} مصروف بعملة {to}.',
  },
  'rebase.count.payments': {
    zero: 'عدد الدفعات التي ستُحتسب بعملة {to}: {count}.',
    one: 'ستُحتسب دفعة واحدة ({count}) بعملة {to}.',
    two: 'ستُحتسب دفعتان ({count}) بعملة {to}.',
    few: 'ستُحتسب {count} دفعات بعملة {to}.',
    many: 'ستُحتسب {count} دفعةً بعملة {to}.',
    other: 'ستُحتسب {count} دفعة بعملة {to}.',
  },
  'rebase.count.planned': {
    zero: 'عدد العناصر المخطَّطة التي ستُحتسب بعملة {to}: {count}.',
    one: 'سيُحتسب عنصر مخطَّط واحد ({count}) بعملة {to}.',
    two: 'سيُحتسب عنصران مخطَّطان ({count}) بعملة {to}.',
    few: 'ستُحتسب {count} عناصر مخطَّطة بعملة {to}.',
    many: 'سيُحتسب {count} عنصرًا مخطَّطًا بعملة {to}.',
    other: 'سيُحتسب {count} عنصر مخطَّط بعملة {to}.',
  },
  'rebase.pinned':
    'تبقى أسعار الأماكن والحجوزات والإقامات والتنقلات بعملة {from}.',
  'rebase.target': 'ميزانية الرحلة {before} تصبح {after}.',
  'rebase.rounding':
    'يُقرَّب كل مبلغ مرة واحدة، لذا قد يتغير الرصيد بما يصل إلى {amount}.',
  'rebase.leftover': 'بعد التغيير، سيدين {name} إلى {other} بمبلغ {amount}.',
  'rebase.someone': 'شخص ما',
  'rebase.nothing':
    'لا شيء في هذه الرحلة له سعر بعد، فلا حاجة إلى تحويل أي شيء.',
  'rebase.unconverted': {
    zero: 'عدد البنود بعملة غير {from} التي لا يمكن تحويلها تلقائيًا: {count}.',
    one: 'يوجد بند واحد ({count}) بعملة غير {from} ولا يمكن تحويله تلقائيًا. غالبًا ما يكون مصروفًا أُنشئ من حجز مسعَّر بعملة أخرى: عدّله أو احذفه ثم أعد المحاولة.',
    two: 'يوجد بندان ({count}) بعملة غير {from} ولا يمكن تحويلهما تلقائيًا. غالبًا ما يكونان مصروفين أُنشئا من حجوزات مسعَّرة بعملة أخرى: عدّلهما أو احذفهما ثم أعد المحاولة.',
    few: 'توجد {count} بنود بعملة غير {from} ولا يمكن تحويلها تلقائيًا. غالبًا ما تكون مصروفات أُنشئت من حجوزات مسعَّرة بعملة أخرى: عدّلها أو احذفها ثم أعد المحاولة.',
    many: 'يوجد {count} بندًا بعملة غير {from} ولا يمكن تحويلها تلقائيًا. غالبًا ما تكون مصروفات أُنشئت من حجوزات مسعَّرة بعملة أخرى: عدّلها أو احذفها ثم أعد المحاولة.',
    other:
      'يوجد {count} بند بعملة غير {from} ولا يمكن تحويلها تلقائيًا. غالبًا ما تكون مصروفات أُنشئت من حجوزات مسعَّرة بعملة أخرى: عدّلها أو احذفها ثم أعد المحاولة.',
  },
  'rebase.unsplittable': {
    zero: 'عدد المصروفات التي لا يمكن نقل تقسيمها: {count}.',
    one: 'تقسيم مصروف واحد ({count}) لا يمكن نقله لأن كل الحصص فيه صفر. عدّله أو احذفه ثم أعد المحاولة.',
    two: 'تقسيم مصروفين ({count}) لا يمكن نقله لأن كل الحصص فيهما صفر. عدّلهما أو احذفهما ثم أعد المحاولة.',
    few: 'تقسيم {count} مصروفات لا يمكن نقله لأن كل الحصص فيها صفر. عدّلها أو احذفها ثم أعد المحاولة.',
    many: 'تقسيم {count} مصروفًا لا يمكن نقله لأن كل الحصص فيها صفر. عدّلها أو احذفها ثم أعد المحاولة.',
    other:
      'تقسيم {count} مصروف لا يمكن نقله لأن كل الحصص فيها صفر. عدّلها أو احذفها ثم أعد المحاولة.',
  },
  'rebase.outOfRange':
    'بهذا السعر سيكون أحد المبالغ في الرحلة أكبر من أن يُحفظ بعملة {to}. تحقق من السعر واتجاه التحويل.',
  'rebase.tooLarge':
    'في هذه الرحلة بنود أكثر من أن تُغيَّر دفعة واحدة: يلزم {changes} تغييرًا في آن واحد، والحد الأقصى {limit}. تبقى الميزانية بعملة {from} حاليًا.',
  'rebase.copyPending': 'ما زال نسخ هذه الرحلة جاريًا. أعد المحاولة بعد لحظة.',
  'rebase.error': 'تعذّر تحميل التحويل. لم يتغيّر شيء.',
  'rebase.commitError': 'لم نتمكن من تغيير عملة الميزانية. لم يتغيّر شيء.',
  'rebase.stale':
    'عملة ميزانية الرحلة الآن {current} وليست {from}. أغلق هذه النافذة وافتحها من جديد.',
  'rebase.sameCurrency': 'الميزانية مُعدّة بالفعل بعملة {to}. اختر عملة أخرى.',
  'rebase.commitUnknown':
    'تعذّر التأكد من تغيير عملة الميزانية إلى {to}. أعد تحميل الصفحة للتحقق قبل المحاولة مجددًا.',
  'rebase.retry': 'أعد المحاولة',
  'rebase.confirm': 'التغيير إلى {to}',
  'rebase.committing': 'جارٍ تغيير عملة الميزانية',
  'rebase.done': 'أصبحت الميزانية الآن بعملة {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'لم يُنفق شيء بعد',
  'screen.summary': '{expenses} · أُنفق {spent}',
  'count.expenses': {
    zero: '{expenses} مصروف',
    one: '{expenses} مصروف',
    two: '{expenses} مصروفان',
    few: '{expenses} مصاريف',
    many: '{expenses} مصروفًا',
    other: '{expenses} مصروف',
  },
  'screen.exportCsv': 'تصدير CSV',
  'screen.addFirst': 'أضف أول مصروف',
  'screen.empty.title': 'لا مصاريف بعد',
  'screen.empty.body':
    'سجّل ما تنفقه أولًا بأول. يقسّمه planned.travel بين كل المسافرين ويحتفظ بالمجموع الجاري بعملة {currency}.',
  'screen.filtered.title': 'لا شيء يطابق هذه المرشحات',
  'screen.filtered.body':
    'وسّع البحث أو اختر يومًا آخر أو امسح المرشحات لترى الرحلة كاملة من جديد.',
  'export.empty.title': 'لا شيء للتصدير',
  'export.empty.body': 'لا مصاريف تطابق المرشحات المفعّلة.',
  'export.ready.title': 'التصدير جاهز',
  'export.ready.body': {
    zero: 'كُتب {expenses} مصروف في ملف CSV.',
    one: 'كُتب {expenses} مصروف في ملف CSV.',
    two: 'كُتب {expenses} مصروفان في ملف CSV.',
    few: 'كُتبت {expenses} مصاريف في ملف CSV.',
    many: 'كُتب {expenses} مصروفًا في ملف CSV.',
    other: 'كُتب {expenses} مصروف في ملف CSV.',
  },
  'list.daySpent': 'أُنفق {amount}',
  'skeleton.loading': 'جارٍ تحميل المصاريف',
  'row.noPayer': 'بلا دافع بعد',
  'row.youPaid': 'دفعتَ أنت',
  'row.paid': 'دفع {name}',
  'row.notYourShare': 'ليس من حصتك',
  'row.yourShare': '{amount} حصتك',
  'row.noteOn': 'ملاحظة على {title}',
  'row.edit': 'تعديل {title}',
  'row.delete': 'حذف {title}',
  'row.saving': 'جارٍ الحفظ',
  'tile.owe.label': 'عليك',
  'tile.owe.settled': 'لا شيء عليك',
  'tile.owe.pending': 'سدّد قبل أن تعود إلى بيتك',
  'tile.owe.to': 'إلى',
  'tile.owed.label': 'لك',
  'tile.owed.none': 'لا شيء مستحق لك',
  'tile.owed.pending': 'ما زال في الطريق إليك',
  'tile.owed.from': 'من',
  'tile.outstanding.label': 'غير المسدّد',
  'tile.outstanding.none': 'لكل مصروف دافع',
  'tile.outstanding.some': {
    zero: '{expenses} مصروف بلا دافع بعد',
    one: '{expenses} مصروف بلا دافع بعد',
    two: '{expenses} مصروفان بلا دافع بعد',
    few: '{expenses} مصاريف بلا دافع بعد',
    many: '{expenses} مصروفًا بلا دافع بعد',
    other: '{expenses} مصروف بلا دافع بعد',
  },
  'category.accommodation': 'الإقامة',
  'category.transport': 'التنقل',
  'category.food': 'الطعام والشراب',
  'category.activities': 'الأنشطة',
  'category.shopping': 'التسوق',
  'category.fees': 'الرسوم والأعباء',
  'category.insurance': 'التأمين',
  'category.other': 'أخرى',
  'toolbar.summary.everything': 'يعرض كل شيء',
  'toolbar.summary.filtered': 'مرشَّح: {filters}',
  'toolbar.summary.search': 'يطابق «{term}»',
  'write.added': 'أُضيف المصروف',
  'write.updated': 'حُدّث المصروف',
  'write.deleted': 'حُذف المصروف',
  'write.addFailed': 'لم يُضَف المصروف',
  'write.editFailed': 'لم يُحفظ المصروف',
  'write.deleteFailed': 'لم يُحذف المصروف',
  'write.paymentRecorded': 'سُجّلت الدفعة',
  'write.paymentRecordedBody': 'تحدّث الرصيدان كلاهما.',
  'write.paymentFailed': 'لم تُسجَّل الدفعة',
  'write.rolledBack': 'جرى التراجع عن التغيير.',
  'expense.saveFallback': 'تعذّر حفظ المصروف. حاول مجددًا بعد قليل.',
} satisfies TranslationOf<typeof En>

export default messages
