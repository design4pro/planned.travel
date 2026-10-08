/**
 * プラットフォーム コンソールが語ることのすべて、日本語版。
 *
 * `../en/console.ts` を原典として書いた（`docs/SPEC.md` §9）。英語ファイルがスキーマであり、
 * `TranslationOf<typeof En>` は欠けたキーも勝手に足したキーもコンパイルエラーに変える。
 * `__tests__/parity.test.ts` が差し込み変数・複数形の枝・英語の残りをそれぞれ検査する。
 *
 * **複数形。** `Intl.PluralRules('ja')` が返すのは `other` ひとつだけなので、数を含む文は
 * 単複を区別せず、数詞と助数詞で読ませる。
 *
 * **決して混ざらない二つのロール体系**（§5）。プラットフォーム側は管理者・キュレーター・
 * ユーザー、ワークスペース側はオーナー・管理者・メンバー。「管理者」は双方に現れるので、
 * どちらを指すかは常に周囲の文で示す。
 *
 * `Suspend` は「停止」であって「削除」ではない。解除すればアクセスは戻る、と文面で言い切る。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------ セクション -- */

  'nav.label': 'コンソールのセクション',
  'nav.overview': '概要',
  'nav.overview.description': 'プラットフォームをひと目で',
  'nav.accounts': 'アカウント',
  'nav.accounts.description': 'ロール、停止、セッション',
  'nav.runs': 'エージェントの実行',
  'nav.runs.description': 'Sandcastle の艦隊が何を作っているか',

  /* ---------------------------------------------------------------- 外枠 -- */

  'shell.eyebrow': 'プラットフォームそのもの',
  'shell.title': 'コンソール',
  'shell.description': 'プロダクトそのもの — アカウント、権限、共有カタログ',
  'shell.signedInAs': 'ログイン中',
  'shell.error.title': 'コンソールを読み込めませんでした',
  'shell.notFound.title': 'そのアカウントはありません',
  'shell.notFound.body':
    'この識別子を持つものはプラットフォームに存在しません。リンクが作られたあとに削除されたか、アドレスの綴りが違います。',
  'shell.allAccounts': 'すべてのアカウント',
  'shell.overview': 'コンソールの概要',

  'failure.fallback':
    '操作は通りませんでした。少し時間をおいてもう一度お試しください。',

  /* ---------------------------------------------------------------- 概要 -- */

  'overview.error.title': '概要を読み込めませんでした',
  'overview.standing.title': 'プラットフォームでのあなたの権限',
  'overview.standing.body':
    'アカウント、セッション、他人になり代わる操作はプラットフォーム管理者のものです。そのためコンソールが見せるのはカタログだけで、それ以外はありません。',
  'overview.stat.accounts': 'アカウント',
  'overview.stat.accounts.caption': {
    other: 'うち {staff} 件がプラットフォームのロールを持っています',
  },
  'overview.stat.admins': '管理者',
  'overview.stat.admins.caption': 'アカウントとセッションに対する全権',
  'overview.stat.curators': 'キュレーター',
  'overview.stat.curators.caption':
    'カタログのみ — アカウントには決して触れません',
  'overview.stat.suspended': '停止中',
  'overview.stat.suspended.none': '締め出されている人はいません',
  'overview.stat.suspended.some':
    '停止が解除されるまで、どこでもログアウト状態です',
  'overview.stat.suspended.review': '確認する',
  'overview.newest.label': '最新のアカウント',
  'overview.newest.empty.title': 'まだアカウントがありません',
  'overview.newest.empty.body': '最初に登録した人がここに現れます。',
  'overview.catalogue.label': '状態別のカタログ',
  'overview.catalogue.empty.title': '共有カタログはまだ開いていません',
  'overview.catalogue.empty.body':
    '取り込みパイプラインが整えば、このパネルは共有カタログの各スポットを下書き・レビュー中・公開済みとして数え、どの数字からもその一覧を開けるようになります。',
  'overview.scraping.label': '収集の実行',
  'overview.scraping.empty.title': '実行されたソースはありません',
  'overview.scraping.empty.body':
    'ソースは週に一度収集されます。最初の実行が終われば、直近の五件が、何を取り、何を変え、何を落としたかとともにここに並びます。',

  /* --------------------------------------------------------- ロール体系 -- */

  'role.admin': '管理者',
  'role.admin.summary':
    'プラットフォームの全権。アカウント、ロール、停止、セッション、他人になり代わる操作。',
  'role.admin.holds.accounts':
    'アカウントを作成し、プラットフォームのロールを付与する',
  'role.admin.holds.bans': 'アカウントを停止し、停止を解除する',
  'role.admin.holds.sessions': 'セッションを終了し、パスワードを設定する',
  'role.admin.holds.impersonate': '十五分間、アカウントになり代わる',
  'role.admin.holds.curation': 'キュレーターにできることすべて',
  'role.admin.withheld.admins': '他のプラットフォーム管理者になり代わること',
  'role.curator': 'キュレーター',
  'role.curator.summary':
    'カタログ、コレクション、ソース、共有リンクの管理。アカウントに触れることは一切ありません。',
  'role.curator.holds.places': 'カタログのスポットを読み、書き、公開する',
  'role.curator.holds.packs': 'スポットのコレクションを読み、書き、公開する',
  'role.curator.holds.sources': 'カタログのソースを読み、実行する',
  'role.curator.holds.shares': '共有リンクを確認し、失効させる',
  'role.curator.withheld.accounts': 'アカウントやセッションに触れるものすべて',
  'role.curator.withheld.tokens': 'マシン用の資格情報を発行・失効させること',
  'role.user': 'ユーザー',
  'role.user.summary':
    'プラットフォーム上の権限はありません。ほぼ全員がこれです。',
  'role.user.withheld.everything': 'プラットフォームのあらゆる権限、例外なし',

  /* ---------------------------------------------------- 個別のアカウント -- */

  'identity.you': 'これはあなたです',
  'status.active': '有効',
  'status.suspended': '停止中',
  'status.permanent': '無期限',
  'status.until': '{date} まで',
  'status.unverified': '未確認',
  'device.on': '{platform} の {browser}',
  'device.unrecognised': '不明な端末',

  /* -------------------------------------------------------- アカウント一覧 -- */

  'users.error.title': 'アカウント一覧を読み込めませんでした',
  'users.total': '全 {total} 件',
  'users.loading': 'アカウントを読み込んでいます',
  'users.table.label': 'プラットフォームのアカウント',
  'users.search.label': 'アカウントを検索',
  'users.search.email': 'メールアドレスを検索',
  'users.search.name': '名前を検索',
  'users.search.column': 'どの列を検索するか',
  'users.search.submit': '検索',
  'users.field.email': 'メール',
  'users.field.name': '名前',
  'users.filter.role.label': 'プラットフォームのロールで絞り込む',
  'users.filter.role.any': 'すべてのロール',
  'users.filter.role.admin': '管理者',
  'users.filter.role.curator': 'キュレーター',
  'users.filter.status.label': 'アカウントの状態で絞り込む',
  'users.filter.status.any': 'すべての状態',
  'users.filter.hint':
    'ロールか状態で絞り込めます — 一度にどちらか一方だけです。',
  'users.column.account': 'アカウント',
  'users.column.role': 'プラットフォームのロール',
  'users.column.status': '状態',
  'users.column.joined': '参加日',
  'users.column.actions': '操作',
  'users.joined': '{date} に参加',
  'users.pastEnd.title': 'このページは末尾を越えています',
  'users.pastEnd.body': {
    other:
      'この表示には {total} 件のアカウントがあり、つまり{pages}です。{page} ページ目はその外側にあります。',
  },
  'users.pastEnd.pages': {
    other: '{pages} ページ',
  },
  'users.pastEnd.back': '最初のページに戻る',
  'users.empty.filtered.title': 'この条件に合うものはありません',
  'users.empty.filtered.body':
    'この検索に一致するアカウントはプラットフォームにありません。検索を広げるか、絞り込みを解除して全員を表示してください。',
  'users.empty.title': '表示するアカウントがありません',
  'users.empty.body':
    'この表示は空です。何も絞り込まれていないので、広げる余地もありません。',

  /* ------------------------------------------------- アカウントのページ -- */

  'account.error.title': 'このアカウントを読み込めませんでした',
  'account.loading': 'アカウントを読み込んでいます',
  'account.meta.lastChange': '最終変更',
  'account.meta.id': 'アカウント ID',
  'account.banned.title': 'このアカウントは停止中です',
  'account.banned.noReason': '停止とともに理由は記録されていません。',
  'account.banned.permanent': ' 管理者が解除するまで続きます。',
  'account.banned.until': ' {date} に自動で解除されます。',
  'account.banned.untilUnknown': '期限の到来時',
  'account.authority.label': 'プラットフォームでの権限',
  'account.authority.may': 'できること',
  'account.authority.mayNot': 'できないこと',
  'account.authority.none': 'プラットフォーム上では何も。',
  'account.workspaces.label': 'ワークスペース',
  'account.workspaces.truncated':
    'このアカウントは、ここに挙げた {listed} 件より多くのワークスペースに属しています。',
  'account.workspaces.empty.title': 'どのワークスペースにも属していません',
  'account.workspaces.empty.body':
    'このアカウントはまだどのワークスペースにも属していません。最初のログインで一つ作られ、招かれたワークスペースはここに現れます。',
  'account.workspaces.column.workspace': 'ワークスペース',
  'account.workspaces.column.role': 'ロール',
  'account.workspaces.column.plan': 'プラン',
  'account.subscription.label': 'サブスクリプション',
  'account.subscription.free.title': '無料プランです',
  'account.subscription.free.body':
    'このアカウントが所有するワークスペースは一度も決済を通っていないため、サブスクリプションの記録がなく、無料プランの範囲で動いています。',
  'account.subscription.none.title': 'このアカウントへの請求はありません',
  'account.subscription.none.body':
    'このアカウントはワークスペースを一つも所有していません。他人のワークスペースのメンバーであることは、そのワークスペースの請求先であることとは違うので、ここに集めるものはありません。',
  'account.subscription.endsAtClose': '期間の終わりに終了します',
  'account.subscription.seats': 'シート',
  'account.subscription.seatsValue': '{limit} 中 {used}',
  'account.subscription.ends': '終了',
  'account.subscription.renews': '更新',
  'account.sessions.label': '有効なセッション',
  'account.sessions.truncated':
    'このアカウントは一度の取得で列挙できる数を超えるセッションを保持しています。一つも残っていないことを確かめるには、操作メニューからすべてのセッションを終了してください。',
  'account.sessions.empty.title': 'どこでもログアウト状態です',
  'account.sessions.empty.body':
    'このアカウントに有効期限内のセッションはありません。次にログインした瞬間にここへ現れます。',
  'account.sessions.column.device': '端末',
  'account.sessions.column.address': 'アドレス',
  'account.sessions.column.started': '開始',
  'account.sessions.column.expires': '期限',
  'account.sessions.impersonated': 'なり代わり操作から生まれました',
  'account.sessions.noAddress': '記録なし',
  'account.sessions.noAddressLong': 'アドレスの記録はありません',
  'account.sessions.when': '{started} 開始 · {expires} 期限',
  'account.audit.label': '監査の履歴',
  'account.audit.truncated':
    '台帳にはこれより多くの記録があります。プラットフォームの監査証跡は追記のみで、四百日保存されます。',
  'account.audit.empty.title': 'このアカウントには何も行われていません',
  'account.audit.empty.body':
    'ロールの変更、停止、設定されたパスワード、終了されたセッション、なり代わり操作は、実行者とともにすべてここへ書き込まれます。誰もこのアカウントに触れていません。',

  /* --------------------------------------------- ワークスペースの体系 -- */

  'workspace.role.owner': 'オーナー',
  'workspace.role.admin': '管理者',
  'workspace.role.member': 'メンバー',
  'plan.free': '無料',
  'plan.starter': 'スターター',
  'plan.pro': 'プロ',
  'plan.business': 'ビジネス',
  'subscription.trialing': '試用中',
  'subscription.active': '有効',
  'subscription.pastDue': '支払い遅延',
  'subscription.canceled': '解約済み',
  'subscription.incomplete': '未完了',
  'subscription.expired': '期限切れ',
  'subscription.unpaid': '未払い',
  'subscription.paused': '一時停止中',

  /* ------------------------------------------------------------ 監査台帳 -- */

  'audit.action.created': 'アカウントが作成されました',
  'audit.action.updated': 'アカウントの情報が変更されました',
  'audit.action.roleChanged': 'プラットフォームのロールが変更されました',
  'audit.action.banned': 'アカウントが停止されました',
  'audit.action.unbanned': '停止が解除されました',
  'audit.action.deleted': 'アカウントが削除されました',
  'audit.action.passwordSet': '管理者がパスワードを設定しました',
  'audit.action.emailSet': 'メールアドレスが変更されました',
  'audit.action.impersonationStarted': 'なり代わり操作が始まりました',
  'audit.action.impersonationEnded': 'なり代わり操作が終わりました',
  'audit.action.sessionRevoked': 'セッションが終了されました',
  'audit.action.sessionRevokedAll': 'すべてのセッションが終了されました',
  'audit.actor.system': 'プラットフォーム自身',
  'audit.actor.system.detail': '自動',
  'audit.actor.agent': 'マシンの資格情報',
  'audit.actor.agent.detail': 'MCP トークン',
  'audit.actor.deleted': '削除されたアカウント',
  'audit.actorBadge': '当時: {role}',
  'audit.field.name': '名前',
  'audit.field.email': 'メールアドレス',
  'audit.field.emailVerified': 'メール確認済み',
  'audit.field.role': 'プラットフォームのロール',
  'audit.field.banned': '停止中',
  'audit.field.banReason': '理由',
  'audit.field.banExpiresAt': '停止の期限',
  'audit.field.revoked': '終了されたセッション',
  'audit.field.impersonating': 'なり代わっている相手',
  'audit.field.impersonatedBy': 'なり代わっている人',
  'audit.field.expiresAt': 'セッションの期限',
  'audit.field.targetRole': '相手のプラットフォームのロール',
  'audit.field.sessionId': '対象のセッション',
  'audit.value.yes': 'はい',
  'audit.value.no': 'いいえ',
  'audit.value.cleared': '消去',
  'audit.became': '変更後',

  /* ---------------------------------------------------------- ダイアログ -- */

  'dialog.cancel': 'キャンセル',

  'create.button': '新しいアカウント',
  'create.title': 'アカウントを作成',
  'create.body':
    'アドレスは確認されず、メールも送られません — パスワードはご自身で手渡してください。',
  'create.confirm': 'アカウントを作成',
  'create.name.placeholder': '佐藤 陽子',
  'create.email': 'メールアドレス',
  'create.email.placeholder': 'yoko@planned.travel',
  'create.password': 'パスワード',
  'create.password.hint':
    '文になるくらいの長さで。あとから本人が変更できます。',
  'create.done': 'アカウントを作成しました',
  'create.done.body': '{email} は設定したパスワードでログインできます。',

  'action.menu.label': '{name} への操作',
  'action.group.account': 'アカウント',
  'action.group.credentials': '資格情報',

  'action.role.item': 'プラットフォームのロールを変更',
  'action.role.self':
    '自分のアカウントには使えません — 自分を降格すると、プラットフォームが管理者不在になりかねません。',
  'action.role.body':
    '{name} がプラットフォーム自体で何をできるか。ワークスペースの所属は別の語彙であり、これでは動きません。',
  'action.role.confirm': 'ロールを保存',
  'action.role.current': '現在',
  'action.role.done': 'プラットフォームのロールを更新しました',
  'action.role.done.body': '{name} はプラットフォームで {role} になりました。',

  'action.impersonate.item': 'アカウントになり代わる',
  'action.impersonate.self':
    'なり代わる相手がいません — これはあなた自身のアカウントです。',
  'action.impersonate.banned':
    'アカウントは停止中なので、身にまとえるセッションがありません。',
  'action.impersonate.admin':
    'プラットフォームのどのロールも管理者にはなり代われません。あなたのロールも同じです。',
  'action.impersonate.title': '{name} になり代わる',
  'action.impersonate.body':
    '十五分のあいだ、このアカウントに見えているとおりのプロダクトが見えます。',
  'action.impersonate.confirm': '開始',
  'action.impersonate.note.bar':
    '終えるまで警告バーがどの画面にも残り、閉じることはできません。',
  'action.impersonate.note.platform':
    'なり代わっているあいだ、プラットフォームの操作は使えません — コンソールも同じです。',
  'action.impersonate.note.audit':
    '開始も終了も、あなたの名前とともにプラットフォームの監査証跡へ書き込まれます。',

  'action.password.item': 'パスワードを設定',
  'action.password.title': '{name} のパスワードを設定',
  'action.password.body':
    '締め出された人をアカウントへ戻すとき、あるいは乗っ取られたアカウントから攻撃者を締め出すときに使います。',
  'action.password.confirm': 'パスワードを設定',
  'action.password.field': '新しいパスワード',
  'action.password.hint.self':
    '設定した時点ですべてのセッションが終了します — あなたのものも含みます。',
  'action.password.hint':
    '設定した時点で、このアカウントが持つセッションはすべて終了します。',
  'action.password.done': 'パスワードを設定しました',
  'action.password.done.body':
    '{name} はすべての端末からログアウトされました。',

  'action.sessions.item': 'すべてのセッションを終了',
  'action.sessions.body.self':
    'あなたのすべての端末がログアウトされます。これを読んでいる端末も含みます。',
  'action.sessions.body':
    '{name} はすべての端末からログアウトされ、ログインし直すことになります。',
  'action.sessions.confirm': 'セッションを終了',
  'action.sessions.done': 'セッションを終了しました',
  'action.sessions.done.body': {
    other: '{revoked} 件のセッションを終了しました。',
  },

  'action.ban.item': 'アカウントを停止',
  'action.ban.self':
    '自分のアカウントには使えません — 自分を停止すると戻る道が絶たれます。',
  'action.ban.title': '{name} を停止',
  'action.ban.body':
    'すべてのセッションが直ちに終了し、停止が解除されるか期限が切れるまでログインできなくなります。',
  'action.ban.confirm': 'アカウントを停止',
  'action.ban.reason': '理由',
  'action.ban.reason.hint':
    'プラットフォームの監査証跡に十三か月保存され、管理者以外には表示されません。',
  'action.ban.reason.placeholder':
    '三つのワークスペースからの度重なる迷惑行為の報告',
  'action.ban.duration': '期間',
  'action.ban.duration.label': '停止の期間',
  'action.ban.duration.permanent.body':
    '管理者が意図して解除するまで続きます。',
  'action.ban.duration.day': '24 時間',
  'action.ban.duration.day.body':
    '流れを断つには十分長く、介入にとどまる程度に短い長さです。',
  'action.ban.duration.week': '7 日間',
  'action.ban.duration.week.body': '苦情に応じるための一週間。',
  'action.ban.duration.month': '30 日間',
  'action.ban.duration.month.body': '強いられた沈黙のひと月。',
  'action.ban.duration.quarter': '90 日間',
  'action.ban.duration.quarter.body':
    'コンソールが用意する最長の期間です。これより長く止めるなら無期限の停止を選んでください。',
  'action.ban.done': 'アカウントを停止しました',
  'action.ban.done.body':
    '{name} はどこからもログアウトされ、ログインできません。',

  'action.unban.item': '停止を解除',
  'action.unban.title': '{name} の停止を解除',
  'action.unban.body':
    '次の試行からログインできるようになります。以前のセッションは一つも戻りません。',
  'action.unban.confirm': '停止を解除',
  'action.unban.done': '停止を解除しました',
  'action.unban.done.body':
    '{name} は再びログインできます。セッションは復元されていません。',

  'action.delete.item': 'アカウントを削除',
  'action.delete.self':
    '自分のアカウントには使えません — そこから戻る道はありません。',
  'action.delete.title': '{name} を削除',
  'action.delete.body':
    'アカウントと、そのセッションと、結び付いた資格情報がすべて消えます。取り消せません。',
  'action.delete.confirm': 'アカウントを削除',
  'action.delete.note':
    'この人がワークスペース内で作ったものは、それを所有するワークスペースに残ります。削除ではなく停止にすれば、記録を残したままアクセスだけを取り上げられます。',
  'action.delete.owners':
    '他の人も参加しているワークスペースの唯一のオーナーであるアカウントは削除できません。先にそのワークスペースで別のオーナーを指名するか、削除の代わりにアカウントを停止してください。',
  'action.delete.done': 'アカウントを削除しました',
  'action.delete.done.body':
    '{name} と、アカウントに結び付いていたものはすべて消えました。',

  'session.revoke.label': '{device} のセッションを終了',
  'session.revoke.title': 'このセッションを終了',
  'session.revoke.body':
    '{device} は次のリクエストでログインし直すことになります。これを読んでいるセッションなら、あなたも一緒にログアウトされます。',
  'session.revoke.confirm': 'セッションを終了',
  'session.revoke.done': 'セッションを終了しました',
  'session.revoke.done.body':
    '端末は次のリクエストでログインし直すことになります。',

  /* -------------------------------------------------- エージェントの実行 -- */

  'runs.error.title': '実行レジストリが応答しませんでした',
  'runs.origin.local': 'ローカル',
  'runs.origin.githubActions': 'GitHub アクション',
  'runs.stat.live': '実行中',
  'runs.stat.live.none': 'いま作られているものはありません',
  'runs.stat.live.some': '五分のリースに対する心拍',
  'runs.stat.issues': '確保中の課題',
  'runs.stat.issues.caption':
    'それぞれ一つの実行に貸し出され、祖先と子孫も一緒に確保されます',
  'runs.stat.orphans': '孤立したブランチ',
  'runs.stat.orphans.none': '持ち主のいない作業はありません',
  'runs.stat.orphans.some':
    '止まった実行が残したコミットが、引き取り手を待っています',
  'runs.live.empty.title': '登録された実行はありません',
  'runs.live.empty.body':
    '実行は自分を登録した瞬間にここへ現れます — この機械からでも、別の機械からでも、GitHub のランナーからでも — 確保した課題とともに。',
  'runs.holds.nothing': '何も確保していません',
  'runs.holds': '{issues} を確保中',
  'runs.uptime': '稼働 {elapsed} · {lease}',
  'runs.lease.expired': 'リース切れ',
  'runs.lease.left': '残り {elapsed}',
  'runs.wip.label': '進行中の作業',
  'runs.wip.empty.title': '作業を抱えたブランチはありません',
  'runs.wip.empty.body':
    '実行はブランチにコミットが載った時点でそれを記録します。実行が落ちても、次にその課題を確保した実行には、一から始める代わりにこの作業が差し出されます。',
  'runs.wip.orphaned': '孤立',
  'runs.wip.meta': {
    other: '{commits} コミット · {elapsed}前',
  },
  'runs.recent.label': '最近終了した実行',
  'runs.recent.empty.title': 'まだ終了した実行はありません',
  'runs.recent.empty.body':
    '直近五十件の実行が、それぞれどう終わったかとともにここに残ります。',
  'runs.ago': '{elapsed}前',
  'runs.notCoordinator.title': 'このデプロイは艦隊を調整していません',
  'runs.notCoordinator.body':
    '実行レジストリはステージング環境だけに結び付いています。これは意図したものです。レジストリが二つあれば、双方の艦隊が「列を握っているのは自分だ」と信じてしまい、それこそがレジストリの防ごうとしている唯一のことだからです。艦隊はステージング環境で確認してください。',
  'nav.providers': 'プロバイダー',
  'nav.providers.description': '外部への呼び出しとその上限',
  'providers.error.title': 'プロバイダーの計測値を読み込めませんでした',
  'providers.list.label': 'サービス',
  'providers.status.planned': '未接続',
  'providers.status.planned.description':
    'このサービスをまだ何も呼んでいないため、数えるものがありません。最初の請求書のあとではなく最初の呼び出しの前に上限を決められるよう、ここに並べています。',
  'providers.policy.allow': '上限を超えても課金',
  'providers.policy.block': '上限で拒否',
  'providers.badge.blocked': {
    other: '{calls} 件の呼び出しを拒否',
  },
  'providers.limit.none': '上限の取り決めなし · 今月 {used} 件',
  'providers.limit.value': '{limit} 件中 {used} 件',
  'providers.limit.window.day': '本日',
  'providers.limit.window.month': '今月',
  'providers.measuring.none': 'まだ計測がありません',
  'providers.measuring.since': '{date} から計測',
  'providers.stat.calls': '今月の呼び出し',
  'providers.stat.calls.caption': '接続済みの全サービス合計',
  'providers.stat.errors': '失敗した呼び出し',
  'providers.stat.errors.caption':
    '多くの事業者が課金するため、呼び出しとしても数えます',
  'providers.stat.nearLimit': '上限が近い',
  'providers.stat.nearLimit.caption': '警告のしきい値を超えたサービス',
  'providers.stat.blocked': '拒否した呼び出し',
  'providers.stat.blocked.none': '何も拒否していません',
  'providers.stat.blocked.some': '上限が退けた需要',
  'providers.forecast.label': '予測',
  'providers.forecast.provider': 'サービス',
  'providers.forecast.monthEnd': '月末まで',
  'providers.forecast.runRate': 'この調子なら月あたり',
  'providers.forecast.perWorkspace': 'ワークスペースあたり月間',
  'providers.forecast.noWorkspaceTraffic':
    '平均を取るワークスペースの通信がありません',
  'providers.forecast.window': {
    other: '{hours} 時間の計測からの予測です。',
  },
  'providers.forecast.tooEarly': {
    other:
      'まだ {hours} 時間しか計測していないため、予測できません。丸一日に満たない値を一か月に伸ばすのは計算であって予測ではありません。',
  },
  'providers.forecast.atWorkspaces': 'ワークスペース数',
  'providers.forecast.callsEach': '1つあたりの月間呼び出し数',
  'providers.forecast.projected': '月におよそ {calls} 件です。',
  'providers.workspaces.label': '呼び出しの多いワークスペース',
  'providers.workspaces.platform': 'プラットフォーム（ワークスペースなし）',
  'providers.workspaces.empty.title': 'まだ割り当てがありません',
  'providers.workspaces.empty.description':
    'ワークスペースのために行った呼び出しはそのワークスペースに記録されます。定期実行とプラットフォームのメールはどこにも属さず、別に数えます。',
  'providers.readOnly':
    'この計測値は読めますが、上限は動かせません。上限やその方針の変更には provider:configure の権限が要ります。',
  'providers.status.planned.agreed.month':
    '取り決めた上限: 月 {limit}。クライアントができ次第、最初の呼び出しから効きます。',
  'providers.status.planned.agreed.day':
    '取り決めた上限: 1日 {limit}。クライアントができ次第、最初の呼び出しから効きます。',
  'providers.edit.button': '編集',
  'providers.edit.title': '{provider} の上限',
  'providers.edit.body':
    'この配備が事業者と取り決めた支出額と、使い切ったときに何が起きるか。',
  'providers.edit.confirm': '上限を保存',
  'providers.edit.done': '{provider} の上限を保存しました',
  'providers.edit.label': '名称',
  'providers.edit.ceiling': '含まれる呼び出し数',
  'providers.edit.ceiling.hint':
    '上限の取り決めがなければ空のままに。空とゼロは別物です。「拒否」でのゼロはすべての呼び出しを退けます。',
  'providers.edit.ceiling.placeholder': '上限なし',
  'providers.edit.window': '測定単位',
  'providers.edit.window.month': '暦月',
  'providers.edit.window.month.body': '付属枠のふつうの形です。',
  'providers.edit.window.day': '1日',
  'providers.edit.window.day.body':
    '日単位で計る事業者もあります。Geoapify の無料プランは1日3,000クレジットです。',
  'providers.edit.policy': '上限に達したら',
  'providers.edit.policy.allow': '呼び出しを続けて支払う',
  'providers.edit.policy.allow.body':
    '上限を超えても呼び出しは続き、コンソールが警告します。止まるものはありません。',
  'providers.edit.policy.block': 'それ以降を拒否する',
  'providers.edit.policy.block.body':
    '期間がリセットされるまで呼び出しを退けます。この事業者に依存する機能は止まるので、その停止のほうが安く済む場合にだけ選んでください。',
  'providers.edit.policy.block.refused':
    '{provider} は拒否できません。代替経路がないため、呼び出しを退けると費用を抑えるのではなく機能が止まります。警告だけの上限なら設定できます。',
  'providers.edit.warn': '警告 (%)',
  'providers.edit.critical': '重警告 (%)',
  'providers.edit.thresholds.hint':
    'メーターが黄色と赤に変わる位置です。警告は重警告を上回れません。',
} satisfies TranslationOf<typeof En>

export default messages
