/**
 * The travel journal's copy, in es.
 *
 * Authored from `../en/journal.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` solo para números compactos grandes.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/journal'

const messages = {
  /* ----------------------------------------------------- shared values */
  'value.notSet': 'Sin definir',
  /* -------------------------------------------------- the journey page */
  'story.error': 'No se pudo cargar este viaje',
  'story.back': 'Todos los viajes',
  'story.loading': 'Cargando',
  /* ------------------------------------------------- the cover figures */
  'figure.entries': 'Entradas',
  'figure.photos': 'Fotos',
  'figure.dates': 'Fechas',
  'figure.visibility': 'Visibilidad',
  /* ----------------------------------------------------------- entries */
  'entries.empty.title': 'Este viaje aún no tiene entradas',
  'entries.empty.body':
    'Cada entrada es un momento: una fecha, unas líneas, un lugar y las fotos que hiciste allí. Escribe la primera mientras todavía recuerdas su olor.',
  'entry.photos.count': {
    one: '{photos} foto',
    many: '{photos} fotos',
    other: '{photos} fotos',
  },
  'photo.untitled': 'Foto sin pie',
  /* ---------------------------------------------------- the side panel */
  'side.label': 'Este viaje',
  'side.status': 'Estado',
  'side.started': 'Inicio',
  'side.ended': 'Fin',
  'side.loosePhotos': 'Fotos sueltas',
  'moods.label': 'Estados de ánimo',
  'authors.label': 'Escrito por',
  'authors.count': {
    one: '{authors} autor',
    many: '{authors} autores',
    other: '{authors} autores',
  },
} satisfies TranslationOf<typeof En>

export default messages
