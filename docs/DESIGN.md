# planned.travel — Design System Brief

Companion to `docs/SPEC.md`. Owns the visual contract. Reference screenshots of the quality
bar live in the session scratchpad `ref/` directory (light, dark, planner, atlas, journey, vacay).

## Intent

Editorial-modern, warm, confident. The product should feel like a beautifully typeset travel
magazine that happens to be software — not like a dashboard template. Warm paper canvas,
soft-cornered white cards, oversized display numerals, whisper-quiet uppercase labels, a single
near-black accent doing the heavy lifting, and one vivid brand colour used sparingly.

We are matching the reference's *structural* design language (which is genuinely strong) and
beating it on **typography, colour warmth, state completeness and motion polish**.

## Token contract

Declare every token in `src/styles/tokens.css`, exposed to Tailwind v4 through `@theme`.
Light values on bare `:root`. Dark values in **both** `@media (prefers-color-scheme: dark)`
guarded as `:root:not([data-theme="light"])` **and** `:root[data-theme="dark"]`, so an explicit
user toggle wins in both directions and the system default still works with no attribute set.

Required token families — name them exactly this way:

- **Colour**: `--color-canvas`, `--color-surface`, `--color-surface-2`, `--color-surface-inset`,
  `--color-ink`, `--color-ink-2`, `--color-ink-3`, `--color-ink-4`,
  `--color-edge`, `--color-edge-faint`,
  `--color-accent`, `--color-accent-hover`, `--color-accent-on`, `--color-accent-subtle`,
  `--color-brand`, `--color-brand-hover`, `--color-brand-on`, `--color-brand-subtle`,
  `--color-success|warning|danger|info` each with a `-soft` tinted companion,
  `--color-inverse`, `--color-inverse-on`, `--color-overlay`.
- **Space**: 4px grid, `--space-1` … `--space-16`.
- **Radius**: `--radius-sm 8px`, `-md 12px`, `-lg 16px`, `-xl 20px`, `-2xl 28px`, `-full`.
- **Shadow**: `--shadow-card`, `-elevated`, `-modal`, `-dropdown`, `-popover`, `-glass`.
  Dark-mode shadows are re-declared (darker, tighter) — never reused from light.
- **Type**: `--font-display`, `--font-ui`, plus a semantic scale
  `--text-display|title|subtitle|body|label|caption` each with a paired line-height.
- **Motion**: `--ease-out-quint: cubic-bezier(.23,1,.32,1)`, `--ease-drawer`,
  `--duration-fast 150ms`, `--duration 220ms`, `--duration-slow 320ms`.
- **Layout**: `--z-nav|dropdown|overlay|modal|toast|impersonation`, `--nav-h`, `--subnav-h`,
  `--impersonation-h`, `--safe-top`, `--safe-bottom`. `--z-impersonation` is the top of the
  stack, one band above `--z-toast`: `docs/ACCESS.md` §6.1 requires that nothing can cover the
  control which ends an impersonated session, and a toast is the layer most likely to try.
  `--impersonation-h` is that bar's row and is `0rem` everywhere except the shell subtree
  rendering it, so every chrome offset composes it unconditionally and a shell without the bar
  keeps exactly the geometry it had. Layout and z values are theme-independent: declare them once
  on the bare `:root`, never in the two dark blocks.

  **A band binds nothing until the library inside it is bound.** Our toasts are `sonner`'s, and
  `sonner` pins its own container at `z-index: 999999999` — so for as long as `--z-toast` was
  merely declared, the tier above it described a layer nothing occupied while the real toast
  layer sat over the End impersonation control. `src/styles/styles.css` therefore carries
  `:root [data-sonner-toaster] { z-index: var(--z-toast) }`: one specificity step above the
  library's own selector, so it wins without `!important` and without depending on which
  stylesheet the browser saw last. `src/styles/__tests__/toast-stacking.test.ts` reads both files
  and fails if `sonner` restacks itself. A z token that a third-party stylesheet ignores is
  decoration, and this is the one band where that is a safety property rather than a nicety.

  Both edges of the viewport are the shell's, not a route's. `--impersonation-h` reserves the top
  one. Below `lg` the mobile tab bar is `fixed`, so it displaces nothing and covers the last row
  of whatever is behind it — and `src/routes/_app/route.tsx` therefore wraps `<Outlet />` in a
  single element carrying `pb-tab-bar lg:pb-0` (`SHELL_BOTTOM_CLASS`), which gives that box real
  height: hairline, row and `--safe-bottom`, released from `lg` where the bar is not rendered.
  Once around the outlet rather than per route, because a route is free not to use the content
  well: `AppFrame`'s `bleed` branch has no padding by design and a screen that renders no
  `AppFrame` at all still renders inside this shell.

  Its twin is scroll geometry, not layout: `html:has([data-app-shell])` carries
  `scroll-padding-bottom` of the same expression, so the browser also stops short of the bar when
  it scrolls a focused field or an anchor into view. Neither substitutes for the other, and the
  selector is scoped because only this document has a tab bar — the marketing tree and the auth
  tree have no bottom chrome to clear.

  Every chrome expression in the product — both reservations included — is assembled from the
  inset lists in `src/lib/atlas/layout.ts` for the same reason `--impersonation-h` is a token: a
  hand-written `calc()` that forgets a hairline is a screen that overflows its own viewport by a
  pixel per term, and it does it silently. `documentHeight()` and `tripDocumentHeight()` sum the
  header, the slice and the shell's bottom box, and the tests beside that file assert both land on
  exactly one viewport at both breakpoints, with the impersonation bar present and absent.

