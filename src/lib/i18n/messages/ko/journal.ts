/**
 * The travel journal's copy, in ko.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **복수형.** 한국어는 `other` 한 분기만 사용하고, 수량은 “장”과 “명”으로 센다.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': '설정되지 않음',
  /* -------------------------------------------------- the journey page */
  'story.error': '이 여행을 불러오지 못했습니다',
  'story.back': '모든 여행',
  'story.loading': '불러오는 중',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': '기록',
  'figure.photos': '사진',
  'figure.dates': '날짜',
  'figure.visibility': '공개 범위',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': '이 여행에는 아직 기록이 없습니다',
  'entries.empty.body':
    '기록은 하나의 순간입니다. 날짜, 몇 줄의 글, 장소, 그곳에서 찍은 사진. 아직 냄새가 기억날 때 첫 기록을 남기세요.',
  'entry.photos.count': {
    other: '사진 {photos}장',
  },
  'photo.untitled': '설명 없는 사진',
  /* ---------------------------------------------------- the side panel */
  'side.label': '이 여행',
  'side.status': '상태',
  'side.started': '시작',
  'side.ended': '종료',
  'side.loosePhotos': '첨부되지 않은 사진',
  'moods.label': '기분',
  'authors.label': '작성자',
  'authors.count': {
    other: '{authors}명',
  },
} satisfies TranslationOf<typeof En>

export default messages
