/**
 * Everything the application shell says, in Russian.
 *
 * Authored from `../en/shell.ts` (`docs/SPEC.md` §8.9 — never from another
 * product's catalogue). `TranslationOf<typeof En>` is the key contract;
 * `__tests__/parity.test.ts` checks placeholders, plural branches and that no
 * value is left in English.
 *
 * **Plural.** `ru` needs `one` (1, 21, 31 …) · `few` (2–4) · `many` (0, 5–20)
 * · `other` (fractions, genitive singular).
 *
 * **Names of the modules.** `Journey` is the travel journal, so «Дневник»;
 * `Vacay` is time off, so «Отпуска»; `Atlas` keeps its Russian cognate.
 *
 * **Two senses of „plan“.** English `Plan` is both an itinerary and a
 * subscription. Russian keeps «план» for the itinerary and says «тариф» where
 * the sentence is about what the workspace pays for.
 *
 * **Gender.** A Russian past-tense verb agrees with its subject, and a
 * notification names a person whose gender we do not know. Nothing below agrees
 * with `{actorName}`: the copy uses a verbal noun («Расчёт от …») or the present
 * tense, both genderless.
 *
 * **Плитка героя на дашборде — 107 px**, измерено в Chromium на `/dashboard`
 * при 360; и подпись, и её пояснение стоят в `.truncate`. «Путешественники»
 * набирает 127 px в верхнем регистре и обрезается, поэтому здесь «Спутники»
 * (68 px) — те, кто едет вместе с вами, — а пояснение сокращено до
 * «в пространстве» (90 px вместо 121 px).
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Основные разделы',
  'nav.mobile': 'Разделы',
  'nav.dashboardLink': 'Панель planned.travel',
  'nav.homeLink': 'Главная страница planned.travel',
  'nav.newTrip': 'Новая поездка',

  'nav.trips': 'Мои поездки',
  'nav.trips.short': 'Поездки',
  'nav.vacay': 'Отпуска',
  'nav.vacay.short': 'Отпуска',
  'nav.atlas': 'Атлас',
  'nav.atlas.short': 'Атлас',
  'nav.journey': 'Дневник',
  'nav.journey.short': 'Дневник',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Разделы поездки',
  'trip.nav.back': 'Поездки',
  'trip.nav.share': 'Поделиться',
  'trip.nav.shareLabel': 'Поделиться этой поездкой',
  'trip.tab.plan': 'План',
  'trip.tab.transports': 'Транспорт',
  'trip.tab.book': 'Брони',
  'trip.tab.lists': 'Списки',
  'trip.tab.costs': 'Расходы',
  'trip.tab.files': 'Файлы',
  'trip.tab.collab': 'Общение',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Меню аккаунта',
  'account.settings': 'Настройки',
  'account.billing': 'Тариф и оплата',
  'account.admin': 'Администрирование',
  'account.signOut': 'Выйти',
  'account.signingOut': 'Выходим…',
  'account.signOutFailed': 'Не удалось выйти',
  'account.signOutFailedBody': 'Проверьте соединение и попробуйте снова.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Оформление',
  'theme.light': 'Светлая',
  'theme.dark': 'Тёмная',
  'theme.system': 'Как в системе',
  'theme.state.light': 'светлая',
  'theme.state.dark': 'тёмная',
  'theme.state.system': 'как в системе',
  'theme.trigger': 'Тема: {state}. Сменить тему',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Уведомления, непрочитанных нет',
  'bell.unread': {
    one: 'Уведомления, {unread} непрочитанное',
    few: 'Уведомления, {unread} непрочитанных',
    many: 'Уведомления, {unread} непрочитанных',
    other: 'Уведомления, {unread} непрочитанного',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Входящие',
  'inbox.title': 'Уведомления',
  'inbox.error': 'Входящие не загрузились',
  'inbox.allRead': 'Всё прочитано',
  'inbox.unread': {
    one: '{unread} непрочитанное сообщение',
    few: '{unread} непрочитанных сообщения',
    many: '{unread} непрочитанных сообщений',
    other: '{unread} непрочитанного сообщения',
  },
  'inbox.markAll': 'Отметить прочитанным',
  'inbox.markingAll': 'Отмечаем всё прочитанным',
  'inbox.cleared': 'Входящие очищены',
  'inbox.markAllFailed': 'Не удалось отметить всё',
  'inbox.retryHint': 'Проверьте соединение и попробуйте снова.',
  'inbox.filter.all': 'Всё',
  'inbox.filter.unread': 'Непрочитанные',
  'inbox.waiting': {
    one: '{invitations} приглашение ждёт',
    few: '{invitations} приглашения ждут',
    many: '{invitations} приглашений ждут',
    other: '{invitations} приглашения ждёт',
  },
  'inbox.empty.title': 'Во входящих пусто',
  'inbox.empty.body':
    'Приглашения в поездки, изменения в планах, напоминания о бронях и закрытые балансы — всё приходит сюда.',
  'inbox.empty.action': 'Назад к панели',
  'inbox.emptyUnread.title': 'Непрочитанного нет',
  'inbox.emptyUnread.body':
    'Прочитано всё. Переключитесь на «Всё», чтобы просмотреть историю.',
  'inbox.emptyUnread.action': 'Показать всё',
  'inbox.row.new': 'Новое',
  'inbox.row.accepted': 'Принято',
  'inbox.row.declined': 'Отклонено',
  'inbox.row.open': 'Открыть',
  'inbox.row.markRead': 'Прочитано',
  'inbox.row.markingRead': 'Отмечаем прочитанным',
  'inbox.row.markReadFailed': 'Не удалось отметить прочитанным',
  'inbox.preferences':
    'Выберите, что из этого попадёт во входящие, на почту и на телефон.',
  'inbox.preferencesAction': 'Настройки уведомлений',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Вас пригласили в {tripTitle}',
  'notification.trip.invited.body': 'Приглашение от {actorName}.',
  'notification.trip.updated.title': 'Изменения в {tripTitle}',
  'notification.trip.updated.body': 'Изменение плана от {actorName}.',
  'notification.trip.member_added.title':
    '{memberName} присоединяется к {tripTitle}',
  'notification.trip.member_added.body':
    'Этому человеку видны маршрут, брони и общие деньги.',
  'notification.trip.member_removed.title': '{memberName} покидает {tripTitle}',
  'notification.trip.member_removed.body': 'Доступ к этой поездке закрыт.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} начинается через {days} день',
    few: '{tripTitle} начинается через {days} дня',
    many: '{tripTitle} начинается через {days} дней',
    other: '{tripTitle} начинается через {days} дня',
  },
  'notification.trip.starting_soon.body':
    'Пора проверить список вещей и брони.',
  'notification.trip.copied.title': '{tripTitle} готова',
  'notification.trip.copied.body': {
    one: 'Перенесён {days} день',
    few: 'Перенесено {days} дня',
    many: 'Перенесено {days} дней',
    other: 'Перенесено {days} дня',
  },
  'notification.trip.copied.places': {
    one: '{places} место',
    few: '{places} места',
    many: '{places} мест',
    other: '{places} места',
  },
  'notification.trip.copied.dropped': {
    one: 'пропущена {dropped} заметка',
    few: 'пропущено {dropped} заметки',
    many: 'пропущено {dropped} заметок',
    other: 'пропущено {dropped} заметки',
  },
  'notification.trip.copyFailed.title': 'Не удалось скопировать {tripTitle}',
  'notification.trip.copyFailed.body':
    'Ничего не потеряно. Попробуйте снова из оригинала.',
  'notification.reservation.reminder.title': '{title} уже скоро',
  'notification.reservation.reminder.body':
    'Проверьте время и код подтверждения в брони.',
  'notification.reservation.confirmed.title': '{title} подтверждено',
  'notification.reservation.confirmed.body':
    'Бронь в поездке {tripTitle} отмечена подтверждённой.',
  'notification.expense.added.title': 'Новый расход от {actorName}',
  'notification.expense.added.body': '{title} в поездке {tripTitle}.',
  'notification.expense.settled.title': 'Расчёт от {actorName}',
  'notification.expense.settled.body': 'Баланс в поездке {tripTitle} закрыт.',
  'notification.list.assigned.title': 'Задача от {actorName}',
  'notification.list.assigned.body': '{title} в поездке {tripTitle}.',
  'notification.collab.message.title':
    'Новое сообщение от {actorName} в {tripTitle}',
  'notification.collab.message.body': '«{preview}»',
  'notification.collab.poll.title': 'В поездке {tripTitle} идёт голосование',
  'notification.collab.poll.body': '«{question}»',
  'notification.organization.invited.title':
    'Вас пригласили в {organizationName}',
  'notification.organization.invited.body':
    'Примите приглашение, чтобы войти в пространство и всё, что в нём общее.',
  'notification.journey.published.title': 'Опубликовано: {title}',
  'notification.journey.published.body':
    'Теперь дневник прочтёт любой, у кого есть ссылка.',
  'notification.billing.plan_changed.title': 'Тариф изменился',
  'notification.billing.plan_changed.body':
    'У {organizationName} теперь тариф {plan}.',
  'notification.billing.invoice_paid.title': 'Платёж получен',
  'notification.billing.invoice_paid.body':
    'Последний счёт для {organizationName} оплачен.',
  'notification.billing.payment_failed.title': 'Платёж не прошёл',
  'notification.billing.payment_failed.body':
    'У {organizationName} есть просроченный платёж. Обновите способ оплаты, чтобы сохранить тариф.',
  'notification.fallback.title': 'В вашем пространстве что-то изменилось',
  'notification.fallback.body': 'Откройте поездку и посмотрите, что именно.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Панель не загрузилась',
  'dashboard.blank.title': 'Здесь начинается ваша следующая поездка',
  'dashboard.blank.body':
    'Создайте поездку, отметьте на карте места, которые хотите увидеть, — и planned.travel построит вокруг них план по дням.',
  'dashboard.blank.action': 'Спланировать поездку',
  'dashboard.blank.secondary': 'Открыть атлас',

  'dashboard.upNext': 'Ближайшая поездка',
  'dashboard.openPlan': 'Открыть план',
  'dashboard.hero.travellers': 'Спутники',
  'dashboard.hero.dates': 'Даты поездки',
  'dashboard.hero.datesMissing': 'Добавьте даты, чтобы появились дни',
  'dashboard.hero.startsIn': 'Старт через',
  'dashboard.hero.started': 'Старт был',
  'dashboard.hero.today': 'Сегодня',
  'dashboard.hero.startUnknown': 'без даты старта',
  'dashboard.hero.startToday': 'хорошей дороги',
  'dashboard.hero.startPast': {
    one: 'день назад',
    few: 'дня назад',
    many: 'дней назад',
    other: 'дня назад',
  },
  'dashboard.hero.startFuture': {
    one: 'день',
    few: 'дня',
    many: 'дней',
    other: 'дня',
  },
  'dashboard.hero.nights': 'Ночи',
  'dashboard.hero.companionsHint': 'в этой поездке',
  'dashboard.hero.progress': 'В пути',
  'dashboard.hero.places': 'Места',
  'dashboard.hero.placesNone': 'на карте пока ничего',
  'dashboard.hero.placesHint': 'на карте',

  'dashboard.stat.countries': 'Посещённые страны',
  'dashboard.stat.countriesUnit': 'из {total}',
  'dashboard.stat.countriesNone': 'Отметьте страну, и атлас начнётся',
  'dashboard.stat.visits': {
    one: 'записан {visits} визит',
    few: 'записано {visits} визита',
    many: 'записано {visits} визитов',
    other: 'записано {visits} визита',
  },
  'dashboard.stat.trips': 'Поездок всего',
  'dashboard.stat.tripsCaption': '{planning} в планах · {booked} забронировано',
  'dashboard.stat.places': 'Места на карте',
  'dashboard.stat.placesNone': 'На карте пока ничего нет',
  'dashboard.stat.placesAcross': {
    one: 'в {trips} поездке',
    few: 'в {trips} поездках',
    many: 'в {trips} поездках',
    other: 'в {trips} поездки',
  },
  'dashboard.stat.bookings': 'Подтверждённые брони',
  'dashboard.stat.bookingsNone': 'Ближайших броней нет',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} бронь на подходе',
    few: '{bookings} брони на подходе',
    many: '{bookings} броней на подходе',
    other: '{bookings} брони на подходе',
  },

  'dashboard.trips.label': 'Ваши поездки',
  'dashboard.trips.all': 'Все поездки',
  'dashboard.trips.empty.title': 'Поездок пока нет',
  'dashboard.trips.empty.body':
    'Всё, что вы спланируете, появится здесь — новое сверху.',
  'dashboard.trips.empty.action': 'Создать поездку',

  'dashboard.bookings.label': 'Ближайшие брони',
  'dashboard.bookings.empty.title': 'Пока ничего не забронировано',
  'dashboard.bookings.empty.body':
    'Подтверждённые ночёвки, столики и билеты появятся здесь, когда приблизятся их даты.',

  'dashboard.pipeline.label': 'Этапы поездок',
  'dashboard.pipeline.empty':
    'В работе пока ничего. Первая поездка разложит это по этапам.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} избранная',
    few: '{favourites} избранные',
    many: '{favourites} избранных',
    other: '{favourites} избранной',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} поездка в архиве',
    few: '{archived} поездки в архиве',
    many: '{archived} поездок в архиве',
    other: '{archived} поездки в архиве',
  },

  'dashboard.storage.label': 'Хранилище',
  'dashboard.storage.count': '{used} из {limit}',
  'dashboard.storage.files': {
    one: '{files} файл во всех поездках, включая фото и билеты.',
    few: '{files} файла во всех поездках, включая фото и билеты.',
    many: '{files} файлов во всех поездках, включая фото и билеты.',
    other: '{files} файла во всех поездках, включая фото и билеты.',
  },
  'dashboard.storage.more': 'Нужно больше места?',
  'dashboard.storage.plans': 'Посмотреть тарифы',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Ориентиры',
  'dashboard.widgets.choose': 'Выбрать виджеты',
  'dashboard.widgets.description':
    'Виджеты, которые вы держите рядом с панелью.',
  'dashboard.clock.label': 'Мировые часы',
  'dashboard.clock.add': 'Добавить часовой пояс',
  'dashboard.clock.search': 'Поиск городов и регионов',
  'dashboard.clock.noMatches': 'Часового пояса с таким названием нет',
  'dashboard.clock.remove': 'Убрать {zone}',
  'dashboard.clock.offset': '{offset} от вашего времени',
  'dashboard.clock.here': 'Ваше собственное время',
  'dashboard.clock.empty.title': 'Часовые пояса не закреплены',
  'dashboard.clock.empty.body':
    'Закрепите место и читайте его часы рядом со своими.',
  'dashboard.clock.unknown.title': 'Это устройство не знает пояс {zone}',
  'dashboard.clock.unknown.body':
    'Его время здесь не прочитать. Уберите строку, чтобы это исправить.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Консоль администратора не загрузилась',
  'admin.denied.title': 'Сюда заходят только администраторы пространства',
  'admin.denied.body':
    'Если это вам нужно, попросите владельца или администратора пространства сменить вашу роль.',
  'admin.denied.action': 'Назад к панели',
  'admin.eyebrow': 'Управление простором',
  'admin.description': 'Тариф {plan} · создано {date}',
  'admin.createdUnknown': 'недавно',
  'admin.workspaceSettings': 'Настройки пространства',
  'admin.billing': 'Тариф и оплата',

  'admin.invitations.title': {
    one: '{invitations} приглашение ещё открыто',
    few: '{invitations} приглашения ещё открыты',
    many: '{invitations} приглашений ещё открыты',
    other: '{invitations} приглашения ещё открыто',
  },
  'admin.invitations.body':
    'Каждое открытое приглашение занимает одно из мест, которые оплачивает тариф.',
  'admin.invitations.action': 'Просмотреть приглашения',

  'admin.stat.members': 'Участники',
  'admin.stat.membersCaption': {
    one: '{invitations} приглашение в ожидании',
    few: '{invitations} приглашения в ожидании',
    many: '{invitations} приглашений в ожидании',
    other: '{invitations} приглашения в ожидании',
  },
  'admin.stat.storage': 'Хранилище',
  'admin.stat.storageUnit': 'из {limit}',
  'admin.stat.storageUnlimited': 'без ограничений',
  'admin.stat.storageCaption': 'Файлы, фото и выгрузки',
  'admin.stat.audit': 'Записи аудита',
  'admin.stat.auditCaption': 'Свежая активность — ниже',
  'admin.stat.plan': 'Тариф',
  'admin.stat.planCaption': 'Лимиты проверяются на границе репозиториев',

  'admin.quotas.label': 'Лимиты',
  'admin.quotas.count': {
    one: '{metrics} показатель',
    few: '{metrics} показателя',
    many: '{metrics} показателей',
    other: '{metrics} показателя',
  },
  'admin.quotas.unlimited': 'Без ограничений',
  'admin.quotas.value': '{used} из {limit}',

  'admin.members.label': 'Участники',
  'admin.members.table': 'Участники этого пространства',
  'admin.members.person': 'Человек',
  'admin.members.role': 'Роль',
  'admin.members.joined': 'В команде с',

  'admin.activity.label': 'Недавняя активность',
  'admin.activity.empty.title': 'Пока ничего не записано',
  'admin.activity.empty.body':
    'Каждая значимая запись попадает в журнал аудита в тот момент, когда происходит.',
  'admin.activity.workspace': 'само пространство',
  'admin.actions.label': 'Самые частые действия',
  'admin.actions.count': {
    one: '{actions} действие',
    few: '{actions} действия',
    many: '{actions} действий',
    other: '{actions} действия',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Черновик',
  'tripStatus.planning': 'В планах',
  'tripStatus.booked': 'Забронирована',
  'tripStatus.active': 'Активна',
  'tripStatus.completed': 'Завершена',
  'tripStatus.archived': 'В архиве',

  'bookingStatus.none': 'Без брони',
  'bookingStatus.pending': 'В ожидании',
  /**
   * The dashboard's reservation rows put this chip beside a truncating date
   * line, so every pixel it takes comes straight off that line. At 360px
   * `Подтверждена` measured 100px and clipped the date; `Принята` is what a
   * Russian booking says once it stops being «В ожидании».
   */
  'bookingStatus.confirmed': 'Принята',
  'bookingStatus.cancelled': 'Отменена',
  'bookingStatus.completed': 'Состоялась',

  'bookingType.accommodation': 'Ночёвка',
  'bookingType.restaurant': 'Столик',
  'bookingType.activity': 'Активность',
  'bookingType.tour': 'Экскурсия',
  'bookingType.ticket': 'Билет',
  'bookingType.transport': 'Переезд',
  'bookingType.other': 'Бронь',

  'role.owner': 'Владелец',
  'role.admin': 'Администратор',
  'role.member': 'Участник',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} поездка',
    few: '{value} поездки',
    many: '{value} поездок',
    other: '{value} поездки',
  },
  'trips.count.favourites': {
    one: '{value} избранная',
    few: '{value} избранные',
    many: '{value} избранных',
    other: '{value} избранной',
  },
  'trips.count.archived': {
    one: '{value} в архиве',
    few: '{value} в архиве',
    many: '{value} в архиве',
    other: '{value} в архиве',
  },
  'trips.atLimit.body':
    'Ваш тариф покрывает {trips}. Отправьте в архив завершённую или перейдите на тариф выше, чтобы держать больше открытыми одновременно.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Новый дневник',
  'newJourney.title': 'Начните дневник',
  'newJourney.description':
    'Дневник — записанная сторона поездки: записи по датам, с фотографиями и погодой, которую вы помните.',
  'newJourney.titlePlaceholder': 'Две недели в Киото',
  'newJourney.subtitle': 'Подзаголовок',
  'newJourney.subtitleHint': 'Одна строка под заголовком, на обложке.',
  'newJourney.subtitlePlaceholder': 'Храмы, поезда и слишком много матчи',
  'newJourney.trip': 'На основе поездки',
  'newJourney.tripHint': 'Необязательно — связывает рассказ с его планом.',
  'newJourney.tripNone': 'Без привязки к поездке',
  'newJourney.datesError': 'Дата окончания раньше начала.',
  'newJourney.submit': 'Создать дневник',
  'newJourney.creating': 'Создаём дневник',
  'newJourney.created': 'Дневник начат',
  'newJourney.createdBody': 'Добавьте первую запись, чтобы начать рассказ.',
  'newJourney.error': 'Дневник не удалось создать. Попробуйте через минуту.',
  'newCollection.trigger': 'Новая подборка',
  'newCollection.title': 'Начните подборку',
  'newCollection.description':
    'Место для мест, которые вы находите раньше, чем узнаёте, к какой поездке они относятся.',
  'newCollection.namePlaceholder': 'Кофе, за которым стоит пройти через город',
  'newCollection.descriptionHint': 'Что сюда входит, а что нет.',
  'newCollection.submit': 'Создать подборку',
  'newCollection.creating': 'Создаём подборку',
  'newCollection.created': 'Подборка создана',
  'newCollection.createdBody': 'Начните сохранять в неё места.',
  'newCollection.error':
    'Подборку не удалось создать. Попробуйте через минуту.',

  'newTrip.title': 'Начните новую поездку',
  'newTrip.description':
    'Достаточно названия. Даты построят план по дням, а остальное может подождать, пока вы не будете знать.',
  'newTrip.name': 'Название поездки',
  'newTrip.namePlaceholder': 'Киото в сезон сакуры',
  'newTrip.destination': 'Направление',
  'newTrip.destinationHint': 'Город, регион или весь маршрут.',
  'newTrip.destinationPlaceholder': 'Киото, Япония',
  'newTrip.departure': 'Выезд',
  'newTrip.return': 'Возвращение',
  'newTrip.returnError': 'Дата возвращения раньше выезда.',
  'newTrip.currency': 'Валюта бюджета',
  'newTrip.currencyHint': 'В ней суммируется каждый расход этой поездки.',
  'newTrip.submit': 'Создать поездку',
  'newTrip.creating': 'Создаём поездку',
  'newTrip.error': 'Поездку не удалось создать. Попробуйте через минуту.',
  'newTrip.created': 'Поездка создана',
  'newTrip.createdBody': 'Начните расставлять места на карте.',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Действия для «{title}»',
  'tripActions.copy': 'Копировать',
  'tripActions.favourite': 'В избранное',
  'tripActions.unfavourite': 'Убрать из избранного',
  'tripActions.edit': 'Изменить',
  'tripActions.archive': 'В архив',
  'tripActions.restore': 'Восстановить',
  'tripActions.delete': 'Удалить',
  'tripActions.deleteForGood': 'Удалить навсегда',
  'tripActions.starFailed': 'Избранное не сохранилось',
  'tripActions.starFallback': 'Поездка вернулась в прежнее состояние.',
  'tripActions.archived': 'Поездка в архиве',
  'tripActions.archiveFailed': 'Не удалось отправить поездку в архив',
  'tripActions.restored': 'Поездка восстановлена',
  'tripActions.restoreFailed': 'Не удалось восстановить поездку',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Изменить поездку',
  'editTrip.submit': 'Сохранить изменения',
  'editTrip.saving': 'Сохранение поездки',
  'editTrip.cancel': 'Отмена',
  'editTrip.saved': 'Поездка обновлена',
  'editTrip.errorTitle': 'Это не сохранилось',
  'editTrip.retry': 'Повторить',
  'editTrip.error':
    'Не удалось сохранить поездку. Попробуйте ещё раз через мгновение.',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Удалить «{title}» навсегда?',
  'deleteTrip.description':
    'Отмены и корзины нет. Архив убирает поездку из списка, не теряя её.',
  'deleteTrip.reading': 'Читаем, что содержит эта поездка',
  'deleteTrip.errorTitle': 'Это не загрузилось',
  'deleteTrip.summaryError': 'Не удалось прочитать, что содержит эта поездка.',
  'deleteTrip.confirmLabel': 'Введите название поездки для подтверждения',
  'deleteTrip.deleting': 'Удаление поездки',
  'deleteTrip.deleted': 'Поездка удалена',
  'deleteTrip.failed': 'Не удалось удалить поездку',
  'deleteTrip.carried.reservations': {
    one: 'бронирование',
    few: 'бронирования',
    many: 'бронирований',
    other: 'бронирования',
  },
  'deleteTrip.carried.transports': {
    one: 'перемещение',
    few: 'перемещения',
    many: 'перемещений',
    other: 'перемещения',
  },
  'deleteTrip.carried.expenses': {
    one: 'расход',
    few: 'расхода',
    many: 'расходов',
    other: 'расхода',
  },
  'deleteTrip.carried.files': {
    one: 'файл',
    few: 'файла',
    many: 'файлов',
    other: 'файла',
  },
  'deleteTrip.carried.members': {
    one: 'человек',
    few: 'человека',
    many: 'человек',
    other: 'человека',
  },
  'copyTrip.title': 'Копировать «{title}»',
  'copyTrip.nameLabel': 'Название копии',
  'copyTrip.titleRequired': 'Дайте копии название.',
  'copyTrip.datesLabel': 'Даты',
  'copyTrip.datesTogether': 'Укажите обе даты или очистите обе.',
  'copyTrip.clearDates': 'Копировать без дат',
  'copyTrip.carries':
    'Дни, места и заметки переносятся. Брони, деньги, файлы и люди — нет.',
  'copyTrip.shorter':
    'Это короче оригинала. Места лишних дней уйдут в идеи, а их заметки пропадут.',
  'copyTrip.submit': 'Копировать поездку',
  'copyTrip.copying': 'Копирование поездки',
  'copyTrip.cancel': 'Отмена',
  'copyTrip.started': 'Копируем «{title}»',
  'copyTrip.errorTitle': 'Это не скопировалось',
  'copyTrip.error':
    'Не удалось скопировать поездку. Попробуйте ещё раз через мгновение.',

  /* ------------------------------------ who can see a thing */
  'visibility.label': 'Кто это увидит',
  'visibility.private': 'Только я',
  'visibility.organization': 'Все в пространстве',
  'visibility.public': 'Любой, у кого есть ссылка',

  'trips.error': 'Ваши поездки не загрузились',
  'trips.eyebrow': 'Пространство',
  'trips.nothingPlanned': 'Пока ничего не запланировано',
  'trips.search': 'Искать поездки',
  'trips.atLimit.title': 'Вы заняли все поездки, которые допускает тариф',
  'trips.atLimit.action': 'Сравнить тарифы',
  'trips.noMatch.title': 'Под этот фильтр ничего не подходит',
  'trips.noMatch.body':
    'Попробуйте другой этап, очистите поиск или посмотрите в архиве.',
  'trips.noMatch.action': 'Сбросить фильтры',
  'trips.empty.body':
    'Поездка держит план по дням, карту, брони, списки вещей и деньги. Начните одну — остальное подтянется.',
  'trips.next.title': 'Куда-нибудь дальше',
  'trips.next.body':
    'Начните поездку, и planned.travel создаст день на каждую дату, готовый к тому, что вы сохранили.',
  'trips.savedPlaces': 'Сохранённые места',
  'trips.filter.all': 'Все',
  'trips.filter.favourites': 'Избранные',
  'trips.view.label': 'Вид',
  'trips.view.grid': 'Сетка',
  'trips.view.list': 'Список',
  'trips.card.favourite': 'Избранная',
  'trips.card.noDestination': 'Направление пока не выбрано',
  'trips.card.noDates': 'Даты пока не выбраны',
  'trips.card.startsIn': 'через {days} д',
  'trips.card.days': '{days} д',
  'trips.card.copying': 'Копируется',
  'trips.card.copyingLabel': '{title} ещё копируется',
  'trips.card.copyingReason': 'Дождитесь окончания копирования.',
  'metric.trips': 'Поездки',
  'metric.places': 'Места',
  'metric.members': 'Участники',
  'metric.files': 'Файлы',
  'metric.storage_bytes': 'Хранилище',
  'metric.collections': 'Коллекции',
  'metric.journeys': 'Дневники',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Это не загрузилось',
  'error.body':
    'Ничего не потеряно. Попробуйте снова, а если будет повторяться — пришлите нам подробности ниже.',
  'error.retry': 'Попробовать снова',
  'error.dashboard': 'Назад к панели',
  'error.reported': 'Мы получили уведомление и уже разбираемся.',
  'error.reference': 'Номер обращения',
  'error.feedback.open': 'Расскажите, что произошло',
  'error.feedback.label': 'Что вы делали, когда это случилось?',
  'error.feedback.send': 'Отправить',
  'error.feedback.sent': 'Спасибо — это очень помогает.',
  'error.feedback.failed':
    'Отправить не удалось. Номер обращения выше всё равно доходит до нас.',
  'error.root': 'Мы сбились с маршрута',
  'error.session': 'Ваш доступ к пространству изменился',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Сообщить о проблеме',
  'feedback.formTitle': 'Сообщить о проблеме',
  'feedback.messageLabel': 'Что не так или что нужно изменить?',
  'feedback.messagePlaceholder':
    'Чего вы ожидали и что произошло вместо этого?',
  'feedback.emailLabel': 'Электронная почта',
  'feedback.emailPlaceholder': 'ivan@example.com',
  'feedback.isRequiredLabel': '(обязательно)',
  'feedback.submitButtonLabel': 'Отправить сообщение',
  'feedback.cancelButtonLabel': 'Отмена',
  'feedback.confirmButtonLabel': 'Подтвердить',
  'feedback.addScreenshotButtonLabel': 'Добавить снимок экрана',
  'feedback.removeScreenshotButtonLabel': 'Убрать снимок экрана',
  'feedback.highlightToolText': 'Выделить',
  'feedback.hideToolText': 'Скрыть',
  'feedback.successMessageText': 'Спасибо — сообщение получено.',
  'feedback.errorEmptyMessageText':
    'Сначала напишите хотя бы предложение — пустое сообщение ничего нам не говорит.',
  'feedback.errorTimeoutText':
    'Это занимает слишком много времени, и мы не можем подтвердить, что сообщение отправлено.',
  'feedback.errorForbiddenText':
    'Этой странице не разрешено отправлять сообщения.',
  'feedback.errorGenericText':
    'Отправить не удалось. Проверьте соединение и не мешает ли блокировщик рекламы.',

  'notFound.eyebrow': 'Ошибка 404',
  'notFound.title': 'Этой страницы нет на карте',
  'notFound.body':
    'Ссылка могла устареть, а поездка, на которую она вела, — переехать или быть удалённой.',
  'notFound.trips': 'Все поездки',
  'notFound.rootBody':
    'Мы искали по всему маршруту. Возможно, в адресе опечатка или страница уехала дальше.',
  'notFound.home': 'На главную',
  'notFound.plans': 'Посмотреть тарифы',

  'session.noWorkspace':
    'Ваш аккаунт пока не привязан к пространству. Выйдите и войдите снова, чтобы настройка завершилась.',
  'session.membershipRemoved': 'Ваше участие в этом пространстве прекращено.',
} satisfies TranslationOf<typeof En>

export default messages
