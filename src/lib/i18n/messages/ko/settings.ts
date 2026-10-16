/**
 * The settings screens — profile, language, appearance, security,
 * notifications, workspace and billing, in Korean.
 *
 * Authored from `../en/settings`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Korean has no plural inflection, so `Intl.PluralRules` reports the single
 * category `other` and every `one`/`other` pair English writes collapses to one
 * branch. Spacing is the thing to get right instead: a counter noun (개, 명, 박,
 * 일) is written separately from the numeral, and a particle is chosen for the
 * noun it follows.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  'page.eyebrow': '계정',
  'page.title': '설정',
  'page.description':
    '나와 워크스페이스, 그리고 planned.travel이 움직이는 방식에 관한 모든 것',
  'page.error': '설정을 불러오지 못했어요',
  'nav.label': '설정 섹션',
  'nav.profile': '프로필',
  'nav.profile.hint': '나, 그리고 날짜와 금액을 읽는 방식',
  'nav.language': '언어',
  'nav.language.hint': '모든 화면이 말하는 언어',
  'nav.appearance': '화면',
  'nav.appearance.hint': '테마와 모션, 지도',
  'nav.security': '보안',
  'nav.security.hint': '비밀번호, 2단계 인증, 패스키',
  'nav.notifications': '알림',
  'nav.notifications.hint': '알림함과 이메일, 푸시',
  'nav.workspace': '워크스페이스',
  'nav.workspace.hint': '멤버와 공용 기본값',
  'nav.billing': '결제',
  'nav.billing.hint': '플랜과 좌석, 청구서',
  'action.save': '변경 사항 저장',
  'error.retryBody':
    '잃어버린 것은 없어요. 연결을 확인하고 다시 시도해 주세요.',
  'role.owner': '소유자',
  'role.admin': '관리자',
  'role.member': '멤버',
  'regional.workspaceDefault': '워크스페이스 기본값 — {value}',
  'regional.currency.AUD': '호주 달러',
  'regional.currency.CAD': '캐나다 달러',
  'regional.currency.CHF': '스위스 프랑',
  'regional.currency.EUR': '유로',
  'regional.currency.GBP': '영국 파운드',
  'regional.currency.JPY': '일본 엔',
  'regional.currency.PLN': '폴란드 즈워티',
  'regional.currency.SEK': '스웨덴 크로나',
  'regional.currency.USD': '미국 달러',
  'regional.distance.metric': '킬로미터',
  'regional.distance.imperial': '마일',
  'profile.error': '프로필을 불러오지 못했어요',
  'profile.account.title': '내 계정',
  'profile.account.description':
    '이름과 이메일은 로그인에 쓰는 계정에서 가져와요.',
  'profile.email.verified': '이메일 확인 완료',
  'profile.email.unverified': '이메일 미확인',
  'profile.twoFactor.on': '2단계 인증 켬',
  'profile.figure.workspace': '워크스페이스',
  'profile.figure.role': '역할',
  'profile.figure.joined': '가입일',
  'profile.figure.joinedUnknown': '기록 없음',
  'profile.regional.title': '날짜와 금액, 단위',
  'profile.regional.description':
    '여기서 고른 값은 나에게만 워크스페이스 기본값보다 앞서요. 기본값으로 두면 워크스페이스를 따라가요.',
  'profile.regional.saving': '설정을 저장하는 중',
  'profile.regional.saved': '설정을 저장했어요',
  'profile.regional.saveFailed': '설정을 저장하지 못했어요',
  'profile.language.label': '언어',
  'profile.language.hint':
    '전용 화면에서 고를 수 있어요. 모든 언어가 자기 문자로 적혀 있어요.',
  'profile.language.action': '바꾸기',
  'profile.timezone.label': '시간대',
  'profile.timezone.hint': '출발과 도착 시간은 이 기준으로 보여 드려요.',
  'profile.currency.label': '통화',
  'profile.currency.hint':
    '새 여행은 이 통화로 시작해요. 여행마다 따로 바꿀 수 있어요.',
  'profile.dateFormat.label': '날짜 형식',
  'profile.weekStart.label': '주의 시작',
  'profile.weekStart.hint': '휴가 연간 달력을 포함해 모든 달력에 적용돼요.',
  'profile.distance.label': '거리',
  'language.error': '언어 설정을 불러오지 못했어요',
  'language.section.title': '언어',
  'language.section.description':
    '모든 화면과 버튼, 날짜가 여기서 고른 언어로 읽혀요. 스물세 개 언어가 각자의 문자로 적혀 있어요.',
  'language.label': '언어 고르기',
  'language.followWorkspace': '워크스페이스 따르기',
  'language.state.yours': '내 언어',
  'language.state.workspace': '워크스페이스에서 온 값',
  'language.state.hint.override':
    '내가 직접 고른 언어예요. 로그인하는 모든 기기에서 나에게만 적용돼요.',
  'language.state.hint.workspace':
    '나만의 언어를 정하지 않았으니 워크스페이스에 설정된 언어로 읽게 돼요. 소유자나 관리자가 워크스페이스에서 바꿀 수 있어요.',
  /**
   * Spoken in the language just chosen, so it has to read as Korean written
   * by a Korean rather than as a translated English sentence.
   */
  'language.saved': '{language} — 이제 planned.travel이 쓰는 언어예요',
  'language.saveFailed': '언어를 바꾸지 못했어요',
  'language.saveFailedBody':
    '잃어버린 것은 없고 지금도 {language} 화면을 보고 계세요. 연결을 확인한 뒤 다시 골라 주세요.',
  'language.reload.title': '언어를 저장했어요',
  'language.reload.body':
    '이 페이지가 {language} 화면으로 바꾸는 것을 끝내지 못했어요. 새로 고치면 새 언어로 읽을 수 있어요.',
  'language.sample.title': '날짜와 숫자가 보이는 방식',
  'language.sample.description':
    '같은 값 세 개를 이 언어가 쓰는 방식으로 적어 봤어요.',
  'language.sample.date': '날짜',
  'language.sample.number': '숫자',
  'language.sample.money': '금액',
  'language.legal':
    '이용약관과 개인정보 처리방침은 영어로만 게시해요. 그 밖의 모든 것은 번역돼 있어요.',
  'appearance.error': '화면 설정을 불러오지 못했어요',
  'appearance.theme.title': '테마',
  'appearance.theme.description':
    '두 테마 모두 뒤집은 것이 아니라 따로 설계했어요. 더 편하게 읽히는 쪽을 골라 주세요.',
  'appearance.theme.light': '라이트',
  'appearance.theme.lightHint': '하루 종일 따뜻한 종이',
  'appearance.theme.dark': '다크',
  'appearance.theme.darkHint': '검정이 아닌 따뜻한 숯빛',
  'appearance.theme.system': '시스템',
  'appearance.theme.systemHint': '기기를 따라가요',
  'appearance.theme.showing': '지금은 {palette} 팔레트를 보고 계세요.',
  'appearance.theme.showingSystem':
    '지금은 기기를 따라 {palette} 팔레트를 보고 계세요.',
  'appearance.palette.light': '라이트',
  'appearance.palette.dark': '다크',
  'appearance.motion.title': '모션과 지도',
  'appearance.motion.label': '모션 줄이기',
  'appearance.motion.hint':
    '등장 애니메이션을 단순한 페이드로 바꿔요. 운영체제의 모션 줄이기 설정도 항상 존중해요.',
  'appearance.map.label': '지도 스타일',
  'appearance.map.hint': '플래너와 아틀라스에서 쓰는 바탕 지도예요.',
  'appearance.map.workspace': '워크스페이스 따르기',
  'appearance.map.workspaceHint': '워크스페이스 소유자가 고른 스타일이에요.',
  'appearance.map.auto': '자동',
  'appearance.map.autoHint': '라이트나 다크 테마를 따라가요.',
  'appearance.map.paper': '종이',
  'appearance.map.paperHint': '어떤 테마에서도 따뜻하고 밝아요.',
  'appearance.map.charcoal': '숯',
  'appearance.map.charcoalHint': '어떤 테마에서도 따뜻하고 어두워요.',
  'appearance.map.quiet': '조용한 지도',
  'appearance.map.quietHint': '도로 이름이 없어서 핀이 먼저 보여요.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': '함께 보는 화면에서',
  'appearance.privacy.codesLabel': '확인 코드는 요청할 때까지 가리기',
  'appearance.privacy.codesHint':
    '예약 번호와 확인 코드는 예약 데스크와 이동 화면에서 가려 두고, 클릭하거나 탭할 때만 보여 주며 다른 곳으로 넘어가면 다시 가립니다. 금액은 절대 가리지 않습니다.',
  'appearance.saveFailed': '그 변경은 저장되지 않았어요',
  'appearance.saveFailedBody':
    '여기서는 보이지만, 다음에 다른 기기로 로그인하면 반영되지 않아요.',
  'security.error': '보안 설정을 불러오지 못했어요',
  'security.unverified.title': '이메일 주소가 아직 확인되지 않았어요',
  'security.unverified.body':
    '비밀번호 재설정과 여행 초대는 {email} 주소로 가요. 확인하는 것이 그 주소가 내 것이라는 증명이에요.',
  'security.unverified.action': '링크 다시 보내기',
  'security.signin.title': '로그인',
  'security.signin.description':
    '본인임을 증명하는 방법이에요. 2단계 인증과 패스키는 둘 다 비밀번호 하나보다 강해요.',
  'security.email.label': '이메일 주소',
  'security.email.verified': '확인됨',
  'security.email.unverified': '미확인',
  'security.password.label': '비밀번호',
  'security.password.hint':
    '언제든 바꿀 수 있어요. 예전 비밀번호를 묻지 않고 한 번만 쓰는 링크를 보내 드려요.',
  'security.password.action': '비밀번호 변경',
  'security.twoFactor.label': '2단계 인증',
  'security.twoFactor.onHint': '새로 로그인할 때마다 인증 앱 코드가 필요해요.',
  'security.twoFactor.offHint':
    '비밀번호에 인증 앱의 여섯 자리 코드를 더할 수 있어요.',
  'security.twoFactor.on': '켬',
  'security.twoFactor.off': '끔',
  'security.twoFactor.manage': '관리',
  'security.twoFactor.enable': '켜기',
  'security.passkeys.label': '패스키',
  'security.passkeys.hint':
    '아무것도 입력하지 않고 지문이나 Face ID, 보안 키로 로그인해요.',
  'security.passkeys.action': '패스키 관리',
  'security.session.title': '이 세션',
  'security.session.description': '지금 이 글을 읽고 있는 브라우저예요.',
  'security.session.label': '로그인 계정',
  'security.session.expires': '만료 {date}',
  'security.session.expiresSoon': '곧',
  'security.session.noExpiry': '만료 기록 없음',
  'security.signOut.label': '로그아웃',
  'security.signOut.hint':
    '이 세션을 끝내고 로그인 화면으로 돌아가요. 다른 기기는 로그인 상태로 남아요.',
  'security.signOut.pending': '로그아웃하는 중',
  'security.signOut.failed': '로그아웃되지 않았어요',
  'security.signOut.failedBody': '연결을 확인하고 다시 시도해 주세요.',
  'notifications.error': '알림 설정을 불러오지 못했어요',
  'notifications.title': '알림',
  'notifications.description':
    '모든 스위치는 나에게만 적용돼요. 꺼도 그 일이 일어나지 않는 건 아니고, 알려 드리지 않게 되는 것뿐이에요.',
  'notifications.caption': '어떤 알림을 어떤 경로로 받을지',
  'notifications.event': '이벤트',
  'notifications.switch': '{event} — {channel} 알림',
  'notifications.saveFailed': '그 설정은 저장되지 않았어요',
  'notifications.saveFailedBody':
    '스위치를 원래대로 돌려 놨어요. 연결을 확인하고 다시 시도해 주세요.',
  'notifications.channel.in_app': '앱 안에서',
  'notifications.channel.in_app.hint': '상단 바의 종',
  'notifications.channel.email': '이메일',
  'notifications.channel.email.hint': '로그인에 쓰는 주소로 보내요',
  'notifications.channel.push': '푸시',
  'notifications.channel.push.hint': '허용한 기기로',
  'notifications.event.trip.invited': '여행 초대',
  'notifications.event.trip.invited.hint':
    '누군가 계획 중인 여행에 나를 넣었을 때.',
  'notifications.event.trip.updated': '계획 변경',
  'notifications.event.trip.updated.hint':
    '함께하는 여행에서 하루나 들르는 곳, 날짜가 움직였을 때.',
  'notifications.event.trip.starting_soon': '출발 알림',
  'notifications.event.trip.starting_soon.hint':
    '여행이 시작되기 며칠 전의 짧은 알림.',
  'notifications.event.reservation.reminder': '예약 알림',
  'notifications.event.reservation.reminder.hint':
    '숙소나 식당, 티켓의 날이 다가올 때.',
  'notifications.event.expense.added': '새 지출',
  'notifications.event.expense.added.hint':
    '함께하는 여행에서 누군가 쓴 돈을 기록했을 때.',
  'notifications.event.expense.settled': '정산된 잔액',
  'notifications.event.expense.settled.hint':
    '내가 함께 있던 잔액이 지급됐을 때.',
  'notifications.event.list.assigned': '맡겨진 항목',
  'notifications.event.list.assigned.hint':
    '준비물이나 할 일 목록의 항목이 내 몫이 됐을 때.',
  'notifications.event.collab.message': '여행 대화',
  'notifications.event.collab.message.hint':
    '함께 떠나는 여행에 새 메시지가 올라왔을 때.',
  'notifications.event.organization.invited': '워크스페이스 초대',
  'notifications.event.organization.invited.hint':
    '워크스페이스에 초대받았을 때.',
  'notifications.event.billing.plan_changed': '구독 변경',
  'notifications.event.billing.plan_changed.hint':
    '워크스페이스가 다른 플랜으로 바뀔 때.',
  'notifications.event.billing.invoice_paid': '결제 영수증',
  'notifications.event.billing.invoice_paid.hint':
    '워크스페이스 청구서가 결제됐을 때.',
  'notifications.event.billing.payment_failed': '결제 문제',
  'notifications.event.billing.payment_failed.hint':
    '워크스페이스 청구가 실패했을 때.',
  'workspace.error': '워크스페이스를 불러오지 못했어요',
  'workspace.summary.description': '{plan} 플랜 · {date} 생성',
  'workspace.summary.createdRecently': '최근',
  'workspace.summary.billingAction': '플랜과 결제',
  'workspace.seats.label': '쓰고 있는 좌석',
  /**
   * Korean counts the whole before the part, and each figure keeps the 석
   * counter it is measured in.
   */
  'workspace.seats.value': '{limit}석 중 {used}석',
  'workspace.seats.note':
    '처리되지 않은 초대도 좌석을 차지하니, 워크스페이스가 지불한 것보다 많은 사람을 넣을 수는 없어요.',
  'workspace.seatsFull.title': '이 플랜의 좌석이 모두 찼어요',
  'workspace.seatsFull.body':
    '{members}과 {invitations}이 {limit}석을 모두 채웠어요.',
  'workspace.seatsFull.action': '좌석 늘리기',
  'workspace.members.count': { other: '멤버 {value}명' },
  'workspace.invitations.count': { other: '대기 중인 초대 {value}건' },
  'workspace.members.title': '멤버',
  'workspace.members.description':
    '이 워크스페이스의 여행과 금액, 파일을 볼 수 있는 사람 모두예요.',
  'workspace.members.tableLabel': '이 워크스페이스의 멤버',
  'workspace.members.person': '사람',
  'workspace.members.role': '역할',
  'workspace.members.joined': '참여',
  'workspace.invitations.title': '초대',
  'workspace.invitations.description':
    '초대는 받았지만 아직 참여하지 않은 사람들이에요.',
  'workspace.invitations.emptyTitle': '처리되지 않은 초대가 없어요',
  'workspace.invitations.emptyBody':
    '이 워크스페이스에 초대한 사람은 모두 이미 참여했어요.',
  'workspace.invitations.expires': '만료 {date}',
  'workspace.invitations.expiresSoon': '곧',
  'workspace.defaults.title': '공용 기본값',
  'workspace.defaults.description':
    '새 여행과 새 멤버가 처음 쓰는 값이에요. 누구나 프로필에서 자기 것만 바꿀 수 있어요.',
  'workspace.defaults.readOnly': '읽기 전용',
  'workspace.defaults.saving': '워크스페이스 기본값을 저장하는 중',
  'workspace.defaults.saved': '워크스페이스 기본값을 저장했어요',
  'workspace.defaults.saveFailed': '워크스페이스 기본값을 저장하지 못했어요',
  'workspace.defaults.saveFailedBody':
    '소유자나 관리자만 바꿀 수 있어요. 연결을 확인한 뒤 다시 시도해 주세요.',
  'workspace.currency.label': '기본 통화',
  'workspace.currency.hint': '새 여행의 예산은 이 통화로 잡아요.',
  'workspace.language.label': '언어',
  'workspace.language.hint': '자기 언어를 고르지 않은 멤버가 읽는 언어예요.',
  'workspace.timezone.label': '시간대',
  'workspace.dateFormat.label': '날짜 형식',
  'workspace.weekStart.label': '주의 시작',
  'workspace.distance.label': '거리',
  'billing.error': '결제 정보를 불러오지 못했어요',
  'billing.loading': '플랜과 영수증을 불러오는 중',
  'billing.status.none': '구독 없음',
  'billing.status.trialing': '체험 중',
  'billing.status.active': '이용 중',
  'billing.status.past_due': '결제 실패',
  'billing.status.unpaid': '미결제',
  'billing.status.paused': '일시 중지',
  'billing.status.canceled': '해지됨',
  'billing.status.incomplete': '미완료',
  'billing.status.incomplete_expired': '만료됨',
  'billing.checkout.completeTitle': '결제를 받았어요',
  'billing.checkout.completeBody':
    '새 플랜을 적용하고 있어요. Polar가 확인하는 순간 여기에 나타나요. 보통 몇 초면 끝나요.',
  'billing.checkout.cancelledTitle': '결제를 취소했어요',
  'billing.checkout.cancelledBody': '청구된 것은 없고 플랜도 그대로예요.',
  'billing.portal.backTitle': 'Polar에서 돌아왔어요',
  'billing.portal.backBody':
    '거기서 바꾼 내용은 Polar가 확인하는 대로 여기에 반영돼요.',
  'billing.refresh': '새로 고침',
  'billing.readOnly.title': '이 워크스페이스의 멤버예요',
  'billing.readOnly.body':
    '구독은 소유자나 관리자만 바꿀 수 있어요. 아래 내용은 모두 읽기 전용이에요.',
  'billing.hero.label': '현재 플랜',
  'billing.hero.endsAtPeriod': '기간이 끝나면 종료',
  'billing.hero.perYear': '/년',
  'billing.hero.perMonth': '/월',
  'billing.hero.freeAllowance': '여행 {trips}개, 혼자 여행',
  'billing.hero.perSeatLine': '멤버 {seats}명 × {price}',
  'billing.hero.singleTraveller': '여행자 한 명',
  'billing.price.free': '무료',
  'billing.provider.opening': 'Polar를 여는 중',
  'billing.renewal.trialEndsToday':
    '무료 체험이 오늘 끝납니다. 그 전에 해지하지 않으면 첫 결제가 이루어집니다.',
  'billing.renewal.trialEndsIn': {
    other:
      '무료 체험이 {value}일 뒤에 끝납니다. 그 전에 해지하지 않으면 첫 결제가 이루어집니다.',
  },
  'billing.renewal.trialEnded': '체험이 끝났어요.',
  'billing.renewal.endsNoDate': '이 플랜은 종료될 예정이고 갱신되지 않아요.',
  'billing.renewal.endsOn':
    '이 플랜은 {date}에 끝나요. 삭제되는 것은 없고, 유료 모듈만 잠겨요.',
  'billing.renewal.pastDue':
    '지난번 결제가 되지 않았어요. 유료 모듈을 잃기 전에 카드를 업데이트해 주세요.',
  'billing.renewal.unpaid':
    '이 구독은 미결제 상태이고 유료 모듈은 잠겨 있어요.',
  'billing.renewal.paused':
    '이 구독은 일시 중지 상태예요. 다시 떠날 준비가 되면 재개해 주세요.',
  'billing.renewal.lapsed':
    '예약과 여행 일지, 오프라인 지도를 다시 쓰려면 아래에서 플랜을 골라 주세요.',
  'billing.renewal.incomplete':
    'Polar가 아직 이 결제의 확인을 기다리고 있어요.',
  'billing.renewal.free':
    '한 번에 두 개의 여행까지, 무료로. 부족해지면 언제든 올리면 돼요.',
  'billing.renewal.auto': '자동으로 갱신돼요.',
  'billing.renewal.renewsOn': '{date}에 갱신돼요.',
  'billing.usage.title': '사용량',
  'billing.usage.description':
    '실시간으로 세니 숫자가 낡는 일이 없어요. 한도는 지금 적용 중인 플랜을 따라요.',
  'billing.quota.seats': '멤버',
  'billing.quota.trips': '여행',
  'billing.quota.storageBytes': '저장 공간',
  'billing.quota.unlimited': '무제한',
  'billing.quota.places': '장소',
  'billing.quota.placesHint': '이 워크스페이스의 모든 여행 기준',
  'billing.quota.exhausted.places': '장소 한도를 모두 사용했습니다',
  'billing.quota.over.places': '장소 한도를 {value}개 초과했습니다',
  'billing.quota.noLimit': '이 플랜에는 한도가 없어요',
  'billing.quota.used': '{quota} 사용',
  'billing.quota.over.seats': { other: '이 플랜의 한도를 {value}석 넘겼어요' },
  'billing.quota.over.trips': {
    other: '이 플랜의 한도를 여행 {value}개만큼 넘겼어요',
  },
  'billing.quota.over.storage': '이 플랜의 한도를 {value} 넘겼어요',
  'billing.quota.exhausted.seats': '이 플랜의 좌석이 모두 찼어요',
  'billing.quota.exhausted.trips': '이 플랜의 여행 자리가 모두 쓰였어요',
  'billing.quota.exhausted.storage': '이 플랜의 저장 공간이 가득 찼어요',
  'billing.quota.left': '{value} 남음',
  'billing.plans.title': '플랜',
  'billing.plans.description':
    '플랜은 언제든 바꿀 수 있어요. 상향은 날짜에 맞춰 일할 계산되고, 하향은 이미 결제한 기간이 끝난 뒤에 적용돼요.',
  'billing.interval.label': '결제 주기',
  'billing.interval.monthly': '월간',
  'billing.interval.yearly': '연간',
  'billing.plan.free.name': '프리',
  'billing.plan.free.tagline': '다음 두 여행을 계획해요',
  'billing.plan.free.feature.trips': '한 번에 두 개의 여행',
  'billing.plan.free.feature.itinerary': '하루하루의 일정과 지도',
  'billing.plan.free.feature.lists': '준비물 목록과 간단한 예산',
  'billing.plan.free.feature.atlas': '다녀온 곳을 기록하는 세계 지도',
  'billing.plan.solo.name': '솔로',
  'billing.plan.solo.tagline': '모든 것을 직접 계획하는 여행자에게',
  'billing.plan.solo.feature.trips': '여행 무제한',
  'billing.plan.solo.feature.modules': '예약과 일지, 예산, 준비물 — 모든 모듈',
  'billing.plan.solo.feature.offline': '떠나기 전에 내려받는 오프라인 지도',
  'billing.plan.solo.feature.export': 'PDF와 캘린더 내보내기',
  'billing.plan.crew.name': '크루',
  'billing.plan.crew.tagline': '가족과 친구, 작은 팀에게',
  'billing.plan.crew.feature.members': '최대 열 명까지, 한 사람 단위로 결제',
  'billing.plan.crew.feature.realtime': '커서까지 보이는 실시간 공동 작업',
  'billing.plan.crew.feature.everything': '무제한 여행과 모든 모듈',
  'billing.plan.crew.feature.storage': '모두의 사진과 서류를 둘 공용 공간',
  'billing.plan.current': '현재 플랜',
  'billing.plan.currentBadge': '현재',
  'billing.plan.popular': '인기',
  'billing.plan.switchYearly': '연간으로 바꾸기',
  'billing.plan.switchMonthly': '월간으로 바꾸기',
  'billing.plan.upgradeTo': '{plan} 플랜으로 올리기',
  'billing.plan.changeTo': '{plan} 플랜으로 바꾸기',
  'billing.plan.perMemberMonth': '/1인/월',
  'billing.plan.perMonth': '/월',
  'billing.plan.alwaysFree': '언제나 무료, 카드 없이',
  'billing.plan.billedYearly': '해마다 {amount} 청구',
  'billing.plan.billedMonthly': '달마다 {amount} 청구',
  'billing.plan.members': '멤버',
  'billing.plan.membersHint': '언제든 바꿀 수 있어요. 결제도 따라가요.',
  'billing.plan.seatOption': { other: '멤버 {value}명' },
  'billing.invoices.number': '청구서',
  'billing.invoices.date': '날짜',
  'billing.invoices.amount': '금액',
  'billing.invoices.status': '상태',
  'billing.invoice.paid': '결제 완료',
  'billing.invoice.draft': '임시',
  'billing.invoice.void': '무효',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    '결제 제공업체가 그 요청을 거부했습니다. 잠시 후 다시 시도해 주세요.',
  'billing.planChanged.title': '플랜이 업데이트되었습니다',
  'billing.planChanged.body':
    '변경은 이미 Polar에서 적용되었고 차액은 Polar가 청구합니다. 아래 요약은 1분 안에 따라잡습니다.',
  'billing.discount.toggle': '프로모션 코드가 있으신가요?',
  'billing.discount.label': '프로모션 코드',
  'billing.discount.hint': '다음에 선택하는 요금제에 적용됩니다.',
  'billing.discount.hintCurrent':
    '현재 요금제에 적용하거나 아래에서 요금제를 선택하세요.',
  'billing.discount.applyCurrent': '현재 요금제에 적용',
  'billing.discount.applying': '코드 적용 중…',
  'billing.discount.invalidFormat': '코드는 3~64자의 영문자와 숫자입니다.',
  'billing.discount.rejected.invalid':
    '유효하지 않은 코드입니다. 확인 후 다시 시도하세요.',
  'billing.discount.rejected.rateLimited':
    '시도한 코드가 너무 많습니다. 1시간 후 다시 시도하세요.',
  'billing.discount.rejected.notApplicable':
    '이 코드는 이 요금제에 적용되지 않습니다.',
  'billing.discount.rejected.busy':
    '지금은 코드를 확인할 수 없습니다. 1분 후 다시 시도하세요.',
  'billing.discount.nextRenewal': '프로모션 코드는 다음 갱신부터 적용됩니다.',
  'billing.discount.appliedTitle': '프로모션 코드 적용됨',
  'billing.hero.manage': '결제 관리',
  'billing.hero.manageHint':
    '카드, 청구 주소, 사업자번호, 영수증, 해지는 청구서를 발행하는 Polar에 있습니다.',
  'billing.hero.manageHintNone':
    '아직 결제 프로필이 없습니다. 아래에서 유료 플랜을 고르면 만들어지고, 그 뒤부터 포털이 열립니다.',
  'billing.portal.opening': '결제 포털을 여는 중',
  'billing.plan.notApplied': '그 변경은 적용되지 않았습니다',
  'billing.plan.cancelInPortal': '포털에서 해지',
  'billing.plan.seatsOverMax': {
    other:
      '이 워크스페이스에는 멤버가 {members}명이고 {plan}은 최대 {max}명까지 청구합니다. 바꾸기 전에 {value}명을 내보내세요.',
  },
  'billing.plan.seatsBelowMembers':
    '멤버가 {members}명입니다. 최소 그만큼의 좌석을 고르세요. Polar는 배정보다 좌석이 적은 구독을 거부합니다.',
  'billing.orders.title': '주문',
  'billing.orders.description': '이 워크스페이스의 모든 주문을 최신순으로.',
  'billing.orders.receipts': '모든 영수증',
  'billing.orders.unavailableTitle': '주문을 불러오지 못했습니다',
  'billing.orders.unavailableBody':
    'Polar가 이력에 대해 제때 응답하지 않았습니다. 위의 내용은 모두 최신입니다. 잠시 후 다시 시도하거나 결제 포털에서 전체 기록을 확인하세요.',
  'billing.orders.emptyTitle': '아직 주문이 없습니다',
  'billing.orders.emptyCustomer':
    '청구 기간이 끝나는 대로 첫 청구서가 여기에 나타납니다.',
  'billing.orders.emptyNoCustomer':
    '이 워크스페이스에는 청구된 적이 없습니다. 유료 플랜을 고르면 청구서가 여기에 모입니다.',
  'billing.orders.tableLabel': '주문 이력',
  'billing.orders.document': '문서',
  'billing.orders.dateUnknown': '날짜 미상',
  'billing.order.pending': '대기 중',
  'billing.order.refunded': '환불됨',
  'billing.order.partiallyRefunded': '일부 환불됨',
  'billing.order.noInvoiceDraft': '주문이 초안인 동안에는 청구서가 없습니다',
  'billing.order.preparing': '준비 중',
  'billing.order.renderingHint':
    'Polar가 청구서 {number}을 아직 만들고 있습니다. 다운로드는 몇 초 뒤에 돌아옵니다.',
  'billing.order.fetching': '청구서를 가져오는 중',
  'billing.order.generating': 'Polar가 청구서를 준비하고 있습니다',
  'billing.order.pdfLabel': '청구서 {number}을 PDF로',
  'billing.order.stillWritingTitle':
    'Polar가 그 청구서를 아직 작성하고 있습니다',
  'billing.order.stillWritingBody':
    '청구서 {number}을 만들고 있습니다. 다운로드는 몇 초 뒤에 저절로 돌아옵니다.',
  'billing.order.openFailed': '그 청구서는 열리지 않았습니다',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': '계정',
  'passkeys.page.title': '패스키',
  'passkeys.page.description':
    '패스키를 쓰면 아무것도 입력하지 않고 지문이나 얼굴, 보안 키로 로그인할 수 있어요.',
  'passkeys.page.back': '보안으로 돌아가기',
  'passkeys.list.label': '내 패스키',
  'passkeys.add.action': '패스키 추가',
  'passkeys.add.loading': '기기를 기다리는 중',
  'passkeys.add.added': '패스키를 추가했어요',
  'passkeys.add.dismissed': '패스키가 추가되지 않았어요',
  'passkeys.add.exists': '이 기기에는 이미 내 계정의 패스키가 있어요',
  'passkeys.add.failed': '패스키를 추가하지 못했어요. 다시 시도해 주세요.',
  'passkeys.add.stale': '안전을 위해 계속하려면 다시 로그인해 주세요.',
  'passkeys.error.sessionEnded':
    '세션이 끝났어요. 계속하려면 다시 로그인해 주세요.',
  'passkeys.signInAgain': '다시 로그인',
  'passkeys.add.limit':
    '패스키 {value}개 한도에 도달했어요. 다른 패스키를 추가하려면 하나를 삭제해 주세요.',
  'passkeys.add.unsupported':
    '이 브라우저에서는 패스키를 만들 수 없어요. 다른 브라우저나 기기를 사용해 보세요.',
  'passkeys.empty.title': '아직 패스키가 없어요',
  'passkeys.empty.body':
    '하나 추가하면 아무것도 입력하지 않고 지문이나 얼굴, 보안 키로 로그인할 수 있어요.',
  'passkeys.row.fallbackName': '패스키 · {date} 추가',
  'passkeys.row.added': '{date} 추가',
  'passkeys.row.lastUsed': '마지막 사용: {date}',
  'passkeys.row.neverUsed': '아직 로그인에 쓴 적 없어요',
  'passkeys.badge.synced': '동기화됨',
  'passkeys.badge.singleDevice': '기기 한 대에만 있음',
  'passkeys.error.title': '패스키를 불러오지 못했어요',
  'passkeys.error.retry': '다시 시도',
  'passkeys.error.rateLimited':
    '시도가 너무 많아요. 몇 분 뒤에 다시 시도해 주세요.',
  'passkeys.error.generic': '연결을 확인한 뒤 다시 시도해 주세요.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': '{name} 이름 바꾸기',
  'passkeys.rename.fieldLabel': '이 패스키에 이름 붙이기',
  'passkeys.rename.placeholder': '이름을 입력해 주세요. 예: 회사 휴대폰',
  'passkeys.rename.saving': '이름을 저장하는 중',
  'passkeys.rename.saved': '이름을 저장했어요',
  'passkeys.rename.failed': '이름을 저장하지 못했어요',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': '{name} 삭제',
  'passkeys.delete.title': '이 패스키를 삭제할까요?',
  'passkeys.delete.body': '이제 {name}(으)로는 로그인할 수 없어요.',
  'passkeys.delete.password': '비밀번호',
  'passkeys.delete.passwordHint': '확인을 위해 비밀번호를 입력해 주세요.',
  'passkeys.delete.confirmOnly':
    '이 계정에는 비밀번호가 없어요. 이 패스키를 삭제하는 것이 맞는지 확인해 주세요.',
  'passkeys.delete.confirm': '패스키 삭제',
  'passkeys.delete.cancel': '취소',
  'passkeys.delete.wrongPassword': '비밀번호가 맞지 않아요.',
  'passkeys.delete.stale':
    '안전을 위해 패스키를 삭제하기 전에 다시 로그인해 주세요.',
  'passkeys.delete.removed': '패스키를 삭제했어요',
  'passkeys.delete.failed': '패스키를 삭제하지 못했어요. 다시 시도해 주세요.',
  'passkeys.delete.removing': '패스키를 삭제하는 중',
  'passkeys.delete.passwordRequired':
    '이 패스키를 삭제하려면 비밀번호를 입력해 주세요.',
} satisfies TranslationOf<typeof En>

export default messages
