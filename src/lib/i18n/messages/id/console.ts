/**
 * Segala yang diucapkan konsol platform, dalam bahasa Indonesia.
 *
 * Ditulis dari `../en/console.ts` (`docs/SPEC.md` §9). Berkas Inggris adalah skemanya:
 * `TranslationOf<typeof En>` mengubah kunci yang hilang maupun yang dikarang menjadi galat
 * kompilasi, dan `__tests__/parity.test.ts` memeriksa penampung, cabang jamak, serta memastikan
 * tak ada bahasa Inggris yang tertinggal di sini.
 *
 * **Jamak.** `Intl.PluralRules('id')` hanya memberi satu cabang, `other`: bentuk kata benda tidak
 * berubah karena jumlah, jadi angkanya sendiri yang bicara.
 *
 * **Dua tangga peran yang tak pernah bercampur** (§5). Di platform: administrator, kurator,
 * pengguna. Di ruang kerja: pemilik, administrator, anggota. Kata «administrator» ada di keduanya,
 * dan hanya kalimat di sekitarnya yang membedakannya.
 *
 * `Suspend` di sini «menangguhkan», bukan «menghapus»: akses kembali begitu penangguhan dicabut,
 * dan kalimatnya mengatakan itu apa adanya. `Status` diterjemahkan «keadaan» agar tidak menyamai
 * kata Inggrisnya huruf demi huruf.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ---------------------------------------------------------------- bagian -- */

  'nav.label': 'Bagian konsol',
  'nav.overview': 'Ikhtisar',
  'nav.overview.description': 'Platform dalam sekilas pandang',
  'nav.accounts': 'Akun',
  'nav.accounts.description': 'Peran, penangguhan, dan sesi',
  'nav.runs': 'Jalannya agen',
  'nav.runs.description': 'Apa yang sedang dibangun armada Sandcastle',

  /* --------------------------------------------------------------- cangkang -- */

  'shell.eyebrow': 'Platform itu sendiri',
  'shell.title': 'Konsol',
  'shell.description':
    'Produknya sendiri — akun, kewenangan, dan katalog bersama',
  'shell.signedInAs': 'Masuk sebagai',
  'shell.error.title': 'Konsol gagal dimuat',
  'shell.notFound.title': 'Akun itu tidak ada',
  'shell.notFound.body':
    'Tidak ada apa pun di platform yang membawa pengenal ini. Akunnya mungkin dihapus setelah tautan dibuat, atau alamatnya salah ketik.',
  'shell.allAccounts': 'Semua akun',
  'shell.overview': 'Ikhtisar konsol',

  'failure.fallback': 'Tindakan itu tidak lolos. Coba lagi sebentar lagi.',

  /* --------------------------------------------------------------- ikhtisar -- */

  'overview.error.title': 'Ikhtisar gagal dimuat',
  'overview.standing.title': 'Kewenanganmu di platform',
  'overview.standing.body':
    'Akun, sesi, dan bertindak atas nama orang lain adalah milik administrator platform, jadi konsol hanya menunjukkan katalog kepadamu, tidak lebih.',
  'overview.stat.accounts': 'Akun',
  'overview.stat.accounts.caption': {
    other: '{staff} di antaranya memegang peran platform',
  },
  'overview.stat.admins': 'Administrator',
  'overview.stat.admins.caption': 'Kuasa penuh atas akun dan sesi',
  'overview.stat.curators': 'Kurator',
  'overview.stat.curators.caption': 'Hanya katalog — tidak pernah akun',
  'overview.stat.suspended': 'Ditangguhkan',
  'overview.stat.suspended.none': 'Tak seorang pun tertinggal di luar',
  'overview.stat.suspended.some':
    'Dikeluarkan dari mana saja sampai penangguhannya dicabut',
  'overview.stat.suspended.review': 'Tinjau mereka',
  'overview.newest.label': 'Akun terbaru',
  'overview.newest.empty.title': 'Belum ada akun',
  'overview.newest.empty.body':
    'Orang pertama yang mendaftar akan muncul di sini.',
  'overview.catalogue.label': 'Katalog menurut keadaan',
  'overview.catalogue.empty.title': 'Katalog bersama belum dibuka',
  'overview.catalogue.empty.body':
    'Begitu jalur pemasukan data siap, panel ini akan menghitung setiap tempat di katalog bersama sebagai draf, sedang ditinjau, atau sudah terbit — dan membuka daftar di balik tiap angka.',
  'overview.scraping.label': 'Jalannya pengumpulan',
  'overview.scraping.empty.title': 'Belum ada sumber yang dijalankan',
  'overview.scraping.empty.body':
    'Sumber dikumpulkan sekali seminggu. Setelah jalan pertama, lima yang terakhir akan berdiri di sini, lengkap dengan apa yang diambil, diubah, dan dibuang masing-masing.',

  /* ----------------------------------------------------------- tangga peran -- */

  'role.admin': 'Administrator',
  'role.admin.summary':
    'Kuasa penuh di platform: akun, peran, penangguhan, sesi, dan bertindak atas nama orang lain.',
  'role.admin.holds.accounts': 'Membuat akun dan memberi peran platform',
  'role.admin.holds.bans': 'Menangguhkan akun dan mencabut penangguhan',
  'role.admin.holds.sessions': 'Mengakhiri sesi dan menetapkan kata sandi',
  'role.admin.holds.impersonate':
    'Bertindak atas nama sebuah akun selama lima belas menit',
  'role.admin.holds.curation': 'Segala yang bisa dilakukan kurator',
  'role.admin.withheld.admins':
    'Bertindak atas nama administrator platform lain',
  'role.curator': 'Kurator',
  'role.curator.summary':
    'Merawat katalog, koleksi, sumber, dan tautan berbagi. Tidak satu pun yang menyentuh akun.',
  'role.curator.holds.places':
    'Membaca, menulis, dan menerbitkan tempat katalog',
  'role.curator.holds.packs':
    'Membaca, menulis, dan menerbitkan koleksi tempat',
  'role.curator.holds.sources': 'Membaca dan menjalankan sumber katalog',
  'role.curator.holds.shares': 'Meninjau dan mencabut tautan berbagi',
  'role.curator.withheld.accounts': 'Segala hal yang menyentuh akun atau sesi',
  'role.curator.withheld.tokens': 'Menerbitkan atau mencabut kredensial mesin',
  'role.user': 'Pengguna',
  'role.user.summary':
    'Tanpa kewenangan apa pun di platform. Ini berarti hampir semua orang.',
  'role.user.withheld.everything': 'Setiap kewenangan platform, tanpa kecuali',

  /* --------------------------------------------------------------- satu akun -- */

  'identity.you': 'Ini kamu',
  'status.active': 'Aktif',
  'status.suspended': 'Ditangguhkan',
  'status.permanent': 'Permanen',
  'status.until': 'Sampai {date}',
  'status.unverified': 'Belum diverifikasi',
  'device.on': '{browser} di {platform}',
  'device.unrecognised': 'Perangkat tak dikenali',

  /* ------------------------------------------------------------ daftar akun -- */

  'users.error.title': 'Daftar akun gagal dimuat',
  'users.total': 'dari {total}',
  'users.loading': 'Memuat akun',
  'users.table.label': 'Akun platform',
  'users.search.label': 'Cari di antara akun',
  'users.search.email': 'Cari di alamat email',
  'users.search.name': 'Cari di nama',
  'users.search.column': 'Kolom mana yang dicari',
  'users.search.submit': 'Cari',
  'users.field.email': 'Alamat email',
  'users.field.name': 'Nama',
  'users.filter.role.label': 'Saring menurut peran platform',
  'users.filter.role.any': 'Peran apa pun',
  'users.filter.role.admin': 'Administrator',
  'users.filter.role.curator': 'Kurator',
  'users.filter.status.label': 'Saring menurut keadaan akun',
  'users.filter.status.any': 'Keadaan apa pun',
  'users.filter.hint':
    'Persempit menurut peran atau keadaan — satu saja setiap kali.',
  'users.column.account': 'Akun',
  'users.column.role': 'Peran platform',
  'users.column.status': 'Keadaan',
  'users.column.joined': 'Bergabung',
  'users.column.actions': 'Tindakan',
  'users.joined': 'Bergabung {date}',
  'users.pastEnd.title': 'Halaman ini melewati ujung daftar',
  'users.pastEnd.body': {
    other:
      'Ada {total} akun dalam tampilan ini, yaitu {pages}. Halaman {page} berada di luarnya.',
  },
  'users.pastEnd.pages': {
    other: '{pages} halaman',
  },
  'users.pastEnd.back': 'Kembali ke halaman pertama',
  'users.empty.filtered.title': 'Tak ada yang cocok dengan saringan ini',
  'users.empty.filtered.body':
    'Tak satu pun akun di platform menjawab pencarian ini. Perluas pencarian, atau bersihkan saringan untuk melihat semua orang.',
  'users.empty.title': 'Tak ada akun untuk ditampilkan',
  'users.empty.body':
    'Tampilan ini kosong. Tak ada yang disaring, jadi tak ada pula yang bisa diperluas.',

  /* ------------------------------------------------------------ halaman akun -- */

  'account.error.title': 'Akun ini gagal dimuat',
  'account.loading': 'Memuat akun',
  'account.meta.lastChange': 'Perubahan terakhir',
  'account.meta.id': 'Pengenal akun',
  'account.banned.title': 'Akun ini ditangguhkan',
  'account.banned.noReason':
    'Tidak ada alasan yang ditulis bersama penangguhan itu.',
  'account.banned.permanent':
    ' Berlaku sampai seorang administrator mencabutnya.',
  'account.banned.until': ' Tercabut dengan sendirinya pada {date}.',
  'account.banned.untilUnknown': 'saat masanya habis',
  'account.authority.label': 'Kewenangan di platform',
  'account.authority.may': 'Boleh',
  'account.authority.mayNot': 'Tidak boleh',
  'account.authority.none': 'Tidak ada apa pun di platform.',
  'account.workspaces.label': 'Ruang kerja',
  'account.workspaces.truncated':
    'Akun ini termasuk dalam lebih banyak ruang kerja daripada {listed} yang terdaftar di sini.',
  'account.workspaces.empty.title': 'Tidak berada di ruang kerja mana pun',
  'account.workspaces.empty.body':
    'Akun ini belum termasuk dalam ruang kerja mana pun. Satu ruang dibuat pada masuk pertama, dan setiap ruang yang mengundangnya akan muncul di sini.',
  'account.workspaces.column.workspace': 'Ruang kerja',
  'account.workspaces.column.role': 'Peran',
  'account.workspaces.column.plan': 'Paket',
  'account.subscription.label': 'Langganan',
  'account.subscription.free.title': 'Pada paket gratis',
  'account.subscription.free.body':
    'Ruang kerja yang dimiliki akun ini belum pernah melewati kasir, jadi ia tidak punya catatan langganan dan berjalan dalam batas paket gratis.',
  'account.subscription.none.title': 'Tak ada yang ditagihkan ke akun ini',
  'account.subscription.none.body':
    'Akun ini tidak memiliki ruang kerja mana pun. Menjadi anggota di ruang milik orang lain bukan berarti menjadi pihak yang ditagih, jadi tak ada yang bisa dikumpulkan di sini.',
  'account.subscription.endsAtClose': 'Berakhir pada tutup periode',
  'account.subscription.seats': 'Kursi',
  'account.subscription.seatsValue': '{used} dari {limit}',
  'account.subscription.ends': 'Berakhir',
  'account.subscription.renews': 'Diperbarui',
  'account.sessions.label': 'Sesi yang hidup',
  'account.sessions.truncated':
    'Akun ini memegang lebih banyak sesi daripada yang bisa didaftar satu panggilan. Untuk memastikan tak ada yang tersisa, akhiri semua sesi dari menu tindakan.',
  'account.sessions.empty.title': 'Sudah keluar dari mana saja',
  'account.sessions.empty.body':
    'Akun ini tidak punya satu pun sesi yang belum kedaluwarsa. Ia akan muncul di sini begitu masuk kembali.',
  'account.sessions.column.device': 'Perangkat',
  'account.sessions.column.address': 'Alamat',
  'account.sessions.column.started': 'Dimulai',
  'account.sessions.column.expires': 'Kedaluwarsa',
  'account.sessions.impersonated': 'Lahir dari tindakan atas nama akun ini',
  'account.sessions.noAddress': 'Tidak tercatat',
  'account.sessions.noAddressLong': 'Alamat tidak tercatat',
  'account.sessions.when': 'Dimulai {started} · kedaluwarsa {expires}',
  'account.audit.label': 'Riwayat audit',
  'account.audit.truncated':
    'Buku besar memuat lebih banyak entri. Jejak audit platform hanya bisa ditambah dan disimpan empat ratus hari.',
  'account.audit.empty.title': 'Tak ada yang pernah dilakukan pada akun ini',
  'account.audit.empty.body':
    'Setiap pergantian peran, penangguhan, kata sandi yang ditetapkan, sesi yang diakhiri, dan tindakan atas nama akun ditulis ke sini bersama pelakunya. Tak seorang pun menyentuhnya.',

  /* ------------------------------------------- tangga ruang kerja -- */

  'workspace.role.owner': 'Pemilik',
  'workspace.role.admin': 'Administrator',
  'workspace.role.member': 'Anggota',
  'plan.free': 'Gratis',
  'plan.starter': 'Pemula',
  'plan.pro': 'Profesional',
  'plan.business': 'Bisnis',
  'subscription.trialing': 'Masa coba',
  'subscription.active': 'Aktif',
  'subscription.pastDue': 'Lewat tempo',
  'subscription.canceled': 'Dibatalkan',
  'subscription.incomplete': 'Belum lengkap',
  'subscription.expired': 'Kedaluwarsa',
  'subscription.unpaid': 'Belum dibayar',
  'subscription.paused': 'Dijeda',

  /* --------------------------------------------------------- buku besar audit -- */

  'audit.action.created': 'Akun dibuat',
  'audit.action.updated': 'Data akun berubah',
  'audit.action.roleChanged': 'Peran platform berubah',
  'audit.action.banned': 'Akun ditangguhkan',
  'audit.action.unbanned': 'Penangguhan dicabut',
  'audit.action.deleted': 'Akun dihapus',
  'audit.action.passwordSet':
    'Kata sandi ditetapkan oleh seorang administrator',
  'audit.action.emailSet': 'Alamat email berubah',
  'audit.action.impersonationStarted': 'Tindakan atas nama akun dimulai',
  'audit.action.impersonationEnded': 'Tindakan atas nama akun berakhir',
  'audit.action.impersonationWorkspaceChanged':
    'Ruang kerja berganti saat bertindak atas nama akun',
  'audit.action.sessionRevoked': 'Sebuah sesi diakhiri',
  'audit.action.sessionRevokedAll': 'Semua sesi diakhiri',
  'audit.actor.system': 'Platform itu sendiri',
  'audit.actor.system.detail': 'otomatis',
  'audit.actor.agent': 'Sebuah kredensial mesin',
  'audit.actor.agent.detail': 'token MCP',
  'audit.actor.deleted': 'Sebuah akun yang sudah dihapus',
  'audit.actorBadge': 'Waktu itu: {role}',
  'audit.field.name': 'Nama',
  'audit.field.email': 'Alamat email',
  'audit.field.emailVerified': 'Email terverifikasi',
  'audit.field.role': 'Peran platform',
  'audit.field.banned': 'Ditangguhkan',
  'audit.field.banReason': 'Alasan',
  'audit.field.banExpiresAt': 'Penangguhan berakhir',
  'audit.field.revoked': 'Sesi yang diakhiri',
  'audit.field.impersonating': 'Bertindak atas nama',
  'audit.field.impersonatedBy': 'Diwakili oleh',
  'audit.field.expiresAt': 'Sesi kedaluwarsa',
  'audit.field.targetRole': 'Peran platform mereka',
  'audit.field.sessionId': 'Sesi yang bersangkutan',
  'audit.field.organizationId': 'Ruang kerja',
  'audit.value.yes': 'ya',
  'audit.value.no': 'tidak',
  'audit.value.cleared': 'dikosongkan',
  'audit.became': 'menjadi',

  /* ------------------------------------------------------------------ dialog -- */

  'dialog.cancel': 'Batal',

  'create.button': 'Akun baru',
  'create.title': 'Buat akun',
  'create.body':
    'Alamatnya tidak diverifikasi dan tak ada surel yang keluar — serahkan kata sandinya sendiri.',
  'create.confirm': 'Buat akun',
  'create.name.placeholder': 'Dewi Anggraini',
  'create.email': 'Alamat email',
  'create.email.placeholder': 'dewi@planned.travel',
  'create.password': 'Kata sandi',
  'create.password.hint':
    'Cukup panjang untuk menjadi sebuah kalimat. Pemiliknya bisa menggantinya nanti.',
  'create.done': 'Akun dibuat',
  'create.done.body':
    '{email} bisa masuk dengan kata sandi yang kamu tetapkan.',

  'action.menu.label': 'Tindakan untuk {name}',
  'action.group.account': 'Akun',
  'action.group.credentials': 'Kredensial',

  'action.role.item': 'Ganti peran platform',
  'action.role.self':
    'Tidak pada akunmu sendiri — menurunkan dirimu bisa meninggalkan platform tanpa administrator.',
  'action.role.body':
    'Apa yang boleh dilakukan {name} di platform itu sendiri. Keanggotaan ruang kerja adalah kosakata lain dan tidak bergeser karena ini.',
  'action.role.confirm': 'Simpan peran',
  'action.role.current': 'Saat ini',
  'action.role.done': 'Peran platform diperbarui',
  'action.role.done.body': '{name} kini memegang peran {role} di platform.',

  'action.impersonate.item': 'Bertindak atas nama akun',
  'action.impersonate.self':
    'Tak ada yang bisa dijadikan diri — ini akunmu sendiri.',
  'action.impersonate.banned':
    'Akunnya ditangguhkan, jadi tak ada sesi yang bisa kamu kenakan.',
  'action.impersonate.admin':
    'Tak satu pun peran platform boleh bertindak atas nama administrator, termasuk peranmu.',
  'action.impersonate.title': 'Bertindak atas nama {name}',
  'action.impersonate.body':
    'Selama lima belas menit kamu akan melihat produk persis seperti yang dilihat akun ini.',
  'action.impersonate.confirm': 'Mulai',
  'action.impersonate.note.bar':
    'Sebuah bilah peringatan tetap ada di setiap layar sampai kamu selesai, dan tidak bisa ditutup.',
  'action.impersonate.note.platform':
    'Selama bertindak atas nama orang lain, tindakan platform tidak tersedia — konsol juga tidak.',
  'action.impersonate.note.audit':
    'Awal dan akhirnya ditulis ke jejak audit platform, lengkap dengan namamu.',

  'action.password.item': 'Tetapkan kata sandi',
  'action.password.title': 'Tetapkan kata sandi untuk {name}',
  'action.password.body':
    'Pakai ini untuk mengembalikan seseorang ke akun yang mengunci dirinya, atau memutus penyerang dari akun yang diambil alih.',
  'action.password.confirm': 'Tetapkan kata sandi',
  'action.password.field': 'Kata sandi baru',
  'action.password.hint.self':
    'Begitu ditetapkan, semua sesi berakhir — termasuk sesimu.',
  'action.password.hint':
    'Begitu ditetapkan, setiap sesi yang dipegang akun ini berakhir.',
  'action.password.done': 'Kata sandi ditetapkan',
  'action.password.done.body': '{name} dikeluarkan dari setiap perangkat.',

  'action.sessions.item': 'Akhiri semua sesi',
  'action.sessions.body.self':
    'Ini mengeluarkanmu dari setiap perangkatmu, termasuk perangkat tempat kamu membaca ini.',
  'action.sessions.body':
    '{name} akan dikeluarkan dari setiap perangkat dan harus masuk lagi.',
  'action.sessions.confirm': 'Akhiri sesi',
  'action.sessions.done': 'Sesi diakhiri',
  'action.sessions.done.body': {
    other: '{revoked} sesi diakhiri.',
  },

  'action.ban.item': 'Tangguhkan akun',
  'action.ban.self':
    'Tidak pada akunmu sendiri — menangguhkan dirimu memutus jalan pulangmu.',
  'action.ban.title': 'Tangguhkan {name}',
  'action.ban.body':
    'Semua sesi berakhir seketika, dan akunnya tak bisa masuk sampai penangguhan dicabut atau habis masanya.',
  'action.ban.confirm': 'Tangguhkan akun',
  'action.ban.reason': 'Alasan',
  'action.ban.reason.hint':
    'Disimpan di jejak audit platform selama tiga belas bulan dan tidak ditunjukkan kepada siapa pun selain administrator.',
  'action.ban.reason.placeholder':
    'Laporan penyalahgunaan berulang dari tiga ruang kerja',
  'action.ban.duration': 'Lama',
  'action.ban.duration.label': 'Lama penangguhan',
  'action.ban.duration.permanent.body':
    'Berlaku sampai seorang administrator sengaja mencabutnya.',
  'action.ban.duration.day': '24 jam',
  'action.ban.duration.day.body':
    'Cukup lama untuk memutus, cukup singkat untuk tetap berupa campur tangan.',
  'action.ban.duration.week': '7 hari',
  'action.ban.duration.week.body': 'Sepekan untuk menjawab satu keluhan.',
  'action.ban.duration.month': '30 hari',
  'action.ban.duration.month.body': 'Sebulan kesunyian yang dipaksakan.',
  'action.ban.duration.quarter': '90 hari',
  'action.ban.duration.quarter.body':
    'Lama terpanjang yang ditawarkan konsol. Lebih dari itu, tangguhkan secara permanen.',
  'action.ban.done': 'Akun ditangguhkan',
  'action.ban.done.body':
    '{name} dikeluarkan dari mana saja dan tak bisa masuk.',

  'action.unban.item': 'Cabut penangguhan',
  'action.unban.title': 'Cabut penangguhan {name}',
  'action.unban.body':
    'Akunnya bisa masuk lagi pada percobaan berikutnya. Tak satu pun sesi lama kembali.',
  'action.unban.confirm': 'Cabut penangguhan',
  'action.unban.done': 'Penangguhan dicabut',
  'action.unban.done.body':
    '{name} bisa masuk lagi. Tak ada sesi yang dipulihkan.',

  'action.delete.item': 'Hapus akun',
  'action.delete.self':
    'Tidak pada akunmu sendiri — dari sana tak ada jalan kembali.',
  'action.delete.title': 'Hapus {name}',
  'action.delete.body':
    'Akunnya, sesinya, dan setiap kredensial yang terikat padanya akan lenyap. Ini tak bisa dibatalkan.',
  'action.delete.confirm': 'Hapus akun',
  'action.delete.note':
    'Isi yang dibuat orang ini di dalam sebuah ruang kerja tetap menjadi milik ruang kerja itu. Menangguhkan alih-alih menghapus menjaga catatannya dan hanya mencabut aksesnya.',
  'action.delete.owners':
    'Akun yang menjadi satu-satunya pemilik sebuah ruang kerja yang juga dimasuki orang lain tidak bisa dihapus. Jadikan orang lain pemilik di sana lebih dulu, atau tangguhkan akunnya sebagai gantinya.',
  'action.delete.done': 'Akun dihapus',
  'action.delete.done.body':
    '{name} dan segala yang terikat pada akun itu sudah lenyap.',

  'session.revoke.label': 'Akhiri sesi di {device}',
  'session.revoke.title': 'Akhiri sesi ini',
  'session.revoke.body':
    '{device} harus masuk lagi pada permintaan berikutnya. Kalau ini sesi tempat kamu membacanya, kamu ikut dikeluarkan bersamanya.',
  'session.revoke.confirm': 'Akhiri sesi',
  'session.revoke.done': 'Sesi diakhiri',
  'session.revoke.done.body':
    'Perangkat itu harus masuk lagi pada permintaan berikutnya.',

  /* ------------------------------------------------------------ jalannya agen -- */

  'runs.error.title': 'Daftar jalan tidak menjawab',
  'runs.origin.local': 'Lokal',
  'runs.origin.githubActions': 'Aksi GitHub',
  'runs.stat.live': 'Jalan yang hidup',
  'runs.stat.live.none': 'Tak ada yang sedang dibangun saat ini',
  'runs.stat.live.some': 'Denyut melawan sewa lima menit',
  'runs.stat.issues': 'Isu yang dipegang',
  'runs.stat.issues.caption':
    'Masing-masing disewa satu jalan, beserta leluhur dan keturunannya',
  'runs.stat.orphans': 'Cabang yatim',
  'runs.stat.orphans.none': 'Tak ada kerja tanpa pemilik',
  'runs.stat.orphans.some':
    'Komit dari jalan yang berhenti, menunggu diambil alih',
  'runs.live.empty.title': 'Tak ada jalan yang terdaftar',
  'runs.live.empty.body':
    'Sebuah jalan muncul di sini begitu ia mendaftarkan diri — dari mesin ini, dari mesin lain, atau dari pelari GitHub — lengkap dengan isu yang dipegangnya.',
  'runs.holds.nothing': 'tidak memegang apa pun',
  'runs.holds': 'memegang {issues}',
  'runs.uptime': 'hidup {elapsed} · {lease}',
  'runs.lease.expired': 'sewa habis',
  'runs.lease.left': 'sisa {elapsed}',
  'runs.wip.label': 'Kerja yang sedang berjalan',
  'runs.wip.empty.title': 'Tak ada cabang yang membawa kerja',
  'runs.wip.empty.body':
    'Sebuah jalan menuliskan cabangnya begitu ada komit di sana; jadi kalau jalan itu mati, kerja ini ditawarkan kepada jalan berikutnya yang memegang isunya, alih-alih memulai dari awal.',
  'runs.wip.orphaned': 'Yatim',
  'runs.wip.meta': {
    other: '{commits} komit · {elapsed} lalu',
  },
  'runs.recent.label': 'Baru saja selesai',
  'runs.recent.empty.title': 'Belum ada jalan yang selesai',
  'runs.recent.empty.body':
    'Lima puluh jalan terakhir tinggal di sini, lengkap dengan cara masing-masing berakhir.',
  'runs.ago': '{elapsed} lalu',
  'runs.notCoordinator.title': 'Penyebaran ini tidak mengoordinasi armada',
  'runs.notCoordinator.body':
    'Daftar jalan hanya terikat pada lingkungan pementasan, dan itu disengaja: daftar kedua akan membuat kedua armada percaya bahwa antrean ada di tangannya — persis satu-satunya hal yang keberadaannya dimaksudkan untuk dicegah. Bacalah armada di lingkungan pementasan.',
  'nav.providers': 'Penyedia',
  'nav.providers.description': 'Panggilan keluar dan batas atasnya',
  'providers.error.title': 'Meteran penyedia tidak dapat dibaca',
  'providers.list.label': 'Layanan',
  'providers.status.planned': 'Belum tersambung',
  'providers.status.planned.description':
    'Belum ada yang memanggil layanan ini, jadi tidak ada yang dihitung. Ia dicantumkan agar batas atas disepakati sebelum panggilan pertama, bukan setelah tagihan pertama.',
  'providers.policy.allow': 'Tetap ditagih di atas batas',
  'providers.policy.block': 'Menolak di batas atas',
  'providers.badge.blocked': {
    other: '{calls} panggilan ditolak',
  },
  'providers.limit.none': 'Belum ada batas yang disepakati · {used} bulan ini',
  'providers.limit.value': '{used} dari {limit}',
  'providers.limit.window.day': 'Hari ini',
  'providers.limit.window.month': 'Bulan ini',
  'providers.measuring.none': 'Belum ada yang terukur',
  'providers.measuring.since': 'Diukur sejak {date}',
  'providers.stat.calls': 'Panggilan bulan ini',
  'providers.stat.calls.caption': 'Di seluruh layanan yang tersambung',
  'providers.stat.errors': 'Panggilan gagal',
  'providers.stat.errors.caption':
    'Dihitung sebagai panggilan juga, karena kebanyakan penyedia tetap menagihnya',
  'providers.stat.nearLimit': 'Dekat batas atas',
  'providers.stat.nearLimit.caption': 'Layanan yang melewati ambang peringatan',
  'providers.stat.blocked': 'Panggilan ditolak',
  'providers.stat.blocked.none': 'Tidak ada yang ditolak',
  'providers.stat.blocked.some': 'Permintaan yang ditolak oleh batas atas',
  'providers.forecast.label': 'Perkiraan',
  'providers.forecast.provider': 'Layanan',
  'providers.forecast.monthEnd': 'Sampai akhir bulan',
  'providers.forecast.runRate': 'Per bulan pada laju ini',
  'providers.forecast.perWorkspace': 'Per ruang kerja per bulan',
  'providers.forecast.noWorkspaceTraffic':
    'Tidak ada lalu lintas ruang kerja untuk dirata-rata',
  'providers.forecast.window': {
    other: 'Diproyeksikan dari {hours} jam pengukuran.',
  },
  'providers.forecast.tooEarly': {
    other:
      'Baru {hours} jam yang terukur — belum cukup untuk memproyeksikan. Menarik kurang dari sehari menjadi sebulan itu aritmetika, bukan perkiraan.',
  },
  'providers.forecast.atWorkspaces': 'Pada berapa ruang kerja',
  'providers.forecast.callsEach': 'Panggilan per ruang kerja per bulan',
  'providers.forecast.projected': 'Sekitar {calls} panggilan sebulan.',
  'providers.workspaces.label': 'Ruang kerja tersibuk',
  'providers.workspaces.platform': 'Platform (tanpa ruang kerja)',
  'providers.workspaces.empty.title': 'Belum ada yang diatribusikan',
  'providers.workspaces.empty.description':
    'Panggilan yang dibuat untuk sebuah ruang kerja dicatat atas namanya. Pekerjaan terjadwal dan surat platform bukan milik siapa pun dan dihitung terpisah.',
  'providers.readOnly':
    'Kamu bisa membaca meteran ini tetapi tidak menggeser batas atas. Mengubah limit atau kebijakannya memerlukan izin provider:configure.',
  'providers.status.planned.agreed.month':
    'Batas yang disepakati: {limit} per bulan. Berlaku sejak panggilan pertama, begitu ada klien.',
  'providers.status.planned.agreed.day':
    'Batas yang disepakati: {limit} per hari. Berlaku sejak panggilan pertama, begitu ada klien.',
  'providers.edit.button': 'Ubah',
  'providers.edit.title': 'Batas untuk {provider}',
  'providers.edit.body':
    'Berapa yang disepakati instalasi ini untuk dibelanjakan pada penyedia, dan apa yang terjadi saat habis.',
  'providers.edit.confirm': 'Simpan batas',
  'providers.edit.done': 'Batas untuk {provider} disimpan',
  'providers.edit.label': 'Nama',
  'providers.edit.ceiling': 'Panggilan termasuk',
  'providers.edit.ceiling.hint':
    'Kosongkan bila tidak ada batas yang disepakati. Kosong dan nol berbeda: nol dengan “tolak” menampik setiap panggilan.',
  'providers.edit.ceiling.placeholder': 'Tanpa batas',
  'providers.edit.window': 'Diukur per',
  'providers.edit.window.month': 'Satu bulan kalender',
  'providers.edit.window.month.body': 'Bentuk lazim sebuah kuota bawaan.',
  'providers.edit.window.day': 'Satu hari',
  'providers.edit.window.day.body':
    'Sebagian penyedia mengukur harian — paket gratis Geoapify adalah 3.000 kredit per hari.',
  'providers.edit.policy': 'Saat mencapai batas',
  'providers.edit.policy.allow': 'Terus memanggil dan membayar',
  'providers.edit.policy.allow.body':
    'Panggilan berlanjut melewati batas dan konsol memberi peringatan. Tidak ada yang berhenti.',
  'providers.edit.policy.block': 'Tolak panggilan berikutnya',
  'providers.edit.policy.block.body':
    'Panggilan ditolak sampai jendela diatur ulang. Apa pun yang bergantung pada penyedia ini berhenti bekerja — pilih hanya bila kegagalan itu lebih murah.',
  'providers.edit.policy.block.refused':
    '{provider} tidak bisa ditolak: tidak ada jalan cadangan, jadi menampik panggilannya akan menghentikan fitur, bukan membatasi biayanya. Batas yang hanya memberi peringatan tetap tersedia.',
  'providers.edit.warn': 'Peringatan di (%)',
  'providers.edit.critical': 'Alarm di (%)',
  'providers.edit.thresholds.hint':
    'Tempat meter berubah kuning lalu merah. Peringatan tidak boleh di atas alarm.',
} satisfies TranslationOf<typeof En>

export default messages
