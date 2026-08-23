/**
 * The shape of an audit action name, declared once for both logs.
 *
 * docs/ACCESS.md §4.2 requires this rule to be *imported*, never re-declared: two spellings of a
 * character class are two vocabularies waiting to disagree, and the tenant log
 * (`src/server/repos/audit.ts`) and the platform log (`src/server/catalog/audit.ts`) enforce the
 * identical rule.
 *
 * It lives in a third place rather than in the tenant log that first declared it, and the reason is
 * structural. `src/server/repos/audit.ts` imports `./base` and calls `createTenantRepository()` at
 * module-evaluation time, so importing the constant from there would drag the tenant repository into
 * the global table's module graph — the one graph SPEC §5 says must never reach it. Re-declaring the
 * regex breaks §4.2; importing it across that boundary breaks SPEC §5. A leaf module is the only
 * arrangement that satisfies both, which is why **this file imports nothing at all** and must keep
 * importing nothing: an import here is what would put the two rules back in conflict.
 *
 * The regex carries no `g` flag, so it holds no `lastIndex` and sharing one instance across modules
 * is safe.
 */

/** Lowercase dotted verb, e.g. `trip.archived` or `platform.user.role_changed`. */
export const AUDIT_ACTION_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/
