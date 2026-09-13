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
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Nie udało się wczytać tej wycieczki',
  'error.plan': 'Nie udało się wczytać planu',
  'error.costs': 'Nie udało się wczytać kosztów',
  'error.collab': 'Nie udało się wczytać rozmowy',
  'error.book': 'Nie udało się wczytać rezerwacji',
  'error.transports': 'Przejazdy się nie wczytały',
  'error.people': 'Nie udało się wczytać osób',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Plan dnia',
  'plan.places': 'Miejsca',
  'plan.day.empty': 'Nic nie zaplanowano - przeciągnij tu miejsce albo notatkę',
  'plan.move.refused.duplicate': '{name} jest już w tym dniu',
  'plan.move.refused.duplicateBody':
    'Miejsce może pojawić się w dniu tylko raz. Przenieś je do innego dnia.',
  'plan.move.refused.notInIdeas': 'Notatka zostaje w dniu',
  'plan.move.refused.notInIdeasBody':
    'Pomysły to miejsca czekające na swój dzień. Notatka należy do dnia, dla którego ją zapisano.',
  'plan.move.refused.notInAnotherDay': 'Notatka zostaje w swoim dniu',
  'plan.move.refused.notInAnotherDayBody':
    'Notatek nie można jeszcze przenosić między dniami. Edytuj notatkę albo zapisz ją w innym dniu.',
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
  'plan.move.spoken.notInAnotherDay':
    '{name} nie został przeniesiony. Notatka zostaje w swoim dniu.',
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
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Dodaj notatkę',
  'plan.note.addForDay': 'Dodaj notatkę: {day}',
  'plan.note.showMore': 'Pokaż więcej',
  'plan.note.showLess': 'Pokaż mniej',
  'plan.note.moveUp': 'Przenieś w górę',
  'plan.note.moveDown': 'Przenieś w dół',
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
  /* ---------------------------------------------- the transports tab */
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
} satisfies TranslationOf<typeof En>

export default messages
