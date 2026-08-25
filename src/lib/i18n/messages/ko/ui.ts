/**
 * The design system's own copy — every word `src/components/ui` says on
 * its own behalf, in Korean.
 *
 * Authored from `../en/ui`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Korean has no plural inflection, so `Intl.PluralRules` reports the single
 * category `other` and every `one`/`other` pair English writes collapses to one
 * branch. Spacing is the thing to get right instead: a counter noun (개, 명, 박,
 * 일) is written separately from the numeral, and a particle is chosen for the
 * noun it follows.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  'action.clear': '지우기',
  'action.close': '닫기',
  'action.dismiss': '숨기기',
  'action.remove': '삭제',
  'action.undo': '되돌리기',
  'status.loading': '불러오는 중',
  'status.working': '처리 중',
  'status.searching': '검색 중',
  'avatar.status.online': '{name} 님은 온라인이에요',
  'avatar.status.away': '{name} 님은 자리에 없어요',
  'avatar.status.busy': '{name} 님은 바빠요',
  'avatar.status.offline': '{name} 님은 오프라인이에요',
  'avatar.overflow': { other: '외 {others}명' },
  /**
   * Korean marks an overflow with 외 ("besides") rather than a plus sign,
   * and one syllable plus the figure still fits the 24px face.
   */
  'avatar.more': '외 {hidden}',
  /**
   * The cap marker sits after the figure, as in English, but in its
   * full-width form: a half-width plus against Hangul reads as a stray
   * operator.
   */
  'badge.overflow': '{max}＋',
  'calendar.label.date': '날짜 선택',
  'calendar.label.range': '기간 선택',
  'calendar.previousMonth': '지난달',
  'calendar.nextMonth': '다음 달',
  /**
   * Reordered, not translated: `{month}` arrives from the frozen CLDR table
   * as 1월 … 12월, so the year leads and carries its own 년.
   */
  'calendar.monthYear': '{year}년 {month}',
  'calendar.grid': '{month} {label}',
  'calendar.showing': '{months} 표시 중',
  'calendar.day': '{year}년 {month} {day}일 {weekday}',
  'select.placeholder': '선택…',
  'select.unavailable': '사용할 수 없음: {value}',
  /**
   * The stored value leads, set off by a dash, because a Korean particle
   * agrees with the sound of the word before it and no particle is right
   * for every value a schema change can leave behind.
   */
  'select.unavailableHint':
    '{value} — 저장해 둔 이 값은 더 이상 쓸 수 없어요. 다른 항목을 골라 주세요.',
  'combobox.search': '검색',
  'combobox.empty': '일치 항목 없음',
  'combobox.clear': '선택 해제',
  'datePicker.placeholder': '날짜 고르기',
  'datePicker.clear': '날짜 지우기',
  'dateRange.placeholder': '기간 고르기',
  'dateRange.clear': '기간 지우기',
  'dateRange.presets': '자주 쓰는 기간',
  'dateRange.preset.week': '앞으로 7일',
  'dateRange.preset.fortnight': '앞으로 2주',
  'dateRange.preset.month': '앞으로 30일',
  /**
   * Korean sets a range with a tilde; an en dash between two dates reads as
   * a minus sign.
   */
  'dateRange.value': '{start} ~ {end}',
  'dateRange.valuePending': '{start} ~ 미정',
  /**
   * 박 counts nights and 일 counts days, and a stay is always counted in 박 —
   * the number is already grouped by the formatter.
   */
  'dateRange.nights': { other: '{nights}박' },
  'dateRange.nightsSelected': { other: '{nights}박 선택' },
  'pagination.label': '페이지 이동',
  'pagination.first': '첫 페이지',
  'pagination.previous': '이전 페이지',
  'pagination.next': '다음 페이지',
  'pagination.last': '마지막 페이지',
  'pagination.page': '{page}페이지',
  'pagination.current': '{pageCount}페이지 중 {page}페이지',
  'pagination.summary': '전체 {total}개 중 {from}–{to}개 표시',
} satisfies TranslationOf<typeof En>

export default messages
