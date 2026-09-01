/**
 * The travel journal's copy, in uk.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Множина.** `one` · `few` · `many` · `other`.
 * **Типографіка.** Українська набирає лапки «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Не задано',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Не вдалося завантажити цю подорож',
  'story.back': 'Усі подорожі',
  'story.loading': 'Завантаження',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Записи',
  'figure.photos': 'Фотографії',
  'figure.dates': 'Дати',
  'figure.visibility': 'Видимість',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'У цій подорожі ще немає записів',
  'entries.empty.body':
    'Кожен запис — це одна мить: дата, кілька рядків, місце і зроблені там фотографії. Напишіть перший, поки ще пам’ятаєте запах того дня.',
  'entry.photos.count': {
    one: '{photos} фотографія',
    few: '{photos} фотографії',
    many: '{photos} фотографій',
    other: '{photos} фотографії',
  },
  'photo.untitled': 'Фотографія без підпису',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Ця подорож',
  'side.status': 'Статус',
  'side.started': 'Початок',
  'side.ended': 'Завершення',
  'side.loosePhotos': 'Окремі фотографії',
  'moods.label': 'Настрої',
  'authors.label': 'Автори',
  'authors.count': {
    one: '{authors} автор',
    few: '{authors} автори',
    many: '{authors} авторів',
    other: '{authors} автора',
  },
} satisfies TranslationOf<typeof En>

export default messages
