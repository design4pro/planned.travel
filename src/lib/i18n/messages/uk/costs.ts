/**
 * The costs tab's copy, in uk.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Множина.** `one` · `few` · `many` · `other`: `one` — 1, 21, 31…, `few` —
 * 2–4, `many` — 0 і 5–20, `other` — дробове. **Типографіка.** Українська
 * набирає лапки «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Ви',
  'person.youTarget': 'вам',
  'person.removed': 'Вилучений мандрівник',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Видалити цю витрату?',
  'delete.description':
    '«{title}» і її поділ зникають з розрахунку. Це не можна скасувати.',
  'delete.failed': 'Видалити не вдалося',
  'delete.failedBody': 'Витрату не вдалося видалити. Спробуйте за хвилину.',
  'delete.noBalances':
    'Жодне сальдо не змінюється - на неї нічого не ділилося.',
  'delete.balancesChange': 'Змінюються сальдо: {names}.',
  'delete.confirm': 'Видалити витрату',
  'delete.working': 'Витрата видаляється',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Витрати',
  'toolbar.shownOf': '{shown} з {total}',
  'toolbar.searchPlaceholder': 'Пошук у витратах, нотатках і платниках…',
  'toolbar.searchLabel': 'Пошук у витратах',
  'toolbar.allCategories': 'Усі категорії',
  'toolbar.allDays': 'Усі дні',
  'toolbar.filterCategory': 'Фільтр за категорією',
  'toolbar.filterDay': 'Фільтр за днем',
  'toolbar.whose': 'Чиї витрати',
  'toolbar.paidByMe': 'Оплачено мною',
  'toolbar.owedToMe': 'Мені винні',
  'toolbar.logged': {
    one: '{value} запис',
    few: '{value} записи',
    many: '{value} записів',
    other: '{value} запису',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Поділ між учасниками',
  'split.label': 'Діляться між',
  'split.everyone': 'Усі',
  'split.nobody': 'Ніхто',
  'split.how': 'Як діляється ця витрата',
  'split.method.equal': 'Порівну',
  'split.method.equalHint':
    'Усі включені платять однаково, а зайва найменша одиниця йде першому в списку.',
  'split.method.exact': 'Точно',
  'split.method.exactHint':
    'Впишіть, скільки хто справді має. Суми мусять дати підсумок.',
  'split.method.shares': 'Частки',
  'split.method.sharesHint': 'Зважте поділ: 2 частки на пару, 1 на решту.',
  'split.method.percentage': 'Відсотки',
  'split.method.percentageHint':
    'Поділ за відсотками. Відсотки мусять дати 100.',
  'split.exactFor': 'Точна сума для {name}',
  'split.percentFor': 'Відсоток для {name}',
  'split.sharesFor': 'Частки для {name}',
  'split.balanced': 'Сходиться',
  'split.allocated': 'розподілено {allocated} з {total}',
  'split.over': '{amount} зайвих',
  'split.left': 'залишилося {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Сума',
  'field.currency': 'Валюта',
  'field.date': 'Дата',
  'field.paidBy': 'Оплатив',
  'expense.editTitle': 'Змінити цю витрату',
  'expense.addTitle': 'Додати витрату',
  'expense.editDescription':
    'Якщо змінити суму, вона заново поділиться між усіма, кого позначено нижче.',
  'expense.addDescription':
    'Суми цієї подорожі ведуться в {currency}. Запишіть чек у його власній валюті і вкажіть, у скільки він перерахувався.',
  'expense.saveFailed': 'Зберегти не вдалося',
  'expense.what': 'За що це було',
  'expense.whatPlaceholder': 'Вечеря в Kyubey',
  'expense.amountNotANumber': 'Введіть суму числом.',
  'expense.currencyLabel': 'Валюта, у якій виписано чек',
  'expense.convertedTo': 'Перераховано в {currency}',
  'expense.convertedHint': 'У скільки {from} вийшло в {to} за вашою випискою.',
  'expense.convertedSuggested':
    'Запропоновано за курсом, використаним у цій поїздці ({date}, {rate}). Змініть суму, щоб вона збігалася з вашою випискою.',
  'expense.convertedNotANumber': 'Введіть перераховану суму числом.',
  'expense.dateLabel': 'Дата витрати',
  'expense.paidByHint':
    'Залиште без платника, якщо записуєте чек, який ще ніхто не покрив.',
  'expense.nobodyYet': 'Поки ніхто',
  'expense.whoPaid': 'Хто оплатив',
  'expense.notesHint': 'Необов’язково. Усе, чого не каже чек.',
  'expense.notesPlaceholder': 'Поділили дегустаційне меню, напої окремо.',
  'expense.noAmount': 'Поки без суми',
  'expense.saving': 'Витрата зберігається',
  'expense.saveChanges': 'Зберегти зміни',
  'expense.add': 'Додати витрату',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Записати платіж',
  'payment.description':
    'Записаний переказ зникає з обох сальдо. Грошей він не рухає: planned.travel веде розрахунок, гроші надсилає ваш банк.',
  'payment.youSuffix': '{name} (ви)',
  'payment.pays': '{from} платить {to}',
  'payment.pickTwo': 'Виберіть двох різних учасників.',
  'payment.paidTo': 'Оплачено кому',
  'payment.needsTwo': 'Платіж потребує двох різних учасників.',
  'payment.whoPaying': 'Хто платить',
  'payment.whoPaid': 'Хто отримує',
  'payment.amountIn': 'Сума в {currency}',
  'payment.amountPositive': 'Введіть суму більшу за нуль.',
  'payment.currencyLabel': 'Валюта, у якій здійснено платіж',
  'payment.how': 'Як',
  'payment.howMade': 'Як пройшов платіж',
  'payment.dateLabel': 'Дата платежу',
  'payment.note': 'Нотатка',
  'payment.noteHint': 'Необов’язково. Референс або за що це було.',
  'payment.notePlaceholder': 'Покриває готель у Кіото і квитки JR.',
  'payment.recording': 'Платіж записується',
  'payment.confirm': 'Записати платіж',
  'payment.failed': 'Платіж не вдалося записати. Спробуйте за хвилину.',
  'payment.method.bankTransfer': 'Банківський переказ',
  'payment.method.cash': 'Готівка',
  'payment.method.card': 'Картка',
  'payment.method.app': 'Платіжний застосунок',
  'payment.method.other': 'Щось інше',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Розрахунки',
  'settle.addPayment': 'Додати платіж',
  'settle.action': 'Розрахуватися',
  'settle.empty.title': 'Усі розрахувалися',
  'settle.empty.body':
    'Переказів не потрібно. Додайте витрату, і будь-який перекіс з’явиться тут.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Баланси',
  'balances.count': {
    one: '{travellers} мандрівник',
    few: '{travellers} мандрівники',
    many: '{travellers} мандрівників',
    other: '{travellers} мандрівника',
  },
  'balances.empty': 'Баланси з’являться, коли у витрати є платник і поділ.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'За категоріями',
  'categories.againstBudget': 'Відносно бюджету подорожі',
  'categories.progressLabel': 'Витрачено відносно бюджету подорожі',
  'categories.empty':
    'Рядки бюджету й витрати розкладуться тут, коли буде що розкладати.',
  'categories.legendLabel': 'Витрати за категоріями',
  'categories.planned': 'заплановано {amount}',
  'categories.nothingSpent':
    'Поки що нічого не витрачено. Ось що ви запланували.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'менше {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'На кого витрачено гроші',
  'memberBar.others': {
    one: 'ще {others} мандрівник',
    few: 'ще {others} мандрівники',
    many: 'ще {others} мандрівників',
    other: 'ще {others} мандрівника',
  },
  'memberBar.notSplit': 'Нікому не призначено',
  'totalTile.label': 'Загальні витрати на подорож',
  'totalTile.captionPlanned': 'Заплановано {amount} на всіх мандрівників',
  'totalTile.captionBudget': 'Бюджет подорожі: {amount}',
  'totalTile.yourShare': 'Ваша частка',
  'totalTile.youPaid': 'Ви заплатили',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Записані платежі',
  'payments.empty.title': 'Платежів ще немає',
  'payments.empty.body': 'Коли хтось повертає баланс, переказ записується тут.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Витрати можна переглядати, але не змінювати',
  'readOnly.body':
    'Додавати, змінювати й видаляти витрати та записувати платежі можуть лише власники подорожі й ті, хто може її редагувати. Якщо щось потрібно змінити, зверніться до власника.',
  'readOnly.empty':
    'У цій подорожі ще немає записаних витрат. Вони з’являться тут, коли власник або редактор їх додасть.',
  'readOnly.settleEmpty':
    'Зараз перекази не потрібні. Будь-який дисбаланс з’явився б тут.',
  'refusal.rebaseChanged':
    'Поїздка змінилася, поки ви підтверджували, тому нічого не змінено. Перевірте нові суми й підтвердьте ще раз.',
  'refusal.tripCurrencyChanged':
    'Валюта бюджету цієї поїздки тепер {to}, тому нічого не збережено. Сторінку оновлено: перевірте суму й збережіть ще раз.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Валюта відображення',
  'display.indicator.perTrip': 'Власна валюта',
  'display.indicator.fixed': 'Також у {code}',
  'display.menu.perTrip': 'Кожна подорож у своїй валюті',
  'display.menu.workspace': '{code} (типова в просторі)',
  'display.menu.rateHint': 'Використовує курс, уже записаний у подорожі',
  'display.menu.currentHint': 'Обрана, але жоден записаний курс її не покриває',
  'display.menu.needsLiveRate': 'Потрібен поточний курс, який поки недоступний',
  'display.menu.saving': 'Зберігаємо ваш вибір',
  'display.error.title': 'Валюту відображення не збережено',
  'display.error.body':
    'Не вдалося зберегти ваш вибір. Спробуйте ще раз за мить.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Приблизно {amount} {code} у вашій валюті відображення',
  'display.row.notConverted': 'Не перераховано',
  'display.alert.title': 'Деякі суми не перераховано',
  'display.alert.body':
    'Для цих пар валют курс не записано, тому суми залишаються у валюті бюджету:',
  'display.alert.pair': '{from} у {to} на {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Змінити валюту бюджету',
  'rebase.title': 'Зміна валюти бюджету',
  'rebase.description':
    'Суми, які ви ввели, залишаються без змін. Підсумки й баланси поїздки перераховуються в нову валюту.',
  'rebase.to': 'Нова валюта',
  'rebase.toPlaceholder': 'Виберіть валюту',
  'rebase.rateLabel': 'Курс (1 {from} у {to})',
  'rebase.rateInverse': 'Тобто 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Введіть курс більший за нуль.',
  'rebase.rateOutOfRange':
    'Курс виглядає надто великим або надто малим. Перевірте, у який бік його вказано.',
  'rebase.source.recent': 'Останній курс, використаний у цьому просторі',
  'rebase.source.manual': 'Курс, який ви ввели',
  'rebase.noRate':
    'Курс {from} у {to} не записано. Введіть курс, який хочете використати.',
  'rebase.waitingForRate': 'Попередній розрахунок з’явиться, щойно буде курс.',
  'rebase.loading': 'Виконуємо перерахунок',
  'rebase.example':
    '{original} залишається таким, як ви його ввели, і враховується як {converted}.',
  'rebase.count.expenses': {
    one: '{count} витрату буде враховано в {to}.',
    few: '{count} витрати буде враховано в {to}.',
    many: '{count} витрат буде враховано в {to}.',
    other: '{count} витрати буде враховано в {to}.',
  },
  'rebase.count.payments': {
    one: '{count} платіж буде враховано в {to}.',
    few: '{count} платежі буде враховано в {to}.',
    many: '{count} платежів буде враховано в {to}.',
    other: '{count} платежу буде враховано в {to}.',
  },
  'rebase.count.planned': {
    one: '{count} заплановану позицію буде враховано в {to}.',
    few: '{count} заплановані позиції буде враховано в {to}.',
    many: '{count} запланованих позицій буде враховано в {to}.',
    other: '{count} запланованої позиції буде враховано в {to}.',
  },
  'rebase.pinned':
    'Ціни місць, броней, проживання й транспорту залишаються в {from}.',
  'rebase.target': 'Бюджет поїздки {before} стане {after}.',
  'rebase.rounding':
    'Кожна сума округлюється один раз, тому баланс може змінитися щонайбільше на {amount}.',
  'rebase.leftover':
    'Після зміни борг {name} перед {other} становив би {amount}.',
  'rebase.someone': 'Хтось',
  'rebase.nothing': 'У цій поїздці ще немає цін, тому перераховувати нічого.',
  'rebase.unconverted': {
    one: '{count} запис у валюті, відмінній від {from}, тому його не можна перерахувати автоматично. Зазвичай це витрата, створена з броні з ціною в іншій валюті: змініть або видаліть її й повторіть спробу.',
    few: '{count} записи у валюті, відмінній від {from}, тому їх не можна перерахувати автоматично. Зазвичай це витрати, створені з броней з ціною в іншій валюті: змініть або видаліть їх і повторіть спробу.',
    many: '{count} записів у валюті, відмінній від {from}, тому їх не можна перерахувати автоматично. Зазвичай це витрати, створені з броней з ціною в іншій валюті: змініть або видаліть їх і повторіть спробу.',
    other:
      '{count} запису у валюті, відмінній від {from}, тому їх не можна перерахувати автоматично. Зазвичай це витрати, створені з броней з ціною в іншій валюті: змініть або видаліть їх і повторіть спробу.',
  },
  'rebase.unsplittable': {
    one: 'У {count} витрати поділ не можна перенести, бо всі частки в ньому нульові. Змініть або видаліть її й повторіть спробу.',
    few: 'У {count} витрат поділ не можна перенести, бо всі частки в них нульові. Змініть або видаліть їх і повторіть спробу.',
    many: 'У {count} витрат поділ не можна перенести, бо всі частки в них нульові. Змініть або видаліть їх і повторіть спробу.',
    other:
      'У {count} витрати поділ не можна перенести, бо всі частки в них нульові. Змініть або видаліть їх і повторіть спробу.',
  },
  'rebase.outOfRange':
    'За такого курсу одна із сум у поїздці стане завеликою, щоб зберегти її в {to}. Перевірте курс і те, у який бік його вказано.',
  'rebase.tooLarge':
    'У цій поїздці забагато записів, щоб змінити їх за один раз: знадобилося б {changes} змін одночасно, а ліміт становить {limit}. Поки що бюджет залишається в {from}.',
  'rebase.copyPending': 'Цю поїздку ще копіюють. Спробуйте ще раз за мить.',
  'rebase.error': 'Не вдалося завантажити перерахунок. Нічого не змінено.',
  'rebase.commitError': 'Не вдалося змінити валюту бюджету. Нічого не змінено.',
  'rebase.retry': 'Повторити',
  'rebase.confirm': 'Перейти на {to}',
  'rebase.committing': 'Змінюємо валюту бюджету',
  'rebase.done': 'Тепер бюджет у {to}.',
} satisfies TranslationOf<typeof En>

export default messages
