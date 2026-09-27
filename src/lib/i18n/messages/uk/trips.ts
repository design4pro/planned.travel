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
  'error.people': 'Не вдалося завантажити учасників',
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
  'plan.stay.checkIn': 'Заїзд',
  'plan.stay.checkOut': 'Виїзд',
  'plan.day.addStay': 'Додати проживання, {day}',
  'plan.day.addStayShort': 'Додати проживання',
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
} satisfies TranslationOf<typeof En>

export default messages
