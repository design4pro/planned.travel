/**
 * The world tracker and the map chrome, in Korean.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * 아틀라스 for the tracker, 여행 for a trip, 워크스페이스 for the workspace;
 * the bucket list is 버킷 리스트.
 *
 * **One branch.** Korean has no plural inflection, so `Intl.PluralRules`
 * reports the single category `other` and every `one`/`other` pair English
 * writes collapses to one branch. The number still arrives already formatted;
 * the counter that follows it (곳, 회, 개국, 일, 년) is chosen per message.
 *
 * Country names stay English by design: `src/lib/atlas/country-names.ts` is a
 * frozen table, so particles are chosen to read naturally beside a Latin name
 * (을(를), 이(가)) where the final sound cannot be known in advance.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': '세계 지도. 아직 방문한 나라가 표시되지 않았습니다.',
  'screen.world.summary':
    '세계 지도. 전체 {total}개국 중 {visited}개국이 방문한 곳으로 표시되어 있습니다.',
  'screen.error.title': '아틀라스를 불러오지 못했습니다',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': '지도를 불러오는 중',
  'map.controls.label': '지도 조작',
  'map.controls.zoomIn': '확대',
  'map.controls.zoomOut': '축소',
  'map.controls.north': '북쪽으로 맞추기',
  'map.controls.locate': '내 위치 찾기',
  'map.controls.locateFailed': '위치를 확인하지 못했습니다.',
  'map.controls.locateFailedBody':
    '이 사이트에 위치 접근이 허용되어 있는지 확인한 뒤 다시 시도해 주세요.',

  'map.attribution.label': '지도 데이터 제공',
  'map.attribution.geocoder': '장소 검색 제공',

  'map.basemap.title': '기본 지도를 사용할 수 없습니다',
  'map.basemap.body':
    '거리 상세 정보가 현재 오프라인입니다. 모든 장소는 여전히 실제 위치에 표시되므로 거리와 묶음은 정확하게 유지됩니다.',
  'map.basemap.credit': '해안선 제공',
  'map.basemap.retry': '다시 시도',
  'map.basemap.retrying': '기본 지도를 확인하는 중',

  'map.engine.unsupported.title': '지도를 그릴 수 없습니다',
  'map.engine.unsupported.body':
    '이 브라우저에서는 인터랙티브 지도를 실행할 수 없습니다. 지도에는 WebGL2가 필요한데 여기서는 사용할 수 없습니다. 이 화면의 다른 기능은 지도에 의존하지 않습니다.',
  'map.engine.stalled.title': '지도가 아직 그려지지 않았습니다',
  'map.engine.stalled.body':
    '시작에 주어진 시간 안에 아무것도 나타나지 않았습니다. 저절로 살아날 수도 있습니다. 이 화면의 다른 기능은 지도에 의존하지 않습니다.',

  'map.coverage.partial.title': '거리 상세 정보가 일부만 있습니다',
  'map.coverage.partial.body': {
    other:
      '공개된 지도 데이터가 이 여행의 장소 {outside}곳까지는 닿지 않습니다. 해당 장소는 자체 해안선 위 실제 위치에 그려져 있습니다.',
  },
  'map.coverage.none.title': '이곳에는 거리 상세 정보가 없습니다',
  'map.coverage.none.body':
    '이 지역의 거리는 아직 공개되지 않았습니다. 해안선, 핀, 그 사이의 경로는 모두 실제 그대로이며 빠진 것은 건물과 도로뿐입니다.',
  'map.coverage.dismiss': '지도 범위 안내 닫기',

  'map.legend.title': '범례',
  'map.legend.collapse': '{title} 접기',
  'map.legend.expand': '{title} 펼치기',
  'map.legend.dayPin': '일차 핀 예시',
  'map.legend.dayPinMeaning': '일정의 하루',
  'map.legend.clusterPin': '묶음 핀 예시',
  'map.legend.clusterPinMeaning': '묶인 장소들',

  'map.filter.label': '카테고리로 장소 필터링',
  'map.filter.all': '전체',
  'map.filter.category': {
    other: '{name} · {places}곳',
  },

  'map.pin.day': '{day}일차',
  'map.pin.cluster': {
    other: '{places}곳 — 확대하면 하나씩 나뉘어 보입니다',
  },

  'map.place.rating': '평점 {max}점 만점에 {rating}점',
  'map.place.clause.day': '{day}일차',
  'map.place.clause.rating': '평점 {max}점 만점에 {rating}점',
  'map.place.clause.visited': '방문함',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': '마지막 방문',
  'legend.recent': {
    other: '최근 {years}년 이내',
  },
  'legend.middle': '{from}–{to}년 전, 또는 날짜 없음',
  'legend.distant': {
    other: '{years}년도 더 전',
  },
  'legend.unvisited': '아직 방문하지 않음',
  'legend.note':
    '색의 짙기는 방문이 얼마나 최근인지만 나타냅니다. 날짜는 모두 ‘나라’ 탭에 적혀 있습니다.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': '세계 커버리지',
  'panel.coverage.unit': '전체 {total}개국 중',
  'panel.coverage.caption': '세계의 {share} · {visits}',
  'panel.progress.label': '모든 나라를 향해',
  'panel.progress.remaining': '{remaining} 남음',
  'panel.toggle.hide': '아틀라스 상세 숨기기',
  'panel.toggle.show': '아틀라스 상세 보기',
  'panel.tabs.label': '아틀라스 섹션',
  'panel.tab.country': '나라',
  'panel.tab.stats': '통계',
  'panel.tab.bucket': '버킷 리스트',
  'panel.back': '모든 나라',
  'panel.list.label': '방문한 나라',
  'panel.loading': '아틀라스를 불러오는 중',

  'panel.empty.blank.title': '지도가 아직 비어 있습니다',
  'panel.empty.blank.body':
    '나라를 방문한 곳으로 표시하면 이 지도가 채워집니다. 첫 방문과 마지막 방문, 다녀온 횟수, 그리고 그 나라에 대해 적어 둔 것까지 함께 보입니다.',
  'panel.empty.pick.title': '나라를 골라 보세요',
  'panel.empty.pick.body':
    '지도, 검색창, 목록 어디에서든 나라를 고르면 여기에 전체 기록이 열립니다. 첫 방문, 마지막 방문, 방문 횟수, 그리고 메모까지요.',

  'panel.stat.places': '내 장소',
  'panel.stat.placesNone': '여행에 고정해 둔 장소가 아직 없습니다',
  'panel.stat.placesCaption': '저장한 볼거리·숙소·경유지',
  'panel.stat.regions': '지역',
  'panel.stat.regionsNone': '표시한 지역이 아직 없습니다',
  'panel.stat.regionsCaption': '주, 도, 현 단위',
  'panel.stat.visits': '방문',
  'panel.stat.visitsCaption': '기록된 모든 도착',
  'panel.stat.trips': '내 여행',
  'panel.stat.tripsCaption': '참여한 모든 여행',
  'panel.stat.cities': '도시',
  'panel.stat.citiesCaption': '묵거나 들른 도시',
  'panel.stat.days': '여행 일수',
  'panel.stat.daysCaption': '기록에 있는 모든 여행 합산',
  'panel.continents.label': '대륙별 나라 수',

  'panel.bucket.empty.title': '리스트에 아직 아무것도 없습니다',
  'panel.bucket.empty.body':
    '늘 가 보고 싶었던 그곳. 추가해 두었다가 도착하면 지워 나가세요.',
  'panel.bucket.label': '버킷 리스트',
  'panel.bucket.progress': '{total}개 중 {done}개 달성',
  'panel.bucket.done': '달성',
  'panel.bucket.toGo': '남음',
  'panel.bucket.target': '{year}년까지',
  'panel.bucket.hidden': {
    other: '리스트에 {entries}개 항목이 더 있으며 여기에는 보이지 않습니다.',
  },
  'panel.bucket.kind.country': '나라',
  'panel.bucket.kind.region': '지역',
  'panel.bucket.kind.place': '장소',

  /* --------------------------------------------------------------- the world */
  'continent.africa': '아프리카',
  'continent.antarctica': '남극',
  'continent.asia': '아시아',
  'continent.europe': '유럽',
  'continent.northAmerica': '북아메리카',
  'continent.oceania': '오세아니아',
  'continent.southAmerica': '남아메리카',
  'continent.unknown': '대륙 기록 없음',

  /* ------------------------------------------------------------- the record */
  'record.visited': '방문함',
  'record.firstVisit': '첫 방문',
  'record.lastVisit': '마지막 방문',
  'record.visitDates': '방문 날짜',
  'record.notRecorded': '기록 없음',
  'record.datesUnrecorded': '날짜 기록 없음',
  'record.visits': {
    other: '{visits}회 방문',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': '첫 방문 {from}',
  'record.spanTo': '마지막 방문 {to}',
  'record.visitsUnit': { other: '회' },
  'record.gap.days': { other: '{gap}일 간격' },
  'record.gap.months': { other: '{gap}개월 간격' },
  'record.gap.years': { other: '{gap}년 간격' },
  'record.note.empty': '메모가 아직 없습니다',
  'record.noOutline':
    '이 지도가 그리는 세계 윤곽선은 1:110m 축척으로 잘려 있어 이 영토는 본국 안에 포함되어 그려집니다. 그래서 지도에 테두리를 맞출 형태가 없습니다. 방문은 그대로 집계됩니다.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': '나라 정렬',
  'list.sort.code': '국가 코드',
  'list.sort.codeStatement': '국가 코드 순으로 A부터 Z까지 정렬되어 있습니다.',
  'list.sort.name': '나라 이름',
  'list.sort.nameStatement':
    '나라 이름 순으로 A부터 Z까지, 그다음 국가 코드 순으로 정렬되어 있습니다.',
  'list.sort.recent': '가장 최근 방문',
  'list.sort.recentStatement':
    '가장 최근 방문이 먼저, 그다음 국가 코드 순입니다.',
  'list.sort.visits': '방문 횟수 순',
  'list.sort.visitsStatement':
    '방문 횟수가 많은 순서가 먼저, 그다음 국가 코드 순입니다.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    '세계 윤곽선에서는 본국 안에 포함되어 그려지므로 지도에 테두리를 맞출 형태가 없습니다.',
  'list.announce.selected': '{name}이(가) 선택되었습니다.',
  'list.announce.selectedUnframed': '{name}이(가) 선택되었습니다. {reason}',
  'list.empty.title': '지도에 아직 나라가 없습니다',
  'list.empty.body':
    '방문을 기록하는 순간 그 나라가 여기 나타납니다. 첫 도착, 가장 최근 도착, 다녀온 횟수와 함께요.',
  'list.loading': '방문한 나라를 불러오는 중',
  'list.error.title': '나라 목록을 불러오지 못했습니다',
  'list.error.body':
    '아틀라스가 지금 방문한 나라를 읽어 오지 못했습니다. 잃어버린 것은 없으며 기록은 그대로 남아 있습니다.',
  'list.error.retry': '다시 시도',
  'list.error.retrying': '나라 목록을 불러오는 중',

  /* ------------------------------------------------------------- the search */
  'search.label': '나라 찾기',
  'search.loading': '나라 목록을 불러오는 중',
  'search.placeholder': '나라 이름 또는 코드',
  'search.entry.notVisited': '아직 방문하지 않음',
  'search.entry.noOutline': '지도 윤곽선 없음',
  'search.entry.separator': ' · ',
  'search.cleared': '선택이 해제되었습니다.',
  'search.unframed':
    '{name}은(는) 세계 축척에서 윤곽선이 없어 지도가 테두리를 맞출 대상이 없습니다.',
  'search.unframedVisited':
    '{name}은(는) 세계 축척에서 윤곽선이 없어 지도가 테두리를 맞출 대상이 없습니다. 기록에는 영향이 없습니다.',
  'search.results.empty':
    '기록에 있는 나라가 아직 없습니다. 입력하면 세계 모든 나라를 검색할 수 있습니다.',
  'search.results.emptyPinned':
    '{name}이(가) 선택되어 있습니다. 기록에 있는 나라가 아직 없습니다 — 입력하면 세계 모든 나라를 검색할 수 있습니다.',
  'search.results.record': {
    other: '기록에 있는 나라는 {countries}개국입니다.',
  },
  'search.results.capped': '처음 {shown}개를 보여 주고 있습니다.',
  'search.results.pinned': '{name}이(가) 선택되어 맨 앞에 표시됩니다.',
  'search.results.none': '{term}에 일치하는 나라가 없습니다.',
  'search.results.matches': {
    other: '{term}에 일치하는 나라는 {countries}개국입니다.',
  },
  'search.announce.selected': '{name}이(가) 선택되었습니다.',
  'search.announce.framing':
    '{name}이(가) 선택되었습니다. 지도가 그 위치로 맞춰지고 있습니다.',
  'search.announce.unframed': '{name}이(가) 선택되었습니다. {reason}',
  'search.empty.title': '기록에 아직 아무것도 없습니다',
  'search.empty.body':
    '나라 이름이나 두 글자 국가 코드를 입력하면 지도에서 찾을 수 있습니다.',
  'search.empty.noMatchTitle': '“{term}”에 일치하는 나라가 없습니다',
  'search.empty.noMatchBody':
    '철자를 확인하거나 두 글자 코드를 시도해 보세요. PT를 입력하면 포르투갈이 나옵니다. 가 본 적이 있든 없든 전체 {countries}개국을 검색할 수 있습니다.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': '나의 기록',
  'actions.visit.absent.title': '방문하지 않음',
  'actions.visit.absent.caption': '여행 없이 남기는 방문 기록입니다.',
  'actions.visit.title': '방문함',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': '리스트에 없음',
  'actions.goal.absent.caption': '언젠가 가려고 마음먹은 곳.',
  'actions.goal.title': '버킷 리스트에 있음',
  'actions.goal.waiting': '차례를 기다리고 있습니다.',
  'actions.goal.target': '{year}년이 목표입니다.',
  'actions.goal.achieved.title': '리스트에서 달성함',
  'actions.goal.achieved.caption':
    '그곳에 도착했습니다. 이 항목은 기록으로 남습니다.',

  'actions.button.remove': '지우기',
  'actions.button.mark': '방문 표시',
  'actions.button.add': '리스트에 추가',
  'actions.visit.remove.name': '지우기 — 아틀라스에서 {name} 제거',
  'actions.visit.remove.busy': '아틀라스에서 {name}을(를) 지우는 중',
  'actions.visit.add.name': '방문 표시 — {name}',
  'actions.visit.add.busy': '{name}을(를) 방문한 곳으로 표시하는 중',
  'actions.goal.remove.name': '지우기 — 버킷 리스트에서 {name} 제거',
  'actions.goal.remove.busy': '버킷 리스트에서 {name}을(를) 지우는 중',
  'actions.goal.add.name': '리스트에 추가 — {name}',
  'actions.goal.add.busy': '{name}을(를) 버킷 리스트에 추가하는 중',

  'actions.hint':
    '두 동작 모두 바로 반영되며, 둘 다 여기서 되돌릴 수 있습니다.',
  'actions.offline':
    '기기가 서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.',
  'actions.toast.marked': '방문한 곳으로 표시했습니다',
  'actions.toast.markedBody': '{name}이(가) 아틀라스에 올라갔습니다.',
  'actions.toast.markFailed': '{name}을(를) 표시하지 못했습니다',
  'actions.toast.unmarked': '아틀라스에서 지웠습니다',
  'actions.toast.unmarkedBody':
    '{name}은(는) 더 이상 방문한 곳으로 표시되지 않습니다.',
  'actions.toast.unmarkFailed': '{name}을(를) 지우지 못했습니다',
  'actions.toast.listed': '버킷 리스트에 추가했습니다',
  'actions.toast.listedBody': '{name}은(는) 언젠가 가려는 곳입니다.',
  'actions.toast.listFailed': '{name}을(를) 추가하지 못했습니다',
  'actions.toast.unlisted': '버킷 리스트에서 지웠습니다',
  'actions.toast.unlistedBody': '{name}은(는) 더 이상 리스트에 없습니다.',
  'actions.toast.unlistFailed': '{name}을(를) 지우지 못했습니다',
  'actions.toast.fallback':
    '변경 사항이 서버에 닿지 못했습니다. 잠시 후 다시 시도해 주세요.',

  'actions.confirm.visit.title': '아틀라스에서 {name}을(를) 지울까요?',
  'actions.confirm.visit.body': {
    other:
      '기록된 방문 {visits}회{dates}{note}가 지워집니다. 여행과 저장한 장소에는 영향이 없습니다.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': '와 함께 적어 둔 메모',
  'actions.confirm.goal.title': '버킷 리스트에서 {name}을(를) 지울까요?',
  'actions.confirm.goal.body':
    '이미 달성한 항목이라, 그곳에 도착했다는 기록도 함께 지워집니다. 아틀라스와 여행에는 영향이 없습니다.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { other: '워크스페이스 여행' },
  'card.visits': { other: '방문' },
  'card.places': { other: '워크스페이스 장소' },
  'card.firstTrip': '첫 여행',
  'card.lastTrip': '마지막 여행',
  'card.firstVisit': '첫 방문',
  'card.lastVisit': '마지막 방문',
  'card.absent': '기록 없음',
  'card.loading': '이 나라를 불러오는 중',
  'card.loadingNamed': '{name}을(를) 불러오는 중',
  'card.error.body': '이 수치를 불러오지 못했습니다. 잃어버린 것은 없습니다.',
  'card.error.retry': '다시 시도',
  'overlay.close': '{name} 닫기',
  'regions.label': '지역',
  'regions.hint': '지역을 추가하면 {country}도 방문한 국가로 표시됩니다.',
  'regions.keeps':
    '지역을 삭제해도 아틀라스에서 {country}는 삭제되지 않습니다.',
  'regions.keeps.unvisited':
    '이 지역들은 기록에 남습니다. {country}를 방문한 국가로 표시하거나 지역을 추가하면 지도에 다시 나타납니다.',
  'regions.empty.title': '아직 기록된 지역이 없습니다',
  'regions.empty.body': '{country}에서 방문한 주, 도 또는 지역을 추가하세요.',
  'regions.input.label': '{country}의 지역 추가',
  'regions.input.placeholder': '예: 바이에른',
  'regions.add': '지역 추가',
  'regions.adding': '{region} 추가 중',
  'regions.remove': '{region} 삭제',
  'regions.loading': '지역 불러오는 중',
  'regions.status.added': '{region} 추가됨',
  'regions.status.exists': '{region}은 이미 기록되어 있습니다',
  'regions.status.removed': '{region} 삭제됨',
  'regions.status.addedCountry':
    '{region} 추가됨. {country}도 방문한 국가로 표시되었습니다.',
  'regions.error.invalid': '지역 이름을 입력하세요.',
  'regions.error.hidden':
    '이름에 허용되지 않는 문자가 있습니다. 삭제하고 다시 시도하세요.',
  'regions.error.load': '{country}의 지역을 불러오지 못했습니다.',
  'regions.error.add': '{region}을 추가하지 못했습니다. 다시 시도하세요.',
  'regions.error.remove': '{region}을 삭제하지 못했습니다. 다시 시도하세요.',
  'regions.error.full':
    '{limit}개 지역을 기록했습니다. 다른 지역을 추가하려면 하나를 삭제하세요.',
  'regions.reload': '지역 다시 불러오기',
  'actions.confirm.visitRegions.body': {
    other: '{history}{country}에서 기록한 지역 {count}개는 기록에 남습니다.',
  },
} satisfies TranslationOf<typeof En>

export default messages
