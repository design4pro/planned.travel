/**
 * The travel journal's copy, in ar.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **الجمع.** ستة فروع كما تقتضي قواعد CLDR للعربية.
 *
 * **الاتجاه.** العربية من اليمين إلى اليسار؛ التنسيق منطقي والأيقونات
 * الاتجاهية تُعكس — بما فيها سهم العودة إلى فهرس اليوميات.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'غير محدد',
  /* -------------------------------------------------- the journey page */
  'story.error': 'تعذّر تحميل هذه الرحلة',
  'story.back': 'كل الرحلات',
  'story.loading': 'جارٍ التحميل',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'المُدخلات',
  'figure.photos': 'الصور',
  'figure.dates': 'التواريخ',
  'figure.visibility': 'الظهور',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'لا توجد مُدخلات في هذه الرحلة بعد',
  'entries.empty.body':
    'كل مُدخل لحظة واحدة: تاريخ، وبضعة أسطر، ومكان، والصور التي التقطتها هناك. اكتب الأول ما دمت تتذكر رائحته.',
  'entry.photos.count': {
    zero: '{photos} صورة',
    one: '{photos} صورة',
    two: '{photos} صورتان',
    few: '{photos} صور',
    many: '{photos} صورة',
    other: '{photos} صورة',
  },
  'photo.untitled': 'صورة بلا تعليق',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'هذه الرحلة',
  'side.status': 'الحالة',
  'side.started': 'البداية',
  'side.ended': 'النهاية',
  'side.loosePhotos': 'صور غير مرفقة',
  'moods.label': 'الحالات المزاجية',
  'authors.label': 'كتبها',
  'authors.count': {
    zero: '{authors} مؤلف',
    one: '{authors} مؤلف',
    two: '{authors} مؤلفان',
    few: '{authors} مؤلفين',
    many: '{authors} مؤلفًا',
    other: '{authors} مؤلف',
  },
} satisfies TranslationOf<typeof En>

export default messages
