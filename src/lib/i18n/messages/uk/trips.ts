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
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Додати нотатку',
  'plan.note.addForDay': 'Додати нотатку, {day}',
  'plan.note.showMore': 'Показати більше',
  'plan.note.showLess': 'Показати менше',
  'plan.note.moveUp': 'Перемістити вгору',
  'plan.note.moveDown': 'Перемістити вниз',
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
  'plan.note.error.move': 'Переміщення не збереглося',
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
