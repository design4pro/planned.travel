# Assets for `.ai/specs/implemented/2026-09-07-copy-a-trip.md`

Design evidence for the spec PR. Nothing here is app code, nothing imports from `src/`, and nothing
is a visual baseline — ADR 0016 retired those, and these files compare nothing.

## Current app

Captured from the running app at `develop` (`67808732`) with

```
node scripts/visual/capture.mjs --url http://localhost:3030/trips --out <dir> --label A \
  --viewports 1440x900,360x800 --themes light,dark --auth
```

which reported `captureValid: true` and an empty `console.fatal` on both runs. The menu frames add
`--click '[data-part="trip-actions-trigger"]' --settle 600`.

| File                           | What it shows                                                          |
| ------------------------------ | ---------------------------------------------------------------------- |
| `current-trips-1440-light.png` | `/trips` today: four tiles, no copy anywhere                           |
| `current-trips-1440-dark.png`  | The same, dark                                                         |
| `current-trips-360-light.png`  | The same at 360 px                                                     |
| `current-trips-360-dark.png`   | The same at 360 px, dark                                               |
| `current-menu-1440-light.png`  | The actions menu today: **Favourite, Edit, Archive, Delete** — no Copy |
| `current-menu-1440-dark.png`   | The same, dark                                                         |
| `current-menu-360-light.png`   | The same at 360 px                                                     |
| `current-menu-360-dark.png`    | The same at 360 px, dark                                               |

The menu frames are the evidence for the spec's first Problem Statement row that reaches a screen:
there is no Copy item, and the four that are there are the ones `01-S1a`–`01-S1c` shipped.

## Proposed

`copy-mockup.html` is a static, illustrative mockup of the two surfaces the spec proposes. Its
colours, radii and type sizes are copied from `src/styles/tokens.css` so the contrast and the
proportions are honest — the tile title is `--text-subtitle` (18 px), the dialog heading is
`--text-title` (26 px), and the checkbox is the `Checkbox` primitive's `size-4 rounded-sm`. Its type
face is a system stack rather than Geist, its contour covers are hand-drawn impressions rather than
`CoverArt`'s generated paths, and its icons are inline strokes rather than lucide's.

One deliberate departure from the DOM: the menu is drawn inside the card, whereas the real
`DropdownMenu` portals it out. The mockup moves `overflow` to the cover so the menu is not clipped,
which is what the portal achieves in the app.

| File                          | Frame                          | Viewport | Theme |
| ----------------------------- | ------------------------------ | -------- | ----- |
| `copy-dialog-1440-light.png`  | the dialog, range shortened    | 1440 px  | light |
| `copy-dialog-1440-dark.png`   | the dialog, range shortened    | 1440 px  | dark  |
| `copy-dialog-360-light.png`   | the dialog, range shortened    | 360 px   | light |
| `copy-dialog-360-dark.png`    | the dialog, range shortened    | 360 px   | dark  |
| `copying-tile-1440-light.png` | a tile mid-copy, and the menus | 1440 px  | light |
| `copying-tile-1440-dark.png`  | a tile mid-copy, and the menus | 1440 px  | dark  |
| `copying-tile-360-light.png`  | a tile mid-copy                | 360 px   | light |
| `copying-tile-360-dark.png`   | a tile mid-copy                | 360 px   | dark  |

The dialog is drawn with the range **shortened**, which is the state that carries the spec's
hardest sentence — the overflow's places move to ideas and their notes are dropped. The tile frame
draws both menus side by side at 1440: the copying tile's, which offers Delete alone with the reason
named, and an ordinary tile's, with the new **Copy** item highlighted at the top. At 360 only the
copying tile's menu is drawn, because two open menus at one column overlap each other's tile.

The English strings in the frames are the ones the spec's **Copy** section tabulates. They land in
all 23 locales at implementation, not here.
