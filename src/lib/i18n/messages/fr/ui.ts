/**
 * The design system's own copy, in French.
 *
 * Authored from `../en/ui.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Vouvoiement throughout, which is what a French traveller
 * expects of a product that holds their bookings and their money. The whole
 * French catalogue keeps it, so no screen drops into «tu» halfway down.
 *
 * **Plural.** `Intl.PluralRules('fr')` reports `one`, `many` and `other`.
 * `many` is the branch CLDR keeps for the millions; French inflects the noun
 * there exactly as it does in `other`, so the two read alike deliberately.
 *
 * **Typography.** French sets a non-breaking space before a colon, so every
 * `:` below is preceded by `\u00a0`. A month and its year are bound the same
 * way, and a date range is written «du … au …» rather than with a dash, which
 * is how a French reader says it aloud.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/ui'

const messages = {
  /* ------------------------------------------------------------- actions */
  'action.clear': 'Vider',
  'action.close': 'Fermer',
  'action.dismiss': 'Masquer',
  'action.remove': 'Retirer',
  'action.undo': 'Annuler',

  /* -------------------------------------------------------------- status */
  'status.loading': 'Chargement',
  'status.working': 'Enregistrement',
  'status.searching': 'Recherche',

  /* -------------------------------------------------------------- avatar */
  'avatar.status.online': '{name} est en ligne',
  'avatar.status.away': '{name} est absent',
  'avatar.status.busy': '{name} est occupé',
  'avatar.status.offline': '{name} est hors ligne',
  'avatar.overflow': {
    one: '{others} autre personne',
    many: '{others} autres personnes',
    other: '{others} autres personnes',
  },
  /**
   * French sets the sign first, as English does: «+3» says "three more than
   * the faces shown". After the figure it would read as «trois ou plus»,
   * which is untrue — one of the three is already visible. The face is
   * `aria-hidden`, so the exact number is spoken from `avatar.overflow`.
   */
  'avatar.more': '+{hidden}',

  /* --------------------------------------------------------------- badge */
  /**
   * A capped count is written «99+» in French too — figure, then marker, read
   * as «quatre-vingt-dix-neuf ou plus». The mirrored «+99» would claim that
   * ninety-nine of them had just come in, which is a different statement.
   */
  'badge.overflow': '{max}+',

  /* ------------------------------------------------------------ calendar */
  'calendar.label.date': 'Choisir une date',
  'calendar.label.range': 'Choisir une période',
  'calendar.previousMonth': 'Mois précédent',
  'calendar.nextMonth': 'Mois suivant',
  'calendar.monthYear': '{month}\u00a0{year}',
  'calendar.grid': '{month}\u00a0: {label}',
  'calendar.showing': 'Affichage\u00a0: {months}',
  'calendar.day': 'le {weekday} {day} {month} {year}',

  /* ------------------------------------------------------- select family */
  'select.placeholder': 'Choisir…',
  'select.unavailable': 'Indisponible\u00a0: {value}',
  'select.unavailableHint':
    'Le choix enregistré {value} n’est plus proposé. Choisissez-en un autre.',
  'combobox.search': 'Rechercher',
  'combobox.empty': 'Aucun résultat',
  'combobox.clear': 'Effacer la sélection',

  /* --------------------------------------------------------- date picker */
  'datePicker.placeholder': 'Choisir une date',
  'datePicker.clear': 'Effacer la date',

  /* ---------------------------------------------------- date range picker */
  'dateRange.placeholder': 'Choisir des dates',
  'dateRange.clear': 'Effacer les dates',
  'dateRange.presets': 'Périodes rapides',
  'dateRange.preset.week': 'Les 7 prochains jours',
  'dateRange.preset.fortnight': 'Les 2 prochaines semaines',
  'dateRange.preset.month': 'Les 30 prochains jours',
  'dateRange.value': 'du {start} au {end}',
  'dateRange.valuePending': 'du {start} au…',
  'dateRange.nights': {
    one: '{nights} nuit',
    many: '{nights} nuits',
    other: '{nights} nuits',
  },
  'dateRange.nightsSelected': {
    one: '{nights} nuit sélectionnée',
    many: '{nights} nuits sélectionnées',
    other: '{nights} nuits sélectionnées',
  },

  /* ---------------------------------------------------------- pagination */
  'pagination.label': 'Navigation entre les pages',
  'pagination.first': 'Première page',
  'pagination.previous': 'Page précédente',
  'pagination.next': 'Page suivante',
  'pagination.last': 'Dernière page',
  'pagination.page': 'Aller à la page {page}',
  'pagination.current': 'Page {page} sur {pageCount}',
  'pagination.summary': 'Affichage de {from} à {to} sur {total}',
} satisfies TranslationOf<typeof En>

export default messages
