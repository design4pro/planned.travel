/**
 * The world tracker and the map chrome, in Czech.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** `Mapa světa` for the atlas module, `cesta` for a trip,
 * `země` for a country and `seznam přání` for the bucket list — the same words
 * `cs/shell.ts` already uses, and the address is formal (vykání) throughout.
 *
 * **Plural.** `Intl.PluralRules('cs')` reports `one` · `few` · `many` ·
 * `other`: `one` is exactly 1, `few` is 2–4, `other` covers 0 and 5 up, and
 * `many` is reached only by a fraction — so every `many` branch carries the
 * genitive singular a decimal takes ("1,5 návštěvy").
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Czech uses, and the parity suite exempts them
 * structurally.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Mapa světa. Zatím nejsou označeny žádné navštívené země.',
  'screen.world.summary':
    'Mapa světa s {visited} z {total} zemí označenými jako navštívené.',
  'screen.error.title': 'Mapa světa se nenačetla',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Načítání mapy',
  'map.controls.label': 'Ovládání mapy',
  'map.controls.zoomIn': 'Přiblížit',
  'map.controls.zoomOut': 'Oddálit',
  'map.controls.north': 'Otočit na sever',
  'map.controls.locate': 'Najít moji polohu',
  'map.controls.locateFailed': 'Nepodařilo se zjistit vaši polohu.',
  'map.controls.locateFailedBody':
    'Zkontrolujte, že má tento web povolen přístup k poloze, a zkuste to znovu.',

  'map.attribution.label': 'Mapová data od',
  'map.attribution.geocoder': 'Místa vyhledána pomocí',

  'map.basemap.title': 'Podkladová mapa není k dispozici',
  'map.basemap.body':
    'Detail ulic je offline. Každé místo je ale zobrazeno na své skutečné pozici, takže vzdálenosti i shluky zůstávají přesné.',
  'map.basemap.credit': 'Obrysy pobřeží od',
  'map.basemap.retry': 'Zkusit znovu',
  'map.basemap.retrying': 'Hledání podkladové mapy',

  'map.engine.unsupported.title': 'Vykreslení mapy není k dispozici',
  'map.engine.unsupported.body':
    'Tento prohlížeč nedokáže spustit interaktivní mapu: vyžaduje WebGL2 a žádný kontext WebGL2 tu není k dispozici. Nic dalšího na této obrazovce na ní nezávisí.',
  'map.engine.stalled.title': 'Mapa se zatím nevykreslila',
  'map.engine.stalled.body':
    'V čase vyhrazeném pro start mapy se nic neobjevilo. Může se ještě sama vzpamatovat; nic dalšího na této obrazovce na ní nezávisí.',

  'map.coverage.partial.title': 'Částečný detail ulic',
  'map.coverage.partial.body': {
    one: 'Publikovaná mapová data nepokrývají {outside} místo této cesty. Je vykresleno na své skutečné pozici na našich vlastních obrysech pobřeží.',
    few: 'Publikovaná mapová data nepokrývají {outside} místa této cesty. Jsou vykreslena na svých skutečných pozicích na našich vlastních obrysech pobřeží.',
    many: 'Publikovaná mapová data nepokrývají {outside} místa této cesty. Jsou vykreslena na svých skutečných pozicích na našich vlastních obrysech pobřeží.',
    other:
      'Publikovaná mapová data nepokrývají {outside} míst této cesty. Jsou vykreslena na svých skutečných pozicích na našich vlastních obrysech pobřeží.',
  },
  'map.coverage.none.title': 'Bez detailu ulic',
  'map.coverage.none.body':
    'Ulice pro tuto oblast zatím nejsou publikovány. Obrysy pobřeží, špendlíky i trasy mezi nimi jsou skutečné — chybí jen budovy a silnice.',
  'map.coverage.dismiss': 'Skrýt poznámku o pokrytí mapy',

  'map.legend.title': 'Legenda',
  'map.legend.collapse': 'Sbalit {title}',
  'map.legend.expand': 'Rozbalit {title}',
  'map.legend.dayPin': 'Ukázkový špendlík dne',
  'map.legend.dayPinMeaning': 'Den itineráře',
  'map.legend.clusterPin': 'Ukázkový skupinový špendlík',
  'map.legend.clusterPinMeaning': 'Seskupená místa',

  'map.filter.label': 'Filtrovat místa podle kategorie',
  'map.filter.all': 'Vše',
  'map.filter.category': {
    one: '{name} · {places} místo',
    few: '{name} · {places} místa',
    many: '{name} · {places} místa',
    other: '{name} · {places} míst',
  },

  'map.pin.day': '{day}. den',
  'map.pin.cluster': {
    one: '{places} místo — přibližte mapu a oddělí se',
    few: '{places} místa — přibližte mapu a oddělí se',
    many: '{places} místa — přibližte mapu a oddělí se',
    other: '{places} míst — přibližte mapu a oddělí se',
  },

  'map.place.rating': 'Hodnocení {rating} z {max}',
  'map.place.clause.day': '{day}. den',
  'map.place.clause.rating': 'hodnocení {rating} z {max}',
  'map.place.clause.visited': 'navštíveno',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Poslední návštěva',
  'legend.recent': {
    one: 'Za poslední rok',
    few: 'Za poslední {years} roky',
    many: 'Za posledních {years} roku',
    other: 'Za posledních {years} let',
  },
  'legend.middle': 'Před {from}–{to} lety, nebo bez data',
  'legend.distant': {
    one: 'Před více než {years} rokem',
    few: 'Před více než {years} lety',
    many: 'Před více než {years} roku',
    other: 'Před více než {years} lety',
  },
  'legend.unvisited': 'Zatím nenavštíveno',
  'legend.note':
    'Odstín ukazuje jen, jak dávno to bylo — karta Země vypisuje každé datum.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Pokrytí světa',
  'panel.coverage.unit': 'z {total}',
  'panel.coverage.caption': '{share} světa · {visits}',
  'panel.progress.label': 'Na cestě ke každé zemi',
  'panel.progress.remaining': 'Zbývá {remaining}',
  'panel.toggle.hide': 'Skrýt podrobnosti mapy světa',
  'panel.toggle.show': 'Zobrazit podrobnosti mapy světa',
  'panel.tabs.label': 'Sekce mapy světa',
  'panel.tab.country': 'Země',
  'panel.tab.stats': 'Statistiky',
  'panel.tab.bucket': 'Seznam přání',
  'panel.back': 'Všechny země',
  'panel.list.label': 'Navštívené země',
  'panel.loading': 'Načítání vaší mapy světa',

  'panel.empty.blank.title': 'Vaše mapa je zatím prázdná',
  'panel.empty.blank.body':
    'Označte zemi jako navštívenou a vyplní se zde na mapě — s první a poslední návštěvou, počtem cest a vším, co jste si o ní napsali.',
  'panel.empty.pick.title': 'Vyberte zemi',
  'panel.empty.pick.body':
    'Zvolte ji na mapě, ve vyhledávání nebo v seznamu a zde se otevře její úplný záznam — první návštěva, poslední návštěva, počet a vaše poznámka.',

  'panel.stat.places': 'Vaše místa',
  'panel.stat.placesNone': 'Na cestách zatím nic nepřipnuto',
  'panel.stat.placesCaption': 'Uložené památky, ubytování a zastávky',
  'panel.stat.regions': 'Tvé regiony',
  'panel.stat.regionsNone': 'Zatím žádné označené regiony',
  'panel.stat.regionsCaption': 'Státy, provincie, prefektury',
  'panel.stat.visits': 'Tvé návštěvy',
  'panel.stat.visitsCaption': 'Každý zaznamenaný příjezd',
  'panel.stat.trips': 'Vaše cesty',
  'panel.stat.tripsCaption': 'Všechny cesty, kterých se účastníte',
  'panel.stat.cities': 'Tvá města',
  'panel.stat.citiesCaption': 'Města, kde jste přespali nebo zastavili',
  'panel.stat.days': 'Tvé dny na cestách',
  'panel.stat.daysCaption': 'Napříč všemi cestami ve vašem záznamu',
  'panel.continents.label': 'Země podle kontinentů',

  'panel.bucket.empty.title': 'Na seznamu nic není',
  'panel.bucket.empty.body':
    'Místo, kam jste se vždy chtěli podívat. Přidejte ho a odškrtněte, až tam dorazíte.',
  'panel.bucket.label': 'Seznam přání',
  'panel.bucket.progress': 'Splněno {done} z {total}',
  'panel.bucket.done': 'Splněno',
  'panel.bucket.toGo': 'Zbývá',
  'panel.bucket.target': 'do roku {year}',
  'panel.bucket.hidden': {
    one: 'Na vašem seznamu je ještě {entries} položka, která zde není zobrazena.',
    few: 'Na vašem seznamu jsou ještě {entries} položky, které zde nejsou zobrazeny.',
    many: 'Na vašem seznamu je ještě {entries} položky, které zde nejsou zobrazeny.',
    other:
      'Na vašem seznamu je ještě {entries} položek, které zde nejsou zobrazeny.',
  },
  'panel.bucket.kind.country': 'Země',
  'panel.bucket.kind.region': 'Oblast',
  'panel.bucket.kind.place': 'Místo',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afrika',
  'continent.antarctica': 'Antarktida',
  'continent.asia': 'Asie',
  'continent.europe': 'Evropa',
  'continent.northAmerica': 'Severní Amerika',
  'continent.oceania': 'Oceánie',
  'continent.southAmerica': 'Jižní Amerika',
  'continent.unknown': 'Kontinent neuveden',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Navštíveno',
  'record.firstVisit': 'První návštěva',
  'record.lastVisit': 'Poslední návštěva',
  'record.visitDates': 'Data návštěv',
  'record.notRecorded': 'Nezaznamenáno',
  'record.datesUnrecorded': 'Data nezaznamenána',
  'record.visits': {
    one: '{visits} návštěva',
    few: '{visits} návštěvy',
    many: '{visits} návštěvy',
    other: '{visits} návštěv',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'První návštěva {from}',
  'record.spanTo': 'Poslední návštěva {to}',
  'record.visitsUnit': {
    one: 'návštěva',
    few: 'návštěvy',
    many: 'návštěvy',
    other: 'návštěv',
  },
  'record.gap.days': {
    one: 's odstupem {gap} dne',
    few: 's odstupem {gap} dnů',
    many: 's odstupem {gap} dne',
    other: 's odstupem {gap} dní',
  },
  'record.gap.months': {
    one: 's odstupem {gap} měsíce',
    few: 's odstupem {gap} měsíců',
    many: 's odstupem {gap} měsíce',
    other: 's odstupem {gap} měsíců',
  },
  'record.gap.years': {
    one: 's odstupem {gap} roku',
    few: 's odstupem {gap} let',
    many: 's odstupem {gap} roku',
    other: 's odstupem {gap} let',
  },
  'record.note.empty': 'Zatím bez poznámky',
  'record.noOutline':
    'Obrysy světa, které tato mapa kreslí, jsou ořezány v měřítku 1:110m, a to slučuje toto území s jeho mateřským státem — na mapě tedy není co zarámovat. Návštěva se ale počítá.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Řazení zemí',
  'list.sort.code': 'Kód země',
  'list.sort.codeStatement': 'Seřazeno podle kódu země od A do Z.',
  'list.sort.name': 'Název země',
  'list.sort.nameStatement':
    'Seřazeno podle názvu země od A do Z, pak podle kódu.',
  'list.sort.recent': 'Nejnovější návštěva',
  'list.sort.recentStatement':
    'Seřazeno od nejnovější návštěvy, pak podle kódu země.',
  'list.sort.visits': 'Nejvíce návštěv',
  'list.sort.visitsStatement':
    'Seřazeno od největšího počtu návštěv, pak podle kódu země.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Obrysy světa je slučují s mateřským státem, na mapě tedy není co zarámovat.',
  'list.announce.selected': 'Země {name} je vybrána.',
  'list.announce.selectedUnframed': 'Země {name} je vybrána. {reason}',
  'list.empty.title': 'Na mapě zatím nejsou žádné země',
  'list.empty.body':
    'Země se zde objeví, jakmile k ní zaznamenáte návštěvu — s prvním příjezdem, tím posledním a počtem, kolikrát jste tam byli.',
  'list.loading': 'Načítání navštívených zemí',
  'list.error.title': 'Vaše země se nenačetly',
  'list.error.body':
    'Mapě světa se teď nepodařilo přečíst vaše navštívené země. Nic se neztratilo — stále jsou zaznamenány.',
  'list.error.retry': 'Zkusit znovu',
  'list.error.retrying': 'Načítání vašich zemí',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Najít zemi',
  'search.loading': 'Načítání vašich zemí',
  'search.placeholder': 'Název nebo kód země',
  'search.entry.notVisited': 'Zatím nenavštíveno',
  'search.entry.noOutline': 'bez obrysu na mapě',
  'search.entry.separator': ' · ',
  'search.cleared': 'Výběr zrušen.',
  'search.unframed':
    '{name} nemá ve světovém měřítku žádný obrys, mapa tedy nemá co zarámovat.',
  'search.unframedVisited':
    '{name} nemá ve světovém měřítku žádný obrys, mapa tedy nemá co zarámovat. Záznam země tím není dotčen.',
  'search.results.empty':
    'Ve vašem záznamu zatím nejsou žádné země. Pište a prohledáte všechny země světa.',
  'search.results.emptyPinned':
    'Země {name} je vybrána. Ve vašem záznamu zatím nejsou žádné země — pište a prohledáte všechny země světa.',
  'search.results.record': {
    one: 'Ve vašem záznamu je {countries} země.',
    few: 'Ve vašem záznamu jsou {countries} země.',
    many: 'Ve vašem záznamu je {countries} země.',
    other: 'Ve vašem záznamu je {countries} zemí.',
  },
  'search.results.capped': 'Zobrazeno prvních {shown}.',
  'search.results.pinned': 'Země {name} je vybrána a uvedena jako první.',
  'search.results.none': 'Výrazu {term} neodpovídá žádná země.',
  'search.results.matches': {
    one: 'Výrazu {term} odpovídá {countries} země.',
    few: 'Výrazu {term} odpovídají {countries} země.',
    many: 'Výrazu {term} odpovídá {countries} země.',
    other: 'Výrazu {term} odpovídá {countries} zemí.',
  },
  'search.announce.selected': 'Země {name} je vybrána.',
  'search.announce.framing':
    'Země {name} je vybrána. Mapa ji zarovnává do záběru.',
  'search.announce.unframed': 'Země {name} je vybrána. {reason}',
  'search.empty.title': 'Ve vašem záznamu zatím nic není',
  'search.empty.body':
    'Zadejte název země nebo její dvoupísmenný kód a najdete ji na mapě.',
  'search.empty.noMatchTitle': 'Výrazu „{term}“ neodpovídá žádná země',
  'search.empty.noMatchBody':
    'Zkontrolujte pravopis, nebo zkuste dvoupísmenný kód — PT najde Portugalsko. Prohledat lze všech {countries} zemí, ať jste tam byli, nebo ne.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Váš záznam',
  'actions.visit.absent.title': 'Nenavštíveno',
  'actions.visit.absent.caption': 'Návštěva bez navázané cesty.',
  'actions.visit.title': 'Navštíveno',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Není na seznamu',
  'actions.goal.absent.caption': 'Místo, kam se chystáte.',
  'actions.goal.title': 'Na seznamu přání',
  'actions.goal.waiting': 'Čeká, až na něj přijde řada.',
  'actions.goal.target': 'Cíl: rok {year}.',
  'actions.goal.achieved.title': 'Odškrtnuto ze seznamu',
  'actions.goal.achieved.caption':
    'Dorazili jste tam. Položka zůstává jako záznam.',

  'actions.button.remove': 'Odebrat',
  'actions.button.mark': 'Označit jako navštívené',
  'actions.button.add': 'Přidat na seznam',
  'actions.visit.remove.name': 'Odebrat {name} z vaší mapy světa',
  'actions.visit.remove.busy': 'Odebírání {name} z vaší mapy světa',
  'actions.visit.add.name': 'Označit jako navštívené: {name}',
  'actions.visit.add.busy': 'Označování {name} jako navštívené',
  'actions.goal.remove.name': 'Odebrat {name} z vašeho seznamu přání',
  'actions.goal.remove.busy': 'Odebírání {name} z vašeho seznamu přání',
  'actions.goal.add.name': 'Přidat na seznam: {name}',
  'actions.goal.add.busy': 'Přidávání {name} na váš seznam přání',

  'actions.hint': 'Obě akce platí okamžitě a obě lze zde vrátit zpět.',
  'actions.offline':
    'Vaše zařízení se nedokázalo spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
  'actions.toast.marked': 'Označeno jako navštívené',
  'actions.toast.markedBody': '{name} je na vaší mapě světa.',
  'actions.toast.markFailed': '{name}: označení se nezdařilo',
  'actions.toast.unmarked': 'Odebráno z vaší mapy světa',
  'actions.toast.unmarkedBody': '{name} už není označeno jako navštívené.',
  'actions.toast.unmarkFailed': '{name}: odebrání se nezdařilo',
  'actions.toast.listed': 'Přidáno na seznam přání',
  'actions.toast.listedBody': '{name} je místo, kam se chystáte.',
  'actions.toast.listFailed': '{name}: přidání se nezdařilo',
  'actions.toast.unlisted': 'Odebráno ze seznamu přání',
  'actions.toast.unlistedBody': '{name} už není na seznamu.',
  'actions.toast.unlistFailed': '{name}: odebrání se nezdařilo',
  'actions.toast.fallback':
    'Změna se nedostala na server. Zkuste to za chvíli znovu.',

  'actions.confirm.visit.title': 'Odebrat {name} z vaší mapy světa?',
  'actions.confirm.visit.body': {
    one: 'Vymazala by se {visits} zaznamenaná návštěva{dates}{note}. Vašich cest a uložených míst se to nedotkne.',
    few: 'Vymazaly by se {visits} zaznamenané návštěvy{dates}{note}. Vašich cest a uložených míst se to nedotkne.',
    many: 'Vymazaly by se {visits} zaznamenané návštěvy{dates}{note}. Vašich cest a uložených míst se to nedotkne.',
    other:
      'Vymazalo by se {visits} zaznamenaných návštěv{dates}{note}. Vašich cest a uložených míst se to nedotkne.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ' a s tím i vaše poznámka',
  'actions.confirm.goal.title': 'Odebrat {name} z vašeho seznamu přání?',
  'actions.confirm.goal.body':
    'Položka už je odškrtnutá, takže se tím smaže i záznam o tom, že jste tam dorazili. Vaší mapy světa ani cest se to nedotkne.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Cesta pracovního prostoru',
    few: 'Cesty pracovního prostoru',
    many: 'Cesty pracovního prostoru',
    other: 'Cest pracovního prostoru',
  },
  'card.visits': {
    one: 'Návštěva',
    few: 'Návštěvy',
    many: 'Návštěvy',
    other: 'Návštěv',
  },
  'card.places': {
    one: 'Místo pracovního prostoru',
    few: 'Místa pracovního prostoru',
    many: 'Místa pracovního prostoru',
    other: 'Míst pracovního prostoru',
  },
  'card.firstTrip': 'První cesta',
  'card.lastTrip': 'Poslední cesta',
  'card.firstVisit': 'První návštěva',
  'card.lastVisit': 'Poslední návštěva',
  'card.absent': 'Nezaznamenáno',
  'card.loading': 'Načítání země',
  'card.loadingNamed': 'Načítání: {name}',
  'card.error.body': 'Tyto údaje se nenačetly. Nic se neztratilo.',
  'card.error.retry': 'Zkusit znovu',
  'overlay.close': 'Zavřít {name}',
  'regions.label': 'Regiony',
  'regions.hint':
    'Přidání regionu označí také {country} jako navštívenou zemi.',
  'regions.keeps': 'Odstranění regionu neodebere {country} z tvého atlasu.',
  'regions.keeps.unvisited':
    'Tyto regiony zůstanou uložené. Označ {country} jako navštívenou zemi nebo přidej region a vrať ji na mapu.',
  'regions.empty.title': 'Zatím zde nejsou zaznamenané regiony',
  'regions.empty.body':
    'Přidej stát, provincii nebo oblast navštívenou v zemi {country}.',
  'regions.input.label': 'Přidat region v zemi {country}',
  'regions.input.placeholder': 'Například Bavorsko',
  'regions.add': 'Přidat region',
  'regions.adding': 'Přidávání: {region}',
  'regions.remove': 'Odstranit {region}',
  'regions.loading': 'Načítání tvých regionů',
  'regions.status.added': 'Přidáno: {region}',
  'regions.status.exists': '{region} už je zaznamenán',
  'regions.status.removed': 'Odstraněno: {region}',
  'regions.status.addedCountry':
    'Přidáno: {region}. Země {country} je nyní označená jako navštívená.',
  'regions.error.invalid': 'Zadej název regionu.',
  'regions.error.hidden':
    'Název obsahuje nepovolené znaky. Odstraň je a zkus to znovu.',
  'regions.error.load': 'Nepodařilo se načíst tvé regiony pro {country}.',
  'regions.error.add': 'Nepodařilo se přidat {region}. Zkus to znovu.',
  'regions.error.remove': 'Nepodařilo se odstranit {region}. Zkus to znovu.',
  'regions.error.full':
    'Máš zaznamenáno {limit} regionů. Před přidáním dalšího jeden odstraň.',
  'regions.reload': 'Znovu načíst regiony',
  'actions.confirm.visitRegions.body': {
    one: '{history}Regiony zaznamenané v zemi {country} zůstanou uložené: {count}.',
    few: '{history}Regiony zaznamenané v zemi {country} zůstanou uložené: {count}.',
    many: '{history}Regiony zaznamenané v zemi {country} zůstanou uložené: {count}.',
    other:
      '{history}Regiony zaznamenané v zemi {country} zůstanou uložené: {count}.',
  },
  'regions.error.uncertain':
    'Změnu se nepodařilo potvrdit. Načti regiony znovu a ověř, co se uložilo.',
  'regions.status.refreshFailed':
    '{result} Atlas se nepodařilo obnovit. Načti jej znovu, aby se mapa aktualizovala.',

  'panel.stat.periodLabel': 'Zobrazit údaje za',
  'panel.stat.allTime': 'Celé období',
  'panel.stat.groupAll': 'Údaje za celé období',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Údaje za rok {year}',
  'panel.stat.announceAll': 'Zobrazeny údaje za celé období.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Zobrazeny údaje za rok {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Cesty začínající v roce {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'Na cestách začínajících v roce {year}',
  'panel.stat.countries': 'Země na tvých cestách',
  'panel.stat.countriesCaption': 'Různé země na těchto cestách',
  'panel.stat.streak': 'Tvá série let',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'Cesty každý rok, od {first} do {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Cesta v roce {last}',
  'panel.stat.streakNone': 'Přidej cestu s daty a začni sérii',
} satisfies TranslationOf<typeof En>

export default messages
