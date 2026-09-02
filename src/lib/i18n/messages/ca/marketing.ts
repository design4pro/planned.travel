/**
 * The public pages' copy, in ca.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Tipografia.** El català cita amb «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Comença gratis',
  'action.signIn': 'Inicia la sessió',
  'action.pricing': 'Preus',
  'action.seePricing': 'Mira els preus',
  'action.skipToContent': 'Ves al contingut',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — inici',
  'nav.onThisPage': 'En aquesta pàgina',
  'anchor.planner': 'Planificador',
  'anchor.modules': 'Mòduls',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Deixa-ho al dia {day}',
  'legal.summaryNote':
    'El resum hi és per ser llegit. El que s’aplica de debò és el que ve a sota.',
  'visual.daysTravelled': 'Dies de viatge',
  'visual.acrossEveryTrip': 'a tots els viatges',
  'visual.mapFilled': '{percent}% del mapa completat',
  'visual.previewSummary':
    'Una vista prèvia del tauler de planned.travel: el pròxim viatge amb les dates, els viatgers i el nombre de llocs; els totals de països visitats, viatges i dies de viatge; un mapa de la ruta; i les dues pròximes reserves.',
  'visual.placesMapped': {
    one: '{value} lloc al mapa',
    many: '{value} llocs al mapa',
    other: '{value} llocs al mapa',
  },
  'visual.splitWays': {
    one: 'sense repartir',
    many: 'repartit entre {value}',
    other: 'repartit entre {value}',
  },
  'visual.tripTotal': 'Total del viatge',
  'visual.paidSplit': 'ho va pagar {who} · {split}',
  'visual.nextUp': 'A continuació',
  'visual.ofTotal': '{done} de {total}',
  'visual.awaitingReply': 'Esperant resposta',
  'visual.upcoming': 'Pròxims',
  'visual.days': {
    one: '{value} dia',
    many: '{value} dies',
    other: '{value} dies',
  },
  'visual.places': {
    one: '{value} lloc',
    many: '{value} llocs',
    other: '{value} llocs',
  },
  'visual.transfersLeft': {
    one: 'queda {value} transferència',
    many: 'queden {value} transferències',
    other: 'queden {value} transferències',
  },

  'legal.badge.version': 'Versió {version}',
  'legal.badge.effective': 'En vigor des del {updated}',
  'legal.notice.title': 'Això és una plantilla, no assessorament jurídic',
  'legal.notice.body':
    'Està escrita en anglès senzill per ser un punt de partida realment útil per a un servei petit de planificació de viatges, i cada buit que una empresa ha d’omplir hi és assenyalat. Fes que un advocat qualificat de la teva jurisdicció la revisi i l’adapti abans d’acceptar un sol client. Res d’aquí no afirma que planned.travel tingui cap certificació, auditoria ni estàndard de compliment.',
  'legal.contents': 'Contingut',
  'legal.shortVersion': 'La versió breu',
  'legal.both': 'Els dos documents s’apliquen conjuntament.',

  'landing.plans.title': 'Comença gratis. Paga només quan s’ho guanyi.',
  'landing.plans.lede':
    'Tots els plans inclouen el planificador diari, el mapa, els pressupostos i les llistes d’equipatge. Els plans de pagament - des de {price} al mes - desbloquegen viatges il·limitats, reserves, el diari, mapes fora de línia i exportacions.',
  'landing.plans.ledeFree':
    'Tots els plans inclouen el planificador diari, el mapa, els pressupostos i les llistes d’equipatge. Els plans de pagament desbloquegen viatges il·limitats, reserves, el diari, mapes fora de línia i exportacions.',
  'landing.plans.compare': 'Compara cada límit, línia per línia',
  'landing.questions.title': 'Preguntes, respostes sense voltes',
  'landing.questions.lede':
    'Les sis coses que la gent vol saber de debò abans de començar.',
  'cta.heading': 'El teu pròxim viatge ja mereix planificar-se bé',
  'cta.lede':
    'Dos viatges, tot el mapa, l’itinerari i les llistes d’equipatge: gratis, sense targeta i sense compte enrere.',
  'landing.faq.seats.q': 'La gent amb qui viatjo també ha de pagar?',
  'landing.faq.seats.a':
    'No. Tothom que convides a un espai de treball {crew} queda cobert per les seves places. Entren amb el seu propi compte i veuen només els viatges als quals els has afegit.',
  'landing.faq.phone.q': 'Funciona bé al mòbil?',
  'landing.faq.phone.a':
    'Sí. Les disposicions per a mòbil es dibuixen a part en lloc de comprimir-se des de les d’escriptori, i és un web: no hi ha res a instal·lar ni a mantenir actualitzat.',
  'landing.faq.offline.q': 'Puc fer servir el mapa sense cobertura?',
  'landing.faq.offline.a':
    'Amb {solo} i {crew} pots baixar una regió abans de volar, així que el mapa es dibuixa igual quan aterres sense dades. Editar el viatge sí que necessita connexió.',
  'landing.faq.privacy.q': 'Qui pot veure el meu viatge?',
  'landing.faq.privacy.a':
    'Un viatge pertany a un sol espai de treball, i només les persones convidades a aquell espai el poden obrir. Res no és públic, no hi ha cap canal de descoberta i, per defecte, res no es comparteix amb ningú.',
  'landing.faq.stop.q': 'Què passa amb els meus viatges si deixo de pagar?',
  'landing.faq.stop.a':
    'No s’esborra res. Els mòduls de pagament es bloquegen, els teus viatges es queden exactament on són i tot es desbloqueja en el moment que et subscrius. El pla {free} continua gratis, sense compte enrere.',

  'action.startPlanning': 'Comença a planificar gratis',
  'cta.comparePlans': 'Compara els plans',
  'landing.hero.eyebrow': 'Planificació de viatges en grup',
  'landing.hero.title': 'Planifica el viatge.',
  'landing.hero.titleQuiet': 'No el full de càlcul.',
  'landing.hero.lede':
    'Un itinerari sobre un mapa de debò, compartit en directe amb tothom qui viatja, amb les reserves, els diners i la llista d’equipatge enganxats.',
  'landing.hero.secondary': 'Mira què costa',
  'landing.trust.noCard': 'Sense targeta per començar',
  'landing.trust.noAds': 'Sense anuncis ni enllaços d’afiliació',
  'landing.trust.export': 'Exporta-ho tot, quan vulguis',

  'proof.eyebrow': 'Respostes clares',
  'proof.title': 'Cap testimoni, perquè encara no ens l’hem guanyat',
  'proof.lede':
    'planned.travel és nou. En lloc d’inventar una citació o manllevar el logotip d’algú, aquí tens exactament què fa, per a qui és i què no et farà mai.',
  'proof.who.label': 'Per a qui és',
  'proof.who.heading': 'Per a qui acaba fent el full de càlcul',
  'proof.who.body':
    'Parelles, famílies i grups d’amics que volen un pla que tothom vegi, en lloc de sis captures, tres grups de xat i una nota compartida que ningú no ha obert des del març.',
  'proof.not.label': 'Què no és',
  'proof.not.heading': 'No és un web de reserves, ni està en venda a un',
  'proof.not.body':
    'No cobrem comissió, no portem anuncis i no posem enllaços d’afiliació, així que res d’una pàgina no t’empeny en silenci cap a un hotel concret. Ens pagues tu, o sigui que treballem per a tu.',
  'proof.where.label': 'On viuen les teves coses',
  'proof.where.heading': 'A Cloudflare, al teu propi espai de treball',
  'proof.where.body':
    'Els viatges són en una base de dades limitada al teu espai de treball i els fitxers al nostre propi emmagatzematge d’objectes, tots dos servits des de la vora de Cloudflare. Polar, el nostre venedor oficial, gestiona el pagament i emet la factura, així que el número de la teva targeta no ens arriba mai.',
  'proof.promise.ads.title': 'Cap publicitat, cap analítica de tercers',
  'proof.promise.ads.body':
    'Res d’aquesta pàgina no t’està mesurant per a algú altre.',
  'proof.promise.sold.title': 'Els teus viatges no es venen ni es lloguen mai',
  'proof.promise.sold.body':
    'Ni a anunciants, ni a empreses de viatges, ni a ningú.',
  'proof.promise.leave.title': 'Marxa quan vulguis, amb tot',
  'proof.promise.leave.body':
    'Itineraris en PDF, fitxers de calendari i els teus llocs en GeoJSON.',
  'proof.certification':
    'Avui no tenim cap certificació de seguretat, i no insinuarem que en tinguem. Quan planned.travel se sotmeti a una auditoria contra un estàndard, aquí direm l’estàndard, l’auditor i la data - i no abans.',

  'feature.modules.title': 'La resta del viatge, resolta',
  'feature.modules.lede':
    'Cada mòdul fa bé una sola cosa i passa la seva feina als altres. Aquí no hi ha cap pestanya de farciment esperant una versió futura.',
  'feature.module.lists.benefit': 'Ningú no arriba sense l’adaptador.',
  'feature.module.lists.detail':
    'Equipatge, tasques, compres i documents: una llista per feina, compartida amb tothom qui viatja i marcada a mesura que passa.',
  'feature.module.journal.name': 'Diari',
  'feature.module.journal.benefit':
    'El viatge esdevé un relat, no una carpeta.',
  'feature.module.journal.detail':
    'Entrades per data amb les fotos que has fet, on eres, el temps i com va anar el dia de debò.',
  'feature.module.atlas.benefit': 'Un mapa de tots els llocs on has estat.',
  'feature.module.atlas.detail':
    'Marca un país com a visitat i s’afegeix al teu mapa del món, amb la primera visita, la més recent i quantes vegades hi has tornat.',
  'feature.module.vacay.benefit': 'Demana els dies abans de comprar el vol.',
  'feature.module.vacay.detail':
    'Marca els dies que ets fora i l’any s’omple: caps de setmana, festius i les vacances de tots els altres a la mateixa graella.',
  'feature.module.collab.benefit': 'Les decisions es queden amb el viatge.',
  'feature.module.collab.detail':
    'Un fil per viatge, notes compartides per allò que tothom ha de recordar i una enquesta per quan el grup no es posa d’acord amb el sopar.',
  'feature.module.files.benefit':
    'Les targetes d’embarcament allà on les trobaràs.',
  'feature.module.files.detail':
    'Confirmacions, entrades, pòlisses i rebuts adjuntats al viatge al qual pertanyen, no enterrats en una safata d’entrada.',

  'feature.planner.title': 'Un pla dia a dia dibuixat sobre un mapa de debò',
  'feature.planner.lede':
    'Reuneix els llocs que vols veure i arrossega’ls a un dia. El mapa redibuixa la ruta mentre treballes, així veus de seguida quan un matí et fa travessar la ciutat dues vegades.',
  'feature.planner.point.days':
    'Una columna per dia, amb la data, el temps i el lloc on dorms.',
  'feature.planner.point.unscheduled':
    'Els llocs sense data esperen a la seva columna fins que tenen un dia.',
  'feature.planner.point.crew':
    'Amb {crew} tothom arrossega alhora: cursors en directe, sincronització instantània, sense recarregar.',
  'feature.planner.point.tiles':
    'Tessel·les vectorials servides del nostre propi emmagatzematge, així cap proveïdor de mapes no mira com planifiques.',
  'feature.costs.title': 'Despeses compartides que es liquiden de debò',
  'feature.costs.lede':
    'Anota què gastes en la moneda del viatge, reparteix cada despesa tal com ho vau acordar i mira el conjunt més curt de transferències que ho tanca tot.',
  'feature.costs.point.split':
    'A parts iguals, per quota o per import exacte: per despesa, no per viatge.',
  'feature.costs.point.currency':
    'Tot convertit a una sola moneda del viatge perquè el total signifiqui alguna cosa.',
  'feature.costs.point.settle':
    'La vista de liquidació diu qui paga a qui i registra la transferència quan es fa.',
  'feature.costs.point.receipt':
    'Adjunta el rebut a la despesa, perquè la xifra sempre tingui la seva prova.',
  'feature.book.title': 'Cada reserva, amb el codi que et cal a la porta',
  'feature.book.lede':
    'Allotjaments, taules, visites i entrades en una llista, al costat dels vols, trens i ferris que t’hi porten: cadascun amb el número de confirmació i el dia al qual pertany.',
  'feature.book.point.legs':
    'Els trajectes porten el seient, l’andana, la terminal i el codi de reserva.',
  'feature.book.point.day':
    'Una reserva va lligada a un dia, així que apareix al pla sense tornar-la a escriure.',
  'feature.book.point.states':
    'Sol·licitada, confirmada i cancel·lada són estats separats, no una nota en un camp.',
  'feature.book.point.export':
    'Exporta tot el viatge com a itinerari en PDF o fitxer de calendari abans de volar.',

  'pricing.faq.trial.q': 'Què passa quan s’acaba la prova?',
  'pricing.faq.trial.a':
    'La prova es converteix en el pla de pagament. Polar registra un mètode de pagament quan comença la prova i el cobra el dia que la prova s’acaba, així que si cancel·les abans no et cobren mai. En cap cas no s’esborra res: els mòduls de pagament es bloquegen, els teus viatges es queden exactament on són, i tot es desbloqueja en el moment en què et subscrius.',
  'pricing.faq.seller.q': 'A qui li compro, en realitat?',
  'pricing.faq.seller.a':
    'A Polar. És el nostre venedor registrat: et ven la subscripció com a revenedor, cobra el pagament, emet la factura en nom propi i determina, recapta i liquida l’impost sobre vendes o l’IVA que cobra el teu país. Les devolucions i les disputes de targeta també es resolen amb ells. El servei el continuem duent nosaltres, i nosaltres responem els teus correus.',
  'pricing.faq.change.q': 'Puc canviar de pla a mitja viatge?',
  'pricing.faq.change.a':
    'Sí. Les pujades de pla s’apliquen immediatament i es prorrategen al dia; les baixades tenen efecte al final del període que ja has pagat, així que mai no perds un accés que has pagat.',
  'pricing.faq.seats.q': 'Com funciona la facturació per membre al pla {crew}?',
  'pricing.faq.seats.a':
    'Pagues per les places que ocupes de debò, i pots canviar el nombre en qualsevol moment. Les invitacions pendents compten a les teves places, perquè un espai no superi mai el pla sense dir-ho.',
  'pricing.faq.guests.q':
    'La gent amb qui viatjo necessita la seva pròpia subscripció?',
  'pricing.faq.guests.a':
    'No. Tothom que convides a un espai de treball {crew} queda cobert per les seves places. Entren amb el seu propi compte i veuen els viatges als quals han estat afegits.',
  'pricing.faq.storage.q': 'Què compta per a l’emmagatzematge?',
  'pricing.faq.storage.a':
    'Fotografies, bitllets, confirmacions i qualsevol fitxer que adjuntis a un viatge. Les tessel·les del mapa i la mateixa aplicació no compten mai. A Configuració veus exactament què ocupa espai.',
  'pricing.faq.export.q': 'Puc endur-me les meves dades?',
  'pricing.faq.export.a':
    'Sempre. Cada viatge s’exporta com a itinerari en PDF i com a fitxer de calendari, i els teus llocs com a GeoJSON. Són els teus viatges, no els nostres.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Sense targeta, sense termini, sense compte enrere',
  'pricing.card.yearlyPerSeat': '{amount} l’any per membre, en un sol càrrec',
  'pricing.card.yearly': '{amount} en un sol càrrec l’any',
  'pricing.card.seatsUnlimited': 'Membres il·limitats',
  'pricing.card.tripsUnlimited': 'viatges il·limitats',
  'pricing.card.startFree': 'Comença gratis',
  'pricing.card.startTrial': 'Prova {plan}',
  'pricing.card.popular': 'El més triat',
  'pricing.card.noteYearly': 'Un càrrec l’any. Dos mesos els posem nosaltres.',
  'pricing.card.noteMonthly':
    'Càrrec mensual. Canvia o cancel·la quan vulguis.',
  'pricing.card.trial': {
    one: '{value} dia de prova, targeta per endavant, càrrec al final',
    many: '{value} dies de prova, targeta per endavant, càrrec al final',
    other: '{value} dies de prova, targeta per endavant, càrrec al final',
  },
  'pricing.card.seatsUpTo': {
    one: 'Fins a {value} membre',
    many: 'Fins a {value} membres',
    other: 'Fins a {value} membres',
  },
  'pricing.card.trips': {
    one: '{value} viatge a la vegada',
    many: '{value} viatges a la vegada',
    other: '{value} viatges a la vegada',
  },

  'pricing.feature.storage': '{size} per a fotos i documents',
  'pricing.feature.storageShared': '{size} compartits per a fotos i documents',
  'pricing.feature.free.tripsDetail': "Arxiva'n un per començar-ne un altre",
  'pricing.feature.solo.modules': 'Tots els mòduls de planificació',
  'pricing.feature.solo.modulesDetail':
    'Reserves, diari, pressupostos, equipatge',
  'pricing.feature.solo.offlineDetail': 'Baixa les regions abans de volar',
  'pricing.feature.crew.membersDetail':
    'Es factura per membre, canvia-ho quan vulguis',
  'pricing.feature.crew.realtimeDetail':
    'Cursors en directe i sincronització instantània',
  'pricing.feature.crew.supportDetail':
    "Resposta d'una persona en un dia laborable",

  'pricing.hero.eyebrow': 'Dos viatges gratis, per sempre',
  'pricing.hero.title': 'Planifica-ho com cal.',
  'pricing.hero.titleQuiet': 'Paga pel que facis servir.',
  'pricing.hero.lede':
    'Planifica dos viatges de franc. Desbloqueja tots els mòduls per a un viatger, o porta tot el grup i editeu el mateix itinerari alhora.',
  'pricing.hero.taxNote':
    'Preus en dòlars dels EUA, sense impost sobre vendes ni IVA. Polar és el nostre venedor registrat: és qui apareix a la teva factura, calcula què cobra el teu país, ho afegeix en pagar i ho liquida. Cancel·la quan vulguis, des del producte.',
  'pricing.compare.eyebrow': 'Un al costat de l’altre',
  'pricing.compare.title': 'Cada límit, comparat',
  'pricing.compare.lede':
    'Una taula, generada des del mateix catàleg que llegeix la facturació. Si una fila diu que un mòdul hi és inclòs, la comprovació de drets hi està d’acord.',
  'pricing.compare.caption': 'Comparació de funcions i límits als tres plans',
  'pricing.compare.feature': 'Funció',
  'pricing.compare.limits': 'Límits',
  'pricing.compare.included': 'Inclòs',
  'pricing.compare.notIncluded': 'No inclòs',
  'pricing.compare.includedIn': 'Inclòs a {plan}',
  'pricing.compare.notIn': 'No és a {plan}',
  'pricing.questions.eyebrow': 'Abans que ho preguntis',
  'pricing.questions.title': 'Preguntes, respostes',
  'pricing.questions.lede':
    'Facturació, proves i com recuperar les teves dades.',
  'pricing.cta.secondary': 'Mira com funciona',
  'pricing.module.itinerary': 'Itinerari dia a dia',
  'pricing.module.map': 'Mapa interactiu',
  'pricing.module.budget': 'Pressupostos i repartiment de despeses',
  'pricing.module.packing': 'Llistes d’equipatge i tasques',
  'pricing.module.reservations': 'Reserves',
  'pricing.module.journal': 'Diari de viatge',
  'pricing.module.atlas': 'Mapa de països visitats',
  'pricing.module.collaboration': 'Convida altres viatgers',
  'pricing.module.realtime': 'Col·laboració en directe',
  'pricing.module.offlineMaps': 'Mapes fora de línia',
  'pricing.module.pdfExport': 'Exportació a PDF i calendari',
  'pricing.module.prioritySupport': 'Suport prioritari',

  'anchor.plans': 'Tarifes',
  'anchor.compare': 'Comparativa',
  'anchor.questions': 'Preguntes',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Un sol lloc per a l’itinerari, el mapa, les reserves, els diners i la llista d’equipatge — compartit amb tothom qui hi va.',
  'footer.attribution':
    'Funciona sobre Cloudflare Workers. Dades cartogràfiques © els col·laboradors d’OpenStreetMap. Venda i facturació a càrrec de Polar, el nostre comerciant registrat.',
  'footer.column.product': 'Producte',
  'footer.column.account': 'Compte',
  'footer.link.overview': 'Visió general',
  'footer.link.everyModule': 'Tots els mòduls',
  'footer.link.dayPlanner': 'Planificador del dia',
  'footer.link.sharedCosts': 'Despeses compartides',
  'footer.link.reservations': 'Reserves',
  'footer.link.atlasJournal': 'Atles i diari',
  'footer.link.createAccount': 'Crea un compte',
  'footer.link.terms': 'Condicions del servei',
  'footer.link.privacy': 'Avís de privacitat',
} satisfies TranslationOf<typeof En>

export default messages
