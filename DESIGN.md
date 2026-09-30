---
name: planned.travel
description: Collaborative trip planning that reads like a well-made instrument - warm paper, one near-black voice, one deep pine, and colour that only carries data on the map.
colors:
  ink: '#16150f'
  ink-2: '#403e36'
  ink-3: '#5b5951'
  ink-4: '#6c6a61'
  canvas: '#faf9f7'
  surface: '#ffffff'
  surface-2: '#f3f1ed'
  surface-inset: '#edebe6'
  edge: '#e3e0d8'
  edge-strong: '#89877f'
  accent: '#16150f'
  accent-hover: '#2c2a22'
  accent-on: '#ffffff'
  accent-subtle: '#edebe6'
  brand: '#256256'
  brand-hover: '#1c4e45'
  brand-on: '#ffffff'
  brand-subtle: '#e3efeb'
  success: '#136b45'
  warning: '#8a5305'
  danger: '#b22f22'
  info: '#1d4fd8'
  inverse: '#16150f'
  inverse-on: '#f8f7f4'
  inverse-muted: '#b6b4a9'
  inverse-brand: '#5fbba0'
  country-land: '#edebe6'
  country-visited-distant: '#328474'
  country-visited: '#2b7365'
  country-visited-recent: '#256256'
  country-visited-selected: '#19423a'
  ring: '#256256'
  selection: '#cfe4dc'
  track: '#f0eee9'
  track-thumb: '#ffffff'
typography:
  hero:
    fontFamily: 'MuseoModerno, Avenir Next, ui-rounded, sans-serif'
    fontSize: 'clamp(2.75rem, 7.6vw, 6rem)'
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: '-0.035em'
  headline:
    fontFamily: 'MuseoModerno, Avenir Next, ui-rounded, sans-serif'
    fontSize: 'clamp(2.25rem, 5.4vw, 4rem)'
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: '-0.032em'
  display:
    fontFamily: 'MuseoModerno, Avenir Next, ui-rounded, sans-serif'
    fontSize: 'clamp(2.125rem, 5.2vw, 3rem)'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '-0.03em'
    fontFeature: 'tabular-nums'
  title:
    fontFamily: 'MuseoModerno, Avenir Next, ui-rounded, sans-serif'
    fontSize: '1.625rem'
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: '-0.022em'
  subtitle:
    fontFamily: 'Geist, Geist Sans, -apple-system, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '-0.012em'
  body:
    fontFamily: 'Geist, Geist Sans, -apple-system, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Geist, Geist Sans, -apple-system, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: 'Geist, Geist Sans, -apple-system, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.35
  micro:
    fontFamily: 'Geist, Geist Sans, -apple-system, sans-serif'
    fontSize: '0.6875rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.08em'
  scale:
    wordmark-sm: '1.0625rem'
    wordmark-md: '1.25rem'
    email-body: '14px'
    email-heading: '24px'
  fallback:
    fontFamily: 'Planned Latin Fallback, Planned Display Fallback, Planned Cyrillic Fallback, Planned Greek Fallback, Planned Arabic Fallback, Planned Kana Fallback, Planned Han Fallback, Planned Hangul Fallback'
rounded:
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  '2xl': '28px'
  full: '9999px'
spacing:
  '1': '0.25rem'
  '2': '0.5rem'
  '3': '0.75rem'
  '4': '1rem'
  '5': '1.25rem'
  '6': '1.5rem'
  '8': '2rem'
  '10': '2.5rem'
  '12': '3rem'
  '16': '4rem'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-on}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: '2.5rem'
  button-primary-hover:
    backgroundColor: '{colors.accent-hover}'
    textColor: '{colors.accent-on}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: '2.5rem'
  button-brand:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.brand-on}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: '2.5rem'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-2}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: '2.5rem'
  card-default:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.xl}'
    padding: '1.25rem'
  card-inverse:
    backgroundColor: '{colors.inverse}'
    textColor: '{colors.inverse-on}'
    rounded: '{rounded.xl}'
    padding: '1.25rem'
  input-default:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 0.75rem'
    height: '2.5rem'
  chip-selected:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.brand-on}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '0 0.75rem'
    height: '2rem'
  section-label:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-3}'
    typography: '{typography.micro}'
  fab:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-on}'
    rounded: '{rounded.full}'
    size: '3rem'
