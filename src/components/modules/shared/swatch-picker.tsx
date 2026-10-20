/**
 * The colour a list or a note is filed under.
 *
 * One owner, because there was nearly a third: `list-dialogs.tsx` had the
 * palette and this picker, `collab-dialogs.tsx` had a byte-identical copy of the
 * palette with the markup inlined, and translating the six labels would have
 * meant six keys twice over.
 *
 * The palette itself now lives in `#/lib/swatches`, where the seed can reach it
 * too — a component module could not be the source of truth for data a fixture
 * also has to write.
 */
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { SWATCHES } from '#/lib/swatches'

import type { Swatch } from '#/lib/swatches'

export function SwatchPicker({
  value,
  onChange,
  legend,
  swatches = SWATCHES,
}: {
  value: string
  onChange: (next: string) => void
  legend: string
  /**
   * Which composition to offer. The default suits a nullable colour; a `notNull`
   * one passes `REQUIRED_SWATCHES`, which drops "no colour" and ends on Slate.
   */
  swatches?: ReadonlyArray<Swatch>
}) {
  const t = useTranslate()

  return (
    <fieldset>
      <legend className="mb-2 text-label font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {value && !swatches.some((swatch) => swatch.value === value) ? (
          <button
            type="button"
            aria-pressed="true"
            aria-label={t('modules.collections.edit.currentColour')}
            onClick={() => onChange(value)}
            style={{ backgroundColor: value }}
            className="relative size-8 rounded-full border border-edge-strong ring-2 ring-ink ring-offset-2 ring-offset-surface focus-ring"
          />
        ) : null}
        {swatches.map((swatch) => {
          // The absence of a colour is the one option a reader cannot see by
          // its colour, so it is drawn rather than tinted.
          const empty = swatch.value === ''
          return (
            <button
              key={swatch.label}
              type="button"
              aria-pressed={value === swatch.value}
              aria-label={t(swatch.label)}
              onClick={() => onChange(swatch.value)}
              // Painted from the token, not from `swatch.value`: the swatch a
              // reader clicks has to be the colour they will get, and the row
              // paints through the same token.
              style={{ backgroundColor: swatch.token }}
              className={cn(
                'relative size-8 rounded-full border transition-[box-shadow,transform] duration-base ease-out-quint focus-ring',
                // A hue carries its own boundary at better than 6:1. The empty
                // chip reads 1.19:1 and `edge-faint` around it 1.32:1, which is
                // no boundary at all — `edge-strong` is 3.6:1 in both themes and
                // is what makes it a control the eye can find.
                empty ? 'border-edge-strong' : 'border-edge-faint',
                value === swatch.value
                  ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface'
                  : 'hover:scale-105 motion-reduce:hover:scale-100',
              )}
            >
              {empty ? (
                /*
                  The stroke every colour picker draws through its empty slot.
                  A gradient rather than a glyph, because the icon set has no
                  mark for this and a "∅" borrowed from the font would be a
                  costume: one hairline at 45°, in `ink-4` at 5.4:1, so the
                  option says *no colour* instead of *some pale colour*.
                */
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[linear-gradient(45deg,transparent_calc(50%_-_0.5px),var(--color-ink-4)_calc(50%_-_0.5px),var(--color-ink-4)_calc(50%_+_0.5px),transparent_calc(50%_+_0.5px))]"
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
