/**
 * Everything the application shell says, in Ukrainian.
 *
 * Authored from `../en/shell.ts` (`docs/SPEC.md` §8.9 — never from another
 * product's catalogue). `TranslationOf<typeof En>` is the key contract;
 * `__tests__/parity.test.ts` checks placeholders, plural branches and that no
 * value is left in English.
 *
 * **Plural.** `uk` needs `one` (1, 21, 31 …) · `few` (2–4) · `many` (0, 5–20)
 * · `other` (fractions, genitive singular).
 *
 * **Names of the modules.** `Journey` is the travel journal, so «Щоденник»;
 * `Vacay` is time off, so «Відпустки»; `Atlas` keeps its Ukrainian cognate. A
 * trip is «поїздка» and never «подорож», which is kept for travel in general.
 *
 * **Two senses of „plan“.** English `Plan` is both an itinerary and a
 * subscription. Ukrainian keeps «план» for the itinerary and says «тариф» where
 * the sentence is about what the workspace pays for.
 *
 * **Gender.** A Ukrainian past tense agrees with its subject and a notification
 * names a person whose gender we do not know, so nothing below agrees with
 * `{actorName}`: the copy uses a verbal noun («Розрахунок від …») or the present
 * tense, both genderless.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Основні розділи',
  'nav.mobile': 'Розділи',
  'nav.dashboardLink': 'Панель planned.travel',
  'nav.homeLink': 'Головна сторінка planned.travel',
  'nav.newTrip': 'Нова поїздка',

  'nav.trips': 'Мої поїздки',
  'nav.trips.short': 'Поїздки',
  'nav.vacay': 'Відпустки',
  'nav.vacay.short': 'Відпустки',
  'nav.atlas': 'Атлас',
  'nav.atlas.short': 'Атлас',
  'nav.journey': 'Щоденник',
  'nav.journey.short': 'Щоденник',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Розділи поїздки',
  'trip.nav.back': 'Поїздки',
  'trip.nav.share': 'Поділитися',
  'trip.nav.shareLabel': 'Поділитися цією поїздкою',
  'trip.tab.plan': 'План',
  'trip.tab.transports': 'Транспорт',
  'trip.tab.book': 'Броні',
  'trip.tab.lists': 'Списки',
  'trip.tab.costs': 'Витрати',
  'trip.tab.files': 'Файли',
  'trip.tab.collab': 'Обговорення',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Меню акаунта',
  'account.settings': 'Налаштування',
  'account.billing': 'Тариф і оплата',
  'account.admin': 'Адміністрування',
  'account.signOut': 'Вийти',
  'account.signingOut': 'Виходимо…',
  'account.signOutFailed': 'Не вдалося вийти',
  'account.signOutFailedBody': 'Перевірте з’єднання і спробуйте ще раз.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Вигляд',
  'theme.light': 'Світла',
  'theme.dark': 'Темна',
  'theme.system': 'Як у системі',
  'theme.state.light': 'світла',
  'theme.state.dark': 'темна',
  'theme.state.system': 'як у системі',
  'theme.trigger': 'Тема: {state}. Змінити тему',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Повідомлення, непрочитаних немає',
  'bell.unread': {
    one: 'Повідомлення, {unread} непрочитане',
    few: 'Повідомлення, {unread} непрочитані',
    many: 'Повідомлення, {unread} непрочитаних',
    other: 'Повідомлення, {unread} непрочитаного',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Вхідні',
  'inbox.title': 'Повідомлення',
  'inbox.error': 'Вхідні не завантажилися',
  'inbox.allRead': 'Усе прочитано',
  'inbox.unread': {
    one: '{unread} непрочитане повідомлення',
    few: '{unread} непрочитані повідомлення',
    many: '{unread} непрочитаних повідомлень',
    other: '{unread} непрочитаного повідомлення',
  },
  'inbox.markAll': 'Позначити прочитаним',
  'inbox.markingAll': 'Позначаємо все прочитаним',
  'inbox.cleared': 'Вхідні очищено',
  'inbox.markAllFailed': 'Не вдалося позначити все',
  'inbox.retryHint': 'Перевірте з’єднання і спробуйте ще раз.',
  'inbox.filter.all': 'Усе',
  'inbox.filter.unread': 'Непрочитані',
  'inbox.waiting': {
    one: '{invitations} запрошення чекає',
    few: '{invitations} запрошення чекають',
    many: '{invitations} запрошень чекають',
    other: '{invitations} запрошення чекає',
  },
  'inbox.empty.title': 'У вхідних порожньо',
  'inbox.empty.body':
    'Запрошення в поїздки, зміни в планах, нагадування про броні та закриті баланси — усе приходить сюди.',
  'inbox.empty.action': 'Назад до панелі',
  'inbox.emptyUnread.title': 'Непрочитаного немає',
  'inbox.emptyUnread.body':
    'Прочитано все. Перейдіть на «Усе», щоб переглянути історію.',
  'inbox.emptyUnread.action': 'Показати все',
  'inbox.row.new': 'Нове',
  'inbox.row.accepted': 'Прийнято',
  'inbox.row.declined': 'Відхилено',
  'inbox.row.open': 'Відкрити',
  'inbox.row.markRead': 'Прочитано',
  'inbox.row.markingRead': 'Позначаємо прочитаним',
  'inbox.row.markReadFailed': 'Не вдалося позначити прочитаним',
  'inbox.preferences':
    'Виберіть, що з цього приходитиме у вхідні, на пошту й на телефон.',
  'inbox.preferencesAction': 'Налаштування повідомлень',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Вас запросили до {tripTitle}',
  'notification.trip.invited.body': 'Запрошення від {actorName}.',
  'notification.trip.updated.title': 'Зміни в {tripTitle}',
  'notification.trip.updated.body': 'Зміна плану від {actorName}.',
  'notification.trip.member_added.title':
    '{memberName} приєднується до {tripTitle}',
  'notification.trip.member_added.body':
    'Ця людина бачить маршрут, броні та спільні гроші.',
  'notification.trip.member_removed.title': '{memberName} покидає {tripTitle}',
  'notification.trip.member_removed.body': 'Доступ до цієї поїздки закрито.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} починається за {days} день',
    few: '{tripTitle} починається за {days} дні',
    many: '{tripTitle} починається за {days} днів',
    other: '{tripTitle} починається за {days} дня',
  },
  'notification.trip.starting_soon.body':
    'Час перевірити список речей і броні.',
  'notification.reservation.reminder.title': '{title} уже скоро',
  'notification.reservation.reminder.body':
    'Перевірте час і код підтвердження в броні.',
  'notification.reservation.confirmed.title': '{title} підтверджено',
  'notification.reservation.confirmed.body':
    'Бронь у поїздці {tripTitle} позначено підтвердженою.',
  'notification.expense.added.title': 'Нова витрата від {actorName}',
  'notification.expense.added.body': '{title} у поїздці {tripTitle}.',
  'notification.expense.settled.title': 'Розрахунок від {actorName}',
  'notification.expense.settled.body': 'Баланс у поїздці {tripTitle} закрито.',
  'notification.list.assigned.title': 'Завдання від {actorName}',
  'notification.list.assigned.body': '{title} у поїздці {tripTitle}.',
  'notification.collab.message.title':
    'Нове повідомлення від {actorName} у {tripTitle}',
  'notification.collab.message.body': '«{preview}»',
  'notification.collab.poll.title': 'У поїздці {tripTitle} триває голосування',
  'notification.collab.poll.body': '«{question}»',
  'notification.organization.invited.title':
    'Вас запросили до {organizationName}',
  'notification.organization.invited.body':
    'Прийміть запрошення, щоб увійти в простір і все, що в ньому спільне.',
  'notification.journey.published.title': 'Опубліковано: {title}',
  'notification.journey.published.body':
    'Тепер щоденник прочитає кожен, хто має посилання.',
  'notification.billing.plan_changed.title': 'Тариф змінився',
  'notification.billing.plan_changed.body':
    'У {organizationName} тепер тариф {plan}.',
  'notification.fallback.title': 'У вашому просторі щось змінилося',
  'notification.fallback.body': 'Відкрийте поїздку й подивіться, що саме.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Панель не завантажилася',
  'dashboard.blank.title': 'Тут починається ваша наступна поїздка',
  'dashboard.blank.body':
    'Створіть поїздку, позначте на карті місця, які хочете побачити, — і planned.travel побудує навколо них план по днях.',
  'dashboard.blank.action': 'Спланувати поїздку',
  'dashboard.blank.secondary': 'Відкрити атлас',

  'dashboard.upNext': 'Найближча поїздка',
  'dashboard.openPlan': 'Відкрити план',
  'dashboard.hero.travellers': 'Мандрівники',
  'dashboard.hero.travellersHint': 'у цьому просторі',
  'dashboard.hero.dates': 'Дати поїздки',
  'dashboard.hero.datesUnset': 'Не задані',
  'dashboard.hero.datesHint': {
    one: '{days} день',
    few: '{days} дні',
    many: '{days} днів',
    other: '{days} дня',
  },
  'dashboard.hero.datesMissing': 'Додайте дати, щоб з’явилися дні',
  'dashboard.hero.startsIn': 'Старт за',
  'dashboard.hero.started': 'Старт був',
  'dashboard.hero.today': 'Сьогодні',
  'dashboard.hero.startUnknown': 'без дати старту',
  'dashboard.hero.startToday': 'гарної дороги',
  'dashboard.hero.startPast': {
    one: 'день тому',
    few: 'дні тому',
    many: 'днів тому',
    other: 'дня тому',
  },
  'dashboard.hero.startFuture': {
    one: 'день',
    few: 'дні',
    many: 'днів',
    other: 'дня',
  },
  'dashboard.hero.places': 'Місця',
  'dashboard.hero.placesNone': 'на карті поки нічого',
  'dashboard.hero.placesHint': 'на карті',

  'dashboard.stat.countries': 'Відвідані країни',
  'dashboard.stat.countriesUnit': 'з {total}',
  'dashboard.stat.countriesNone': 'Позначте країну — і атлас почнеться',
  'dashboard.stat.visits': {
    one: 'записано {visits} візит',
    few: 'записано {visits} візити',
    many: 'записано {visits} візитів',
    other: 'записано {visits} візита',
  },
  'dashboard.stat.trips': 'Поїздок усього',
  'dashboard.stat.tripsCaption': '{planning} у планах · {booked} заброньовано',
  'dashboard.stat.places': 'Місця на карті',
  'dashboard.stat.placesNone': 'На карті поки нічого немає',
  'dashboard.stat.placesAcross': {
    one: 'у {trips} поїздці',
    few: 'у {trips} поїздках',
    many: 'у {trips} поїздках',
    other: 'у {trips} поїздки',
  },
  'dashboard.stat.bookings': 'Підтверджені броні',
  'dashboard.stat.bookingsNone': 'Найближчих броней немає',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} бронь на підході',
    few: '{bookings} броні на підході',
    many: '{bookings} броней на підході',
    other: '{bookings} броні на підході',
  },

  'dashboard.trips.label': 'Ваші поїздки',
  'dashboard.trips.all': 'Усі поїздки',
  'dashboard.trips.empty.title': 'Поїздок ще немає',
  'dashboard.trips.empty.body':
    'Усе, що ви заплануєте, з’явиться тут — найновіше вгорі.',
  'dashboard.trips.empty.action': 'Створити поїздку',

  'dashboard.bookings.label': 'Найближчі броні',
  'dashboard.bookings.empty.title': 'Поки нічого не заброньовано',
  'dashboard.bookings.empty.body':
    'Підтверджені нічліги, столики й білети з’являться тут, коли наблизяться їхні дати.',

  'dashboard.pipeline.label': 'Етапи поїздок',
  'dashboard.pipeline.empty':
    'У роботі поки нічого. Перша поїздка розкладе це на етапи.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} улюблена',
    few: '{favourites} улюблені',
    many: '{favourites} улюблених',
    other: '{favourites} улюбленої',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} поїздка в архіві',
    few: '{archived} поїздки в архіві',
    many: '{archived} поїздок в архіві',
    other: '{archived} поїздки в архіві',
  },

  'dashboard.storage.label': 'Сховище',
  'dashboard.storage.count': '{used} з {limit}',
  'dashboard.storage.files': {
    one: '{files} файл з усіх поїздок, разом із фото й білетами.',
    few: '{files} файли з усіх поїздок, разом із фото й білетами.',
    many: '{files} файлів з усіх поїздок, разом із фото й білетами.',
    other: '{files} файла з усіх поїздок, разом із фото й білетами.',
  },
  'dashboard.storage.more': 'Потрібно більше місця?',
  'dashboard.storage.plans': 'Переглянути тарифи',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Консоль адміністратора не завантажилася',
  'admin.denied.title': 'Сюди заходять лише адміністратори простору',
  'admin.denied.body':
    'Якщо це вам потрібно, попросіть власника або адміністратора простору змінити вашу роль.',
  'admin.denied.action': 'Назад до панелі',
  'admin.eyebrow': 'Адміністрування простору',
  'admin.description': 'Тариф {plan} · створено {date}',
  'admin.createdUnknown': 'нещодавно',
  'admin.workspaceSettings': 'Налаштування простору',
  'admin.billing': 'Тариф і оплата',

  'admin.invitations.title': {
    one: '{invitations} запрошення ще відкрите',
    few: '{invitations} запрошення ще відкриті',
    many: '{invitations} запрошень ще відкриті',
    other: '{invitations} запрошення ще відкрите',
  },
  'admin.invitations.body':
    'Кожне відкрите запрошення займає одне з місць, які оплачує тариф.',
  'admin.invitations.action': 'Переглянути запрошення',

  'admin.stat.members': 'Учасники',
  'admin.stat.membersCaption': {
    one: '{invitations} запрошення в очікуванні',
    few: '{invitations} запрошення в очікуванні',
    many: '{invitations} запрошень в очікуванні',
    other: '{invitations} запрошення в очікуванні',
  },
  'admin.stat.storage': 'Сховище',
  'admin.stat.storageUnit': 'з {limit}',
  'admin.stat.storageUnlimited': 'без обмежень',
  'admin.stat.storageCaption': 'Файли, фото та експорти',
  'admin.stat.audit': 'Записи аудиту',
  'admin.stat.auditCaption': 'Найсвіжіша активність — нижче',
  'admin.stat.plan': 'Тариф',
  'admin.stat.planCaption': 'Ліміти перевіряються на межі репозиторіїв',

  'admin.quotas.label': 'Ліміти',
  'admin.quotas.count': {
    one: '{metrics} показник',
    few: '{metrics} показники',
    many: '{metrics} показників',
    other: '{metrics} показника',
  },
  'admin.quotas.unlimited': 'Без обмежень',
  'admin.quotas.value': '{used} з {limit}',

  'admin.members.label': 'Учасники',
  'admin.members.table': 'Учасники цього простору',
  'admin.members.person': 'Людина',
  'admin.members.role': 'Роль',
  'admin.members.joined': 'У команді з',

  'admin.activity.label': 'Нещодавня активність',
  'admin.activity.empty.title': 'Поки нічого не записано',
  'admin.activity.empty.body':
    'Кожен важливий запис потрапляє в журнал аудиту в ту мить, коли відбувається.',
  'admin.activity.workspace': 'сам простір',
  'admin.actions.label': 'Найчастіші дії',
  'admin.actions.count': {
    one: '{actions} дія',
    few: '{actions} дії',
    many: '{actions} дій',
    other: '{actions} дії',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Чернетка',
  'tripStatus.planning': 'У планах',
  'tripStatus.booked': 'Заброньована',
  'tripStatus.active': 'Активна',
  'tripStatus.completed': 'Завершена',
  'tripStatus.archived': 'В архіві',

  'bookingStatus.none': 'Без броні',
  'bookingStatus.pending': 'В очікуванні',
  /**
   * The dashboard's reservation rows put this chip beside a truncating date
   * line, so every pixel it takes comes straight off that line. At 360px
   * `Підтверджена` measured 97px and clipped the date; `Прийнята` is what a
   * Ukrainian booking says once it stops being «В очікуванні».
   */
  'bookingStatus.confirmed': 'Прийнята',
  'bookingStatus.cancelled': 'Скасована',
  'bookingStatus.completed': 'Відбулася',

  'bookingType.accommodation': 'Нічліг',
  'bookingType.restaurant': 'Столик',
  'bookingType.activity': 'Активність',
  'bookingType.tour': 'Екскурсія',
  'bookingType.ticket': 'Білет',
  'bookingType.transport': 'Переїзд',
  'bookingType.other': 'Бронь',

  'role.owner': 'Власник',
  'role.admin': 'Адміністратор',
  'role.member': 'Учасник',

  'metric.trips': 'Поїздки',
  'metric.places': 'Місця',
  'metric.members': 'Учасники',
  'metric.files': 'Файли',
  'metric.storage_bytes': 'Сховище',
  'metric.collections': 'Колекції',
  'metric.journeys': 'Щоденники',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Це не завантажилося',
  'error.body':
    'Нічого не втрачено. Спробуйте ще раз, а якщо повторюватиметься — надішліть нам подробиці нижче.',
  'error.retry': 'Спробувати ще раз',
  'error.dashboard': 'Назад до панелі',
  'error.unknown': 'Запит не дійшов до кінця.',
  'error.root': 'Ми збилися з маршруту',
  'error.session': 'Ваш доступ до простору змінився',

  'notFound.eyebrow': 'Помилка 404',
  'notFound.title': 'Цієї сторінки немає на карті',
  'notFound.body':
    'Посилання могло застаріти, а поїздка, на яку воно вело, — переїхати або бути видаленою.',
  'notFound.trips': 'Усі поїздки',
  'notFound.rootBody':
    'Ми шукали по всьому маршруту. Можливо, в адресі описка або сторінка поїхала далі.',
  'notFound.home': 'На головну',
  'notFound.plans': 'Переглянути тарифи',

  'session.noWorkspace':
    'Ваш акаунт поки не прив’язаний до простору. Вийдіть і зайдіть знову, щоб налаштування завершилося.',
  'session.membershipRemoved': 'Вашу участь у цьому просторі припинено.',
} satisfies TranslationOf<typeof En>

export default messages