---

# Design System: planned.travel

## Overview

**Creative North Star: "The Quiet Instrument"**

planned.travel is a precision tool that happens to be about holidays. It is drawn in near-black
and deep pine on warm paper, and it holds itself still: surfaces are flat at rest, controls show
no chrome until you approach them, and nothing moves further than a pixel or longer than 220ms.
The confidence comes from exactness rather than from volume. An oversized display numeral and an
11px uppercase label sitting three lines apart do more work than any amount of colour would.

Restraint here is a budget, not an absence. Because the page is quiet, the one loud element on it
carries real weight: a near-black slab, a single pine call to action, a numeral set at 96px. Those
are rationed deliberately. At most one inverse card per screen, one primary button per decision,
one accent per moment. The moment a second thing shouts, both stop being heard.

The instrument metaphor also sets the standard of proof. Every text-on-surface pair in the system
carries its measured contrast ratio as a comment beside the token that produced it; the Atlas
country ramp was tuned against basemap water because water, not land, was the binding constraint;
the font stack is ordered face-then-compensator across 23 locales because a heading measured 8px
taller before its web face landed. This is a system that states its tolerances.

**Key Characteristics:**

- Warm paper canvas (`#faf9f7`), never clinical white, and never pure black in dark.
- One near-black accent and one deep pine brand. No third voice.
- Flat at rest; shadow is an answer to interaction, not a resting property.
- Oversized display numerals against 11px uppercase whisper labels: extreme scale contrast, no
  intermediate steps to soften it.
- Strict 4px grid, everywhere, with no eyeballed exceptions.
- Colour carries data on exactly one surface (the Atlas map) and decorates everywhere else.
- Light and dark are two designed systems, not one system and its inversion.

## Colors

A warm, low-chroma paper system carrying two saturated voices: an ink-black that does the
commanding and a deep pine that does the pointing.

### Primary

- **Ink Black** (`#16150f` light / `#f8f7f4` dark): the accent. Primary buttons, the FAB, inverse
  slabs, and the body text itself, because the darkest ink and the loudest fill are deliberately
  the same value. It is the product's authority: whatever is painted in it is the thing to do
  next. The light/dark pair genuinely inverts here, which is why `accent` exists as its own token
  rather than as an alias of `ink`.

### Secondary

- **Deep Pine** (`#256256` light / `#5fbba0` dark): the brand. Links, active navigation, the focus
  ring, text selection, map markers, and the entire visited-country ramp. It points rather than
  commands. It is also the only hue in the product allowed to encode a value.
- **Pine Wash** (`brand-subtle`, `#e3efeb` light / `#12261f` dark): the tinted ground for upsells,
  empty-state invitations and selected chips. It carries Deep Pine as readable text (6.02:1 light,
  6.88:1 dark), so the pair is a real surface, not a decorative tint.
- **Lifted Pine** (`inverse-brand`, `#5fbba0`, one value in both themes): Deep Pine _as seen on a
  near-black slab_, where the paper-going pine goes muddy. It takes a single value on purpose,
  because the ground it sits on barely moves between themes.

### Tertiary

The four semantic hues, each with a `-soft` tint that carries its own hue as readable text at
5.3-5.6:1, and an `-on` foreground measured against the solid fill:

- **Field Green** (`success`, `#136b45` / `#4cc38a`): completed, settled, paid, packed.
- **Amber Warning** (`warning`, `#8a5305` / `#e0a32e`): expiring, over quota, unconfirmed.
- **Signal Red** (`danger`, `#b22f22` / `#f0776a`): destructive confirmation and validation
  failure. Never the resting state of a row action.
