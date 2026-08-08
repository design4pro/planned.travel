---
version: "alpha"
name: planned.travel
description: AI-native collaborative travel planner — horizon/sky blue with warm sand accents; calm, map-friendly surfaces.
colors:
  primary: "#2572e7"
  primary-hover: "#1d5bcf"
  on-primary: "#ffffff"
  accent: "#ff9f43"
  accent-hover: "#f08a2c"
  on-accent: "#1a1207"
  background: "#ffffff"
  foreground: "#0b1220"
  muted: "#f6f8fa"
  muted-foreground: "#5b6675"
  border: "#e3e8ee"
  destructive: "#dc2626"
  on-destructive: "#ffffff"
typography:
  display:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h1:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  h2:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    lineHeight: 1.5
  label-caps:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: "0.08em"
    textTransform: uppercase
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  button-accent-hover:
    backgroundColor: "{colors.accent-hover}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-destructive}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 16px
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
---

## Overview

**Horizon optimism.** planned.travel feels like the moment before a trip begins — clear sky, warm light, an open map. The interface is calm and confident: generous whitespace, crisp sans-serif type, and a single decisive blue drawn from the horizon. Travel is the subject; the UI gets out of the way so maps, itineraries, and photos can breathe.

The product is **AI-native**, so AI-generated content and actions carry a distinct warm-sand accent — a quiet signal that "the assistant did this," never competing with the user's own content for attention.

## Colors

A high-contrast, map-friendly system: near-white surfaces, deep ink text, and one interaction blue. Surfaces are deliberately neutral so map tiles, photos, and pins read clearly on top.

- **Primary (`#2572e7`):** horizon blue — the sole driver for primary actions, links, focus rings, and selection. Hover deepens to `#1d5bcf`.
- **Accent (`#ff9f43`):** warm sand / sunset — reserved for AI-generated content, AI suggestions, and highlights. Used sparingly so it stays meaningful.
- **Background (`#ffffff`) / Foreground (`#0b1220`):** clean limestone-white canvas with deep-ink type (15:1+ contrast).
- **Muted (`#f6f8fa`) / Muted-foreground (`#5b6675`):** secondary surfaces and metadata.
- **Border (`#e3e8ee`):** hairline dividers and input outlines.
- **Destructive (`#dc2626`):** destructive actions only.

Dark mode inverts surfaces toward deep ink while keeping primary blue and the sand accent intact.

## Typography

A single family — **Inter** — across display and body, with weight and size carrying the hierarchy. Tight tracking on large headings gives the "broadsheet" confidence; relaxed line-height on body keeps itinerary text readable on mobile.

- **display / h1:** Inter 700, tight tracking — for hero and page titles.
- **h2:** Inter 600 — section headers.
- **body-lg / body-md / body-sm:** Inter 400 at 1.6 line-height — primary reading sizes.
- **label-caps:** Inter 600, uppercase, wide tracking — eyebrows, badges, and metadata.

## Layout & Spacing

A 4px base grid (`xs 4 · sm 8 · md 16 · lg 24 · xl 40`). Content max-width ~1152px (5xl) for reading/trip views; maps and full-bleed media break out edge-to-edge. Mobile-first: single column with generous touch targets (≥40px).

## Elevation & Depth

Restraint. Most surfaces are flat with hairline borders; elevation is reserved for floating, transient layers (popovers, cards over maps, the planner panel). Shadows are soft and low — never heavy "material" drop shadows. (`--shadow-card` in tokens: subtle 1px + diffuse blur.)

## Shapes

Approachable but precise. Cards and panels use `lg` (16px); buttons and inputs use `md` (10px); small chips and tags use `sm` (6px) or `pill` (9999px). Map pins and avatars are circular.

## Components

Component tokens (above) define the core set: `button-primary`, `button-accent`, `button-outline`, `card`, `badge`, `input`. Interactive variants (`*-hover`, `*-active`) are expressed as sibling component entries. shadcn/ui is the implementation library; the semantic CSS variables in `apps/web/src/styles/global.css` map these tokens (`--primary` → horizon blue, etc.) so shadcn components render on-brand automatically.

## Do's and Don'ts

**Do**
- Use **primary** for the one most important action per view; everything else is outline/ghost.
- Use **accent** only to mark AI-generated content or AI-suggested actions.
- Keep surfaces neutral so maps and photos are the visual stars.
- Pair `label-caps` eyebrows with display headings for section openers.

**Don't**
- Don't introduce new accent colors — the system is deliberately restrained.
- Don't use heavy shadows or skeuomorphic depth.
- Don't place warm-sand accent text on white (fails contrast) — accent is for fills/icons, not body text.
- Don't hardcode color values in components; reference tokens (and keep `packages/ui-tokens/src/theme.css` in sync with this file).

---

### Implementation notes

This file is the **source of truth** for the design system. Implementation mirrors it in:
- `packages/ui-tokens/src/theme.css` — Tailwind v4 `@theme` brand palette (raw colors, fonts, radii).
- `apps/web/src/styles/global.css` — maps the brand palette onto shadcn semantic tokens (primary → horizon blue, secondary/muted → neutral surfaces, accent → warm sand).
- Expo — Uniwind/Tailwind v4 native components, same brand values. The mobile foundation lives in `apps/mobile/src/global.css` and mirrors these semantic colors.

### Component library: shadcn/ui

The component layer is **shadcn/ui**: local, composable React components in `apps/web/src/components/ui`, built on Tailwind v4 and Radix primitives where appropriate. New UI must use these components and the semantic tokens defined below. Native HTML controls are acceptable when no shadcn component exists yet.

The trip detail place form is the first itinerary-writing surface: editors choose a day (when days exist), enter a name and coordinates, and submit one primary "Add to itinerary" action. Failed submissions retain field values and show an inline alert; successful submissions clear the fields only after the refreshed itinerary is available.

Regenerate Tailwind v4 tokens from this file:
```bash
npx @google/design.md export --format css-tailwind DESIGN.md
npx @google/design.md lint DESIGN.md
```
