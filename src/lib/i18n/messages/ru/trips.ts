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
