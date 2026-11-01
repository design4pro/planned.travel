/**
 * The world tracker and the map chrome, in French.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** «Carte du monde» for the atlas module — the words
 * `fr/shell.ts` already uses for `nav.atlas` — «voyage» for a trip and «liste
 * d’envies» for the bucket list. The traveller's log of visits is «votre
 * carnet», one word chosen once and kept through the search, the stats and the
 * write actions. The address is «vous» throughout, matching the rest of the
 * catalogue, and a non-breaking space precedes `?`, `:` and `;` as French
 * typography requires.
 *
 * **Plural.** `Intl.PluralRules('fr')` reports `one`, `many` and `other`;
 * `many` covers the million-scale round numbers and reads like `other`, the
 * same three branches the rest of the French catalogue writes.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks French uses, and the parity suite exempts them
 * structurally. `continent.europe` is «Continent européen» rather than the
 * homograph «Europe», so the label reads as French instead of tripping the
 * untranslated check.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  'panel.stats.empty.title': 'Rien à compter pour le moment',
  'panel.stats.empty.body':
    'Marquez un pays sur la carte ou planifiez un voyage pour voir vos chiffres ici.',
  'panel.stats.empty.action': 'Planifier un voyage',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Carte du monde. Aucun pays marqué comme visité pour l’instant.',
  'screen.world.summary':
    'Carte du monde avec {visited} pays sur {total} marqués comme visités.',
  'screen.error.title': 'La carte du monde ne s’est pas chargée',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Chargement de la carte',
  'map.controls.label': 'Commandes de la carte',
  'map.controls.zoomIn': 'Zoom avant',
  'map.controls.zoomOut': 'Zoom arrière',
  'map.controls.north': 'Orienter vers le nord',
  'map.controls.locate': 'Trouver ma position',
  'map.controls.locateFailed': 'Nous n’avons pas pu obtenir votre position.',
  'map.controls.locateFailedBody':
    'Vérifiez que l’accès à la position est autorisé pour ce site, puis réessayez.',

  'map.attribution.label': 'Données cartographiques de',
  'map.attribution.geocoder': 'Lieux localisés avec',

  'map.basemap.title': 'Fond de carte indisponible',
  'map.basemap.body':
    'Le détail des rues est hors ligne. Chaque lieu reste affiché à sa position réelle, les distances et les regroupements restent donc exacts.',
  'map.basemap.credit': 'Traits de côte de',
  'map.basemap.retry': 'Réessayer',
  'map.basemap.retrying': 'Recherche du fond de carte',

  'map.engine.unsupported.title': 'Affichage de la carte indisponible',
  'map.engine.unsupported.body':
    'Ce navigateur ne peut pas exécuter la carte interactive : il lui faut WebGL2, et aucun contexte WebGL2 n’est disponible ici. Rien d’autre sur cet écran n’en dépend.',
  'map.engine.stalled.title': 'La carte n’a encore rien dessiné',
  'map.engine.stalled.body':
    'Rien n’est apparu dans le temps accordé à la carte pour démarrer. Elle peut encore se rattraper d’elle-même ; rien d’autre sur cet écran n’en dépend.',

  'map.coverage.partial.title': 'Détail des rues partiel',
  'map.coverage.partial.body': {
    one: 'Les données cartographiques publiées ne couvrent pas {outside} lieu de ce voyage. Il est dessiné à sa position réelle sur nos propres traits de côte.',
    many: 'Les données cartographiques publiées ne couvrent pas {outside} lieux de ce voyage. Ils sont dessinés à leurs positions réelles sur nos propres traits de côte.',
    other:
      'Les données cartographiques publiées ne couvrent pas {outside} lieux de ce voyage. Ils sont dessinés à leurs positions réelles sur nos propres traits de côte.',
  },
  'map.coverage.none.title': 'Aucun détail des rues ici',
  'map.coverage.none.body':
    'Les rues ne sont pas encore publiées pour cette région. Les traits de côte, les épingles et les itinéraires qui les relient sont tous réels — seuls les bâtiments et les routes manquent.',
  'map.coverage.dismiss': 'Fermer la note sur la couverture de la carte',

  'map.legend.title': 'Légende',
  'map.legend.collapse': 'Replier {title}',
  'map.legend.expand': 'Déplier {title}',
  'map.legend.dayPin': 'Exemple d’épingle de journée',
  'map.legend.dayPinMeaning': 'Journée de l’itinéraire',
  'map.legend.clusterPin': 'Exemple d’épingle groupée',
  'map.legend.clusterPinMeaning': 'Lieux regroupés',

  'map.filter.label': 'Filtrer les lieux par catégorie',
  'map.filter.all': 'Tous',
  'map.filter.category': {
    one: '{name} · {places} lieu',
    many: '{name} · {places} lieux',
    other: '{name} · {places} lieux',
  },

  'map.pin.day': 'Jour {day}',
  'map.pin.cluster': {
    one: '{places} lieu — zoomez pour l’isoler',
    many: '{places} lieux — zoomez pour les séparer',
    other: '{places} lieux — zoomez pour les séparer',
  },

  'map.place.rating': 'Noté {rating} sur {max}',
  'map.place.clause.day': 'jour {day}',
  'map.place.clause.rating': 'noté {rating} sur {max}',
  'map.place.clause.visited': 'visité',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Dernière visite',
  'legend.recent': {
    one: 'Au cours de la dernière année',
    many: 'Au cours des {years} dernières années',
    other: 'Au cours des {years} dernières années',
  },
  'legend.middle': 'Il y a {from}–{to} ans, ou sans date',
  'legend.distant': {
    one: 'Il y a plus de {years} an',
    many: 'Il y a plus de {years} ans',
    other: 'Il y a plus de {years} ans',
  },
  'legend.unvisited': 'Pas encore visité',
  'legend.note':
    'La teinte ne montre que l’ancienneté — l’onglet Pays écrit chaque date en toutes lettres.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Couverture du monde',
  'panel.coverage.unit': 'sur {total}',
  'panel.coverage.caption': '{share} du monde · {visits}',
  'panel.progress.label': 'En route vers chaque pays',
  'panel.progress.remaining': 'Encore {remaining}',
  'panel.toggle.hide': 'Masquer les détails de la carte du monde',
  'panel.toggle.show': 'Afficher les détails de la carte du monde',
  'panel.tabs.label': 'Sections de la carte du monde',
  'panel.tab.country': 'Pays',
  'panel.tab.stats': 'Statistiques',
  'panel.tab.bucket': 'Liste d’envies',
  'panel.back': 'Tous les pays',
  'panel.list.label': 'Pays visités',
  'panel.loading': 'Chargement de votre carte du monde',

  'panel.empty.blank.title': 'Votre carte est encore vierge',
  'panel.empty.blank.body':
    'Marquez un pays comme visité et il se remplit ici sur la carte, avec sa première et sa dernière visite, le nombre de vos séjours et tout ce que vous avez noté à son sujet.',
  'panel.empty.pick.title': 'Choisissez un pays',
  'panel.empty.pick.body':
    'Choisissez-en un sur la carte, dans le champ de recherche ou dans la liste, et sa fiche complète s’ouvre ici — première visite, dernière visite, le décompte et votre note.',

  'panel.stat.places': 'Vos lieux',
  'panel.stat.placesNone': 'Rien d’épinglé sur un voyage pour l’instant',
  'panel.stat.placesCaption': 'Sites, hébergements et étapes enregistrés',
  'panel.stat.regions': 'Vos régions',
  'panel.stat.regionsNone': 'Aucune région marquée pour l’instant',
  'panel.stat.regionsCaption': 'États, provinces, préfectures',
  'panel.stat.visits': 'Vos visites',
  'panel.stat.visitsCaption': 'Chaque arrivée enregistrée',
  'panel.stat.trips': 'Vos voyages',
  'panel.stat.tripsCaption': 'Tous les voyages auxquels vous participez',
  'panel.stat.cities': 'Vos villes',
  'panel.stat.citiesCaption': 'Villes où vous avez dormi ou fait étape',
  'panel.stat.days': 'Vos jours de voyage',
  'panel.stat.daysCaption': 'Sur l’ensemble des voyages de votre carnet',
  'panel.continents.label': 'Pays par continent',

  'panel.bucket.empty.title': 'Rien sur la liste',
  'panel.bucket.empty.body':
    'Un endroit où vous avez toujours voulu aller. Ajoutez-le, et cochez-le une fois sur place.',
  'panel.bucket.label': 'Liste d’envies',
  'panel.bucket.progress': '{done} sur {total} cochés',
  'panel.bucket.done': 'Fait',
  'panel.bucket.toGo': 'À faire',
  'panel.bucket.target': 'd’ici {year}',
  'panel.bucket.hidden': {
    one: 'Encore {entries} entrée sur votre liste, non affichée ici.',
    many: 'Encore {entries} entrées sur votre liste, non affichées ici.',
    other: 'Encore {entries} entrées sur votre liste, non affichées ici.',
  },
  'panel.bucket.kind.country': 'Pays',
  'panel.bucket.kind.region': 'Région',
  'panel.bucket.kind.place': 'Lieu',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afrique',
  'continent.antarctica': 'Antarctique',
  'continent.asia': 'Asie',
  'continent.europe': 'Continent européen',
  'continent.northAmerica': 'Amérique du Nord',
  'continent.oceania': 'Océanie',
  'continent.southAmerica': 'Amérique du Sud',
  'continent.unknown': 'Continent non renseigné',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Visité',
  'record.firstVisit': 'Première visite',
  'record.lastVisit': 'Dernière visite',
  'record.visitDates': 'Dates des visites',
  'record.notRecorded': 'Non renseigné',
  'record.datesUnrecorded': 'Dates non renseignées',
  'record.visits': {
    one: '{visits} visite',
    many: '{visits} visites',
    other: '{visits} visites',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Première visite {from}',
  'record.spanTo': 'Dernière visite {to}',
  'record.visitsUnit': { one: 'visite', many: 'visites', other: 'visites' },
  'record.gap.days': {
    one: 'à {gap} jour d’écart',
    many: 'à {gap} jours d’écart',
    other: 'à {gap} jours d’écart',
  },
  'record.gap.months': {
    one: 'à {gap} mois d’écart',
    many: 'à {gap} mois d’écart',
    other: 'à {gap} mois d’écart',
  },
  'record.gap.years': {
    one: 'à {gap} an d’écart',
    many: 'à {gap} ans d’écart',
    other: 'à {gap} ans d’écart',
  },
  'record.note.empty': 'Pas encore de note',
  'record.noOutline':
    'Les contours du monde que cette carte dessine sont découpés au 1:110m, ce qui fond ce territoire dans son État de rattachement — il n’y a donc rien à cadrer sur la carte. La visite compte quand même.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ordonner les pays',
  'list.sort.code': 'Code pays',
  'list.sort.codeStatement': 'Classés par code pays, de A à Z.',
  'list.sort.name': 'Nom du pays',
  'list.sort.nameStatement':
    'Classés par nom de pays, de A à Z, puis par code pays.',
  'list.sort.recent': 'Visite la plus récente',
  'list.sort.recentStatement':
    'Classés de la visite la plus récente à la plus ancienne, puis par code pays.',
  'list.sort.visits': 'Le plus de visites',
  'list.sort.visitsStatement':
    'Classés du plus grand nombre de visites au plus petit, puis par code pays.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Fondu dans son État de rattachement par les contours du monde, il n’y a donc rien à cadrer sur la carte.',
  'list.announce.selected': '{name} sélectionné.',
  'list.announce.selectedUnframed': '{name} sélectionné. {reason}',
  'list.empty.title': 'Aucun pays sur la carte pour l’instant',
  'list.empty.body':
    'Un pays apparaît ici dès qu’une visite y est enregistrée, avec la première arrivée, la plus récente et le nombre de vos séjours.',
  'list.loading': 'Chargement des pays visités',
  'list.error.title': 'Vos pays ne se sont pas chargés',
  'list.error.body':
    'La carte du monde n’a pas pu lire vos pays visités à l’instant. Rien n’est perdu — ils sont toujours enregistrés.',
  'list.error.retry': 'Réessayer',
  'list.error.retrying': 'Chargement de vos pays',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Trouver un pays',
  'search.loading': 'Chargement de vos pays',
  'search.placeholder': 'Nom du pays ou code',
  'search.entry.notVisited': 'Pas encore visité',
  'search.entry.noOutline': 'aucun contour sur la carte',
  'search.entry.separator': ' · ',
  'search.cleared': 'Sélection effacée.',
  'search.unframed':
    '{name} n’a pas de contour à l’échelle du monde, la carte n’a donc rien à cadrer.',
  'search.unframedVisited':
    '{name} n’a pas de contour à l’échelle du monde, la carte n’a donc rien à cadrer. Sa fiche n’est pas affectée.',
  'search.results.empty':
    'Aucun pays sur votre carnet pour l’instant. Tapez pour chercher parmi tous les pays du monde.',
  'search.results.emptyPinned':
    '{name} est sélectionné. Aucun pays sur votre carnet pour l’instant — tapez pour chercher parmi tous les pays du monde.',
  'search.results.record': {
    one: '{countries} pays sur votre carnet.',
    many: '{countries} pays sur votre carnet.',
    other: '{countries} pays sur votre carnet.',
  },
  'search.results.capped': 'Les {shown} premiers sont affichés.',
  'search.results.pinned': '{name} est sélectionné et affiché en premier.',
  'search.results.none': 'Aucun pays ne correspond à {term}.',
  'search.results.matches': {
    one: '{countries} pays correspond à {term}.',
    many: '{countries} pays correspondent à {term}.',
    other: '{countries} pays correspondent à {term}.',
  },
  'search.announce.selected': '{name} sélectionné.',
  'search.announce.framing': '{name} sélectionné. La carte le cadre.',
  'search.announce.unframed': '{name} sélectionné. {reason}',
  'search.empty.title': 'Rien sur votre carnet pour l’instant',
  'search.empty.body':
    'Tapez le nom d’un pays, ou son code à deux lettres, pour le trouver sur la carte.',
  'search.empty.noMatchTitle': 'Aucun pays ne correspond à « {term} »',
  'search.empty.noMatchBody':
    'Vérifiez l’orthographe, ou essayez le code à deux lettres — PT trouve le Portugal. Les {countries} pays du monde sont tous là, visités ou non.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Votre carnet',
  'actions.visit.absent.title': 'Non visité',
  'actions.visit.absent.caption': 'Une visite sans voyage derrière elle.',
  'actions.visit.title': 'Visité',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Pas sur la liste',
  'actions.goal.absent.caption': 'Un endroit où vous comptez aller.',
  'actions.goal.title': 'Sur la liste d’envies',
  'actions.goal.waiting': 'Attend son tour.',
  'actions.goal.target': 'Objectif : {year}.',
  'actions.goal.achieved.title': 'Coché sur la liste',
  'actions.goal.achieved.caption':
    'Vous y êtes arrivé. L’entrée reste comme trace.',

  'actions.button.remove': 'Retirer',
  'actions.button.mark': 'Marquer visité',
  'actions.button.add': 'Ajouter à la liste',
  'actions.visit.remove.name': 'Retirer {name} de votre carte du monde',
  'actions.visit.remove.busy': 'Retrait de {name} de votre carte du monde',
  'actions.visit.add.name': 'Marquer visité, {name}',
  'actions.visit.add.busy': 'Marquage de {name} comme visité',
  'actions.goal.remove.name': 'Retirer {name} de votre liste d’envies',
  'actions.goal.remove.busy': 'Retrait de {name} de votre liste d’envies',
  'actions.goal.add.name': 'Ajouter à la liste, {name}',
  'actions.goal.add.busy': 'Ajout de {name} à votre liste d’envies',

  'actions.hint':
    'Les deux prennent effet immédiatement, et les deux s’annulent ici.',
  'actions.offline':
    'Votre appareil n’a pas pu joindre le serveur. Vérifiez la connexion et réessayez.',
  'actions.toast.marked': 'Marqué comme visité',
  'actions.toast.markedBody': '{name} est sur votre carte du monde.',
  'actions.toast.markFailed': '{name} n’a pas été marqué',
  'actions.toast.unmarked': 'Retiré de votre carte du monde',
  'actions.toast.unmarkedBody': '{name} n’est plus marqué comme visité.',
  'actions.toast.unmarkFailed': '{name} n’a pas été retiré',
  'actions.toast.listed': 'Ajouté à votre liste d’envies',
  'actions.toast.listedBody': '{name} est un endroit où vous comptez aller.',
  'actions.toast.listFailed': '{name} n’a pas été ajouté',
  'actions.toast.unlisted': 'Retiré de votre liste d’envies',
  'actions.toast.unlistedBody': '{name} n’est plus sur la liste.',
  'actions.toast.unlistFailed': '{name} n’a pas été retiré',
  'actions.toast.fallback':
    'La modification n’a pas atteint le serveur. Réessayez dans un instant.',

  'actions.confirm.visit.title': 'Retirer {name} de votre carte du monde ?',
  'actions.confirm.visit.body': {
    one: '{visits} visite enregistrée{dates} serait effacée{note}. Vos voyages et vos lieux enregistrés ne sont pas touchés.',
    many: '{visits} visites enregistrées{dates} seraient effacées{note}. Vos voyages et vos lieux enregistrés ne sont pas touchés.',
    other:
      '{visits} visites enregistrées{dates} seraient effacées{note}. Vos voyages et vos lieux enregistrés ne sont pas touchés.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', ainsi que la note que vous aviez écrite',
  'actions.confirm.goal.title': 'Retirer {name} de votre liste d’envies ?',
  'actions.confirm.goal.body':
    'L’entrée est déjà cochée, ce retrait efface donc aussi la trace que vous y êtes arrivé. Votre carte du monde et vos voyages ne sont pas touchés.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Voyage de l’espace de travail',
    many: 'Voyages de l’espace de travail',
    other: 'Voyages de l’espace de travail',
  },
  'card.visits': { one: 'Visite', many: 'Visites', other: 'Visites' },
  'card.places': {
    one: 'Lieu de l’espace de travail',
    many: 'Lieux de l’espace de travail',
    other: 'Lieux de l’espace de travail',
  },
  'card.firstTrip': 'Premier voyage',
  'card.lastTrip': 'Dernier voyage',
  'card.firstVisit': 'Première visite',
  'card.lastVisit': 'Dernière visite',
  'card.absent': 'Non renseigné',
  'card.loading': 'Chargement du pays',
  'card.loadingNamed': 'Chargement de {name}',
  'card.error.body': 'Ces chiffres ne se sont pas chargés. Rien n’est perdu.',
  'card.error.retry': 'Réessayer',
  'overlay.close': 'Fermer {name}',
  'regions.label': 'Régions',
  'regions.hint': 'Ajouter une région marque aussi {country} comme visité.',
  'regions.keeps':
    'Supprimer une région ne retire pas {country} de votre atlas.',
  'regions.keeps.unvisited':
    'Ces régions restent enregistrées. Marquez {country} comme visité ou ajoutez une région pour le retrouver sur la carte.',
  'regions.empty.title': 'Aucune région enregistrée ici',
  'regions.empty.body':
    'Ajoutez un État, une province ou une zone visitée dans ce pays : {country}.',
  'regions.input.label': 'Ajouter une région : {country}',
  'regions.input.placeholder': 'Par exemple, la Bavière',
  'regions.add': 'Ajouter une région',
  'regions.adding': 'Ajout de {region}',
  'regions.remove': 'Supprimer {region}',
  'regions.loading': 'Chargement de vos régions',
  'regions.status.added': '{region} ajouté',
  'regions.status.exists': '{region} est déjà enregistré',
  'regions.status.removed': '{region} supprimé',
  'regions.status.addedCountry':
    '{region} ajouté. {country} est maintenant marqué comme visité.',
  'regions.error.invalid': 'Saisissez un nom de région.',
  'regions.error.hidden':
    'Ce nom contient des caractères non autorisés. Retirez-les et réessayez.',
  'regions.error.load': 'Impossible de charger vos régions : {country}.',
  'regions.error.add': 'Impossible d’ajouter {region}. Réessayez.',
  'regions.error.remove': 'Impossible de supprimer {region}. Réessayez.',
  'regions.error.full':
    'Vous avez enregistré {limit} régions. Supprimez-en une pour en ajouter une autre.',
  'regions.reload': 'Recharger les régions',
  'actions.confirm.visitRegions.body': {
    one: '{history}Les régions enregistrées dans ce pays ({country}) restent dans vos données : {count}.',
    many: '{history}Les régions enregistrées dans ce pays ({country}) restent dans vos données : {count}.',
    other:
      '{history}Les régions enregistrées dans ce pays ({country}) restent dans vos données : {count}.',
  },
  'regions.error.uncertain':
    'La modification n’a pas pu être confirmée. Rechargez vos régions pour vérifier les données enregistrées.',
  'regions.status.refreshFailed':
    '{result} L’atlas n’a pas pu être actualisé. Rechargez-le pour mettre la carte à jour.',

  'panel.stat.periodLabel': 'Afficher les chiffres pour',
  'panel.stat.allTime': 'Toute la période',
  'panel.stat.groupAll': 'Chiffres pour toute la période',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Chiffres pour {year}',
  'panel.stat.announceAll': 'Affichage des chiffres pour toute la période.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Affichage des chiffres pour {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Voyages commençant en {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'Lors des voyages commençant en {year}',
  'panel.stat.countries': 'Pays de vos voyages',
  'panel.stat.countriesCaption': 'Pays distincts de ces voyages',
  'panel.stat.streak': 'Votre série annuelle',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'Des voyages chaque année, de {first} à {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Un voyage en {last}',
  'panel.stat.streakNone':
    'Ajoutez un voyage avec des dates pour commencer une série',
  'visitEdit.edit': 'Modifier la visite',
  'visitEdit.note': 'Note de visite',
  'visitEdit.save': 'Enregistrer la visite',
  'visitEdit.cancel': 'Annuler',
  'visitEdit.loading': 'Chargement de la visite',
  'visitEdit.saving': 'Enregistrement de la visite',
  'visitEdit.failed':
    'Enregistrement non confirmé. Le brouillon est conservé ; réessaie.',
  'visitEdit.missing': 'Cette visite est indisponible. Rouvre le pays.',
  'visitEdit.noteInvalid': 'Utilise au maximum 2 000 caractères.',
  'visitEdit.bounds': 'La première visite ne peut pas suivre la dernière.',
  'visitEdit.future': 'Choisis aujourd’hui ou une date antérieure.',
  'visitEdit.dateInvalid': 'Saisis une date réelle au format AAAA-MM-JJ.',
  'visitEdit.reload': 'Enregistré. Recharger la fiche',
} satisfies TranslationOf<typeof En>

export default messages
