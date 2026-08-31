/**
 * The world tracker and the map chrome, in Russian.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * атлас for the tracker, поездка for a trip, список желаний for the bucket
 * list, пространство for the workspace.
 *
 * **Four branches.** `Intl.PluralRules` for `ru` reports one, few, many and
 * other, and the gate requires all four. `few` covers 2–4, `many` the genitive
 * plural, `other` the fractional shapes — the noun endings below follow that
 * split (визит / визита / визитов). Every number a reader sees arrives already
 * formatted; the `count` parameter only picks the branch.
 *
 * Country names stay English by design: `src/lib/atlas/country-names.ts` is a
 * frozen table, so agreement with `{name}` is written against «страна» —
 * feminine — throughout.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Карта мира. Ни одна страна ещё не отмечена как посещённая.',
  'screen.world.summary': 'Карта мира: отмечено {visited} из {total} стран.',
  'screen.error.title': 'Атлас не загрузился',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Загрузка карты',
  'map.controls.label': 'Управление картой',
  'map.controls.zoomIn': 'Приблизить',
  'map.controls.zoomOut': 'Отдалить',
  'map.controls.north': 'Повернуть на север',
  'map.controls.locate': 'Найти моё местоположение',
  'map.controls.locateFailed': 'Не удалось определить ваше местоположение.',
  'map.controls.locateFailedBody':
    'Проверьте, разрешён ли этому сайту доступ к геолокации, и попробуйте ещё раз.',

  'map.attribution.label': 'Данные карты от',

  'map.basemap.title': 'Базовая карта недоступна',
  'map.basemap.body':
    'Детали улиц сейчас недоступны. Каждое место по-прежнему показано в своей настоящей позиции, поэтому расстояния и группы остаются точными.',
  'map.basemap.credit': 'Береговые линии от',
  'map.basemap.retry': 'Попробовать ещё раз',
  'map.basemap.retrying': 'Проверяем базовую карту',

  'map.engine.unsupported.title': 'Отрисовка карты недоступна',
  'map.engine.unsupported.body':
    'Этот браузер не может показать интерактивную карту: ей нужен WebGL2, а здесь его нет. Всё остальное на этом экране работает без неё.',
  'map.engine.stalled.title': 'Карта ещё не отрисовалась',
  'map.engine.stalled.body':
    'За отведённое на запуск время ничего не появилось. Карта ещё может ожить сама; всё остальное на этом экране от неё не зависит.',

  'map.coverage.partial.title': 'Улицы показаны не везде',
  'map.coverage.partial.body': {
    one: 'Опубликованные данные карты не доходят до {outside} места этой поездки. Оно нарисовано в своей настоящей позиции на наших собственных береговых линиях.',
    few: 'Опубликованные данные карты не доходят до {outside} мест этой поездки. Они нарисованы в своих настоящих позициях на наших собственных береговых линиях.',
    many: 'Опубликованные данные карты не доходят до {outside} мест этой поездки. Они нарисованы в своих настоящих позициях на наших собственных береговых линиях.',
    other:
      'Опубликованные данные карты не доходят до {outside} места этой поездки. Они нарисованы в своих настоящих позициях на наших собственных береговых линиях.',
  },
  'map.coverage.none.title': 'Здесь нет деталей улиц',
  'map.coverage.none.body':
    'Улицы для этого региона ещё не опубликованы. Береговые линии, метки и маршруты между ними настоящие — не хватает только зданий и дорог.',
  'map.coverage.dismiss': 'Скрыть заметку о покрытии карты',

  'map.legend.title': 'Легенда',
  'map.legend.collapse': 'Свернуть {title}',
  'map.legend.expand': 'Развернуть {title}',
  'map.legend.dayPin': 'Пример метки дня',
  'map.legend.dayPinMeaning': 'День маршрута',
  'map.legend.clusterPin': 'Пример сгруппированной метки',
  'map.legend.clusterPinMeaning': 'Сгруппированные места',

  'map.filter.label': 'Фильтр мест по категории',
  'map.filter.all': 'Все',
  'map.filter.category': {
    one: '{name} · {places} место',
    few: '{name} · {places} места',
    many: '{name} · {places} мест',
    other: '{name} · {places} места',
  },

  'map.pin.day': 'День {day}',
  'map.pin.cluster': {
    one: '{places} место — приблизьте, чтобы увидеть его отдельно',
    few: '{places} места — приблизьте, чтобы разделить их',
    many: '{places} мест — приблизьте, чтобы разделить их',
    other: '{places} места — приблизьте, чтобы разделить их',
  },

  'map.place.rating': 'Оценка {rating} из {max}',
  'map.place.clause.day': 'день {day}',
  'map.place.clause.rating': 'оценка {rating} из {max}',
  'map.place.clause.visited': 'посещено',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Последний визит',
  'legend.recent': {
    one: 'За последний год',
    few: 'За последние {years} года',
    many: 'За последние {years} лет',
    other: 'За последние {years} года',
  },
  'legend.middle': '{from}–{to} лет назад или без даты',
  'legend.distant': {
    one: 'Больше {years} года назад',
    few: 'Больше {years} лет назад',
    many: 'Больше {years} лет назад',
    other: 'Больше {years} года назад',
  },
  'legend.unvisited': 'Ещё не посещено',
  'legend.note':
    'Оттенок показывает только давность — вкладка «Страна» выписывает каждую дату.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Охват мира',
  'panel.coverage.unit': 'из {total}',
  'panel.coverage.caption': '{share} мира · {visits}',
  'panel.progress.label': 'На пути к каждой стране',
  'panel.progress.remaining': 'Осталось {remaining}',
  'panel.toggle.hide': 'Скрыть детали атласа',
  'panel.toggle.show': 'Показать детали атласа',
  'panel.tabs.label': 'Разделы атласа',
  'panel.tab.country': 'Страна',
  'panel.tab.stats': 'Статистика',
  'panel.tab.bucket': 'Список желаний',
  'panel.back': 'Все страны',
  'panel.list.label': 'Посещённые страны',
  'panel.loading': 'Загрузка вашего атласа',

  'panel.empty.blank.title': 'Ваша карта пока пуста',
  'panel.empty.blank.body':
    'Отметьте страну как посещённую — и она закрасится здесь на карте, с первым и последним визитом, числом поездок и всем, что вы о ней записали.',
  'panel.empty.pick.title': 'Выберите страну',
  'panel.empty.pick.body':
    'Укажите её на карте, в поиске или в списке — и здесь откроется её полная запись: первый визит, последний, счёт визитов и ваша заметка.',

  'panel.stat.places': 'Места',
  'panel.stat.placesNone': 'В поездках ещё ничего не отмечено',
  'panel.stat.placesCaption': 'Сохранённые виды, ночлеги и остановки',
  'panel.stat.regions': 'Регионы',
  'panel.stat.regionsNone': 'Регионы ещё не отмечены',
  'panel.stat.regionsCaption': 'Области, штаты, префектуры',
  'panel.stat.visits': 'Визиты',
  'panel.stat.visitsCaption': 'Каждое записанное прибытие',
  'panel.stat.trips': 'Ваши поездки',
  'panel.stat.tripsCaption':
    'Только завершённые поездки, в которых вы участвуете',
  'panel.stat.cities': 'Города',
  'panel.stat.citiesCaption': 'Города, где вы ночевали или делали остановку',
  'panel.stat.days': 'Дни в пути',
  'panel.stat.daysCaption': 'По всем поездкам в вашей истории',
  'panel.continents.label': 'Страны по континентам',

  'panel.bucket.empty.title': 'В списке пока пусто',
  'panel.bucket.empty.body':
    'Место, куда вы давно собираетесь. Добавьте его — и вычеркните, когда доберётесь.',
  'panel.bucket.label': 'Список желаний',
  'panel.bucket.progress': 'Готово {done} из {total}',
  'panel.bucket.done': 'Исполнено',
  'panel.bucket.toGo': 'Впереди',
  'panel.bucket.target': 'к {year} году',
  'panel.bucket.hidden': {
    one: 'Ещё {entries} запись в вашем списке, не показана здесь.',
    few: 'Ещё {entries} записи в вашем списке, не показаны здесь.',
    many: 'Ещё {entries} записей в вашем списке, не показаны здесь.',
    other: 'Ещё {entries} записи в вашем списке, не показаны здесь.',
  },
  'panel.bucket.kind.country': 'Страна',
  'panel.bucket.kind.region': 'Регион',
  'panel.bucket.kind.place': 'Место',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Африка',
  'continent.antarctica': 'Антарктида',
  'continent.asia': 'Азия',
  'continent.europe': 'Европа',
  'continent.northAmerica': 'Северная Америка',
  'continent.oceania': 'Океания',
  'continent.southAmerica': 'Южная Америка',
  'continent.unknown': 'Континент не указан',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Посещено',
  'record.firstVisit': 'Первый визит',
  'record.lastVisit': 'Последний визит',
  'record.visitDates': 'Даты визитов',
  'record.notRecorded': 'Не записано',
  'record.datesUnrecorded': 'Даты не записаны',
  'record.visits': {
    one: '{visits} визит',
    few: '{visits} визита',
    many: '{visits} визитов',
    other: '{visits} визита',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Первый визит {from}',
  'record.spanTo': 'Последний визит {to}',
  'record.visitsUnit': {
    one: 'визит',
    few: 'визита',
    many: 'визитов',
    other: 'визита',
  },
  'record.gap.days': {
    one: 'с промежутком в {gap} день',
    few: 'с промежутком в {gap} дня',
    many: 'с промежутком в {gap} дней',
    other: 'с промежутком в {gap} дня',
  },
  'record.gap.months': {
    one: 'с промежутком в {gap} месяц',
    few: 'с промежутком в {gap} месяца',
    many: 'с промежутком в {gap} месяцев',
    other: 'с промежутком в {gap} месяца',
  },
  'record.gap.years': {
    one: 'с промежутком в {gap} год',
    few: 'с промежутком в {gap} года',
    many: 'с промежутком в {gap} лет',
    other: 'с промежутком в {gap} года',
  },
  'record.note.empty': 'Заметки пока нет',
  'record.noOutline':
    'Контуры мира на этой карте нарезаны в масштабе 1:110m, а он вписывает эту территорию в её материнское государство — поэтому на карте нечего обвести. Визит всё равно засчитан.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Порядок стран',
  'list.sort.code': 'Код страны',
  'list.sort.codeStatement': 'Упорядочено по коду страны, от A до Z.',
  'list.sort.name': 'Название страны',
  'list.sort.nameStatement':
    'Упорядочено по названию страны, от A до Z, затем по коду.',
  'list.sort.recent': 'Самый недавний визит',
  'list.sort.recentStatement':
    'Сначала самый недавний визит, затем по коду страны.',
  'list.sort.visits': 'Больше всего визитов',
  'list.sort.visitsStatement':
    'Сначала страны с наибольшим числом визитов, затем по коду страны.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Контуры мира вписывают её в материнское государство, поэтому на карте нечего обвести.',
  'list.announce.selected': 'Выбрано: {name}.',
  'list.announce.selectedUnframed': 'Выбрано: {name}. {reason}',
  'list.empty.title': 'На карте пока нет стран',
  'list.empty.body':
    'Страна появляется здесь, как только за ней записан визит: первое прибытие, последнее и сколько раз вы там были.',
  'list.loading': 'Загрузка посещённых стран',
  'list.error.title': 'Ваши страны не загрузились',
  'list.error.body':
    'Атласу не удалось прочитать ваши посещённые страны. Ничего не потеряно — они по-прежнему записаны.',
  'list.error.retry': 'Попробовать ещё раз',
  'list.error.retrying': 'Загрузка ваших стран',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Найти страну',
  'search.loading': 'Загрузка ваших стран',
  'search.placeholder': 'Название или код страны',
  'search.entry.notVisited': 'Ещё не посещена',
  'search.entry.noOutline': 'без контура на карте',
  'search.entry.separator': ' · ',
  'search.cleared': 'Выбор снят.',
  'search.unframed':
    'У {name} нет контура в мировом масштабе, поэтому карте нечего обвести.',
  'search.unframedVisited':
    'У {name} нет контура в мировом масштабе, поэтому карте нечего обвести. Запись об этой стране не затронута.',
  'search.results.empty':
    'В вашей истории пока нет стран. Начните вводить, чтобы найти любую страну мира.',
  'search.results.emptyPinned':
    'Выбрано: {name}. В вашей истории пока нет стран — начните вводить, чтобы найти любую страну мира.',
  'search.results.record': {
    one: '{countries} страна в вашей истории.',
    few: '{countries} страны в вашей истории.',
    many: '{countries} стран в вашей истории.',
    other: '{countries} страны в вашей истории.',
  },
  'search.results.capped': 'Показаны первые {shown}.',
  'search.results.pinned': '{name} выбрана и показана первой.',
  'search.results.none': 'Ни одна страна не соответствует {term}.',
  'search.results.matches': {
    one: '{countries} страна соответствует {term}.',
    few: '{countries} страны соответствуют {term}.',
    many: '{countries} стран соответствуют {term}.',
    other: '{countries} страны соответствует {term}.',
  },
  'search.announce.selected': 'Выбрано: {name}.',
  'search.announce.framing': 'Выбрано: {name}. Карта наводится на неё.',
  'search.announce.unframed': 'Выбрано: {name}. {reason}',
  'search.empty.title': 'В вашей истории пока пусто',
  'search.empty.body':
    'Введите название страны или её двухбуквенный код, чтобы найти её на карте.',
  'search.empty.noMatchTitle': 'Ни одна страна не соответствует «{term}»',
  'search.empty.noMatchBody':
    'Проверьте написание или попробуйте двухбуквенный код — PT найдёт Португалию. Доступны все {countries} стран, независимо от того, были вы там или нет.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Ваша запись',
  'actions.visit.absent.title': 'Не посещена',
  'actions.visit.absent.caption': 'Визит, за которым не стоит поездка.',
  'actions.visit.title': 'Посещена',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Не в списке',
  'actions.goal.absent.caption': 'Место, куда вы собираетесь.',
  'actions.goal.title': 'В списке желаний',
  'actions.goal.waiting': 'Ждёт своей очереди.',
  'actions.goal.target': 'Цель — {year}.',
  'actions.goal.achieved.title': 'Вычеркнуто из списка',
  'actions.goal.achieved.caption':
    'Вы добрались. Запись остаётся как свидетельство.',

  'actions.button.remove': 'Убрать',
  'actions.button.mark': 'Отметить визит',
  'actions.button.add': 'Добавить в список',
  'actions.visit.remove.name': 'Убрать {name} из вашего атласа',
  'actions.visit.remove.busy': 'Убираем {name} из вашего атласа',
  'actions.visit.add.name': 'Отметить визит, {name}',
  'actions.visit.add.busy': 'Отмечаем {name} как посещённую',
  'actions.goal.remove.name': 'Убрать {name} из списка желаний',
  'actions.goal.remove.busy': 'Убираем {name} из списка желаний',
  'actions.goal.add.name': 'Добавить в список, {name}',
  'actions.goal.add.busy': 'Добавляем {name} в список желаний',

  'actions.hint':
    'Оба действия вступают в силу сразу, и оба можно отменить здесь же.',
  'actions.offline':
    'Устройству не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.',
  'actions.toast.marked': 'Отмечено как посещённое',
  'actions.toast.markedBody': '{name} теперь в вашем атласе.',
  'actions.toast.markFailed': '{name} не удалось отметить',
  'actions.toast.unmarked': 'Убрано из вашего атласа',
  'actions.toast.unmarkedBody': '{name} больше не отмечена как посещённая.',
  'actions.toast.unmarkFailed': '{name} не удалось убрать',
  'actions.toast.listed': 'Добавлено в список желаний',
  'actions.toast.listedBody': '{name} — место, куда вы собираетесь.',
  'actions.toast.listFailed': '{name} не удалось добавить',
  'actions.toast.unlisted': 'Убрано из списка желаний',
  'actions.toast.unlistedBody': '{name} больше не в списке.',
  'actions.toast.unlistFailed': '{name} не удалось убрать',
  'actions.toast.fallback':
    'Изменение не дошло до сервера. Попробуйте ещё раз через минуту.',

  'actions.confirm.visit.title': 'Убрать {name} из вашего атласа?',
  'actions.confirm.visit.body': {
    one: '{visits} записанный визит{dates} будет стёрт{note}. Ваши поездки и сохранённые места не пострадают.',
    few: '{visits} записанных визита{dates} будут стёрты{note}. Ваши поездки и сохранённые места не пострадают.',
    many: '{visits} записанных визитов{dates} будут стёрты{note}. Ваши поездки и сохранённые места не пострадают.',
    other:
      '{visits} записанного визита{dates} будут стёрты{note}. Ваши поездки и сохранённые места не пострадают.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ' — вместе с вашей заметкой',
  'actions.confirm.goal.title': 'Убрать {name} из списка желаний?',
  'actions.confirm.goal.body':
    'Эта страна уже вычеркнута, поэтому вместе с ней исчезнет и запись о том, что вы там побывали. Ваш атлас и ваши поездки не пострадают.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Поездка рабочего пространства',
    few: 'Поездки рабочего пространства',
    many: 'Поездок рабочего пространства',
    other: 'Поездки рабочего пространства',
  },
  'card.visits': {
    one: 'Визит',
    few: 'Визита',
    many: 'Визитов',
    other: 'Визита',
  },
  'card.places': {
    one: 'Место',
    few: 'Места',
    many: 'Мест',
    other: 'Места',
  },
  'card.firstTrip': 'Первая поездка',
  'card.lastTrip': 'Последняя поездка',
  'card.firstVisit': 'Первый визит',
  'card.lastVisit': 'Последний визит',
  'card.absent': 'Не записано',
  'card.loading': 'Загрузка этой страны',
  'card.loadingNamed': 'Загрузка: {name}',
  'card.error.body': 'Эти цифры не загрузились. Ничего не потеряно.',
  'card.error.retry': 'Попробовать ещё раз',
  'overlay.close': 'Закрыть {name}',
} satisfies TranslationOf<typeof En>

export default messages