## Starting palette (tune it, keep the structure)

Light — warm paper, not clinical white:
`canvas #FAF9F7` · `surface #FFFFFF` · `surface-2 #F3F1ED` · `surface-inset #ECE9E3`
`ink #131311` · `ink-2 #3B3A35` · `ink-3 #6E6D65` · `ink-4 #9B9A91`
`edge #E5E2DB` · `edge-faint rgb(0 0 0 / .06)`
`accent #131311` (near-black; primary buttons, FAB, inverse cards) on `#FFFFFF`
`brand #2F6F5E` (deep pine; links, active nav, map markers, selection) on `#FFFFFF`
`success #16794C` · `warning #B26B08` · `danger #C0392B` · `info #2563EB`

Dark — warm charcoal, never pure black, never inverted-light:
`canvas #121211` · `surface #1A1A18` · `surface-2 #21211F` · `surface-inset #2A2A27`
`ink #F7F6F3` · `ink-2 #D6D4CE` · `ink-3 #A3A19A` · `ink-4 #76746D`
`edge #32322E` · `edge-faint rgb(255 255 255 / .07)`
`accent #F7F6F3` on `#131311` (the near-black/near-white inversion flips)
`brand #4FA88E` on `#0E1A16`

Verify every text/background pair at **WCAG 2.2 AA** in both themes before you call it done.

## Typography

- Display: `MuseoModerno` — 400/700/800. Hero headings, big numerals, wordmark.
- UI: `Geist Sans` — 400/500/600. Everything else.
- Load via Google Fonts `display=swap` with `preconnect`, and a genuine fallback stack.
- `SectionLabel`: 11px, 600, `letter-spacing .08em`, uppercase, `--color-ink-3`.
- Hero numerals: display font, 700–800, tight leading (`.95`–`1.05`), `tabular-nums`.
- Any number that can change gets `tabular-nums`. No exceptions — it stops layout jitter.

## Primitives to build (`src/components/ui`)

Each one ships with **every** state (rest, hover, focus-visible, active, disabled, loading,
error where applicable), full keyboard support, dark mode, and a `cn()`-mergeable `className`.

`Button` (variants: primary/secondary/ghost/subtle/danger/inverse; sizes sm/md/lg; `icon` and
`loading` props) · `IconButton` · `Card` · `StatCard` · `Input` · `Textarea` · `Select` ·
`Combobox` · `Checkbox` · `Radio` · `Switch` · `Slider` · `DatePicker` · `DateRangePicker` ·
`Dialog` · `Sheet`/`Drawer` · `Popover` · `Tooltip` · `DropdownMenu` · `ContextMenu` ·
`Tabs` · `PillNav` · `Badge` · `Chip` · `Avatar` · `AvatarStack` · `Progress` · `Spinner` ·
`Skeleton` · `EmptyState` · `Alert` · `Toast` (sonner-backed) · `Separator` · `ScrollArea` ·
`Fab` · `GlassPanel` · `SectionLabel` · `Sparkline` · `Kbd` · `Table` · `Pagination`.

Build them on `radix-ui` where a primitive exists. Never ship a bare `<div>` acting as a
button, and never ship a custom control that loses keyboard or screen-reader behaviour.

## Motion rules

- Enter 220ms `--ease-out-quint`; exit 150ms. Drawers/sheets use `--ease-drawer`.
- Transform and opacity only. Never animate layout-affecting properties.
- Stagger list entrances by 20–30ms, cap the stagger at ~8 items.
- Respect `prefers-reduced-motion: reduce` — collapse to opacity-only or none.
- Hover lift on cards is at most 1px translate plus a shadow step. Restrained, not bouncy.
