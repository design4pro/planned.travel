/**
 * A confirmation code the reader can keep off a shared screen.
 *
 * Two surfaces obey the same preference — the booking desk's confirmation number
 * and the transport card's booking reference — so the rule is written once here
 * rather than twice in the two timelines. It sits in `modules/shared` beside
 * {@link CopyValue}, which is the control it wraps and the module the other
 * cross-module controls already live in; it fetches nothing and imports nothing
 * from `server/`, so `maskCodes` always arrives as a prop from the route that
 * read it.
 *
 * **The value is not in the DOM until it is revealed.** The masked run is its own
 * text node and the code is never rendered behind it under `opacity: 0` or a
 * `-webkit-text-security` face — a shoulder is not the only reader a page has, and
 * "hidden" that a `Ctrl-F`, a screenshot pipeline or the accessibility tree can
 * still read is not hidden.
 */
import { useTranslate } from '#/lib/i18n'
import { CopyValue } from './controls'

/**
 * One glyph stands for one character. `•` rather than `*`, because a run of
 * bullets reads as a redaction and a run of asterisks reads as a footnote.
 */
export const MASK_CHARACTER = '•'

/**
 * The mask itself: as many glyphs as the code has characters, so the shape of a
 * six-digit PNR and a fourteen-character hotel reference still tell apart.
 *
 * An empty — or blank — code masks to nothing rather than to a row of dots,
 * because a mask over an absent value tells the reader a confirmation number
 * exists when none does.
 *
 * Counted with the spread rather than with `.length`, so an emoji or an accented
 * character built from a surrogate pair is one glyph and not two.
 */
export function maskCode(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? '' : MASK_CHARACTER.repeat([...trimmed].length)
}

export interface MaskedCodeProps {
  readonly value: string
  /** What a screen reader is told the code is, e.g. `the booking reference for Hikari 500`. */
  readonly label: string
  /** The reader's own display preference, read once by the route and handed down. */
  readonly masked: boolean
  readonly className?: string
}

/**
 * The code, masked or not, with a per-card reveal.
 *
 * This owns the rule — the preference, the empty-code exception, the glyph count
 * and the name of the reveal — and hands the mask to {@link CopyValue}, which owns
 * the control: a click, a tap, `Enter` or `Space` reveals, the next activation
 * copies, and moving on masks the code again. A hover or a `Tab` past it reveals
 * nothing. Revealing is per card and never writes the preference — the setting is
 * what the reader decided about every screen, and one glance at one code is not a
 * decision to change it.
 */
export function MaskedCode({
  value,
  label,
  masked,
  className,
}: MaskedCodeProps) {
  const t = useTranslate()
  // An empty code has nothing to hide, so the preference has nothing to do here:
  // masking it would claim a confirmation number exists when none does.
  const glyphs = masked ? maskCode(value) : ''

  return (
    <CopyValue
      value={value}
      label={label}
      className={className}
      mask={
        glyphs === ''
          ? undefined
          : { glyphs, revealLabel: t('modules.action.showCode', { label }) }
      }
    />
  )
}
