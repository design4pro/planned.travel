/**
 * The public pages' copy, in ko.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **표기.** 제품명은 로마자를 유지한다.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': '무료로 시작하기',
  'action.signIn': '로그인',
  'action.pricing': '요금',
  'action.seePricing': '요금 보기',
  'action.skipToContent': '본문으로 건너뛰기',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — 홈',
  'nav.onThisPage': '이 페이지의 목차',
  'anchor.planner': '플래너',
  'anchor.modules': '모듈',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': '{day}일에 놓기',
  'legal.summaryNote':
    '요약은 읽히기 위해 있습니다. 실제로 적용되는 것은 아래 조항입니다.',
  'visual.daysTravelled': '여행 일수',
  'visual.acrossEveryTrip': '모든 여행 합계',
  'visual.mapFilled': '지도의 {percent}% 채움',
  'visual.previewSummary':
    'planned.travel 대시보드 미리보기: 다음 여행의 날짜와 동행 인원, 장소 수, 방문한 나라와 여행 수, 여행 일수 합계, 여행 경로 지도, 그리고 다가오는 예약 두 건.',
  'visual.placesMapped': {
    other: '지도에 {value}곳',
  },
  'visual.splitWays': {
    other: '{value}명 분할',
  },
  'visual.tripTotal': '여행 총액',
  'visual.paidSplit': '{who} 결제 · {split}',
  'visual.nextUp': '다음 일정',
  'visual.ofTotal': '{total}개 중 {done}개',
  'visual.awaitingReply': '답변 대기 중',
  'visual.upcoming': '다가오는 일정',
  'visual.days': {
    other: '{value}일',
  },
  'visual.places': {
    other: '{value}곳',
  },
  'visual.transfersLeft': {
    other: '송금 {value}건 남음',
  },

  'legal.badge.version': '버전 {version}',
  'legal.badge.effective': '{updated} 시행',
  'legal.notice.title': '이것은 서식이며, 법률 조언이 아닙니다',
  'legal.notice.body':
    '작은 여행 계획 서비스에 실제로 쓸 만한 출발점이 되도록 쉬운 영어로 썼고, 사업자가 채워야 하는 빈칸은 모두 표시해 두었습니다. 고객을 한 명이라도 받기 전에, 해당 관할의 자격 있는 변호사에게 검토와 수정을 받으세요. 여기에 planned.travel이 보유한 인증, 감사, 준수 기준을 주장하는 내용은 없습니다.',
  'legal.contents': '목차',
  'legal.shortVersion': '요약',
  'legal.both': '두 문서는 함께 적용됩니다.',

  'landing.plans.title': '무료로 시작하고, 값을 할 때 결제하세요.',
  'landing.plans.lede':
    '모든 요금제에 날짜별 플래너, 지도, 예산, 준비물 목록이 들어 있습니다. 유료 요금제는 월 {price}부터 무제한 여행, 예약, 일지, 오프라인 지도, 내보내기를 열어 줍니다.',
  'landing.plans.ledeFree':
    '모든 요금제에 날짜별 플래너, 지도, 예산, 준비물 목록이 들어 있습니다. 유료 요금제는 무제한 여행, 예약, 일지, 오프라인 지도, 내보내기를 열어 줍니다.',
  'landing.plans.compare': '모든 한도를 한 줄씩 비교하기',
  'landing.questions.title': '질문에 똑바로 답합니다',
  'landing.questions.lede':
    '시작하기 전에 사람들이 정말로 궁금해하는 여섯 가지.',
  'cta.heading': '다음 여행은 이미 제대로 계획할 값을 합니다',
  'cta.lede':
    '여행 두 개, 지도 전체, 날짜별 일정, 준비물 목록. 무료이고, 카드도 필요 없고, 남은 시간을 세지도 않습니다.',
  'landing.faq.seats.q': '같이 가는 사람들도 결제해야 하나요?',
  'landing.faq.seats.a':
    '아니요. {crew} 워크스페이스로 초대한 사람은 그 워크스페이스의 인원에 포함됩니다. 각자 자기 계정으로 로그인하고, 당신이 추가한 여행만 봅니다.',
  'landing.faq.phone.q': '휴대폰에서도 제대로 되나요?',
  'landing.faq.phone.a':
    '됩니다. 모바일 레이아웃은 데스크톱을 눌러 줄인 것이 아니라 따로 그렸고, 웹사이트이므로 설치할 것도 업데이트할 것도 없습니다.',
  'landing.faq.offline.q': '신호가 없어도 지도를 쓸 수 있나요?',
  'landing.faq.offline.a':
    '{solo}와 {crew}는 떠나기 전에 지역을 내려받을 수 있어, 데이터 없이 도착해도 지도가 그려집니다. 여행 자체를 편집하려면 연결이 필요합니다.',
  'landing.faq.privacy.q': '제 여행은 누가 볼 수 있나요?',
  'landing.faq.privacy.a':
    '여행은 하나의 워크스페이스에 속하고, 그 워크스페이스로 초대된 사람만 열 수 있습니다. 공개되는 것은 없고, 탐색 피드도 없고, 기본적으로 누구와도 공유되지 않습니다.',
  'landing.faq.stop.q': '결제를 멈추면 제 여행은 어떻게 되나요?',
  'landing.faq.stop.a':
    '삭제되는 것은 없습니다. 유료 모듈이 잠기고, 여행은 있던 자리에 그대로 있고, 구독하는 순간 전부 다시 열립니다. {free} 요금제는 계속 무료이고, 남은 시간을 세지 않습니다.',

  'action.startPlanning': '무료로 계획 시작하기',
  'cta.comparePlans': '요금제 비교하기',
  'landing.hero.eyebrow': '함께 세우는 여행 계획',
  'landing.hero.title': '여행을 계획하세요.',
  'landing.hero.titleQuiet': '스프레드시트가 아니라.',
  'landing.hero.lede':
    '실제 지도 위의 하나의 일정. 함께 가는 모두와 실시간으로 공유되고, 예약과 비용과 준비물 목록이 거기에 붙습니다.',
  'landing.hero.secondary': '얼마인지 보기',
  'landing.trust.noCard': '시작할 때 카드 필요 없음',
  'landing.trust.noAds': '광고 없음, 제휴 링크 없음',
  'landing.trust.export': '언제든 전부 내보내기',

  'proof.eyebrow': '똑바른 대답',
  'proof.title': '추천사는 없습니다. 아직 받을 만한 일을 하지 못했으니까요',
  'proof.lede':
    'planned.travel은 새 서비스입니다. 인용을 지어내거나 남의 로고를 빌려 오는 대신, 무엇을 하고 누구를 위한 것이며 당신에게 결코 하지 않을 일을 그대로 적어 둡니다.',
  'proof.who.label': '누구를 위한 것인가',
  'proof.who.heading': '결국 그 표를 만들게 되는 사람을 위해',
  'proof.who.body':
    '스크린샷 여섯 장, 단체 대화방 세 개, 3월부터 아무도 열지 않은 공용 메모. 그게 아니라 모두가 볼 수 있는 하나의 계획을 원하는 커플, 가족, 친구들을 위해.',
  'proof.not.label': '무엇이 아닌가',
  'proof.not.heading': '예약 사이트가 아니고, 그런 곳에 팔 물건도 아닙니다',
  'proof.not.body':
    '수수료를 받지 않고, 광고를 싣지 않고, 제휴 링크를 두지 않습니다. 그래서 어느 화면에서도 특정 호텔로 조용히 몰아가는 것이 없습니다. 돈을 내는 쪽이 당신이니, 저희는 당신을 위해 일합니다.',
  'proof.where.label': '당신의 것이 놓이는 곳',
  'proof.where.heading': 'Cloudflare 위, 당신의 워크스페이스 안에',
  'proof.where.body':
    '여행 데이터는 당신의 워크스페이스로 한정된 데이터베이스에, 파일은 저희 자체 오브젝트 스토리지에 있고, 둘 다 Cloudflare 엣지에서 전달됩니다. 결제와 인보이스는 기록상 판매자인 Polar가 처리하므로, 카드 번호는 저희에게 오지 않습니다.',
  'proof.promise.ads.title': '광고 없음, 서드파티 분석 없음',
  'proof.promise.ads.body':
    '이 페이지에는 다른 누군가를 위해 당신을 측정하는 것이 없습니다.',
  'proof.promise.sold.title': '당신의 여행은 절대 팔거나 빌려주지 않습니다',
  'proof.promise.sold.body': '광고주에게도, 여행사에게도, 누구에게도.',
  'proof.promise.leave.title': '언제든 떠나세요. 전부 가지고',
  'proof.promise.leave.body':
    'PDF 일정표, 캘린더 파일, 그리고 장소는 GeoJSON으로.',
  'proof.certification':
    '지금 저희는 어떤 보안 인증도 없고, 있는 것처럼 쓰지도 않겠습니다. planned.travel이 어떤 표준에 따라 감사를 받으면, 그 표준과 감사인, 날짜를 바로 이 자리에 적겠습니다. 그 전에는 적지 않습니다.',

  'feature.modules.title': '여행의 나머지까지, 정리 완료',
  'feature.modules.lede':
    '모듈마다 한 가지 일을 제대로 하고, 그 결과를 다른 모듈에 넘깁니다. 다음 릴리스를 기다리는 빈 탭은 하나도 없습니다.',
  'feature.module.lists.benefit': '변환 플러그 없이 도착하는 사람이 없습니다.',
  'feature.module.lists.detail':
    '짐, 할 일, 장 볼 것, 서류. 용도마다 목록 하나씩, 함께 가는 모두와 공유하며 그때그때 체크합니다.',
  'feature.module.journal.name': '일지',
  'feature.module.journal.benefit': '여행이 폴더가 아니라 이야기가 됩니다.',
  'feature.module.journal.detail':
    '날짜순 기록에 찍은 사진, 있던 장소, 날씨, 그리고 그날이 실제로 어땠는지가 함께 남습니다.',
  'feature.module.atlas.benefit': '다녀온 모든 곳을 한 장의 지도에.',
  'feature.module.atlas.detail':
    '나라를 방문 완료로 표시하면 세계 지도에 올라갑니다. 첫 방문, 가장 최근, 몇 번 다시 갔는지까지.',
  'feature.module.vacay.benefit': '항공권보다 휴가를 먼저.',
  'feature.module.vacay.detail':
    '자리를 비우는 날을 표시하면 한 해가 채워집니다. 주말, 공휴일, 그리고 다른 사람들의 휴가까지 같은 표 안에.',
  'feature.module.collab.benefit': '결정은 여행과 함께 남습니다.',
  'feature.module.collab.detail':
    '여행마다 대화 하나, 모두가 기억해야 할 것은 공용 메모로, 저녁 메뉴가 안 정해질 때는 투표로.',
  'feature.module.files.benefit': '탑승권은 찾을 수 있는 곳에.',
  'feature.module.files.detail':
    '확인서, 티켓, 보험 서류, 영수증이 각자 속한 여행에 첨부됩니다. 받은 편지함에 묻히지 않습니다.',

  'feature.planner.title': '실제 지도 위에 그리는 날짜별 일정',
  'feature.planner.lede':
    '가고 싶은 곳을 모아 두고 원하는 날짜로 끌어다 놓으세요. 지도가 그때그때 경로를 다시 그려 주니, 오전 일정이 도시를 두 번 横断하게 만든다면 바로 보입니다.',
  'feature.planner.point.days':
    '하루에 한 열씩, 날짜와 날씨, 그날 묵는 곳까지 함께.',
  'feature.planner.point.unscheduled':
    '날짜가 없는 장소는 자기 열에서 날짜를 받을 때까지 기다립니다.',
  'feature.planner.point.crew':
    '{crew}에서는 모두가 동시에 끌어 놓습니다. 실시간 커서, 즉시 동기화, 새로고침 없음.',
  'feature.planner.point.tiles':
    '벡터 타일은 저희 저장소에서 직접 제공합니다. 어떤 지도 업체도 당신의 계획을 들여다보지 않습니다.',
  'feature.costs.title': '정말로 정산까지 끝나는 공동 경비',
  'feature.costs.lede':
    '쓴 돈은 여행의 통화로 기록하고, 실제로 합의한 방식대로 나누고, 전부를 정리하는 가장 짧은 송금 조합을 확인하세요.',
  'feature.costs.point.split':
    '균등, 지분별, 정확한 금액 중에서. 여행 단위가 아니라 지출 단위로 정합니다.',
  'feature.costs.point.currency':
    '모두 하나의 여행 통화로 환산되니 합계가 의미를 가집니다.',
  'feature.costs.point.settle':
    '정산 화면은 누가 누구에게 내는지 알려 주고, 송금이 끝나면 기록합니다.',
  'feature.costs.point.receipt':
    '영수증을 지출에 붙여 두면 금액에 언제나 근거가 남습니다.',
  'feature.book.title': '모든 예약을, 문 앞에서 필요한 번호와 함께',
  'feature.book.lede':
    '숙소, 식당 예약, 투어, 입장권을 한 목록에. 그 사이를 잇는 항공, 기차, 페리도 나란히, 각각 확인 번호와 해당 날짜를 달고 있습니다.',
  'feature.book.point.legs':
    '이동 구간에는 좌석, 승강장, 터미널, 예약 번호가 들어갑니다.',
  'feature.book.point.day':
    '예약은 날짜에 묶여 있어, 다시 입력하지 않아도 일정에 나타납니다.',
  'feature.book.point.states':
    '요청, 확정, 취소는 각각 별개의 상태이지, 메모 한 줄이 아닙니다.',
  'feature.book.point.export':
    '떠나기 전에 여행 전체를 PDF 일정표나 캘린더 파일로 내보내세요.',

  'pricing.faq.trial.q': '무료 체험이 끝나면 어떻게 되나요?',
  'pricing.faq.trial.a':
    '무료 체험은 그대로 유료 플랜으로 넘어갑니다. Polar는 체험이 시작될 때 결제 수단을 등록하고 체험이 끝나는 날 결제합니다. 그 전에 해지하면 결제되지 않습니다. 어느 경우에도 삭제되는 것은 없습니다. 유료 모듈이 잠기고, 여행은 그대로 남아 있으며, 구독하는 순간 모두 다시 열립니다.',
  'pricing.faq.seller.q': '실제로는 누구에게서 구매하는 건가요?',
  'pricing.faq.seller.a':
    'Polar에게서입니다. Polar는 저희의 공식 판매자로, 리셀러로서 구독을 여러분에게 판매하고 결제를 받고 자기 이름으로 청구서를 발행하며, 각 국가가 부과하는 판매세나 부가세를 산정·징수·납부합니다. 환불과 카드 분쟁도 Polar와 처리합니다. 서비스를 운영하고 메일에 답하는 것은 여전히 저희입니다.',
  'pricing.faq.change.q': '여행 중간에 플랜을 바꿀 수 있나요?',
  'pricing.faq.change.a':
    '가능합니다. 상위 플랜 변경은 즉시 적용되고 일 단위로 정산됩니다. 하위 플랜 변경은 이미 결제한 기간이 끝난 뒤부터 적용되므로, 결제한 접근 권한을 잃는 일은 없습니다.',
  'pricing.faq.seats.q': '{crew} 요금제의 인원별 청구는 어떻게 되나요?',
  'pricing.faq.seats.a':
    '실제로 채운 좌석만큼 지불하며, 수는 언제든 바꿀 수 있습니다. 응답이 없는 초대도 좌석으로 계산되므로, 워크스페이스가 조용히 플랜을 넘길 일은 없습니다.',
  'pricing.faq.guests.q': '함께 여행하는 사람도 각자 구독이 필요한가요?',
  'pricing.faq.guests.a':
    '아닙니다. {crew} 워크스페이스로 초대한 모든 사람은 그 좌석으로 포함됩니다. 각자의 계정으로 로그인하고, 추가된 여행만 봅니다.',
  'pricing.faq.storage.q': '저장 용량에는 무엇이 포함되나요?',
  'pricing.faq.storage.a':
    '사진, 티켓, 확인서, 그리고 여행에 첨부한 모든 파일입니다. 지도 타일과 앱 자체는 절대 계산되지 않습니다. 무엇이 용량을 쓰는지는 설정에서 정확히 볼 수 있습니다.',
  'pricing.faq.export.q': '제 데이터를 가져갈 수 있나요?',
  'pricing.faq.export.a':
    '언제든 가능합니다. 여행마다 PDF 일정과 캘린더 파일로 내보낼 수 있고, 장소는 GeoJSON으로 내보낼 수 있습니다. 여러분의 여행이지, 저희 것이 아닙니다.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': '카드 없이, 기한 없이, 카운트다운 없이',
  'pricing.card.yearlyPerSeat': '1인당 연 {amount}, 한 번에 청구',
  'pricing.card.yearly': '연 1회 {amount} 청구',
  'pricing.card.seatsUnlimited': '멤버 수 무제한',
  'pricing.card.tripsUnlimited': '여행 수 무제한',
  'pricing.card.startFree': '무료로 시작',
  'pricing.card.startTrial': '{plan} 사용해 보기',
  'pricing.card.popular': '가장 많이 선택',
  'pricing.card.noteYearly': '연 1회 청구합니다. 두 달은 저희가 부담합니다.',
  'pricing.card.noteMonthly':
    '월 단위로 청구합니다. 언제든 변경하거나 해지할 수 있습니다.',
  'pricing.card.trial': {
    other: '{value}일 무료, 카드 선등록, 종료 시 청구',
  },
  'pricing.card.seatsUpTo': {
    other: '최대 {value}명',
  },
  'pricing.card.trips': {
    other: '동시에 여행 {value}개',
  },

  'pricing.feature.storage': '사진과 문서용 {size}',
  'pricing.feature.storageShared': '사진과 문서용 공유 {size}',
  'pricing.feature.free.tripsDetail':
    '하나를 보관하면 다음 여행을 시작할 수 있어요',
  'pricing.feature.solo.modules': '모든 계획 모듈',
  'pricing.feature.solo.modulesDetail': '예약, 일지, 예산, 준비물',
  'pricing.feature.solo.offlineDetail': '떠나기 전에 지역을 내려받기',
  'pricing.feature.crew.membersDetail': '멤버 단위로 청구, 언제든 변경',
  'pricing.feature.crew.realtimeDetail': '실시간 커서와 즉시 동기화',
  'pricing.feature.crew.supportDetail': '영업일 하루 안에 사람이 답변',

  'pricing.hero.eyebrow': '여행 두 개는 계속 무료',
  'pricing.hero.title': '제대로 계획하세요.',
  'pricing.hero.titleQuiet': '쓴 만큼 내세요.',
  'pricing.hero.lede':
    '여행 두 개를 무료로 계획하세요. 혼자라면 모든 모듈을 열고, 함께라면 같은 일정을 동시에 편집하세요.',
  'pricing.hero.taxNote':
    '가격은 미국 달러이며 판매세와 부가세는 포함되지 않습니다. Polar가 공식 판매자입니다. 청구서에 표시되는 곳도 Polar이며, 각 국가의 세액을 계산해 결제 시 더하고 납부합니다. 해지는 제품 안에서 언제든 가능합니다.',
  'pricing.compare.eyebrow': '나란히',
  'pricing.compare.title': '모든 한도 비교',
  'pricing.compare.lede':
    '결제 시스템이 읽는 것과 같은 카탈로그에서 만든 하나의 표입니다. 어떤 행이 모듈이 포함된다고 하면, 권한 검사도 같게 답합니다.',
  'pricing.compare.caption': '세 플랜 전체의 기능과 한도 비교',
  'pricing.compare.feature': '기능',
  'pricing.compare.limits': '한도',
  'pricing.compare.included': '포함',
  'pricing.compare.notIncluded': '미포함',
  'pricing.compare.includedIn': '{plan}에 포함',
  'pricing.compare.notIn': '{plan}에는 없음',
  'pricing.questions.eyebrow': '묻기 전에',
  'pricing.questions.title': '질문과 답',
  'pricing.questions.lede': '결제, 무료 체험, 그리고 데이터를 되가져가는 방법.',
  'pricing.cta.secondary': '어떻게 작동하는지 보기',
  'pricing.module.itinerary': '하루하루 일정',
  'pricing.module.map': '인터랙티브 지도',
  'pricing.module.budget': '예산과 비용 분담',
  'pricing.module.packing': '짐과 할 일 목록',
  'pricing.module.reservations': '예약',
  'pricing.module.journal': '여행 일지',
  'pricing.module.atlas': '방문한 나라 지도',
  'pricing.module.collaboration': '함께 갈 사람 초대',
  'pricing.module.realtime': '실시간 공동 작업',
  'pricing.module.offlineMaps': '오프라인 지도',
  'pricing.module.pdfExport': 'PDF·캘린더 내보내기',
  'pricing.module.prioritySupport': '우선 지원',

  'anchor.plans': '요금제',
  'anchor.compare': '비교',
  'anchor.questions': '자주 묻는 질문',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    '일정, 지도, 예약, 비용, 준비물 목록을 한곳에서 — 함께 떠나는 모든 사람과 공유하세요.',
  'footer.attribution':
    'Cloudflare Workers에서 실행됩니다. 지도 데이터 © OpenStreetMap 기여자. 판매와 청구는 기록상 판매자인 Polar가 담당합니다.',
  'footer.column.product': '제품',
  'footer.column.account': '계정',
  'footer.link.overview': '개요',
  'footer.link.everyModule': '모든 모듈',
  'footer.link.dayPlanner': '일정 플래너',
  'footer.link.sharedCosts': '비용 분담',
  'footer.link.reservations': '예약',
  'footer.link.atlasJournal': '아틀라스와 여행 일지',
  'footer.link.createAccount': '계정 만들기',
  'footer.link.terms': '서비스 약관',
  'footer.link.privacy': '개인정보 처리 고지',
} satisfies TranslationOf<typeof En>

export default messages
