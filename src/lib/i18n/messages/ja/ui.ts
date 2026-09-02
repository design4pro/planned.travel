/**
 * The design system's own copy — every word `src/components/ui` says on
 * its own behalf, in Japanese.
 *
 * Authored from `../en/ui`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Japanese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. The number still arrives already grouped by the formatter, and
 * the counter that follows it (泊, 日, 件, 名) is chosen per message rather than
 * bolted on, because Japanese picks a different counter for nights, days,
 * records and people.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  'action.clear': 'クリア',
  'action.clearFilters': 'フィルターを解除',
  'action.close': '閉じる',
  'action.dismiss': '非表示にする',
  'action.remove': '削除',
  'action.keep': 'そのままにする',
  'action.undo': '元に戻す',
  'status.loading': '読み込み中',
  'status.working': '処理中',
  'status.searching': '検索中',
  'status.removing': '削除中',
  'avatar.status.online': '{name}はオンラインです',
  'avatar.status.away': '{name}は離席中です',
  'avatar.status.busy': '{name}は応答できません',
  'avatar.status.offline': '{name}はオフラインです',
  /**
   * The list separator around this fragment comes from the frozen table in
   * `src/lib/format-tables.ts`, which joins Japanese items with 、 — so the
   * fragment itself carries only the counter 人.
   */
  'avatar.overflow': { other: '他{others}人' },
  /**
   * English welds an ASCII plus to the figure. Japanese sets the sign
   * beside a numeral in its full-width form, which is also what keeps this
   * marker to two glyphs inside a 24px face.
   */
  'avatar.more': '＋{hidden}',
  /**
   * Same full-width sign as `avatar.more`, on the other side of the number:
   * Japanese reads 99＋ as "99 and over", and the cap is the part that must
   * not be mistaken for the count.
   */
  'badge.overflow': '{max}＋',
  'calendar.label.date': '日付を選ぶ',
  'calendar.label.range': '期間を選ぶ',
  'calendar.previousMonth': '前の月',
  'calendar.nextMonth': '次の月',
  /**
   * Reordered, not translated: `{month}` arrives from the frozen CLDR table
   * as 1月 … 12月, so the year has to lead and 年 has to sit between them.
   */
  'calendar.monthYear': '{year}年{month}',
  'calendar.grid': '{month}の{label}',
  'calendar.showing': '{months}を表示中',
  /**
   * Japanese writes a date largest unit first and puts the weekday last, so
   * the four already-formatted parts arrive in the opposite order to
   * English.
   */
  'calendar.day': '{year}年{month}{day}日 {weekday}',
  'select.placeholder': '選択…',
  'select.unavailable': '選択できません: {value}',
  'select.unavailableHint':
    '保存されていた「{value}」は選べなくなりました。別のものを選んでください。',
  'combobox.search': '検索',
  'combobox.empty': '該当なし',
  'combobox.clear': '選択を解除',
  'datePicker.placeholder': '日付を選ぶ',
  'datePicker.clear': '日付を消す',
  'dateRange.placeholder': '期間を選ぶ',
  'dateRange.clear': '期間を消す',
  'dateRange.presets': 'よく使う期間',
  'dateRange.preset.week': 'これから7日間',
  'dateRange.preset.fortnight': 'これから2週間',
  'dateRange.preset.month': 'これから30日間',
  /**
   * The wave dash is what Japanese uses for a range; an en dash between two
   * dates reads as a subtraction.
   */
  'dateRange.value': '{start}〜{end}',
  'dateRange.valuePending': '{start}〜（未定）',
  'dateRange.nights': { other: '{nights}泊' },
  'dateRange.nightsSelected': { other: '{nights}泊を選択中' },
  'pagination.label': 'ページ送り',
  'pagination.first': '最初のページ',
  'pagination.previous': '前のページ',
  'pagination.next': '次のページ',
  'pagination.last': '最後のページ',
  'pagination.page': '{page}ページ',
  'pagination.current': '{pageCount}ページ中{page}ページ',
  /**
   * The total leads in Japanese — 全…件中 brackets the slice — so the reader
   * meets the size of the set before the window into it.
   */
  'pagination.summary': '全{total}件中{from}〜{to}件を表示',
} satisfies TranslationOf<typeof En>

export default messages
