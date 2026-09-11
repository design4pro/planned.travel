/**
 * Tailwind's breakpoints, as `matchMedia` queries — and the repo's one rule about
 * writing them.
 *
 * A JS media query paired with a Tailwind variant is a single decision with two
 * halves: one half mounts a component, the other reveals or hides it. The halves
 * have to name the same boundary in the same unit. Tailwind's breakpoints are
 * `rem`, so a `px` query agrees with its variant only at the default 16px font
 * size — a reader who has raised their browser's font-size preference moves the
 * variant without moving the query, and the viewport band between the two renders
 * *neither* half. That is a WCAG 2.2 §1.4.4 (Resize Text) failure rather than a
 * cosmetic seam: the same mismatch hid the dashboard's entire reference column,
 * which is what sent the figure here instead of leaving it at each call site.
 *
 * The preference is the whole mechanism, and it is not the same thing as the root
 * font size: Media Queries Level 4 §1.3 resolves a relative unit in a media query
 * against the *initial* value, never against a declaration, so `html { font-size }`
 * moves nothing here. Only the reader's own default moves `rem` — which is exactly
 * why no amount of testing at the authored size finds this class of bug.
 *
 * **The idiom, stated once.** A `matchMedia` query that complements a Tailwind
 * variant is one of the constants below — never a literal at the call site, never
 * `px`. Each call site names the constant it uses and the variant it pairs with,
 * so the pairing is legible from either end. A query that complements no variant
 * is an independent boundary and says so where it is declared; queries that are
 * not about viewport width at all — `prefers-color-scheme`,
 * `prefers-reduced-motion` — are outside this rule.
 *
 * The range syntax (`width >= …`) is deliberate: it is what Tailwind v4's own
 * variants compile to, so the two halves meet exactly, with none of the 0.02px
 * gap a `min-width`/`max-width` pair leaves between them. It is not free — an
 * engine that cannot parse it evaluates the query to `not all` and answers `false`
 * forever, which on a desktop means neither half renders — but the floor it sets
 * (Chrome 104, Firefox 102, Safari 16.4) sits under Tailwind v4's own, so the
 * stylesheet has already stopped working by the time this does.
 *
 * The values are Tailwind's defaults. This theme leaves them alone —
 * `src/styles/styles.css` declares no `--breakpoint-*` — so changing one means
 * changing it there and here together.
 */

/** Tailwind's `sm`. */
const SM = '40rem'
/** Tailwind's `md`. */
const MD = '48rem'
/** Tailwind's `lg`. */
const LG = '64rem'

/** Complements `sm:` — true exactly where the `sm` variant applies. */
export const MEDIA_SM_UP = `(width >= ${SM})`

/** Complements `md:` — true exactly where the `md` variant applies. */
export const MEDIA_MD_UP = `(width >= ${MD})`

/** Complements `max-md:` — true exactly where the `md` variant does not apply. */
export const MEDIA_MD_DOWN = `(width < ${MD})`

/** Complements `lg:` — true exactly where the `lg` variant applies. */
export const MEDIA_LG_UP = `(width >= ${LG})`
