/**
 * The costs tab's copy, in fr.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Pluriel.** `one` · `many` · `other` ; `many` ne sert qu’aux grands
 * nombres compacts. **Typographie.** Le français demande une espace fine
 * insécable avant « : » et cite avec « … ».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Vous',
  'person.youTarget': 'vous',
  'person.removed': 'Voyageur retiré',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Supprimer cette dépense ?',
  'delete.description':
    '« {title} » et son partage quittent le décompte. C’est irréversible.',
  'delete.failed': 'La suppression a échoué',
  'delete.failedBody':
    'La dépense n’a pas pu être supprimée. Réessayez dans un instant.',
  'delete.noBalances': 'Aucun solde ne change : rien n’était partagé dessus.',
  'delete.balancesChange': 'Les soldes de {names} changent.',
  'delete.confirm': 'Supprimer la dépense',
  'delete.working': 'Suppression de la dépense',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Dépenses',
  'toolbar.shownOf': '{shown} sur {total}',
  'toolbar.searchPlaceholder':
    'Rechercher dans les dépenses, les notes ou les payeurs…',
  'toolbar.searchLabel': 'Rechercher des dépenses',
  'toolbar.allCategories': 'Toutes les catégories',
  'toolbar.allDays': 'Tous les jours',
  'toolbar.filterCategory': 'Filtrer par catégorie',
  'toolbar.filterDay': 'Filtrer par jour',
  'toolbar.whose': 'Dépenses de qui',
  'toolbar.paidByMe': 'Payées par moi',
  'toolbar.owedToMe': 'On me doit',
  'toolbar.logged': {
    one: '{value} enregistrée',
    many: '{value} enregistrées',
    other: '{value} enregistrées',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Partage entre les voyageurs',
  'split.label': 'Partager entre',
  'split.everyone': 'Tout le monde',
  'split.nobody': 'Personne',
  'split.how': 'Comment cette dépense se partage',
  'split.method.equal': 'À parts égales',
  'split.method.equalHint':
    'Toutes les personnes incluses paient la même chose, et l’unité restante va à la première de la liste.',
  'split.method.exact': 'Exact',
  'split.method.exactHint':
    'Saisissez ce que chacun doit réellement. Les montants doivent faire le total.',
  'split.method.shares': 'Quotes-parts',
  'split.method.sharesHint':
    'Pondérez le partage : 2 parts pour un couple, 1 pour les autres.',
  'split.method.percentage': 'Pourcentage',
  'split.method.percentageHint':
    'Partage en pourcentage. Les pourcentages doivent faire 100.',
  'split.exactFor': 'Montant exact pour {name}',
  'split.percentFor': 'Pourcentage pour {name}',
  'split.sharesFor': 'Parts pour {name}',
  'split.balanced': 'Ça tombe juste',
  'split.allocated': '{allocated} sur {total} attribué',
  'split.over': '{amount} en trop',
  'split.left': 'il reste {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Montant',
  'field.currency': 'Devise',
  'field.date': 'Date',
  'field.paidBy': 'Payé par',
  'expense.editTitle': 'Modifier cette dépense',
  'expense.addTitle': 'Ajouter une dépense',
  'expense.editDescription':
    'Changer le montant le repartage entre toutes les personnes incluses ci-dessous.',
  'expense.addDescription':
    'Les montants de ce voyage sont tenus en {currency}. Notez un justificatif dans sa propre devise et indiquez ce qu’il a donné à la conversion.',
  'expense.saveFailed': 'L’enregistrement a échoué',
  'expense.what': 'C’était pour quoi',
  'expense.whatPlaceholder': 'Dîner au Kyubey',
  'expense.amountNotANumber': 'Saisissez le montant sous forme de nombre.',
  'expense.currencyLabel': 'Devise dans laquelle ce justificatif est libellé',
  'expense.convertedTo': 'Converti en {currency}',
  'expense.convertedHint': 'Ce que {from} a donné en {to} sur votre relevé.',
  'expense.convertedNotANumber':
    'Saisissez le montant converti sous forme de nombre.',
  'expense.dateLabel': 'Date de la dépense',
  'expense.paidByHint':
    'Laissez sans payeur si vous notez un justificatif que personne n’a encore pris en charge.',
  'expense.nobodyYet': 'Personne encore',
  'expense.whoPaid': 'Qui a payé',
  'expense.notesHint': 'Facultatif. Tout ce que le justificatif ne dit pas.',
  'expense.notesPlaceholder': 'Menu dégustation partagé, boissons à part.',
  'expense.noAmount': 'Pas encore de montant',
  'expense.saving': 'Enregistrement de la dépense',
  'expense.saveChanges': 'Enregistrer les modifications',
  'expense.add': 'Ajouter la dépense',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Enregistrer un paiement',
  'payment.description':
    'Un virement noté disparaît des deux soldes. Il ne déplace aucun argent : planned.travel tient le décompte, c’est votre banque qui vire.',
  'payment.youSuffix': '{name} (vous)',
  'payment.pays': '{from} paie {to}',
  'payment.pickTwo': 'Choisissez deux personnes différentes.',
  'payment.paidTo': 'Payé à',
  'payment.needsTwo': 'Un paiement demande deux personnes différentes.',
  'payment.whoPaying': 'Qui paie',
  'payment.whoPaid': 'Qui est payé',
  'payment.amountIn': 'Montant en {currency}',
  'payment.amountPositive': 'Saisissez un montant supérieur à zéro.',
  'payment.currencyLabel': 'Devise dans laquelle le paiement a été effectué',
  'payment.how': 'Comment',
  'payment.howMade': 'Comment le paiement a été fait',
  'payment.dateLabel': 'Date du paiement',
  'payment.note': 'Note',
  'payment.noteHint': 'Facultatif. Une référence, ou ce que ça couvrait.',
  'payment.notePlaceholder': 'Couvre l’hôtel de Kyoto et les pass JR.',
  'payment.recording': 'Enregistrement du paiement',
  'payment.confirm': 'Enregistrer le paiement',
  'payment.failed':
    'Le paiement n’a pas pu être enregistré. Réessayez dans un instant.',
  'payment.method.bankTransfer': 'Virement bancaire',
  'payment.method.cash': 'Espèces',
  'payment.method.card': 'Carte',
  'payment.method.app': 'Appli de paiement',
  'payment.method.other': 'Autre chose',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Règlement',
  'settle.addPayment': 'Ajouter un paiement',
  'settle.action': 'Régler',
  'settle.empty.title': 'Tout le monde est à zéro',
  'settle.empty.body':
    'Aucun virement n’est nécessaire. Ajoutez une dépense et tout déséquilibre apparaîtra ici.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Soldes',
  'balances.count': {
    one: '{travellers} voyageur',
    many: '{travellers} voyageurs',
    other: '{travellers} voyageurs',
  },
  'balances.empty':
    'Les soldes apparaissent dès qu’une dépense a un payeur et un partage.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Par catégorie',
  'categories.againstBudget': 'Par rapport au budget du voyage',
  'categories.progressLabel': 'Dépensé par rapport au budget du voyage',
  'categories.empty':
    'Les lignes de budget et les dépenses se détaillent ici dès qu’il y a de quoi détailler.',
  'categories.legendLabel': 'Dépenses par catégorie',
  'categories.planned': '{amount} prévus',
  'categories.nothingSpent':
    "Rien de dépensé pour l'instant. Voici ce que vous avez prévu.",
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'moins de {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Pour qui l’argent a été dépensé',
  'memberBar.others': {
    one: '{others} autre voyageur',
    many: '{others} autres voyageurs',
    other: '{others} autres voyageurs',
  },
  'memberBar.notSplit': 'Non attribué',
  'totalTile.label': 'Dépenses totales du voyage',
  'totalTile.captionPlanned': '{amount} prévus pour tous les voyageurs',
  'totalTile.captionBudget': '{amount} de budget pour le voyage',
  'totalTile.yourShare': 'Votre part',
  'totalTile.youPaid': 'Vous avez payé',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Paiements enregistrés',
  'payments.empty.title': 'Aucun paiement pour l’instant',
  'payments.empty.body':
    'Dès que quelqu’un rembourse un solde, le virement est enregistré ici.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Vous pouvez consulter les coûts, pas les modifier',
  'readOnly.body':
    'Seuls les propriétaires du voyage et les personnes autorisées à le modifier peuvent ajouter, modifier ou supprimer des dépenses et enregistrer des paiements. Contactez un propriétaire si quelque chose doit changer.',
  'readOnly.empty':
    'Aucune dépense n’a encore été enregistrée pour ce voyage. Elles apparaîtront ici dès qu’un propriétaire ou un éditeur les ajoutera.',
  'readOnly.settleEmpty':
    'Aucun virement n’est nécessaire pour le moment. Un éventuel déséquilibre apparaîtrait ici.',
} satisfies TranslationOf<typeof En>

export default messages
