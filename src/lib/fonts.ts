/**
 * The product's web fonts, declared once.
 *
 * `docs/SPEC.md` §4 pins two faces — MuseoModerno for display and Geist for UI
 * — and `docs/SPEC.md` §8 ships the product in 23 languages. Those two rules
 * collide: measured against the Google Fonts API on 2026-08-22, Geist serves
 * `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext` and `vietnamese`, and
 * MuseoModerno serves `latin`, `latin-ext` and `vietnamese` only. Neither has a
 * Greek, Arabic, Han, Kana or Hangul subset, so `el`, `ar`, `ja`, `ko`,
 * `zh-Hans` and `zh-Hant` — and every non-Latin name in the language picker —
 * would resolve to whatever the reader's platform happens to install, at a
 * different weight, a different optical size and a different baseline.
 *
 * The fix is six script-covering companions requested in the same stylesheet,
 * so one request carries every script the product can render:
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
 * WIRING. Nothing else in this file has an effect until the document shell
 * renders it. `src/routes/__root.tsx` is the only place that may, from its
 * `head()` `links` array, and it has to be all three entries in this order —
 * the two preconnects before the stylesheet, or the stylesheet opens its own
 * connections and the warm-up is wasted:
 *
 *     ...FONT_PRECONNECT_ORIGINS.map(({ href, crossOrigin }) => ({
 *       rel: 'preconnect', href, crossOrigin,
 *     })),
 *     { rel: 'stylesheet', href: FONT_STYLESHEET_HREF },
 *
 * That replaces the shell's own `FONTS_HREF` constant and its two hand-written
 * preconnect entries. There must be exactly one copy of the URL in the repo,
 * because it and the stacks in `tokens.css` have to name the same eight
 * families or a script silently loses its face.
 *
 * Cost, re-measured with a Chrome 150 user agent on 2026-08-23: the stylesheet
 * answers 200 with 465,919 bytes over 499 `@font-face` blocks, every one of
 * them carrying `font-display: swap`. It is that large because the four CJK
 * families are cut into ~100 `unicode-range` slices each. The slicing is also
 * what makes it affordable — a page with no Han on it downloads none of those
 * slices — but the CSS itself is on the critical path, so the shell should keep
 * this to a single `<link>` and never duplicate it.
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
const FONT_FAMILIES: readonly FontFamilyRequest[] = [
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

/**
 * `display=swap` is a request-level parameter: the API stamps `font-display:
 * swap` onto every one of the 499 `@font-face` blocks it emits, so no script
 * can silently ship with a blocking period the others do not have.
 */
export const FONT_STYLESHEET_HREF = `https://fonts.googleapis.com/css2?${FONT_FAMILIES.map(
  ({ family, weights }) =>
    `family=${family.replaceAll(' ', '+')}:wght@${weights}`,
).join('&')}&display=swap`

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
