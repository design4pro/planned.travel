/**
 * Everything the settings module says, in Catalan.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular with imperative actions, as everywhere
 * else in the Catalan catalogue.
 *
 * **Plural.** `Intl.PluralRules('ca')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Length is load-bearing here.** Two controls on these screens truncate: the
 * hint under each section link, and the trigger of every regional select. Each
 * `nav.*.hint` therefore stays inside the English one's width, and
 * `regional.workspaceDefault` leads with «Predeterminat» rather than a full
 * translation of «workspace default».
 *
 * **Dates.** Nothing here restates a date format: the Catalan month, weekday
 * and short-date forms are frozen in `src/lib/format-tables.ts`, and the date
 * shown in `language.sample.date` is rendered from that table.
 *
 * **Currency names are lower case**, as Catalan writes them.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Compte',
  'page.title': 'Configuració',
  'page.description':
    'Tot sobre tu, sobre el teu espai de treball i sobre com es comporta planned.travel',
  'page.error': 'La configuració no s’ha carregat',

  'nav.label': 'Seccions de la configuració',
  'nav.profile': 'Perfil',
  'nav.profile.hint': 'Tu, les dates i els diners',
  'nav.language': 'Idioma',
  'nav.language.hint': 'L’idioma de cada pantalla',
  'nav.appearance': 'Aparença',
  'nav.appearance.hint': 'Tema, moviment i el mapa',
  'nav.security': 'Seguretat',
  'nav.security.hint': 'Contrasenya, dos passos, claus',
  'nav.notifications': 'Notificacions',
  'nav.notifications.hint': 'Safata, correu i mòbil',
  'nav.workspace': 'Espai de treball',
  'nav.workspace.hint': 'Membres i valors comuns',
  'nav.billing': 'Facturació',
  'nav.billing.hint': 'Pla, places i factures',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Desa els canvis',
  'error.retryBody':
    'No s’ha perdut res. Comprova la connexió i torna-ho a provar.',
  'role.owner': 'Propietari',
  'role.admin': 'Administrador',
  'role.member': 'Membre',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Predeterminat — {value}',
  'regional.currency.AUD': 'dòlar australià',
  'regional.currency.CAD': 'dòlar canadenc',
  'regional.currency.CHF': 'franc suís',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'lliura esterlina',
  'regional.currency.JPY': 'ien japonès',
  'regional.currency.PLN': 'zloty polonès',
  'regional.currency.SEK': 'corona sueca',
  'regional.currency.USD': 'dòlar nord-americà',
  'regional.distance.metric': 'Quilòmetres',
  'regional.distance.imperial': 'Milles',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'El teu perfil no s’ha carregat',
  'profile.account.title': 'El teu compte',
  'profile.account.description':
    'El nom i el correu surten del compte amb què entres.',
  'profile.email.verified': 'Correu verificat',
  'profile.email.unverified': 'Correu sense verificar',
  'profile.twoFactor.on': 'Dos passos actius',
  'profile.figure.workspace': 'Espai de treball',
  'profile.figure.role': 'Rol',
  'profile.figure.joined': 'Membre des de',
  'profile.figure.joinedUnknown': 'Sense registrar',
  'profile.regional.title': 'Dates, diners i unitats',
  'profile.regional.description':
    'Això substitueix els valors de l’espai de treball només per a tu. Si en deixes un tal com està, segueix l’espai.',
  'profile.regional.saving': 'S’estan desant les teves preferències',
  'profile.regional.saved': 'Les teves preferències estan desades',
  'profile.regional.saveFailed': 'Les teves preferències no s’han desat',
  'profile.language.label': 'Idioma',
  'profile.language.hint':
    'Es tria en una pantalla pròpia, on cada idioma està escrit en la seva grafia.',
  'profile.language.action': 'Canvia',
  'profile.timezone.label': 'Fus horari',
  'profile.timezone.hint':
    'Les hores de sortida i d’arribada es mostren amb aquest fus.',
  'profile.currency.label': 'Moneda',
  'profile.currency.hint':
    'Els viatges nous comencen amb aquesta moneda; cada viatge la pot canviar.',
  'profile.dateFormat.label': 'Format de data',
  'profile.weekStart.label': 'La setmana comença en',
  'profile.weekStart.hint':
    'Val per a tots els calendaris, inclosa la graella anual de vacances.',
  'profile.distance.label': 'Distància',

  /* --------------------------------------------------------------- language */
  'language.error': 'La teva configuració d’idioma no s’ha carregat',
  'language.section.title': 'Idioma',
  'language.section.description':
    'Cada pantalla, cada botó i cada data es llegeixen en l’idioma que triïs aquí: vint-i-tres, i cadascun escrit en la seva grafia.',
  'language.label': 'Tria un idioma',
  'language.followWorkspace': 'Segueix l’espai de treball',
  'language.state.yours': 'El teu idioma',
  'language.state.workspace': 'El posa l’espai de treball',
  'language.state.hint.override':
    'És la teva tria. Val només per a tu, en tots els dispositius des dels quals entres.',
  'language.state.hint.workspace':
    'No tens un idioma propi, així que llegeixes el que tingui posat l’espai de treball. Un propietari o un administrador el pot canviar a Espai de treball.',
  'language.saved': 'planned.travel ja parla {language}',
  'language.saveFailed': 'El teu idioma no ha canviat',
  'language.saveFailedBody':
    'No s’ha perdut res i encara llegeixes {language}. Comprova la connexió i torna a triar.',
  'language.reload.title': 'El teu idioma està desat',
  'language.reload.body':
    'Aquesta pàgina no ha pogut acabar de canviar a {language}. Torna-la a carregar per llegir el producte en el teu idioma nou.',
  'language.sample.title': 'Com es llegiran les dates i els números',
  'language.sample.description':
    'Els mateixos tres valors, escrits com els escriu aquest idioma.',
  'language.sample.date': 'Una data',
  'language.sample.number': 'Un número',
  'language.sample.money': 'Un import',
  'language.legal':
    'Les condicions i l’avís de privadesa es publiquen només en anglès. Tota la resta del producte està traduïda.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'L’aparença no s’ha carregat',
  'appearance.theme.title': 'Tema',
  'appearance.theme.description':
    'Els dos temes estan dissenyats, no invertits. Tria el que llegeixis més còmode.',
  'appearance.theme.light': 'Clar',
  'appearance.theme.lightHint': 'Paper càlid, tot el dia',
  'appearance.theme.dark': 'Fosc',
  'appearance.theme.darkHint': 'Carbó càlid, mai negre',
  'appearance.theme.system': 'Sistema',
  'appearance.theme.systemHint': 'Segueix el dispositiu',
  'appearance.theme.showing': 'Ara es veu la paleta {palette}.',
  'appearance.theme.showingSystem':
    'Ara es veu la paleta {palette}, seguint el teu dispositiu.',
  'appearance.palette.light': 'clara',
  'appearance.palette.dark': 'fosca',
  'appearance.motion.title': 'Moviment i mapes',
  'appearance.motion.label': 'Redueix el moviment',
  'appearance.motion.hint':
    'Converteix les animacions d’entrada en un simple esvaïment. La configuració de reducció de moviment del teu sistema operatiu sempre es respecta.',
  'appearance.map.label': 'Estil del mapa',
  'appearance.map.hint':
    'El mapa base que fan servir el planificador i el mapa del món.',
  'appearance.map.workspace': 'Segueix l’espai de treball',
  'appearance.map.workspaceHint':
    'El que hagi triat el propietari de l’espai de treball.',
  'appearance.map.auto': 'Automàtic',
  'appearance.map.autoHint': 'Segueix el teu tema clar o fosc.',
  'appearance.map.paper': 'Paper',
  'appearance.map.paperHint': 'Càlid i clar, siguis al tema que siguis.',
  'appearance.map.charcoal': 'Carbó',
  'appearance.map.charcoalHint': 'Càlid i fosc, siguis al tema que siguis.',
  'appearance.map.quiet': 'Discret',
  'appearance.map.quietHint':
    'Sense noms de carrers, perquè els teus marcadors es llegeixin primer.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'En una pantalla compartida',
  'appearance.privacy.codesLabel':
    'Amaga els codis de confirmació fins que els demani',
  'appearance.privacy.codesHint':
    'Les referències de reserva i els números de confirmació es mantenen ocults a l’escriptori de reserves i als transports fins que hi facis clic o els toquis, i s’amaguen de nou quan passes a una altra cosa. Els preus no s’amaguen mai.',
  'appearance.saveFailed': 'Aquest canvi no s’ha desat',
  'appearance.saveFailedBody':
    'Aquí es veu, però el pròxim dispositiu des del qual entris no el tindrà.',

  /* --------------------------------------------------------------- security */
  'security.error': 'La seguretat no s’ha carregat',
  'security.unverified.title':
    'La teva adreça electrònica encara no està verificada',
  'security.unverified.body':
    'Els canvis de contrasenya i les invitacions a viatges s’envien a {email}. Verificar-la és el que demostra que l’adreça és teva.',
  'security.unverified.action': 'Torna a enviar l’enllaç',
  'security.signin.title': 'Accés',
  'security.signin.description':
    'Com demostres que ets tu. Els dos passos i les claus d’accés són tots dos més forts que una contrasenya sola.',
  'security.email.label': 'Adreça electrònica',
  'security.email.verified': 'Verificada',
  'security.email.unverified': 'Sense verificar',
  'security.password.label': 'Contrasenya',
  'security.password.hint':
    'Canvia-la quan vulguis: t’enviarem un enllaç d’un sol ús en lloc de demanar-te l’antiga.',
  'security.password.action': 'Canvia la contrasenya',
  'security.twoFactor.label': 'Verificació en dos passos',
  'security.twoFactor.onHint':
    'A cada accés nou cal un codi de la teva aplicació d’autenticació.',
  'security.twoFactor.offHint':
    'Afegeix un codi de sis xifres d’una aplicació d’autenticació per sobre de la contrasenya.',
  'security.twoFactor.on': 'Activada',
  'security.twoFactor.off': 'Desactivada',
  'security.twoFactor.manage': 'Gestiona',
  'security.twoFactor.enable': 'Activa',
  'security.passkeys.label': 'Claus d’accés',
  'security.passkeys.hint':
    'Entra amb l’empremta, amb Face ID o amb una clau de seguretat, sense escriure res.',
  'security.passkeys.action': 'Gestiona les claus d’accés',
  'security.session.title': 'Aquesta sessió',
  'security.session.description': 'El navegador on estàs llegint això.',
  'security.session.label': 'Has entrat com a',
  'security.session.expires': 'Caduca {date}',
  'security.session.expiresSoon': 'aviat',
  'security.session.noExpiry': 'Sense caducitat registrada',
  'security.signOut.label': 'Tanca la sessió',
  'security.signOut.hint':
    'Acaba aquesta sessió i et torna a la pantalla d’accés. Els altres dispositius continuen dins.',
  'security.signOut.pending': 'S’està tancant la sessió',
  'security.signOut.failed': 'No s’ha tancat la teva sessió',
  'security.signOut.failedBody': 'Comprova la connexió i torna-ho a provar.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error':
    'La configuració de les notificacions no s’ha carregat',
  'notifications.title': 'Notificacions',
  'notifications.description':
    'Cada interruptor val només per a tu. Apagar-ne un mai no impedeix que la cosa passi: només impedeix que te l’expliquem.',
  'notifications.caption': 'Quines notificacions arriben a cada canal',
  'notifications.event': 'Esdeveniment',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Aquesta preferència no s’ha desat',
  'notifications.saveFailedBody':
    'Hem tornat l’interruptor on era. Comprova la connexió i torna-ho a provar.',
  'notifications.channel.in_app': 'A l’aplicació',
  'notifications.channel.in_app.hint': 'La campana de la barra de dalt',
  'notifications.channel.email': 'Correu',
  'notifications.channel.email.hint': 'A l’adreça amb què entres',
  'notifications.channel.push': 'Al mòbil',
  'notifications.channel.push.hint': 'Als dispositius on ho has permès',
  'notifications.event.trip.invited': 'Invitacions a viatges',
  'notifications.event.trip.invited.hint':
    'Algú t’afegeix a un viatge que està preparant.',
  'notifications.event.trip.updated': 'Canvis de pla',
  'notifications.event.trip.updated.hint':
    'Es mou un dia, una parada o una data d’un viatge on ets.',
  'notifications.event.trip.starting_soon': 'Recordatoris de sortida',
  'notifications.event.trip.starting_soon.hint':
    'Un avís els dies abans que comenci un viatge.',
  'notifications.event.reservation.reminder': 'Recordatoris de reserva',
  'notifications.event.reservation.reminder.hint':
    'S’acosta un allotjament, una taula o una entrada.',
  'notifications.event.expense.added': 'Despeses noves',
  'notifications.event.expense.added.hint':
    'Algú apunta diners gastats en un viatge compartit.',
  'notifications.event.expense.settled': 'Comptes saldats',
  'notifications.event.expense.settled.hint':
    'S’ha pagat un saldo del qual formaves part.',
  'notifications.event.list.assigned': 'Tasques assignades',
  'notifications.event.list.assigned.hint':
    'Alguna cosa d’una llista d’equipatge o de tasques passa a ser teva.',
  'notifications.event.collab.message': 'Conversa del viatge',
  'notifications.event.collab.message.hint':
    'Missatges nous en un viatge que estàs fent.',
  'notifications.event.organization.invited': 'Invitacions a espais',
  'notifications.event.organization.invited.hint':
    'Et conviden a un espai de treball.',

  'notifications.event.billing.plan_changed': 'Canvis de subscripció',
  'notifications.event.billing.plan_changed.hint':
    'El teu espai de treball canvia de pla.',
  'notifications.event.billing.invoice_paid': 'Rebuts de pagament',
  'notifications.event.billing.invoice_paid.hint':
    'S’ha pagat una factura del teu espai de treball.',
  'notifications.event.billing.payment_failed': 'Problemes de pagament',
  'notifications.event.billing.payment_failed.hint':
    'Un càrrec del teu espai de treball no s’ha pogut fer.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'L’espai de treball no s’ha carregat',
  'workspace.summary.description': 'Pla {plan} · creat {date}',
  'workspace.summary.createdRecently': 'fa poc',
  'workspace.summary.billingAction': 'Pla i facturació',
  'workspace.seats.label': 'Places ocupades',
  'workspace.seats.value': '{used} de {limit}',
  'workspace.seats.note':
    'Les invitacions pendents ocupen plaça, així que un espai mai no pot passar del pla que paga.',
  'workspace.seatsFull.title': 'Totes les places d’aquest pla estan ocupades',
  'workspace.seatsFull.body':
    '{members} i {invitations} omplen les {limit} places.',
  'workspace.seatsFull.action': 'Afegeix places',
  'workspace.members.count': {
    one: '{value} membre',
    many: '{value} membres',
    other: '{value} membres',
  },
  'workspace.invitations.count': {
    one: '{value} invitació pendent',
    many: '{value} invitacions pendents',
    other: '{value} invitacions pendents',
  },
  'workspace.members.title': 'Membres',
  'workspace.members.description':
    'Tothom que veu els viatges, els diners i els fitxers d’aquest espai.',
  'workspace.members.tableLabel': 'Membres d’aquest espai de treball',
  'workspace.members.person': 'Persona',
  'workspace.members.role': 'Rol',
  'workspace.members.joined': 'S’hi va unir',
  'workspace.invitations.title': 'Invitacions',
  'workspace.invitations.description':
    'Persones convidades que encara no han entrat.',
  'workspace.invitations.emptyTitle': 'No hi ha invitacions pendents',
  'workspace.invitations.emptyBody':
    'Tothom qui ha estat convidat a aquest espai ja hi ha entrat.',
  'workspace.invitations.expires': 'Caduca {date}',
  'workspace.invitations.expiresSoon': 'aviat',
  'workspace.defaults.title': 'Valors comuns',
  'workspace.defaults.description':
    'Amb què comencen un viatge nou i un membre nou. Qualsevol els pot canviar per a si mateix al seu perfil.',
  'workspace.defaults.readOnly': 'Només lectura',
  'workspace.defaults.saving': 'S’estan desant els valors comuns',
  'workspace.defaults.saved': 'Els valors comuns estan desats',
  'workspace.defaults.saveFailed': 'Els valors comuns no s’han desat',
  'workspace.defaults.saveFailedBody':
    'Només un propietari o un administrador els pot canviar. Comprova la connexió i torna-ho a provar.',
  'workspace.currency.label': 'Moneda per defecte',
  'workspace.currency.hint': 'Els viatges nous es pressuposten en aquesta.',
  'workspace.language.label': 'Idioma',
  'workspace.language.hint': 'El que llegeix qui no ha triat un idioma propi.',
  'workspace.timezone.label': 'Fus horari',
  'workspace.dateFormat.label': 'Format de data',
  'workspace.weekStart.label': 'La setmana comença en',
  'workspace.distance.label': 'Distància',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'La facturació no s’ha carregat',
  'billing.loading': 'S’estan carregant el pla i els rebuts',
  'billing.status.none': 'Sense subscripció',
  'billing.status.trialing': 'Prova',
  'billing.status.active': 'Activa',
  'billing.status.past_due': 'Pagament fallit',
  'billing.status.unpaid': 'Sense pagar',
  'billing.status.paused': 'En pausa',
  'billing.status.canceled': 'Cancel·lada',
  'billing.status.incomplete': 'Incompleta',
  'billing.status.incomplete_expired': 'Caducada',

  'billing.checkout.completeTitle': 'Pagament rebut',
  'billing.checkout.completeBody':
    'El teu pla nou s’està aplicant. Apareix aquí així que Polar el confirma, normalment en pocs segons.',
  'billing.checkout.cancelledTitle': 'Pagament cancel·lat',
  'billing.checkout.cancelledBody':
    'No s’ha cobrat res i el teu pla no ha canviat.',
  'billing.portal.backTitle': 'De tornada des de Polar',
  'billing.portal.backBody':
    'El que hi hagis canviat arriba aquí així que Polar ho confirma.',
  'billing.refresh': 'Actualitza',
  'billing.readOnly.title': 'Ets membre d’aquest espai de treball',
  'billing.readOnly.body':
    'Només un propietari o un administrador pot canviar la subscripció. Per a tu, tot això de sota és només de lectura.',

  'billing.hero.label': 'Pla actual',
  'billing.hero.endsAtPeriod': 'S’acaba en tancar el període',
  'billing.hero.perYear': '/ any',
  'billing.hero.perMonth': '/ mes',
  'billing.hero.freeAllowance': '{trips} viatges, un viatger',
  'billing.hero.perSeatLine': '{seats} membres × {price}',
  'billing.hero.singleTraveller': 'Un viatger',
  'billing.price.free': 'Gratuït',
  'billing.provider.opening': 'S’està obrint Polar',
  'billing.renewal.trialEndsToday':
    'El teu període de prova acaba avui. El primer càrrec arriba tot seguit, tret que el cancel·lis abans.',
  'billing.renewal.trialEndsIn': {
    one: 'El teu període de prova acaba en {value} dia, i després arriba el primer càrrec tret que el cancel·lis abans.',
    many: 'El teu període de prova acaba en {value} dies, i després arriba el primer càrrec tret que el cancel·lis abans.',
    other:
      'El teu període de prova acaba en {value} dies, i després arriba el primer càrrec tret que el cancel·lis abans.',
  },
  'billing.renewal.trialEnded': 'La teva prova s’ha acabat.',
  'billing.renewal.endsNoDate':
    'Aquest pla està previst que s’acabi i no es renovarà.',
  'billing.renewal.endsOn':
    'Data de fi del pla: {date}. No s’esborra res: els mòduls de pagament simplement es tanquen.',
  'billing.renewal.pastDue':
    'L’últim pagament no ha anat bé. Actualitza la targeta per no perdre els mòduls de pagament.',
  'billing.renewal.unpaid':
    'Aquesta subscripció està sense pagar i els mòduls de pagament estan tancats.',
  'billing.renewal.paused':
    'Aquesta subscripció està en pausa. Reprèn-la quan tornis a tenir ganes de viatjar.',
  'billing.renewal.lapsed':
    'Tria un pla de sota per tornar a obrir les reserves, el diari i els mapes sense connexió.',
  'billing.renewal.incomplete':
    'Polar encara espera la confirmació d’aquest pagament.',
  'billing.renewal.free':
    'Dos viatges alhora, de franc. Millora el pla quan se’t quedi petit.',
  'billing.renewal.auto': 'Es renova sol.',
  'billing.renewal.renewsOn': 'Pròxima renovació: {date}.',

  'billing.usage.title': 'Ús',
  'billing.usage.description':
    'Es compta en directe, així que cap indicador no queda vell. Els límits segueixen el pla que hi ha ara mateix.',
  'billing.quota.seats': 'Membres',
  'billing.quota.trips': 'Viatges',
  'billing.quota.storageBytes': 'Emmagatzematge',
  'billing.quota.unlimited': 'Sense límit',
  'billing.quota.places': 'Llocs',
  'billing.quota.placesHint': 'A tots els viatges d’aquest espai de treball',
  'billing.quota.exhausted.places': 'S’ha esgotat el límit de llocs',
  'billing.quota.over.places': 'El límit de llocs s’ha superat en {value}',
  'billing.quota.noLimit': 'Aquest pla no posa límit',
  'billing.quota.used': '{quota} en ús',
  'billing.quota.over.seats': {
    one: '{value} plaça per sobre del límit d’aquest pla',
    many: '{value} places per sobre del límit d’aquest pla',
    other: '{value} places per sobre del límit d’aquest pla',
  },
  'billing.quota.over.trips': {
    one: '{value} lloc de viatge per sobre del límit d’aquest pla',
    many: '{value} llocs de viatge per sobre del límit d’aquest pla',
    other: '{value} llocs de viatge per sobre del límit d’aquest pla',
  },
  'billing.quota.over.storage': '{value} per sobre del límit d’aquest pla',
  'billing.quota.exhausted.seats':
    'Totes les places d’aquest pla estan ocupades',
  'billing.quota.exhausted.trips':
    'Tots els llocs de viatge d’aquest pla estan en ús',
  'billing.quota.exhausted.storage': 'L’emmagatzematge d’aquest pla és ple',
  'billing.quota.left': 'En queda {value}',

  'billing.plans.title': 'Plans i preus',
  'billing.plans.description':
    'Canvia de pla quan vulguis. Les millores es prorategen al dia; una baixada espera que s’acabi el període que ja has pagat.',
  'billing.interval.label': 'Període de facturació',
  'billing.interval.monthly': 'Mensual',
  'billing.interval.yearly': 'Anual',
  'billing.plan.free.name': 'Gratuït',
  'billing.plan.free.tagline': 'Prepara els teus dos pròxims viatges',
  'billing.plan.free.feature.trips': 'Dos viatges alhora',
  'billing.plan.free.feature.itinerary': 'Itinerari dia a dia i mapa',
  'billing.plan.free.feature.lists':
    'Llistes d’equipatge i pressupostos senzills',
  'billing.plan.free.feature.atlas': 'El mapa del món que marca on has estat',
  'billing.plan.solo.name': 'En solitari',
  'billing.plan.solo.tagline': 'Per a qui s’ho prepara tot',
  'billing.plan.solo.feature.trips': 'Viatges sense límit',
  'billing.plan.solo.feature.modules':
    'Tots els mòduls: reserves, diari, pressupostos i equipatge',
  'billing.plan.solo.feature.offline':
    'Mapes sense connexió que et descarregues abans de volar',
  'billing.plan.solo.feature.export': 'Exportació a PDF i al calendari',
  'billing.plan.crew.name': 'En grup',
  'billing.plan.crew.tagline': 'Per a famílies, amics i equips petits',
  'billing.plan.crew.feature.members':
    'Fins a deu membres, amb pagament per persona',
  'billing.plan.crew.feature.realtime':
    'Col·laboració en directe, amb els cursors de tothom',
  'billing.plan.crew.feature.everything':
    'Viatges sense límit i tots els mòduls',
  'billing.plan.crew.feature.storage':
    'Lloc compartit per a les fotos i els documents de tothom',

  'billing.plan.current': 'Pla actual',
  'billing.plan.currentBadge': 'Actual',
  'billing.plan.popular': 'El més triat',
  'billing.plan.switchYearly': 'Passa a anual',
  'billing.plan.switchMonthly': 'Passa a mensual',
  'billing.plan.upgradeTo': 'Millora a {plan}',
  'billing.plan.changeTo': 'Canvia a {plan}',
  'billing.plan.perMemberMonth': '/ membre / mes',
  'billing.plan.perMonth': '/ mes',
  'billing.plan.alwaysFree': 'Sempre gratuït, sense targeta',
  'billing.plan.billedYearly': '{amount} l’any',
  'billing.plan.billedMonthly': '{amount} al mes',
  'billing.plan.members': 'Membres',
  'billing.plan.membersHint': 'Canvia-ho quan vulguis: la factura ho segueix.',
  'billing.plan.seatOption': {
    one: '{value} membre',
    many: '{value} membres',
    other: '{value} membres',
  },

  'billing.invoices.number': 'Factura',
  'billing.invoices.date': 'Data',
  'billing.invoices.amount': 'Import',
  'billing.invoices.status': 'Estat',
  'billing.invoice.paid': 'Pagada',
  'billing.invoice.draft': 'Esborrany',
  'billing.invoice.void': 'Anul·lada',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'El proveïdor de pagament ha rebutjat la sol·licitud. Torna-ho a provar en un moment.',
  'billing.planChanged.title': 'Pla actualitzat',
  'billing.planChanged.body':
    'El canvi ja és vigent a Polar, que facturarà la diferència. El resum de sota s’hi posa al dia en un minut.',
  'billing.discount.toggle': 'Tens un codi promocional?',
  'billing.discount.label': 'Codi promocional',
  'billing.discount.hint': 'S’aplicarà al pla que triïs a continuació.',
  'billing.discount.hintCurrent':
    'Aplica’l al teu pla actual o tria un pla a continuació.',
  'billing.discount.applyCurrent': 'Aplica al pla actual',
  'billing.discount.applying': 'S’està aplicant el codi…',
  'billing.discount.invalidFormat':
    'Els codis tenen de 3 a 64 lletres i xifres.',
  'billing.discount.rejected.invalid':
    'Aquest codi no és vàlid. Revisa’l i torna-ho a provar.',
  'billing.discount.rejected.rateLimited':
    'S’han provat massa codis. Torna-ho a provar d’aquí a una hora.',
  'billing.discount.rejected.notApplicable':
    'Aquest codi no s’aplica a aquest pla.',
  'billing.discount.rejected.busy':
    'Ara no es poden comprovar els codis. Torna-ho a provar d’aquí a un minut.',
  'billing.discount.nextRenewal':
    'El teu codi promocional s’aplica a partir de la propera renovació.',
  'billing.discount.appliedTitle': 'Codi promocional aplicat',
  'billing.hero.manage': 'Gestiona la facturació',
  'billing.hero.manageHint':
    'Les targetes, l’adreça de facturació, el NIF, els rebuts i la cancel·lació són a Polar, que emet la factura.',
  'billing.hero.manageHintNone':
    'Encara no hi ha perfil de facturació. Si tries un pla de pagament a sota se’n crea un, i des d’aleshores s’obre el portal.',
  'billing.portal.opening': 'S’obre el portal de facturació',
  'billing.plan.notApplied': 'Aquest canvi no s’ha aplicat',
  'billing.plan.cancelInPortal': 'Cancel·la al portal',
  'billing.plan.seatsOverMax': {
    one: 'Aquest espai té {members} membres i {plan} en factura {max} com a màxim. Elimina {value} membre abans de canviar.',
    many: 'Aquest espai té {members} membres i {plan} en factura {max} com a màxim. Elimina {value} membres abans de canviar.',
    other:
      'Aquest espai té {members} membres i {plan} en factura {max} com a màxim. Elimina {value} membres abans de canviar.',
  },
  'billing.plan.seatsBelowMembers':
    'Tens {members} membres. Tria com a mínim aquestes places: Polar rebutja una subscripció amb menys places que assignacions.',
  'billing.orders.title': 'Comandes',
  'billing.orders.description':
    'Cada comanda d’aquest espai, de la més recent a la més antiga.',
  'billing.orders.receipts': 'Tots els rebuts',
  'billing.orders.unavailableTitle': 'Les comandes no es carreguen',
  'billing.orders.unavailableBody':
    'Polar no ha respost a temps per a l’historial. Tot el de sobre és al dia: torna-ho a provar en un moment o llegeix el registre complet al portal de facturació.',
  'billing.orders.emptyTitle': 'Encara no hi ha comandes',
  'billing.orders.emptyCustomer':
    'La primera factura apareix aquí tan bon punt es tanca un període de facturació.',
  'billing.orders.emptyNoCustomer':
    'A aquest espai no se li ha cobrat mai res. Tria un pla de pagament i les factures s’aniran reunint aquí.',
  'billing.orders.tableLabel': 'Historial de comandes',
  'billing.orders.document': 'Document',
  'billing.orders.dateUnknown': 'Data desconeguda',
  'billing.order.pending': 'Pendent',
  'billing.order.refunded': 'Retornada',
  'billing.order.partiallyRefunded': 'Retornada en part',
  'billing.order.noInvoiceDraft':
    'Sense factura mentre la comanda sigui un esborrany',
  'billing.order.preparing': 'S’està preparant',
  'billing.order.renderingHint':
    'Polar encara està generant la factura {number}. La descàrrega torna en uns segons.',
  'billing.order.fetching': 'S’està obtenint la factura',
  'billing.order.generating': 'Polar està preparant la factura',
  'billing.order.pdfLabel': 'Factura {number} en PDF',
  'billing.order.stillWritingTitle':
    'Polar encara està redactant aquesta factura',
  'billing.order.stillWritingBody':
    'La factura {number} s’està generant. La descàrrega torna sola en uns segons.',
  'billing.order.openFailed': 'Aquesta factura no s’ha obert',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Compte',
  'passkeys.page.title': 'Claus d’accés',
  'passkeys.page.description':
    'Una clau d’accés et permet d’entrar amb l’empremta, el rostre o una clau de seguretat, sense escriure res.',
  'passkeys.page.back': 'Torna a seguretat',
  'passkeys.list.label': 'Les teves claus d’accés',
  'passkeys.add.action': 'Afegeix una clau d’accés',
  'passkeys.add.loading': 'Esperant el teu dispositiu',
  'passkeys.add.added': 'Clau d’accés afegida',
  'passkeys.add.dismissed': 'No s’ha afegit cap clau d’accés',
  'passkeys.add.exists':
    'Aquest dispositiu ja té una clau d’accés per al teu compte',
  'passkeys.add.failed': 'No s’ha afegit la clau d’accés. Torna-ho a provar.',
  'passkeys.add.stale':
    'Per la teva seguretat, torna a iniciar la sessió per continuar.',
  'passkeys.error.sessionEnded':
    'La teva sessió ha acabat. Torna a iniciar la sessió per continuar.',
  'passkeys.signInAgain': 'Inicia la sessió de nou',
  'passkeys.add.limit':
    'Has arribat al límit de {value} claus d’accés. Elimina’n una per afegir-ne una altra.',
  'passkeys.add.unsupported':
    'Aquest navegador no pot crear claus d’accés. Prova amb un altre navegador o dispositiu.',
  'passkeys.empty.title': 'Encara no hi ha claus d’accés',
  'passkeys.empty.body':
    'Afegeix-ne una i podràs entrar amb l’empremta, el rostre o una clau de seguretat, sense escriure res.',
  'passkeys.row.fallbackName': 'Clau d’accés · afegida el {date}',
  'passkeys.row.added': 'Afegida el {date}',
  'passkeys.row.lastUsed': 'Darrer ús: {date}',
  'passkeys.row.neverUsed': 'Encara no s’ha usat per entrar',
  'passkeys.badge.synced': 'Sincronitzada',
  'passkeys.badge.singleDevice': 'Només en un dispositiu',
  'passkeys.error.title': 'No s’han carregat les teves claus d’accés',
  'passkeys.error.retry': 'Torna-ho a provar',
  'passkeys.error.rateLimited':
    'Massa intents. Torna-ho a provar d’aquí a uns minuts.',
  'passkeys.error.generic': 'Comprova la connexió i torna-ho a provar.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': 'Canvia el nom de {name}',
  'passkeys.rename.fieldLabel': 'Posa un nom a aquesta clau d’accés',
  'passkeys.rename.placeholder': 'Posa-li nom, per exemple Mòbil de la feina',
  'passkeys.rename.saving': 'Desant el nom',
  'passkeys.rename.saved': 'Nom desat',
  'passkeys.rename.failed': 'No s’ha desat el nom',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': 'Elimina {name}',
  'passkeys.delete.title': 'Vols eliminar aquesta clau d’accés?',
  'passkeys.delete.body': 'Ja no podràs iniciar la sessió amb {name}.',
  'passkeys.delete.password': 'Contrasenya',
  'passkeys.delete.passwordHint': 'Introdueix la contrasenya per confirmar-ho.',
  'passkeys.delete.confirmOnly':
    'El teu compte no té contrasenya. Confirma que vols eliminar aquesta clau d’accés.',
  'passkeys.delete.confirm': 'Elimina la clau d’accés',
  'passkeys.delete.cancel': 'Cancel·la',
  'passkeys.delete.wrongPassword': 'Aquesta contrasenya no és correcta.',
  'passkeys.delete.stale':
    'Per la teva seguretat, torna a iniciar la sessió abans d’eliminar una clau d’accés.',
  'passkeys.delete.removed': 'Clau d’accés eliminada',
  'passkeys.delete.failed':
    'No s’ha eliminat la clau d’accés. Torna-ho a provar.',
  'passkeys.delete.removing': 'Eliminant la clau d’accés',
  'passkeys.delete.passwordRequired':
    'Introdueix la contrasenya per eliminar aquesta clau d’accés.',
} satisfies TranslationOf<typeof En>

export default messages
