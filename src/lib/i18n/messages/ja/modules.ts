/**
 * The trip modules' own copy, in ja.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複数形.** 日本語は `other` の一分岐のみ。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': '未設定',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': '接続中',
  'presence.connecting.body': 'この旅行のライブルームに入っています。',
  'presence.live.title': 'ライブ',
  'presence.live.body': 'メッセージ、メモ、投票がその場で届きます。',
  'presence.reconnecting.title': '再接続中',
  'presence.reconnecting.body':
    '接続が切れました。再試行しています。送った内容はいずれにせよ保存されます。',
  'presence.offline.title': 'ライブ停止',
  'presence.offline.body':
    'ライブ更新は止まっています。保存は続きます。再読み込みか再試行で追いつけます。',
  'presence.reconnect': '再接続',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'すべての移動',
  'transports.empty.title': 'まだ移動がありません',
  'transports.empty.body':
    '飛行機、列車、フェリー、空港からの移動はすべてここに。予約番号と座席番号を当日すぐ出せる形で持ち、乗り継ぎは一つ前と照らし合わせて確認します。',
  'transports.empty.action': '最初の移動を追加',
  'transports.filtered.title': 'その種類の移動はありません',
  'transports.filtered.body':
    'この旅行の移動はそれぞれ手段が違います。「{label}」に戻すとすべて表示されます。',
  'transports.filtered.action': 'すべての移動を表示',
  'transports.alert.impossible.title': {
    other: '乗り継ぎ{value}件が成立しません',
  },
  'transports.alert.impossible.body':
    'ある移動が、その前の移動の到着より先に出発します。下の接続点がどれをどれだけ超えているかを示します。',
  'transports.alert.tight.title': {
    other: '乗り継ぎ{value}件が余裕不足です',
  },
  'transports.alert.tight.body':
    '時間はありますが、乗る手段には余裕が足りません。下の接続点が、それぞれどれだけ残すかを示します。',
  'transports.badge.impossible': {
    other: '成立しない乗り継ぎ{value}件',
  },
  'transports.badge.tight': {
    other: '余裕のない乗り継ぎ{value}件',
  },
  'transports.badge.ok': 'すべての乗り継ぎが成立',
  'transports.remove.body':
    'この移動は予約番号と座席ごと、この旅行から完全に外れます。欠航・運休だけなら、状態を「キャンセル」にしてください。',
  'transports.remove.confirm': '移動を削除',
  'transports.menu.edit': '移動を編集…',
  'transports.field.service': '便名',
  'transports.field.bookingRef': '予約番号',
  'transports.field.seat': '座席',
  'transports.field.distance': '距離',
  'transports.noTime': '時刻は未設定',
  'transports.toast.statusFailed.title': '状態を変更できませんでした',
  'transports.toast.statusFailed.body': '移動は元の状態のままです。',
  'transports.toast.removed': '移動を削除しました',
  'transports.toast.removeFailed': '移動を削除できませんでした',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': '移動を追加',
  'transports.dialog.editTitle': 'この移動を編集',
  'transports.dialog.description':
    '飛行機、列車、フェリー、空港からの移動。時刻は切符に印字された現地時間です。',
  'transports.form.modeLegend': '移動手段',
  'transports.form.timingError': '時刻を確認してください',
  'transports.field.namePlaceholder': 'JAL HND発 CDG着',
  'transports.field.place': '場所',
  'transports.field.code': 'コード',
  'transports.field.date': '日付',
  'transports.field.time': '出発時刻以降',
  'transports.field.departurePlaceholder': '東京 羽田',
  'transports.field.arrivalPlaceholder': 'パリ シャルル・ド・ゴール',
  'transports.field.carrier': '運行会社',
  'transports.field.serviceNumber': '便名・列車番号',
  'transports.field.bookingRefHint': 'カウンターで読み上げる番号です。',
  'transports.field.notesPlaceholder':
    '通路側を希望。荷物は京都まで通しで預託。',
  'transports.action.add': '移動を追加',
  'transports.action.save': '移動を保存',
  'transports.action.saving': '移動を保存中',
  'transports.toast.added': '移動を追加しました',
  'transports.toast.addedBody': '移動の順番に入りました。',
  'transports.toast.addFailed': '移動を追加できませんでした',
  'transports.toast.updated': '移動を更新しました',
  'transports.toast.updateFailed': '移動を更新できませんでした',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': '名称',
  'field.time': '時刻',
  'field.price': '料金',
  'field.notes': 'メモ',
  'field.status': '状態',
  'form.saveError': '保存できませんでした',
  'action.cancel': 'キャンセル',
  'action.showCode': '{label} を表示',
  'book.status.none': '状態なし',
  'book.status.pending': '確認待ち',
  'book.status.confirmed': '確定',
  'book.status.completed': '完了',
  'book.status.cancelled': 'キャンセル済み',
  'book.toast.statusFailed': '状態を変更できませんでした',
  'book.toast.statusFailedBody': '予約は元の状態のままです。',
  'book.toast.removed': '予約を削除しました',
  'book.toast.removeFailed': '予約を削除できませんでした',
  'book.empty.title': 'まだ予約はありません',
  'book.empty.body':
    '宿、席、ツアー、チケットはここに。入口で必要になる確認番号を控え、日付を入れれば旅程の時間軸に並びます。',
  'book.empty.action': '最初の予約を追加',
  'book.filtered.title': 'その種類はまだありません',
  'book.filtered.body':
    '選んだ種類の予約はここにはありません。フィルターを解除すると残りが表示されます。',
  'book.filtered.action': 'フィルターを解除',
  'book.panel.outstanding': 'まだ片づいていない',
  'book.panel.outstandingEmpty':
    '未処理はありません — ここはすべて片づいています。',
  'book.panel.settled': '片づいた',
  'book.panel.settledEmpty':
    'まだ何も片づいていません — すべてこれから追いかけます。',
  'book.import.badge': '未確認のインポート',
  'book.import.hint':
    '確認メールから取り込みました。開いて保存すると確認済みになります。',
  'book.import.action': 'インポート',
  'book.import.title': 'ファイルから予約をインポート',
  'book.import.description':
    '確認書をここに置けば読み取ります。目で見るまで、旅行には何も追加されません。',
  'book.import.drop.idle': 'ここにファイルを置く、または選ぶ',
  'book.import.drop.active': '離すと追加されます',
  'book.import.drop.formats':
    'PDF、保存したメール、ウェブページ、写真、Word、Excel、カレンダーファイル、JSON エクスポート。',
  'book.import.drop.limits': '一度に {files} 件まで、1 件 {size} まで。',
  'book.import.drop.browse': 'ファイルを選ぶ',
  'book.import.refused.format':
    '「{filename}」はこのインポートが読めるファイルではありません。読めるのは PDF、保存したメール、ウェブページ、写真、Word や Excel の書類、カレンダーファイル、JSON エクスポートです。',
  'book.import.refused.tooMany':
    '一度に {files} 件までです。残りは追加していません。',
  'book.import.refused.tooLarge':
    '「{filename}」は {size} です。インポートが読めるのは {limit} までです。',
  'book.import.refused.empty':
    '「{filename}」は空なので、読むものがありません。',
  'book.import.ceiling.title':
    'このワークスペースは今月の確認書をすべて読み終えました',
  'book.import.ceiling.body':
    'プランには月 {ceiling} 件のファイル読み取りが含まれ、枠は 1 日に戻ります。予約は手入力でいつでも追加できます。',
  'book.import.ceiling.none':
    '確認書ファイルの読み取りは、このワークスペースのプランに含まれていません',
  'book.import.ceiling.noneBody':
    'プランを上げると確認書を読み取ってもらえます。手入力での追加はいつでもできます。',
  'book.import.widget.title': '確認書を読んでいます',
  'book.import.widget.working': '{total} 件中 {done} 件を読み取り',
  'book.import.widget.file': '「{filename}」を読んでいます',
  'book.import.widget.done': {
    other: '{count} 件の予約を確認できます',
  },
  'book.import.widget.review': '確認する',
  'book.import.widget.failed': '「{filename}」は読めませんでした',
  'book.import.widget.stalled': '思ったより時間がかかっています',
  'book.import.widget.check': 'もう一度確認',
  'book.import.widget.dismiss': '閉じる',
  'book.import.review.title': '読み取った内容',
  'book.import.review.from': '「{filename}」より',
  'book.import.review.selectAll': 'すべて選ぶ',
  'book.import.review.selectNone': '選択を解除',
  'book.import.review.confirm': {
    other: '{count} 件の予約を追加',
  },
  'book.import.review.confirmNone': '追加する予約を選んでください',
  'book.import.review.cancel': 'キャンセル',
  'book.import.review.needsReview': '確認が必要',
  'book.import.review.needsReviewHint':
    '一部の項目は書類にありませんでした。追加したあとに予約を開いてください。',
  'book.import.review.noPrice': '金額は読み取れず',
  'book.import.review.noPriceHint':
    '書類にはっきり書かれていなかったので、推測せず空のままにしました。',
  'book.import.review.untitled': '名称のない予約',
  'book.import.empty.title': 'そのファイルから予約は見つかりませんでした',
  'book.import.empty.body':
    '「{filename}」には確認書らしいものがありませんでした。別のファイルを試すか、手入力で追加してください。',
  'book.import.failed.title': '「{filename}」は読めませんでした',
  'book.import.failed.body':
    'ファイルは開きましたが、中身を読み取れませんでした。別のファイルを試すか、手入力で追加してください。',
  'book.import.failed.retry': '別のファイルを試す',
  'book.import.uploadFailed': '「{filename}」はアップロードされませんでした',
  'book.import.uploadRetry': 'もう一度試す',
  'book.import.actionFailed': 'しばらくしてからもう一度お試しください。',
  'book.import.toast.added': {
    other: '{count} 件の予約を追加しました',
  },
  'book.import.partial.title':
    '{total} 件のうち {written} 件の予約を追加しました',
  'book.import.partial.body':
    '残りは選んだままです。もう一度追加すると、その分だけ書き込みます。',
  'book.import.partial.retry': '残りを追加',
  'book.journeyLink': '移動タブで見る',
  'filter.all': 'すべて',
  'book.remove.body':
    '時間軸から完全に消えます。取消だけなら、記録を残すために状態を「キャンセル済み」にしてください。',
  'book.remove.confirm': '予約を削除',
  'book.menu.edit': '予約を編集…',
  'book.menu.open': '予約を開く',
  'book.noDate': '日付は未設定',
  'book.until': 'まで',
  'book.provider': '提供元',
  'book.where': '場所',
  'book.guests': '人数',
  'book.confirmation': '確認番号',
  'book.undated': '日付を入れると時間軸に並びます',
  statusOf: '{title} の状態',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'まだ状態なし',
  'book.statusChoice.pending': '確認待ち — 相手の返事を待っています',
  'book.dialog.addTitle': '予約を追加',
  'book.dialog.editTitle': 'この予約を編集',
  'book.dialog.typeLegend': 'どんな予約ですか',
  'book.field.namePlaceholder': '西新宿1-19-3',
  'book.field.priceHint': 'まだ精算していなければ空のままで。',
  'book.field.confirmation': '確認番号',
  'book.field.confirmationHint': '受付で尋ねられる番号です。',
  'book.field.day': '日程に紐づける',
  'book.field.dayHint': '旅程に固定して、計画に表示させます。',
  'book.field.noDay': '旅程に入れない',
  'book.field.link': 'リンク',
  'book.field.notesPlaceholder':
    '遅いチェックインを手配済み。エレベーターから離れた部屋を希望。',
  'book.action.add': '予約を追加',
  'book.action.save': '予約を保存',
  'book.action.saving': '予約を保存中',
  'book.toast.added': '予約を追加しました',
  'book.toast.addedBody': '時間軸に並びました。',
  'book.toast.addFailed': '予約を追加できませんでした',
  'book.toast.updated': '予約を更新しました',
  'book.toast.updateFailed': '予約を更新できませんでした',

  'book.emptyFacts':
    '名前以外はまだ何も入っていません。開いて時刻・料金・確認番号を足してください。',
  'book.onItinerary': '旅程に登録: {day}',
  'book.dayNumber': '{n} 日目',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'その他',
  'book.field.host': 'ホテルまたはホスト',
  'book.field.restaurant': '店名',
  'book.field.operator': '主催',
  'book.field.issuer': '発行元',
  'book.field.carrier': '運行会社',
  'book.field.address': '住所',
  'book.field.meetingPoint': '集合場所',
  'book.field.venue': '会場',
  'book.field.fromTo': '区間',
  'book.field.checkIn': 'チェックイン',
  'book.field.date': '日付',
  'book.field.validOn': '有効日',
  'book.field.departs': '出発',
  'book.field.checkOut': 'チェックアウト',
  'book.field.ends': '終了',
  'book.field.arrives': '到着',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'ジブリ美術館',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': '誰が取ってくれているか',
  'book.example.accommodationTitle': 'ホテルグレイスリー新宿 · ツイン2室',
  'book.example.restaurantTitle': '傳での夕食',
  'book.example.activityTitle': 'teamLab Planets、チケット4枚',
  'book.example.tourTitle': '嵐山の竹林散策',
  'book.example.ticketTitle': 'ジブリ美術館、10:00入館',
  'book.example.transportTitle': 'のぞみ21号 京都行き',
  'book.example.otherTitle': '何を予約したか',
  'book.hint.accommodation':
    'ホテル、旅館、アパート — 泊まる場所ならどこでも。',
  'book.hint.restaurant': '予約した席。守るべきは時間です。',
  'book.hint.activity': '教室、銭湯、予約した体験。',
  'book.hint.tour': '場所と時間、そして待っているガイド。',
  'book.hint.ticket': '時間指定の入場、美術館パス、試合。番号は手元に。',
  'book.hint.transport': '予約した座席。移動まるごと・番号付きは{module}へ。',
  'book.hint.other': 'あなたの名前で押さえてあって、他に当てはまらないもの。',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': '荷造り',
  'lists.kind.todo': 'やること',
  'lists.kind.shopping': '買い物',
  'lists.kind.documents': '書類',
  'lists.kind.fallback': 'リスト',
  'colour.none': '色なし',
  'colour.pine': '松',
  'colour.inkBlue': 'インクブルー',
  'colour.amber': '琥珀',
  'colour.green': '緑',
  'colour.red': '赤',
  'colour.slate': 'スレート',
  'lists.toast.created': 'リストを作成しました',
  'lists.toast.createdBody': '忘れてはいけないものを最初に入れましょう。',
  'lists.toast.createFailed': 'リストを作成できませんでした',
  'lists.toast.updated': 'リストを更新しました',
  'lists.toast.updateFailed': 'リストを更新できませんでした',
  'lists.error.weightLimit': '重量上限はグラム単位の整数です。',
  'lists.dialog.editTitle': 'このリストを編集',
  'lists.dialog.editBody': '名前を変える、種類を変える、あるいは一人に任せる。',
  'lists.dialog.addBody':
    '荷造り、やること、買い物、忘れてはいけない書類 — それぞれに専用のリストを。',
  'lists.action.new': '新しいリスト',
  'lists.field.namePlaceholder': '機内持ち込み',
  'lists.field.kind': '種類',
  'lists.field.kindAria': 'リストの種類',
  'lists.field.owner': '所属',
  'lists.field.ownerHint': '共有リストは誰でもチェックできます。',
  'lists.field.everyone': '旅行の全員',
  'lists.field.weightLimit': '重量上限',
  'lists.field.weightLimitHint': 'グラム。守るべき上限がなければ空のままで。',
  'colour.legend': '色',
  'lists.action.saving': 'リストを保存中',
  'lists.action.save': 'リストを保存',
  'lists.action.create': 'リストを作成',
  'lists.item.toast.added': '項目を追加しました',
  'lists.item.toast.addFailed': '項目を追加できませんでした',
  'lists.item.toast.updated': '項目を更新しました',
  'lists.item.toast.updateFailed': '項目を更新できませんでした',
  'lists.item.error.quantity': '数量は1から999までの整数です。',
  'lists.item.error.weight': '重さはグラム単位の整数です。',
  'lists.item.dialog.editTitle': 'この項目を編集',
  'lists.item.dialog.addTitle': '項目を追加する',
  'lists.item.field.label': '項目',
  'lists.item.field.placeholder': 'パスポート',
  'field.category': 'カテゴリ',
  'lists.item.field.categoryHint': '見出しでリストをまとめます。任意。',
  'lists.item.field.categoryPlaceholder': '書類',
  'lists.item.field.priority': '優先度',
  'lists.priorityChoice.high': '高 — 忘れない',
  'lists.priorityChoice.low': '低 — 余裕があれば',
  'lists.priorityChoice.normal': '普通',
  'lists.item.field.quantity': '数量',
  'lists.item.field.weight': '重さ',
  'lists.item.field.weightHint': 'グラム、1個あたり。',
  'lists.item.field.owner': '誰の担当か',
  'lists.item.owner.nobody': '特に誰でもない',
  'lists.item.action.saving': '項目を保存中',
  'lists.item.action.save': '項目を保存',
  'lists.item.action.add': 'リストに追加',
  'lists.template.loadError': '今はテンプレートを読み込めませんでした。',
  'lists.template.toast.added': 'テンプレートからリストを追加しました',
  'lists.template.toast.addFailed': 'テンプレートは適用されませんでした',
  'lists.template.error.apply': 'それは適用できませんでした',
  'lists.template.error.load': 'テンプレートを読み込めませんでした',
  'lists.template.empty.title': 'テンプレートはまだありません',
  'lists.template.empty.body':
    'また同じように作りたいリストができたらテンプレートとして保存しましょう。以降の旅行すべてでここに並びます。',
  'lists.template.applying': 'テンプレートを適用中',
  'lists.template.dialogTitle': 'テンプレートから始める',
  'lists.template.loading': 'テンプレートを読み込み中',
  'lists.template.apply': 'テンプレートを適用',
  'lists.template.from': 'テンプレートから',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': '担当なし',
  'lists.toast.listRemoved': 'リストを削除しました',
  'lists.toast.listRemoveFailed': 'リストを削除できませんでした',
  'lists.toast.itemRemoved': '項目を削除しました',
  'lists.toast.itemRemoveFailed': '項目を削除できませんでした',
  'lists.toast.reset': 'リストをリセットしました',
  'lists.toast.resetBody': 'すべてのチェックを外し、次の旅行に備えました。',
  'lists.toast.resetFailed': 'リストをリセットできませんでした',
  'lists.toast.tickFailed': 'チェックを保存できませんでした',
  'lists.toast.tickFailedBody': '項目は元の状態に戻りました。',
  'lists.toast.assignFailed': '担当の割り当てを保存できませんでした',
  'lists.toast.orderFailed': '新しい並び順を保存できませんでした',
  'lists.toast.orderFailedBody': 'リストは元の状態に戻りました。',
  'lists.filter.todo': 'まだやること',
  'lists.filter.done': '完了',
  'lists.scope.all': 'すべてのリスト',
  'lists.scope.shared': '共有',
  'lists.scope.mine': '自分の',
  'lists.empty.mine.title': '自分のリストはまだありません',
  'lists.empty.shared.title': '共有リストはまだありません',
  'lists.empty.mine.body':
    '自分のリストはあなただけがチェックします — 他の人が見る必要のないものに。',
  'lists.empty.shared.body':
    '共有リストは誰でもチェックできるので、二人が同じ変換プラグを持っていくことがありません。',
  'lists.remove.list': 'リストを削除',
  'lists.remove.item': '項目を削除',
  'lists.remove.itemBody': 'このリストから外れます。ほかは変わりません。',
  'lists.menu.editList': 'リストを編集…',
  'lists.menu.tickAll': 'すべてチェック',
  'lists.menu.untickAll': 'すべてのチェックを外す',
  'lists.menu.reset': '次の旅行に向けてリセット',
  'lists.menu.dragOrderLong': 'ドラッグできる並び順に切り替える',
  'lists.menu.groupAgain': 'もう一度カテゴリでまとめる',
  'lists.menu.dragOrder': 'ドラッグ可能な並び順に切り替える',
  'lists.menu.groupByCategory': 'カテゴリでまとめる',
  'lists.weight.packed': '{weight} 分を荷造り済み',
  'lists.weight.packedOver': '{weight} 分を荷造り済み — 上限超え',
  'lists.weight.packedOf': '{weight} 分を荷造り済み（上限 {limit}）',
  'lists.weight.packedOfOver':
    '{weight} 分を荷造り済み（上限 {limit}）— 上限超え',
  'lists.progress.ticked': '{total} 件のうち {done} 件をチェック',
  'lists.items.empty.title': 'このリストは空です',
  'lists.items.empty.body':
    '忘れてはいけないものを最初に入れましょう — 下の入力欄がいちばん早いです。',
  'lists.items.doneEmpty.title': 'まだ何もチェックしていません',
  'lists.items.doneEmpty.body': '何かにチェックを入れると、ここに並びます。',
  'lists.items.todoEmpty.title': 'ここはすべて完了しています',
  'lists.items.todoEmpty.body':
    'このリストの項目はすべてチェック済みです。「{label}」に切り替えると表示されます。',
  'lists.category.other': 'その他すべて',
  'lists.dnd.fallbackName': 'この項目',
  'lists.dnd.picked': '{name} をつかみました。',
  'lists.dnd.dropped': '{name} を置きました。新しい並び順を保存しています。',
  'lists.dnd.cancelled': 'キャンセルしました。並び順は変わりません。',
  'lists.menu.editItem': '項目を編集…',
  'lists.quickAdd.placeholder': '項目を入力して Enter',
  'lists.quickAdd.aria': 'このリストに項目を追加',
  'lists.quickAdd.detailsHint': '重さ・カテゴリ・担当を付けて追加',
  'lists.quickAdd.detailsAria': 'すべての詳細を付けて項目を追加',
  'lists.show': '表示',
  'lists.priority.high': '高',
  'lists.action.add': '追加',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    other: '{count} 件',
  },
  'lists.template.copiedIn': {
    other: '{count} 件を取り込みました。チェックの準備ができています。',
  },
  'lists.remove.listBody': {
    other:
      'このリストと {count} 件の項目がこの旅行から外れます。保存したテンプレートはそのままです。',
  },

  'lists.item.dialog.body':
    '名前以外はすべて任意です — 重さを入れると荷物の合計が実際の数字になり、カテゴリでリストがまとまります。',
  'lists.template.dialogBody':
    'テンプレートは以前に保存したリストです。適用するとこの旅行の新しいリストとして複製され、元のリストはそのまま残ります。',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': '「{name}」を削除しますか？',
  actionsFor: '{name} の操作',
  'lists.dnd.reorder': '{name} を並べ替え',
  'lists.action.untickItem': '{name} のチェックを外す',
  'lists.action.tickOffItem': '{name} をチェック',
  'lists.item.assignAria': '{name} を誰かに割り当てる',
  'lists.item.reassignAria': '{item} は {owner} の担当 — 割り当て直す',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty': 'この予約に、一覧で見て分かる名前を付けてください。',
  'error.titleLong': '名前は160文字までにしてください。',
  'book.error.required': 'この予約には {field} が足りません。',
  'book.error.timeNeedsDate': '時刻には、その日付が必要です。',
  'book.error.endTimeNeedsDate': '終了時刻には、その日付が必要です。',
  'book.error.endsBeforeStart': 'これは始まる前に終わっています。',
  'book.fieldName.checkInDay': 'チェックイン日',
  'book.fieldName.checkOutDay': 'チェックアウト日',
  'book.stay.pickDay': '日を選ぶ',
  'book.stay.nights': {
    other: '{count} 泊',
  },
  'book.stay.range': '{from} から {to}',
  'book.stay.label': '宿泊',
  'book.remove.keepsNights':
    '宿泊した夜は旅程に残ります。削除されるのは予約だけです。',
  'book.menu.removeWithStay': '予約と宿泊を削除',
  'book.removeStay.body': '予約と、それが支払う夜の両方が削除されます。',
  'book.toast.stayRemoved': '予約と宿泊を削除しました',
  'book.error.endTimeBeforeStart': '終了時刻が開始時刻より前です。',
  'book.error.guests': '人数は1000までの整数で入れてください。',
  'error.price': 'この金額は読み取れません。',
  'book.error.url': 'リンクは http:// か https:// で始めてください。',
  'book.error.confirmationLong': 'この確認番号は長すぎて保存できません。',
  'book.error.stopGone': 'その停車地はこの旅程にもうありません。',
  'book.ledger.unlinked':
    'この予約の費用行は旅の費用に残りますが、予約とのひも付けは解除されます。',
  'book.ledger.updated': 'この予約の費用行は{money}に更新されます。',
  'book.ledger.needsDate':
    'この予約に日付を入れると、費用が旅の費用に追加されます。',
  'book.ledger.added': 'この旅の費用に{money}の行が追加されます。',
  'book.fieldName.provider': '運行会社',
  'book.fieldName.location': '場所',
  'book.fieldName.confirmationNumber': '確認番号',
  'book.fieldName.link': 'リンク',
  'book.fieldName.date': '日付',
  'book.fieldName.time': '時刻',
  'book.fieldName.endDate': '終了日',
  'book.fieldName.endTime': '終了時刻',
  'book.fieldName.guests': '人数',
  'book.fieldName.price': '料金',
  'book.fieldName.stop': '停車地',
  'book.field.stop': '紐づける立ち寄り先',
  'book.field.stopHint': 'この予約が予定のどの立ち寄り先のものか。',
  'book.field.stopHintEmpty':
    'まず日程に場所を追加すると、この予約を紐づけられます',
  'book.field.stopPlaceholder': '立ち寄り先なし',
  'book.field.stopSearch': '立ち寄り先と日を検索',
  'book.field.stopEmpty': '該当する立ち寄り先はありません',
  'book.ledger.refused.title': '保存しましたが、費用には入れられませんでした',
  'book.ledger.refused.body':
    '予約は旅程に入りました。費用の行を旅程の費用に追加できませんでした — その半分だけやり直してください。',
  'book.action.ledgerRetry': '費用に追加する',
  'book.ledger.splitStale.title':
    '保存しましたが、割り勘の合計が合わなくなりました',
  'book.ledger.splitStale.body':
    '予約と新しい料金は保存しましたが、この費用の分担は新しい合計に合わせられませんでした。「費用」でこの項目を開いて、分担を直してください。',
  'book.action.done': '完了',
  'book.copyConfirmation': '{title} の確認番号',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': '飛行機',
  'transports.mode.train': '列車',
  'transports.mode.bus': 'バス',
  'transports.mode.ferry': 'フェリー',
  'transports.mode.car': '車',
  'transports.mode.taxi': 'タクシー',
  'transports.mode.transit': '公共交通',
  'transports.mode.metro': '地下鉄',
  'transports.mode.tram': '路面電車',
  'transports.mode.bike': '自転車',
  'transports.mode.walk': '徒歩',
  'transports.mode.other': 'その他',
  'transports.mode.fallback': '移動',
  'transports.rank.earliest': '到着が早い順',
  'transports.rank.fewestChanges': '乗り換えが少ない順',
  'transports.connection.findStop': '停留所を探す',
  'transports.connection.findStopSearch': 'HND、東京、羽田…',
  'transports.connection.findStopEmpty': 'その名前の停留所は目録にありません。',
  'transports.connection.hideStops': '停車地を隠す',
  'transports.connection.seeStops': '停車地を見る',
  'transports.connection.saving': '接続を保存しています',
  'transports.connection.use': 'これにする',
  'transports.connection.onFoot': '徒歩',
  'transports.connection.service': '便',
  'transports.connection.direct': '直通',
  'transports.connection.changes': {
    other: '乗り換え {changes} 回',
  },
  'transports.connection.tooLong':
    'この接続は区間が {max} を超えていて、旅程の記録一つには収まりません。短い区間で探し、残りは別に記録してください。',
  'transports.connection.refusal.ceiling': '今月の検索回数は残っていません',
  'transports.connection.refusal.unconfigured':
    'この配備では接続検索が無効です',
  'transports.connection.refusal.provider':
    '時刻表サービスから応答がありません',
  'transports.connection.refusal.plan':
    '接続検索はこのプランに含まれていません',
  'transports.connection.refusal.planBody':
    '旅程の中から時刻表を検索するにはプランを変更してください。移動は手入力でも記録できます。',
  'transports.connection.refusal.ceilingBody':
    '今月分の{ceiling}回を使い切りました。翌月1日に戻ります。移動は手入力でも記録できます。',
  'transports.connection.refusal.unconfiguredBody':
    'ここには時刻表サービスが設定されていないため、検索は行われていません。移動は手入力で記録してください。',
  'transports.connection.refusal.providerBody':
    '表示できるものが返ってきませんでした。少し待って再試行するか、移動を手入力で記録してください。',
  'transports.connection.invitation':
    '停留所を二つと日付を、時刻表が答えます。選ぶまで何も保存されません。',
  'transports.connection.empty':
    'その日、その二つの停留所を結ぶ接続は見つかりませんでした。隣の駅を試すか、交通手段の絞り込みを広げてください。',
  'transports.connection.credit': '時刻表データ提供:',
  'transports.connection.searchFailed': '検索は実行されませんでした',
  'transports.connection.searchFailedBody':
    '少ししてからもう一度お試しください。',
  'transports.connection.saved': '接続を保存しました',
  'transports.connection.replaced': '経路を差し替えました',
  'transports.connection.replacedBody': '予約番号と座席はそのままです。',
  'transports.connection.saveFailed': '接続は保存されませんでした',
  'transports.connection.saveError': '保存できませんでした',
  'transports.connection.fromHint':
    '停留所を選んでください — 時刻表が尋ねるのは場所で、名前ではありません。',
  'transports.connection.toHint': '目録から停留所を選んでください。',
  'transports.connection.timeHint':
    '時刻表は直後の数便を返すため、ここでどの便かが決まります。',
  'transports.connection.onlyModes': 'この手段だけ',
  'transports.connection.searching': '時刻表を検索しています',
  'transports.connection.search': '接続を検索',
  'transports.connection.title': '{from} から {to} へ',
  'transports.status.idea': '検討中',
  'transports.status.pending': '確認待ち',
  'transports.status.confirmed': '確定',
  'transports.status.completed': '完了',
  'transports.status.cancelled': '取消',
  'transports.end.fromAirport': '出発空港',
  'transports.end.toAirport': '到着空港',
  'transports.end.fromPort': '出発港',
  'transports.end.toPort': '到着港',
  'transports.end.fromStation': '出発駅',
  'transports.end.toStation': '到着駅',
  'transports.end.from': '出発',
  'transports.end.to': '到着',
  'transports.end.pickUp': '受取',
  'transports.end.dropOff': '返却',
  'transports.end.departureDay': '出発日',
  'transports.end.arrivalDay': '到着日',
  'transports.end.pickUpDay': '受取日',
  'transports.end.returnDay': '返却日',
  'transports.dayNumber': '{n}日目',
  'transports.error.titleEmpty':
    'この移動に、一覧で見て分かる名前を付けてください。',
  'transports.error.date': '日付は YYYY-MM-DD の形で書きます。',
  'transports.error.time': '時刻は 24 時間制の HH:MM で書きます。',
  'transports.error.departureNeedsDate': '出発時刻には、その日付が必要です。',
  'transports.error.arrivalNeedsDate': '到着時刻には、その日付が必要です。',
  'transports.error.code': 'コードは 2〜8 文字の英数字です。',
  'transports.error.distance': '距離はキロメートル単位の数値で、100,000 まで。',
  'transports.error.arrivesBeforeDeparts':
    'この移動は出発より前に到着しています。',
  'transports.error.timingHint':
    'どちらかをずらして、この移動に実際に間に合うようにしてください。',
  'transports.error.arrivalDayBeforeDeparture':
    '到着日が出発日より前になっています。',
  'transports.error.returnDayBeforePickUp':
    '返却日が受取日より前になっています。',
  'transports.field.noDay': '日付はまだ未定',
  'transports.fill.legend': '入力のしかた',
  'transports.fill.manual': '自分で入力する',
  'transports.fill.searchAgain': 'もう一度検索',
  'transports.fill.search': '接続を検索',
  'transports.chain.unsplit': 'ひとつの旅程に戻す',
  'transports.field.arrivalDayHint': '翌朝に到着する旅程はここでそう伝えます。',
  'transports.chain.splitHint':
    '途中で乗り換えますか。各区間を便名・のりば・座席・時刻ごとに記録します。',
  'transports.chain.split': '区間に分ける',
  'transports.chain.stopNumber': '停車地{n}',
  'transports.chain.change': '乗り換え {n}',
  'transports.chain.removeStation': '{label} を削除',
  'transports.chain.findStation': '空港や駅を探す',
  'transports.chain.findStationFor': '{label} の空港や駅を探す',
  'transports.chain.findPlaceholder': 'HND、羽田、東京…',
  'transports.chain.findEmpty': '該当なし — 下に自分で入力してください。',
  'transports.chain.stopLabel': '停車地',
  'transports.chain.stopPlaceholder': '新大阪',
  'transports.chain.timezoneHint': 'この停車地の時計',
  'transports.chain.timezoneAt': '{label} のタイムゾーン',
  'transports.chain.timezonePlaceholder': '未指定',
  'transports.chain.timezoneSearch': '東京、リスボン、UTC…',
  'transports.chain.acrossClocks': '{gap}（時計は二つ）',
  'transports.chain.addStopAfter': '{label} の後に停車地を追加',
  'transports.chain.servicePlaceholder': 'ひかり500号',
  'transports.chain.leaves': '{label} 発',
  'transports.chain.reaches': '{label} 着',
  'transports.chain.dayOfLeg': '区間 {n} の{label}',
  'transports.chain.formError': 'この連続は保存できません',
  'transports.chain.atCap':
    '一つの連続に入る区間は最大 {max} — 一度の保存が運べる量の上限であって、乗り換えの回数の上限ではありません。',
  'transports.chain.hint':
    'どの区間にも停車地を足せば乗り換えを記録できます。区間ごとに列車番号・番線・座席を持ちます。',
  'transports.field.timezone': 'タイムゾーン',
  'transports.field.platform': '番線',
  'transports.chain.legNumber': '区間 {n}',
  'transports.chain.platform': '{value} 番線',
  'transports.chain.seat': '座席 {value}',
  'transports.chain.error.stopName':
    'すべての停車地に名前が必要です — ここで乗り換えます。',
  'transports.chain.error.stopNameLong':
    '停車地の名前は200文字未満にしてください。',
  'transports.chain.error.timezone': 'リストからタイムゾーンを選んでください。',
  'transports.chain.error.tooManyLegs':
    '1つの経路に含められる区間は最大{max}件です。',
  'transports.bookingRefFor': '{title} の予約番号',
  'transports.doorToDoor': 'ドアツードアで {gap} です。',
  'transports.title.fromTo': '{operator} {from}発 {to}行き',
  'transports.title.from': '{operator} {from}発',
  'transports.title.to': '{operator} {to}行き',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': '比べる時刻がありません',
  'transports.junction.unknown.detail':
    '両方の移動に日付と時刻を入れると、この乗り換えを確認します。',
  'transports.junction.impossible.headline':
    '前の移動の到着より {gap} 早く出発します',
  'transports.junction.impossible.detail':
    '「{to}」が「{from}」の到着より先に出発するため、両方には乗れません。どちらかをずらしてください。',
  'transports.junction.tight.headline': '乗り換え {gap}',
  'transports.junction.tight.detail':
    '{mode} はふつう {required} ほど必要です。これはぎりぎりです。',
  'transports.junction.tight.detailAt':
    '{place} での {mode} はふつう {required} ほど必要です。これはぎりぎりです。',
  'transports.junction.ok.headline': '{gap} の間隔',
  'transports.junction.ok.detail':
    '{landing} に到着しますが、次の移動は {boarding} 発です — そこまで行く必要があります。',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'メモを共有しました',
  'collab.note.toast.sharedBody': '旅行の全員がもう見られます。',
  'collab.note.toast.shareFailed': 'メモを共有できませんでした',
  'collab.note.toast.updated': 'メモを更新しました',
  'collab.note.toast.updateFailed': 'メモを更新できませんでした',
  'collab.note.dialog.editTitle': 'このメモを編集',
  'collab.note.dialog.addTitle': '新しい共有メモ',
  'collab.note.dialog.body':
    'おすすめの店、ビザの条件、玄関の暗証番号 — 旅行の全員が覚えておくべきことを一か所に。',
  'collab.note.field.title': 'タイトル',
  'collab.note.field.titlePlaceholder': '玄関の暗証番号',
  'collab.note.field.body': 'メモ',
  'collab.note.field.bodyPlaceholder':
    '4821 のあとに # キー。キーボックスはドアの左側です。',
  'collab.note.field.categoryHint': 'ボードをフィルターでまとめます。任意。',
  'collab.note.field.categoryPlaceholder': '手配',
  'collab.note.field.pin': 'ボードの上部に固定',
  'collab.note.field.pinHint':
    '固定したメモは、あとから何が増えても先頭に並びます。',
  'collab.note.action.saving': 'メモを保存中',
  'collab.note.action.save': 'メモを保存',
  'collab.note.action.share': 'メモを共有',
  'collab.poll.toast.opened': '投票を開始しました',
  'collab.poll.toast.openedBody': '旅行の全員がもう投票できます。',
  'collab.poll.toast.openFailed': '投票を開始できませんでした',
  'collab.poll.dialog.addTitle': '新しい投票',
  'collab.poll.field.question': '質問',
  'collab.poll.field.questionPlaceholder': '最後の夜はどこで食べますか？',
  'collab.poll.field.optionsLegend': '選択肢',
  'collab.poll.field.option': '項目 {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'もう一つの項目',
  'collab.poll.action.addOption': '項目を追加',
  'collab.poll.action.removeOption': '項目を削除 {n}',
  'collab.poll.field.multi': '複数選べるようにする',
  'collab.poll.field.multiHint':
    'オフなら一人一票で、考えが変われば票が移ります。',
  'collab.poll.action.opening': '投票を開始中',
  'collab.poll.action.open': '投票を開始',
  'collab.poll.error.tooFew': '投票には選ぶものが少なくとも二つ必要です。',
  'collab.poll.error.duplicate':
    '二つの項目が同じことを言っています。それぞれ別の言い方にしてください。',
  'collab.presence.viewingNow': 'が閲覧中',
  'collab.presence.unnamed': '名前のないメンバー',
  'collab.presence.tabsOpen': {
    other: '{name} — タブ {count} 個を開いています',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': '同意',
  'collab.reaction.love': 'いいね',
  'collab.reaction.funny': '笑える',
  'collab.reaction.celebrate': 'おめでとう',
  'collab.reaction.thanks': 'ありがとう',
  'collab.reaction.looking': '見てます',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}（あなたを含む）',
  'collab.thread.today': '今日',
  'collab.thread.empty': 'まだメッセージはありません',
  'collab.toast.reactionFailed': 'リアクションを保存できませんでした',
  'collab.toast.messageDeleted': 'メッセージを削除しました',
  'collab.toast.deleteFailed': 'メッセージを削除できませんでした',
  'collab.toast.notSent': '未送信',
  'collab.toast.notSentBody':
    'メッセージを送信できませんでした。少ししてからもう一度どうぞ。',
  'collab.toast.messageUpdated': 'メッセージを更新しました',
  'collab.toast.editFailed': '編集を保存できませんでした',
  'collab.message.deleteTitle': 'このメッセージを削除しますか？',
  'collab.message.deleteBody':
    '本文がスレッドから消えます。返信はその場に残ります。',
  'collab.message.delete': 'メッセージを削除',
  'collab.message.reply': '返信',
  'collab.message.menuEdit': 'メッセージを編集…',
  'collab.message.react': 'このメッセージにリアクション',
  'collab.message.edited': '編集済み',
  'collab.message.actionsFor': '{name} のメッセージの操作',
  'collab.compose.editingYours': '自分のメッセージを編集中',
  'collab.compose.replyingTo': '{name} に返信中',
  'collab.compose.cancelReply': '返信をやめる',
  'collab.compose.cancelEdit': '編集をやめる',
  'collab.compose.placeholder': '旅行のみんなへ',
  'collab.compose.placeholderText': 'グループに何か書く…',
  'collab.compose.editPlaceholder': '自分のメッセージを編集',
  'collab.compose.editPlaceholderText': '書いた内容を変える…',
  'collab.compose.send': 'メッセージを送信',
  'collab.compose.savingEdit': '編集を保存中',
  'collab.compose.save': '保存',
  'collab.hint.sends': 'で送信',
  'collab.hint.addsLine': 'で改行',
  'collab.hint.cancels': 'で取り消し',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'メモを削除しました',
  'collab.toast.noteRemoveFailed': 'メモを削除できませんでした',
  'collab.notes.empty.title': '共有メモはありません',
  'collab.notes.empty.body':
    'おすすめの店、ビザの条件、玄関の暗証番号 — 旅行の全員が覚えておくべきこと。',
  'collab.notes.empty.action': '最初のメモを書く',
  'collab.note.menu.edit': 'メモを編集…',
  'collab.note.menu.unpin': '固定を解除',
  'collab.note.menu.pin': '上部に固定',
  'collab.note.remove': 'メモを削除',
  'collab.note.removeBody': 'メモは旅行の全員のボードから消えます。',
  'collab.note.new': '新しいメモ',
  'collab.poll.toast.voteFailed': 'あなたの票を保存できませんでした',
  'collab.poll.toast.voteFailedBody': '集計は変わっていません。',
  'collab.poll.toast.closed': '投票を締め切りました',
  'collab.poll.toast.closeFailed': '投票を締め切れませんでした',
  'collab.poll.toast.removed': '投票を削除しました',
  'collab.poll.toast.removeFailed': '投票を削除できませんでした',
  'collab.polls.heading': '投票一覧',
  'collab.polls.empty.title': '開いている投票はありません',
  'collab.polls.empty.body':
    'レストランで意見がまとまらないときは、投票にかけて答えが自然に決まるのを待ちましょう。',
  'collab.polls.empty.action': 'みんなに聞く',
  'collab.poll.menu.close': '投票を締め切る',
  'collab.poll.remove': '投票を削除',
  'collab.poll.removeTitle': 'この投票を削除しますか？',
  'collab.poll.actionsFor': '投票「{question}」の操作',
  'collab.badge.pinned': '固定中',
  'collab.badge.closed': '締切',
  'collab.badge.open': '受付中',
  'collab.badge.multi': '複数選択可',
  'collab.badge.leading': '首位',
  'collab.poll.removeBody': {
    other: '「{question}」と、その {count} 票が全員から消えます。',
  },
  'collab.poll.result': {
    other: '{label} — {count} 票中 {votes} 票',
  },
  'collab.poll.resultMine': {
    other: '{label} — {count} 票中 {votes} 票（あなたの票を含む）',
  },
  'collab.poll.voteCount': {
    other: '{count} 票',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': '書類',
  'files.kind.photo': '写真',
  'files.kind.ticket': 'チケット',
  'files.kind.receipt': '領収書',
  'files.kind.map': '地図',
  'files.kind.other': 'その他',
  'files.kindChoice.ticket': 'チケットまたはパス',
  'files.kindChoice.map': '地図または経路',
  'files.toast.removed': 'ファイルを削除しました',
  'files.toast.removeFailed': 'ファイルを削除できませんでした',
  'files.toast.downloadFailed': 'ダウンロードが始まりませんでした',
  'files.toast.gone': 'このファイルはこのタブではもう利用できません。',
  'files.toast.uploadFailed': 'アップロードに失敗しました。もう一度どうぞ。',
  'files.toast.updated': 'ファイルを更新しました',
  'files.toast.updateFailed': 'ファイルを更新できませんでした',
  'files.storage.full': 'このワークスペースの保存容量が足りません',
  'files.storage.used':
    '{limit} 中 {used} を使用中です。下のファイルを削除するか、上位プランに移ってから追加してください。',
  'files.storage.perFile': '1件あたり {size} まで',
  'files.action.add': 'ファイルを追加',
  'files.action.choose': 'ファイルを選ぶ',
  'files.action.upload': 'ファイルをアップロード',
  'files.calendar.title': 'カレンダー',
  'files.calendar.description':
    'この旅行を、いつも使っているカレンダーアプリに取り込めます。',
  'files.calendar.download.action': 'カレンダーファイルをダウンロード (.ics)',
  'files.calendar.download.hint':
    '現時点の旅行のスナップショットです。自動では更新されません。',
  'files.calendar.undated':
    'この旅行にはまだ日付がないため、日付のある予約と移動だけが表示されます。',
  'files.calendar.download.error':
    'ファイルを準備できませんでした。もう一度お試しください。',
  'files.calendar.timesNote':
    'タイムゾーンのある移動は、世界中どこでも同じ瞬間に表示されます。それ以外は、カレンダーがどこにあっても予定した時刻のまま表示されます。',
  'files.drop.active': 'ドロップしてアップロード',
  'files.drop.pasteHint': 'コピーした画像やスクリーンショットを貼り付けます',
  'files.reject.blockedType':
    '「{name}」は追加されませんでした。XML ファイルと圧縮された SVG ファイルは、安全のためここには保存されません。PDF か画像として保存し、そちらを追加してください。',
  'files.drop.idle': 'ここにファイルをドラッグ',
  'files.empty.title': 'この旅行にファイルはありません',
  'files.empty.body':
    'チェックインカウンターでメールを掘り返す羽目になるものは、すべてここに、その旅行に付けて置けます。',
  'files.empty.hint':
    '搭乗券、ホテルの確認書、チケット、保険書類、そして支出の裏づけになる領収書。',
  'files.heading': '添付',
  'files.tableCaption': 'この旅行に付いているファイル',
  'files.menu.download': 'ダウンロード',
  'files.menu.rename': '名前と説明を変更…',
  'files.menu.remove': 'ファイルを削除',
  'files.remove.body':
    'ファイルは旅行からだけでなく保存領域からも消え、{size} が空きます。取り消せません。',
  'files.queue.clear': '完了分を片付ける',
  'files.column.file': 'ファイル',
  'files.column.size': 'サイズ',
  'files.column.addedBy': '追加者',
  'files.column.when': '日時',
  'files.status.uploaded': 'アップロード済み',
  'files.status.failed': '失敗',
  'files.status.cancelled': '中止',
  'files.status.uploading': 'アップロード中',
  'files.status.waiting': '待機中',
  'files.error.nameEmpty': 'ファイルには、あとで見つけられる名前が必要です。',
  'files.field.kindHint': 'どのフィルターに入り、どの記号が付くかを決めます。',
  'files.field.kindAria': 'ファイルの種類',
  'files.field.description': '説明',
  'files.field.descriptionPlaceholder':
    '保険証券 — 同行者全員が対象、請求窓口は2ページ目。',
  'files.dialog.title': 'ファイルの詳細',
  'files.action.saving': 'ファイルを保存中',
  'files.action.save': '詳細を保存',
  'files.queue.someFailed': {
    other:
      '{count} 件のファイルがアップロードされませんでした。理由は各行に出ています。ほかの分には影響ありません。',
  },

  'files.action.cancelUploadOf': '{name} のアップロードを中止',
  'files.action.dismissOf': '{name} を閉じる',
  'files.status.downloadingOf': '{name} をダウンロード中',
  'files.status.uploadingOf': '{name} をアップロード中',
  'files.status.uploadingCount': {
    other: '{count} 件のファイルをアップロード中',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - 作成: {when}',
  'files.export.madeAt': '{date} {time}',
  'files.export.email.subject': '{title} の準備ができました',
  'files.export.email.body': {
    other: '旅行のエクスポートの準備ができました。{count}日間保存されます。',
  },
  'files.export.email.action': '{title} を開く',
  'files.export.email.text': '旅行のエクスポートの準備ができました: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': '旅行をエクスポート',
  'files.export.description':
    '旅行の印刷用コピーです。日程、立ち寄り先、予約、移動、宿泊が含まれます。アカウントを持っていない人に渡せます。',
  'files.export.kept': {
    other: '各エクスポートは{count}日間保存されます。',
  },
  'files.export.empty.title': 'エクスポートはまだありません',
  'files.export.empty.body':
    '旅行の印刷用コピーを作って、アカウントのない人に送りましょう。',
  'files.export.empty.bodyViewer': '旅行のオーナーまたは編集者が作成できます。',
  'files.export.format.pdf': 'PDFファイル',
  'files.export.format.html': '印刷用ページ',
  'files.export.artifact': '旅行のエクスポート、{date}',
  'files.export.download': 'ダウンロード',
  'files.export.downloadLabelPdf': '{date} に作成された PDF をダウンロード',
  'files.export.downloadLabelHtml':
    '{date} に作成された印刷用ページをダウンロード',
  'files.export.error.list': 'エクスポートの一覧を読み込めませんでした。',
  'files.export.retry': 'もう一度試す',
  'files.export.error.missing':
    'このエクスポートはすでに保存されていません。もう一度旅行をエクスポートしてください。',
  'files.export.error.missingViewer':
    'このエクスポートはすでに保存されていません。',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'アップロードを中止しました。',
  'files.error.badAnswer':
    'サーバーの返答をこのブラウザーが読み取れませんでした。',
  'files.error.connection':
    'アップロード中に接続が切れました。ネットワークを確認して、もう一度どうぞ。',
  'files.error.timeout': 'アップロードが時間切れになりました。もう一度どうぞ。',
  'files.error.refused': 'サーバーがアップロードを拒否しました（{status}）。',
  'files.error.downloadShape': 'ダウンロードが保存できない形で返ってきました。',
  'files.error.downloadFailed': 'ダウンロードに失敗しました（{status}）。',
  'files.toast.uploadedOne': 'ファイルをアップロードしました',
  'files.toast.uploadedManyBody': 'この旅行に {size} 追加しました。',
  'files.toast.failedOne': 'そのファイルはアップロードされませんでした',
  'files.toast.failedManyBody': '下の一覧に、それぞれの理由が出ています。',
  'files.error.tooMany': {
    other:
      '一度に追加できるのは {count} 件までなので、「{name}」は外れました。単独でもう一度入れてください。',
  },
  'files.toast.uploadedMany': {
    other: '{count} 件のファイルをアップロードしました',
  },
  'files.toast.failedMany': {
    other: '{count} 件のファイルがアップロードされませんでした',
  },

  'files.export.request': '旅行をエクスポート',
  'files.export.includeReferences': '確認コードを含める',
  'files.export.includeReferencesHint':
    'ワークスペース外の人に送る場合は選択しないでください。',
  'files.export.pending':
    'エクスポートを準備しています。このページを離れても、準備ができると一覧に表示されます。',
  'files.export.slow':
    '通常より時間がかかっています。準備ができるとここに表示されます。表示されない場合は再度エクスポートしてください。',
  'files.export.refresh': '更新',
  'files.export.ready': 'エクスポートの準備ができました',
  'files.export.quota': {
    other:
      'このワークスペースの月間上限{count}回を使い切りました。{date}にカウントが再開します。',
  },
  'files.export.error.request': 'エクスポートを開始できませんでした',
  'files.export.error.requestBody':
    'この試行はカウントされていません。しばらくして再度お試しください。',
  'files.export.doc.overview': '概要',
  'files.export.doc.timezone': 'タイムゾーン',
  'files.export.doc.days': '日数',
  'files.export.doc.day': { other: '{count}日目 - {date}' },
  'files.export.doc.dayUndated': { other: '{count}日目' },
  'files.export.doc.dayEmpty': 'まだ予定はありません。',
  'files.export.doc.reservations': '予約',
  'files.export.doc.transport': '交通',
  'files.export.doc.reference': '確認コード {code}',
  'files.export.doc.route': '{from}から{to}へ',
  'files.export.doc.stays': '宿泊先',
  'files.export.doc.nights': { other: '泊数：{count}' },
  'files.export.doc.truncatedDays': {
    other: 'すべての日程が収まらないため、最初の{count}日間を表示しています。',
  },
  'files.export.doc.truncatedRows': {
    other: '全{total}件のうち最初の{count}件を表示。',
  },
  'files.export.notify': '準備ができたらメールで通知する',
  'files.export.viewer':
    'エクスポートを作成できるのは所有者と編集者のみです。既存のファイルはダウンロードできます。',
  'files.export.jump': 'エクスポートへ移動',
  'files.export.fromLink': 'リンクからのエクスポート',
  'files.export.linkGone':
    'このエクスポートは保存されていません。下で新しく作成してください。',
  'files.export.allowance': {
    other: '今月のエクスポート使用数：{used} / {count}',
  },
  'files.export.allowanceUnlimited': {
    other: '今月のエクスポート：{count} 件',
  },
  'files.export.linkGoneViewer': 'このエクスポートはすでに保存されていません。',
} satisfies TranslationOf<typeof En>

export default messages
