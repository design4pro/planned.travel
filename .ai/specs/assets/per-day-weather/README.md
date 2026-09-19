# Per-day weather — mockup frames

Dependency-free reproductions of the badge and its popover for
`.ai/specs/2026-09-19-per-day-weather.md`. They are illustrations of the proposed design, not app
code: the markup is standalone HTML and the palette is copied from `src/styles/tokens.css`
(`:71-79` light, `:290-298` dark) so the frames preview the token-based design the spec mandates.

| File                            | Shows                                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mockup-01-day-rows.html`       | The source of all three frames: the planner day rail with every badge state, and both popover variants.                                                                                                     |
| `mockup-01-day-rows-light.png`  | Light, 1280 px. Forecast (with focus ring), rain forecast, unavailable (`—`), estimate with its `≈` prefix and dashed outline, the loading skeleton at final size, and an undated day's reserved empty box. |
| `mockup-02-day-rows-dark.png`   | The same rail in dark.                                                                                                                                                                                      |
| `mockup-03-day-rows-mobile.png` | The same rail at 360 px.                                                                                                                                                                                    |

The PNGs were rendered before the palette was corrected to the real token values; re-render them
from the HTML when the spec's UI phase starts, so the frames and the tokens agree.
