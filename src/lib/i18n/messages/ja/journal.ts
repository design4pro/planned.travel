/**
 * The travel journal's copy, in ja.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複数形.** 日本語は `other` の一分岐のみ。枚数と人数は助数詞を伴う。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': '未設定',
  /* -------------------------------------------------- the journey page */
  'story.error': 'この旅を読み込めませんでした',
  'story.back': 'すべての旅',
  'story.loading': '読み込み中',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': '記録',
  'figure.photos': '写真',
  'figure.dates': '日付',
  'figure.visibility': '公開範囲',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'この旅にはまだ記録がありません',
  'entries.empty.body':
    '記録はひとつの瞬間です。日付、数行の言葉、場所、そこで撮った写真。匂いを覚えているうちに、最初の一つを書いてください。',
  'entry.photos.count': {
    other: '写真{photos}枚',
  },
  'photo.untitled': 'キャプションのない写真',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'この旅',
  'side.status': '状態',
  'side.started': '開始',
  'side.ended': '終了',
  'side.loosePhotos': '未添付の写真',
  'moods.label': '気分',
  'authors.label': '書いた人',
  'authors.count': {
    other: '{authors}人',
  },
} satisfies TranslationOf<typeof En>

export default messages
