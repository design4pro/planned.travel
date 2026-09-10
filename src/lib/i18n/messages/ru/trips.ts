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
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Маршрут',
  'plan.places': 'Места',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Добавить заметку',
  'plan.note.addForDay': 'Добавить заметку к этому дню',
  'plan.note.showMore': 'Показать больше',
  'plan.note.showLess': 'Показать меньше',
  'plan.note.moveUp': 'Переместить вверх',
  'plan.note.moveDown': 'Переместить вниз',
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
  'plan.note.error.move': 'Перемещение не сохранилось',
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
} satisfies TranslationOf<typeof En>

export default messages
