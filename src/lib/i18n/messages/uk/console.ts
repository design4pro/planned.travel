/**
 * Усе, що промовляє консоль платформи, українською.
 *
 * Написано за `../en/console.ts` (`docs/SPEC.md` §9). Англійський файл — це схема:
 * `TranslationOf<typeof En>` перетворює пропущений або вигаданий ключ на помилку збірки, а
 * `__tests__/parity.test.ts` перевіряє підстановки, гілки множини й те, що тут не лишилося
 * англійського тексту.
 *
 * **Множина.** `Intl.PluralRules('uk')` дає `one` (1, 21, 31…), `few` (2–4, 22–24…),
 * `many` (0, 5–20…) і `other` — гілку для дробових чисел, що відмінюється як `few`.
 *
 * **Дві шкали ролей, які ніде не змішуються** (§5). На платформі: адміністратор, куратор,
 * користувач. У робочому просторі: власник, адміністратор, учасник. Слово «адміністратор» є в
 * обох, розрізняє їх лише сусідня фраза.
 *
 * `Suspend` — це «призупинити», а не «видалити»: доступ повертає зняття призупинення, і формулювання
 * кажуть про це прямо.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* -------------------------------------------------------------- розділи -- */

  'nav.label': 'Розділи консолі',
  'nav.overview': 'Огляд',
  'nav.overview.description': 'Платформа з одного погляду',
  'nav.accounts': 'Облікові записи',
  'nav.accounts.description': 'Ролі, призупинення та сеанси',
  'nav.runs': 'Запуски агентів',
  'nav.runs.description': 'Що будує флот Sandcastle',

  /* -------------------------------------------------------------- оболонка -- */

  'shell.eyebrow': 'Сама платформа',
  'shell.title': 'Консоль',
  'shell.description':
    'Сам продукт — облікові записи, повноваження та спільний каталог',
  'shell.signedInAs': 'Ви увійшли як',
  'shell.error.title': 'Консоль не завантажилася',
  'shell.notFound.title': 'Такого облікового запису немає',
  'shell.notFound.body':
    'Ніщо на платформі не має цього ідентифікатора. Запис могли видалити після того, як посилання створили, — або в адресі описка.',
  'shell.allAccounts': 'Усі облікові записи',
  'shell.overview': 'Огляд консолі',

  'failure.fallback': 'Дія не пройшла. Спробуйте ще раз трохи згодом.',

  /* ------------------------------------------------------------------ огляд -- */

  'overview.error.title': 'Огляд не завантажився',
  'overview.standing.title': 'Ваші повноваження на платформі',
  'overview.standing.body':
    'Облікові записи, сеанси й робота від чужого імені належать адміністраторові платформи, тож консоль показує вам каталог — і більш нічого.',
  'overview.stat.accounts': 'Облікові записи',
  'overview.stat.accounts.caption': {
    one: 'Один із них має роль на платформі',
    few: '{staff} із них мають роль на платформі',
    many: '{staff} із них мають роль на платформі',
    other: '{staff} із них мають роль на платформі',
  },
  'overview.stat.admins': 'Адміністратори',
  'overview.stat.admins.caption': 'Повна влада над записами та сеансами',
  'overview.stat.curators': 'Куратори',
  'overview.stat.curators.caption': 'Лише каталог — і ніколи облікові записи',
  'overview.stat.suspended': 'Призупинені',
  'overview.stat.suspended.none': 'Назовні не лишився ніхто',
  'overview.stat.suspended.some':
    'Скрізь виведені із сеансу, доки призупинення не знімуть',
  'overview.stat.suspended.review': 'Переглянути їх',
  'overview.newest.label': 'Найновіші записи',
  'overview.newest.empty.title': 'Облікових записів поки немає',
  'overview.newest.empty.body':
    'Той, хто зареєструється першим, з’явиться тут.',
  'overview.catalogue.label': 'Каталог за станом',
  'overview.catalogue.empty.title': 'Спільний каталог ще не відкрито',
  'overview.catalogue.empty.body':
    'Коли конвеєр завантаження стане на місце, ця панель порахує кожне місце спільного каталогу як чернетку, на перевірці або опубліковане — і відкриє список за кожним числом.',
  'overview.scraping.label': 'Запуски збирання',
  'overview.scraping.empty.title': 'Жодного джерела не запускали',
  'overview.scraping.empty.body':
    'Джерела збирають раз на тиждень. Після першого запуску тут будуть останні п’ять — із тим, що кожен узяв, що змінив і що відкинув.',

  /* ------------------------------------------------------------ шкала ролей -- */

  'role.admin': 'Адміністратор',
  'role.admin.summary':
    'Повна влада на платформі: записи, ролі, призупинення, сеанси та робота від чужого імені.',
  'role.admin.holds.accounts': 'Створювати записи й надавати ролі на платформі',
  'role.admin.holds.bans': 'Призупиняти записи та знімати призупинення',
  'role.admin.holds.sessions': 'Переривати сеанси й задавати паролі',
  'role.admin.holds.impersonate':
    'Працювати від імені запису протягом п’ятнадцяти хвилин',
  'role.admin.holds.curation': 'Усе, що може куратор',
  'role.admin.withheld.admins':
    'Працювати від імені іншого адміністратора платформи',
  'role.curator': 'Куратор',
  'role.curator.summary':
    'Ведення каталогу, добірок, джерел і спільних посилань. Нічого, що торкається облікових записів.',
  'role.curator.holds.places': 'Читати, писати й публікувати місця каталогу',
  'role.curator.holds.packs': 'Читати, писати й публікувати добірки місць',
  'role.curator.holds.sources': 'Читати й запускати джерела каталогу',
  'role.curator.holds.shares': 'Переглядати й відкликати спільні посилання',
  'role.curator.withheld.accounts': 'Усе, що торкається запису або сеансу',
  'role.curator.withheld.tokens': 'Видавати й відкликати машинні облікові дані',
  'role.user': 'Користувач',
  'role.user.summary': 'Жодних повноважень на платформі. Це майже всі.',
  'role.user.withheld.everything':
    'Будь-яке повноваження платформи, без винятків',

  /* ---------------------------------------------------- один обліковий запис -- */

  'identity.you': 'Це ви',
  'status.active': 'Активний',
  'status.suspended': 'Призупинений',
  'status.permanent': 'Безстроково',
  'status.until': 'До {date}',
  'status.unverified': 'Не підтверджено',
  'device.on': '{browser} у {platform}',
  'device.unrecognised': 'Невпізнаний пристрій',

  /* ---------------------------------------------------------- список записів -- */

  'users.error.title': 'Список записів не завантажився',
  'users.total': 'усього {total}',
  'users.loading': 'Записи завантажуються',
  'users.table.label': 'Облікові записи платформи',
  'users.search.label': 'Шукати серед записів',
  'users.search.email': 'Шукати за адресами ел. пошти',
  'users.search.name': 'Шукати за іменами',
  'users.search.column': 'У якому стовпці шукати',
  'users.search.submit': 'Шукати',
  'users.field.email': 'Ел. пошта',
  'users.field.name': 'Ім’я',
  'users.filter.role.label': 'Добір за роллю на платформі',
  'users.filter.role.any': 'Будь-яка роль',
  'users.filter.role.admin': 'Адміністратори',
  'users.filter.role.curator': 'Куратори',
  'users.filter.status.label': 'Добір за станом запису',
  'users.filter.status.any': 'Будь-який стан',
  'users.filter.hint':
    'Звузьте за роллю або за станом — за чимось одним за раз.',
  'users.column.account': 'Обліковий запис',
  'users.column.role': 'Роль на платформі',
  'users.column.status': 'Стан',
  'users.column.joined': 'Приєднався',
  'users.column.actions': 'Дії',
  'users.joined': 'Приєднався {date}',
  'users.pastEnd.title': 'Ця сторінка за межами списку',
  'users.pastEnd.body': {
    one: 'У цьому поданні один запис, і сторінка 1 — єдина, яку він має.',
    few: 'У цьому поданні {total} записи, тобто {pages}. Сторінка {page} лежить за цією межею.',
    many: 'У цьому поданні {total} записів, тобто {pages}. Сторінка {page} лежить за цією межею.',
    other:
      'У цьому поданні {total} записи, тобто {pages}. Сторінка {page} лежить за цією межею.',
  },
  'users.pastEnd.pages': {
    one: 'одна сторінка',
    few: '{pages} сторінки',
    many: '{pages} сторінок',
    other: '{pages} сторінки',
  },
  'users.pastEnd.back': 'Повернутися на першу сторінку',
  'users.empty.filtered.title': 'Під цей добір нічого не підходить',
  'users.empty.filtered.body':
    'Жоден запис платформи не відповідає цьому запиту. Розширте пошук або скиньте добір, щоб побачити всіх.',
  'users.empty.title': 'Показувати нічого',
  'users.empty.body':
    'Це подання порожнє. Нічого не дібрано, отже, і розширювати тут нічого.',

  /* --------------------------------------------------------- сторінка запису -- */

  'account.error.title': 'Цей запис не завантажився',
  'account.loading': 'Запис завантажується',
  'account.meta.lastChange': 'Остання зміна',
  'account.meta.id': 'Ідентифікатор запису',
  'account.banned.title': 'Цей запис призупинено',
  'account.banned.noReason': 'Разом із призупиненням причини не записано.',
  'account.banned.permanent': ' Триває, доки адміністратор його не зніме.',
  'account.banned.until': ' Зніметься саме {date}.',
  'account.banned.untilUnknown': 'у мить спливання',
  'account.authority.label': 'Повноваження на платформі',
  'account.authority.may': 'Може',
  'account.authority.mayNot': 'Не може',
  'account.authority.none': 'Нічого на платформі.',
  'account.workspaces.label': 'Робочі простори',
  'account.workspaces.truncated':
    'Цей запис належить до більшої кількості просторів, ніж {listed}, перелічені тут.',
  'account.workspaces.empty.title': 'У жодному просторі',
  'account.workspaces.empty.body':
    'Цей запис поки не належить до жодного робочого простору. Один створюється під час першого входу, і кожен, куди його запросять, з’явиться тут.',
  'account.workspaces.column.workspace': 'Робочий простір',
  'account.workspaces.column.role': 'Роль',
  'account.workspaces.column.plan': 'Тариф',
  'account.subscription.label': 'Передплата',
  'account.subscription.free.title': 'На безкоштовному тарифі',
  'account.subscription.free.body':
    'Простір, яким володіє цей запис, жодного разу не проходив через касу, тож запису про передплату не має і працює в межах безкоштовного тарифу.',
  'account.subscription.none.title': 'Цьому записові нічого не виставляють',
  'account.subscription.none.body':
    'Цей запис не має жодного робочого простору. Бути учасником чужого простору не означає бути тим, кому він виставляє рахунок, тож збирати тут нічого.',
  'account.subscription.endsAtClose': 'Завершується наприкінці періоду',
  'account.subscription.seats': 'Місця',
  'account.subscription.seatsValue': '{used} із {limit}',
  'account.subscription.ends': 'Завершується',
  'account.subscription.renews': 'Поновлюється',
  'account.sessions.label': 'Живі сеанси',
  'account.sessions.truncated':
    'Цей запис тримає більше сеансів, ніж перелічує один виклик. Щоб переконатися, що не лишилося жодного, перервіть усі сеанси з меню дій.',
  'account.sessions.empty.title': 'Скрізь виведений із сеансу',
  'account.sessions.empty.body':
    'Цей запис не має жодного несплилого сеансу. Він з’явиться тут тієї миті, коли увійде знову.',
  'account.sessions.column.device': 'Пристрій',
  'account.sessions.column.address': 'Адреса',
  'account.sessions.column.started': 'Розпочато',
  'account.sessions.column.expires': 'Спливає',
  'account.sessions.impersonated': 'Народжений роботою від чужого імені',
  'account.sessions.noAddress': 'Не записано',
  'account.sessions.noAddressLong': 'Адресу не записано',
  'account.sessions.when': 'Розпочато {started} · спливає {expires}',
  'account.audit.label': 'Історія перевірок',
  'account.audit.truncated':
    'Журнал містить більше записів. Перевірковий слід платформи доступний лише на дозапис і зберігається чотириста днів.',
  'account.audit.empty.title': 'Із цим записом нічого не робили',
  'account.audit.empty.body':
    'Кожна зміна ролі, призупинення, заданий пароль, перерваний сеанс і робота від чужого імені пишуться сюди разом із тим, хто це зробив. Тут ніхто нічого не торкався.',

  /* ------------------------------ шкала робочого простору -- */

  'workspace.role.owner': 'Власник',
  'workspace.role.admin': 'Адміністратор',
  'workspace.role.member': 'Учасник',
  'plan.free': 'Безкоштовний',
  'plan.starter': 'Початковий',
  'plan.pro': 'Професійний',
  'plan.business': 'Корпоративний',
  'subscription.trialing': 'Пробний період',
  'subscription.active': 'Активна',
  'subscription.pastDue': 'Прострочена',
  'subscription.canceled': 'Скасована',
  'subscription.incomplete': 'Незавершена',
  'subscription.expired': 'Сплила',
  'subscription.unpaid': 'Неоплачена',
  'subscription.paused': 'Призупинена',

  /* ------------------------------------------------------ журнал перевірок -- */

  'audit.action.created': 'Запис створено',
  'audit.action.updated': 'Дані запису змінено',
  'audit.action.roleChanged': 'Роль на платформі змінено',
  'audit.action.banned': 'Запис призупинено',
  'audit.action.unbanned': 'Призупинення знято',
  'audit.action.deleted': 'Запис видалено',
  'audit.action.passwordSet': 'Пароль задано адміністратором',
  'audit.action.emailSet': 'Адресу ел. пошти змінено',
  'audit.action.impersonationStarted': 'Роботу від чужого імені розпочато',
  'audit.action.impersonationEnded': 'Роботу від чужого імені завершено',
  'audit.action.impersonationWorkspaceChanged':
    'Простір змінено під час роботи від чужого імені',
  'audit.action.sessionRevoked': 'Сеанс перервано',
  'audit.action.sessionRevokedAll': 'Усі сеанси перервано',
  'audit.actor.system': 'Сама платформа',
  'audit.actor.system.detail': 'автоматично',
  'audit.actor.agent': 'Машинні облікові дані',
  'audit.actor.agent.detail': 'токен MCP',
  'audit.actor.deleted': 'Видалений запис',
  'audit.actorBadge': 'Тоді: {role}',
  'audit.field.name': 'Ім’я',
  'audit.field.email': 'Адреса ел. пошти',
  'audit.field.emailVerified': 'Пошту підтверджено',
  'audit.field.role': 'Роль на платформі',
  'audit.field.banned': 'Призупинено',
  'audit.field.banReason': 'Причина',
  'audit.field.banExpiresAt': 'Призупинення завершується',
  'audit.field.revoked': 'Перервані сеанси',
  'audit.field.impersonating': 'Працює від імені',
  'audit.field.impersonatedBy': 'Від його імені працює',
  'audit.field.expiresAt': 'Сеанс спливає',
  'audit.field.targetRole': 'Їхня роль на платформі',
  'audit.field.sessionId': 'Причетний сеанс',
  'audit.field.organizationId': 'Простір',
  'audit.value.yes': 'так',
  'audit.value.no': 'ні',
  'audit.value.cleared': 'очищено',
  'audit.became': 'стало',

  /* -------------------------------------------------------------- діалоги -- */

  'dialog.cancel': 'Скасувати',

  'create.button': 'Новий запис',
  'create.title': 'Створити запис',
  'create.body':
    'Адресу не підтверджують, і листа ніхто не отримає — пароль передайте самі.',
  'create.confirm': 'Створити запис',
  'create.name.placeholder': 'Олена Ковальчук',
  'create.email': 'Адреса ел. пошти',
  'create.email.placeholder': 'olena@planned.travel',
  'create.password': 'Пароль',
  'create.password.hint':
    'Достатньо довгий, щоб бути фразою. Власник запису зможе його змінити.',
  'create.done': 'Запис створено',
  'create.done.body': '{email} може увійти з паролем, який ви задали.',

  'action.menu.label': 'Дії для {name}',
  'action.group.account': 'Обліковий запис',
  'action.group.credentials': 'Облікові дані',

  'action.role.item': 'Змінити роль на платформі',
  'action.role.self':
    'Не на своєму записі — знизивши себе, можна лишити платформу без адміністратора.',
  'action.role.body':
    'Що {name} може робити на самій платформі. Членство в робочих просторах — окремий словник, і це його не зрушує.',
  'action.role.confirm': 'Зберегти роль',
  'action.role.current': 'Зараз',
  'action.role.done': 'Роль на платформі оновлено',
  'action.role.done.body': '{name} тепер має на платформі роль «{role}».',

  'action.impersonate.item': 'Працювати від імені запису',
  'action.impersonate.self': 'Ставати нема ким — це ваш власний запис.',
  'action.impersonate.banned':
    'Запис призупинено, тож він не має сеансу, який можна було б надягти.',
  'action.impersonate.admin':
    'Жодна роль платформи не може працювати від імені адміністратора, зокрема ваша.',
  'action.impersonate.title': 'Працювати від імені {name}',
  'action.impersonate.body':
    'П’ятнадцять хвилин ви бачитимете продукт точно так, як бачить його цей запис.',
  'action.impersonate.confirm': 'Розпочати',
  'action.impersonate.note.bar':
    'Смуга попередження лишиться на кожному екрані, доки ви не завершите, і закрити її не можна.',
  'action.impersonate.note.platform':
    'Поки ви працюєте від чужого імені, дії платформи недоступні — консоль теж.',
  'action.impersonate.note.audit':
    'І початок, і кінець пишуться до перевіркового сліду платформи разом із вашим іменем.',

  'action.password.item': 'Задати пароль',
  'action.password.title': 'Задати пароль для {name}',
  'action.password.body':
    'Користуйтеся цим, щоб повернути людину до замкненого запису або відрізати нападника від захопленого.',
  'action.password.confirm': 'Задати пароль',
  'action.password.field': 'Новий пароль',
  'action.password.hint.self':
    'Щойно його задано, усі сеанси уриваються — ваш також.',
  'action.password.hint':
    'Щойно його задано, кожен сеанс цього запису уривається.',
  'action.password.done': 'Пароль задано',
  'action.password.done.body': '{name} виведений із сеансу на всіх пристроях.',

  'action.sessions.item': 'Перервати всі сеанси',
  'action.sessions.body.self':
    'Це виведе із сеансу всі ваші пристрої, зокрема той, на якому ви це читаєте.',
  'action.sessions.body':
    '{name} буде виведений із сеансу на всіх пристроях і муситиме увійти знову.',
  'action.sessions.confirm': 'Перервати сеанси',
  'action.sessions.done': 'Сеанси перервано',
  'action.sessions.done.body': {
    one: 'Один сеанс завершено.',
    few: 'Завершено сеансів: {revoked}.',
    many: 'Завершено сеансів: {revoked}.',
    other: 'Завершено сеансів: {revoked}.',
  },

  'action.ban.item': 'Призупинити запис',
  'action.ban.self':
    'Не на своєму записі — призупинивши себе, ви відріжете собі шлях назад.',
  'action.ban.title': 'Призупинити {name}',
  'action.ban.body':
    'Усі сеанси уриваються негайно, і запис не зможе увійти, доки призупинення не знімуть або доки воно не спливе.',
  'action.ban.confirm': 'Призупинити запис',
  'action.ban.reason': 'Причина',
  'action.ban.reason.hint':
    'Зберігається в перевірковому сліді платформи тринадцять місяців і не показується нікому, крім адміністратора.',
  'action.ban.reason.placeholder':
    'Повторні скарги на зловживання з трьох робочих просторів',
  'action.ban.duration': 'Строк',
  'action.ban.duration.label': 'Строк призупинення',
  'action.ban.duration.permanent.body':
    'Тримається, доки адміністратор свідомо його не зніме.',
  'action.ban.duration.day': '24 години',
  'action.ban.duration.day.body':
    'Досить довго, щоб перервати, досить коротко, щоб лишитися втручанням.',
  'action.ban.duration.week': '7 днів',
  'action.ban.duration.week.body': 'Тиждень на розгляд скарги.',
  'action.ban.duration.month': '30 днів',
  'action.ban.duration.month.body': 'Місяць вимушеної тиші.',
  'action.ban.duration.quarter': '90 днів',
  'action.ban.duration.quarter.body':
    'Найдовший строк, який пропонує консоль. Далі — лише безстрокове призупинення.',
  'action.ban.done': 'Запис призупинено',
  'action.ban.done.body': '{name} виведений із сеансу скрізь і увійти не може.',

  'action.unban.item': 'Зняти призупинення',
  'action.unban.title': 'Зняти призупинення з {name}',
  'action.unban.body':
    'Запис зможе увійти вже з наступної спроби. Жоден попередній сеанс не повертається.',
  'action.unban.confirm': 'Зняти призупинення',
  'action.unban.done': 'Призупинення знято',
  'action.unban.done.body':
    '{name} знову може увійти. Жодного сеансу не відновлено.',

  'action.delete.item': 'Видалити запис',
  'action.delete.self': 'Не на своєму записі — звідти немає вороття.',
  'action.delete.title': 'Видалити {name}',
  'action.delete.body':
    'Запис, його сеанси та всі прив’язані до нього облікові дані зникнуть. Це незворотно.',
  'action.delete.confirm': 'Видалити запис',
  'action.delete.note':
    'Вміст, створений цією людиною в робочому просторі, лишається просторові, який ним володіє. Призупинення замість видалення зберігає слід і забирає доступ.',
  'action.delete.owners':
    'Не можна видалити акаунт, який є єдиним власником робочого простору, де є інші люди. Спершу призначте там іншого власника або призупиніть акаунт замість видалення.',
  'action.delete.done': 'Запис видалено',
  'action.delete.done.body':
    '{name} і все, що було прив’язане до запису, зникло.',

  'session.revoke.label': 'Перервати сеанс на {device}',
  'session.revoke.title': 'Перервати цей сеанс',
  'session.revoke.body':
    '{device} доведеться увійти знову вже за наступного запиту. Якщо це той сеанс, у якому ви це читаєте, ви вийдете разом із ним.',
  'session.revoke.confirm': 'Перервати сеанс',
  'session.revoke.done': 'Сеанс перервано',
  'session.revoke.done.body':
    'Пристроєві доведеться увійти знову за наступного запиту.',

  /* ------------------------------------------------------- запуски агентів -- */

  'runs.error.title': 'Реєстр запусків не відповів',
  'runs.origin.local': 'Локально',
  'runs.origin.githubActions': 'Дії GitHub',
  'runs.stat.live': 'Живі запуски',
  'runs.stat.live.none': 'Зараз нічого не будується',
  'runs.stat.live.some': 'Пульс проти п’ятихвилинної оренди',
  'runs.stat.issues': 'Утримувані задачі',
  'runs.stat.issues.caption':
    'Кожну орендує один запуск — разом із предками й нащадками',
  'runs.stat.orphans': 'Осиротілі гілки',
  'runs.stat.orphans.none': 'Безгосподарної роботи немає',
  'runs.stat.orphans.some':
    'Коміти зупиненого запуску чекають, щоб їх підібрали',
  'runs.live.empty.title': 'Жодного запуску не зареєстровано',
  'runs.live.empty.body':
    'Запуск з’явиться тут, щойно зареєструє себе — із цієї машини, з іншої або з виконавця GitHub — разом із задачами, які він узяв.',
  'runs.holds.nothing': 'нічого не тримає',
  'runs.holds': 'тримає {issues}',
  'runs.uptime': 'працює {elapsed} · {lease}',
  'runs.lease.expired': 'оренда спливла',
  'runs.lease.left': 'лишилося {elapsed}',
  'runs.wip.label': 'Робота в процесі',
  'runs.wip.empty.title': 'Жодна гілка не несе роботи',
  'runs.wip.empty.body':
    'Запуск записує гілку, щойно на ній з’являється коміт; якщо він загине, наступному запускові, який візьме задачу, запропонують цю роботу замість того, щоб починати спочатку.',
  'runs.wip.orphaned': 'Осиротіла',
  'runs.wip.meta': {
    one: '{commits} коміт · {elapsed} тому',
    few: '{commits} коміти · {elapsed} тому',
    many: '{commits} комітів · {elapsed} тому',
    other: '{commits} коміти · {elapsed} тому',
  },
  'runs.recent.label': 'Нещодавно завершені',
  'runs.recent.empty.title': 'Жоден запуск ще не завершився',
  'runs.recent.empty.body':
    'Останні п’ятдесят запусків лишаються тут — із тим, чим кожен із них скінчився.',
  'runs.ago': '{elapsed} тому',
  'runs.notCoordinator.title': 'Це розгортання не координує флот',
  'runs.notCoordinator.body':
    'Реєстр запусків прив’язаний лише до проміжного середовища, і навмисне: другий реєстр змусив би обидва флоти вважати, що чергу тримає саме він, — а це рівно те, задля чого він і існує. Читайте флот у проміжному середовищі.',
  'nav.providers': 'Постачальники',
  'nav.providers.description': 'Вихідні виклики та їхні стелі',
  'providers.error.title': 'Не вдалося прочитати лічильники постачальників',
  'providers.list.label': 'Сервіси',
  'providers.status.planned': 'Не підключено',
  'providers.status.planned.description':
    'Цей сервіс поки ніщо не викликає, тож нема чого рахувати. Він у списку, щоб стелю погодили до першого виклику, а не після першого рахунку.',
  'providers.policy.allow': 'Пропускає понад стелю',
  'providers.policy.block': 'Відмовляє на стелі',
  'providers.badge.blocked': {
    one: 'Один виклик відхилено',
    few: '{calls} виклики відхилено',
    many: '{calls} викликів відхилено',
    other: '{calls} виклику відхилено',
  },
  'providers.limit.none': 'Стелю не погоджено · {used} цього місяця',
  'providers.limit.value': '{used} з {limit}',
  'providers.limit.window.day': 'Сьогодні',
  'providers.limit.window.month': 'Цього місяця',
  'providers.measuring.none': 'Поки нічого не виміряно',
  'providers.measuring.since': 'Вимірюємо з {date}',
  'providers.stat.calls': 'Виклики цього місяця',
  'providers.stat.calls.caption': 'По всіх підключених сервісах',
  'providers.stat.errors': 'Невдалі виклики',
  'providers.stat.errors.caption':
    'Рахуються і як виклики, бо більшість постачальників їх тарифікує',
  'providers.stat.nearLimit': 'Близько до стелі',
  'providers.stat.nearLimit.caption':
    'Сервіси понад своїм порогом попередження',
  'providers.stat.blocked': 'Відхилені виклики',
  'providers.stat.blocked.none': 'Нічого не відхилено',
  'providers.stat.blocked.some': 'Попит, відхилений стелею',
  'providers.forecast.label': 'Прогноз',
  'providers.forecast.provider': 'Сервіс',
  'providers.forecast.monthEnd': 'До кінця місяця',
  'providers.forecast.runRate': 'На місяць за цим темпом',
  'providers.forecast.perWorkspace': 'На робочий простір за місяць',
  'providers.forecast.noWorkspaceTraffic':
    'Немає трафіку робочих просторів для усереднення',
  'providers.forecast.window': {
    one: 'Прогноз з однієї години вимірювання.',
    few: 'Прогноз з {hours} год вимірювання.',
    many: 'Прогноз з {hours} год вимірювання.',
    other: 'Прогноз з {hours} год вимірювання.',
  },
  'providers.forecast.tooEarly': {
    one: 'Виміряно поки лише одну годину — для прогнозу замало. Розтягнути неповну добу на місяць — це арифметика, а не прогноз.',
    few: 'Виміряно поки {hours} год — для прогнозу замало. Розтягнути неповну добу на місяць — це арифметика, а не прогноз.',
    many: 'Виміряно поки {hours} год — для прогнозу замало. Розтягнути неповну добу на місяць — це арифметика, а не прогноз.',
    other:
      'Виміряно поки {hours} год — для прогнозу замало. Розтягнути неповну добу на місяць — це арифметика, а не прогноз.',
  },
  'providers.forecast.atWorkspaces': 'За скількох робочих просторів',
  'providers.forecast.callsEach': 'Викликів на кожен за місяць',
  'providers.forecast.projected': 'Близько {calls} викликів на місяць.',
  'providers.workspaces.label': 'Найактивніші простори',
  'providers.workspaces.platform': 'Платформа (без простору)',
  'providers.workspaces.empty.title': 'Поки нічого не віднесено',
  'providers.workspaces.empty.description':
    'Виклик, зроблений для робочого простору, записується на нього. Робота за розкладом і пошта платформи не належать жодному й рахуються окремо.',
  'providers.readOnly':
    'Ці лічильники можна читати, але не рухати стелю. Зміна ліміту чи політики потребує права provider:configure.',
  'providers.status.planned.agreed.month':
    'Погоджена стеля: {limit} на місяць. Діє з першого виклику, щойно з’явиться клієнт.',
  'providers.status.planned.agreed.day':
    'Погоджена стеля: {limit} на добу. Діє з першого виклику, щойно з’явиться клієнт.',
  'providers.edit.button': 'Змінити',
  'providers.edit.title': 'Стеля для {provider}',
  'providers.edit.body':
    'Скільки ця інсталяція домовилася витрачати в постачальника і що стається, коли ліміт вичерпано.',
  'providers.edit.confirm': 'Зберегти стелю',
  'providers.edit.done': 'Стелю для {provider} збережено',
  'providers.edit.label': 'Назва',
  'providers.edit.ceiling': 'Викликів включено',
  'providers.edit.ceiling.hint':
    'Залиште порожнім, якщо стелю не погоджено. Порожньо і нуль — різне: нуль при «відмовляти» відхиляє кожен виклик.',
  'providers.edit.ceiling.placeholder': 'Без стелі',
  'providers.edit.window': 'Вимірюється за',
  'providers.edit.window.month': 'Календарний місяць',
  'providers.edit.window.month.body': 'Звичайна форма включеної квоти.',
  'providers.edit.window.day': 'Добу',
  'providers.edit.window.day.body':
    'Частина постачальників рахує щодня — безкоштовний план Geoapify це 3 000 кредитів на добу.',
  'providers.edit.policy': 'На стелі',
  'providers.edit.policy.allow': 'Кликати далі й платити',
  'providers.edit.policy.allow.body':
    'Виклики йдуть понад стелю, консоль попереджає. Ніщо не перестає працювати.',
  'providers.edit.policy.block': 'Відмовляти в подальших викликах',
  'providers.edit.policy.block.body':
    'Виклики відхиляються до скидання вікна. Те, що залежить від цього постачальника, перестає працювати — обирайте лише там, де така відмова дешевша.',
  'providers.edit.policy.block.refused':
    '{provider} відхиляти не можна: у нього немає запасного шляху, тож відмова у викликах зупинила б функцію, а не обмежила витрати. Стеля, яка лише попереджає, залишається доступною.',
  'providers.edit.warn': 'Попереджати при (%)',
  'providers.edit.critical': 'Тривога при (%)',
  'providers.edit.thresholds.hint':
    'Де індикатор стає жовтим і червоним. Попередження не може бути вище тривоги.',
} satisfies TranslationOf<typeof En>

export default messages
