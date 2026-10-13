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
  'error.people': 'Daftar orang tidak dapat dimuat',
  'header.length': {
    other: '{days} hari',
  },
  'header.planned': {
    other: '{days} hari direncanakan',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Rencana perjalanan',
  'plan.places': 'Tempat',
  'plan.readOnly.archived':
    'Perjalanan ini diarsipkan, jadi rencananya hanya bisa dibaca.',
  'plan.readOnly.role':
    'Anda bisa melihat rencana ini. Hanya pemilik perjalanan dan yang bisa mengedit yang dapat mengubahnya.',
  'plan.day.empty': 'Belum ada rencana — seret tempat atau catatan ke sini',
  'plan.move.refused.duplicate': '{name} sudah ada di hari itu',
  'plan.move.refused.duplicateBody':
    'Satu tempat hanya bisa muncul sekali per hari. Pindahkan ke hari lain.',
  'plan.move.refused.notInIdeas': 'Catatan tetap di dalam harinya',
  'plan.move.refused.notInIdeasBody':
    'Ide adalah tempat yang menunggu hari. Catatan milik hari tempat ia ditulis.',
  'plan.move.refused.notInAnotherDay': 'Catatan tetap di harinya sendiri',
  'plan.move.refused.notInAnotherDayBody':
    'Catatan belum bisa dipindah antar hari. Ubah catatannya, atau tulis di hari yang lain.',
  'plan.move.refused.journeyNotInIdeas': 'Perjalanan tetap di dalam harinya',
  'plan.move.refused.journeyNotInIdeasBody':
    'Ide adalah tempat yang menunggu hari. Perjalanan milik hari saat ia berlangsung.',
  'plan.move.refused.journeyNotInAnotherDay':
    'Perjalanan tetap di harinya sendiri',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Hari sebuah perjalanan berasal dari tanggalnya. Ubah tanggalnya di tab Transportasi.',
  'plan.move.refused.journeyTimed': '{name} berangkat pukul {time}',
  'plan.move.refused.journeyTimedBody':
    'Waktu keberangkatan milik jadwal, bukan milik rencana. Letakkan perjalanan sesuai jamnya.',
  'plan.move.spoken.duplicate':
    '{name} tidak dipindahkan. Hari itu sudah memilikinya.',
  'plan.move.spoken.notInIdeas':
    '{name} tidak dipindahkan. Catatan tetap di dalam harinya.',
  'plan.move.spoken.notInAnotherDay':
    '{name} tidak dipindahkan. Catatan tetap di harinya sendiri.',
  'plan.move.spoken.timed':
    '{name} punya waktu {time}. Kami tanya apakah waktunya dilepas.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} tidak dipindahkan. Perjalanan tetap di dalam harinya.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} tidak dipindahkan. Perjalanan tetap di harinya sendiri.',
  'plan.move.spoken.journeyTimed':
    '{name} tidak dipindahkan. Berangkat pukul {time}.',
  'plan.move.error.save': 'Pemindahan itu gagal disimpan',
  'plan.move.error.retry': 'Coba lagi sebentar lagi.',
  'plan.move.dropTime.title': 'Pindahkan {name} dan lepas waktu {time}?',
  'plan.move.dropTime.body':
    'Posisi ini bertentangan dengan waktu yang tertera. Memindahkannya ke sini menghapus waktu — urutan baru dan waktu yang dihapus disimpan bersamaan.',
  'plan.move.dropTime.confirm': 'Pindahkan dan hapus waktunya',
  'plan.move.dropTime.cancel': 'Biarkan di tempatnya',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Tambahkan catatan',
  'plan.note.addForDay': 'Tambahkan catatan, {day}',
  'plan.addPlace.label': 'Tambahkan tempat',
  'plan.addPlace.more': 'Cara lain menambahkan tempat',
  'plan.addPlace.option.map': 'Letakkan di peta',
  'plan.addPlace.forDayNamed': 'Tambahkan tempat, {day}',
  'plan.addPlace.quota':
    'Anda telah mencapai batas tempat pada paket Anda. Tingkatkan paket untuk menambah lebih banyak.',
  'plan.addPlace.quotaAction': 'Lihat paket',
  'plan.stay.checkIn': 'Check-in',
  'plan.stay.checkOut': 'Check-out',
  'plan.day.addStay': 'Tambahkan penginapan, {day}',
  'plan.day.addStayShort': 'Tambahkan penginapan',
  'plan.handoff.stop': 'Buka {place} di {service} (terbuka di tab baru)',
  'plan.handoff.day.directions': 'Petunjuk arah di {service}',
  'plan.handoff.day.directionsName':
    'Petunjuk arah di {service}: {day} (terbuka di tab baru)',
  'plan.handoff.day.directionsPartial':
    'Perhentian: {carried} pertama dari {total}',
  'plan.handoff.day.directionsPartialName':
    'Petunjuk arah di {service}: {day}, perhentian: {carried} pertama dari {total} (terbuka di tab baru)',
  'plan.handoff.day.point': 'Tampilkan di {service}',
  'plan.handoff.day.pointName':
    'Tampilkan di {service}: satu-satunya perhentian bertitik peta pada {day} (terbuka di tab baru)',
  'plan.drop.hint':
    'Klik kanan pada peta, atau tekan dan tahan, untuk menambahkan tempat tepat di sana.',
  'plan.drop.armed':
    'Klik peta di tempat seharusnya, atau geser peta lalu tekan Enter untuk meletakkannya di tengah.',
  'plan.drop.stop': 'Berhenti meletakkan pin baru',
  'plan.drop.pin': 'Tempat baru',
  'plan.drop.lookingUp': 'Mencari alamat…',
  'plan.drop.error': 'Pin tidak dapat diletakkan. Coba lagi sebentar lagi.',
  'plan.place.pastedPosition': 'Terbaca sebagai lintang {lat}, bujur {lng}',
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
  'plan.transport.drag': 'Ubah urutan, {journey}',
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
  'people.title': 'Orang',
  'people.description':
    'Siapa yang ikut perjalanan ini, dan siapa yang bisa menemukannya',
  'people.members.title': 'Di perjalanan ini',
  'people.members.empty':
    'Tidak ada lagi orang dari perjalanan ini di ruang kerja ini',
  'people.role.label': 'Peran',
  'people.role.owner': 'Pemilik',
  'people.role.editor': 'Bisa mengedit',
  'people.role.viewer': 'Bisa melihat',
  'people.you': 'Anda',
  'people.owner.hint': 'Setiap perjalanan selalu punya setidaknya satu pemilik',
  'people.remove.action': 'Keluarkan {name} dari perjalanan ini',
  'people.remove.title': 'Keluarkan {name} dari perjalanan ini?',
  'people.remove.body':
    'Dia langsung kehilangan akses ke rencana perjalanan. Yang sudah dia tambahkan tetap ada di perjalanan.',
  'people.remove.confirm': 'Keluarkan',
  'people.leave.action': 'Keluar dari perjalanan ini',
  'people.leave.title': 'Keluar dari perjalanan ini?',
  'people.leave.body':
    'Anda kehilangan akses ke rencana perjalanan sampai ada orang di perjalanan yang menambahkan Anda kembali.',
  'people.leave.confirm': 'Keluar',
  'people.cancel': 'Batal',
  'people.invite.title': 'Tambahkan orang',
  'people.invite.placeholder': 'Cari orang di ruang kerja ini',
  'people.invite.action': 'Tambahkan ke perjalanan',
  'people.invite.role': 'Bergabung sebagai',
  'people.invite.empty':
    'Semua orang di ruang kerja ini sudah ikut perjalanan ini',
  'people.invite.emptyHint':
    'Orang baru bergabung ke ruang kerja dulu, lewat Pengaturan',
  'people.visibility.title': 'Siapa yang bisa menemukan perjalanan ini',
  'people.visibility.switch': 'Terlihat oleh semua orang di ruang kerja',
  'people.visibility.private':
    'Hanya orang yang tercantum di sini yang bisa melihat perjalanan ini',
  'people.visibility.organization':
    'Siapa pun di ruang kerja ini bisa membuka perjalanan ini',
  'people.visibility.public': 'Perjalanan ini dibagikan lewat tautan publik',
  'people.error.lastOwner':
    'Setiap perjalanan punya setidaknya satu pemilik. Jadikan orang lain pemilik dulu.',
  'people.error.notInWorkspace': 'Orang itu tidak ada di ruang kerja ini',
  'people.error.alreadyOnTrip': 'Orang itu sudah ada di perjalanan ini',
  'people.guests.title': 'Bepergian bersamamu',
  'people.guests.description': 'Orang di perjalanan ini yang tidak punya akun',
  'people.guests.empty': 'Belum ada',
  'people.guests.emptyHint':
    'Tamu adalah orang yang bepergian bersamamu dan tidak memerlukan akun. Tambahkan dengan namanya.',
  'people.guest.badge': 'Tamu',
  'people.guest.add.label': 'Namanya',
  'people.guest.add.placeholder': 'Sari',
  'people.guest.add.action': 'Tambah tamu',
  'people.guest.rename.action': 'Ganti nama {name}',
  'people.guest.rename.title': 'Ganti nama {name}',
  'people.guest.rename.confirm': 'Ganti nama',
  'people.guest.remove.action': 'Keluarkan {name} dari perjalanan ini',
  'people.guest.remove.title': 'Keluarkan {name} dari perjalanan ini?',
  'people.guest.remove.body':
    'Tamu dihapus. Tidak ada hal lain di perjalanan yang berubah.',
  'people.guest.remove.confirm': 'Keluarkan',
  'people.guest.merge.action': '{name} sekarang adalah…',
  'people.guest.merge.title':
    '{name} sekarang salah satu orang di perjalanan ini',
  'people.guest.merge.body':
    'Semua yang ditugaskan ke {name} pindah ke orang yang kamu pilih, dan tamu dihapus. Tindakan ini tidak bisa dibatalkan.',
  'people.guest.merge.inherits':
    '{member} mewarisi semua yang ditugaskan kepada {name}.',
  'people.guest.merge.placeholder': 'Pilih seseorang di perjalanan ini',
  'people.guest.merge.confirm': 'Gabungkan',
  'people.guest.merge.done': '{name} sekarang adalah {member}',
  'people.guest.merge.nothingMoved': 'Belum ada yang ditugaskan kepadanya',
  'people.error.guestNameTaken':
    'Tamu bernama {name} sudah ada di perjalanan ini',
  'people.error.guestLimit':
    'Satu perjalanan menampung paling banyak {limit} tamu, karena daftar yang lebih panjang membuat pemilih peserta dan pembagian biaya sulit dibaca',
  'people.error.guestMergeTarget':
    'Pilih seseorang yang sudah ada di perjalanan ini',
  'plan.weather.badge.forecast':
    'Prakiraan: {condition}, tertinggi {max}, terendah {min}',
  'plan.weather.badge.forecastNoCondition':
    'Prakiraan: tertinggi {max}, terendah {min}',
  'plan.weather.badge.unavailable': 'Cuaca tidak tersedia untuk hari ini',
  'plan.weather.badge.loading': 'Memuat cuaca',
  'plan.weather.badge.recorded': 'Tercatat: tertinggi {max}, terendah {min}',
  'plan.weather.badge.recordedHigh': 'Tercatat: tertinggi {max}',
  'plan.weather.badge.recordedLow': 'Tercatat: terendah {min}',
  'plan.weather.badge.estimate':
    'Estimasi: tertinggi umumnya {max}, terendah umumnya {min}',
  'plan.weather.badge.estimateHigh': 'Estimasi: tertinggi umumnya {max}',
  'plan.weather.badge.estimateLow': 'Estimasi: terendah umumnya {min}',
  'plan.weather.badge.notYetRecorded': 'Belum tercatat',
  'plan.weather.condition.clear': 'Cerah',
  'plan.weather.condition.fair': 'Cukup cerah',
  'plan.weather.condition.partlyCloudy': 'Sebagian berawan',
  'plan.weather.condition.cloudy': 'Berawan',
  'plan.weather.condition.fog': 'Kabut',
  'plan.weather.condition.rain': 'Hujan',
  'plan.weather.condition.heavyRain': 'Hujan lebat',
  'plan.weather.condition.sleet': 'Hujan bercampur salju',
  'plan.weather.condition.snow': 'Salju',
  'plan.weather.condition.thunder': 'Petir',
  'plan.weather.panel.title': 'Cuaca untuk {date}',
  'plan.weather.panel.temperature': 'Tertinggi / terendah',
  'plan.weather.panel.precipitation': 'Curah hujan',
  'plan.weather.panel.precipitationTypical': 'Curah hujan harian umumnya',
  'plan.weather.panel.probability': 'Peluang {percent}',
  'plan.weather.panel.wind': 'Angin',
  'plan.weather.panel.sunrise': 'Matahari terbit',
  'plan.weather.panel.sunset': 'Matahari terbenam',
  'plan.weather.panel.noSunrise': 'Tidak ada matahari terbit',
  'plan.weather.panel.noSunset': 'Tidak ada matahari terbenam',
  'plan.weather.panel.slots': 'Sepanjang hari',
  'plan.weather.panel.slot.night': 'Dini hari',
  'plan.weather.panel.slot.morning': 'Pagi',
  'plan.weather.panel.slot.afternoon': 'Siang',
  'plan.weather.panel.slot.evening': 'Malam',
  'plan.weather.panel.high': 'Tertinggi',
  'plan.weather.panel.low': 'Terendah',
  'plan.weather.panel.recordedNote': 'Nilai terukur pada hari tersebut.',
  'plan.weather.panel.temperatureTypical': 'Tertinggi / terendah umumnya',
  'plan.weather.panel.estimateNote':
    'Rata-rata jangka panjang untuk bulan ini, bukan prakiraan.',
  'plan.weather.attribution.metNorway': 'Data prakiraan: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Sumber data: NASA Langley Research Center POWER Project',
} satisfies TranslationOf<typeof En>

export default messages
