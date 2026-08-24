/**
 * Everything the settings module says, in Russian.
 *
 * Authored from `../en/settings.ts` (`docs/SPEC.md` §8.9). The English file is
 * the schema; `__tests__/parity.test.ts` checks the placeholders, the plural
 * branches and that nothing English is left sitting here (§8.6).
 *
 * **Plural.** `ru` needs `one` (1, 21 …) · `few` (2–4) · `many` (0, 5–20) ·
 * `other` (fractions).
 *
 * **Currency names are lower case**, as Russian writes them: «евро», «фунт
 * стерлингов», «японская иена». The ISO code beside them is derived in the
 * route.
 *
 * **Plan names are words, not proper nouns** (see the English file's note on
 * `billing.plan.*`): the stable identifier is the plan *id*, which no reader
 * sees. `Solo` is travelling alone, `Crew` is the group.
 *
 * **«Тариф», not «план»**: Russian keeps «план» for a trip's itinerary, so the
 * subscription is a tariff everywhere it is named on its own.
 *
 * **Два жёстких пиксельных бюджета**, измеренных в Chromium на `/settings`
 * при 1440 (оба `.truncate`, поэтому лишнее обрезается, а не переносится):
 * подпись под каждой ссылкой боковой навигации — 196 px, а кнопка
 * регионального `Select` — 206 px. Английский оригинал доходит до 189 px и
 * 212 px соответственно, так что дословный, более длинный перевод обрезается.
 * Поэтому `nav.language.hint` — «Язык, которым говорят экраны» (179 px), а
 * `regional.workspaceDefault` начинается с «Пространство — » (197 px с самым
 * длинным значением), а не с «Настройка пространства — » (261 px).
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Аккаунт',
  'page.title': 'Настройки',
  'page.description':
    'Всё о вас, о вашем пространстве и о том, как ведёт себя planned.travel',
  'page.error': 'Настройки не загрузились',

  'nav.label': 'Разделы настроек',
  'nav.profile': 'Профиль',
  'nav.profile.hint': 'Вы и ваш формат дат и денег',
  'nav.language': 'Язык',
  'nav.language.hint': 'Язык, которым говорят экраны',
  'nav.appearance': 'Оформление',
  'nav.appearance.hint': 'Тема, анимация и карта',
  'nav.security': 'Безопасность',
  'nav.security.hint': 'Пароль, второй фактор и ключи',
  'nav.notifications': 'Уведомления',
  'nav.notifications.hint': 'Входящие, почта и телефон',
  'nav.workspace': 'Пространство',
  'nav.workspace.hint': 'Участники и общие настройки',
  'nav.billing': 'Оплата',
  'nav.billing.hint': 'Тариф, места и счета',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Сохранить изменения',
  'error.retryBody':
    'Ничего не потеряно. Проверьте соединение и попробуйте снова.',
  'role.owner': 'Владелец',
  'role.admin': 'Администратор',
  'role.member': 'Участник',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Пространство — {value}',
  'regional.currency.AUD': 'австралийский доллар',
  'regional.currency.CAD': 'канадский доллар',
  'regional.currency.CHF': 'швейцарский франк',
  'regional.currency.EUR': 'евро',
  'regional.currency.GBP': 'фунт стерлингов',
  'regional.currency.JPY': 'японская иена',
  'regional.currency.PLN': 'польский злотый',
  'regional.currency.SEK': 'шведская крона',
  'regional.currency.USD': 'доллар США',
  'regional.distance.metric': 'Километры',
  'regional.distance.imperial': 'Мили',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Ваш профиль не загрузился',
  'profile.account.title': 'Ваш аккаунт',
  'profile.account.description':
    'Имя и адрес почты приходят из того аккаунта, через который вы входите.',
  'profile.email.verified': 'Почта подтверждена',
  'profile.email.unverified': 'Почта не подтверждена',
  'profile.twoFactor.on': 'Второй фактор включён',
  'profile.figure.workspace': 'Пространство',
  'profile.figure.role': 'Роль',
  'profile.figure.joined': 'В команде с',
  'profile.figure.joinedUnknown': 'Не записано',
  'profile.regional.title': 'Даты, деньги и единицы',
  'profile.regional.description':
    'Это перекрывает настройки пространства только для вас. Оставьте выбор по умолчанию — и поле пойдёт за пространством.',
  'profile.regional.saving': 'Сохраняем ваши настройки',
  'profile.regional.saved': 'Ваши настройки сохранены',
  'profile.regional.saveFailed': 'Ваши настройки не сохранились',
  'profile.language.label': 'Язык',
  'profile.language.hint':
    'Выбирается на отдельном экране, где каждый язык написан своим письмом.',
  'profile.language.action': 'Сменить',
  'profile.timezone.label': 'Часовой пояс',
  'profile.timezone.hint':
    'Время выездов и прибытий показываем относительно него.',
  'profile.currency.label': 'Валюта',
  'profile.currency.hint':
    'Новые поездки начинаются в этой валюте; у каждой поездки может быть своя.',
  'profile.dateFormat.label': 'Формат даты',
  'profile.weekStart.label': 'Неделя начинается с',
  'profile.weekStart.hint':
    'Действует в каждом календаре, включая годовую сетку отпусков.',
  'profile.distance.label': 'Расстояние',

  /* --------------------------------------------------------------- language */
  'language.error': 'Настройки языка не загрузились',
  'language.section.title': 'Язык',
  'language.section.description':
    'Каждый экран, каждая кнопка и каждая дата читаются на языке, который вы выберете здесь, — их двадцать три, и каждый написан своим письмом.',
  'language.label': 'Выберите язык',
  'language.followWorkspace': 'Как в пространстве',
  'language.state.yours': 'Ваш язык',
  'language.state.workspace': 'Из настроек пространства',
  'language.state.hint.override':
    'Ваш собственный выбор. Он действует только для вас, на каждом устройстве, откуда вы входите.',
  'language.state.hint.workspace':
    'Своего языка у вас нет, поэтому вы читаете тот, на который настроено пространство. Владелец или администратор может сменить его в разделе «Пространство».',
  'language.saved': 'planned.travel теперь говорит на языке {language}',
  'language.saveFailed': 'Язык не сменился',
  'language.saveFailedBody':
    'Ничего не потеряно, и вы по-прежнему читаете на языке {language}. Проверьте соединение и выберите снова.',
  'language.reload.title': 'Ваш язык сохранён',
  'language.reload.body':
    'Эта страница не успела переключиться на {language}. Обновите её, чтобы читать продукт на новом языке.',
  'language.sample.title': 'Как будут читаться даты и числа',
  'language.sample.description':
    'Три одинаковых значения, записанные так, как их записывает этот язык.',
  'language.sample.date': 'Дата',
  'language.sample.number': 'Число',
  'language.sample.money': 'Сумма',
  'language.legal':
    'Условия и политику конфиденциальности мы публикуем только на английском. Всё остальное в продукте переведено.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Оформление не загрузилось',
  'appearance.theme.title': 'Тема',
  'appearance.theme.description':
    'Обе темы нарисованы, а не вывернуты наизнанку. Возьмите ту, которую читать удобнее.',
  'appearance.theme.light': 'Светлая',
  'appearance.theme.lightHint': 'Тёплая бумага, весь день',
  'appearance.theme.dark': 'Тёмная',
  'appearance.theme.darkHint': 'Тёплый графит, никогда не чёрный',
  'appearance.theme.system': 'Системная',
  'appearance.theme.systemHint': 'Как на устройстве',
  'appearance.theme.showing': 'Сейчас действует палитра: {palette}.',
  'appearance.theme.showingSystem':
    'Сейчас действует палитра: {palette}, следом за настройкой устройства.',
  'appearance.palette.light': 'светлая',
  'appearance.palette.dark': 'тёмная',
  'appearance.motion.title': 'Анимация и карты',
  'appearance.motion.label': 'Меньше анимации',
  'appearance.motion.hint':
    'Сворачивает анимации появления до простого проявления. Системную настройку уменьшения движения мы уважаем всегда.',
  'appearance.map.label': 'Стиль карты',
  'appearance.map.hint': 'Основа карты в планировщике и атласе.',
  'appearance.map.workspace': 'Как в пространстве',
  'appearance.map.light': 'Бумага — светлая',
  'appearance.map.dark': 'Графит — тёмная',
  'appearance.saveFailed': 'Это изменение не сохранилось',
  'appearance.saveFailedBody':
    'Здесь оно видно, но на следующем устройстве, откуда вы войдёте, его не будет.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Безопасность не загрузилась',
  'security.unverified.title': 'Ваш адрес почты пока не подтверждён',
  'security.unverified.body':
    'Сбросы пароля и приглашения в поездки уходят на {email}. Подтверждение — это то, что доказывает, что адрес ваш.',
  'security.unverified.action': 'Отправить ссылку снова',
  'security.signin.title': 'Вход',
  'security.signin.description':
    'Чем вы доказываете, что это вы. Второй фактор и ключи доступа сильнее одного пароля.',
  'security.email.label': 'Электронная почта',
  'security.email.verified': 'Подтверждён',
  'security.email.unverified': 'Не подтверждён',
  'security.password.label': 'Пароль',
  'security.password.hint':
    'Меняйте его когда угодно — мы пришлём одноразовую ссылку, а не спросим старый.',
  'security.password.action': 'Сменить пароль',
  'security.twoFactor.label': 'Двухфакторная аутентификация',
  'security.twoFactor.onHint':
    'При каждом новом входе нужен код из приложения-аутентификатора.',
  'security.twoFactor.offHint':
    'Добавьте к паролю шестизначный код из приложения-аутентификатора.',
  'security.twoFactor.on': 'Вкл.',
  'security.twoFactor.off': 'Выкл.',
  'security.twoFactor.manage': 'Настроить',
  'security.twoFactor.enable': 'Включить',
  'security.passkeys.label': 'Ключи доступа',
  'security.passkeys.hint':
    'Входите отпечатком, Face ID или аппаратным ключом — ничего печатать не нужно.',
  'security.passkeys.action': 'Управлять ключами',
  'security.session.title': 'Этот сеанс',
  'security.session.description': 'Браузер, в котором вы это читаете.',
  'security.session.label': 'Выполнен вход как',
  'security.session.expires': 'Действует до {date}',
  'security.session.expiresSoon': 'скоро',
  'security.session.noExpiry': 'Срок не записан',
  'security.signOut.label': 'Выйти',
  'security.signOut.hint':
    'Завершает этот сеанс и возвращает на страницу входа. Другие устройства останутся внутри.',
  'security.signOut.pending': 'Выходим',
  'security.signOut.failed': 'Выйти не удалось',
  'security.signOut.failedBody': 'Проверьте соединение и попробуйте снова.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Настройки уведомлений не загрузились',
  'notifications.title': 'Уведомления',
  'notifications.description':
    'Каждый переключатель действует только для вас. Выключив его, вы не остановите событие — только наше сообщение о нём.',
  'notifications.caption': 'Какие уведомления доходят до какого канала',
  'notifications.event': 'Событие',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Эта настройка не сохранилась',
  'notifications.saveFailedBody':
    'Переключатель вернули на место. Проверьте соединение и попробуйте снова.',
  'notifications.channel.in_app': 'В приложении',
  'notifications.channel.in_app.hint': 'Колокольчик в верхней панели',
  'notifications.channel.email': 'Эл. почта',
  'notifications.channel.email.hint': 'На адрес, с которым вы входите',
  'notifications.channel.push': 'Пуш',
  'notifications.channel.push.hint': 'На устройствах, где вы это разрешили',
  'notifications.event.trip.invited': 'Приглашения в поездки',
  'notifications.event.trip.invited.hint':
    'Кто-то добавляет вас в поездку, которую планирует.',
  'notifications.event.trip.updated': 'Изменения в плане',
  'notifications.event.trip.updated.hint':
    'В поездке, где вы участвуете, сдвигается день, остановка или дата.',
  'notifications.event.trip.starting_soon': 'Напоминания о выезде',
  'notifications.event.trip.starting_soon.hint':
    'Небольшое напоминание в дни перед началом поездки.',
  'notifications.event.reservation.reminder': 'Напоминания о бронях',
  'notifications.event.reservation.reminder.hint':
    'Приближается ночёвка, столик или билет.',
  'notifications.event.expense.added': 'Новые расходы',
  'notifications.event.expense.added.hint':
    'Кто-то записывает деньги, потраченные в общей поездке.',
  'notifications.event.expense.settled': 'Закрытые балансы',
  'notifications.event.expense.settled.hint':
    'Баланс, который вас касался, закрыт.',
  'notifications.event.list.assigned': 'Назначенные задачи',
  'notifications.event.list.assigned.hint':
    'Что-то из списка вещей или дел становится вашим.',
  'notifications.event.collab.message': 'Разговор о поездке',
  'notifications.event.collab.message.hint':
    'Новые сообщения в поездке, куда вы едете.',
  'notifications.event.organization.invited': 'Приглашения в пространство',
  'notifications.event.organization.invited.hint':
    'Вас приглашают в рабочее пространство.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Пространство не загрузилось',
  'workspace.summary.description': 'Тариф {plan} · создано {date}',
  'workspace.summary.createdRecently': 'недавно',
  'workspace.summary.billingAction': 'Тариф и оплата',
  'workspace.seats.label': 'Занятые места',
  'workspace.seats.value': '{used} из {limit}',
  'workspace.seats.note':
    'Открытые приглашения занимают места, так что пространство никогда не выйдет за тариф, который оплачивает.',
  'workspace.seatsFull.title': 'Все места на этом тарифе заняты',
  'workspace.seatsFull.body':
    '{members} и {invitations} заполняют лимит в {limit} мест.',
  'workspace.seatsFull.action': 'Добавить места',
  'workspace.members.count': {
    one: '{value} участник',
    few: '{value} участника',
    many: '{value} участников',
    other: '{value} участника',
  },
  'workspace.invitations.count': {
    one: '{value} приглашение в ожидании',
    few: '{value} приглашения в ожидании',
    many: '{value} приглашений в ожидании',
    other: '{value} приглашения в ожидании',
  },
  'workspace.members.title': 'Участники',
  'workspace.members.description':
    'Все, кто видит поездки, деньги и файлы в этом пространстве.',
  'workspace.members.tableLabel': 'Участники этого пространства',
  'workspace.members.person': 'Человек',
  'workspace.members.role': 'Роль',
  'workspace.members.joined': 'В команде с',
  'workspace.invitations.title': 'Приглашения',
  'workspace.invitations.description':
    'Те, кого пригласили, но кто пока не вошёл.',
  'workspace.invitations.emptyTitle': 'Открытых приглашений нет',
  'workspace.invitations.emptyBody':
    'Все приглашённые в это пространство уже вошли.',
  'workspace.invitations.expires': 'Действует до {date}',
  'workspace.invitations.expiresSoon': 'скоро',
  'workspace.defaults.title': 'Общие настройки',
  'workspace.defaults.description':
    'С чего начинается новая поездка и новый человек. Каждый может перекрыть это для себя в своём профиле.',
  'workspace.defaults.readOnly': 'Только чтение',
  'workspace.defaults.saving': 'Сохраняем настройки пространства',
  'workspace.defaults.saved': 'Настройки пространства сохранены',
  'workspace.defaults.saveFailed': 'Настройки пространства не сохранились',
  'workspace.defaults.saveFailedBody':
    'Менять их может только владелец или администратор. Проверьте соединение и попробуйте снова.',
  'workspace.currency.label': 'Валюта по умолчанию',
  'workspace.currency.hint': 'В ней считаются бюджеты новых поездок.',
  'workspace.language.label': 'Язык',
  'workspace.language.hint': 'То, что читает участник, не выбравший свой язык.',
  'workspace.timezone.label': 'Часовой пояс',
  'workspace.dateFormat.label': 'Формат даты',
  'workspace.weekStart.label': 'Неделя начинается с',
  'workspace.distance.label': 'Расстояние',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Оплата не загрузилась',
  'billing.loading': 'Загружаем тариф и квитанции',
  'billing.status.none': 'Без подписки',
  'billing.status.trialing': 'Пробный период',
  'billing.status.active': 'Активна',
  'billing.status.past_due': 'Платёж не прошёл',
  'billing.status.unpaid': 'Не оплачена',
  'billing.status.paused': 'Приостановлена',
  'billing.status.canceled': 'Отменена',
  'billing.status.incomplete': 'Не завершена',
  'billing.status.incomplete_expired': 'Истекла',

  'billing.checkout.completeTitle': 'Платёж получен',
  'billing.checkout.completeBody':
    'Новый тариф уже применяется. Он появится здесь в тот момент, когда Stripe его подтвердит, — обычно за несколько секунд.',
  'billing.checkout.cancelledTitle': 'Оплата прервана',
  'billing.checkout.cancelledBody': 'Ничего не списано, и тариф не изменился.',
  'billing.portal.backTitle': 'Возвращение из Stripe',
  'billing.portal.backBody':
    'Всё, что вы там изменили, появится здесь, как только Stripe это подтвердит.',
  'billing.refresh': 'Обновить',
  'billing.readOnly.title': 'Вы участник этого пространства',
  'billing.readOnly.body':
    'Подписку меняет только владелец или администратор. Всё ниже доступно вам только для чтения.',

  'billing.hero.label': 'Текущий тариф',
  'billing.hero.endsAtPeriod': 'Закончится в конце периода',
  'billing.hero.perYear': '/ год',
  'billing.hero.perMonth': '/ мес.',
  'billing.hero.freeAllowance': '{trips} поездки, один путешественник',
  'billing.hero.perSeatLine': '{seats} × {price}',
  'billing.hero.singleTraveller': 'Один путешественник',
  'billing.hero.paymentMethod': 'Способ оплаты',
  'billing.hero.cancel': 'Отказаться от тарифа',
  'billing.price.free': 'Бесплатно',
  'billing.stripe.opening': 'Открываем Stripe',
  'billing.stripe.failed': 'Со Stripe связаться не удалось',
  'billing.stripe.failedBody':
    'Ничего не списано. Проверьте соединение и попробуйте через минуту.',

  'billing.renewal.trialEndsToday':
    'Пробный период кончается сегодня. Добавьте карту, и модули останутся открытыми.',
  'billing.renewal.trialEndsIn': {
    one: 'Пробный период кончается через {value} день. До тех пор карта не нужна.',
    few: 'Пробный период кончается через {value} дня. До тех пор карта не нужна.',
    many: 'Пробный период кончается через {value} дней. До тех пор карта не нужна.',
    other:
      'Пробный период кончается через {value} дня. До тех пор карта не нужна.',
  },
  'billing.renewal.trialEnded': 'Пробный период закончился.',
  'billing.renewal.endsNoDate':
    'Этот тариф должен закончиться и не будет продлён.',
  'billing.renewal.endsOn':
    'Этот тариф заканчивается {date}. Ничего не удалится — платные модули просто закроются.',
  'billing.renewal.pastDue':
    'Последний платёж не прошёл. Обновите карту, чтобы не потерять платные модули.',
  'billing.renewal.unpaid':
    'Эта подписка не оплачена, а платные модули закрыты.',
  'billing.renewal.paused':
    'Эта подписка приостановлена. Возобновите её, когда снова соберётесь в дорогу.',
  'billing.renewal.lapsed':
    'Выберите тариф ниже, чтобы снова открыть брони, дневник и карты офлайн.',
  'billing.renewal.incomplete':
    'Stripe всё ещё ждёт подтверждения этого платежа.',
  'billing.renewal.free':
    'Две поездки одновременно, за наш счёт. Тариф повыше возьмёте, когда станет тесно.',
  'billing.renewal.auto': 'Продлевается автоматически.',
  'billing.renewal.renewsOn': 'Продлится {date}.',

  'billing.usage.title': 'Использование',
  'billing.usage.description':
    'Считается на ходу, поэтому счётчик никогда не устаревает. Лимиты идут за тарифом, который действует сейчас.',
  'billing.quota.seats': 'Участники',
  'billing.quota.trips': 'Поездки',
  'billing.quota.storageBytes': 'Хранилище',
  'billing.quota.unlimited': 'Без ограничений',
  'billing.quota.noLimit': 'На этом тарифе без ограничений',
  'billing.quota.used': 'Использовано: {quota}',
  'billing.quota.over.seats': {
    one: '{value} место сверх лимита этого тарифа',
    few: '{value} места сверх лимита этого тарифа',
    many: '{value} мест сверх лимита этого тарифа',
    other: '{value} места сверх лимита этого тарифа',
  },
  'billing.quota.over.trips': {
    one: '{value} место под поездку сверх лимита этого тарифа',
    few: '{value} места под поездки сверх лимита этого тарифа',
    many: '{value} мест под поездки сверх лимита этого тарифа',
    other: '{value} места под поездки сверх лимита этого тарифа',
  },
  'billing.quota.over.storage': '{value} сверх лимита этого тарифа',
  'billing.quota.exhausted.seats': 'Все места на этом тарифе заняты',
  'billing.quota.exhausted.trips':
    'Все места под поездки на этом тарифе заняты',
  'billing.quota.exhausted.storage': 'Хранилище на этом тарифе заполнено',
  'billing.quota.left': 'Осталось {value}',

  'billing.plans.title': 'Тарифы',
  'billing.plans.description':
    'Тариф меняйте когда угодно. Повышение пересчитываем по дням, а понижение ждёт конца оплаченного периода.',
  'billing.interval.label': 'Период оплаты',
  'billing.interval.monthly': 'Ежемесячно',
  'billing.interval.yearly': 'Ежегодно',
  'billing.interval.saving': 'Экономия {value}',
  'billing.plan.free.name': 'Бесплатный',
  'billing.plan.free.tagline': 'Спланируйте две ближайшие поездки',
  'billing.plan.free.feature.trips': 'Две поездки одновременно',
  'billing.plan.free.feature.itinerary': 'Маршрут по дням и карта',
  'billing.plan.free.feature.lists': 'Списки вещей и простые бюджеты',
  'billing.plan.free.feature.atlas':
    'Карта мира, которая помнит посещённые страны',
  'billing.plan.solo.name': 'Соло',
  'billing.plan.solo.tagline': 'Для того, кто планирует всё сам',
  'billing.plan.solo.feature.trips': 'Поездки без ограничений',
  'billing.plan.solo.feature.modules':
    'Все модули планирования — брони, дневник, бюджеты, сборы',
  'billing.plan.solo.feature.offline': 'Карты офлайн, скачанные ещё до вылета',
  'billing.plan.solo.feature.export': 'Экспорт в PDF и в календарь',
  'billing.plan.crew.name': 'Команда',
  'billing.plan.crew.tagline': 'Для семей, друзей и небольших команд',
  'billing.plan.crew.feature.members': 'До десяти человек, оплата за каждого',
  'billing.plan.crew.feature.realtime':
    'Работа вместе в реальном времени с живыми курсорами',
  'billing.plan.crew.feature.everything':
    'Поездки без ограничений и все модули',
  'billing.plan.crew.feature.storage':
    'Общее место для фотографий и документов всей группы',

  'billing.plan.current': 'Текущий тариф',
  'billing.plan.currentBadge': 'Нынешний',
  'billing.plan.popular': 'Популярный',
  'billing.plan.moveTo': 'Перейти на {plan}',
  'billing.plan.switchYearly': 'Платить за год',
  'billing.plan.switchMonthly': 'Платить за месяц',
  'billing.plan.upgradeTo': 'Поднять до {plan}',
  'billing.plan.changeTo': 'Сменить на {plan}',
  'billing.plan.perMemberMonth': '/ чел. / мес.',
  'billing.plan.perMonth': '/ мес.',
  'billing.plan.alwaysFree': 'Всегда бесплатно, без карты',
  'billing.plan.billedYearly': '{amount} к оплате за год',
  'billing.plan.billedMonthly': '{amount} к оплате за месяц',
  'billing.plan.members': 'Участники',
  'billing.plan.membersHint': 'Меняйте когда угодно — оплата идёт следом.',
  'billing.plan.seatOption': {
    one: '{value} участник',
    few: '{value} участника',
    many: '{value} участников',
    other: '{value} участника',
  },

  'billing.invoices.title': 'Счета',
  'billing.invoices.description':
    'Все квитанции этого пространства, новые сверху.',
  'billing.invoices.portal': 'Портал оплаты',
  'billing.invoices.unavailableTitle': 'Квитанции не загружаются',
  'billing.invoices.unavailableBody':
    'Stripe не успел ответить по истории. Всё выше — актуально; полный список смотрите в портале оплаты или вернитесь через минуту.',
  'billing.invoices.emptyTitle': 'Счетов пока нет',
  'billing.invoices.emptyCustomer':
    'Первая квитанция появится здесь, как только закроется период оплаты.',
  'billing.invoices.emptyNoCustomer':
    'Этому пространству ещё ничего не выставляли. Возьмите платный тариф, и квитанции начнут собираться здесь.',
  'billing.invoices.tableLabel': 'История счетов',
  'billing.invoices.number': 'Счёт',
  'billing.invoices.date': 'Дата',
  'billing.invoices.period': 'Период',
  'billing.invoices.amount': 'Сумма',
  'billing.invoices.status': 'Статус',
  'billing.invoices.receipt': 'Квитанция',
  'billing.invoices.view': 'Открыть',
  'billing.invoice.paid': 'Оплачен',
  'billing.invoice.open': 'К оплате',
  'billing.invoice.draft': 'Черновик',
  'billing.invoice.void': 'Аннулирован',
  'billing.invoice.uncollectible': 'Безнадёжный',
} satisfies TranslationOf<typeof En>

export default messages
