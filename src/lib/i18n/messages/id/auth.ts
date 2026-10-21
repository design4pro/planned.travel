/**
 * The sign-in, sign-up, recovery and invitation screens, in Indonesian.
 *
 * Authored from `../en/auth`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * These are the only screens a traveller reaches with no session, so the
 * language is negotiated from `Accept-Language` alone and there is no stored
 * preference to correct a bad guess with. Two thirds of the keys are validation
 * and failure copy, read at the worst possible moment — so they are plain
 * sentences, not clipped labels.
 *
 * Indonesian does not inflect for number, so `Intl.PluralRules` reports the
 * single category `other` and each `one`/`other` pair collapses to one branch.
 * `{value}` still arrives already grouped for the locale.
 *
 * **Terms this catalogue fixes.** `kata sandi` for a password rather than the
 * English loan, `kunci sandi` for a passkey, `ruang kerja` for a workspace and
 * `frasa sandi` for a passphrase. The placeholder address and the placeholder
 * name are localised together — `anda@contoh.com` and `Adi Nugroho` read as one
 * person, the way `you@example.com` and `Alex Moreau` do in English. The
 * provider names in `social.*` are trademarks and arrive as data.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  'shell.home': 'Beranda planned.travel',
  'shell.legal':
    'Dengan melanjutkan, Anda menyetujui ketentuan layanan dan pemberitahuan privasi planned.travel.',

  'panel.eyebrow': 'Rencanakan bersama',
  'panel.heading':
    'Setiap perjalanan, dari pin pertama sampai kartu pos terakhir.',
  'panel.body':
    'Rencana bersama di peta sungguhan, anggaran yang benar-benar pas, daftar bawaan yang tidak lupa, dan jurnal yang layak disimpan.',
  'panel.map.title': 'Satu peta, satu rencana',
  'panel.map.detail':
    'Semua persinggahan, penginapan dan perpindahan dalam satu rencana.',
  'panel.group.title': 'Semua orang seirama',
  'panel.group.detail':
    'Suntingan, suara dan komentar sampai seketika ke seluruh rombongan.',
  'panel.costs.title': 'Biaya yang pas',
  'panel.costs.detail':
    'Anggaran bersama, tagihan yang lunas, tanpa lembar kerja.',

  'divider.or': 'atau',
  'divider.orEmail': 'atau pakai email Anda',

  'social.continue': 'Lanjutkan dengan {provider}',
  'social.signUp': 'Daftar dengan {provider}',
  'social.opening': 'Membuka {provider}',

  'passkey.action': 'Masuk dengan kunci sandi',
  'passkey.waiting': 'Menunggu perangkat Anda',

  'password.show': 'Tampilkan kata sandi',
  'password.hide': 'Sembunyikan kata sandi',
  'password.showNew': 'Tampilkan kata sandi baru',
  'password.hideNew': 'Sembunyikan kata sandi baru',
  'password.showConfirm': 'Tampilkan konfirmasi kata sandi',
  'password.hideConfirm': 'Sembunyikan konfirmasi kata sandi',

  'field.email': 'Alamat email',
  'field.email.placeholder': 'anda@contoh.com',
  'field.password': 'Kata sandi',
  'field.password.placeholder': 'Kata sandi Anda',
  'field.newPassword': 'Kata sandi baru',
  'field.newPassword.placeholder': 'Frasa yang akan Anda ingat',
  'field.confirmPassword': 'Konfirmasi kata sandi',
  'field.confirmNewPassword': 'Konfirmasi kata sandi baru',
  'field.confirmPassword.placeholder': 'Ketik sekali lagi',
  'field.name': 'Nama Anda',
  'field.name.hint':
    'Terlihat oleh orang-orang yang merencanakan perjalanan bersama Anda.',
  'field.name.placeholder': 'Adi Nugroho',

  'validation.emailRequired': 'Masukkan alamat email Anda.',
  'validation.emailTooLong': 'Alamat email itu terlalu panjang.',
  'validation.emailInvalid': 'Itu tidak tampak seperti alamat email.',
  'validation.passwordRequired': 'Masukkan kata sandi Anda.',
  'validation.passwordShort': {
    other:
      'Gunakan minimal {value} karakter — frasa pendek lebih baik daripada kata yang rumit.',
  },
  'validation.passwordLong': { other: 'Batasi sampai {value} karakter.' },
  'validation.passwordMismatch': 'Kedua kata sandi itu tidak sama.',
  'validation.nameShort':
    'Isi nama Anda supaya teman seperjalanan tahu siapa Anda.',
  'validation.nameTooLong': 'Nama itu terlalu panjang.',
  'validation.termsRequired': 'Setujui ketentuannya dulu untuk melanjutkan.',
  'validation.codeLength': 'Kode autentikator terdiri dari enam angka.',
  'validation.codeDigits': 'Kode autentikator hanya berisi angka.',
  'validation.backupShort': 'Kode cadangan itu tampak terlalu pendek.',
  'validation.backupLong': 'Kode cadangan itu tampak terlalu panjang.',

  'login.eyebrow': 'Selamat datang kembali',
  'login.heading': 'Masuk ke planned.travel',
  'login.description':
    'Lanjutkan rencana, anggaran dan daftar Anda persis di tempat Anda tinggalkan.',
  'login.newHere': 'Baru di sini?',
  'login.createAccount': 'Buat akun',
  'login.forgot': 'Lupa kata sandi?',
  'login.remember': 'Tetap masuk di perangkat ini',
  'login.submit': 'Masuk',
  'login.submitting': 'Sedang memasukkan Anda',

  'register.eyebrow': 'Buat akun Anda',
  'register.heading': 'Mulai merencanakan dalam beberapa menit',
  'register.description':
    'Satu akun mencakup setiap perjalanan, setiap teman seperjalanan dan setiap daftar.',
  'register.haveAccount': 'Sudah punya akun?',
  'register.signIn': 'Masuk',
  'register.terms':
    'Saya setuju dengan ketentuan layanan dan pemberitahuan privasi.',
  'register.submit': 'Buat akun',
  'register.submitting': 'Membuat akun Anda',

  'strength.hint': {
    other:
      'Minimal {value} karakter. Frasa pendek lebih baik daripada kata yang rumit.',
  },
  'strength.tooShort': 'Kekuatan: Terlalu pendek',
  'strength.weak': 'Kekuatan: Lemah',
  'strength.fair': 'Kekuatan: Cukup',
  'strength.strong': 'Kekuatan: Kuat',
  'strength.excellent': 'Kekuatan: Sangat kuat',

  'forgot.eyebrow': 'Bantuan kata sandi',
  'forgot.heading': 'Atur ulang kata sandi Anda',
  'forgot.description':
    'Sebutkan alamat pada akun Anda dan kami kirimkan tautan untuk membuat kata sandi baru.',
  'forgot.submit': 'Kirimi saya tautannya',
  'forgot.submitting': 'Mengirim tautan Anda',
  'forgot.back': 'Kembali ke halaman masuk',
  'forgot.sent.eyebrow': 'Periksa kotak masuk',
  'forgot.sent.heading': 'Tautan Anda sedang dalam perjalanan',
  'forgot.sent.description':
    'Kalau ada akun yang memakai {email}, tautan untuk memilih kata sandi baru sudah ada di kotak masuknya.',
  'forgot.sent.title': 'Tautannya berlaku sekali, selama satu jam',
  'forgot.sent.body':
    'Belum ada yang masuk? Periksa folder spam, lalu kirim lagi. Meminta tautan baru diam-diam menonaktifkan yang lama.',
  'forgot.sent.resend': 'Kirim lagi',
  'forgot.sent.resending': 'Mengirim lagi',
  'forgot.sent.change': 'Pakai email lain',

  'reset.eyebrow': 'Pengaturan ulang kata sandi',
  'reset.heading': 'Pilih kata sandi baru',
  'reset.description': {
    other:
      'Pilih yang panjangnya minimal {value} karakter. Frasa pendek lebih mudah diingat dan lebih sulit ditebak.',
  },
  'reset.submit': 'Simpan kata sandi baru',
  'reset.submitting': 'Menyimpan kata sandi Anda',
  'reset.back': 'Kembali ke halaman masuk',
  'reset.stale.heading': 'Tautan itu tidak bisa dipakai',
  'reset.stale.description':
    'Tautan pengaturan ulang kedaluwarsa setelah satu jam dan hanya berlaku sekali — pertukaran teraman yang ada.',
  'reset.stale.action': 'Minta tautan baru',
  'reset.done.heading': 'Kata sandi baru Anda sudah aktif',
  'reset.done.description':
    'Semua sesi lain sudah dikeluarkan, jadi siapa pun yang tahu kata sandi lama tidak punya jalan masuk lagi.',
  'reset.done.title': 'Keluar dari semua perangkat lain',
  'reset.done.body':
    'Masuk dengan kata sandi baru Anda untuk melanjutkan rencana.',
  'reset.done.action': 'Masuk',

  'twoFactor.eyebrow': 'Verifikasi dua langkah',
  'twoFactor.heading': 'Pastikan ini memang Anda',
  'twoFactor.description':
    'Akun Anda dilindungi langkah kedua. Masukkan kode terbaru dari aplikasi autentikator Anda.',
  'twoFactor.back': 'Ulangi dari halaman masuk',
  'twoFactor.methods': 'Cara verifikasi',
  'twoFactor.totp.tab': 'Autentikator',
  'twoFactor.totp.label': 'Kode enam angka',
  'twoFactor.totp.hint': 'Kodenya berganti setiap 30 detik.',
  'twoFactor.totp.submit': 'Verifikasi lalu lanjut',
  'twoFactor.backup.tab': 'Kode cadangan',
  'twoFactor.backup.label': 'Kode cadangan',
  'twoFactor.backup.hint':
    'Dari daftar yang Anda simpan saat mengaktifkan verifikasi dua langkah. Tiap kode berlaku sekali.',
  'twoFactor.backup.submit': 'Pakai kode cadangan',
  'twoFactor.submitting': 'Memeriksa kode Anda',
  'twoFactor.trust.label': 'Percayai perangkat ini selama 30 hari',
  'twoFactor.trust.detail':
    'Lewati langkah ini di peramban ini sampai saat itu. Lakukan hanya pada perangkat milik Anda sendiri.',

  'verify.done.eyebrow': 'Email terkonfirmasi',
  'verify.done.heading': 'Semuanya beres',
  'verify.done.description':
    'Alamat Anda sudah terverifikasi, jadi undangan, pengingat dan ringkasan perjalanan pasti sampai.',
  'verify.done.title': 'Terverifikasi',
  'verify.done.body': '{email} sudah dikonfirmasi pada akun ini.',
  'verify.done.bodyUnknown':
    'Alamat email Anda sudah dikonfirmasi pada akun ini.',
  'verify.done.action': 'Ke dasbor Anda',

  'verify.pending.eyebrow': 'Satu hal terakhir',
  'verify.pending.heading': 'Konfirmasi alamat email Anda',
  'verify.pending.description':
    'Kami mengirim tautan konfirmasi ke {email}. Membukanya menjaga akun Anda tetap bisa dipulihkan dan membuat teman seperjalanan bisa mengundang Anda.',
  'verify.pending.wrongAddress': 'Salah alamat?',
  'verify.pending.changeIt': 'Ubah di pengaturan',
  'verify.pending.title': 'Tautannya berlaku 24 jam',
  'verify.pending.body':
    'Tidak ada apa pun di kotak masuk? Periksa folder spam, lalu kirim lagi.',
  'verify.pending.resentTitle': 'Baru saja dikirim lagi',
  'verify.pending.resentBody':
    'Tunggu sebentar, lalu periksa kotak masuk — dan folder spam Anda.',
  'verify.pending.resend': 'Kirim ulang konfirmasi',
  'verify.pending.resending': 'Mengirim lagi',
  'verify.pending.continue': 'Lanjut saja',

  'verify.request.eyebrow': 'Konfirmasi email',
  'verify.request.heading': 'Kirim tautan konfirmasi baru',
  'verify.request.description':
    'Tautan konfirmasi berlaku 24 jam dan hanya sekali pakai. Sebutkan alamat Anda dan yang baru segera dikirim.',
  'verify.request.submit': 'Kirim tautan konfirmasi',
  'verify.request.submitting': 'Mengirim tautan Anda',
  'verify.request.sentTitle': 'Sedang dikirim',
  'verify.request.sentBody':
    'Kalau alamat itu punya akun yang menunggu konfirmasi, tautannya sudah ada di kotak masuknya.',
  'verify.request.change': 'Pakai email lain',
  'verify.request.back': 'Kembali ke halaman masuk',

  'invitation.eyebrow': 'Undangan ruang kerja',
  'invitation.heading': 'Gabung ke {workspace}',
  'invitation.description':
    'Menerimanya menambahkan Anda ke ruang kerja ini dan membagikan perjalanan, anggaran serta daftarnya kepada Anda.',
  'invitation.invitedAs': 'Diundang sebagai {email}',
  'invitation.role': 'Peran Anda',
  'invitation.means': 'Artinya',
  'invitation.invitedBy': 'Diundang oleh',
  'invitation.expires': 'Kedaluwarsa',
  'invitation.accept': 'Terima undangan',
  'invitation.accepting': 'Bergabung ke ruang kerja',
  'invitation.decline': 'Tolak',
  'invitation.declining': 'Menolak',
  'invitation.reassurance':
    'Anda bisa meninggalkan ruang kerja kapan saja lewat pengaturannya, dan apa pun yang Anda buat di luar sana tidak pernah ikut dibagikan.',

  'invitation.role.owner': 'Pemilik — kendali penuh, termasuk tagihan',
  'invitation.role.admin':
    'Administrator — mengelola perjalanan, anggota dan pengaturan',
  'invitation.role.member':
    'Anggota — merencanakan perjalanan bersama yang lain',
  'invitation.role.other': '{role} — akses ditentukan pemilik ruang kerja',
  'invitation.role.badge.owner': 'Pemilik',
  'invitation.role.badge.admin': 'Administrator',
  'invitation.role.badge.member': 'Anggota',

  'invitation.anonymous.heading': 'Masuk untuk melihat undangan Anda',
  'invitation.anonymous.description':
    'Undangan terikat pada alamat email tujuannya, jadi kami perlu tahu siapa Anda sebelum bisa menampilkan yang satu ini.',
  'invitation.anonymous.body':
    'Gunakan alamat tujuan undangan itu. Kami akan membawa Anda kembali ke sini setelahnya.',
  'invitation.anonymous.action': 'Masuk untuk melanjutkan',
  'invitation.anonymous.noAccount': 'Belum punya akun?',
  'invitation.anonymous.register': 'Buat akun dengan alamat yang diundang',

  'invitation.mismatch.heading': 'Undangan ini untuk alamat lain',
  'invitation.mismatch.description':
    'Anda sedang masuk sebagai orang lain, jadi undangan ini bukan hak Anda untuk diterima.',
  'invitation.mismatch.title': 'Masuk sebagai {email}',
  'invitation.mismatch.body':
    'Keluar lalu masuk lagi dengan alamat tujuan undangan, atau minta undangan baru untuk akun ini.',
  'invitation.mismatch.action': 'Ganti akun',
  'invitation.mismatch.back': 'Kembali ke halaman masuk',

  'invitation.unverified.heading': 'Konfirmasi email Anda untuk bergabung',
  'invitation.unverified.description':
    'Ruang kerja hanya menerima alamat yang sudah dikonfirmasi, jadi tidak ada yang bisa masuk gara-gara salah ketik.',
  'invitation.unverified.title': '{email} belum dikonfirmasi',
  'invitation.unverified.body':
    'Buka tautan konfirmasi di kotak masuk Anda, lalu kembali ke halaman ini. Undangannya akan tetap menunggu.',
  'invitation.unverified.action': 'Konfirmasi email saya',
  'invitation.unverified.resend': 'Kirim ulang email konfirmasi',

  'invitation.unavailable.heading': 'Undangan ini sudah tidak berlaku',
  'invitation.unavailable.description':
    'Undangan bertahan tujuh hari, dan langsung gugur begitu dipakai atau ditarik.',
  'invitation.unavailable.title': 'Tidak ada yang bisa diterima di sini',
  'invitation.unavailable.body':
    'Minta orang yang mengundang Anda mengirim undangan baru, dan halaman ini akan langsung menampilkannya.',
  'invitation.unavailable.dashboard': 'Ke dasbor Anda',

  'invitation.declined.eyebrow': 'Undangan ditolak',
  'invitation.declined.heading': 'Tidak masalah — tidak ada yang dibagikan',
  'invitation.declined.description':
    'Pemilik ruang kerja sudah diberi tahu, dan tautan ini tidak bisa dipakai lagi.',
  'invitation.declined.action': 'Ke dasbor Anda',

  'error.unexpected.title': 'Ada yang tidak beres',
  'error.unexpected.detail': 'Itu gagal. Coba lagi sebentar lagi.',
  'error.rateLimited.title': 'Terlalu banyak percobaan',
  'error.rateLimited.detail':
    'Demi keamanan Anda, kami menjeda proses masuk dari perangkat ini beberapa menit. Coba lagi tak lama lagi.',
  'error.offline.title': 'Tidak ada koneksi',
  'error.offline.detail':
    'Kami tidak bisa menjangkau planned.travel. Periksa koneksi Anda lalu coba lagi.',

  'error.credentials.title': 'Data itu tidak cocok',
  'error.credentials.detail':
    'Periksa alamat email dan kata sandinya lalu coba lagi. Kalau Anda mendaftar lewat Google atau Apple, pakai tombol itu saja.',
  'error.password.title': 'Data itu tidak cocok',
  'error.password.detail':
    'Periksa alamat email dan kata sandinya lalu coba lagi.',
  'error.noPassword.title': 'Akun ini tidak punya kata sandi',
  'error.noPassword.detail':
    'Akun ini masuk lewat penyedia sosial atau kunci sandi. Pakai salah satu pilihan di atas.',
  'error.unverified.title': 'Konfirmasi email Anda dulu',
  'error.unverified.detail':
    'Kami mengirim tautan konfirmasi saat Anda mendaftar. Buka tautannya, lalu kembali ke sini.',
  'error.emailTaken.title': 'Email itu sudah terdaftar',
  'error.emailTaken.detail':
    'Masuk saja, atau atur ulang kata sandi kalau Anda lupa.',
  'error.noAccount.title': 'Kami tidak menemukan akun itu',
  'error.noAccount.detail': 'Periksa alamatnya, atau buat akun baru.',
  'error.passwordTooShort.title': 'Kata sandi terlalu pendek',
  'error.passwordTooShort.detail':
    'Pilih frasa sandi yang lebih panjang lalu coba lagi.',
  'error.passwordTooLong.title': 'Kata sandi terlalu panjang',
  'error.passwordTooLong.detail':
    'Pilih frasa sandi yang lebih pendek lalu coba lagi.',
  'error.linkSpent.title': 'Tautan ini sudah tidak berlaku',
  'error.linkSpent.detail':
    'Tautan kata sandi hanya bisa dipakai sekali. Minta yang baru dan kami segera mengirimkannya lewat email.',
  'error.linkExpired.title': 'Tautan ini sudah kedaluwarsa',
  'error.linkExpired.detail':
    'Minta yang baru dan kami segera mengirimkannya lewat email.',
  'error.linkIncomplete.title': 'Tautan ini tidak lengkap',
  'error.linkIncomplete.detail':
    'Tautan pengaturan ulang kata sandi membawa token sekali pakai. Buka email yang paling baru, atau minta tautan baru.',
  'error.sessionExpired.title': 'Sesi Anda sudah berakhir',
  'error.sessionExpired.detail':
    'Masuk lagi untuk melanjutkan dari tempat Anda berhenti.',
  'error.alreadyVerified.title': 'Sudah dikonfirmasi',
  'error.alreadyVerified.detail':
    'Alamat email ini sudah terverifikasi. Anda bisa masuk seperti biasa.',
  'error.badCode.title': 'Kode itu tidak berhasil',
  'error.badCode.detail':
    'Kode autentikator berlaku 30 detik. Tunggu kode berikutnya lalu masukkan keenam angkanya.',
  'error.badBackupCode.title': 'Kode cadangan itu tidak berhasil',
  'error.badBackupCode.detail':
    'Tiap kode cadangan berlaku sekali. Coba kode berikutnya yang belum terpakai dari daftar Anda.',
  'error.locked.title': 'Akun terkunci sementara',
  'error.locked.detail':
    'Terlalu banyak percobaan verifikasi yang gagal. Demi keamanan, akun ini terkunci beberapa menit.',
  'error.twoFactorOn.title': 'Autentikasi dua faktor sudah aktif',
  'error.twoFactorOn.detail':
    'Menyiapkannya kembali akan membuat autentikator saat ini berhenti berfungsi, jadi tidak ada yang diubah. Kamu dapat mengelolanya di sini.',
  'error.noTwoFactor.title': 'Verifikasi dua langkah belum disiapkan',
  'error.noTwoFactor.detail':
    'Masuk dengan email dan kata sandi Anda untuk melanjutkan.',
  'error.twoFactorExpired.title': 'Ulangi dari halaman masuk',
  'error.twoFactorExpired.detail':
    'Langkah verifikasi ini sudah kedaluwarsa. Masukkan email dan kata sandi Anda sekali lagi.',
  'error.invitationGone.title': 'Undangan ini sudah tidak berlaku',
  'error.invitationGone.detail':
    'Mungkin sudah kedaluwarsa, ditarik, atau sudah terpakai. Mintalah undangan baru.',
  'error.invitationOther.title': 'Undangan ini untuk orang lain',
  'error.invitationOther.detail':
    'Undangan itu dikirim ke alamat email lain. Masuk dengan alamat tersebut untuk menerimanya.',
  'error.alreadyMember.title': 'Anda sudah ada di ruang kerja ini',
  'error.alreadyMember.detail':
    'Tidak ada yang perlu diterima — buka saja lewat pengalih ruang kerja.',
  'error.workspaceFull.title': 'Ruang kerja ini penuh',
  'error.workspaceFull.detail':
    'Jumlah anggotanya sudah mentok. Minta pemiliknya mengosongkan satu kursi atau menaikkan paket.',
  'error.verifyBeforeJoin.title': 'Konfirmasi email Anda dulu',
  'error.verifyBeforeJoin.detail':
    'Buka tautan konfirmasi yang kami kirim, lalu kembali ke undangan ini.',

  'passkeyNotice.added': 'Kunci sandi ditambahkan ke akun Anda',
  'passkeyNotice.removed': 'Kunci sandi dihapus dari akun Anda',
  'passkeyNotice.security': 'Keamanan',
  'passkeyNotice.action': 'Kelola kunci sandi',
  'passkeyNotice.recovery':
    'Jika Anda tidak mengenali perubahan ini, ubah kata sandi dan akhiri sesi yang tidak dikenal. Pengaturan ulang kata sandi tidak menghapus kunci sandi. Tinjau kunci sandi Anda dan hapus yang tidak dikenali.',
  'error.passwordAttemptsLocked.title': 'Konfirmasi kata sandi dikunci',
  'error.passwordAttemptsLocked.detail':
    'Sesi ini tidak dapat lagi mengonfirmasi kata sandi Anda. Keluar lalu masuk kembali.',
  'error.passwordResultUnknown.title': 'Periksa pengaturan keamanan Anda',
  'error.passwordResultUnknown.detail':
    'Perubahan mungkin telah tersimpan. Biarkan sesi ini tetap terbuka sampai Anda dapat masuk kembali. Jika Anda mengubah kata sandi, coba yang baru. Jika Anda mengganti kode cadangan, kode lama mungkin tidak lagi berfungsi; gunakan aplikasi autentikator atau sesi lain yang sudah masuk untuk membuat kode baru.',
} satisfies TranslationOf<typeof En>

export default messages
