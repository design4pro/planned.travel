/**
 * The travel journal's copy, in id.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Jamak.** Bahasa Indonesia hanya punya cabang `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Belum diatur',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Perjalanan ini tidak dapat dimuat',
  'story.back': 'Semua perjalanan',
  'story.loading': 'Memuat',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Catatan',
  'figure.photos': 'Foto',
  'figure.dates': 'Tanggal',
  'figure.visibility': 'Visibilitas',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Perjalanan ini belum punya catatan',
  'entries.empty.body':
    'Setiap catatan adalah satu momen: sebuah tanggal, beberapa baris, sebuah tempat, dan foto yang kamu ambil di sana. Tulis yang pertama selagi kamu masih ingat aromanya.',
  'entry.photos.count': {
    other: '{photos} foto',
  },
  'photo.untitled': 'Foto tanpa keterangan',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Perjalanan ini',
  'side.status': 'Keadaan',
  'side.started': 'Mulai',
  'side.ended': 'Selesai',
  'side.loosePhotos': 'Foto lepas',
  'moods.label': 'Suasana hati',
  'authors.label': 'Ditulis oleh',
  'authors.count': {
    other: '{authors} penulis',
  },
} satisfies TranslationOf<typeof En>

export default messages
