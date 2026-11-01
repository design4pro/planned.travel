/**
 * The world tracker and the map chrome, in Ukrainian.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * атлас for the tracker, поїздка for a trip, список бажань for the bucket
 * list, простір for the workspace.
 *
 * **Four branches.** `Intl.PluralRules` for `uk` reports one, few, many and
 * other, and the gate requires all four. `few` covers 2–4, `many` the genitive
 * plural, `other` the fractional shapes (візит / візити / візитів). Every
 * number a reader sees arrives already formatted; the `count` parameter only
 * picks the branch.
 *
 * Country names stay English by design: `src/lib/atlas/country-names.ts` is a
 * frozen table, so agreement with `{name}` is written against «країна» —
 * feminine — throughout.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  'panel.stats.empty.title': 'Поки немає що рахувати',
  'panel.stats.empty.body':
    'Позначте країну на карті або заплануйте подорож, і тут з’являться ваші показники.',
  'panel.stats.empty.action': 'Запланувати подорож',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Карта світу. Жодну країну ще не позначено як відвідану.',
  'screen.world.summary': 'Карта світу: позначено {visited} з {total} країн.',
  'screen.error.title': 'Атлас не завантажився',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Завантаження карти',
  'map.controls.label': 'Керування картою',
  'map.controls.zoomIn': 'Наблизити',
  'map.controls.zoomOut': 'Віддалити',
  'map.controls.north': 'Повернути на північ',
  'map.controls.locate': 'Знайти моє місцеперебування',
  'map.controls.locateFailed': 'Не вдалося визначити ваше місцеперебування.',
  'map.controls.locateFailedBody':
    'Перевірте, чи дозволено цьому сайту доступ до геолокації, і спробуйте ще раз.',

  'map.attribution.label': 'Дані карти від',
  'map.attribution.geocoder': 'Місця знайдено за допомогою',

  'map.basemap.title': 'Базова карта недоступна',
  'map.basemap.body':
    'Деталі вулиць зараз недоступні. Кожне місце й далі показане у своїй справжній позиції, тож відстані та групи лишаються точними.',
  'map.basemap.credit': 'Берегові лінії від',
  'map.basemap.retry': 'Спробувати ще раз',
  'map.basemap.retrying': 'Перевіряємо базову карту',

  'map.engine.unsupported.title': 'Відмальовування карти недоступне',
  'map.engine.unsupported.body':
    'Цей браузер не може показати інтерактивну карту: їй потрібен WebGL2, а тут його немає. Усе інше на цьому екрані працює без неї.',
  'map.engine.stalled.title': 'Карта ще не відмалювалася',
  'map.engine.stalled.body':
    'За відведений на запуск час нічого не з’явилося. Карта ще може ожити сама; усе інше на цьому екрані від неї не залежить.',

  'map.coverage.partial.title': 'Вулиці показано не скрізь',
  'map.coverage.partial.body': {
    one: 'Опубліковані дані карти не сягають {outside} місця цієї поїздки. Воно намальоване у своїй справжній позиції на наших власних берегових лініях.',
    few: 'Опубліковані дані карти не сягають {outside} місць цієї поїздки. Вони намальовані у своїх справжніх позиціях на наших власних берегових лініях.',
    many: 'Опубліковані дані карти не сягають {outside} місць цієї поїздки. Вони намальовані у своїх справжніх позиціях на наших власних берегових лініях.',
    other:
      'Опубліковані дані карти не сягають {outside} місця цієї поїздки. Вони намальовані у своїх справжніх позиціях на наших власних берегових лініях.',
  },
  'map.coverage.none.title': 'Тут немає деталей вулиць',
  'map.coverage.none.body':
    'Вулиці для цього регіону ще не опубліковані. Берегові лінії, позначки та маршрути між ними справжні — бракує лише будівель і доріг.',
  'map.coverage.dismiss': 'Приховати примітку про покриття карти',

  'map.legend.title': 'Легенда',
  'map.legend.collapse': 'Згорнути {title}',
  'map.legend.expand': 'Розгорнути {title}',
  'map.legend.dayPin': 'Приклад позначки дня',
  'map.legend.dayPinMeaning': 'День маршруту',
  'map.legend.clusterPin': 'Приклад згрупованої позначки',
  'map.legend.clusterPinMeaning': 'Згруповані місця',

  'map.filter.label': 'Фільтр місць за категорією',
  'map.filter.all': 'Усі',
  'map.filter.category': {
    one: '{name} · {places} місце',
    few: '{name} · {places} місця',
    many: '{name} · {places} місць',
    other: '{name} · {places} місця',
  },

  'map.pin.day': 'День {day}',
  'map.pin.cluster': {
    one: '{places} місце — наблизьте, щоб побачити його окремо',
    few: '{places} місця — наблизьте, щоб розділити їх',
    many: '{places} місць — наблизьте, щоб розділити їх',
    other: '{places} місця — наблизьте, щоб розділити їх',
  },

  'map.place.rating': 'Оцінка {rating} з {max}',
  'map.place.clause.day': 'день {day}',
  'map.place.clause.rating': 'оцінка {rating} з {max}',
  'map.place.clause.visited': 'відвідано',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Останній візит',
  'legend.recent': {
    one: 'За останній рік',
    few: 'За останні {years} роки',
    many: 'За останні {years} років',
    other: 'За останні {years} року',
  },
  'legend.middle': '{from}–{to} років тому або без дати',
  'legend.distant': {
    one: 'Понад {years} рік тому',
    few: 'Понад {years} роки тому',
    many: 'Понад {years} років тому',
    other: 'Понад {years} року тому',
  },
  'legend.unvisited': 'Ще не відвідано',
  'legend.note':
    'Відтінок показує лише давність — вкладка «Країна» виписує кожну дату.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Охоплення світу',
  'panel.coverage.unit': 'з {total}',
  'panel.coverage.caption': '{share} світу · {visits}',
  'panel.progress.label': 'На шляху до кожної країни',
  'panel.progress.remaining': 'Лишилося {remaining}',
  'panel.toggle.hide': 'Сховати деталі атласу',
  'panel.toggle.show': 'Показати деталі атласу',
  'panel.tabs.label': 'Розділи атласу',
  'panel.tab.country': 'Країна',
  'panel.tab.stats': 'Статистика',
  'panel.tab.bucket': 'Список бажань',
  'panel.back': 'Усі країни',
  'panel.list.label': 'Відвідані країни',
  'panel.loading': 'Завантаження вашого атласу',

  'panel.empty.blank.title': 'Ваша карта поки порожня',
  'panel.empty.blank.body':
    'Позначте країну як відвідану — і вона зафарбується тут на карті, з першим і останнім візитом, кількістю поїздок та всім, що ви про неї записали.',
  'panel.empty.pick.title': 'Виберіть країну',
  'panel.empty.pick.body':
    'Вкажіть її на карті, у пошуку або в списку — і тут відкриється її повний запис: перший візит, останній, лічильник візитів і ваша нотатка.',

  'panel.stat.places': 'Ваші місця',
  'panel.stat.placesNone': 'У поїздках ще нічого не позначено',
  'panel.stat.placesCaption': 'Збережені краєвиди, ночівлі та зупинки',
  'panel.stat.regions': 'Ваші регіони',
  'panel.stat.regionsNone': 'Регіони ще не позначені',
  'panel.stat.regionsCaption': 'Області, штати, префектури',
  'panel.stat.visits': 'Ваші відвідування',
  'panel.stat.visitsCaption': 'Кожне записане прибуття',
  'panel.stat.trips': 'Ваші поїздки',
  'panel.stat.tripsCaption': 'Усі поїздки, у яких ви берете участь',
  'panel.stat.cities': 'Ваші міста',
  'panel.stat.citiesCaption': 'Міста, де ви ночували або зупинялися',
  'panel.stat.days': 'Ваші дні в подорожах',
  'panel.stat.daysCaption': 'За всіма поїздками у вашій історії',
  'panel.continents.label': 'Країни за континентами',

  'panel.bucket.empty.title': 'У списку поки порожньо',
  'panel.bucket.empty.body':
    'Місце, куди ви давно збираєтеся. Додайте його — і викресліть, коли дістанетеся.',
  'panel.bucket.label': 'Список бажань',
  'panel.bucket.progress': 'Готово {done} з {total}',
  'panel.bucket.done': 'Здійснено',
  'panel.bucket.toGo': 'Попереду',
  'panel.bucket.target': 'до {year} року',
  'panel.bucket.hidden': {
    one: 'Ще {entries} запис у вашому списку, не показаний тут.',
    few: 'Ще {entries} записи у вашому списку, не показані тут.',
    many: 'Ще {entries} записів у вашому списку, не показані тут.',
    other: 'Ще {entries} запису у вашому списку, не показані тут.',
  },
  'panel.bucket.kind.country': 'Країна',
  'panel.bucket.kind.region': 'Регіон',
  'panel.bucket.kind.place': 'Місце',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Африка',
  'continent.antarctica': 'Антарктида',
  'continent.asia': 'Азія',
  'continent.europe': 'Європа',
  'continent.northAmerica': 'Північна Америка',
  'continent.oceania': 'Океанія',
  'continent.southAmerica': 'Південна Америка',
  'continent.unknown': 'Континент не вказано',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Відвідано',
  'record.firstVisit': 'Перший візит',
  'record.lastVisit': 'Останній візит',
  'record.visitDates': 'Дати візитів',
  'record.notRecorded': 'Не записано',
  'record.datesUnrecorded': 'Дати не записані',
  'record.visits': {
    one: '{visits} візит',
    few: '{visits} візити',
    many: '{visits} візитів',
    other: '{visits} візиту',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Перший візит {from}',
  'record.spanTo': 'Останній візит {to}',
  'record.visitsUnit': {
    one: 'візит',
    few: 'візити',
    many: 'візитів',
    other: 'візиту',
  },
  'record.gap.days': {
    one: 'з проміжком у {gap} день',
    few: 'з проміжком у {gap} дні',
    many: 'з проміжком у {gap} днів',
    other: 'з проміжком у {gap} дня',
  },
  'record.gap.months': {
    one: 'з проміжком в {gap} місяць',
    few: 'з проміжком у {gap} місяці',
    many: 'з проміжком у {gap} місяців',
    other: 'з проміжком у {gap} місяця',
  },
  'record.gap.years': {
    one: 'з проміжком в {gap} рік',
    few: 'з проміжком у {gap} роки',
    many: 'з проміжком у {gap} років',
    other: 'з проміжком у {gap} року',
  },
  'record.note.empty': 'Нотатки поки немає',
  'record.noOutline':
    'Контури світу на цій карті нарізані в масштабі 1:110m, а він вписує цю територію в її материнську державу — тому на карті немає чого обвести. Візит усе одно зараховано.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Порядок країн',
  'list.sort.code': 'Код країни',
  'list.sort.codeStatement': 'Упорядковано за кодом країни, від A до Z.',
  'list.sort.name': 'Назва країни',
  'list.sort.nameStatement':
    'Упорядковано за назвою країни, від A до Z, потім за кодом.',
  'list.sort.recent': 'Найновіший візит',
  'list.sort.recentStatement':
    'Спершу найновіший візит, потім за кодом країни.',
  'list.sort.visits': 'Найбільше візитів',
  'list.sort.visitsStatement':
    'Спершу країни з найбільшою кількістю візитів, потім за кодом країни.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Контури світу вписують її в материнську державу, тому на карті немає чого обвести.',
  'list.announce.selected': 'Вибрано: {name}.',
  'list.announce.selectedUnframed': 'Вибрано: {name}. {reason}',
  'list.empty.title': 'На карті поки немає країн',
  'list.empty.body':
    'Країна з’являється тут, щойно за нею записано візит: перше прибуття, останнє й скільки разів ви там були.',
  'list.loading': 'Завантаження відвіданих країн',
  'list.error.title': 'Ваші країни не завантажилися',
  'list.error.body':
    'Атласу не вдалося прочитати ваші відвідані країни. Нічого не втрачено — вони й далі записані.',
  'list.error.retry': 'Спробувати ще раз',
  'list.error.retrying': 'Завантаження ваших країн',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Знайти країну',
  'search.loading': 'Завантаження ваших країн',
  'search.placeholder': 'Назва або код країни',
  'search.entry.notVisited': 'Ще не відвідана',
  'search.entry.noOutline': 'без контуру на карті',
  'search.entry.separator': ' · ',
  'search.cleared': 'Вибір знято.',
  'search.unframed':
    'У {name} немає контуру у світовому масштабі, тому карті немає чого обвести.',
  'search.unframedVisited':
    'У {name} немає контуру у світовому масштабі, тому карті немає чого обвести. Запис про цю країну не зачеплено.',
  'search.results.empty':
    'У вашій історії поки немає країн. Почніть вводити, щоб знайти будь-яку країну світу.',
  'search.results.emptyPinned':
    'Вибрано: {name}. У вашій історії поки немає країн — почніть вводити, щоб знайти будь-яку країну світу.',
  'search.results.record': {
    one: '{countries} країна у вашій історії.',
    few: '{countries} країни у вашій історії.',
    many: '{countries} країн у вашій історії.',
    other: '{countries} країни у вашій історії.',
  },
  'search.results.capped': 'Показано перші {shown}.',
  'search.results.pinned': '{name} вибрано й показано першою.',
  'search.results.none': 'Жодна країна не відповідає {term}.',
  'search.results.matches': {
    one: '{countries} країна відповідає {term}.',
    few: '{countries} країни відповідають {term}.',
    many: '{countries} країн відповідають {term}.',
    other: '{countries} країни відповідає {term}.',
  },
  'search.announce.selected': 'Вибрано: {name}.',
  'search.announce.framing': 'Вибрано: {name}. Карта наводиться на неї.',
  'search.announce.unframed': 'Вибрано: {name}. {reason}',
  'search.empty.title': 'У вашій історії поки порожньо',
  'search.empty.body':
    'Введіть назву країни або її дволітерний код, щоб знайти її на карті.',
  'search.empty.noMatchTitle': 'Жодна країна не відповідає «{term}»',
  'search.empty.noMatchBody':
    'Перевірте написання або спробуйте дволітерний код — PT знайде Португалію. Доступні всі {countries} країн, незалежно від того, чи були ви там.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Ваш запис',
  'actions.visit.absent.title': 'Не відвідана',
  'actions.visit.absent.caption': 'Візит, за яким не стоїть поїздка.',
  'actions.visit.title': 'Відвідана',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Не в списку',
  'actions.goal.absent.caption': 'Місце, куди ви збираєтеся.',
  'actions.goal.title': 'У списку бажань',
  'actions.goal.waiting': 'Чекає своєї черги.',
  'actions.goal.target': 'Мета — {year}.',
  'actions.goal.achieved.title': 'Викреслено зі списку',
  'actions.goal.achieved.caption':
    'Ви дісталися. Запис лишається як свідчення.',

  'actions.button.remove': 'Прибрати',
  'actions.button.mark': 'Позначити візит',
  'actions.button.add': 'Додати до списку',
  'actions.visit.remove.name': 'Прибрати {name} з вашого атласу',
  'actions.visit.remove.busy': 'Прибираємо {name} з вашого атласу',
  'actions.visit.add.name': 'Позначити візит, {name}',
  'actions.visit.add.busy': 'Позначаємо {name} як відвідану',
  'actions.goal.remove.name': 'Прибрати {name} зі списку бажань',
  'actions.goal.remove.busy': 'Прибираємо {name} зі списку бажань',
  'actions.goal.add.name': 'Додати до списку, {name}',
  'actions.goal.add.busy': 'Додаємо {name} до списку бажань',

  'actions.hint':
    'Обидві дії набирають чинності одразу, і обидві можна скасувати тут само.',
  'actions.offline':
    'Пристрою не вдалося зв’язатися з сервером. Перевірте з’єднання і спробуйте ще раз.',
  'actions.toast.marked': 'Позначено як відвідане',
  'actions.toast.markedBody': '{name} тепер у вашому атласі.',
  'actions.toast.markFailed': '{name} не вдалося позначити',
  'actions.toast.unmarked': 'Прибрано з вашого атласу',
  'actions.toast.unmarkedBody': '{name} більше не позначена як відвідана.',
  'actions.toast.unmarkFailed': '{name} не вдалося прибрати',
  'actions.toast.listed': 'Додано до списку бажань',
  'actions.toast.listedBody': '{name} — місце, куди ви збираєтеся.',
  'actions.toast.listFailed': '{name} не вдалося додати',
  'actions.toast.unlisted': 'Прибрано зі списку бажань',
  'actions.toast.unlistedBody': '{name} більше не в списку.',
  'actions.toast.unlistFailed': '{name} не вдалося прибрати',
  'actions.toast.fallback':
    'Зміна не дійшла до сервера. Спробуйте ще раз за хвилину.',

  'actions.confirm.visit.title': 'Прибрати {name} з вашого атласу?',
  'actions.confirm.visit.body': {
    one: '{visits} записаний візит{dates} буде стерто{note}. Ваші поїздки та збережені місця не постраждають.',
    few: '{visits} записані візити{dates} буде стерто{note}. Ваші поїздки та збережені місця не постраждають.',
    many: '{visits} записаних візитів{dates} буде стерто{note}. Ваші поїздки та збережені місця не постраждають.',
    other:
      '{visits} записаного візиту{dates} буде стерто{note}. Ваші поїздки та збережені місця не постраждають.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ' — разом із вашою нотаткою',
  'actions.confirm.goal.title': 'Прибрати {name} зі списку бажань?',
  'actions.confirm.goal.body':
    'Цю країну вже викреслено, тому разом із нею зникне й запис про те, що ви там побували. Ваш атлас і ваші поїздки не постраждають.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Поїздка робочого простору',
    few: 'Поїздки робочого простору',
    many: 'Поїздок робочого простору',
    other: 'Поїздки робочого простору',
  },
  'card.visits': {
    one: 'Візит',
    few: 'Візити',
    many: 'Візитів',
    other: 'Візиту',
  },
  'card.places': {
    one: 'Місце робочого простору',
    few: 'Місця робочого простору',
    many: 'Місць робочого простору',
    other: 'Місця робочого простору',
  },
  'card.firstTrip': 'Перша поїздка',
  'card.lastTrip': 'Остання поїздка',
  'card.firstVisit': 'Перший візит',
  'card.lastVisit': 'Останній візит',
  'card.absent': 'Не записано',
  'card.loading': 'Завантаження цієї країни',
  'card.loadingNamed': 'Завантаження: {name}',
  'card.error.body': 'Ці цифри не завантажилися. Нічого не втрачено.',
  'card.error.retry': 'Спробувати ще раз',
  'overlay.close': 'Закрити {name}',
  'regions.label': 'Регіони',
  'regions.hint':
    'Додавання регіону також позначає країну {country} як відвідану.',
  'regions.keeps':
    'Видалення регіону не прибирає країну {country} з вашого атласу.',
  'regions.keeps.unvisited':
    'Ці регіони залишаться в записах. Позначте країну {country} як відвідану або додайте регіон, щоб повернути її на карту.',
  'regions.empty.title': 'Тут ще немає записаних регіонів',
  'regions.empty.body':
    'Додайте штат, провінцію або область, яку ви відвідали в країні {country}.',
  'regions.input.label': 'Додати регіон у країні {country}',
  'regions.input.placeholder': 'Наприклад, Баварія',
  'regions.add': 'Додати регіон',
  'regions.adding': 'Додавання: {region}',
  'regions.remove': 'Видалити {region}',
  'regions.loading': 'Завантаження ваших регіонів',
  'regions.status.added': 'Додано: {region}',
  'regions.status.exists': '{region} уже є в записах',
  'regions.status.removed': 'Видалено: {region}',
  'regions.status.addedCountry':
    'Додано: {region}. Країну {country} тепер позначено як відвідану.',
  'regions.error.invalid': 'Введіть назву регіону.',
  'regions.error.hidden':
    'Назва містить недопустимі символи. Видаліть їх і спробуйте ще раз.',
  'regions.error.load':
    'Не вдалося завантажити ваші регіони для країни {country}.',
  'regions.error.add': 'Не вдалося додати {region}. Спробуйте ще раз.',
  'regions.error.remove': 'Не вдалося видалити {region}. Спробуйте ще раз.',
  'regions.error.full':
    'Ви записали {limit} регіонів. Видаліть один, щоб додати інший.',
  'regions.reload': 'Завантажити регіони знову',
  'actions.confirm.visitRegions.body': {
    one: '{history}Записані регіони в країні {country} залишаться в записах: {count}.',
    few: '{history}Записані регіони в країні {country} залишаться в записах: {count}.',
    many: '{history}Записані регіони в країні {country} залишаться в записах: {count}.',
    other:
      '{history}Записані регіони в країні {country} залишаться в записах: {count}.',
  },
  'regions.error.uncertain':
    'Не вдалося підтвердити зміну. Завантажте регіони знову, щоб перевірити збережені дані.',
  'regions.status.refreshFailed':
    '{result} Не вдалося оновити атлас. Завантажте його знову, щоб оновити карту.',

  'panel.stat.periodLabel': 'Показати дані за',
  'panel.stat.allTime': 'Увесь час',
  'panel.stat.groupAll': 'Дані за увесь час',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Дані за {year} рік',
  'panel.stat.announceAll': 'Показано дані за увесь час.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Показано дані за {year} рік.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Подорожі з початком у {year} році',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'У подорожах з початком у {year} році',
  'panel.stat.countries': 'Країни у ваших подорожах',
  'panel.stat.countriesCaption': 'Різні країни в цих подорожах',
  'panel.stat.streak': 'Ваша серія років',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'Подорожі щороку, від {first} до {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Подорож у {last} році',
  'panel.stat.streakNone': 'Додайте подорож із датами, щоб почати серію',
  'visitEdit.edit': 'Змінити відвідування',
  'visitEdit.note': 'Нотатка',
  'visitEdit.save': 'Зберегти відвідування',
  'visitEdit.cancel': 'Скасувати',
  'visitEdit.loading': 'Завантаження відвідування',
  'visitEdit.saving': 'Збереження відвідування',
  'visitEdit.failed':
    'Не вдалося підтвердити збереження. Чернетку збережено; спробуй ще раз.',
  'visitEdit.missing': 'Це відвідування вже недоступне. Відкрий країну знову.',
  'visitEdit.noteInvalid': 'Використай не більше 2000 символів.',
  'visitEdit.bounds': 'Перше відвідування не може бути пізніше за останнє.',
  'visitEdit.future': 'Вибери сьогоднішню або ранішу дату.',
  'visitEdit.dateInvalid': 'Вкажи дійсну дату у форматі РРРР-ММ-ДД.',
  'visitEdit.reload': 'Збережено. Оновити запис',
} satisfies TranslationOf<typeof En>

export default messages
