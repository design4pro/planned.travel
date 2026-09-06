/**
 * The trip tabs' own copy, in id.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Jamak.** Bahasa Indonesia hanya punya cabang `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Perjalanan ini tidak dapat dimuat',
  'error.plan': 'Rencana perjalanan tidak dapat dimuat',
  'error.costs': 'Biaya tidak dapat dimuat',
  'error.collab': 'Percakapan tidak dapat dimuat',
  'error.book': 'Pemesanan tidak dapat dimuat',
  'error.transports': 'Transportasi tidak dapat dimuat',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Rencana perjalanan',
  'plan.places': 'Tempat',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Bersama',
  'collab.empty': 'Belum ada yang dibagikan',
  'collab.conversation': 'Percakapan',
  'collab.count.messages': {
    other: '{messages} pesan',
  },
  'collab.count.notes': {
    other: '{notes} catatan',
  },
  'collab.count.polls': {
    other: '{polls} jajak pendapat',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Pemesanan',
  'book.empty': 'Belum ada yang dipesan',
  'book.count.bookings': {
    other: '{bookings} pemesanan',
  },
  'book.count.confirmed': {
    other: '{confirmed} terkonfirmasi',
  },
  'book.progressLabel': {
    other: '{confirmed} dari {total} pemesanan terkonfirmasi',
  },
  'book.ofTotal': 'dari {total}',
  'book.confirmed': 'Terkonfirmasi',
  'book.awaiting': 'Menunggu konfirmasi',
  'book.nothingHanging': 'Tidak ada yang menggantung',
  'book.chase': 'Tagih sebelum berangkat',
  'book.committed': 'Sudah dialokasikan',
  'book.committedCaption': 'Dari seluruh pemesanan perjalanan ini',
  'book.onItinerary': 'Di rencana perjalanan',
  'book.pinnedCaption': 'Disematkan pada satu hari rencana',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Transportasi',
  'transports.empty': 'Belum ada yang dicatat',
  'transports.count.transports': {
    other: '{transports} transportasi',
  },
  'transports.distance': 'Jarak tempuh',
  'transports.equator': '≈ {times}× keliling khatulistiwa',
  'transports.noGrouping': 'Belum ada yang dikelompokkan',
  'transports.mostly': 'kebanyakan {mode}',
  'transports.confirmed': 'Terkonfirmasi',
  'transports.stillPending': {
    other: '{pending} masih menunggu',
  },
  'transports.spent': 'Dibelanjakan untuk perjalanan',
  'transports.noPrices': 'Belum ada harga dicatat',
  'transports.priced': {
    other: 'dari {priced} transportasi dengan harga',
  },
} satisfies TranslationOf<typeof En>

export default messages
