/**
 * The travel journal's copy, in zh-Hans.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **复数.** 简体中文只有 `other` 一个分支；照片用“张”，人用“位”。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': '未设置',
  /* -------------------------------------------------- the journey page */
  'story.error': '无法加载这段旅程',
  'story.back': '所有旅程',
  'story.loading': '加载中',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': '记录',
  'figure.photos': '照片',
  'figure.dates': '日期',
  'figure.visibility': '可见范围',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': '这段旅程还没有记录',
  'entries.empty.body':
    '每条记录都是一个瞬间：一个日期、几行字、一个地点，以及你在那里拍下的照片。趁还记得那股气味，写下第一条。',
  'entry.photos.count': {
    other: '{photos} 张照片',
  },
  'photo.untitled': '没有说明的照片',
  /* ---------------------------------------------------- the side panel */
  'side.label': '这段旅程',
  'side.status': '状态',
  'side.started': '开始',
  'side.ended': '结束',
  'side.loosePhotos': '未附加的照片',
  'moods.label': '心情',
  'authors.label': '记录者',
  'authors.count': {
    other: '{authors} 位',
  },
} satisfies TranslationOf<typeof En>

export default messages
