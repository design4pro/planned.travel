/**
 * The sign-in, sign-up, recovery and invitation screens, in Korean.
 *
 * Authored from `../en/auth`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Korean has no plural inflection, so `Intl.PluralRules` reports the single
 * category `other` and every `one`/`other` pair English writes collapses to one
 * branch. Spacing is the thing to get right instead: a counter noun (개, 명, 박,
 * 일) is written separately from the numeral, and a particle is chosen for the
 * noun it follows.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  'shell.home': 'planned.travel 홈',
  'shell.legal':
    '계속하면 planned.travel 이용약관과 개인정보 처리방침에 동의하는 것으로 봅니다.',
  'panel.eyebrow': '함께 계획하기',
  'panel.heading': '첫 핀부터 마지막 엽서까지, 모든 여행을.',
  'panel.body':
    '실제 지도 위에서 함께 보는 일정, 실제로 맞아떨어지는 예산, 빠뜨린 것을 기억해 주는 준비물 목록, 그리고 남겨 둘 만한 여행 일지.',
  'panel.map.title': '지도 하나, 계획 하나',
  'panel.map.detail': '들르는 곳, 숙소, 이동을 하나의 일정에 담아요.',
  'panel.group.title': '모두가 같은 걸음으로',
  'panel.group.detail': '편집과 투표, 댓글이 모든 사람에게 바로 도착해요.',
  'panel.costs.title': '딱 맞아떨어지는 비용',
  'panel.costs.detail':
    '함께 쓰는 예산, 끝까지 정산되는 잔액, 스프레드시트는 필요 없어요.',
  'divider.or': '또는',
  'divider.orEmail': '또는 이메일로',
  'social.continue': '{provider} 계정으로 계속하기',
  'social.signUp': '{provider} 계정으로 가입하기',
  'social.opening': '{provider} 여는 중',
  'passkey.action': '패스키로 로그인',
  'passkey.waiting': '기기를 기다리고 있어요',
  'password.show': '비밀번호 표시',
  'password.hide': '비밀번호 숨기기',
  'password.showNew': '새 비밀번호 표시',
  'password.hideNew': '새 비밀번호 숨기기',
  'password.showConfirm': '비밀번호 확인란 표시',
  'password.hideConfirm': '비밀번호 확인란 숨기기',
  'field.email': '이메일 주소',
  'field.email.placeholder': 'name@example.com',
  'field.password': '비밀번호',
  'field.password.placeholder': '쓰고 있는 비밀번호',
  'field.newPassword': '새 비밀번호',
  'field.newPassword.placeholder': '기억할 수 있는 한 문장',
  'field.confirmPassword': '비밀번호 확인',
  'field.confirmNewPassword': '새 비밀번호 확인',
  'field.confirmPassword.placeholder': '한 번 더 입력해 주세요',
  'field.name': '이름',
  'field.name.hint': '함께 여행을 계획하는 사람들에게 보여요.',
  'field.name.placeholder': '홍길동',
  'validation.emailRequired': '이메일 주소를 입력해 주세요.',
  'validation.emailTooLong': '이메일 주소가 너무 길어요.',
  'validation.emailInvalid': '이메일 주소 형식이 아닌 것 같아요.',
  'validation.passwordRequired': '비밀번호를 입력해 주세요.',
  'validation.passwordShort': {
    other:
      '{value}자 이상으로 해 주세요. 어려운 단어보다 짧은 문장이 더 강해요.',
  },
  'validation.passwordLong': { other: '{value}자 이내로 해 주세요.' },
  'validation.passwordMismatch': '두 비밀번호가 서로 달라요.',
  'validation.nameShort': '여행 동료가 알아볼 수 있도록 이름을 입력해 주세요.',
  'validation.nameTooLong': '이름이 너무 길어요.',
  'validation.termsRequired': '계속하려면 이용약관에 동의해 주세요.',
  'validation.codeLength': '인증 앱 코드는 여섯 자리예요.',
  'validation.codeDigits': '인증 앱 코드는 숫자만 들어가요.',
  'validation.backupShort': '백업 코드가 너무 짧아 보여요.',
  'validation.backupLong': '백업 코드가 너무 길어 보여요.',
  'login.eyebrow': '다시 오셨네요',
  'login.heading': 'planned.travel에 로그인',
  'login.description': '일정과 예산, 목록을 멈춘 자리에서 그대로 이어 가세요.',
  'login.newHere': '처음이신가요?',
  'login.createAccount': '계정 만들기',
  'login.forgot': '비밀번호를 잊으셨나요?',
  'login.remember': '이 기기에서는 로그인 상태 유지',
  'login.submit': '로그인',
  'login.submitting': '로그인하는 중',
  'register.eyebrow': '계정 만들기',
  'register.heading': '몇 분이면 계획을 시작할 수 있어요',
  'register.description':
    '계정 하나로 모든 여행, 모든 동행, 모든 목록을 함께 관리해요.',
  'register.haveAccount': '이미 계정이 있으신가요?',
  'register.signIn': '로그인',
  'register.terms': '이용약관과 개인정보 처리방침에 동의합니다.',
  'register.submit': '계정 만들기',
  'register.submitting': '계정을 만드는 중',
  'strength.hint': {
    other: '{value}자 이상. 어려운 단어보다 짧은 문장이 더 강해요.',
  },
  'strength.tooShort': '강도: 너무 짧아요',
  'strength.weak': '강도: 약함',
  'strength.fair': '강도: 보통',
  'strength.strong': '강도: 강함',
  'strength.excellent': '강도: 아주 강함',
  'forgot.eyebrow': '비밀번호 도움말',
  'forgot.heading': '비밀번호 재설정',
  'forgot.description':
    '계정에 쓰는 주소를 알려 주시면 새 비밀번호를 정할 수 있는 링크를 메일로 보내 드려요.',
  'forgot.submit': '재설정 링크 보내기',
  'forgot.submitting': '링크를 보내는 중',
  'forgot.back': '로그인으로 돌아가기',
  'forgot.sent.eyebrow': '받은 편지함을 확인해 주세요',
  'forgot.sent.heading': '재설정 링크를 보냈어요',
  'forgot.sent.description':
    '{email} 주소로 만든 계정이 있다면, 새 비밀번호를 정하는 링크가 지금 그 편지함에 있어요.',
  'forgot.sent.title': '링크는 한 시간 동안, 한 번만 쓸 수 있어요',
  'forgot.sent.body':
    '아무것도 오지 않았나요? 스팸함을 확인한 뒤 다시 보내 주세요. 새 링크를 요청하면 이전 링크는 조용히 만료돼요.',
  'forgot.sent.resend': '다시 보내기',
  'forgot.sent.resending': '다시 보내는 중',
  'forgot.sent.change': '다른 이메일 쓰기',
  'reset.eyebrow': '비밀번호 재설정',
  'reset.heading': '새 비밀번호를 정해 주세요',
  'reset.description': {
    other:
      '{value}자 이상으로 정해 주세요. 짧은 문장은 기억하기 쉽고 추측하기는 어려워요.',
  },
  'reset.submit': '새 비밀번호 저장',
  'reset.submitting': '비밀번호를 저장하는 중',
  'reset.back': '로그인으로 돌아가기',
  'reset.stale.heading': '이 링크는 쓸 수 없어요',
  'reset.stale.description':
    '재설정 링크는 한 시간 뒤에 만료되고 한 번만 쓸 수 있어요. 그게 가장 안전한 방식이에요.',
  'reset.stale.action': '새 링크 요청하기',
  'reset.done.heading': '새 비밀번호를 설정했어요',
  'reset.done.description':
    '다른 모든 세션은 로그아웃됐어요. 예전 비밀번호를 알던 사람도 이제는 들어올 수 없어요.',
  'reset.done.title': '다른 곳에서는 모두 로그아웃했어요',
  'reset.done.body': '새 비밀번호로 로그인해서 계획을 이어 가세요.',
  'reset.done.action': '로그인',
  'twoFactor.eyebrow': '2단계 인증',
  'twoFactor.heading': '본인인지 확인할게요',
  'twoFactor.description':
    '이 계정은 두 번째 인증 수단으로 보호돼요. 인증 앱에 지금 보이는 코드를 입력해 주세요.',
  'twoFactor.back': '로그인부터 다시 하기',
  'twoFactor.methods': '인증 방법',
  'twoFactor.totp.tab': '인증 앱',
  'twoFactor.totp.label': '여섯 자리 코드',
  'twoFactor.totp.hint': '코드는 30초마다 바뀌어요.',
  'twoFactor.totp.submit': '확인하고 계속하기',
  'twoFactor.backup.tab': '백업 코드',
  'twoFactor.backup.label': '백업 코드',
  'twoFactor.backup.hint':
    '2단계 인증을 켤 때 저장해 둔 목록에 있는 코드예요. 각 코드는 한 번만 쓸 수 있어요.',
  'twoFactor.backup.submit': '백업 코드 사용',
  'twoFactor.submitting': '코드를 확인하는 중',
  'twoFactor.trust.label': '이 기기를 30일 동안 신뢰',
  'twoFactor.trust.detail':
    '그때까지 이 브라우저에서는 이 단계를 건너뛰어요. 나만 쓰는 기기에서만 켜 주세요.',
  'verify.done.eyebrow': '이메일을 확인했어요',
  'verify.done.heading': '준비가 끝났어요',
  'verify.done.description':
    '주소가 확인됐으니 초대와 알림, 여행 요약이 잘 도착해요.',
  'verify.done.title': '확인 완료',
  'verify.done.body': '{email} 주소를 이 계정에서 확인했어요.',
  'verify.done.bodyUnknown': '이 계정의 이메일 주소가 확인됐어요.',
  'verify.done.action': '대시보드로 가기',
  'verify.pending.eyebrow': '한 가지만 더',
  'verify.pending.heading': '이메일 주소를 확인해 주세요',
  'verify.pending.description':
    '{email} 주소로 확인 링크를 보냈어요. 링크를 열면 계정을 되찾을 수 있는 상태가 되고, 여행 동료도 초대할 수 있어요.',
  'verify.pending.wrongAddress': '주소가 다른가요?',
  'verify.pending.changeIt': '설정에서 바꾸기',
  'verify.pending.title': '링크는 24시간 동안 유효해요',
  'verify.pending.body':
    '받은 편지함에 아무것도 없나요? 스팸함을 확인한 뒤 다시 보내 주세요.',
  'verify.pending.resentTitle': '방금 다시 보냈어요',
  'verify.pending.resentBody':
    '1분쯤 기다린 뒤 받은 편지함과 스팸함을 확인해 주세요.',
  'verify.pending.resend': '확인 메일 다시 보내기',
  'verify.pending.resending': '다시 보내는 중',
  'verify.pending.continue': '그대로 계속하기',
  'verify.request.eyebrow': '이메일 확인',
  'verify.request.heading': '새 확인 링크 보내기',
  'verify.request.description':
    '확인 링크는 24시간 동안 유효하고 한 번만 쓸 수 있어요. 주소를 알려 주시면 새 링크를 바로 보내 드려요.',
  'verify.request.submit': '확인 링크 보내기',
  'verify.request.submitting': '링크를 보내는 중',
  'verify.request.sentTitle': '보내는 중이에요',
  'verify.request.sentBody':
    '그 주소로 확인을 기다리는 계정이 있다면, 링크가 지금 편지함에 있어요.',
  'verify.request.change': '다른 이메일 쓰기',
  'verify.request.back': '로그인으로 돌아가기',
  'invitation.eyebrow': '워크스페이스 초대',
  'invitation.heading': '{workspace}에 참여하기',
  'invitation.description':
    '수락하면 이 워크스페이스의 멤버가 되고, 여행과 예산, 목록을 함께 보게 돼요.',
  'invitation.invitedAs': '{email} 주소로 초대됐어요',
  'invitation.role': '내 역할',
  'invitation.means': '할 수 있는 일',
  'invitation.invitedBy': '초대한 사람',
  'invitation.expires': '만료',
  'invitation.accept': '초대 수락',
  'invitation.accepting': '워크스페이스에 참여하는 중',
  'invitation.decline': '거절',
  'invitation.declining': '거절하는 중',
  'invitation.reassurance':
    '워크스페이스는 설정에서 언제든 나갈 수 있고, 그 밖에서 만든 것은 절대 공유되지 않아요.',
  'invitation.role.owner': '소유자 — 결제까지 포함해 모든 것을 관리해요',
  'invitation.role.admin': '관리자 — 여행과 멤버, 설정을 관리해요',
  'invitation.role.member': '멤버 — 다른 사람들과 함께 여행을 계획해요',
  'invitation.role.other': '{role} — 권한은 워크스페이스 소유자가 정해요',
  'invitation.role.badge.owner': '소유자',
  'invitation.role.badge.admin': '관리자',
  'invitation.role.badge.member': '멤버',
  'invitation.anonymous.heading': '로그인하면 초대를 볼 수 있어요',
  'invitation.anonymous.description':
    '초대는 받은 주소에 묶여 있어서, 보여 드리기 전에 누구인지 확인해야 해요.',
  'invitation.anonymous.body':
    '초대를 받은 주소로 로그인해 주세요. 끝나면 바로 이 자리로 돌아와요.',
  'invitation.anonymous.action': '로그인하고 계속하기',
  'invitation.anonymous.noAccount': '아직 계정이 없나요?',
  'invitation.anonymous.register': '초대받은 주소로 만들기',
  'invitation.mismatch.heading': '이 초대는 다른 주소로 보낸 거예요',
  'invitation.mismatch.description':
    '지금 다른 계정으로 로그인해 있어서, 이 초대는 수락할 수 없어요.',
  'invitation.mismatch.title': '{email} 주소로 로그인 중',
  'invitation.mismatch.body':
    '로그아웃한 뒤 초대를 받은 주소로 다시 로그인하거나, 이 계정으로 새 초대를 받아 주세요.',
  'invitation.mismatch.action': '계정 바꾸기',
  'invitation.mismatch.back': '로그인으로 돌아가기',
  'invitation.unverified.heading': '참여하려면 이메일을 확인해야 해요',
  'invitation.unverified.description':
    '워크스페이스는 확인된 주소만 받아들여요. 오타 하나로 누군가 들어오는 일은 없어요.',
  'invitation.unverified.title': '{email} 주소는 아직 확인되지 않았어요',
  'invitation.unverified.body':
    '받은 편지함에서 확인 링크를 열고 이 페이지로 돌아와 주세요. 초대는 그대로 기다리고 있어요.',
  'invitation.unverified.action': '내 이메일 확인하기',
  'invitation.unverified.resend': '확인 메일 다시 보내기',
  'invitation.unavailable.heading': '이 초대는 더 이상 쓸 수 없어요',
  'invitation.unavailable.description':
    '초대는 7일 동안 유효하고, 쓰이거나 취소되는 순간 만료돼요.',
  'invitation.unavailable.title': '여기서 수락할 초대가 없어요',
  'invitation.unavailable.body':
    '초대한 사람에게 새 초대를 부탁하면 이 페이지에 바로 나타나요.',
  'invitation.unavailable.dashboard': '대시보드로 가기',
  'invitation.declined.eyebrow': '초대를 거절했어요',
  'invitation.declined.heading': '괜찮아요 — 아무것도 공유되지 않았어요',
  'invitation.declined.description':
    '워크스페이스 소유자에게 알렸어요. 이 링크는 더 이상 쓸 수 없어요.',
  'invitation.declined.action': '대시보드로 가기',
  'error.unexpected.title': '문제가 생겼어요',
  'error.unexpected.detail': '잘 되지 않았어요. 잠시 뒤에 다시 시도해 주세요.',
  'error.rateLimited.title': '시도가 너무 많아요',
  'error.rateLimited.detail':
    '안전을 위해 이 기기에서의 로그인을 몇 분 동안 잠시 멈췄어요. 곧 다시 시도해 주세요.',
  'error.offline.title': '연결이 없어요',
  'error.offline.detail':
    'planned.travel에 닿지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
  'error.credentials.title': '입력한 정보가 맞지 않아요',
  'error.credentials.detail':
    '이메일 주소와 비밀번호를 확인하고 다시 시도해 주세요. Google이나 Apple로 가입했다면 그 버튼을 써 주세요.',
  'error.password.title': '입력한 정보가 맞지 않아요',
  'error.password.detail':
    '이메일 주소와 비밀번호를 확인하고 다시 시도해 주세요.',
  'error.noPassword.title': '이 계정에는 비밀번호가 없어요',
  'error.noPassword.detail':
    '이 계정은 소셜 로그인이나 패스키로 로그인해요. 위에 있는 방법 중 하나를 써 주세요.',
  'error.unverified.title': '먼저 이메일을 확인해 주세요',
  'error.unverified.detail':
    '가입할 때 확인 링크를 보내 드렸어요. 그 링크를 열고 여기로 돌아와 주세요.',
  'error.emailTaken.title': '이미 등록된 이메일이에요',
  'error.emailTaken.detail':
    '그대로 로그인하거나, 잊으셨다면 비밀번호를 재설정해 주세요.',
  'error.noAccount.title': '그 계정을 찾지 못했어요',
  'error.noAccount.detail': '주소를 확인하거나 새 계정을 만들어 주세요.',
  'error.passwordTooShort.title': '비밀번호가 너무 짧아요',
  'error.passwordTooShort.detail': '더 긴 문장을 골라 다시 시도해 주세요.',
  'error.passwordTooLong.title': '비밀번호가 너무 길어요',
  'error.passwordTooLong.detail': '더 짧은 문장을 골라 다시 시도해 주세요.',
  'error.linkSpent.title': '이 링크는 더 이상 유효하지 않아요',
  'error.linkSpent.detail':
    '비밀번호 링크는 한 번만 쓸 수 있어요. 새로 요청하면 바로 메일로 보내 드려요.',
  'error.linkExpired.title': '이 링크는 만료됐어요',
  'error.linkExpired.detail': '새로 요청하면 바로 메일로 보내 드려요.',
  'error.linkIncomplete.title': '이 링크는 중간이 잘렸어요',
  'error.linkIncomplete.detail':
    '비밀번호 재설정 링크에는 한 번만 쓰는 토큰이 들어 있어요. 가장 최근 메일을 열거나 새 링크를 요청해 주세요.',
  'error.sessionExpired.title': '세션이 만료됐어요',
  'error.sessionExpired.detail':
    '다시 로그인하면 멈춘 자리에서 이어 갈 수 있어요.',
  'error.alreadyVerified.title': '이미 확인됐어요',
  'error.alreadyVerified.detail':
    '이 이메일 주소는 확인이 끝났어요. 평소처럼 로그인하면 돼요.',
  'error.badCode.title': '그 코드는 통하지 않았어요',
  'error.badCode.detail':
    '인증 앱 코드는 30초마다 바뀌어요. 다음 코드를 기다려 여섯 자리를 모두 입력해 주세요.',
  'error.badBackupCode.title': '그 백업 코드는 통하지 않았어요',
  'error.badBackupCode.detail':
    '백업 코드는 한 번만 쓸 수 있어요. 목록에서 아직 쓰지 않은 코드를 시도해 주세요.',
  'error.locked.title': '계정을 잠시 잠갔어요',
  'error.locked.detail':
    '인증 실패가 이어졌어요. 안전을 위해 이 계정을 몇 분 동안 잠가 둡니다.',
  'error.noTwoFactor.title': '2단계 인증이 설정되어 있지 않아요',
  'error.noTwoFactor.detail': '이메일과 비밀번호로 로그인해서 계속해 주세요.',
  'error.twoFactorExpired.title': '로그인부터 다시 해 주세요',
  'error.twoFactorExpired.detail':
    '이 인증 단계가 만료됐어요. 이메일과 비밀번호를 한 번 더 입력해 주세요.',
  'error.invitationGone.title': '이 초대는 더 이상 쓸 수 없어요',
  'error.invitationGone.detail':
    '만료되거나 취소됐거나 이미 쓰였을 수 있어요. 새 초대를 부탁해 주세요.',
  'error.invitationOther.title': '이 초대는 다른 사람 것이에요',
  'error.invitationOther.detail':
    '다른 이메일 주소로 보낸 초대예요. 그 주소로 로그인하면 수락할 수 있어요.',
  'error.alreadyMember.title': '이미 이 워크스페이스에 있어요',
  'error.alreadyMember.detail':
    '수락할 초대가 없어요. 워크스페이스 전환 메뉴에서 열어 주세요.',
  'error.workspaceFull.title': '이 워크스페이스는 자리가 없어요',
  'error.workspaceFull.detail':
    '멤버 한도에 도달했어요. 소유자에게 자리를 비워 달라고 하거나 플랜을 올려 달라고 해 주세요.',
  'error.verifyBeforeJoin.title': '먼저 이메일을 확인해 주세요',
  'error.verifyBeforeJoin.detail':
    '보내 드린 확인 링크를 열고 이 초대로 돌아와 주세요.',

  'passkeyNotice.added': '계정에 패스키가 추가되었습니다',
  'passkeyNotice.removed': '계정에서 패스키가 삭제되었습니다',
  'passkeyNotice.security': '보안',
  'passkeyNotice.action': '패스키 관리',
  'passkeyNotice.recovery':
    '이 변경을 알지 못한다면 비밀번호를 변경하고 알 수 없는 세션을 종료하세요. 비밀번호를 재설정해도 패스키는 삭제되지 않습니다. 패스키를 검토하고 알 수 없는 패스키를 삭제하세요.',
} satisfies TranslationOf<typeof En>

export default messages
