/**
 * The world tracker and the map chrome, in Traditional Chinese.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * 世界地圖 for the tracker (its nav entry), 行程 for a trip, 工作區 for the
 * workspace; the bucket list is 願望清單. Wording follows Taiwanese usage
 * (載入, 資料, 瀏覽器) rather than a character-level conversion of `zh-Hans`.
 *
 * **One branch.** Chinese has no plural inflection, so `Intl.PluralRules`
 * reports the single category `other` and every `one`/`other` pair English
 * writes collapses to one branch. The number still arrives already formatted;
 * the measure word that follows it (個, 次, 天, 座) is chosen per message.
 *
 * Country names stay English by design: `src/lib/atlas/country-names.ts` is a
 * frozen table, so `{name}` sits inside the Chinese sentence as a Latin name.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  'panel.stats.empty.title': '還沒有可統計的內容',
  'panel.stats.empty.body':
    '在地圖上標記一個國家，或規劃一次旅行，你的數據就會從這裡開始。',
  'panel.stats.empty.action': '規劃旅行',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': '世界地圖。還沒有國家被標為去過。',
  'screen.world.summary':
    '世界地圖，共 {total} 個國家，其中 {visited} 個已標為去過。',
  'screen.error.title': '世界地圖沒有載入',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': '正在載入地圖',
  'map.controls.label': '地圖控制項',
  'map.controls.zoomIn': '放大',
  'map.controls.zoomOut': '縮小',
  'map.controls.north': '朝向正北',
  'map.controls.locate': '定位我的位置',
  'map.controls.locateFailed': '我們無法取得您的位置。',
  'map.controls.locateFailedBody':
    '請確認已允許本網站存取位置資訊，然後再試一次。',

  'map.attribution.label': '地圖資料來自',
  'map.attribution.geocoder': '地點查找由',

  'map.basemap.title': '底圖暫時無法使用',
  'map.basemap.body':
    '街道細節目前離線。每個地點仍顯示在真實位置上，距離與群集依然準確。',
  'map.basemap.credit': '海岸線來自',
  'map.basemap.retry': '再試一次',
  'map.basemap.retrying': '正在檢查底圖',

  'map.engine.unsupported.title': '無法繪製地圖',
  'map.engine.unsupported.body':
    '此瀏覽器無法執行互動式地圖：它需要 WebGL2，而這裡沒有可用的 WebGL2 環境。此畫面上的其他內容都不依賴它。',
  'map.engine.stalled.title': '地圖還沒有繪製出來',
  'map.engine.stalled.body':
    '在留給地圖啟動的時間內沒有任何內容出現。它也許會自己恢復；此畫面上的其他內容都不依賴它。',

  'map.coverage.partial.title': '街道細節不完整',
  'map.coverage.partial.body': {
    other:
      '已發布的地圖資料沒有涵蓋本次行程的 {outside} 個地點。它們被繪製在我們自己的海岸線上的真實位置。',
  },
  'map.coverage.none.title': '這裡沒有街道細節',
  'map.coverage.none.body':
    '這個地區的街道尚未發布。海岸線、圖釘和它們之間的路線都是真實的——缺少的只有建築與道路。',
  'map.coverage.dismiss': '關閉地圖涵蓋範圍提示',

  'map.legend.title': '圖例',
  'map.legend.collapse': '收合{title}',
  'map.legend.expand': '展開{title}',
  'map.legend.dayPin': '行程日圖釘範例',
  'map.legend.dayPinMeaning': '行程中的一天',
  'map.legend.clusterPin': '群集圖釘範例',
  'map.legend.clusterPinMeaning': '群集的地點',

  'map.filter.label': '依類別篩選地點',
  'map.filter.all': '全部',
  'map.filter.category': {
    other: '{name} · {places} 個地點',
  },

  'map.pin.day': '第 {day} 天',
  'map.pin.cluster': {
    other: '{places} 個地點——放大即可逐一分開',
  },

  'map.place.rating': '評分 {rating}，滿分 {max}',
  'map.place.clause.day': '第 {day} 天',
  'map.place.clause.rating': '評分 {rating}，滿分 {max}',
  'map.place.clause.visited': '去過',
  'map.place.clause.separator': '，',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': '最近造訪',
  'legend.recent': {
    other: '最近 {years} 年內',
  },
  'legend.middle': '{from}–{to} 年前，或沒有日期',
  'legend.distant': {
    other: '超過 {years} 年前',
  },
  'legend.unvisited': '還沒去過',
  'legend.note': '深淺只代表造訪的遠近——每個日期都完整寫在「國家」分頁裡。',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': '世界涵蓋',
  'panel.coverage.unit': '共 {total} 個',
  'panel.coverage.caption': '佔世界的 {share} · {visits}',
  'panel.progress.label': '走遍每個國家',
  'panel.progress.remaining': '還差 {remaining} 個',
  'panel.toggle.hide': '隱藏世界地圖詳情',
  'panel.toggle.show': '顯示世界地圖詳情',
  'panel.tabs.label': '世界地圖區塊',
  'panel.tab.country': '國家',
  'panel.tab.stats': '統計',
  'panel.tab.bucket': '願望清單',
  'panel.back': '全部國家',
  'panel.list.label': '去過的國家',
  'panel.loading': '正在載入您的世界地圖',

  'panel.empty.blank.title': '您的地圖還是一片空白',
  'panel.empty.blank.body':
    '把一個國家標為去過，它就會在這裡的地圖上填上顏色，連同第一次和最近一次造訪、去過的次數，以及您為它寫下的一切。',
  'panel.empty.pick.title': '選一個國家',
  'panel.empty.pick.body':
    '在地圖上、搜尋欄裡或清單中選一個國家，它的完整檔案就會在這裡打開——第一次造訪、最近一次造訪、次數統計和您的筆記。',

  'panel.stat.places': '你的地點',
  'panel.stat.placesNone': '行程裡還沒有釘下任何地點',
  'panel.stat.placesCaption': '儲存的景點、住宿與停留點',
  'panel.stat.regions': '你的地區',
  'panel.stat.regionsNone': '還沒有標記任何地區',
  'panel.stat.regionsCaption': '州、省、都道府縣',
  'panel.stat.visits': '你的到訪次數',
  'panel.stat.visitsCaption': '每一次記錄在案的抵達',
  'panel.stat.trips': '你的行程',
  'panel.stat.tripsCaption': '你參與的每一個行程',
  'panel.stat.cities': '你的城市',
  'panel.stat.citiesCaption': '住過或停留過的城市',
  'panel.stat.days': '你的旅行天數',
  'panel.stat.daysCaption': '累計您記錄中的每一次行程',
  'panel.continents.label': '按大洲統計的國家',

  'panel.bucket.empty.title': '清單上還沒有內容',
  'panel.bucket.empty.body':
    '那個您一直想去的地方。把它加進來，到了那天再把它劃掉。',
  'panel.bucket.label': '願望清單',
  'panel.bucket.progress': '已完成 {done} 項，共 {total} 項',
  'panel.bucket.done': '已實現',
  'panel.bucket.toGo': '待出發',
  'panel.bucket.target': '{year} 年前',
  'panel.bucket.hidden': {
    other: '清單上還有 {entries} 項，未在此顯示。',
  },
  'panel.bucket.kind.country': '國家',
  'panel.bucket.kind.region': '地區',
  'panel.bucket.kind.place': '地點',

  /* --------------------------------------------------------------- the world */
  'continent.africa': '非洲',
  'continent.antarctica': '南極洲',
  'continent.asia': '亞洲',
  'continent.europe': '歐洲',
  'continent.northAmerica': '北美洲',
  'continent.oceania': '大洋洲',
  'continent.southAmerica': '南美洲',
  'continent.unknown': '未記錄所屬大洲',

  /* ------------------------------------------------------------- the record */
  'record.visited': '去過',
  'record.firstVisit': '首次造訪',
  'record.lastVisit': '最近造訪',
  'record.visitDates': '造訪日期',
  'record.notRecorded': '未記錄',
  'record.datesUnrecorded': '日期未記錄',
  'record.visits': {
    other: '造訪 {visits} 次',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': '首次造訪 {from}',
  'record.spanTo': '最近造訪 {to}',
  'record.visitsUnit': { other: '次' },
  'record.gap.days': { other: '相隔 {gap} 天' },
  'record.gap.months': { other: '相隔 {gap} 個月' },
  'record.gap.years': { other: '相隔 {gap} 年' },
  'record.note.empty': '還沒有筆記',
  'record.noOutline':
    '這張地圖繪製的世界輪廓依 1:110m 比例裁切，該比例把這塊領土併入其母國——所以地圖上沒有可以框選的形狀。這次造訪照常計入。',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': '國家排序',
  'list.sort.code': '國家代碼',
  'list.sort.codeStatement': '依國家代碼從 A 到 Z 排列。',
  'list.sort.name': '國家名稱',
  'list.sort.nameStatement': '依國家名稱從 A 到 Z 排列，再依國家代碼。',
  'list.sort.recent': '最近造訪',
  'list.sort.recentStatement': '最近造訪的排在前面，再依國家代碼。',
  'list.sort.visits': '造訪最多',
  'list.sort.visitsStatement': '造訪次數最多的排在前面，再依國家代碼。',
  'list.row.cell': '{label} {value}',
  'list.noOutline': '世界輪廓把它併入了母國，所以地圖上沒有可以框選的形狀。',
  'list.announce.selected': '已選取 {name}。',
  'list.announce.selectedUnframed': '已選取 {name}。{reason}',
  'list.empty.title': '地圖上還沒有國家',
  'list.empty.body':
    '一旦記下某個國家的造訪，它就會出現在這裡，連同第一次抵達、最近一次抵達和去過的次數。',
  'list.loading': '正在載入去過的國家',
  'list.error.title': '您的國家清單沒有載入',
  'list.error.body':
    '世界地圖暫時讀不到您去過的國家。什麼都沒有遺失——它們仍然記錄在案。',
  'list.error.retry': '再試一次',
  'list.error.retrying': '正在載入您的國家',

  /* ------------------------------------------------------------- the search */
  'search.label': '尋找國家',
  'search.loading': '正在載入您的國家',
  'search.placeholder': '國家名稱或代碼',
  'search.entry.notVisited': '還沒去過',
  'search.entry.noOutline': '地圖上沒有輪廓',
  'search.entry.separator': ' · ',
  'search.cleared': '已清除選取。',
  'search.unframed': '{name} 在世界比例下沒有輪廓，地圖沒有可以框選的對象。',
  'search.unframedVisited':
    '{name} 在世界比例下沒有輪廓，地圖沒有可以框選的對象。它的檔案不受影響。',
  'search.results.empty':
    '您的記錄裡還沒有國家。輸入即可搜尋世界上的每個國家。',
  'search.results.emptyPinned':
    '已選取 {name}。您的記錄裡還沒有國家——輸入即可搜尋世界上的每個國家。',
  'search.results.record': {
    other: '您的記錄裡有 {countries} 個國家。',
  },
  'search.results.capped': '顯示前 {shown} 個。',
  'search.results.pinned': '{name} 已選取並排在最前。',
  'search.results.none': '沒有國家符合 {term}。',
  'search.results.matches': {
    other: '有 {countries} 個國家符合 {term}。',
  },
  'search.announce.selected': '已選取 {name}。',
  'search.announce.framing': '已選取 {name}。地圖正在對準它。',
  'search.announce.unframed': '已選取 {name}。{reason}',
  'search.empty.title': '您的記錄裡還沒有內容',
  'search.empty.body': '輸入國家名稱或它的兩碼字母代碼，即可在地圖上找到它。',
  'search.empty.noMatchTitle': '沒有國家符合「{term}」',
  'search.empty.noMatchBody':
    '檢查一下拼字，或試試兩碼字母代碼——輸入 PT 就能找到葡萄牙。全部 {countries} 個國家都可以搜尋，無論您是否去過。',

  /* ------------------------------------------------------- the two writes */
  'actions.label': '您的記錄',
  'actions.visit.absent.title': '還沒去過',
  'actions.visit.absent.caption': '一次沒有行程支撐的造訪。',
  'actions.visit.title': '去過',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': '不在清單上',
  'actions.goal.absent.caption': '一個您打算去的地方。',
  'actions.goal.title': '在願望清單上',
  'actions.goal.waiting': '正等著輪到它。',
  'actions.goal.target': '目標是 {year} 年。',
  'actions.goal.achieved.title': '已從清單劃掉',
  'actions.goal.achieved.caption': '您到了那裡。這筆記錄會一直留著。',

  'actions.button.remove': '移除',
  'actions.button.mark': '標為去過',
  'actions.button.add': '加入清單',
  'actions.visit.remove.name': '移除——把 {name} 從您的世界地圖上拿掉',
  'actions.visit.remove.busy': '正在把 {name} 從您的世界地圖上拿掉',
  'actions.visit.add.name': '標為去過——{name}',
  'actions.visit.add.busy': '正在把 {name} 標為去過',
  'actions.goal.remove.name': '移除——把 {name} 從願望清單上拿掉',
  'actions.goal.remove.busy': '正在把 {name} 從願望清單上拿掉',
  'actions.goal.add.name': '加入清單——{name}',
  'actions.goal.add.busy': '正在把 {name} 加入願望清單',

  'actions.hint': '兩個操作都立即生效，也都可以在這裡復原。',
  'actions.offline': '裝置無法連上伺服器。請檢查網路連線後再試一次。',
  'actions.toast.marked': '已標為去過',
  'actions.toast.markedBody': '{name} 已在您的世界地圖上。',
  'actions.toast.markFailed': '{name} 沒有被標記',
  'actions.toast.unmarked': '已從您的世界地圖上移除',
  'actions.toast.unmarkedBody': '{name} 不再標為去過。',
  'actions.toast.unmarkFailed': '{name} 沒有被移除',
  'actions.toast.listed': '已加入願望清單',
  'actions.toast.listedBody': '{name} 是您打算去的地方。',
  'actions.toast.listFailed': '{name} 沒有被加入',
  'actions.toast.unlisted': '已從願望清單移除',
  'actions.toast.unlistedBody': '{name} 已不在清單上。',
  'actions.toast.unlistFailed': '{name} 沒有被移除',
  'actions.toast.fallback': '變更沒有送達伺服器。請稍後再試一次。',

  'actions.confirm.visit.title': '把 {name} 從您的世界地圖上移除？',
  'actions.confirm.visit.body': {
    other:
      '{visits} 次已記錄的造訪{dates}{note}將被清除。您的行程和儲存的地點不受影響。',
  },
  'actions.confirm.visit.dates': '（{span}）',
  'actions.confirm.visit.note': '，連同您寫下的筆記',
  'actions.confirm.goal.title': '把 {name} 從願望清單上移除？',
  'actions.confirm.goal.body':
    '它已經被劃掉了，所以這也會一併移除您到過那裡的記錄。您的世界地圖和行程不受影響。',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { other: '工作區的行程' },
  'card.visits': { other: '造訪' },
  'card.places': { other: '工作區的地點' },
  'card.firstTrip': '首次行程',
  'card.lastTrip': '最近行程',
  'card.firstVisit': '首次造訪',
  'card.lastVisit': '最近造訪',
  'card.absent': '未記錄',
  'card.loading': '正在載入這個國家',
  'card.loadingNamed': '正在載入 {name}',
  'card.error.body': '這些數字沒有載入。什麼都沒有遺失。',
  'card.error.retry': '再試一次',
  'overlay.close': '關閉 {name}',
  'regions.label': '地區',
  'regions.hint': '新增地區也會將{country}標記為已造訪。',
  'regions.keeps': '移除地區不會從你的地圖集中移除{country}。',
  'regions.keeps.unvisited':
    '這些地區會保留在記錄中。將{country}標記為已造訪或新增地區，即可在地圖上重新顯示該國。',
  'regions.empty.title': '尚未記錄任何地區',
  'regions.empty.body': '新增你在{country}造訪過的州、省或地區。',
  'regions.input.label': '新增{country}的地區',
  'regions.input.placeholder': '例如：巴伐利亞',
  'regions.add': '新增地區',
  'regions.adding': '正在新增{region}',
  'regions.remove': '移除{region}',
  'regions.loading': '正在載入你的地區',
  'regions.status.added': '已新增{region}',
  'regions.status.exists': '{region}已在記錄中',
  'regions.status.removed': '已移除{region}',
  'regions.status.addedCountry': '已新增{region}，{country}也已標記為已造訪。',
  'regions.error.invalid': '請輸入地區名稱。',
  'regions.error.hidden': '名稱包含不允許的字元。請移除後重試。',
  'regions.error.load': '無法載入你在{country}的地區。',
  'regions.error.add': '無法新增{region}，請重試。',
  'regions.error.remove': '無法移除{region}，請重試。',
  'regions.error.full': '你已記錄{limit}個地區。請先移除一個再新增其他地區。',
  'regions.reload': '重新載入地區',
  'actions.confirm.visitRegions.body': {
    other: '{history}你在{country}記錄的{count}個地區將保留。',
  },
  'regions.error.uncertain': '無法確認變更。請重新載入地區以檢查已儲存的內容。',
  'regions.status.refreshFailed':
    '{result} 無法重新整理地圖集。請重新載入以更新地圖。',

  'panel.stat.periodLabel': '顯示統計時段',
  'panel.stat.allTime': '所有時間',
  'panel.stat.groupAll': '所有時間的統計',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': '{year}年的統計',
  'panel.stat.announceAll': '正在顯示所有時間的統計。',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': '正在顯示{year}年的統計。',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': '{year}年出發的旅行',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': '{year}年出發的旅行天數',
  'panel.stat.countries': '你的旅行所經國家',
  'panel.stat.countriesCaption': '這些旅行涉及的不同國家',
  'panel.stat.streak': '你的連續旅行年數',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': '從{first}年到{last}年每年都有旅行',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': '{last}年有一次旅行',
  'panel.stat.streakNone': '新增有日期的旅行以開始連續紀錄',
  'visitEdit.edit': '編輯造訪',
  'visitEdit.note': '備註',
  'visitEdit.save': '儲存造訪',
  'visitEdit.cancel': '取消',
  'visitEdit.loading': '正在載入造訪',
  'visitEdit.saving': '正在儲存造訪',
  'visitEdit.failed': '無法確認儲存。草稿已保留，請重試。',
  'visitEdit.missing': '此造訪已無法使用，請重新開啟該國家。',
  'visitEdit.noteInvalid': '最多輸入2000個字元。',
  'visitEdit.bounds': '首次造訪日期不能晚於最後造訪日期。',
  'visitEdit.future': '請選擇今天或更早的日期。',
  'visitEdit.dateInvalid': '請輸入YYYY-MM-DD格式的真實日期。',
  'visitEdit.reload': '已儲存，重新載入紀錄',
} satisfies TranslationOf<typeof En>

export default messages
