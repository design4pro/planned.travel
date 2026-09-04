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
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Не вдалося завантажити цю подорож',
  'error.plan': 'Не вдалося завантажити маршрут',
  'error.costs': 'Не вдалося завантажити витрати',
  'error.collab': 'Не вдалося завантажити листування',
  'error.book': 'Не вдалося завантажити бронювання',
  'error.transports': 'Переїзди не завантажилися',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Маршрут',
  'plan.places': 'Місця',
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
  /* ---------------------------------------------- the transports tab */
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
} satisfies TranslationOf<typeof En>

export default messages
