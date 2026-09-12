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
  'error.people': '无法加载成员',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '行程',
  'plan.places': '地点',
  'plan.day.empty': '还没有安排 — 把地点或备注拖到这里',
  'plan.move.refused.duplicate': '{name} 已在那一天里',
  'plan.move.refused.duplicateBody':
    '同一地点每天只能出现一次。请把它移到另一天。',
  'plan.move.refused.notInIdeas': '备注留在这一天里',
  'plan.move.refused.notInIdeasBody':
    '想法是等待安排日期的地点。备注属于它所写的那一天。',
  'plan.move.refused.notInAnotherDay': '备注留在自己的那一天',
  'plan.move.refused.notInAnotherDayBody':
    '备注还不能在不同日期之间移动。请编辑备注，或在另一天重新写一条。',
  'plan.move.refused.journeyNotInIdeas': '行程留在这一天里',
  'plan.move.refused.journeyNotInIdeasBody':
    '想法是等待安排日期的地点。行程属于它发生的那一天。',
  'plan.move.refused.journeyNotInAnotherDay': '行程留在自己的那一天',
  'plan.move.refused.journeyNotInAnotherDayBody':
    '行程的日期来自它的出发与抵达时间。请在「交通」标签页中修改。',
  'plan.move.refused.journeyTimed': '{name} 于 {time} 出发',
  'plan.move.refused.journeyTimedBody':
    '出发时间属于时刻表，不属于计划。请把行程放在它的时间该在的位置。',
  'plan.move.spoken.duplicate': '{name} 没有移动。那一天已经有它了。',
  'plan.move.spoken.notInIdeas': '{name} 没有移动。备注留在这一天里。',
  'plan.move.spoken.notInAnotherDay': '{name} 没有移动。备注留在自己的那一天。',
  'plan.move.spoken.timed': '{name} 设定了 {time}。正在询问是否放弃这个时间。',
  'plan.move.spoken.journeyNotInIdeas': '{name} 没有移动。行程留在这一天里。',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} 没有移动。行程留在自己的那一天。',
  'plan.move.spoken.journeyTimed': '{name} 没有移动。它于 {time} 出发。',
  'plan.move.error.save': '这次移动未能保存',
  'plan.move.error.retry': '请稍后再试一次。',
  'plan.move.dropTime.title': '移动 {name} 并放弃 {time} 吗？',
  'plan.move.dropTime.body':
    '这个位置与它的时间相矛盾。移到这里会清除时间——新的顺序和被清除的时间会一起保存。',
  'plan.move.dropTime.confirm': '移动并清除时间',
  'plan.move.dropTime.cancel': '保持原位',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': '添加备注',
  'plan.note.addForDay': '添加备注——{day}',
  'plan.note.showMore': '展开',
  'plan.note.showLess': '收起',
  'plan.note.moveUp': '上移',
  'plan.note.moveDown': '下移',
  'plan.note.drag': '重新排序备注',
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
  'plan.transport.phase.flight.departing': '起飞',
  'plan.transport.phase.flight.travelling': '飞行中',
  'plan.transport.phase.flight.arriving': '降落',
  'plan.transport.phase.hire.departing': '取车',
  'plan.transport.phase.hire.travelling': '租用中',
  'plan.transport.phase.hire.arriving': '还车',
  'plan.transport.phase.journey.departing': '开始',
  'plan.transport.phase.journey.travelling': '途中',
  'plan.transport.phase.journey.arriving': '结束',
  'plan.transport.label': '{from} 至 {to}',
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
  'people.title': '成员',
  'people.description': '谁在这次旅行里，谁能找到它',
  'people.members.title': '这次旅行的成员',
  'people.members.empty': '这次旅行的人都已不在这个工作区',
  'people.role.label': '角色',
  'people.role.owner': '所有者',
  'people.role.editor': '编辑者',
  'people.role.viewer': '查看者',
  'people.you': '你',
  'people.owner.hint': '每次旅行至少保留一位所有者',
  'people.remove.action': '把 {name} 移出这次旅行',
  'people.remove.title': '把 {name} 移出这次旅行？',
  'people.remove.body':
    '对方会立即失去查看行程的权限。已添加的内容留在旅行里。',
  'people.remove.confirm': '移出',
  'people.leave.action': '退出这次旅行',
  'people.leave.title': '退出这次旅行？',
  'people.leave.body': '在旅行里的人重新把你加回来之前，你将无法查看行程。',
  'people.leave.confirm': '退出',
  'people.cancel': '取消',
  'people.invite.title': '添加成员',
  'people.invite.placeholder': '搜索这个工作区里的人',
  'people.invite.action': '添加到旅行',
  'people.invite.role': '加入身份',
  'people.invite.empty': '这个工作区里的每个人都已在这次旅行里',
  'people.invite.emptyHint': '先在设置里把新成员加入工作区',
  'people.visibility.title': '谁能找到这次旅行',
  'people.visibility.switch': '对工作区里的所有人可见',
  'people.visibility.private': '只有这里列出的人能看到这次旅行',
  'people.visibility.organization': '这个工作区里的任何人都能打开这次旅行',
  'people.visibility.public': '这次旅行已通过公开链接分享',
  'people.error.lastOwner': '旅行至少保留一位所有者。请先把别人设为所有者。',
  'people.error.notInWorkspace': '这个人不在这个工作区里',
} satisfies TranslationOf<typeof En>

export default messages
