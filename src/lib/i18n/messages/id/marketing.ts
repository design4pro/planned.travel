/**
 * The public pages' copy, in id.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Penulisan.** Nama produk tetap dalam huruf Latin.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Mulai gratis',
  'action.signIn': 'Masuk',
  'action.pricing': 'Harga',
  'action.seePricing': 'Lihat harga',
  'action.skipToContent': 'Lewati ke konten',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — halaman utama',
  'nav.onThisPage': 'Di halaman ini',
  'anchor.planner': 'Perencana',
  'anchor.modules': 'Modul',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Lepas di hari {day}',
  'legal.summaryNote':
    'Ringkasannya ada untuk dibaca. Yang benar-benar berlaku adalah yang di bawah.',
  'visual.daysTravelled': 'Hari perjalanan',
  'visual.acrossEveryTrip': 'di semua perjalanan',
  'visual.mapFilled': '{percent}% peta terisi',
  'visual.previewSummary':
    'Pratinjau dasbor planned.travel: perjalanan berikutnya dengan tanggal, jumlah peserta, dan jumlah tempatnya; total negara yang dikunjungi, perjalanan, dan hari perjalanan; peta rute perjalanan; dan dua reservasi terdekat.',
  'visual.placesMapped': {
    other: '{value} tempat di peta',
  },
  'visual.splitWays': {
    other: 'dibagi {value} orang',
  },
  'visual.tripTotal': 'Total perjalanan',
  'visual.paidSplit': '{who} membayar · {split}',
  'visual.nextUp': 'Berikutnya',
  'visual.ofTotal': '{done} dari {total}',
  'visual.awaitingReply': 'Menunggu jawaban',
  'visual.upcoming': 'Mendatang',
  'visual.days': {
    other: '{value} hari',
  },
  'visual.places': {
    other: '{value} tempat',
  },
  'visual.transfersLeft': {
    other: 'sisa {value} transfer',
  },

  'legal.badge.version': 'Versi {version}',
  'legal.badge.effective': 'Berlaku sejak {updated}',
  'legal.notice.title': 'Ini templat, bukan nasihat hukum',
  'legal.notice.body':
    'Ditulis dalam bahasa Inggris sederhana supaya jadi titik awal yang benar-benar berguna untuk layanan perencanaan perjalanan kecil, dan setiap celah yang harus diisi sebuah usaha sudah ditandai. Mintalah pengacara yang berkompeten di wilayah hukummu meninjau dan menyesuaikannya sebelum kamu menerima satu pun pelanggan. Tidak ada di sini yang menyatakan planned.travel memegang sertifikasi, audit, atau standar kepatuhan apa pun.',
  'legal.contents': 'Isi',
  'legal.shortVersion': 'Ringkasnya',
  'legal.both': 'Kedua dokumen berlaku bersamaan.',

  'landing.plans.title': 'Mulai gratis. Bayar setelah pantas dibayar.',
  'landing.plans.lede':
    'Semua paket sudah termasuk perencana harian, peta, anggaran, dan daftar bawaan. Paket berbayar - mulai {price} per bulan - membuka perjalanan tanpa batas, reservasi, jurnal, dan ekspor.',
  'landing.plans.ledeFree':
    'Semua paket sudah termasuk perencana harian, peta, anggaran, dan daftar bawaan. Paket berbayar membuka perjalanan tanpa batas, reservasi, jurnal, dan ekspor.',
  'landing.plans.compare': 'Bandingkan tiap batasan, baris demi baris',
  'landing.questions.title': 'Pertanyaan, dijawab lugas',
  'landing.questions.lede':
    'Lima hal yang benar-benar ingin orang ketahui sebelum mulai.',
  'cta.heading': 'Perjalanan berikutmu sudah layak direncanakan dengan benar',
  'cta.lede':
    'Dua perjalanan, seluruh peta, rencana harian, dan daftar bawaan: gratis, tanpa kartu dan tanpa hitungan mundur.',
  'landing.faq.seats.q': 'Apakah orang yang ikut denganku juga harus bayar?',
  'landing.faq.seats.a':
    'Tidak. Semua yang kamu undang ke ruang kerja {crew} tercakup oleh kursinya. Mereka masuk dengan akun sendiri dan hanya melihat perjalanan tempat kamu menambahkan mereka.',
  'landing.faq.phone.q': 'Apakah jalan dengan baik di ponsel?',
  'landing.faq.phone.a':
    'Ya. Tata letak ponsel digambar terpisah, bukan diperas dari versi desktop, dan ini situs web: tidak ada yang perlu dipasang dan tidak ada yang perlu diperbarui.',
  'landing.faq.privacy.q': 'Siapa yang bisa melihat perjalananku?',
  'landing.faq.privacy.a':
    'Sebuah perjalanan milik satu ruang kerja, dan hanya orang yang diundang ke ruang kerja itu yang bisa membukanya. Tidak ada yang publik, tidak ada beranda penemuan, dan secara bawaan tidak ada yang dibagikan ke siapa pun.',
  'landing.faq.stop.q':
    'Apa yang terjadi pada perjalananku kalau aku berhenti bayar?',
  'landing.faq.stop.a':
    'Tidak ada yang dihapus. Modul berbayar terkunci, perjalananmu tetap persis di tempatnya, dan semuanya terbuka lagi begitu kamu berlangganan. Paket {free} tetap tanpa biaya, tanpa hitungan mundur.',

  'action.startPlanning': 'Mulai merencanakan gratis',
  'cta.comparePlans': 'Bandingkan paketnya',
  'landing.hero.eyebrow': 'Merencanakan perjalanan bersama',
  'landing.hero.title': 'Rencanakan perjalanannya.',
  'landing.hero.titleQuiet': 'Bukan spreadsheet-nya.',
  'landing.hero.lede':
    'Satu rencana di peta sungguhan, dibagi langsung dengan semua yang ikut - lengkap dengan reservasi, uang, dan daftar bawaan yang menempel padanya.',
  'landing.hero.secondary': 'Lihat berapa biayanya',
  'landing.trust.noCard': 'Tanpa kartu untuk mulai',
  'landing.trust.noAds': 'Tanpa iklan, tanpa tautan afiliasi',
  'landing.trust.export': 'Ekspor semuanya, kapan saja',

  'proof.eyebrow': 'Jawaban lurus',
  'proof.title': 'Tanpa testimoni, karena kami belum layak mendapatnya',
  'proof.lede':
    'planned.travel masih baru. Ketimbang mengarang kutipan atau meminjam logo orang, inilah tepatnya apa yang dilakukannya, untuk siapa, dan apa yang tidak akan pernah dilakukannya padamu.',
  'proof.who.label': 'Untuk siapa',
  'proof.who.heading': 'Untuk orang yang akhirnya membuat spreadsheet itu',
  'proof.who.body':
    'Untuk pasangan, keluarga, dan rombongan teman yang ingin satu rencana yang bisa dilihat semua orang, bukan enam tangkapan layar, tiga grup obrolan, dan satu catatan bersama yang tak dibuka siapa pun sejak Maret.',
  'proof.not.label': 'Apa yang bukan',
  'proof.not.heading':
    'Bukan situs pemesanan, dan tidak dijual ke salah satunya',
  'proof.not.body':
    'Kami tidak mengambil komisi, tidak membawa iklan, dan tidak menaruh tautan afiliasi, jadi tidak ada apa pun di halaman yang diam-diam mengarahkanmu ke hotel tertentu. Kamu yang membayar kami, artinya kami bekerja untukmu.',
  'proof.where.label': 'Di mana barangmu tinggal',
  'proof.where.heading': 'Di Cloudflare, di ruang kerjamu sendiri',
  'proof.where.body':
    'Perjalanan berada di basis data yang terbatas pada ruang kerjamu dan berkas di penyimpanan objek kami sendiri, keduanya disajikan dari edge Cloudflare. Polar, penjual resmi kami, menjalankan pembayaran dan menerbitkan faktur, jadi nomor kartumu tidak pernah sampai ke kami.',
  'proof.promise.ads.title': 'Tanpa iklan, tanpa analitik pihak ketiga',
  'proof.promise.ads.body':
    'Tidak ada apa pun di halaman ini yang mengukurmu untuk orang lain.',
  'proof.promise.sold.title': 'Perjalananmu tidak pernah dijual atau disewakan',
  'proof.promise.sold.body':
    'Tidak ke pengiklan, tidak ke perusahaan wisata, tidak ke siapa pun.',
  'proof.promise.leave.title': 'Pergi kapan saja, bawa semuanya',
  'proof.promise.leave.body':
    'Rencana PDF, berkas kalender, dan tempat-tempatmu sebagai GeoJSON.',
  'proof.certification':
    'Hari ini kami tidak punya sertifikasi keamanan apa pun, dan kami tidak akan berpura-pura punya. Ketika planned.travel diaudit terhadap sebuah standar, di sinilah kami akan menyebut standarnya, auditornya, dan tanggalnya - bukan sebelumnya.',

  'feature.modules.title': 'Sisa perjalanan, ditangani',
  'feature.modules.lede':
    'Tiap modul mengerjakan satu hal dengan benar dan menyerahkan hasilnya ke yang lain. Tidak ada tab kosong di sini yang menunggu rilis mendatang.',
  'feature.module.lists.benefit': 'Tidak ada yang datang tanpa adaptor.',
  'feature.module.lists.detail':
    'Bawaan, tugas, belanjaan, dan dokumen: satu daftar per keperluan, dibagi dengan semua yang ikut dan dicentang sambil jalan.',
  'feature.module.journal.name': 'Jurnal',
  'feature.module.journal.benefit': 'Perjalanan jadi cerita, bukan folder.',
  'feature.module.journal.detail':
    'Catatan berurutan tanggal dengan foto yang kamu ambil, tempat kamu berada, cuacanya, dan bagaimana hari itu sebenarnya terasa.',
  'feature.module.atlas.benefit':
    'Satu peta semua tempat yang pernah kamu datangi.',
  'feature.module.atlas.detail':
    'Tandai sebuah negara sudah dikunjungi dan ia masuk ke peta duniamu, dengan kunjungan pertama, yang terbaru, dan berapa kali kamu kembali.',
  'feature.module.vacay.benefit': 'Ajukan cutinya sebelum beli tiketnya.',
  'feature.module.vacay.detail':
    'Tandai hari-hari kamu pergi dan tahunnya terisi sendiri: akhir pekan, hari libur, dan cuti orang lain di kisi yang sama.',
  'feature.module.collab.benefit': 'Keputusan tetap menempel di perjalanan.',
  'feature.module.collab.detail':
    'Satu utas per perjalanan, catatan bersama untuk hal yang harus diingat semua orang, dan polling untuk saat kelompok tidak sepakat soal makan malam.',
  'feature.module.files.benefit':
    'Boarding pass di tempat yang bisa kamu temukan.',
  'feature.module.files.detail':
    'Konfirmasi, tiket, dokumen asuransi, dan tanda terima menempel di perjalanan tempatnya, bukan terkubur di kotak masuk.',

  'feature.planner.title': 'Rencana harian yang digambar di peta sungguhan',
  'feature.planner.lede':
    'Kumpulkan tempat yang ingin kamu lihat, lalu tarik ke sebuah hari. Peta menggambar ulang rutenya sambil kamu bekerja, jadi kamu langsung lihat kalau satu pagi membuatmu menyeberangi kota dua kali.',
  'feature.planner.point.days':
    'Satu kolom per hari, dengan tanggal, cuaca, dan tempat kamu menginap.',
  'feature.planner.point.unscheduled':
    'Tempat tanpa tanggal menunggu di kolomnya sendiri sampai dapat hari.',
  'feature.planner.point.crew':
    'Di {crew} semua menarik sekaligus: kursor langsung, sinkronisasi seketika, tanpa muat ulang.',
  'feature.planner.point.tiles':
    'Tile vektor dari penyimpanan kami sendiri, jadi tidak ada penyedia peta yang mengawasi rencanamu.',
  'feature.costs.title': 'Pengeluaran bersama yang benar-benar beres',
  'feature.costs.lede':
    'Catat pengeluaran dalam mata uang perjalanan, bagi tiap pengeluaran sesuai kesepakatan yang sebenarnya, dan lihat rangkaian transfer terpendek yang menutup semuanya.',
  'feature.costs.point.split':
    'Rata, per bagian, atau persis jumlahnya: per pengeluaran, bukan per perjalanan.',
  'feature.costs.point.currency':
    'Semuanya dikonversi ke satu mata uang perjalanan supaya totalnya berarti.',
  'feature.costs.point.settle':
    'Tampilan penyelesaian menyebut siapa membayar siapa, dan mencatat transfernya begitu terjadi.',
  'feature.costs.point.receipt':
    'Lampirkan tanda terima ke pengeluaran, supaya angkanya selalu punya bukti.',
  'feature.book.title':
    'Setiap reservasi, dengan kode yang kamu perlukan di pintu',
  'feature.book.lede':
    'Penginapan, meja, tur, dan tiket dalam satu daftar, di samping penerbangan, kereta, dan feri yang membawamu di antaranya: masing-masing dengan nomor konfirmasi dan hari yang menjadi tempatnya.',
  'feature.book.point.legs':
    'Ruas perjalanan membawa kursi, peron, terminal, dan kode reservasi.',
  'feature.book.point.day':
    'Reservasi menempel pada satu hari, jadi muncul di rencana tanpa ditulis ulang.',
  'feature.book.point.states':
    'Diminta, dikonfirmasi, dan dibatalkan adalah keadaan terpisah, bukan catatan di kolom.',
  'feature.book.point.export':
    'Ekspor seluruh perjalanan sebagai rencana PDF atau berkas kalender sebelum terbang.',

  'pricing.faq.trial.q': 'Apa yang terjadi ketika masa uji coba berakhir?',
  'pricing.faq.trial.a':
    'Masa uji coba berubah menjadi paket berbayar. Polar menyimpan metode pembayaran saat masa uji coba dimulai dan menagihnya pada hari masa itu berakhir, jadi kalau kamu membatalkan sebelum itu kamu tidak pernah ditagih. Dalam kedua keadaan tidak ada yang dihapus: modul berbayar terkunci, perjalananmu tetap persis di tempatnya, dan semuanya terbuka lagi begitu kamu berlangganan.',
  'pricing.faq.seller.q': 'Sebenarnya saya membeli dari siapa?',
  'pricing.faq.seller.a':
    'Dari Polar. Mereka pedagang resmi kami: menjual langganan kepadamu sebagai penjual ulang, menerima pembayaran, menerbitkan tagihan atas nama mereka sendiri, serta menentukan, memungut, dan menyetorkan pajak penjualan atau PPN yang ditagih negaramu. Pengembalian dana dan sengketa kartu juga diselesaikan dengan mereka. Layanannya tetap kami yang jalankan, dan kami yang menjawab emailmu.',
  'pricing.faq.change.q': 'Bisakah saya berganti paket di tengah perjalanan?',
  'pricing.faq.change.a':
    'Ya. Naik paket berlaku langsung dan dihitung per hari; turun paket berlaku pada akhir periode yang sudah kamu bayar, jadi kamu tidak pernah kehilangan akses yang sudah dibayar.',
  'pricing.faq.seats.q':
    'Bagaimana penagihan per anggota bekerja di paket {crew}?',
  'pricing.faq.seats.a':
    'Kamu membayar kursi yang benar-benar terisi, dan jumlahnya bisa diubah kapan saja. Undangan yang belum dijawab tetap dihitung, sehingga sebuah ruang kerja tidak pernah melewati batas paket tanpa terlihat.',
  'pricing.faq.guests.q':
    'Apakah orang yang bepergian dengan saya butuh langganan sendiri?',
  'pricing.faq.guests.a':
    'Tidak. Semua yang kamu undang ke ruang kerja {crew} tercakup oleh kursinya. Mereka masuk dengan akun sendiri dan melihat perjalanan tempat mereka ditambahkan.',
  'pricing.faq.storage.q': 'Apa saja yang dihitung ke penyimpanan?',
  'pricing.faq.storage.a':
    'Foto, tiket, konfirmasi, dan berkas apa pun yang kamu lampirkan ke perjalanan. Petak peta dan aplikasinya sendiri tidak pernah dihitung. Di Pengaturan kamu bisa melihat persis apa yang memakai ruang.',
  'pricing.faq.export.q': 'Bisakah saya membawa data saya keluar?',
  'pricing.faq.export.a':
    'Selalu. Setiap perjalanan diekspor sebagai rencana PDF dan berkas kalender, dan tempat-tempatmu sebagai GeoJSON. Itu perjalananmu, bukan milik kami.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Tanpa kartu, tanpa tenggat, tanpa hitungan',
  'pricing.card.yearlyPerSeat': '{amount} setahun per anggota, sekali tagih',
  'pricing.card.yearly': '{amount} sekali tagih setahun',
  'pricing.card.seatsUnlimited': 'Anggota tanpa batas',
  'pricing.card.tripsUnlimited': 'perjalanan tanpa batas',
  'pricing.card.startFree': 'Mulai gratis',
  'pricing.card.startTrial': 'Coba {plan}',
  'pricing.card.popular': 'Paling banyak dipilih',
  'pricing.card.noteYearly': 'Ditagih sekali setahun. Dua bulan dari kami.',
  'pricing.card.noteMonthly':
    'Ditagih bulanan. Ganti atau batalkan kapan saja.',
  'pricing.card.trial': {
    other: 'Uji coba {value} hari, kartu di depan, ditagih saat berakhir',
  },
  'pricing.card.seatsUpTo': {
    other: 'Hingga {value} anggota',
  },
  'pricing.card.trips': {
    other: '{value} perjalanan sekaligus',
  },

  'pricing.feature.storage': '{size} untuk foto dan dokumen',
  'pricing.feature.storageShared': '{size} bersama untuk foto dan dokumen',
  'pricing.feature.free.tripsDetail': 'Arsipkan satu untuk mulai yang lain',
  'pricing.feature.solo.modules': 'Semua modul perencanaan',
  'pricing.feature.solo.modulesDetail': 'Reservasi, jurnal, anggaran, bawaan',
  'pricing.feature.crew.membersDetail': 'Ditagih per anggota, ubah kapan saja',
  'pricing.feature.crew.realtimeDetail':
    'Kursor langsung dan sinkronisasi seketika',
  'pricing.feature.crew.supportDetail':
    'Jawaban dari manusia dalam satu hari kerja',

  'pricing.hero.eyebrow': 'Dua perjalanan gratis, selamanya',
  'pricing.hero.title': 'Rencanakan dengan benar.',
  'pricing.hero.titleQuiet': 'Bayar sesuai yang kamu pakai.',
  'pricing.hero.lede':
    'Rencanakan dua perjalanan gratis. Buka semua modul untuk satu orang, atau bawa seluruh rombongan dan sunting rencana yang sama bersama-sama.',
  'pricing.hero.taxNote':
    'Harga dalam dolar AS, belum termasuk pajak penjualan atau PPN. Polar adalah pedagang resmi kami: dialah yang tercantum di tagihanmu, menghitung yang ditagih negaramu, menambahkannya saat pembayaran, dan menyetorkannya. Batalkan kapan saja, dari dalam produk.',
  'pricing.compare.eyebrow': 'Bersebelahan',
  'pricing.compare.title': 'Setiap batas, dibandingkan',
  'pricing.compare.lede':
    'Satu tabel, dibuat dari katalog yang sama yang dibaca sistem penagihan. Kalau satu baris bilang sebuah modul termasuk, pemeriksaan hak juga setuju.',
  'pricing.compare.caption': 'Perbandingan fitur dan batas di ketiga paket',
  'pricing.compare.feature': 'Fitur',
  'pricing.compare.limits': 'Batas',
  'pricing.compare.included': 'Termasuk',
  'pricing.compare.notIncluded': 'Tidak termasuk',
  'pricing.compare.includedIn': 'Termasuk dalam {plan}',
  'pricing.compare.notIn': 'Tidak ada di {plan}',
  'pricing.questions.eyebrow': 'Sebelum kamu bertanya',
  'pricing.questions.title': 'Pertanyaan, terjawab',
  'pricing.questions.lede':
    'Penagihan, masa uji coba, dan mengambil kembali datamu.',
  'pricing.cta.secondary': 'Lihat cara kerjanya',
  'pricing.module.itinerary': 'Rencana harian',
  'pricing.module.map': 'Peta interaktif',
  'pricing.module.budget': 'Anggaran dan pembagian pengeluaran',
  'pricing.module.packing': 'Daftar bawaan dan tugas',
  'pricing.module.reservations': 'Pemesanan',
  'pricing.module.journal': 'Buku harian perjalanan',
  'pricing.module.atlas': 'Peta negara yang dikunjungi',
  'pricing.module.collaboration': 'Undang pelancong lain',
  'pricing.module.realtime': 'Kolaborasi langsung',
  'pricing.module.offlineMaps': 'Peta luring',
  'pricing.module.pdfExport': 'Ekspor PDF dan kalender',
  'pricing.module.prioritySupport': 'Dukungan prioritas',

  'anchor.plans': 'Paket',
  'anchor.compare': 'Perbandingan',
  'anchor.questions': 'Pertanyaan',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Satu tempat untuk rencana perjalanan, peta, pemesanan, uang, dan daftar bawaan — dibagikan dengan semua yang ikut.',
  'footer.attribution':
    'Berjalan di Cloudflare Workers. Data peta © kontributor OpenStreetMap. Penjualan dan penagihan oleh Polar, penjual resmi kami.',
  'footer.column.product': 'Produk',
  'footer.column.account': 'Akun',
  'footer.link.overview': 'Ikhtisar',
  'footer.link.everyModule': 'Semua modul',
  'footer.link.dayPlanner': 'Perencana harian',
  'footer.link.sharedCosts': 'Biaya bersama',
  'footer.link.reservations': 'Pemesanan',
  'footer.link.atlasJournal': 'Atlas dan jurnal',
  'footer.link.createAccount': 'Buat akun',
  'footer.link.terms': 'Ketentuan layanan',
  'footer.link.privacy': 'Pemberitahuan privasi',
} satisfies TranslationOf<typeof En>

export default messages
