/**
 * 플랫폼 콘솔이 말하는 모든 것, 한국어판.
 *
 * `../en/console.ts`를 원본으로 삼아 작성했다(`docs/SPEC.md` §9). 영어 파일이 스키마이며,
 * `TranslationOf<typeof En>`은 빠진 키도 지어낸 키도 컴파일 오류로 만든다.
 * `__tests__/parity.test.ts`가 치환 변수와 복수형 가지, 그리고 여기에 영어가 남아 있지 않은지를
 * 검사한다.
 *
 * **복수형.** `Intl.PluralRules('ko')`는 `other` 하나만 돌려주므로, 수를 담은 문장은 단수와
 * 복수를 구분하지 않고 수사와 단위 명사로 읽힌다.
 *
 * **절대 섞이지 않는 두 개의 역할 체계**(§5). 플랫폼 쪽은 관리자·큐레이터·사용자, 워크스페이스
 * 쪽은 소유자·관리자·멤버. ‘관리자’는 양쪽에 모두 나오므로 어느 쪽인지는 언제나 문장이 밝힌다.
 *
 * `Suspend`는 ‘정지’이지 ‘삭제’가 아니다. 해제하면 접근이 돌아온다는 점을 문구가 그대로 말한다.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ---------------------------------------------------------------- 구획 -- */

  'nav.label': '콘솔 구획',
  'nav.overview': '개요',
  'nav.overview.description': '플랫폼을 한눈에',
  'nav.accounts': '계정',
  'nav.accounts.description': '역할, 정지, 세션',
  'nav.runs': '에이전트 실행',
  'nav.runs.description': 'Sandcastle 함대가 무엇을 짓고 있는지',

  /* ---------------------------------------------------------------- 껍데기 -- */

  'shell.eyebrow': '플랫폼 그 자체',
  'shell.title': '콘솔',
  'shell.description': '제품 그 자체 — 계정, 권한, 공용 카탈로그',
  'shell.signedInAs': '로그인 중',
  'shell.error.title': '콘솔을 불러오지 못했습니다',
  'shell.notFound.title': '그런 계정은 없습니다',
  'shell.notFound.body':
    '이 식별자를 가진 것은 플랫폼에 없습니다. 링크가 만들어진 뒤에 계정이 삭제되었거나, 주소를 잘못 입력했을 수 있습니다.',
  'shell.allAccounts': '모든 계정',
  'shell.overview': '콘솔 개요',

  'failure.fallback': '작업이 통과하지 못했습니다. 잠시 뒤에 다시 시도하세요.',

  /* ---------------------------------------------------------------- 개요 -- */

  'overview.error.title': '개요를 불러오지 못했습니다',
  'overview.standing.title': '플랫폼에서의 권한',
  'overview.standing.body':
    '계정과 세션, 그리고 다른 사람을 대신해 움직이는 일은 플랫폼 관리자의 몫입니다. 그래서 콘솔은 카탈로그만 보여 주고 그 밖의 것은 보여 주지 않습니다.',
  'overview.stat.accounts': '계정',
  'overview.stat.accounts.caption': {
    other: '그중 {staff}개가 플랫폼 역할을 가지고 있습니다',
  },
  'overview.stat.admins': '관리자',
  'overview.stat.admins.caption': '계정과 세션에 대한 전권',
  'overview.stat.curators': '큐레이터',
  'overview.stat.curators.caption': '카탈로그만 — 계정은 결코 아님',
  'overview.stat.suspended': '정지됨',
  'overview.stat.suspended.none': '밖에 남겨진 사람이 없습니다',
  'overview.stat.suspended.some':
    '정지가 풀릴 때까지 어디에서도 로그아웃된 상태입니다',
  'overview.stat.suspended.review': '살펴보기',
  'overview.newest.label': '가장 최근 계정',
  'overview.newest.empty.title': '아직 계정이 없습니다',
  'overview.newest.empty.body': '가장 먼저 가입하는 사람이 여기에 나타납니다.',
  'overview.catalogue.label': '상태별 카탈로그',
  'overview.catalogue.empty.title': '공용 카탈로그가 아직 열리지 않았습니다',
  'overview.catalogue.empty.body':
    '수집 파이프라인이 자리를 잡으면 이 패널은 공용 카탈로그의 모든 장소를 초안, 검토 중, 공개됨으로 세고, 각 숫자 뒤의 목록을 열어 줍니다.',
  'overview.scraping.label': '수집 실행',
  'overview.scraping.empty.title': '실행된 소스가 없습니다',
  'overview.scraping.empty.body':
    '소스는 일주일에 한 번 수집됩니다. 첫 실행이 끝나면 최근 다섯 건이, 각각 무엇을 가져오고 무엇을 바꾸고 무엇을 버렸는지와 함께 여기에 놓입니다.',

  /* ----------------------------------------------------------- 역할 체계 -- */

  'role.admin': '관리자',
  'role.admin.summary':
    '플랫폼의 전권: 계정, 역할, 정지, 세션, 그리고 다른 사람을 대신해 움직이는 일.',
  'role.admin.holds.accounts': '계정을 만들고 플랫폼 역할을 부여',
  'role.admin.holds.bans': '계정을 정지하고 정지를 해제',
  'role.admin.holds.sessions': '세션을 끝내고 비밀번호를 설정',
  'role.admin.holds.impersonate': '십오 분 동안 계정을 대신해 움직이기',
  'role.admin.holds.curation': '큐레이터가 할 수 있는 모든 것',
  'role.admin.withheld.admins': '다른 플랫폼 관리자를 대신해 움직이기',
  'role.curator': '큐레이터',
  'role.curator.summary':
    '카탈로그와 모음, 소스, 공유 링크의 관리. 계정에 닿는 일은 하나도 없습니다.',
  'role.curator.holds.places': '카탈로그 장소를 읽고 쓰고 공개',
  'role.curator.holds.packs': '장소 모음을 읽고 쓰고 공개',
  'role.curator.holds.sources': '카탈로그 소스를 읽고 실행',
  'role.curator.holds.shares': '공유 링크를 검토하고 취소',
  'role.curator.withheld.accounts': '계정이나 세션에 닿는 모든 것',
  'role.curator.withheld.tokens': '기계용 자격 증명을 발급하거나 취소',
  'role.user': '사용자',
  'role.user.summary':
    '플랫폼에서의 권한이 전혀 없습니다. 거의 모두가 여기에 해당합니다.',
  'role.user.withheld.everything': '플랫폼의 모든 권한, 예외 없이',

  /* ------------------------------------------------------------- 개별 계정 -- */

  'identity.you': '이 사람이 당신입니다',
  'status.active': '활성',
  'status.suspended': '정지됨',
  'status.permanent': '무기한',
  'status.until': '{date}까지',
  'status.unverified': '미확인',
  'device.on': '{platform}의 {browser}',
  'device.unrecognised': '알 수 없는 기기',

  /* --------------------------------------------------------------- 계정 목록 -- */

  'users.error.title': '계정 목록을 불러오지 못했습니다',
  'users.total': '전체 {total}개',
  'users.loading': '계정을 불러오는 중',
  'users.table.label': '플랫폼 계정',
  'users.search.label': '계정 검색',
  'users.search.email': '이메일 주소에서 검색',
  'users.search.name': '이름에서 검색',
  'users.search.column': '어느 열에서 검색할지',
  'users.search.submit': '검색',
  'users.field.email': '이메일',
  'users.field.name': '이름',
  'users.filter.role.label': '플랫폼 역할로 거르기',
  'users.filter.role.any': '모든 역할',
  'users.filter.role.admin': '관리자',
  'users.filter.role.curator': '큐레이터',
  'users.filter.status.label': '계정 상태로 거르기',
  'users.filter.status.any': '모든 상태',
  'users.filter.hint': '역할이나 상태로 좁힐 수 있습니다 — 한 번에 하나씩.',
  'users.column.account': '계정',
  'users.column.role': '플랫폼 역할',
  'users.column.status': '상태',
  'users.column.joined': '가입',
  'users.column.actions': '작업',
  'users.joined': '{date}에 가입',
  'users.pastEnd.title': '이 페이지는 끝을 넘어섰습니다',
  'users.pastEnd.body': {
    other:
      '이 화면에는 계정이 {total}개 있고, 그것은 {pages}입니다. {page}쪽은 그 너머에 있습니다.',
  },
  'users.pastEnd.pages': {
    other: '{pages}쪽',
  },
  'users.pastEnd.back': '첫 페이지로 돌아가기',
  'users.empty.filtered.title': '이 필터에 맞는 것이 없습니다',
  'users.empty.filtered.body':
    '이 검색에 해당하는 플랫폼 계정이 없습니다. 검색을 넓히거나 필터를 지워 모두를 보세요.',
  'users.empty.title': '보여 줄 계정이 없습니다',
  'users.empty.body':
    '이 화면은 비어 있습니다. 걸러 낸 것이 없으니 넓힐 여지도 없습니다.',

  /* --------------------------------------------------------------- 계정 화면 -- */

  'account.error.title': '이 계정을 불러오지 못했습니다',
  'account.loading': '계정을 불러오는 중',
  'account.meta.lastChange': '마지막 변경',
  'account.meta.id': '계정 ID',
  'account.banned.title': '이 계정은 정지되었습니다',
  'account.banned.noReason': '정지와 함께 기록된 사유가 없습니다.',
  'account.banned.permanent': ' 관리자가 풀 때까지 계속됩니다.',
  'account.banned.until': ' {date}에 저절로 풀립니다.',
  'account.banned.untilUnknown': '기한이 다할 때',
  'account.authority.label': '플랫폼에서의 권한',
  'account.authority.may': '할 수 있음',
  'account.authority.mayNot': '할 수 없음',
  'account.authority.none': '플랫폼에서는 아무것도.',
  'account.workspaces.label': '워크스페이스',
  'account.workspaces.truncated':
    '이 계정은 여기 나열한 {listed}개보다 많은 워크스페이스에 속해 있습니다.',
  'account.workspaces.empty.title': '어느 워크스페이스에도 속해 있지 않음',
  'account.workspaces.empty.body':
    '이 계정은 아직 어느 워크스페이스에도 속해 있지 않습니다. 첫 로그인에서 하나가 만들어지고, 초대받은 워크스페이스는 여기에 나타납니다.',
  'account.workspaces.column.workspace': '워크스페이스',
  'account.workspaces.column.role': '역할',
  'account.workspaces.column.plan': '요금제',
  'account.subscription.label': '구독',
  'account.subscription.free.title': '무료 요금제 사용 중',
  'account.subscription.free.body':
    '이 계정이 소유한 워크스페이스는 결제를 한 번도 거치지 않았으므로 구독 기록이 없고, 무료 요금제의 한도 안에서 돌아갑니다.',
  'account.subscription.none.title': '이 계정에 청구되는 것이 없습니다',
  'account.subscription.none.body':
    '이 계정은 워크스페이스를 하나도 소유하고 있지 않습니다. 남의 워크스페이스에 속해 있다는 것은 그 워크스페이스의 청구 대상이라는 뜻이 아니므로, 여기서 모을 것이 없습니다.',
  'account.subscription.endsAtClose': '기간이 끝날 때 종료됩니다',
  'account.subscription.seats': '좌석',
  'account.subscription.seatsValue': '{limit}개 중 {used}개',
  'account.subscription.ends': '종료',
  'account.subscription.renews': '갱신',
  'account.sessions.label': '활성 세션',
  'account.sessions.truncated':
    '이 계정은 한 번의 호출로 나열할 수 있는 것보다 많은 세션을 가지고 있습니다. 하나도 남지 않았는지 확인하려면 작업 메뉴에서 모든 세션을 끝내세요.',
  'account.sessions.empty.title': '어디에서도 로그아웃된 상태',
  'account.sessions.empty.body':
    '이 계정에는 기한이 남은 세션이 없습니다. 다시 로그인하는 순간 여기에 나타납니다.',
  'account.sessions.column.device': '기기',
  'account.sessions.column.address': '주소',
  'account.sessions.column.started': '시작',
  'account.sessions.column.expires': '만료',
  'account.sessions.impersonated': '대리 접속에서 생겨난 세션',
  'account.sessions.noAddress': '기록 없음',
  'account.sessions.noAddressLong': '주소가 기록되지 않았습니다',
  'account.sessions.when': '{started} 시작 · {expires} 만료',
  'account.audit.label': '감사 기록',
  'account.audit.truncated':
    '장부에는 이보다 많은 항목이 있습니다. 플랫폼의 감사 흔적은 덧붙이기만 가능하며 사백 일 동안 보관됩니다.',
  'account.audit.empty.title': '이 계정에 아무 일도 없었습니다',
  'account.audit.empty.body':
    '역할 변경, 정지, 설정된 비밀번호, 끝난 세션, 대리 접속은 모두 그것을 한 사람과 함께 여기에 기록됩니다. 아무도 손대지 않았습니다.',

  /* ------------------------------------------------- 워크스페이스 체계 -- */

  'workspace.role.owner': '소유자',
  'workspace.role.admin': '관리자',
  'workspace.role.member': '멤버',
  'plan.free': '무료',
  'plan.starter': '스타터',
  'plan.pro': '프로',
  'plan.business': '비즈니스',
  'subscription.trialing': '체험 중',
  'subscription.active': '활성',
  'subscription.pastDue': '연체',
  'subscription.canceled': '해지됨',
  'subscription.incomplete': '미완료',
  'subscription.expired': '만료됨',
  'subscription.unpaid': '미결제',
  'subscription.paused': '일시 중지',

  /* ------------------------------------------------------------- 감사 장부 -- */

  'audit.action.created': '계정이 만들어짐',
  'audit.action.updated': '계정 정보가 바뀜',
  'audit.action.roleChanged': '플랫폼 역할이 바뀜',
  'audit.action.banned': '계정이 정지됨',
  'audit.action.unbanned': '정지가 해제됨',
  'audit.action.deleted': '계정이 삭제됨',
  'audit.action.passwordSet': '관리자가 비밀번호를 설정함',
  'audit.action.emailSet': '이메일 주소가 바뀜',
  'audit.action.impersonationStarted': '대리 접속이 시작됨',
  'audit.action.impersonationEnded': '대리 접속이 끝남',
  'audit.action.sessionRevoked': '세션이 끝남',
  'audit.action.sessionRevokedAll': '모든 세션이 끝남',
  'audit.actor.system': '플랫폼 자신',
  'audit.actor.system.detail': '자동',
  'audit.actor.agent': '기계 자격 증명',
  'audit.actor.agent.detail': 'MCP 토큰',
  'audit.actor.deleted': '삭제된 계정',
  'audit.actorBadge': '당시: {role}',
  'audit.field.name': '이름',
  'audit.field.email': '이메일 주소',
  'audit.field.emailVerified': '이메일 확인됨',
  'audit.field.role': '플랫폼 역할',
  'audit.field.banned': '정지됨',
  'audit.field.banReason': '사유',
  'audit.field.banExpiresAt': '정지 종료',
  'audit.field.revoked': '끝난 세션',
  'audit.field.impersonating': '대신하고 있는 계정',
  'audit.field.impersonatedBy': '대신하고 있는 사람',
  'audit.field.expiresAt': '세션 만료',
  'audit.field.targetRole': '그 사람의 플랫폼 역할',
  'audit.field.sessionId': '해당 세션',
  'audit.value.yes': '예',
  'audit.value.no': '아니요',
  'audit.value.cleared': '지워짐',
  'audit.became': '변경 후',

  /* ------------------------------------------------------------- 대화 상자 -- */

  'dialog.cancel': '취소',

  'create.button': '새 계정',
  'create.title': '계정 만들기',
  'create.body':
    '주소는 확인되지 않고 메일도 나가지 않습니다 — 비밀번호는 직접 전해 주세요.',
  'create.confirm': '계정 만들기',
  'create.name.placeholder': '김서연',
  'create.email': '이메일 주소',
  'create.email.placeholder': 'seoyeon@planned.travel',
  'create.password': '비밀번호',
  'create.password.hint':
    '문장이 될 만큼 길게. 나중에 본인이 바꿀 수 있습니다.',
  'create.done': '계정을 만들었습니다',
  'create.done.body': '{email}은(는) 설정한 비밀번호로 로그인할 수 있습니다.',

  'action.menu.label': '{name}에 대한 작업',
  'action.group.account': '계정',
  'action.group.credentials': '자격 증명',

  'action.role.item': '플랫폼 역할 바꾸기',
  'action.role.self':
    '자신의 계정에는 쓸 수 없습니다 — 스스로를 낮추면 플랫폼에 관리자가 남지 않을 수 있습니다.',
  'action.role.body':
    '{name}이(가) 플랫폼 자체에서 무엇을 할 수 있는지. 워크스페이스 소속은 다른 어휘이며 이것으로 움직이지 않습니다.',
  'action.role.confirm': '역할 저장',
  'action.role.current': '현재',
  'action.role.done': '플랫폼 역할을 바꿨습니다',
  'action.role.done.body': '{name}은(는) 이제 플랫폼에서 {role}입니다.',

  'action.impersonate.item': '계정을 대신해 움직이기',
  'action.impersonate.self': '대신할 사람이 없습니다 — 당신 자신의 계정입니다.',
  'action.impersonate.banned':
    '계정이 정지되어 있어 걸쳐 입을 세션이 없습니다.',
  'action.impersonate.admin':
    '플랫폼의 어떤 역할도 관리자를 대신할 수 없으며, 당신의 역할도 마찬가지입니다.',
  'action.impersonate.title': '{name}을(를) 대신해 움직이기',
  'action.impersonate.body':
    '십오 분 동안 이 계정이 보는 그대로의 제품을 보게 됩니다.',
  'action.impersonate.confirm': '시작',
  'action.impersonate.note.bar':
    '끝낼 때까지 경고 막대가 모든 화면에 남고, 닫을 수 없습니다.',
  'action.impersonate.note.platform':
    '대리 접속 중에는 플랫폼 작업을 쓸 수 없습니다 — 콘솔도 마찬가지입니다.',
  'action.impersonate.note.audit':
    '시작도 끝도 당신의 이름과 함께 플랫폼의 감사 흔적에 기록됩니다.',

  'action.password.item': '비밀번호 설정',
  'action.password.title': '{name}의 비밀번호 설정',
  'action.password.body':
    '계정에서 밀려난 사람을 되돌리거나, 탈취된 계정에서 공격자를 끊어 낼 때 쓰세요.',
  'action.password.confirm': '비밀번호 설정',
  'action.password.field': '새 비밀번호',
  'action.password.hint.self':
    '설정하는 순간 모든 세션이 끝납니다 — 당신의 세션도 포함해서.',
  'action.password.hint': '설정하는 순간 이 계정이 가진 모든 세션이 끝납니다.',
  'action.password.done': '비밀번호를 설정했습니다',
  'action.password.done.body': '{name}은(는) 모든 기기에서 로그아웃되었습니다.',

  'action.sessions.item': '모든 세션 끝내기',
  'action.sessions.body.self':
    '당신의 모든 기기가 로그아웃됩니다. 지금 이 글을 읽고 있는 기기도 포함됩니다.',
  'action.sessions.body':
    '{name}은(는) 모든 기기에서 로그아웃되고 다시 로그인해야 합니다.',
  'action.sessions.confirm': '세션 끝내기',
  'action.sessions.done': '세션을 끝냈습니다',
  'action.sessions.done.body': {
    other: '세션 {revoked}개가 끝났습니다.',
  },

  'action.ban.item': '계정 정지',
  'action.ban.self':
    '자신의 계정에는 쓸 수 없습니다 — 스스로를 정지하면 돌아올 길이 없습니다.',
  'action.ban.title': '{name} 정지',
  'action.ban.body':
    '모든 세션이 즉시 끝나고, 정지가 풀리거나 기한이 다할 때까지 로그인할 수 없습니다.',
  'action.ban.confirm': '계정 정지',
  'action.ban.reason': '사유',
  'action.ban.reason.hint':
    '플랫폼의 감사 흔적에 십삼 개월 보관되며 관리자 외에는 누구에게도 보이지 않습니다.',
  'action.ban.reason.placeholder':
    '워크스페이스 세 곳에서 반복해 들어온 악용 신고',
  'action.ban.duration': '기간',
  'action.ban.duration.label': '정지 기간',
  'action.ban.duration.permanent.body':
    '관리자가 뜻을 가지고 풀 때까지 유지됩니다.',
  'action.ban.duration.day': '24시간',
  'action.ban.duration.day.body':
    '흐름을 끊을 만큼 길고, 개입에 머무를 만큼 짧습니다.',
  'action.ban.duration.week': '7일',
  'action.ban.duration.week.body': '신고에 답할 한 주.',
  'action.ban.duration.month': '30일',
  'action.ban.duration.month.body': '강제된 침묵의 한 달.',
  'action.ban.duration.quarter': '90일',
  'action.ban.duration.quarter.body':
    '콘솔이 내놓는 가장 긴 기간입니다. 그보다 길게 막으려면 무기한 정지를 쓰세요.',
  'action.ban.done': '계정을 정지했습니다',
  'action.ban.done.body':
    '{name}은(는) 모든 곳에서 로그아웃되었고 로그인할 수 없습니다.',

  'action.unban.item': '정지 해제',
  'action.unban.title': '{name}의 정지 해제',
  'action.unban.body':
    '다음 시도부터 로그인할 수 있습니다. 이전 세션은 하나도 돌아오지 않습니다.',
  'action.unban.confirm': '정지 해제',
  'action.unban.done': '정지를 해제했습니다',
  'action.unban.done.body':
    '{name}은(는) 다시 로그인할 수 있습니다. 세션은 복구되지 않았습니다.',

  'action.delete.item': '계정 삭제',
  'action.delete.self':
    '자신의 계정에는 쓸 수 없습니다 — 거기서는 돌아올 길이 없습니다.',
  'action.delete.title': '{name} 삭제',
  'action.delete.body':
    '계정과 그 세션, 계정에 묶인 모든 자격 증명이 사라집니다. 되돌릴 수 없습니다.',
  'action.delete.confirm': '계정 삭제',
  'action.delete.note':
    '이 사람이 워크스페이스 안에서 만든 것은 그것을 소유한 워크스페이스에 남습니다. 삭제 대신 정지하면 기록은 지키면서 접근만 거둘 수 있습니다.',
  'action.delete.owners':
    '다른 사람이 속해 있는 워크스페이스의 유일한 소유자인 계정은 삭제할 수 없습니다. 먼저 그 워크스페이스에서 다른 소유자를 지정하거나, 삭제 대신 계정을 정지하세요.',
  'action.delete.done': '계정을 삭제했습니다',
  'action.delete.done.body':
    '{name}과(와) 계정에 묶여 있던 모든 것이 사라졌습니다.',

  'session.revoke.label': '{device}의 세션 끝내기',
  'session.revoke.title': '이 세션 끝내기',
  'session.revoke.body':
    '{device}은(는) 다음 요청에서 다시 로그인해야 합니다. 지금 이 글을 읽고 있는 세션이라면 당신도 함께 로그아웃됩니다.',
  'session.revoke.confirm': '세션 끝내기',
  'session.revoke.done': '세션을 끝냈습니다',
  'session.revoke.done.body': '그 기기는 다음 요청에서 다시 로그인해야 합니다.',

  /* ---------------------------------------------------------- 에이전트 실행 -- */

  'runs.error.title': '실행 레지스트리가 응답하지 않았습니다',
  'runs.origin.local': '로컬',
  'runs.origin.githubActions': 'GitHub 액션',
  'runs.stat.live': '진행 중인 실행',
  'runs.stat.live.none': '지금 지어지고 있는 것이 없습니다',
  'runs.stat.live.some': '오 분짜리 임차에 맞선 심장 박동',
  'runs.stat.issues': '점유 중인 이슈',
  'runs.stat.issues.caption':
    '각각 하나의 실행에 임차되며, 조상과 자손도 함께 묶입니다',
  'runs.stat.orphans': '고아가 된 브랜치',
  'runs.stat.orphans.none': '주인 없는 작업이 없습니다',
  'runs.stat.orphans.some':
    '멈춘 실행이 남긴 커밋들이 거둬지기를 기다리고 있습니다',
  'runs.live.empty.title': '등록된 실행이 없습니다',
  'runs.live.empty.body':
    '실행은 스스로를 등록하는 순간 여기에 나타납니다 — 이 기계에서든, 다른 기계에서든, GitHub 러너에서든 — 점유한 이슈와 함께.',
  'runs.holds.nothing': '아무것도 점유하지 않음',
  'runs.holds': '{issues} 점유 중',
  'runs.uptime': '{elapsed} 가동 · {lease}',
  'runs.lease.expired': '임차 만료',
  'runs.lease.left': '{elapsed} 남음',
  'runs.wip.label': '진행 중인 작업',
  'runs.wip.empty.title': '작업을 담은 브랜치가 없습니다',
  'runs.wip.empty.body':
    '실행은 브랜치에 커밋이 올라오는 즉시 그것을 기록합니다. 실행이 죽어도, 그 이슈를 다음에 점유한 실행에는 처음부터 시작하는 대신 이 작업이 제시됩니다.',
  'runs.wip.orphaned': '고아',
  'runs.wip.meta': {
    other: '커밋 {commits}개 · {elapsed} 전',
  },
  'runs.recent.label': '최근에 끝난 실행',
  'runs.recent.empty.title': '아직 끝난 실행이 없습니다',
  'runs.recent.empty.body':
    '최근 오십 건의 실행이 각각 어떻게 끝났는지와 함께 여기에 남습니다.',
  'runs.ago': '{elapsed} 전',
  'runs.notCoordinator.title': '이 배포는 함대를 조율하지 않습니다',
  'runs.notCoordinator.body':
    '실행 레지스트리는 스테이징 환경에만 묶여 있으며, 이는 의도한 것입니다. 레지스트리가 둘이면 두 함대가 모두 자기가 줄을 쥐고 있다고 믿게 되는데, 그것이야말로 레지스트리가 막으려고 존재하는 단 하나의 일이기 때문입니다. 함대는 스테이징 환경에서 확인하세요.',
  'nav.providers': '공급자',
  'nav.providers.description': '외부 호출과 그 상한',
  'providers.error.title': '공급자 계측값을 읽지 못했습니다',
  'providers.list.label': '서비스',
  'providers.status.planned': '연동 안 됨',
  'providers.status.planned.description':
    '아직 이 서비스를 부르는 곳이 없어 셀 것이 없습니다. 첫 청구서 뒤가 아니라 첫 호출 전에 상한을 정할 수 있도록 여기에 적어 둡니다.',
  'providers.policy.allow': '상한을 넘겨도 과금',
  'providers.policy.block': '상한에서 거부',
  'providers.badge.blocked': {
    other: '호출 {calls}건 거부',
  },
  'providers.limit.none': '합의된 상한 없음 · 이번 달 {used}건',
  'providers.limit.value': '{limit}건 중 {used}건',
  'providers.limit.window.day': '오늘',
  'providers.limit.window.month': '이번 달',
  'providers.measuring.none': '아직 측정된 것이 없습니다',
  'providers.measuring.since': '{date}부터 측정',
  'providers.stat.calls': '이번 달 호출',
  'providers.stat.calls.caption': '연동된 모든 서비스 합계',
  'providers.stat.errors': '실패한 호출',
  'providers.stat.errors.caption':
    '대부분의 공급자가 과금하므로 호출로도 셉니다',
  'providers.stat.nearLimit': '상한에 근접',
  'providers.stat.nearLimit.caption': '경고 임계값을 넘은 서비스',
  'providers.stat.blocked': '거부된 호출',
  'providers.stat.blocked.none': '거부된 것이 없습니다',
  'providers.stat.blocked.some': '상한이 돌려보낸 수요',
  'providers.forecast.label': '예측',
  'providers.forecast.provider': '서비스',
  'providers.forecast.monthEnd': '월말까지',
  'providers.forecast.runRate': '이 속도라면 월간',
  'providers.forecast.perWorkspace': '작업 공간당 월간',
  'providers.forecast.noWorkspaceTraffic':
    '평균을 낼 작업 공간 트래픽이 없습니다',
  'providers.forecast.window': {
    other: '{hours}시간의 측정에서 산출했습니다.',
  },
  'providers.forecast.tooEarly': {
    other:
      '아직 {hours}시간만 측정되어 예측하기에 부족합니다. 하루도 안 되는 값을 한 달로 늘리는 것은 산수이지 예측이 아닙니다.',
  },
  'providers.forecast.atWorkspaces': '작업 공간 수',
  'providers.forecast.callsEach': '공간당 월간 호출 수',
  'providers.forecast.projected': '월 약 {calls}건입니다.',
  'providers.workspaces.label': '호출이 많은 작업 공간',
  'providers.workspaces.platform': '플랫폼(작업 공간 없음)',
  'providers.workspaces.empty.title': '아직 귀속된 것이 없습니다',
  'providers.workspaces.empty.description':
    '작업 공간을 위해 한 호출은 그 공간에 기록됩니다. 예약 작업과 플랫폼 메일은 어디에도 속하지 않아 따로 셉니다.',
  'providers.readOnly':
    '이 계측값은 읽을 수 있지만 상한은 옮길 수 없습니다. 한도나 정책을 바꾸려면 provider:configure 권한이 필요합니다.',
  'providers.status.planned.agreed.month':
    '합의된 상한: 월 {limit}. 클라이언트가 생기는 즉시 첫 호출부터 적용됩니다.',
  'providers.status.planned.agreed.day':
    '합의된 상한: 하루 {limit}. 클라이언트가 생기는 즉시 첫 호출부터 적용됩니다.',
  'providers.edit.button': '편집',
  'providers.edit.title': '{provider} 상한',
  'providers.edit.body':
    '이 배포가 공급자와 쓰기로 합의한 양, 그리고 다 썼을 때 무슨 일이 일어나는지.',
  'providers.edit.confirm': '상한 저장',
  'providers.edit.done': '{provider} 상한을 저장했습니다',
  'providers.edit.label': '이름',
  'providers.edit.ceiling': '포함된 호출 수',
  'providers.edit.ceiling.hint':
    '합의된 상한이 없으면 비워 두세요. 빈 값과 0은 다릅니다. “거부”에서의 0은 모든 호출을 돌려보냅니다.',
  'providers.edit.ceiling.placeholder': '상한 없음',
  'providers.edit.window': '측정 단위',
  'providers.edit.window.month': '역월',
  'providers.edit.window.month.body': '포함 할당량의 통상적인 형태입니다.',
  'providers.edit.window.day': '하루',
  'providers.edit.window.day.body':
    '일 단위로 재는 공급자도 있습니다. Geoapify 무료 요금제는 하루 3,000크레딧입니다.',
  'providers.edit.policy': '상한에 도달하면',
  'providers.edit.policy.allow': '계속 호출하고 비용을 낸다',
  'providers.edit.policy.allow.body':
    '상한을 넘겨도 호출은 계속되고 콘솔이 경고합니다. 멈추는 것은 없습니다.',
  'providers.edit.policy.block': '이후 호출을 거부한다',
  'providers.edit.policy.block.body':
    '기간이 초기화될 때까지 호출을 돌려보냅니다. 이 공급자에 의존하는 기능은 멈추므로, 그 멈춤이 더 값싼 실패일 때만 고르세요.',
  'providers.edit.policy.block.refused':
    '{provider}는 거부할 수 없습니다. 대체 경로가 없어 호출을 막으면 비용을 제한하는 대신 기능이 멈춥니다. 경고만 하는 상한은 그대로 쓸 수 있습니다.',
  'providers.edit.warn': '경고 (%)',
  'providers.edit.critical': '위험 (%)',
  'providers.edit.thresholds.hint':
    '계기가 주황과 빨강으로 바뀌는 지점입니다. 경고는 위험보다 높을 수 없습니다.',
} satisfies TranslationOf<typeof En>

export default messages
