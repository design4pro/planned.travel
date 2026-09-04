/**
 * The trip modules' own copy, in nl.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Meervoud.** `one` · `other`. **Typografie.** Nederlands citeert met „…”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Niet ingesteld',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Verbinden',
  'presence.connecting.body': 'We stappen de livekamer van deze reis binnen.',
  'presence.live.title': 'Direct',
  'presence.live.body':
    'Berichten, notities en stemmen komen hier binnen zodra ze er zijn.',
  'presence.reconnecting.title': 'Opnieuw verbinden',
  'presence.reconnecting.body':
    'De verbinding viel weg. We proberen het opnieuw — alles wat je stuurt wordt alsnog opgeslagen.',
  'presence.offline.title': 'Niet live',
  'presence.offline.body':
    'Live-updates staan uit. Er wordt nog gewoon opgeslagen; herlaad of probeer opnieuw om bij te komen.',
  'presence.reconnect': 'Opnieuw verbinden',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Alle trajecten',
  'transports.empty.title': 'Nog geen trajecten',
  'transports.empty.body':
    'Vluchten, treinen, veerboten en de rit van het vliegveld wonen hier, met hun boekingscodes en stoelnummers bij de hand op de dag zelf — en elke overstap gecheckt tegen de vorige.',
  'transports.empty.action': 'Voeg het eerste traject toe',
  'transports.filtered.title': 'Geen trajecten van dat soort',
  'transports.filtered.body':
    'Elk traject van deze reis gaat anders. Ga terug naar „{label}” om ze allemaal te zien.',
  'transports.filtered.action': 'Toon alle trajecten',
  'transports.alert.impossible.title': {
    one: 'Eén overstap kan niet',
    other: '{value} overstappen kunnen niet',
  },
  'transports.alert.impossible.body':
    'Een traject vertrekt voordat het vorige aankomt. De knooppunten hieronder zeggen welke, en met hoeveel.',
  'transports.alert.tight.title': {
    one: 'Eén overstap is krap',
    other: '{value} overstappen zijn krap',
  },
  'transports.alert.tight.body':
    'Er is tijd, maar niet veel voor het vervoermiddel dat je haalt. De knooppunten hieronder tonen hoeveel elk je laat.',
  'transports.badge.impossible': {
    one: '{value} gebroken overstap',
    other: '{value} gebroken overstappen',
  },
  'transports.badge.tight': {
    one: '{value} krappe overstap',
    other: '{value} krappe overstappen',
  },
  'transports.badge.ok': 'Elke overstap klopt',
  'transports.remove.body':
    'Het traject gaat definitief van deze reis af, samen met het boekingsnummer en de stoel. Is het alleen geannuleerd, zet de status dan op Geannuleerd.',
  'transports.remove.confirm': 'Traject verwijderen',
  'transports.menu.edit': 'Traject bewerken…',
  'transports.field.service': 'Verbinding',
  'transports.field.bookingRef': 'Boekingsnummer',
  'transports.field.seat': 'Stoel',
  'transports.field.distance': 'Afstand',
  'transports.noTime': 'Nog geen tijd',
  'transports.toast.statusFailed.title': 'De status is niet gewijzigd',
  'transports.toast.statusFailed.body':
    'Het traject staat nog op de vorige stand.',
  'transports.toast.removed': 'Traject verwijderd',
  'transports.toast.removeFailed': 'Het traject is niet verwijderd',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Traject toevoegen',
  'transports.dialog.editTitle': 'Dit traject bewerken',
  'transports.dialog.description':
    'Vluchten, treinen, veerboten en de rit van het vliegveld. De tijden zijn de lokale die op het ticket staan.',
  'transports.form.modeLegend': 'Waarmee reis je',
  'transports.form.timingError': 'Controleer de tijden',
  'transports.field.namePlaceholder': 'KLM van AMS naar HND',
  'transports.field.place': 'Plek',
  'transports.field.code': 'Lettercode',
  'transports.field.date': 'Datum',
  'transports.field.departurePlaceholder': 'Amsterdam Schiphol',
  'transports.field.arrivalPlaceholder': 'Tokio Haneda',
  'transports.field.carrier': 'Vervoerder',
  'transports.field.serviceNumber': 'Verbindingsnummer',
  'transports.field.bookingRefHint': 'De code die je aan de balie voorleest.',
  'transports.field.notesPlaceholder':
    'Stoel aan het gangpad gevraagd. Bagage doorgecheckt naar Kioto.',
  'transports.action.add': 'Traject toevoegen',
  'transports.action.save': 'Traject opslaan',
  'transports.action.saving': 'Traject wordt opgeslagen',
  'transports.toast.added': 'Traject toegevoegd',
  'transports.toast.addedBody': 'Hij staat nu in de reisvolgorde.',
  'transports.toast.addFailed': 'Het traject is niet toegevoegd',
  'transports.toast.updated': 'Traject bijgewerkt',
  'transports.toast.updateFailed': 'Het traject is niet bijgewerkt',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Naam',
  'field.time': 'Tijd',
  'field.price': 'Prijs',
  'field.notes': 'Notities',
  'field.status': 'Toestand',
  'form.saveError': 'Dat is niet opgeslagen',
  'action.cancel': 'Annuleren',
  'book.status.none': 'Zonder toestand',
  'book.status.pending': 'In afwachting',
  'book.status.confirmed': 'Bevestigd',
  'book.status.completed': 'Afgerond',
  'book.status.cancelled': 'Geannuleerd',
  'book.toast.statusFailed': 'De toestand is niet gewijzigd',
  'book.toast.statusFailedBody': 'De boeking staat nog op de vorige stand.',
  'book.toast.removed': 'Boeking verwijderd',
  'book.toast.removeFailed': 'De boeking is niet verwijderd',
  'book.empty.title': 'Nog niets geboekt',
  'book.empty.body':
    'Verblijven, tafels, tours en tickets horen hier — met het bevestigingsnummer waar je het aan de deur terugvindt, en de datum die ze op de tijdlijn zet.',
  'book.empty.action': 'Voeg de eerste boeking toe',
  'book.filtered.title': 'Niets in die toestand',
  'book.filtered.body':
    'Elke boeking van deze reis staat er anders voor. Ga terug naar „{label}” om ze allemaal te zien.',
  'book.filtered.action': 'Alles tonen',
  'filter.all': 'Alles',
  'book.remove.body':
    'Hij gaat definitief van de tijdlijn af. Is hij alleen geannuleerd, zet zijn toestand dan op Geannuleerd zodat het record blijft.',
  'book.remove.confirm': 'Boeking verwijderen',
  'book.menu.edit': 'Boeking bewerken…',
  'book.menu.open': 'Boeking openen',
  'book.noDate': 'Nog geen datum',
  'book.until': 'Tot',
  'book.provider': 'Aanbieder',
  'book.where': 'Waar',
  'book.guests': 'Personen',
  'book.confirmation': 'Bevestiging',
  'book.undated': 'Geef ze een datum en ze komen op de tijdlijn',
  statusOf: 'Toestand van {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Nog zonder toestand',
  'book.statusChoice.pending': 'In afwachting — het ligt bij hen',
  'book.dialog.addTitle': 'Boeking toevoegen',
  'book.dialog.editTitle': 'Deze boeking bewerken',
  'book.dialog.typeLegend': 'Wat voor boeking',
  'book.field.namePlaceholder': 'Herengracht 15',
  'book.field.priceHint': 'Laat leeg als het nog niet is afgerekend.',
  'book.field.confirmation': 'Bevestigingsnummer',
  'book.field.confirmationHint': 'De code waar ze aan de balie om vragen.',
  'book.field.day': 'Aan een dag hangen',
  'book.field.dayHint':
    'Zet hem vast in de reisroute zodat hij in het plan staat.',
  'book.field.noDay': 'Buiten de reisroute',
  'book.field.link': 'Koppeling',
  'book.field.notesPlaceholder':
    'Late aankomst afgesproken. Vraag een kamer weg van de lift.',
  'book.action.add': 'Boeking toevoegen',
  'book.action.save': 'Boeking opslaan',
  'book.action.saving': 'Boeking wordt opgeslagen',
  'book.toast.added': 'Boeking toegevoegd',
  'book.toast.addedBody': 'Hij staat nu op de tijdlijn.',
  'book.toast.addFailed': 'De boeking is niet toegevoegd',
  'book.toast.updated': 'Boeking bijgewerkt',
  'book.toast.updateFailed': 'De boeking is niet bijgewerkt',

  'book.emptyFacts':
    'Behalve de naam staat er nog niets. Open het om de tijd, de prijs en het bevestigingsnummer toe te voegen.',
  'book.onItinerary': 'In de reisroute: {day}',
  'book.dayNumber': 'Dag {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Overig',
  'book.field.host': 'Hotel of gastheer',
  'book.field.restaurant': 'Naam van het restaurant',
  'book.field.operator': 'Aanbieder',
  'book.field.issuer': 'Uitgegeven door',
  'book.field.carrier': 'Vervoerder',
  'book.field.address': 'Adres',
  'book.field.meetingPoint': 'Ontmoetingspunt',
  'book.field.venue': 'Locatie',
  'book.field.fromTo': 'Van en naar',
  'book.field.checkIn': 'Aankomst',
  'book.field.date': 'Datum',
  'book.field.validOn': 'Geldig op',
  'book.field.departs': 'Vertrekt',
  'book.field.checkOut': 'Vertrek',
  'book.field.ends': 'Eindigt',
  'book.field.arrives': 'Komt aan',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Ghibli-museum',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Wie dit voor je vasthoudt',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 twinkamers',
  'book.example.restaurantTitle': 'Diner bij Den',
  'book.example.activityTitle': 'teamLab Planets, 4 kaartjes',
  'book.example.tourTitle': 'Wandeling door het bamboebos van Arashiyama',
  'book.example.ticketTitle': 'Ghibli-museum, toegang 10:00',
  'book.example.transportTitle': 'Nozomi 21 naar Kyoto',
  'book.example.otherTitle': 'Wat je hebt geboekt',
  'book.hint.accommodation':
    'Een hotel, een ryokan, een appartement — waar je ook slaapt.',
  'book.hint.restaurant':
    'Een gereserveerde tafel. Op de tijd word je afgerekend.',
  'book.hint.activity': 'Een les, een badhuis, een geboekte belevenis.',
  'book.hint.tour': 'Een plek, een tijd, en een gids die wacht.',
  'book.hint.ticket':
    'Een tijdslot, een museumpas, een wedstrijd. Houd de code bij de hand.',
  'book.hint.transport':
    'Een geboekte stoel. Volledige trajecten met codes horen bij {module}.',
  'book.hint.other': 'Alles wat op jouw naam staat en nergens anders past.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Inpakken',
  'lists.kind.todo': 'Te doen',
  'lists.kind.shopping': 'Boodschappen',
  'lists.kind.documents': 'Documenten',
  'lists.kind.fallback': 'Lijst',
  'colour.none': 'Geen kleur',
  'colour.pine': 'Pijnboom',
  'colour.inkBlue': 'Inktblauw',
  'colour.amber': 'Amberkleur',
  'colour.green': 'Groen',
  'colour.red': 'Rood',
  'colour.slate': 'Leisteen',
  'lists.toast.created': 'Lijst aangemaakt',
  'lists.toast.createdBody': 'Zet het eerste erin wat je niet mag vergeten.',
  'lists.toast.createFailed': 'De lijst is niet aangemaakt',
  'lists.toast.updated': 'Lijst bijgewerkt',
  'lists.toast.updateFailed': 'De lijst is niet bijgewerkt',
  'lists.error.weightLimit': 'Een gewichtslimiet is een heel getal in grammen.',
  'lists.dialog.editTitle': 'Deze lijst bewerken',
  'lists.dialog.editBody':
    'Geef hem een andere naam, verander het soort, of geef hem aan één reiziger.',
  'lists.dialog.addBody':
    'Inpakken, klusjes, boodschappen en de documenten die je niet mag vergeten — elk krijgt zijn eigen lijst.',
  'lists.action.new': 'Nieuwe lijst',
  'lists.field.namePlaceholder': 'Handbagage',
  'lists.field.kind': 'Soort',
  'lists.field.kindAria': 'Soort lijst',
  'lists.field.owner': 'Hoort bij',
  'lists.field.ownerHint': 'Gedeelde lijsten vinkt iedereen af.',
  'lists.field.everyone': 'Iedereen op de reis',
  'lists.field.weightLimit': 'Gewichtslimiet',
  'lists.field.weightLimitHint':
    'Grammen. Laat leeg als er geen limiet is om je aan te houden.',
  'colour.legend': 'Kleur',
  'lists.action.saving': 'Lijst wordt opgeslagen',
  'lists.action.save': 'Lijst opslaan',
  'lists.action.create': 'Lijst aanmaken',
  'lists.item.toast.added': 'Item toegevoegd',
  'lists.item.toast.addFailed': 'Het item is niet toegevoegd',
  'lists.item.toast.updated': 'Item bijgewerkt',
  'lists.item.toast.updateFailed': 'Het item is niet bijgewerkt',
  'lists.item.error.quantity': 'Een aantal is een heel getal van 1 tot 999.',
  'lists.item.error.weight': 'Een gewicht is een heel getal in grammen.',
  'lists.item.dialog.editTitle': 'Dit item bewerken',
  'lists.item.dialog.addTitle': 'Een item toevoegen',
  'lists.item.field.label': 'Onderdeel',
  'lists.item.field.placeholder': 'Paspoort',
  'field.category': 'Categorie',
  'lists.item.field.categoryHint':
    'Groepeert de lijst onder een kop. Optioneel.',
  'lists.item.field.categoryPlaceholder': 'Documenten',
  'lists.item.field.priority': 'Prioriteit',
  'lists.priorityChoice.high': 'Hoog — niet vergeten',
  'lists.priorityChoice.low': 'Laag — als er ruimte is',
  'lists.priorityChoice.normal': 'Normaal',
  'lists.item.field.quantity': 'Aantal',
  'lists.item.field.weight': 'Gewicht',
  'lists.item.field.weightHint': 'Grammen, per stuk.',
  'lists.item.field.owner': 'Wiens taak is dit',
  'lists.item.owner.nobody': 'Niemand in het bijzonder',
  'lists.item.action.saving': 'Item wordt opgeslagen',
  'lists.item.action.save': 'Item opslaan',
  'lists.item.action.add': 'Aan de lijst toevoegen',
  'lists.template.loadError': 'De sjablonen konden nu niet worden geladen.',
  'lists.template.toast.added': 'Lijst toegevoegd vanuit een sjabloon',
  'lists.template.toast.addFailed': 'Het sjabloon is niet toegepast',
  'lists.template.error.apply': 'Dat kon niet worden toegepast',
  'lists.template.error.load': 'De sjablonen zijn niet geladen',
  'lists.template.empty.title': 'Nog geen sjablonen',
  'lists.template.empty.body':
    'Sla een lijst op als sjabloon zodra je er een hebt die je zo weer zou maken, dan staat hij hier voor elke volgende reis.',
  'lists.template.applying': 'Sjabloon wordt toegepast',
  'lists.template.dialogTitle': 'Met een sjabloon beginnen',
  'lists.template.loading': 'Sjablonen worden geladen',
  'lists.template.apply': 'Sjabloon toepassen',
  'lists.template.from': 'Uit een sjabloon',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Niet toegewezen',
  'lists.toast.listRemoved': 'Lijst verwijderd',
  'lists.toast.listRemoveFailed': 'De lijst is niet verwijderd',
  'lists.toast.itemRemoved': 'Item verwijderd',
  'lists.toast.itemRemoveFailed': 'Het item is niet verwijderd',
  'lists.toast.reset': 'Lijst opnieuw ingesteld',
  'lists.toast.resetBody':
    'Alles staat weer uitgevinkt en klaar voor de volgende reis.',
  'lists.toast.resetFailed': 'De lijst is niet opnieuw ingesteld',
  'lists.toast.tickFailed': 'Het vinkje is niet opgeslagen',
  'lists.toast.tickFailedBody': 'Het item staat er weer zoals het was.',
  'lists.toast.assignFailed': 'De toewijzing is niet opgeslagen',
  'lists.toast.orderFailed': 'De nieuwe volgorde is niet opgeslagen',
  'lists.toast.orderFailedBody': 'De lijst staat er weer zoals hij was.',
  'lists.filter.todo': 'Nog te doen',
  'lists.filter.done': 'Klaar',
  'lists.scope.all': 'Alle lijsten',
  'lists.scope.shared': 'Gedeeld',
  'lists.scope.mine': 'Van mij',
  'lists.empty.mine.title': 'Nog geen eigen lijsten',
  'lists.empty.shared.title': 'Nog geen gedeelde lijsten',
  'lists.empty.mine.body':
    'Een eigen lijst vink alleen jij af — handig voor de dingen die niemand anders hoeft te zien.',
  'lists.empty.shared.body':
    'Een gedeelde lijst vinkt iedereen af, zo nemen twee mensen niet dezelfde adapter mee.',
  'lists.remove.list': 'Lijst verwijderen',
  'lists.remove.item': 'Item verwijderen',
  'lists.remove.itemBody':
    'Hij gaat van deze lijst af. Verder verandert er niets.',
  'lists.menu.editList': 'Lijst bewerken…',
  'lists.menu.tickAll': 'Alles afvinken',
  'lists.menu.untickAll': 'Alle vinkjes weghalen',
  'lists.menu.reset': 'Opnieuw instellen voor de volgende reis',
  'lists.menu.dragOrderLong':
    'Overschakelen naar een volgorde die je kunt slepen',
  'lists.menu.groupAgain': 'Weer op categorie groeperen',
  'lists.menu.dragOrder': 'Overschakelen naar een sleepbare volgorde',
  'lists.menu.groupByCategory': 'Op categorie groeperen',
  'lists.weight.packed': '{weight} ingepakt',
  'lists.weight.packedOver': '{weight} ingepakt — boven de limiet',
  'lists.weight.packedOf': '{weight} ingepakt van {limit} toegestaan',
  'lists.weight.packedOfOver':
    '{weight} ingepakt van {limit} toegestaan — boven de limiet',
  'lists.progress.ticked': '{done} van {total} afgevinkt',
  'lists.items.empty.title': 'Deze lijst is leeg',
  'lists.items.empty.body':
    'Zet het eerste erin wat je niet mag vergeten — het veld hieronder is de snelste weg.',
  'lists.items.doneEmpty.title': 'Nog niets afgevinkt',
  'lists.items.doneEmpty.body': 'Vink iets af en het komt hier te staan.',
  'lists.items.todoEmpty.title': 'Hier is alles klaar',
  'lists.items.todoEmpty.body':
    'Elk item op deze lijst is afgevinkt. Ga naar ‘{label}’ om ze te zien.',
  'lists.category.other': 'Al het overige',
  'lists.dnd.fallbackName': 'dit item',
  'lists.dnd.picked': '{name} opgepakt.',
  'lists.dnd.dropped': '{name} neergezet. De nieuwe volgorde wordt opgeslagen.',
  'lists.dnd.cancelled': 'Geannuleerd. De volgorde blijft ongewijzigd.',
  'lists.menu.editItem': 'Item bewerken…',
  'lists.quickAdd.placeholder': 'Typ een item en druk op Enter',
  'lists.quickAdd.aria': 'Een item aan deze lijst toevoegen',
  'lists.quickAdd.detailsHint':
    'Toevoegen met een gewicht, categorie of persoon',
  'lists.quickAdd.detailsAria': 'Een item met alle gegevens toevoegen',
  'lists.show': 'Weergeven',
  'lists.priority.high': 'Hoog',
  'lists.action.add': 'Toevoegen',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} onderdeel',
    other: '{count} onderdelen',
  },
  'lists.template.copiedIn': {
    one: '{count} item overgenomen, klaar om af te vinken.',
    other: '{count} items overgenomen, klaar om af te vinken.',
  },
  'lists.remove.listBody': {
    one: 'De lijst en zijn {count} item gaan van deze reis af. Opgeslagen sjablonen blijven ongemoeid.',
    other:
      'De lijst en zijn {count} items gaan van deze reis af. Opgeslagen sjablonen blijven ongemoeid.',
  },

  'lists.item.dialog.body':
    'Alles behalve de naam is optioneel — een gewicht maakt het pakgewicht echt, en een categorie groepeert de lijst.',
  'lists.template.dialogBody':
    'Een sjabloon is een lijst die je eerder hebt opgeslagen. Er een toepassen kopieert hem als nieuwe lijst op deze reis — het origineel blijft ongemoeid.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': '„{name}” verwijderen?',
  actionsFor: 'Acties voor {name}',
  'lists.dnd.reorder': '{name} herschikken',
  'lists.action.untickItem': 'Vinkje bij {name} weghalen',
  'lists.action.tickOffItem': '{name} afvinken',
  'lists.item.assignAria': '{name} aan iemand toewijzen',
  'lists.item.reassignAria': '{item} is van {owner} — opnieuw toewijzen',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Geef deze boeking een naam die je in een lijst terugkent.',
  'error.titleLong': 'Houd de naam onder 160 tekens.',
  'book.error.required': 'Deze boeking mist: {field}.',
  'book.error.timeNeedsDate': 'Een tijd heeft de dag nodig waarop hij valt.',
  'book.error.endTimeNeedsDate':
    'Een eindtijd heeft de dag nodig waarop hij valt.',
  'book.error.endsBeforeStart': 'Dit eindigt voordat het begint.',
  'book.error.endTimeBeforeStart': 'De eindtijd ligt voor de begintijd.',
  'book.error.guests': 'Het aantal personen moet een heel getal tot 1000 zijn.',
  'error.price': 'Dat bedrag kunnen we niet lezen.',
  'book.error.url': 'Een koppeling moet met http:// of https:// beginnen.',
  'book.error.confirmationLong':
    'Dat bevestigingsnummer is te lang om op te slaan.',
  'book.fieldName.provider': 'aanbieder',
  'book.fieldName.location': 'locatie',
  'book.fieldName.confirmationNumber': 'bevestigingsnummer',
  'book.fieldName.link': 'koppeling',
  'book.fieldName.date': 'datum',
  'book.fieldName.time': 'tijd',
  'book.fieldName.endDate': 'einddatum',
  'book.fieldName.endTime': 'eindtijd',
  'book.fieldName.guests': 'aantal personen',
  'book.fieldName.price': 'prijs',
  'book.copyConfirmation': 'het bevestigingsnummer van {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Vlucht',
  'transports.mode.train': 'Trein',
  'transports.mode.bus': 'Bus',
  'transports.mode.ferry': 'Veerboot',
  'transports.mode.car': 'Auto',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Vervoer',
  'transports.mode.metro': 'Metro',
  'transports.mode.tram': 'Tram',
  'transports.mode.bike': 'Fiets',
  'transports.mode.walk': 'Te voet',
  'transports.mode.other': 'Overig',
  'transports.mode.fallback': 'Traject',
  'transports.status.idea': 'Idee',
  'transports.status.pending': 'In afwachting',
  'transports.status.confirmed': 'Bevestigd',
  'transports.status.completed': 'Afgerond',
  'transports.status.cancelled': 'Geannuleerd',
  'transports.end.fromAirport': 'Vanaf luchthaven',
  'transports.end.toAirport': 'Naar luchthaven',
  'transports.end.fromPort': 'Vanaf haven',
  'transports.end.toPort': 'Naar haven',
  'transports.end.fromStation': 'Vanaf station',
  'transports.end.toStation': 'Naar station',
  'transports.end.from': 'Vanaf',
  'transports.end.to': 'Naar',
  'transports.error.titleEmpty':
    'Geef dit traject een naam die je in een lijst terugkent.',
  'transports.error.date': 'Een datum schrijf je JJJJ-MM-DD.',
  'transports.error.time': 'Een tijd schrijf je UU:MM op een 24-uursklok.',
  'transports.error.departureNeedsDate':
    'Een vertrektijd heeft de dag nodig waarop hij valt.',
  'transports.error.arrivalNeedsDate':
    'Een aankomsttijd heeft de dag nodig waarop hij valt.',
  'transports.error.code': 'Een code is 2 tot 8 letters of cijfers.',
  'transports.error.distance':
    'Een afstand is een aantal kilometers, tot 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Dit traject komt aan voordat het vertrekt.',
  'transports.error.timingHint':
    'Verschuif een van beide tijden, zodat het traject echt te halen is.',
  'transports.bookingRefFor': 'het boekingsnummer van {title}',
  'transports.doorToDoor': 'Dat is {gap} van deur tot deur.',
  'transports.title.fromTo': '{operator} van {from} naar {to}',
  'transports.title.from': '{operator} vanaf {from}',
  'transports.title.to': '{operator} naar {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Geen tijden om te vergelijken',
  'transports.junction.unknown.detail':
    'Zet datum en tijd bij beide trajecten, dan wordt deze overstap voor je nagekeken.',
  'transports.junction.impossible.headline':
    'Vertrekt {gap} voordat het vorige traject aankomt',
  'transports.junction.impossible.detail':
    '„{to}” vertrekt voordat „{from}” aankomt, dus beide zijn niet te halen. Verschuif er een.',
  'transports.junction.tight.headline': '{gap} om over te stappen',
  'transports.junction.tight.detail':
    'Voor {mode} heb je meestal ongeveer {required} nodig. Dit is krap.',
  'transports.junction.tight.detailAt':
    'Voor {mode} heb je in {place} meestal ongeveer {required} nodig. Dit is krap.',
  'transports.junction.ok.headline': '{gap} ertussen',
  'transports.junction.ok.detail':
    'Aankomst op {landing} maar het volgende traject vertrekt van {boarding} — je moet er nog naartoe.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Notitie gedeeld',
  'collab.note.toast.sharedBody': 'Iedereen op de reis ziet hem nu.',
  'collab.note.toast.shareFailed': 'De notitie is niet gedeeld',
  'collab.note.toast.updated': 'Notitie bijgewerkt',
  'collab.note.toast.updateFailed': 'De notitie is niet bijgewerkt',
  'collab.note.dialog.editTitle': 'Deze notitie bewerken',
  'collab.note.dialog.addTitle': 'Nieuwe gedeelde notitie',
  'collab.note.dialog.body':
    'Restauranttips, visumregels, de code van de voordeur — alles wat de hele reis moet onthouden, op één plek.',
  'collab.note.field.title': 'Titel',
  'collab.note.field.titlePlaceholder': 'Voordeurcode',
  'collab.note.field.body': 'Notitie',
  'collab.note.field.bodyPlaceholder':
    '4821, dan het hekje. Het sleutelkastje zit links van de deur.',
  'collab.note.field.categoryHint':
    'Groepeert het bord onder een filter. Optioneel.',
  'collab.note.field.categoryPlaceholder': 'Logistiek',
  'collab.note.field.pin': 'Bovenaan het bord vastzetten',
  'collab.note.field.pinHint':
    'Vastgezette notities staan vooraan, wat er ook bijkomt.',
  'collab.note.action.saving': 'Notitie wordt opgeslagen',
  'collab.note.action.save': 'Notitie opslaan',
  'collab.note.action.share': 'Notitie delen',
  'collab.poll.toast.opened': 'Stemming open',
  'collab.poll.toast.openedBody': 'Iedereen op de reis kan nu stemmen.',
  'collab.poll.toast.openFailed': 'De stemming is niet geopend',
  'collab.poll.dialog.addTitle': 'Nieuwe stemming',
  'collab.poll.field.question': 'Vraag',
  'collab.poll.field.questionPlaceholder': 'Waar eten we de laatste avond?',
  'collab.poll.field.optionsLegend': 'Keuzes',
  'collab.poll.field.option': 'Antwoord {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Nog een antwoord',
  'collab.poll.action.addOption': 'Antwoord toevoegen',
  'collab.poll.action.removeOption': 'Antwoord verwijderen {n}',
  'collab.poll.field.multi': 'Meerdere keuzes toestaan',
  'collab.poll.field.multiHint':
    'Uit betekent één stem per persoon, en van gedachten veranderen verplaatst hem.',
  'collab.poll.action.opening': 'Stemming wordt geopend',
  'collab.poll.action.open': 'Stemming openen',
  'collab.poll.error.tooFew':
    'Een stemming heeft minstens twee dingen nodig om uit te kiezen.',
  'collab.poll.error.duplicate':
    'Twee antwoorden zeggen hetzelfde. Geef elk zijn eigen woorden.',
  'collab.presence.viewingNow': 'kijken nu mee',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} tabblad open',
    other: '{name} — {count} tabbladen open',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Mee eens',
  'collab.reaction.love': 'Vind ik mooi',
  'collab.reaction.funny': 'Grappig',
  'collab.reaction.celebrate': 'Feest',
  'collab.reaction.thanks': 'Dank je',
  'collab.reaction.looking': 'Ik kijk',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, jij erbij',
  'collab.thread.today': 'Vandaag',
  'collab.thread.empty': 'Nog geen berichten',
  'collab.toast.reactionFailed': 'De reactie is niet opgeslagen',
  'collab.toast.messageDeleted': 'Bericht verwijderd',
  'collab.toast.deleteFailed': 'Het bericht is niet verwijderd',
  'collab.toast.notSent': 'Niet verzonden',
  'collab.toast.notSentBody':
    'Het bericht kon niet worden verzonden. Probeer het zo nog eens.',
  'collab.toast.messageUpdated': 'Bericht bijgewerkt',
  'collab.toast.editFailed': 'De wijziging is niet opgeslagen',
  'collab.message.deleteTitle': 'Dit bericht verwijderen?',
  'collab.message.deleteBody':
    'De tekst verdwijnt uit het gesprek. Antwoorden erop blijven staan.',
  'collab.message.delete': 'Bericht verwijderen',
  'collab.message.reply': 'Antwoorden',
  'collab.message.menuEdit': 'Bericht bewerken…',
  'collab.message.react': 'Op dit bericht reageren',
  'collab.message.edited': 'bewerkt',
  'collab.message.actionsFor': 'Acties voor het bericht van {name}',
  'collab.compose.editingYours': 'Je bewerkt je bericht',
  'collab.compose.replyingTo': 'Antwoord aan {name}',
  'collab.compose.cancelReply': 'Antwoord annuleren',
  'collab.compose.cancelEdit': 'Bewerken annuleren',
  'collab.compose.placeholder': 'Schrijf naar de reis',
  'collab.compose.editPlaceholder': 'Je bericht bewerken',
  'collab.compose.editPlaceholderText': 'Verander wat je zei…',
  'collab.compose.send': 'Bericht versturen',
  'collab.compose.savingEdit': 'Wijziging wordt opgeslagen',
  'collab.compose.save': 'Opslaan',
  'collab.hint.sends': 'verstuurt',
  'collab.hint.addsLine': 'voegt een regel toe',
  'collab.hint.cancels': 'annuleert',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Notitie verwijderd',
  'collab.toast.noteRemoveFailed': 'De notitie is niet verwijderd',
  'collab.notes.empty.title': 'Geen gedeelde notities',
  'collab.notes.empty.body':
    'Restauranttips, visumregels, de code van de voordeur — alles wat de hele reis moet onthouden.',
  'collab.notes.empty.action': 'Schrijf de eerste notitie',
  'collab.note.menu.edit': 'Notitie bewerken…',
  'collab.note.menu.unpin': 'Losmaken',
  'collab.note.menu.pin': 'Bovenaan vastzetten',
  'collab.note.remove': 'Notitie verwijderen',
  'collab.note.removeBody':
    'De notitie verdwijnt van het bord voor iedereen op de reis.',
  'collab.note.new': 'Nieuwe notitie',
  'collab.poll.toast.voteFailed': 'Je stem is niet opgeslagen',
  'collab.poll.toast.voteFailedBody': 'De uitslag blijft hetzelfde.',
  'collab.poll.toast.closed': 'Stemming gesloten',
  'collab.poll.toast.closeFailed': 'De stemming is niet gesloten',
  'collab.poll.toast.removed': 'Stemming verwijderd',
  'collab.poll.toast.removeFailed': 'De stemming is niet verwijderd',
  'collab.polls.heading': 'Stemmingen',
  'collab.polls.empty.title': 'Geen open stemmingen',
  'collab.polls.empty.body':
    'Als de groep het niet eens wordt over een restaurant, leg het in stemming en laat het antwoord zichzelf beslechten.',
  'collab.polls.empty.action': 'Vraag het de groep',
  'collab.poll.menu.close': 'Stemming sluiten',
  'collab.poll.remove': 'Stemming verwijderen',
  'collab.poll.removeTitle': 'Deze stemming verwijderen?',
  'collab.poll.actionsFor': 'Acties voor de stemming „{question}”',
  'collab.badge.pinned': 'Vastgezet',
  'collab.badge.closed': 'Gesloten',
  'collab.badge.open': 'Open staat',
  'collab.badge.multi': 'Meerkeuze',
  'collab.badge.leading': 'Staat voor',
  'collab.poll.removeBody': {
    one: '„{question}” en de {count} stem erop verdwijnen voor iedereen.',
    other: '„{question}” en de {count} stemmen erop verdwijnen voor iedereen.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} van {count} stem',
    other: '{label} — {votes} van {count} stemmen',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} van {count} stem, jouw stem erbij',
    other: '{label} — {votes} van {count} stemmen, jouw stem erbij',
  },
  'collab.poll.voteCount': {
    one: '{count} stem',
    other: '{count} stemmen',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Document',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Kaartje',
  'files.kind.receipt': 'Bon',
  'files.kind.map': 'Kaart',
  'files.kind.other': 'Overig',
  'files.kindChoice.ticket': 'Kaartje of pas',
  'files.kindChoice.map': 'Kaart of route',
  'files.toast.removed': 'Bestand verwijderd',
  'files.toast.removeFailed': 'Het bestand is niet verwijderd',
  'files.toast.downloadFailed': 'Het downloaden is niet begonnen',
  'files.toast.gone': 'Het bestand is niet meer beschikbaar in dit tabblad.',
  'files.toast.uploadFailed': 'Het uploaden is mislukt. Probeer het opnieuw.',
  'files.toast.updated': 'Bestand bijgewerkt',
  'files.toast.updateFailed': 'Het bestand is niet bijgewerkt',
  'files.storage.full': 'Deze werkruimte heeft geen opslag meer',
  'files.storage.used':
    '{used} van {limit} is gebruikt. Verwijder hieronder een bestand, of ga naar een hoger pakket, voordat je nog iets toevoegt.',
  'files.storage.perFile': 'tot {size} per stuk',
  'files.action.add': 'Bestanden toevoegen',
  'files.action.choose': 'Bestanden kiezen',
  'files.action.upload': 'Bestanden uploaden',
  'files.drop.active': 'Loslaten om te uploaden',
  'files.drop.idle': 'Sleep bestanden hierheen',
  'files.empty.title': 'Geen bestanden op deze reis',
  'files.empty.body':
    'Alles wat je anders bij de incheckbalie uit een mailbox zou moeten opdiepen staat hier, bij de reis waar het bij hoort.',
  'files.empty.hint':
    'Instapkaarten, hotelbevestigingen, kaartjes, verzekeringspapieren en de bonnen die je uitgaven onderbouwen.',
  'files.heading': 'Bijlagen',
  'files.tableCaption': 'Bestanden bij deze reis',
  'files.menu.download': 'Downloaden',
  'files.menu.rename': 'Hernoemen en beschrijven…',
  'files.menu.remove': 'Bestand verwijderen',
  'files.remove.body':
    'Het bestand wordt uit de opslag én van deze reis gewist, en {size} komt vrij. Dit kan niet ongedaan worden gemaakt.',
  'files.queue.clear': 'Afgeronde opruimen',
  'files.column.file': 'Bestand',
  'files.column.size': 'Grootte',
  'files.column.addedBy': 'Toegevoegd door',
  'files.column.when': 'Wanneer',
  'files.status.uploaded': 'Geüpload',
  'files.status.failed': 'Mislukt',
  'files.status.cancelled': 'Geannuleerd',
  'files.status.uploading': 'Uploaden',
  'files.status.waiting': 'Wacht',
  'files.error.nameEmpty':
    'Een bestand heeft een naam nodig waarmee je het terugvindt.',
  'files.field.kindHint':
    'Bepaalt onder welk filter het staat en welk teken het krijgt.',
  'files.field.kindAria': 'Soort bestand',
  'files.field.description': 'Omschrijving',
  'files.field.descriptionPlaceholder':
    'Verzekeringspolis — dekt het hele gezelschap, schadenummer op pagina 2.',
  'files.dialog.title': 'Bestandsgegevens',
  'files.action.saving': 'Bestand wordt opgeslagen',
  'files.action.save': 'Gegevens opslaan',
  'files.queue.someFailed': {
    one: '{count} bestand is niet geüpload. De reden staat bij elke regel — verder is er niets in de batch geraakt.',
    other:
      '{count} bestanden zijn niet geüpload. De reden staat bij elke regel — verder is er niets in de batch geraakt.',
  },

  'files.action.cancelUploadOf': 'Uploaden van {name} annuleren',
  'files.action.dismissOf': '{name} sluiten',
  'files.status.downloadingOf': '{name} wordt gedownload',
  'files.status.uploadingOf': '{name} wordt geüpload',
  'files.status.uploadingCount': {
    one: '{count} bestand wordt geüpload',
    other: '{count} bestanden worden geüpload',
  },

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Uploaden geannuleerd.',
  'files.error.badAnswer':
    'De server stuurde een antwoord dat deze browser niet kon lezen.',
  'files.error.connection':
    'De verbinding viel weg tijdens het uploaden. Controleer je netwerk en probeer het opnieuw.',
  'files.error.timeout': 'Het uploaden duurde te lang. Probeer het opnieuw.',
  'files.error.refused': 'De server weigerde de upload ({status}).',
  'files.error.downloadShape':
    'De download kwam terug in een vorm die we niet konden opslaan.',
  'files.error.downloadFailed': 'Het downloaden is mislukt ({status}).',
  'files.toast.uploadedOne': 'Bestand geüpload',
  'files.toast.uploadedManyBody': '{size} aan deze reis toegevoegd.',
  'files.toast.failedOne': 'Dat bestand is niet geüpload',
  'files.toast.failedManyBody': 'De rij hieronder zegt per stuk waarom.',
  'files.error.tooMany': {
    one: 'Er kan maar {count} bestand tegelijk bij, dus „{name}” bleef erbuiten. Sleep het er los nog eens in.',
    other:
      'Er kunnen maar {count} bestanden tegelijk bij, dus „{name}” bleef erbuiten. Sleep het er los nog eens in.',
  },
  'files.toast.uploadedMany': {
    one: '{count} bestand geüpload',
    other: '{count} bestanden geüpload',
  },
  'files.toast.failedMany': {
    one: '{count} bestand is niet geüpload',
    other: '{count} bestanden zijn niet geüpload',
  },
} satisfies TranslationOf<typeof En>

export default messages
