/**
 * The trip modules' own copy, in ru.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Множественное число.** `one` · `few` · `many` · `other`. Кавычки «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Не задано',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Подключение',
  'presence.connecting.body': 'Заходим в живую комнату этой поездки.',
  'presence.live.title': 'В прямом эфире',
  'presence.live.body': 'Сообщения, заметки и голоса появляются здесь сразу.',
  'presence.reconnecting.title': 'Переподключение',
  'presence.reconnecting.body':
    'Соединение оборвалось. Пробуем снова — всё, что вы отправляете, всё равно сохраняется.',
  'presence.offline.title': 'Без эфира',
  'presence.offline.body':
    'Живые обновления выключены. Сохранение работает; обновите страницу или повторите, чтобы догнать.',
  'presence.reconnect': 'Переподключиться',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Все переезды',
  'transports.empty.title': 'Пока нет переездов',
  'transports.empty.body':
    'Рейсы, поезда, паромы и дорога из аэропорта живут здесь — с кодами брони и номерами мест под рукой в нужный день, и каждая пересадка проверена относительно предыдущей.',
  'transports.empty.action': 'Добавить первый переезд',
  'transports.filtered.title': 'Переездов такого вида нет',
  'transports.filtered.body':
    'Каждый переезд этой поездки идёт по-своему. Вернитесь к «{label}», чтобы увидеть все.',
  'transports.filtered.action': 'Показать все переезды',
  'transports.alert.impossible.title': {
    one: 'Одна пересадка невозможна',
    few: '{value} пересадки невозможны',
    many: '{value} пересадок невозможны',
    other: '{value} пересадки невозможны',
  },
  'transports.alert.impossible.body':
    'Переезд отправляется раньше, чем приходит предыдущий. Узлы ниже говорят какие и насколько.',
  'transports.alert.tight.title': {
    one: 'Одна пересадка впритык',
    few: '{value} пересадки впритык',
    many: '{value} пересадок впритык',
    other: '{value} пересадки впритык',
  },
  'transports.alert.tight.body':
    'Время есть, но его немного для того транспорта, который вы ловите. Узлы ниже показывают, сколько остаётся на каждый.',
  'transports.badge.impossible': {
    one: '{value} сломанная пересадка',
    few: '{value} сломанные пересадки',
    many: '{value} сломанных пересадок',
    other: '{value} сломанной пересадки',
  },
  'transports.badge.tight': {
    one: '{value} тесная пересадка',
    few: '{value} тесные пересадки',
    many: '{value} тесных пересадок',
    other: '{value} тесной пересадки',
  },
  'transports.badge.ok': 'Все пересадки складываются',
  'transports.remove.body':
    'Переезд уходит из этой поездки окончательно, вместе с номером брони и местом. Если он только отменён, поставьте ему статус «Отменён».',
  'transports.remove.confirm': 'Удалить переезд',
  'transports.menu.edit': 'Изменить переезд…',
  'transports.field.service': 'Рейс',
  'transports.field.bookingRef': 'Номер брони',
  'transports.field.seat': 'Место',
  'transports.field.distance': 'Расстояние',
  'transports.noTime': 'Пока без времени',
  'transports.toast.statusFailed.title': 'Статус не изменился',
  'transports.toast.statusFailed.body': 'Переезд остался в прежнем состоянии.',
  'transports.toast.removed': 'Переезд удалён',
  'transports.toast.removeFailed': 'Переезд не удалён',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Добавить переезд',
  'transports.dialog.editTitle': 'Изменить этот переезд',
  'transports.dialog.description':
    'Рейсы, поезда, паромы и дорога из аэропорта. Время местное, то, что напечатано на билете.',
  'transports.form.modeLegend': 'Чем вы едете',
  'transports.form.timingError': 'Проверьте время',
  'transports.field.namePlaceholder': 'Аэрофлот из SVO в HND',
  'transports.field.place': 'Место',
  'transports.field.code': 'Код',
  'transports.field.date': 'Дата',
  'transports.field.time': 'Отправление после',
  'transports.field.departurePlaceholder': 'Москва Шереметьево',
  'transports.field.arrivalPlaceholder': 'Токио Ханэда',
  'transports.field.carrier': 'Перевозчик',
  'transports.field.serviceNumber': 'Номер рейса',
  'transports.field.bookingRefHint': 'Код, который вы назовёте на стойке.',
  'transports.field.notesPlaceholder':
    'Просили место у прохода. Багаж оформлен до Киото.',
  'transports.action.add': 'Добавить переезд',
  'transports.action.save': 'Сохранить переезд',
  'transports.action.saving': 'Сохранение переезда',
  'transports.toast.added': 'Переезд добавлен',
  'transports.toast.addedBody': 'Он уже в порядке поездки.',
  'transports.toast.addFailed': 'Переезд не добавлен',
  'transports.toast.updated': 'Переезд изменён',
  'transports.toast.updateFailed': 'Переезд не изменён',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Название',
  'field.time': 'Время',
  'field.price': 'Цена',
  'field.notes': 'Заметки',
  'field.status': 'Статус',
  'form.saveError': 'Это не сохранилось',
  'action.cancel': 'Отмена',
  'action.showCode': 'Показать {label}',
  'book.status.none': 'Без статуса',
  'book.status.pending': 'Ожидает',
  'book.status.confirmed': 'Подтверждена',
  'book.status.completed': 'Завершена',
  'book.status.cancelled': 'Отменена',
  'book.toast.statusFailed': 'Статус не изменился',
  'book.toast.statusFailedBody': 'Бронь осталась в прежнем состоянии.',
  'book.toast.removed': 'Бронь удалена',
  'book.toast.removeFailed': 'Бронь не удалена',
  'book.empty.title': 'Пока ничего не забронировано',
  'book.empty.body':
    'Жильё, столики, экскурсии и билеты — здесь, вместе с номером подтверждения там, где вы найдёте его у входа, и датой, которая ставит их на шкалу.',
  'book.empty.action': 'Добавить первую бронь',
  'book.filtered.title': 'Пока ничего такого',
  'book.filtered.body':
    'Из выбранных видов здесь ничего не забронировано. Снимите фильтр, чтобы увидеть остальное.',
  'book.filtered.action': 'Снять фильтр',
  'book.panel.outstanding': 'Ещё уладить',
  'book.panel.outstandingEmpty': 'Ничего не осталось — здесь всё улажено.',
  'book.panel.settled': 'Улажено',
  'book.panel.settledEmpty':
    'Пока ничего не улажено — всё ещё предстоит добиться.',
  'book.import.badge': 'Непроверенный импорт',
  'book.import.hint':
    'Взято из подтверждения. Откройте и сохраните, чтобы отметить проверенным.',
  'book.import.action': 'Импорт',
  'book.import.title': 'Импорт броней из файла',
  'book.import.description':
    'Положи сюда подтверждение, и мы его прочитаем. В поездку ничего не попадёт, пока ты сам не посмотришь.',
  'book.import.drop.idle': 'Положи файлы сюда или выбери их',
  'book.import.drop.active': 'Отпусти, чтобы добавить',
  'book.import.drop.formats':
    'PDF, сохранённое письмо, веб-страница, фото, Word, Excel, файл календаря или выгрузка JSON.',
  'book.import.drop.limits': 'До {files} файлов за раз, каждый до {size}.',
  'book.import.drop.browse': 'Выбрать файлы',
  'book.import.refused.format':
    '«{filename}» — не тот файл, который этот импорт умеет читать. Он читает PDF, сохранённое письмо, веб-страницу, фото, документ Word или Excel, файл календаря или выгрузку JSON.',
  'book.import.refused.tooMany':
    'Только {files} файлов за раз. Остальные не добавлены.',
  'book.import.refused.tooLarge':
    '«{filename}» весит {size}. Импорт читает файлы до {limit}.',
  'book.import.refused.empty': '«{filename}» пуст, читать нечего.',
  'book.import.ceiling.title':
    'Это рабочее пространство прочитало все свои подтверждения за этот месяц',
  'book.import.ceiling.body':
    'В тариф входит {ceiling} прочтений файлов в месяц, запас обновляется первого числа. Бронь по-прежнему можно добавить вручную.',
  'book.import.ceiling.none':
    'Чтение файла с подтверждением не входит в тариф этого рабочего пространства',
  'book.import.ceiling.noneBody':
    'Перейди на тариф выше, и подтверждение прочитают за тебя. Добавить бронь вручную можно всегда.',
  'book.import.widget.title': 'Читаем подтверждения',
  'book.import.widget.working': 'Прочитано {done} из {total}',
  'book.import.widget.file': 'Читаем «{filename}»',
  'book.import.widget.done': {
    one: 'Одна бронь готова к проверке',
    few: '{count} брони готовы к проверке',
    many: '{count} броней готовы к проверке',
    other: '{count} броней готовы к проверке',
  },
  'book.import.widget.review': 'Проверить',
  'book.import.widget.failed': '«{filename}» прочитать не удалось',
  'book.import.widget.stalled': 'Это занимает больше времени, чем мы ждали',
  'book.import.widget.check': 'Проверить снова',
  'book.import.widget.dismiss': 'Скрыть',
  'book.import.review.title': 'Что мы прочитали',
  'book.import.review.from': 'Из «{filename}»',
  'book.import.review.selectAll': 'Выбрать все',
  'book.import.review.selectNone': 'Снять выбор',
  'book.import.review.confirm': {
    one: 'Добавить {count} бронь',
    few: 'Добавить {count} брони',
    many: 'Добавить {count} броней',
    other: 'Добавить {count} броней',
  },
  'book.import.review.confirmNone': 'Выбери бронь, которую добавить',
  'book.import.review.cancel': 'Отмена',
  'book.import.review.needsReview': 'Стоит взглянуть',
  'book.import.review.needsReviewHint':
    'Части полей в документе не было. Открой бронь после добавления.',
  'book.import.review.noPrice': 'Цена не прочитана',
  'book.import.review.noPriceHint':
    'Документ не называл её внятно, поэтому поле осталось пустым, а не угаданным.',
  'book.import.review.untitled': 'Бронь без названия',
  'book.import.empty.title': 'В этом файле мы не нашли брони',
  'book.import.empty.body':
    'В «{filename}» не было ничего похожего на подтверждение. Попробуй другой файл или добавь бронь вручную.',
  'book.import.failed.title': '«{filename}» прочитать не удалось',
  'book.import.failed.body':
    'Файл открылся, но собрать из него ничего не вышло. Попробуй другой файл или добавь бронь вручную.',
  'book.import.failed.retry': 'Попробовать другой файл',
  'book.import.uploadFailed': '«{filename}» не загрузился',
  'book.import.uploadRetry': 'Попробовать снова',
  'book.import.actionFailed': 'Попробуйте ещё раз чуть позже.',
  'book.import.toast.added': {
    one: 'Добавлена одна бронь',
    few: 'Добавлено {count} брони',
    many: 'Добавлено {count} броней',
    other: 'Добавлено {count} броней',
  },
  'book.import.partial.title': 'Добавлено {written} броней из {total}',
  'book.import.partial.body':
    'Остальные так и выбраны. Повторное добавление запишет только их.',
  'book.import.partial.retry': 'Добавить остальные',
  'book.journeyLink': 'На вкладке транспорта',
  'filter.all': 'Всё',
  'book.remove.body':
    'Она уйдёт со шкалы окончательно. Если она только отменена, поставьте статус «Отменена», чтобы запись осталась.',
  'book.remove.confirm': 'Удалить бронь',
  'book.menu.edit': 'Изменить бронь…',
  'book.menu.open': 'Открыть бронь',
  'book.noDate': 'Пока без даты',
  'book.until': 'До',
  'book.provider': 'Поставщик',
  'book.where': 'Где',
  'book.guests': 'Гости',
  'book.confirmation': 'Подтверждение',
  'book.undated': 'Поставьте им дату — и они встанут на шкалу',
  statusOf: 'Статус: {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Пока без статуса',
  'book.statusChoice.pending': 'Ожидает — ход за ними',
  'book.dialog.addTitle': 'Добавить бронь',
  'book.dialog.editTitle': 'Изменить эту бронь',
  'book.dialog.typeLegend': 'Что за бронь',
  'book.field.namePlaceholder': 'ул. Тверская, 15',
  'book.field.priceHint': 'Оставьте пустым, если ещё не рассчитано.',
  'book.field.confirmation': 'Номер подтверждения',
  'book.field.confirmationHint': 'Код, который спросят на стойке.',
  'book.field.day': 'Привязать ко дню',
  'book.field.dayHint': 'Закрепляет её за маршрутом, и она появится в плане.',
  'book.field.noDay': 'Вне маршрута',
  'book.field.link': 'Ссылка',
  'book.field.notesPlaceholder':
    'Договорились о позднем заезде. Попросить номер подальше от лифта.',
  'book.action.add': 'Добавить бронь',
  'book.action.save': 'Сохранить бронь',
  'book.action.saving': 'Сохранение брони',
  'book.toast.added': 'Бронь добавлена',
  'book.toast.addedBody': 'Она уже на шкале.',
  'book.toast.addFailed': 'Бронь не добавлена',
  'book.toast.updated': 'Бронь изменена',
  'book.toast.updateFailed': 'Бронь не изменена',

  'book.emptyFacts':
    'Кроме названия пока ничего нет. Откройте, чтобы добавить время, цену и номер подтверждения.',
  'book.onItinerary': 'В маршруте: {day}',
  'book.dayNumber': 'День {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Другое',
  'book.field.host': 'Отель или хозяин',
  'book.field.restaurant': 'Название ресторана',
  'book.field.operator': 'Организатор',
  'book.field.issuer': 'Кем выдан',
  'book.field.carrier': 'Перевозчик',
  'book.field.address': 'Адрес',
  'book.field.meetingPoint': 'Место встречи',
  'book.field.venue': 'Место проведения',
  'book.field.fromTo': 'Откуда и куда',
  'book.field.checkIn': 'Заезд',
  'book.field.date': 'Дата',
  'book.field.validOn': 'Действует',
  'book.field.departs': 'Отправление',
  'book.field.checkOut': 'Выезд',
  'book.field.ends': 'Окончание',
  'book.field.arrives': 'Прибытие',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Музей Гибли',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Кто держит это для вас',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 twin-номера',
  'book.example.restaurantTitle': 'Ужин в Den',
  'book.example.activityTitle': 'teamLab Planets, 4 билета',
  'book.example.tourTitle': 'Прогулка по бамбуковой роще Арасияма',
  'book.example.ticketTitle': 'Музей Гибли, вход в 10:00',
  'book.example.transportTitle': 'Nozomi 21 до Киото',
  'book.example.otherTitle': 'Что вы забронировали',
  'book.hint.accommodation':
    'Отель, рёкан, квартира — где угодно, где вы спите.',
  'book.hint.restaurant':
    'Забронированный стол. Держать будут именно за время.',
  'book.hint.activity': 'Занятие, баня, оплаченное впечатление.',
  'book.hint.tour': 'Место, время и гид, который ждёт.',
  'book.hint.ticket':
    'Вход по времени, музейный билет, матч. Держите код под рукой.',
  'book.hint.transport':
    'Забронированное место. Полные переезды с кодами живут в {module}.',
  'book.hint.other': 'Всё, что записано на ваше имя и не подходит к остальным.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Сборы',
  'lists.kind.todo': 'Дела',
  'lists.kind.shopping': 'Покупки',
  'lists.kind.documents': 'Документы',
  'lists.kind.fallback': 'Список',
  'colour.none': 'Без цвета',
  'colour.pine': 'Сосновый',
  'colour.inkBlue': 'Чернильный',
  'colour.amber': 'Янтарный',
  'colour.green': 'Зелёный',
  'colour.red': 'Красный',
  'colour.slate': 'Графит',
  'lists.toast.created': 'Список создан',
  'lists.toast.createdBody': 'Добавьте первое, о чём нельзя забыть.',
  'lists.toast.createFailed': 'Список не создан',
  'lists.toast.updated': 'Список обновлён',
  'lists.toast.updateFailed': 'Список не обновлён',
  'lists.error.weightLimit': 'Предел веса — целое число граммов.',
  'lists.dialog.editTitle': 'Изменить этот список',
  'lists.dialog.editBody':
    'Переименуйте его, смените вид списка или передайте одному человеку.',
  'lists.dialog.addBody':
    'Сборы, дела, покупки и документы, о которых нельзя забыть, — у каждого свой список.',
  'lists.action.new': 'Новый список',
  'lists.field.namePlaceholder': 'Ручная кладь',
  'lists.field.kind': 'Вид',
  'lists.field.kindAria': 'Вид списка',
  'lists.field.owner': 'Принадлежит',
  'lists.field.ownerHint': 'Общие списки отмечает любой.',
  'lists.field.everyone': 'Все в поездке',
  'lists.field.weightLimit': 'Предел веса',
  'lists.field.weightLimitHint':
    'Граммы. Оставьте пустым, если предела держать не нужно.',
  'colour.legend': 'Цвет',
  'lists.action.saving': 'Сохранение списка',
  'lists.action.save': 'Сохранить список',
  'lists.action.create': 'Создать список',
  'lists.item.toast.added': 'Пункт добавлен',
  'lists.item.toast.addFailed': 'Пункт не добавлен',
  'lists.item.toast.updated': 'Пункт обновлён',
  'lists.item.toast.updateFailed': 'Пункт не обновлён',
  'lists.item.error.quantity': 'Количество — целое число от 1 до 999.',
  'lists.item.error.weight': 'Вес — целое число граммов.',
  'lists.item.dialog.editTitle': 'Изменить этот пункт',
  'lists.item.dialog.addTitle': 'Добавить пункт',
  'lists.item.field.label': 'Пункт',
  'lists.item.field.placeholder': 'Паспорт',
  'field.category': 'Категория',
  'lists.item.field.categoryHint':
    'Группирует список под заголовком. Необязательно.',
  'lists.item.field.categoryPlaceholder': 'Документы',
  'lists.item.field.priority': 'Приоритет',
  'lists.priorityChoice.high': 'Высокий — не забыть',
  'lists.priorityChoice.low': 'Низкий — если останется место',
  'lists.priorityChoice.normal': 'Обычный',
  'lists.item.field.quantity': 'Количество',
  'lists.item.field.weight': 'Вес',
  'lists.item.field.weightHint': 'Граммы, за штуку.',
  'lists.item.field.owner': 'Чья это задача',
  'lists.item.owner.nobody': 'Никто конкретно',
  'lists.item.action.saving': 'Сохранение пункта',
  'lists.item.action.save': 'Сохранить пункт',
  'lists.item.action.add': 'Добавить в список',
  'lists.template.loadError': 'Шаблоны сейчас не удалось загрузить.',
  'lists.template.toast.added': 'Список добавлен из шаблона',
  'lists.template.toast.addFailed': 'Шаблон не применён',
  'lists.template.error.apply': 'Это не удалось применить',
  'lists.template.error.load': 'Шаблоны не загрузились',
  'lists.template.empty.title': 'Пока нет шаблонов',
  'lists.template.empty.body':
    'Сохраните список как шаблон, когда получится такой, который вы собрали бы снова, — он появится здесь для каждой будущей поездки.',
  'lists.template.applying': 'Применение шаблона',
  'lists.template.dialogTitle': 'Начать с шаблона',
  'lists.template.loading': 'Загрузка шаблонов',
  'lists.template.apply': 'Применить шаблон',
  'lists.template.from': 'Из шаблона',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Без назначения',
  'lists.toast.listRemoved': 'Список удалён',
  'lists.toast.listRemoveFailed': 'Список не удалён',
  'lists.toast.itemRemoved': 'Пункт удалён',
  'lists.toast.itemRemoveFailed': 'Пункт не удалён',
  'lists.toast.reset': 'Список сброшен',
  'lists.toast.resetBody':
    'Все отметки сняты, список готов к следующей поездке.',
  'lists.toast.resetFailed': 'Список не сброшен',
  'lists.toast.tickFailed': 'Отметка не сохранилась',
  'lists.toast.tickFailedBody': 'Пункт вернулся к прежнему виду.',
  'lists.toast.assignFailed': 'Назначение не сохранилось',
  'lists.toast.orderFailed': 'Новый порядок не сохранился',
  'lists.toast.orderFailedBody': 'Список вернулся к прежнему виду.',
  'lists.filter.todo': 'Ещё осталось',
  'lists.filter.done': 'Готово',
  'lists.scope.all': 'Все списки',
  'lists.scope.shared': 'Общие',
  'lists.scope.mine': 'Мои',
  'lists.empty.mine.title': 'Своих списков пока нет',
  'lists.empty.shared.title': 'Общих списков пока нет',
  'lists.empty.mine.body':
    'Свой список отмечаете только вы — удобно для того, что больше никому видеть не нужно.',
  'lists.empty.shared.body':
    'Общий список отмечает любой, и двое не положат один и тот же переходник.',
  'lists.remove.list': 'Удалить список',
  'lists.remove.item': 'Удалить пункт',
  'lists.remove.itemBody':
    'Он уйдёт из этого списка. Больше ничего не изменится.',
  'lists.menu.editList': 'Изменить список…',
  'lists.menu.tickAll': 'Отметить всё',
  'lists.menu.untickAll': 'Снять все отметки',
  'lists.menu.reset': 'Сбросить к следующей поездке',
  'lists.menu.dragOrderLong': 'Перейти к порядку, который можно перетаскивать',
  'lists.menu.groupAgain': 'Снова группировать по категориям',
  'lists.menu.dragOrder': 'Перейти к перетаскиваемому порядку',
  'lists.menu.groupByCategory': 'Группировать по категориям',
  'lists.weight.packed': 'Уложено {weight}',
  'lists.weight.packedOver': 'Уложено {weight} — сверх предела',
  'lists.weight.packedOf': 'Уложено {weight} из {limit} разрешённых',
  'lists.weight.packedOfOver':
    'Уложено {weight} из {limit} разрешённых — сверх предела',
  'lists.progress.ticked': 'Отмечено {done} из {total}',
  'lists.items.empty.title': 'Этот список пуст',
  'lists.items.empty.body':
    'Добавьте первое, о чём нельзя забыть, — быстрее всего через поле ниже.',
  'lists.items.doneEmpty.title': 'Пока ничего не отмечено',
  'lists.items.doneEmpty.body': 'Отметьте что-нибудь, и оно появится здесь.',
  'lists.items.todoEmpty.title': 'Здесь всё сделано',
  'lists.items.todoEmpty.body':
    'Каждый пункт этого списка отмечен. Переключитесь на «{label}», чтобы их увидеть.',
  'lists.category.other': 'Всё остальное',
  'lists.dnd.fallbackName': 'этот пункт',
  'lists.dnd.picked': 'Взято: {name}.',
  'lists.dnd.dropped': 'Отпущено: {name}. Новый порядок сохраняется.',
  'lists.dnd.cancelled': 'Отменено. Порядок не изменился.',
  'lists.menu.editItem': 'Изменить пункт…',
  'lists.quickAdd.placeholder': 'Впишите пункт и нажмите Enter',
  'lists.quickAdd.aria': 'Добавить пункт в этот список',
  'lists.quickAdd.detailsHint': 'Добавить с весом, категорией или человеком',
  'lists.quickAdd.detailsAria': 'Добавить пункт со всеми подробностями',
  'lists.show': 'Показать',
  'lists.priority.high': 'Высокий',
  'lists.action.add': 'Добавить',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} пункт',
    few: '{count} пункта',
    many: '{count} пунктов',
    other: '{count} пункта',
  },
  'lists.template.copiedIn': {
    one: 'Скопирован {count} пункт, готовый к отметке.',
    few: 'Скопировано {count} пункта, готовых к отметке.',
    many: 'Скопировано {count} пунктов, готовых к отметке.',
    other: 'Скопировано {count} пункта, готовых к отметке.',
  },
  'lists.remove.listBody': {
    one: 'Список и его {count} пункт уйдут из этой поездки. Сохранённые шаблоны не тронуты.',
    few: 'Список и его {count} пункта уйдут из этой поездки. Сохранённые шаблоны не тронуты.',
    many: 'Список и его {count} пунктов уйдут из этой поездки. Сохранённые шаблоны не тронуты.',
    other:
      'Список и его {count} пункта уйдут из этой поездки. Сохранённые шаблоны не тронуты.',
  },

  'lists.item.dialog.body':
    'Всё, кроме названия, необязательно: вес делает общий вес сборов настоящим, а категория группирует список.',
  'lists.template.dialogBody':
    'Шаблон — это список, который вы уже сохранили. Применение копирует его как новый список в этой поездке; исходный остаётся нетронутым.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Удалить «{name}»?',
  actionsFor: 'Действия для: {name}',
  'lists.dnd.reorder': 'Изменить порядок: {name}',
  'lists.action.untickItem': 'Снять отметку: {name}',
  'lists.action.tickOffItem': 'Отметить: {name}',
  'lists.item.assignAria': 'Назначить {name} кому-нибудь',
  'lists.item.reassignAria': '{item} — это на {owner}; переназначить',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Дайте этой брони название, которое узнаете в списке.',
  'error.titleLong': 'Название должно быть короче 160 символов.',
  'book.error.required': 'Этой брони не хватает: {field}.',
  'book.error.timeNeedsDate': 'Времени нужен день, на который оно приходится.',
  'book.error.endTimeNeedsDate':
    'Времени окончания нужен день, на который оно приходится.',
  'book.error.endsBeforeStart': 'Это заканчивается раньше, чем начинается.',
  'book.fieldName.checkInDay': 'день заезда',
  'book.fieldName.checkOutDay': 'день выезда',
  'book.stay.pickDay': 'Выберите день',
  'book.stay.nights': {
    one: '{count} ночь',
    few: '{count} ночи',
    many: '{count} ночей',
    other: '{count} ночи',
  },
  'book.stay.range': 'с {from} по {to}',
  'book.stay.label': 'Проживание',
  'book.remove.keepsNights': 'Ночи остаются в поездке. Удаляется только бронь.',
  'book.menu.removeWithStay': 'Удалить бронь и проживание',
  'book.removeStay.body': 'Удаляются и бронь, и ночи, за которые она платит.',
  'book.toast.stayRemoved': 'Бронь и проживание удалены',
  'book.error.endTimeBeforeStart': 'Время окончания раньше времени начала.',
  'book.error.guests': 'Число человек должно быть целым, не больше 1000.',
  'error.price': 'Эту сумму мы прочитать не можем.',
  'book.error.url': 'Ссылка должна начинаться с http:// или https://.',
  'book.error.confirmationLong':
    'Этот номер подтверждения слишком длинный, чтобы его сохранить.',
  'book.error.stopGone': 'Этой остановки больше нет в поездке.',
  'book.ledger.unlinked':
    'Строка расходов этой брони останется в расходах поездки, но перестанет быть с ней связана.',
  'book.ledger.updated': 'Строка расходов этой брони изменится на {money}.',
  'book.ledger.needsDate':
    'Укажите дату брони, и её стоимость попадёт в расходы поездки.',
  'book.ledger.added': 'В расходы поездки будет добавлена строка на {money}.',
  'book.fieldName.provider': 'перевозчик',
  'book.fieldName.location': 'место',
  'book.fieldName.confirmationNumber': 'номер подтверждения',
  'book.fieldName.link': 'ссылка',
  'book.fieldName.date': 'дата',
  'book.fieldName.time': 'время',
  'book.fieldName.endDate': 'дата окончания',
  'book.fieldName.endTime': 'время окончания',
  'book.fieldName.guests': 'число человек',
  'book.fieldName.price': 'цена',
  'book.fieldName.stop': 'остановка',
  'book.field.stop': 'Связанная остановка',
  'book.field.stopHint': 'К какой остановке плана относится эта бронь.',
  'book.field.stopHintEmpty':
    'Сначала добавьте место в какой-нибудь день, тогда бронь можно будет к нему привязать',
  'book.field.stopPlaceholder': 'Без остановки',
  'book.field.stopSearch': 'Поиск по остановкам и дням',
  'book.field.stopEmpty': 'Ни одна остановка не подходит',
  'book.ledger.refused.title': 'Сохранено, но в расходы не добавлено',
  'book.ledger.refused.body':
    'Бронь уже в поездке. Добавить её строку в расходы поездки не удалось — повторите эту половину.',
  'book.action.ledgerRetry': 'Добавить в расходы',
  'book.ledger.splitStale.title': 'Сохранено, но разделение больше не сходится',
  'book.ledger.splitStale.body':
    'Бронирование и его новая цена сохранены, но разделение этого расхода не смогло подстроиться под новую сумму. Откройте расход в разделе «Расходы» и исправьте разделение.',
  'book.action.done': 'Готово',
  'book.copyConfirmation': 'номер подтверждения для {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Полёт',
  'transports.mode.train': 'Поезд',
  'transports.mode.bus': 'Автобус',
  'transports.mode.ferry': 'Паром',
  'transports.mode.car': 'Машина',
  'transports.mode.taxi': 'Такси',
  'transports.mode.transit': 'Транспорт',
  'transports.mode.metro': 'Метро',
  'transports.mode.tram': 'Трамвай',
  'transports.mode.bike': 'Велосипед',
  'transports.mode.walk': 'Пешком',
  'transports.mode.other': 'Другое',
  'transports.mode.fallback': 'Переезд',
  'transports.rank.earliest': 'Раньше прибытие',
  'transports.rank.fewestChanges': 'Меньше пересадок',
  'transports.connection.findStop': 'Найдите остановку',
  'transports.connection.findStopSearch': 'SVO, Курская, Москва…',
  'transports.connection.findStopEmpty':
    'Остановки с таким названием в каталоге нет.',
  'transports.connection.hideStops': 'Скрыть остановки',
  'transports.connection.seeStops': 'Показать остановки',
  'transports.connection.saving': 'Сохраняем маршрут',
  'transports.connection.use': 'Взять этот',
  'transports.connection.onFoot': 'Пешком',
  'transports.connection.service': 'Рейс',
  'transports.connection.direct': 'напрямую',
  'transports.connection.changes': {
    one: '{changes} пересадка',
    few: '{changes} пересадки',
    many: '{changes} пересадок',
    other: '{changes} пересадки',
  },
  'transports.connection.tooLong':
    'В этом маршруте больше {max} участков — больше, чем вмещает одна запись поездки. Найдите участок покороче, остальное запишите отдельно.',
  'transports.connection.refusal.ceiling': 'В этом месяце поисков не осталось',
  'transports.connection.refusal.unconfigured':
    'Поиск маршрутов выключен на этом развёртывании',
  'transports.connection.refusal.provider': 'Служба расписаний не ответила',
  'transports.connection.refusal.plan': 'Поиск маршрутов не входит в этот план',
  'transports.connection.refusal.planBody':
    'Перейдите на другой план, чтобы искать расписания прямо из поездки. Маршрут всегда можно записать вручную.',
  'transports.connection.refusal.ceilingBody':
    'Месячный лимит {ceiling} исчерпан, он обновится первого числа следующего месяца. Маршрут всегда можно записать вручную.',
  'transports.connection.refusal.unconfiguredBody':
    'Здесь не настроена служба расписаний, поэтому ничего не искали. Запишите маршрут вручную.',
  'transports.connection.refusal.providerBody':
    'Не вернулось ничего, что можно показать. Попробуйте через мгновение или запишите маршрут вручную.',
  'transports.connection.invitation':
    'Две остановки и дата — расписание ответит. Ничего не сохраняется, пока вы не выберете.',
  'transports.connection.empty':
    'Между этими двумя остановками на эту дату маршрут не найден. Попробуйте соседнюю станцию или расширьте фильтр.',
  'transports.connection.credit': 'Данные расписания от',
  'transports.connection.searchFailed': 'Поиск не выполнился',
  'transports.connection.searchFailedBody':
    'Попробуйте ещё раз через мгновение.',
  'transports.connection.saved': 'Маршрут сохранён',
  'transports.connection.replaced': 'Маршрут заменён',
  'transports.connection.replacedBody': 'Код брони и место остались прежними.',
  'transports.connection.saveFailed': 'Маршрут не сохранён',
  'transports.connection.saveError': 'Это не сохранилось',
  'transports.connection.fromHint':
    'Выберите остановку — расписание спрашивают где, а не как это называется.',
  'transports.connection.toHint': 'Выберите остановку из каталога.',
  'transports.connection.timeHint':
    'Расписание отвечает ближайшими рейсами, и это решает, какими именно.',
  'transports.connection.onlyModes': 'Только эти виды',
  'transports.connection.searching': 'Ищем в расписании',
  'transports.connection.search': 'Искать маршруты',
  'transports.connection.title': 'Из {from} в {to}',
  'transports.status.idea': 'Замысел',
  'transports.status.pending': 'Ожидает',
  'transports.status.confirmed': 'Подтверждён',
  'transports.status.completed': 'Завершён',
  'transports.status.cancelled': 'Отменён',
  'transports.end.fromAirport': 'Из аэропорта',
  'transports.end.toAirport': 'В аэропорт',
  'transports.end.fromPort': 'Из порта',
  'transports.end.toPort': 'В порт',
  'transports.end.fromStation': 'Со станции',
  'transports.end.toStation': 'До станции',
  'transports.end.from': 'Откуда',
  'transports.end.to': 'Куда',
  'transports.end.pickUp': 'Получение',
  'transports.end.dropOff': 'Возврат',
  'transports.end.departureDay': 'День отправления',
  'transports.end.arrivalDay': 'День прибытия',
  'transports.end.pickUpDay': 'День получения',
  'transports.end.returnDay': 'День возврата',
  'transports.dayNumber': 'День {n}',
  'transports.error.titleEmpty':
    'Дайте этому переезду название, которое узнаете в списке.',
  'transports.error.date': 'Дата пишется ГГГГ-ММ-ДД.',
  'transports.error.time': 'Время пишется ЧЧ:ММ в 24-часовом формате.',
  'transports.error.departureNeedsDate':
    'Времени отправления нужен день, на который оно приходится.',
  'transports.error.arrivalNeedsDate':
    'Времени прибытия нужен день, на который оно приходится.',
  'transports.error.code': 'Код — от 2 до 8 букв или цифр.',
  'transports.error.distance': 'Расстояние — число километров, до 100 000.',
  'transports.error.arrivesBeforeDeparts':
    'Этот переезд прибывает раньше, чем отправляется.',
  'transports.error.timingHint':
    'Сдвиньте одно из времён, чтобы на этот переезд реально можно было успеть.',
  'transports.error.arrivalDayBeforeDeparture':
    'День прибытия наступает раньше дня отправления.',
  'transports.error.returnDayBeforePickUp':
    'День возврата наступает раньше дня получения.',
  'transports.field.noDay': 'Пока без дня',
  'transports.fill.legend': 'Как это заполнить',
  'transports.fill.manual': 'Ввести самому',
  'transports.fill.searchAgain': 'Искать снова',
  'transports.fill.search': 'Искать рейсы',
  'transports.chain.unsplit': 'Снова сделать одной поездкой',
  'transports.field.arrivalDayHint':
    'Поездка, которая прибывает следующим утром, говорит об этом здесь.',
  'transports.chain.splitHint':
    'Пересадка по пути? Запишите каждую часть со своим номером рейса, платформой, местом и временем.',
  'transports.chain.split': 'Разбить на участки',
  'transports.chain.stopNumber': 'остановка {n}',
  'transports.chain.change': 'Пересадка {n}',
  'transports.chain.removeStation': 'Удалить {label}',
  'transports.chain.findStation': 'Найдите аэропорт или вокзал',
  'transports.chain.findStationFor': 'Найдите аэропорт или вокзал для {label}',
  'transports.chain.findPlaceholder': 'SVO, Шереметьево, Москва…',
  'transports.chain.findEmpty': 'Совпадений нет — впишите остановку ниже сами.',
  'transports.chain.stopLabel': 'Остановка',
  'transports.chain.stopPlaceholder': 'Москва Курская',
  'transports.chain.timezoneHint': 'По каким часам идёт эта остановка',
  'transports.chain.timezoneAt': 'Часовой пояс в {label}',
  'transports.chain.timezonePlaceholder': 'Не указан',
  'transports.chain.timezoneSearch': 'Токио, Лиссабон, UTC…',
  'transports.chain.acrossClocks': '{gap} между двумя часами',
  'transports.chain.addStopAfter': 'Добавить остановку после {label}',
  'transports.chain.servicePlaceholder': 'Сапсан 754',
  'transports.chain.leaves': 'Отправление из {label}',
  'transports.chain.reaches': 'Прибытие в {label}',
  'transports.chain.dayOfLeg': '{label} участка {n}',
  'transports.chain.formError': 'Эту цепочку сохранить нельзя',
  'transports.chain.atCap':
    'В цепочку входит не больше {max} участков — это предел того, что несёт одно сохранение, а не того, сколько пересадок бывает в поездке.',
  'transports.chain.hint':
    'Добавьте остановку на любом участке, чтобы записать пересадку; каждый участок хранит свой номер поезда, платформу и место.',
  'transports.field.timezone': 'Часовой пояс',
  'transports.field.platform': 'Платформа',
  'transports.chain.legNumber': 'Участок {n}',
  'transports.chain.platform': 'Платформа {value}',
  'transports.chain.seat': 'Место {value}',
  'transports.chain.error.stopName':
    'У каждой остановки должно быть название — здесь вы пересаживаетесь.',
  'transports.chain.error.stopNameLong':
    'Название остановки должно быть короче 200 символов.',
  'transports.chain.error.timezone': 'Выберите часовой пояс из списка.',
  'transports.chain.error.tooManyLegs':
    'Цепочка вмещает не более {max} участков.',
  'transports.bookingRefFor': 'номер брони для {title}',
  'transports.doorToDoor': 'Это {gap} от двери до двери.',
  'transports.title.fromTo': '{operator}: {from} — {to}',
  'transports.title.from': '{operator} из {from}',
  'transports.title.to': '{operator} до {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Нечего сравнивать',
  'transports.junction.unknown.detail':
    'Укажите дату и время в обоих переездах, и эта пересадка будет проверена.',
  'transports.junction.impossible.headline':
    'Отправляется на {gap} раньше, чем прибывает предыдущий переезд',
  'transports.junction.impossible.detail':
    '«{to}» отправляется раньше, чем прибывает «{from}», так что оба не успеть. Сдвиньте один.',
  'transports.junction.tight.headline': '{gap} на пересадку',
  'transports.junction.tight.detail':
    'На {mode} обычно нужно около {required}. Здесь впритык.',
  'transports.junction.tight.detailAt':
    'На {mode} в {place} обычно нужно около {required}. Здесь впритык.',
  'transports.junction.ok.headline': '{gap} между ними',
  'transports.junction.ok.detail':
    'Прибытие в {landing}, но следующий переезд отправляется из {boarding} — придётся перебраться.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Заметка опубликована',
  'collab.note.toast.sharedBody': 'Все в поездке её видят.',
  'collab.note.toast.shareFailed': 'Заметка не опубликована',
  'collab.note.toast.updated': 'Заметка обновлена',
  'collab.note.toast.updateFailed': 'Заметка не обновлена',
  'collab.note.dialog.editTitle': 'Изменить эту заметку',
  'collab.note.dialog.addTitle': 'Новая общая заметка',
  'collab.note.dialog.body':
    'Советы по ресторанам, визовые правила, код от двери — всё, что должна помнить вся поездка, в одном месте.',
  'collab.note.field.title': 'Заголовок',
  'collab.note.field.titlePlaceholder': 'Код от двери',
  'collab.note.field.body': 'Заметка',
  'collab.note.field.bodyPlaceholder':
    '4821, потом решётка. Ключница слева от двери.',
  'collab.note.field.categoryHint':
    'Группирует доску под фильтром. Необязательно.',
  'collab.note.field.categoryPlaceholder': 'Логистика',
  'collab.note.field.pin': 'Закрепить наверху доски',
  'collab.note.field.pinHint':
    'Закреплённые заметки идут первыми, что бы ни добавили.',
  'collab.note.action.saving': 'Сохранение заметки',
  'collab.note.action.save': 'Сохранить заметку',
  'collab.note.action.share': 'Опубликовать заметку',
  'collab.poll.toast.opened': 'Голосование открыто',
  'collab.poll.toast.openedBody': 'Все в поездке могут голосовать.',
  'collab.poll.toast.openFailed': 'Голосование не открыто',
  'collab.poll.dialog.addTitle': 'Новое голосование',
  'collab.poll.field.question': 'Вопрос',
  'collab.poll.field.questionPlaceholder': 'Где ужинаем в последний вечер?',
  'collab.poll.field.optionsLegend': 'Варианты',
  'collab.poll.field.option': 'Вариант {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Ещё один вариант',
  'collab.poll.action.addOption': 'Добавить вариант',
  'collab.poll.action.removeOption': 'Удалить вариант {n}',
  'collab.poll.field.multi': 'Разрешить выбирать несколько',
  'collab.poll.field.multiHint':
    'Выключено — один голос на человека, и передумав, вы его переносите.',
  'collab.poll.action.opening': 'Открытие голосования',
  'collab.poll.action.open': 'Открыть голосование',
  'collab.poll.error.tooFew':
    'Голосованию нужно хотя бы два варианта на выбор.',
  'collab.poll.error.duplicate':
    'Два варианта говорят одно и то же. Дайте каждому своё звучание.',
  'collab.presence.viewingNow': 'смотрят сейчас',
  'collab.presence.unnamed': 'Участник без имени',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} открытая вкладка',
    few: '{name} — {count} открытые вкладки',
    many: '{name} — {count} открытых вкладок',
    other: '{name} — {count} открытой вкладки',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Согласен',
  'collab.reaction.love': 'Нравится',
  'collab.reaction.funny': 'Смешно',
  'collab.reaction.celebrate': 'Празднуем',
  'collab.reaction.thanks': 'Спасибо',
  'collab.reaction.looking': 'Смотрю',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, включая вас',
  'collab.thread.today': 'Сегодня',
  'collab.thread.emptyBody':
    'Все участники этой поездки общаются в одной ветке. Принятые здесь решения остаются с поездкой, а не теряются в групповых чатах.',
  /** Invitation to write the first message of an empty conversation, not a command. */
  'collab.thread.empty': 'Начни разговор',
  'collab.thread.loadOlder': 'Загрузить более ранние сообщения',
  'collab.thread.loadingOlder': 'Загрузка более ранних сообщений',
  'collab.thread.loadOlderFailed':
    'Не удалось загрузить более ранние сообщения',
  'collab.thread.retry': 'Попробовать снова',
  'collab.thread.start': 'Здесь начинается переписка',
  'collab.toast.reactionFailed': 'Реакция не сохранилась',
  'collab.toast.messageDeleted': 'Сообщение удалено',
  'collab.toast.deleteFailed': 'Сообщение не удалено',
  'collab.toast.notSent': 'Не отправлено',
  'collab.toast.notSentBody':
    'Сообщение не удалось отправить. Попробуйте через минуту.',
  'collab.toast.messageUpdated': 'Сообщение изменено',
  'collab.toast.editFailed': 'Правка не сохранилась',
  'collab.message.deleteTitle': 'Удалить это сообщение?',
  'collab.message.deleteBody':
    'Текст исчезает из ветки. Ответы на него остаются на месте.',
  'collab.message.delete': 'Удалить сообщение',
  'collab.message.reply': 'Ответить',
  'collab.message.menuEdit': 'Изменить сообщение…',
  'collab.message.react': 'Отреагировать на это сообщение',
  'collab.message.edited': 'изменено',
  'collab.message.actionsFor': 'Действия для сообщения от: {name}',
  'collab.compose.editingYours': 'Вы правите своё сообщение',
  'collab.compose.replyingTo': 'Ответ: {name}',
  'collab.compose.cancelReply': 'Отменить ответ',
  'collab.compose.cancelEdit': 'Отменить правку',
  'collab.compose.placeholder': 'Написать поездке',
  'collab.compose.placeholderText': 'Напишите что-нибудь группе…',
  'collab.compose.editPlaceholder': 'Изменить своё сообщение',
  'collab.compose.editPlaceholderText': 'Измените то, что написали…',
  'collab.compose.send': 'Отправить сообщение',
  'collab.compose.savingEdit': 'Сохранение правки',
  'collab.compose.save': 'Сохранить',
  /** Textarea description for a fine pointer; input-method composition never sends. */
  'collab.compose.keysHint':
    'Нажми Enter для отправки, Shift и Enter для новой строки.',
  /** Added to the textarea description only while replying or editing. */
  'collab.compose.keysHintEsc': 'Нажми Escape для отмены.',
  /** Textarea description on a coarse pointer; Enter adds a line. */
  'collab.compose.keysHintTouch':
    'Используй кнопку отправки, чтобы отправить сообщение.',
  /** Button retries the failed send or edit using the text currently in the field. */
  'collab.compose.retry': 'Попробовать снова',
  /** Fixed failed-edit body, also used as the edit toast fallback; never server diagnostics. */
  'collab.toast.editFailedBody':
    'Твои изменения остались в поле ввода. Проверь соединение и попробуй снова.',
  'collab.hint.sends': 'отправляет',
  'collab.hint.addsLine': 'добавляет строку',
  'collab.hint.cancels': 'отменяет',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Заметка удалена',
  'collab.toast.noteRemoveFailed': 'Заметка не удалена',
  'collab.notes.empty.title': 'Общих заметок нет',
  'collab.notes.empty.body':
    'Советы по ресторанам, визовые правила, код от двери — всё, что должна помнить вся поездка.',
  'collab.notes.empty.action': 'Напишите первую заметку',
  'collab.note.menu.edit': 'Изменить заметку…',
  'collab.note.menu.unpin': 'Открепить',
  'collab.note.menu.pin': 'Закрепить наверху',
  'collab.note.remove': 'Удалить заметку',
  'collab.note.removeBody': 'Заметка уйдёт с доски у всех в поездке.',
  'collab.note.new': 'Новая заметка',
  'collab.poll.toast.voteFailed': 'Ваш голос не сохранился',
  'collab.poll.toast.voteFailedBody': 'Подсчёт не изменился.',
  'collab.poll.toast.closed': 'Голосование закрыто',
  'collab.poll.toast.closeFailed': 'Голосование не закрыто',
  'collab.poll.toast.removed': 'Голосование удалено',
  'collab.poll.toast.removeFailed': 'Голосование не удалено',
  'collab.polls.heading': 'Голосования',
  'collab.polls.empty.title': 'Открытых голосований нет',
  'collab.polls.empty.body':
    'Когда группа не может договориться о ресторане, поставьте вопрос на голосование и дайте ответу решиться сам.',
  'collab.polls.empty.action': 'Спросить у всех',
  'collab.poll.menu.close': 'Закрыть голосование',
  'collab.poll.remove': 'Удалить голосование',
  'collab.poll.removeTitle': 'Удалить это голосование?',
  'collab.poll.actionsFor': 'Действия для голосования «{question}»',
  'collab.badge.pinned': 'Закреплена',
  'collab.badge.closed': 'Закрыто',
  'collab.badge.open': 'Открыто',
  'collab.badge.multi': 'Выбор нескольких',
  'collab.badge.leading': 'Впереди',
  'collab.poll.removeBody': {
    one: '«{question}» и его {count} голос исчезнут у всех.',
    few: '«{question}» и его {count} голоса исчезнут у всех.',
    many: '«{question}» и его {count} голосов исчезнут у всех.',
    other: '«{question}» и его {count} голоса исчезнут у всех.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} из {count} голоса',
    few: '{label} — {votes} из {count} голосов',
    many: '{label} — {votes} из {count} голосов',
    other: '{label} — {votes} из {count} голоса',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} из {count} голоса, включая ваш',
    few: '{label} — {votes} из {count} голосов, включая ваш',
    many: '{label} — {votes} из {count} голосов, включая ваш',
    other: '{label} — {votes} из {count} голоса, включая ваш',
  },
  'collab.poll.voteCount': {
    one: '{count} голос',
    few: '{count} голоса',
    many: '{count} голосов',
    other: '{count} голоса',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Документ',
  'files.kind.photo': 'Фото',
  'files.kind.ticket': 'Билет',
  'files.kind.receipt': 'Чек',
  'files.kind.map': 'Карта',
  'files.kind.other': 'Другое',
  'files.kindChoice.ticket': 'Билет или пропуск',
  'files.kindChoice.map': 'Карта или маршрут',
  'files.toast.removed': 'Файл удалён',
  'files.toast.removeFailed': 'Файл не удалён',
  'files.toast.downloadFailed': 'Загрузка не началась',
  'files.toast.gone': 'Этот файл больше недоступен в этой вкладке.',
  'files.toast.uploadFailed': 'Отправка не удалась. Попробуйте ещё раз.',
  'files.toast.updated': 'Файл обновлён',
  'files.toast.updateFailed': 'Файл не обновлён',
  'files.storage.full': 'В этом рабочем пространстве закончилось место',
  'files.storage.used':
    'Занято {used} из {limit}. Удалите файл ниже или перейдите на тариф выше, прежде чем добавлять что-то ещё.',
  'files.storage.perFile': 'до {size} каждый',
  'files.action.add': 'Добавить файлы',
  'files.action.choose': 'Выбрать файлы',
  'files.action.upload': 'Отправить файлы',
  'files.calendar.live.action': 'Обновляемая ссылка на календарь',
  'files.calendar.live.title': 'Обновляемая ссылка на календарь',
  'files.calendar.warning':
    'Любой обладатель ссылки может без аккаунта читать места, время, адреса и заметки этой поездки. Берегите её как пароль.',
  'files.calendar.enable.action': 'Создать ссылку',
  'files.calendar.link.once':
    'Скопируйте её сейчас - мы показываем её только один раз. Если потеряете, создайте новую ссылку; старая перестанет работать.',
  'files.calendar.link.address': 'Адрес ссылки',
  'files.calendar.link.copy': 'Копировать ссылку',
  'files.calendar.link.copied': 'Ссылка скопирована',
  'files.calendar.link.copyFailed':
    'Не удалось скопировать. Выделите адрес и скопируйте его вручную.',
  'files.calendar.link.open': 'Открыть в приложении календаря',
  'files.calendar.link.google': 'Добавить в Google Календарь',
  'files.calendar.link.outlook': 'Добавить в Outlook',
  'files.calendar.link.done': 'Готово',
  'files.calendar.link.stays':
    'Номера подтверждений, цены и файлы остаются в planned.travel.',
  'files.calendar.freshness':
    'Приложениям календаря может понадобиться несколько часов, иногда больше, чтобы показать изменение.',
  'files.calendar.state.on': 'Ссылка на календарь включена',
  'files.calendar.state.lastFetched':
    'Календарь последний раз проверил эту ссылку {when}',
  'files.calendar.state.neverFetched': 'Ещё не загружалось',
  'files.calendar.rotate.action': 'Создать новую ссылку',
  'files.calendar.rotate.confirmTitle': 'Создать новую ссылку?',
  'files.calendar.rotate.confirmBody':
    'Старая ссылка сразу перестанет работать. Календари, которые её используют, перестанут обновляться, пока вы не укажете в них новую ссылку.',
  'files.calendar.rotate.busy': 'Создание новой ссылки…',
  'files.calendar.error.rotate':
    'Не удалось подтвердить создание новой ссылки. Текущее состояние показано ниже; при необходимости попробуйте ещё раз.',
  'files.calendar.rotate.confirm': 'Создать новую ссылку',
  'files.calendar.off.action': 'Отключить',
  'files.calendar.off.confirmTitle': 'Отключить эту ссылку на календарь?',
  'files.calendar.off.confirmBody':
    'Ссылка сразу перестанет работать. Календари сохранят полученные события, но перестанут их обновлять.',
  'files.calendar.off.confirm': 'Отключить',
  'files.calendar.off.busy': 'Отключение…',
  'files.calendar.closeGuard.title': 'Закрыть без копирования ссылки?',
  'files.calendar.closeGuard.body':
    'Мы не сможем показать её снова. Придётся создать новую.',
  'files.calendar.closeGuard.confirm': 'Всё равно закрыть',
  'files.calendar.closeGuard.cancel': 'Оставить открытым',
  'files.calendar.error.enable':
    'Не удалось подтвердить создание ссылки. Текущее состояние показано ниже. Если она включена, но вы её не видели, отключите и создайте заново.',
  'files.calendar.error.off':
    'Не удалось подтвердить отключение ссылки. Текущее состояние показано ниже; при необходимости повторите попытку.',
  'files.calendar.error.load':
    'Не удалось проверить ссылку на календарь этой поездки. Попробуйте снова.',
  'files.calendar.retry': 'Попробовать снова',
  'files.calendar.off.confirmBodyUnused':
    'Этой ссылкой ещё не пользовались. Она сразу перестанет работать.',
  'files.calendar.link.fallback':
    'Если на телефоне не удаётся добавить её, откройте эту страницу на компьютере.',
  'files.calendar.link.newTab': 'откроется в новой вкладке',
  'files.calendar.title': 'Календарь',
  'files.calendar.description':
    'Добавьте эту поездку в приложение календаря, которым вы уже пользуетесь.',
  'files.calendar.download.action': 'Скачать файл календаря (.ics)',
  'files.calendar.download.hint':
    'Снимок поездки в её нынешнем виде. Он не обновляется.',
  'files.calendar.undated':
    'У этой поездки пока нет дат, поэтому появятся только бронирования и переезды с датой.',
  'files.calendar.download.error':
    'Не удалось подготовить файл. Попробуйте ещё раз.',
  'files.calendar.timesNote':
    'Переезды с часовым поясом показываются в один и тот же момент везде. Всё остальное показывается в запланированное время по часам, где бы ни находился ваш календарь.',
  'files.drop.active': 'Отпустите, чтобы отправить',
  'files.drop.pasteHint':
    'вставляет скопированное изображение или снимок экрана',
  'files.reject.blockedType':
    '«{name}» не добавлен: файлы XML и сжатые SVG здесь не хранятся, из соображений безопасности. Сохраните его как PDF или изображение и добавьте вместо него.',
  'files.drop.idle': 'Перетащите файлы сюда',
  'files.empty.title': 'В этой поездке нет файлов',
  'files.empty.body':
    'Всё, что иначе пришлось бы выкапывать из почты у стойки регистрации, лежит здесь, при поездке, к которой относится.',
  'files.empty.hint':
    'Посадочные талоны, подтверждения отелей, билеты, страховые документы и чеки, которые подтверждают траты.',
  'files.heading': 'Вложения',
  'files.tableCaption': 'Файлы, приложенные к этой поездке',
  'files.menu.download': 'Скачать',
  'files.menu.rename': 'Переименовать и описать…',
  'files.menu.remove': 'Удалить файл',
  'files.remove.body':
    'Файл удаляется и из хранилища, и из поездки, освобождая {size}. Это не отменить.',
  'files.queue.clear': 'Убрать завершённые',
  'files.column.file': 'Файл',
  'files.column.size': 'Размер',
  'files.column.addedBy': 'Кто добавил',
  'files.column.when': 'Когда',
  'files.status.uploaded': 'Отправлен',
  'files.status.failed': 'Не удался',
  'files.status.cancelled': 'Отменён',
  'files.status.uploading': 'Отправляется',
  'files.status.waiting': 'Ожидает',
  'files.error.nameEmpty': 'Файлу нужно имя, по которому вы его найдёте.',
  'files.field.kindHint':
    'Определяет, под каким фильтром он стоит и какой значок получает.',
  'files.field.kindAria': 'Вид файла',
  'files.field.description': 'Описание',
  'files.field.descriptionPlaceholder':
    'Страховой полис — покрывает всю группу, телефон для обращений на странице 2.',
  'files.dialog.title': 'Данные файла',
  'files.action.saving': 'Сохранение файла',
  'files.action.save': 'Сохранить данные',
  'files.queue.someFailed': {
    one: '{count} файл не отправился. Причина указана в каждой строке — остальное из партии не затронуто.',
    few: '{count} файла не отправились. Причина указана в каждой строке — остальное из партии не затронуто.',
    many: '{count} файлов не отправились. Причина указана в каждой строке — остальное из партии не затронуто.',
    other:
      '{count} файла не отправились. Причина указана в каждой строке — остальное из партии не затронуто.',
  },

  'files.action.cancelUploadOf': 'Отменить отправку: {name}',
  'files.action.dismissOf': 'Скрыть: {name}',
  'files.status.downloadingOf': 'Скачивание: {name}',
  'files.status.uploadingOf': 'Отправка: {name}',
  'files.status.uploadingCount': {
    one: 'Отправка {count} файла',
    few: 'Отправка {count} файлов',
    many: 'Отправка {count} файлов',
    other: 'Отправка {count} файла',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - создано {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': 'Готово: {title}',
  'files.export.email.body': {
    one: 'Экспорт поездки готов. Он хранится {count} день.',
    few: 'Экспорт поездки готов. Он хранится {count} дня.',
    many: 'Экспорт поездки готов. Он хранится {count} дней.',
    other: 'Экспорт поездки готов. Он хранится {count} дня.',
  },
  'files.export.email.action': 'Открыть: {title}',
  'files.export.email.text': 'Экспорт поездки готов: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Экспорт поездки',
  'files.export.description':
    'Печатная копия поездки: дни, остановки, бронирования, транспорт и проживание. Передайте её тому, у кого нет аккаунта.',
  'files.export.kept': {
    one: 'Каждый экспорт хранится {count} день.',
    few: 'Каждый экспорт хранится {count} дня.',
    many: 'Каждый экспорт хранится {count} дней.',
    other: 'Каждый экспорт хранится {count} дня.',
  },
  'files.export.empty.title': 'Экспортов пока нет',
  'files.export.empty.body':
    'Сделайте печатную копию поездки, чтобы отправить тому, у кого нет аккаунта.',
  'files.export.empty.bodyViewer':
    'Создать экспорт может владелец или редактор поездки.',
  'files.export.format.pdf': 'Файл PDF',
  'files.export.format.html': 'Страница для печати',
  'files.export.artifact': 'Экспорт поездки, {date}',
  'files.export.download': 'Скачать',
  'files.export.downloadLabelPdf': 'Скачать PDF, созданный {date}',
  'files.export.downloadLabelHtml':
    'Скачать страницу для печати, созданную {date}',
  'files.export.error.list': 'Список экспортов не загрузился.',
  'files.export.retry': 'Повторить',
  'files.export.error.missing':
    'Этот экспорт больше не хранится. Экспортируйте поездку ещё раз.',
  'files.export.error.missingViewer': 'Этот экспорт больше не хранится.',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Отправка отменена.',
  'files.error.badAnswer':
    'Сервер прислал ответ, который этот браузер не смог прочитать.',
  'files.error.connection':
    'Соединение оборвалось при отправке. Проверьте сеть и попробуйте снова.',
  'files.error.timeout': 'Отправка не уложилась во время. Попробуйте снова.',
  'files.error.refused': 'Сервер отклонил отправку ({status}).',
  'files.error.downloadShape':
    'Загрузка вернулась в виде, который мы не смогли сохранить.',
  'files.error.downloadFailed': 'Загрузка не удалась ({status}).',
  'files.toast.uploadedOne': 'Файл отправлен',
  'files.toast.uploadedManyBody': 'К поездке добавилось {size}.',
  'files.toast.failedOne': 'Этот файл не отправился',
  'files.toast.failedManyBody': 'Очередь ниже говорит причину для каждого.',
  'files.error.tooMany': {
    one: 'За раз можно добавить только {count} файл, поэтому «{name}» остался в стороне. Перетащите его отдельно.',
    few: 'За раз можно добавить только {count} файла, поэтому «{name}» остался в стороне. Перетащите его отдельно.',
    many: 'За раз можно добавить только {count} файлов, поэтому «{name}» остался в стороне. Перетащите его отдельно.',
    other:
      'За раз можно добавить только {count} файла, поэтому «{name}» остался в стороне. Перетащите его отдельно.',
  },
  'files.toast.uploadedMany': {
    one: 'Отправлен {count} файл',
    few: 'Отправлено {count} файла',
    many: 'Отправлено {count} файлов',
    other: 'Отправлено {count} файла',
  },
  'files.toast.failedMany': {
    one: '{count} файл не отправился',
    few: '{count} файла не отправились',
    many: '{count} файлов не отправились',
    other: '{count} файла не отправились',
  },

  'files.export.request': 'Экспортировать поездку',
  'files.export.includeReferences': 'Включить коды подтверждения',
  'files.export.includeReferencesHint':
    'Не отмечайте, если отправите файл человеку вне вашего пространства.',
  'files.export.pending':
    'Готовим экспорт. Можно уйти со страницы; готовый файл появится в списке.',
  'files.export.slow':
    'Это занимает больше времени, чем обычно. Готовый файл появится здесь. Если нет, повторите экспорт.',
  'files.export.refresh': 'Обновить',
  'files.export.ready': 'Экспорт готов',
  'files.export.quota': {
    one: 'Месячный лимит экспортов пространства составляет {count} и исчерпан. Счётчик обновится {date}.',
    few: 'Месячный лимит экспортов пространства составляет {count} и исчерпан. Счётчик обновится {date}.',
    many: 'Месячный лимит экспортов пространства составляет {count} и исчерпан. Счётчик обновится {date}.',
    other:
      'Месячный лимит экспортов пространства составляет {count} и исчерпан. Счётчик обновится {date}.',
  },
  'files.export.error.request': 'Экспорт не запущен',
  'files.export.error.requestBody':
    'Эта попытка не учтена. Повторите через некоторое время.',
  'files.export.doc.overview': 'Обзор',
  'files.export.doc.timezone': 'Часовой пояс',
  'files.export.doc.days': 'Дни',
  'files.export.doc.day': {
    one: 'День {count} - {date}',
    few: 'День {count} - {date}',
    many: 'День {count} - {date}',
    other: 'День {count} - {date}',
  },
  'files.export.doc.dayUndated': {
    one: 'День {count}',
    few: 'День {count}',
    many: 'День {count}',
    other: 'День {count}',
  },
  'files.export.doc.dayEmpty': 'Пока ничего не запланировано.',
  'files.export.doc.reservations': 'Бронирования',
  'files.export.doc.transport': 'Транспорт',
  'files.export.doc.reference': 'Код подтв. {code}',
  'files.export.doc.route': '{from} до {to}',
  'files.export.doc.stays': 'Где мы остановимся',
  'files.export.doc.nights': {
    one: 'Количество ночей: {count}',
    few: 'Количество ночей: {count}',
    many: 'Количество ночей: {count}',
    other: 'Количество ночей: {count}',
  },
  'files.export.doc.truncatedDays': {
    one: 'Все дни не помещаются в документ. Показано дней с начала: {count}.',
    few: 'Все дни не помещаются в документ. Показано дней с начала: {count}.',
    many: 'Все дни не помещаются в документ. Показано дней с начала: {count}.',
    other: 'Все дни не помещаются в документ. Показано дней с начала: {count}.',
  },
  'files.export.doc.truncatedRows': {
    one: 'Показано с начала: {count} из {total}.',
    few: 'Показано с начала: {count} из {total}.',
    many: 'Показано с начала: {count} из {total}.',
    other: 'Показано с начала: {count} из {total}.',
  },
  'files.export.notify': 'Сообщить по почте, когда будет готово',
  'files.export.viewer':
    'Создавать экспорт могут только владельцы и редакторы. Вы можете скачать существующие файлы.',
  'files.export.jump': 'К экспортам',
  'files.export.fromLink': 'По вашей ссылке',
  'files.export.linkGone':
    'Этот экспорт больше не хранится. Создайте новый ниже.',
  'files.export.allowance': {
    one: 'В этом месяце использовано {used} из {count} экспортов',
    few: 'В этом месяце использовано {used} из {count} экспортов',
    many: 'В этом месяце использовано {used} из {count} экспортов',
    other: 'В этом месяце использовано {used} из {count} экспортов',
  },
  'files.export.allowanceUnlimited': {
    one: 'Экспортов в этом месяце: {count}',
    few: 'Экспортов в этом месяце: {count}',
    many: 'Экспортов в этом месяце: {count}',
    other: 'Экспортов в этом месяце: {count}',
  },
  'files.export.linkGoneViewer': 'Этот экспорт больше не хранится.',
  'files.calendar.tab.trip': 'Эта поездка',
  'files.calendar.tab.workspace': 'Мои поездки',
  'files.calendar.workspace.warning':
    'Любой с этой ссылкой может без аккаунта читать неархивные поездки этого пространства, в которых вы участвуете: {count} с самыми поздними датами начала. Новые поездки появляются автоматически. Защищайте ссылку как пароль.',
  'files.calendar.workspace.nameNote':
    'В календаре эта ссылка называется «planned.travel». Переименуйте её, если у вас их несколько.',
  /* ----------------------------------- the leave planner's allowance */
  'vacay.allowance.label': 'Лимит отпуска {year}',
  'vacay.allowance.daysLeft': {
    one: 'Осталось {value} день',
    few: 'Осталось {value} дня',
    many: 'Осталось {value} дней',
    other: 'Осталось {value} дня',
  },
  'vacay.allowance.daysOver': {
    one: 'Превышение на {value} день',
    few: 'Превышение на {value} дня',
    many: 'Превышение на {value} дней',
    other: 'Превышение на {value} дня',
  },
  'vacay.allowance.progress': 'Использовано дней: {used} из {total}',
  'vacay.allowance.tile.days': 'Дни',
  'vacay.allowance.tile.used': 'Использовано',
  'vacay.allowance.tile.carried': 'Перенесено',
  'vacay.allowance.tile.edit.days': 'Изменить дни, сейчас {value}',
  'vacay.allowance.input.days': 'Ваш лимит на {year} год',
  'vacay.allowance.input.invalid': 'Введите целое число от 0 до 365.',
  'vacay.allowance.save': 'Сохранить',
  'vacay.allowance.cancel': 'Отмена',
  'vacay.allowance.saving': 'Сохранение…',
  'vacay.allowance.default.hint':
    'Лимит по умолчанию. Выберите, чтобы задать свой.',
  'vacay.allowance.saved': 'Лимит сохранён.',
  'vacay.allowance.error.days': {
    one: 'Не удалось сохранить ваш лимит. За {year} год по-прежнему указано: {value} день.',
    few: 'Не удалось сохранить ваш лимит. За {year} год по-прежнему указано: {value} дня.',
    many: 'Не удалось сохранить ваш лимит. За {year} год по-прежнему указано: {value} дней.',
    other:
      'Не удалось сохранить ваш лимит. За {year} год по-прежнему указано: {value} дня.',
  },
  'vacay.allowance.retry': 'Повторить',
  'vacay.pending.loading': 'Загрузка',
  'vacay.error.title': 'Не удалось загрузить планировщик отпусков',
  'vacay.year.previous': 'Предыдущий год',
  'vacay.year.next': 'Следующий год',
} satisfies TranslationOf<typeof En>

export default messages
