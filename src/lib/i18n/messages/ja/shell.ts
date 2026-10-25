/**
 * The app shell — navigation, the account menu, the inbox, the
 * dashboard, the admin console and the shared status vocabulary, in Japanese.
 *
 * Authored from `../en/shell`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Japanese has no plural inflection, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair English writes collapses
 * to one branch. The number still arrives already grouped by the formatter, and
 * the counter that follows it (泊, 日, 件, 名) is chosen per message rather than
 * bolted on, because Japanese picks a different counter for nights, days,
 * records and people.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  'nav.primary': '主なセクション',
  'nav.mobile': 'セクション',
  'nav.dashboardLink': 'planned.travel ダッシュボード',
  'nav.homeLink': 'planned.travel ホーム',
  'nav.newTrip': '新しい旅',
  'nav.trips': 'マイ旅行',
  'nav.trips.short': '旅行',
  'nav.vacay': '休暇',
  'nav.vacay.short': '休暇',
  'nav.atlas': 'アトラス',
  'nav.atlas.short': 'アトラス',
  'nav.journey': '旅の記録',
  'nav.journey.short': '記録',
  'trip.nav.label': '旅のセクション',
  'trip.nav.back': '旅行',
  'trip.nav.share': '共有',
  'trip.nav.shareLabel': 'この旅を共有',
  'trip.tab.plan': 'プラン',
  'trip.tab.transports': '移動',
  'trip.tab.book': '予約',
  'trip.tab.lists': 'リスト',
  'trip.tab.costs': '費用',
  'trip.tab.files': 'ファイル',
  'trip.tab.collab': 'コラボ',
  'account.menu': '{name}、アカウントメニュー',
  'account.settings': '設定',
  'account.billing': 'プランと請求',
  'account.admin': '管理',
  'account.signOut': 'サインアウト',
  'account.signingOut': 'サインアウト中…',
  'account.signOutFailed': 'サインアウトできませんでした',
  'account.signOutFailedBody': '通信状況を確認して、もう一度お試しください。',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'ワークスペース',
  'workspace.switched': '{name}に切り替えました',
  'workspace.switchFailed': 'ワークスペースを切り替えられませんでした',
  'workspace.switchFailedBody': '通信状況を確認して、もう一度お試しください。',
  'workspace.switchUnconfirmedBody':
    '現在のワークスペースを確認できませんでした。続行する前にページを再読み込みしてください。',
  'workspace.switchRateLimitedBody':
    'ワークスペースの切り替えが多すぎます。しばらく待ってからもう一度お試しください。',
  'workspace.create': 'ワークスペースを作成',
  'workspace.createTitle': 'ワークスペースを作成する',
  'workspace.createDescription':
    '旅行・場所・メンバーを分けて管理できる、独立したスペースです。フリープランで始まり、現在のワークスペースのプランは共有されません。',
  'workspace.createPermanent':
    'planned.travel には、ワークスペースを削除するオプションはまだありません。作成または参加したワークスペースはすべて上限に含まれ、{limit}個のワークスペースに所属すると、新しく作成することはできません。',
  'workspace.createName': 'ワークスペース名',
  'workspace.createNameRequired': 'ワークスペース名を入力してください。',
  'workspace.createUpgrade':
    '「{workspace}」はフリープランで、ワークスペースを追加で作成できるのは有料プランのワークスペースだけです。ほかのワークスペースに有料プランのものがあれば、そちらに切り替えて作成してください。ない場合は「{workspace}」を有料プランにアップグレードしてください。',
  'workspace.createLimitReached': '上限いっぱいのワークスペースに所属しているため、新しく作成することはできません。',
  'workspace.createRoleRequired':
    'ワークスペースを作成できるのは、ワークスペースの管理者だけです。このワークスペースの管理者に依頼するか、自分が管理しているワークスペースに切り替えてください。',
  'workspace.createFailed': 'ワークスペースを作成できませんでした',
  'theme.label': '表示',
  'theme.light': 'ライト',
  'theme.dark': 'ダーク',
  'theme.system': 'システムに合わせる',
  'theme.state.light': 'ライト',
  'theme.state.dark': 'ダーク',
  'theme.state.system': 'システムに合わせています',
  'theme.trigger': 'テーマ: {state}。テーマを変更',
  'language.trigger': '言語: {language}。言語を変更',
  'language.hint': 'この端末に保存されます。ログインすると、アカウントで設定した言語が適用されます。設定で変更できます。',
  'language.announce': '言語を{language}に変更しました',
  'language.notApplied':
    'このブラウザーは選択を保存しませんでした。このサイトのCookieを許可してから、もう一度選択してください。',
  'bell.none': '通知、未読はありません',
  'bell.unread': { other: '通知、未読{unread}件' },
  'inbox.eyebrow': '受信箱',
  'inbox.title': '通知',
  'inbox.error': '受信箱を読み込めませんでした',
  'inbox.allRead': 'すべて読み終えています',
  'inbox.unread': { other: '未読{unread}件' },
  'inbox.markAll': 'すべて既読にする',
  'inbox.markingAll': 'すべて既読にしています',
  'inbox.cleared': '受信箱を空にしました',
  'inbox.markAllFailed': 'すべてを既読にできませんでした',
  'inbox.retryHint': '通信状況を確認して、もう一度お試しください。',
  'inbox.filter.all': 'すべて',
  'inbox.filter.unread': '未読',
  'inbox.waiting': { other: '招待{invitations}件が待っています' },
  'inbox.empty.title': '受信箱は空です',
  'inbox.empty.body':
    '旅への招待、計画の変更、予約のリマインダー、精算の知らせは、すべてここに届きます。',
  'inbox.empty.action': 'ダッシュボードに戻る',
  'inbox.emptyUnread.title': '未読はありません',
  'inbox.emptyUnread.body':
    'すべて読み終えています。「すべて」に切り替えると履歴を振り返れます。',
  'inbox.emptyUnread.action': 'すべて表示',
  'inbox.row.new': '新着',
  'inbox.row.accepted': '承諾',
  'inbox.row.declined': '辞退',
  'inbox.row.open': '開く',
  'inbox.row.markRead': '既読',
  'inbox.row.markingRead': '既読にしています',
  'inbox.row.markReadFailed': '既読にできませんでした',
  'inbox.preferences':
    'これらを受信箱、メール、スマートフォンのどこに届けるかを選べます。',
  'inbox.preferencesAction': '通知の設定',
  'notification.trip.invited.title': '{tripTitle}に招待されました',
  'notification.trip.invited.body':
    '{actorName}さんがあなたを旅に追加しました。',
  'notification.trip.updated.title': '{tripTitle}が更新されました',
  'notification.trip.updated.body': '{actorName}さんが計画を変えました。',
  'notification.trip.member_added.title':
    '{memberName}さんが{tripTitle}に参加しました',
  'notification.trip.member_added.body':
    '旅程、予約、費用を見られるようになりました。',
  'notification.trip.member_removed.title':
    '{memberName}さんが{tripTitle}から抜けました',
  'notification.trip.member_removed.body': 'この旅へのアクセスは終わりました。',
  'notification.trip.starting_soon.title': {
    other: '{tripTitle}の出発まであと{days}日',
  },
  'notification.trip.starting_soon.body':
    '持ち物リストと予約を確かめるころあいです。',
  'notification.trip.copied.title': '{tripTitle} の準備ができました',
  'notification.trip.copied.body': {
    other: '{days} 日分を引き継ぎました',
  },
  'notification.trip.copied.places': {
    other: '場所 {places} 件',
  },
  'notification.trip.copied.dropped': {
    other: 'メモ {dropped} 件は引き継がれませんでした',
  },
  'notification.trip.copyFailed.title': '{tripTitle} を複製できませんでした',
  'notification.trip.copyFailed.body':
    '失われたものはありません。元の旅行からもう一度お試しください。',
  'notification.reservation.reminder.title': '{title}が近づいています',
  'notification.reservation.reminder.body':
    '予約の時間と確認番号を確かめてください。',
  'notification.reservation.confirmed.title': '{title}が確定しました',
  'notification.reservation.confirmed.body':
    '{tripTitle}のこの予約は確定済みになりました。',
  'notification.expense.added.title': '{actorName}さんが費用を追加しました',
  'notification.expense.added.body': '{tripTitle}の{title}。',
  'notification.expense.settled.title': '{actorName}さんが精算しました',
  'notification.expense.settled.body': '{tripTitle}の残高が支払われました。',
  'notification.list.assigned.title':
    '{actorName}さんがあなたに項目を割り当てました',
  'notification.list.assigned.body': '{tripTitle}の{title}。',
  'notification.collab.message.title':
    '{actorName}さんが{tripTitle}に書き込みました',
  /**
   * The whole message is one quoted fragment of someone else's writing, and
   * Japanese marks a quotation with corner brackets rather than by italics
   * or bare juxtaposition.
   */
  'notification.collab.message.body': '「{preview}」',
  'notification.collab.poll.title': '{tripTitle}でアンケートが始まりました',
  'notification.collab.poll.body': '「{question}」',
  'notification.organization.invited.title':
    '{organizationName}に招待されました',
  'notification.organization.invited.body':
    '受けると、ワークスペースとそこで共有されているものすべてに参加できます。',
  'notification.journey.published.title': '{title}を公開しました',
  'notification.journey.published.body':
    'リンクを知っている人が、この旅の記録を読めるようになりました。',
  'notification.billing.plan_changed.title': 'プランが変わりました',
  'notification.billing.plan_changed.body':
    '{organizationName}は{plan}プランになりました。',
  'notification.billing.invoice_paid.title': 'お支払いを受け取りました',
  'notification.billing.invoice_paid.body':
    '{organizationName}の最新の請求書が支払われました。',
  'notification.billing.payment_failed.title': 'お支払いが完了しませんでした',
  'notification.billing.payment_failed.body':
    '{organizationName}のお支払いが滞っています。プランを維持するには支払い方法を更新してください。',
  'notification.fallback.title': 'ワークスペースで何かが変わりました',
  'notification.fallback.body': '旅を開くと、何が変わったのかわかります。',
  'dashboard.error': 'ダッシュボードを読み込めませんでした',
  'dashboard.blank.title': '次の旅はここから',
  'dashboard.blank.body':
    '旅を作って、行きたい場所を地図に置けば、planned.travel がその周りに日ごとの計画を組み立てます。',
  'dashboard.blank.action': '旅を計画する',
  'dashboard.blank.secondary': 'アトラスを見る',
  'dashboard.upNext': '次の予定',
  'dashboard.openPlan': '計画を開く',
  'dashboard.hero.travellers': '旅の人数',
  'dashboard.hero.datesMissing': '日程を入れると日ごとに組み立てます',
  'dashboard.hero.startsIn': '出発まで',
  'dashboard.hero.started': '出発から',
  'dashboard.hero.today': '今日',
  'dashboard.hero.startUnknown': '開始日なし',
  'dashboard.hero.startToday': 'よい旅を',
  /**
   * A bare unit under a numeral the reader is already looking at, so it
   * carries no placeholder — 日前 for a departure already behind us, 日 for
   * one still ahead.
   */
  'dashboard.hero.startPast': { other: '日前' },
  'dashboard.hero.startFuture': { other: '日' },
  'dashboard.hero.nights': '泊数',
  'dashboard.hero.companionsHint': 'この旅行の参加者',
  'dashboard.hero.progress': '旅行中',
  'dashboard.hero.places': '場所',
  'dashboard.hero.placesNone': 'まだ地図にありません',
  'dashboard.hero.placesHint': '地図の上',
  'dashboard.stat.countries': '訪れた国',
  'dashboard.stat.countriesUnit': '全{total}か国中',
  'dashboard.stat.countriesNone': '国に印を付けるとアトラスが始まります',
  'dashboard.stat.visits': { other: '{visits}回の訪問を記録' },
  'dashboard.stat.trips': '旅の総数',
  'dashboard.stat.tripsCaption': '計画中{planning}件 · 予約済み{booked}件',
  'dashboard.stat.places': '地図に置いた場所',
  'dashboard.stat.placesNone': 'まだ地図には何もありません',
  'dashboard.stat.placesAcross': { other: '{trips}件の旅にわたって' },
  'dashboard.stat.bookings': '確定した予約',
  'dashboard.stat.bookingsNone': '近づいている予約はありません',
  'dashboard.stat.bookingsSoon': {
    other: '{bookings}件の予約が近づいています',
  },
  'dashboard.trips.label': 'あなたの旅',
  'dashboard.trips.all': 'すべての旅',
  'dashboard.trips.empty.title': 'まだ旅がありません',
  'dashboard.trips.empty.body': '計画したものが、新しい順にここに並びます。',
  'dashboard.trips.empty.action': '旅を作る',
  'dashboard.bookings.label': 'これからの予約',
  'dashboard.bookings.empty.title': 'まだ何も予約していません',
  'dashboard.bookings.empty.body':
    '確定した宿、席、チケットは、日が近づくとここに出てきます。',
  'dashboard.pipeline.label': '旅の進み具合',
  'dashboard.pipeline.empty':
    '進んでいるものはありません。最初の旅を作ると、段階ごとに内訳が出ます。',
  'dashboard.pipeline.favourites': { other: 'お気に入り{favourites}件' },
  'dashboard.pipeline.archived': { other: 'アーカイブした旅{archived}件' },
  'dashboard.storage.label': 'ストレージ',
  'dashboard.storage.count': '{limit} 中 {used}',
  'dashboard.storage.files': {
    other: '写真やチケットを含めて、すべての旅で{files}件のファイル。',
  },
  'dashboard.storage.more': 'もっと容量が必要ですか？',
  'dashboard.storage.plans': 'プランを見る',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'リファレンス',
  'dashboard.widgets.choose': 'ウィジェットを選ぶ',
  'dashboard.widgets.description':
    'ダッシュボードの横に置いておくウィジェットです。',
  'dashboard.clock.label': '世界時計',
  'dashboard.clock.add': 'タイムゾーンを追加',
  'dashboard.clock.search': '都市や地域を検索',
  'dashboard.clock.noMatches': 'その名前のタイムゾーンはありません',
  'dashboard.clock.remove': '{zone} を削除',
  'dashboard.clock.offset': '自分の時刻との差 {offset}',
  'dashboard.clock.here': '自分の時刻',
  'dashboard.clock.empty.title': 'ピン留めされたタイムゾーンはありません',
  'dashboard.clock.empty.body':
    '場所をピン留めすると、自分の時計の横にその時計が並びます。',
  'dashboard.clock.unknown.title': 'このデバイスは {zone} を認識しません',
  'dashboard.clock.unknown.body':
    'ここでは時刻を読み取れません。行を削除すると解消します。',
  'admin.error': '管理コンソールを読み込めませんでした',
  'admin.denied.title': 'ここを開けるのはワークスペースの管理者だけです',
  'admin.denied.body':
    '必要なときは、このワークスペースのオーナーか管理者に役割を変えてもらってください。',
  'admin.denied.action': 'ダッシュボードに戻る',
  'admin.eyebrow': 'ワークスペース管理',
  'admin.description': '{plan}プラン · {date}作成',
  'admin.createdUnknown': '最近',
  'admin.workspaceSettings': 'ワークスペースの設定',
  'admin.billing': 'プランと請求',
  'admin.invitations.title': { other: '未処理の招待が{invitations}件あります' },
  'admin.invitations.body':
    '未処理の招待も、プランが支払っている席をひとつ使います。',
  'admin.invitations.action': '招待を確認する',
  'admin.stat.members': 'メンバー',
  'admin.stat.membersCaption': { other: '保留中の招待{invitations}件' },
  'admin.stat.storage': 'ストレージ',
  'admin.stat.storageUnit': '上限 {limit}',
  'admin.stat.storageUnlimited': '上限なし',
  'admin.stat.storageCaption': 'ファイル、写真、書き出したデータ',
  'admin.stat.audit': '監査ログ',
  'admin.stat.auditCaption': '直近の動きを下に表示しています',
  'admin.stat.plan': 'プラン',
  'admin.stat.planCaption': '上限はリポジトリの境界で守られます',
  'admin.quotas.label': '上限',
  'admin.quotas.count': { other: '{metrics}項目' },
  'admin.quotas.unlimited': '無制限',
  /**
   * Japanese states the whole before the part: 上限中の使用量, which is why the
   * limit leads and 中 joins the pair instead of a solidus.
   */
  'admin.quotas.value': '{limit} 中 {used}',
  'admin.members.label': 'メンバー',
  'admin.members.table': 'このワークスペースのメンバー',
  'admin.members.person': '人',
  'admin.members.role': '役割',
  'admin.members.joined': '参加',
  'admin.members.role.label': '{name} のロール',
  'admin.members.role.saved': '{name} さんのロールは {role} になりました。',
  'admin.members.role.impersonated': '別のアカウントとして操作している間は、ロールを変更できません。',
  'admin.members.role.notPermitted': 'この変更はできません。オーナーのロールを付与したり、オーナーを変更したりできるのはオーナーだけです。',
  'admin.members.role.lastOwner': 'このワークスペースの唯一のオーナーです。先に別の人をオーナーにしてください。',
  'admin.members.role.notFound': 'この人はもうワークスペースにいません。一覧を更新しました。',
  'admin.members.role.failed': 'ロールを変更できませんでした。もう一度お試しください。',
  'admin.members.role.promote.title': '{name} さんをオーナーにしますか?',
  'admin.members.role.promote.body':
    '{name} さんにはあなたと同じ権限が付きます。請求、メンバー、設定を扱えます。オーナーは、あなたを含む他のオーナーを降格したり削除したりできます。',
  'admin.members.role.promote.confirm': 'オーナーにする',
  'admin.members.role.promote.cancel': 'キャンセル',
  'admin.activity.label': '最近の動き',
  'admin.activity.empty.title': 'まだ記録はありません',
  'admin.activity.empty.body':
    '意味のある書き込みは、そのたびに監査ログへ追記されます。',
  'admin.activity.workspace': 'ワークスペースそのもの',
  'admin.actions.label': '多かった操作',
  'admin.actions.count': { other: '{actions}件の操作' },
  'tripStatus.draft': '下書き',
  'tripStatus.planning': '計画中',
  'tripStatus.booked': '予約済み',
  'tripStatus.active': '進行中',
  'tripStatus.completed': '完了',
  'tripStatus.archived': 'アーカイブ済み',
  'bookingStatus.none': '未予約',
  'bookingStatus.pending': '保留中',
  'bookingStatus.confirmed': '確定',
  'bookingStatus.cancelled': 'キャンセル',
  'bookingStatus.completed': '済み',
  'bookingType.accommodation': '宿泊',
  'bookingType.restaurant': '飲食店',
  'bookingType.activity': 'アクティビティ',
  'bookingType.tour': 'ツアー',
  'bookingType.ticket': 'チケット',
  'bookingType.transport': '移動',
  'bookingType.other': '予約',
  'role.owner': 'オーナー',
  'role.admin': '管理者',
  'role.member': 'メンバー',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    other: '{value}件の旅行',
  },
  'trips.count.favourites': {
    other: 'お気に入り{value}件',
  },
  'trips.count.archived': {
    other: 'アーカイブ{value}件',
  },
  'trips.atLimit.body':
    'ご利用のプランは{trips}までです。終わったものをアーカイブするか、上位プランに変えると同時に開ける数が増えます。',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': '新しい旅の記録',
  'newJourney.title': '旅の記録を始める',
  'newJourney.description':
    '旅の記録は旅行の書かれた側です。日付順の記事に、覚えている写真と天気が付きます。',
  'newJourney.titlePlaceholder': '京都で二週間',
  'newJourney.subtitle': 'サブタイトル',
  'newJourney.subtitleHint': '表紙で、タイトルの下に一行。',
  'newJourney.subtitlePlaceholder': '寺と電車と、多すぎる抹茶',
  'newJourney.trip': '旅行をもとに',
  'newJourney.tripHint': '任意 — 物語をその計画に結びつけます。',
  'newJourney.tripNone': '旅行に紐づけない',
  'newJourney.datesError': '終了日が開始日より前です。',
  'newJourney.submit': '記録を作成',
  'newJourney.creating': '記録を作成しています',
  'newJourney.created': '旅の記録を始めました',
  'newJourney.createdBody': '最初の記事を追加して物語を始めましょう。',
  'newJourney.error':
    '記録を作成できませんでした。少し経ってからお試しください。',
  'newCollection.trigger': '新しいコレクション',
  'newCollection.title': 'コレクションを始める',
  'newCollection.description':
    'どの旅行のものか分かる前に見つけた場所を置いておく場所です。',
  'newCollection.namePlaceholder': '街を横切る価値のある珈琲',
  'newCollection.descriptionHint': 'ここに入るもの、入らないもの。',
  'newCollection.submit': 'コレクションを作成',
  'newCollection.creating': 'コレクションを作成しています',
  'newCollection.created': 'コレクションを作成しました',
  'newCollection.createdBody': '場所を保存していきましょう。',
  'newCollection.error':
    'コレクションを作成できませんでした。少し経ってからお試しください。',

  'newTrip.title': '新しい旅行を始める',
  'newTrip.description':
    'タイトルだけで十分です。日付があれば日ごとの計画が組まれ、あとのことは分かってからで構いません。',
  'newTrip.name': '旅行の名前',
  'newTrip.namePlaceholder': '桜の季節の京都',
  'newTrip.destination': '行き先',
  'newTrip.destinationHint': '都市でも、地方でも、行程全体でも。',
  'newTrip.destinationPlaceholder': '京都、日本',
  'newTrip.departure': '出発',
  'newTrip.return': '帰着',
  'newTrip.returnError': '帰着日が出発日より前です。',
  'newTrip.currency': '予算の通貨',
  'newTrip.currencyHint': 'この旅行の支出はすべてこの通貨で合計します。',
  'newTrip.currencySearch': 'コードまたは名前で検索',
  'newTrip.currencyEmpty': '一致する通貨がありません。',
  'newTrip.currencyFavourites': 'お気に入り',
  'newTrip.currencyAll': 'すべての通貨',
  'newTrip.summary': '概要',
  'newTrip.summaryPlaceholder': '寺と電車とラーメンの2週間。',
  'newTrip.duration': '日数',
  'newTrip.durationHint':
    '日付を決めない場合は、この日数の日付なしの日程で旅が始まります。',
  'newTrip.durationDerived': '2つの日付から自動で計算されます。',
  'newTrip.reminder': '出発前のリマインダー',
  'newTrip.reminderNone': 'なし',
  'newTrip.reminderBefore': {
    other: '{count}日前',
  },
  'newTrip.reminderCustom': 'カスタム',
  'newTrip.reminderCustomDays': '出発の何日前か',
  'newTrip.reminderOn': '{date}にお知らせ',
  'newTrip.reminderNoDeparture': '出発日を選ぶと日付が表示されます。',
  'newTrip.submit': '旅行を作成',
  'newTrip.creating': '旅行を作成しています',
  'newTrip.error': '旅行を作成できませんでした。少し経ってからお試しください。',
  'newTrip.created': '旅行を作成しました',
  'newTrip.createdBody': '地図に場所を置いていきましょう。',
  'newTrip.coverChoose': 'カバー画像を追加',
  'newTrip.coverChange': 'カバー画像を変更',
  'newTrip.coverHint':
    'ここに画像をドロップするか、貼り付けるか、ファイルを選択してください。PNG、JPEG、WebP、AVIF、GIF に対応しています。',
  'newTrip.coverChosen': 'カバー画像: {name}',
  'newTrip.coverRemove': 'カバー画像を削除',
  'newTrip.coverTypeError':
    '「{name}」はカバー画像にできません。PNG、JPEG、WebP、AVIF、GIF のいずれかを選んでください。',
  'newTrip.coverSizeError':
    '「{name}」は {max} を超えています。もっと小さい画像を選んでください。',
  'newTrip.coverUploading': 'カバー画像をアップロードしています',
  'newTrip.coverFailedTitle': 'カバー画像を追加できませんでした',
  'newTrip.coverFailed':
    '旅行は作成されましたが、「{name}」をカバーとしてアップロードできませんでした。',
  'newTrip.coverRetry': '再試行',
  'newTrip.coverContinue': 'カバーなしで旅行を開く',
  'newTrip.people': 'メンバー',
  'newTrip.peopleHint': '旅行が作成されるとすぐに追加されます。あなたは引き続きオーナーです。',
  'newTrip.peoplePlaceholder': 'ワークスペースから選択',
  'newTrip.peopleSearch': '名前で検索',
  'newTrip.peopleLoading': 'ワークスペースのメンバーを読み込み中',
  'newTrip.peopleLoadError':
    'ワークスペースのメンバーを読み込めませんでした。旅行を作成してから、その旅行のメンバー画面で追加してください。',
  'newTrip.peopleNone': 'このワークスペースには、今のところあなただけがいます。',
  'newTrip.peopleNoneMember': 'ワークスペースのオーナーまたは管理者が、ほかのメンバーを招待できます。',
  'newTrip.peopleInvite': 'ワークスペースにメンバーを招待',
  'newTrip.peopleChosen': '選択したメンバーと役割',
  'newTrip.peopleFailedTitle': '旅行は作成されましたが、全員は追加されませんでした',
  'newTrip.noticeBothTitle': '旅行は作成されましたが、すべては追加されませんでした',
  'newTrip.peopleNotInWorkspace': '{name}さんはもうこのワークスペースにいないため、追加されませんでした。',
  'newTrip.peopleAlreadyOn': '{name}さんはすでにこの旅行にいます。',
  'newTrip.peopleUnconfirmed': '{name}さんの追加を確認できませんでした。メンバー画面で追加されたかご確認ください。',
  'newTrip.peopleContinue': '続ける',
  'newTrip.peopleRetry': 'もう一度試す',
  'newTrip.coverRetryOnly': 'カバーをもう一度試す',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': '{title} の操作',
  'tripActions.copy': '複製',
  'tripActions.favourite': 'お気に入りに追加',
  'tripActions.unfavourite': 'お気に入りから削除',
  'tripActions.edit': '編集',
  'tripActions.archive': 'アーカイブ',
  'tripActions.restore': '元に戻す',
  'tripActions.delete': '削除',
  'tripActions.deleteForGood': '完全に削除',
  'tripActions.starFailed': 'お気に入りを保存できませんでした',
  'tripActions.starFallback': '旅行は元の状態に戻りました。',
  'tripActions.archived': '旅行をアーカイブしました',
  'tripActions.archiveFailed': '旅行をアーカイブできませんでした',
  'tripActions.restored': '旅行を元に戻しました',
  'tripActions.restoreFailed': '旅行を元に戻せませんでした',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': '旅行を編集',
  'editTrip.submit': '変更を保存',
  'editTrip.saving': '旅行を保存しています',
  'editTrip.cancel': 'キャンセル',
  'editTrip.saved': '旅行を更新しました',
  'editTrip.errorTitle': '保存できませんでした',
  'editTrip.retry': '再試行',
  'editTrip.error':
    '旅行を保存できませんでした。しばらくしてからもう一度お試しください。',
  'editTrip.coverFailed':
    '「{name}」をカバーとしてアップロードできませんでした。ほかの変更はまだ保存されていません。',
  'editTrip.coverContinue': '新しいカバーなしで保存',
  'editTrip.currencyLocked':
    'この旅行にはすでに金額が入っているため、予算の通貨はここでは変更できません。「費用」タブの「予算の通貨を変更」を使うか、ほかの変更を保存するには通貨を {current} に戻してください。',
  'editTrip.currencyReadonly': '予算の通貨は「費用」タブで変更します。',
  'editTrip.currencyLink': '「費用」タブを開く',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': '「{title}」を完全に削除しますか？',
  'deleteTrip.description':
    '取り消しもゴミ箱もありません。アーカイブなら、失わずに一覧から外せます。',
  'deleteTrip.reading': 'この旅行の内容を読み込んでいます',
  'deleteTrip.errorTitle': '読み込めませんでした',
  'deleteTrip.summaryError': 'この旅行の内容を読み込めませんでした。',
  'deleteTrip.confirmLabel': '確認のため旅行名を入力してください',
  'deleteTrip.deleting': '旅行を削除しています',
  'deleteTrip.deleted': '旅行を削除しました',
  'deleteTrip.failed': '旅行を削除できませんでした',
  'deleteTrip.carried.reservations': {
    other: '件の予約',
  },
  'deleteTrip.carried.transports': {
    other: '件の移動',
  },
  'deleteTrip.carried.expenses': {
    other: '件の支出',
  },
  'deleteTrip.carried.files': {
    other: '件のファイル',
  },
  'deleteTrip.carried.members': {
    other: '人のメンバー',
  },
  'copyTrip.title': '「{title}」を複製',
  'copyTrip.nameLabel': '複製の名前',
  'copyTrip.titleRequired': '複製に名前を付けてください。',
  'copyTrip.datesLabel': '日程',
  'copyTrip.datesTogether': '両方の日付を指定するか、両方を空にしてください。',
  'copyTrip.clearDates': '日程なしで複製',
  'copyTrip.carries':
    '日程、場所、メモは引き継がれます。予約、費用、ファイル、メンバーは引き継がれません。',
  'copyTrip.shorter':
    '元の旅行より短い日程です。あふれた日の場所はアイデアに移り、そのメモは引き継がれません。',
  'copyTrip.submit': '旅行を複製',
  'copyTrip.copying': '旅行を複製しています',
  'copyTrip.cancel': 'キャンセル',
  'copyTrip.started': '「{title}」を複製しています',
  'copyTrip.errorTitle': '複製できませんでした',
  'copyTrip.error':
    '旅行を複製できませんでした。少し経ってからもう一度お試しください。',

  'trips.error': '旅行を読み込めませんでした',
  'trips.eyebrow': 'ワークスペース',
  'trips.nothingPlanned': 'まだ何も計画されていません',
  'trips.search': '旅行を検索',
  'trips.atLimit.title': 'プランで使える旅行をすべて使い切りました',
  'trips.atLimit.action': 'プランを比較',
  'trips.noMatch.title': 'このフィルターに合うものはありません',
  'trips.noMatch.body':
    '別の段階を試すか、検索を消すか、アーカイブを見てください。',
  'trips.noMatch.action': 'フィルターをリセット',
  'trips.empty.body':
    '旅行は日程、地図、予約、持ち物リスト、お金をまとめて持ちます。ひとつ始めれば、あとは付いてきます。',
  'trips.next.title': '次はどこかへ',
  'trips.next.body':
    '旅行を始めると、planned.travel が日付ごとに一日を作り、保存したものを受け止めます。',
  'trips.savedPlaces': '保存した場所',
  'trips.filter.all': 'すべて',
  'trips.filter.favourites': 'お気に入り',
  'trips.view.label': '表示',
  'trips.view.grid': 'グリッド',
  'trips.view.list': 'リスト',
  'trips.card.favourite': 'お気に入り登録',
  'trips.card.noDestination': '行き先は未定',
  'trips.card.noDates': '日程は未定',
  'trips.card.startsIn': 'あと{days}日',
  'trips.card.days': '{days}日',
  'trips.card.copying': '複製中',
  'trips.card.copyingLabel': '{title} はまだ複製中です',
  'trips.card.copyingReason': '複製が終わるまでお待ちください。',
  'trips.card.archivedReason': '編集するには、この旅行を復元してください。',
  'metric.trips': '旅',
  'metric.places': '場所',
  'metric.members': 'メンバー',
  'metric.files': 'ファイル',
  'metric.storage_bytes': 'ストレージ',
  'metric.collections': 'コレクション',
  'metric.journeys': '旅の記録',
  'error.title': 'これを読み込めませんでした',
  'error.body':
    '何も失われていません。もう一度お試しください。続くようなら、下の詳細をお送りください。',
  'error.retry': 'もう一度試す',
  'error.dashboard': 'ダッシュボードに戻る',
  'error.reported': '問題は通知されました。確認を進めています。',
  'error.reference': '参照番号',
  'error.feedback.open': '状況をお知らせください',
  'error.feedback.label': '問題が起きたとき、何をしていましたか？',
  'error.feedback.send': '送信',
  'error.feedback.sent': 'ありがとうございます。とても助かります。',
  'error.feedback.failed': '送信できませんでした。上の参照番号は届いています。',
  'error.root': '道を外れました',
  'error.session': 'ワークスペースへのアクセス権が変わりました',
  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': '問題を報告',
  'feedback.formTitle': '問題を報告',
  'feedback.messageLabel': '何がおかしいですか、または何を変えるべきですか？',
  'feedback.messagePlaceholder':
    '何が起きると思っていて、実際には何が起きましたか？',
  'feedback.emailLabel': 'メールアドレス',
  'feedback.emailPlaceholder': 'name@example.com',
  'feedback.isRequiredLabel': '（必須）',
  'feedback.submitButtonLabel': '報告を送信',
  'feedback.cancelButtonLabel': 'キャンセル',
  'feedback.confirmButtonLabel': '確定',
  'feedback.addScreenshotButtonLabel': 'スクリーンショットを追加',
  'feedback.removeScreenshotButtonLabel': 'スクリーンショットを削除',
  'feedback.highlightToolText': '強調',
  'feedback.hideToolText': '隠す',
  'feedback.successMessageText':
    'ありがとうございます — 報告を受け取りました。',
  'feedback.errorEmptyMessageText':
    'まず一文書いてください — 空の報告では何もわかりません。',
  'feedback.errorTimeoutText':
    '時間がかかりすぎていて、報告が送信されたか確認できません。',
  'feedback.errorForbiddenText': 'このページは報告を送信できません。',
  'feedback.errorGenericText':
    '送信できませんでした。接続と、広告ブロッカーが邪魔していないか確認してください。',

  'notFound.eyebrow': 'エラー 404',
  'notFound.title': 'このページは地図にありません',
  'notFound.body':
    'リンクが古いか、指していた旅が移動または削除されたのかもしれません。',
  'notFound.trips': 'すべての旅',
  'notFound.rootBody':
    '道沿いをすべて探しました。アドレスの打ち間違いか、ページが先へ移ってしまったようです。',
  'notFound.home': 'ホームに戻る',
  'notFound.plans': 'プランを見る',
  'session.noWorkspace':
    'このアカウントはまだワークスペースに紐づいていません。サインアウトして入り直すと、設定が仕上がります。',
  'session.membershipRemoved':
    'このワークスペースのメンバーではなくなりました。',
  'session.workspaceChanged': 'ワークスペースが別のタブまたはウィンドウで切り替えられました。何も保存されていません。',
  'session.workspaceChangedTitle': '別のタブでワークスペースが切り替わりました',
  'session.workspaceChangedBody':
    'このタブには「{name}」が表示されていますが、ワークスペースは別のタブまたはウィンドウで切り替えられました。何も保存されていません。',
  'session.openCurrentWorkspace': '現在のワークスペースを開く',
  'session.workspaceChangedDismiss': '今はしない',
} satisfies TranslationOf<typeof En>

export default messages
