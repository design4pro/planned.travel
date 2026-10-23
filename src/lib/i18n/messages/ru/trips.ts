/**
 * The trip tabs' own copy, in ru.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Множественное число.** `one` · `few` · `many` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  'notFound.title': 'Не можем найти эту поездку',
  'notFound.body':
    'Её нет среди поездок, которые вы можете открыть в текущем рабочем пространстве. Возможно, она удалена или у вас нет к ней доступа.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Добавить место в эту поездку',
  'plan.editor.editTitle': 'Изменить это место',
  'plan.editor.createDescription':
    'Укажите название сейчас, а положение позже - незапланированное место ждёт в панели мест, пока вы не добавите его в день.',
  'plan.editor.editDescription':
    'Изменения действуют везде: на карте, во всех назначенных днях и в списке мест поездки.',
  'plan.editor.nameRequired': 'Месту нужно название',
  'plan.editor.nameExample': 'например, Фусими Инари Тайся',
  'plan.editor.city': 'Город',
  'plan.editor.cityExample': 'например, Киото',
  'plan.editor.addressExample': 'например, Фукакуса Ябуноути-тё, 68',
  'plan.editor.duration': 'Время на месте',
  'plan.editor.rating': 'Стоит посетить?',
  'plan.editor.latitude': 'Широта',
  'plan.editor.longitude': 'Долгота',
  'plan.editor.positionHint': 'Или закройте окно и выберите точку на карте.',
  'plan.editor.latitudeError': 'От -90 до 90',
  'plan.editor.longitudeError': 'От -180 до 180',
  'plan.editor.positionError': 'Для положения нужны оба числа',
  'plan.editor.day': 'Добавить в день',
  'plan.editor.dayHint':
    'Оставьте пустым, чтобы сохранить место в панели мест.',
  'plan.editor.unplanned': 'Оставить без плана',
  'plan.editor.dayNamed': 'День {day} · {title}',
  'plan.editor.stopFallback': 'Эта остановка',
  'plan.editor.dayNumber': 'День {day}',
  'plan.editor.visited': 'Уже посещено',
  'plan.editor.visitedHint': 'Отмечает метку галочкой.',
  'plan.editor.saving': 'Сохранение места',
  'plan.editor.save': 'Сохранить изменения',
  'plan.editor.noCategory': 'Без категории',
  'plan.editor.arrive': 'Прибытие',
  'plan.editor.leave': 'Отъезд',
  'plan.editor.timeError': 'Отъезд должен быть позже прибытия',
  'plan.editor.booking': 'Бронирование',
  'plan.editor.note': 'Заметка для этой остановки',
  'plan.editor.noteExample': 'Приходите рано - после 9 утра очередь на час.',
  'plan.editor.savingTimes': 'Сохранение времени',
  'plan.editor.saveTimes': 'Сохранить',
  'plan.editor.duration0': 'Без фиксированной длительности',
  'plan.editor.duration30': '30 минут',
  'plan.editor.duration45': '45 минут',
  'plan.editor.duration60': '1 час',
  'plan.editor.duration90': '1½ часа',
  'plan.editor.duration120': '2 часа',
  'plan.editor.duration180': '3 часа',
  'plan.editor.duration240': 'Полдня',
  'plan.editor.duration480': 'Целый день',
  'plan.editor.rating0': 'Без оценки',
  'plan.editor.rating1': '★ 1 - пропустить',
  'plan.editor.rating2': '★ 2 - если будет время',
  'plan.editor.rating3': '★ 3 - стоит посетить',
  'plan.editor.rating4': '★ 4 - очень хорошо',
  'plan.editor.rating5': '★ 5 - не пропустите',
  'plan.editor.bookingNone': 'Бронирование не нужно',
  'plan.editor.bookingPending': 'Предстоит забронировать',
  'plan.editor.bookingConfirmed': 'Забронировано и подтверждено',
  'plan.editor.bookingCompleted': 'Посещение завершено',
  'plan.editor.bookingCancelled': 'Отменено',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Не удалось загрузить эту поездку',
  'error.plan': 'Не удалось загрузить маршрут',
  'error.costs': 'Не удалось загрузить расходы',
  'error.collab': 'Не удалось загрузить переписку',
  'error.book': 'Не удалось загрузить брони',
  'error.transports': 'Переезды не загрузились',
  'error.people': 'Не удалось загрузить участников',
  'header.length': {
    one: '{days} день',
    few: '{days} дня',
    many: '{days} дней',
    other: '{days} дня',
  },
  'header.planned': {
    one: '{days} день запланирован',
    few: '{days} дня запланировано',
    many: '{days} дней запланировано',
    other: '{days} дня запланировано',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Маршрут',
  'plan.places': 'Места',
  'plan.readOnly.archived':
    'Эта поездка в архиве, поэтому план доступен только для чтения.',
  'plan.readOnly.role':
    'Вы можете просматривать этот план. Изменять его могут только владелец поездки и редакторы.',
  'plan.day.empty':
    'Ничего не запланировано — перетащите сюда место или заметку',
  'plan.move.refused.duplicate': '{name} уже есть в этом дне',
  'plan.move.refused.duplicateBody':
    'Место может быть в дне только один раз. Перенесите его в другой день.',
  'plan.move.refused.notInIdeas': 'Заметка остаётся внутри дня',
  'plan.move.refused.notInIdeasBody':
    'Идеи — это места, ждущие своего дня. Заметка всегда принадлежит какому-нибудь дню.',
  'plan.move.refused.journeyNotInIdeas': 'Переезд остаётся внутри дня',
  'plan.move.refused.journeyNotInIdeasBody':
    'Идеи — это места, ждущие своего дня. Переезд принадлежит дню, в который он происходит.',
  'plan.move.refused.journeyNotInAnotherDay': 'Переезд остаётся в своём дне',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'День переезда определяется его датами. Измените их на вкладке «Переезды».',
  'plan.move.refused.journeyTimed': '{name} отправляется в {time}',
  'plan.move.refused.journeyTimedBody':
    'Время отправления принадлежит расписанию, а не плану. Поставьте переезд туда, куда его ставят часы.',
  'plan.move.spoken.duplicate': '{name} не перемещён. В этом дне он уже есть.',
  'plan.move.spoken.notInIdeas':
    '{name} не перемещён. Заметка остаётся внутри дня.',
  'plan.move.spoken.timed':
    'У {name} стоит {time}. Спрашиваем, убрать ли время.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} не перемещён. Переезд остаётся внутри дня.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} не перемещён. Переезд остаётся в своём дне.',
  'plan.move.spoken.journeyTimed': '{name} не перемещён. Отправление в {time}.',
  'plan.move.error.save': 'Перемещение не сохранилось',
  'plan.move.error.retry': 'Попробуйте ещё раз через минуту.',
  'plan.move.dropTime.title': 'Переместить {name} и убрать {time}?',
  'plan.move.dropTime.body':
    'Это место противоречит указанному времени. Перенос сюда стирает время — новый порядок и стёртое время сохраняются вместе.',
  'plan.move.dropTime.confirm': 'Переместить и убрать время',
  'plan.move.dropTime.cancel': 'Оставить на месте',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Добавить заметку',
  'plan.note.addForDay': 'Добавить заметку, {day}',
  'plan.addPlace.label': 'Добавить место',
  'plan.addPlace.more': 'Другие способы добавить место',
  'plan.addPlace.option.map': 'Поставить на карту',
  'plan.addPlace.forDayNamed': 'Добавить место, {day}',
  'plan.addPlace.quota':
    'Вы достигли лимита мест в вашем тарифе. Перейдите на более высокий тариф, чтобы добавить ещё.',
  'plan.addPlace.quotaAction': 'Посмотреть тарифы',
  'plan.stay.checkIn': 'Заезд',
  'plan.stay.checkOut': 'Выезд',
  'plan.day.addStay': 'Добавить проживание, {day}',
  'plan.day.addStayShort': 'Добавить проживание',
  'plan.handoff.stop':
    'Открыть {place} в {service} (откроется в новой вкладке)',
  'plan.handoff.day.directions': 'Маршрут в {service}',
  'plan.handoff.day.directionsName':
    'Маршрут в {service}: {day} (откроется в новой вкладке)',
  'plan.handoff.day.directionsPartial':
    'Остановки: первые {carried} из {total}',
  'plan.handoff.day.directionsPartialName':
    'Маршрут в {service}: {day}, остановки: первые {carried} из {total} (откроется в новой вкладке)',
  'plan.handoff.day.point': 'Показать в {service}',
  'plan.handoff.day.pointName':
    'Показать в {service}: единственная остановка на карте, {day} (откроется в новой вкладке)',
  'plan.drop.hint':
    'Щёлкните по карте правой кнопкой мыши или нажмите и удерживайте, чтобы добавить место именно там.',
  'plan.drop.armed':
    'Щёлкните по карте там, где оно должно быть, или сдвиньте карту и нажмите Enter, чтобы поставить его в центре.',
  'plan.drop.stop': 'Прекратить размещение новой булавки',
  'plan.drop.pin': 'Новое место',
  'plan.drop.lookingUp': 'Ищем адрес…',
  'plan.drop.error':
    'Не удалось поставить метку. Попробуйте ещё раз чуть позже.',
  'plan.place.pastedPosition': 'Распознано: широта {lat}, долгота {lng}',
  'plan.note.showMore': 'Показать больше',
  'plan.note.showLess': 'Показать меньше',
  'plan.note.moveUp': 'Переместить вверх',
  'plan.note.moveDown': 'Переместить вниз',
  'plan.note.drag': 'Изменить порядок заметки',
  'plan.note.edit': 'Изменить заметку',
  'plan.note.delete': 'Удалить заметку',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Добавить заметку',
  'plan.note.dialog.editTitle': 'Изменить заметку',
  'plan.note.field.body': 'Заметка',
  'plan.note.field.bodyHint': 'Одна строка. Именно её показывает день.',
  'plan.note.field.detail': 'Подробности',
  'plan.note.field.detailHint':
    'Заголовки, списки, ссылки, цитаты, код и таблицы.',
  'plan.note.field.time': 'Время',
  'plan.note.field.timeHint': 'Необязательно, в 24-часовом формате.',
  'plan.note.field.icon': 'Значок',
  'plan.note.tab.write': 'Текст',
  'plan.note.tab.preview': 'Предпросмотр',
  'plan.note.previewEmpty': 'Пока нечего показать',
  'plan.note.save': 'Сохранить заметку',
  'plan.note.cancel': 'Отмена',
  'plan.note.confirmDelete': 'Удалить эту заметку?',
  'plan.note.confirmDeleteBody':
    'Заметка и её подробности исчезнут из этого дня.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Заметка добавлена',
  'plan.note.toast.updated': 'Заметка сохранена',
  'plan.note.toast.deleted': 'Заметка удалена',
  'plan.note.error.save': 'Заметку не удалось сохранить',
  'plan.note.error.delete': 'Заметку не удалось удалить',
  'plan.note.error.retry': 'Попробуйте ещё раз через минуту.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Напоминание',
  'plan.note.icon.clock': 'Время',
  'plan.note.icon.flashlight': 'Фонарик',
  'plan.note.icon.footprints': 'Прогулка',
  'plan.note.icon.info': 'Информация',
  'plan.note.icon.luggage': 'Багаж',
  'plan.note.icon.package': 'Посылка',
  'plan.note.icon.ticket': 'Билеты',
  'plan.note.icon.trainFront': 'Поезд',
  'plan.note.icon.wifi': 'Интернет',
  'plan.note.icon.stickyNote': 'Заметка',
  'plan.note.icon.utensils': 'Еда',
  'plan.note.icon.bus': 'Транспорт',
  'plan.note.icon.bedDouble': 'Ночлег',
  'plan.note.icon.camera': 'Фото',
  'plan.note.icon.mapPin': 'Место',
  'plan.note.icon.wallet': 'Деньги',
  'plan.note.icon.umbrella': 'Дождь',
  'plan.note.icon.triangleAlert': 'Предупреждение',
  'plan.transport.phase.flight.departing': 'Вылет',
  'plan.transport.phase.flight.travelling': 'В воздухе',
  'plan.transport.phase.flight.arriving': 'Посадка',
  'plan.transport.phase.hire.departing': 'Получение',
  'plan.transport.phase.hire.travelling': 'В аренде',
  'plan.transport.phase.hire.arriving': 'Возврат',
  'plan.transport.phase.journey.departing': 'Начало',
  'plan.transport.phase.journey.travelling': 'В пути',
  'plan.transport.phase.journey.arriving': 'Конец',
  'plan.transport.label': 'Из {from} в {to}',
  'plan.transport.drag': 'Изменить порядок, {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Вместе',
  'collab.empty': 'Пока ничем не поделились',
  'collab.conversation': 'Переписка',
  'collab.count.messages': {
    one: '{messages} сообщение',
    few: '{messages} сообщения',
    many: '{messages} сообщений',
    other: '{messages} сообщения',
  },
  'collab.count.notes': {
    one: '{notes} заметка',
    few: '{notes} заметки',
    many: '{notes} заметок',
    other: '{notes} заметки',
  },
  'collab.count.polls': {
    one: '{polls} опрос',
    few: '{polls} опроса',
    many: '{polls} опросов',
    other: '{polls} опроса',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Брони',
  'book.empty': 'Пока ничего не забронировано',
  'book.count.bookings': {
    one: '{bookings} бронь',
    few: '{bookings} брони',
    many: '{bookings} броней',
    other: '{bookings} брони',
  },
  'book.count.confirmed': {
    one: '{confirmed} подтверждена',
    few: '{confirmed} подтверждены',
    many: '{confirmed} подтверждено',
    other: '{confirmed} подтверждены',
  },
  'book.progressLabel': {
    one: '{confirmed} из {total} брони подтверждена',
    few: '{confirmed} из {total} броней подтверждены',
    many: '{confirmed} из {total} броней подтверждено',
    other: '{confirmed} из {total} броней подтверждены',
  },
  'book.ofTotal': 'из {total}',
  'book.confirmed': 'Подтверждено',
  'book.awaiting': 'Ждёт подтверждения',
  'book.nothingHanging': 'Ничего не висит',
  'book.chase': 'Разберитесь до вылета',
  'book.committed': 'Обязательства',
  'book.committedCaption': 'По всем броням этой поездки',
  'book.onItinerary': 'В маршруте',
  'book.pinnedCaption': 'Закреплено за днём маршрута',
  'book.readOnly.archived':
    'Эта поездка в архиве, поэтому бронирования и проживание доступны только для чтения. Восстановите поездку, чтобы их изменить.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Это изменение отклонено. Проверьте текущее состояние поездки перед дальнейшими изменениями.',
  'transports.recovery.failed':
    'Не удалось обновить поездку. Повторите попытку перед внесением изменений.',
  'transports.readOnly.archived':
    'Эта поездка в архиве. Восстановите её, чтобы изменить транспорт.',
  'transports.title': 'Переезды',
  'transports.empty': 'Пока ничего не записано',
  'transports.count.transports': {
    one: '{transports} переезд',
    few: '{transports} переезда',
    many: '{transports} переездов',
    other: '{transports} переезда',
  },
  'transports.distance': 'Пройденное расстояние',
  'transports.equator': '≈ {times}× вокруг экватора',
  'transports.noGrouping': 'Пока ничего не сгруппировано',
  'transports.mostly': 'в основном {mode}',
  'transports.confirmed': 'Подтверждено',
  'transports.stillPending': {
    one: '{pending} ещё в ожидании',
    few: '{pending} ещё в ожидании',
    many: '{pending} ещё в ожидании',
    other: '{pending} ещё в ожидании',
  },
  'transports.spent': 'Потрачено на дорогу',
  'transports.noPrices': 'Цены не записаны',
  'transports.priced': {
    one: 'по {priced} переезду с ценой',
    few: 'по {priced} переездам с ценой',
    many: 'по {priced} переездам с ценой',
    other: 'по {priced} переездам с ценой',
  },
  'people.title': 'Участники',
  'people.description': 'Кто в этой поездке и кто может её найти',
  'people.members.title': 'В этой поездке',
  'people.members.empty':
    'Никого из этой поездки больше нет в этом пространстве',
  'people.role.label': 'Роль',
  'people.role.owner': 'Владелец',
  'people.role.editor': 'Редактор',
  'people.role.viewer': 'Читатель',
  'people.you': 'Вы',
  'people.owner.hint': 'В поездке всегда остаётся хотя бы один владелец',
  'people.remove.action': 'Убрать {name} из этой поездки',
  'people.remove.title': 'Убрать {name} из этой поездки?',
  'people.remove.body':
    'Доступ к маршруту пропадёт сразу. Всё, что человек добавил, останется в поездке.',
  'people.remove.confirm': 'Убрать',
  'people.leave.action': 'Покинуть поездку',
  'people.leave.title': 'Покинуть эту поездку?',
  'people.leave.body':
    'Вы потеряете доступ к маршруту, пока кто-нибудь из поездки не добавит вас снова.',
  'people.leave.confirm': 'Покинуть',
  'people.cancel': 'Отмена',
  'people.invite.title': 'Добавить человека',
  'people.invite.placeholder': 'Поиск людей в этом пространстве',
  'people.invite.action': 'Добавить в поездку',
  'people.invite.role': 'Присоединяется как',
  'people.invite.empty': 'Все в этом пространстве уже в этой поездке',
  'people.invite.emptyHint':
    'Сначала новый человек входит в пространство, в настройках',
  'people.visibility.title': 'Кто может найти эту поездку',
  'people.visibility.switch': 'Видна всем в пространстве',
  'people.visibility.private':
    'Эту поездку видят только перечисленные здесь люди',
  'people.visibility.organization':
    'Любой в этом пространстве может открыть эту поездку',
  'people.visibility.public': 'Эта поездка открыта по публичной ссылке',
  'people.error.lastOwner':
    'В поездке остаётся хотя бы один владелец. Сначала сделайте владельцем кого-то ещё.',
  'people.error.notInWorkspace': 'Этого человека нет в этом пространстве',
  'people.error.alreadyOnTrip': 'Этот человек уже в этой поездке',
  'people.guests.title': 'Путешествуют с вами',
  'people.guests.description': 'Участники поездки без учётной записи',
  'people.guests.empty': 'Пока никого',
  'people.guests.emptyHint':
    'Гость — это тот, кто едет с вами и не нуждается в учётной записи. Добавьте его по имени.',
  'people.guest.badge': 'Гость',
  'people.guest.add.label': 'Имя',
  'people.guest.add.placeholder': 'Аня',
  'people.guest.add.action': 'Добавить гостя',
  'people.guest.rename.action': 'Переименовать: {name}',
  'people.guest.rename.title': 'Переименовать: {name}',
  'people.guest.rename.confirm': 'Переименовать',
  'people.guest.remove.action': 'Убрать {name} из поездки',
  'people.guest.remove.title': 'Убрать {name} из поездки?',
  'people.guest.remove.body':
    'Гость исчезнет из списка. Больше в поездке ничего не изменится.',
  'people.guest.remove.confirm': 'Убрать',
  'people.guest.merge.action': '{name} — теперь…',
  'people.guest.merge.title': '{name} — теперь один из участников поездки',
  'people.guest.merge.body':
    'Всё, что назначено на {name}, перейдёт выбранному человеку, а гость исчезнет. Отменить это нельзя.',
  'people.guest.merge.inherits': '{member} получит всё, что назначено {name}.',
  'people.guest.merge.placeholder': 'Выберите кого-то из поездки',
  'people.guest.merge.confirm': 'Объединить',
  'people.guest.merge.done': '{name} — теперь {member}',
  'people.guest.merge.nothingMoved':
    'На этого гостя ещё ничего не было назначено',
  'people.error.guestNameTaken':
    'Гость с именем {name} уже есть в этой поездке',
  'people.error.guestLimit':
    'В поездке может быть не больше {limit} гостей: длинный список затрудняет выбор участников и чтение разделения расходов',
  'people.error.guestMergeTarget': 'Выберите того, кто уже участвует в поездке',
  'plan.weather.badge.forecast':
    'Прогноз: {condition}, максимум {max}, минимум {min}',
  'plan.weather.badge.forecastNoCondition':
    'Прогноз: максимум {max}, минимум {min}',
  'plan.weather.badge.unavailable': 'Погода на этот день недоступна',
  'plan.weather.badge.loading': 'Загрузка погоды',
  'plan.weather.badge.recorded': 'Зафиксировано: максимум {max}, минимум {min}',
  'plan.weather.badge.recordedHigh': 'Зафиксировано: максимум {max}',
  'plan.weather.badge.recordedLow': 'Зафиксировано: минимум {min}',
  'plan.weather.badge.estimate':
    'Оценка: типичный максимум {max}, минимум {min}',
  'plan.weather.badge.estimateHigh': 'Оценка: типичный максимум {max}',
  'plan.weather.badge.estimateLow': 'Оценка: типичный минимум {min}',
  'plan.weather.badge.notYetRecorded': 'Ещё не зафиксировано',
  'plan.weather.condition.clear': 'Ясно',
  'plan.weather.condition.fair': 'Малооблачно',
  'plan.weather.condition.partlyCloudy': 'Переменная облачность',
  'plan.weather.condition.cloudy': 'Облачно',
  'plan.weather.condition.fog': 'Туман',
  'plan.weather.condition.rain': 'Дождь',
  'plan.weather.condition.heavyRain': 'Сильный дождь',
  'plan.weather.condition.sleet': 'Мокрый снег',
  'plan.weather.condition.snow': 'Снег',
  'plan.weather.condition.thunder': 'Гроза',
  'plan.weather.panel.title': 'Погода на {date}',
  'plan.weather.panel.temperature': 'Макс. / мин.',
  'plan.weather.panel.precipitation': 'Осадки',
  'plan.weather.panel.precipitationTypical': 'Типичные осадки за день',
  'plan.weather.panel.probability': 'вероятность {percent}',
  'plan.weather.panel.wind': 'Ветер',
  'plan.weather.panel.sunrise': 'Восход',
  'plan.weather.panel.sunset': 'Закат',
  'plan.weather.panel.noSunrise': 'Нет восхода',
  'plan.weather.panel.noSunset': 'Нет заката',
  'plan.weather.panel.slots': 'В течение дня',
  'plan.weather.panel.slot.night': 'Ночь',
  'plan.weather.panel.slot.morning': 'Утро',
  'plan.weather.panel.slot.afternoon': 'День',
  'plan.weather.panel.slot.evening': 'Вечер',
  'plan.weather.panel.high': 'Максимум',
  'plan.weather.panel.low': 'Минимум',
  'plan.weather.panel.recordedNote': 'Измеренные значения за этот день.',
  'plan.weather.panel.temperatureTypical': 'Типичные макс. / мин.',
  'plan.weather.panel.estimateNote':
    'Многолетнее среднее за этот месяц, а не прогноз.',
  'plan.weather.attribution.metNorway':
    'Данные прогноза: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Данные: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Изменить ширину маршрута',
  'plan.workspace.resizePlaces': 'Изменить ширину мест',
  'plan.workspace.toggleDay': 'Развернуть или свернуть {day}',
  'plan.workspace.days': 'Дни',
  'plan.workspace.showPanel': 'Показать панель {label}',
  'plan.workspace.hidePanel': 'Скрыть панель {label}',
  'plan.workspace.narrowPanel': 'Сузить {label}',
  'plan.workspace.widenPanel': 'Расширить {label}',
  'collab.sections.tabsLabel': 'Разделы совместной работы',
  'collab.sections.trigger': 'Выбрать разделы',
  'collab.sections.menuLabel': 'Показывать всем участникам поездки',
  'collab.sections.keepOne':
    'Хотя бы один раздел должен оставаться включённым.',
  'collab.sections.failed': 'Изменение не сохранилось',
  'collab.sections.failedBody':
    'Меню показывает текущее сохранённое состояние.',
  'collab.sections.someHidden': 'Некоторые разделы скрыты в этой поездке.',
  'collab.sections.turnedOff':
    'Этот раздел отключён для поездки. Он закроется, когда вы отправите или очистите набираемый текст.',
  'collab.sections.changed': 'Разделы этой поездки изменились.',
  'collab.sections.savedHidden':
    'Сохранено. Этот раздел скрыт для поездки и сейчас закроется.',
  'plan.place.error.save':
    'Не удалось сохранить место. Попробуйте ещё раз через минуту.',
  'plan.stop.error.saveTimes':
    'Не удалось сохранить время остановки. Попробуйте ещё раз через минуту.',
  'plan.place.error.delete':
    'Не удалось удалить место. Попробуйте ещё раз через минуту.',
  'plan.pin.error.move':
    'Не удалось переместить метку. Попробуйте ещё раз через минуту.',
  'plan.place.toast.created': 'Место добавлено',
  'plan.place.toast.updated': 'Место обновлено',
  'plan.stop.toast.timesSaved': 'Время остановки сохранено',
  'plan.place.toast.deleted': 'Место удалено',
  'plan.pin.toast.moved': '{name}: метка установлена',
  'join.page.title': 'Ссылка-приглашение в поездку',
  'join.page.description':
    'Откройте эту ссылку, чтобы присоединиться к общей поездке в planned.travel.',
  'join.title.invited': '{inviter} приглашает вас в поездку',
  'join.requirement':
    'Эта ссылка работает для тех, кто уже состоит в пространстве пользователя {inviter}.',
  'join.newHere':
    'Впервые здесь? Сначала попросите {inviter} добавить вас в пространство.',
  'join.trip.label': 'Поездка',
  'join.role.label': 'Ваша роль после присоединения',
  'join.dates.label': 'Даты',
  'join.destination.label': 'Пункт назначения',
  'join.action.signIn': 'Войти',
  'join.action.join': 'Присоединиться к поездке',
  'join.action.joining': 'Присоединяемся к поездке',
  'join.action.open': 'Открыть поездку',
  'join.action.openIn': 'Открыть поездку и сменить пространство',
  'join.action.openIn.pending': 'Меняем пространство',
  'join.loading': 'Загружаем приглашение',
  'join.joined.title': 'Вы в поездке',
  'join.joined.body': 'Откройте её, чтобы увидеть план.',
  'join.member.title': 'Вы уже участвуете в этой поездке',
  'join.needsWorkspace.title':
    'Эта поездка находится в пространстве, в котором вы не состоите',
  'join.needsWorkspace.body':
    'Сначала попросите {inviter} добавить вас в пространство, затем откройте эту ссылку снова.',
  'join.needsWorkspace.signedInAs':
    'Вы вошли как {email}. Попросите {inviter} использовать этот адрес.',
  'join.needsWorkspace.acceptFirst':
    'Если у вас уже есть письмо с приглашением в пространство, сначала примите его, затем откройте эту ссылку снова.',
  'join.needsWorkspace.otherAccount': 'Войти с другим аккаунтом',
  'join.unavailable.title': 'Эта ссылка-приглашение недоступна',
  'join.unavailable.body':
    'Возможно, ссылку заменили или отключили. Попросите новую у того, кто её отправил.',
  'join.unavailable.signIn': 'Войти',
  'join.unavailable.trips': 'Перейти к вашим поездкам',
  'join.error.title': 'Не удалось загрузить эту ссылку-приглашение',
  'join.error.retry': 'Повторить',
  'join.error.busy':
    'Страница сейчас перегружена. Повторите попытку через минуту.',
  'join.error.join':
    'Не удалось присоединиться. Ссылка по-прежнему работает, повторите попытку.',
  'join.error.switch': 'Не удалось сменить пространство. Повторите попытку.',

  'invite.title': 'Ссылка-приглашение',
  'invite.description':
    'Любой участник этого пространства, открывший ссылку, присоединится к поездке.',
  'invite.empty.title': 'Ссылки пока нет',
  'invite.empty.body':
    'Создайте ссылку и отправьте в групповой чат, чтобы участники этого пространства могли присоединиться.',
  'invite.action.create': 'Создать ссылку',
  'invite.link.label': 'Ссылка-приглашение',
  'invite.copy': 'Скопировать ссылку',
  'invite.copied': 'Ссылка скопирована',
  'invite.copyFailed':
    'Не удалось скопировать. Выделите ссылку и скопируйте вручную.',
  'invite.switch.label':
    'Любой участник пространства со ссылкой может присоединиться',
  'invite.switch.onHint':
    'Отключение делает ссылку недействительной для всех, включая уже отправленные копии.',
  'invite.switch.offHint':
    'При включении создаётся новая ссылка. Прежние остаются недействительными.',
  'invite.off.body': 'Ссылка отключена. По ней никто не может присоединиться.',
  'invite.uses': {
    one: 'Присоединились по ссылке: {count}',
    few: 'Присоединились по ссылке: {count}',
    many: 'Присоединились по ссылке: {count}',
    other: 'Присоединились по ссылке: {count}',
  },
  'invite.uses.never': 'По этой ссылке пока никто не присоединился.',
  'invite.lastUsed': 'Последнее присоединение: {when}',
  'invite.role.upgrade.title': 'Дать права редактора?',
  'invite.role.upgrade.body':
    'Это касается всех отправленных копий и тех, кто присоединится с этого момента.',
  'invite.role.upgrade.confirm': 'Дать права редактора',
  'invite.replace.action': 'Заменить ссылку',
  'invite.replace.title': 'Заменить эту ссылку?',
  'invite.replace.body':
    'Старая ссылка сразу перестанет работать для всех. Уже присоединившиеся останутся в поездке; при необходимости удалите их из списка ниже.',
  'invite.replace.deadBody':
    'Старая ссылка больше не работает. Уже присоединившиеся остаются в поездке.',
  'invite.replace.confirm': 'Заменить ссылку',
  'invite.replace.pending': 'Замена ссылки',
  'invite.stale': 'Эта ссылка больше не работает. Замените её.',
  'invite.creatorGone':
    'Ссылка не работает, потому что её создатель больше не владелец. Замените её.',
  'invite.archived':
    'Поездка в архиве. Ссылка снова заработает после восстановления поездки.',
  'invite.announce.created': 'Ссылка-приглашение создана',
  'invite.announce.roleEditor': 'Новые участники получат права редактора',
  'invite.announce.off': 'Ссылка-приглашение отключена',
  'invite.announce.newLink':
    'Новая ссылка готова. Скопируйте и отправьте её снова.',
  'invite.announce.roleViewer': 'Новые участники получат права просмотра',
  'invite.error.title': 'Не удалось загрузить ссылку',
  'invite.error.retry': 'Повторить',
  'invite.refusal.archived': 'Поездка в архиве.',
  'invite.refusal.notOwner': 'Только владелец поездки может изменить ссылку.',
  'invite.refusal.changed': 'Кто-то изменил ссылку. Показана текущая.',
  'invite.announce.recovered':
    'Показаны текущие настройки ссылки. Проверьте их перед следующим изменением.',
} satisfies TranslationOf<typeof En>

export default messages
