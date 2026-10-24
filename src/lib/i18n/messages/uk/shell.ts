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

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Простір',
  'workspace.switched': 'Ви перейшли до {name}',
  'workspace.switchFailed': 'Не вдалося перемкнути простір',
  'workspace.switchFailedBody': 'Перевірте з’єднання і спробуйте ще раз.',
  'workspace.switchUnconfirmedBody':
    'Не вдалося підтвердити активний робочий простір. Перезавантажте сторінку, перш ніж продовжити.',
  'workspace.switchRateLimitedBody':
    'Занадто часте перемикання робочих просторів. Зачекайте трохи та спробуйте знову.',
  'workspace.create': 'Створити простір',
  'workspace.createTitle': 'Створення простору',
  'workspace.createDescription':
    'Окремий простір зі своїми подорожами, місцями та людьми. Починається з тарифу «Безкоштовний» і не ділить тариф із простором, у якому ви зараз перебуваєте.',
  'workspace.createPermanent':
    'У planned.travel поки немає можливості видалити простір. Кожен простір входить до {limit} просторів, до яких може належати один обліковий запис, зокрема й ті, куди вас запросили.',
  'workspace.createName': 'Назва простору',
  'workspace.createUpgrade':
    '«{workspace}» на тарифі «Безкоштовний», а створити ще один простір може лише простір із платним тарифом. Якщо якийсь із ваших інших просторів має платний тариф, перемкніться на нього й створіть простір звідти. Інакше переведіть «{workspace}» на платний тариф.',
  'workspace.createLimitReached':
    'Ви досягли найбільшої кількості просторів, до яких може належати один обліковий запис.',
  'workspace.createRoleRequired':
    'Створити простір може лише його адміністратор. Попросіть адміністратора цього простору або перемкніться на простір, яким ви керуєте.',
  'workspace.createFailed': 'Не вдалося створити простір',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Вигляд',
  'theme.light': 'Світла',
  'theme.dark': 'Темна',
  'theme.system': 'Як у системі',
  'theme.state.light': 'світла',
  'theme.state.dark': 'темна',
  'theme.state.system': 'як у системі',
  'theme.trigger': 'Тема: {state}. Змінити тему',
  'language.trigger': 'Мова: {language}. Змінити мову',
  'language.hint':
    'Запам’ятовується на цьому пристрої. Після входу діє мова, задана у вашому обліковому записі; змінити її можна в Налаштуваннях.',
  'language.announce': 'Мову змінено на {language}',
  'language.notApplied':
    'Цей браузер не зберіг ваш вибір. Дозвольте файли cookie для цього сайту й виберіть мову ще раз.',

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
  'notification.trip.copied.title': '{tripTitle} готова',
  'notification.trip.copied.body': {
    one: 'Перенесено {days} день',
    few: 'Перенесено {days} дні',
    many: 'Перенесено {days} днів',
    other: 'Перенесено {days} дня',
  },
  'notification.trip.copied.places': {
    one: '{places} місце',
    few: '{places} місця',
    many: '{places} місць',
    other: '{places} місця',
  },
  'notification.trip.copied.dropped': {
    one: 'пропущено {dropped} нотатку',
    few: 'пропущено {dropped} нотатки',
    many: 'пропущено {dropped} нотаток',
    other: 'пропущено {dropped} нотатки',
  },
  'notification.trip.copyFailed.title': 'Не вдалося скопіювати {tripTitle}',
  'notification.trip.copyFailed.body':
    'Нічого не втрачено. Спробуйте ще раз з оригіналу.',
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
  'notification.billing.invoice_paid.title': 'Платіж отримано',
  'notification.billing.invoice_paid.body':
    'Останній рахунок для {organizationName} оплачено.',
  'notification.billing.payment_failed.title': 'Платіж не пройшов',
  'notification.billing.payment_failed.body':
    'У {organizationName} є прострочений платіж. Оновіть спосіб оплати, щоб зберегти тариф.',
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
  'dashboard.hero.nights': 'Ночі',
  'dashboard.hero.companionsHint': 'у цій подорожі',
  'dashboard.hero.progress': 'У дорозі',
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
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Орієнтири',
  'dashboard.widgets.choose': 'Вибрати віджети',
  'dashboard.widgets.description': 'Віджети, які ви тримаєте поруч із панеллю.',
  'dashboard.clock.label': 'Світовий годинник',
  'dashboard.clock.add': 'Додати часовий пояс',
  'dashboard.clock.search': 'Пошук міст і регіонів',
  'dashboard.clock.noMatches': 'Часового поясу з такою назвою немає',
  'dashboard.clock.remove': 'Прибрати {zone}',
  'dashboard.clock.offset': '{offset} від вашого часу',
  'dashboard.clock.here': 'Ваш власний час',
  'dashboard.clock.empty.title': 'Часові пояси не закріплені',
  'dashboard.clock.empty.body':
    'Закріпіть місце й читайте його годинник поруч зі своїм.',
  'dashboard.clock.unknown.title': 'Цей пристрій не знає поясу {zone}',
  'dashboard.clock.unknown.body':
    'Його час тут не прочитати. Приберіть рядок, щоб це виправити.',

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
  'admin.members.role.label': 'Роль: {name}',
  'admin.members.role.saved': 'Тепер у {name} роль: {role}.',
  'admin.members.role.impersonated':
    'Роль не можна змінити, поки ви дієте від імені іншого акаунта.',
  'admin.members.role.notPermitted':
    'Ви не можете внести цю зміну. Роль власника може надати або змінити лише власник.',
  'admin.members.role.lastOwner':
    'Це єдиний власник робочого простору. Спершу призначте іншого власника.',
  'admin.members.role.notFound': 'Цієї людини більше немає в робочому просторі. Список оновлено.',
  'admin.members.role.failed': 'Не вдалося змінити роль. Спробуйте ще раз.',
  'admin.members.role.promote.title': 'Зробити {name} власником?',
  'admin.members.role.promote.body':
    '{name} матиме стільки ж влади, скільки й ви: оплата, учасники та налаштування. Власник може понизити або видалити будь-якого іншого власника, зокрема вас.',
  'admin.members.role.promote.confirm': 'Зробити власником',
  'admin.members.role.promote.cancel': 'Скасувати',

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

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} поїздка',
    few: '{value} поїздки',
    many: '{value} поїздок',
    other: '{value} поїздки',
  },
  'trips.count.favourites': {
    one: '{value} улюблена',
    few: '{value} улюблені',
    many: '{value} улюблених',
    other: '{value} улюбленої',
  },
  'trips.count.archived': {
    one: '{value} в архіві',
    few: '{value} в архіві',
    many: '{value} в архіві',
    other: '{value} в архіві',
  },
  'trips.atLimit.body':
    'Твій тариф покриває {trips}. Відправ в архів завершену або перейди на вищий тариф, щоб тримати більше відкритими водночас.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Новий щоденник',
  'newJourney.title': 'Почни щоденник',
  'newJourney.description':
    'Щоденник — записана сторона поїздки: записи за датами, з фотографіями і погодою, яку ти пам’ятаєш.',
  'newJourney.titlePlaceholder': 'Два тижні в Кіото',
  'newJourney.subtitle': 'Підзаголовок',
  'newJourney.subtitleHint': 'Один рядок під заголовком, на обкладинці.',
  'newJourney.subtitlePlaceholder': 'Храми, поїзди і надто багато матчі',
  'newJourney.trip': 'На основі поїздки',
  'newJourney.tripHint': 'Необов’язково — в’яже розповідь із її планом.',
  'newJourney.tripNone': 'Без прив’язки до поїздки',
  'newJourney.datesError': 'Дата завершення раніша за початок.',
  'newJourney.submit': 'Створити щоденник',
  'newJourney.creating': 'Створюємо щоденник',
  'newJourney.created': 'Щоденник розпочато',
  'newJourney.createdBody': 'Додай перший запис, щоб почати розповідь.',
  'newJourney.error': 'Щоденник не вдалося створити. Спробуй за хвилину.',
  'newCollection.trigger': 'Нова збірка',
  'newCollection.title': 'Почни збірку',
  'newCollection.description':
    'Місце для місць, які знаходиш раніше, ніж знаєш, до якої поїздки вони належать.',
  'newCollection.namePlaceholder': 'Кава, за якою варто перейти місто',
  'newCollection.descriptionHint': 'Що тут належить, а що ні.',
  'newCollection.submit': 'Створити збірку',
  'newCollection.creating': 'Створюємо збірку',
  'newCollection.created': 'Збірку створено',
  'newCollection.createdBody': 'Почни зберігати до неї місця.',
  'newCollection.error': 'Збірку не вдалося створити. Спробуй за хвилину.',

  'newTrip.title': 'Почни нову поїздку',
  'newTrip.description':
    'Достатньо назви. Дати побудують план по днях, а решта може почекати, поки ти не знатимеш.',
  'newTrip.name': 'Назва поїздки',
  'newTrip.namePlaceholder': 'Кіото в сезон сакури',
  'newTrip.destination': 'Напрямок',
  'newTrip.destinationHint': 'Місто, регіон або весь маршрут.',
  'newTrip.destinationPlaceholder': 'Кіото, Японія',
  'newTrip.departure': 'Виїзд',
  'newTrip.return': 'Повернення',
  'newTrip.returnError': 'Дата повернення раніша за виїзд.',
  'newTrip.currency': 'Валюта бюджету',
  'newTrip.currencyHint': 'У ній сумується кожна витрата цієї поїздки.',
  'newTrip.currencySearch': 'Пошук за кодом або назвою',
  'newTrip.currencyEmpty': 'Жодна валюта не збігається.',
  'newTrip.currencyFavourites': 'Обрані',
  'newTrip.currencyAll': 'Усі валюти',
  'newTrip.summary': 'Опис',
  'newTrip.summaryPlaceholder': 'Два тижні храмів, потягів і рамену.',
  'newTrip.duration': 'Тривалість у днях',
  'newTrip.durationHint':
    'Без дат поїздка починається з цієї кількості днів без дати.',
  'newTrip.durationDerived': 'Обчислюється з двох дат.',
  'newTrip.reminder': 'Нагадування перед від’їздом',
  'newTrip.reminderNone': 'Немає',
  'newTrip.reminderBefore': {
    one: 'за {count} день',
    few: 'за {count} дні',
    many: 'за {count} днів',
    other: 'за {count} дня',
  },
  'newTrip.reminderCustom': 'Власне',
  'newTrip.reminderCustomDays': 'Днів до від’їзду',
  'newTrip.reminderOn': 'Нагадування {date}',
  'newTrip.reminderNoDeparture': 'Обери дату від’їзду, щоб побачити день.',
  'newTrip.submit': 'Створити поїздку',
  'newTrip.creating': 'Створюємо поїздку',
  'newTrip.error': 'Поїздку не вдалося створити. Спробуй за хвилину.',
  'newTrip.created': 'Поїздку створено',
  'newTrip.createdBody': 'Почни розставляти місця на карті.',
  'newTrip.coverChoose': 'Додати обкладинку',
  'newTrip.coverChange': 'Змінити обкладинку',
  'newTrip.coverHint':
    'Перетягни сюди зображення, встав його або обери файл. PNG, JPEG, WebP, AVIF або GIF.',
  'newTrip.coverChosen': 'Обкладинка: {name}',
  'newTrip.coverRemove': 'Прибрати обкладинку',
  'newTrip.coverTypeError':
    'Файл «{name}» не підходить для обкладинки. Обери PNG, JPEG, WebP, AVIF або GIF.',
  'newTrip.coverSizeError':
    'Файл «{name}» більший за {max}. Обери менше зображення.',
  'newTrip.coverUploading': 'Завантажуємо обкладинку',
  'newTrip.coverFailedTitle': 'Обкладинку не додано',
  'newTrip.coverFailed':
    'Поїздку створено, але файл «{name}» не вдалося завантажити як обкладинку.',
  'newTrip.coverRetry': 'Спробувати ще раз',
  'newTrip.coverContinue': 'Відкрити поїздку без обкладинки',
  'newTrip.people': 'Учасники',
  'newTrip.peopleHint':
    'Їх буде додано одразу після створення поїздки. Власником залишаєтеся ви.',
  'newTrip.peoplePlaceholder': 'Виберіть із простору',
  'newTrip.peopleSearch': 'Пошук за іменем',
  'newTrip.peopleLoading': 'Завантажуємо учасників вашого простору',
  'newTrip.peopleLoadError':
    'Не вдалося завантажити учасників вашого простору. Створіть поїздку та додайте їх на її екрані «Учасники».',
  'newTrip.peopleNone': 'Поки що ви єдина людина в цьому просторі.',
  'newTrip.peopleNoneMember':
    'Запросити більше людей може власник або адміністратор простору.',
  'newTrip.peopleInvite': 'Запросити людей у простір',
  'newTrip.peopleChosen': 'Вибрані люди та їхні ролі',
  'newTrip.peopleFailedTitle': 'Поїздку створено, але додано не всіх',
  'newTrip.noticeBothTitle': 'Поїздку створено, але додано не все',
  'newTrip.peopleNotInWorkspace':
    '{name} більше немає в цьому просторі, тому додати не вдалося.',
  'newTrip.peopleAlreadyOn': '{name} уже є в цій поїздці.',
  'newTrip.peopleUnconfirmed':
    'Не вдалося підтвердити додавання: {name}. Перевірте на екрані «Учасники», чи додавання відбулося.',
  'newTrip.peopleContinue': 'Продовжити',
  'newTrip.peopleRetry': 'Повторити',
  'newTrip.coverRetryOnly': 'Повторити з обкладинкою',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Дії для «{title}»',
  'tripActions.copy': 'Копіювати',
  'tripActions.favourite': 'До обраного',
  'tripActions.unfavourite': 'Прибрати з обраного',
  'tripActions.edit': 'Змінити',
  'tripActions.archive': 'До архіву',
  'tripActions.restore': 'Відновити',
  'tripActions.delete': 'Видалити',
  'tripActions.deleteForGood': 'Видалити назавжди',
  'tripActions.starFailed': 'Обране не збереглося',
  'tripActions.starFallback': 'Поїздка повернулася до попереднього стану.',
  'tripActions.archived': 'Поїздку заархівовано',
  'tripActions.archiveFailed': 'Не вдалося заархівувати поїздку',
  'tripActions.restored': 'Поїздку відновлено',
  'tripActions.restoreFailed': 'Не вдалося відновити поїздку',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Змінити поїздку',
  'editTrip.submit': 'Зберегти зміни',
  'editTrip.saving': 'Збереження поїздки',
  'editTrip.cancel': 'Скасувати',
  'editTrip.saved': 'Поїздку оновлено',
  'editTrip.errorTitle': 'Це не збереглося',
  'editTrip.retry': 'Спробувати ще раз',
  'editTrip.error': 'Не вдалося зберегти поїздку. Спробуйте ще раз за мить.',
  'editTrip.coverFailed':
    'Файл «{name}» не вдалося завантажити як обкладинку. Більше нічого ще не збережено.',
  'editTrip.coverContinue': 'Зберегти без нової обкладинки',
  'editTrip.currencyLocked':
    'У цій поїздці вже є ціни, тому валюту бюджету тут змінити не можна. Скористайтеся кнопкою «Змінити валюту бюджету» на вкладці «Витрати» або поверніть {current}, щоб зберегти решту змін.',
  'editTrip.currencyReadonly': 'Валюту бюджету змінюють на вкладці «Витрати».',
  'editTrip.currencyLink': 'Відкрити вкладку «Витрати»',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Видалити «{title}» назавжди?',
  'deleteTrip.description':
    'Скасування й кошика немає. Архів прибирає поїздку зі списку, не втрачаючи її.',
  'deleteTrip.reading': 'Читаємо, що містить ця поїздка',
  'deleteTrip.errorTitle': 'Це не завантажилося',
  'deleteTrip.summaryError': 'Не вдалося прочитати, що містить ця поїздка.',
  'deleteTrip.confirmLabel': 'Введіть назву поїздки для підтвердження',
  'deleteTrip.deleting': 'Видалення поїздки',
  'deleteTrip.deleted': 'Поїздку видалено',
  'deleteTrip.failed': 'Не вдалося видалити поїздку',
  'deleteTrip.carried.reservations': {
    one: 'бронювання',
    few: 'бронювання',
    many: 'бронювань',
    other: 'бронювання',
  },
  'deleteTrip.carried.transports': {
    one: 'переїзд',
    few: 'переїзди',
    many: 'переїздів',
    other: 'переїзду',
  },
  'deleteTrip.carried.expenses': {
    one: 'витрата',
    few: 'витрати',
    many: 'витрат',
    other: 'витрати',
  },
  'deleteTrip.carried.files': {
    one: 'файл',
    few: 'файли',
    many: 'файлів',
    other: 'файлу',
  },
  'deleteTrip.carried.members': {
    one: 'особа',
    few: 'особи',
    many: 'осіб',
    other: 'особи',
  },
  'copyTrip.title': 'Копіювати «{title}»',
  'copyTrip.nameLabel': 'Назва копії',
  'copyTrip.titleRequired': 'Дайте копії назву.',
  'copyTrip.datesLabel': 'Дати',
  'copyTrip.datesTogether': 'Вкажіть обидві дати або очистіть обидві.',
  'copyTrip.clearDates': 'Копіювати без дат',
  'copyTrip.carries':
    'Дні, місця та нотатки переходять у копію. Бронювання, гроші, файли та люди — ні.',
  'copyTrip.shorter':
    'Це коротше за оригінал. Місця зайвих днів перейдуть до ідей, а їхні нотатки зникнуть.',
  'copyTrip.submit': 'Копіювати поїздку',
  'copyTrip.copying': 'Копіювання поїздки',
  'copyTrip.cancel': 'Скасувати',
  'copyTrip.started': 'Копіюємо «{title}»',
  'copyTrip.errorTitle': 'Це не скопіювалося',
  'copyTrip.error': 'Не вдалося скопіювати поїздку. Спробуйте ще раз за мить.',

  'trips.error': 'Твої поїздки не завантажилися',
  'trips.eyebrow': 'Простір',
  'trips.nothingPlanned': 'Поки нічого не заплановано',
  'trips.search': 'Шукати поїздки',
  'trips.atLimit.title': 'Ти зайняв усі поїздки, які дозволяє тариф',
  'trips.atLimit.action': 'Порівняти тарифи',
  'trips.noMatch.title': 'Під цей фільтр нічого не підходить',
  'trips.noMatch.body': 'Спробуй інший етап, очисти пошук або зазирни в архів.',
  'trips.noMatch.action': 'Скинути фільтри',
  'trips.empty.body':
    'Поїздка тримає план по днях, карту, броні, списки речей і гроші. Почни одну — решта підтягнеться.',
  'trips.next.title': 'Кудись далі',
  'trips.next.body':
    'Почни поїздку, і planned.travel створить день на кожну дату, готовий до того, що ти зберіг.',
  'trips.savedPlaces': 'Збережені місця',
  'trips.filter.all': 'Усі',
  'trips.filter.favourites': 'Улюблені',
  'trips.view.label': 'Вигляд',
  'trips.view.grid': 'Сітка',
  'trips.view.list': 'Список',
  'trips.card.favourite': 'Улюблена',
  'trips.card.noDestination': 'Напрямок поки не вибрано',
  'trips.card.noDates': 'Дати поки не вибрано',
  'trips.card.startsIn': 'за {days} д',
  'trips.card.days': '{days} д',
  'trips.card.copying': 'Копіюється',
  'trips.card.copyingLabel': '{title} ще копіюється',
  'trips.card.copyingReason': 'Зачекайте, доки копіювання завершиться.',
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
  'error.reported': 'Ми отримали сповіщення й уже розбираємося.',
  'error.reference': 'Номер звернення',
  'error.feedback.open': 'Розкажіть, що сталося',
  'error.feedback.label': 'Що ви робили, коли це сталося?',
  'error.feedback.send': 'Надіслати',
  'error.feedback.sent': 'Дякуємо — це дуже допомагає.',
  'error.feedback.failed':
    'Не вдалося надіслати. Номер звернення вище все одно доходить до нас.',
  'error.root': 'Ми збилися з маршруту',
  'error.session': 'Ваш доступ до простору змінився',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Повідомити про проблему',
  'feedback.formTitle': 'Повідомити про проблему',
  'feedback.messageLabel': 'Що не так або що варто змінити?',
  'feedback.messagePlaceholder': 'Чого ви очікували і що сталося натомість?',
  'feedback.emailLabel': 'Електронна пошта',
  'feedback.emailPlaceholder': 'olena@example.com',
  'feedback.isRequiredLabel': '(обовʼязково)',
  'feedback.submitButtonLabel': 'Надіслати повідомлення',
  'feedback.cancelButtonLabel': 'Скасувати',
  'feedback.confirmButtonLabel': 'Підтвердити',
  'feedback.addScreenshotButtonLabel': 'Додати знімок екрана',
  'feedback.removeScreenshotButtonLabel': 'Прибрати знімок екрана',
  'feedback.highlightToolText': 'Виділити',
  'feedback.hideToolText': 'Приховати',
  'feedback.successMessageText': 'Дякуємо — повідомлення в нас.',
  'feedback.errorEmptyMessageText':
    'Спершу напишіть речення — порожнє повідомлення нічого нам не каже.',
  'feedback.errorTimeoutText':
    'Це триває надто довго, і ми не можемо підтвердити, що повідомлення надіслано.',
  'feedback.errorForbiddenText':
    'Цій сторінці не дозволено надсилати повідомлення.',
  'feedback.errorGenericText':
    'Не вдалося надіслати. Перевірте зʼєднання і чи не заважає блокувальник реклами.',

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
  'session.workspaceChanged':
    'Простір було змінено в іншій вкладці або вікні. Нічого не збережено.',
  'session.workspaceChangedTitle': 'Простір змінився в іншій вкладці',
  'session.workspaceChangedBody':
    'Ця вкладка показує «{name}», але простір було змінено в іншій вкладці або вікні. Нічого не збережено.',
  'session.openCurrentWorkspace': 'Відкрити поточний простір',
  'session.workspaceChangedDismiss': 'Не зараз',
} satisfies TranslationOf<typeof En>

export default messages
