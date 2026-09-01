/**
 * The travel journal's copy, in zh-Hant.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複數.** 繁體中文只有 `other` 一個分支；照片用「張」，人用「位」。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': '未設定',
  /* -------------------------------------------------- the journey page */
  'story.error': '無法載入這段旅程',
  'story.back': '所有旅程',
  'story.loading': '載入中',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': '記錄',
  'figure.photos': '照片',
  'figure.dates': '日期',
  'figure.visibility': '可見範圍',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': '這段旅程還沒有記錄',
  'entries.empty.body':
    '每則記錄都是一個瞬間：一個日期、幾行字、一個地點，以及你在那裡拍下的照片。趁還記得那股氣味，寫下第一則。',
  'entry.photos.count': {
    other: '{photos} 張照片',
  },
  'photo.untitled': '沒有說明的照片',
  /* ---------------------------------------------------- the side panel */
  'side.label': '這段旅程',
  'side.status': '狀態',
  'side.started': '開始',
  'side.ended': '結束',
  'side.loosePhotos': '未附加的照片',
  'moods.label': '心情',
  'authors.label': '記錄者',
  'authors.count': {
    other: '{authors} 位',
  },
} satisfies TranslationOf<typeof En>

export default messages
