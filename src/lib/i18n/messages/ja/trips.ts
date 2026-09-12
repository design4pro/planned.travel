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
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': '旅程',
  'plan.places': '場所',
  'plan.day.empty': 'まだ予定がありません。場所かメモをここにドラッグしてください',
  'plan.move.refused.duplicate': '{name} はその日にすでにあります',
  'plan.move.refused.duplicateBody': '同じ場所は1日に1回までです。別の日に移動してください。',
  'plan.move.refused.notInIdeas': 'メモは日の中にとどまります',
  'plan.move.refused.notInIdeasBody': 'アイデアは日付を待っている場所です。メモは書かれた日に属します。',
  'plan.move.refused.notInAnotherDay': 'メモは自分の日にとどまります',
  'plan.move.refused.notInAnotherDayBody': 'メモはまだ別の日へ移動できません。メモを編集するか、別の日に書いてください。',
  'plan.move.refused.journeyNotInIdeas': '移動は日の中にとどまります',
  'plan.move.refused.journeyNotInIdeasBody': 'アイデアは日付を待っている場所です。移動はそれが起こる日に属します。',
  'plan.move.refused.journeyNotInAnotherDay': '移動は自分の日にとどまります',
  'plan.move.refused.journeyNotInAnotherDayBody': '移動の日はその日付から決まります。「移動」タブで変更してください。',
  'plan.move.refused.journeyTimed': '{name} は {time} に出発します',
  'plan.move.refused.journeyTimedBody': '出発時刻は時刻表のもので、プランのものではありません。時計が示す位置に移動を置いてください。',
  'plan.move.spoken.duplicate': '{name} は移動しませんでした。その日にはすでにあります。',
  'plan.move.spoken.notInIdeas': '{name} は移動しませんでした。メモは日の中にとどまります。',
  'plan.move.spoken.notInAnotherDay': '{name} は移動しませんでした。メモは自分の日にとどまります。',
  'plan.move.spoken.timed': '{name} には {time} が設定されています。時刻を外すか確認します。',
  'plan.move.spoken.journeyNotInIdeas': '{name} は移動しませんでした。移動は日の中にとどまります。',
  'plan.move.spoken.journeyNotInAnotherDay': '{name} は移動しませんでした。移動は自分の日にとどまります。',
  'plan.move.spoken.journeyTimed': '{name} は移動しませんでした。出発は {time} です。',
  'plan.move.error.save': '移動を保存できませんでした',
  'plan.move.error.retry': '少し時間をおいてもう一度お試しください。',
  'plan.move.dropTime.title': '{name} を移動して {time} を外しますか？',
  'plan.move.dropTime.body': 'この位置は設定された時刻と矛盾します。ここへ移動すると時刻が消え、新しい順序と消えた時刻はまとめて保存されます。',
  'plan.move.dropTime.confirm': '移動して時刻を外す',
  'plan.move.dropTime.cancel': 'そのままにする',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'メモを追加',
  'plan.note.addForDay': 'メモを追加 — {day}',
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
} satisfies TranslationOf<typeof En>

export default messages