- **Reference Blue** (`info`, `#1d4fd8` / `#8aacf9`): neutral system notices with no verdict.

### Neutral

- **Warm Paper** (`canvas`, `#faf9f7` / `#121211`): the page ground. Warm, never clinical, and in
  dark a warm charcoal that is never pure black.
- **Sheet** (`surface`, `#ffffff` / `#1a1a18`): every card face.
- **Recessed Sheet** (`surface-2` / `surface-inset`, `#f3f1ed` / `#edebe6`): nested panels, quiet
  filled buttons, tracks, and the Atlas land fill. Depth by tone, not by shadow.
- **The ink ladder** (`ink`, `ink-2`, `ink-3`, `ink-4`): four tiers, and all four clear 4.5:1 on
  all four surfaces in both themes. Hierarchy therefore comes from weight and scale as much as
  from value, which is what lets a caption stay genuinely readable instead of decoratively grey.
- **Hairline** (`edge`, `#e3e0d8` / `#33332f`) and **Faint Hairline** (`edge-faint`, an 7-8% ink
  wash): decorative separation only.
- **Control Boundary** (`edge-strong`, `#89877f` / `#74726d`): the edge of anything interactive.
  It holds 3:1 on every surface in both themes so it satisfies WCAG 2.2 1.4.11 without the
  heaviness of a full-contrast border. This is the token that separates a _drawn_ box from a
  _pressable_ one.

### Named Rules

**The One Voice Rule.** Ink Black and Deep Pine are the only two saturated voices. A screen gets
at most one inverse slab and one primary button. If a design needs a third colour to make its
hierarchy legible, the hierarchy is wrong, not the palette.

**The Data Colour Rule.** Colour carries meaning on exactly one surface: the Atlas world map,
where a single pine hue varies only in lightness to encode recency. Everywhere else colour is
decoration and must never be the sole channel of information. And even on the Atlas, adjacent
recency steps sit about 1.25:1 apart, which is a difference you can see but not read, so any
surface painting with that ramp owes the reader a legend or a per-country label (WCAG 1.4.1).

**The Measured Pair Rule.** Every colour token that can meet text carries its measured contrast
ratio as a trailing comment beside its declaration. A token added without one is not finished. The
ratio is stated against every ground the value can actually land on, not against a convenient one.

**The Two Systems Rule.** Dark is designed, not derived. Its surfaces are warm charcoal rather
than inverted paper, its shadows are re-declared darker and tighter rather than reused, and its
semantic hues are lifted rather than flipped. A dark value that was computed from a light one is
a defect.

## Typography

**Display Font:** MuseoModerno (400/700/800), with a metric-compensated local fallback
**Body Font:** Geist Sans (400/500/600), with a metric-compensated local fallback
**Script coverage:** six Noto companions for Greek, Arabic, Han, Kana and Hangul

**Character:** Geometric and slightly rounded where the product speaks up, crisp and neutral where
it works. MuseoModerno gives headlines and numerals a soft-cornered warmth that keeps the
near-black palette from reading as severe; Geist stays out of the way at 13px and has the tabular
figures the product depends on. The pairing is a warm voice for the few large things and a precise
voice for the many small ones.

### Hierarchy

- **Hero** (700, `clamp(2.75rem, 7.6vw, 6rem)`, 0.95, `-0.035em`): the marketing headline. One per
  page, and only where the headline _is_ the argument.
- **Headline** (700, `clamp(2.25rem, 5.4vw, 4rem)`, 1.02, `-0.032em`): one step below Hero, for a
  page whose headline is not the point. Pricing uses it so the plans stay in the first screen.
- **Display** (700, `clamp(2.125rem, 5.2vw, 3rem)`, 1.0, `-0.03em`, tabular): the stat numeral.
  Fluid because it also carries formatted money, and eleven glyphs of a zero-decimal currency
  overflow a summary card on a 390px phone at a fixed 48px.
