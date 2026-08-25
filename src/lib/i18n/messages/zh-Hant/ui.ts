/**
 * The design system's own copy — every word `src/components/ui` says on
 * its own behalf, in Traditional Chinese.
 *
 * Authored from `../en/ui`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Chinese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. This is Taiwan usage rather than a character conversion of
 * `../zh-Hans`: 設定 not 设置, 登入 not 登录, 檔案 not 文件, 預設 not 默认, and the
 * corner brackets 「」 where the mainland catalogue quotes with “”.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  'action.clear': '清除',
  'action.close': '關閉',
  'action.dismiss': '不再顯示',
  'action.remove': '移除',
  'action.undo': '復原',
  'status.loading': '載入中',
  'status.working': '處理中',
  'status.searching': '搜尋中',
  'avatar.status.online': '{name} 在線上',
  'avatar.status.away': '{name} 暫時離開',
  'avatar.status.busy': '{name} 忙碌中',
  'avatar.status.offline': '{name} 已離線',
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
  'calendar.label.date': '選擇日期',
  'calendar.label.range': '選擇日期範圍',
  'calendar.previousMonth': '上一個月',
  'calendar.nextMonth': '下一個月',
  /**
   * Reordered, not translated: `{month}` arrives from the frozen CLDR table
   * as 1月 … 12月 — the Taiwan forms, where `../zh-Hans` gets 一月 — so the
   * year leads and carries 年.
   */
  'calendar.monthYear': '{year}年{month}',
  'calendar.grid': '{month}，{label}',
  'calendar.showing': '正在顯示{months}',
  'calendar.day': '{year}年{month}{day}日 {weekday}',
  'select.placeholder': '請選擇…',
  'select.unavailable': '無法選擇：{value}',
  'select.unavailableHint': '已儲存的「{value}」不再能選，請改選一項。',
  'combobox.search': '搜尋',
  'combobox.empty': '沒有符合的項目',
  'combobox.clear': '清除選擇',
  'datePicker.placeholder': '挑一個日期',
  'datePicker.clear': '清除日期',
  'dateRange.placeholder': '選擇起迄日期',
  'dateRange.clear': '清除起迄日期',
  'dateRange.presets': '常用區間',
  'dateRange.preset.week': '未來 7 天',
  'dateRange.preset.fortnight': '未來 2 週',
  'dateRange.preset.month': '未來 30 天',
  /**
   * 至 is what Chinese puts between the two ends of a range; an en dash
   * reads as a minus sign.
   */
  'dateRange.value': '{start} 至 {end}',
  'dateRange.valuePending': '{start} 至 …',
  'dateRange.nights': { other: '{nights} 晚' },
  'dateRange.nightsSelected': { other: '已選 {nights} 晚' },
  'pagination.label': '分頁',
  'pagination.first': '第一頁',
  'pagination.previous': '上一頁',
  'pagination.next': '下一頁',
  'pagination.last': '最後一頁',
  'pagination.page': '第 {page} 頁',
  'pagination.current': '第 {page} 頁，共 {pageCount} 頁',
  /**
   * Taiwan counts records in 筆 where the mainland catalogue counts them in
   * 條, and the window is stated before the size of the set.
   */
  'pagination.summary': '顯示第 {from}–{to} 筆，共 {total} 筆',
} satisfies TranslationOf<typeof En>

export default messages
