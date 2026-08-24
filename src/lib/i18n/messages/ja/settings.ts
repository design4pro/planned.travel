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
  'appearance.map.light': '紙 — ライト',
  'appearance.map.dark': '炭 — ダーク',
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
    '新しくサインインするたびに、認証アプリのコードが必要になります。',
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
    '新しいプランを適用しています。Stripe が確認した時点でここに表示されます。ふつうは数秒です。',
  'billing.checkout.cancelledTitle': '支払いを中止しました',
  'billing.checkout.cancelledBody':
    '請求は発生しておらず、プランも変わっていません。',
  'billing.portal.backTitle': 'Stripe から戻りました',
  'billing.portal.backBody':
    'あちらで変えた内容は、Stripe が確認するとすぐここに反映されます。',
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
  'billing.hero.paymentMethod': '支払い方法',
  'billing.hero.cancel': 'プランを解約',
  'billing.price.free': '無料',
  'billing.stripe.opening': 'Stripe を開いています',
  'billing.stripe.failed': 'Stripe に接続できませんでした',
  'billing.stripe.failedBody':
    '請求は発生していません。通信状況を確認して、少ししてからお試しください。',
  'billing.renewal.trialEndsToday':
    '試用は今日で終わります。カードを登録すれば、すべてのモジュールを使い続けられます。',
  'billing.renewal.trialEndsIn': {
    other: '試用はあと{value}日で終わります。それまでカードは不要です。',
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
    '予約、旅の記録、オフライン地図をまた使うには、下からプランを選んでください。',
  'billing.renewal.incomplete':
    'Stripe はまだ、この支払いの確認を待っています。',
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
  'billing.interval.saving': '{value}お得',
  'billing.plan.free.name': 'フリー',
  'billing.plan.free.tagline': '次の2つの旅を計画する',
  'billing.plan.free.feature.trips': '同時に2件の旅',
  'billing.plan.free.feature.itinerary': '日ごとの旅程と地図',
  'billing.plan.free.feature.lists': '持ち物リストとかんたんな予算',
  'billing.plan.free.feature.atlas': '行った場所を記録する世界地図',
  'billing.plan.solo.name': 'ソロ',
  'billing.plan.solo.tagline': 'すべて自分で計画する旅行者に',
  'billing.plan.solo.feature.trips': '旅は無制限',
  'billing.plan.solo.feature.modules':
    '予約、旅の記録、予算、持ち物 — 全モジュール',
  'billing.plan.solo.feature.offline': '出発前にダウンロードするオフライン地図',
  'billing.plan.solo.feature.export': 'PDF とカレンダーへの書き出し',
  'billing.plan.crew.name': 'クルー',
  'billing.plan.crew.tagline': '家族、友人、少人数のチームに',
  'billing.plan.crew.feature.members': '最大10人、1人あたりで課金',
  'billing.plan.crew.feature.realtime':
    'カーソルまで見えるリアルタイム共同編集',
  'billing.plan.crew.feature.everything': '無制限の旅と、全モジュール',
  'billing.plan.crew.feature.storage': '全員の写真や書類を置ける共有スペース',
  'billing.plan.current': '現在のプラン',
  'billing.plan.currentBadge': '現在',
  'billing.plan.popular': '人気',
  'billing.plan.moveTo': '{plan}に移る',
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
  'billing.invoices.title': '請求書',
  'billing.invoices.description':
    'このワークスペースのすべての領収書を、新しい順に。',
  'billing.invoices.portal': '請求ポータル',
  'billing.invoices.unavailableTitle': '領収書を読み込めません',
  'billing.invoices.unavailableBody':
    '履歴の取得に Stripe が間に合いませんでした。上の内容は最新です。全記録は請求ポータルで見るか、少ししてからお試しください。',
  'billing.invoices.emptyTitle': 'まだ請求書はありません',
  'billing.invoices.emptyCustomer':
    '最初の領収書は、請求期間が終わるとここに出てきます。',
  'billing.invoices.emptyNoCustomer':
    'このワークスペースにはまだ請求がありません。有料プランを選ぶと、領収書がここにたまっていきます。',
  'billing.invoices.tableLabel': '請求の履歴',
  'billing.invoices.number': '請求書',
  'billing.invoices.date': '日付',
  'billing.invoices.period': '期間',
  'billing.invoices.amount': '金額',
  'billing.invoices.status': '状態',
  'billing.invoices.receipt': '領収書',
  'billing.invoices.view': '表示',
  'billing.invoice.paid': '支払済',
  'billing.invoice.open': '未払い',
  'billing.invoice.draft': '下書き',
  'billing.invoice.void': '無効',
  'billing.invoice.uncollectible': '回収不能',
} satisfies TranslationOf<typeof En>

export default messages
