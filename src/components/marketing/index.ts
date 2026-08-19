/**
 * The public face of the product: everything the marketing, pricing and legal
 * routes are built from.
 *
 * Nothing in here fetches data or imports from `src/server`. The only outside
 * data it touches is the plan catalogue in `src/lib/plans.ts`, which is the
 * single source of truth for every price on the site.
 */

export * from './section'
export * from './chrome'
export * from './visuals'
export * from './app-preview'
export * from './hero'
export * from './features'
export * from './proof'
export * from './plans'
export * from './faq'
export * from './cta'
export * from './legal'
