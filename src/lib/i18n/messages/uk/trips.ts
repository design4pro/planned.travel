/**
 * The trip tabs' own copy, in uk.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Множина.** `one` · `few` · `many` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  'notFound.title': 'Не можемо знайти цю подорож',
  'notFound.body':
    'Її немає серед подорожей, які ви можете відкрити в поточному робочому просторі. Можливо, її видалено або ви не маєте до неї доступу.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Додати місце до цієї подорожі',
  'plan.editor.editTitle': 'Змінити це місце',
  'plan.editor.createDescription':
    'Укажіть назву зараз, а розташування пізніше - незаплановане місце чекає на панелі місць, доки ви не додасте його до дня.',
  'plan.editor.editDescription':
    'Зміни діють усюди: на карті, у всіх призначених днях і в переліку місць подорожі.',
  'plan.editor.nameRequired': 'Місцю потрібна назва',
  'plan.editor.nameExample': 'наприклад, Фусімі Інарі Тайся',
  'plan.editor.city': 'Місто',
  'plan.editor.cityExample': 'наприклад, Кіото',
  'plan.editor.addressExample': 'наприклад, Фукакуса Ябуноуті-тьо, 68',
  'plan.editor.duration': 'Час на місці',
  'plan.editor.rating': 'Варто відвідати?',
  'plan.editor.latitude': 'Широта',
  'plan.editor.longitude': 'Довгота',
  'plan.editor.positionHint': 'Або закрийте вікно та виберіть точку на карті.',
  'plan.editor.latitudeError': 'Від -90 до 90',
  'plan.editor.longitudeError': 'Від -180 до 180',
  'plan.editor.positionError': 'Для розташування потрібні обидва числа',
  'plan.editor.day': 'Додати до дня',
  'plan.editor.dayHint':
    'Залиште порожнім, щоб зберегти місце на панелі місць.',
  'plan.editor.unplanned': 'Залишити без плану',
  'plan.editor.dayNamed': 'День {day} · {title}',
  'plan.editor.stopFallback': 'Ця зупинка',
  'plan.editor.dayNumber': 'День {day}',
  'plan.editor.visited': 'Уже відвідано',
  'plan.editor.visitedHint': 'Позначає шпильку галочкою.',
  'plan.editor.saving': 'Збереження місця',
  'plan.editor.save': 'Зберегти зміни',
  'plan.editor.noCategory': 'Без категорії',
  'plan.editor.arrive': 'Прибуття',
  'plan.editor.leave': 'Від’їзд',
  'plan.editor.timeError': 'Від’їзд має бути після прибуття',
  'plan.editor.booking': 'Бронювання',
  'plan.editor.note': 'Нотатка для цієї зупинки',
  'plan.editor.noteExample':
    'Приходьте рано - після 9 ранку черга триває годину.',
  'plan.editor.savingTimes': 'Збереження часу',
  'plan.editor.saveTimes': 'Зберегти',
  'plan.editor.duration0': 'Без фіксованої тривалості',
  'plan.editor.duration30': '30 хвилин',
  'plan.editor.duration45': '45 хвилин',
  'plan.editor.duration60': '1 година',
  'plan.editor.duration90': '1½ години',
  'plan.editor.duration120': '2 години',
  'plan.editor.duration180': '3 години',
  'plan.editor.duration240': 'Пів дня',
  'plan.editor.duration480': 'Цілий день',
  'plan.editor.rating0': 'Без оцінки',
  'plan.editor.rating1': '★ 1 - пропустити',
  'plan.editor.rating2': '★ 2 - якщо буде час',
  'plan.editor.rating3': '★ 3 - варто відвідати',
  'plan.editor.rating4': '★ 4 - дуже добре',
  'plan.editor.rating5': '★ 5 - не пропустіть',
  'plan.editor.bookingNone': 'Бронювання не потрібне',
  'plan.editor.bookingPending': 'Ще треба забронювати',
  'plan.editor.bookingConfirmed': 'Заброньовано й підтверджено',
  'plan.editor.bookingCompleted': 'Відвідування завершено',
  'plan.editor.bookingCancelled': 'Скасовано',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Не вдалося завантажити цю подорож',
  'error.plan': 'Не вдалося завантажити маршрут',
  'error.costs': 'Не вдалося завантажити витрати',
  'error.collab': 'Не вдалося завантажити листування',
  'error.book': 'Не вдалося завантажити бронювання',
  'error.transports': 'Переїзди не завантажилися',
  'error.people': 'Не вдалося завантажити учасників',
  'header.length': {
    one: '{days} день',
    few: '{days} дні',
    many: '{days} днів',
    other: '{days} дня',
  },
  'header.planned': {
    one: '{days} день заплановано',
    few: '{days} дні заплановано',
    many: '{days} днів заплановано',
    other: '{days} дня заплановано',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Маршрут',
  'plan.places': 'Місця',
  'plan.readOnly.archived':
    'Ця подорож в архіві, тому план доступний лише для читання.',
  'plan.readOnly.role':
    'Ви можете переглядати цей план. Змінювати його можуть лише власник подорожі та редактори.',
  'plan.day.empty':
    'Нічого не заплановано — перетягніть сюди місце або нотатку',
  'plan.move.refused.duplicate': '{name} уже є в цьому дні',
  'plan.move.refused.duplicateBody':
    'Місце може бути в дні лише один раз. Перенесіть його в інший день.',
  'plan.move.refused.notInIdeas': 'Нотатка лишається в дні',
  'plan.move.refused.notInIdeasBody':
    'Ідеї — це місця, що чекають на свій день. Нотатка належить дню, для якого її написали.',
  'plan.move.refused.notInAnotherDay': 'Нотатка лишається у своєму дні',
  'plan.move.refused.notInAnotherDayBody':
    'Нотатки поки не можна переносити між днями. Змініть нотатку або напишіть її в іншому дні.',
  'plan.move.refused.journeyNotInIdeas': 'Переїзд лишається в дні',
  'plan.move.refused.journeyNotInIdeasBody':
    'Ідеї — це місця, що чекають на свій день. Переїзд належить дню, у який він відбувається.',
  'plan.move.refused.journeyNotInAnotherDay': 'Переїзд лишається у своєму дні',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'День переїзду визначають його дати. Змініть їх на вкладці «Переїзди».',
  'plan.move.refused.journeyTimed': '{name} вирушає о {time}',
  'plan.move.refused.journeyTimedBody':
    'Час відправлення належить розкладу, а не плану. Поставте переїзд туди, куди його ставить годинник.',
  'plan.move.spoken.duplicate': '{name} не переміщено. У цьому дні він уже є.',
  'plan.move.spoken.notInIdeas':
    '{name} не переміщено. Нотатка лишається в дні.',
  'plan.move.spoken.notInAnotherDay':
    '{name} не переміщено. Нотатка лишається у своєму дні.',
  'plan.move.spoken.timed':
    'У {name} стоїть {time}. Запитуємо, чи прибрати час.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} не переміщено. Переїзд лишається в дні.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} не переміщено. Переїзд лишається у своєму дні.',
  'plan.move.spoken.journeyTimed': '{name} не переміщено. Вирушає о {time}.',
  'plan.move.error.save': 'Переміщення не збереглося',
  'plan.move.error.retry': 'Спробуйте ще раз за хвилину.',
  'plan.move.dropTime.title': 'Перемістити {name} і прибрати {time}?',
  'plan.move.dropTime.body':
    'Це місце суперечить зазначеному часу. Перенесення сюди стирає час — новий порядок і стертий час зберігаються разом.',
  'plan.move.dropTime.confirm': 'Перемістити й прибрати час',
  'plan.move.dropTime.cancel': 'Залишити на місці',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Додати нотатку',
  'plan.note.addForDay': 'Додати нотатку, {day}',
  'plan.addPlace.label': 'Додати місце',
  'plan.addPlace.more': 'Інші способи додати місце',
  'plan.addPlace.option.map': 'Поставити на мапу',
  'plan.addPlace.forDayNamed': 'Додати місце, {day}',
  'plan.addPlace.quota':
    'Ви досягли ліміту місць у вашому тарифі. Перейдіть на вищий тариф, щоб додати більше.',
  'plan.addPlace.quotaAction': 'Переглянути тарифи',
  'plan.stay.checkIn': 'Заїзд',
  'plan.stay.checkOut': 'Виїзд',
  'plan.day.addStay': 'Додати проживання, {day}',
  'plan.day.addStayShort': 'Додати проживання',
  'plan.handoff.stop':
    'Відкрити {place} у {service} (відкриється в новій вкладці)',
  'plan.handoff.day.directions': 'Маршрут у {service}',
  'plan.handoff.day.directionsName':
    'Маршрут у {service}: {day} (відкриється в новій вкладці)',
  'plan.handoff.day.directionsPartial': 'Зупинки: перші {carried} із {total}',
  'plan.handoff.day.directionsPartialName':
    'Маршрут у {service}: {day}, зупинки: перші {carried} із {total} (відкриється в новій вкладці)',
  'plan.handoff.day.point': 'Показати у {service}',
  'plan.handoff.day.pointName':
    'Показати у {service}: єдина зупинка на мапі, {day} (відкриється в новій вкладці)',
  'plan.drop.hint':
    'Клацніть мапу правою кнопкою миші або натисніть і утримуйте, щоб додати місце саме там.',
  'plan.drop.armed':
    'Клацніть мапу там, де воно має бути, або посуньте мапу й натисніть Enter, щоб поставити його в центрі.',
  'plan.drop.stop': 'Припинити розміщення нової шпильки',
  'plan.drop.pin': 'Нове місце',
  'plan.drop.lookingUp': 'Шукаємо адресу…',
  'plan.drop.error':
    'Не вдалося поставити мітку. Спробуйте ще раз трохи згодом.',
  'plan.place.pastedPosition': 'Розпізнано: широта {lat}, довгота {lng}',
  'plan.note.showMore': 'Показати більше',
  'plan.note.showLess': 'Показати менше',
  'plan.note.moveUp': 'Перемістити вгору',
  'plan.note.moveDown': 'Перемістити вниз',
  'plan.note.drag': 'Змінити порядок нотатки',
  'plan.note.edit': 'Редагувати нотатку',
  'plan.note.delete': 'Видалити нотатку',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Додати нотатку',
  'plan.note.dialog.editTitle': 'Редагувати нотатку',
  'plan.note.field.body': 'Нотатка',
  'plan.note.field.bodyHint': 'Один рядок. Саме його показує день.',
  'plan.note.field.detail': 'Подробиці',
  'plan.note.field.detailHint':
    'Заголовки, списки, посилання, цитати, код і таблиці.',
  'plan.note.field.time': 'Час',
  'plan.note.field.timeHint': 'Необов’язково, у 24-годинному форматі.',
  'plan.note.field.icon': 'Значок',
  'plan.note.tab.write': 'Текст',
  'plan.note.tab.preview': 'Попередній перегляд',
  'plan.note.previewEmpty': 'Поки немає чого переглядати',
  'plan.note.save': 'Зберегти нотатку',
  'plan.note.cancel': 'Скасувати',
  'plan.note.confirmDelete': 'Видалити цю нотатку?',
  'plan.note.confirmDeleteBody':
    'Нотатка та її подробиці зникнуть із цього дня.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Нотатку додано',
  'plan.note.toast.updated': 'Нотатку збережено',
  'plan.note.toast.deleted': 'Нотатку видалено',
  'plan.note.error.save': 'Нотатку не вдалося зберегти',
  'plan.note.error.delete': 'Нотатку не вдалося видалити',
  'plan.note.error.retry': 'Спробуйте ще раз за хвилину.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Нагадування',
  'plan.note.icon.clock': 'Час',
  'plan.note.icon.flashlight': 'Ліхтарик',
  'plan.note.icon.footprints': 'Прогулянка',
  'plan.note.icon.info': 'Інформація',
  'plan.note.icon.luggage': 'Багаж',
  'plan.note.icon.package': 'Посилка',
  'plan.note.icon.ticket': 'Квитки',
  'plan.note.icon.trainFront': 'Потяг',
  'plan.note.icon.wifi': 'Інтернет',
  'plan.note.icon.stickyNote': 'Нотатка',
  'plan.note.icon.utensils': 'Їжа',
  'plan.note.icon.bus': 'Транспорт',
  'plan.note.icon.bedDouble': 'Ночівля',
  'plan.note.icon.camera': 'Фото',
  'plan.note.icon.mapPin': 'Місце',
  'plan.note.icon.wallet': 'Гроші',
  'plan.note.icon.umbrella': 'Дощ',
  'plan.note.icon.triangleAlert': 'Попередження',
  'plan.transport.phase.flight.departing': 'Виліт',
  'plan.transport.phase.flight.travelling': 'У повітрі',
  'plan.transport.phase.flight.arriving': 'Посадка',
  'plan.transport.phase.hire.departing': 'Отримання',
  'plan.transport.phase.hire.travelling': 'В оренді',
  'plan.transport.phase.hire.arriving': 'Повернення',
  'plan.transport.phase.journey.departing': 'Початок',
  'plan.transport.phase.journey.travelling': 'У дорозі',
  'plan.transport.phase.journey.arriving': 'Кінець',
  'plan.transport.label': 'З {from} до {to}',
  'plan.transport.drag': 'Змінити порядок, {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Разом',
  'collab.empty': 'Ще нічим не поділилися',
  'collab.conversation': 'Листування',
  'collab.count.messages': {
    one: '{messages} повідомлення',
    few: '{messages} повідомлення',
    many: '{messages} повідомлень',
    other: '{messages} повідомлення',
  },
  'collab.count.notes': {
    one: '{notes} нотатка',
    few: '{notes} нотатки',
    many: '{notes} нотаток',
    other: '{notes} нотатки',
  },
  'collab.count.polls': {
    one: '{polls} опитування',
    few: '{polls} опитування',
    many: '{polls} опитувань',
    other: '{polls} опитування',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Бронювання',
  'book.empty': 'Ще нічого не заброньовано',
  'book.count.bookings': {
    one: '{bookings} бронювання',
    few: '{bookings} бронювання',
    many: '{bookings} бронювань',
    other: '{bookings} бронювання',
  },
  'book.count.confirmed': {
    one: '{confirmed} підтверджено',
    few: '{confirmed} підтверджено',
    many: '{confirmed} підтверджено',
    other: '{confirmed} підтверджено',
  },
  'book.progressLabel': {
    one: '{confirmed} з {total} бронювання підтверджено',
    few: '{confirmed} з {total} бронювань підтверджено',
    many: '{confirmed} з {total} бронювань підтверджено',
    other: '{confirmed} з {total} бронювань підтверджено',
  },
  'book.ofTotal': 'з {total}',
  'book.confirmed': 'Підтверджені',
  'book.awaiting': 'Очікує підтвердження',
  'book.nothingHanging': 'Нічого не висить',
  'book.chase': 'Владнайте це до вильоту',
  'book.committed': 'Зобовʼязання',
  'book.committedCaption': 'З усіх бронювань цієї подорожі',
  'book.onItinerary': 'У маршруті',
  'book.pinnedCaption': 'Закріплено за днем маршруту',
  'book.readOnly.archived':
    'Ця подорож в архіві, тому бронювання та проживання доступні лише для читання. Відновіть подорож, щоб їх змінити.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Цю зміну відхилено. Перевірте поточний стан подорожі перед наступними змінами.',
  'transports.recovery.failed':
    'Не вдалося оновити подорож. Спробуйте ще раз перед внесенням змін.',
  'transports.readOnly.archived':
    'Цю подорож архівовано. Відновіть її, щоб змінити транспорт.',
  'transports.title': 'Переїзди',
  'transports.empty': 'Поки нічого не записано',
  'transports.count.transports': {
    one: '{transports} переїзд',
    few: '{transports} переїзди',
    many: '{transports} переїздів',
    other: '{transports} переїзду',
  },
  'transports.distance': 'Пройдена відстань',
  'transports.equator': '≈ {times}× навколо екватора',
  'transports.noGrouping': 'Поки нічого не згруповано',
  'transports.mostly': 'здебільшого {mode}',
  'transports.confirmed': 'Підтверджено',
  'transports.stillPending': {
    one: '{pending} ще очікує',
    few: '{pending} ще очікують',
    many: '{pending} ще очікує',
    other: '{pending} ще очікує',
  },
  'transports.spent': 'Витрачено на дорогу',
  'transports.noPrices': 'Цін не записано',
  'transports.priced': {
    one: 'за {priced} переїздом із ціною',
    few: 'за {priced} переїздами із ціною',
    many: 'за {priced} переїздами із ціною',
    other: 'за {priced} переїздами із ціною',
  },
  'people.title': 'Учасники',
  'people.description': 'Хто в цій подорожі і хто може її знайти',
  'people.members.title': 'У цій подорожі',
  'people.members.empty': 'Нікого з цієї подорожі вже немає в цьому просторі',
  'people.role.label': 'Роль',
  'people.role.owner': 'Власник',
  'people.role.editor': 'Редактор',
  'people.role.viewer': 'Читач',
  'people.you': 'Ви',
  'people.owner.hint': 'У подорожі завжди лишається принаймні один власник',
  'people.remove.action': 'Прибрати {name} з цієї подорожі',
  'people.remove.title': 'Прибрати {name} з цієї подорожі?',
  'people.remove.body':
    'Доступ до маршруту зникне одразу. Усе, що людина додала, лишається в подорожі.',
  'people.remove.confirm': 'Прибрати',
  'people.leave.action': 'Покинути цю подорож',
  'people.leave.title': 'Покинути цю подорож?',
  'people.leave.body':
    'Ви втратите доступ до маршруту, доки хтось із подорожі не додасть вас знову.',
  'people.leave.confirm': 'Покинути',
  'people.cancel': 'Скасувати',
  'people.invite.title': 'Додати людину',
  'people.invite.placeholder': 'Пошук людей у цьому просторі',
  'people.invite.action': 'Додати до подорожі',
  'people.invite.role': 'Приєднується як',
  'people.invite.empty': 'Усі в цьому просторі вже в цій подорожі',
  'people.invite.emptyHint':
    'Спершу нова людина приєднується до простору, у налаштуваннях',
  'people.visibility.title': 'Хто може знайти цю подорож',
  'people.visibility.switch': 'Видима всім у просторі',
  'people.visibility.private': 'Цю подорож бачать лише перелічені тут люди',
  'people.visibility.organization':
    'Будь-хто в цьому просторі може відкрити цю подорож',
  'people.visibility.public': 'Ця подорож доступна за публічним посиланням',
  'people.error.lastOwner':
    'У подорожі лишається принаймні один власник. Спершу зробіть власником когось іншого.',
  'people.error.notInWorkspace': 'Цієї людини немає в цьому просторі',
  'people.error.alreadyOnTrip': 'Ця людина вже в цій подорожі',
  'people.guests.title': 'Подорожують із вами',
  'people.guests.description': 'Учасники подорожі без облікового запису',
  'people.guests.empty': 'Поки нікого',
  'people.guests.emptyHint':
    'Гість — це той, хто подорожує з вами й не потребує облікового запису. Додайте його за іменем.',
  'people.guest.badge': 'Гість',
  'people.guest.add.label': 'Ім’я',
  'people.guest.add.placeholder': 'Оксана',
  'people.guest.add.action': 'Додати гостя',
  'people.guest.rename.action': 'Перейменувати: {name}',
  'people.guest.rename.title': 'Перейменувати: {name}',
  'people.guest.rename.confirm': 'Перейменувати',
  'people.guest.remove.action': 'Прибрати {name} з подорожі',
  'people.guest.remove.title': 'Прибрати {name} з подорожі?',
  'people.guest.remove.body':
    'Гість зникне зі списку. Більше в подорожі нічого не зміниться.',
  'people.guest.remove.confirm': 'Прибрати',
  'people.guest.merge.action': '{name} — тепер…',
  'people.guest.merge.title': '{name} — тепер один з учасників подорожі',
  'people.guest.merge.body':
    'Усе, що призначено на {name}, перейде до обраної людини, а гість зникне. Скасувати це неможливо.',
  'people.guest.merge.inherits': '{member} отримає все, що призначено {name}.',
  'people.guest.merge.placeholder': 'Оберіть когось із подорожі',
  'people.guest.merge.confirm': 'Об’єднати',
  'people.guest.merge.done': '{name} — тепер {member}',
  'people.guest.merge.nothingMoved':
    'На цього гостя ще нічого не було призначено',
  'people.error.guestNameTaken': 'Гість з іменем {name} уже є в цій подорожі',
  'people.error.guestLimit':
    'У подорожі може бути щонайбільше {limit} гостей: довший список ускладнює вибір учасників і читання розподілу витрат',
  'people.error.guestMergeTarget':
    'Оберіть когось, хто вже бере участь у подорожі',
  'plan.weather.badge.forecast':
    'Прогноз: {condition}, максимум {max}, мінімум {min}',
  'plan.weather.badge.forecastNoCondition':
    'Прогноз: максимум {max}, мінімум {min}',
  'plan.weather.badge.unavailable': 'Погода на цей день недоступна',
  'plan.weather.badge.loading': 'Завантаження погоди',
  'plan.weather.badge.recorded': 'Зафіксовано: максимум {max}, мінімум {min}',
  'plan.weather.badge.recordedHigh': 'Зафіксовано: максимум {max}',
  'plan.weather.badge.recordedLow': 'Зафіксовано: мінімум {min}',
  'plan.weather.badge.estimate':
    'Оцінка: типовий максимум {max}, мінімум {min}',
  'plan.weather.badge.estimateHigh': 'Оцінка: типовий максимум {max}',
  'plan.weather.badge.estimateLow': 'Оцінка: типовий мінімум {min}',
  'plan.weather.badge.notYetRecorded': 'Ще не зафіксовано',
  'plan.weather.condition.clear': 'Ясно',
  'plan.weather.condition.fair': 'Малохмарно',
  'plan.weather.condition.partlyCloudy': 'Мінлива хмарність',
  'plan.weather.condition.cloudy': 'Хмарно',
  'plan.weather.condition.fog': 'Туман',
  'plan.weather.condition.rain': 'Дощ',
  'plan.weather.condition.heavyRain': 'Сильний дощ',
  'plan.weather.condition.sleet': 'Мокрий сніг',
  'plan.weather.condition.snow': 'Сніг',
  'plan.weather.condition.thunder': 'Гроза',
  'plan.weather.panel.title': 'Погода на {date}',
  'plan.weather.panel.temperature': 'Макс. / мін.',
  'plan.weather.panel.precipitation': 'Опади',
  'plan.weather.panel.precipitationTypical': 'Типові опади за день',
  'plan.weather.panel.probability': 'імовірність {percent}',
  'plan.weather.panel.wind': 'Вітер',
  'plan.weather.panel.sunrise': 'Схід сонця',
  'plan.weather.panel.sunset': 'Захід сонця',
  'plan.weather.panel.noSunrise': 'Немає сходу сонця',
  'plan.weather.panel.noSunset': 'Немає заходу сонця',
  'plan.weather.panel.slots': 'Протягом дня',
  'plan.weather.panel.slot.night': 'Ніч',
  'plan.weather.panel.slot.morning': 'Ранок',
  'plan.weather.panel.slot.afternoon': 'День',
  'plan.weather.panel.slot.evening': 'Вечір',
  'plan.weather.panel.high': 'Максимум',
  'plan.weather.panel.low': 'Мінімум',
  'plan.weather.panel.recordedNote': 'Виміряні значення за цей день.',
  'plan.weather.panel.temperatureTypical': 'Типові макс. / мін.',
  'plan.weather.panel.estimateNote':
    'Багаторічне середнє за цей місяць, а не прогноз.',
  'plan.weather.attribution.metNorway': 'Дані прогнозу: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Дані: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Змінити ширину маршруту',
  'plan.workspace.resizePlaces': 'Змінити ширину місць',
  'plan.workspace.toggleDay': 'Розгорнути або згорнути {day}',
  'plan.workspace.days': 'Дні',
  'plan.workspace.showPanel': 'Показати панель {label}',
  'plan.workspace.hidePanel': 'Приховати панель {label}',
  'plan.workspace.narrowPanel': 'Звузити {label}',
  'plan.workspace.widenPanel': 'Розширити {label}',
  'collab.sections.tabsLabel': 'Розділи співпраці',
  'collab.sections.trigger': 'Вибрати розділи',
  'collab.sections.menuLabel': 'Показувати всім учасникам подорожі',
  'collab.sections.keepOne': 'Принаймні один розділ має залишатися ввімкненим.',
  'collab.sections.failed': 'Зміну не збережено',
  'collab.sections.failedBody': 'Меню показує поточний збережений стан.',
  'collab.sections.someHidden': 'Деякі розділи приховані в цій подорожі.',
  'collab.sections.turnedOff':
    'Цей розділ вимкнено для подорожі. Він закриється, коли ви надішлете або очистите текст, який пишете.',
  'collab.sections.changed': 'Розділи цієї подорожі змінилися.',
  'collab.sections.savedHidden':
    'Збережено. Цей розділ прихований для подорожі й зараз закриється.',
  'plan.place.error.save':
    'Не вдалося зберегти місце. Спробуйте ще раз за хвилину.',
  'plan.stop.error.saveTimes':
    'Не вдалося зберегти час зупинки. Спробуйте ще раз за хвилину.',
  'plan.place.error.delete':
    'Не вдалося видалити місце. Спробуйте ще раз за хвилину.',
  'plan.pin.error.move':
    'Не вдалося перемістити позначку. Спробуйте ще раз за хвилину.',
  'plan.place.toast.created': 'Місце додано',
  'plan.place.toast.updated': 'Місце оновлено',
  'plan.stop.toast.timesSaved': 'Час зупинки збережено',
  'plan.place.toast.deleted': 'Місце видалено',
  'plan.pin.toast.moved': '{name}: позначку встановлено',
  'join.page.title': 'Посилання-запрошення в поїздку',
  'join.page.description':
    'Відкрийте це посилання, щоб приєднатися до спільної поїздки в planned.travel.',
  'join.title.invited': '{inviter} запрошує вас у поїздку',
  'join.requirement':
    'Це посилання працює для тих, хто вже перебуває в просторі користувача {inviter}.',
  'join.newHere':
    'Вперше тут? Спершу попросіть {inviter} додати вас до простору.',
  'join.trip.label': 'Поїздка',
  'join.role.label': 'Ви приєднаєтеся як',
  'join.dates.label': 'Дати',
  'join.destination.label': 'Пункт призначення',
  'join.action.signIn': 'Увійти',
  'join.action.join': 'Приєднатися до поїздки',
  'join.action.joining': 'Приєднуємося до поїздки',
  'join.action.open': 'Відкрити поїздку',
  'join.action.openIn': 'Відкрити поїздку й змінити простір',
  'join.action.openIn.pending': 'Змінюємо простір',
  'join.loading': 'Завантажуємо запрошення',
  'join.joined.title': 'Ви в поїздці',
  'join.joined.body': 'Відкрийте її, щоб побачити план.',
  'join.member.title': 'Ви вже берете участь у цій поїздці',
  'join.needsWorkspace.title': 'Ця поїздка в просторі, до якого ви не належите',
  'join.needsWorkspace.body':
    'Спершу попросіть {inviter} додати вас до простору, а потім знову відкрийте це посилання.',
  'join.needsWorkspace.signedInAs':
    'Ви увійшли як {email}. Попросіть {inviter} використати цю адресу.',
  'join.needsWorkspace.acceptFirst':
    'Якщо у вас уже є лист із запрошенням до простору, спершу прийміть його, а потім знову відкрийте це посилання.',
  'join.needsWorkspace.otherAccount': 'Увійти з іншим обліковим записом',
  'join.unavailable.title': 'Це посилання-запрошення недоступне',
  'join.unavailable.body':
    'Можливо, посилання замінили або вимкнули. Попросіть нове в того, хто його надіслав.',
  'join.unavailable.signIn': 'Увійти',
  'join.unavailable.trips': 'Перейти до ваших поїздок',
  'join.error.title': 'Не вдалося завантажити це посилання-запрошення',
  'join.error.retry': 'Повторити',
  'join.error.busy':
    'Сторінка зараз перевантажена. Спробуйте ще раз за хвилину.',
  'join.error.join':
    'Не вдалося приєднатися. Посилання досі працює, спробуйте ще раз.',
  'join.error.switch': 'Не вдалося змінити простір. Спробуйте ще раз.',

  'invite.title': 'Посилання-запрошення',
  'invite.description':
    'Кожен учасник цього простору, який відкриє посилання, приєднається до подорожі.',
  'invite.empty.title': 'Посилання ще немає',
  'invite.empty.body':
    'Створіть посилання та надішліть у груповий чат, щоб учасники цього простору могли приєднатися.',
  'invite.action.create': 'Створити посилання',
  'invite.link.label': 'Посилання-запрошення',
  'invite.copy': 'Копіювати посилання',
  'invite.copied': 'Посилання скопійовано',
  'invite.copyFailed':
    'Не вдалося скопіювати. Виділіть посилання й скопіюйте вручну.',
  'invite.switch.label': 'Кожен учасник простору з посиланням може приєднатися',
  'invite.switch.onHint':
    'Вимкнення робить посилання недійсним для всіх, зокрема вже надіслані копії.',
  'invite.switch.offHint':
    'Увімкнення створює нове посилання. Попередні залишаються недійсними.',
  'invite.off.body':
    'Посилання вимкнено. Ніхто не може приєднатися через нього.',
  'invite.uses': {
    one: 'Приєдналися за посиланням: {count}',
    few: 'Приєдналися за посиланням: {count}',
    many: 'Приєдналися за посиланням: {count}',
    other: 'Приєдналися за посиланням: {count}',
  },
  'invite.uses.never': 'За цим посиланням ще ніхто не приєднався.',
  'invite.lastUsed': 'Останнє приєднання: {when}',
  'invite.role.upgrade.title': 'Надати права редактора?',
  'invite.role.upgrade.body':
    'Це стосується всіх надісланих копій і тих, хто приєднається відтепер.',
  'invite.role.upgrade.confirm': 'Надати права редактора',
  'invite.replace.action': 'Замінити посилання',
  'invite.replace.title': 'Замінити це посилання?',
  'invite.replace.body':
    'Старе посилання негайно перестане працювати для всіх. Ті, хто вже приєднався, залишаться в подорожі; за потреби видаліть їх зі списку нижче.',
  'invite.replace.deadBody':
    'Старе посилання більше не працює. Ті, хто вже приєднався, залишаються в подорожі.',
  'invite.replace.confirm': 'Замінити посилання',
  'invite.replace.pending': 'Заміна посилання',
  'invite.stale': 'Це посилання більше не працює. Замініть його.',
  'invite.creatorGone':
    'Посилання не працює, бо його творець більше не власник. Замініть його.',
  'invite.archived':
    'Подорож в архіві. Посилання знову запрацює після відновлення подорожі.',
  'invite.announce.created': 'Посилання-запрошення створено',
  'invite.announce.roleEditor': 'Нові учасники отримають права редактора',
  'invite.announce.off': 'Посилання-запрошення вимкнено',
  'invite.announce.newLink':
    'Нове посилання готове. Скопіюйте та надішліть його знову.',
  'invite.announce.roleViewer': 'Нові учасники отримають права перегляду',
  'invite.error.title': 'Не вдалося завантажити посилання',
  'invite.error.retry': 'Спробувати знову',
  'invite.refusal.archived': 'Подорож в архіві.',
  'invite.refusal.notOwner': 'Лише власник подорожі може змінити посилання.',
  'invite.refusal.changed': 'Хтось змінив посилання. Показано поточне.',
  'invite.announce.recovered':
    'Показано поточні налаштування посилання. Перевірте їх перед наступною зміною.',
} satisfies TranslationOf<typeof En>

export default messages
