/**
 * Everything the settings module says, in Ukrainian.
 *
 * Authored from `../en/settings.ts` (`docs/SPEC.md` §8.9). The English file is
 * the schema; `__tests__/parity.test.ts` checks the placeholders, the plural
 * branches and that nothing English is left sitting here (§8.6).
 *
 * **Plural.** `uk` needs `one` (1, 21 …) · `few` (2–4) · `many` (0, 5–20) ·
 * `other` (fractions).
 *
 * **Currency names are lower case**, as Ukrainian writes them: «євро», «фунт
 * стерлінгів», «японська єна». The ISO code beside them is derived in the
 * route.
 *
 * **Plan names are words, not proper nouns** (see the English file's note on
 * `billing.plan.*`): the stable identifier is the plan *id*, which no reader
 * sees. `Solo` is travelling alone, `Crew` is the group.
 *
 * **«Тариф», not «план»**: Ukrainian keeps «план» for a trip's itinerary, so
 * the subscription is a tariff everywhere it is named on its own.
 *
 * **Два жорсткі піксельні бюджети**, виміряні в Chromium на `/settings` при
 * 1440 (обидва `.truncate`, тож зайве обрізається, а не переноситься):
 * підпис під кожним посиланням бічної навігації — 196 px, а кнопка
 * регіонального `Select` — 206 px. Англійський оригінал сягає 189 px і
 * 212 px відповідно, тож дослівний, довший переклад обрізається. Тому
 * `nav.workspace.hint` — «Учасники та типові значення» (167 px), а
 * `regional.workspaceDefault` починається з «Із простору — » (180 px із
 * найдовшим значенням), а не з «Налаштування простору — » (240 px).
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Акаунт',
  'page.title': 'Налаштування',
  'page.description':
    'Усе про вас, про ваш простір і про те, як поводиться planned.travel',
  'page.error': 'Налаштування не завантажилися',

  'nav.label': 'Розділи налаштувань',
  'nav.profile': 'Профіль',
  'nav.profile.hint': 'Ви і ваш формат дат та грошей',
  'nav.language': 'Мова',
  'nav.language.hint': 'Мова, якою говорить кожен екран',
  'nav.appearance': 'Вигляд',
  'nav.appearance.hint': 'Тема, анімація та карта',
  'nav.security': 'Безпека',
  'nav.security.hint': 'Пароль, другий фактор, ключі',
  'nav.notifications': 'Повідомлення',
  'nav.notifications.hint': 'Вхідні, пошта й телефон',
  'nav.workspace': 'Простір',
  'nav.workspace.hint': 'Учасники та типові значення',
  'nav.billing': 'Оплата',
  'nav.billing.hint': 'Тариф, місця та рахунки',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Зберегти зміни',
  'error.retryBody':
    'Нічого не втрачено. Перевірте з’єднання і спробуйте ще раз.',
  'role.owner': 'Власник',
  'role.admin': 'Адміністратор',
  'role.member': 'Учасник',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Із простору — {value}',
  'regional.currency.AUD': 'австралійський долар',
  'regional.currency.CAD': 'канадський долар',
  'regional.currency.CHF': 'швейцарський франк',
  'regional.currency.EUR': 'євро',
  'regional.currency.GBP': 'фунт стерлінгів',
  'regional.currency.JPY': 'японська єна',
  'regional.currency.PLN': 'польський злотий',
  'regional.currency.SEK': 'шведська крона',
  'regional.currency.USD': 'долар США',
  'regional.distance.metric': 'Кілометри',
  'regional.distance.imperial': 'Милі',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Ваш профіль не завантажився',
  'profile.account.title': 'Ваш акаунт',
  'profile.account.description':
    'Ім’я та адреса пошти приходять з того акаунта, через який ви входите.',
  'profile.email.verified': 'Пошту підтверджено',
  'profile.email.unverified': 'Пошту не підтверджено',
  'profile.twoFactor.on': 'Другий фактор увімкнено',
  'profile.figure.workspace': 'Простір',
  'profile.figure.role': 'Роль',
  'profile.figure.joined': 'У команді з',
  'profile.figure.joinedUnknown': 'Не записано',
  'profile.regional.title': 'Дати, гроші та одиниці',
  'profile.regional.description':
    'Це перекриває налаштування простору лише для вас. Залиште вибір за умовчанням — і поле піде за простором.',
  'profile.regional.saving': 'Зберігаємо ваші налаштування',
  'profile.regional.saved': 'Ваші налаштування збережено',
  'profile.regional.saveFailed': 'Ваші налаштування не збереглися',
  'profile.language.label': 'Мова',
  'profile.language.hint':
    'Обирається на окремому екрані, де кожна мова написана своїм письмом.',
  'profile.language.action': 'Змінити',
  'profile.timezone.label': 'Часовий пояс',
  'profile.timezone.hint': 'Час виїздів і прибуттів показуємо відносно нього.',
  'profile.currency.label': 'Валюта',
  'profile.currency.hint':
    'Нові поїздки починаються в цій валюті; у кожної поїздки може бути своя.',
  'profile.dateFormat.label': 'Формат дати',
  'profile.weekStart.label': 'Тиждень починається з',
  'profile.weekStart.hint':
    'Діє в кожному календарі, зокрема в річній сітці відпусток.',
  'profile.distance.label': 'Відстань',

  /* --------------------------------------------------------------- language */
  'language.error': 'Налаштування мови не завантажилися',
  'language.section.title': 'Мова',
  'language.section.description':
    'Кожен екран, кожна кнопка й кожна дата читаються мовою, яку ви виберете тут, — їх двадцять три, і кожна написана своїм письмом.',
  'language.label': 'Виберіть мову',
  'language.followWorkspace': 'Як у просторі',
  'language.state.yours': 'Ваша мова',
  'language.state.workspace': 'З налаштувань простору',
  'language.state.hint.override':
    'Ваш власний вибір. Він діє лише для вас, на кожному пристрої, звідки ви входите.',
  'language.state.hint.workspace':
    'Своєї мови у вас немає, тож ви читаєте ту, на яку налаштований простір. Власник або адміністратор може змінити її в розділі «Простір».',
  'language.saved': 'planned.travel тепер говорить мовою {language}',
  'language.saveFailed': 'Мова не змінилася',
  'language.saveFailedBody':
    'Нічого не втрачено, і ви й далі читаєте мовою {language}. Перевірте з’єднання і виберіть знову.',
  'language.reload.title': 'Вашу мову збережено',
  'language.reload.body':
    'Ця сторінка не встигла перемкнутися на {language}. Оновіть її, щоб читати продукт новою мовою.',
  'language.sample.title': 'Як читатимуться дати та числа',
  'language.sample.description':
    'Три однакові значення, записані так, як їх записує ця мова.',
  'language.sample.date': 'Дата',
  'language.sample.number': 'Число',
  'language.sample.money': 'Сума',
  'language.legal':
    'Умови та політику приватності ми публікуємо лише англійською. Усе інше в продукті перекладено.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Вигляд не завантажився',
  'appearance.theme.title': 'Тема',
  'appearance.theme.description':
    'Обидві теми намальовані, а не вивернуті навиворіт. Візьміть ту, яку читати зручніше.',
  'appearance.theme.light': 'Світла',
  'appearance.theme.lightHint': 'Теплий папір, цілий день',
  'appearance.theme.dark': 'Темна',
  'appearance.theme.darkHint': 'Теплий графіт, ніколи не чорний',
  'appearance.theme.system': 'Системна',
  'appearance.theme.systemHint': 'Як на пристрої',
  'appearance.theme.showing': 'Зараз діє палітра: {palette}.',
  'appearance.theme.showingSystem':
    'Зараз діє палітра: {palette}, слідом за налаштуванням пристрою.',
  'appearance.palette.light': 'світла',
  'appearance.palette.dark': 'темна',
  'appearance.motion.title': 'Анімація та карти',
  'appearance.motion.label': 'Менше анімації',
  'appearance.motion.hint':
    'Згортає анімації появи до простого проявлення. Системне налаштування зменшення руху ми шануємо завжди.',
  'appearance.map.label': 'Стиль карти',
  'appearance.map.hint': 'Основа карти в планувальнику та в атласі.',
  'appearance.map.workspace': 'Як у просторі',
  'appearance.map.light': 'Папір — світла',
  'appearance.map.dark': 'Графіт — темна',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'На спільному екрані',
  'appearance.privacy.codesLabel':
    'Приховувати коди підтвердження, доки я не попрошу',
  'appearance.privacy.codesHint':
    'Номери бронювань і коди підтвердження лишаються прихованими в розділі бронювань і в переїздах, доки ви не наведете на них курсор, не переведете фокус або не торкнетеся їх. Ціни не приховуються ніколи.',
  'appearance.saveFailed': 'Ця зміна не збереглася',
  'appearance.saveFailedBody':
    'Тут вона видна, але на наступному пристрої, звідки ви увійдете, її не буде.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Безпека не завантажилася',
  'security.unverified.title': 'Вашу адресу пошти поки не підтверджено',
  'security.unverified.body':
    'Скидання пароля та запрошення в поїздки йдуть на {email}. Підтвердження — це те, що доводить, що адреса ваша.',
  'security.unverified.action': 'Надіслати посилання знову',
  'security.signin.title': 'Вхід',
  'security.signin.description':
    'Чим ви доводите, що це ви. Другий фактор і ключі доступу сильніші за один пароль.',
  'security.email.label': 'Електронна пошта',
  'security.email.verified': 'Підтверджена',
  'security.email.unverified': 'Не підтверджена',
  'security.password.label': 'Пароль',
  'security.password.hint':
    'Змінюйте його коли завгодно — ми надішлемо одноразове посилання, а не питатимемо старий.',
  'security.password.action': 'Змінити пароль',
  'security.twoFactor.label': 'Двофакторна аутентифікація',
  'security.twoFactor.onHint':
    'На кожному новому вході потрібен код із застосунку-автентифікатора.',
  'security.twoFactor.offHint':
    'Додайте до пароля шестизначний код із застосунку-автентифікатора.',
  'security.twoFactor.on': 'Увімк.',
  'security.twoFactor.off': 'Вимк.',
  'security.twoFactor.manage': 'Налаштувати',
  'security.twoFactor.enable': 'Увімкнути',
  'security.passkeys.label': 'Ключі доступу',
  'security.passkeys.hint':
    'Заходьте відбитком, Face ID або апаратним ключем — друкувати нічого не треба.',
  'security.passkeys.action': 'Керувати ключами',
  'security.session.title': 'Цей сеанс',
  'security.session.description': 'Браузер, у якому ви це читаєте.',
  'security.session.label': 'Виконано вхід як',
  'security.session.expires': 'Діє до {date}',
  'security.session.expiresSoon': 'скоро',
  'security.session.noExpiry': 'Термін не записано',
  'security.signOut.label': 'Вийти',
  'security.signOut.hint':
    'Завершує цей сеанс і повертає на сторінку входу. Інші пристрої залишаться всередині.',
  'security.signOut.pending': 'Виходимо',
  'security.signOut.failed': 'Вийти не вдалося',
  'security.signOut.failedBody': 'Перевірте з’єднання і спробуйте ще раз.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Налаштування повідомлень не завантажилися',
  'notifications.title': 'Повідомлення',
  'notifications.description':
    'Кожен перемикач діє лише для вас. Вимкнувши його, ви не спините подію — лише наше сповіщення про неї.',
  'notifications.caption': 'Які повідомлення доходять до якого канала',
  'notifications.event': 'Подія',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Це налаштування не збереглося',
  'notifications.saveFailedBody':
    'Перемикач повернули на місце. Перевірте з’єднання і спробуйте ще раз.',
  'notifications.channel.in_app': 'У застосунку',
  'notifications.channel.in_app.hint': 'Дзвіночок у верхній панелі',
  'notifications.channel.email': 'Ел. пошта',
  'notifications.channel.email.hint': 'На адресу, з якою ви входите',
  'notifications.channel.push': 'Пуш',
  'notifications.channel.push.hint': 'На пристроях, де ви це дозволили',
  'notifications.event.trip.invited': 'Запрошення в поїздки',
  'notifications.event.trip.invited.hint':
    'Хтось додає вас до поїздки, яку планує.',
  'notifications.event.trip.updated': 'Зміни в плані',
  'notifications.event.trip.updated.hint':
    'У поїздці, де ви є, зсувається день, зупинка або дата.',
  'notifications.event.trip.starting_soon': 'Нагадування про виїзд',
  'notifications.event.trip.starting_soon.hint':
    'Невелике нагадування в дні перед початком поїздки.',
  'notifications.event.reservation.reminder': 'Нагадування про броні',
  'notifications.event.reservation.reminder.hint':
    'Наближається нічліг, столик або білет.',
  'notifications.event.expense.added': 'Нові витрати',
  'notifications.event.expense.added.hint':
    'Хтось записує гроші, витрачені в спільній поїздці.',
  'notifications.event.expense.settled': 'Закриті баланси',
  'notifications.event.expense.settled.hint':
    'Баланс, який вас стосувався, закрито.',
  'notifications.event.list.assigned': 'Призначені завдання',
  'notifications.event.list.assigned.hint':
    'Щось зі списку речей або справ стає вашим.',
  'notifications.event.collab.message': 'Розмова про поїздку',
  'notifications.event.collab.message.hint':
    'Нові повідомлення в поїздці, куди ви їдете.',
  'notifications.event.organization.invited': 'Запрошення в простір',
  'notifications.event.organization.invited.hint':
    'Вас запрошують у робочий простір.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Простір не завантажився',
  'workspace.summary.description': 'Тариф {plan} · створено {date}',
  'workspace.summary.createdRecently': 'нещодавно',
  'workspace.summary.billingAction': 'Тариф і оплата',
  'workspace.seats.label': 'Зайняті місця',
  'workspace.seats.value': '{used} з {limit}',
  'workspace.seats.note':
    'Відкриті запрошення займають місця, тож простір ніколи не вийде за тариф, який оплачує.',
  'workspace.seatsFull.title': 'Усі місця на цьому тарифі зайняті',
  'workspace.seatsFull.body':
    '{members} і {invitations} заповнюють ліміт у {limit} місць.',
  'workspace.seatsFull.action': 'Додати місця',
  'workspace.members.count': {
    one: '{value} учасник',
    few: '{value} учасники',
    many: '{value} учасників',
    other: '{value} учасника',
  },
  'workspace.invitations.count': {
    one: '{value} запрошення в очікуванні',
    few: '{value} запрошення в очікуванні',
    many: '{value} запрошень в очікуванні',
    other: '{value} запрошення в очікуванні',
  },
  'workspace.members.title': 'Учасники',
  'workspace.members.description':
    'Усі, хто бачить поїздки, гроші та файли в цьому просторі.',
  'workspace.members.tableLabel': 'Учасники цього простору',
  'workspace.members.person': 'Людина',
  'workspace.members.role': 'Роль',
  'workspace.members.joined': 'У команді з',
  'workspace.invitations.title': 'Запрошення',
  'workspace.invitations.description':
    'Ті, кого запросили, але хто поки не увійшов.',
  'workspace.invitations.emptyTitle': 'Відкритих запрошень немає',
  'workspace.invitations.emptyBody': 'Усі запрошені в цей простір уже увійшли.',
  'workspace.invitations.expires': 'Діє до {date}',
  'workspace.invitations.expiresSoon': 'скоро',
  'workspace.defaults.title': 'Спільні налаштування',
  'workspace.defaults.description':
    'З чого починається нова поїздка й нова людина. Кожен може перекрити це для себе у своєму профілі.',
  'workspace.defaults.readOnly': 'Лише читання',
  'workspace.defaults.saving': 'Зберігаємо налаштування простору',
  'workspace.defaults.saved': 'Налаштування простору збережено',
  'workspace.defaults.saveFailed': 'Налаштування простору не збереглися',
  'workspace.defaults.saveFailedBody':
    'Змінювати їх може лише власник або адміністратор. Перевірте з’єднання і спробуйте ще раз.',
  'workspace.currency.label': 'Валюта за умовчанням',
  'workspace.currency.hint': 'У ній рахуються бюджети нових поїздок.',
  'workspace.language.label': 'Мова',
  'workspace.language.hint': 'Те, що читає учасник, який не вибрав своєї мови.',
  'workspace.timezone.label': 'Часовий пояс',
  'workspace.dateFormat.label': 'Формат дати',
  'workspace.weekStart.label': 'Тиждень починається з',
  'workspace.distance.label': 'Відстань',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Оплата не завантажилася',
  'billing.loading': 'Завантажуємо тариф і квитанції',
  'billing.status.none': 'Без підписки',
  'billing.status.trialing': 'Пробний період',
  'billing.status.active': 'Активна',
  'billing.status.past_due': 'Платіж не пройшов',
  'billing.status.unpaid': 'Не оплачена',
  'billing.status.paused': 'Припинена',
  'billing.status.canceled': 'Скасована',
  'billing.status.incomplete': 'Незавершена',
  'billing.status.incomplete_expired': 'Прострочена',

  'billing.checkout.completeTitle': 'Платіж отримано',
  'billing.checkout.completeBody':
    'Новий тариф уже застосовується. Він з’явиться тут у ту мить, коли Polar його підтвердить, — зазвичай за кілька секунд.',
  'billing.checkout.cancelledTitle': 'Оплату перервано',
  'billing.checkout.cancelledBody': 'Нічого не списано, і тариф не змінився.',
  'billing.portal.backTitle': 'Повернення зі Polar',
  'billing.portal.backBody':
    'Усе, що ви там змінили, з’явиться тут, щойно Polar це підтвердить.',
  'billing.refresh': 'Оновити',
  'billing.readOnly.title': 'Ви учасник цього простору',
  'billing.readOnly.body':
    'Підписку змінює лише власник або адміністратор. Усе нижче доступне вам тільки для читання.',

  'billing.hero.label': 'Поточний тариф',
  'billing.hero.endsAtPeriod': 'Завершиться в кінці періоду',
  'billing.hero.perYear': '/ рік',
  'billing.hero.perMonth': '/ міс.',
  'billing.hero.freeAllowance': '{trips} поїздки, один мандрівник',
  'billing.hero.perSeatLine': '{seats} × {price}',
  'billing.hero.singleTraveller': 'Один мандрівник',
  'billing.hero.paymentMethod': 'Спосіб оплати',
  'billing.hero.cancel': 'Відмовитися від тарифу',
  'billing.price.free': 'Безкоштовно',
  'billing.provider.opening': 'Відкриваємо Polar',
  'billing.provider.failed': 'Зі Polar зв’язатися не вдалося',
  'billing.provider.failedBody':
    'Нічого не списано. Перевірте з’єднання і спробуйте за хвилину.',

  'billing.renewal.trialEndsToday':
    'Пробний період завершується сьогодні. Додайте картку, і модулі залишаться відкритими.',
  'billing.renewal.trialEndsIn': {
    one: 'Пробний період завершується за {value} день. До того часу картка не потрібна.',
    few: 'Пробний період завершується за {value} дні. До того часу картка не потрібна.',
    many: 'Пробний період завершується за {value} днів. До того часу картка не потрібна.',
    other:
      'Пробний період завершується за {value} дня. До того часу картка не потрібна.',
  },
  'billing.renewal.trialEnded': 'Пробний період завершився.',
  'billing.renewal.endsNoDate':
    'Цей тариф має завершитися і не буде продовжений.',
  'billing.renewal.endsOn':
    'Цей тариф завершується {date} — нічого не зникне, платні модулі просто закриються.',
  'billing.renewal.pastDue':
    'Останній платіж не пройшов. Оновіть картку, щоб не втратити платні модулі.',
  'billing.renewal.unpaid': 'Ця підписка не оплачена, а платні модулі закриті.',
  'billing.renewal.paused':
    'Ця підписка припинена. Відновіть її, коли знову збиратиметеся в дорогу.',
  'billing.renewal.lapsed':
    'Виберіть тариф нижче, щоб знову відкрити броні, щоденник і карти офлайн.',
  'billing.renewal.incomplete':
    'Polar усе ще чекає на підтвердження цього платежу.',
  'billing.renewal.free':
    'Дві поїздки водночас, за наш рахунок. Тариф вище візьмете, коли стане тісно.',
  'billing.renewal.auto': 'Продовжується автоматично.',
  /**
   * No full stop after `{date}`: the frozen table renders a Ukrainian date as
   * «11 вер. 2026 р.», whose abbreviation point already closes the sentence.
   * A second one prints «р..». `renewal.endsOn` keeps the date away from the
   * clause boundary for the same reason.
   */
  'billing.renewal.renewsOn': 'Продовжиться {date}',

  'billing.usage.title': 'Використання',
  'billing.usage.description':
    'Рахується на ходу, тож лічильник ніколи не застаріває. Ліміти йдуть за тарифом, який діє зараз.',
  'billing.quota.seats': 'Учасники',
  'billing.quota.trips': 'Поїздки',
  'billing.quota.storageBytes': 'Сховище',
  'billing.quota.unlimited': 'Без обмежень',
  'billing.quota.noLimit': 'На цьому тарифі без обмежень',
  'billing.quota.used': 'Використано: {quota}',
  'billing.quota.over.seats': {
    one: '{value} місце понад ліміт цього тарифу',
    few: '{value} місця понад ліміт цього тарифу',
    many: '{value} місць понад ліміт цього тарифу',
    other: '{value} місця понад ліміт цього тарифу',
  },
  'billing.quota.over.trips': {
    one: '{value} місце під поїздку понад ліміт цього тарифу',
    few: '{value} місця під поїздки понад ліміт цього тарифу',
    many: '{value} місць під поїздки понад ліміт цього тарифу',
    other: '{value} місця під поїздки понад ліміт цього тарифу',
  },
  'billing.quota.over.storage': '{value} понад ліміт цього тарифу',
  'billing.quota.exhausted.seats': 'Усі місця на цьому тарифі зайняті',
  'billing.quota.exhausted.trips':
    'Усі місця під поїздки на цьому тарифі зайняті',
  'billing.quota.exhausted.storage': 'Сховище на цьому тарифі заповнене',
  'billing.quota.left': 'Залишилося {value}',

  'billing.plans.title': 'Тарифи',
  'billing.plans.description':
    'Тариф змінюйте коли завгодно. Підвищення перераховуємо по днях, а зниження чекає кінця оплаченого періоду.',
  'billing.interval.label': 'Період оплати',
  'billing.interval.monthly': 'Щомісяця',
  'billing.interval.yearly': 'Щороку',
  'billing.interval.saving': 'Економія {value}',
  'billing.plan.free.name': 'Безкоштовний',
  'billing.plan.free.tagline': 'Сплануйте дві найближчі поїздки',
  'billing.plan.free.feature.trips': 'Дві поїздки водночас',
  'billing.plan.free.feature.itinerary': 'Маршрут по днях і карта',
  'billing.plan.free.feature.lists': 'Списки речей і прості бюджети',
  'billing.plan.free.feature.atlas':
    'Карта світу, яка пам’ятає відвідані країни',
  'billing.plan.solo.name': 'Соло',
  'billing.plan.solo.tagline': 'Для того, хто планує все сам',
  'billing.plan.solo.feature.trips': 'Поїздки без обмежень',
  'billing.plan.solo.feature.modules':
    'Усі модулі планування — броні, щоденник, бюджети, збори',
  'billing.plan.solo.feature.offline':
    'Карти офлайн, завантажені ще до вильоту',
  'billing.plan.solo.feature.export': 'Експорт у PDF і в календар',
  'billing.plan.crew.name': 'Команда',
  'billing.plan.crew.tagline': 'Для родин, друзів і невеликих команд',
  'billing.plan.crew.feature.members': 'До десяти людей, оплата за кожного',
  'billing.plan.crew.feature.realtime':
    'Спільна робота в реальному часі з живими курсорами',
  'billing.plan.crew.feature.everything': 'Поїздки без обмежень і всі модулі',
  'billing.plan.crew.feature.storage':
    'Спільне місце для фотографій і документів усієї групи',

  'billing.plan.current': 'Поточний тариф',
  'billing.plan.currentBadge': 'Нинішній',
  'billing.plan.popular': 'Популярний',
  'billing.plan.moveTo': 'Перейти на {plan}',
  'billing.plan.switchYearly': 'Платити за рік',
  'billing.plan.switchMonthly': 'Платити за місяць',
  'billing.plan.upgradeTo': 'Підняти до {plan}',
  'billing.plan.changeTo': 'Змінити на {plan}',
  'billing.plan.perMemberMonth': '/ ос. / міс.',
  'billing.plan.perMonth': '/ міс.',
  'billing.plan.alwaysFree': 'Завжди безкоштовно, без картки',
  'billing.plan.billedYearly': '{amount} до оплати за рік',
  'billing.plan.billedMonthly': '{amount} до оплати за місяць',
  'billing.plan.members': 'Учасники',
  'billing.plan.membersHint': 'Змінюйте коли завгодно — оплата йде слідом.',
  'billing.plan.seatOption': {
    one: '{value} учасник',
    few: '{value} учасники',
    many: '{value} учасників',
    other: '{value} учасника',
  },

  'billing.invoices.title': 'Рахунки',
  'billing.invoices.description':
    'Усі квитанції цього простору, найновіші вгорі.',
  'billing.invoices.portal': 'Портал оплати',
  'billing.invoices.unavailableTitle': 'Квитанції не завантажуються',
  'billing.invoices.unavailableBody':
    'Polar не встиг відповісти щодо історії. Усе вище — актуальне; повний перелік дивіться в порталі оплати або повернітеся за хвилину.',
  'billing.invoices.emptyTitle': 'Рахунків ще немає',
  'billing.invoices.emptyCustomer':
    'Перша квитанція з’явиться тут, щойно закриється період оплати.',
  'billing.invoices.emptyNoCustomer':
    'Цьому простору ще нічого не виставляли. Візьміть платний тариф, і квитанції почнуть збиратися тут.',
  'billing.invoices.tableLabel': 'Історія рахунків',
  'billing.invoices.number': 'Рахунок',
  'billing.invoices.date': 'Дата',
  'billing.invoices.period': 'Період',
  'billing.invoices.amount': 'Сума',
  'billing.invoices.status': 'Статус',
  'billing.invoices.receipt': 'Квитанція',
  'billing.invoices.view': 'Відкрити',
  'billing.invoice.paid': 'Оплачений',
  'billing.invoice.open': 'До оплати',
  'billing.invoice.draft': 'Чернетка',
  'billing.invoice.void': 'Анульований',
  'billing.invoice.uncollectible': 'Безнадійний',
} satisfies TranslationOf<typeof En>

export default messages
