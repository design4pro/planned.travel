/**
 * The colours a traveller can file a list or a shared note under.
 *
 * One owner, because there were three. The picker painted each swatch with a
 * token class, the row stored a hex, and the seed invented a third set that
 * overlapped neither — so a seeded list showed a colour the picker could not
 * select, and the swatch a reader clicked did not match the dot they got.
 *
 * A swatch therefore carries exactly two things and no duplicate of either:
 *
 * - `value` is what the database holds. It has to be a plain colour string, so
 *   it stays a hex and it never changes without a migration.
 * - `token` is what paints it. Painting through the custom property rather than
 *   the stored hex is what lets a chosen colour follow the theme, the same way
 *   every other surface in the product does. The two are not interchangeable:
 *   the hex is the record, the token is the appearance, and `--color-brand` is
 *   a different value in dark than the hex ever was.
 *
 * Anything painting a stored colour goes through `swatchFor`. It falls back to
 * the raw value for a colour saved before this list existed, which is honest —
 * such a row keeps the colour it was given, it simply cannot follow the theme.
 */
import type { MessageKey } from '#/lib/i18n'

export interface Swatch {
  /** Stored on the row. A database column, not an appearance. */
  readonly value: string
  /** Paints it, per theme. Use in `style`, since the choice is data. */
  readonly token: string
  readonly label: MessageKey
}

/**
 * The five hues, in the order every picker offers them.
 *
 * Each one is the semantic token's own colour rather than a decorative shade
 * beside it, so a filed list sits in the same five-note chord as every badge,
 * alert and meter in the product. Measured against `--color-surface`, all five
 * clear 6.3:1 in both themes, which is well past the 3:1 that WCAG 2.2 1.4.11
 * asks of a control's boundary — a chip *is* its own boundary.
 */
const HUES: ReadonlyArray<Swatch> = [
  {
    value: '#256256',
    token: 'var(--color-brand)',
    label: 'modules.colour.pine',
  },
  {
    value: '#1d4fd8',
    token: 'var(--color-info)',
    label: 'modules.colour.inkBlue',
  },
  {
    value: '#8a5305',
    token: 'var(--color-warning)',
    label: 'modules.colour.amber',
  },
  {
    value: '#136b45',
    token: 'var(--color-success)',
    label: 'modules.colour.green',
  },
  {
    value: '#b22f22',
    token: 'var(--color-danger)',
    label: 'modules.colour.red',
  },
]

/**
 * Not a colour — the absence of one, which is why it is the empty string and not
 * a pale grey pretending to be a choice. Only a nullable column can hold it.
 *
 * It is the one swatch a reader cannot see by its colour: `surface-inset` reads
 * 1.19:1 against the surface in both themes and `edge-faint` around it 1.32:1,
 * so the chip and its border are both invisible until it is selected. The picker
 * draws it a stronger edge and a stroke through it instead.
 */
const NONE: Swatch = {
  value: '',
  token: 'var(--color-surface-inset)',
  label: 'modules.colour.none',
}

/**
 * The neutral that stands in for "none" where the column cannot be empty.
 *
 * `collections.colour` is `notNull`, so a collection always carries a colour and
 * a reader who wants none has to be offered the quietest one instead. Named for
 * the stone, like Pine and Amber, because a swatch called "grey" among them
 * would read as the absence this is standing in for.
 */
const SLATE: Swatch = {
  value: '#5b5951',
  token: 'var(--color-ink-3)',
  label: 'modules.colour.slate',
}

/**
 * For a nullable colour — a packing list, a shared note. "No colour" leads,
 * because it is what most rows are.
 */
export const SWATCHES: ReadonlyArray<Swatch> = [NONE, ...HUES]

/**
 * For a `notNull` colour — a place collection. No absence to offer, so the
 * neutral takes the sixth slot instead of the first.
 */
export const REQUIRED_SWATCHES: ReadonlyArray<Swatch> = [...HUES, SLATE]

/**
 * What a `notNull` colour starts as, named rather than reached for by index.
 *
 * The dialog that creates a collection needs this twice — once to seed the
 * field and once to reset it — and both used to spell the hex out beside a
 * `SWATCHES[0]` lookup, so the palette's first member and the fallback could
 * disagree without anything noticing.
 */
export const REQUIRED_DEFAULT: string = HUES[0].value

/**
 * Every colour the palette knows, whichever picker offers it.
 *
 * Lookup has to span both compositions: a collection stores Slate, which the
 * nullable palette never offers, and searching only `SWATCHES` would send that
 * row to the raw-hex fallback and quietly stop it following the theme.
 */
const ALL: ReadonlyArray<Swatch> = [...HUES, SLATE]

/** The swatch a stored value belongs to, if the palette still offers it. */
export function swatchFor(value: string | null): Swatch | undefined {
  if (value === null || value === '') {
    return undefined
  }
  const wanted = value.toLowerCase()
  return ALL.find((swatch) => swatch.value.toLowerCase() === wanted)
}

/** What to paint a stored colour with: its token, or the value as saved. */
export function paintFor(value: string | null): string | undefined {
  if (value === null || value === '') {
    return undefined
  }
  return swatchFor(value)?.token ?? value
}
