/**
 * The trip tabs' own copy, in ko.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **복수형.** 한국어는 `other` 한 분기만 사용한다.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': '이 여행을 불러오지 못했습니다',
  'error.plan': '일정을 불러오지 못했습니다',
  'error.costs': '비용을 불러오지 못했습니다',
  'error.collab': '대화를 불러오지 못했습니다',
  'error.book': '예약을 불러오지 못했습니다',
  'error.transports': '이동을 불러오지 못했습니다',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '일정',
  'plan.places': '장소',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': '메모 추가',
  'plan.note.addForDay': '메모 추가 — {day}',
  'plan.note.showMore': '더 보기',
  'plan.note.showLess': '접기',
  'plan.note.moveUp': '위로 이동',
  'plan.note.moveDown': '아래로 이동',
  'plan.note.edit': '메모 편집',
  'plan.note.delete': '메모 삭제',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': '메모 추가',
  'plan.note.dialog.editTitle': '메모 편집',
  'plan.note.field.body': '메모',
  'plan.note.field.bodyHint': '한 줄만. 일정에 표시되는 내용입니다.',
  'plan.note.field.detail': '세부 내용',
  'plan.note.field.detailHint':
    '제목, 목록, 링크, 인용, 코드, 표를 쓸 수 있습니다.',
  'plan.note.field.time': '시각',
  'plan.note.field.timeHint': '선택 사항, 24시간 형식.',
  'plan.note.field.icon': '아이콘',
  'plan.note.tab.write': '작성',
  'plan.note.tab.preview': '미리보기',
  'plan.note.previewEmpty': '아직 미리 볼 내용이 없습니다',
  'plan.note.save': '메모 저장',
  'plan.note.cancel': '취소',
  'plan.note.confirmDelete': '이 메모를 삭제할까요?',
  'plan.note.confirmDeleteBody': '메모와 세부 내용이 이 날짜에서 사라집니다.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': '메모를 추가했습니다',
  'plan.note.toast.updated': '메모를 저장했습니다',
  'plan.note.toast.deleted': '메모를 삭제했습니다',
  'plan.note.error.save': '메모를 저장하지 못했습니다',
  'plan.note.error.delete': '메모를 삭제하지 못했습니다',
  'plan.note.error.move': '이동을 저장하지 못했습니다',
  'plan.note.error.retry': '잠시 후 다시 시도해 주세요.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': '알림',
  'plan.note.icon.clock': '시각',
  'plan.note.icon.flashlight': '손전등',
  'plan.note.icon.footprints': '도보',
  'plan.note.icon.info': '안내',
  'plan.note.icon.luggage': '짐',
  'plan.note.icon.package': '소포',
  'plan.note.icon.ticket': '티켓',
  'plan.note.icon.trainFront': '기차',
  'plan.note.icon.wifi': '인터넷',
  'plan.note.icon.stickyNote': '메모',
  'plan.note.icon.utensils': '식사',
  'plan.note.icon.bus': '이동',
  'plan.note.icon.bedDouble': '숙박',
  'plan.note.icon.camera': '사진',
  'plan.note.icon.mapPin': '장소',
  'plan.note.icon.wallet': '돈',
  'plan.note.icon.umbrella': '비',
  'plan.note.icon.triangleAlert': '경고',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': '함께',
  'collab.empty': '아직 공유된 것이 없습니다',
  'collab.conversation': '대화',
  'collab.count.messages': {
    other: '메시지 {messages}개',
  },
  'collab.count.notes': {
    other: '메모 {notes}개',
  },
  'collab.count.polls': {
    other: '투표 {polls}개',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': '예약',
  'book.empty': '아직 예약이 없습니다',
  'book.count.bookings': {
    other: '예약 {bookings}건',
  },
  'book.count.confirmed': {
    other: '{confirmed}건 확정',
  },
  'book.progressLabel': {
    other: '{total}건 중 {confirmed}건 예약 확정',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': '확정',
  'book.awaiting': '확인 대기',
  'book.nothingHanging': '대기 중인 것 없음',
  'book.chase': '출발 전에 확인하세요',
  'book.committed': '확정 금액',
  'book.committedCaption': '이 여행의 모든 예약 기준',
  'book.onItinerary': '일정에 등록',
  'book.pinnedCaption': '일정의 특정 날짜에 고정됨',
  /* ---------------------------------------------- the transports tab */
  'transports.title': '이동',
  'transports.empty': '아직 기록된 것이 없습니다',
  'transports.count.transports': {
    other: '이동 {transports}건',
  },
  'transports.distance': '이동 거리',
  'transports.equator': '≈ 적도 {times}바퀴',
  'transports.noGrouping': '아직 묶인 것이 없습니다',
  'transports.mostly': '주로 {mode}',
  'transports.confirmed': '확정',
  'transports.stillPending': {
    other: '{pending}건 대기 중',
  },
  'transports.spent': '이동에 쓴 비용',
  'transports.noPrices': '기록된 가격이 없습니다',
  'transports.priced': {
    other: '가격이 있는 이동 {priced}건 기준',
  },
} satisfies TranslationOf<typeof En>

export default messages
