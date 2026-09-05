/**
 * The trip tabs' own copy, in ja.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複数形.** 日本語は `other` の一分岐のみ。数詞は助数詞を伴う。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'この旅行を読み込めませんでした',
  'error.plan': '旅程を読み込めませんでした',
  'error.costs': '費用を読み込めませんでした',
  'error.collab': '会話を読み込めませんでした',
  'error.book': '予約を読み込めませんでした',
  'error.transports': '移動を読み込めませんでした',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '旅程',
  'plan.places': '場所',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'みんなで',
  'collab.empty': 'まだ何も共有されていません',
  'collab.conversation': '会話',
  'collab.count.messages': {
    other: 'メッセージ{messages}件',
  },
  'collab.count.notes': {
    other: 'メモ{notes}件',
  },
  'collab.count.polls': {
    other: 'アンケート{polls}件',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': '予約',
  'book.empty': 'まだ予約はありません',
  'book.count.bookings': {
    other: '予約{bookings}件',
  },
  'book.count.confirmed': {
    other: '{confirmed}件確定',
  },
  'book.progressLabel': {
    other: '{total}件中{confirmed}件の予約が確定',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': '確定',
  'book.awaiting': '確認待ち',
  'book.nothingHanging': '保留なし',
  'book.chase': '出発前に確認しましょう',
  'book.committed': '確定額',
  'book.committedCaption': 'この旅行のすべての予約',
  'book.onItinerary': '旅程に登録',
  'book.pinnedCaption': '旅程の日に紐づけ済み',
  /* ---------------------------------------------- the transports tab */
  'transports.title': '移動',
  'transports.empty': 'まだ何も記録されていません',
  'transports.count.transports': {
    other: '移動 {transports} 件',
  },
  'transports.distance': '移動距離',
  'transports.equator': '≈ 赤道 {times} 周分',
  'transports.noGrouping': 'まだ集計されていません',
  'transports.mostly': '主に{mode}',
  'transports.confirmed': '確定',
  'transports.stillPending': {
    other: '{pending} 件が保留中',
  },
  'transports.spent': '移動にかけた費用',
  'transports.noPrices': '価格の記録はありません',
  'transports.priced': {
    other: '価格のある移動 {priced} 件',
  },
} satisfies TranslationOf<typeof En>

export default messages
