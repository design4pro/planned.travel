/**
 * The trip tabs' own copy, in zh-Hant.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複數.** 繁體中文只有 `other` 一個分支。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': '無法載入這次旅行',
  'error.plan': '無法載入行程',
  'error.costs': '無法載入費用',
  'error.collab': '無法載入對話',
  'error.book': '無法載入訂房',
  'error.transports': '交通未能載入',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '行程',
  'plan.places': '地點',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': '一起',
  'collab.empty': '還沒有分享任何內容',
  'collab.conversation': '對話',
  'collab.count.messages': {
    other: '{messages} 則訊息',
  },
  'collab.count.notes': {
    other: '{notes} 則筆記',
  },
  'collab.count.polls': {
    other: '{polls} 個投票',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': '訂房',
  'book.empty': '還沒有訂房',
  'book.count.bookings': {
    other: '{bookings} 筆訂房',
  },
  'book.count.confirmed': {
    other: '已確認 {confirmed} 筆',
  },
  'book.progressLabel': {
    other: '{total} 筆訂房中已確認 {confirmed} 筆',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': '已確認',
  'book.awaiting': '等待確認',
  'book.nothingHanging': '沒有待辦',
  'book.chase': '出發前先確認',
  'book.committed': '已投入',
  'book.committedCaption': '涵蓋這次旅行的所有訂房',
  'book.onItinerary': '已排入行程',
  'book.pinnedCaption': '已固定到行程中的某一天',
  /* ---------------------------------------------- the transports tab */
  'transports.title': '交通',
  'transports.empty': '尚未紀錄',
  'transports.count.transports': {
    other: '{transports} 段交通',
  },
  'transports.distance': '已行距離',
  'transports.equator': '≈ 繞赤道 {times} 圈',
  'transports.noGrouping': '尚未歸類',
  'transports.mostly': '多為{mode}',
  'transports.confirmed': '已確認',
  'transports.stillPending': {
    other: '{pending} 項仍待確認',
  },
  'transports.spent': '交通花費',
  'transports.noPrices': '未紀錄價格',
  'transports.priced': {
    other: '來自 {priced} 段有價交通',
  },
} satisfies TranslationOf<typeof En>

export default messages
