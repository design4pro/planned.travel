import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The one invariant `--z-impersonation` exists for, checked against the library
 * that actually paints the layer it outranks.
 *
 * `docs/ACCESS.md` §6.1: nothing may cover the control that ends an impersonated
 * session, and a toast is the layer most likely to try. `DESIGN.md` states
 * that as a band — `--z-impersonation` one step above `--z-toast` — and a band is
 * only true of the product if the code that paints toasts is inside it. Ours is
 * `sonner`, whose own stylesheet pins its container at `z-index: 999999999`.
 * Until `styles.css` pulled it back, the token pair described a stack the bundle
 * did not implement and the sentence in DESIGN.md was decoration.
 *
 * These assertions are deliberately about the *shipped* files rather than about
 * a rendered page: jsdom has no cascade to ask, and the failure mode being
 * guarded is a dependency bump changing a stylesheet nobody re-reads. If sonner
 * restacks itself, renames its container attribute, or raises its own selector's
 * specificity past ours, this file goes red and the bar is still on top.
 */

function stylesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

function ours(): string {
  return readFileSync(join(stylesDir(), 'styles.css'), 'utf8')
}

function tokens(): string {
  return readFileSync(join(stylesDir(), 'tokens.css'), 'utf8')
}

/** Sonner's own stylesheet, resolved through the package rather than by path. */
function sonnerStylesheet(): string {
  const require = createRequire(import.meta.url)
  return readFileSync(require.resolve('sonner/dist/styles.css'), 'utf8')
}

/**
 * Every rule in `css` that declares `z-index`, as `[selector, value]`.
 *
 * Comments come out first: this very file's neighbours explain the stacking they
 * implement, and a prose `z-index` inside a comment block is not a rule.
 */
function zIndexRules(css: string): Array<{ selector: string; value: string }> {
  const rules: Array<{ selector: string; value: string }> = []
  const source = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const pattern = /z-index:\s*([^;}]+)[;}]/g
  for (const match of source.matchAll(pattern)) {
    const open = source.lastIndexOf('{', match.index)
    if (open < 0) {
      continue
    }
    const start = Math.max(
      source.lastIndexOf('}', open),
      source.lastIndexOf('{', open - 1),
      -1,
    )
    rules.push({
      selector: source.slice(start + 1, open).trim(),
      value: match[1].trim(),
    })
  }
  return rules
}

/**
 * CSS specificity as `(id, class, type)`, folded into one comparable number.
 *
 * Enough of the grammar for the selectors in play: attribute selectors, classes
 * and pseudo-classes all count in the middle column, ids in the first, element
 * names and pseudo-elements in the last.
 */
function specificity(selector: string): number {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0
  const classes =
    (selector.match(/\.[\w-]+/g)?.length ?? 0) +
    (selector.match(/\[[^\]]+\]/g)?.length ?? 0) +
    (selector.match(/(?<!:):[\w-]+(?![\w-]*\()/g)?.length ?? 0)
  const types =
    selector
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/[.#:][\w-]+/g, ' ')
      .split(/[\s>+~,]+/)
      .filter((part) => /^[a-z][\w-]*$/i.test(part)).length +
    (selector.match(/::[\w-]+/g)?.length ?? 0)
  return ids * 10_000 + classes * 100 + types
}

/** The strongest rule sonner ships for its own toast container. */
function sonnerToasterRule(): { selector: string; value: string } {
  const rules = zIndexRules(sonnerStylesheet()).filter((rule) =>
    rule.selector.includes('[data-sonner-toaster]'),
  )
  expect(
    rules.length,
    'sonner z-index rules for its container',
  ).toBeGreaterThan(0)
  return rules.reduce((strongest, rule) =>
    specificity(rule.selector) >= specificity(strongest.selector)
      ? rule
      : strongest,
  )
}

/** Our own override of it. */
function overrideRule(): { selector: string; value: string } {
  const rule = zIndexRules(ours()).find(
    (candidate) =>
      candidate.selector.includes('[data-sonner-toaster]') &&
      !candidate.selector.startsWith('@'),
  )
  expect(rule, 'a rule in styles.css binding sonner to the band').toBeDefined()
  if (rule === undefined) {
    throw new Error('unreachable')
  }
  return rule
}

/** The declared value of a layout token, which lives on the bare `:root`. */
function token(name: string): number {
  const match = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(tokens())
  expect(match, name).not.toBeNull()
  return Number(match?.[1].trim())
}

describe('the toast layer', () => {
  it('paints far above the band on its own', () => {
    // Not a complaint about sonner: this is the fact the override exists for,
    // asserted so the override cannot be deleted as redundant.
    expect(Number(sonnerToasterRule().value)).toBeGreaterThan(
      token('--z-impersonation'),
    )
  })

  it('is bound back to `--z-toast` by our own stylesheet', () => {
    expect(overrideRule().value).toBe('var(--z-toast)')
  })

  it('is bound by specificity, not by source order or `!important`', () => {
    // Sonner injects its `<style>` into `<head>` at import time, so which
    // stylesheet the browser sees last is not ours to decide. One specificity
    // step above the library's own selector settles it either way — and no
    // `!important` fight, which the toaster's token repaint deliberately avoids.
    const theirs = sonnerToasterRule()
    const mine = overrideRule()
    expect(specificity(mine.selector)).toBeGreaterThan(
      specificity(theirs.selector),
    )
    expect(mine.value).not.toContain('!important')
  })

  it('leaves the impersonation bar above the toast that would cover it', () => {
    // The whole point, stated as the two numbers: a toast now lands at 80 and
    // the bar at 90, so the control that ends somebody else's session cannot be
    // covered by a notification about it.
    expect(token('--z-toast')).toBeLessThan(token('--z-impersonation'))
    expect(token('--z-toast')).toBeGreaterThan(token('--z-modal'))
  })

  it('is not re-raised by the toaster component itself', () => {
    // A `zIndex` on `<Toaster>` would be an inline style, which outranks any
    // stylesheet rule and would put the library back on top of the bar.
    const toaster = readFileSync(
      join(stylesDir(), '..', 'components', 'layout', 'app-toaster.tsx'),
      'utf8',
    )
    expect(toaster).not.toMatch(/zIndex/)
    expect(toaster).not.toMatch(/z-index/)
  })
})
