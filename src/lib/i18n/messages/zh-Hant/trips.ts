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
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': '新增備註',
  'plan.note.addForDay': '為這一天新增備註',
  'plan.note.showMore': '展開',
  'plan.note.showLess': '收合',
  'plan.note.moveUp': '上移',
  'plan.note.moveDown': '下移',
  'plan.note.edit': '編輯備註',
  'plan.note.delete': '刪除備註',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': '新增備註',
  'plan.note.dialog.editTitle': '編輯備註',
  'plan.note.field.body': '備註',
  'plan.note.field.bodyHint': '一行文字，這就是當天顯示的內容。',
  'plan.note.field.detail': '詳細內容',
  'plan.note.field.detailHint': '可用標題、清單、連結、引用、程式碼和表格。',
  'plan.note.field.time': '時間',
  'plan.note.field.timeHint': '選填，24 小時制。',
  'plan.note.field.icon': '圖示',
  'plan.note.tab.write': '撰寫',
  'plan.note.tab.preview': '預覽',
  'plan.note.previewEmpty': '目前沒有可預覽的內容',
  'plan.note.save': '儲存備註',
  'plan.note.cancel': '取消',
  'plan.note.confirmDelete': '刪除這則備註？',
  'plan.note.confirmDeleteBody': '這則備註和詳細內容會從這一天移除。',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': '已新增備註',
  'plan.note.toast.updated': '已儲存備註',
  'plan.note.toast.deleted': '已刪除備註',
  'plan.note.error.save': '備註未能儲存',
  'plan.note.error.delete': '備註未能刪除',
  'plan.note.error.move': '這次移動未能儲存',
  'plan.note.error.retry': '請稍後再試一次。',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': '提醒',
  'plan.note.icon.clock': '時間',
  'plan.note.icon.flashlight': '手電筒',
  'plan.note.icon.footprints': '步行',
  'plan.note.icon.info': '提示',
  'plan.note.icon.luggage': '行李',
  'plan.note.icon.package': '包裹',
  'plan.note.icon.ticket': '門票',
  'plan.note.icon.trainFront': '火車',
  'plan.note.icon.wifi': '網路',
  'plan.note.icon.stickyNote': '備註',
  'plan.note.icon.utensils': '用餐',
  'plan.note.icon.bus': '交通',
  'plan.note.icon.bedDouble': '住宿',
  'plan.note.icon.camera': '照片',
  'plan.note.icon.mapPin': '地點',
  'plan.note.icon.wallet': '花費',
  'plan.note.icon.umbrella': '下雨',
  'plan.note.icon.triangleAlert': '警告',
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
