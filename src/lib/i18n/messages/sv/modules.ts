/**
 * The trip modules' own copy, in sv.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`. **Typografi.** Svenska citerar med ”…”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Inte angivet',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Ansluter',
  'presence.connecting.body': 'Vi går in i resans liverum.',
  'presence.live.title': 'Direktsänt',
  'presence.live.body':
    'Meddelanden, anteckningar och röster landar här när de görs.',
  'presence.reconnecting.title': 'Återansluter',
  'presence.reconnecting.body':
    'Anslutningen bröts. Vi försöker igen — allt du skickar sparas ändå.',
  'presence.offline.title': 'Inte live',
  'presence.offline.body':
    'Liveuppdateringar är av. Allt sparas fortfarande; ladda om eller försök igen för att hämta upp.',
  'presence.reconnect': 'Återanslut',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Alla färder',
  'transports.empty.title': 'Inga färder än',
  'transports.empty.body':
    'Flyg, tåg, färjor och resan från flygplatsen bor här, med bokningskoder och platsnummer till hands på dagen — och varje byte kontrollerat mot det föregående.',
  'transports.empty.action': 'Lägg till första färden',
  'transports.filtered.title': 'Inga färder av det slaget',
  'transports.filtered.body':
    'Varje färd på den här resan går på sitt eget sätt. Gå tillbaka till ”{label}” för att se alla.',
  'transports.filtered.action': 'Visa alla färder',
  'transports.alert.impossible.title': {
    one: 'Ett byte går inte',
    other: '{value} byten går inte',
  },
  'transports.alert.impossible.body':
    'En färd avgår innan den föregående kommer fram. Knutpunkterna nedan säger vilka, och med hur mycket.',
  'transports.alert.tight.title': {
    one: 'Ett byte är tight',
    other: '{value} byten är tighta',
  },
  'transports.alert.tight.body':
    'Tiden finns, men inte mycket för färdmedlet du ska hinna med. Knutpunkterna nedan visar hur mycket var och en lämnar.',
  'transports.badge.impossible': {
    one: '{value} brutet byte',
    other: '{value} brutna byten',
  },
  'transports.badge.tight': {
    one: '{value} tight byte',
    other: '{value} tighta byten',
  },
  'transports.badge.ok': 'Varje byte håller',
  'transports.remove.body':
    'Färden lämnar resan för gott, tillsammans med bokningsreferens och plats. Är den bara inställd, sätt statusen till Inställd i stället.',
  'transports.remove.confirm': 'Ta bort färden',
  'transports.menu.edit': 'Redigera färden…',
  'transports.field.service': 'Förbindelse',
  'transports.field.bookingRef': 'Bokningsreferens',
  'transports.field.seat': 'Plats',
  'transports.field.distance': 'Avstånd',
  'transports.noTime': 'Ingen tid än',
  'transports.toast.statusFailed.title': 'Statusen ändrades inte',
  'transports.toast.statusFailed.body':
    'Färden står kvar i sitt tidigare läge.',
  'transports.toast.removed': 'Färden borttagen',
  'transports.toast.removeFailed': 'Färden togs inte bort',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Lägg till en färd',
  'transports.dialog.editTitle': 'Redigera den här färden',
  'transports.dialog.description':
    'Flyg, tåg, färjor och resan från flygplatsen. Tiderna är de lokala som står på biljetten.',
  'transports.form.modeLegend': 'Hur reser du',
  'transports.form.timingError': 'Kontrollera tiderna',
  'transports.field.namePlaceholder': 'SAS från ARN till HND',
  'transports.field.place': 'Plats',
  'transports.field.code': 'Kod',
  'transports.field.date': 'Datum',
  'transports.field.time': 'Avgång efter',
  'transports.field.departurePlaceholder': 'Stockholm Arlanda',
  'transports.field.arrivalPlaceholder': 'Tokyo-Haneda',
  'transports.field.carrier': 'Bolag',
  'transports.field.serviceNumber': 'Turnummer',
  'transports.field.bookingRefHint': 'Koden du läser upp vid disken.',
  'transports.field.notesPlaceholder':
    'Önskar gångplats. Bagaget incheckat hela vägen till Kyoto.',
  'transports.action.add': 'Lägg till färden',
  'transports.action.save': 'Spara färden',
  'transports.action.saving': 'Sparar färden',
  'transports.toast.added': 'Färden tillagd',
  'transports.toast.addedBody': 'Den ligger nu i reseordningen.',
  'transports.toast.addFailed': 'Färden lades inte till',
  'transports.toast.updated': 'Färden uppdaterad',
  'transports.toast.updateFailed': 'Färden uppdaterades inte',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Namn',
  'field.time': 'Tid',
  'field.price': 'Pris',
  'field.notes': 'Anteckningar',
  'field.status': 'Tillstånd',
  'form.saveError': 'Det sparades inte',
  'action.cancel': 'Avbryt',
  'action.showCode': 'Visa {label}',
  'book.status.none': 'Utan tillstånd',
  'book.status.pending': 'Väntar',
  'book.status.confirmed': 'Bekräftad',
  'book.status.completed': 'Klar',
  'book.status.cancelled': 'Inställd',
  'book.toast.statusFailed': 'Tillståndet ändrades inte',
  'book.toast.statusFailedBody': 'Bokningen står kvar i sitt tidigare läge.',
  'book.toast.removed': 'Bokningen borttagen',
  'book.toast.removeFailed': 'Bokningen togs inte bort',
  'book.empty.title': 'Inget bokat än',
  'book.empty.body':
    'Boenden, bord, turer och biljetter hör hit — med bokningsnumret där du hittar det vid dörren, och datumet som lägger dem på tidslinjen.',
  'book.empty.action': 'Lägg till första bokningen',
  'book.filtered.title': 'Inget av det slaget än',
  'book.filtered.body':
    'Inget är bokat av de slag du valde. Rensa filtret för att se resten av disken.',
  'book.filtered.action': 'Rensa filtret',
  'book.panel.outstanding': 'Kvar att reda ut',
  'book.panel.outstandingEmpty': 'Inget utestående — allt här är utrett.',
  'book.panel.settled': 'Utrett',
  'book.panel.settledEmpty': 'Inget utrett än — allt är fortfarande att jaga.',
  'book.import.badge': 'Ogranskad import',
  'book.import.hint':
    'Importerad från en bekräftelse. Öppna och spara den för att märka den granskad.',
  'book.import.action': 'Importera',
  'book.import.title': 'Importera bokningar från en fil',
  'book.import.description':
    'Släpp en bekräftelse och vi läser den. Inget hamnar på resan förrän du har sett det.',
  'book.import.drop.idle': 'Släpp filer här, eller välj dem',
  'book.import.drop.active': 'Släpp för att lägga till',
  'book.import.drop.formats':
    'PDF, sparat mejl, webbsida, foto, Word, Excel, kalenderfil eller JSON-export.',
  'book.import.drop.limits':
    'Upp till {files} filer i taget, var och en upp till {size}.',
  'book.import.drop.browse': 'Välj filer',
  'book.import.refused.format':
    '”{filename}” är inte en fil som den här importen kan läsa. Den läser en pdf, ett sparat mejl, en webbsida, ett foto, ett Word- eller Excel-dokument, en kalenderfil eller en JSON-export.',
  'book.import.refused.tooMany':
    'Bara {files} filer i taget. Resten kom inte med.',
  'book.import.refused.tooLarge':
    '”{filename}” är {size}. En import läser filer upp till {limit}.',
  'book.import.refused.empty':
    '”{filename}” är tom, så det finns inget att läsa.',
  'book.import.ceiling.title':
    'Den här arbetsytan har läst alla sina bekräftelser den här månaden',
  'book.import.ceiling.body':
    'Planen rymmer {ceiling} lästa filer i månaden, och kvoten förnyas den första. Du kan fortfarande lägga till en bokning för hand.',
  'book.import.ceiling.none':
    'Att läsa en bekräftelsefil ingår inte i den här arbetsytans plan',
  'book.import.ceiling.noneBody':
    'Byt till en högre plan för att få en bekräftelse läst för dig. Att lägga till en bokning för hand går alltid.',
  'book.import.widget.title': 'Läser bekräftelser',
  'book.import.widget.working': '{done} av {total} lästa',
  'book.import.widget.file': 'Läser ”{filename}”',
  'book.import.widget.done': {
    one: 'En bokning att titta på',
    other: '{count} bokningar att titta på',
  },
  'book.import.widget.review': 'Titta på dem',
  'book.import.widget.failed': '”{filename}” kunde inte läsas',
  'book.import.widget.stalled': 'Det här tar längre tid än väntat',
  'book.import.widget.check': 'Titta igen',
  'book.import.widget.dismiss': 'Stäng',
  'book.import.review.title': 'Det här läste vi',
  'book.import.review.from': 'Från ”{filename}”',
  'book.import.review.selectAll': 'Markera alla',
  'book.import.review.selectNone': 'Markera ingen',
  'book.import.review.confirm': {
    one: 'Lägg till {count} bokning',
    other: 'Lägg till {count} bokningar',
  },
  'book.import.review.confirmNone': 'Markera en bokning att lägga till',
  'book.import.review.cancel': 'Avbryt',
  'book.import.review.needsReview': 'Värt en titt',
  'book.import.review.needsReviewHint':
    'Några fält fanns inte i dokumentet. Öppna bokningen när du har lagt till den.',
  'book.import.review.noPrice': 'Inget pris läst',
  'book.import.review.noPriceHint':
    'Dokumentet angav inget tydligt, så fältet lämnades tomt i stället för gissat.',
  'book.import.review.untitled': 'Bokning utan titel',
  'book.import.empty.title': 'Vi hittade ingen bokning i den filen',
  'book.import.empty.body':
    '”{filename}” innehöll inget som ser ut som en bekräftelse. Prova en annan fil, eller lägg till bokningen för hand.',
  'book.import.failed.title': '”{filename}” kunde inte läsas',
  'book.import.failed.body':
    'Filen gick att öppna men det gick inte att få något ur den. Prova en annan fil, eller lägg till bokningen för hand.',
  'book.import.failed.retry': 'Prova en annan fil',
  'book.import.uploadFailed': '”{filename}” laddades inte upp',
  'book.import.uploadRetry': 'Försök igen',
  'book.import.actionFailed': 'Försök igen om en stund.',
  'book.import.toast.added': {
    one: 'En bokning tillagd',
    other: '{count} bokningar tillagda',
  },
  'book.import.partial.title': '{written} av {total} bokningar lades till',
  'book.import.partial.body':
    'Resten är fortfarande markerade. Att lägga till igen skriver bara dem.',
  'book.import.partial.retry': 'Lägg till resten',
  'book.journeyLink': 'På transportfliken',
  'filter.all': 'Allt',
  'book.remove.body':
    'Den lämnar tidslinjen för gott. Är den bara inställd, sätt tillståndet till Inställd i stället så att posten finns kvar.',
  'book.remove.confirm': 'Ta bort bokningen',
  'book.menu.edit': 'Redigera bokningen…',
  'book.menu.open': 'Öppna bokningen',
  'book.noDate': 'Inget datum än',
  'book.until': 'Till',
  'book.provider': 'Leverantör',
  'book.where': 'Var',
  'book.guests': 'Personer',
  'book.confirmation': 'Bekräftelse',
  'book.undated': 'Ge dem ett datum så hamnar de på tidslinjen',
  statusOf: 'Tillstånd för {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Inget tillstånd än',
  'book.statusChoice.pending': 'Väntar — det ligger hos dem',
  'book.dialog.addTitle': 'Lägg till en bokning',
  'book.dialog.editTitle': 'Redigera den här bokningen',
  'book.dialog.typeLegend': 'Vad för slags bokning',
  'book.field.namePlaceholder': 'Drottninggatan 15',
  'book.field.priceHint': 'Lämna tomt om det inte är betalt än.',
  'book.field.confirmation': 'Bokningsnummer',
  'book.field.confirmationHint': 'Koden de frågar efter vid disken.',
  'book.field.day': 'Koppla till en dag',
  'book.field.dayHint': 'Fäster den i resplanen så att den syns i programmet.',
  'book.field.noDay': 'Utanför resplanen',
  'book.field.link': 'Länk',
  'book.field.notesPlaceholder':
    'Sen ankomst avtalad. Be om ett rum bort från hissen.',
  'book.action.add': 'Lägg till bokningen',
  'book.action.save': 'Spara bokningen',
  'book.action.saving': 'Sparar bokningen',
  'book.toast.added': 'Bokningen tillagd',
  'book.toast.addedBody': 'Den ligger nu på tidslinjen.',
  'book.toast.addFailed': 'Bokningen lades inte till',
  'book.toast.updated': 'Bokningen uppdaterad',
  'book.toast.updateFailed': 'Bokningen uppdaterades inte',

  'book.emptyFacts':
    'Utöver namnet finns inget än. Öppna den för att lägga till tid, pris och bokningsnummer.',
  'book.onItinerary': 'I resplanen: {day}',
  'book.dayNumber': 'Dag {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Övrigt',
  'book.field.host': 'Hotell eller värd',
  'book.field.restaurant': 'Restaurangens namn',
  'book.field.operator': 'Arrangör',
  'book.field.issuer': 'Utgiven av',
  'book.field.carrier': 'Trafikföretag',
  'book.field.address': 'Adress',
  'book.field.meetingPoint': 'Mötesplats',
  'book.field.venue': 'Plats',
  'book.field.fromTo': 'Från och till',
  'book.field.checkIn': 'Incheckning',
  'book.field.date': 'Datum',
  'book.field.validOn': 'Gäller',
  'book.field.departs': 'Avgår',
  'book.field.checkOut': 'Utcheckning',
  'book.field.ends': 'Slutar',
  'book.field.arrives': 'Anländer',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Ghibli-museet',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Vem som håller det åt dig',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 tvåbäddsrum',
  'book.example.restaurantTitle': 'Middag på Den',
  'book.example.activityTitle': 'teamLab Planets, 4 biljetter',
  'book.example.tourTitle': 'Vandring i bambuskogen i Arashiyama',
  'book.example.ticketTitle': 'Ghibli-museet, insläpp 10:00',
  'book.example.transportTitle': 'Nozomi 21 till Kyoto',
  'book.example.otherTitle': 'Vad du har bokat',
  'book.hint.accommodation':
    'Ett hotell, ett ryokan, en lägenhet — var du än sover.',
  'book.hint.restaurant': 'Ett bokat bord. Tiden är det du hålls till.',
  'book.hint.activity': 'En kurs, ett badhus, en bokad upplevelse.',
  'book.hint.tour': 'En plats, en tid, och en guide som väntar.',
  'book.hint.ticket':
    'En tidsbokad entré, ett museikort, en match. Ha koden nära.',
  'book.hint.transport':
    'En bokad plats. Hela färder med koder hör till {module}.',
  'book.hint.other':
    'Allt som står i ditt namn och inte passar någon annanstans.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Packning',
  'lists.kind.todo': 'Att göra',
  'lists.kind.shopping': 'Inköp',
  'lists.kind.documents': 'Dokument',
  'lists.kind.fallback': 'Lista',
  'colour.none': 'Ingen färg',
  'colour.pine': 'Furu',
  'colour.inkBlue': 'Bläckblå',
  'colour.amber': 'Bärnsten',
  'colour.green': 'Grön',
  'colour.red': 'Röd',
  'colour.slate': 'Skiffer',
  'lists.toast.created': 'Listan skapad',
  'lists.toast.createdBody': 'Lägg in det första du inte får glömma.',
  'lists.toast.createFailed': 'Listan skapades inte',
  'lists.toast.updated': 'Listan uppdaterad',
  'lists.toast.updateFailed': 'Listan uppdaterades inte',
  'lists.error.weightLimit': 'En viktgräns är ett helt antal gram.',
  'lists.dialog.editTitle': 'Redigera den här listan',
  'lists.dialog.editBody':
    'Byt namn, byt sorts lista, eller ge den till en enda resenär.',
  'lists.dialog.addBody':
    'Packning, uppgifter, inköp och dokumenten du inte får glömma — var sak får sin egen lista.',
  'lists.action.new': 'Ny lista',
  'lists.field.namePlaceholder': 'Handbagage',
  'lists.field.kind': 'Sort',
  'lists.field.kindAria': 'Sorts lista',
  'lists.field.owner': 'Tillhör',
  'lists.field.ownerHint': 'Delade listor bockar alla av.',
  'lists.field.everyone': 'Alla på resan',
  'lists.field.weightLimit': 'Viktgräns',
  'lists.field.weightLimitHint':
    'Gram. Lämna tomt om det inte finns någon gräns att hålla.',
  'colour.legend': 'Färg',
  'lists.action.saving': 'Sparar listan',
  'lists.action.save': 'Spara listan',
  'lists.action.create': 'Skapa listan',
  'lists.item.toast.added': 'Posten tillagd',
  'lists.item.toast.addFailed': 'Posten lades inte till',
  'lists.item.toast.updated': 'Posten uppdaterad',
  'lists.item.toast.updateFailed': 'Posten uppdaterades inte',
  'lists.item.error.quantity': 'Ett antal är ett helt tal från 1 till 999.',
  'lists.item.error.weight': 'En vikt är ett helt antal gram.',
  'lists.item.dialog.editTitle': 'Redigera den här posten',
  'lists.item.dialog.addTitle': 'Lägg till en post',
  'lists.item.field.label': 'Post',
  'lists.item.field.placeholder': 'Pass',
  'field.category': 'Kategori',
  'lists.item.field.categoryHint':
    'Grupperar listan under en rubrik. Valfritt.',
  'lists.item.field.categoryPlaceholder': 'Dokument',
  'lists.item.field.priority': 'Prioritet',
  'lists.priorityChoice.high': 'Hög — får inte glömmas',
  'lists.priorityChoice.low': 'Låg — om det finns plats',
  'lists.priorityChoice.normal': 'Vanlig',
  'lists.item.field.quantity': 'Antal',
  'lists.item.field.weight': 'Vikt',
  'lists.item.field.weightHint': 'Gram, per styck.',
  'lists.item.field.owner': 'Vems uppgift är det här',
  'lists.item.owner.nobody': 'Ingen särskild',
  'lists.item.action.saving': 'Sparar posten',
  'lists.item.action.save': 'Spara posten',
  'lists.item.action.add': 'Lägg till i listan',
  'lists.template.loadError': 'Mallarna kunde inte läsas in just nu.',
  'lists.template.toast.added': 'Lista tillagd från en mall',
  'lists.template.toast.addFailed': 'Mallen tillämpades inte',
  'lists.template.error.apply': 'Det gick inte att tillämpa',
  'lists.template.error.load': 'Mallarna lästes inte in',
  'lists.template.empty.title': 'Inga mallar än',
  'lists.template.empty.body':
    'Spara en lista som mall när du har en du skulle bygga likadant igen, så ligger den här inför varje kommande resa.',
  'lists.template.applying': 'Tillämpar mallen',
  'lists.template.dialogTitle': 'Börja från en mall',
  'lists.template.loading': 'Läser in mallar',
  'lists.template.apply': 'Tillämpa mallen',
  'lists.template.from': 'Från en mall',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Ingen tilldelad',
  'lists.toast.listRemoved': 'Listan borttagen',
  'lists.toast.listRemoveFailed': 'Listan togs inte bort',
  'lists.toast.itemRemoved': 'Posten borttagen',
  'lists.toast.itemRemoveFailed': 'Posten togs inte bort',
  'lists.toast.reset': 'Listan nollställd',
  'lists.toast.resetBody': 'Allt är avbockat och klart för nästa resa.',
  'lists.toast.resetFailed': 'Listan nollställdes inte',
  'lists.toast.tickFailed': 'Bockningen sparades inte',
  'lists.toast.tickFailedBody': 'Posten står som förut igen.',
  'lists.toast.assignFailed': 'Tilldelningen sparades inte',
  'lists.toast.orderFailed': 'Den nya ordningen sparades inte',
  'lists.toast.orderFailedBody': 'Listan står som förut igen.',
  'lists.filter.todo': 'Kvar att göra',
  'lists.filter.done': 'Klart',
  'lists.scope.all': 'Alla listor',
  'lists.scope.shared': 'Delade',
  'lists.scope.mine': 'Mina',
  'lists.empty.mine.title': 'Inga egna listor än',
  'lists.empty.shared.title': 'Inga delade listor än',
  'lists.empty.mine.body':
    'En egen lista bockar bara du av — bra för det ingen annan behöver se.',
  'lists.empty.shared.body':
    'En delad lista bockar alla av, så att två personer inte packar samma adapter.',
  'lists.remove.list': 'Ta bort listan',
  'lists.remove.item': 'Ta bort posten',
  'lists.remove.itemBody': 'Den lämnar den här listan. Inget annat ändras.',
  'lists.menu.editList': 'Redigera listan…',
  'lists.menu.tickAll': 'Bocka av allt',
  'lists.menu.untickAll': 'Ta bort alla bockar',
  'lists.menu.reset': 'Nollställ för nästa resa',
  'lists.menu.dragOrderLong': 'Byt till en ordning du kan dra i',
  'lists.menu.groupAgain': 'Gruppera efter kategori igen',
  'lists.menu.dragOrder': 'Byt till en dragbar ordning',
  'lists.menu.groupByCategory': 'Gruppera efter kategori',
  'lists.weight.packed': '{weight} packat',
  'lists.weight.packedOver': '{weight} packat — över gränsen',
  'lists.weight.packedOf': '{weight} packat av {limit} tillåtet',
  'lists.weight.packedOfOver':
    '{weight} packat av {limit} tillåtet — över gränsen',
  'lists.progress.ticked': '{done} av {total} avbockade',
  'lists.items.empty.title': 'Den här listan är tom',
  'lists.items.empty.body':
    'Lägg in det första du inte får glömma — fältet nedanför är snabbaste vägen.',
  'lists.items.doneEmpty.title': 'Inget avbockat än',
  'lists.items.doneEmpty.body': 'Bocka av något, så hamnar det här.',
  'lists.items.todoEmpty.title': 'Här är allt klart',
  'lists.items.todoEmpty.body':
    'Varje post på den här listan är avbockad. Byt till ”{label}” för att se dem.',
  'lists.category.other': 'Allt övrigt',
  'lists.dnd.fallbackName': 'den här posten',
  'lists.dnd.picked': '{name} upplyft.',
  'lists.dnd.dropped': '{name} släppt. Den nya ordningen sparas.',
  'lists.dnd.cancelled': 'Avbrutet. Ordningen är oförändrad.',
  'lists.menu.editItem': 'Redigera posten…',
  'lists.quickAdd.placeholder': 'Skriv en post och tryck på Enter',
  'lists.quickAdd.aria': 'Lägg till en post i den här listan',
  'lists.quickAdd.detailsHint': 'Lägg till med vikt, kategori eller person',
  'lists.quickAdd.detailsAria': 'Lägg till en post med alla uppgifter',
  'lists.show': 'Visa',
  'lists.priority.high': 'Hög',
  'lists.action.add': 'Lägg till',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} post',
    other: '{count} poster',
  },
  'lists.template.copiedIn': {
    one: '{count} post kopierad, klar att bocka av.',
    other: '{count} poster kopierade, klara att bocka av.',
  },
  'lists.remove.listBody': {
    one: 'Listan och dess {count} post lämnar den här resan. Sparade mallar rörs inte.',
    other:
      'Listan och dess {count} poster lämnar den här resan. Sparade mallar rörs inte.',
  },

  'lists.item.dialog.body':
    'Allt utom namnet är valfritt — en vikt gör packvikten verklig, och en kategori grupperar listan.',
  'lists.template.dialogBody':
    'En mall är en lista du har sparat tidigare. Att tillämpa en kopierar den som en ny lista på den här resan — originalet lämnas i fred.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Ta bort ”{name}”?',
  actionsFor: 'Åtgärder för {name}',
  'lists.dnd.reorder': 'Ändra ordning på {name}',
  'lists.action.untickItem': 'Ta bort bocken på {name}',
  'lists.action.tickOffItem': 'Bocka av {name}',
  'lists.item.assignAria': 'Tilldela {name} till någon',
  'lists.item.reassignAria': '{item} tillhör {owner} — tilldela om',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Ge den här bokningen ett namn du känner igen i en lista.',
  'error.titleLong': 'Håll namnet under 160 tecken.',
  'book.error.required': 'Den här bokningen saknar: {field}.',
  'book.error.timeNeedsDate': 'En tid behöver dagen den ligger på.',
  'book.error.endTimeNeedsDate': 'En sluttid behöver dagen den ligger på.',
  'book.error.endsBeforeStart': 'Det här slutar innan det börjar.',
  'book.fieldName.checkInDay': 'incheckningsdag',
  'book.fieldName.checkOutDay': 'utcheckningsdag',
  'book.stay.pickDay': 'Välj en dag',
  'book.stay.nights': {
    one: '{count} natt',
    other: '{count} nätter',
  },
  'book.stay.range': '{from} till {to}',
  'book.stay.label': 'Vistelse',
  'book.remove.keepsNights':
    'Nätterna ligger kvar i resan. Bara bokningen tas bort.',
  'book.menu.removeWithStay': 'Ta bort bokningen och vistelsen',
  'book.removeStay.body': 'Både bokningen och nätterna den betalar tas bort.',
  'book.toast.stayRemoved': 'Bokningen och vistelsen borttagna',
  'book.error.endTimeBeforeStart': 'Sluttiden ligger före starttiden.',
  'book.error.guests':
    'Antalet personer måste vara ett helt tal upp till 1000.',
  'error.price': 'Det beloppet kan vi inte läsa.',
  'book.error.url': 'En länk måste börja med http:// eller https://.',
  'book.error.confirmationLong': 'Det bokningsnumret är för långt att spara.',
  'book.error.stopGone': 'Den hållplatsen finns inte längre på den här resan.',
  'book.ledger.unlinked':
    'Bokningens kostnadsrad blir kvar i resans kostnader, men är inte längre kopplad till bokningen.',
  'book.ledger.updated': 'Bokningens kostnadsrad ändras till {money}.',
  'book.ledger.needsDate':
    'Ge bokningen ett datum, så hamnar kostnaden bland resans kostnader.',
  'book.ledger.added': 'En rad på {money} läggs till i resans kostnader.',
  'book.fieldName.provider': 'trafikföretag',
  'book.fieldName.location': 'plats',
  'book.fieldName.confirmationNumber': 'bokningsnummer',
  'book.fieldName.link': 'länk',
  'book.fieldName.date': 'datum',
  'book.fieldName.time': 'tid',
  'book.fieldName.endDate': 'slutdatum',
  'book.fieldName.endTime': 'sluttid',
  'book.fieldName.guests': 'antal personer',
  'book.fieldName.price': 'pris',
  'book.fieldName.stop': 'hållplats',
  'book.field.stop': 'Kopplat stopp',
  'book.field.stopHint': 'Vilket stopp i planen den här bokningen gäller.',
  'book.field.stopHintEmpty':
    'Lägg först till en plats på en dag, sedan kan bokningen kopplas dit',
  'book.field.stopPlaceholder': 'Inte kopplad till ett stopp',
  'book.field.stopSearch': 'Sök bland stopp och dagar',
  'book.field.stopEmpty': 'Inget stopp matchar',
  'book.ledger.refused.title': 'Sparad, men inte lagd till kostnaderna',
  'book.ledger.refused.body':
    'Bokningen ligger på resan. Att lägga dess kostnadsrad till resans kostnader gick inte — försök med den halvan igen.',
  'book.action.ledgerRetry': 'Lägg till i kostnaderna',
  'book.ledger.splitStale.title':
    'Sparat, men uppdelningen stämmer inte längre',
  'book.ledger.splitStale.body':
    'Bokningen och dess nya pris är sparade, men uppdelningen av den här kostnaden kunde inte följa den nya summan. Öppna posten under Kostnader och rätta uppdelningen.',
  'book.action.done': 'Klart',
  'book.copyConfirmation': 'bokningsnumret för {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Flyg',
  'transports.mode.train': 'Tåg',
  'transports.mode.bus': 'Buss',
  'transports.mode.ferry': 'Färja',
  'transports.mode.car': 'Bil',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Kollektivt',
  'transports.mode.metro': 'Tunnelbana',
  'transports.mode.tram': 'Spårvagn',
  'transports.mode.bike': 'Cykel',
  'transports.mode.walk': 'Till fots',
  'transports.mode.other': 'Övrigt',
  'transports.mode.fallback': 'Färd',
  'transports.rank.earliest': 'Tidigast ankomst',
  'transports.rank.fewestChanges': 'Färrest byten',
  'transports.connection.findStop': 'Hitta ett stopp',
  'transports.connection.findStopSearch': 'ARN, Centralen, Stockholm…',
  'transports.connection.findStopEmpty':
    'Inget stopp med det namnet i katalogen.',
  'transports.connection.hideStops': 'Dölj stoppen',
  'transports.connection.seeStops': 'Se stoppen',
  'transports.connection.saving': 'Sparar förbindelsen',
  'transports.connection.use': 'Ta den här',
  'transports.connection.onFoot': 'Till fots',
  'transports.connection.service': 'Tur',
  'transports.connection.direct': 'direkt',
  'transports.connection.changes': {
    one: '{changes} byte',
    other: '{changes} byten',
  },
  'transports.connection.tooLong':
    'Den här förbindelsen har fler än {max} etapper, mer än vad en enda resepost rymmer. Sök ett kortare hopp och skriv upp resten separat.',
  'transports.connection.refusal.ceiling':
    'Inga sökningar kvar den här månaden',
  'transports.connection.refusal.unconfigured':
    'Förbindelsesökningen är avstängd på den här driftsättningen',
  'transports.connection.refusal.provider': 'Tidtabellstjänsten svarade inte',
  'transports.connection.refusal.plan':
    'Förbindelsesökning ingår inte i den här planen',
  'transports.connection.refusal.planBody':
    'Byt plan för att söka i tidtabeller inifrån en resa. En resa går fortfarande att skriva in för hand.',
  'transports.connection.refusal.ceilingBody':
    'Månadens pott på {ceiling} är slut och förnyas den första nästa månad. En resa går fortfarande att skriva in för hand.',
  'transports.connection.refusal.unconfiguredBody':
    'Ingen tidtabellstjänst är uppsatt här, så ingenting söktes. Skriv in resan för hand i stället.',
  'transports.connection.refusal.providerBody':
    'Ingenting kom tillbaka att visa. Försök igen om en stund, eller skriv in resan för hand.',
  'transports.connection.invitation':
    'Två stopp och ett datum, så svarar tidtabellen. Ingenting sparas förrän du väljer en.',
  'transports.connection.empty':
    'Ingen förbindelse hittades mellan de två stoppen det datumet. Prova en granne till stationen, eller vidga färdsättsfiltret.',
  'transports.connection.credit': 'Tidtabellsdata från',
  'transports.connection.searchFailed': 'Sökningen kördes inte',
  'transports.connection.searchFailedBody': 'Försök igen om en stund.',
  'transports.connection.saved': 'Förbindelsen sparad',
  'transports.connection.replaced': 'Rutten ersatt',
  'transports.connection.replacedBody': 'Bokningskoden och platsen är orörda.',
  'transports.connection.saveFailed': 'Förbindelsen sparades inte',
  'transports.connection.saveError': 'Det sparades inte',
  'transports.connection.fromHint':
    'Välj ett stopp — en tidtabell får frågan var, inte vad det heter.',
  'transports.connection.toHint': 'Välj ett stopp ur katalogen.',
  'transports.connection.timeHint':
    'En tidtabell svarar med de närmaste avgångarna, så det här avgör vilka.',
  'transports.connection.onlyModes': 'Bara de här färdsätten',
  'transports.connection.searching': 'Söker i tidtabellen',
  'transports.connection.search': 'Sök förbindelser',
  'transports.connection.title': 'Från {from} till {to}',
  'transports.status.idea': 'Idé',
  'transports.status.pending': 'Väntar',
  'transports.status.confirmed': 'Bekräftad',
  'transports.status.completed': 'Klar',
  'transports.status.cancelled': 'Inställd',
  'transports.end.fromAirport': 'Från flygplats',
  'transports.end.toAirport': 'Till flygplats',
  'transports.end.fromPort': 'Från hamn',
  'transports.end.toPort': 'Till hamn',
  'transports.end.fromStation': 'Från station',
  'transports.end.toStation': 'Till station',
  'transports.end.from': 'Från',
  'transports.end.to': 'Till',
  'transports.end.pickUp': 'Upphämtning',
  'transports.end.dropOff': 'Återlämning',
  'transports.end.departureDay': 'Avresedag',
  'transports.end.arrivalDay': 'Ankomstdag',
  'transports.end.pickUpDay': 'Upphämtningsdag',
  'transports.end.returnDay': 'Återlämningsdag',
  'transports.dayNumber': 'Dag {n}',
  'transports.error.titleEmpty':
    'Ge den här färden ett namn du känner igen i en lista.',
  'transports.error.date': 'Ett datum skrivs ÅÅÅÅ-MM-DD.',
  'transports.error.time': 'En tid skrivs TT:MM på 24-timmarsklocka.',
  'transports.error.departureNeedsDate':
    'En avgångstid behöver dagen den ligger på.',
  'transports.error.arrivalNeedsDate':
    'En ankomsttid behöver dagen den ligger på.',
  'transports.error.code': 'En kod är 2 till 8 bokstäver eller siffror.',
  'transports.error.distance':
    'En sträcka är ett antal kilometer, upp till 100 000.',
  'transports.error.arrivesBeforeDeparts':
    'Den här färden anländer innan den avgår.',
  'transports.error.timingHint':
    'Flytta en av tiderna, så att färden verkligen går att hinna med.',
  'transports.error.arrivalDayBeforeDeparture':
    'Ankomstdagen ligger före avresedagen.',
  'transports.error.returnDayBeforePickUp':
    'Återlämningsdagen ligger före upphämtningsdagen.',
  'transports.field.noDay': 'Ingen dag än',
  'transports.fill.legend': 'Så fyller du i det här',
  'transports.fill.manual': 'Skriv in själv',
  'transports.fill.searchAgain': 'Sök igen',
  'transports.fill.search': 'Sök förbindelser',
  'transports.chain.unsplit': 'Gör om det till en enda resa',
  'transports.field.arrivalDayHint':
    'En resa som landar nästa morgon säger det här.',
  'transports.chain.splitHint':
    'Byte på vägen? Notera varje del med eget turnummer, spår, plats och tider.',
  'transports.chain.split': 'Dela upp i etapper',
  'transports.chain.stopNumber': 'hållplats {n}',
  'transports.chain.change': 'Byte {n}',
  'transports.chain.removeStation': 'Ta bort {label}',
  'transports.chain.findStation': 'Hitta en flygplats eller station',
  'transports.chain.findStationFor':
    'Hitta en flygplats eller station för {label}',
  'transports.chain.findPlaceholder': 'ARN, Arlanda, Stockholm…',
  'transports.chain.findEmpty': 'Ingen träff — skriv in stoppet själv nedan.',
  'transports.chain.stopLabel': 'Stopp',
  'transports.chain.stopPlaceholder': 'Stockholm Central',
  'transports.chain.timezoneHint': 'Vilken klocka det här stoppet går efter',
  'transports.chain.timezoneAt': 'Tidszon vid {label}',
  'transports.chain.timezonePlaceholder': 'Ej angiven',
  'transports.chain.timezoneSearch': 'Tokyo, Lissabon, UTC…',
  'transports.chain.acrossClocks': '{gap} över två klockor',
  'transports.chain.addStopAfter': 'Lägg till ett stopp efter {label}',
  'transports.chain.servicePlaceholder': 'SJ 522',
  'transports.chain.leaves': 'Avgår från {label}',
  'transports.chain.reaches': 'Ankommer {label}',
  'transports.chain.dayOfLeg': '{label} för etapp {n}',
  'transports.chain.formError': 'Den här kedjan går inte att spara',
  'transports.chain.atCap':
    'En kedja rymmer högst {max} etapper — det är en gräns för vad en sparning bär, inte för hur många byten en resa får ha.',
  'transports.chain.hint':
    'Lägg till ett stopp på vilken etapp som helst för ett tågbyte; varje etapp behåller sitt eget tågnummer, spår och plats.',
  'transports.field.timezone': 'Tidszon',
  'transports.field.platform': 'Spår',
  'transports.chain.legNumber': 'Etapp {n}',
  'transports.chain.platform': 'Spår {value}',
  'transports.chain.seat': 'Plats {value}',
  'transports.chain.error.stopName':
    'Varje hållplats behöver ett namn — det är här du byter.',
  'transports.chain.error.stopNameLong':
    'Håll hållplatsens namn under 200 tecken.',
  'transports.chain.error.timezone': 'Välj en tidszon i listan.',
  'transports.chain.error.tooManyLegs': 'En kedja rymmer högst {max} etapper.',
  'transports.bookingRefFor': 'bokningsnumret för {title}',
  'transports.doorToDoor': 'Det är {gap} dörr till dörr.',
  'transports.title.fromTo': '{operator} från {from} till {to}',
  'transports.title.from': '{operator} från {from}',
  'transports.title.to': '{operator} till {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Inga tider att jämföra',
  'transports.junction.unknown.detail':
    'Fyll i datum och tid på båda färderna, så kontrolleras det här bytet för dig.',
  'transports.junction.impossible.headline':
    'Avgår {gap} innan den förra färden landar',
  'transports.junction.impossible.detail':
    '”{to}” avgår innan ”{from}” anländer, så båda går inte att hinna med. Flytta en av dem.',
  'transports.junction.tight.headline': '{gap} till bytet',
  'transports.junction.tight.detail':
    'För {mode} behövs oftast ungefär {required}. Det här är knappt.',
  'transports.junction.tight.detailAt':
    'För {mode} behövs i {place} oftast ungefär {required}. Det här är knappt.',
  'transports.junction.ok.headline': '{gap} emellan',
  'transports.junction.ok.detail':
    'Anländer till {landing} men nästa färd avgår från {boarding} — du måste ta dig dit.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Anteckningen delad',
  'collab.note.toast.sharedBody': 'Alla på resan ser den nu.',
  'collab.note.toast.shareFailed': 'Anteckningen delades inte',
  'collab.note.toast.updated': 'Anteckningen uppdaterad',
  'collab.note.toast.updateFailed': 'Anteckningen uppdaterades inte',
  'collab.note.dialog.editTitle': 'Redigera den här anteckningen',
  'collab.note.dialog.addTitle': 'Ny delad anteckning',
  'collab.note.dialog.body':
    'Restaurangtips, visumregler, koden till porten — allt som hela resan behöver komma ihåg, på ett ställe.',
  'collab.note.field.title': 'Rubrik',
  'collab.note.field.titlePlaceholder': 'Portkod',
  'collab.note.field.body': 'Anteckning',
  'collab.note.field.bodyPlaceholder':
    '4821, sedan brädgården. Nyckelskåpet sitter till vänster om dörren.',
  'collab.note.field.categoryHint':
    'Grupperar tavlan under ett filter. Valfritt.',
  'collab.note.field.categoryPlaceholder': 'Logistik',
  'collab.note.field.pin': 'Fäst högst upp på tavlan',
  'collab.note.field.pinHint':
    'Fästa anteckningar ligger först, vad som än läggs till.',
  'collab.note.action.saving': 'Sparar anteckningen',
  'collab.note.action.save': 'Spara anteckningen',
  'collab.note.action.share': 'Dela anteckningen',
  'collab.poll.toast.opened': 'Omröstningen öppnad',
  'collab.poll.toast.openedBody': 'Alla på resan kan rösta nu.',
  'collab.poll.toast.openFailed': 'Omröstningen öppnades inte',
  'collab.poll.dialog.addTitle': 'Ny omröstning',
  'collab.poll.field.question': 'Fråga',
  'collab.poll.field.questionPlaceholder': 'Var äter vi sista kvällen?',
  'collab.poll.field.optionsLegend': 'Alternativ',
  'collab.poll.field.option': 'Svar {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Ett svar till',
  'collab.poll.action.addOption': 'Lägg till ett svar',
  'collab.poll.action.removeOption': 'Ta bort svaret {n}',
  'collab.poll.field.multi': 'Låt flera väljas',
  'collab.poll.field.multiHint':
    'Av betyder en röst var, och att ändra sig flyttar den.',
  'collab.poll.action.opening': 'Öppnar omröstningen',
  'collab.poll.action.open': 'Öppna omröstningen',
  'collab.poll.error.tooFew':
    'En omröstning behöver minst två saker att välja mellan.',
  'collab.poll.error.duplicate':
    'Två svar säger samma sak. Ge vart och ett sin egen formulering.',
  'collab.presence.viewingNow': 'tittar just nu',
  'collab.presence.unnamed': 'Medlem utan namn',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} öppen flik',
    other: '{name} — {count} öppna flikar',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Håller med',
  'collab.reaction.love': 'Gillar',
  'collab.reaction.funny': 'Roligt',
  'collab.reaction.celebrate': 'Fira',
  'collab.reaction.thanks': 'Tack',
  'collab.reaction.looking': 'Tittar',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, du också',
  'collab.thread.today': 'I dag',
  'collab.thread.emptyBody':
    'Alla på den här resan delar en och samma tråd. Beslut som fattas här stannar med resan i stället för att spridas över gruppchattar.',
  'collab.thread.empty': 'Inga meddelanden än',
  'collab.toast.reactionFailed': 'Reaktionen sparades inte',
  'collab.toast.messageDeleted': 'Meddelandet borttaget',
  'collab.toast.deleteFailed': 'Meddelandet togs inte bort',
  'collab.toast.notSent': 'Inte skickat',
  'collab.toast.notSentBody':
    'Meddelandet kunde inte skickas. Försök igen om en stund.',
  'collab.toast.messageUpdated': 'Meddelandet uppdaterat',
  'collab.toast.editFailed': 'Ändringen sparades inte',
  'collab.message.deleteTitle': 'Ta bort det här meddelandet?',
  'collab.message.deleteBody':
    'Texten försvinner ur tråden. Svaren på den ligger kvar.',
  'collab.message.delete': 'Ta bort meddelandet',
  'collab.message.reply': 'Svara',
  'collab.message.menuEdit': 'Redigera meddelandet…',
  'collab.message.react': 'Reagera på det här meddelandet',
  'collab.message.edited': 'redigerat',
  'collab.message.actionsFor': 'Åtgärder för meddelandet från {name}',
  'collab.compose.editingYours': 'Du redigerar ditt meddelande',
  'collab.compose.replyingTo': 'Svar till {name}',
  'collab.compose.cancelReply': 'Avbryt svaret',
  'collab.compose.cancelEdit': 'Avbryt redigeringen',
  'collab.compose.placeholder': 'Skriv till resan',
  'collab.compose.placeholderText': 'Skriv något till gruppen…',
  'collab.compose.editPlaceholder': 'Redigera ditt meddelande',
  'collab.compose.editPlaceholderText': 'Ändra det du sa…',
  'collab.compose.send': 'Skicka meddelandet',
  'collab.compose.savingEdit': 'Sparar ändringen',
  'collab.compose.save': 'Spara',
  'collab.hint.sends': 'skickar',
  'collab.hint.addsLine': 'lägger till en rad',
  'collab.hint.cancels': 'avbryter',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Anteckningen borttagen',
  'collab.toast.noteRemoveFailed': 'Anteckningen togs inte bort',
  'collab.notes.empty.title': 'Inga delade anteckningar',
  'collab.notes.empty.body':
    'Restaurangtips, visumregler, koden till porten — allt som hela resan behöver komma ihåg.',
  'collab.notes.empty.action': 'Skriv den första anteckningen',
  'collab.note.menu.edit': 'Redigera anteckningen…',
  'collab.note.menu.unpin': 'Lossa',
  'collab.note.menu.pin': 'Fäst högst upp',
  'collab.note.remove': 'Ta bort anteckningen',
  'collab.note.removeBody':
    'Anteckningen försvinner från tavlan för alla på resan.',
  'collab.note.new': 'Ny anteckning',
  'collab.poll.toast.voteFailed': 'Din röst sparades inte',
  'collab.poll.toast.voteFailedBody': 'Räkningen är oförändrad.',
  'collab.poll.toast.closed': 'Omröstningen stängd',
  'collab.poll.toast.closeFailed': 'Omröstningen stängdes inte',
  'collab.poll.toast.removed': 'Omröstningen borttagen',
  'collab.poll.toast.removeFailed': 'Omröstningen togs inte bort',
  'collab.polls.heading': 'Omröstningar',
  'collab.polls.empty.title': 'Inga öppna omröstningar',
  'collab.polls.empty.body':
    'När gruppen inte kan enas om en restaurang, lägg fram det för omröstning och låt svaret avgöra sig självt.',
  'collab.polls.empty.action': 'Fråga gruppen',
  'collab.poll.menu.close': 'Stäng omröstningen',
  'collab.poll.remove': 'Ta bort omröstningen',
  'collab.poll.removeTitle': 'Ta bort den här omröstningen?',
  'collab.poll.actionsFor': 'Åtgärder för omröstningen ”{question}”',
  'collab.badge.pinned': 'Fäst',
  'collab.badge.closed': 'Stängd',
  'collab.badge.open': 'Öppen',
  'collab.badge.multi': 'Flerval',
  'collab.badge.leading': 'Leder',
  'collab.poll.removeBody': {
    one: '”{question}” och dess {count} röst försvinner för alla.',
    other: '”{question}” och dess {count} röster försvinner för alla.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} av {count} röst',
    other: '{label} — {votes} av {count} röster',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} av {count} röst, din också',
    other: '{label} — {votes} av {count} röster, din också',
  },
  'collab.poll.voteCount': {
    one: '{count} röst',
    other: '{count} röster',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Dokument',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Biljett',
  'files.kind.receipt': 'Kvitto',
  'files.kind.map': 'Karta',
  'files.kind.other': 'Övrigt',
  'files.kindChoice.ticket': 'Biljett eller passerkort',
  'files.kindChoice.map': 'Karta eller rutt',
  'files.toast.removed': 'Filen borttagen',
  'files.toast.removeFailed': 'Filen togs inte bort',
  'files.toast.downloadFailed': 'Nedladdningen startade inte',
  'files.toast.gone': 'Filen finns inte längre i den här fliken.',
  'files.toast.uploadFailed': 'Uppladdningen misslyckades. Försök igen.',
  'files.toast.updated': 'Filen uppdaterad',
  'files.toast.updateFailed': 'Filen uppdaterades inte',
  'files.storage.full': 'Den här arbetsytan har slut på lagring',
  'files.storage.used':
    '{used} av {limit} är använt. Ta bort en fil nedan, eller byt till en högre nivå, innan du lägger till något mer.',
  'files.storage.perFile': 'upp till {size} styck',
  'files.action.add': 'Lägg till filer',
  'files.action.choose': 'Välj filer',
  'files.action.upload': 'Ladda upp filer',
  'files.calendar.live.action': 'Uppdaterad kalenderlänk',
  'files.calendar.live.title': 'Uppdaterad kalenderlänk',
  'files.calendar.warning':
    'Alla med den här länken kan läsa resans platser, tider, adresser och anteckningar utan konto. Skydda den som ett lösenord.',
  'files.calendar.enable.action': 'Skapa en länk',
  'files.calendar.link.once':
    'Kopiera den nu - vi visar den bara en gång. Skapa en ny länk om du tappar bort den; den gamla slutar fungera.',
  'files.calendar.link.address': 'Länkadress',
  'files.calendar.link.copy': 'Kopiera länk',
  'files.calendar.link.copied': 'Länk kopierad',
  'files.calendar.link.copyFailed':
    'Det gick inte att kopiera. Markera adressen och kopiera den själv.',
  'files.calendar.link.open': 'Öppna i din kalenderapp',
  'files.calendar.link.google': 'Lägg till i Google Kalender',
  'files.calendar.link.outlook': 'Lägg till i Outlook',
  'files.calendar.link.done': 'Klart',
  'files.calendar.link.stays':
    'Bekräftelsenummer, priser och filer stannar i planned.travel.',
  'files.calendar.freshness':
    'Kalenderappar kan ta flera timmar, ibland längre, på sig att visa en ändring.',
  'files.calendar.state.on': 'Kalenderlänken är på',
  'files.calendar.state.lastFetched':
    'En kalender kontrollerade senast länken {when}',
  'files.calendar.state.neverFetched': 'Inte hämtad ännu',
  'files.calendar.rotate.action': 'Skapa en ny länk',
  'files.calendar.rotate.confirmTitle': 'Skapa en ny länk?',
  'files.calendar.rotate.confirmBody':
    'Den gamla länken slutar fungera nu. Kalendrar som använder den slutar uppdateras tills du ger dem den nya länken.',
  'files.calendar.rotate.busy': 'Skapar en ny länk…',
  'files.calendar.error.rotate':
    'Vi kunde inte bekräfta att en ny länk skapades. Aktuell status visas nedan; försök igen vid behov.',
  'files.calendar.rotate.confirm': 'Skapa en ny länk',
  'files.calendar.off.action': 'Stäng av',
  'files.calendar.off.confirmTitle': 'Stänga av den här kalenderlänken?',
  'files.calendar.off.confirmBody':
    'Länken slutar fungera direkt. Kalendrar behåller redan hämtade händelser men slutar uppdatera dem.',
  'files.calendar.off.confirm': 'Stäng av',
  'files.calendar.off.busy': 'Stänger av…',
  'files.calendar.closeGuard.title': 'Stänga utan att kopiera länken?',
  'files.calendar.closeGuard.body':
    'Vi kan inte visa den igen. Du måste skapa en ny.',
  'files.calendar.closeGuard.confirm': 'Stäng ändå',
  'files.calendar.closeGuard.cancel': 'Håll öppen',
  'files.calendar.error.enable':
    'Det gick inte att bekräfta att länken skapades. Aktuell status visas nedan. Om den är på men du aldrig såg den, stäng av den och skapa den igen.',
  'files.calendar.error.off':
    'Det gick inte att bekräfta att länken stängdes av. Aktuell status visas nedan; försök igen vid behov.',
  'files.calendar.error.load':
    'Det gick inte att kontrollera resans kalenderlänk. Försök igen.',
  'files.calendar.retry': 'Försök igen',
  'files.calendar.off.confirmBodyUnused':
    'Länken har inte använts ännu. Den slutar fungera direkt.',
  'files.calendar.link.fallback':
    'Om den inte går att lägga till på telefonen, öppna sidan på en dator.',
  'files.calendar.link.newTab': 'öppnas i en ny flik',
  'files.calendar.title': 'Kalender',
  'files.calendar.description':
    'Ta med den här resan till kalenderappen du redan använder.',
  'files.calendar.download.action': 'Ladda ner kalenderfil (.ics)',
  'files.calendar.download.hint':
    'En ögonblicksbild av resan som den ser ut nu. Den uppdateras inte.',
  'files.calendar.undated':
    'Den här resan har inga datum än, så bara bokningar och resor med datum visas.',
  'files.calendar.download.error':
    'Vi kunde inte förbereda filen. Försök igen.',
  'files.calendar.timesNote':
    'Resor med tidszon visas vid samma tidpunkt överallt. Allt annat visas på sin planerade klocktid, var din kalender än finns.',
  'files.drop.active': 'Släpp för att ladda upp',
  'files.drop.pasteHint': 'klistrar in en kopierad bild eller skärmdump',
  'files.reject.blockedType':
    '”{name}” lades inte till: XML-filer och komprimerade SVG-filer sparas inte här, av säkerhetsskäl. Spara den som PDF eller bild och lägg till den i stället.',
  'files.drop.idle': 'Dra filer hit',
  'files.empty.title': 'Inga filer på den här resan',
  'files.empty.body':
    'Allt du annars skulle gräva fram ur en inkorg vid incheckningen ligger här, vid resan det hör till.',
  'files.empty.hint':
    'Boardingkort, hotellbekräftelser, biljetter, försäkringspapper och kvittona som styrker dina utgifter.',
  'files.heading': 'Bilagor',
  'files.tableCaption': 'Filer som hör till den här resan',
  'files.menu.download': 'Ladda ner',
  'files.menu.rename': 'Byt namn och beskriv…',
  'files.menu.remove': 'Ta bort filen',
  'files.remove.body':
    'Filen raderas ur lagringen såväl som från resan, och {size} frigörs. Det går inte att ångra.',
  'files.queue.clear': 'Rensa färdiga',
  'files.column.file': 'Fil',
  'files.column.size': 'Storlek',
  'files.column.addedBy': 'Tillagd av',
  'files.column.when': 'När',
  'files.status.uploaded': 'Uppladdad',
  'files.status.failed': 'Misslyckad',
  'files.status.cancelled': 'Avbruten',
  'files.status.uploading': 'Laddar upp',
  'files.status.waiting': 'Väntar',
  'files.error.nameEmpty': 'En fil behöver ett namn du hittar den på.',
  'files.field.kindHint':
    'Avgör vilket filter den hamnar under och vilket tecken den får.',
  'files.field.kindAria': 'Sorts fil',
  'files.field.description': 'Beskrivning',
  'files.field.descriptionPlaceholder':
    'Försäkringsbrev — täcker hela sällskapet, skadenummer på sidan 2.',
  'files.dialog.title': 'Filuppgifter',
  'files.action.saving': 'Sparar filen',
  'files.action.save': 'Spara uppgifterna',
  'files.queue.someFailed': {
    one: '{count} fil laddades inte upp. Skälet står på varje rad — inget annat i omgången påverkades.',
    other:
      '{count} filer laddades inte upp. Skälet står på varje rad — inget annat i omgången påverkades.',
  },

  'files.action.cancelUploadOf': 'Avbryt uppladdningen av {name}',
  'files.action.dismissOf': 'Dölj {name}',
  'files.status.downloadingOf': 'Laddar ner {name}',
  'files.status.uploadingOf': 'Laddar upp {name}',
  'files.status.uploadingCount': {
    one: 'Laddar upp {count} fil',
    other: 'Laddar upp {count} filer',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - skapad {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': '{title} är klar',
  'files.export.email.body': {
    one: 'Reseexporten är klar. Den sparas i {count} dag.',
    other: 'Reseexporten är klar. Den sparas i {count} dagar.',
  },
  'files.export.email.action': 'Öppna {title}',
  'files.export.email.text': 'Reseexporten är klar: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Exportera resan',
  'files.export.description':
    'En utskrivbar kopia av resan: dagar, stopp, bokningar, transporter och boenden. Ge den till någon som inte har något konto.',
  'files.export.kept': {
    one: 'Varje export sparas i {count} dag.',
    other: 'Varje export sparas i {count} dagar.',
  },
  'files.export.empty.title': 'Inga exporter ännu',
  'files.export.empty.body':
    'Gör en utskrivbar kopia av resan att skicka till någon som inte har något konto.',
  'files.export.empty.bodyViewer': 'Resans ägare eller redigerare kan göra en.',
  'files.export.format.pdf': 'PDF-fil',
  'files.export.format.html': 'Utskrivbar sida',
  'files.export.artifact': 'Reseexport, {date}',
  'files.export.download': 'Ladda ner',
  'files.export.downloadLabelPdf': 'Ladda ner PDF-filen som skapades {date}',
  'files.export.downloadLabelHtml':
    'Ladda ner den utskrivbara sidan som skapades {date}',
  'files.export.error.list': 'Listan med exporter laddades inte.',
  'files.export.retry': 'Försök igen',
  'files.export.error.missing':
    'Den exporten sparas inte längre. Exportera resan igen.',
  'files.export.error.missingViewer': 'Den exporten sparas inte längre.',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Uppladdningen avbruten.',
  'files.error.badAnswer':
    'Servern skickade ett svar som den här webbläsaren inte kunde läsa.',
  'files.error.connection':
    'Anslutningen bröts under uppladdningen. Kolla nätet och försök igen.',
  'files.error.timeout': 'Uppladdningen tog för lång tid. Försök igen.',
  'files.error.refused': 'Servern nekade uppladdningen ({status}).',
  'files.error.downloadShape':
    'Nedladdningen kom tillbaka i en form vi inte kunde spara.',
  'files.error.downloadFailed': 'Nedladdningen misslyckades ({status}).',
  'files.toast.uploadedOne': 'Filen uppladdad',
  'files.toast.uploadedManyBody': '{size} tillagt på den här resan.',
  'files.toast.failedOne': 'Den filen laddades inte upp',
  'files.toast.failedManyBody': 'Kön nedanför säger varför för var och en.',
  'files.error.tooMany': {
    one: 'Bara {count} fil kan läggas till åt gången, så ”{name}” hamnade utanför. Släpp in den ensam igen.',
    other:
      'Bara {count} filer kan läggas till åt gången, så ”{name}” hamnade utanför. Släpp in den ensam igen.',
  },
  'files.toast.uploadedMany': {
    one: '{count} fil uppladdad',
    other: '{count} filer uppladdade',
  },
  'files.toast.failedMany': {
    one: '{count} fil laddades inte upp',
    other: '{count} filer laddades inte upp',
  },

  'files.export.request': 'Exportera resan',
  'files.export.includeReferences': 'Ta med bekräftelsekoder',
  'files.export.includeReferencesHint':
    'Lämna avmarkerat om du skickar filen till någon utanför din arbetsyta.',
  'files.export.pending':
    'Din export förbereds. Du kan lämna sidan; filen visas i listan när den är klar.',
  'files.export.slow':
    'Det tar längre tid än vanligt. Filen visas här när den är klar. Exportera igen om den inte dyker upp.',
  'files.export.refresh': 'Uppdatera',
  'files.export.ready': 'Din export är klar',
  'files.export.quota': {
    one: 'Arbetsytans månadskvot på {count} exporter är slut. Räknaren börjar om {date}.',
    other:
      'Arbetsytans månadskvot på {count} exporter är slut. Räknaren börjar om {date}.',
  },
  'files.export.error.request': 'Exporten startades inte',
  'files.export.error.requestBody':
    'Detta försök räknades inte. Försök igen om en stund.',
  'files.export.doc.overview': 'Översikt',
  'files.export.doc.timezone': 'Tidszon',
  'files.export.doc.days': 'Dagar',
  'files.export.doc.day': {
    one: 'Dag {count} - {date}',
    other: 'Dag {count} - {date}',
  },
  'files.export.doc.dayUndated': { one: 'Dag {count}', other: 'Dag {count}' },
  'files.export.doc.dayEmpty': 'Inget planerat än.',
  'files.export.doc.reservations': 'Bokningar',
  'files.export.doc.transport': 'Resor och transporter',
  'files.export.doc.reference': 'Referens {code}',
  'files.export.doc.route': '{from} till {to}',
  'files.export.doc.stays': 'Här bor vi',
  'files.export.doc.nights': {
    one: 'Nätter: {count}',
    other: 'Nätter: {count}',
  },
  'files.export.doc.truncatedDays': {
    one: 'Alla dagar ryms inte i ett dokument. De första {count} dagarna visas.',
    other:
      'Alla dagar ryms inte i ett dokument. De första {count} dagarna visas.',
  },
  'files.export.doc.truncatedRows': {
    one: 'Visar de första {count} av {total}.',
    other: 'Visar de första {count} av {total}.',
  },
  'files.export.notify': 'Mejla mig när exporten är klar',
  'files.export.viewer':
    'Bara ägare och redigerare kan skapa en export. Du kan ladda ner dem som finns.',
  'files.export.jump': 'Gå till exporter',
  'files.export.fromLink': 'Från din länk',
  'files.export.linkGone':
    'Den här exporten sparas inte längre. Skapa en ny nedan.',
  'files.export.allowance': {
    one: '{used} av {count} export använd denna månad',
    other: '{used} av {count} exporter använda denna månad',
  },
  'files.export.allowanceUnlimited': {
    one: '{count} export denna månad',
    other: '{count} exporter denna månad',
  },
  'files.export.linkGoneViewer': 'Den exporten sparas inte längre.',
} satisfies TranslationOf<typeof En>

export default messages