- **Title** (700, 26px, 1.15, `-0.022em`): card and panel headings.
- **Subtitle** (600, 18px, 1.4, `-0.012em`): the lead line under a title; section intros.
- **Body** (400, 15px, 1.55): running text. Hold the measure to 65-75ch.
- **Label** (500, 13px, 1.4): controls, table cells, menu rows. The default size of the app.
- **Caption** (400, 12px, 1.35): metadata, timestamps, helper text.
- **Micro** (600, 11px, 1.2, `+0.08em`, uppercase): the `SectionLabel`. It opens every panel in the
  product and is the quietest thing on the page by design.

### Named Rules

**The Tabular Rule.** Any number that can change is set in `tabular-nums`. No exceptions. It is
what stops a re-rendering total from shifting the row it sits in.

**The Two-Step Rule.** Scale contrast is extreme and deliberate: a Micro label sits directly above
a Display numeral with nothing in between. Do not soften that jump with an intermediate size. The
gap is the composition.

**The Off-Ramp Register Rule.** Three registers sit beside the ramp rather than on it, and each is
enumerated in `typography.scale` so it is a decision rather than drift. The **wordmark** takes two
optical sizes of its own — 17px and 20px — because a logotype is lettering, not copy, and forcing it
onto a text ramp sizes it against the wrong thing; its largest size is Title, which it shares. **Email**
adds 14px and 24px and reuses Micro, Caption, Label, Body and the wordmark's 17px for the rest,
because px is the only unit an email client renders reliably. The **metric compensators** are declared
as a typography role because that is what they are in the system: eight `@font-face` aliases over
locally installed faces, carrying `size-adjust` and ascent overrides so a cold load settles instead of
jumping. Nobody chose them for character.

**The Compensator Pairing Rule.** In a font stack, a web face is followed _immediately_ by its own
metric-compensated local fallback, never by another web face first, and each compensator's
`unicode-range` is confined to the scripts of the face it stands in for. A second web face slipped
into that gap redraws the text with wrong metrics for as long as the first face is in flight: a
Latin heading measured 136px on a 107px baseline instead of 160px on 115px, so every heading on
the page dropped 8px the moment the display face arrived.

**The Own-Script Rule.** A language is always named in its own language and its own script, and it
carries its own `lang` attribute so it reaches its own face. Ordering alone cannot route Korean to
`Noto Sans KR`: that face claims all 11,172 Hangul syllables, but moving it up the stack would
hand it every ideograph as well.

## Layout

**The grid is 4px and it is strict.** `--space-N` is exactly `N * 4px` for N in 1..16, and
Tailwind's own scale is pinned to the same grid via `--spacing: 0.25rem`, so `p-6` and
`--space-6` are always the same 24px. There is no eyeballed margin anywhere in the product.

**Content maxes at 1440px** (`--content-max: 90rem`), on a warm canvas that runs full-bleed behind
it. Cards are the unit of composition: a page is a small number of soft-cornered sheets on paper,
not a dense table of regions.

**Chrome is a stack of named rows.** `--nav-h` (64px), `--subnav-h` (48px), and
`--impersonation-h` (0 by default, 56px only on the shell subtree that renders the impersonation
bar). Safe-area insets are tokens too (`--safe-top`, `--safe-bottom`, and the inline pair), because
the FAB and the mobile tab bar both sit against the device edge.

**Responsive range is 360px to 2560px**, and both ends are designed rather than derived. Mobile is
a distinct layout: the tab bar is `fixed`, the FAB clears it and the notch by composing
`--safe-bottom`, and the type scale's fluid clamps do real work between 390px and 923px rather
than merely shrinking.

**Direction is logical, not physical.** Arabic is a designed RTL layout. Spacing and positioning
use `start`/`end` rather than `left`/`right`, and directional icons mirror. The FAB's
`bottom-right` position means the _reading-end_ corner: bottom right in English, bottom left in
Arabic.

### Named Rules

**The 4px Rule.** Every dimension in the product is a multiple of 4px and comes from the space
scale. A one-off value in a component is a defect, not a judgement call.

