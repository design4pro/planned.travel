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
  'error.transports': '交通未能加载',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '行程',
  'plan.places': '地点',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': '添加备注',
  'plan.note.addForDay': '添加备注——{day}',
  'plan.note.showMore': '展开',
  'plan.note.showLess': '收起',
  'plan.note.moveUp': '上移',
  'plan.note.moveDown': '下移',
  'plan.note.edit': '编辑备注',
  'plan.note.delete': '删除备注',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': '添加备注',
  'plan.note.dialog.editTitle': '编辑备注',
  'plan.note.field.body': '备注',
  'plan.note.field.bodyHint': '一行文字，这就是当天显示的内容。',
  'plan.note.field.detail': '详情',
  'plan.note.field.detailHint': '可用标题、列表、链接、引用、代码和表格。',
  'plan.note.field.time': '时间',
  'plan.note.field.timeHint': '可选，24 小时制。',
  'plan.note.field.icon': '图标',
  'plan.note.tab.write': '编写',
  'plan.note.tab.preview': '预览',
  'plan.note.previewEmpty': '暂无可预览的内容',
  'plan.note.save': '保存备注',
  'plan.note.cancel': '取消',
  'plan.note.confirmDelete': '删除这条备注？',
  'plan.note.confirmDeleteBody': '这条备注及其详情将从这一天移除。',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': '备注已添加',
  'plan.note.toast.updated': '备注已保存',
  'plan.note.toast.deleted': '备注已删除',
  'plan.note.error.save': '备注未能保存',
  'plan.note.error.delete': '备注未能删除',
  'plan.note.error.move': '这次移动未能保存',
  'plan.note.error.retry': '请稍后再试一次。',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': '提醒',
  'plan.note.icon.clock': '时间',
  'plan.note.icon.flashlight': '手电筒',
  'plan.note.icon.footprints': '步行',
  'plan.note.icon.info': '提示',
  'plan.note.icon.luggage': '行李',
  'plan.note.icon.package': '包裹',
  'plan.note.icon.ticket': '门票',
  'plan.note.icon.trainFront': '火车',
  'plan.note.icon.wifi': '网络',
  'plan.note.icon.stickyNote': '备注',
  'plan.note.icon.utensils': '用餐',
  'plan.note.icon.bus': '交通',
  'plan.note.icon.bedDouble': '住宿',
  'plan.note.icon.camera': '照片',
  'plan.note.icon.mapPin': '地点',
  'plan.note.icon.wallet': '花费',
  'plan.note.icon.umbrella': '下雨',
  'plan.note.icon.triangleAlert': '警告',
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
  /* ---------------------------------------------- the transports tab */
  'transports.title': '交通',
  'transports.empty': '尚未记录',
  'transports.count.transports': {
    other: '{transports} 段交通',
  },
  'transports.distance': '已行距离',
  'transports.equator': '≈ 绕赤道 {times} 圈',
  'transports.noGrouping': '尚未归类',
  'transports.mostly': '多为{mode}',
  'transports.confirmed': '已确认',
  'transports.stillPending': {
    other: '{pending} 项仍待确认',
  },
  'transports.spent': '交通花费',
  'transports.noPrices': '未记录价格',
  'transports.priced': {
    other: '来自 {priced} 段有价交通',
  },
} satisfies TranslationOf<typeof En>

export default messages
