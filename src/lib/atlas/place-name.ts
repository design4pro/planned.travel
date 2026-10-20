import { z } from 'zod'

/** Reject hidden characters before normalization can trim them away. Joiners are meaningful in Persian and Indic names. */
export function hasHiddenPlaceCharacters(value: string): boolean {
  return /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u.test(
    value.replace(/[\t\n\r\f\v\u200c\u200d]/gu, ''),
  )
}

function foldedName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
}

/** The display name and its bound use the same normalized bytes in every runtime. */
export function placeNameSchema(maximum: number) {
  return z
    .string()
    .refine((value) => !hasHiddenPlaceCharacters(value), {
      message: 'Hidden characters are not allowed.',
    })
    .transform((value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' '))
    .pipe(z.string().min(1).max(maximum))
    .refine((value) => foldedName(value).length > 0, {
      message: 'A place name must have a non-empty identity.',
    })
}

/** Locale-independent identity; strip Latin combining accents, never Indic vowel signs. */
export function foldPlaceName(value: string): string {
  return foldedName(placeNameSchema(200).parse(value))
}
