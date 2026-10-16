/**
 * The trip tabs' own copy, in ja.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **複数形.** 日本語は `other` の一分岐のみ。数詞は助数詞を伴う。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'この旅行を読み込めませんでした',
  'error.plan': '旅程を読み込めませんでした',
  'error.costs': '費用を読み込めませんでした',
  'error.collab': '会話を読み込めませんでした',
  'error.book': '予約を読み込めませんでした',
  'error.transports': '移動を読み込めませんでした',
  'error.people': 'メンバーを読み込めませんでした',
  'header.length': {
    other: '{days}日間',
  },
  'header.planned': {
    other: '{days}日分を計画済み',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '旅程',
  'plan.places': '場所',
  'plan.readOnly.archived':
    'この旅行はアーカイブ済みのため、プランは閲覧専用です。',
  'plan.readOnly.role':
    'このプランは閲覧のみできます。変更できるのは旅行のオーナーと編集者だけです。',
  'plan.day.empty':
    'まだ予定がありません。場所かメモをここにドラッグしてください',
  'plan.move.refused.duplicate': '{name} はその日にすでにあります',
  'plan.move.refused.duplicateBody':
    '同じ場所は1日に1回までです。別の日に移動してください。',
  'plan.move.refused.notInIdeas': 'メモは日の中にとどまります',
  'plan.move.refused.notInIdeasBody':
    'アイデアは日付を待っている場所です。メモは書かれた日に属します。',
  'plan.move.refused.notInAnotherDay': 'メモは自分の日にとどまります',
  'plan.move.refused.notInAnotherDayBody':
    'メモはまだ別の日へ移動できません。メモを編集するか、別の日に書いてください。',
  'plan.move.refused.journeyNotInIdeas': '移動は日の中にとどまります',
  'plan.move.refused.journeyNotInIdeasBody':
    'アイデアは日付を待っている場所です。移動はそれが起こる日に属します。',
  'plan.move.refused.journeyNotInAnotherDay': '移動は自分の日にとどまります',
  'plan.move.refused.journeyNotInAnotherDayBody':
    '移動の日はその日付から決まります。「移動」タブで変更してください。',
  'plan.move.refused.journeyTimed': '{name} は {time} に出発します',
  'plan.move.refused.journeyTimedBody':
    '出発時刻は時刻表のもので、プランのものではありません。時計が示す位置に移動を置いてください。',
  'plan.move.spoken.duplicate':
    '{name} は移動しませんでした。その日にはすでにあります。',
  'plan.move.spoken.notInIdeas':
    '{name} は移動しませんでした。メモは日の中にとどまります。',
  'plan.move.spoken.notInAnotherDay':
    '{name} は移動しませんでした。メモは自分の日にとどまります。',
  'plan.move.spoken.timed':
    '{name} には {time} が設定されています。時刻を外すか確認します。',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} は移動しませんでした。移動は日の中にとどまります。',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} は移動しませんでした。移動は自分の日にとどまります。',
  'plan.move.spoken.journeyTimed':
    '{name} は移動しませんでした。出発は {time} です。',
  'plan.move.error.save': '移動を保存できませんでした',
  'plan.move.error.retry': '少し時間をおいてもう一度お試しください。',
  'plan.move.dropTime.title': '{name} を移動して {time} を外しますか？',
  'plan.move.dropTime.body':
    'この位置は設定された時刻と矛盾します。ここへ移動すると時刻が消え、新しい順序と消えた時刻はまとめて保存されます。',
  'plan.move.dropTime.confirm': '移動して時刻を外す',
  'plan.move.dropTime.cancel': 'そのままにする',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'メモを追加',
  'plan.note.addForDay': 'メモを追加 — {day}',
  'plan.addPlace.label': '場所を追加',
  'plan.addPlace.more': '場所を追加するほかの方法',
  'plan.addPlace.option.map': '地図上に配置',
  'plan.addPlace.forDayNamed': '場所を追加 — {day}',
  'plan.addPlace.quota':
    'ご利用のプランの場所の上限に達しました。さらに追加するにはプランをアップグレードしてください。',
  'plan.addPlace.quotaAction': 'プランを見る',
  'plan.stay.checkIn': 'チェックイン',
  'plan.stay.checkOut': 'チェックアウト',
  'plan.day.addStay': '宿泊を追加 — {day}',
  'plan.day.addStayShort': '宿泊を追加',
  'plan.handoff.stop': '{place}を{service}で開く（新しいタブで開きます）',
  'plan.handoff.day.directions': '{service}でルートを見る',
  'plan.handoff.day.directionsName':
    '{service}でルートを見る：{day}（新しいタブで開きます）',
  'plan.handoff.day.directionsPartial':
    '立ち寄り先：最初の{carried}件／全{total}件',
  'plan.handoff.day.directionsPartialName':
    '{service}でルートを見る：{day}、立ち寄り先：最初の{carried}件／全{total}件（新しいタブで開きます）',
  'plan.handoff.day.point': '{service}で表示',
  'plan.handoff.day.pointName':
    '{service}で表示：{day}で位置が分かる唯一の立ち寄り先（新しいタブで開きます）',
  'plan.drop.hint':
    '地図を右クリックするか長押しすると、その地点に場所を追加できます。',
  'plan.drop.armed':
    '置きたい地点で地図をクリックするか、地図を動かして Enter キーを押すと中央に配置されます。',
  'plan.drop.stop': '新しいピンの配置をやめる',
  'plan.drop.pin': '新しい場所',
  'plan.drop.lookingUp': '住所を検索しています…',
  'plan.drop.error':
    'ピンを置けませんでした。少し待ってからもう一度お試しください。',
  'plan.place.pastedPosition': '緯度 {lat}、経度 {lng} として読み取りました',
  'plan.note.showMore': 'もっと見る',
  'plan.note.showLess': '折りたたむ',
  'plan.note.moveUp': '上へ移動',
  'plan.note.moveDown': '下へ移動',
  'plan.note.drag': 'メモを並べ替える',
  'plan.note.edit': 'メモを編集',
  'plan.note.delete': 'メモを削除',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'メモを追加',
  'plan.note.dialog.editTitle': 'メモを編集',
  'plan.note.field.body': 'メモ',
  'plan.note.field.bodyHint': '1行だけ。日程に表示される内容です。',
  'plan.note.field.detail': '詳細',
  'plan.note.field.detailHint':
    '見出し、リスト、リンク、引用、コード、表が使えます。',
  'plan.note.field.time': '時刻',
  'plan.note.field.timeHint': '任意、24時間表記。',
  'plan.note.field.icon': 'アイコン',
  'plan.note.tab.write': '入力',
  'plan.note.tab.preview': 'プレビュー',
  'plan.note.previewEmpty': 'プレビューする内容がまだありません',
  'plan.note.save': 'メモを保存',
  'plan.note.cancel': 'キャンセル',
  'plan.note.confirmDelete': 'このメモを削除しますか？',
  'plan.note.confirmDeleteBody': 'メモと詳細がこの日から削除されます。',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'メモを追加しました',
  'plan.note.toast.updated': 'メモを保存しました',
  'plan.note.toast.deleted': 'メモを削除しました',
  'plan.note.error.save': 'メモを保存できませんでした',
  'plan.note.error.delete': 'メモを削除できませんでした',
  'plan.note.error.retry': '少し時間をおいてもう一度お試しください。',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'リマインダー',
  'plan.note.icon.clock': '時刻',
  'plan.note.icon.flashlight': '懐中電灯',
  'plan.note.icon.footprints': '徒歩',
  'plan.note.icon.info': '案内',
  'plan.note.icon.luggage': '荷物',
  'plan.note.icon.package': '小包',
  'plan.note.icon.ticket': 'チケット',
  'plan.note.icon.trainFront': '電車',
  'plan.note.icon.wifi': 'インターネット',
  'plan.note.icon.stickyNote': 'メモ',
  'plan.note.icon.utensils': '食事',
  'plan.note.icon.bus': '移動',
  'plan.note.icon.bedDouble': '宿泊',
  'plan.note.icon.camera': '写真',
  'plan.note.icon.mapPin': '場所',
  'plan.note.icon.wallet': 'お金',
  'plan.note.icon.umbrella': '雨',
  'plan.note.icon.triangleAlert': '注意',
  'plan.transport.phase.flight.departing': '出発',
  'plan.transport.phase.flight.travelling': '飛行中',
  'plan.transport.phase.flight.arriving': '到着',
  'plan.transport.phase.hire.departing': '受け取り',
  'plan.transport.phase.hire.travelling': 'レンタル中',
  'plan.transport.phase.hire.arriving': '返却',
  'plan.transport.phase.journey.departing': '開始',
  'plan.transport.phase.journey.travelling': '移動中',
  'plan.transport.phase.journey.arriving': '終了',
  'plan.transport.label': '{from} から {to} へ',
  'plan.transport.drag': '並べ替え — {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'みんなで',
  'collab.empty': 'まだ何も共有されていません',
  'collab.conversation': '会話',
  'collab.count.messages': {
    other: 'メッセージ{messages}件',
  },
  'collab.count.notes': {
    other: 'メモ{notes}件',
  },
  'collab.count.polls': {
    other: 'アンケート{polls}件',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': '予約',
  'book.empty': 'まだ予約はありません',
  'book.count.bookings': {
    other: '予約{bookings}件',
  },
  'book.count.confirmed': {
    other: '{confirmed}件確定',
  },
  'book.progressLabel': {
    other: '{total}件中{confirmed}件の予約が確定',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': '確定',
  'book.awaiting': '確認待ち',
  'book.nothingHanging': '保留なし',
  'book.chase': '出発前に確認しましょう',
  'book.committed': '確定額',
  'book.committedCaption': 'この旅行のすべての予約',
  'book.onItinerary': '旅程に登録',
  'book.pinnedCaption': '旅程の日に紐づけ済み',
  /* ---------------------------------------------- the transports tab */
  'transports.title': '移動',
  'transports.empty': 'まだ何も記録されていません',
  'transports.count.transports': {
    other: '移動 {transports} 件',
  },
  'transports.distance': '移動距離',
  'transports.equator': '≈ 赤道 {times} 周分',
  'transports.noGrouping': 'まだ集計されていません',
  'transports.mostly': '主に{mode}',
  'transports.confirmed': '確定',
  'transports.stillPending': {
    other: '{pending} 件が保留中',
  },
  'transports.spent': '移動にかけた費用',
  'transports.noPrices': '価格の記録はありません',
  'transports.priced': {
    other: '価格のある移動 {priced} 件',
  },
  'people.title': 'メンバー',
  'people.description': 'この旅行に誰がいて、誰が見つけられるか',
  'people.members.title': 'この旅行のメンバー',
  'people.members.empty':
    'この旅行のメンバーは、もうこのワークスペースにいません',
  'people.role.label': '役割',
  'people.role.owner': 'オーナー',
  'people.role.editor': '編集者',
  'people.role.viewer': '閲覧者',
  'people.you': 'あなた',
  'people.owner.hint': '旅行にはオーナーが少なくとも1人必要です',
  'people.remove.action': '{name} をこの旅行から外す',
  'people.remove.title': '{name} をこの旅行から外しますか？',
  'people.remove.body':
    'すぐに旅程を見られなくなります。追加した内容は旅行に残ります。',
  'people.remove.confirm': '外す',
  'people.leave.action': 'この旅行から抜ける',
  'people.leave.title': 'この旅行から抜けますか？',
  'people.leave.body':
    '旅行にいる誰かが再び追加するまで、旅程を見られなくなります。',
  'people.leave.confirm': '抜ける',
  'people.cancel': 'キャンセル',
  'people.invite.title': 'メンバーを追加',
  'people.invite.placeholder': 'このワークスペースの人を検索',
  'people.invite.action': '旅行に追加',
  'people.invite.role': '参加時の役割',
  'people.invite.empty': 'このワークスペースの全員がすでにこの旅行にいます',
  'people.invite.emptyHint': 'まず設定から、新しい人をワークスペースに迎えます',
  'people.visibility.title': 'この旅行を見つけられる人',
  'people.visibility.switch': 'ワークスペースの全員に表示する',
  'people.visibility.private':
    'ここに表示されている人だけがこの旅行を見られます',
  'people.visibility.organization':
    'このワークスペースの誰でもこの旅行を開けます',
  'people.visibility.public': 'この旅行は公開リンクで共有されています',
  'people.error.lastOwner':
    '旅行にはオーナーが少なくとも1人必要です。先に別の人をオーナーにしてください。',
  'people.error.notInWorkspace': 'その人はこのワークスペースにいません',
  'people.error.alreadyOnTrip': 'その人はすでにこの旅行に参加しています',
  'people.guests.title': '一緒に旅する人',
  'people.guests.description': 'この旅行でアカウントを持たない人',
  'people.guests.empty': 'まだいません',
  'people.guests.emptyHint':
    'ゲストとは、アカウントがなくても一緒に旅する人のことです。名前で追加しましょう。',
  'people.guest.badge': 'ゲスト',
  'people.guest.add.label': '名前',
  'people.guest.add.placeholder': '花子',
  'people.guest.add.action': 'ゲストを追加',
  'people.guest.rename.action': '{name} の名前を変更',
  'people.guest.rename.title': '{name} の名前を変更',
  'people.guest.rename.confirm': '名前を変更',
  'people.guest.remove.action': '{name} をこの旅行から外す',
  'people.guest.remove.title': '{name} をこの旅行から外しますか？',
  'people.guest.remove.body':
    'ゲストが外れます。旅行のほかの内容は変わりません。',
  'people.guest.remove.confirm': '外す',
  'people.guest.merge.action': '{name} は…',
  'people.guest.merge.title': '{name} をこの旅行のメンバーにする',
  'people.guest.merge.body':
    '{name} に割り当てられたものはすべて選んだ人に移り、ゲストは外れます。元に戻せません。',
  'people.guest.merge.inherits':
    '{name}に割り当てられたものはすべて{member}に引き継がれます。',
  'people.guest.merge.placeholder': 'この旅行の人を選ぶ',
  'people.guest.merge.confirm': '統合',
  'people.guest.merge.done': '{name} は {member} になりました',
  'people.guest.merge.nothingMoved': 'まだ何も割り当てられていませんでした',
  'people.error.guestNameTaken':
    '{name} という名前のゲストはすでにこの旅行にいます',
  'people.error.guestLimit':
    '旅行に追加できるゲストは最大 {limit} 人です。それ以上になると参加者の選択や費用の分担が読みにくくなるためです',
  'people.error.guestMergeTarget': 'すでにこの旅行にいる人を選んでください',
  'plan.weather.badge.forecast': '予報: {condition}、最高 {max}、最低 {min}',
  'plan.weather.badge.forecastNoCondition': '予報: 最高 {max}、最低 {min}',
  'plan.weather.badge.unavailable': 'この日の天気は取得できません',
  'plan.weather.badge.loading': '天気を読み込み中',
  'plan.weather.badge.recorded': '観測値: 最高 {max}、 最低 {min}',
  'plan.weather.badge.recordedHigh': '観測値: 最高 {max}',
  'plan.weather.badge.recordedLow': '観測値: 最低 {min}',
  'plan.weather.badge.estimate': '推定: 平年の最高 {max}、最低 {min}',
  'plan.weather.badge.estimateHigh': '推定: 平年の最高 {max}',
  'plan.weather.badge.estimateLow': '推定: 平年の最低 {min}',
  'plan.weather.badge.notYetRecorded': 'まだ観測されていません',
  'plan.weather.condition.clear': '快晴',
  'plan.weather.condition.fair': '晴れ',
  'plan.weather.condition.partlyCloudy': '一部曇り',
  'plan.weather.condition.cloudy': '曇り',
  'plan.weather.condition.fog': '霧',
  'plan.weather.condition.rain': '雨',
  'plan.weather.condition.heavyRain': '大雨',
  'plan.weather.condition.sleet': 'みぞれ',
  'plan.weather.condition.snow': '雪',
  'plan.weather.condition.thunder': '雷雨',
  'plan.weather.panel.title': '{date}の天気',
  'plan.weather.panel.temperature': '最高 / 最低',
  'plan.weather.panel.precipitation': '降水量',
  'plan.weather.panel.precipitationTypical': '平年の1日あたり降水量',
  'plan.weather.panel.probability': '降水確率 {percent}',
  'plan.weather.panel.wind': '風',
  'plan.weather.panel.sunrise': '日の出',
  'plan.weather.panel.sunset': '日の入り',
  'plan.weather.panel.noSunrise': '日の出なし',
  'plan.weather.panel.noSunset': '日の入りなし',
  'plan.weather.panel.slots': '時間帯別',
  'plan.weather.panel.slot.night': '深夜',
  'plan.weather.panel.slot.morning': '午前',
  'plan.weather.panel.slot.afternoon': '午後',
  'plan.weather.panel.slot.evening': '夜',
  'plan.weather.panel.high': '最高',
  'plan.weather.panel.low': '最低',
  'plan.weather.panel.recordedNote': 'この日の観測値です。',
  'plan.weather.panel.temperatureTypical': '平年の最高 / 最低',
  'plan.weather.panel.estimateNote':
    'この月の長期平均であり、予報ではありません。',
  'plan.weather.attribution.metNorway': '予報データ: MET Norway、CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'データ: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': '旅程の幅を変更',
  'plan.workspace.resizePlaces': '場所パネルの幅を変更',
  'plan.workspace.toggleDay': '{day}を展開または折りたたむ',
  'plan.workspace.days': '日程',
  'plan.workspace.showPanel': '{label}パネルを表示',
  'plan.workspace.hidePanel': '{label}パネルを非表示',
  'plan.workspace.narrowPanel': '{label}を狭める',
  'plan.workspace.widenPanel': '{label}を広げる',
} satisfies TranslationOf<typeof En>

export default messages
