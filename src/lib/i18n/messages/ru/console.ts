/**
 * Всё, что говорит консоль платформы, по-русски.
 *
 * Написано по `../en/console.ts` (`docs/SPEC.md` §9). Английский файл — это схема:
 * `TranslationOf<typeof En>` превращает пропущенный или выдуманный ключ в ошибку сборки, а
 * `__tests__/parity.test.ts` проверяет подстановки, ветви множественного числа и то, что здесь не
 * осталось английского текста.
 *
 * **Множественное число.** `Intl.PluralRules('ru')` даёт `one` (1, 21, 31…), `few` (2–4, 22–24…),
 * `many` (0, 5–20…) и `other` — ветвь для дробных чисел, которая склоняется как `few`.
 *
 * **Две шкалы ролей, которые нигде не смешиваются** (§5). На платформе: администратор, куратор,
 * пользователь. В рабочем пространстве: владелец, администратор, участник. Слово «администратор»
 * попадает в обе, различает их только окружающая фраза.
 *
 * `Suspend` — это «приостановить», а не «удалить»: доступ возвращается снятием приостановки, и
 * формулировки об этом говорят прямо.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* -------------------------------------------------------------- разделы -- */

  'nav.label': 'Разделы консоли',
  'nav.overview': 'Обзор',
  'nav.overview.description': 'Платформа с одного взгляда',
  'nav.accounts': 'Учётные записи',
  'nav.accounts.description': 'Роли, приостановки и сеансы',
  'nav.runs': 'Запуски агентов',
  'nav.runs.description': 'Что строит флот Sandcastle',

  /* -------------------------------------------------------------- оболочка -- */

  'shell.eyebrow': 'Сама платформа',
  'shell.title': 'Консоль',
  'shell.description':
    'Продукт как таковой — учётные записи, полномочия и общий каталог',
  'shell.signedInAs': 'Вы вошли как',
  'shell.error.title': 'Консоль не загрузилась',
  'shell.notFound.title': 'Такой учётной записи нет',
  'shell.notFound.body':
    'Ничто на платформе не носит этот идентификатор. Запись могли удалить после того, как ссылка была создана, — или в адресе опечатка.',
  'shell.allAccounts': 'Все учётные записи',
  'shell.overview': 'Обзор консоли',

  'failure.fallback': 'Действие не прошло. Повторите попытку чуть позже.',

  /* ----------------------------------------------------------------- обзор -- */

  'overview.error.title': 'Обзор не загрузился',
  'overview.standing.title': 'Ваши полномочия на платформе',
  'overview.standing.body':
    'Учётные записи, сеансы и работа от чужого имени принадлежат администратору платформы, поэтому консоль показывает вам каталог — и ничего больше.',
  'overview.stat.accounts': 'Учётные записи',
  'overview.stat.accounts.caption': {
    one: 'Одна из них имеет роль на платформе',
    few: '{staff} из них имеют роль на платформе',
    many: '{staff} из них имеют роль на платформе',
    other: '{staff} из них имеют роль на платформе',
  },
  'overview.stat.admins': 'Администраторы',
  'overview.stat.admins.caption': 'Полная власть над записями и сеансами',
  'overview.stat.curators': 'Кураторы',
  'overview.stat.curators.caption': 'Только каталог — и никогда учётные записи',
  'overview.stat.suspended': 'Приостановлены',
  'overview.stat.suspended.none': 'Снаружи не остался никто',
  'overview.stat.suspended.some':
    'Везде выведены из сеанса, пока приостановку не снимут',
  'overview.stat.suspended.review': 'Посмотреть их',
  'overview.newest.label': 'Самые новые записи',
  'overview.newest.empty.title': 'Учётных записей пока нет',
  'overview.newest.empty.body':
    'Тот, кто зарегистрируется первым, появится здесь.',
  'overview.catalogue.label': 'Каталог по состоянию',
  'overview.catalogue.empty.title': 'Общий каталог ещё не открыт',
  'overview.catalogue.empty.body':
    'Когда конвейер загрузки встанет на место, эта панель посчитает каждое место общего каталога как черновик, на проверке или опубликованное — и откроет список за каждым числом.',
  'overview.scraping.label': 'Запуски сбора',
  'overview.scraping.empty.title': 'Ни один источник не запускался',
  'overview.scraping.empty.body':
    'Источники собираются раз в неделю. После первого запуска здесь окажутся последние пять — с тем, что каждый взял, что изменил и что отбросил.',

  /* ------------------------------------------------------------ шкала ролей -- */

  'role.admin': 'Администратор',
  'role.admin.summary':
    'Полная власть на платформе: записи, роли, приостановки, сеансы и работа от чужого имени.',
  'role.admin.holds.accounts': 'Создавать записи и назначать роли на платформе',
  'role.admin.holds.bans': 'Приостанавливать записи и снимать приостановку',
  'role.admin.holds.sessions': 'Прерывать сеансы и задавать пароли',
  'role.admin.holds.impersonate':
    'Работать от имени записи в течение пятнадцати минут',
  'role.admin.holds.curation': 'Всё, что может куратор',
  'role.admin.withheld.admins':
    'Работать от имени другого администратора платформы',
  'role.curator': 'Куратор',
  'role.curator.summary':
    'Ведение каталога, подборок, источников и общих ссылок. Ничего, что касается учётных записей.',
  'role.curator.holds.places': 'Читать, писать и публиковать места каталога',
  'role.curator.holds.packs': 'Читать, писать и публиковать подборки мест',
  'role.curator.holds.sources': 'Читать и запускать источники каталога',
  'role.curator.holds.shares': 'Проверять и отзывать общие ссылки',
  'role.curator.withheld.accounts': 'Всё, что касается записи или сеанса',
  'role.curator.withheld.tokens': 'Выдавать и отзывать машинные учётные данные',
  'role.user': 'Пользователь',
  'role.user.summary': 'Никаких полномочий на платформе. Это почти все.',
  'role.user.withheld.everything': 'Любое полномочие платформы, без исключений',

  /* -------------------------------------------------------- одна учётная запись -- */

  'identity.you': 'Это вы',
  'status.active': 'Активна',
  'status.suspended': 'Приостановлена',
  'status.permanent': 'Бессрочно',
  'status.until': 'До {date}',
  'status.unverified': 'Не подтверждена',
  'device.on': '{browser} в {platform}',
  'device.unrecognised': 'Неопознанное устройство',

  /* ---------------------------------------------------------- список записей -- */

  'users.error.title': 'Список записей не загрузился',
  'users.total': 'всего {total}',
  'users.loading': 'Записи загружаются',
  'users.table.label': 'Учётные записи платформы',
  'users.search.label': 'Искать среди записей',
  'users.search.email': 'Искать по адресам эл. почты',
  'users.search.name': 'Искать по именам',
  'users.search.column': 'В каком столбце искать',
  'users.search.submit': 'Искать',
  'users.field.email': 'Эл. почта',
  'users.field.name': 'Имя',
  'users.filter.role.label': 'Отбор по роли на платформе',
  'users.filter.role.any': 'Любая роль',
  'users.filter.role.admin': 'Администраторы',
  'users.filter.role.curator': 'Кураторы',
  'users.filter.status.label': 'Отбор по состоянию записи',
  'users.filter.status.any': 'Любое состояние',
  'users.filter.hint':
    'Сузьте по роли или по состоянию — по чему-то одному за раз.',
  'users.column.account': 'Учётная запись',
  'users.column.role': 'Роль на платформе',
  'users.column.status': 'Состояние',
  'users.column.joined': 'Присоединился',
  'users.column.actions': 'Действия',
  'users.joined': 'Присоединился {date}',
  'users.pastEnd.title': 'Эта страница за пределами списка',
  'users.pastEnd.body': {
    one: 'В этом представлении одна запись, и страница 1 — единственная, которая у неё есть.',
    few: 'В этом представлении {total} записи, то есть {pages}. Страница {page} лежит за этим пределом.',
    many: 'В этом представлении {total} записей, то есть {pages}. Страница {page} лежит за этим пределом.',
    other:
      'В этом представлении {total} записи, то есть {pages}. Страница {page} лежит за этим пределом.',
  },
  'users.pastEnd.pages': {
    one: 'одна страница',
    few: '{pages} страницы',
    many: '{pages} страниц',
    other: '{pages} страницы',
  },
  'users.pastEnd.back': 'Вернуться на первую страницу',
  'users.empty.filtered.title': 'Под этот отбор ничего не подходит',
  'users.empty.filtered.body':
    'Ни одна запись платформы не отвечает этому запросу. Расширьте поиск или сбросьте отбор, чтобы увидеть всех.',
  'users.empty.title': 'Показывать нечего',
  'users.empty.body':
    'Это представление пусто. Ничего не отобрано, значит, и расширять здесь нечего.',

  /* --------------------------------------------------------- страница записи -- */

  'account.error.title': 'Эта запись не загрузилась',
  'account.loading': 'Запись загружается',
  'account.meta.lastChange': 'Последнее изменение',
  'account.meta.id': 'Идентификатор записи',
  'account.banned.title': 'Эта запись приостановлена',
  'account.banned.noReason': 'Вместе с приостановкой причина не записана.',
  'account.banned.permanent': ' Действует, пока администратор её не снимет.',
  'account.banned.until': ' Снимется сама {date}.',
  'account.banned.untilUnknown': 'в момент истечения',
  'account.authority.label': 'Полномочия на платформе',
  'account.authority.may': 'Может',
  'account.authority.mayNot': 'Не может',
  'account.authority.none': 'Ничего на платформе.',
  'account.workspaces.label': 'Рабочие пространства',
  'account.workspaces.truncated':
    'Эта запись состоит в большем числе пространств, чем {listed}, перечисленные здесь.',
  'account.workspaces.empty.title': 'Ни в одном пространстве',
  'account.workspaces.empty.body':
    'Эта запись пока не состоит ни в одном рабочем пространстве. Одно создаётся при первом входе, и каждое, куда её пригласят, появится здесь.',
  'account.workspaces.column.workspace': 'Рабочее пространство',
  'account.workspaces.column.role': 'Роль',
  'account.workspaces.column.plan': 'Тариф',
  'account.subscription.label': 'Подписка',
  'account.subscription.free.title': 'На бесплатном тарифе',
  'account.subscription.free.body':
    'Пространство, которым владеет эта запись, ни разу не проходило через кассу, поэтому записи о подписке у него нет и оно работает в пределах бесплатного тарифа.',
  'account.subscription.none.title': 'Этой записи ничего не выставляется',
  'account.subscription.none.body':
    'У этой записи нет ни одного рабочего пространства. Быть участником чужого пространства не значит быть тем, кому оно выставляет счёт, так что собирать здесь нечего.',
  'account.subscription.endsAtClose': 'Заканчивается в конце периода',
  'account.subscription.seats': 'Места',
  'account.subscription.seatsValue': '{used} из {limit}',
  'account.subscription.ends': 'Заканчивается',
  'account.subscription.renews': 'Продлевается',
  'account.sessions.label': 'Живые сеансы',
  'account.sessions.truncated':
    'Эта запись держит больше сеансов, чем перечисляет один вызов. Чтобы убедиться, что не осталось ни одного, прервите все сеансы из меню действий.',
  'account.sessions.empty.title': 'Везде выведена из сеанса',
  'account.sessions.empty.body':
    'У этой записи нет ни одного непросроченного сеанса. Она появится здесь в момент нового входа.',
  'account.sessions.column.device': 'Устройство',
  'account.sessions.column.address': 'Адрес',
  'account.sessions.column.started': 'Начат',
  'account.sessions.column.expires': 'Истекает',
  'account.sessions.impersonated': 'Рождён работой от чужого имени',
  'account.sessions.noAddress': 'Не записан',
  'account.sessions.noAddressLong': 'Адрес не записан',
  'account.sessions.when': 'Начат {started} · истекает {expires}',
  'account.audit.label': 'История проверок',
  'account.audit.truncated':
    'Журнал содержит больше записей. Проверочный след платформы доступен только на дозапись и хранится четыреста дней.',
  'account.audit.empty.title': 'С этой записью ничего не делали',
  'account.audit.empty.body':
    'Каждая смена роли, приостановка, заданный пароль, прерванный сеанс и работа от чужого имени пишутся сюда вместе с тем, кто это сделал. Здесь никто ничего не трогал.',

  /* ------------------------------- шкала рабочего пространства -- */

  'workspace.role.owner': 'Владелец',
  'workspace.role.admin': 'Администратор',
  'workspace.role.member': 'Участник',
  'plan.free': 'Бесплатный',
  'plan.starter': 'Начальный',
  'plan.pro': 'Профессиональный',
  'plan.business': 'Корпоративный',
  'subscription.trialing': 'Пробный период',
  'subscription.active': 'Активна',
  'subscription.pastDue': 'Просрочена',
  'subscription.canceled': 'Отменена',
  'subscription.incomplete': 'Не завершена',
  'subscription.expired': 'Истекла',
  'subscription.unpaid': 'Не оплачена',
  'subscription.paused': 'Приостановлена',

  /* ------------------------------------------------------- журнал проверок -- */

  'audit.action.created': 'Запись создана',
  'audit.action.updated': 'Данные записи изменены',
  'audit.action.roleChanged': 'Роль на платформе изменена',
  'audit.action.banned': 'Запись приостановлена',
  'audit.action.unbanned': 'Приостановка снята',
  'audit.action.deleted': 'Запись удалена',
  'audit.action.passwordSet': 'Пароль задан администратором',
  'audit.action.emailSet': 'Адрес эл. почты изменён',
  'audit.action.impersonationStarted': 'Работа от чужого имени начата',
  'audit.action.impersonationEnded': 'Работа от чужого имени завершена',
  'audit.action.sessionRevoked': 'Сеанс прерван',
  'audit.action.sessionRevokedAll': 'Все сеансы прерваны',
  'audit.actor.system': 'Сама платформа',
  'audit.actor.system.detail': 'автоматически',
  'audit.actor.agent': 'Машинные учётные данные',
  'audit.actor.agent.detail': 'токен MCP',
  'audit.actor.deleted': 'Удалённая запись',
  'audit.actorBadge': 'Тогда: {role}',
  'audit.field.name': 'Имя',
  'audit.field.email': 'Адрес эл. почты',
  'audit.field.emailVerified': 'Почта подтверждена',
  'audit.field.role': 'Роль на платформе',
  'audit.field.banned': 'Приостановлена',
  'audit.field.banReason': 'Причина',
  'audit.field.banExpiresAt': 'Приостановка заканчивается',
  'audit.field.revoked': 'Прерванные сеансы',
  'audit.field.impersonating': 'Работает от имени',
  'audit.field.impersonatedBy': 'От её имени работает',
  'audit.field.expiresAt': 'Сеанс истекает',
  'audit.field.targetRole': 'Их роль на платформе',
  'audit.field.sessionId': 'Затронутый сеанс',
  'audit.value.yes': 'да',
  'audit.value.no': 'нет',
  'audit.value.cleared': 'очищено',
  'audit.became': 'стало',

  /* ------------------------------------------------------------- диалоги -- */

  'dialog.cancel': 'Отмена',

  'create.button': 'Новая запись',
  'create.title': 'Создать запись',
  'create.body':
    'Адрес не подтверждается, и письма никто не получит — пароль передайте сами.',
  'create.confirm': 'Создать запись',
  'create.name.placeholder': 'Анна Соколова',
  'create.email': 'Адрес эл. почты',
  'create.email.placeholder': 'anna@planned.travel',
  'create.password': 'Пароль',
  'create.password.hint':
    'Достаточно длинный, чтобы быть фразой. Владелец записи сможет его сменить.',
  'create.done': 'Запись создана',
  'create.done.body': '{email} может войти с паролем, который вы задали.',

  'action.menu.label': 'Действия для {name}',
  'action.group.account': 'Учётная запись',
  'action.group.credentials': 'Учётные данные',

  'action.role.item': 'Сменить роль на платформе',
  'action.role.self':
    'Не на своей записи — понизив себя, можно оставить платформу без администратора.',
  'action.role.body':
    'Что {name} может делать на самой платформе. Членство в рабочих пространствах — отдельный словарь, и это его не сдвигает.',
  'action.role.confirm': 'Сохранить роль',
  'action.role.current': 'Сейчас',
  'action.role.done': 'Роль на платформе обновлена',
  'action.role.done.body': '{name} теперь имеет на платформе роль «{role}».',

  'action.impersonate.item': 'Работать от имени записи',
  'action.impersonate.self': 'Становиться некем — это ваша собственная запись.',
  'action.impersonate.banned':
    'Запись приостановлена, поэтому у неё нет сеанса, который можно было бы надеть.',
  'action.impersonate.admin':
    'Ни одна роль платформы не может работать от имени администратора, включая вашу.',
  'action.impersonate.title': 'Работать от имени {name}',
  'action.impersonate.body':
    'Пятнадцать минут вы будете видеть продукт ровно так, как видит его эта запись.',
  'action.impersonate.confirm': 'Начать',
  'action.impersonate.note.bar':
    'Полоса предупреждения останется на каждом экране, пока вы не закончите, и закрыть её нельзя.',
  'action.impersonate.note.platform':
    'Пока вы работаете от чужого имени, действия платформы недоступны — консоль тоже.',
  'action.impersonate.note.audit':
    'И начало, и конец пишутся в проверочный след платформы вместе с вашим именем.',

  'action.password.item': 'Задать пароль',
  'action.password.title': 'Задать пароль для {name}',
  'action.password.body':
    'Пользуйтесь этим, чтобы вернуть человека в запертую запись или отрезать нападающего от захваченной.',
  'action.password.confirm': 'Задать пароль',
  'action.password.field': 'Новый пароль',
  'action.password.hint.self':
    'Как только он задан, все сеансы прерываются — ваш в том числе.',
  'action.password.hint':
    'Как только он задан, каждый сеанс этой записи прерывается.',
  'action.password.done': 'Пароль задан',
  'action.password.done.body': '{name} выведен из сеанса на всех устройствах.',

  'action.sessions.item': 'Прервать все сеансы',
  'action.sessions.body.self':
    'Это выведет из сеанса все ваши устройства, включая то, на котором вы это читаете.',
  'action.sessions.body':
    '{name} будет выведен из сеанса на всех устройствах и должен будет войти заново.',
  'action.sessions.confirm': 'Прервать сеансы',
  'action.sessions.done': 'Сеансы прерваны',
  'action.sessions.done.body': {
    one: 'Один сеанс завершён.',
    few: 'Завершено сеансов: {revoked}.',
    many: 'Завершено сеансов: {revoked}.',
    other: 'Завершено сеансов: {revoked}.',
  },

  'action.ban.item': 'Приостановить запись',
  'action.ban.self':
    'Не на своей записи — приостановив себя, вы отрежете себе путь назад.',
  'action.ban.title': 'Приостановить {name}',
  'action.ban.body':
    'Все сеансы прерываются немедленно, и запись не сможет войти, пока приостановку не снимут или пока она не истечёт.',
  'action.ban.confirm': 'Приостановить запись',
  'action.ban.reason': 'Причина',
  'action.ban.reason.hint':
    'Хранится в проверочном следе платформы тринадцать месяцев и не показывается никому, кроме администратора.',
  'action.ban.reason.placeholder':
    'Повторные жалобы на злоупотребление из трёх рабочих пространств',
  'action.ban.duration': 'Срок',
  'action.ban.duration.label': 'Срок приостановки',
  'action.ban.duration.permanent.body':
    'Держится, пока администратор осознанно её не снимет.',
  'action.ban.duration.day': '24 часа',
  'action.ban.duration.day.body':
    'Достаточно долго, чтобы прервать, достаточно коротко, чтобы остаться вмешательством.',
  'action.ban.duration.week': '7 дней',
  'action.ban.duration.week.body': 'Неделя на разбор жалобы.',
  'action.ban.duration.month': '30 дней',
  'action.ban.duration.month.body': 'Месяц вынужденной тишины.',
  'action.ban.duration.quarter': '90 дней',
  'action.ban.duration.quarter.body':
    'Самый долгий срок, который предлагает консоль. Дальше — только бессрочная приостановка.',
  'action.ban.done': 'Запись приостановлена',
  'action.ban.done.body': '{name} выведен из сеанса везде и войти не может.',

  'action.unban.item': 'Снять приостановку',
  'action.unban.title': 'Снять приостановку с {name}',
  'action.unban.body':
    'Запись сможет войти со следующей же попытки. Ни один прежний сеанс не возвращается.',
  'action.unban.confirm': 'Снять приостановку',
  'action.unban.done': 'Приостановка снята',
  'action.unban.done.body':
    '{name} снова может войти. Ни один сеанс не восстановлен.',

  'action.delete.item': 'Удалить запись',
  'action.delete.self': 'Не на своей записи — обратного пути оттуда нет.',
  'action.delete.title': 'Удалить {name}',
  'action.delete.body':
    'Запись, её сеансы и все привязанные к ней учётные данные исчезнут. Это необратимо.',
  'action.delete.confirm': 'Удалить запись',
  'action.delete.note':
    'Содержимое, созданное этим человеком в рабочем пространстве, остаётся у пространства, которое им владеет. Приостановка вместо удаления сохраняет след и забирает доступ.',
  'action.delete.owners':
    'Нельзя удалить аккаунт, который остаётся единственным владельцем рабочего пространства, где есть другие люди. Сначала назначьте там другого владельца или приостановите аккаунт вместо удаления.',
  'action.delete.done': 'Запись удалена',
  'action.delete.done.body':
    '{name} и всё, что было привязано к записи, исчезло.',

  'session.revoke.label': 'Прервать сеанс на {device}',
  'session.revoke.title': 'Прервать этот сеанс',
  'session.revoke.body':
    '{device} придётся войти заново при следующем же запросе. Если это тот сеанс, в котором вы читаете это, вы выйдете вместе с ним.',
  'session.revoke.confirm': 'Прервать сеанс',
  'session.revoke.done': 'Сеанс прерван',
  'session.revoke.done.body':
    'Устройству придётся войти заново при следующем запросе.',

  /* ------------------------------------------------------ запуски агентов -- */

  'runs.error.title': 'Реестр запусков не ответил',
  'runs.origin.local': 'Локально',
  'runs.origin.githubActions': 'Действия GitHub',
  'runs.stat.live': 'Живые запуски',
  'runs.stat.live.none': 'Сейчас ничего не строится',
  'runs.stat.live.some': 'Пульс против пятиминутной аренды',
  'runs.stat.issues': 'Удерживаемые задачи',
  'runs.stat.issues.caption':
    'Каждая арендована одним запуском — вместе с предками и потомками',
  'runs.stat.orphans': 'Осиротевшие ветки',
  'runs.stat.orphans.none': 'Бесхозной работы нет',
  'runs.stat.orphans.some':
    'Коммиты остановившегося запуска ждут, чтобы их подобрали',
  'runs.live.empty.title': 'Ни один запуск не зарегистрирован',
  'runs.live.empty.body':
    'Запуск появится здесь, как только зарегистрирует себя — с этой машины, с другой или с исполнителя GitHub — вместе с задачами, которые он взял.',
  'runs.holds.nothing': 'ничего не держит',
  'runs.holds': 'держит {issues}',
  'runs.uptime': 'работает {elapsed} · {lease}',
  'runs.lease.expired': 'аренда истекла',
  'runs.lease.left': 'осталось {elapsed}',
  'runs.wip.label': 'Работа в процессе',
  'runs.wip.empty.title': 'Ни одна ветка не несёт работы',
  'runs.wip.empty.body':
    'Запуск записывает ветку, как только на ней появляется коммит; если он погибнет, следующему запуску, взявшему задачу, предложат эту работу вместо того, чтобы начинать заново.',
  'runs.wip.orphaned': 'Осиротела',
  'runs.wip.meta': {
    one: '{commits} коммит · {elapsed} назад',
    few: '{commits} коммита · {elapsed} назад',
    many: '{commits} коммитов · {elapsed} назад',
    other: '{commits} коммита · {elapsed} назад',
  },
  'runs.recent.label': 'Недавно завершённые',
  'runs.recent.empty.title': 'Ни один запуск ещё не завершился',
  'runs.recent.empty.body':
    'Последние пятьдесят запусков остаются здесь — с тем, чем каждый из них закончился.',
  'runs.ago': '{elapsed} назад',
  'runs.notCoordinator.title': 'Это развёртывание не координирует флот',
  'runs.notCoordinator.body':
    'Реестр запусков привязан только к промежуточной среде, и намеренно: второй реестр заставил бы оба флота считать, что очередь держит именно он, — а это ровно то, ради предотвращения чего он и существует. Читайте флот в промежуточной среде.',
  'nav.providers': 'Поставщики',
  'nav.providers.description': 'Исходящие вызовы и их потолки',
  'providers.error.title': 'Не удалось прочитать счётчики поставщиков',
  'providers.list.label': 'Сервисы',
  'providers.status.planned': 'Не подключён',
  'providers.status.planned.description':
    'Этот сервис пока никто не вызывает, так что считать нечего. Он в списке, чтобы потолок согласовали до первого вызова, а не после первого счёта.',
  'providers.policy.allow': 'Пропускает сверх потолка',
  'providers.policy.block': 'Отказывает на потолке',
  'providers.badge.blocked': {
    one: 'Один вызов отклонён',
    few: '{calls} вызова отклонено',
    many: '{calls} вызовов отклонено',
    other: '{calls} вызова отклонено',
  },
  'providers.limit.none': 'Потолок не согласован · {used} в этом месяце',
  'providers.limit.value': '{used} из {limit}',
  'providers.limit.window.day': 'Сегодня',
  'providers.limit.window.month': 'В этом месяце',
  'providers.measuring.none': 'Пока ничего не измерено',
  'providers.measuring.since': 'Измеряем с {date}',
  'providers.stat.calls': 'Вызовы за месяц',
  'providers.stat.calls.caption': 'По всем подключённым сервисам',
  'providers.stat.errors': 'Неудачные вызовы',
  'providers.stat.errors.caption':
    'Считаются и как вызовы: большинство поставщиков их тарифицирует',
  'providers.stat.nearLimit': 'Близко к потолку',
  'providers.stat.nearLimit.caption':
    'Сервисы выше своего порога предупреждения',
  'providers.stat.blocked': 'Отклонённые вызовы',
  'providers.stat.blocked.none': 'Ничего не отклонено',
  'providers.stat.blocked.some': 'Спрос, отклонённый потолком',
  'providers.forecast.label': 'Прогноз',
  'providers.forecast.provider': 'Сервис',
  'providers.forecast.monthEnd': 'К концу месяца',
  'providers.forecast.runRate': 'В месяц при этом темпе',
  'providers.forecast.perWorkspace': 'На рабочее пространство в месяц',
  'providers.forecast.noWorkspaceTraffic':
    'Нет трафика рабочих пространств для усреднения',
  'providers.forecast.window': {
    one: 'Прогноз по одному часу измерений.',
    few: 'Прогноз по {hours} ч измерений.',
    many: 'Прогноз по {hours} ч измерений.',
    other: 'Прогноз по {hours} ч измерений.',
  },
  'providers.forecast.tooEarly': {
    one: 'Измерен пока лишь один час — для прогноза мало. Растянуть неполные сутки на месяц — это арифметика, а не прогноз.',
    few: 'Измерено пока {hours} ч — для прогноза мало. Растянуть неполные сутки на месяц — это арифметика, а не прогноз.',
    many: 'Измерено пока {hours} ч — для прогноза мало. Растянуть неполные сутки на месяц — это арифметика, а не прогноз.',
    other:
      'Измерено пока {hours} ч — для прогноза мало. Растянуть неполные сутки на месяц — это арифметика, а не прогноз.',
  },
  'providers.forecast.atWorkspaces': 'При скольких рабочих пространствах',
  'providers.forecast.callsEach': 'Вызовов на каждое в месяц',
  'providers.forecast.projected': 'Около {calls} вызовов в месяц.',
  'providers.workspaces.label': 'Самые активные пространства',
  'providers.workspaces.platform': 'Платформа (без пространства)',
  'providers.workspaces.empty.title': 'Пока ничего не отнесено',
  'providers.workspaces.empty.description':
    'Вызов, сделанный для рабочего пространства, записывается на него. Работа по расписанию и почта платформы не принадлежат ни одному и считаются отдельно.',
  'providers.readOnly':
    'Эти счётчики можно читать, но не двигать потолок. Изменение лимита или политики требует права provider:configure.',
  'providers.status.planned.agreed.month':
    'Согласованный потолок: {limit} в месяц. Действует с первого вызова, как только появится клиент.',
  'providers.status.planned.agreed.day':
    'Согласованный потолок: {limit} в сутки. Действует с первого вызова, как только появится клиент.',
  'providers.edit.button': 'Изменить',
  'providers.edit.title': 'Потолок для {provider}',
  'providers.edit.body':
    'Сколько эта установка договорилась тратить у поставщика и что происходит, когда лимит исчерпан.',
  'providers.edit.confirm': 'Сохранить потолок',
  'providers.edit.done': 'Потолок для {provider} сохранён',
  'providers.edit.label': 'Название',
  'providers.edit.ceiling': 'Вызовов включено',
  'providers.edit.ceiling.hint':
    'Оставьте пустым, если потолок не согласован. Пусто и ноль — разное: ноль при «отказывать» отклоняет каждый вызов.',
  'providers.edit.ceiling.placeholder': 'Без потолка',
  'providers.edit.window': 'Измеряется за',
  'providers.edit.window.month': 'Календарный месяц',
  'providers.edit.window.month.body': 'Обычная форма включённой квоты.',
  'providers.edit.window.day': 'Сутки',
  'providers.edit.window.day.body':
    'Часть поставщиков считает посуточно — бесплатный план Geoapify это 3 000 кредитов в сутки.',
  'providers.edit.policy': 'На потолке',
  'providers.edit.policy.allow': 'Звать дальше и платить',
  'providers.edit.policy.allow.body':
    'Вызовы идут сверх потолка, консоль предупреждает. Ничего не перестаёт работать.',
  'providers.edit.policy.block': 'Отказывать в дальнейших вызовах',
  'providers.edit.policy.block.body':
    'Вызовы отклоняются до сброса окна. То, что зависит от этого поставщика, перестаёт работать — выбирайте только там, где такой отказ дешевле.',
  'providers.edit.policy.block.refused':
    '{provider} отклонять нельзя: у него нет запасного пути, так что отказ в вызовах остановил бы функцию, а не ограничил расход. Потолок, который только предупреждает, по-прежнему доступен.',
  'providers.edit.warn': 'Предупреждать при (%)',
  'providers.edit.critical': 'Тревога при (%)',
  'providers.edit.thresholds.hint':
    'Где индикатор становится жёлтым и красным. Предупреждение не должно быть выше тревоги.',
} satisfies TranslationOf<typeof En>

export default messages
