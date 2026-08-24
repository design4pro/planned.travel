/**
 * The design system's own copy, in Spanish.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular — «tú» — throughout: a travel planner
 * speaks to the traveller, not to their employer. The whole Spanish catalogue
 * holds that voice, so no screen slips into «usted» halfway down.
 *
 * **Plural.** `Intl.PluralRules('es')` reports `one`, `many` and `other`.
 * `many` is the branch CLDR keeps for the millions, where Spanish inflects the
 * noun exactly as it does in `other` — the two read alike on purpose, not by
 * omission.
 *
 * **Typography.** Sentence case everywhere: Spanish capitalises neither a
 * month nor a weekday nor the words inside a heading. A date binds its parts
 * with «de», and a range takes a closed-up en dash rather than the spaced form
 * English sets.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Borrar',
  'action.close': 'Cerrar',
  'action.dismiss': 'Descartar',
  'action.remove': 'Quitar',
  'action.undo': 'Deshacer',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Cargando',
  'status.working': 'Guardando',
  'status.searching': 'Buscando',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} está en línea',
  'avatar.status.away': '{name} está ausente',
  'avatar.status.busy': '{name} está ocupado',
  'avatar.status.offline': '{name} está sin conexión',
  'avatar.overflow': {
    one: '{others} persona más',
    many: '{others} personas más',
    other: '{others} personas más',
  },
  /**
   * Spanish puts the sign first, exactly as English does: «+3» means "three
   * more than the faces you can see". Behind the figure it would turn into
   * «tres o más», which is false — one of those three is already on screen.
   * The face is `aria-hidden`, so the exact number is always spoken from
   * `avatar.overflow` instead.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * «99+» is the Spanish notation too — figure first, marker after, read as
   * «noventa y nueve o más». The mirrored «+99» would announce that
   * ninety-nine had just arrived, which is a different fact.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Elegir una fecha',
  'calendar.label.range': 'Elegir un intervalo de fechas',
  'calendar.previousMonth': 'Mes anterior',
  'calendar.nextMonth': 'Mes siguiente',
  'calendar.monthYear': '{month} de {year}',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'Se muestra {months}',
  /** Spanish joins day to month and month to year with «de». */
  'calendar.day': '{weekday}, {day} de {month} de {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Selecciona…',
  'select.unavailable': 'No disponible: {value}',
  'select.unavailableHint':
    'La opción guardada {value} ya no está disponible. Elige otra.',
  'combobox.search': 'Buscar',
  'combobox.empty': 'Sin coincidencias',
  'combobox.clear': 'Quitar la selección',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Elige una fecha',
  'datePicker.clear': 'Quitar la fecha',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Elige las fechas',
  'dateRange.clear': 'Quitar las fechas',
  'dateRange.presets': 'Intervalos rápidos',
  'dateRange.preset.week': 'Próximos 7 días',
  'dateRange.preset.fortnight': 'Próximas 2 semanas',
  'dateRange.preset.month': 'Próximos 30 días',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'Desde {start} hasta…',
  'dateRange.nights': {
    one: '{nights} noche',
    many: '{nights} noches',
    other: '{nights} noches',
  },
  'dateRange.nightsSelected': {
    one: '{nights} noche elegida',
    many: '{nights} noches elegidas',
    other: '{nights} noches elegidas',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Paginación',
  'pagination.first': 'Primera página',
  'pagination.previous': 'Página anterior',
  'pagination.next': 'Página siguiente',
  'pagination.last': 'Última página',
  'pagination.page': 'Página {page}',
  'pagination.current': 'Página {page} de {pageCount}',
  'pagination.summary': 'Se muestran {from}–{to} de {total}',
} satisfies TranslationOf<typeof En>

export default messages
