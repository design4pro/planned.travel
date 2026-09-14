/**
 * The trip tabs' own copy, in ar.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **الجمع.** ستة فروع كما تقتضي قواعد CLDR للعربية. **الاتجاه.** من اليمين إلى اليسار.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'تعذّر تحميل هذه الرحلة',
  'error.plan': 'تعذّر تحميل البرنامج',
  'error.costs': 'تعذّر تحميل النفقات',
  'error.collab': 'تعذّر تحميل المحادثة',
  'error.book': 'تعذّر تحميل الحجوزات',
  'error.transports': 'لم تُحمَّل التنقلات',
  'error.people': 'تعذّر تحميل الأشخاص',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'البرنامج',
  'plan.places': 'الأماكن',
  'plan.readOnly.role':
    'يمكنك قراءة هذه الخطة. لا يغيّرها إلا مالك الرحلة ومحرّروها.',
  'plan.day.empty': 'لا شيء مخطط بعد — اسحب مكانًا أو ملاحظة إلى هنا',
  'plan.move.refused.duplicate': '{name} موجود بالفعل في ذلك اليوم',
  'plan.move.refused.duplicateBody':
    'لا يمكن أن يظهر المكان أكثر من مرة في اليوم الواحد. انقله إلى يوم آخر بدلاً من ذلك.',
  'plan.move.refused.notInIdeas': 'الملاحظة تبقى داخل اليوم',
  'plan.move.refused.notInIdeasBody':
    'الأفكار أماكن تنتظر يومًا، أما الملاحظة فتخص اليوم الذي كُتبت له.',
  'plan.move.refused.notInAnotherDay': 'الملاحظة تبقى في يومها',
  'plan.move.refused.notInAnotherDayBody':
    'لا يمكن نقل الملاحظات بين الأيام بعد. عدّل الملاحظة أو اكتبها في اليوم الآخر.',
  'plan.move.refused.journeyNotInIdeas': 'الرحلة تبقى داخل اليوم',
  'plan.move.refused.journeyNotInIdeasBody':
    'الأفكار أماكن تنتظر يومًا، أما الرحلة فتخص اليوم الذي تحدث فيه.',
  'plan.move.refused.journeyNotInAnotherDay': 'الرحلة تبقى في يومها',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'يوم الرحلة يأتي من تواريخها. غيّرها في تبويب التنقلات.',
  'plan.move.refused.journeyTimed': '{name} تنطلق في {time}',
  'plan.move.refused.journeyTimedBody':
    'وقت المغادرة يخص الجدول الزمني لا الخطة. ضع الرحلة حيث تشير ساعتها.',
  'plan.move.spoken.duplicate': 'لم يُنقل {name}. ذلك اليوم يحتوي عليه بالفعل.',
  'plan.move.spoken.notInIdeas': 'لم يُنقل {name}. الملاحظة تبقى داخل اليوم.',
  'plan.move.spoken.notInAnotherDay':
    'لم يُنقل {name}. الملاحظة تبقى في يومها.',
  'plan.move.spoken.timed': '{name} يحمل الساعة {time}. نسأل هل نُسقطها.',
  'plan.move.spoken.journeyNotInIdeas':
    'لم تُنقل {name}. الرحلة تبقى داخل اليوم.',
  'plan.move.spoken.journeyNotInAnotherDay':
    'لم تُنقل {name}. الرحلة تبقى في يومها.',
  'plan.move.spoken.journeyTimed': 'لم تُنقل {name}. تنطلق في {time}.',
  'plan.move.error.save': 'لم يُحفظ هذا النقل',
  'plan.move.error.retry': 'حاول مرة أخرى بعد قليل.',
  'plan.move.dropTime.title': 'هل ننقل {name} ونُسقط الساعة {time}؟',
  'plan.move.dropTime.body':
    'هذا الموضع يتعارض مع الوقت المسجَّل عليه. نقله هنا يمسح الوقت، ويُحفظ الترتيب الجديد والوقت الممسوح معًا.',
  'plan.move.dropTime.confirm': 'انقل وأسقط الوقت',
  'plan.move.dropTime.cancel': 'اتركه في مكانه',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'إضافة ملاحظة',
  'plan.note.addForDay': 'إضافة ملاحظة، {day}',
  'plan.note.showMore': 'عرض المزيد',
  'plan.note.showLess': 'عرض أقل',
  'plan.note.moveUp': 'تحريك لأعلى',
  'plan.note.moveDown': 'تحريك لأسفل',
  'plan.note.drag': 'إعادة ترتيب الملاحظة',
  'plan.note.edit': 'تعديل الملاحظة',
  'plan.note.delete': 'حذف الملاحظة',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'إضافة ملاحظة',
  'plan.note.dialog.editTitle': 'تعديل الملاحظة',
  'plan.note.field.body': 'الملاحظة',
  'plan.note.field.bodyHint': 'سطر واحد. هذا ما يظهر في اليوم.',
  'plan.note.field.detail': 'التفاصيل',
  'plan.note.field.detailHint': 'عناوين وقوائم وروابط واقتباسات وشيفرة وجداول.',
  'plan.note.field.time': 'الوقت',
  'plan.note.field.timeHint': 'اختياري، بنظام 24 ساعة.',
  'plan.note.field.icon': 'الأيقونة',
  'plan.note.tab.write': 'كتابة',
  'plan.note.tab.preview': 'معاينة',
  'plan.note.previewEmpty': 'لا شيء للمعاينة بعد',
  'plan.note.save': 'حفظ الملاحظة',
  'plan.note.cancel': 'إلغاء',
  'plan.note.confirmDelete': 'حذف هذه الملاحظة؟',
  'plan.note.confirmDeleteBody': 'تُحذف الملاحظة وتفاصيلها من هذا اليوم.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'تمت إضافة الملاحظة',
  'plan.note.toast.updated': 'تم حفظ الملاحظة',
  'plan.note.toast.deleted': 'تم حذف الملاحظة',
  'plan.note.error.save': 'لم تُحفظ الملاحظة',
  'plan.note.error.delete': 'لم تُحذف الملاحظة',
  'plan.note.error.retry': 'حاول مرة أخرى بعد قليل.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'تذكير',
  'plan.note.icon.clock': 'الوقت',
  'plan.note.icon.flashlight': 'مصباح',
  'plan.note.icon.footprints': 'مشي',
  'plan.note.icon.info': 'معلومة',
  'plan.note.icon.luggage': 'أمتعة',
  'plan.note.icon.package': 'طرد',
  'plan.note.icon.ticket': 'تذاكر',
  'plan.note.icon.trainFront': 'قطار',
  'plan.note.icon.wifi': 'إنترنت',
  'plan.note.icon.stickyNote': 'ملاحظة',
  'plan.note.icon.utensils': 'طعام',
  'plan.note.icon.bus': 'تنقل',
  'plan.note.icon.bedDouble': 'إقامة',
  'plan.note.icon.camera': 'صورة',
  'plan.note.icon.mapPin': 'مكان',
  'plan.note.icon.wallet': 'مال',
  'plan.note.icon.umbrella': 'مطر',
  'plan.note.icon.triangleAlert': 'تحذير',
  'plan.transport.phase.flight.departing': 'الإقلاع',
  'plan.transport.phase.flight.travelling': 'في الجو',
  'plan.transport.phase.flight.arriving': 'الهبوط',
  'plan.transport.phase.hire.departing': 'الاستلام',
  'plan.transport.phase.hire.travelling': 'قيد الاستئجار',
  'plan.transport.phase.hire.arriving': 'التسليم',
  'plan.transport.phase.journey.departing': 'البداية',
  'plan.transport.phase.journey.travelling': 'في الطريق',
  'plan.transport.phase.journey.arriving': 'النهاية',
  'plan.transport.label': 'من {from} إلى {to}',
  'plan.transport.drag': 'إعادة ترتيب، {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'معًا',
  'collab.empty': 'لم تتم مشاركة أي شيء بعد',
  'collab.conversation': 'المحادثة',
  'collab.count.messages': {
    zero: '{messages} رسالة',
    one: '{messages} رسالة',
    two: '{messages} رسالتان',
    few: '{messages} رسائل',
    many: '{messages} رسالة',
    other: '{messages} رسالة',
  },
  'collab.count.notes': {
    zero: '{notes} ملاحظة',
    one: '{notes} ملاحظة',
    two: '{notes} ملاحظتان',
    few: '{notes} ملاحظات',
    many: '{notes} ملاحظة',
    other: '{notes} ملاحظة',
  },
  'collab.count.polls': {
    zero: '{polls} استطلاع',
    one: '{polls} استطلاع',
    two: '{polls} استطلاعان',
    few: '{polls} استطلاعات',
    many: '{polls} استطلاعًا',
    other: '{polls} استطلاع',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'الحجوزات',
  'book.empty': 'لم يُحجز أي شيء بعد',
  'book.count.bookings': {
    zero: '{bookings} حجز',
    one: '{bookings} حجز',
    two: '{bookings} حجزان',
    few: '{bookings} حجوزات',
    many: '{bookings} حجزًا',
    other: '{bookings} حجز',
  },
  'book.count.confirmed': {
    zero: '{confirmed} مؤكَّد',
    one: '{confirmed} مؤكَّد',
    two: '{confirmed} مؤكَّدان',
    few: '{confirmed} مؤكَّدة',
    many: '{confirmed} مؤكَّدًا',
    other: '{confirmed} مؤكَّد',
  },
  'book.progressLabel': {
    zero: 'تأكيد {confirmed} من {total} حجز',
    one: 'تأكيد {confirmed} من {total} حجز',
    two: 'تأكيد {confirmed} من {total} حجزين',
    few: 'تأكيد {confirmed} من {total} حجوزات',
    many: 'تأكيد {confirmed} من {total} حجزًا',
    other: 'تأكيد {confirmed} من {total} حجز',
  },
  'book.ofTotal': 'من {total}',
  'book.confirmed': 'مؤكَّدة',
  'book.awaiting': 'بانتظار التأكيد',
  'book.nothingHanging': 'لا شيء معلّق',
  'book.chase': 'تابعها قبل السفر',
  'book.committed': 'ملتزَم به',
  'book.committedCaption': 'عبر كل حجوزات هذه الرحلة',
  'book.onItinerary': 'في البرنامج',
  'book.pinnedCaption': 'مثبَّت على يوم من البرنامج',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'التنقلات',
  'transports.empty': 'لا شيء مسجَّل بعد',
  'transports.count.transports': {
    zero: '{transports} تنقل',
    one: '{transports} تنقل',
    two: '{transports} تنقلان',
    few: '{transports} تنقلات',
    many: '{transports} تنقلًا',
    other: '{transports} تنقل',
  },
  'transports.distance': 'المسافة المقطوعة',
  'transports.equator': '≈ {times}× حول خط الاستواء',
  'transports.noGrouping': 'لا تجميع بعد',
  'transports.mostly': 'غالبًا {mode}',
  'transports.confirmed': 'مؤكَّد',
  'transports.stillPending': {
    zero: '{pending} ما زال معلَّقًا',
    one: '{pending} ما زال معلَّقًا',
    two: '{pending} ما زالا معلَّقين',
    few: '{pending} ما زالت معلَّقة',
    many: '{pending} ما زالت معلَّقة',
    other: '{pending} ما زالت معلَّقة',
  },
  'transports.spent': 'المصروف على السفر',
  'transports.noPrices': 'لا أسعار مسجَّلة',
  'transports.priced': {
    zero: 'عبر {priced} تنقل مسعَّر',
    one: 'عبر {priced} تنقل مسعَّر',
    two: 'عبر {priced} تنقلين مسعَّرين',
    few: 'عبر {priced} تنقلات مسعَّرة',
    many: 'عبر {priced} تنقلًا مسعَّرًا',
    other: 'عبر {priced} تنقل مسعَّر',
  },
  'people.title': 'الأشخاص',
  'people.description': 'من في هذه الرحلة، ومن يمكنه العثور عليها',
  'people.members.title': 'في هذه الرحلة',
  'people.members.empty': 'لم يعد أي من أفراد هذه الرحلة في مساحة العمل هذه',
  'people.role.label': 'الدور',
  'people.role.owner': 'المالك',
  'people.role.editor': 'محرّر',
  'people.role.viewer': 'مشاهد',
  'people.you': 'أنت',
  'people.owner.hint': 'تحتفظ كل رحلة بمالك واحد على الأقل',
  'people.remove.action': 'إزالة {name} من هذه الرحلة',
  'people.remove.title': 'إزالة {name} من هذه الرحلة؟',
  'people.remove.body':
    'سيفقد الوصول إلى البرنامج فورًا. وما أضافه يبقى في الرحلة.',
  'people.remove.confirm': 'إزالة',
  'people.leave.action': 'مغادرة هذه الرحلة',
  'people.leave.title': 'مغادرة هذه الرحلة؟',
  'people.leave.body':
    'ستفقد الوصول إلى البرنامج إلى أن يعيدك أحد المشاركين في الرحلة.',
  'people.leave.confirm': 'مغادرة',
  'people.cancel': 'إلغاء',
  'people.invite.title': 'إضافة شخص',
  'people.invite.placeholder': 'ابحث عن الأشخاص في مساحة العمل هذه',
  'people.invite.action': 'إضافة إلى الرحلة',
  'people.invite.role': 'ينضم بصفة',
  'people.invite.empty': 'كل من في مساحة العمل هذه موجود بالفعل في هذه الرحلة',
  'people.invite.emptyHint':
    'انضمام شخص جديد إلى مساحة العمل يبدأ من الإعدادات',
  'people.visibility.title': 'من يمكنه العثور على هذه الرحلة',
  'people.visibility.switch': 'ظاهرة لكل من في مساحة العمل',
  'people.visibility.private':
    'الأشخاص المذكورون هنا وحدهم يمكنهم رؤية هذه الرحلة',
  'people.visibility.organization':
    'يمكن لأي شخص في مساحة العمل هذه فتح هذه الرحلة',
  'people.visibility.public': 'هذه الرحلة مشاركة عبر رابط عام',
  'people.error.lastOwner':
    'تحتفظ كل رحلة بمالك واحد على الأقل. اجعل شخصًا آخر مالكًا أولًا.',
  'people.error.notInWorkspace': 'هذا الشخص ليس في مساحة العمل هذه',
} satisfies TranslationOf<typeof En>

export default messages
