/**
 * The world tracker and the map chrome, in Greek.
 *
 * Authored from `../en/atlas.ts` and from nothing else — `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations. Terminology follows the catalogue this locale already ships:
 * Άτλαντας for the tracker, ταξίδι for a trip, λίστα επιθυμιών for the bucket
 * list, χώρος εργασίας for the workspace.
 *
 * **Two branches.** `Intl.PluralRules` for `el` reports one and other, so
 * every plural message below carries exactly those two. Every number a reader
 * sees arrives already formatted; the `count` parameter only picks the branch.
 *
 * Country names stay English by design: `src/lib/atlas/country-names.ts` is a
 * frozen table, so sentences around `{name}` avoid case endings that would
 * demand a declined Greek name.
 */

import type En from '../en/atlas'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Παγκόσμιος χάρτης. Καμία χώρα δεν έχει σημειωθεί ακόμη ως επισκεφθείσα.',
  'screen.world.summary':
    'Παγκόσμιος χάρτης με {visited} από {total} χώρες σημειωμένες ως επισκεφθείσες.',
  'screen.error.title': 'Ο άτλαντας δεν φορτώθηκε',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Φόρτωση χάρτη',
  'map.controls.label': 'Χειριστήρια χάρτη',
  'map.controls.zoomIn': 'Μεγέθυνση',
  'map.controls.zoomOut': 'Σμίκρυνση',
  'map.controls.north': 'Στροφή προς τον βορρά',
  'map.controls.locate': 'Εύρεση της τοποθεσίας μου',
  'map.controls.locateFailed': 'Δεν μπορέσαμε να βρούμε την τοποθεσία σας.',
  'map.controls.locateFailedBody':
    'Ελέγξτε ότι επιτρέπεται η πρόσβαση στην τοποθεσία για αυτόν τον ιστότοπο και δοκιμάστε ξανά.',

  'map.attribution.label': 'Δεδομένα χάρτη από',

  'map.basemap.title': 'Ο βασικός χάρτης δεν είναι διαθέσιμος',
  'map.basemap.body':
    'Η λεπτομέρεια των δρόμων είναι εκτός σύνδεσης. Κάθε μέρος εξακολουθεί να εμφανίζεται στην πραγματική του θέση, οπότε οι αποστάσεις και οι ομάδες παραμένουν ακριβείς.',
  'map.basemap.credit': 'Ακτογραμμές από',
  'map.basemap.retry': 'Δοκιμάστε ξανά',
  'map.basemap.retrying': 'Έλεγχος για τον βασικό χάρτη',

  'map.engine.unsupported.title': 'Η απόδοση του χάρτη δεν είναι διαθέσιμη',
  'map.engine.unsupported.body':
    'Αυτό το πρόγραμμα περιήγησης δεν μπορεί να τρέξει τον διαδραστικό χάρτη: χρειάζεται WebGL2, και εδώ δεν υπάρχει. Τίποτε άλλο σε αυτή την οθόνη δεν εξαρτάται από αυτόν.',
  'map.engine.stalled.title': 'Ο χάρτης δεν έχει σχεδιαστεί ακόμη',
  'map.engine.stalled.body':
    'Τίποτα δεν εμφανίστηκε στον χρόνο που δίνεται στον χάρτη για να ξεκινήσει. Ίσως συνέλθει μόνος του· τίποτε άλλο σε αυτή την οθόνη δεν εξαρτάται από αυτόν.',

  'map.coverage.partial.title': 'Μερική λεπτομέρεια δρόμων',
  'map.coverage.partial.body': {
    one: 'Τα δημοσιευμένα δεδομένα χάρτη δεν φτάνουν σε {outside} μέρος αυτού του ταξιδιού. Σχεδιάζεται στην πραγματική του θέση πάνω στις δικές μας ακτογραμμές.',
    other:
      'Τα δημοσιευμένα δεδομένα χάρτη δεν φτάνουν σε {outside} μέρη αυτού του ταξιδιού. Σχεδιάζονται στις πραγματικές τους θέσεις πάνω στις δικές μας ακτογραμμές.',
  },
  'map.coverage.none.title': 'Καμία λεπτομέρεια δρόμων εδώ',
  'map.coverage.none.body':
    'Οι δρόμοι δεν έχουν δημοσιευτεί ακόμη για αυτή την περιοχή. Οι ακτογραμμές, οι πινέζες και οι διαδρομές ανάμεσά τους είναι όλες αληθινές — λείπουν μόνο τα κτίρια και οι δρόμοι.',
  'map.coverage.dismiss': 'Απόρριψη της σημείωσης κάλυψης του χάρτη',

  'map.legend.title': 'Υπόμνημα',
  'map.legend.collapse': 'Σύμπτυξη {title}',
  'map.legend.expand': 'Ανάπτυξη {title}',
  'map.legend.dayPin': 'Παράδειγμα πινέζας ημέρας',
  'map.legend.dayPinMeaning': 'Ημέρα δρομολογίου',
  'map.legend.clusterPin': 'Παράδειγμα ομαδοποιημένης πινέζας',
  'map.legend.clusterPinMeaning': 'Ομαδοποιημένα μέρη',

  'map.filter.label': 'Φιλτράρισμα μερών ανά κατηγορία',
  'map.filter.all': 'Όλα',
  'map.filter.category': {
    one: '{name} · {places} μέρος',
    other: '{name} · {places} μέρη',
  },

  'map.pin.day': 'Ημέρα {day}',
  'map.pin.cluster': {
    one: '{places} μέρος — μεγεθύνετε για να το δείτε χωριστά',
    other: '{places} μέρη — μεγεθύνετε για να τα ξεχωρίσετε',
  },

  'map.place.rating': 'Βαθμολογία {rating} στα {max}',
  'map.place.clause.day': 'ημέρα {day}',
  'map.place.clause.rating': 'βαθμολογία {rating} στα {max}',
  'map.place.clause.visited': 'επισκεφθήκατε',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Τελευταία επίσκεψη',
  'legend.recent': {
    one: 'Μέσα στον τελευταίο χρόνο',
    other: 'Μέσα στα τελευταία {years} χρόνια',
  },
  'legend.middle': '{from}–{to} χρόνια πριν, ή χωρίς ημερομηνία',
  'legend.distant': {
    one: 'Πάνω από {years} χρόνο πριν',
    other: 'Πάνω από {years} χρόνια πριν',
  },
  'legend.unvisited': 'Καμία επίσκεψη ακόμη',
  'legend.note':
    'Η απόχρωση δείχνει μόνο πόσο πρόσφατη ήταν η επίσκεψη — η καρτέλα «Χώρα» γράφει κάθε ημερομηνία.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Κάλυψη του κόσμου',
  'panel.coverage.unit': 'από {total}',
  'panel.coverage.caption': '{share} του κόσμου · {visits}',
  'panel.progress.label': 'Προς κάθε χώρα',
  'panel.progress.remaining': 'Απομένουν {remaining}',
  'panel.toggle.hide': 'Απόκρυψη λεπτομερειών άτλαντα',
  'panel.toggle.show': 'Εμφάνιση λεπτομερειών άτλαντα',
  'panel.tabs.label': 'Ενότητες άτλαντα',
  'panel.tab.country': 'Χώρα',
  'panel.tab.stats': 'Στατιστικά',
  'panel.tab.bucket': 'Λίστα επιθυμιών',
  'panel.back': 'Όλες οι χώρες',
  'panel.list.label': 'Χώρες που επισκεφθήκατε',
  'panel.loading': 'Φόρτωση του άτλαντά σας',

  'panel.empty.blank.title': 'Ο χάρτης σας είναι ακόμη κενός',
  'panel.empty.blank.body':
    'Σημειώστε μια χώρα ως επισκεφθείσα και θα χρωματιστεί εδώ στον χάρτη, με την πρώτη και την τελευταία επίσκεψη, πόσες φορές έχετε πάει και ό,τι γράψατε για αυτήν.',
  'panel.empty.pick.title': 'Διαλέξτε μια χώρα',
  'panel.empty.pick.body':
    'Διαλέξτε μία στον χάρτη, στο πεδίο αναζήτησης ή από τη λίστα, και εδώ ανοίγει το πλήρες αρχείο της — πρώτη επίσκεψη, τελευταία επίσκεψη, ο απολογισμός και η σημείωσή σας.',

  'panel.stat.places': 'Μέρη',
  'panel.stat.placesNone': 'Τίποτα καρφιτσωμένο σε ταξίδι ακόμη',
  'panel.stat.placesCaption': 'Αξιοθέατα, διαμονές και στάσεις αποθηκευμένα',
  'panel.stat.regions': 'Περιφέρειες',
  'panel.stat.regionsNone': 'Καμία περιφέρεια σημειωμένη ακόμη',
  'panel.stat.regionsCaption': 'Πολιτείες, επαρχίες, νομοί',
  'panel.stat.visits': 'Επισκέψεις',
  'panel.stat.visitsCaption': 'Κάθε καταγεγραμμένη άφιξη',
  'panel.stat.trips': 'Τα ταξίδια σας',
  'panel.stat.tripsCaption': 'Κάθε ταξίδι στο οποίο συμμετέχετε',
  'panel.stat.cities': 'Πόλεις',
  'panel.stat.citiesCaption': 'Πόλεις όπου κοιμηθήκατε ή σταματήσατε',
  'panel.stat.days': 'Ημέρες μακριά',
  'panel.stat.daysCaption': 'Σε κάθε ταξίδι του αρχείου σας',
  'panel.continents.label': 'Χώρες ανά ήπειρο',

  'panel.bucket.empty.title': 'Τίποτα στη λίστα',
  'panel.bucket.empty.body':
    'Κάπου που πάντα θέλατε να πάτε. Προσθέστε το, και διαγράψτε το όταν φτάσετε εκεί.',
  'panel.bucket.label': 'Λίστα επιθυμιών',
  'panel.bucket.progress': '{done} από {total} ολοκληρώθηκαν',
  'panel.bucket.done': 'Έγινε',
  'panel.bucket.toGo': 'Απομένουν',
  'panel.bucket.target': 'έως το {year}',
  'panel.bucket.hidden': {
    one: '{entries} ακόμη καταχώριση στη λίστα σας, δεν εμφανίζεται εδώ.',
    other: '{entries} ακόμη καταχωρίσεις στη λίστα σας, δεν εμφανίζονται εδώ.',
  },
  'panel.bucket.kind.country': 'Χώρα',
  'panel.bucket.kind.region': 'Περιφέρεια',
  'panel.bucket.kind.place': 'Μέρος',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Αφρική',
  'continent.antarctica': 'Ανταρκτική',
  'continent.asia': 'Ασία',
  'continent.europe': 'Ευρώπη',
  'continent.northAmerica': 'Βόρεια Αμερική',
  'continent.oceania': 'Ωκεανία',
  'continent.southAmerica': 'Νότια Αμερική',
  'continent.unknown': 'Η ήπειρος δεν έχει καταγραφεί',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Επισκεφθήκατε',
  'record.firstVisit': 'Πρώτη επίσκεψη',
  'record.lastVisit': 'Τελευταία επίσκεψη',
  'record.visitDates': 'Ημερομηνίες επισκέψεων',
  'record.notRecorded': 'Δεν έχει καταγραφεί',
  'record.datesUnrecorded': 'Οι ημερομηνίες δεν έχουν καταγραφεί',
  'record.visits': {
    one: '{visits} επίσκεψη',
    other: '{visits} επισκέψεις',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Πρώτη επίσκεψη {from}',
  'record.spanTo': 'Τελευταία επίσκεψη {to}',
  'record.visitsUnit': { one: 'επίσκεψη', other: 'επισκέψεις' },
  'record.gap.days': {
    one: 'με διαφορά {gap} ημέρας',
    other: 'με διαφορά {gap} ημερών',
  },
  'record.gap.months': {
    one: 'με διαφορά {gap} μήνα',
    other: 'με διαφορά {gap} μηνών',
  },
  'record.gap.years': {
    one: 'με διαφορά {gap} χρόνου',
    other: 'με διαφορά {gap} χρόνων',
  },
  'record.note.empty': 'Καμία σημείωση ακόμη',
  'record.noOutline':
    'Τα περιγράμματα του κόσμου που σχεδιάζει αυτός ο χάρτης κόβονται σε κλίμακα 1:110m, η οποία ενσωματώνει αυτή την επικράτεια στο μητρικό της κράτος — οπότε δεν υπάρχει τίποτα να πλαισιωθεί στον χάρτη. Η επίσκεψη μετράει κανονικά.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ταξινόμηση χωρών',
  'list.sort.code': 'Κωδικός χώρας',
  'list.sort.codeStatement': 'Ταξινομημένες κατά κωδικό χώρας, από A έως Z.',
  'list.sort.name': 'Όνομα χώρας',
  'list.sort.nameStatement':
    'Ταξινομημένες κατά όνομα χώρας, από A έως Z, μετά κατά κωδικό.',
  'list.sort.recent': 'Πιο πρόσφατη επίσκεψη',
  'list.sort.recentStatement':
    'Πρώτα η πιο πρόσφατη επίσκεψη, μετά κατά κωδικό χώρας.',
  'list.sort.visits': 'Περισσότερες επισκέψεις',
  'list.sort.visitsStatement':
    'Πρώτα οι περισσότερες επισκέψεις, μετά κατά κωδικό χώρας.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Ενσωματώνεται στο μητρικό της κράτος από τα περιγράμματα του κόσμου, οπότε δεν υπάρχει τίποτα να πλαισιωθεί στον χάρτη.',
  'list.announce.selected': 'Επιλέχθηκε: {name}.',
  'list.announce.selectedUnframed': 'Επιλέχθηκε: {name}. {reason}',
  'list.empty.title': 'Καμία χώρα στον χάρτη ακόμη',
  'list.empty.body':
    'Μια χώρα εμφανίζεται εδώ μόλις καταγραφεί μια επίσκεψη σε αυτήν, με την πρώτη άφιξη, την τελευταία και πόσες φορές έχετε πάει.',
  'list.loading': 'Φόρτωση χωρών που επισκεφθήκατε',
  'list.error.title': 'Οι χώρες σας δεν φορτώθηκαν',
  'list.error.body':
    'Ο άτλαντας δεν μπόρεσε να διαβάσει τις χώρες που επισκεφθήκατε αυτή τη στιγμή. Τίποτα δεν χάθηκε — παραμένουν καταγεγραμμένες.',
  'list.error.retry': 'Δοκιμάστε ξανά',
  'list.error.retrying': 'Φόρτωση των χωρών σας',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Βρείτε μια χώρα',
  'search.loading': 'Φόρτωση των χωρών σας',
  'search.placeholder': 'Όνομα ή κωδικός χώρας',
  'search.entry.notVisited': 'Καμία επίσκεψη ακόμη',
  'search.entry.noOutline': 'χωρίς περίγραμμα στον χάρτη',
  'search.entry.separator': ' · ',
  'search.cleared': 'Η επιλογή καθαρίστηκε.',
  'search.unframed':
    'Η χώρα {name} δεν έχει περίγραμμα σε παγκόσμια κλίμακα, οπότε ο χάρτης δεν έχει τίποτα να πλαισιώσει.',
  'search.unframedVisited':
    'Η χώρα {name} δεν έχει περίγραμμα σε παγκόσμια κλίμακα, οπότε ο χάρτης δεν έχει τίποτα να πλαισιώσει. Το αρχείο της δεν επηρεάζεται.',
  'search.results.empty':
    'Καμία χώρα στο αρχείο σας ακόμη. Πληκτρολογήστε για να αναζητήσετε κάθε χώρα του κόσμου.',
  'search.results.emptyPinned':
    'Η χώρα {name} είναι επιλεγμένη. Καμία χώρα στο αρχείο σας ακόμη — πληκτρολογήστε για να αναζητήσετε κάθε χώρα του κόσμου.',
  'search.results.record': {
    one: '{countries} χώρα στο αρχείο σας.',
    other: '{countries} χώρες στο αρχείο σας.',
  },
  'search.results.capped': 'Εμφανίζονται οι πρώτες {shown}.',
  'search.results.pinned':
    'Η χώρα {name} είναι επιλεγμένη και εμφανίζεται πρώτη.',
  'search.results.none': 'Καμία χώρα δεν ταιριάζει με {term}.',
  'search.results.matches': {
    one: '{countries} χώρα ταιριάζει με {term}.',
    other: '{countries} χώρες ταιριάζουν με {term}.',
  },
  'search.announce.selected': 'Επιλέχθηκε: {name}.',
  'search.announce.framing': 'Επιλέχθηκε: {name}. Ο χάρτης την πλαισιώνει.',
  'search.announce.unframed': 'Επιλέχθηκε: {name}. {reason}',
  'search.empty.title': 'Τίποτα στο αρχείο σας ακόμη',
  'search.empty.body':
    'Πληκτρολογήστε το όνομα μιας χώρας, ή τον διψήφιο κωδικό της, για να τη βρείτε στον χάρτη.',
  'search.empty.noMatchTitle': 'Καμία χώρα δεν ταιριάζει με «{term}»',
  'search.empty.noMatchBody':
    'Ελέγξτε την ορθογραφία, ή δοκιμάστε τον διψήφιο κωδικό — το PT βρίσκει την Πορτογαλία. Και οι {countries} χώρες είναι αναζητήσιμες, είτε έχετε πάει είτε όχι.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Το αρχείο σας',
  'actions.visit.absent.title': 'Καμία επίσκεψη',
  'actions.visit.absent.caption': 'Μια επίσκεψη χωρίς ταξίδι από πίσω της.',
  'actions.visit.title': 'Επισκεφθήκατε',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Εκτός λίστας',
  'actions.goal.absent.caption': 'Κάπου που σκοπεύετε να πάτε.',
  'actions.goal.title': 'Στη λίστα επιθυμιών',
  'actions.goal.waiting': 'Περιμένει τη σειρά του.',
  'actions.goal.target': 'Στόχος το {year}.',
  'actions.goal.achieved.title': 'Διαγράφηκε από τη λίστα',
  'actions.goal.achieved.caption':
    'Φτάσατε εκεί. Η καταχώριση μένει ως το αρχείο.',

  'actions.button.remove': 'Αφαίρεση',
  'actions.button.mark': 'Σημείωση επίσκεψης',
  'actions.button.add': 'Προσθήκη στη λίστα',
  'actions.visit.remove.name': 'Αφαίρεση της χώρας {name} από τον άτλαντά σας',
  'actions.visit.remove.busy': 'Αφαιρείται η χώρα {name} από τον άτλαντά σας',
  'actions.visit.add.name': 'Σημείωση επίσκεψης, {name}',
  'actions.visit.add.busy': 'Σημειώνεται η χώρα {name} ως επισκεφθείσα',
  'actions.goal.remove.name':
    'Αφαίρεση της χώρας {name} από τη λίστα επιθυμιών σας',
  'actions.goal.remove.busy':
    'Αφαιρείται η χώρα {name} από τη λίστα επιθυμιών σας',
  'actions.goal.add.name': 'Προσθήκη στη λίστα, {name}',
  'actions.goal.add.busy': 'Προστίθεται η χώρα {name} στη λίστα επιθυμιών σας',

  'actions.hint':
    'Και οι δύο ενέργειες ισχύουν αμέσως, και οι δύο αναιρούνται εδώ.',
  'actions.offline':
    'Η συσκευή σας δεν μπόρεσε να επικοινωνήσει με τον διακομιστή. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.',
  'actions.toast.marked': 'Σημειώθηκε ως επισκεφθείσα',
  'actions.toast.markedBody': 'Η χώρα {name} είναι στον άτλαντά σας.',
  'actions.toast.markFailed': 'Η χώρα {name} δεν σημειώθηκε',
  'actions.toast.unmarked': 'Αφαιρέθηκε από τον άτλαντά σας',
  'actions.toast.unmarkedBody':
    'Η χώρα {name} δεν είναι πια σημειωμένη ως επισκεφθείσα.',
  'actions.toast.unmarkFailed': 'Η χώρα {name} δεν αφαιρέθηκε',
  'actions.toast.listed': 'Προστέθηκε στη λίστα επιθυμιών σας',
  'actions.toast.listedBody':
    'Η χώρα {name} είναι κάπου που σκοπεύετε να πάτε.',
  'actions.toast.listFailed': 'Η χώρα {name} δεν προστέθηκε',
  'actions.toast.unlisted': 'Αφαιρέθηκε από τη λίστα επιθυμιών σας',
  'actions.toast.unlistedBody': 'Η χώρα {name} δεν είναι πια στη λίστα.',
  'actions.toast.unlistFailed': 'Η χώρα {name} δεν αφαιρέθηκε',
  'actions.toast.fallback':
    'Η αλλαγή δεν έφτασε στον διακομιστή. Δοκιμάστε ξανά σε λίγο.',

  'actions.confirm.visit.title':
    'Αφαίρεση της χώρας {name} από τον άτλαντά σας;',
  'actions.confirm.visit.body': {
    one: '{visits} καταγεγραμμένη επίσκεψη{dates} θα διαγραφεί{note}. Τα ταξίδια και τα αποθηκευμένα μέρη σας δεν θίγονται.',
    other:
      '{visits} καταγεγραμμένες επισκέψεις{dates} θα διαγραφούν{note}. Τα ταξίδια και τα αποθηκευμένα μέρη σας δεν θίγονται.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', μαζί με τη σημείωση που γράψατε',
  'actions.confirm.goal.title':
    'Αφαίρεση της χώρας {name} από τη λίστα επιθυμιών σας;',
  'actions.confirm.goal.body':
    'Έχει ήδη διαγραφεί από τη λίστα, οπότε αφαιρείται και η καταχώριση ότι φτάσατε εκεί. Ο άτλαντας και τα ταξίδια σας δεν θίγονται.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Ταξίδι του χώρου εργασίας',
    other: 'Ταξίδια του χώρου εργασίας',
  },
  'card.visits': { one: 'Επίσκεψη', other: 'Επισκέψεις' },
  'card.places': { one: 'Μέρος', other: 'Μέρη' },
  'card.firstTrip': 'Πρώτο ταξίδι',
  'card.lastTrip': 'Τελευταίο ταξίδι',
  'card.firstVisit': 'Πρώτη επίσκεψη',
  'card.lastVisit': 'Τελευταία επίσκεψη',
  'card.absent': 'Δεν έχει καταγραφεί',
  'card.loading': 'Φόρτωση αυτής της χώρας',
  'card.loadingNamed': 'Φόρτωση: {name}',
  'card.error.body': 'Αυτά τα στοιχεία δεν φορτώθηκαν. Τίποτα δεν χάθηκε.',
  'card.error.retry': 'Δοκιμάστε ξανά',
  'overlay.close': 'Κλείσιμο {name}',
} satisfies TranslationOf<typeof En>

export default messages
