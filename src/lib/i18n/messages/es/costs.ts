/**
 * The costs tab's copy, in es.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` solo para números compactos
 * grandes. **Tipografía.** El español abre interrogación y exclamación.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Tú',
  'person.youTarget': 'ti',
  'person.removed': 'Viajero eliminado',
  'person.removedTarget': 'un viajero eliminado',
  /* ------------------------------------------------ delete an expense */
  'delete.title': '¿Eliminar este gasto?',
  'delete.description':
    '«{title}» y su reparto salen de la cuenta. Esto no se puede deshacer.',
  'delete.failed': 'No se pudo eliminar',
  'delete.failedBody':
    'No se ha podido eliminar el gasto. Inténtalo en un momento.',
  'delete.noBalances': 'Ningún saldo cambia: no había nada repartido en él.',
  'delete.balancesChange': 'Cambian los saldos de {names}.',
  'delete.confirm': 'Eliminar gasto',
  'delete.working': 'Eliminando el gasto',
  'delete.payment.title': '¿Eliminar este pago?',
  'delete.payment.description':
    '«{title}» sale de la cuenta. Esto no se puede deshacer. Para corregir un pago, vuelve a registrarlo.',
  'delete.payment.failedBody':
    'No se ha podido eliminar el pago. Inténtalo en un momento.',
  'delete.payment.confirm': 'Eliminar pago',
  'delete.payment.working': 'Eliminando el pago',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Gastos',
  'toolbar.shownOf': '{shown} de {total}',
  'toolbar.searchPlaceholder': 'Busca en gastos, notas o quien pagó…',
  'toolbar.searchLabel': 'Buscar gastos',
  'toolbar.allCategories': 'Todas las categorías',
  'toolbar.allDays': 'Todos los días',
  'toolbar.filterCategory': 'Filtrar por categoría',
  'toolbar.filterDay': 'Filtrar por día',
  'toolbar.whose': 'Gastos de quién',
  'toolbar.paidByMe': 'Pagados por mí',
  'toolbar.owedToMe': 'Me deben',
  'toolbar.logged': {
    one: '{value} registrado',
    many: '{value} registrados',
    other: '{value} registrados',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Reparto entre viajeros',
  'split.label': 'Repartir entre',
  'split.everyone': 'Todos',
  'split.nobody': 'Nadie',
  'split.departed': 'Dejó el viaje',
  'split.departedHint':
    'Al desmarcar a alguien que dejó el viaje, su parte se elimina para siempre.',
  'split.includeFor': 'Incluir a {name} en este reparto',
  'split.how': 'Cómo se reparte este gasto',
  'split.method.equal': 'A partes iguales',
  'split.method.equalHint':
    'Todos los incluidos pagan lo mismo, y la unidad mínima sobrante va a la primera persona de la lista.',
  'split.method.exact': 'Exacto',
  'split.method.exactHint':
    'Escribe lo que debe cada uno de verdad. Los importes tienen que sumar el total.',
  'split.method.shares': 'Partes',
  'split.method.sharesHint':
    'Pondera el reparto: 2 partes para una pareja, 1 para el resto.',
  'split.method.percentage': 'Porcentaje',
  'split.method.percentageHint':
    'Reparto por porcentaje. Los porcentajes tienen que sumar 100.',
  'split.exactFor': 'Importe exacto de {name}',
  'split.percentFor': 'Porcentaje de {name}',
  'split.sharesFor': 'Partes de {name}',
  'split.balanced': 'Cuadra',
  'split.allocated': '{allocated} de {total} asignado',
  'split.over': '{amount} de más',
  'split.left': 'quedan {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Importe',
  'field.currency': 'Moneda',
  'field.date': 'Fecha',
  'field.paidBy': 'Pagado por',
  'expense.editTitle': 'Editar este gasto',
  'expense.addTitle': 'Añadir un gasto',
  'expense.editDescription':
    'Cambiar el importe lo vuelve a repartir entre todos los incluidos abajo.',
  'expense.addDescription':
    'Los importes de este viaje se guardan en {currency}. Anota un recibo en su propia moneda y registra a cuánto se convirtió.',
  'expense.saveFailed': 'No se pudo guardar',
  'expense.splitOff.title': 'Las partes guardadas no suman el total',
  'expense.splitOff.body':
    'Suman {shares}, pero el coste es {total}. Ajusta las partes y guarda para corregirlo.',
  'expense.what': 'Para qué fue',
  'expense.whatPlaceholder': 'Cena en Kyubey',
  'expense.amountNotANumber': 'Escribe el importe como número.',
  'expense.convertedTo': 'Convertido a {currency}',
  'expense.convertedHint': 'A cuánto salió {from} en {to} en tu extracto.',
  'expense.convertedSuggested':
    'Sugerido a partir del tipo de cambio usado en este viaje el {date} ({rate}). Cámbialo para que coincida con tu extracto.',
  'expense.convertedNotANumber': 'Escribe el importe convertido como número.',
  'expense.paidByHint':
    'Déjalo sin pagador si estás anotando un recibo que nadie ha cubierto todavía.',
  'expense.nobodyYet': 'Todavía nadie',
  'expense.notesHint': 'Opcional. Lo que el recibo no diga.',
  'expense.notesPlaceholder':
    'Menú degustación compartido, las bebidas aparte.',
  'expense.noAmount': 'Todavía sin importe',
  'expense.saving': 'Guardando el gasto',
  'expense.saveChanges': 'Guardar cambios',
  'expense.add': 'Añadir gasto',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Registrar un pago',
  'payment.description':
    'Anotar una transferencia la quita de los dos saldos. No mueve dinero: planned.travel lleva la cuenta, el dinero lo mueve tu banco.',
  'payment.youSuffix': '{name} (tú)',
  'payment.pays': '{from} paga a {to}',
  'payment.pickTwo': 'Elige dos personas distintas.',
  'payment.paidTo': 'Pagado a',
  'payment.needsTwo': 'Un pago necesita dos personas distintas.',
  'payment.amountIn': 'Importe en {currency}',
  'payment.amountPositive': 'Escribe un importe mayor que cero.',
  'payment.how': 'Cómo',
  'payment.note': 'Nota',
  'payment.noteHint': 'Opcional. Una referencia, o lo que cubría.',
  'payment.notePlaceholder': 'Cubre el hotel de Kioto y los pases JR.',
  'payment.recording': 'Registrando el pago',
  'payment.confirm': 'Registrar pago',
  'payment.failed':
    'No se ha podido registrar el pago. Inténtalo en un momento.',
  'payment.method.bankTransfer': 'Transferencia bancaria',
  'payment.method.cash': 'Efectivo',
  'payment.method.card': 'Tarjeta',
  'payment.method.app': 'App de pago',
  'payment.method.other': 'Otra cosa',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Liquidación',
  'settle.addPayment': 'Añadir pago',
  'settle.action': 'Liquidar',
  'settle.empty.title': 'Todos están en paz',
  'settle.empty.body':
    'No hace falta ninguna transferencia. Añade un gasto y cualquier desequilibrio aparecerá aquí.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldos',
  'balances.count': {
    one: '{travellers} viajero',
    many: '{travellers} viajeros',
    other: '{travellers} viajeros',
  },
  'balances.empty':
    'Los saldos aparecen cuando un gasto tiene pagador y reparto.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Por categoría',
  'categories.againstBudget': 'Frente al presupuesto del viaje',
  'categories.progressLabel': 'Gastado frente al presupuesto del viaje',
  'categories.empty':
    'Las partidas del presupuesto y los gastos se desglosan aquí cuando hay algo que desglosar.',
  'categories.legendLabel': 'Gasto por categoría',
  'categories.planned': '{amount} previstos',
  'categories.nothingSpent':
    'Aún no se ha gastado nada. Esto es lo que tienes previsto.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'menos del {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Para quién fue el gasto',
  'memberBar.others': {
    one: '{others} viajero más',
    many: '{others} viajeros más',
    other: '{others} viajeros más',
  },
  'memberBar.notSplit': 'Sin asignar a nadie',
  'totalTile.label': 'Gasto total del viaje',
  'totalTile.captionPlanned': '{amount} previstos entre todos los viajeros',
  'totalTile.captionBudget': '{amount} de presupuesto para el viaje',
  'totalTile.yourShare': 'Tu parte',
  'totalTile.youPaid': 'Has pagado',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Pagos registrados',
  'payments.empty.title': 'Aún no hay pagos',
  'payments.empty.body':
    'Cuando alguien devuelve un saldo, la transferencia queda registrada aquí.',
  'payments.delete': 'Eliminar el pago de {from} a {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Este viaje está archivado. Restáuralo antes de cambiar los gastos.',
  'readOnly.title': 'Puedes ver los costes, pero no cambiarlos',
  'readOnly.body':
    'Solo los propietarios del viaje y quienes pueden editarlo añaden, modifican o eliminan gastos y registran pagos. Pídeselo a un propietario si hay algo que cambiar.',
  'readOnly.empty':
    'Todavía no se ha registrado ningún gasto en este viaje. Aparecerán aquí cuando un propietario o un editor los añada.',
  'readOnly.settleEmpty':
    'Ahora mismo no hace falta ninguna transferencia. Cualquier desequilibrio aparecería aquí.',
  'refusal.rebaseChanged':
    'El viaje cambió mientras lo confirmabas, así que no se modificó nada. Revisa las cifras nuevas y vuelve a confirmar.',
  'refusal.tripCurrencyChanged':
    'La moneda del presupuesto de este viaje ahora es {to}, así que no se guardó. La página se ha actualizado: revisa el importe y vuelve a guardar.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Moneda de visualización',
  'display.indicator.perTrip': 'Moneda propia',
  'display.indicator.fixed': 'También en {code}',
  'display.menu.perTrip': 'Cada viaje en su moneda',
  'display.menu.workspace': '{code} (predeterminada del espacio)',
  'display.menu.rateHint': 'Usa un tipo ya registrado en un viaje',
  'display.menu.currentHint': 'Elegida, pero ningún tipo registrado la cubre',
  'display.menu.needsLiveRate':
    'Necesita un tipo en vivo, que aún no está disponible',
  'display.menu.saving': 'Guardando tu elección',
  'display.error.title': 'No se guardó la moneda de visualización',
  'display.error.body':
    'No se pudo guardar tu elección. Inténtalo de nuevo en un momento.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Unos {amount} {code} en tu moneda de visualización',
  'display.row.notConverted': 'Sin convertir',
  'display.alert.title': 'Algunas cifras no están convertidas',
  'display.alert.body':
    'No hay tipo registrado para estos pares de monedas, así que esas cifras se quedan en la moneda del presupuesto:',
  'display.alert.pair': '{from} a {to} el {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Cambiar la moneda del presupuesto',
  'rebase.title': 'Cambiar la moneda del presupuesto',
  'rebase.description':
    'Los importes que escribiste se quedan tal cual. Los totales y los saldos de este viaje se convierten a la nueva moneda.',
  'rebase.to': 'Nueva moneda',
  'rebase.toPlaceholder': 'Elige una moneda',
  'rebase.rateLabel': 'Tipo de cambio (1 {from} en {to})',
  'rebase.rateInverse': 'Es decir, 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Escribe un tipo mayor que cero.',
  'rebase.rateOutOfRange':
    'Ese tipo parece demasiado alto o demasiado bajo. Comprueba en qué sentido va.',
  'rebase.source.recent': 'El último tipo usado en este espacio',
  'rebase.source.manual': 'El tipo que escribiste',
  'rebase.noRate':
    'No hay ningún tipo registrado de {from} a {to}. Escribe el que quieras usar.',
  'rebase.waitingForRate': 'La vista previa aparece en cuanto haya un tipo.',
  'rebase.loading': 'Calculando la conversión',
  'rebase.example':
    '{original} se queda como lo escribiste y se cuenta como {converted}.',
  'rebase.count.expenses': {
    one: '{count} gasto se contará en {to}.',
    many: '{count} de gastos se contarán en {to}.',
    other: '{count} gastos se contarán en {to}.',
  },
  'rebase.count.payments': {
    one: '{count} pago se contará en {to}.',
    many: '{count} de pagos se contarán en {to}.',
    other: '{count} pagos se contarán en {to}.',
  },
  'rebase.count.planned': {
    one: '{count} elemento previsto se contará en {to}.',
    many: '{count} de elementos previstos se contarán en {to}.',
    other: '{count} elementos previstos se contarán en {to}.',
  },
  'rebase.pinned':
    'Los precios de lugares, reservas, alojamientos y transportes se quedan en {from}.',
  'rebase.target': 'El presupuesto del viaje {before} pasa a ser {after}.',
  'rebase.rounding':
    'Cada importe se redondea una sola vez, así que un saldo puede variar hasta {amount}.',
  'rebase.leftover': 'Tras el cambio, {name} le debería {amount} a {other}.',
  'rebase.someone': 'Alguien',
  'rebase.nothing':
    'Nada de este viaje tiene precio todavía, así que no hay nada que convertir.',
  'rebase.unconverted': {
    one: '{count} entrada está en una moneda distinta de {from} y no se puede convertir automáticamente. Suele ser un gasto creado a partir de una reserva con el precio en otra moneda: edítalo o elimínalo y vuelve a intentarlo.',
    many: '{count} de entradas están en una moneda distinta de {from} y no se pueden convertir automáticamente. Suelen ser gastos creados a partir de reservas con el precio en otra moneda: edítalos o elimínalos y vuelve a intentarlo.',
    other:
      '{count} entradas están en una moneda distinta de {from} y no se pueden convertir automáticamente. Suelen ser gastos creados a partir de reservas con el precio en otra moneda: edítalos o elimínalos y vuelve a intentarlo.',
  },
  'rebase.unsplittable': {
    one: '{count} gasto tiene un reparto que no se puede trasladar, porque todas sus partes son cero. Edítalo o elimínalo y vuelve a intentarlo.',
    many: '{count} de gastos tienen un reparto que no se puede trasladar, porque todas sus partes son cero. Edítalos o elimínalos y vuelve a intentarlo.',
    other:
      '{count} gastos tienen un reparto que no se puede trasladar, porque todas sus partes son cero. Edítalos o elimínalos y vuelve a intentarlo.',
  },
  'rebase.outOfRange':
    'Con este tipo, un importe del viaje sería demasiado grande para guardarlo en {to}. Revisa el tipo y en qué sentido va.',
  'rebase.tooLarge':
    'Este viaje tiene demasiadas entradas para cambiarlas de una vez: harían falta {changes} cambios a la vez y el límite es {limit}. Por ahora el presupuesto sigue en {from}.',
  'rebase.copyPending':
    'Este viaje todavía se está copiando. Inténtalo de nuevo en un momento.',
  'rebase.error': 'No se pudo cargar la conversión. No se cambió nada.',
  'rebase.commitError':
    'No pudimos cambiar la moneda del presupuesto. No se cambió nada.',
  'rebase.stale':
    'La moneda del presupuesto del viaje ahora es {current}, no {from}. Cierra este diálogo y vuelve a abrirlo.',
  'rebase.sameCurrency': 'El presupuesto ya está en {to}. Elige otra moneda.',
  'rebase.commitUnknown':
    'No pudimos confirmar si la moneda del presupuesto cambió a {to}. Recarga la página para comprobarlo antes de volver a intentarlo.',
  'rebase.retry': 'Reintentar',
  'rebase.confirm': 'Cambiar a {to}',
  'rebase.committing': 'Cambiando la moneda del presupuesto',
  'rebase.done': 'El presupuesto ahora está en {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Todavía no se ha gastado nada',
  'screen.summary': '{expenses} · {spent} gastados',
  'count.expenses': {
    one: '{expenses} gasto',
    many: '{expenses} gastos',
    other: '{expenses} gastos',
  },
  'screen.exportCsv': 'Exportar CSV',
  'screen.addFirst': 'Añadir el primer gasto',
  'screen.empty.title': 'Todavía no hay gastos',
  'screen.empty.body':
    'Anota lo que gastas sobre la marcha. planned.travel lo reparte entre todos los viajeros y lleva el total acumulado en {currency}.',
  'screen.filtered.title': 'Nada coincide con esos filtros',
  'screen.filtered.body':
    'Amplía la búsqueda, elige otro día o quita los filtros para volver a ver todo el viaje.',
  'export.empty.title': 'Nada que exportar',
  'export.empty.body': 'Ningún gasto coincide con los filtros activos.',
  'export.ready.title': 'Exportación lista',
  'export.ready.body': {
    one: '{expenses} gasto escrito en el CSV.',
    many: '{expenses} gastos escritos en el CSV.',
    other: '{expenses} gastos escritos en el CSV.',
  },
  'list.daySpent': '{amount} gastados',
  'skeleton.loading': 'Cargando los gastos',
  'row.noPayer': 'Aún sin pagador',
  'row.youPaid': 'Pagaste tú',
  'row.paid': 'Pagó {name}',
  'row.notYourShare': 'no es tu parte',
  'row.yourShare': '{amount} tuyos',
  'row.noteOn': 'Nota de {title}',
  'row.edit': 'Editar {title}',
  'row.delete': 'Eliminar {title}',
  'row.saving': 'Guardando',
  'row.splitOff': 'Las partes no suman el total',
  'tile.owe.label': 'Debes',
  'tile.owe.settled': 'Estás al día',
  'tile.owe.pending': 'Salda cuentas antes de volar a casa',
  'tile.owe.to': 'A',
  'tile.owed.label': 'Te deben',
  'tile.owed.none': 'Nadie te debe nada',
  'tile.owed.pending': 'Aún te falta recuperarlo',
  'tile.owed.from': 'De',
  'tile.outstanding.label': 'Pendiente',
  'tile.outstanding.none': 'Todos los gastos tienen pagador',
  'tile.outstanding.some': {
    one: '{expenses} gasto aún sin pagador',
    many: '{expenses} gastos aún sin pagador',
    other: '{expenses} gastos aún sin pagador',
  },
  'category.accommodation': 'Alojamiento',
  'category.transport': 'Transporte',
  'category.food': 'Comida y bebida',
  'category.activities': 'Actividades',
  'category.shopping': 'Compras',
  'category.fees': 'Tasas y cargos',
  'category.insurance': 'Seguro',
  'category.other': 'Otros',
  'toolbar.summary.everything': 'Mostrando todo',
  'toolbar.summary.filtered': 'Filtrado: {filters}',
  'toolbar.summary.search': 'que coincide con «{term}»',
  'write.added': 'Gasto añadido',
  'write.updated': 'Gasto actualizado',
  'write.deleted': 'Gasto eliminado',
  'write.addFailed': 'No se añadió el gasto',
  'write.editFailed': 'No se guardó el gasto',
  'write.deleteFailed': 'No se eliminó el gasto',
  'write.paymentRecorded': 'Pago registrado',
  'write.paymentRecordedBody': 'Los dos saldos están actualizados.',
  'write.paymentFailed': 'No se registró el pago',
  'write.paymentDeleted': 'Pago eliminado',
  'write.paymentDeleteFailed': 'No se eliminó el pago',
  'write.rolledBack': 'Se deshizo el cambio.',
  'expense.saveFallback':
    'No se pudo guardar el gasto. Inténtalo de nuevo en un momento.',
} satisfies TranslationOf<typeof En>

export default messages
