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
  'expense.currencyLabel': 'العملة التي كُتب بها هذا الإيصال',
  'expense.convertedTo': 'محوَّل إلى {currency}',
  'expense.convertedHint': 'ما صار إليه {from} بعملة {to} في كشف حسابك.',
  'expense.convertedNotANumber': 'اكتب المبلغ المحوَّل رقمًا.',
  'expense.dateLabel': 'تاريخ المصروف',
  'expense.paidByHint':
    'اتركه بلا دافع إن كنت تسجّل إيصالًا لم يتكفّل به أحد بعد.',
  'expense.nobodyYet': 'لا أحد بعد',
  'expense.whoPaid': 'من دفع',
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
  'payment.whoPaying': 'من يدفع',
  'payment.whoPaid': 'من يستلم',
  'payment.amountIn': 'المبلغ بعملة {currency}',
  'payment.amountPositive': 'اكتب مبلغًا أكبر من صفر.',
  'payment.how': 'كيف',
  'payment.howMade': 'كيف جرت الدفعة',
  'payment.dateLabel': 'تاريخ الدفعة',
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
  'totalTile.youPaid': 'دفعتَ',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'الدفعات المسجّلة',
  'payments.empty.title': 'لا دفعات بعد',
  'payments.empty.body': 'عندما يسدّد أحدهم رصيدًا، يُسجّل التحويل هنا.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'يمكنك الاطّلاع على التكاليف لكن لا يمكنك تغييرها',
  'readOnly.body':
    'وحدهم مالكو الرحلة ومن يملكون صلاحية التحرير يمكنهم إضافة النفقات أو تعديلها أو حذفها وتسجيل الدفعات. اطلب من أحد المالكين إذا احتاج شيء إلى تغيير.',
  'readOnly.empty':
    'لم تُسجَّل أي نفقات في هذه الرحلة بعد. ستظهر هنا بمجرد أن يضيفها مالك أو محرّر.',
  'readOnly.settleEmpty':
    'لا حاجة إلى أي تحويلات الآن. أي فرق في الحسابات سيظهر هنا.',
} satisfies TranslationOf<typeof En>

export default messages
