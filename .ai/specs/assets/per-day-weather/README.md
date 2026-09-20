# Per-day weather — mockup frames

Dependency-free reproductions of the badge and its popover for
`.ai/specs/2026-09-19-per-day-weather.md`. They are illustrations of the proposed design, not app
code: the markup is standalone HTML, and both the palette (`src/styles/tokens.css:71-79` light,
`:290-298` dark) and the type steps (`--text-micro` 11px, `--text-caption` 12px, `--text-label`
13px, `--text-body` 15px, `:665-683`) are copied from the tokens, so the frames preview the
token-based design the spec mandates rather than a scale invented here. The product has no 14px
step and neither does this file. Those steps sit closer together than a generic type-scale check
expects, which is why `flat-type-hierarchy` is suppressed for this file in `.impeccable/config.json`
as it is for the other spec mockups: the planner rail gets its hierarchy from weight and the
`--ink` / `--ink-3` / `--ink-4` ramp, exactly as `src/components/planner/day-section.tsx` does.

| File                      | Shows                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mockup-01-day-rows.html` | The planner day rail — forecast (with focus ring), rain forecast, unavailable (`—`), estimate with its `≈` prefix and dashed outline, the loading skeleton at final size, and an undated day's reserved empty box — and both popover variants. The `not-yet-recorded` state is specified but not drawn here; its mark is phase 3's to choose. |

Open it in a browser and resize to see the 1280 px and 360 px layouts; toggle the OS colour scheme
for dark. Rendered frames are not kept here: `AGENTS.md` § Never reserves this directory for the
`.html` reproduction and nothing else, so light, dark and mobile PNGs live on the spec's pull
request (#636) as evidence instead. The renders posted there predate the palette correction to the
real token values, so re-render from this HTML when the spec's UI phase starts rather than trusting
their colours.
