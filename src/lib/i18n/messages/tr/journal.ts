/**
 * The travel journal's copy, in tr.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Çoğul.** `one` · `other`; Türkçede sayıdan sonra ad çoğul eki almaz.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Belirlenmedi',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Bu yolculuk yüklenemedi',
  'story.back': 'Tüm yolculuklar',
  'story.loading': 'Yükleniyor',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Kayıtlar',
  'figure.photos': 'Fotoğraflar',
  'figure.dates': 'Tarihler',
  'figure.visibility': 'Görünürlük',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Bu yolculuğun henüz kaydı yok',
  'entries.empty.body':
    'Her kayıt bir andır: bir tarih, birkaç satır, bir yer ve orada çektiğin fotoğraflar. Kokusunu hâlâ hatırlarken ilkini yaz.',
  'entry.photos.count': {
    one: '{photos} fotoğraf',
    other: '{photos} fotoğraf',
  },
  'photo.untitled': 'Açıklaması olmayan fotoğraf',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Bu yolculuk',
  'side.status': 'Durum',
  'side.started': 'Başlangıç',
  'side.ended': 'Bitiş',
  'side.loosePhotos': 'Bağımsız fotoğraflar',
  'moods.label': 'Ruh hâlleri',
  'authors.label': 'Yazan',
  'authors.count': {
    one: '{authors} yazar',
    other: '{authors} yazar',
  },
} satisfies TranslationOf<typeof En>

export default messages
