/**
 * The costs tab's copy, in ru.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Множественное число.** `one` · `few` · `many` · `other`: `one` — 1, 21,
 * 31…, `few` — 2–4, `many` — 0 и 5–20, `other` — дробное. **Типографика.**
 * Русский набирает кавычки «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Вы',
  'person.youTarget': 'вам',
  'person.removed': 'Удалённый путешественник',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Удалить эту трату?',
  'delete.description':
    '«{title}» и её деление уходят из расчёта. Это нельзя отменить.',
  'delete.failed': 'Удалить не удалось',
  'delete.failedBody': 'Трату не удалось удалить. Попробуйте через минуту.',
  'delete.noBalances':
    'Ни один баланс не меняется - на неё ничего не делилось.',
  'delete.balancesChange': 'Меняются балансы: {names}.',
  'delete.confirm': 'Удалить трату',
  'delete.working': 'Трата удаляется',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Траты',
  'toolbar.shownOf': '{shown} из {total}',
  'toolbar.searchPlaceholder': 'Поиск по тратам, заметкам и плательщикам…',
  'toolbar.searchLabel': 'Поиск по тратам',
  'toolbar.allCategories': 'Все категории',
  'toolbar.allDays': 'Все дни',
  'toolbar.filterCategory': 'Фильтр по категории',
  'toolbar.filterDay': 'Фильтр по дню',
  'toolbar.whose': 'Чьи траты',
  'toolbar.paidByMe': 'Оплачено мной',
  'toolbar.owedToMe': 'Мне должны',
  'toolbar.logged': {
    one: '{value} запись',
    few: '{value} записи',
    many: '{value} записей',
    other: '{value} записи',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Деление между участниками',
  'split.label': 'Делится между',
  'split.everyone': 'Все',
  'split.nobody': 'Никто',
  'split.how': 'Как делится эта трата',
  'split.method.equal': 'Поровну',
  'split.method.equalHint':
    'Все включённые платят одинаково, а лишняя наименьшая единица идёт первому в списке.',
  'split.method.exact': 'Точно',
  'split.method.exactHint':
    'Впишите, сколько кто действительно должен. Суммы обязаны дать итог.',
  'split.method.shares': 'Доли',
  'split.method.sharesHint':
    'Взвесьте деление: 2 доли на пару, 1 на остальных.',
  'split.method.percentage': 'Проценты',
  'split.method.percentageHint':
    'Деление по процентам. Проценты обязаны дать 100.',
  'split.exactFor': 'Точная сумма для {name}',
  'split.percentFor': 'Процент для {name}',
  'split.sharesFor': 'Доли для {name}',
  'split.balanced': 'Сходится',
  'split.allocated': 'распределено {allocated} из {total}',
  'split.over': '{amount} лишних',
  'split.left': 'осталось {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Сумма',
  'field.currency': 'Валюта',
  'field.date': 'Дата',
  'field.paidBy': 'Оплатил',
  'expense.editTitle': 'Изменить эту трату',
  'expense.addTitle': 'Добавить трату',
  'expense.editDescription':
    'Если изменить сумму, она заново разделится между всеми, кто отмечен ниже.',
  'expense.addDescription':
    'Суммы этой поездки ведутся в {currency}. Запишите чек в его собственной валюте и укажите, во сколько он пересчитался.',
  'expense.saveFailed': 'Сохранить не удалось',
  'expense.what': 'За что это было',
  'expense.whatPlaceholder': 'Ужин в Kyubey',
  'expense.amountNotANumber': 'Введите сумму числом.',
  'expense.currencyLabel': 'Валюта, в которой выписан чек',
  'expense.convertedTo': 'Пересчитано в {currency}',
  'expense.convertedHint':
    'Во сколько {from} обошлось в {to} по вашей выписке.',
  'expense.convertedSuggested':
    'Предложено по курсу, использованному в этой поездке ({date}, {rate}). Измените сумму, чтобы она совпадала с вашей выпиской.',
  'expense.convertedNotANumber': 'Введите пересчитанную сумму числом.',
  'expense.dateLabel': 'Дата траты',
  'expense.paidByHint':
    'Оставьте без плательщика, если записываете чек, который ещё никто не покрыл.',
  'expense.nobodyYet': 'Пока никто',
  'expense.whoPaid': 'Кто оплатил',
  'expense.notesHint': 'Необязательно. Всё, чего не говорит чек.',
  'expense.notesPlaceholder':
    'Разделили дегустационное меню, напитки отдельно.',
  'expense.noAmount': 'Пока без суммы',
  'expense.saving': 'Трата сохраняется',
  'expense.saveChanges': 'Сохранить изменения',
  'expense.add': 'Добавить трату',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Записать платёж',
  'payment.description':
    'Записанный перевод уходит из обоих балансов. Денег он не двигает: planned.travel ведёт расчёт, деньги отправляет ваш банк.',
  'payment.youSuffix': '{name} (вы)',
  'payment.pays': '{from} платит {to}',
  'payment.pickTwo': 'Выберите двух разных участников.',
  'payment.paidTo': 'Оплачено кому',
  'payment.needsTwo': 'Платёж требует двух разных участников.',
  'payment.whoPaying': 'Кто платит',
  'payment.whoPaid': 'Кто получает',
  'payment.amountIn': 'Сумма в {currency}',
  'payment.amountPositive': 'Введите сумму больше нуля.',
  'payment.currencyLabel': 'Валюта, в которой был сделан платёж',
  'payment.how': 'Как',
  'payment.howMade': 'Как прошёл платёж',
  'payment.dateLabel': 'Дата платежа',
  'payment.note': 'Заметка',
  'payment.noteHint': 'Необязательно. Референс или за что это было.',
  'payment.notePlaceholder': 'Покрывает отель в Киото и билеты JR.',
  'payment.recording': 'Платёж записывается',
  'payment.confirm': 'Записать платёж',
  'payment.failed': 'Платёж не удалось записать. Попробуйте через минуту.',
  'payment.method.bankTransfer': 'Банковский перевод',
  'payment.method.cash': 'Наличные',
  'payment.method.card': 'Карта',
  'payment.method.app': 'Платёжное приложение',
  'payment.method.other': 'Что-то другое',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Расчёты',
  'settle.addPayment': 'Добавить платёж',
  'settle.action': 'Рассчитаться',
  'settle.empty.title': 'Все в расчёте',
  'settle.empty.body':
    'Переводы не нужны. Добавьте расход, и любой перекос появится здесь.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Балансы',
  'balances.count': {
    one: '{travellers} путешественник',
    few: '{travellers} путешественника',
    many: '{travellers} путешественников',
    other: '{travellers} путешественника',
  },
  'balances.empty':
    'Балансы появятся, когда у расхода есть плательщик и разделение.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'По категориям',
  'categories.againstBudget': 'Относительно бюджета поездки',
  'categories.progressLabel': 'Потрачено относительно бюджета поездки',
  'categories.empty':
    'Строки бюджета и расходы разложатся здесь, когда будет что раскладывать.',
  'categories.legendLabel': 'Расходы по категориям',
  'categories.planned': 'запланировано {amount}',
  'categories.nothingSpent':
    'Пока ничего не потрачено. Вот что вы запланировали.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'меньше {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'На кого потрачены деньги',
  'memberBar.others': {
    one: 'ещё {others} путешественник',
    few: 'ещё {others} путешественника',
    many: 'ещё {others} путешественников',
    other: 'ещё {others} путешественника',
  },
  'memberBar.notSplit': 'Не отнесено ни к кому',
  'totalTile.label': 'Общие расходы на поездку',
  'totalTile.captionPlanned': 'Запланировано {amount} на всех путешественников',
  'totalTile.captionBudget': 'Бюджет поездки: {amount}',
  'totalTile.yourShare': 'Ваша доля',
  'totalTile.youPaid': 'Вы заплатили',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Записанные платежи',
  'payments.empty.title': 'Пока нет платежей',
  'payments.empty.body':
    'Когда кто-то возвращает баланс, перевод записывается здесь.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Расходы можно смотреть, но нельзя менять',
  'readOnly.body':
    'Добавлять, изменять и удалять расходы и записывать платежи могут только владельцы поездки и те, кто может её редактировать. Если нужно что-то изменить, обратитесь к владельцу.',
  'readOnly.empty':
    'В этой поездке пока нет записанных расходов. Они появятся здесь, когда владелец или редактор их добавит.',
  'readOnly.settleEmpty':
    'Сейчас переводы не нужны. Любой дисбаланс появился бы здесь.',
  'refusal.rebaseChanged':
    'Поездка изменилась, пока вы подтверждали, поэтому ничего не было изменено. Проверьте новые суммы и подтвердите снова.',
  'refusal.tripCurrencyChanged':
    'Валюта бюджета этой поездки теперь {to}, поэтому ничего не сохранено. Страница обновлена: проверьте сумму и сохраните снова.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Валюта отображения',
  'display.indicator.perTrip': 'Своя валюта',
  'display.indicator.fixed': 'Также в {code}',
  'display.menu.perTrip': 'Каждая поездка в своей валюте',
  'display.menu.workspace': '{code} (по умолчанию в пространстве)',
  'display.menu.rateHint': 'Использует курс, уже записанный в поездке',
  'display.menu.currentHint':
    'Выбрана, но ни один записанный курс её не покрывает',
  'display.menu.needsLiveRate': 'Нужен текущий курс, который пока недоступен',
  'display.menu.saving': 'Сохраняем ваш выбор',
  'display.error.title': 'Валюта отображения не сохранена',
  'display.error.body':
    'Не удалось сохранить ваш выбор. Попробуйте ещё раз чуть позже.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Около {amount} {code} в вашей валюте отображения',
  'display.row.notConverted': 'Не пересчитано',
  'display.alert.title': 'Некоторые суммы не пересчитаны',
  'display.alert.body':
    'Для этих пар валют курс не записан, поэтому суммы остаются в валюте бюджета:',
  'display.alert.pair': '{from} в {to} на {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Изменить валюту бюджета',
  'rebase.title': 'Изменение валюты бюджета',
  'rebase.description':
    'Введённые вами суммы остаются как есть. Итоги и балансы поездки пересчитываются в новую валюту.',
  'rebase.to': 'Новая валюта',
  'rebase.toPlaceholder': 'Выберите валюту',
  'rebase.rateLabel': 'Курс (1 {from} в {to})',
  'rebase.rateInverse': 'То есть 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Введите курс больше нуля.',
  'rebase.rateOutOfRange':
    'Курс выглядит слишком большим или слишком маленьким. Проверьте, в какую сторону он указан.',
  'rebase.source.recent': 'Последний курс, использованный в этом пространстве',
  'rebase.source.manual': 'Курс, который вы ввели',
  'rebase.noRate':
    'Курс {from} в {to} не записан. Введите курс, который хотите использовать.',
  'rebase.waitingForRate':
    'Предварительный расчёт появится, как только будет курс.',
  'rebase.loading': 'Выполняем пересчёт',
  'rebase.example':
    '{original} остаётся таким, как вы его ввели, и учитывается как {converted}.',
  'rebase.count.expenses': {
    one: '{count} расход будет учтён в {to}.',
    few: '{count} расхода будут учтены в {to}.',
    many: '{count} расходов будет учтено в {to}.',
    other: '{count} расхода будут учтены в {to}.',
  },
  'rebase.count.payments': {
    one: '{count} платёж будет учтён в {to}.',
    few: '{count} платежа будут учтены в {to}.',
    many: '{count} платежей будет учтено в {to}.',
    other: '{count} платежа будут учтены в {to}.',
  },
  'rebase.count.planned': {
    one: '{count} запланированная позиция будет учтена в {to}.',
    few: '{count} запланированные позиции будут учтены в {to}.',
    many: '{count} запланированных позиций будет учтено в {to}.',
    other: '{count} запланированной позиции будет учтено в {to}.',
  },
  'rebase.pinned':
    'Цены мест, броней, проживания и транспорта остаются в {from}.',
  'rebase.target': 'Бюджет поездки {before} станет {after}.',
  'rebase.rounding':
    'Каждая сумма округляется один раз, поэтому баланс может сдвинуться не больше чем на {amount}.',
  'rebase.leftover':
    'После изменения долг {name} перед {other} составил бы {amount}.',
  'rebase.someone': 'Кто-то',
  'rebase.nothing':
    'В этой поездке пока нет цен, поэтому пересчитывать нечего.',
  'rebase.unconverted': {
    one: '{count} запись в валюте, отличной от {from}, поэтому её нельзя пересчитать автоматически. Обычно это расход, созданный из брони с ценой в другой валюте: измените или удалите его и повторите попытку.',
    few: '{count} записи в валюте, отличной от {from}, поэтому их нельзя пересчитать автоматически. Обычно это расходы, созданные из броней с ценой в другой валюте: измените или удалите их и повторите попытку.',
    many: '{count} записей в валюте, отличной от {from}, поэтому их нельзя пересчитать автоматически. Обычно это расходы, созданные из броней с ценой в другой валюте: измените или удалите их и повторите попытку.',
    other:
      '{count} записи в валюте, отличной от {from}, поэтому их нельзя пересчитать автоматически. Обычно это расходы, созданные из броней с ценой в другой валюте: измените или удалите их и повторите попытку.',
  },
  'rebase.unsplittable': {
    one: 'У {count} расхода деление нельзя перенести, потому что все доли в нём равны нулю. Измените или удалите его и повторите попытку.',
    few: 'У {count} расходов деление нельзя перенести, потому что все доли в них равны нулю. Измените или удалите их и повторите попытку.',
    many: 'У {count} расходов деление нельзя перенести, потому что все доли в них равны нулю. Измените или удалите их и повторите попытку.',
    other:
      'У {count} расхода деление нельзя перенести, потому что все доли в них равны нулю. Измените или удалите их и повторите попытку.',
  },
  'rebase.outOfRange':
    'При таком курсе одна из сумм в поездке станет слишком большой, чтобы сохранить её в {to}. Проверьте курс и то, в какую сторону он указан.',
  'rebase.tooLarge':
    'В этой поездке слишком много записей, чтобы изменить их за один раз: потребовалось бы {changes} изменений сразу, а предел равен {limit}. Пока бюджет остаётся в {from}.',
  'rebase.copyPending':
    'Эта поездка ещё копируется. Повторите попытку чуть позже.',
  'rebase.error': 'Не удалось загрузить пересчёт. Ничего не изменено.',
  'rebase.commitError':
    'Не удалось изменить валюту бюджета. Ничего не изменено.',
  'rebase.stale':
    'Валюта бюджета поездки теперь {current}, а не {from}. Закройте это окно и откройте его снова.',
  'rebase.sameCurrency': 'Бюджет уже в {to}. Выберите другую валюту.',
  'rebase.commitUnknown':
    'Не удалось подтвердить, сменилась ли валюта бюджета на {to}. Прежде чем повторять, обновите страницу и проверьте.',
  'rebase.retry': 'Повторить',
  'rebase.confirm': 'Перейти на {to}',
  'rebase.committing': 'Меняем валюту бюджета',
  'rebase.done': 'Теперь бюджет в {to}.',
} satisfies TranslationOf<typeof En>

export default messages
