/**
 * Everything the settings module says, in Swedish.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Two senses of one English word.** `plan` is "abonnemang" when it is
 * something a workspace pays for and "dagsplan" when it is the itinerary; the
 * settings module only ever means the first. `Workspace` is "arbetsyta",
 * `seat` is "plats", `quota` is "kvot".
 *
 * **The three plan names are words, not proper nouns.** English calls them
 * Free, Solo and Crew; Swedish reads "Gratis", "Enskild" and "Grupp". What is
 * stable across languages is the plan *id* in `src/lib/plans.ts`, which the
 * invoice and Polar carry and no reader ever sees.
 *
 * **Two things Swedish must not borrow from English.** Currency names are lower
 * case, and "mile" is not "mil": a Swedish mil is ten kilometres, so the
 * imperial unit has to say "engelska mil" or the distance setting means the
 * opposite of what it says.
 *
 * **Plural.** `Intl.PluralRules('sv')` reports `one` and `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Konto',
  'page.title': 'Inställningar',
  'page.description':
    'Allt om dig, din arbetsyta och hur planned.travel beter sig',
  'page.error': 'Inställningarna lästes inte in',

  'nav.label': 'Avsnitt i inställningarna',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Du, och hur datum och belopp läses',
  'nav.language': 'Språk',
  'nav.language.hint': 'Språket som varje skärm talar',
  'nav.appearance': 'Utseende',
  'nav.appearance.hint': 'Tema, rörelse och kartan',
  'nav.security': 'Säkerhet',
  'nav.security.hint': 'Lösenord, tvåstegskoder, nycklar',
  'nav.notifications': 'Aviseringar',
  'nav.notifications.hint': 'Inkorg, mejl och telefon',
  'nav.workspace': 'Arbetsyta',
  'nav.workspace.hint': 'Medlemmar och förval',
  'nav.billing': 'Fakturering',
  'nav.billing.hint': 'Abonnemang, platser och fakturor',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Spara ändringarna',
  'error.retryBody':
    'Ingenting gick förlorat. Kontrollera din uppkoppling och försök igen.',
  'role.owner': 'Ägare',
  'role.admin': 'Administratör',
  'role.member': 'Medlem',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Arbetsytans förval — {value}',
  'regional.currency.AUD': 'australisk dollar',
  'regional.currency.CAD': 'kanadensisk dollar',
  'regional.currency.CHF': 'schweizisk franc',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'brittiskt pund',
  'regional.currency.JPY': 'japansk yen',
  'regional.currency.PLN': 'polsk zloty',
  'regional.currency.SEK': 'svensk krona',
  'regional.currency.USD': 'amerikansk dollar',
  'regional.distance.metric': 'Kilometer',
  'regional.distance.imperial': 'Engelska mil',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Din profil lästes inte in',
  'profile.account.title': 'Ditt konto',
  'profile.account.description':
    'Namn och mejladress kommer från kontot du loggar in med.',
  'profile.email.verified': 'Mejladressen är bekräftad',
  'profile.email.unverified': 'Mejladressen är inte bekräftad',
  'profile.twoFactor.on': 'Tvåstegsverifiering på',
  'profile.figure.workspace': 'Arbetsyta',
  'profile.figure.role': 'Roll',
  'profile.figure.joined': 'Medlem sedan',
  'profile.figure.joinedUnknown': 'Inte noterat',
  'profile.regional.title': 'Datum, pengar och enheter',
  'profile.regional.description':
    'De här går före arbetsytans förval, men bara för dig. Det som står kvar på förvalet följer arbetsytan.',
  'profile.regional.saving': 'Dina inställningar sparas',
  'profile.regional.saved': 'Dina inställningar är sparade',
  'profile.regional.saveFailed': 'Dina inställningar sparades inte',
  'profile.language.label': 'Språk',
  'profile.language.hint':
    'Väljs på en egen skärm, där varje språk står i sin egen skrift.',
  'profile.language.action': 'Ändra',
  'profile.timezone.label': 'Tidszon',
  'profile.timezone.hint': 'Avgångs- och ankomsttider mäts mot den.',
  'profile.currency.label': 'Valuta',
  'profile.currency.hint':
    'Nya resor börjar i den här valutan; varje resa får avvika.',
  'profile.dateFormat.label': 'Datumformat',
  'profile.weekStart.label': 'Veckan börjar på',
  'profile.weekStart.hint':
    'Gäller varje kalender, även årsrutan för semestern.',
  'profile.distance.label': 'Avstånd',

  /* --------------------------------------------------------------- language */
  'language.error': 'Dina språkinställningar lästes inte in',
  'language.section.title': 'Språk',
  'language.section.description':
    'Varje skärm, varje knapp och varje datum läses på det språk du väljer här — tjugotre stycken, vart och ett i sin egen skrift.',
  'language.label': 'Välj ett språk',
  'language.followWorkspace': 'Följ arbetsytan',
  'language.state.yours': 'Ditt språk',
  'language.state.workspace': 'Bestäms av arbetsytan',
  'language.state.hint.override':
    'Ditt eget val. Det gäller bara dig, på varje enhet du loggar in från.',
  'language.state.hint.workspace':
    'Du har inte valt något eget språk, så du läser det arbetsytan står på. En ägare eller administratör ändrar det under Arbetsyta.',
  'language.saved': 'planned.travel talar nu {language}',
  'language.saveFailed': 'Ditt språk ändrades inte',
  'language.saveFailedBody':
    'Ingenting gick förlorat och du läser fortfarande {language}. Kontrollera din uppkoppling och välj sedan igen.',
  'language.reload.title': 'Ditt språk är sparat',
  'language.reload.body':
    'Den här sidan hann inte byta till {language}. Ladda om den för att läsa produkten på ditt nya språk.',
  'language.sample.title': 'Så kommer datum och tal att läsas',
  'language.sample.description':
    'Samma tre värden, skrivna som det här språket skriver dem.',
  'language.sample.date': 'Ett datum',
  'language.sample.number': 'Ett tal',
  'language.sample.money': 'Ett belopp',
  'language.legal':
    'Villkoren och integritetspolicyn finns bara på engelska. Allt annat i produkten är översatt.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Utseendet lästes inte in',
  'appearance.theme.title': 'Tema',
  'appearance.theme.description':
    'Båda temana är formgivna, inte omvända. Ta det du läser bekvämast i.',
  'appearance.theme.light': 'Ljust',
  'appearance.theme.lightHint': 'Varmt papper, hela dagen',
  'appearance.theme.dark': 'Mörkt',
  'appearance.theme.darkHint': 'Varmt kol, aldrig svart',
  'appearance.theme.system': 'Automatiskt',
  'appearance.theme.systemHint': 'Följ enheten',
  'appearance.theme.showing': 'Just nu visas den {palette} paletten.',
  'appearance.theme.showingSystem':
    'Just nu visas den {palette} paletten, efter din enhet.',
  'appearance.palette.light': 'ljusa',
  'appearance.palette.dark': 'mörka',
  'appearance.motion.title': 'Rörelse och kartor',
  'appearance.motion.label': 'Dämpa rörelse',
  'appearance.motion.hint':
    'Kortar ned inledande animationer till en enkel toning. Ditt operativsystems egen inställning följs alltid ändå.',
  'appearance.map.label': 'Kartstil',
  'appearance.map.hint': 'Bakgrundskartan i planeraren och på världskartan.',
  'appearance.map.workspace': 'Följ arbetsytan',
  'appearance.map.workspaceHint': 'Det som arbetsytans ägare har valt.',
  'appearance.map.auto': 'Automatisk',
  'appearance.map.autoHint': 'Följer ditt ljusa eller mörka tema.',
  'appearance.map.paper': 'Papper',
  'appearance.map.paperHint': 'Varm och ljus, oavsett tema.',
  'appearance.map.charcoal': 'Kol',
  'appearance.map.charcoalHint': 'Varm och mörk, oavsett tema.',
  'appearance.map.quiet': 'Lugn',
  'appearance.map.quietHint': 'Utan gatunamn, så syns dina nålar först.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'På en delad skärm',
  'appearance.privacy.codesLabel': 'Dölj bekräftelsekoder tills jag ber om dem',
  'appearance.privacy.codesHint':
    'Bokningsreferenser och bekräftelsenummer förblir dolda i bokningsvyn och bland transporterna tills du för pekaren över dem, fokuserar dem eller trycker på dem. Priser döljs aldrig.',
  'appearance.saveFailed': 'Den ändringen sparades inte',
  'appearance.saveFailedBody':
    'Här syns den, men inte på nästa enhet du loggar in från.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Säkerheten lästes inte in',
  'security.unverified.title': 'Din mejladress är inte bekräftad än',
  'security.unverified.body':
    'Nya lösenord och reseinbjudningar går till {email}. Bekräftelsen är beviset på att adressen är din.',
  'security.unverified.action': 'Skicka länken igen',
  'security.signin.title': 'Inloggning',
  'security.signin.description':
    'Hur du visar att det är du. Tvåstegsverifiering och lösenordsnycklar är båda starkare än ett lösenord ensamt.',
  'security.email.label': 'Mejladress',
  'security.email.verified': 'Bekräftad',
  'security.email.unverified': 'Obekräftad',
  'security.password.label': 'Lösenord',
  'security.password.hint':
    'Byt det när du vill — du får en engångslänk i stället för en fråga om det gamla.',
  'security.password.action': 'Byt lösenord',
  'security.twoFactor.label': 'Tvåstegsverifiering',
  'security.twoFactor.onHint':
    'Vid varje ny inloggning krävs en kod från din autentiseringsapp.',
  'security.twoFactor.offHint':
    'Lägg en sexsiffrig kod från en autentiseringsapp ovanpå lösenordet.',
  'security.twoFactor.on': 'På',
  'security.twoFactor.off': 'Av',
  'security.twoFactor.manage': 'Hantera',
  'security.twoFactor.enable': 'Slå på',
  'security.passkeys.label': 'Lösenordsnycklar',
  'security.passkeys.hint':
    'Logga in med fingeravtryck, ansiktslås eller en säkerhetsnyckel i stället för att skriva något.',
  'security.passkeys.action': 'Hantera lösenordsnycklar',
  'security.session.title': 'Den här sessionen',
  'security.session.description': 'Webbläsaren du läser det här i.',
  'security.session.label': 'Inloggad som',
  'security.session.expires': 'Går ut {date}',
  'security.session.expiresSoon': 'snart',
  'security.session.noExpiry': 'Ingen sluttid noterad',
  'security.signOut.label': 'Logga ut',
  'security.signOut.hint':
    'Avslutar den här sessionen och tar dig till inloggningen. Andra enheter förblir inloggade.',
  'security.signOut.pending': 'Du loggas ut',
  'security.signOut.failed': 'Du loggades inte ut',
  'security.signOut.failedBody': 'Kontrollera din uppkoppling och försök igen.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Inställningarna för aviseringar lästes inte in',
  'notifications.title': 'Aviseringar',
  'notifications.description':
    'Varje reglage gäller bara dig. Att slå av ett stoppar aldrig själva händelsen — bara att vi berättar om den.',
  'notifications.caption': 'Vilka aviseringar som når vilken kanal',
  'notifications.event': 'Händelse',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Den inställningen sparades inte',
  'notifications.saveFailedBody':
    'Reglaget står som förut igen. Kontrollera din uppkoppling och försök igen.',
  'notifications.channel.in_app': 'I appen',
  'notifications.channel.in_app.hint': 'Klockan i överkanten',
  'notifications.channel.email': 'E-post',
  'notifications.channel.email.hint': 'Till adressen du loggar in med',
  'notifications.channel.push': 'Mobil',
  'notifications.channel.push.hint': 'På enheter där du har tillåtit det',
  'notifications.event.trip.invited': 'Reseinbjudningar',
  'notifications.event.trip.invited.hint':
    'Någon lägger till dig på en resa hen planerar.',
  'notifications.event.trip.updated': 'Ändringar i planen',
  'notifications.event.trip.updated.hint':
    'En dag, ett stopp eller ett datum flyttas på en resa du är med på.',
  'notifications.event.trip.starting_soon': 'Påminnelser före avresa',
  'notifications.event.trip.starting_soon.hint':
    'En knuff dagarna innan en resa börjar.',
  'notifications.event.reservation.reminder': 'Påminnelser om bokningar',
  'notifications.event.reservation.reminder.hint':
    'Ett boende, ett bord eller en biljett närmar sig.',
  'notifications.event.expense.added': 'Nya utgifter',
  'notifications.event.expense.added.hint':
    'Någon för in pengar som lagts ut på en gemensam resa.',
  'notifications.event.expense.settled': 'Reglerade belopp',
  'notifications.event.expense.settled.hint':
    'Ett belopp du var del av har betalats.',
  'notifications.event.list.assigned': 'Tilldelade punkter',
  'notifications.event.list.assigned.hint':
    'Något på en packlista eller att göra-lista blir ditt.',
  'notifications.event.collab.message': 'Samtalet om resan',
  'notifications.event.collab.message.hint':
    'Nya meddelanden på en resa du är med på.',
  'notifications.event.organization.invited': 'Inbjudningar till arbetsytor',
  'notifications.event.organization.invited.hint':
    'Du bjuds in till en arbetsyta.',

  'notifications.event.billing.plan_changed': 'Abonnemangsändringar',
  'notifications.event.billing.plan_changed.hint':
    'Din arbetsyta byter abonnemang.',
  'notifications.event.billing.invoice_paid': 'Betalningskvitton',
  'notifications.event.billing.invoice_paid.hint':
    'En faktura för din arbetsyta har betalats.',
  'notifications.event.billing.payment_failed': 'Betalningsproblem',
  'notifications.event.billing.payment_failed.hint':
    'En betalning för din arbetsyta gick inte igenom.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Arbetsytan lästes inte in',
  'workspace.summary.description': 'Abonnemanget {plan} · skapad {date}',
  'workspace.summary.createdRecently': 'nyligen',
  'workspace.summary.billingAction': 'Abonnemang och betalning',
  'workspace.seats.label': 'Använda platser',
  'workspace.seats.value': '{used} av {limit}',
  'workspace.seats.note':
    'Obesvarade inbjudningar räknas mot era platser, så en arbetsyta kan aldrig ta fler än abonnemanget betalar för.',
  'workspace.seatsFull.title': 'Alla platser i det här abonnemanget är tagna',
  'workspace.seatsFull.body':
    '{members} och {invitations} fyller alla {limit} platser.',
  'workspace.seatsFull.action': 'Lägg till platser',
  'workspace.members.count': {
    one: '{value} medlem',
    other: '{value} medlemmar',
  },
  'workspace.invitations.count': {
    one: '{value} obesvarad inbjudan',
    other: '{value} obesvarade inbjudningar',
  },
  'workspace.members.title': 'Medlemmar',
  'workspace.members.description':
    'Alla som ser resorna, pengarna och filerna i den här arbetsytan.',
  'workspace.members.tableLabel': 'Medlemmar i den här arbetsytan',
  'workspace.members.person': 'Namn',
  'workspace.members.role': 'Roll',
  'workspace.members.joined': 'Med sedan',
  'workspace.invitations.title': 'Inbjudningar',
  'workspace.invitations.description':
    'Personer som är inbjudna men inte har anslutit än.',
  'workspace.invitations.emptyTitle': 'Inga obesvarade inbjudningar',
  'workspace.invitations.emptyBody':
    'Alla som bjudits in till den här arbetsytan är redan med.',
  'workspace.invitations.expires': 'Går ut {date}',
  'workspace.invitations.expiresSoon': 'snart',
  'workspace.defaults.title': 'Gemensamma förval',
  'workspace.defaults.description':
    'Vad en ny resa och en ny medlem börjar med. Var och en får gå förbi det i sin egen profil.',
  'workspace.defaults.readOnly': 'Skrivskyddat',
  'workspace.defaults.saving': 'Förvalen sparas',
  'workspace.defaults.saved': 'Arbetsytans förval är sparade',
  'workspace.defaults.saveFailed': 'Förvalen sparades inte',
  'workspace.defaults.saveFailedBody':
    'Bara en ägare eller administratör får ändra dem. Kontrollera din uppkoppling och försök sedan igen.',
  'workspace.currency.label': 'Standardvaluta',
  'workspace.currency.hint': 'Nya resor budgeteras i den.',
  'workspace.language.label': 'Språk',
  'workspace.language.hint':
    'Vad en medlem läser som inte har valt något eget språk.',
  'workspace.timezone.label': 'Tidszon',
  'workspace.dateFormat.label': 'Datumformat',
  'workspace.weekStart.label': 'Veckan börjar på',
  'workspace.distance.label': 'Avstånd',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Faktureringen lästes inte in',
  'billing.loading': 'Abonnemanget och kvittona läses in',
  'billing.status.none': 'Inget abonnemang',
  'billing.status.trialing': 'Provperiod',
  'billing.status.active': 'Aktivt',
  'billing.status.past_due': 'Betalningen gick inte igenom',
  'billing.status.unpaid': 'Obetalt',
  'billing.status.paused': 'Pausat',
  'billing.status.canceled': 'Uppsagt',
  'billing.status.incomplete': 'Ofullständigt',
  'billing.status.incomplete_expired': 'Utgånget',

  'billing.checkout.completeTitle': 'Betalningen har kommit fram',
  'billing.checkout.completeBody':
    'Ditt nya abonnemang håller på att tas i bruk. Det syns här så fort Polar bekräftar det — oftast inom några sekunder.',
  'billing.checkout.cancelledTitle': 'Betalningen avbröts',
  'billing.checkout.cancelledBody':
    'Ingenting drogs och ditt abonnemang är oförändrat.',
  'billing.portal.backTitle': 'Tillbaka från Polar',
  'billing.portal.backBody':
    'Det du ändrade där landar här så fort Polar bekräftar det.',
  'billing.refresh': 'Uppdatera',
  'billing.readOnly.title': 'Du är medlem i den här arbetsytan',
  'billing.readOnly.body':
    'Bara en ägare eller administratör kan ändra abonnemanget. Allt nedanför kan du bara läsa.',

  'billing.hero.label': 'Nuvarande abonnemang',
  'billing.hero.endsAtPeriod': 'Upphör vid periodens slut',
  'billing.hero.perYear': '/ år',
  'billing.hero.perMonth': '/ månad',
  'billing.hero.freeAllowance': '{trips} resor, en resenär',
  'billing.hero.perSeatLine': '{seats} medlemmar × {price}',
  'billing.hero.singleTraveller': 'En resenär',
  'billing.price.free': 'Gratis',
  'billing.provider.opening': 'Polar öppnas',
  'billing.renewal.trialEndsToday':
    'Din testperiod slutar i dag. Den första debiteringen följer om du inte avbryter innan.',
  'billing.renewal.trialEndsIn': {
    one: 'Din testperiod slutar om {value} dag, sedan följer den första debiteringen om du inte avbryter innan.',
    other:
      'Din testperiod slutar om {value} dagar, sedan följer den första debiteringen om du inte avbryter innan.',
  },
  'billing.renewal.trialEnded': 'Din provperiod är slut.',
  'billing.renewal.endsNoDate':
    'Det här abonnemanget ska upphöra och förnyas inte.',
  'billing.renewal.endsOn':
    'Det här abonnemanget upphör den {date}. Ingenting raderas — de betalda modulerna låses bara.',
  'billing.renewal.pastDue':
    'Den senaste betalningen gick inte igenom. Uppdatera kortet så att de betalda modulerna blir kvar.',
  'billing.renewal.unpaid':
    'Det här abonnemanget är obetalt och de betalda modulerna är låsta.',
  'billing.renewal.paused':
    'Det här abonnemanget är pausat. Återuppta det när du vill ge dig ut igen.',
  'billing.renewal.lapsed':
    'Välj ett abonnemang nedan för att låsa upp bokningar, dagboken och offlinekartor igen.',
  'billing.renewal.incomplete':
    'Polar väntar fortfarande på att den här betalningen ska bekräftas.',
  'billing.renewal.free':
    'Två resor åt gången, på huset. Byt upp dig när du växer ur det.',
  'billing.renewal.auto': 'Förnyas automatiskt.',
  'billing.renewal.renewsOn': 'Förnyas den {date}.',

  'billing.usage.title': 'Användning',
  'billing.usage.description':
    'Räknas direkt, så ingen mätare blir gammal. Gränserna följer det abonnemang som gäller just nu.',
  'billing.quota.seats': 'Medlemmar',
  'billing.quota.trips': 'Resor',
  'billing.quota.storageBytes': 'Lagring',
  'billing.quota.unlimited': 'Obegränsat',
  'billing.quota.noLimit': 'Ingen gräns i det här abonnemanget',
  'billing.quota.used': '{quota} använt',
  'billing.quota.over.seats': {
    one: '{value} plats över gränsen i det här abonnemanget',
    other: '{value} platser över gränsen i det här abonnemanget',
  },
  'billing.quota.over.trips': {
    one: '{value} reseplats över gränsen i det här abonnemanget',
    other: '{value} reseplatser över gränsen i det här abonnemanget',
  },
  'billing.quota.over.storage': '{value} över gränsen i det här abonnemanget',
  'billing.quota.exhausted.seats':
    'Alla platser i det här abonnemanget är tagna',
  'billing.quota.exhausted.trips':
    'Alla reseplatser i det här abonnemanget används',
  'billing.quota.exhausted.storage': 'Lagringen i det här abonnemanget är full',
  'billing.quota.left': '{value} kvar',

  'billing.plans.title': 'Abonnemang',
  'billing.plans.description':
    'Byt abonnemang när du vill. Uppåt räknas av per dag; nedåt väntar bytet tills perioden du betalat för är slut.',
  'billing.interval.label': 'Betalningsintervall',
  'billing.interval.monthly': 'Månadsvis',
  'billing.interval.yearly': 'Årsvis',
  'billing.plan.free.name': 'Gratis',
  'billing.plan.free.tagline': 'Planera dina två nästa resor',
  'billing.plan.free.feature.trips': 'Två resor åt gången',
  'billing.plan.free.feature.itinerary': 'Dagsplan och karta, dag för dag',
  'billing.plan.free.feature.lists': 'Packlistor och enkla budgetar',
  'billing.plan.free.feature.atlas':
    'Världskartan som håller reda på var du varit',
  'billing.plan.solo.name': 'Enskild',
  'billing.plan.solo.tagline': 'För resenären som planerar varje detalj själv',
  'billing.plan.solo.feature.trips': 'Obegränsat med resor',
  'billing.plan.solo.feature.modules':
    'Alla planeringsmoduler — bokningar, dagbok, budgetar, packning',
  'billing.plan.solo.feature.offline':
    'Offlinekartor som du laddar ned före avfärd',
  'billing.plan.solo.feature.export': 'Export till pdf och kalender',
  'billing.plan.crew.name': 'Grupp',
  'billing.plan.crew.tagline': 'För familjer, vänner och små lag',
  'billing.plan.crew.feature.members':
    'Upp till tio medlemmar, en avgift per person',
  'billing.plan.crew.feature.realtime':
    'Samarbete i realtid, varje hand syns på kartan',
  'billing.plan.crew.feature.everything':
    'Obegränsat med resor och alla moduler',
  'billing.plan.crew.feature.storage':
    'Gemensamt utrymme för allas foton och dokument',

  'billing.plan.current': 'Nuvarande abonnemang',
  'billing.plan.currentBadge': 'Nuvarande',
  'billing.plan.popular': 'Populärt',
  'billing.plan.switchYearly': 'Byt till årsvis',
  'billing.plan.switchMonthly': 'Byt till månadsvis',
  'billing.plan.upgradeTo': 'Uppgradera till {plan}',
  'billing.plan.changeTo': 'Byt till {plan}',
  'billing.plan.perMemberMonth': '/ medlem / månad',
  'billing.plan.perMonth': '/ månad',
  'billing.plan.alwaysFree': 'Alltid gratis, utan kort',
  'billing.plan.billedYearly': '{amount} faktureras per år',
  'billing.plan.billedMonthly': '{amount} faktureras per månad',
  'billing.plan.members': 'Medlemmar',
  'billing.plan.membersHint':
    'Går att ändra när som helst — faktureringen följer med.',
  'billing.plan.seatOption': {
    one: '{value} medlem',
    other: '{value} medlemmar',
  },

  'billing.invoices.number': 'Faktura',
  'billing.invoices.date': 'Datum',
  'billing.invoices.amount': 'Belopp',
  'billing.invoices.status': 'Betalstatus',
  'billing.invoice.paid': 'Betald',
  'billing.invoice.draft': 'Utkast',
  'billing.invoice.void': 'Annullerad',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Betalleverantören avvisade begäran. Försök igen om en stund.',
  'billing.planChanged.title': 'Planen uppdaterad',
  'billing.planChanged.body':
    'Ändringen gäller redan hos Polar, som fakturerar mellanskillnaden. Sammanställningen nedan hinner upp inom en minut.',
  'billing.discount.toggle': 'Har du en kampanjkod?',
  'billing.discount.label': 'Kampanjkod',
  'billing.discount.hint': 'Används för den plan du väljer härnäst.',
  'billing.discount.applyCurrent': 'Använd på nuvarande plan',
  'billing.discount.applying': 'Koden tillämpas…',
  'billing.discount.invalidFormat':
    'Koder består av 3 till 64 bokstäver och siffror.',
  'billing.discount.rejected.invalid':
    'Koden är ogiltig. Kontrollera den och försök igen.',
  'billing.discount.rejected.rateLimited':
    'För många koder har provats. Försök igen om en timme.',
  'billing.discount.rejected.notApplicable':
    'Koden gäller inte för den här planen.',
  'billing.discount.rejected.busy':
    'Koder kan inte kontrolleras just nu. Försök igen om en minut.',
  'billing.discount.nextRenewal': 'Din kampanjkod gäller från nästa förnyelse.',
  'billing.discount.appliedTitle': 'Kampanjkoden har tillämpats',
  'billing.hero.manage': 'Hantera faktureringen',
  'billing.hero.manageHint':
    'Kort, faktureringsadress, momsnummer, kvitton och uppsägning finns hos Polar, som utfärdar fakturan.',
  'billing.hero.manageHintNone':
    'Det finns ännu ingen faktureringsprofil. Väljer du en betald plan nedan skapas en, och därefter öppnas portalen.',
  'billing.portal.opening': 'Faktureringsportalen öppnas',
  'billing.plan.notApplied': 'Den ändringen genomfördes inte',
  'billing.plan.cancelInPortal': 'Säg upp i portalen',
  'billing.plan.seatsOverMax': {
    one: 'Den här arbetsytan har {members} medlemmar och {plan} debiterar högst {max}. Ta bort {value} medlem innan du byter.',
    other:
      'Den här arbetsytan har {members} medlemmar och {plan} debiterar högst {max}. Ta bort {value} medlemmar innan du byter.',
  },
  'billing.plan.seatsBelowMembers':
    'Du har {members} medlemmar. Välj minst så många platser — Polar avvisar en prenumeration med färre platser än tilldelningar.',
  'billing.orders.title': 'Ordrar',
  'billing.orders.description':
    'Varje order i den här arbetsytan, senaste först.',
  'billing.orders.receipts': 'Alla kvitton',
  'billing.orders.unavailableTitle': 'Ordrarna laddas inte',
  'billing.orders.unavailableBody':
    'Polar svarade inte i tid för historiken. Allt ovan är aktuellt — försök igen om en stund eller läs hela registret i faktureringsportalen.',
  'billing.orders.emptyTitle': 'Inga ordrar än',
  'billing.orders.emptyCustomer':
    'Den första fakturan visas här så snart en faktureringsperiod avslutas.',
  'billing.orders.emptyNoCustomer':
    'Den här arbetsytan har aldrig debiterats. Välj en betald plan och fakturorna samlas här.',
  'billing.orders.tableLabel': 'Orderhistorik',
  'billing.orders.document': 'Dokument',
  'billing.orders.dateUnknown': 'Okänt datum',
  'billing.order.pending': 'Väntar',
  'billing.order.refunded': 'Återbetald',
  'billing.order.partiallyRefunded': 'Delvis återbetald',
  'billing.order.noInvoiceDraft': 'Ingen faktura så länge ordern är ett utkast',
  'billing.order.preparing': 'Förbereds',
  'billing.order.renderingHint':
    'Polar tar fortfarande fram faktura {number}. Nedladdningen kommer tillbaka om några sekunder.',
  'billing.order.fetching': 'Hämtar fakturan',
  'billing.order.generating': 'Polar förbereder fakturan',
  'billing.order.pdfLabel': 'Faktura {number} som PDF',
  'billing.order.stillWritingTitle': 'Polar skriver fortfarande den fakturan',
  'billing.order.stillWritingBody':
    'Faktura {number} tas fram. Nedladdningen kommer tillbaka av sig själv om några sekunder.',
  'billing.order.openFailed': 'Den fakturan gick inte att öppna',
} satisfies TranslationOf<typeof En>

export default messages
