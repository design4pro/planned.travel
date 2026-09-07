import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { cn } from '#/lib/cn'

/**
 * The popper tier, and the tier it was split away from.
 *
 * A Radix popper — the select listbox, the popover, the dropdown and context
 * menus, the chrome's own menu — renders into `document.body`. Its z-index is
 * therefore compared against the dialog scrim and the dialog surface at the root
 * stacking context, not nested inside the panel that opened it. On
 * `--z-dropdown: 50` it lost that comparison to `--z-overlay: 60`: a select
 * opened inside a dialog painted under the scrim, dimmed, and a click on an
 * option landed on the scrim instead of the option (issue #201).
 *
 * The fix is a band of its own above `--z-modal`, and the reason it is a *new*
 * band rather than a bigger `--z-dropdown` is asserted here too: that token also
 * carries in-page elevation for `GlassPanel`'s floating map chrome and for a
 * list item being dragged, and neither of those may outrank an open dialog.
 *
 * Every fact below is invisible to the compiler and silent when it breaks — a
 * `@utility` that is not there emits nothing at all, a `z-*` pair `cn()` does
 * not recognise keeps both classes, and a primitive that drifts back to
 * `z-dropdown` renders perfectly everywhere except inside a dialog.
 */

function srcDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

function read(...segments: Array<string>): string {
  return readFileSync(join(srcDir(), ...segments), 'utf8')
}

/** The declared value of a layout token, which has exactly one declaration. */
function tier(token: string): number {
  const css = read('styles', 'tokens.css')
  const matches = [
    ...css.matchAll(new RegExp(`^\\s*${token}:\\s*(\\d+);`, 'gm')),
  ]
  expect(matches, `declarations of ${token}`).toHaveLength(1)
  return Number(matches[0][1])
}

/**
 * The primitives that portal to `document.body` and can therefore be opened
 * from inside a dialog or a sheet. Every one of them shares the defect the
 * issue reported against `Select`, so every one of them stands on the new band.
 */
const PORTALLED_POPPERS = [
  ['components', 'ui', 'select.tsx'],
  ['components', 'ui', 'popover.tsx'],
  ['components', 'ui', 'dropdown-menu.tsx'],
  ['components', 'ui', 'context-menu.tsx'],
  ['components', 'layout', 'menu.tsx'],
] as const

describe('the popper band', () => {
  it('outranks the dialog scrim and the dialog surface, and stays under the toast', () => {
    // The ordering *is* the fix: a popper is logically above whatever opened it,
    // and a dialog is exactly the thing that opens one. It stops below the toast
    // so a toast can still announce itself over an open menu.
    expect(tier('--z-popover')).toBeGreaterThan(tier('--z-overlay'))
    expect(tier('--z-popover')).toBeGreaterThan(tier('--z-modal'))
    expect(tier('--z-popover')).toBeLessThan(tier('--z-toast'))
  })

  it('ships as a utility, in the same form as every other z token', () => {
    expect(read('styles', 'styles.css')).toContain(
      '@utility z-popover {\n  z-index: var(--z-popover);\n}',
    )
  })

  it('wins the merge against the tiers below it, in both orders', () => {
    // Missing from `cn()`'s closed `z` group these return two classes and
    // stylesheet order decides which one the browser paints on top.
    expect(cn('z-modal', 'z-popover')).toBe('z-popover')
    expect(cn('z-popover', 'z-modal')).toBe('z-modal')
    expect(cn('z-dropdown', 'z-popover')).toBe('z-popover')
  })

  it('is claimed by every primitive that portals out of its opener', () => {
    for (const parts of PORTALLED_POPPERS) {
      const source = read(...parts)
      const file = parts.join('/')
      expect(source, file).toContain('z-popover')
      expect(source, `${file} still on the in-page tier`).not.toContain(
        'z-dropdown',
      )
    }
  })
})

/**
 * The tooltip, which has to clear the band above.
 *
 * A tooltip labels a control, so whatever summoned it is already on screen and
 * the tooltip has to cover it — including a control that lives *inside* an open
 * popper. `src/components/modules/collab/thread.tsx` is the call site that makes
 * this concrete: every button in the reaction picker carries a `Tooltip`, and
 * the picker is a `PopoverContent`. On `--z-modal` the tooltip cleared the
 * poppers only while they sat on `--z-dropdown`; raising them to `--z-popover`
 * without raising the tooltip would have hidden those labels under the picker.
 */
describe('the tooltip band', () => {
  it('outranks the poppers it can be summoned from inside, and stays under the toast', () => {
    expect(tier('--z-tooltip')).toBeGreaterThan(tier('--z-popover'))
    expect(tier('--z-tooltip')).toBeLessThan(tier('--z-toast'))
  })

  it('ships as a utility and is claimed by the tooltip primitive', () => {
    expect(read('styles', 'styles.css')).toContain(
      '@utility z-tooltip {\n  z-index: var(--z-tooltip);\n}',
    )
    const source = read('components', 'ui', 'tooltip.tsx')
    expect(source).toContain('z-tooltip')
    // It used to tie with the dialog surface and win on mount order alone.
    expect(source, 'tooltip.tsx still on the modal tier').not.toContain(
      'z-modal',
    )
  })

  it('wins the merge against the popper band, in both orders', () => {
    expect(cn('z-popover', 'z-tooltip')).toBe('z-tooltip')
    expect(cn('z-tooltip', 'z-popover')).toBe('z-popover')
  })
})

describe('the in-page elevation band it was split from', () => {
  it('stays below the scrim, which is what makes the split necessary', () => {
    // Raising `--z-dropdown` itself would have been the one-line fix, and it is
    // the one deliberately not taken: the token would have carried the map's
    // glass chrome and a dragged list item over every open dialog with it.
    expect(tier('--z-dropdown')).toBeLessThan(tier('--z-overlay'))
  })

  it('still carries the two layers that are meant to sit under a dialog', () => {
    expect(read('components', 'ui', 'glass-panel.tsx')).toContain('z-dropdown')
    expect(read('components', 'modules', 'lists', 'lists-board.tsx')).toContain(
      'z-dropdown',
    )
  })
})
