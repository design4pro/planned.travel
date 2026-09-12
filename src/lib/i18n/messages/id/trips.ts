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
  'plan.day.empty': 'Belum ada rencana — seret tempat atau catatan ke sini',
  'plan.move.refused.duplicate': '{name} sudah ada di hari itu',
  'plan.move.refused.duplicateBody': 'Satu tempat hanya bisa muncul sekali per hari. Pindahkan ke hari lain.',
  'plan.move.refused.notInIdeas': 'Catatan tetap di dalam harinya',
  'plan.move.refused.notInIdeasBody': 'Ide adalah tempat yang menunggu hari. Catatan milik hari tempat ia ditulis.',
  'plan.move.refused.notInAnotherDay': 'Catatan tetap di harinya sendiri',
  'plan.move.refused.notInAnotherDayBody': 'Catatan belum bisa dipindah antar hari. Ubah catatannya, atau tulis di hari yang lain.',
  'plan.move.refused.journeyNotInIdeas': 'Perjalanan tetap di dalam harinya',
  'plan.move.refused.journeyNotInIdeasBody': 'Ide adalah tempat yang menunggu hari. Perjalanan milik hari saat ia berlangsung.',
  'plan.move.refused.journeyNotInAnotherDay': 'Perjalanan tetap di harinya sendiri',
  'plan.move.refused.journeyNotInAnotherDayBody': 'Hari sebuah perjalanan berasal dari tanggalnya. Ubah tanggalnya di tab Transportasi.',
  'plan.move.refused.journeyTimed': '{name} berangkat pukul {time}',
  'plan.move.refused.journeyTimedBody': 'Waktu keberangkatan milik jadwal, bukan milik rencana. Letakkan perjalanan sesuai jamnya.',
  'plan.move.spoken.duplicate': '{name} tidak dipindahkan. Hari itu sudah memilikinya.',
  'plan.move.spoken.notInIdeas': '{name} tidak dipindahkan. Catatan tetap di dalam harinya.',
  'plan.move.spoken.notInAnotherDay': '{name} tidak dipindahkan. Catatan tetap di harinya sendiri.',
  'plan.move.spoken.timed': '{name} punya waktu {time}. Kami tanya apakah waktunya dilepas.',
  'plan.move.spoken.journeyNotInIdeas': '{name} tidak dipindahkan. Perjalanan tetap di dalam harinya.',
  'plan.move.spoken.journeyNotInAnotherDay': '{name} tidak dipindahkan. Perjalanan tetap di harinya sendiri.',
  'plan.move.spoken.journeyTimed': '{name} tidak dipindahkan. Berangkat pukul {time}.',
  'plan.move.error.save': 'Pemindahan itu gagal disimpan',
  'plan.move.error.retry': 'Coba lagi sebentar lagi.',
  'plan.move.dropTime.title': 'Pindahkan {name} dan lepas waktu {time}?',
  'plan.move.dropTime.body': 'Posisi ini bertentangan dengan waktu yang tertera. Memindahkannya ke sini menghapus waktu — urutan baru dan waktu yang dihapus disimpan bersamaan.',
  'plan.move.dropTime.confirm': 'Pindahkan dan hapus waktunya',
  'plan.move.dropTime.cancel': 'Biarkan di tempatnya',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Tambahkan catatan',
  'plan.note.addForDay': 'Tambahkan catatan, {day}',
  'plan.note.showMore': 'Tampilkan selengkapnya',
  'plan.note.showLess': 'Tampilkan lebih sedikit',
  'plan.note.moveUp': 'Pindahkan ke atas',
  'plan.note.moveDown': 'Pindahkan ke bawah',
  'plan.note.drag': 'Ubah urutan catatan',
  'plan.note.edit': 'Edit catatan',
  'plan.note.delete': 'Hapus catatan',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Tambahkan catatan',
  'plan.note.dialog.editTitle': 'Edit catatan',
  'plan.note.field.body': 'Catatan',
  'plan.note.field.bodyHint':
    'Satu baris. Inilah yang ditampilkan pada hari itu.',
  'plan.note.field.detail': 'Detail',
  'plan.note.field.detailHint':
    'Judul, daftar, tautan, kutipan, kode, dan tabel.',
  'plan.note.field.time': 'Waktu',
  'plan.note.field.timeHint': 'Opsional, format 24 jam.',
  'plan.note.field.icon': 'Ikon',
  'plan.note.tab.write': 'Tulis',
  'plan.note.tab.preview': 'Pratinjau',
  'plan.note.previewEmpty': 'Belum ada yang bisa dipratinjau',
  'plan.note.save': 'Simpan catatan',
  'plan.note.cancel': 'Batal',
  'plan.note.confirmDelete': 'Hapus catatan ini?',
  'plan.note.confirmDeleteBody': 'Catatan dan detailnya dihapus dari hari itu.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Catatan ditambahkan',
  'plan.note.toast.updated': 'Catatan disimpan',
  'plan.note.toast.deleted': 'Catatan dihapus',
  'plan.note.error.save': 'Catatan gagal disimpan',
  'plan.note.error.delete': 'Catatan gagal dihapus',
  'plan.note.error.retry': 'Coba lagi sebentar lagi.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Pengingat',
  'plan.note.icon.clock': 'Waktu',
  'plan.note.icon.flashlight': 'Senter',
  'plan.note.icon.footprints': 'Jalan kaki',
  'plan.note.icon.info': 'Informasi',
  'plan.note.icon.luggage': 'Bagasi',
  'plan.note.icon.package': 'Paket',
  'plan.note.icon.ticket': 'Tiket',
  'plan.note.icon.trainFront': 'Kereta',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Catatan',
  'plan.note.icon.utensils': 'Makanan',
  'plan.note.icon.bus': 'Transportasi',
  'plan.note.icon.bedDouble': 'Menginap',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Tempat',
  'plan.note.icon.wallet': 'Uang',
  'plan.note.icon.umbrella': 'Hujan',
  'plan.note.icon.triangleAlert': 'Peringatan',
  'plan.transport.phase.flight.departing': 'Lepas landas',
  'plan.transport.phase.flight.travelling': 'Di udara',
  'plan.transport.phase.flight.arriving': 'Mendarat',
  'plan.transport.phase.hire.departing': 'Pengambilan',
  'plan.transport.phase.hire.travelling': 'Sedang disewa',
  'plan.transport.phase.hire.arriving': 'Pengembalian',
  'plan.transport.phase.journey.departing': 'Mulai',
  'plan.transport.phase.journey.travelling': 'Dalam perjalanan',
  'plan.transport.phase.journey.arriving': 'Selesai',
  'plan.transport.label': 'Dari {from} ke {to}',
  'plan.transport.drag': 'Ubah urutan {journey}',
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
