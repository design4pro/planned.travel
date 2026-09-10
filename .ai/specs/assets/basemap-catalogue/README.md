# Assets for `.ai/specs/implemented/2026-09-07-basemap-catalogue.md`

Design evidence for the spec PR. Nothing here is app code, nothing imports from `src/`, and nothing
is a visual baseline — ADR 0016 retired those, and these files compare nothing.

## Current app

Captured from the running app at `develop` (`ecb6ef74`) with
`node scripts/visual/capture.mjs --url /settings/appearance --viewports 360x800,1440x900 --themes light,dark --auth`,
which reported `captureValid: true` and an empty `console.fatal`.

| File                                | What it shows                                                      |
| ----------------------------------- | ------------------------------------------------------------------ |
| `current-appearance-1440-light.png` | The **Motion and maps** card today: Map style is a one-line select |
| `current-appearance-1440-dark.png`  | The same, dark                                                     |
| `current-appearance-360-light.png`  | The same at 360 px                                                 |
| `current-appearance-360-dark.png`   | The same at 360 px, dark                                           |

## Proposed picker

`picker-mockup.html` is a static, illustrative mockup of the row the spec proposes. Its colours are
copied from `src/styles/tokens.css` and `src/lib/map/palette.ts` so the contrast and the proportions
are honest; its type face is a system stack rather than Geist, and its swatch tiles are impressions
of a cartography rather than rendered tiles. Charcoal is drawn selected, which is the state the
spec's **Visual change expected** section declares.

| File                    | Viewport | Theme |
| ----------------------- | -------- | ----- |
| `picker-1440-light.png` | 1440 px  | light |
| `picker-1440-dark.png`  | 1440 px  | dark  |
| `picker-360-light.png`  | 360 px   | light |
| `picker-360-dark.png`   | 360 px   | dark  |

Re-render with any headless Chromium against the HTML file; nothing in the repository depends on
these images.