**The Composed Offset Rule.** Every piece of chrome geometry composes `var(--impersonation-h)`
unconditionally. With no bar the term resolves to `0rem` and the geometry is exactly what it was;
with the bar present, no consumer can account for half of it. A hand-written `calc()` that forgets
a row is a screen that overflows its own viewport, silently.

**The Single Reservation Rule.** Exactly one thing clears each fixed edge. The content well pads
for the mobile tab bar; a full-bleed slice stops at its top edge by arithmetic. A second
reservation stacks on the first and opens a gap the size of the bar. (What the shell owns at that
edge instead is scroll geometry, which no ancestor padding can supply.)

## Elevation & Depth

**Flat at rest.** Surfaces are defined by tone and hairline, not by shadow. `--shadow-card` is
4-5% alpha in light: it exists to keep a white sheet from dissolving into warm paper, not to lift
it. Depth in the resting state comes from the surface ladder (`canvas` → `surface` →
`surface-2` → `surface-inset`), which is why nested panels get _recessed_ rather than raised.

Shadow is reserved as an answer to interaction and to layer rank. A card lifts only when it is
interactive, and only by one pixel and one shadow step. Everything that floats above the page -
dropdown, popover, modal - takes its own shadow because it genuinely is on another layer.

### Shadow Vocabulary

- **card** (`0 1px 2px rgb(22 21 15 / .04), 0 1px 3px -1px rgb(22 21 15 / .05)`): the resting
  sheet. Barely there on purpose.
- **elevated** (`0 1px 2px rgb(22 21 15 / .05), 0 10px 24px -8px rgb(22 21 15 / .12)`): the hover
  state of an interactive card, and the resting state of the FAB.
- **dropdown** (`0 2px 6px -1px rgb(22 21 15 / .06), 0 12px 32px -10px rgb(22 21 15 / .18)`): menus
  and select popovers.
- **popover** (`0 2px 8px -2px rgb(22 21 15 / .07), 0 16px 44px -12px rgb(22 21 15 / .2)`): free
  popovers and the map's fact card.
- **modal** (`0 2px 8px -2px rgb(22 21 15 / .1), 0 32px 72px -16px rgb(22 21 15 / .28)`): dialogs
  and sheets over a scrim, and the FAB's hover.
- **glass** (an inset white top highlight plus two ambient layers): the translucent panel floated
  over the map, paired with `--blur-glass: 20px`.
- **focus** (`0 0 0 2px canvas, 0 0 0 4px ring`): the offset focus ring, drawn _outside_ the
  control on a canvas-coloured gap so it survives against any fill.

### Named Rules

**The Flat-At-Rest Rule.** A resting surface gets a hairline and a tone, not a shadow step. If a
card needs a shadow to be findable, its surface value is wrong.

**The One-Pixel Rule.** The hover lift is 1px of translate plus one shadow step; the press is 1px
down with the shadow stepping back with it, so a control reads as pushed into the page rather than
as shrinking. A card that bounces reads as a toy.

**The Re-declared Dark Rule.** Dark shadows are written out again, darker and tighter, never
inherited from light. `--shadow-card` in dark is `0 1px 2px rgb(0 0 0 / .5)` - an order of
magnitude more opaque than its light counterpart, because it has to work against charcoal.

## Shapes

Soft-cornered rectangles on a warm ground, with radius used as a _category signal_ rather than as
decoration. The scale is 8 / 12 / 16 / 20 / 28 / full.

- **20px (`xl`)** is the card. It is the largest radius any rectangular surface takes, and it is
  what makes a sheet read as a sheet.
- **12px (`md`)** is the control: buttons, inputs, selects, menu rows. Sized so a 40px control
  reads as soft without reading as a pill.
- **8px (`sm`)** is the small control and the nested inset panel.
- **16px (`lg`)** is the floating layer: dropdown, popover, sheet.
- **Full** means "this is a token you can pick up": chips, badges, avatars, the FAB, the segmented
  nav track and its sliding thumb. Nothing rectangular ever takes it.

