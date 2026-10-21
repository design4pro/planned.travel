/**
 * Everything the authentication screens say, in Ukrainian.
 *
 * Authored from `../en/auth.ts` (`docs/SPEC.md` §8.9). These screens are
 * reachable with no session, so their language comes from `Accept-Language`
 * alone and two thirds of the keys are failures — the moment a reader can least
 * afford a sentence in a language they do not read.
 *
 * **Plural.** `uk` needs `one` (1, 21 …) · `few` (2–4) · `many` (0, 5–20) ·
 * `other` (fractions).
 *
 * **Gender.** Nothing below puts the reader into a gendered past tense:
 * «Виконано вхід як …» rather than «Ви увійшли …», and the terms checkbox reads
 * «Приймаю …».
 *
 * **The example address** keeps the reserved `example.com` domain and localises
 * only the local part, so it and `field.name.placeholder` read as one person.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Головна сторінка planned.travel',
  'shell.legal':
    'Продовжуючи, ви погоджуєтеся з умовами обслуговування та політикою приватності planned.travel.',

  'panel.eyebrow': 'Плануйте разом',
  'panel.heading': 'Кожна поїздка — від першої шпильки до останньої відкритки.',
  'panel.body':
    'Спільні маршрути на справжній карті, бюджети, які справді сходяться, списки речей, що пам’ятають за вас, і щоденник, який варто зберегти.',
  'panel.map.title': 'Одна карта, один план',
  'panel.map.detail': 'Кожна зупинка, нічліг і переїзд в одному маршруті.',
  'panel.group.title': 'Усі в одному ритмі',
  'panel.group.detail':
    'Правки, голоси та коментарі приходять усій групі одразу.',
  'panel.costs.title': 'Витрати, які сходяться',
  'panel.costs.detail': 'Спільні бюджети, закриті баланси, жодних таблиць.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'або',
  'divider.orEmail': 'або через електронну пошту',

  'social.continue': 'Продовжити через {provider}',
  'social.signUp': 'Зареєструватися через {provider}',
  'social.opening': 'Відкриваємо {provider}',

  'passkey.action': 'Увійти ключем доступу',
  'passkey.waiting': 'Чекаємо на ваш пристрій',

  'password.show': 'Показати пароль',
  'password.hide': 'Сховати пароль',
  'password.showNew': 'Показати новий пароль',
  'password.hideNew': 'Сховати новий пароль',
  'password.showConfirm': 'Показати підтвердження пароля',
  'password.hideConfirm': 'Сховати підтвердження пароля',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Електронна пошта',
  'field.email.placeholder': 'olena@example.com',
  'field.password': 'Пароль',
  'field.password.placeholder': 'Ваш пароль',
  'field.newPassword': 'Новий пароль',
  'field.newPassword.placeholder': 'Фраза, яку ви запам’ятаєте',
  'field.confirmPassword': 'Підтвердьте пароль',
  'field.confirmNewPassword': 'Підтвердьте новий пароль',
  'field.confirmPassword.placeholder': 'Введіть його ще раз',
  'field.name': 'Ваше ім’я',
  'field.name.hint': 'Його бачать ті, з ким ви плануєте поїздки.',
  'field.name.placeholder': 'Олена Ткаченко',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Вкажіть адресу електронної пошти.',
  'validation.emailTooLong': 'Ця адреса задовга.',
  'validation.emailInvalid': 'Це не схоже на адресу електронної пошти.',
  'validation.passwordRequired': 'Введіть пароль.',
  'validation.passwordShort': {
    one: 'Візьміть не менше {value} символа — коротка фраза краща за хитре слово.',
    few: 'Візьміть не менше {value} символів — коротка фраза краща за хитре слово.',
    many: 'Візьміть не менше {value} символів — коротка фраза краща за хитре слово.',
    other:
      'Візьміть не менше {value} символа — коротка фраза краща за хитре слово.',
  },
  'validation.passwordLong': {
    one: 'Умістіться в {value} символ.',
    few: 'Умістіться в {value} символи.',
    many: 'Умістіться в {value} символів.',
    other: 'Умістіться в {value} символа.',
  },
  'validation.passwordMismatch': 'Ці паролі не збігаються.',
  'validation.nameShort':
    'Вкажіть ім’я, щоб супутники знали, хто планує разом із ними.',
  'validation.nameTooLong': 'Це ім’я задовге.',
  'validation.termsRequired': 'Прийміть умови, щоб рухатися далі.',
  'validation.codeLength': 'Коди з застосунку складаються з шести цифр.',
  'validation.codeDigits': 'Коди з застосунку — лише цифри.',
  'validation.backupShort': 'Цей резервний код виглядає надто коротким.',
  'validation.backupLong': 'Цей резервний код виглядає надто довгим.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'З поверненням',
  'login.heading': 'Вхід до planned.travel',
  'login.description':
    'Повернітеся до маршрутів, бюджетів і списків саме туди, де вони лишилися.',
  'login.newHere': 'Уперше тут?',
  'login.createAccount': 'Створити акаунт',
  'login.forgot': 'Забули пароль?',
  'login.remember': 'Не виходити на цьому пристрої',
  'login.submit': 'Увійти',
  'login.submitting': 'Виконуємо вхід',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Створення акаунта',
  'register.heading': 'Почніть планувати за кілька хвилин',
  'register.description':
    'Один акаунт — на всі поїздки, усіх супутників і всі списки.',
  'register.haveAccount': 'Акаунт уже є?',
  'register.signIn': 'Увійти',
  'register.terms': 'Приймаю умови обслуговування та політику приватності.',
  'register.submit': 'Створити акаунт',
  'register.submitting': 'Створюємо акаунт',

  'strength.hint': {
    one: 'Не менше {value} символа. Коротка фраза краща за хитре слово.',
    few: 'Не менше {value} символів. Коротка фраза краща за хитре слово.',
    many: 'Не менше {value} символів. Коротка фраза краща за хитре слово.',
    other: 'Не менше {value} символа. Коротка фраза краща за хитре слово.',
  },
  'strength.tooShort': 'Надійність: надто коротко',
  'strength.weak': 'Надійність: слабко',
  'strength.fair': 'Надійність: посередньо',
  'strength.strong': 'Надійність: добре',
  'strength.excellent': 'Надійність: відмінно',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Допомога з паролем',
  'forgot.heading': 'Скидання пароля',
  'forgot.description':
    'Назвіть адресу, на яку зареєстровано акаунт, і ми надішлемо лист із посиланням для нового пароля.',
  'forgot.submit': 'Надіслати мені посилання',
  'forgot.submitting': 'Надсилаємо посилання',
  'forgot.back': 'Назад до входу',
  'forgot.sent.eyebrow': 'Перевірте пошту',
  'forgot.sent.heading': 'Посилання для скидання вже в дорозі',
  'forgot.sent.description':
    'Якщо якийсь акаунт користується адресою {email}, посилання для вибору нового пароля вже в цій скриньці.',
  'forgot.sent.title': 'Посилання працює один раз і одну годину',
  'forgot.sent.body':
    'Нічого не прийшло? Перевірте спам, а потім надішліть ще раз. Нове посилання тихо скасовує попереднє.',
  'forgot.sent.resend': 'Надіслати ще раз',
  'forgot.sent.resending': 'Надсилаємо знову',
  'forgot.sent.change': 'Інша адреса',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Скидання пароля',
  'reset.heading': 'Виберіть новий пароль',
  'reset.description': {
    one: 'Візьміть щось довжиною не менше {value} символа. Коротку фразу легше запам’ятати і важче вгадати.',
    few: 'Візьміть щось довжиною не менше {value} символів. Коротку фразу легше запам’ятати і важче вгадати.',
    many: 'Візьміть щось довжиною не менше {value} символів. Коротку фразу легше запам’ятати і важче вгадати.',
    other:
      'Візьміть щось довжиною не менше {value} символа. Коротку фразу легше запам’ятати і важче вгадати.',
  },
  'reset.submit': 'Встановити новий пароль',
  'reset.submitting': 'Зберігаємо пароль',
  'reset.back': 'Назад до входу',
  'reset.stale.heading': 'Це посилання використати не можна',
  'reset.stale.description':
    'Посилання для скидання живуть годину і працюють лише раз — найбезпечніший з можливих обмінів.',
  'reset.stale.action': 'Запросити нове посилання',
  'reset.done.heading': 'Новий пароль встановлено',
  'reset.done.description':
    'Усі інші сеанси завершено, тож у старого пароля більше немає входу.',
  'reset.done.title': 'Інші сеанси закрито',
  'reset.done.body': 'Увійдіть із новим паролем і плануйте далі.',
  'reset.done.action': 'Увійти',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Двофакторна перевірка',
  'twoFactor.heading': 'Підтвердьте, що це ви',
  'twoFactor.description':
    'Ваш акаунт захищає другий фактор. Введіть поточний код із застосунку-автентифікатора.',
  'twoFactor.back': 'Почати заново від входу',
  'twoFactor.methods': 'Спосіб перевірки',
  'twoFactor.totp.tab': 'Застосунок',
  'twoFactor.totp.label': 'Код із шести цифр',
  'twoFactor.totp.hint': 'Коди оновлюються кожні 30 секунд.',
  'twoFactor.totp.submit': 'Перевірити й продовжити',
  'twoFactor.backup.tab': 'Резервний код',
  'twoFactor.backup.label': 'Резервний код',
  'twoFactor.backup.hint':
    'Зі списку, збереженого під час увімкнення другого фактора. Кожен код працює раз.',
  'twoFactor.backup.submit': 'Скористатися резервним кодом',
  'twoFactor.submitting': 'Перевіряємо код',
  'twoFactor.trust.label': 'Довіряти цьому пристрою 30 днів',
  'twoFactor.trust.detail':
    'До того часу цей крок у цьому браузері пропускатимемо. Робіть так лише на пристрої, який належить тільки вам.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Пошту підтверджено',
  'verify.done.heading': 'Усе готово',
  'verify.done.description':
    'Адресу підтверджено, тож запрошення, нагадування та зведення поїздок доходитимуть до вас.',
  'verify.done.title': 'Підтверджено',
  'verify.done.body': 'Адресу {email} підтверджено в цьому акаунті.',
  'verify.done.bodyUnknown':
    'Вашу адресу електронної пошти підтверджено в цьому акаунті.',
  'verify.done.action': 'Перейти до панелі',

  'verify.pending.eyebrow': 'Ще одне',
  'verify.pending.heading': 'Підтвердьте адресу електронної пошти',
  'verify.pending.description':
    'Ми надіслали посилання для підтвердження на {email}. Якщо його відкрити, акаунт можна буде відновити, а супутники зможуть вас запрошувати.',
  'verify.pending.wrongAddress': 'Не та адреса?',
  'verify.pending.changeIt': 'Змініть її в налаштуваннях',
  'verify.pending.title': 'Посилання живе 24 години',
  'verify.pending.body':
    'У скриньці нічого? Перевірте спам, а потім надішліть ще раз.',
  'verify.pending.resentTitle': 'Щойно надіслали знову',
  'verify.pending.resentBody':
    'Дайте хвилину, а потім зазирніть у скриньку — і в спам.',
  'verify.pending.resend': 'Надіслати підтвердження знову',
  'verify.pending.resending': 'Надсилаємо знову',
  'verify.pending.continue': 'Усе одно продовжити',

  'verify.request.eyebrow': 'Підтвердження пошти',
  'verify.request.heading': 'Надіслати нове посилання підтвердження',
  'verify.request.description':
    'Посилання підтвердження живуть 24 години і працюють лише раз. Назвіть адресу — свіже вже в дорозі.',
  'verify.request.submit': 'Надіслати посилання підтвердження',
  'verify.request.submitting': 'Надсилаємо посилання',
  'verify.request.sentTitle': 'Уже в дорозі',
  'verify.request.sentBody':
    'Якщо в цієї адреси є акаунт, що чекає на підтвердження, посилання вже в її скриньці.',
  'verify.request.change': 'Інша адреса',
  'verify.request.back': 'Назад до входу',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Запрошення в простір',
  'invitation.heading': 'Приєднатися до {workspace}',
  'invitation.description':
    'Прийнявши запрошення, ви увійдете в цей простір і отримаєте його поїздки, бюджети та списки.',
  'invitation.invitedAs': 'Запрошення на адресу {email}',
  'invitation.role': 'Ваша роль',
  'invitation.means': 'Це означає',
  'invitation.invitedBy': 'Запрошує',
  'invitation.expires': 'Діє до',
  'invitation.accept': 'Прийняти запрошення',
  'invitation.accepting': 'Входимо в простір',
  'invitation.decline': 'Відхилити',
  'invitation.declining': 'Відхиляємо',
  'invitation.reassurance':
    'Простір можна покинути будь-коли в його налаштуваннях, а все, що ви створюєте поза ним, ніколи не стає спільним.',

  'invitation.role.owner': 'Власник — повний контроль, разом з оплатою',
  'invitation.role.admin': 'Адміністратор — веде поїздки, людей і налаштування',
  'invitation.role.member': 'Учасник — планує поїздки разом з усіма',
  'invitation.role.other': '{role} — доступ задає власник простору',
  'invitation.role.badge.owner': 'Власник',
  'invitation.role.badge.admin': 'Адміністратор',
  'invitation.role.badge.member': 'Учасник',

  'invitation.anonymous.heading': 'Увійдіть, щоб побачити запрошення',
  'invitation.anonymous.description':
    'Запрошення прив’язані до адреси, на яку надіслані, тож нам потрібно знати, хто ви, перш ніж показати це.',
  'invitation.anonymous.body':
    'Візьміть адресу, на яку прийшло запрошення. Одразу після входу ми повернемо вас сюди.',
  'invitation.anonymous.action': 'Увійти й продовжити',
  'invitation.anonymous.noAccount': 'Акаунта ще немає?',
  'invitation.anonymous.register': 'Створіть його на запрошену адресу',

  'invitation.mismatch.heading': 'Це запрошення — на іншу адресу',
  'invitation.mismatch.description':
    'Цей сеанс належить іншій людині, тож прийняти запрошення тут не вийде.',
  'invitation.mismatch.title': 'Виконано вхід як {email}',
  'invitation.mismatch.body':
    'Вийдіть і увійдіть з адресою, на яку прийшло запрошення, або попросіть нове запрошення на цей акаунт.',
  'invitation.mismatch.action': 'Змінити акаунт',
  'invitation.mismatch.back': 'Назад до входу',

  'invitation.unverified.heading': 'Підтвердьте пошту, щоб увійти',
  'invitation.unverified.description':
    'Простори приймають лише підтверджені адреси, щоб нікого не додали через описку.',
  'invitation.unverified.title': 'Адресу {email} поки не підтверджено',
  'invitation.unverified.body':
    'Відкрийте посилання підтвердження у своїй скриньці й повернітеся на цю сторінку. Запрошення чекатиме.',
  'invitation.unverified.action': 'Підтвердити пошту',
  'invitation.unverified.resend': 'Надіслати лист підтвердження знову',

  'invitation.unavailable.heading': 'Це запрошення більше недійсне',
  'invitation.unavailable.description':
    'Запрошення живуть сім днів і закриваються в ту мить, коли їх використали або відкликали.',
  'invitation.unavailable.title': 'Приймати тут нічого',
  'invitation.unavailable.body':
    'Попросіть того, хто вас запрошував, надіслати нове запрошення — ця сторінка покаже його одразу.',
  'invitation.unavailable.dashboard': 'Перейти до панелі',

  'invitation.declined.eyebrow': 'Запрошення відхилено',
  'invitation.declined.heading': 'Нічого страшного — спільним нічого не стало',
  'invitation.declined.description':
    'Власник простору про це дізнався, і це посилання більше не працює.',
  'invitation.declined.action': 'Перейти до панелі',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Щось пішло не так',
  'error.unexpected.detail': 'Це не спрацювало. Спробуйте ще раз за хвилину.',
  'error.rateLimited.title': 'Надто багато спроб',
  'error.rateLimited.detail':
    'Для безпеки ми на кілька хвилин зупинили вхід із цього пристрою. Спробуйте трохи пізніше.',
  'error.offline.title': 'Немає зв’язку',
  'error.offline.detail':
    'Не вдалося дістатися planned.travel. Перевірте з’єднання і спробуйте ще раз.',

  'error.credentials.title': 'Ці дані не збігаються',
  'error.credentials.detail':
    'Перевірте адресу й пароль і спробуйте ще раз. Якщо реєстрація була через Google чи Apple, скористайтеся тією кнопкою.',
  'error.password.title': 'Ці дані не збігаються',
  'error.password.detail': 'Перевірте адресу й пароль і спробуйте ще раз.',
  'error.noPassword.title': 'У цього акаунта немає пароля',
  'error.noPassword.detail':
    'Цей акаунт входить через зовнішній сервіс або ключем доступу. Візьміть один з варіантів вище.',
  'error.unverified.title': 'Спершу підтвердьте пошту',
  'error.unverified.detail':
    'Під час реєстрації ми надіслали посилання підтвердження. Відкрийте його й повертайтеся.',
  'error.emailTaken.title': 'Ця адреса вже зареєстрована',
  'error.emailTaken.detail': 'Увійдіть або скиньте пароль, якщо забули його.',
  'error.noAccount.title': 'Такого акаунта не знайшли',
  'error.noAccount.detail': 'Перевірте адресу або створіть новий акаунт.',
  'error.passwordTooShort.title': 'Пароль надто короткий',
  'error.passwordTooShort.detail': 'Візьміть довшу фразу і спробуйте ще раз.',
  'error.passwordTooLong.title': 'Пароль надто довгий',
  'error.passwordTooLong.detail': 'Візьміть коротшу фразу і спробуйте ще раз.',
  'error.linkSpent.title': 'Це посилання більше не діє',
  'error.linkSpent.detail':
    'Посилання для пароля працюють лише раз. Запросіть нове — надішлемо одразу.',
  'error.linkExpired.title': 'Термін цього посилання вичерпано',
  'error.linkExpired.detail': 'Запросіть нове — надішлемо одразу.',
  'error.linkIncomplete.title': 'Це посилання неповне',
  'error.linkIncomplete.detail':
    'Посилання скидання пароля несуть одноразовий токен. Відкрийте найсвіжіший лист або запросіть нове посилання.',
  'error.sessionExpired.title': 'Сеанс вичерпано',
  'error.sessionExpired.detail':
    'Увійдіть знову, щоб продовжити з того самого місця.',
  'error.alreadyVerified.title': 'Уже підтверджено',
  'error.alreadyVerified.detail': 'Цю адресу перевірено. Заходьте як звично.',
  'error.badCode.title': 'Цей код не підійшов',
  'error.badCode.detail':
    'Коди з застосунку живуть 30 секунд. Дочекайтеся наступного і введіть усі шість цифр.',
  'error.badBackupCode.title': 'Цей резервний код не підійшов',
  'error.badBackupCode.detail':
    'Кожен резервний код працює раз. Візьміть наступний невикористаний зі списку.',
  'error.locked.title': 'Акаунт тимчасово заблоковано',
  'error.locked.detail':
    'Надто багато невдалих спроб перевірки. Для безпеки акаунт заблоковано на кілька хвилин.',
  'error.twoFactorOn.title': 'Двофакторну автентифікацію вже ввімкнено',
  'error.twoFactorOn.detail':
    'Повторне налаштування зупинило б роботу поточного застосунку автентифікації, тому нічого не змінено. Керувати нею можна тут.',
  'error.noTwoFactor.title': 'Другий фактор не налаштовано',
  'error.noTwoFactor.detail': 'Продовжте входом за адресою й паролем.',
  'error.twoFactorExpired.title': 'Почніть заново від входу',
  'error.twoFactorExpired.detail':
    'Цей крок перевірки вичерпано. Введіть адресу й пароль ще раз.',
  'error.invitationGone.title': 'Це запрошення більше недійсне',
  'error.invitationGone.detail':
    'Воно могло вичерпатися, бути відкликаним або вже використаним. Попросіть нове запрошення.',
  'error.invitationOther.title': 'Це запрошення — для іншої людини',
  'error.invitationOther.detail':
    'Його надіслали на іншу адресу. Увійдіть із тією адресою, щоб прийняти його.',
  'error.alreadyMember.title': 'Ви вже в цьому просторі',
  'error.alreadyMember.detail':
    'Приймати нічого — відкрийте його в перемикачі просторів.',
  'error.workspaceFull.title': 'Цей простір заповнений',
  'error.workspaceFull.detail':
    'Досягнуто межі учасників. Попросіть власника звільнити місце або підняти тариф.',
  'error.verifyBeforeJoin.title': 'Спершу підтвердьте пошту',
  'error.verifyBeforeJoin.detail':
    'Відкрийте посилання підтвердження з нашого листа й повернітеся до цього запрошення.',

  'passkeyNotice.added': 'До вашого облікового запису додано ключ доступу',
  'passkeyNotice.removed': 'З вашого облікового запису видалено ключ доступу',
  'passkeyNotice.security': 'Безпека',
  'passkeyNotice.action': 'Керування ключами доступу',
  'passkeyNotice.recovery':
    'Якщо ви не впізнаєте цю зміну, змініть пароль і завершіть незнайомі сеанси. Скидання пароля не видаляє ключі доступу. Перегляньте їх і видаліть ті, яких не впізнаєте.',
  'error.passwordAttemptsLocked.title': 'Підтвердження пароля заблоковано',
  'error.passwordAttemptsLocked.detail':
    'У цьому сеансі більше не можна підтвердити пароль. Вийдіть і ввійдіть знову.',
  'error.passwordResultUnknown.title': 'Перевірте налаштування безпеки',
  'error.passwordResultUnknown.detail':
    'Зміна могла зберегтися. Не виходьте з цього сеансу, доки не зможете ввійти знову. Якщо ви змінювали пароль, спробуйте новий. Якщо ви замінювали резервні коди, старий набір уже може не працювати; скористайтеся застосунком автентифікації або іншим відкритим сеансом, щоб створити новий набір.',
} satisfies TranslationOf<typeof En>

export default messages
