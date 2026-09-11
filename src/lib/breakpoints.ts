/**
 * Tailwind's breakpoints, as `matchMedia` queries — and the repo's one rule about
 * writing them.
 *
 * A JS media query paired with a Tailwind variant is a single decision with two
 * halves: one half mounts a component, the other reveals or hides it. The halves
 * have to name the same boundary in the same unit. Tailwind's breakpoints are
 * `rem`, so a `px` query agrees with its variant only at a 16px root font size —
 * a reader who enlarges their browser text moves the variant without moving the
 * query, and the viewport band between the two renders *neither* half. That is a
 * WCAG 2.2 §1.4.4 (Resize Text) failure rather than a cosmetic seam: the same
 * mismatch hid the dashboard's entire reference column, which is what sent the
 * figure here instead of leaving it at each call site.
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
 * gap a `min-width`/`max-width` pair leaves between them.
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
