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
import { useEffect, useRef, useState } from 'react'
import { Eye } from 'lucide-react'

import { cn } from '#/lib/cn'
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
 * The reveal is a `button` and not a `div` with a mouse handler: it is reachable
 * from the keyboard, it says what it does, and it opens on hover, on focus and on
 * tap alike. Revealing is per card and never writes the preference — the setting
 * is what the reader decided about every screen, and one glance at one code is
 * not a decision to change it.
 *
 * **The reveal hands the focus on.** Revealing unmounts this button and mounts
 * {@link CopyValue}'s in its place, so a reader who tabbed onto the mask would
 * otherwise be dropped back at the top of the document by the very act of
 * opening it. The handover happens only when this button actually held the focus
 * — a hover reveals without ever taking it, and must not take it now.
 *
 * Motion: the swap is a colour and opacity change on one element whose width is
 * already the same in both states, because the mask has the code's own character
 * count. Nothing below the row moves when a code is revealed.
 */
export function MaskedCode({
  value,
  label,
  masked,
  className,
}: MaskedCodeProps) {
  const [revealed, setRevealed] = useState(false)
  const copyRef = useRef<HTMLButtonElement>(null)
  const handOver = useRef(false)
  const mask = maskCode(value)

  useEffect(() => {
    if (revealed && handOver.current) {
      handOver.current = false
      copyRef.current?.focus()
    }
  }, [revealed])

  function reveal(target: HTMLButtonElement): void {
    handOver.current ||= document.activeElement === target
    setRevealed(true)
  }

  // An empty code has nothing to hide, so the preference has nothing to do here:
  // masking it would claim a confirmation number exists when none does.
  if (!masked || revealed || mask === '') {
    return (
      <CopyValue
        ref={copyRef}
        value={value}
        label={label}
        className={className}
      />
    )
  }

  return (
    <button
      type="button"
      data-part="confirmation-code"
      aria-label={`Show ${label}`}
      onClick={(event) => reveal(event.currentTarget)}
      onFocus={(event) => reveal(event.currentTarget)}
      onPointerEnter={(event) => reveal(event.currentTarget)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm bg-surface-inset px-1.5 font-mono text-caption tracking-wide text-ink-4 focus-ring',
        'transition-colors duration-fast ease-out-quint hover:text-ink-2',
        className,
      )}
    >
      <span aria-hidden className="tabular-nums">
        {mask}
      </span>
      <Eye aria-hidden className="size-3" />
    </button>
  )
}
