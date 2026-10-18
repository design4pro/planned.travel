/**
 * The costs tab's copy, in id.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Jamak.** Bahasa Indonesia hanya punya cabang `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Kamu',
  'person.youTarget': 'kamu',
  'person.removed': 'Pelancong yang dihapus',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Hapus pengeluaran ini?',
  'delete.description':
    '“{title}” dan pembagiannya keluar dari catatan. Ini tidak bisa dibatalkan.',
  'delete.failed': 'Gagal dihapus',
  'delete.failedBody': 'Pengeluaran tidak bisa dihapus. Coba lagi sebentar.',
  'delete.noBalances':
    'Tidak ada saldo yang berubah - tidak ada yang dibagi di sini.',
  'delete.balancesChange': 'Saldo {names} berubah.',
  'delete.confirm': 'Hapus pengeluaran',
  'delete.working': 'Menghapus pengeluaran',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Pengeluaran',
  'toolbar.shownOf': '{shown} dari {total}',
  'toolbar.searchPlaceholder': 'Cari di pengeluaran, catatan, atau pembayar…',
  'toolbar.searchLabel': 'Cari pengeluaran',
  'toolbar.allCategories': 'Semua kategori',
  'toolbar.allDays': 'Semua hari',
  'toolbar.filterCategory': 'Filter per kategori',
  'toolbar.filterDay': 'Filter per hari',
  'toolbar.whose': 'Pengeluaran siapa',
  'toolbar.paidByMe': 'Dibayar olehku',
  'toolbar.owedToMe': 'Aku yang dititipi',
  'toolbar.logged': {
    other: '{value} tercatat',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Pembagian di antara pelancong',
  'split.label': 'Dibagi di antara',
  'split.everyone': 'Semua',
  'split.nobody': 'Tidak ada',
  'split.departed': 'Sudah keluar dari perjalanan',
  'split.departedHint':
    'Menghapus centang orang yang sudah keluar dari perjalanan akan menghapus bagiannya secara permanen.',
  'split.includeFor': 'Sertakan {name} dalam pembagian ini',
  'split.how': 'Bagaimana pengeluaran ini dibagi',
  'split.method.equal': 'Rata',
  'split.method.equalHint':
    'Semua yang ikut membayar sama, dan satuan terkecil yang tersisa jatuh ke orang pertama di daftar.',
  'split.method.exact': 'Tepat',
  'split.method.exactHint':
    'Tulis berapa yang benar-benar jadi tanggungan tiap orang. Jumlahnya harus pas dengan totalnya.',
  'split.method.shares': 'Bagian',
  'split.method.sharesHint':
    'Bobotkan pembagiannya - 2 bagian untuk pasangan, 1 untuk yang lain.',
  'split.method.percentage': 'Persen',
  'split.method.percentageHint':
    'Bagi berdasarkan persen. Persennya harus berjumlah 100.',
  'split.exactFor': 'Jumlah tepat untuk {name}',
  'split.percentFor': 'Persen untuk {name}',
  'split.sharesFor': 'Bagian untuk {name}',
  'split.balanced': 'Pas',
  'split.allocated': '{allocated} dari {total} dialokasikan',
  'split.over': 'lebih {amount}',
  'split.left': 'sisa {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Jumlah',
  'field.currency': 'Mata uang',
  'field.date': 'Tanggal',
  'field.paidBy': 'Dibayar oleh',
  'expense.editTitle': 'Ubah pengeluaran ini',
  'expense.addTitle': 'Tambah pengeluaran',
  'expense.editDescription':
    'Kalau jumlahnya diubah, pembagiannya dihitung ulang di antara semua yang ikut di bawah.',
  'expense.addDescription':
    'Jumlah untuk perjalanan ini disimpan dalam {currency}. Catat kuitansi dalam mata uangnya sendiri, lalu tulis hasil konversinya.',
  'expense.saveFailed': 'Gagal disimpan',
  'expense.what': 'Untuk apa ini',
  'expense.whatPlaceholder': 'Makan malam di Kyubey',
  'expense.amountNotANumber': 'Tulis jumlahnya sebagai angka.',
  'expense.currencyLabel': 'Mata uang yang tertulis di kuitansi ini',
  'expense.convertedTo': 'Dikonversi ke {currency}',
  'expense.convertedHint': 'Berapa {from} jadinya dalam {to} di rekeningmu.',
  'expense.convertedSuggested':
    'Disarankan dari kurs yang dipakai di perjalanan ini pada {date} ({rate}). Ubah agar sesuai dengan rekeningmu.',
  'expense.convertedNotANumber': 'Tulis jumlah hasil konversi sebagai angka.',
  'expense.dateLabel': 'Tanggal pengeluaran',
  'expense.paidByHint':
    'Biarkan tanpa pembayar kalau kamu mencatat kuitansi yang belum ditanggung siapa pun.',
  'expense.nobodyYet': 'Belum ada',
  'expense.whoPaid': 'Siapa yang membayar',
  'expense.notesHint': 'Opsional. Apa pun yang tidak tertulis di kuitansi.',
  'expense.notesPlaceholder': 'Menu degustasi dibagi, minuman terpisah.',
  'expense.noAmount': 'Belum ada jumlah',
  'expense.saving': 'Menyimpan pengeluaran',
  'expense.saveChanges': 'Simpan perubahan',
  'expense.add': 'Tambah pengeluaran',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Catat pembayaran',
  'payment.description':
    'Mencatat transfer membuatnya lepas dari kedua saldo. Ini tidak memindahkan uang - planned.travel menyimpan catatannya, banknya yang memindahkan uang.',
  'payment.youSuffix': '{name} (kamu)',
  'payment.pays': '{from} membayar {to}',
  'payment.pickTwo': 'Pilih dua orang yang berbeda.',
  'payment.paidTo': 'Dibayar ke',
  'payment.needsTwo': 'Pembayaran butuh dua orang yang berbeda.',
  'payment.whoPaying': 'Siapa yang membayar',
  'payment.whoPaid': 'Siapa yang dibayar',
  'payment.amountIn': 'Jumlah dalam {currency}',
  'payment.amountPositive': 'Tulis jumlah yang lebih dari nol.',
  'payment.currencyLabel': 'Mata uang pembayaran',
  'payment.how': 'Bagaimana',
  'payment.howMade': 'Bagaimana pembayarannya dilakukan',
  'payment.dateLabel': 'Tanggal pembayaran',
  'payment.note': 'Catatan',
  'payment.noteHint':
    'Opsional. Sebuah referensi, atau apa yang ditanggungnya.',
  'payment.notePlaceholder': 'Menutup hotel di Kyoto dan tiket JR.',
  'payment.recording': 'Mencatat pembayaran',
  'payment.confirm': 'Catat pembayaran',
  'payment.failed': 'Pembayaran tidak bisa dicatat. Coba lagi sebentar.',
  'payment.method.bankTransfer': 'Transfer bank',
  'payment.method.cash': 'Tunai',
  'payment.method.card': 'Kartu',
  'payment.method.app': 'Aplikasi pembayaran',
  'payment.method.other': 'Yang lain',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Penyelesaian',
  'settle.addPayment': 'Tambah pembayaran',
  'settle.action': 'Selesaikan',
  'settle.empty.title': 'Semua sudah lunas',
  'settle.empty.body':
    'Tidak perlu transfer apa pun. Catat satu pengeluaran, dan setiap ketidakseimbangan akan muncul di sini.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldo',
  'balances.count': {
    other: '{travellers} pelancong',
  },
  'balances.empty':
    'Saldo muncul setelah sebuah pengeluaran punya pembayar dan pembagian.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Menurut kategori',
  'categories.againstBudget': 'Terhadap anggaran perjalanan',
  'categories.progressLabel': 'Terpakai terhadap anggaran perjalanan',
  'categories.empty':
    'Baris anggaran dan pengeluaran dirinci di sini begitu ada yang bisa dirinci.',
  'categories.legendLabel': 'Pengeluaran per kategori',
  'categories.planned': '{amount} direncanakan',
  'categories.nothingSpent':
    'Belum ada yang dibelanjakan. Ini yang sudah Anda rencanakan.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'kurang dari {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Dikeluarkan untuk siapa',
  'memberBar.others': {
    other: '{others} pelancong lainnya',
  },
  'memberBar.notSplit': 'Tidak ditetapkan ke siapa pun',
  'totalTile.label': 'Total pengeluaran perjalanan',
  'totalTile.captionPlanned': 'Direncanakan {amount} untuk semua pelancong',
  'totalTile.captionBudget': 'Anggaran {amount} untuk perjalanan',
  'totalTile.yourShare': 'Bagianmu',
  'totalTile.youPaid': 'Kamu bayar',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Pembayaran tercatat',
  'payments.empty.title': 'Belum ada pembayaran',
  'payments.empty.body':
    'Begitu seseorang melunasi saldo, transfernya dicatat di sini.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Kamu bisa melihat biaya, tetapi tidak bisa mengubahnya',
  'readOnly.body':
    'Hanya pemilik perjalanan dan orang yang bisa mengedit yang dapat menambah, mengubah, atau menghapus pengeluaran dan mencatat pembayaran. Tanyakan kepada pemilik jika ada yang perlu diubah.',
  'readOnly.empty':
    'Belum ada pengeluaran yang dicatat untuk perjalanan ini. Pengeluaran akan muncul di sini setelah pemilik atau editor menambahkannya.',
  'readOnly.settleEmpty':
    'Saat ini tidak perlu ada transfer. Selisih apa pun akan muncul di sini.',
  'refusal.rebaseChanged':
    'Perjalanan berubah saat Anda mengonfirmasi, jadi tidak ada yang diubah. Periksa angka barunya, lalu konfirmasi lagi.',
  'refusal.tripCurrencyChanged':
    'Mata uang anggaran perjalanan ini sekarang {to}, jadi perubahan tidak disimpan. Halaman sudah diperbarui: periksa jumlahnya, lalu simpan lagi.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Mata uang tampilan',
  'display.indicator.perTrip': 'Mata uang sendiri',
  'display.indicator.fixed': 'Juga dalam {code}',
  'display.menu.perTrip': 'Setiap perjalanan dalam mata uangnya sendiri',
  'display.menu.workspace': '{code} (default ruang kerja)',
  'display.menu.rateHint':
    'Memakai kurs yang sudah tercatat pada sebuah perjalanan',
  'display.menu.currentHint':
    'Dipilih, tetapi tidak ada kurs tercatat yang mencakupnya',
  'display.menu.needsLiveRate': 'Memerlukan kurs langsung yang belum tersedia',
  'display.menu.saving': 'Menyimpan pilihan Anda',
  'display.error.title': 'Mata uang tampilan tidak tersimpan',
  'display.error.body':
    'Pilihan Anda tidak dapat disimpan. Coba lagi sebentar lagi.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Sekitar {amount} {code} dalam mata uang tampilan Anda',
  'display.row.notConverted': 'Belum dikonversi',
  'display.alert.title': 'Beberapa angka belum dikonversi',
  'display.alert.body':
    'Tidak ada kurs tercatat untuk pasangan mata uang ini, jadi angka tersebut tetap dalam mata uang anggaran:',
  'display.alert.pair': '{from} ke {to} pada {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Ubah mata uang anggaran',
  'rebase.title': 'Ubah mata uang anggaran',
  'rebase.description':
    'Jumlah yang kamu ketik tetap seperti yang kamu ketik. Total dan saldo perjalanan ini dikonversi ke mata uang yang baru.',
  'rebase.to': 'Mata uang baru',
  'rebase.toPlaceholder': 'Pilih mata uang',
  'rebase.rateLabel': 'Kurs (1 {from} dalam {to})',
  'rebase.rateInverse': 'Artinya 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Masukkan kurs yang lebih dari nol.',
  'rebase.rateOutOfRange':
    'Kurs itu tampak jauh terlalu besar atau terlalu kecil. Periksa arah kursnya.',
  'rebase.source.recent': 'Kurs terakhir yang dipakai di ruang kerja ini',
  'rebase.source.manual': 'Kurs yang kamu masukkan',
  'rebase.noRate':
    'Tidak ada kurs tercatat untuk {from} ke {to}. Masukkan kurs yang ingin kamu pakai.',
  'rebase.waitingForRate': 'Pratinjau muncul begitu ada kurs.',
  'rebase.loading': 'Menghitung konversi',
  'rebase.example':
    '{original} tetap seperti yang kamu ketik dan dihitung sebagai {converted}.',
  'rebase.count.expenses': {
    other: '{count} pengeluaran akan dihitung dalam {to}.',
  },
  'rebase.count.payments': {
    other: '{count} pembayaran akan dihitung dalam {to}.',
  },
  'rebase.count.planned': {
    other: '{count} item yang direncanakan akan dihitung dalam {to}.',
  },
  'rebase.pinned':
    'Harga tempat, reservasi, penginapan, dan transportasi tetap dalam {from}.',
  'rebase.target': 'Anggaran perjalanan {before} menjadi {after}.',
  'rebase.rounding':
    'Setiap jumlah dibulatkan satu kali saja, jadi saldo bisa bergeser hingga {amount}.',
  'rebase.leftover':
    'Setelah perubahan, {name} akan berutang {amount} kepada {other}.',
  'rebase.someone': 'Seseorang',
  'rebase.nothing':
    'Belum ada yang diberi harga di perjalanan ini, jadi tidak ada yang perlu dikonversi.',
  'rebase.unconverted': {
    other:
      '{count} entri memakai mata uang selain {from} dan tidak bisa dikonversi otomatis. Biasanya ini pengeluaran yang dibuat dari reservasi dengan harga dalam mata uang lain: ubah atau hapus, lalu coba lagi.',
  },
  'rebase.unsplittable': {
    other:
      '{count} pengeluaran punya pembagian yang tidak bisa dipindahkan karena semua bagiannya nol. Ubah atau hapus, lalu coba lagi.',
  },
  'rebase.outOfRange':
    'Dengan kurs ini, sebuah jumlah di perjalanan akan terlalu besar untuk disimpan dalam {to}. Periksa kurs dan arahnya.',
  'rebase.tooLarge':
    'Perjalanan ini punya terlalu banyak entri untuk diubah sekaligus: dibutuhkan {changes} perubahan sekaligus, sedangkan batasnya {limit}. Untuk sementara anggaran tetap dalam {from}.',
  'rebase.copyPending':
    'Perjalanan ini masih disalin. Coba lagi sebentar lagi.',
  'rebase.error': 'Konversi tidak bisa dimuat. Tidak ada yang diubah.',
  'rebase.commitError':
    'Kami tidak bisa mengubah mata uang anggaran. Tidak ada yang diubah.',
  'rebase.stale':
    'Mata uang anggaran perjalanan sekarang {current}, bukan {from}. Tutup dialog ini lalu buka lagi.',
  'rebase.sameCurrency': 'Anggaran sudah dalam {to}. Pilih mata uang lain.',
  'rebase.commitUnknown':
    'Kami tidak dapat memastikan apakah mata uang anggaran sudah berubah ke {to}. Muat ulang halaman untuk memeriksanya sebelum mencoba lagi.',
  'rebase.retry': 'Coba lagi',
  'rebase.confirm': 'Ubah ke {to}',
  'rebase.committing': 'Mengubah mata uang anggaran',
  'rebase.done': 'Anggaran sekarang dalam {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Belum ada yang dibelanjakan',
  'screen.summary': '{expenses} · {spent} terpakai',
  'count.expenses': {
    other: '{expenses} pengeluaran',
  },
  'screen.exportCsv': 'Ekspor CSV',
  'screen.addFirst': 'Tambahkan pengeluaran pertama',
  'screen.empty.title': 'Belum ada pengeluaran',
  'screen.empty.body':
    'Catat pengeluaranmu selagi berjalan. planned.travel membaginya ke semua pelancong dan menjaga total berjalan dalam {currency}.',
  'screen.filtered.title': 'Tidak ada yang cocok dengan filter itu',
  'screen.filtered.body':
    'Perluas pencarian, pilih hari lain, atau hapus filter untuk melihat seluruh perjalanan lagi.',
  'export.empty.title': 'Tidak ada yang diekspor',
  'export.empty.body':
    'Tidak ada pengeluaran yang cocok dengan filter yang aktif.',
  'export.ready.title': 'Ekspor siap',
  'export.ready.body': {
    other: '{expenses} pengeluaran ditulis ke CSV.',
  },
  'list.daySpent': '{amount} terpakai',
  'skeleton.loading': 'Memuat pengeluaran',
  'row.noPayer': 'Belum ada pembayar',
  'row.youPaid': 'Kamu yang bayar',
  'row.paid': '{name} yang bayar',
  'row.notYourShare': 'bukan bagianmu',
  'row.yourShare': '{amount} bagianmu',
  'row.noteOn': 'Catatan untuk {title}',
  'row.edit': 'Ubah {title}',
  'row.delete': 'Hapus {title}',
  'row.saving': 'Menyimpan',
  'tile.owe.label': 'Kamu berutang',
  'tile.owe.settled': 'Semuanya sudah lunas',
  'tile.owe.pending': 'Lunasi sebelum pulang',
  'tile.owe.to': 'Kepada',
  'tile.owed.label': 'Utang untukmu',
  'tile.owed.none': 'Tidak ada yang berutang padamu',
  'tile.owed.pending': 'Masih akan kembali padamu',
  'tile.owed.from': 'Dari',
  'tile.outstanding.label': 'Belum lunas',
  'tile.outstanding.none': 'Setiap pengeluaran punya pembayar',
  'tile.outstanding.some': {
    other: '{expenses} pengeluaran belum ada pembayarnya',
  },
  'category.accommodation': 'Akomodasi',
  'category.transport': 'Transportasi',
  'category.food': 'Makanan & minuman',
  'category.activities': 'Aktivitas',
  'category.shopping': 'Belanja',
  'category.fees': 'Biaya & pungutan',
  'category.insurance': 'Asuransi',
  'category.other': 'Lainnya',
  'toolbar.summary.everything': 'Menampilkan semuanya',
  'toolbar.summary.filtered': 'Difilter: {filters}',
  'toolbar.summary.search': 'cocok dengan “{term}”',
  'write.added': 'Pengeluaran ditambahkan',
  'write.updated': 'Pengeluaran diperbarui',
  'write.deleted': 'Pengeluaran dihapus',
  'write.addFailed': 'Pengeluaran tidak ditambahkan',
  'write.editFailed': 'Pengeluaran tidak disimpan',
  'write.deleteFailed': 'Pengeluaran tidak dihapus',
  'write.paymentRecorded': 'Pembayaran dicatat',
  'write.paymentRecordedBody': 'Kedua saldo sudah diperbarui.',
  'write.paymentFailed': 'Pembayaran tidak dicatat',
  'write.rolledBack': 'Perubahan dibatalkan.',
  'expense.saveFallback':
    'Pengeluaran tidak bisa disimpan. Coba lagi sebentar lagi.',
  'delete.removedTraveller': 'pelancong yang dihapus',
} satisfies TranslationOf<typeof En>

export default messages
