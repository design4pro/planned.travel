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
  'person.removedTarget': 'un voyageur retiré',
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
  'delete.payment.title': 'Supprimer ce paiement ?',
  'delete.payment.description':
    '« {title} » quitte le décompte. C’est irréversible. Pour corriger un paiement, enregistrez-le à nouveau.',
  'delete.payment.failedBody':
    'Le paiement n’a pas pu être supprimé. Réessayez dans un instant.',
  'delete.payment.confirm': 'Supprimer le paiement',
  'delete.payment.working': 'Suppression du paiement',

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
  'split.departed': 'A quitté le voyage',
  'split.departedHint':
    'Décocher une personne qui a quitté le voyage supprime définitivement sa part.',
  'split.includeFor': 'Inclure {name} dans ce partage',
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
  'expense.splitOff.title': 'Les parts enregistrées ne font pas le total',
  'expense.splitOff.body':
    'Elles totalisent {shares}, mais le total est de {total}. Vérifiez la répartition ci-dessous et enregistrez pour corriger.',
  'expense.what': 'C’était pour quoi',
  'expense.whatPlaceholder': 'Dîner au Kyubey',
  'expense.amountNotANumber': 'Saisissez le montant sous forme de nombre.',
  'expense.convertedTo': 'Converti en {currency}',
  'expense.convertedHint': 'Ce que {from} a donné en {to} sur votre relevé.',
  'expense.convertedSuggested':
    'Suggéré d’après le taux utilisé sur ce voyage le {date} ({rate}). Modifiez-le pour qu’il corresponde à votre relevé.',
  'expense.convertedNotANumber':
    'Saisissez le montant converti sous forme de nombre.',
  'expense.paidByHint':
    'Laissez sans payeur si vous notez un justificatif que personne n’a encore pris en charge.',
  'expense.nobodyYet': 'Personne encore',
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
  'payment.amountIn': 'Montant en {currency}',
  'payment.amountPositive': 'Saisissez un montant supérieur à zéro.',
  'payment.how': 'Comment',
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
  'memberBar.notSplit': 'Non réparti entre les voyageurs',
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
  'payments.delete': 'Supprimer le paiement de {from} à {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Ce voyage est archivé. Restaurez-le avant de modifier les dépenses.',
  'readOnly.title': 'Vous pouvez consulter les coûts, pas les modifier',
  'readOnly.body':
    'Seuls les propriétaires du voyage et les personnes autorisées à le modifier peuvent ajouter, modifier ou supprimer des dépenses et enregistrer des paiements. Contactez un propriétaire si quelque chose doit changer.',
  'readOnly.empty':
    'Aucune dépense n’a encore été enregistrée pour ce voyage. Elles apparaîtront ici dès qu’un propriétaire ou un éditeur les ajoutera.',
  'readOnly.settleEmpty':
    'Aucun virement n’est nécessaire pour le moment. Un éventuel déséquilibre apparaîtrait ici.',
  'refusal.rebaseChanged':
    'Le voyage a changé pendant votre confirmation : rien n’a donc été modifié. Vérifiez les nouveaux montants et confirmez à nouveau.',
  'refusal.tripCurrencyChanged':
    'La devise du budget de ce voyage est maintenant {to} : rien n’a donc été enregistré. La page a été actualisée : vérifiez le montant et enregistrez à nouveau.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Devise d’affichage',
  'display.indicator.perTrip': 'Devise propre',
  'display.indicator.fixed': 'Aussi en {code}',
  'display.menu.perTrip': 'Chaque voyage dans sa devise',
  'display.menu.workspace': '{code} (par défaut de l’espace)',
  'display.menu.rateHint': 'Utilise un taux déjà enregistré sur un voyage',
  'display.menu.currentHint':
    'Choisie, mais aucun taux enregistré ne la couvre',
  'display.menu.needsLiveRate':
    'Nécessite un taux en direct, pas encore disponible',
  'display.menu.disabledHint':
    'Les devises sans taux enregistré figurent dans la liste, mais ne peuvent pas être choisies : elles nécessitent un taux en direct, pas encore disponible.',
  'display.menu.saving': 'Enregistrement du choix',
  'display.error.title': 'La devise d’affichage n’a pas été enregistrée',
  'display.error.body':
    'Votre choix n’a pas pu être enregistré. Réessayez dans un instant.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Environ {amount} {code} dans votre devise d’affichage',
  'display.row.notConverted': 'Non converti',
  'display.alert.title': 'Certains montants ne sont pas convertis',
  'display.alert.body':
    'Aucun taux n’est enregistré pour ces paires de devises, ces montants restent donc dans la devise du budget :',
  'display.alert.pair': '{from} vers {to} le {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Changer la devise du budget',
  'rebase.title': 'Changer la devise du budget',
  'rebase.description':
    'Les montants que vous avez saisis restent tels quels. Les totaux et les soldes de ce voyage sont convertis dans la nouvelle devise.',
  'rebase.to': 'Nouvelle devise',
  'rebase.toPlaceholder': 'Choisissez une devise',
  'rebase.rateLabel': 'Taux de change (1 {from} en {to})',
  'rebase.rateInverse': 'Soit 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Saisissez un taux supérieur à zéro.',
  'rebase.rateOutOfRange':
    'Ce taux semble beaucoup trop grand ou trop petit. Vérifiez dans quel sens il va.',
  'rebase.source.recent': 'Le dernier taux utilisé dans cet espace',
  'rebase.source.manual': 'Le taux que vous avez saisi',
  'rebase.noRate':
    'Aucun taux n’est enregistré pour {from} vers {to}. Saisissez celui que vous voulez utiliser.',
  'rebase.waitingForRate': 'L’aperçu apparaît dès qu’il y a un taux.',
  'rebase.loading': 'Calcul de la conversion',
  'rebase.example':
    '{original} reste tel que vous l’avez saisi et est compté comme {converted}.',
  'rebase.count.expenses': {
    one: '{count} dépense sera comptée en {to}.',
    many: '{count} de dépenses seront comptées en {to}.',
    other: '{count} dépenses seront comptées en {to}.',
  },
  'rebase.count.payments': {
    one: '{count} paiement sera compté en {to}.',
    many: '{count} de paiements seront comptés en {to}.',
    other: '{count} paiements seront comptés en {to}.',
  },
  'rebase.count.planned': {
    one: '{count} élément prévu sera compté en {to}.',
    many: '{count} d’éléments prévus seront comptés en {to}.',
    other: '{count} éléments prévus seront comptés en {to}.',
  },
  'rebase.pinned':
    'Les prix des lieux, des réservations, des hébergements et des trajets restent en {from}.',
  'rebase.target': 'Le budget du voyage {before} devient {after}.',
  'rebase.rounding':
    'Chaque montant est arrondi une seule fois, un solde peut donc varier de {amount} au plus.',
  'rebase.leftover': 'Après le changement, {name} devrait {amount} à {other}.',
  'rebase.someone': 'Quelqu’un',
  'rebase.nothing':
    'Rien n’a encore de prix sur ce voyage, il n’y a donc rien à convertir.',
  'rebase.unconverted': {
    one: '{count} entrée est dans une devise autre que {from} et ne peut pas être convertie automatiquement. C’est en général une dépense créée à partir d’une réservation dont le prix est dans une autre devise : modifiez-la ou supprimez-la, puis réessayez.',
    many: '{count} d’entrées sont dans une devise autre que {from} et ne peuvent pas être converties automatiquement. Ce sont en général des dépenses créées à partir de réservations dont le prix est dans une autre devise : modifiez-les ou supprimez-les, puis réessayez.',
    other:
      '{count} entrées sont dans une devise autre que {from} et ne peuvent pas être converties automatiquement. Ce sont en général des dépenses créées à partir de réservations dont le prix est dans une autre devise : modifiez-les ou supprimez-les, puis réessayez.',
  },
  'rebase.unsplittable': {
    one: '{count} dépense a une répartition qui ne peut pas être reportée, car toutes ses parts sont à zéro. Modifiez-la ou supprimez-la, puis réessayez.',
    many: '{count} de dépenses ont une répartition qui ne peut pas être reportée, car toutes leurs parts sont à zéro. Modifiez-les ou supprimez-les, puis réessayez.',
    other:
      '{count} dépenses ont une répartition qui ne peut pas être reportée, car toutes leurs parts sont à zéro. Modifiez-les ou supprimez-les, puis réessayez.',
  },
  'rebase.outOfRange':
    'Avec ce taux, un montant du voyage serait trop grand pour être enregistré en {to}. Vérifiez le taux et son sens.',
  'rebase.tooLarge':
    'Ce voyage a trop d’entrées pour être modifié en une seule fois : il faudrait {changes} modifications à la fois et la limite est de {limit}. Le budget reste en {from} pour le moment.',
  'rebase.copyPending':
    'Ce voyage est encore en cours de copie. Réessayez dans un instant.',
  'rebase.error':
    'La conversion n’a pas pu être chargée. Rien n’a été modifié.',
  'rebase.commitError':
    'Nous n’avons pas pu changer la devise du budget. Rien n’a été modifié.',
  'rebase.stale':
    'La devise du budget du voyage est maintenant {current}, et non {from}. Fermez cette boîte de dialogue et rouvrez-la.',
  'rebase.sameCurrency':
    'Le budget est déjà en {to}. Choisissez une autre devise.',
  'rebase.commitUnknown':
    "Nous n'avons pas pu confirmer si la devise du budget est passée en {to}. Rechargez la page pour vérifier avant de réessayer.",
  'rebase.retry': 'Réessayer',
  'rebase.confirm': 'Passer en {to}',
  'rebase.committing': 'Changement de la devise du budget',
  'rebase.done': 'Le budget est maintenant en {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Rien de dépensé pour l’instant',
  'screen.summary': '{expenses} · {spent} dépensés',
  'count.expenses': {
    one: '{expenses} dépense',
    many: '{expenses} dépenses',
    other: '{expenses} dépenses',
  },
  'screen.exportCsv': 'Exporter en CSV',
  'screen.addFirst': 'Ajouter la première dépense',
  'screen.empty.title': 'Aucune dépense pour l’instant',
  'screen.empty.body':
    'Notez vos dépenses au fil de l’eau. planned.travel les répartit entre tous les voyageurs et tient le total courant en {currency}.',
  'screen.filtered.title': 'Rien ne correspond à ces filtres',
  'screen.filtered.body':
    'Élargissez la recherche, choisissez un autre jour ou effacez les filtres pour revoir tout le voyage.',
  'export.empty.title': 'Rien à exporter',
  'export.empty.body': 'Aucune dépense ne correspond aux filtres actifs.',
  'export.ready.title': 'Export prêt',
  'export.ready.body': {
    one: '{expenses} dépense écrite dans le CSV.',
    many: '{expenses} dépenses écrites dans le CSV.',
    other: '{expenses} dépenses écrites dans le CSV.',
  },
  'export.csv.title': 'Titre',
  'export.csv.category': 'Catégorie',
  'export.csv.originalAmount': 'Montant d’origine',
  'export.csv.originalCurrency': 'Devise d’origine',
  'export.csv.rate': 'Taux',
  'export.csv.splitMethod': 'Mode de répartition',
  'export.csv.notes': 'Notes',
  'export.csv.amountIn': 'Montant en {currency}',
  'list.daySpent': '{amount} dépensés',
  'skeleton.loading': 'Chargement des dépenses',
  'row.noPayer': 'Pas encore de payeur',
  'row.youPaid': 'Vous avez payé',
  'row.paid': '{name} a payé',
  'row.notYourShare': 'pas votre part',
  'row.yourShare': '{amount} pour vous',
  'row.noteOn': 'Note sur {title}',
  'row.edit': 'Modifier {title}',
  'row.delete': 'Supprimer {title}',
  'row.saving': 'Enregistrement',
  'row.splitOff': 'Les parts ne font pas le total',
  'tile.owe.label': 'Vous devez',
  'tile.owe.settled': 'Vous êtes à jour',
  'tile.owe.pending': 'Réglez avant de rentrer chez vous',
  'tile.owe.to': 'À',
  'tile.owed.label': 'On vous doit',
  'tile.owed.none': 'On ne vous doit rien',
  'tile.owed.pending': 'Reste à vous rembourser',
  'tile.owed.from': 'De',
  'tile.outstanding.label': 'En attente',
  'tile.outstanding.none': 'Chaque dépense a un payeur',
  'tile.outstanding.some': {
    one: '{expenses} dépense sans payeur pour l’instant',
    many: '{expenses} dépenses sans payeur pour l’instant',
    other: '{expenses} dépenses sans payeur pour l’instant',
  },
  'category.accommodation': 'Hébergement',
  'category.transport': 'Transport',
  'category.food': 'Repas et boissons',
  'category.activities': 'Activités',
  'category.shopping': 'Achats',
  'category.fees': 'Frais et taxes',
  'category.insurance': 'Assurance',
  'category.other': 'Autres',
  'toolbar.summary.everything': 'Tout est affiché',
  'toolbar.summary.filtered': 'Filtré : {filters}',
  'toolbar.summary.search': 'correspondant à « {term} »',
  'write.added': 'Dépense ajoutée',
  'write.updated': 'Dépense mise à jour',
  'write.deleted': 'Dépense supprimée',
  'write.addFailed': 'La dépense n’a pas été ajoutée',
  'write.editFailed': 'La dépense n’a pas été enregistrée',
  'write.deleteFailed': 'La dépense n’a pas été supprimée',
  'write.paymentRecorded': 'Paiement enregistré',
  'write.paymentRecordedBody': 'Les deux soldes sont à jour.',
  'write.paymentFailed': 'Le paiement n’a pas été enregistré',
  'write.paymentDeleted': 'Paiement supprimé',
  'write.paymentDeleteFailed': 'Le paiement n’a pas été supprimé',
  'write.rolledBack': 'La modification a été annulée.',
  'expense.saveFallback':
    'La dépense n’a pas pu être enregistrée. Réessayez dans un instant.',
} satisfies TranslationOf<typeof En>

export default messages
