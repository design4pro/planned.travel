/**
 * The public pages' copy, in sv.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Typografi.** Svenska citerar med ”…”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Börja gratis',
  'action.signIn': 'Logga in',
  'action.pricing': 'Priser',
  'action.seePricing': 'Se priserna',
  'action.skipToContent': 'Hoppa till innehållet',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — startsida',
  'nav.onThisPage': 'På den här sidan',
  'anchor.planner': 'Planerare',
  'anchor.modules': 'Moduler',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Släpp på dag {day}',
  'legal.summaryNote':
    'Sammanfattningen finns för att läsas. Det som gäller är det som står nedan.',
  'visual.daysTravelled': 'Resdagar',
  'visual.acrossEveryTrip': 'över alla resor',
  'visual.mapFilled': '{percent} % av kartan ifylld',
  'visual.previewSummary':
    'En förhandsvisning av planned.travel-panelen: nästa resa med datum, resenärer och antal platser; summor för besökta länder, resor och resdagar; en karta över resvägen; och de två närmaste bokningarna.',
  'visual.placesMapped': {
    one: '{value} plats på kartan',
    other: '{value} platser på kartan',
  },
  'visual.splitWays': {
    one: 'inte delad',
    other: 'delad på {value}',
  },
  'visual.tripTotal': 'Resans total',
  'visual.paidSplit': '{who} betalade · {split}',
  'visual.nextUp': 'Nästa',
  'visual.ofTotal': '{done} av {total}',
  'visual.awaitingReply': 'Väntar på svar',
  'visual.upcoming': 'Kommande',
  'visual.days': {
    one: '{value} dag',
    other: '{value} dagar',
  },
  'visual.places': {
    one: '{value} plats',
    other: '{value} platser',
  },
  'visual.transfersLeft': {
    one: '{value} överföring kvar',
    other: '{value} överföringar kvar',
  },

  'legal.badge.version': 'Version {version}',
  'legal.badge.effective': 'Gäller från {updated}',
  'legal.notice.title': 'Det här är en mall, inte juridisk rådgivning',
  'legal.notice.body':
    'Den är skriven på enkel engelska för att vara en faktiskt användbar utgångspunkt för en liten reseplaneringstjänst, och varje lucka ett företag måste fylla är utmärkt. Låt en kvalificerad jurist i din jurisdiktion granska och anpassa den innan du tar emot en enda kund. Inget här hävdar en certifiering, granskning eller efterlevnadsstandard som planned.travel har.',
  'legal.contents': 'Innehåll',
  'legal.shortVersion': 'Kortversionen',
  'legal.both': 'Båda dokumenten gäller tillsammans.',

  'landing.plans.title': 'Börja gratis. Betala först när det förtjänar det.',
  'landing.plans.lede':
    'Alla planer innehåller dagsplaneraren, kartan, budgetarna och packlistorna. Betalplaner - från {price} i månaden - öppnar obegränsat med resor, bokningar, dagboken och exporter.',
  'landing.plans.ledeFree':
    'Alla planer innehåller dagsplaneraren, kartan, budgetarna och packlistorna. Betalplaner öppnar obegränsat med resor, bokningar, dagboken och exporter.',
  'landing.plans.compare': 'Jämför varje gräns, rad för rad',
  'landing.questions.title': 'Frågor, rakt besvarade',
  'landing.questions.lede':
    'De fem sakerna folk faktiskt vill veta innan de börjar.',
  'cta.heading': 'Din nästa resa är redan värd att planeras ordentligt',
  'cta.lede':
    'Två resor, hela kartan, dagsplaneringen och packlistorna - gratis, utan kort och utan nedräkning.',
  'landing.faq.seats.q': 'Måste de jag reser med också betala?',
  'landing.faq.seats.a':
    'Nej. Alla du bjuder in i en arbetsyta med {crew} täcks av dess platser. De loggar in med sitt eget konto och ser bara de resor du lagt till dem i.',
  'landing.faq.phone.q': 'Fungerar det ordentligt i telefonen?',
  'landing.faq.phone.a':
    'Ja. De mobila layouterna är ritade separat i stället för klämda ner från skrivbordsversionerna, och det är en webbplats - det finns inget att installera och inget att hålla uppdaterat.',
  'landing.faq.privacy.q': 'Vem kan se min resa?',
  'landing.faq.privacy.a':
    'En resa hör till en arbetsyta, och bara de som bjudits in dit kan öppna den. Inget är offentligt, det finns inget upptäcktsflöde, och som standard delas inget med någon.',
  'landing.faq.stop.q': 'Vad händer med mina resor om jag slutar betala?',
  'landing.faq.stop.a':
    'Inget tas bort. De betalda modulerna låses, dina resor ligger kvar exakt där de är, och allt öppnas igen i samma stund du tecknar en plan. {free} förblir gratis, utan nedräkning.',

  'action.startPlanning': 'Börja planera gratis',
  'cta.comparePlans': 'Jämför planerna',
  'landing.hero.eyebrow': 'Reseplanering tillsammans',
  'landing.hero.title': 'Planera resan.',
  'landing.hero.titleQuiet': 'Inte kalkylbladet.',
  'landing.hero.lede':
    'En reseplan på en riktig karta, delad live med alla som reser - med bokningarna, pengarna och packlistan fästa vid den.',
  'landing.hero.secondary': 'Se vad det kostar',
  'landing.trust.noCard': 'Inget kort för att börja',
  'landing.trust.noAds': 'Ingen reklam, inga affiliate-länkar',
  'landing.trust.export': 'Exportera allt, när som helst',

  'proof.eyebrow': 'Rakt på sak',
  'proof.title': 'Inga omdömen, för vi har inte förtjänat några än',
  'proof.lede':
    'planned.travel är nytt. I stället för att hitta på ett citat eller låna någons logotyp står här precis vad det gör, vem det är för och vad det aldrig kommer att göra med dig.',
  'proof.who.label': 'Vem det är för',
  'proof.who.heading': 'Den som ändå slutar med att göra kalkylbladet',
  'proof.who.body':
    'Par, familjer och kompisgäng som vill ha en plan som alla ser, i stället för sex skärmdumpar, tre gruppchattar och en delad anteckning ingen har öppnat sedan mars.',
  'proof.not.label': 'Vad det inte är',
  'proof.not.heading': 'Ingen bokningssajt, och inte till salu till en',
  'proof.not.body':
    'Vi tar ingen provision, bär ingen reklam och lägger inga affiliate-länkar, så inget på en sida styr dig tyst mot ett särskilt hotell. Du betalar oss, alltså jobbar vi för dig.',
  'proof.where.label': 'Var dina saker bor',
  'proof.where.heading': 'På Cloudflare, i din egen arbetsyta',
  'proof.where.body':
    'Resor ligger i en databas begränsad till din arbetsyta och filer i vår egen objektlagring, båda levererade från Cloudflares edge. Polar, vår återförsäljare i juridisk mening, sköter kassan och utfärdar fakturan, så ditt kortnummer når aldrig oss.',
  'proof.promise.ads.title': 'Ingen reklam, ingen analys från tredje part',
  'proof.promise.ads.body': 'Inget på den här sidan mäter dig för någon annan.',
  'proof.promise.sold.title': 'Dina resor säljs eller hyrs aldrig ut',
  'proof.promise.sold.body':
    'Inte till annonsörer, inte till resebolag, inte till någon.',
  'proof.promise.leave.title': 'Lämna när du vill, med allt',
  'proof.promise.leave.body':
    'PDF-reseplaner, kalenderfiler och dina platser som GeoJSON.',
  'proof.certification':
    'Vi har i dag ingen säkerhetscertifiering, och vi kommer inte att antyda någon. När planned.travel granskas mot en standard är det här vi skriver standarden, granskaren och datumet - inte innan.',

  'feature.modules.title': 'Resten av resan, ordnad',
  'feature.modules.lede':
    'Varje modul gör en sak ordentligt och lämnar sitt arbete vidare till de andra. Inget här är en tom flik som väntar på en framtida release.',
  'feature.module.lists.benefit': 'Ingen kommer fram utan adaptern.',
  'feature.module.lists.detail':
    'Packning, att-göra, inköp och dokument - en lista per uppgift, delad med alla som reser och avbockad medan det händer.',
  'feature.module.journal.name': 'Dagbok',
  'feature.module.journal.benefit': 'Resan blir en berättelse, inte en mapp.',
  'feature.module.journal.detail':
    'Inlägg i datumordning med bilderna du tog, var du var, vädret och hur dagen faktiskt kändes.',
  'feature.module.atlas.benefit': 'En karta över allt du har sett.',
  'feature.module.atlas.detail':
    'Markera ett land som besökt och det hamnar på din världskarta, med första besöket, det senaste och hur många gånger du har varit tillbaka.',
  'feature.module.vacay.benefit': 'Boka ledigheten innan du bokar flyget.',
  'feature.module.vacay.detail':
    'Markera dagarna du är borta och året fylls i - helger, röda dagar och allas annans ledighet i samma rutnät.',
  'feature.module.collab.benefit': 'Besluten stannar hos resan.',
  'feature.module.collab.detail':
    'En tråd per resa, delade anteckningar för det alla måste minnas, och en omröstning för när gruppen inte kan enas om maten.',
  'feature.module.files.benefit': 'Boardingkorten där du hittar dem.',
  'feature.module.files.detail':
    'Bekräftelser, biljetter, försäkringsbesked och kvitton hänger på resan de hör till, inte begravda i en inkorg.',

  'feature.planner.title': 'En dagsplanering ritad på en riktig karta',
  'feature.planner.lede':
    'Samla platserna du vill se och dra dem till en dag. Kartan ritar om rutten medan du håller på, så du ser direkt när en förmiddag får dig att korsa staden två gånger.',
  'feature.planner.point.days':
    'En kolumn per dag, med datum, väder och stället du sover på.',
  'feature.planner.point.unscheduled':
    'Platser utan datum väntar i sin egen kolumn tills de får en dag.',
  'feature.planner.point.crew':
    'I {crew} drar alla samtidigt: live-markörer, direkt synkronisering, ingen omladdning.',
  'feature.planner.point.tiles':
    'Vektorrutor från vår egen lagring, så ingen kartleverantör tittar på hur du planerar.',
  'feature.costs.title': 'Delade kostnader som faktiskt går jämnt ut',
  'feature.costs.lede':
    'Skriv upp vad du lägger ut i resans valuta, dela varje utgift så som ni faktiskt kom överens, och se den kortaste raden överföringar som gör allt kvitt.',
  'feature.costs.point.split':
    'Jämnt, efter andel eller på kronan - per utgift, inte per resa.',
  'feature.costs.point.currency':
    'Allt omräknat till en resevaluta, så att summan betyder något.',
  'feature.costs.point.settle':
    'Avräkningsvyn säger vem som betalar vem, och bokför överföringen när den är gjord.',
  'feature.costs.point.receipt':
    'Fäst kvittot vid utgiften, så att siffran alltid har sitt underlag.',
  'feature.book.title': 'Varje bokning, med koden du behöver vid dörren',
  'feature.book.lede':
    'Boenden, bord, turer och biljetter i en lista, intill flygen, tågen och färjorna som tar dig mellan dem - var och en med bokningsnummer och dagen den hör till.',
  'feature.book.point.legs':
    'Resesträckor bär platsen, spåret, terminalen och bokningskoden.',
  'feature.book.point.day':
    'En bokning hänger på en dag och står därför i planeringen utan att skrivas om.',
  'feature.book.point.states':
    'Begärd, bekräftad och avbokad är egna tillstånd, inte en anteckning i ett fält.',
  'feature.book.point.export':
    'Exportera hela resan som PDF-reseplan eller kalenderfil innan du flyger.',

  'pricing.faq.trial.q': 'Vad händer när testperioden tar slut?',
  'pricing.faq.trial.a':
    'Testperioden övergår i den betalda planen. Polar sparar en betalningsmetod när testperioden börjar och debiterar den dagen den tar slut, så avslutar du innan dess blir du aldrig debiterad. Ingenting raderas i något av fallen: de betalda modulerna låses, dina resor ligger exakt kvar, och allt öppnas igen i samma stund du prenumererar.',
  'pricing.faq.seller.q': 'Vem köper jag egentligen av?',
  'pricing.faq.seller.a':
    'Av Polar. De är vår återförsäljare av record: de säljer prenumerationen till dig som vår återförsäljare, tar betalningen, utfärdar fakturan i eget namn och avgör, tar in och betalar den försäljningsskatt eller moms ditt land tar. Återbetalningar och kortinvändningar sköts också med dem. Vi driver fortfarande tjänsten och svarar på dina mejl.',
  'pricing.faq.change.q': 'Kan jag byta plan mitt i en resa?',
  'pricing.faq.change.a':
    'Ja. Uppgraderingar gäller direkt och räknas per dag; nedgraderingar börjar gälla i slutet av perioden du redan betalat för, så du förlorar aldrig åtkomst du betalat för.',
  'pricing.faq.seats.q': 'Hur funkar debitering per medlem på {crew}?',
  'pricing.faq.seats.a':
    'Du betalar för de platser du faktiskt fyller, och du kan ändra antalet när som helst. Öppna inbjudningar räknas mot dina platser, så en arbetsyta kan aldrig tyst överskrida planen.',
  'pricing.faq.guests.q': 'Behöver mina medresenärer egna prenumerationer?',
  'pricing.faq.guests.a':
    'Nej. Alla du bjuder in i en arbetsyta med {crew} täcks av dess platser. De loggar in med sitt eget konto och ser de resor de har lagts till i.',
  'pricing.faq.storage.q': 'Vad räknas mot lagringen?',
  'pricing.faq.storage.a':
    'Fotografier, biljetter, bekräftelser och varje fil du fäster vid en resa. Kartrutor och appen själv räknas aldrig. I Inställningar ser du exakt vad som tar plats.',
  'pricing.faq.export.q': 'Kan jag få ut mina data?',
  'pricing.faq.export.a':
    'Alltid. Varje resa exporteras som PDF-reseplan och som kalenderfil, och dina platser som GeoJSON. Det är dina resor, inte våra.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Inget kort, ingen frist, ingen nedräkning',
  'pricing.card.yearlyPerSeat': '{amount} per år och medlem, en gång',
  'pricing.card.yearly': '{amount} debiteras en gång om året',
  'pricing.card.seatsUnlimited': 'Obegränsat med medlemmar',
  'pricing.card.tripsUnlimited': 'obegränsat med resor',
  'pricing.card.startFree': 'Börja gratis',
  'pricing.card.startTrial': 'Prova {plan}',
  'pricing.card.popular': 'Det mest valda',
  'pricing.card.noteYearly':
    'Debiteras en gång om året. Två månader bjuder vi på.',
  'pricing.card.noteMonthly':
    'Debiteras per månad. Byt eller avsluta när du vill.',
  'pricing.card.trial': {
    one: '{value} dag gratis, kort i förväg, debitering när det tar slut',
    other: '{value} dagar gratis, kort i förväg, debitering när det tar slut',
  },
  'pricing.card.seatsUpTo': {
    one: 'Upp till {value} medlem',
    other: 'Upp till {value} medlemmar',
  },
  'pricing.card.trips': {
    one: '{value} resa i taget',
    other: '{value} resor i taget',
  },

  'pricing.feature.storage': '{size} för foton och dokument',
  'pricing.feature.storageShared': '{size} delat för foton och dokument',
  'pricing.feature.free.tripsDetail': 'Arkivera en för att börja nästa',
  'pricing.feature.solo.modules': 'Alla planeringsmoduler',
  'pricing.feature.solo.modulesDetail': 'Bokningar, dagbok, budgetar, packning',
  'pricing.feature.crew.membersDetail':
    'Faktureras per medlem, ändra när du vill',
  'pricing.feature.crew.realtimeDetail':
    'Live-markörer och direkt synkronisering',
  'pricing.feature.crew.supportDetail':
    'Svar från en människa inom en arbetsdag',

  'pricing.hero.eyebrow': 'Två resor gratis, för alltid',
  'pricing.hero.title': 'Planera ordentligt.',
  'pricing.hero.titleQuiet': 'Betala för det du använder.',
  'pricing.hero.lede':
    'Planera två resor gratis. Lås upp varje modul för en resenär, eller ta med hela gänget och redigera samma resa samtidigt.',
  'pricing.hero.taxNote':
    'Priser i amerikanska dollar, exklusive försäljningsskatt och moms. Polar är vår återförsäljare av record: det är Polar som står på fakturan, räknar ut vad ditt land tar, lägger på det i kassan och betalar in det. Avsluta när du vill, inifrån produkten.',
  'pricing.compare.eyebrow': 'Sida vid sida',
  'pricing.compare.title': 'Varje gräns, jämförd',
  'pricing.compare.lede':
    'En tabell, skapad ur samma katalog som faktureringen läser. Säger en rad att en modul ingår, håller behörighetskontrollen med.',
  'pricing.compare.caption':
    'Jämförelse av funktioner och gränser över alla tre planer',
  'pricing.compare.feature': 'Funktion',
  'pricing.compare.limits': 'Gränser',
  'pricing.compare.included': 'Ingår',
  'pricing.compare.notIncluded': 'Ingår inte',
  'pricing.compare.includedIn': 'Ingår i {plan}',
  'pricing.compare.notIn': 'Inte i {plan}',
  'pricing.questions.eyebrow': 'Innan du frågar',
  'pricing.questions.title': 'Frågor, besvarade',
  'pricing.questions.lede':
    'Fakturering, testperioder och att få ut sina data igen.',
  'pricing.cta.secondary': 'Se hur det funkar',
  'pricing.module.itinerary': 'Dagsplan',
  'pricing.module.map': 'Interaktiv karta',
  'pricing.module.budget': 'Budgetar och delade utgifter',
  'pricing.module.packing': 'Pack- och att-göra-listor',
  'pricing.module.reservations': 'Bokningar',
  'pricing.module.journal': 'Resedagbok',
  'pricing.module.atlas': 'Världskarta över besökta länder',
  'pricing.module.collaboration': 'Bjud in andra resenärer',
  'pricing.module.realtime': 'Samarbete i realtid',
  'pricing.module.offlineMaps': 'Offlinekartor',
  'pricing.module.pdfExport': 'PDF- och kalenderexport',
  'pricing.module.prioritySupport': 'Prioriterad support',

  'anchor.plans': 'Prisplaner',
  'anchor.compare': 'Jämförelse',
  'anchor.questions': 'Frågor',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'En enda plats för resplanen, kartan, bokningarna, pengarna och packlistan — delad med alla som följer med.',
  'footer.attribution':
    'Körs på Cloudflare Workers. Kartdata © OpenStreetMap-bidragsgivarna. Sälj och fakturering via Polar, vår merchant of record.',
  'footer.column.product': 'Produkt',
  'footer.column.account': 'Konto',
  'footer.link.overview': 'Översikt',
  'footer.link.everyModule': 'Alla moduler',
  'footer.link.dayPlanner': 'Dagsplanerare',
  'footer.link.sharedCosts': 'Delade kostnader',
  'footer.link.reservations': 'Bokningar',
  'footer.link.atlasJournal': 'Atlas och dagbok',
  'footer.link.createAccount': 'Skapa ett konto',
  'footer.link.terms': 'Användarvillkor',
  'footer.link.privacy': 'Integritetsmeddelande',
} satisfies TranslationOf<typeof En>

export default messages
