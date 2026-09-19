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
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Не удалось загрузить эту поездку',
  'error.plan': 'Не удалось загрузить маршрут',
  'error.costs': 'Не удалось загрузить расходы',
  'error.collab': 'Не удалось загрузить переписку',
  'error.book': 'Не удалось загрузить брони',
  'error.transports': 'Переезды не загрузились',
  'error.people': 'Не удалось загрузить участников',
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
    'Идеи — это места, ждущие своего дня. Заметка принадлежит дню, для которого её написали.',
  'plan.move.refused.notInAnotherDay': 'Заметка остаётся в своём дне',
  'plan.move.refused.notInAnotherDayBody':
    'Заметки пока нельзя переносить между днями. Измените заметку или напишите её в другом дне.',
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
  'plan.move.spoken.notInAnotherDay':
    '{name} не перемещён. Заметка остаётся в своём дне.',
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
  'plan.addPlace.forDay': 'Добавить место в этот день',
  'plan.addPlace.forDayNamed': 'Добавить место, {day}',
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
  /* ---------------------------------------------- the transports tab */
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
} satisfies TranslationOf<typeof En>

export default messages
