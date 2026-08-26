/**
 * The design system's own copy, in Brazilian Portuguese.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Você», with the verb in the third person — the register every
 * Brazilian consumer product uses. Brazilian vocabulary throughout, so a
 * screen says «celular» and «tela», never the European forms.
 *
 * **Plural.** `Intl.PluralRules('pt-BR')` reports `one`, `many` and `other`.
 * `many` is the branch CLDR keeps for the millions, where Portuguese inflects
 * the noun exactly as it does in `other`.
 *
 * **Dates.** `src/lib/format-tables.ts` already carries the frozen Brazilian
 * month and weekday names and the `d 'de' MMM 'de' y` short date, so nothing
 * here restates a date format. The two calendar patterns below only order the
 * parts the formatter hands over.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Limpar',
  'action.close': 'Fechar',
  'action.dismiss': 'Dispensar',
  'action.remove': 'Remover',
  'action.undo': 'Desfazer',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Carregando',
  'status.working': 'Salvando',
  'status.searching': 'Buscando',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} está on-line',
  'avatar.status.away': '{name} está ausente',
  'avatar.status.busy': '{name} está ocupado',
  'avatar.status.offline': '{name} está off-line',
  'avatar.overflow': {
    one: 'mais {others} pessoa',
    many: 'mais {others} pessoas',
    other: 'mais {others} pessoas',
  },
  /**
   * Brazilian Portuguese leads with the sign, exactly as English does: «+3»
   * means "three beyond the faces you can see". After the figure it would read
   * as «três ou mais», which is untrue — one of the three is already on
   * screen. That face is `aria-hidden`, so the exact number reaches a screen
   * reader through `avatar.overflow` either way.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * «99+» is the Brazilian notation too — figure first, marker after, read as
   * «noventa e nove ou mais». The mirrored «+99» would say that ninety-nine
   * had just arrived, which is a different claim.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Escolher uma data',
  'calendar.label.range': 'Escolher um período',
  'calendar.previousMonth': 'Mês anterior',
  'calendar.nextMonth': 'Próximo mês',
  'calendar.monthYear': '{month} de {year}',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'Exibindo {months}',
  'calendar.day': '{weekday}, {day} de {month} de {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Selecione…',
  'select.unavailable': 'Indisponível: {value}',
  'select.unavailableHint':
    'A opção salva {value} não existe mais. Escolha outra.',
  'combobox.search': 'Buscar',
  'combobox.empty': 'Nenhum resultado',
  'combobox.clear': 'Limpar a seleção',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Escolha uma data',
  'datePicker.clear': 'Limpar a data',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Escolha as datas',
  'dateRange.clear': 'Limpar as datas',
  'dateRange.presets': 'Períodos rápidos',
  'dateRange.preset.week': 'Próximos 7 dias',
  'dateRange.preset.fortnight': 'Próximas 2 semanas',
  'dateRange.preset.month': 'Próximos 30 dias',
  'dateRange.value': 'de {start} a {end}',
  'dateRange.valuePending': 'de {start} a…',
  'dateRange.nights': {
    one: '{nights} noite',
    many: '{nights} noites',
    other: '{nights} noites',
  },
  'dateRange.nightsSelected': {
    one: '{nights} noite escolhida',
    many: '{nights} noites escolhidas',
    other: '{nights} noites escolhidas',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Paginação',
  'pagination.first': 'Primeira página',
  'pagination.previous': 'Página anterior',
  'pagination.next': 'Próxima página',
  'pagination.last': 'Última página',
  'pagination.page': 'Página {page}',
  'pagination.current': 'Página {page} de {pageCount}',
  'pagination.summary': 'Exibindo {from}–{to} de {total}',
} satisfies TranslationOf<typeof En>

export default messages
