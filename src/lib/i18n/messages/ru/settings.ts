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
  'workspace.invite.invite': 'Пригласить',
  'workspace.invite.resend': 'Отправить повторно',
  'workspace.invite.revoke': 'Отозвать',
  'workspace.invite.confirm': 'Отозвать приглашение',
  'workspace.invite.expired': 'Истекло',
  'workspace.invite.by': 'Приглашает {name}',
  'workspace.invite.sent': 'Приглашение отправлено',
  'workspace.invite.revoked': 'Приглашение отозвано',
  'workspace.invite.delivery':
    'Приглашение сохранено, но отправка письма не удалась. Отправьте повторно.',
  'workspace.invite.duplicate':
    'Приглашение уже ожидает ответа. Отправьте повторно.',
  'workspace.invite.existing':
    'Этот человек уже участник рабочего пространства.',
  'workspace.invite.failed':
    'Приглашение недоступно. Обновите список и попробуйте снова.',
  'workspace.invite.reload': 'Обновить приглашения',

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
  'appearance.map.workspaceHint': 'То, что выбрал владелец пространства.',
  'appearance.map.auto': 'Автоматический',
  'appearance.map.autoHint': 'Следует вашей светлой или тёмной теме.',
  'appearance.map.paper': 'Бумага',
  'appearance.map.paperHint': 'Тёплая и светлая при любой теме.',
  'appearance.map.charcoal': 'Графит',
  'appearance.map.charcoalHint': 'Тёплая и тёмная при любой теме.',
  'appearance.map.quiet': 'Спокойный',
  'appearance.map.quietHint':
    'Без названий улиц, чтобы ваши метки читались первыми.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'На общем экране',
  'appearance.privacy.codesLabel':
    'Скрывать коды подтверждения, пока я не попрошу',
  'appearance.privacy.codesHint':
    'Номера бронирований и коды подтверждения остаются скрытыми в разделе бронирований и в поездках, пока вы не нажмёте на них или не коснётесь их, и снова скрываются, когда вы переходите к другому. Цены не скрываются никогда.',
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
    'При входе по электронной почте и паролю запрашивается код из приложения, если браузер не отмечен как доверенный.',
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

  'notifications.event.billing.plan_changed': 'Изменения подписки',
  'notifications.event.billing.plan_changed.hint':
    'Пространство переходит на другой тариф.',
  'notifications.event.billing.invoice_paid': 'Подтверждения оплаты',
  'notifications.event.billing.invoice_paid.hint':
    'Счёт вашего пространства оплачен.',
  'notifications.event.billing.payment_failed': 'Проблемы с оплатой',
  'notifications.event.billing.payment_failed.hint':
    'Списание за ваше пространство не прошло.',

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
    'Новый тариф уже применяется. Он появится здесь в тот момент, когда Polar его подтвердит, — обычно за несколько секунд.',
  'billing.checkout.cancelledTitle': 'Оплата прервана',
  'billing.checkout.cancelledBody': 'Ничего не списано, и тариф не изменился.',
  'billing.portal.backTitle': 'Возвращение из Polar',
  'billing.portal.backBody':
    'Всё, что вы там изменили, появится здесь, как только Polar это подтвердит.',
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
  'billing.price.free': 'Бесплатно',
  'billing.provider.opening': 'Открываем Polar',
  'billing.renewal.trialEndsToday':
    'Пробный период заканчивается сегодня. Первое списание произойдёт после, если не отменить раньше.',
  'billing.renewal.trialEndsIn': {
    one: 'Пробный период закончится через {value} день, затем произойдёт первое списание, если не отменить раньше.',
    few: 'Пробный период закончится через {value} дня, затем произойдёт первое списание, если не отменить раньше.',
    many: 'Пробный период закончится через {value} дней, затем произойдёт первое списание, если не отменить раньше.',
    other:
      'Пробный период закончится через {value} дня, затем произойдёт первое списание, если не отменить раньше.',
  },
  'billing.renewal.trialEnded': 'Пробный период закончился.',
  'billing.renewal.endsNoDate':
    'Этот тариф должен закончиться и не будет продлён.',
  'billing.renewal.endsOn':
    'Этот тариф заканчивается {date} — ничего не удалится, платные модули просто закроются.',
  'billing.renewal.pastDue':
    'Последний платёж не прошёл. Обновите карту, чтобы не потерять платные модули.',
  'billing.renewal.unpaid':
    'Эта подписка не оплачена, а платные модули закрыты.',
  'billing.renewal.paused':
    'Эта подписка приостановлена. Возобновите её, когда снова соберётесь в дорогу.',
  'billing.renewal.lapsed':
    'Выберите тариф ниже, чтобы снова открыть брони и дневник.',
  'billing.renewal.incomplete':
    'Polar всё ещё ждёт подтверждения этого платежа.',
  'billing.renewal.free':
    'Две поездки одновременно, за наш счёт. Тариф повыше возьмёте, когда станет тесно.',
  'billing.renewal.auto': 'Продлевается автоматически.',
  /**
   * No full stop after `{date}`: the frozen table renders a Russian date as
   * «11 сент. 2026 г.», whose abbreviation point already closes the sentence.
   * A second one prints «г..». `renewal.endsOn` keeps the date away from the
   * clause boundary for the same reason.
   */
  'billing.renewal.renewsOn': 'Продлится {date}',

  'billing.usage.title': 'Использование',
  'billing.usage.description':
    'Считается на ходу, поэтому счётчик никогда не устаревает. Лимиты идут за тарифом, который действует сейчас.',
  'billing.quota.seats': 'Участники',
  'billing.quota.trips': 'Поездки',
  'billing.quota.storageBytes': 'Хранилище',
  'billing.quota.unlimited': 'Без ограничений',
  'billing.quota.places': 'Места',
  'billing.quota.placesHint': 'Во всех поездках этого рабочего пространства',
  'billing.quota.exhausted.places': 'Лимит мест исчерпан',
  'billing.quota.over.places': 'Лимит мест превышен на {value}',
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
  /**
   * The two cadences ride inside one pill above the plan cards, and that pill
   * has 326px at 360px wide. `Ежемесячно` / `Ежегодно` pushed it 26px past the
   * card edge. `В месяц` / `В год` is what a Russian price list says anyway,
   * and it answers the group's own label — «Период оплаты: в месяц».
   */
  'billing.interval.monthly': 'В месяц',
  'billing.interval.yearly': 'В год',
  'billing.plan.free.name': 'Бесплатный',
  'billing.plan.free.tagline': 'Спланируйте две ближайшие поездки',
  'billing.plan.free.feature.trips': 'Две поездки одновременно и до 150 мест',
  'billing.plan.free.feature.itinerary': 'Маршрут по дням и карта',
  'billing.plan.free.feature.lists': 'Списки вещей и простые бюджеты',
  'billing.plan.free.feature.atlas':
    'Карта мира, которая помнит посещённые страны',
  'billing.plan.solo.name': 'Соло',
  'billing.plan.solo.tagline': 'Для того, кто планирует всё сам',
  'billing.plan.solo.feature.trips': 'Поездки и места без ограничений',
  'billing.plan.solo.feature.modules':
    'Все модули планирования — брони, дневник, бюджеты, сборы',
  'billing.plan.solo.feature.storage': '5 ГБ для фотографий и документов',
  'billing.plan.solo.feature.export': 'Экспорт в PDF и в календарь',
  'billing.plan.crew.name': 'Команда',
  'billing.plan.crew.tagline': 'Для семей, друзей и небольших команд',
  'billing.plan.crew.feature.members': 'До десяти человек, оплата за каждого',
  'billing.plan.crew.feature.realtime':
    'Работа вместе в реальном времени с живыми курсорами',
  'billing.plan.crew.feature.everything':
    'Поездки и места без ограничений и все модули',
  'billing.plan.crew.feature.storage':
    'Общее место для фотографий и документов всей группы',

  'billing.plan.current': 'Текущий тариф',
  'billing.plan.currentBadge': 'Нынешний',
  'billing.plan.popular': 'Популярный',
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

  'billing.invoices.number': 'Счёт',
  'billing.invoices.date': 'Дата',
  'billing.invoices.amount': 'Сумма',
  'billing.invoices.status': 'Статус',
  'billing.invoice.paid': 'Оплачен',
  'billing.invoice.draft': 'Черновик',
  'billing.invoice.void': 'Аннулирован',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Платёжный провайдер отклонил этот запрос. Попробуйте через минуту.',
  'billing.failure.reference': 'Номер обращения для поддержки: {reference}',
  'billing.failure.forbidden':
    'Ваша роль не позволяет этого в биллинге рабочего пространства. Попросите владельца или администратора.',
  'billing.failure.providerRefused':
    'Polar не принял это изменение. Сверьте число мест с числом участников и повторите попытку или воспользуйтесь порталом биллинга.',
  'billing.failure.rateLimited':
    'Polar сейчас перегружен. Ничего не изменилось. Повторите попытку через минуту.',
  'billing.failure.notConnected':
    'Биллинг в этой установке ещё не подключён, поэтому ничего не изменилось. Обратитесь в поддержку.',
  'billing.failure.orderNotInvoiceable':
    'Polar не может выставить счёт по этому заказу. Если не указаны имя или адрес плательщика, добавьте их на портале биллинга и повторите попытку; иначе обратитесь в поддержку.',
  'billing.planChanged.title': 'Тариф обновлён',
  'billing.planChanged.body':
    'Изменение уже действует в Polar, который выставит счёт на разницу. Сводка ниже догонит в течение минуты.',
  'billing.discount.toggle': 'Есть промокод?',
  'billing.discount.label': 'Промокод',
  'billing.discount.hint': 'Применится к тарифу, который вы выберете.',
  'billing.discount.hintCurrent':
    'Примените его к текущему тарифу или выберите тариф ниже.',
  'billing.discount.applyCurrent': 'Применить к текущему тарифу',
  'billing.discount.applying': 'Применяем промокод…',
  'billing.discount.invalidFormat': 'Код состоит из 3–64 букв и цифр.',
  'billing.discount.rejected.invalid':
    'Этот код недействителен. Проверьте его и попробуйте снова.',
  'billing.discount.rejected.rateLimited':
    'Слишком много попыток. Попробуйте снова через час.',
  'billing.discount.rejected.notApplicable':
    'Этот код не подходит для этого тарифа.',
  'billing.discount.rejected.busy':
    'Сейчас не удаётся проверить коды. Попробуйте снова через минуту.',
  'billing.discount.nextRenewal': 'Промокод действует со следующего продления.',
  'billing.discount.appliedTitle': 'Промокод применён',
  'billing.hero.manage': 'Управление оплатой',
  'billing.hero.manageHint':
    'Карты, адрес для счёта, номер НДС, квитанции и отмена — в Polar, который выставляет счёт.',
  'billing.hero.manageHintNone':
    'Платёжного профиля пока нет. Выбор платного тарифа ниже создаст его, и портал начнёт открываться.',
  'billing.portal.opening': 'Открывается платёжный портал',
  'billing.plan.notApplied': 'Это изменение не применено',
  'billing.plan.cancelInPortal': 'Отменить в портале',
  'billing.plan.seatsOverMax': {
    one: 'В этом пространстве {members} участников, а {plan} рассчитывает не более {max}. Удалите {value} участника перед переходом.',
    few: 'В этом пространстве {members} участников, а {plan} рассчитывает не более {max}. Удалите {value} участников перед переходом.',
    many: 'В этом пространстве {members} участников, а {plan} рассчитывает не более {max}. Удалите {value} участников перед переходом.',
    other:
      'В этом пространстве {members} участников, а {plan} рассчитывает не более {max}. Удалите {value} участника перед переходом.',
  },
  'billing.plan.seatsBelowMembers':
    'У вас {members} участников. Выберите не меньше мест — Polar отклоняет подписку, где мест меньше, чем назначений.',
  'billing.orders.title': 'Заказы',
  'billing.orders.description':
    'Каждый заказ этого пространства, начиная с последнего.',
  'billing.orders.receipts': 'Все квитанции',
  'billing.orders.unavailableTitle': 'Заказы не загружаются',
  'billing.orders.unavailableBody':
    'Polar не ответил вовремя по истории. Всё выше актуально — попробуйте через минуту или посмотрите полную запись в платёжном портале.',
  'billing.orders.emptyTitle': 'Заказов пока нет',
  'billing.orders.emptyCustomer':
    'Первый счёт появится здесь, как только закроется расчётный период.',
  'billing.orders.emptyNoCustomer':
    'Этому пространству ещё ничего не выставляли. Выберите платный тариф, и счёта начнут собираться здесь.',
  'billing.orders.tableLabel': 'История заказов',
  'billing.orders.document': 'Документ',
  'billing.orders.dateUnknown': 'Дата неизвестна',
  'billing.order.pending': 'В обработке',
  'billing.order.refunded': 'Возвращено',
  'billing.order.partiallyRefunded': 'Частично возвращено',
  'billing.order.noInvoiceDraft': 'Пока заказ — черновик, счёта нет',
  'billing.order.preparing': 'Готовится',
  'billing.order.renderingHint':
    'Polar ещё формирует счёт {number}. Загрузка вернётся через несколько секунд.',
  'billing.order.fetching': 'Загрузка счёта',
  'billing.order.generating': 'Polar готовит счёт',
  'billing.order.pdfLabel': 'Счёт {number} в PDF',
  'billing.order.stillWritingTitle': 'Polar ещё выписывает этот счёт',
  'billing.order.stillWritingBody':
    'Счёт {number} формируется. Загрузка вернётся сама через несколько секунд.',
  'billing.order.openFailed': 'Этот счёт не открылся',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Аккаунт',
  'passkeys.page.title': 'Ключи доступа',
  'passkeys.page.description':
    'Ключ доступа позволяет входить по отпечатку пальца, лицу или аппаратному ключу — ничего печатать не нужно.',
  'passkeys.page.back': 'Назад к безопасности',
  'passkeys.list.label': 'Ваши ключи доступа',
  'passkeys.add.action': 'Добавить ключ доступа',
  'passkeys.add.loading': 'Ждём ваше устройство',
  'passkeys.add.added': 'Ключ доступа добавлен',
  'passkeys.add.dismissed': 'Ключ доступа не добавлен',
  'passkeys.add.exists':
    'На этом устройстве уже есть ключ доступа к вашему аккаунту',
  'passkeys.add.failed': 'Ключ доступа не добавлен. Попробуйте ещё раз.',
  'passkeys.add.stale':
    'Для вашей безопасности войдите снова, чтобы продолжить.',
  'passkeys.error.sessionEnded':
    'Ваш сеанс завершён. Войдите снова, чтобы продолжить.',
  'passkeys.signInAgain': 'Войти снова',
  'passkeys.add.limit':
    'Достигнут предел: {value} ключей доступа. Удалите один, чтобы добавить другой.',
  'passkeys.add.unsupported':
    'Этот браузер не умеет создавать ключи доступа. Попробуйте другой браузер или устройство.',
  'passkeys.empty.title': 'Ключей доступа пока нет',
  'passkeys.empty.body':
    'Добавьте один — и входите по отпечатку пальца, лицу или аппаратному ключу, ничего не печатая.',
  'passkeys.row.fallbackName': 'Ключ доступа · добавлен {date}',
  'passkeys.row.added': 'Добавлен {date}',
  'passkeys.row.lastUsed': 'Последнее использование: {date}',
  'passkeys.row.neverUsed': 'Для входа ещё не использовался',
  'passkeys.badge.synced': 'Синхронизируется',
  'passkeys.badge.singleDevice': 'Только на одном устройстве',
  'passkeys.error.title': 'Ключи доступа не загрузились',
  'passkeys.error.retry': 'Повторить',
  'passkeys.error.rateLimited':
    'Слишком много попыток. Повторите через несколько минут.',
  'passkeys.error.generic': 'Проверьте соединение и повторите попытку.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': 'Переименовать: {name}',
  'passkeys.rename.fieldLabel': 'Назовите этот ключ доступа',
  'passkeys.rename.placeholder': 'Дайте имя, например Рабочий телефон',
  'passkeys.rename.saving': 'Сохраняем название',
  'passkeys.rename.saved': 'Название сохранено',
  'passkeys.rename.failed': 'Название не сохранено',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': 'Удалить: {name}',
  'passkeys.delete.title': 'Удалить этот ключ доступа?',
  'passkeys.delete.body': 'Вы больше не сможете входить с помощью: {name}.',
  'passkeys.delete.password': 'Пароль',
  'passkeys.delete.passwordHint': 'Введите пароль для подтверждения.',
  'passkeys.delete.confirmOnly':
    'У вашей учётной записи нет пароля. Подтвердите, что хотите удалить этот ключ доступа.',
  'passkeys.delete.confirm': 'Удалить ключ доступа',
  'passkeys.delete.cancel': 'Отмена',
  'passkeys.delete.wrongPassword': 'Этот пароль неверный.',
  'passkeys.delete.stale':
    'Для вашей безопасности войдите снова, прежде чем удалять ключ доступа.',
  'passkeys.delete.removed': 'Ключ доступа удалён',
  'passkeys.delete.failed': 'Ключ доступа не удалён. Попробуйте ещё раз.',
  'passkeys.delete.removing': 'Удаляем ключ доступа',
  'passkeys.delete.passwordRequired':
    'Введите пароль, чтобы удалить этот ключ доступа.',
  'workspace.departure.leave': 'Покинуть рабочее пространство',
  'workspace.departure.remove': 'Удалить участника',
  'workspace.departure.title': 'Прекратить участие в {workspace}?',
  'workspace.departure.body':
    '{name} потеряет доступ к {workspace}. Аккаунт, сохранённые поездки и записи о расходах останутся.',
  'workspace.departure.cancel': 'Отмена',
  'workspace.departure.pending': 'Прекращение участия…',
  'workspace.departure.lastOwner':
    'Назначьте другого участника владельцем, прежде чем выйти или удалить этого владельца.',
  'workspace.departure.notPermitted':
    'Ваша текущая роль не позволяет удалить этого участника. Обновите список участников перед повторной попыткой.',
  'workspace.departure.notFound':
    'Этот человек больше не является участником этого рабочего пространства.',
  'workspace.departure.impersonated':
    'Прекратите работу от имени другого пользователя, прежде чем менять состав рабочего пространства.',
  'workspace.departure.failed':
    'Не удалось подтвердить результат. Перезагрузите рабочее пространство перед повторной попыткой.',
  'workspace.departure.removed': 'Участник удалён',
  'workspace.departure.reload': 'Перезагрузить рабочее пространство',
  'workspace.departure.activationFailed':
    'Вы покинули это рабочее пространство. Откройте следующее, чтобы продолжить.',
  'workspace.departure.recover': 'Открыть следующее пространство',
  'twoFactor.back': 'Назад к безопасности',
  'twoFactor.title': 'Двухфакторная аутентификация',
  'twoFactor.description':
    'Добавьте второй шаг при входе по электронной почте и паролю.',
  'twoFactor.error':
    'Не удалось загрузить настройки двухфакторной аутентификации.',
  'twoFactor.steps.label': 'Настроить двухфакторную аутентификацию',
  'twoFactor.steps.password': 'Подтвердите свою личность',
  'twoFactor.steps.key': 'Добавьте ключ в приложение-аутентификатор',
  'twoFactor.steps.confirm': 'Введите код',
  'twoFactor.steps.state.done': 'Готово',
  'twoFactor.steps.state.current': 'Текущий шаг',
  'twoFactor.steps.state.todo': 'Не начато',
  'twoFactor.password.label': 'Ваш пароль',
  'twoFactor.password.hint':
    'Мы запрашиваем его повторно перед изменением способа входа.',
  'twoFactor.password.submit': 'Продолжить',
  'twoFactor.password.pending': 'Настройка',
  'twoFactor.password.invalid': 'Неверный пароль.',
  'twoFactor.key.intro':
    'Вам нужно приложение-аутентификатор на телефоне. Добавьте в него этот ключ и вернитесь сюда. Двухфакторная аутентификация пока не включена.',
  'twoFactor.key.matrixLabel':
    'Код настройки. Тот же ключ доступен в текстовом виде',
  'twoFactor.key.matrixFailed':
    'Не удалось создать код для этого ключа. Введите ключ настройки в своём приложении.',
  'twoFactor.key.label': 'Ключ настройки',
  'twoFactor.key.copy': 'Скопировать ключ',
  'twoFactor.key.copied': 'Ключ скопирован',
  'twoFactor.key.copyFailed':
    'Браузер не смог скопировать ключ. Выделите его и скопируйте вручную.',
  'twoFactor.key.open': 'Открыть в приложении-аутентификаторе',
  'twoFactor.key.startOver': 'Начать заново',
  'twoFactor.key.startOverHint':
    'При повторной настройке создаётся новый ключ. Ключ, уже добавленный в приложение, перестанет работать.',
  'twoFactor.key.next': 'Ключ добавлен',
  'twoFactor.code.label': 'Код из приложения',
  'twoFactor.code.hint': 'Шесть цифр, которые приложение показывает сейчас.',
  'twoFactor.code.submit': 'Включить двухфакторную аутентификацию',
  'twoFactor.code.pending': 'Проверка',
  'twoFactor.code.invalid':
    'Код не совпал. Проверьте время на телефоне и введите самый свежий код из приложения.',
  'twoFactor.code.unclear':
    'Не удалось определить, сработало ли это. Введите самый свежий код, чтобы попробовать снова.',
  'twoFactor.rateLimited.title': 'Слишком много попыток за короткое время',
  'twoFactor.rateLimited.password':
    'Подождите около десяти секунд и повторите попытку. Введённые данные сохранены.',
  'twoFactor.rateLimited.code':
    'Подождите до минуты и повторите попытку. Введённые данные сохранены.',
  'twoFactor.codes.title': 'Ваши резервные коды',
  'twoFactor.codes.body':
    'Каждый код работает один раз, если вы потеряете телефон. Они показываются только сейчас, поэтому сохраните их в безопасном месте.',
  'twoFactor.codes.copyAll': 'Скопировать все',
  'twoFactor.codes.copied': 'Резервные коды скопированы',
  'twoFactor.codes.download': 'Скачать текстовым файлом',
  'twoFactor.codes.copyFailed':
    'Браузер не смог скопировать коды. Выделите их и скопируйте вручную.',
  'twoFactor.codes.stored': 'Я сохранил эти резервные коды',
  'twoFactor.codes.done': 'Завершить',
  'twoFactor.codes.gate': 'Отметьте поле, чтобы продолжить.',
  'twoFactor.codes.lost':
    'Если вы уйдёте с этой страницы раньше, здесь можно создать новый набор. Старый перестанет работать.',
  'twoFactor.codes.leave.title': 'Уйти, не сохранив коды?',
  'twoFactor.codes.leave.body':
    'Резервные коды показываются только один раз. Если вы уйдёте сейчас, здесь можно создать новый набор. Старый перестанет работать.',
  'twoFactor.codes.leave.stay': 'Остаться здесь',
  'twoFactor.codes.leave.go': 'Уйти',
  'twoFactor.on.title': 'Двухфакторная аутентификация включена',
  'twoFactor.on.badge': 'Включена',
  'twoFactor.on.body':
    'При входе по электронной почте и паролю мы запрашиваем код из приложения, если браузер не отмечен как доверенный. При входе через Google, Apple или ключ доступа код не нужен.',
  'twoFactor.replace.action': 'Заменить резервные коды',
  'twoFactor.replace.title': 'Заменить ваши резервные коды?',
  'twoFactor.replace.body':
    'Вы получите новый набор. Текущий перестанет работать сразу после продолжения.',
  'twoFactor.replace.confirm': 'Заменить',
  'twoFactor.replace.pending': 'Замена',
  'twoFactor.nopassword.title': 'Сначала задайте пароль',
  'twoFactor.nopassword.body':
    'Для двухфакторной аутентификации у этого аккаунта должен быть пароль. Следующая страница запросит электронную почту и отправит ссылку для его настройки. Это завершит сеансы на всех устройствах. Войдите снова и вернитесь сюда.',
  'twoFactor.nopassword.action': 'Задать пароль',
} satisfies TranslationOf<typeof En>

export default messages
