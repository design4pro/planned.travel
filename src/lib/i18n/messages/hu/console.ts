/**
 * Minden, amit a platformkonzol mond, magyarul.
 *
 * A `../en/console.ts` alapján írva (`docs/SPEC.md` §9). Az angol fájl a séma:
 * a `TranslationOf<typeof En>` fordítási hibává teszi a hiányzó vagy kitalált kulcsot, a
 * `__tests__/parity.test.ts` pedig ellenőrzi a helyőrzőket, a többes számú ágakat és azt, hogy itt
 * ne maradjon semmi angolul.
 *
 * **Megszólítás.** Végig az udvarias harmadik személy («Ön»), mint a magyar katalógus többi
 * részében.
 *
 * **Többes szám.** Az `Intl.PluralRules('hu')` `one` és `other` ágat kér; a magyar a szám után
 * egyes számot használ, így mindkét ágban egyes számban áll a főnév.
 *
 * **Két szerepskála, amely soha nem keveredik** (§5). A platformon: rendszergazda, gondozó,
 * felhasználó. A munkaterületen: tulajdonos, rendszergazda, tag. Ugyanaz a szó mindkettőben
 * előfordul, ezért a különbséget a körülötte álló mondat hordozza.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ---------------------------------------------------------- szakaszok -- */

  'nav.label': 'A konzol szakaszai',
  'nav.overview': 'Áttekintés',
  'nav.overview.description': 'A platform egy pillantásra',
  'nav.accounts': 'Fiókok',
  'nav.accounts.description': 'Szerepek, felfüggesztések és munkamenetek',
  'nav.runs': 'Ügynökfuttatások',
  'nav.runs.description': 'Min dolgozik a sandcastle-flotta',

  /* -------------------------------------------------------------- burok -- */

  'shell.eyebrow': 'A platform',
  'shell.title': 'Konzol',
  'shell.description':
    'Maga a termék — fiókok, jogosultságok és a közös katalógus',
  'shell.signedInAs': 'Bejelentkezve mint',
  'shell.error.title': 'A konzol nem töltődött be',
  'shell.notFound.title': 'Nincs ilyen fiók',
  'shell.notFound.body':
    'A platformon semmi sem viseli ezt az azonosítót. Lehet, hogy a fiókot törölték, mióta a hivatkozás elkészült, vagy elgépelték a címet.',
  'shell.allAccounts': 'Minden fiók',
  'shell.overview': 'A konzol áttekintése',

  'failure.fallback':
    'A művelet nem ment át. Próbálja újra egy pillanat múlva.',

  /* ---------------------------------------------------------- áttekintés -- */

  'overview.error.title': 'Az áttekintés nem töltődött be',
  'overview.standing.title': 'Az Ön jogosultságai a platformon',
  'overview.standing.body':
    'A fiókok, a munkamenetek és a más nevében való eljárás a platform rendszergazdájáé, ezért a konzol a katalógust mutatja meg Önnek, és semmi mást.',
  'overview.stat.accounts': 'Fiókok',
  'overview.stat.accounts.caption': {
    one: 'Egyikük platformszerepet visel',
    other: 'Közülük {staff} visel platformszerepet',
  },
  'overview.stat.admins': 'Rendszergazdák',
  'overview.stat.admins.caption':
    'Teljes hatalom a fiókok és a munkamenetek felett',
  'overview.stat.curators': 'Gondozók',
  'overview.stat.curators.caption': 'Csak a katalógus — soha nem a fiókok',
  'overview.stat.suspended': 'Felfüggesztve',
  'overview.stat.suspended.none': 'Senki sincs kizárva',
  'overview.stat.suspended.some':
    'Mindenhonnan kijelentkeztetve, amíg a felfüggesztést fel nem oldják',
  'overview.stat.suspended.review': 'Nézze meg őket',
  'overview.newest.label': 'Legújabb fiókok',
  'overview.newest.empty.title': 'Még nincs fiók',
  'overview.newest.empty.body': 'Az első regisztráló itt jelenik meg.',
  'overview.catalogue.label': 'Katalógus állapot szerint',
  'overview.catalogue.empty.title': 'A közös katalógus még nincs nyitva',
  'overview.catalogue.empty.body':
    'Amint a betöltősor elkészül, ez a panel a közös katalógus minden helyét megszámolja piszkozatként, ellenőrzés alattiként vagy közzétettként — és minden szám megnyitja a mögötte álló listát.',
  'overview.scraping.label': 'Begyűjtő futtatások',
  'overview.scraping.empty.title': 'Egyetlen forrás sem futott le',
  'overview.scraping.empty.body':
    'A forrásokat hetente gyűjtjük be. Amikor az első futtatás véget ér, itt lesz az utolsó öt azzal együtt, hogy melyik mit vett át, változtatott és utasított el.',

  /* ------------------------------------------------------- a szerepskála -- */

  'role.admin': 'Rendszergazda',
  'role.admin.summary':
    'Teljes hatalom a platformon: fiókok, szerepek, felfüggesztések, munkamenetek és a más nevében való eljárás.',
  'role.admin.holds.accounts': 'Fiókot létrehozni és platformszerepet adni',
  'role.admin.holds.bans': 'Fiókot felfüggeszteni és felfüggesztést feloldani',
  'role.admin.holds.sessions': 'Munkamenetet visszavonni és jelszót beállítani',
  'role.admin.holds.impersonate': 'Tizenöt percig egy fiók nevében eljárni',
  'role.admin.holds.curation': 'Mindent, amit egy gondozó megtehet',
  'role.admin.withheld.admins':
    'Egy másik platform-rendszergazda nevében eljárni',
  'role.curator': 'Gondozó',
  'role.curator.summary':
    'A katalógus, a gyűjtemények, a források és a megosztott hivatkozások felügyelete. Semmi, ami a fiókokat érinti.',
  'role.curator.holds.places': 'Katalógushelyeket olvasni, írni és közzétenni',
  'role.curator.holds.packs': 'Helygyűjteményeket olvasni, írni és közzétenni',
  'role.curator.holds.sources': 'Katalógusforrásokat olvasni és futtatni',
  'role.curator.holds.shares':
    'Megosztott hivatkozásokat átnézni és visszavonni',
  'role.curator.withheld.accounts':
    'Bármit, ami egy fiókot vagy egy munkamenetet érint',
  'role.curator.withheld.tokens': 'Gépi hitelesítőt kiadni vagy visszavonni',
  'role.user': 'Felhasználó',
  'role.user.summary':
    'Semmilyen jogosultság a platformon. Ez majdnem mindenki.',
  'role.user.withheld.everything':
    'A platform minden jogosultsága, kivétel nélkül',

  /* -------------------------------------------------------------- egy fiók -- */

  'identity.you': 'Ez Ön',
  'status.active': 'Aktív',
  'status.suspended': 'Felfüggesztve',
  'status.permanent': 'Határozatlan időre',
  'status.until': '{date} napjáig',
  'status.unverified': 'Nincs megerősítve',
  'device.on': '{browser} ezen: {platform}',
  'device.unrecognised': 'Ismeretlen eszköz',

  /* ---------------------------------------------------------- fióklista -- */

  'users.error.title': 'A fióklista nem töltődött be',
  'users.total': 'összesen {total}',
  'users.loading': 'A fiókok betöltése folyik',
  'users.table.label': 'A platform fiókjai',
  'users.search.label': 'Fiókok keresése',
  'users.search.email': 'Keresés az e-mail-címek között',
  'users.search.name': 'Keresés a nevek között',
  'users.search.column': 'Melyik oszlopban keressen',
  'users.search.submit': 'Keresés',
  'users.field.email': 'E-mail',
  'users.field.name': 'Név',
  'users.filter.role.label': 'Szűrés platformszerep szerint',
  'users.filter.role.any': 'Bármelyik szerep',
  'users.filter.role.admin': 'Rendszergazdák',
  'users.filter.role.curator': 'Gondozók',
  'users.filter.status.label': 'Szűrés a fiók állapota szerint',
  'users.filter.status.any': 'Bármelyik állapot',
  'users.filter.hint':
    'Szűkítsen szerep vagy állapot szerint — egyszerre csak az egyikkel.',
  'users.column.account': 'Fiók',
  'users.column.role': 'Platformszerep',
  'users.column.status': 'Állapot',
  'users.column.joined': 'Csatlakozott',
  'users.column.actions': 'Műveletek',
  'users.joined': 'Csatlakozott: {date}',
  'users.pastEnd.title': 'Ez az oldal a végén túl van',
  'users.pastEnd.body': {
    one: 'Ebben a nézetben egy fiók van, és az 1. oldal az egyetlen, amije van.',
    other:
      'Ebben a nézetben {total} fiók van, ami {pages}. A(z) {page}. oldal ezen túl esik.',
  },
  'users.pastEnd.pages': {
    one: 'egyetlen oldal',
    other: '{pages} oldal',
  },
  'users.pastEnd.back': 'Vissza az első oldalra',
  'users.empty.filtered.title': 'Semmi sem illik ezekre a szűrőkre',
  'users.empty.filtered.body':
    'A platformon egyetlen fiók sem felel meg ennek a keresésnek. Tágítsa ki, vagy törölje a szűrőket, hogy mindenkit lásson.',
  'users.empty.title': 'Nincs megjeleníthető fiók',
  'users.empty.body':
    'Ez a nézet üres. Semmi sincs kiszűrve, tehát nincs mit tágítani rajta.',

  /* ------------------------------------------------------------ fiókoldal -- */

  'account.error.title': 'Ez a fiók nem töltődött be',
  'account.loading': 'A fiók betöltése folyik',
  'account.meta.lastChange': 'Utolsó változás',
  'account.meta.id': 'A fiók azonosítója',
  'account.banned.title': 'Ez a fiók fel van függesztve',
  'account.banned.noReason': 'A felfüggesztéshez nem rögzítettek indokot.',
  'account.banned.permanent':
    ' Addig érvényben marad, amíg egy rendszergazda fel nem oldja.',
  'account.banned.until': ' Magától feloldódik ekkor: {date}.',
  'account.banned.untilUnknown': 'a lejárta napján',
  'account.authority.label': 'Jogosultságok a platformon',
  'account.authority.may': 'Megteheti',
  'account.authority.mayNot': 'Nem teheti meg',
  'account.authority.none': 'Semmit a platformon.',
  'account.workspaces.label': 'Munkaterületek',
  'account.workspaces.truncated':
    'Ez a fiók több munkaterülethez tartozik, mint az itt felsorolt {listed}.',
  'account.workspaces.empty.title': 'Egyetlen munkaterületen sincs',
  'account.workspaces.empty.body':
    'Ez a fiók még egyetlen munkaterülethez sem tartozik. Az első bejelentkezéskor létrejön egy, és minden olyan, amelyikbe meghívják, itt jelenik meg.',
  'account.workspaces.column.workspace': 'Munkaterület',
  'account.workspaces.column.role': 'Szerep',
  'account.workspaces.column.plan': 'Csomag',
  'account.subscription.label': 'Előfizetés',
  'account.subscription.free.title': 'Az ingyenes csomagon',
  'account.subscription.free.body':
    'Az a munkaterület, amelyet ez a fiók birtokol, soha nem járt a pénztárnál, tehát nincs előfizetési bejegyzése, és az ingyenes csomag keretei között fut.',
  'account.subscription.none.title': 'Ennek a fióknak semmit sem számláznak',
  'account.subscription.none.body':
    'Ez a fiók egyetlen munkaterületet sem birtokol. Más munkaterületének tagjaként nem Ő az, akinek az a munkaterület számláz, tehát itt nincs mit összeszedni.',
  'account.subscription.endsAtClose': 'Az időszak végén jár le',
  'account.subscription.seats': 'Helyek',
  'account.subscription.seatsValue': '{used} / {limit}',
  'account.subscription.ends': 'Vége',
  'account.subscription.renews': 'Megújul',
  'account.sessions.label': 'Élő munkamenetek',
  'account.sessions.truncated':
    'Ez a fiók több munkamenetet tart, mint amennyit egy hívás felsorol. A biztonság kedvéért vonja vissza az összes munkamenetet a műveletek menüjéből.',
  'account.sessions.empty.title': 'Mindenhonnan kijelentkezve',
  'account.sessions.empty.body':
    'Ennek a fióknak nincs le nem járt munkamenete. Abban a pillanatban megjelenik itt, amint újra bejelentkezik.',
  'account.sessions.column.device': 'Eszköz',
  'account.sessions.column.address': 'Cím',
  'account.sessions.column.started': 'Kezdet',
  'account.sessions.column.expires': 'Lejár',
  'account.sessions.impersonated': 'A fiók nevében való eljárásból született',
  'account.sessions.noAddress': 'Nincs rögzítve',
  'account.sessions.noAddressLong': 'A cím nincs rögzítve',
  'account.sessions.when': 'Kezdet: {started} · lejár: {expires}',
  'account.audit.label': 'Naplózási előzmények',
  'account.audit.truncated':
    'A napló ennél több bejegyzést tart. A platform naplója csak bővül, és négyszáz napig őrizzük.',
  'account.audit.empty.title': 'Ezzel a fiókkal még senki sem tett semmit',
  'account.audit.empty.body':
    'Minden szerepváltás, felfüggesztés, jelszóbeállítás, munkamenet-visszavonás és a fiók nevében való eljárás ide íródik, annak a nevével, aki tette. Ehhez még senki sem nyúlt.',

  /* ------------------------------------------- a munkaterület skálája -- */

  'workspace.role.owner': 'Tulajdonos',
  'workspace.role.admin': 'Rendszergazda',
  'workspace.role.member': 'Tag',
  'plan.free': 'Ingyenes',
  'plan.starter': 'Kezdő',
  'plan.pro': 'Profi',
  'plan.business': 'Vállalati',
  'subscription.trialing': 'Próbaidőszak',
  'subscription.active': 'Aktív',
  'subscription.pastDue': 'Fizetési késedelem',
  'subscription.canceled': 'Lemondva',
  'subscription.incomplete': 'Hiányos',
  'subscription.expired': 'Lejárt',
  'subscription.unpaid': 'Kifizetetlen',
  'subscription.paused': 'Szüneteltetve',

  /* ------------------------------------------------------------ napló -- */

  'audit.action.created': 'Fiók létrehozva',
  'audit.action.updated': 'A fiók adatai megváltoztak',
  'audit.action.roleChanged': 'Platformszerep megváltozott',
  'audit.action.banned': 'Fiók felfüggesztve',
  'audit.action.unbanned': 'Felfüggesztés feloldva',
  'audit.action.deleted': 'Fiók törölve',
  'audit.action.passwordSet': 'A jelszót rendszergazda állította be',
  'audit.action.emailSet': 'E-mail-cím megváltozott',
  'audit.action.impersonationStarted':
    'Elkezdődött a fiók nevében való eljárás',
  'audit.action.impersonationEnded': 'Véget ért a fiók nevében való eljárás',
  'audit.action.sessionRevoked': 'Egy munkamenetet visszavontak',
  'audit.action.sessionRevokedAll': 'Minden munkamenetet visszavontak',
  'audit.actor.system': 'Maga a platform',
  'audit.actor.system.detail': 'automatikus',
  'audit.actor.agent': 'Gépi hitelesítő',
  'audit.actor.agent.detail': 'MCP-token',
  'audit.actor.deleted': 'Egy törölt fiók',
  'audit.actorBadge': 'Akkor: {role}',
  'audit.field.name': 'Név',
  'audit.field.email': 'E-mail-cím',
  'audit.field.emailVerified': 'E-mail megerősítve',
  'audit.field.role': 'Platformszerep',
  'audit.field.banned': 'Felfüggesztve',
  'audit.field.banReason': 'Indok',
  'audit.field.banExpiresAt': 'A felfüggesztés vége',
  'audit.field.revoked': 'Lezárt munkamenetek',
  'audit.field.impersonating': 'Így jár el',
  'audit.field.impersonatedBy': 'Eljárt helyette',
  'audit.field.expiresAt': 'A munkamenet lejár',
  'audit.field.targetRole': 'Az ő platformszerepe',
  'audit.field.sessionId': 'Munkamenet',
  'audit.value.yes': 'igen',
  'audit.value.no': 'nem',
  'audit.value.cleared': 'kiürítve',
  'audit.became': 'erre változott:',

  /* ----------------------------------------------------- párbeszédablakok -- */

  'dialog.cancel': 'Mégse',

  'create.button': 'Új fiók',
  'create.title': 'Fiók létrehozása',
  'create.body':
    'A címet nem ellenőrizzük, és nem megy ki levél — a jelszót Ön adja át.',
  'create.confirm': 'Fiók létrehozása',
  'create.name.placeholder': 'Kovács Anna',
  'create.email': 'E-mail-cím',
  'create.email.placeholder': 'anna@planned.travel',
  'create.password': 'Jelszó',
  'create.password.hint':
    'Elég hosszú ahhoz, hogy mondat legyen. A fiók utána megváltoztathatja.',
  'create.done': 'Fiók létrehozva',
  'create.done.body': '{email} beléphet az Ön által beállított jelszóval.',

  'action.menu.label': 'Műveletek: {name}',
  'action.group.account': 'Fiók',
  'action.group.credentials': 'Hitelesítők',

  'action.role.item': 'Platformszerep módosítása',
  'action.role.self':
    'A saját fiókján nem — ha lefokozza magát, a platform rendszergazda nélkül maradhat.',
  'action.role.body':
    'Amit {name} magán a platformon megtehet. A munkaterületi tagság külön szókészlet, és nem mozdul vele.',
  'action.role.confirm': 'Szerep mentése',
  'action.role.current': 'Jelenlegi',
  'action.role.done': 'A platformszerep frissült',
  'action.role.done.body':
    '{name} mostantól ezt a szerepet viseli a platformon: {role}.',

  'action.impersonate.item': 'Eljárás a fiók nevében',
  'action.impersonate.self': 'Nincs kivé válni — ez a saját fiókja.',
  'action.impersonate.banned':
    'A fiók fel van függesztve, tehát nincs munkamenete, amelyet magára ölthetne.',
  'action.impersonate.admin':
    'A platformon egyetlen szerep sem járhat el rendszergazda nevében, az Öné sem.',
  'action.impersonate.title': 'Eljárás mint {name}',
  'action.impersonate.body':
    'Tizenöt percig pontosan úgy látja a terméket, ahogyan ez a fiók látja.',
  'action.impersonate.confirm': 'Kezdés',
  'action.impersonate.note.bar':
    'Egy figyelmeztető sáv minden képernyőn ott marad, amíg be nem fejezi, és nem lehet bezárni.',
  'action.impersonate.note.platform':
    'A platform műveletei nem érhetők el, amíg más nevében jár el — a konzol sem.',
  'action.impersonate.note.audit':
    'A kezdet és a vég egyaránt bekerül a platform naplójába, az Ön nevével.',

  'action.password.item': 'Jelszó beállítása',
  'action.password.title': 'Jelszó beállítása {name} számára',
  'action.password.body':
    'Ezzel hozhat vissza egy kizárt fiókot, vagy zárhat ki egy támadót egy feltört fiókból.',
  'action.password.confirm': 'Jelszó beállítása',
  'action.password.field': 'Új jelszó',
  'action.password.hint.self':
    'A beállításkor minden munkamenet véget ér — az Öné is.',
  'action.password.hint': 'A beállításkor a fiók minden munkamenete véget ér.',
  'action.password.done': 'A jelszó beállítva',
  'action.password.done.body':
    '{name} minden eszközről ki lett jelentkeztetve.',

  'action.sessions.item': 'Minden munkamenet visszavonása',
  'action.sessions.body.self':
    'Ez minden eszközről kijelentkezteti Önt, arról is, amelyiken ezt olvassa.',
  'action.sessions.body':
    '{name} minden eszközről kijelentkezik, és újra be kell lépnie.',
  'action.sessions.confirm': 'Munkamenetek visszavonása',
  'action.sessions.done': 'A munkamenetek visszavonva',
  'action.sessions.done.body': {
    one: 'Egy munkamenet zárult le.',
    other: '{revoked} munkamenet zárult le.',
  },

  'action.ban.item': 'A fiók felfüggesztése',
  'action.ban.self':
    'A saját fiókján nem — ha magát függeszti fel, elveszi a saját visszaútját.',
  'action.ban.title': '{name} felfüggesztése',
  'action.ban.body':
    'Minden munkamenet azonnal véget ér, és a fiók nem tud újra belépni, amíg a felfüggesztést fel nem oldják, vagy le nem jár.',
  'action.ban.confirm': 'Fiók felfüggesztése',
  'action.ban.reason': 'Indok',
  'action.ban.reason.hint':
    'Tizenhárom hónapig a platform naplójában marad, és rendszergazdán kívül senkinek sem mutatjuk meg.',
  'action.ban.reason.placeholder':
    'Ismételt visszaélési bejelentések három munkaterületről',
  'action.ban.duration': 'Időtartam',
  'action.ban.duration.label': 'A felfüggesztés időtartama',
  'action.ban.duration.permanent.body':
    'Addig érvényben marad, amíg egy rendszergazda szándékosan fel nem oldja.',
  'action.ban.duration.day': '24 óra',
  'action.ban.duration.day.body':
    'Elég hosszú a megszakításhoz, elég rövid ahhoz, hogy beavatkozás maradjon.',
  'action.ban.duration.week': '7 nap',
  'action.ban.duration.week.body': 'Egy hét egy panasz megválaszolására.',
  'action.ban.duration.month': '30 nap',
  'action.ban.duration.month.body': 'Egy hónap kikényszerített csend.',
  'action.ban.duration.quarter': '90 nap',
  'action.ban.duration.quarter.body':
    'A leghosszabb, amit a konzol kínál. Azon túl függessze fel határozatlan időre.',
  'action.ban.done': 'A fiók felfüggesztve',
  'action.ban.done.body':
    '{name} mindenhonnan ki lett jelentkeztetve, és nem tud újra belépni.',

  'action.unban.item': 'A felfüggesztés feloldása',
  'action.unban.title': '{name} felfüggesztésének feloldása',
  'action.unban.body':
    'A fiók a következő próbálkozástól kezdve újra be tud lépni. Egyetlen korábbi munkamenet sem áll helyre.',
  'action.unban.confirm': 'Felfüggesztés feloldása',
  'action.unban.done': 'A felfüggesztés feloldva',
  'action.unban.done.body':
    '{name} újra be tud lépni. Egyetlen munkamenet sem állt helyre.',

  'action.delete.item': 'A fiók törlése',
  'action.delete.self': 'A saját fiókján nem — onnan nincs visszaút.',
  'action.delete.title': '{name} törlése',
  'action.delete.body':
    'A fiókot, a munkameneteit és minden hozzá kapcsolt hitelesítőt eltávolítjuk. Ezt nem lehet visszavonni.',
  'action.delete.confirm': 'Fiók törlése',
  'action.delete.note':
    'A munkaterületi tartalom, amelyet ez a személy létrehozott, annál a munkaterületnél marad, amelyik birtokolja. Ha törlés helyett felfüggeszti a fiókot, a nyom megmarad, a hozzáférés viszont elvész.',
  'action.delete.done': 'A fiók törölve',
  'action.delete.done.body':
    '{name} és minden, ami a fiókhoz kapcsolódott, eltűnt.',

  'session.revoke.label': 'A munkamenet lezárása ezen: {device}',
  'session.revoke.title': 'Ennek a munkamenetnek a lezárása',
  'session.revoke.body':
    'A(z) {device} eszköznek a következő kérésnél újra be kell lépnie. Ha ez az a munkamenet, amelyikben ezt olvassa, Önt is kijelentkezteti.',
  'session.revoke.confirm': 'Munkamenet lezárása',
  'session.revoke.done': 'A munkamenet lezárva',
  'session.revoke.done.body':
    'Az eszköznek a következő kérésnél újra be kell lépnie.',

  /* -------------------------------------------------- ügynökfuttatások -- */

  'runs.error.title': 'A futtatásnyilvántartás nem válaszolt',
  'runs.origin.local': 'Helyben',
  'runs.origin.githubActions': 'GitHub-műveletek',
  'runs.stat.live': 'Élő futtatások',
  'runs.stat.live.none': 'Éppen semmi sem épül',
  'runs.stat.live.some': 'Szívverés egy ötperces bérlet ellenében',
  'runs.stat.issues': 'Lefoglalt bejelentések',
  'runs.stat.issues.caption':
    'Futtatásonként egyhez bérelve, az ősökkel és albejelentésekkel együtt',
  'runs.stat.orphans': 'Árva ágak',
  'runs.stat.orphans.none': 'Semmilyen munka nem hever gazdátlanul',
  'runs.stat.orphans.some':
    'Egy megállt futtatás commitjai, örökbefogadásra várva',
  'runs.live.empty.title': 'Egyetlen futtatás sincs bejegyezve',
  'runs.live.empty.body':
    'Egy futtatás abban a pillanatban jelenik meg itt, amint bejegyzi magát — erről a gépről, egy másikról vagy egy GitHub-futtatóról —, a bejelentésekkel együtt, amelyeket lefoglalt.',
  'runs.holds.nothing': 'semmit sem tart',
  'runs.holds': 'ezt tartja: {issues}',
  'runs.uptime': '{elapsed} óta fut · {lease}',
  'runs.lease.expired': 'lejárt',
  'runs.lease.left': 'még {elapsed}',
  'runs.wip.label': 'Folyamatban lévő munka',
  'runs.wip.empty.title': 'Egyetlen ág sem hordoz munkát',
  'runs.wip.empty.body':
    'A futtatás rögzíti az ágát, amint commitjai vannak rajta, hogy ha elpusztul, a következő, amelyik a bejelentést lefoglalja, ezt a munkát kapja meg ahelyett, hogy elölről kezdené.',
  'runs.wip.orphaned': 'Árva',
  'runs.wip.meta': {
    one: '{commits} commit · {elapsed} ezelőtt',
    other: '{commits} commit · {elapsed} ezelőtt',
  },
  'runs.recent.label': 'Nemrég befejezve',
  'runs.recent.empty.title': 'Még egyetlen futtatás sem fejeződött be',
  'runs.recent.empty.body':
    'Az utolsó ötven futtatás marad meg itt azzal együtt, hogy melyik hogyan ért véget.',
  'runs.ago': '{elapsed} ezelőtt',
  'runs.notCoordinator.title': 'Ez a telepítés nem hangolja össze a flottát',
  'runs.notCoordinator.body':
    'A futtatásnyilvántartás kizárólag a próbakörnyezethez van kötve, és ez szándékos: egy második nyilvántartás azt eredményezné, hogy két flotta is azt hiszi, ő tartja a várólistát — épp azt, aminek megakadályozására létezik. A flottát a próbakörnyezetben olvassa.',
  'nav.providers': 'Szolgáltatók',
  'nav.providers.description': 'Kimenő hívások és a plafonjaik',
  'providers.error.title': 'A szolgáltatói mérőket nem sikerült beolvasni',
  'providers.list.label': 'Szolgáltatások',
  'providers.status.planned': 'Nincs bekötve',
  'providers.status.planned.description':
    'Ezt a szolgáltatást még semmi sem hívja, így nincs mit számolni. Azért szerepel itt, hogy a plafon az első hívás előtt szülessen meg, ne az első számla után.',
  'providers.policy.allow': 'A plafon fölött is számláz',
  'providers.policy.block': 'A plafonnál elutasít',
  'providers.badge.blocked': {
    one: 'Egy hívás elutasítva',
    other: '{calls} hívás elutasítva',
  },
  'providers.limit.none': 'Nincs megbeszélt plafon · {used} ebben a hónapban',
  'providers.limit.value': '{used} / {limit}',
  'providers.limit.window.day': 'Ma',
  'providers.limit.window.month': 'Ebben a hónapban',
  'providers.measuring.none': 'Még nincs mérés',
  'providers.measuring.since': 'Mérés {date} óta',
  'providers.stat.calls': 'Hívások ebben a hónapban',
  'providers.stat.calls.caption': 'Az összes bekötött szolgáltatásban',
  'providers.stat.errors': 'Sikertelen hívások',
  'providers.stat.errors.caption':
    'Hívásnak is számítanak, mert a legtöbb szolgáltató kiszámlázza őket',
  'providers.stat.nearLimit': 'Plafon közelében',
  'providers.stat.nearLimit.caption':
    'A figyelmeztetési küszöb fölötti szolgáltatások',
  'providers.stat.blocked': 'Elutasított hívások',
  'providers.stat.blocked.none': 'Semmit sem utasítottunk el',
  'providers.stat.blocked.some': 'Plafon által visszautasított igény',
  'providers.forecast.label': 'Előrejelzés',
  'providers.forecast.provider': 'Szolgáltatás',
  'providers.forecast.monthEnd': 'Hónap végéig',
  'providers.forecast.runRate': 'Havonta ezzel a tempóval',
  'providers.forecast.perWorkspace': 'Munkaterületenként havonta',
  'providers.forecast.noWorkspaceTraffic':
    'Nincs munkaterületi forgalom, amiből átlagot lehetne venni',
  'providers.forecast.window': {
    one: 'Egy óra mérésből vetítve.',
    other: '{hours} óra mérésből vetítve.',
  },
  'providers.forecast.tooEarly': {
    one: 'Eddig csak egy óra mérés van — kevés az előrejelzéshez. Egy napnál kevesebbet egy hónapra nyújtani számtan, nem előrejelzés.',
    other:
      'Eddig csak {hours} óra mérés van — kevés az előrejelzéshez. Egy napnál kevesebbet egy hónapra nyújtani számtan, nem előrejelzés.',
  },
  'providers.forecast.atWorkspaces': 'Hány munkaterületnél',
  'providers.forecast.callsEach': 'Hívás munkaterületenként havonta',
  'providers.forecast.projected': 'Körülbelül {calls} hívás havonta.',
  'providers.workspaces.label': 'Legaktívabb munkaterületek',
  'providers.workspaces.platform': 'Platform (munkaterület nélkül)',
  'providers.workspaces.empty.title': 'Még semmi sincs hozzárendelve',
  'providers.workspaces.empty.description':
    'A munkaterületért indított hívás arra a munkaterületre kerül. Az ütemezett munka és a platform levelei egyikhez sem tartoznak, azokat külön számoljuk.',
  'providers.readOnly':
    'Ezeket a mérőket olvashatod, de plafont nem mozgathatsz. A korlát vagy a hozzá tartozó szabály módosításához provider:configure jogosultság kell.',
  'providers.status.planned.agreed.month':
    'Megbeszélt plafon: havi {limit}. Az első hívástól él, amint van kliens.',
  'providers.status.planned.agreed.day':
    'Megbeszélt plafon: napi {limit}. Az első hívástól él, amint van kliens.',
  'providers.edit.button': 'Szerkesztés',
  'providers.edit.title': '{provider} plafonja',
  'providers.edit.body':
    'Mennyit vállalt ez a telepítés a szolgáltatónál, és mi történik, ha elfogy.',
  'providers.edit.confirm': 'Plafon mentése',
  'providers.edit.done': '{provider} plafonja elmentve',
  'providers.edit.label': 'Név',
  'providers.edit.ceiling': 'Benne foglalt hívások',
  'providers.edit.ceiling.hint':
    'Hagyd üresen, ha nincs megbeszélt plafon. Az üres és a nulla nem ugyanaz: a nulla „elutasítás” mellett minden hívást elzár.',
  'providers.edit.ceiling.placeholder': 'Nincs plafon',
  'providers.edit.window': 'Mérve',
  'providers.edit.window.month': 'Naptári hónapra',
  'providers.edit.window.month.body': 'A benne foglalt keret szokásos alakja.',
  'providers.edit.window.day': 'Napra',
  'providers.edit.window.day.body':
    'Egyes szolgáltatók naponta mérnek — a Geoapify ingyenes csomagja napi 3000 kredit.',
  'providers.edit.policy': 'A plafonnál',
  'providers.edit.policy.allow': 'Hívj tovább és fizess',
  'providers.edit.policy.allow.body':
    'A hívások a plafon fölött is mennek, a konzol pedig figyelmeztet. Semmi nem áll le.',
  'providers.edit.policy.block': 'Utasítsd el a további hívásokat',
  'providers.edit.policy.block.body':
    'A hívásokat elutasítjuk az ablak újraindulásáig. Ami ettől a szolgáltatótól függ, leáll — csak ott válaszd, ahol ez az olcsóbb hiba.',
  'providers.edit.policy.block.refused':
    'A {provider} nem utasítható el: nincs tartalék útja, így a hívások elzárása a funkciót állítaná le, nem a költséget fogná vissza. A csak figyelmeztető plafon továbbra is elérhető.',
  'providers.edit.warn': 'Figyelmeztetés (%)',
  'providers.edit.critical': 'Riasztás (%)',
  'providers.edit.thresholds.hint':
    'Hol vált a mérő borostyánra és pirosra. A figyelmeztetés nem lehet a riasztás fölött.',
} satisfies TranslationOf<typeof En>

export default messages
