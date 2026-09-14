/**
 * The world tracker and the map chrome, in Japanese.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * アトラス for the tracker, 旅行 for a trip, ワークスペース for the workspace;
 * the bucket list is 行きたいリスト.
 *
 * **One branch.** Japanese has no plural inflection, so `Intl.PluralRules`
 * reports the single category `other` and every `one`/`other` pair English
 * writes collapses to one branch. The number still arrives already formatted;
 * the counter that follows it (回, 件, か国, 日, 年) is chosen per message.
 *
 * Country names stay English by design: `src/lib/atlas/country-names.ts` is a
 * frozen table, so particles around `{name}` are written to read naturally
 * beside a Latin name.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': '世界地図。訪問済みの国はまだありません。',
  'screen.world.summary':
    '世界地図。全{total}か国のうち{visited}か国が訪問済みです。',
  'screen.error.title': 'アトラスを読み込めませんでした',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': '地図を読み込んでいます',
  'map.controls.label': '地図の操作',
  'map.controls.zoomIn': '拡大',
  'map.controls.zoomOut': '縮小',
  'map.controls.north': '北を上にする',
  'map.controls.locate': '現在地を表示',
  'map.controls.locateFailed': '現在地を取得できませんでした。',
  'map.controls.locateFailedBody':
    'このサイトに位置情報の利用が許可されているか確認して、もう一度お試しください。',

  'map.attribution.label': '地図データの提供元',

  'map.basemap.title': 'ベースマップを利用できません',
  'map.basemap.body':
    '市街地の詳細は現在オフラインです。それぞれの場所は実際の位置に表示されているため、距離や集まり方は正確なままです。',
  'map.basemap.credit': '海岸線の提供元',
  'map.basemap.retry': 'もう一度試す',
  'map.basemap.retrying': 'ベースマップを確認しています',

  'map.engine.unsupported.title': '地図を描画できません',
  'map.engine.unsupported.body':
    'このブラウザーではインタラクティブな地図を動かせません。地図にはWebGL2が必要ですが、ここでは利用できません。この画面の他の機能は地図に依存していません。',
  'map.engine.stalled.title': '地図がまだ描画されていません',
  'map.engine.stalled.body':
    '起動に与えられた時間内に何も表示されませんでした。そのうち自然に動き出すこともあります。この画面の他の機能は地図に依存していません。',

  'map.coverage.partial.title': '市街地の詳細は一部のみ',
  'map.coverage.partial.body': {
    other:
      '公開されている地図データは、この旅行の{outside}か所の場所まで届いていません。それらは当方の海岸線の上に実際の位置で描かれています。',
  },
  'map.coverage.none.title': 'この一帯に市街地の詳細はありません',
  'map.coverage.none.body':
    'この地域の市街地はまだ公開されていません。海岸線、ピン、その間のルートはすべて実物どおりで、欠けているのは建物と道路だけです。',
  'map.coverage.dismiss': '地図カバレッジの注記を閉じる',

  'map.legend.title': '凡例',
  'map.legend.collapse': '{title}を折りたたむ',
  'map.legend.expand': '{title}を開く',
  'map.legend.dayPin': '日程ピンの例',
  'map.legend.dayPinMeaning': '旅程の日',
  'map.legend.clusterPin': 'まとめピンの例',
  'map.legend.clusterPinMeaning': 'まとめられた場所',

  'map.filter.label': '場所をカテゴリーで絞り込む',
  'map.filter.all': 'すべて',
  'map.filter.category': {
    other: '{name} · {places}か所',
  },

  'map.pin.day': '{day}日目',
  'map.pin.cluster': {
    other: '{places}か所 — 拡大するとひとつずつ表示されます',
  },

  'map.place.rating': '評価は{max}点中{rating}点',
  'map.place.clause.day': '{day}日目',
  'map.place.clause.rating': '評価は{max}点中{rating}点',
  'map.place.clause.visited': '訪問済み',
  'map.place.clause.separator': '、',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': '最後の訪問',
  'legend.recent': {
    other: '過去{years}年以内',
  },
  'legend.middle': '{from}〜{to}年前、または日付なし',
  'legend.distant': {
    other: '{years}年以上前',
  },
  'legend.unvisited': 'まだ訪問していません',
  'legend.note':
    '色の濃さは訪問の新しさだけを表します。日付そのものは「国」タブにすべて書き出されます。',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': '世界のカバー率',
  'panel.coverage.unit': '全{total}か国中',
  'panel.coverage.caption': '世界の{share} · {visits}',
  'panel.progress.label': '全か国制覇まで',
  'panel.progress.remaining': 'あと{remaining}',
  'panel.toggle.hide': 'アトラスの詳細を隠す',
  'panel.toggle.show': 'アトラスの詳細を表示',
  'panel.tabs.label': 'アトラスのセクション',
  'panel.tab.country': '国',
  'panel.tab.stats': '統計',
  'panel.tab.bucket': '行きたいリスト',
  'panel.back': 'すべての国',
  'panel.list.label': '訪問した国',
  'panel.loading': 'アトラスを読み込んでいます',

  'panel.empty.blank.title': 'あなたの地図はまだ白紙です',
  'panel.empty.blank.body':
    '国を訪問済みにすると、この地図が塗られていきます。最初と最後の訪問、行った回数、書き残したメモも一緒に表示されます。',
  'panel.empty.pick.title': '国を選んでください',
  'panel.empty.pick.body':
    '地図の上、検索欄、または一覧から国を選ぶと、ここに記録の全体が開きます。最初の訪問、最後の訪問、回数、そしてあなたのメモです。',

  'panel.stat.places': 'あなたの場所',
  'panel.stat.placesNone': '旅行にピン留めした場所はまだありません',
  'panel.stat.placesCaption': '保存した見どころ・宿・立ち寄り先',
  'panel.stat.regions': '地域',
  'panel.stat.regionsNone': '記録した地域はまだありません',
  'panel.stat.regionsCaption': '州・省・都道府県',
  'panel.stat.visits': '訪問',
  'panel.stat.visitsCaption': '記録されたすべての到着',
  'panel.stat.trips': 'あなたの旅行',
  'panel.stat.tripsCaption': '参加しているすべての旅行',
  'panel.stat.cities': '都市',
  'panel.stat.citiesCaption': '泊まった・立ち寄った街',
  'panel.stat.days': '旅の日数',
  'panel.stat.daysCaption': '記録にあるすべての旅行の合計',
  'panel.continents.label': '大陸別の国数',

  'panel.bucket.empty.title': 'リストにはまだ何もありません',
  'panel.bucket.empty.body':
    'ずっと行きたかったあの場所。追加しておいて、たどり着いたらチェックを付けましょう。',
  'panel.bucket.label': '行きたいリスト',
  'panel.bucket.progress': '{total}件中{done}件達成',
  'panel.bucket.done': '達成',
  'panel.bucket.toGo': 'これから',
  'panel.bucket.target': '{year}年までに',
  'panel.bucket.hidden': {
    other: 'リストにはほかに{entries}件あり、ここには表示されていません。',
  },
  'panel.bucket.kind.country': '国',
  'panel.bucket.kind.region': '地域',
  'panel.bucket.kind.place': '場所',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'アフリカ',
  'continent.antarctica': '南極',
  'continent.asia': 'アジア',
  'continent.europe': 'ヨーロッパ',
  'continent.northAmerica': '北アメリカ',
  'continent.oceania': 'オセアニア',
  'continent.southAmerica': '南アメリカ',
  'continent.unknown': '大陸は未記録',

  /* ------------------------------------------------------------- the record */
  'record.visited': '訪問済み',
  'record.firstVisit': '最初の訪問',
  'record.lastVisit': '最後の訪問',
  'record.visitDates': '訪問日',
  'record.notRecorded': '未記録',
  'record.datesUnrecorded': '日付は未記録',
  'record.visits': {
    other: '{visits}回の訪問',
  },
  'record.span': '{from}〜{to}',
  'record.spanFrom': '最初の訪問 {from}',
  'record.spanTo': '最後の訪問 {to}',
  'record.visitsUnit': { other: '回' },
  'record.gap.days': { other: '{gap}日の間隔' },
  'record.gap.months': { other: '{gap}か月の間隔' },
  'record.gap.years': { other: '{gap}年の間隔' },
  'record.note.empty': 'メモはまだありません',
  'record.noOutline':
    'この地図が描く世界の輪郭は1:110mの縮尺で切り出されており、この地域は本国側に含めて描かれます。そのため地図上に枠を合わせる形がありません。訪問はそのまま数えられます。',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': '国の並び順',
  'list.sort.code': '国コード',
  'list.sort.codeStatement': '国コードのAからZの順に並んでいます。',
  'list.sort.name': '国名',
  'list.sort.nameStatement':
    '国名のAからZの順、次に国コードの順に並んでいます。',
  'list.sort.recent': '最近の訪問',
  'list.sort.recentStatement':
    '最近訪問した順、次に国コードの順に並んでいます。',
  'list.sort.visits': '訪問回数',
  'list.sort.visitsStatement':
    '訪問回数の多い順、次に国コードの順に並んでいます。',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    '世界の輪郭では本国側に含めて描かれるため、地図上に枠を合わせる形がありません。',
  'list.announce.selected': '{name}を選択しました。',
  'list.announce.selectedUnframed': '{name}を選択しました。{reason}',
  'list.empty.title': '地図にはまだ国がありません',
  'list.empty.body':
    '訪問を記録すると、その国はすぐここに並びます。最初の到着、最新の到着、行った回数も一緒です。',
  'list.loading': '訪問した国を読み込んでいます',
  'list.error.title': '国の一覧を読み込めませんでした',
  'list.error.body':
    'アトラスが訪問した国をいま読み取れませんでした。失われたものはなく、記録はそのまま残っています。',
  'list.error.retry': 'もう一度試す',
  'list.error.retrying': '国の一覧を読み込んでいます',

  /* ------------------------------------------------------------- the search */
  'search.label': '国を探す',
  'search.loading': '国の一覧を読み込んでいます',
  'search.placeholder': '国名または国コード',
  'search.entry.notVisited': 'まだ訪問していません',
  'search.entry.noOutline': '地図上の輪郭なし',
  'search.entry.separator': ' · ',
  'search.cleared': '選択を解除しました。',
  'search.unframed':
    '{name}には世界縮尺の輪郭がないため、地図が枠を合わせる対象がありません。',
  'search.unframedVisited':
    '{name}には世界縮尺の輪郭がないため、地図が枠を合わせる対象がありません。記録には影響しません。',
  'search.results.empty':
    '記録にある国はまだありません。入力すると世界中のすべての国を検索できます。',
  'search.results.emptyPinned':
    '{name}を選択中です。記録にある国はまだありません — 入力すると世界中のすべての国を検索できます。',
  'search.results.record': {
    other: '記録にある国は{countries}か国です。',
  },
  'search.results.capped': '先頭の{shown}件を表示しています。',
  'search.results.pinned': '{name}を選択中のため先頭に表示しています。',
  'search.results.none': '「{term}」に一致する国はありません。',
  'search.results.matches': {
    other: '「{term}」に一致する国は{countries}か国です。',
  },
  'search.announce.selected': '{name}を選択しました。',
  'search.announce.framing': '{name}を選択しました。地図を合わせています。',
  'search.announce.unframed': '{name}を選択しました。{reason}',
  'search.empty.title': '記録にはまだ何もありません',
  'search.empty.body':
    '国名か2文字の国コードを入力すると、地図上で見つかります。',
  'search.empty.noMatchTitle': '「{term}」に一致する国はありません',
  'search.empty.noMatchBody':
    'つづりを確かめるか、2文字の国コードを試してください。PTでポルトガルが見つかります。行ったことがあるかどうかに関わらず、全{countries}か国を検索できます。',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'あなたの記録',
  'actions.visit.absent.title': '未訪問',
  'actions.visit.absent.caption': '旅行に結びつかない訪問として記録します。',
  'actions.visit.title': '訪問済み',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'リストにありません',
  'actions.goal.absent.caption': 'いつか行くつもりの場所。',
  'actions.goal.title': '行きたいリストに登録済み',
  'actions.goal.waiting': '出番を待っています。',
  'actions.goal.target': '{year}年を目標に。',
  'actions.goal.achieved.title': 'リストから達成済みに',
  'actions.goal.achieved.caption':
    'たどり着きました。この記録はそのまま残ります。',

  'actions.button.remove': '取り消す',
  'actions.button.mark': '訪問を記録',
  'actions.button.add': 'リストに追加',
  'actions.visit.remove.name': '取り消す — {name}をアトラスから外す',
  'actions.visit.remove.busy': '{name}をアトラスから外しています',
  'actions.visit.add.name': '訪問を記録 — {name}',
  'actions.visit.add.busy': '{name}を訪問済みにしています',
  'actions.goal.remove.name': '取り消す — {name}を行きたいリストから外す',
  'actions.goal.remove.busy': '{name}を行きたいリストから外しています',
  'actions.goal.add.name': 'リストに追加 — {name}',
  'actions.goal.add.busy': '{name}を行きたいリストに追加しています',

  'actions.hint': 'どちらもすぐに反映され、どちらもここで元に戻せます。',
  'actions.offline':
    'サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。',
  'actions.toast.marked': '訪問済みにしました',
  'actions.toast.markedBody': '{name}をアトラスに載せました。',
  'actions.toast.markFailed': '{name}を訪問済みにできませんでした',
  'actions.toast.unmarked': 'アトラスから外しました',
  'actions.toast.unmarkedBody': '{name}は訪問済みではなくなりました。',
  'actions.toast.unmarkFailed': '{name}を外せませんでした',
  'actions.toast.listed': '行きたいリストに追加しました',
  'actions.toast.listedBody': '{name}は、いつか行くつもりの場所です。',
  'actions.toast.listFailed': '{name}を追加できませんでした',
  'actions.toast.unlisted': '行きたいリストから外しました',
  'actions.toast.unlistedBody': '{name}はリストから外れました。',
  'actions.toast.unlistFailed': '{name}を外せませんでした',
  'actions.toast.fallback':
    '変更がサーバーに届きませんでした。しばらくしてからもう一度お試しください。',

  'actions.confirm.visit.title': '{name}をアトラスから外しますか？',
  'actions.confirm.visit.body': {
    other:
      '{visits}回の記録済みの訪問{dates}{note}が消去されます。旅行と保存した場所には影響しません。',
  },
  'actions.confirm.visit.dates': '（{span}）',
  'actions.confirm.visit.note': 'と書き添えたメモ',
  'actions.confirm.goal.title': '{name}を行きたいリストから外しますか？',
  'actions.confirm.goal.body':
    'すでに達成済みのため、たどり着いたという記録も一緒に消えます。アトラスと旅行には影響しません。',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { other: 'ワークスペースの旅行' },
  'card.visits': { other: '訪問' },
  'card.places': { other: 'ワークスペースの場所' },
  'card.firstTrip': '最初の旅行',
  'card.lastTrip': '最後の旅行',
  'card.firstVisit': '最初の訪問',
  'card.lastVisit': '最後の訪問',
  'card.absent': '未記録',
  'card.loading': 'この国を読み込んでいます',
  'card.loadingNamed': '{name}を読み込んでいます',
  'card.error.body':
    'この数字は読み込めませんでした。失われたものはありません。',
  'card.error.retry': 'もう一度試す',
  'overlay.close': '{name}を閉じる',
} satisfies TranslationOf<typeof En>

export default messages
