/**
 * The world tracker and the map chrome, in Indonesian.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** `Peta dunia` for the atlas module, `perjalanan` for a
 * trip, `negara` for a country and `daftar impian` for the bucket list — the
 * first three are the words `id/shell.ts` already uses, and the address is
 * the formal Anda throughout, matching the rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('id')` reports `other` only — Indonesian
 * nouns do not inflect for number after a numeral — so every plural message
 * below is a single `other` branch.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Indonesian uses, and the parity suite exempts them
 * structurally.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  'panel.stats.empty.title': 'Belum ada yang bisa dihitung',
  'panel.stats.empty.body':
    'Tandai negara di peta atau rencanakan perjalanan, dan angkamu akan mulai muncul di sini.',
  'panel.stats.empty.action': 'Rencanakan perjalanan',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Peta dunia. Belum ada negara yang ditandai sebagai dikunjungi.',
  'screen.world.summary':
    'Peta dunia dengan {visited} dari {total} negara ditandai sebagai dikunjungi.',
  'screen.error.title': 'Peta dunia gagal dimuat',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Memuat peta',
  'map.controls.label': 'Kontrol peta',
  'map.controls.zoomIn': 'Perbesar',
  'map.controls.zoomOut': 'Perkecil',
  'map.controls.north': 'Hadapkan ke utara',
  'map.controls.locate': 'Temukan lokasi saya',
  'map.controls.locateFailed': 'Kami tidak bisa mendapatkan lokasi Anda.',
  'map.controls.locateFailedBody':
    'Pastikan akses lokasi diizinkan untuk situs ini, lalu coba lagi.',

  'map.attribution.label': 'Data peta dari',
  'map.attribution.geocoder': 'Tempat ditemukan dengan',

  'map.basemap.title': 'Peta dasar tidak tersedia',
  'map.basemap.body':
    'Detail jalan sedang offline. Setiap tempat tetap ditampilkan pada posisi sebenarnya, sehingga jarak dan kelompok titik tetap akurat.',
  'map.basemap.credit': 'Garis pantai dari',
  'map.basemap.retry': 'Coba lagi',
  'map.basemap.retrying': 'Memeriksa peta dasar',

  'map.engine.unsupported.title': 'Penggambaran peta tidak tersedia',
  'map.engine.unsupported.body':
    'Browser ini tidak dapat menjalankan peta interaktif: peta membutuhkan WebGL2, dan tidak ada konteks WebGL2 yang tersedia di sini. Tidak ada bagian lain di layar ini yang bergantung padanya.',
  'map.engine.stalled.title': 'Peta belum tergambar',
  'map.engine.stalled.body':
    'Tidak ada yang muncul dalam waktu yang diberikan untuk memulai peta. Mungkin masih akan pulih dengan sendirinya; tidak ada bagian lain di layar ini yang bergantung padanya.',

  'map.coverage.partial.title': 'Detail jalan sebagian',
  'map.coverage.partial.body': {
    other:
      'Data peta yang dipublikasikan belum mencakup {outside} tempat di perjalanan ini. Semuanya tetap digambar pada posisi sebenarnya di garis pantai kami sendiri.',
  },
  'map.coverage.none.title': 'Tidak ada detail jalan di sini',
  'map.coverage.none.body':
    'Jalan-jalan untuk wilayah ini belum dipublikasikan. Garis pantai, pin, dan rute di antaranya semuanya nyata — hanya bangunan dan jalan yang belum ada.',
  'map.coverage.dismiss': 'Tutup catatan cakupan peta',

  'map.legend.title': 'Legenda',
  'map.legend.collapse': 'Ciutkan {title}',
  'map.legend.expand': 'Bentangkan {title}',
  'map.legend.dayPin': 'Contoh pin hari',
  'map.legend.dayPinMeaning': 'Hari rencana perjalanan',
  'map.legend.clusterPin': 'Contoh pin kelompok',
  'map.legend.clusterPinMeaning': 'Tempat yang dikelompokkan',

  'map.filter.label': 'Saring tempat menurut kategori',
  'map.filter.all': 'Semua',
  'map.filter.category': { other: '{name} · {places} tempat' },

  'map.pin.day': 'Hari ke-{day}',
  'map.pin.cluster': {
    other: '{places} tempat — perbesar untuk memisahkannya',
  },

  'map.place.rating': 'Dinilai {rating} dari {max}',
  'map.place.clause.day': 'hari ke-{day}',
  'map.place.clause.rating': 'dinilai {rating} dari {max}',
  'map.place.clause.visited': 'sudah dikunjungi',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Kunjungan terakhir',
  'legend.recent': { other: 'Dalam {years} tahun terakhir' },
  'legend.middle': '{from}–{to} tahun lalu, atau tanpa tanggal',
  'legend.distant': { other: 'Lebih dari {years} tahun lalu' },
  'legend.unvisited': 'Belum dikunjungi',
  'legend.note':
    'Gradasi warna hanya menunjukkan seberapa baru — tab Negara menuliskan setiap tanggal.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Cakupan dunia',
  'panel.coverage.unit': 'dari {total}',
  'panel.coverage.caption': '{share} dari dunia · {visits}',
  'panel.progress.label': 'Menuju semua negara',
  'panel.progress.remaining': 'Sisa {remaining}',
  'panel.toggle.hide': 'Sembunyikan detail peta dunia',
  'panel.toggle.show': 'Tampilkan detail peta dunia',
  'panel.tabs.label': 'Bagian peta dunia',
  'panel.tab.country': 'Negara',
  'panel.tab.stats': 'Statistik',
  'panel.tab.bucket': 'Daftar impian',
  'panel.back': 'Semua negara',
  'panel.list.label': 'Negara yang dikunjungi',
  'panel.loading': 'Memuat peta dunia Anda',

  'panel.empty.blank.title': 'Peta Anda masih kosong',
  'panel.empty.blank.body':
    'Tandai sebuah negara sebagai dikunjungi dan ia akan terisi di peta ini — dengan kunjungan pertama dan terakhirnya, berapa kali Anda ke sana, dan apa pun yang Anda tulis tentangnya.',
  'panel.empty.pick.title': 'Pilih sebuah negara',
  'panel.empty.pick.body':
    'Pilih di peta, di kolom pencarian, atau dari daftar, dan catatan lengkapnya terbuka di sini — kunjungan pertama, kunjungan terakhir, jumlahnya, dan catatan Anda.',

  'panel.stat.places': 'Tempat Anda',
  'panel.stat.placesNone': 'Belum ada yang disematkan di perjalanan',
  'panel.stat.placesCaption':
    'Objek wisata, penginapan, dan persinggahan tersimpan',
  'panel.stat.regions': 'Wilayahmu',
  'panel.stat.regionsNone': 'Belum ada wilayah yang ditandai',
  'panel.stat.regionsCaption': 'Negara bagian, provinsi, prefektur',
  'panel.stat.visits': 'Kunjunganmu',
  'panel.stat.visitsCaption': 'Setiap kedatangan yang tercatat',
  'panel.stat.trips': 'Perjalanan Anda',
  'panel.stat.tripsCaption': 'Semua perjalanan yang Anda ikuti',
  'panel.stat.cities': 'Kotamu',
  'panel.stat.citiesCaption': 'Kota tempat Anda menginap atau singgah',
  'panel.stat.days': 'Hari perjalananmu',
  'panel.stat.daysCaption': 'Di seluruh perjalanan dalam catatan Anda',
  'panel.continents.label': 'Negara menurut benua',

  'panel.bucket.empty.title': 'Daftar masih kosong',
  'panel.bucket.empty.body':
    'Tempat yang selalu ingin Anda datangi. Tambahkan, lalu centang saat Anda tiba di sana.',
  'panel.bucket.label': 'Daftar impian',
  'panel.bucket.progress': '{done} dari {total} selesai',
  'panel.bucket.done': 'Selesai',
  'panel.bucket.toGo': 'Belum',
  'panel.bucket.target': 'sebelum {year}',
  'panel.bucket.hidden': {
    other:
      'Masih ada {entries} entri lain di daftar Anda yang tidak ditampilkan di sini.',
  },
  'panel.bucket.kind.country': 'Negara',
  'panel.bucket.kind.region': 'Wilayah',
  'panel.bucket.kind.place': 'Tempat',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Benua Afrika',
  'continent.antarctica': 'Benua Antarktika',
  'continent.asia': 'Benua Asia',
  'continent.europe': 'Benua Eropa',
  'continent.northAmerica': 'Benua Amerika Utara',
  'continent.oceania': 'Benua Oseania',
  'continent.southAmerica': 'Benua Amerika Selatan',
  'continent.unknown': 'Benua tidak tercatat',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Dikunjungi',
  'record.firstVisit': 'Kunjungan pertama',
  'record.lastVisit': 'Kunjungan terakhir',
  'record.visitDates': 'Tanggal kunjungan',
  'record.notRecorded': 'Tidak tercatat',
  'record.datesUnrecorded': 'Tanggal tidak tercatat',
  'record.visits': { other: '{visits} kunjungan' },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Kunjungan pertama {from}',
  'record.spanTo': 'Kunjungan terakhir {to}',
  'record.visitsUnit': { other: 'kunjungan' },
  'record.gap.days': { other: 'berselang {gap} hari' },
  'record.gap.months': { other: 'berselang {gap} bulan' },
  'record.gap.years': { other: 'berselang {gap} tahun' },
  'record.note.empty': 'Belum ada catatan',
  'record.noOutline':
    'Garis bentuk dunia yang digambar peta ini dipotong pada skala 1:110m, sehingga wilayah ini terlebur ke negara induknya — tidak ada yang bisa dibingkai di peta. Kunjungannya tetap dihitung.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Urutkan negara',
  'list.sort.code': 'Kode negara',
  'list.sort.codeStatement': 'Diurutkan menurut kode negara, A sampai Z.',
  'list.sort.name': 'Nama negara',
  'list.sort.nameStatement':
    'Diurutkan menurut nama negara, A sampai Z, lalu kode negara.',
  'list.sort.recent': 'Kunjungan terbaru',
  'list.sort.recentStatement':
    'Diurutkan dari kunjungan terbaru, lalu kode negara.',
  'list.sort.visits': 'Kunjungan terbanyak',
  'list.sort.visitsStatement':
    'Diurutkan dari kunjungan terbanyak, lalu kode negara.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Dilebur ke negara induknya oleh garis bentuk dunia, jadi tidak ada yang bisa dibingkai di peta.',
  'list.announce.selected': '{name} dipilih.',
  'list.announce.selectedUnframed': '{name} dipilih. {reason}',
  'list.empty.title': 'Belum ada negara di peta',
  'list.empty.body':
    'Sebuah negara muncul di sini begitu kunjungan tercatat padanya — dengan kedatangan pertama, yang terbaru, dan berapa kali Anda ke sana.',
  'list.loading': 'Memuat negara yang dikunjungi',
  'list.error.title': 'Daftar negara Anda gagal dimuat',
  'list.error.body':
    'Peta dunia tidak bisa membaca negara-negara yang Anda kunjungi saat ini. Tidak ada yang hilang — semuanya masih tercatat.',
  'list.error.retry': 'Coba lagi',
  'list.error.retrying': 'Memuat negara Anda',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Cari negara',
  'search.loading': 'Memuat negara Anda',
  'search.placeholder': 'Nama atau kode negara',
  'search.entry.notVisited': 'Belum dikunjungi',
  'search.entry.noOutline': 'tanpa garis bentuk di peta',
  'search.entry.separator': ' · ',
  'search.cleared': 'Pilihan dikosongkan.',
  'search.unframed':
    '{name} tidak memiliki garis bentuk pada skala dunia, jadi peta tidak punya apa pun untuk dibingkai.',
  'search.unframedVisited':
    '{name} tidak memiliki garis bentuk pada skala dunia, jadi peta tidak punya apa pun untuk dibingkai. Catatannya tidak terpengaruh.',
  'search.results.empty':
    'Belum ada negara dalam catatan Anda. Ketik untuk mencari setiap negara di dunia.',
  'search.results.emptyPinned':
    '{name} dipilih. Belum ada negara dalam catatan Anda — ketik untuk mencari setiap negara di dunia.',
  'search.results.record': {
    other: '{countries} negara dalam catatan Anda.',
  },
  'search.results.capped': 'Menampilkan {shown} yang pertama.',
  'search.results.pinned': '{name} dipilih dan tampil paling atas.',
  'search.results.none': 'Tidak ada negara yang cocok dengan {term}.',
  'search.results.matches': {
    other: '{countries} negara cocok dengan {term}.',
  },
  'search.announce.selected': '{name} dipilih.',
  'search.announce.framing': '{name} dipilih. Peta sedang membingkainya.',
  'search.announce.unframed': '{name} dipilih. {reason}',
  'search.empty.title': 'Belum ada apa pun dalam catatan Anda',
  'search.empty.body':
    'Ketik nama negara, atau kode dua hurufnya, untuk menemukannya di peta.',
  'search.empty.noMatchTitle': 'Tidak ada negara yang cocok dengan “{term}”',
  'search.empty.noMatchBody':
    'Periksa ejaannya, atau coba kode dua huruf — PT menemukan Portugal. Semua {countries} negara bisa dicari, pernah Anda kunjungi atau belum.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Catatan Anda',
  'actions.visit.absent.title': 'Belum dikunjungi',
  'actions.visit.absent.caption': 'Kunjungan tanpa perjalanan di baliknya.',
  'actions.visit.title': 'Dikunjungi',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Tidak ada di daftar',
  'actions.goal.absent.caption': 'Tempat yang ingin Anda datangi.',
  'actions.goal.title': 'Di daftar impian',
  'actions.goal.waiting': 'Menunggu gilirannya.',
  'actions.goal.target': 'Target: {year}.',
  'actions.goal.achieved.title': 'Sudah dicentang dari daftar',
  'actions.goal.achieved.caption':
    'Anda sampai di sana. Entrinya tetap tersimpan sebagai catatan.',

  'actions.button.remove': 'Hapus',
  'actions.button.mark': 'Tandai dikunjungi',
  'actions.button.add': 'Tambah ke daftar',
  'actions.visit.remove.name': 'Hapus {name} dari peta dunia Anda',
  'actions.visit.remove.busy': 'Menghapus {name} dari peta dunia Anda',
  'actions.visit.add.name': 'Tandai dikunjungi, {name}',
  'actions.visit.add.busy': 'Menandai {name} sebagai dikunjungi',
  'actions.goal.remove.name': 'Hapus {name} dari daftar impian Anda',
  'actions.goal.remove.busy': 'Menghapus {name} dari daftar impian Anda',
  'actions.goal.add.name': 'Tambah ke daftar, {name}',
  'actions.goal.add.busy': 'Menambahkan {name} ke daftar impian Anda',

  'actions.hint':
    'Keduanya langsung berlaku, dan keduanya bisa dibatalkan di sini.',
  'actions.offline':
    'Perangkat Anda tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.',
  'actions.toast.marked': 'Ditandai sebagai dikunjungi',
  'actions.toast.markedBody': '{name} ada di peta dunia Anda.',
  'actions.toast.markFailed': '{name} gagal ditandai',
  'actions.toast.unmarked': 'Dihapus dari peta dunia Anda',
  'actions.toast.unmarkedBody':
    '{name} tidak lagi ditandai sebagai dikunjungi.',
  'actions.toast.unmarkFailed': '{name} gagal dihapus',
  'actions.toast.listed': 'Ditambahkan ke daftar impian Anda',
  'actions.toast.listedBody': '{name} adalah tempat yang ingin Anda datangi.',
  'actions.toast.listFailed': '{name} gagal ditambahkan',
  'actions.toast.unlisted': 'Dihapus dari daftar impian Anda',
  'actions.toast.unlistedBody': '{name} tidak lagi ada di daftar.',
  'actions.toast.unlistFailed': '{name} gagal dihapus',
  'actions.toast.fallback':
    'Perubahan tidak sampai ke server. Coba lagi sebentar lagi.',

  'actions.confirm.visit.title': 'Hapus {name} dari peta dunia Anda?',
  'actions.confirm.visit.body': {
    other:
      '{visits} kunjungan tercatat{dates} akan dihapus{note}. Perjalanan dan tempat tersimpan Anda tidak tersentuh.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ' beserta catatan yang Anda tulis',
  'actions.confirm.goal.title': 'Hapus {name} dari daftar impian Anda?',
  'actions.confirm.goal.body':
    'Entri ini sudah dicentang, jadi menghapusnya juga menghapus catatan bahwa Anda pernah sampai di sana. Peta dunia dan perjalanan Anda tidak tersentuh.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { other: 'Perjalanan ruang kerja' },
  'card.visits': { other: 'Kunjungan' },
  'card.places': { other: 'Tempat ruang kerja' },
  'card.firstTrip': 'Perjalanan pertama',
  'card.lastTrip': 'Perjalanan terakhir',
  'card.firstVisit': 'Kunjungan pertama',
  'card.lastVisit': 'Kunjungan terakhir',
  'card.absent': 'Tidak tercatat',
  'card.loading': 'Memuat negara ini',
  'card.loadingNamed': 'Memuat {name}',
  'card.error.body': 'Angka-angka ini gagal dimuat. Tidak ada yang hilang.',
  'card.error.retry': 'Coba lagi',
  'overlay.close': 'Tutup {name}',
  'regions.label': 'Wilayah',
  'regions.hint':
    'Menambahkan wilayah juga menandai {country} sebagai pernah dikunjungi.',
  'regions.keeps':
    'Menghapus wilayah tidak menghapus {country} dari atlas Anda.',
  'regions.keeps.unvisited':
    'Wilayah ini tetap tercatat. Tandai {country} sebagai pernah dikunjungi atau tambahkan wilayah untuk mengembalikannya ke peta.',
  'regions.empty.title': 'Belum ada wilayah yang tercatat di sini',
  'regions.empty.body':
    'Tambahkan negara bagian, provinsi, atau area yang pernah Anda kunjungi di {country}.',
  'regions.input.label': 'Tambahkan wilayah di {country}',
  'regions.input.placeholder': 'Misalnya, Bavaria',
  'regions.add': 'Tambah wilayah',
  'regions.adding': 'Menambahkan {region}',
  'regions.remove': 'Hapus {region}',
  'regions.loading': 'Memuat wilayah Anda',
  'regions.status.added': '{region} ditambahkan',
  'regions.status.exists': '{region} sudah tercatat',
  'regions.status.removed': '{region} dihapus',
  'regions.status.addedCountry':
    '{region} ditambahkan. {country} kini ditandai sebagai pernah dikunjungi.',
  'regions.error.invalid': 'Masukkan nama wilayah.',
  'regions.error.hidden':
    'Nama berisi karakter yang tidak diizinkan. Hapus karakter tersebut dan coba lagi.',
  'regions.error.load': 'Wilayah Anda di {country} tidak dapat dimuat.',
  'regions.error.add': '{region} tidak dapat ditambahkan. Coba lagi.',
  'regions.error.remove': '{region} tidak dapat dihapus. Coba lagi.',
  'regions.error.full':
    'Anda telah mencatat {limit} wilayah. Hapus satu untuk menambahkan wilayah lain.',
  'regions.reload': 'Muat ulang wilayah',
  'actions.confirm.visitRegions.body': {
    other:
      '{history}Wilayah yang Anda catat di {country} tetap tersimpan: {count}.',
  },
  'regions.error.uncertain':
    'Perubahan tidak dapat dikonfirmasi. Muat ulang wilayah Anda untuk memeriksa apa yang tersimpan.',
  'regions.status.refreshFailed':
    '{result} Atlas tidak dapat diperbarui. Muat ulang untuk memperbarui peta.',

  'panel.stat.periodLabel': 'Tampilkan angka untuk',
  'panel.stat.allTime': 'Sepanjang waktu',
  'panel.stat.groupAll': 'Angka sepanjang waktu',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Angka tahun {year}',
  'panel.stat.announceAll': 'Menampilkan angka sepanjang waktu.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Menampilkan angka tahun {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Perjalanan yang dimulai pada tahun {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'Dalam perjalanan yang dimulai pada tahun {year}',
  'panel.stat.countries': 'Negara dalam perjalananmu',
  'panel.stat.countriesCaption': 'Negara berbeda dalam perjalanan ini',
  'panel.stat.streak': 'Rangkaian tahun perjalananmu',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange':
    'Perjalanan setiap tahun, dari {first} hingga {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Satu perjalanan pada tahun {last}',
  'panel.stat.streakNone':
    'Tambahkan perjalanan bertanggal untuk memulai rangkaian',
  'visitEdit.edit': 'Edit kunjungan',
  'visitEdit.note': 'Catatan',
  'visitEdit.save': 'Simpan kunjungan',
  'visitEdit.cancel': 'Batal',
  'visitEdit.loading': 'Memuat kunjungan',
  'visitEdit.saving': 'Menyimpan kunjungan',
  'visitEdit.failed':
    'Penyimpanan belum dapat dipastikan. Draf tetap tersimpan; coba lagi.',
  'visitEdit.missing':
    'Kunjungan ini tidak tersedia lagi. Buka kembali negaranya.',
  'visitEdit.noteInvalid': 'Gunakan maksimal 2.000 karakter.',
  'visitEdit.bounds':
    'Kunjungan pertama tidak boleh setelah kunjungan terakhir.',
  'visitEdit.future': 'Pilih hari ini atau tanggal sebelumnya.',
  'visitEdit.dateInvalid':
    'Masukkan tanggal yang valid dalam format TTTT-BB-HH.',
  'visitEdit.reload': 'Tersimpan. Muat ulang catatan',
} satisfies TranslationOf<typeof En>

export default messages
