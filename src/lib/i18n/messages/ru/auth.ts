/**
 * Everything the authentication screens say, in Russian.
 *
 * Authored from `../en/auth.ts` (`docs/SPEC.md` §8.9). These screens are
 * reachable with no session, so their language comes from `Accept-Language`
 * alone and two thirds of the keys are failures — the moment a reader can least
 * afford a sentence in a language they do not read.
 *
 * **Plural.** `ru` needs `one` (1, 21 …) · `few` (2–4) · `many` (0, 5–20) ·
 * `other` (fractions).
 *
 * **Gender.** A Russian past tense and a predicative adjective both agree with
 * the person addressed, and we do not know theirs. Nothing below says
 * «согласен» or «вошли»: the terms checkbox reads «Принимаю …» and the session
 * line reads «Выполнен вход как …».
 *
 * **The example address** keeps the reserved `example.com` domain and localises
 * only the local part, so it and `field.name.placeholder` read as one person.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Главная страница planned.travel',
  'shell.legal':
    'Продолжая, вы соглашаетесь с условиями обслуживания и политикой конфиденциальности planned.travel.',

  'panel.eyebrow': 'Планируйте вместе',
  'panel.heading': 'Каждая поездка — от первой булавки до последней открытки.',
  'panel.body':
    'Общие маршруты на настоящей карте, бюджеты, которые действительно сходятся, списки вещей, которые помнят за вас, и дневник, который стоит сохранить.',
  'panel.map.title': 'Одна карта, один план',
  'panel.map.detail': 'Каждая остановка, ночёвка и переезд в одном маршруте.',
  'panel.group.title': 'Все в одном ритме',
  'panel.group.detail':
    'Правки, голоса и комментарии приходят всей группе сразу.',
  'panel.costs.title': 'Расходы, которые сходятся',
  'panel.costs.detail': 'Общие бюджеты, закрытые балансы, никаких таблиц.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'или',
  'divider.orEmail': 'или по электронной почте',

  'social.continue': 'Продолжить через {provider}',
  'social.signUp': 'Зарегистрироваться через {provider}',
  'social.opening': 'Открываем {provider}',

  'passkey.action': 'Войти с ключом доступа',
  'passkey.waiting': 'Ждём ваше устройство',

  'password.show': 'Показать пароль',
  'password.hide': 'Скрыть пароль',
  'password.showNew': 'Показать новый пароль',
  'password.hideNew': 'Скрыть новый пароль',
  'password.showConfirm': 'Показать подтверждение пароля',
  'password.hideConfirm': 'Скрыть подтверждение пароля',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Электронная почта',
  'field.email.placeholder': 'ivan@example.com',
  'field.password': 'Пароль',
  'field.password.placeholder': 'Ваш пароль',
  'field.newPassword': 'Новый пароль',
  'field.newPassword.placeholder': 'Фраза, которую вы запомните',
  'field.confirmPassword': 'Подтвердите пароль',
  'field.confirmNewPassword': 'Подтвердите новый пароль',
  'field.confirmPassword.placeholder': 'Введите его ещё раз',
  'field.name': 'Ваше имя',
  'field.name.hint': 'Его видят те, с кем вы планируете поездки.',
  'field.name.placeholder': 'Иван Петров',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Укажите адрес электронной почты.',
  'validation.emailTooLong': 'Этот адрес слишком длинный.',
  'validation.emailInvalid': 'Это не похоже на адрес электронной почты.',
  'validation.passwordRequired': 'Введите пароль.',
  'validation.passwordShort': {
    one: 'Возьмите не меньше {value} символа — короткая фраза лучше хитрого слова.',
    few: 'Возьмите не меньше {value} символов — короткая фраза лучше хитрого слова.',
    many: 'Возьмите не меньше {value} символов — короткая фраза лучше хитрого слова.',
    other:
      'Возьмите не меньше {value} символа — короткая фраза лучше хитрого слова.',
  },
  'validation.passwordLong': {
    one: 'Уложитесь в {value} символ.',
    few: 'Уложитесь в {value} символа.',
    many: 'Уложитесь в {value} символов.',
    other: 'Уложитесь в {value} символа.',
  },
  'validation.passwordMismatch': 'Эти пароли не совпадают.',
  'validation.nameShort':
    'Укажите имя, чтобы спутники знали, кто с ними планирует.',
  'validation.nameTooLong': 'Это имя слишком длинное.',
  'validation.termsRequired': 'Примите условия, чтобы продолжить.',
  'validation.codeLength': 'Коды из приложения состоят из шести цифр.',
  'validation.codeDigits': 'Коды из приложения — только цифры.',
  'validation.backupShort': 'Этот резервный код выглядит слишком коротким.',
  'validation.backupLong': 'Этот резервный код выглядит слишком длинным.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'С возвращением',
  'login.heading': 'Вход в planned.travel',
  'login.description':
    'Вернитесь к маршрутам, бюджетам и спискам ровно туда, где они остались.',
  'login.newHere': 'Впервые здесь?',
  'login.createAccount': 'Создать аккаунт',
  'login.forgot': 'Забыли пароль?',
  'login.remember': 'Не выходить на этом устройстве',
  'login.submit': 'Войти',
  'login.submitting': 'Выполняем вход',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Создание аккаунта',
  'register.heading': 'Начните планировать за пару минут',
  'register.description':
    'Один аккаунт — на все поездки, всех спутников и все списки.',
  'register.haveAccount': 'Аккаунт уже есть?',
  'register.signIn': 'Войти',
  'register.terms':
    'Принимаю условия обслуживания и политику конфиденциальности.',
  'register.submit': 'Создать аккаунт',
  'register.submitting': 'Создаём аккаунт',

  'strength.hint': {
    one: 'Не меньше {value} символа. Короткая фраза лучше хитрого слова.',
    few: 'Не меньше {value} символов. Короткая фраза лучше хитрого слова.',
    many: 'Не меньше {value} символов. Короткая фраза лучше хитрого слова.',
    other: 'Не меньше {value} символа. Короткая фраза лучше хитрого слова.',
  },
  'strength.tooShort': 'Надёжность: слишком коротко',
  'strength.weak': 'Надёжность: слабо',
  'strength.fair': 'Надёжность: средне',
  'strength.strong': 'Надёжность: хорошо',
  'strength.excellent': 'Надёжность: отлично',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Помощь с паролем',
  'forgot.heading': 'Сброс пароля',
  'forgot.description':
    'Назовите адрес, на который зарегистрирован аккаунт, и мы пришлём письмо со ссылкой для нового пароля.',
  'forgot.submit': 'Прислать ссылку',
  'forgot.submitting': 'Отправляем ссылку',
  'forgot.back': 'Назад к входу',
  'forgot.sent.eyebrow': 'Проверьте почту',
  'forgot.sent.heading': 'Ссылка для сброса уже в пути',
  'forgot.sent.description':
    'Если какой-то аккаунт использует {email}, ссылка для выбора нового пароля уже в этом ящике.',
  'forgot.sent.title': 'Ссылка работает один раз и один час',
  'forgot.sent.body':
    'Ничего не пришло? Проверьте спам, затем отправьте ещё раз. Новая ссылка тихо отменяет предыдущую.',
  'forgot.sent.resend': 'Отправить ещё раз',
  'forgot.sent.resending': 'Отправляем снова',
  'forgot.sent.change': 'Другой адрес',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Сброс пароля',
  'reset.heading': 'Выберите новый пароль',
  'reset.description': {
    one: 'Возьмите что-то длиной не меньше {value} символа. Короткую фразу легче запомнить и труднее угадать.',
    few: 'Возьмите что-то длиной не меньше {value} символов. Короткую фразу легче запомнить и труднее угадать.',
    many: 'Возьмите что-то длиной не меньше {value} символов. Короткую фразу легче запомнить и труднее угадать.',
    other:
      'Возьмите что-то длиной не меньше {value} символа. Короткую фразу легче запомнить и труднее угадать.',
  },
  'reset.submit': 'Установить новый пароль',
  'reset.submitting': 'Сохраняем пароль',
  'reset.back': 'Назад к входу',
  'reset.stale.heading': 'Эту ссылку использовать нельзя',
  'reset.stale.description':
    'Ссылки для сброса живут час и работают только один раз — самый безопасный обмен из возможных.',
  'reset.stale.action': 'Запросить новую ссылку',
  'reset.done.heading': 'Новый пароль установлен',
  'reset.done.description':
    'Все остальные сеансы завершены, так что у прежнего пароля больше нет входа.',
  'reset.done.title': 'Остальные сеансы закрыты',
  'reset.done.body': 'Войдите с новым паролем и планируйте дальше.',
  'reset.done.action': 'Войти',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Двухфакторная проверка',
  'twoFactor.heading': 'Подтвердите, что это вы',
  'twoFactor.description':
    'Ваш аккаунт защищён вторым фактором. Введите текущий код из приложения-аутентификатора.',
  'twoFactor.back': 'Начать заново со входа',
  'twoFactor.methods': 'Способ проверки',
  'twoFactor.totp.tab': 'Приложение',
  'twoFactor.totp.label': 'Код из шести цифр',
  'twoFactor.totp.hint': 'Коды обновляются каждые 30 секунд.',
  'twoFactor.totp.submit': 'Проверить и продолжить',
  'twoFactor.backup.tab': 'Резервный код',
  'twoFactor.backup.label': 'Резервный код',
  'twoFactor.backup.hint':
    'Из списка, сохранённого при включении второго фактора. Каждый код работает один раз.',
  'twoFactor.backup.submit': 'Использовать резервный код',
  'twoFactor.submitting': 'Проверяем код',
  'twoFactor.trust.label': 'Доверять этому устройству 30 дней',
  'twoFactor.trust.detail':
    'До тех пор в этом браузере шаг будет пропускаться. Делайте так только на устройстве, которое принадлежит вам одному.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Почта подтверждена',
  'verify.done.heading': 'Всё готово',
  'verify.done.description':
    'Адрес подтверждён, так что приглашения, напоминания и сводки по поездкам будут доходить.',
  'verify.done.title': 'Подтверждено',
  'verify.done.body': 'Адрес {email} подтверждён в этом аккаунте.',
  'verify.done.bodyUnknown':
    'Ваш адрес электронной почты подтверждён в этом аккаунте.',
  'verify.done.action': 'Перейти к панели',

  'verify.pending.eyebrow': 'Ещё один шаг',
  'verify.pending.heading': 'Подтвердите адрес электронной почты',
  'verify.pending.description':
    'Мы отправили ссылку для подтверждения на {email}. Если открыть её, аккаунт можно будет восстановить, а спутники смогут вас приглашать.',
  'verify.pending.wrongAddress': 'Не тот адрес?',
  'verify.pending.changeIt': 'Смените его в настройках',
  'verify.pending.title': 'Ссылка живёт 24 часа',
  'verify.pending.body':
    'В ящике ничего? Проверьте спам, затем отправьте ещё раз.',
  'verify.pending.resentTitle': 'Только что отправили снова',
  'verify.pending.resentBody':
    'Дайте минуту, затем заглядывайте в ящик — и в спам.',
  'verify.pending.resend': 'Отправить подтверждение снова',
  'verify.pending.resending': 'Отправляем снова',
  'verify.pending.continue': 'Всё равно продолжить',

  'verify.request.eyebrow': 'Подтверждение почты',
  'verify.request.heading': 'Отправить новую ссылку подтверждения',
  'verify.request.description':
    'Ссылки подтверждения живут 24 часа и работают один раз. Назовите адрес — свежая уже в пути.',
  'verify.request.submit': 'Отправить ссылку подтверждения',
  'verify.request.submitting': 'Отправляем ссылку',
  'verify.request.sentTitle': 'Уже в пути',
  'verify.request.sentBody':
    'Если у этого адреса есть аккаунт, ожидающий подтверждения, ссылка уже в его ящике.',
  'verify.request.change': 'Другой адрес',
  'verify.request.back': 'Назад к входу',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Приглашение в пространство',
  'invitation.heading': 'Присоединиться к {workspace}',
  'invitation.description':
    'Приняв приглашение, вы войдёте в это пространство и получите его поездки, бюджеты и списки.',
  'invitation.invitedAs': 'Приглашение на адрес {email}',
  'invitation.role': 'Ваша роль',
  'invitation.means': 'Это значит',
  'invitation.invitedBy': 'Приглашает',
  'invitation.expires': 'Действует до',
  'invitation.accept': 'Принять приглашение',
  'invitation.accepting': 'Входим в пространство',
  'invitation.decline': 'Отклонить',
  'invitation.declining': 'Отклоняем',
  'invitation.reassurance':
    'Пространство можно покинуть в любой момент в его настройках, а всё, что вы создаёте вне него, никогда не становится общим.',

  'invitation.role.owner': 'Владелец — полный контроль, включая оплату',
  'invitation.role.admin': 'Администратор — ведёт поездки, людей и настройки',
  'invitation.role.member': 'Участник — планирует поездки вместе со всеми',
  'invitation.role.other': '{role} — доступ задаёт владелец пространства',
  'invitation.role.badge.owner': 'Владелец',
  'invitation.role.badge.admin': 'Администратор',
  'invitation.role.badge.member': 'Участник',

  'invitation.anonymous.heading': 'Войдите, чтобы увидеть приглашение',
  'invitation.anonymous.description':
    'Приглашения привязаны к адресу, на который отправлены, поэтому нам нужно знать, кто вы, прежде чем показать это.',
  'invitation.anonymous.body':
    'Возьмите адрес, на который пришло приглашение. Сразу после входа мы вернём вас сюда.',
  'invitation.anonymous.action': 'Войти и продолжить',
  'invitation.anonymous.noAccount': 'Аккаунта пока нет?',
  'invitation.anonymous.register': 'Создайте его на приглашённый адрес',

  'invitation.mismatch.heading': 'Это приглашение — на другой адрес',
  'invitation.mismatch.description':
    'Этот сеанс принадлежит другому человеку, так что принять приглашение здесь нельзя.',
  'invitation.mismatch.title': 'Выполнен вход как {email}',
  'invitation.mismatch.body':
    'Выйдите и войдите с адресом, на который пришло приглашение, или попросите новое приглашение на этот аккаунт.',
  'invitation.mismatch.action': 'Сменить аккаунт',
  'invitation.mismatch.back': 'Назад к входу',

  'invitation.unverified.heading': 'Подтвердите почту, чтобы войти',
  'invitation.unverified.description':
    'Пространства принимают только подтверждённые адреса, чтобы никого не добавили из-за опечатки.',
  'invitation.unverified.title': 'Адрес {email} пока не подтверждён',
  'invitation.unverified.body':
    'Откройте ссылку подтверждения в своём ящике и вернитесь на эту страницу. Приглашение будет ждать.',
  'invitation.unverified.action': 'Подтвердить почту',
  'invitation.unverified.resend': 'Отправить письмо подтверждения снова',

  'invitation.unavailable.heading': 'Это приглашение больше недействительно',
  'invitation.unavailable.description':
    'Приглашения живут семь дней и закрываются в тот момент, когда их используют или отзывают.',
  'invitation.unavailable.title': 'Принимать здесь нечего',
  'invitation.unavailable.body':
    'Попросите того, кто вас приглашал, прислать новое приглашение — эта страница покажет его сразу.',
  'invitation.unavailable.dashboard': 'Перейти к панели',

  'invitation.declined.eyebrow': 'Приглашение отклонено',
  'invitation.declined.heading': 'Ничего страшного — общим ничего не стало',
  'invitation.declined.description':
    'Владелец пространства об этом узнал, и эта ссылка больше не работает.',
  'invitation.declined.action': 'Перейти к панели',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Что-то пошло не так',
  'error.unexpected.detail': 'Это не сработало. Попробуйте снова через минуту.',
  'error.rateLimited.title': 'Слишком много попыток',
  'error.rateLimited.detail':
    'Для безопасности мы приостановили вход с этого устройства на несколько минут. Попробуйте чуть позже.',
  'error.offline.title': 'Нет соединения',
  'error.offline.detail':
    'Не удалось связаться с planned.travel. Проверьте соединение и попробуйте снова.',

  'error.credentials.title': 'Эти данные не совпадают',
  'error.credentials.detail':
    'Проверьте адрес и пароль и попробуйте снова. Если регистрация была через Google или Apple, воспользуйтесь той кнопкой.',
  'error.password.title': 'Эти данные не совпадают',
  'error.password.detail': 'Проверьте адрес и пароль и попробуйте снова.',
  'error.noPassword.title': 'У этого аккаунта нет пароля',
  'error.noPassword.detail':
    'Этот аккаунт входит через внешний сервис или ключ доступа. Возьмите один из вариантов выше.',
  'error.unverified.title': 'Сначала подтвердите почту',
  'error.unverified.detail':
    'При регистрации мы отправили ссылку подтверждения. Откройте её и возвращайтесь.',
  'error.emailTaken.title': 'Этот адрес уже зарегистрирован',
  'error.emailTaken.detail': 'Войдите или сбросьте пароль, если забыли его.',
  'error.noAccount.title': 'Такой аккаунт не найден',
  'error.noAccount.detail': 'Проверьте адрес или создайте новый аккаунт.',
  'error.passwordTooShort.title': 'Пароль слишком короткий',
  'error.passwordTooShort.detail':
    'Возьмите фразу подольше и попробуйте снова.',
  'error.passwordTooLong.title': 'Пароль слишком длинный',
  'error.passwordTooLong.detail': 'Возьмите фразу покороче и попробуйте снова.',
  'error.linkSpent.title': 'Эта ссылка больше не действует',
  'error.linkSpent.detail':
    'Ссылки для пароля работают один раз. Запросите новую — пришлём сразу.',
  'error.linkExpired.title': 'Срок этой ссылки истёк',
  'error.linkExpired.detail': 'Запросите новую — пришлём сразу.',
  'error.linkIncomplete.title': 'Эта ссылка неполная',
  'error.linkIncomplete.detail':
    'Ссылки сброса пароля несут одноразовый токен. Откройте самое свежее письмо или запросите новую ссылку.',
  'error.sessionExpired.title': 'Сеанс истёк',
  'error.sessionExpired.detail':
    'Войдите снова, чтобы продолжить с того же места.',
  'error.alreadyVerified.title': 'Уже подтверждено',
  'error.alreadyVerified.detail': 'Этот адрес проверен. Входите как обычно.',
  'error.badCode.title': 'Этот код не подошёл',
  'error.badCode.detail':
    'Коды из приложения живут 30 секунд. Дождитесь следующего и введите все шесть цифр.',
  'error.badBackupCode.title': 'Этот резервный код не подошёл',
  'error.badBackupCode.detail':
    'Каждый резервный код работает один раз. Возьмите следующий неиспользованный из списка.',
  'error.locked.title': 'Аккаунт временно заблокирован',
  'error.locked.detail':
    'Слишком много неудачных попыток проверки. Для безопасности аккаунт заблокирован на несколько минут.',
  'error.twoFactorOn.title': 'Двухфакторная аутентификация уже включена',
  'error.twoFactorOn.detail':
    'Повторная настройка остановила бы работу текущего приложения-аутентификатора, поэтому ничего не изменилось. Управлять ею можно здесь.',
  'error.noTwoFactor.title': 'Второй фактор не настроен',
  'error.noTwoFactor.detail': 'Продолжите входом по адресу и паролю.',
  'error.twoFactorExpired.title': 'Начните заново со входа',
  'error.twoFactorExpired.detail':
    'Этот шаг проверки истёк. Введите адрес и пароль ещё раз.',
  'error.invitationGone.title': 'Это приглашение больше недействительно',
  'error.invitationGone.detail':
    'Оно могло истечь, быть отозвано или уже использовано. Попросите новое приглашение.',
  'error.invitationOther.title': 'Это приглашение — для другого человека',
  'error.invitationOther.detail':
    'Оно отправлено на другой адрес. Войдите с этим адресом, чтобы принять его.',
  'error.alreadyMember.title': 'Вы уже в этом пространстве',
  'error.alreadyMember.detail':
    'Принимать нечего — откройте его в переключателе пространств.',
  'error.workspaceFull.title': 'Это пространство заполнено',
  'error.workspaceFull.detail':
    'Достигнут предел участников. Попросите владельца освободить место или поднять тариф.',
  'error.verifyBeforeJoin.title': 'Сначала подтвердите почту',
  'error.verifyBeforeJoin.detail':
    'Откройте ссылку подтверждения из нашего письма и вернитесь к этому приглашению.',

  'passkeyNotice.added': 'В ваш аккаунт добавлен ключ доступа',
  'passkeyNotice.removed': 'Из вашего аккаунта удалён ключ доступа',
  'passkeyNotice.security': 'Безопасность',
  'passkeyNotice.action': 'Управление ключами доступа',
  'passkeyNotice.recovery':
    'Если вы не узнаёте это изменение, смените пароль и завершите незнакомые сеансы. Сброс пароля не удаляет ключи доступа. Проверьте их и удалите те, которые не узнаёте.',
} satisfies TranslationOf<typeof En>

export default messages
