/**
 * The world tracker and the map chrome, in Swedish.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** "Världskarta" for the atlas module, "resa" for a trip and
 * "önskelista" for the bucket list — the same words `sv/shell.ts` already
 * uses. The traveller's log of visits is "din reselogg", one word chosen once
 * and kept through the search, the stats and the write actions. The address is
 * `du` throughout, which is simply how Swedish addresses anyone.
 *
 * **Plural.** `Intl.PluralRules('sv')` reports `one` and `other`, the same two
 * branches English needs. "Besök" and "år" stay unchanged after a numeral, so
 * a few `other` branches legitimately repeat their `one` text.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Swedish uses, and the parity suite exempts them
 * structurally. `panel.bucket.kind.region` is "Landsdel" rather than the
 * homograph "Region", so the label reads as Swedish instead of tripping the
 * untranslated check. Country codes sort in ASCII, so the code statement says
 * "A till Z" while the name statement says "A till Ö".
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  'panel.stats.empty.title': 'Inget att räkna ännu',
  'panel.stats.empty.body':
    'Markera ett land på kartan eller planera en resa, så börjar dina siffror visas här.',
  'panel.stats.empty.action': 'Planera en resa',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': 'Världskarta. Inga länder markerade som besökta ännu.',
  'screen.world.summary':
    'Världskarta med {visited} av {total} länder markerade som besökta.',
  'screen.error.title': 'Världskartan lästes inte in',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Kartan läses in',
  'map.controls.label': 'Kartkontroller',
  'map.controls.zoomIn': 'Zooma in',
  'map.controls.zoomOut': 'Zooma ut',
  'map.controls.north': 'Vänd mot norr',
  'map.controls.locate': 'Hitta min plats',
  'map.controls.locateFailed': 'Vi kunde inte hämta din plats.',
  'map.controls.locateFailedBody':
    'Kontrollera att platsåtkomst är tillåten för den här webbplatsen och försök sedan igen.',

  'map.attribution.label': 'Kartdata från',
  'map.attribution.geocoder': 'Platser hittade med',

  'map.basemap.title': 'Baskartan är inte tillgänglig',
  'map.basemap.body':
    'Gatudetaljerna är offline. Varje plats visas ändå på sin verkliga position, så avstånd och grupper förblir korrekta.',
  'map.basemap.credit': 'Kustlinjer från',
  'map.basemap.retry': 'Försök igen',
  'map.basemap.retrying': 'Letar efter baskartan',

  'map.engine.unsupported.title': 'Kartrendering är inte tillgänglig',
  'map.engine.unsupported.body':
    'Den här webbläsaren kan inte köra den interaktiva kartan: den kräver WebGL2, och ingen WebGL2-kontext finns här. Inget annat på skärmen är beroende av den.',
  'map.engine.stalled.title': 'Kartan har inte ritats ännu',
  'map.engine.stalled.body':
    'Inget dök upp under tiden kartan får på sig att starta. Den kan fortfarande komma igång av sig själv; inget annat på skärmen är beroende av den.',

  'map.coverage.partial.title': 'Delvisa gatudetaljer',
  'map.coverage.partial.body': {
    one: 'Den publicerade kartdatan når inte fram till {outside} av resans platser. Den ritas på sin verkliga position på våra egna kustlinjer.',
    other:
      'Den publicerade kartdatan når inte fram till {outside} av resans platser. De ritas på sina verkliga positioner på våra egna kustlinjer.',
  },
  'map.coverage.none.title': 'Inga gatudetaljer här',
  'map.coverage.none.body':
    'Gator är inte publicerade för den här regionen ännu. Kustlinjerna, nålarna och rutterna mellan dem är verkliga — bara byggnaderna och vägarna saknas.',
  'map.coverage.dismiss': 'Stäng noteringen om karttäckning',

  'map.legend.title': 'Teckenförklaring',
  'map.legend.collapse': 'Fäll ihop {title}',
  'map.legend.expand': 'Fäll ut {title}',
  'map.legend.dayPin': 'Exempel på dagsnål',
  'map.legend.dayPinMeaning': 'Dag i resplanen',
  'map.legend.clusterPin': 'Exempel på grupperad nål',
  'map.legend.clusterPinMeaning': 'Grupperade platser',

  'map.filter.label': 'Filtrera platser efter kategori',
  'map.filter.all': 'Alla',
  'map.filter.category': {
    one: '{name} · {places} plats',
    other: '{name} · {places} platser',
  },

  'map.pin.day': 'Dag {day}',
  'map.pin.cluster': {
    one: '{places} plats — zooma in för att se den för sig',
    other: '{places} platser — zooma in för att skilja dem åt',
  },

  'map.place.rating': 'Betyg {rating} av {max}',
  'map.place.clause.day': 'dag {day}',
  'map.place.clause.rating': 'betyg {rating} av {max}',
  'map.place.clause.visited': 'besökt',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Senaste besök',
  'legend.recent': {
    one: 'Under det senaste året',
    other: 'Under de senaste {years} åren',
  },
  'legend.middle': 'För {from}–{to} år sedan, eller utan datum',
  'legend.distant': {
    one: 'För mer än {years} år sedan',
    other: 'För mer än {years} år sedan',
  },
  'legend.unvisited': 'Inte besökt ännu',
  'legend.note':
    'Nyansen visar bara hur nyligen det var — fliken Land skriver ut varje datum.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Världstäckning',
  'panel.coverage.unit': 'av {total}',
  'panel.coverage.caption': '{share} av världen · {visits}',
  'panel.progress.label': 'På väg mot varje land',
  'panel.progress.remaining': '{remaining} kvar',
  'panel.toggle.hide': 'Dölj världskartans detaljer',
  'panel.toggle.show': 'Visa världskartans detaljer',
  'panel.tabs.label': 'Världskartans avsnitt',
  'panel.tab.country': 'Land',
  'panel.tab.stats': 'Statistik',
  'panel.tab.bucket': 'Önskelista',
  'panel.back': 'Alla länder',
  'panel.list.label': 'Besökta länder',
  'panel.loading': 'Din världskarta läses in',

  'panel.empty.blank.title': 'Din karta är fortfarande tom',
  'panel.empty.blank.body':
    'Markera ett land som besökt så fylls det i här på kartan — med första och senaste besöket, hur många gånger du varit där och vad du än skrev om det.',
  'panel.empty.pick.title': 'Välj ett land',
  'panel.empty.pick.body':
    'Välj ett på kartan, i sökfältet eller i listan, så öppnas hela posten här — första besöket, senaste besöket, räknaren och din anteckning.',

  'panel.stat.places': 'Dina platser',
  'panel.stat.placesNone': 'Inget fastnålat på någon resa ännu',
  'panel.stat.placesCaption': 'Sparade sevärdheter, boenden och stopp',
  'panel.stat.regions': 'Dina regioner',
  'panel.stat.regionsNone': 'Inga regioner markerade ännu',
  'panel.stat.regionsCaption': 'Delstater, provinser, prefekturer',
  'panel.stat.visits': 'Dina besök',
  'panel.stat.visitsCaption': 'Varje registrerad ankomst',
  'panel.stat.trips': 'Dina resor',
  'panel.stat.tripsCaption': 'Alla resor du är med på',
  'panel.stat.cities': 'Dina städer',
  'panel.stat.citiesCaption': 'Orter du sov eller stannade i',
  'panel.stat.days': 'Dina resdagar',
  'panel.stat.daysCaption': 'Över alla resor i din reselogg',
  'panel.continents.label': 'Länder per kontinent',

  'panel.bucket.empty.title': 'Inget på listan',
  'panel.bucket.empty.body':
    'Någonstans du alltid tänkt åka. Lägg till det och bocka av när du är framme.',
  'panel.bucket.label': 'Önskelista',
  'panel.bucket.progress': '{done} av {total} klara',
  'panel.bucket.done': 'Klart',
  'panel.bucket.toGo': 'Kvar',
  'panel.bucket.target': 'senast {year}',
  'panel.bucket.hidden': {
    one: '{entries} post till på din lista, som inte visas här.',
    other: '{entries} poster till på din lista, som inte visas här.',
  },
  'panel.bucket.kind.country': 'Land',
  'panel.bucket.kind.region': 'Landsdel',
  'panel.bucket.kind.place': 'Plats',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afrika',
  'continent.antarctica': 'Antarktis',
  'continent.asia': 'Asien',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'Nordamerika',
  'continent.oceania': 'Oceanien',
  'continent.southAmerica': 'Sydamerika',
  'continent.unknown': 'Kontinent inte angiven',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Besökt',
  'record.firstVisit': 'Första besöket',
  'record.lastVisit': 'Senaste besöket',
  'record.visitDates': 'Besöksdatum',
  'record.notRecorded': 'Inte registrerat',
  'record.datesUnrecorded': 'Datum inte registrerade',
  'record.visits': { one: '{visits} besök', other: '{visits} besök' },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Första besöket {from}',
  'record.spanTo': 'Senaste besöket {to}',
  'record.visitsUnit': { one: 'besök', other: 'besök' },
  'record.gap.days': {
    one: '{gap} dag emellan',
    other: '{gap} dagar emellan',
  },
  'record.gap.months': {
    one: '{gap} månad emellan',
    other: '{gap} månader emellan',
  },
  'record.gap.years': {
    one: '{gap} år emellan',
    other: '{gap} år emellan',
  },
  'record.note.empty': 'Ingen anteckning ännu',
  'record.noOutline':
    'Världskonturerna som kartan ritar är skurna i 1:110m, vilket viker in det här territoriet i dess moderland — så det finns inget att rama in på kartan. Besöket räknas ändå.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ordna länder',
  'list.sort.code': 'Landskod',
  'list.sort.codeStatement': 'Ordnade efter landskod, från A till Z.',
  'list.sort.name': 'Landsnamn',
  'list.sort.nameStatement':
    'Ordnade efter landsnamn, från A till Ö, sedan efter landskod.',
  'list.sort.recent': 'Senaste besöket först',
  'list.sort.recentStatement':
    'Ordnade med det senaste besöket först, sedan efter landskod.',
  'list.sort.visits': 'Flest besök',
  'list.sort.visitsStatement':
    'Ordnade med flest besök först, sedan efter landskod.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Invikt i sitt moderland av världskonturerna, så det finns inget att rama in på kartan.',
  'list.announce.selected': '{name} valt.',
  'list.announce.selectedUnframed': '{name} valt. {reason}',
  'list.empty.title': 'Inga länder på kartan ännu',
  'list.empty.body':
    'Ett land hamnar här i samma stund som ett besök registreras — med första ankomsten, den senaste och hur många gånger du varit där.',
  'list.loading': 'Besökta länder läses in',
  'list.error.title': 'Dina länder lästes inte in',
  'list.error.body':
    'Världskartan kunde inte läsa dina besökta länder just nu. Inget har gått förlorat — de är fortfarande registrerade.',
  'list.error.retry': 'Försök igen',
  'list.error.retrying': 'Dina länder läses in',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Hitta ett land',
  'search.loading': 'Dina länder läses in',
  'search.placeholder': 'Landsnamn eller kod',
  'search.entry.notVisited': 'Inte besökt ännu',
  'search.entry.noOutline': 'ingen kartkontur',
  'search.entry.separator': ' · ',
  'search.cleared': 'Valet rensat.',
  'search.unframed':
    '{name} har ingen kontur i världsskala, så kartan har inget att rama in.',
  'search.unframedVisited':
    '{name} har ingen kontur i världsskala, så kartan har inget att rama in. Posten påverkas inte.',
  'search.results.empty':
    'Inga länder i din reselogg ännu. Skriv för att söka bland världens alla länder.',
  'search.results.emptyPinned':
    '{name} är valt. Inga länder i din reselogg ännu — skriv för att söka bland världens alla länder.',
  'search.results.record': {
    one: '{countries} land i din reselogg.',
    other: '{countries} länder i din reselogg.',
  },
  'search.results.capped': 'De första {shown} visas.',
  'search.results.pinned': '{name} är valt och står först.',
  'search.results.none': 'Inget land matchar {term}.',
  'search.results.matches': {
    one: '{countries} land matchar {term}.',
    other: '{countries} länder matchar {term}.',
  },
  'search.announce.selected': '{name} valt.',
  'search.announce.framing': '{name} valt. Kartan ramar in det.',
  'search.announce.unframed': '{name} valt. {reason}',
  'search.empty.title': 'Inget i din reselogg ännu',
  'search.empty.body':
    'Skriv ett landsnamn, eller dess tvåbokstavskod, för att hitta det på kartan.',
  'search.empty.noMatchTitle': 'Inget land matchar ”{term}”',
  'search.empty.noMatchBody':
    'Kontrollera stavningen eller prova tvåbokstavskoden — PT hittar Portugal. Alla {countries} länder går att söka, vare sig du varit där eller inte.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Din reselogg',
  'actions.visit.absent.title': 'Inte besökt',
  'actions.visit.absent.caption': 'Ett besök utan någon resa bakom sig.',
  'actions.visit.title': 'Besökt',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Inte på listan',
  'actions.goal.absent.caption': 'Någonstans du tänker åka.',
  'actions.goal.title': 'På önskelistan',
  'actions.goal.waiting': 'Väntar på sin tur.',
  'actions.goal.target': 'Siktar på {year}.',
  'actions.goal.achieved.title': 'Avbockat från listan',
  'actions.goal.achieved.caption': 'Du kom fram. Posten står kvar som minne.',

  'actions.button.remove': 'Ta bort',
  'actions.button.mark': 'Markera som besökt',
  'actions.button.add': 'Lägg till på listan',
  'actions.visit.remove.name': 'Ta bort {name} från din världskarta',
  'actions.visit.remove.busy': 'Tar bort {name} från din världskarta',
  'actions.visit.add.name': 'Markera som besökt: {name}',
  'actions.visit.add.busy': 'Markerar {name} som besökt',
  'actions.goal.remove.name': 'Ta bort {name} från din önskelista',
  'actions.goal.remove.busy': 'Tar bort {name} från din önskelista',
  'actions.goal.add.name': 'Lägg till på listan: {name}',
  'actions.goal.add.busy': 'Lägger till {name} på din önskelista',

  'actions.hint': 'Båda slår igenom direkt, och båda kan ångras här.',
  'actions.offline':
    'Din enhet nådde inte servern. Kontrollera anslutningen och försök igen.',
  'actions.toast.marked': 'Markerat som besökt',
  'actions.toast.markedBody': '{name} finns nu på din världskarta.',
  'actions.toast.markFailed': '{name} markerades inte',
  'actions.toast.unmarked': 'Borttaget från din världskarta',
  'actions.toast.unmarkedBody': '{name} är inte längre markerat som besökt.',
  'actions.toast.unmarkFailed': '{name} togs inte bort',
  'actions.toast.listed': 'Tillagt på din önskelista',
  'actions.toast.listedBody': '{name} är någonstans du tänker åka.',
  'actions.toast.listFailed': '{name} lades inte till',
  'actions.toast.unlisted': 'Borttaget från din önskelista',
  'actions.toast.unlistedBody': '{name} står inte längre på listan.',
  'actions.toast.unlistFailed': '{name} togs inte bort',
  'actions.toast.fallback':
    'Ändringen nådde inte servern. Försök igen om en stund.',

  'actions.confirm.visit.title': 'Ta bort {name} från din världskarta?',
  'actions.confirm.visit.body': {
    one: '{visits} registrerat besök{dates} skulle rensas{note}. Dina resor och sparade platser rörs inte.',
    other:
      '{visits} registrerade besök{dates} skulle rensas{note}. Dina resor och sparade platser rörs inte.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', tillsammans med anteckningen du skrev',
  'actions.confirm.goal.title': 'Ta bort {name} från din önskelista?',
  'actions.confirm.goal.body':
    'Den är redan avbockad, så det här tar också bort beviset på att du kom fram. Din världskarta och dina resor rörs inte.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { one: 'Resa i arbetsytan', other: 'Resor i arbetsytan' },
  'card.visits': { one: 'Besök', other: 'Besök' },
  'card.places': { one: 'Plats i arbetsytan', other: 'Platser i arbetsytan' },
  'card.firstTrip': 'Första resan',
  'card.lastTrip': 'Senaste resan',
  'card.firstVisit': 'Första besöket',
  'card.lastVisit': 'Senaste besöket',
  'card.absent': 'Inte registrerat',
  'card.loading': 'Landet läses in',
  'card.loadingNamed': '{name} läses in',
  'card.error.body': 'Siffrorna lästes inte in. Inget har gått förlorat.',
  'card.error.retry': 'Försök igen',
  'overlay.close': 'Stäng {name}',
  'regions.label': 'Regioner',
  'regions.hint':
    'När du lägger till en region markeras även {country} som besökt.',
  'regions.keeps':
    'Att ta bort en region tar inte bort {country} från din atlas.',
  'regions.keeps.unvisited':
    'Regionerna finns kvar. Markera {country} som besökt eller lägg till en region för att visa landet på kartan igen.',
  'regions.empty.title': 'Inga regioner registrerade här ännu',
  'regions.empty.body':
    'Lägg till en delstat, provins eller ett område du besökt i {country}.',
  'regions.input.label': 'Lägg till en region i {country}',
  'regions.input.placeholder': 'Till exempel Bayern',
  'regions.add': 'Lägg till region',
  'regions.adding': 'Lägger till {region}',
  'regions.remove': 'Ta bort {region}',
  'regions.loading': 'Läser in dina regioner',
  'regions.status.added': '{region} har lagts till',
  'regions.status.exists': '{region} finns redan registrerad',
  'regions.status.removed': '{region} har tagits bort',
  'regions.status.addedCountry':
    '{region} har lagts till. {country} är nu markerat som besökt.',
  'regions.error.invalid': 'Ange ett regionnamn.',
  'regions.error.hidden':
    'Namnet innehåller otillåtna tecken. Ta bort dem och försök igen.',
  'regions.error.load': 'Vi kunde inte läsa in dina regioner för {country}.',
  'regions.error.add': 'Vi kunde inte lägga till {region}. Försök igen.',
  'regions.error.remove': 'Vi kunde inte ta bort {region}. Försök igen.',
  'regions.error.full':
    'Du har registrerat {limit} regioner. Ta bort en för att lägga till en annan.',
  'regions.reload': 'Läs in regioner igen',
  'actions.confirm.visitRegions.body': {
    one: '{history}Regionerna du registrerat i {country} finns kvar: {count}.',
    other:
      '{history}Regionerna du registrerat i {country} finns kvar: {count}.',
  },
  'regions.error.uncertain':
    'Ändringen kunde inte bekräftas. Läs in dina regioner igen för att se vad som sparades.',
  'regions.status.refreshFailed':
    '{result} Atlasen kunde inte uppdateras. Läs in den igen för att uppdatera kartan.',

  'panel.stat.periodLabel': 'Visa siffror för',
  'panel.stat.allTime': 'Alla år',
  'panel.stat.groupAll': 'Siffror för alla år',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Siffror för {year}',
  'panel.stat.announceAll': 'Visar siffror för alla år.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Visar siffror för {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Resor som börjar under {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'På resor som börjar under {year}',
  'panel.stat.countries': 'Länder på dina resor',
  'panel.stat.countriesCaption': 'Olika länder på dessa resor',
  'panel.stat.streak': 'Din följd av reseår',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'Resor varje år, från {first} till {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'En resa under {last}',
  'panel.stat.streakNone': 'Lägg till en resa med datum för att börja en följd',
} satisfies TranslationOf<typeof En>

export default messages
