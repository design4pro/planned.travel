/**
 * Everything the settings module says, in Indonesian.
 *
 * Authored from `../en/settings`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Indonesian does not inflect for number, so `Intl.PluralRules` reports the
 * single category `other` and every `one`/`other` pair collapses to one branch.
 * `count` still selects it and is never printed; every figure a reader sees
 * arrives already grouped for the locale under its own placeholder.
 *
 * **Currency names are lower case**, which is Indonesian orthography for a unit
 * of money: `dolar Australia`, `euro`, `yen Jepang`. Only the country keeps its
 * capital. The ISO code beside them is derived in the route and is not a key.
 *
 * **Two channel names are translated rather than borrowed.** English `Email`
 * and `Push` are the same shape in Indonesian technical writing, but a column
 * header is exactly where a language should use its own word — so the matrix
 * reads `Surel` and `Perangkat`, and the hints under them say plainly which
 * address and which devices are meant. Running prose still says `email`, which
 * is what a traveller actually calls their inbox.
 *
 * **Plan names are words, not identifiers.** `free`, `solo` and `crew` are the
 * ids Polar and the invoice carry and no reader ever sees; the words on the
 * screen are `Gratis`, `Perorangan` and `Rombongan`.
 *
 * **Two keys are cut to a measured budget.** Both live in a `.truncate` box
 * whose width the screen fixes, so length is a correctness question here and
 * not a matter of taste:
 *
 * - `nav.profile.hint` gets 198px. `Anda, serta cara tanggal dan uang terbaca`
 *   measured 258px, so the hint is `Anda, tanggal dan format uang` (187px),
 *   which names the same three things without the relative clause.
 * - `regional.workspaceDefault` fills a select trigger 206px wide, and the
 *   longest value it ever carries is a date. `Setelan ruang kerja — 23 Jun
 *   2026` measured 215px; `Setelan bersama — ` brings it to 200px and still
 *   says the value is the workspace's rather than the reader's own.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  'page.eyebrow': 'Akun',
  'page.title': 'Pengaturan',
  'page.description':
    'Semua tentang Anda, ruang kerja Anda dan cara planned.travel bekerja',
  'page.error': 'Pengaturan gagal dimuat',

  'nav.label': 'Bagian pengaturan',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Anda, tanggal dan format uang',
  'nav.language': 'Bahasa',
  'nav.language.hint': 'Bahasa yang dipakai setiap layar',
  'nav.appearance': 'Tampilan',
  'nav.appearance.hint': 'Tema, gerak dan peta',
  'nav.security': 'Keamanan',
  'nav.security.hint': 'Kata sandi, dua langkah, kunci sandi',
  'nav.notifications': 'Notifikasi',
  'nav.notifications.hint': 'Kotak masuk, surel dan perangkat',
  'nav.workspace': 'Ruang kerja',
  'nav.workspace.hint': 'Anggota dan setelan bersama',
  'nav.billing': 'Tagihan',
  'nav.billing.hint': 'Paket, kursi dan faktur',

  'action.save': 'Simpan perubahan',
  'error.retryBody':
    'Tidak ada yang hilang. Periksa koneksi Anda lalu coba lagi.',
  'role.owner': 'Pemilik',
  'role.admin': 'Administrator',
  'role.member': 'Anggota',

  'regional.workspaceDefault': 'Setelan bersama — {value}',
  'regional.currency.AUD': 'dolar Australia',
  'regional.currency.CAD': 'dolar Kanada',
  'regional.currency.CHF': 'franc Swiss',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'poundsterling Inggris',
  'regional.currency.JPY': 'yen Jepang',
  'regional.currency.PLN': 'zloty Polandia',
  'regional.currency.SEK': 'krona Swedia',
  'regional.currency.USD': 'dolar AS',
  'regional.distance.metric': 'Kilometer',
  'regional.distance.imperial': 'Mil',

  'profile.error': 'Profil Anda gagal dimuat',
  'profile.account.title': 'Akun Anda',
  'profile.account.description':
    'Nama dan email Anda berasal dari akun yang Anda pakai untuk masuk.',
  'profile.email.verified': 'Email terverifikasi',
  'profile.email.unverified': 'Email belum terverifikasi',
  'profile.twoFactor.on': 'Dua langkah aktif',
  'profile.figure.workspace': 'Ruang kerja',
  'profile.figure.role': 'Peran',
  'profile.figure.joined': 'Anggota sejak',
  'profile.figure.joinedUnknown': 'Tidak tercatat',
  'profile.regional.title': 'Tanggal, uang dan satuan',
  'profile.regional.description':
    'Ini menimpa setelan ruang kerja untuk Anda seorang. Biarkan pada setelan bawaan dan ia ikut ruang kerja.',
  'profile.regional.saving': 'Menyimpan preferensi Anda',
  'profile.regional.saved': 'Preferensi Anda tersimpan',
  'profile.regional.saveFailed': 'Preferensi Anda gagal disimpan',
  'profile.language.label': 'Bahasa',
  'profile.language.hint':
    'Dipilih di layarnya sendiri, tempat setiap bahasa ditulis dengan aksaranya masing-masing.',
  'profile.language.action': 'Ubah',
  'profile.timezone.label': 'Zona waktu',
  'profile.timezone.hint':
    'Jam berangkat dan tiba ditampilkan menurut zona ini.',
  'profile.currency.label': 'Mata uang',
  'profile.currency.hint':
    'Perjalanan baru dimulai dengan mata uang ini; tiap perjalanan bisa menggantinya.',
  'profile.dateFormat.label': 'Format tanggal',
  'profile.weekStart.label': 'Pekan dimulai pada',
  'profile.weekStart.hint':
    'Berlaku untuk setiap kalender, termasuk kisi tahunan liburan.',
  'profile.distance.label': 'Jarak',

  'language.error': 'Pengaturan bahasa Anda gagal dimuat',
  'language.section.title': 'Bahasa',
  'language.section.description':
    'Setiap layar, setiap tombol dan setiap tanggal terbaca dalam bahasa yang Anda pilih di sini — dua puluh tiga bahasa, masing-masing ditulis dengan aksaranya sendiri.',
  'language.label': 'Pilih bahasa',
  'language.followWorkspace': 'Ikuti ruang kerja',
  'language.state.yours': 'Bahasa Anda',
  'language.state.workspace': 'Disediakan ruang kerja',
  'language.state.hint.override':
    'Pilihan Anda sendiri. Berlaku untuk Anda seorang, di semua perangkat tempat Anda masuk.',
  'language.state.hint.workspace':
    'Anda belum punya bahasa sendiri, jadi Anda membaca apa pun yang disetel ruang kerja. Pemilik atau administrator bisa mengubahnya lewat Ruang kerja.',
  'language.saved': 'planned.travel kini berbicara {language}',
  'language.saveFailed': 'Bahasa Anda tidak jadi diubah',
  'language.saveFailedBody':
    'Tidak ada yang hilang dan Anda masih membaca {language}. Periksa koneksi Anda, lalu pilih lagi.',
  'language.reload.title': 'Bahasa Anda sudah tersimpan',
  'language.reload.body':
    'Halaman ini tidak sempat beralih ke {language}. Muat ulang untuk membacanya dalam bahasa baru Anda.',
  'language.sample.title': 'Cara tanggal dan angka akan terbaca',
  'language.sample.description':
    'Tiga nilai yang sama, ditulis sebagaimana bahasa ini menuliskannya.',
  'language.sample.date': 'Sebuah tanggal',
  'language.sample.number': 'Sebuah angka',
  'language.sample.money': 'Sebuah nominal',
  'language.legal':
    'Ketentuan dan pemberitahuan privasi hanya diterbitkan dalam bahasa Inggris. Selebihnya diterjemahkan seluruhnya.',

  'appearance.error': 'Tampilan gagal dimuat',
  'appearance.theme.title': 'Tema',
  'appearance.theme.description':
    'Kedua tema dirancang sendiri-sendiri, bukan sekadar dibalik. Pilih yang paling nyaman Anda baca.',
  'appearance.theme.light': 'Terang',
  'appearance.theme.lightHint': 'Kertas hangat, sepanjang hari',
  'appearance.theme.dark': 'Gelap',
  'appearance.theme.darkHint': 'Arang hangat, tak pernah hitam pekat',
  'appearance.theme.system': 'Sistem',
  'appearance.theme.systemHint': 'Ikuti perangkat',
  'appearance.theme.showing': 'Saat ini menampilkan palet {palette}.',
  'appearance.theme.showingSystem':
    'Saat ini menampilkan palet {palette}, mengikuti perangkat Anda.',
  'appearance.palette.light': 'terang',
  'appearance.palette.dark': 'gelap',
  'appearance.motion.title': 'Gerak dan peta',
  'appearance.motion.label': 'Kurangi gerak',
  'appearance.motion.hint':
    'Menyederhanakan animasi masuk menjadi pudar biasa. Setelan kurangi-gerak pada sistem operasi Anda tetap selalu dihormati.',
  'appearance.map.label': 'Gaya peta',
  'appearance.map.hint':
    'Peta dasar yang dipakai di perencana dan di peta dunia.',
  'appearance.map.workspace': 'Ikuti ruang kerja',
  'appearance.map.workspaceHint': 'Apa pun yang dipilih pemilik ruang kerja.',
  'appearance.map.auto': 'Otomatis',
  'appearance.map.autoHint': 'Mengikuti tema terang atau gelap kamu.',
  'appearance.map.paper': 'Kertas',
  'appearance.map.paperHint': 'Hangat dan terang, apa pun temanya.',
  'appearance.map.charcoal': 'Arang',
  'appearance.map.charcoalHint': 'Hangat dan gelap, apa pun temanya.',
  'appearance.map.quiet': 'Tenang',
  'appearance.map.quietHint':
    'Tanpa nama jalan, supaya pin kamu terbaca lebih dulu.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Di layar bersama',
  'appearance.privacy.codesLabel':
    'Sembunyikan kode konfirmasi sampai saya memintanya',
  'appearance.privacy.codesHint':
    'Referensi pemesanan dan nomor konfirmasi tetap tersamar di meja pemesanan dan di transportasi sampai Anda mengarahkan kursor, memberi fokus, atau mengetuknya. Harga tidak pernah disembunyikan.',
  'appearance.saveFailed': 'Perubahan itu tidak tersimpan',
  'appearance.saveFailedBody':
    'Ia tampil di sini, tetapi perangkat berikutnya yang Anda pakai tidak akan mendapatkannya.',

  'security.error': 'Keamanan gagal dimuat',
  'security.unverified.title': 'Alamat email Anda belum terverifikasi',
  'security.unverified.body':
    'Pengaturan ulang kata sandi dan undangan perjalanan dikirim ke {email}. Verifikasi itulah yang membuktikan alamatnya milik Anda.',
  'security.unverified.action': 'Kirim tautannya lagi',
  'security.signin.title': 'Cara masuk',
  'security.signin.description':
    'Bagaimana Anda membuktikan diri. Verifikasi dua langkah dan kunci sandi sama-sama lebih kuat daripada kata sandi saja.',
  'security.email.label': 'Alamat email',
  'security.email.verified': 'Terverifikasi',
  'security.email.unverified': 'Belum terverifikasi',
  'security.password.label': 'Kata sandi',
  'security.password.hint':
    'Ubah kapan pun Anda mau — Anda akan dikirimi tautan sekali pakai, bukan ditanyai kata sandi lama.',
  'security.password.action': 'Ubah kata sandi',
  'security.twoFactor.label': 'Autentikasi dua langkah',
  'security.twoFactor.onHint':
    'Kode dari aplikasi autentikator wajib pada setiap proses masuk yang baru.',
  'security.twoFactor.offHint':
    'Tambahkan kode enam angka dari aplikasi autentikator di atas kata sandi Anda.',
  'security.twoFactor.on': 'Aktif',
  'security.twoFactor.off': 'Nonaktif',
  'security.twoFactor.manage': 'Kelola',
  'security.twoFactor.enable': 'Aktifkan',
  'security.passkeys.label': 'Kunci sandi',
  'security.passkeys.hint':
    'Masuk dengan pemindai sidik jari, Face ID atau kunci keamanan tanpa mengetik apa pun.',
  'security.passkeys.action': 'Kelola kunci sandi',
  'security.session.title': 'Sesi ini',
  'security.session.description': 'Peramban tempat Anda membaca ini.',
  'security.session.label': 'Masuk sebagai',
  'security.session.expires': 'Berakhir {date}',
  'security.session.expiresSoon': 'sebentar lagi',
  'security.session.noExpiry': 'Tidak ada catatan masa berlaku',
  'security.signOut.label': 'Keluar',
  'security.signOut.hint':
    'Mengakhiri sesi ini dan mengembalikan Anda ke halaman masuk. Perangkat lain tetap masuk.',
  'security.signOut.pending': 'Sedang keluar',
  'security.signOut.failed': 'Anda tidak jadi keluar',
  'security.signOut.failedBody': 'Periksa koneksi Anda lalu coba lagi.',

  'notifications.error': 'Pengaturan notifikasi gagal dimuat',
  'notifications.title': 'Notifikasi',
  'notifications.description':
    'Setiap sakelar berlaku untuk Anda seorang. Mematikannya tidak pernah menghentikan kejadiannya — hanya menghentikan kami memberi tahu Anda.',
  'notifications.caption': 'Notifikasi mana yang sampai ke tiap saluran',
  'notifications.event': 'Kejadian',
  'notifications.switch': '{event} lewat {channel}',
  'notifications.saveFailed': 'Preferensi itu tidak tersimpan',
  'notifications.saveFailedBody':
    'Sakelarnya sudah dikembalikan. Periksa koneksi Anda lalu coba lagi.',
  'notifications.channel.in_app': 'Aplikasi',
  'notifications.channel.in_app.hint': 'Lonceng di bilah atas',
  'notifications.channel.email': 'Surel',
  'notifications.channel.email.hint':
    'Dikirim ke alamat yang Anda pakai untuk masuk',
  'notifications.channel.push': 'Perangkat',
  'notifications.channel.push.hint': 'Di perangkat tempat Anda mengizinkannya',
  'notifications.event.trip.invited': 'Undangan perjalanan',
  'notifications.event.trip.invited.hint':
    'Seseorang menambahkan Anda ke perjalanan yang sedang ia susun.',
  'notifications.event.trip.updated': 'Perubahan rencana',
  'notifications.event.trip.updated.hint':
    'Satu hari, persinggahan atau tanggal bergeser pada perjalanan yang Anda ikuti.',
  'notifications.event.trip.starting_soon': 'Pengingat keberangkatan',
  'notifications.event.trip.starting_soon.hint':
    'Sentilan pada hari-hari menjelang perjalanan dimulai.',
  'notifications.event.reservation.reminder': 'Pengingat pemesanan',
  'notifications.event.reservation.reminder.hint':
    'Penginapan, meja atau tiket yang sudah dekat.',
  'notifications.event.expense.added': 'Pengeluaran baru',
  'notifications.event.expense.added.hint':
    'Seseorang mencatat uang yang dibelanjakan pada perjalanan bersama.',
  'notifications.event.expense.settled': 'Tagihan yang lunas',
  'notifications.event.expense.settled.hint':
    'Tagihan yang Anda ikut tanggung sudah dibayar.',
  'notifications.event.list.assigned': 'Tugas yang diberikan',
  'notifications.event.list.assigned.hint':
    'Sesuatu di daftar bawaan atau daftar kerja menjadi tanggung jawab Anda.',
  'notifications.event.collab.message': 'Obrolan perjalanan',
  'notifications.event.collab.message.hint':
    'Pesan baru di perjalanan yang sedang Anda tempuh.',
  'notifications.event.organization.invited': 'Undangan ruang kerja',
  'notifications.event.organization.invited.hint':
    'Anda diundang masuk ke sebuah ruang kerja.',

  'notifications.event.billing.plan_changed': 'Perubahan langganan',
  'notifications.event.billing.plan_changed.hint':
    'Ruang kerja Anda pindah ke paket lain.',
  'notifications.event.billing.invoice_paid': 'Bukti pembayaran',
  'notifications.event.billing.invoice_paid.hint':
    'Tagihan ruang kerja Anda sudah dibayar.',
  'notifications.event.billing.payment_failed': 'Masalah pembayaran',
  'notifications.event.billing.payment_failed.hint':
    'Penagihan untuk ruang kerja Anda gagal.',
  'workspace.error': 'Ruang kerja gagal dimuat',
  'workspace.summary.description': 'Paket {plan} · dibuat {date}',
  'workspace.summary.createdRecently': 'baru-baru ini',
  'workspace.summary.billingAction': 'Paket dan tagihan',
  'workspace.seats.label': 'Kursi terpakai',
  'workspace.seats.value': '{used} dari {limit}',
  'workspace.seats.note':
    'Undangan yang masih menggantung ikut memakai kursi, jadi sebuah ruang kerja tidak pernah bisa melampaui paket yang dibayarnya.',
  'workspace.seatsFull.title': 'Semua kursi pada paket ini sudah terisi',
  'workspace.seatsFull.body':
    '{members} dan {invitations} memenuhi seluruh {limit} kursi.',
  'workspace.seatsFull.action': 'Tambah kursi',
  'workspace.members.count': { other: '{value} anggota' },
  'workspace.invitations.count': { other: '{value} undangan tertunda' },
  'workspace.members.title': 'Anggota',
  'workspace.members.description':
    'Semua orang yang bisa melihat perjalanan, uang dan berkas di ruang kerja ini.',
  'workspace.members.tableLabel': 'Anggota ruang kerja ini',
  'workspace.members.person': 'Orang',
  'workspace.members.role': 'Peran',
  'workspace.members.joined': 'Bergabung',
  'workspace.invitations.title': 'Undangan',
  'workspace.invitations.description':
    'Orang-orang yang sudah diundang tetapi belum bergabung.',
  'workspace.invitations.emptyTitle': 'Tidak ada undangan yang menggantung',
  'workspace.invitations.emptyBody':
    'Semua yang diundang ke ruang kerja ini sudah bergabung.',
  'workspace.invitations.expires': 'Kedaluwarsa {date}',
  'workspace.invitations.expiresSoon': 'sebentar lagi',
  'workspace.defaults.title': 'Setelan bersama',
  'workspace.defaults.description':
    'Titik awal setiap perjalanan baru dan setiap anggota baru. Siapa pun bisa menggantinya untuk dirinya sendiri di profil.',
  'workspace.defaults.readOnly': 'Hanya baca',
  'workspace.defaults.saving': 'Menyimpan setelan ruang kerja',
  'workspace.defaults.saved': 'Setelan ruang kerja tersimpan',
  'workspace.defaults.saveFailed': 'Setelan ruang kerja gagal disimpan',
  'workspace.defaults.saveFailedBody':
    'Hanya pemilik atau administrator yang boleh mengubahnya. Periksa koneksi Anda, lalu coba lagi.',
  'workspace.currency.label': 'Mata uang bawaan',
  'workspace.currency.hint': 'Perjalanan baru dianggarkan dalam mata uang ini.',
  'workspace.language.label': 'Bahasa',
  'workspace.language.hint':
    'Yang dibaca anggota yang belum memilih bahasanya sendiri.',
  'workspace.timezone.label': 'Zona waktu',
  'workspace.dateFormat.label': 'Format tanggal',
  'workspace.weekStart.label': 'Pekan dimulai pada',
  'workspace.distance.label': 'Jarak',

  'billing.error': 'Tagihan gagal dimuat',
  'billing.loading': 'Memuat paket dan kuitansinya',
  'billing.status.none': 'Tanpa langganan',
  'billing.status.trialing': 'Masa coba',
  'billing.status.active': 'Aktif',
  'billing.status.past_due': 'Pembayaran gagal',
  'billing.status.unpaid': 'Belum dibayar',
  'billing.status.paused': 'Dijeda',
  'billing.status.canceled': 'Dibatalkan',
  'billing.status.incomplete': 'Belum tuntas',
  'billing.status.incomplete_expired': 'Kedaluwarsa',

  'billing.checkout.completeTitle': 'Pembayaran diterima',
  'billing.checkout.completeBody':
    'Paket baru Anda sedang diterapkan. Ia muncul di sini begitu Polar mengonfirmasinya — biasanya dalam beberapa detik.',
  'billing.checkout.cancelledTitle': 'Pembayaran dibatalkan',
  'billing.checkout.cancelledBody':
    'Tidak ada yang ditagih dan paket Anda tidak berubah.',
  'billing.portal.backTitle': 'Kembali dari Polar',
  'billing.portal.backBody':
    'Apa pun yang Anda ubah di sana mendarat di sini begitu Polar mengonfirmasinya.',
  'billing.refresh': 'Segarkan',
  'billing.readOnly.title': 'Anda anggota di ruang kerja ini',
  'billing.readOnly.body':
    'Hanya pemilik atau administrator yang bisa mengubah langganan. Semua di bawah ini hanya bisa Anda baca.',

  'billing.hero.label': 'Paket saat ini',
  'billing.hero.endsAtPeriod': 'Berakhir di penutup periode',
  'billing.hero.perYear': '/ tahun',
  'billing.hero.perMonth': '/ bulan',
  'billing.hero.freeAllowance': '{trips} perjalanan, satu pelancong',
  'billing.hero.perSeatLine': '{seats} anggota × {price}',
  'billing.hero.singleTraveller': 'Satu pelancong',
  'billing.price.free': 'Gratis',
  'billing.provider.opening': 'Membuka Polar',
  'billing.renewal.trialEndsToday':
    'Masa uji cobamu berakhir hari ini. Tagihan pertama menyusul kecuali kamu membatalkannya sebelum itu.',
  'billing.renewal.trialEndsIn': {
    other:
      'Masa uji cobamu berakhir dalam {value} hari, lalu tagihan pertama menyusul kecuali kamu membatalkannya sebelum itu.',
  },
  'billing.renewal.trialEnded': 'Masa coba Anda sudah berakhir.',
  'billing.renewal.endsNoDate':
    'Paket ini disetel berakhir dan tidak akan diperpanjang.',
  'billing.renewal.endsOn':
    'Paket ini berakhir pada {date}. Tidak ada yang dihapus — modul berbayarnya sekadar terkunci.',
  'billing.renewal.pastDue':
    'Pembayaran terakhir tidak berhasil. Perbarui kartu Anda supaya modul berbayarnya tidak hilang.',
  'billing.renewal.unpaid':
    'Langganan ini belum dibayar dan modul berbayarnya terkunci.',
  'billing.renewal.paused':
    'Langganan ini dijeda. Lanjutkan kapan pun Anda siap bepergian lagi.',
  'billing.renewal.lapsed':
    'Pilih paket di bawah untuk membuka lagi pemesanan, jurnal dan peta luring.',
  'billing.renewal.incomplete':
    'Polar masih menunggu pembayaran ini dikonfirmasi.',
  'billing.renewal.free':
    'Dua perjalanan sekaligus, gratis. Naikkan paket kapan pun Anda merasa sempit.',
  'billing.renewal.auto': 'Diperpanjang otomatis.',
  'billing.renewal.renewsOn': 'Diperpanjang pada {date}.',

  'billing.usage.title': 'Pemakaian',
  'billing.usage.description':
    'Dihitung langsung, jadi meterannya tidak pernah basi. Batasnya mengikuti paket yang berlaku sekarang.',
  'billing.quota.seats': 'Anggota',
  'billing.quota.trips': 'Perjalanan',
  'billing.quota.storageBytes': 'Penyimpanan',
  'billing.quota.unlimited': 'Tanpa batas',
  'billing.quota.noLimit': 'Tidak ada batas pada paket ini',
  'billing.quota.used': '{quota} terpakai',
  'billing.quota.over.seats': {
    other: '{value} kursi melebihi batas paket ini',
  },
  'billing.quota.over.trips': {
    other: '{value} slot perjalanan melebihi batas paket ini',
  },
  'billing.quota.over.storage': '{value} melebihi batas paket ini',
  'billing.quota.exhausted.seats': 'Semua kursi pada paket ini sudah terisi',
  'billing.quota.exhausted.trips':
    'Semua slot perjalanan pada paket ini sedang terpakai',
  'billing.quota.exhausted.storage': 'Penyimpanan pada paket ini sudah penuh',
  'billing.quota.left': 'sisa {value}',

  'billing.plans.title': 'Paket',
  'billing.plans.description':
    'Ganti paket kapan pun Anda mau. Kenaikan dihitung prorata harian; penurunan menunggu sampai periode yang sudah Anda bayar habis.',
  'billing.interval.label': 'Selang penagihan',
  'billing.interval.monthly': 'Bulanan',
  'billing.interval.yearly': 'Tahunan',
  'billing.plan.free.name': 'Gratis',
  'billing.plan.free.tagline': 'Rencanakan dua perjalanan berikutnya',
  'billing.plan.free.feature.trips': 'Dua perjalanan sekaligus',
  'billing.plan.free.feature.itinerary': 'Rencana harian dan peta',
  'billing.plan.free.feature.lists': 'Daftar bawaan dan anggaran sederhana',
  'billing.plan.free.feature.atlas':
    'Peta dunia yang melacak ke mana saja Anda pernah pergi',
  'billing.plan.solo.name': 'Perorangan',
  'billing.plan.solo.tagline':
    'Untuk pelancong yang merencanakan segala sesuatunya',
  'billing.plan.solo.feature.trips': 'Perjalanan tanpa batas',
  'billing.plan.solo.feature.modules':
    'Semua modul perencanaan — pemesanan, jurnal, anggaran, daftar bawaan',
  'billing.plan.solo.feature.offline':
    'Peta luring yang Anda unduh sebelum terbang',
  'billing.plan.solo.feature.export': 'Ekspor PDF dan kalender',
  'billing.plan.crew.name': 'Rombongan',
  'billing.plan.crew.tagline': 'Untuk keluarga, sahabat dan tim kecil',
  'billing.plan.crew.feature.members':
    'Sampai sepuluh anggota, ditagih per orang',
  'billing.plan.crew.feature.realtime':
    'Kolaborasi seketika dengan kursor yang hidup',
  'billing.plan.crew.feature.everything':
    'Perjalanan tanpa batas dan semua modul',
  'billing.plan.crew.feature.storage':
    'Ruang bersama untuk foto dan dokumen semua orang',

  'billing.plan.current': 'Paket saat ini',
  'billing.plan.currentBadge': 'Sekarang',
  'billing.plan.popular': 'Populer',
  'billing.plan.switchYearly': 'Ganti ke tahunan',
  'billing.plan.switchMonthly': 'Ganti ke bulanan',
  'billing.plan.upgradeTo': 'Naik ke {plan}',
  'billing.plan.changeTo': 'Ubah ke {plan}',
  'billing.plan.perMemberMonth': '/ anggota / bulan',
  'billing.plan.perMonth': '/ bulan',
  'billing.plan.alwaysFree': 'Selalu gratis, tanpa kartu',
  'billing.plan.billedYearly': '{amount} ditagih tahunan',
  'billing.plan.billedMonthly': '{amount} ditagih bulanan',
  'billing.plan.members': 'Anggota',
  'billing.plan.membersHint': 'Ubah kapan saja — tagihannya mengikuti.',
  'billing.plan.seatOption': { other: '{value} anggota' },

  'billing.invoices.number': 'Faktur',
  'billing.invoices.date': 'Tanggal',
  'billing.invoices.amount': 'Jumlah',
  'billing.invoices.status': 'Keadaan',
  'billing.invoice.paid': 'Lunas',
  'billing.invoice.draft': 'Konsep',
  'billing.invoice.void': 'Batal',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Penyedia pembayaran menolak permintaan itu. Coba lagi sebentar.',
  'billing.planChanged.title': 'Paket diperbarui',
  'billing.planChanged.body':
    'Perubahannya sudah berlaku di Polar, yang akan menagih selisihnya. Ringkasan di bawah menyusul dalam satu menit.',
  'billing.discount.toggle': 'Punya kode promo?',
  'billing.discount.label': 'Kode promo',
  'billing.discount.hint': 'Diterapkan ke paket yang Anda pilih berikutnya.',
  'billing.discount.applyCurrent': 'Terapkan ke paket saat ini',
  'billing.discount.invalidFormat':
    'Kode terdiri dari 3 hingga 64 huruf dan angka.',
  'billing.discount.rejected.invalid':
    'Kode itu tidak valid. Periksa dan coba lagi.',
  'billing.discount.rejected.rateLimited':
    'Terlalu banyak kode dicoba. Coba lagi dalam satu jam.',
  'billing.discount.rejected.notApplicable':
    'Kode itu tidak berlaku untuk paket ini.',
  'billing.discount.rejected.busy':
    'Kode tidak dapat diperiksa sekarang. Coba lagi dalam satu menit.',
  'billing.discount.nextRenewal':
    'Kode promo Anda berlaku mulai perpanjangan berikutnya.',
  'billing.discount.appliedTitle': 'Kode promo diterapkan',
  'billing.hero.manage': 'Kelola penagihan',
  'billing.hero.manageHint':
    'Kartu, alamat penagihan, NPWP, tanda terima, dan pembatalan ada di Polar, yang menerbitkan tagihannya.',
  'billing.hero.manageHintNone':
    'Belum ada profil penagihan. Memilih paket berbayar di bawah akan membuatnya, dan sejak itu portalnya terbuka.',
  'billing.portal.opening': 'Membuka portal penagihan',
  'billing.plan.notApplied': 'Perubahan itu tidak diterapkan',
  'billing.plan.cancelInPortal': 'Batalkan di portal',
  'billing.plan.seatsOverMax': {
    other:
      'Ruang kerja ini punya {members} anggota dan {plan} menagih paling banyak {max}. Keluarkan {value} anggota sebelum berpindah.',
  },
  'billing.plan.seatsBelowMembers':
    'Kamu punya {members} anggota. Pilih setidaknya sebanyak itu kursi — Polar menolak langganan dengan kursi lebih sedikit daripada penugasan.',
  'billing.orders.title': 'Pesanan',
  'billing.orders.description': 'Setiap pesanan ruang kerja ini, terbaru dulu.',
  'billing.orders.receipts': 'Semua tanda terima',
  'billing.orders.unavailableTitle': 'Pesanan tidak termuat',
  'billing.orders.unavailableBody':
    'Polar tidak menjawab tepat waktu untuk riwayatnya. Semua di atas masih hidup — coba lagi sebentar, atau baca catatan lengkapnya di portal penagihan.',
  'billing.orders.emptyTitle': 'Belum ada pesanan',
  'billing.orders.emptyCustomer':
    'Tagihan pertama muncul di sini begitu satu periode penagihan ditutup.',
  'billing.orders.emptyNoCustomer':
    'Ruang kerja ini belum pernah ditagih. Pilih paket berbayar dan tagihannya akan berkumpul di sini.',
  'billing.orders.tableLabel': 'Riwayat pesanan',
  'billing.orders.document': 'Dokumen',
  'billing.orders.dateUnknown': 'Tanggal tidak diketahui',
  'billing.order.pending': 'Menunggu',
  'billing.order.refunded': 'Dikembalikan',
  'billing.order.partiallyRefunded': 'Dikembalikan sebagian',
  'billing.order.noInvoiceDraft': 'Tidak ada tagihan selama pesanan masih draf',
  'billing.order.preparing': 'Menyiapkan',
  'billing.order.renderingHint':
    'Polar masih membuat tagihan {number}. Unduhannya kembali dalam beberapa detik.',
  'billing.order.fetching': 'Mengambil tagihan',
  'billing.order.generating': 'Polar sedang menyiapkan tagihan',
  'billing.order.pdfLabel': 'Tagihan {number} sebagai PDF',
  'billing.order.stillWritingTitle': 'Polar masih menulis tagihan itu',
  'billing.order.stillWritingBody':
    'Tagihan {number} sedang dibuat. Unduhannya kembali sendiri dalam beberapa detik.',
  'billing.order.openFailed': 'Tagihan itu tidak terbuka',
} satisfies TranslationOf<typeof En>

export default messages
