/**
 * The trip modules' own copy, in id.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Jamak.** Bahasa Indonesia hanya punya cabang `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Belum diatur',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Menyambung',
  'presence.connecting.body': 'Masuk ke ruang langsung perjalanan ini.',
  'presence.live.title': 'Langsung',
  'presence.live.body':
    'Pesan, catatan, dan suara masuk ke sini begitu dibuat.',
  'presence.reconnecting.title': 'Menyambung ulang',
  'presence.reconnecting.body':
    'Sambungan terputus. Mencoba lagi — apa pun yang kamu kirim tetap tersimpan.',
  'presence.offline.title': 'Tidak langsung',
  'presence.offline.body':
    'Pembaruan langsung sedang mati. Penyimpanan tetap jalan; muat ulang atau coba lagi untuk menyusul.',
  'presence.reconnect': 'Sambung ulang',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Semua transportasi',
  'transports.empty.title': 'Belum ada transportasi',
  'transports.empty.body':
    'Penerbangan, kereta, feri, dan perjalanan dari bandara semuanya tinggal di sini, dengan kode pemesanan dan nomor tempat duduk siap di hari-H — dan setiap perpindahan diperiksa terhadap yang sebelumnya.',
  'transports.empty.action': 'Tambahkan transportasi pertama',
  'transports.filtered.title': 'Tidak ada transportasi jenis itu',
  'transports.filtered.body':
    'Setiap transportasi perjalanan ini ditempuh dengan cara berbeda. Kembali ke “{label}” untuk melihat semuanya.',
  'transports.filtered.action': 'Tampilkan semua transportasi',
  'transports.alert.impossible.title': {
    other: '{value} perpindahan tidak mungkin',
  },
  'transports.alert.impossible.body':
    'Sebuah transportasi berangkat sebelum yang sebelumnya tiba. Titik sambung di bawah menyebut yang mana dan selisihnya.',
  'transports.alert.tight.title': {
    other: '{value} perpindahan terlalu mepet',
  },
  'transports.alert.tight.body':
    'Waktunya ada, tapi tidak banyak untuk moda yang harus kamu kejar. Titik sambung di bawah menunjukkan sisa waktu masing-masing.',
  'transports.badge.impossible': {
    other: '{value} perpindahan rusak',
  },
  'transports.badge.tight': {
    other: '{value} perpindahan mepet',
  },
  'transports.badge.ok': 'Semua perpindahan aman',
  'transports.remove.body':
    'Transportasi ini keluar dari perjalanan untuk selamanya, bersama nomor pemesanan dan tempat duduknya. Kalau hanya dibatalkan, ubah statusnya menjadi “Dibatalkan” saja.',
  'transports.remove.confirm': 'Hapus transportasi',
  'transports.menu.edit': 'Ubah transportasi…',
  'transports.field.service': 'Nomor layanan',
  'transports.field.bookingRef': 'Nomor pemesanan',
  'transports.field.seat': 'Tempat duduk',
  'transports.field.distance': 'Jarak',
  'transports.noTime': 'Belum ada waktu',
  'transports.toast.statusFailed.title': 'Status tidak berubah',
  'transports.toast.statusFailed.body':
    'Transportasi masih dalam keadaan sebelumnya.',
  'transports.toast.removed': 'Transportasi dihapus',
  'transports.toast.removeFailed': 'Transportasi tidak terhapus',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Tambah satu transportasi',
  'transports.dialog.editTitle': 'Ubah transportasi ini',
  'transports.dialog.description':
    'Penerbangan, kereta, feri, dan perjalanan dari bandara. Waktunya waktu setempat yang tercetak di tiket.',
  'transports.form.modeLegend': 'Kamu naik apa',
  'transports.form.timingError': 'Periksa waktunya',
  'transports.field.namePlaceholder': 'Garuda dari CGK ke HND',
  'transports.field.place': 'Tempat',
  'transports.field.code': 'Kode',
  'transports.field.date': 'Tanggal',
  'transports.field.time': 'Berangkat setelah',
  'transports.field.departurePlaceholder': 'Jakarta Soekarno-Hatta',
  'transports.field.arrivalPlaceholder': 'Bandara Tokyo Haneda',
  'transports.field.carrier': 'Maskapai',
  'transports.field.serviceNumber': 'Nomor layanan',
  'transports.field.bookingRefHint': 'Kode yang akan kamu sebut di konter.',
  'transports.field.notesPlaceholder':
    'Minta kursi dekat lorong. Bagasi dikirim langsung sampai Kyoto.',
  'transports.action.add': 'Tambah transportasi',
  'transports.action.save': 'Simpan transportasi',
  'transports.action.saving': 'Menyimpan transportasi',
  'transports.toast.added': 'Transportasi ditambahkan',
  'transports.toast.addedBody': 'Sekarang sudah masuk urutan perjalanan.',
  'transports.toast.addFailed': 'Transportasi tidak ditambahkan',
  'transports.toast.updated': 'Transportasi diperbarui',
  'transports.toast.updateFailed': 'Transportasi tidak diperbarui',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Nama',
  'field.time': 'Waktu',
  'field.price': 'Harga',
  'field.notes': 'Catatan',
  'field.status': 'Keadaan',
  'form.saveError': 'Itu tidak tersimpan',
  'action.cancel': 'Batal',
  'action.showCode': 'Tampilkan {label}',
  'book.status.none': 'Belum ada keadaan',
  'book.status.pending': 'Menunggu',
  'book.status.confirmed': 'Terkonfirmasi',
  'book.status.completed': 'Selesai',
  'book.status.cancelled': 'Dibatalkan',
  'book.toast.statusFailed': 'Keadaan tidak berubah',
  'book.toast.statusFailedBody': 'Pemesanan masih dalam keadaan sebelumnya.',
  'book.toast.removed': 'Pemesanan dihapus',
  'book.toast.removeFailed': 'Pemesanan tidak terhapus',
  'book.empty.title': 'Belum ada yang dipesan',
  'book.empty.body':
    'Penginapan, meja, tur, dan tiket tempatnya di sini — dengan nomor konfirmasi di tempat kamu akan mencarinya di pintu, dan tanggal yang menaruhnya di garis waktu.',
  'book.empty.action': 'Tambahkan pemesanan pertama',
  'book.filtered.title': 'Belum ada yang seperti itu',
  'book.filtered.body':
    'Tidak ada pemesanan dari jenis yang kamu pilih di sini. Hapus filter untuk melihat sisanya.',
  'book.filtered.action': 'Hapus filter',
  'book.panel.outstanding': 'Masih harus dibereskan',
  'book.panel.outstandingEmpty':
    'Tidak ada yang tertunda — semua di sini sudah beres.',
  'book.panel.settled': 'Beres',
  'book.panel.settledEmpty':
    'Belum ada yang beres — semuanya masih harus dikejar.',
  'book.import.badge': 'Impor belum diperiksa',
  'book.import.hint':
    'Diimpor dari sebuah konfirmasi. Buka dan simpan untuk menandainya sudah diperiksa.',
  'book.import.action': 'Impor',
  'book.import.title': 'Impor pemesanan dari berkas',
  'book.import.description':
    'Jatuhkan satu konfirmasi dan kami akan membacanya. Tidak ada yang masuk ke perjalanan sebelum kamu melihatnya.',
  'book.import.drop.idle': 'Jatuhkan berkas di sini, atau pilih sendiri',
  'book.import.drop.active': 'Lepaskan untuk menambahkan',
  'book.import.drop.formats':
    'PDF, surel tersimpan, halaman web, foto, Word, Excel, berkas kalender, atau ekspor JSON.',
  'book.import.drop.limits':
    'Sampai {files} berkas sekaligus, masing-masing sampai {size}.',
  'book.import.drop.browse': 'Pilih berkas',
  'book.import.refused.format':
    '“{filename}” bukan berkas yang bisa dibaca impor ini. Yang dibaca: PDF, surel tersimpan, halaman web, foto, dokumen Word atau Excel, berkas kalender, atau ekspor JSON.',
  'book.import.refused.tooMany':
    'Hanya {files} berkas sekaligus. Sisanya tidak ditambahkan.',
  'book.import.refused.tooLarge':
    '“{filename}” berukuran {size}. Impor membaca berkas sampai {limit}.',
  'book.import.refused.empty':
    '“{filename}” kosong, jadi tidak ada yang bisa dibaca.',
  'book.import.ceiling.title':
    'Ruang kerja ini sudah membaca semua konfirmasinya bulan ini',
  'book.import.ceiling.body':
    'Paketnya mencakup {ceiling} pembacaan berkas per bulan, dan kuotanya berganti pada tanggal satu. Kamu masih bisa menambah pemesanan secara manual.',
  'book.import.ceiling.none':
    'Membaca berkas konfirmasi tidak termasuk dalam paket ruang kerja ini',
  'book.import.ceiling.noneBody':
    'Naikkan paket agar konfirmasi dibacakan untukmu. Menambah pemesanan secara manual selalu tersedia.',
  'book.import.widget.title': 'Membaca konfirmasi',
  'book.import.widget.working': '{done} dari {total} terbaca',
  'book.import.widget.file': 'Membaca “{filename}”',
  'book.import.widget.done': {
    other: '{count} pemesanan siap ditinjau',
  },
  'book.import.widget.review': 'Tinjau',
  'book.import.widget.failed': '“{filename}” tidak terbaca',
  'book.import.widget.stalled': 'Ini lebih lama dari perkiraan',
  'book.import.widget.check': 'Periksa lagi',
  'book.import.widget.dismiss': 'Tutup',
  'book.import.review.title': 'Yang kami baca',
  'book.import.review.from': 'Dari “{filename}”',
  'book.import.review.selectAll': 'Pilih semua',
  'book.import.review.selectNone': 'Jangan pilih apa pun',
  'book.import.review.confirm': {
    other: 'Tambah {count} pemesanan',
  },
  'book.import.review.confirmNone': 'Pilih satu pemesanan untuk ditambahkan',
  'book.import.review.cancel': 'Batal',
  'book.import.review.needsReview': 'Perlu dilihat',
  'book.import.review.needsReviewHint':
    'Beberapa kolom tidak ada di dokumen. Buka pemesanannya setelah ditambahkan.',
  'book.import.review.noPrice': 'Harga tidak terbaca',
  'book.import.review.noPriceHint':
    'Dokumennya tidak menyebutkannya dengan jelas, jadi dibiarkan kosong alih-alih dikira-kira.',
  'book.import.review.untitled': 'Pemesanan tanpa judul',
  'book.import.empty.title': 'Kami tidak menemukan pemesanan di berkas itu',
  'book.import.empty.body':
    '“{filename}” tidak memuat apa pun yang menyerupai konfirmasi. Coba berkas lain, atau tambahkan pemesanannya secara manual.',
  'book.import.failed.title': '“{filename}” tidak terbaca',
  'book.import.failed.body':
    'Berkasnya terbuka tapi tidak ada yang bisa disusun darinya. Coba berkas lain, atau tambahkan pemesanannya secara manual.',
  'book.import.failed.retry': 'Coba berkas lain',
  'book.import.uploadFailed': '“{filename}” gagal diunggah',
  'book.import.uploadRetry': 'Coba lagi',
  'book.import.actionFailed': 'Coba lagi sebentar lagi.',
  'book.import.toast.added': {
    other: '{count} pemesanan ditambahkan',
  },
  'book.import.partial.title': '{written} dari {total} pemesanan ditambahkan',
  'book.import.partial.body':
    'Sisanya masih terpilih. Menambahkan lagi hanya menulis yang itu.',
  'book.import.partial.retry': 'Tambahkan sisanya',
  'book.journeyLink': 'Di tab transportasi',
  'filter.all': 'Semua',
  'book.remove.body':
    'Ia keluar dari garis waktu untuk selamanya. Kalau hanya dibatalkan, ubah keadaannya menjadi “Dibatalkan” agar catatannya tetap ada.',
  'book.remove.confirm': 'Hapus pemesanan',
  'book.menu.edit': 'Ubah pemesanan…',
  'book.menu.open': 'Buka pemesanan',
  'book.noDate': 'Belum ada tanggal',
  'book.until': 'Sampai',
  'book.provider': 'Penyedia',
  'book.where': 'Di mana',
  'book.guests': 'Orang',
  'book.confirmation': 'Konfirmasi',
  'book.undated': 'Beri tanggal dan mereka masuk garis waktu',
  statusOf: 'Keadaan {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Belum ada keadaan sama sekali',
  'book.statusChoice.pending': 'Menunggu — bola di tangan mereka',
  'book.dialog.addTitle': 'Tambah satu pemesanan',
  'book.dialog.editTitle': 'Ubah pemesanan ini',
  'book.dialog.typeLegend': 'Pemesanan jenis apa',
  'book.field.namePlaceholder': 'Jl. Thamrin 15',
  'book.field.priceHint': 'Biarkan kosong kalau belum dibayar.',
  'book.field.confirmation': 'Nomor konfirmasi',
  'book.field.confirmationHint': 'Kode yang akan diminta di konter.',
  'book.field.day': 'Kaitkan ke satu hari',
  'book.field.dayHint': 'Menyematkannya ke rencana supaya muncul di jadwal.',
  'book.field.noDay': 'Di luar rencana perjalanan',
  'book.field.link': 'Tautan',
  'book.field.notesPlaceholder':
    'Sudah diatur check-in malam. Minta kamar jauh dari lift.',
  'book.action.add': 'Tambah pemesanan',
  'book.action.save': 'Simpan pemesanan',
  'book.action.saving': 'Menyimpan pemesanan',
  'book.toast.added': 'Pemesanan ditambahkan',
  'book.toast.addedBody': 'Sekarang sudah ada di garis waktu.',
  'book.toast.addFailed': 'Pemesanan tidak ditambahkan',
  'book.toast.updated': 'Pemesanan diperbarui',
  'book.toast.updateFailed': 'Pemesanan tidak diperbarui',

  'book.emptyFacts':
    'Selain namanya belum ada apa-apa. Buka untuk menambahkan waktu, harga, dan nomor konfirmasi.',
  'book.onItinerary': 'Ada di rencana perjalanan: {day}',
  'book.dayNumber': 'Hari {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Lainnya',
  'book.field.host': 'Hotel atau tuan rumah',
  'book.field.restaurant': 'Nama restoran',
  'book.field.operator': 'Penyelenggara',
  'book.field.issuer': 'Diterbitkan oleh',
  'book.field.carrier': 'Pengangkut',
  'book.field.address': 'Alamat',
  'book.field.meetingPoint': 'Titik temu',
  'book.field.venue': 'Lokasi acara',
  'book.field.fromTo': 'Dari dan ke',
  'book.field.checkIn': 'Check-in',
  'book.field.date': 'Tanggal',
  'book.field.validOn': 'Berlaku pada',
  'book.field.departs': 'Berangkat',
  'book.field.checkOut': 'Check-out',
  'book.field.ends': 'Berakhir',
  'book.field.arrives': 'Tiba',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Museum Ghibli',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Siapa yang menahannya untukmu',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 kamar twin',
  'book.example.restaurantTitle': 'Makan malam di Den',
  'book.example.activityTitle': 'teamLab Planets, 4 tiket',
  'book.example.tourTitle': 'Jalan-jalan di hutan bambu Arashiyama',
  'book.example.ticketTitle': 'Museum Ghibli, masuk 10:00',
  'book.example.transportTitle': 'Nozomi 21 ke Kyoto',
  'book.example.otherTitle': 'Apa yang kamu pesan',
  'book.hint.accommodation':
    'Hotel, ryokan, apartemen — di mana pun kamu tidur.',
  'book.hint.restaurant': 'Meja yang sudah dipesan. Jamnya yang akan dipegang.',
  'book.hint.activity':
    'Sebuah kelas, pemandian, pengalaman yang sudah dipesan.',
  'book.hint.tour': 'Satu tempat, satu jam, dan pemandu yang menunggu.',
  'book.hint.ticket':
    'Masuk berjadwal, pas museum, sebuah pertandingan. Simpan kodenya dekat.',
  'book.hint.transport':
    'Kursi yang sudah dipesan. Transportasi lengkap berkode masuk ke {module}.',
  'book.hint.other':
    'Apa pun yang ditahan atas namamu dan tidak cocok di yang lain.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Berkemas',
  'lists.kind.todo': 'Daftar tugas',
  'lists.kind.shopping': 'Belanja',
  'lists.kind.documents': 'Dokumen',
  'lists.kind.fallback': 'Daftar',
  'colour.none': 'Tanpa warna',
  'colour.pine': 'Hijau pinus',
  'colour.inkBlue': 'Biru tinta',
  'colour.amber': 'Kuning ambar',
  'colour.green': 'Hijau',
  'colour.red': 'Merah',
  'colour.slate': 'Kelabu batu',
  'lists.toast.created': 'Daftar dibuat',
  'lists.toast.createdBody':
    'Masukkan hal pertama yang tidak boleh kamu lupakan.',
  'lists.toast.createFailed': 'Daftar tidak dibuat',
  'lists.toast.updated': 'Daftar diperbarui',
  'lists.toast.updateFailed': 'Daftar tidak diperbarui',
  'lists.error.weightLimit': 'Batas berat adalah bilangan bulat dalam gram.',
  'lists.dialog.editTitle': 'Ubah daftar ini',
  'lists.dialog.editBody':
    'Ganti namanya, ganti jenisnya, atau serahkan ke satu orang.',
  'lists.dialog.addBody':
    'Berkemas, tugas, belanja, dan dokumen yang tidak boleh kamu lupakan — masing-masing dapat daftarnya sendiri.',
  'lists.action.new': 'Daftar baru',
  'lists.field.namePlaceholder': 'Bagasi kabin',
  'lists.field.kind': 'Jenis',
  'lists.field.kindAria': 'Jenis daftar',
  'lists.field.owner': 'Milik',
  'lists.field.ownerHint': 'Daftar bersama bisa dicentang siapa saja.',
  'lists.field.everyone': 'Semua orang di perjalanan',
  'lists.field.weightLimit': 'Batas berat',
  'lists.field.weightLimitHint':
    'Gram. Biarkan kosong kalau tidak ada batas yang harus dijaga.',
  'colour.legend': 'Warna',
  'lists.action.saving': 'Menyimpan daftar',
  'lists.action.save': 'Simpan daftar',
  'lists.action.create': 'Buat daftar',
  'lists.item.toast.added': 'Butir ditambahkan',
  'lists.item.toast.addFailed': 'Butir tidak ditambahkan',
  'lists.item.toast.updated': 'Butir diperbarui',
  'lists.item.toast.updateFailed': 'Butir tidak diperbarui',
  'lists.item.error.quantity':
    'Jumlah adalah bilangan bulat dari 1 sampai 999.',
  'lists.item.error.weight': 'Berat adalah bilangan bulat dalam gram.',
  'lists.item.dialog.editTitle': 'Ubah butir ini',
  'lists.item.dialog.addTitle': 'Tambah satu butir',
  'lists.item.field.label': 'Butir',
  'lists.item.field.placeholder': 'Paspor',
  'field.category': 'Kategori',
  'lists.item.field.categoryHint':
    'Mengelompokkan daftar di bawah satu judul. Opsional.',
  'lists.item.field.categoryPlaceholder': 'Dokumen',
  'lists.item.field.priority': 'Prioritas',
  'lists.priorityChoice.high': 'Tinggi — jangan lupa',
  'lists.priorityChoice.low': 'Rendah — kalau masih ada ruang',
  'lists.priorityChoice.normal': 'Biasa',
  'lists.item.field.quantity': 'Jumlah',
  'lists.item.field.weight': 'Berat',
  'lists.item.field.weightHint': 'Gram, per satuan.',
  'lists.item.field.owner': 'Ini tugas siapa',
  'lists.item.owner.nobody': 'Tidak ada orang tertentu',
  'lists.item.action.saving': 'Menyimpan butir',
  'lists.item.action.save': 'Simpan butir',
  'lists.item.action.add': 'Tambahkan ke daftar',
  'lists.template.loadError': 'Templat tidak bisa dimuat sekarang.',
  'lists.template.toast.added': 'Daftar ditambahkan dari templat',
  'lists.template.toast.addFailed': 'Templat tidak diterapkan',
  'lists.template.error.apply': 'Itu tidak bisa diterapkan',
  'lists.template.error.load': 'Templat tidak termuat',
  'lists.template.empty.title': 'Belum ada templat',
  'lists.template.empty.body':
    'Simpan sebuah daftar sebagai templat begitu kamu punya satu yang akan kamu susun sama lagi, dan ia akan muncul di sini untuk setiap perjalanan berikutnya.',
  'lists.template.applying': 'Menerapkan templat',
  'lists.template.dialogTitle': 'Mulai dari templat',
  'lists.template.loading': 'Memuat templat',
  'lists.template.apply': 'Terapkan templat',
  'lists.template.from': 'Dari templat',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Belum ada penanggung jawab',
  'lists.toast.listRemoved': 'Daftar dihapus',
  'lists.toast.listRemoveFailed': 'Daftar tidak dihapus',
  'lists.toast.itemRemoved': 'Butir dihapus',
  'lists.toast.itemRemoveFailed': 'Butir tidak dihapus',
  'lists.toast.reset': 'Daftar disetel ulang',
  'lists.toast.resetBody':
    'Semua centang sudah dilepas dan siap untuk perjalanan berikutnya.',
  'lists.toast.resetFailed': 'Daftar tidak disetel ulang',
  'lists.toast.tickFailed': 'Centang itu tidak tersimpan',
  'lists.toast.tickFailedBody': 'Butir sudah kembali seperti semula.',
  'lists.toast.assignFailed': 'Penugasan itu tidak tersimpan',
  'lists.toast.orderFailed': 'Urutan baru tidak tersimpan',
  'lists.toast.orderFailedBody': 'Daftar sudah kembali seperti semula.',
  'lists.filter.todo': 'Masih harus dikerjakan',
  'lists.filter.done': 'Selesai',
  'lists.scope.all': 'Semua daftar',
  'lists.scope.shared': 'Bersama',
  'lists.scope.mine': 'Milikku',
  'lists.empty.mine.title': 'Belum ada daftar milikmu sendiri',
  'lists.empty.shared.title': 'Belum ada daftar bersama',
  'lists.empty.mine.body':
    'Daftar milikmu sendiri hanya kamu yang mencentang — enak untuk hal yang tak perlu dilihat orang lain.',
  'lists.empty.shared.body':
    'Daftar bersama bisa dicentang siapa saja, jadi dua orang tidak membawa adaptor yang sama.',
  'lists.remove.list': 'Hapus daftar',
  'lists.remove.item': 'Hapus butir',
  'lists.remove.itemBody':
    'Ia keluar dari daftar ini. Tidak ada yang lain berubah.',
  'lists.menu.editList': 'Ubah daftar…',
  'lists.menu.tickAll': 'Centang semua',
  'lists.menu.untickAll': 'Lepas semua centang',
  'lists.menu.reset': 'Setel ulang untuk perjalanan berikutnya',
  'lists.menu.dragOrderLong': 'Beralih ke satu urutan yang bisa kamu geser',
  'lists.menu.groupAgain': 'Kelompokkan menurut kategori lagi',
  'lists.menu.dragOrder': 'Beralih ke urutan yang bisa digeser',
  'lists.menu.groupByCategory': 'Kelompokkan menurut kategori',
  'lists.weight.packed': 'Sudah dikemas {weight}',
  'lists.weight.packedOver': 'Sudah dikemas {weight} — melewati batas',
  'lists.weight.packedOf': 'Sudah dikemas {weight} dari {limit} yang boleh',
  'lists.weight.packedOfOver':
    'Sudah dikemas {weight} dari {limit} yang boleh — melewati batas',
  'lists.progress.ticked': 'Dicentang {done} dari {total}',
  'lists.items.empty.title': 'Daftar ini kosong',
  'lists.items.empty.body':
    'Masukkan hal pertama yang tidak boleh kamu lupakan — kolom di bawah paling cepat.',
  'lists.items.doneEmpty.title': 'Belum ada yang dicentang',
  'lists.items.doneEmpty.body': 'Centang sesuatu dan ia akan muncul di sini.',
  'lists.items.todoEmpty.title': 'Di sini semuanya sudah selesai',
  'lists.items.todoEmpty.body':
    'Setiap butir di daftar ini sudah dicentang. Beralih ke “{label}” untuk melihatnya.',
  'lists.category.other': 'Semua sisanya',
  'lists.dnd.fallbackName': 'butir ini',
  'lists.dnd.picked': '{name} diangkat.',
  'lists.dnd.dropped': '{name} diletakkan. Urutan baru sedang disimpan.',
  'lists.dnd.cancelled': 'Dibatalkan. Urutannya tidak berubah.',
  'lists.menu.editItem': 'Ubah butir…',
  'lists.quickAdd.placeholder': 'Tulis satu butir lalu tekan Enter',
  'lists.quickAdd.aria': 'Tambahkan satu butir ke daftar ini',
  'lists.quickAdd.detailsHint': 'Tambahkan dengan berat, kategori, atau orang',
  'lists.quickAdd.detailsAria': 'Tambahkan satu butir dengan semua rinciannya',
  'lists.show': 'Tampilkan',
  'lists.priority.high': 'Tinggi',
  'lists.action.add': 'Tambah',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    other: '{count} butir',
  },
  'lists.template.copiedIn': {
    other: '{count} butir disalin, siap dicentang.',
  },
  'lists.remove.listBody': {
    other:
      'Daftar ini dan {count} butirnya keluar dari perjalanan ini. Templat yang kamu simpan tidak tersentuh.',
  },

  'lists.item.dialog.body':
    'Selain namanya semuanya opsional — berat membuat total kemasan jadi nyata, dan kategori mengelompokkan daftarnya.',
  'lists.template.dialogBody':
    'Templat adalah daftar yang pernah kamu simpan. Menerapkannya menyalin daftar itu jadi daftar baru di perjalanan ini — aslinya dibiarkan.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Hapus “{name}”?',
  actionsFor: 'Tindakan untuk {name}',
  'lists.dnd.reorder': 'Susun ulang {name}',
  'lists.action.untickItem': 'Lepas centang {name}',
  'lists.action.tickOffItem': 'Centang {name}',
  'lists.item.assignAria': 'Serahkan {name} ke seseorang',
  'lists.item.reassignAria': '{item} punya {owner} — serahkan ulang',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Beri pemesanan ini nama yang kamu kenali di daftar.',
  'error.titleLong': 'Jaga namanya di bawah 160 karakter.',
  'book.error.required': 'Pemesanan ini masih kurang {field}.',
  'book.error.timeNeedsDate': 'Sebuah waktu perlu tanggal tempat ia jatuh.',
  'book.error.endTimeNeedsDate': 'Waktu selesai perlu tanggal tempat ia jatuh.',
  'book.error.endsBeforeStart': 'Ini berakhir sebelum dimulai.',
  'book.fieldName.checkInDay': 'hari check-in',
  'book.fieldName.checkOutDay': 'hari check-out',
  'book.stay.pickDay': 'Pilih hari',
  'book.stay.nights': {
    other: '{count} malam',
  },
  'book.stay.range': '{from} sampai {to}',
  'book.stay.label': 'Menginap',
  'book.remove.keepsNights':
    'Malam-malamnya tetap di perjalanan. Hanya pemesanan yang dihapus.',
  'book.menu.removeWithStay': 'Hapus pemesanan dan menginap',
  'book.removeStay.body':
    'Pemesanan dan malam-malam yang dibayarnya sama-sama dihapus.',
  'book.toast.stayRemoved': 'Pemesanan dan menginap dihapus',
  'book.error.endTimeBeforeStart': 'Waktu selesai lebih awal dari waktu mulai.',
  'book.error.guests': 'Jumlah orang harus bilangan bulat sampai 1000.',
  'error.price': 'Jumlah itu tidak bisa kami baca.',
  'book.error.url': 'Tautan harus dimulai dengan http:// atau https://.',
  'book.error.confirmationLong':
    'Nomor konfirmasi itu terlalu panjang untuk disimpan.',
  'book.error.stopGone': 'Perhentian itu sudah tidak ada di perjalanan ini.',
  'book.ledger.unlinked':
    'Baris biaya pemesanan ini tetap ada di biaya perjalanan, tetapi tidak lagi tertaut ke pemesanan.',
  'book.ledger.updated':
    'Baris biaya pemesanan ini akan diperbarui menjadi {money}.',
  'book.ledger.needsDate':
    'Beri tanggal pada pemesanan ini agar biayanya masuk ke biaya perjalanan.',
  'book.ledger.added':
    'Satu baris {money} akan ditambahkan ke biaya perjalanan ini.',
  'book.fieldName.provider': 'pengangkut',
  'book.fieldName.location': 'lokasi',
  'book.fieldName.confirmationNumber': 'nomor konfirmasi',
  'book.fieldName.link': 'tautan',
  'book.fieldName.date': 'tanggal',
  'book.fieldName.time': 'waktu',
  'book.fieldName.endDate': 'tanggal selesai',
  'book.fieldName.endTime': 'waktu selesai',
  'book.fieldName.guests': 'jumlah orang',
  'book.fieldName.price': 'harga',
  'book.fieldName.stop': 'perhentian',
  'book.field.stop': 'Perhentian terkait',
  'book.field.stopHint': 'Perhentian rencana mana yang dituju pemesanan ini.',
  'book.field.stopHintEmpty':
    'Tambahkan dulu sebuah tempat ke suatu hari, lalu pemesanan ini bisa dikaitkan ke sana',
  'book.field.stopPlaceholder': 'Tidak terkait perhentian',
  'book.field.stopSearch': 'Cari perhentian dan hari',
  'book.field.stopEmpty': 'Tidak ada perhentian yang cocok',
  'book.ledger.refused.title': 'Tersimpan, tetapi belum masuk ke biaya',
  'book.ledger.refused.body':
    'Pemesanan sudah ada di perjalanan. Menambahkan baris biayanya ke biaya perjalanan tidak berhasil — coba lagi bagian itu.',
  'book.action.ledgerRetry': 'Tambahkan ke biaya',
  'book.ledger.splitStale.title':
    'Tersimpan, tetapi pembagiannya tidak lagi pas',
  'book.ledger.splitStale.body':
    'Pemesanan dan harga barunya tersimpan, tetapi pembagian biaya ini tidak bisa mengikuti total yang baru. Buka baris itu di Biaya dan perbaiki pembagiannya.',
  'book.action.done': 'Selesai',
  'book.copyConfirmation': 'nomor konfirmasi untuk {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Penerbangan',
  'transports.mode.train': 'Kereta',
  'transports.mode.bus': 'Bus',
  'transports.mode.ferry': 'Feri',
  'transports.mode.car': 'Mobil',
  'transports.mode.taxi': 'Taksi',
  'transports.mode.transit': 'Angkutan umum',
  'transports.mode.metro': 'MRT',
  'transports.mode.tram': 'Trem',
  'transports.mode.bike': 'Sepeda',
  'transports.mode.walk': 'Jalan kaki',
  'transports.mode.other': 'Lainnya',
  'transports.mode.fallback': 'Transportasi',
  'transports.rank.earliest': 'Tiba paling awal',
  'transports.rank.fewestChanges': 'Paling sedikit pindah',
  'transports.connection.findStop': 'Cari perhentian',
  'transports.connection.findStopSearch': 'CGK, Gambir, Jakarta…',
  'transports.connection.findStopEmpty':
    'Tidak ada perhentian bernama itu di katalog.',
  'transports.connection.hideStops': 'Sembunyikan perhentian',
  'transports.connection.seeStops': 'Lihat perhentian',
  'transports.connection.saving': 'Menyimpan koneksi',
  'transports.connection.use': 'Pakai yang ini',
  'transports.connection.onFoot': 'Jalan kaki',
  'transports.connection.service': 'Layanan',
  'transports.connection.direct': 'langsung',
  'transports.connection.changes': {
    other: '{changes} kali pindah',
  },
  'transports.connection.tooLong':
    'Koneksi ini punya lebih dari {max} ruas, lebih dari yang muat dalam satu catatan perjalanan. Cari lompatan lebih pendek dan catat sisanya terpisah.',
  'transports.connection.refusal.ceiling':
    'Tidak ada pencarian tersisa bulan ini',
  'transports.connection.refusal.unconfigured':
    'Pencarian koneksi dimatikan pada penyebaran ini',
  'transports.connection.refusal.provider': 'Layanan jadwal tidak menjawab',
  'transports.connection.refusal.plan':
    'Pencarian koneksi tidak termasuk dalam paket ini',
  'transports.connection.refusal.planBody':
    'Naikkan paket untuk mencari jadwal dari dalam perjalanan. Perjalanan tetap bisa dicatat manual.',
  'transports.connection.refusal.ceilingBody':
    'Jatah bulan ini sebanyak {ceiling} sudah habis dan diperbarui pada tanggal satu bulan depan. Perjalanan tetap bisa dicatat manual.',
  'transports.connection.refusal.unconfiguredBody':
    'Tidak ada layanan jadwal yang disiapkan di sini, jadi tidak ada yang dicari. Catat perjalanan secara manual.',
  'transports.connection.refusal.providerBody':
    'Tidak ada yang kembali untuk ditampilkan. Coba lagi sebentar, atau catat perjalanan secara manual.',
  'transports.connection.invitation':
    'Dua perhentian dan satu tanggal, lalu jadwal menjawab. Tidak ada yang disimpan sampai kamu memilih satu.',
  'transports.connection.empty':
    'Tidak ditemukan koneksi antara dua perhentian itu pada tanggal tersebut. Coba stasiun tetangga, atau perluas filter moda.',
  'transports.connection.credit': 'Data jadwal dari',
  'transports.connection.searchFailed': 'Pencarian tidak berjalan',
  'transports.connection.searchFailedBody': 'Coba lagi sebentar lagi.',
  'transports.connection.saved': 'Koneksi disimpan',
  'transports.connection.replaced': 'Rute diganti',
  'transports.connection.replacedBody':
    'Kode pemesanan dan tempat duduk tidak tersentuh.',
  'transports.connection.saveFailed': 'Koneksi tidak tersimpan',
  'transports.connection.saveError': 'Itu tidak tersimpan',
  'transports.connection.fromHint':
    'Pilih perhentian — jadwal ditanya di mana, bukan apa namanya.',
  'transports.connection.toHint': 'Pilih perhentian dari katalog.',
  'transports.connection.timeHint':
    'Jadwal menjawab dengan beberapa keberangkatan berikutnya, jadi ini yang menentukan.',
  'transports.connection.onlyModes': 'Hanya moda ini',
  'transports.connection.searching': 'Mencari di jadwal',
  'transports.connection.search': 'Cari koneksi',
  'transports.connection.title': 'Dari {from} ke {to}',
  'transports.status.idea': 'Gagasan',
  'transports.status.pending': 'Menunggu',
  'transports.status.confirmed': 'Terkonfirmasi',
  'transports.status.completed': 'Selesai',
  'transports.status.cancelled': 'Dibatalkan',
  'transports.end.fromAirport': 'Dari bandara',
  'transports.end.toAirport': 'Ke bandara',
  'transports.end.fromPort': 'Dari pelabuhan',
  'transports.end.toPort': 'Ke pelabuhan',
  'transports.end.fromStation': 'Dari stasiun',
  'transports.end.toStation': 'Ke stasiun',
  'transports.end.from': 'Dari',
  'transports.end.to': 'Ke',
  'transports.end.pickUp': 'Pengambilan',
  'transports.end.dropOff': 'Pengembalian',
  'transports.end.departureDay': 'Hari keberangkatan',
  'transports.end.arrivalDay': 'Hari kedatangan',
  'transports.end.pickUpDay': 'Hari pengambilan',
  'transports.end.returnDay': 'Hari pengembalian',
  'transports.dayNumber': 'Hari {n}',
  'transports.error.titleEmpty':
    'Beri transportasi ini nama yang kamu kenali di daftar.',
  'transports.error.date': 'Tanggal ditulis YYYY-MM-DD.',
  'transports.error.time': 'Waktu ditulis HH:MM dengan jam 24.',
  'transports.error.departureNeedsDate':
    'Waktu keberangkatan perlu tanggal tempat ia jatuh.',
  'transports.error.arrivalNeedsDate':
    'Waktu kedatangan perlu tanggal tempat ia jatuh.',
  'transports.error.code': 'Kode terdiri dari 2 sampai 8 huruf atau angka.',
  'transports.error.distance':
    'Jarak adalah angka dalam kilometer, sampai 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Transportasi ini tiba sebelum berangkat.',
  'transports.error.timingHint':
    'Geser salah satu waktunya supaya transportasi ini benar-benar bisa dikejar.',
  'transports.error.arrivalDayBeforeDeparture':
    'Hari kedatangan jatuh sebelum hari keberangkatan.',
  'transports.error.returnDayBeforePickUp':
    'Hari pengembalian jatuh sebelum hari pengambilan.',
  'transports.field.noDay': 'Belum ada hari',
  'transports.fill.legend': 'Cara mengisinya',
  'transports.fill.manual': 'Isi sendiri',
  'transports.fill.searchAgain': 'Cari lagi',
  'transports.fill.search': 'Cari koneksi',
  'transports.chain.unsplit': 'Jadikan satu perjalanan lagi',
  'transports.field.arrivalDayHint':
    'Perjalanan yang tiba keesokan paginya menyatakannya di sini.',
  'transports.chain.splitHint':
    'Berganti moda di tengah jalan? Catat tiap bagian dengan nomor layanan, peron, kursi, dan jamnya sendiri.',
  'transports.chain.split': 'Bagi menjadi ruas',
  'transports.chain.stopNumber': 'perhentian {n}',
  'transports.chain.change': 'Pindah {n}',
  'transports.chain.removeStation': 'Hapus {label}',
  'transports.chain.findStation': 'Cari bandara atau stasiun',
  'transports.chain.findStationFor': 'Cari bandara atau stasiun untuk {label}',
  'transports.chain.findPlaceholder': 'CGK, Soekarno-Hatta, Jakarta…',
  'transports.chain.findEmpty':
    'Tidak ada yang cocok — ketik sendiri perhentiannya di bawah.',
  'transports.chain.stopLabel': 'Perhentian',
  'transports.chain.stopPlaceholder': 'Gambir',
  'transports.chain.timezoneHint': 'Jam mana yang dipakai perhentian ini',
  'transports.chain.timezoneAt': 'Zona waktu di {label}',
  'transports.chain.timezonePlaceholder': 'Tidak disebutkan',
  'transports.chain.timezoneSearch': 'Jakarta, Tokyo, UTC…',
  'transports.chain.acrossClocks': '{gap} melintasi dua jam',
  'transports.chain.addStopAfter': 'Tambahkan perhentian setelah {label}',
  'transports.chain.servicePlaceholder': 'Argo Bromo Anggrek',
  'transports.chain.leaves': 'Berangkat dari {label}',
  'transports.chain.reaches': 'Tiba di {label}',
  'transports.chain.dayOfLeg': '{label} ruas {n}',
  'transports.chain.formError': 'Rantai ini tidak bisa disimpan',
  'transports.chain.atCap':
    'Satu rantai memuat paling banyak {max} ruas — itu batas apa yang dibawa satu penyimpanan, bukan berapa kali perjalanan boleh berganti.',
  'transports.chain.hint':
    'Tambahkan perhentian di ruas mana pun untuk mencatat pergantian kereta; tiap ruas menyimpan nomor layanan, peron, dan tempat duduknya sendiri.',
  'transports.field.timezone': 'Zona waktu',
  'transports.field.platform': 'Peron',
  'transports.chain.legNumber': 'Ruas {n}',
  'transports.chain.platform': 'Peron {value}',
  'transports.chain.seat': 'Tempat duduk {value}',
  'transports.chain.error.stopName':
    'Setiap perhentian butuh nama — di sinilah kamu berganti moda.',
  'transports.chain.error.stopNameLong':
    'Nama perhentian harus kurang dari 200 karakter.',
  'transports.chain.error.timezone': 'Pilih zona waktu dari daftar.',
  'transports.chain.error.tooManyLegs':
    'Satu rangkaian memuat paling banyak {max} ruas.',
  'transports.bookingRefFor': 'nomor pemesanan untuk {title}',
  'transports.doorToDoor': 'Itu {gap} dari pintu ke pintu.',
  'transports.title.fromTo': '{operator} dari {from} ke {to}',
  'transports.title.from': '{operator} dari {from}',
  'transports.title.to': '{operator} ke {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Tidak ada waktu untuk dibandingkan',
  'transports.junction.unknown.detail':
    'Isi tanggal dan waktu di kedua transportasi, maka perpindahan ini akan diperiksa untukmu.',
  'transports.junction.impossible.headline':
    'Berangkat {gap} sebelum transportasi sebelumnya tiba',
  'transports.junction.impossible.detail':
    '“{to}” berangkat sebelum “{from}” tiba, jadi keduanya tidak bisa dikejar. Geser salah satu.',
  'transports.junction.tight.headline': '{gap} untuk berpindah',
  'transports.junction.tight.detail':
    '{mode} biasanya perlu sekitar {required}. Yang ini mepet.',
  'transports.junction.tight.detailAt':
    '{mode} di {place} biasanya perlu sekitar {required}. Yang ini mepet.',
  'transports.junction.ok.headline': 'Jeda {gap}',
  'transports.junction.ok.detail':
    'Tiba di {landing} tapi transportasi berikutnya berangkat dari {boarding} — kamu perlu menyeberang.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Catatan dibagikan',
  'collab.note.toast.sharedBody':
    'Semua orang di perjalanan sudah bisa melihatnya.',
  'collab.note.toast.shareFailed': 'Catatan tidak dibagikan',
  'collab.note.toast.updated': 'Catatan diperbarui',
  'collab.note.toast.updateFailed': 'Catatan tidak diperbarui',
  'collab.note.dialog.editTitle': 'Ubah catatan ini',
  'collab.note.dialog.addTitle': 'Catatan bersama baru',
  'collab.note.dialog.body':
    'Rekomendasi restoran, aturan visa, kode pintu depan — semua yang harus diingat seluruh perjalanan, di satu tempat.',
  'collab.note.field.title': 'Judul',
  'collab.note.field.titlePlaceholder': 'Kode pintu depan',
  'collab.note.field.body': 'Catatan',
  'collab.note.field.bodyPlaceholder':
    '4821, lalu tombol pagar. Kotak kunci ada di kiri pintu.',
  'collab.note.field.categoryHint':
    'Mengelompokkan papan di bawah satu saringan. Opsional.',
  'collab.note.field.categoryPlaceholder': 'Logistik',
  'collab.note.field.pin': 'Sematkan di puncak papan',
  'collab.note.field.pinHint':
    'Catatan yang disematkan ada di depan, apa pun yang ditambahkan.',
  'collab.note.action.saving': 'Menyimpan catatan',
  'collab.note.action.save': 'Simpan catatan',
  'collab.note.action.share': 'Bagikan catatan',
  'collab.poll.toast.opened': 'Pemungutan dibuka',
  'collab.poll.toast.openedBody':
    'Semua orang di perjalanan sudah bisa memilih.',
  'collab.poll.toast.openFailed': 'Pemungutan tidak dibuka',
  'collab.poll.dialog.addTitle': 'Pemungutan baru',
  'collab.poll.field.question': 'Pertanyaan',
  'collab.poll.field.questionPlaceholder': 'Malam terakhir kita makan di mana?',
  'collab.poll.field.optionsLegend': 'Pilihan',
  'collab.poll.field.option': 'Butir pilihan {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Satu butir lagi',
  'collab.poll.action.addOption': 'Tambah satu butir',
  'collab.poll.action.removeOption': 'Hapus butir {n}',
  'collab.poll.field.multi': 'Izinkan memilih lebih dari satu',
  'collab.poll.field.multiHint':
    'Kalau mati, satu orang satu suara, dan berubah pikiran memindahkannya.',
  'collab.poll.action.opening': 'Membuka pemungutan',
  'collab.poll.action.open': 'Buka pemungutan',
  'collab.poll.error.tooFew':
    'Pemungutan butuh setidaknya dua hal untuk dipilih.',
  'collab.poll.error.duplicate':
    'Dua butir mengatakan hal yang sama. Beri masing-masing kata sendiri.',
  'collab.presence.viewingNow': 'sedang melihat',
  'collab.presence.unnamed': 'Anggota tanpa nama',
  'collab.presence.tabsOpen': {
    other: '{name} — {count} tab terbuka',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Setuju',
  'collab.reaction.love': 'Suka banget',
  'collab.reaction.funny': 'Lucu',
  'collab.reaction.celebrate': 'Ayo rayakan',
  'collab.reaction.thanks': 'Terima kasih',
  'collab.reaction.looking': 'Lagi lihat',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, termasuk kamu',
  'collab.thread.today': 'Hari ini',
  'collab.thread.emptyBody':
    'Semua peserta perjalanan ini berbagi satu percakapan. Keputusan yang dibuat di sini tetap tersimpan bersama perjalanan, bukan tercecer di berbagai obrolan grup.',
  /** Invitation to write the first message of an empty conversation, not a command. */
  'collab.thread.empty': 'Mulai percakapan',
  'collab.thread.loadOlder': 'Muat pesan sebelumnya',
  'collab.thread.loadingOlder': 'Memuat pesan sebelumnya',
  'collab.thread.loadOlderFailed': 'Pesan sebelumnya gagal dimuat',
  'collab.thread.retry': 'Coba lagi',
  'collab.thread.start': 'Di sinilah percakapan dimulai',
  'collab.toast.reactionFailed': 'Reaksi tidak tersimpan',
  'collab.toast.messageDeleted': 'Pesan dihapus',
  'collab.toast.deleteFailed': 'Pesan tidak dihapus',
  'collab.toast.notSent': 'Tidak terkirim',
  'collab.toast.notSentBody': 'Pesan tidak bisa dikirim. Coba lagi sebentar.',
  'collab.toast.messageUpdated': 'Pesan diperbarui',
  'collab.toast.editFailed': 'Perubahan tidak tersimpan',
  'collab.message.deleteTitle': 'Hapus pesan ini?',
  'collab.message.deleteBody':
    'Teksnya hilang dari utas. Balasan untuknya tetap di tempatnya.',
  'collab.message.delete': 'Hapus pesan',
  'collab.message.reply': 'Balas',
  'collab.message.menuEdit': 'Ubah pesan…',
  'collab.message.react': 'Beri reaksi ke pesan ini',
  'collab.message.edited': 'diubah',
  'collab.message.actionsFor': 'Tindakan untuk pesan dari {name}',
  'collab.compose.editingYours': 'Kamu sedang mengubah pesanmu',
  'collab.compose.replyingTo': 'Membalas {name}',
  'collab.compose.cancelReply': 'Batalkan balasan',
  'collab.compose.cancelEdit': 'Batalkan perubahan',
  'collab.compose.placeholder': 'Tulis untuk perjalanan',
  'collab.compose.placeholderText': 'Tulis sesuatu untuk grup…',
  'collab.compose.editPlaceholder': 'Ubah pesanmu',
  'collab.compose.editPlaceholderText': 'Ganti apa yang kamu bilang…',
  'collab.compose.send': 'Kirim pesan',
  'collab.compose.savingEdit': 'Menyimpan perubahan',
  'collab.compose.save': 'Simpan',
  /** Textarea description for a fine pointer; input-method composition never sends. */
  'collab.compose.keysHint':
    'Tekan Enter untuk mengirim, Shift dan Enter untuk baris baru.',
  /** Added to the textarea description only while replying or editing. */
  'collab.compose.keysHintEsc': 'Tekan Escape untuk membatalkan.',
  /** Textarea description on a coarse pointer; Enter adds a line. */
  'collab.compose.keysHintTouch': 'Gunakan tombol kirim untuk mengirim pesan.',
  /** Button retries the failed send or edit using the text currently in the field. */
  'collab.compose.retry': 'Coba lagi',
  /** Fixed failed-edit body, also used as the edit toast fallback; never server diagnostics. */
  'collab.toast.editFailedBody':
    'Perubahanmu masih ada di kotak teks. Periksa koneksimu, lalu coba lagi.',
  'collab.hint.sends': 'mengirim',
  'collab.hint.addsLine': 'menambah baris',
  'collab.hint.cancels': 'membatalkan',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Catatan dihapus',
  'collab.toast.noteRemoveFailed': 'Catatan tidak dihapus',
  'collab.notes.empty.title': 'Belum ada catatan bersama',
  'collab.notes.empty.body':
    'Rekomendasi restoran, aturan visa, kode pintu depan — semua yang harus diingat seluruh perjalanan.',
  'collab.notes.empty.action': 'Tulis catatan pertama',
  'collab.note.menu.edit': 'Ubah catatan…',
  'collab.note.menu.unpin': 'Lepas sematan',
  'collab.note.menu.pin': 'Sematkan di puncak',
  'collab.note.remove': 'Hapus catatan',
  'collab.note.removeBody':
    'Catatan hilang dari papan semua orang di perjalanan.',
  'collab.note.new': 'Catatan baru',
  'collab.poll.toast.voteFailed': 'Suaramu tidak tersimpan',
  'collab.poll.toast.voteFailedBody': 'Hitungannya tidak berubah.',
  'collab.poll.toast.closed': 'Pemungutan ditutup',
  'collab.poll.toast.closeFailed': 'Pemungutan tidak ditutup',
  'collab.poll.toast.removed': 'Pemungutan dihapus',
  'collab.poll.toast.removeFailed': 'Pemungutan tidak dihapus',
  'collab.polls.heading': 'Daftar pemungutan',
  'collab.polls.empty.title': 'Tidak ada pemungutan yang terbuka',
  'collab.polls.empty.body':
    'Kalau rombongan tidak bisa sepakat soal restoran, jadikan pemungutan suara dan biarkan jawabannya menemukan dirinya.',
  'collab.polls.empty.action': 'Tanya rombongan',
  'collab.poll.menu.close': 'Tutup pemungutan',
  'collab.poll.remove': 'Hapus pemungutan',
  'collab.poll.removeTitle': 'Hapus pemungutan ini?',
  'collab.poll.actionsFor': 'Tindakan untuk pemungutan “{question}”',
  'collab.badge.pinned': 'Disematkan',
  'collab.badge.closed': 'Ditutup',
  'collab.badge.open': 'Terbuka',
  'collab.badge.multi': 'Pilih beberapa',
  'collab.badge.leading': 'Memimpin',
  'collab.poll.removeBody': {
    other: '“{question}” dan {count} suaranya hilang untuk semua orang.',
  },
  'collab.poll.result': {
    other: '{label} — {votes} dari {count} suara',
  },
  'collab.poll.resultMine': {
    other: '{label} — {votes} dari {count} suara, termasuk suaramu',
  },
  'collab.poll.voteCount': {
    other: '{count} suara',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Dokumen',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Tiket',
  'files.kind.receipt': 'Struk',
  'files.kind.map': 'Peta',
  'files.kind.other': 'Lainnya',
  'files.kindChoice.ticket': 'Tiket atau kartu masuk',
  'files.kindChoice.map': 'Peta atau rute',
  'files.toast.removed': 'Berkas dihapus',
  'files.toast.removeFailed': 'Berkas tidak dihapus',
  'files.toast.downloadFailed': 'Unduhan tidak mulai',
  'files.toast.gone': 'Berkas ini sudah tidak tersedia di tab ini.',
  'files.toast.uploadFailed': 'Unggahan gagal. Coba lagi.',
  'files.toast.updated': 'Berkas diperbarui',
  'files.toast.updateFailed': 'Berkas tidak diperbarui',
  'files.storage.full': 'Ruang kerja ini kehabisan penyimpanan',
  'files.storage.used':
    'Terpakai {used} dari {limit}. Hapus satu berkas di bawah, atau naik ke paket lebih tinggi, sebelum menambah apa pun lagi.',
  'files.storage.perFile': 'maksimal {size} per berkas',
  'files.action.add': 'Tambah berkas',
  'files.action.choose': 'Pilih berkas',
  'files.action.upload': 'Unggah berkas',
  'files.calendar.live.action': 'Tautan kalender yang diperbarui',
  'files.calendar.live.title': 'Tautan kalender yang diperbarui',
  'files.calendar.warning':
    'Siapa pun dengan tautan ini dapat membaca tempat, waktu, alamat, dan catatan perjalanan tanpa akun. Lindungi seperti kata sandi.',
  'files.calendar.enable.action': 'Buat tautan',
  'files.calendar.link.once':
    'Salin sekarang - kami hanya menampilkannya sekali. Jika hilang, buat tautan baru; tautan lama akan berhenti berfungsi.',
  'files.calendar.link.address': 'Alamat tautan',
  'files.calendar.link.copy': 'Salin tautan',
  'files.calendar.link.copied': 'Tautan disalin',
  'files.calendar.link.copyFailed':
    'Tidak dapat menyalin. Pilih alamat lalu salin secara manual.',
  'files.calendar.link.open': 'Buka di aplikasi kalender',
  'files.calendar.link.google': 'Tambahkan ke Google Kalender',
  'files.calendar.link.outlook': 'Tambahkan ke Outlook',
  'files.calendar.link.done': 'Selesai',
  'files.calendar.link.stays':
    'Nomor konfirmasi, harga, dan berkas tetap di planned.travel.',
  'files.calendar.freshness':
    'Aplikasi kalender mungkin perlu beberapa jam, terkadang lebih lama, untuk menampilkan perubahan.',
  'files.calendar.state.on': 'Tautan kalender aktif',
  'files.calendar.state.lastFetched':
    'Kalender terakhir memeriksa tautan ini {when}',
  'files.calendar.state.neverFetched': 'Belum diambil',
  'files.calendar.rotate.action': 'Buat tautan baru',
  'files.calendar.rotate.confirmTitle': 'Buat tautan baru?',
  'files.calendar.rotate.confirmBody':
    'Tautan lama berhenti berfungsi sekarang. Kalender yang menggunakannya berhenti diperbarui sampai kamu memberikan tautan baru.',
  'files.calendar.rotate.busy': 'Membuat tautan baru…',
  'files.calendar.error.rotate':
    'Kami tidak dapat memastikan tautan baru telah dibuat. Status saat ini ditampilkan di bawah; coba lagi jika perlu.',
  'files.calendar.rotate.confirm': 'Buat tautan baru',
  'files.calendar.off.action': 'Nonaktifkan',
  'files.calendar.off.confirmTitle': 'Nonaktifkan tautan kalender ini?',
  'files.calendar.off.confirmBody':
    'Tautan langsung berhenti berfungsi. Kalender menyimpan acara yang sudah diambil, tetapi berhenti memperbaruinya.',
  'files.calendar.off.confirm': 'Nonaktifkan',
  'files.calendar.off.busy': 'Menonaktifkan…',
  'files.calendar.closeGuard.title': 'Tutup tanpa menyalin tautan?',
  'files.calendar.closeGuard.body':
    'Kami tidak dapat menampilkannya lagi. Anda harus membuat yang baru.',
  'files.calendar.closeGuard.confirm': 'Tetap tutup',
  'files.calendar.closeGuard.cancel': 'Biarkan terbuka',
  'files.calendar.error.enable':
    'Pembuatan tautan tidak dapat dipastikan. Status terkini ada di bawah. Jika aktif tetapi Anda belum melihatnya, nonaktifkan lalu buat lagi.',
  'files.calendar.error.off':
    'Penonaktifan tautan tidak dapat dipastikan. Status terkini ada di bawah; coba lagi bila perlu.',
  'files.calendar.error.load':
    'Tidak dapat memeriksa tautan kalender perjalanan ini. Coba lagi.',
  'files.calendar.retry': 'Coba lagi',
  'files.calendar.off.confirmBodyUnused':
    'Tautan ini belum digunakan. Tautan langsung berhenti berfungsi.',
  'files.calendar.link.fallback':
    'Jika tidak dapat menambahkannya di ponsel, buka halaman ini di komputer.',
  'files.calendar.link.newTab': 'terbuka di tab baru',
  'files.calendar.title': 'Kalender',
  'files.calendar.description':
    'Bawa perjalanan ini ke aplikasi kalender yang sudah kamu pakai.',
  'files.calendar.download.action': 'Unduh berkas kalender (.ics)',
  'files.calendar.download.hint':
    'Cuplikan perjalanan seperti saat ini. Tidak diperbarui otomatis.',
  'files.calendar.undated':
    'Perjalanan ini belum memiliki tanggal, jadi hanya reservasi dan perjalanan bertanggal yang akan muncul.',
  'files.calendar.download.error':
    'Kami tidak dapat menyiapkan berkas. Coba lagi.',
  'files.calendar.timesNote':
    'Perjalanan dengan zona waktu muncul pada saat yang sama di mana pun. Semua yang lain muncul pada jam yang direncanakan, di mana pun kalendermu berada.',
  'files.drop.active': 'Lepas untuk mengunggah',
  'files.drop.pasteHint': 'menempel gambar atau tangkapan layar yang disalin',
  'files.reject.blockedType':
    '“{name}” tidak ditambahkan: berkas XML dan SVG terkompresi tidak disimpan di sini demi keamanan. Simpan sebagai PDF atau gambar, lalu tambahkan itu sebagai gantinya.',
  'files.drop.idle': 'Seret berkas ke sini',
  'files.empty.title': 'Belum ada berkas di perjalanan ini',
  'files.empty.body':
    'Semua yang biasanya harus kamu korek dari kotak masuk di meja check-in ada di sini, menempel pada perjalanannya.',
  'files.empty.hint':
    'Boarding pass, konfirmasi hotel, tiket, dokumen asuransi, dan struk yang mendukung pengeluaranmu.',
  'files.heading': 'Lampiran',
  'files.tableCaption': 'Berkas yang menempel pada perjalanan ini',
  'files.menu.download': 'Unduh',
  'files.menu.rename': 'Ganti nama dan deskripsi…',
  'files.menu.remove': 'Hapus berkas',
  'files.remove.body':
    'Berkas dihapus dari penyimpanan sekaligus dari perjalanan, dan {size} dibebaskan. Ini tidak bisa dibatalkan.',
  'files.queue.clear': 'Bersihkan yang selesai',
  'files.column.file': 'Berkas',
  'files.column.size': 'Ukuran',
  'files.column.addedBy': 'Ditambahkan oleh',
  'files.column.when': 'Kapan',
  'files.status.uploaded': 'Terunggah',
  'files.status.failed': 'Gagal',
  'files.status.cancelled': 'Dibatalkan',
  'files.status.uploading': 'Mengunggah',
  'files.status.waiting': 'Menunggu',
  'files.error.nameEmpty':
    'Berkas perlu nama yang membuatmu bisa menemukannya.',
  'files.field.kindHint':
    'Menentukan ia masuk saringan mana dan dapat lambang apa.',
  'files.field.kindAria': 'Jenis berkas',
  'files.field.description': 'Deskripsi',
  'files.field.descriptionPlaceholder':
    'Polis asuransi — menanggung seluruh rombongan, nomor klaim di halaman 2.',
  'files.dialog.title': 'Rincian berkas',
  'files.action.saving': 'Menyimpan berkas',
  'files.action.save': 'Simpan rincian',
  'files.queue.someFailed': {
    other:
      '{count} berkas tidak terunggah. Alasannya ada di tiap baris — sisanya dalam satu kiriman tidak terpengaruh.',
  },

  'files.action.cancelUploadOf': 'Batalkan unggahan {name}',
  'files.action.dismissOf': 'Tutup {name}',
  'files.status.downloadingOf': 'Mengunduh {name}',
  'files.status.uploadingOf': 'Mengunggah {name}',
  'files.status.uploadingCount': {
    other: 'Mengunggah {count} berkas',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - dibuat pada {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': '{title} sudah siap',
  'files.export.email.body': {
    other: 'Ekspor perjalanan sudah siap. Disimpan selama {count} hari.',
  },
  'files.export.email.action': 'Buka {title}',
  'files.export.email.text': 'Ekspor perjalanan sudah siap: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Ekspor perjalanan',
  'files.export.description':
    'Salinan perjalanan yang bisa dicetak: hari, pemberhentian, reservasi, transportasi, dan penginapan. Berikan kepada orang yang tidak punya akun.',
  'files.export.kept': {
    other: 'Setiap ekspor disimpan selama {count} hari.',
  },
  'files.export.empty.title': 'Belum ada ekspor',
  'files.export.empty.body':
    'Buat salinan perjalanan yang bisa dicetak untuk dikirim ke orang yang tidak punya akun.',
  'files.export.empty.bodyViewer':
    'Pemilik atau editor perjalanan ini bisa membuatnya.',
  'files.export.format.pdf': 'File PDF',
  'files.export.format.html': 'Halaman cetak',
  'files.export.artifact': 'Ekspor perjalanan, {date}',
  'files.export.download': 'Unduh',
  'files.export.downloadLabelPdf': 'Unduh PDF yang dibuat pada {date}',
  'files.export.downloadLabelHtml':
    'Unduh halaman cetak yang dibuat pada {date}',
  'files.export.error.list': 'Daftar ekspor tidak termuat.',
  'files.export.retry': 'Coba lagi',
  'files.export.error.missing':
    'Ekspor itu tidak lagi disimpan. Ekspor perjalanan lagi.',
  'files.export.error.missingViewer': 'Ekspor itu tidak lagi disimpan.',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Unggahan dibatalkan.',
  'files.error.badAnswer':
    'Server mengirim jawaban yang tidak bisa dibaca peramban ini.',
  'files.error.connection':
    'Koneksi putus saat mengunggah. Cek jaringanmu lalu coba lagi.',
  'files.error.timeout': 'Unggahan kehabisan waktu. Coba lagi.',
  'files.error.refused': 'Server menolak unggahan ini ({status}).',
  'files.error.downloadShape':
    'Unduhan kembali dalam bentuk yang tidak bisa kami simpan.',
  'files.error.downloadFailed': 'Unduhan gagal ({status}).',
  'files.toast.uploadedOne': 'Berkas terunggah',
  'files.toast.uploadedManyBody': '{size} ditambahkan ke perjalanan ini.',
  'files.toast.failedOne': 'Berkas itu tidak terunggah',
  'files.toast.failedManyBody':
    'Antrean di bawah menyebut alasannya satu per satu.',
  'files.error.tooMany': {
    other:
      'Sekali jalan hanya bisa {count} berkas, jadi “{name}” tertinggal. Jatuhkan lagi sendirian.',
  },
  'files.toast.uploadedMany': {
    other: '{count} berkas terunggah',
  },
  'files.toast.failedMany': {
    other: '{count} berkas tidak terunggah',
  },

  'files.export.request': 'Ekspor perjalanan',
  'files.export.includeReferences': 'Sertakan kode konfirmasi',
  'files.export.includeReferencesHint':
    'Jangan centang jika file akan dikirim ke orang di luar ruang kerja.',
  'files.export.pending':
    'Ekspor sedang disiapkan. Anda boleh meninggalkan halaman ini; file akan muncul di daftar saat siap.',
  'files.export.slow':
    'Proses ini lebih lama dari biasanya. File akan muncul di sini saat siap. Jika tidak, ekspor lagi.',
  'files.export.refresh': 'Segarkan',
  'files.export.ready': 'Ekspor Anda siap',
  'files.export.quota': {
    other:
      'Kuota bulanan ruang kerja sebanyak {count} ekspor telah habis. Hitungan dimulai lagi pada {date}.',
  },
  'files.export.error.request': 'Ekspor tidak dimulai',
  'files.export.error.requestBody':
    'Percobaan ini tidak dihitung. Coba lagi sebentar.',
  'files.export.doc.overview': 'Ringkasan',
  'files.export.doc.timezone': 'Zona waktu',
  'files.export.doc.days': 'Hari',
  'files.export.doc.day': { other: 'Hari {count} - {date}' },
  'files.export.doc.dayUndated': { other: 'Hari {count}' },
  'files.export.doc.dayEmpty': 'Belum ada rencana.',
  'files.export.doc.reservations': 'Reservasi',
  'files.export.doc.transport': 'Transportasi',
  'files.export.doc.reference': 'Kode {code}',
  'files.export.doc.route': '{from} ke {to}',
  'files.export.doc.stays': 'Tempat menginap',
  'files.export.doc.nights': { other: 'Jumlah malam: {count}' },
  'files.export.doc.truncatedDays': {
    other:
      'Semua hari tidak muat dalam satu dokumen. {count} hari pertama ditampilkan.',
  },
  'files.export.doc.truncatedRows': {
    other: 'Menampilkan {count} pertama dari {total}.',
  },
  'files.export.notify': 'Kirim email saat sudah siap',
  'files.export.viewer':
    'Hanya pemilik dan editor yang dapat membuat ekspor. Anda dapat mengunduh yang sudah ada.',
  'files.export.jump': 'Ke daftar ekspor',
  'files.export.fromLink': 'Dari tautan Anda',
  'files.export.linkGone':
    'Ekspor ini tidak lagi disimpan. Buat yang baru di bawah.',
  'files.export.allowance': {
    other: '{used} dari {count} ekspor digunakan bulan ini',
  },
  'files.export.allowanceUnlimited': { other: '{count} ekspor bulan ini' },
  'files.export.linkGoneViewer': 'Ekspor itu tidak lagi disimpan.',
  'files.calendar.tab.trip': 'Perjalanan ini',
  'files.calendar.tab.workspace': 'Perjalanan saya',
  'files.calendar.workspace.warning':
    'Siapa pun dengan tautan ini dapat membaca tanpa akun perjalanan yang Anda ikuti di ruang kerja ini yang tidak diarsipkan: {count} dengan tanggal mulai terbaru. Perjalanan baru muncul otomatis. Lindungi seperti kata sandi.',
  'files.calendar.workspace.nameNote':
    'Tautan ini muncul di kalender Anda sebagai “planned.travel”. Ubah namanya jika Anda memiliki lebih dari satu.',
  /* ----------------------------------- the leave planner's allowance */
  'vacay.allowance.label': 'Jatah cuti {year}',
  'vacay.allowance.daysLeft': {
    other: 'Sisa {value} hari',
  },
  'vacay.allowance.daysOver': {
    other: 'Lebih {value} hari',
  },
  'vacay.allowance.progress': 'Hari terpakai: {used} dari {total}',
  'vacay.allowance.tile.days': 'Hari',
  'vacay.allowance.tile.used': 'Terpakai',
  'vacay.allowance.tile.carried': 'Dibawa',
  'vacay.allowance.tile.edit.days': 'Ubah hari, saat ini {value}',
  'vacay.allowance.input.days': 'Jatah cuti Anda untuk {year}',
  'vacay.allowance.input.invalid': 'Masukkan bilangan bulat dari 0 sampai 365.',
  'vacay.allowance.save': 'Simpan',
  'vacay.allowance.cancel': 'Batal',
  'vacay.allowance.saving': 'Menyimpan…',
  'vacay.allowance.default.hint':
    'Jatah bawaan. Pilih untuk menetapkan jatah Anda sendiri.',
  'vacay.allowance.saved': 'Jatah cuti disimpan.',
  'vacay.allowance.error.days': {
    other:
      'Jatah cuti Anda tidak dapat disimpan. {year} masih menampilkan {value} hari.',
  },
  'vacay.allowance.retry': 'Coba lagi',
  'vacay.pending.loading': 'Memuat',
  'vacay.error.title': 'Perencana cuti tidak dapat dimuat',
  'vacay.year.previous': 'Tahun sebelumnya',
  'vacay.year.next': 'Tahun berikutnya',
} satisfies TranslationOf<typeof En>

export default messages
