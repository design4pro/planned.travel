/**
 * The trip tabs' own copy, in pl.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Liczba mnoga.** `one` · `few` · `many` · `other`; `other` to liczba dziesiętna.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  'notFound.title': 'Nie możemy znaleźć tej podróży',
  'notFound.body':
    'Nie ma jej wśród podróży, które możesz otworzyć w obecnym obszarze roboczym. Mogła zostać usunięta lub możesz nie mieć do niej dostępu.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Dodaj miejsce do tej podróży',
  'plan.editor.editTitle': 'Edytuj to miejsce',
  'plan.editor.createDescription':
    'Podaj nazwę teraz, a położenie później - niezaplanowane miejsce czeka w panelu miejsc, aż przypiszesz je do dnia.',
  'plan.editor.editDescription':
    'Zmiany dotyczą wszystkich wystąpień tego miejsca: mapy, każdego dnia i listy miejsc podróży.',
  'plan.editor.nameRequired': 'Miejsce musi mieć nazwę',
  'plan.editor.nameExample': 'np. Fushimi Inari Taisha',
  'plan.editor.city': 'Miasto',
  'plan.editor.cityExample': 'np. Kioto',
  'plan.editor.addressExample': 'np. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Czas na miejscu',
  'plan.editor.rating': 'Czy warto?',
  'plan.editor.latitude': 'Szerokość geograficzna',
  'plan.editor.longitude': 'Długość geograficzna',
  'plan.editor.positionHint':
    'Możesz też zamknąć okno i wskazać punkt na mapie.',
  'plan.editor.latitudeError': 'Od -90 do 90',
  'plan.editor.longitudeError': 'Od -180 do 180',
  'plan.editor.positionError': 'Położenie wymaga obu współrzędnych',
  'plan.editor.day': 'Przypisz do dnia',
  'plan.editor.dayHint':
    'Pozostaw puste, aby zachować miejsce w panelu miejsc.',
  'plan.editor.unplanned': 'Pozostaw bez planu',
  'plan.editor.dayNamed': 'Dzień {day} · {title}',
  'plan.editor.stopFallback': 'Ten przystanek',
  'plan.editor.dayNumber': 'Dzień {day}',
  'plan.editor.visited': 'Już odwiedzone',
  'plan.editor.visitedHint': 'Oznacza pinezkę znacznikiem wyboru.',
  'plan.editor.saving': 'Zapisywanie miejsca',
  'plan.editor.save': 'Zapisz zmiany',
  'plan.editor.noCategory': 'Bez kategorii',
  'plan.editor.arrive': 'Przyjazd',
  'plan.editor.leave': 'Wyjazd',
  'plan.editor.timeError': 'Wyjazd musi być później niż przyjazd',
  'plan.editor.booking': 'Rezerwacja',
  'plan.editor.note': 'Notatka do tego punktu',
  'plan.editor.noteExample': 'Przyjdź wcześnie - po 9:00 kolejka trwa godzinę.',
  'plan.editor.savingTimes': 'Zapisywanie godzin',
  'plan.editor.saveTimes': 'Zapisz',
  'plan.editor.duration0': 'Bez określonego czasu',
  'plan.editor.duration30': '30 minut',
  'plan.editor.duration45': '45 minut',
  'plan.editor.duration60': '1 godzina',
  'plan.editor.duration90': '1½ godziny',
  'plan.editor.duration120': '2 godziny',
  'plan.editor.duration180': '3 godziny',
  'plan.editor.duration240': 'Pół dnia',
  'plan.editor.duration480': 'Cały dzień',
  'plan.editor.rating0': 'Bez oceny',
  'plan.editor.rating1': '★ 1 - pomiń',
  'plan.editor.rating2': '★ 2 - jeśli starczy czasu',
  'plan.editor.rating3': '★ 3 - warto',
  'plan.editor.rating4': '★ 4 - bardzo dobre',
  'plan.editor.rating5': '★ 5 - nie przegap',
  'plan.editor.bookingNone': 'Rezerwacja niepotrzebna',
  'plan.editor.bookingPending': 'Do zarezerwowania',
  'plan.editor.bookingConfirmed': 'Zarezerwowane i potwierdzone',
  'plan.editor.bookingCompleted': 'Odwiedzone',
  'plan.editor.bookingCancelled': 'Anulowane',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Nie udało się wczytać tej wycieczki',
  'error.plan': 'Nie udało się wczytać planu',
  'error.costs': 'Nie udało się wczytać kosztów',
  'error.collab': 'Nie udało się wczytać rozmowy',
  'error.book': 'Nie udało się wczytać rezerwacji',
  'error.transports': 'Przejazdy się nie wczytały',
  'error.people': 'Nie udało się wczytać osób',
  'header.length': {
    one: '{days} dzień',
    few: '{days} dni',
    many: '{days} dni',
    other: '{days} dnia',
  },
  'header.planned': {
    one: '{days} dzień zaplanowany',
    few: '{days} dni zaplanowane',
    many: '{days} dni zaplanowanych',
    other: '{days} dnia zaplanowanego',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Plan dnia',
  'plan.places': 'Miejsca',
  'plan.readOnly.archived':
    'Ta podróż jest zarchiwizowana, więc plan jest tylko do odczytu.',
  'plan.readOnly.role':
    'Możesz przeglądać ten plan. Zmieniać go mogą tylko właściciel podróży i edytorzy.',
  'plan.day.empty': 'Nic nie zaplanowano - przeciągnij tu miejsce albo notatkę',
  'plan.move.refused.duplicate': '{name} jest już w tym dniu',
  'plan.move.refused.duplicateBody':
    'Miejsce może pojawić się w dniu tylko raz. Przenieś je do innego dnia.',
  'plan.move.refused.notInIdeas': 'Notatka zostaje w dniu',
  'plan.move.refused.notInIdeasBody':
    'Pomysły to miejsca czekające na swój dzień. Notatka zawsze należy do jakiegoś dnia.',
  'plan.move.refused.journeyNotInIdeas': 'Przejazd zostaje w dniu',
  'plan.move.refused.journeyNotInIdeasBody':
    'Pomysły to miejsca czekające na swój dzień. Przejazd należy do dnia, w którym się odbywa.',
  'plan.move.refused.journeyNotInAnotherDay': 'Przejazd zostaje w swoim dniu',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Dzień przejazdu wynika z jego dat. Zmień je w zakładce Przejazdy.',
  'plan.move.refused.journeyTimed': '{name} odjeżdża o {time}',
  'plan.move.refused.journeyTimedBody':
    'Godzina odjazdu należy do rozkładu, nie do planu. Umieść przejazd tam, gdzie wskazuje jego zegar.',
  'plan.move.spoken.duplicate':
    '{name} nie został przeniesiony. Ten dzień już go ma.',
  'plan.move.spoken.notInIdeas':
    '{name} nie został przeniesiony. Notatka zostaje w dniu.',
  'plan.move.spoken.timed': '{name} ma godzinę {time}. Pytamy, czy ją usunąć.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} nie został przeniesiony. Przejazd zostaje w dniu.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} nie został przeniesiony. Przejazd zostaje w swoim dniu.',
  'plan.move.spoken.journeyTimed':
    '{name} nie został przeniesiony. Odjeżdża o {time}.',
  'plan.move.error.save': 'Nie udało się zapisać tego przeniesienia',
  'plan.move.error.retry': 'Spróbuj ponownie za chwilę.',
  'plan.move.dropTime.title': 'Przenieść {name} i usunąć godzinę {time}?',
  'plan.move.dropTime.body':
    'To miejsce jest sprzeczne z ustawioną godziną. Przeniesienie tutaj usuwa godzinę - nowa kolejność i usunięta godzina zapisują się razem.',
  'plan.move.dropTime.confirm': 'Przenieś i usuń godzinę',
  'plan.move.dropTime.cancel': 'Zostaw na miejscu',
  /* ------------------------------------------- a stop's menu and its delete */
  'plan.stop.menu.editPlace': 'Edytuj miejsce',
  'plan.stop.menu.setTime': 'Ustaw godzinę',
  'plan.stop.menu.placeOnMap': 'Umieść na mapie',
  'plan.stop.menu.movePin': 'Przesuń pinezkę',
  'plan.stop.menu.moveToDay': 'Przenieś do innego dnia',
  'plan.stop.menu.backToUnplanned': 'Przenieś do niezaplanowanych',
  'plan.stop.menu.delete': 'Usuń z podróży',
  'plan.stop.visited': 'Odwiedzone',
  'plan.delete.title': 'Usunąć „{name}”?',
  'plan.delete.titleUnnamed': 'Usunąć to miejsce?',
  'plan.delete.bodyUnplanned':
    'Miejsce całkowicie zniknie z miejsc podróży. Tej operacji nie można cofnąć.',
  'plan.delete.bodyOnDays': {
    one: 'Miejsce jest w {count} dniu tej podróży i zniknie z tego dnia. Tej operacji nie można cofnąć.',
    few: 'Miejsce jest w {count} dniach tej podróży i zniknie ze wszystkich. Tej operacji nie można cofnąć.',
    many: 'Miejsce jest w {count} dniach tej podróży i zniknie ze wszystkich. Tej operacji nie można cofnąć.',
    other:
      'Miejsce jest w {count} dniach tej podróży i zniknie ze wszystkich. Tej operacji nie można cofnąć.',
  },
  'plan.delete.error': 'Nie udało się usunąć',
  'plan.delete.confirm': 'Usuń miejsce',
  'plan.delete.deleting': 'Usuwanie miejsca',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Dodaj notatkę',
  'plan.note.addForDay': 'Dodaj notatkę: {day}',
  'plan.addPlace.label': 'Dodaj miejsce',
  'plan.addPlace.more': 'Więcej sposobów dodania miejsca',
  'plan.addPlace.option.map': 'Umieść na mapie',
  'plan.addPlace.forDayNamed': 'Dodaj miejsce: {day}',
  'plan.addPlace.quota':
    'Osiągnięto limit miejsc w Twoim planie. Przejdź na wyższy plan, aby dodać kolejne.',
  'plan.addPlace.quotaAction': 'Zobacz plany',
  'plan.stay.checkIn': 'Zameldowanie',
  'plan.stay.checkOut': 'Wymeldowanie',
  'plan.day.addStay': 'Dodaj nocleg: {day}',
  'plan.day.addStayShort': 'Dodaj nocleg',
  'plan.handoff.stop':
    'Otwórz {place} w {service} (otwiera się w nowej karcie)',
  'plan.handoff.day.directions': 'Trasa w {service}',
  'plan.handoff.day.directionsName':
    'Trasa w {service}: {day} (otwiera się w nowej karcie)',
  'plan.handoff.day.directionsPartial':
    'Przystanki: pierwsze {carried} z {total}',
  'plan.handoff.day.directionsPartialName':
    'Trasa w {service}: {day}, przystanki: pierwsze {carried} z {total} (otwiera się w nowej karcie)',
  'plan.handoff.day.point': 'Pokaż w {service}',
  'plan.handoff.day.pointName':
    'Pokaż w {service}: jedyny przystanek z pinezką na mapie, {day} (otwiera się w nowej karcie)',
  'plan.handoff.day.part': 'Część {n} z {count}',
  'plan.handoff.day.directionsPartName':
    'Trasa w {service}, część {n} z {count}, {day} (otwiera się w nowej karcie)',
  'plan.handoff.day.directionsPartialPartName':
    'Trasa w {service}, część {n} z {count}, przystanki: pierwsze {carried} z {total}, {day} (otwiera się w nowej karcie)',
  'plan.handoff.day.pointPartName':
    'Pokaż w {service}, część {n} z {count}, {day} (otwiera się w nowej karcie)',
  'plan.drop.hint':
    'Kliknij mapę prawym przyciskiem albo przytrzymaj na niej palec, aby dodać miejsce dokładnie tam.',
  'plan.drop.armed':
    'Kliknij mapę tam, gdzie ma się znaleźć, albo przesuń mapę i naciśnij Enter, aby upuścić je na środku.',
  'plan.drop.stop': 'Przestań umieszczać nową pinezkę',
  'plan.drop.pin': 'Nowe miejsce',
  'plan.drop.lookingUp': 'Szukam adresu…',
  'plan.drop.error':
    'Nie udało się upuścić pinezki. Spróbuj ponownie za chwilę.',
  'plan.place.pastedPosition': 'Odczytano jako szerokość {lat}, długość {lng}',
  'plan.note.showMore': 'Pokaż więcej',
  'plan.note.showLess': 'Pokaż mniej',
  'plan.note.moveUp': 'Przenieś w górę',
  'plan.note.moveDown': 'Przenieś w dół',
  'plan.note.moveToDay': 'Przenieś do innego dnia',
  'plan.note.drag': 'Zmień kolejność notatki',
  'plan.note.edit': 'Edytuj notatkę',
  'plan.note.delete': 'Usuń notatkę',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Dodaj notatkę',
  'plan.note.dialog.editTitle': 'Edytuj notatkę',
  'plan.note.field.body': 'Notatka',
  'plan.note.field.bodyHint': 'Jeden wiersz. To właśnie widać przy dniu.',
  'plan.note.field.detail': 'Szczegóły',
  'plan.note.field.detailHint':
    'Nagłówki, listy, odnośniki, cytaty, kod i tabele.',
  'plan.note.field.time': 'Godzina',
  'plan.note.field.timeHint': 'Opcjonalnie, w formacie 24-godzinnym.',
  'plan.note.field.icon': 'Ikona',
  'plan.note.tab.write': 'Pisanie',
  'plan.note.tab.preview': 'Podgląd',
  'plan.note.previewEmpty': 'Nie ma jeszcze czego pokazać',
  'plan.note.save': 'Zapisz notatkę',
  'plan.note.cancel': 'Anuluj',
  'plan.note.confirmDelete': 'Usunąć tę notatkę?',
  'plan.note.confirmDeleteBody': 'Notatka i jej szczegóły znikną z tego dnia.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Notatka dodana',
  'plan.note.toast.updated': 'Notatka zapisana',
  'plan.note.toast.deleted': 'Notatka usunięta',
  'plan.note.error.save': 'Nie udało się zapisać notatki',
  'plan.note.error.delete': 'Nie udało się usunąć notatki',
  'plan.note.error.retry': 'Spróbuj ponownie za chwilę.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Przypomnienie',
  'plan.note.icon.clock': 'Godzina',
  'plan.note.icon.flashlight': 'Latarka',
  'plan.note.icon.footprints': 'Spacer',
  'plan.note.icon.info': 'Informacja',
  'plan.note.icon.luggage': 'Bagaż',
  'plan.note.icon.package': 'Paczka',
  'plan.note.icon.ticket': 'Bilety',
  'plan.note.icon.trainFront': 'Pociąg',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Notatka',
  'plan.note.icon.utensils': 'Jedzenie',
  'plan.note.icon.bus': 'Dojazd',
  'plan.note.icon.bedDouble': 'Nocleg',
  'plan.note.icon.camera': 'Zdjęcie',
  'plan.note.icon.mapPin': 'Miejsce',
  'plan.note.icon.wallet': 'Pieniądze',
  'plan.note.icon.umbrella': 'Deszcz',
  'plan.note.icon.triangleAlert': 'Ostrzeżenie',
  'plan.transport.phase.flight.departing': 'Odlot',
  'plan.transport.phase.flight.travelling': 'W powietrzu',
  'plan.transport.phase.flight.arriving': 'Lądowanie',
  'plan.transport.phase.hire.departing': 'Odbiór',
  'plan.transport.phase.hire.travelling': 'W wynajmie',
  'plan.transport.phase.hire.arriving': 'Zwrot',
  'plan.transport.phase.journey.departing': 'Początek',
  'plan.transport.phase.journey.travelling': 'W drodze',
  'plan.transport.phase.journey.arriving': 'Koniec',
  'plan.transport.label': 'Z {from} do {to}',
  'plan.transport.drag': 'Zmień kolejność: {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Wspólnie',
  'collab.empty': 'Nic jeszcze nie udostępniono',
  'collab.conversation': 'Rozmowa',
  'collab.count.messages': {
    one: '{messages} wiadomość',
    few: '{messages} wiadomości',
    many: '{messages} wiadomości',
    other: '{messages} wiadomości',
  },
  'collab.count.notes': {
    one: '{notes} notatka',
    few: '{notes} notatki',
    many: '{notes} notatek',
    other: '{notes} notatki',
  },
  'collab.count.polls': {
    one: '{polls} ankieta',
    few: '{polls} ankiety',
    many: '{polls} ankiet',
    other: '{polls} ankiety',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Rezerwacje',
  'book.empty': 'Nic jeszcze nie zarezerwowano',
  'book.count.bookings': {
    one: '{bookings} rezerwacja',
    few: '{bookings} rezerwacje',
    many: '{bookings} rezerwacji',
    other: '{bookings} rezerwacji',
  },
  'book.count.confirmed': {
    one: '{confirmed} potwierdzona',
    few: '{confirmed} potwierdzone',
    many: '{confirmed} potwierdzonych',
    other: '{confirmed} potwierdzonej',
  },
  'book.progressLabel': {
    one: '{confirmed} z {total} rezerwacji potwierdzona',
    few: '{confirmed} z {total} rezerwacji potwierdzone',
    many: '{confirmed} z {total} rezerwacji potwierdzonych',
    other: '{confirmed} z {total} rezerwacji potwierdzonych',
  },
  'book.ofTotal': 'z {total}',
  'book.confirmed': 'Potwierdzone',
  'book.awaiting': 'Czeka na potwierdzenie',
  'book.nothingHanging': 'Nic nie wisi',
  'book.chase': 'Dopilnuj ich przed wylotem',
  'book.committed': 'Zobowiązania',
  'book.committedCaption': 'Ze wszystkich rezerwacji tej wycieczki',
  'book.onItinerary': 'W planie dnia',
  'book.pinnedCaption': 'Przypięte do dnia planu',
  'book.readOnly.archived':
    'Ta podróż jest zarchiwizowana, więc rezerwacje i noclegi są tylko do odczytu. Przywróć podróż, aby je zmienić.',
  'book.readOnly.role':
    'Możesz przeglądać te rezerwacje i noclegi. Zmieniać je mogą tylko właściciel podróży i edytorzy.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Zmiana została odrzucona. Sprawdź aktualny stan podróży przed kolejną zmianą.',
  'transports.recovery.failed':
    'Nie udało się odświeżyć podróży. Spróbuj ponownie przed wprowadzeniem zmian.',
  'transports.readOnly.archived':
    'Ta podróż jest zarchiwizowana. Przywróć ją, aby zmienić transport.',
  'transports.readOnly.role':
    'Możesz przeglądać te przejazdy. Zmieniać je mogą tylko właściciel podróży i edytorzy.',
  'transports.title': 'Przejazdy',
  'transports.empty': 'Nic jeszcze nie zapisano',
  'transports.count.transports': {
    one: '{transports} przejazd',
    few: '{transports} przejazdy',
    many: '{transports} przejazdów',
    other: '{transports} przejazdu',
  },
  'transports.distance': 'Pokonany dystans',
  'transports.equator': '≈ {times}× dookoła równika',
  'transports.noGrouping': 'Nic jeszcze nie pogrupowano',
  'transports.mostly': 'głównie {mode}',
  'transports.confirmed': 'Potwierdzone',
  'transports.stillPending': {
    one: '{pending} wciąż oczekuje',
    few: '{pending} wciąż oczekują',
    many: '{pending} wciąż oczekuje',
    other: '{pending} wciąż oczekuje',
  },
  'transports.spent': 'Wydane na podróż',
  'transports.noPrices': 'Brak zapisanych cen',
  'transports.priced': {
    one: 'z {priced} wycenionego przejazdu',
    few: 'z {priced} wycenionych przejazdów',
    many: 'z {priced} wycenionych przejazdów',
    other: 'z {priced} wycenionych przejazdów',
  },
  'people.title': 'Osoby',
  'people.description': 'Kto jest na tej wycieczce i kto może ją znaleźć',
  'people.members.title': 'Na tej wycieczce',
  'people.members.empty':
    'Nikt z tej wycieczki nie należy już do tej przestrzeni',
  'people.role.label': 'Rola',
  'people.role.owner': 'Właściciel',
  'people.role.editor': 'Edytor',
  'people.role.viewer': 'Obserwator',
  'people.you': 'Ty',
  'people.owner.hint': 'Wycieczka zawsze ma co najmniej jednego właściciela',
  'people.remove.action': 'Usuń {name} z tej wycieczki',
  'people.remove.title': 'Usunąć {name} z tej wycieczki?',
  'people.remove.body':
    'Od razu straci dostęp do planu. To, co dodał, zostaje na wycieczce.',
  'people.remove.confirm': 'Usuń',
  'people.leave.action': 'Opuść tę wycieczkę',
  'people.leave.title': 'Opuścić tę wycieczkę?',
  'people.leave.body':
    'Stracisz dostęp do planu, dopóki ktoś z wycieczki nie doda cię z powrotem.',
  'people.leave.confirm': 'Opuść',
  'people.cancel': 'Anuluj',
  'people.invite.title': 'Dodaj kogoś',
  'people.invite.placeholder': 'Szukaj osób w tej przestrzeni',
  'people.invite.action': 'Dodaj do wycieczki',
  'people.invite.role': 'Dołącza jako',
  'people.invite.empty': 'Wszyscy w tej przestrzeni są już na tej wycieczce',
  'people.invite.emptyHint':
    'Najpierw ktoś nowy dołącza do przestrzeni, w Ustawieniach',
  'people.visibility.title': 'Kto może znaleźć tę wycieczkę',
  'people.visibility.switch': 'Widoczna dla wszystkich w przestrzeni',
  'people.visibility.private':
    'Tę wycieczkę widzą tylko osoby wymienione tutaj',
  'people.visibility.organization':
    'Każdy w tej przestrzeni może otworzyć tę wycieczkę',
  'people.visibility.public':
    'Ta wycieczka jest udostępniona publicznym linkiem',
  'people.error.lastOwner':
    'Wycieczka ma co najmniej jednego właściciela. Najpierw uczyń właścicielem kogoś innego.',
  'people.error.notInWorkspace': 'Tej osoby nie ma w tej przestrzeni',
  'people.error.alreadyOnTrip': 'Ta osoba jest już na tej wycieczce',
  'people.guests.title': 'Podróżują z tobą',
  'people.guests.description': 'Osoby na tej wycieczce, które nie mają konta',
  'people.guests.empty': 'Jeszcze nikogo',
  'people.guests.emptyHint':
    'Gość to ktoś, kto podróżuje z tobą i nie potrzebuje konta. Dodaj go po imieniu.',
  'people.guest.badge': 'Gość',
  'people.guest.add.label': 'Imię',
  'people.guest.add.placeholder': 'Ania',
  'people.guest.add.action': 'Dodaj gościa',
  'people.guest.rename.action': 'Zmień nazwę: {name}',
  'people.guest.rename.title': 'Zmień nazwę: {name}',
  'people.guest.rename.confirm': 'Zmień nazwę',
  'people.guest.remove.action': 'Usuń {name} z tej wycieczki',
  'people.guest.remove.title': 'Usunąć {name} z tej wycieczki?',
  'people.guest.remove.body':
    'Gość zniknie z listy. Nic innego na wycieczce się nie zmieni.',
  'people.guest.remove.confirm': 'Usuń',
  'people.guest.merge.action': '{name} to teraz…',
  'people.guest.merge.title': '{name} jest teraz jedną z osób na tej wycieczce',
  'people.guest.merge.body':
    'Wszystko, co przypisano do {name}, przejdzie na wybraną osobę, a gość zniknie. Tego nie da się cofnąć.',
  'people.guest.merge.inherits':
    '{member} przejmie wszystko, co przypisano do {name}.',
  'people.guest.merge.placeholder': 'Wybierz kogoś z tej wycieczki',
  'people.guest.merge.confirm': 'Połącz',
  'people.guest.merge.done': '{name} to teraz {member}',
  'people.guest.merge.nothingMoved':
    'Nic nie było jeszcze do tej osoby przypisane',
  'people.error.guestNameTaken':
    'Gość o imieniu {name} jest już na tej wycieczce',
  'people.error.guestLimit':
    'Wycieczka mieści najwyżej {limit} gości, bo dłuższa lista utrudnia wybór uczestników i czytelność podziału kosztów',
  'people.error.guestMergeTarget':
    'Wybierz kogoś, kto już jest na tej wycieczce',
  'plan.weather.badge.forecast':
    'Prognoza: {figures}, {condition} (maks. {max}, min. {min})',
  'plan.weather.badge.forecastNoCondition':
    'Prognoza: {figures} (maks. {max}, min. {min})',
  'plan.weather.badge.unavailable': 'Pogoda niedostępna dla tego dnia',
  'plan.weather.badge.loading': 'Wczytywanie pogody',
  'plan.weather.badge.recorded': 'Zarejestrowano: maks. {max}, min. {min}',
  'plan.weather.badge.recordedHigh': 'Zarejestrowano: maks. {max}',
  'plan.weather.badge.recordedLow': 'Zarejestrowano: min. {min}',
  'plan.weather.badge.estimate':
    'Wartość szacunkowa: typowe maks. {max}, typowe min. {min}',
  'plan.weather.badge.estimateHigh': 'Wartość szacunkowa: typowe maks. {max}',
  'plan.weather.badge.estimateLow': 'Wartość szacunkowa: typowe min. {min}',
  'plan.weather.badge.notYetRecorded': 'Jeszcze nie zarejestrowano',
  'plan.weather.condition.clear': 'Bezchmurnie',
  'plan.weather.condition.fair': 'Pogodnie',
  'plan.weather.condition.partlyCloudy': 'Częściowe zachmurzenie',
  'plan.weather.condition.cloudy': 'Pochmurno',
  'plan.weather.condition.fog': 'Mgła',
  'plan.weather.condition.rain': 'Deszcz',
  'plan.weather.condition.heavyRain': 'Ulewny deszcz',
  'plan.weather.condition.sleet': 'Deszcz ze śniegiem',
  'plan.weather.condition.snow': 'Śnieg',
  'plan.weather.condition.thunder': 'Burza',
  'plan.weather.panel.title': 'Pogoda na {date}',
  'plan.weather.panel.temperature': 'Maks. / min.',
  'plan.weather.panel.precipitation': 'Opady',
  'plan.weather.panel.precipitationTypical': 'Typowe opady dziennie',
  'plan.weather.panel.probability': '{percent} szans',
  'plan.weather.panel.wind': 'Wiatr',
  'plan.weather.panel.sunrise': 'Wschód słońca',
  'plan.weather.panel.sunset': 'Zachód słońca',
  'plan.weather.panel.noSunrise': 'Brak wschodu słońca',
  'plan.weather.panel.noSunset': 'Brak zachodu słońca',
  'plan.weather.panel.slots': 'W ciągu dnia',
  'plan.weather.panel.slot.night': 'Noc',
  'plan.weather.panel.slot.morning': 'Rano',
  'plan.weather.panel.slot.afternoon': 'Popołudnie',
  'plan.weather.panel.slot.evening': 'Wieczór',
  'plan.weather.panel.high': 'Maks.',
  'plan.weather.panel.low': 'Min.',
  'plan.weather.panel.recordedNote': 'Wartości zmierzone dla tego dnia.',
  'plan.weather.panel.temperatureTypical': 'Typowe maks. / min.',
  'plan.weather.panel.estimateNote':
    'Wieloletnia średnia dla tego miesiąca, a nie prognoza.',
  'plan.weather.attribution.metNorway': 'Dane prognozy: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Dane: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Zmień szerokość planu',
  'plan.workspace.resizePlaces': 'Zmień szerokość miejsc',
  'plan.workspace.toggleDay': 'Rozwiń lub zwiń {day}',
  'plan.workspace.days': 'Dni',
  'plan.workspace.showPanel': 'Pokaż panel {label}',
  'plan.workspace.hidePanel': 'Ukryj panel {label}',
  'plan.workspace.narrowPanel': 'Zwęź {label}',
  'plan.workspace.widenPanel': 'Poszerz {label}',
  'collab.sections.tabsLabel': 'Sekcje współpracy',
  'collab.sections.trigger': 'Wybierz sekcje',
  'collab.sections.menuLabel': 'Pokaż wszystkim na tej podróży',
  'collab.sections.keepOne': 'Co najmniej jedna sekcja musi pozostać włączona.',
  'collab.sections.failed': 'Nie udało się zapisać zmiany',
  'collab.sections.failedBody': 'Menu pokazuje aktualnie zapisany stan.',
  'collab.sections.someHidden': 'Niektóre sekcje są ukryte na tej podróży.',
  'collab.sections.turnedOff':
    'Ta sekcja została wyłączona dla podróży. Zamknie się, gdy wyślesz lub wyczyścisz to, co piszesz.',
  'collab.sections.changed': 'Sekcje tej podróży uległy zmianie.',
  'collab.sections.savedHidden':
    'Zapisano. Ta sekcja jest ukryta dla podróży, więc teraz się zamknie.',
  'plan.place.error.save':
    'Nie udało się zapisać miejsca. Spróbuj ponownie za chwilę.',
  'plan.stop.error.saveTimes':
    'Nie udało się zapisać godzin przystanku. Spróbuj ponownie za chwilę.',
  'plan.place.error.delete':
    'Nie udało się usunąć miejsca. Spróbuj ponownie za chwilę.',
  'plan.pin.error.move':
    'Nie udało się przenieść pinezki. Spróbuj ponownie za chwilę.',
  'plan.place.toast.created': 'Miejsce dodane',
  'plan.place.toast.updated': 'Miejsce zaktualizowane',
  'plan.stop.toast.timesSaved': 'Godziny przystanku zapisane',
  'plan.place.toast.deleted': 'Miejsce usunięte',
  'plan.pin.toast.moved': 'Przypięto {name}',
  'join.page.title': 'Link z zaproszeniem na wyjazd',
  'join.page.description':
    'Otwórz ten link, aby dołączyć do wspólnego wyjazdu w planned.travel.',
  'join.title.invited': '{inviter} zaprasza cię na wyjazd',
  'join.requirement':
    'Ten link działa dla osób, które są już w przestrzeni osoby {inviter}.',
  'join.newHere':
    'Pierwszy raz tutaj? Poproś osobę {inviter}, aby najpierw dodała cię do swojej przestrzeni.',
  'join.trip.label': 'Wyjazd',
  'join.role.label': 'Dołączysz w roli',
  'join.dates.label': 'Termin',
  'join.destination.label': 'Cel wyjazdu',
  'join.action.signIn': 'Zaloguj się',
  'join.action.join': 'Dołącz do wyjazdu',
  'join.action.joining': 'Dołączanie do wyjazdu',
  'join.action.open': 'Otwórz wyjazd',
  'join.action.openIn': 'Otwórz wyjazd i przełącz przestrzeń',
  'join.action.openIn.pending': 'Przełączanie przestrzeni',
  'join.loading': 'Wczytywanie zaproszenia',
  'join.joined.title': 'Jesteś na wyjeździe',
  'join.joined.body': 'Otwórz go, aby zobaczyć plan.',
  'join.member.title': 'Już jesteś na tym wyjeździe',
  'join.needsWorkspace.title':
    'Ten wyjazd jest w przestrzeni, do której nie należysz',
  'join.needsWorkspace.body':
    'Poproś osobę {inviter}, aby najpierw dodała cię do swojej przestrzeni, a potem otwórz ten link jeszcze raz.',
  'join.needsWorkspace.signedInAs':
    'Zalogowano jako {email}. Powiedz osobie {inviter}, żeby użyła tego adresu.',
  'join.needsWorkspace.acceptFirst':
    'Jeśli masz już e-mail z zaproszeniem do przestrzeni, najpierw je przyjmij, a potem otwórz ten link jeszcze raz.',
  'join.needsWorkspace.otherAccount': 'Zaloguj się na inne konto',
  'join.unavailable.title': 'Ten link z zaproszeniem jest niedostępny',
  'join.unavailable.body':
    'Link mógł zostać zastąpiony lub wyłączony. Poproś osobę, która go wysłała, o nowy.',
  'join.unavailable.signIn': 'Zaloguj się',
  'join.unavailable.trips': 'Przejdź do swoich wyjazdów',
  'join.error.title': 'Nie udało się wczytać tego linku z zaproszeniem',
  'join.error.retry': 'Spróbuj ponownie',
  'join.error.busy': 'Ta strona jest zajęta. Spróbuj ponownie za minutę.',
  'join.error.join':
    'Nie udało się dołączyć. Link nadal działa, spróbuj ponownie.',
  'join.error.switch':
    'Nie udało się przełączyć przestrzeni. Spróbuj ponownie.',

  'invite.title': 'Link do podróży',
  'invite.description':
    'Każdy w tym workspace, kto otworzy link, dołączy do podróży.',
  'invite.empty.title': 'Nie ma jeszcze linku',
  'invite.empty.body':
    'Utwórz link i wklej go do czatu grupowego. Osoby z tego workspace będą mogły dołączyć.',
  'invite.action.create': 'Utwórz link',
  'invite.link.label': 'Link do podróży',
  'invite.copy': 'Kopiuj link',
  'invite.copied': 'Link skopiowany',
  'invite.copyFailed':
    'Nie udało się skopiować. Zaznacz link i skopiuj go ręcznie.',
  'invite.switch.label': 'Każdy w tym workspace z linkiem może dołączyć',
  'invite.switch.onHint':
    'Wyłączenie unieważni link dla wszystkich, również wysłane już kopie.',
  'invite.switch.offHint':
    'Ponowne włączenie utworzy nowy link. Wcześniejsze linki pozostaną nieważne.',
  'invite.off.body': 'Link jest wyłączony. Nikt nie może przez niego dołączyć.',
  'invite.uses': {
    one: 'Liczba osób, które dołączyły przez link: {count}',
    few: 'Liczba osób, które dołączyły przez link: {count}',
    many: 'Liczba osób, które dołączyły przez link: {count}',
    other: 'Liczba osób, które dołączyły przez link: {count}',
  },
  'invite.uses.never': 'Nikt jeszcze nie dołączył przez ten link.',
  'invite.lastUsed': 'Ostatnie dołączenie: {when}',
  'invite.role.upgrade.title': 'Nadać rolę edytora?',
  'invite.role.upgrade.body':
    'Dotyczy to wszystkich wysłanych kopii linku i osób, które dołączą od teraz.',
  'invite.role.upgrade.confirm': 'Nadaj rolę edytora',
  'invite.replace.action': 'Zastąp link',
  'invite.replace.title': 'Zastąpić ten link?',
  'invite.replace.body':
    'Stary link natychmiast przestanie działać dla wszystkich. Osoby, które już dołączyły, pozostaną w podróży; w razie potrzeby usuń je z listy poniżej.',
  'invite.replace.deadBody':
    'Stary link już nie działa. Osoby, które dołączyły, pozostają w podróży.',
  'invite.replace.confirm': 'Zastąp link',
  'invite.replace.pending': 'Zastępowanie linku',
  'invite.stale': 'Ten link już nie działa. Zastąp go.',
  'invite.creatorGone':
    'Link nie działa, bo jego twórca nie jest już właścicielem. Zastąp go.',
  'invite.archived':
    'Podróż jest zarchiwizowana. Link nie działa do czasu jej przywrócenia.',
  'invite.announce.created': 'Link do podróży utworzony',
  'invite.announce.roleEditor': 'Dołączające osoby otrzymają rolę edytora',
  'invite.announce.off': 'Link do podróży wyłączony',
  'invite.announce.newLink':
    'Nowy link jest gotowy. Skopiuj go i wyślij ponownie.',
  'invite.announce.roleViewer':
    'Dołączające osoby otrzymają rolę przeglądającego',
  'invite.error.title': 'Nie udało się wczytać linku',
  'invite.error.retry': 'Spróbuj ponownie',
  'invite.refusal.archived': 'Podróż jest zarchiwizowana.',
  'invite.refusal.notOwner': 'Tylko właściciel podróży może zmienić link.',
  'invite.refusal.changed': 'Ktoś inny zmienił link. Wyświetlamy aktualny.',
  'invite.announce.recovered':
    'Wyświetlamy aktualne ustawienia linku. Sprawdź je przed kolejną zmianą.',
} satisfies TranslationOf<typeof En>

export default messages
