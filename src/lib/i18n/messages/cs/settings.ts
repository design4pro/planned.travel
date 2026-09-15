/**
 * Everything the settings module says, in Czech.
 *
 * Authored from `../en/settings.ts` (`docs/SPEC.md` §8.9). The English file is
 * the schema; `__tests__/parity.test.ts` checks the placeholders, the plural
 * branches and that nothing English is left sitting here (§8.6).
 *
 * **Plural.** Czech `one` (1) · `few` (2–4) · `other` (0 and 5 up) · `many` for
 * fractions only.
 *
 * **Currency names are lower case**, as Czech writes them: „euro“, „britská
 * libra“, „japonský jen“. The ISO code beside them is derived in the route.
 *
 * **Plan names are words, not proper nouns** (see the English file's note on
 * `billing.plan.*`): the stable identifier is the plan *id*, which no reader
 * ever sees. `Solo` is travelling alone, so „Sólo“; `Crew` is the group, so
 * „Parta“.
 *
 * **„Tarif“, not „plán“**: Czech keeps „plán“ for a trip's itinerary, so the
 * subscription is a tariff everywhere it is named on its own.
 *
 * **Dva tvrdé pixelové rozpočty**, změřené v Chromiu na `/settings` při 1440
 * (obojí `.truncate`, takže přetečení text uřízne, ne zalomí): nápověda pod
 * každým odkazem v postranní navigaci má 196 px a spouštěč regionálního
 * `Select` 206 px. Anglický originál jde na 189 px, resp. 212 px, takže
 * doslovný delší překlad se ořízne. Proto je `nav.language.hint` „Jazyk,
 * kterým mluví celá aplikace" (184 px) a `regional.workspaceDefault` začíná
 * „Podle prostoru — " (185 px i s nejdelší hodnotou), ne rozvláčnějším
 * „Nastavení prostoru — " (211 px).
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Účet',
  'page.title': 'Nastavení',
  'page.description':
    'Všechno o vás, o vašem prostoru a o tom, jak se planned.travel chová',
  'page.error': 'Nastavení se nenačetlo',

  'nav.label': 'Sekce nastavení',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Vy a zápis dat i peněz',
  'nav.language': 'Jazyk',
  'nav.language.hint': 'Jazyk, kterým mluví celá aplikace',
  'nav.appearance': 'Vzhled',
  'nav.appearance.hint': 'Téma, animace a mapa',
  'nav.security': 'Zabezpečení',
  'nav.security.hint': 'Heslo, druhý faktor, přístupové klíče',
  'nav.notifications': 'Oznámení',
  'nav.notifications.hint': 'Doručené, e-mail a telefon',
  'nav.workspace': 'Prostor',
  'nav.workspace.hint': 'Členové a společná nastavení',
  'nav.billing': 'Platby',
  'nav.billing.hint': 'Tarif, místa a faktury',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Uložit změny',
  'error.retryBody':
    'Nic se neztratilo. Zkontrolujte připojení a zkuste to znovu.',
  'role.owner': 'Vlastník',
  'role.admin': 'Správce',
  'role.member': 'Člen',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Podle prostoru — {value}',
  'regional.currency.AUD': 'australský dolar',
  'regional.currency.CAD': 'kanadský dolar',
  'regional.currency.CHF': 'švýcarský frank',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'britská libra',
  'regional.currency.JPY': 'japonský jen',
  'regional.currency.PLN': 'polský zlotý',
  'regional.currency.SEK': 'švédská koruna',
  'regional.currency.USD': 'americký dolar',
  'regional.distance.metric': 'Kilometry',
  'regional.distance.imperial': 'Míle',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Váš profil se nenačetl',
  'profile.account.title': 'Váš účet',
  'profile.account.description':
    'Jméno a e-mail pocházejí z účtu, kterým se přihlašujete.',
  'profile.email.verified': 'E-mail ověřen',
  'profile.email.unverified': 'E-mail neověřen',
  'profile.twoFactor.on': 'Druhý faktor zapnutý',
  'profile.figure.workspace': 'Prostor',
  'profile.figure.role': 'Funkce',
  'profile.figure.joined': 'Členem od',
  'profile.figure.joinedUnknown': 'Nezaznamenáno',
  'profile.regional.title': 'Data, peníze a jednotky',
  'profile.regional.description':
    'Tohle přepisuje nastavení prostoru jen pro vás. Nechte volbu na výchozí a půjde za prostorem.',
  'profile.regional.saving': 'Ukládám vaše volby',
  'profile.regional.saved': 'Vaše volby jsou uložené',
  'profile.regional.saveFailed': 'Vaše volby se neuložily',
  'profile.language.label': 'Jazyk',
  'profile.language.hint':
    'Vybírá se na vlastní obrazovce, kde je každý jazyk napsaný svým písmem.',
  'profile.language.action': 'Změnit',
  'profile.timezone.label': 'Časové pásmo',
  'profile.timezone.hint': 'Časy odjezdů a příjezdů ukazujeme podle něj.',
  'profile.currency.label': 'Měna',
  'profile.currency.hint':
    'Nové cesty začínají v této měně; každá cesta ji může změnit.',
  'profile.dateFormat.label': 'Formát data',
  'profile.weekStart.label': 'Týden začíná',
  'profile.weekStart.hint':
    'Platí pro každý kalendář, i pro roční mřížku dovolených.',
  'profile.distance.label': 'Vzdálenost',

  /* --------------------------------------------------------------- language */
  'language.error': 'Nastavení jazyka se nenačetlo',
  'language.section.title': 'Jazyk',
  'language.section.description':
    'Každá obrazovka, každé tlačítko a každé datum se čtou v jazyce, který si tu vyberete — je jich dvacet tři a každý je napsaný svým písmem.',
  'language.label': 'Vyberte jazyk',
  'language.followWorkspace': 'Podle prostoru',
  'language.state.yours': 'Váš jazyk',
  'language.state.workspace': 'Z nastavení prostoru',
  'language.state.hint.override':
    'Vaše vlastní volba. Platí jen pro vás, na každém zařízení, ze kterého se přihlásíte.',
  'language.state.hint.workspace':
    'Nemáte vlastní jazyk, takže čtete ten, na který je nastavený prostor. Vlastník nebo správce to může změnit v sekci Prostor.',
  'language.saved': 'planned.travel teď mluví jazykem {language}',
  'language.saveFailed': 'Jazyk se nezměnil',
  'language.saveFailedBody':
    'Nic se neztratilo a dál čtete jazyk {language}. Zkontrolujte připojení a vyberte znovu.',
  'language.reload.title': 'Váš jazyk je uložený',
  'language.reload.body':
    'Této stránce se nepodařilo přepnout na {language}. Obnovte ji a produkt si přečtete ve svém novém jazyce.',
  'language.sample.title': 'Jak se budou číst data a čísla',
  'language.sample.description':
    'Tři stejné hodnoty, zapsané tak, jak je zapisuje tento jazyk.',
  'language.sample.date': 'Datum',
  'language.sample.number': 'Číslo',
  'language.sample.money': 'Částka',
  'language.legal':
    'Podmínky a zásady ochrany osobních údajů vydáváme jen v angličtině. Všechno ostatní v produktu je přeložené.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Vzhled se nenačetl',
  'appearance.theme.title': 'Téma',
  'appearance.theme.description':
    'Obě témata jsou navržená, ne převrácená. Vyberte to, které se vám čte pohodlněji.',
  'appearance.theme.light': 'Světlé',
  'appearance.theme.lightHint': 'Teplý papír, celý den',
  'appearance.theme.dark': 'Tmavé',
  'appearance.theme.darkHint': 'Teplý grafit, nikdy černá',
  'appearance.theme.system': 'Podle systému',
  'appearance.theme.systemHint': 'Podle zařízení',
  'appearance.theme.showing': 'Právě platí paleta {palette}.',
  'appearance.theme.showingSystem':
    'Právě platí paleta {palette}, podle nastavení vašeho zařízení.',
  'appearance.palette.light': 'světlá',
  'appearance.palette.dark': 'tmavá',
  'appearance.motion.title': 'Animace a mapy',
  'appearance.motion.label': 'Omezit animace',
  'appearance.motion.hint':
    'Sbalí nástupní animace na jednoduché prolnutí. Nastavení omezení pohybu ve vašem systému respektujeme vždy.',
  'appearance.map.label': 'Styl mapy',
  'appearance.map.hint': 'Podkladová mapa v plánovači a na mapě světa.',
  'appearance.map.workspace': 'Podle prostoru',
  'appearance.map.workspaceHint': 'To, co zvolil vlastník prostoru.',
  'appearance.map.auto': 'Automatický',
  'appearance.map.autoHint': 'Řídí se vaším světlým nebo tmavým motivem.',
  'appearance.map.paper': 'Papír',
  'appearance.map.paperHint': 'Teplá a světlá v každém motivu.',
  'appearance.map.charcoal': 'Grafit',
  'appearance.map.charcoalHint': 'Teplá a tmavá v každém motivu.',
  'appearance.map.quiet': 'Tichý',
  'appearance.map.quietHint': 'Bez názvů ulic, aby vaše špendlíky vynikly.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Na sdílené obrazovce',
  'appearance.privacy.codesLabel':
    'Skrývat potvrzovací kódy, dokud si je nevyžádám',
  'appearance.privacy.codesHint':
    'Rezervační reference a potvrzovací čísla zůstanou v přehledu rezervací i u dopravy zakrytá, dokud na ně nenajedete, nepřepnete na ně fokus nebo na ně neklepnete. Ceny se neskrývají nikdy.',
  'appearance.saveFailed': 'Tato změna se neuložila',
  'appearance.saveFailedBody':
    'Tady se projevila, ale další zařízení, ze kterého se přihlásíte, ji mít nebude.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Zabezpečení se nenačetlo',
  'security.unverified.title': 'Vaše e-mailová adresa ještě není ověřená',
  'security.unverified.body':
    'Obnovy hesla a pozvánky na cesty chodí na {email}. Ověření je to, co dokazuje, že adresa je vaše.',
  'security.unverified.action': 'Poslat odkaz znovu',
  'security.signin.title': 'Přihlašování',
  'security.signin.description':
    'Čím dokazujete, že jste to vy. Druhý faktor i přístupové klíče jsou silnější než samotné heslo.',
  'security.email.label': 'E-mailová adresa',
  'security.email.verified': 'Ověřená',
  'security.email.unverified': 'Neověřená',
  'security.password.label': 'Heslo',
  'security.password.hint':
    'Změňte ho, kdykoli chcete — pošleme vám jednorázový odkaz, nebudeme se ptát na to staré.',
  'security.password.action': 'Změnit heslo',
  'security.twoFactor.label': 'Dvoufázové ověření',
  'security.twoFactor.onHint':
    'Při každém novém přihlášení je potřeba kód z autentizační aplikace.',
  'security.twoFactor.offHint':
    'Přidejte k heslu šestimístný kód z autentizační aplikace.',
  'security.twoFactor.on': 'Zap.',
  'security.twoFactor.off': 'Vyp.',
  'security.twoFactor.manage': 'Spravovat',
  'security.twoFactor.enable': 'Zapnout',
  'security.passkeys.label': 'Přístupové klíče',
  'security.passkeys.hint':
    'Přihlašujte se čtečkou prstu, Face ID nebo bezpečnostním klíčem, bez psaní.',
  'security.passkeys.action': 'Spravovat klíče',
  'security.session.title': 'Toto sezení',
  'security.session.description': 'Prohlížeč, ve kterém tohle čtete.',
  'security.session.label': 'Přihlášeno jako',
  'security.session.expires': 'Platí do {date}',
  'security.session.expiresSoon': 'brzy',
  'security.session.noExpiry': 'Bez zaznamenané platnosti',
  'security.signOut.label': 'Odhlásit se',
  'security.signOut.hint':
    'Ukončí toto sezení a vrátí vás na přihlašovací stránku. Ostatní zařízení zůstanou přihlášená.',
  'security.signOut.pending': 'Odhlašování',
  'security.signOut.failed': 'Odhlášení se nepovedlo',
  'security.signOut.failedBody': 'Zkontrolujte připojení a zkuste to znovu.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Nastavení oznámení se nenačetlo',
  'notifications.title': 'Oznámení',
  'notifications.description':
    'Každý přepínač platí jen pro vás. Vypnutím se událost nezastaví — zastaví se jen naše zpráva o ní.',
  'notifications.caption': 'Která oznámení chodí do kterého kanálu',
  'notifications.event': 'Událost',
  'notifications.switch': '{event} – {channel}',
  'notifications.saveFailed': 'Tato volba se neuložila',
  'notifications.saveFailedBody':
    'Přepínač jsme vrátili zpátky. Zkontrolujte připojení a zkuste to znovu.',
  'notifications.channel.in_app': 'V aplikaci',
  'notifications.channel.in_app.hint': 'Zvonek v horní liště',
  'notifications.channel.email': 'E-mail',
  'notifications.channel.email.hint': 'Na adresu, kterou se přihlašujete',
  'notifications.channel.push': 'Do telefonu',
  'notifications.channel.push.hint': 'Na zařízeních, kde to povolíte',
  'notifications.event.trip.invited': 'Pozvánky na cesty',
  'notifications.event.trip.invited.hint':
    'Někdo vás přidá k cestě, kterou plánuje.',
  'notifications.event.trip.updated': 'Změny v plánu',
  'notifications.event.trip.updated.hint':
    'Na cestě, kde jste, se posune den, zastávka nebo termín.',
  'notifications.event.trip.starting_soon': 'Upomínky před odjezdem',
  'notifications.event.trip.starting_soon.hint':
    'Malé pošťouchnutí ve dnech před začátkem cesty.',
  'notifications.event.reservation.reminder': 'Upomínky k rezervacím',
  'notifications.event.reservation.reminder.hint':
    'Blíží se nocleh, stůl nebo vstupenka.',
  'notifications.event.expense.added': 'Nové výdaje',
  'notifications.event.expense.added.hint':
    'Někdo zapíše peníze utracené na společné cestě.',
  'notifications.event.expense.settled': 'Vyrovnané zůstatky',
  'notifications.event.expense.settled.hint':
    'Zůstatek, kterého jste se týkali, je zaplacený.',
  'notifications.event.list.assigned': 'Přidělené úkoly',
  'notifications.event.list.assigned.hint':
    'Něco ze seznamu věcí nebo úkolů se stane vaším.',
  'notifications.event.collab.message': 'Hovor o cestě',
  'notifications.event.collab.message.hint':
    'Nové zprávy u cesty, na kterou jedete.',
  'notifications.event.organization.invited': 'Pozvánky do prostoru',
  'notifications.event.organization.invited.hint':
    'Někdo vás zve do pracovního prostoru.',

  'notifications.event.billing.plan_changed': 'Změny předplatného',
  'notifications.event.billing.plan_changed.hint':
    'Váš prostor přechází na jiný tarif.',
  'notifications.event.billing.invoice_paid': 'Potvrzení plateb',
  'notifications.event.billing.invoice_paid.hint':
    'Faktura vašeho prostoru byla zaplacena.',
  'notifications.event.billing.payment_failed': 'Problémy s platbou',
  'notifications.event.billing.payment_failed.hint':
    'Platba za váš prostor neproběhla.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Prostor se nenačetl',
  'workspace.summary.description': 'Tarif {plan} · vytvořeno {date}',
  'workspace.summary.createdRecently': 'nedávno',
  'workspace.summary.billingAction': 'Tarif a platby',
  'workspace.seats.label': 'Obsazená místa',
  'workspace.seats.value': '{used} z {limit}',
  'workspace.seats.note':
    'Otevřené pozvánky zabírají místa, takže prostor nikdy nepřeroste tarif, který platí.',
  'workspace.seatsFull.title': 'Všechna místa v tomto tarifu jsou obsazená',
  'workspace.seatsFull.body':
    '{members} a {invitations} zaplní limit {limit} míst.',
  'workspace.seatsFull.action': 'Přidat místa',
  'workspace.members.count': {
    one: '{value} člen',
    few: '{value} členové',
    many: '{value} člena',
    other: '{value} členů',
  },
  'workspace.invitations.count': {
    one: '{value} čekající pozvánka',
    few: '{value} čekající pozvánky',
    many: '{value} čekající pozvánky',
    other: '{value} čekajících pozvánek',
  },
  'workspace.members.title': 'Členové',
  'workspace.members.description':
    'Všichni, kdo v tomto prostoru vidí cesty, peníze a soubory.',
  'workspace.members.tableLabel': 'Členové tohoto prostoru',
  'workspace.members.person': 'Osoba',
  'workspace.members.role': 'Funkce',
  'workspace.members.joined': 'Členem od',
  'workspace.invitations.title': 'Pozvánky',
  'workspace.invitations.description':
    'Lidé, kteří dostali pozvánku, ale ještě nevstoupili.',
  'workspace.invitations.emptyTitle': 'Žádné otevřené pozvánky',
  'workspace.invitations.emptyBody':
    'Všichni pozvaní do tohoto prostoru už vstoupili.',
  'workspace.invitations.expires': 'Platí do {date}',
  'workspace.invitations.expiresSoon': 'brzy',
  'workspace.defaults.title': 'Společná nastavení',
  'workspace.defaults.description':
    'S čím začíná nová cesta a nový člověk. Každý si to může ve svém profilu přepsat pro sebe.',
  'workspace.defaults.readOnly': 'Jen ke čtení',
  'workspace.defaults.saving': 'Ukládám nastavení prostoru',
  'workspace.defaults.saved': 'Nastavení prostoru je uložené',
  'workspace.defaults.saveFailed': 'Nastavení prostoru se neuložilo',
  'workspace.defaults.saveFailedBody':
    'Měnit je smí jen vlastník nebo správce. Zkontrolujte připojení a zkuste to znovu.',
  'workspace.currency.label': 'Výchozí měna',
  'workspace.currency.hint': 'V ní se rozpočtují nové cesty.',
  'workspace.language.label': 'Jazyk',
  'workspace.language.hint': 'Co čte člověk, který si vlastní jazyk nevybral.',
  'workspace.timezone.label': 'Časové pásmo',
  'workspace.dateFormat.label': 'Formát data',
  'workspace.weekStart.label': 'Týden začíná',
  'workspace.distance.label': 'Vzdálenost',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Platby se nenačetly',
  'billing.loading': 'Načítám tarif a doklady',
  'billing.status.none': 'Bez předplatného',
  'billing.status.trialing': 'Zkušební doba',
  'billing.status.active': 'Aktivní',
  'billing.status.past_due': 'Platba neprošla',
  'billing.status.unpaid': 'Nezaplaceno',
  'billing.status.paused': 'Pozastaveno',
  'billing.status.canceled': 'Zrušeno',
  'billing.status.incomplete': 'Nedokončeno',
  'billing.status.incomplete_expired': 'Vypršelo',

  'billing.checkout.completeTitle': 'Platba přijata',
  'billing.checkout.completeBody':
    'Nový tarif se právě nasazuje. Objeví se tady v okamžiku, kdy ho Polar potvrdí — obvykle za pár sekund.',
  'billing.checkout.cancelledTitle': 'Platba přerušena',
  'billing.checkout.cancelledBody':
    'Nic jsme neúčtovali a váš tarif se nezměnil.',
  'billing.portal.backTitle': 'Zpátky ze Polar',
  'billing.portal.backBody':
    'Cokoli jste tam změnili, se tady objeví, jak to Polar potvrdí.',
  'billing.refresh': 'Obnovit',
  'billing.readOnly.title': 'Jste členem tohoto prostoru',
  'billing.readOnly.body':
    'Předplatné může měnit jen vlastník nebo správce. Všechno níže je pro vás jen ke čtení.',

  'billing.hero.label': 'Aktuální tarif',
  'billing.hero.endsAtPeriod': 'Končí s koncem období',
  'billing.hero.perYear': '/ rok',
  'billing.hero.perMonth': '/ měsíc',
  'billing.hero.freeAllowance': '{trips} cesty, jeden cestující',
  'billing.hero.perSeatLine': '{seats} × {price}',
  'billing.hero.singleTraveller': 'Jeden cestující',
  'billing.price.free': 'Bez platby',
  'billing.provider.opening': 'Otevírám Polar',
  'billing.renewal.trialEndsToday':
    'Zkušební období končí dnes. První platba pak proběhne, pokud ji předtím nezrušíte.',
  'billing.renewal.trialEndsIn': {
    one: 'Zkušební období končí za {value} den a pak proběhne první platba, pokud ji předtím nezrušíte.',
    few: 'Zkušební období končí za {value} dny a pak proběhne první platba, pokud ji předtím nezrušíte.',
    many: 'Zkušební období končí za {value} dne a pak proběhne první platba, pokud ji předtím nezrušíte.',
    other:
      'Zkušební období končí za {value} dní a pak proběhne první platba, pokud ji předtím nezrušíte.',
  },
  'billing.renewal.trialEnded': 'Zkušební doba skončila.',
  'billing.renewal.endsNoDate': 'Tento tarif má skončit a už se neobnoví.',
  'billing.renewal.endsOn':
    'Tento tarif končí {date}. Nic se nesmaže — placené moduly se jen zamknou.',
  'billing.renewal.pastDue':
    'Poslední platba neprošla. Aktualizujte kartu, ať placené moduly nepřijdete.',
  'billing.renewal.unpaid':
    'Toto předplatné je nezaplacené a placené moduly jsou zamčené.',
  'billing.renewal.paused':
    'Toto předplatné je pozastavené. Obnovte ho, až budete zase na cestách.',
  'billing.renewal.lapsed':
    'Vyberte níže tarif a znovu odemknete rezervace, deník i offline mapy.',
  'billing.renewal.incomplete': 'Polar stále čeká, až se tato platba potvrdí.',
  'billing.renewal.free':
    'Dvě cesty naráz, na náš účet. Vyšší tarif si vezmete, až vám to přestane stačit.',
  'billing.renewal.auto': 'Obnovuje se automaticky.',
  'billing.renewal.renewsOn': 'Obnoví se {date}.',

  'billing.usage.title': 'Spotřeba',
  'billing.usage.description':
    'Počítá se naživo, takže ukazatel nikdy není starý. Limity jdou za tarifem, který platí právě teď.',
  'billing.quota.seats': 'Členové',
  'billing.quota.trips': 'Cesty',
  'billing.quota.storageBytes': 'Úložiště',
  'billing.quota.unlimited': 'Bez limitu',
  'billing.quota.noLimit': 'V tomto tarifu bez limitu',
  'billing.quota.used': 'Využito: {quota}',
  'billing.quota.over.seats': {
    one: '{value} místo nad limit tohoto tarifu',
    few: '{value} místa nad limit tohoto tarifu',
    many: '{value} místa nad limit tohoto tarifu',
    other: '{value} míst nad limit tohoto tarifu',
  },
  'billing.quota.over.trips': {
    one: '{value} místo na cestu nad limit tohoto tarifu',
    few: '{value} místa na cesty nad limit tohoto tarifu',
    many: '{value} místa na cesty nad limit tohoto tarifu',
    other: '{value} míst na cesty nad limit tohoto tarifu',
  },
  'billing.quota.over.storage': '{value} nad limit tohoto tarifu',
  'billing.quota.exhausted.seats': 'Všechna místa v tomto tarifu jsou obsazená',
  'billing.quota.exhausted.trips':
    'Všechna místa na cesty v tomto tarifu jsou využitá',
  'billing.quota.exhausted.storage': 'Úložiště v tomto tarifu je plné',
  'billing.quota.left': 'Zbývá {value}',

  'billing.plans.title': 'Tarify',
  'billing.plans.description':
    'Tarif změníte, kdykoli chcete. Vyšší doúčtujeme po dnech, nižší počká na konec zaplaceného období.',
  'billing.interval.label': 'Fakturační období',
  'billing.interval.monthly': 'Měsíčně',
  'billing.interval.yearly': 'Ročně',
  'billing.plan.free.name': 'Zdarma',
  'billing.plan.free.tagline': 'Naplánujte si dvě nejbližší cesty',
  'billing.plan.free.feature.trips': 'Dvě cesty naráz',
  'billing.plan.free.feature.itinerary': 'Itinerář den po dni a mapa',
  'billing.plan.free.feature.lists': 'Seznamy věcí a jednoduché rozpočty',
  'billing.plan.free.feature.atlas':
    'Mapa světa, která si pamatuje navštívené země',
  'billing.plan.solo.name': 'Sólo',
  'billing.plan.solo.tagline': 'Pro cestovatele, který plánuje všechno',
  'billing.plan.solo.feature.trips': 'Cesty bez limitu',
  'billing.plan.solo.feature.modules':
    'Každý plánovací modul — rezervace, deník, rozpočty, balení',
  'billing.plan.solo.feature.offline':
    'Offline mapy stažené ještě před odletem',
  'billing.plan.solo.feature.export': 'Export do PDF a do kalendáře',
  'billing.plan.crew.name': 'Parta',
  'billing.plan.crew.tagline': 'Pro rodiny, přátele a malé týmy',
  'billing.plan.crew.feature.members': 'Až deset lidí, účtováno po osobách',
  'billing.plan.crew.feature.realtime':
    'Spolupráce naživo s viditelnými kurzory',
  'billing.plan.crew.feature.everything': 'Cesty bez limitu a všechny moduly',
  'billing.plan.crew.feature.storage':
    'Společné místo na fotky a dokumenty celé skupiny',

  'billing.plan.current': 'Aktuální tarif',
  'billing.plan.currentBadge': 'Nynější',
  'billing.plan.popular': 'Oblíbený',
  'billing.plan.switchYearly': 'Platit ročně',
  'billing.plan.switchMonthly': 'Platit měsíčně',
  'billing.plan.upgradeTo': 'Povýšit na {plan}',
  'billing.plan.changeTo': 'Změnit na {plan}',
  'billing.plan.perMemberMonth': '/ osoba / měsíc',
  'billing.plan.perMonth': '/ měsíc',
  'billing.plan.alwaysFree': 'Vždycky zdarma, bez karty',
  'billing.plan.billedYearly': '{amount} účtováno ročně',
  'billing.plan.billedMonthly': '{amount} účtováno měsíčně',
  'billing.plan.members': 'Členové',
  'billing.plan.membersHint': 'Měňte kdykoli — platba jde za tím.',
  'billing.plan.seatOption': {
    one: '{value} člen',
    few: '{value} členové',
    many: '{value} člena',
    other: '{value} členů',
  },

  'billing.invoices.number': 'Faktura',
  'billing.invoices.date': 'Datum',
  'billing.invoices.amount': 'Částka',
  'billing.invoices.status': 'Stav',
  'billing.invoice.paid': 'Zaplaceno',
  'billing.invoice.draft': 'Koncept',
  'billing.invoice.void': 'Neplatná',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Poskytovatel platby žádost odmítl. Zkuste to za chvíli znovu.',
  'billing.planChanged.title': 'Tarif aktualizován',
  'billing.planChanged.body':
    'Změna už u Polaru platí a rozdíl vyfakturuje. Přehled níže se doplní do minuty.',
  'billing.hero.manage': 'Správa fakturace',
  'billing.hero.manageHint':
    'Karty, fakturační adresa, DIČ, potvrzení a zrušení jsou u Polaru, který vystavuje fakturu.',
  'billing.hero.manageHintNone':
    'Fakturační profil zatím není. Volbou placeného tarifu níže vznikne a portál se od té doby otevře.',
  'billing.portal.opening': 'Otevírá se fakturační portál',
  'billing.plan.notApplied': 'Tato změna nebyla provedena',
  'billing.plan.cancelInPortal': 'Zrušit v portálu',
  'billing.plan.seatsOverMax': {
    one: 'Tento prostor má {members} členů a {plan} účtuje nejvýše {max}. Před přechodem odeberte {value} člena.',
    few: 'Tento prostor má {members} členů a {plan} účtuje nejvýše {max}. Před přechodem odeberte {value} členy.',
    many: 'Tento prostor má {members} členů a {plan} účtuje nejvýše {max}. Před přechodem odeberte {value} člena.',
    other:
      'Tento prostor má {members} členů a {plan} účtuje nejvýše {max}. Před přechodem odeberte {value} členů.',
  },
  'billing.plan.seatsBelowMembers':
    'Máte {members} členů. Zvolte alespoň tolik míst — Polar odmítne předplatné s méně místy než přiřazeními.',
  'billing.orders.title': 'Objednávky',
  'billing.orders.description':
    'Každá objednávka tohoto prostoru, od nejnovější.',
  'billing.orders.receipts': 'Všechna potvrzení',
  'billing.orders.unavailableTitle': 'Objednávky se nenačítají',
  'billing.orders.unavailableBody':
    'Polar neodpověděl na historii včas. Vše výše je aktuální — zkuste to za chvíli nebo si přečtěte celý záznam ve fakturačním portálu.',
  'billing.orders.emptyTitle': 'Zatím žádné objednávky',
  'billing.orders.emptyCustomer':
    'První faktura se tu objeví, jakmile se uzavře fakturační období.',
  'billing.orders.emptyNoCustomer':
    'Tomuto prostoru nebylo nikdy nic účtováno. Zvolte placený tarif a faktury se tu začnou sbírat.',
  'billing.orders.tableLabel': 'Historie objednávek',
  'billing.orders.document': 'Dokument',
  'billing.orders.dateUnknown': 'Datum neznámé',
  'billing.order.pending': 'Probíhá',
  'billing.order.refunded': 'Vráceno',
  'billing.order.partiallyRefunded': 'Částečně vráceno',
  'billing.order.noInvoiceDraft': 'Dokud je objednávka koncept, faktura není',
  'billing.order.preparing': 'Připravuje se',
  'billing.order.renderingHint':
    'Polar fakturu {number} stále vytváří. Stahování se za pár sekund vrátí.',
  'billing.order.fetching': 'Načítá se faktura',
  'billing.order.generating': 'Polar připravuje fakturu',
  'billing.order.pdfLabel': 'Faktura {number} v PDF',
  'billing.order.stillWritingTitle': 'Polar tu fakturu stále píše',
  'billing.order.stillWritingBody':
    'Faktura {number} se vytváří. Stahování se samo za pár sekund vrátí.',
  'billing.order.openFailed': 'Tuto fakturu nešlo otevřít',
} satisfies TranslationOf<typeof En>

export default messages
