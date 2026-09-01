/**
 * The travel journal's copy, in vi.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Số nhiều.** Tiếng Việt chỉ có nhánh `other`; ảnh đi với “ảnh”, người với “người”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Chưa đặt',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Không tải được hành trình này',
  'story.back': 'Tất cả hành trình',
  'story.loading': 'Đang tải',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Bài viết',
  'figure.photos': 'Ảnh',
  'figure.dates': 'Ngày',
  'figure.visibility': 'Phạm vi hiển thị',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Hành trình này chưa có bài viết nào',
  'entries.empty.body':
    'Mỗi bài viết là một khoảnh khắc: một ngày, vài dòng, một nơi và những bức ảnh bạn chụp ở đó. Hãy viết bài đầu tiên khi bạn còn nhớ mùi của nó.',
  'entry.photos.count': {
    other: '{photos} ảnh',
  },
  'photo.untitled': 'Ảnh không có chú thích',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Hành trình này',
  'side.status': 'Trạng thái',
  'side.started': 'Bắt đầu',
  'side.ended': 'Kết thúc',
  'side.loosePhotos': 'Ảnh rời',
  'moods.label': 'Tâm trạng',
  'authors.label': 'Người viết',
  'authors.count': {
    other: '{authors} người',
  },
} satisfies TranslationOf<typeof En>

export default messages
