/**
 * The mail palette and the inline styles every template composes from.
 *
 * Email clients strip `<style>` and do not resolve CSS custom properties, so
 * `src/styles/tokens.css` cannot be consumed here the way a screen consumes it.
 * These constants are the light-theme token values transcribed *by value*, and
 * the trailing comment on each names the token it has to stay equal to. `ink`,
 * `canvas` and `muted` are the three the hand-rolled templates already shipped
 * with, unchanged; the rest extend the same set. Every pair used as text on a
 * background clears WCAG 2.2 AA: ink 18.29:1 on surface, ink2 10.71:1, muted
 * 7.02:1 on surface and 6.22:1 on surface2, brand 6.02:1 on brandSoft, danger
 * 5.31:1 on dangerSoft, and white 18.29:1 on the near-black button.
 *
 * `@react-email/tailwind` is deliberately unused. It is a self-contained
 * Tailwind-for-email implementation carrying its own config; it cannot read this
 * project's Tailwind v4 `@theme`, so adopting it would fork the design tokens
 * into a second source of truth and emit `var(--color-…)` that most clients
 * ignore anyway.
 *
 * No web font is requested. Gmail strips `@font-face`, so a display face would
 * arrive for a minority of readers and shift the layout for the rest; the mail
 * sets in the reader's own UI stack and earns its character from spacing,
 * hierarchy and the warm paper canvas instead.
 */

import type { CSSProperties } from 'react'

export const palette = {
  ink: '#16150f', // --color-ink
  ink2: '#403e36', // --color-ink-2
  muted: '#5b5951', // --color-ink-3
  canvas: '#faf9f7', // --color-canvas
  surface: '#ffffff', // --color-surface
  surface2: '#f3f1ed', // --color-surface-2
  edge: '#e3e0d8', // --color-edge
  brand: '#256256', // --color-brand
  brandSoft: '#e3efeb', // --color-brand-subtle
  danger: '#b22f22', // --color-danger
  dangerSoft: '#fbe7e4', // --color-danger-soft
  onDark: '#ffffff', // --color-accent-on
} as const

/**
 * Tones a callout can carry.
 *
 * Two, not five. The product's warm palette earns its character from one pine
 * brand colour doing the ordinary work and red reserved for the two messages
 * that genuinely cost the reader something — a declined charge and a deletion.
 * Both pairs clear WCAG 2.2 AA as text on their own tint.
 */
export type CalloutTone = 'brand' | 'danger'

export const calloutTones: Readonly<
  Record<CalloutTone, { readonly ink: string; readonly fill: string }>
> = {
  brand: { ink: palette.brand, fill: palette.brandSoft },
  danger: { ink: palette.danger, fill: palette.dangerSoft },
}

const UI_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

/** Everything below sits on the same 4px grid the product's screens use. */
export const styles = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: palette.canvas,
    fontFamily: UI_STACK,
    WebkitFontSmoothing: 'antialiased',
  },
  container: {
    width: '100%',
    maxWidth: '560px',
    margin: '0 auto',
    padding: '40px 16px',
  },
  masthead: {
    padding: '0 4px 20px',
  },
  wordmark: {
    fontSize: '17px',
    lineHeight: '24px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: palette.ink,
    verticalAlign: 'middle',
  },
  eyebrow: {
    fontSize: '11px',
    lineHeight: '24px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textAlign: 'right',
    color: palette.muted,
    verticalAlign: 'middle',
  },
  card: {
    backgroundColor: palette.surface,
    border: `1px solid ${palette.edge}`,
    borderRadius: '20px',
    padding: '32px',
  },
  heading: {
    margin: '0 0 16px',
    fontSize: '24px',
    lineHeight: '30px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: palette.ink,
  },
  paragraph: {
    margin: '0 0 16px',
    fontSize: '15px',
    lineHeight: '24px',
    color: palette.ink2,
  },
  strong: {
    color: palette.ink,
    fontWeight: 600,
  },
  panel: {
    margin: '0 0 24px',
    backgroundColor: palette.surface2,
    borderRadius: '12px',
    padding: '4px 20px',
  },
  factRow: {
    borderBottom: `1px solid ${palette.edge}`,
  },
  factRowLast: {
    borderBottom: '0 none',
  },
  factLabel: {
    width: '44%',
    padding: '12px 12px 12px 0',
    fontSize: '11px',
    lineHeight: '16px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: palette.muted,
    verticalAlign: 'top',
  },
  factValue: {
    padding: '12px 0',
    fontSize: '15px',
    lineHeight: '16px',
    fontWeight: 600,
    color: palette.ink,
    textAlign: 'right',
    // Every value in a fact panel is a figure that changes between sends.
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  },
  button: {
    display: 'inline-block',
    backgroundColor: palette.ink,
    borderRadius: '12px',
    padding: '13px 24px',
    fontSize: '15px',
    lineHeight: '20px',
    fontWeight: 600,
    color: palette.onDark,
    textDecoration: 'none',
  },
  secondaryAction: {
    margin: '12px 0 0',
    fontSize: '14px',
    lineHeight: '20px',
    color: palette.muted,
  },
  secondaryLink: {
    color: palette.brand,
    fontWeight: 600,
    textDecoration: 'underline',
  },
  fallback: {
    margin: '16px 0 0',
    fontSize: '13px',
    lineHeight: '20px',
    color: palette.muted,
    wordBreak: 'break-all',
  },
  fallbackLink: {
    color: palette.brand,
    textDecoration: 'underline',
  },
  footnote: {
    margin: '24px 0 0',
    paddingTop: '20px',
    borderTop: `1px solid ${palette.edge}`,
    fontSize: '13px',
    lineHeight: '20px',
    color: palette.muted,
  },
  footer: {
    padding: '24px 4px 0',
  },
  footerText: {
    margin: '0 0 4px',
    fontSize: '12px',
    lineHeight: '18px',
    color: palette.muted,
  },
  footerLink: {
    color: palette.muted,
    textDecoration: 'underline',
  },
} as const satisfies Record<string, CSSProperties>
