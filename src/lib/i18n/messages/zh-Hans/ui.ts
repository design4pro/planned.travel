/**
 * The design system's own copy — every word `src/components/ui` says on
 * its own behalf, in Simplified Chinese.
 *
 * Authored from `../en/ui`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Chinese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. Punctuation is mainland convention — full-width ，。（） and the
 * enumeration comma 、 — and the vocabulary is mainland too: 设置, 登录, 文件,
 * 默认.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  'action.clear': '清除',
  'action.clearFilters': '清除筛选',
  'action.close': '关闭',
  'action.dismiss': '不再显示',
  'action.remove': '移除',
  'action.keep': '保留',
  'action.undo': '撤销',
  'status.loading': '加载中',
  'status.working': '处理中',
  'status.searching': '搜索中',
  'status.removing': '正在删除',
  'avatar.status.online': '{name} 在线',
  'avatar.status.away': '{name} 暂时离开',
  'avatar.status.busy': '{name} 正忙',
  'avatar.status.offline': '{name} 已离线',
  /**
   * The enumeration comma between the names comes from the frozen list
   * table in `src/lib/format-tables.ts`, so this fragment carries only 等 …
   * 人, which is how Chinese closes a list of people.
   */
  'avatar.overflow': { other: '等 {others} 人' },
  /**
   * Chinese sets a plus sign against Han characters in its full-width form,
   * and it keeps this face to two glyphs at 24px.
   */
  'avatar.more': '＋{hidden}',
  /**
   * Same full-width sign as `avatar.more`, after the figure: 99＋ reads as
   * "99 and more", and the cap must not be mistaken for the count itself.
   */
  'badge.overflow': '{max}＋',
  'calendar.label.date': '选择日期',
  'calendar.label.range': '选择日期范围',
  'calendar.previousMonth': '上一个月',
  'calendar.nextMonth': '下一个月',
  /**
   * Reordered, not translated: `{month}` arrives from the frozen CLDR table
   * as 一月 … 十二月, so the year leads and carries 年.
   */
  'calendar.monthYear': '{year}年{month}',
  'calendar.grid': '{month}，{label}',
  'calendar.showing': '正在显示{months}',
  'calendar.day': '{year}年{month}{day}日 {weekday}',
  'select.placeholder': '请选择…',
  'select.unavailable': '无法选择：{value}',
  'select.unavailableHint': '已保存的“{value}”不再可选，请另选一项。',
  'combobox.search': '搜索',
  'combobox.empty': '没有匹配的结果',
  'combobox.clear': '清除所选',
  'datePicker.placeholder': '选一个日期',
  'datePicker.clear': '清除日期',
  'dateRange.placeholder': '选择起止日期',
  'dateRange.clear': '清除起止日期',
  'dateRange.presets': '常用区间',
  'dateRange.preset.week': '未来 7 天',
  'dateRange.preset.fortnight': '未来 2 周',
  'dateRange.preset.month': '未来 30 天',
  /**
   * 至 is what Chinese puts between the two ends of a range; an en dash
   * reads as a minus sign.
   */
  'dateRange.value': '{start} 至 {end}',
  'dateRange.valuePending': '{start} 至 …',
  'dateRange.nights': { other: '{nights} 晚' },
  'dateRange.nightsSelected': { other: '已选 {nights} 晚' },
  'pagination.label': '分页',
  'pagination.first': '第一页',
  'pagination.previous': '上一页',
  'pagination.next': '下一页',
  'pagination.last': '最后一页',
  'pagination.page': '第 {page} 页',
  'pagination.current': '第 {page} 页，共 {pageCount} 页',
  /**
   * Chinese states the window first and the size of the set last, joined by
   * 共, so the two figures do not have to be read as one number.
   */
  'pagination.summary': '显示第 {from}–{to} 条，共 {total} 条',
} satisfies TranslationOf<typeof En>

export default messages
