/**
 * The design system's own copy — every word `src/components/ui` says on its own
 * behalf, in Indonesian.
 *
 * Authored from `../en/ui`, which is our own English copy — never another
 * product's catalogue (`docs/SPEC.md` §1, §8.9).
 *
 * Indonesian marks number on the noun only when it matters, and never by
 * inflecting it, so `Intl.PluralRules` reports the single category `other` and
 * every `one`/`other` pair English writes collapses to one branch. The figure
 * still arrives already grouped by the formatter; the branch only picks the
 * wording, and here there is one wording.
 *
 * Two conventions worth naming, because both look like laziness and are not:
 *
 * - **`{month} {year}` carries a non-breaking space.** Indonesian writes a
 *   calendar heading exactly as English does — `September 2026` — so the only
 *   honest difference is typographic, and it is one the layout wants: the month
 *   name and its year must not break across two lines in a 280px popover.
 * - **The overflow markers swap sides.** `+3` and `99+` are read the same way
 *   in both languages, so the plus moves rather than the word: `3+` on a
 *   crowded avatar stack reads "three or more faces we did not draw", `+99` on
 *   a badge reads "more than the cap". Same glyph budget, different sentence.
 */

import type En from '../en/ui'
import type { TranslationOf } from '../../types'

const messages = {
  'action.clear': 'Kosongkan',
  'action.close': 'Tutup',
  'action.dismiss': 'Sembunyikan',
  'action.remove': 'Hapus',
  'action.undo': 'Urungkan',
  'status.loading': 'Memuat',
  'status.working': 'Memproses',
  'status.searching': 'Mencari',
  'avatar.status.online': '{name} sedang aktif',
  'avatar.status.away': '{name} sedang tidak di tempat',
  'avatar.status.busy': '{name} sedang sibuk',
  'avatar.status.offline': '{name} sedang tidak aktif',
  'avatar.overflow': { other: '{others} orang lainnya' },
  'avatar.more': '{hidden}+',
  'badge.overflow': '+{max}',
  'calendar.label.date': 'Pilih satu tanggal',
  'calendar.label.range': 'Pilih rentang tanggal',
  'calendar.previousMonth': 'Bulan sebelumnya',
  'calendar.nextMonth': 'Bulan berikutnya',
  'calendar.monthYear': '{month}\u00a0{year}',
  'calendar.grid': '{month}: {label}',
  'calendar.showing': 'Menampilkan {months}',
  /** Indonesian leads with the weekday, then the day, month and year. */
  'calendar.day': '{weekday}, {day} {month} {year}',
  'select.placeholder': 'Pilih…',
  'select.unavailable': 'Tidak tersedia: {value}',
  'select.unavailableHint':
    'Pilihan tersimpan {value} sudah tidak tersedia. Silakan pilih yang lain.',
  'combobox.search': 'Cari',
  'combobox.empty': 'Tidak ada yang cocok',
  'combobox.clear': 'Hapus pilihan',
  'datePicker.placeholder': 'Pilih tanggal',
  'datePicker.clear': 'Hapus tanggal',
  'dateRange.placeholder': 'Pilih rentang',
  'dateRange.clear': 'Hapus rentang',
  'dateRange.presets': 'Rentang cepat',
  'dateRange.preset.week': '7 hari ke depan',
  'dateRange.preset.fortnight': '2 minggu ke depan',
  'dateRange.preset.month': '30 hari ke depan',
  'dateRange.value': '{start}–{end}',
  'dateRange.valuePending': 'dari {start} – …',
  'dateRange.nights': { other: '{nights} malam' },
  'dateRange.nightsSelected': { other: '{nights} malam dipilih' },
  'pagination.label': 'Navigasi halaman',
  'pagination.first': 'Halaman pertama',
  'pagination.previous': 'Halaman sebelumnya',
  'pagination.next': 'Halaman berikutnya',
  'pagination.last': 'Halaman terakhir',
  'pagination.page': 'Halaman {page}',
  'pagination.current': 'Halaman {page} dari {pageCount}',
  'pagination.summary': 'Menampilkan {from}–{to} dari {total}',
} satisfies TranslationOf<typeof En>

export default messages
