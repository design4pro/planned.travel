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
  'error.people': '참여자를 불러오지 못했습니다',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '일정',
  'plan.places': '장소',
  'plan.readOnly.archived': '이 여행은 보관되어 있어 일정은 읽기 전용입니다.',
  'plan.readOnly.role':
    '이 일정은 볼 수만 있습니다. 여행 소유자와 편집자만 변경할 수 있습니다.',
  'plan.day.empty':
    '아직 일정이 없습니다. 장소나 메모를 여기로 끌어다 놓으세요',
  'plan.move.refused.duplicate': '{name}은(는) 이미 그날에 있습니다',
  'plan.move.refused.duplicateBody':
    '한 장소는 하루에 한 번만 넣을 수 있습니다. 다른 날로 옮겨 보세요.',
  'plan.move.refused.notInIdeas': '메모는 그날 안에 남습니다',
  'plan.move.refused.notInIdeasBody':
    '아이디어는 날짜를 기다리는 장소입니다. 메모는 작성한 날에 속합니다.',
  'plan.move.refused.notInAnotherDay': '메모는 자기 날에 남습니다',
  'plan.move.refused.notInAnotherDayBody':
    '메모는 아직 다른 날로 옮길 수 없습니다. 메모를 수정하거나 다른 날에 새로 쓰세요.',
  'plan.move.refused.journeyNotInIdeas': '이동은 그날 안에 남습니다',
  'plan.move.refused.journeyNotInIdeasBody':
    '아이디어는 날짜를 기다리는 장소입니다. 이동은 그것이 일어나는 날에 속합니다.',
  'plan.move.refused.journeyNotInAnotherDay': '이동은 자기 날에 남습니다',
  'plan.move.refused.journeyNotInAnotherDayBody':
    '이동의 날은 그 날짜에서 정해집니다. 이동 탭에서 바꾸세요.',
  'plan.move.refused.journeyTimed': '{name}은(는) {time}에 출발합니다',
  'plan.move.refused.journeyTimedBody':
    '출발 시각은 시간표의 것이지 계획의 것이 아닙니다. 시계가 가리키는 자리에 이동을 두세요.',
  'plan.move.spoken.duplicate':
    '{name}은(는) 이동하지 않았습니다. 그날에는 이미 있습니다.',
  'plan.move.spoken.notInIdeas':
    '{name}은(는) 이동하지 않았습니다. 메모는 그날 안에 남습니다.',
  'plan.move.spoken.notInAnotherDay':
    '{name}은(는) 이동하지 않았습니다. 메모는 자기 날에 남습니다.',
  'plan.move.spoken.timed':
    '{name}에는 {time}이(가) 있습니다. 시간을 지울지 묻습니다.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name}은(는) 이동하지 않았습니다. 이동은 그날 안에 남습니다.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name}은(는) 이동하지 않았습니다. 이동은 자기 날에 남습니다.',
  'plan.move.spoken.journeyTimed':
    '{name}은(는) 이동하지 않았습니다. {time}에 출발합니다.',
  'plan.move.error.save': '이동을 저장하지 못했습니다',
  'plan.move.error.retry': '잠시 후 다시 시도해 주세요.',
  'plan.move.dropTime.title': '{name}을(를) 옮기고 {time}을(를) 지울까요?',
  'plan.move.dropTime.body':
    '이 자리는 지정된 시간과 맞지 않습니다. 여기로 옮기면 시간이 지워지고, 새 순서와 지워진 시간이 함께 저장됩니다.',
  'plan.move.dropTime.confirm': '옮기고 시간 지우기',
  'plan.move.dropTime.cancel': '그대로 두기',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': '메모 추가',
  'plan.note.addForDay': '메모 추가 — {day}',
  'plan.addPlace.label': '장소 추가',
  'plan.addPlace.more': '장소를 추가하는 다른 방법',
  'plan.addPlace.option.map': '지도에 배치',
  'plan.addPlace.forDay': '이 날에 장소 추가',
  'plan.addPlace.forDayNamed': '장소 추가 — {day}',
  'plan.stay.checkIn': '체크인',
  'plan.stay.checkOut': '체크아웃',
  'plan.day.addStay': '숙소 추가 — {day}',
  'plan.day.addStayShort': '숙소 추가',
  'plan.drop.hint':
    '지도를 마우스 오른쪽 버튼으로 클릭하거나 길게 누르면 바로 그 위치에 장소가 추가됩니다.',
  'plan.drop.armed':
    '놓을 위치의 지도를 클릭하거나, 지도를 움직인 뒤 Enter 키를 누르면 가운데에 놓입니다.',
  'plan.drop.stop': '새 핀 배치 중단',
  'plan.drop.pin': '새 장소',
  'plan.drop.lookingUp': '주소를 찾는 중…',
  'plan.drop.error': '핀을 놓지 못했습니다. 잠시 후 다시 시도해 주세요.',
  'plan.place.pastedPosition': '위도 {lat}, 경도 {lng}(으)로 읽었습니다',
  'plan.note.showMore': '더 보기',
  'plan.note.showLess': '접기',
  'plan.note.moveUp': '위로 이동',
  'plan.note.moveDown': '아래로 이동',
  'plan.note.drag': '메모 순서 바꾸기',
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
  'plan.transport.phase.flight.departing': '출발',
  'plan.transport.phase.flight.travelling': '비행 중',
  'plan.transport.phase.flight.arriving': '착륙',
  'plan.transport.phase.hire.departing': '인수',
  'plan.transport.phase.hire.travelling': '대여 중',
  'plan.transport.phase.hire.arriving': '반납',
  'plan.transport.phase.journey.departing': '시작',
  'plan.transport.phase.journey.travelling': '이동 중',
  'plan.transport.phase.journey.arriving': '종료',
  'plan.transport.label': '{from}에서 {to}까지',
  'plan.transport.drag': '순서 바꾸기 — {journey}',
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
  'people.title': '참여자',
  'people.description': '이 여행에 누가 있고, 누가 찾을 수 있는지',
  'people.members.title': '이 여행의 참여자',
  'people.members.empty':
    '이 여행의 참여자 중 이 워크스페이스에 남은 사람이 없습니다',
  'people.role.label': '역할',
  'people.role.owner': '소유자',
  'people.role.editor': '편집자',
  'people.role.viewer': '뷰어',
  'people.you': '나',
  'people.owner.hint': '여행에는 항상 소유자가 한 명 이상 있습니다',
  'people.remove.action': '{name} 님을 이 여행에서 제외',
  'people.remove.title': '{name} 님을 이 여행에서 제외할까요?',
  'people.remove.body':
    '바로 일정에 접근할 수 없게 됩니다. 추가한 내용은 여행에 남습니다.',
  'people.remove.confirm': '제외',
  'people.leave.action': '이 여행에서 나가기',
  'people.leave.title': '이 여행에서 나갈까요?',
  'people.leave.body':
    '여행에 있는 누군가가 다시 추가할 때까지 일정을 볼 수 없습니다.',
  'people.leave.confirm': '나가기',
  'people.cancel': '취소',
  'people.invite.title': '사람 추가',
  'people.invite.placeholder': '이 워크스페이스의 사람 검색',
  'people.invite.action': '여행에 추가',
  'people.invite.role': '참여 역할',
  'people.invite.empty':
    '이 워크스페이스의 모든 사람이 이미 이 여행에 있습니다',
  'people.invite.emptyHint':
    '설정에서 새로운 사람이 워크스페이스에 먼저 들어옵니다',
  'people.visibility.title': '이 여행을 찾을 수 있는 사람',
  'people.visibility.switch': '워크스페이스의 모두에게 보이기',
  'people.visibility.private': '여기 있는 사람만 이 여행을 볼 수 있습니다',
  'people.visibility.organization':
    '이 워크스페이스의 누구나 이 여행을 열 수 있습니다',
  'people.visibility.public': '이 여행은 공개 링크로 공유되어 있습니다',
  'people.error.lastOwner':
    '여행에는 소유자가 한 명 이상 있어야 합니다. 먼저 다른 사람을 소유자로 지정하세요.',
  'people.error.notInWorkspace': '그 사람은 이 워크스페이스에 없습니다',
  'people.error.alreadyOnTrip': '그 사람은 이미 이 여행에 있습니다',
  'people.guests.title': '함께 여행하는 사람',
  'people.guests.description': '이 여행에서 계정이 없는 사람',
  'people.guests.empty': '아직 없음',
  'people.guests.emptyHint':
    '게스트는 계정 없이 함께 여행하는 사람입니다. 이름으로 추가하세요.',
  'people.guest.badge': '게스트',
  'people.guest.add.label': '이름',
  'people.guest.add.placeholder': '지민',
  'people.guest.add.action': '게스트 추가',
  'people.guest.rename.action': '{name} 이름 바꾸기',
  'people.guest.rename.title': '{name} 이름 바꾸기',
  'people.guest.rename.confirm': '이름 바꾸기',
  'people.guest.remove.action': '이 여행에서 {name} 제외',
  'people.guest.remove.title': '이 여행에서 {name}님을 제외할까요?',
  'people.guest.remove.body':
    '게스트가 제외됩니다. 여행의 다른 내용은 바뀌지 않습니다.',
  'people.guest.remove.confirm': '제외',
  'people.guest.merge.action': '{name}님은 이제…',
  'people.guest.merge.title': '{name}님을 이 여행의 멤버로 합치기',
  'people.guest.merge.body':
    '{name}님에게 배정된 모든 항목이 선택한 사람에게 옮겨지고 게스트는 제외됩니다. 되돌릴 수 없습니다.',
  'people.guest.merge.inherits':
    '{name}에게 배정된 모든 항목을 {member}님이 이어받습니다.',
  'people.guest.merge.placeholder': '이 여행에 있는 사람 선택',
  'people.guest.merge.confirm': '병합',
  'people.guest.merge.done': '{name}님은 이제 {member}님입니다',
  'people.guest.merge.nothingMoved': '아직 배정된 항목이 없었습니다',
  'people.error.guestNameTaken':
    '이 여행에 이미 {name}(이)라는 게스트가 있습니다',
  'people.error.guestLimit':
    '여행 한 건에 게스트는 최대 {limit}명입니다. 목록이 더 길면 참가자 선택과 비용 분담을 읽기 어려워지기 때문입니다',
  'people.error.guestMergeTarget': '이미 이 여행에 있는 사람을 선택하세요',
} satisfies TranslationOf<typeof En>

export default messages
