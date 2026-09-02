/**
 * The public pages' copy, in cs.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Typografie.** Čeština cituje „…“.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Začít zdarma',
  'action.signIn': 'Přihlásit se',
  'action.pricing': 'Ceny',
  'action.seePricing': 'Zobrazit ceny',
  'action.skipToContent': 'Přejít na obsah',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — domovská stránka',
  'nav.onThisPage': 'Na této stránce',
  'anchor.planner': 'Plánovač',
  'anchor.modules': 'Moduly',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Pustit na den {day}',
  'legal.summaryNote': 'Souhrn je tu k přečtení. Platí to, co je níž.',
  'visual.daysTravelled': 'Dny na cestách',
  'visual.acrossEveryTrip': 'na všech cestách',
  'visual.mapFilled': 'vyplněno {percent} % mapy',
  'visual.previewSummary':
    'Náhled přehledu planned.travel: nejbližší cesta s daty, počtem cestujících a počtem míst; součty navštívených zemí, cest a dnů na cestách; mapa trasy; a nejbližší dvě rezervace.',
  'visual.placesMapped': {
    one: '{value} místo na mapě',
    few: '{value} místa na mapě',
    many: '{value} místa na mapě',
    other: '{value} míst na mapě',
  },
  'visual.splitWays': {
    one: 'bez dělení',
    few: 'rozděleno na {value}',
    many: 'rozděleno na {value}',
    other: 'rozděleno na {value}',
  },
  'visual.tripTotal': 'Součet cesty',
  'visual.paidSplit': 'zaplatil(a) {who} · {split}',
  'visual.nextUp': 'Nejbližší',
  'visual.ofTotal': '{done} z {total}',
  'visual.awaitingReply': 'Čeká na odpověď',
  'visual.upcoming': 'Nadcházející',
  'visual.days': {
    one: '{value} den',
    few: '{value} dny',
    many: '{value} dne',
    other: '{value} dní',
  },
  'visual.places': {
    one: '{value} místo',
    few: '{value} místa',
    many: '{value} místa',
    other: '{value} míst',
  },
  'visual.transfersLeft': {
    one: 'zbývá {value} převod',
    few: 'zbývají {value} převody',
    many: 'zbývá {value} převodu',
    other: 'zbývá {value} převodů',
  },

  'legal.badge.version': 'Verze {version}',
  'legal.badge.effective': 'Účinné od {updated}',
  'legal.notice.title': 'Tohle je vzor, ne právní rada',
  'legal.notice.body':
    'Je napsaný jednoduchou angličtinou, aby byl skutečně užitečným výchozím bodem pro malou službu na plánování cest, a každá mezera, kterou musí firma doplnit, je vyznačená. Než přijmete jediného zákazníka, nechte to zkontrolovat a upravit kvalifikovaným právníkem ve své jurisdikci. Nic tady netvrdí, že planned.travel má jakoukoli certifikaci, audit nebo standard shody.',
  'legal.contents': 'Obsah',
  'legal.shortVersion': 'Krátká verze',
  'legal.both': 'Oba dokumenty platí společně.',

  'landing.plans.title': 'Začněte bezplatně. Zaplaťte, až si to zaslouží.',
  'landing.plans.lede':
    'Každý plán obsahuje denní plánovač, mapu, rozpočty a seznamy na balení. Placené plány - od {price} měsíčně - odemykají neomezené cesty, rezervace, deník, offline mapy a exporty.',
  'landing.plans.ledeFree':
    'Každý plán obsahuje denní plánovač, mapu, rozpočty a seznamy na balení. Placené plány odemykají neomezené cesty, rezervace, deník, offline mapy a exporty.',
  'landing.plans.compare': 'Porovnejte každý limit, řádek po řádku',
  'landing.questions.title': 'Otázky, odpovědi bez okolků',
  'landing.questions.lede':
    'Šest věcí, které lidé opravdu chtějí vědět, než začnou.',
  'cta.heading': 'Vaše příští cesta si už zaslouží poctivý plán',
  'cta.lede':
    'Dvě cesty, celá mapa, plán dne a seznamy na balení - bezplatně, bez karty a bez odpočtu.',
  'landing.faq.seats.q': 'Musí platit i lidé, s kterými jedu?',
  'landing.faq.seats.a':
    'Ne. Každý, koho pozvete do pracovního prostoru {crew}, je krytý jeho místy. Přihlásí se svým vlastním účtem a vidí jen ty cesty, ke kterým jste ho přidali.',
  'landing.faq.phone.q': 'Funguje to na telefonu poctivě?',
  'landing.faq.phone.a':
    'Ano. Mobilní rozvržení jsou kreslená zvlášť, ne zmáčknutá z desktopových, a je to webová stránka - není co instalovat a není co udržovat aktuální.',
  'landing.faq.offline.q': 'Můžu mapu používat bez signálu?',
  'landing.faq.offline.a':
    'S plány {solo} a {crew} si můžete před odletem stáhnout region, takže mapa se kreslí i po přistání bez dat. Úpravy samotné cesty vyžadují připojení.',
  'landing.faq.privacy.q': 'Kdo vidí moji cestu?',
  'landing.faq.privacy.a':
    'Cesta patří jednomu pracovnímu prostoru a otevřou ji jen lidé pozvaní do toho prostoru. Nic není veřejné, žádný objevovací kanál neexistuje a ve výchozím stavu se nic s nikým nesdílí.',
  'landing.faq.stop.q': 'Co se stane s mými cestami, když přestanu platit?',
  'landing.faq.stop.a':
    'Nic se nemaže. Placené moduly se zamknou, vaše cesty zůstanou přesně tam, kde jsou, a všechno se zase odemkne ve chvíli, kdy si plán koupíte. Plán {free} zůstává bez placení, bez odpočtu.',

  'action.startPlanning': 'Začněte plánovat bezplatně',
  'cta.comparePlans': 'Porovnat plány',
  'landing.hero.eyebrow': 'Společné plánování cest',
  'landing.hero.title': 'Naplánujte cestu.',
  'landing.hero.titleQuiet': 'Ne tabulku.',
  'landing.hero.lede':
    'Jeden plán na skutečné mapě, sdílený naživo se všemi, kdo jedou - s rezervacemi, penězi a seznamem na balení u sebe.',
  'landing.hero.secondary': 'Podívejte se, kolik to stojí',
  'landing.trust.noCard': 'Bez karty na začátek',
  'landing.trust.noAds': 'Žádná reklama, žádné affiliate odkazy',
  'landing.trust.export': 'Vyexportujte všechno, kdykoli',

  'proof.eyebrow': 'Přímé odpovědi',
  'proof.title': 'Žádné reference, protože jsme si je ještě nezasloužili',
  'proof.lede':
    'planned.travel je nové. Místo vymýšlení citátu nebo půjčování cizího loga tu stojí přesně to, co dělá, pro koho je a co vám nikdy neudělá.',
  'proof.who.label': 'Pro koho to je',
  'proof.who.heading': 'Pro toho, kdo nakonec dělá tu tabulku',
  'proof.who.body':
    'Pro páry, rodiny a skupiny přátel, které chtějí jeden plán, jejž vidí všichni, místo šesti screenshotů, tří skupinových chatů a společné poznámky, kterou od března nikdo neotevřel.',
  'proof.not.label': 'Co to není',
  'proof.not.heading': 'Není to rezervační portál a není na prodej žádnému',
  'proof.not.body':
    'Nebereme provizi, nenosíme reklamu a nedáváme affiliate odkazy, takže vás na žádné stránce nic potichu nesměruje k určitému hotelu. Platíte nám vy, takže pracujeme pro vás.',
  'proof.where.label': 'Kde leží vaše věci',
  'proof.where.heading': 'Na Cloudflare, ve vašem vlastním pracovním prostoru',
  'proof.where.body':
    'Cesty leží v databázi omezené na váš pracovní prostor a soubory v našem vlastním objektovém úložišti, obojí podávané z okraje sítě Cloudflare. Polar, náš prodejce v právním smyslu, vede platbu a vystavuje fakturu, takže číslo vaší karty se k nám nikdy nedostane.',
  'proof.promise.ads.title': 'Žádná reklama, žádná analytika třetích stran',
  'proof.promise.ads.body': 'Nic na této stránce vás neměří pro někoho jiného.',
  'proof.promise.sold.title': 'Vaše cesty se nikdy neprodávají ani nepůjčují',
  'proof.promise.sold.body':
    'Ani zadavatelům reklamy, ani cestovním firmám, nikomu.',
  'proof.promise.leave.title': 'Odejděte, kdy chcete, a vezměte si všechno',
  'proof.promise.leave.body':
    'Plány v PDF, soubory kalendáře a vaše místa jako GeoJSON.',
  'proof.certification':
    'Dnes nemáme žádnou bezpečnostní certifikaci a nebudeme žádnou naznačovat. Až planned.travel projde auditem proti nějakému standardu, právě tady napíšeme ten standard, auditora a datum - ne dřív.',

  'feature.modules.title': 'Zbytek cesty, vyřešený',
  'feature.modules.lede':
    'Každý modul dělá jednu věc poctivě a svou práci předává ostatním. Nic tady není prázdná karta čekající na budoucí vydání.',
  'feature.module.lists.benefit': 'Nikdo nepřijede bez adaptéru.',
  'feature.module.lists.detail':
    'Balení, úkoly, nákupy a dokumenty - jeden seznam na jednu věc, společný pro všechny cestující a odškrtávaný průběžně.',
  'feature.module.journal.name': 'Deník',
  'feature.module.journal.benefit': 'Z cesty je vyprávění, ne složka.',
  'feature.module.journal.detail':
    'Zápisy podle data, s fotkami, které jste udělali, místem, počasím a tím, jaký ten den vlastně byl.',
  'feature.module.atlas.benefit': 'Jedna mapa všeho, kde jste byli.',
  'feature.module.atlas.detail':
    'Označte zemi jako navštívenou a přidá se na vaši mapu světa, s první návštěvou, poslední a počtem návratů.',
  'feature.module.vacay.benefit': 'Vyřiďte dovolenou dřív než letenku.',
  'feature.module.vacay.detail':
    'Označte dny, kdy jste mimo, a rok se vyplní - víkendy, státní svátky a volno všech ostatních v jedné mřížce.',
  'feature.module.collab.benefit': 'Rozhodnutí zůstávají u cesty.',
  'feature.module.collab.detail':
    'Jedno vlákno na cestu, společné poznámky na to, co si všichni musí pamatovat, a hlasování na chvíli, kdy se skupina neshodne na večeři.',
  'feature.module.files.benefit': 'Palubní vstupenky tam, kde je najdete.',
  'feature.module.files.detail':
    'Potvrzení, vstupenky, pojistky a účtenky připojené k cestě, ke které patří, ne zahrabané v e-mailu.',

  'feature.planner.title': 'Plán den po dni, nakreslený na skutečné mapě',
  'feature.planner.lede':
    'Posbírejte místa, která chcete vidět, a pak je přetáhněte na konkrétní den. Mapa překresluje trasu průběžně, takže hned vidíte, když vás dopoledne pošle přes město dvakrát.',
  'feature.planner.point.days':
    'Jeden sloupec na den, s datem, počasím a místem, kde spíte.',
  'feature.planner.point.unscheduled':
    'Místa bez termínu čekají ve vlastním sloupci, dokud nedostanou den.',
  'feature.planner.point.crew':
    'V plánu {crew} přetahují všichni zároveň: živé kurzory, okamžitá synchronizace, žádné načítání.',
  'feature.planner.point.tiles':
    'Vektorové dlaždice z našeho vlastního úložiště, takže žádný dodavatel map nekouká, co plánujete.',
  'feature.costs.title': 'Společné výdaje, které se opravdu vyrovnají',
  'feature.costs.lede':
    'Zapisujte výdaje v měně cesty, každý rozdělte tak, jak jste se skutečně dohodli, a podívejte se na nejkratší řadu převodů, která všechno srovná.',
  'feature.costs.point.split':
    'Rovným dílem, podle podílu nebo na částku přesně - u každého výdaje, ne u celé cesty.',
  'feature.costs.point.currency':
    'Všechno přepočítané na jednu měnu cesty, aby součet něco znamenal.',
  'feature.costs.point.settle':
    'Vyrovnání řekne, kdo komu platí, a zaznamená převod, jakmile proběhne.',
  'feature.costs.point.receipt':
    'Připojte účtenku k výdaji, aby číslo vždy mělo svůj doklad.',
  'feature.book.title': 'Každá rezervace, s kódem, který potřebujete u dveří',
  'feature.book.lede':
    'Nocleh, stůl, prohlídka i vstupenka v jednom seznamu, vedle letů, vlaků a trajektů, které vás mezi nimi převezou - každá s číslem potvrzení a dnem, ke kterému patří.',
  'feature.book.point.legs':
    'Úseky dopravy nesou místo, nástupiště, terminál a rezervační kód.',
  'feature.book.point.day':
    'Rezervace patří ke dni, takže se objeví v plánu bez přepisování.',
  'feature.book.point.states':
    'Vyžádáno, potvrzeno a zrušeno jsou samostatné stavy, ne poznámka v poli.',
  'feature.book.point.export':
    'Vyexportujte celou cestu jako plán v PDF nebo soubor kalendáře, ještě než odletíte.',

  'pricing.faq.trial.q': 'Co se stane, když skončí zkušební období?',
  'pricing.faq.trial.a':
    'Zkušební období přejde v placený tarif. Polar si při jeho začátku uloží platební metodu a zaúčtuje ji v den, kdy zkušební období skončí — když zrušíte dřív, nikdy se nic nestrhne. V žádném případě se nic nemaže: placené moduly se zamknou, vaše cesty zůstanou přesně tam, kde jsou, a všechno se znovu otevře ve chvíli, kdy si tarif koupíte.',
  'pricing.faq.seller.q': 'Od koho vlastně kupuji?',
  'pricing.faq.seller.a':
    'Od Polaru. Je to náš prodejce v právním smyslu: prodává vám předplatné jako náš reseller, přijímá platbu, vystavuje fakturu vlastním jménem a zjišťuje, vybírá a odvádí daň z prodeje či DPH, kterou vybírá vaše země. Vrácení peněz a spory o kartu se řeší také s ním. Službu dál provozujeme my a my odpovídáme na vaše e-maily.',
  'pricing.faq.change.q': 'Můžu změnit tarif v polovině cesty?',
  'pricing.faq.change.a':
    'Ano. Přechod výš platí okamžitě a účtuje se na den; přechod níž nastane na konci období, které jste už zaplatili, takže nikdy nepřijdete o přístup, za nějž jste platili.',
  'pricing.faq.seats.q': 'Jak funguje účtování za člena u plánu {crew}?',
  'pricing.faq.seats.a':
    'Platíte za místa, která skutečně zaplníte, a číslo můžete kdykoli změnit. Nevyřízené pozvánky se do míst počítají, aby prostor nikdy potichu nepřekročil tarif.',
  'pricing.faq.guests.q':
    'Potřebují lidé, s nimiž cestuji, vlastní předplatné?',
  'pricing.faq.guests.a':
    'Ne. Každý, koho pozvete do pracovního prostoru {crew}, je krytý jeho místy. Přihlásí se svým vlastním účtem a vidí cesty, ke kterým byl přidán.',
  'pricing.faq.storage.q': 'Co se počítá do úložiště?',
  'pricing.faq.storage.a':
    'Fotografie, jízdenky, potvrzení a každý soubor, který připojíte k cestě. Dlaždice mapy ani samotná aplikace se nikdy nepočítají. V Nastavení uvidíte přesně, co zabírá místo.',
  'pricing.faq.export.q': 'Můžu si svá data odnést?',
  'pricing.faq.export.a':
    'Vždycky. Každá cesta se exportuje jako plán v PDF a jako soubor kalendáře, vaše místa jako GeoJSON. Jsou to vaše cesty, ne naše.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Bez karty, bez lhůty, bez odpočtu',
  'pricing.card.yearlyPerSeat': '{amount} za rok na osobu, účtováno jednou',
  'pricing.card.yearly': '{amount} účtováno jednou ročně',
  'pricing.card.seatsUnlimited': 'Bez omezení členů',
  'pricing.card.tripsUnlimited': 'bez omezení cest',
  'pricing.card.startFree': 'Začněte zdarma',
  'pricing.card.startTrial': 'Vyzkoušejte {plan}',
  'pricing.card.popular': 'Nejčastěji volený',
  'pricing.card.noteYearly': 'Účtováno jednou ročně. Dva měsíce jsou od nás.',
  'pricing.card.noteMonthly':
    'Účtováno měsíčně. Změníte nebo zrušíte, kdy chcete.',
  'pricing.card.trial': {
    one: '{value} den zdarma, karta předem, platba na konci',
    few: '{value} dny zdarma, karta předem, platba na konci',
    many: '{value} dne zdarma, karta předem, platba na konci',
    other: '{value} dní zdarma, karta předem, platba na konci',
  },
  'pricing.card.seatsUpTo': {
    one: 'Až {value} člen',
    few: 'Až {value} členové',
    many: 'Až {value} člena',
    other: 'Až {value} členů',
  },
  'pricing.card.trips': {
    one: '{value} cesta zároveň',
    few: '{value} cesty zároveň',
    many: '{value} cesty zároveň',
    other: '{value} cest zároveň',
  },

  'pricing.feature.storage': '{size} na fotky a dokumenty',
  'pricing.feature.storageShared': '{size} společně na fotky a dokumenty',
  'pricing.feature.free.tripsDetail': 'Jednu archivujte a začněte další',
  'pricing.feature.solo.modules': 'Všechny moduly plánování',
  'pricing.feature.solo.modulesDetail': 'Rezervace, deník, rozpočty, balení',
  'pricing.feature.solo.offlineDetail': 'Stáhněte si regiony před odletem',
  'pricing.feature.crew.membersDetail': 'Účtuje se za člena, změníte kdykoli',
  'pricing.feature.crew.realtimeDetail':
    'Živé kurzory a okamžitá synchronizace',
  'pricing.feature.crew.supportDetail':
    'Odpověď od člověka do jednoho pracovního dne',

  'pricing.hero.eyebrow': 'Dvě cesty zdarma, navždy',
  'pricing.hero.title': 'Naplánujte to pořádně.',
  'pricing.hero.titleQuiet': 'Plaťte za to, co využíváte.',
  'pricing.hero.lede':
    'Naplánujte dvě cesty zdarma. Odemkněte každý modul pro jednoho cestujícího, nebo vezměte celou partu a upravujte stejný plán současně.',
  'pricing.hero.taxNote':
    'Ceny v amerických dolarech, bez daně z prodeje a DPH. Polar je náš prodejce v právním smyslu: je uveden na vaší faktuře, zjistí, co vybírá vaše země, přidá to při platbě a odvede. Zrušit můžete kdykoli, přímo v produktu.',
  'pricing.compare.eyebrow': 'Vedle sebe',
  'pricing.compare.title': 'Každý limit, srovnaný',
  'pricing.compare.lede':
    'Jedna tabulka, vytvořená ze stejného katalogu, který čte fakturace. Říká-li řádek, že modul je součástí, kontrola oprávnění s tím souhlasí.',
  'pricing.compare.caption': 'Srovnání funkcí a limitů u všech tří tarifů',
  'pricing.compare.feature': 'Funkce',
  'pricing.compare.limits': 'Limity',
  'pricing.compare.included': 'Součástí',
  'pricing.compare.notIncluded': 'Není součástí',
  'pricing.compare.includedIn': 'Součástí tarifu {plan}',
  'pricing.compare.notIn': 'Není v tarifu {plan}',
  'pricing.questions.eyebrow': 'Než se zeptáte',
  'pricing.questions.title': 'Otázky, zodpovězené',
  'pricing.questions.lede':
    'Fakturace, zkušební období a jak si vzít svá data zpět.',
  'pricing.cta.secondary': 'Podívejte se, jak to funguje',
  'pricing.module.itinerary': 'Denní plán',
  'pricing.module.map': 'Interaktivní mapa',
  'pricing.module.budget': 'Rozpočty a dělení výdajů',
  'pricing.module.packing': 'Seznamy k sbalení a úkolů',
  'pricing.module.reservations': 'Rezervace',
  'pricing.module.journal': 'Cestovní dennik',
  'pricing.module.atlas': 'Mapa navštívených zemí',
  'pricing.module.collaboration': 'Pozvat další cestující',
  'pricing.module.realtime': 'Spolupráce v reálném čase',
  'pricing.module.offlineMaps': 'Offline mapy',
  'pricing.module.pdfExport': 'Export do PDF a kalendáře',
  'pricing.module.prioritySupport': 'Prioritní podpora',

  'anchor.plans': 'Tarify',
  'anchor.compare': 'Srovnání',
  'anchor.questions': 'Dotazy',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Jedno místo pro itinerář, mapu, rezervace, peníze a seznam věcí na cestu — sdílené se všemi, kdo jedou.',
  'footer.attribution':
    'Běží na Cloudflare Workers. Mapová data © přispěvatelé OpenStreetMap. Prodej a fakturaci zajišťuje Polar, náš merchant of record.',
  'footer.column.product': 'Produkt',
  'footer.column.account': 'Účet',
  'footer.link.overview': 'Přehled',
  'footer.link.everyModule': 'Všechny moduly',
  'footer.link.dayPlanner': 'Plánovač dne',
  'footer.link.sharedCosts': 'Společné náklady',
  'footer.link.reservations': 'Rezervace',
  'footer.link.atlasJournal': 'Atlas a deník',
  'footer.link.createAccount': 'Vytvořit účet',
  'footer.link.terms': 'Podmínky služby',
  'footer.link.privacy': 'Oznámení o soukromí',
} satisfies TranslationOf<typeof En>

export default messages
