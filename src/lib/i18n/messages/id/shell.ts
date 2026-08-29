/**
 * Everything the application shell says, in Indonesian.
 *
 * Authored from `../en/shell`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Indonesian marks number on the noun without inflecting it, so
 * `Intl.PluralRules` reports the single category `other` and every `one`/`other`
 * pair English writes collapses to one branch. `count` still selects that
 * branch and is never printed; the figure a reader sees arrives already grouped
 * for the locale under its own placeholder.
 *
 * **Register.** The chrome addresses one traveller as `Anda` — polite, not
 * stiff — and keeps verbs in the plain form a button wants (`Buka`, `Bagikan`)
 * rather than the `-lah` imperative, which reads as an instruction from an
 * official form.
 *
 * **Length.** Indonesian runs long: `Perjalanan` is twice `Trips`. The tab bar
 * at 360px is what the `nav.*.short` keys exist for, so the short forms below
 * are one word each even where the long form is a phrase, and `nav.atlas`
 * becomes `Peta dunia` rather than a transliterated `Atlas` nobody would read
 * as a map of where they have been.
 *
 * **Three keys are shorter than a literal translation, and measurement is
 * why.** All three sit in a `.truncate` box the dashboard sizes from its
 * siblings, so a faithful phrase clips into an ellipsis and reads worse than a
 * shorter true one:
 *
 * - `dashboard.hero.dates` is `Tanggal`, not `Tanggal perjalanan` — 143px of
 *   copy in a 107px tile. The word sits in a row beside `Pelancong` and
 *   `Tempat`, where one noun is the register anyway.
 * - `dashboard.trips.label` is `Perjalanan`, not `Perjalanan Anda` — 120px in
 *   a 102px label. Indonesian drops a possessive in a heading readily, and the
 *   list underneath is plainly the reader's own.
 * - `bookingStatus.confirmed` is `Dipastikan`, not the loanword
 *   `Terkonfirmasi`. The badge and the date beside it share one row, so the
 *   badge's width comes straight off the date: `Terkonfirmasi` measured 89px
 *   and left the date 137px to draw `Sen, 12 Okt · 10:30 – 12:30` in, which
 *   needs 146px. `Dipastikan` measures 73px and gives the date 153px.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  'nav.primary': 'Bagian utama',
  'nav.mobile': 'Bagian',
  'nav.dashboardLink': 'Dasbor planned.travel',
  'nav.homeLink': 'Beranda planned.travel',
  'nav.newTrip': 'Perjalanan baru',
  'nav.trips': 'Perjalanan saya',
  'nav.trips.short': 'Perjalanan',
  'nav.vacay': 'Liburan',
  'nav.vacay.short': 'Libur',
  'nav.atlas': 'Peta dunia',
  'nav.atlas.short': 'Peta',
  'nav.journey': 'Jurnal',
  'nav.journey.short': 'Jurnal',

  'trip.nav.label': 'Bagian perjalanan',
  'trip.nav.back': 'Perjalanan',
  'trip.nav.share': 'Bagikan',
  'trip.nav.shareLabel': 'Bagikan perjalanan ini',
  'trip.tab.plan': 'Rencana',
  'trip.tab.transports': 'Transportasi',
  'trip.tab.book': 'Pesan',
  'trip.tab.lists': 'Daftar',
  'trip.tab.costs': 'Biaya',
  'trip.tab.files': 'Berkas',
  'trip.tab.collab': 'Bersama',

  'account.menu': 'Menu akun',
  'account.settings': 'Pengaturan',
  'account.billing': 'Paket dan tagihan',
  'account.admin': 'Administrator',
  'account.signOut': 'Keluar',
  'account.signingOut': 'Sedang keluar…',
  'account.signOutFailed': 'Anda tidak jadi keluar',
  'account.signOutFailedBody': 'Periksa koneksi Anda lalu coba lagi.',

  'theme.label': 'Tampilan',
  'theme.light': 'Terang',
  'theme.dark': 'Gelap',
  'theme.system': 'Ikuti sistem',
  'theme.state.light': 'terang',
  'theme.state.dark': 'gelap',
  'theme.state.system': 'mengikuti sistem',
  'theme.trigger': 'Tema: {state}. Ubah tema',

  'bell.none': 'Notifikasi, semua sudah dibaca',
  'bell.unread': { other: 'Notifikasi, {unread} belum dibaca' },

  'inbox.eyebrow': 'Kotak masuk',
  'inbox.title': 'Notifikasi',
  'inbox.error': 'Kotak masuk Anda gagal dimuat',
  'inbox.allRead': 'Semuanya sudah dibaca',
  'inbox.unread': { other: '{unread} pesan belum dibaca' },
  'inbox.markAll': 'Tandai semua dibaca',
  'inbox.markingAll': 'Menandai semuanya dibaca',
  'inbox.cleared': 'Kotak masuk sudah bersih',
  'inbox.markAllFailed': 'Semuanya gagal ditandai dibaca',
  'inbox.retryHint': 'Periksa koneksi Anda lalu coba lagi.',
  'inbox.filter.all': 'Semua',
  'inbox.filter.unread': 'Belum dibaca',
  'inbox.waiting': { other: '{invitations} undangan menunggu' },
  'inbox.empty.title': 'Kotak masuk Anda kosong',
  'inbox.empty.body':
    'Undangan perjalanan, perubahan rencana, pengingat pemesanan dan tagihan yang lunas semuanya mendarat di sini.',
  'inbox.empty.action': 'Kembali ke dasbor',
  'inbox.emptyUnread.title': 'Tidak ada yang belum dibaca',
  'inbox.emptyUnread.body':
    'Anda sudah membaca semuanya. Pindah ke Semua untuk menengok riwayatnya.',
  'inbox.emptyUnread.action': 'Tampilkan semua',
  'inbox.row.new': 'Baru',
  'inbox.row.accepted': 'Diterima',
  'inbox.row.declined': 'Ditolak',
  'inbox.row.open': 'Buka',
  'inbox.row.markRead': 'Dibaca',
  'inbox.row.markingRead': 'Menandai dibaca',
  'inbox.row.markReadFailed': 'Yang itu gagal ditandai dibaca',
  'inbox.preferences':
    'Pilih mana saja yang boleh sampai ke kotak masuk, email dan ponsel Anda.',
  'inbox.preferencesAction': 'Pengaturan notifikasi',

  'notification.trip.invited.title': 'Anda diundang ke {tripTitle}',
  'notification.trip.invited.body':
    '{actorName} menambahkan Anda ke perjalanan ini.',
  'notification.trip.updated.title': '{tripTitle} diperbarui',
  'notification.trip.updated.body': '{actorName} mengubah rencananya.',
  'notification.trip.member_added.title':
    '{memberName} bergabung ke {tripTitle}',
  'notification.trip.member_added.body':
    'Dia kini bisa melihat rencana, pemesanan dan keuangannya.',
  'notification.trip.member_removed.title':
    '{memberName} keluar dari {tripTitle}',
  'notification.trip.member_removed.body':
    'Aksesnya ke perjalanan ini sudah berakhir.',
  'notification.trip.starting_soon.title': {
    other: '{tripTitle} dimulai {days} hari lagi',
  },
  'notification.trip.starting_soon.body':
    'Saatnya memeriksa daftar bawaan dan pemesanannya.',
  'notification.reservation.reminder.title': '{title} sudah dekat',
  'notification.reservation.reminder.body':
    'Periksa jam dan kode konfirmasi pada pemesanannya.',
  'notification.reservation.confirmed.title': '{title} sudah dikonfirmasi',
  'notification.reservation.confirmed.body':
    'Pemesanan ini ditandai terkonfirmasi pada {tripTitle}.',
  'notification.expense.added.title': '{actorName} mencatat pengeluaran',
  'notification.expense.added.body': '{title} pada {tripTitle}.',
  'notification.expense.settled.title': '{actorName} sudah melunasi',
  'notification.expense.settled.body':
    'Tagihan pada {tripTitle} sudah dibayar.',
  'notification.list.assigned.title': '{actorName} memberi Anda satu tugas',
  'notification.list.assigned.body': '{title} pada {tripTitle}.',
  'notification.collab.message.title': '{actorName} menulis di {tripTitle}',
  'notification.collab.message.body': '“{preview}”',
  'notification.collab.poll.title': 'Ada jajak pendapat di {tripTitle}',
  'notification.collab.poll.body': '“{question}”',
  'notification.organization.invited.title':
    'Anda diundang ke {organizationName}',
  'notification.organization.invited.body':
    'Terima undangannya untuk masuk ke ruang kerja beserta semua isinya.',
  'notification.journey.published.title': '{title} sudah diterbitkan',
  'notification.journey.published.body':
    'Siapa pun yang punya tautannya kini bisa membaca jurnal itu.',
  'notification.billing.plan_changed.title': 'Paket Anda berubah',
  'notification.billing.plan_changed.body':
    '{organizationName} kini memakai paket {plan}.',
  'notification.fallback.title': 'Ada yang berubah di ruang kerja Anda',
  'notification.fallback.body': 'Buka perjalanannya untuk melihat apa itu.',

  'dashboard.error': 'Dasbor gagal dimuat',
  'dashboard.blank.title': 'Perjalanan Anda berikutnya dimulai di sini',
  'dashboard.blank.body':
    'Buat satu perjalanan, taruh tempat yang ingin Anda datangi di peta, dan planned.travel akan menyusun rencana harian di sekitarnya.',
  'dashboard.blank.action': 'Rencanakan perjalanan',
  'dashboard.blank.secondary': 'Lihat peta dunia Anda',

  'dashboard.upNext': 'Berikutnya',
  'dashboard.openPlan': 'Buka rencananya',
  'dashboard.hero.travellers': 'Pelancong',
  'dashboard.hero.travellersHint': 'di ruang kerja ini',
  'dashboard.hero.dates': 'Tanggal',
  'dashboard.hero.datesUnset': 'Belum diatur',
  'dashboard.hero.datesHint': { other: '{days} hari' },
  'dashboard.hero.datesMissing': 'Isi tanggalnya untuk menyusun hari',
  'dashboard.hero.startsIn': 'Dimulai dalam',
  'dashboard.hero.started': 'Sudah mulai',
  'dashboard.hero.today': 'Hari ini',
  'dashboard.hero.startUnknown': 'tanpa tanggal mulai',
  'dashboard.hero.startToday': 'semoga lancar di sana',
  'dashboard.hero.startPast': { other: 'hari lalu' },
  'dashboard.hero.startFuture': { other: 'hari' },
  'dashboard.hero.places': 'Tempat',
  'dashboard.hero.placesNone': 'belum ada yang dipetakan',
  'dashboard.hero.placesHint': 'di peta',

  'dashboard.stat.countries': 'Negara dikunjungi',
  'dashboard.stat.countriesUnit': 'dari {total}',
  'dashboard.stat.countriesNone':
    'Tandai satu negara untuk memulai peta dunia Anda',
  'dashboard.stat.visits': { other: '{visits} kunjungan tercatat' },
  'dashboard.stat.trips': 'Total perjalanan',
  'dashboard.stat.tripsCaption': '{planning} disusun · {booked} dipesan',
  'dashboard.stat.places': 'Tempat dipetakan',
  'dashboard.stat.placesNone': 'Belum ada apa pun di peta',
  'dashboard.stat.placesAcross': { other: 'tersebar di {trips} perjalanan' },
  'dashboard.stat.bookings': 'Pemesanan terkonfirmasi',
  'dashboard.stat.bookingsNone': 'Tidak ada pemesanan yang akan datang',
  'dashboard.stat.bookingsSoon': { other: '{bookings} pemesanan akan datang' },

  'dashboard.trips.label': 'Perjalanan',
  'dashboard.trips.all': 'Semua perjalanan',
  'dashboard.trips.empty.title': 'Belum ada perjalanan',
  'dashboard.trips.empty.body':
    'Semua yang Anda rencanakan muncul di sini, yang terbaru lebih dulu.',
  'dashboard.trips.empty.action': 'Buat perjalanan',

  'dashboard.bookings.label': 'Pemesanan mendatang',
  'dashboard.bookings.empty.title': 'Belum ada yang dipesan',
  'dashboard.bookings.empty.body':
    'Penginapan, meja dan tiket yang sudah pasti muncul di sini begitu tanggalnya mendekat.',

  'dashboard.pipeline.label': 'Alur perjalanan',
  'dashboard.pipeline.empty':
    'Alurnya masih kosong. Perjalanan pertama Anda akan diuraikan di sini per tahap.',
  'dashboard.pipeline.favourites': { other: '{favourites} favorit' },
  'dashboard.pipeline.archived': {
    other: '{archived} perjalanan diarsipkan',
  },

  'dashboard.storage.label': 'Penyimpanan',
  'dashboard.storage.count': '{used} dari {limit}',
  'dashboard.storage.files': {
    other: '{files} berkas di seluruh perjalanan, termasuk foto dan tiket.',
  },
  'dashboard.storage.more': 'Butuh ruang lagi?',
  'dashboard.storage.plans': 'Lihat paket',

  'admin.error': 'Konsol admin gagal dimuat',
  'admin.denied.title': 'Hanya admin ruang kerja yang bisa membuka ini',
  'admin.denied.body':
    'Minta pemilik atau admin ruang kerja ini mengubah peran Anda kalau memang perlu.',
  'admin.denied.action': 'Kembali ke dasbor',
  'admin.eyebrow': 'Admin ruang kerja',
  'admin.description': 'Paket {plan} · dibuat {date}',
  'admin.createdUnknown': 'baru-baru ini',
  'admin.workspaceSettings': 'Pengaturan ruang kerja',
  'admin.billing': 'Paket dan tagihan',

  'admin.invitations.title': {
    other: '{invitations} undangan masih menggantung',
  },
  'admin.invitations.body':
    'Setiap undangan yang menggantung ikut memakai kursi yang dibayar paket Anda.',
  'admin.invitations.action': 'Tinjau undangan',

  'admin.stat.members': 'Anggota',
  'admin.stat.membersCaption': { other: '{invitations} undangan tertunda' },
  'admin.stat.storage': 'Penyimpanan',
  'admin.stat.storageUnit': 'dari {limit}',
  'admin.stat.storageUnlimited': 'tanpa batas',
  'admin.stat.storageCaption': 'Berkas, foto dan ekspor',
  'admin.stat.audit': 'Catatan audit',
  'admin.stat.auditCaption': 'Aktivitas terbaru ditampilkan di bawah',
  'admin.stat.plan': 'Paket',
  'admin.stat.planCaption': 'Kuota ditegakkan di batas repositori',

  'admin.quotas.label': 'Kuota',
  'admin.quotas.count': { other: '{metrics} metrik' },
  'admin.quotas.unlimited': 'Tanpa batas',
  'admin.quotas.value': '{used} dari {limit}',

  'admin.members.label': 'Anggota',
  'admin.members.table': 'Anggota ruang kerja ini',
  'admin.members.person': 'Orang',
  'admin.members.role': 'Peran',
  'admin.members.joined': 'Bergabung',

  'admin.activity.label': 'Aktivitas terbaru',
  'admin.activity.empty.title': 'Belum ada yang tercatat',
  'admin.activity.empty.body':
    'Setiap perubahan yang penting dicatat ke jejak audit begitu terjadi.',
  'admin.activity.workspace': 'ruang kerja itu sendiri',
  'admin.actions.label': 'Tindakan tersibuk',
  'admin.actions.count': { other: '{actions} tindakan' },

  'tripStatus.draft': 'Konsep',
  'tripStatus.planning': 'Disusun',
  'tripStatus.booked': 'Dipesan',
  'tripStatus.active': 'Berjalan',
  'tripStatus.completed': 'Selesai',
  'tripStatus.archived': 'Diarsipkan',

  'bookingStatus.none': 'Belum dipesan',
  'bookingStatus.pending': 'Menunggu',
  'bookingStatus.confirmed': 'Dipastikan',
  'bookingStatus.cancelled': 'Dibatalkan',
  'bookingStatus.completed': 'Tuntas',

  'bookingType.accommodation': 'Menginap',
  'bookingType.restaurant': 'Meja',
  'bookingType.activity': 'Kegiatan',
  'bookingType.tour': 'Tur',
  'bookingType.ticket': 'Tiket',
  'bookingType.transport': 'Transportasi',
  'bookingType.other': 'Pemesanan',

  'role.owner': 'Pemilik',
  'role.admin': 'Administrator',
  'role.member': 'Anggota',

  'metric.trips': 'Perjalanan',
  'metric.places': 'Tempat',
  'metric.members': 'Anggota',
  'metric.files': 'Berkas',
  'metric.storage_bytes': 'Penyimpanan',
  'metric.collections': 'Koleksi',
  'metric.journeys': 'Jurnal',

  'error.title': 'Bagian ini gagal dimuat',
  'error.body':
    'Tidak ada yang hilang. Coba lagi, dan kalau terus terjadi, rincian di bawah inilah yang perlu Anda kirimkan ke kami.',
  'error.retry': 'Coba lagi',
  'error.dashboard': 'Kembali ke dasbor',
  'error.reported': 'Kami sudah menerima laporannya dan sedang memeriksanya.',
  'error.reference': 'Nomor referensi',
  'error.feedback.open': 'Ceritakan apa yang terjadi',
  'error.feedback.label': 'Apa yang sedang Anda lakukan saat ini terjadi?',
  'error.feedback.send': 'Kirim',
  'error.feedback.sent': 'Terima kasih — ini sangat membantu.',
  'error.feedback.failed':
    'Gagal terkirim. Nomor referensi di atas tetap sampai ke kami.',
  'error.root': 'Ada yang keluar jalur',
  'error.session': 'Akses ruang kerja Anda berubah',

  'notFound.eyebrow': 'Galat 404',
  'notFound.title': 'Halaman ini tidak ada di peta',
  'notFound.body':
    'Tautannya mungkin sudah kedaluwarsa, atau perjalanan yang ditunjuknya sudah dipindah atau dihapus.',
  'notFound.trips': 'Semua perjalanan',
  'notFound.rootBody':
    'Kami sudah mencari di sepanjang rute. Alamatnya mungkin salah ketik, atau halamannya sudah pindah.',
  'notFound.home': 'Kembali ke beranda',
  'notFound.plans': 'Lihat paketnya',

  'session.noWorkspace':
    'Akun Anda belum terhubung ke ruang kerja mana pun. Keluar lalu masuk lagi untuk menuntaskan penyiapannya.',
  'session.membershipRemoved':
    'Keanggotaan Anda di ruang kerja ini sudah dicabut.',
} satisfies TranslationOf<typeof En>

export default messages
