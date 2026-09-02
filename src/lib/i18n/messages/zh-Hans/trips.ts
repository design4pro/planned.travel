/**
 * The trip tabs' own copy, in zh-Hans.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **复数.** 简体中文只有 `other` 一个分支。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': '无法加载这次旅行',
  'error.plan': '无法加载行程',
  'error.costs': '无法加载费用',
  'error.collab': '无法加载对话',
  'error.book': '无法加载预订',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '行程',
  'plan.places': '地点',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': '一起',
  'collab.empty': '还没有分享任何内容',
  'collab.conversation': '对话',
  'collab.count.messages': {
    other: '{messages} 条消息',
  },
  'collab.count.notes': {
    other: '{notes} 条便签',
  },
  'collab.count.polls': {
    other: '{polls} 个投票',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': '预订',
  'book.empty': '还没有预订',
  'book.count.bookings': {
    other: '{bookings} 项预订',
  },
  'book.count.confirmed': {
    other: '已确认 {confirmed} 项',
  },
  'book.progressLabel': {
    other: '{total} 项预订中已确认 {confirmed} 项',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': '已确认',
  'book.awaiting': '等待确认',
  'book.nothingHanging': '没有待办',
  'book.chase': '出发前先落实',
  'book.committed': '已投入',
  'book.committedCaption': '涵盖这次旅行的所有预订',
  'book.onItinerary': '已排入行程',
  'book.pinnedCaption': '已固定到行程中的某一天',
} satisfies TranslationOf<typeof En>

export default messages