Borders are hairlines. The distinction that matters is `edge-faint` (decorative separation, a 7-8%
wash) against `edge-strong` (a real 3:1 control boundary). A dashed `edge-strong` border at 60%
opacity is the system's one invitation shape: the "create something here" affordance.

### Named Rules

**The Pill Means Pickable Rule.** `border-radius: full` on a rectangle-sized element declares it a
discrete, selectable token. Do not use it to soften a panel.

**The Hairline Honesty Rule.** If a box can be clicked, its border is `edge-strong`. If it cannot,
its border is `edge-faint`. The user reads that difference before they read the label.

## Components

Every component ships rest, hover, focus-visible, active, disabled and loading (where applicable),
in both themes, with full keyboard behaviour, built on Radix primitives wherever one exists.

**Character: quiet until touched, precise when touched.** Controls sit back at rest and respond
with exact, small, fast movements.

### Buttons

- **Shape:** softly rounded (12px at `md`/`lg`, 8px at `sm`); `pill` shape available.
- **Sizes:** 32 / 40 / 48px tall, at Label / Body / Subtitle.
- **Page-header action:** `size="sm" shape="pill"`, on every screen, so the header never changes
  height between tabs. `md` is for an empty state's call to action.
- **Primary:** Ink Black fill on white text, resting `shadow-card`, hover to `accent-hover` plus
  `shadow-elevated`. The one loud button on a screen.
- **Secondary (the default):** `edge-strong` hairline on a white sheet; hover deepens the border to
  `ink-4` and warms the fill to `surface-2`.
- **Ghost:** no chrome at all until hover, which lays down a 4.5% neutral wash. Toolbars, table
  rows, card affordances.
- **Subtle:** a quiet `surface-2` fill that sits inside a card without competing with it.
- **Brand:** Deep Pine fill, for marketing and onboarding calls to action.
- **Danger:** Signal Red fill. Confirmation only, never a resting row action.
- **Inverse:** a 6% white wash with a hairline ring, for use on a near-black slab.
- **Link:** Deep Pine text with a 35%-opacity underline that reaches full opacity on hover.
- **Press:** `translateY(1px)` with the shadow stepping down. Never a scale.
- **Disabled:** each variant _repaints_ to `ink-4` on `surface-inset` rather than fading. Opacity
  would dim the label along with the fill and land a disabled primary at about 2.9:1, which reads
  as a broken button rather than a waiting one.
- **Loading:** the label is swapped for a centred spinner while the measured width is held, so a
  pending action never reflows its row.

### Inputs / Fields

- **Style:** white sheet, 12px radius, `edge-strong` hairline - a 3:1 boundary without a heavy
  border.
- **Hover:** border deepens to `ink-4`.
- **Focus:** border shifts to Deep Pine _and_ a 2px pine outline is drawn at zero offset, so the
  control reads as focused even against a tinted panel.
- **Invalid:** border and outline both go Signal Red, driven by `aria-invalid`.
- **Disabled:** `surface-2` fill, `ink-4` text, and the hover border suppressed.

### Cards / Containers

- **Corner:** 20px (`xl`); nested insets take 16px (`lg`).
- **Variants:** `default` (white sheet, faint hairline, `shadow-card`), `inset` (recessed
  `surface-2`, no shadow), `inverse` (near-black slab, at most one per screen), `brand` (Pine Wash
  for upsells and empty states), `glass` (translucent over the map), `outline`, and `dashed` (the
  create-something invitation).
- **Padding:** 16 / 20 / 24px.
- **Interactive:** opt-in only. Adds cursor, focus ring, a 1px hover lift to `shadow-elevated`, and
  a press that returns to rest.

### Chips

- **Style:** full radius, bordered, 28 / 32 / 40px tall, in five tones (neutral, brand, success,
  warning, danger).
