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
} satisfies TranslationOf<typeof En>

export default messages
