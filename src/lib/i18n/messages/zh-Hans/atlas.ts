/**
 * The world tracker and the map chrome, in Simplified Chinese.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * 世界地图 for the tracker (its nav entry), 行程 for a trip, 工作区 for the
 * workspace; the bucket list is 愿望清单.
 *
 * **One branch.** Chinese has no plural inflection, so `Intl.PluralRules`
 * reports the single category `other` and every `one`/`other` pair English
 * writes collapses to one branch. The number still arrives already formatted;
 * the measure word that follows it (个, 次, 天, 座) is chosen per message.
 *
 * Country names stay English by design: `src/lib/atlas/country-names.ts` is a
 * frozen table, so `{name}` sits inside the Chinese sentence as a Latin name.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': '世界地图。还没有国家被标为去过。',
  'screen.world.summary':
    '世界地图，共 {total} 个国家，其中 {visited} 个已标为去过。',
  'screen.error.title': '世界地图没有加载出来',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': '正在加载地图',
  'map.controls.label': '地图控件',
  'map.controls.zoomIn': '放大',
  'map.controls.zoomOut': '缩小',
  'map.controls.north': '朝向正北',
  'map.controls.locate': '定位我的位置',
  'map.controls.locateFailed': '我们无法获取您的位置。',
  'map.controls.locateFailedBody':
    '请确认已允许本网站访问位置信息，然后再试一次。',

  'map.attribution.label': '地图数据来自',

  'map.basemap.title': '底图暂不可用',
  'map.basemap.body':
    '街道细节暂时离线。每个地点仍显示在真实位置上，距离和聚合依然准确。',
  'map.basemap.credit': '海岸线来自',
  'map.basemap.retry': '再试一次',
  'map.basemap.retrying': '正在检查底图',

  'map.engine.unsupported.title': '无法渲染地图',
  'map.engine.unsupported.body':
    '此浏览器无法运行交互式地图：它需要 WebGL2，而这里没有可用的 WebGL2 环境。此屏幕上的其他内容都不依赖它。',
  'map.engine.stalled.title': '地图还没有绘制出来',
  'map.engine.stalled.body':
    '在留给地图启动的时间里没有任何内容出现。它也许会自己恢复；此屏幕上的其他内容都不依赖它。',

  'map.coverage.partial.title': '街道细节不完整',
  'map.coverage.partial.body': {
    other:
      '已发布的地图数据没有覆盖到本次行程的 {outside} 个地点。它们被绘制在我们自己的海岸线上的真实位置。',
  },
  'map.coverage.none.title': '这里没有街道细节',
  'map.coverage.none.body':
    '这一地区的街道尚未发布。海岸线、图钉和它们之间的路线都是真实的——缺少的只有建筑和道路。',
  'map.coverage.dismiss': '关闭地图覆盖范围提示',

  'map.legend.title': '图例',
  'map.legend.collapse': '收起{title}',
  'map.legend.expand': '展开{title}',
  'map.legend.dayPin': '行程日图钉示例',
  'map.legend.dayPinMeaning': '行程中的一天',
  'map.legend.clusterPin': '聚合图钉示例',
  'map.legend.clusterPinMeaning': '聚合的地点',

  'map.filter.label': '按类别筛选地点',
  'map.filter.all': '全部',
  'map.filter.category': {
    other: '{name} · {places} 个地点',
  },

  'map.pin.day': '第 {day} 天',
  'map.pin.cluster': {
    other: '{places} 个地点——放大即可逐一分开',
  },

  'map.place.rating': '评分 {rating}，满分 {max}',
  'map.place.clause.day': '第 {day} 天',
  'map.place.clause.rating': '评分 {rating}，满分 {max}',
  'map.place.clause.visited': '去过',
  'map.place.clause.separator': '，',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': '最近到访',
  'legend.recent': {
    other: '最近 {years} 年内',
  },
  'legend.middle': '{from}–{to} 年前，或没有日期',
  'legend.distant': {
    other: '超过 {years} 年前',
  },
  'legend.unvisited': '还没去过',
  'legend.note': '深浅只表示到访的远近——每个日期都完整写在“国家”标签页里。',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': '世界覆盖',
  'panel.coverage.unit': '共 {total} 个',
  'panel.coverage.caption': '占世界的 {share} · {visits}',
  'panel.progress.label': '走遍每个国家',
  'panel.progress.remaining': '还差 {remaining} 个',
  'panel.toggle.hide': '隐藏世界地图详情',
  'panel.toggle.show': '显示世界地图详情',
  'panel.tabs.label': '世界地图栏目',
  'panel.tab.country': '国家',
  'panel.tab.stats': '统计',
  'panel.tab.bucket': '愿望清单',
  'panel.back': '全部国家',
  'panel.list.label': '去过的国家',
  'panel.loading': '正在加载您的世界地图',

  'panel.empty.blank.title': '您的地图还是一片空白',
  'panel.empty.blank.body':
    '把一个国家标为去过，它就会在这里的地图上填上颜色，连同第一次和最近一次到访、去过的次数，以及您为它写下的一切。',
  'panel.empty.pick.title': '选一个国家',
  'panel.empty.pick.body':
    '在地图上、搜索框里或列表中选一个国家，它的完整档案就会在这里打开——第一次到访、最近一次到访、次数统计和您的笔记。',

  'panel.stat.places': '地点',
  'panel.stat.placesNone': '行程里还没有钉下任何地点',
  'panel.stat.placesCaption': '保存的景点、住处和途经地',
  'panel.stat.regions': '地区',
  'panel.stat.regionsNone': '还没有标记任何地区',
  'panel.stat.regionsCaption': '州、省、都道府县',
  'panel.stat.visits': '到访',
  'panel.stat.visitsCaption': '每一次记录在案的抵达',
  'panel.stat.trips': '行程',
  'panel.stat.tripsCaption': '只统计已完成的行程',
  'panel.stat.cities': '城市',
  'panel.stat.citiesCaption': '住过或停留过的城市',
  'panel.stat.days': '在外天数',
  'panel.stat.daysCaption': '累计您记录中的每一次行程',
  'panel.continents.label': '按大洲统计的国家',

  'panel.bucket.empty.title': '清单上还没有内容',
  'panel.bucket.empty.body':
    '那个您一直想去的地方。把它加进来，到了那天再把它划掉。',
  'panel.bucket.label': '愿望清单',
  'panel.bucket.progress': '已完成 {done} 项，共 {total} 项',
  'panel.bucket.done': '已实现',
  'panel.bucket.toGo': '待出发',
  'panel.bucket.target': '{year} 年前',
  'panel.bucket.hidden': {
    other: '清单上还有 {entries} 项，未在此显示。',
  },
  'panel.bucket.kind.country': '国家',
  'panel.bucket.kind.region': '地区',
  'panel.bucket.kind.place': '地点',

  /* --------------------------------------------------------------- the world */
  'continent.africa': '非洲',
  'continent.antarctica': '南极洲',
  'continent.asia': '亚洲',
  'continent.europe': '欧洲',
  'continent.northAmerica': '北美洲',
  'continent.oceania': '大洋洲',
  'continent.southAmerica': '南美洲',
  'continent.unknown': '未记录所属大洲',

  /* ------------------------------------------------------------- the record */
  'record.visited': '去过',
  'record.firstVisit': '首次到访',
  'record.lastVisit': '最近到访',
  'record.visitDates': '到访日期',
  'record.notRecorded': '未记录',
  'record.datesUnrecorded': '日期未记录',
  'record.visits': {
    other: '到访 {visits} 次',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': '首次到访 {from}',
  'record.spanTo': '最近到访 {to}',
  'record.visitsUnit': { other: '次' },
  'record.gap.days': { other: '相隔 {gap} 天' },
  'record.gap.months': { other: '相隔 {gap} 个月' },
  'record.gap.years': { other: '相隔 {gap} 年' },
  'record.note.empty': '还没有笔记',
  'record.noOutline':
    '这张地图绘制的世界轮廓按 1:110m 比例裁切，该比例把这块领土并入其母国——所以地图上没有可以框选的形状。这次到访照常计入。',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': '国家排序',
  'list.sort.code': '国家代码',
  'list.sort.codeStatement': '按国家代码从 A 到 Z 排列。',
  'list.sort.name': '国家名称',
  'list.sort.nameStatement': '按国家名称从 A 到 Z 排列，再按国家代码。',
  'list.sort.recent': '最近到访',
  'list.sort.recentStatement': '最近到访的排在前面，再按国家代码。',
  'list.sort.visits': '到访最多',
  'list.sort.visitsStatement': '到访次数最多的排在前面，再按国家代码。',
  'list.row.cell': '{label} {value}',
  'list.noOutline': '世界轮廓把它并入了母国，所以地图上没有可以框选的形状。',
  'list.announce.selected': '已选中 {name}。',
  'list.announce.selectedUnframed': '已选中 {name}。{reason}',
  'list.empty.title': '地图上还没有国家',
  'list.empty.body':
    '一旦记下某个国家的到访，它就会出现在这里，连同第一次抵达、最近一次抵达和去过的次数。',
  'list.loading': '正在加载去过的国家',
  'list.error.title': '您的国家列表没有加载出来',
  'list.error.body':
    '世界地图暂时读不到您去过的国家。什么都没有丢——它们仍然记录在案。',
  'list.error.retry': '再试一次',
  'list.error.retrying': '正在加载您的国家',

  /* ------------------------------------------------------------- the search */
  'search.label': '查找国家',
  'search.loading': '正在加载您的国家',
  'search.placeholder': '国家名称或代码',
  'search.entry.notVisited': '还没去过',
  'search.entry.noOutline': '地图上没有轮廓',
  'search.entry.separator': ' · ',
  'search.cleared': '已清除选择。',
  'search.unframed': '{name} 在世界比例下没有轮廓，地图没有可以框选的对象。',
  'search.unframedVisited':
    '{name} 在世界比例下没有轮廓，地图没有可以框选的对象。它的档案不受影响。',
  'search.results.empty':
    '您的记录里还没有国家。输入即可搜索世界上的每个国家。',
  'search.results.emptyPinned':
    '已选中 {name}。您的记录里还没有国家——输入即可搜索世界上的每个国家。',
  'search.results.record': {
    other: '您的记录里有 {countries} 个国家。',
  },
  'search.results.capped': '显示前 {shown} 个。',
  'search.results.pinned': '{name} 已选中并排在最前。',
  'search.results.none': '没有国家匹配 {term}。',
  'search.results.matches': {
    other: '有 {countries} 个国家匹配 {term}。',
  },
  'search.announce.selected': '已选中 {name}。',
  'search.announce.framing': '已选中 {name}。地图正在对准它。',
  'search.announce.unframed': '已选中 {name}。{reason}',
  'search.empty.title': '您的记录里还没有内容',
  'search.empty.body': '输入国家名称或它的两位字母代码，即可在地图上找到它。',
  'search.empty.noMatchTitle': '没有国家匹配“{term}”',
  'search.empty.noMatchBody':
    '检查一下拼写，或试试两位字母代码——输入 PT 就能找到葡萄牙。全部 {countries} 个国家都可以搜索，无论您是否去过。',

  /* ------------------------------------------------------- the two writes */
  'actions.label': '您的记录',
  'actions.visit.absent.title': '还没去过',
  'actions.visit.absent.caption': '一次没有行程支撑的到访。',
  'actions.visit.title': '去过',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': '不在清单上',
  'actions.goal.absent.caption': '一个您打算去的地方。',
  'actions.goal.title': '在愿望清单上',
  'actions.goal.waiting': '正等着轮到它。',
  'actions.goal.target': '目标是 {year} 年。',
  'actions.goal.achieved.title': '已从清单划掉',
  'actions.goal.achieved.caption': '您到了那里。这条记录会一直留着。',

  'actions.button.remove': '移除',
  'actions.button.mark': '标为去过',
  'actions.button.add': '加入清单',
  'actions.visit.remove.name': '移除——把 {name} 从您的世界地图上拿掉',
  'actions.visit.remove.busy': '正在把 {name} 从您的世界地图上拿掉',
  'actions.visit.add.name': '标为去过——{name}',
  'actions.visit.add.busy': '正在把 {name} 标为去过',
  'actions.goal.remove.name': '移除——把 {name} 从愿望清单上拿掉',
  'actions.goal.remove.busy': '正在把 {name} 从愿望清单上拿掉',
  'actions.goal.add.name': '加入清单——{name}',
  'actions.goal.add.busy': '正在把 {name} 加入愿望清单',

  'actions.hint': '两个操作都立即生效，也都可以在这里撤销。',
  'actions.offline': '设备无法连接到服务器。请检查网络连接后再试一次。',
  'actions.toast.marked': '已标为去过',
  'actions.toast.markedBody': '{name} 已在您的世界地图上。',
  'actions.toast.markFailed': '{name} 没有被标记',
  'actions.toast.unmarked': '已从您的世界地图上移除',
  'actions.toast.unmarkedBody': '{name} 不再标为去过。',
  'actions.toast.unmarkFailed': '{name} 没有被移除',
  'actions.toast.listed': '已加入愿望清单',
  'actions.toast.listedBody': '{name} 是您打算去的地方。',
  'actions.toast.listFailed': '{name} 没有被加入',
  'actions.toast.unlisted': '已从愿望清单移除',
  'actions.toast.unlistedBody': '{name} 已不在清单上。',
  'actions.toast.unlistFailed': '{name} 没有被移除',
  'actions.toast.fallback': '更改没有送达服务器。请稍后再试一次。',

  'actions.confirm.visit.title': '把 {name} 从您的世界地图上移除？',
  'actions.confirm.visit.body': {
    other:
      '{visits} 次已记录的到访{dates}{note}将被清除。您的行程和保存的地点不受影响。',
  },
  'actions.confirm.visit.dates': '（{span}）',
  'actions.confirm.visit.note': '，连同您写下的笔记',
  'actions.confirm.goal.title': '把 {name} 从愿望清单上移除？',
  'actions.confirm.goal.body':
    '它已经被划掉了，所以这也会一并移除您到过那里的记录。您的世界地图和行程不受影响。',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { other: '行程' },
  'card.visits': { other: '到访' },
  'card.places': { other: '地点' },
  'card.firstTrip': '首次行程',
  'card.lastTrip': '最近行程',
  'card.firstVisit': '首次到访',
  'card.lastVisit': '最近到访',
  'card.absent': '未记录',
  'card.loading': '正在加载这个国家',
  'card.loadingNamed': '正在加载 {name}',
  'card.error.body': '这些数字没有加载出来。什么都没有丢。',
  'card.error.retry': '再试一次',
  'overlay.close': '关闭 {name}',
} satisfies TranslationOf<typeof En>

export default messages
