/**
 * The product's web fonts, declared once.
 *
 * `docs/SPEC.md` §4 pins two faces — MuseoModerno for display and Geist for UI
 * — and `docs/SPEC.md` §9 ships the product in 23 languages. Those two rules
 * collide: measured against the Google Fonts API on 2026-08-22, Geist serves
 * `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext` and `vietnamese`, and
 * MuseoModerno serves `latin`, `latin-ext` and `vietnamese` only. Neither has a
 * Greek, Arabic, Han, Kana or Hangul subset, so `el`, `ar`, `ja`, `ko`,
 * `zh-Hans` and `zh-Hant` — and every non-Latin name in the language picker —
 * would resolve to whatever the reader's platform happens to install, at a
 * different weight, a different optical size and a different baseline.
 *
 * The six script-covering companions are requested alongside the main faces:
 *
 * - `Noto Sans` — Greek. It is also the only face in the set that draws the
 *   accented Greek vowels (ά, έ, ή …); nothing else requested here claims them.
 * - `Noto Sans Arabic` — the Arabic script for `ar`.
 * - `Noto Sans SC` / `TC` — Han, Simplified and Traditional, with the regional
 *   glyph variants a reader of each expects.
 * - `Noto Sans JP` — Kana. `Noto Sans KR` — Hangul.
 *
 * `src/styles/tokens.css` lists all of them inside `--font-ui` and
 * `--font-display`, ahead of the generic system entries, and
 * `src/styles/styles.css` carries the metric-compensated `local()` faces that
 * hold the line while these download.
 *
 * The document shell in `src/routes/__root.tsx` renders both preconnects
 * before the stylesheet links. The companion families keep their unicode-range
 * slices so visits only download font files for the characters they render.
 */

/** One family as the Google Fonts CSS2 API wants it spelled. */
interface FontFamilyRequest {
  /** Family name, spaces intact — encoded into the query at build time. */
  readonly family: string
  /** A CSS2 weight axis: an explicit list, or a variable range with `..`. */
  readonly weights: string
  /** Why the family is here. Kept next to the request so it stays true. */
  readonly covers: string
}

/**
 * Alphabetical by family name, which the CSS2 API requires: an out-of-order
 * `family` parameter is answered with 400 rather than a stylesheet.
 *
 * The two pinned faces keep their explicit weight lists — those are the weights
 * `DESIGN.md` names. The Noto companions use the variable `400..700` axis
 * instead, which serves the same four weights from one file per slice and cuts
 * the generated stylesheet from 1.4 MB to 466 KB.
 */
const PRIMARY_FAMILIES: readonly FontFamilyRequest[] = [
  {
    family: 'Geist',
    weights: '400;500;600;700',
    covers: 'UI — Latin, Cyrillic, Vietnamese',
  },
  {
    family: 'MuseoModerno',
    weights: '400;500;700;800',
    covers: 'Display — Latin, Vietnamese',
  },
]

const SCRIPT_FAMILIES: readonly FontFamilyRequest[] = [
  {
    family: 'Noto Sans',
    weights: '400..700',
    covers: 'Greek, and Cyrillic for display',
  },
  { family: 'Noto Sans Arabic', weights: '400..700', covers: 'Arabic' },
  { family: 'Noto Sans JP', weights: '400..700', covers: 'Kana' },
  { family: 'Noto Sans KR', weights: '400..700', covers: 'Hangul' },
  { family: 'Noto Sans SC', weights: '400..700', covers: 'Han, Simplified' },
  { family: 'Noto Sans TC', weights: '400..700', covers: 'Han, Traditional' },
]

function stylesheetHref(
  families: readonly FontFamilyRequest[],
  display: 'optional' | 'swap',
): string {
  const axes = families.map(
    ({ family, weights }) =>
      `family=${family.replaceAll(' ', '+')}:wght@${weights}`,
  )
  return `https://fonts.googleapis.com/css2?${axes.join('&')}&display=${display}`
}

/**
 * Keep the first painted fallback for the primary faces if their files are late.
 * The script companions still replace fallback text when available so glyphs
 * missing from a device's system fonts can render on that visit.
 */
export const APP_FONT_STYLESHEET_HREFS = [
  stylesheetHref(PRIMARY_FAMILIES, 'optional'),
  stylesheetHref(SCRIPT_FAMILIES, 'swap'),
] as const

export const PUBLIC_FONT_STYLESHEET_HREF = stylesheetHref(
  [...PRIMARY_FAMILIES, ...SCRIPT_FAMILIES],
  'swap',
)

/** A `<link rel="preconnect">` the document shell renders in `<head>`. */
export interface FontPreconnectOrigin {
  readonly href: string
  /** `fonts.gstatic.com` serves the font files themselves, over CORS. */
  readonly crossOrigin?: 'anonymous'
}

/**
 * Both origins, warmed before the stylesheet is parsed. The API host answers
 * the CSS; the static host answers every `woff2` it references, on a separate
 * connection that has to be negotiated as anonymous CORS or the preconnect is
 * wasted and the handshake happens twice.
 */
export const FONT_PRECONNECT_ORIGINS: readonly FontPreconnectOrigin[] = [
  { href: 'https://fonts.googleapis.com' },
  { href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
]
