/**
 * The trip tabs' own copy, in cs.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurál.** `one` · `few` · `many` · `other`; `many` je desetinné číslo.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Tuto cestu se nepodařilo načíst',
  'error.plan': 'Program se nepodařilo načíst',
  'error.costs': 'Náklady se nepodařilo načíst',
  'error.collab': 'Konverzaci se nepodařilo načíst',
  'error.book': 'Rezervace se nepodařilo načíst',
  'error.transports': 'Přesuny se nenačetly',
  'error.people': 'Lidi se nepodařilo načíst',
  'header.length': {
    one: '{days} den',
    few: '{days} dny',
    many: '{days} dne',
    other: '{days} dní',
  },
  'header.planned': {
    one: '{days} den naplánován',
    few: '{days} dny naplánovány',
    many: '{days} dne naplánováno',
    other: '{days} dní naplánováno',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Program',
  'plan.places': 'Místa',
  'plan.readOnly.archived':
    'Tato cesta je archivovaná, takže plán je jen pro čtení.',
  'plan.readOnly.role':
    'Tento plán si můžete prohlížet. Měnit ho může jen vlastník cesty a ti, kdo mohou upravovat.',
  'plan.day.empty': 'Nic naplánováno – přetáhni sem místo nebo poznámku',
  'plan.move.refused.duplicate': '{name} v tom dni už je',
  'plan.move.refused.duplicateBody':
    'Místo se může v jednom dni objevit jen jednou. Přesuňte ho na jiný den.',
  'plan.move.refused.notInIdeas': 'Poznámka zůstává ve dni',
  'plan.move.refused.notInIdeasBody':
    'Nápady jsou místa, která čekají na svůj den. Poznámka patří ke dni, ke kterému byla napsána.',
  'plan.move.refused.notInAnotherDay': 'Poznámka zůstává u svého dne',
  'plan.move.refused.notInAnotherDayBody':
    'Poznámky zatím nelze přesouvat mezi dny. Upravte poznámku, nebo ji napište k jinému dni.',
  'plan.move.refused.journeyNotInIdeas': 'Přesun zůstává ve dni',
  'plan.move.refused.journeyNotInIdeasBody':
    'Nápady jsou místa, která čekají na svůj den. Přesun patří ke dni, kdy se odehrává.',
  'plan.move.refused.journeyNotInAnotherDay': 'Přesun zůstává u svého dne',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Den přesunu vychází z jeho dat. Změňte je na kartě Přesuny.',
  'plan.move.refused.journeyTimed': '{name} odjíždí v {time}',
  'plan.move.refused.journeyTimedBody':
    'Čas odjezdu patří jízdnímu řádu, ne plánu. Umístěte přesun tam, kam ukazují jeho hodiny.',
  'plan.move.spoken.duplicate': '{name} se nepřesunul. Ten den ho už má.',
  'plan.move.spoken.notInIdeas':
    '{name} se nepřesunul. Poznámka zůstává ve dni.',
  'plan.move.spoken.notInAnotherDay':
    '{name} se nepřesunul. Poznámka zůstává u svého dne.',
  'plan.move.spoken.timed':
    '{name} má čas {time}. Ptáme se, jestli ho zahodit.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} se nepřesunul. Přesun zůstává ve dni.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} se nepřesunul. Přesun zůstává u svého dne.',
  'plan.move.spoken.journeyTimed': '{name} se nepřesunul. Odjíždí v {time}.',
  'plan.move.error.save': 'Přesunutí se nepodařilo uložit',
  'plan.move.error.retry': 'Zkuste to za chvíli znovu.',
  'plan.move.dropTime.title': 'Přesunout {name} a zahodit čas {time}?',
  'plan.move.dropTime.body':
    'Tato pozice je v rozporu s časem, který má. Přesunutí sem čas smaže — nové pořadí i smazaný čas se uloží společně.',
  'plan.move.dropTime.confirm': 'Přesunout a smazat čas',
  'plan.move.dropTime.cancel': 'Nechat na místě',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Přidat poznámku',
  'plan.note.addForDay': 'Přidat poznámku: {day}',
  'plan.addPlace.label': 'Přidat místo',
  'plan.addPlace.more': 'Další způsoby, jak přidat místo',
  'plan.addPlace.option.map': 'Umístit na mapu',
  'plan.addPlace.forDayNamed': 'Přidat místo: {day}',
  'plan.addPlace.quota':
    'Dosáhli jste limitu míst ve svém tarifu. Přejděte na vyšší tarif a přidejte další.',
  'plan.addPlace.quotaAction': 'Zobrazit tarify',
  'plan.stay.checkIn': 'Příjezd',
  'plan.stay.checkOut': 'Odjezd',
  'plan.day.addStay': 'Přidat ubytování: {day}',
  'plan.day.addStayShort': 'Přidat ubytování',
  'plan.handoff.stop': 'Otevřít {place} v {service} (otevře se na nové kartě)',
  'plan.handoff.day.directions': 'Trasa v {service}',
  'plan.handoff.day.directionsName':
    'Trasa v {service}: {day} (otevře se na nové kartě)',
  'plan.handoff.day.directionsPartial': 'Zastávky: prvních {carried} z {total}',
  'plan.handoff.day.directionsPartialName':
    'Trasa v {service}: {day}, zastávky: prvních {carried} z {total} (otevře se na nové kartě)',
  'plan.handoff.day.point': 'Zobrazit v {service}',
  'plan.handoff.day.pointName':
    'Zobrazit v {service}: jediná zastávka na mapě, {day} (otevře se na nové kartě)',
  'plan.drop.hint':
    'Klikněte na mapu pravým tlačítkem nebo na ni dlouze podržte prst a místo se přidá přesně tam.',
  'plan.drop.armed':
    'Klikněte do mapy tam, kam místo patří, nebo mapu posuňte a stiskněte Enter, aby se umístilo doprostřed.',
  'plan.drop.stop': 'Přestat umisťovat nový špendlík',
  'plan.drop.pin': 'Nové místo',
  'plan.drop.lookingUp': 'Hledá se adresa…',
  'plan.drop.error':
    'Špendlík se nepodařilo umístit. Zkuste to za chvíli znovu.',
  'plan.place.pastedPosition':
    'Načteno jako zeměpisná šířka {lat}, délka {lng}',
  'plan.note.showMore': 'Zobrazit více',
  'plan.note.showLess': 'Zobrazit méně',
  'plan.note.moveUp': 'Posunout nahoru',
  'plan.note.moveDown': 'Posunout dolů',
  'plan.note.drag': 'Změnit pořadí poznámky',
  'plan.note.edit': 'Upravit poznámku',
  'plan.note.delete': 'Smazat poznámku',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Přidat poznámku',
  'plan.note.dialog.editTitle': 'Upravit poznámku',
  'plan.note.field.body': 'Poznámka',
  'plan.note.field.bodyHint': 'Jeden řádek. To se u dne zobrazí.',
  'plan.note.field.detail': 'Podrobnosti',
  'plan.note.field.detailHint':
    'Nadpisy, seznamy, odkazy, citace, kód a tabulky.',
  'plan.note.field.time': 'Čas',
  'plan.note.field.timeHint': 'Nepovinné, ve 24hodinovém formátu.',
  'plan.note.field.icon': 'Ikona',
  'plan.note.tab.write': 'Psaní',
  'plan.note.tab.preview': 'Náhled',
  'plan.note.previewEmpty': 'Zatím není co zobrazit v náhledu',
  'plan.note.save': 'Uložit poznámku',
  'plan.note.cancel': 'Zrušit',
  'plan.note.confirmDelete': 'Smazat tuto poznámku?',
  'plan.note.confirmDeleteBody':
    'Poznámka i její podrobnosti z tohoto dne zmizí.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Poznámka přidána',
  'plan.note.toast.updated': 'Poznámka uložena',
  'plan.note.toast.deleted': 'Poznámka smazána',
  'plan.note.error.save': 'Poznámku se nepodařilo uložit',
  'plan.note.error.delete': 'Poznámku se nepodařilo smazat',
  'plan.note.error.retry': 'Zkuste to za chvíli znovu.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Připomínka',
  'plan.note.icon.clock': 'Čas',
  'plan.note.icon.flashlight': 'Baterka',
  'plan.note.icon.footprints': 'Procházka',
  'plan.note.icon.info': 'Informace',
  'plan.note.icon.luggage': 'Zavazadla',
  'plan.note.icon.package': 'Balíček',
  'plan.note.icon.ticket': 'Vstupenky',
  'plan.note.icon.trainFront': 'Vlak',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Poznámka',
  'plan.note.icon.utensils': 'Jídlo',
  'plan.note.icon.bus': 'Doprava',
  'plan.note.icon.bedDouble': 'Ubytování',
  'plan.note.icon.camera': 'Fotka',
  'plan.note.icon.mapPin': 'Místo',
  'plan.note.icon.wallet': 'Peníze',
  'plan.note.icon.umbrella': 'Déšť',
  'plan.note.icon.triangleAlert': 'Upozornění',
  'plan.transport.phase.flight.departing': 'Odlet',
  'plan.transport.phase.flight.travelling': 'Ve vzduchu',
  'plan.transport.phase.flight.arriving': 'Přistání',
  'plan.transport.phase.hire.departing': 'Převzetí',
  'plan.transport.phase.hire.travelling': 'V pronájmu',
  'plan.transport.phase.hire.arriving': 'Vrácení',
  'plan.transport.phase.journey.departing': 'Začátek',
  'plan.transport.phase.journey.travelling': 'Na cestě',
  'plan.transport.phase.journey.arriving': 'Konec',
  'plan.transport.label': 'Z {from} do {to}',
  'plan.transport.drag': 'Změnit pořadí: {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Společně',
  'collab.empty': 'Zatím nic nesdíleno',
  'collab.conversation': 'Konverzace',
  'collab.count.messages': {
    one: '{messages} zpráva',
    few: '{messages} zprávy',
    many: '{messages} zprávy',
    other: '{messages} zpráv',
  },
  'collab.count.notes': {
    one: '{notes} poznámka',
    few: '{notes} poznámky',
    many: '{notes} poznámky',
    other: '{notes} poznámek',
  },
  'collab.count.polls': {
    one: '{polls} anketa',
    few: '{polls} ankety',
    many: '{polls} ankety',
    other: '{polls} anket',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Rezervace',
  'book.empty': 'Zatím nic rezervováno',
  'book.count.bookings': {
    one: '{bookings} rezervace',
    few: '{bookings} rezervace',
    many: '{bookings} rezervace',
    other: '{bookings} rezervací',
  },
  'book.count.confirmed': {
    one: '{confirmed} potvrzená',
    few: '{confirmed} potvrzené',
    many: '{confirmed} potvrzené',
    other: '{confirmed} potvrzených',
  },
  'book.progressLabel': {
    one: '{confirmed} z {total} rezervace potvrzena',
    few: '{confirmed} z {total} rezervací potvrzeny',
    many: '{confirmed} z {total} rezervací potvrzeny',
    other: '{confirmed} z {total} rezervací potvrzeno',
  },
  'book.ofTotal': 'z {total}',
  'book.confirmed': 'Potvrzené',
  'book.awaiting': 'Čeká na potvrzení',
  'book.nothingHanging': 'Nic nevisí',
  'book.chase': 'Vyřeš to před odletem',
  'book.committed': 'Závazky',
  'book.committedCaption': 'Ze všech rezervací této cesty',
  'book.onItinerary': 'V programu',
  'book.pinnedCaption': 'Připnuto ke dni programu',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Přesuny',
  'transports.empty': 'Zatím nic zaznamenáno',
  'transports.count.transports': {
    one: '{transports} přesun',
    few: '{transports} přesuny',
    many: '{transports} přesunu',
    other: '{transports} přesunů',
  },
  'transports.distance': 'Ujetá vzdálenost',
  'transports.equator': '≈ {times}× kolem rovníku',
  'transports.noGrouping': 'Zatím nic seskupeno',
  'transports.mostly': 'převážně {mode}',
  'transports.confirmed': 'Potvrzeno',
  'transports.stillPending': {
    one: '{pending} stále čeká',
    few: '{pending} stále čekají',
    many: '{pending} stále čeká',
    other: '{pending} stále čeká',
  },
  'transports.spent': 'Utraceno za cestování',
  'transports.noPrices': 'Žádné ceny nezaznamenány',
  'transports.priced': {
    one: 'napříč {priced} oceněným přesunem',
    few: 'napříč {priced} oceněnými přesuny',
    many: 'napříč {priced} oceněnými přesuny',
    other: 'napříč {priced} oceněnými přesuny',
  },
  'people.title': 'Lidé',
  'people.description': 'Kdo je na této cestě a kdo ji může najít',
  'people.members.title': 'Na této cestě',
  'people.members.empty': 'Nikdo z této cesty už není v tomto prostoru',
  'people.role.label': 'Oprávnění',
  'people.role.owner': 'Vlastník',
  'people.role.editor': 'Může upravovat',
  'people.role.viewer': 'Může prohlížet',
  'people.you': 'Vy',
  'people.owner.hint': 'Cesta si vždy ponechá aspoň jednoho vlastníka',
  'people.remove.action': 'Odebrat {name} z této cesty',
  'people.remove.title': 'Odebrat {name} z této cesty?',
  'people.remove.body':
    'Okamžitě ztratí přístup k programu. To, co přidal, na cestě zůstane.',
  'people.remove.confirm': 'Odebrat',
  'people.leave.action': 'Opustit tuto cestu',
  'people.leave.title': 'Opustit tuto cestu?',
  'people.leave.body':
    'Ztratíte přístup k programu, dokud vás někdo z cesty nepřidá zpět.',
  'people.leave.confirm': 'Opustit',
  'people.cancel': 'Zrušit',
  'people.invite.title': 'Přidat někoho',
  'people.invite.placeholder': 'Hledejte lidi v tomto prostoru',
  'people.invite.action': 'Přidat na cestu',
  'people.invite.role': 'Připojí se jako',
  'people.invite.empty': 'Všichni v tomto prostoru už na této cestě jsou',
  'people.invite.emptyHint':
    'Nejdřív se do prostoru připojí někdo nový, v Nastavení',
  'people.visibility.title': 'Kdo může tuto cestu najít',
  'people.visibility.switch': 'Viditelné pro všechny v prostoru',
  'people.visibility.private': 'Tuto cestu vidí jen lidé uvedení zde',
  'people.visibility.organization':
    'Tuto cestu může otevřít kdokoli v tomto prostoru',
  'people.visibility.public': 'Tato cesta je sdílená veřejným odkazem',
  'people.error.lastOwner':
    'Cesta si ponechá aspoň jednoho vlastníka. Nejdřív udělejte vlastníkem někoho jiného.',
  'people.error.notInWorkspace': 'Tento člověk není v tomto prostoru',
  'people.error.alreadyOnTrip': 'Tento člověk už na této cestě je',
  'people.guests.title': 'Cestují s tebou',
  'people.guests.description': 'Lidé na tomto výletě, kteří nemají účet',
  'people.guests.empty': 'Zatím nikdo',
  'people.guests.emptyHint':
    'Host je někdo, kdo s tebou cestuje a nepotřebuje účet. Přidej ho podle jména.',
  'people.guest.badge': 'Host',
  'people.guest.add.label': 'Jméno',
  'people.guest.add.placeholder': 'Tereza',
  'people.guest.add.action': 'Přidat hosta',
  'people.guest.rename.action': 'Přejmenovat: {name}',
  'people.guest.rename.title': 'Přejmenovat: {name}',
  'people.guest.rename.confirm': 'Přejmenovat',
  'people.guest.remove.action': 'Odebrat {name} z tohoto výletu',
  'people.guest.remove.title': 'Odebrat {name} z tohoto výletu?',
  'people.guest.remove.body': 'Host zmizí. Nic jiného se na výletě nezmění.',
  'people.guest.remove.confirm': 'Odebrat',
  'people.guest.merge.action': '{name} je teď…',
  'people.guest.merge.title': '{name} je teď jedním z lidí na tomto výletě',
  'people.guest.merge.body':
    'Vše, co je přiřazeno k {name}, přejde na vybranou osobu a host zmizí. Tuto akci nelze vrátit.',
  'people.guest.merge.inherits':
    '{member} převezme vše, co je přiřazeno k {name}.',
  'people.guest.merge.placeholder': 'Vyber někoho z tohoto výletu',
  'people.guest.merge.confirm': 'Sloučit',
  'people.guest.merge.done': '{name} je teď {member}',
  'people.guest.merge.nothingMoved': 'Zatím k němu nebylo nic přiřazeno',
  'people.error.guestNameTaken': 'Host se jménem {name} už na tomto výletě je',
  'people.error.guestLimit':
    'Výlet pojme nejvýše {limit} hostů, protože delší seznam znepřehledňuje výběr účastníků i rozdělení nákladů',
  'people.error.guestMergeTarget': 'Vyber někoho, kdo už je na tomto výletě',
} satisfies TranslationOf<typeof En>

export default messages
