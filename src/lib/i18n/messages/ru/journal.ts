/**
 * The travel journal's copy, in ru.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Множественное число.** `one` · `few` · `many` · `other`.
 * **Типографика.** Русский набирает кавычки «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Не задано',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Не удалось загрузить это путешествие',
  'story.back': 'Все путешествия',
  'story.loading': 'Загрузка',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Записи',
  'figure.photos': 'Фотографии',
  'figure.dates': 'Даты',
  'figure.visibility': 'Видимость',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'В этом путешествии пока нет записей',
  'entries.empty.body':
    'Каждая запись — это один момент: дата, несколько строк, место и снятые там фотографии. Напишите первую, пока ещё помните запах того дня.',
  'entry.photos.count': {
    one: '{photos} фотография',
    few: '{photos} фотографии',
    many: '{photos} фотографий',
    other: '{photos} фотографии',
  },
  'photo.untitled': 'Фотография без подписи',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Это путешествие',
  'side.status': 'Статус',
  'side.started': 'Начало',
  'side.ended': 'Окончание',
  'side.loosePhotos': 'Отдельные фотографии',
  'moods.label': 'Настроения',
  'authors.label': 'Авторы',
  'authors.count': {
    one: '{authors} автор',
    few: '{authors} автора',
    many: '{authors} авторов',
    other: '{authors} автора',
  },
} satisfies TranslationOf<typeof En>

export default messages
