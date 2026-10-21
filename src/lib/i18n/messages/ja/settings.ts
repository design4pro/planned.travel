/**
 * The settings screens — profile, language, appearance, security,
 * notifications, workspace and billing, in Japanese.
 *
 * Authored from `../en/settings`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Japanese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. The number still arrives already grouped by the formatter, and
 * the counter that follows it (泊, 日, 件, 名) is chosen per message rather than
 * bolted on, because Japanese picks a different counter for nights, days,
 * records and people.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  'workspace.invite.invite': '招待',
  'workspace.invite.resend': '再送信',
  'workspace.invite.revoke': '取り消す',
  'workspace.invite.confirm': '招待を取り消す',
  'workspace.invite.expired': '期限切れ',
  'workspace.invite.by': '招待者: {name}',
  'workspace.invite.sent': '招待を送信しました',
  'workspace.invite.revoked': '招待を取り消しました',
  'workspace.invite.delivery':
    '招待は保存されましたが、メールを送信できませんでした。再送信してください。',
  'workspace.invite.duplicate':
    '保留中の招待が既にあります。再送信してください。',
  'workspace.invite.existing':
    'このユーザーは既にワークスペースのメンバーです。',
  'workspace.invite.failed':
    '招待を利用できません。一覧を更新して再試行してください。',
  'workspace.invite.reload': '招待を更新',

  'page.eyebrow': 'アカウント',
  'page.title': '設定',
  'page.description':
    'あなた自身、ワークスペース、そして planned.travel のふるまいに関するすべて',
  'page.error': '設定を読み込めませんでした',
  'nav.label': '設定のセクション',
  'nav.profile': 'プロフィール',
  'nav.profile.hint': 'あなた、そして日付とお金の読み方',
  'nav.language': '言語',
  'nav.language.hint': 'すべての画面が話す言語',
  'nav.appearance': '表示',
  'nav.appearance.hint': 'テーマ、モーション、地図',
  'nav.security': 'セキュリティ',
  'nav.security.hint': 'パスワード、二段階認証、パスキー',
  'nav.notifications': '通知',
  'nav.notifications.hint': '受信箱、メール、プッシュ',
  'nav.workspace': 'ワークスペース',
  'nav.workspace.hint': 'メンバーと共有の初期値',
  'nav.billing': '請求',
  'nav.billing.hint': 'プラン、席数、請求書',
  'action.save': '変更を保存',
  'error.retryBody':
    '何も失われていません。通信状況を確認して、もう一度お試しください。',
  'role.owner': 'オーナー',
  'role.admin': '管理者',
  'role.member': 'メンバー',
  /**
   * Not「ワークスペースの初期値」, which is the phrase this catalogue uses
   * everywhere else for the same idea. This one string is the label of a
   * `.truncate` Select trigger with a 206px budget, and eleven full-width
   * glyphs plus a formatted value measured 235px there — the only place any
   * of the four CJK catalogues clipped. 共有の初期値 keeps the meaning that
   * matters (a default inherited rather than chosen here) in six glyphs and
   * lands at ~172px. Do not restore the longer form without re-measuring.
   */
  'regional.workspaceDefault': '共有の初期値 — {value}',
  'regional.currency.AUD': 'オーストラリアドル',
  'regional.currency.CAD': 'カナダドル',
  'regional.currency.CHF': 'スイスフラン',
  'regional.currency.EUR': 'ユーロ',
  'regional.currency.GBP': '英ポンド',
  'regional.currency.JPY': '日本円',
  'regional.currency.PLN': 'ポーランドズウォティ',
  'regional.currency.SEK': 'スウェーデンクローナ',
  'regional.currency.USD': '米ドル',
  'regional.distance.metric': 'キロメートル',
  'regional.distance.imperial': 'マイル',
  'profile.error': 'プロフィールを読み込めませんでした',
  'profile.account.title': 'あなたのアカウント',
  'profile.account.description':
    'お名前とメールアドレスは、サインインに使うアカウントから取り込まれます。',
  'profile.email.verified': 'メールアドレス確認済み',
  'profile.email.unverified': 'メールアドレス未確認',
  'profile.twoFactor.on': '二段階認証オン',
  'profile.figure.workspace': 'ワークスペース',
  'profile.figure.role': '役割',
  'profile.figure.joined': '参加した日',
  'profile.figure.joinedUnknown': '記録なし',
  'profile.regional.title': '日付、お金、単位',
  'profile.regional.description':
    'ここでの設定は、あなただけワークスペースの初期値より優先されます。初期値のままにしておけば、ワークスペースに従います。',
  'profile.regional.saving': '設定を保存しています',
  'profile.regional.saved': '設定を保存しました',
  'profile.regional.saveFailed': '設定を保存できませんでした',
  'profile.language.label': '言語',
  'profile.language.hint':
    '専用の画面で選びます。どの言語も、その言語自身の文字で書かれています。',
  'profile.language.action': '変更',
  'profile.timezone.label': 'タイムゾーン',
  'profile.timezone.hint': '出発と到着の時刻は、これを基準に表示します。',
  'profile.currency.label': '通貨',
  'profile.currency.hint':
    '新しい旅はこの通貨で始まります。旅ごとに変えられます。',
  'profile.dateFormat.label': '日付の形式',
  'profile.weekStart.label': '週の始まり',
  'profile.weekStart.hint':
    '休暇の年間カレンダーを含め、すべてのカレンダーに適用されます。',
  'profile.distance.label': '距離',
  'language.error': '言語の設定を読み込めませんでした',
  'language.section.title': '言語',
  'language.section.description':
    'すべての画面、すべてのボタン、すべての日付が、ここで選んだ言語で読めます。23の言語が、それぞれの文字で並んでいます。',
  'language.label': '言語を選ぶ',
  'language.followWorkspace': 'ワークスペースに従う',
  'language.state.yours': 'あなたの言語',
  'language.state.workspace': 'ワークスペースから',
  'language.state.hint.override':
    'あなた自身の選択です。サインインするどのデバイスでも、あなたにだけ適用されます。',
  'language.state.hint.workspace':
    'あなた専用の言語はないので、ワークスペースの設定で読むことになります。オーナーか管理者が「ワークスペース」から変えられます。',
  /**
   * Spoken in the language just chosen — this is the one message a
   * traveller reads immediately after switching, so it has to sound native
   * rather than translated.
   */
  'language.saved': 'planned.travel は{language}で話します',
  'language.saveFailed': '言語を変更できませんでした',
  'language.saveFailedBody':
    '何も失われておらず、いまも{language}で表示しています。通信状況を確認して、もう一度選んでください。',
  'language.reload.title': '言語を保存しました',
  'language.reload.body':
    'このページは{language}への切り替えを終えられませんでした。再読み込みすると、新しい言語で読めます。',
  'language.sample.title': '日付と数字の見え方',
  'language.sample.description':
    '同じ3つの値を、この言語の書き方で並べています。',
  'language.sample.date': '日付',
  'language.sample.number': '数字',
  'language.sample.money': '金額',
  'language.legal':
    '利用規約とプライバシーに関するお知らせは英語のみで公開しています。ほかはすべて翻訳されています。',
  'appearance.error': '表示の設定を読み込めませんでした',
  'appearance.theme.title': 'テーマ',
  'appearance.theme.description':
    'どちらのテーマも反転ではなく、それぞれ設計しています。読みやすいほうを選んでください。',
  'appearance.theme.light': 'ライト',
  'appearance.theme.lightHint': '一日じゅう、温かみのある紙',
  'appearance.theme.dark': 'ダーク',
  'appearance.theme.darkHint': '黒ではなく、温かみのある炭',
  'appearance.theme.system': 'システム',
  'appearance.theme.systemHint': 'デバイスに従う',
  'appearance.theme.showing': 'いまは{palette}のパレットを表示しています。',
  'appearance.theme.showingSystem':
    'いまはデバイスに従って、{palette}のパレットを表示しています。',
  'appearance.palette.light': 'ライト',
  'appearance.palette.dark': 'ダーク',
  'appearance.motion.title': 'モーションと地図',
  'appearance.motion.label': 'モーションを減らす',
  'appearance.motion.hint':
    '表示のアニメーションを控えめなフェードにします。OS 側のモーション低減設定も、常に尊重します。',
  'appearance.map.label': '地図のスタイル',
  'appearance.map.hint': 'プランナーとアトラスで使う地図です。',
  'appearance.map.workspace': 'ワークスペースに従う',
  'appearance.map.workspaceHint':
    'ワークスペースの所有者が選んだスタイルです。',
  'appearance.map.auto': '自動',
  'appearance.map.autoHint': 'ライトテーマかダークテーマに合わせます。',
  'appearance.map.paper': '紙',
  'appearance.map.paperHint': 'どのテーマでも、温かく明るいままです。',
  'appearance.map.charcoal': '炭',
  'appearance.map.charcoalHint': 'どのテーマでも、温かく暗いままです。',
  'appearance.map.quiet': '静か',
  'appearance.map.quietHint': '道路名を出さないので、ピンが先に目に入ります。',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': '共有している画面では',
  'appearance.privacy.codesLabel': '確認コードは求めるまで隠す',
  'appearance.privacy.codesHint':
    '予約番号と確認コードは、予約デスクと移動の画面では伏せたままにし、クリックかタップしたときだけ表示して、ほかの操作に移ると再び伏せます。金額が伏せられることはありません。',
  'appearance.saveFailed': 'その変更は保存されませんでした',
  'appearance.saveFailedBody':
    'ここには反映されていますが、次に別のデバイスでサインインすると元に戻ります。',
  'security.error': 'セキュリティ設定を読み込めませんでした',
  'security.unverified.title': 'メールアドレスはまだ確認されていません',
  'security.unverified.body':
    'パスワードの再設定や旅への招待は{email}に届きます。確認することが、そのアドレスがあなたのものだという証明になります。',
  'security.unverified.action': 'リンクをもう一度送る',
  'security.signin.title': 'サインイン',
  'security.signin.description':
    '本人であることの確かめ方です。二段階認証もパスキーも、パスワードだけより強力です。',
  'security.email.label': 'メールアドレス',
  'security.email.verified': '確認済み',
  'security.email.unverified': '未確認',
  'security.password.label': 'パスワード',
  'security.password.hint':
    'いつでも変えられます。古いパスワードを尋ねる代わりに、一度だけ使えるリンクをお送りします。',
  'security.password.action': 'パスワードを変更',
  'security.twoFactor.label': '二段階認証',
  'security.twoFactor.onHint':
    'メールアドレスとパスワードでログインする際、信頼済みブラウザを除き認証アプリのコードが必要です。',
  'security.twoFactor.offHint':
    'パスワードに加えて、認証アプリの6桁のコードを足せます。',
  'security.twoFactor.on': 'オン',
  'security.twoFactor.off': 'オフ',
  'security.twoFactor.manage': '管理',
  'security.twoFactor.enable': 'オンにする',
  'security.passkeys.label': 'パスキー',
  'security.passkeys.hint':
    '何も入力せず、指紋認証や Face ID、セキュリティキーでサインインできます。',
  'security.passkeys.action': 'パスキーを管理',
  'security.session.title': 'このセッション',
  'security.session.description': 'いまこれを読んでいるブラウザです。',
  'security.session.label': 'サインイン中',
  'security.session.expires': '有効期限 {date}',
  'security.session.expiresSoon': 'まもなく',
  'security.session.noExpiry': '有効期限の記録なし',
  'security.signOut.label': 'サインアウト',
  'security.signOut.hint':
    'このセッションを終えて、サインイン画面に戻ります。ほかのデバイスはサインインしたままです。',
  'security.signOut.pending': 'サインアウト中',
  'security.signOut.failed': 'サインアウトできませんでした',
  'security.signOut.failedBody': '通信状況を確認して、もう一度お試しください。',
  'notifications.error': '通知の設定を読み込めませんでした',
  'notifications.title': '通知',
  'notifications.description':
    'どのスイッチも、あなただけに適用されます。オフにしても出来事そのものは止まりません。お知らせしなくなるだけです。',
  'notifications.caption': 'どの通知を、どの経路で受け取るか',
  'notifications.event': 'イベント',
  'notifications.switch': '{event}の{channel}通知',
  'notifications.saveFailed': 'その設定は保存されませんでした',
  'notifications.saveFailedBody':
    'スイッチは元に戻しました。通信状況を確認して、もう一度お試しください。',
  'notifications.channel.in_app': 'アプリ内',
  'notifications.channel.in_app.hint': '上部バーのベル',
  'notifications.channel.email': 'メール',
  'notifications.channel.email.hint': 'サインインに使うアドレスへ',
  'notifications.channel.push': 'プッシュ',
  'notifications.channel.push.hint': '許可したデバイスへ',
  'notifications.event.trip.invited': '旅への招待',
  'notifications.event.trip.invited.hint':
    '誰かが計画中の旅に、あなたを追加したとき。',
  'notifications.event.trip.updated': '計画の変更',
  'notifications.event.trip.updated.hint':
    '参加している旅で、日や立ち寄り先、日程が動いたとき。',
  'notifications.event.trip.starting_soon': '出発のリマインダー',
  'notifications.event.trip.starting_soon.hint': '旅が始まる数日前のひと声。',
  'notifications.event.reservation.reminder': '予約のリマインダー',
  'notifications.event.reservation.reminder.hint':
    '宿、席、チケットの日が近づいたとき。',
  'notifications.event.expense.added': '新しい費用',
  'notifications.event.expense.added.hint':
    '共有している旅で、誰かが使ったお金を記録したとき。',
  'notifications.event.expense.settled': '精算した残高',
  'notifications.event.expense.settled.hint':
    'あなたが関わっていた残高が支払われたとき。',
  'notifications.event.list.assigned': '割り当てられた項目',
  'notifications.event.list.assigned.hint':
    '持ち物リストやToDoの項目が、あなたの担当になったとき。',
  'notifications.event.collab.message': '旅の会話',
  'notifications.event.collab.message.hint':
    '出かける旅に、新しいメッセージが届いたとき。',
  'notifications.event.organization.invited': 'ワークスペースへの招待',
  'notifications.event.organization.invited.hint':
    'ワークスペースに招待されたとき。',
  'notifications.event.billing.plan_changed': 'プランの変更',
  'notifications.event.billing.plan_changed.hint':
    'ワークスペースのプランが変わったとき。',
  'notifications.event.billing.invoice_paid': '支払いの領収',
  'notifications.event.billing.invoice_paid.hint':
    'ワークスペースの請求書が支払われたとき。',
  'notifications.event.billing.payment_failed': '支払いの問題',
  'notifications.event.billing.payment_failed.hint':
    'ワークスペースの請求が失敗したとき。',
  'workspace.error': 'ワークスペースを読み込めませんでした',
  'workspace.summary.description': '{plan}プラン · {date}作成',
  'workspace.summary.createdRecently': '最近',
  'workspace.summary.billingAction': 'プランと請求',
  'workspace.seats.label': '使用中の席',
  /**
   * Japanese counts the whole before the part, so the limit leads and each
   * figure keeps its 席 counter.
   */
  'workspace.seats.value': '{limit}席中{used}席',
  'workspace.seats.note':
    '未処理の招待も席を使うので、ワークスペースが支払っている以上の人数にはなりません。',
  'workspace.seatsFull.title': 'このプランの席はすべて埋まっています',
  'workspace.seatsFull.body':
    '{members}と{invitations}で、{limit}席すべてが埋まっています。',
  'workspace.seatsFull.action': '席を増やす',
  'workspace.members.count': { other: 'メンバー{value}人' },
  'workspace.invitations.count': { other: '保留中の招待{value}件' },
  'workspace.members.title': 'メンバー',
  'workspace.members.description':
    'このワークスペースの旅、お金、ファイルを見られる全員です。',
  'workspace.members.tableLabel': 'このワークスペースのメンバー',
  'workspace.members.person': '人',
  'workspace.members.role': '役割',
  'workspace.members.joined': '参加',
  'workspace.invitations.title': '招待',
  'workspace.invitations.description':
    '招待したけれど、まだ参加していない人です。',
  'workspace.invitations.emptyTitle': '未処理の招待はありません',
  'workspace.invitations.emptyBody':
    'このワークスペースに招待した人は、全員すでに参加しています。',
  'workspace.invitations.expires': '有効期限 {date}',
  'workspace.invitations.expiresSoon': 'まもなく',
  'workspace.defaults.title': '共有の初期値',
  'workspace.defaults.description':
    '新しい旅と新しいメンバーが最初に使う設定です。各自プロフィールで自分用に変えられます。',
  'workspace.defaults.readOnly': '閲覧のみ',
  'workspace.defaults.saving': 'ワークスペースの初期値を保存しています',
  'workspace.defaults.saved': 'ワークスペースの初期値を保存しました',
  'workspace.defaults.saveFailed':
    'ワークスペースの初期値を保存できませんでした',
  'workspace.defaults.saveFailedBody':
    '変えられるのはオーナーか管理者だけです。通信状況を確認して、もう一度お試しください。',
  'workspace.currency.label': '初期の通貨',
  'workspace.currency.hint': '新しい旅の予算は、この通貨で立てます。',
  'workspace.language.label': '言語',
  'workspace.language.hint': '自分の言語を選んでいないメンバーが読む言語です。',
  'workspace.timezone.label': 'タイムゾーン',
  'workspace.dateFormat.label': '日付の形式',
  'workspace.weekStart.label': '週の始まり',
  'workspace.distance.label': '距離',
  'billing.error': '請求を読み込めませんでした',
  'billing.loading': 'プランと領収書を読み込んでいます',
  'billing.status.none': 'サブスクリプションなし',
  'billing.status.trialing': '試用中',
  'billing.status.active': '有効',
  'billing.status.past_due': '支払い失敗',
  'billing.status.unpaid': '未払い',
  'billing.status.paused': '一時停止',
  'billing.status.canceled': '解約済み',
  'billing.status.incomplete': '未完了',
  'billing.status.incomplete_expired': '期限切れ',
  'billing.checkout.completeTitle': '支払いを受け取りました',
  'billing.checkout.completeBody':
    '新しいプランを適用しています。Polar が確認した時点でここに表示されます。ふつうは数秒です。',
  'billing.checkout.cancelledTitle': '支払いを中止しました',
  'billing.checkout.cancelledBody':
    '請求は発生しておらず、プランも変わっていません。',
  'billing.portal.backTitle': 'Polar から戻りました',
  'billing.portal.backBody':
    'あちらで変えた内容は、Polar が確認するとすぐここに反映されます。',
  'billing.refresh': '更新',
  'billing.readOnly.title': 'あなたはこのワークスペースのメンバーです',
  'billing.readOnly.body':
    'サブスクリプションを変えられるのはオーナーか管理者だけです。以下はすべて閲覧のみです。',
  'billing.hero.label': '現在のプラン',
  'billing.hero.endsAtPeriod': '期間の終わりで終了',
  /**
   * The full-width solidus is the form Japanese sets between a price and
   * its period; the half-width one reads as a fraction bar next to kanji.
   */
  'billing.hero.perYear': '／年',
  'billing.hero.perMonth': '／月',
  'billing.hero.freeAllowance': '旅{trips}件、ひとり旅',
  'billing.hero.perSeatLine': 'メンバー{seats}人 × {price}',
  'billing.hero.singleTraveller': '旅行者ひとり',
  'billing.price.free': '無料',
  'billing.provider.opening': 'Polar を開いています',
  'billing.renewal.trialEndsToday':
    '無料期間は今日で終わります。その前に解約しない限り、最初の請求が発生します。',
  'billing.renewal.trialEndsIn': {
    other:
      '無料期間はあと{value}日で終わります。その前に解約しない限り、最初の請求が発生します。',
  },
  'billing.renewal.trialEnded': '試用期間は終わりました。',
  'billing.renewal.endsNoDate': 'このプランは終了予定で、更新されません。',
  'billing.renewal.endsOn':
    'このプランは{date}に終わります。何も削除されず、有料のモジュールが使えなくなるだけです。',
  'billing.renewal.pastDue':
    '前回の支払いが通りませんでした。有料モジュールを失う前に、カードを更新してください。',
  'billing.renewal.unpaid':
    'このサブスクリプションは未払いで、有料モジュールは使えません。',
  'billing.renewal.paused':
    'このサブスクリプションは一時停止中です。また旅に出る気になったら再開してください。',
  'billing.renewal.lapsed':
    '予約と旅の記録をまた使うには、下からプランを選んでください。',
  'billing.renewal.incomplete':
    'Polar はまだ、この支払いの確認を待っています。',
  'billing.renewal.free':
    '同時に2件までの旅を、無料で。物足りなくなったらいつでもアップグレードできます。',
  'billing.renewal.auto': '自動で更新されます。',
  'billing.renewal.renewsOn': '{date}に更新されます。',
  'billing.usage.title': '使用状況',
  'billing.usage.description':
    'つねに実測なので、数字が古いことはありません。上限は、いま有効なプランに従います。',
  'billing.quota.seats': 'メンバー',
  'billing.quota.trips': '旅',
  'billing.quota.storageBytes': 'ストレージ',
  'billing.quota.unlimited': '無制限',
  'billing.quota.places': '場所',
  'billing.quota.placesHint': 'このワークスペースのすべての旅行が対象です',
  'billing.quota.exhausted.places': '場所の上限に達しました',
  'billing.quota.over.places': '場所の上限を{value}件超えています',
  'billing.quota.noLimit': 'このプランに上限はありません',
  'billing.quota.used': '{quota}を使用',
  'billing.quota.over.seats': {
    other: 'このプランの上限を{value}席超えています',
  },
  'billing.quota.over.trips': {
    other: 'このプランの上限を旅{value}件分超えています',
  },
  'billing.quota.over.storage': 'このプランの上限を{value}超えています',
  'billing.quota.exhausted.seats': 'このプランの席はすべて埋まっています',
  'billing.quota.exhausted.trips': 'このプランの旅の枠はすべて使われています',
  'billing.quota.exhausted.storage': 'このプランのストレージは満杯です',
  'billing.quota.left': '残り{value}',
  'billing.plans.title': 'プラン',
  'billing.plans.description':
    'プランはいつでも変えられます。アップグレードは日割りで、ダウングレードは支払い済みの期間が終わってから切り替わります。',
  'billing.interval.label': '請求の間隔',
  'billing.interval.monthly': '月ごと',
  'billing.interval.yearly': '年ごと',
  'billing.plan.free.name': 'フリー',
  'billing.plan.free.tagline': '次の2つの旅を計画する',
  'billing.plan.free.feature.trips': '同時に2件の旅と最大150件の場所',
  'billing.plan.free.feature.itinerary': '日ごとの旅程と地図',
  'billing.plan.free.feature.lists': '持ち物リストとかんたんな予算',
  'billing.plan.free.feature.atlas': '行った場所を記録する世界地図',
  'billing.plan.solo.name': 'ソロ',
  'billing.plan.solo.tagline': 'すべて自分で計画する旅行者に',
  'billing.plan.solo.feature.trips': '旅と場所は無制限',
  'billing.plan.solo.feature.modules':
    '予約、旅の記録、予算、持ち物 — 全モジュール',
  'billing.plan.solo.feature.storage': '写真と書類に5 GB',
  'billing.plan.solo.feature.export': 'PDF とカレンダーへの書き出し',
  'billing.plan.crew.name': 'クルー',
  'billing.plan.crew.tagline': '家族、友人、少人数のチームに',
  'billing.plan.crew.feature.members': '最大10人、1人あたりで課金',
  'billing.plan.crew.feature.realtime':
    'カーソルまで見えるリアルタイム共同編集',
  'billing.plan.crew.feature.everything': '無制限の旅と場所、全モジュール',
  'billing.plan.crew.feature.storage': '全員の写真や書類を置ける共有スペース',
  'billing.plan.current': '現在のプラン',
  'billing.plan.currentBadge': '現在',
  'billing.plan.popular': '人気',
  'billing.plan.switchYearly': '年ごとに切り替える',
  'billing.plan.switchMonthly': '月ごとに切り替える',
  'billing.plan.upgradeTo': '{plan}にアップグレード',
  'billing.plan.changeTo': '{plan}に変更',
  'billing.plan.perMemberMonth': '／1人／月',
  'billing.plan.perMonth': '／月',
  'billing.plan.alwaysFree': 'ずっと無料、カード不要',
  'billing.plan.billedYearly': '年に{amount}の請求',
  'billing.plan.billedMonthly': '月に{amount}の請求',
  'billing.plan.members': 'メンバー',
  'billing.plan.membersHint': 'いつでも変えられます。請求もそれに従います。',
  'billing.plan.seatOption': { other: 'メンバー{value}人' },
  'billing.invoices.number': '請求書',
  'billing.invoices.date': '日付',
  'billing.invoices.amount': '金額',
  'billing.invoices.status': '状態',
  'billing.invoice.paid': '支払済',
  'billing.invoice.draft': '下書き',
  'billing.invoice.void': '無効',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    '決済プロバイダがそのリクエストを拒否しました。少し経ってからもう一度お試しください。',
  'billing.failure.reference': 'サポートへの参照番号: {reference}',
  'billing.failure.forbidden':
    'このワークスペースの請求については、あなたのロールでは実行できません。オーナーまたは管理者に依頼してください。',
  'billing.failure.providerRefused':
    'Polar がその変更を受け付けませんでした。席数とメンバー数を確認してから、もう一度お試しいただくか、請求ポータルをご利用ください。',
  'billing.failure.rateLimited':
    'Polar は現在混み合っています。何も変更されていません。1 分後にもう一度お試しください。',
  'billing.failure.notConnected':
    'この環境ではまだ請求が接続されていないため、何も変更されていません。サポートにお問い合わせください。',
  'billing.failure.orderNotInvoiceable':
    'Polar はこの注文の請求書を発行できません。請求先の名前や住所が未入力の場合は、請求ポータルで追加してからもう一度お試しください。それ以外の場合はサポートにお問い合わせください。',
  'billing.planChanged.title': 'プランを更新しました',
  'billing.planChanged.body':
    '変更はすでに Polar 側で有効です。差額は Polar が請求します。下の概要は1分以内に追いつきます。',
  'billing.discount.toggle': 'プロモーションコードをお持ちですか？',
  'billing.discount.label': 'プロモーションコード',
  'billing.discount.hint': '次に選ぶプランに適用されます。',
  'billing.discount.hintCurrent':
    '現在のプランに適用するか、下からプランを選んでください。',
  'billing.discount.applyCurrent': '現在のプランに適用',
  'billing.discount.applying': 'コードを適用しています…',
  'billing.discount.invalidFormat': 'コードは3〜64文字の英数字です。',
  'billing.discount.rejected.invalid':
    'このコードは無効です。確認してもう一度お試しください。',
  'billing.discount.rejected.rateLimited':
    '試行回数が多すぎます。1時間後にもう一度お試しください。',
  'billing.discount.rejected.notApplicable':
    'このコードはこのプランには使えません。',
  'billing.discount.rejected.busy':
    '現在コードを確認できません。1分後にもう一度お試しください。',
  'billing.discount.nextRenewal':
    'プロモーションコードは次回の更新から適用されます。',
  'billing.discount.appliedTitle': 'プロモーションコードを適用しました',
  'billing.hero.manage': '請求を管理',
  'billing.hero.manageHint':
    'カード、請求先住所、税番号、領収書、解約は、請求書を発行する Polar 側にあります。',
  'billing.hero.manageHintNone':
    'まだ請求プロフィールがありません。下の有料プランを選ぶと作成され、それ以降はポータルが開きます。',
  'billing.portal.opening': '請求ポータルを開いています',
  'billing.plan.notApplied': 'その変更は適用されませんでした',
  'billing.plan.cancelInPortal': 'ポータルで解約',
  'billing.plan.seatsOverMax': {
    other:
      'このワークスペースのメンバーは {members} 人で、{plan} の請求上限は {max} 人です。切り替える前に {value} 人を外してください。',
  },
  'billing.plan.seatsBelowMembers':
    'メンバーは {members} 人です。少なくともその数の席を選んでください。Polar は割り当てより席が少ない購読を拒否します。',
  'billing.orders.title': '注文',
  'billing.orders.description':
    'このワークスペースのすべての注文を、新しい順に。',
  'billing.orders.receipts': 'すべての領収書',
  'billing.orders.unavailableTitle': '注文を読み込めません',
  'billing.orders.unavailableBody':
    'Polar が履歴について時間内に応答しませんでした。上の内容はすべて最新です。少し経ってからお試しか、請求ポータルで全記録をご確認ください。',
  'billing.orders.emptyTitle': 'まだ注文はありません',
  'billing.orders.emptyCustomer':
    '請求期間が締まると、最初の請求書がここに表示されます。',
  'billing.orders.emptyNoCustomer':
    'このワークスペースに請求されたことはありません。有料プランを選ぶと、請求書がここに集まります。',
  'billing.orders.tableLabel': '注文履歴',
  'billing.orders.document': '書類',
  'billing.orders.dateUnknown': '日付不明',
  'billing.order.pending': '保留中',
  'billing.order.refunded': '返金済み',
  'billing.order.partiallyRefunded': '一部返金',
  'billing.order.noInvoiceDraft': '注文が下書きのあいだは請求書がありません',
  'billing.order.preparing': '準備中',
  'billing.order.renderingHint':
    'Polar は請求書 {number} をまだ作成しています。ダウンロードは数秒で戻ります。',
  'billing.order.fetching': '請求書を取得しています',
  'billing.order.generating': 'Polar が請求書を準備しています',
  'billing.order.pdfLabel': '請求書 {number} を PDF で',
  'billing.order.stillWritingTitle': 'Polar はその請求書をまだ作成中です',
  'billing.order.stillWritingBody':
    '請求書 {number} を作成しています。ダウンロードは数秒で自動的に戻ります。',
  'billing.order.openFailed': 'その請求書は開けませんでした',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'アカウント',
  'passkeys.page.title': 'パスキー',
  'passkeys.page.description':
    'パスキーを使うと、何も入力せず、指紋認証や顔認証、セキュリティキーでサインインできます。',
  'passkeys.page.back': 'セキュリティに戻る',
  'passkeys.list.label': 'あなたのパスキー',
  'passkeys.add.action': 'パスキーを追加',
  'passkeys.add.loading': 'お使いのデバイスを待っています',
  'passkeys.add.added': 'パスキーを追加しました',
  'passkeys.add.dismissed': 'パスキーは追加されませんでした',
  'passkeys.add.exists':
    'このデバイスには、あなたのアカウントのパスキーがすでにあります',
  'passkeys.add.failed':
    'パスキーを追加できませんでした。もう一度お試しください。',
  'passkeys.add.stale':
    '安全のため、続けるにはもう一度サインインしてください。',
  'passkeys.error.sessionEnded':
    'セッションが終了しました。続けるにはもう一度サインインしてください。',
  'passkeys.signInAgain': 'もう一度サインイン',
  'passkeys.add.limit':
    'パスキーの上限（{value} 件）に達しました。別のパスキーを追加するには、どれかを削除してください。',
  'passkeys.add.unsupported':
    'このブラウザーではパスキーを作成できません。別のブラウザーかデバイスをお試しください。',
  'passkeys.empty.title': 'パスキーはまだありません',
  'passkeys.empty.body':
    '追加すると、何も入力せず、指紋認証や顔認証、セキュリティキーでサインインできます。',
  'passkeys.row.fallbackName': 'パスキー · {date} に追加',
  'passkeys.row.added': '{date} に追加',
  'passkeys.row.lastUsed': '最終使用: {date}',
  'passkeys.row.neverUsed': 'サインインにはまだ使われていません',
  'passkeys.badge.synced': '同期済み',
  'passkeys.badge.singleDevice': '1 台のデバイスのみ',
  'passkeys.error.title': 'パスキーを読み込めませんでした',
  'passkeys.error.retry': 'もう一度試す',
  'passkeys.error.rateLimited':
    '試行回数が多すぎます。数分後にもう一度お試しください。',
  'passkeys.error.generic': '接続を確認して、もう一度お試しください。',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': '{name} の名前を変更',
  'passkeys.rename.fieldLabel': 'このパスキーに名前を付ける',
  'passkeys.rename.placeholder': '名前を入力（例: 仕事用スマホ）',
  'passkeys.rename.saving': '名前を保存しています',
  'passkeys.rename.saved': '名前を保存しました',
  'passkeys.rename.failed': '名前を保存できませんでした',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': '{name} を削除',
  'passkeys.delete.title': 'このパスキーを削除しますか？',
  'passkeys.delete.body': '{name} ではサインインできなくなります。',
  'passkeys.delete.password': 'パスワード',
  'passkeys.delete.passwordHint': '確認のため、パスワードを入力してください。',
  'passkeys.delete.confirmOnly':
    'このアカウントにはパスワードがありません。このパスキーを削除することを確認してください。',
  'passkeys.delete.confirm': 'パスキーを削除',
  'passkeys.delete.cancel': 'キャンセル',
  'passkeys.delete.wrongPassword': 'パスワードが正しくありません。',
  'passkeys.delete.stale':
    '安全のため、パスキーを削除する前にもう一度サインインしてください。',
  'passkeys.delete.removed': 'パスキーを削除しました',
  'passkeys.delete.failed':
    'パスキーを削除できませんでした。もう一度お試しください。',
  'passkeys.delete.removing': 'パスキーを削除しています',
  'passkeys.delete.passwordRequired':
    'このパスキーを削除するには、パスワードを入力してください。',
  'workspace.departure.leave': 'ワークスペースから退出',
  'workspace.departure.remove': 'メンバーを削除',
  'workspace.departure.title': '{workspace} のメンバーシップを終了しますか？',
  'workspace.departure.body':
    '{name} は {workspace} にアクセスできなくなります。アカウントと保存されている旅行や費用の記録は残ります。',
  'workspace.departure.cancel': 'キャンセル',
  'workspace.departure.pending': 'メンバーシップを終了中…',
  'workspace.departure.lastOwner':
    '退出する前、またはこのオーナーを削除する前に、別のメンバーをオーナーにしてください。',
  'workspace.departure.notPermitted':
    '現在の役割ではこのメンバーを削除できません。メンバー一覧を更新してから、もう一度お試しください。',
  'workspace.departure.notFound':
    'このユーザーはすでにこのワークスペースのメンバーではありません。',
  'workspace.departure.impersonated':
    'ワークスペースのメンバーシップを変更する前に、代理操作を終了してください。',
  'workspace.departure.failed':
    '結果を確認できませんでした。ワークスペースを再読み込みしてから、もう一度お試しください。',
  'workspace.departure.removed': 'メンバーを削除しました',
  'workspace.departure.reload': 'ワークスペースを再読み込み',
  'workspace.departure.activationFailed':
    'このワークスペースから退出しました。次のワークスペースを開いて続行してください。',
  'workspace.departure.recover': '次のワークスペースを開く',
  'twoFactor.back': 'セキュリティに戻る',
  'twoFactor.title': '二要素認証',
  'twoFactor.description':
    'メールアドレスとパスワードでのログインに確認手順を追加します。',
  'twoFactor.error': '二要素認証の設定を読み込めませんでした。',
  'twoFactor.steps.label': '二要素認証を設定',
  'twoFactor.steps.password': '本人確認',
  'twoFactor.steps.key': '認証アプリに追加',
  'twoFactor.steps.confirm': 'コードを入力',
  'twoFactor.steps.state.done': '完了済み',
  'twoFactor.steps.state.current': '現在の手順',
  'twoFactor.steps.state.todo': '未開始',
  'twoFactor.password.label': 'パスワード',
  'twoFactor.password.hint': 'ログイン方法を変更する前に、もう一度確認します。',
  'twoFactor.password.submit': '続ける',
  'twoFactor.password.pending': '設定中',
  'twoFactor.password.invalid': 'パスワードが正しくありません。',
  'twoFactor.key.intro':
    'スマートフォンに認証アプリが必要です。このキーを追加してから、このページに戻ってください。二要素認証はまだ有効ではありません。',
  'twoFactor.key.label': '設定キー',
  'twoFactor.key.copy': 'キーをコピー',
  'twoFactor.key.copied': 'キーをコピーしました',
  'twoFactor.key.copyFailed':
    'ブラウザでキーをコピーできませんでした。選択して手動でコピーしてください。',
  'twoFactor.key.open': '認証アプリで開く',
  'twoFactor.key.startOver': '最初からやり直す',
  'twoFactor.key.startOverHint':
    'やり直すと新しいキーが作成されます。すでにアプリに追加したキーは使えなくなります。',
  'twoFactor.key.next': '追加しました',
  'twoFactor.code.label': 'アプリのコード',
  'twoFactor.code.hint': 'アプリに現在表示されている6桁の数字。',
  'twoFactor.code.submit': '二要素認証を有効にする',
  'twoFactor.code.pending': '確認中',
  'twoFactor.code.invalid':
    'コードが一致しません。スマートフォンの時刻を確認し、アプリの最新コードを入力してください。',
  'twoFactor.code.unclear':
    '成功したか確認できませんでした。最新のコードを入力して再試行してください。',
  'twoFactor.rateLimited.title': '短時間に試行が集中しています',
  'twoFactor.rateLimited.password':
    '約10秒待ってから再試行してください。入力内容は保持されています。',
  'twoFactor.rateLimited.code':
    '最大1分待ってから再試行してください。入力内容は保持されています。',
  'twoFactor.codes.title': 'バックアップコード',
  'twoFactor.codes.body':
    'スマートフォンを紛失した場合、各コードを一度だけ使用できます。表示は今だけなので、安全な場所に保管してください。',
  'twoFactor.codes.copyAll': 'すべてコピー',
  'twoFactor.codes.copied': 'バックアップコードをコピーしました',
  'twoFactor.codes.download': 'テキストファイルでダウンロード',
  'twoFactor.codes.copyFailed':
    'ブラウザでコードをコピーできませんでした。選択して手動でコピーしてください。',
  'twoFactor.codes.stored': 'バックアップコードを保管しました',
  'twoFactor.codes.done': '完了',
  'twoFactor.codes.gate': 'チェックを入れて続けてください。',
  'twoFactor.codes.lost':
    '先にこのページを離れた場合、ここで新しいコード一式を作成できます。古いコードは使えなくなります。',
  'twoFactor.codes.leave.title': 'コードを保管せずに離れますか？',
  'twoFactor.codes.leave.body':
    'バックアップコードは一度しか表示されません。今離れた場合、ここで新しいコード一式を作成できます。古いコードは使えなくなります。',
  'twoFactor.codes.leave.stay': 'このページに留まる',
  'twoFactor.codes.leave.go': '離れる',
  'twoFactor.on.title': '二要素認証は有効です',
  'twoFactor.on.badge': '有効',
  'twoFactor.on.body':
    'メールアドレスとパスワードでログインする際、信頼済みブラウザを除き認証アプリのコードが必要です。Google、Apple、パスキーでのログインでは不要です。',
  'twoFactor.replace.action': 'バックアップコードを置き換える',
  'twoFactor.replace.title': 'バックアップコードを置き換えますか？',
  'twoFactor.replace.body':
    '新しいコード一式を発行します。続けると、現在のコードはすぐに使えなくなります。',
  'twoFactor.replace.confirm': '置き換える',
  'twoFactor.replace.pending': '置き換え中',
  'twoFactor.nopassword.title': '先にパスワードを設定してください',
  'twoFactor.nopassword.body':
    '二要素認証にはアカウントのパスワードが必要です。次のページでメールアドレスを入力すると、設定リンクが届きます。設定するとすべての端末でログアウトします。再度ログインしてここに戻ってください。',
  'twoFactor.nopassword.action': 'パスワードを設定',
  'twoFactor.setup.action': '設定キーをもう一度表示',
  'twoFactor.setup.title': '設定キー',
  'twoFactor.setup.body':
    'このキーを別の端末に追加します。他の端末に登録済みのキーは引き続き使えます。',
  'twoFactor.setup.done': '完了',
  'twoFactor.setup.confirm': 'キーを表示',
  'twoFactor.setup.pending': '確認中',
} satisfies TranslationOf<typeof En>

export default messages
