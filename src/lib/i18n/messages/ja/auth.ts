/**
 * The sign-in, sign-up, recovery and invitation screens, in Japanese.
 *
 * Authored from `../en/auth`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Japanese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. The number still arrives already grouped by the formatter, and
 * the counter that follows it (泊, 日, 件, 名) is chosen per message rather than
 * bolted on, because Japanese picks a different counter for nights, days,
 * records and people.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  'shell.home': 'planned.travel ホーム',
  'shell.legal':
    '続けると、planned.travel の利用規約とプライバシーに関するお知らせに同意したことになります。',
  'panel.eyebrow': 'みんなで計画',
  'panel.heading': '最初のピンから最後の絵はがきまで、すべての旅を。',
  'panel.body':
    '本物の地図で共有する旅程、きちんと合う予算、覚えておいてくれる持ち物リスト、そして残す価値のある旅の記録。',
  'panel.map.title': '地図はひとつ、計画もひとつ',
  'panel.map.detail': '立ち寄り先、宿泊、移動をひとつの旅程にまとめます。',
  'panel.group.title': '全員が同じ歩調で',
  'panel.group.detail': '編集も投票もコメントも、その場で全員に届きます。',
  'panel.costs.title': '費用がきちんと合う',
  'panel.costs.detail':
    '共有の予算、精算まで済む残高、表計算ソフトは不要です。',
  'divider.or': 'または',
  'divider.orEmail': 'またはメールアドレスで',
  'social.continue': '{provider}で続ける',
  'social.signUp': '{provider}で登録',
  'social.opening': '{provider}を開いています',
  'passkey.action': 'パスキーでサインイン',
  'passkey.waiting': 'お使いのデバイスを待っています',
  'password.show': 'パスワードを表示',
  'password.hide': 'パスワードを隠す',
  'password.showNew': '新しいパスワードを表示',
  'password.hideNew': '新しいパスワードを隠す',
  'password.showConfirm': '確認用パスワードを表示',
  'password.hideConfirm': '確認用パスワードを隠す',
  'field.email': 'メールアドレス',
  'field.email.placeholder': 'name@example.com',
  'field.password': 'パスワード',
  'field.password.placeholder': 'お使いのパスワード',
  'field.newPassword': '新しいパスワード',
  'field.newPassword.placeholder': '覚えておけるフレーズ',
  'field.confirmPassword': 'パスワードの確認',
  'field.confirmNewPassword': '新しいパスワードの確認',
  'field.confirmPassword.placeholder': 'もう一度入力してください',
  'field.name': 'お名前',
  'field.name.hint': '一緒に旅を計画する人に表示されます。',
  'field.name.placeholder': '山田 花子',
  'validation.emailRequired': 'メールアドレスを入力してください。',
  'validation.emailTooLong': 'そのメールアドレスは長すぎます。',
  'validation.emailInvalid': 'メールアドレスの形式になっていないようです。',
  'validation.passwordRequired': 'パスワードを入力してください。',
  'validation.passwordShort': {
    other:
      '{value}文字以上にしてください。ひねった単語より短いフレーズのほうが強くなります。',
  },
  'validation.passwordLong': { other: '{value}文字以内にしてください。' },
  'validation.passwordMismatch': 'パスワードが一致していません。',
  'validation.nameShort':
    '旅の仲間があなたを見分けられるように、お名前を入力してください。',
  'validation.nameTooLong': 'そのお名前は長すぎます。',
  'validation.termsRequired': '続けるには利用規約に同意してください。',
  'validation.codeLength': '認証アプリのコードは6桁です。',
  'validation.codeDigits': '認証アプリのコードは数字だけです。',
  'validation.backupShort': 'そのバックアップコードは短すぎるようです。',
  'validation.backupLong': 'そのバックアップコードは長すぎるようです。',
  'login.eyebrow': 'おかえりなさい',
  'login.heading': 'planned.travel にサインイン',
  'login.description':
    '旅程も予算もリストも、中断したところからそのまま続けられます。',
  'login.newHere': 'はじめてですか？',
  'login.createAccount': 'アカウントを作成',
  'login.forgot': 'パスワードをお忘れですか？',
  'login.remember': 'このデバイスではサインインしたままにする',
  'login.submit': 'サインイン',
  'login.submitting': 'サインインしています',
  'register.eyebrow': 'アカウントを作成',
  'register.heading': '数分で計画を始められます',
  'register.description':
    'ひとつのアカウントで、すべての旅、すべての同行者、すべてのリストをまとめられます。',
  'register.haveAccount': 'すでにアカウントをお持ちですか？',
  'register.signIn': 'サインイン',
  'register.terms': '利用規約とプライバシーに関するお知らせに同意します。',
  'register.submit': 'アカウントを作成',
  'register.submitting': 'アカウントを作成しています',
  'strength.hint': {
    other:
      '{value}文字以上。ひねった単語より短いフレーズのほうが強くなります。',
  },
  'strength.tooShort': '強度: 短すぎます',
  'strength.weak': '強度: 弱い',
  'strength.fair': '強度: ふつう',
  'strength.strong': '強度: 強い',
  'strength.excellent': '強度: とても強い',
  'forgot.eyebrow': 'パスワードのお困りごと',
  'forgot.heading': 'パスワードを再設定',
  'forgot.description':
    'アカウントに登録したアドレスを教えてください。新しいパスワードを設定するリンクをメールでお送りします。',
  'forgot.submit': '再設定リンクを送る',
  'forgot.submitting': 'リンクを送信中',
  'forgot.back': 'サインインに戻る',
  'forgot.sent.eyebrow': '受信トレイをご確認ください',
  'forgot.sent.heading': '再設定リンクを送信しました',
  'forgot.sent.description':
    '{email}のアカウントがあれば、新しいパスワードを設定するリンクがその受信トレイに届いています。',
  'forgot.sent.title': 'リンクは1時間だけ、1回だけ使えます',
  'forgot.sent.body':
    '届いていませんか？迷惑メールを確認して、もう一度送ってください。新しいリンクを送ると、前のリンクは静かに無効になります。',
  'forgot.sent.resend': 'もう一度送る',
  'forgot.sent.resending': '再送信中',
  'forgot.sent.change': '別のメールアドレスを使う',
  'reset.eyebrow': 'パスワードの再設定',
  'reset.heading': '新しいパスワードを決める',
  'reset.description': {
    other:
      '{value}文字以上のものにしてください。短いフレーズは覚えやすく、しかも推測されにくくなります。',
  },
  'reset.submit': '新しいパスワードを設定',
  'reset.submitting': 'パスワードを保存しています',
  'reset.back': 'サインインに戻る',
  'reset.stale.heading': 'このリンクは使えません',
  'reset.stale.description':
    '再設定リンクは1時間で期限切れになり、1回しか使えません。それがいちばん安全な取引です。',
  'reset.stale.action': '新しいリンクを申し込む',
  'reset.done.heading': '新しいパスワードを設定しました',
  'reset.done.description':
    'ほかのセッションはすべてサインアウトされたので、古いパスワードを知っていた人にも入る手立てはありません。',
  'reset.done.title': 'ほかの場所ではサインアウトしました',
  'reset.done.body': '新しいパスワードでサインインして、計画を続けましょう。',
  'reset.done.action': 'サインイン',
  'twoFactor.eyebrow': '二段階認証',
  'twoFactor.heading': 'ご本人かどうか確認します',
  'twoFactor.description':
    'このアカウントは二要素で保護されています。認証アプリに表示されている現在のコードを入力してください。',
  'twoFactor.back': 'サインインからやり直す',
  'twoFactor.methods': '認証の方法',
  'twoFactor.totp.tab': '認証アプリ',
  'twoFactor.totp.label': '6桁のコード',
  'twoFactor.totp.hint': 'コードは30秒ごとに切り替わります。',
  'twoFactor.totp.submit': '確認して続ける',
  'twoFactor.backup.tab': 'バックアップコード',
  'twoFactor.backup.label': 'バックアップコード',
  'twoFactor.backup.hint':
    '二段階認証を有効にしたときに保存したリストのコードです。1つのコードは1回だけ使えます。',
  'twoFactor.backup.submit': 'バックアップコードを使う',
  'twoFactor.submitting': 'コードを確認しています',
  'twoFactor.trust.label': 'このデバイスを30日間信頼する',
  'twoFactor.trust.detail':
    'それまでこのブラウザではこの手順を省きます。自分だけが使うデバイスでのみ有効にしてください。',
  'verify.done.eyebrow': 'メールアドレスを確認しました',
  'verify.done.heading': '準備は完了です',
  'verify.done.description':
    'アドレスが確認できたので、招待やリマインダー、旅のダイジェストがきちんと届きます。',
  'verify.done.title': '確認済み',
  'verify.done.body': 'このアカウントで{email}が確認されました。',
  'verify.done.bodyUnknown': 'このアカウントのメールアドレスは確認済みです。',
  'verify.done.action': 'ダッシュボードへ',
  'verify.pending.eyebrow': 'あと一歩です',
  'verify.pending.heading': 'メールアドレスを確認してください',
  'verify.pending.description':
    '{email}に確認リンクを送りました。開いておけばアカウントを復旧できる状態になり、旅の仲間から招待も受けられます。',
  'verify.pending.wrongAddress': 'アドレスが違いますか？',
  'verify.pending.changeIt': '設定で変更する',
  'verify.pending.title': 'リンクの有効期間は24時間です',
  'verify.pending.body':
    '受信トレイに何も届いていませんか？迷惑メールを確認して、もう一度送ってください。',
  'verify.pending.resentTitle': 'たったいま再送しました',
  'verify.pending.resentBody':
    '1分ほど待ってから、受信トレイと迷惑メールフォルダーを確認してください。',
  'verify.pending.resend': '確認メールを再送',
  'verify.pending.resending': '再送信中',
  'verify.pending.continue': 'このまま続ける',
  'verify.request.eyebrow': 'メールアドレスの確認',
  'verify.request.heading': '新しい確認リンクを送る',
  'verify.request.description':
    '確認リンクの有効期間は24時間で、1回だけ使えます。アドレスを教えていただければ、新しいリンクをすぐにお送りします。',
  'verify.request.submit': '確認リンクを送る',
  'verify.request.submitting': 'リンクを送信中',
  'verify.request.sentTitle': '送信しました',
  'verify.request.sentBody':
    'そのアドレスに確認待ちのアカウントがあれば、リンクはもう受信トレイに届いています。',
  'verify.request.change': '別のメールアドレスを使う',
  'verify.request.back': 'サインインに戻る',
  'invitation.eyebrow': 'ワークスペースへの招待',
  'invitation.heading': '{workspace}に参加',
  'invitation.description':
    '受けると、このワークスペースのメンバーになり、旅も予算もリストも共有されます。',
  'invitation.invitedAs': '{email}として招待されています',
  'invitation.role': 'あなたの役割',
  'invitation.means': 'できること',
  'invitation.invitedBy': '招待した人',
  'invitation.expires': '有効期限',
  'invitation.accept': '招待を受ける',
  'invitation.accepting': 'ワークスペースに参加しています',
  'invitation.decline': '辞退する',
  'invitation.declining': '辞退しています',
  'invitation.reassurance':
    'ワークスペースはいつでも設定から離れられます。その外で作ったものが共有されることはありません。',
  'invitation.role.owner': 'オーナー — 請求を含めてすべてを管理できます',
  'invitation.role.admin': '管理者 — 旅、メンバー、設定を管理できます',
  'invitation.role.member': 'メンバー — ほかの全員と一緒に旅を計画できます',
  'invitation.role.other': '{role} — 権限はワークスペースのオーナーが決めます',
  'invitation.role.badge.owner': 'オーナー',
  'invitation.role.badge.admin': '管理者',
  'invitation.role.badge.member': 'メンバー',
  'invitation.anonymous.heading': 'サインインすると招待を確認できます',
  'invitation.anonymous.description':
    '招待は送信先のアドレスに結びついているので、お見せする前にご本人かどうかを確かめる必要があります。',
  'invitation.anonymous.body':
    '招待が届いたアドレスでサインインしてください。そのあとまっすぐここへ戻ってきます。',
  'invitation.anonymous.action': 'サインインして続ける',
  'invitation.anonymous.noAccount': 'アカウントはまだありませんか？',
  'invitation.anonymous.register': '招待されたアドレスで作る',
  'invitation.mismatch.heading': 'この招待は別のアドレス宛てです',
  'invitation.mismatch.description':
    'いま別のアカウントでサインインしているため、この招待はあなたが受けられるものではありません。',
  'invitation.mismatch.title': '{email}としてサインイン中',
  'invitation.mismatch.body':
    'サインアウトして招待が届いたアドレスで入り直すか、このアカウント宛てに新しい招待を送ってもらってください。',
  'invitation.mismatch.action': 'アカウントを切り替える',
  'invitation.mismatch.back': 'サインインに戻る',
  'invitation.unverified.heading': '参加するにはメールアドレスの確認が必要です',
  'invitation.unverified.description':
    'ワークスペースは確認済みのアドレスしか受け付けません。打ち間違いで誰かが入ってしまうことはありません。',
  'invitation.unverified.title': '{email}はまだ確認されていません',
  'invitation.unverified.body':
    '受信トレイの確認リンクを開いてから、このページに戻ってください。招待はそのまま待っています。',
  'invitation.unverified.action': 'メールアドレスを確認する',
  'invitation.unverified.resend': '確認メールを再送する',
  'invitation.unavailable.heading': 'この招待はもう使えません',
  'invitation.unavailable.description':
    '招待の有効期間は7日間で、使われた瞬間や取り消された瞬間に役目を終えます。',
  'invitation.unavailable.title': 'ここで受けられる招待はありません',
  'invitation.unavailable.body':
    '招待した人に新しい招待を送ってもらえば、このページにすぐ表示されます。',
  'invitation.unavailable.dashboard': 'ダッシュボードへ',
  'invitation.declined.eyebrow': '招待を辞退しました',
  'invitation.declined.heading': 'だいじょうぶです — 何も共有されていません',
  'invitation.declined.description':
    'ワークスペースのオーナーには伝わりました。このリンクはもう使えません。',
  'invitation.declined.action': 'ダッシュボードへ',
  'error.unexpected.title': '問題が起きました',
  'error.unexpected.detail':
    'うまくいきませんでした。少し時間をおいて、もう一度お試しください。',
  'error.rateLimited.title': '試行が多すぎます',
  'error.rateLimited.detail':
    '安全のため、このデバイスからのサインインを数分間止めています。少ししてからお試しください。',
  'error.offline.title': '接続がありません',
  'error.offline.detail':
    'planned.travel に接続できませんでした。通信状況を確認して、もう一度お試しください。',
  'error.credentials.title': 'その情報は一致しません',
  'error.credentials.detail':
    'メールアドレスとパスワードを確認して、もう一度お試しください。Google や Apple で登録した場合は、そのボタンをお使いください。',
  'error.password.title': 'その情報は一致しません',
  'error.password.detail':
    'メールアドレスとパスワードを確認して、もう一度お試しください。',
  'error.noPassword.title': 'このアカウントにパスワードはありません',
  'error.noPassword.detail':
    'このアカウントはソーシャルログインかパスキーでサインインします。上のいずれかをお使いください。',
  'error.unverified.title': '先にメールアドレスを確認してください',
  'error.unverified.detail':
    '登録時に確認リンクをお送りしました。それを開いてから、ここへ戻ってきてください。',
  'error.emailTaken.title': 'そのメールアドレスは登録済みです',
  'error.emailTaken.detail':
    'そのままサインインするか、お忘れならパスワードを再設定してください。',
  'error.noAccount.title': 'そのアカウントが見つかりません',
  'error.noAccount.detail':
    'アドレスを確かめるか、新しくアカウントを作成してください。',
  'error.passwordTooShort.title': 'パスワードが短すぎます',
  'error.passwordTooShort.detail':
    'もっと長いフレーズを選んで、もう一度お試しください。',
  'error.passwordTooLong.title': 'パスワードが長すぎます',
  'error.passwordTooLong.detail':
    'もっと短いフレーズを選んで、もう一度お試しください。',
  'error.linkSpent.title': 'このリンクは無効になりました',
  'error.linkSpent.detail':
    'パスワードのリンクは1回しか使えません。申し込めば、新しいリンクをすぐメールでお送りします。',
  'error.linkExpired.title': 'このリンクは期限切れです',
  'error.linkExpired.detail':
    '新しいものを申し込めば、すぐメールでお送りします。',
  'error.linkIncomplete.title': 'このリンクは途中で切れています',
  'error.linkIncomplete.detail':
    'パスワード再設定リンクには一度だけ使えるトークンが付いています。最新のメールを開くか、新しいリンクを申し込んでください。',
  'error.sessionExpired.title': 'セッションの期限が切れました',
  'error.sessionExpired.detail':
    'もう一度サインインすれば、中断したところから続けられます。',
  'error.alreadyVerified.title': 'すでに確認済みです',
  'error.alreadyVerified.detail':
    'このメールアドレスは確認済みです。いつもどおりサインインできます。',
  'error.badCode.title': 'そのコードは通りませんでした',
  'error.badCode.detail':
    '認証アプリのコードは30秒で切り替わります。次のコードを待って、6桁すべてを入力してください。',
  'error.badBackupCode.title': 'そのバックアップコードは通りませんでした',
  'error.badBackupCode.detail':
    'バックアップコードは1回だけ使えます。リストの未使用のコードをお試しください。',
  'error.locked.title': 'アカウントを一時的にロックしました',
  'error.locked.detail':
    '認証の失敗が続いたため、安全のためこのアカウントを数分間ロックしています。',
  'error.twoFactorOn.title': '二要素認証はすでに有効です',
  'error.twoFactorOn.detail':
    '再設定すると現在の認証アプリが使えなくなるため、変更は行いませんでした。ここから管理できます。',
  'error.noTwoFactor.title': '二段階認証は設定されていません',
  'error.noTwoFactor.detail':
    'メールアドレスとパスワードでサインインして続けてください。',
  'error.twoFactorExpired.title': 'サインインからやり直してください',
  'error.twoFactorExpired.detail':
    'この確認の手順は期限切れになりました。メールアドレスとパスワードをもう一度入力してください。',
  'error.invitationGone.title': 'この招待はもう使えません',
  'error.invitationGone.detail':
    '期限切れか、取り消されたか、すでに使われた可能性があります。新しい招待を送ってもらってください。',
  'error.invitationOther.title': 'この招待はほかの人宛てです',
  'error.invitationOther.detail':
    '別のメールアドレスに送られています。そのアドレスでサインインすれば受けられます。',
  'error.alreadyMember.title': 'すでにこのワークスペースのメンバーです',
  'error.alreadyMember.detail':
    '受ける招待はありません。ワークスペースの切り替えから開いてください。',
  'error.workspaceFull.title': 'このワークスペースは満席です',
  'error.workspaceFull.detail':
    'メンバー数の上限に達しています。オーナーに席を空けてもらうか、プランを上げてもらってください。',
  'error.verifyBeforeJoin.title': '先にメールアドレスを確認してください',
  'error.verifyBeforeJoin.detail':
    'お送りした確認リンクを開いてから、この招待に戻ってきてください。',

  'passkeyNotice.added': 'アカウントにパスキーが追加されました',
  'passkeyNotice.removed': 'アカウントからパスキーが削除されました',
  'passkeyNotice.security': 'セキュリティ',
  'passkeyNotice.action': 'パスキーを管理',
  'passkeyNotice.recovery':
    'この変更に心当たりがない場合は、パスワードを変更し、見覚えのないセッションを終了してください。パスワードをリセットしてもパスキーは削除されません。パスキーを確認し、見覚えのないものを削除してください。',
} satisfies TranslationOf<typeof En>

export default messages