- **Unselected:** the tone's colour as _text_ on a white sheet with a 30%-opacity border of the
  same hue; hover fills with the tone's `-soft` wash.
- **Selected:** the tone's solid fill with its measured `-on` foreground.
- **Count slot:** a full-radius pill with `tabular-nums`, so a changing count cannot resize the
  chip.

### Navigation

- **PillNav / segmented tabs:** a `track`-coloured trough with 4px of padding and a white thumb
  carrying `shadow-card`. The thumb is anchored at the inline start and slides with `translateX`
  alone - never `left`, never a width transition - so it works identically in RTL and animates on
  the compositor.
- **Underline tabs:** the page-level bar. A 2px Ink Black rule under the active label, `ink-3`
  text lifting to `ink` on hover.

### Signature: the Atlas country ramp

The world map is the one place colour carries data. Land is `surface-inset`, so the map is drawn
on the same recessed sheet every card in the product is inset into, and belongs to the page rather
than sitting on top of it. Visited countries are a single hue - the brand pine at 168° - varying
only in lightness by recency: `distant` → base → `recent` (which _is_ `--color-brand`), with
`hover` and `selected` deepening the same pine one step and then another, so attention always
reads as "more of this country", never as "a different one". All five steps sit 6.1-6.4 CIE L*
apart. Every step clears 3:1 against both grounds it can meet, and the faint end is fixed by
contrast against basemap water rather than land, because an island country only ever touches
water. A live MapLibre paint property is JSON and cannot read a custom property, so these values
are mirrored literally in `src/lib/map/palette.ts`; `tokens.css` stays the source of truth.

### Signature: SectionLabel

11px, 600, `+0.08em`, uppercase, `ink-3`. It opens every panel in the product. It is the quietest
type in the system and it is used the most - the whisper that makes the numeral beneath it loud.

## Do's and Don'ts

### Do:

- **Do** take every colour, space, radius, shadow, easing and z-index from `src/styles/tokens.css`.
  If a value is missing, add it to the token file rather than writing it into a component.
- **Do** declare a new colour token in all three places: bare `:root`, the
  `@media (prefers-color-scheme: dark)` block guarded by `:root:not([data-theme="light"])`, and
  `:root[data-theme="dark"]`. An explicit toggle must win in both directions.
- **Do** state the measured contrast ratio beside any token that can meet text, against every
  ground it can land on.
- **Do** set `tabular-nums` on any number that can change.
- **Do** ship every state - rest, hover, focus-visible, active, disabled, loading - and a designed
  empty, skeleton and error state for every list.
- **Do** animate transform and opacity only, at 150ms out / 220ms in on `--ease-out-quint`, and
  collapse to opacity or nothing under `prefers-reduced-motion: reduce`.
- **Do** stagger list entrances by 20-30ms, capped at about eight items.
- **Do** use logical properties (`start`/`end`, `ms`/`me`) so Arabic is a layout rather than a flip.
- **Do** repaint a disabled control to `ink-4`, and reserve `opacity` for controls that carry no
  label of their own.

### Don't:

- **Don't** hardcode a hex, a px radius, or a shadow in a component.
- **Don't** derive a dark value from a light one, or reuse a light shadow in dark.
- **Don't** introduce a third saturated voice beside Ink Black and Deep Pine, or put more than one
  inverse slab or one primary button on a screen.
- **Don't** use colour as the only channel for information anywhere, including the Atlas: a ramp
  owes the reader a legend or a per-country label.
- **Don't** animate a layout-affecting property. Height, width, `left`, `top` and margin are all
  reflows, and a reflow cannot be animated honestly at 60fps.
- **Don't** exceed 400ms, and don't use a linear easing.
- **Don't** put `border-radius: full` on a panel, or an `edge-faint` border on something clickable.
- **Don't** ship a bare `<div>` acting as a button, or a custom control that loses keyboard or
  screen-reader behaviour.
- **Don't** add a second reservation for a fixed edge that something already clears.
- **Don't** invent a spacing value outside the 4px scale.
