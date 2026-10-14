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
  'expense.what': 'Para qué fue',
  'expense.whatPlaceholder': 'Cena en Kyubey',
  'expense.amountNotANumber': 'Escribe el importe como número.',
  'expense.currencyLabel': 'Moneda en la que está el recibo',
  'expense.convertedTo': 'Convertido a {currency}',
  'expense.convertedHint': 'A cuánto salió {from} en {to} en tu extracto.',
  'expense.convertedSuggested':
    'Sugerido a partir del tipo de cambio usado en este viaje el {date} ({rate}). Cámbialo para que coincida con tu extracto.',
  'expense.convertedNotANumber': 'Escribe el importe convertido como número.',
  'expense.dateLabel': 'Fecha del gasto',
  'expense.paidByHint':
    'Déjalo sin pagador si estás anotando un recibo que nadie ha cubierto todavía.',
  'expense.nobodyYet': 'Todavía nadie',
  'expense.whoPaid': 'Quién pagó',
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
  'payment.whoPaying': 'Quién paga',
  'payment.whoPaid': 'Quién recibe',
  'payment.amountIn': 'Importe en {currency}',
  'payment.amountPositive': 'Escribe un importe mayor que cero.',
  'payment.currencyLabel': 'Moneda en la que se hizo el pago',
  'payment.how': 'Cómo',
  'payment.howMade': 'Cómo se hizo el pago',
  'payment.dateLabel': 'Fecha del pago',
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
  /* ------------------------------------------- read-only ledger (#837) */
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
} satisfies TranslationOf<typeof En>

export default messages
