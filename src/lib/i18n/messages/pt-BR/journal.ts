/**
 * The travel journal's copy, in pt-BR.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` só para números compactos grandes.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Não definido',
  /* -------------------------------------------------- the journey page */
  'story.error': 'Não foi possível carregar esta jornada',
  'story.back': 'Todas as jornadas',
  'story.loading': 'Carregando',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Entradas',
  'figure.photos': 'Fotos',
  'figure.dates': 'Datas',
  'figure.visibility': 'Visibilidade',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Esta jornada ainda não tem entradas',
  'entries.empty.body':
    'Cada entrada é um momento: uma data, algumas linhas, um lugar e as fotos que você fez lá. Escreva a primeira enquanto ainda lembra o cheiro.',
  'entry.photos.count': {
    one: '{photos} foto',
    many: '{photos} fotos',
    other: '{photos} fotos',
  },
  'photo.untitled': 'Foto sem legenda',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Esta jornada',
  'side.status': 'Situação',
  'side.started': 'Início',
  'side.ended': 'Fim',
  'side.loosePhotos': 'Fotos soltas',
  'moods.label': 'Humores',
  'authors.label': 'Escrito por',
  'authors.count': {
    one: '{authors} autor',
    many: '{authors} autores',
    other: '{authors} autores',
  },
} satisfies TranslationOf<typeof En>

export default messages
